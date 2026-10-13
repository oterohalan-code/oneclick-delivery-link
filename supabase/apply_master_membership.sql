-- Pegar en el SQL editor de Lovable Cloud (producción).
-- Membresía de dueño para otero.h.alan@icloud.com (restaurante y repartidor).
-- No cobra Mercado Pago. Sirve para pedir/aceptar pedidos ya.

INSERT INTO public.memberships (
  user_id, role, status, amount_cents, currency,
  current_period_start, current_period_end, auto_renew, provider
)
SELECT
  u.id,
  r.role,
  'active',
  CASE WHEN r.role = 'restaurant' THEN 45000 ELSE 30000 END,
  'MXN',
  now(),
  now() + interval '1 year',
  false,
  'mercadopago'
FROM auth.users u
CROSS JOIN (
  VALUES
    ('restaurant'::public.app_role),
    ('courier'::public.app_role)
) AS r(role)
WHERE lower(u.email) = 'otero.h.alan@icloud.com'
ON CONFLICT (user_id, role) DO UPDATE SET
  status = 'active',
  current_period_start = excluded.current_period_start,
  current_period_end = excluded.current_period_end,
  auto_renew = false,
  updated_at = now();
