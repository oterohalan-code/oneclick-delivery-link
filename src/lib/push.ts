import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

function isPreviewIframe() {
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  return h.includes("id-preview--") || h.includes("lovableproject.com");
}

let inflight: Promise<boolean> | null = null;

export async function enablePush(userId: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if (Notification.permission === "denied") return false;
  if (!VAPID_PUBLIC) return false;
  if (isPreviewIframe()) return false; // service workers no funcionan dentro del iframe del editor

  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      if (Notification.permission === "default") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return false;
      }
      if (Notification.permission !== "granted") return false;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const key = urlBase64ToUint8Array(VAPID_PUBLIC);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
        });
      }

      const json = sub.toJSON();
      const endpoint = json.endpoint!;
      const p256dh = json.keys?.p256dh ?? "";
      const auth = json.keys?.auth ?? "";

      // Upsert por endpoint
      const { data: existing } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("endpoint", endpoint)
        .maybeSingle();

      if (!existing) {
        await supabase.from("push_subscriptions").insert({
          user_id: userId,
          endpoint,
          p256dh,
          auth,
        });
      }
      return true;
    } catch (e) {
      console.warn("[push] enable failed", e);
      return false;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
