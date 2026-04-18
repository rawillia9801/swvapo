import "server-only";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import {
  getBearerToken,
  resolveSupabaseUserFromRequest,
} from "@/lib/supabase-auth-resilience";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export { getBearerToken };

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
  const { user } = await resolveSupabaseUserFromRequest(req, createAnonSupabase, {
    context: "src/lib/portal-api.ts:verifyPortalUser",
  });
  return { user };
}
