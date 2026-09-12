-- Migration 007: Allow rider_code to be nullable during onboarding
ALTER TABLE public.riders ALTER COLUMN rider_code DROP NOT NULL;
