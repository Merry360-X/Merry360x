-- Host earnings adjustments
--
-- Purpose:
-- - Provide a safe/auditable way to credit/debit host earnings without creating fake bookings.
-- - Used by Host Dashboard financial totals.

CREATE TABLE IF NOT EXISTS public.host_earnings_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'RWF',
  reason TEXT NULL,
  reference_key TEXT UNIQUE,
  created_by UUID NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_host_earnings_adjustments_host_id ON public.host_earnings_adjustments(host_id);
CREATE INDEX IF NOT EXISTS idx_host_earnings_adjustments_created_at ON public.host_earnings_adjustments(created_at DESC);

ALTER TABLE public.host_earnings_adjustments ENABLE ROW LEVEL SECURITY;

-- Hosts can view their own adjustments
DROP POLICY IF EXISTS "Hosts can view own earnings adjustments" ON public.host_earnings_adjustments;
CREATE POLICY "Hosts can view own earnings adjustments"
  ON public.host_earnings_adjustments
  FOR SELECT
  USING (auth.uid() = host_id);

-- Admin policies
DROP POLICY IF EXISTS "Admins can view all earnings adjustments" ON public.host_earnings_adjustments;
CREATE POLICY "Admins can view all earnings adjustments"
  ON public.host_earnings_adjustments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE public.user_roles.user_id = auth.uid()
        AND public.user_roles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can manage earnings adjustments" ON public.host_earnings_adjustments;
CREATE POLICY "Admins can manage earnings adjustments"
  ON public.host_earnings_adjustments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE public.user_roles.user_id = auth.uid()
        AND public.user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE public.user_roles.user_id = auth.uid()
        AND public.user_roles.role = 'admin'
    )
  );

-- One-time manual credit: +300 RWF for bebisdavy@gmail.com
DO $$
DECLARE
  v_host_id UUID;
BEGIN
  SELECT u.id
    INTO v_host_id
  FROM auth.users u
  WHERE lower(u.email) = lower('bebisdavy@gmail.com')
  LIMIT 1;

  IF v_host_id IS NULL THEN
    RAISE NOTICE 'host_earnings_adjustments credit skipped: user not found for %', 'bebisdavy@gmail.com';
  ELSE
    INSERT INTO public.host_earnings_adjustments (
      host_id,
      amount,
      currency,
      reason,
      reference_key,
      created_by
    )
    VALUES (
      v_host_id,
      300,
      'RWF',
      'Manual host earnings credit',
      'manual_credit_bebisdavy_20260317_300',
      NULL
    )
    ON CONFLICT (reference_key) DO NOTHING;
  END IF;
END $$;
