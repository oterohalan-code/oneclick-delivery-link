-- Master owner can hold restaurant + courier roles and skip paid membership.

CREATE OR REPLACE FUNCTION public.has_active_membership(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
  SELECT
    EXISTS (
      SELECT 1
      FROM auth.users u
      WHERE u.id = _user_id
        AND lower(coalesce(u.email, '')) = 'otero.h.alan@icloud.com'
    )
    OR EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.user_id = _user_id
        AND m.role = _role
        AND m.status = 'active'
        AND m.current_period_end > now()
    )
    OR (
      _role = 'courier'
      AND EXISTS (
        SELECT 1
        FROM public.couriers c
        WHERE c.user_id = _user_id
          AND c.subscription_active = true
          AND c.subscription_expires_at > now()
      )
    );
$function$;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, r.role
FROM auth.users u
CROSS JOIN (
  VALUES
    ('admin'::public.app_role),
    ('restaurant'::public.app_role),
    ('courier'::public.app_role)
) AS r(role)
WHERE lower(u.email) = 'otero.h.alan@icloud.com'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.couriers (user_id, status, subscription_active, subscription_expires_at)
SELECT id, 'incomplete', true, '2099-12-31T00:00:00Z'::timestamptz
FROM auth.users
WHERE lower(email) = 'otero.h.alan@icloud.com'
ON CONFLICT (user_id) DO NOTHING;
