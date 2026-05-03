# Plan de remediación pre-lanzamiento

Voy a arreglar los 7 bloqueadores rojos detectados en la auditoría, en una sola tanda. No se añaden funciones nuevas: solo se cierra el riesgo.

## 1. RLS de `orders` (fuga de PII de clientes)
La política actual permite que **cualquier courier activo** vea TODOS los pedidos `pending` con nombre, teléfono y dirección del cliente final.

- Migración SQL: reemplazar `orders_select_restaurant_owner` para que los couriers en estado `pending` vean solo columnas operativas vía una **vista** `public.available_orders` (sin `customer_name`, `customer_phone`, `notes`, `amount_to_collect`).
- Actualizar `CourierHome.tsx` y `orders.functions.ts` para leer de la vista al listar disponibles, y solo cargar PII al **aceptar** el pedido (cuando `courier_id = auth.uid()`).

## 2. RLS de `referrals` (enumeración de códigos)
`USING (true)` permite a cualquier autenticado leer TODOS los códigos y `referred_by_user_id` de otros.

- Migración: política `SELECT` solo si `auth.uid() = user_id` o `auth.uid() = referred_by_user_id`.
- Crear función SECURITY DEFINER `public.lookup_referral_code(_code text)` que devuelva solo `{ valid: boolean }` para validar códigos en signup sin filtrar datos.
- Actualizar el componente que valida el código de referido para usar la RPC.

## 3. RLS de `order_messages` y GPS realtime
Actualmente `is_order_participant` está bien para mensajes, pero la **publicación realtime** de `couriers` (lat/lng) no filtra: cualquier suscriptor puede ver ubicación de todos los couriers.

- Migración: revisar `ALTER PUBLICATION supabase_realtime` y quitar `couriers` si está; reemplazar por una tabla `courier_locations_public` poblada por trigger solo cuando el courier tiene un pedido activo, con RLS que solo permita ver al restaurante/cliente del pedido vigente.
- Actualizar `useCourierLocationTracker.ts` para escribir también en esa tabla.
- Ajustar `MapView.tsx` para suscribirse a la nueva tabla.

## 4. `claimAdminRole` sin validar token server-side
Hoy el server function recibe el `accessToken` por input y confía en él. Si el token es de otro usuario lo promovería.

- Cambiar `admin-claim.functions.ts` para usar el middleware `requireSupabaseAuth` y leer `context.userId` + email desde el JWT verificado, **eliminando** el parámetro `accessToken` del input.
- `admin-claim.server.ts` recibirá solo `userId` y consultará el email vía `supabaseAdmin.auth.admin.getUserById`.

## 5. `markOrderPickedUp` sin verificar propiedad
- En `orders.functions.ts`, añadir middleware `requireSupabaseAuth` y verificar que `order.courier_id` corresponde al `couriers.id` cuyo `user_id = context.userId` antes de cualquier UPDATE de estado (`accepted`, `picked_up`, `delivered`).

## 6. Claves VAPID hardcodeadas
- Mover `VAPID_PRIVATE_KEY` y `VAPID_PUBLIC_KEY` a secretos: `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`.
- Pediré los 3 secretos con `add_secret` (las claves actuales se pueden reusar, solo se mueven de código a secretos).
- `push.server.ts` los lee de `process.env`. `push.functions.ts` (`getVapidPublicKey`) sigue exponiendo solo la pública.

## 7. RLS rota de `delivery-proofs` (storage)
La policy compara `delivery_proof_url` con `restaurant.name` (sin sentido).

- Migración storage: política sobre `storage.objects` bucket `delivery-proofs`:
  - INSERT: solo el courier dueño del order (`courier.user_id = auth.uid()`).
  - SELECT: el restaurante dueño del pedido, el courier que lo entregó, o admin. Match por path: convención `{order_id}/{filename}`.
- Actualizar `DeliveryProofDialog.tsx` para subir con el path nuevo.

## 8. Extras que se incluyen
- **Protección server-side de `/app/admin`**: `beforeLoad` en `app.admin.tsx` hace `getUser()` + RPC `has_role(_, 'admin')`; redirige a `/app` si falla.
- **Headers de seguridad**: añadir CSP básica + `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy` en `__root.tsx` head() y en respuestas de `/api/public/*`.
- **Páginas legales mínimas**: `src/routes/legal.terms.tsx` y `src/routes/legal.privacy.tsx` con plantilla en español para Cancún/MX. Link en footer del landing y checkbox obligatorio en signup.

## Diagrama de cambios

```text
DB migrations (1 batch)
 ├─ orders RLS + view available_orders
 ├─ referrals RLS + RPC lookup_referral_code
 ├─ courier_locations_public + trigger + RLS
 └─ storage delivery-proofs RLS

Server functions
 ├─ admin-claim.functions.ts   (middleware auth)
 ├─ orders.functions.ts        (ownership checks)
 └─ push.server.ts             (env vars)

Client
 ├─ CourierHome / MapView / DeliveryProofDialog
 ├─ auth-context (sin pasar accessToken)
 └─ app.admin.tsx beforeLoad

Nuevo
 ├─ src/routes/legal.terms.tsx
 ├─ src/routes/legal.privacy.tsx
 └─ headers de seguridad
```

## Secretos que pediré
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (puedes pegar las que ya están en el código; luego rotamos).

## Lo que NO toco
- Stripe (ya validado en live).
- Onboardings, UI principal, lógica de tarifas, AdminHome.
- Sistema de roles (ya correcto).

¿Apruebas y entro a build mode?
