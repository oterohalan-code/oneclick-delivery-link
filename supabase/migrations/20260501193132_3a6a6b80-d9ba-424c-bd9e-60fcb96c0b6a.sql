-- Add facade photo column to restaurants
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS facade_url text;

-- Create private storage bucket for restaurant photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('restaurant-photos', 'restaurant-photos', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for restaurant-photos bucket (path convention: {user_id}/...)
CREATE POLICY "restaurant_photos_owner_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'restaurant-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "restaurant_photos_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'restaurant-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "restaurant_photos_owner_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'restaurant-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "restaurant_photos_admin_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'restaurant-photos'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "restaurant_photos_active_courier_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'restaurant-photos'
  AND public.has_role(auth.uid(), 'courier'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.couriers c
    WHERE c.user_id = auth.uid() AND c.status = 'active'::courier_status
  )
);