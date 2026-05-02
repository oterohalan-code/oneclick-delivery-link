import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const QUEUE_KEY = "1click_courier_offline_queue_v1";

type QueuedAction =
  | {
      kind: "location";
      courierId: string;
      lat: number;
      lng: number;
      ts: number;
    }
  | {
      kind: "order_status";
      orderId: string;
      status: "in_transit" | "delivered";
      extra?: Record<string, unknown>;
      ts: number;
    };

function readQueue(): QueuedAction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedAction[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedAction[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    /* ignore quota */
  }
}

async function flushAction(a: QueuedAction): Promise<boolean> {
  try {
    if (a.kind === "location") {
      const { error } = await supabase
        .from("couriers")
        .update({
          lat: a.lat,
          lng: a.lng,
          location_updated_at: new Date(a.ts).toISOString(),
        })
        .eq("id", a.courierId);
      return !error;
    }
    if (a.kind === "order_status") {
      const patch: {
        status: "in_transit" | "delivered";
        picked_up_at?: string;
        delivered_at?: string;
      } = { status: a.status };
      if (a.status === "in_transit") patch.picked_up_at = new Date(a.ts).toISOString();
      if (a.status === "delivered") patch.delivered_at = new Date(a.ts).toISOString();
      const { error } = await supabase
        .from("orders")
        .update(patch)
        .eq("id", a.orderId);
      return !error;
    }
    return true;
  } catch {
    return false;
  }
}

export function useOfflineQueue() {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [pending, setPending] = useState<number>(0);
  const flushing = useRef(false);

  const refreshCount = useCallback(() => {
    setPending(readQueue().length);
  }, []);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    flushing.current = true;
    try {
      let queue = readQueue();
      const remaining: QueuedAction[] = [];
      for (const action of queue) {
        const ok = await flushAction(action);
        if (!ok) remaining.push(action);
      }
      writeQueue(remaining);
      setPending(remaining.length);
    } finally {
      flushing.current = false;
    }
  }, []);

  const enqueue = useCallback(
    (action: QueuedAction) => {
      const queue = readQueue();
      // Para ubicación, conserva solo el más reciente por courier
      let next = queue;
      if (action.kind === "location") {
        next = queue.filter(
          (a) => !(a.kind === "location" && a.courierId === action.courierId),
        );
      }
      next.push(action);
      writeQueue(next);
      setPending(next.length);
      if (typeof navigator !== "undefined" && navigator.onLine) {
        void flush();
      }
    },
    [flush],
  );

  /**
   * Intenta ejecutar una acción de inmediato. Si falla o no hay red,
   * la encola para reintentar al volver online.
   */
  const sendOrQueue = useCallback(
    async (action: QueuedAction) => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        const ok = await flushAction(action);
        if (ok) return true;
      }
      enqueue(action);
      return false;
    },
    [enqueue],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    refreshCount();
    const onOnline = () => {
      setOnline(true);
      void flush();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    // intento inicial al montar
    if (navigator.onLine) void flush();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [flush, refreshCount]);

  return { online, pending, enqueue, sendOrQueue, flush };
}
