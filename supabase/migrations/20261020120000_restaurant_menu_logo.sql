-- Public restaurant page: logo, hours, menu, and photos anyone can see.

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS hours text,
  ADD COLUMN IF NOT EXISTS menu jsonb NOT NULL DEFAULT '[]'::jsonb;

GRANT UPDATE (logo_url, hours, menu) ON TABLE public.restaurants TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('restaurant-media', 'restaurant-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS restaurant_media_read ON storage.objects;
CREATE POLICY restaurant_media_read ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'restaurant-media');

DROP POLICY IF EXISTS restaurant_media_insert ON storage.objects;
CREATE POLICY restaurant_media_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'restaurant-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS restaurant_media_update ON storage.objects;
CREATE POLICY restaurant_media_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'restaurant-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP FUNCTION IF EXISTS public.list_public_restaurants();
CREATE FUNCTION public.list_public_restaurants()
RETURNS TABLE (
  id uuid,
  name text,
  category text,
  address text,
  phone text,
  hours text,
  logo_url text,
  facade_url text,
  menu jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.name, r.category, r.address, r.phone, r.hours, r.logo_url, r.facade_url, r.menu
  FROM public.restaurants r
  ORDER BY r.name;
$$;

REVOKE ALL ON FUNCTION public.list_public_restaurants() FROM public;
GRANT EXECUTE ON FUNCTION public.list_public_restaurants() TO anon, authenticated;
