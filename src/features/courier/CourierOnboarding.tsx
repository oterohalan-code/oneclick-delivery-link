import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { PhoneInput } from "@/components/PhoneInput";
import { DEFAULT_COUNTRY } from "@/lib/countries";
import { validateDocument } from "@/server/validate-document.functions";
import { toast } from "sonner";
import {
  Upload,
  Check,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Hourglass,
  IdCard,
  Car,
  ScrollText,
  PackageCheck,
} from "lucide-react";
import { z } from "zod";

type DocKey = "ine_front" | "ine_back" | "license" | "circulation";
type DocStatus = "idle" | "uploading" | "validating" | "valid" | "expired" | "name_mismatch" | "unreadable" | "needs_review" | "error";

interface DocState {
  status: DocStatus;
  path?: string;
  message?: string;
  extracted?: { full_name?: string | null; expiration_date?: string | null };
  attempts: number;
}

const DOCS: { key: DocKey; label: string; icon: typeof IdCard; columnUrl: string }[] = [
  { key: "ine_front", label: "INE — Frente", icon: IdCard, columnUrl: "ine_front_url" },
  { key: "ine_back", label: "INE — Reverso", icon: IdCard, columnUrl: "ine_back_url" },
  { key: "license", label: "Licencia de conducir", icon: ScrollText, columnUrl: "license_url" },
  { key: "circulation", label: "Tarjeta de circulación", icon: Car, columnUrl: "circulation_url" },
];

const step1Schema = z.object({
  fullName: z.string().trim().min(2, "Nombre requerido").max(120),
  phone: z.string().trim().regex(/^\d{8,15}$/, "Teléfono inválido (8–15 dígitos)"),
});

interface Props {
  existing: boolean;
  onDone: () => void;
}

export function CourierOnboarding({ existing, onDone }: Props) {
  const { user, session } = useAuth();
  const validateDocumentFn = useServerFn(validateDocument);
  const [step, setStep] = useState(1);
  const [loaded, setLoaded] = useState(false);

  // Step 1 — datos
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY.code);
  const [dial, setDial] = useState(DEFAULT_COUNTRY.dial);

  // Step 2 — docs
  const [docs, setDocs] = useState<Record<DocKey, DocState>>({
    ine_front: { status: "idle", attempts: 0 },
    ine_back: { status: "idle", attempts: 0 },
    license: { status: "idle", attempts: 0 },
    circulation: { status: "idle", attempts: 0 },
  });

  // Step 3 — equipamiento
  const [hasBackpack, setHasBackpack] = useState<boolean | null>(null);
  const [willing, setWilling] = useState<boolean | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Cargar datos existentes
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: profile }, { data: courier }] = await Promise.all([
        supabase.from("profiles").select("full_name, phone, country_code, phone_dial_code").eq("id", user.id).maybeSingle(),
        supabase.from("couriers").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      if (profile) {
        setFullName(profile.full_name ?? "");
        setPhone(profile.phone ?? "");
        setCountryCode(profile.country_code ?? DEFAULT_COUNTRY.code);
        setDial(profile.phone_dial_code ?? DEFAULT_COUNTRY.dial);
      }
      if (courier) {
        setHasBackpack(courier.has_backpack ?? null);
        setWilling(courier.willing_to_get_backpack ?? null);
        const aiVal = (courier.ai_validation as Record<string, any> | null) ?? {};
        const next: Record<DocKey, DocState> = { ...docs };
        for (const d of DOCS) {
          const path = (courier as any)[d.columnUrl] as string | null;
          const v = aiVal[d.key];
          if (path) {
            next[d.key] = {
              status: v?.status ?? "valid",
              path,
              message: v?.message,
              extracted: v?.extracted,
              attempts: 0,
            };
          }
        }
        setDocs(next);
      }
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const progress = (step / 3) * 100;

  // ===== Step 2 actions =====
  const uploadAndValidate = async (key: DocKey, file: File) => {
    if (!user) return;
    if (file.size > 8 * 1024 * 1024) return toast.error("Máximo 8 MB");
    if (!fullName.trim()) {
      setStep(1);
      return toast.error("Ingresa tu nombre antes de subir documentos.");
    }

    setDocs((d) => ({ ...d, [key]: { ...d[key], status: "uploading" } }));

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${user.id}/${key}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("courier-docs").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setDocs((d) => ({ ...d, [key]: { ...d[key], status: "error", message: upErr.message } }));
      return toast.error(upErr.message);
    }

    // Persistir la URL en la columna correcta
    const colName = DOCS.find((x) => x.key === key)!.columnUrl;
    await supabase.from("couriers").update({ [colName]: path } as never).eq("user_id", user.id);

    setDocs((d) => ({ ...d, [key]: { ...d[key], status: "validating", path } }));

    try {
      const token = session?.access_token;
      if (!token) {
        throw new Error("Tu sesión expiró. Vuelve a iniciar sesión para validar documentos.");
      }

      const result = await validateDocumentFn({
        headers: { Authorization: `Bearer ${token}` },
        data: { docPath: path, docType: key, expectedFullName: fullName.trim() },
      });

      const attempts = (docs[key].attempts ?? 0) + 1;
      let finalStatus: DocStatus = result.status as DocStatus;

      // Si name_mismatch tras 2 intentos, marcamos para revisión manual
      if (result.status === "name_mismatch" && attempts >= 2) {
        finalStatus = "needs_review";
      }

      setDocs((d) => ({
        ...d,
        [key]: {
          status: finalStatus,
          path,
          message: result.message,
          extracted: result.extracted,
          attempts,
        },
      }));
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : e instanceof Response
            ? await e.text().catch(() => "Error de validación")
            : "Error de validación";
      setDocs((d) => ({
        ...d,
        [key]: { ...d[key], status: "error", message },
      }));
      toast.error(message);
    }
  };

  const allDocsReady = useMemo(
    () => DOCS.every((d) => ["valid", "needs_review"].includes(docs[d.key].status)),
    [docs],
  );

  // ===== Navigation =====
  const goNextFromStep1 = async () => {
    const parse = step1Schema.safeParse({ fullName, phone });
    if (!parse.success) return toast.error(parse.error.issues[0].message);
    if (!user) return;
    const { error } = await supabase.from("profiles").update({
      full_name: fullName.trim(),
      phone: phone.trim(),
      country_code: countryCode,
      phone_dial_code: dial,
    }).eq("id", user.id);
    if (error) return toast.error(error.message);
    setStep(2);
  };

  const equipmentOk =
    hasBackpack === true || (hasBackpack === false && willing === true);

  const submit = async () => {
    if (!user) return;
    if (!allDocsReady) return toast.error("Faltan documentos por validar.");
    if (!equipmentOk) return toast.error("Necesitas equipamiento para repartir.");
    setSubmitting(true);
    const { error } = await supabase.from("couriers").update({
      has_backpack: hasBackpack ?? false,
      willing_to_get_backpack: willing ?? false,
      status: "pending_validation",
      rejection_reason: null,
    }).eq("user_id", user.id);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setDone(true);
  };

  // ===== Render =====
  if (done) {
    return (
      <Card className="p-8 mt-4 text-center">
        <Hourglass className="h-14 w-14 mx-auto text-primary animate-pulse" />
        <h2 className="font-display text-2xl font-bold mt-4">¡Registro en proceso!</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
          Nuestro sistema y equipo están validando tus datos. Recibirás una notificación push cuando seas activado.
        </p>
        <Button className="mt-6 h-12 px-8" onClick={onDone}>Entendido</Button>
      </Card>
    );
  }

  if (!loaded) {
    return <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <Card className="p-5 sm:p-6 mt-4 text-left">
      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>Paso {step} de 3</span>
          <span>{step === 1 ? "Datos personales" : step === 2 ? "Documentos" : "Equipamiento"}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h2 className="font-display text-xl font-bold">Cuéntanos de ti</h2>
            <p className="text-sm text-muted-foreground mt-1">{existing ? "Actualiza tus datos." : "Para validar tu identidad."}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fn">Nombre completo</Label>
            <Input
              id="fn"
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
            <p className="text-xs text-muted-foreground">Solo el número, sin lada. Ej. en MX: 55 1234 5678</p>
          </div>

          <Button onClick={goNextFromStep1} className="w-full h-14 text-base">
            Siguiente <ChevronRight className="ml-1 h-5 w-5" />
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h2 className="font-display text-xl font-bold">Sube tus documentos</h2>
            <p className="text-sm text-muted-foreground mt-1">Validamos automáticamente cada foto. Asegúrate de que sea clara y completa.</p>
          </div>

          <div className="space-y-3">
            {DOCS.map(({ key, label, icon: Icon }) => (
              <DocSlot
                key={key}
                label={label}
                Icon={Icon}
                state={docs[key]}
                onFile={(f) => uploadAndValidate(key, f)}
              />
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(1)} className="h-14 flex-1">
              <ChevronLeft className="mr-1 h-5 w-5" /> Atrás
            </Button>
            <Button onClick={() => setStep(3)} disabled={!allDocsReady} className="h-14 flex-[2]">
              Siguiente <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-xl font-bold">Equipamiento</h2>
            <p className="text-sm text-muted-foreground mt-1">Necesitas algo para transportar los pedidos.</p>
          </div>

          <div className="space-y-3">
            <Label>¿Tienes mochila de repartidor?</Label>
            <div className="grid grid-cols-2 gap-3">
              <YesNoButton selected={hasBackpack === true} onClick={() => { setHasBackpack(true); setWilling(null); }}>Sí</YesNoButton>
              <YesNoButton selected={hasBackpack === false} onClick={() => setHasBackpack(false)}>No</YesNoButton>
            </div>
          </div>

          {hasBackpack === false && (
            <div className="space-y-3">
              <Label>¿Estás dispuesto a adquirir una o contar con un compartimento para transportar productos?</Label>
              <div className="grid grid-cols-2 gap-3">
                <YesNoButton selected={willing === true} onClick={() => setWilling(true)}>Sí</YesNoButton>
                <YesNoButton selected={willing === false} onClick={() => setWilling(false)}>No</YesNoButton>
              </div>
              {willing === false && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  Necesitas equipamiento para repartir.
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(2)} className="h-14 flex-1">
              <ChevronLeft className="mr-1 h-5 w-5" /> Atrás
            </Button>
            <Button onClick={submit} disabled={!equipmentOk || submitting} className="h-14 flex-[2]">
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (<><PackageCheck className="mr-2 h-5 w-5" /> Enviar para revisión</>)}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function YesNoButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-16 rounded-xl border-2 font-display text-lg font-bold transition ${
        selected ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"
      }`}
    >
      {children}
    </button>
  );
}

function DocSlot({
  label,
  Icon,
  state,
  onFile,
}: {
  label: string;
  Icon: typeof IdCard;
  state: DocState;
  onFile: (f: File) => void;
}) {
  const isBusy = state.status === "uploading" || state.status === "validating";
  const isOk = state.status === "valid" || state.status === "needs_review";
  const isBad = ["expired", "name_mismatch", "unreadable", "error"].includes(state.status);

  const border =
    state.status === "valid" ? "border-success bg-success/5"
    : state.status === "needs_review" ? "border-warning bg-warning/10"
    : isBad ? "border-destructive bg-destructive/5"
    : isBusy ? "border-primary bg-primary/5"
    : "border-border hover:border-primary/50";

  const statusText: Record<DocStatus, string> = {
    idle: "Toca para subir foto",
    uploading: "Subiendo…",
    validating: "Verificando documentos…",
    valid: state.extracted?.full_name
      ? `✓ ${state.extracted.full_name}${state.extracted.expiration_date ? ` · vence ${state.extracted.expiration_date}` : ""}`
      : "✓ Documento válido",
    needs_review: "Marcado para revisión manual",
    expired: state.message ?? "Documento expirado",
    name_mismatch: state.message ?? "El nombre no coincide",
    unreadable: state.message ?? "Foto borrosa, vuelve a subir",
    error: state.message ?? "Error al validar",
  };

  return (
    <label className={`relative block rounded-xl border-2 border-dashed p-4 cursor-pointer transition ${border}`}>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={isBusy}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ""; }}
      />
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-lg bg-card border grid place-items-center shrink-0">
          {isBusy ? <Loader2 className="h-5 w-5 animate-spin text-primary" />
            : isOk ? <Check className="h-5 w-5 text-success" />
            : isBad ? <AlertTriangle className="h-5 w-5 text-destructive" />
            : <Icon className="h-5 w-5 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{label}</div>
          <div className="text-xs text-muted-foreground mt-0.5 break-words">{statusText[state.status]}</div>
          {(isBad || state.status === "needs_review") && state.path && (
            <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
              <Upload className="h-3 w-3" /> Volver a subir
            </div>
          )}
          {state.status === "idle" && (
            <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
              <Upload className="h-3 w-3" /> Tomar foto / elegir archivo
            </div>
          )}
        </div>
      </div>
    </label>
  );
}
