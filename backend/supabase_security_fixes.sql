-- ============================================================
-- Avery Logic Works™ — Supabase Security Fixes
-- Run this in Supabase SQL Editor. Handles partial runs.
-- ============================================================

-- 1. Fix mutable search_path on is_site_admin
ALTER FUNCTION public.is_site_admin() SET search_path = public, pg_temp;

-- 2. Fix overly permissive site_events INSERT policy
DROP POLICY IF EXISTS "Anyone can insert site events" ON public.site_events;
DROP POLICY IF EXISTS "Authenticated users can insert site events" ON public.site_events;

CREATE POLICY "Authenticated users can insert site events"
  ON public.site_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3. Revoke GraphQL visibility from anon on sensitive tables
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.site_admins FROM anon;
REVOKE SELECT ON public.purchase_audit_log FROM anon;
REVOKE SELECT ON public.profiles FROM authenticated;
REVOKE SELECT ON public.site_admins FROM authenticated;
REVOKE SELECT ON public.purchase_audit_log FROM authenticated;

-- 4. Revoke EXECUTE on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.get_owner_dashboard_counts() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_owner_dashboard_counts() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;

-- ============================================================
-- MANUAL STEP: Supabase Dashboard → Authentication → Password Security
-- → Enable "Leaked Password Protection"
-- ============================================================
