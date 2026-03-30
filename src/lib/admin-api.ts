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

export async function listAllAuthUsers() {
  const admin = createServiceSupabase();
  const users: Array<{
    id: string;
    email?: string | null;
    phone?: string | null;
    created_at?: string | null;
    last_sign_in_at?: string | null;
    user_metadata?: Record<string, unknown> | null;
  }> = [];

  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);

    const nextUsers = data?.users || [];
    users.push(...nextUsers);

    if (nextUsers.length < perPage) break;
    page += 1;
  }

  return users;
}
