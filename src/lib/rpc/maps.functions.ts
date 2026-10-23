import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isAllowedGoogleMapsUrl } from "@/lib/maps";

// Public read-only resolution is needed by customers without a 1Click account.
// No credentials, billable Maps APIs, private data or database writes are used.
export const resolveGoogleMapsLink = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ url: z.string().trim().max(4096).refine(isAllowedGoogleMapsUrl, "Liga de Google Maps no válida") }).parse(input))
  .handler(async ({ data }) => {
    try {
      const { resolveSharedMapsLink } = await import("@/lib/maps-resolver.server");
      const point = await resolveSharedMapsLink(data.url);
      return { ok: true as const, point };
    } catch (error) {
      return { ok: false as const, message: error instanceof Error && error.name !== "AbortError" ? error.message : "No se pudo consultar la ubicación. Intenta otra vez." };
    }
  });