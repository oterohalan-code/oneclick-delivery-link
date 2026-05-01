import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { searchAddress } from "./MapView";

interface Props {
  value: string;
  onChange: (address: string, lat?: number, lng?: number) => void;
  placeholder?: string;
}

export function AddressSearch({ value, onChange, placeholder }: Props) {
  const [q, setQ] = useState(value);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{ display_name: string; lat: number; lng: number }>>([]);

  const search = async () => {
    setLoading(true);
    const r = await searchAddress(q);
    setResults(r);
    setLoading(false);
  };

  return (
    <div>
      <div className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => { setQ(e.target.value); onChange(e.target.value); }}
          placeholder={placeholder ?? "Buscar dirección..."}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }}
        />
        <Button type="button" variant="secondary" onClick={search} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>
      {results.length > 0 && (
        <div className="mt-2 rounded-lg border border-border bg-card max-h-48 overflow-auto">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { onChange(r.display_name, r.lat, r.lng); setQ(r.display_name); setResults([]); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent border-b border-border last:border-0"
            >
              {r.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
