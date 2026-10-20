import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/reset")({
  component: ResetPage,
  head: () => ({
    meta: [
      { title: "Restablecer contraseña — 1Click" },
      { name: "description", content: "Define una nueva contraseña para tu cuenta de 1Click." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function ResetPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // The recovery link can arrive in three formats:
  //  - PKCE flow: ?code=... (needs exchangeCodeForSession)
  //  - Implicit flow: #access_token=...&type=recovery (auto-handled by detectSessionInUrl)
  //  - token_hash flow: ?token_hash=...&type=recovery (needs verifyOtp)
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");
        const errDesc = url.searchParams.get("error_description") || url.hash.match(/error_description=([^&]+)/)?.[1];

        if (errDesc) {
          setError(decodeURIComponent(errDesc));
          return;
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (!cancelled) {
            setReady(true);
            window.history.replaceState({}, "", "/auth/reset");
          }
          return;
        }

        if (tokenHash && (type === "recovery" || !type)) {
          const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
          if (error) throw error;
          if (!cancelled) {
            setReady(true);
            window.history.replaceState({}, "", "/auth/reset");
          }
          return;
        }

        // Fallback: implicit flow / existing session
        const { data } = await supabase.auth.getSession();
        if (data.session && !cancelled) setReady(true);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "El enlace de recuperación no es válido o ha expirado.");
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });

    init();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Mínimo 8 caracteres");
    if (password !== confirm) return toast.error("Las contraseñas no coinciden");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Contraseña actualizada");
    navigate({ to: "/app" });
  };

  return (
    <div className="min-h-screen bg-brand text-brand-foreground flex flex-col">
      <header className="px-6 py-5 max-w-md mx-auto w-full">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold">
          <Zap className="h-6 w-6 text-primary" fill="currentColor" /> 1-Click
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 pb-10">
        <div className="w-full max-w-md rounded-3xl bg-card text-card-foreground p-7 shadow-elegant">
          <h1 className="font-display text-2xl font-bold">Nueva contraseña</h1>
          <p className="text-sm text-muted-foreground">Define una contraseña para tu cuenta.</p>

          {error ? (
            <p className="mt-6 text-sm text-destructive">
              {error}{" "}
              <Link to="/auth" className="text-primary underline">
                Volver
              </Link>
            </p>
          ) : !ready ? (
            <p className="mt-6 text-sm text-muted-foreground">
              Validando enlace… Si llegaste aquí sin un correo de recuperación,{" "}
              <Link to="/auth" className="text-primary underline">
                vuelve a iniciar sesión
              </Link>
              .
            </p>
          ) : (
            <form onSubmit={onSubmit} className="mt-5 space-y-3">
              <div>
                <Label htmlFor="np">Contraseña (mín. 8)</Label>
                <Input
                  id="np"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="np2">Confirmar contraseña</Label>
                <Input
                  id="np2"
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full mt-2">
                Guardar contraseña
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
