-- Downloads tracking table for Command Nexus and other products.
-- Tracks which account downloaded what, when, and from where.
-- Run this in the Supabase SQL Editor.

create table if not exists public.downloads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  email       text,
  product     text not null default 'command-nexus',
  filename    text,
  downloaded_at timestamptz not null default now(),
  ip_address  inet,
  user_agent  text
);

-- Only the server may write verified download records. The browser cannot forge them.
alter table public.downloads enable row level security;
revoke all on public.downloads from anon, authenticated;
grant select on public.downloads to authenticated;
grant all on public.downloads to service_role;
drop policy if exists "Users can log their own downloads" on public.downloads;

-- Allow users to read their own download history
drop policy if exists "Users can read their own downloads" on public.downloads;
create policy "Users can read their own downloads"
  on public.downloads for select
  to authenticated
  using (auth.uid() = user_id);

-- Allow service role (owner dashboard) to read all downloads
drop policy if exists "Service role can read all downloads" on public.downloads;
create policy "Service role can read all downloads"
  on public.downloads for select
  to service_role
  using (true);

-- Index for fast lookups by user
create policy "Owners can read verified downloads"
  on public.downloads for select to authenticated
  using (exists (select 1 from public.site_admins where lower(email) = lower(auth.jwt()->>'email')));
create index if not exists downloads_user_id_idx on public.downloads(user_id);
-- Index for fast lookups by product
create index if not exists downloads_product_idx on public.downloads(product);
-- Index for sorting by date
create index if not exists downloads_downloaded_at_idx on public.downloads(downloaded_at desc);
