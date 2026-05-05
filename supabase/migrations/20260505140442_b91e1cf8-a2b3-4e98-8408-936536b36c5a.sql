ALTER TABLE public.couriers ALTER COLUMN status SET DEFAULT 'incomplete'::courier_status;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

  IF v_role_text = 'admin_pending' THEN
    RETURN NEW;
  END IF;

  v_role := COALESCE(v_role_text::app_role, 'restaurant');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);

  IF v_role = 'courier' THEN
    INSERT INTO public.couriers (user_id, status) VALUES (NEW.id, 'incomplete');
  END IF;

  RETURN NEW;
END;
$function$;