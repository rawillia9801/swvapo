"use client";

import React, { useEffect, useMemo, useState } from "react";
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
        <PortalStatusBadge
          label={displayText(payment.status, "Recorded")}
          tone={paymentStatusTone(payment.status)}
        />
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
  const paidInFull =
    summary.remaining !== null && summary.remaining !== undefined && summary.remaining <= 0;

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Payments"
        title="Track your payment record with clarity."
        description="Review the recorded balance, posted payments, financing details, and the next financial step tied to your puppy account."
        aside={
          <div className="rounded-[30px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(243,248,253,0.95)_100%)] p-5 shadow-[0_18px_40px_rgba(23,35,56,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--portal-text-muted)]">
                  Account Progress
                </div>
                <div className="mt-2 text-[2.3rem] font-semibold tracking-[-0.05em] text-[var(--portal-text)]">
                  {summary.percentPaid}%
                </div>
              </div>
              <PortalStatusBadge
                label={paidInFull ? "Paid in Full" : buyer?.finance_enabled ? "Financing Active" : "Payment Record"}
                tone={paidInFull ? "success" : "neutral"}
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
          detail="Purchase amount currently tied to this account."
        />
        <PortalMetricCard
          label="Paid to Date"
          value={fmtMoney(summary.paidToDate)}
          detail={`${payments.length} recorded payment${payments.length === 1 ? "" : "s"} on file.`}
          accent="from-[rgba(93,121,255,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
        <PortalMetricCard
          label="Remaining"
          value={
            summary.remaining !== null && summary.remaining !== undefined
              ? fmtMoney(summary.remaining)
              : "Not listed"
          }
          detail="Current balance after recorded payments."
          accent="from-[rgba(110,166,218,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
        <PortalMetricCard
          label="Next Due"
          value={nextDueDate}
          detail={buyer?.finance_enabled ? "Based on the active financing schedule." : "No financing due date on file."}
          accent="from-[rgba(113,198,164,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.18fr)_380px]">
        <div className="space-y-6">
          <PortalPanel
            title="Account Summary"
            subtitle="The most important financial details come first so the page stays calm, readable, and trustworthy."
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
                label="Financing"
                value={buyer?.finance_enabled ? "Active plan" : "No plan active"}
                detail={buyer?.finance_enabled ? "Financing details are posted below." : "A financing application can be started if needed."}
                tone={buyer?.finance_enabled ? "warning" : "neutral"}
              />
              <PortalInfoTile
                label="Balance State"
                value={paidInFull ? "Paid in Full" : summary.remaining ? "Balance Open" : "No balance posted"}
                detail={paidInFull ? "No remaining amount is currently due." : "The current balance is based on the posted payment record."}
                tone={paidInFull ? "success" : "neutral"}
              />
            </div>
          </PortalPanel>

          <PortalPanel
            title="Payment History"
            subtitle="Every recorded payment appears here in one ledger view."
          >
            {payments.length ? (
              <PortalTable headers={["Date", "Type", "Method", "Amount", "Status"]}>
                {payments.map((payment) => (
                  <PaymentRow key={payment.id} payment={payment} puppyName={puppyName} />
                ))}
              </PortalTable>
            ) : (
              <PortalEmptyState
                title="No recorded payments yet"
                description="When a payment is logged to your buyer account, it will appear here automatically."
              />
            )}
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel
            title="Financing"
            subtitle="A cleaner view of financing details and the next action if a plan is needed."
          >
            {buyer?.finance_enabled ? (
              <div className="space-y-4">
                <PortalInfoTile
                  label="Monthly Amount"
                  value={buyer.finance_monthly_amount ? fmtMoney(buyer.finance_monthly_amount) : "Not listed"}
                  detail="Monthly amount stored on the buyer record."
                  tone="success"
                />
                <PortalInfoTile
                  label="APR"
                  value={buyer.finance_rate !== null && buyer.finance_rate !== undefined ? `${buyer.finance_rate}%` : "Not listed"}
                  detail="Rate currently saved for this plan."
                />
                <PortalInfoTile
                  label="Plan Length"
                  value={buyer.finance_months ? `${buyer.finance_months} months` : "Not listed"}
                  detail="Configured duration of the payment plan."
                />
                <PortalInfoTile
                  label="Admin Fee"
                  value={buyer.finance_admin_fee ? "Included" : "Not listed"}
                  detail="Whether the financing plan includes an admin fee flag."
                />
              </div>
            ) : (
              <PortalEmptyState
                title="No financing plan is active"
                description="If financing is needed, you can start with the financing application and your approved plan details will appear here."
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
            title="Payment Status"
            subtitle="This column keeps the account state easy to scan."
          >
            <div className="space-y-4">
              <PortalInfoTile
                label="Balance State"
                value={paidInFull ? "Paid in Full" : summary.remaining ? "Balance Open" : "No balance posted"}
                detail={paidInFull ? "No remaining amount is currently due." : "Open the full history if you want to review the account ledger."}
                tone={paidInFull ? "success" : "neutral"}
              />
              <PortalInfoTile
                label="Next Due"
                value={nextDueDate}
                detail={buyer?.finance_enabled ? "Pulled from the buyer financing record." : "No financing due date saved."}
                tone={buyer?.finance_enabled ? "warning" : "neutral"}
              />
              <PortalInfoTile
                label="Last Posted"
                value={buyer?.finance_last_payment_date ? fmtDate(buyer.finance_last_payment_date) : latestPayment?.payment_date ? fmtDate(latestPayment.payment_date) : "No payment posted"}
                detail="The newest payment date currently on file."
              />
            </div>
          </PortalPanel>

        </div>
      </section>
    </div>
  );
}
