"use client";

import React, { useEffect, useMemo, useState } from "react";
import { fmtDate } from "@/lib/utils";
import {
  findBuyerPayments,
  findLatestPickupRequestForUser,
  loadPortalContext,
  paymentCountsTowardBalance,
  portalPuppyName,
  type PortalBuyer,
  type PortalPayment,
  type PortalPickupRequest,
  type PortalPuppy,
} from "@/lib/portal-data";
import { usePortalSession } from "@/hooks/use-portal-session";
import {
  PortalEmptyState,
  PortalErrorState,
  PortalInfoTile,
  PortalLoadingState,
  PortalMetricCard,
  PortalMetricGrid,
  PortalPageHero,
  PortalPanel,
  PortalStatusBadge,
  PortalTable,
} from "@/components/portal/luxury-shell";
import { calculateTransportEstimate, type PickupRequestType } from "@/lib/transportation-pricing";

const financingUrl =
  "https://forms.zoho.com/southwestvirginiachihuahua/form/PuppyFinancingApplication";

type PaymentPageState = {
  buyer: PortalBuyer | null;
  puppy: PortalPuppy | null;
  payments: PortalPayment[];
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
  financeEnabled: boolean;
  adminFeeEnabled: boolean;
  apr: number | null;
  monthlyAmount: number | null;
  months: number | null;
  nextDueDate: string | null;
  lastPostedPaymentDate: string | null;
  planTotal: number | null;
  financeUplift: number;
  currentBalance: number;
  totalCharges: number;
  totalCredits: number;
};

function emptyState(): PaymentPageState {
  return {
    buyer: null,
    puppy: null,
    payments: [],
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

function buildLedgerEntries(state: PaymentPageState): {
  entries: LedgerEntry[];
  summary: FinanceSummary;
} {
  const { buyer, puppy, payments, pickupRequest } = state;
  const purchasePrice = firstNumber(buyer?.sale_price, puppy?.price);
  const depositAmount = firstNumber(buyer?.deposit_amount, puppy?.deposit);
  const requestEstimate = pickupRequest
    ? calculateTransportEstimate(
        (pickupRequest.request_type as PickupRequestType) || "",
        pickupRequest.miles
      )
    : null;
  const transportationCost = firstNumber(
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
  const financeUplift =
    planTotal !== null ? Math.max(0, planTotal - Math.max(0, purchasePrice - depositAmount)) : 0;
  const nextDueDate = buyer?.finance_next_due_date || null;
  const lastPostedPaymentDate = buyer?.finance_last_payment_date || payments[0]?.payment_date || null;
  const puppyName = portalPuppyName(puppy);
  const hasLoggedDeposit = payments.some(
    (payment) =>
      paymentCountsTowardBalance(payment.status) &&
      includesKeyword(payment.payment_type, ["deposit"])
  );
  const hasLoggedTransportation = payments.some(
    (payment) =>
      paymentCountsTowardBalance(payment.status) &&
      includesKeyword(payment.payment_type, ["transport", "delivery", "shipping"])
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

  const accountOpenedDate = firstDate(buyer?.created_at, puppy?.created_at, payments[0]?.created_at);

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

  if (transportationCost > 0 && !hasLoggedTransportation) {
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

  if (depositAmount > 0 && !hasLoggedDeposit) {
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
      detail: financeDetails || "Financing cost based on the current plan terms saved to your account.",
      charge: financeUplift,
      credit: 0,
      statusLabel: "Financing",
      tone: "warning",
      order: 40,
    });
  }

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

  return {
    entries,
    summary: {
      purchasePrice,
      depositAmount,
      transportationCost,
      paymentsApplied,
      financeEnabled,
      adminFeeEnabled,
      apr,
      monthlyAmount,
      months,
      nextDueDate,
      lastPostedPaymentDate,
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

export default function PortalPaymentsPage() {
  const { user, loading: sessionLoading } = usePortalSession();
  const [data, setData] = useState<PaymentPageState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPage() {
      if (!user) {
        setData(emptyState());
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorText("");

      try {
        const context = await loadPortalContext(user);
        const [payments, pickupRequest] = await Promise.all([
          findBuyerPayments(context.buyer?.id),
          findLatestPickupRequestForUser(user),
        ]);

        if (!active) return;
        setData({
          buyer: context.buyer,
          puppy: context.puppy,
          payments,
          pickupRequest,
        });
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

  const { puppy, payments } = data;
  const puppyName = portalPuppyName(puppy);
  const paidInFull = summary.currentBalance <= 0 && entries.length > 0;

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Payments"
        title="Review every charge, credit, and payment in one place."
        description="Your account ledger shows the purchase price, deposit, logged payments, transportation cost, financing terms, and the current balance tied to your puppy account."
        aside={
          <div className="rounded-[30px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(243,248,253,0.95)_100%)] p-5 shadow-[0_18px_40px_rgba(23,35,56,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--portal-text-muted)]">
                  Current Balance
                </div>
                <div className="mt-2 text-[2.25rem] font-semibold tracking-[-0.05em] text-[var(--portal-text)]">
                  {toMoney(summary.currentBalance)}
                </div>
              </div>
              <PortalStatusBadge
                label={
                  paidInFull
                    ? "Paid in Full"
                    : summary.financeEnabled
                      ? "Payment Plan"
                      : "Open Balance"
                }
                tone={paidInFull ? "success" : summary.financeEnabled ? "warning" : "neutral"}
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
                  {summary.nextDueDate ? fmtDate(summary.nextDueDate) : "No due date"}
                </div>
              </div>
            </div>
          </div>
        }
      />

      <PortalMetricGrid>
        <PortalMetricCard
          label="Purchase Price"
          value={toMoney(summary.purchasePrice)}
          detail="Base purchase amount currently saved to your account."
        />
        <PortalMetricCard
          label="Credits & Payments"
          value={toMoney(summary.totalCredits)}
          detail={`${payments.length} logged payment entr${payments.length === 1 ? "y" : "ies"} plus any credits on file.`}
          accent="from-[rgba(93,121,255,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
        <PortalMetricCard
          label="Charges"
          value={toMoney(summary.totalCharges)}
          detail="Includes purchase price, transportation, fees, and payment-plan cost if applicable."
          accent="from-[rgba(110,166,218,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
        <PortalMetricCard
          label="Balance"
          value={toMoney(summary.currentBalance)}
          detail="Automatically calculated from the itemized ledger below."
          accent="from-[rgba(113,198,164,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
        <div className="space-y-6">
          <PortalPanel
            title="Itemized Account Ledger"
            subtitle="Every charge, payment, transportation amount, fee, and credit appears here as its own line item with a running balance."
          >
            {entries.length ? (
              <PortalTable headers={["Date", "Entry", "Charge", "Credit", "Balance", "Status"]}>
                {entries.map((entry) => (
                  <LedgerRow key={entry.key} entry={entry} />
                ))}
              </PortalTable>
            ) : (
              <PortalEmptyState
                title="No account entries yet"
                description="When your purchase price, deposit, transportation amount, or any payment entry is recorded to your account, the itemized ledger will appear here."
              />
            )}
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel
            title="Payment Plan Details"
            subtitle="APR, admin fee status, monthly payment, due date, and other payment-plan details stay together here."
          >
            {summary.financeEnabled ? (
              <div className="grid gap-4">
                <PortalInfoTile
                  label="APR"
                  value={summary.apr !== null ? `${summary.apr}%` : "Not listed"}
                  detail="Annual percentage rate currently saved to your account."
                />
                <PortalInfoTile
                  label="Admin Fee"
                  value={summary.adminFeeEnabled ? "Enabled" : "Not listed"}
                  detail="Shows whether the payment plan is marked with an admin fee."
                  tone={summary.adminFeeEnabled ? "warning" : "neutral"}
                />
                <PortalInfoTile
                  label="Monthly Payment"
                  value={summary.monthlyAmount !== null ? toMoney(summary.monthlyAmount) : "Not listed"}
                  detail="Monthly payment amount currently saved on your buyer record."
                  tone="success"
                />
                <PortalInfoTile
                  label="Due Date"
                  value={summary.nextDueDate ? fmtDate(summary.nextDueDate) : "Not listed"}
                  detail="Next due date currently posted for the plan."
                />
                <PortalInfoTile
                  label="Plan Length"
                  value={summary.months !== null ? `${summary.months} months` : "Not listed"}
                  detail="Configured term for the current payment plan."
                />
                <PortalInfoTile
                  label="Plan Total"
                  value={summary.planTotal !== null ? toMoney(summary.planTotal) : "Not listed"}
                  detail={
                    summary.financeUplift > 0
                      ? `${toMoney(summary.financeUplift)} above principal based on the current financing terms.`
                      : "Payment-plan total based on the saved monthly amount and term."
                  }
                />
              </div>
            ) : (
              <PortalEmptyState
                title="No payment plan is active"
                description="If you are approved for financing, your APR, admin fee status, monthly payment, due date, and plan total will appear here automatically."
                action={
                  <a
                    href={financingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(47,88,227,0.22)]"
                  >
                    Open Financing Application
                  </a>
                }
              />
            )}
          </PortalPanel>

          <PortalPanel
            title="Account Highlights"
            subtitle="A quick read of the most important amounts tied to this account."
          >
            <div className="grid gap-4">
              <PortalInfoTile
                label="Deposit Paid"
                value={summary.depositAmount > 0 ? toMoney(summary.depositAmount) : "Not listed"}
                detail="Deposit already credited to the account."
              />
              <PortalInfoTile
                label="Transportation Fee"
                value={summary.transportationCost > 0 ? toMoney(summary.transportationCost) : "Not listed"}
                detail="Pickup, delivery, or transportation fee currently tied to your account."
                tone={summary.transportationCost > 0 ? "warning" : "neutral"}
              />
              <PortalInfoTile
                label="Last Posted Payment"
                value={summary.lastPostedPaymentDate ? fmtDate(summary.lastPostedPaymentDate) : "No payment posted"}
                detail="Newest payment date currently saved to your account."
              />
              <PortalInfoTile
                label="Account Status"
                value={paidInFull ? "Paid in Full" : summary.currentBalance > 0 ? "Balance Open" : "No balance posted"}
                detail={
                  paidInFull
                    ? "Your current ledger shows no remaining balance."
                    : "Additional fees or credits will appear in the itemized ledger as soon as they are recorded."
                }
                tone={paidInFull ? "success" : "neutral"}
              />
            </div>
          </PortalPanel>
        </div>
      </section>
    </div>
  );
}
