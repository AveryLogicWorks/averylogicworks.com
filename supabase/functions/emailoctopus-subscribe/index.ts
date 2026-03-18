import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const apiKey = Deno.env.get("EMAILOCTOPUS_API_KEY") || "";
    const defaultListId = Deno.env.get("EMAILOCTOPUS_LIST_ID") || "";
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing EMAILOCTOPUS_API_KEY secret" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const name = String(body?.name || "").trim();
    const listId = String(body?.listId || defaultListId || "").trim();

    if (!email || !listId) {
      return new Response(JSON.stringify({ error: "Missing email or listId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const response = await fetch(`https://emailoctopus.com/api/1.6/lists/${listId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        email_address: email,
        fields: name ? { FirstName: name } : {},
        status: "SUBSCRIBED"
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const title = data?.error?.message || data?.error || "EmailOctopus request failed";
      return new Response(JSON.stringify({ error: title, raw: data }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ ok: true, subscribed: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message || "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
