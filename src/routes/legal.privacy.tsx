import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Aviso de Privacidad — 1Click" },
      { name: "description", content: "Aviso de privacidad de 1Click conforme a la LFPDPPP." },
      { property: "og:title", content: "Aviso de Privacidad — 1Click" },
      { property: "og:description", content: "Aviso de privacidad de 1Click conforme a la LFPDPPP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 prose prose-slate">
      <h1>Aviso de Privacidad</h1>
      <p><em>Última actualización: 3 de mayo de 2026</em></p>

      <p>
        <strong>Punching Solutions S.A. de C.V.</strong> ("1Click"), con domicilio
        en Manzanillo, Colima, México, es responsable del tratamiento de tus
        datos personales conforme a la Ley Federal de Protección de Datos
        Personales en Posesión de los Particulares (LFPDPPP).
      </p>

      <h2>1. Datos que recabamos</h2>
      <ul>
        <li><strong>Identificación</strong>: nombre, correo, teléfono.</li>
        <li><strong>Repartidores</strong>: INE, licencia de conducir, tarjeta de circulación, placa, foto de la motocicleta. Estos documentos solo se usan para validación y son visibles únicamente para el área de operaciones.</li>
        <li><strong>Restaurantes</strong>: dirección, foto de la fachada, datos de contacto.</li>
        <li><strong>Operativos</strong>: ubicación GPS en tiempo real durante turnos activos, historial de pedidos, mensajes de chat.</li>
        <li><strong>Pago</strong>: procesado por Stripe; 1Click no almacena datos de tarjeta.</li>
      </ul>

      <h2>2. Finalidades</h2>
      <ul>
        <li>Operar la plataforma y conectar restaurantes con repartidores.</li>
        <li>Procesar pagos, monedero y suscripciones.</li>
        <li>Validar identidad y prevenir fraude.</li>
        <li>Soporte al cliente y notificaciones operativas.</li>
        <li>Mejora del servicio (análisis agregado y anónimo).</li>
      </ul>

      <h2>3. Transferencias</h2>
      <p>
        Compartimos datos solo con proveedores estrictamente necesarios:
        Stripe (pagos), Lovable Cloud / Supabase (infraestructura), y autoridades
        cuando sea legalmente requerido. No vendemos datos personales.
      </p>

      <h2>4. Derechos ARCO</h2>
      <p>
        Tienes derecho a Acceder, Rectificar, Cancelar u Oponerte al tratamiento
        de tus datos, así como a revocar tu consentimiento. Envía tu solicitud a{" "}
        <a href="mailto:privacidad@punchingsolutions.com.mx">privacidad@punchingsolutions.com.mx</a>
        {" "}con copia de tu identificación. Responderemos en máximo 20 días hábiles.
      </p>

      <h2>5. Conservación</h2>
      <p>
        Conservamos los datos por el tiempo necesario para cumplir con las
        finalidades y obligaciones fiscales (mínimo 5 años).
      </p>

      <h2>6. Seguridad</h2>
      <p>
        Aplicamos cifrado en tránsito (HTTPS), control de acceso por roles, y
        almacenamiento seguro. No obstante, ningún sistema es infalible.
      </p>

      <h2>7. Cookies</h2>
      <p>
        Usamos cookies técnicas para mantener tu sesión y preferencias.
      </p>

      <h2>8. Cambios al aviso</h2>
      <p>
        Notificaremos cualquier cambio relevante a través de la app y por correo.
      </p>

      <p>
        <Link to="/legal/terms">Términos y Condiciones</Link>
      </p>
    </main>
  );
}
