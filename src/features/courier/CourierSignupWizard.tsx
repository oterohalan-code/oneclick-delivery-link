import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { PhoneInput } from "@/components/PhoneInput";
import { DEFAULT_COUNTRY } from "@/lib/countries";
import { CourierOnboarding } from "./CourierOnboarding";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { ChevronRight, Loader2, MailCheck } from "lucide-react";
import { z } from "zod";

const step1Schema = z.object({
  fullName: z.string().trim().min(2, "Nombre requerido").max(120),
  phone: z.string().trim().regex(/^\d{8,15}$/, "Teléfono inválido (8–15 dígitos)"),
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(8, "Contraseña mínimo 8 caracteres").max(72),
});

export function CourierSignupWizard() {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY.code);
  const [dial, setDial] = useState(DEFAULT_COUNTRY.dial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Si ya hay sesión activa de courier, saltar al paso de documentos directamente
  const alreadyAuthed = !!user && !!session;
  const effectiveStep = alreadyAuthed ? Math.max(step, 2) : step;
  const progress = (effectiveStep / 4) * 100;

  const onCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = step1Schema.safeParse({ fullName, phone, email, password });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (!acceptedTerms) return toast.error("Debes aceptar los Términos y la Política de Privacidad");
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: {
          full_name: fullName.trim(),
          phone: phone.trim(),
          role: "courier",
        },
      },
    });
    setSubmitting(false);

    if (error) return toast.error(error.message);

    // Guardar país/dial en profile (mejor esfuerzo, requiere sesión)
    if (data.session?.user) {
      await supabase
        .from("profiles")
        .update({
          country_code: countryCode,
          phone_dial_code: dial,
          full_name: fullName.trim(),
          phone: phone.trim(),
        })
        .eq("id", data.session.user.id);
      toast.success("¡Cuenta creada! Continúa con tus documentos.");
      setStep(2);
    } else {
      // Confirmación por email requerida
      setNeedsEmailConfirm(true);
    }
  };

  return (
    <div className="space-y-5">
      {/* Barra de progreso global */}
      <div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>Paso {effectiveStep} de 4</span>
          <span>
            {effectiveStep === 1 && "Datos de acceso"}
            {effectiveStep === 2 && "Documentos"}
            {effectiveStep === 3 && "Equipamiento"}
            {effectiveStep === 4 && "Confirmación"}
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
            verificar tu cuenta y luego regresa para subir tus documentos.
          </p>
        </div>
      ) : !alreadyAuthed && step === 1 ? (
        <form onSubmit={onCreateAccount} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cw-name">Nombre completo</Label>
            <Input
              id="cw-name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Como aparece en tu INE"
              className="h-12 text-base"
              autoComplete="name"
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
              Solo el número, sin lada. Ej. en MX: 55 1234 5678
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cw-email">Email</Label>
            <Input
              id="cw-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 text-base"
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cw-pw">Contraseña (mín. 8)</Label>
            <Input
              id="cw-pw"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 text-base"
              autoComplete="new-password"
            />
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-hairline bg-card/40 p-3">
            <Checkbox
              id="cw-terms"
              checked={acceptedTerms}
              onCheckedChange={(v) => setAcceptedTerms(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="cw-terms" className="text-xs text-muted-foreground font-normal leading-relaxed cursor-pointer">
              He leído y acepto los{" "}
              <Link to="/legal/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">Términos y Condiciones</Link>
              {" "}y la{" "}
              <Link to="/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">Política de Privacidad</Link>.
            </Label>
          </div>

          <Button type="submit" disabled={submitting || !acceptedTerms} className="w-full h-14 text-base">
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
        // Pasos 2 y 3 (y pantalla final) gestionados por CourierOnboarding
        <CourierOnboarding
          existing={false}
          onDone={() => navigate({ to: "/app" })}
        />
      )}
    </div>
  );
}
