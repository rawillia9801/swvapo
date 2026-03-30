"use client";

import React, { useEffect, useState } from "react";
import { Receipt, ShieldCheck, Wallet } from "lucide-react";
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
  PortalHeroPrimaryAction,
  PortalHeroSecondaryAction,
  PortalInfoTile,
  PortalLoadingState,
  PortalMetricCard,
  PortalMetricGrid,
  PortalPageHero,
  PortalPanel,
  PortalStatusBadge,
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
  const normalized = String(status || "").toLowerCase();
  if (!normalized || normalized === "recorded" || normalized === "paid") return "success" as const;
  if (["failed", "void", "cancelled", "canceled"].includes(normalized)) return "danger" as const;
  return "warning" as const;
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
          "We could not load your payment history right now. Please refresh or try again in a moment."
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

  if (sessionLoading || loading) {
    return <PortalLoadingState label="Loading payments..." />;
  }

  if (!user) {
    return (
      <PortalPageHero
        eyebrow="Payments"
        title="Sign in to view your payment history."
        description="Your recorded payments, financing details, and account balance stay here once you are signed in."
        actions={<PortalHeroPrimaryAction href="/portal">Open Portal Access</PortalHeroPrimaryAction>}
      />
    );
  }

  if (errorText) {
    return <PortalErrorState title="Payments are unavailable" description={errorText} />;
  }

  const { buyer, puppy, payments } = data;
  const puppyName = portalPuppyName(puppy);
  const price = buyer?.sale_price ?? puppy?.price ?? null;
  const paid = payments
    .filter((payment) => paymentCountsTowardBalance(payment.status))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const remaining =
    price !== null && price !== undefined
      ? Math.max(0, Number(price) - paid)
      : puppy?.balance ?? null;
  const percentPaid =
    price && Number(price) > 0 ? Math.max(0, Math.min(100, Math.round((paid / Number(price)) * 100))) : 0;
  const nextDueLabel = buyer?.finance_next_due_date ? fmtDate(buyer.finance_next_due_date) : "—";
  const paymentCount = payments.length;
  const latestPayment = payments[0] || null;

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Payments"
        title="A calm financial record for your puppy journey."
        description="Keep deposits, recorded payments, remaining balance, financing, and transportation-related costs in one clear place before homecoming and after your puppy is home."
        actions={
          <>
            <PortalHeroPrimaryAction href="/portal/messages">Message Support</PortalHeroPrimaryAction>
            <PortalHeroSecondaryAction href="/portal/documents">Open Documents</PortalHeroSecondaryAction>
          </>
        }
        aside={
          <div className="rounded-[30px] border border-[#eadccf] bg-white/90 p-5 shadow-[0_16px_36px_rgba(106,76,45,0.08)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#a47946]">
              Payment Progress
            </div>
            <div className="mt-3 text-3xl font-semibold text-[#2f2218]">{percentPaid}%</div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#f3e5d2]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#d8b178_0%,#c98d49_52%,#a96a2c_100%)] transition-all"
                style={{ width: `${percentPaid}%` }}
              />
            </div>
            <div className="mt-4 text-sm leading-6 text-[#72553c]">
              {buyer?.finance_enabled
                ? "Your account has financing enabled and the active schedule is summarized below."
                : "If you choose financing, those plan details will appear here once approved."}
            </div>
          </div>
        }
      />

      <PortalMetricGrid>
        <PortalMetricCard
          label="Total Price"
          value={price !== null && price !== undefined ? fmtMoney(price) : "—"}
          detail="Purchase amount currently listed on your account."
        />
        <PortalMetricCard
          label="Paid"
          value={fmtMoney(paid)}
          detail={`${paymentCount} recorded payment${paymentCount === 1 ? "" : "s"} on file.`}
          accent="from-[#e7d5b5] via-[#d5b27a] to-[#b07b34]"
        />
        <PortalMetricCard
          label="Remaining"
          value={remaining !== null && remaining !== undefined ? fmtMoney(remaining) : "—"}
          detail="Current balance after recorded payments."
          accent="from-[#f0dcc1] via-[#ddb68c] to-[#c98743]"
        />
        <PortalMetricCard
          label="Next Due"
          value={nextDueLabel}
          detail={buyer?.finance_enabled ? "Based on your active financing plan." : "No financing due date on file."}
          accent="from-[#ece4d6] via-[#d7c2a5] to-[#b5936c]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
        <div className="space-y-6">
          <PortalPanel
            title="Payment History"
            subtitle="Every recorded payment tied to your account appears here in date order so the financial timeline stays easy to review."
          >
            {payments.length ? (
              <div className="space-y-4">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-[24px] border border-[#ead9c7] bg-white p-5 shadow-[0_10px_24px_rgba(96,67,38,0.05)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <PortalStatusBadge
                            label={payment.payment_type || "Payment"}
                            tone="neutral"
                          />
                          <PortalStatusBadge
                            label={payment.status || "recorded"}
                            tone={paymentStatusTone(payment.status)}
                          />
                        </div>
                        <div className="mt-3 text-lg font-semibold text-[#2f2218]">
                          {payment.payment_date ? fmtDate(payment.payment_date) : "Payment recorded"}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-[#72553c]">
                          {payment.note || "This payment was recorded on your account."}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-semibold text-[#2f2218]">
                          {fmtMoney(payment.amount || 0)}
                        </div>
                        <div className="mt-1 text-sm text-[#8d6f52]">
                          {payment.method || "Method not listed"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <MetaPill label="Reference" value={payment.reference_number || "—"} />
                      <MetaPill
                        label="Recorded"
                        value={payment.created_at ? fmtDate(payment.created_at) : "—"}
                      />
                      <MetaPill label="Puppy" value={puppyName} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <PortalEmptyState
                title="No payments recorded yet"
                description="When deposits or additional payments are added to your account, they will appear here automatically."
              />
            )}
          </PortalPanel>

          <PortalPanel
            title="Financing"
            subtitle="This section stays useful both for applying and for reviewing the live details of an approved plan."
          >
            {buyer?.finance_enabled ? (
              <div className="grid gap-4 md:grid-cols-2">
                <PortalInfoTile
                  label="Financing Status"
                  value="Active"
                  detail="This account currently has financing enabled."
                  tone="success"
                />
                <PortalInfoTile
                  label="APR"
                  value={
                    buyer.finance_rate !== null && buyer.finance_rate !== undefined
                      ? `${buyer.finance_rate}%`
                      : "—"
                  }
                  detail="Annual percentage rate on file."
                />
                <PortalInfoTile
                  label="Monthly Amount"
                  value={
                    buyer.finance_monthly_amount !== null &&
                    buyer.finance_monthly_amount !== undefined
                      ? fmtMoney(buyer.finance_monthly_amount)
                      : "—"
                  }
                  detail="Scheduled monthly payment."
                />
                <PortalInfoTile
                  label="Term Length"
                  value={buyer.finance_months ? `${buyer.finance_months} months` : "—"}
                  detail="Current plan length."
                />
                <PortalInfoTile
                  label="Next Due Date"
                  value={buyer.finance_next_due_date ? fmtDate(buyer.finance_next_due_date) : "—"}
                  detail="Next scheduled due date."
                />
                <PortalInfoTile
                  label="Admin Fee"
                  value={buyer.finance_admin_fee ? "Applied" : "Not applied"}
                  detail="Administrative fee status on this plan."
                />
              </div>
            ) : (
              <div className="overflow-hidden rounded-[26px] border border-[#ead9c7] bg-white shadow-[0_12px_30px_rgba(106,76,45,0.05)]">
                <div className="border-b border-[#ead9c7] px-5 py-4 text-sm leading-6 text-[#72553c]">
                  Financing is not active on this account yet. If you would like to apply, the financing application is embedded below so the next step is straightforward.
                </div>
                <iframe
                  src={financingUrl}
                  title="Puppy Financing Application"
                  className="h-[820px] w-full border-0 bg-white"
                />
              </div>
            )}
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel
            title="Account Summary"
            subtitle="A concise financial summary without repeating the same balance information in multiple oversized sections."
          >
            <div className="space-y-4">
              <PortalInfoTile
                label="My Puppy"
                value={puppyName}
                detail="The puppy currently linked to this portal account."
              />
              <PortalInfoTile
                label="Reservation Paid"
                value={
                  buyer?.deposit_amount !== null && buyer?.deposit_amount !== undefined
                    ? fmtMoney(buyer.deposit_amount)
                    : puppy?.deposit !== null && puppy?.deposit !== undefined
                      ? fmtMoney(puppy.deposit)
                      : "—"
                }
                detail="Deposit or reservation amount currently on file."
              />
              <PortalInfoTile
                label="Latest Payment"
                value={latestPayment?.payment_date ? fmtDate(latestPayment.payment_date) : "No payments yet"}
                detail="Most recent payment date on your account."
              />
              <PortalInfoTile
                label="Delivery Plan"
                value={buyer?.delivery_option || buyer?.delivery_location || "Not scheduled"}
                detail="Transportation or pickup planning connected to your account."
              />
            </div>
          </PortalPanel>

          <PortalPanel
            title="Helpful Actions"
            subtitle="Use these shortcuts if you need account help, transportation planning, or a cleaner record trail."
          >
            <div className="space-y-3">
              <ActionRow
                icon={<Receipt className="h-4 w-4" />}
                title="Review documents"
                detail="Open your forms, signatures, and shared records."
                href="/portal/documents"
              />
              <ActionRow
                icon={<Wallet className="h-4 w-4" />}
                title="Review transportation"
                detail="See pickup, delivery, and transportation planning."
                href="/portal/transportation"
              />
              <ActionRow
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Message support"
                detail="Ask questions if anything looks unclear on your account."
                href="/portal/messages"
              />
            </div>
          </PortalPanel>
        </div>
      </section>
    </div>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#ead9c7] bg-[#fffaf4] px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#a17848]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[#2f2218]">{value}</div>
    </div>
  );
}

function ActionRow({
  icon,
  title,
  detail,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex items-start gap-3 rounded-[22px] border border-[#eadccf] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(96,67,38,0.05)] transition hover:-translate-y-0.5 hover:border-[#d7b58e]"
    >
      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-[#f8efe5] text-[#a17848]">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-[#2f2218]">{title}</div>
        <div className="mt-1 text-sm leading-6 text-[#72553c]">{detail}</div>
      </div>
    </a>
  );
}
