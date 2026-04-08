import "server-only";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function getBearerToken(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return null;
}

export function createAnonSupabase(): SupabaseClient {
  return createClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

export function createServiceSupabase(): SupabaseClient {
  return createClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

export async function verifyPortalUser(req: Request): Promise<{ user: User | null }> {
  const accessToken = getBearerToken(req);
  if (!accessToken) return { user: null };

  const anon = createAnonSupabase();
  const { data, error } = await anon.auth.getUser(accessToken);

  if (error || !data.user) {
    return { user: null };
  }

  return { user: data.user };
}
