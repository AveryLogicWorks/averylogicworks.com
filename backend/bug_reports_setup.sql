-- ============================================================
-- Avery Logic Works™ — Bug Reports System
-- Creates bug_reports table for user-submitted bug reports
-- Run this in Supabase SQL Editor.
-- ============================================================

create table if not exists public.bug_reports (
  id bigserial primary key,
  reporter_name text,
  reporter_email text,
  product text not null,
  severity text not null default 'low',
  title text not null,
  description text not null,
  steps_to_reproduce text,
  status text not null default 'new',
  founder_notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_bug_reports_status on public.bug_reports (status);
create index if not exists idx_bug_reports_severity on public.bug_reports (severity);
create index if not exists idx_bug_reports_product on public.bug_reports (product);
create index if not exists idx_bug_reports_created on public.bug_reports (created_at desc);

alter table public.bug_reports enable row level security;

-- Owner (admin) can do everything
drop policy if exists "Owner can manage bug_reports" on public.bug_reports;
create policy "Owner can manage bug_reports"
on public.bug_reports for all
to authenticated
using (public.is_site_admin())
with check (public.is_site_admin());

-- Anyone can submit a bug report (anon insert)
drop policy if exists "Anyone can submit bug reports" on public.bug_reports;
create policy "Anyone can submit bug reports"
on public.bug_reports for insert
to anon, authenticated
with check (true);

-- Grants
grant select, update, delete on public.bug_reports to authenticated;
grant insert on public.bug_reports to anon, authenticated;
grant usage, select on public.bug_reports_id_seq to anon, authenticated;
