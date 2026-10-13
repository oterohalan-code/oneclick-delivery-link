import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isMasterAdminEmail } from "@/lib/admin-access";

export async function hasActiveMembership(
  userId: string,
  role: "restaurant" | "courier",
): Promise<boolean> {
  const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (isMasterAdminEmail(userRes?.user?.email)) return true;

  const { data, error } = await supabaseAdmin.rpc("has_active_membership", {
    _user_id: userId,
    _role: role,
  });
  if (!error && typeof data === "boolean") return data;

  if (role === "courier") {
    const { data: courier } = await supabaseAdmin
      .from("couriers")
      .select("subscription_active, subscription_expires_at")
      .eq("user_id", userId)
      .maybeSingle();
    return !!(
      courier?.subscription_active &&
      courier.subscription_expires_at &&
      new Date(courier.subscription_expires_at).getTime() > Date.now()
    );
  }

  const { data: membership } = await supabaseAdmin
    .from("memberships")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();
  return !!(
    membership?.status === "active" &&
    membership.current_period_end &&
    new Date(membership.current_period_end).getTime() > Date.now()
  );
}
