import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { claimAdminRole } from "@/lib/rpc/admin-claim.functions";
import { isAllowedAdminEmail, isMasterAdminEmail } from "@/lib/admin-access";

export type AppRole = "restaurant" | "courier" | "admin";

const ACTING_ROLE_KEY = "oneclick.actingRole";

function readActingRole(): AppRole | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(ACTING_ROLE_KEY);
    if (value === "admin" || value === "restaurant" || value === "courier") return value;
  } catch {
    /* ignore */
  }
  return null;
}

function writeActingRole(role: AppRole) {
  try {
    localStorage.setItem(ACTING_ROLE_KEY, role);
  } catch {
    /* ignore */
  }
}

function pickActingRole(roles: AppRole[], stored: AppRole | null): AppRole | null {
  if (stored && (roles.includes(stored) || roles.includes("admin"))) return stored;
  if (roles.includes("admin")) return "admin";
  if (roles.includes("restaurant")) return "restaurant";
  if (roles.includes("courier")) return "courier";
  return null;
}

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  roles: AppRole[];
  isAdmin: boolean;
  isMasterAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
  setActingRole: (next: AppRole) => Promise<{ ok: boolean; message?: string }>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const adminClaimInFlight = useRef(false);

  const fetchRole = async (uid: string): Promise<AppRole | null> => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);
    const nextRoles = (data ?? []).map((row) => row.role as AppRole);
    const next = pickActingRole(nextRoles, readActingRole());
    setRoles(nextRoles);
    setRole(next);
    return next;
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
      await claimAdminRole({
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // silencioso: no bloquea login
    } finally {
      adminClaimInFlight.current = false;
    }
  };

  const setActingRole = async (next: AppRole): Promise<{ ok: boolean; message?: string }> => {
    if (!user) return { ok: false, message: "Sesión expirada." };
    const canSwitch = roles.includes("admin");
    if (!canSwitch && next !== role) {
      return { ok: false, message: "Esta cuenta no puede cambiar de panel." };
    }

    if (next !== "admin" && !roles.includes(next)) {
      const { error } = await supabase.from("user_roles").upsert(
        { user_id: user.id, role: next },
        { onConflict: "user_id,role" },
      );
      if (error) return { ok: false, message: error.message };
      setRoles((prev) => (prev.includes(next) ? prev : [...prev, next]));
    }

    if (next === "courier") {
      const { data: existing } = await supabase.from("couriers").select("id").eq("user_id", user.id).maybeSingle();
      if (!existing) {
        const { error } = await supabase.from("couriers").insert({
          user_id: user.id,
          status: "incomplete",
          subscription_active: true,
          subscription_expires_at: "2099-12-31T00:00:00Z",
        });
        if (error) return { ok: false, message: error.message };
      }
    }

    writeActingRole(next);
    setRole(next);
    return { ok: true };
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
        setRoles([]);
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
    <Ctx.Provider
      value={{
        user,
        session,
        role,
        roles,
        isAdmin: roles.includes("admin"),
        isMasterAdmin: isMasterAdminEmail(user?.email),
        loading,
        signOut,
        refreshRole,
        setActingRole,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
