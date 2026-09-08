import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://averylogicworks.com",
  "https://www.averylogicworks.com",
  "https://averylogicworks.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);
const allowedTypes = new Set(["support", "bug", "feedback"]);

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
function json(req: Request, data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: cors(req) }); }
function text(v: unknown, max: number) { return String(v ?? "").trim().slice(0, max); }
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed." }, 405);
  const origin = req.headers.get("origin") || "";
  if (origin && !allowedOrigins.has(origin)) return json(req, { error: "Origin not allowed." }, 403);

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const publishable = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    if (!url || !service || !publishable) return json(req, { error: "Contact service unavailable." }, 503);

    const raw = await req.text();
    if (raw.length > 50_000) return json(req, { error: "Request too large." }, 413);
    const body = (() => { try { return JSON.parse(raw); } catch { return null; } })();
    if (!body) return json(req, { error: "Invalid request." }, 400);

    const contactType = text(body.contact_type, 20).toLowerCase();
    if (!allowedTypes.has(contactType)) return json(req, { error: "Unknown contact type." }, 400);
    const name = text(body.name, 160) || null;
    const email = text(body.email, 320).toLowerCase() || null;
    const subject = text(body.subject, 300);
    const message = text(body.message, 12_000);
    const product = text(body.product, 160) || null;
    const category = text(body.category, 100) || null;
    const severity = text(body.severity, 30).toLowerCase() || null;
    const ratingValue = Number(body.rating || 0);
    const rating = Number.isInteger(ratingValue) && ratingValue >= 1 && ratingValue <= 5 ? ratingValue : null;
    const visitorToken = text(body.visitor_token, 160) || null;
    if (!message) return json(req, { error: "Please enter a message." }, 400);
    if (contactType === "support" && (!email || !subject)) return json(req, { error: "Support requests require an email and subject." }, 400);
    if (contactType === "bug" && !subject) return json(req, { error: "Bug reports require a title." }, 400);
    if (contactType === "feedback" && !rating) return json(req, { error: "Please choose a rating." }, 400);

    const admin = createClient(url, service, { auth: { persistSession: false } });
    let user: { id: string; email?: string | null } | null = null;
    const authHeader = req.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      const userClient = createClient(url, publishable, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
      const { data } = await userClient.auth.getUser();
      if (data.user) user = { id: data.user.id, email: data.user.email };
    }

    const ip = clientIp(req);
    const ipHash = ip ? await sha256(`avery-contact-v1:${ip}`) : null;
    if (ipHash) {
      const since = new Date(Date.now() - 15 * 60_000).toISOString();
      const { count } = await admin.from("customer_contacts").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
      if ((count || 0) >= 10) return json(req, { error: "Too many submissions. Please wait a few minutes and try again." }, 429);
    }

    const metadataCandidate = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {};
    const metadata = JSON.stringify(metadataCandidate).length <= 12_000 ? metadataCandidate : {};
    const { data: inserted, error: insertError } = await admin.from("customer_contacts").insert({
      contact_type: contactType,
      user_id: user?.id || null,
      email: email || user?.email || null,
      name,
      subject,
      message,
      product,
      category,
      severity,
      rating,
      visitor_token: visitorToken,
      ip_hash: ipHash,
      user_agent: text(req.headers.get("user-agent"), 1000) || null,
      metadata,
    }).select("id,created_at").single();
    if (insertError) throw insertError;

    const eventType = contactType === "support" ? "support_request_submitted" : contactType === "bug" ? "bug_report_submitted" : "public_feedback_submitted";
    await admin.from("site_events").insert({
      event_type: eventType,
      page_path: text(body.page_path, 500) || "/",
      visitor_token: visitorToken,
      user_id: user?.id || null,
      user_email: user?.email || null,
      metadata: { contact_id: inserted.id, contact_type: contactType, product, category, severity, rating },
    });

    return json(req, { ok: true, id: inserted.id, created_at: inserted.created_at });
  } catch (error) {
    console.error("customer-contact", error);
    return json(req, { error: "Your message could not be saved right now. Please try again." }, 500);
  }
});
