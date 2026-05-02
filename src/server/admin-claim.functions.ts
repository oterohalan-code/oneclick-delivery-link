import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { claimAdminRoleForToken } from "./admin-claim.server";

export const claimAdminRole = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string }) =>
    z.object({ accessToken: z.string().min(10) }).parse(data),
  )
  .handler(async ({ data }) => claimAdminRoleForToken(data.accessToken));