CREATE OR REPLACE FUNCTION public.calculate_shipping_fee(
  _distance_km numeric,
  _requested_at timestamptz DEFAULT now()
)
RETURNS TABLE(base_fee numeric, surge_multiplier numeric, total_fee numeric, surge_reason text)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_base numeric := 0;
  v_extra integer;
  v_mult numeric := 1.0;
  v_reason text := 'normal';
  v_hour integer;
  v_dow integer;
  v_local timestamptz;
BEGIN
  IF _distance_km IS NULL OR _distance_km <= 0 THEN
    RETURN QUERY SELECT 0::numeric, 1.0::numeric, 0::numeric, 'normal'::text;
    RETURN;
  END IF;

  -- Tarifa base por kilómetros
  IF _distance_km <= 3 THEN v_base := 40;
  ELSIF _distance_km <= 5 THEN v_base := 50;
  ELSIF _distance_km <= 7 THEN v_base := 60;
  ELSIF _distance_km <= 9 THEN v_base := 70;
  ELSIF _distance_km <= 10.9 THEN v_base := 80;
  ELSE
    v_extra := CEIL(_distance_km - 11)::integer;
    v_base := 80 + 10 + (v_extra * 10);
  END IF;

  -- Multiplicador por hora (zona horaria CDMX)
  v_local := _requested_at AT TIME ZONE 'America/Mexico_City';
  v_hour := EXTRACT(HOUR FROM v_local)::integer;
  v_dow := EXTRACT(DOW FROM v_local)::integer; -- 0=dom, 6=sab

  IF (v_hour >= 13 AND v_hour < 15) OR (v_hour >= 19 AND v_hour < 22) THEN
    v_mult := 1.20; v_reason := 'hora_pico';
  ELSIF v_hour < 6 THEN
    v_mult := 1.15; v_reason := 'madrugada';
  ELSIF v_dow = 0 OR v_dow = 6 THEN
    v_mult := 1.10; v_reason := 'fin_de_semana';
  END IF;

  RETURN QUERY SELECT
    ROUND(v_base, 2),
    v_mult,
    ROUND(v_base * v_mult, 2),
    v_reason;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_shipping_fee(numeric, timestamptz) TO authenticated, anon;