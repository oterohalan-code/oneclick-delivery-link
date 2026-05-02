// Edge function: streaming chat de soporte con Lovable AI
// Persiste conversación y mensajes por usuario en la base de datos.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Eres el asistente de soporte de "1Click", una plataforma de logística para restaurantes y repartidores en México.

Reglas:
- Responde en español, claro y breve (máx 4 oraciones por respuesta).
- Tu rol: ayudar con dudas operativas (cómo crear un pedido, validar documentos, cobrar, retirar saldo de la wallet, programa de referidos, métricas, plan PPS vs suscripción de courier).
- El plan PPS cobra una comisión por pedido; la suscripción mensual deja al courier sin comisión.
- Programa de referidos: $50 MXN para ambos cuando el referido (courier) entrega su primer pedido.
- Si el usuario reporta un problema técnico (pago fallido, app rota, courier no responde), pide datos clave (ID de pedido, captura) y dile que un agente humano revisará en menos de 24h vía email.
- Nunca inventes funciones que no existen. Si no sabes, di que un agente humano lo revisará.
- No pidas información sensible (contraseñas, tarjetas completas).`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: userData } = await svc.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    const user = userData?.user;
    if (!user) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { message, conversationId } = await req.json();
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "message requerido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get or create conversation
    let convId: string | null = conversationId ?? null;
    if (convId) {
      const { data: ck } = await svc.from("support_conversations").select("id").eq("id", convId).eq("user_id", user.id).maybeSingle();
      if (!ck) convId = null;
    }
    if (!convId) {
      const { data: created, error } = await svc
        .from("support_conversations")
        .insert({ user_id: user.id })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      convId = created.id;
    }

    // Persist user message
    await svc.from("support_messages").insert({ conversation_id: convId, role: "user", content: message });

    // Load history (last 20)
    const { data: history } = await svc
      .from("support_messages")
      .select("role, content")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(20);

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(history ?? []).map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        stream: true,
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Demasiadas peticiones, intenta en un momento." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "El soporte no está disponible ahora. Un agente te responderá pronto." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Error del asistente" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Tee the response so we can persist the assistant reply while streaming
    const [a, b] = aiResp.body!.tee();

    // Async: parse 'b' to accumulate assistant text and store in DB
    (async () => {
      try {
        const reader = b.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let full = "";
        let done = false;
        while (!done) {
          const { value, done: d } = await reader.read();
          if (d) break;
          buf += dec.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const j = line.slice(6).trim();
            if (j === "[DONE]") { done = true; break; }
            try {
              const p = JSON.parse(j);
              const c = p.choices?.[0]?.delta?.content;
              if (c) full += c;
            } catch {}
          }
        }
        if (full.trim()) {
          await svc.from("support_messages").insert({ conversation_id: convId, role: "assistant", content: full });
        }
      } catch (e) {
        console.error("persist assistant failed", e);
      }
    })();

    // Inject conversation id as a header for the client to capture
    return new Response(a, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "X-Conversation-Id": convId!,
      },
    });
  } catch (e: any) {
    console.error("support-chat error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
