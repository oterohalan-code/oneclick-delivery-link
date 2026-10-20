import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { RestaurantHome } from "@/features/restaurant/RestaurantHome";
import { CourierHome } from "@/features/courier/CourierHome";
import { AdminHome } from "@/features/admin/AdminHome";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [
    { title: "Inicio — 1Click" },
    { name: "description", content: "Gestiona tu operación de entregas en 1Click." },
    { property: "og:title", content: "Inicio — 1Click" },
    { property: "og:description", content: "Gestiona tu operación de entregas en 1Click." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AppHome,
});

function AppHome() {
  const { role } = useAuth();
  if (!role) return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (role === "restaurant") return <RestaurantHome />;
  if (role === "courier") return <CourierHome />;
  if (role === "admin") return <AdminHome />;
  return null;
}
