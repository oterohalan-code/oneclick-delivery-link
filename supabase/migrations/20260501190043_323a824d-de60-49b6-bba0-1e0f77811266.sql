
-- 1. Columnas para prueba de entrega
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_proof_url TEXT,
  ADD COLUMN IF NOT EXISTS delivered_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS delivered_lng DOUBLE PRECISION;

-- 2. Bucket privado para fotos de entrega
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-proofs', 'delivery-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas del bucket
-- Path convention: <courier_id>/<order_id>.jpg

-- Repartidor sube su propia foto
CREATE POLICY "courier_upload_own_proof"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'delivery-proofs'
  AND EXISTS (
    SELECT 1 FROM public.couriers c
    WHERE c.user_id = auth.uid()
      AND c.id::text = (storage.foldername(name))[1]
  )
);

-- Repartidor ve sus propias fotos
CREATE POLICY "courier_select_own_proof"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND EXISTS (
    SELECT 1 FROM public.couriers c
    WHERE c.user_id = auth.uid()
      AND c.id::text = (storage.foldername(name))[1]
  )
);

-- Admin ve todo
CREATE POLICY "admin_select_all_proofs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- Restaurante dueño del pedido puede ver la foto del pedido entregado
CREATE POLICY "restaurant_select_own_order_proof"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE r.user_id = auth.uid()
      AND o.delivery_proof_url = name
  )
);

-- 4. Extensiones para cron + http (idempotente)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
