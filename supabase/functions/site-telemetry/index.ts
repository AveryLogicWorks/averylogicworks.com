import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://www.averylogicworks.com",
  "https://averylogicworks.com",
  "https://averylogicworks.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const allowedEvents = new Set([
  "page_visit", "homepage_visit", "homepage_service_cta_click",
  "homepage_donation_click", "homepage_signup_click", "homepage_signin_click",
  "homepage_founder_cta_click", "homepage_support_cta_click", "homepage_fit_cta_click",
  "command_nexus_download", "trial_key_claimed", "speakeasy_section_view",
  "speakeasy_info_click", "speakeasy_trial_download", "speakeasy_purchase_click",
  "quadrahydra_section_view", "quadrahydra_info_click", "quadrahydra_trial_download", "quadrahydra_purchase_click",
  "public_feedback_submitted", "signup_submitted", "login_success", "login_failed",
  "password_reset_requested", "service_checkout_opened",
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://www.averylogicworks.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors(req) });
}

function trim(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function clientIp(req: Request) {
  const raw = req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("fly-client-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0] || "";
  const ip = raw.trim().replace(/^\[|\]$/g, "").slice(0, 64);
  return /^[0-9a-f:.]+$/i.test(ip) ? ip : null;
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed." }, 405);

  const origin = req.headers.get("origin") || "";
  if (origin && !allowedOrigins.has(origin)) return json(req, { error: "Origin not allowed." }, 403);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return json(req, { error: "Telemetry is unavailable." }, 503);

    const declaredLength = Number(req.headers.get("content-length") || 0);
    if (declaredLength > 50_000) return json(req, { error: "Request too large." }, 413);
    const rawBody = await req.text();
    if (rawBody.length > 50_000) return json(req, { error: "Request too large." }, 413);
    const body = (() => { try { return JSON.parse(rawBody); } catch { return null; } })();
    const eventType = trim(body?.event_type, 80);
    if (!body || !allowedEvents.has(eventType)) return json(req, { error: "Unsupported event." }, 400);

    const ip = clientIp(req);
    const ipHash = ip ? await sha256(`avery-telemetry-v1:${ip}`) : null;
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    if (ipHash) {
      const since = new Date(Date.now() - 60_000).toISOString();
      const { count } = await admin.from("security_events").select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash).gte("created_at", since);
      if ((count || 0) >= 60) return json(req, { error: "Rate limit exceeded." }, 429);
    }

    let user: { id: string; email?: string | null } | null = null;
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data } = await userClient.auth.getUser();
      user = data.user ? { id: data.user.id, email: data.user.email } : null;
    }

    const metadataCandidate = body?.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? Object.fromEntries(Object.entries(body.metadata).slice(0, 30).map(([key, value]) => [trim(key, 60), typeof value === "string" ? trim(value, 1000) : value]))
      : {};
    const metadata = JSON.stringify(metadataCandidate).length <= 12_000 ? metadataCandidate : {};
    const attemptedEmail = eventType === "login_failed" ? trim(body?.attempted_email, 320).toLowerCase() : null;
    const pagePath = trim(body?.page_path, 500) || "/";
    const visitorToken = trim(body?.visitor_token, 160) || null;
    const userAgent = trim(req.headers.get("user-agent"), 1000) || null;
    const referrer = trim(req.headers.get("referer") || body?.referrer, 1000) || null;
    const severity = eventType === "login_failed" ? "warning" : "info";

    const { error: siteError } = await admin.from("site_events").insert({
      event_type: eventType,
      page_path: pagePath,
      visitor_token: visitorToken,
      user_id: user?.id || null,
      user_email: user?.email || attemptedEmail || null,
      metadata,
    });
    if (siteError) throw siteError;

    const { error: securityError } = await admin.from("security_events").insert({
      event_type: eventType,
      severity,
      page_path: pagePath,
      visitor_token: visitorToken,
      user_id: user?.id || null,
      user_email: user?.email || null,
      attempted_email: attemptedEmail,
      ip_address: ip,
      ip_hash: ipHash,
      user_agent: userAgent,
      referrer,
      metadata,
    });
    if (securityError) throw securityError;

    if (user?.id) {
      const existing = await admin.from("user_operator_profiles")
        .select("first_seen_ip,first_seen_at,event_count,login_count")
        .eq("user_id", user.id).maybeSingle();
      if (existing.data) {
        await admin.from("user_operator_profiles").update({
          first_seen_ip: existing.data.first_seen_ip || ip,
          last_seen_ip: ip,
          last_user_agent: userAgent,
          first_seen_at: existing.data.first_seen_at || new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          event_count: Number(existing.data.event_count || 0) + 1,
          login_count: Number(existing.data.login_count || 0) + (eventType === "login_success" ? 1 : 0),
        }).eq("user_id", user.id);
      }
    }

    return json(req, { ok: true });
  } catch (error) {
    console.error("site-telemetry", error);
    return json(req, { error: "Unable to record telemetry." }, 500);
  }
});
