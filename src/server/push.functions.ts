import { createServerFn } from "@tanstack/react-start";
import { getVapidPublic } from "./push.server";

export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: getVapidPublic() };
});
