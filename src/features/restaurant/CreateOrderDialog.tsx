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
import { formatMxn } from "@/lib/business";
import { StepHeading } from "@/components/order/FlowCard";

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
  const [step, setStep] = useState<1 | 2>(1);

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

  const foodMxn = Number(form.amount || 0);
  const clientTotal = foodMxn + shippingFee;

  const readyForReview = () => {
    const parsed = schema.safeParse({
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      dropoff_address: form.dropoff_address,
      total: foodMxn,
      paymentMode: form.paymentMode,
      notes: form.notes || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return false;
    }
    if (form.lat == null || form.lng == null) {
      toast.error("Selecciona el destino en el mapa");
      return false;
    }
    return true;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!readyForReview() || form.lat == null || form.lng == null) return;
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
        foodMxn,
        shippingMxn: shippingFee,
        distanceKm,
        notes: form.notes || undefined,
        paymentMode: form.paymentMode,
      },
    });
    setLoading(false);
    if (!result?.ok) return toast.error(result?.message ?? "No se pudo crear el pedido.");
    setStep(1);
    toast.success("Pedido publicado. La liga al cliente se manda cuando el repartidor recoja.");
    onOpenChange(false);
    setForm({ customer_name: "", customer_phone: "", dropoff_address: "", lat: null, lng: null, amount: "", paymentMode: "collect_on_delivery", notes: "" });

    try {
      await notifyCouriersFn({
        headers: { Authorization: `Bearer ${token}` },
        data: { orderId: result.orderId },
      });
    } catch (e) {
      console.warn("notify couriers failed", e);
    }

    onCreated();
  };

  const resetAndClose = () => {
    setStep(1);
    setForm({ customer_name: "", customer_phone: "", dropoff_address: "", lat: null, lng: null, amount: "", paymentMode: "collect_on_delivery", notes: "" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) resetAndClose(); else onOpenChange(next); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>{step === 1 ? "Datos del pedido" : "Revisar y solicitar"}</DialogTitle>
        </DialogHeader>
        {step === 1 ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (readyForReview()) setStep(2);
          }}
        >
          <StepHeading step="01" title="Datos del pedido" subtitle="Captura al cliente, la dirección y cuánto cuesta la comida." />
          <div>
            <Label>Cliente</Label>
            <Input
              placeholder="Ana Ejemplo"
              value={form.customer_name}
              maxLength={80}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>Teléfono</Label>
            <div className="flex">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm text-muted-foreground">+52</span>
              <Input
                className="rounded-l-none"
                type="tel"
                inputMode="numeric"
                placeholder="3141234567"
                value={form.customer_phone}
                maxLength={10}
                onChange={(e) => setForm({ ...form, customer_phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                required
              />
            </div>
          </div>
          <div>
            <Label>Dirección y referencias</Label>
            <AddressSearch
              value={form.dropoff_address}
              onChange={(a, lat, lng) => setForm({ ...form, dropoff_address: a, lat: lat ?? form.lat, lng: lng ?? form.lng })}
            />
            <p className="text-xs text-muted-foreground mt-1">O toca el mapa para poner el pin del cliente.</p>
          </div>
          <div className="h-48">
            <MapView pins={pins} showRoute onMapClick={handleMapClick} onRouteInfo={handleRouteInfo} height="100%" />
          </div>
          <div>
            <Label>Origen del pedido</Label>
            <Input readOnly className="bg-muted" value={restaurant.name} />
          </div>
          <div>
            <Label>Comida</Label>
            <Input type="number" min="0" step="1" placeholder="250" value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <Button type="submit" className="h-12 w-full">Continuar</Button>
        </form>
        ) : (
        <form onSubmit={submit} className="space-y-4">
          <StepHeading step="02" title="Revisar y solicitar" subtitle="Confirma los datos y pide el repartidor." />
          <div className="rounded-xl border border-hairline bg-bone px-3 py-2 text-sm">
            <div className="flex justify-between gap-3 py-1"><span className="text-graphite">Restaurante</span><span>{restaurant.name}</span></div>
            <div className="flex justify-between gap-3 py-1"><span className="text-graphite">Cliente</span><span>{form.customer_name}</span></div>
            <div className="flex justify-between gap-3 py-1"><span className="text-graphite">Teléfono</span><span>+52 {form.customer_phone}</span></div>
            <div className="py-1 text-graphite">{addressLoading ? "Obteniendo dirección…" : form.dropoff_address}</div>
          </div>
          <div className="rounded-xl bg-amber-50 px-3 py-3 text-sm">
            <div className="text-xs uppercase tracking-wide text-amber-900">Modalidad de pago</div>
            <Select value={form.paymentMode} onValueChange={(v) => setForm({ ...form, paymentMode: v as PaymentMode })}>
              <SelectTrigger className="mt-2 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="collect_on_delivery">Pago en domicilio</SelectItem>
                <SelectItem value="prepaid_at_restaurant">Ya pagó en el restaurante</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm">
            <div className="flex justify-between py-1"><span>Comida</span><span>{formatMxn(foodMxn)}</span></div>
            <div className="flex justify-between py-1 text-graphite">
              <span>Envío del repartidor</span>
              <span>{routeLoading ? "Calculando…" : distanceKm == null ? "—" : formatMxn(shippingFee)}</span>
            </div>
            <div className="flex justify-between border-t border-hairline pt-2 font-semibold">
              <span>Total cliente</span>
              <span>{routeLoading || distanceKm == null ? "—" : formatMxn(clientTotal)}</span>
            </div>
            {quote && quote.surgeReason !== "normal" && (
              <Badge variant="secondary" className="mt-2 text-xs">{surgeLabel(quote.surgeReason)}</Badge>
            )}
          </div>
          {form.paymentMode === "collect_on_delivery" && (
            <p className="rounded-xl bg-sky-50 px-3 py-3 text-sm text-sky-950">
              Recibes {formatMxn(foodMxn)} en efectivo del repartidor. Él cobra {formatMxn(clientTotal)} al cliente.
            </p>
          )}
          <Button type="button" variant="outline" className="h-12 w-full" onClick={() => setStep(1)}>Volver</Button>
          <Button type="submit" disabled={loading || routeLoading || distanceKm == null} className="h-12 w-full">
            {loading ? "Publicando…" : "Solicitar repartidor"}
          </Button>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
