import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  buildPortalChargeReference,
  buildPortalPaymentChargeSnapshot,
  describePortalCharge,
  parsePortalChargeReference,
  paymentTypeForPortalCharge,
  type PortalChargeKind,
} from "@/lib/portal-payment-options";
import type {
  PortalBuyer,
  PortalFeeCreditRecord,
  PortalPayment,
  PortalPickupRequest,
  PortalPuppy,
} from "@/lib/portal-data";
import { createZohoPaymentLink } from "@/lib/zoho-payments";

export type PortalZohoPaymentState = {
  buyer: PortalBuyer | null;
  puppy: PortalPuppy | null;
  payments: PortalPayment[];
  adjustments: PortalFeeCreditRecord[];
  pickupRequest: PortalPickupRequest | null;
};

type CreatePortalZohoPaymentLinkInput = {
  admin: SupabaseClient;
  user: User;
  requestUrl: string;
  chargeKind: PortalChargeKind;
  requestedAmount?: number | null;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
};

type SyncPortalZohoPaymentInput = {
  admin: SupabaseClient;
  source: "return" | "webhook";
  eventId?: string | null;
  eventType?: string | null;
  paymentLinkId?: string | null;
  paymentId?: string | null;
  amount?: string | number | null;
  status?: string | null;
  paymentLinkReference?: string | null;
  paymentDate?: string | number | null;
  currency?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  paymentMethod?: string | null;
  description?: string | null;
  emitAlert?: boolean;
  rawPayload?: Record<string, unknown> | null;
};

export type PortalZohoSyncResult = {
  ok: boolean;
  chargeKind: PortalChargeKind;
  buyerId: number;
  buyerName: string;
  puppyName: string;
  amount: number;
  recorded: boolean;
  paymentId: string | null;
};

function normalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function normalizeMoney(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

function firstString(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeSuccessStatus(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["paid", "succeeded", "success", "completed"].includes(normalized);
}

function resolvePaymentDate(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return new Date(value * 1000).toISOString().slice(0, 10);
  }

  const text = String(value || "").trim();
  if (!text) return todayIso();
  if (/^\d+$/.test(text)) {
    const unix = Number(text);
    if (Number.isFinite(unix) && unix > 0) {
      return new Date(unix * 1000).toISOString().slice(0, 10);
    }
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return todayIso();
  return date.toISOString().slice(0, 10);
}

function isMissingTableError(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error || "")).toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("schema cache")
  );
}

function toneForAlertStatus(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();
  if (["paid", "succeeded", "success", "completed"].includes(normalized)) return "success";
  if (["pending", "processing"].includes(normalized)) return "warning";
  return "danger";
}

function titleForAlertStatus(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();
  if (["paid", "succeeded", "success", "completed"].includes(normalized)) {
    return "Customer payment received";
  }
  if (["pending", "processing"].includes(normalized)) {
    return "Customer payment pending";
  }
  return "Customer payment update";
}

function paymentCountsTowardBalance(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return true;
  return !["failed", "void", "cancelled", "canceled"].includes(normalized);
}

function alertStatusKey(status: string | null | undefined, eventType: string | null | undefined) {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  if (["paid", "succeeded", "success", "completed"].includes(normalizedStatus)) return "success";
  if (["pending", "processing"].includes(normalizedStatus)) return "pending";
  if (["failed", "declined"].includes(normalizedStatus)) return "failed";
  if (["expired"].includes(normalizedStatus)) return "expired";
  if (["canceled", "cancelled"].includes(normalizedStatus)) return "canceled";

  const normalizedEvent = String(eventType || "").trim().toLowerCase();
  if (normalizedEvent.includes("paid") || normalizedEvent.includes("succeeded")) return "success";
  if (normalizedEvent.includes("pending")) return "pending";
  if (normalizedEvent.includes("failed")) return "failed";
  if (normalizedEvent.includes("expired")) return "expired";
  if (normalizedEvent.includes("canceled") || normalizedEvent.includes("cancelled")) return "canceled";

  return "update";
}

async function loadBuyerForUser(admin: SupabaseClient, user: User) {
  const email = normalizeEmail(user.email);

  const byUserId = await admin
    .from("buyers")
    .select(
      "id,user_id,puppy_id,full_name,name,email,phone,sale_price,deposit_amount,deposit_date,finance_enabled,finance_admin_fee,finance_rate,finance_months,finance_monthly_amount,finance_day_of_month,finance_next_due_date,finance_last_payment_date,delivery_fee,delivery_option,delivery_date,delivery_location,created_at"
    )
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle<PortalBuyer>();

  if (byUserId.error) throw new Error(byUserId.error.message);
  if (byUserId.data) return byUserId.data;

  if (!email) return null;

  const byEmail = await admin
    .from("buyers")
    .select(
      "id,user_id,puppy_id,full_name,name,email,phone,sale_price,deposit_amount,deposit_date,finance_enabled,finance_admin_fee,finance_rate,finance_months,finance_monthly_amount,finance_day_of_month,finance_next_due_date,finance_last_payment_date,delivery_fee,delivery_option,delivery_date,delivery_location,created_at"
    )
    .ilike("email", email)
    .limit(1)
    .maybeSingle<PortalBuyer>();

  if (byEmail.error) throw new Error(byEmail.error.message);
  return byEmail.data || null;
}

async function loadPuppyForBuyer(admin: SupabaseClient, user: User, buyer: PortalBuyer | null) {
  if (buyer?.id) {
    const byBuyer = await admin
      .from("puppies")
      .select("id,buyer_id,call_name,puppy_name,name,price,deposit,status,created_at")
      .eq("buyer_id", buyer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<PortalPuppy>();

    if (byBuyer.error) throw new Error(byBuyer.error.message);
    if (byBuyer.data) return byBuyer.data;
  }

  const fallbackPuppyId = Number(buyer?.puppy_id || 0);
  if (fallbackPuppyId) {
    const byId = await admin
      .from("puppies")
      .select("id,buyer_id,call_name,puppy_name,name,price,deposit,status,created_at")
      .eq("id", fallbackPuppyId)
      .limit(1)
      .maybeSingle<PortalPuppy>();

    if (byId.error) throw new Error(byId.error.message);
    if (byId.data) return byId.data;
  }

  const email = normalizeEmail(user.email);
  if (!email) return null;

  const byOwnerEmail = await admin
    .from("puppies")
    .select("id,buyer_id,call_name,puppy_name,name,price,deposit,status,created_at")
    .ilike("owner_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<PortalPuppy>();

  if (byOwnerEmail.error) throw new Error(byOwnerEmail.error.message);
  return byOwnerEmail.data || null;
}

export async function loadPortalZohoPaymentState(admin: SupabaseClient, user: User) {
  const buyer = await loadBuyerForUser(admin, user);
  const puppy = await loadPuppyForBuyer(admin, user, buyer);

  if (!buyer?.id) {
    return {
      buyer: null,
      puppy,
      payments: [] as PortalPayment[],
      adjustments: [] as PortalFeeCreditRecord[],
      pickupRequest: null as PortalPickupRequest | null,
    };
  }

  const [paymentsResult, adjustmentsResult, pickupResult] = await Promise.all([
    admin
      .from("buyer_payments")
      .select(
        "id,created_at,buyer_id,puppy_id,payment_date,amount,payment_type,method,note,status,reference_number"
      )
      .eq("buyer_id", buyer.id)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<PortalPayment[]>(),
    admin
      .from("buyer_fee_credit_records")
      .select(
        "id,created_at,buyer_id,puppy_id,entry_date,entry_type,label,description,amount,status,reference_number"
      )
      .eq("buyer_id", buyer.id)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<PortalFeeCreditRecord[]>(),
    admin
      .from("portal_pickup_requests")
      .select(
        "id,created_at,user_id,puppy_id,request_date,request_type,location_text,notes,status,address_text,miles"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<PortalPickupRequest>(),
  ]);

  if (paymentsResult.error) throw new Error(paymentsResult.error.message);
  if (adjustmentsResult.error) throw new Error(adjustmentsResult.error.message);
  if (pickupResult.error) throw new Error(pickupResult.error.message);

  return {
    buyer,
    puppy,
    payments: paymentsResult.data || [],
    adjustments: adjustmentsResult.data || [],
    pickupRequest: pickupResult.data || null,
  };
}

function validatePortalPaymentAmount(input: {
  amount: number;
  chargeKind: PortalChargeKind;
  currentBalance: number;
  finalBalanceDueNow: boolean;
  dueAmount: number;
}) {
  const amount = normalizeMoney(input.amount);
  const currentBalance = normalizeMoney(input.currentBalance);
  const dueAmount = normalizeMoney(input.dueAmount);

  if (!(amount > 0)) {
    throw new Error("Enter a valid payment amount.");
  }

  if (input.chargeKind === "general") {
    if (!(currentBalance > 0)) {
      throw new Error("There is no balance currently due on this account.");
    }
    if (amount > currentBalance + 0.001) {
      throw new Error("That amount is higher than the current balance on this account.");
    }
    if (input.finalBalanceDueNow && amount < currentBalance - 0.001) {
      throw new Error(
        "The full remaining balance must be paid before your scheduled receive date, so only the full balance can be paid right now."
      );
    }
    return;
  }

  if (!(dueAmount > 0)) {
    if (input.chargeKind === "deposit") {
      throw new Error("There is no deposit currently due on this account.");
    }
    if (input.chargeKind === "transportation") {
      throw new Error("There is no transportation fee currently due on this account.");
    }
    throw new Error("There is no installment currently due on this account.");
  }

  if (input.finalBalanceDueNow && dueAmount < currentBalance - 0.001) {
    throw new Error(
      "The full remaining balance must be paid before your scheduled receive date, so partial payment links are no longer available."
    );
  }
}

export async function createPortalZohoPaymentLink(input: CreatePortalZohoPaymentLinkInput) {
  const state = await loadPortalZohoPaymentState(input.admin, input.user);
  if (!state.buyer?.id) {
    throw new Error("We could not find a buyer account linked to this portal login.");
  }

  const snapshot = buildPortalPaymentChargeSnapshot(state);
  const requestedAmount = normalizeMoney(input.requestedAmount);
  const dueAmount =
    input.chargeKind === "deposit"
      ? snapshot.depositDue
      : input.chargeKind === "transportation"
        ? snapshot.transportationDue
        : input.chargeKind === "installment"
          ? snapshot.installmentDue
          : snapshot.generalDue;
  const resolvedAmount = input.chargeKind === "general" ? requestedAmount : dueAmount;

  validatePortalPaymentAmount({
    amount: resolvedAmount,
    chargeKind: input.chargeKind,
    currentBalance: snapshot.currentBalance,
    finalBalanceDueNow: snapshot.finalBalanceDueNow,
    dueAmount,
  });

  const referenceId = buildPortalChargeReference({
    buyerId: state.buyer.id,
    puppyId: state.puppy?.id ?? null,
    chargeKind: input.chargeKind,
  });
  const returnUrl = new URL("/api/portal/payments/zoho/return", input.requestUrl).toString();
  const description =
    firstString(input.description) || describePortalCharge(input.chargeKind, snapshot.puppyName);

  const paymentLink = await createZohoPaymentLink({
    amount: resolvedAmount,
    currency: "USD",
    email: firstString(input.email, state.buyer.email, input.user.email || undefined) || undefined,
    phone: firstString(input.phone, state.buyer.phone) || undefined,
    description,
    referenceId,
    returnUrl,
    sendEmail: false,
  });

  return {
    state,
    snapshot,
    amount: resolvedAmount,
    description,
    chargeKind: input.chargeKind,
    url: paymentLink.url,
    paymentLinkId: paymentLink.payment_link_id,
    referenceId,
    returnUrl,
  };
}

async function createAdminPaymentAlert(
  admin: SupabaseClient,
  input: {
    externalEventId: string;
    eventType: string | null | undefined;
    buyerId: number;
    userId: string | null | undefined;
    puppyId: number | null | undefined;
    paymentId: string | null | undefined;
    paymentLinkId: string | null | undefined;
    referenceId: string | null | undefined;
    title: string;
    message: string;
    tone: "success" | "warning" | "danger";
    meta?: Record<string, unknown> | null;
  }
) {
  try {
    const { error } = await admin.from("chichi_admin_alerts").upsert(
      {
        external_event_id: input.externalEventId,
        event_type: input.eventType || null,
        alert_scope: "payment",
        title: input.title,
        message: input.message,
        tone: input.tone,
        buyer_id: input.buyerId,
        puppy_id: input.puppyId || null,
        user_id: input.userId || null,
        payment_id: input.paymentId || null,
        payment_link_id: input.paymentLinkId || null,
        reference_id: input.referenceId || null,
        source: "zoho_payments",
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

export async function syncPortalZohoPayment(input: SyncPortalZohoPaymentInput) {
  const parsedReference = parsePortalChargeReference(input.paymentLinkReference);
  if (!parsedReference) {
    throw new Error("Invalid portal payment reference.");
  }

  const buyerResult = await input.admin
    .from("buyers")
    .select("id,user_id,full_name,name,email,deposit_amount,deposit_date,finance_last_payment_date")
    .eq("id", parsedReference.buyerId)
    .limit(1)
    .maybeSingle<{
      id: number;
      user_id?: string | null;
      full_name?: string | null;
      name?: string | null;
      email?: string | null;
      deposit_amount?: number | null;
      deposit_date?: string | null;
      finance_last_payment_date?: string | null;
    }>();

  if (buyerResult.error || !buyerResult.data) {
    throw new Error("Buyer account not found for Zoho payment sync.");
  }

  const puppyResult = parsedReference.puppyId
    ? await input.admin
        .from("puppies")
        .select("id,call_name,puppy_name,name")
        .eq("id", parsedReference.puppyId)
        .limit(1)
        .maybeSingle<{ id: number; call_name?: string | null; puppy_name?: string | null; name?: string | null }>()
    : { data: null, error: null };

  if (puppyResult.error) {
    throw new Error(puppyResult.error.message);
  }

  const amount = normalizeMoney(input.amount);
  const paymentId = firstString(input.paymentId) || null;
  const paymentDate = resolvePaymentDate(input.paymentDate);
  const buyerName =
    firstString(input.customerName, buyerResult.data.full_name, buyerResult.data.name) || "Customer";
  const puppyName =
    firstString(puppyResult.data?.call_name, puppyResult.data?.puppy_name, puppyResult.data?.name) ||
    "your puppy";

  const existingPayment = paymentId
    ? await input.admin
        .from("buyer_payments")
        .select("id,status")
        .eq("reference_number", paymentId)
        .limit(1)
        .maybeSingle<{ id: string; status?: string | null }>()
    : { data: null, error: null };

  if (existingPayment.error) {
    throw new Error(existingPayment.error.message);
  }

  let recorded = false;

  if (normalizeSuccessStatus(input.status)) {
    const paymentPayload = {
      buyer_id: buyerResult.data.id,
      puppy_id: parsedReference.puppyId,
      user_id: buyerResult.data.user_id || null,
      payment_date: paymentDate,
      amount,
      payment_type: paymentTypeForPortalCharge(parsedReference.chargeKind),
      method: firstString(input.paymentMethod, "Zoho Payments"),
      note: `${describePortalCharge(parsedReference.chargeKind, puppyName)} via Zoho payment link ${firstString(input.paymentLinkId)}`.trim(),
      status: "recorded",
      reference_number: paymentId,
    };

    if (existingPayment.data?.id) {
      const updateResult = await input.admin
        .from("buyer_payments")
        .update(paymentPayload)
        .eq("id", existingPayment.data.id);

      if (updateResult.error) {
        throw new Error(updateResult.error.message);
      }
    } else {
      const insertResult = await input.admin.from("buyer_payments").insert(paymentPayload);
      if (insertResult.error) {
        throw new Error(insertResult.error.message);
      }
    }

    if (parsedReference.chargeKind === "deposit") {
      const updateResult = await input.admin
        .from("buyers")
        .update({
          deposit_amount:
            buyerResult.data.deposit_amount && Number(buyerResult.data.deposit_amount) > 0
              ? buyerResult.data.deposit_amount
              : amount,
          deposit_date: buyerResult.data.deposit_date || paymentDate,
        })
        .eq("id", buyerResult.data.id);

      if (updateResult.error) {
        throw new Error(updateResult.error.message);
      }
    }

    if (parsedReference.chargeKind === "installment" || parsedReference.chargeKind === "general") {
      const updateResult = await input.admin
        .from("buyers")
        .update({
          finance_last_payment_date: paymentDate,
        })
        .eq("id", buyerResult.data.id);

      if (updateResult.error) {
        throw new Error(updateResult.error.message);
      }
    }

    if (parsedReference.chargeKind === "general" && !buyerResult.data.deposit_date) {
      const configuredDeposit = normalizeMoney(buyerResult.data.deposit_amount);
      if (configuredDeposit > 0) {
        const totalsResult = await input.admin
          .from("buyer_payments")
          .select("amount,status")
          .eq("buyer_id", buyerResult.data.id)
          .returns<Array<{ amount?: number | null; status?: string | null }>>();

        if (totalsResult.error) {
          throw new Error(totalsResult.error.message);
        }

        const totalRecordedCredits = (totalsResult.data || []).reduce((sum, row) => {
          if (!paymentCountsTowardBalance(row.status)) return sum;
          return sum + Math.max(0, normalizeMoney(row.amount));
        }, 0);

        if (totalRecordedCredits >= configuredDeposit - 0.01) {
          const updateDepositResult = await input.admin
            .from("buyers")
            .update({
              deposit_date: paymentDate,
            })
            .eq("id", buyerResult.data.id);

          if (updateDepositResult.error) {
            throw new Error(updateDepositResult.error.message);
          }
        }
      }
    }

    recorded = true;
  }

  if (input.emitAlert) {
    const amountLabel = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(input.currency || "USD").trim().toUpperCase() || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
    const alertMessage = [
      `${buyerName} - ${amountLabel} - ${parsedReference.chargeKind} - ${String(input.status || "updated").toLowerCase()}`,
      firstString(input.description, describePortalCharge(parsedReference.chargeKind, puppyName)),
      paymentId ? `Payment ID: ${paymentId}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    await createAdminPaymentAlert(input.admin, {
      externalEventId:
        (paymentId
          ? `payment:${paymentId}:${alertStatusKey(input.status, input.eventType)}`
          : "") ||
        firstString(input.eventId) ||
        [input.source, firstString(input.eventType), paymentId || firstString(input.paymentLinkId)].filter(Boolean).join(":"),
      eventType: input.eventType,
      buyerId: buyerResult.data.id,
      userId: buyerResult.data.user_id,
      puppyId: parsedReference.puppyId,
      paymentId,
      paymentLinkId: firstString(input.paymentLinkId) || null,
      referenceId: input.paymentLinkReference,
      title: titleForAlertStatus(input.status),
      message: alertMessage,
      tone: toneForAlertStatus(input.status),
      meta: {
        amount,
        charge_kind: parsedReference.chargeKind,
        buyer_name: buyerName,
        customer_email: firstString(input.customerEmail, buyerResult.data.email),
        payment_method: input.paymentMethod || null,
        source: input.source,
        recorded,
        ...(input.rawPayload ? { payload: input.rawPayload } : {}),
      },
    });
  }

  return {
    ok: true,
    chargeKind: parsedReference.chargeKind,
    buyerId: buyerResult.data.id,
    buyerName,
    puppyName,
    amount,
    recorded,
    paymentId,
  } satisfies PortalZohoSyncResult;
}
