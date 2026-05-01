// Stub: notificaciones push deshabilitadas por ahora.
// Mantiene la firma para que orders.functions.ts pueda importarlo sin cambios.
export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushToUsers(_userIds: string[], _payload: PushPayload): Promise<void> {
  // no-op
}
