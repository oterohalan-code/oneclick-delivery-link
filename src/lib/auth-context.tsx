import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { claimAdminRole } from "@/lib/rpc/admin-claim.functions";
import { isAllowedAdminEmail } from "@/lib/admin-access";

export type AppRole = "restaurant" | "courier" | "admin";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const adminClaimInFlight = useRef(false);

  const fetchRole = async (uid: string): Promise<AppRole | null> => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);
    const roles = (data ?? []).map((row) => row.role as AppRole);
    const r: AppRole | null = roles.includes("admin")
      ? "admin"
      : roles.includes("restaurant")
        ? "restaurant"
        : roles.includes("courier")
          ? "courier"
          : null;
    setRole(r);
    return r;
  };

  const maybeClaimAdmin = async (u: User) => {
    if (!isAllowedAdminEmail(u.email)) return;
    if (!u.email_confirmed_at) return;
    if (adminClaimInFlight.current) return;
    adminClaimInFlight.current = true;
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const token = s?.access_token;
      if (!token) return;
      const res = await claimAdminRole({
        headers: { Authorization: `Bearer ${token}` },
      });
      if ((res as any)?.promoted) await fetchRole(u.id);
    } catch {
      // silencioso: no bloquea login
    } finally {
      adminClaimInFlight.current = false;
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(async () => {
          await maybeClaimAdmin(s.user);
          await fetchRole(s.user.id);
        }, 0);
      } else {
        setRole(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        maybeClaimAdmin(s.user)
          .then(() => fetchRole(s.user.id))
          .finally(() => setLoading(false));
      } else setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshRole = async () => {
    if (user) await fetchRole(user.id);
  };

  return (
    <Ctx.Provider value={{ user, session, role, loading, signOut, refreshRole }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
