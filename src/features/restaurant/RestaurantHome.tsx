import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Package, Truck, CheckCircle2, Clock, MessageCircle, Phone, Inbox, Share2, Copy, Star, Ban, Crown } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { RestaurantOnboarding } from "./RestaurantOnboarding";
import { CreateOrderDialog } from "./CreateOrderDialog";
import { OrderChat } from "@/components/OrderChat";
import { Badge } from "@/components/ui/badge";
import { enablePush } from "@/lib/push";
import { getCourierForOrder } from "@/lib/rpc/orders.functions";
import { getCourierStats } from "@/lib/rpc/intelligence.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { BUSINESS, formatMxn } from "@/lib/business";
import { copyText, customerMapsWhatsAppText, isEmbeddedPreview, whatsappChatUrl } from "@/lib/maps";
import { RestaurantOrderBoard } from "./RestaurantOrderBoard";
import { RestaurantMenuEditor } from "./RestaurantMenuEditor";
import { parseOrderFlow } from "@/lib/order-flow";
import { unpackDropoff } from "@/lib/restaurant-media";

interface Restaurant {
  id: string; name: string; address: string; lat: number | null; lng: number | null;
  phone: string; category: string;
}
interface Order {
  id: string; status: string;
  pickup_address: string; pickup_lat: number | null; pickup_lng: number | null;
  dropoff_address: string; dropoff_lat: number | null; dropoff_lng: number | null;
  amount_to_collect: number; external_order_id: string | null;
  customer_name: string | null; customer_phone: string | null;
  created_at: string; courier_id: string | null;
  tracking_token: string | null;
  flow?: unknown;
}

interface CourierInfo {
  fullName: string;
  phone: string | null;
  phoneDialCode: string;
  score?: number;
  totalDeliveries?: number;
}

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Buscando repartidor", color: "bg-warning/20 text-warning-foreground", icon: Clock },
  assigned: { label: "Asignado", color: "bg-accent text-accent-foreground", icon: Package },
  in_transit: { label: "En camino", color: "bg-primary/20 text-primary", icon: Truck },
  delivered: { label: "Entregado", color: "bg-success/20 text-success-foreground", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", color: "bg-destructive/20 text-destructive", icon: Clock },
};

export function RestaurantHome() {
  const { user, session } = useAuth();
  const [rest, setRest] = useState<Restaurant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState<{ customer_name: string; customer_phone: string; dropoff_address: string; amount: string; notes: string; requestId?: string } | null>(null);
  const [requests, setRequests] = useState<{ id: string; customer_name: string; customer_phone: string; dropoff_address: string; food_total: number; items: { name?: string; qty?: number }[] }[]>([]);
  const [chatOrderId, setChatOrderId] = useState<string | null>(null);
  const [courierByOrder, setCourierByOrder] = useState<Record<string, CourierInfo>>({});
  const seenRequests = useRef<Set<string>>(new Set());
  const requestsReady = useRef(false);
  const getCourierForOrderRpc = useServerFn(getCourierForOrder);
  const getCourierStatsRpc = useServerFn(getCourierStats);

  const load = async () => {
    if (!user) return;
    const { data: r } = await supabase.from("restaurants").select("*").eq("user_id", user.id).maybeSingle();
    setRest(r as any);
    if (r) {
      const { data: o } = await supabase
        .from("orders").select("*").eq("restaurant_id", r.id)
        .order("created_at", { ascending: false }).limit(20);
      setOrders((o as any) ?? []);
      const { data: incoming } = await supabase
        .from("menu_requests")
        .select("id,customer_name,customer_phone,dropoff_address,food_total,items")
        .eq("restaurant_id", r.id)
        .eq("status", "new")
        .order("created_at", { ascending: false });
      const incomingRows = (incoming as any) ?? [];
      setRequests(incomingRows);
      const fresh = incomingRows.filter((request: { id: string }) => !seenRequests.current.has(request.id));
      if (requestsReady.current) {
        fresh.forEach((request: { id: string; customer_name: string; food_total: number }) => {
          toast.success(`Nuevo pedido de ${request.customer_name}`);
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification("Nuevo pedido en 1Click", {
              body: `${request.customer_name} · ${formatMxn(Number(request.food_total))}`,
            });
          }
        });
      }
      incomingRows.forEach((request: { id: string }) => seenRequests.current.add(request.id));
      requestsReady.current = true;
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  useEffect(() => {
    if (!rest?.id) return;
    const timer = window.setInterval(load, 12000);
    return () => window.clearInterval(timer);
  }, [rest?.id]);

  useEffect(() => {
    if (!rest?.id) return;
    const channel = supabase
      .channel(`restaurant-orders-${rest.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `restaurant_id=eq.${rest.id}` },
        () => { load(); },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "menu_requests", filter: `restaurant_id=eq.${rest.id}` },
        () => { load(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [rest?.id]);

  // Activar notificaciones push
  useEffect(() => {
    if (user?.id) enablePush(user.id);
  }, [user?.id]);

  // Cargar info de los couriers asignados
  useEffect(() => {
    const token = session?.access_token;
    if (!user?.id || !token) return;
    const ordersWithCourier = orders.filter(
      (o) => o.courier_id && (o.status === "assigned" || o.status === "in_transit") && !courierByOrder[o.id],
    );
    if (!ordersWithCourier.length) return;
    let cancelled = false;
    (async () => {
      for (const o of ordersWithCourier) {
        if (cancelled) return;
        try {
          const res = await getCourierForOrderRpc({
            headers: { Authorization: `Bearer ${token}` },
            data: { orderId: o.id },
          }).catch((err) => {
            console.warn("getCourierForOrder request failed", err);
            return null;
          });
          if (!cancelled && res?.ok) {
            setCourierByOrder((prev) => ({
              ...prev,
              [o.id]: { fullName: res.fullName, phone: res.phone, phoneDialCode: res.phoneDialCode },
            }));
            // Cargar stats en paralelo (best-effort)
            if (res.courierId) {
              getCourierStatsRpc({
                headers: { Authorization: `Bearer ${token}` },
                data: { courierId: res.courierId },
              })
                .then((stats: any) => {
                  if (cancelled || !stats?.ok) return;
                  setCourierByOrder((prev) => ({
                    ...prev,
                    [o.id]: {
                      ...prev[o.id],
                      score: stats.score,
                      totalDeliveries: stats.totalDeliveries,
                    },
                  }));
                })
                .catch(() => {});
            }
          }
        } catch (e) {
          console.warn("getCourierForOrder failed", e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, user?.id, session?.access_token]);

  // Realtime updates on this restaurant's orders
  useEffect(() => {
    if (!rest?.id) return;
    const ch = supabase.channel(`rest-orders-${rest.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${rest.id}` },
        (payload: any) => {
          if (payload.eventType === "UPDATE" && payload.new?.status === "assigned" && payload.old?.status === "pending") {
            toast.success("¡Un repartidor aceptó tu pedido!");
          }
          if (payload.eventType === "UPDATE" && payload.new?.status === "in_transit") {
            toast.info("🚚 El repartidor va al cliente");
          }
          if (payload.eventType === "UPDATE" && payload.new?.status === "delivered") {
            toast.success("Pedido entregado ✅");
          }
          load();
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [rest?.id]);

  // Toast de mensajes de chat entrantes
  useEffect(() => {
    if (!user?.id || !rest?.id) return;
    const ch = supabase.channel(`rest-msgs-${rest.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_messages" },
        (payload: any) => {
          const m = payload.new;
          if (!m || m.sender_id === user.id) return;
          if (chatOrderId === m.order_id) return; // ya está abierto
          toast.info(`💬 ${(m.content ?? "").slice(0, 80)}`);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, rest?.id, chatOrderId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-muted/60 animate-pulse" />
          <div className="h-7 w-48 rounded bg-muted/60 animate-pulse" />
        </div>
        <div className="rounded-2xl bg-muted/40 h-32 animate-pulse" />
        <SkeletonList count={2} />
      </div>
    );
  }
  if (!rest) return <RestaurantOnboarding onDone={load} />;

  const active = orders.filter((o) => !["delivered", "cancelled"].includes(o.status));
  const chatOrder = chatOrderId ? orders.find((o) => o.id === chatOrderId) : null;
  const chatCourier = chatOrderId ? courierByOrder[chatOrderId] : null;

  const customerMessage = (o: Order) =>
    customerMapsWhatsAppText({
      restaurantName: rest?.name ?? BUSINESS.brandName,
      customerName: o.customer_name,
      pickup: { lat: o.pickup_lat, lng: o.pickup_lng, address: o.pickup_address },
      dropoff: { lat: o.dropoff_lat, lng: o.dropoff_lng, address: o.dropoff_address },
      trackingUrl: o.tracking_token ? `${window.location.origin}/t/${o.tracking_token}` : null,
    });

  const copyCustomerMessage = async (o: Order) => {
    const ok = await copyText(customerMessage(o));
    if (ok) toast.success("Mensaje copiado");
    else toast.error("No se pudo copiar");
    return ok;
  };

  const shareWithCustomer = async (o: Order) => {
    const text = customerMessage(o);
    if (isEmbeddedPreview()) {
      const ok = await copyCustomerMessage(o);
      if (ok) {
        toast.info("Lovable bloquea WhatsApp. Pega el mensaje en la app del celular.");
      }
      return;
    }
    const wa = whatsappChatUrl(o.customer_phone, text);
    if (wa) {
      window.open(wa, "_blank", "noopener,noreferrer");
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: "Tu pedido One Click", text });
        return;
      } catch {
        // user cancelled or unsupported
      }
    }
    await copyCustomerMessage(o);
  };

  const cancelOrder = async (o: Order) => {
    const label = o.status === "pending" ? "buscando repartidor" : "asignado";
    if (!window.confirm(`Cancelar este pedido (${label})? Esta acción no se puede deshacer.`)) return;
    const reason = window.prompt("Motivo de cancelación (opcional):") ?? "";
    const note = `[CANCELADO POR RESTAURANTE${reason.trim() ? `: ${reason.trim()}` : ""}]`;
    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled", notes: note })
      .eq("id", o.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pedido cancelado");
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Bienvenido,</p>
        <h1 className="font-display text-2xl font-bold">{rest.name}</h1>
      </div>

      <Card className="p-6 bg-gradient-to-br from-primary to-primary-glow text-primary-foreground border-0 shadow-glow">
        <h2 className="font-display text-xl font-semibold">¿Necesitas un repartidor?</h2>
        <p className="text-sm opacity-80 mt-1">
          Membresía {formatMxn(BUSINESS.membership.restaurantMonthlyMxn)}/mes. One Click no se queda con la comida.
        </p>
        <Button size="lg" variant="secondary" className="mt-4 w-full" onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-5 w-5" /> Solicitar Repartidor
        </Button>
        <Button asChild variant="ghost" className="mt-2 w-full text-primary-foreground/90">
          <Link to="/app/wallet"><Crown className="mr-2 h-4 w-4" /> Ver membresía</Link>
        </Button>
      </Card>

      <div>
        <h3 className="text-display text-xl font-medium mb-3">Pedidos activos</h3>
        {active.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Sin pedidos activos"
            description="Cuando solicites un repartidor, podrás seguir el estado en tiempo real desde aquí."
            variant="subtle"
          />
        ) : (
          <div className="space-y-3">
            {active.map((o) => {
              const c = courierByOrder[o.id];
              const courierPhone = c?.phone ? `${c.phoneDialCode}${c.phone}` : null;
              return (
                <div key={o.id} className="space-y-2">
                  <RestaurantOrderBoard
                    order={o}
                    restaurantName={rest.name}
                    courierName={c?.fullName ?? null}
                    courierPhone={courierPhone}
                    flow={parseOrderFlow(o.flow)}
                    onSaved={load}
                    onCancel={o.status === "pending" || o.status === "assigned" ? () => cancelOrder(o) : undefined}
                  />
                  {o.courier_id && (o.status === "assigned" || o.status === "in_transit") && (
                    <Button variant="outline" className="w-full" onClick={() => setChatOrderId(o.id)}>
                      <MessageCircle className="h-4 w-4 mr-2" /> Chat con {c?.fullName ?? "repartidor"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {requests.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-lg font-semibold">Pedidos del menú</h3>
          {requests.map((request) => (
            <Card key={request.id} className="p-4">
              <div className="font-medium">{request.customer_name} · {request.customer_phone}</div>
              <p className="text-sm text-graphite">{unpackDropoff(request.dropoff_address).address}</p>
              {unpackDropoff(request.dropoff_address).mapsUrl && (
                <a className="mt-1 block text-sm text-primary" href={unpackDropoff(request.dropoff_address).mapsUrl ?? "#"} target="_blank" rel="noopener noreferrer">Liga de la casa</a>
              )}
              <p className="mt-1 text-sm">{formatMxn(Number(request.food_total))} en comida</p>
              <Button
                className="mt-3 h-11 w-full"
                onClick={() => {
                  const items = Array.isArray(request.items) ? request.items : [];
                  const notes = items.map((item) => `${item.qty ?? 1} ${item.name ?? ""}`).join(", ").slice(0, 500);
                  const dropoff = unpackDropoff(request.dropoff_address);
                  setSeed({
                    customer_name: request.customer_name,
                    customer_phone: request.customer_phone,
                    dropoff_address: dropoff.address,
                    amount: String(Number(request.food_total)),
                    notes,
                    requestId: request.id,
                    lat: dropoff.lat,
                    lng: dropoff.lng,
                    mapsUrl: dropoff.mapsUrl,
                  });
                  setOpen(true);
                }}
              >
                Pedir repartidor
              </Button>
            </Card>
          ))}
        </section>
      )}

      <RestaurantMenuEditor />

      <CreateOrderDialog
        open={open}
        onOpenChange={(value) => { setOpen(value); if (!value) setSeed(null); }}
        restaurant={rest}
        seed={seed}
        onCreated={async () => {
          if (seed?.requestId) {
            await supabase.from("menu_requests").update({ status: "accepted" }).eq("id", seed.requestId);
          }
          load();
        }}
      />
      {chatOrderId && chatOrder && (
        <OrderChat
          open={!!chatOrderId}
          onOpenChange={(v) => !v && setChatOrderId(null)}
          orderId={chatOrderId}
          myRole="restaurant"
          peerName={chatCourier?.fullName ?? "Repartidor"}
          peerPhone={chatCourier?.phone ? `${chatCourier.phoneDialCode}${chatCourier.phone}` : undefined}
        />
      )}
    </div>
  );
}
