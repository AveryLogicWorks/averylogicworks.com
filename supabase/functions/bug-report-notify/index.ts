import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const { name, email, product, severity, title, description, steps_to_reproduce } = body;

    if (!product || !title || !description) {
      return json({ error: "Missing required fields: product, title, description" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !serviceKey) {
      console.error("bug-report-notify: missing env vars");
      return json({ error: "Server not configured" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Insert into site_events for vault visibility
    const { error: insertError } = await supabase
      .from("site_events")
      .insert({
        event_type: "bug_report_submitted",
        page_path: "/bug-report.html",
        visitor_token: body.visitor_token || null,
        user_email: email || null,
        metadata: {
          name: name || null,
          email: email || null,
          product,
          severity: severity || "low",
          title,
          description,
          steps_to_reproduce: steps_to_reproduce || null,
          submitted_at: new Date().toISOString(),
          source: "bug-report.html",
        },
      });

    if (insertError) {
      console.error("bug-report-notify: insert error:", insertError.message);
      return json({ error: "Could not save bug report" }, 500);
    }

    // Send email notification via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY") || "";
    if (resendKey) {
      try {
        const severityEmoji: Record<string, string> = {
          low: "🟢",
          medium: "🟡",
          high: "🔴",
          critical: "🚨",
        };
        const emoji = severityEmoji[severity] || "🟢";

        const emailBody = [
          `${emoji} Bug Report — ${severity?.toUpperCase() || "LOW"}`,
          "",
          `Product: ${product}`,
          `Title: ${title}`,
          `Severity: ${severity || "low"}`,
          "",
          `Reported by: ${name || "Anonymous"}`,
          `Email: ${email || "Not provided"}`,
          "",
          "Description:",
          description,
          "",
          steps_to_reproduce ? "Steps to reproduce:" : "",
          steps_to_reproduce || "",
          "",
          `Submitted: ${new Date().toISOString()}`,
          "",
          "Review in the operator vault under bug reports.",
        ].filter(Boolean).join("\n");

        const emailResp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Avery Logic Works <onboarding@resend.dev>",
            to: "Averylogicworks@gmail.com",
            reply_to: email || "Averylogicworks@gmail.com",
            subject: `${emoji} [${severity?.toUpperCase() || "LOW"}] Bug: ${title} — ${product}`,
            text: emailBody,
          }),
        });

        if (!emailResp.ok) {
          const errText = await emailResp.text();
          console.error("bug-report-notify: email send failed:", errText);
        }
      } catch (emailErr) {
        console.error("bug-report-notify: email error:", emailErr);
      }
    } else {
      console.log("bug-report-notify: RESEND_API_KEY not set, skipping email. Report saved to database.");
    }

    return json({ success: true, message: "Bug report submitted successfully" }, 200);
  } catch (err) {
    console.error("bug-report-notify: unexpected error:", err);
    return json({ error: "An unexpected error occurred" }, 500);
  }
});
