import { createFileRoute, Link } from "@tanstack/react-router";
import { RoleGuide } from "@/features/onboarding/RoleGuide";
import { BUSINESS, formatMxn } from "@/lib/business";

export const Route = createFileRoute("/repartidor")({
  head: () => ({
    meta: [
      { title: "Repartidores — 1Click" },
      { name: "description", content: "Cómo trabaja un repartidor en Manzanillo y cuánto gana por envío." },
    ],
  }),
  component: CourierGuidePage,
});

function CourierGuidePage() {
  return (
    <RoleGuide
      eyebrow="Para repartidores"
      title="Cobras el envío. La comida la adelantas y la recuperas en la entrega."
      lede="Ves la oferta, aceptas y haces dos recorridos: al restaurante y a la casa del cliente."
      steps={[
        "Te das de alta y activas la membresía.",
        "Aceptas la oferta. Ahí ves cuánto adelantas, cuánto cobras y cuánto es tu envío.",
        "Vas al restaurante, recibes la comida y dejas el efectivo de la comida.",
        "Abres la liga de la casa y llevas el pedido.",
        "Cobras al cliente la comida más el envío. El envío es tu pago.",
      ]}
      feeLead="Tu pago es la tarifa de envío. La comida no es ganancia: la dejas en el restaurante y la cobras de nuevo en la casa."
      membership={`La membresía del repartidor es ${formatMxn(BUSINESS.membership.courierMonthlyMxn)} al mes. Sin ella no se pueden aceptar pedidos.`}
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
