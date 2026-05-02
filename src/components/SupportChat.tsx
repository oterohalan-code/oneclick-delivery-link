import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { MessageCircleQuestion, X, Send, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Msg { role: "user" | "assistant"; content: string }

const STORAGE_KEY = "support_conv_id";

export function SupportChat() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const id = localStorage.getItem(STORAGE_KEY);
      if (id) setConvId(id);
    } catch {}
  }, []);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      });
    }
  }, [messages, open]);

  // Show greeting when first opened with empty history
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: "¡Hola! Soy el asistente de 1Click. ¿En qué te ayudo hoy? Puedo explicarte cómo crear pedidos, validar documentos, manejar tu wallet, el plan PPS y más.",
      }]);
    }
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || streaming || !session?.access_token) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setStreaming(true);

    let acc = "";
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        },
        body: JSON.stringify({ message: text, conversationId: convId }),
      });

      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j.error ?? "Error del asistente");
      }

      const newConvId = resp.headers.get("X-Conversation-Id");
      if (newConvId && newConvId !== convId) {
        setConvId(newConvId);
        try { localStorage.setItem(STORAGE_KEY, newConvId); } catch {}
      }

      const reader = resp.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
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
            if (c) {
              acc += c;
              setMessages((m) => {
                const copy = m.slice();
                copy[copy.length - 1] = { role: "assistant", content: acc };
                return copy;
              });
            }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e: any) {
      setMessages((m) => {
        const copy = m.slice();
        copy[copy.length - 1] = { role: "assistant", content: `⚠️ ${e?.message ?? "Error"}` };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!session) return null;

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Soporte"
        className={cn(
          "fixed bottom-24 right-4 z-50 h-12 w-12 rounded-full grid place-items-center shadow-elegant transition press",
          "bg-foreground text-background hover:scale-105",
        )}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircleQuestion className="h-5 w-5" />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Chat de soporte"
          className="fixed bottom-40 right-4 z-50 w-[min(92vw,380px)] h-[min(70vh,520px)] glass-strong rounded-2xl shadow-elegant border border-hairline/60 flex flex-col overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-hairline/60 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary-glow grid place-items-center text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-none">Soporte 1Click</div>
              <div className="text-[10px] text-muted-foreground tracking-wider uppercase mt-1">Asistente IA · 24/7</div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words",
                    m.role === "user"
                      ? "bg-foreground text-background rounded-br-sm"
                      : "bg-muted/70 text-foreground rounded-bl-sm",
                  )}
                >
                  {m.content || (streaming && i === messages.length - 1 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null)}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-hairline/60 p-2.5 flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              rows={1}
              placeholder="Escribe tu pregunta…"
              className="flex-1 resize-none bg-muted/40 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 max-h-24"
              disabled={streaming}
            />
            <Button size="sm" onClick={send} disabled={streaming || !input.trim()} aria-label="Enviar">
              {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
