"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, CalendarClock, ShieldCheck } from "lucide-react";
import { fmtDate, fmtMoney } from "@/lib/utils";
import {
  findBuyerPayments,
  loadPortalContext,
  paymentCountsTowardBalance,
  portalPuppyName,
  type PortalBuyer,
  type PortalPayment,
  type PortalPuppy,
} from "@/lib/portal-data";
import { usePortalSession } from "@/hooks/use-portal-session";
import {
  PortalActionLink,
  PortalEmptyState,
  PortalErrorState,
  PortalHeroPrimaryAction,
  PortalHeroSecondaryAction,
  PortalInfoTile,
  PortalLoadingState,
  PortalMetricCard,
  PortalMetricGrid,
  PortalPageHero,
  PortalPanel,
  PortalStatusBadge,
  PortalTable,
} from "@/components/portal/luxury-shell";

const financingUrl =
  "https://forms.zoho.com/southwestvirginiachihuahua/form/PuppyFinancingApplication";

type PaymentPageState = {
  buyer: PortalBuyer | null;
  puppy: PortalPuppy | null;
  payments: PortalPayment[];
};

function emptyState(): PaymentPageState {
  return {
    buyer: null,
    puppy: null,
    payments: [],
  };
}

function paymentStatusTone(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized || ["recorded", "paid", "posted"].includes(normalized)) return "success" as const;
  if (["failed", "void", "cancelled", "canceled"].includes(normalized)) return "danger" as const;
  return "warning" as const;
}

function displayText(value: string | null | undefined, fallback = "Not listed") {
  const text = String(value || "").trim();
  return text || fallback;
}

function PaymentRow({
  payment,
  puppyName,
}: {
  payment: PortalPayment;
  puppyName: string;
}) {
  return (
    <tr className="border-t border-[var(--portal-border)]">
      <td className="px-5 py-4 text-sm font-medium text-[var(--portal-text)]">
        {payment.payment_date ? fmtDate(payment.payment_date) : "Not listed"}
      </td>
      <td className="px-5 py-4 text-sm text-[var(--portal-text-soft)]">
        <div>{displayText(payment.payment_type, "Payment")}</div>
        <div className="mt-1 text-xs text-[var(--portal-text-muted)]">{puppyName}</div>
      </td>
      <td className="px-5 py-4 text-sm text-[var(--portal-text-soft)]">
        <div>{displayText(payment.method, "Not listed")}</div>
        <div className="mt-1 text-xs text-[var(--portal-text-muted)]">
          {displayText(payment.reference_number, "No reference")}
        </div>
      </td>
      <td className="px-5 py-4 text-sm font-semibold text-[var(--portal-text)]">
        {fmtMoney(payment.amount || 0)}
      </td>
      <td className="px-5 py-4 text-sm">
        <PortalStatusBadge label={displayText(payment.status, "Recorded")} tone={paymentStatusTone(payment.status)} />
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
        const payments = await findBuyerPayments(context.buyer?.id);

        if (!active) return;
        setData({
          buyer: context.buyer,
          puppy: context.puppy,
          payments,
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

  const summary = useMemo(() => {
    const { buyer, puppy, payments } = data;
    const totalPrice = buyer?.sale_price ?? puppy?.price ?? null;
    const paidToDate = payments
      .filter((payment) => paymentCountsTowardBalance(payment.status))
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const remaining =
      totalPrice !== null && totalPrice !== undefined
        ? Math.max(0, Number(totalPrice) - paidToDate)
        : puppy?.balance ?? null;
    const percentPaid =
      totalPrice && Number(totalPrice) > 0
        ? Math.max(0, Math.min(100, Math.round((paidToDate / Number(totalPrice)) * 100)))
        : 0;

    return {
      totalPrice,
      paidToDate,
      remaining,
      percentPaid,
    };
  }, [data]);

  if (sessionLoading || loading) {
    return <PortalLoadingState label="Loading payments..." />;
  }

  if (!user) {
    return (
      <PortalPageHero
        eyebrow="Payments"
        title="Sign in to review your payment record."
        description="Recorded payments, financing details, due dates, and balance information appear here once you are signed in."
        actions={<PortalHeroPrimaryAction href="/portal">Open My Puppy Portal</PortalHeroPrimaryAction>}
      />
    );
  }

  if (errorText) {
    return <PortalErrorState title="Payments are unavailable" description={errorText} />;
  }

  const { buyer, puppy, payments } = data;
  const puppyName = portalPuppyName(puppy);
  const latestPayment = payments[0] || null;
  const depositAmount = buyer?.deposit_amount ?? puppy?.deposit ?? null;
  const nextDueDate = buyer?.finance_next_due_date ? fmtDate(buyer.finance_next_due_date) : "No due date";
  const deliverySummary = [buyer?.delivery_option, buyer?.delivery_location]
    .filter(Boolean)
    .join(" - ");

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Payments"
        title="Track your payment record with clarity."
        description="Review recorded payments, current balance, financing details, and the financial steps still ahead for your puppy journey."
        actions={
          <>
            <PortalHeroPrimaryAction href="/portal/messages">Message Support</PortalHeroPrimaryAction>
            <PortalHeroSecondaryAction href="/portal/documents">Open Documents</PortalHeroSecondaryAction>
          </>
        }
        aside={
          <div className="rounded-[28px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,var(--portal-surface-strong)_0%,var(--portal-surface-muted)_100%)] p-5 shadow-[0_18px_40px_rgba(31,48,79,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--portal-text-muted)]">
                  Account Progress
                </div>
                <div className="mt-2 text-[2.25rem] font-semibold tracking-[-0.04em] text-[var(--portal-text)]">
                  {summary.percentPaid}%
                </div>
              </div>
              <PortalStatusBadge
                label={
                  summary.remaining !== null && summary.remaining !== undefined && summary.remaining <= 0
                    ? "Paid in Full"
                    : buyer?.finance_enabled
                      ? "Financing Active"
                      : "Payment Record"
                }
                tone={
                  summary.remaining !== null && summary.remaining !== undefined && summary.remaining <= 0
                    ? "success"
                    : "neutral"
                }
              />
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--portal-surface-muted)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] transition-all"
                style={{ width: `${summary.percentPaid}%` }}
              />
            </div>
            <div className="mt-4 text-sm leading-6 text-[var(--portal-text-soft)]">
              {summary.totalPrice !== null && summary.totalPrice !== undefined
                ? `${fmtMoney(summary.paidToDate)} recorded toward ${fmtMoney(summary.totalPrice)}.`
                : "Open Payments to review your recorded history and financing details."}
            </div>
          </div>
        }
      />

      <PortalMetricGrid>
        <PortalMetricCard
          label="Total Price"
          value={
            summary.totalPrice !== null && summary.totalPrice !== undefined
              ? fmtMoney(summary.totalPrice)
              : "Not listed"
          }
          detail="Purchase amount currently tied to your account."
        />
        <PortalMetricCard
          label="Paid to Date"
          value={fmtMoney(summary.paidToDate)}
          detail={`${payments.length} recorded payment${payments.length === 1 ? "" : "s"} on file.`}
          accent="from-[#dfe6fb] via-[#b8c7f7] to-[#7388d9]"
        />
        <PortalMetricCard
          label="Remaining"
          value={
            summary.remaining !== null && summary.remaining !== undefined
              ? fmtMoney(summary.remaining)
              : "Not listed"
          }
          detail="Current balance after recorded payments."
          accent="from-[#d9eef4] via-[#acd4e2] to-[#6da8bd]"
        />
        <PortalMetricCard
          label="Next Due"
          value={nextDueDate}
          detail={buyer?.finance_enabled ? "Based on the active financing schedule." : "No financing due date on file."}
          accent="from-[#e7ebf2] via-[#cfd8e6] to-[#8ea0b9]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.18fr)_380px]">
        <div className="space-y-6">
          <PortalPanel
            title="Account Summary"
            subtitle="The most important financial details are surfaced first so the page stays readable, calm, and trustworthy."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <PortalInfoTile
                label="Deposit"
                value={depositAmount !== null && depositAmount !== undefined ? fmtMoney(depositAmount) : "Not listed"}
                detail="Reservation or deposit amount on file."
              />
              <PortalInfoTile
                label="Latest Payment"
                value={latestPayment?.payment_date ? fmtDate(latestPayment.payment_date) : "No payment yet"}
                detail={latestPayment ? displayText(latestPayment.method, "Method not listed") : "The first payment will appear here when posted."}
                tone={latestPayment ? "success" : "neutral"}
              />
              <PortalInfoTile
                label="My Puppy"
                value={puppyName}
                detail="The puppy currently linked to this account."
              />
              <PortalInfoTile
                label="Transportation"
                value={deliverySummary || "Not scheduled"}
                detail="Pickup, delivery, or travel details recorded on the buyer account."
              />
            </div>
          </PortalPanel>

          <PortalPanel
            title="Payment History"
            subtitle="Every payment recorded on your buyer account appears here in one clean ledger."
          >
            {payments.length ? (
              <PortalTable headers={["Date", "Type", "Method", "Amount", "Status"]}>
                {payments.map((payment) => (
                  <PaymentRow key={payment.id} payment={payment} puppyName={puppyName} />
                ))}
              </PortalTable>
            ) : (
              <PortalEmptyState
                title="No payments recorded yet"
                description="When deposits or additional payments are added to your account, the full payment history will appear here automatically."
              />
            )}
          </PortalPanel>

          <PortalPanel
            title="Financing"
            subtitle="Apply here if financing is not active yet, or review the live plan details once financing has been approved."
          >
            {buyer?.finance_enabled ? (
              <div className="grid gap-4 md:grid-cols-2">
                <PortalInfoTile
                  label="Status"
                  value="Active"
                  detail="Financing is enabled for this account."
                  tone="success"
                />
                <PortalInfoTile
                  label="APR"
                  value={
                    buyer.finance_rate !== null && buyer.finance_rate !== undefined
                      ? `${buyer.finance_rate}%`
                      : "Not listed"
                  }
                  detail="Annual percentage rate currently on file."
                />
                <PortalInfoTile
                  label="Monthly Amount"
                  value={
                    buyer.finance_monthly_amount !== null && buyer.finance_monthly_amount !== undefined
                      ? fmtMoney(buyer.finance_monthly_amount)
                      : "Not listed"
                  }
                  detail="Scheduled monthly amount."
                />
                <PortalInfoTile
                  label="Term"
                  value={buyer.finance_months ? `${buyer.finance_months} months` : "Not listed"}
                  detail="Current financing duration."
                />
                <PortalInfoTile
                  label="Payment Day"
                  value={buyer.finance_day_of_month ? `Day ${buyer.finance_day_of_month}` : "Not listed"}
                  detail="Day of month currently assigned to the plan."
                />
                <PortalInfoTile
                  label="Admin Fee"
                  value={buyer.finance_admin_fee ? "Applied" : "Not applied"}
                  detail="Administrative fee status for the plan."
                />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-5 py-5 text-sm leading-7 text-[var(--portal-text-soft)]">
                  Financing is not active on this account yet. If you would like to apply, you can use the embedded financing application below. Once approved, financing details will appear directly on this page.
                </div>
                <div className="overflow-hidden rounded-[28px] border border-[var(--portal-border)] bg-[var(--portal-surface-strong)] shadow-[0_16px_38px_rgba(31,48,79,0.06)]">
                  <iframe
                    src={financingUrl}
                    title="Puppy Financing Application"
                    className="h-[860px] w-full border-0 bg-white"
                  />
                </div>
              </div>
            )}
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel
            title="What this page is for"
            subtitle="This page should reduce uncertainty, not bury account details under a cluttered finance screen."
          >
            <div className="space-y-4">
              <SupportRow
                icon={<BadgeDollarSign className="h-4 w-4" />}
                title="Clear account totals"
                detail="Use this page to quickly see what has been recorded, what remains, and whether financing is active."
              />
              <SupportRow
                icon={<CalendarClock className="h-4 w-4" />}
                title="Due-date visibility"
                detail="If financing is enabled, the next due date stays visible without needing to ask for it."
              />
              <SupportRow
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Clean record trail"
                detail="The payment history is here so your account remains easy to confirm later."
              />
            </div>
          </PortalPanel>

          <PortalPanel
            title="Quick Links"
            subtitle="Open the parts of the portal most likely to matter next."
          >
            <div className="grid gap-4">
              <PortalActionLink
                href="/portal/documents"
                eyebrow="Documents"
                title="Review agreements and records"
                detail="Open the forms, signatures, and supporting documents tied to your account."
              />
              <PortalActionLink
                href="/portal/transportation"
                eyebrow="Transportation"
                title="Review travel planning"
                detail="See pickup, delivery, or transportation details that relate to your account."
              />
              <PortalActionLink
                href="/portal/messages"
                eyebrow="Messages"
                title="Ask a payment question"
                detail="Use Messages if you want clarification on a posted payment, balance, or schedule."
              />
            </div>
          </PortalPanel>
        </div>
      </section>
    </div>
  );
}

function SupportRow({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[22px] border border-[var(--portal-border)] bg-white px-4 py-4 shadow-[0_10px_22px_rgba(31,48,79,0.05)]">
      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--portal-surface-muted)] text-[var(--portal-accent-strong)]">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-[var(--portal-text)]">{title}</div>
        <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
      </div>
    </div>
  );
}
