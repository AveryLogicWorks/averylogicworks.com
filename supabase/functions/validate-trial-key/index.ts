import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
};

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const rawKey = String(body?.key || "").trim().toUpperCase().replace(/[\s-]/g, "");
    const productSlug = String(body?.product_slug || "").trim().toLowerCase();
    const deviceHash = String(body?.device_hash || "").trim().toLowerCase();

    if (!/^[A-Z0-9]{36}$/.test(rawKey)) return json({ valid: false, reason: "invalid_key" });
    if (!new Set(["speakeasy", "quadrahydra"]).has(productSlug)) return json({ valid: false, reason: "invalid_product" }, 400);
    if (!/^[a-f0-9]{64}$/.test(deviceHash)) return json({ valid: false, reason: "invalid_device" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRole) return json({ error: "Server not configured" }, 500);

    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: trial, error } = await admin
      .from("trial_keys")
      .select("id, product_slug, expires_at, device_hash, first_activated_at")
      .eq("raw_key", rawKey)
      .eq("product_slug", productSlug)
      .maybeSingle();

    if (error) return json({ error: "Trial validation unavailable" }, 500);
    if (!trial) return json({ valid: false, reason: "invalid_key" });

    const expiresAt = new Date(trial.expires_at);
    if (!Number.isFinite(expiresAt.getTime()) || Date.now() >= expiresAt.getTime()) {
      return json({ valid: false, expired: true, reason: "expired", expires_at: trial.expires_at });
    }

    if (trial.device_hash && String(trial.device_hash).toLowerCase() !== deviceHash) {
      return json({ valid: false, device_mismatch: true, reason: "different_computer" });
    }

    const now = new Date().toISOString();
    if (!trial.device_hash) {
      const { data: bound, error: bindError } = await admin
        .from("trial_keys")
        .update({ device_hash: deviceHash, first_activated_at: trial.first_activated_at || now, last_validated_at: now })
        .eq("id", trial.id)
        .is("device_hash", null)
        .select("id, device_hash")
        .maybeSingle();
      if (bindError) return json({ error: "Could not bind trial to this computer" }, 500);
      if (!bound) {
        const { data: reread } = await admin.from("trial_keys").select("device_hash").eq("id", trial.id).maybeSingle();
        if (!reread || String(reread.device_hash || "").toLowerCase() !== deviceHash) {
          return json({ valid: false, device_mismatch: true, reason: "different_computer" });
        }
      }
    } else {
      await admin.from("trial_keys").update({ last_validated_at: now }).eq("id", trial.id);
    }

    return json({ valid: true, product_slug: productSlug, expires_at: trial.expires_at, device_bound: true });
  } catch (error) {
    console.error("validate-trial-key:", error);
    return json({ error: "Unexpected trial validation error" }, 500);
  }
});
