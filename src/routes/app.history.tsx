import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/history")({
  component: HistoryPage,
});

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente", assigned: "Asignado", in_transit: "En camino",
  delivered: "Entregado", cancelled: "Cancelado",
};

function HistoryPage() {
  const { user, role } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [proofs, setProofs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ count: 0, total: 0 });

  useEffect(() => {
    (async () => {
      if (!user || !role) return;
      let q = supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(100);
      if (role === "restaurant") {
        const { data: r } = await supabase.from("restaurants").select("id").eq("user_id", user.id).maybeSingle();
        if (!r) { setLoading(false); return; }
        q = q.eq("restaurant_id", r.id);
      } else if (role === "courier") {
        const { data: c } = await supabase.from("couriers").select("id").eq("user_id", user.id).maybeSingle();
        if (!c) { setLoading(false); return; }
        q = q.eq("courier_id", c.id);
      }
      const { data } = await q;
      const list = (data ?? []) as any[];
      setOrders(list);
      const delivered = list.filter((o) => o.status === "delivered");
      setStats({
        count: delivered.length,
        total: delivered.reduce((sum, o) => sum + Number(o.amount_to_collect), 0),
      });
      setLoading(false);
    })();
  }, [user?.id, role]);

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold">Historial</h1>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Entregas</p>
          <p className="font-display text-2xl font-bold">{stats.count}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{role === "courier" ? "Cobrado a clientes" : "Total entregado"}</p>
          <p className="font-display text-2xl font-bold">${stats.total.toFixed(2)}</p>
        </Card>
      </div>

      {orders.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Aún no hay pedidos.</Card>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <Card key={o.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">#{o.external_order_id ?? o.id.slice(0, 6)} · {new Date(o.created_at).toLocaleString()}</div>
                  <div className="text-sm font-medium truncate">{o.dropoff_address}</div>
                  <div className="text-sm">${Number(o.amount_to_collect).toFixed(2)} MXN</div>
                </div>
                <Badge variant="secondary">{STATUS_LABELS[o.status]}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
