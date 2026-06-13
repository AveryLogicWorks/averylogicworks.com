// Command Nexus - server-side license key validation (PUBLIC keys only).
//
// This endpoint validates ONLY public, customer-facing keys: Trial and the paid
// tiers (Starter / Pro / Business / Unlimited). It deliberately does NOT handle
// any internal/console-only key types - those stay private to the program and
// their salts never touch the website.
//
// The HMAC salt never leaves the server: it is read from the NEXUS_KEY_SECRET
// secret (set with `supabase secrets set NEXUS_KEY_SECRET=...`). This mirrors the
// public salt used to issue trial/paid keys so they validate here. Validation
// MUST stay server-side: shipping the salt to the browser would let anyone mint
// unlimited free keys.
//
// Key format: TIER(2) + EXPIRY_HEX(10) + RANDOM(8) + HMAC(20) = 40 chars.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const enc = new TextEncoder();

// Public, customer-facing tiers only. Internal/console-only key types are
// intentionally excluded from website validation.
const PUBLIC_TIERS: Array<[string, string, string]> = [
  // [tier code, internal name, customer-facing label]
  ["TR", "trial", "7-Day Free Trial"],
  ["ST", "starter", "Starter"],
  ["PR", "pro", "Pro"],
  ["BU", "business", "Business"],
  ["UN", "unlimited", "Unlimited"],
];

function toHex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

async function hmacSig(payload: string, saltBytes: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    saltBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return toHex(new Uint8Array(sig)).slice(0, 20).toUpperCase();
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function validateKey(rawKey: string, publicSalt: Uint8Array) {
  // Tier prefix (e.g. TR, PR) is letters, not hex; only the trailing 38 chars
  // are hex. Require 40 uppercase alphanumerics and let the HMAC do the real work.
  const key = rawKey.trim().toUpperCase().replace(/-/g, "");
  if (!/^[A-Z0-9]{40}$/.test(key)) return null;

  const tierCode = key.slice(0, 2);
  const expiryHex = key.slice(2, 12);
  const payload = key.slice(0, 20);
  const hmacPart = key.slice(20, 40);

  for (const [code, name, label] of PUBLIC_TIERS) {
    if (tierCode !== code) continue;
    const expected = await hmacSig(payload, publicSalt);
    if (!timingSafeEqual(hmacPart, expected)) return null;

    const expiryTs = parseInt(expiryHex, 16);
    if (!Number.isFinite(expiryTs)) return null;
    const expiry = new Date(expiryTs * 1000);
    return {
      valid: true,
      tier: name,
      tier_label: label,
      expires: expiry.toISOString(),
      expired: Date.now() > expiry.getTime(),
    };
  }
  // Unknown / non-public tier code -> not valid here.
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const secret = Deno.env.get("NEXUS_KEY_SECRET") || "";
    if (!secret) {
      return new Response(JSON.stringify({ error: "Missing NEXUS_KEY_SECRET secret" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const rawKey = String(body?.key || "").trim();
    if (!rawKey) {
      return new Response(JSON.stringify({ error: "Missing key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await validateKey(rawKey, enc.encode(secret));

    if (!result) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error)?.message || "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
