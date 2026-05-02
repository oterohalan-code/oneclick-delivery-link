import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_DOMAIN = "@punchingsolutions.com.mx";

export async function claimAdminRoleForToken(accessToken: string) {
  const { data: userRes, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userRes?.user) return { promoted: false, reason: "invalid_token" };

  const userId = userRes.user.id;
  const email = (userRes.user.email ?? "").toLowerCase().trim();

  if (!email.endsWith(ADMIN_DOMAIN)) {
    return { promoted: false, reason: "domain_not_allowed" };
  }

  if (!userRes.user.email_confirmed_at) {
    return { promoted: false, reason: "email_not_confirmed" };
  }

  const { error } = await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true });

  if (error) return { promoted: false, reason: error.message };
  return { promoted: true };
}