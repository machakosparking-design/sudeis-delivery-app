-- =============================================================================
-- Migration: Add Secure Public Receipt Lookup Function
-- Run this in your Supabase dashboard: SQL Editor → New query → Run
-- =============================================================================
-- This function allows walk-in and errand customers to view their official delivery
-- receipt using their order_number (e.g. ORD-172570...) without requiring a login,
-- while keeping sensitive internal fleet GPS and credentials completely private.

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
    o.order_number,
    o.customer_name,
    o.customer_phone,
    o.pickup_address,
    o.dropoff_address,
    o.fee,
    o.status,
    o.mpesa_receipt,
    o.created_at,
    o.updated_at,
    COALESCE(r.name, 'Falcon Courier Rider') AS rider_name
  FROM public.orders o
  LEFT JOIN public.riders r ON o.assigned_rider_id = r.id
  WHERE LOWER(COALESCE(o.order_number, '')) = LOWER(p_order_number)
     OR o.id::text = p_order_number
     OR LOWER(COALESCE(o.mpesa_receipt, '')) = LOWER(p_order_number)
  LIMIT 1;
END;
$$;

-- Allow anonymous (unauthenticated) customers and logged-in users to call this function
GRANT EXECUTE ON FUNCTION public.get_public_receipt(TEXT) TO anon, authenticated;
