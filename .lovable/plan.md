## Cambio
Cuando el usuario toque el mapa para colocar el pin, rellenar automáticamente el campo "Dirección" con la dirección real de esas coordenadas (reverse geocoding).

## Implementación

### 1. `src/components/MapView.tsx`
Añadir helper exportado `reverseGeocode(lat, lng)` que llama al endpoint `/reverse` de Nominatim:

```ts
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const data = (await r.json()) as { display_name?: string };
    return data.display_name ?? null;
  } catch {
    return null;
  }
}
```

### 2. `src/features/restaurant/RestaurantSignupWizard.tsx`
- Importar `reverseGeocode` junto a `MapView`.
- Cambiar `onMapClick` del `<MapView>`: setear `lat/lng` inmediatamente (responde rápido), luego llamar `reverseGeocode` y, si devuelve algo, setear `address`. Mostrar feedback breve mientras se resuelve (estado `geocoding` que pinta un texto "Obteniendo dirección…" debajo del mapa).
- Si el reverse falla, dejar la dirección como esté (el usuario puede ajustar a mano).

## Resultado
Al tocar un punto en el mapa: el pin se mueve, se actualizan las coordenadas y el input de dirección se rellena con la dirección real (ej. "Av. Tulum 200, SM 5, Cancún, Q.R., México").