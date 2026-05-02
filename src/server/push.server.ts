// Push notifications usando Web Push (VAPID).
// La clave pública se expone al cliente para suscribirse.
// La privada SOLO vive en este módulo *.server.ts (nunca llega al bundle del cliente).

import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// VAPID keys: la pública es segura de exponer; la privada es server-only.
// Generadas con web-push.generateVAPIDKeys() — únicas para este proyecto.
export const VAPID_PUBLIC_KEY =
  "BMmC-O65b_97ZcUns-frWIP7R0D-CDBh0xyiIZ6I6zpixX8XL6mf0FzcYqK914x2dRTAWes0RQj20ec5epflOaY";
const VAPID_PRIVATE_KEY = "XDfDQTvSPLY3pYP4w56mD_dweOEnXZE9uGbEH_ymP8M";
const VAPID_SUBJECT = "mailto:notificaciones@1click.app";

let initialized = false;
function initPush() {
  if (initialized) return;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  initialized = true;
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
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          json,
        );
      } catch (e: any) {
        // 404/410 → suscripción expirada/eliminada; la marcamos para limpieza.
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
