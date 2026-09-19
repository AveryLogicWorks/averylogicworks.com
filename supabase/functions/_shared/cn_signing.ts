const COMMAND_NEXUS_SIGNING_CONTEXT = "avery-logic-works:command-nexus:cn1:ed25519:v1";
export function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

let commandNexusSigningKeyPromise:
  | Promise<{
      privateKey: CryptoKey;
      publicCryptoKey: CryptoKey;
      publicKey: string;
    }>
  | null = null;

export async function commandNexusSigningKey(): Promise<{
  privateKey: CryptoKey;
  publicCryptoKey: CryptoKey;
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
    const publicCryptoKey = await crypto.subtle.importKey(
      "jwk",
      {
        kty: "OKP",
        crv: "Ed25519",
        x: jwk.x,
        ext: true,
        key_ops: ["verify"],
      },
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return { privateKey, publicCryptoKey, publicKey: jwk.x };
  })();

  return commandNexusSigningKeyPromise;
}

