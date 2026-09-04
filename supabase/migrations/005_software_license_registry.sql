-- Product-neutral license registry for owner fulfillment and support.

create table if not exists public.software_licenses (
  id uuid primary key default gen_random_uuid(),
  product_slug text not null references public.product_catalog(slug) on update cascade,
  customer_user_id uuid references auth.users(id) on delete set null,
  customer_email text not null,
  license_label text not null default '',
  key_hint text not null default '',
  key_hash text,
  status text not null default 'pending' check (status in ('pending','trial','active','expired','revoked')),
  seats integer not null default 1 check (seats > 0),
  device_limit integer not null default 1 check (device_limit > 0),
  issued_at timestamptz,
  expires_at timestamptz,
  owner_note text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_software_licenses_product_status
  on public.software_licenses(product_slug, status, updated_at desc);
create index if not exists idx_software_licenses_customer
  on public.software_licenses(lower(customer_email), updated_at desc);

alter table public.software_licenses enable row level security;

drop policy if exists "Owner manages software licenses" on public.software_licenses;
create policy "Owner manages software licenses" on public.software_licenses for all
to authenticated
using ((select public.is_site_admin()))
with check ((select public.is_site_admin()));

revoke all on public.software_licenses from anon, authenticated;
grant select, insert, update, delete on public.software_licenses to authenticated;

drop trigger if exists enterprise_touch_software_licenses on public.software_licenses;
create trigger enterprise_touch_software_licenses before update on public.software_licenses
for each row execute function private.enterprise_touch_updated_at();

drop trigger if exists capture_owner_action_software_licenses on public.software_licenses;
create trigger capture_owner_action_software_licenses after insert or update or delete on public.software_licenses
for each row execute function private.capture_owner_action();

comment on table public.software_licenses is
  'Owner-only product-neutral fulfillment registry. Store only a masked key hint or fingerprint, never a reusable plaintext activation secret.';
