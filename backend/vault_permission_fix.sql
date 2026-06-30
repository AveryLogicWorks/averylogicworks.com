-- ============================================================
-- Avery Logic Works™ — Vault Permission Fix
-- Fixes "permission denied for table site_admins" error
-- Run this in Supabase SQL Editor.
-- ============================================================

-- 1. Re-grant SELECT on site_admins to authenticated
--    RLS still protects the table — this just allows the RLS policy
--    to be evaluated. Without this grant, PostgreSQL blocks access
--    before RLS even runs.
GRANT SELECT ON public.site_admins TO authenticated;

-- 2. Re-grant SELECT on profiles to authenticated
--    Same issue — RLS policy exists but base grant was revoked.
GRANT SELECT ON public.profiles TO authenticated;

-- 2b. Ensure SELECT on site_events and supporter_events for authenticated
--    RLS policies protect these (admin-only reads), but the base GRANT
--    must exist for RLS to be evaluated.
GRANT SELECT ON public.site_events TO authenticated;
GRANT SELECT ON public.supporter_events TO authenticated;

-- 3. Re-grant SELECT on purchase_audit_log to authenticated (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_audit_log' AND table_schema = 'public') THEN
    GRANT SELECT ON public.purchase_audit_log TO authenticated;
  END IF;
END $$;

-- 4. Re-grant EXECUTE on get_owner_dashboard_counts to authenticated
--    This was revoked in security fixes but is needed for the vault
--    to load core metrics via the RPC fallback.
GRANT EXECUTE ON FUNCTION public.get_owner_dashboard_counts() TO authenticated;

-- 5. Verify the RLS policies are still in place (they should be)
--    These should already exist from owner_dashboard_setup.sql:
--    - "Admins can read site_admins" → using (public.is_site_admin())
--    - "Admins can read site events" → using (public.is_site_admin())
--    - "Users can read own profile" → using (auth.uid() = user_id or public.is_site_admin())

-- 6. Make sure is_site_admin() is SECURITY DEFINER so it can read
--    site_admins even when the calling user doesn't have direct SELECT.
--    (It already should be, but let's be explicit.)
CREATE OR REPLACE FUNCTION public.is_site_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.site_admins
    WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- 7. Make sure the owner email is in site_admins
--    The vault page checks client-side via ownerEmails in site-config.js,
--    but the server-side check (is_site_admin) uses this table.
INSERT INTO public.site_admins (email)
VALUES ('adminaverylogicworks@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- 8. Also grant EXECUTE to service_role (in case it was revoked)
GRANT EXECUTE ON FUNCTION public.get_owner_dashboard_counts() TO service_role;

-- 8. Verify: check what policies exist on site_admins
SELECT polname, polcmd, polqual, polwithcheck
FROM pg_policy
WHERE polrelid = 'public.site_admins'::regclass;
