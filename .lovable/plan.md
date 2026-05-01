## Agregar Distancia y Total del envío al diálogo de pedido

### UI (`src/features/restaurant/CreateOrderDialog.tsx`)

Añadir dos campos de solo lectura debajo de la fila Total/Estado de pago:

- **Distancia (km)**: calculada en vivo con `haversine()` entre el pickup del restaurante y el dropoff seleccionado. Se muestra con 2 decimales. Vacío si falta alguna coordenada.
- **Total del envío**: calculado en vivo según la tarifa, en MXN. No editable (`readOnly`, fondo `muted`).

Layout: dos columnas en desktop, apiladas en móvil — espejo de la fila anterior.

### Tarifa de envío (helper local en el mismo archivo)

```text
0   – 3.0 km  → $40
3.1 – 5.0 km  → $50
5.1 – 7.0 km  → $60
7.1 – 9.0 km  → $70
9.1 – 10.9 km → $80
≥ 11 km       → $80 + $10 por cada km completo arriba de 11
```

```typescript
function calcShippingFee(km: number): number {
  if (!Number.isFinite(km) || km <= 0) return 0;
  if (km <= 3)    return 40;
  if (km <= 5)    return 50;
  if (km <= 7)    return 60;
  if (km <= 9)    return 70;
  if (km <= 10.9) return 80;
  const extra = Math.ceil(km - 11); // cada km extra (o fracción) suma $10
  return 80 + 10 + extra * 10;       // 11km exactos = $90, 11.1 = $100, etc.
}
```

Nota sobre el tramo "arriba de 11km": el enunciado dice "$10 extra por km dentro de la ciudad". Interpretación: en 11.0 km ya entra el primer extra ($90) y se suma $10 por cada km adicional iniciado. Si prefieres otra interpretación (p.ej. solo km enteros completos), dilo y lo ajusto.

### Lógica de submit

- `shipping_fee = calcShippingFee(km)` (calculado, no del form).
- `amount_to_collect` según `payment`:
  - `pending` → `total + shipping_fee` (cliente paga producto y envío al recibir)
  - `all`     → `total + shipping_fee` (igual)
  - `paid`    → `0`
- Prefijo en `notes` se amplía para incluir la info del envío:
  `[Pago: <estado>] [Envío: $<fee> · <km> km] <notas>`
  Así el repartidor ve la tarifa sin cambios de schema.

### Base de datos
Sin cambios. (`orders` no tiene columna dedicada para `shipping_fee`/`distance_km`; se conserva en `notes`.)

### Archivos a modificar
- `src/features/restaurant/CreateOrderDialog.tsx` (importar `haversine` desde `@/components/MapView`, añadir `useMemo` para km y fee, dos inputs readOnly, ajustar submit).
