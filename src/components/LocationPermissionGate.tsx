import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, AlertTriangle, Loader2 } from "lucide-react";

type Permission = "unknown" | "granted" | "denied" | "prompt" | "unsupported";

interface Props {
  permission: Permission;
  /** Why the app needs the permission. Shown in the gate. */
  reason?: string;
  /** Called after a successful prompt so the parent can refresh state. */
  onGranted?: () => void;
}

/**
 * Visible while the browser geolocation permission is NOT granted.
 * Triggers the native prompt under a real user gesture (required by Chrome/Safari)
 * and explains exactly how to re-enable it when permission is `denied`.
 */
export function LocationPermissionGate({ permission, reason, onGranted }: Props) {
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  if (permission === "granted") return null;

  const requestNow = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLastError("Tu dispositivo o navegador no soporta geolocalización.");
      return;
    }
    setBusy(true);
    setLastError(null);
    navigator.geolocation.getCurrentPosition(
      () => {
        setBusy(false);
        onGranted?.();
      },
      (err) => {
        setBusy(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setLastError(
              "El navegador bloqueó la ubicación. Tócalo en el candado/ícono de la barra de direcciones → Permisos → Ubicación → Permitir, y vuelve a intentarlo.",
            );
            break;
          case err.POSITION_UNAVAILABLE:
            setLastError("No pudimos obtener tu ubicación. Verifica que el GPS esté activo y reintenta.");
            break;
          case err.TIMEOUT:
            setLastError("La solicitud tardó demasiado. Intenta de nuevo en un lugar con mejor señal.");
            break;
          default:
            setLastError("Ocurrió un error al pedir tu ubicación. Reintenta.");
        }
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  };

  const isUnsupported = permission === "unsupported";

  return (
    <Card className="p-4 bg-warning/10 border-warning space-y-3">
      <div className="flex gap-2">
        <MapPin className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold">Necesitamos tu ubicación</p>
          <p className="text-muted-foreground mt-1">
            {reason ??
              "La usamos para mostrarte pedidos cercanos, asignarte rutas y verificar que estás en el punto de entrega al finalizar."}
          </p>
        </div>
      </div>

      {lastError && (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{lastError}</span>
        </div>
      )}

      {!isUnsupported && (
        <Button onClick={requestNow} disabled={busy} className="w-full h-11">
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Solicitando…
            </>
          ) : permission === "denied" ? (
            "Ya lo activé, reintentar"
          ) : (
            "Activar ubicación"
          )}
        </Button>
      )}
    </Card>
  );
}
