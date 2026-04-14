type ZohoRefreshResponse = {
  access_token?: string;
  api_domain?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type CachedToken = {
  accessToken: string;
  apiDomain: string;
  tokenType: string;
  expiresAt: number;
};

let cachedToken: CachedToken | null = null;

function getRequiredEnv(name: string, fallback?: string) {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (fallback) return fallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

function buildFormBody(params: Record<string, string>) {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    form.set(key, value);
  }
  return form.toString();
}

function isTokenFresh(token: CachedToken | null) {
  if (!token) return false;

  const now = Date.now();
  const safetyWindowMs = 60_000;
  return token.expiresAt - safetyWindowMs > now;
}

export async function getZohoAccessToken() {
  if (isTokenFresh(cachedToken)) {
    return cachedToken!;
  }

  const accountsDomain = getRequiredEnv(
    "ZOHO_ACCOUNTS_DOMAIN",
    "https://accounts.zoho.com"
  );
  const fallbackApiDomain = getRequiredEnv(
    "ZOHO_API_DOMAIN",
    "https://www.zohoapis.com"
  );
  const clientId = getRequiredEnv("ZOHO_CLIENT_ID");
  const clientSecret = getRequiredEnv("ZOHO_CLIENT_SECRET");
  const refreshToken = getRequiredEnv("ZOHO_REFRESH_TOKEN");

  const response = await fetch(`${accountsDomain}/oauth/v2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: buildFormBody({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });

  const raw = await response.text();

  let data: ZohoRefreshResponse;
  try {
    data = JSON.parse(raw) as ZohoRefreshResponse;
  } catch {
    throw new Error(`Zoho refresh token response was not valid JSON: ${raw}`);
  }

  if (!response.ok || data.error || !data.access_token) {
    const reason =
      data.error_description || data.error || raw || "Unknown Zoho token error";
    throw new Error(`Failed to refresh Zoho access token: ${reason}`);
  }

  const nextToken: CachedToken = {
    accessToken: data.access_token,
    apiDomain: (data.api_domain || fallbackApiDomain).replace(/\/+$/, ""),
    tokenType: data.token_type || "Bearer",
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };

  cachedToken = nextToken;
  return nextToken;
}

export async function getZohoAuthHeaders() {
  const token = await getZohoAccessToken();

  return {
    Authorization: `Zoho-oauthtoken ${token.accessToken}`,
  };
}

export async function zohoFetch(
  pathOrUrl: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = await getZohoAccessToken();

  const url = /^https?:\/\//i.test(pathOrUrl)
    ? pathOrUrl
    : `${token.apiDomain}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;

  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Zoho-oauthtoken ${token.accessToken}`);

  return fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });
}

export async function getZohoRuntimeStatus() {
  const token = await getZohoAccessToken();

  return {
    accountsDomain: getRequiredEnv(
      "ZOHO_ACCOUNTS_DOMAIN",
      "https://accounts.zoho.com"
    ),
    apiDomain: token.apiDomain,
    tokenType: token.tokenType,
    expiresAt: token.expiresAt,
    hasClientId: Boolean(process.env.ZOHO_CLIENT_ID?.trim()),
    hasClientSecret: Boolean(process.env.ZOHO_CLIENT_SECRET?.trim()),
    hasRefreshToken: Boolean(process.env.ZOHO_REFRESH_TOKEN?.trim()),
    hasRedirectUri: Boolean(process.env.ZOHO_REDIRECT_URI?.trim()),
    hasSignOrgId: Boolean(process.env.ZOHO_SIGN_ORG_ID?.trim()),
    hasWebhookSecret: Boolean(process.env.ZOHO_SIGN_WEBHOOK_SECRET?.trim()),
    hasDepositTemplate: Boolean(
      process.env.ZOHO_WRITER_TEMPLATE_DEPOSIT_AGREEMENT?.trim()
    ),
    hasBillOfSaleTemplate: Boolean(
      process.env.ZOHO_WRITER_TEMPLATE_BILL_OF_SALE?.trim()
    ),
    hasHealthGuaranteeTemplate: Boolean(
      process.env.ZOHO_WRITER_TEMPLATE_HEALTH_GUARANTEE?.trim()
    ),
    hasFinancingAddendumTemplate: Boolean(
      process.env.ZOHO_WRITER_TEMPLATE_FINANCING_ADDENDUM?.trim()
    ),
  };
}