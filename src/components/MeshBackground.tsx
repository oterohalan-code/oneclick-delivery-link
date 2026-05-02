interface MeshBackgroundProps {
  variant?: "light" | "dark";
  className?: string;
}

/**
 * Decorative mesh background — warm copper + ivory blobs with subtle grain.
 * Place as the first child of a relatively positioned container.
 */
export function MeshBackground({ variant = "light", className = "" }: MeshBackgroundProps) {
  const bg =
    variant === "dark"
      ? "bg-[radial-gradient(at_18%_22%,oklch(0.32_0.04_45/0.6),transparent_55%),radial-gradient(at_82%_18%,oklch(0.38_0.05_30/0.5),transparent_60%),radial-gradient(at_50%_92%,oklch(0.22_0.02_60/0.8),transparent_70%)] bg-ink"
      : "bg-[radial-gradient(at_15%_18%,oklch(0.85_0.08_45/0.55),transparent_55%),radial-gradient(at_85%_22%,oklch(0.92_0.05_80/0.5),transparent_60%),radial-gradient(at_60%_88%,oklch(0.88_0.06_30/0.4),transparent_65%)] bg-bone";
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`}>
      <div className={`absolute inset-0 ${bg}`} />
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
    </div>
  );
}
