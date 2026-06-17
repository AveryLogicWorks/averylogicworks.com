-- ============================================================
-- Part 2: Fix remaining SECURITY DEFINER function exposure
-- The REVOKEs failed because PostgreSQL defaults grant to PUBLIC
-- ============================================================

-- Strip ALL access from public, anon, and authenticated on these functions
REVOKE ALL ON FUNCTION public.get_owner_dashboard_counts() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM public, anon, authenticated;

-- Grant only to postgres (owner) and service_role
GRANT EXECUTE ON FUNCTION public.get_owner_dashboard_counts() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user_profile() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO postgres, service_role;
