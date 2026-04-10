import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

type ZohoBillingConfig = {
  organizationId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accountsBaseUrl: string;
  apiBaseUrl: string;
  defaultReturnUrl: string | null;
  defaultPlanCode: string | null;
  webhookSecret: string | null;
};

type ZohoBillingApiResponse = {
  code?: number;
  message?: string;
};

export type ZohoBillingCustomer = {
  customer_id: string;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  status?: string | null;
  created_time?: string | null;
  updated_time?: string | null;
};

export type ZohoBillingCustomerInput = {
  displayName: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  currencyCode?: string | null;
  billingAddress?: {
    attention?: string | null;
    street?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    country?: string | null;
  } | null;
};

export type ZohoBillingHostedPage = {
  hostedpage_id: string;
  status?: string | null;
  url?: string | null;
  action?: string | null;
  expiring_time?: string | null;
  created_time?: string | null;
  custom_fields?: Array<{
    label?: string | null;
    value?: string | null;
    index?: number | null;
    data_type?: string | null;
  }> | null;
};

export type ZohoBillingSubscription = {
  subscription_id: string;
  name?: string | null;
  status?: string | null;
  amount?: number | string | null;
  created_at?: string | null;
  starts_at?: string | null;
  current_term_starts_at?: string | null;
  current_term_ends_at?: string | null;
  next_billing_at?: string | null;
  interval?: number | null;
  interval_unit?: string | null;
  reference_id?: string | null;
  currency_code?: string | null;
  created_time?: string | null;
  updated_time?: string | null;
  payment_terms?: number | null;
  payment_terms_label?: string | null;
  customer?: {
    customer_id?: string | null;
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    mobile?: string | null;
  } | null;
  plan?: {
    plan_code?: string | null;
    name?: string | null;
    price?: number | string | null;
    quantity?: number | null;
    billing_cycles?: number | null;
  } | null;
  card?: {
    card_id?: string | null;
    last_four_digits?: string | null;
    expiry_month?: number | null;
    expiry_year?: number | null;
    payment_gateway?: string | null;
  } | null;
};

export type ZohoBillingInvoice = {
  invoice_id?: string | null;
  number?: string | null;
  status?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  total?: number | string | null;
  balance?: number | string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  email?: string | null;
  payments?: Array<{
    payment_id?: string | null;
    invoice_payment_id?: string | null;
    gateway_transaction_id?: string | null;
    description?: string | null;
    date?: string | null;
    reference_number?: string | null;
    amount?: number | string | null;
  }> | null;
};

export type ZohoBillingHostedPageDetails = ZohoBillingHostedPage & {
  data?: {
    subscription?: ZohoBillingSubscription | null;
    invoice?: ZohoBillingInvoice | null;
  } | null;
};

export type ZohoBillingEvent = {
  event_id: string;
  event_type?: string | null;
  event_time?: string | null;
  payload?: string | null;
};

type CreateZohoBillingHostedSubscriptionInput = {
  customerId?: string | null;
  customer?: ZohoBillingCustomerInput | null;
  planCode: string;
  price?: number | null;
  quantity?: number | null;
  billingCycles?: number | null;
  referenceId?: string | null;
  startsAt?: string | null;
  redirectUrl?: string | null;
  customFields?: Array<{ label: string; value: string }> | null;
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

function parseJson<T>(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;

  try {
    return JSON.parse(normalized) as T;
  } catch {
    return null;
  }
}

function normalizeMoney(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return null;
  return Number(amount.toFixed(2));
}

function cleanBodyValue<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => {
      if (item === null || item === undefined) return false;
      if (typeof item === "string") return item.trim().length > 0;
      if (Array.isArray(item)) return item.length > 0;
      return true;
    })
  ) as T;
}

function getZohoBillingWebhookSecretInternal() {
  return (
    readOptionalEnv("ZOHO_BILLING_WEBHOOK_SECRET", "ZOHO_BILLING_WEBHOOK_SIGNING_KEY") || null
  );
}

async function getZohoBillingConfig(): Promise<ZohoBillingConfig | null> {
  const organizationId = readOptionalEnv(
    "ZOHO_BILLING_ORGANIZATION_ID",
    "ZOHO_BILLING_ACCOUNT_ID"
  );
  const clientId = readOptionalEnv("ZOHO_BILLING_CLIENT_ID");
  const clientSecret = readOptionalEnv("ZOHO_BILLING_CLIENT_SECRET");
  const refreshToken = readOptionalEnv("ZOHO_BILLING_REFRESH_TOKEN");

  if (!(organizationId && clientId && clientSecret && refreshToken)) {
    return null;
  }

  return {
    organizationId,
    clientId,
    clientSecret,
    refreshToken,
    accountsBaseUrl: trimTrailingSlash(
      readOptionalEnv("ZOHO_BILLING_ACCOUNTS_BASE_URL") || "https://accounts.zoho.com"
    ),
    apiBaseUrl: trimTrailingSlash(
      readOptionalEnv("ZOHO_BILLING_API_BASE_URL") || "https://www.zohoapis.com/billing/v1"
    ),
    defaultReturnUrl: readOptionalEnv("ZOHO_BILLING_RETURN_URL") || null,
    defaultPlanCode: readOptionalEnv("ZOHO_BILLING_DEFAULT_PLAN_CODE") || null,
    webhookSecret: getZohoBillingWebhookSecretInternal(),
  };
}

async function ensureZohoBillingConfig() {
  const config = await getZohoBillingConfig();
  if (!config) {
    throw new Error(
      "Zoho Billing is not configured. Add ZOHO_BILLING_ORGANIZATION_ID, ZOHO_BILLING_CLIENT_ID, ZOHO_BILLING_CLIENT_SECRET, and ZOHO_BILLING_REFRESH_TOKEN."
    );
  }
  return config;
}

async function getZohoBillingAccessToken(config: ZohoBillingConfig) {
  const body = new URLSearchParams({
    refresh_token: config.refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
  });

  const redirectUri = readOptionalEnv("ZOHO_BILLING_REDIRECT_URI");
  if (redirectUri) {
    body.set("redirect_uri", redirectUri);
  }

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
      payload?.error_description || payload?.error || text || "Unknown Zoho Billing OAuth error.";
    throw new Error(`Zoho Billing OAuth refresh failed: ${detail}`);
  }

  return payload.access_token;
}

async function zohoBillingRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT";
    body?: Record<string, unknown>;
    query?: Record<string, string | number | boolean | null | undefined>;
  } = {}
) {
  const config = await ensureZohoBillingConfig();
  const accessToken = await getZohoBillingAccessToken(config);
  const url = new URL(
    path.startsWith("/") ? `${config.apiBaseUrl}${path}` : `${config.apiBaseUrl}/${path}`
  );

  for (const [key, value] of Object.entries(options.query || {})) {
    if (value === null || value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    method: options.method || "GET",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "X-com-zoho-subscriptions-organizationid": config.organizationId,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const payload = parseJson<T & ZohoBillingApiResponse>(text);

  if (!response.ok || !payload || (typeof payload.code === "number" && payload.code !== 0)) {
    const detail = payload?.message || text || "Unknown Zoho Billing API error.";
    throw new Error(`Zoho Billing request failed: ${detail}`);
  }

  return payload;
}

function matchesQuery(values: unknown[], query: string) {
  if (!query) return true;
  const haystack = values
    .map((value) => String(value || "").trim().toLowerCase())
    .join(" ");
  return haystack.includes(query);
}

function normalizeHex(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function signaturesMatch(expected: string, provided: string) {
  const left = Buffer.from(normalizeHex(expected), "utf8");
  const right = Buffer.from(normalizeHex(provided), "utf8");
  if (!left.length || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function computeWebhookSignature(payload: string, secret: string | null | undefined) {
  const normalizedSecret = String(secret || "").trim();
  if (!normalizedSecret) return "";
  return createHmac("sha256", normalizedSecret).update(payload, "utf8").digest("hex");
}

function buildWebhookPayloadForSignature(input: {
  url: string;
  rawBody: string;
  contentType: string | null | undefined;
}) {
  const url = new URL(input.url);
  const pairs: Array<[string, string]> = [];

  url.searchParams.forEach((value, key) => {
    pairs.push([key, value]);
  });

  const rawBody = String(input.rawBody || "");
  const contentType = String(input.contentType || "").toLowerCase();

  if (contentType.includes("application/x-www-form-urlencoded") && rawBody) {
    const params = new URLSearchParams(rawBody);
    params.forEach((value, key) => {
      pairs.push([key, value]);
    });
  }

  pairs.sort(([left], [right]) => left.localeCompare(right));
  const pairPayload = pairs.map(([key, value]) => `${key}${value}`).join("");
  const isJson =
    rawBody &&
    (contentType.includes("application/json") ||
      contentType.includes("text/json") ||
      /^[\[{]/.test(rawBody.trim()));

  return isJson ? `${pairPayload}${rawBody}` : pairPayload;
}

export function getZohoBillingDefaultPlanCode() {
  return readOptionalEnv("ZOHO_BILLING_DEFAULT_PLAN_CODE") || null;
}

export function getZohoBillingDefaultReturnUrl() {
  return readOptionalEnv("ZOHO_BILLING_RETURN_URL") || null;
}

export function hasZohoBillingWebhookSecret() {
  return Boolean(getZohoBillingWebhookSecretInternal());
}

export function isZohoBillingConfigured() {
  return getZohoBillingConfig().then(Boolean);
}

export async function listZohoBillingCustomers(params: {
  query?: string | null;
  limit?: number | null;
} = {}) {
  const limit = clamp(Number(params.limit || 25) || 25, 1, 1000);
  const perPage = Math.min(limit, 200);
  const customers: ZohoBillingCustomer[] = [];
  let page = 1;

  while (customers.length < limit) {
    const payload = await zohoBillingRequest<{ customers?: ZohoBillingCustomer[] }>("/customers", {
      query: {
        page,
        per_page: perPage,
      },
    });
    const batch = payload.customers || [];
    customers.push(...batch);

    if (batch.length < perPage) {
      break;
    }

    page += 1;
  }

  const query = String(params.query || "").trim().toLowerCase();

  return customers.slice(0, limit).filter((row) =>
    matchesQuery(
      [
        row.customer_id,
        row.display_name,
        row.email,
        row.phone,
        row.mobile,
        row.status,
      ],
      query
    )
  );
}

export async function createZohoBillingCustomer(input: ZohoBillingCustomerInput) {
  const displayName = String(input.displayName || "").trim();
  const email = String(input.email || "").trim();

  if (!(displayName && email)) {
    throw new Error("A customer display name and email are required for Zoho Billing.");
  }

  try {
    const payload = await zohoBillingRequest<{ customer?: ZohoBillingCustomer }>("/customers", {
      method: "POST",
      body: cleanBodyValue({
        display_name: displayName,
        first_name: String(input.firstName || "").trim() || undefined,
        last_name: String(input.lastName || "").trim() || undefined,
        email,
        mobile: String(input.phone || "").trim() || undefined,
        currency_code: String(input.currencyCode || "USD").trim().toUpperCase() || undefined,
        billing_address: input.billingAddress
          ? cleanBodyValue({
              attention: input.billingAddress.attention || undefined,
              street: input.billingAddress.street || undefined,
              city: input.billingAddress.city || undefined,
              state: input.billingAddress.state || undefined,
              zip: input.billingAddress.zip || undefined,
              country: input.billingAddress.country || undefined,
            })
          : undefined,
      }),
    });

    if (!payload.customer?.customer_id) {
      throw new Error("Zoho Billing did not return a customer id.");
    }

    return payload.customer;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes("already exists")) {
      const existingCustomers = await listZohoBillingCustomers({
        query: email || displayName,
        limit: 1000,
      });
      const exactEmailMatch =
        existingCustomers.find(
          (row) => String(row.email || "").trim().toLowerCase() === email.toLowerCase()
        ) || null;

      if (exactEmailMatch?.customer_id) {
        return exactEmailMatch;
      }

      const displayNameMatches = existingCustomers.filter(
        (row) => String(row.display_name || "").trim().toLowerCase() === displayName.toLowerCase()
      );

      if (displayNameMatches.length === 1 && displayNameMatches[0]?.customer_id) {
        return displayNameMatches[0];
      }
    }

    throw error;
  }
}

export async function retrieveZohoBillingSubscription(subscriptionId: string) {
  const normalized = String(subscriptionId || "").trim();
  if (!normalized) {
    throw new Error("A Zoho Billing subscription id is required.");
  }

  const payload = await zohoBillingRequest<{ subscription?: ZohoBillingSubscription }>(
    `/subscriptions/${normalized}`
  );

  if (!payload.subscription?.subscription_id) {
    throw new Error("Zoho Billing did not return the subscription details.");
  }

  return payload.subscription;
}

export async function retrieveZohoBillingHostedPage(hostedPageId: string) {
  const normalized = String(hostedPageId || "").trim();
  if (!normalized) {
    throw new Error("A Zoho Billing hosted page id is required.");
  }

  const payload = await zohoBillingRequest<ZohoBillingHostedPageDetails>(
    `/hostedpages/${normalized}`
  );

  if (!payload.hostedpage_id) {
    throw new Error("Zoho Billing did not return the hosted page details.");
  }

  return payload;
}

export async function createZohoBillingSubscriptionHostedPage(
  input: CreateZohoBillingHostedSubscriptionInput
) {
  const config = await ensureZohoBillingConfig();
  const planCode = String(input.planCode || config.defaultPlanCode || "").trim();

  if (!planCode) {
    throw new Error("Set ZOHO_BILLING_DEFAULT_PLAN_CODE before creating a subscription checkout.");
  }

  if (!(String(input.customerId || "").trim() || input.customer)) {
    throw new Error("A Zoho Billing customer or customer_id is required.");
  }

  const price = normalizeMoney(input.price);
  const billingCycles =
    input.billingCycles !== null && input.billingCycles !== undefined
      ? Math.max(1, Math.round(Number(input.billingCycles)))
      : undefined;

  const payload = await zohoBillingRequest<{ hostedpage?: ZohoBillingHostedPage }>(
    "/hostedpages/newsubscription",
    {
      method: "POST",
      body: cleanBodyValue({
        customer_id: String(input.customerId || "").trim() || undefined,
        customer: input.customer
          ? cleanBodyValue({
              display_name: input.customer.displayName,
              first_name: String(input.customer.firstName || "").trim() || undefined,
              last_name: String(input.customer.lastName || "").trim() || undefined,
              email: input.customer.email,
              mobile: String(input.customer.phone || "").trim() || undefined,
              currency_code:
                String(input.customer.currencyCode || "USD").trim().toUpperCase() || undefined,
              billing_address: input.customer.billingAddress
                ? cleanBodyValue({
                    attention: input.customer.billingAddress.attention || undefined,
                    street: input.customer.billingAddress.street || undefined,
                    city: input.customer.billingAddress.city || undefined,
                    state: input.customer.billingAddress.state || undefined,
                    zip: input.customer.billingAddress.zip || undefined,
                    country: input.customer.billingAddress.country || undefined,
                  })
                : undefined,
            })
          : undefined,
        plan: cleanBodyValue({
          plan_code: planCode,
          quantity: Math.max(1, Math.round(Number(input.quantity || 1))),
          price: price ?? undefined,
          exclude_trial: true,
          billing_cycles: billingCycles,
        }),
        reference_id: String(input.referenceId || "").trim() || undefined,
        starts_at: String(input.startsAt || "").trim() || undefined,
        redirect_url:
          String(input.redirectUrl || config.defaultReturnUrl || "").trim() || undefined,
        custom_fields:
          input.customFields?.map((field) =>
            cleanBodyValue({
              label: String(field.label || "").trim(),
              value: String(field.value || "").trim(),
            })
          ) || undefined,
      }),
    }
  );

  if (!payload.hostedpage?.hostedpage_id || !payload.hostedpage.url) {
    throw new Error("Zoho Billing did not return a hosted checkout page.");
  }

  return payload.hostedpage;
}

export async function createZohoBillingAddPaymentMethodHostedPage(input: {
  customerId: string;
  redirectUrl?: string | null;
}) {
  const config = await ensureZohoBillingConfig();
  const customerId = String(input.customerId || "").trim();

  if (!customerId) {
    throw new Error("A Zoho Billing customer id is required to add a payment method.");
  }

  const payload = await zohoBillingRequest<{ hostedpage?: ZohoBillingHostedPage }>(
    "/hostedpages/addpaymentmethod",
    {
      method: "POST",
      body: cleanBodyValue({
        customer_id: customerId,
        redirect_url:
          String(input.redirectUrl || config.defaultReturnUrl || "").trim() || undefined,
      }),
    }
  );

  if (!payload.hostedpage?.hostedpage_id || !payload.hostedpage.url) {
    throw new Error("Zoho Billing did not return the payment-method checkout page.");
  }

  return payload.hostedpage;
}

export async function createZohoBillingUpdatePaymentMethodHostedPage(input: {
  cardId?: string | null;
  accountId?: string | null;
  paypalId?: string | null;
  redirectUrl?: string | null;
}) {
  const config = await ensureZohoBillingConfig();
  const cardId = String(input.cardId || "").trim();
  const accountId = String(input.accountId || "").trim();
  const paypalId = String(input.paypalId || "").trim();

  if (!(cardId || accountId || paypalId)) {
    throw new Error("A Zoho Billing payment method id is required to update the saved payment method.");
  }

  const payload = await zohoBillingRequest<{ hostedpage?: ZohoBillingHostedPage }>(
    "/hostedpages/updatepaymentmethod",
    {
      method: "POST",
      body: cleanBodyValue({
        card_id: cardId || undefined,
        account_id: accountId || undefined,
        paypal_id: paypalId || undefined,
        redirect_url:
          String(input.redirectUrl || config.defaultReturnUrl || "").trim() || undefined,
      }),
    }
  );

  if (!payload.hostedpage?.hostedpage_id || !payload.hostedpage.url) {
    throw new Error("Zoho Billing did not return the payment-method update page.");
  }

  return payload.hostedpage;
}

export async function createZohoBillingUpdateCardHostedPage(input: {
  subscriptionId: string;
  redirectUrl?: string | null;
}) {
  const subscriptionId = String(input.subscriptionId || "").trim();

  if (!subscriptionId) {
    throw new Error("A Zoho Billing subscription id is required to update the saved card.");
  }

  const subscription = await retrieveZohoBillingSubscription(subscriptionId);
  const cardId = String(subscription.card?.card_id || "").trim();

  if (!cardId) {
    throw new Error("Zoho Billing did not return a saved card for this subscription.");
  }

  return createZohoBillingUpdatePaymentMethodHostedPage({
    cardId,
    redirectUrl: input.redirectUrl,
  });
}

export async function retrieveZohoBillingEvent(eventId: string) {
  const normalized = String(eventId || "").trim();
  if (!normalized) {
    throw new Error("A Zoho Billing event id is required.");
  }

  const payload = await zohoBillingRequest<{ event?: ZohoBillingEvent }>(`/events/${normalized}`);

  if (!payload.event?.event_id) {
    throw new Error("Zoho Billing did not return the event details.");
  }

  return payload.event;
}

export function verifyZohoBillingWebhookSignature(input: {
  url: string;
  rawBody: string;
  contentType: string | null | undefined;
  signature: string | null | undefined;
}) {
  const providedSignature = String(input.signature || "").trim();
  if (!providedSignature) return false;

  const payload = buildWebhookPayloadForSignature({
    url: input.url,
    rawBody: input.rawBody,
    contentType: input.contentType,
  });
  const expectedSignature = computeWebhookSignature(
    payload,
    getZohoBillingWebhookSecretInternal()
  );

  if (!expectedSignature) return false;
  return signaturesMatch(expectedSignature, providedSignature);
}
