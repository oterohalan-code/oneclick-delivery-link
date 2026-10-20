import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AdminHome } from "@/features/admin/AdminHome";

export const Route = createFileRoute("/app/admin")({
  head: () => ({ meta: [
    { title: "Administración — 1Click" },
    { name: "description", content: "Panel de validación, finanzas e incidencias de 1Click." },
    { property: "og:title", content: "Administración — 1Click" },
    { property: "og:description", content: "Panel de validación, finanzas e incidencias de 1Click." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/app" });
  },
  component: AdminHome,
});
