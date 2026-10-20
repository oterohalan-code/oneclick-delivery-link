import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { CourierOnboarding } from "@/features/courier/CourierOnboarding";

export const Route = createFileRoute("/app/profile")({
  head: () => ({ meta: [
    { title: "Mi perfil — 1Click" },
    { name: "description", content: "Gestiona los datos de tu perfil en 1Click." },
    { property: "og:title", content: "Mi perfil — 1Click" },
    { property: "og:description", content: "Gestiona los datos de tu perfil en 1Click." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, role } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [form, setForm] = useState({ full_name: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [showCourierEdit, setShowCourierEdit] = useState(false);
  const [courier, setCourier] = useState<any>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    setProfile(data);
    setForm({ full_name: data?.full_name ?? "", phone: data?.phone ?? "" });
    if (role === "courier") {
      const { data: c } = await supabase.from("couriers").select("*").eq("user_id", user.id).maybeSingle();
      setCourier(c);
    }
  };
  useEffect(() => { load(); }, [user?.id, role]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name.trim(), phone: form.phone.trim(),
    }).eq("id", user!.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil actualizado");
    load();
  };

  if (!profile) return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold">Mi perfil</h1>

      <Card className="p-5">
        <div className="text-xs text-muted-foreground mb-2">Email: {user?.email}</div>
        <Badge>{role === "restaurant" ? "Restaurante" : role === "courier" ? "Repartidor" : "Admin"}</Badge>
        <form onSubmit={save} className="space-y-3 mt-4">
          <div>
            <Label>Nombre completo</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <Button type="submit" disabled={busy}>Guardar</Button>
        </form>
      </Card>

      {role === "courier" && courier && (
        <Card className="p-5 space-y-2">
          <h3 className="font-display text-lg font-semibold">Mi documentación</h3>
          <div className="text-sm">Estado:&nbsp;
            <Badge className={
              courier.status === "active" ? "bg-success/20 text-success-foreground" :
              courier.status === "pending_validation" ? "bg-warning/20 text-warning-foreground" :
              "bg-destructive/20 text-destructive"
            }>{courier.status}</Badge>
          </div>
          {courier.rejection_reason && <p className="text-sm text-destructive">Motivo: {courier.rejection_reason}</p>}
          <Button variant="secondary" onClick={() => setShowCourierEdit((v) => !v)}>
            {showCourierEdit ? "Cancelar" : "Actualizar documentos"}
          </Button>
          {showCourierEdit && <CourierOnboarding existing onDone={() => { setShowCourierEdit(false); load(); }} />}
        </Card>
      )}
    </div>
  );
}
