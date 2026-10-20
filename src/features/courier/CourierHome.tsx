import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, DollarSign, AlertCircle, Truck, CheckCircle2, Crown, MessageCircle, Inbox, WifiOff, Navigation } from "lucide-react";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { CourierOnboarding } from "./CourierOnboarding";
import { DeliveryProofDialog } from "./DeliveryProofDialog";
import { MapView, haversine } from "@/components/MapView";
import { OrderChat } from "@/components/OrderChat";
import { acceptOrder as acceptOrderFn, setOrderStatus as setOrderStatusFn } from "@/lib/rpc/orders.functions";
import { updateOrderEta as updateOrderEtaFn, acceptOrderBatch as acceptOrderBatchFn } from "@/lib/rpc/intelligence.functions";
import { useCourierLocationTracker } from "@/hooks/useCourierLocationTracker";
import { LocationPermissionGate } from "@/components/LocationPermissionGate";
import { enablePush } from "@/lib/push";
import { fetchEtaMinutes, formatEta } from "@/lib/eta";
import { toast } from "sonner";
import { googleMapsDirectionsUrl, whatsappChatUrl } from "@/lib/maps";
import { formatMxn } from "@/lib/business";
import { orderCode, orderMoney, parseOrderFlow } from "@/lib/order-flow";
import { recordOrderFlow } from "@/lib/rpc/orders.functions";
import { CheckRow, FlowButton, FlowCard, MoneyLine } from "@/components/order/FlowCard";

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
  food_amount_cents?: number | null;
  shipping_amount_cents?: number | null;
  flow?: unknown;
  restaurant_id: string; courier_id: string | null; created_at: string;
}

export function CourierHome() {
  const { user, session, isMasterAdmin } = useAuth();
  const acceptOrderRpc = useServerFn(acceptOrderFn);
  const acceptBatchRpc = useServerFn(acceptOrderBatchFn);
  const { online, pending } = useOfflineQueue();
  const [courier, setCourier] = useState<Courier | null>(null);
  const [feed, setFeed] = useState<OrderRow[]>([]);
  const [active, setActive] = useState<OrderRow | null>(null);
  const [doneOrder, setDoneOrder] = useState<OrderRow | null>(null);
  const [hideDone, setHideDone] = useState(false);
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
      const { data: actives } = await supabase.from("orders").select("*")
        .eq("courier_id", (c as any).id).in("status", ["assigned", "in_transit"])
        .order("accepted_at", { ascending: false });
      const list = (actives as any) ?? [];
      setActiveList(list);
      setActive(list[0] ?? null);
      let finished: OrderRow | null = null;
      if (!list.length) {
        const { data: lastDone } = await supabase.from("orders").select("*")
          .eq("courier_id", (c as any).id)
          .eq("status", "delivered")
          .order("delivered_at", { ascending: false })
          .limit(1);
        finished = ((lastDone as any) ?? [])[0] ?? null;
        setDoneOrder(finished);
      } else {
        setDoneOrder(null);
      }

      const { data: pend } = await supabase.rpc("get_available_orders", { _limit: 30 });
      // RPC no devuelve PII (customer_name/phone, notes, amount_to_collect): se carga al aceptar.
      setFeed(((pend as any) ?? []).map((o: any) => ({
        ...o,
        customer_name: null,
        customer_phone: null,
        notes: null,
        amount_to_collect: Number(o.amount_to_collect ?? 0),
      })));

      const ids = Array.from(new Set([
        ...(pend ?? []).map((o: any) => o.restaurant_id),
        ...list.map((o: any) => o.restaurant_id),
        ...(finished ? [finished.restaurant_id] : []),
      ]));
      if (ids.length) {
        const { data: rs } = await supabase.from("restaurants").select("id,name,phone,facade_url").in("id", ids);
        const map: Record<string, { name: string; phone: string; facadeUrl: string | null }> = {};
        await Promise.all(
          (rs ?? []).map(async (r: any) => {
            let signed: string | null = null;
            if (r.facade_url?.startsWith("data:") || r.facade_url?.startsWith("http")) {
              signed = r.facade_url;
            } else if (r.facade_url) {
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
  const canAcceptRT = !!subActiveRT || isMasterAdmin;
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
  if (!courier) return <CourierOnboarding existing={false} onDone={load} />;

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
  const canAccept = !!subActive || isMasterAdmin;

  if (active) {
    return (
      <div className="space-y-4">
        {activeList.length > 1 && (
          <Card className="p-3">
            <div className="text-xs text-muted-foreground mb-2">
              📦 Tienes {activeList.length} pedidos activos · selecciona cuál atender
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {activeList.map((o, i) => {
                const r = restaurants[o.restaurant_id];
                const isCurrent = o.id === active.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => setActive(o)}
                    className={`shrink-0 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                      isCurrent
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/40 hover:bg-muted border-transparent"
                    }`}
                  >
                    #{i + 1} · {r?.name?.slice(0, 14) ?? "Pedido"}
                  </button>
                );
              })}
            </div>
          </Card>
        )}
        <ActiveOrderView order={active} restaurant={restaurants[active.restaurant_id]} courier={courier} onChange={load} />
      </div>
    );
  }

  if (doneOrder && !hideDone) {
    return (
      <ActiveOrderView
        order={doneOrder}
        restaurant={restaurants[doneOrder.restaurant_id]}
        courier={courier}
        onChange={load}
        onBack={() => setHideDone(true)}
      />
    );
  }

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
      {(!online || pending > 0) && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
          <WifiOff className="h-4 w-4 text-warning" />
          <span className="font-medium">
            {!online ? "Sin conexión" : "Sincronizando…"}
          </span>
          {pending > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {pending} pendiente{pending === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
      )}
      <Card className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Saldo monedero</p>
          <p className="font-display text-2xl font-bold">${Number(courier.wallet_balance).toFixed(2)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge className={subActive ? "alert-success" : "bg-accent text-accent-foreground"}>
            {subActive ? "Membresía activa" : "Sin membresía"}
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
              Necesitas una <strong>membresía activa</strong> ($300 MXN/mes) para aceptar pedidos.
            </p>
          </div>
          <div className="pt-1">
            <Button asChild className="h-12 w-full">
              <Link to="/app/wallet"><Crown className="mr-1 h-4 w-4" /> Pagar membresía</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-display text-xl font-medium">Pedidos disponibles ({sorted.length})</h3>
          </div>
          {sorted.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Sin pedidos por ahora"
              description="Mantén la app abierta. Te notificaremos al instante cuando haya un pedido cerca de ti."
            />
          ) : (
            <div className="space-y-3 pb-24">
              {sorted.map(({ o, dist }) => {
                const r = restaurants[o.restaurant_id];
                const isSelected = selected.has(o.id);
                const toggleSelect = () => {
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(o.id)) next.delete(o.id);
                    else if (next.size < 3) next.add(o.id);
                    else toast.info("Máximo 3 pedidos por batch.");
                    return next;
                  });
                };
                return (
                <Card
                  key={o.id}
                  className={`p-4 transition-all ${batchMode ? "cursor-pointer" : ""} ${
                    isSelected ? "ring-2 ring-primary border-primary" : ""
                  }`}
                  onClick={() => batchMode && toggleSelect()}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {batchMode && (
                        <div
                          className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="h-4 w-4" />}
                        </div>
                      )}
                      {r?.facadeUrl ? (
                        <img src={r.facadeUrl} alt={r.name} className="h-12 w-12 rounded-lg object-cover border" loading="lazy" />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-muted grid place-items-center text-muted-foreground text-lg">🍽️</div>
                      )}
                      <div className="min-w-0">
                    <div className="text-3xl font-semibold leading-none text-primary">01</div>
                    <div className="font-semibold truncate">Oferta · #{orderCode(o)}</div>
                    <div className="truncate text-sm text-graphite">{r?.name ?? "Restaurante"}</div>
                  </div>
                    </div>
                    <Badge variant="secondary">{dist.toFixed(1)} km</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground flex gap-1 items-start"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {o.pickup_address}</div>
                  <div className="text-sm text-muted-foreground flex gap-1 items-start mt-1"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" /> {o.dropoff_address}</div>
                  {o.customer_name && (
                    <div className="text-sm mt-1">👤 <span className="font-medium">{o.customer_name}</span></div>
                  )}
                  <div className="mt-3 rounded-xl bg-bone px-3 py-2">
                    <MoneyLine label="Adelantas al restaurante" amount={formatMxn(orderMoney(o).food)} />
                    <MoneyLine label="Cobras al cliente" amount={formatMxn(orderMoney(o).total)} />
                    <MoneyLine label="Tu envío" amount={formatMxn(orderMoney(o).shipping)} strong />
                  </div>
                  {!batchMode && (
                    <div className="mt-3">
                      <FlowButton onClick={() => onAccept(o.id)}>Aceptar pedido</FlowButton>
                    </div>
                  )}
                </Card>
                );
              })}
            </div>
          )}

          {/* Barra fija inferior cuando hay pedidos seleccionados en modo batch */}
          {batchMode && selected.size >= 2 && (
            <div className="fixed bottom-20 left-0 right-0 px-4 z-30 pointer-events-none">
              <Card className="max-w-md mx-auto p-3 shadow-2xl border-primary pointer-events-auto bg-paper/95 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">{selected.size} pedidos seleccionados</div>
                    <div className="font-display text-lg font-bold text-success">
                      Ganas ${sorted
                        .filter((s) => selected.has(s.o.id))
                        .reduce((sum, s) => sum + Number(s.o.shipping_fee), 0)
                        .toFixed(0)}
                    </div>
                  </div>
                  <Button onClick={onAcceptBatch} disabled={batchBusy} className="h-11">
                    {batchBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Aceptar ${selected.size}`}
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );

  function onAcceptBatch() {
    const token = session?.access_token;
    if (!token) { toast.error("Sesión expirada."); return; }
    if (selected.size < 2) return;
    setBatchBusy(true);
    acceptBatchRpc({
      headers: { Authorization: `Bearer ${token}` },
      data: { orderIds: Array.from(selected) },
    })
      .then((res: any) => {
        if (!res?.ok) {
          toast.error(res?.message ?? "No se pudo aceptar el batch.");
          return;
        }
        toast.success(res.partial ? res.message : `¡${res.assigned} pedidos asignados!`);
        setBatchMode(false);
        setSelected(new Set());
        load();
      })
      .catch(async (e: any) => {
        const msg = e instanceof Response ? await e.text().catch(() => "Error") : (e?.message ?? "Error");
        toast.error(msg);
      })
      .finally(() => setBatchBusy(false));
  }

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


function ActiveOrderView({ order, restaurant, courier, onChange, onBack }: {
  order: OrderRow;
  restaurant?: { name: string; phone: string; facadeUrl: string | null };
  courier: Courier;
  onChange: () => void;
  onBack?: () => void;
}) {
  const { session } = useAuth();
  const setOrderStatusRpc = useServerFn(setOrderStatusFn);
  const updateEtaRpc = useServerFn(updateOrderEtaFn);
  const [busy, setBusy] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [eta, setEta] = useState<number | null>(null);
  const record = useServerFn(recordOrderFlow);
  const shared = parseOrderFlow(order.flow);
  const [gotFood, setGotFood] = useState(!!shared.productReceivedAt);
  const [paidRestaurant, setPaidRestaurant] = useState(!!shared.advancePaidAt);
  const [deliveredFood, setDeliveredFood] = useState(!!shared.foodDeliveredAt);
  const [collected, setCollected] = useState(!!shared.cashCollectedAt);
  const [incident, setIncident] = useState(shared.incidentNote ?? "");
  const [pastedFirst, setPastedFirst] = useState("");
  const [pastedSecond, setPastedSecond] = useState("");
  const savedFirst = !!shared.courierFirstSavedAt;
  const savedSecond = !!shared.courierSecondSavedAt;

  useEffect(() => {
    const next = parseOrderFlow(order.flow);
    setGotFood(!!next.productReceivedAt);
    setPaidRestaurant(!!next.advancePaidAt);
    setDeliveredFood(!!next.foodDeliveredAt);
    setCollected(!!next.cashCollectedAt);
    setIncident(next.incidentNote ?? "");
  }, [order.id, order.flow]);

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

    toast.success("Pedido entregado ✅");
    onChange();
  };

  // Pins según estado: "assigned" = courier→restaurante (recoger), "in_transit" = restaurante→cliente
  const goingToPickup = order.status === "assigned";
  const showMap = order.status === "assigned" || order.status === "in_transit";
  const pickupMaps = googleMapsDirectionsUrl({
    lat: order.pickup_lat, lng: order.pickup_lng, address: order.pickup_address,
  });
  const dropoffMaps = googleMapsDirectionsUrl({
    lat: order.dropoff_lat, lng: order.dropoff_lng, address: order.dropoff_address,
  });
  const customerWa = whatsappChatUrl(order.customer_phone);
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

  const code = orderCode(order);
  const money = orderMoney(order);
  const persist = async (payload: {
    action: "courier_first_saved" | "courier_second_saved" | "courier_checks" | "courier_incident";
    productReceived?: boolean;
    advancePaid?: boolean;
    foodDelivered?: boolean;
    cashCollected?: boolean;
    incidentNote?: string;
    linkUrl?: string;
  }) => {
    const token = session?.access_token;
    if (!token) { toast.error("Sesión expirada."); return false; }
    const res = await record({
      headers: { Authorization: `Bearer ${token}` },
      data: { orderId: order.id, ...payload },
    }).catch(() => null);
    if (!res?.ok) {
      toast.error(res?.message ?? "No se pudo guardar.");
      return false;
    }
    onChange();
    return true;
  };
  const toggleCheck = (
    field: "productReceived" | "advancePaid" | "foodDelivered" | "cashCollected",
    value: boolean,
  ) => {
    if (field === "productReceived") setGotFood(value);
    if (field === "advancePaid") setPaidRestaurant(value);
    if (field === "foodDelivered") setDeliveredFood(value);
    if (field === "cashCollected") setCollected(value);
    const next = {
      productReceived: field === "productReceived" ? value : gotFood,
      advancePaid: field === "advancePaid" ? value : paidRestaurant,
      foodDelivered: field === "foodDelivered" ? value : deliveredFood,
      cashCollected: field === "cashCollected" ? value : collected,
    };
    void persist({ action: "courier_checks", ...next });
  };

  return (
    <div className="space-y-4">
      <FlowCard title={`Pedido #${code}`} step={order.status === "delivered" ? "06" : goingToPickup ? "02" : "04"}>
        <p className="text-sm font-medium">{restaurant?.name ?? "Restaurante"}</p>
        <p className="text-sm text-graphite">{goingToPickup ? order.pickup_address : order.dropoff_address}</p>
        {eta != null && <p className="mt-1 text-xs text-graphite">ETA {formatEta(eta)}</p>}
      </FlowCard>

      {order.status === "assigned" && !savedFirst && (
        <FlowCard step="02" title="Reserva pendiente" subtitle="Abre el restaurante en Maps y guarda la primera liga.">
          <p className="mb-3 text-sm text-graphite">
            {shared.restaurantFirstSentAt
              ? "El restaurante ya mandó esta liga. Ábrela y guárdala en el pedido."
              : "Puedes abrir el restaurante en Maps. Cuando el restaurante confirme el envío, la liga queda en el pedido."}
          </p>
          {(shared.restaurantFirstUrl || pickupMaps) && (
            <Button asChild variant="outline" className="mb-2 h-12 w-full">
              <a href={shared.restaurantFirstUrl || pickupMaps || "#"} target="_blank" rel="noopener noreferrer">Abrir restaurante en Maps</a>
            </Button>
          )}
          <label className="mb-3 block text-sm">
            <span className="text-graphite">Pegar primera liga</span>
            <input
              value={pastedFirst}
              onChange={(event) => setPastedFirst(event.target.value)}
              placeholder="https://maps.google.com/..."
              className="mt-1 h-11 w-full rounded-xl border border-hairline bg-white px-3"
            />
          </label>
          <FlowButton onClick={() => persist({ action: "courier_first_saved", linkUrl: pastedFirst.trim() || undefined })}>Guardar primera liga</FlowButton>
        </FlowCard>
      )}

      {order.status === "assigned" && savedFirst && (
        <FlowCard step="03" title="Recogida" subtitle="Confirma que ya tienes el pedido y que entregaste el dinero.">
          <p className="mb-3 rounded-xl alert-warning px-3 py-2 text-sm">
            Entregas {formatMxn(money.food)} en efectivo al restaurante.
          </p>
          <div className="space-y-2">
            <CheckRow checked={gotFood} label="Producto recibido" onChange={(value) => toggleCheck("productReceived", value)} />
            <CheckRow checked={paidRestaurant} label="Anticipo entregado" onChange={(value) => toggleCheck("advancePaid", value)} />
          </div>
          <div className="mt-3">
            <FlowButton disabled={busy || !gotFood || !paidRestaurant} onClick={goInTransit}>
              Confirmar recogida
            </FlowButton>
          </div>
        </FlowCard>
      )}

      {order.status === "in_transit" && !savedSecond && (
        <FlowCard step="04" title="Segundo recorrido" subtitle="Abre el domicilio del cliente y guarda la segunda liga.">
          <p className="mb-3 text-sm text-graphite">
            {shared.restaurantSecondSentAt
              ? "El restaurante ya mandó al cliente la liga del domicilio."
              : "Abre el domicilio. La liga queda en el pedido cuando la guardas."}
          </p>
          {(shared.restaurantSecondUrl || dropoffMaps) && (
            <Button asChild variant="outline" className="mb-2 h-12 w-full">
              <a href={shared.restaurantSecondUrl || dropoffMaps || "#"} target="_blank" rel="noopener noreferrer">Abrir destino en Maps</a>
            </Button>
          )}
          <label className="mb-3 block text-sm">
            <span className="text-graphite">Pegar segunda liga</span>
            <input
              value={pastedSecond}
              onChange={(event) => setPastedSecond(event.target.value)}
              placeholder="https://maps.google.com/..."
              className="mt-1 h-11 w-full rounded-xl border border-hairline bg-white px-3"
            />
          </label>
          <FlowButton onClick={() => persist({ action: "courier_second_saved", linkUrl: pastedSecond.trim() || undefined })}>Guardar segunda liga</FlowButton>
        </FlowCard>
      )}

      {order.status === "in_transit" && savedSecond && (
        <FlowCard step="05" title="Entrega y cobro" subtitle="Marca la entrega y el dinero que cobraste.">
          <p className="mb-3 text-lg font-semibold text-primary">Cobra al cliente {formatMxn(money.total)}</p>
          <div className="space-y-2">
            <CheckRow checked={deliveredFood} label="Entregué el pedido" onChange={(value) => toggleCheck("foodDelivered", value)} />
            <CheckRow checked={collected} label={`Cobré ${formatMxn(money.total)}`} onChange={(value) => toggleCheck("cashCollected", value)} />
          </div>
          <label className="mt-3 block text-sm">
            <span className="text-graphite">Incidencia</span>
            <textarea
              value={incident}
              onChange={(event) => setIncident(event.target.value)}
              maxLength={300}
              className="mt-1 h-20 w-full rounded-xl border border-hairline bg-white px-3 py-2"
              placeholder="Si algo falló, escríbelo aquí"
            />
          </label>
          <div className="mt-3 space-y-2">
            <FlowButton
              variant="outline"
              disabled={!incident.trim()}
              onClick={() => persist({ action: "courier_incident", incidentNote: incident.trim() })}
            >
              Reportar incidencia
            </FlowButton>
            <FlowButton disabled={!deliveredFood || !collected} onClick={() => setProofOpen(true)}>
              Confirmar entrega
            </FlowButton>
            {customerWa && (
              <Button asChild variant="outline" className="h-12 w-full">
                <a href={customerWa} target="_blank" rel="noopener noreferrer">WhatsApp del cliente</a>
              </Button>
            )}
          </div>
        </FlowCard>
      )}

      {order.status === "delivered" && (
        <FlowCard step="06" title="Pedido finalizado">
          <div className="mb-3 rounded-xl alert-success px-3 py-3 text-sm">Entrega confirmada</div>
          <MoneyLine label="Cobro registrado" amount={formatMxn(money.total)} />
          <MoneyLine label="Anticipo recuperado" amount={formatMxn(money.food)} />
          <MoneyLine label="Tu envío" amount={formatMxn(money.shipping)} strong />
          {onBack && <div className="mt-3"><FlowButton onClick={onBack}>Volver a pedidos</FlowButton></div>}
        </FlowCard>
      )}

      {showMap && pins.length >= 1 && (
        <div className="h-56 overflow-hidden rounded-2xl">
          <MapView key={`map-${order.id}-${order.status}`} pins={pins} showRoute height="100%" />
        </div>
      )}

      <Button variant="outline" onClick={() => setChatOpen(true)} className="h-12 w-full">
        <MessageCircle className="mr-2 h-4 w-4" /> Chat con el restaurante
      </Button>

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
