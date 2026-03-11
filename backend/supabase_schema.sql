-- Avery Logic Works: starter schema for a simple website account layer

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  newsletter_opt_in boolean not null default true,
  supporter_updates_opt_in boolean not null default false,
  account_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supporter_events (
  id bigserial primary key,
  email text not null,
  event_type text not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  amount_cents integer,
  currency text,
  notes text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_profile_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.handle_profile_timestamp();

alter table public.profiles enable row level security;
alter table public.supporter_events enable row level security;

create policy "Users can read own profile"
on public.profiles for select
using (auth.uid() = user_id);

create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = user_id);

create policy "Users can insert own profile"
on public.profiles for insert
with check (auth.uid() = user_id);
