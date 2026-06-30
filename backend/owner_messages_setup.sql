-- ============================================================
-- Avery Logic Works™ — Owner Messages System
-- Creates owner_messages table for vault → user messaging
-- Run this in Supabase SQL Editor.
-- ============================================================

create table if not exists public.owner_messages (
  id bigserial primary key,
  sender_email text not null,
  recipient_email text,
  audience text not null default 'individual',
  subject text not null default '',
  body text not null default '',
  reply text,
  replied_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_owner_messages_recipient on public.owner_messages (recipient_email);
create index if not exists idx_owner_messages_audience on public.owner_messages (audience);
create index if not exists idx_owner_messages_created on public.owner_messages (created_at desc);

alter table public.owner_messages enable row level security;

-- Owner can do everything
drop policy if exists "Owner can manage owner_messages" on public.owner_messages;
create policy "Owner can manage owner_messages"
on public.owner_messages for all
to authenticated
using (public.is_site_admin())
with check (public.is_site_admin());

-- Users can read messages addressed to them individually
drop policy if exists "Users can read their own messages" on public.owner_messages;
create policy "Users can read their own messages"
on public.owner_messages for select
to authenticated
using (
  recipient_email = lower(coalesce(auth.jwt() ->> 'email', ''))
  or (audience in ('newsletter', 'all_users') and recipient_email is null)
);

-- Users can update their own messages (mark read, reply)
drop policy if exists "Users can update their own messages" on public.owner_messages;
create policy "Users can update their own messages"
on public.owner_messages for update
to authenticated
using (recipient_email = lower(coalesce(auth.jwt() ->> 'email', '')))
with check (recipient_email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Grants
grant select, insert, update on public.owner_messages to authenticated;
grant usage, select on public.owner_messages_id_seq to authenticated;
