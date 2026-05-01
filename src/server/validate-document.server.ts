// Server-only helpers for AI document validation. Do NOT import from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type DocType = "ine_front" | "ine_back" | "license" | "circulation";

export interface ValidationResult {
  status: "valid" | "expired" | "name_mismatch" | "unreadable" | "error" | "needs_review";
  message?: string;
  extracted?: {
    full_name: string | null;
    expiration_date: string | null;
    document_type: string | null;
  };
}

const DOC_LABELS: Record<DocType, string> = {
  ine_front: "INE / Identificación Oficial (frente)",
  ine_back: "INE / Identificación Oficial (reverso)",
  license: "Licencia de conducir",
  circulation: "Tarjeta de circulación vehicular",
};

function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Jaro distance
function jaro(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  const len1 = s1.length, len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;
  const match = Math.max(0, Math.floor(Math.max(len1, len2) / 2) - 1);
  const m1: boolean[] = new Array(len1).fill(false);
  const m2: boolean[] = new Array(len2).fill(false);
  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - match), end = Math.min(i + match + 1, len2);
    for (let j = start; j < end; j++) {
      if (m2[j] || s1[i] !== s2[j]) continue;
      m1[i] = true; m2[j] = true; matches++; break;
    }
  }
  if (!matches) return 0;
  let t = 0, k = 0;
  for (let i = 0; i < len1; i++) {
    if (!m1[i]) continue;
    while (!m2[k]) k++;
    if (s1[i] !== s2[k]) t++;
    k++;
  }
  t /= 2;
  return (matches / len1 + matches / len2 + (matches - t) / matches) / 3;
}

function jaroWinkler(a: string, b: string): number {
  const j = jaro(a, b);
  let l = 0;
  while (l < 4 && a[l] && a[l] === b[l]) l++;
  return j + l * 0.1 * (1 - j);
}

// Returns true if any token-level or full-string similarity is >= threshold,
// or if all expected tokens appear (in any order) within the extracted name.
function namesMatch(expected: string, extracted: string): boolean {
  const e = normalizeName(expected);
  const x = normalizeName(extracted);
  if (!e || !x) return false;
  if (jaroWinkler(e, x) >= 0.85) return true;
  const eTokens = e.split(" ").filter((t) => t.length >= 3);
  const xTokens = new Set(x.split(" "));
  if (eTokens.length === 0) return false;
  const matched = eTokens.filter((t) =>
    [...xTokens].some((xt) => jaroWinkler(t, xt) >= 0.88),
  ).length;
  return matched / eTokens.length >= 0.75;
}

async function downloadAsDataUrl(path: string): Promise<string> {
  const { data, error } = await supabaseAdmin.storage.from("courier-docs").download(path);
  if (error || !data) throw new Error(error?.message ?? "No se pudo descargar la imagen");
  const buf = await data.arrayBuffer();
  // Base64 encode
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  const b64 = btoa(binary);
  const mime = data.type || "image/jpeg";
  return `data:${mime};base64,${b64}`;
}

export async function runDocumentValidation(args: {
  docPath: string;
  docType: DocType;
  expectedFullName: string;
}): Promise<ValidationResult> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { status: "error", message: "Servicio de IA no configurado" };

  let dataUrl: string;
  try {
    dataUrl = await downloadAsDataUrl(args.docPath);
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Error al leer la imagen" };
  }

  const docLabel = DOC_LABELS[args.docType];
  const systemPrompt = `Eres un sistema de validación de documentos de identidad mexicanos. Analiza la imagen proporcionada (${docLabel}) y extrae datos con precisión. Si la imagen está borrosa, oscura o ilegible, marca is_readable=false. Devuelve SIEMPRE el resultado vía la función extract_document_data.`;

  const tool = {
    type: "function",
    function: {
      name: "extract_document_data",
      description: "Devuelve datos extraídos del documento de identificación.",
      parameters: {
        type: "object",
        properties: {
          full_name: {
            type: ["string", "null"],
            description: "Nombre completo del titular tal como aparece en el documento.",
          },
          expiration_date: {
            type: ["string", "null"],
            description: "Fecha de vencimiento en formato YYYY-MM-DD. null si no aplica.",
          },
          document_type: {
            type: ["string", "null"],
            description: "Tipo detectado: INE, IFE, Pasaporte, Licencia, Tarjeta de Circulación, etc.",
          },
          is_readable: {
            type: "boolean",
            description: "true si la foto es legible, false si está borrosa/oscura/incompleta.",
          },
        },
        required: ["full_name", "expiration_date", "document_type", "is_readable"],
        additionalProperties: false,
      },
    },
  };

  let aiRes: Response;
  try {
    aiRes = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: `Analiza este ${docLabel} y extrae los datos.` },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "extract_document_data" } },
      }),
    });
  } catch (e) {
    return { status: "error", message: "No se pudo contactar el servicio de IA" };
  }

  if (aiRes.status === 429) {
    return { status: "error", message: "Demasiadas validaciones, espera unos segundos." };
  }
  if (aiRes.status === 402) {
    return { status: "error", message: "Sin créditos de IA disponibles." };
  }
  if (!aiRes.ok) {
    const t = await aiRes.text().catch(() => "");
    console.error("AI gateway error:", aiRes.status, t);
    return { status: "error", message: "Error al validar el documento." };
  }

  let payload: any;
  try {
    payload = await aiRes.json();
  } catch {
    return { status: "error", message: "Respuesta inválida del servicio de IA" };
  }

  const toolCall = payload?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) return { status: "error", message: "La IA no devolvió datos." };

  let extracted: { full_name: string | null; expiration_date: string | null; document_type: string | null; is_readable: boolean };
  try {
    extracted = JSON.parse(toolCall.function.arguments);
  } catch {
    return { status: "error", message: "Datos extraídos inválidos." };
  }

  if (!extracted.is_readable) {
    return { status: "unreadable", message: "Foto borrosa o ilegible. Vuelve a subir.", extracted: { full_name: extracted.full_name, expiration_date: extracted.expiration_date, document_type: extracted.document_type } };
  }

  // Vencimiento
  if (extracted.expiration_date) {
    const exp = new Date(extracted.expiration_date);
    if (!isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
      return {
        status: "expired",
        message: `Documento expirado (vencido ${extracted.expiration_date}).`,
        extracted: { full_name: extracted.full_name, expiration_date: extracted.expiration_date, document_type: extracted.document_type },
      };
    }
  }

  // Match de nombre solo para INE y Licencia (la tarjeta de circulación lleva el nombre del titular del vehículo, validamos también)
  if (args.docType === "ine_front" || args.docType === "license") {
    if (!extracted.full_name || !namesMatch(args.expectedFullName, extracted.full_name)) {
      return {
        status: "name_mismatch",
        message: "El nombre en el documento no coincide con tu perfil.",
        extracted: { full_name: extracted.full_name, expiration_date: extracted.expiration_date, document_type: extracted.document_type },
      };
    }
  }

  return {
    status: "valid",
    extracted: { full_name: extracted.full_name, expiration_date: extracted.expiration_date, document_type: extracted.document_type },
  };
}

export async function persistValidation(userId: string, docType: DocType, result: ValidationResult) {
  const { data: courier } = await supabaseAdmin
    .from("couriers")
    .select("id, ai_validation")
    .eq("user_id", userId)
    .maybeSingle();
  if (!courier) return;
  const prev = (courier.ai_validation as Record<string, unknown> | null) ?? {};
  const next = { ...prev, [docType]: { ...result, validated_at: new Date().toISOString() } };
  await supabaseAdmin.from("couriers").update({ ai_validation: next as never }).eq("id", courier.id);
}
