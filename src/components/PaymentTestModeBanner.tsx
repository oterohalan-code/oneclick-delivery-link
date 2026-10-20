const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

export function PaymentTestModeBanner() {
  if (!publishableKey?.startsWith("pk_test_")) return null;

  return (
    <div className="w-full alert-warning border-b px-4 py-2 text-center text-sm">
      Los pagos en la vista previa están en modo de prueba.{" "}
      <a
        href="https://docs.lovable.dev/features/payments#test-and-live-environments"
        target="_blank"
        rel="noopener noreferrer"
        className="underline font-medium"
      >
        Más info
      </a>
    </div>
  );
}
