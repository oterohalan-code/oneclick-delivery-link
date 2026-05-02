import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Frecuencia de escritura a BD: 15s mientras hay movimiento real, mínimo 60s siempre
const MIN_WRITE_MS = 15_000;
const MIN_DISTANCE_M = 30; // solo persistir si se movió >30m
const KEEPALIVE_MS = 60_000; // o si pasó 1 min aunque no se haya movido

export type GeoPermission = "unknown" | "granted" | "denied" | "prompt" | "unsupported";

function distMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/**
 * Tracks the courier's geolocation in real time.
 * - Throttled writes to DB: only when moved >30m AND >=15s since last write,
 *   or every 60s as keepalive.
 * - Updates couriers.location_updated_at so consumers know if the GPS is fresh.
 */
export function useCourierLocationTracker(opts: {
  enabled: boolean;
  courierId: string | null | undefined;
}) {
  const [permission, setPermission] = useState<GeoPermission>("unknown");

  const refreshPermission = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPermission("unsupported");
      return;
    }
    if ("permissions" in navigator) {
      try {
        const p = await navigator.permissions.query({ name: "geolocation" as PermissionName });
        setPermission(p.state as GeoPermission);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (!opts.enabled || !opts.courierId) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPermission("unsupported");
      return;
    }

    let lastWriteAt = 0;
    let lastPos: { lat: number; lng: number } | null = null;
    let watchId: number | null = null;
    let cancelled = false;

    const persist = async (lat: number, lng: number) => {
      if (cancelled) return;
      const now = Date.now();
      const moved = lastPos ? distMeters(lastPos, { lat, lng }) : Infinity;
      const tooSoon = now - lastWriteAt < MIN_WRITE_MS;
      const isKeepalive = now - lastWriteAt >= KEEPALIVE_MS;
      if (tooSoon) return;
      if (!isKeepalive && moved < MIN_DISTANCE_M && lastPos) return;

      lastWriteAt = now;
      lastPos = { lat, lng };
      await supabase
        .from("couriers")
        .update({ lat, lng, location_updated_at: new Date().toISOString() })
        .eq("id", opts.courierId!);
    };

    const start = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPermission("granted");
          persist(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) setPermission("denied");
        },
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
      );

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setPermission("granted");
          persist(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) setPermission("denied");
        },
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 30_000 },
      );
    };

    if ("permissions" in navigator) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((p) => {
          setPermission(p.state as any);
          if (p.state !== "denied") start();
          p.onchange = () => setPermission(p.state as any);
        })
        .catch(() => start());
    } else {
      start();
    }

    return () => {
      cancelled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [opts.enabled, opts.courierId]);

  return { permission, refreshPermission };
}
