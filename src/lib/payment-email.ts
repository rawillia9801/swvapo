import "server-only";
import * as React from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import PaymentPlanEmail, {
  type PaymentPlanEmailKind,
} from "@/emails/payment-plan-email";
import {
  BUYER_PAYMENT_NOTICE_LOG_TABLES,
  chooseFirstAvailableTable,
  queryBuyerPaymentNoticeLogs,
} from "@/lib/admin-data-compat";
import { getResendClient, hasResendConfiguration } from "@/lib/resend";

export type BuyerPaymentNoticeSettings = {
  id?: number;
  created_at?: string;
  updated_at?: string;
  buyer_id: number;
  enabled: boolean;
  receipt_enabled: boolean;
  due_reminder_enabled: boolean;
  due_reminder_days_before: number;
  late_notice_enabled: boolean;
  late_notice_days_after: number;
  default_notice_enabled: boolean;
  default_notice_days_after: number;
  recipient_email: string | null;
  cc_emails: string[];
  internal_note: string | null;
};

export type BuyerPaymentNoticeLog = {
  id: number;
  created_at: string;
  buyer_id: number;
  puppy_id?: number | null;
  payment_id?: string | null;
  notice_kind: string;
  notice_key: string;
  notice_date?: string | null;
  due_date?: string | null;
  status: string;
  recipient_email: string;
  subject: string;
  provider: string;
  provider_message_id?: string | null;
  meta?: Record<string, unknown> | null;
};

type BuyerRow = {
  id: number;
  user_id?: string | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  sale_price?: number | null;
  deposit_amount?: number | null;
  finance_enabled?: boolean | null;
  finance_rate?: number | null;
  finance_months?: number | null;
  finance_monthly_amount?: number | null;
  finance_next_due_date?: string | null;
  finance_last_payment_date?: string | null;
};

type PuppyRow = {
  id: number;
  call_name?: string | null;
  puppy_name?: string | null;
  name?: string | null;
  price?: number | null;
  deposit?: number | null;
};

type PaymentRow = {
  id: string;
  buyer_id: number;
  puppy_id?: number | null;
  payment_date: string;
  amount: number;
  payment_type?: string | null;
  method?: string | null;
  note?: string | null;
  status?: string | null;
  reference_number?: string | null;
};

type AdjustmentRow = {
  buyer_id: number;
  entry_type?: string | null;
  amount: number;
  status?: string | null;
};

type BillingRow = {
  buyer_id: number;
  next_billing_at?: string | null;
  recurring_price?: number | null;
  plan_code?: string | null;
  plan_name?: string | null;
  subscription_status?: string | null;
};

type NoticeContext = {
  buyer: BuyerRow;
  puppies: PuppyRow[];
  payments: PaymentRow[];
  adjustments: AdjustmentRow[];
  billing: BillingRow | null;
  settings: BuyerPaymentNoticeSettings;
  dueDate: string | null;
  monthlyAmount: number | null;
  balance: number;
  puppyLabel: string;
  buyerLabel: string;
};

type StoredMessageTemplateRow = {
  template_key?: string | null;
  subject?: string | null;
  body?: string | null;
  is_active?: boolean | null;
};

type NoticePresentation = {
  subject: string;
  preview: string;
  messageLead: string;
  supportingCopy: string;
  amountLabel?: string;
  dueDateLabel?: string;
  balanceLabel?: string;
  monthlyAmountLabel?: string;
  paymentMethodLabel?: string;
  referenceLabel?: string;
  actionLabel?: string;
  actionHref?: string;
  footerNote?: string;
  templateKey?: string | null;
};

type SendNoticeEmailResult = {
  ok: boolean;
  sent: boolean;
  skippedReason?: string;
  subject?: string;
  recipientEmail?: string | null;
  noticeKey?: string;
};

type ReceiptSendInput = {
  paymentId: string;
  force?: boolean;
};

type ScheduledSendResult = {
  processed: number;
  sent: number;
  skipped: number;
  failures: Array<{ buyerId: number; message: string }>;
};

function normalizeText(value: unknown) {
  const text = String(value || "").trim();
  return text || "";
}

function normalizeOptionalText(value: unknown) {
  const text = normalizeText(value);
  return text || null;
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function normalizeMoney(value: unknown) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toIsoDate(value: unknown) {
  const text = normalizeText(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function firstString(...values: Array<unknown>) {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) return text;
  }
  return "";
}

function formatMoney(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatLongDate(value: string | null | undefined) {
  if (!value) return "No date scheduled";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function paymentCountsTowardBalance(status: string | null | undefined) {
  const normalized = normalizeText(status).toLowerCase();
  if (!normalized) return true;
  return !["failed", "void", "cancelled", "canceled"].includes(normalized);
}

function adjustmentCountsTowardBalance(status: string | null | undefined) {
  const normalized = normalizeText(status).toLowerCase();
  if (!normalized) return true;
  return !["void", "cancelled", "canceled"].includes(normalized);
}

function isCreditAdjustment(entryType: string | null | undefined) {
  return normalizeText(entryType).toLowerCase() === "credit";
}

function isMissingTableError(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error || "")).toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("schema cache")
  );
}

function buyerLabel(buyer: Pick<BuyerRow, "full_name" | "name" | "email" | "id">) {
  return firstString(buyer.full_name, buyer.name, buyer.email, `Buyer #${buyer.id}`);
}

function puppyName(puppy: PuppyRow) {
  return firstString(puppy.call_name, puppy.puppy_name, puppy.name);
}

function buildPuppyLabel(puppies: PuppyRow[]) {
  const names = Array.from(new Set(puppies.map((puppy) => puppyName(puppy)).filter(Boolean)));
  if (!names.length) return "your puppy payment plan";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]}, and ${names.length - 2} more`;
}

function normalizeCcEmails(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => normalizeEmail(entry)).filter(Boolean);
}

function defaultNoticeSettings(buyerId: number): BuyerPaymentNoticeSettings {
  return {
    buyer_id: buyerId,
    enabled: true,
    receipt_enabled: true,
    due_reminder_enabled: true,
    due_reminder_days_before: 5,
    late_notice_enabled: true,
    late_notice_days_after: 3,
    default_notice_enabled: true,
    default_notice_days_after: 14,
    recipient_email: null,
    cc_emails: [],
    internal_note: null,
  };
}

export function parsePaymentNoticeCcEmails(value: string) {
  return value
    .split(/[,\n]/)
    .map((entry) => normalizeEmail(entry))
    .filter(Boolean);
}

function normalizeStoredNoticeSettings(
  row: Partial<BuyerPaymentNoticeSettings> | null | undefined,
  buyerId: number
) {
  return {
    ...defaultNoticeSettings(buyerId),
    ...(row || {}),
    buyer_id: buyerId,
    recipient_email: normalizeOptionalText(row?.recipient_email),
    cc_emails: normalizeCcEmails(row?.cc_emails),
    internal_note: normalizeOptionalText(row?.internal_note),
    due_reminder_days_before: Math.min(
      30,
      Math.max(0, Math.round(Number(row?.due_reminder_days_before ?? 5)))
    ),
    late_notice_days_after: Math.min(
      60,
      Math.max(1, Math.round(Number(row?.late_notice_days_after ?? 3)))
    ),
    default_notice_days_after: Math.min(
      120,
      Math.max(1, Math.round(Number(row?.default_notice_days_after ?? 14)))
    ),
  } satisfies BuyerPaymentNoticeSettings;
}

export async function loadBuyerPaymentNoticeSettings(
  admin: SupabaseClient,
  buyerId: number
) {
  const result = await admin
    .from("buyer_payment_notice_settings")
    .select(
      "id,created_at,updated_at,buyer_id,enabled,receipt_enabled,due_reminder_enabled,due_reminder_days_before,late_notice_enabled,late_notice_days_after,default_notice_enabled,default_notice_days_after,recipient_email,cc_emails,internal_note"
    )
    .eq("buyer_id", buyerId)
    .limit(1)
    .maybeSingle<BuyerPaymentNoticeSettings>();

  if (result.error) {
    if (isMissingTableError(result.error)) {
      return defaultNoticeSettings(buyerId);
    }
    throw new Error(result.error.message);
  }

  return normalizeStoredNoticeSettings(result.data, buyerId);
}

export async function upsertBuyerPaymentNoticeSettings(
  admin: SupabaseClient,
  input: {
    buyerId: number;
    enabled: boolean;
    receiptEnabled: boolean;
    dueReminderEnabled: boolean;
    dueReminderDaysBefore: number;
    lateNoticeEnabled: boolean;
    lateNoticeDaysAfter: number;
    defaultNoticeEnabled: boolean;
    defaultNoticeDaysAfter: number;
    recipientEmail?: string | null;
    ccEmails?: string[];
    internalNote?: string | null;
  }
) {
  const payload = {
    buyer_id: input.buyerId,
    enabled: input.enabled,
    receipt_enabled: input.receiptEnabled,
    due_reminder_enabled: input.dueReminderEnabled,
    due_reminder_days_before: Math.min(30, Math.max(0, Math.round(input.dueReminderDaysBefore))),
    late_notice_enabled: input.lateNoticeEnabled,
    late_notice_days_after: Math.min(60, Math.max(1, Math.round(input.lateNoticeDaysAfter))),
    default_notice_enabled: input.defaultNoticeEnabled,
    default_notice_days_after: Math.min(
      120,
      Math.max(1, Math.round(input.defaultNoticeDaysAfter))
    ),
    recipient_email: normalizeOptionalText(input.recipientEmail),
    cc_emails: (input.ccEmails || []).map((email) => normalizeEmail(email)).filter(Boolean),
    internal_note: normalizeOptionalText(input.internalNote),
  };

  const result = await admin
    .from("buyer_payment_notice_settings")
    .upsert(payload, { onConflict: "buyer_id" })
    .select(
      "id,created_at,updated_at,buyer_id,enabled,receipt_enabled,due_reminder_enabled,due_reminder_days_before,late_notice_enabled,late_notice_days_after,default_notice_enabled,default_notice_days_after,recipient_email,cc_emails,internal_note"
    )
    .single<BuyerPaymentNoticeSettings>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  return normalizeStoredNoticeSettings(result.data, input.buyerId);
}

async function createPaymentEmailAlert(
  admin: SupabaseClient,
  input: {
    externalEventId: string;
    buyerId: number;
    puppyId?: number | null;
    paymentId?: string | null;
    title: string;
    message: string;
    tone: "success" | "warning" | "danger" | "neutral";
    meta?: Record<string, unknown> | null;
  }
) {
  try {
    const { error } = await admin.from("chichi_admin_alerts").upsert(
      {
        external_event_id: input.externalEventId,
        event_type: "payment_email",
        alert_scope: "payment",
        title: input.title,
        message: input.message,
        tone: input.tone,
        buyer_id: input.buyerId,
        puppy_id: input.puppyId || null,
        payment_id: input.paymentId || null,
        payment_link_id: null,
        reference_id: input.externalEventId,
        source: "payment_email",
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

async function loadNoticeContext(admin: SupabaseClient, buyerId: number) {
  const [buyerRes, puppiesRes, paymentsRes, adjustmentsRes, billingRes, settings] =
    await Promise.all([
      admin
        .from("buyers")
        .select(
          "id,user_id,full_name,name,email,sale_price,deposit_amount,finance_enabled,finance_rate,finance_months,finance_monthly_amount,finance_next_due_date,finance_last_payment_date"
        )
        .eq("id", buyerId)
        .limit(1)
        .maybeSingle<BuyerRow>(),
      admin
        .from("puppies")
        .select("id,call_name,puppy_name,name,price,deposit")
        .eq("buyer_id", buyerId)
        .order("created_at", { ascending: false })
        .returns<PuppyRow[]>(),
      admin
        .from("buyer_payments")
        .select("id,buyer_id,puppy_id,payment_date,amount,payment_type,method,note,status,reference_number")
        .eq("buyer_id", buyerId)
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false })
        .returns<PaymentRow[]>(),
      admin
        .from("buyer_fee_credit_records")
        .select("buyer_id,entry_type,amount,status")
        .eq("buyer_id", buyerId)
        .returns<AdjustmentRow[]>(),
      admin
        .from("buyer_billing_subscriptions")
        .select("buyer_id,next_billing_at,recurring_price,plan_code,plan_name,subscription_status")
        .eq("buyer_id", buyerId)
        .eq("provider", "zoho_billing")
        .order("updated_at", { ascending: false })
        .returns<BillingRow[]>(),
      loadBuyerPaymentNoticeSettings(admin, buyerId),
    ]);

  if (buyerRes.error || !buyerRes.data) {
    throw new Error(buyerRes.error?.message || "Buyer not found.");
  }
  if (puppiesRes.error) throw new Error(puppiesRes.error.message);
  if (paymentsRes.error) throw new Error(paymentsRes.error.message);

  const adjustments =
    adjustmentsRes.error && isMissingTableError(adjustmentsRes.error)
      ? []
      : adjustmentsRes.error
        ? (() => {
            throw new Error(adjustmentsRes.error.message);
          })()
        : (adjustmentsRes.data || []);

  const billingRows =
    billingRes.error && isMissingTableError(billingRes.error)
      ? []
      : billingRes.error
        ? (() => {
            throw new Error(billingRes.error.message);
          })()
        : (billingRes.data || []);

  const billing =
    billingRows.find((row) =>
      ["trial", "future", "live", "active", "non_renewing"].includes(
        normalizeText(row.subscription_status).toLowerCase()
      )
    ) ||
    billingRows[0] ||
    null;

  const buyer = buyerRes.data;
  const puppies = puppiesRes.data || [];
  const payments = paymentsRes.data || [];
  const price = normalizeMoney(
    buyer.sale_price ?? puppies.find((puppy) => normalizeMoney(puppy.price) > 0)?.price ?? 0
  );
  const deposit = normalizeMoney(
    buyer.deposit_amount ?? puppies.find((puppy) => normalizeMoney(puppy.deposit) > 0)?.deposit ?? 0
  );
  const principalAfterDeposit = Math.max(0, price - deposit);
  const monthlyAmount = normalizeMoney(
    buyer.finance_monthly_amount ?? billing?.recurring_price ?? 0
  );
  const financeMonths = Math.max(0, Math.round(Number(buyer.finance_months || 0)));
  const paymentsApplied = payments.reduce((sum, payment) => {
    if (!paymentCountsTowardBalance(payment.status)) return sum;
    return sum + Math.max(0, normalizeMoney(payment.amount));
  }, 0);
  const adjustmentCharges = adjustments.reduce((sum, adjustment) => {
    if (!adjustmentCountsTowardBalance(adjustment.status) || isCreditAdjustment(adjustment.entry_type)) {
      return sum;
    }
    return sum + Math.abs(normalizeMoney(adjustment.amount));
  }, 0);
  const adjustmentCredits = adjustments.reduce((sum, adjustment) => {
    if (!adjustmentCountsTowardBalance(adjustment.status) || !isCreditAdjustment(adjustment.entry_type)) {
      return sum;
    }
    return sum + Math.abs(normalizeMoney(adjustment.amount));
  }, 0);
  const financedTotal =
    buyer.finance_enabled && monthlyAmount > 0 && financeMonths > 0
      ? Math.max(principalAfterDeposit, monthlyAmount * financeMonths)
      : principalAfterDeposit;
  const balance = Math.max(
    0,
    financedTotal + adjustmentCharges - adjustmentCredits - paymentsApplied
  );

  return {
    buyer,
    puppies,
    payments,
    adjustments,
    billing,
    settings,
    dueDate: toIsoDate(billing?.next_billing_at || buyer.finance_next_due_date),
    monthlyAmount: monthlyAmount > 0 ? monthlyAmount : null,
    balance,
    puppyLabel: buildPuppyLabel(puppies),
    buyerLabel: buyerLabel(buyer),
  } satisfies NoticeContext;
}

function buildPortalPaymentsUrl() {
  const baseUrl =
    normalizeText(process.env.PAYMENT_PORTAL_BASE_URL) ||
    normalizeText(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeText(process.env.NEXT_PUBLIC_APP_URL) ||
    "https://swvachihuahua.com";

  return new URL("/portal/payments", baseUrl).toString();
}

function templateKeyForNoticeKind(kind: PaymentPlanEmailKind) {
  if (kind === "receipt") return "payment_receipt";
  if (kind === "due_reminder") return "payment_reminder";
  if (kind === "late_notice") return "payment_overdue";
  return "payment_default_notice";
}

function renderTemplateTokens(
  template: string,
  payload: Record<string, string | number | null | undefined>
) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = payload[key];
    return value == null ? "" : String(value);
  });
}

function buildTemplatePayload(input: {
  context: NoticeContext;
  kind: PaymentPlanEmailKind;
  payment?: PaymentRow | null;
  presentation: NoticePresentation;
}) {
  const { context, kind, payment, presentation } = input;
  return {
    buyer_name: context.buyerLabel,
    puppy_name: context.puppyLabel,
    puppy_label: context.puppyLabel,
    due_date: presentation.dueDateLabel || "",
    balance: presentation.balanceLabel || formatMoney(context.balance),
    monthly_amount: presentation.monthlyAmountLabel || "",
    payment_amount: payment ? formatMoney(payment.amount) : "",
    payment_date: payment?.payment_date ? formatLongDate(payment.payment_date) : "",
    payment_method: firstString(payment?.method, presentation.paymentMethodLabel),
    reference_number: firstString(payment?.reference_number, payment?.id, presentation.referenceLabel),
    notice_kind: kind,
  } satisfies Record<string, string | number | null | undefined>;
}

function splitTemplateBody(body: string, fallback: NoticePresentation) {
  const paragraphs = String(body || "")
    .split(/\n{2,}/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return {
      messageLead: fallback.messageLead,
      supportingCopy: fallback.supportingCopy,
    };
  }

  return {
    messageLead: paragraphs[0],
    supportingCopy: paragraphs.slice(1).join("\n\n") || fallback.supportingCopy,
  };
}

async function loadStoredMessageTemplate(
  admin: SupabaseClient,
  kind: PaymentPlanEmailKind
) {
  const result = await admin
    .from("admin_message_templates")
    .select("template_key,subject,body,is_active")
    .eq("template_key", templateKeyForNoticeKind(kind))
    .limit(1)
    .maybeSingle<StoredMessageTemplateRow>();

  if (result.error) {
    if (isMissingTableError(result.error)) return null;
    throw new Error(result.error.message);
  }

  if (!result.data || result.data.is_active === false) return null;
  return result.data;
}

async function applyStoredTemplateToPresentation(input: {
  admin: SupabaseClient;
  kind: PaymentPlanEmailKind;
  context: NoticeContext;
  payment?: PaymentRow | null;
  presentation: NoticePresentation;
}) {
  const stored = await loadStoredMessageTemplate(input.admin, input.kind);
  if (!stored) {
    return {
      ...input.presentation,
      templateKey: templateKeyForNoticeKind(input.kind),
    } satisfies NoticePresentation;
  }

  const payload = buildTemplatePayload({
    context: input.context,
    kind: input.kind,
    payment: input.payment,
    presentation: input.presentation,
  });
  const renderedSubject = renderTemplateTokens(
    normalizeText(stored.subject) || input.presentation.subject,
    payload
  );
  const renderedBody = renderTemplateTokens(normalizeText(stored.body), payload).trim();
  const bodyParts = splitTemplateBody(renderedBody, input.presentation);

  return {
    ...input.presentation,
    subject: renderedSubject || input.presentation.subject,
    messageLead: bodyParts.messageLead,
    supportingCopy: bodyParts.supportingCopy,
    templateKey: normalizeText(stored.template_key) || templateKeyForNoticeKind(input.kind),
  } satisfies NoticePresentation;
}

function buildNoticePresentation(input: {
  kind: PaymentPlanEmailKind;
  context: NoticeContext;
  payment?: PaymentRow | null;
}): NoticePresentation {
  const dueDateLabel = input.context.dueDate ? formatLongDate(input.context.dueDate) : "";
  const monthlyAmountLabel = input.context.monthlyAmount
    ? formatMoney(input.context.monthlyAmount)
    : "";
  const balanceLabel = formatMoney(input.context.balance);
  const portalUrl = buildPortalPaymentsUrl();

  if (input.kind === "receipt") {
    return {
      subject: `Payment receipt for ${input.context.puppyLabel}`,
      preview: `We received your puppy payment on ${formatShortDate(input.payment?.payment_date || todayIso())}.`,
      messageLead: "thank you. We received your payment and updated your puppy payment plan.",
      supportingCopy:
        "Your payment has been posted to your account. The portal balance has been refreshed so you can review the updated plan whenever you need it.",
      amountLabel: formatMoney(input.payment?.amount || 0),
      dueDateLabel: formatLongDate(input.payment?.payment_date || todayIso()),
      balanceLabel,
      monthlyAmountLabel,
      paymentMethodLabel: firstString(input.payment?.method, "Payment method recorded"),
      referenceLabel: firstString(input.payment?.reference_number, input.payment?.id),
      actionLabel: "View Payment Portal",
      actionHref: portalUrl,
      footerNote:
        "Questions about this receipt or a recent change to your plan are always welcome. Reply to this email and we will help.",
    };
  }

  if (input.kind === "due_reminder") {
    return {
      subject: `Upcoming puppy payment due ${dueDateLabel}`,
      preview: `Friendly reminder: your next puppy payment is due ${dueDateLabel}.`,
      messageLead: "this is a friendly reminder that your next puppy payment is coming up soon.",
      supportingCopy: `Your next scheduled payment${monthlyAmountLabel ? ` of ${monthlyAmountLabel}` : ""} is due ${dueDateLabel}. Your current balance snapshot is ${balanceLabel}.`,
      amountLabel: monthlyAmountLabel,
      dueDateLabel,
      balanceLabel,
      monthlyAmountLabel,
      actionLabel: "Review Payment Plan",
      actionHref: portalUrl,
      footerNote:
        "If you need to update the payment method on file or want to coordinate timing, please reach out before the due date.",
    };
  }

  const dueDate = input.context.dueDate ? new Date(`${input.context.dueDate}T12:00:00`) : null;
  const now = new Date();
  const daysPastDue =
    dueDate && !Number.isNaN(dueDate.getTime())
      ? Math.max(0, Math.round((now.getTime() - dueDate.getTime()) / 86_400_000))
      : 0;

  if (input.kind === "late_notice") {
    return {
      subject: `Puppy payment is overdue`,
      preview: `Your puppy payment due ${dueDateLabel} is now overdue.`,
      messageLead: "your scheduled puppy payment is now past due.",
      supportingCopy: `We have not seen the scheduled payment${monthlyAmountLabel ? ` of ${monthlyAmountLabel}` : ""} that was due ${dueDateLabel}. The balance snapshot on your plan is ${balanceLabel}.${daysPastDue ? ` This notice is being sent ${daysPastDue} day${daysPastDue === 1 ? "" : "s"} after the due date.` : ""}`,
      amountLabel: monthlyAmountLabel,
      dueDateLabel,
      balanceLabel,
      monthlyAmountLabel,
      actionLabel: "Resolve In Portal",
      actionHref: portalUrl,
      footerNote:
        "If payment has already been made, or you need help making arrangements, reply here so we can update the account with you.",
    };
  }

  return {
    subject: `Important payment plan default notice`,
    preview: `Your puppy payment plan is significantly past due.`,
    messageLead: "your puppy payment plan is now significantly past due and needs attention.",
    supportingCopy: `The scheduled payment${monthlyAmountLabel ? ` of ${monthlyAmountLabel}` : ""} that was due ${dueDateLabel} is still outstanding. The current balance snapshot on your plan is ${balanceLabel}. Please contact us right away if you need support resolving the account.`,
    amountLabel: monthlyAmountLabel,
    dueDateLabel,
    balanceLabel,
    monthlyAmountLabel,
    actionLabel: "Review Account",
    actionHref: portalUrl,
    footerNote:
      "Please reply as soon as you can if you need help updating your payment method or need us to review the account with you.",
  };
}

async function findNoticeLogByKey(admin: SupabaseClient, noticeKey: string) {
  const result = await queryBuyerPaymentNoticeLogs<{ id: number; notice_key: string }>(
    admin,
    "id,notice_key",
    (query) => query.eq("notice_key", noticeKey).limit(1)
  );

  if (result.error) {
    if (isMissingTableError(result.error)) {
      throw new Error(
        "The buyer payment email notice tables are not available yet. Please apply the buyer_payment_email_notices migration first."
      );
    }
    throw new Error(result.error instanceof Error ? result.error.message : String(result.error || ""));
  }

  return result.data?.[0] || null;
}

async function storeNoticeLog(
  admin: SupabaseClient,
  input: {
    buyerId: number;
    puppyId?: number | null;
    paymentId?: string | null;
    kind: PaymentPlanEmailKind | "manual_notice";
    noticeKey: string;
    noticeDate?: string | null;
    dueDate?: string | null;
    recipientEmail: string;
    subject: string;
    providerMessageId?: string | null;
    meta?: Record<string, unknown>;
  }
) {
  const tableChoice = await chooseFirstAvailableTable(admin, BUYER_PAYMENT_NOTICE_LOG_TABLES);
  if (!tableChoice.table) {
    throw new Error(
      tableChoice.error instanceof Error
        ? tableChoice.error.message
        : "The buyer payment email notice tables are not available yet."
    );
  }

  const { error } = await admin.from(tableChoice.table).insert({
    buyer_id: input.buyerId,
    puppy_id: input.puppyId || null,
    payment_id: input.paymentId || null,
    notice_kind: input.kind,
    notice_key: input.noticeKey,
    notice_date: input.noticeDate || todayIso(),
    due_date: input.dueDate || null,
    status: "sent",
    recipient_email: input.recipientEmail,
    subject: input.subject,
    provider: "resend",
    provider_message_id: input.providerMessageId || null,
    meta: input.meta || {},
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function sendNoticeEmail(input: {
  admin: SupabaseClient;
  context: NoticeContext;
  kind: PaymentPlanEmailKind;
  noticeKey: string;
  payment?: PaymentRow | null;
  force?: boolean;
}) {
  const { admin, context, kind, noticeKey, payment, force } = input;

  if (!hasResendConfiguration()) {
    return {
      ok: true,
      sent: false,
      skippedReason: "Resend is not configured.",
    } satisfies SendNoticeEmailResult;
  }

  const recipientEmail = normalizeEmail(
    context.settings.recipient_email || context.buyer.email || ""
  );

  if (!recipientEmail) {
    return {
      ok: true,
      sent: false,
      skippedReason: "No buyer email is available for notices.",
    } satisfies SendNoticeEmailResult;
  }

  if (!force) {
    const existing = await findNoticeLogByKey(admin, noticeKey);
    if (existing) {
      return {
        ok: true,
        sent: false,
        skippedReason: "Notice already sent for this cycle.",
        noticeKey,
        recipientEmail,
      } satisfies SendNoticeEmailResult;
    }
  }

  const basePresentation = buildNoticePresentation({ kind, context, payment });
  const presentation = await applyStoredTemplateToPresentation({
    admin,
    kind,
    context,
    payment,
    presentation: basePresentation,
  });
  const resend = getResendClient();
  const replyTo = normalizeOptionalText(
    process.env.PAYMENT_NOTICES_REPLY_TO ||
      process.env.PAYMENT_NOTICES_FROM_EMAIL ||
      process.env.RESEND_FROM_EMAIL
  );
  const bcc = parsePaymentNoticeCcEmails(process.env.PAYMENT_NOTICES_BCC_EMAILS || "");

  const sendResult = await resend.emails.send({
    from:
      normalizeText(process.env.PAYMENT_NOTICES_FROM_EMAIL) ||
      normalizeText(process.env.RESEND_FROM_EMAIL) ||
      "Southwest Virginia Chihuahua <billing@noreply.swvachihuahua.com>",
    to: recipientEmail,
    cc: context.settings.cc_emails.length ? context.settings.cc_emails : undefined,
    bcc: bcc.length ? bcc : undefined,
    replyTo: replyTo || undefined,
    subject: presentation.subject,
    react: React.createElement(PaymentPlanEmail, {
      kind,
      buyerName: context.buyerLabel,
      puppyLabel: context.puppyLabel,
      subjectLine: presentation.subject,
      previewText: presentation.preview,
      messageLead: presentation.messageLead,
      supportingCopy: presentation.supportingCopy,
      amountLabel: presentation.amountLabel,
      dueDateLabel: presentation.dueDateLabel,
      balanceLabel: presentation.balanceLabel,
      monthlyAmountLabel: presentation.monthlyAmountLabel,
      paymentMethodLabel: presentation.paymentMethodLabel,
      referenceLabel: presentation.referenceLabel,
      actionLabel: presentation.actionLabel,
      actionHref: presentation.actionHref,
      footerNote: presentation.footerNote,
    }),
  });

  if (sendResult.error) {
    throw new Error(sendResult.error.message || "Failed to send payment email.");
  }

  await storeNoticeLog(admin, {
    buyerId: context.buyer.id,
    puppyId: payment?.puppy_id || context.puppies[0]?.id || null,
    paymentId: payment?.id || null,
    kind,
    noticeKey,
    noticeDate: todayIso(),
    dueDate: kind === "receipt" ? null : context.dueDate,
    recipientEmail,
    subject: presentation.subject,
    providerMessageId: sendResult.data?.id || null,
    meta: {
      buyer_name: context.buyerLabel,
      puppy_label: context.puppyLabel,
      balance: context.balance,
      monthly_amount: context.monthlyAmount,
      due_date: context.dueDate,
      payment_id: payment?.id || null,
      template_key: presentation.templateKey || null,
    },
  });

  const titleByKind: Record<PaymentPlanEmailKind, string> = {
    receipt: "Payment receipt emailed",
    due_reminder: "Due reminder emailed",
    late_notice: "Late notice emailed",
    default_notice: "Default notice emailed",
  };

  const toneByKind: Record<PaymentPlanEmailKind, "success" | "warning" | "danger" | "neutral"> = {
    receipt: "success",
    due_reminder: "success",
    late_notice: "warning",
    default_notice: "danger",
  };

  await createPaymentEmailAlert(admin, {
    externalEventId: noticeKey,
    buyerId: context.buyer.id,
    puppyId: payment?.puppy_id || context.puppies[0]?.id || null,
    paymentId: payment?.id || null,
    title: titleByKind[kind],
    message: `${context.buyerLabel} | ${presentation.subject} | ${recipientEmail}`,
    tone: toneByKind[kind],
    meta: {
      notice_kind: kind,
      recipient_email: recipientEmail,
      due_date: context.dueDate,
      payment_id: payment?.id || null,
      template_key: presentation.templateKey || null,
    },
  });

  return {
    ok: true,
    sent: true,
    subject: presentation.subject,
    recipientEmail,
    noticeKey,
  } satisfies SendNoticeEmailResult;
}

export async function sendBuyerPaymentReceiptEmail(
  admin: SupabaseClient,
  input: ReceiptSendInput
) {
  const paymentResult = await admin
    .from("buyer_payments")
    .select("id,buyer_id,puppy_id,payment_date,amount,payment_type,method,note,status,reference_number")
    .eq("id", input.paymentId)
    .limit(1)
    .maybeSingle<PaymentRow>();

  if (paymentResult.error || !paymentResult.data) {
    throw new Error(paymentResult.error?.message || "Payment not found for receipt email.");
  }

  const payment = paymentResult.data;
  const context = await loadNoticeContext(admin, payment.buyer_id);
  if (!context.settings.enabled || !context.settings.receipt_enabled) {
    return {
      ok: true,
      sent: false,
      skippedReason: "Receipt emails are disabled for this buyer.",
    } satisfies SendNoticeEmailResult;
  }

  const noticeKey = `receipt:payment:${payment.id}`;
  return sendNoticeEmail({
    admin,
    context,
    kind: "receipt",
    noticeKey,
    payment,
    force: input.force,
  });
}

export async function sendManualBuyerPaymentNotice(
  admin: SupabaseClient,
  input: {
    buyerId: number;
    kind: Exclude<PaymentPlanEmailKind, "receipt">;
  }
) {
  const context = await loadNoticeContext(admin, input.buyerId);
  const noticeKey = `manual:${input.kind}:buyer:${input.buyerId}:${Date.now()}`;
  return sendNoticeEmail({
    admin,
    context,
    kind: input.kind,
    noticeKey,
    force: true,
  });
}

function daysUntilIsoDate(isoDate: string) {
  const dueDate = new Date(`${isoDate}T12:00:00`);
  const today = new Date();
  const todayAtNoon = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);
  return Math.round((dueDate.getTime() - todayAtNoon.getTime()) / 86_400_000);
}

export async function sendScheduledBuyerPaymentNoticeEmails(
  admin: SupabaseClient
) {
  const buyersResult = await admin
    .from("buyers")
    .select(
      "id,user_id,full_name,name,email,sale_price,deposit_amount,finance_enabled,finance_rate,finance_months,finance_monthly_amount,finance_next_due_date,finance_last_payment_date"
    )
    .eq("finance_enabled", true)
    .order("finance_next_due_date", { ascending: true, nullsFirst: false })
    .returns<BuyerRow[]>();

  if (buyersResult.error) {
    throw new Error(buyersResult.error.message);
  }

  const summary: ScheduledSendResult = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failures: [],
  };

  for (const buyer of buyersResult.data || []) {
    summary.processed += 1;

    try {
      const context = await loadNoticeContext(admin, buyer.id);
      const settings = context.settings;
      if (!settings.enabled) {
        summary.skipped += 1;
        continue;
      }

      if (!(context.balance > 0)) {
        summary.skipped += 1;
        continue;
      }

      if (!context.dueDate) {
        summary.skipped += 1;
        continue;
      }

      const daysUntilDue = daysUntilIsoDate(context.dueDate);
      let kind: Exclude<PaymentPlanEmailKind, "receipt"> | null = null;

      if (daysUntilDue >= 0) {
        if (settings.due_reminder_enabled && daysUntilDue <= settings.due_reminder_days_before) {
          kind = "due_reminder";
        }
      } else {
        const daysPastDue = Math.abs(daysUntilDue);
        if (
          settings.default_notice_enabled &&
          daysPastDue >= settings.default_notice_days_after
        ) {
          kind = "default_notice";
        } else if (
          settings.late_notice_enabled &&
          daysPastDue >= settings.late_notice_days_after
        ) {
          kind = "late_notice";
        }
      }

      if (!kind) {
        summary.skipped += 1;
        continue;
      }

      const noticeKey = `${kind}:buyer:${buyer.id}:due:${context.dueDate}`;
      const result = await sendNoticeEmail({
        admin,
        context,
        kind,
        noticeKey,
      });

      if (result.sent) {
        summary.sent += 1;
      } else {
        summary.skipped += 1;
      }
    } catch (error) {
      summary.failures.push({
        buyerId: buyer.id,
        message: error instanceof Error ? error.message : "Unknown email error.",
      });
    }
  }

  return summary;
}
