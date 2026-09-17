import { createClient } from "npm:@supabase/supabase-js@2";

const TIER_CODE = "TR";
const DEFAULT_TRIAL_DAYS = 3;
const PRIMARY_ADMIN_EMAIL = "adminaverylogicworks@gmail.com";
const ALLOWED_PRODUCTS = new Set(["command-nexus", "speakeasy", "quadrahydra"]);
const COMMAND_NEXUS_SIGNING_CONTEXT = "avery-logic-works:command-nexus:cn1:ed25519:v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

function json(data: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

let commandNexusSigningKeyPromise:
  | Promise<{ privateKey: CryptoKey; publicKey: string }>
  | null = null;

async function commandNexusSigningKey(): Promise<{
  privateKey: CryptoKey;
  publicKey: string;
}> {
  if (commandNexusSigningKeyPromise) return commandNexusSigningKeyPromise;

  commandNexusSigningKeyPromise = (async () => {
    const secret = Deno.env.get("NEXUS_KEY_SECRET") || "";
    if (!secret) throw new Error("Trial-key signing secret is not configured");

    const encoder = new TextEncoder();
    const derivationKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const seed = new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        derivationKey,
        encoder.encode(COMMAND_NEXUS_SIGNING_CONTEXT),
      ),
    );

    // RFC 8410 PKCS#8 wrapper around a 32-byte Ed25519 seed.
    const prefix = new Uint8Array([
      0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
      0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
    ]);
    const pkcs8 = new Uint8Array(prefix.length + seed.length);
    pkcs8.set(prefix);
    pkcs8.set(seed, prefix.length);

    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      pkcs8,
      { name: "Ed25519" },
      true,
      ["sign"],
    );
    const jwk = await crypto.subtle.exportKey("jwk", privateKey);
    if (!jwk.x) throw new Error("Could not derive the Command Nexus signing public key");
    return { privateKey, publicKey: jwk.x };
  })();

  return commandNexusSigningKeyPromise;
}

async function signCommandNexusTrial(
  expiryTs: number,
  issuedAt = Math.floor(Date.now() / 1000),
): Promise<string> {
  if (!Number.isSafeInteger(expiryTs) || expiryTs <= issuedAt) {
    throw new Error("Trial expiry must be later than its issue time");
  }
  const claims = {
    v: 1,
    tier: "trial",
    iat: issuedAt,
    exp: expiryTs,
    license_id: crypto.randomUUID(),
  };
  const payload = new TextEncoder().encode(JSON.stringify(claims));
  const signingKey = await commandNexusSigningKey();
  const signature = new Uint8Array(
    await crypto.subtle.sign("Ed25519", signingKey.privateKey, payload),
  );
  return `CN1.${base64Url(payload)}.${base64Url(signature)}`;
}

async function computeHmac(payload: string): Promise<string> {
  const secret = Deno.env.get("NEXUS_KEY_SECRET") || "";
  if (!secret) throw new Error("Trial-key signing secret is not configured");
  const keyData = new TextEncoder().encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(payload),
  );
  return Array.from(new Uint8Array(sig))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 16)
    .toUpperCase();
}

function formatKey(raw: string): string {
  return raw.match(/.{1,4}/g)!.join("-");
}

function clientIp(req: Request) {
  const raw =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("fly-client-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0] ||
    "";
  const ip = raw.trim().replace(/^\[|\]$/g, "").slice(0, 64);
  return /^[0-9a-f:.]+$/i.test(ip) ? ip : null;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method === "GET") {
    try {
      const signingKey = await commandNexusSigningKey();
      return json(
        {
          format: "CN1",
          algorithm: "Ed25519",
          public_key: signingKey.publicKey,
        },
        200,
      );
    } catch (error) {
      console.error("generate-trial-key public key:", error);
      return json({ error: "Trial-key service is not configured." }, 500);
    }
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // The platform JWT check is disabled so the desktop-independent public-key
    // discovery route can remain public. Every issuance request is still
    // authenticated here against Supabase Auth before any database or signing
    // operation occurs.
    const authHeader = req.headers.get("Authorization") || "";
    const apiKey =
      req.headers.get("apikey") ||
      Deno.env.get("SUPABASE_ANON_KEY") ||
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
      "";
    if (!/^Bearer\s+\S+$/i.test(authHeader)) {
      return json({ error: "Not authenticated. Please sign in to claim a free trial." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const requestedProduct = String(
      body?.product_slug || "command-nexus",
    ).trim().toLowerCase();
    const visitorToken =
      String(body?.visitor_token || "").trim().slice(0, 160) || null;
    if (!ALLOWED_PRODUCTS.has(requestedProduct)) {
      return json({ error: "Unknown trial product." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRole || !apiKey) {
      return json({ error: "Server not configured. Please contact support." }, 500);
    }

    const userClient = createClient(supabaseUrl, apiKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return json({ error: "Not authenticated. Please sign in to claim a free trial." }, 401);
    }

    const email = String(user.email || "").toLowerCase();
    const isPrimaryAdmin = email === PRIMARY_ADMIN_EMAIL;

    let trialDays = DEFAULT_TRIAL_DAYS;
    const { data: product } = await admin
      .from("product_catalog")
      .select("slug,trial_days,published")
      .eq("slug", requestedProduct)
      .maybeSingle();
    if (product && Number(product.trial_days) > 0) {
      trialDays = Number(product.trial_days);
    }

    const { data: existing, error: checkError } = await admin
      .from("trial_keys")
      .select("id,license_key,expires_at,claimed_at,product_slug")
      .eq("user_id", user.id)
      .eq("product_slug", requestedProduct)
      .maybeSingle();
    if (checkError) {
      return json({ error: "Could not verify trial eligibility. Please try again." }, 500);
    }

    if (existing && !isPrimaryAdmin) {
      const existingExpiry = new Date(existing.expires_at);
      if (new Date() >= existingExpiry) {
        return json(
          {
            error: "You have already used this product's free trial.",
            product_slug: requestedProduct,
            expired: true,
          },
          409,
        );
      }

      // Transparently replace an active legacy Command Nexus key with the
      // signed format understood by the customer executable, without extending
      // the customer's original trial expiration.
      if (
        requestedProduct === "command-nexus" &&
        !String(existing.license_key || "").startsWith("CN1.")
      ) {
        const existingExpiryTs = Math.floor(existingExpiry.getTime() / 1000);
        const migratedKey = await signCommandNexusTrial(existingExpiryTs);
        const { error: migrationError } = await admin
          .from("trial_keys")
          .update({ license_key: migratedKey, raw_key: migratedKey })
          .eq("id", existing.id);
        if (migrationError) {
          return json({ error: "Could not update your trial key. Please try again." }, 500);
        }
        return json(
          {
            key: migratedKey,
            expires_at: existing.expires_at,
            product_slug: requestedProduct,
            already_claimed: true,
            key_upgraded: true,
          },
          200,
        );
      }

      return json(
        {
          key: existing.license_key,
          expires_at: existing.expires_at,
          product_slug: requestedProduct,
          already_claimed: true,
        },
        200,
      );
    }

    const issuedAt = Math.floor(Date.now() / 1000);
    const expiryTs = issuedAt + trialDays * 86400;
    const expiryHex = expiryTs.toString(16).toUpperCase().padStart(10, "0");
    const randomBytes = crypto.getRandomValues(new Uint8Array(4));
    const randomPart = Array.from(randomBytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    const payload = `${TIER_CODE}${expiryHex}${randomPart}`;

    let issuedKey: string;
    let rawKey: string;
    if (requestedProduct === "command-nexus") {
      issuedKey = await signCommandNexusTrial(expiryTs, issuedAt);
      rawKey = issuedKey;
    } else {
      const productTag = requestedProduct === "speakeasy" ? "SP" : "QH";
      const hmacHex = await computeHmac(`${productTag}:${payload}`);
      rawKey = `${payload}${hmacHex}`;
      issuedKey = formatKey(rawKey);
    }

    const now = new Date(issuedAt * 1000).toISOString();
    const expiresAtISO = new Date(expiryTs * 1000).toISOString();
    const ip = clientIp(req);
    const claimIpHash = ip ? await sha256(`avery-trial-v1:${ip}`) : null;
    const claimUserAgent =
      String(req.headers.get("user-agent") || "").slice(0, 1000) || null;

    const trialRecord = {
      license_key: issuedKey,
      raw_key: rawKey,
      tier: "trial",
      claimed_at: now,
      expires_at: expiresAtISO,
      device_hash: null,
      first_activated_at: null,
      last_validated_at: null,
      claim_visitor_token: visitorToken,
      claim_ip_hash: claimIpHash,
      claim_user_agent: claimUserAgent,
    };

    if (existing && isPrimaryAdmin) {
      const { error: resetError } = await admin
        .from("trial_keys")
        .update(trialRecord)
        .eq("id", existing.id);
      if (resetError) {
        return json({ error: "Could not restart the admin trial." }, 500);
      }
      return json(
        {
          key: issuedKey,
          expires_at: expiresAtISO,
          days: trialDays,
          product_slug: requestedProduct,
          admin_reset: true,
        },
        200,
      );
    }

    const { error: insertError } = await admin.from("trial_keys").insert({
      user_id: user.id,
      user_email: user.email,
      product_slug: requestedProduct,
      ...trialRecord,
    });
    if (insertError) {
      return json({ error: "Could not save trial key. Please try again." }, 500);
    }

    return json(
      {
        key: issuedKey,
        expires_at: expiresAtISO,
        days: trialDays,
        product_slug: requestedProduct,
      },
      200,
    );
  } catch (error) {
    console.error("generate-trial-key:", error);
    return json({ error: "An unexpected error occurred. Please try again." }, 500);
  }
});
