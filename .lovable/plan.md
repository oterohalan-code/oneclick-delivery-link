## Problemas a resolver

1. **El mapa se "traba" y no desaparece** cuando el pedido cambia de estado o se entrega.
2. El **repartidor** debe ver: nombre del restaurante + **fachada (foto)**.
3. El **restaurante** debe ver: nombre y **teléfono del repartidor** asignado (hoy no puede leer `profiles` por RLS).
4. **Notificaciones push** en cada actualización importante (nuevo pedido, aceptado, en camino, entregado, mensaje de chat).

---

## 1. Arreglar el mapa "atorado"

Causa: `MapView` se monta una sola vez (init en `useEffect([])`) y se re-renderiza con nuevos pins, pero al cambiar de "pedido activo" a "feed" o al entregar, el contenedor a veces queda visible porque el `<div className="h-72">` se mantiene y Leaflet conserva tiles cacheados sin `invalidateSize`. Además, `pins` se recrea en cada render → el efecto re-dispara fetch a OSRM aunque pinsKey sea estable, y deja capas pegadas si el componente padre no desmonta.

Cambios:
- En `MapView.tsx`: forzar **`key`-based remount** desde el padre cuando cambia el contexto (status del pedido) y limpiar layers + abortar fetch en cleanup (ya hace, pero reforzar con `mapRef.current?.off()` y eliminar event listeners en unmount).
- Agregar `ResizeObserver` para llamar `invalidateSize()` cuando el contenedor cambie de tamaño/visibilidad.
- En `CourierHome.tsx`: usar `key={`map-${order.status}`}` en `<MapView>` para que se desmonte al cambiar de fase (`assigned` → `in_transit` → `delivered`). Y solo renderizar el bloque del mapa si `pins.length >= 1`.
- Cuando el pedido pase a `delivered`/`cancelled`, `ActiveOrderView` ya deja de renderizarse (porque `load()` lo limpia), pero garantizar el desmonte envolviendo el bloque del mapa con `{order.status !== "delivered" && ...}`.

## 2. Mostrar fachada del restaurante al repartidor

- Agregar `facade_url` al `select` de restaurantes en `CourierHome.load()`.
- En `ActiveOrderView` y en cada tarjeta del feed, mostrar miniatura/imagen redonda con la fachada al lado del nombre.
- Generar URL firmada del bucket privado `restaurant-photos` con `supabase.storage.from('restaurant-photos').createSignedUrl(path, 3600)` (cachear en estado).

## 3. Mostrar nombre + teléfono del repartidor al restaurante

Como `profiles` tiene RLS estricta, crear un **server function** con `requireSupabaseAuth` que valide que el usuario es dueño del restaurante del pedido y devuelva `{ full_name, phone, phone_dial_code }` del courier vía `supabaseAdmin`.

- Nuevo archivo: `src/server/orders.functions.ts` → agregar `getCourierForOrder({ orderId })`.
- En `RestaurantHome.tsx`: cuando un pedido tiene `courier_id`, llamar a la función y guardar `courierInfo[orderId]`.
- Mostrar en la tarjeta: 👤 Nombre · 📞 teléfono (link `tel:` y `wa.me`).
- Pasar `peerName` y `peerPhone` reales al `<OrderChat>` del restaurante (hoy va hardcodeado "Repartidor").

## 4. Notificaciones push reales

La tabla `push_subscriptions` existe pero no hay service worker, ni VAPID, ni edge/server function que envíe. Implementar Web Push end-to-end:

### Frontend
- Crear `public/sw.js` (service worker mínimo con handler `push` → muestra notificación con `title`, `body`, `data.url`; y `notificationclick` → abre la URL).
- Crear `src/lib/push.ts` con `enablePush(userId)`:
  - Registra `/sw.js`.
  - Pide `Notification.requestPermission()`.
  - `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC })`.
  - Hace upsert en `push_subscriptions` (endpoint, p256dh, auth).
- Llamar `enablePush()` automáticamente desde `CourierHome` y `RestaurantHome` después del login (con un toast/botón "Activar notificaciones" si el permiso es `default`).

### Backend (TanStack server function, no edge function)
- `src/server/push.functions.ts` con `notifyUsers({ userIds, title, body, url })`:
  - Lee `push_subscriptions` con `supabaseAdmin`.
  - Usa la librería `web-push` con secrets `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` (pedirlos con `add_secret` — y dar un comando para generarlos).
  - Hace POST a cada endpoint; si responde 404/410 borra la suscripción.

### Triggers de notificaciones
Llamar `notifyUsers` desde el flujo correspondiente:
| Evento | Quién recibe | Mensaje |
|---|---|---|
| Restaurante crea pedido | Todos los couriers `active` con saldo/sub | "📦 Nuevo pedido cerca" |
| Courier acepta | Dueño del restaurante | "🛵 {nombre} aceptó tu pedido" |
| Courier marca "En camino" | Restaurante | "🚚 Pedido en camino al cliente" |
| Courier entrega | Restaurante | "✅ Pedido entregado" |
| Mensaje de chat | El otro participante | "💬 {peerName}: {preview}" |

- En `acceptOrder` server fn → push al restaurant owner.
- En las llamadas `supabase.from('orders').update({status})` reemplazar por server fns `setOrderInTransit` / `setOrderDelivered` que además disparen push (la lógica de cobro $5 PPS también debería estar en server).
- Para el chat: nuevo server fn `sendOrderMessage` que inserte el mensaje y dispare push al peer (usa `is_order_participant` para validar). El cliente lo llama en vez de insert directo.
- Para "nuevo pedido": en `createOrder` (donde sea que viva la lógica de inserción) agregar push masivo a couriers elegibles.

### Foreground (cuando la app está abierta)
- El realtime ya está; agregar `toast` consistente en `RestaurantHome` (ya hay) y mejorar el de `CourierHome` para `UPDATE` (ej. si su pedido cambia).
- Para el chat, mostrar toast al peer si el `OrderChat` no está abierto.

---

## Archivos a tocar

- `src/components/MapView.tsx` — cleanup robusto + ResizeObserver.
- `src/features/courier/CourierHome.tsx` — `key` en MapView, desmonte por status, fachada del restaurante, llamada a `enablePush`, usar server fns para update de status, `sendOrderMessage` indirecto vía `OrderChat`.
- `src/features/restaurant/RestaurantHome.tsx` — `getCourierForOrder`, mostrar teléfono, pasar peerName/peerPhone reales, `enablePush`, toast de chat.
- `src/components/OrderChat.tsx` — usar server fn `sendOrderMessage`; toast cuando llega mensaje y el dialog está cerrado (via prop o callback).
- **Nuevos**:
  - `public/sw.js`
  - `src/lib/push.ts`
  - `src/server/push.functions.ts`
  - `src/server/orders.functions.ts` (extender con `getCourierForOrder`, `setOrderInTransit`, `setOrderDelivered`, `sendOrderMessage`, `notifyNewOrder`)
- **Secrets nuevos** (pediré al confirmar): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. También expondré `VITE_VAPID_PUBLIC_KEY` para el `subscribe` del navegador.
- **Dependencia npm**: `web-push`.

---

## Notas

- No se requieren cambios de schema (las tablas `push_subscriptions` y columnas necesarias ya existen).
- iOS Safari requiere que la app esté instalada como PWA para recibir push; lo aclararé en el toast de "Activar notificaciones".
- El chat seguirá siendo en tiempo real (Supabase Realtime) cuando la app está abierta; el push es para cuando está cerrada o en background.

¿Apruebas?