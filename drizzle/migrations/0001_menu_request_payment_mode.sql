ALTER TABLE public.menu_requests ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'collect_on_delivery' CHECK (payment_mode IN ('collect_on_delivery','prepaid_at_restaurant'));

DROP FUNCTION IF EXISTS public.place_menu_request(uuid, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.place_menu_request(
  _restaurant_id uuid, _customer_name text, _customer_phone text, _dropoff_address text, _items jsonb,
  _payment_mode text DEFAULT 'collect_on_delivery'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid; computed numeric;
BEGIN
  IF _customer_name IS NULL OR length(trim(_customer_name)) < 2 THEN RAISE EXCEPTION 'Nombre requerido'; END IF;
  IF _customer_phone !~ '^[0-9]{10}$' THEN RAISE EXCEPTION 'Teléfono de 10 dígitos'; END IF;
  IF _dropoff_address IS NULL OR length(trim(_dropoff_address)) < 5 THEN RAISE EXCEPTION 'Dirección requerida'; END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) < 1 OR jsonb_array_length(_items) > 30 THEN RAISE EXCEPTION 'Elige al menos un platillo'; END IF;
  IF _payment_mode NOT IN ('collect_on_delivery','prepaid_at_restaurant') THEN RAISE EXCEPTION 'Forma de pago inválida'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = _restaurant_id) THEN RAISE EXCEPTION 'Restaurante no encontrado'; END IF;
  SELECT coalesce(sum((item->>'price')::numeric * greatest((item->>'qty')::numeric, 1)), 0) INTO computed FROM jsonb_array_elements(_items) item;
  INSERT INTO public.menu_requests (restaurant_id, customer_name, customer_phone, dropoff_address, items, food_total, payment_mode)
  VALUES (_restaurant_id, trim(_customer_name), _customer_phone, trim(_dropoff_address), _items, computed, _payment_mode)
  RETURNING id INTO new_id;
  RETURN new_id;
END; $$;

REVOKE ALL ON FUNCTION public.place_menu_request(uuid, text, text, text, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.place_menu_request(uuid, text, text, text, jsonb, text) TO anon, authenticated;