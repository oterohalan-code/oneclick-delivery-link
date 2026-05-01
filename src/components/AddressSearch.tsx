import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, Search } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const skipNextSearch = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Live debounced search
  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    if (q.trim().length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchAddress(q);
        setResults(r);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  // Close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (r: { display_name: string; lat: number; lng: number }) => {
    skipNextSearch.current = true;
    setQ(r.display_name);
    onChange(r.display_name, r.lat, r.lng);
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            onChange(e.target.value);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder ?? "Buscar dirección..."}
          className="h-12 pl-9 pr-9 text-base"
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-[1000] left-0 right-0 mt-1 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg max-h-64 overflow-auto">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => pick(r)}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent border-b border-border last:border-0 flex items-start gap-2"
            >
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <span className="leading-snug">{r.display_name}</span>
            </button>
          ))}
        </div>
      )}
      {open && !loading && q.trim().length >= 3 && results.length === 0 && (
        <div className="absolute z-[1000] left-0 right-0 mt-1 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg px-3 py-2 text-sm text-muted-foreground">
          Sin resultados. Intenta otra referencia o ajusta el pin en el mapa.
        </div>
      )}
    </div>
  );
}
