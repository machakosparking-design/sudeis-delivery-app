-- =============================================================================
-- Migration: Atomic Order Claiming (Race Condition Fix)
-- Run this in your Supabase dashboard: SQL Editor → New query → Run
-- =============================================================================
-- This function atomically picks and assigns the next available pending order
-- to a rider using FOR UPDATE SKIP LOCKED. This prevents two riders from
-- accepting the same order at the same time.

CREATE OR REPLACE FUNCTION public.claim_next_order(p_rider_id UUID)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order public.orders;
BEGIN
  -- Lock the oldest pending, unassigned order atomically.
  -- SKIP LOCKED: if another transaction already locked this row,
  -- we skip it rather than waiting — preventing race conditions.
  SELECT o.* INTO v_order
  FROM public.orders o
  WHERE o.status = 'pending'
    AND o.assigned_rider_id IS NULL
  ORDER BY o.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_order.id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.orders
  SET
    status = 'accepted',
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
