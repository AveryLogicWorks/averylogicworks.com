# issue-license-key

Mints a Command Nexus license key **after** verifying a real Stripe payment, then
returns it to the success page. The license HMAC secret never leaves the server.

## Flow

```
Stripe Payment Link  --(after payment, redirect)-->  command-nexus-success.html?session_id={CHECKOUT_SESSION_ID}
                                                              |
                                                              v  POST { session_id }
                                                     issue-license-key (this function)
                                                              |
                          verify session is paid (Stripe) -> resolve tier -> generate 36-char HMAC key
                                                              |
                                          store in license_keys ledger (idempotent) -> return { key, tier, expires }
```

## One-time setup

### 1. Secrets (set on the function, never in the repo)

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_xxx \
  LICENSE_SECRET_KEY=AVERY_LOGIC_WORKS_COMMAND_NEXUS_2026
# optional: map Stripe price ids to tiers if you don't use metadata
supabase secrets set PRICE_TIER_MAP='{"price_abc":{"tier":"pro","days":30}}'
```

`LICENSE_SECRET_KEY` **must** equal the desktop app's HMAC secret
(`license_key_generator.py` / `license_manager.py`) or the app will reject the keys.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.

### 2. Database

Apply `supabase/migrations/20260610_license_keys.sql` (creates the `license_keys`
ledger with RLS locked to the service role).

### 3. Deploy

```bash
supabase functions deploy issue-license-key --no-verify-jwt
```

(`--no-verify-jwt` so the public success page can call it with the anon key.)

### 4. Tell Stripe where to send buyers + which tier they bought

For **each** Command Nexus Payment Link in the Stripe dashboard:

- **After payment → Redirect**:
  `https://averylogicworks.com/command-nexus-success.html?session_id={CHECKOUT_SESSION_ID}`
- **Metadata** (so the function knows the tier): add
  `tier = trial | starter | pro | business | unlimited`
  and optionally `days = 15 | 30 | 365`.
  (If you prefer not to use metadata, fill in `PRICE_TIER_MAP` instead.)

## Tier codes (must match the desktop app)

| tier      | code | default days |
|-----------|------|--------------|
| trial     | TR   | 15           |
| starter   | ST   | 30           |
| pro       | PR   | 30           |
| business  | BU   | 30           |
| unlimited | UN   | 30           |

Yearly subscriptions auto-extend to 365 days when the line item interval is `year`.

## Test (after deploy)

Use a Stripe **test** key + a test Payment Link, complete a test purchase, and
confirm the success page shows a key and a row lands in `license_keys`. Verify the
key activates in the desktop app.
