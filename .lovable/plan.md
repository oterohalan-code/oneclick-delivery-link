# Plan: 1-Click PWA

App mobile-first para conectar restaurantes con repartidores en Cancún. Tema verde vibrante + negro, estilo logística rápida. Pagos simulados en MVP, realtime con Supabase + Web Push, mapas con Leaflet/OSM, y panel admin in-app para validar repartidores.

## 1. Autenticación y roles

- Login/Register con email + contraseña (Lovable Cloud / Supabase Auth) y selector de rol: **Restaurante** o **Repartidor**.
- Tabla `user_roles` separada (enum: `restaurant`, `courier`, `admin`) + función `has_role()` para RLS segura.
- Onboarding por rol tras el registro:
  - **Restaurante**: nombre del local, dirección (input + selección en mapa Leaflet con búsqueda Nominatim), teléfono, categoría de comida.
  - **Repartidor**: datos personales + carga de documentos a Supabase Storage (INE frente, INE vuelta, licencia, foto moto, placa, foto mochila) + dirección de domicilio en mapa. Estado inicial: `pending_validation`.
- Repartidor no validado ve pantalla "En revisión" y no accede al feed.

## 2. Modelo de negocio del repartidor (lógica core)

Sección "Plan y Wallet" en el perfil del repartidor:

- **PPS (Pago por Servicio)**: $5 MXN se descuentan del wallet por cada pedido marcado `delivered`. Si `wallet_balance < 5`, el botón "Aceptar pedido" se bloquea con mensaje "Recarga tu monedero".
- **Suscripción**: $249 MXN / mes, comisión $0. Mientras `subscription_active = true` y `subscription_expires_at > now()`, no se descuenta del wallet.
- **Regla de cambio**: si está suscrito y cambia a PPS, la suscripción sigue vigente hasta `subscription_expires_at`. El cobro de $5 inicia automáticamente al vencer.
- Recargas y suscripción **simuladas**: botones "Recargar $50 / $100 / $200" y "Activar suscripción $249" que insertan en `wallet_transactions` y actualizan saldo/suscripción. Listo para conectar Stripe en el futuro.

## 3. Flujo en vivo (Live Workflow)

**Restaurante — Dashboard**
- Botón grande central "Solicitar Repartidor".
- Modal: dirección de destino (mapa + búsqueda), monto a cobrar al cliente, ID de pedido, notas.
- Crea registro en `orders` con estado `pending` → realtime + Web Push a repartidores validados cercanos.
- Lista de pedidos activos del restaurante con estado en vivo.

**Repartidor — Dashboard**
- Feed de pedidos `pending` ordenados por cercanía (filtrado client-side con coordenadas del restaurante).
- Botón "Aceptar" → server function que actualiza el pedido a `assigned` solo si sigue `pending` (lock atómico). Si otro lo tomó, muestra "Ya fue tomado".
- Vista de pedido aceptado con mapa Leaflet mostrando ruta Restaurante → Cliente (línea recta + distancia; sin Google Directions para mantenerlo gratis).
- Botones de transición de estado: "En camino" → "Entregado".
- Al marcar `delivered`: si plan PPS y sin suscripción vigente, descuenta $5 del wallet en la misma server function.

**Estados del pedido**: `pending → assigned → in_transit → delivered` (+ `cancelled`).

**Notificaciones (Realtime + Web Push)**
- Restaurante recibe push cuando un repartidor acepta y cuando entrega.
- Repartidores validados reciben push cuando hay un nuevo pedido `pending`.
- In-app: badges y toasts vía Supabase Realtime sobre la tabla `orders`.
- Service worker registra suscripción Web Push y guarda endpoint en `push_subscriptions`. Una server function envía las notificaciones con la web-push library usando claves VAPID.

## 4. Panel Admin

- Ruta `/admin` protegida por rol `admin`.
- Lista de repartidores `pending_validation` con preview de cada documento.
- Acciones: **Aprobar** (estado → `active`) o **Rechazar** (estado → `rejected` + motivo).
- Notificación in-app + Web Push al repartidor cuando se aprueba/rechaza.

## 5. Vistas adicionales

- **Historial** (ambos roles): lista de pedidos pasados con monto, fecha, estado, contraparte.
- **Ganancias** repartidor: total entregas, ingresos del cliente cobrados, comisiones pagadas (PPS) o suscripción vigente.
- **Wallet repartidor**: saldo actual, historial de movimientos, botones de recarga simulada.

## 6. Diseño UI/UX

- Mobile-first, instalable como PWA (manifest + iconos; sin service worker de cache para evitar problemas en preview, solo SW para Web Push).
- Paleta: verde vibrante `#00C853` como primario, negro `#0A0A0A` como fondo de marca, blanco para superficies, amarillo para pendientes, rojo para errores.
- Tipografía sans moderna, botones grandes, tap targets generosos, mapas a pantalla completa cuando aplique.
- Iconografía lucide-react (moto, paquete, mapa, billete).

## 7. Detalles técnicos

**Stack**: TanStack Start + React + Tailwind v4 + shadcn/ui + Lovable Cloud (Supabase) + Leaflet + react-leaflet + web-push.

**Tablas Supabase** (todas con RLS):

```text
profiles (id, role-derivado-via-user_roles, full_name, phone, created_at)
user_roles (id, user_id, role)  -- enum: restaurant | courier | admin
restaurants (id, user_id, name, address, lat, lng, phone, category)
couriers (id, user_id, address, lat, lng,
          ine_front_url, ine_back_url, license_url, moto_url,
          plate, plate_url, backpack_url,
          status, plan, wallet_balance,
          subscription_active, subscription_expires_at, rejection_reason)
orders (id, restaurant_id, courier_id, status,
        pickup_address, pickup_lat, pickup_lng,
        dropoff_address, dropoff_lat, dropoff_lng,
        amount_to_collect, external_order_id, notes,
        created_at, accepted_at, delivered_at)
wallet_transactions (id, courier_id, type, amount, order_id, created_at)
  -- type: topup | order_fee | subscription_charge
subscriptions (id, courier_id, started_at, expires_at, amount, status)
push_subscriptions (id, user_id, endpoint, p256dh, auth)
```

**Server functions clave** (`createServerFn` con `requireSupabaseAuth`):
- `createOrder`, `acceptOrder` (lock atómico), `updateOrderStatus`, `markDelivered` (aplica cobro PPS).
- `topUpWallet`, `activateSubscription`, `switchPlan`.
- `approveCourier`, `rejectCourier` (admin).
- `sendPush` (server-side, llamada desde las anteriores).

**Realtime**: subscripciones a `orders` filtradas por `restaurant_id` o por estado `pending` para repartidores.

**Mapas**: Leaflet + OpenStreetMap tiles, búsqueda con Nominatim, ruta como `Polyline` recta. Cálculo de cercanía con haversine en el cliente.

**PWA**: `manifest.json` con iconos y `display: standalone` (instalable). Service worker mínimo solo para Web Push, registrado únicamente fuera de iframes/preview de Lovable.

**Storage**: bucket privado `courier-docs` con RLS (el repartidor sube/lee lo suyo, admin lee todo).

## 8. Entregables del primer sprint

1. Auth + roles + onboarding restaurante y repartidor con upload de documentos.
2. Panel admin para aprobar/rechazar repartidores.
3. Wallet y planes (recargas y suscripción simuladas, regla de cambio).
4. Flujo de pedido end-to-end con realtime y mapa Leaflet.
5. Web Push (VAPID) + service worker mínimo + manifest PWA.
6. Historial y ganancias para ambos roles.

## Fuera de alcance (futuro)

- Pagos reales con Stripe (recargas + suscripción recurrente).
- Routing real con Directions API.
- Tracking GPS en vivo del repartidor durante el viaje.
- Calificaciones y reseñas.
- App nativa.
