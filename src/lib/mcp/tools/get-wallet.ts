import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_my_wallet",
  title: "Ver mi monedero",
  description: "Muestra el saldo del monedero, plan y estado de suscripción del repartidor que inició sesión.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("No autenticado");
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb.from("couriers")
      .select("wallet_balance,plan,subscription_active,subscription_expires_at")
      .eq("user_id", ctx.getUserId()!)
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!data) throw new ToolError("Esta cuenta no es de repartidor.");
    const wallet = {
      balance_mxn: Number(data.wallet_balance), plan: String(data.plan),
      subscription_active: Boolean(data.subscription_active),
      subscription_expires_at: data.subscription_expires_at ?? null,
    };
    return {
      content: [{ type: "text", text: `Saldo $${wallet.balance_mxn.toFixed(2)} MXN · plan ${wallet.plan}${wallet.subscription_active ? " · suscripción activa" : ""}` }],
      structuredContent: { wallet },
    };
  },
});
