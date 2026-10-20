import { createFileRoute } from "@tanstack/react-router";
import { RoleGuide } from "@/features/onboarding/RoleGuide";
import { BUSINESS, formatMxn } from "@/lib/business";

export const Route = createFileRoute("/restaurante")({
  head: () => ({
    meta: [
      { title: "Restaurantes — 1Click" },
      { name: "description", content: `Repartidores verificados en Manzanillo sin comisión por tu comida. Membresía ${formatMxn(BUSINESS.membership.restaurantMonthlyMxn)} al mes.` },
      { property: "og:title", content: "Restaurantes — 1Click" },
      { property: "og:description", content: "Repartidores verificados sin comisión por tu comida." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RestaurantGuidePage,
});

function RestaurantGuidePage() {
  return (
    <RoleGuide
      eyebrow="Para restaurantes"
      title="Tus envíos, sin regalar tu ganancia."
      lede="Publica tu menú, recibe pedidos y pide un repartidor verificado en un clic. El 100% del precio de tu comida es tuyo: 1Click no cobra comisión por platillo."
      steps={[
        "Das de alta el local, el menú y las fotos.",
        "El cliente arma su pedido y pega la liga de Google Maps de su casa.",
        "Al pedir el repartidor eliges cómo se paga la comida: el cliente ya te pagó en el restaurante, o paga en su domicilio.",
        "Si el cliente ya te pagó, tú le pagas el envío al repartidor cuando recoge el pedido.",
        "Si paga en domicilio, el repartidor te deja el efectivo de la comida al recoger y lo cobra al cliente en la entrega.",
        "Sigues el pedido en vivo hasta que se entrega.",
      ]}
      feeLead="El cobro de la comida lo hace tu restaurante directamente, no la plataforma. Si el cliente paga en domicilio, el envío lo cobra el repartidor al cliente. Si el cliente te pagó en el restaurante, tú le pagas el envío al repartidor."
      membership={{
        priceMxn: BUSINESS.membership.restaurantMonthlyMxn,
        note: "Pago fijo mensual. Sin ella no se puede pedir repartidor.",
        benefits: [
          "0% de comisión sobre tu comida",
          "Pedidos ilimitados de repartidor",
          "Menú y perfil en el directorio público",
          "Rastreo en vivo para tus clientes",
        ],
      }}
      cta="Iniciar alta de restaurante"
      role="restaurant"
    />
  );
}
