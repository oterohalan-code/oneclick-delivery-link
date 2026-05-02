## Generar 4 logos premium minimalistas para 1Click

Diseño en línea con el branding actual del proyecto (paleta `ink`/`bone`/`graphite` + acento cobre `#B8693A`, tipografía Inter Tight, estética Apple/Linear ya presente en `Logo.tsx` y la landing).

### Concepto
Cuatro variaciones monocromáticas que mantienen la identidad existente (disco oscuro + "1" + punto cobre = "click") pero exploran distintas referencias a la naturaleza logística de la app:

1. **Variante A — Click clásico refinado**
   Evolución del logo actual: disco `ink`, "1" en `bone`, punto cobre desplazado como cursor/click. Tipografía geométrica más ajustada.

2. **Variante B — 1 + Pin de ubicación**
   El "1" se transforma sutilmente en un pin de mapa (base puntiaguda). Punto cobre como marcador GPS. Refuerza la idea de delivery/ubicación.

3. **Variante C — 1 + Trayectoria**
   El "1" acompañado de una línea de movimiento/ruta arqueada que termina en el punto cobre. Sugiere velocidad y entrega ("< 30s").

4. **Variante D — Monograma circular**
   "1C" entrelazados dentro del disco, punto cobre como remate. Más corporativo, ideal para favicon/avatar.

Cada variante se entrega en:
- **SVG vectorial** (editable, escalable, ligero) en `src/assets/logos/`
- **PNG 1024×1024** preview en `/mnt/documents/` para comparar visualmente

### Implementación técnica

1. **Generar 4 SVGs a mano** (no IA) siguiendo el patrón del actual `logo-mark.svg`:
   - `src/assets/logos/logo-1click-a-click.svg`
   - `src/assets/logos/logo-1click-b-pin.svg`
   - `src/assets/logos/logo-1click-c-route.svg`
   - `src/assets/logos/logo-1click-d-monogram.svg`
   - Versión con wordmark "1Click" para cada uno (variante `-wordmark.svg`)

2. **Renderizar PNGs preview** con un script Node usando `sharp` (o convertir vía `librsvg`/`rsvg-convert` disponible en el sandbox) sobre fondo `bone` (#F5F2EB) para que se aprecien correctamente. Salida en `/mnt/documents/1click-logos/`.

3. **Crear hoja comparativa** (`/mnt/documents/1click-logos/comparison.png`) con las 4 opciones lado a lado, cada una etiquetada (A/B/C/D) y mostrada en dos tonos (sobre `bone` y sobre `ink`) para evaluar contraste.

4. **NO modificar** `src/components/Logo.tsx` ni reemplazar el logo actual todavía — primero eliges, luego en el siguiente turno lo integro al sistema (Logo component, favicon, manifest, og:image).

### Entregables
- 4 archivos SVG (mark) + 4 SVG (con wordmark) en `src/assets/logos/`
- 8 PNGs individuales + 1 hoja comparativa en `/mnt/documents/1click-logos/`
- Tags `<lov-artifact>` para previsualizar y descargar

### Después de tu elección
Cuando me digas "quiero la opción X", reemplazo `src/assets/logo-mark.svg` y `src/assets/logo-1click.svg`, actualizo `public/manifest.json`, favicon y referencias.