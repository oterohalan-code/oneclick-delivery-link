import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/lib/theme";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const opts = [
    { v: "light" as const, icon: Sun, label: "Claro" },
    { v: "dark" as const, icon: Moon, label: "Oscuro" },
    { v: "system" as const, icon: Monitor, label: "Auto" },
  ];
  return (
    <div className={`inline-flex items-center gap-0.5 rounded-full glass p-0.5 ${compact ? "" : ""}`}>
      {opts.map((o) => {
        const active = theme === o.v;
        const Icon = o.icon;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => setTheme(o.v)}
            aria-label={o.label}
            aria-pressed={active}
            className={`relative grid h-7 w-7 place-items-center rounded-full transition ${
              active ? "bg-ink text-bone shadow-sm" : "text-graphite hover:text-ink"
            }`}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.6} />
          </button>
        );
      })}
    </div>
  );
}
