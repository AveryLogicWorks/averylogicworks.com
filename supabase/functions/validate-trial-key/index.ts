import { createClient } from "npm:@supabase/supabase-js@2";

const PRIMARY_ADMIN_EMAIL = "adminaverylogicworks@gmail.com";
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
    const { data: trial, error } = await admin.from("trial_keys")
      .select("id,user_id,user_email,product_slug,expires_at,device_hash,first_activated_at,claim_visitor_token,claim_ip_hash")
      .eq("raw_key", rawKey).eq("product_slug", productSlug).maybeSingle();
    if (error) return json({ error: "Trial validation unavailable" }, 500);
    if (!trial) return json({ valid: false, reason: "invalid_key" });

    const email = String(trial.user_email || "").toLowerCase();
    const isPrimaryAdmin = email === PRIMARY_ADMIN_EMAIL;
    const expiresAt = new Date(trial.expires_at);
    if ((!Number.isFinite(expiresAt.getTime()) || Date.now() >= expiresAt.getTime()) && !isPrimaryAdmin) {
      return json({ valid: false, expired: true, reason: "expired", expires_at: trial.expires_at });
    }

    if (trial.device_hash && String(trial.device_hash).toLowerCase() !== deviceHash && !isPrimaryAdmin) {
      return json({ valid: false, device_mismatch: true, reason: "different_computer" });
    }

    if (!trial.device_hash || isPrimaryAdmin) {
      if (!isPrimaryAdmin) {
        const { data: priorRows, error: priorError } = await admin.from("trial_keys")
          .select("id,user_id,user_email,product_slug,device_hash,first_activated_at")
          .eq("product_slug", productSlug)
          .eq("device_hash", deviceHash)
          .neq("id", trial.id);
        if (priorError) return json({ error: "Could not verify device trial history" }, 500);
        const conflicting = (priorRows || []).filter((r: any) => String(r.user_email || "").toLowerCase() !== PRIMARY_ADMIN_EMAIL && r.user_id !== trial.user_id);
        if (conflicting.length) {
          const relatedIds = conflicting.map((r: any) => r.user_id).filter(Boolean);
          const relatedEmails = conflicting.map((r: any) => r.user_email).filter(Boolean);
          await admin.from("trial_risk_events").insert({
            signal_type: "same_device_repeat_trial",
            severity: "high",
            product_slug: productSlug,
            user_id: trial.user_id,
            user_email: trial.user_email,
            related_user_ids: relatedIds,
            related_emails: relatedEmails,
            visitor_token: trial.claim_visitor_token || null,
            device_hash: deviceHash,
            ip_hash: trial.claim_ip_hash || null,
            evidence: { conflicting_trial_ids: conflicting.map((r: any) => r.id), rule: "one free trial per product per computer across normal accounts" },
            status: "open"
          });
          return json({ valid: false, possible_trial_reuse: true, reason: "trial_already_used_on_computer", review_required: true }, 409);
        }
      }

      const now = new Date().toISOString();
      const update = isPrimaryAdmin
        ? { device_hash: deviceHash, first_activated_at: trial.first_activated_at || now, last_validated_at: now }
        : { device_hash: deviceHash, first_activated_at: trial.first_activated_at || now, last_validated_at: now };
      const { error: bindError } = await admin.from("trial_keys").update(update).eq("id", trial.id);
      if (bindError) return json({ error: "Could not bind trial to this computer" }, 500);
    } else {
      await admin.from("trial_keys").update({ last_validated_at: new Date().toISOString() }).eq("id", trial.id);
    }

    return json({ valid: true, product_slug: productSlug, expires_at: trial.expires_at, device_bound: true, admin_override: isPrimaryAdmin });
  } catch (error) {
    console.error("validate-trial-key:", error);
    return json({ error: "Unexpected trial validation error" }, 500);
  }
});
