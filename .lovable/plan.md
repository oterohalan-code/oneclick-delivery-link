## Rediseño 1Click — Obsidian Glass

Dirección: monocromo sofisticado (negro tinta + crema) con acentos cálidos sutiles, capas de **glassmorphism** (blur + transparencias), bordes refinados y botones premium con micro-interacciones.

### 1. Logo "1Click" (nuevo)

Generaré un logo SVG vectorial — sin verde, basado en un **monograma "1●"** (uno + punto/click) en disco negro tinta sobre fondo crema, con tipografía sans serif moderna. Un solo trazo, escalable, funciona en favicon y en hero.

Variantes producidas:
- `src/assets/logo-1click.svg` — logo horizontal completo
- `src/assets/logo-mark.svg` — solo el monograma para favicon/avatar
- `public/favicon.ico` reemplazado

### 2. Sistema de diseño (`src/styles.css`)

Reemplazo total de tokens — adiós al verde:

```text
Paleta:
  ink (negro)        oklch(0.15 0.01 60)   ← brand / botones / texto
  bone (crema)       oklch(0.97 0.008 80)  ← background
  paper (off-white)  oklch(0.99 0.004 80)  ← cards
  ember (acento)     oklch(0.62 0.14 45)   ← cobre cálido sutil
  graphite           oklch(0.45 0.01 60)   ← muted text
  hairline           oklch(0.88 0.005 60)  ← bordes finos
```

Nuevos tokens:
- `--glass-bg`, `--glass-border`, `--glass-blur` para superficies vidrio
- `--shadow-soft`, `--shadow-elegant`, `--shadow-button` (sombras escalonadas)
- `--gradient-mesh` (fondo decorativo con manchas suaves cobre/marfil)

Tipografía:
- Display: **Fraunces** (serif moderno con itálica elegante para énfasis)
- Sans: **Inter Tight** (refinado, mejor que Inter para premium)

### 3. Componentes nuevos / actualizados

**`GlassCard`** (nuevo, `src/components/ui/glass-card.tsx`)
- `backdrop-blur-xl bg-white/60 border border-white/40 shadow-elegant`
- Variantes: `default`, `dark` (sobre hero), `subtle`

**Botones premium** (`src/components/ui/button.tsx` — extiendo variantes)
- `premium`: ink sólido + sombra elevada + hover lift + shimmer al hover
- `glass`: vidrio translúcido con borde 1px + blur
- `ghost-elegant`: subrayado animado al hover
- Pill shape (rounded-full) para CTAs principales

**`MeshBackground`** (nuevo)
- Capa fija con manchas radiales cobre/crema desenfocadas
- Grano sutil overlay para textura premium

**`AppHeader`** (refactor del header en `app.tsx`)
- Sticky glass: `backdrop-blur-xl bg-paper/70 border-b border-hairline`

### 4. Páginas a rediseñar

| Ruta | Cambios |
|---|---|
| `/` (Landing) | Hero con monograma grande, mesh background, glass cards de features, badge "EST. 2026", CTAs pill |
| `/auth` | Card glass centrada sobre mesh, logo arriba, tabs elegantes |
| `/app` (layout) | Header glass sticky, sidebar/tab bar refinada |
| `/app` (home) | Glass cards para acciones rápidas, métricas tipográficas grandes |
| `/app/wallet` | Cards glass, números display grandes, divisores hairline |
| `/app/history` | Lista con bordes hairline, sin fondos pesados |
| `/app/profile` | Form refinado, secciones con divisores |
| `/app/admin` | Tablas con tipografía cuidada |

### 5. Detalles premium

- Bordes `1px hairline` en lugar de `border-2`
- Espaciado más generoso (py-20+ en hero, gap-8 en grids)
- Animaciones `fade-in` + `scale-in` al montar
- Hover lift (`translate-y-[-2px]`) en cards/botones
- Pequeños labels uppercase tracking-widest cobre como acentos

### Notas técnicas

- No se toca lógica de Stripe, auth, mapas ni server functions
- `src/integrations/supabase/*` intacto
- Cambio puramente visual + un nuevo componente (`GlassCard`, `MeshBackground`) y una variante extra de `Button`
- Fuentes vía Google Fonts en `__root.tsx`
- Logo SVG generado a mano (no AI image) para nitidez vectorial perfecta
