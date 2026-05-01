import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Loader2, Package, Truck, CheckCircle2, Clock } from "lucide-react";
import { RestaurantOnboarding } from "./RestaurantOnboarding";
import { CreateOrderDialog } from "./CreateOrderDialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Restaurant {
  id: string; name: string; address: string; lat: number | null; lng: number | null;
  phone: string; category: string;
}
interface Order {
  id: string; status: string; pickup_address: string; dropoff_address: string;
  amount_to_collect: number; external_order_id: string | null;
  created_at: string; courier_id: string | null;
}

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Buscando repartidor", color: "bg-warning/20 text-warning-foreground", icon: Clock },
  assigned: { label: "Asignado", color: "bg-accent text-accent-foreground", icon: Package },
  in_transit: { label: "En camino", color: "bg-primary/20 text-primary", icon: Truck },
  delivered: { label: "Entregado", color: "bg-success/20 text-success-foreground", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", color: "bg-destructive/20 text-destructive", icon: Clock },
};

export function RestaurantHome() {
  const { user } = useAuth();
  const [rest, setRest] = useState<Restaurant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

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

  // Realtime updates on this restaurant's orders
  useEffect(() => {
    if (!rest?.id) return;
    const ch = supabase.channel(`rest-orders-${rest.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${rest.id}` },
        (payload: any) => {
          if (payload.eventType === "UPDATE" && payload.new?.status === "assigned" && payload.old?.status === "pending") {
            toast.success("¡Un repartidor aceptó tu pedido!");
          }
          if (payload.eventType === "UPDATE" && payload.new?.status === "delivered") {
            toast.success("Pedido entregado ✅");
          }
          load();
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [rest?.id]);

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!rest) return <RestaurantOnboarding onDone={load} />;

  const active = orders.filter((o) => !["delivered", "cancelled"].includes(o.status));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Bienvenido,</p>
        <h1 className="font-display text-2xl font-bold">{rest.name}</h1>
      </div>

      <Card className="p-6 bg-gradient-to-br from-primary to-primary-glow text-primary-foreground border-0 shadow-glow">
        <h2 className="font-display text-xl font-semibold">¿Necesitas un repartidor?</h2>
        <p className="text-sm opacity-80 mt-1">Lanza un pedido en segundos.</p>
        <Button size="lg" variant="secondary" className="mt-4 w-full" onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-5 w-5" /> Solicitar Repartidor
        </Button>
      </Card>

      <div>
        <h3 className="font-display text-lg font-semibold mb-3">Pedidos activos</h3>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin pedidos activos.</p>
        ) : (
          <div className="space-y-3">
            {active.map((o) => {
              const m = STATUS_META[o.status];
              const Icon = m.icon;
              return (
                <Card key={o.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">#{o.external_order_id ?? o.id.slice(0, 6)}</div>
                      <div className="font-medium truncate">{o.dropoff_address}</div>
                      <div className="text-sm text-muted-foreground mt-1">${Number(o.amount_to_collect).toFixed(2)} MXN</div>
                    </div>
                    <Badge className={m.color}><Icon className="h-3 w-3 mr-1" />{m.label}</Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <CreateOrderDialog open={open} onOpenChange={setOpen} restaurant={rest} onCreated={load} />
    </div>
  );
}
