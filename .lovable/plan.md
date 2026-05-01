## Estado actual vs. spec

Ya está hecho:
- Roles, auth, onboarding repartidor con validación IA, auto-activación.
- Wallet con planes PPS/Suscripción, bloqueo si saldo < $5, switch de plan que respeta el ciclo.
- Flujo cash-first básico (sin pagos), `acceptOrder` server function con validación de elegibilidad.
- Feed ordenado por distancia, realtime de pedidos, panel admin con sello IA.
- Diseño "Modern Logistics" (negro/gris/verde) ya aplicado.

Faltan (esto es lo que voy a construir):

---

## 1. Geolocalización del repartidor cada 3 minutos

- Hook `useCourierLocationTracker` activo solo cuando `role === "courier"` y `status === "active"`.
- `navigator.geolocation.watchPosition` con throttle: solo escribe a BD si pasaron ≥3min desde el último `UPDATE`.
- Persiste `lat`, `lng` en `couriers` vía `supabase.from("couriers").update(...)`.
- Maneja `permission denied` mostrando un banner sutil ("Activa ubicación para recibir pedidos cercanos").

## 2. Prueba de entrega (GPS < 50m + foto obligatoria)

- Nuevo bucket de Storage `delivery-proofs` (privado, RLS por courier).
- Migración: añadir `delivery_proof_url TEXT` y `delivered_lat/delivered_lng` a `orders`.
- En `ActiveOrderView` (cuando `status === "in_transit"`):
  - Tomar GPS actual, calcular `haversine` contra `dropoff_lat/lng`.
  - Botón "Marcar entregado" deshabilitado si `distance > 50m` (mostrar "Acércate al punto: faltan Xm").
  - Al pulsar, abrir input `<input type="file" accept="image/*" capture="environment">` obligatorio.
  - Subir foto, luego `update orders set status='delivered', delivered_at, delivery_proof_url, delivered_lat/lng`.
- En la vista del restaurante, agregar miniatura de la foto cuando el pedido esté entregado.

## 3. Notificaciones Web Push + sonido "ping"

- VAPID keys como secrets (`VAPID_PUBLIC_KEY` público, `VAPID_PRIVATE_KEY` server-only). Pediré ambos al confirmar el plan.
- `public/sw.js` mínimo solo para Web Push (sin caché — respeta la guía PWA del sistema).
- Hook `useEnablePush()`: pide permiso, registra SW, suscribe vía `pushManager.subscribe`, guarda en `push_subscriptions`.
- Server function `notifyCourier(courierId, payload)` usa `web-push` con la suscripción guardada.
- Sonido local: cuando llega un pedido por realtime y el repartidor está activo en la app, reproducir `/ping.mp3` (asset que generaré).

## 4. Waterfall de asignación (2km → 5km, 30s por candidato)

- Server function `dispatchOrder(orderId)` invocada inmediatamente al crear un pedido (desde `CreateOrderDialog`).
- Algoritmo:
  1. Lista de couriers `active` + elegibles (sub o saldo≥5) con `lat/lng` no nulo.
  2. Filtra por radio 2km usando `haversine` en JS.
  3. Ordena por distancia, recorre uno por uno: envía push "Pedido a X km, $Y", espera 30s.
  4. Si tras 30s sigue `pending`, pasa al siguiente.
  5. Si la lista de 2km se agota, repite con 5km.
- Implementación práctica: el server function arranca la primera notificación y agenda la cascada con `pg_cron` o, más simple, con un loop `await sleep(30s)` dentro de `dispatchOrder` (limitado a ~5 candidatos para no exceder timeout del Worker, ~30s por nivel).
- Nota técnica: el Worker tiene límite de tiempo, así que la cascada se implementa como **una sola server function que dispara push al más cercano**, y un **endpoint público `/api/public/cron/dispatch-tick`** llamado cada minuto por `pg_cron` que revisa pedidos `pending` con > N segundos sin courier y notifica al siguiente. Esto evita timeouts.

## 5. Monitor admin de pedidos rezagados

- En `AdminHome`, nueva sección "Pedidos sin asignar > 10 min":
  - Query: `orders` `status='pending'` y `created_at < now() - 10min`.
  - Realtime para auto-refrescar.
  - Badge rojo + botón "Re-disparar" (llama a `dispatchOrder` manualmente).

---

## Archivos afectados

```text
NUEVOS:
  src/hooks/useCourierLocationTracker.ts
  src/hooks/useEnablePush.ts
  src/server/dispatch.functions.ts
  src/server/dispatch.server.ts
  src/server/push.server.ts
  src/routes/api/public/cron.dispatch-tick.ts
  public/sw.js
  public/ping.mp3 (generado)

MODIFICADOS:
  src/features/courier/CourierHome.tsx        (sonido ping, GPS<50m, foto)
  src/features/restaurant/CreateOrderDialog.tsx (llama dispatchOrder)
  src/features/restaurant/RestaurantHome.tsx  (muestra foto entrega)
  src/features/admin/AdminHome.tsx            (sección rezagados)
  src/routes/app.tsx                          (monta tracker + push)

MIGRACIÓN:
  - delivery_proof_url, delivered_lat, delivered_lng en orders
  - bucket delivery-proofs + RLS
  - extensión pg_cron + job de 1min al endpoint público
```

## Secretos a pedir

- `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` (te explico cómo generarlas: `npx web-push generate-vapid-keys`).
- `CRON_SECRET` (opcional, lo genero yo) para autenticar el endpoint público de cron.

## Orden de ejecución sugerido

1. Migración BD + bucket Storage.
2. Geolocalización + prueba de entrega (lo más visible para el usuario).
3. Push + sonido + dispatch waterfall.
4. Monitor admin rezagados.

¿Aprobamos así o quieres priorizar/quitar algo?