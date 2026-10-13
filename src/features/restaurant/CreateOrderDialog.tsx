import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddressSearch } from "@/components/AddressSearch";
import { MapView, reverseGeocode } from "@/components/MapView";
import { toast } from "sonner";
import { z } from "zod";
import { calculateShippingFee, surgeLabel } from "@/lib/pricing";
import { Badge } from "@/components/ui/badge";
import { createRestaurantOrder, notifyCouriersNewOrder } from "@/lib/rpc/orders.functions";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import type { PaymentMode } from "@/lib/order-money";

const schema = z.object({
  customer_name: z.string().trim().min(2, "Nombre del cliente requerido").max(80),
  customer_phone: z.string().regex(/^\d{10}$/, "WhatsApp: 10 dígitos"),
  dropoff_address: z.string().trim().min(5, "Dirección de entrega requerida").max(300),
  total: z.number().min(0).max(100000),
  paymentMode: z.enum(["prepaid_at_restaurant", "collect_on_delivery"]),
  notes: z.string().trim().max(500).optional(),
});

export function CreateOrderDialog({ open, onOpenChange, restaurant, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  restaurant: { id: string; name: string; address: string; lat: number | null; lng: number | null };
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    customer_name: "", customer_phone: "",
    dropoff_address: "", lat: null as number | null, lng: null as number | null,
    amount: "", paymentMode: "collect_on_delivery" as PaymentMode, notes: "",
  });
  const [loading, setLoading] = useState(false);
  const { session } = useAuth();
  const createOrderFn = useServerFn(createRestaurantOrder);
  const notifyCouriersFn = useServerFn(notifyCouriersNewOrder);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    setForm((f) => ({ ...f, lat, lng }));
    setAddressLoading(true);
    try {
      const addr = await reverseGeocode(lat, lng);
      setForm((f) => ({ ...f, dropoff_address: addr ?? `Pin: ${lat.toFixed(5)}, ${lng.toFixed(5)}` }));
    } finally {
      setAddressLoading(false);
    }
  }, []);

  const distanceKm = routeInfo?.distanceKm ?? null;
  const quote = useMemo(
    () => (distanceKm == null ? null : calculateShippingFee(distanceKm)),
    [distanceKm]
  );
  const shippingFee = quote?.totalFee ?? 0;

  // Reset route info & mark loading whenever destination changes
  useEffect(() => {
    if (restaurant.lat == null || restaurant.lng == null || form.lat == null || form.lng == null) {
      setRouteInfo(null);
      setRouteLoading(false);
      return;
    }
    setRouteLoading(true);
  }, [restaurant.lat, restaurant.lng, form.lat, form.lng]);

  const handleRouteInfo = useCallback((info: { distanceKm: number; durationMin: number } | null) => {
    setRouteInfo(info);
    setRouteLoading(false);
  }, []);

  const pins = useMemo(() => [
    ...(restaurant.lat != null && restaurant.lng != null
      ? [{ lat: restaurant.lat, lng: restaurant.lng, label: "Recogida" }]
      : []),
    ...(form.lat != null && form.lng != null
      ? [{ lat: form.lat, lng: form.lng, label: "Entrega" }]
      : []),
  ], [restaurant.lat, restaurant.lng, form.lat, form.lng]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      dropoff_address: form.dropoff_address,
      total: Number(form.amount || 0),
      paymentMode: form.paymentMode,
      notes: form.notes || undefined,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (form.lat == null || form.lng == null) return toast.error("Selecciona el destino en el mapa");
    const token = session?.access_token;
    if (!token) return toast.error("Sesión expirada.");
    setLoading(true);
    const result = await createOrderFn({
      headers: { Authorization: `Bearer ${token}` },
      data: {
        dropoff_address: form.dropoff_address,
        dropoff_lat: form.lat,
        dropoff_lng: form.lng,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone,
        foodMxn: Number(form.amount || 0),
        shippingMxn: shippingFee,
        distanceKm,
        notes: form.notes || undefined,
        paymentMode: form.paymentMode,
      },
    });
    setLoading(false);
    if (!result?.ok) return toast.error(result?.message ?? "No se pudo crear el pedido.");
    toast.success("Pedido publicado. Avisando a repartidores...");

    try {
      await notifyCouriersFn({
        headers: { Authorization: `Bearer ${token}` },
        data: { orderId: result.orderId },
      });
    } catch (e) {
      console.warn("notify couriers failed", e);
    }

    setForm({ customer_name: "", customer_phone: "", dropoff_address: "", lat: null, lng: null, amount: "", paymentMode: "collect_on_delivery", notes: "" });
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>Solicitar repartidor</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Nombre del cliente</Label>
              <Input
                placeholder="Ej. Juan Pérez"
                value={form.customer_name}
                maxLength={80}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>WhatsApp del cliente</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm text-muted-foreground">+52</span>
                <Input
                  className="rounded-l-none"
                  type="tel"
                  inputMode="numeric"
                  placeholder="5512345678"
                  value={form.customer_phone}
                  maxLength={10}
                  onChange={(e) => setForm({ ...form, customer_phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                  required
                />
              </div>
            </div>
          </div>
          <div>
            <Label>Buscar dirección (opcional)</Label>
            <AddressSearch
              value={form.dropoff_address}
              onChange={(a, lat, lng) => setForm({ ...form, dropoff_address: a, lat: lat ?? form.lat, lng: lng ?? form.lng })}
            />
            <p className="text-xs text-muted-foreground mt-1">O toca el mapa para colocar el pin del destino.</p>
          </div>
          <div className="h-56">
            <MapView
              pins={pins}
              showRoute
              onMapClick={handleMapClick}
              onRouteInfo={handleRouteInfo}
              height="100%"
            />
          </div>
          <div>
            <Label>Destino seleccionado</Label>
            <Input
              readOnly
              className="bg-muted"
              value={addressLoading ? "Obteniendo dirección…" : form.dropoff_address}
              placeholder="Selecciona en el mapa o busca arriba"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Total del pedido</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </div>
            <div>
              <Label>Modalidad de cobro</Label>
              <Select value={form.paymentMode} onValueChange={(v) => setForm({ ...form, paymentMode: v as PaymentMode })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="collect_on_delivery">Cobrar al cliente en entrega</SelectItem>
                  <SelectItem value="prepaid_at_restaurant">Ya pagó en el restaurante</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Distancia por ruta (km)</Label>
              <Input
                readOnly
                className="bg-muted"
                value={routeLoading ? "Calculando ruta…" : distanceKm == null ? "" : `${distanceKm.toFixed(2)}${routeInfo ? ` · ~${Math.round(routeInfo.durationMin)} min` : ""}`}
                placeholder="Selecciona destino"
              />
            </div>
            <div>
              <Label>Total del envío</Label>
              <Input
                readOnly
                className="bg-muted font-medium"
                value={routeLoading ? "…" : distanceKm == null ? "" : `$${shippingFee}`}
                placeholder="—"
              />
              {quote && quote.surgeReason !== "normal" && (
                <Badge variant="secondary" className="mt-1 text-xs">
                  {surgeLabel(quote.surgeReason)} · base ${quote.baseFee}
                </Badge>
              )}
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
