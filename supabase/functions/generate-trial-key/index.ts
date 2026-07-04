import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SECRET_KEY = "AVERY_LOGIC_WORKS_COMMAND_NEXUS_2026";
const TIER_CODE = "TR";
const TRIAL_DAYS = 3;

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
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const apiKey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    if (!authHeader) {
      return json({ error: "Not authenticated. Please sign in to claim a free trial." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    if (!supabaseUrl) {
      console.error("generate-trial-key: SUPABASE_URL env var not set");
      return json({ error: "Server not configured. Please contact support." }, 500);
    }
    const supabase = createClient(supabaseUrl, apiKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return json({ error: "Not authenticated. Please sign in to claim a free trial." }, 401);
    }

    // Check if user already claimed
    const { data: existing, error: checkError } = await supabase.from("trial_keys").select("id, license_key, expires_at, claimed_at").eq("user_id", user.id).maybeSingle();
    if (checkError) {
      console.error("generate-trial-key: check error:", checkError.message);
      return json({ error: "Could not verify trial eligibility. Please try again." }, 500);
    }
    if (existing) {
      const expiresAt = new Date(existing.expires_at);
      if (new Date() < expiresAt) {
        return json({ key: existing.license_key, expires_at: existing.expires_at, already_claimed: true, message: "You already claimed a free trial key." }, 200);
      } else {
        return json({ error: "You have already used your free trial. Please purchase a subscription to continue.", expired: true }, 409);
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
      console.error("generate-trial-key: insert error:", insertError.message);
      return json({ error: "Could not save trial key. Please try again." }, 500);
    }

    return json({ key: formattedKey, expires_at: expiresAtISO, days: TRIAL_DAYS, message: `Your ${TRIAL_DAYS}-day free trial key is ready!` }, 200);
  } catch (err) {
    console.error("generate-trial-key: unexpected error:", err);
    return json({ error: "An unexpected error occurred. Please try again." }, 500);
  }
});
