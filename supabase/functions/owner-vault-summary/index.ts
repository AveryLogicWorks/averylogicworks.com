import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://averylogicworks.com",
  "https://www.averylogicworks.com",
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://averylogicworks.com",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors(req) });
}
function lower(v: unknown) { return String(v || "").trim().toLowerCase(); }
function uniq<T>(values: T[]) { return Array.from(new Set(values)); }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const publishable = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authHeader = req.headers.get("authorization") || "";
    if (!url || !publishable || !service || !authHeader) return json(req, { error: "Unauthorized." }, 401);

    const userClient = createClient(url, publishable, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const caller = userData.user;
    if (userError || !caller?.email) return json(req, { error: "Unauthorized." }, 401);

    const { data: ownerRows, error: ownerError } = await admin.from("site_admins").select("email");
    if (ownerError) throw ownerError;
    const ownerEmails = new Set((ownerRows || []).map((r: any) => lower(r.email)));
    if (!ownerEmails.has(lower(caller.email))) return json(req, { error: "Forbidden." }, 403);

    const users: any[] = [];
    for (let page = 1; page <= 5; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      users.push(...(data.users || []));
      if ((data.users || []).length < 1000) break;
    }
    const activeUsers = users.filter((u: any) => !u.deleted_at);
    const userById = new Map(activeUsers.map((u: any) => [u.id, u]));
    const userByEmail = new Map(activeUsers.filter((u: any) => u.email).map((u: any) => [lower(u.email), u]));

    const [profilesR, eventsR, securityR, trialsR, licensesR, contactsR, riskR] = await Promise.all([
      admin.from("user_operator_profiles").select("*").limit(2000),
      admin.from("site_events").select("id,event_type,page_path,visitor_token,user_id,user_email,metadata,created_at").order("created_at", { ascending: false }).limit(5000),
      admin.from("security_events").select("id,event_type,severity,page_path,visitor_token,user_id,user_email,attempted_email,ip_address,ip_hash,user_agent,referrer,country_code,metadata,created_at").order("created_at", { ascending: false }).limit(1500),
      admin.from("trial_keys").select("id,user_id,user_email,product_slug,claimed_at,expires_at,device_hash,first_activated_at,last_validated_at,claim_visitor_token,claim_ip_hash,claim_user_agent").order("claimed_at", { ascending: false }).limit(2000),
      admin.from("software_licenses").select("id,product_slug,customer_user_id,customer_email,license_label,key_hint,status,seats,device_limit,issued_at,expires_at,owner_note,metadata,created_at,updated_at").order("created_at", { ascending: false }).limit(2000),
      admin.from("customer_contacts").select("id,contact_type,status,user_id,email,name,subject,message,product,category,severity,rating,visitor_token,ip_hash,user_agent,metadata,created_at,updated_at").order("created_at", { ascending: false }).limit(1000),
      admin.from("trial_risk_events").select("id,created_at,signal_type,severity,product_slug,user_id,user_email,related_user_ids,related_emails,visitor_token,device_hash,ip_hash,evidence,status,reviewed_at,reviewed_by").order("created_at", { ascending: false }).limit(1000),
    ]);
    for (const result of [profilesR, eventsR, securityR, trialsR, licensesR, contactsR, riskR]) if (result.error) throw result.error;

    const profiles = profilesR.data || [];
    const events = eventsR.data || [];
    const security = securityR.data || [];
    const trials = trialsR.data || [];
    const licenses = licensesR.data || [];
    const contacts = contactsR.data || [];
    const riskSignals = riskR.data || [];
    const profileById = new Map(profiles.map((p: any) => [p.user_id, p]));

    const tokenLinks = new Map<string, { ids: Set<string>, emails: Set<string> }>();
    for (const row of events) {
      if (!row.visitor_token) continue;
      const link = tokenLinks.get(row.visitor_token) || { ids: new Set<string>(), emails: new Set<string>() };
      if (row.user_id && userById.has(row.user_id)) link.ids.add(row.user_id);
      if (row.user_email && userByEmail.has(lower(row.user_email))) link.emails.add(lower(row.user_email));
      tokenLinks.set(row.visitor_token, link);
    }
    for (const row of trials) {
      if (!row.claim_visitor_token) continue;
      const link = tokenLinks.get(row.claim_visitor_token) || { ids: new Set<string>(), emails: new Set<string>() };
      if (row.user_id && userById.has(row.user_id)) link.ids.add(row.user_id);
      if (row.user_email && userByEmail.has(lower(row.user_email))) link.emails.add(lower(row.user_email));
      tokenLinks.set(row.claim_visitor_token, link);
    }

    function linkedUsers(token: string | null) {
      if (!token || !tokenLinks.has(token)) return [] as any[];
      const link = tokenLinks.get(token)!;
      const ids = new Set<string>(link.ids);
      for (const email of link.emails) {
        const u: any = userByEmail.get(email);
        if (u) ids.add(u.id);
      }
      return Array.from(ids).map((id) => userById.get(id)).filter(Boolean);
    }
    function identity(row: any) {
      let direct: any = null;
      if (row.user_id) direct = userById.get(row.user_id) || null;
      if (!direct && row.user_email) direct = userByEmail.get(lower(row.user_email)) || null;
      if (direct) return { kind: ownerEmails.has(lower(direct.email)) ? "owner_account" : "account", user_id: direct.id, email: direct.email || null, display_name: profileById.get(direct.id)?.display_name || direct.user_metadata?.display_name || null, linked_accounts: [] };
      const linked = linkedUsers(row.visitor_token || null);
      if (linked.length === 1) {
        const u: any = linked[0];
        return { kind: ownerEmails.has(lower(u.email)) ? "resolved_owner" : "resolved_account", user_id: u.id, email: u.email || null, display_name: profileById.get(u.id)?.display_name || u.user_metadata?.display_name || null, linked_accounts: [] };
      }
      if (linked.length > 1) return { kind: "shared_token", user_id: null, email: null, display_name: null, linked_accounts: linked.map((u: any) => ({ user_id: u.id, email: u.email || null, owner: ownerEmails.has(lower(u.email)) })) };
      return { kind: "anonymous_visitor", user_id: null, email: null, display_name: null, linked_accounts: [] };
    }
    function isOwnerEvent(row: any) {
      const id = identity(row);
      if (id.kind === "owner_account" || id.kind === "resolved_owner") return true;
      if (id.kind === "shared_token") return id.linked_accounts.some((a: any) => a.owner);
      return false;
    }

    const accountRows = activeUsers.map((u: any) => {
      const p: any = profileById.get(u.id) || {};
      const accountTrials = trials.filter((t: any) => t.user_id === u.id || lower(t.user_email) === lower(u.email));
      const accountLicenses = licenses.filter((l: any) => l.customer_user_id === u.id || lower(l.customer_email) === lower(u.email));
      const accountContacts = contacts.filter((c: any) => c.user_id === u.id || lower(c.email) === lower(u.email));
      const accountRisks = riskSignals.filter((r: any) => r.user_id === u.id || lower(r.user_email) === lower(u.email) || (Array.isArray(r.related_user_ids) && r.related_user_ids.includes(u.id)) || (Array.isArray(r.related_emails) && r.related_emails.map(lower).includes(lower(u.email))));
      return {
        user_id: u.id,
        email: u.email || "",
        is_anonymous: !!u.is_anonymous,
        is_owner: ownerEmails.has(lower(u.email)),
        display_name: p.display_name || u.user_metadata?.display_name || "",
        account_created_at: u.created_at,
        email_confirmed_at: u.email_confirmed_at || null,
        last_sign_in_at: u.last_sign_in_at || p.last_sign_in_at || null,
        provider: p.provider || u.app_metadata?.provider || "email",
        newsletter_opt_in: !!p.newsletter_opt_in,
        supporter_updates_opt_in: !!p.supporter_updates_opt_in,
        first_seen_ip: p.first_seen_ip || null,
        last_seen_ip: p.last_seen_ip || null,
        first_seen_at: p.first_seen_at || null,
        last_seen_at: p.last_seen_at || null,
        login_count: Number(p.login_count || 0),
        event_count: Number(p.event_count || 0),
        risk_level: p.risk_level || "normal",
        needs_attention: !!p.needs_attention,
        support_status: p.support_status || "none",
        owner_note: p.owner_note || "",
        trials: accountTrials,
        licenses: accountLicenses,
        contacts: accountContacts,
        risk_signals: accountRisks,
      };
    }).sort((a: any, b: any) => String(b.account_created_at || "").localeCompare(String(a.account_created_at || "")));

    const customerAccounts = accountRows.filter((a: any) => !a.is_owner);
    const customerEvents = events.filter((e: any) => !isOwnerEvent(e));
    const customerPageEvents = customerEvents.filter((e: any) => e.event_type === "page_visit");
    const cutoff30 = Date.now() - 30 * 86400000;
    const cutoff24 = Date.now() - 86400000;
    const recent30 = (row: any) => new Date(row.created_at).getTime() >= cutoff30;
    const recent24 = (row: any) => new Date(row.created_at).getTime() >= cutoff24;

    const pageCounts = new Map<string, number>();
    for (const row of customerPageEvents.filter(recent30)) pageCounts.set(row.page_path || "/", (pageCounts.get(row.page_path || "/") || 0) + 1);
    const topPages = Array.from(pageCounts.entries()).sort((a,b) => b[1]-a[1]).slice(0,12).map(([label,count]) => ({ label, count }));

    const customerSecurity = security.filter((s: any) => !isOwnerEvent(s));
    const refCounts = new Map<string, number>();
    for (const row of customerSecurity.filter((s: any) => s.event_type === "page_visit" && recent30(s) && s.referrer)) refCounts.set(row.referrer, (refCounts.get(row.referrer) || 0) + 1);
    const topReferrers = Array.from(refCounts.entries()).sort((a,b) => b[1]-a[1]).slice(0,12).map(([label,count]) => ({ label, count }));

    const uniqueVisitorKeys = new Set(customerSecurity.filter((s: any) => s.event_type === "page_visit" && recent30(s)).map((s: any) => s.ip_hash || s.visitor_token).filter(Boolean));
    const securityRows = customerSecurity.filter((s: any) => s.severity === "warning" || s.severity === "critical" || ["login_failed","admin_access_denied","admin_hidden_path_hit","service_intake_save_failed"].includes(s.event_type)).slice(0,100).map((s: any) => ({ ...s, identity: identity(s) }));

    const downloadTypes = new Set(["command_nexus_download","speakeasy_trial_download","quadrahydra_trial_download"]);
    const downloads = events.filter((e: any) => downloadTypes.has(e.event_type)).slice(0,250).map((e: any) => ({ ...e, identity: identity(e) }));
    const mailing = accountRows.filter((a: any) => a.newsletter_opt_in).map((a: any) => ({ user_id:a.user_id,email:a.email,display_name:a.display_name,is_owner:a.is_owner }));
    const supporters = accountRows.filter((a: any) => a.supporter_updates_opt_in).map((a: any) => ({ user_id:a.user_id,email:a.email,display_name:a.display_name,is_owner:a.is_owner }));

    const summary = {
      build: "2026-09-08-enterprise-v15",
      account_summary: {
        total: accountRows.length,
        customers: customerAccounts.length,
        owners: accountRows.filter((a: any) => a.is_owner).length,
        anonymous_auth: accountRows.filter((a: any) => a.is_anonymous).length,
        unconfirmed: accountRows.filter((a: any) => !a.email_confirmed_at).length,
        needs_attention: accountRows.filter((a: any) => a.needs_attention || a.risk_signals.length).length,
      },
      core: {
        accounts_total: accountRows.length,
        customer_accounts_total: customerAccounts.length,
        owner_accounts_total: accountRows.filter((a: any) => a.is_owner).length,
        anonymous_auth_total: accountRows.filter((a: any) => a.is_anonymous).length,
        newsletter_opt_ins: mailing.length,
        customer_newsletter_opt_ins: mailing.filter((m: any) => !m.is_owner).length,
        supporter_updates_opt_ins: supporters.length,
        customer_supporter_updates_opt_ins: supporters.filter((m: any) => !m.is_owner).length,
        visits_24h: customerPageEvents.filter(recent24).length,
        visits_30d: customerPageEvents.filter(recent30).length,
        visits_all_time: customerPageEvents.length,
        logins_30d: customerEvents.filter((e: any) => e.event_type === "login_success" && recent30(e)).length,
        logins_all_time: customerEvents.filter((e: any) => e.event_type === "login_success").length,
        signups_30d: customerEvents.filter((e: any) => e.event_type === "signup_submitted" && recent30(e)).length,
        signups_all_time: customerEvents.filter((e: any) => e.event_type === "signup_submitted").length,
      },
      snapshot: {
        profiles_total: accountRows.length,
        page_visits_total: customerPageEvents.length,
        login_success_total: customerEvents.filter((e: any) => e.event_type === "login_success").length,
        signup_submitted_total: customerEvents.filter((e: any) => e.event_type === "signup_submitted").length,
      },
      people: accountRows,
      mailing_list: mailing,
      supporter_list: supporters,
      traffic: { unique_visitors_30d: uniqueVisitorKeys.size, top_pages: topPages, top_referrers: topReferrers },
      downloads,
      security: securityRows,
      ip_watchlist: [],
      trials,
      licenses,
      risk_signals: riskSignals,
      customer_contacts: contacts,
      owner_activity: {
        total_events: events.filter(isOwnerEvent).length,
        vault_opens: events.filter((e: any) => e.event_type === "owner_vault_opened" && isOwnerEvent(e)).length,
        logins: events.filter((e: any) => e.event_type === "login_success" && isOwnerEvent(e)).length,
        page_visits: events.filter((e: any) => e.event_type === "page_visit" && isOwnerEvent(e)).length,
      },
      clicks: Object.fromEntries(uniq(customerEvents.map((e: any) => e.event_type)).map((type: string) => [type, customerEvents.filter((e: any) => e.event_type === type).length])),
      funnel: {
        feedback_count: contacts.filter((c: any) => c.contact_type === "feedback").length,
        average_rating: (() => { const rs = contacts.map((c:any)=>Number(c.rating||0)).filter((n:number)=>n>0); return rs.length ? (rs.reduce((a:number,b:number)=>a+b,0)/rs.length).toFixed(1) : "0.0"; })(),
        security_events: securityRows.length,
        admin_denied: securityRows.filter((s:any)=>s.event_type === "admin_access_denied").length,
        service_requests: contacts.filter((c:any)=>c.contact_type === "support").length,
        checkout_opens: customerEvents.filter((e:any)=>e.event_type === "service_checkout_opened").length,
      },
      service_requests: contacts.filter((c:any)=>c.contact_type === "support"),
      feedback: contacts.filter((c:any)=>c.contact_type === "feedback"),
    };

    return json(req, summary);
  } catch (error) {
    console.error("owner-vault-summary-v15", error);
    return json(req, { error: error instanceof Error ? error.message : "Unexpected owner vault error." }, 500);
  }
});
