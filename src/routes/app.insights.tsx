import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Loader2, TrendingUp, Package, Clock, DollarSign, Trophy, Star } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export const Route = createFileRoute("/app/insights")({
  component: InsightsPage,
  head: () => ({
    meta: [
      { title: "Métricas del restaurante · 1Click" },
      { name: "description", content: "Ventas, pedidos y desempeño de tu restaurante en 1Click." },
      { property: "og:title", content: "Métricas del restaurante · 1Click" },
      { property: "og:description", content: "Ventas, pedidos y desempeño de tu restaurante en 1Click." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

interface OrderRow {
  id: string;
  status: string;
  amount_to_collect: number | null;
  shipping_fee: number | null;
  created_at: string;
  delivered_at: string | null;
  accepted_at: string | null;
  courier_id: string | null;
}

interface CourierRow {
  id: string;
  user_id: string;
  stats_score: number;
  full_name?: string | null;
}

const RANGES = [
  { value: 7, label: "7 días" },
  { value: 30, label: "30 días" },
  { value: 90, label: "90 días" },
];

function InsightsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [days, setDays] = useState(7);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [topCouriers, setTopCouriers] = useState<Array<{ id: string; name: string; count: number; score: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && role && role !== "restaurant" && role !== "admin") {
      navigate({ to: "/app" });
    }
  }, [role, authLoading, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      setLoading(true);
      const { data: r } = await supabase.from("restaurants").select("id").eq("user_id", user.id).maybeSingle();
      if (!r) {
        if (!cancelled) { setOrders([]); setLoading(false); }
        return;
      }
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const { data: o } = await supabase
        .from("orders")
        .select("id,status,amount_to_collect,shipping_fee,created_at,delivered_at,accepted_at,courier_id")
        .eq("restaurant_id", r.id)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (cancelled) return;
      const rows = (o ?? []) as OrderRow[];
      setOrders(rows);

      // Top couriers
      const counts: Record<string, number> = {};
      rows.forEach((row) => {
        if (row.status === "delivered" && row.courier_id) {
          counts[row.courier_id] = (counts[row.courier_id] ?? 0) + 1;
        }
      });
      const ids = Object.keys(counts);
      if (ids.length) {
        const { data: cs } = await supabase
          .from("couriers")
          .select("id,user_id,stats_score")
          .in("id", ids);
        const userIds = (cs ?? []).map((c: any) => c.user_id);
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", userIds);
        const profMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
        const list = (cs ?? []).map((c: any) => ({
          id: c.id,
          name: profMap.get(c.user_id) ?? "Repartidor",
          count: counts[c.id] ?? 0,
          score: Number(c.stats_score ?? 0),
        }));
        list.sort((a, b) => b.count - a.count);
        if (!cancelled) setTopCouriers(list.slice(0, 5));
      } else {
        if (!cancelled) setTopCouriers([]);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, days]);

  const stats = useMemo(() => {
    const delivered = orders.filter((o) => o.status === "delivered");
    const cancelled = orders.filter((o) => o.status === "cancelled");
    const totalRevenue = delivered.reduce((s, o) => s + Number(o.amount_to_collect ?? 0), 0);
    const totalShipping = delivered.reduce((s, o) => s + Number(o.shipping_fee ?? 0), 0);
    const avgTicket = delivered.length ? totalRevenue / delivered.length : 0;
    const times = delivered
      .filter((o) => o.delivered_at && o.accepted_at)
      .map((o) => (new Date(o.delivered_at!).getTime() - new Date(o.accepted_at!).getTime()) / 60000);
    const avgMinutes = times.length ? times.reduce((s, t) => s + t, 0) / times.length : 0;
    const completionRate = orders.length ? (delivered.length / orders.length) * 100 : 0;

    // Pedidos por día (últimos 7 días visibles)
    const buckets: Record<string, number> = {};
    const showDays = Math.min(days, 14);
    for (let i = showDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      buckets[d.toISOString().slice(0, 10)] = 0;
    }
    orders.forEach((o) => {
      const k = o.created_at.slice(0, 10);
      if (k in buckets) buckets[k]++;
    });
    const series = Object.entries(buckets).map(([d, c]) => ({ d, c }));
    const maxC = Math.max(1, ...series.map((s) => s.c));

    return {
      total: orders.length,
      delivered: delivered.length,
      cancelled: cancelled.length,
      totalRevenue,
      totalShipping,
      avgTicket,
      avgMinutes,
      completionRate,
      series,
      maxC,
    };
  }, [orders, days]);

  if (authLoading || loading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Tu negocio</p>
          <h1 className="font-display text-2xl font-bold">Métricas</h1>
        </div>
        <div className="flex gap-1 p-1 rounded-full bg-muted/50">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setDays(r.value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full transition ${
                days === r.value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Aún sin datos"
          description="Cuando tengas pedidos en este rango aparecerán tus métricas aquí."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard icon={Package} label="Pedidos" value={stats.total.toString()} sub={`${stats.delivered} entregados`} />
            <KpiCard icon={DollarSign} label="Ticket promedio" value={`$${stats.avgTicket.toFixed(0)}`} sub="MXN por pedido" />
            <KpiCard icon={Clock} label="Tiempo promedio" value={`${stats.avgMinutes.toFixed(0)} min`} sub="aceptado → entregado" />
            <KpiCard icon={TrendingUp} label="Tasa de éxito" value={`${stats.completionRate.toFixed(0)}%`} sub={`${stats.cancelled} cancelados`} />
          </div>

          <Card className="p-5">
            <h3 className="font-display text-lg font-semibold mb-4">Pedidos por día</h3>
            <div className="flex items-end gap-1.5 h-32">
              {stats.series.map((s) => (
                <div key={s.d} className="flex-1 flex flex-col items-center gap-1.5 group">
                  <div className="text-[10px] font-semibold text-muted-foreground opacity-0 group-hover:opacity-100 transition">
                    {s.c}
                  </div>
                  <div
                    className="w-full bg-gradient-to-t from-primary to-primary-glow rounded-t-md transition-all min-h-[4px]"
                    style={{ height: `${(s.c / stats.maxC) * 100}%` }}
                    title={`${s.d}: ${s.c} pedidos`}
                  />
                  <div className="text-[9px] text-muted-foreground tracking-wider">
                    {new Date(s.d).getDate()}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-5 w-5 text-warning" />
              <h3 className="font-display text-lg font-semibold">Top repartidores</h3>
            </div>
            {topCouriers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin entregas completadas todavía.</p>
            ) : (
              <div className="space-y-2">
                {topCouriers.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                    <div className="w-7 h-7 rounded-full bg-muted grid place-items-center text-xs font-bold">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Star className="h-3 w-3 fill-warning text-warning" />
                        {c.score.toFixed(1)}
                      </div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums">{c.count} entregas</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5 bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
            <p className="text-sm text-muted-foreground">Ingreso total cobrado en este rango</p>
            <p className="font-display text-3xl font-bold mt-1">${stats.totalRevenue.toFixed(2)} MXN</p>
            <p className="text-xs text-muted-foreground mt-1">Envíos: ${stats.totalShipping.toFixed(2)} MXN</p>
          </Card>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
        <Icon className="h-3.5 w-3.5" />
        <span className="uppercase tracking-wider">{label}</span>
      </div>
      <div className="font-display text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}
