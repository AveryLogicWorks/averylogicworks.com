alter table public.trial_keys
  add column if not exists product_slug text,
  add column if not exists device_hash text,
  add column if not exists first_activated_at timestamptz,
  add column if not exists last_validated_at timestamptz;

update public.trial_keys
set product_slug = 'command-nexus'
where product_slug is null;

alter table public.trial_keys
  alter column product_slug set not null;

create unique index if not exists trial_keys_user_product_unique
  on public.trial_keys(user_id, product_slug);

alter table public.trial_keys
  drop constraint if exists trial_keys_product_slug_fkey;

alter table public.trial_keys
  add constraint trial_keys_product_slug_fkey
  foreign key (product_slug) references public.product_catalog(slug)
  on update cascade on delete restrict;
