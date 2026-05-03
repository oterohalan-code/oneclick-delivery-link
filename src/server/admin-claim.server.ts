import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_DOMAIN = "@punchingsolutions.com.mx";

export async function claimAdminRoleForUser(userId: string) {
  const { data: userRes, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (userError || !userRes?.user) return { promoted: false, reason: "user_not_found" };

  const email = (userRes.user.email ?? "").toLowerCase().trim();
  if (!email.endsWith(ADMIN_DOMAIN)) return { promoted: false, reason: "domain_not_allowed" };
  if (!userRes.user.email_confirmed_at) return { promoted: false, reason: "email_not_confirmed" };

  const { error } = await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true });

  if (error) return { promoted: false, reason: error.message };
  return { promoted: true };
}
