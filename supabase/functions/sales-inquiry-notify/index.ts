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
    const { name, email, company, team_size, use_case } = body;

    if (!name || !email || !use_case) {
      return json({ error: "Missing required fields: name, email, use_case" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const apiKey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";

    if (!supabaseUrl || !serviceKey) {
      console.error("sales-inquiry-notify: missing env vars");
      return json({ error: "Server not configured" }, 500);
    }

    // Insert into enterprise_inquiries using service role (bypasses RLS)
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: inquiry, error: insertError } = await supabase
      .from("enterprise_inquiries")
      .insert({
        name,
        email,
        company: company || null,
        team_size: team_size || null,
        use_case,
        status: "new",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("sales-inquiry-notify: insert error:", insertError.message);
      return json({ error: "Could not save inquiry" }, 500);
    }

    // Send email notification via Resend (or fallback to logging)
    const resendKey = Deno.env.get("RESEND_API_KEY") || "";
    if (resendKey) {
      try {
        const emailBody = [
          "New Enterprise Sales Inquiry",
          "",
          `Name: ${name}`,
          `Email: ${email}`,
          `Company: ${company || "N/A"}`,
          `Team Size: ${team_size || "N/A"}`,
          "",
          "Use Case:",
          use_case,
          "",
          `Submitted: ${new Date().toISOString()}`,
          "",
          "Reply directly to this email to respond to the customer.",
        ].join("\n");

        const emailResp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Command Nexus <onboarding@resend.dev>",
            to: "AveryLogicWorks@gmail.com",
            reply_to: email,
            subject: `Enterprise Inquiry: ${name} — ${email}`,
            text: emailBody,
          }),
        });

        if (!emailResp.ok) {
          const errText = await emailResp.text();
          console.error("sales-inquiry-notify: email send failed:", errText);
        }
      } catch (emailErr) {
        console.error("sales-inquiry-notify: email error:", emailErr);
      }
    } else {
      console.log("sales-inquiry-notify: RESEND_API_KEY not set, skipping email. Inquiry saved to database.");
    }

    return json({ success: true, id: inquiry?.id, message: "Inquiry submitted successfully" }, 200);
  } catch (err) {
    console.error("sales-inquiry-notify: unexpected error:", err);
    return json({ error: "An unexpected error occurred" }, 500);
  }
});
