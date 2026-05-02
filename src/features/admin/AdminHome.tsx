import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle2, XCircle, ExternalLink, AlertTriangle, Clock, DollarSign, Package, Users, TrendingUp, Ban, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { getAdminFinance, adminCancelOrder, adminUnassignOrder } from "@/server/admin.functions";

interface StaleOrder {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  amount_to_collect: number;
  external_order_id: string | null;
  created_at: string;
}

interface Pending {
  id: string; user_id: string; address: string | null; plate: string | null; status: string;
  ine_front_url: string | null; ine_back_url: string | null; license_url: string | null;
  moto_url: string | null; plate_url: string | null; backpack_url: string | null;
  circulation_url: string | null;
  has_backpack: boolean | null; willing_to_get_backpack: boolean | null;
  ai_validation: Record<string, { status?: string; message?: string; extracted?: { full_name?: string | null; expiration_date?: string | null } }> | null;
  profiles?: { full_name: string | null; phone: string | null };
}

export function AdminHome() {
  const [list, setList] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [stale, setStale] = useState<StaleOrder[]>([]);
  const [finance, setFinance] = useState<Awaited<ReturnType<typeof getAdminFinance>> | null>(null);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeDays, setFinanceDays] = useState(30);
  const [actingId, setActingId] = useState<string | null>(null);

  const loadFinance = async (days: number) => {
    setFinanceLoading(true);
    try {
      const r = await getAdminFinance({ data: { days } });
      setFinance(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al cargar finanzas");
    } finally {
      setFinanceLoading(false);
    }
  };

  const handleCancel = async (orderId: string) => {
    const reason = window.prompt("Motivo de cancelación:");
    if (!reason || reason.trim().length < 3) return;
    setActingId(orderId);
    try {
      await adminCancelOrder({ data: { orderId, reason: reason.trim() } });
      toast.success("Pedido cancelado");
      loadStale();
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
    finally { setActingId(null); }
  };

  const handleUnassign = async (orderId: string) => {
    if (!window.confirm("¿Liberar este pedido para reasignación?")) return;
    setActingId(orderId);
    try {
      await adminUnassignOrder({ data: { orderId } });
      toast.success("Pedido liberado — visible para couriers");
      loadStale();
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
    finally { setActingId(null); }
  };

  const loadStale = async () => {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("orders")
      .select("id,pickup_address,dropoff_address,amount_to_collect,external_order_id,created_at")
      .eq("status", "pending")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true });
    setStale((data as any) ?? []);
  };

  const load = async () => {
    setLoading(true);
    const { data: couriers } = await supabase.from("couriers").select("*").eq("status", "pending_validation");
    if (couriers && couriers.length > 0) {
      const userIds = couriers.map((c: any) => c.user_id);
      const { data: profs } = await supabase.from("profiles").select("id,full_name,phone").in("id", userIds);
      const profMap: Record<string, any> = {};
      (profs ?? []).forEach((p: any) => { profMap[p.id] = p; });
      const enriched = couriers.map((c: any) => ({ ...c, profiles: profMap[c.user_id] }));
      setList(enriched as any);

      // Sign all doc urls
      const urls: Record<string, string> = {};
      for (const c of enriched) {
        for (const k of ["ine_front_url", "ine_back_url", "license_url", "moto_url", "plate_url", "backpack_url", "circulation_url"]) {
          const path = (c as any)[k];
          if (path) {
            const { data } = await supabase.storage.from("courier-docs").createSignedUrl(path, 3600);
            if (data?.signedUrl) urls[`${c.id}-${k}`] = data.signedUrl;
          }
        }
      }
      setSignedUrls(urls);
    } else {
      setList([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    loadStale();
    const id = setInterval(loadStale, 60_000);
    const ch = supabase.channel("admin-stale-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => loadStale())
      .subscribe();
    return () => { clearInterval(id); supabase.removeChannel(ch); };
  }, []);

  const decide = async (id: string, approve: boolean) => {
    let reason: string | null = null;
    if (!approve) {
      reason = window.prompt("Motivo del rechazo:") ?? null;
      if (!reason) return;
    }
    const { error } = await supabase.from("couriers").update({
      status: approve ? "active" : "rejected",
      rejection_reason: reason,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(approve ? "Repartidor aprobado" : "Repartidor rechazado");
    load();
  };

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Panel de administrador</h1>
        <p className="text-sm text-muted-foreground">Validaciones, finanzas y monitoreo en vivo</p>
      </div>

      <Tabs defaultValue="ops" onValueChange={(v) => { if (v === "finance" && !finance) loadFinance(financeDays); }}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="ops">Incidencias</TabsTrigger>
          <TabsTrigger value="validation">Validación ({list.length})</TabsTrigger>
          <TabsTrigger value="finance">Finanzas</TabsTrigger>
        </TabsList>

        {/* INCIDENCIAS */}
        <TabsContent value="ops" className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Pedidos sin asignar &gt; 10 min
            </h2>
            {stale.length > 0 && <Badge className="bg-destructive text-destructive-foreground">{stale.length}</Badge>}
          </div>
          {stale.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground">Sin alertas — todo fluye 🎯</Card>
          ) : (
            <div className="space-y-2">
              {stale.map((o) => {
                const mins = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
                const busy = actingId === o.id;
                return (
                  <Card key={o.id} className="p-3 border-destructive/50 bg-destructive/5">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0 text-sm flex-1">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                          <span className="font-medium">#{o.external_order_id ?? o.id.slice(0, 6)}</span>
                          <Badge variant="destructive" className="text-[10px]">{mins} min</Badge>
                        </div>
                        <div className="text-muted-foreground mt-1 truncate">→ {o.dropoff_address}</div>
                        <div className="text-xs text-muted-foreground">${Number(o.amount_to_collect).toFixed(2)} MXN</div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => handleUnassign(o.id)}>
                          <RotateCcw className="h-3 w-3 mr-1" /> Liberar
                        </Button>
                        <Button size="sm" variant="destructive" disabled={busy} onClick={() => handleCancel(o.id)}>
                          <Ban className="h-3 w-3 mr-1" /> Cancelar
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* FINANZAS */}
        <TabsContent value="finance" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            {[7, 30, 90].map((d) => (
              <Button key={d} variant={financeDays === d ? "default" : "outline"} size="sm"
                onClick={() => { setFinanceDays(d); loadFinance(d); }}>
                {d} días
              </Button>
            ))}
          </div>
          {financeLoading || !finance ? (
            <div className="grid place-items-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Package className="h-3 w-3" /> Entregados</div>
                  <div className="text-2xl font-bold">{finance.totals.ordersDelivered}</div>
                  <div className="text-[10px] text-muted-foreground">de {finance.totals.ordersCreated} creados</div>
                </Card>
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Envíos cobrados</div>
                  <div className="text-2xl font-bold">${finance.totals.totalShipping.toLocaleString()}</div>
                </Card>
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Comisión PPS</div>
                  <div className="text-2xl font-bold">${finance.totals.commissionEstimate.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground">$20 × pedido sin sub</div>
                </Card>
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Couriers activos</div>
                  <div className="text-2xl font-bold">{finance.totals.activeCouriers}</div>
                  <div className="text-[10px] text-muted-foreground">de {finance.totals.totalCouriers} totales</div>
                </Card>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Card className="p-3">
                  <h3 className="font-semibold text-sm mb-2">Top restaurantes</h3>
                  {finance.topRestaurants.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin datos</p>
                  ) : (
                    <ul className="space-y-1.5 text-sm">
                      {finance.topRestaurants.map((r) => (
                        <li key={r.id} className="flex justify-between gap-2">
                          <span className="truncate">{r.name}</span>
                          <span className="text-muted-foreground shrink-0">{r.count} · ${r.revenue.toFixed(0)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
                <Card className="p-3">
                  <h3 className="font-semibold text-sm mb-2">Top couriers</h3>
                  {finance.topCouriers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin datos</p>
                  ) : (
                    <ul className="space-y-1.5 text-sm">
                      {finance.topCouriers.map((c) => (
                        <li key={c.id} className="flex justify-between gap-2">
                          <span className="truncate">{c.name}</span>
                          <span className="text-muted-foreground shrink-0">
                            {c.count}{c.score != null && ` · ⭐${c.score}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>

              <div className="text-xs text-muted-foreground">
                Cancelados: {finance.totals.ordersCancelled} · Cobrado al cliente: ${finance.totals.totalCollected.toLocaleString()}
              </div>
            </>
          )}
        </TabsContent>

        {/* VALIDACIÓN */}
        <TabsContent value="validation" className="space-y-3 mt-4">
          <h2 className="font-display text-lg font-semibold">Repartidores pendientes ({list.length})</h2>

      {list.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Sin solicitudes pendientes 🎉</Card>
      ) : (
        list.map((c) => (
          <Card key={c.id} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{c.profiles?.full_name ?? "Sin nombre"}</div>
                <div className="text-xs text-muted-foreground">📞 {c.profiles?.phone ?? "—"} · Placa: {c.plate ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{c.address ?? "Sin domicilio"}</div>
              </div>
              <Badge className="bg-warning/20 text-warning-foreground">Pendiente</Badge>
            </div>
            {(c.has_backpack !== null || c.willing_to_get_backpack !== null) && (
              <div className="text-xs text-muted-foreground">
                Mochila: <strong>{c.has_backpack ? "Sí" : "No"}</strong>
                {c.has_backpack === false && (
                  <> · Dispuesto a conseguir: <strong>{c.willing_to_get_backpack ? "Sí" : "No"}</strong></>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                ["ine_front_url", "INE Frente", "ine_front"],
                ["ine_back_url", "INE Reverso", "ine_back"],
                ["license_url", "Licencia", "license"],
                ["circulation_url", "T. Circulación", "circulation"],
                ["moto_url", "Moto", null],
                ["plate_url", "Placa", null],
                ["backpack_url", "Mochila", null],
              ].map(([k, label, aiKey]) => {
                const url = signedUrls[`${c.id}-${k}`];
                const ai = aiKey ? c.ai_validation?.[aiKey as string] : null;
                const aiBadge = ai?.status === "valid"
                  ? { cls: "bg-success/20 text-success-foreground border-success", txt: "✓ IA" }
                  : ai?.status === "needs_review"
                  ? { cls: "bg-warning/20 text-warning-foreground border-warning", txt: "⚠ Revisar" }
                  : ai?.status
                  ? { cls: "bg-destructive/20 text-destructive border-destructive", txt: "✗ " + (ai.status as string) }
                  : null;
                return (
                  <a key={k as string} href={url} target="_blank" rel="noopener noreferrer"
                    className="block rounded-lg border border-border overflow-hidden text-xs">
                    {url ? <img src={url} alt={label as string} className="w-full h-20 object-cover" />
                         : <div className="w-full h-20 bg-muted grid place-items-center text-muted-foreground">N/A</div>}
                    <div className="px-1.5 py-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{label}</span>{url && <ExternalLink className="h-3 w-3" />}
                      </div>
                      {aiBadge && (
                        <div className={`mt-1 inline-block px-1.5 py-0.5 rounded text-[10px] border ${aiBadge.cls}`}>
                          {aiBadge.txt}
                        </div>
                      )}
                      {ai?.extracted?.full_name && (
                        <div className="mt-0.5 text-[10px] text-muted-foreground truncate" title={ai.extracted.full_name}>
                          {ai.extracted.full_name}
                        </div>
                      )}
                      {ai?.extracted?.expiration_date && (
                        <div className="text-[10px] text-muted-foreground">vence {ai.extracted.expiration_date}</div>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="destructive" onClick={() => decide(c.id, false)}>
                <XCircle className="mr-2 h-4 w-4" /> Rechazar
              </Button>
              <Button onClick={() => decide(c.id, true)}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Aprobar
              </Button>
            </div>
          </Card>
        ))
      )}
      </section>
    </div>
  );
}
