import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import directoryCover from "@/assets/directory-premium.jpg";
import { Search, UtensilsCrossed } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMxn } from "@/lib/business";
import { packDropoff, parseMenu, publicMediaUrl, whatsappOrderUrl, type PublicRestaurant } from "@/lib/restaurant-media";
import { googleMapsPlaceUrl, parseGoogleMapsLink } from "@/lib/maps";
import { isInManzanillo } from "@/components/MapView";
import { useServerFn } from "@tanstack/react-start";
import { resolveGoogleMapsLink } from "@/lib/rpc/maps.functions";

export function PublicDirectory({ selectedId }: { selectedId?: string }) {
  const [places, setPlaces] = useState<PublicRestaurant[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.rpc("list_public_restaurants").then(({ data, error }) => {
      if (!active) return;
      if (error || !data) setPlaces([]);
      else setPlaces(data
        .filter((row) => !/canc[uú]n|quintana roo/i.test(row.address ?? ""))
        .map((row) => ({ ...row, menu: parseMenu(row.menu) })));
      setReady(true);
    });
    return () => { active = false; };
  }, []);

  const selected = places.find((place) => place.id === selectedId);
  if (selected) return <RestaurantProfile place={selected} />;

  const categories = ["Todos", ...Array.from(new Set(places.map((place) => place.category).filter((value): value is string => !!value)))];
  const shown = places.filter((place) => {
    const matchesCategory = category === "Todos" || place.category === category;
    const haystack = `${place.name} ${place.category ?? ""}`.toLowerCase();
    return matchesCategory && haystack.includes(query.trim().toLowerCase());
  });

  return (
    <div>
      <section className="directory-hero -mx-4 sm:-mx-6 px-6 sm:px-10 lg:px-14">
        <img src={directoryCover} alt="Tacos y tostadas de cocina mexicana" width={1536} height={768} className="absolute inset-0 -z-10 h-full w-full object-cover" fetchPriority="high" />
        <div className="py-10">
          <h1>Encuentra tu restaurante en Manzanillo</h1>
          <p className="mt-4 text-base">Antojos locales, en un solo lugar.</p>
        </div>
      </section>
      <div className="directory-search relative mt-8 flex gap-2 rounded-lg">
        <Search aria-hidden className="absolute left-4 top-4 h-5 w-5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre o tipo de comida"
          aria-label="Buscar restaurantes" className="h-14 min-w-0 flex-1 rounded-lg border border-hairline bg-card pl-12 pr-4"
        />
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {categories.map((item) => (
          <Button
            variant="outline"
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={`shrink-0 h-10 rounded-lg px-4 py-2 text-sm font-semibold transition ${item === category ? "bg-primary text-primary-foreground shadow-button" : "bg-card text-ink border border-hairline hover:border-ink/30"}`}
          >
            {item}
          </Button>
        ))}
      </div>
      {!ready ? (
        <p className="mt-8 text-sm text-graphite">Cargando locales…</p>
      ) : shown.length === 0 ? (
        <p className="mt-8 text-sm text-graphite">Todavía no hay locales con menú público.</p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((place) => {
            const photo = publicMediaUrl(place.facade_url) || publicMediaUrl(place.logo_url);
            return (
              <li key={place.id}>
                <Link
                  to="/"
                  search={(previous) => ({ ...previous, local: place.id })}
                  className="group block overflow-hidden rounded-lg border border-hairline bg-card shadow-soft transition-shadow hover:shadow-elegant"
                >
                  <div className="grid h-48 place-items-center bg-secondary">
                    {photo ? <img src={photo} alt={place.name} loading="lazy" className="h-full w-full object-cover" /> : <UtensilsCrossed aria-hidden className="h-10 w-10 text-muted-foreground/40" />}
                  </div>
                  <div className="p-4">
                    <h2 className="text-lg font-semibold">{place.name}</h2>
                    <p className="text-sm text-graphite">{place.category || "Restaurante"} · Manzanillo</p>
                    {place.menu[0] && <p className="mt-2 line-clamp-2 text-sm">{place.menu[0].description || place.menu[0].name}</p>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function RestaurantProfile({ place, preview = false, demo = false }: { place: PublicRestaurant; preview?: boolean; demo?: boolean }) {
  const resolveLink = useServerFn(resolveGoogleMapsLink);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [mapsLink, setMapsLink] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [payMode, setPayMode] = useState<"collect_on_delivery" | "prepaid_at_restaurant">("collect_on_delivery");
  const [sent, setSent] = useState(false);
  const chosen = place.menu.flatMap((item) => {
    const count = qty[item.name] ?? 0;
    return count > 0 ? [{ name: item.name, price: item.price, qty: count }] : [];
  });
  const foodTotal = chosen.reduce((sum, item) => sum + item.price * item.qty, 0);
  const photo = publicMediaUrl(place.facade_url);
  const logo = publicMediaUrl(place.logo_url);
  const orderUrl = whatsappOrderUrl(place.phone, place.name);
  return (
    <div className="mx-auto max-w-lg">
      {demo ? (
        <p className="text-sm font-medium text-graphite">Datos de ejemplo</p>
      ) : preview ? (
        <p className="text-sm font-medium text-graphite">Así lo ve el cliente</p>
      ) : (
        <Link to="/" search={(previous) => ({ ...previous, local: undefined })} className="text-sm text-graphite">Volver a restaurantes</Link>
      )}
      <div className="mt-3 overflow-hidden rounded-2xl border border-hairline bg-card">
        <div className="h-48 bg-bone">
          {photo && <img src={photo} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="p-4">
          <div className="flex items-center gap-3">
            {logo && <img src={logo} alt="" className="h-14 w-14 rounded-full object-cover" />}
            <div>
              <h1 className="text-2xl font-semibold">{place.name}</h1>
              <p className="text-sm text-graphite">{place.category || "Restaurante"} · Manzanillo, Col.</p>
            </div>
          </div>
          {place.hours && <p className="mt-3 text-sm">Horario {place.hours}</p>}
          {place.address && <p className="text-sm text-graphite">{place.address}</p>}
          <h2 className="mt-5 font-semibold">Menú</h2>
          <ul className="mt-2 divide-y divide-hairline">
            {place.menu.length === 0 && <li className="py-3 text-sm text-graphite">Este local todavía no publica platillos.</li>}
            {place.menu.map((item) => {
              const dish = publicMediaUrl(item.image);
              return (
                <li key={`${item.name}-${item.price}`} className="flex items-start gap-3 py-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-bone">
                    {dish && <img src={dish} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{item.name}</div>
                    {item.description && <p className="text-sm text-graphite">{item.description}</p>}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatMxn(item.price)}</div>
                    <div className="mt-1 flex items-center justify-end gap-2">
                      <button type="button" className="h-7 w-7 rounded-full border" onClick={() => setQty({ ...qty, [item.name]: Math.max(0, (qty[item.name] ?? 0) - 1) })}>-</button>
                      <span className="w-4 text-center text-sm">{qty[item.name] ?? 0}</span>
                      <button type="button" className="h-7 w-7 rounded-full border" onClick={() => setQty({ ...qty, [item.name]: (qty[item.name] ?? 0) + 1 })}>+</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {(!preview || demo) && sent && (
            <div className="mt-4 rounded-xl bg-success/10 px-3 py-3 text-sm text-success">
              Pedido recibido. {place.name} ya puede verlo y pedir al repartidor.
            </div>
          )}
          {(!preview || demo) && !sent && (
            <form
              className="mt-4 space-y-2"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!chosen.length) return toast.error("Elige al menos un platillo");
                if (!/^\d{10}$/.test(phone)) return toast.error("Teléfono de 10 dígitos");
                let parsedLink = parseGoogleMapsLink(mapsLink);
                if (!parsedLink) return toast.error("Pega la liga de Google Maps de tu casa");
                if (sending) return;
                setSending(true);
                try {
                if (parsedLink.lat == null || parsedLink.lng == null) {
                  const result = await resolveLink({ data: { url: mapsLink } });
                  if (!result.ok) return toast.error(result.message);
                  parsedLink = result.point;
                }
                if (parsedLink.lat == null || parsedLink.lng == null) return toast.error("Comparte el punto exacto de tu casa.");
                if (!isInManzanillo(parsedLink.lat, parsedLink.lng)) return toast.error("La entrega es solo en Manzanillo");
                setLat(parsedLink.lat);
                setLng(parsedLink.lng);
                if (demo) {
                  setSent(true);
                  return;
                }
                setSending(true);
                const { data, error } = await supabase.rpc("place_menu_request", {
                  _restaurant_id: place.id,
                  _customer_name: name,
                  _customer_phone: phone,
                  _dropoff_address: packDropoff(address || "Casa del cliente", parsedLink.lat, parsedLink.lng, parsedLink.url),
                  _items: chosen,
                  _payment_mode: payMode,
                });
                setSending(false);
                if (error) return toast.error(error.message);
                if (data) {
                  void fetch("/api/public/menu-request-alert", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ restaurantId: place.id, requestId: data }),
                  });
                }
                setSent(true);
                } catch {
                  toast.error("No se pudo enviar el pedido. Intenta otra vez.");
                } finally { setSending(false); }
              }}
            >
              <input className="h-11 w-full rounded-xl border px-3" placeholder="Tu nombre" value={name} onChange={(event) => setName(event.target.value)} required />
              <input className="h-11 w-full rounded-xl border px-3" placeholder="WhatsApp, 10 dígitos" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} required />
              <input className="h-11 w-full rounded-xl border px-3" placeholder="Calle y colonia" value={address} onChange={(event) => setAddress(event.target.value)} required />
              <a className="block text-sm text-primary" href="https://www.google.com/maps/search/?api=1&query=Manzanillo%2C%20Colima" target="_blank" rel="noopener noreferrer">Abrir Google Maps</a>
              <input
                className="h-11 w-full rounded-xl border px-3"
                placeholder="Pega la liga de tu casa"
                value={mapsLink}
                disabled={sending}
                onChange={(event) => {
                  const next = event.target.value;
                  setMapsLink(next);
                  const parsed = parseGoogleMapsLink(next);
                  setLat(parsed?.lat ?? null);
                  setLng(parsed?.lng ?? null);
                }}
                required
              />
              <p className="text-xs text-graphite">En Google Maps mantén pulsada tu casa, toca Compartir y copia el enlace.</p>
              {lat != null && lng != null && (
                <a className="block text-sm text-primary" href={googleMapsPlaceUrl({ lat, lng }) ?? "#"} target="_blank" rel="noopener noreferrer">Ver el punto en Google Maps</a>
              )}
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">¿Cómo pagas la comida?</legend>
                {([
                  ["collect_on_delivery", "Pago en mi domicilio", "Pagas comida y envío al repartidor al recibir."],
                  ["prepaid_at_restaurant", "Pago al restaurante", "Pagas la comida directo al restaurante; el restaurante paga el envío al repartidor."],
                ] as const).map(([value, label, hint]) => (
                  <label key={value} className={`flex cursor-pointer gap-3 rounded-xl border px-3 py-2 text-sm ${payMode === value ? "border-primary bg-primary/5" : "border-hairline"}`}>
                    <input type="radio" name="payMode" className="mt-1 accent-primary" checked={payMode === value} onChange={() => setPayMode(value)} />
                    <span><span className="block font-medium">{label}</span><span className="text-graphite">{hint}</span></span>
                  </label>
                ))}
              </fieldset>
              <Button type="submit" className="h-12 w-full" disabled={sending || foodTotal <= 0 || !mapsLink.trim()}>
                {sending ? "Validando y enviando…" : `Enviar pedido ${foodTotal > 0 ? formatMxn(foodTotal) : ""}`}
              </Button>
            </form>
          )}
          {orderUrl && !demo && (
            <Button asChild className="mt-4 h-12 w-full">
              <a href={orderUrl} target="_blank" rel="noopener noreferrer">Pedir por WhatsApp</a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
