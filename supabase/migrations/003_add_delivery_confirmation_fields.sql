-- =============================================================================
-- Migration: Add Delivery Arrival & Handover Verification Fields
-- Run this in your Supabase dashboard: SQL Editor → New query → Run
-- =============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_pin TEXT,
  ADD COLUMN IF NOT EXISTS received_by TEXT,
  ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;

-- Index for fast lookup by delivery PIN
CREATE INDEX IF NOT EXISTS idx_orders_delivery_pin ON public.orders(delivery_pin);
