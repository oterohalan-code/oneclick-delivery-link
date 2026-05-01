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
  head: () => ({ meta: [{ title: "Restablecer contraseña — 1-Click" }] }),
});

function ResetPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  // The recovery link from the email creates a temporary session.
  // We wait until Supabase finishes processing the URL hash before showing the form.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
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

          {!ready ? (
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
