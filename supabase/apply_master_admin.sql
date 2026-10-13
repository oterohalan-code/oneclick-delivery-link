-- Pegar en el SQL editor de Lovable Cloud (producción).
-- No usa el correo de Lovable: confirma la cuenta, pone la clave y da admin.
-- Cambia EligeTuClaveAqui por la contraseña que vas a usar (mínimo 8 caracteres).

UPDATE auth.users
SET
  encrypted_password = extensions.crypt('EligeTuClaveAqui', extensions.gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  confirmation_token = '',
  recovery_token = '',
  updated_at = now()
WHERE lower(email) = 'otero.h.alan@icloud.com';

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = 'otero.h.alan@icloud.com'
ON CONFLICT (user_id, role) DO NOTHING;
