import "server-only";
import { createServiceSupabase } from "@/lib/admin-api";

const ZOHO_PROVIDER = "zoho_payments";

export type ZohoPaymentsConnectionRecord = {
  provider: string;
  created_at: string;
  updated_at: string;
  connected_at: string | null;
  last_refreshed_at: string | null;
  status: "connected" | "disconnected" | "error";
  account_id: string | null;
  soid: string | null;
  scope: string | null;
  api_domain: string | null;
  refresh_token: string | null;
  token_type: string | null;
  connected_by_user_id: string | null;
  connected_by_email: string | null;
  meta: Record<string, unknown> | null;
};

type UpsertZohoPaymentsConnectionInput = {
  status?: "connected" | "disconnected" | "error";
  accountId?: string | null;
  soid?: string | null;
  scope?: string | null;
  apiDomain?: string | null;
  refreshToken?: string | null;
  tokenType?: string | null;
  connectedAt?: string | null;
  lastRefreshedAt?: string | null;
  connectedByUserId?: string | null;
  connectedByEmail?: string | null;
  meta?: Record<string, unknown> | null;
};

function isMissingTableError(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error || "")).toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("schema cache")
  );
}

export function extractZohoPaymentsAccountId(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";

  if (/^\d+$/.test(normalized)) {
    return normalized;
  }

  const soidMatch = normalized.match(/^zohopay\.(\d+)$/i);
  if (soidMatch?.[1]) {
    return soidMatch[1];
  }

  return "";
}

export async function loadZohoPaymentsConnection() {
  try {
    const admin = createServiceSupabase();
    const { data, error } = await admin
      .from("integration_credentials")
      .select("*")
      .eq("provider", ZOHO_PROVIDER)
      .maybeSingle<ZohoPaymentsConnectionRecord>();

    if (error) {
      if (isMissingTableError(error)) return null;
      throw new Error(error.message);
    }

    return data || null;
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

export async function upsertZohoPaymentsConnection(input: UpsertZohoPaymentsConnectionInput) {
  try {
    const admin = createServiceSupabase();
    const now = new Date().toISOString();
    const payload = {
      provider: ZOHO_PROVIDER,
      status: input.status || "connected",
      account_id: input.accountId || null,
      soid: input.soid || null,
      scope: input.scope || null,
      api_domain: input.apiDomain || null,
      refresh_token: input.refreshToken || null,
      token_type: input.tokenType || null,
      connected_at:
        input.status === "connected"
          ? input.connectedAt || now
          : input.connectedAt === null
            ? null
            : input.connectedAt || null,
      last_refreshed_at: input.lastRefreshedAt || null,
      connected_by_user_id: input.connectedByUserId || null,
      connected_by_email: input.connectedByEmail || null,
      meta: input.meta || {},
    };

    const { error } = await admin.from("integration_credentials").upsert(payload, {
      onConflict: "provider",
    });

    if (error) {
      if (isMissingTableError(error)) {
        throw new Error(
          "Zoho integration storage is not available yet. Apply the Supabase migration 20260408_zoho_integration_credentials.sql first."
        );
      }

      throw new Error(error.message);
    }
  } catch (error) {
    if (isMissingTableError(error)) {
      throw new Error(
        "Zoho integration storage is not available yet. Apply the Supabase migration 20260408_zoho_integration_credentials.sql first."
      );
    }

    throw error;
  }
}

export async function clearZohoPaymentsConnection() {
  const existing = await loadZohoPaymentsConnection();
  if (!existing) return;

  await upsertZohoPaymentsConnection({
    status: "disconnected",
    accountId: existing.account_id,
    soid: existing.soid,
    scope: existing.scope,
    apiDomain: existing.api_domain,
    refreshToken: null,
    tokenType: existing.token_type,
    connectedAt: null,
    lastRefreshedAt: existing.last_refreshed_at,
    connectedByUserId: existing.connected_by_user_id,
    connectedByEmail: existing.connected_by_email,
    meta: existing.meta || {},
  });
}
