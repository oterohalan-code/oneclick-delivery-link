## Cambios solicitados

1. Quitar el campo "Categoría" del wizard de registro de restaurante.
2. Hacer que el autocompletado de dirección y el mapa funcionen correctamente.

## Cambios técnicos

### 1. `src/features/restaurant/RestaurantSignupWizard.tsx`
- Eliminar el state `category`, su `<Select>` y la importación de `Select*` y `RESTAURANT_CATEGORIES`.
- Quitar `category` de `step2Schema` y del `INSERT` a `restaurants` (la columna `category` es `NOT NULL` en la BD; ver punto 3).
- Quitar el icono `Upload` no usado si queda.

### 2. `src/components/AddressSearch.tsx` — autocompletado en vivo
Reescribirlo con:
- Búsqueda automática mientras se escribe (debounce 400 ms, mínimo 3 caracteres) usando la función `searchAddress` (Nominatim) que ya existe.
- Dropdown flotante con `z-index` alto (sobre el mapa Leaflet, que usa z-index ~400) y mensaje "Sin resultados" cuando aplica.
- Spinner dentro del input mientras carga; icono de lupa a la izquierda.
- Al seleccionar un resultado: rellenar el input, llamar `onChange(address, lat, lng)` y cerrar el dropdown sin disparar otra búsqueda.
- Cerrar dropdown al hacer clic fuera.
- Mantener la misma API (`value`, `onChange`, `placeholder`) para no romper `RestaurantOnboarding`.

### 3. `MapView` — verificar reacción
`MapView` ya re-centra cuando cambian los `pins`, así que al elegir una dirección en el dropdown el pin aparecerá y el mapa hará `setView`/`fitBounds` automáticamente. Tocar el mapa seguirá ajustando el pin (`onMapClick`). No requiere cambios.

### 4. Migración: hacer `restaurants.category` opcional
La columna `category text NOT NULL` rompería el `INSERT` sin categoría. Migración:

```sql
ALTER TABLE public.restaurants ALTER COLUMN category DROP NOT NULL;
```

Se mantiene la columna por compatibilidad con `RestaurantOnboarding` y datos existentes; simplemente deja de ser obligatoria.

## Resultado
- Wizard de paso 2: foto de fachada → dirección con autocompletado en vivo → mapa con pin ajustable → finalizar.
- Sin selector de categoría.