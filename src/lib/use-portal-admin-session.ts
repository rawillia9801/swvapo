"use client";

import { useEffect, useRef, useState } from "react";
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
  sessionCache.initialized = Boolean(user && accessToken);
  sessionCache.user = user;
  sessionCache.accessToken = accessToken;
}

function sessionKey(user: User | null, accessToken: string) {
  return [user?.id || "", user?.email || "", accessToken || ""].join("|");
}

export function usePortalAdminSession(): PortalAdminSessionState {
  const [user, setUser] = useState<User | null>(sessionCache.initialized ? sessionCache.user : null);
  const [accessToken, setAccessToken] = useState(sessionCache.initialized ? sessionCache.accessToken : "");
  const [loading, setLoading] = useState(!sessionCache.initialized);
  const sessionKeyRef = useRef(sessionKey(sessionCache.user, sessionCache.accessToken));

  useEffect(() => {
    let mounted = true;

    function commitSession(nextUser: User | null, nextAccessToken: string) {
      const nextKey = sessionKey(nextUser, nextAccessToken);
      if (sessionKeyRef.current === nextKey) {
        if (mounted) setLoading(false);
        return;
      }

      sessionKeyRef.current = nextKey;
      updateSessionCache(nextUser, nextAccessToken);
      setUser(nextUser);
      setAccessToken(nextAccessToken);
      setLoading(false);
    }

    async function bootstrap() {
      if (sessionCache.initialized) {
        commitSession(sessionCache.user, sessionCache.accessToken);
        return;
      }

      try {
        const session = await getClientSessionWithTimeout(sb, {
          context: "src/lib/use-portal-admin-session.ts",
          timeoutMs: 6000,
        });

        if (!mounted) return;
        commitSession(session?.user ?? null, session?.access_token || "");
      } catch (error) {
        console.warn("Admin session bootstrap failed; rendering signed-out admin state.", error);
        if (!mounted) return;
        commitSession(null, "");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void bootstrap();

    const { data: authListener } = sb.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      commitSession(session?.user ?? null, session?.access_token || "");
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
