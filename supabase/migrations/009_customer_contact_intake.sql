-- Mirrors the private customer-contact intake currently applied in production.
create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  contact_type text not null check (contact_type in ('support','bug','feedback')),
  status text not null default 'new' check (status in ('new','reviewing','replied','resolved','closed')),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  name text,
  subject text not null default '',
  message text not null,
  product text,
  category text,
  severity text,
  rating smallint check (rating is null or (rating between 1 and 5)),
  visitor_token text,
  ip_hash text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customer_contacts enable row level security;
revoke all on table public.customer_contacts from public, anon, authenticated;
grant all on table public.customer_contacts to service_role;
create index if not exists idx_customer_contacts_type_status_created on public.customer_contacts(contact_type,status,created_at desc);
create index if not exists idx_customer_contacts_email_created on public.customer_contacts(lower(email),created_at desc) where email is not null;
create index if not exists idx_customer_contacts_user_created on public.customer_contacts(user_id,created_at desc) where user_id is not null;
