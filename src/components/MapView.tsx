import { useEffect, useRef } from "react";
import type L from "leaflet";

// Leaflet is browser-only — load lazily on the client to avoid SSR `window is not defined`.
let leafletPromise: Promise<typeof import("leaflet")> | null = null;
async function loadLeaflet() {
  if (typeof window === "undefined") throw new Error("Leaflet requires a browser");
  if (!leafletPromise) {
    leafletPromise = (async () => {
      const mod = await import("leaflet");
      // CSS is loaded globally via src/styles.css
      const [iconUrl, iconRetina, shadowUrl] = await Promise.all([
        import("leaflet/dist/images/marker-icon.png").then((m) => m.default),
        import("leaflet/dist/images/marker-icon-2x.png").then((m) => m.default),
        import("leaflet/dist/images/marker-shadow.png").then((m) => m.default),
      ]);
      // Leaflet guesses icon paths from CSS; with bundled assets that breaks the pins.
      delete (mod.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
      mod.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl: iconRetina, shadowUrl });
      return mod;
    })();
  }
  return leafletPromise;
}

interface Pin {
  lat: number;
  lng: number;
  label?: string;
  color?: "primary" | "secondary";
}

interface Props {
  pins?: Pin[];
  showRoute?: boolean;
  center?: [number, number];
  zoom?: number;
  height?: string;
  onMapClick?: (lat: number, lng: number) => void;
  onRouteInfo?: (info: { distanceKm: number; durationMin: number } | null) => void;
}

const MANZANILLO: [number, number] = [19.1076, -104.3385];

export function MapView({ pins = [], showRoute, center, zoom = 13, height = "320px", onMapClick, onRouteInfo }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const onRouteInfoRef = useRef(onRouteInfo);
  onRouteInfoRef.current = onRouteInfo;
  const pinsRef = useRef(pins);
  pinsRef.current = pins;
  const showRouteRef = useRef(showRoute);
  showRouteRef.current = showRoute;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const routeAbortRef = useRef<AbortController | null>(null);

  function renderPins() {
    const L = LRef.current;
    if (!L || !mapRef.current || !layerRef.current) return;
    routeAbortRef.current?.abort();
    layerRef.current.clearLayers();
    const valid = pinsRef.current.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    valid.forEach((p) => {
      const m = L.marker([p.lat, p.lng]).bindPopup(p.label ?? "");
      layerRef.current?.addLayer(m);
    });

    const controller = new AbortController();
    routeAbortRef.current = controller;

    if (showRouteRef.current && valid.length >= 2) {
      const straight = L.polyline(valid.map((p) => [p.lat, p.lng]) as [number, number][], {
        color: "#94a3b8", weight: 3, opacity: 0.6, dashArray: "6 6",
      });
      layerRef.current.addLayer(straight);

      fetchRoute({ lat: valid[0].lat, lng: valid[0].lng }, { lat: valid[1].lat, lng: valid[1].lng }, controller.signal)
        .then((route) => {
          if (controller.signal.aborted || !mapRef.current || !layerRef.current || !LRef.current) return;
          if (!route) { onRouteInfoRef.current?.(null); return; }
          layerRef.current.removeLayer(straight);
          const line = LRef.current.polyline(route.coords, { color: "#22c55e", weight: 5, opacity: 0.9 });
          layerRef.current.addLayer(line);
          const bounds = LRef.current.latLngBounds(route.coords);
          mapRef.current.fitBounds(bounds, { padding: [40, 40] });
          onRouteInfoRef.current?.({ distanceKm: route.distanceKm, durationMin: route.durationMin });
        })
        .catch(() => { if (!controller.signal.aborted) onRouteInfoRef.current?.(null); });
    } else if (showRouteRef.current) {
      onRouteInfoRef.current?.(null);
    }

    if (valid.length === 1) {
      mapRef.current.setView([valid[0].lat, valid[0].lng], Math.max(zoomRef.current, 14));
    } else if (valid.length >= 2) {
      const bounds = L.latLngBounds(valid.map((p) => [p.lat, p.lng] as [number, number]));
      mapRef.current.fitBounds(bounds, { padding: [40, 40] });
    }

    setTimeout(() => mapRef.current?.invalidateSize(), 0);
    return () => controller.abort();
  }

  // init (client-only)
  useEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | null = null;

    loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(containerRef.current, { zoomControl: true }).setView(center ?? MANZANILLO, zoom);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);

      if (onMapClick) {
        map.on("click", (e) => onMapClick(e.latlng.lat, e.latlng.lng));
      }

      if (typeof ResizeObserver !== "undefined" && containerRef.current) {
        ro = new ResizeObserver(() => mapRef.current?.invalidateSize());
        ro.observe(containerRef.current);
      }

      renderPins();
    }).catch(() => {});

    return () => {
      cancelled = true;
      routeAbortRef.current?.abort();
      ro?.disconnect();
      try {
        mapRef.current?.off();
        layerRef.current?.clearLayers();
        mapRef.current?.remove();
      } catch {
        // ignore
      }
      mapRef.current = null;
      layerRef.current = null;
      LRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stable key from pin coords so the effect doesn't loop on every parent render
  const pinsKey = pins
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)},${p.label ?? ""}`)
    .join("|");

  // update pins + route on changes
  useEffect(() => {
    return renderPins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinsKey, showRoute, zoom]);

  return <div ref={containerRef} style={{ height, width: "100%" }} className="rounded-xl overflow-hidden border border-border" />;
}

// Distance in km between two coords
export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Nominatim address search
const MANZANILLO_POINT = { lat: MANZANILLO[0], lng: MANZANILLO[1] };

export function isInManzanillo(lat: number, lng: number): boolean {
  return haversine(MANZANILLO_POINT, { lat, lng }) <= 40;
}

export async function searchAddress(q: string): Promise<Array<{ display_name: string; lat: number; lng: number }>> {
  if (q.trim().length < 3) return [];
  const viewbox = "-104.55,19.30,-104.10,18.90";
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=mx&bounded=1&viewbox=${viewbox}&q=${encodeURIComponent(q + " Manzanillo, Colima, México")}`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) return [];
  const data = (await r.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  return data
    .map((d) => ({ display_name: d.display_name, lat: parseFloat(d.lat), lng: parseFloat(d.lon) }))
    .filter((d) => isInManzanillo(d.lat, d.lng));
}

// Reverse geocoding: coordinates -> human-readable address
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const data = (await r.json()) as { display_name?: string };
    return data.display_name ?? null;
  } catch {
    return null;
  }
}

// Driving route via OSRM public server
export async function fetchRoute(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<{ coords: [number, number][]; distanceKm: number; durationMin: number } | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
  try {
    const r = await fetch(url, { signal });
    if (!r.ok) return null;
    const data = (await r.json()) as {
      routes?: Array<{
        distance: number;
        duration: number;
        geometry: { coordinates: [number, number][] };
      }>;
    };
    const route = data.routes?.[0];
    if (!route) return null;
    const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
    return {
      coords,
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
    };
  } catch {
    return null;
  }
}

