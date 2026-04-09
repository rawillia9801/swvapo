import { NextRequest, NextResponse } from "next/server";
import {
  extractZohoPaymentsAccountId,
  loadZohoPaymentsConnection,
  upsertZohoPaymentsConnection,
} from "@/lib/zoho-payments-connection";

export const runtime = "nodejs";

type ZohoTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  api_domain?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type ZohoOauthContext = {
  userId?: string | null;
  email?: string | null;
  soid?: string | null;
  scope?: string | null;
  startedAt?: string | null;
};

function required(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function buildErrorRedirect(message: string) {
  const fallback =
    process.env.ZOHO_PAYMENTS_POST_CONNECT_REDIRECT ||
    "https://portal.swvachihuahua.com/admin/portal/settings?zoho_payments=error";

  const redirectUrl = new URL(fallback);
  redirectUrl.searchParams.set("zoho_payments", "error");
  redirectUrl.searchParams.set("message", message);

  return NextResponse.redirect(redirectUrl.toString());
}

function parseJson<T>(value: string | null | undefined): T | null {
  const normalized = String(value || "").trim();
  if (!normalized) return null;

  try {
    return JSON.parse(normalized) as T;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");

    const savedState = req.cookies.get("zoho_payments_oauth_state")?.value || "";
    const oauthContext = parseJson<ZohoOauthContext>(
      req.cookies.get("zoho_payments_oauth_context")?.value
    );

    if (oauthError) {
      return buildErrorRedirect(oauthError);
    }

    if (!code) {
      return buildErrorRedirect("Missing authorization code.");
    }

    if (!state || !savedState || state !== savedState) {
      return buildErrorRedirect("Invalid OAuth state.");
    }

    const clientId = required("ZOHO_PAYMENTS_CLIENT_ID");
    const clientSecret = required("ZOHO_PAYMENTS_CLIENT_SECRET");
    const redirectUri = required("ZOHO_PAYMENTS_REDIRECT_URI");

    const tokenBody = new URLSearchParams();
    tokenBody.set("code", code);
    tokenBody.set("client_id", clientId);
    tokenBody.set("client_secret", clientSecret);
    tokenBody.set("redirect_uri", redirectUri);
    tokenBody.set("grant_type", "authorization_code");

    const tokenResponse = await fetch("https://accounts.zoho.com/oauth/v2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenBody.toString(),
      cache: "no-store",
    });

    const tokenJson = (await tokenResponse.json()) as ZohoTokenResponse;

    if (!tokenResponse.ok || !tokenJson.access_token) {
      const message =
        tokenJson.error_description ||
        tokenJson.error ||
        "Failed to exchange authorization code.";
      return buildErrorRedirect(message);
    }

    const postConnectRedirect =
      process.env.ZOHO_PAYMENTS_POST_CONNECT_REDIRECT ||
      "https://portal.swvachihuahua.com/admin/portal/settings?zoho_payments=connected";
    const successRedirectUrl = new URL(postConnectRedirect);
    successRedirectUrl.searchParams.set("zoho_payments", "connected");

    const existingConnection = await loadZohoPaymentsConnection();
    const refreshToken =
      tokenJson.refresh_token || existingConnection?.refresh_token || "";

    if (!refreshToken) {
      return buildErrorRedirect(
        "Zoho did not return a refresh token. Please reconnect with offline access enabled."
      );
    }

    const soid =
      process.env.ZOHO_PAYMENTS_SOID ||
      oauthContext?.soid ||
      existingConnection?.soid ||
      "";
    const accountId =
      extractZohoPaymentsAccountId(process.env.ZOHO_PAYMENTS_ACCOUNT_ID) ||
      extractZohoPaymentsAccountId(soid) ||
      extractZohoPaymentsAccountId(existingConnection?.account_id) ||
      extractZohoPaymentsAccountId(existingConnection?.soid);

    if (!accountId) {
      return buildErrorRedirect(
        "Zoho Payments account id is missing. Add ZOHO_PAYMENTS_ACCOUNT_ID or ZOHO_PAYMENTS_SOID."
      );
    }

    await upsertZohoPaymentsConnection({
      status: "connected",
      accountId,
      soid: soid || null,
      scope:
        process.env.ZOHO_PAYMENTS_SCOPE ||
        oauthContext?.scope ||
        existingConnection?.scope ||
        null,
      apiDomain: tokenJson.api_domain || existingConnection?.api_domain || null,
      refreshToken,
      tokenType: tokenJson.token_type || existingConnection?.token_type || "Zoho-oauthtoken",
      connectedAt: existingConnection?.connected_at || new Date().toISOString(),
      lastRefreshedAt: new Date().toISOString(),
      connectedByUserId:
        oauthContext?.userId || existingConnection?.connected_by_user_id || null,
      connectedByEmail:
        oauthContext?.email || existingConnection?.connected_by_email || null,
      meta: {
        source: "oauth_callback",
        redirect_uri: redirectUri,
        started_at: oauthContext?.startedAt || null,
      },
    });

    const response = NextResponse.redirect(successRedirectUrl);

    response.cookies.delete("zoho_payments_oauth_state");
    response.cookies.delete("zoho_payments_oauth_context");
    response.cookies.delete("zoho_payments_access_token");
    response.cookies.delete("zoho_payments_refresh_token");
    response.cookies.delete("zoho_payments_access_token_expires_at");
    response.cookies.delete("zoho_payments_api_domain");
    response.cookies.delete("zoho_payments_connected");

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Zoho Payments callback failed.";
    return buildErrorRedirect(message);
  }
}
