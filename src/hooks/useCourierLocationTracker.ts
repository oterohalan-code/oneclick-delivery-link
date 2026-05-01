import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const THREE_MIN = 3 * 60 * 1000;

export type GeoPermission = "unknown" | "granted" | "denied" | "prompt" | "unsupported";

/**
 * Tracks the courier's geolocation and persists lat/lng on the couriers table
 * at most every 3 minutes. Returns the current permission state so the UI can
 * show a banner if it's denied.
 */
export function useCourierLocationTracker(opts: {
  enabled: boolean;
  courierId: string | null | undefined;
}) {
  const [permission, setPermission] = useState<GeoPermission>("unknown");

  // Re-checks the permission status. Useful after the user re-enables
  // location from the browser/system settings without a page reload.
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
    let watchId: number | null = null;
    let cancelled = false;

    const persist = async (lat: number, lng: number) => {
      if (cancelled) return;
      const now = Date.now();
      if (now - lastWriteAt < THREE_MIN) return;
      lastWriteAt = now;
      await supabase.from("couriers").update({ lat, lng }).eq("id", opts.courierId!);
    };

    const start = () => {
      // Initial single fix (fires fast even without movement).
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPermission("granted");
          persist(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) setPermission("denied");
        },
        { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 },
      );

      // Continuous watch — but we throttle writes to BD to once every 3 min.
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setPermission("granted");
          persist(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) setPermission("denied");
        },
        { enableHighAccuracy: false, maximumAge: 60_000, timeout: 30_000 },
      );
    };

    // Check existing permission state to avoid re-prompting.
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
