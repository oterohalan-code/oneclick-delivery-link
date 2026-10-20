import { createFileRoute, Link } from "@tanstack/react-router";
import { RoleGuide } from "@/features/onboarding/RoleGuide";
import { BUSINESS, formatMxn } from "@/lib/business";

export const Route = createFileRoute("/repartidor")({
  head: () => ({
    meta: [
      { title: "Repartidores — 1Click" },
      { name: "description", content: `Gana el 100% de cada envío en Manzanillo. Membresía ${formatMxn(BUSINESS.membership.courierMonthlyMxn)} al mes.` },
      { property: "og:title", content: "Repartidores — 1Click" },
      { property: "og:description", content: "Gana el 100% de cada envío en Manzanillo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CourierGuidePage,
});

function CourierGuidePage() {
  return (
    <RoleGuide
      eyebrow="Para repartidores"
      title="Cada envío es 100% tuyo."
      lede="Recibe ofertas de restaurantes cercanos, acepta las que te convienen y cobra la tarifa completa. Sin comisiones por pedido: solo una membresía fija al mes."
      steps={[
        "Te das de alta y activas la membresía.",
        "Aceptas la oferta. Ahí ves si la comida ya está pagada o se cobra en domicilio, y cuánto es tu envío.",
        "Vas al restaurante y recoges la comida. Si se paga en domicilio, dejas el efectivo de la comida.",
        "Abres la liga de la casa y llevas el pedido.",
        "Si se paga en domicilio, cobras al cliente la comida más el envío. El envío es tu pago.",
      ]}
      feeLead="Tu pago es la tarifa de envío. El cobro de la comida es del restaurante, no de la plataforma: la comida no es ganancia."
      membership={{
        priceMxn: BUSINESS.membership.courierMonthlyMxn,
        note: "Pago fijo mensual. Sin ella no se pueden aceptar pedidos.",
        benefits: [
          "100% de la tarifa de envío para ti",
          "Recargos de hora pico y fin de semana incluidos",
          "Pedidos ilimitados en tu zona",
          "Rutas con mapa y soporte directo",
        ],
      }}
      cta="Iniciar alta de repartidor"
      role="courier"
      extra={
        <Link to="/repartidor/ejemplo" className="block text-center text-sm text-primary">
          Probar un pedido de ejemplo
        </Link>
      }
    />
  );
}
