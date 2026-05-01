import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bike, Store, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

type RoleParam = "restaurant" | "courier";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { role?: RoleParam } => ({
    role: s.role === "courier" ? "courier" : s.role === "restaurant" ? "restaurant" : undefined,
  }),
  component: AuthPage,
  head: () => ({ meta: [{ title: "Entrar — 1-Click" }] }),
});

const signupSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(8, "Mínimo 8 caracteres").max(72),
  fullName: z.string().trim().min(2, "Nombre requerido").max(100),
  phone: z.string().trim().min(8, "Teléfono inválido").max(20),
});

function AuthPage() {
  const { role: roleParam } = Route.useSearch();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "signup">("login");
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

  const onSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const parse = signupSchema.safeParse(form);
    if (!parse.success) return toast.error(parse.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { full_name: form.fullName.trim(), phone: form.phone.trim(), role },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Cuenta creada. ¡Vamos!");
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
          <h1 className="font-display text-2xl font-bold">Bienvenido</h1>
          <p className="text-sm text-muted-foreground">Entra o crea tu cuenta</p>

          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-5">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-5">
              <form onSubmit={onLogin} className="space-y-3">
                <div>
                  <Label htmlFor="le">Email</Label>
                  <Input id="le" type="email" required value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="lp">Contraseña</Label>
                  <Input id="lp" type="password" required value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
                <Button type="submit" disabled={loading} className="w-full mt-2">Entrar</Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-5 space-y-4">
              <div>
                <Label className="mb-2 block">Soy</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setRole("restaurant")}
                    className={`rounded-xl p-3 border-2 transition flex flex-col items-center gap-1 ${role === "restaurant" ? "border-primary bg-primary/10" : "border-border"}`}>
                    <Store className="h-5 w-5" /> <span className="text-sm font-medium">Restaurante</span>
                  </button>
                  <button type="button" onClick={() => setRole("courier")}
                    className={`rounded-xl p-3 border-2 transition flex flex-col items-center gap-1 ${role === "courier" ? "border-primary bg-primary/10" : "border-border"}`}>
                    <Bike className="h-5 w-5" /> <span className="text-sm font-medium">Repartidor</span>
                  </button>
                </div>
              </div>

              <form onSubmit={onSignup} className="space-y-3">
                <div>
                  <Label htmlFor="sn">Nombre completo</Label>
                  <Input id="sn" required value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="sp">Teléfono</Label>
                  <Input id="sp" required value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="se">Email</Label>
                  <Input id="se" type="email" required value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="spw">Contraseña (mín. 8)</Label>
                  <Input id="spw" type="password" required value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
                <Button type="submit" disabled={loading} className="w-full mt-2">Crear cuenta</Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
