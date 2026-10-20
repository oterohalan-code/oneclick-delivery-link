interface MeshBackgroundProps {
  variant?: "light" | "dark";
  className?: string;
}

/**
 * Decorative mesh — bone field, ink depth, and the copper point from the logo mocks.
 * Place as the first child of a relatively positioned container.
 */
export function MeshBackground({ variant = "light", className = "" }: MeshBackgroundProps) {
  const bg =
    variant === "dark"
      ? "bg-navy bg-[radial-gradient(at_20%_15%,color-mix(in_srgb,var(--ember)_22%,transparent),transparent_55%)]"
      : "bg-background bg-[radial-gradient(at_15%_10%,color-mix(in_srgb,var(--ember)_10%,transparent),transparent_50%),radial-gradient(at_85%_20%,color-mix(in_srgb,var(--color-navy)_7%,transparent),transparent_55%)]";
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
