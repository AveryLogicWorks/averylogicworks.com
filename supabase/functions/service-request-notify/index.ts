import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://www.averylogicworks.com", "https://averylogicworks.com",
  "https://averylogicworks.github.io", "http://localhost:3000", "http://127.0.0.1:3000",
]);
const tiers: Record<string, { label: string; cents: number }> = {
  starter: { label: "Starter Build", cents: 2000 },
  standard: { label: "Standard Build", cents: 5000 },
  expanded: { label: "Expanded Build", cents: 10000 },
  custom: { label: "Custom Software", cents: 10000 },
};

function headers(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://www.averylogicworks.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin", "Content-Type": "application/json",
  };
}
function json(req: Request, data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: headers(req) }); }
function text(value: unknown, max: number) { return String(value ?? "").trim().slice(0, max); }
function clientIp(req: Request) {
  const raw = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0] || "";
  const ip = raw.trim().replace(/^\[|\]$/g, "").slice(0, 64);
  return /^[0-9a-f:.]+$/i.test(ip) ? ip : null;
}
async function hash(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed." }, 405);
  const origin = req.headers.get("origin") || "";
  if (origin && !allowedOrigins.has(origin)) return json(req, { error: "Origin not allowed." }, 403);

  try {
    const body = await req.json().catch(() => null);
    const customerName = text(body?.customer_name, 120);
    const customerEmail = text(body?.customer_email, 320).toLowerCase();
    const subject = text(body?.subject, 200);
    const details = text(body?.details, 12000);
    const tierKey = text(body?.tier_key, 40).toLowerCase();
    const visitorToken = text(body?.visitor_token, 160) || null;
    if (!body || !customerName || !subject || details.length < 10 || !tiers[tierKey] || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return json(req, { error: "Check the name, email, tier, subject, and project details." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) return json(req, { error: "Private intake is unavailable." }, 503);
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const ip = clientIp(req);
    const ipHash = ip ? await hash(`avery-telemetry-v1:${ip}`) : null;
    const promoCode = text(body?.promo_code, 40).toUpperCase() === "BACK25" ? "BACK25" : null;
    const quotedPriceCents = promoCode ? Math.round(tiers[tierKey].cents * 0.75) : tiers[tierKey].cents;
    const requestId = crypto.randomUUID();
    const now = new Date().toISOString();
    const userAgent = text(req.headers.get("user-agent"), 1000) || null;
    const referrer = text(req.headers.get("referer"), 1000) || null;

    const { error: requestError } = await admin.from("service_requests").insert({
      request_id: requestId, customer_name: customerName, customer_email: customerEmail,
      subject, details, tier_key: tierKey, tier_label: tiers[tierKey].label,
      quoted_price_cents: quotedPriceCents, promo_code: promoCode,
      visitor_token: visitorToken, ip_address: ip, ip_hash: ipHash, user_agent: userAgent,
      referrer, metadata: { source: "service-intake.html" },
    });
    if (requestError) throw requestError;

    await admin.from("site_events").insert({
      event_type: "service_request_submitted", page_path: "/service-intake.html",
      visitor_token: visitorToken, user_email: customerEmail,
      metadata: { request_id: requestId, tier_key: tierKey, tier_label: tiers[tierKey].label,
        quoted_price_cents: quotedPriceCents, promo_code: promoCode, customer_name: customerName,
        customer_email: customerEmail, subject, details, source: "service-intake.html" },
    });
    await admin.from("security_events").insert({
      event_type: "service_request_submitted", severity: "notice", page_path: "/service-intake.html",
      visitor_token: visitorToken, user_email: customerEmail, ip_address: ip, ip_hash: ipHash,
      user_agent: userAgent, referrer, metadata: { request_id: requestId, tier_key: tierKey },
    });

    await admin.from("service_requests").update({
      notification_sent_at: now,
      notification_error: null,
    }).eq("request_id", requestId);

    return json(req, { ok: true, request_id: requestId, notification_sent: true, notification_channel: "owner_vault" });
  } catch (error) {
    console.error("service-request-notify", error);
    return json(req, { error: "Your request could not be saved privately." }, 500);
  }
});
