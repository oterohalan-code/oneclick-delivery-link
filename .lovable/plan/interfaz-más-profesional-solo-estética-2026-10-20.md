# Interfaz más profesional (solo estética)

Objetivo: elevar el aspecto visual de toda la app sin tocar lógica, flujos, datos, textos funcionales ni comportamiento de botones.

## Qué cambia (lo que verás)
- **Paleta refinada**: azul marino profundo + blanco cálido + naranja de acción más sobrio; grises más neutros y consistentes. Se eliminan los restos de tonos café/cobre mezclados.
- **Tipografía**: títulos con jerarquía más clara (tamaños y pesos consistentes), números con cifras tabulares en montos y métricas.
- **Tarjetas y paneles**: bordes finos, sombras suaves y uniformes, esquinas consistentes, más aire interno.
- **Botones**: alturas y radios uniformes, estados de presión/selección siempre legibles (texto nunca se pierde).
- **Encabezado y barra inferior**: barra superior más limpia; navegación inferior con indicador activo más discreto y mejor legibilidad.
- **Formularios**: campos con foco visible elegante, etiquetas y ayudas alineadas.
- **Estados/insignias**: colores de estado de pedido (buscando, asignado, en camino, entregado, cancelado) unificados.
- **Fondos**: reemplazar degradados decorativos dispersos por un fondo sutil y coherente en todas las pantallas.

## Lo que NO cambia
- Ningún proceso, cálculo, pago, registro, permisos, notificaciones ni navegación.
- Ningún texto de negocio ni precio.

## Detalles técnicos
- Ajustar tokens en `src/styles.css` (colores, sombras, radios, tipografía) y unificar variables antiguas.
- Reemplazar colores hardcodeados (`#B8693A`, `#1A1614`, `bg-white/10`, `accent-[#E45712]`) por tokens en `app.tsx`, `MeshBackground.tsx`, `FlowCard.tsx`, y componentes de features.
- Pulir variantes en `src/components/ui/button.tsx`, `card`, `input`, `badge`.
- Solo `className`/CSS; cero cambios en handlers, hooks, server functions o base de datos.
- Verificación con capturas en móvil y escritorio de landing, auth, inicio restaurante/courier y admin.
