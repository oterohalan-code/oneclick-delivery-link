import { useEffect, useRef } from "react";
import L from "leaflet";

// Fix default Leaflet icon paths for bundlers (no-op if already fixed)
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetina from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconUrl,
  iconRetinaUrl: iconRetina,
  shadowUrl,
});

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

const _haversineUnused = null; // keep file structure stable

const CANCUN: [number, number] = [21.1619, -86.8515];

export function MapView({ pins = [], showRoute, center, zoom = 13, height = "320px", onMapClick, onRouteInfo }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onRouteInfoRef = useRef(onRouteInfo);
  onRouteInfoRef.current = onRouteInfo;

  // init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true }).setView(center ?? CANCUN, zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    if (onMapClick) {
      map.on("click", (e) => onMapClick(e.latlng.lat, e.latlng.lng));
    }

    // Recalc on container resize / visibility changes
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      ro = new ResizeObserver(() => {
        mapRef.current?.invalidateSize();
      });
      ro.observe(containerRef.current);
    }

    return () => {
      ro?.disconnect();
      try {
        map.off();
        layerRef.current?.clearLayers();
        map.remove();
      } catch {
        // ignore
      }
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stable key from pin coords so the effect doesn't loop on every parent render
  const pinsKey = pins
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)},${p.label ?? ""}`)
    .join("|");

  // update pins + route
  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;
    layerRef.current.clearLayers();
    const valid = pins.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    valid.forEach((p) => {
      const m = L.marker([p.lat, p.lng]).bindPopup(p.label ?? "");
      layerRef.current!.addLayer(m);
    });

    let cancelled = false;
    const controller = new AbortController();

    if (showRoute && valid.length >= 2) {
      const straight = L.polyline(valid.map((p) => [p.lat, p.lng]) as [number, number][], {
        color: "#94a3b8", weight: 3, opacity: 0.6, dashArray: "6 6",
      });
      layerRef.current.addLayer(straight);

      fetchRoute({ lat: valid[0].lat, lng: valid[0].lng }, { lat: valid[1].lat, lng: valid[1].lng }, controller.signal)
        .then((route) => {
          if (cancelled || !mapRef.current || !layerRef.current) return;
          if (!route) {
            onRouteInfoRef.current?.(null);
            return;
          }
          layerRef.current.removeLayer(straight);
          const line = L.polyline(route.coords, { color: "#22c55e", weight: 5, opacity: 0.9 });
          layerRef.current.addLayer(line);
          const bounds = L.latLngBounds(route.coords);
          mapRef.current.fitBounds(bounds, { padding: [40, 40] });
          onRouteInfoRef.current?.({ distanceKm: route.distanceKm, durationMin: route.durationMin });
        })
        .catch(() => {
          if (!cancelled) onRouteInfoRef.current?.(null);
        });
    } else if (showRoute) {
      onRouteInfoRef.current?.(null);
    }

    if (valid.length === 1) {
      mapRef.current.setView([valid[0].lat, valid[0].lng], Math.max(zoom, 14));
    } else if (valid.length >= 2) {
      const bounds = L.latLngBounds(valid.map((p) => [p.lat, p.lng] as [number, number]));
      mapRef.current.fitBounds(bounds, { padding: [40, 40] });
    }

    // Force size recalc when the map lives inside a Dialog
    setTimeout(() => mapRef.current?.invalidateSize(), 0);

    return () => {
      cancelled = true;
      controller.abort();
    };
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
export async function searchAddress(q: string): Promise<Array<{ display_name: string; lat: number; lng: number }>> {
  if (q.trim().length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=mx&q=${encodeURIComponent(q + " Cancun")}`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) return [];
  const data = (await r.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  return data.map((d) => ({ display_name: d.display_name, lat: parseFloat(d.lat), lng: parseFloat(d.lon) }));
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

