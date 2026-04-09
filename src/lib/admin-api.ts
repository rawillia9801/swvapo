import "server-only";
import { createClient } from "@supabase/supabase-js";
import { isPortalAdminEmail } from "@/lib/portal-admin";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function createAnonSupabase() {
  return createClient(getEnv("NEXT_PUBLIC_SUPABASE_URL"), getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createServiceSupabase() {
  return createClient(getEnv("NEXT_PUBLIC_SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getBearerToken(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }
  return null;
}

export async function verifyOwner(req: Request) {
  const accessToken = getBearerToken(req);
  if (!accessToken) return null;

  const anon = createAnonSupabase();
  const { data, error } = await anon.auth.getUser(accessToken);
  if (error || !data.user || !isPortalAdminEmail(data.user.email)) {
    return null;
  }

  return data.user;
}

export function normalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export function firstValue(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

export function describeRouteError(error: unknown, fallback = "Unexpected admin error.") {
  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (error && typeof error === "object") {
    const message =
      "message" in error && typeof error.message === "string" ? error.message.trim() : "";
    const details =
      "details" in error && typeof error.details === "string" ? error.details.trim() : "";
    const hint = "hint" in error && typeof error.hint === "string" ? error.hint.trim() : "";

    return [message, details, hint].filter(Boolean).join(" ").trim() || fallback;
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return fallback;
}

export async function listAllAuthUsers() {
  const admin = createServiceSupabase();
  const users: Array<{
    id: string;
    email?: string | null;
    phone?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    last_sign_in_at?: string | null;
    confirmed_at?: string | null;
    email_confirmed_at?: string | null;
    phone_confirmed_at?: string | null;
    confirmation_sent_at?: string | null;
    recovery_sent_at?: string | null;
    email_change_sent_at?: string | null;
    new_email?: string | null;
    banned_until?: string | null;
    aud?: string | null;
    role?: string | null;
    is_anonymous?: boolean | null;
    user_metadata?: Record<string, unknown> | null;
    app_metadata?: Record<string, unknown> | null;
    identities?: Array<Record<string, unknown>> | null;
    factors?: Array<Record<string, unknown>> | null;
  }> = [];

  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);

    const nextUsers = (data?.users || []).map((user) => ({
      id: user.id,
      email: user.email || null,
      phone: user.phone || null,
      created_at: user.created_at || null,
      updated_at: user.updated_at || null,
      last_sign_in_at: user.last_sign_in_at || null,
      confirmed_at: user.confirmed_at || null,
      email_confirmed_at: user.email_confirmed_at || null,
      phone_confirmed_at: user.phone_confirmed_at || null,
      confirmation_sent_at: user.confirmation_sent_at || null,
      recovery_sent_at: user.recovery_sent_at || null,
      email_change_sent_at: user.email_change_sent_at || null,
      new_email: user.new_email || null,
      banned_until: user.banned_until || null,
      aud: user.aud || null,
      role: user.role || null,
      is_anonymous: user.is_anonymous || false,
      user_metadata: user.user_metadata || null,
      app_metadata: user.app_metadata || null,
      identities: Array.isArray(user.identities)
        ? user.identities.map((identity) => ({ ...(identity as Record<string, unknown>) }))
        : null,
      factors: Array.isArray(user.factors)
        ? user.factors.map((factor) => ({ ...(factor as Record<string, unknown>) }))
        : null,
    }));
    users.push(...nextUsers);

    if (nextUsers.length < perPage) break;
    page += 1;
  }

  return users;
}
