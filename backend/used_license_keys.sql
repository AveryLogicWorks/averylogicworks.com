-- Used License Keys Table — burns keys after first activation
-- Run this in Supabase SQL Editor.
--
-- When a customer enters a key on the website, the validate-key edge function
-- checks this table. If the key hash is NOT here, it's genuine and gets
-- activated (inserted here). If it IS here, the key was already used and
-- is rejected.

create table if not exists public.used_license_keys (
  id bigserial primary key,
  key_hash text not null unique,
  tier_code text not null,
  activated_at timestamptz not null default now(),
  activated_by_email text
);

create index if not exists idx_used_license_keys_hash on public.used_license_keys (key_hash);

alter table public.used_license_keys enable row level security;

-- Only the edge function (service role) can insert/read.
-- Public users interact through the edge function, not directly.
drop policy if exists "No direct public access to used keys" on public.used_license_keys;
create policy "No direct public access to used keys"
on public.used_license_keys for all
using (false)
with check (false);

-- Grant access only to the service role (used by edge functions)
grant all on public.used_license_keys to service_role;
revoke all on public.used_license_keys from anon, authenticated;
