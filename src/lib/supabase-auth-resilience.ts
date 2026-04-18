import "server-only";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";

const DEFAULT_AUTH_TIMEOUT_MS = 1800;
const AUTH_CACHE_TTL_MS = 30_000;

type AuthSource = "local-jwt" | "supabase-auth" | "none";

export type AuthResolutionReason =
  | "missing-token"
  | "malformed-bearer"
  | "malformed-token"
  | "unsupported-algorithm"
  | "missing-jwt-secret"
  | "expired-token"
  | "invalid-signature"
  | "invalid-claims"
  | "auth-timeout"
  | "auth-error"
  | "verified";

export type SupabaseAuthResolution = {
  user: User | null;
  source: AuthSource;
  reason: AuthResolutionReason;
  timedOut: boolean;
  error: string | null;
};

type SupabaseJwtClaims = {
  sub?: unknown;
  aud?: unknown;
  role?: unknown;
  email?: unknown;
  phone?: unknown;
  exp?: unknown;
  iat?: unknown;
  app_metadata?: unknown;
  user_metadata?: unknown;
};

type CachedAuthResolution = {
  expiresAt: number;
  resolution: SupabaseAuthResolution;
};

const authCache = new Map<string, CachedAuthResolution>();

function authTimeoutMs() {
  const configured = Number(process.env.SUPABASE_AUTH_USER_TIMEOUT_MS || "");
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_AUTH_TIMEOUT_MS;
}

function base64UrlToBuffer(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

function base64UrlDecodeJson(value: string): Record<string, unknown> | null {
  try {
    const decoded = base64UrlToBuffer(value).toString("utf8");
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function base64UrlEncode(buffer: Buffer) {
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function tokenCacheKey(accessToken: string) {
  return createHash("sha256").update(accessToken).digest("hex");
}

function cloneResolution(resolution: SupabaseAuthResolution): SupabaseAuthResolution {
  return { ...resolution };
}

function cacheResolution(accessToken: string, resolution: SupabaseAuthResolution) {
  if (!resolution.user) return;
  authCache.set(tokenCacheKey(accessToken), {
    expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
    resolution: cloneResolution(resolution),
  });
}

function readCachedResolution(accessToken: string): SupabaseAuthResolution | null {
  const key = tokenCacheKey(accessToken);
  const cached = authCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    authCache.delete(key);
    return null;
  }
  return cloneResolution(cached.resolution);
}

function unauthorized(reason: AuthResolutionReason, error: string | null = null): SupabaseAuthResolution {
  return {
    user: null,
    source: "none",
    reason,
    timedOut: reason === "auth-timeout",
    error,
  };
}

function logAuthResolution(context: string | undefined, resolution: SupabaseAuthResolution) {
  if (!context) return;

  const status = resolution.user ? "succeeded" : "failed";
  const detail = resolution.error ? ` (${resolution.error})` : "";
  const message = `[auth-resilience] ${context} ${status}: ${resolution.reason} via ${resolution.source}${detail}`;

  if (resolution.user) {
    console.info(message);
  } else {
    console.warn(message);
  }
}

export function normalizeAccessToken(accessToken: string | null | undefined) {
  const token = String(accessToken || "").trim();
  if (!token) {
    return { token: null, reason: "missing-token" as const };
  }

  if (/\s/.test(token)) {
    return { token: null, reason: "malformed-bearer" as const };
  }

  return { token, reason: null };
}

export function readBearerToken(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader) {
    return { token: null, reason: "missing-token" as const };
  }

  const [scheme, ...rest] = authHeader.trim().split(/\s+/);
  if (scheme.toLowerCase() !== "bearer" || rest.length !== 1 || !rest[0]) {
    return { token: null, reason: "malformed-bearer" as const };
  }

  return normalizeAccessToken(rest[0]);
}

export function getBearerToken(req: Request) {
  return readBearerToken(req).token;
}

function buildUserFromClaims(claims: SupabaseJwtClaims): User | null {
  if (typeof claims.sub !== "string" || !claims.sub.trim()) return null;

  return {
    id: claims.sub,
    aud: typeof claims.aud === "string" ? claims.aud : "authenticated",
    role: typeof claims.role === "string" ? claims.role : "authenticated",
    email: typeof claims.email === "string" ? claims.email : undefined,
    phone: typeof claims.phone === "string" ? claims.phone : undefined,
    app_metadata: isRecord(claims.app_metadata) ? claims.app_metadata : {},
    user_metadata: isRecord(claims.user_metadata) ? claims.user_metadata : {},
    identities: [],
    factors: null,
    created_at: "",
    updated_at: "",
    last_sign_in_at: undefined,
  } as User;
}

function verifyJwtLocally(accessToken: string): SupabaseAuthResolution {
  const parts = accessToken.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    return unauthorized("malformed-token", "Access token is not a valid JWT.");
  }

  const header = base64UrlDecodeJson(parts[0]);
  const claims = base64UrlDecodeJson(parts[1]) as SupabaseJwtClaims | null;
  if (!header || !claims) {
    return unauthorized("malformed-token", "Access token could not be decoded.");
  }

  if (header.alg !== "HS256") {
    return unauthorized("unsupported-algorithm", "Only HS256 Supabase access tokens are supported.");
  }

  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    return unauthorized("missing-jwt-secret", "SUPABASE_JWT_SECRET is not configured.");
  }

  const expectedSignature = base64UrlEncode(
    createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest()
  );

  const provided = Buffer.from(parts[2]);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return unauthorized("invalid-signature", "Access token signature did not match.");
  }

  if (typeof claims.exp === "number" && claims.exp <= Math.floor(Date.now() / 1000)) {
    return unauthorized("expired-token", "Access token has expired.");
  }

  const user = buildUserFromClaims(claims);
  if (!user) {
    return unauthorized("invalid-claims", "Access token is missing required user claims.");
  }

  return {
    user,
    source: "local-jwt",
    reason: "verified",
    timedOut: false,
    error: null,
  };
}

function canFallbackToSupabaseAuth(localResolution: SupabaseAuthResolution) {
  return localResolution.reason === "missing-jwt-secret";
}

async function getUserFromSupabaseAuth(
  accessToken: string,
  createAnonSupabase: () => SupabaseClient,
  timeoutMs: number
): Promise<SupabaseAuthResolution> {
  const anon = createAnonSupabase();

  let settled = false;
  const authRequest = anon.auth
    .getUser(accessToken)
    .then(({ data, error }) => {
      settled = true;
      if (error || !data.user) {
        return unauthorized("auth-error", error?.message || "Supabase Auth did not return a user.");
      }

      return {
        user: data.user,
        source: "supabase-auth" as const,
        reason: "verified" as const,
        timedOut: false,
        error: null,
      };
    })
    .catch((error: unknown) => {
      settled = true;
      return unauthorized(
        "auth-error",
        error instanceof Error ? error.message : "Supabase Auth user lookup failed."
      );
    });

  const timeout = new Promise<SupabaseAuthResolution>((resolve) => {
    setTimeout(() => {
      if (!settled) {
        resolve(unauthorized("auth-timeout", `Supabase Auth user lookup exceeded ${timeoutMs}ms.`));
      }
    }, timeoutMs);
  });

  return Promise.race([authRequest, timeout]);
}

export async function resolveSupabaseUserFromAccessToken(
  accessToken: string | null | undefined,
  createAnonSupabase: () => SupabaseClient,
  options: { timeoutMs?: number; context?: string } = {}
): Promise<SupabaseAuthResolution> {
  const normalized = normalizeAccessToken(accessToken);
  if (!normalized.token) {
    const result = unauthorized(normalized.reason);
    logAuthResolution(options.context, result);
    return result;
  }

  const token = normalized.token;

  const cached = readCachedResolution(token);
  if (cached) {
    logAuthResolution(options.context, cached);
    return cached;
  }

  const localResolution = verifyJwtLocally(token);
  if (localResolution.user) {
    cacheResolution(token, localResolution);
    logAuthResolution(options.context, localResolution);
    return localResolution;
  }

  if (!canFallbackToSupabaseAuth(localResolution)) {
    logAuthResolution(options.context, localResolution);
    return localResolution;
  }

  if (options.context) {
    console.warn(
      `[auth-resilience] ${options.context} is falling back to Supabase Auth /user because SUPABASE_JWT_SECRET is not configured.`
    );
  }

  const authResolution = await getUserFromSupabaseAuth(
    token,
    createAnonSupabase,
    options.timeoutMs || authTimeoutMs()
  );
  logAuthResolution(options.context, authResolution);
  cacheResolution(token, authResolution);
  return authResolution;
}

export async function resolveSupabaseUserFromRequest(
  req: Request,
  createAnonSupabase: () => SupabaseClient,
  options: { timeoutMs?: number; context?: string } = {}
): Promise<SupabaseAuthResolution> {
  const bearer = readBearerToken(req);
  if (!bearer.token) {
    const result = unauthorized(bearer.reason);
    logAuthResolution(options.context, result);
    return result;
  }

  return resolveSupabaseUserFromAccessToken(bearer.token, createAnonSupabase, options);
}
