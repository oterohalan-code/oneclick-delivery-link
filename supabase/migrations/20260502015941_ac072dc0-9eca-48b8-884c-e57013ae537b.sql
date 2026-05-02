-- Add public tracking token to orders
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS tracking_token text UNIQUE;

-- Backfill existing orders with a token (12 char base32-ish from gen_random_uuid)
UPDATE public.orders
SET tracking_token = lower(replace(replace(replace(encode(gen_random_bytes(8), 'base64'), '/', ''), '+', ''), '=', ''))
WHERE tracking_token IS NULL;

-- Trigger to auto-generate tracking_token on insert
CREATE OR REPLACE FUNCTION public.set_tracking_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tracking_token IS NULL THEN
    NEW.tracking_token := lower(replace(replace(replace(encode(gen_random_bytes(8), 'base64'), '/', ''), '+', ''), '=', ''));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_set_tracking_token ON public.orders;
CREATE TRIGGER trg_orders_set_tracking_token
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_tracking_token();

CREATE INDEX IF NOT EXISTS idx_orders_tracking_token ON public.orders(tracking_token);

-- Public, security-definer function returning only safe fields by token.
-- Includes the courier's current lat/lng from couriers table for live tracking.
CREATE OR REPLACE FUNCTION public.get_public_tracking(_token text)
RETURNS TABLE (
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
  delivered_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.status,
    o.pickup_address,
    o.dropoff_address,
    o.pickup_lat,
    o.pickup_lng,
    o.dropoff_lat,
    o.dropoff_lng,
    c.lat,
    c.lng,
    r.name,
    o.created_at,
    o.accepted_at,
    o.delivered_at
  FROM public.orders o
  LEFT JOIN public.couriers c ON c.id = o.courier_id
  LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE o.tracking_token = _token
  LIMIT 1;
$$;

-- Allow anonymous access to the function only
GRANT EXECUTE ON FUNCTION public.get_public_tracking(text) TO anon, authenticated;