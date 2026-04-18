"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getClientSessionWithTimeout } from "@/lib/client-session-resilience";
import { sb } from "@/lib/utils";

export function usePortalSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const session = await getClientSessionWithTimeout(sb, {
          context: "src/hooks/use-portal-session.ts",
        });

        if (!active) return;
        setUser(session?.user ?? null);
      } catch (error) {
        console.warn("Portal session bootstrap failed; rendering signed-out portal state.", error);
        if (!active) return;
        setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    void bootstrap();

    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
