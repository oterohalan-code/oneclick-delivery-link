import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bike, Store, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GlassCard } from "@/components/ui/glass-card";
import { MeshBackground } from "@/components/MeshBackground";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CourierSignupWizard } from "@/features/courier/CourierSignupWizard";
import { RestaurantSignupWizard } from "@/features/restaurant/RestaurantSignupWizard";

type RoleParam = "restaurant" | "courier";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { role?: RoleParam } => ({
    role: s.role === "courier" ? "courier" : s.role === "restaurant" ? "restaurant" : undefined,
  }),
  component: AuthPage,
  head: () => ({ meta: [{ title: "Entrar — 1-Click" }] }),
});

function AuthPage() {
  const { role: roleParam } = Route.useSearch();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "signup">(roleParam ? "signup" : "login");
  const [role, setRole] = useState<RoleParam>(roleParam ?? "restaurant");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", fullName: "", phone: "" });

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("¡Bienvenido!");
    navigate({ to: "/app" });
  };

  const onForgotPassword = async () => {
    const email = form.email.trim();
    if (!email) return toast.error("Escribe tu email arriba para enviarte el enlace.");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Te enviamos un correo para restablecer tu contraseña.");
  };



  return (
    <div className="relative min-h-screen bg-bone text-ink flex flex-col overflow-hidden">
      <MeshBackground />

      <header className="px-6 py-5 max-w-md mx-auto w-full flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-xs text-graphite hover:text-ink transition tracking-wider uppercase">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver
        </Link>
        <Logo size="sm" />
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-10">
        <GlassCard variant="strong" className="w-full max-w-md p-8 animate-fade-in">
          <div className="eyebrow mb-3">Acceso</div>
          <h1 className="text-display text-3xl font-medium leading-tight">
            Bienvenido <span className="italic font-light text-graphite">de vuelta.</span>
          </h1>
          <p className="text-sm text-graphite mt-2">Entra o crea tu cuenta para continuar.</p>

          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-7">
            <TabsList className="grid grid-cols-2 w-full bg-secondary/50 p-1 rounded-full h-auto">
              <TabsTrigger value="login" className="rounded-full data-[state=active]:bg-ink data-[state=active]:text-bone data-[state=active]:shadow-sm py-2">Entrar</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-full data-[state=active]:bg-ink data-[state=active]:text-bone data-[state=active]:shadow-sm py-2">Crear cuenta</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <form onSubmit={onLogin} className="space-y-4">
                <div>
                  <Label htmlFor="le" className="text-xs uppercase tracking-wider text-graphite">Email</Label>
                  <Input id="le" type="email" required value={form.email}
                    className="mt-1.5 h-11 rounded-xl border-hairline bg-paper/70"
                    onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="lp" className="text-xs uppercase tracking-wider text-graphite">Contraseña</Label>
                  <Input id="lp" type="password" required value={form.password}
                    className="mt-1.5 h-11 rounded-xl border-hairline bg-paper/70"
                    onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
                <Button type="submit" disabled={loading} variant="default" size="lg" className="w-full mt-2">Entrar</Button>
                <button
                  type="button"
                  onClick={onForgotPassword}
                  disabled={loading}
                  className="text-xs text-graphite hover:text-ink hover:underline block mx-auto mt-1"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6 space-y-5">
              <div>
                <Label className="mb-2 block text-xs uppercase tracking-wider text-graphite">Soy</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setRole("restaurant")}
                    className={`rounded-xl p-4 border transition flex flex-col items-center gap-1.5 ${role === "restaurant" ? "border-ink bg-ink text-bone shadow-button" : "border-hairline bg-paper/60 hover:border-ink/40"}`}>
                    <Store className="h-5 w-5" strokeWidth={1.5} /> <span className="text-sm font-medium">Restaurante</span>
                  </button>
                  <button type="button" onClick={() => setRole("courier")}
                    className={`rounded-xl p-4 border transition flex flex-col items-center gap-1.5 ${role === "courier" ? "border-ink bg-ink text-bone shadow-button" : "border-hairline bg-paper/60 hover:border-ink/40"}`}>
                    <Bike className="h-5 w-5" strokeWidth={1.5} /> <span className="text-sm font-medium">Repartidor</span>
                  </button>
                </div>
              </div>

              {role === "courier" ? <CourierSignupWizard /> : <RestaurantSignupWizard />}
            </TabsContent>
          </Tabs>
        </GlassCard>
      </main>
    </div>
  );
}
