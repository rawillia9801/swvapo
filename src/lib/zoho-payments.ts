type ZohoAllowedPaymentMethod = "ach_debit" | "apple_pay" | "card";

type ZohoPaymentsConfig = {
  accountId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accountsBaseUrl: string;
  apiBaseUrl: string;
  defaultReturnUrl: string | null;
  defaultAllowedPaymentMethods: ZohoAllowedPaymentMethod[];
};

type ZohoApiResponse = {
  code?: number;
  message?: string;
};

export type ZohoCustomerListItem = {
  customer_id: string;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_status?: string | null;
  created_time?: number | null;
  last_modified_time?: number | null;
};

export type ZohoPaymentListItem = {
  payment_id: string;
  amount?: string | null;
  currency?: string | null;
  receipt_email?: string | null;
  reference_number?: string | null;
  description?: string | null;
  status?: string | null;
  date?: number | null;
  payment_method?: {
    type?: string | null;
  } | null;
};

export type ZohoPaymentLink = {
  payment_link_id: string;
  url: string;
  expires_at?: string | null;
  amount?: string | null;
  amount_paid?: string | null;
  currency?: string | null;
  status?: string | null;
  email?: string | null;
  reference_id?: string | null;
  description?: string | null;
  return_url?: string | null;
  phone?: string | null;
  created_time?: number | null;
  configurations?: {
    allowed_payment_methods?: ZohoAllowedPaymentMethod[] | null;
  } | null;
  payments?: Array<{
    payment_id?: string | null;
    amount?: string | null;
    status?: string | null;
    date?: number | null;
  }> | null;
};

type CreateZohoPaymentLinkInput = {
  amount: number;
  currency?: string | null;
  email?: string | null;
  phone?: string | null;
  description: string;
  referenceId?: string | null;
  expiresAt?: string | null;
  sendEmail?: boolean | null;
  returnUrl?: string | null;
  paymentMethods?: ZohoAllowedPaymentMethod[] | null;
};

function readOptionalEnv(...names: string[]) {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) return value;
  }
  return "";
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/g, "");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function cleanAllowedPaymentMethods(value: string): ZohoAllowedPaymentMethod[] {
  const methods = Array.from(
    new Set(
      String(value || "")
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter((item): item is ZohoAllowedPaymentMethod =>
          item === "ach_debit" || item === "apple_pay" || item === "card"
        )
    )
  );

  return methods.length ? methods : ["card", "ach_debit"];
}

function getZohoPaymentsConfig(): ZohoPaymentsConfig | null {
  const accountId = readOptionalEnv("ZOHO_PAYMENTS_ACCOUNT_ID");
  const clientId = readOptionalEnv("ZOHO_PAYMENTS_CLIENT_ID");
  const clientSecret = readOptionalEnv("ZOHO_PAYMENTS_CLIENT_SECRET");
  const refreshToken = readOptionalEnv("ZOHO_PAYMENTS_REFRESH_TOKEN");

  if (!(accountId && clientId && clientSecret && refreshToken)) {
    return null;
  }

  return {
    accountId,
    clientId,
    clientSecret,
    refreshToken,
    accountsBaseUrl: trimTrailingSlash(
      readOptionalEnv("ZOHO_PAYMENTS_ACCOUNTS_BASE_URL") || "https://accounts.zoho.com"
    ),
    apiBaseUrl: trimTrailingSlash(
      readOptionalEnv("ZOHO_PAYMENTS_API_BASE_URL") || "https://payments.zoho.com/api/v1"
    ),
    defaultReturnUrl: readOptionalEnv("ZOHO_PAYMENTS_RETURN_URL") || null,
    defaultAllowedPaymentMethods: cleanAllowedPaymentMethods(
      readOptionalEnv("ZOHO_PAYMENTS_ALLOWED_METHODS")
    ),
  };
}

function ensureZohoPaymentsConfig(): ZohoPaymentsConfig {
  const config = getZohoPaymentsConfig();
  if (!config) {
    throw new Error(
      "Zoho Payments is not configured. Add ZOHO_PAYMENTS_ACCOUNT_ID, ZOHO_PAYMENTS_CLIENT_ID, ZOHO_PAYMENTS_CLIENT_SECRET, and ZOHO_PAYMENTS_REFRESH_TOKEN."
    );
  }
  return config;
}

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function getZohoPaymentsAccessToken(config: ZohoPaymentsConfig) {
  const body = new URLSearchParams({
    refresh_token: config.refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
  });

  const response = await fetch(`${config.accountsBaseUrl}/oauth/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const text = await response.text();
  const payload = parseJson<{ access_token?: string; error?: string; error_description?: string }>(
    text
  );

  if (!response.ok || !payload?.access_token) {
    const detail =
      payload?.error_description || payload?.error || payload?.access_token || text || "Unknown error";
    throw new Error(`Zoho Payments OAuth refresh failed: ${detail}`);
  }

  return payload.access_token;
}

async function zohoPaymentsRequest<T extends ZohoApiResponse>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
    query?: Record<string, string | number | boolean | null | undefined>;
  } = {}
) {
  const config = ensureZohoPaymentsConfig();
  const accessToken = await getZohoPaymentsAccessToken(config);
  const url = new URL(
    path.startsWith("/") ? `${config.apiBaseUrl}${path}` : `${config.apiBaseUrl}/${path}`
  );

  url.searchParams.set("account_id", config.accountId);
  for (const [key, value] of Object.entries(options.query || {})) {
    if (value === null || value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    method: options.method || "GET",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const payload = parseJson<T>(text);

  if (!response.ok || !payload) {
    const detail = payload?.message || text || "Unknown error";
    throw new Error(`Zoho Payments request failed: ${detail}`);
  }

  return payload;
}

function matchesQuery(values: unknown[], query: string) {
  if (!query) return true;
  const haystack = values
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  return haystack.includes(query);
}

export function isZohoPaymentsConfigured() {
  return !!getZohoPaymentsConfig();
}

export async function listZohoCustomers(params: { query?: string | null; limit?: number | null } = {}) {
  const limit = clamp(Number(params.limit || 12) || 12, 1, 50);
  const payload = await zohoPaymentsRequest<{ customers?: ZohoCustomerListItem[] }>(
    "/customers",
    {
      query: {
        per_page: clamp(Math.max(limit * 4, 25), 25, 200),
      },
    }
  );

  const query = String(params.query || "").trim().toLowerCase();
  return (payload.customers || [])
    .filter((row) =>
      matchesQuery(
        [
          row.customer_id,
          row.customer_name,
          row.customer_email,
          row.customer_phone,
          row.customer_status,
        ],
        query
      )
    )
    .slice(0, limit);
}

export async function listZohoPayments(params: { query?: string | null; limit?: number | null } = {}) {
  const limit = clamp(Number(params.limit || 12) || 12, 1, 50);
  const payload = await zohoPaymentsRequest<{ payments?: ZohoPaymentListItem[] }>("/payments", {
    query: {
      per_page: clamp(Math.max(limit * 4, 25), 25, 200),
    },
  });

  const query = String(params.query || "").trim().toLowerCase();
  return (payload.payments || [])
    .filter((row) =>
      matchesQuery(
        [
          row.payment_id,
          row.amount,
          row.currency,
          row.receipt_email,
          row.reference_number,
          row.description,
          row.status,
          row.payment_method?.type,
        ],
        query
      )
    )
    .slice(0, limit);
}

export async function createZohoPaymentLink(input: CreateZohoPaymentLinkInput) {
  const config = ensureZohoPaymentsConfig();
  const amount = Number(input.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("A positive amount is required to create a Zoho payment link.");
  }

  const currency = String(input.currency || "USD")
    .trim()
    .toUpperCase();
  const description = String(input.description || "").trim();
  if (!description) {
    throw new Error("A description is required to create a Zoho payment link.");
  }

  const paymentMethods =
    input.paymentMethods?.length && input.paymentMethods.length > 0
      ? input.paymentMethods
      : config.defaultAllowedPaymentMethods;

  const payload = await zohoPaymentsRequest<{ payment_links?: ZohoPaymentLink; payment_link?: ZohoPaymentLink }>(
    "/paymentlinks",
    {
      method: "POST",
      body: {
        amount: Number(amount.toFixed(2)),
        currency,
        description,
        ...(input.email ? { email: input.email } : {}),
        ...(input.phone ? { phone: input.phone } : {}),
        ...(input.referenceId ? { reference_id: input.referenceId } : {}),
        ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
        ...((input.sendEmail ?? Boolean(input.email)) && input.email
          ? { notify_customer: { email: true } }
          : {}),
        ...(input.returnUrl || config.defaultReturnUrl
          ? { return_url: input.returnUrl || config.defaultReturnUrl }
          : {}),
        ...(paymentMethods.length
          ? {
              configurations: {
                allowed_payment_methods: paymentMethods,
              },
            }
          : {}),
      },
    }
  );

  const paymentLink = payload.payment_links || payload.payment_link;
  if (!paymentLink?.url) {
    throw new Error("Zoho Payments did not return a payment link URL.");
  }

  return paymentLink;
}
