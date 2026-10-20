import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { AddressSearch } from "@/components/AddressSearch";
import { isInManzanillo, MapView } from "@/components/MapView";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { z } from "zod";

const CATEGORIES = ["Mexicana", "Pizzería", "Hamburguesas", "Sushi", "Mariscos", "Pollos", "Postres", "Café", "Otra"];

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(8).max(20),
  category: z.string().min(1),
  address: z.string().trim().min(5),
});

export function RestaurantOnboarding({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: "", phone: "", category: "Mexicana", address: "", lat: null as number | null, lng: null as number | null });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = schema.safeParse(form);
    if (!p.success) return toast.error(p.error.issues[0].message);
    if (form.lat == null || form.lng == null) return toast.error("Selecciona la dirección desde la búsqueda o el mapa");
    if (!isInManzanillo(form.lat, form.lng)) return toast.error("El local tiene que estar en Manzanillo");
    setLoading(true);
    const { error } = await supabase.from("restaurants").insert({
      user_id: user!.id,
      name: form.name.trim(), phone: form.phone.trim(), category: form.category,
      address: form.address.trim(), lat: form.lat, lng: form.lng,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("¡Restaurante creado!");
    onDone();
  };

  return (
    <Card className="p-6">
      <h1 className="font-display text-2xl font-bold">Registra tu restaurante</h1>
      <p className="text-sm text-muted-foreground mt-1">Estos datos se compartirán con los repartidores.</p>
      <form onSubmit={submit} className="space-y-4 mt-5">
        <div>
          <Label>Nombre del local</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Teléfono</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          </div>
          <div>
            <Label>Categoría</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Dirección</Label>
          <AddressSearch
            value={form.address}
            onChange={(address, lat, lng) => setForm({ ...form, address, lat: lat ?? form.lat, lng: lng ?? form.lng })}
            placeholder="Calle, colonia..."
          />
        </div>
        <div className="h-72">
          <MapView
            pins={form.lat && form.lng ? [{ lat: form.lat, lng: form.lng, label: form.name || "Mi local" }] : []}
            onMapClick={(lat, lng) => {
              if (!isInManzanillo(lat, lng)) return toast.error("El local tiene que estar en Manzanillo");
              setForm({ ...form, lat, lng });
            }}
            height="100%"
          />
          <p className="text-xs text-muted-foreground mt-1">Tip: toca el mapa para ajustar la ubicación.</p>
        </div>
        <Button type="submit" disabled={loading} className="w-full">Guardar</Button>
      </form>
    </Card>
  );
}
