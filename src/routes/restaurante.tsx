import { createFileRoute } from "@tanstack/react-router";
import { RoleGuide } from "@/features/onboarding/RoleGuide";
import { BUSINESS, formatMxn } from "@/lib/business";

export const Route = createFileRoute("/restaurante")({
  head: () => ({
    meta: [
      { title: "Restaurantes — 1Click" },
      { name: "description", content: "Cómo pide un restaurante un repartidor en Manzanillo y cuánto cuesta." },
    ],
  }),
  component: RestaurantGuidePage,
});

function RestaurantGuidePage() {
  return (
    <RoleGuide
      eyebrow="Para restaurantes"
      title="Pide un repartidor sin soltar el precio de tu comida."
      lede="1Click lleva el pedido. El dinero de la comida es tuyo. El envío es del repartidor."
      steps={[
        "Das de alta el local, el menú y las fotos.",
        "El cliente arma su pedido y pega la liga de Google Maps de su casa.",
        "Tú pides el repartidor. Él te deja el efectivo de la comida al recoger.",
        "Mandas la liga del local y después la liga de la casa.",
        "El repartidor cobra al cliente la comida y el envío.",
      ]}
      feeLead="El envío lo paga el cliente al recibir y se queda el repartidor. 1Click no cobra comisión por la comida."
      membership={`La membresía del restaurante es ${formatMxn(BUSINESS.membership.restaurantMonthlyMxn)} al mes. Sin ella no se puede pedir repartidor.`}
      cta="Iniciar alta de restaurante"
      role="restaurant"
    />
  );
}
