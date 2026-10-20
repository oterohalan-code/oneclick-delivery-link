import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { CheckRow, FlowButton, FlowCard, MoneyLine } from "@/components/order/FlowCard";
import { MapView } from "@/components/MapView";
import { formatMxn } from "@/lib/business";
import { googleMapsDirectionsUrl } from "@/lib/maps";

export const Route = createFileRoute("/repartidor_/ejemplo")({
  head: () => ({
    meta: [{ title: "Repartidor de ejemplo — 1Click" }],
  }),
  component: CourierMock,
});

const pickup = { lat: 19.105, lng: -104.318, address: "Cocina del Puerto, Salagua, Manzanillo" };
const dropoff = { lat: 19.118, lng: -104.342, address: "Casa de Ana, Manzanillo" };
const money = { food: 250, shipping: 50, total: 300 };

function CourierMock() {
  const [step, setStep] = useState<"offer" | "link1" | "pickup" | "link2" | "cash" | "done">("offer");
  const [gotFood, setGotFood] = useState(false);
  const [paid, setPaid] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const [collected, setCollected] = useState(false);
  const pickupUrl = googleMapsDirectionsUrl(pickup);
  const dropoffUrl = googleMapsDirectionsUrl(dropoff);

  return (
    <div className="min-h-screen bg-bone text-ink">
      <header className="bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Logo size="sm" tone="bone" />
          <span className="text-sm">Repartidor de ejemplo</span>
        </div>
      </header>
      <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <p className="text-sm text-graphite">Luis M. · datos de ejemplo. Nada de esto es un pedido real.</p>

        {step === "offer" && (
          <FlowCard step="01" title="Oferta" subtitle="Cocina del Puerto">
            <p className="text-sm text-graphite">{pickup.address}</p>
            <p className="mt-1 text-sm text-graphite">{dropoff.address}</p>
            <div className="mt-3">
              <MoneyLine label="Adelantas al restaurante" amount={formatMxn(money.food)} />
              <MoneyLine label="Cobras al cliente" amount={formatMxn(money.total)} />
              <MoneyLine label="Tu envío" amount={formatMxn(money.shipping)} strong />
            </div>
            <div className="mt-3">
              <FlowButton onClick={() => setStep("link1")}>Aceptar pedido</FlowButton>
            </div>
          </FlowCard>
        )}

        {step === "link1" && (
          <FlowCard step="02" title="Ve al restaurante" subtitle="La ubicación del restaurante ya está cargada.">
            {pickupUrl && (
              <Button asChild variant="outline" className="mb-2 h-12 w-full">
                <a href={pickupUrl} target="_blank" rel="noopener noreferrer">Abrir restaurante en Maps</a>
              </Button>
            )}
            <FlowButton onClick={() => { toast.success("En camino al restaurante"); setStep("pickup"); }}>Voy en camino al restaurante</FlowButton>
          </FlowCard>
        )}

        {step === "pickup" && (
          <FlowCard step="03" title="Recogida" subtitle="Confirma que ya tienes el pedido y que dejaste el efectivo de la comida.">
            <p className="mb-3 rounded-xl alert-warning px-3 py-2 text-sm">Entregas {formatMxn(money.food)} en efectivo al restaurante.</p>
            <div className="space-y-2">
              <CheckRow checked={gotFood} label="Producto recibido" onChange={setGotFood} />
              <CheckRow checked={paid} label={`Dejé ${formatMxn(money.food)} al restaurante`} onChange={setPaid} />
            </div>
            <div className="mt-3">
              <FlowButton disabled={!gotFood || !paid} onClick={() => setStep("link2")}>Confirmar recogida</FlowButton>
            </div>
          </FlowCard>
        )}

        {step === "link2" && (
          <FlowCard step="04" title="Ve con el cliente" subtitle="El domicilio del cliente ya está cargado. Tu ubicación se comparte en vivo.">
            {dropoffUrl && (
              <Button asChild variant="outline" className="mb-2 h-12 w-full">
                <a href={dropoffUrl} target="_blank" rel="noopener noreferrer">Abrir domicilio en Maps</a>
              </Button>
            )}
            <FlowButton onClick={() => { toast.success("En camino al cliente"); setStep("cash"); }}>Voy en camino al cliente</FlowButton>
          </FlowCard>
        )}

        {step === "cash" && (
          <FlowCard step="05" title="Entrega y cobro" subtitle="Marca la entrega y el dinero que cobraste.">
            <p className="mb-3 text-lg font-semibold text-primary">Cobra al cliente {formatMxn(money.total)}</p>
            <div className="space-y-2">
              <CheckRow checked={delivered} label="Entregué el pedido" onChange={setDelivered} />
              <CheckRow checked={collected} label={`Cobré ${formatMxn(money.total)}`} onChange={setCollected} />
            </div>
            <div className="mt-3">
              <FlowButton disabled={!delivered || !collected} onClick={() => setStep("done")}>Confirmar entrega</FlowButton>
            </div>
          </FlowCard>
        )}

        {step === "done" && (
          <FlowCard step="06" title="Pedido finalizado">
            <div className="mb-3 rounded-xl alert-success px-3 py-3 text-sm">Entrega confirmada</div>
            <MoneyLine label="Cobro registrado" amount={formatMxn(money.total)} />
            <MoneyLine label="Anticipo recuperado" amount={formatMxn(money.food)} />
            <MoneyLine label="Tu envío" amount={formatMxn(money.shipping)} strong />
            <div className="mt-3">
              <FlowButton onClick={() => setStep("offer")}>Volver a pedidos</FlowButton>
            </div>
          </FlowCard>
        )}

        {step !== "offer" && step !== "done" && (
          <div className="h-56 overflow-hidden rounded-2xl">
            <MapView
              pins={step === "link2" || step === "cash"
                ? [{ lat: dropoff.lat, lng: dropoff.lng, label: "Cliente" }]
                : [{ lat: pickup.lat, lng: pickup.lng, label: "Restaurante" }]}
              height="100%"
            />
          </div>
        )}
      </main>
    </div>
  );
}
