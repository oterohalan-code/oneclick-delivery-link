import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { formatMxn } from "@/lib/business";
import { useAuth } from "@/lib/auth-context";
import {
  courierPickupMessage,
  customerEnRouteMessage,
  maskPhone,
  openWhatsApp,
  orderCode,
  orderMoney,
  parseOrderFlow,
  readFlowFlag,
  writeFlowFlag,
  type OrderFlow,
} from "@/lib/order-flow";
import { copyText, googleMapsDirectionsUrl } from "@/lib/maps";
import { recordOrderFlow } from "@/lib/rpc/orders.functions";
import { CheckRow, FlowButton, FlowCard, MoneyLine } from "@/components/order/FlowCard";

export type RestaurantBoardOrder = {
  id: string;
  external_order_id: string | null;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  pickup_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_address: string;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  amount_to_collect: number;
  shipping_fee?: number | null;
  food_amount_cents?: number | null;
  shipping_amount_cents?: number | null;
  payment_mode?: string | null;
};

export function RestaurantOrderBoard({
  order,
  restaurantName,
  courierName,
  courierPhone,
  flow,
  onSaved,
  onCancel,
  persist = true,
}: {
  order: RestaurantBoardOrder;
  restaurantName: string;
  courierName: string | null;
  courierPhone: string | null;
  flow?: OrderFlow;
  onSaved?: () => void;
  onCancel?: () => void;
  persist?: boolean;
}) {
  const { session } = useAuth();
  const record = useServerFn(recordOrderFlow);
  const code = orderCode(order);
  const money = orderMoney(order);
  const shared = parseOrderFlow(flow);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const firstSent = persist ? !!shared.restaurantFirstSentAt : readFlowFlag(order.id, "restaurant-first");
  const secondSent = persist ? !!shared.restaurantSecondSentAt : readFlowFlag(order.id, "restaurant-second");
  void tick;

  const save = async (action: "restaurant_first_sent" | "restaurant_second_sent") => {
    if (!persist) {
      writeFlowFlag(order.id, action === "restaurant_first_sent" ? "restaurant-first" : "restaurant-second");
      setTick((value) => value + 1);
      return;
    }
    const token = session?.access_token;
    if (!token) return toast.error("Sesión expirada.");
    setBusy(true);
    const res = await record({
      headers: { Authorization: `Bearer ${token}` },
      data: { orderId: order.id, action },
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return toast.error(res?.message ?? "No se pudo guardar.");
    toast.success("Quedó registrado en el pedido.");
    onSaved?.();
  };

  const pickup = { lat: order.pickup_lat, lng: order.pickup_lng, address: order.pickup_address };
  const dropoff = { lat: order.dropoff_lat, lng: order.dropoff_lng, address: order.dropoff_address };

  const shareCourier = async () => {
    const text = courierPickupMessage({
      code,
      restaurantName,
      pickup,
      customerName: order.customer_name,
      money,
    });
    const opened = courierPhone ? openWhatsApp(courierPhone, text) : false;
    if (!opened) {
      const ok = await copyText(text);
      toast[ok ? "success" : "error"](ok ? "Mensaje del repartidor copiado" : "No se pudo abrir WhatsApp");
    }
  };

  const shareCustomer = async () => {
    const text = customerEnRouteMessage({ dropoff, money });
    const opened = openWhatsApp(order.customer_phone, text);
    if (!opened) {
      const ok = await copyText(text);
      toast[ok ? "success" : "error"](ok ? "Mensaje del cliente copiado" : "Sin teléfono del cliente");
    }
  };

  const courierSaved = !!shared.courierFirstSavedAt;
  const cashNoted = !!shared.productReceivedAt && !!shared.advancePaidAt;

  if (order.status === "delivered") {
    return (
      <FlowCard title={`Pedido #${code}`} step="Completado">
        <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          Entrega registrada por el repartidor
        </div>
        <MoneyLine label="Comida recibida" amount={formatMxn(money.food)} />
        <MoneyLine label="Envío del repartidor" amount={formatMxn(money.shipping)} />
        <MoneyLine label="Total del pedido" amount={formatMxn(money.total)} strong />
        {shared.cashCollectedAt && <p className="mt-2 text-sm text-graphite">El repartidor registró el cobro.</p>}
        {shared.incidentNote && (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">Incidencia: {shared.incidentNote}</p>
        )}
      </FlowCard>
    );
  }

  if (order.status === "pending") {
    return (
      <FlowCard step="02" title="Revisar y solicitar">
        <p className="mb-2 text-sm text-graphite">Pedido #{code}. Buscando repartidor.</p>
        <MoneyLine label="Cliente" amount={order.customer_name || "Sin nombre"} />
        <MoneyLine label="Teléfono" amount={maskPhone(order.customer_phone)} />
        <MoneyLine label="Comida" amount={formatMxn(money.food)} />
        <MoneyLine label="Envío" amount={formatMxn(money.shipping)} />
        <MoneyLine label="Total" amount={formatMxn(money.total)} strong />
        <p className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900">
          Pago en domicilio. La primera liga se manda cuando un repartidor acepte.
        </p>
        {onCancel && (
          <div className="mt-3">
            <FlowButton variant="outline" onClick={onCancel}>Cancelar envío</FlowButton>
          </div>
        )}
      </FlowCard>
    );
  }

  if (order.status === "assigned" && !firstSent) {
    const courierText = courierPickupMessage({
      code,
      restaurantName,
      pickup,
      customerName: order.customer_name,
      money,
    });
    const pickupUrl = googleMapsDirectionsUrl(pickup);
    return (
      <FlowCard step="03" title="Hacia el restaurante">
        <p className="mb-2 text-sm">Repartidor asignado: <strong>{courierName || "Asignado"}</strong></p>
        <p className="mb-3 text-sm text-graphite">Comparte la primera liga para que llegue al local.</p>
        {pickupUrl && (
          <a href={pickupUrl} target="_blank" rel="noopener noreferrer" className="mb-3 block rounded-xl border border-hairline px-3 py-2 text-sm text-primary">
            Abrir liga de Google Maps
          </a>
        )}
        <pre className="mb-3 whitespace-pre-wrap rounded-xl bg-bone px-3 py-2 text-sm">{courierText}</pre>
        <FlowButton onClick={shareCourier}>Abrir WhatsApp para enviar</FlowButton>
        <div className="mt-2">
          <FlowButton disabled={busy} variant="outline" onClick={() => save("restaurant_first_sent")}>
            Confirmar que envié la liga
          </FlowButton>
        </div>
      </FlowCard>
    );
  }

  if (order.status === "assigned") {
    return (
      <FlowCard step="03" title="Hacia el restaurante">
        <div className="rounded-xl bg-sky-50 px-3 py-3 text-sm text-sky-900">
          Primera liga registrada en el pedido. {courierSaved ? `${courierName || "El repartidor"} ya la guardó.` : `Esperando a que ${courierName || "el repartidor"} la guarde.`}
        </div>
        {cashNoted && <p className="mt-2 text-sm text-graphite">El repartidor marcó producto recibido y anticipo entregado.</p>}
        {shared.incidentNote && (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">Incidencia: {shared.incidentNote}</p>
        )}
      </FlowCard>
    );
  }

  if (order.status === "in_transit" && !secondSent) {
    const clientText = customerEnRouteMessage({ dropoff, money });
    const dropoffUrl = googleMapsDirectionsUrl(dropoff);
    return (
      <FlowCard step="04" title="Hacia el cliente">
        <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          Pedido recogido. Comparte la segunda liga para que el cliente vea el recorrido a su casa.
        </div>
        {dropoffUrl && (
          <a href={dropoffUrl} target="_blank" rel="noopener noreferrer" className="mb-3 block rounded-xl border border-hairline px-3 py-2 text-sm text-primary">
            Abrir liga de Google Maps
          </a>
        )}
        <pre className="mb-3 whitespace-pre-wrap rounded-xl bg-bone px-3 py-2 text-sm">{clientText}</pre>
        <FlowButton onClick={shareCustomer}>Abrir WhatsApp para enviar</FlowButton>
        <div className="mt-2">
          <FlowButton disabled={busy} variant="outline" onClick={() => save("restaurant_second_sent")}>
            Confirmar que envié la liga
          </FlowButton>
        </div>
      </FlowCard>
    );
  }

  return (
    <FlowCard step="04" title="Hacia el cliente">
      <div className="rounded-xl bg-sky-50 px-3 py-3 text-sm text-sky-900">
        Segunda liga registrada. El cliente puede abrir Google Maps. Esperando la entrega.
      </div>
      <MoneyLine label="Total a cobrar" amount={formatMxn(money.total)} strong />
      {shared.courierSecondSavedAt && <p className="mt-2 text-sm text-graphite">El repartidor guardó la liga del domicilio.</p>}
      {shared.incidentNote && (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">Incidencia: {shared.incidentNote}</p>
      )}
    </FlowCard>
  );
}
