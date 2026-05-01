import { createFileRoute, Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Home, User, Wallet, History, Shield, LogOut, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 bg-brand text-brand-foreground border-b border-sidebar-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2 font-display text-lg font-bold">
            <Zap className="h-5 w-5 text-primary" fill="currentColor" /> 1-Click
          </Link>
          <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate({ to: "/" }); }} className="text-brand-foreground hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border">
        <div className="max-w-3xl mx-auto grid" style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}>
          {navItems.map((it) => {
            const active = it.exact ? loc.pathname === it.to : loc.pathname.startsWith(it.to);
            return (
              <Link key={it.to} to={it.to} className={`flex flex-col items-center gap-1 py-3 text-xs ${active ? "text-primary" : "text-muted-foreground"}`}>
                <it.icon className="h-5 w-5" />
                {it.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
