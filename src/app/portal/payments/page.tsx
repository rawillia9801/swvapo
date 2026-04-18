"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  HeartHandshake,
  Landmark,
  Receipt,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { fmtDate, sb } from "@/lib/utils";
import {
  findBuyerFeeCreditRecords,
  findBuyerPayments,
  findLatestPickupRequestForUser,
  loadPortalContext,
  paymentCountsTowardBalance,
  type PortalFeeCreditRecord,
  portalPuppyName,
  type PortalBuyer,
  type PortalPayment,
  type PortalPickupRequest,
  type PortalPuppy,
} from "@/lib/portal-data";
import { usePortalSession } from "@/hooks/use-portal-session";
import { getClientSessionWithTimeout } from "@/lib/client-session-resilience";
import {
  PortalButton,
  PortalEmptyState,
  PortalErrorState,
  PortalInfoTile,
  PortalLoadingState,
  PortalMetricCard,
  PortalMetricGrid,
  PortalPageHero,
  PortalPanel,
  PortalSecondaryButton,
  PortalStatusBadge,
  portalInputClass,
} from "@/components/portal/luxury-shell";
import {
  calculateTransportEstimate,
  type PickupRequestType,
} from "@/lib/transportation-pricing";
import {
  buildPortalPaymentChargeSnapshot,
  type PortalChargeKind,
} from "@/lib/portal-payment-options";

const financingUrl =
  "https://forms.zoho.com/southwestvirginiachihuahua/form/PuppyFinancingApplication";

type PaymentPageState = {
  buyer: PortalBuyer | null;
  puppy: PortalPuppy | null;
  payments: PortalPayment[];
  adjustments: PortalFeeCreditRecord[];
  pickupRequest: PortalPickupRequest | null;
};

type LedgerEntry = {
  key: string;
  sortDate: string;
  dateLabel: string;
  label: string;
  detail: string;
  charge: number;
  credit: number;
  runningBalance: number;
  statusLabel: string;
  tone: "neutral" | "success" | "warning" | "danger";
};

type FinanceSummary = {
  purchasePrice: number;
  depositAmount: number;
  transportationCost: number;
  paymentsApplied: number;
  adjustmentCharges: number;
  adjustmentCredits: number;
  financeEnabled: boolean;
  adminFeeEnabled: boolean;
  apr: number | null;
  monthlyAmount: number | null;
  months: number | null;
  nextDueDate: string | null;
  lastPostedPaymentDate: string | null;
  principalAfterDeposit: number;
  financeBaseTotal: number;
  planTotal: number | null;
  financeUplift: number;
  currentBalance: number;
  totalCharges: number;
  totalCredits: number;
};

type PortalBillingSubscription = {
  id: number;
  reference_id: string;
  subscription_id?: string | null;
  subscription_status?: string | null;
  hostedpage_url?: string | null;
  hostedpage_expires_at?: string | null;
  plan_code?: string | null;
  plan_name?: string | null;
  recurring_price?: number | null;
  currency_code?: string | null;
  interval_count?: number | null;
  interval_unit?: string | null;
  billing_cycles?: number | null;
  current_term_ends_at?: string | null;
  next_billing_at?: string | null;
  started_at?: string | null;
  last_payment_at?: string | null;
  last_payment_amount?: number | null;
  card_last_four?: string | null;
  card_expiry_month?: number | null;
  card_expiry_year?: number | null;
  customer_email?: string | null;
};

function emptyState(): PaymentPageState {
  return {
    buyer: null,
    puppy: null,
    payments: [],
    adjustments: [],
    pickupRequest: null,
  };
}

function displayText(value: string | null | undefined, fallback = "Not listed") {
  const text = String(value || "").trim();
  return text || fallback;
}

function toMoney(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "Not listed";
  const amount = Number(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function firstDate(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text && !Number.isNaN(new Date(text).getTime())) {
      return text;
    }
  }
  return "";
}

function firstNumber(...values: Array<number | null | undefined>) {
  for (const value of values) {
    if (value !== null && value !== undefined && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return 0;
}

function paymentTypeLabel(payment: PortalPayment) {
  const raw = String(payment.payment_type || "").trim();
  return raw || "Payment";
}

function adjustmentTypeLabel(adjustment: PortalFeeCreditRecord) {
  const label = String(adjustment.label || "").trim();
  if (label) return label;

  const entryType = String(adjustment.entry_type || "").trim().toLowerCase();
  if (entryType === "transportation") return "Transportation Fee";
  if (entryType === "credit") return "Credit";
  return "Fee";
}

function paymentActionLabel(kind: PortalChargeKind) {
  if (kind === "deposit") return "Pay Deposit";
  if (kind === "transportation") return "Pay Transportation Fee";
  if (kind === "general") return "Make Payment";
  return "Pay Installment";
}

function paymentSuccessText(kind: string | null) {
  if (kind === "deposit") return "Deposit payment recorded successfully.";
  if (kind === "transportation") return "Transportation payment recorded successfully.";
  if (kind === "installment") return "Installment payment recorded successfully.";
  if (kind === "general") return "Payment recorded successfully.";
  return "Payment recorded successfully.";
}

function parseAmountInput(value: string) {
  const normalized = String(value || "").replace(/[^0-9.]/g, "").trim();
  if (!normalized) return 0;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function formatAmountInput(value: number) {
  const amount = Number(value || 0);
  if (!(amount > 0)) return "";
  return amount.toFixed(2);
}

function paymentPolicyMessage(snapshot: ReturnType<typeof buildPortalPaymentChargeSnapshot>) {
  if (snapshot.finalBalanceDueNow) {
    return `Your scheduled receive date is ${
      snapshot.scheduledReceiveDate ? fmtDate(snapshot.scheduledReceiveDate) : "coming up soon"
    }, so the full remaining balance must be paid now.`;
  }

  if (snapshot.financeEnabled) {
    return "Your puppy payment plan is active, so you can make any amount payment up to the current balance.";
  }

  if (snapshot.balanceDueByDate && snapshot.scheduledReceiveDate) {
    return `You can make any amount payment up to the current balance, but the account must be paid in full by ${fmtDate(snapshot.balanceDueByDate)} for the scheduled receive date of ${fmtDate(snapshot.scheduledReceiveDate)}.`;
  }

  return "You can make any amount payment up to the current balance. Secure checkout opens through Zoho Payments.";
}

function defaultCustomAmount(snapshot: ReturnType<typeof buildPortalPaymentChargeSnapshot>) {
  if (!(snapshot.currentBalance > 0)) return "";
  if (snapshot.finalBalanceDueNow) return formatAmountInput(snapshot.currentBalance);
  return formatAmountInput(
    snapshot.depositDue ||
      snapshot.installmentDue ||
      snapshot.transportationDue ||
      Math.min(snapshot.currentBalance, 25)
  );
}

function billingStatusLabel(subscription: PortalBillingSubscription | null) {
  const status = String(subscription?.subscription_status || "").trim().toLowerCase();
  if (!status && subscription?.hostedpage_url) return "checkout pending";
  return status || "not connected";
}

function billingStatusTone(subscription: PortalBillingSubscription | null) {
  const status = String(subscription?.subscription_status || "").trim().toLowerCase();
  if (["trial", "future", "live", "active", "non_renewing"].includes(status)) return "success" as const;
  if (["unpaid", "cancelled", "expired"].includes(status)) return "warning" as const;
  if (["failed", "declined"].includes(status)) return "danger" as const;
  return "neutral" as const;
}

function billingSubscriptionActive(subscription: PortalBillingSubscription | null) {
  return ["trial", "future", "live", "active", "non_renewing"].includes(
    String(subscription?.subscription_status || "").trim().toLowerCase()
  );
}

function billingPaymentMethodValue(subscription: PortalBillingSubscription | null) {
  if (subscription?.card_last_four) {
    return `Card ending in ${subscription.card_last_four}`;
  }

  if (subscription?.subscription_id) {
    return "Managed in Zoho Billing";
  }

  return "No payment method synced yet";
}

function billingPaymentMethodDetail(subscription: PortalBillingSubscription | null) {
  if (subscription?.card_expiry_month && subscription?.card_expiry_year) {
    return `Expires ${String(subscription.card_expiry_month).padStart(2, "0")}/${subscription.card_expiry_year}.`;
  }

  if (subscription?.subscription_id) {
    return "You can securely manage an ACH bank account or card in Zoho Billing.";
  }

  return "ACH bank account or card details appear after Zoho Billing confirms the payment method.";
}

function includesKeyword(value: string | null | undefined, keywords: string[]) {
  const normalized = String(value || "").trim().toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function classifyLedgerEffect(payment: PortalPayment) {
  const amount = Number(payment.amount || 0);
  const absoluteAmount = Math.abs(amount);
  const applied = paymentCountsTowardBalance(payment.status);
  const paymentType = String(payment.payment_type || "").trim().toLowerCase();

  if (!applied || absoluteAmount <= 0) {
    return { charge: 0, credit: 0, applied };
  }

  if (
    includesKeyword(paymentType, [
      "fee",
      "charge",
      "transport",
      "delivery",
      "shipping",
      "admin fee",
      "late fee",
    ])
  ) {
    return { charge: absoluteAmount, credit: 0, applied };
  }

  if (includesKeyword(paymentType, ["credit", "discount", "refund"])) {
    return { charge: 0, credit: absoluteAmount, applied };
  }

  if (amount < 0) {
    return { charge: absoluteAmount, credit: 0, applied };
  }

  return { charge: 0, credit: absoluteAmount, applied };
}

function entryTone(statusLabel: string, type: "charge" | "credit" | "neutral") {
  const normalizedStatus = statusLabel.toLowerCase();
  if (normalizedStatus.includes("failed") || normalizedStatus.includes("void")) return "danger";
  if (type === "charge") return "warning";
  if (type === "credit") return "success";
  return "neutral";
}

function adjustmentCountsTowardBalance(status: string | null | undefined) {
  const normalized = String(status || "").toLowerCase();
  if (!normalized) return true;
  return !["void", "cancelled", "canceled"].includes(normalized);
}

function classifyAdjustmentEffect(adjustment: PortalFeeCreditRecord) {
  const amount = Math.abs(Number(adjustment.amount || 0));
  const applied = adjustmentCountsTowardBalance(adjustment.status);
  const entryType = String(adjustment.entry_type || "").trim().toLowerCase();

  if (!applied || amount <= 0) {
    return { charge: 0, credit: 0, applied };
  }

  if (entryType === "credit") {
    return { charge: 0, credit: amount, applied };
  }

  return { charge: amount, credit: 0, applied };
}

function buildLedgerEntries(state: PaymentPageState): {
  entries: LedgerEntry[];
  summary: FinanceSummary;
} {
  const { buyer, puppy, payments, adjustments, pickupRequest } = state;
  const purchasePrice = firstNumber(buyer?.sale_price, puppy?.price);
  const depositAmount = firstNumber(buyer?.deposit_amount, puppy?.deposit);

  const transportationAdjustmentAmount = adjustments.reduce((sum, adjustment) => {
    if (!adjustmentCountsTowardBalance(adjustment.status)) return sum;
    if (String(adjustment.entry_type || "").trim().toLowerCase() !== "transportation") return sum;
    return sum + Math.abs(Number(adjustment.amount || 0));
  }, 0);

  const requestEstimate = pickupRequest
    ? calculateTransportEstimate(
        (pickupRequest.request_type as PickupRequestType) || "",
        pickupRequest.miles
      )
    : null;

  const transportationCost = firstNumber(
    transportationAdjustmentAmount > 0 ? transportationAdjustmentAmount : null,
    buyer?.delivery_fee,
    requestEstimate?.fee !== null && requestEstimate?.fee !== undefined ? requestEstimate.fee : null
  );

  const financeEnabled = Boolean(buyer?.finance_enabled);
  const adminFeeEnabled = Boolean(buyer?.finance_admin_fee);
  const apr =
    buyer?.finance_rate !== null && buyer?.finance_rate !== undefined
      ? Number(buyer.finance_rate)
      : null;
  const monthlyAmount =
    buyer?.finance_monthly_amount !== null && buyer?.finance_monthly_amount !== undefined
      ? Number(buyer.finance_monthly_amount)
      : null;
  const months =
    buyer?.finance_months !== null && buyer?.finance_months !== undefined
      ? Number(buyer.finance_months)
      : null;

  const planTotal =
    financeEnabled && monthlyAmount !== null && months !== null
      ? Math.max(0, monthlyAmount * months)
      : null;

  const principalAfterDeposit = Math.max(0, purchasePrice - depositAmount);
  const financeBaseTotal =
    planTotal !== null ? Math.max(principalAfterDeposit, planTotal) : principalAfterDeposit;
  const financeUplift = Math.max(0, financeBaseTotal - principalAfterDeposit);
  const nextDueDate = buyer?.finance_next_due_date || null;
  const lastPostedPaymentDate =
    buyer?.finance_last_payment_date || payments[0]?.payment_date || buyer?.deposit_date || null;

  const puppyName = portalPuppyName(puppy);
  const hasLoggedDeposit = payments.some(
    (payment) =>
      paymentCountsTowardBalance(payment.status) &&
      includesKeyword(payment.payment_type, ["deposit"])
  );

  const totalPaymentCredits = payments.reduce((sum, payment) => {
    const effect = classifyLedgerEffect(payment);
    return sum + effect.credit;
  }, 0);

  const totalAdjustmentCredits = adjustments.reduce((sum, adjustment) => {
    const effect = classifyAdjustmentEffect(adjustment);
    return sum + effect.credit;
  }, 0);

  const depositApplied =
    Boolean(buyer?.deposit_date) ||
    hasLoggedDeposit ||
    (depositAmount > 0 && totalPaymentCredits + totalAdjustmentCredits >= depositAmount - 0.01);

  const hasLoggedTransportation = payments.some(
    (payment) =>
      paymentCountsTowardBalance(payment.status) &&
      includesKeyword(payment.payment_type, ["transport", "delivery", "shipping"])
  );

  const hasTransportationAdjustment = adjustments.some(
    (adjustment) =>
      adjustmentCountsTowardBalance(adjustment.status) &&
      String(adjustment.entry_type || "").trim().toLowerCase() === "transportation"
  );

  const drafted: Array<{
    key: string;
    sortDate: string;
    label: string;
    detail: string;
    charge: number;
    credit: number;
    statusLabel: string;
    tone: "neutral" | "success" | "warning" | "danger";
    order: number;
  }> = [];

  const accountOpenedDate = firstDate(
    buyer?.created_at,
    puppy?.created_at,
    payments[0]?.created_at
  );

  if (purchasePrice > 0) {
    drafted.push({
      key: "purchase-price",
      sortDate: firstDate(accountOpenedDate),
      label: "Purchase Price",
      detail: `${puppyName} purchase amount on file.`,
      charge: purchasePrice,
      credit: 0,
      statusLabel: "On File",
      tone: "neutral",
      order: 10,
    });
  }

  if (transportationCost > 0 && !hasLoggedTransportation && !hasTransportationAdjustment) {
    drafted.push({
      key: "transportation-cost",
      sortDate: firstDate(
        buyer?.delivery_date,
        pickupRequest?.request_date,
        pickupRequest?.created_at,
        accountOpenedDate
      ),
      label: "Transportation Fee",
      detail: displayText(
        buyer?.delivery_option || requestEstimate?.detail || pickupRequest?.request_type,
        "Transportation fee saved to your account."
      ),
      charge: transportationCost,
      credit: 0,
      statusLabel: "On File",
      tone: "warning",
      order: 20,
    });
  }

  if (depositAmount > 0 && depositApplied) {
    drafted.push({
      key: "deposit-paid",
      sortDate: firstDate(buyer?.deposit_date, accountOpenedDate),
      label: "Deposit Paid",
      detail: "Deposit already applied to your puppy account.",
      charge: 0,
      credit: depositAmount,
      statusLabel: "Applied",
      tone: "success",
      order: 30,
    });
  }

  if (financeEnabled && financeUplift > 0) {
    const financeDetails = [
      monthlyAmount !== null ? `${toMoney(monthlyAmount)} monthly` : "",
      months !== null ? `${months} months` : "",
      apr !== null ? `${apr}% APR` : "",
      adminFeeEnabled ? "admin fee included" : "",
    ]
      .filter(Boolean)
      .join(" • ");

    drafted.push({
      key: "payment-plan-uplift",
      sortDate: firstDate(accountOpenedDate, nextDueDate),
      label: "Puppy Payment Plan",
      detail:
        financeDetails ||
        "Financing cost based on the current plan terms saved to your account.",
      charge: financeUplift,
      credit: 0,
      statusLabel: "Financing",
      tone: "warning",
      order: 40,
    });
  }

  const ascendingAdjustments = [...adjustments].sort((a, b) => {
    const aTime = new Date(firstDate(a.entry_date, a.created_at)).getTime();
    const bTime = new Date(firstDate(b.entry_date, b.created_at)).getTime();
    return aTime - bTime;
  });

  ascendingAdjustments.forEach((adjustment, index) => {
    const effect = classifyAdjustmentEffect(adjustment);
    const type = effect.charge > 0 ? "charge" : effect.credit > 0 ? "credit" : "neutral";

    drafted.push({
      key: `adjustment-${adjustment.id}`,
      sortDate: firstDate(adjustment.entry_date, adjustment.created_at, accountOpenedDate),
      label: adjustmentTypeLabel(adjustment),
      detail: [
        adjustment.description ? adjustment.description : "",
        adjustment.reference_number ? `Ref ${adjustment.reference_number}` : "",
      ]
        .filter(Boolean)
        .join(" • "),
      charge: effect.charge,
      credit: effect.credit,
      statusLabel: displayText(adjustment.status, "Recorded"),
      tone: entryTone(displayText(adjustment.status, "Recorded"), type),
      order: 80 + index,
    });
  });

  const ascendingPayments = [...payments].sort((a, b) => {
    const aTime = new Date(firstDate(a.payment_date, a.created_at)).getTime();
    const bTime = new Date(firstDate(b.payment_date, b.created_at)).getTime();
    return aTime - bTime;
  });

  ascendingPayments.forEach((payment, index) => {
    const effect = classifyLedgerEffect(payment);
    const type = effect.charge > 0 ? "charge" : effect.credit > 0 ? "credit" : "neutral";

    drafted.push({
      key: `payment-${payment.id}`,
      sortDate: firstDate(payment.payment_date, payment.created_at, accountOpenedDate),
      label: paymentTypeLabel(payment),
      detail: [
        displayText(payment.method, "Method not listed"),
        payment.reference_number ? `Ref ${payment.reference_number}` : "",
        payment.note ? payment.note : "",
      ]
        .filter(Boolean)
        .join(" • "),
      charge: effect.charge,
      credit: effect.credit,
      statusLabel: displayText(payment.status, "Recorded"),
      tone: entryTone(displayText(payment.status, "Recorded"), type),
      order: 100 + index,
    });
  });

  drafted.sort((a, b) => {
    const aTime = new Date(a.sortDate).getTime();
    const bTime = new Date(b.sortDate).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return a.order - b.order;
  });

  let runningBalance = 0;

  const entries = drafted.map((entry) => {
    runningBalance = Math.max(0, runningBalance + entry.charge - entry.credit);

    return {
      key: entry.key,
      sortDate: entry.sortDate,
      dateLabel: entry.sortDate ? fmtDate(entry.sortDate) : "Date unavailable",
      label: entry.label,
      detail: entry.detail,
      charge: entry.charge,
      credit: entry.credit,
      runningBalance,
      statusLabel: entry.statusLabel,
      tone: entry.tone,
    };
  });

  const totalCharges = entries.reduce((sum, entry) => sum + entry.charge, 0);
  const totalCredits = entries.reduce((sum, entry) => sum + entry.credit, 0);
  const paymentsApplied = ascendingPayments.reduce((sum, payment) => {
    const effect = classifyLedgerEffect(payment);
    return sum + effect.credit;
  }, 0);
  const adjustmentCharges = ascendingAdjustments.reduce((sum, adjustment) => {
    const effect = classifyAdjustmentEffect(adjustment);
    return sum + effect.charge;
  }, 0);
  const adjustmentCredits = ascendingAdjustments.reduce((sum, adjustment) => {
    const effect = classifyAdjustmentEffect(adjustment);
    return sum + effect.credit;
  }, 0);

  return {
    entries,
    summary: {
      purchasePrice,
      depositAmount,
      transportationCost,
      paymentsApplied,
      adjustmentCharges,
      adjustmentCredits,
      financeEnabled,
      adminFeeEnabled,
      apr,
      monthlyAmount,
      months,
      nextDueDate,
      lastPostedPaymentDate,
      principalAfterDeposit,
      financeBaseTotal,
      planTotal,
      financeUplift,
      currentBalance: entries[entries.length - 1]?.runningBalance ?? 0,
      totalCharges,
      totalCredits,
    },
  };
}

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  return (
    <tr className="border-t border-[var(--portal-border)]">
      <td className="px-5 py-4 text-sm font-medium text-[var(--portal-text)]">{entry.dateLabel}</td>
      <td className="px-5 py-4 text-sm text-[var(--portal-text-soft)]">
        <div className="font-semibold text-[var(--portal-text)]">{entry.label}</div>
        <div className="mt-1 text-xs leading-5 text-[var(--portal-text-muted)]">{entry.detail}</div>
      </td>
      <td className="px-5 py-4 text-sm font-semibold text-[var(--portal-text)]">
        {entry.charge > 0 ? toMoney(entry.charge) : "—"}
      </td>
      <td className="px-5 py-4 text-sm font-semibold text-[var(--portal-text)]">
        {entry.credit > 0 ? toMoney(entry.credit) : "—"}
      </td>
      <td className="px-5 py-4 text-sm font-semibold text-[var(--portal-text)]">
        {toMoney(entry.runningBalance)}
      </td>
      <td className="px-5 py-4 text-sm">
        <PortalStatusBadge label={entry.statusLabel} tone={entry.tone} />
      </td>
    </tr>
  );
}

function SummaryPill({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[22px] border border-[var(--portal-border)] bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center gap-2 text-[var(--portal-accent-strong)]">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
          {label}
        </span>
      </div>
      <div className="mt-3 text-base font-semibold text-[var(--portal-text)]">{value}</div>
      <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
    </div>
  );
}

function FinanceCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[22px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
        {title}
      </div>
      <div className="mt-2 text-lg font-semibold text-[var(--portal-text)]">{value}</div>
      <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
    </div>
  );
}

function ActionCard({
  title,
  detail,
  buttonLabel,
  onClick,
  disabled,
  busy,
  tone = "primary",
}: {
  title: string;
  detail: string;
  buttonLabel: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  tone?: "primary" | "secondary";
}) {
  return (
    <div className="rounded-[24px] border border-[var(--portal-border)] bg-white p-5 shadow-sm">
      <div className="text-base font-semibold text-[var(--portal-text)]">{title}</div>
      <div className="mt-2 text-sm leading-7 text-[var(--portal-text-soft)]">{detail}</div>
      <div className="mt-5">
        {tone === "primary" ? (
          <PortalButton onClick={onClick} disabled={disabled || busy}>
            {busy ? "Opening..." : buttonLabel}
          </PortalButton>
        ) : (
          <PortalSecondaryButton onClick={onClick} disabled={disabled || busy}>
            {busy ? "Opening..." : buttonLabel}
          </PortalSecondaryButton>
        )}
      </div>
    </div>
  );
}

function QuickAmountButton({
  label,
  amount,
  active,
  onClick,
}: {
  label: string;
  amount: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-[16px] border px-4 py-3 text-left transition",
        active
          ? "border-[#c79a6a] bg-[linear-gradient(180deg,rgba(255,252,247,0.98)_0%,rgba(247,240,232,0.98)_100%)] shadow-[0_16px_28px_rgba(120,81,45,0.10)]"
          : "border-[var(--portal-border)] bg-white hover:-translate-y-0.5 hover:border-[var(--portal-border-strong)]",
      ].join(" ")}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-base font-semibold text-[var(--portal-text)]">
        {toMoney(amount)}
      </div>
    </button>
  );
}

export default function PortalPaymentsPage() {
  const { user, loading: sessionLoading } = usePortalSession();
  const [data, setData] = useState<PaymentPageState>(emptyState);
  const [billingSubscription, setBillingSubscription] = useState<PortalBillingSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [paymentStatusText, setPaymentStatusText] = useState("");
  const [paymentErrorText, setPaymentErrorText] = useState("");
  const [billingStatusText, setBillingStatusText] = useState("");
  const [billingErrorText, setBillingErrorText] = useState("");
  const [billingBusy, setBillingBusy] = useState(false);
  const [payingKind, setPayingKind] = useState<PortalChargeKind | "">("");
  const [customAmount, setCustomAmount] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPage() {
      if (!user) {
        setData(emptyState());
        setBillingSubscription(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorText("");
      setBillingErrorText("");

      try {
        const session = await getClientSessionWithTimeout(sb, {
          context: "src/app/portal/payments/page.tsx:loadPage",
        });
        const accessToken = session?.access_token || "";
        const context = await loadPortalContext(user);

        const [payments, adjustments, pickupRequest, billingResponse] = await Promise.all([
          findBuyerPayments(context.buyer?.id),
          findBuyerFeeCreditRecords(context.buyer?.id),
          findLatestPickupRequestForUser(user),
          accessToken
            ? fetch("/api/portal/payments/billing", {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              })
            : Promise.resolve(null),
        ]);

        if (!active) return;

        setData({
          buyer: context.buyer,
          puppy: context.puppy,
          payments,
          adjustments,
          pickupRequest,
        });

        if (billingResponse) {
          const billingJson = (await billingResponse.json()) as {
            ok?: boolean;
            message?: string;
            subscription?: PortalBillingSubscription | null;
          };

          if (!active) return;

          if (billingResponse.ok && billingJson.ok !== false) {
            setBillingSubscription(billingJson.subscription || null);
          } else {
            setBillingSubscription(null);
            setBillingErrorText(
              billingJson.message || "We could not load the automatic puppy payment-plan details."
            );
          }
        } else {
          setBillingSubscription(null);
        }
      } catch (error) {
        console.error("Could not load payments page:", error);
        if (!active) return;
        setErrorText(
          "We could not load your payment details right now. Please refresh or try again in a moment."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPage();

    return () => {
      active = false;
    };
  }, [user]);

  const { entries, summary } = useMemo(() => buildLedgerEntries(data), [data]);
  const paymentSnapshot = useMemo(() => buildPortalPaymentChargeSnapshot(data), [data]);
  const customAmountNumber = useMemo(() => parseAmountInput(customAmount), [customAmount]);

  const quickAmounts = useMemo(
    () =>
      [
        paymentSnapshot.depositDue > 0
          ? { label: "Deposit Due", amount: paymentSnapshot.depositDue }
          : null,
        paymentSnapshot.installmentDue > 0
          ? { label: "Installment", amount: paymentSnapshot.installmentDue }
          : null,
        paymentSnapshot.transportationDue > 0
          ? { label: "Transportation", amount: paymentSnapshot.transportationDue }
          : null,
        paymentSnapshot.currentBalance > 0
          ? { label: "Full Balance", amount: paymentSnapshot.currentBalance }
          : null,
      ]
        .filter((item): item is { label: string; amount: number } => Boolean(item))
        .filter(
          (item, index, array) =>
            array.findIndex((candidate) => Math.abs(candidate.amount - item.amount) < 0.001) ===
            index
        ),
    [
      paymentSnapshot.currentBalance,
      paymentSnapshot.depositDue,
      paymentSnapshot.installmentDue,
      paymentSnapshot.transportationDue,
    ]
  );

  const customAmountError = useMemo(() => {
    if (!(paymentSnapshot.currentBalance > 0)) return "";
    if (!customAmount.trim()) return "Enter the amount you want to pay.";
    if (!(customAmountNumber > 0)) return "Enter a valid payment amount.";
    if (customAmountNumber > paymentSnapshot.customPaymentMax + 0.001) {
      return "That amount is higher than the current balance on this account.";
    }
    if (
      paymentSnapshot.finalBalanceDueNow &&
      customAmountNumber < paymentSnapshot.currentBalance - 0.001
    ) {
      return "The full remaining balance is required now before pickup or delivery.";
    }
    return "";
  }, [
    customAmount,
    customAmountNumber,
    paymentSnapshot.currentBalance,
    paymentSnapshot.customPaymentMax,
    paymentSnapshot.finalBalanceDueNow,
  ]);

  useEffect(() => {
    setCustomAmount((current) => {
      const currentNumber = parseAmountInput(current);
      if (
        !current.trim() ||
        !(currentNumber > 0) ||
        currentNumber > paymentSnapshot.customPaymentMax + 0.001 ||
        (paymentSnapshot.finalBalanceDueNow &&
          currentNumber < paymentSnapshot.currentBalance - 0.001)
      ) {
        return defaultCustomAmount(paymentSnapshot);
      }
      return current;
    });
  }, [paymentSnapshot]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const result = params.get("zoho_payment");
    const charge = params.get("charge");

    if (result === "success") {
      setPaymentStatusText(paymentSuccessText(charge));
      setPaymentErrorText("");
      return;
    }

    if (result === "invalid_signature") {
      setPaymentStatusText("");
      setPaymentErrorText(
        "We could not verify the payment return. Please contact us if your payment was completed."
      );
      return;
    }

    if (result === "not_completed") {
      setPaymentStatusText("");
      setPaymentErrorText(
        "Your payment was not completed. You can try again whenever you are ready."
      );
      return;
    }

    if (result === "invalid_reference" || result === "error") {
      setPaymentStatusText("");
      setPaymentErrorText(
        "We could not finish syncing that payment automatically. Please contact us and we will verify it right away."
      );
    }
  }, []);

  async function startZohoPayment(chargeKind: PortalChargeKind, amount?: number) {
    setPaymentStatusText("");
    setPaymentErrorText("");
    setPayingKind(chargeKind);

    try {
      const {
        data: { session },
      } = await sb.auth.getSession();
      const accessToken = session?.access_token || "";

      if (!accessToken) {
        throw new Error("Please sign in again before creating a payment link.");
      }

      const response = await fetch("/api/portal/payments/zoho", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          charge_kind: chargeKind,
          ...(amount !== undefined ? { amount } : {}),
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        url?: string;
      };

      if (!response.ok || !payload.url) {
        throw new Error(payload.message || "Could not create the payment link right now.");
      }

      window.location.assign(payload.url);
    } catch (error) {
      console.error("Could not start Zoho payment:", error);
      setPaymentErrorText(
        error instanceof Error
          ? error.message
          : "Could not create the payment link right now."
      );
    } finally {
      setPayingKind("");
    }
  }

  async function manageBillingPaymentMethod() {
    setBillingStatusText("");
    setBillingErrorText("");
    setBillingBusy(true);

    try {
      const {
        data: { session },
      } = await sb.auth.getSession();
      const accessToken = session?.access_token || "";

      if (!accessToken) {
        throw new Error("Please sign in again before updating the saved payment method.");
      }

      const response = await fetch("/api/portal/payments/billing", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        url?: string;
        subscription?: PortalBillingSubscription | null;
      };

      if (!response.ok || !payload.ok || !payload.url) {
        throw new Error(
          payload.message || "Could not open the secure payment-method update page."
        );
      }

      setBillingSubscription(payload.subscription || billingSubscription);
      setBillingStatusText("The secure Zoho Billing payment-method page opened in a new tab.");
      window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error(error);
      setBillingErrorText(
        error instanceof Error
          ? error.message
          : "Could not open the secure payment-method update page."
      );
    } finally {
      setBillingBusy(false);
    }
  }

  if (sessionLoading || loading) {
    return <PortalLoadingState label="Loading payments..." />;
  }

  if (!user) {
    return (
      <PortalPageHero
        eyebrow="Payments"
        title="Sign in to review your itemized account."
        description="Purchase price, deposit, logged payments, financing terms, transportation charges, and the current balance appear here once you are signed in."
      />
    );
  }

  if (errorText) {
    return <PortalErrorState title="Payments are unavailable" description={errorText} />;
  }

  const { buyer, puppy, payments } = data;
  const puppyName = portalPuppyName(puppy);
  const paidInFull = paymentSnapshot.currentBalance <= 0 && entries.length > 0;
  const financePlanActive = summary.financeEnabled || billingSubscriptionActive(billingSubscription);

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Payments"
        title="Payments & Account Ledger"
        description="Review your full account picture in one place — purchase price, deposit, financing, transportation, payment history, billing details, and current balance."
        aside={
          <div className="rounded-[30px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(243,248,253,0.95)_100%)] p-5 shadow-[0_18px_40px_rgba(23,35,56,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--portal-text-muted)]">
                  Current Balance
                </div>
                <div className="mt-2 text-[2.25rem] font-semibold tracking-[-0.05em] text-[var(--portal-text)]">
                  {toMoney(paymentSnapshot.currentBalance)}
                </div>
              </div>
              <PortalStatusBadge
                label={
                  paidInFull
                    ? "Paid in Full"
                    : financePlanActive
                      ? "Payment Plan"
                      : "Open Balance"
                }
                tone={paidInFull ? "success" : financePlanActive ? "warning" : "neutral"}
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-white px-4 py-3 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                  My Puppy
                </div>
                <div className="mt-2 text-base font-semibold text-[var(--portal-text)]">
                  {puppyName}
                </div>
              </div>
              <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-white px-4 py-3 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                  Next Due
                </div>
                <div className="mt-2 text-base font-semibold text-[var(--portal-text)]">
                  {summary.nextDueDate ? fmtDate(summary.nextDueDate) : "Not scheduled"}
                </div>
              </div>
            </div>

            <div className="mt-4 text-sm leading-7 text-[var(--portal-text-soft)]">
              {paymentPolicyMessage(paymentSnapshot)}
            </div>
          </div>
        }
      />

      {paymentStatusText ? (
        <div className="rounded-[20px] border border-[rgba(47,143,103,0.18)] bg-[linear-gradient(180deg,rgba(246,253,249,0.98)_0%,rgba(240,249,245,0.94)_100%)] px-4 py-3 text-sm font-semibold text-[#2f7657]">
          {paymentStatusText}
        </div>
      ) : null}

      {paymentErrorText ? (
        <div className="rounded-[20px] border border-[rgba(194,84,114,0.16)] bg-[linear-gradient(180deg,rgba(255,249,251,0.98)_0%,rgba(255,242,246,0.94)_100%)] px-4 py-3 text-sm font-semibold text-[#aa4f68]">
          {paymentErrorText}
        </div>
      ) : null}

      {billingStatusText ? (
        <div className="rounded-[20px] border border-[rgba(47,143,103,0.18)] bg-[linear-gradient(180deg,rgba(246,253,249,0.98)_0%,rgba(240,249,245,0.94)_100%)] px-4 py-3 text-sm font-semibold text-[#2f7657]">
          {billingStatusText}
        </div>
      ) : null}

      {billingErrorText ? (
        <div className="rounded-[20px] border border-[rgba(194,84,114,0.16)] bg-[linear-gradient(180deg,rgba(255,249,251,0.98)_0%,rgba(255,242,246,0.94)_100%)] px-4 py-3 text-sm font-semibold text-[#aa4f68]">
          {billingErrorText}
        </div>
      ) : null}

      <PortalMetricGrid>
        <PortalMetricCard
          label="Payments Applied"
          value={toMoney(summary.paymentsApplied)}
          detail={`${payments.length} payment${payments.length === 1 ? "" : "s"} recorded.`}
        />
        <PortalMetricCard
          label="Purchase Price"
          value={toMoney(summary.purchasePrice)}
          detail="Purchase price on file for this puppy account."
          accent="from-[rgba(93,121,255,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
        <PortalMetricCard
          label="Transportation"
          value={summary.transportationCost > 0 ? toMoney(summary.transportationCost) : "Not listed"}
          detail="Transportation charges and estimates tied to this account."
          accent="from-[rgba(110,166,218,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
        <PortalMetricCard
          label="Plan Status"
          value={
            paidInFull
              ? "Complete"
              : financePlanActive
                ? "Active"
                : "Standard"
          }
          detail={
            financePlanActive
              ? "Account includes financing or billing automation."
              : "Standard payment flow."
          }
          accent="from-[rgba(113,198,164,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_430px]">
        <div className="space-y-6">
          <PortalPanel
            title="Account Summary"
            subtitle="The major numbers are surfaced here first so you can understand the account before reviewing the ledger."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FinanceCard
                title="Purchase Price"
                value={toMoney(summary.purchasePrice)}
                detail="Original puppy amount on file."
              />
              <FinanceCard
                title="Deposit"
                value={summary.depositAmount > 0 ? toMoney(summary.depositAmount) : "Not listed"}
                detail="Deposit amount tied to the account."
              />
              <FinanceCard
                title="Total Charges"
                value={toMoney(summary.totalCharges)}
                detail="Purchase, fees, and financing charges in the ledger."
              />
              <FinanceCard
                title="Total Credits"
                value={toMoney(summary.totalCredits)}
                detail="Payments and credits applied to the account."
              />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <PortalInfoTile
                label="Last Posted Payment"
                value={
                  summary.lastPostedPaymentDate
                    ? fmtDate(summary.lastPostedPaymentDate)
                    : "Not posted yet"
                }
                detail="Most recent payment date on file."
                tone={summary.lastPostedPaymentDate ? "success" : "neutral"}
              />
              <PortalInfoTile
                label="Adjustment Activity"
                value={
                  summary.adjustmentCharges > 0 || summary.adjustmentCredits > 0
                    ? `${toMoney(summary.adjustmentCharges)} charges • ${toMoney(summary.adjustmentCredits)} credits`
                    : "No adjustments on file"
                }
                detail="Additional fees and credits recorded outside direct payments."
              />
            </div>
          </PortalPanel>

          <PortalPanel
            title="Make a Payment"
            subtitle="Use the secure Zoho checkout links below based on what is currently due."
          >
            <div className="grid gap-4">
              <div className="rounded-[24px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(243,248,253,0.95)_100%)] p-5 shadow-[0_10px_22px_rgba(23,35,56,0.05)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                  Payment Guidance
                </div>
                <div className="mt-3 text-sm leading-7 text-[var(--portal-text-soft)]">
                  {paymentPolicyMessage(paymentSnapshot)}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {quickAmounts.map((item) => (
                  <QuickAmountButton
                    key={`${item.label}-${item.amount}`}
                    label={item.label}
                    amount={item.amount}
                    active={Math.abs(customAmountNumber - item.amount) < 0.001}
                    onClick={() => setCustomAmount(formatAmountInput(item.amount))}
                  />
                ))}
              </div>

              <div className="rounded-[24px] border border-[var(--portal-border)] bg-white p-5 shadow-sm">
                <div className="text-sm font-semibold text-[var(--portal-text)]">Custom Amount</div>
                <div className="mt-2 text-sm leading-7 text-[var(--portal-text-soft)]">
                  Enter any allowed amount up to the current balance.
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={customAmount}
                    onChange={(event) => setCustomAmount(event.target.value)}
                    placeholder="0.00"
                    className={`${portalInputClass} sm:max-w-[220px]`}
                  />
                  <PortalButton
                    onClick={() => void startZohoPayment("general", customAmountNumber)}
                    disabled={Boolean(customAmountError) || payingKind === "general"}
                  >
                    {payingKind === "general"
                      ? "Opening Checkout..."
                      : `${paymentActionLabel("general")} ${customAmountNumber > 0 ? `• ${toMoney(customAmountNumber)}` : ""}`}
                  </PortalButton>
                </div>

                {customAmountError ? (
                  <div className="mt-3 text-sm font-medium text-[#aa4f68]">{customAmountError}</div>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {paymentSnapshot.depositDue > 0 ? (
                  <ActionCard
                    title="Deposit"
                    detail={`Open secure checkout for the deposit amount currently due: ${toMoney(
                      paymentSnapshot.depositDue
                    )}.`}
                    buttonLabel={`${paymentActionLabel("deposit")} • ${toMoney(paymentSnapshot.depositDue)}`}
                    onClick={() => void startZohoPayment("deposit")}
                    busy={payingKind === "deposit"}
                  />
                ) : null}

                {paymentSnapshot.installmentDue > 0 ? (
                  <ActionCard
                    title="Installment"
                    detail={`Open secure checkout for the installment amount currently due: ${toMoney(
                      paymentSnapshot.installmentDue
                    )}.`}
                    buttonLabel={`${paymentActionLabel("installment")} • ${toMoney(paymentSnapshot.installmentDue)}`}
                    onClick={() => void startZohoPayment("installment")}
                    busy={payingKind === "installment"}
                  />
                ) : null}

                {paymentSnapshot.transportationDue > 0 ? (
                  <ActionCard
                    title="Transportation Fee"
                    detail={`Open secure checkout for the transportation amount currently due: ${toMoney(
                      paymentSnapshot.transportationDue
                    )}.`}
                    buttonLabel={`${paymentActionLabel("transportation")} • ${toMoney(paymentSnapshot.transportationDue)}`}
                    onClick={() => void startZohoPayment("transportation")}
                    busy={payingKind === "transportation"}
                  />
                ) : null}
              </div>
            </div>
          </PortalPanel>

          <PortalPanel
            title="Itemized Ledger"
            subtitle="Every charge, credit, and payment is shown in order so the balance is easier to understand."
          >
            {entries.length ? (
              <div className="overflow-hidden rounded-[24px] border border-[var(--portal-border)] bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="bg-[var(--portal-surface-muted)] text-left">
                        <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                          Date
                        </th>
                        <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                          Entry
                        </th>
                        <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                          Charge
                        </th>
                        <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                          Credit
                        </th>
                        <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                          Balance
                        </th>
                        <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <LedgerRow key={entry.key} entry={entry} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <PortalEmptyState
                title="No ledger entries yet"
                description="Once purchase details, payments, or credits are posted to your account, the ledger will appear here."
              />
            )}
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel
            title="Payment Plan & Billing"
            subtitle="Financing and recurring billing details are grouped here so the account is easier to manage."
          >
            <div className="grid gap-4">
              <SummaryPill
                icon={<Wallet className="h-4 w-4" />}
                label="Plan Status"
                value={
                  financePlanActive
                    ? "Active payment plan"
                    : summary.financeEnabled
                      ? "Plan on file"
                      : "No active plan"
                }
                detail={
                  financePlanActive
                    ? "Recurring or financed account details are active."
                    : "Standard payment flow unless financing is approved."
                }
              />

              <SummaryPill
                icon={<CalendarDays className="h-4 w-4" />}
                label="Next Due"
                value={summary.nextDueDate ? fmtDate(summary.nextDueDate) : "Not scheduled"}
                detail="Next due date currently saved to the buyer account."
              />

              <SummaryPill
                icon={<Banknote className="h-4 w-4" />}
                label="Monthly Amount"
                value={summary.monthlyAmount !== null ? toMoney(summary.monthlyAmount) : "Not listed"}
                detail={
                  summary.months !== null
                    ? `${summary.months} month${summary.months === 1 ? "" : "s"} on file`
                    : "Number of months not listed"
                }
              />

              <SummaryPill
                icon={<Receipt className="h-4 w-4" />}
                label="APR / Financing"
                value={summary.apr !== null ? `${summary.apr}% APR` : "Not listed"}
                detail={
                  summary.financeUplift > 0
                    ? `${toMoney(summary.financeUplift)} added by financing terms`
                    : "No financing uplift calculated"
                }
              />
            </div>

            <div className="mt-5 grid gap-4">
              <ActionCard
                title="Manage Saved Payment Method"
                detail={billingPaymentMethodDetail(billingSubscription)}
                buttonLabel="Open Zoho Billing"
                onClick={() => void manageBillingPaymentMethod()}
                busy={billingBusy}
                tone="secondary"
              />

              <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                      Billing Status
                    </div>
                    <div className="mt-2 text-base font-semibold text-[var(--portal-text)]">
                      {billingStatusLabel(billingSubscription)}
                    </div>
                  </div>
                  <PortalStatusBadge
                    label={billingStatusLabel(billingSubscription)}
                    tone={billingStatusTone(billingSubscription)}
                  />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <PortalInfoTile
                    label="Payment Method"
                    value={billingPaymentMethodValue(billingSubscription)}
                    detail={billingPaymentMethodDetail(billingSubscription)}
                  />
                  <PortalInfoTile
                    label="Last Billing Payment"
                    value={
                      billingSubscription?.last_payment_at
                        ? fmtDate(billingSubscription.last_payment_at)
                        : "Not posted yet"
                    }
                    detail={
                      billingSubscription?.last_payment_amount !== null &&
                      billingSubscription?.last_payment_amount !== undefined
                        ? `${toMoney(billingSubscription.last_payment_amount)} was the last billing payment.`
                        : "No billing payment amount has synced yet."
                    }
                  />
                </div>
              </div>
            </div>
          </PortalPanel>

          <PortalPanel
            title="Payment Tools"
            subtitle="Helpful shortcuts related to financing and secure payment management."
          >
            <div className="grid gap-4">
              <ActionCard
                title="Financing Application"
                detail="If you need puppy financing and have not applied yet, open the financing application here."
                buttonLabel="Open Financing Application"
                onClick={() => window.open(financingUrl, "_blank", "noopener,noreferrer")}
                tone="secondary"
              />
              <div className="rounded-[24px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(243,248,253,0.95)_100%)] p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--portal-surface-muted)] text-[var(--portal-accent-strong)]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-[var(--portal-text)]">
                      Secure checkout and billing
                    </div>
                    <div className="mt-2 text-sm leading-7 text-[var(--portal-text-soft)]">
                      Single payments open through secure Zoho Payments checkout. Saved payment
                      methods and recurring billing details are managed through Zoho Billing when
                      available.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </PortalPanel>

          <PortalPanel
            title="Account Highlights"
            subtitle="A cleaner snapshot of the account without having to read through the ledger first."
          >
            <div className="grid gap-4">
              <PortalInfoTile
                label="My Puppy"
                value={puppyName}
                detail="The buyer account shown on this page is tied to this puppy profile."
              />
              <PortalInfoTile
                label="Transportation Estimate"
                value={
                  data.pickupRequest
                    ? calculateTransportEstimate(
                        (data.pickupRequest.request_type as PickupRequestType) || "",
                        data.pickupRequest.miles
                      ).label
                    : "Not scheduled"
                }
                detail={
                  data.pickupRequest
                    ? calculateTransportEstimate(
                        (data.pickupRequest.request_type as PickupRequestType) || "",
                        data.pickupRequest.miles
                      ).detail
                    : "Transportation costs appear here once pickup or delivery details are saved."
                }
              />
              <PortalInfoTile
                label="Finance Base"
                value={toMoney(summary.financeBaseTotal)}
                detail={
                  summary.planTotal !== null
                    ? `Payment plan total on file: ${toMoney(summary.planTotal)}`
                    : `Principal after deposit: ${toMoney(summary.principalAfterDeposit)}`
                }
              />
              <PortalInfoTile
                label="Admin Fee"
                value={summary.adminFeeEnabled ? "Included" : "Not enabled"}
                detail="Reflects whether the current buyer financing setup includes an admin fee."
              />
            </div>
          </PortalPanel>
        </div>
      </section>
    </div>
  );
}
