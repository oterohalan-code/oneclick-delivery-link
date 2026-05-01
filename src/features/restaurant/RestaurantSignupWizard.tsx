import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { PhoneInput } from "@/components/PhoneInput";
import { AddressSearch } from "@/components/AddressSearch";
import { MapView, reverseGeocode } from "@/components/MapView";
import { DEFAULT_COUNTRY } from "@/lib/countries";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import {
  Camera,
  ChevronRight,
  Loader2,
  MailCheck,
  Store,
} from "lucide-react";
import { z } from "zod";

const step1Schema = z.object({
  name: z.string().trim().min(2, "Nombre del local requerido").max(120),
  phone: z.string().trim().regex(/^\d{8,15}$/, "Teléfono inválido (8–15 dígitos)"),
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(8, "Contraseña mínimo 8 caracteres").max(72),
});

const step2Schema = z.object({
  address: z.string().trim().min(5, "Dirección requerida"),
  lat: z.number().refine((v) => Number.isFinite(v), "Selecciona la ubicación en el mapa"),
  lng: z.number().refine((v) => Number.isFinite(v), "Selecciona la ubicación en el mapa"),
  facadeUrl: z.string().min(1, "Sube una foto de la fachada"),
});

export function RestaurantSignupWizard() {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);

  // Paso 1
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY.code);
  const [dial, setDial] = useState(DEFAULT_COUNTRY.dial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Paso 2
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [facadeUrl, setFacadeUrl] = useState<string>("");
  const [facadePreview, setFacadePreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  const handleMapPick = async (la: number, ln: number) => {
    setLat(la);
    setLng(ln);
    setGeocoding(true);
    const addr = await reverseGeocode(la, ln);
    setGeocoding(false);
    if (addr) setAddress(addr);
  };

  const alreadyAuthed = !!user && !!session;
  const effectiveStep = alreadyAuthed ? Math.max(step, 2) : step;
  const progress = (effectiveStep / 2) * 100;

  const onCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = step1Schema.safeParse({ name, phone, email, password });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: {
          full_name: name.trim(),
          phone: phone.trim(),
          role: "restaurant",
        },
      },
    });
    setSubmitting(false);

    if (error) return toast.error(error.message);

    if (data.session?.user) {
      await supabase
        .from("profiles")
        .update({
          country_code: countryCode,
          phone_dial_code: dial,
          full_name: name.trim(),
          phone: phone.trim(),
        })
        .eq("id", data.session.user.id);
      toast.success("¡Cuenta creada! Continúa con los datos del local.");
      setStep(2);
    } else {
      setNeedsEmailConfirm(true);
    }
  };

  const onPickFile = () => fileRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user) return toast.error("Sesión no encontrada");
    if (file.size > 8 * 1024 * 1024) return toast.error("La imagen no debe pesar más de 8MB");

    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/facade-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("restaurant-photos")
      .upload(path, file, { upsert: true, contentType: file.type });
    setUploading(false);

    if (error) return toast.error(error.message);
    setFacadeUrl(path);
    setFacadePreview(URL.createObjectURL(file));
    toast.success("Foto subida");
  };

  const onFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return toast.error("Sesión no encontrada");

    const parsed = step2Schema.safeParse({
      address,
      lat: lat ?? NaN,
      lng: lng ?? NaN,
      facadeUrl,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setSubmitting(true);
    const { error } = await supabase.from("restaurants").insert({
      user_id: user.id,
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      lat: lat!,
      lng: lng!,
      facade_url: facadeUrl,
    });
    setSubmitting(false);

    if (error) return toast.error(error.message);
    toast.success("¡Restaurante registrado!");
    navigate({ to: "/app" });
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>Paso {effectiveStep} de 2</span>
          <span>
            {effectiveStep === 1 ? "Datos de acceso" : "Local y ubicación"}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {needsEmailConfirm ? (
        <div className="text-center py-6 space-y-3">
          <MailCheck className="h-14 w-14 mx-auto text-primary" />
          <h3 className="font-display text-xl font-bold">Confirma tu email</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Te enviamos un enlace a <strong>{email}</strong>. Ábrelo para
            verificar tu cuenta y luego regresa para completar el registro de tu
            restaurante.
          </p>
        </div>
      ) : !alreadyAuthed && step === 1 ? (
        <form onSubmit={onCreateAccount} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rw-name">Nombre del local</Label>
            <Input
              id="rw-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Tacos El Compa"
              className="h-12 text-base"
              autoComplete="organization"
            />
          </div>

          <div className="space-y-2">
            <Label>Teléfono</Label>
            <PhoneInput
              countryCode={countryCode}
              phone={phone}
              onChange={({ countryCode: cc, dial: d, phone: p }) => {
                setCountryCode(cc);
                setDial(d);
                setPhone(p);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Solo el número, sin lada. Ej. en MX: 998 123 4567
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rw-email">Email</Label>
            <Input
              id="rw-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 text-base"
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rw-pw">Contraseña (mín. 8)</Label>
            <Input
              id="rw-pw"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 text-base"
              autoComplete="new-password"
            />
          </div>

          <Button type="submit" disabled={submitting} className="w-full h-14 text-base">
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                Crear cuenta y continuar <ChevronRight className="ml-1 h-5 w-5" />
              </>
            )}
          </Button>
        </form>
      ) : (
        <form onSubmit={onFinish} className="space-y-5">
          {/* Foto de la fachada */}
          <div className="space-y-2">
            <Label>Foto de la fachada</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onFileChange}
            />
            {facadePreview ? (
              <button
                type="button"
                onClick={onPickFile}
                className="relative w-full overflow-hidden rounded-xl border border-border group"
              >
                <img
                  src={facadePreview}
                  alt="Fachada"
                  className="w-full h-48 object-cover"
                />
                <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-sm">
                  Cambiar foto
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onPickFile}
                disabled={uploading}
                className="w-full h-40 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-accent/50 transition flex flex-col items-center justify-center gap-2 text-muted-foreground"
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <Camera className="h-7 w-7" />
                    <span className="text-sm">Toca para tomar o subir foto</span>
                  </>
                )}
              </button>
            )}
            <p className="text-xs text-muted-foreground">
              Ayuda a los repartidores a reconocer tu local.
            </p>
          </div>


          {/* Dirección + mapa */}
          <div className="space-y-2">
            <Label>Dirección</Label>
            <AddressSearch
              value={address}
              onChange={(addr, la, ln) => {
                setAddress(addr);
                if (la != null) setLat(la);
                if (ln != null) setLng(ln);
              }}
              placeholder="Calle, colonia, referencia..."
            />
          </div>

          <div>
            <MapView
              pins={
                lat != null && lng != null
                  ? [{ lat, lng, label: name || "Mi local" }]
                  : []
              }
              onMapClick={handleMapPick}
              height="260px"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {geocoding
                ? "Obteniendo dirección…"
                : "Tip: toca el mapa para ajustar la ubicación exacta."}
            </p>
          </div>

          <Button
            type="submit"
            disabled={submitting || uploading}
            className="w-full h-14 text-base"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Store className="mr-1 h-5 w-5" />
                Finalizar registro
              </>
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
