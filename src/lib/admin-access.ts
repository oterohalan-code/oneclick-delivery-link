/** Who can hold the admin role. Do not grant this from public signup metadata. */

export const ADMIN_DOMAIN = "@punchingsolutions.com.mx";

export const MASTER_ADMIN_EMAILS = ["otero.h.alan@icloud.com"] as const;

const MASTER_ADMIN_SET = new Set<string>(MASTER_ADMIN_EMAILS);

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").toLowerCase().trim();
}

export function isAllowedAdminEmail(email: string | null | undefined): boolean {
  const value = normalizeEmail(email);
  if (!value) return false;
  return MASTER_ADMIN_SET.has(value) || value.endsWith(ADMIN_DOMAIN);
}
