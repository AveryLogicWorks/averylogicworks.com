-- Run this in Supabase SQL Editor.
-- Replace the owner email below with the exact email address you will use to sign in.

create table if not exists public.site_admins (
  email text primary key,
  created_at timestamptz not null default now()
);

insert into public.site_admins (email)
values ('REPLACE_WITH_YOUR_OWNER_LOGIN_EMAIL')
on conflict (email) do nothing;

create table if not exists public.site_events (
  id bigserial primary key,
  event_type text not null,
  page_path text,
  visitor_token text,
  user_id uuid,
  user_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_site_events_type_created on public.site_events (event_type, created_at desc);
create index if not exists idx_site_events_email on public.site_events (user_email);
create index if not exists idx_site_events_visitor on public.site_events (visitor_token);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  newsletter_opt_in boolean not null default false,
  supporter_updates_opt_in boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.supporter_events (
  id bigserial primary key,
  event_type text not null,
  amount_cents bigint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.site_admins enable row level security;
alter table public.site_events enable row level security;
alter table public.profiles enable row level security;
alter table public.supporter_events enable row level security;

create or replace function public.is_site_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.site_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

drop policy if exists "Admins can read site_admins" on public.site_admins;
create policy "Admins can read site_admins"
on public.site_admins for select
using (public.is_site_admin());

drop policy if exists "Anyone can insert site events" on public.site_events;
create policy "Anyone can insert site events"
on public.site_events for insert
with check (true);

drop policy if exists "Admins can read site events" on public.site_events;
create policy "Admins can read site events"
on public.site_events for select
using (public.is_site_admin());

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
using (auth.uid() = user_id or public.is_site_admin());

drop policy if exists "Admins can read supporter events" on public.supporter_events;
create policy "Admins can read supporter events"
on public.supporter_events for select
using (public.is_site_admin());

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name, newsletter_opt_in, supporter_updates_opt_in)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    coalesce((new.raw_user_meta_data ->> 'newsletter_opt_in')::boolean, false),
    coalesce((new.raw_user_meta_data ->> 'supporter_updates_opt_in')::boolean, false)
  )
  on conflict (user_id) do update
  set
    display_name = excluded.display_name,
    newsletter_opt_in = excluded.newsletter_opt_in,
    supporter_updates_opt_in = excluded.supporter_updates_opt_in,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

create or replace function public.get_owner_dashboard_counts()
returns table (
  visits_24h bigint,
  visits_30d bigint,
  visits_all_time bigint,
  logins_30d bigint,
  logins_all_time bigint,
  signups_30d bigint,
  signups_all_time bigint,
  accounts_total bigint,
  newsletter_opt_ins bigint,
  supporter_updates_opt_ins bigint,
  donation_events bigint,
  subscription_events bigint,
  donation_total_cents bigint,
  subscription_total_cents bigint,
  donation_total_display text,
  subscription_total_display text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  donation_cents bigint;
  subscription_cents bigint;
begin
  if not public.is_site_admin() then
    return;
  end if;

  select count(*) into visits_24h
  from public.site_events
  where event_type = 'page_visit'
    and created_at >= now() - interval '24 hours';

  select count(*) into visits_30d
  from public.site_events
  where event_type = 'page_visit'
    and created_at >= now() - interval '30 days';

  select count(*) into visits_all_time
  from public.site_events
  where event_type = 'page_visit';

  select count(*) into logins_30d
  from public.site_events
  where event_type = 'login_success'
    and created_at >= now() - interval '30 days';

  select count(*) into logins_all_time
  from public.site_events
  where event_type = 'login_success';

  select count(*) into signups_30d
  from public.site_events
  where event_type = 'signup_submitted'
    and created_at >= now() - interval '30 days';

  select count(*) into signups_all_time
  from public.site_events
  where event_type = 'signup_submitted';

  select count(*) into accounts_total from public.profiles;
  select count(*) into newsletter_opt_ins from public.profiles where newsletter_opt_in is true;
  select count(*) into supporter_updates_opt_ins from public.profiles where supporter_updates_opt_in is true;

  select count(*)::bigint, coalesce(sum(amount_cents), 0)::bigint
    into donation_events, donation_cents
  from public.supporter_events
  where lower(event_type) like 'donation%';

  select count(*)::bigint, coalesce(sum(amount_cents), 0)::bigint
    into subscription_events, subscription_cents
  from public.supporter_events
  where lower(event_type) like 'subscription%'
     or lower(event_type) like 'monthly%';

  donation_total_cents := coalesce(donation_cents, 0);
  subscription_total_cents := coalesce(subscription_cents, 0);
  donation_total_display := '$' || to_char(donation_total_cents / 100.0, 'FM9999999990.00');
  subscription_total_display := '$' || to_char(subscription_total_cents / 100.0, 'FM9999999990.00');

  return next;
end;
$$;

grant execute on function public.get_owner_dashboard_counts() to authenticated;
