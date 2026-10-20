import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SkeletonList, SkeletonStat } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Inbox } from "lucide-react";
import { formatMxn } from "@/lib/business";
import { parseOrderFlow } from "@/lib/order-flow";

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

      // Signed URLs for delivery proofs
      const proofMap: Record<string, string> = {};
      for (const o of list) {
        if (o.delivery_proof_url) {
          const { data: s } = await supabase.storage
            .from("delivery-proofs")
            .createSignedUrl(o.delivery_proof_url, 3600);
          if (s?.signedUrl) proofMap[o.id] = s.signedUrl;
        }
      }
      setProofs(proofMap);
      setLoading(false);
    })();
  }, [user?.id, role]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-7 w-32 rounded-md bg-muted/60 animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <SkeletonStat />
          <SkeletonStat />
        </div>
        <SkeletonList count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-display text-3xl font-medium">Historial</h1>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 border-hairline bg-paper/70">
          <p className="eyebrow text-graphite" style={{ color: "var(--graphite)" }}>Entregas</p>
          <p className="text-display text-3xl font-medium text-mono-tight mt-1">{stats.count}</p>
        </Card>
        <Card className="p-4 border-hairline bg-paper/70">
          <p className="eyebrow text-graphite" style={{ color: "var(--graphite)" }}>{role === "courier" ? "Cobrado" : "Total"}</p>
          <p className="text-display text-3xl font-medium text-mono-tight mt-1">${stats.total.toFixed(0)}</p>
        </Card>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Aún no hay pedidos"
          description={role === "restaurant"
            ? "Cuando solicites tu primer repartidor aparecerá aquí."
            : "Cuando aceptes tu primera entrega quedará registrada aquí."
          }
        />
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <Card key={o.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground">#{o.external_order_id ?? o.id.slice(0, 6)} · {new Date(o.created_at).toLocaleString()}</div>
                  <div className="text-sm font-medium truncate">{o.dropoff_address}</div>
                  <div className="text-sm">{formatMxn(Number(o.amount_to_collect))} cobrados al cliente</div>
                  {parseOrderFlow(o.flow).advancePaidAt && <div className="text-xs text-graphite">Anticipo entregado al restaurante</div>}
                  {parseOrderFlow(o.flow).cashCollectedAt && <div className="text-xs text-graphite">Cliente pagó el total</div>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant="secondary">{STATUS_LABELS[o.status]}</Badge>
                  {proofs[o.id] && (
                    <a href={proofs[o.id]} target="_blank" rel="noopener noreferrer" className="block">
                      <img src={proofs[o.id]} alt="Evidencia" className="h-14 w-14 rounded-md object-cover border border-border" />
                    </a>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
