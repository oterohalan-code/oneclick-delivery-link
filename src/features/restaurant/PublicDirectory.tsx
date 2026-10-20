import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatMxn } from "@/lib/business";
import { packDropoff, parseMenu, publicMediaUrl, whatsappOrderUrl, type PublicRestaurant } from "@/lib/restaurant-media";
import { AddressSearch } from "@/components/AddressSearch";
import { isInManzanillo, MapView, reverseGeocode } from "@/components/MapView";

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
      <h1 className="text-3xl font-semibold text-ink md:text-5xl">Encuentra tu restaurante en Manzanillo</h1>
      <p className="mt-2 text-graphite">Antojos locales, en un solo lugar.</p>
      <div className="mt-6 flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre o tipo de comida"
          className="h-12 flex-1 rounded-xl border border-hairline bg-white px-4"
        />
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${item === category ? "bg-primary text-white" : "bg-white text-ink"}`}
          >
            {item}
          </button>
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
                  className="block overflow-hidden rounded-2xl border border-hairline bg-white"
                >
                  <div className="h-40 bg-bone">
                    {photo && <img src={photo} alt="" className="h-full w-full object-cover" />}
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
  const [qty, setQty] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
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
      <div className="mt-3 overflow-hidden rounded-2xl border border-hairline bg-white">
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
            <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
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
                if (lat == null || lng == null) return toast.error("Pon tu ubicación en el mapa");
                if (!isInManzanillo(lat, lng)) return toast.error("La entrega es solo en Manzanillo");
                if (demo) {
                  setSent(true);
                  return;
                }
                setSending(true);
                const { data, error } = await supabase.rpc("place_menu_request", {
                  _restaurant_id: place.id,
                  _customer_name: name,
                  _customer_phone: phone,
                  _dropoff_address: packDropoff(address, lat, lng),
                  _items: chosen,
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
              }}
            >
              <input className="h-11 w-full rounded-xl border px-3" placeholder="Tu nombre" value={name} onChange={(event) => setName(event.target.value)} required />
              <input className="h-11 w-full rounded-xl border px-3" placeholder="WhatsApp, 10 dígitos" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} required />
              <AddressSearch
                value={address}
                onChange={(next, nextLat, nextLng) => {
                  setAddress(next);
                  if (nextLat != null) setLat(nextLat);
                  if (nextLng != null) setLng(nextLng);
                }}
                placeholder="Calle y colonia en Manzanillo"
              />
              <MapView
                height="220px"
                pins={lat != null && lng != null ? [{ lat, lng, label: "Tu entrega" }] : []}
                onMapClick={async (nextLat, nextLng) => {
                  if (!isInManzanillo(nextLat, nextLng)) return toast.error("Ese punto está fuera de Manzanillo");
                  setLat(nextLat);
                  setLng(nextLng);
                  const found = await reverseGeocode(nextLat, nextLng);
                  if (found) setAddress(found);
                }}
              />
              <p className="text-xs text-graphite">Toca el mapa para marcar tu casa. El mapa abre en Manzanillo.</p>
              <Button type="submit" className="h-12 w-full" disabled={sending || foodTotal <= 0 || lat == null}>
                Enviar pedido {foodTotal > 0 ? formatMxn(foodTotal) : ""}
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
