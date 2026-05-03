import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (s: Record<string, unknown>) => ({ token: typeof s.token === "string" ? s.token : "" }),
  component: UnsubscribePage,
  head: () => ({ meta: [{ title: "Cancelar suscripción — 1-Click" }] }),
});

function UnsubscribePage() {
  const { token } = Route.useSearch();
  const [state, setState] = useState<"loading" | "valid" | "already" | "invalid" | "done" | "error">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) setState("valid");
        else if (d.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      })
      .catch(() => setState("error"));
  }, [token]);

  const confirm = async () => {
    setBusy(true);
    try {
      const r = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const d = await r.json();
      setState(d.success ? "done" : d.reason === "already_unsubscribed" ? "already" : "error");
    } catch { setState("error"); }
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background text-foreground">
      <GlassCard variant="strong" className="w-full max-w-md p-8 text-center">
        <h1 className="text-2xl font-medium mb-3">Cancelar suscripción</h1>
        {state === "loading" && <p className="text-sm text-muted-foreground">Validando enlace…</p>}
        {state === "valid" && (
          <>
            <p className="text-sm text-muted-foreground mb-6">¿Confirmas que deseas dejar de recibir correos de 1-Click?</p>
            <Button onClick={confirm} disabled={busy} size="lg" className="w-full">
              {busy ? "Procesando…" : "Confirmar cancelación"}
            </Button>
          </>
        )}
        {state === "already" && <p className="text-sm text-muted-foreground">Ya estás dado de baja. No recibirás más correos.</p>}
        {state === "done" && <p className="text-sm text-muted-foreground">✅ Listo. No recibirás más correos.</p>}
        {state === "invalid" && <p className="text-sm text-destructive">Enlace inválido o expirado.</p>}
        {state === "error" && <p className="text-sm text-destructive">Hubo un error. Inténtalo más tarde.</p>}
      </GlassCard>
    </div>
  );
}
