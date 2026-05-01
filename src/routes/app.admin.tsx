import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AdminHome } from "@/features/admin/AdminHome";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/app/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { role } = useAuth();
  if (role !== "admin") return <Card className="p-6 text-center text-muted-foreground">Acceso restringido.</Card>;
  return <AdminHome />;
}
