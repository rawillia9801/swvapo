import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  extractZohoPaymentsAccountId,
  loadZohoPaymentsConnection,
} from "@/lib/zoho-payments-connection";

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

export type ZohoPaymentSession = {
  payments_session_id: string;
  currency?: string | null;
  amount?: string | null;
  created_time?: number | null;
  expiry_time?: number | null;
  description?: string | null;
  invoice_number?: string | null;
  reference_number?: string | null;
  configurations?: {
    allowed_payment_methods?: ZohoAllowedPaymentMethod[] | null;
  } | null;
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

type CreateZohoPaymentSessionInput = {
  amount: number;
  currency?: string | null;
  description: string;
  invoiceNumber?: string | null;
  referenceNumber?: string | null;
  expiresIn?: number | null;
  maxRetryCount?: number | null;
  paymentMethods?: ZohoAllowedPaymentMethod[] | null;
  metaData?: Record<string, unknown> | null;
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

  return methods.length ? methods : ["card"];
}

function clampWhole(value: number | null | undefined, min: number, max: number) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  return Math.min(Math.max(Math.round(Number(value)), min), max);
}

function normalizeSignature(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getZohoPaymentsWidgetApiKeyInternal() {
  return (
    readOptionalEnv(
      "NEXT_PUBLIC_ZOHO_PAYMENTS_WIDGET_KEY",
      "ZOHO_PAYMENTS_WIDGET_API_KEY",
      "ZOHO_PAYMENTS_API_KEY"
    ) || null
  );
}

function getZohoPaymentsWidgetSigningKeyInternal() {
  return (
    readOptionalEnv(
      "ZOHO_PAYMENTS_WIDGET_SIGNING_KEY",
      "ZOHO_PAYMENTS_PAYMENT_LINK_SIGNING_KEY",
      "ZOHO_PAYMENTS_SIGNING_KEY"
    ) || null
  );
}

function getZohoPaymentsPaymentLinkSigningKeyInternal() {
  return (
    readOptionalEnv(
      "ZOHO_PAYMENTS_PAYMENT_LINK_SIGNING_KEY",
      "ZOHO_PAYMENTS_WIDGET_SIGNING_KEY",
      "ZOHO_PAYMENTS_SIGNING_KEY"
    ) || null
  );
}

function getZohoPaymentsWebhookSigningKeyInternal() {
  return (
    readOptionalEnv(
      "ZOHO_PAYMENTS_WEBHOOK_SIGNING_KEY",
      "ZOHO_PAYMENTS_SIGNING_KEY"
    ) || null
  );
}

function readZohoPaymentsAccountIdFromEnv() {
  return (
    extractZohoPaymentsAccountId(readOptionalEnv("ZOHO_PAYMENTS_ACCOUNT_ID")) ||
    extractZohoPaymentsAccountId(readOptionalEnv("ZOHO_PAYMENTS_SOID")) ||
    ""
  );
}

async function getZohoPaymentsConfig(): Promise<ZohoPaymentsConfig | null> {
  const storedConnection = await loadZohoPaymentsConnection();
  const accountId =
    readZohoPaymentsAccountIdFromEnv() ||
    extractZohoPaymentsAccountId(storedConnection?.account_id) ||
    extractZohoPaymentsAccountId(storedConnection?.soid);
  const clientId = readOptionalEnv("ZOHO_PAYMENTS_CLIENT_ID");
  const clientSecret = readOptionalEnv("ZOHO_PAYMENTS_CLIENT_SECRET");
  const refreshToken =
    readOptionalEnv("ZOHO_PAYMENTS_REFRESH_TOKEN") ||
    String(storedConnection?.refresh_token || "").trim();

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

async function ensureZohoPaymentsConfig(): Promise<ZohoPaymentsConfig> {
  const config = await getZohoPaymentsConfig();
  if (!config) {
    throw new Error(
      "Zoho Payments is not configured. Add the Zoho OAuth client env values and connect a refresh token, or provide ZOHO_PAYMENTS_REFRESH_TOKEN directly."
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

async function zohoPaymentsRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
    query?: Record<string, string | number | boolean | null | undefined>;
  } = {}
) {
  const config = await ensureZohoPaymentsConfig();
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
    const detail = (payload as ZohoApiResponse | null)?.message || text || "Unknown error";
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

function describeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message || "Unknown Zoho Payments error.";
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return "Unknown Zoho Payments error.";
}

function isUnsupportedPaymentMethodError(error: unknown) {
  return describeErrorMessage(error)
    .toLowerCase()
    .includes("payment method is currently not supported");
}

function uniquePaymentMethods(methods: ZohoAllowedPaymentMethod[] | null | undefined) {
  return Array.from(new Set((methods || []).filter(Boolean)));
}

function fallbackPaymentMethods(
  methods: ZohoAllowedPaymentMethod[],
  explicitInput: ZohoAllowedPaymentMethod[] | null | undefined
) {
  if (explicitInput?.length) return null;
  if (methods.length <= 1) return null;
  if (!methods.includes("card")) return null;
  return ["card"] as ZohoAllowedPaymentMethod[];
}

export function isZohoPaymentsConfigured() {
  return getZohoPaymentsConfig().then(Boolean);
}

export function getZohoPaymentsWidgetApiKey() {
  return getZohoPaymentsWidgetApiKeyInternal();
}

export function hasZohoPaymentsSigningKey() {
  return !!(
    getZohoPaymentsPaymentLinkSigningKeyInternal() ||
    getZohoPaymentsWebhookSigningKeyInternal()
  );
}

export function hasZohoPaymentsPaymentLinkSigningKey() {
  return !!getZohoPaymentsPaymentLinkSigningKeyInternal();
}

export function hasZohoPaymentsWebhookSigningKey() {
  return !!getZohoPaymentsWebhookSigningKeyInternal();
}

export function getZohoPaymentsDefaultPaymentMethods() {
  return cleanAllowedPaymentMethods(readOptionalEnv("ZOHO_PAYMENTS_ALLOWED_METHODS"));
}

export async function createZohoPaymentSession(input: CreateZohoPaymentSessionInput) {
  const config = await ensureZohoPaymentsConfig();
  const amount = Number(input.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("A positive amount is required to create a Zoho payment session.");
  }

  const currency = String(input.currency || "USD")
    .trim()
    .toUpperCase();
  const description = String(input.description || "").trim();
  if (!description) {
    throw new Error("A description is required to create a Zoho payment session.");
  }

  const paymentMethods = uniquePaymentMethods(
    input.paymentMethods?.length && input.paymentMethods.length > 0
      ? input.paymentMethods
      : config.defaultAllowedPaymentMethods
  );
  const expiresIn = clampWhole(input.expiresIn ?? null, 300, 900);
  const maxRetryCount = clampWhole(input.maxRetryCount ?? null, 1, 5);
  const createBody = (resolvedPaymentMethods: ZohoAllowedPaymentMethod[]) => ({
    amount: Number(amount.toFixed(2)),
    currency,
    description,
    ...(input.invoiceNumber ? { invoice_number: input.invoiceNumber } : {}),
    ...(input.referenceNumber ? { reference_number: input.referenceNumber } : {}),
    ...(expiresIn ? { expires_in: expiresIn } : {}),
    ...(maxRetryCount ? { max_retry_count: maxRetryCount } : {}),
    ...(resolvedPaymentMethods.length
      ? {
          configurations: {
            allowed_payment_methods: resolvedPaymentMethods,
          },
        }
      : {}),
    ...(input.metaData ? { meta_data: input.metaData } : {}),
  });

  let payload: {
    payments_session?: ZohoPaymentSession;
    payment_session?: ZohoPaymentSession;
  };

  try {
    payload = await zohoPaymentsRequest<{
      payments_session?: ZohoPaymentSession;
      payment_session?: ZohoPaymentSession;
    }>("/paymentsessions", {
      method: "POST",
      body: createBody(paymentMethods),
    });
  } catch (error) {
    const retryMethods = fallbackPaymentMethods(paymentMethods, input.paymentMethods);
    if (!(retryMethods && isUnsupportedPaymentMethodError(error))) {
      throw error;
    }

    payload = await zohoPaymentsRequest<{
      payments_session?: ZohoPaymentSession;
      payment_session?: ZohoPaymentSession;
    }>("/paymentsessions", {
      method: "POST",
      body: createBody(retryMethods),
    });
  }

  const session = payload.payments_session || payload.payment_session;
  if (!session?.payments_session_id) {
    throw new Error("Zoho Payments did not return a payment session id.");
  }

  return session;
}

function computeZohoSignature(payload: string, signingKey: string | null | undefined) {
  const normalizedSigningKey = String(signingKey || "").trim();
  if (!normalizedSigningKey) return "";
  return createHmac("sha256", normalizedSigningKey)
    .update(payload, "utf8")
    .digest("hex")
    .toLowerCase();
}

function signaturesMatch(expected: string, provided: string) {
  const left = Buffer.from(normalizeSignature(expected), "utf8");
  const right = Buffer.from(normalizeSignature(provided), "utf8");
  if (!left.length || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function parseZohoWebhookSignatureHeader(value: string | null | undefined) {
  const header = String(value || "").trim();
  if (!header) return null;

  const parts = header.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2).trim() || "";
  const signature = parts.find((part) => part.startsWith("v="))?.slice(2).trim() || "";

  if (!(timestamp && signature)) {
    return null;
  }

  return { timestamp, signature };
}

export function verifyZohoWidgetSignature(input: {
  paymentId: string | null | undefined;
  paymentSessionId: string | null | undefined;
  signature: string | null | undefined;
}) {
  const paymentId = String(input.paymentId || "").trim();
  const paymentSessionId = String(input.paymentSessionId || "").trim();
  const providedSignature = String(input.signature || "").trim();

  if (!(paymentId && paymentSessionId && providedSignature)) {
    return false;
  }

  const payload = `${paymentId}|${paymentSessionId}`;
  const expectedSignature = computeZohoSignature(
    payload,
    getZohoPaymentsWidgetSigningKeyInternal()
  );
  if (!expectedSignature) return false;
  return signaturesMatch(expectedSignature, providedSignature);
}

export function verifyZohoPaymentLinkSignature(input: {
  paymentLinkId: string | null | undefined;
  paymentId: string | null | undefined;
  amount: string | number | null | undefined;
  status: string | null | undefined;
  paymentLinkReference?: string | null | undefined;
  signature: string | null | undefined;
}) {
  const paymentLinkId = String(input.paymentLinkId || "").trim();
  const paymentId = String(input.paymentId || "").trim();
  const amount = String(input.amount ?? "").trim();
  const status = String(input.status || "").trim();
  const paymentLinkReference = String(input.paymentLinkReference || "").trim();
  const providedSignature = String(input.signature || "").trim();

  if (!(paymentLinkId && paymentId && amount && status && providedSignature)) {
    return false;
  }

  const payload = [
    paymentLinkId,
    paymentId,
    amount,
    status,
    paymentLinkReference,
  ].join(".");

  const expectedSignature = computeZohoSignature(
    payload,
    getZohoPaymentsPaymentLinkSigningKeyInternal()
  );
  if (!expectedSignature) return false;
  return signaturesMatch(expectedSignature, providedSignature);
}

export function verifyZohoWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null | undefined;
}) {
  const rawBody = String(input.rawBody || "");
  const header = parseZohoWebhookSignatureHeader(input.signatureHeader);
  if (!(rawBody && header?.timestamp && header.signature)) {
    return false;
  }

  const expectedSignature = computeZohoSignature(
    `${header.timestamp}.${rawBody}`,
    getZohoPaymentsWebhookSigningKeyInternal()
  );
  if (!expectedSignature) return false;
  return signaturesMatch(expectedSignature, header.signature);
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
  const config = await ensureZohoPaymentsConfig();
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

  const paymentMethods = uniquePaymentMethods(
    input.paymentMethods?.length && input.paymentMethods.length > 0
      ? input.paymentMethods
      : config.defaultAllowedPaymentMethods
  );
  const createBody = (resolvedPaymentMethods: ZohoAllowedPaymentMethod[]) => ({
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
    ...(resolvedPaymentMethods.length
      ? {
          configurations: {
            allowed_payment_methods: resolvedPaymentMethods,
          },
        }
      : {}),
  });

  let payload: { payment_links?: ZohoPaymentLink; payment_link?: ZohoPaymentLink };

  try {
    payload = await zohoPaymentsRequest<{ payment_links?: ZohoPaymentLink; payment_link?: ZohoPaymentLink }>(
      "/paymentlinks",
      {
        method: "POST",
        body: createBody(paymentMethods),
      }
    );
  } catch (error) {
    const retryMethods = fallbackPaymentMethods(paymentMethods, input.paymentMethods);
    if (!(retryMethods && isUnsupportedPaymentMethodError(error))) {
      throw error;
    }

    payload = await zohoPaymentsRequest<{ payment_links?: ZohoPaymentLink; payment_link?: ZohoPaymentLink }>(
      "/paymentlinks",
      {
        method: "POST",
        body: createBody(retryMethods),
      }
    );
  }

  const paymentLink = payload.payment_links || payload.payment_link;
  if (!paymentLink?.url) {
    throw new Error("Zoho Payments did not return a payment link URL.");
  }

  return paymentLink;
}
