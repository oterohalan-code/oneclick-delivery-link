-- Shared checkpoints for one cash order: who sent each Maps link,
-- whether the courier recorded the cash, and an incident note.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS flow jsonb NOT NULL DEFAULT '{}'::jsonb;

DROP FUNCTION IF EXISTS public.get_available_orders(int);
CREATE OR REPLACE FUNCTION public.get_available_orders(_limit int DEFAULT 30)
RETURNS TABLE (
  id uuid,
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_address text,
  dropoff_lat double precision,
  dropoff_lng double precision,
  shipping_fee numeric,
  amount_to_collect numeric,
  external_order_id text,
  distance_km numeric,
  restaurant_id uuid,
  created_at timestamptz,
  status order_status
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.pickup_address, o.pickup_lat, o.pickup_lng,
         o.dropoff_address, o.dropoff_lat, o.dropoff_lng,
         o.shipping_fee, o.amount_to_collect, o.external_order_id,
         o.distance_km, o.restaurant_id, o.created_at, o.status
  FROM public.orders o
  WHERE o.status = 'pending'
    AND public.has_role(auth.uid(), 'courier'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.couriers c
      WHERE c.user_id = auth.uid() AND c.status = 'active'
    )
  ORDER BY o.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 100));
$$;

REVOKE ALL ON FUNCTION public.get_available_orders(int) FROM public;
GRANT EXECUTE ON FUNCTION public.get_available_orders(int) TO authenticated;

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
  restaurant_phone text,
  food_mxn numeric,
  shipping_mxn numeric,
  total_mxn numeric,
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
    r.phone,
    GREATEST(o.amount_to_collect - COALESCE(o.shipping_fee, 0), 0),
    COALESCE(o.shipping_fee, 0),
    o.amount_to_collect,
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

REVOKE ALL ON FUNCTION public.get_public_tracking(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_tracking(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_public_restaurants()
RETURNS TABLE (
  id uuid,
  name text,
  category text,
  address text,
  phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.name, r.category, r.address, r.phone
  FROM public.restaurants r
  ORDER BY r.name;
$$;

REVOKE ALL ON FUNCTION public.list_public_restaurants() FROM public;
GRANT EXECUTE ON FUNCTION public.list_public_restaurants() TO anon, authenticated;
