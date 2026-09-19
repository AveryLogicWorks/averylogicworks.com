-- Recorded from the migration applied on 2026-09-18.
create table if not exists public.command_nexus_licenses (
 id uuid primary key default gen_random_uuid(),
 raw_key text not null unique check (raw_key ~ '^[A-Z0-9]{30}$'),
 trial_user_id uuid unique references auth.users(id) on delete cascade,
 tier text not null check(tier in ('trial','starter','pro','business','enterprise_property','enterprise_corporate')),
 issued_at timestamptz not null default now(),
 expires_at timestamptz not null,
 device_hash text check(device_hash is null or device_hash ~ '^[a-f0-9]{64}$'),
 first_activated_at timestamptz,
 revoked_at timestamptz,
 note text,
 check(expires_at > issued_at)
);
alter table public.command_nexus_licenses enable row level security;
revoke all on public.command_nexus_licenses from public, anon, authenticated;
grant select,insert,update,delete on public.command_nexus_licenses to service_role;
comment on table public.command_nexus_licenses is 'Server-issued single-computer licenses. Only service-role issuance and company administration may modify entitlements.';
