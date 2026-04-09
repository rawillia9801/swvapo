import { NextRequest, NextResponse } from "next/server";

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

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");

    const savedState = req.cookies.get("zoho_payments_oauth_state")?.value || "";

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

    const response = NextResponse.redirect(postConnectRedirect);

    const expiresIn = Number(tokenJson.expires_in || 3600);
    const refreshMaxAge = 60 * 60 * 24 * 365;

    response.cookies.set("zoho_payments_access_token", tokenJson.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: expiresIn,
    });

    if (tokenJson.refresh_token) {
      response.cookies.set("zoho_payments_refresh_token", tokenJson.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: refreshMaxAge,
      });
    }

    response.cookies.set(
      "zoho_payments_access_token_expires_at",
      String(Date.now() + expiresIn * 1000),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: refreshMaxAge,
      },
    );

    if (tokenJson.api_domain) {
      response.cookies.set("zoho_payments_api_domain", tokenJson.api_domain, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: refreshMaxAge,
      });
    }

    response.cookies.set("zoho_payments_connected", "yes", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: refreshMaxAge,
    });

    response.cookies.delete("zoho_payments_oauth_state");

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Zoho Payments callback failed.";
    return buildErrorRedirect(message);
  }
}