## Cambios sin notificaciones push

Mantener: arreglo del mapa, fachada al repartidor, info del repartidor al restaurante, chat vía server function. Quitar todo lo de push (queda como stub para no romper imports).

## 1. Mapa que no se desmonta

- `MapView.tsx`: cleanup robusto en unmount (`map.off()`, `clearLayers()`, `map.remove()` en try/catch) y `ResizeObserver` para llamar `invalidateSize()` cuando el contenedor cambie de tamaño/visibilidad.
- `CourierHome.tsx` (`ActiveOrderView`): renderizar el bloque del mapa solo cuando `status === "assigned" || "in_transit"` y al menos un pin válido, con `key={`map-${order.id}-${order.status}`}` para forzar remount al cambiar de fase.

## 2. Fachada del restaurante para el repartidor

- En `CourierHome.load()`: incluir `facade_url` en el SELECT de restaurantes y generar URL firmada con `supabase.storage.from('restaurant-photos').createSignedUrl(path, 3600)`.
- Mostrar miniatura cuadrada (h-12) en cada tarjeta del feed y h-14 en `ActiveOrderView`. Fallback a un emoji 🍽️ si no hay foto.

## 3. Nombre y teléfono del repartidor para el restaurante

`profiles` tiene RLS estricta, así que va por server function.

- Nuevo server fn `getCourierForOrder({ orderId })` en `src/server/orders.functions.ts`:
  - Valida que el `auth.uid()` es dueño del restaurante del pedido.
  - Devuelve `{ fullName, phone, phoneDialCode }` del repartidor vía `supabaseAdmin`.
- `RestaurantHome.tsx`: para cada pedido `assigned`/`in_transit` con `courier_id`, cargar la info y mostrar:
  - 🛵 Nombre del repartidor
  - 📞 Link `tel:+52...`
  - Pasar `peerName` y `peerPhone` reales al `<OrderChat>` (hoy va hardcodeado "Repartidor").

## 4. Chat vía server function (sin push)

- Nuevo server fn `sendOrderMessage({ orderId, content, senderRole })`:
  - Inserta en `order_messages` respetando RLS (`is_order_participant`).
  - **No** envía push (stub).
- `OrderChat.tsx`: `send()` llama al server fn en vez de hacer `insert` directo. Lectura inicial y realtime siguen igual.
- Toast de mensajes entrantes en foreground en `RestaurantHome` y `CourierHome` (suscripción a `INSERT` de `order_messages`).

## 5. Server fn para avanzar estado del pedido (sin push)

- `setOrderStatus({ orderId, status: "in_transit"|"delivered", proofUrl?, deliveredLat?, deliveredLng? })` que hace el update en `orders` y devuelve ok.
- `ActiveOrderView` usa esta fn en vez de `supabase.from('orders').update()` directo. Ya queda preparado para enchufar push cuando lo activemos.

## 6. Push: queda como stub

- `src/lib/push.ts` → `enablePush()` devuelve `false` (no-op).
- `src/server/push.server.ts` → `sendPushToUsers()` no-op.
- Borrar `public/sw.js`.
- No se pedirán secrets VAPID por ahora.
- `acceptOrder`, `setOrderStatus`, `sendOrderMessage` y `notifyCouriersNewOrder` siguen importando `sendPushToUsers` pero al ser no-op no envían nada — listos para activar cuando quieras.

## Archivos que se editan/crean

- `src/components/MapView.tsx` — cleanup + ResizeObserver.
- `src/components/OrderChat.tsx` — usar `sendOrderMessage` server fn.
- `src/features/courier/CourierHome.tsx` — fachada, mapa con `key`, server fn de status, toast de chat.
- `src/features/restaurant/RestaurantHome.tsx` — info del repartidor, peerName/peerPhone reales, toast de chat.
- `src/features/restaurant/CreateOrderDialog.tsx` — devuelve `inserted.id` y llama (no-op) `notifyCouriersNewOrder` para dejarlo listo.
- `src/server/orders.functions.ts` — nuevas fns: `getCourierForOrder`, `setOrderStatus`, `sendOrderMessage`, `notifyCouriersNewOrder`.
- `src/server/push.server.ts` — stub no-op.
- `src/lib/push.ts` — stub no-op.
- `public/sw.js` — borrado.

## Notas

- Sin migraciones de base de datos.
- Sin secrets nuevos.
- Cuando quieras activar push después, solo hay que reemplazar los dos stubs por la implementación real con `web-push` y registrar el service worker.