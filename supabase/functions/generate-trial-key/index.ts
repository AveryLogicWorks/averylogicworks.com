import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SECRET_KEY = "AVERY_LOGIC_WORKS_COMMAND_NEXUS_2026";
const TIER_CODE = "TR";
const TRIAL_DAYS = 3;

async function computeHmac(payload: string): Promise<string> {
  const keyData = new TextEncoder().encode(SECRET_KEY);
  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("").substring(0, 16).toUpperCase();
}

function formatKey(raw: string): string {
  return raw.match(/.{1,4}/g)!.join("-");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, content-type, apikey" } });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const apiKey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated. Please sign in to claim a free trial." }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, apiKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated. Please sign in to claim a free trial." }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    // Check if user already claimed
    const { data: existing, error: checkError } = await supabase.from("trial_keys").select("id, license_key, expires_at, claimed_at").eq("user_id", user.id).maybeSingle();
    if (checkError) {
      return new Response(JSON.stringify({ error: "Could not verify trial eligibility." }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
    if (existing) {
      const expiresAt = new Date(existing.expires_at);
      if (new Date() < expiresAt) {
        return new Response(JSON.stringify({ key: existing.license_key, expires_at: existing.expires_at, already_claimed: true, message: "You already claimed a free trial key." }), { status: 200, headers: { "Content-Type": "application/json" } });
      } else {
        return new Response(JSON.stringify({ error: "You have already used your free trial. Please purchase a subscription to continue.", expired: true }), { status: 409, headers: { "Content-Type": "application/json" } });
      }
    }

    // Generate key: tier_code(2) + expiry_hex(10) + random(8) + hmac(16) = 36 chars
    const expiryTs = Math.floor(Date.now() / 1000) + (TRIAL_DAYS * 86400);
    const expiryHex = expiryTs.toString(16).toUpperCase().padStart(10, "0");
    const randomBytes = crypto.getRandomValues(new Uint8Array(4));
    const randomPart = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    const payload = `${TIER_CODE}${expiryHex}${randomPart}`;
    const hmacHex = await computeHmac(payload);
    const rawKey = `${TIER_CODE}${expiryHex}${randomPart}${hmacHex}`;
    const formattedKey = formatKey(rawKey);
    const expiresAtISO = new Date(expiryTs * 1000).toISOString();

    // Save to database
    const { error: insertError } = await supabase.from("trial_keys").insert({
      user_id: user.id,
      user_email: user.email,
      license_key: formattedKey,
      raw_key: rawKey,
      tier: "trial",
      claimed_at: new Date().toISOString(),
      expires_at: expiresAtISO,
    });
    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Could not save trial key. Please try again." }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ key: formattedKey, expires_at: expiresAtISO, days: TRIAL_DAYS, message: "Your 3-day free trial key is ready!" }), { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  } catch (err) {
    console.error("Trial key generation error:", err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred." }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
