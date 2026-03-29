export const PORTAL_ADMIN_EMAILS = [
  "rawillia9809@gmail.com",
  "cristyrambosmith@gmail.com",
] as const;

export function normalizePortalEmail(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

export function isPortalAdminEmail(value: string | null | undefined): boolean {
  const email = normalizePortalEmail(value);
  return PORTAL_ADMIN_EMAILS.includes(email as (typeof PORTAL_ADMIN_EMAILS)[number]);
}

export function getPortalAdminEmails(): string[] {
  return [...PORTAL_ADMIN_EMAILS];
}
