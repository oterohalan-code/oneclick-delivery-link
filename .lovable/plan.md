## Arreglar el mapa: loop infinito y marcadores rotos

### Diagnóstico
En el session replay se ve que el mapa parpadea sin parar (~6 veces por segundo): añade marcadores + línea punteada → cambia a línea verde → vuelve a empezar. Esto es un **bucle infinito de renderizado**.

Causa: el `useEffect` de `MapView` depende de `pins` (un array nuevo en cada render del padre). Dentro del efecto se llama `onRouteInfoRef.current?.({...})`, que actualiza `routeInfo` en el diálogo padre → re-render del padre → nuevo array `pins` → vuelve a correr el efecto → nuevo fetch a OSRM → nuevo `setRouteInfo` → loop. El resultado: marcadores y rutas se borran y redibujan constantemente, los pines parecen "no aparecer", y hay decenas de fetches a OSRM por segundo.

Adicionalmente, el icono por defecto de Leaflet a veces no se ve porque el contenedor cambia de tamaño tras montar (dentro del Dialog) y necesita `invalidateSize()`.

### Cambios

**`src/components/MapView.tsx`**
1. Reemplazar la dependencia `pins` del `useEffect` por una **clave estable** derivada de las coordenadas:
   ```ts
   const pinsKey = pins
     .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))
     .map(p => `${p.lat.toFixed(6)},${p.lng.toFixed(6)},${p.label ?? ""}`)
     .join("|");
   ```
   y usar `[pinsKey, showRoute, zoom]` como deps. Así el efecto sólo corre cuando realmente cambian las coordenadas, no en cada render del padre.
2. Llamar `mapRef.current?.invalidateSize()` después de actualizar (en un `setTimeout(..., 0)`) para forzar el re-cálculo de tamaño cuando el mapa vive dentro del Dialog (el contenedor se mide tarde y por eso a veces no se ven los tiles/iconos).

**`src/features/restaurant/CreateOrderDialog.tsx`**
1. Memoizar el array `pins` con `useMemo` para que la referencia sea estable cuando las coords no cambian (defensa en profundidad, además del `pinsKey` interno):
   ```ts
   const pins = useMemo(() => [
     ...(restaurant.lat && restaurant.lng ? [{ lat: restaurant.lat, lng: restaurant.lng, label: "Recogida" }] : []),
     ...(form.lat && form.lng ? [{ lat: form.lat, lng: form.lng, label: "Entrega" }] : []),
   ], [restaurant.lat, restaurant.lng, form.lat, form.lng]);
   ```
2. Memoizar `handleRouteInfo` con `useCallback` para no recrearlo en cada render.

### Resultado esperado
- El mapa monta una vez; los marcadores Recogida/Entrega aparecen estables.
- Al elegir destino: línea punteada gris breve → ruta verde por calles. Sin parpadeo.
- Una sola petición a OSRM por cambio de destino (no decenas por segundo).
- La distancia y total del envío se calculan una vez y quedan estables.

### Archivos a modificar
- `src/components/MapView.tsx`
- `src/features/restaurant/CreateOrderDialog.tsx`
