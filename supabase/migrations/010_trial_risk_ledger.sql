-- Owner-only risk signals for trial-circumvention review. Signals are evidence for review, not automatic proof.
create table if not exists public.trial_risk_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  signal_type text not null,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  product_slug text,
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  related_user_ids jsonb not null default '[]'::jsonb,
  related_emails jsonb not null default '[]'::jsonb,
  visitor_token text,
  device_hash text,
  ip_hash text,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','reviewed','dismissed','confirmed')),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);
alter table public.trial_risk_events enable row level security;
revoke all on table public.trial_risk_events from public, anon, authenticated;
grant all on table public.trial_risk_events to service_role;
create index if not exists idx_trial_risk_created on public.trial_risk_events(created_at desc);
create index if not exists idx_trial_risk_user on public.trial_risk_events(user_id,created_at desc) where user_id is not null;
create index if not exists idx_trial_risk_device_product on public.trial_risk_events(device_hash,product_slug,created_at desc) where device_hash is not null;
