-- Pegar en el SQL editor de Lovable Cloud (proyecto de producción).
-- Da rol admin a otero.h.alan@icloud.com si la cuenta ya existe.

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = 'otero.h.alan@icloud.com'
ON CONFLICT (user_id, role) DO NOTHING;
