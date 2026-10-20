import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapView } from "@/components/MapView";
import { GlassCard } from "@/components/ui/glass-card";
import { MeshBackground } from "@/components/MeshBackground";
import { Logo } from "@/components/Logo";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, MapPin, Package, Bike } from "lucide-react";
import { formatEta, timeAgo } from "@/lib/eta";
import { googleMapsPlaceUrl } from "@/lib/maps";
import { formatMxn } from "@/lib/business";

export const Route = createFileRoute("/t/$token")({
  head: () => ({
    meta: [
      { title: "Sigue tu pedido — 1Click" },
      { name: "description", content: "Rastrea tu pedido en tiempo real." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TrackingPage,
});

type Tracking = {
  status: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  courier_lat: number | null;
  courier_lng: number | null;
  restaurant_name: string | null;
  created_at: string;
  accepted_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  eta_minutes: number | null;
  location_updated_at: string | null;
  courier_name: string | null;
  courier_score: number | null;
  restaurant_phone?: string | null;
  food_mxn?: number | null;
  shipping_mxn?: number | null;
  total_mxn?: number | null;
};

const STATUS_STEPS = [
  { key: "pending", label: "Pedido recibido", icon: Package },
  { key: "assigned", label: "Courier asignado", icon: Bike },
  { key: "in_transit", label: "En camino", icon: MapPin },
  { key: "delivered", label: "Entregado", icon: CheckCircle2 },
] as const;

function statusIndex(status: string) {
  const i = STATUS_STEPS.findIndex((s) => s.key === status);
  return i === -1 ? 0 : i;
}

function TrackingPage() {
  const { token } = Route.useParams();
  const [data, setData] = useState<Tracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: rows, error } = await supabase.rpc("get_public_tracking", { _token: token });
      if (!active) return;
      if (error || !rows || rows.length === 0) {
        setNotFound(true);
      } else {
        setData(rows[0] as Tracking);
        setNotFound(false);
      }
      setLoading(false);
    }
    load();
    const id = setInterval(load, 10_000); // 10s live polling
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [token]);

  return (
    <div className="relative min-h-dvh">
      <MeshBackground />
      <header className="bg-navy px-4 py-4 text-navy-foreground sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Logo tone="bone" size="sm" />
          <span className="text-xs uppercase tracking-widest text-navy-foreground/70">Tu pedido</span>
        </div>
      </header>

      <main className="px-4 sm:px-6 pb-12 max-w-2xl mx-auto">
        {loading && (
          <GlassCard variant="strong" className="p-6">
            <Skeleton className="h-6 w-40 mb-4" />
            <Skeleton className="h-64 w-full mb-4" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </GlassCard>
        )}

        {!loading && notFound && (
          <GlassCard variant="strong" className="p-8 text-center">
            <div className="text-5xl mb-3">🔍</div>
            <h1 className="text-xl font-semibold mb-2">Enlace no válido</h1>
            <p className="text-muted-foreground text-sm">
              Este enlace de seguimiento no existe o expiró. Verifica con el restaurante.
            </p>
          </GlassCard>
        )}

        {!loading && data && <TrackingContent data={data} />}
      </main>
    </div>
  );
}

function TrackingContent({ data }: { data: Tracking }) {
  const stepIndex = statusIndex(data.status);
  const isDelivered = data.status === "delivered";

  const pins = [];
  if (data.pickup_lat && data.pickup_lng) {
    pins.push({ lat: data.pickup_lat, lng: data.pickup_lng, label: data.restaurant_name ?? "Restaurante" });
  }
  if (data.dropoff_lat && data.dropoff_lng) {
    pins.push({ lat: data.dropoff_lat, lng: data.dropoff_lng, label: "Destino" });
  }
  if (data.courier_lat && data.courier_lng && !isDelivered && stepIndex >= 1) {
    pins.push({ lat: data.courier_lat, lng: data.courier_lng, label: "🛵 Courier" });
  }

  const homeMaps = googleMapsPlaceUrl({
    lat: data.dropoff_lat,
    lng: data.dropoff_lng,
    address: data.dropoff_address,
  });
  const phoneDigits = (data.restaurant_phone ?? "").replace(/\D/g, "");
  const restaurantWa = phoneDigits
    ? `https://wa.me/${phoneDigits.length === 10 ? `52${phoneDigits}` : phoneDigits}`
    : null;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <section className="rounded-2xl border border-hairline bg-white p-4">
        <p className="text-sm text-graphite">{data.restaurant_name ?? "Tu pedido"}</p>
        <h1 className="mt-1 text-2xl font-semibold">
          {isDelivered ? "Pedido entregado" : STATUS_STEPS[stepIndex].label}
        </h1>
        {isDelivered ? (
          <p className="mt-3 rounded-xl alert-success px-3 py-3 text-sm">
            Entrega registrada por el repartidor
          </p>
        ) : (
          <p className="mt-2 text-sm text-graphite">
            {data.courier_name ? `${data.courier_name} lleva tu pedido.` : "Estamos buscando repartidor."}
            {data.eta_minutes != null ? ` Llega en ${formatEta(data.eta_minutes)}.` : ""}
            {data.location_updated_at ? ` Última señal ${timeAgo(data.location_updated_at)}.` : ""}
          </p>
        )}
      </section>

      {(data.food_mxn != null || data.total_mxn != null) && (
        <section className="rounded-2xl border border-hairline bg-white p-4 text-sm">
          <div className="flex justify-between py-1"><span>Comida</span><span>{formatMxn(Number(data.food_mxn ?? 0))}</span></div>
          <div className="flex justify-between py-1 text-graphite"><span>Envío</span><span>{formatMxn(Number(data.shipping_mxn ?? 0))}</span></div>
          <div className="mt-2 flex justify-between border-t border-hairline pt-2 font-semibold"><span>Total</span><span>{formatMxn(Number(data.total_mxn ?? 0))}</span></div>
          {isDelivered && <p className="mt-3 rounded-xl alert-success px-3 py-2">Cobro confirmado por el repartidor</p>}
        </section>
      )}

      {!isDelivered && homeMaps && (
        <a href={homeMaps} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-hairline bg-white px-4 py-3 text-center text-sm font-semibold text-primary">
          Seguir recorrido en Google Maps
        </a>
      )}

      {restaurantWa && (
        <a href={restaurantWa} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-primary px-4 py-3 text-center text-sm font-semibold text-primary">
          Contactar restaurante
        </a>
      )}

      {!isDelivered && pins.length > 0 && (
        <div className="h-56 overflow-hidden rounded-2xl">
          <MapView pins={pins} showRoute={pins.length >= 2} height="100%" />
        </div>
      )}
    </div>
  );
}
