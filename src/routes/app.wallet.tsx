import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Crown, ArrowDownCircle, ArrowUpCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/wallet")({
  component: WalletPage,
});

interface Courier {
  id: string; plan: "pps" | "subscription"; wallet_balance: number;
  subscription_active: boolean; subscription_expires_at: string | null;
}

interface Tx { id: string; type: string; amount: number; balance_after: number | null; description: string | null; created_at: string; }

const TOPUPS = [50, 100, 200, 500];
const SUB_PRICE = 249;

function WalletPage() {
  const { user, role } = useAuth();
  const [courier, setCourier] = useState<Courier | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data: c } = await supabase.from("couriers").select("*").eq("user_id", user.id).maybeSingle();
    setCourier(c as any);
    if (c) {
      const { data: t } = await supabase.from("wallet_transactions").select("*")
        .eq("courier_id", (c as any).id).order("created_at", { ascending: false }).limit(50);
      setTxs((t as any) ?? []);
    }
  };

  useEffect(() => { load(); }, [user?.id]);

  if (role !== "courier") return <Card className="p-6">Solo disponible para repartidores.</Card>;
  if (!courier) return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const subActive = courier.subscription_active && courier.subscription_expires_at && new Date(courier.subscription_expires_at) > new Date();

  const topUp = async (amount: number) => {
    setBusy(true);
    const newBal = Number(courier.wallet_balance) + amount;
    const { error: e1 } = await supabase.from("couriers").update({ wallet_balance: newBal }).eq("id", courier.id);
    const { error: e2 } = await supabase.from("wallet_transactions").insert({
      courier_id: courier.id, type: "topup", amount, balance_after: newBal, description: `Recarga $${amount}`,
    });
    setBusy(false);
    if (e1 || e2) return toast.error("Error al recargar");
    toast.success(`Recargaste $${amount}`);
    load();
  };

  const activateSub = async () => {
    setBusy(true);
    const expires = new Date();
    expires.setMonth(expires.getMonth() + 1);
    const { error: e1 } = await supabase.from("couriers").update({
      plan: "subscription", subscription_active: true, subscription_expires_at: expires.toISOString(),
    }).eq("id", courier.id);
    const { error: e2 } = await supabase.from("subscriptions").insert({
      courier_id: courier.id, amount: SUB_PRICE, expires_at: expires.toISOString(),
    });
    await supabase.from("wallet_transactions").insert({
      courier_id: courier.id, type: "subscription_charge", amount: -SUB_PRICE, balance_after: Number(courier.wallet_balance),
      description: "Activación de suscripción mensual",
    });
    setBusy(false);
    if (e1 || e2) return toast.error("Error al activar");
    toast.success("¡Suscripción activa por 30 días!");
    load();
  };

  const switchPlan = async (next: "pps" | "subscription") => {
    if (next === "subscription") return activateSub();
    // a PPS: la suscripción se mantiene vigente; solo cambia el plan preferido
    setBusy(true);
    const { error } = await supabase.from("couriers").update({ plan: "pps" }).eq("id", courier.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(subActive ? "Cambiaste a PPS. Tu suscripción sigue activa hasta el vencimiento." : "Cambiaste a PPS.");
    load();
  };

  return (
    <div className="space-y-5">
      <Card className="p-6 bg-gradient-to-br from-brand to-sidebar-accent text-brand-foreground border-0">
        <p className="text-xs opacity-70 uppercase tracking-wider">Saldo disponible</p>
        <p className="font-display text-4xl font-bold mt-1">${Number(courier.wallet_balance).toFixed(2)}</p>
        <p className="text-xs opacity-60 mt-1">MXN</p>
        <div className="mt-3">
          {subActive ? (
            <Badge className="bg-primary text-primary-foreground"><Crown className="h-3 w-3 mr-1" /> Suscripción hasta {new Date(courier.subscription_expires_at!).toLocaleDateString()}</Badge>
          ) : (
            <Badge className="bg-secondary text-secondary-foreground">Plan PPS · $5 por entrega</Badge>
          )}
        </div>
      </Card>

      <div>
        <h3 className="font-display text-lg font-semibold mb-3">Recargar monedero</h3>
        <div className="grid grid-cols-4 gap-2">
          {TOPUPS.map((a) => (
            <Button key={a} variant="secondary" disabled={busy} onClick={() => topUp(a)}>
              <Plus className="h-3 w-3 mr-1" />${a}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">* Recargas simuladas en este MVP.</p>
      </div>

      <div>
        <h3 className="font-display text-lg font-semibold mb-3">Plan</h3>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => switchPlan("pps")} disabled={busy}
            className={`rounded-xl p-4 border-2 text-left ${courier.plan === "pps" ? "border-primary bg-primary/5" : "border-border"}`}>
            <div className="font-semibold">PPS</div>
            <div className="text-xs text-muted-foreground">$5 por entrega</div>
          </button>
          <button onClick={() => switchPlan("subscription")} disabled={busy}
            className={`rounded-xl p-4 border-2 text-left ${subActive ? "border-primary bg-primary/5" : "border-border"}`}>
            <div className="font-semibold">Suscripción</div>
            <div className="text-xs text-muted-foreground">${SUB_PRICE}/mes ilimitado</div>
          </button>
        </div>
      </div>

      <div>
        <h3 className="font-display text-lg font-semibold mb-3">Movimientos</h3>
        {txs.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay movimientos.</p> : (
          <div className="space-y-2">
            {txs.map((t) => (
              <Card key={t.id} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {Number(t.amount) > 0 ? <ArrowUpCircle className="h-5 w-5 text-success" /> : <ArrowDownCircle className="h-5 w-5 text-destructive" />}
                  <div>
                    <div className="text-sm font-medium">{t.description ?? t.type}</div>
                    <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
                  </div>
                </div>
                <div className={`text-sm font-semibold ${Number(t.amount) > 0 ? "text-success" : "text-destructive"}`}>
                  {Number(t.amount) > 0 ? "+" : ""}${Number(t.amount).toFixed(2)}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
