import { createFileRoute } from "@tanstack/react-router";
import { RestaurantOrderBoard, type RestaurantBoardOrder } from "@/features/restaurant/RestaurantOrderBoard";
import { RestaurantProfile } from "@/features/restaurant/PublicDirectory";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/flujo")({
  head: () => ({
    meta: [
      { title: "Flujo de un pedido — 1Click" },
      { name: "description", content: "Así se ve un pedido de 1Click paso a paso, del restaurante a la entrega." },
      { property: "og:title", content: "Flujo de un pedido — 1Click" },
      { property: "og:description", content: "Así se ve un pedido de 1Click paso a paso, del restaurante a la entrega." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FlowPreview,
});

const sample: RestaurantBoardOrder = {
  id: "ejemplo-1042",
  external_order_id: "1042",
  status: "pending",
  customer_name: "Ana M.",
  customer_phone: "3141234567",
  pickup_address: "Cocina del Puerto, Manzanillo",
  pickup_lat: 19.105,
  pickup_lng: -104.318,
  dropoff_address: "Dirección del cliente",
  dropoff_lat: 19.113,
  dropoff_lng: -104.33,
  amount_to_collect: 300,
  shipping_fee: 50,
  food_amount_cents: 25000,
  shipping_amount_cents: 5000,
  payment_mode: "collect_on_delivery",
};

const steps = ["pending", "assigned", "in_transit", "delivered"] as const;

function FlowPreview() {
  return (
    <div className="min-h-screen bg-bone text-ink">
      <header className="bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Logo size="sm" tone="bone" />
          <span className="text-sm">Datos de ejemplo</span>
        </div>
      </header>
      <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <RestaurantProfile
          demo
          place={{
            id: "ejemplo",
            name: "Cocina del Puerto",
            category: "Mariscos",
            address: "Salagua, Manzanillo",
            phone: "3140001122",
            hours: "Lun a Dom 10:00–22:00",
            logo_url: null,
            facade_url: null,
            menu: [
              { name: "Aguachile", price: 180, description: "Camarón fresco", image: "" },
              { name: "Pescado zarandeado", price: 220, description: "A las brasas", image: "" },
            ],
          }}
        />
        <div>
          <h1 className="text-2xl font-semibold">Un pedido en efectivo</h1>
          <p className="mt-1 text-sm text-graphite">
            El restaurante pide, manda la liga del local y después la del domicilio. Nada de esto es un pedido real.
          </p>
        </div>
        {steps.map((status) => (
          <RestaurantOrderBoard
            key={status}
            order={{ ...sample, id: `ejemplo-${status}`, status }}
            restaurantName="Cocina del Puerto"
            courierName={status === "pending" ? null : "Luis M."}
            courierPhone={status === "pending" ? null : "3140001122"}
            persist={false}
          />
        ))}
      </main>
    </div>
  );
}
