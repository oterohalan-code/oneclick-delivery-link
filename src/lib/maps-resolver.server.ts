import { isAllowedGoogleMapsUrl, parseGoogleMapsLink } from "./maps";

/** Resolve only Google-owned shared URLs, with bounded redirects and no API calls. */
export async function resolveSharedMapsLink(raw: string) {
  let current = raw.trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    for (let hop = 0; hop < 5; hop++) {
      if (!isAllowedGoogleMapsUrl(current)) throw new Error("La liga debe ser de Google Maps.");
      const parsed = parseGoogleMapsLink(current);
      if (parsed?.lat != null && parsed.lng != null) return { ...parsed, url: raw.trim() };
      // Full place links without a pin cannot be resolved by redirect alone.
      const host = new URL(current).hostname;
      if (host !== "maps.app.goo.gl" && host !== "goo.gl") break;
      const response = await fetch(current, { redirect: "manual", signal: controller.signal });
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (response.status < 300 || response.status >= 400 || !location) break;
      current = new URL(location, current).href;
    }
    throw new Error("No se encontró el punto de esa liga. Comparte el pin exacto de Google Maps o usa una liga con coordenadas.");
  } finally { clearTimeout(timeout); }
}