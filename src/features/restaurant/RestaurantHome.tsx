import { useEffect, useState } from "react";
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
  const [chatOrderId, setChatOrderId] = useState<string | null>(null);
  const [courierByOrder, setCourierByOrder] = useState<Record<string, CourierInfo>>({});
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
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

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
              const m = STATUS_META[o.status];
              const Icon = m.icon;
              const c = courierByOrder[o.id];
              const wa = isEmbeddedPreview()
                ? null
                : whatsappChatUrl(o.customer_phone, customerMessage(o));
              return (
                <Card key={o.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">#{o.external_order_id ?? o.id.slice(0, 6)}</div>
                      <div className="font-medium truncate">{o.dropoff_address}</div>
                      {o.customer_name && (
                        <div className="text-xs text-muted-foreground truncate">👤 {o.customer_name}</div>
                      )}
                      <div className="text-sm text-muted-foreground mt-1">${Number(o.amount_to_collect).toFixed(2)} MXN</div>
                    </div>
                    <Badge className={m.color}><Icon className="h-3 w-3 mr-1" />{m.label}</Badge>
                  </div>

                  <div className="mt-3 flex gap-2">
                    {wa ? (
                      <Button variant="outline" size="sm" className="flex-1" asChild>
                        <a href={wa} target="_blank" rel="noopener noreferrer">
                          <Share2 className="h-3.5 w-3.5 mr-1.5" /> WhatsApp al cliente
                        </a>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => shareWithCustomer(o)}
                      >
                        <Share2 className="h-3.5 w-3.5 mr-1.5" /> WhatsApp al cliente
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCustomerMessage(o)}
                      title="Copiar mensaje con las dos ligas de Maps"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {(o.status === "pending" || o.status === "assigned") && (
                    <div className="mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                        onClick={() => cancelOrder(o)}
                      >
                        <Ban className="h-3.5 w-3.5 mr-1.5" /> Cancelar envío
                      </Button>
                    </div>
                  )}

                  {o.courier_id && (o.status === "assigned" || o.status === "in_transit") && (
                    <div className="mt-3 pt-3 border-t space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground">Repartidor</div>
                          <div className="font-medium truncate">🛵 {c?.fullName ?? "Cargando..."}</div>
                          {c?.score != null && (
                            <div className="flex items-center gap-1.5 mt-0.5 text-xs">
                              <Star className="h-3 w-3 fill-warning text-warning" />
                              <span className="font-semibold">{c.score.toFixed(1)}</span>
                              <span className="text-muted-foreground">
                                · {c.totalDeliveries ?? 0} entregas
                              </span>
                            </div>
                          )}
                        </div>
                        {c?.phone && (
                          <a
                            href={`tel:${c.phoneDialCode}${c.phone}`}
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline shrink-0"
                          >
                            <Phone className="h-3.5 w-3.5" /> {c.phoneDialCode} {c.phone}
                          </a>
                        )}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={() => setChatOrderId(o.id)}
                      >
                        <MessageCircle className="h-4 w-4 mr-2" /> Chat con repartidor
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <CreateOrderDialog open={open} onOpenChange={setOpen} restaurant={rest} onCreated={load} />
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
