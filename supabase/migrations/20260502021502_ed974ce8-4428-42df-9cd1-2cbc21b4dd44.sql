
-- 1) Columnas nuevas en couriers para scoring + GPS
ALTER TABLE public.couriers
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS stats_total_deliveries integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stats_on_time_deliveries integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stats_cancelled integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stats_avg_minutes numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stats_score numeric NOT NULL DEFAULT 100;

-- 2) Columnas nuevas en orders para ETA + batching + pickup time
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS eta_minutes integer,
  ADD COLUMN IF NOT EXISTS picked_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS batch_id uuid;

CREATE INDEX IF NOT EXISTS idx_orders_batch_id ON public.orders(batch_id);
CREATE INDEX IF NOT EXISTS idx_orders_courier_status ON public.orders(courier_id, status);

-- 3) Reemplazar get_public_tracking para incluir ETA + timestamp de GPS
DROP FUNCTION IF EXISTS public.get_public_tracking(text);
CREATE OR REPLACE FUNCTION public.get_public_tracking(_token text)
RETURNS TABLE(
  status order_status,
  pickup_address text,
  dropoff_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_lat double precision,
  dropoff_lng double precision,
  courier_lat double precision,
  courier_lng double precision,
  restaurant_name text,
  created_at timestamptz,
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  eta_minutes integer,
  location_updated_at timestamptz,
  courier_name text,
  courier_score numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    o.status,
    o.pickup_address,
    o.dropoff_address,
    o.pickup_lat, o.pickup_lng,
    o.dropoff_lat, o.dropoff_lng,
    c.lat, c.lng,
    r.name,
    o.created_at, o.accepted_at, o.picked_up_at, o.delivered_at,
    o.eta_minutes,
    c.location_updated_at,
    p.full_name,
    c.stats_score
  FROM public.orders o
  LEFT JOIN public.couriers c    ON c.id = o.courier_id
  LEFT JOIN public.profiles p    ON p.id = c.user_id
  LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE o.tracking_token = _token
  LIMIT 1;
$$;

-- 4) Función para que un restaurante consulte stats públicas de un courier
CREATE OR REPLACE FUNCTION public.get_courier_stats(_courier_id uuid)
RETURNS TABLE(
  full_name text,
  score numeric,
  total_deliveries integer,
  on_time_deliveries integer,
  avg_minutes numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    p.full_name,
    c.stats_score,
    c.stats_total_deliveries,
    c.stats_on_time_deliveries,
    c.stats_avg_minutes
  FROM public.couriers c
  LEFT JOIN public.profiles p ON p.id = c.user_id
  WHERE c.id = _courier_id
    AND (
      -- el restaurante tiene una orden con este courier, O es admin, O es el mismo courier
      public.restaurant_owns_order_for_courier(_courier_id, auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR c.user_id = auth.uid()
    )
  LIMIT 1;
$$;

-- 5) Trigger que recalcula stats al marcar entregado
CREATE OR REPLACE FUNCTION public.recalc_courier_stats()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total int;
  v_on_time int;
  v_cancelled int;
  v_avg numeric;
  v_score numeric;
BEGIN
  IF NEW.courier_id IS NULL THEN RETURN NEW; END IF;

  -- Solo recalcular cuando cambia a delivered o cancelled
  IF (TG_OP = 'UPDATE' AND OLD.status = NEW.status) THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('delivered','cancelled') THEN RETURN NEW; END IF;

  SELECT
    COUNT(*) FILTER (WHERE status = 'delivered'),
    COUNT(*) FILTER (WHERE status = 'delivered' AND eta_minutes IS NOT NULL
                     AND delivered_at IS NOT NULL AND accepted_at IS NOT NULL
                     AND EXTRACT(EPOCH FROM (delivered_at - accepted_at))/60 <= eta_minutes + 5),
    COUNT(*) FILTER (WHERE status = 'cancelled'),
    COALESCE(AVG(EXTRACT(EPOCH FROM (delivered_at - accepted_at))/60)
             FILTER (WHERE status = 'delivered' AND delivered_at IS NOT NULL AND accepted_at IS NOT NULL), 0)
  INTO v_total, v_on_time, v_cancelled, v_avg
  FROM public.orders
  WHERE courier_id = NEW.courier_id;

  -- Score: 100 base, -2 por cancelación, +bonus por on-time ratio
  v_score := GREATEST(0, LEAST(100,
    100
    - (v_cancelled * 2)
    + (CASE WHEN v_total > 0 THEN (v_on_time::numeric / v_total) * 0 ELSE 0 END)
  ));
  IF v_total > 0 THEN
    v_score := GREATEST(0, LEAST(100,
      (v_on_time::numeric / v_total) * 100 - (v_cancelled * 2)
    ));
  END IF;

  UPDATE public.couriers
  SET stats_total_deliveries = v_total,
      stats_on_time_deliveries = v_on_time,
      stats_cancelled = v_cancelled,
      stats_avg_minutes = ROUND(v_avg::numeric, 1),
      stats_score = ROUND(v_score::numeric, 1),
      updated_at = now()
  WHERE id = NEW.courier_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_courier_stats ON public.orders;
CREATE TRIGGER trg_recalc_courier_stats
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.recalc_courier_stats();

-- 6) Permitir al courier setear eta_minutes/picked_up_at/location_updated_at vía RLS existente (ya cubierto por orders_update_courier_or_restaurant y couriers_update_own_limited)
