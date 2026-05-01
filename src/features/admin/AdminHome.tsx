import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Pending {
  id: string; user_id: string; address: string | null; plate: string | null; status: string;
  ine_front_url: string | null; ine_back_url: string | null; license_url: string | null;
  moto_url: string | null; plate_url: string | null; backpack_url: string | null;
  profiles?: { full_name: string | null; phone: string | null };
}

export function AdminHome() {
  const [list, setList] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

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
        for (const k of ["ine_front_url", "ine_back_url", "license_url", "moto_url", "plate_url", "backpack_url"]) {
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

  useEffect(() => { load(); }, []);

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
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Panel de validación</h1>
      <p className="text-sm text-muted-foreground">{list.length} repartidor(es) en espera</p>

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
            <div className="grid grid-cols-3 gap-2">
              {[
                ["ine_front_url", "INE Frente"],
                ["ine_back_url", "INE Reverso"],
                ["license_url", "Licencia"],
                ["moto_url", "Moto"],
                ["plate_url", "Placa"],
                ["backpack_url", "Mochila"],
              ].map(([k, label]) => {
                const url = signedUrls[`${c.id}-${k}`];
                return (
                  <a key={k as string} href={url} target="_blank" rel="noopener noreferrer"
                    className="block rounded-lg border border-border overflow-hidden text-xs">
                    {url ? <img src={url} alt={label} className="w-full h-20 object-cover" />
                         : <div className="w-full h-20 bg-muted grid place-items-center text-muted-foreground">N/A</div>}
                    <div className="px-1 py-1 flex items-center justify-between">
                      <span>{label}</span>{url && <ExternalLink className="h-3 w-3" />}
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
    </div>
  );
}
