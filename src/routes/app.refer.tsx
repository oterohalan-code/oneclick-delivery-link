import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { getMyReferral, applyReferralCode } from "@/server/referrals.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Gift, Copy, Share2, Users, Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/refer")({
  component: ReferPage,
  head: () => ({
    meta: [{ title: "Invita y gana · 1Click" }],
  }),
});

function ReferPage() {
  const { user, session } = useAuth();
  const getMine = useServerFn(getMyReferral);
  const apply = useServerFn(applyReferralCode);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ code: string; total: number; completed: number; earnings: number } | null>(null);
  const [refInput, setRefInput] = useState("");
  const [applying, setApplying] = useState(false);

  const load = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = await getMine({ headers: { Authorization: `Bearer ${session.access_token}` } });
      setData(res as any);
    } catch (e: any) {
      toast.error(e?.message ?? "Error cargando tu código");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [session?.access_token]);

  // Auto-apply pending referral code from localStorage (captured at landing)
  useEffect(() => {
    if (!session?.access_token || !data) return;
    const pending = localStorage.getItem("pending_ref_code");
    if (!pending) return;
    if (pending.toUpperCase() === data.code.toUpperCase()) {
      localStorage.removeItem("pending_ref_code");
      return;
    }
    apply({
      headers: { Authorization: `Bearer ${session.access_token}` },
      data: { code: pending },
    })
      .then((r: any) => {
        if (r?.ok) toast.success("Código de referido aplicado 🎉");
        localStorage.removeItem("pending_ref_code");
      })
      .catch(() => localStorage.removeItem("pending_ref_code"));
  }, [data?.code, session?.access_token]);

  const link = data ? `${window.location.origin}/?ref=${data.code}` : "";

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const share = async () => {
    if (!link) return;
    const text = `Únete a 1Click con mi código ${data?.code}: ${link}`;
    if (navigator.share) {
      try { await navigator.share({ title: "1Click", text, url: link }); return; } catch {}
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const onApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !refInput.trim()) return;
    setApplying(true);
    try {
      const r: any = await apply({
        headers: { Authorization: `Bearer ${session.access_token}` },
        data: { code: refInput.trim() },
      });
      if (r?.ok) {
        toast.success("¡Código aplicado! Gana cuando completes tu primer pedido.");
        setRefInput("");
        load();
      } else {
        toast.error(r?.error ?? "No se pudo aplicar");
      }
    } finally {
      setApplying(false);
    }
  };

  if (loading || !user) {
    return <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Programa de referidos</p>
        <h1 className="font-display text-2xl font-bold">Invita y gana $50 MXN</h1>
      </div>

      <Card className="p-6 bg-gradient-to-br from-primary to-primary-glow text-primary-foreground border-0 shadow-glow">
        <div className="flex items-center gap-2 text-sm opacity-90">
          <Gift className="h-4 w-4" /> Tu código
        </div>
        <div className="font-display text-4xl font-bold tracking-wider mt-2">{data?.code}</div>
        <p className="text-sm opacity-80 mt-3">
          Comparte tu enlace. Cuando un repartidor se registre con tu código y complete su primer pedido,
          ambos reciben $50 MXN.
        </p>
        <div className="flex gap-2 mt-4">
          <Button variant="secondary" className="flex-1" onClick={share}>
            <Share2 className="h-4 w-4 mr-2" /> Compartir
          </Button>
          <Button variant="secondary" onClick={copy} aria-label="Copiar enlace">
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
            <Users className="h-3.5 w-3.5" /> Invitados
          </div>
          <div className="font-display text-2xl font-bold tabular-nums">{data?.total ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
            <Gift className="h-3.5 w-3.5" /> Activados
          </div>
          <div className="font-display text-2xl font-bold tabular-nums">{data?.completed ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
            <Wallet className="h-3.5 w-3.5" /> Ganado
          </div>
          <div className="font-display text-2xl font-bold tabular-nums">${data?.earnings ?? 0}</div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-display text-lg font-semibold mb-1">¿Te invitaron?</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Ingresa el código de quien te invitó. Solo puedes hacerlo una vez.
        </p>
        <form onSubmit={onApply} className="flex gap-2">
          <Input
            placeholder="ABC123"
            value={refInput}
            onChange={(e) => setRefInput(e.target.value.toUpperCase())}
            maxLength={16}
            className="uppercase tracking-wider"
          />
          <Button type="submit" disabled={applying || !refInput.trim()}>
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
