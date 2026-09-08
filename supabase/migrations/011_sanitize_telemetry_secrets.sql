create or replace function public.sanitize_telemetry_metadata()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  clean jsonb;
  v text;
begin
  clean := coalesce(new.metadata, '{}'::jsonb)
    - 'key' - 'license_key' - 'raw_key' - 'access_token' - 'refresh_token' - 'id_token' - 'authorization' - 'password';
  if clean ? 'href' then
    v := regexp_replace(coalesce(clean->>'href',''), '#.*$', '');
    clean := jsonb_set(clean, '{href}', to_jsonb(v), true);
  end if;
  if clean ? 'url' then
    v := regexp_replace(coalesce(clean->>'url',''), '#.*$', '');
    clean := jsonb_set(clean, '{url}', to_jsonb(v), true);
  end if;
  if clean ? 'referrer' then
    v := regexp_replace(coalesce(clean->>'referrer',''), '#.*$', '');
    clean := jsonb_set(clean, '{referrer}', to_jsonb(v), true);
  end if;
  new.metadata := clean;
  return new;
end;
$$;

drop trigger if exists sanitize_site_event_metadata on public.site_events;
create trigger sanitize_site_event_metadata before insert or update of metadata on public.site_events
for each row execute function public.sanitize_telemetry_metadata();

drop trigger if exists sanitize_security_event_metadata on public.security_events;
create trigger sanitize_security_event_metadata before insert or update of metadata on public.security_events
for each row execute function public.sanitize_telemetry_metadata();

revoke all on function public.sanitize_telemetry_metadata() from public, anon, authenticated;
