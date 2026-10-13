-- Owner account: otero.h.alan@icloud.com is always admin.
-- Public signup still cannot self-assign admin via metadata.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role_text text;
  v_role public.app_role;
  v_email text;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone'
  );

  v_email := lower(coalesce(NEW.email, ''));
  IF v_email = 'otero.h.alan@icloud.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN NEW;
  END IF;

  v_role_text := lower(coalesce(NEW.raw_user_meta_data->>'role', ''));

  IF v_role_text = 'admin_pending' THEN
    RETURN NEW;
  END IF;

  IF v_role_text = 'courier' THEN
    v_role := 'courier';
  ELSE
    v_role := 'restaurant';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);

  IF v_role = 'courier' THEN
    INSERT INTO public.couriers (user_id, status) VALUES (NEW.id, 'incomplete');
  END IF;

  RETURN NEW;
END;
$function$;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = 'otero.h.alan@icloud.com'
ON CONFLICT (user_id, role) DO NOTHING;
