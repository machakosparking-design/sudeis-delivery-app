-- =============================================================================
-- Migration 004: Add Super Administrator Role
-- Run this in your Supabase Dashboard: SQL Editor → New query → Run
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Expand the role CHECK constraint to allow 'superadmin'
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.riders
  DROP CONSTRAINT IF EXISTS riders_role_check;

ALTER TABLE public.riders
  ADD CONSTRAINT riders_role_check CHECK (role IN ('ceo', 'rider', 'superadmin'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Create is_superadmin() helper (SECURITY DEFINER bypasses RLS)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.riders
    WHERE auth_user_id = auth.uid() AND role = 'superadmin'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Update is_ceo() so superadmin also passes CEO-level checks
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_ceo()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.riders
    WHERE auth_user_id = auth.uid() AND role IN ('ceo', 'superadmin')
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Re-create RLS update policy (now implicitly supports superadmin via is_ceo())
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS riders_update_policy ON public.riders;
CREATE POLICY riders_update_policy ON public.riders
  FOR UPDATE TO authenticated
  USING (
    auth_user_id = auth.uid() OR public.is_ceo()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. MANUAL STEP: Promote your developer account to superadmin
-- ─────────────────────────────────────────────────────────────────────────────
-- Get your auth UUID from: Supabase Dashboard → Authentication → Users
-- Then run:
--
--   UPDATE public.riders
--     SET role = 'superadmin'
--     WHERE auth_user_id = '<YOUR-AUTH-UUID>';
--
-- If you don't have a rider row yet, create one:
--
--   INSERT INTO public.riders (name, rider_code, phone, status, role, auth_user_id)
--   VALUES ('Developer', 'superadmin', '254700000000', 'online', 'superadmin', '<YOUR-AUTH-UUID>');
