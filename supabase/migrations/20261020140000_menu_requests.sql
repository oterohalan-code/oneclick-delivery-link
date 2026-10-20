-- Customer menu picks land here. The restaurant turns one into a delivery.

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

ALTER TABLE public.menu_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS menu_requests_restaurant_select ON public.menu_requests;
CREATE POLICY menu_requests_restaurant_select ON public.menu_requests
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = menu_requests.restaurant_id AND r.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS menu_requests_restaurant_update ON public.menu_requests;
CREATE POLICY menu_requests_restaurant_update ON public.menu_requests
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = menu_requests.restaurant_id AND r.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = menu_requests.restaurant_id AND r.user_id = auth.uid()
  ));

GRANT SELECT, UPDATE ON public.menu_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.place_menu_request(
  _restaurant_id uuid,
  _customer_name text,
  _customer_phone text,
  _dropoff_address text,
  _items jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  computed numeric;
BEGIN
  IF _customer_name IS NULL OR length(trim(_customer_name)) < 2 THEN
    RAISE EXCEPTION 'Nombre requerido';
  END IF;
  IF _customer_phone !~ '^[0-9]{10}$' THEN
    RAISE EXCEPTION 'Teléfono de 10 dígitos';
  END IF;
  IF _dropoff_address IS NULL OR length(trim(_dropoff_address)) < 5 THEN
    RAISE EXCEPTION 'Dirección requerida';
  END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) < 1 OR jsonb_array_length(_items) > 30 THEN
    RAISE EXCEPTION 'Elige al menos un platillo';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = _restaurant_id) THEN
    RAISE EXCEPTION 'Restaurante no encontrado';
  END IF;
  SELECT coalesce(sum((item->>'price')::numeric * greatest((item->>'qty')::numeric, 1)), 0)
    INTO computed
  FROM jsonb_array_elements(_items) item;
  INSERT INTO public.menu_requests (restaurant_id, customer_name, customer_phone, dropoff_address, items, food_total)
  VALUES (_restaurant_id, trim(_customer_name), _customer_phone, trim(_dropoff_address), _items, computed)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.place_menu_request(uuid, text, text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.place_menu_request(uuid, text, text, text, jsonb) TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'menu_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_requests;
  END IF;
END $$;
