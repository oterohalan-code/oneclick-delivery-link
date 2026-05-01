## Problema

En la vista móvil del repartidor, al pulsar "Finalizar entrega" el popup aparece pero el mapa Leaflet se sobrepone, impidiendo subir la foto y confirmar.

## Causa

Leaflet aplica z-index muy altos a sus panes y controles internos (hasta `z-index: 1000` en zoom controls y `700` en popups), mientras que el componente `Dialog` de shadcn usa `z-50` (= z-index 50). En desktop suele no notarse, pero en móvil al ocupar todo el viewport el mapa queda visualmente encima.

## Solución

Subir el z-index del `DialogOverlay` y `DialogContent` en `src/components/ui/dialog.tsx` de `z-50` a `z-[2000]`, garantizando que cualquier dialog (incluido el de finalizar entrega) quede siempre por encima del mapa Leaflet y sus controles.

Esto es una corrección global y consistente: todos los modales del proyecto se beneficiarán y no romperá ningún z-index existente porque ningún otro elemento del proyecto usa valores tan altos.

## Cambios

**`src/components/ui/dialog.tsx`**
- `DialogOverlay`: `z-50` → `z-[2000]`
- `DialogContent`: `z-50` → `z-[2000]`

No se requieren cambios en `DeliveryProofDialog.tsx`, `MapView.tsx` ni en la BD.
