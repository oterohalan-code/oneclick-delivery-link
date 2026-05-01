## Pedidos en tiempo real al repartidor + chat con el restaurante

### Estado actual (ya funciona)
- El feed de pedidos del repartidor (`CourierHome`) ya recibe los nuevos pedidos en tiempo real (canal `postgres_changes` con filtro `status=eq.pending`).
- Ya muestra el nombre del restaurante y la distancia entre el repartidor y el restaurante (haversine), ordenando por cercanía.
- Al aceptar un pedido aparece el `ActiveOrderView` con un mapa que muestra los pines de recogida y entrega.

### Lo que falta
1. **Mostrar la ganancia real del envío al repartidor** (no el monto a cobrar al cliente). Hoy solo se guarda dentro del campo `notes` como texto, no es confiable.
2. **Mapa al recoger**: actualmente muestra ruta directa Recogida→Entrega. Mientras `status === "assigned"` debería trazar la ruta **del repartidor al restaurante**; cuando pase a `in_transit`, la ruta **del restaurante al cliente** (lo actual).
3. **Chat repartidor ↔ restaurante** vinculado al pedido, con header con nombre del local y botón para llamar al teléfono.

### Cambios

#### 1. Migración de base de datos
Agregar a `orders`:
- `shipping_fee NUMERIC NOT NULL DEFAULT 0` — tarifa cobrada por el envío (es la ganancia del repartidor).
- `distance_km NUMERIC` — distancia de la ruta calculada al crear el pedido.

Crear tabla `order_messages`:
- `id`, `order_id`, `sender_id` (auth.users), `sender_role` ('restaurant' | 'courier'), `content TEXT`, `created_at`.
- RLS: pueden leer/escribir solo el dueño del restaurante de ese pedido o el courier asignado.
- Habilitar realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages` + `REPLICA IDENTITY FULL`.

#### 2. `CreateOrderDialog.tsx`
Al insertar el pedido, también guardar `shipping_fee` y `distance_km` en columnas dedicadas (además de seguir incluyéndolos en notes para el historial).

#### 3. `CourierHome.tsx`
- En cada tarjeta del feed: mostrar **"Ganas $X"** (verde, prominente) usando `o.shipping_fee`. Mantener `amount_to_collect` como secundario ("Cobrar al cliente").
- En `ActiveOrderView`:
  - Mientras `status === "assigned"`, los pins del mapa serán `[ubicación del repartidor, restaurante]` para guiarlo a recoger. Cuando pase a `in_transit`, vuelve a `[restaurante, cliente]`.
  - Botón nuevo "Chat con el restaurante" que abre el componente de chat.

#### 4. Componente nuevo `OrderChat.tsx` (dialog)
- Header sticky con nombre del restaurante y botón `tel:` con su teléfono.
- Lista de mensajes (suscripción realtime al canal del pedido).
- Input + botón "Enviar".
- Reusable: el restaurante también lo abrirá desde su vista del pedido (queda fuera del scope inmediato pero el componente está listo).

### Detalles técnicos
- Realtime del feed ya está montado; solo se añade un canal extra dentro de `OrderChat` filtrado por `order_id=eq.<id>`.
- Para la ruta "repartidor → restaurante", se usa la ubicación viva del courier (`courier.lat/lng` ya existe en estado y se actualiza cada 3 min con `useCourierLocationTracker`).

### Archivos a crear/editar
- Migración SQL (nueva)
- `src/features/restaurant/CreateOrderDialog.tsx` (guardar shipping_fee y distance_km)
- `src/features/courier/CourierHome.tsx` (mostrar ganancia, mapa según status, botón chat)
- `src/components/OrderChat.tsx` (nuevo)
