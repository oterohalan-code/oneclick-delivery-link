// Push notifications: registra service worker y suscripción en el navegador.
import { supabase } from "@/integrations/supabase/client";
import { getVapidPublicKey } from "@/server/push.functions";

function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function enablePush(userId: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  try {
    // Pedir permiso solo si no se ha decidido todavía.
    if (Notification.permission === "denied") return false;
    if (Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return false;
    }

    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { key } = await getVapidPublicKey();
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(key),
      });
    }

    const json = sub.toJSON();
    const endpoint = json.endpoint!;
    const p256dh = json.keys?.p256dh ?? "";
    const auth = json.keys?.auth ?? "";
    if (!p256dh || !auth) return false;

    // upsert por endpoint
    const { data: existing } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", userId)
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
  }
}
