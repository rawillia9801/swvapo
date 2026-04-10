import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createZohoBillingAddPaymentMethodHostedPage,
  createZohoBillingCustomer,
  createZohoBillingSubscriptionHostedPage,
  createZohoBillingUpdateCardHostedPage,
  createZohoBillingUpdatePaymentMethodHostedPage,
  getZohoBillingDefaultPlanCode,
  listZohoBillingCustomers,
  retrieveZohoBillingHostedPage,
  retrieveZohoBillingSubscription,
  type ZohoBillingCustomer,
  type ZohoBillingHostedPage,
  type ZohoBillingHostedPageDetails,
  type ZohoBillingSubscription,
} from "@/lib/zoho-billing";

export type BuyerBillingSubscriptionRecord = {
  id: number;
  created_at: string;
  updated_at: string;
  provider: string;
  buyer_id: number;
  puppy_id: number | null;
  reference_id: string;
  customer_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  subscription_id: string | null;
  subscription_status: string | null;
  hostedpage_id: string | null;
  hostedpage_url: string | null;
  hostedpage_expires_at: string | null;
  plan_code: string | null;
  plan_name: string | null;
  recurring_price: number | null;
  currency_code: string | null;
  interval_count: number | null;
  interval_unit: string | null;
  billing_cycles: number | null;
  current_term_ends_at: string | null;
  next_billing_at: string | null;
  started_at: string | null;
  last_payment_at: string | null;
  last_payment_amount: number | null;
  card_last_four: string | null;
  card_expiry_month: number | null;
  card_expiry_year: number | null;
  last_event_id: string | null;
  last_event_type: string | null;
  last_event_at: string | null;
  raw_subscription: Record<string, unknown> | null;
  raw_hostedpage: Record<string, unknown> | null;
};

type BillingBuyer = {
  id: number;
  user_id?: string | null;
  puppy_id?: number | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  sale_price?: number | null;
  deposit_amount?: number | null;
  finance_enabled?: boolean | null;
  finance_rate?: number | null;
  finance_months?: number | null;
  finance_monthly_amount?: number | null;
  finance_day_of_month?: number | null;
  finance_next_due_date?: string | null;
  finance_last_payment_date?: string | null;
};

type BillingPuppy = {
  id: number;
  buyer_id?: number | null;
  call_name?: string | null;
  puppy_name?: string | null;
  name?: string | null;
};

type BillingContext = {
  buyer: BillingBuyer;
  puppy: BillingPuppy | null;
  record: BuyerBillingSubscriptionRecord | null;
};

type HostedCheckoutResult = {
  record: BuyerBillingSubscriptionRecord;
  url: string;
  hostedPageId: string;
  reusedExisting: boolean;
};

function isMissingTableError(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error || "")).toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("schema cache")
  );
}

function normalizeMoney(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return null;
  return Number(amount.toFixed(2));
}

function normalizeText(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function normalizeLower(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function firstString(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) return normalized;
  }
  return "";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toIsoDate(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
  }
  return date.toISOString().slice(0, 10);
}

function toIsoTimestamp(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return normalized;
  return date.toISOString();
}

function splitName(fullName: string | null | undefined) {
  const normalized = normalizeText(fullName);
  if (!normalized) return { firstName: "", lastName: "" };
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: normalized, lastName: "" };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function buyerDisplayName(buyer: Pick<BillingBuyer, "full_name" | "name" | "email">) {
  return firstString(buyer.full_name, buyer.name, buyer.email, "Puppy Plan Buyer");
}

function puppyDisplayName(puppy: Pick<BillingPuppy, "call_name" | "puppy_name" | "name"> | null) {
  return firstString(puppy?.call_name, puppy?.puppy_name, puppy?.name, "Puppy payment plan");
}

function buildBuyerBillingReference(input: { buyerId: number; puppyId?: number | null }) {
  return `swva-zb-b${input.buyerId}-p${Number(input.puppyId || 0)}`;
}

function parseBuyerBillingReference(reference: string | null | undefined) {
  const match = String(reference || "")
    .trim()
    .match(/^swva-zb-b(\d+)-p(\d+)$/i);

  if (!match) return null;

  return {
    buyerId: Number(match[1]),
    puppyId: Number(match[2]) || null,
  };
}

function isActiveLikeSubscriptionStatus(status: string | null | undefined) {
  return ["trial", "future", "live", "active", "non_renewing"].includes(normalizeLower(status));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectValuesByKey(value: unknown, key: string, matches: unknown[] = []): unknown[] {
  if (Array.isArray(value)) {
    value.forEach((item) => collectValuesByKey(item, key, matches));
    return matches;
  }

  if (!isPlainObject(value)) {
    return matches;
  }

  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (entryKey === key) {
      matches.push(entryValue);
    }
    collectValuesByKey(entryValue, key, matches);
  }

  return matches;
}

function firstObjectByKeys(value: unknown, keys: string[]) {
  for (const key of keys) {
    const match = collectValuesByKey(value, key).find((item) => isPlainObject(item));
    if (match && isPlainObject(match)) {
      return match;
    }
  }
  return null;
}

function firstArrayByKeys(value: unknown, keys: string[]) {
  for (const key of keys) {
    const match = collectValuesByKey(value, key).find(Array.isArray);
    if (Array.isArray(match)) {
      return match;
    }
  }
  return null;
}

function firstStringByKeys(value: unknown, keys: string[]) {
  for (const key of keys) {
    const match = collectValuesByKey(value, key).find(
      (item) => typeof item === "string" || typeof item === "number"
    );
    const normalized = normalizeText(match === undefined ? null : String(match));
    if (normalized) return normalized;
  }
  return null;
}

function firstNumberByKeys(value: unknown, keys: string[]) {
  for (const key of keys) {
    const match = collectValuesByKey(value, key).find(
      (item) =>
        typeof item === "number" ||
        (typeof item === "string" && String(item).trim().length > 0)
    );
    const amount = normalizeMoney(match as string | number | null | undefined);
    if (amount !== null) return amount;
  }
  return null;
}

function parseEventPayload(value: string | Record<string, unknown> | null | undefined) {
  if (isPlainObject(value)) return value;

  try {
    const parsed = value ? (JSON.parse(String(value)) as unknown) : null;
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function hostedPageExpiryActive(record: BuyerBillingSubscriptionRecord | null) {
  const expiry = normalizeText(record?.hostedpage_expires_at);
  if (!(record?.hostedpage_url && expiry && !record.subscription_id)) return false;
  const expiryDate = new Date(expiry);
  if (Number.isNaN(expiryDate.getTime())) return false;
  return expiryDate.getTime() > Date.now();
}

function resolveSavedPaymentMethodIds(record: BuyerBillingSubscriptionRecord | null) {
  return {
    cardId:
      firstStringByKeys(record?.raw_subscription, ["card_id"]) ||
      firstStringByKeys(record?.raw_hostedpage, ["card_id"]) ||
      null,
    accountId:
      firstStringByKeys(record?.raw_subscription, ["account_id", "bank_account_id"]) ||
      firstStringByKeys(record?.raw_hostedpage, ["account_id", "bank_account_id"]) ||
      null,
    paypalId:
      firstStringByKeys(record?.raw_subscription, ["paypal_id"]) ||
      firstStringByKeys(record?.raw_hostedpage, ["paypal_id"]) ||
      null,
  };
}

function sanitizeRecord(record: BuyerBillingSubscriptionRecord | null) {
  if (!record) return null;
  return {
    ...record,
    raw_subscription: null,
    raw_hostedpage: null,
  };
}

async function loadBillingRecordByBuyer(
  admin: SupabaseClient,
  buyerId: number,
  puppyId?: number | null
) {
  try {
    if (puppyId) {
      const exact = await admin
        .from("buyer_billing_subscriptions")
        .select("*")
        .eq("buyer_id", buyerId)
        .eq("puppy_id", puppyId)
        .eq("provider", "zoho_billing")
        .maybeSingle<BuyerBillingSubscriptionRecord>();

      if (exact.error && !isMissingTableError(exact.error)) {
        throw new Error(exact.error.message);
      }

      if (exact.data) return exact.data;
    }

    const fallback = await admin
      .from("buyer_billing_subscriptions")
      .select("*")
      .eq("buyer_id", buyerId)
      .is("puppy_id", null)
      .eq("provider", "zoho_billing")
      .maybeSingle<BuyerBillingSubscriptionRecord>();

    if (fallback.error) {
      if (isMissingTableError(fallback.error)) return null;
      throw new Error(fallback.error.message);
    }

    return fallback.data || null;
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

async function loadBillingRecordByReference(admin: SupabaseClient, referenceId: string) {
  try {
    const result = await admin
      .from("buyer_billing_subscriptions")
      .select("*")
      .eq("provider", "zoho_billing")
      .eq("reference_id", referenceId)
      .maybeSingle<BuyerBillingSubscriptionRecord>();

    if (result.error) {
      if (isMissingTableError(result.error)) return null;
      throw new Error(result.error.message);
    }

    return result.data || null;
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

async function loadBillingRecordBySubscriptionId(admin: SupabaseClient, subscriptionId: string) {
  try {
    const result = await admin
      .from("buyer_billing_subscriptions")
      .select("*")
      .eq("provider", "zoho_billing")
      .eq("subscription_id", subscriptionId)
      .maybeSingle<BuyerBillingSubscriptionRecord>();

    if (result.error) {
      if (isMissingTableError(result.error)) return null;
      throw new Error(result.error.message);
    }

    return result.data || null;
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

async function loadBillingRecordByCustomerId(admin: SupabaseClient, customerId: string) {
  try {
    const result = await admin
      .from("buyer_billing_subscriptions")
      .select("*")
      .eq("provider", "zoho_billing")
      .eq("customer_id", customerId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<BuyerBillingSubscriptionRecord>();

    if (result.error) {
      if (isMissingTableError(result.error)) return null;
      throw new Error(result.error.message);
    }

    return result.data || null;
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

async function persistBillingRecord(
  admin: SupabaseClient,
  input: Partial<BuyerBillingSubscriptionRecord> & {
    buyer_id: number;
    puppy_id?: number | null;
    reference_id: string;
  }
) {
  const payload = {
    provider: "zoho_billing",
    buyer_id: input.buyer_id,
    puppy_id: input.puppy_id ?? null,
    reference_id: input.reference_id,
    customer_id: normalizeText(input.customer_id) || null,
    customer_email: normalizeText(input.customer_email) || null,
    customer_name: normalizeText(input.customer_name) || null,
    subscription_id: normalizeText(input.subscription_id) || null,
    subscription_status: normalizeText(input.subscription_status) || null,
    hostedpage_id: normalizeText(input.hostedpage_id) || null,
    hostedpage_url: normalizeText(input.hostedpage_url) || null,
    hostedpage_expires_at: toIsoTimestamp(input.hostedpage_expires_at) || null,
    plan_code: normalizeText(input.plan_code) || null,
    plan_name: normalizeText(input.plan_name) || null,
    recurring_price: normalizeMoney(input.recurring_price) ?? null,
    currency_code: normalizeText(input.currency_code) || "USD",
    interval_count:
      input.interval_count !== null && input.interval_count !== undefined
        ? Math.round(Number(input.interval_count))
        : null,
    interval_unit: normalizeText(input.interval_unit) || null,
    billing_cycles:
      input.billing_cycles !== null && input.billing_cycles !== undefined
        ? Math.round(Number(input.billing_cycles))
        : null,
    current_term_ends_at: toIsoDate(input.current_term_ends_at) || null,
    next_billing_at: toIsoDate(input.next_billing_at) || null,
    started_at: toIsoDate(input.started_at) || null,
    last_payment_at: toIsoDate(input.last_payment_at) || null,
    last_payment_amount: normalizeMoney(input.last_payment_amount) ?? null,
    card_last_four: normalizeText(input.card_last_four) || null,
    card_expiry_month:
      input.card_expiry_month !== null && input.card_expiry_month !== undefined
        ? Math.round(Number(input.card_expiry_month))
        : null,
    card_expiry_year:
      input.card_expiry_year !== null && input.card_expiry_year !== undefined
        ? Math.round(Number(input.card_expiry_year))
        : null,
    last_event_id: normalizeText(input.last_event_id) || null,
    last_event_type: normalizeText(input.last_event_type) || null,
    last_event_at: toIsoTimestamp(input.last_event_at) || null,
    raw_subscription:
      input.raw_subscription && Object.keys(input.raw_subscription).length > 0
        ? input.raw_subscription
        : {},
    raw_hostedpage:
      input.raw_hostedpage && Object.keys(input.raw_hostedpage).length > 0
        ? input.raw_hostedpage
        : {},
  };

  const result = await admin.from("buyer_billing_subscriptions").upsert(payload, {
    onConflict: "buyer_id,puppy_id,provider",
  });

  if (result.error) {
    if (isMissingTableError(result.error)) {
      throw new Error(
        "Zoho Billing subscription storage is not available yet. Apply the Supabase migration 20260409_zoho_billing_subscriptions.sql first."
      );
    }

    throw new Error(result.error.message);
  }

  return loadBillingRecordByBuyer(admin, payload.buyer_id, payload.puppy_id);
}

async function loadBillingContext(
  admin: SupabaseClient,
  input: { buyerId: number; puppyId?: number | null }
) {
  const buyerResult = await admin
    .from("buyers")
    .select(
      "id,user_id,puppy_id,full_name,name,email,phone,address_line1,address_line2,city,state,postal_code,sale_price,deposit_amount,finance_enabled,finance_rate,finance_months,finance_monthly_amount,finance_day_of_month,finance_next_due_date,finance_last_payment_date"
    )
    .eq("id", input.buyerId)
    .limit(1)
    .maybeSingle<BillingBuyer>();

  if (buyerResult.error || !buyerResult.data) {
    throw new Error("Buyer record not found for the Zoho Billing payment plan.");
  }

  const puppyId = Number(input.puppyId || buyerResult.data.puppy_id || 0) || null;
  const puppyResult = puppyId
    ? await admin
        .from("puppies")
        .select("id,buyer_id,call_name,puppy_name,name")
        .eq("id", puppyId)
        .limit(1)
        .maybeSingle<BillingPuppy>()
    : { data: null, error: null };

  if (puppyResult.error) {
    throw new Error(puppyResult.error.message);
  }

  return {
    buyer: buyerResult.data,
    puppy: puppyResult.data || null,
    record: await loadBillingRecordByBuyer(admin, buyerResult.data.id, puppyId),
  } satisfies BillingContext;
}

function buildCustomerAddress(buyer: BillingBuyer) {
  const street = [buyer.address_line1, buyer.address_line2].filter(Boolean).join(", ").trim();
  const city = normalizeText(buyer.city);
  const state = normalizeText(buyer.state);
  const zip = normalizeText(buyer.postal_code);

  if (!(street || city || state || zip)) {
    return null;
  }

  return {
    attention: buyerDisplayName(buyer),
    street: street || undefined,
    city: city || undefined,
    state: state || undefined,
    zip: zip || undefined,
    country: "United States",
  };
}

async function ensureBillingCustomer(context: BillingContext): Promise<ZohoBillingCustomer> {
  if (context.record?.customer_id) {
    return {
      customer_id: context.record.customer_id,
      display_name: context.record.customer_name,
      email: context.record.customer_email,
    };
  }

  const email = normalizeText(context.buyer.email);
  if (!email) {
    throw new Error("The buyer needs an email address before a Zoho Billing subscription can be created.");
  }

  const existingCustomers = await listZohoBillingCustomers({
    query: email,
    limit: 1000,
  });
  const matchingCustomer =
    existingCustomers.find((row) => normalizeLower(row.email) === normalizeLower(email)) || null;

  if (matchingCustomer?.customer_id) {
    return matchingCustomer;
  }

  const { firstName, lastName } = splitName(buyerDisplayName(context.buyer));
  return createZohoBillingCustomer({
    displayName: buyerDisplayName(context.buyer),
    email,
    firstName,
    lastName,
    phone: firstString(context.buyer.phone) || undefined,
    currencyCode: "USD",
    billingAddress: buildCustomerAddress(context.buyer),
  });
}

function buildSubscriptionRecordUpdate(input: {
  context: BillingContext;
  customer?: ZohoBillingCustomer | null;
  subscription?: ZohoBillingSubscription | null;
  hostedPage?: ZohoBillingHostedPageDetails | ZohoBillingHostedPage | null;
  eventId?: string | null;
  eventType?: string | null;
  eventTime?: string | null;
  lastPaymentAt?: string | null;
  lastPaymentAmount?: number | null;
}) {
  const subscription = input.subscription;
  const hostedPage = input.hostedPage;

  return {
    buyer_id: input.context.buyer.id,
    puppy_id: input.context.puppy?.id ?? null,
    reference_id:
      firstString(
        subscription?.reference_id,
        input.context.record?.reference_id,
        buildBuyerBillingReference({
          buyerId: input.context.buyer.id,
          puppyId: input.context.puppy?.id ?? null,
        })
      ) || buildBuyerBillingReference({
        buyerId: input.context.buyer.id,
        puppyId: input.context.puppy?.id ?? null,
      }),
    customer_id:
      firstString(
        subscription?.customer?.customer_id,
        input.customer?.customer_id,
        input.context.record?.customer_id
      ) || null,
    customer_email:
      firstString(
        subscription?.customer?.email,
        input.customer?.email,
        input.context.buyer.email,
        input.context.record?.customer_email
      ) || null,
    customer_name:
      firstString(
        subscription?.customer?.display_name,
        input.customer?.display_name,
        buyerDisplayName(input.context.buyer),
        input.context.record?.customer_name
      ) || null,
    subscription_id:
      firstString(subscription?.subscription_id, input.context.record?.subscription_id) || null,
    subscription_status:
      firstString(subscription?.status, input.context.record?.subscription_status) || null,
    hostedpage_id:
      firstString(hostedPage?.hostedpage_id, input.context.record?.hostedpage_id) || null,
    hostedpage_url:
      firstString(hostedPage?.url, input.context.record?.hostedpage_url) || null,
    hostedpage_expires_at:
      firstString(hostedPage?.expiring_time, input.context.record?.hostedpage_expires_at) || null,
    plan_code:
      firstString(
        subscription?.plan?.plan_code,
        input.context.record?.plan_code,
        getZohoBillingDefaultPlanCode()
      ) || null,
    plan_name:
      firstString(subscription?.plan?.name, input.context.record?.plan_name) || null,
    recurring_price:
      normalizeMoney(
        subscription?.plan?.price ??
          subscription?.amount ??
          input.context.record?.recurring_price ??
          input.context.buyer.finance_monthly_amount
      ) ?? null,
    currency_code:
      firstString(subscription?.currency_code, input.context.record?.currency_code, "USD") || "USD",
    interval_count: subscription?.interval ?? input.context.record?.interval_count ?? 1,
    interval_unit:
      firstString(subscription?.interval_unit, input.context.record?.interval_unit) || null,
    billing_cycles:
      subscription?.plan?.billing_cycles ??
      input.context.record?.billing_cycles ??
      input.context.buyer.finance_months ??
      null,
    current_term_ends_at:
      firstString(subscription?.current_term_ends_at, input.context.record?.current_term_ends_at) || null,
    next_billing_at:
      firstString(subscription?.next_billing_at, input.context.record?.next_billing_at) || null,
    started_at:
      firstString(
        subscription?.starts_at,
        subscription?.created_at,
        input.context.record?.started_at,
        input.context.buyer.finance_next_due_date
      ) || null,
    last_payment_at:
      firstString(input.lastPaymentAt, input.context.record?.last_payment_at) || null,
    last_payment_amount:
      normalizeMoney(input.lastPaymentAmount ?? input.context.record?.last_payment_amount) ?? null,
    card_last_four:
      firstString(subscription?.card?.last_four_digits, input.context.record?.card_last_four) || null,
    card_expiry_month:
      subscription?.card?.expiry_month ??
      input.context.record?.card_expiry_month ??
      null,
    card_expiry_year:
      subscription?.card?.expiry_year ??
      input.context.record?.card_expiry_year ??
      null,
    last_event_id:
      firstString(input.eventId, input.context.record?.last_event_id) || null,
    last_event_type:
      firstString(input.eventType, input.context.record?.last_event_type) || null,
    last_event_at:
      firstString(input.eventTime, input.context.record?.last_event_at) || null,
    raw_subscription: subscription
      ? (subscription as unknown as Record<string, unknown>)
      : input.context.record?.raw_subscription || {},
    raw_hostedpage: hostedPage
      ? (hostedPage as unknown as Record<string, unknown>)
      : input.context.record?.raw_hostedpage || {},
  };
}

async function refreshRecordFromRemote(
  admin: SupabaseClient,
  context: BillingContext,
  hints: {
    subscriptionId?: string | null;
    hostedPageId?: string | null;
    eventId?: string | null;
    eventType?: string | null;
    eventTime?: string | null;
  } = {}
) {
  if (firstString(hints.subscriptionId, context.record?.subscription_id)) {
    const subscription = await retrieveZohoBillingSubscription(
      firstString(hints.subscriptionId, context.record?.subscription_id)
    );

    return persistBillingRecord(
      admin,
      buildSubscriptionRecordUpdate({
        context,
        subscription,
        eventId: hints.eventId,
        eventType: hints.eventType,
        eventTime: hints.eventTime,
      })
    );
  }

  if (firstString(hints.hostedPageId, context.record?.hostedpage_id)) {
    const hostedPage = await retrieveZohoBillingHostedPage(
      firstString(hints.hostedPageId, context.record?.hostedpage_id)
    );

    return persistBillingRecord(
      admin,
      buildSubscriptionRecordUpdate({
        context,
        subscription: hostedPage.data?.subscription || null,
        hostedPage,
        eventId: hints.eventId,
        eventType: hints.eventType,
        eventTime: hints.eventTime,
      })
    );
  }

  return context.record;
}

function inferEventData(payload: Record<string, unknown> | null) {
  if (!payload) {
    return {
      subscription: null as Record<string, unknown> | null,
      invoice: null as Record<string, unknown> | null,
      payment: null as Record<string, unknown> | null,
      referenceId: null as string | null,
      subscriptionId: null as string | null,
      customerId: null as string | null,
      customerEmail: null as string | null,
      customerName: null as string | null,
      amount: null as number | null,
      paymentId: null as string | null,
      paymentDate: null as string | null,
      invoiceId: null as string | null,
      invoiceNumber: null as string | null,
    };
  }

  const subscription = firstObjectByKeys(payload, ["subscription"]);
  const invoice = firstObjectByKeys(payload, ["invoice"]);
  const payment =
    firstObjectByKeys(payload, ["payment"]) ||
    (firstArrayByKeys(payload, ["payments"]) || []).find((item) => isPlainObject(item)) ||
    null;

  return {
    subscription,
    invoice,
    payment: isPlainObject(payment) ? payment : null,
    referenceId:
      firstStringByKeys(subscription, ["reference_id"]) ||
      firstStringByKeys(payload, ["reference_id"]),
    subscriptionId:
      firstStringByKeys(subscription, ["subscription_id"]) ||
      firstStringByKeys(payload, ["subscription_id"]),
    customerId:
      firstStringByKeys(subscription?.customer, ["customer_id"]) ||
      firstStringByKeys(invoice, ["customer_id"]) ||
      firstStringByKeys(payload, ["customer_id"]),
    customerEmail:
      firstStringByKeys(subscription?.customer, ["email"]) ||
      firstStringByKeys(invoice, ["email", "customer_email"]) ||
      firstStringByKeys(payload, ["email", "customer_email"]),
    customerName:
      firstStringByKeys(subscription?.customer, ["display_name"]) ||
      firstStringByKeys(invoice, ["customer_name"]) ||
      firstStringByKeys(payload, ["customer_name", "display_name"]),
    amount:
      firstNumberByKeys(payment, ["amount"]) ||
      firstNumberByKeys(invoice, ["amount", "total"]) ||
      firstNumberByKeys(subscription, ["amount"]) ||
      null,
    paymentId:
      firstStringByKeys(payment, ["payment_id", "invoice_payment_id", "reference_number"]) ||
      firstStringByKeys(payload, ["payment_id"]),
    paymentDate:
      firstStringByKeys(payment, ["date", "payment_date"]) ||
      firstStringByKeys(invoice, ["invoice_date", "date"]) ||
      firstStringByKeys(payload, ["date"]),
    invoiceId: firstStringByKeys(invoice, ["invoice_id"]),
    invoiceNumber: firstStringByKeys(invoice, ["number"]),
  };
}

async function createBillingAlert(
  admin: SupabaseClient,
  input: {
    eventId: string;
    eventType: string;
    buyerId: number;
    puppyId?: number | null;
    userId?: string | null;
    subscriptionId?: string | null;
    message: string;
    tone: "success" | "warning" | "danger" | "neutral";
    title: string;
    meta?: Record<string, unknown>;
  }
) {
  try {
    const { error } = await admin.from("chichi_admin_alerts").upsert(
      {
        external_event_id: input.eventId,
        event_type: input.eventType,
        alert_scope: "payment",
        title: input.title,
        message: input.message,
        tone: input.tone,
        buyer_id: input.buyerId,
        puppy_id: input.puppyId || null,
        user_id: input.userId || null,
        payment_id: input.subscriptionId || null,
        payment_link_id: null,
        reference_id: null,
        source: "zoho_billing",
        meta: input.meta || {},
      },
      { onConflict: "external_event_id" }
    );

    if (error && !isMissingTableError(error)) {
      throw new Error(error.message);
    }
  } catch (error) {
    if (!isMissingTableError(error)) {
      throw error;
    }
  }
}

function billingAlertPresentation(eventType: string) {
  const normalized = normalizeLower(eventType);
  if (normalized === "payment_thankyou") {
    return {
      title: "Subscription payment received",
      tone: "success" as const,
    };
  }

  if (["payment_declined", "subscription_unpaid"].includes(normalized)) {
    return {
      title: "Subscription payment failed",
      tone: "danger" as const,
    };
  }

  if (["subscription_cancelled", "subscription_expired"].includes(normalized)) {
    return {
      title: "Subscription closed",
      tone: "warning" as const,
    };
  }

  if (
    ["subscription_created", "subscription_activation", "subscription_renewed", "subscription_reactivated"].includes(
      normalized
    )
  ) {
    return {
      title: "Subscription synced",
      tone: "success" as const,
    };
  }

  return {
    title: "Subscription update received",
    tone: "neutral" as const,
  };
}

async function recordBillingPayment(
  admin: SupabaseClient,
  input: {
    context: BillingContext;
    eventType: string;
    eventTime?: string | null;
    paymentId?: string | null;
    invoiceId?: string | null;
    invoiceNumber?: string | null;
    amount?: number | null;
    paymentDate?: string | null;
    subscription?: ZohoBillingSubscription | null;
  }
) {
  const amount = normalizeMoney(input.amount);
  if (!(amount && amount > 0)) {
    return null;
  }

  const paymentReference =
    firstString(
      input.paymentId,
      input.invoiceId,
      input.subscription?.subscription_id
        ? `${input.subscription.subscription_id}:${input.eventType}:${toIsoDate(input.paymentDate) || todayIso()}`
        : "",
      `${input.context.buyer.id}:${input.eventType}:${toIsoDate(input.paymentDate) || todayIso()}`
    ) || randomUUID();

  const paymentDate = toIsoDate(input.paymentDate || input.eventTime || "") || todayIso();
  const existing = await admin
    .from("buyer_payments")
    .select("id")
    .eq("reference_number", paymentReference)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existing.error) {
    throw new Error(existing.error.message);
  }

  const note = [
    "Recurring puppy payment plan charge",
    input.subscription?.plan?.name || input.context.record?.plan_name || "",
    input.invoiceNumber ? `Invoice ${input.invoiceNumber}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const paymentPayload = {
    buyer_id: input.context.buyer.id,
    puppy_id: input.context.puppy?.id ?? null,
    user_id: input.context.buyer.user_id || null,
    payment_date: paymentDate,
    amount,
    payment_type: "Installment Payment",
    method: "Zoho Billing Subscription",
    note,
    status: "recorded",
    reference_number: paymentReference,
  };

  if (existing.data?.id) {
    const update = await admin
      .from("buyer_payments")
      .update(paymentPayload)
      .eq("id", existing.data.id);

    if (update.error) {
      throw new Error(update.error.message);
    }
  } else {
    const insert = await admin.from("buyer_payments").insert(paymentPayload);
    if (insert.error) {
      throw new Error(insert.error.message);
    }
  }

  const buyerUpdate: Record<string, unknown> = {
    finance_last_payment_date: paymentDate,
  };

  const nextBillingAt = toIsoDate(input.subscription?.next_billing_at || input.context.record?.next_billing_at);
  if (nextBillingAt) {
    buyerUpdate.finance_next_due_date = nextBillingAt;
  }

  const buyerResult = await admin
    .from("buyers")
    .update(buyerUpdate)
    .eq("id", input.context.buyer.id);

  if (buyerResult.error) {
    throw new Error(buyerResult.error.message);
  }

  return {
    paymentDate,
    amount,
  };
}

export function serializeBuyerBillingSubscription(record: BuyerBillingSubscriptionRecord | null) {
  return sanitizeRecord(record);
}

export async function loadBuyerBillingSubscription(
  admin: SupabaseClient,
  input: { buyerId: number; puppyId?: number | null }
) {
  return loadBillingRecordByBuyer(admin, input.buyerId, input.puppyId);
}

export async function createBuyerBillingSubscriptionCheckout(input: {
  admin: SupabaseClient;
  buyerId: number;
  puppyId?: number | null;
  requestUrl: string;
}) {
  const context = await loadBillingContext(input.admin, {
    buyerId: input.buyerId,
    puppyId: input.puppyId,
  });

  if (!context.buyer.finance_enabled) {
    throw new Error("Enable financing on this puppy account before creating a Zoho Billing subscription.");
  }

  const monthlyAmount = normalizeMoney(context.buyer.finance_monthly_amount);
  if (!(monthlyAmount && monthlyAmount > 0)) {
    throw new Error("Add the monthly payment amount before creating the Zoho Billing subscription.");
  }

  if (context.record && isActiveLikeSubscriptionStatus(context.record.subscription_status)) {
    throw new Error("This puppy payment plan already has an active Zoho Billing subscription.");
  }

  if (hostedPageExpiryActive(context.record)) {
    return {
      record: sanitizeRecord(context.record) as BuyerBillingSubscriptionRecord,
      url: context.record?.hostedpage_url || "",
      hostedPageId: context.record?.hostedpage_id || "",
      reusedExisting: true,
    } satisfies HostedCheckoutResult;
  }

  const customer = await ensureBillingCustomer(context);
  const redirectUrl = new URL("/portal/payments", input.requestUrl).toString();
  const referenceId =
    context.record?.reference_id ||
    buildBuyerBillingReference({
      buyerId: context.buyer.id,
      puppyId: context.puppy?.id ?? null,
    });

  const hostedPage = await createZohoBillingSubscriptionHostedPage({
    customerId: customer.customer_id,
    planCode: getZohoBillingDefaultPlanCode() || "",
    price: monthlyAmount,
    quantity: 1,
    billingCycles:
      context.buyer.finance_months !== null && context.buyer.finance_months !== undefined
        ? Number(context.buyer.finance_months)
        : null,
    referenceId,
    startsAt: context.buyer.finance_next_due_date || null,
    redirectUrl,
    customFields: [
      { label: "buyer_id", value: String(context.buyer.id) },
      { label: "puppy_id", value: String(context.puppy?.id || "") },
      { label: "puppy_name", value: puppyDisplayName(context.puppy) },
    ],
  });

  const record = await persistBillingRecord(
    input.admin,
    buildSubscriptionRecordUpdate({
      context,
      customer,
      hostedPage,
    })
  );

  if (!record?.hostedpage_url || !record.hostedpage_id) {
    throw new Error("Could not save the Zoho Billing checkout details.");
  }

  return {
    record,
    url: record.hostedpage_url,
    hostedPageId: record.hostedpage_id,
    reusedExisting: false,
  } satisfies HostedCheckoutResult;
}

export async function createBuyerBillingPaymentMethodCheckout(input: {
  admin: SupabaseClient;
  buyerId: number;
  puppyId?: number | null;
  requestUrl: string;
}) {
  const context = await loadBillingContext(input.admin, {
    buyerId: input.buyerId,
    puppyId: input.puppyId,
  });

  const redirectUrl = new URL("/portal/payments", input.requestUrl).toString();
  const customer =
    context.record?.customer_id
      ? ({
          customer_id: context.record.customer_id,
          email: context.record.customer_email,
          display_name: context.record.customer_name,
        } as ZohoBillingCustomer)
      : await ensureBillingCustomer(context);
  const subscriptionId = firstString(context.record?.subscription_id);
  const paymentMethod = resolveSavedPaymentMethodIds(context.record);

  const hostedPage =
    paymentMethod.cardId || paymentMethod.accountId || paymentMethod.paypalId
      ? await createZohoBillingUpdatePaymentMethodHostedPage({
          cardId: paymentMethod.cardId,
          accountId: paymentMethod.accountId,
          paypalId: paymentMethod.paypalId,
          redirectUrl,
        })
      : subscriptionId && context.record?.card_last_four
        ? await createZohoBillingUpdateCardHostedPage({
            subscriptionId,
            redirectUrl,
          })
        : await createZohoBillingAddPaymentMethodHostedPage({
            customerId: customer.customer_id,
            redirectUrl,
          });

  const record = await persistBillingRecord(
    input.admin,
    buildSubscriptionRecordUpdate({
      context,
      customer,
      hostedPage,
    })
  );

  if (!record?.hostedpage_url || !record.hostedpage_id) {
    throw new Error("Could not save the Zoho Billing payment-method page.");
  }

  return {
    record,
    url: record.hostedpage_url,
    hostedPageId: record.hostedpage_id,
    reusedExisting: false,
  } satisfies HostedCheckoutResult;
}

export async function createBuyerBillingUpdateCardCheckout(input: {
  admin: SupabaseClient;
  buyerId: number;
  puppyId?: number | null;
  requestUrl: string;
}) {
  return createBuyerBillingPaymentMethodCheckout(input);
}

export async function refreshBuyerBillingSubscription(input: {
  admin: SupabaseClient;
  buyerId: number;
  puppyId?: number | null;
}) {
  const context = await loadBillingContext(input.admin, {
    buyerId: input.buyerId,
    puppyId: input.puppyId,
  });

  if (!(context.record?.subscription_id || context.record?.hostedpage_id)) {
    return context.record;
  }

  return refreshRecordFromRemote(input.admin, context);
}

export async function syncZohoBillingEvent(input: {
  admin: SupabaseClient;
  eventId?: string | null;
  eventType?: string | null;
  eventTime?: string | null;
  payload?: string | Record<string, unknown> | null;
  rawPayload?: Record<string, unknown> | null;
}) {
  const payloadObject = parseEventPayload(input.payload);
  const eventType =
    firstString(input.eventType, firstStringByKeys(payloadObject, ["event_type"]) || "") || "update";
  const eventTime =
    firstString(input.eventTime, firstStringByKeys(payloadObject, ["event_time"]) || "") ||
    new Date().toISOString();
  const inferred = inferEventData(payloadObject);

  let record =
    (inferred.referenceId && (await loadBillingRecordByReference(input.admin, inferred.referenceId))) ||
    (inferred.subscriptionId &&
      (await loadBillingRecordBySubscriptionId(input.admin, inferred.subscriptionId))) ||
    (inferred.customerId && (await loadBillingRecordByCustomerId(input.admin, inferred.customerId))) ||
    null;

  if (!record && inferred.referenceId) {
    const parsedReference = parseBuyerBillingReference(inferred.referenceId);
    if (parsedReference?.buyerId) {
      const context = await loadBillingContext(input.admin, {
        buyerId: parsedReference.buyerId,
        puppyId: parsedReference.puppyId,
      });

      record = await persistBillingRecord(
        input.admin,
        buildSubscriptionRecordUpdate({
          context,
          eventId: input.eventId,
          eventType,
          eventTime,
        })
      );
    }
  }

  if (!record) {
    return {
      handled: false,
      record: null,
      eventType,
    };
  }

  const context = await loadBillingContext(input.admin, {
    buyerId: record.buyer_id,
    puppyId: record.puppy_id,
  });

  let subscription: ZohoBillingSubscription | null = null;
  try {
    if (firstString(inferred.subscriptionId, record.subscription_id)) {
      subscription = await retrieveZohoBillingSubscription(
        firstString(inferred.subscriptionId, record.subscription_id)
      );
    }
  } catch {
    subscription = (inferred.subscription as unknown as ZohoBillingSubscription | null) || null;
  }

  const paymentReceipt =
    eventType === "payment_thankyou"
      ? await recordBillingPayment(input.admin, {
          context,
          eventType,
          eventTime,
          paymentId: inferred.paymentId,
          invoiceId: inferred.invoiceId,
          invoiceNumber: inferred.invoiceNumber,
          amount: inferred.amount,
          paymentDate: inferred.paymentDate,
          subscription,
        })
      : null;

  const updatedRecord = await persistBillingRecord(
    input.admin,
    buildSubscriptionRecordUpdate({
      context,
      subscription,
      eventId: input.eventId,
      eventType,
      eventTime,
      lastPaymentAt: paymentReceipt?.paymentDate || context.record?.last_payment_at || null,
      lastPaymentAmount: paymentReceipt?.amount || context.record?.last_payment_amount || null,
    })
  );

  const alert = billingAlertPresentation(eventType);
  await createBillingAlert(input.admin, {
    eventId:
      firstString(input.eventId, `${record.reference_id}:${eventType}:${toIsoDate(eventTime) || todayIso()}`) ||
      `${record.reference_id}:${eventType}:${todayIso()}`,
    eventType,
    buyerId: context.buyer.id,
    puppyId: context.puppy?.id ?? null,
    userId: context.buyer.user_id || null,
    subscriptionId: firstString(updatedRecord?.subscription_id, record.subscription_id) || null,
    title: alert.title,
    tone: alert.tone,
    message: [
      buyerDisplayName(context.buyer),
      puppyDisplayName(context.puppy),
      firstString(subscription?.status, updatedRecord?.subscription_status, eventType),
      paymentReceipt?.amount ? `$${paymentReceipt.amount.toFixed(2)}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
    meta: {
      source: "zoho_billing",
      raw_payload: input.rawPayload || payloadObject || {},
    },
  });

  return {
    handled: true,
    record: updatedRecord,
    eventType,
  };
}

export async function syncZohoBillingHostedPage(input: {
  admin: SupabaseClient;
  hostedPageId: string;
  buyerId: number;
  puppyId?: number | null;
  eventId?: string | null;
  eventType?: string | null;
  eventTime?: string | null;
}) {
  const context = await loadBillingContext(input.admin, {
    buyerId: input.buyerId,
    puppyId: input.puppyId,
  });

  const hostedPage = await retrieveZohoBillingHostedPage(input.hostedPageId);
  return persistBillingRecord(
    input.admin,
    buildSubscriptionRecordUpdate({
      context,
      subscription: hostedPage.data?.subscription || null,
      hostedPage,
      eventId: input.eventId,
      eventType: input.eventType,
      eventTime: input.eventTime,
    })
  );
}
