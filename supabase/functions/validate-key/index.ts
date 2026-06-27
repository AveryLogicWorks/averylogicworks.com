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
// SINGLE-USE ENFORCEMENT: After HMAC verification, the key hash is checked
// against the used_license_keys table. If not found, the key is "burned"
// (inserted into the table) and returned as valid. If found, the key is
// rejected as already activated — one key, one machine, one activation.
//
// Key format: TIER(2) + EXPIRY_HEX(10) + RANDOM(8) + HMAC(16) = 36 chars.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  ["TR", "trial", "15-Day Trial"],
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
  return toHex(new Uint8Array(sig)).slice(0, 16).toUpperCase();
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sha256Hash(input: string): Promise<string> {
  const data = enc.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(hashBuffer));
}

async function validateKey(rawKey: string, publicSalt: Uint8Array) {
  const key = rawKey.trim().toUpperCase().replace(/[\s-]/g, "");
  if (!/^[A-Z0-9]{36}$/.test(key)) return null;

  const tierCode = key.slice(0, 2);
  const expiryHex = key.slice(2, 12);
  const payload = key.slice(0, 20);
  const hmacPart = key.slice(20, 36);

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
      console.error("validate-key: NEXUS_KEY_SECRET is not configured");
      return new Response(JSON.stringify({ error: "Server not configured" }), {
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

    // Step 1: Verify HMAC signature
    const result = await validateKey(rawKey, enc.encode(secret));

    if (!result) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Check if key is already used (single-use enforcement)
    const normalizedKey = rawKey.trim().toUpperCase().replace(/[\s-]/g, "");
    const keyHash = await sha256Hash(normalizedKey);
    const tierCode = normalizedKey.slice(0, 2);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (supabaseUrl && serviceRoleKey) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey);

      // Check if this key hash is already in the used table
      const { data: existing, error: queryError } = await adminClient
        .from("used_license_keys")
        .select("id, activated_at")
        .eq("key_hash", keyHash)
        .maybeSingle();

      if (queryError) {
        console.error("validate-key: failed to check used_license_keys:", queryError.message);
        // Fail open — return valid but log the error
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (existing) {
        // Key was already activated — reject it
        return new Response(JSON.stringify({
          valid: false,
          already_activated: true,
          reason: "This key has already been activated and cannot be used again.",
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Key is genuine and not yet used — burn it (insert into used table)
      const { error: insertError } = await adminClient
        .from("used_license_keys")
        .insert({
          key_hash: keyHash,
          tier_code: tierCode,
        });

      if (insertError) {
        console.error("validate-key: failed to burn key:", insertError.message);
        // If it's a unique constraint violation, key was burned by a concurrent request
        if (String(insertError.message).includes("duplicate") || String(insertError.message).includes("unique")) {
          return new Response(JSON.stringify({
            valid: false,
            already_activated: true,
            reason: "This key has already been activated and cannot be used again.",
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Other error — fail open, return valid
      }
    }

    // Step 3: Return the valid result
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("validate-key error:", (error as Error)?.message || error);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
