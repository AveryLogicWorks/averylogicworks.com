-- Tighten enterprise Vault policies and remove unnecessary public table discovery.

-- Publicly readable tables use one SELECT policy and owner-only write policies,
-- avoiding duplicate permissive SELECT checks.
drop policy if exists "Owner manages managed pages" on public.managed_pages;
drop policy if exists "Owner inserts managed pages" on public.managed_pages;
drop policy if exists "Owner updates managed pages" on public.managed_pages;
drop policy if exists "Owner deletes managed pages" on public.managed_pages;
create policy "Owner inserts managed pages" on public.managed_pages for insert to authenticated
with check ((select public.is_site_admin()));
create policy "Owner updates managed pages" on public.managed_pages for update to authenticated
using ((select public.is_site_admin())) with check ((select public.is_site_admin()));
create policy "Owner deletes managed pages" on public.managed_pages for delete to authenticated
using ((select public.is_site_admin()));

drop policy if exists "Owner manages page content" on public.managed_page_content;
drop policy if exists "Owner inserts page content" on public.managed_page_content;
drop policy if exists "Owner updates page content" on public.managed_page_content;
drop policy if exists "Owner deletes page content" on public.managed_page_content;
create policy "Owner inserts page content" on public.managed_page_content for insert to authenticated
with check ((select public.is_site_admin()));
create policy "Owner updates page content" on public.managed_page_content for update to authenticated
using ((select public.is_site_admin())) with check ((select public.is_site_admin()));
create policy "Owner deletes page content" on public.managed_page_content for delete to authenticated
using ((select public.is_site_admin()));

drop policy if exists "Owner manages products" on public.product_catalog;
drop policy if exists "Owner inserts products" on public.product_catalog;
drop policy if exists "Owner updates products" on public.product_catalog;
drop policy if exists "Owner deletes products" on public.product_catalog;
create policy "Owner inserts products" on public.product_catalog for insert to authenticated
with check ((select public.is_site_admin()));
create policy "Owner updates products" on public.product_catalog for update to authenticated
using ((select public.is_site_admin())) with check ((select public.is_site_admin()));
create policy "Owner deletes products" on public.product_catalog for delete to authenticated
using ((select public.is_site_admin()));

drop policy if exists "Owner manages platform settings" on public.platform_settings;
drop policy if exists "Owner inserts platform settings" on public.platform_settings;
drop policy if exists "Owner updates platform settings" on public.platform_settings;
drop policy if exists "Owner deletes platform settings" on public.platform_settings;
create policy "Owner inserts platform settings" on public.platform_settings for insert to authenticated
with check ((select public.is_site_admin()));
create policy "Owner updates platform settings" on public.platform_settings for update to authenticated
using ((select public.is_site_admin())) with check ((select public.is_site_admin()));
create policy "Owner deletes platform settings" on public.platform_settings for delete to authenticated
using ((select public.is_site_admin()));

-- Customers retain access to their own trial. The owner can read all trials through
-- the same policy, so only one SELECT predicate is evaluated.
drop policy if exists "Users can read own trial key" on public.trial_keys;
drop policy if exists "Owner reads all trial keys" on public.trial_keys;
create policy "Users read own trial or owner reads all" on public.trial_keys for select to authenticated
using ((select auth.uid()) = user_id or (select public.is_site_admin()));

-- Service-role code bypasses RLS. The only client-side read is owner-only.
drop policy if exists "No direct public access to used keys" on public.used_license_keys;
drop policy if exists "Owner reads activated license hashes" on public.used_license_keys;
create policy "Owner reads activated license hashes" on public.used_license_keys for select to authenticated
using ((select public.is_site_admin()));

-- Tables that never need anonymous reads should not be discoverable through the anon role.
revoke all on public.trial_keys from anon;
revoke all on public.owner_messages from anon;
revoke all on public.enterprise_inquiries from anon;
revoke all on public.supporter_events from anon;
grant insert on public.enterprise_inquiries to anon;
grant insert on public.supporter_events to anon;

-- Release metadata is served by a narrow function instead of direct table access.
revoke all on public.app_releases from anon, authenticated;
create or replace function public.get_version_manifest()
returns json
language sql
security definer
stable
set search_path = ''
as $$
  select json_build_object(
    'latest_version', version,
    'download_url', download_url,
    'release_notes', release_notes,
    'force_update', force_update,
    'min_version', min_version
  )
  from public.app_releases
  where is_latest = true
  limit 1;
$$;
revoke execute on function public.get_version_manifest() from public;
grant execute on function public.get_version_manifest() to anon, authenticated;

comment on function public.owner_bulk_update_users(uuid[], text, text, boolean) is
  'Owner-only bulk account operation. SECURITY DEFINER is intentional and guarded by is_site_admin().';
comment on function public.owner_restore_content_revision(bigint) is
  'Owner-only content recovery. SECURITY DEFINER is intentional and guarded by is_site_admin().';
