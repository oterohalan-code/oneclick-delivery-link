## Auto-rellenar dirección desde el pin del mapa

Cuando el restaurante seleccione el destino en el mapa (ya sea con autocompletado o haciendo clic), la dirección se rellenará automáticamente vía reverse-geocoding. El campo de texto "Dirección de entrega" se convierte en informativo (de solo lectura) en lugar de requerir captura manual.

### Cambios en `src/features/restaurant/CreateOrderDialog.tsx`

1. **Importar `reverseGeocode`** desde `@/components/MapView` (ya existe en el componente).

2. **Reemplazar el `AddressSearch` y el manejo del clic en el mapa** por un único flujo:
   - El `AddressSearch` se mantiene como buscador opcional (autocomplete). Cuando el usuario elige una sugerencia, ya devuelve dirección + lat/lng.
   - El `onMapClick` del mapa ahora hará reverse geocoding y rellenará `dropoff_address` automáticamente con el resultado (si Nominatim falla, usa una cadena tipo `Pin: lat, lng` como respaldo).

3. **Convertir el campo dirección en read-only / informativo**:
   - Mostrar la dirección final en un `Input` con `readOnly` y estilo `bg-muted` debajo del mapa (no antes), con label "Destino seleccionado".
   - Mantener el `AddressSearch` arriba con label "Buscar dirección" (queda claro que es opcional, una ayuda).
   - Si no hay pin todavía, muestra placeholder "Selecciona en el mapa o busca arriba".

4. **Estado de carga**: agregar `addressLoading` para mostrar "Obteniendo dirección…" mientras se hace el reverse geocoding tras un clic.

5. **Validación**: el schema sigue exigiendo `dropoff_address` mínimo de 5 caracteres, pero como ya se rellena automáticamente nunca debería faltar. El error real al usuario es "Selecciona el destino en el mapa" si no hay coordenadas.

### Detalles UX
- Orden visual nuevo: cliente/whatsapp → buscador de dirección (opcional) → mapa → cuadro read-only "Destino seleccionado" → resto.
- No se pierde funcionalidad: el usuario aún puede teclear en el buscador para autocompletar, o simplemente clicar el mapa.

### Archivos a modificar
- `src/features/restaurant/CreateOrderDialog.tsx`
