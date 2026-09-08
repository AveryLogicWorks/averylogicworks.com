alter table public.trial_keys
  add column if not exists claim_visitor_token text,
  add column if not exists claim_ip_hash text,
  add column if not exists claim_user_agent text;

create index if not exists idx_trial_keys_claim_visitor_product
  on public.trial_keys(claim_visitor_token, product_slug)
  where claim_visitor_token is not null;
create index if not exists idx_trial_keys_claim_ip_product
  on public.trial_keys(claim_ip_hash, product_slug)
  where claim_ip_hash is not null;

create table if not exists public.trial_reset_history (
  reset_id uuid not null,
  reset_at timestamptz not null default now(),
  trial_id uuid not null,
  user_id uuid,
  user_email text,
  product_slug text,
  claimed_at timestamptz,
  expires_at timestamptz,
  device_hash text,
  first_activated_at timestamptz,
  last_validated_at timestamptz,
  claim_visitor_token text,
  claim_ip_hash text,
  reason text not null default 'owner requested global trial reset'
);
alter table public.trial_reset_history enable row level security;
revoke all on table public.trial_reset_history from public, anon, authenticated;
grant all on table public.trial_reset_history to service_role;
create index if not exists idx_trial_reset_history_trial on public.trial_reset_history(trial_id, reset_at desc);
create index if not exists idx_trial_reset_history_user on public.trial_reset_history(user_id, reset_at desc) where user_id is not null;
