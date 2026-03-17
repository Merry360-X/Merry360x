-- Additional one-time manual credit: +200 RWF for bebisdavy@gmail.com
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
    RAISE NOTICE 'Additional host_earnings_adjustments credit skipped: user not found for %', 'bebisdavy@gmail.com';
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
      200,
      'RWF',
      'Additional manual host earnings credit',
      'manual_credit_bebisdavy_20260317_200',
      NULL
    )
    ON CONFLICT (reference_key) DO NOTHING;
  END IF;
END $$;
