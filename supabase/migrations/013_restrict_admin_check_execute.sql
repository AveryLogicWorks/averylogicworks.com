-- Anonymous/public callers do not need direct execute access to the owner authorization helper.
revoke execute on function public.is_site_admin() from public, anon;
grant execute on function public.is_site_admin() to authenticated, service_role;
