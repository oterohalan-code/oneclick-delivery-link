import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Página no encontrada</p>
        <a href="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Ir al inicio
        </a>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "1-Click — Logística Cancún" },
      { name: "description", content: "Conecta restaurantes con repartidores en Cancún. Pedidos en vivo, monedero digital y red de motociclistas verificados." },
      { name: "theme-color", content: "#171615" },
      { property: "og:title", content: "1-Click — Logística Cancún" },
      { property: "og:description", content: "Conecta restaurantes con repartidores en Cancún. Pedidos en vivo, monedero digital y red de motociclistas verificados." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "1-Click — Logística Cancún" },
      { name: "twitter:description", content: "Conecta restaurantes con repartidores en Cancún. Pedidos en vivo, monedero digital y red de motociclistas verificados." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2c307d06-98e5-4e48-996a-32503afe69a3/id-preview-8ff8f0d6--944f0876-4978-49ab-8426-84c1cdc9047f.lovable.app-1777666447095.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2c307d06-98e5-4e48-996a-32503afe69a3/id-preview-8ff8f0d6--944f0876-4978-49ab-8426-84c1cdc9047f.lovable.app-1777666447095.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", type: "image/svg+xml", href: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='28' fill='%23171615'/><text x='32' y='46' font-family='Georgia,serif' font-weight='500' font-size='38' text-anchor='middle' fill='%23F5F2EB' font-style='italic'>1</text><circle cx='50' cy='18' r='4.5' fill='%23B8693A'/></svg>" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,300;1,9..144,400&family=Inter+Tight:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Outlet />
        <Toaster position="top-center" richColors closeButton />
      </AuthProvider>
    </ThemeProvider>
  );
}
