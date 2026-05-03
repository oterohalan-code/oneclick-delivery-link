
-- ============ 1. Available orders RPC (no PII) ============
CREATE OR REPLACE FUNCTION public.get_available_orders(_limit int DEFAULT 30)
RETURNS TABLE (
  id uuid,
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_address text,
  dropoff_lat double precision,
  dropoff_lng double precision,
  shipping_fee numeric,
  distance_km numeric,
  restaurant_id uuid,
  created_at timestamptz,
  status order_status
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.pickup_address, o.pickup_lat, o.pickup_lng,
         o.dropoff_address, o.dropoff_lat, o.dropoff_lng,
         o.shipping_fee, o.distance_km, o.restaurant_id, o.created_at, o.status
  FROM public.orders o
  WHERE o.status = 'pending'
    AND public.has_role(auth.uid(), 'courier'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.couriers c
      WHERE c.user_id = auth.uid() AND c.status = 'active'
    )
  ORDER BY o.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 100));
$$;

REVOKE ALL ON FUNCTION public.get_available_orders(int) FROM public;
GRANT EXECUTE ON FUNCTION public.get_available_orders(int) TO authenticated;

-- Tighten orders SELECT: couriers no longer can SELECT pending orders directly.
DROP POLICY IF EXISTS orders_select_restaurant_owner ON public.orders;
CREATE POLICY orders_select_restaurant_owner
ON public.orders FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = orders.restaurant_id AND r.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.couriers c WHERE c.id = orders.courier_id AND c.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- UPDATE: courier can claim a pending order ONLY by setting courier_id to their own courier id.
DROP POLICY IF EXISTS orders_update_courier_or_restaurant ON public.orders;
CREATE POLICY orders_update_courier_or_restaurant
ON public.orders FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = orders.restaurant_id AND r.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.couriers c WHERE c.id = orders.courier_id AND c.user_id = auth.uid())
  OR (
    status = 'pending'
    AND public.has_role(auth.uid(), 'courier'::app_role)
    AND EXISTS (SELECT 1 FROM public.couriers c WHERE c.user_id = auth.uid() AND c.status = 'active')
  )
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = orders.restaurant_id AND r.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.couriers c WHERE c.id = orders.courier_id AND c.user_id = auth.uid())
);

-- ============ 2. Referrals: lock down SELECT, add safe lookup ============
DROP POLICY IF EXISTS referrals_select_own_or_lookup ON public.referrals;
CREATE POLICY referrals_select_own
ON public.referrals FOR SELECT TO authenticated
USING (auth.uid() = user_id OR auth.uid() = referred_by_user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.validate_referral_code(_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.referrals WHERE code = upper(trim(_code)));
$$;

REVOKE ALL ON FUNCTION public.validate_referral_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.validate_referral_code(text) TO authenticated, anon;

-- ============ 3. Realtime: stop broadcasting couriers GPS ============
ALTER PUBLICATION supabase_realtime DROP TABLE public.couriers;

-- ============ 4. Storage: delivery-proofs proper RLS ============
-- Path convention: {order_id}/{filename}
DROP POLICY IF EXISTS "Users can view their own delivery proofs" ON storage.objects;
DROP POLICY IF EXISTS "Couriers can upload delivery proofs" ON storage.objects;
DROP POLICY IF EXISTS "delivery_proofs_select" ON storage.objects;
DROP POLICY IF EXISTS "delivery_proofs_insert" ON storage.objects;

CREATE POLICY "delivery_proofs_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'delivery-proofs'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.couriers c ON c.id = o.courier_id
    WHERE c.user_id = auth.uid()
      AND o.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "delivery_proofs_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.orders o
      LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
      LEFT JOIN public.couriers c ON c.id = o.courier_id
      WHERE o.id::text = (storage.foldername(name))[1]
        AND (r.user_id = auth.uid() OR c.user_id = auth.uid())
    )
  )
);

-- ============ 5. Admin audit log ============
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_audit_log_admin_only
ON public.admin_audit_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
