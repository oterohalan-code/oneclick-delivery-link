import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Crown, AlertCircle, CheckCircle2, Receipt } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { BUSINESS, formatMxn } from "@/lib/business";
import {
  cancelMembershipRenewal,
  createMembershipCheckout,
  getMembership,
} from "@/lib/rpc/membership.functions";

export const Route = createFileRoute("/app/wallet")({
  head: () => ({ meta: [
    { title: "Membresía — 1Click" },
    { name: "description", content: "Consulta tu membresía y tus pagos en 1Click." },
    { property: "og:title", content: "Membresía — 1Click" },
    { property: "og:description", content: "Consulta tu membresía y tus pagos en 1Click." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  validateSearch: (search: Record<string, unknown>): { checkout?: string; ref?: string } => ({
    checkout: typeof search.checkout === "string" ? search.checkout : undefined,
    ref: typeof search.ref === "string" ? search.ref : undefined,
  }),
  component: MembershipPage,
});

function MembershipPage() {
  const { user, role, session } = useAuth();
  const search = Route.useSearch();
  const getMembershipFn = useServerFn(getMembership);
  const createCheckoutFn = useServerFn(createMembershipCheckout);
  const cancelRenewalFn = useServerFn(cancelMembershipRenewal);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"manual" | "auto" | "cancel" | null>(null);
  const [membership, setMembership] = useState<Awaited<ReturnType<typeof getMembership>> | null>(null);

  const token = session?.access_token;
  const membershipRole = role === "restaurant" || role === "courier" ? role : null;

  const load = async () => {
    if (!token || !membershipRole) return;
    const data = await getMembershipFn({
      headers: { Authorization: `Bearer ${token}` },
      data: { role: membershipRole },
    });
    setMembership(data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [user?.id, membershipRole, token]);

  useEffect(() => {
    if (search.checkout !== "pending" || !membershipRole) return;
    let tries = 0;
    const iv = setInterval(async () => {
      tries += 1;
      await load();
      if (tries >= 10) clearInterval(iv);
    }, 2000);
    return () => clearInterval(iv);
  }, [search.checkout, membershipRole]);

  const startCheckout = async (mode: "manual" | "auto") => {
    if (!token || !membershipRole) return;
    setBusy(mode);
    const result = await createCheckoutFn({
      headers: { Authorization: `Bearer ${token}` },
      data: { role: membershipRole, mode },
    });
    setBusy(null);
    if (!result?.ok) return toast.error(result?.message ?? "No se pudo crear el pago.");
    window.location.assign(result.checkoutUrl);
  };

  const cancelRenewal = async () => {
    if (!token || !membershipRole) return;
    setBusy("cancel");
    const result = await cancelRenewalFn({
      headers: { Authorization: `Bearer ${token}` },
      data: { role: membershipRole },
    });
    setBusy(null);
    if (!result?.ok) return toast.error(result?.message ?? "No se pudo cancelar.");
    toast.success("Renovación automática desactivada.");
    await load();
  };

  if (!membershipRole) {
    return <Card className="p-6">La membresía es para restaurantes y repartidores.</Card>;
  }
  if (loading || !membership) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const amountLabel = formatMxn(membership.amountMxn);
  const who = membershipRole === "restaurant" ? "restaurante" : "repartidor";
  const periodEnd = membership.periodEnd
    ? new Date(membership.periodEnd).toLocaleDateString("es-MX")
    : null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">{BUSINESS.coverageLabel}</p>
        <h1 className="font-display text-2xl font-bold">Membresía</h1>
      </div>

      {search.checkout === "pending" && (
        <Card className="p-4 border-primary/30 bg-primary/5">
          <p className="text-sm">Si ya pagaste, la membresía se activa en unos segundos.</p>
        </Card>
      )}

      <Card className="p-6 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-muted-foreground">Membresía de {who}</div>
            <div className="text-display text-3xl font-medium">{amountLabel}<span className="text-base text-muted-foreground"> / mes</span></div>
          </div>
          {membership.active ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 text-success-foreground px-3 py-1 text-xs font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" /> Activa
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold">
              <AlertCircle className="h-3.5 w-3.5" /> Inactiva
            </span>
          )}
        </div>
        {membership.active && periodEnd && (
          <p className="text-sm text-muted-foreground">Vigente hasta {periodEnd}{membership.autoRenew ? " · renovación automática" : ""}.</p>
        )}
        {!membership.active && (
          <p className="text-sm text-muted-foreground">
            One Click solo cobra esta membresía. La comida se queda en el restaurante y el envío con el repartidor.
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button disabled={!!busy} onClick={() => startCheckout("manual")}>
            {busy === "manual" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
            Pagar este mes
          </Button>
          <Button variant="secondary" disabled={!!busy} onClick={() => startCheckout("auto")}>
            {busy === "auto" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Renovación automática
          </Button>
        </div>
        {membership.autoRenew && (
          <Button variant="ghost" disabled={!!busy} onClick={cancelRenewal}>
            {busy === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Cancelar renovación
          </Button>
        )}
      </Card>

      <div>
        <h2 className="text-display text-xl font-medium mb-2">Pagos</h2>
        {membership.payments.length === 0 ? (
          <EmptyState icon={Receipt} title="Sin pagos aún" description="Cuando pagues la membresía, el historial aparece aquí." variant="subtle" />
        ) : (
          <div className="space-y-2">
            {membership.payments.map((p) => (
              <Card key={p.id} className="p-3 flex items-center justify-between">
                <div className="text-sm">
                  {formatMxn(p.amount_cents / 100)} · {p.status}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(p.paid_at ?? p.created_at).toLocaleDateString("es-MX")}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
