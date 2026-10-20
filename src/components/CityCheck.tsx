import { Label } from "@/components/ui/label";
import { MapPin } from "lucide-react";

export type CityChoice = "" | "manzanillo" | "other";

export function CityCheck({ value, onChange }: { value: CityChoice; onChange: (v: CityChoice) => void }) {
  return (
    <div className="space-y-2">
      <Label>¿En qué ciudad estás?</Label>
      <div className="grid grid-cols-2 gap-2">
        {([
          ["manzanillo", "Manzanillo"],
          ["other", "Otra ciudad"],
        ] as const).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`h-12 rounded-lg border text-sm font-medium transition ${
              value === v ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background text-foreground hover:bg-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {value === "other" && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-foreground flex gap-3">
          <MapPin className="h-5 w-5 text-primary shrink-0" />
          <p>
            <strong>¡Pronto estaremos en tu ciudad!</strong> Por ahora 1Click solo da servicio en Manzanillo.
            Gracias por tu interés.
          </p>
        </div>
      )}
    </div>
  );
}
