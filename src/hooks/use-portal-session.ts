"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { sb } from "@/lib/utils";

export function usePortalSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const {
        data: { session },
      } = await sb.auth.getSession();

      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
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
