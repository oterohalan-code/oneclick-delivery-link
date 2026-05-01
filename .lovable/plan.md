## Cambios al diálogo de crear pedido

### UI (`src/features/restaurant/CreateOrderDialog.tsx`)
- Renombrar el campo "Monto a cobrar" a **"Total del pedido"**.
- Quitar el campo **"ID pedido"** y su estado (`external`).
- Añadir junto al total un selector **"¿Pagado por el cliente?"** con tres opciones:
  - `Envío pendiente` (cliente debe pagar todo al recibir)
  - `Cliente pagará todo` (paga total + envío al repartidor)
  - `Envío y producto pagados` (no se cobra nada al recibir)
- Layout: dos columnas en desktop (Total | Estado de pago), apiladas en móvil.
- Lógica de `amount_to_collect` según selección:
  - `Envío pendiente` → enviar el total tal cual (cliente paga producto + envío en efectivo)
  - `Cliente pagará todo` → mismo comportamiento (cobrar el total al cliente)
  - `Envío y producto pagados` → `amount_to_collect = 0`
- Guardar el estado de pago como prefijo en `notes` (p. ej. `[Pagado: Envío y producto pagados] ...`) para que el repartidor lo vea, ya que la columna `orders` no tiene un campo dedicado y no se piden cambios de DB.

### Base de datos
- Sin cambios. `external_order_id` queda en la tabla pero ya no se utiliza desde este formulario.

### Detalles técnicos
- Usar el componente `Select` de `@/components/ui/select` para el dropdown.
- Tipar el estado: `payment: "pending" | "all" | "paid"` con default `"pending"`.
- Actualizar el schema Zod: eliminar `external_order_id`, añadir `payment` como enum.
- Eliminar `external` del estado inicial y del reset tras enviar.

### Archivos a modificar
- `src/features/restaurant/CreateOrderDialog.tsx`
