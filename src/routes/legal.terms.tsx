import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Términos y Condiciones — 1Click" },
      { name: "description", content: "Términos y condiciones de uso de 1Click." },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 prose prose-slate">
      <h1>Términos y Condiciones</h1>
      <p><em>Última actualización: 3 de mayo de 2026</em></p>

      <p>
        Bienvenido a <strong>1Click</strong>, plataforma de logística operada por
        Punching Solutions S.A. de C.V. (en adelante, "1Click", "nosotros"), con
        domicilio en Manzanillo, Colima, México. Al registrarte y utilizar la
        plataforma aceptas estos Términos.
      </p>

      <h2>1. Servicio</h2>
      <p>
        1Click conecta a restaurantes con repartidores independientes para la
        entrega de pedidos de última milla. 1Click no es restaurante ni
        repartidor: actúa como intermediario tecnológico.
      </p>

      <h2>2. Registro</h2>
      <p>
        Para usar la plataforma debes ser mayor de edad, proporcionar información
        veraz y mantener la confidencialidad de tu cuenta. 1Click puede suspender
        cuentas con información falsa o uso indebido.
      </p>

      <h2>3. Tarifas y pagos</h2>
      <p>
        Los restaurantes pagan una membresía mensual de $450 MXN. Los
        repartidores pagan $300 MXN al mes. One Click no cobra comisión sobre
        la comida ni sobre el envío. Los pagos de membresía se procesan con
        Mercado Pago. 1Click no almacena datos de tarjetas.
      </p>

      <h2>4. Obligaciones del usuario</h2>
      <ul>
        <li>No usar la plataforma para fines ilícitos.</li>
        <li>No transportar productos prohibidos por la ley mexicana.</li>
        <li>Cumplir con las normas de tránsito y seguridad.</li>
        <li>Tratar con respeto a contrapartes y personal de soporte.</li>
      </ul>

      <h2>5. Limitación de responsabilidad</h2>
      <p>
        1Click no es responsable por daños, pérdidas o retrasos causados por
        terceros (repartidores, restaurantes, clientes finales o fuerza mayor).
        La responsabilidad máxima se limita al monto del envío específico.
      </p>

      <h2>6. Cancelación</h2>
      <p>
        Puedes cancelar tu cuenta en cualquier momento desde el perfil. La
        suscripción se cancela al final del período facturado.
      </p>

      <h2>7. Modificaciones</h2>
      <p>
        Podemos actualizar estos Términos. Te notificaremos cambios materiales con
        al menos 15 días de anticipación.
      </p>

      <h2>8. Ley aplicable</h2>
      <p>
        Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos.
        Cualquier disputa se someterá a los tribunales de Manzanillo, Colima.
      </p>

      <h2>9. Contacto</h2>
      <p>
        soporte@punchingsolutions.com.mx — <Link to="/legal/privacy">Aviso de Privacidad</Link>
      </p>
    </main>
  );
}
