import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Body = z.object({
  restaurantId: z.string().uuid(),
  requestId: z.string().uuid(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/menu-request-alert")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return json({ ok: false }, 400);
        }
        const parsed = Body.safeParse(payload);
        if (!parsed.success) return json({ ok: false }, 400);

        const { data: row } = await supabaseAdmin
          .from("menu_requests")
          .select("id, restaurant_id, customer_name, food_total, created_at, status")
          .eq("id", parsed.data.requestId)
          .eq("restaurant_id", parsed.data.restaurantId)
          .eq("status", "new")
          .maybeSingle();
        if (!row) return json({ ok: false }, 404);
        if (Date.now() - new Date(row.created_at).getTime() > 5 * 60 * 1000) {
          return json({ ok: false }, 409);
        }

        const { data: restaurant } = await supabaseAdmin
          .from("restaurants")
          .select("user_id, name")
          .eq("id", row.restaurant_id)
          .maybeSingle();
        if (!restaurant?.user_id) return json({ ok: true, push: false });

        try {
          const { sendPushToUsers } = await import("@/server/push.server");
          await sendPushToUsers([restaurant.user_id], {
            title: "Nuevo pedido",
            body: `${row.customer_name} pidió en ${restaurant.name}`,
            url: "/app",
          });
        } catch (error) {
          console.warn("[menu-request-alert] push failed", error);
          return json({ ok: true, push: false });
        }
        return json({ ok: true, push: true });
      },
    },
  },
});
