import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Camera, MapPin, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { haversine } from "@/components/MapView";
import { toast } from "sonner";

const MAX_DISTANCE_M = 50;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  order: {
    id: string;
    dropoff_lat: number | null;
    dropoff_lng: number | null;
  };
  courierId: string;
  onDelivered: (proofPath: string, lat: number, lng: number) => Promise<void> | void;
}

export function DeliveryProofDialog({ open, onOpenChange, order, courierId, onDelivered }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [posError, setPosError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchPosition = () => {
    if (!navigator.geolocation) {
      setPosError("Tu dispositivo no soporta geolocalización.");
      return;
    }
    setPosError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPosError(
            "Activa la ubicación: tócalo en el candado de la barra de direcciones → Permisos → Ubicación → Permitir, y reintenta.",
          );
        } else if (err.code === err.TIMEOUT) {
          setPosError("La señal GPS tardó demasiado. Reintenta en un lugar abierto.");
        } else {
          setPosError("No se pudo obtener tu ubicación. Reintenta.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
  };

  // Re-fetch GPS each time the dialog opens
  useEffect(() => {
    if (!open) {
      setPos(null);
      setPosError(null);
      setPhoto(null);
      setPhotoPreview(null);
      return;
    }
    fetchPosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const distanceM =
    pos && order.dropoff_lat != null && order.dropoff_lng != null
      ? haversine(pos, { lat: order.dropoff_lat, lng: order.dropoff_lng }) * 1000
      : null;

  const closeEnough = distanceM != null && distanceM <= MAX_DISTANCE_M;

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhoto(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!pos || !closeEnough || !photo) return;
    setBusy(true);
    try {
      const ext = photo.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${order.id}/${courierId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("delivery-proofs")
        .upload(path, photo, { upsert: true, contentType: photo.type || "image/jpeg" });
      if (upErr) throw upErr;
      await onDelivered(path, pos.lat, pos.lng);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo subir la evidencia");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Finalizar entrega</DialogTitle>
          <DialogDescription>
            Confirma tu ubicación y sube una foto del paquete entregado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* GPS panel */}
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="h-4 w-4" /> Ubicación
            </div>
            {!pos && !posError && (
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Obteniendo GPS...
              </div>
            )}
            {posError && (
              <div className="mt-2 space-y-2">
                <div className="flex items-start gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {posError}
                </div>
                <Button size="sm" variant="secondary" onClick={fetchPosition} className="w-full">
                  Reintentar ubicación
                </Button>
              </div>
            )}
            {distanceM != null && (
              closeEnough ? (
                <div className="mt-2 flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" /> Estás a {Math.round(distanceM)} m del destino.
                </div>
              ) : (
                <div className="mt-2 text-sm text-warning">
                  Acércate al punto de entrega: faltan <strong>{Math.round(distanceM - MAX_DISTANCE_M)} m</strong>.
                </div>
              )
            )}
          </div>

          {/* Photo */}
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <Camera className="h-4 w-4" /> Foto del paquete
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onPickFile}
            />
            {photoPreview ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="block w-full rounded-md overflow-hidden border border-border"
              >
                <img src={photoPreview} alt="evidencia" className="w-full max-h-56 object-cover" />
              </button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => fileRef.current?.click()}
              >
                <Camera className="mr-2 h-4 w-4" /> Tomar foto
              </Button>
            )}
          </div>

          <Button
            disabled={!closeEnough || !photo || busy}
            onClick={submit}
            className="w-full h-12"
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Confirmar entrega
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
