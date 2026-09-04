-- Enterprise owner command center for the Avery Logic Works Operator Vault.
-- Adds no-code page overrides, product management, safe bulk operations,
-- public site controls, incident tracking, revisions, and an owner audit trail.

create extension if not exists pgcrypto;

create table if not exists public.managed_pages (
  page_path text primary key,
  title text not null,
  description text not null default '',
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.managed_page_content (
  id uuid primary key default gen_random_uuid(),
  page_path text not null references public.managed_pages(page_path) on update cascade on delete cascade,
  label text not null,
  selector text not null,
  property text not null default 'text' check (property in ('text', 'href', 'src', 'hidden')),
  value text not null default '',
  published boolean not null default false,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  unique (page_path, selector, property)
);

create table if not exists public.content_revisions (
  id bigint generated always as identity primary key,
  content_id uuid,
  page_path text not null,
  label text not null,
  selector text not null,
  property text not null,
  value text not null default '',
  published boolean not null default false,
  revision integer not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null
);

create table if not exists public.product_catalog (
  slug text primary key,
  product_name text not null,
  short_description text not null default '',
  full_description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'trial', 'live', 'paused', 'retired')),
  published boolean not null default false,
  price_cents bigint not null default 0 check (price_cents >= 0),
  currency text not null default 'USD',
  billing_model text not null default 'one_time' check (billing_model in ('free', 'one_time', 'monthly', 'yearly', 'custom')),
  trial_days integer not null default 0 check (trial_days between 0 and 3650),
  version text not null default '',
  release_channel text not null default 'stable' check (release_channel in ('alpha', 'beta', 'stable', 'legacy')),
  info_url text not null default '',
  purchase_url text not null default '',
  download_url text not null default '',
  support_url text not null default 'support.html',
  terms_url text not null default 'terms.html',
  privacy_url text not null default 'privacy.html',
  featured boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text not null default '',
  public_read boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.site_incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  severity text not null default 'notice' check (severity in ('notice', 'warning', 'critical')),
  status text not null default 'open' check (status in ('open', 'monitoring', 'resolved')),
  affected_area text not null default '',
  owner_note text not null default '',
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.owner_action_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_managed_page_content_page on public.managed_page_content(page_path, published, updated_at desc);
create index if not exists idx_product_catalog_status on public.product_catalog(status, published, updated_at desc);
create index if not exists idx_content_revisions_content on public.content_revisions(content_id, changed_at desc);
create index if not exists idx_site_incidents_status on public.site_incidents(status, severity, updated_at desc);
create index if not exists idx_owner_action_log_created on public.owner_action_log(created_at desc);
create index if not exists idx_owner_action_log_entity on public.owner_action_log(entity_type, entity_id, created_at desc);

alter table public.managed_pages enable row level security;
alter table public.managed_page_content enable row level security;
alter table public.content_revisions enable row level security;
alter table public.product_catalog enable row level security;
alter table public.platform_settings enable row level security;
alter table public.site_incidents enable row level security;
alter table public.owner_action_log enable row level security;

drop policy if exists "Public reads enabled managed pages" on public.managed_pages;
create policy "Public reads enabled managed pages" on public.managed_pages for select
to anon, authenticated
using (enabled or (select public.is_site_admin()));

drop policy if exists "Owner manages managed pages" on public.managed_pages;
create policy "Owner manages managed pages" on public.managed_pages for all
to authenticated
using ((select public.is_site_admin()))
with check ((select public.is_site_admin()));

drop policy if exists "Public reads published page content" on public.managed_page_content;
create policy "Public reads published page content" on public.managed_page_content for select
to anon, authenticated
using (published or (select public.is_site_admin()));

drop policy if exists "Owner manages page content" on public.managed_page_content;
create policy "Owner manages page content" on public.managed_page_content for all
to authenticated
using ((select public.is_site_admin()))
with check ((select public.is_site_admin()));

drop policy if exists "Owner reads content revisions" on public.content_revisions;
create policy "Owner reads content revisions" on public.content_revisions for select
to authenticated
using ((select public.is_site_admin()));

drop policy if exists "Public reads published products" on public.product_catalog;
create policy "Public reads published products" on public.product_catalog for select
to anon, authenticated
using (published or (select public.is_site_admin()));

drop policy if exists "Owner manages products" on public.product_catalog;
create policy "Owner manages products" on public.product_catalog for all
to authenticated
using ((select public.is_site_admin()))
with check ((select public.is_site_admin()));

drop policy if exists "Public reads public platform settings" on public.platform_settings;
create policy "Public reads public platform settings" on public.platform_settings for select
to anon, authenticated
using (public_read or (select public.is_site_admin()));

drop policy if exists "Owner manages platform settings" on public.platform_settings;
create policy "Owner manages platform settings" on public.platform_settings for all
to authenticated
using ((select public.is_site_admin()))
with check ((select public.is_site_admin()));

drop policy if exists "Owner manages incidents" on public.site_incidents;
create policy "Owner manages incidents" on public.site_incidents for all
to authenticated
using ((select public.is_site_admin()))
with check ((select public.is_site_admin()));

drop policy if exists "Owner reads action log" on public.owner_action_log;
create policy "Owner reads action log" on public.owner_action_log for select
to authenticated
using ((select public.is_site_admin()));

drop policy if exists "Owner records actions" on public.owner_action_log;
create policy "Owner records actions" on public.owner_action_log for insert
to authenticated
with check ((select public.is_site_admin()) and actor_user_id = (select auth.uid()));

revoke all on public.managed_pages, public.managed_page_content, public.content_revisions,
  public.product_catalog, public.platform_settings, public.site_incidents, public.owner_action_log
  from anon, authenticated;

grant select on public.managed_pages, public.managed_page_content, public.product_catalog, public.platform_settings
  to anon, authenticated;
grant insert, update, delete on public.managed_pages, public.managed_page_content, public.product_catalog,
  public.platform_settings, public.site_incidents to authenticated;
grant select on public.content_revisions, public.site_incidents, public.owner_action_log to authenticated;
grant insert on public.owner_action_log to authenticated;

create or replace function private.enterprise_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_table_name = 'managed_page_content' and tg_op = 'UPDATE' then
    new.revision := old.revision + 1;
  end if;
  return new;
end;
$$;

create or replace function private.capture_content_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.content_revisions (
    content_id, page_path, label, selector, property, value, published, revision, changed_by
  ) values (
    old.id, old.page_path, old.label, old.selector, old.property, old.value, old.published, old.revision, auth.uid()
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.capture_owner_action()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  record_id text;
  action_name text;
  row_data jsonb;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  record_id := coalesce(row_data ->> 'id', row_data ->> 'slug', row_data ->> 'key', row_data ->> 'page_path', '');
  action_name := lower(tg_op);
  insert into public.owner_action_log (
    actor_user_id, actor_email, action, entity_type, entity_id, summary, details
  ) values (
    auth.uid(),
    nullif(auth.jwt() ->> 'email', ''),
    action_name,
    tg_table_name,
    record_id,
    action_name || ' ' || replace(tg_table_name, '_', ' '),
    jsonb_build_object('new', case when tg_op = 'DELETE' then null else row_data end)
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke execute on function private.enterprise_touch_updated_at() from public, anon, authenticated;
revoke execute on function private.capture_content_revision() from public, anon, authenticated;
revoke execute on function private.capture_owner_action() from public, anon, authenticated;

drop trigger if exists enterprise_touch_managed_pages on public.managed_pages;
create trigger enterprise_touch_managed_pages before update on public.managed_pages
for each row execute function private.enterprise_touch_updated_at();

drop trigger if exists enterprise_touch_page_content on public.managed_page_content;
create trigger enterprise_touch_page_content before update on public.managed_page_content
for each row execute function private.enterprise_touch_updated_at();

drop trigger if exists enterprise_touch_products on public.product_catalog;
create trigger enterprise_touch_products before update on public.product_catalog
for each row execute function private.enterprise_touch_updated_at();

drop trigger if exists enterprise_touch_settings on public.platform_settings;
create trigger enterprise_touch_settings before update on public.platform_settings
for each row execute function private.enterprise_touch_updated_at();

drop trigger if exists enterprise_touch_incidents on public.site_incidents;
create trigger enterprise_touch_incidents before update on public.site_incidents
for each row execute function private.enterprise_touch_updated_at();

drop trigger if exists capture_page_content_revision on public.managed_page_content;
create trigger capture_page_content_revision before update or delete on public.managed_page_content
for each row execute function private.capture_content_revision();

do $$
declare
  table_name text;
begin
  foreach table_name in array array['managed_pages','managed_page_content','product_catalog','platform_settings','site_incidents']
  loop
    execute format('drop trigger if exists capture_owner_action_%I on public.%I', table_name, table_name);
    execute format('create trigger capture_owner_action_%I after insert or update or delete on public.%I for each row execute function private.capture_owner_action()', table_name, table_name);
  end loop;
end;
$$;

create or replace function public.owner_bulk_update_users(
  target_user_ids uuid[],
  new_risk_level text default null,
  new_support_status text default null,
  new_needs_attention boolean default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_count integer;
begin
  if not public.is_site_admin() then
    raise exception 'Owner access required';
  end if;
  if new_risk_level is not null and new_risk_level not in ('normal', 'review', 'restricted') then
    raise exception 'Invalid risk level';
  end if;
  if new_support_status is not null and new_support_status not in ('none', 'waiting', 'in_progress', 'resolved') then
    raise exception 'Invalid support status';
  end if;
  update public.user_operator_profiles
  set risk_level = coalesce(new_risk_level, risk_level),
      support_status = coalesce(new_support_status, support_status),
      needs_attention = coalesce(new_needs_attention, needs_attention),
      updated_at = now()
  where user_id = any(target_user_ids);
  get diagnostics changed_count = row_count;
  insert into public.owner_action_log(actor_user_id, actor_email, action, entity_type, entity_id, summary, details)
  values (auth.uid(), auth.jwt() ->> 'email', 'bulk_update', 'user_operator_profiles', null,
    'Bulk-updated ' || changed_count || ' user records',
    jsonb_build_object('user_ids', target_user_ids, 'risk_level', new_risk_level, 'support_status', new_support_status, 'needs_attention', new_needs_attention));
  return changed_count;
end;
$$;

revoke execute on function public.owner_bulk_update_users(uuid[], text, text, boolean) from public, anon;
grant execute on function public.owner_bulk_update_users(uuid[], text, text, boolean) to authenticated;

create or replace function public.owner_restore_content_revision(revision_id bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved public.content_revisions%rowtype;
begin
  if not public.is_site_admin() then
    raise exception 'Owner access required';
  end if;
  select * into saved from public.content_revisions where id = revision_id;
  if not found then raise exception 'Revision not found'; end if;
  update public.managed_page_content
  set label = saved.label,
      selector = saved.selector,
      property = saved.property,
      value = saved.value,
      published = saved.published
  where id = saved.content_id;
  if not found then
    insert into public.managed_page_content(id, page_path, label, selector, property, value, published, revision, updated_by)
    values (saved.content_id, saved.page_path, saved.label, saved.selector, saved.property, saved.value, saved.published, saved.revision + 1, auth.uid());
  end if;
  return saved.content_id;
end;
$$;

revoke execute on function public.owner_restore_content_revision(bigint) from public, anon;
grant execute on function public.owner_restore_content_revision(bigint) to authenticated;

insert into public.managed_pages(page_path, title, description, sort_order) values
  ('index.html', 'Homepage', 'Main landing page, studio story, calls to action, and support areas.', 10),
  ('programs.html', 'Programs', 'Product listings, trials, pricing, and purchase sections.', 20),
  ('command-nexus.html', 'Command Nexus', 'Command Nexus product page and licensing offers.', 30),
  ('speakeasy-info.html', 'Speakeasy information', 'Detailed Speakeasy product information.', 40),
  ('quadrahydra-info.html', 'QuadraHydra information', 'Detailed QuadraHydra product information.', 50),
  ('service-intake.html', 'Service intake', 'Custom software request form and offer descriptions.', 60),
  ('founder.html', 'Founder', 'Founder story and company background.', 70),
  ('support.html', 'Support', 'Support instructions, refunds, and contact details.', 80),
  ('privacy.html', 'Privacy', 'Website privacy policy.', 90),
  ('terms.html', 'Terms', 'Website terms and conditions.', 100),
  ('login.html', 'Sign in', 'Customer sign-in page.', 110),
  ('signup.html', 'Sign up', 'Customer registration page.', 120),
  ('account.html', 'Customer account', 'Signed-in customer account page.', 130),
  ('feedback.html', 'Feedback', 'Reviews, ratings, and suggestions page.', 140)
on conflict (page_path) do update set
  title = excluded.title,
  description = excluded.description,
  sort_order = excluded.sort_order;

insert into public.product_catalog(
  slug, product_name, short_description, full_description, status, published, price_cents,
  billing_model, trial_days, version, release_channel, info_url, purchase_url, download_url,
  support_url, terms_url, privacy_url, featured
) values
  ('command-nexus', 'Command Nexus', 'A multi-capability desktop command center.', 'Avery Logic Works desktop command center with tiered licensing and local-first workflows.', 'live', true, 3000, 'monthly', 0, '0.2.0', 'stable', 'command-nexus.html', 'command-nexus.html#pricing', 'https://github.com/AveryLogicWorks/Command-Nexus/releases/download/v0.2.0/CommandNexus.exe', 'support.html', 'terms.html', 'privacy.html', true),
  ('speakeasy', 'Speakeasy', 'A lightweight text-to-speech tray reader using voices already installed in Windows.', 'Select or copy text and have Speakeasy read it aloud locally with Windows system voices.', 'trial', true, 1000, 'one_time', 3, '', 'stable', 'speakeasy-info.html', 'programs.html#speakeasy-purchase', 'downloads/Speakeasy-3-Day-Trial.zip', 'support.html', 'terms.html', 'privacy.html', true),
  ('quadrahydra', 'QuadraHydra', 'A Windows resource and process-priority command center.', 'Monitor CPU and memory, inspect processes, and manage workload priorities for editing, rendering, and other heavy work.', 'trial', true, 1500, 'one_time', 3, '1.0.3', 'stable', 'quadrahydra-info.html', 'programs.html#quadrahydra-purchase', 'downloads/QuadraHydra-1.0.3-Windows.zip', 'support.html', 'quadrahydra-terms.html', 'quadrahydra-privacy.html', true)
on conflict (slug) do update set
  product_name = excluded.product_name,
  short_description = excluded.short_description,
  full_description = excluded.full_description,
  status = excluded.status,
  published = excluded.published,
  price_cents = excluded.price_cents,
  billing_model = excluded.billing_model,
  trial_days = excluded.trial_days,
  version = excluded.version,
  release_channel = excluded.release_channel,
  info_url = excluded.info_url,
  purchase_url = excluded.purchase_url,
  download_url = excluded.download_url,
  support_url = excluded.support_url,
  terms_url = excluded.terms_url,
  privacy_url = excluded.privacy_url,
  featured = excluded.featured;

insert into public.platform_settings(key, value, description, public_read) values
  ('site_banner', '{"enabled":false,"message":"","tone":"info"}'::jsonb, 'Public announcement banner shown across the website.', true),
  ('maintenance_mode', '{"enabled":false,"message":"Avery Logic Works is temporarily undergoing maintenance."}'::jsonb, 'Public maintenance notice. Owner Vault remains available.', true),
  ('analytics', '{"enabled":true}'::jsonb, 'Controls first-party website analytics collection.', true),
  ('owner_preferences', '{"confirm_bulk_actions":true,"default_export_limit":500}'::jsonb, 'Private owner command-center preferences.', false)
on conflict (key) do nothing;

drop policy if exists "Public safe event inserts" on public.site_events;
create policy "Public safe event inserts" on public.site_events for insert
to anon, authenticated
with check (
  (user_id is null or user_id = (select auth.uid()))
  and (user_email is null or lower(user_email) = lower(coalesce((select auth.jwt() ->> 'email'), '')))
  and event_type = any (array[
    'page_visit','homepage_visit','homepage_service_cta_click','homepage_donation_click',
    'homepage_signup_click','homepage_signin_click','homepage_founder_cta_click',
    'homepage_support_cta_click','homepage_fit_cta_click','command_nexus_download',
    'trial_key_claimed','speakeasy_section_view','speakeasy_info_click',
    'speakeasy_trial_download','speakeasy_purchase_click','quadrahydra_section_view',
    'quadrahydra_info_click','quadrahydra_trial_download','quadrahydra_purchase_click',
    'public_feedback_submitted','signup_submitted','login_success','login_failed',
    'password_reset_requested','service_checkout_opened'
  ])
);


-- Give the owner a complete license view while keeping customer and public access restricted.
drop policy if exists "Owner reads all trial keys" on public.trial_keys;
create policy "Owner reads all trial keys" on public.trial_keys for select
to authenticated
using ((select public.is_site_admin()));

grant select on public.trial_keys to authenticated;

drop policy if exists "Owner reads activated license hashes" on public.used_license_keys;
create policy "Owner reads activated license hashes" on public.used_license_keys for select
to authenticated
using ((select public.is_site_admin()));

grant select on public.used_license_keys to authenticated;

comment on table public.managed_page_content is 'Safe no-code page overrides. Public pages apply text, link, image, and visibility changes only.';
comment on table public.product_catalog is 'Owner-managed product catalog including Command Nexus, Speakeasy, and QuadraHydra.';
comment on table public.owner_action_log is 'Owner-only tamper-evident operational history for command-center changes.';
