import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runDocumentValidation, persistValidation, type DocType } from "./validate-document.server";

const InputSchema = z.object({
  docPath: z.string().min(1).max(500),
  docType: z.enum(["ine_front", "ine_back", "license", "circulation"]),
  expectedFullName: z.string().trim().min(2).max(200),
});

export const validateDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Ensure the user owns the path (prefix with their userId)
    if (!data.docPath.startsWith(`${userId}/`)) {
      return { status: "error" as const, message: "Ruta no autorizada" };
    }
    const result = await runDocumentValidation({
      docPath: data.docPath,
      docType: data.docType as DocType,
      expectedFullName: data.expectedFullName,
    });
    await persistValidation(userId, data.docType as DocType, result);
    return result;
  });
