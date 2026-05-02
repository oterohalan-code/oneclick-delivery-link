import { createFileRoute, Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Home, User, Wallet, History, Shield, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, role, loading, signOut } = useAuth();
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

  const isAdmin = role === "admin";
  const isCourier = role === "courier";

  const navItems = [
    { to: "/app", icon: Home, label: "Inicio", exact: true },
    ...(isCourier ? [{ to: "/app/wallet", icon: Wallet, label: "Wallet" }] : []),
    { to: "/app/history", icon: History, label: "Historial" },
    { to: "/app/profile", icon: User, label: "Perfil" },
    ...(isAdmin ? [{ to: "/app/admin", icon: Shield, label: "Admin" }] : []),
  ];

  return (
    <div className="relative min-h-screen bg-bone text-ink pb-24">
      {/* subtle ambient mesh */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(at_15%_-5%,oklch(0.88_0.06_45/0.35),transparent_50%),radial-gradient(at_92%_8%,oklch(0.92_0.04_80/0.3),transparent_55%)]" />

      <header className="sticky top-0 z-30">
        <div className="glass-strong border-b border-hairline/60">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link to="/app">
              <Logo size="sm" />
            </Link>
            <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate({ to: "/" }); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <Outlet />
      </main>

      <nav className="fixed bottom-3 inset-x-3 z-40 max-w-3xl mx-auto">
        <div className="glass-strong rounded-full shadow-elegant px-2 py-1.5">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}>
            {navItems.map((it) => {
              const active = it.exact ? loc.pathname === it.to : loc.pathname.startsWith(it.to);
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={`relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium tracking-wider uppercase rounded-full transition ${
                    active ? "text-bone" : "text-graphite hover:text-ink"
                  }`}
                >
                  {active && (
                    <span aria-hidden className="absolute inset-0 rounded-full bg-ink shadow-button" />
                  )}
                  <it.icon className={`relative h-4 w-4 ${active ? "" : ""}`} strokeWidth={1.5} />
                  <span className="relative">{it.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
