import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.averylogicworks.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json",
};
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: corsHeaders }); }
function since(days: number) { return new Date(Date.now() - days * 86400000).toISOString(); }
function securityLabel(type: string) {
  const labels: Record<string, string> = {
    admin_access_denied: "Blocked admin attempt", admin_hidden_path_hit: "Hidden vault hit",
    service_intake_save_failed: "Service intake save failure", owner_vault_opened: "Owner vault opened",
    login_failed: "Failed login attempt", service_request_submitted: "Service request received",
  };
  return labels[type] || type || "Security event";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authHeader = req.headers.get("authorization") || "";
    if (!url || !anonKey || !serviceKey) return json({ error: "Missing Supabase environment variables." }, 500);
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData.user;
    if (!user?.email) return json({ error: "Unauthorized." }, 401);
    const email = user.email.toLowerCase();
    const { data: adminRow, error: adminError } = await admin.from("site_admins").select("email").eq("email", email).maybeSingle();
    if (adminError) throw adminError;
    if (!adminRow) return json({ error: "Forbidden." }, 403);

    const body = await req.json().catch(() => ({}));
    await admin.from("site_events").insert({ event_type: "owner_vault_opened", page_path: "/vault-m7q4k2.html",
      user_id: user.id, user_email: email, metadata: { source: String(body?.source || "vault"), build: String(body?.build || "unknown") } });
    const allUsers: any[] = [];
    for (let page = 1; page <= 10; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      allUsers.push(...(data.users || []));
      if ((data.users || []).length < 1000) break;
    }

    const [operatorResult, requestsResult, requestCountResult, feedbackResult, feedbackCountResult, securityResult, warningCountResult, deniedCountResult, trafficResult, supporterResult] = await Promise.all([
      admin.from("user_operator_profiles").select("*").order("account_created_at", { ascending: false }).limit(1000),
      admin.from("service_requests").select("*").order("created_at", { ascending: false }).limit(50),
      admin.from("service_requests").select("id", { count: "exact", head: true }),
      admin.from("site_events").select("created_at,user_email,metadata").eq("event_type", "public_feedback_submitted").order("created_at", { ascending: false }).limit(50),
      admin.from("site_events").select("id", { count: "exact", head: true }).eq("event_type", "public_feedback_submitted"),
      admin.from("security_events").select("created_at,event_type,severity,page_path,user_email,attempted_email,ip_address,ip_hash,user_agent,referrer,metadata").order("created_at", { ascending: false }).limit(250),
      admin.from("security_events").select("id", { count: "exact", head: true }).in("severity", ["warning", "critical"]),
      admin.from("security_events").select("id", { count: "exact", head: true }).eq("event_type", "admin_access_denied"),
      admin.from("security_events").select("created_at,page_path,visitor_token,ip_hash,referrer").eq("event_type", "page_visit").gte("created_at", since(30)).order("created_at", { ascending: false }).limit(5000),
      admin.from("supporter_events").select("event_type,amount_cents"),
    ]);
    for (const result of [operatorResult, requestsResult, requestCountResult, feedbackResult, feedbackCountResult, securityResult, warningCountResult, deniedCountResult, trafficResult, supporterResult]) {
      if (result.error) throw result.error;
    }

    const eventCount = async (eventType: string, after?: string) => {
      let q = admin.from("site_events").select("id", { count: "exact", head: true }).eq("event_type", eventType);
      if (after) q = q.gte("created_at", after);
      const { count, error } = await q; if (error) throw error; return count || 0;
    };
    const clickNames = ["homepage_visit", "homepage_service_cta_click", "homepage_donation_click", "homepage_signup_click",
      "homepage_signin_click", "homepage_founder_cta_click", "homepage_support_cta_click", "homepage_fit_cta_click",
      "command_nexus_download", "trial_key_claimed", "speakeasy_section_view", "speakeasy_info_click", "speakeasy_trial_download", "speakeasy_purchase_click",
      "quadrahydra_section_view", "quadrahydra_info_click", "quadrahydra_trial_download", "quadrahydra_purchase_click"];
    const [visits24h, visits30d, visitsAll, logins30d, loginsAll, signups30d, signupsAll, clickPairs, checkoutOpens] = await Promise.all([
      eventCount("page_visit", since(1)), eventCount("page_visit", since(30)), eventCount("page_visit"),
      eventCount("login_success", since(30)), eventCount("login_success"), eventCount("signup_submitted", since(30)), eventCount("signup_submitted"),
      Promise.all(clickNames.map(async (name) => [name, await eventCount(name)])), eventCount("service_checkout_opened"),
    ]);

    const downloads30d = await Promise.all(["command_nexus_download", "speakeasy_trial_download", "quadrahydra_trial_download"]
      .map((name) => eventCount(name, since(30))));
    const clickObject = Object.fromEntries(clickPairs);
    clickObject.downloads_30d = downloads30d.reduce((sum, count) => sum + count, 0);

    const operators = new Map((operatorResult.data || []).map((row: any) => [row.user_id, row]));
    const people = allUsers.filter((u) => !u.deleted_at).map((u) => {
      const op: any = operators.get(u.id) || {};
      return { user_id: u.id, email: u.email || op.email || "", display_name: op.display_name || u.user_metadata?.display_name || "",
        account_created_at: u.created_at, email_confirmed_at: u.email_confirmed_at, last_sign_in_at: u.last_sign_in_at,
        provider: op.provider || u.app_metadata?.provider || "email", newsletter_opt_in: !!op.newsletter_opt_in,
        supporter_updates_opt_in: !!op.supporter_updates_opt_in, first_seen_ip: op.first_seen_ip,
        last_seen_ip: op.last_seen_ip, last_user_agent: op.last_user_agent, first_seen_at: op.first_seen_at,
        last_seen_at: op.last_seen_at, login_count: Number(op.login_count || 0), event_count: Number(op.event_count || 0),
        risk_level: op.risk_level || "normal", needs_attention: !!op.needs_attention,
        support_status: op.support_status || "none", owner_note: op.owner_note || "" };
    });

    const rawSecurity = securityResult.data || [];
    const security = rawSecurity.filter((row: any) => row.severity === "warning" || row.severity === "critical" ||
      ["admin_access_denied", "admin_hidden_path_hit", "service_intake_save_failed", "owner_vault_opened"].includes(row.event_type))
      .slice(0, 50).map((row: any) => ({ ...row, label: securityLabel(row.event_type),
        metadata: { ...(row.metadata || {}), ip_address: row.ip_address, attempted_email: row.attempted_email,
          page_path: row.page_path, user_agent: row.user_agent, referrer: row.referrer } }));
    const ipMap = new Map<string, any>();
    for (const row of rawSecurity) {
      if (!row.ip_hash) continue;
      const key = row.ip_hash; const current = ipMap.get(key) || { ip_address: row.ip_address, count: 0, warnings: 0, last_seen_at: row.created_at, emails: new Set(), events: new Set() };
      current.count += 1; if (["warning", "critical"].includes(row.severity)) current.warnings += 1;
      if (row.user_email || row.attempted_email) current.emails.add(row.user_email || row.attempted_email); current.events.add(row.event_type); ipMap.set(key, current);
    }
    const ip_watchlist = Array.from(ipMap.values()).sort((a, b) => b.warnings - a.warnings || b.count - a.count).slice(0, 50)
      .map((v) => ({ ...v, emails: Array.from(v.emails), events: Array.from(v.events) }));

    const top = (rows: any[], getter: (row: any) => string | null) => {
      const counts = new Map<string, number>(); for (const row of rows) { const key = getter(row); if (key) counts.set(key, (counts.get(key) || 0) + 1); }
      return Array.from(counts, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 12);
    };
    const trafficRows = trafficResult.data || [];
    const visitors = new Set(trafficRows.map((r: any) => r.ip_hash || r.visitor_token).filter(Boolean));
    const traffic = { unique_visitors_30d: visitors.size, top_pages: top(trafficRows, (r) => r.page_path || "/"),
      top_referrers: top(trafficRows, (r) => { try { return r.referrer ? new URL(r.referrer).hostname : null; } catch { return r.referrer || null; } }) };

    let donationEvents = 0, subscriptionEvents = 0, donationCents = 0, subscriptionCents = 0;
    for (const row of supporterResult.data || []) { const type = String(row.event_type || "").toLowerCase(); const cents = Number(row.amount_cents || 0);
      if (type.startsWith("donation")) { donationEvents += 1; donationCents += cents; }
      if (type.startsWith("subscription") || type.startsWith("monthly")) { subscriptionEvents += 1; subscriptionCents += cents; } }
    const feedback = feedbackResult.data || []; const ratings = feedback.map((r: any) => Number(r.metadata?.rating || 0)).filter((v: number) => v > 0);
    const serviceRequests = (requestsResult.data || []).map((r: any) => ({ created_at: r.created_at, user_email: r.customer_email, status: r.status,
      metadata: { request_id: r.request_id, customer_name: r.customer_name, customer_email: r.customer_email, subject: r.subject,
        details: r.details, tier_key: r.tier_key, tier_label: r.tier_label, quoted_price_cents: r.quoted_price_cents,
        promo_code: r.promo_code, notification_sent_at: r.notification_sent_at, notification_error: r.notification_error,
        ip_address: r.ip_address, user_agent: r.user_agent } }));
    const warningCount = warningCountResult.count || 0;

    return json({ build: "2026-09-04-enterprise-command-center", snapshot: { profiles_total: people.length, page_visits_total: visitsAll,
      login_success_total: loginsAll, signup_submitted_total: signupsAll }, core: { visits_24h: visits24h, visits_30d: visits30d,
      visits_all_time: visitsAll, logins_30d: logins30d, logins_all_time: loginsAll, signups_30d: signups30d,
      signups_all_time: signupsAll, accounts_total: people.length, newsletter_opt_ins: people.filter((p) => p.newsletter_opt_in).length,
      supporter_updates_opt_ins: people.filter((p) => p.supporter_updates_opt_in).length, donation_events: donationEvents,
      subscription_events: subscriptionEvents, donation_total_display: `$${(donationCents / 100).toFixed(2)}`,
      subscription_total_display: `$${(subscriptionCents / 100).toFixed(2)}` }, clicks: clickObject,
      funnel: { service_requests: requestCountResult.count || 0, checkout_opens: checkoutOpens, feedback_count: feedbackCountResult.count || 0,
        average_rating: ratings.length ? (ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(1) : "0.0",
        security_events: warningCount, admin_denied: deniedCountResult.count || 0 },
      service_requests: serviceRequests, feedback, security, people, traffic, ip_watchlist });
  } catch (error) { console.error("owner-vault-summary", error); return json({ error: error instanceof Error ? error.message : "Unexpected owner vault error." }, 500); }
});
