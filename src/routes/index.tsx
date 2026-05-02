import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Bike, Store, MapPin, Wallet, ArrowRight, Sparkles, Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { MeshBackground } from "@/components/MeshBackground";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import heroCourier from "@/assets/hero-courier.jpg";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) throw redirect({ to: "/app" });
  },
  component: Landing,
  head: () => ({
    meta: [
      { title: "1Click — Logística premium para restaurantes en Cancún" },
      { name: "description", content: "Red profesional de repartidores verificados. Asignación en menos de 30 segundos. Sin comisiones ocultas." },
    ],
  }),
});

function Landing() {
  return (
    <div className="relative min-h-screen bg-bone text-ink overflow-hidden">
      <MeshBackground />

      {/* Header */}
      <header className="sticky top-0 z-40">
        <div className="glass-strong border-b border-hairline/60">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Logo size="md" />
            <div className="flex items-center gap-2">
              <Link to="/auth" className="hidden sm:inline-flex">
                <Button variant="ghost" size="sm">Iniciar sesión</Button>
              </Link>
              <Link to="/auth">
                <Button variant="default" size="sm">
                  Comenzar <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="relative px-6 max-w-6xl mx-auto">
        {/* Hero */}
        <section className="py-20 md:py-32 grid md:grid-cols-[1.1fr_0.9fr] gap-16 items-center">
          <div className="animate-fade-in">
            <div className="eyebrow mb-6">EST. 2026 · Cancún · Quintana Roo</div>
            <h1 className="text-display text-5xl md:text-7xl font-medium leading-[0.95]">
              Un click.<br />
              <span className="italic font-light text-graphite">Tu repartidor</span><br />
              <span className="italic font-light text-graphite">en camino.</span>
            </h1>
            <p className="mt-8 text-base md:text-lg text-graphite max-w-md leading-relaxed">
              Cero apps complicadas. Cero grupos de WhatsApp. Solo logística profesional para restaurantes que valoran su tiempo y reputación.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <Link to="/auth" search={{ role: "restaurant" } as any}>
                <Button size="lg" variant="default" className="w-full sm:w-auto">
                  <Store className="h-4 w-4" /> Soy Restaurante
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <Link to="/auth" search={{ role: "courier" } as any}>
                <Button size="lg" variant="glass" className="w-full sm:w-auto">
                  <Bike className="h-4 w-4" /> Soy Repartidor
                </Button>
              </Link>
            </div>
          </div>

          {/* Hero image with glass overlays */}
          <div className="relative animate-scale-in">
            {/* Decorative glow halo */}
            <div className="absolute -inset-8 -z-10 rounded-[2rem] opacity-70 blur-3xl"
                 style={{ background: "radial-gradient(60% 60% at 70% 30%, oklch(0.72 0.16 45 / 0.45), transparent 60%), radial-gradient(50% 50% at 20% 80%, oklch(0.55 0.14 25 / 0.35), transparent 65%)" }} />
            <GlassCard variant="strong" className="aspect-square p-2.5 overflow-hidden">
              <div className="relative h-full w-full rounded-2xl overflow-hidden">
                <img
                  src={heroCourier}
                  alt="Repartidor profesional 1Click en Cancún al atardecer"
                  width={1024}
                  height={1024}
                  className="h-full w-full object-cover scale-105"
                />
                {/* Color grade overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
                <div className="absolute inset-0 mix-blend-overlay opacity-40"
                     style={{ background: "linear-gradient(135deg, oklch(0.72 0.16 45 / 0.5), transparent 50%, oklch(0.55 0.14 25 / 0.4))" }} />

                {/* Top eyebrow chip */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                  <div className="px-3 py-1.5 rounded-full backdrop-blur-xl bg-white/10 border border-white/20 eyebrow text-bone/95">
                    01 — Red verificada
                  </div>
                  <div className="h-2 w-2 rounded-full bg-ember shadow-[0_0_12px_oklch(0.72_0.16_45)]" />
                </div>

                {/* Bottom glass info bar */}
                <div className="absolute bottom-3 left-3 right-3 rounded-2xl backdrop-blur-2xl bg-white/10 border border-white/20 p-4 shadow-[0_8px_32px_rgb(0_0_0/0.3)]">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-[10px] tracking-[0.25em] uppercase text-bone/70">Premium service</div>
                      <div className="text-display italic text-2xl font-light text-bone leading-tight mt-1">
                        Cancún · Q.Roo
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] tracking-[0.25em] uppercase text-bone/70">ETA</div>
                      <div className="text-display text-xl font-medium text-bone">&lt; 30s</div>
                    </div>
                  </div>
                </div>

                {/* Floating stat chip */}
                <div className="hidden md:flex absolute top-1/2 -left-4 -translate-y-1/2 items-center gap-2 px-3 py-2 rounded-full backdrop-blur-xl bg-white/15 border border-white/25 shadow-[0_8px_24px_rgb(0_0_0/0.25)]">
                  <div className="h-1.5 w-1.5 rounded-full bg-ember animate-pulse" />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-bone">En vivo</span>
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* Stats strip */}
        <section className="pb-10">
          <GlassCard variant="strong" className="overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-hairline">
              {[
                { v: "< 30s", l: "Asignación promedio" },
                { v: "100%", l: "Repartidores verificados" },
                { v: "$249", l: "Mensual ilimitado" },
                { v: "0%", l: "Comisión sobre venta" },
              ].map((s, i) => (
                <div key={i} className="p-6 md:p-7 text-center md:text-left">
                  <div className="text-display text-3xl md:text-4xl font-medium text-mono-tight">{s.v}</div>
                  <div className="mt-1.5 text-xs text-graphite uppercase tracking-wider">{s.l}</div>
                </div>
              ))}
            </div>
          </GlassCard>
        </section>

        {/* Features */}
        <section className="py-20 grid md:grid-cols-3 gap-5">
          {[
            { icon: Sparkles, n: "01", title: "Pedido en vivo", desc: "Lanza un pedido y los repartidores cercanos lo ven al instante en sus dispositivos." },
            { icon: MapPin, n: "02", title: "Mapa con ruta", desc: "Visualiza recogida, trayecto y entrega en tiempo real con cartografía profesional." },
            { icon: Wallet, n: "03", title: "Modelo flexible", desc: "$5 por pedido o $249 al mes ilimitado. Sin comisiones sobre tu venta." },
          ].map((f) => (
            <GlassCard key={f.title} interactive className="p-7">
              <div className="flex items-start justify-between mb-8">
                <f.icon className="h-5 w-5 text-ink" strokeWidth={1.5} />
                <span className="eyebrow">{f.n}</span>
              </div>
              <h3 className="text-display text-2xl font-medium leading-tight">{f.title}</h3>
              <p className="mt-3 text-sm text-graphite leading-relaxed">{f.desc}</p>
            </GlassCard>
          ))}
        </section>

        {/* Process */}
        <section className="py-16">
          <div className="text-center mb-12">
            <div className="eyebrow mb-4">El proceso</div>
            <h2 className="text-display text-4xl md:text-5xl font-medium">
              Tres pasos. <span className="italic font-light text-graphite">Sin fricción.</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-px bg-hairline rounded-2xl overflow-hidden">
            {[
              { icon: Store, t: "Pides", d: "Capturas la dirección de entrega y el monto a cobrar." },
              { icon: Clock, t: "Asignamos", d: "Un repartidor verificado cercano acepta en segundos." },
              { icon: ShieldCheck, t: "Entrega", d: "Sigues la ruta en vivo y recibes confirmación al cerrar." },
            ].map((step, i) => (
              <div key={i} className="bg-paper p-8">
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-display italic text-3xl font-light text-graphite">0{i + 1}</span>
                  <div className="h-px flex-1 bg-hairline" />
                  <step.icon className="h-4 w-4 text-graphite" strokeWidth={1.5} />
                </div>
                <h3 className="text-display text-xl font-medium">{step.t}</h3>
                <p className="mt-2 text-sm text-graphite leading-relaxed">{step.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="py-20">
          <GlassCard variant="dark" className="p-12 md:p-16 text-center grain overflow-hidden relative">
            <MeshBackground variant="dark" />
            <div className="relative">
              <div className="eyebrow mb-5" style={{ color: "oklch(0.78 0.12 45)" }}>Comienza hoy</div>
              <h2 className="text-display text-4xl md:text-5xl font-medium text-bone max-w-2xl mx-auto leading-tight">
                Eleva la operación de tu restaurante.
              </h2>
              <p className="mt-5 text-bone/70 max-w-md mx-auto">
                Configura tu cuenta en menos de dos minutos. Sin tarjetas requeridas para empezar.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/auth" search={{ role: "restaurant" } as any}>
                  <Button size="lg" variant="glass" className="w-full sm:w-auto">
                    <Store className="h-4 w-4" /> Crear cuenta de restaurante
                  </Button>
                </Link>
                <Link to="/auth" search={{ role: "courier" } as any}>
                  <Button size="lg" variant="ember" className="w-full sm:w-auto">
                    <Bike className="h-4 w-4" /> Quiero repartir
                  </Button>
                </Link>
              </div>
            </div>
          </GlassCard>
        </section>
      </main>

      <footer className="border-t border-hairline">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo size="sm" />
          <p className="text-xs text-graphite tracking-wider uppercase">© 2026 1Click · Cancún, México</p>
        </div>
      </footer>
    </div>
  );
}
