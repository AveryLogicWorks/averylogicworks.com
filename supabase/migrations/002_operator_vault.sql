-- Avery Logic Works operator vault: identity, security telemetry, service requests,
-- and owner-to-user messaging integrity.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.profiles
  add column if not exists email text,
  add column if not exists created_at timestamptz not null default now();

insert into public.profiles (
  user_id,
  email,
  display_name,
  newsletter_opt_in,
  supporter_updates_opt_in,
  created_at,
  updated_at
)
select
  u.id,
  lower(u.email),
  coalesce(u.raw_user_meta_data ->> 'display_name', ''),
  case when lower(coalesce(u.raw_user_meta_data ->> 'newsletter_opt_in', 'false')) = 'true' then true else false end,
  case when lower(coalesce(u.raw_user_meta_data ->> 'supporter_updates_opt_in', 'false')) = 'true' then true else false end,
  u.created_at,
  now()
from auth.users u
where u.deleted_at is null
on conflict (user_id) do update
set email = excluded.email,
    created_at = least(public.profiles.created_at, excluded.created_at),
    updated_at = now();

create table if not exists public.user_operator_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  account_created_at timestamptz not null,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  provider text,
  newsletter_opt_in boolean not null default false,
  supporter_updates_opt_in boolean not null default false,
  first_seen_ip inet,
  last_seen_ip inet,
  last_user_agent text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  login_count bigint not null default 0,
  event_count bigint not null default 0,
  risk_level text not null default 'normal'
    check (risk_level in ('normal', 'review', 'restricted')),
  needs_attention boolean not null default false,
  support_status text not null default 'none'
    check (support_status in ('none', 'waiting', 'in_progress', 'resolved')),
  owner_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_operator_profiles enable row level security;
drop policy if exists "Owner can read operator profiles" on public.user_operator_profiles;
create policy "Owner can read operator profiles"
  on public.user_operator_profiles for select
  to authenticated
  using ((select public.is_site_admin()));
drop policy if exists "Owner can update operator profiles" on public.user_operator_profiles;
create policy "Owner can update operator profiles"
  on public.user_operator_profiles for update
  to authenticated
  using ((select public.is_site_admin()))
  with check ((select public.is_site_admin()));
revoke all on public.user_operator_profiles from anon, authenticated;
grant select on public.user_operator_profiles to authenticated;
grant update (risk_level, needs_attention, support_status, owner_note) on public.user_operator_profiles to authenticated;

create index if not exists idx_user_operator_profiles_email
  on public.user_operator_profiles (lower(email));
create index if not exists idx_user_operator_profiles_attention
  on public.user_operator_profiles (updated_at desc)
  where needs_attention is true;
create index if not exists idx_user_operator_profiles_risk
  on public.user_operator_profiles (risk_level, updated_at desc)
  where risk_level <> 'normal';

create table if not exists public.security_events (
  id bigint generated always as identity primary key,
  request_id uuid not null default gen_random_uuid(),
  event_type text not null,
  severity text not null default 'info'
    check (severity in ('info', 'notice', 'warning', 'critical')),
  page_path text,
  visitor_token text,
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  attempted_email text,
  ip_address inet,
  ip_hash text,
  user_agent text,
  referrer text,
  country_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.security_events enable row level security;
drop policy if exists "Owner can read security events" on public.security_events;
create policy "Owner can read security events"
  on public.security_events for select
  to authenticated
  using ((select public.is_site_admin()));
revoke all on public.security_events from anon, authenticated;
grant select on public.security_events to authenticated;

create index if not exists idx_security_events_created
  on public.security_events (created_at desc);
create index if not exists idx_security_events_type_created
  on public.security_events (event_type, created_at desc);
create index if not exists idx_security_events_ip_created
  on public.security_events (ip_hash, created_at desc)
  where ip_hash is not null;
create index if not exists idx_security_events_user_created
  on public.security_events (user_id, created_at desc)
  where user_id is not null;
create index if not exists idx_security_events_warning
  on public.security_events (created_at desc)
  where severity in ('warning', 'critical');

create table if not exists public.service_requests (
  id bigint generated always as identity primary key,
  request_id uuid not null default gen_random_uuid() unique,
  customer_name text not null,
  customer_email text not null,
  subject text not null,
  details text not null,
  tier_key text not null,
  tier_label text not null,
  quoted_price_cents bigint not null default 0,
  promo_code text,
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'contacted', 'accepted', 'closed')),
  checkout_opened_at timestamptz,
  notification_sent_at timestamptz,
  notification_error text,
  visitor_token text,
  ip_address inet,
  ip_hash text,
  user_agent text,
  referrer text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_requests enable row level security;
drop policy if exists "Owner can read service requests" on public.service_requests;
create policy "Owner can read service requests"
  on public.service_requests for select
  to authenticated
  using ((select public.is_site_admin()));
drop policy if exists "Owner can update service requests" on public.service_requests;
create policy "Owner can update service requests"
  on public.service_requests for update
  to authenticated
  using ((select public.is_site_admin()))
  with check ((select public.is_site_admin()));
revoke all on public.service_requests from anon, authenticated;
grant select on public.service_requests to authenticated;
grant update (status) on public.service_requests to authenticated;

create index if not exists idx_service_requests_status_created
  on public.service_requests (status, created_at desc);
create index if not exists idx_service_requests_email
  on public.service_requests (lower(customer_email));
create index if not exists idx_service_requests_ip_created
  on public.service_requests (ip_hash, created_at desc)
  where ip_hash is not null;

alter table public.owner_messages
  add column if not exists recipient_user_id uuid references auth.users(id) on delete cascade;

update public.owner_messages
set recipient_user_id = recipient_email::uuid
where recipient_user_id is null
  and recipient_email ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

create index if not exists idx_owner_messages_recipient_user
  on public.owner_messages (recipient_user_id, created_at desc)
  where recipient_user_id is not null;

drop policy if exists "Users can read their own messages" on public.owner_messages;
create policy "Users can read their own messages"
  on public.owner_messages for select
  to authenticated
  using (
    recipient_user_id = (select auth.uid())
    or (
      audience in ('newsletter', 'all_users')
      and recipient_user_id is null
      and recipient_email is null
    )
    or (select public.is_site_admin())
  );

drop policy if exists "Users can update their own messages" on public.owner_messages;
create policy "Users can update their own messages"
  on public.owner_messages for update
  to authenticated
  using (recipient_user_id = (select auth.uid()) or (select public.is_site_admin()))
  with check (recipient_user_id = (select auth.uid()) or (select public.is_site_admin()));

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_user_operator_profiles_updated_at on public.user_operator_profiles;
create trigger set_user_operator_profiles_updated_at
before update on public.user_operator_profiles
for each row execute function private.touch_updated_at();

drop trigger if exists set_service_requests_updated_at on public.service_requests;
create trigger set_service_requests_updated_at
before update on public.service_requests
for each row execute function private.touch_updated_at();

create or replace function private.sync_operator_user_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_row public.profiles%rowtype;
begin
  select * into profile_row
  from public.profiles
  where user_id = new.id;

  insert into public.user_operator_profiles (
    user_id,
    email,
    display_name,
    account_created_at,
    email_confirmed_at,
    last_sign_in_at,
    provider,
    newsletter_opt_in,
    supporter_updates_opt_in,
    updated_at
  ) values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(profile_row.display_name, new.raw_user_meta_data ->> 'display_name', ''),
    new.created_at,
    new.email_confirmed_at,
    new.last_sign_in_at,
    new.raw_app_meta_data ->> 'provider',
    coalesce(profile_row.newsletter_opt_in, false),
    coalesce(profile_row.supporter_updates_opt_in, false),
    now()
  )
  on conflict (user_id) do update
  set email = excluded.email,
      display_name = case when excluded.display_name <> '' then excluded.display_name else public.user_operator_profiles.display_name end,
      account_created_at = excluded.account_created_at,
      email_confirmed_at = excluded.email_confirmed_at,
      last_sign_in_at = excluded.last_sign_in_at,
      provider = excluded.provider,
      newsletter_opt_in = excluded.newsletter_opt_in,
      supporter_updates_opt_in = excluded.supporter_updates_opt_in,
      updated_at = now();
  return new;
end;
$$;

revoke execute on function private.sync_operator_user_from_auth() from public, anon, authenticated;

drop trigger if exists sync_operator_user_from_auth on auth.users;
create trigger sync_operator_user_from_auth
after insert or update of email, email_confirmed_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data
on auth.users
for each row execute function private.sync_operator_user_from_auth();

create or replace function private.sync_operator_user_from_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.user_operator_profiles
  set display_name = new.display_name,
      newsletter_opt_in = new.newsletter_opt_in,
      supporter_updates_opt_in = new.supporter_updates_opt_in,
      updated_at = now()
  where user_id = new.user_id;
  return new;
end;
$$;

revoke execute on function private.sync_operator_user_from_profile() from public, anon, authenticated;

drop trigger if exists sync_operator_user_from_profile on public.profiles;
create trigger sync_operator_user_from_profile
after insert or update of display_name, newsletter_opt_in, supporter_updates_opt_in
on public.profiles
for each row execute function private.sync_operator_user_from_profile();

insert into public.user_operator_profiles (
  user_id,
  email,
  display_name,
  account_created_at,
  email_confirmed_at,
  last_sign_in_at,
  provider,
  newsletter_opt_in,
  supporter_updates_opt_in,
  first_seen_ip,
  last_seen_ip,
  last_user_agent,
  first_seen_at,
  last_seen_at,
  login_count,
  updated_at
)
select
  u.id,
  lower(coalesce(u.email, '')),
  coalesce(p.display_name, u.raw_user_meta_data ->> 'display_name', ''),
  u.created_at,
  u.email_confirmed_at,
  u.last_sign_in_at,
  u.raw_app_meta_data ->> 'provider',
  coalesce(p.newsletter_opt_in, false),
  coalesce(p.supporter_updates_opt_in, false),
  s.first_ip,
  s.last_ip,
  s.last_user_agent,
  s.first_seen_at,
  s.last_seen_at,
  coalesce(s.login_count, 0),
  now()
from auth.users u
left join public.profiles p on p.user_id = u.id
left join lateral (
  select
    (array_agg(ip order by created_at asc) filter (where ip is not null))[1] as first_ip,
    (array_agg(ip order by created_at desc) filter (where ip is not null))[1] as last_ip,
    (array_agg(user_agent order by created_at desc) filter (where user_agent is not null))[1] as last_user_agent,
    min(created_at) as first_seen_at,
    max(created_at) as last_seen_at,
    count(*)::bigint as login_count
  from auth.sessions
  where user_id = u.id
) s on true
where u.deleted_at is null
on conflict (user_id) do update
set email = excluded.email,
    display_name = excluded.display_name,
    account_created_at = excluded.account_created_at,
    email_confirmed_at = excluded.email_confirmed_at,
    last_sign_in_at = excluded.last_sign_in_at,
    provider = excluded.provider,
    newsletter_opt_in = excluded.newsletter_opt_in,
    supporter_updates_opt_in = excluded.supporter_updates_opt_in,
    first_seen_ip = coalesce(public.user_operator_profiles.first_seen_ip, excluded.first_seen_ip),
    last_seen_ip = coalesce(excluded.last_seen_ip, public.user_operator_profiles.last_seen_ip),
    last_user_agent = coalesce(excluded.last_user_agent, public.user_operator_profiles.last_user_agent),
    first_seen_at = coalesce(public.user_operator_profiles.first_seen_at, excluded.first_seen_at),
    last_seen_at = coalesce(excluded.last_seen_at, public.user_operator_profiles.last_seen_at),
    login_count = greatest(public.user_operator_profiles.login_count, excluded.login_count),
    updated_at = now();

drop policy if exists "Public safe event inserts" on public.site_events;
create policy "Public safe event inserts"
  on public.site_events for insert
  to anon, authenticated
  with check (
    (user_id is null or user_id = (select auth.uid()))
    and (user_email is null or lower(user_email) = lower(coalesce((select (auth.jwt() ->> 'email')), '')))
    and event_type = any (array[
      'page_visit',
      'homepage_visit',
      'homepage_service_cta_click',
      'homepage_donation_click',
      'homepage_signup_click',
      'homepage_signin_click',
      'homepage_founder_cta_click',
      'homepage_support_cta_click',
      'homepage_fit_cta_click',
      'command_nexus_download',
      'trial_key_claimed',
      'speakeasy_purchase_click',
      'public_feedback_submitted',
      'signup_submitted',
      'login_success'
    ])
  );

comment on table public.security_events is
  'Owner-only raw security telemetry. Detailed rows are retained for up to 90 days by the owner vault service.';
comment on table public.user_operator_profiles is
  'Owner-only operational account state. Never expose owner notes or risk labels to end users.';
comment on table public.service_requests is
  'Owner-only normalized Custom Software intake queue.';
