import { useState } from "react";
import { toast } from "sonner";
import { formatMxn } from "@/lib/business";
import {
  courierPickupMessage,
  customerEnRouteMessage,
  maskPhone,
  openWhatsApp,
  orderCode,
  orderMoney,
  readFlowFlag,
  writeFlowFlag,
} from "@/lib/order-flow";
import { copyText } from "@/lib/maps";
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
  onCancel,
}: {
  order: RestaurantBoardOrder;
  restaurantName: string;
  courierName: string | null;
  courierPhone: string | null;
  onCancel?: () => void;
}) {
  const code = orderCode(order);
  const money = orderMoney(order);
  const [tick, setTick] = useState(0);
  const firstSent = readFlowFlag(order.id, "restaurant-first");
  const secondSent = readFlowFlag(order.id, "restaurant-second");
  void tick;

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

  const mark = (flag: string) => {
    writeFlowFlag(order.id, flag);
    setTick((value) => value + 1);
  };

  if (order.status === "delivered") {
    return (
      <FlowCard title={`Pedido #${code}`} step="Completado">
        <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          Entrega registrada por el repartidor
        </div>
        <MoneyLine label="Comida recibida" amount={formatMxn(money.food)} />
        <MoneyLine label="Envío del repartidor" amount={formatMxn(money.shipping)} />
        <MoneyLine label="Total del pedido" amount={formatMxn(money.total)} strong />
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
    return (
      <FlowCard step="03" title="Hacia el restaurante">
        <p className="mb-2 text-sm">
          Repartidor: <strong>{courierName || "Asignado"}</strong>
        </p>
        <p className="mb-3 text-sm text-graphite">
          Comparte la liga del local. El repartidor paga la comida en efectivo.
        </p>
        <FlowButton onClick={shareCourier}>Abrir WhatsApp para enviar</FlowButton>
        <div className="mt-2">
          <FlowButton variant="outline" onClick={() => mark("restaurant-first")}>
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
          Primera liga registrada. Esperando a que {courierName || "el repartidor"} recoja el pedido.
        </div>
      </FlowCard>
    );
  }

  if (order.status === "in_transit" && !secondSent) {
    return (
      <FlowCard step="04" title="Hacia el cliente">
        <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          Pedido recogido. Comparte la liga del domicilio con el cliente.
        </div>
        <FlowButton onClick={shareCustomer}>Abrir WhatsApp para enviar</FlowButton>
        <div className="mt-2">
          <FlowButton variant="outline" onClick={() => mark("restaurant-second")}>
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
    </FlowCard>
  );
}
