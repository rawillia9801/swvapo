"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { sb, fmtMoney, fmtDate } from "@/lib/utils";

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
  paid_at?: string | null;
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

export default function PortalPaymentsPage() {
  const [user, setUser] = useState<any>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [puppy, setPuppy] = useState<PuppyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
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

    init();

    const { data: authListener } = sb.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;
        if (!mounted) return;

        setUser(currentUser);

        if (currentUser) {
          await loadPaymentData(currentUser);
        } else {
          setPayments([]);
          setPuppy(null);
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function loadPaymentData(currUser: any) {
    const email = String(currUser?.email || "").toLowerCase();
    const uid = currUser?.id;

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
      const paymentPuppyId =
        paymentsRes.data?.find((p: PaymentRow) => p.puppy_id)?.puppy_id ?? null;

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

  async function handleRefresh() {
    if (!user) return;
    await loadPaymentData(user);
  }

  async function handleSignOut() {
    await sb.auth.signOut();
    setUser(null);
    setPayments([]);
    setPuppy(null);
  }

  const puppyName =
    puppy?.call_name || puppy?.puppy_name || puppy?.name || "Your Puppy";

  const succeededPayments = useMemo(
    () => payments.filter((p) => String(p.status || "").toLowerCase() === "succeeded"),
    [payments]
  );

  const totalPaid = useMemo(() => {
    return succeededPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [succeededPayments]);

  const latestPayment = useMemo(() => {
    return payments.length ? payments[0] : null;
  }, [payments]);

  const totalCount = payments.length;

  const remainingBalance = useMemo(() => {
    if (puppy?.balance !== null && puppy?.balance !== undefined) {
      return Number(puppy.balance || 0);
    }

    if (puppy?.price !== null && puppy?.price !== undefined) {
      return Math.max(0, Number(puppy.price || 0) - totalPaid);
    }

    return null;
  }, [puppy, totalPaid]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-50 italic">
        Loading Financials...
      </div>
    );
  }

  if (!user) {
    return <PaymentsLogin />;
  }

  return (
    <div className="flex h-screen overflow-hidden text-brand-900 bg-brand-50">
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white/80 backdrop-blur-md h-16 flex items-center justify-between px-6 border-b border-brand-200/50">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsDrawerOpen(true)} className="text-brand-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <span className="font-serif font-bold text-xl">SWVA</span>
        </div>

        <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center border border-brand-200 font-bold text-brand-600">
          {user.email?.[0]?.toUpperCase() || "U"}
        </div>
      </header>

      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-brand-900/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 bottom-0 w-[82%] max-w-[320px] bg-[#FDFBF9] z-50 shadow-2xl flex flex-col transition-transform duration-300 md:hidden ${
          isDrawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 border-b border-brand-100 flex justify-between items-center">
          <div>
            <div className="font-serif font-bold text-xl">Menu</div>
            <div className="text-[11px] text-brand-400 font-semibold mt-1 truncate max-w-[220px]">
              {user.email}
            </div>
          </div>
          <button onClick={() => setIsDrawerOpen(false)}>×</button>
        </div>

        <nav className="p-5 pt-7 flex flex-col gap-3 flex-1 overflow-y-auto">
          <Link href="/portal" className="nav-item">
            Dashboard
          </Link>
          <Link href="/portal/application" className="nav-item">
            Application
          </Link>
          <Link href="/portal/mypuppy" className="nav-item">
            My Puppy
          </Link>
          <Link href="/portal/messages" className="nav-item">
            Messages
          </Link>
          <Link href="/portal/documents" className="nav-item">
            Documents
          </Link>
          <Link href="/portal/payments" className="nav-item active">
            Financials
          </Link>
          <Link href="/portal/resources" className="nav-item">
            Resources
          </Link>
        </nav>

        <div className="p-6 border-t border-brand-100 bg-brand-50">
          <button
            onClick={handleSignOut}
            className="w-full py-3 rounded-lg border border-brand-200 text-brand-700 font-black text-sm hover:bg-white transition"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <aside className="hidden md:flex flex-col w-72 bg-white/80 border-r border-brand-200/60 z-20 h-full backdrop-blur-sm">
        <div className="p-8">
          <h1 className="font-serif font-bold text-xl leading-none">SWVA</h1>
          <p className="text-[10px] uppercase tracking-widest text-brand-500 font-black mt-1">
            Chihuahua
          </p>
        </div>

        <nav className="flex-1 px-4 pt-6 pb-6 overflow-y-auto">
          <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-brand-400">
            Portal
          </div>

          <div className="mt-3 flex flex-col gap-3">
            <Link href="/portal" className="nav-item">
              Dashboard
            </Link>
            <Link href="/portal/application" className="nav-item">
              Application
            </Link>
            <Link href="/portal/mypuppy" className="nav-item">
              My Puppy
            </Link>
          </div>

          <div className="px-4 py-2 mt-8 text-[10px] font-black uppercase tracking-widest text-brand-400">
            Communication
          </div>

          <div className="mt-3 flex flex-col gap-3">
            <Link href="/portal/messages" className="nav-item">
              Messages
            </Link>
            <Link href="/portal/documents" className="nav-item">
              Contracts
            </Link>
            <Link href="/portal/payments" className="nav-item active">
              Financials
            </Link>
            <Link href="/portal/resources" className="nav-item">
              Resources
            </Link>
          </div>
        </nav>

        <div className="p-4 border-t border-brand-100 bg-brand-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-200 flex items-center justify-center text-brand-700 font-black text-xs">
              {user.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black truncate">{user.email}</p>
              <div className="flex items-center gap-3 mt-1">
                <button
                  onClick={handleRefresh}
                  className="text-[10px] font-black uppercase text-brand-500 hover:text-brand-800"
                >
                  Refresh
                </button>
                <button
                  onClick={handleSignOut}
                  className="text-[10px] font-black uppercase text-brand-500 hover:text-brand-800"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 h-full relative flex flex-col overflow-hidden bg-texturePaper pt-16 md:pt-0">
        <div className="flex-1 p-6 md:p-10 lg:p-12 overflow-y-auto scroller max-w-[1600px] mx-auto w-full">
          <div className="space-y-8 pb-14">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
              <div>
                <h2 className="font-serif text-4xl md:text-5xl font-bold text-brand-900 leading-[0.95]">
                  Financials
                </h2>
                <p className="mt-2 text-brand-500 font-semibold">
                  Review payment history, completed transactions, and remaining balance information.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] bg-white border border-brand-200 text-brand-700">
                  Payments: {totalCount}
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] bg-white border border-brand-200 text-brand-700">
                  Paid: {fmtMoney(totalPaid)}
                </span>
              </div>
            </div>

            {statusText ? (
              <div className="text-sm font-semibold text-brand-500">{statusText}</div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 space-y-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-serif text-2xl font-bold text-brand-900">
                        Payment History
                      </h3>
                      <p className="text-brand-500 font-semibold text-sm mt-1">
                        Completed and recorded transactions for your portal account.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    {payments.length ? (
                      payments.map((payment) => (
                        <div
                          key={payment.id}
                          className="rounded-2xl border border-brand-200 bg-white/70 p-5"
                        >
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-base font-black text-brand-900">
                                  {payment.type || "Payment"}
                                </h4>

                                <span
                                  className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] border ${
                                    String(payment.status || "").toLowerCase() === "succeeded"
                                      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                      : "bg-amber-100 text-amber-700 border-amber-200"
                                  }`}
                                >
                                  {payment.status || "recorded"}
                                </span>

                                <span className="inline-flex px-2.5 py-1 rounded-full bg-brand-100 text-brand-700 border border-brand-200 text-[10px] font-black uppercase tracking-[0.18em]">
                                  {payment.provider || "provider"}
                                </span>
                              </div>

                              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div>
                                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
                                    Paid
                                  </div>
                                  <div className="mt-1 font-black text-brand-900">
                                    {fmtMoney(payment.amount || 0)}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
                                    Payment Date
                                  </div>
                                  <div className="mt-1 font-semibold text-brand-800">
                                    {payment.created_at
                                      ? fmtDate(payment.created_at)
                                      : payment.date
                                      ? fmtDate(payment.date)
                                      : "—"}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
                                    Buyer
                                  </div>
                                  <div className="mt-1 font-semibold text-brand-800">
                                    {payment.buyer || user.email || "—"}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
                                    Puppy
                                  </div>
                                  <div className="mt-1 font-semibold text-brand-800">
                                    {payment.puppy || puppyNameFromData(puppy) || "—"}
                                  </div>
                                </div>
                              </div>

                              {payment.stripe_payment_intent_id ? (
                                <div className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-brand-400 break-all">
                                  Stripe ID: {payment.stripe_payment_intent_id}
                                </div>
                              ) : null}
                            </div>

                            <div className="shrink-0">
                              <div className="text-right">
                                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
                                  Amount
                                </div>
                                <div className="mt-1 text-xl font-black text-brand-900">
                                  {fmtMoney(payment.amount || 0)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-16">
                        <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl border border-brand-200">
                          💳
                        </div>
                        <h4 className="font-serif text-3xl font-bold text-brand-800">
                          No Payments Recorded Yet
                        </h4>
                        <p className="text-brand-500 mt-3 max-w-md mx-auto text-sm font-semibold leading-relaxed">
                          Once payments are recorded to your account, they will appear here automatically.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 space-y-6">
                <div className="card-luxury p-7">
                  <h3 className="font-serif text-2xl font-bold text-brand-900 mb-4">
                    Financial Overview
                  </h3>

                  <div className="space-y-4">
                    <MiniInfo label="Puppy" value={puppyNameFromData(puppy) || "Pending"} />
                    <MiniInfo label="Puppy Status" value={puppy?.status || "—"} />
                    <MiniInfo
                      label="Listed Price"
                      value={
                        puppy?.price !== null && puppy?.price !== undefined
                          ? fmtMoney(puppy.price)
                          : "—"
                      }
                    />
                    <MiniInfo
                      label="Deposit"
                      value={
                        puppy?.deposit !== null && puppy?.deposit !== undefined
                          ? fmtMoney(puppy.deposit)
                          : "—"
                      }
                    />
                    <MiniInfo
                      label="Remaining Balance"
                      value={remainingBalance !== null ? fmtMoney(remainingBalance) : "—"}
                    />
                  </div>
                </div>

                <div className="card-luxury p-7">
                  <h3 className="font-serif text-2xl font-bold text-brand-900 mb-4">
                    Payment Notes
                  </h3>

                  <div className="space-y-3 text-sm font-semibold text-brand-600 leading-relaxed">
                    <p>Only recorded portal payments appear here.</p>
                    <p>Payment totals are based on succeeded transactions.</p>
                    <p>For questions about balances or payment arrangements, use the Messages page.</p>
                  </div>
                </div>

                <div className="rounded-3xl bg-brand-800 text-white p-7 shadow-luxury">
                  <h4 className="font-serif text-2xl font-bold">Need Help?</h4>
                  <p className="mt-2 text-brand-200 text-sm font-semibold">
                    If something looks incorrect or you need help understanding a payment entry, message support.
                  </p>
                  <Link
                    href="/portal/messages"
                    className="inline-block mt-5 px-5 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-black uppercase tracking-[0.18em] hover:bg-white/20 transition"
                  >
                    Message Support
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function puppyNameFromData(puppy: PuppyRow | null) {
  return puppy?.call_name || puppy?.puppy_name || puppy?.name || "";
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-luxury p-5 text-center">
      <div className="text-[11px] font-black text-brand-700 uppercase tracking-[0.18em]">
        {label}
      </div>
      <div className="mt-2 text-sm font-black text-brand-900 break-words">{value}</div>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-white/65 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
        {label}
      </div>
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
    <div className="h-screen flex items-center justify-center bg-brand-50 p-6">
      <div className="card-luxury shine p-10 w-full max-w-md border border-white">
        <h2 className="font-serif text-4xl font-bold text-center mb-8">
          Welcome Home
        </h2>

        <form onSubmit={login} className="space-y-5">
          <div>
            <label className="text-[10px] font-black uppercase text-brand-500 mb-1 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-xl border border-brand-200"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-brand-500 mb-1 block">
              Password
            </label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="w-full p-3 rounded-xl border border-brand-200"
              required
            />
          </div>

          <button className="w-full bg-brand-800 text-white p-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lift">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}