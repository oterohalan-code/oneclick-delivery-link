import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressSearch } from "@/components/AddressSearch";
import { MapView } from "@/components/MapView";
import { toast } from "sonner";
import { Upload, Check, Loader2 } from "lucide-react";

const DOCS = [
  { key: "ine_front_url", label: "INE - Frente" },
  { key: "ine_back_url", label: "INE - Reverso" },
  { key: "license_url", label: "Licencia de conducir" },
  { key: "moto_url", label: "Foto de la moto" },
  { key: "plate_url", label: "Foto de la placa" },
  { key: "backpack_url", label: "Foto de mochila de reparto" },
] as const;

export function CourierOnboarding({ existing, onDone }: { existing: boolean; onDone: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    address: "", lat: null as number | null, lng: null as number | null, plate: "",
  });
  const [docs, setDocs] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("couriers").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setForm({ address: data.address ?? "", lat: data.lat, lng: data.lng, plate: data.plate ?? "" });
        const d: Record<string, string> = {};
        DOCS.forEach((doc) => { if ((data as any)[doc.key]) d[doc.key] = (data as any)[doc.key]; });
        setDocs(d);
      }
    });
  }, [user?.id]);

  const upload = async (key: string, file: File) => {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Máximo 5 MB");
    setUploading(key);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/${key}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("courier-docs").upload(path, file, { upsert: true });
    setUploading(null);
    if (error) return toast.error(error.message);
    setDocs({ ...docs, [key]: path });
    toast.success("Documento subido");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.address || form.lat == null || form.lng == null) return toast.error("Selecciona tu domicilio");
    if (!form.plate.trim()) return toast.error("Ingresa la placa");
    const missing = DOCS.find((d) => !docs[d.key]);
    if (missing) return toast.error(`Falta: ${missing.label}`);

    setSaving(true);
    const { error } = await supabase.from("couriers").update({
      address: form.address, lat: form.lat, lng: form.lng, plate: form.plate.trim(),
      ...docs, status: "pending_validation", rejection_reason: null,
    }).eq("user_id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Solicitud enviada para revisión");
    onDone();
  };

  return (
    <Card className="p-6 mt-4 text-left">
      <h2 className="font-display text-xl font-bold">{existing ? "Actualizar documentación" : "Completa tu perfil de repartidor"}</h2>
      <p className="text-sm text-muted-foreground mt-1">Sube fotos claras. Validamos tu identidad para proteger a los restaurantes.</p>

      <form onSubmit={submit} className="space-y-5 mt-5">
        <div>
          <Label>Domicilio</Label>
          <AddressSearch value={form.address}
            onChange={(a, lat, lng) => setForm({ ...form, address: a, lat: lat ?? form.lat, lng: lng ?? form.lng })} />
        </div>
        <div className="h-56">
          <MapView
            pins={form.lat && form.lng ? [{ lat: form.lat, lng: form.lng, label: "Mi domicilio" }] : []}
            onMapClick={(lat, lng) => setForm({ ...form, lat, lng })}
            height="100%"
          />
        </div>
        <div>
          <Label>Placa de la moto</Label>
          <Input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} placeholder="ABC-123" />
        </div>

        <div className="space-y-2">
          <Label>Documentos</Label>
          <div className="grid grid-cols-2 gap-2">
            {DOCS.map((doc) => (
              <label key={doc.key} className={`relative cursor-pointer rounded-xl border-2 border-dashed p-3 text-center text-xs hover:border-primary transition ${docs[doc.key] ? "border-primary bg-primary/5" : "border-border"}`}>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(doc.key, f); }} />
                {uploading === doc.key ? (
                  <Loader2 className="h-5 w-5 mx-auto animate-spin" />
                ) : docs[doc.key] ? (
                  <Check className="h-5 w-5 mx-auto text-primary" />
                ) : (
                  <Upload className="h-5 w-5 mx-auto text-muted-foreground" />
                )}
                <div className="mt-1 font-medium">{doc.label}</div>
              </label>
            ))}
          </div>
        </div>

        <Button type="submit" disabled={saving} className="w-full">{existing ? "Reenviar para revisión" : "Enviar para revisión"}</Button>
      </form>
    </Card>
  );
}
