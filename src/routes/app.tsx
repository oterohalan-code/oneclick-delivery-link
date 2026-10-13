import { createFileRoute, Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Home, User, CreditCard, History, Shield, LogOut, BarChart3, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

import { SupportChat } from "@/components/SupportChat";
import { RoleSwitcher } from "@/components/RoleSwitcher";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, role, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen grid place-items-center bg-bone">
        <Loader2 className="h-8 w-8 animate-spin text-ink" />
      </div>
    );
  }

  const isCourier = role === "courier";
  const isRestaurant = role === "restaurant";

  const navItems = [
    { to: "/app", icon: Home, label: "Inicio", exact: true },
    ...(isRestaurant ? [{ to: "/app/insights", icon: BarChart3, label: "Métricas" }] : []),
    ...((isCourier || isRestaurant) ? [{ to: "/app/wallet", icon: CreditCard, label: "Membresía" }] : []),
    { to: "/app/refer", icon: Gift, label: "Invita" },
    { to: "/app/history", icon: History, label: "Historial" },
    { to: "/app/profile", icon: User, label: "Perfil" },
    ...(isAdmin ? [{ to: "/app/admin", icon: Shield, label: "Admin" }] : []),
  ];

  return (
    <div className="relative min-h-screen bg-background text-foreground pb-28">
      {/* subtle ambient mesh */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(at_15%_-5%,oklch(0.88_0.06_45/0.35),transparent_50%),radial-gradient(at_92%_8%,oklch(0.92_0.04_80/0.3),transparent_55%)] dark:bg-[radial-gradient(at_15%_-5%,oklch(0.45_0.10_45/0.25),transparent_50%),radial-gradient(at_92%_8%,oklch(0.30_0.04_60/0.4),transparent_55%)]" />

      <header className="sticky top-0 z-30">
        <div className="glass-strong border-b border-hairline/60">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <Link to="/app" className="press">
              <Logo size="sm" />
            </Link>
            <div className="flex items-center gap-2">
              <RoleSwitcher />
              <Button
                variant="ghost"
                size="sm"
                aria-label="Cerrar sesión"
                onClick={() => { signOut(); navigate({ to: "/" }); }}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 spring-in">
        <Outlet />
      </main>

      <nav
        className="fixed bottom-3 inset-x-3 z-40 max-w-3xl mx-auto"
        aria-label="Navegación principal"
      >
        <div className="glass-strong rounded-full shadow-elegant px-2 py-1.5">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}>
            {navItems.map((it) => {
              const active = it.exact ? loc.pathname === it.to : loc.pathname.startsWith(it.to);
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold tracking-wider uppercase rounded-full press transition ${
                    active ? "text-ember-foreground" : "text-foreground/75 hover:text-foreground"
                  }`}
                >
                  {active && (
                    <span aria-hidden className="absolute inset-0 rounded-full bg-ember shadow-button" />
                  )}
                  <it.icon className="relative h-4 w-4" strokeWidth={1.6} />
                  <span className="relative">{it.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <SupportChat />
    </div>
  );
}
