import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, DollarSign, AlertCircle, Truck, CheckCircle2, Wallet, Crown, MessageCircle } from "lucide-react";
import { CourierOnboarding } from "./CourierOnboarding";
import { DeliveryProofDialog } from "./DeliveryProofDialog";
import { MapView, haversine } from "@/components/MapView";
import { OrderChat } from "@/components/OrderChat";
import { acceptOrder as acceptOrderFn } from "@/server/orders.functions";
import { useCourierLocationTracker } from "@/hooks/useCourierLocationTracker";
import { LocationPermissionGate } from "@/components/LocationPermissionGate";
import { toast } from "sonner";

interface Courier {
  id: string; status: string; plan: "pps" | "subscription"; wallet_balance: number;
  subscription_active: boolean; subscription_expires_at: string | null;
  lat: number | null; lng: number | null;
  ine_front_url: string | null; ine_back_url: string | null; license_url: string | null; circulation_url: string | null;
}

interface OrderRow {
  id: string; status: string;
  pickup_address: string; pickup_lat: number | null; pickup_lng: number | null;
  dropoff_address: string; dropoff_lat: number | null; dropoff_lng: number | null;
  amount_to_collect: number; external_order_id: string | null; notes: string | null;
  customer_name: string | null; customer_phone: string | null;
  shipping_fee: number; distance_km: number | null;
  restaurant_id: string; courier_id: string | null; created_at: string;
}

export function CourierHome() {
  const { user, session } = useAuth();
  const acceptOrderRpc = useServerFn(acceptOrderFn);
  const [courier, setCourier] = useState<Courier | null>(null);
  const [feed, setFeed] = useState<OrderRow[]>([]);
  const [active, setActive] = useState<OrderRow | null>(null);
  const [restaurants, setRestaurants] = useState<Record<string, { name: string; phone: string }>>({});
  const [loading, setLoading] = useState(true);

  // Geolocalización cada 3 min cuando el repartidor está activo
  const { permission: geoPermission, refreshPermission } = useCourierLocationTracker({
    enabled: courier?.status === "active",
    courierId: courier?.id,
  });

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

  // Realtime: solo si está activo Y tiene saldo/sub (puede recibir pedidos)
  const subActiveRT = courier?.subscription_active && courier?.subscription_expires_at && new Date(courier.subscription_expires_at) > new Date();
  const canAcceptRT = !!subActiveRT || (Number(courier?.wallet_balance ?? 0) >= 5);
  useEffect(() => {
    if (!courier || courier.status !== "active" || !canAcceptRT) return;
    const ch = supabase.channel(`courier-${courier.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: "status=eq.pending" }, () => {
        toast.info("📦 Nuevo pedido disponible");
        load();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [courier?.id, courier?.status, canAcceptRT]);

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!courier) return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  // 1) Si fue rechazado, dejarlo volver a subir documentos
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

  // 2) Si le faltan documentos clave, mostrar onboarding (independiente del status)
  if (!courier.ine_front_url || !courier.ine_back_url || !courier.license_url || !courier.circulation_url) {
    return <CourierOnboarding existing={false} onDone={load} />;
  }

  // 3) Ya subió todo pero quedó en revisión manual
  if (courier.status === "pending_validation") {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="h-12 w-12 text-warning mx-auto mb-3" />
        <h2 className="font-display text-xl font-bold">¡Registro en proceso!</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
          Algunos de tus documentos necesitan revisión manual. Recibirás una notificación push cuando seas activado.
        </p>
      </Card>
    );
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

      {geoPermission !== "granted" && (
        <LocationPermissionGate
          permission={geoPermission}
          reason="La usamos para mostrarte pedidos cercanos, asignarte rutas óptimas y verificar tu llegada al punto de entrega."
          onGranted={refreshPermission}
        />
      )}

      {!canAccept ? (
        <Card className="p-6 bg-warning/10 border-warning text-center space-y-3">
          <AlertCircle className="h-10 w-10 text-warning mx-auto" />
          <div>
            <h3 className="font-display text-lg font-bold">No puedes recibir pedidos</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
              Necesitas <strong>$5 MXN</strong> de saldo o una <strong>suscripción activa</strong> para empezar a repartir.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button asChild variant="secondary" className="h-12">
              <Link to="/app/wallet"><Wallet className="mr-1 h-4 w-4" /> Recargar</Link>
            </Button>
            <Button asChild className="h-12">
              <Link to="/app/wallet"><Crown className="mr-1 h-4 w-4" /> Suscribirme</Link>
            </Button>
          </div>
        </Card>
      ) : (
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
                  {o.customer_name && (
                    <div className="text-sm mt-1">👤 <span className="font-medium">{o.customer_name}</span></div>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <div className="text-sm flex items-center gap-1"><DollarSign className="h-4 w-4 text-success" /> ${Number(o.amount_to_collect).toFixed(2)}</div>
                    <Button size="sm" onClick={() => onAccept(o.id)}>
                      Aceptar
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  function onAccept(orderId: string) {
    const token = session?.access_token;
    if (!token) { toast.error("Sesión expirada."); return; }
    acceptOrderRpc({
      headers: { Authorization: `Bearer ${token}` },
      data: { orderId },
    }).then((res: any) => {
      if (!res?.ok) return toast.error(res?.message ?? "No se pudo aceptar el pedido.");
      toast.success("¡Pedido aceptado!");
      load();
    }).catch(async (e: any) => {
      const msg = e instanceof Response ? await e.text().catch(() => "Error") : (e?.message ?? "Error");
      toast.error(msg);
    });
  }
}


function ActiveOrderView({ order, restaurant, courier, onChange }: {
  order: OrderRow; restaurant?: { name: string; phone: string }; courier: Courier; onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);

  const goInTransit = async () => {
    setBusy(true);
    const { error } = await supabase.from("orders").update({ status: "in_transit" }).eq("id", order.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    onChange();
  };

  const finalizeDelivery = async (proofPath: string, lat: number, lng: number): Promise<void> => {
    const { error } = await supabase.from("orders").update({
      status: "delivered",
      delivered_at: new Date().toISOString(),
      delivery_proof_url: proofPath,
      delivered_lat: lat,
      delivered_lng: lng,
    }).eq("id", order.id);
    if (error) { toast.error(error.message); return; }

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
        {order.customer_name && (
          <div className="text-sm">👤 Cliente: <strong>{order.customer_name}</strong></div>
        )}
        {order.customer_phone && (
          <a
            href={`https://wa.me/${order.customer_phone.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-success hover:underline"
          >
            📱 WhatsApp cliente: {order.customer_phone}
          </a>
        )}
        <div className="text-sm">💵 Cobrar al cliente: <strong>${Number(order.amount_to_collect).toFixed(2)}</strong></div>
        {order.notes && <div className="text-sm bg-muted p-2 rounded">📝 {order.notes}</div>}
      </Card>

      <div className="h-72">
        <MapView pins={pins} showRoute height="100%" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {order.status === "assigned" && (
          <Button onClick={goInTransit} disabled={busy} className="col-span-2 h-12">
            <Truck className="mr-2 h-4 w-4" /> En camino
          </Button>
        )}
        {order.status === "in_transit" && (
          <Button onClick={() => setProofOpen(true)} className="col-span-2 h-12">
            <CheckCircle2 className="mr-2 h-4 w-4" /> Finalizar entrega
          </Button>
        )}
      </div>

      <DeliveryProofDialog
        open={proofOpen}
        onOpenChange={setProofOpen}
        order={order}
        courierId={courier.id}
        onDelivered={finalizeDelivery}
      />
    </div>
  );
}
