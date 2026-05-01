import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, DollarSign, AlertCircle, Truck, CheckCircle2, Wallet, Crown } from "lucide-react";
import { CourierOnboarding } from "./CourierOnboarding";
import { MapView, haversine } from "@/components/MapView";
import { acceptOrder as acceptOrderFn } from "@/server/orders.functions";
import { toast } from "sonner";

interface Courier {
  id: string; status: string; plan: "pps" | "subscription"; wallet_balance: number;
  subscription_active: boolean; subscription_expires_at: string | null;
  lat: number | null; lng: number | null;
  ine_front_url: string | null; license_url: string | null; circulation_url: string | null;
}

interface OrderRow {
  id: string; status: string;
  pickup_address: string; pickup_lat: number | null; pickup_lng: number | null;
  dropoff_address: string; dropoff_lat: number | null; dropoff_lng: number | null;
  amount_to_collect: number; external_order_id: string | null; notes: string | null;
  restaurant_id: string; courier_id: string | null; created_at: string;
}

export function CourierHome() {
  const { user } = useAuth();
  const [courier, setCourier] = useState<Courier | null>(null);
  const [feed, setFeed] = useState<OrderRow[]>([]);
  const [active, setActive] = useState<OrderRow | null>(null);
  const [restaurants, setRestaurants] = useState<Record<string, { name: string; phone: string }>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data: c } = await supabase.from("couriers").select("*").eq("user_id", user.id).maybeSingle();
    setCourier(c as any);

    if (c && (c as any).status === "active") {
      const { data: a } = await supabase.from("orders").select("*")
        .eq("courier_id", (c as any).id).in("status", ["assigned", "in_transit"])
        .order("accepted_at", { ascending: false }).limit(1).maybeSingle();
      setActive(a as any);

      const { data: pend } = await supabase.from("orders").select("*")
        .eq("status", "pending").order("created_at", { ascending: false }).limit(30);
      setFeed((pend as any) ?? []);

      const ids = Array.from(new Set([...(pend ?? []).map((o: any) => o.restaurant_id), ...(a ? [(a as any).restaurant_id] : [])]));
      if (ids.length) {
        const { data: rs } = await supabase.from("restaurants").select("id,name,phone").in("id", ids);
        const map: Record<string, any> = {};
        (rs ?? []).forEach((r: any) => { map[r.id] = { name: r.name, phone: r.phone }; });
        setRestaurants(map);
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  // Realtime: nuevos pedidos pending y cambios en mi pedido activo
  useEffect(() => {
    if (!courier || courier.status !== "active") return;
    const ch = supabase.channel(`courier-${courier.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: "status=eq.pending" }, () => {
        toast.info("📦 Nuevo pedido disponible");
        load();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [courier?.id, courier?.status]);

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!courier) return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (courier.status === "pending_validation") {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="h-12 w-12 text-warning mx-auto mb-3" />
        <h2 className="font-display text-xl font-bold">¡Registro en proceso!</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
          Nuestro sistema y equipo están validando tus datos. Recibirás una notificación push cuando seas activado.
        </p>
      </Card>
    );
  }
  if (courier.status === "rejected") {
    return (
      <Card className="p-6 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
        <h2 className="font-display text-xl font-bold">Solicitud rechazada</h2>
        <p className="text-sm text-muted-foreground mt-2">Tu solicitud fue rechazada. Vuelve a subir tus documentos.</p>
        <CourierOnboarding existing onDone={load} />
      </Card>
    );
  }
  // Si no ha completado onboarding (le faltan documentos clave)
  if (!courier.ine_front_url || !courier.license_url || !courier.circulation_url) {
    return <CourierOnboarding existing={false} onDone={load} />;
  }

  const subActive = courier.subscription_active && courier.subscription_expires_at && new Date(courier.subscription_expires_at) > new Date();
  const canAccept = subActive || courier.wallet_balance >= 5;

  if (active) return <ActiveOrderView order={active} restaurant={restaurants[active.restaurant_id]} courier={courier} onChange={load} />;

  // Sort feed by distance from courier (si tiene ubicación)
  const sorted = feed
    .filter((o) => o.pickup_lat != null && o.pickup_lng != null)
    .map((o) => ({
      o,
      dist: courier.lat != null && courier.lng != null
        ? haversine({ lat: courier.lat, lng: courier.lng }, { lat: o.pickup_lat!, lng: o.pickup_lng! })
        : 0,
    }))
    .sort((a, b) => a.dist - b.dist);

  return (
    <div className="space-y-4">
      <Card className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Saldo monedero</p>
          <p className="font-display text-2xl font-bold">${Number(courier.wallet_balance).toFixed(2)}</p>
        </div>
        <Badge className={subActive ? "bg-success/20 text-success-foreground" : "bg-accent text-accent-foreground"}>
          {subActive ? "Suscripción activa" : "Plan PPS"}
        </Badge>
      </Card>

      {!canAccept && (
        <Card className="p-4 bg-warning/10 border-warning">
          <div className="flex gap-2">
            <AlertCircle className="h-5 w-5 text-warning shrink-0" />
            <div className="text-sm">
              <strong>Saldo insuficiente.</strong> Recarga al menos $5 MXN o activa la suscripción para aceptar pedidos.
            </div>
          </div>
        </Card>
      )}

      <div>
        <h3 className="font-display text-lg font-semibold mb-3">Pedidos disponibles ({sorted.length})</h3>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay pedidos por ahora. Te avisaremos al instante.</p>
        ) : (
          <div className="space-y-3">
            {sorted.map(({ o, dist }) => (
              <Card key={o.id} className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-semibold">{restaurants[o.restaurant_id]?.name ?? "Restaurante"}</div>
                  <Badge variant="secondary">{dist.toFixed(1)} km</Badge>
                </div>
                <div className="text-sm text-muted-foreground flex gap-1 items-start"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {o.pickup_address}</div>
                <div className="text-sm text-muted-foreground flex gap-1 items-start mt-1"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" /> {o.dropoff_address}</div>
                <div className="flex items-center justify-between mt-3">
                  <div className="text-sm flex items-center gap-1"><DollarSign className="h-4 w-4 text-success" /> ${Number(o.amount_to_collect).toFixed(2)}</div>
                  <Button size="sm" disabled={!canAccept} onClick={() => acceptOrder(o.id, courier.id, load)}>
                    Aceptar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

async function acceptOrder(orderId: string, courierId: string, reload: () => void) {
  const { data, error } = await supabase
    .from("orders")
    .update({ courier_id: courierId, status: "assigned", accepted_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "pending")
    .select().maybeSingle();
  if (error) return toast.error(error.message);
  if (!data) return toast.error("Otro repartidor ya tomó el pedido");
  toast.success("¡Pedido aceptado!");
  reload();
}

function ActiveOrderView({ order, restaurant, courier, onChange }: {
  order: OrderRow; restaurant?: { name: string; phone: string }; courier: Courier; onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const setStatus = async (next: "in_transit" | "delivered") => {
    setBusy(true);
    const updates: any = { status: next };
    if (next === "delivered") updates.delivered_at = new Date().toISOString();
    const { error } = await supabase.from("orders").update(updates).eq("id", order.id);
    if (error) { setBusy(false); return toast.error(error.message); }

    if (next === "delivered") {
      // PPS charge if no active subscription
      const subActive = courier.subscription_active && courier.subscription_expires_at && new Date(courier.subscription_expires_at) > new Date();
      if (!subActive) {
        const newBal = Number(courier.wallet_balance) - 5;
        await supabase.from("couriers").update({ wallet_balance: newBal }).eq("id", courier.id);
        await supabase.from("wallet_transactions").insert({
          courier_id: courier.id, type: "order_fee", amount: -5, balance_after: newBal,
          order_id: order.id, description: "Comisión por entrega",
        });
        toast.success(`Entregado. Se descontaron $5 (saldo: $${newBal.toFixed(2)})`);
      } else {
        toast.success("Pedido entregado ✅");
      }
    }
    setBusy(false);
    onChange();
  };

  const pins = [
    ...(order.pickup_lat && order.pickup_lng ? [{ lat: order.pickup_lat, lng: order.pickup_lng, label: "Recogida" }] : []),
    ...(order.dropoff_lat && order.dropoff_lng ? [{ lat: order.dropoff_lat, lng: order.dropoff_lng, label: "Entrega" }] : []),
  ];

  return (
    <div className="space-y-4">
      <Badge className="bg-primary text-primary-foreground">Pedido activo</Badge>
      <Card className="p-4 space-y-2">
        <div className="font-display text-lg font-bold">{restaurant?.name ?? "Restaurante"}</div>
        <div className="text-sm">📞 {restaurant?.phone}</div>
        <div className="text-sm text-muted-foreground"><MapPin className="inline h-3.5 w-3.5" /> Recoger: {order.pickup_address}</div>
        <div className="text-sm text-muted-foreground"><MapPin className="inline h-3.5 w-3.5 text-primary" /> Entregar: {order.dropoff_address}</div>
        <div className="text-sm">💵 Cobrar al cliente: <strong>${Number(order.amount_to_collect).toFixed(2)}</strong></div>
        {order.notes && <div className="text-sm bg-muted p-2 rounded">📝 {order.notes}</div>}
      </Card>

      <div className="h-72">
        <MapView pins={pins} showRoute height="100%" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {order.status === "assigned" && (
          <Button onClick={() => setStatus("in_transit")} disabled={busy} className="col-span-2">
            <Truck className="mr-2 h-4 w-4" /> En camino
          </Button>
        )}
        {order.status === "in_transit" && (
          <Button onClick={() => setStatus("delivered")} disabled={busy} className="col-span-2">
            <CheckCircle2 className="mr-2 h-4 w-4" /> Marcar entregado
          </Button>
        )}
      </div>
    </div>
  );
}
