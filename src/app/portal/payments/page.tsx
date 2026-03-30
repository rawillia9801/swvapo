"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { fmtDate, fmtMoney, sb } from "@/lib/utils";
import {
  PortalEmptyState,
  PortalHeroPrimaryAction,
  PortalHeroSecondaryAction,
  PortalInfoTile,
  PortalMetricCard,
  PortalMetricGrid,
  PortalPageHero,
  PortalPanel,
} from "@/components/portal/luxury-shell";

type BuyerRow = {
  id: number;
  email: string | null;
  full_name?: string | null;
  name?: string | null;
  user_id?: string | null;
  sale_price?: number | null;
  deposit_amount?: number | null;
  deposit_date?: string | null;
  finance_enabled?: boolean | null;
  finance_admin_fee?: boolean | null;
  finance_rate?: number | null;
  finance_months?: number | null;
  finance_monthly_amount?: number | null;
  finance_day_of_month?: number | null;
  finance_next_due_date?: string | null;
  finance_last_payment_date?: string | null;
  delivery_option?: string | null;
  delivery_date?: string | null;
  delivery_location?: string | null;
  delivery_fee?: number | null;
};

type PuppyRow = {
  id: number;
  call_name: string | null;
  puppy_name: string | null;
  name: string | null;
  price: number | null;
  deposit: number | null;
  balance: number | null;
};

type BuyerPayment = {
  id: string;
  created_at: string;
  payment_date: string;
  amount: number;
  payment_type: string | null;
  method: string | null;
  note: string | null;
  status: string | null;
  reference_number: string | null;
};

const buyerSelect =
  "id,email,full_name,name,user_id,sale_price,deposit_amount,deposit_date,finance_enabled,finance_admin_fee,finance_rate,finance_months,finance_monthly_amount,finance_day_of_month,finance_next_due_date,finance_last_payment_date,delivery_option,delivery_date,delivery_location,delivery_fee";

async function findBuyerForUser(user: User): Promise<BuyerRow | null> {
  const email = String(user.email || "").trim().toLowerCase();

  if (user.id) {
    const byUserId = await sb
      .from("buyers")
      .select(buyerSelect)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!byUserId.error && byUserId.data) return byUserId.data as BuyerRow;
  }

  if (!email) return null;

  const byEmail = await sb
    .from("buyers")
    .select(buyerSelect)
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (!byEmail.error && byEmail.data) return byEmail.data as BuyerRow;
  return null;
}

async function findPuppyForBuyer(user: User, buyer: BuyerRow | null): Promise<PuppyRow | null> {
  if (buyer?.id) {
    const byBuyer = await sb
      .from("puppies")
      .select("id,call_name,puppy_name,name,price,deposit,balance")
      .eq("buyer_id", buyer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!byBuyer.error && byBuyer.data) return byBuyer.data as PuppyRow;
  }

  const email = String(user.email || "").trim().toLowerCase();
  if (!email) return null;

  const byOwnerEmail = await sb
    .from("puppies")
    .select("id,call_name,puppy_name,name,price,deposit,balance")
    .ilike("owner_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!byOwnerEmail.error && byOwnerEmail.data) return byOwnerEmail.data as PuppyRow;
  return null;
}

function paymentCountsTowardBalance(status: string | null | undefined) {
  const normalized = String(status || "").toLowerCase();
  if (!normalized) return true;
  return !["failed", "void", "canceled", "cancelled"].includes(normalized);
}

function puppyNameFromData(puppy: PuppyRow | null) {
  return puppy?.call_name || puppy?.puppy_name || puppy?.name || "Pending Match";
}

function formatPaymentLabel(payment: BuyerPayment) {
  return payment.payment_type || "Payment";
}

export default function PortalPaymentsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [buyer, setBuyer] = useState<BuyerRow | null>(null);
  const [puppy, setPuppy] = useState<PuppyRow | null>(null);
  const [payments, setPayments] = useState<BuyerPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState("");

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const {
          data: { session },
        } = await sb.auth.getSession();

        if (!mounted) return;
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          await loadPaymentData(currentUser);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void init();

    const { data: authListener } = sb.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      if (!mounted) return;

      setUser(currentUser);
      if (currentUser) {
        await loadPaymentData(currentUser);
      } else {
        setBuyer(null);
        setPuppy(null);
        setPayments([]);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function loadPaymentData(currentUser: User) {
    setStatusText("Loading payment history...");

    const matchedBuyer = await findBuyerForUser(currentUser);
    const matchedPuppy = await findPuppyForBuyer(currentUser, matchedBuyer);

    setBuyer(matchedBuyer);
    setPuppy(matchedPuppy);

    if (!matchedBuyer?.id) {
      setPayments([]);
      setStatusText("");
      return;
    }

    const paymentsRes = await sb
      .from("buyer_payments")
      .select("id,created_at,payment_date,amount,payment_type,method,note,status,reference_number")
      .eq("buyer_id", matchedBuyer.id)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false });

    setPayments((paymentsRes.data as BuyerPayment[]) || []);
    setStatusText("");
  }

  const totalPaid = useMemo(() => {
    return payments
      .filter((payment) => paymentCountsTowardBalance(payment.status))
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }, [payments]);

  const listedPrice = buyer?.sale_price ?? puppy?.price ?? null;
  const reservationPaid = buyer?.deposit_amount ?? puppy?.deposit ?? null;
  const latestPayment = payments[0] || null;
  const paymentCount = payments.length;
  const puppyName = puppyNameFromData(puppy);
  const financingUrl =
    "https://forms.zoho.com/southwestvirginiachihuahua/form/PuppyFinancingApplication";

  const completionPercent = useMemo(() => {
    if (listedPrice === null || listedPrice === undefined || Number(listedPrice) <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((totalPaid / Number(listedPrice)) * 100)));
  }, [listedPrice, totalPaid]);

  const remainingBalance = useMemo(() => {
    if (listedPrice !== null && listedPrice !== undefined) {
      return Math.max(0, Number(listedPrice || 0) - totalPaid);
    }
    if (puppy?.balance !== null && puppy?.balance !== undefined) {
      return Number(puppy.balance || 0);
    }
    return null;
  }, [listedPrice, puppy, totalPaid]);

  const scheduleLabel = buyer?.finance_enabled
    ? buyer?.finance_next_due_date
      ? `Next due ${fmtDate(buyer.finance_next_due_date)}`
      : "Financing active"
    : "No financing schedule";

  const afterHomeMessage = buyer?.finance_enabled
    ? "If your puppy is already home, your financing details and payment history will continue to stay organized here."
    : "This page stays available before and after go-home day so your investment and account records remain easy to review.";

  if (loading) {
    return (
      <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">
        Loading financials...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">
        Please sign in to view payments.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Payments"
        title="A clear financial view of your puppy journey."
        description="Track deposits, recorded payments, upcoming due dates, financing options, and delivery-related costs in one polished place before go-home day and afterward."
        actions={
          <>
            <PortalHeroPrimaryAction href="/portal/messages">Message Support</PortalHeroPrimaryAction>
            <PortalHeroSecondaryAction href="/portal/documents">Open Documents</PortalHeroSecondaryAction>
          </>
        }
        aside={
          <div className="rounded-[30px] border border-[#ead9c7] bg-white/90 p-5 shadow-[0_16px_36px_rgba(106,76,45,0.08)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#a47946]">
              Financial Snapshot
            </div>
            <div className="mt-3 text-3xl font-semibold text-[#2f2218]">
              {completionPercent}%
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-[#f3e5d2]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#d8b178_0%,#c98d49_52%,#a96a2c_100%)] transition-all"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <div className="mt-4 space-y-3">
              <PortalInfoTile
                label="Current Schedule"
                value={scheduleLabel}
                detail={afterHomeMessage}
              />
            </div>
          </div>
        }
      />

      {statusText ? <div className="text-sm font-semibold text-[#7b5f46]">{statusText}</div> : null}

      <PortalMetricGrid>
        <PortalMetricCard
          label="Total Price"
          value={listedPrice !== null ? fmtMoney(listedPrice) : "—"}
          detail="Your puppy purchase amount."
        />
        <PortalMetricCard
          label="Paid"
          value={fmtMoney(totalPaid)}
          detail="Payments recorded to your account so far."
          accent="from-[#e7d5b5] via-[#d5b27a] to-[#b07b34]"
        />
        <PortalMetricCard
          label="Remaining"
          value={remainingBalance !== null ? fmtMoney(remainingBalance) : "—"}
          detail="Your current balance after recorded payments."
          accent="from-[#f0dcc1] via-[#ddb68c] to-[#c98743]"
        />
        <PortalMetricCard
          label="Next Due"
          value={buyer?.finance_next_due_date ? fmtDate(buyer.finance_next_due_date) : "—"}
          detail={buyer?.finance_enabled ? "Based on your active financing plan." : "No active payment plan right now."}
          accent="from-[#efe6d8] via-[#dcc3a0] to-[#b69367]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
        <div className="space-y-6">
          <PortalPanel
            title="Payment History"
            subtitle="Every recorded payment tied to your account will appear here automatically so your financial timeline stays easy to follow."
          >
            <div className="space-y-4">
              {payments.length ? (
                payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-[24px] border border-[#ead9c7] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2e9_100%)] p-5 shadow-[0_12px_30px_rgba(106,76,45,0.05)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a47946]">
                          {formatPaymentLabel(payment)}
                        </div>
                        <div className="mt-2 text-lg font-semibold text-[#2f2218]">
                          {payment.payment_date ? fmtDate(payment.payment_date) : "Payment recorded"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-semibold text-[#2f2218]">
                          {fmtMoney(payment.amount || 0)}
                        </div>
                        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8e6b47]">
                          {payment.status || "Recorded"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <PaymentMeta label="Method" value={payment.method || "Not listed"} />
                      <PaymentMeta
                        label="Reference"
                        value={payment.reference_number || "Not listed"}
                      />
                      <PaymentMeta
                        label="Recorded"
                        value={payment.created_at ? fmtDate(payment.created_at) : "Not listed"}
                      />
                    </div>

                    {payment.note ? (
                      <div className="mt-4 rounded-[18px] border border-[#ead9c7] bg-white px-4 py-3 text-sm leading-6 text-[#73583f]">
                        {payment.note}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <PortalEmptyState
                  title="No payments recorded yet"
                  description="When deposits or payments are added to your account, they will appear here automatically."
                />
              )}
            </div>
          </PortalPanel>

          <PortalPanel
            title="Financing Options"
            subtitle="Families who want to finance their puppy can apply here. Once financing is approved, the details stay visible in the portal before and after go-home day."
          >
            {buyer?.finance_enabled ? (
              <div className="grid gap-4 md:grid-cols-2">
                <PortalInfoTile label="Financing Status" value="Active" detail="Your account is approved for financing." />
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
                    buyer.finance_monthly_amount
                      ? fmtMoney(buyer.finance_monthly_amount)
                      : "—"
                  }
                  detail="Your scheduled monthly payment."
                />
                <PortalInfoTile
                  label="Term Length"
                  value={buyer.finance_months ? `${buyer.finance_months} months` : "—"}
                  detail="Current financing term."
                />
                <PortalInfoTile
                  label="Next Due Date"
                  value={buyer.finance_next_due_date ? fmtDate(buyer.finance_next_due_date) : "—"}
                  detail="The next scheduled due date on your account."
                />
                <PortalInfoTile
                  label="Last Payment"
                  value={
                    buyer.finance_last_payment_date
                      ? fmtDate(buyer.finance_last_payment_date)
                      : "—"
                  }
                  detail="Most recent payment date on your financing schedule."
                />
                <PortalInfoTile
                  label="Admin Fee"
                  value={buyer.finance_admin_fee ? "Applied" : "Not applied"}
                  detail="Administrative fee status for this plan."
                />
                <PortalInfoTile
                  label="Draft Day"
                  value={buyer.finance_day_of_month ? `Day ${buyer.finance_day_of_month}` : "—"}
                  detail="The day of the month your payment schedule uses."
                />
              </div>
            ) : (
              <div className="overflow-hidden rounded-[26px] border border-[#ead9c7] bg-white shadow-[0_12px_30px_rgba(106,76,45,0.05)]">
                <div className="border-b border-[#ead9c7] px-5 py-4 text-sm leading-6 text-[#73583f]">
                  Financing is not active on this account yet. If you would like to be considered for puppy financing, complete the application below.
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
            subtitle="A quick overview of the financial details most families reference often."
          >
            <div className="space-y-4">
              <PortalInfoTile
                label="My Puppy"
                value={puppyName}
                detail="The puppy connected to this portal account."
              />
              <PortalInfoTile
                label="Reservation Paid"
                value={
                  reservationPaid !== null && reservationPaid !== undefined
                    ? fmtMoney(reservationPaid)
                    : "—"
                }
                detail="Deposit or reservation amount on file."
              />
              <PortalInfoTile
                label="Latest Payment"
                value={
                  latestPayment?.payment_date ? fmtDate(latestPayment.payment_date) : "No payments yet"
                }
                detail="Most recent payment received on your account."
              />
              <PortalInfoTile
                label="Payment Count"
                value={String(paymentCount)}
                detail="Number of recorded payments in your history."
              />
            </div>
          </PortalPanel>

          <PortalPanel
            title="Delivery & Financing"
            subtitle="These details stay visible so planning remains simple from reservation through go-home day and beyond."
          >
            <div className="space-y-4">
              <PortalInfoTile
                label="Financing"
                value={buyer?.finance_enabled ? "Enabled" : "Not enabled"}
                detail="Whether your account currently uses a financing plan."
              />
              <PortalInfoTile
                label="Monthly Amount"
                value={
                  buyer?.finance_monthly_amount ? fmtMoney(buyer.finance_monthly_amount) : "—"
                }
                detail="Monthly payment amount if financing is active."
              />
              <PortalInfoTile
                label="Delivery Plan"
                value={buyer?.delivery_option || buyer?.delivery_location || "Not scheduled"}
                detail="Any recorded delivery or pickup plan tied to this account."
              />
              <PortalInfoTile
                label="Delivery Fee"
                value={buyer?.delivery_fee ? fmtMoney(buyer.delivery_fee) : "—"}
                detail="Transportation or delivery fee on file, if any."
              />
            </div>
          </PortalPanel>

          <PortalPanel
            title="Need support?"
            subtitle="If anything looks off or you need clarification, message us and we can review your account history together."
          >
            <div className="flex flex-wrap gap-3">
              <PortalHeroPrimaryAction href="/portal/messages">Open Messages</PortalHeroPrimaryAction>
              <PortalHeroSecondaryAction href="/portal/transportation">
                Review Transporation
              </PortalHeroSecondaryAction>
            </div>
          </PortalPanel>
        </div>
      </section>
    </div>
  );
}

function PaymentMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#ead9c7] bg-white px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a47946]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[#2f2218]">{value}</div>
    </div>
  );
}
