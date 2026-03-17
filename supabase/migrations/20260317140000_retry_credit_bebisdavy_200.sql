-- Retry: ensure the +200 RWF credit exists for bebisdavy@gmail.com.
--
-- Why: Some environments may not have a reliable auth.users.email (or it may be null),
-- but profiles.email is synced via triggers in this project.
--
-- Safety: Inserts only if the reference_key does not already exist.

DO $$
DECLARE
  v_host_id UUID;
BEGIN
  -- Prefer profiles.email lookup (project maintains it)
  SELECT p.user_id
    INTO v_host_id
  FROM public.profiles p
  WHERE lower(p.email) = lower('bebisdavy@gmail.com')
  LIMIT 1;

  -- Fallback to auth.users in case profiles is missing
  IF v_host_id IS NULL THEN
    SELECT u.id
      INTO v_host_id
    FROM auth.users u
    WHERE lower(u.email) = lower('bebisdavy@gmail.com')
    LIMIT 1;
  END IF;

  IF v_host_id IS NULL THEN
    RAISE NOTICE 'Retry credit skipped: user not found for %', 'bebisdavy@gmail.com';
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
      'Additional manual host earnings credit (retry)',
      'manual_credit_bebisdavy_20260317_200',
      NULL
    )
    ON CONFLICT (reference_key) DO NOTHING;
  END IF;
END $$;
