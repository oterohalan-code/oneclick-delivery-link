import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/restaurantes")({
  head: () => ({
    meta: [
      { title: "Restaurantes — 1Click" },
      { name: "description", content: "Directorio de restaurantes con menú público en Manzanillo." },
      { property: "og:title", content: "Restaurantes — 1Click" },
      { property: "og:description", content: "Directorio de restaurantes con menú público en Manzanillo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DirectoryPage,
});

type Place = {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
};

function DirectoryPage() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [query, setQuery] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .rpc("list_public_restaurants")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setPlaces([]);
        } else {
          setPlaces((data as Place[] | null) ?? []);
        }
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const shown = places.filter((place) => {
    const haystack = `${place.name} ${place.category ?? ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <div className="min-h-screen bg-bone text-ink">
      <header className="bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Logo size="sm" tone="bone" />
          <Link to="/auth" className="text-sm text-navy-foreground/80">Iniciar sesión</Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-3xl font-semibold">Encuentra tu restaurante en Manzanillo</h1>
        <p className="mt-2 text-graphite">El pedido y el pago siguen en WhatsApp con el local.</p>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre o tipo de comida"
          className="mt-6 h-12 w-full rounded-xl border border-hairline bg-card px-4"
        />
        {!ready ? (
          <p className="mt-8 text-sm text-graphite">Cargando locales…</p>
        ) : shown.length === 0 ? (
          <p className="mt-8 text-sm text-graphite">
            Todavía no hay un directorio público. Los locales operan desde su cuenta de restaurante.
          </p>
        ) : (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {shown.map((place) => (
              <li key={place.id} className="rounded-2xl border border-hairline bg-card p-4">
                <h2 className="text-lg font-semibold">{place.name}</h2>
                <p className="text-sm text-graphite">{place.category || "Restaurante"} · Manzanillo</p>
                {place.address && <p className="mt-2 text-sm">{place.address}</p>}
                {place.phone && (
                  <Button asChild className="mt-4">
                    <a href={`https://wa.me/52${place.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                      Pedir por WhatsApp
                    </a>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
