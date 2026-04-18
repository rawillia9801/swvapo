"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getClientSessionWithTimeout } from "@/lib/client-session-resilience";
import { isPortalAdminEmail } from "@/lib/portal-admin";
import { sb } from "@/lib/utils";

export type PortalAdminSessionState = {
  user: User | null;
  accessToken: string;
  loading: boolean;
  isAdmin: boolean;
};

type SessionCache = {
  initialized: boolean;
  user: User | null;
  accessToken: string;
};

const sessionCache: SessionCache = {
  initialized: false,
  user: null,
  accessToken: "",
};

function updateSessionCache(user: User | null, accessToken: string) {
  sessionCache.initialized = true;
  sessionCache.user = user;
  sessionCache.accessToken = accessToken;
}

export function usePortalAdminSession(): PortalAdminSessionState {
  const [user, setUser] = useState<User | null>(sessionCache.initialized ? sessionCache.user : null);
  const [accessToken, setAccessToken] = useState(sessionCache.initialized ? sessionCache.accessToken : "");
  const [loading, setLoading] = useState(!sessionCache.initialized);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      if (sessionCache.initialized) {
        setUser(sessionCache.user);
        setAccessToken(sessionCache.accessToken);
        setLoading(false);
        return;
      }

      try {
        const session = await getClientSessionWithTimeout(sb, {
          context: "src/lib/use-portal-admin-session.ts",
        });

        if (!mounted) return;
        updateSessionCache(session?.user ?? null, session?.access_token || "");
        setUser(sessionCache.user);
        setAccessToken(sessionCache.accessToken);
      } catch (error) {
        console.warn("Admin session bootstrap failed; rendering signed-out admin state.", error);
        if (!mounted) return;
        updateSessionCache(null, "");
        setUser(null);
        setAccessToken("");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void bootstrap();

    const { data: authListener } = sb.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      updateSessionCache(session?.user ?? null, session?.access_token || "");
      setUser(sessionCache.user);
      setAccessToken(sessionCache.accessToken);
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
