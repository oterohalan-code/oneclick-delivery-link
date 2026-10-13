import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  head: () => ({ meta: [{ title: "Conectar con 1Click" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Falta el identificador de autorización.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { next: location.pathname + location.searchStr } });
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.searchStr).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(id);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    const { data: u } = await supabase.auth.getUser();
    return { details: data, email: u.user?.email ?? "" };
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen grid place-items-center p-6">
      <Card className="p-6 max-w-md text-center">
        <h1 className="text-xl font-semibold">No se pudo cargar la solicitud</h1>
        <p className="text-sm text-muted-foreground mt-2">{error instanceof Error ? error.message : String(error)}</p>
      </Card>
    </main>
  ),
});

function Consent() {
  const { details, email } = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = details?.client?.name ?? "una aplicación";
  const scopes: string[] = String(details?.scope ?? "").split(" ").filter(Boolean);
  const label = (s: string) => s === "openid" ? "Identificarte" : s === "email" ? "Compartir tu correo" : s === "profile" ? "Compartir tu perfil básico" : `Permiso adicional: ${s}`;

  async function decide(approve: boolean) {
    setBusy(true); setError(null);
    const { data, error } = approve ? await oauth().approveAuthorization(authorization_id) : await oauth().denyAuthorization(authorization_id);
    if (error) { setBusy(false); setError(error.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("El servidor no devolvió a dónde continuar."); return; }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-background">
      <Card className="p-6 max-w-md w-full space-y-4">
        <h1 className="text-2xl font-semibold">Conectar {client} con 1Click</h1>
        <p className="text-sm text-muted-foreground">Sesión: {email}</p>
        <p className="text-sm">{client} podrá consultar tus pedidos y tu monedero como tú, mientras la conexión esté activa.</p>
        {details?.redirect_uri && <p className="text-xs text-muted-foreground break-all">Destino: {details.redirect_uri}</p>}
        {scopes.length > 0 && <ul className="text-sm list-disc pl-5">{scopes.map((s) => <li key={s}>{label(s)}</li>)}</ul>}
        <p className="text-xs text-muted-foreground">Esto no salta los permisos de 1Click.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>Aprobar</Button>
          <Button className="flex-1" variant="outline" disabled={busy} onClick={() => decide(false)}>Cancelar conexión</Button>
        </div>
      </Card>
    </main>
  );
}
