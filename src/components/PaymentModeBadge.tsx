import { Badge } from "@/components/ui/badge";
import { ShieldCheck, FlaskConical } from "lucide-react";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

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
        className="border-orange-400 bg-orange-100 text-orange-800 hover:bg-orange-100"
      >
        <FlaskConical className="h-3 w-3 mr-1" />
        Modo prueba
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="border-green-500 bg-green-100 text-green-800 hover:bg-green-100"
    >
      <ShieldCheck className="h-3 w-3 mr-1" />
      Pagos reales
    </Badge>
  );
}
