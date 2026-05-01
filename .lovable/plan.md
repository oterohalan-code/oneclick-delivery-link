## Agregar nombre del cliente y WhatsApp al pedido

Añadiré dos campos nuevos al formulario de creación de pedido y los mostraré al repartidor cuando vea / acepte el pedido. Para que la información esté estructurada (no escondida en `notes`), se añadirán columnas dedicadas en la tabla `orders`.

### 1. Base de datos
Migración para agregar a `orders`:
- `customer_name TEXT` (nullable)
- `customer_phone TEXT` (nullable, formato E.164 ej. `+5215512345678`)
- `customer_phone_dial_code TEXT DEFAULT '+52'`

Sin cambios en RLS (las políticas existentes aplican).

### 2. Formulario `CreateOrderDialog.tsx`
Agregar dos inputs nuevos arriba de "Dirección de entrega":
- **Nombre del cliente** — texto, requerido, 2–80 caracteres.
- **WhatsApp del cliente** — input numérico con prefijo `+52` (igual que registro), 10 dígitos, validado con zod.

El `submit` insertará `customer_name` y `customer_phone` (concatenando dial code + número) en las nuevas columnas. Schema zod actualizado.

### 3. Vista del repartidor `CourierHome.tsx`
En la tarjeta del pedido pendiente y en la vista del pedido aceptado, mostrar:
- 👤 Nombre del cliente
- 📱 Botón "WhatsApp" que abre `https://wa.me/<numero>` en nueva pestaña (sólo visible cuando el pedido ya fue aceptado, para evitar contacto antes de aceptar).

### 4. Vista del restaurante
En `RestaurantHome.tsx` mostrar el nombre del cliente bajo la dirección, para referencia rápida.

### Detalles técnicos
- Validación con zod: `customer_name: z.string().trim().min(2).max(80)`, `customer_phone: z.string().regex(/^\d{10}$/)`.
- El número se guarda ya con dial code (ej. `+5215512345678`) listo para `wa.me`.
- Tipos de Supabase se regeneran automáticamente tras la migración.

### Archivos a modificar
- Migración SQL (nueva)
- `src/features/restaurant/CreateOrderDialog.tsx`
- `src/features/courier/CourierHome.tsx`
- `src/features/restaurant/RestaurantHome.tsx`
