import { NextResponse } from "next/server";
import { describeRouteError, verifyOwner } from "@/lib/admin-api";
import {
  extractZohoPaymentsAccountId,
  loadZohoPaymentsConnection,
} from "@/lib/zoho-payments-connection";
import {
  getZohoPaymentsWidgetApiKey,
  hasZohoPaymentsSigningKey,
  isZohoPaymentsConfigured,
} from "@/lib/zoho-payments";

export const runtime = "nodejs";

function yes(value: string | null | undefined) {
  return Boolean(String(value || "").trim());
}

export async function GET(req: Request) {
  const owner = await verifyOwner(req);
  if (!owner) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const connection = await loadZohoPaymentsConnection();
    const accountId =
      extractZohoPaymentsAccountId(process.env.ZOHO_PAYMENTS_ACCOUNT_ID) ||
      extractZohoPaymentsAccountId(process.env.ZOHO_PAYMENTS_SOID) ||
      extractZohoPaymentsAccountId(connection?.account_id) ||
      extractZohoPaymentsAccountId(connection?.soid);
    const envRefreshToken = yes(process.env.ZOHO_PAYMENTS_REFRESH_TOKEN);
    const storedRefreshToken = yes(connection?.refresh_token);
    const missingOauthEnv = [
      yes(process.env.ZOHO_PAYMENTS_CLIENT_ID) ? null : "ZOHO_PAYMENTS_CLIENT_ID",
      yes(process.env.ZOHO_PAYMENTS_CLIENT_SECRET) ? null : "ZOHO_PAYMENTS_CLIENT_SECRET",
      yes(process.env.ZOHO_PAYMENTS_REDIRECT_URI) ? null : "ZOHO_PAYMENTS_REDIRECT_URI",
      yes(process.env.ZOHO_PAYMENTS_SOID) ? null : "ZOHO_PAYMENTS_SOID",
    ].filter(Boolean) as string[];

    return NextResponse.json({
      ok: true,
      provider: "zoho_payments",
      connected: storedRefreshToken || envRefreshToken,
      configured: await isZohoPaymentsConfigured(),
      connection_source: storedRefreshToken ? "database" : envRefreshToken ? "env" : "none",
      oauth_ready: missingOauthEnv.length === 0,
      missing_oauth_env: missingOauthEnv,
      account_id: accountId || null,
      soid: process.env.ZOHO_PAYMENTS_SOID || connection?.soid || null,
      scope: process.env.ZOHO_PAYMENTS_SCOPE || connection?.scope || null,
      connected_at: connection?.connected_at || null,
      connected_by_email: connection?.connected_by_email || null,
      api_domain: connection?.api_domain || null,
      token_type: connection?.token_type || null,
      has_widget_key: Boolean(getZohoPaymentsWidgetApiKey()),
      has_signing_key: hasZohoPaymentsSigningKey(),
      has_return_url: yes(process.env.ZOHO_PAYMENTS_RETURN_URL),
      redirect_uri: process.env.ZOHO_PAYMENTS_REDIRECT_URI || null,
      post_connect_redirect:
        process.env.ZOHO_PAYMENTS_POST_CONNECT_REDIRECT || null,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: describeRouteError(error, "Could not load Zoho Payments status.") },
      { status: 500 }
    );
  }
}
