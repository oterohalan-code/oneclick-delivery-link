import { Badge } from "@/components/ui/badge";
import { ShieldCheck, FlaskConical } from "lucide-react";

const clientToken = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

/**
 * Indicador visual del modo de pagos activo.
 * - pk_test_* → "Modo prueba" (naranja)
 * - pk_live_* → "Pagos reales" (verde)
 *
 * No renderiza nada si no hay token configurado.
 */
export function PaymentModeBadge() {
  if (!clientToken) return null;

  const isTest = clientToken.startsWith("pk_test_");

  if (isTest) {
    return (
      <Badge
        variant="outline"
        className="alert-warning hover:bg-[var(--warning)]/20"
      >
        <FlaskConical className="h-3 w-3 mr-1" />
        Modo prueba
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="alert-success hover:bg-[var(--success)]/20"
    >
      <ShieldCheck className="h-3 w-3 mr-1" />
      Pagos reales
    </Badge>
  );
}
