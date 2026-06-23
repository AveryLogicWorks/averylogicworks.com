// issue-license-key
// ------------------
// Mints a Command Nexus license key AFTER verifying a real Stripe payment.
//
// Flow:
//   1. Client (success page) POSTs { session_id } from Stripe's redirect.
//   2. We fetch the Checkout Session from Stripe (STRIPE_SECRET_KEY) and confirm
//      it is actually paid.
//   3. We resolve the tier + duration (session metadata first, then a
//      price->tier map), generate the 36-char HMAC key (same algorithm the
//      desktop app validates), and store it in the `license_keys` ledger.
//   4. Idempotent: the same session_id always returns the same key.
//
// Required function secrets:
//   STRIPE_SECRET_KEY     - sk_live_... / sk_test_...
//   LICENSE_SECRET_KEY    - must equal the desktop app's HMAC secret
//   PRICE_TIER_MAP (opt.) - JSON: { "price_123": {"tier":"pro","days":30}, ... }
// Auto-provided by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TIER_CODES: Record<string, string> = {
  trial: "TR",
  starter: "ST",
  pro: "PR",
  business: "BU",
  unlimited: "UN",
};

const TIER_DEFAULT_DAYS: Record<string, number> = {
  trial: 15,
  starter: 30,
  pro: 30,
  business: 30,
  unlimited: 30,
};

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return toHex(sig);
}

function randomHex(nbytes: number): string {
  const a = new Uint8Array(nbytes);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function formatKey(raw: string): string {
  const r = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (r.match(/.{1,4}/g) || [r]).join("-");
}

// Mirrors license_key_generator.py::generate_license_key exactly.
async function generateLicenseKey(tier: string, days: number, secret: string) {
  const tierCode = TIER_CODES[tier];
  const expiryTs = Math.floor(Date.now() / 1000) + days * 86400;
  const expiryHex = expiryTs.toString(16).padStart(10, "0").toUpperCase();
  const randomPart = randomHex(4).toUpperCase();
  const payload = `${tierCode}${expiryHex}${randomPart}`;
  const sig = (await hmacSha256Hex(secret, payload)).slice(0, 16).toUpperCase();
  const raw = `${tierCode}${expiryHex}${randomPart}${sig}`;
  return {
    raw_key: raw,
    key: formatKey(raw),
    expiry_iso: new Date(expiryTs * 1000).toISOString(),
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Resolve tier + days from the Stripe session.
function resolveTier(session: any, priceMap: Record<string, { tier: string; days?: number }>) {
  // 1. Explicit metadata on the Payment Link / Checkout Session.
  const metaTier = String(session?.metadata?.tier || "").trim().toLowerCase();
  const metaDays = parseInt(String(session?.metadata?.days || ""), 10);
  if (metaTier && TIER_CODES[metaTier]) {
    return { tier: metaTier, days: Number.isFinite(metaDays) ? metaDays : defaultDays(session, metaTier) };
  }

  // 2. Price -> tier map (keyed by Stripe price id).
  const items = session?.line_items?.data || [];
  for (const item of items) {
    const priceId = item?.price?.id || "";
    if (priceId && priceMap[priceId]) {
      const entry = priceMap[priceId];
      const tier = entry.tier.toLowerCase();
      return { tier, days: entry.days ?? defaultDays(session, tier) };
    }
    // 3. Price-level / product-level metadata fallback.
    const priceMetaTier = String(item?.price?.metadata?.tier || "").trim().toLowerCase();
    if (priceMetaTier && TIER_CODES[priceMetaTier]) {
      return { tier: priceMetaTier, days: defaultDays(session, priceMetaTier) };
    }
  }
  return null;
}

function defaultDays(session: any, tier: string): number {
  // Yearly subscriptions get 365 days; otherwise the tier default.
  const items = session?.line_items?.data || [];
  for (const item of items) {
    const interval = item?.price?.recurring?.interval;
    if (interval === "year") return 365;
    if (interval === "month") return 30;
  }
  return TIER_DEFAULT_DAYS[tier] ?? 30;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    const licenseSecret = Deno.env.get("LICENSE_SECRET_KEY") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!stripeKey || !licenseSecret) {
      return json({ error: "Server not configured (missing STRIPE_SECRET_KEY or LICENSE_SECRET_KEY)" }, 500);
    }

    let priceMap: Record<string, { tier: string; days?: number }> = {};
    try {
      priceMap = JSON.parse(Deno.env.get("PRICE_TIER_MAP") || "{}");
    } catch {
      priceMap = {};
    }

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.session_id || "").trim();
    if (!sessionId) return json({ error: "Missing session_id" }, 400);

    // 1. Fetch the checkout session (with line items) from Stripe.
    const sres = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items&expand[]=line_items.data.price`,
      { headers: { Authorization: `Bearer ${stripeKey}` } },
    );
    const session = await sres.json();
    if (!sres.ok) {
      return json({ error: session?.error?.message || "Stripe session lookup failed" }, 400);
    }

    // 2. Confirm payment actually happened.
    const paid = session?.payment_status === "paid" ||
      (session?.status === "complete" && session?.payment_status !== "unpaid");
    if (!paid) {
      return json({ error: "Payment not completed for this session", payment_status: session?.payment_status }, 402);
    }

    const customerEmail = session?.customer_details?.email || session?.customer_email || "";

    // 3. Idempotency: if a key already exists for this session, return it.
    if (supabaseUrl && serviceRole) {
      const existing = await fetch(
        `${supabaseUrl}/rest/v1/license_keys?stripe_session_id=eq.${encodeURIComponent(sessionId)}&select=license_key,tier,expiry_iso`,
        { headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` } },
      );
      if (existing.ok) {
        const rows = await existing.json().catch(() => []);
        if (Array.isArray(rows) && rows.length > 0) {
          return json({ key: rows[0].license_key, tier: rows[0].tier, expires: rows[0].expiry_iso, reused: true });
        }
      }
    }

    // 4. Resolve tier and mint the key.
    const resolved = resolveTier(session, priceMap);
    if (!resolved) {
      return json({
        error: "Could not determine tier. Add metadata 'tier' (and optional 'days') to the Stripe Payment Link, or set PRICE_TIER_MAP.",
      }, 422);
    }

    const { tier, days } = resolved;
    const gen = await generateLicenseKey(tier, days, licenseSecret);

    // 5. Persist to the ledger (best-effort; key is still returned if this fails).
    if (supabaseUrl && serviceRole) {
      await fetch(`${supabaseUrl}/rest/v1/license_keys`, {
        method: "POST",
        headers: {
          apikey: serviceRole,
          Authorization: `Bearer ${serviceRole}`,
          "Content-Type": "application/json",
          Prefer: "resolution=ignore-duplicates,return=minimal",
        },
        body: JSON.stringify({
          stripe_session_id: sessionId,
          license_key: gen.key,
          raw_key: gen.raw_key,
          tier,
          days,
          expiry_iso: gen.expiry_iso,
          customer_email: customerEmail,
          amount_total: session?.amount_total ?? null,
          currency: session?.currency ?? null,
        }),
      }).catch(() => {});
    }

    return json({ key: gen.key, tier, expires: gen.expiry_iso, email: customerEmail });
  } catch (error) {
    return json({ error: (error as Error)?.message || "Unexpected error" }, 500);
  }
});
