import { createServerFn } from "@tanstack/react-start";
import { getVapidPublic } from "@/server/push.server";

export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: getVapidPublic() };
});
