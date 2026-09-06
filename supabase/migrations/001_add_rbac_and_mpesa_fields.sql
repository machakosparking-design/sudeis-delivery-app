-- =============================================================================
-- Migration: Add Role-Based Auth + M-Pesa Reconciliation Fields
-- Run this in your Supabase dashboard: SQL Editor → New query → Run
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add auth_user_id and role columns to the riders table
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.riders
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'rider' CHECK (role IN ('ceo', 'rider'));

-- Create an index for fast lookup by auth_user_id
CREATE INDEX IF NOT EXISTS idx_riders_auth_user_id ON public.riders(auth_user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Add M-Pesa reconciliation fields to the orders table
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS mpesa_checkout_id TEXT,
  ADD COLUMN IF NOT EXISTS mpesa_receipt TEXT;

-- Index for fast callback lookup
CREATE INDEX IF NOT EXISTS idx_orders_mpesa_checkout_id ON public.orders(mpesa_checkout_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. MANUAL STEP: Link existing riders to their Supabase Auth accounts
-- ─────────────────────────────────────────────────────────────────────────────
-- After running the migration above, you must manually set auth_user_id for
-- each rider and the CEO. Get the UUID from:
--   Supabase Dashboard → Authentication → Users → copy the user's ID
--
-- Example (replace UUIDs and rider codes with your real values):
--
--   UPDATE public.riders
--     SET auth_user_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
--         role = 'ceo'
--     WHERE rider_code = 'ceo';
--
--   UPDATE public.riders
--     SET auth_user_id = 'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy',
--         role = 'rider'
--     WHERE rider_code = 'rider_1';
--
--   UPDATE public.riders
--     SET auth_user_id = 'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz',
--         role = 'rider'
--     WHERE rider_code = 'rider_2';
--
--   UPDATE public.riders
--     SET auth_user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
--         role = 'rider'
--     WHERE rider_code = 'rider_3';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Row Level Security — restrict riders from reading other riders' rows
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;

-- Drop policies first so this script is safe to re-run
DROP POLICY IF EXISTS riders_select_policy ON public.riders;
DROP POLICY IF EXISTS riders_update_policy ON public.riders;

CREATE POLICY riders_select_policy ON public.riders
  FOR SELECT USING (
    auth_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.riders r
      WHERE r.auth_user_id = auth.uid() AND r.role = 'ceo'
    )
  );

CREATE POLICY riders_update_policy ON public.riders
  FOR UPDATE USING (
    auth_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.riders r
      WHERE r.auth_user_id = auth.uid() AND r.role = 'ceo'
    )
  );

