-- Enterprise Inquiry Table — for enterprise customers who want to talk shop
-- Run this in Supabase SQL Editor.

create table if not exists public.enterprise_inquiries (
  id bigserial primary key,
  name text not null,
  email text not null,
  company text,
  phone text,
  team_size text,
  use_case text not null,
  use_case_examples text,
  budget_range text,
  timeline text,
  status text not null default 'new',
  owner_reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_enterprise_inquiries_status on public.enterprise_inquiries (status, created_at desc);
create index if not exists idx_enterprise_inquiries_email on public.enterprise_inquiries (email);

alter table public.enterprise_inquiries enable row level security;

-- Anyone can submit an enterprise inquiry (public form)
drop policy if exists "Anyone can submit enterprise inquiry" on public.enterprise_inquiries;
create policy "Anyone can submit enterprise inquiry"
on public.enterprise_inquiries for insert
with check (true);

-- Only admins can read inquiries
drop policy if exists "Admins can read enterprise inquiries" on public.enterprise_inquiries;
create policy "Admins can read enterprise inquiries"
on public.enterprise_inquiries for select
using (public.is_site_admin());

-- Only admins can update inquiries (reply, change status)
drop policy if exists "Admins can update enterprise inquiries" on public.enterprise_inquiries;
create policy "Admins can update enterprise inquiries"
on public.enterprise_inquiries for update
using (public.is_site_admin())
with check (public.is_site_admin());

-- Grant permissions
grant select, insert, update on public.enterprise_inquiries to anon, authenticated;
