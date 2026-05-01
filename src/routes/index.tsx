import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Bike, Store, Zap, MapPin, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) throw redirect({ to: "/app" });
  },
  component: Landing,
  head: () => ({
    meta: [
      { title: "1-Click — Repartidores a un click en Cancún" },
      { name: "description", content: "Plataforma que conecta restaurantes con repartidores independientes en Cancún. Pide un repartidor en segundos." },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen bg-brand text-brand-foreground">
      <header className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 font-display text-2xl font-bold">
          <Zap className="h-7 w-7 text-primary" fill="currentColor" />
          1-Click
        </div>
        <Link to="/auth">
          <Button variant="secondary" size="sm">Entrar</Button>
        </Link>
      </header>

      <main className="px-6 max-w-6xl mx-auto">
        <section className="py-16 md:py-28 text-center md:text-left grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-block rounded-full bg-primary/15 text-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              Hecho en Cancún
            </span>
            <h1 className="mt-4 font-display text-5xl md:text-6xl font-bold leading-[1.05]">
              Repartidores a un <span className="text-primary">click</span>.
            </h1>
            <p className="mt-5 text-lg text-brand-foreground/70 max-w-md mx-auto md:mx-0">
              Olvida los grupos de WhatsApp. Conecta tu restaurante con repartidores verificados en segundos.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <Link to="/auth" search={{ role: "restaurant" } as any}>
                <Button size="lg" className="w-full sm:w-auto shadow-glow">
                  <Store className="mr-2 h-5 w-5" /> Soy Restaurante
                </Button>
              </Link>
              <Link to="/auth" search={{ role: "courier" } as any}>
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  <Bike className="mr-2 h-5 w-5" /> Soy Repartidor
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="aspect-square rounded-3xl bg-gradient-to-br from-primary to-primary-glow shadow-glow flex items-center justify-center">
              <Zap className="h-40 w-40 text-brand" fill="currentColor" />
            </div>
          </div>
        </section>

        <section className="py-16 grid md:grid-cols-3 gap-6">
          {[
            { icon: Zap, title: "Pedido en vivo", desc: "Lanza un pedido y los repartidores cercanos lo ven al instante." },
            { icon: MapPin, title: "Mapa con ruta", desc: "Visualiza recogida y entrega en un mapa en tiempo real." },
            { icon: Wallet, title: "Monedero o suscripción", desc: "$5 por pedido o $249 al mes ilimitado. Tú eliges." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl bg-sidebar-accent/40 p-6 border border-sidebar-border">
              <f.icon className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-display text-xl font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-brand-foreground/70">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="px-6 py-10 text-center text-sm text-brand-foreground/50">
        © {new Date().getFullYear()} 1-Click Cancún
      </footer>
    </div>
  );
}
