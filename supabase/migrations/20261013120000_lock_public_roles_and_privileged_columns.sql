-- F1: public signup can only create restaurant or courier.
-- Admin is granted only by the privileged claim path (service role).
-- Owners cannot write operational or financial columns on their own rows.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role_text text;
  v_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone'
  );

  v_role_text := lower(coalesce(NEW.raw_user_meta_data->>'role', ''));

  -- Privileged signup marker. No role until claim_admin_role runs server-side.
  IF v_role_text = 'admin_pending' THEN
    RETURN NEW;
  END IF;

  IF v_role_text = 'courier' THEN
    v_role := 'courier';
  ELSE
    -- restaurant, admin, unknown, or omitted → never admin from metadata
    v_role := 'restaurant';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);

  IF v_role = 'courier' THEN
    INSERT INTO public.couriers (user_id, status) VALUES (NEW.id, 'incomplete');
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_courier_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  NEW.id := OLD.id;
  NEW.user_id := OLD.user_id;
  NEW.created_at := OLD.created_at;
  NEW.status := OLD.status;
  NEW.rejection_reason := OLD.rejection_reason;
  NEW.plan := OLD.plan;
  NEW.wallet_balance := OLD.wallet_balance;
  NEW.subscription_active := OLD.subscription_active;
  NEW.subscription_expires_at := OLD.subscription_expires_at;
  NEW.stats_avg_minutes := OLD.stats_avg_minutes;
  NEW.stats_cancelled := OLD.stats_cancelled;
  NEW.stats_on_time_deliveries := OLD.stats_on_time_deliveries;
  NEW.stats_score := OLD.stats_score;
  NEW.stats_total_deliveries := OLD.stats_total_deliveries;
  NEW.ai_validation := OLD.ai_validation;
  NEW.zone_id := OLD.zone_id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_courier_privileged_columns ON public.couriers;
CREATE TRIGGER trg_protect_courier_privileged_columns
BEFORE UPDATE ON public.couriers
FOR EACH ROW
EXECUTE FUNCTION public.protect_courier_privileged_columns();

CREATE OR REPLACE FUNCTION public.protect_restaurant_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  NEW.id := OLD.id;
  NEW.user_id := OLD.user_id;
  NEW.created_at := OLD.created_at;
  NEW.zone_id := OLD.zone_id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_restaurant_privileged_columns ON public.restaurants;
CREATE TRIGGER trg_protect_restaurant_privileged_columns
BEFORE UPDATE ON public.restaurants
FOR EACH ROW
EXECUTE FUNCTION public.protect_restaurant_privileged_columns();

REVOKE UPDATE ON TABLE public.couriers FROM anon;
REVOKE UPDATE ON TABLE public.couriers FROM authenticated;
GRANT UPDATE (
  address,
  lat,
  lng,
  plate,
  ine_front_url,
  ine_back_url,
  license_url,
  moto_url,
  plate_url,
  backpack_url,
  circulation_url,
  has_backpack,
  willing_to_get_backpack,
  location_updated_at,
  updated_at
) ON TABLE public.couriers TO authenticated;

REVOKE UPDATE ON TABLE public.restaurants FROM anon;
REVOKE UPDATE ON TABLE public.restaurants FROM authenticated;
GRANT UPDATE (
  name,
  address,
  lat,
  lng,
  phone,
  category,
  facade_url,
  updated_at
) ON TABLE public.restaurants TO authenticated;
