ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS maps_url text;
GRANT UPDATE (maps_url, lat, lng) ON TABLE public.restaurants TO authenticated;