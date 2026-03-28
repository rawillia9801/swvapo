"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { fmtDate, fmtMoney, sb } from "@/lib/utils";

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
  status: string | null;
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

async function findBuyerForUser(user: User): Promise<BuyerRow | null> {
  const email = String(user.email || "").trim().toLowerCase();

  if (user.id) {
    const byUserId = await sb
      .from("buyers")
      .select(
        "id,email,full_name,name,user_id,sale_price,deposit_amount,deposit_date,finance_enabled,finance_rate,finance_months,finance_monthly_amount,finance_day_of_month,finance_next_due_date,finance_last_payment_date,delivery_option,delivery_date,delivery_location,delivery_fee"
      )
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!byUserId.error && byUserId.data) return byUserId.data as BuyerRow;
  }

  if (!email) return null;

  const byEmail = await sb
    .from("buyers")
    .select(
      "id,email,full_name,name,user_id,sale_price,deposit_amount,deposit_date,finance_enabled,finance_rate,finance_months,finance_monthly_amount,finance_day_of_month,finance_next_due_date,finance_last_payment_date,delivery_option,delivery_date,delivery_location,delivery_fee"
    )
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
      .select("id,call_name,puppy_name,name,price,deposit,balance,status")
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
    .select("id,call_name,puppy_name,name,price,deposit,balance,status")
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

  const remainingBalance = useMemo(() => {
    if (listedPrice !== null && listedPrice !== undefined) {
      return Math.max(0, Number(listedPrice || 0) - totalPaid);
    }
    if (puppy?.balance !== null && puppy?.balance !== undefined) {
      return Number(puppy.balance || 0);
    }
    return null;
  }, [listedPrice, puppy, totalPaid]);

  if (loading) {
    return <div className="py-20 text-center text-sm font-semibold text-[#8b6b4d]">Loading financials...</div>;
  }

  if (!user) {
    return <div className="py-20 text-center text-sm font-semibold text-[#8b6b4d]">Please sign in to view payments.</div>;
  }

  return (
    <div className="space-y-8 pb-14">
      <section className="overflow-hidden rounded-[34px] border border-[#dccab7] bg-white shadow-[0_20px_50px_rgba(74,51,33,0.10)]">
        <div className="grid grid-cols-1 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="relative overflow-hidden bg-[linear-gradient(145deg,#302218_0%,#6f5037_45%,#ae7a49_100%)] px-7 py-8 text-white md:px-9 md:py-10">
            <div className="absolute -left-8 top-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-52 w-52 rounded-full bg-[#f1d3ab]/20 blur-3xl" />

            <div className="relative inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/82">
              Financials
            </div>

            <h1 className="relative mt-6 max-w-2xl font-serif text-4xl font-bold leading-[0.94] md:text-6xl">
              A clearer financial view for {puppyNameFromData(puppy)}.
            </h1>

            <p className="relative mt-4 max-w-2xl text-sm font-semibold leading-7 text-white/80 md:text-[15px]">
              Payments, balance details, and financing information are collected here so your portal experience feels straightforward and well organized.
            </p>

            <div className="relative mt-8 flex flex-wrap gap-3">
              <Link
                href="/portal/messages"
                className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#f0c98f_0%,#d9a666_100%)] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-[#24180f] shadow-[0_14px_28px_rgba(33,22,15,0.18)] transition hover:translate-y-[-1px]"
              >
                Ask About Payments
              </Link>
              <Link
                href="/portal/documents"
                className="inline-flex items-center rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white backdrop-blur-sm transition hover:bg-white/15"
              >
                Open Documents
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 bg-[linear-gradient(180deg,#fffdfa_0%,#faf4ed_100%)] p-7 md:grid-cols-2 md:p-8">
            <PremiumStat label="Listed Price" value={listedPrice !== null ? fmtMoney(listedPrice) : "—"} detail="Primary sale amount" />
            <PremiumStat label="Paid To Date" value={fmtMoney(totalPaid)} detail="Recorded payments on file" />
            <PremiumStat label="Remaining Balance" value={remainingBalance !== null ? fmtMoney(remainingBalance) : "—"} detail="Current estimated balance" />
            <PremiumStat label="Next Due" value={buyer?.finance_next_due_date ? fmtDate(buyer.finance_next_due_date) : "Not scheduled"} detail={buyer?.finance_enabled ? "Financing timeline" : "No financing plan active"} />
          </div>
        </div>
      </section>

      {statusText ? <div className="text-sm font-semibold text-[#8b6b4d]">{statusText}</div> : null}

      <section className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        <div className="space-y-8 xl:col-span-8">
          <div className="rounded-[30px] border border-[#dccab7] bg-white p-7 shadow-[0_16px_40px_rgba(74,51,33,0.08)]">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#9c7b58]">
              Payment History
            </div>
            <h2 className="mt-3 font-serif text-3xl font-bold text-[#3b271b]">
              Recorded account activity
            </h2>

            <div className="mt-6 space-y-4">
              {payments.length ? (
                payments.map((payment) => (
                  <div key={payment.id} className="rounded-[24px] border border-[#e5d7c8] bg-[#fcf9f5] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-lg font-black text-[#342116]">
                          {payment.payment_type || "Payment"}
                        </div>
                        <span className="rounded-full border border-[#dccab7] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#7f5f42]">
                          {payment.status || "recorded"}
                        </span>
                      </div>
                      <div className="text-sm font-black text-[#342116]">{fmtMoney(payment.amount || 0)}</div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <InfoLine label="Payment Date" value={payment.payment_date ? fmtDate(payment.payment_date) : "Not provided"} />
                      <InfoLine label="Method" value={payment.method || "Not provided"} />
                      <InfoLine label="Reference" value={payment.reference_number || "Not provided"} />
                      <InfoLine label="Recorded" value={payment.created_at ? fmtDate(payment.created_at) : "Not provided"} />
                    </div>

                    {payment.note ? (
                      <div className="mt-4 rounded-[18px] border border-[#e2d2c0] bg-white px-4 py-3 text-sm font-semibold text-[#6f5037]">
                        {payment.note}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[#e5d7c8] bg-[#fcf8f3] py-14 text-center text-sm font-semibold italic text-[#9e8164]">
                  No payment records have been added yet.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6 xl:col-span-4">
          <div className="rounded-[30px] border border-[#dccab7] bg-white p-7 shadow-[0_16px_40px_rgba(74,51,33,0.08)]">
            <h3 className="font-serif text-2xl font-bold text-[#3b271b]">Account Summary</h3>
            <div className="mt-5 space-y-3">
              <InfoTile label="Puppy" value={puppyNameFromData(puppy)} />
              <InfoTile label="Puppy Status" value={puppy?.status || "Pending"} />
              <InfoTile label="Reservation Paid" value={reservationPaid !== null && reservationPaid !== undefined ? fmtMoney(reservationPaid) : "—"} />
              <InfoTile label="Latest Payment" value={latestPayment?.payment_date ? fmtDate(latestPayment.payment_date) : "No payments yet"} />
            </div>
          </div>

          <div className="rounded-[30px] border border-[#dccab7] bg-white p-7 shadow-[0_16px_40px_rgba(74,51,33,0.08)]">
            <h3 className="font-serif text-2xl font-bold text-[#3b271b]">Financing & Delivery</h3>
            <div className="mt-5 space-y-3">
              <InfoTile label="Financing" value={buyer?.finance_enabled ? "Enabled" : "Not enabled"} />
              <InfoTile label="Monthly Amount" value={buyer?.finance_monthly_amount ? fmtMoney(buyer.finance_monthly_amount) : "—"} />
              <InfoTile label="Next Due Date" value={buyer?.finance_next_due_date ? fmtDate(buyer.finance_next_due_date) : "—"} />
              <InfoTile label="Delivery" value={buyer?.delivery_option || buyer?.delivery_location || "Not scheduled"} />
              <InfoTile label="Delivery Fee" value={buyer?.delivery_fee ? fmtMoney(buyer.delivery_fee) : "—"} />
            </div>
          </div>

          <div className="rounded-[30px] bg-[linear-gradient(145deg,#5f4330_0%,#7b5a3d_100%)] p-7 text-white shadow-[0_18px_44px_rgba(74,51,33,0.18)]">
            <h3 className="font-serif text-2xl font-bold">Need clarification?</h3>
            <p className="mt-3 text-sm font-semibold leading-7 text-white/82">
              If something looks off, message support and we can review your account history together.
            </p>
            <Link
              href="/portal/messages"
              className="mt-5 inline-flex items-center rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-white/15"
            >
              Message Support
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function PremiumStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[26px] border border-[#e2d4c6] bg-white p-5 shadow-[0_14px_30px_rgba(74,51,33,0.06)]">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">{label}</div>
      <div className="mt-3 font-serif text-3xl font-bold text-[#342116]">{value}</div>
      <div className="mt-2 text-sm font-semibold leading-6 text-[#8b6b4d]">{detail}</div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[#6f5037]">{value}</div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[#e5d7c8] bg-[#fcf9f5] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[#342116]">{value}</div>
    </div>
  );
}
