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
        "Tú pides el repartidor. Él te deja el efectivo de la comida al recoger.",
        "Mandas la liga del local y después la liga de la casa.",
        "El repartidor cobra al cliente la comida y el envío.",
      ]}
      feeLead="El envío lo paga el cliente al recibir y se queda el repartidor. 1Click no cobra comisión por la comida."
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
