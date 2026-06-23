-- License key ledger: one row per Stripe purchase that minted a Command Nexus key.
-- The issue-license-key edge function writes here (service role) and reads it back
-- for idempotency so a refreshed success page never mints a second key.

create table if not exists public.license_keys (
    id                bigint generated always as identity primary key,
    stripe_session_id text not null unique,
    license_key       text not null,
    raw_key           text not null,
    tier              text not null,
    days              integer not null,
    expiry_iso        timestamptz,
    customer_email    text,
    amount_total      integer,
    currency          text,
    created_at        timestamptz not null default now()
);

create index if not exists license_keys_email_idx on public.license_keys (customer_email);

-- Locked down: only the service role (used by the edge function) can touch this.
-- No anon/auth access — keys must only ever be returned through the verified
-- purchase flow, never queried directly from the browser.
alter table public.license_keys enable row level security;
