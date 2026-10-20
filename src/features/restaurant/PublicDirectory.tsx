import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatMxn } from "@/lib/business";
import { parseMenu, publicMediaUrl, whatsappOrderUrl, type PublicRestaurant } from "@/lib/restaurant-media";

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
      else setPlaces(data.map((row) => ({ ...row, menu: parseMenu(row.menu) })));
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

function RestaurantProfile({ place }: { place: PublicRestaurant }) {
  const photo = publicMediaUrl(place.facade_url);
  const logo = publicMediaUrl(place.logo_url);
  const orderUrl = whatsappOrderUrl(place.phone, place.name);
  return (
    <div className="mx-auto max-w-lg">
      <Link to="/" search={(previous) => ({ ...previous, local: undefined })} className="text-sm text-graphite">Volver a restaurantes</Link>
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
            {place.menu.map((item) => (
              <li key={`${item.name}-${item.price}`} className="flex items-start justify-between gap-3 py-3">
                <div>
                  <div className="font-medium">{item.name}</div>
                  {item.description && <p className="text-sm text-graphite">{item.description}</p>}
                </div>
                <div className="font-semibold">{formatMxn(item.price)}</div>
              </li>
            ))}
          </ul>
          {orderUrl && (
            <Button asChild className="mt-4 h-12 w-full">
              <a href={orderUrl} target="_blank" rel="noopener noreferrer">Pedir por WhatsApp</a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
