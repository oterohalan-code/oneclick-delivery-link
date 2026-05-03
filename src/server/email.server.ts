import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface SendArgs {
  templateName: string;
  recipientEmail: string;
  idempotencyKey?: string;
  templateData?: Record<string, any>;
}

/**
 * Enqueue a transactional email by writing directly to the auth/transactional
 * pgmq queue via the enqueue_email RPC. Used from server functions where we
 * already trust the caller (no JWT to forward).
 */
export async function enqueueTransactionalEmail(args: SendArgs) {
  const messageId = args.idempotencyKey ?? crypto.randomUUID();
  const payload = {
    template_name: args.templateName,
    to: args.recipientEmail,
    message_id: messageId,
    label: args.templateName,
    template_data: args.templateData ?? {},
    enqueued_at: new Date().toISOString(),
  };
  try {
    // Pre-log as pending so dashboard counts it
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: args.templateName,
      recipient_email: args.recipientEmail,
      status: "pending",
    });
    const { error } = await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload,
    });
    if (error) {
      console.warn("[email] enqueue failed", error);
    }
  } catch (e) {
    console.warn("[email] enqueue exception", e);
  }
}
