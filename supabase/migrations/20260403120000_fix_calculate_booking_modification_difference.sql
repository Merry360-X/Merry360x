-- Fix ambiguous column reference in calculate_booking_modification_difference
CREATE OR REPLACE FUNCTION public.calculate_booking_modification_difference(
  p_booking_id UUID,
  p_new_check_in DATE,
  p_new_check_out DATE,
  p_new_property_id UUID DEFAULT NULL
)
RETURNS TABLE (
  old_price NUMERIC,
  new_price NUMERIC,
  difference NUMERIC,
  currency TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings;
  v_old_nights INT;
  v_new_nights INT;
  v_price_per_night NUMERIC(12,2);
  v_curr TEXT;
  v_old_price NUMERIC(12,2);
  v_new_price NUMERIC(12,2);
BEGIN
  SELECT * INTO v_booking
  FROM public.bookings b
  WHERE b.id = p_booking_id;

  IF v_booking.id IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  v_old_price := COALESCE(v_booking.total_price, 0);
  v_old_nights := GREATEST((v_booking.check_out - v_booking.check_in), 1);
  v_new_nights := GREATEST((COALESCE(p_new_check_out, v_booking.check_out) - COALESCE(p_new_check_in, v_booking.check_in)), 1);

  IF p_new_property_id IS NOT NULL THEN
    SELECT COALESCE(p.price_per_night, 0), COALESCE(p.currency, v_booking.currency, 'USD')
      INTO v_price_per_night, v_curr
    FROM public.properties p
    WHERE p.id = p_new_property_id;
  ELSIF v_booking.property_id IS NOT NULL THEN
    SELECT COALESCE(p.price_per_night, 0), COALESCE(p.currency, v_booking.currency, 'USD')
      INTO v_price_per_night, v_curr
    FROM public.properties p
    WHERE p.id = v_booking.property_id;
  ELSE
    v_price_per_night := NULL;
    v_curr := COALESCE(v_booking.currency, 'USD');
  END IF;

  IF v_price_per_night IS NOT NULL AND v_price_per_night > 0 THEN
    v_new_price := v_price_per_night * v_new_nights;
  ELSE
    -- Fallback for tours/transport and legacy rows.
    v_new_price := CASE
      WHEN v_old_nights > 0 THEN (v_old_price / v_old_nights) * v_new_nights
      ELSE v_old_price
    END;
  END IF;

  RETURN QUERY
  SELECT
    ROUND(v_old_price, 2),
    ROUND(v_new_price, 2),
    ROUND(v_new_price - v_old_price, 2),
    COALESCE(v_curr, 'USD');
END;
$$;
