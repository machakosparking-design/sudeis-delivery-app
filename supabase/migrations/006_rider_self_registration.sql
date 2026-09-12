-- =============================================================================
-- Migration 006: Rider Self-Registration & Approval Workflow
-- Run this in your Supabase Dashboard: SQL Editor -> New query -> Run
-- Direct Link: https://supabase.com/dashboard/project/vwuecbinjmhljyuysvnc/sql/new
-- =============================================================================

-- 1. Add profile + approval status columns to riders table
ALTER TABLE public.riders
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.riders
  DROP CONSTRAINT IF EXISTS riders_approval_status_check;

ALTER TABLE public.riders
  ADD CONSTRAINT riders_approval_status_check
  CHECK (approval_status IN ('pending_approval', 'active', 'rejected'));

-- 2. Existing riders should all be 'active' (they were manually set up)
UPDATE public.riders
  SET approval_status = 'active'
  WHERE approval_status IS NULL OR approval_status = '';

-- 3. Allow new riders to INSERT their own profile row (self-registration)
DROP POLICY IF EXISTS riders_insert_policy ON public.riders;
CREATE POLICY riders_insert_policy ON public.riders
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_id = auth.uid()
    AND role = 'rider'
    AND approval_status = 'pending_approval'
  );

-- 4. Trigger: only CEO/SuperAdmin can change approval_status
CREATE OR REPLACE FUNCTION public.check_rider_approval_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.approval_status IS DISTINCT FROM NEW.approval_status) THEN
    IF NOT public.is_ceo() THEN
      RAISE EXCEPTION 'Unauthorized: Only CEO or Superadmin can approve or reject riders.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_rider_approval ON public.riders;
CREATE TRIGGER trg_protect_rider_approval
  BEFORE UPDATE ON public.riders
  FOR EACH ROW
  EXECUTE FUNCTION public.check_rider_approval_update();

-- 5. RPC: approve_rider
CREATE OR REPLACE FUNCTION public.approve_rider(p_rider_id UUID, p_rider_code TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rider public.riders%ROWTYPE;
  v_code TEXT;
BEGIN
  IF NOT public.is_ceo() THEN
    RAISE EXCEPTION 'Unauthorized: Only CEO or Superadmin can approve riders.';
  END IF;

  SELECT * INTO v_rider FROM public.riders WHERE id = p_rider_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rider not found.';
  END IF;

  v_code := COALESCE(
    NULLIF(TRIM(p_rider_code), ''),
    LOWER(REPLACE(COALESCE(v_rider.name, 'rider'), ' ', '_'))
  );

  UPDATE public.riders
    SET approval_status = 'active',
        rider_code = v_code,
        status = 'offline'
    WHERE id = p_rider_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_rider(UUID, TEXT) TO authenticated;

-- 6. RPC: reject_rider
CREATE OR REPLACE FUNCTION public.reject_rider(p_rider_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_ceo() THEN
    RAISE EXCEPTION 'Unauthorized: Only CEO or Superadmin can reject riders.';
  END IF;

  UPDATE public.riders
    SET approval_status = 'rejected'
    WHERE id = p_rider_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_rider(UUID) TO authenticated;

-- 7. Index for fast pending approval queries
CREATE INDEX IF NOT EXISTS idx_riders_approval_status ON public.riders(approval_status);
