-- =============================================================================
-- Migration 005: Complete Security Hardening & Idempotent Schema Setup
-- Run this in your Supabase Dashboard: SQL Editor → New query → Run
-- Direct Link for your project:
-- https://supabase.com/dashboard/project/vwuecbinjmhljyuysvnc/sql/new
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Ensure riders and orders tables exist (Creates if missing)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_code TEXT UNIQUE,
  name TEXT,
  status TEXT DEFAULT 'offline',
  orders_completed INTEGER DEFAULT 0,
  earnings NUMERIC DEFAULT 0,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'rider',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  pickup_address TEXT,
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  dropoff_address TEXT,
  dropoff_lat DOUBLE PRECISION,
  dropoff_lng DOUBLE PRECISION,
  fee NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  assigned_rider_id UUID REFERENCES public.riders(id) ON DELETE SET NULL,
  mpesa_receipt TEXT,
  mpesa_checkout_id TEXT,
  delivery_pin TEXT,
  received_by TEXT,
  arrived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all required columns exist even if tables were previously created partially
ALTER TABLE public.riders
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'rider';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number TEXT,
  ADD COLUMN IF NOT EXISTS mpesa_checkout_id TEXT,
  ADD COLUMN IF NOT EXISTS mpesa_receipt TEXT,
  ADD COLUMN IF NOT EXISTS delivery_pin TEXT,
  ADD COLUMN IF NOT EXISTS received_by TEXT,
  ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;

-- Constraints and Indexes
ALTER TABLE public.riders DROP CONSTRAINT IF EXISTS riders_role_check;
ALTER TABLE public.riders ADD CONSTRAINT riders_role_check CHECK (role IN ('ceo', 'rider', 'superadmin'));

CREATE INDEX IF NOT EXISTS idx_riders_auth_user_id ON public.riders(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_mpesa_checkout_id ON public.orders(mpesa_checkout_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_pin ON public.orders(delivery_pin);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Role Check Helper Functions (SECURITY DEFINER)
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
-- 3. Row Level Security on riders Table (Anti-Privilege Escalation)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS riders_select_policy ON public.riders;
CREATE POLICY riders_select_policy ON public.riders
  FOR SELECT TO authenticated
  USING (true);

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

-- PostgreSQL trigger to strictly disallow non-CEO users from escalating role or changing auth_user_id
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
-- 4. Row Level Security on orders Table
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Revoke direct table access from anonymous users (Forces receipt access through get_public_receipt RPC)
REVOKE ALL ON public.orders FROM anon;
GRANT ALL ON public.orders TO authenticated;

DROP POLICY IF EXISTS orders_ceo_superadmin_policy ON public.orders;
DROP POLICY IF EXISTS orders_rider_select_policy ON public.orders;
DROP POLICY IF EXISTS orders_rider_update_policy ON public.orders;

-- CEO & SuperAdmin have complete access
CREATE POLICY orders_ceo_superadmin_policy ON public.orders
  FOR ALL TO authenticated
  USING (public.is_ceo())
  WITH CHECK (public.is_ceo());

-- Riders can only read their assigned orders, or unassigned pending/paid orders
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

-- Riders can only update their assigned orders, or claim an unassigned pending/paid order
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
-- 5. Atomic Order Claim RPC with Ownership Check
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
  -- Verify caller owns this rider account unless caller is CEO/Superadmin
  IF NOT public.is_ceo() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.riders
      WHERE id = p_rider_id AND auth_user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Unauthorized: You can only claim orders for your own rider account.';
    END IF;
  END IF;

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

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Secure Public Receipt Lookup (Exposes only sanitized customer receipt data)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_public_receipt(p_order_number TEXT)
RETURNS TABLE (
  order_number TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  pickup_address TEXT,
  dropoff_address TEXT,
  fee NUMERIC,
  status TEXT,
  mpesa_receipt TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  rider_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.order_number::text,
    o.customer_name::text,
    o.customer_phone::text,
    o.pickup_address::text,
    o.dropoff_address::text,
    o.fee::numeric,
    o.status::text,
    o.mpesa_receipt::text,
    o.created_at,
    o.updated_at,
    COALESCE(r.name, 'Falcon Courier Rider')::text AS rider_name
  FROM public.orders o
  LEFT JOIN public.riders r ON o.assigned_rider_id = r.id
  WHERE LOWER(COALESCE(o.order_number::text, '')) = LOWER(p_order_number)
     OR o.id::text = p_order_number
     OR LOWER(COALESCE(o.mpesa_receipt::text, '')) = LOWER(p_order_number)
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_receipt(TEXT) TO anon, authenticated;
