import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function required(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export async function GET(_req: NextRequest) {
  const clientId = required("ZOHO_PAYMENTS_CLIENT_ID");
  const redirectUri = required("ZOHO_PAYMENTS_REDIRECT_URI");
  const soid = required("ZOHO_PAYMENTS_SOID");
  const scope =
    process.env.ZOHO_PAYMENTS_SCOPE ||
    "ZohoPay.payments.CREATE,ZohoPay.payments.READ,ZohoPay.payments.UPDATE,ZohoPay.customers.READ";

  const state = `zoho_payments_${crypto.randomUUID()}`;

  const authUrl = new URL("https://accounts.zoho.com/oauth/v2/org/auth");
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("soid", soid);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("access_type", "offline");

  const response = NextResponse.redirect(authUrl.toString());

  response.cookies.set("zoho_payments_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}