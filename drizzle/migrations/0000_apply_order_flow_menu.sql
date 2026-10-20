ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS flow jsonb NOT NULL DEFAULT '{}'::jsonb;

DROP FUNCTION IF EXISTS public.get_available_orders(int);
CREATE OR REPLACE FUNCTION public.get_available_orders(_limit int DEFAULT 30)
RETURNS TABLE (id uuid, pickup_address text, pickup_lat double precision, pickup_lng double precision, dropoff_address text, dropoff_lat double precision, dropoff_lng double precision, shipping_fee numeric, amount_to_collect numeric, external_order_id text, distance_km numeric, restaurant_id uuid, created_at timestamptz, status order_status)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.pickup_address, o.pickup_lat, o.pickup_lng, o.dropoff_address, o.dropoff_lat, o.dropoff_lng, o.shipping_fee, o.amount_to_collect, o.external_order_id, o.distance_km, o.restaurant_id, o.created_at, o.status
  FROM public.orders o
  WHERE o.status = 'pending' AND public.has_role(auth.uid(), 'courier'::app_role)
    AND EXISTS (SELECT 1 FROM public.couriers c WHERE c.user_id = auth.uid() AND c.status = 'active')
  ORDER BY o.created_at DESC LIMIT GREATEST(1, LEAST(_limit, 100));
$$;
REVOKE ALL ON FUNCTION public.get_available_orders(int) FROM public;
GRANT EXECUTE ON FUNCTION public.get_available_orders(int) TO authenticated;

DROP FUNCTION IF EXISTS public.get_public_tracking(text);
CREATE OR REPLACE FUNCTION public.get_public_tracking(_token text)
RETURNS TABLE(status order_status, pickup_address text, dropoff_address text, pickup_lat double precision, pickup_lng double precision, dropoff_lat double precision, dropoff_lng double precision, courier_lat double precision, courier_lng double precision, restaurant_name text, restaurant_phone text, food_mxn numeric, shipping_mxn numeric, total_mxn numeric, created_at timestamptz, accepted_at timestamptz, picked_up_at timestamptz, delivered_at timestamptz, eta_minutes integer, location_updated_at timestamptz, courier_name text, courier_score numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.status, o.pickup_address, o.dropoff_address, o.pickup_lat, o.pickup_lng, o.dropoff_lat, o.dropoff_lng, c.lat, c.lng, r.name, r.phone,
    GREATEST(o.amount_to_collect - COALESCE(o.shipping_fee, 0), 0), COALESCE(o.shipping_fee, 0), o.amount_to_collect,
    o.created_at, o.accepted_at, o.picked_up_at, o.delivered_at, o.eta_minutes, c.location_updated_at, p.full_name, c.stats_score
  FROM public.orders o
  LEFT JOIN public.couriers c ON c.id = o.courier_id
  LEFT JOIN public.profiles p ON p.id = c.user_id
  LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE o.tracking_token = _token LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_public_tracking(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_tracking(text) TO anon, authenticated;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS hours text,
  ADD COLUMN IF NOT EXISTS facade_url text,
  ADD COLUMN IF NOT EXISTS menu jsonb NOT NULL DEFAULT '[]'::jsonb;
GRANT UPDATE (logo_url, hours, menu) ON TABLE public.restaurants TO authenticated;

DROP POLICY IF EXISTS restaurant_media_read ON storage.objects;
CREATE POLICY restaurant_media_read ON storage.objects FOR SELECT TO public USING (bucket_id = 'restaurant-media');
DROP POLICY IF EXISTS restaurant_media_insert ON storage.objects;
CREATE POLICY restaurant_media_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'restaurant-media' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS restaurant_media_update ON storage.objects;
CREATE POLICY restaurant_media_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'restaurant-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP FUNCTION IF EXISTS public.list_public_restaurants();
CREATE FUNCTION public.list_public_restaurants()
RETURNS TABLE (id uuid, name text, category text, address text, phone text, hours text, logo_url text, facade_url text, menu jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.name, r.category, r.address, r.phone, r.hours, r.logo_url, r.facade_url, r.menu FROM public.restaurants r ORDER BY r.name;
$$;
REVOKE ALL ON FUNCTION public.list_public_restaurants() FROM public;
GRANT EXECUTE ON FUNCTION public.list_public_restaurants() TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.menu_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  dropoff_address text NOT NULL,
  items jsonb NOT NULL,
  food_total numeric NOT NULL,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.menu_requests TO authenticated;
GRANT ALL ON public.menu_requests TO service_role;
ALTER TABLE public.menu_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS menu_requests_restaurant_select ON public.menu_requests;
CREATE POLICY menu_requests_restaurant_select ON public.menu_requests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = menu_requests.restaurant_id AND r.user_id = auth.uid()));
DROP POLICY IF EXISTS menu_requests_restaurant_update ON public.menu_requests;
CREATE POLICY menu_requests_restaurant_update ON public.menu_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = menu_requests.restaurant_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = menu_requests.restaurant_id AND r.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.place_menu_request(_restaurant_id uuid, _customer_name text, _customer_phone text, _dropoff_address text, _items jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid; computed numeric;
BEGIN
  IF _customer_name IS NULL OR length(trim(_customer_name)) < 2 THEN RAISE EXCEPTION 'Nombre requerido'; END IF;
  IF _customer_phone !~ '^[0-9]{10}$' THEN RAISE EXCEPTION 'Teléfono de 10 dígitos'; END IF;
  IF _dropoff_address IS NULL OR length(trim(_dropoff_address)) < 5 THEN RAISE EXCEPTION 'Dirección requerida'; END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) < 1 OR jsonb_array_length(_items) > 30 THEN RAISE EXCEPTION 'Elige al menos un platillo'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = _restaurant_id) THEN RAISE EXCEPTION 'Restaurante no encontrado'; END IF;
  SELECT coalesce(sum((item->>'price')::numeric * greatest((item->>'qty')::numeric, 1)), 0) INTO computed FROM jsonb_array_elements(_items) item;
  INSERT INTO public.menu_requests (restaurant_id, customer_name, customer_phone, dropoff_address, items, food_total)
  VALUES (_restaurant_id, trim(_customer_name), _customer_phone, trim(_dropoff_address), _items, computed) RETURNING id INTO new_id;
  RETURN new_id;
END; $$;
REVOKE ALL ON FUNCTION public.place_menu_request(uuid, text, text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.place_menu_request(uuid, text, text, text, jsonb) TO anon, authenticated;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='menu_requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_requests;
  END IF;
END $$;