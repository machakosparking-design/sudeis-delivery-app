-- =============================================================================
-- Migration 005: Security Hardening - Orders RLS, Anti-Escalation & Claim Verification
-- Run this in your Supabase Dashboard: SQL Editor → New query → Run
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Enable Row Level Security on the orders table
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Drop existing orders policies if any
DROP POLICY IF EXISTS orders_ceo_superadmin_policy ON public.orders;
DROP POLICY IF EXISTS orders_rider_select_policy ON public.orders;
DROP POLICY IF EXISTS orders_rider_update_policy ON public.orders;

-- Policy A: CEO & Superadmin have full management access (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY orders_ceo_superadmin_policy ON public.orders
  FOR ALL TO authenticated
  USING (public.is_ceo())
  WITH CHECK (public.is_ceo());

-- Policy B: Riders can SELECT only orders assigned to them, or unassigned pending/paid offers
CREATE POLICY orders_rider_select_policy ON public.orders
  FOR SELECT TO authenticated
  USING (
    assigned_rider_id IN (
      SELECT id FROM public.riders WHERE auth_user_id = auth.uid()
    )
    OR (
      assigned_rider_id IS NULL AND status IN ('pending', 'paid')
    )
  );

-- Policy C: Riders can UPDATE orders assigned to them, or claim an unassigned pending/paid order
CREATE POLICY orders_rider_update_policy ON public.orders
  FOR UPDATE TO authenticated
  USING (
    assigned_rider_id IN (
      SELECT id FROM public.riders WHERE auth_user_id = auth.uid()
    )
    OR (
      assigned_rider_id IS NULL AND status IN ('pending', 'paid')
    )
  )
  WITH CHECK (
    assigned_rider_id IN (
      SELECT id FROM public.riders WHERE auth_user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Prevent Privilege Escalation on the riders table
-- ─────────────────────────────────────────────────────────────────────────────
-- Re-create riders_update_policy with WITH CHECK to disallow role changes
DROP POLICY IF EXISTS riders_update_policy ON public.riders;
CREATE POLICY riders_update_policy ON public.riders
  FOR UPDATE TO authenticated
  USING (
    auth_user_id = auth.uid() OR public.is_ceo()
  )
  WITH CHECK (
    public.is_ceo()
    OR (
      auth_user_id = auth.uid()
      AND role = 'rider'
    )
  );

-- PostgreSQL trigger for defense-in-depth: Rejects role or auth_user_id tampering
CREATE OR REPLACE FUNCTION public.check_rider_role_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.role IS DISTINCT FROM NEW.role OR OLD.auth_user_id IS DISTINCT FROM NEW.auth_user_id) THEN
    IF NOT public.is_ceo() THEN
      RAISE EXCEPTION 'Unauthorized: Only CEO or Superadmin can modify user roles or linked accounts.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_rider_role ON public.riders;
CREATE TRIGGER trg_protect_rider_role
  BEFORE UPDATE ON public.riders
  FOR EACH ROW
  EXECUTE FUNCTION public.check_rider_role_update();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Harden claim_next_order RPC against rider impersonation
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_next_order(p_rider_id UUID)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders;
BEGIN
  -- Ensure caller owns this rider account unless caller is CEO/Superadmin
  IF NOT public.is_ceo() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.riders
      WHERE id = p_rider_id AND auth_user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Unauthorized: You can only claim orders for your own rider account.';
    END IF;
  END IF;

  -- Lock the oldest pending/paid unassigned order atomically
  SELECT o.* INTO v_order
  FROM public.orders o
  WHERE (o.status = 'pending' OR o.status = 'paid')
    AND o.assigned_rider_id IS NULL
  ORDER BY o.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_order.id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.orders
  SET
    status = CASE WHEN v_order.status = 'paid' THEN 'paid' ELSE 'accepted' END,
    assigned_rider_id = p_rider_id
  WHERE id = v_order.id;

  UPDATE public.riders
  SET status = 'busy'
  WHERE id = p_rider_id;

  SELECT o.* INTO v_order FROM public.orders o WHERE o.id = v_order.id;

  RETURN NEXT v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_next_order(UUID) TO authenticated;
