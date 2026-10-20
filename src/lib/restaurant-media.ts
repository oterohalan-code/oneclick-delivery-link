export type MenuItem = {
  name: string;
  price: number;
  description: string;
  image: string;
};

export type PublicRestaurant = {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  hours: string | null;
  logo_url: string | null;
  facade_url: string | null;
  menu: MenuItem[];
};

export function publicMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!base) return null;
  return `${base}/storage/v1/object/public/restaurant-media/${path}`;
}

export function parseMenu(value: unknown): MenuItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { name?: unknown; price?: unknown; description?: unknown; image?: unknown };
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const price = Number(row.price);
    if (!name || !Number.isFinite(price)) return [];
    return [{
      name,
      price,
      description: typeof row.description === "string" ? row.description : "",
      image: typeof row.image === "string" ? row.image : "",
    }];
  });
}

export function whatsappOrderUrl(phone: string | null | undefined, name: string): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const withCountry = digits.length === 10 ? `52${digits}` : digits;
  const text = `Hola, quiero pedir en ${name}.`;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`;
}
