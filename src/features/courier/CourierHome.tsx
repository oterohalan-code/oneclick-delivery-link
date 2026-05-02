import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, DollarSign, AlertCircle, Truck, CheckCircle2, Wallet, Crown, MessageCircle, Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { CourierOnboarding } from "./CourierOnboarding";
import { DeliveryProofDialog } from "./DeliveryProofDialog";
import { MapView, haversine } from "@/components/MapView";
import { OrderChat } from "@/components/OrderChat";
import { acceptOrder as acceptOrderFn, setOrderStatus as setOrderStatusFn } from "@/server/orders.functions";
import { updateOrderEta as updateOrderEtaFn, acceptOrderBatch as acceptOrderBatchFn } from "@/server/intelligence.functions";
import { useCourierLocationTracker } from "@/hooks/useCourierLocationTracker";
import { LocationPermissionGate } from "@/components/LocationPermissionGate";
import { enablePush } from "@/lib/push";
import { fetchEtaMinutes, formatEta } from "@/lib/eta";
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
  const acceptBatchRpc = useServerFn(acceptOrderBatchFn);
  const [courier, setCourier] = useState<Courier | null>(null);
  const [feed, setFeed] = useState<OrderRow[]>([]);
  const [active, setActive] = useState<OrderRow | null>(null);
  const [activeList, setActiveList] = useState<OrderRow[]>([]);
  const [restaurants, setRestaurants] = useState<Record<string, { name: string; phone: string; facadeUrl: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);

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
        const { data: rs } = await supabase.from("restaurants").select("id,name,phone,facade_url").in("id", ids);
        const map: Record<string, { name: string; phone: string; facadeUrl: string | null }> = {};
        await Promise.all(
          (rs ?? []).map(async (r: any) => {
            let signed: string | null = null;
            if (r.facade_url) {
              const { data: s } = await supabase.storage
                .from("restaurant-photos")
                .createSignedUrl(r.facade_url, 3600);
              signed = s?.signedUrl ?? null;
            }
            map[r.id] = { name: r.name, phone: r.phone, facadeUrl: signed };
          }),
        );
        setRestaurants(map);
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  // Activar notificaciones push (silenciosamente; si no hay permiso no se rompe nada)
  useEffect(() => {
    if (user?.id) enablePush(user.id);
  }, [user?.id]);

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

  // Toast de mensajes de chat entrantes (foreground)
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase.channel(`courier-msgs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_messages" },
        (payload: any) => {
          const m = payload.new;
          if (!m || m.sender_id === user.id) return;
          toast.info(`💬 ${(m.content ?? "").slice(0, 80)}`);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-hairline bg-paper/60 p-4 h-[88px] animate-pulse" />
        <SkeletonList count={3} />
      </div>
    );
  }
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
        <div className="flex flex-col items-end gap-1">
          <Badge className={subActive ? "bg-success/20 text-success-foreground" : "bg-accent text-accent-foreground"}>
            {subActive ? "Suscripción activa" : "Plan PPS"}
          </Badge>
          {(courier as any).stats_total_deliveries > 0 && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <span>⭐</span>
              <span className="font-semibold text-foreground">
                {Number((courier as any).stats_score ?? 100).toFixed(1)}
              </span>
              <span>· {(courier as any).stats_total_deliveries} entregas</span>
            </div>
          )}
        </div>
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
          <h3 className="text-display text-xl font-medium mb-3">Pedidos disponibles ({sorted.length})</h3>
          {sorted.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Sin pedidos por ahora"
              description="Mantén la app abierta. Te notificaremos al instante cuando haya un pedido cerca de ti."
            />
          ) : (
            <div className="space-y-3">
              {sorted.map(({ o, dist }) => {
                const r = restaurants[o.restaurant_id];
                return (
                <Card key={o.id} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {r?.facadeUrl ? (
                        <img src={r.facadeUrl} alt={r.name} className="h-12 w-12 rounded-lg object-cover border" loading="lazy" />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-muted grid place-items-center text-muted-foreground text-lg">🍽️</div>
                      )}
                      <div className="font-semibold truncate">{r?.name ?? "Restaurante"}</div>
                    </div>
                    <Badge variant="secondary">{dist.toFixed(1)} km</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground flex gap-1 items-start"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {o.pickup_address}</div>
                  <div className="text-sm text-muted-foreground flex gap-1 items-start mt-1"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" /> {o.dropoff_address}</div>
                  {o.customer_name && (
                    <div className="text-sm mt-1">👤 <span className="font-medium">{o.customer_name}</span></div>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <div>
                      <div className="text-xs text-muted-foreground">Ganas</div>
                      <div className="font-display text-xl font-bold text-success flex items-center gap-1">
                        <DollarSign className="h-5 w-5" />{Number(o.shipping_fee).toFixed(0)}
                      </div>
                    </div>
                    <Button size="sm" className="h-11" onClick={() => onAccept(o.id)}>
                      Aceptar
                    </Button>
                  </div>
                </Card>
                );
              })}
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
  order: OrderRow;
  restaurant?: { name: string; phone: string; facadeUrl: string | null };
  courier: Courier;
  onChange: () => void;
}) {
  const { session } = useAuth();
  const setOrderStatusRpc = useServerFn(setOrderStatusFn);
  const updateEtaRpc = useServerFn(updateOrderEtaFn);
  const [busy, setBusy] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [eta, setEta] = useState<number | null>(null);

  // Recalcula ETA cada 30s usando la posición del courier hacia el target actual
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const target =
      order.status === "assigned"
        ? order.pickup_lat != null && order.pickup_lng != null
          ? { lat: order.pickup_lat, lng: order.pickup_lng }
          : null
        : order.dropoff_lat != null && order.dropoff_lng != null
          ? { lat: order.dropoff_lat, lng: order.dropoff_lng }
          : null;
    if (!target) return;
    let cancelled = false;
    const token = session?.access_token;

    const tick = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (cancelled) return;
          const minutes = await fetchEtaMinutes(
            { lat: pos.coords.latitude, lng: pos.coords.longitude },
            target,
          );
          if (cancelled) return;
          setEta(minutes);
          if (token) {
            try {
              await updateEtaRpc({
                headers: { Authorization: `Bearer ${token}` },
                data: { orderId: order.id, etaMinutes: minutes },
              });
            } catch {
              /* silent */
            }
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
      );
    };

    tick();
    const id = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [order.id, order.status, order.pickup_lat, order.pickup_lng, order.dropoff_lat, order.dropoff_lng, session?.access_token, updateEtaRpc]);

  const goInTransit = async () => {
    const token = session?.access_token;
    if (!token) { toast.error("Sesión expirada."); return; }
    setBusy(true);
    const res = await setOrderStatusRpc({
      headers: { Authorization: `Bearer ${token}` },
      data: { orderId: order.id, status: "in_transit" },
    });
    setBusy(false);
    if (!res?.ok) return toast.error(res?.message ?? "No se pudo actualizar");
    onChange();
  };

  const finalizeDelivery = async (proofPath: string, lat: number, lng: number): Promise<void> => {
    const token = session?.access_token;
    if (!token) { toast.error("Sesión expirada."); return; }
    const res = await setOrderStatusRpc({
      headers: { Authorization: `Bearer ${token}` },
      data: {
        orderId: order.id,
        status: "delivered",
        proofUrl: proofPath,
        deliveredLat: lat,
        deliveredLng: lng,
      },
    });
    if (!res?.ok) { toast.error(res?.message ?? "Error"); return; }

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

  // Pins según estado: "assigned" = courier→restaurante (recoger), "in_transit" = restaurante→cliente
  const goingToPickup = order.status === "assigned";
  const showMap = order.status === "assigned" || order.status === "in_transit";
  const pins = goingToPickup
    ? [
        ...(courier.lat != null && courier.lng != null
          ? [{ lat: courier.lat, lng: courier.lng, label: "Tú" }]
          : []),
        ...(order.pickup_lat && order.pickup_lng
          ? [{ lat: order.pickup_lat, lng: order.pickup_lng, label: "Restaurante" }]
          : []),
      ]
    : [
        ...(order.pickup_lat && order.pickup_lng
          ? [{ lat: order.pickup_lat, lng: order.pickup_lng, label: "Recogida" }]
          : []),
        ...(order.dropoff_lat && order.dropoff_lng
          ? [{ lat: order.dropoff_lat, lng: order.dropoff_lng, label: "Entrega" }]
          : []),
      ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Badge className="bg-primary text-primary-foreground">
          {goingToPickup ? "En camino al restaurante" : "Pedido activo"}
        </Badge>
        {eta != null && (
          <Badge variant="secondary" className="font-mono">
            ⏱ ETA {formatEta(eta)}
          </Badge>
        )}
      </div>
      <Card className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {restaurant?.facadeUrl ? (
              <img src={restaurant.facadeUrl} alt={restaurant.name} className="h-14 w-14 rounded-lg object-cover border" />
            ) : (
              <div className="h-14 w-14 rounded-lg bg-muted grid place-items-center text-2xl">🍽️</div>
            )}
            <div className="min-w-0">
              <div className="font-display text-lg font-bold truncate">{restaurant?.name ?? "Restaurante"}</div>
              {restaurant?.phone && (
                <a href={`tel:${restaurant.phone}`} className="text-sm text-primary hover:underline">📞 {restaurant.phone}</a>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-muted-foreground">Ganas</div>
            <div className="font-display text-lg font-bold text-success">${Number(order.shipping_fee).toFixed(0)}</div>
          </div>
        </div>
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

      {showMap && pins.length >= 1 && (
        <div className="h-72">
          <MapView key={`map-${order.id}-${order.status}`} pins={pins} showRoute height="100%" />
        </div>
      )}

      <Button variant="secondary" onClick={() => setChatOpen(true)} className="w-full h-12">
        <MessageCircle className="mr-2 h-4 w-4" /> Chat con el restaurante
      </Button>

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

      <OrderChat
        open={chatOpen}
        onOpenChange={setChatOpen}
        orderId={order.id}
        myRole="courier"
        peerName={restaurant?.name ?? "Restaurante"}
        peerPhone={restaurant?.phone}
      />

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
