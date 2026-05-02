import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Crown, ArrowDownCircle, ArrowUpCircle, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { PaymentModeBadge } from "@/components/PaymentModeBadge";

export const Route = createFileRoute("/app/wallet")({
  validateSearch: (search: Record<string, unknown>): { checkout?: string; session_id?: string } => ({
    checkout: typeof search.checkout === "string" ? search.checkout : undefined,
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: WalletPage,
});

interface Courier {
  id: string; plan: "pps" | "subscription"; wallet_balance: number;
  subscription_active: boolean; subscription_expires_at: string | null;
}

interface Tx { id: string; type: string; amount: number; balance_after: number | null; description: string | null; created_at: string; }

const TOPUPS: Array<{ amount: number; priceId: string }> = [
  { amount: 50, priceId: "wallet_topup_50_price" },
  { amount: 100, priceId: "wallet_topup_100_price" },
  { amount: 200, priceId: "wallet_topup_200_price" },
  { amount: 500, priceId: "wallet_topup_500_price" },
];
const SUB_PRICE_ID = "courier_subscription_monthly_price";
const SUB_PRICE = 249;

function WalletPage() {
  const { user, role } = useAuth();
  const search = Route.useSearch();
  const [courier, setCourier] = useState<Courier | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [checkout, setCheckout] = useState<{ priceId: string; purpose: "wallet_topup" | "subscription" } | null>(null);

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

  // Show success toast when returning from checkout
  useEffect(() => {
    if (search.checkout === "success" && search.session_id) {
      toast.success("¡Pago confirmado! Procesando tu compra…");
      // Poll briefly for webhook to land
      let tries = 0;
      const iv = setInterval(async () => {
        tries++;
        await load();
        if (tries >= 6) clearInterval(iv);
      }, 1500);
      return () => clearInterval(iv);
    }
  }, [search.checkout, search.session_id]);

  if (role !== "courier") return <Card className="p-6">Solo disponible para repartidores.</Card>;
  if (!courier) return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const subActive = courier.subscription_active && courier.subscription_expires_at && new Date(courier.subscription_expires_at) > new Date();
  const lowFunds = !subActive && Number(courier.wallet_balance) < 5;

  return (
    <div className="space-y-5">
      <PaymentTestModeBanner />

      {search.checkout === "success" && (
        <Card className="p-4 bg-success/10 border-success">
          <div className="flex gap-2">
            <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
            <div className="text-sm">
              <strong>Pago recibido.</strong> Tu saldo / suscripción se acreditará en unos segundos.
            </div>
          </div>
        </Card>
      )}

      {lowFunds && (
        <Card className="p-4 bg-warning/10 border-warning">
          <div className="flex gap-2">
            <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="text-sm">
              <strong>No estás recibiendo pedidos.</strong> Recarga al menos $5 MXN o activa la suscripción para empezar a repartir.
            </div>
          </div>
        </Card>
      )}

      <div className="relative rounded-3xl glass-dark text-bone p-7 overflow-hidden grain shadow-elegant">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(at_85%_15%,oklch(0.62_0.13_45/0.4),transparent_55%)]" />
        <div className="relative">
          <p className="eyebrow" style={{ color: "oklch(0.78 0.12 45)" }}>Saldo disponible</p>
          <p className="text-display text-5xl font-medium mt-2 text-mono-tight">
            ${Number(courier.wallet_balance).toFixed(2)}
            <span className="text-base font-normal text-bone/60 ml-2">MXN</span>
          </p>
          <div className="mt-4">
            {subActive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ember/90 text-bone px-3 py-1 text-xs font-medium">
                <Crown className="h-3 w-3" /> Suscripción hasta {new Date(courier.subscription_expires_at!).toLocaleDateString()}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-bone/15 text-bone px-3 py-1 text-xs font-medium">
                Plan PPS · $5 por entrega
              </span>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-display text-xl font-medium">Recargar monedero</h3>
          <PaymentModeBadge />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {TOPUPS.map((t) => (
            <Button
              key={t.amount}
              variant="glass"
              onClick={() => setCheckout({ priceId: t.priceId, purpose: "wallet_topup" })}
            >
              <Plus className="h-3 w-3 mr-1" />${t.amount}
            </Button>
          ))}
        </div>
        <p className="text-xs text-graphite mt-2">Pago seguro con tarjeta vía Stripe.</p>
      </div>

      <div>
        <h3 className="text-display text-xl font-medium mb-3">Plan</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            disabled
            className={`rounded-2xl p-5 border text-left transition ${courier.plan === "pps" ? "border-ink bg-paper" : "border-hairline opacity-60"}`}
          >
            <div className="text-display text-xl font-medium">PPS</div>
            <div className="text-xs text-graphite mt-1">$5 por entrega</div>
          </button>
          <button
            onClick={() => setCheckout({ priceId: SUB_PRICE_ID, purpose: "subscription" })}
            disabled={!!subActive}
            className={`rounded-2xl p-5 border text-left transition lift ${subActive ? "border-ember bg-ember/10" : "border-hairline bg-paper hover:border-ink"}`}
          >
            <div className="text-display text-xl font-medium">Suscripción</div>
            <div className="text-xs text-graphite mt-1">${SUB_PRICE}/mes ilimitado</div>
            {subActive && <div className="text-xs text-ember font-medium mt-1">Activa</div>}
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

      <Dialog open={!!checkout} onOpenChange={(v) => !v && setCheckout(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>
              {checkout?.purpose === "subscription" ? "Activar suscripción mensual" : "Recargar monedero"}
            </DialogTitle>
          </DialogHeader>
          <div className="p-2">
            {checkout && (
              <StripeEmbeddedCheckout
                priceId={checkout.priceId}
                purpose={checkout.purpose}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
