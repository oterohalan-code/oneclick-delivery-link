import { createServerFn } from "@tanstack/react-start";
import { VAPID_PUBLIC_KEY } from "./push.server";

export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: VAPID_PUBLIC_KEY };
});
