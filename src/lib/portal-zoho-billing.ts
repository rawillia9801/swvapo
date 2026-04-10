import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createZohoBillingCustomer,
  createZohoBillingSubscriptionHostedPage,
  createZohoBillingUpdateCardHostedPage,
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
