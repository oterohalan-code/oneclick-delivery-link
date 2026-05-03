// Push notifications usando Web Push (VAPID).
// Las claves viven en secretos (process.env), nunca en el bundle del cliente.

import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

let initialized = false;
let cachedPublic = "";
function initPush() {
  if (initialized) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT || "mailto:notificaciones@1click.app";
  if (!pub || !priv) {
    throw new Error("VAPID keys not configured (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)");
  }
  webpush.setVapidDetails(subj, pub, priv);
  cachedPublic = pub;
  initialized = true;
}

export function getVapidPublic(): string {
  initPush();
  return cachedPublic;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (!userIds.length) return;
  initPush();

  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (error || !subs?.length) return;

  const json = JSON.stringify(payload);
  const expired: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json,
        );
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          expired.push(s.id);
        } else {
          console.warn("[push] send failed", e?.statusCode, e?.body);
        }
      }
    }),
  );

  if (expired.length) {
    await supabaseAdmin.from("push_subscriptions").delete().in("id", expired);
  }
}
