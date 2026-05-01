import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTRIES, findCountryByCode } from "@/lib/countries";

interface Props {
  countryCode: string;
  phone: string;
  onChange: (next: { countryCode: string; dial: string; phone: string }) => void;
  disabled?: boolean;
}

export function PhoneInput({ countryCode, phone, onChange, disabled }: Props) {
  const current = findCountryByCode(countryCode);

  return (
    <div className="flex gap-2">
      <Select
        value={current.code}
        onValueChange={(code) => {
          const c = findCountryByCode(code);
          onChange({ countryCode: c.code, dial: c.dial, phone });
        }}
        disabled={disabled}
      >
        <SelectTrigger className="w-[140px] h-12">
          <SelectValue>
            <span className="flex items-center gap-2">
              <span className="text-lg leading-none">{current.flag}</span>
              <span className="text-sm font-medium">{current.dial}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {COUNTRIES.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              <span className="flex items-center gap-2">
                <span className="text-lg leading-none">{c.flag}</span>
                <span>{c.name}</span>
                <span className="text-muted-foreground text-sm">{c.dial}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="55 1234 5678"
        value={phone}
        disabled={disabled}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 15);
          onChange({ countryCode: current.code, dial: current.dial, phone: digits });
        }}
        className="h-12 text-base flex-1"
      />
    </div>
  );
}
