-- Allow post-booking modifications and charges for guest bookings without registered accounts
ALTER TABLE IF EXISTS public.booking_modifications ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE IF EXISTS public.charges ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE IF EXISTS public.disputes ALTER COLUMN user_id DROP NOT NULL;
