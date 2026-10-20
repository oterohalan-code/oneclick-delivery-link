import { oauthReturnPath } from "@/lib/oauth-return-path";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bike, Store, ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GlassCard } from "@/components/ui/glass-card";
import { Checkbox } from "@/components/ui/checkbox";
import { MeshBackground } from "@/components/MeshBackground";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { CourierSignupWizard } from "@/features/courier/CourierSignupWizard";
import { RestaurantSignupWizard } from "@/features/restaurant/RestaurantSignupWizard";
import { ADMIN_DOMAIN, isAllowedAdminEmail } from "@/lib/admin-access";

type RoleParam = "restaurant" | "courier" | "admin";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { role?: RoleParam; next?: string } => ({
    next: typeof s.next === "string" && oauthReturnPath(s.next) !== "/" ? oauthReturnPath(s.next) : undefined,
    role: s.role === "courier" ? "courier" : s.role === "admin" ? "admin" : s.role === "restaurant" ? "restaurant" : undefined,
  }),
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Entrar — 1Click" },
      { name: "description", content: "Inicia sesión o crea tu cuenta de restaurante o repartidor en 1Click." },
      { property: "og:title", content: "Entrar — 1Click" },
      { property: "og:description", content: "Inicia sesión o crea tu cuenta de restaurante o repartidor en 1Click." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AuthPage() {
  const { role: roleParam, next } = Route.useSearch();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "signup">(roleParam ? "signup" : "login");
  const [role, setRole] = useState<RoleParam>(roleParam ?? "restaurant");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", fullName: "", phone: "" });
  const [adminAcceptedTerms, setAdminAcceptedTerms] = useState(false);

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
    if (next) { window.location.href = next; return; }
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

  const onGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: next ? new URL(next, window.location.origin).href : window.location.origin + "/app",
    });
    if (result.error) {
      setLoading(false);
      toast.error("No se pudo iniciar sesión con Google");
      return;
    }
    if (result.redirected) return; // browser is redirecting
    setLoading(false);
    toast.success("¡Bienvenido!");
    navigate({ to: "/app" });
  };

  const onAdminSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (!isAllowedAdminEmail(email)) {
      return toast.error(`Solo el dueño o correos ${ADMIN_DOMAIN} pueden registrarse como administradores.`);
    }
    if (!form.password || form.password.length < 6) {
      return toast.error("La contraseña debe tener al menos 6 caracteres.");
    }
    if (!form.fullName.trim()) {
      return toast.error("Escribe tu nombre completo.");
    }
    if (!adminAcceptedTerms) {
      return toast.error("Debes aceptar los Términos y la Política de Privacidad.");
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password: form.password,
      options: {
        emailRedirectTo: next ? new URL(next, window.location.origin).href : `${window.location.origin}/auth`,
        data: { full_name: form.fullName.trim(), role: "admin_pending" },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Cuenta creada. Revisa tu correo para confirmar tu acceso de administrador.");
    setTab("login");
  };

  return (
    <div className="premium-auth relative min-h-screen bg-background text-foreground flex flex-col overflow-hidden">

      <MeshBackground />

      <header className="px-6 py-5 max-w-md mx-auto w-full flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition tracking-wider uppercase">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver
        </Link>
        <Logo size="sm" />
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-10">
        <GlassCard variant="strong" className="w-full max-w-md p-6 sm:p-8 animate-fade-in">
          <div className="eyebrow mb-3">Acceso</div>
          <h1 className="text-display text-3xl font-medium leading-tight">
            Bienvenido <span className="font-medium text-muted-foreground">de vuelta.</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Entra o crea tu cuenta para continuar.</p>

          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-7">
            <TabsList className="grid grid-cols-2 w-full bg-secondary/50 p-1 rounded-lg h-auto">
              <TabsTrigger value="login" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm py-2">Entrar</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm py-2">Crear cuenta</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full mb-4 h-11 rounded-xl"
                onClick={onGoogle}
                disabled={loading}
              >
                <GoogleIcon className="mr-2 h-4 w-4" /> Continuar con Google
              </Button>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-hairline" /></div>
                <div className="relative flex justify-center"><span className="bg-card px-2 text-[10px] uppercase tracking-widest text-muted-foreground">o con email</span></div>
              </div>
              <form onSubmit={onLogin} className="space-y-4">
                <div>
                  <Label htmlFor="le" className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
                  <Input id="le" type="email" required value={form.email}
                    className="mt-1.5 h-11 rounded-xl border-hairline bg-card/70"
                    onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="lp" className="text-xs uppercase tracking-wider text-muted-foreground">Contraseña</Label>
                  <Input id="lp" type="password" required value={form.password}
                    className="mt-1.5 h-11 rounded-xl border-hairline bg-card/70"
                    onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
                <Button type="submit" disabled={loading} variant="default" size="lg" className="w-full mt-2">Entrar</Button>
                <button
                  type="button"
                  onClick={onForgotPassword}
                  disabled={loading}
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline block mx-auto mt-1"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6 space-y-5">
              <div>
                <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Soy</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setRole("restaurant")}
                    className={`rounded-xl p-3 border transition flex flex-col items-center gap-1.5 ${role === "restaurant" ? "border-primary bg-primary text-primary-foreground shadow-button" : "border-hairline bg-card/60 text-foreground hover:border-primary/50"}`}>
                    <Store className="h-5 w-5" strokeWidth={1.5} /> <span className="text-xs font-medium">Restaurante</span>
                  </button>
                  <button type="button" onClick={() => setRole("courier")}
                    className={`rounded-xl p-3 border transition flex flex-col items-center gap-1.5 ${role === "courier" ? "border-primary bg-primary text-primary-foreground shadow-button" : "border-hairline bg-card/60 text-foreground hover:border-primary/50"}`}>
                    <Bike className="h-5 w-5" strokeWidth={1.5} /> <span className="text-xs font-medium">Repartidor</span>
                  </button>
                  <button type="button" onClick={() => setRole("admin")}
                    className={`rounded-xl p-3 border transition flex flex-col items-center gap-1.5 ${role === "admin" ? "border-primary bg-primary text-primary-foreground shadow-button" : "border-hairline bg-card/60 text-foreground hover:border-primary/50"}`}>
                    <ShieldCheck className="h-5 w-5" strokeWidth={1.5} /> <span className="text-xs font-medium">Admin</span>
                  </button>
                </div>
              </div>

              {role === "admin" ? (
                <form onSubmit={onAdminSignup} className="space-y-4">
                  <p className="text-xs text-muted-foreground bg-muted/40 border border-hairline rounded-lg p-3">
                    Admin: el correo del dueño o un correo <strong className="text-foreground">{ADMIN_DOMAIN}</strong>. Recibirás un correo de confirmación.
                  </p>
                  <div>
                    <Label htmlFor="an" className="text-xs uppercase tracking-wider text-muted-foreground">Nombre completo</Label>
                    <Input id="an" required value={form.fullName}
                      className="mt-1.5 h-11 rounded-xl border-hairline bg-card/70"
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="ae" className="text-xs uppercase tracking-wider text-muted-foreground">Email corporativo</Label>
                    <Input id="ae" type="email" required value={form.email}
                      placeholder={`tu-correo${ADMIN_DOMAIN}`}
                      className="mt-1.5 h-11 rounded-xl border-hairline bg-card/70"
                      onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="ap" className="text-xs uppercase tracking-wider text-muted-foreground">Contraseña</Label>
                    <Input id="ap" type="password" required minLength={6} value={form.password}
                      className="mt-1.5 h-11 rounded-xl border-hairline bg-card/70"
                      onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-hairline bg-card/40 p-3">
                    <Checkbox
                      id="admin-terms"
                      checked={adminAcceptedTerms}
                      onCheckedChange={(v) => setAdminAcceptedTerms(v === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="admin-terms" className="text-xs text-muted-foreground font-normal leading-relaxed cursor-pointer">
                      He leído y acepto los{" "}
                      <Link to="/legal/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">Términos</Link>
                      {" "}y la{" "}
                      <Link to="/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">Política de Privacidad</Link>.
                    </Label>
                  </div>
                  <Button type="submit" disabled={loading || !adminAcceptedTerms} variant="default" size="lg" className="w-full mt-2">
                    Crear cuenta de administrador
                  </Button>
                </form>
              ) : role === "courier" ? <CourierSignupWizard /> : <RestaurantSignupWizard />}

            </TabsContent>
          </Tabs>
        </GlassCard>
      </main>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}
