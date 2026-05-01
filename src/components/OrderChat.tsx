import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, Send, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

interface Message {
  id: string;
  order_id: string;
  sender_id: string;
  sender_role: "restaurant" | "courier";
  content: string;
  created_at: string;
}

export function OrderChat({
  open,
  onOpenChange,
  orderId,
  myRole,
  peerName,
  peerPhone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderId: string;
  myRole: "restaurant" | "courier";
  peerName: string;
  peerPhone?: string | null;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial load + realtime subscription
  useEffect(() => {
    if (!open || !orderId) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from("order_messages")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (!cancelled) {
        if (error) toast.error("No se pudo cargar el chat");
        setMessages((data as Message[]) ?? []);
        setLoading(false);
      }
    })();

    const channel = supabase
      .channel(`order-chat-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_messages",
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === (payload.new as Message).id)
              ? prev
              : [...prev, payload.new as Message],
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [open, orderId]);

  // Autoscroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const send = async () => {
    const content = text.trim();
    if (!content || !user) return;
    if (content.length > 1000) return toast.error("Mensaje muy largo");
    setSending(true);
    const { error } = await supabase.from("order_messages").insert({
      order_id: orderId,
      sender_id: user.id,
      sender_role: myRole,
      content,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setText("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 p-4 border-b bg-card">
          <div className="min-w-0">
            <div className="font-display font-bold truncate">{peerName}</div>
            {peerPhone && (
              <a
                href={`tel:${peerPhone}`}
                className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
              >
                <Phone className="h-3 w-3" /> {peerPhone}
              </a>
            )}
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/30">
          {loading ? (
            <div className="grid place-items-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground mt-6">
              Aún no hay mensajes. ¡Saluda!
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <div
                  key={m.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      mine
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card border rounded-bl-sm"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p
                      className={`text-[10px] mt-1 ${
                        mine ? "text-primary-foreground/70" : "text-muted-foreground"
                      }`}
                    >
                      {new Date(m.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex gap-2 p-3 border-t bg-card"
        >
          <Input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 1000))}
            placeholder="Escribe un mensaje…"
            autoFocus
          />
          <Button type="submit" size="icon" disabled={sending || !text.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
