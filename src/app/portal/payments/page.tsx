"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fmtDate, fmtMoney, sb } from "@/lib/utils";

type PaymentRow = {
  id: number;
  created_at: string;
  date: string | null;
  type: string | null;
  buyer: string | null;
  puppy: string | null;
  amount: number | null;
  puppy_id: number | null;
  client_id: string | null;
  currency: string;
  status: string;
  provider: string;
  stripe_payment_intent_id: string | null;
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

type BuyerRow = {
  id: number;
  email: string | null;
  buyer_email?: string | null;
  full_name?: string | null;
  name?: string | null;
  user_id?: string | null;
};

type SessionUser = {
  id: string;
  email?: string | null;
};

export default function PortalPaymentsPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [puppy, setPuppy] = useState<PuppyRow | null>(null);
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
        const currentUser = (session?.user as SessionUser | null) ?? null;
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
      const currentUser = (session?.user as SessionUser | null) ?? null;
      if (!mounted) return;

      setUser(currentUser);
      if (currentUser) {
        await loadPaymentData(currentUser);
      } else {
        setPayments([]);
        setPuppy(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function loadPaymentData(currUser: SessionUser) {
    const email = String(currUser.email || "").toLowerCase();
    const uid = currUser.id;

    setStatusText("Loading payment history...");

    const paymentsRes = await sb
      .from("payments")
      .select("*")
      .eq("client_id", uid)
      .order("created_at", { ascending: false });

    setPayments((paymentsRes.data as PaymentRow[]) || []);

    let matchedBuyer: BuyerRow | null = null;
    let matchedPuppy: PuppyRow | null = null;

    try {
      const buyerRes = await sb
        .from("buyers")
        .select("*")
        .or(`user_id.eq.${uid},email.ilike.%${email}%,buyer_email.ilike.%${email}%`)
        .limit(1)
        .maybeSingle();

      matchedBuyer = (buyerRes.data as BuyerRow | null) ?? null;
    } catch {
      matchedBuyer = null;
    }

    if (matchedBuyer?.id) {
      const puppyByBuyer = await sb
        .from("puppies")
        .select("id, call_name, puppy_name, name, price, deposit, balance, status")
        .eq("buyer_id", matchedBuyer.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      matchedPuppy = (puppyByBuyer.data as PuppyRow | null) ?? null;
    }

    if (!matchedPuppy) {
      const paymentPuppyId = paymentsRes.data?.find((payment: PaymentRow) => payment.puppy_id)?.puppy_id ?? null;

      if (paymentPuppyId) {
        const puppyByPayment = await sb
          .from("puppies")
          .select("id, call_name, puppy_name, name, price, deposit, balance, status")
          .eq("id", paymentPuppyId)
          .limit(1)
          .maybeSingle();

        matchedPuppy = (puppyByPayment.data as PuppyRow | null) ?? null;
      }
    }

    setPuppy(matchedPuppy);
    setStatusText("");
  }

  const totalPaid = useMemo(() => {
    return payments
      .filter((payment) => String(payment.status || "").toLowerCase() === "succeeded")
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }, [payments]);

  const latestPayment = useMemo(() => (payments.length ? payments[0] : null), [payments]);
  const totalCount = payments.length;

  const remainingBalance = useMemo(() => {
    if (puppy?.price !== null && puppy?.price !== undefined) {
      return Math.max(0, Number(puppy.price || 0) - totalPaid);
    }

    if (puppy?.balance !== null && puppy?.balance !== undefined) {
      return Number(puppy.balance || 0);
    }

    return null;
  }, [puppy, totalPaid]);

  if (loading) {
    return <div className="py-20 text-center text-sm font-semibold text-brand-500">Loading financials...</div>;
  }

  if (!user) {
    return <PaymentsLogin />;
  }

  return (
    <div className="space-y-8 pb-14">
      <section className="rounded-[2rem] border border-[#dccab7] bg-white p-7 shadow-[0_16px_40px_rgba(74,51,33,0.08)]">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-brand-500">Payments</div>
            <h1 className="mt-3 font-serif text-4xl font-bold leading-[0.95] text-brand-900 md:text-5xl">
              Financials
            </h1>
            <p className="mt-3 font-semibold text-brand-500">
              Review payment history, completed transactions, and remaining balance information.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-brand-700">
              Payments: {totalCount}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-brand-700">
              Paid: {fmtMoney(totalPaid)}
            </span>
          </div>
        </div>
      </section>

      {statusText ? <div className="text-sm font-semibold text-brand-500">{statusText}</div> : null}

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-8">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <InfoTile label="Total Paid" value={fmtMoney(totalPaid)} />
            <InfoTile
              label="Remaining Balance"
              value={remainingBalance !== null ? fmtMoney(remainingBalance) : "—"}
            />
            <InfoTile label="Payment Count" value={String(totalCount)} />
            <InfoTile
              label="Latest Payment"
              value={latestPayment?.created_at ? fmtDate(latestPayment.created_at) : "—"}
            />
          </div>

          <div className="card-luxury p-7">
            <div>
              <h3 className="font-serif text-2xl font-bold text-brand-900">Payment History</h3>
              <p className="mt-1 text-sm font-semibold text-brand-500">
                Completed and recorded transactions for your portal account.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              {payments.length ? (
                payments.map((payment) => (
                  <div key={payment.id} className="rounded-2xl border border-brand-200 bg-white/70 p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-black text-brand-900">{payment.type || "Payment"}</h4>
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                              String(payment.status || "").toLowerCase() === "succeeded"
                                ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                                : "border-amber-200 bg-amber-100 text-amber-700"
                            }`}
                          >
                            {payment.status || "recorded"}
                          </span>
                          <span className="inline-flex rounded-full border border-brand-200 bg-brand-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-brand-700">
                            {payment.provider || "provider"}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                          <Detail label="Paid" value={fmtMoney(payment.amount || 0)} emphasize />
                          <Detail
                            label="Payment Date"
                            value={
                              payment.created_at
                                ? fmtDate(payment.created_at)
                                : payment.date
                                  ? fmtDate(payment.date)
                                  : "—"
                            }
                          />
                          <Detail label="Buyer" value={payment.buyer || user.email || "—"} />
                          <Detail label="Puppy" value={payment.puppy || puppyNameFromData(puppy) || "—"} />
                        </div>

                        {payment.stripe_payment_intent_id ? (
                          <div className="mt-4 break-all text-[11px] font-black uppercase tracking-[0.18em] text-brand-400">
                            Stripe ID: {payment.stripe_payment_intent_id}
                          </div>
                        ) : null}
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">Amount</div>
                        <div className="mt-1 text-xl font-black text-brand-900">{fmtMoney(payment.amount || 0)}</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-16 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-200 bg-brand-50 text-2xl">
                    ðŸ’³
                  </div>
                  <h4 className="font-serif text-3xl font-bold text-brand-800">No Payments Recorded Yet</h4>
                  <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-relaxed text-brand-500">
                    Once payments are recorded to your account, they will appear here automatically.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <div className="card-luxury p-7">
            <h3 className="mb-4 font-serif text-2xl font-bold text-brand-900">Financial Overview</h3>
            <div className="space-y-4">
              <MiniInfo label="Puppy" value={puppyNameFromData(puppy) || "Pending"} />
              <MiniInfo label="Puppy Status" value={puppy?.status || "—"} />
              <MiniInfo
                label="Listed Price"
                value={puppy?.price !== null && puppy?.price !== undefined ? fmtMoney(puppy.price) : "—"}
              />
              <MiniInfo
                label="Deposit"
                value={puppy?.deposit !== null && puppy?.deposit !== undefined ? fmtMoney(puppy.deposit) : "—"}
              />
              <MiniInfo
                label="Remaining Balance"
                value={remainingBalance !== null ? fmtMoney(remainingBalance) : "—"}
              />
            </div>
          </div>

          <div className="card-luxury p-7">
            <h3 className="mb-4 font-serif text-2xl font-bold text-brand-900">Payment Notes</h3>
            <div className="space-y-3 text-sm font-semibold leading-relaxed text-brand-600">
              <p>Only recorded portal payments appear here.</p>
              <p>Payment totals are based on succeeded transactions.</p>
              <p>Admin payment updates flow here automatically after records are changed in Core.</p>
            </div>
          </div>

          <div className="rounded-3xl bg-brand-800 p-7 text-white shadow-luxury">
            <h4 className="font-serif text-2xl font-bold">Need Help?</h4>
            <p className="mt-2 text-sm font-semibold text-brand-200">
              If something looks incorrect or you need help understanding a payment entry, message support.
            </p>
            <Link
              href="/portal/messages"
              className="mt-5 inline-block rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] transition hover:bg-white/20"
            >
              Message Support
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function puppyNameFromData(puppy: PuppyRow | null) {
  return puppy?.call_name || puppy?.puppy_name || puppy?.name || "";
}

function Detail({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">{label}</div>
      <div className={`mt-1 ${emphasize ? "font-black text-brand-900" : "font-semibold text-brand-800"}`}>
        {value}
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-luxury p-5 text-center">
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-700">{label}</div>
      <div className="mt-2 break-words text-sm font-black text-brand-900">{value}</div>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-white/65 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-brand-800">{value}</div>
    </div>
  );
}

function PaymentsLogin() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const login = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await sb.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error) alert(error.message);
  };

  return (
    <div className="flex h-screen items-center justify-center bg-brand-50 p-6">
      <div className="card-luxury shine w-full max-w-md border border-white p-10">
        <h2 className="mb-8 text-center font-serif text-4xl font-bold">Welcome Home</h2>

        <form onSubmit={login} className="space-y-5">
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase text-brand-500">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-brand-200 p-3"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-black uppercase text-brand-500">Password</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="w-full rounded-xl border border-brand-200 p-3"
              required
            />
          </div>

          <button className="w-full rounded-xl bg-brand-800 p-4 text-xs font-black uppercase tracking-widest text-white shadow-lift">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
