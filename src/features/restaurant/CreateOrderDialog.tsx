import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddressSearch } from "@/components/AddressSearch";
import { MapView } from "@/components/MapView";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

type PaymentStatus = "pending" | "all" | "paid";

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pending: "Envío pendiente",
  all: "Cliente pagará todo",
  paid: "Envío y producto pagados",
};

function calcShippingFee(km: number): number {
  if (!Number.isFinite(km) || km <= 0) return 0;
  if (km <= 3) return 40;
  if (km <= 5) return 50;
  if (km <= 7) return 60;
  if (km <= 9) return 70;
  if (km <= 10.9) return 80;
  const extra = Math.ceil(km - 11);
  return 80 + 10 + extra * 10;
}

const schema = z.object({
  dropoff_address: z.string().trim().min(5).max(300),
  total: z.number().min(0).max(100000),
  payment: z.enum(["pending", "all", "paid"]),
  notes: z.string().trim().max(500).optional(),
});

export function CreateOrderDialog({ open, onOpenChange, restaurant, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  restaurant: { id: string; name: string; address: string; lat: number | null; lng: number | null };
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    dropoff_address: "", lat: null as number | null, lng: null as number | null,
    amount: "", payment: "pending" as PaymentStatus, notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const distanceKm = routeInfo?.distanceKm ?? null;
  const shippingFee = useMemo(() => (distanceKm == null ? 0 : calcShippingFee(distanceKm)), [distanceKm]);

  // Reset route info & mark loading whenever destination changes
  useEffect(() => {
    if (restaurant.lat == null || restaurant.lng == null || form.lat == null || form.lng == null) {
      setRouteInfo(null);
      setRouteLoading(false);
      return;
    }
    setRouteLoading(true);
  }, [restaurant.lat, restaurant.lng, form.lat, form.lng]);

  const handleRouteInfo = (info: { distanceKm: number; durationMin: number } | null) => {
    setRouteInfo(info);
    setRouteLoading(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({
      dropoff_address: form.dropoff_address,
      total: Number(form.amount || 0),
      payment: form.payment,
      notes: form.notes || undefined,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (form.lat == null || form.lng == null) return toast.error("Selecciona el destino en el mapa");
    setLoading(true);
    const total = Number(form.amount || 0);
    const amountToCollect = form.payment === "paid" ? 0 : total + shippingFee;
    const paymentNote = `[Pago: ${PAYMENT_LABELS[form.payment]}]`;
    const shippingNote = `[Envío: $${shippingFee} · ${distanceKm?.toFixed(2) ?? "?"} km]`;
    const composedNotes = form.notes
      ? `${paymentNote} ${shippingNote} ${form.notes}`
      : `${paymentNote} ${shippingNote}`;
    const { error } = await supabase.from("orders").insert({
      restaurant_id: restaurant.id,
      pickup_address: restaurant.address,
      pickup_lat: restaurant.lat, pickup_lng: restaurant.lng,
      dropoff_address: form.dropoff_address,
      dropoff_lat: form.lat, dropoff_lng: form.lng,
      amount_to_collect: amountToCollect,
      notes: composedNotes,
      status: "pending",
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Pedido publicado. Avisando a repartidores...");
    setForm({ dropoff_address: "", lat: null, lng: null, amount: "", payment: "pending", notes: "" });
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
              onRouteInfo={handleRouteInfo}
              height="100%"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Total del pedido</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div>
              <Label>¿Pagado por el cliente?</Label>
              <Select value={form.payment} onValueChange={(v) => setForm({ ...form, payment: v as PaymentStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Envío pendiente</SelectItem>
                  <SelectItem value="all">Cliente pagará todo</SelectItem>
                  <SelectItem value="paid">Envío y producto pagados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Distancia (km)</Label>
              <Input
                readOnly
                className="bg-muted"
                value={distanceKm == null ? "" : distanceKm.toFixed(2)}
                placeholder="Selecciona destino"
              />
            </div>
            <div>
              <Label>Total del envío</Label>
              <Input
                readOnly
                className="bg-muted font-medium"
                value={distanceKm == null ? "" : `$${shippingFee}`}
                placeholder="—"
              />
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
