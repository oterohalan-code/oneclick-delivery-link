// Server-only Web Push helper. Do NOT import from client code.
import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:noreply@oneclick-delivery.app";
  if (!pub || !priv) {
    console.warn("[push] VAPID keys missing — skipping push send");
    return false;
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (!userIds.length) return;
  if (!ensureConfigured()) return;

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (!subs?.length) return;

  const json = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json,
        );
      } catch (err) {
        const status = (err as { statusCode?: number } | null)?.statusCode;
        if (status === 404 || status === 410) {
          // Suscripción muerta → borrar
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          console.warn("[push] send failed", status, err);
        }
      }
    }),
  );
}
