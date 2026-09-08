import { createClient } from "npm:@supabase/supabase-js@2";

const TIER_CODE = "TR";
const DEFAULT_TRIAL_DAYS = 3;
const PRIMARY_ADMIN_EMAIL = "adminaverylogicworks@gmail.com";
const ALLOWED_PRODUCTS = new Set(["command-nexus", "speakeasy", "quadrahydra"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};
function json(data: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });
}
async function computeHmac(payload: string): Promise<string> {
  const secret = Deno.env.get("NEXUS_KEY_SECRET") || "";
  if (!secret) throw new Error("Trial-key signing secret is not configured");
  const keyData = new TextEncoder().encode(secret);
  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("").substring(0, 16).toUpperCase();
}
function formatKey(raw: string): string { return raw.match(/.{1,4}/g)!.join("-"); }
function clientIp(req: Request) {
  const raw = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || req.headers.get("fly-client-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0] || "";
  const ip = raw.trim().replace(/^\[|\]$/g, "").slice(0, 64);
  return /^[0-9a-f:.]+$/i.test(ip) ? ip : null;
}
async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const apiKey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    if (!authHeader) return json({ error: "Not authenticated. Please sign in to claim a free trial." }, 401);

    const body = await req.json().catch(() => ({}));
    const requestedProduct = String(body?.product_slug || "command-nexus").trim().toLowerCase();
    const visitorToken = String(body?.visitor_token || "").trim().slice(0, 160) || null;
    if (!ALLOWED_PRODUCTS.has(requestedProduct)) return json({ error: "Unknown trial product." }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRole) return json({ error: "Server not configured. Please contact support." }, 500);

    const userClient = createClient(supabaseUrl, apiKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Not authenticated. Please sign in to claim a free trial." }, 401);
    const email = String(user.email || "").toLowerCase();
    const isPrimaryAdmin = email === PRIMARY_ADMIN_EMAIL;

    let trialDays = DEFAULT_TRIAL_DAYS;
    const { data: product } = await admin.from("product_catalog").select("slug,trial_days,published").eq("slug", requestedProduct).maybeSingle();
    if (product && Number(product.trial_days) > 0) trialDays = Number(product.trial_days);

    const { data: existing, error: checkError } = await admin.from("trial_keys")
      .select("id,license_key,expires_at,claimed_at,product_slug")
      .eq("user_id", user.id).eq("product_slug", requestedProduct).maybeSingle();
    if (checkError) return json({ error: "Could not verify trial eligibility. Please try again." }, 500);

    if (existing && !isPrimaryAdmin) {
      const expiresAt = new Date(existing.expires_at);
      if (new Date() < expiresAt) return json({ key: existing.license_key, expires_at: existing.expires_at, product_slug: requestedProduct, already_claimed: true }, 200);
      return json({ error: "You have already used this product's free trial.", product_slug: requestedProduct, expired: true }, 409);
    }

    const expiryTs = Math.floor(Date.now() / 1000) + (trialDays * 86400);
    const expiryHex = expiryTs.toString(16).toUpperCase().padStart(10, "0");
    const randomBytes = crypto.getRandomValues(new Uint8Array(4));
    const randomPart = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const productTag = requestedProduct === "speakeasy" ? "SP" : "QH";
    const payload = `${TIER_CODE}${expiryHex}${randomPart}`;
    const hmacHex = requestedProduct === "command-nexus" ? await computeHmac(payload) : await computeHmac(`${productTag}:${payload}`);
    const rawKey = `${payload}${hmacHex}`;
    const formattedKey = formatKey(rawKey);
    const now = new Date().toISOString();
    const expiresAtISO = new Date(expiryTs * 1000).toISOString();
    const ip = clientIp(req);
    const claimIpHash = ip ? await sha256(`avery-trial-v1:${ip}`) : null;
    const claimUserAgent = String(req.headers.get("user-agent") || "").slice(0, 1000) || null;

    if (existing && isPrimaryAdmin) {
      const { error: resetError } = await admin.from("trial_keys").update({
        license_key: formattedKey, raw_key: rawKey, tier: "trial", claimed_at: now, expires_at: expiresAtISO,
        device_hash: null, first_activated_at: null, last_validated_at: null,
        claim_visitor_token: visitorToken, claim_ip_hash: claimIpHash, claim_user_agent: claimUserAgent,
      }).eq("id", existing.id);
      if (resetError) return json({ error: "Could not restart the admin trial." }, 500);
      return json({ key: formattedKey, expires_at: expiresAtISO, days: trialDays, product_slug: requestedProduct, admin_reset: true }, 200);
    }

    const { error: insertError } = await admin.from("trial_keys").insert({
      user_id: user.id, user_email: user.email, product_slug: requestedProduct,
      license_key: formattedKey, raw_key: rawKey, tier: "trial", claimed_at: now, expires_at: expiresAtISO,
      claim_visitor_token: visitorToken, claim_ip_hash: claimIpHash, claim_user_agent: claimUserAgent,
    });
    if (insertError) return json({ error: "Could not save trial key. Please try again." }, 500);

    return json({ key: formattedKey, expires_at: expiresAtISO, days: trialDays, product_slug: requestedProduct }, 200);
  } catch (err) {
    console.error("generate-trial-key:", err);
    return json({ error: "An unexpected error occurred. Please try again." }, 500);
  }
});
