-- 1. Parche gen_random_bytes (usar extensions schema)
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public, extensions
AS $function$
DECLARE
  v_code text;
  v_exists boolean;
BEGIN
  LOOP
    v_code := upper(substring(replace(replace(replace(encode(extensions.gen_random_bytes(6),'base64'),'/',''),'+',''),'=','') from 1 for 6));
    SELECT EXISTS(SELECT 1 FROM public.referrals WHERE code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_tracking_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $function$
BEGIN
  IF NEW.tracking_token IS NULL THEN
    NEW.tracking_token := lower(replace(replace(replace(encode(extensions.gen_random_bytes(8), 'base64'), '/', ''), '+', ''), '=', ''));
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Actualizar handle_new_user para soportar admin_pending (no asigna rol hasta confirmar)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role_text text;
  v_role app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone'
  );

  v_role_text := NEW.raw_user_meta_data->>'role';

  -- admin_pending: NO se asigna rol hasta que claim_admin_role lo apruebe server-side
  IF v_role_text = 'admin_pending' THEN
    RETURN NEW;
  END IF;

  v_role := COALESCE(v_role_text::app_role, 'restaurant');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);

  IF v_role = 'courier' THEN
    INSERT INTO public.couriers (user_id) VALUES (NEW.id);
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Hardening: revocar de PUBLIC y anon, otorgar a authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.restaurant_owns_order_for_courier(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_order_participant(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_courier_stats(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.find_zone_for_point(double precision, double precision) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_owns_order_for_courier(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_order_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_courier_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_zone_for_point(double precision, double precision) TO authenticated;

-- get_public_tracking debe seguir accesible vía anon (es el endpoint público de tracking por token)
-- por lo que no se revoca

-- 4. Bootstrap admin: asignar admin a la cuenta del owner
INSERT INTO public.user_roles (user_id, role)
VALUES ('0ea9c103-95b6-4f58-9a0a-916cd99775af', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;