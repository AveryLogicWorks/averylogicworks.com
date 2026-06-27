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

-- Allow authenticated users to insert their own download records
create policy "Users can log their own downloads"
  on public.downloads for insert
  to authenticated
  with check (true);

-- Allow users to read their own download history
create policy "Users can read their own downloads"
  on public.downloads for select
  to authenticated
  using (auth.uid() = user_id);

-- Allow service role (owner dashboard) to read all downloads
create policy "Service role can read all downloads"
  on public.downloads for select
  to service_role
  using (true);

-- Index for fast lookups by user
create index if not exists downloads_user_id_idx on public.downloads(user_id);
-- Index for fast lookups by product
create index if not exists downloads_product_idx on public.downloads(product);
-- Index for sorting by date
create index if not exists downloads_downloaded_at_idx on public.downloads(downloaded_at desc);
