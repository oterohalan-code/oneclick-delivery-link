-- Fase 7.1: Zonas operativas (multi-ciudad)

CREATE TABLE IF NOT EXISTS public.operational_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text NOT NULL,
  country_code text NOT NULL DEFAULT 'MX',
  -- Bounding box simple (lat/lng min/max). Suficiente para MVP multi-ciudad.
  bbox_min_lat double precision NOT NULL,
  bbox_max_lat double precision NOT NULL,
  bbox_min_lng double precision NOT NULL,
  bbox_max_lng double precision NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Mexico_City',
  -- Ajustes opcionales por zona
  base_fee_multiplier numeric NOT NULL DEFAULT 1.0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operational_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zones_select_all_authenticated"
  ON public.operational_zones FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "zones_admin_all"
  ON public.operational_zones FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_zones_updated_at BEFORE UPDATE ON public.operational_zones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Asociaciones opcionales — un courier o restaurante puede tener zona preferida
ALTER TABLE public.couriers ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES public.operational_zones(id);
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES public.operational_zones(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES public.operational_zones(id);

CREATE INDEX IF NOT EXISTS idx_orders_zone ON public.orders(zone_id);
CREATE INDEX IF NOT EXISTS idx_couriers_zone ON public.couriers(zone_id);

-- Helper: encuentra una zona por lat/lng
CREATE OR REPLACE FUNCTION public.find_zone_for_point(_lat double precision, _lng double precision)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.operational_zones
  WHERE active = true
    AND _lat BETWEEN bbox_min_lat AND bbox_max_lat
    AND _lng BETWEEN bbox_min_lng AND bbox_max_lng
  ORDER BY ((bbox_max_lat - bbox_min_lat) * (bbox_max_lng - bbox_min_lng)) ASC
  LIMIT 1;
$$;

-- Seed: CDMX como zona inicial
INSERT INTO public.operational_zones (name, city, country_code, bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng, timezone)
VALUES ('CDMX Centro', 'Ciudad de México', 'MX', 19.18, 19.59, -99.36, -98.94, 'America/Mexico_City')
ON CONFLICT DO NOTHING;

-- Tabla para idempotencia y auditoría de pedidos creados vía POS externo
CREATE TABLE IF NOT EXISTS public.pos_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  api_key_hash text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT 'POS',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

ALTER TABLE public.pos_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_integrations_owner"
  ON public.pos_integrations FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.user_id = auth.uid()));

CREATE POLICY "pos_integrations_admin"
  ON public.pos_integrations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Idempotencia: evita pedidos duplicados desde POS
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pos_integration_id uuid REFERENCES public.pos_integrations(id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_pos_external
  ON public.orders(pos_integration_id, external_order_id)
  WHERE pos_integration_id IS NOT NULL AND external_order_id IS NOT NULL;