import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TIER_CODE = "TR";
const DEFAULT_TRIAL_DAYS = 3;
const ALLOWED_PRODUCTS = new Set(["command-nexus", "speakeasy", "quadrahydra"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

function json(data: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function computeHmac(payload: string): Promise<string> {
  const secret = Deno.env.get("NEXUS_KEY_SECRET") || "";
  if (!secret) throw new Error("Trial-key signing secret is not configured");
  const keyData = new TextEncoder().encode(secret);
  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("").substring(0, 16).toUpperCase();
}

function formatKey(raw: string): string {
  return raw.match(/.{1,4}/g)!.join("-");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const apiKey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    if (!authHeader) return json({ error: "Not authenticated. Please sign in to claim a free trial." }, 401);

    const body = await req.json().catch(() => ({}));
    const requestedProduct = String(body?.product_slug || "command-nexus").trim().toLowerCase();
    if (!ALLOWED_PRODUCTS.has(requestedProduct)) return json({ error: "Unknown trial product." }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    if (!supabaseUrl) return json({ error: "Server not configured. Please contact support." }, 500);

    const supabase = createClient(supabaseUrl, apiKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Not authenticated. Please sign in to claim a free trial." }, 401);

    let trialDays = DEFAULT_TRIAL_DAYS;
    const { data: product } = await supabase
      .from("product_catalog")
      .select("slug, trial_days, published")
      .eq("slug", requestedProduct)
      .maybeSingle();
    if (product && Number(product.trial_days) > 0) trialDays = Number(product.trial_days);

    const { data: existing, error: checkError } = await supabase
      .from("trial_keys")
      .select("id, license_key, expires_at, claimed_at, product_slug")
      .eq("user_id", user.id)
      .eq("product_slug", requestedProduct)
      .maybeSingle();
    if (checkError) return json({ error: "Could not verify trial eligibility. Please try again." }, 500);

    if (existing) {
      const expiresAt = new Date(existing.expires_at);
      if (new Date() < expiresAt) {
        return json({ key: existing.license_key, expires_at: existing.expires_at, product_slug: requestedProduct, already_claimed: true }, 200);
      }
      return json({ error: "You have already used this product's free trial.", product_slug: requestedProduct, expired: true }, 409);
    }

    const expiryTs = Math.floor(Date.now() / 1000) + (trialDays * 86400);
    const expiryHex = expiryTs.toString(16).toUpperCase().padStart(10, "0");
    const randomBytes = crypto.getRandomValues(new Uint8Array(4));
    const randomPart = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const productTag = requestedProduct === "speakeasy" ? "SP" : "QH";
    const payload = `${TIER_CODE}${expiryHex}${randomPart}`;
    const hmacHex = requestedProduct === "command-nexus"
      ? await computeHmac(payload)
      : await computeHmac(`${productTag}:${payload}`);
    const rawKey = `${payload}${hmacHex}`;
    const formattedKey = formatKey(rawKey);
    const expiresAtISO = new Date(expiryTs * 1000).toISOString();

    const { error: insertError } = await supabase.from("trial_keys").insert({
      user_id: user.id,
      user_email: user.email,
      product_slug: requestedProduct,
      license_key: formattedKey,
      raw_key: rawKey,
      tier: "trial",
      claimed_at: new Date().toISOString(),
      expires_at: expiresAtISO,
    });
    if (insertError) return json({ error: "Could not save trial key. Please try again." }, 500);

    return json({ key: formattedKey, expires_at: expiresAtISO, days: trialDays, product_slug: requestedProduct }, 200);
  } catch (err) {
    console.error("generate-trial-key:", err);
    return json({ error: "An unexpected error occurred. Please try again." }, 500);
  }
});
