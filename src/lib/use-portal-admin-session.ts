"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { isPortalAdminEmail } from "@/lib/portal-admin";
import { sb } from "@/lib/utils";

export type PortalAdminSessionState = {
  user: User | null;
  accessToken: string;
  loading: boolean;
  isAdmin: boolean;
};

export function usePortalAdminSession(): PortalAdminSessionState {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const {
          data: { session },
        } = await sb.auth.getSession();

        if (!mounted) return;
        setUser(session?.user ?? null);
        setAccessToken(session?.access_token || "");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void bootstrap();

    const { data: authListener } = sb.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setAccessToken(session?.access_token || "");
      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    accessToken,
    loading,
    isAdmin: isPortalAdminEmail(user?.email),
  };
}
