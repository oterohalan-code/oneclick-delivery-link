
-- ============= ENUMS =============
CREATE TYPE public.app_role AS ENUM ('restaurant', 'courier', 'admin');
CREATE TYPE public.courier_status AS ENUM ('pending_validation', 'active', 'rejected', 'suspended');
CREATE TYPE public.courier_plan AS ENUM ('pps', 'subscription');
CREATE TYPE public.order_status AS ENUM ('pending', 'assigned', 'in_transit', 'delivered', 'cancelled');
CREATE TYPE public.wallet_tx_type AS ENUM ('topup', 'order_fee', 'subscription_charge', 'refund');

-- ============= PROFILES =============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============= USER ROLES =============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- has_role security definer (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============= RESTAURANTS =============
CREATE TABLE public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  phone TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============= COURIERS =============
CREATE TABLE public.couriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  plate TEXT,
  ine_front_url TEXT,
  ine_back_url TEXT,
  license_url TEXT,
  moto_url TEXT,
  plate_url TEXT,
  backpack_url TEXT,
  status courier_status NOT NULL DEFAULT 'pending_validation',
  rejection_reason TEXT,
  plan courier_plan NOT NULL DEFAULT 'pps',
  wallet_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  subscription_active BOOLEAN NOT NULL DEFAULT false,
  subscription_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============= ORDERS =============
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  courier_id UUID REFERENCES public.couriers(id) ON DELETE SET NULL,
  status order_status NOT NULL DEFAULT 'pending',
  pickup_address TEXT NOT NULL,
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  dropoff_address TEXT NOT NULL,
  dropoff_lat DOUBLE PRECISION,
  dropoff_lng DOUBLE PRECISION,
  amount_to_collect NUMERIC(10,2) NOT NULL DEFAULT 0,
  external_order_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_restaurant ON public.orders(restaurant_id);
CREATE INDEX idx_orders_courier ON public.orders(courier_id);

-- ============= WALLET TRANSACTIONS =============
CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  type wallet_tx_type NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  balance_after NUMERIC(10,2),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wallet_tx_courier ON public.wallet_transactions(courier_id);

-- ============= SUBSCRIPTIONS =============
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL DEFAULT 249,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============= PUSH SUBSCRIPTIONS =============
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============= TRIGGER: profile + role on signup =============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone'
  );

  v_role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'restaurant');

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);

  IF v_role = 'courier' THEN
    INSERT INTO public.couriers (user_id) VALUES (NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============= updated_at trigger =============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_restaurants_updated BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_couriers_updated BEFORE UPDATE ON public.couriers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= RLS =============
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- user_roles
CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_manage" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- restaurants
CREATE POLICY "restaurants_select_own_or_active_couriers_or_admin" ON public.restaurants
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'courier')
  );
CREATE POLICY "restaurants_insert_own" ON public.restaurants
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "restaurants_update_own" ON public.restaurants
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- couriers
CREATE POLICY "couriers_select_own_or_admin_or_assigned_restaurant" ON public.couriers
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.restaurants r ON r.id = o.restaurant_id
      WHERE o.courier_id = couriers.id AND r.user_id = auth.uid()
    )
  );
CREATE POLICY "couriers_update_own_limited" ON public.couriers
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "couriers_admin_all" ON public.couriers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- orders
CREATE POLICY "orders_select_restaurant_owner" ON public.orders
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = orders.restaurant_id AND r.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.couriers c WHERE c.id = orders.courier_id AND c.user_id = auth.uid())
    OR (
      orders.status = 'pending'
      AND public.has_role(auth.uid(), 'courier')
      AND EXISTS (SELECT 1 FROM public.couriers c WHERE c.user_id = auth.uid() AND c.status = 'active')
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "orders_insert_restaurant" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.user_id = auth.uid())
  );

CREATE POLICY "orders_update_courier_or_restaurant" ON public.orders
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = orders.restaurant_id AND r.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.couriers c WHERE c.id = orders.courier_id AND c.user_id = auth.uid())
    OR (
      orders.status = 'pending'
      AND public.has_role(auth.uid(), 'courier')
      AND EXISTS (SELECT 1 FROM public.couriers c WHERE c.user_id = auth.uid() AND c.status = 'active')
    )
  );

-- wallet_transactions
CREATE POLICY "wallet_select_own_or_admin" ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.couriers c WHERE c.id = courier_id AND c.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "wallet_insert_own" ON public.wallet_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.couriers c WHERE c.id = courier_id AND c.user_id = auth.uid())
  );

-- subscriptions
CREATE POLICY "subs_select_own_or_admin" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.couriers c WHERE c.id = courier_id AND c.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "subs_insert_own" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.couriers c WHERE c.id = courier_id AND c.user_id = auth.uid())
  );

-- push_subscriptions
CREATE POLICY "push_own_all" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============= REALTIME =============
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.couriers;

-- ============= STORAGE BUCKET =============
INSERT INTO storage.buckets (id, name, public) VALUES ('courier-docs', 'courier-docs', false);

CREATE POLICY "courier_docs_own_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'courier-docs'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin')
    )
  );
CREATE POLICY "courier_docs_own_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'courier-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "courier_docs_own_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'courier-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
