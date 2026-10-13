import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapView } from "@/components/MapView";
import { GlassCard } from "@/components/ui/glass-card";
import { MeshBackground } from "@/components/MeshBackground";
import { Logo } from "@/components/Logo";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, MapPin, Package, Bike, Clock, Star, Timer, Navigation } from "lucide-react";
import { formatEta, timeAgo } from "@/lib/eta";
import { googleMapsPlaceUrl } from "@/lib/maps";

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
      <header className="px-4 sm:px-6 py-4 flex items-center justify-between">
        <Logo />
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Tracking</span>
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

  return (
    <div className="space-y-4">
      <GlassCard variant="strong" className="p-5 spring-in">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {data.restaurant_name ?? "Tu pedido"}
            </p>
            <h1 className="text-2xl font-semibold mt-1">
              {isDelivered ? "¡Entregado!" : STATUS_STEPS[stepIndex].label}
            </h1>
          </div>
          {!isDelivered && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/40 px-2 py-1 rounded-full">
              <Clock className="h-3 w-3" /> En vivo
            </div>
          )}
        </div>

        {/* Step indicator */}
        <div className="mt-5 flex items-center gap-2">
          {STATUS_STEPS.map((step, i) => {
            const Icon = step.icon;
            const active = i <= stepIndex;
            const current = i === stepIndex && !isDelivered;
            return (
              <div key={step.key} className="flex-1 flex flex-col items-center gap-1.5">
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center transition-all ${
                    active
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-muted text-muted-foreground"
                  } ${current ? "ring-4 ring-primary/20 animate-pulse" : ""}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span
                  className={`text-[10px] text-center leading-tight ${
                    active ? "text-foreground font-medium" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* ETA + Courier card — solo cuando hay courier asignado y no entregado */}
      {!isDelivered && stepIndex >= 1 && (data.courier_name || data.eta_minutes != null) && (
        <GlassCard variant="strong" className="p-5 spring-in">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Tu courier</p>
              <p className="font-semibold mt-1 truncate">🛵 {data.courier_name ?? "En camino"}</p>
              {data.courier_score != null && data.courier_score > 0 && (
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-warning text-warning" />
                  <span className="font-medium text-foreground">{Number(data.courier_score).toFixed(1)}</span>
                  <span>/ 100</span>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">
                Última señal {timeAgo(data.location_updated_at)}
              </p>
            </div>
            {data.eta_minutes != null && (
              <div className="text-right shrink-0">
                <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                  <Timer className="h-3 w-3" /> ETA
                </div>
                <p className="font-display text-2xl font-bold text-primary leading-tight mt-0.5">
                  {formatEta(data.eta_minutes)}
                </p>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      <GlassCard variant="strong" className="p-2 overflow-hidden">
        <MapView pins={pins} showRoute={pins.length >= 2} height="320px" />
      </GlassCard>

      <GlassCard variant="strong" className="p-5 space-y-3">
        <Row
          icon={MapPin}
          label="Recogida"
          value={data.pickup_address}
          mapsUrl={googleMapsPlaceUrl({
            lat: data.pickup_lat, lng: data.pickup_lng, address: data.pickup_address,
          })}
        />
        <Row
          icon={MapPin}
          label="Entrega"
          value={data.dropoff_address}
          mapsUrl={googleMapsPlaceUrl({
            lat: data.dropoff_lat, lng: data.dropoff_lng, address: data.dropoff_address,
          })}
        />
      </GlassCard>

      <p className="text-center text-xs text-muted-foreground pt-2">
        Powered by <span className="font-semibold text-foreground">1Click</span> · Actualiza cada 10s
      </p>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  mapsUrl,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  mapsUrl?: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="text-sm mt-0.5 truncate">{value}</p>
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-primary hover:underline"
          >
            <Navigation className="h-3 w-3" /> Abrir en Google Maps
          </a>
        )}
      </div>
    </div>
  );
}
