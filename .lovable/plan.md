## Trazar ruta real por calles (estilo Waze/Google) y usar distancia de ruta

### Resumen
Hoy el mapa une pickup y destino con una línea recta y la distancia se calcula con haversine (línea recta). Vamos a:
- Trazar la ruta real siguiendo las calles usando **OSRM público** (`https://router.project-osrm.org`, gratuito, sin API key).
- Mostrar la polilínea sobre el mapa siguiendo el trazo de las calles.
- Usar la **distancia de la ruta** (km por calle) para calcular la tarifa de envío, en lugar de la línea recta.
- Mostrar también el tiempo estimado de viaje.

### Cambios

**`src/components/MapView.tsx`**
1. Añadir helper exportado:
   ```ts
   export async function fetchRoute(a, b): Promise<{
     coords: [number, number][]; // [lat, lng] siguiendo calles
     distanceKm: number;
     durationMin: number;
   } | null>
   ```
   Llama a `https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=geojson`.
2. Añadir prop opcional `onRouteInfo?: (info | null) => void` al `MapView`.
3. Cuando `showRoute && valid.length >= 2`:
   - Llamar `fetchRoute()` (con AbortController para evitar carreras al mover el pin).
   - Si responde, dibujar `L.polyline` con las coords reales (color primario, peso 5) y emitir `onRouteInfo({ distanceKm, durationMin })`.
   - Si falla, fallback a la línea recta actual y emitir `onRouteInfo(null)`.
4. Mantener el `fitBounds` actual.

**`src/features/restaurant/CreateOrderDialog.tsx`**
1. Nuevo state: `routeInfo: { distanceKm, durationMin } | null`.
2. Pasar `onRouteInfo={setRouteInfo}` al `MapView`.
3. Reemplazar `distanceKm` (haversine) por `routeInfo?.distanceKm`. Mientras se calcula, mostrar "Calculando ruta…" en los campos de Distancia y Total del envío.
4. La tarifa (`calcShippingFee`) ahora usa la distancia de ruta.
5. En `notes` incluir también el tiempo: `[Envío: $80 · 6.42 km · ~12 min]`.
6. Si la ruta falla (sin internet a OSRM), fallback a haversine para no bloquear al usuario, con una nota visible.

### Notas técnicas
- OSRM público es gratuito y no requiere clave; tiene un fair-use razonable. Si más adelante quieres más control, podemos cambiar a Mapbox Directions o GraphHopper con API key.
- Se usa `AbortController` dentro del `useEffect` de `MapView` para cancelar fetches obsoletos cuando el destino cambia rápidamente.
- No hay cambios de base de datos.

### Archivos a modificar
- `src/components/MapView.tsx`
- `src/features/restaurant/CreateOrderDialog.tsx`
