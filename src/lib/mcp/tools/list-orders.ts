import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_orders",
  title: "Listar mis pedidos",
  description: "Lista los pedidos recientes visibles para el usuario (restaurante o repartidor), opcionalmente filtrados por estado.",
  inputSchema: {
    status: z.string().optional().describe("Estado a filtrar, ej. pending, assigned, picked_up, delivered, cancelled."),
    limit: z.number().int().min(1).max(50).optional().describe("Máximo de pedidos (1-50, por defecto 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("No autenticado");
    const sb = supabaseForUser(ctx);
    let q = sb.from("orders")
      .select("id,status,pickup_address,dropoff_address,distance_km,eta_minutes,created_at,delivered_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const orders = (data ?? []).map((o: any) => ({
      id: String(o.id), status: String(o.status), pickup: String(o.pickup_address), dropoff: String(o.dropoff_address),
      distance_km: o.distance_km ?? null, eta_minutes: o.eta_minutes ?? null,
      created_at: String(o.created_at), delivered_at: o.delivered_at ?? null,
    }));
    const text = orders.length
      ? orders.map((o) => `${o.id} · ${o.status} · ${o.pickup} → ${o.dropoff}`).join("\n")
      : "Sin pedidos.";
    return { content: [{ type: "text", text }], structuredContent: { orders } };
  },
});
