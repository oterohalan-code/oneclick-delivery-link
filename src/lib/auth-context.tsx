import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { claimAdminRole } from "@/server/admin.functions";

export type AppRole = "restaurant" | "courier" | "admin";

const ADMIN_DOMAIN = "@punchingsolutions.com.mx";

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
      .eq("user_id", uid)
      .order("role", { ascending: true })
      .limit(1)
      .maybeSingle();
    const r = (data?.role as AppRole) ?? null;
    setRole(r);
    return r;
  };

  const maybeClaimAdmin = async (u: User) => {
    const email = (u.email ?? "").toLowerCase().trim();
    if (!email.endsWith(ADMIN_DOMAIN)) return;
    if (!u.email_confirmed_at) return;
    if (adminClaimInFlight.current) return;
    adminClaimInFlight.current = true;
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const token = s?.access_token;
      if (!token) return;
      const res = await claimAdminRole({
        data: { accessToken: token },
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
          const current = await fetchRole(s.user.id);
          if (!current) await maybeClaimAdmin(s.user);
        }, 0);
      } else {
        setRole(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchRole(s.user.id)
          .then(async (current) => {
            if (!current && s?.user) await maybeClaimAdmin(s.user);
          })
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
