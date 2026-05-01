import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AddressSearch } from "@/components/AddressSearch";
import { MapView } from "@/components/MapView";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  dropoff_address: z.string().trim().min(5).max(300),
  amount_to_collect: z.number().min(0).max(100000),
  external_order_id: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(500).optional(),
});

export function CreateOrderDialog({ open, onOpenChange, restaurant, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  restaurant: { id: string; name: string; address: string; lat: number | null; lng: number | null };
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    dropoff_address: "", lat: null as number | null, lng: null as number | null,
    amount: "", external: "", notes: "",
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({
      dropoff_address: form.dropoff_address,
      amount_to_collect: Number(form.amount || 0),
      external_order_id: form.external || undefined,
      notes: form.notes || undefined,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (form.lat == null || form.lng == null) return toast.error("Selecciona el destino en el mapa");
    setLoading(true);
    const { error } = await supabase.from("orders").insert({
      restaurant_id: restaurant.id,
      pickup_address: restaurant.address,
      pickup_lat: restaurant.lat, pickup_lng: restaurant.lng,
      dropoff_address: form.dropoff_address,
      dropoff_lat: form.lat, dropoff_lng: form.lng,
      amount_to_collect: Number(form.amount || 0),
      external_order_id: form.external || null,
      notes: form.notes || null,
      status: "pending",
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Pedido publicado. Avisando a repartidores...");
    setForm({ dropoff_address: "", lat: null, lng: null, amount: "", external: "", notes: "" });
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>Solicitar repartidor</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Dirección de entrega</Label>
            <AddressSearch
              value={form.dropoff_address}
              onChange={(a, lat, lng) => setForm({ ...form, dropoff_address: a, lat: lat ?? form.lat, lng: lng ?? form.lng })}
            />
          </div>
          <div className="h-56">
            <MapView
              pins={[
                ...(restaurant.lat && restaurant.lng ? [{ lat: restaurant.lat, lng: restaurant.lng, label: "Recogida" }] : []),
                ...(form.lat && form.lng ? [{ lat: form.lat, lng: form.lng, label: "Entrega" }] : []),
              ]}
              showRoute
              onMapClick={(lat, lng) => setForm({ ...form, lat, lng })}
              height="100%"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monto a cobrar</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div>
              <Label>ID pedido</Label>
              <Input placeholder="Opcional" value={form.external}
                onChange={(e) => setForm({ ...form, external: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <Button type="submit" disabled={loading} className="w-full">Publicar pedido</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
