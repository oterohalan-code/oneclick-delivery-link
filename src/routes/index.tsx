import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { PublicDirectory } from "@/features/restaurant/PublicDirectory";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { ref?: string; local?: string } => ({
    ref: typeof s.ref === "string" ? s.ref : undefined,
    local: typeof s.local === "string" ? s.local : undefined,
  }),
  beforeLoad: async ({ search }) => {
    if (typeof window !== "undefined" && search.ref) {
      try { localStorage.setItem("pending_ref_code", search.ref.toUpperCase()); } catch {}
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (session) throw redirect({ to: "/app" });
  },
  component: Landing,
  head: () => ({
    meta: [
      { title: "1Click — Restaurantes en Manzanillo" },
      { name: "description", content: "Encuentra un restaurante en Manzanillo y pide por WhatsApp." },
      { property: "og:title", content: "1Click — Restaurantes en Manzanillo" },
      { property: "og:description", content: "Encuentra un restaurante en Manzanillo y pide por WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Landing() {
  const { local } = Route.useSearch();
  return (
    <div className="relative min-h-screen bg-bone text-foreground">
      <header className="sticky top-0 z-40 bg-navy text-navy-foreground">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <Logo size="md" tone="bone" />
          <nav className="flex items-center gap-2 sm:gap-4 text-sm">
            <Link to="/restaurante" className="text-navy-foreground/80 hover:text-navy-foreground">
              Soy restaurante
            </Link>
            <Link to="/repartidor" className="text-navy-foreground/80 hover:text-navy-foreground">
              Soy repartidor
            </Link>
            <Link to="/auth" className="hidden sm:inline text-navy-foreground/80 hover:text-navy-foreground">
              Iniciar sesión
            </Link>
            <Link to="/auth">
              <Button variant="default" size="sm" className="press">
                Comenzar <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="px-4 sm:px-6 max-w-6xl mx-auto pt-0 pb-12">
        <PublicDirectory selectedId={local} />
      </main>

      <footer className="border-t border-hairline">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo size="sm" />
          <nav className="flex items-center gap-5 text-xs tracking-wider uppercase">
            <Link to="/legal/terms" className="text-graphite hover:text-foreground transition">Términos</Link>
            <Link to="/legal/privacy" className="text-graphite hover:text-foreground transition">Privacidad</Link>
          </nav>
          <p className="text-xs text-graphite tracking-wider uppercase">© 2026 1Click · Manzanillo, Colima</p>
        </div>
      </footer>
    </div>
  );
}
