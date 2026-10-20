DROP FUNCTION IF EXISTS public.get_available_orders(int);
CREATE FUNCTION public.get_available_orders(_limit int DEFAULT 30)
RETURNS TABLE (id uuid, pickup_address text, pickup_lat double precision, pickup_lng double precision, dropoff_address text, dropoff_lat double precision, dropoff_lng double precision, shipping_fee numeric, amount_to_collect numeric, external_order_id text, distance_km numeric, restaurant_id uuid, created_at timestamptz, status order_status, payment_mode text, food_amount_cents bigint, shipping_amount_cents bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.pickup_address, o.pickup_lat, o.pickup_lng, o.dropoff_address, o.dropoff_lat, o.dropoff_lng, o.shipping_fee, o.amount_to_collect, o.external_order_id, o.distance_km, o.restaurant_id, o.created_at, o.status, o.payment_mode::text, o.food_amount_cents::bigint, o.shipping_amount_cents::bigint
  FROM public.orders o
  WHERE o.status = 'pending' AND public.has_role(auth.uid(), 'courier'::app_role)
    AND EXISTS (SELECT 1 FROM public.couriers c WHERE c.user_id = auth.uid() AND c.status = 'active')
  ORDER BY o.created_at DESC LIMIT GREATEST(1, LEAST(_limit, 100));
$$;
REVOKE ALL ON FUNCTION public.get_available_orders(int) FROM public;
GRANT EXECUTE ON FUNCTION public.get_available_orders(int) TO authenticated;