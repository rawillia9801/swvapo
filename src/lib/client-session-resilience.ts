"use client";

import type { Session, SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_SESSION_BOOTSTRAP_TIMEOUT_MS = 1800;

export async function getClientSessionWithTimeout(
  client: SupabaseClient,
  options: { context?: string; timeoutMs?: number } = {}
): Promise<Session | null> {
  const timeoutMs = options.timeoutMs || DEFAULT_SESSION_BOOTSTRAP_TIMEOUT_MS;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let timedOut = false;

  try {
    const result = await Promise.race([
      client.auth.getSession(),
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => {
          timedOut = true;
          resolve(null);
        }, timeoutMs);
      }),
    ]);

    if (!result) {
      console.warn(
        `[auth-resilience] ${options.context || "client session bootstrap"} timed out after ${timeoutMs}ms; rendering signed-out state.`
      );
      return null;
    }

    return result.data.session ?? null;
  } catch (error) {
    console.warn(
      `[auth-resilience] ${options.context || "client session bootstrap"} failed; rendering signed-out state.`,
      error
    );
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (timedOut && options.context) {
      console.warn(`[auth-resilience] ${options.context} session lookup did not complete before timeout.`);
    }
  }
}

