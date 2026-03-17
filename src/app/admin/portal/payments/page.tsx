"use client";

import React, { useEffect, useMemo, useState } from "react";
import { sb, fmtMoney, fmtDate } from "@/lib/utils";

type BuyerRow = {
  id: number;
  email: string | null;
  buyer_email?: string | null;
  full_name?: string | null;
  name?: string | null;
  user_id?: string | null;
};

type ApplicationRow = {
  id: number;
  created_at: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
  applicant_email: string | null;
  status: string | null;
  assigned_puppy_id?: number | null;
};

type PuppyRow = {
  id: number;
  buyer_id?: number | null;
  call_name: string | null;
  puppy_name: string | null;
  name: string | null;
  price: number | null;
  deposit: number | null;
  balance: number | null;
  status: string | null;
  created_at?: string | null;
};

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
  currency?: string | null;
  status: string | null;
  provider?: string | null;
  stripe_payment_intent_id?: string | null;
};

type PortalAccount = {
  key: string;
  userId: string | null;
  email: string;
  displayName: string;
  buyer: BuyerRow | null;
  application: ApplicationRow | null;
  puppy: PuppyRow | null;
  totalPaid: number;
  paymentCount: number;
  lastPaymentAt: string | null;
};

type EditForm = {
  price: string;
  deposit: string;
  balance: string;
  status: string;
};

function normalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (String(value || "").trim()) return String(value).trim();
  }
  return "";
}

function puppyNameFromRow(puppy: PuppyRow | null | undefined) {
  return firstNonEmpty(puppy?.call_name, puppy?.puppy_name, puppy?.name);
}

function moneyInputToNumber(value: string): number | null {
  const cleaned = String(value || "").replace(/[^0-9.-]/g, "").trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoneySafe(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return fmtMoney(value);
}

export default function AdminPortalPaymentsPage() {
  const [user, setUser] = useState<any>(null);
  const [accounts, setAccounts] = useState<PortalAccount[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState<EditForm>({
    price: "",
    deposit: "",
    balance: "",
    status: "",
  });

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
          await loadAdminData();
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: authListener } = sb.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      if (!mounted) return;

      setUser(currentUser);

      if (currentUser) {
        await loadAdminData();
      } else {
        setAccounts([]);
        setSelectedKey("");
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function loadAdminData() {
    setStatusText("Loading portal users...");

    try {
      const [buyersRes, appsRes, paymentsRes] = await Promise.all([
        sb
          .from("buyers")
          .select("id,email,buyer_email,full_name,name,user_id")
          .order("id", { ascending: false }),
        sb
          .from("puppy_applications")
          .select("id,created_at,user_id,full_name,email,applicant_email,status,assigned_puppy_id")
          .order("created_at", { ascending: false }),
        sb
          .from("payments")
          .select("id,created_at,date,type,buyer,puppy,amount,puppy_id,client_id,paid_at,currency,status,provider,stripe_payment_intent_id")
          .order("created_at", { ascending: false }),
      ]);

      const buyers = (buyersRes.data || []) as BuyerRow[];
      const apps = (appsRes.data || []) as ApplicationRow[];
      const payments = (paymentsRes.data || []) as PaymentRow[];

      const buyerIds = buyers.map((b) => b.id).filter(Boolean);
      let puppies: PuppyRow[] = [];

      if (buyerIds.length) {
        const puppiesRes = await sb
          .from("puppies")
          .select("id,buyer_id,call_name,puppy_name,name,price,deposit,balance,status,created_at")
          .in("buyer_id", buyerIds)
          .order("created_at", { ascending: false });

        puppies = (puppiesRes.data || []) as PuppyRow[];
      }

      const puppyByBuyerId = new Map<number, PuppyRow>();
      for (const puppy of puppies) {
        const buyerId = Number(puppy.buyer_id || 0);
        if (!buyerId) continue;
        if (!puppyByBuyerId.has(buyerId)) {
          puppyByBuyerId.set(buyerId, puppy);
        }
      }

      const paymentsByClientId = new Map<
        string,
        { totalPaid: number; paymentCount: number; lastPaymentAt: string | null }
      >();

      for (const payment of payments) {
        const clientId = String(payment.client_id || "").trim();
        if (!clientId) continue;

        const prev = paymentsByClientId.get(clientId) || {
          totalPaid: 0,
          paymentCount: 0,
          lastPaymentAt: null,
        };

        const isSucceeded = String(payment.status || "").toLowerCase() === "succeeded";
        const totalPaid = prev.totalPaid + (isSucceeded ? Number(payment.amount || 0) : 0);
        const paymentCount = prev.paymentCount + 1;
        const paymentDate = payment.paid_at || payment.created_at || payment.date || null;

        paymentsByClientId.set(clientId, {
          totalPaid,
          paymentCount,
          lastPaymentAt: prev.lastPaymentAt || paymentDate,
        });
      }

      const accountMap = new Map<string, PortalAccount>();

      const ensureAccount = (seed: {
        userId?: string | null;
        email?: string | null;
        displayName?: string | null;
        buyer?: BuyerRow | null;
        application?: ApplicationRow | null;
      }) => {
        const userId = String(seed.userId || "").trim() || null;
        const email = normalizeEmail(seed.email);
        if (!userId && !email) return null;

        const key = userId || email;
        const existing = accountMap.get(key);

        if (existing) {
          if (!existing.displayName && seed.displayName) {
            existing.displayName = String(seed.displayName);
          }
          if (!existing.email && email) {
            existing.email = email;
          }
          if (!existing.userId && userId) {
            existing.userId = userId;
          }
          if (!existing.buyer && seed.buyer) {
            existing.buyer = seed.buyer;
          }
          if (!existing.application && seed.application) {
            existing.application = seed.application;
          }
          return existing;
        }

        const paymentInfo = userId
          ? paymentsByClientId.get(userId) || {
              totalPaid: 0,
              paymentCount: 0,
              lastPaymentAt: null,
            }
          : {
              totalPaid: 0,
              paymentCount: 0,
              lastPaymentAt: null,
            };

        const created: PortalAccount = {
          key,
          userId,
          email,
          displayName: String(seed.displayName || ""),
          buyer: seed.buyer || null,
          application: seed.application || null,
          puppy: null,
          totalPaid: paymentInfo.totalPaid,
          paymentCount: paymentInfo.paymentCount,
          lastPaymentAt: paymentInfo.lastPaymentAt,
        };

        accountMap.set(key, created);
        return created;
      };

      for (const buyer of buyers) {
        const email = firstNonEmpty(buyer.email, buyer.buyer_email);
        const displayName = firstNonEmpty(buyer.full_name, buyer.name, email, "Portal User");

        const account = ensureAccount({
          userId: buyer.user_id || null,
          email,
          displayName,
          buyer,
        });

        if (account && buyer.id && !account.puppy) {
          account.puppy = puppyByBuyerId.get(buyer.id) || null;
        }
      }

      for (const app of apps) {
        const email = firstNonEmpty(app.email, app.applicant_email);
        const displayName = firstNonEmpty(app.full_name, email, "Portal User");

        const account = ensureAccount({
          userId: app.user_id || null,
          email,
          displayName,
          application: app,
        });

        if (account && !account.application) {
          account.application = app;
        }
      }

      const mergedAccounts = Array.from(accountMap.values())
        .map((account) => {
          if (!account.puppy && account.buyer?.id) {
            account.puppy = puppyByBuyerId.get(account.buyer.id) || null;
          }

          if (!account.displayName) {
            account.displayName =
              firstNonEmpty(
                account.buyer?.full_name,
                account.buyer?.name,
                account.application?.full_name,
                account.email,
                "Portal User"
              ) || "Portal User";
          }

          return account;
        })
        .sort((a, b) => {
          const aName = a.displayName.toLowerCase();
          const bName = b.displayName.toLowerCase();
          return aName.localeCompare(bName);
        });

      setAccounts(mergedAccounts);

      const nextSelectedKey =
        mergedAccounts.find((x) => x.key === selectedKey)?.key || mergedAccounts[0]?.key || "";

      setSelectedKey(nextSelectedKey);

      const selected = mergedAccounts.find((x) => x.key === nextSelectedKey) || null;
      hydrateFormFromAccount(selected);

      setStatusText("");
    } catch (error: any) {
      console.error("Admin portal payments load failed:", error);
      setAccounts([]);
      setSelectedKey("");
      setStatusText("Unable to load portal users.");
    }
  }

  function hydrateFormFromAccount(account: PortalAccount | null) {
    setForm({
      price:
        account?.puppy?.price !== null && account?.puppy?.price !== undefined
          ? String(account.puppy.price)
          : "",
      deposit:
        account?.puppy?.deposit !== null && account?.puppy?.deposit !== undefined
          ? String(account.puppy.deposit)
          : "",
      balance:
        account?.puppy?.balance !== null && account?.puppy?.balance !== undefined
          ? String(account.puppy.balance)
          : "",
      status: account?.puppy?.status || "",
    });
  }

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;

    return accounts.filter((account) => {
      const haystack = [
        account.displayName,
        account.email,
        account.application?.status || "",
        puppyNameFromRow(account.puppy),
        account.puppy?.status || "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [accounts, search]);

  const selectedAccount =
    accounts.find((account) => account.key === selectedKey) || filteredAccounts[0] || null;

  useEffect(() => {
    if (!selectedAccount) return;
    hydrateFormFromAccount(selectedAccount);
  }, [selectedKey]);

  async function handleRefresh() {
    await loadAdminData();
  }

  async function handleSaveBalance(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedAccount) {
      setStatusText("Select a portal user first.");
      return;
    }

    if (!selectedAccount.puppy?.id) {
      setStatusText("This portal user does not have a puppy assigned yet.");
      return;
    }

    setSaving(true);
    setStatusText("");

    try {
      const payload = {
        price: moneyInputToNumber(form.price),
        deposit: moneyInputToNumber(form.deposit),
        balance: moneyInputToNumber(form.balance),
        status: form.status.trim() || null,
      };

      const { error } = await sb
        .from("puppies")
        .update(payload)
        .eq("id", selectedAccount.puppy.id);

      if (error) {
        setStatusText(error.message || "Unable to save balance changes.");
        setSaving(false);
        return;
      }

      await loadAdminData();
      setSelectedKey(selectedAccount.key);
      setStatusText("Puppy financial fields updated successfully.");
    } catch (error: any) {
      console.error(error);
      setStatusText("Unable to save balance changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await sb.auth.signOut();
    setUser(null);
    setAccounts([]);
    setSelectedKey("");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50 italic">
        Loading Admin Payments...
      </div>
    );
  }

  if (!user) {
    return <AdminPaymentsLogin />;
  }

  return (
    <div className="min-h-screen text-brand-900 bg-brand-50">
      <main className="relative flex flex-col bg-texturePaper">
        <div className="w-full max-w-[1700px] mx-auto p-6 md:p-10 lg:p-12">
          <div className="space-y-8 pb-14">
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-5">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-brand-200 shadow-paper">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                    Admin Portal
                  </span>
                  <span className="w-1 h-1 rounded-full bg-brand-300" />
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                    Payments & Balances
                  </span>
                </div>

                <h2 className="mt-5 font-serif text-4xl md:text-5xl font-bold text-brand-900 leading-[0.95]">
                  Portal Payments
                </h2>

                <p className="mt-2 text-brand-500 font-semibold max-w-3xl">
                  View portal users, review puppy financials, and manually update balances so the
                  changes appear on the buyer’s portal page.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] bg-white border border-brand-200 text-brand-700">
                  Portal Users: {accounts.length}
                </span>

                <button
                  onClick={handleRefresh}
                  className="px-5 py-3 bg-white border border-brand-200 text-brand-800 font-black text-xs uppercase tracking-[0.18em] rounded-xl hover:bg-brand-50 transition shadow-paper"
                >
                  Refresh
                </button>

                <button
                  onClick={handleSignOut}
                  className="px-5 py-3 bg-white border border-brand-200 text-brand-800 font-black text-xs uppercase tracking-[0.18em] rounded-xl hover:bg-brand-50 transition shadow-paper"
                >
                  Sign Out
                </button>
              </div>
            </div>

            {statusText ? (
              <div className="text-sm font-semibold text-brand-600">{statusText}</div>
            ) : null}

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              <div className="xl:col-span-5 2xl:col-span-4 space-y-6">
                <div className="card-luxury p-7">
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <div>
                      <h3 className="font-serif text-2xl font-bold text-brand-900">
                        Portal Users
                      </h3>
                      <p className="text-brand-500 font-semibold text-sm mt-1">
                        Accounts tied to portal activity.
                      </p>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-400">
                      Select One
                    </span>
                  </div>

                  <div className="mb-5">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search name, email, puppy, status..."
                      className="w-full rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm text-brand-900 outline-none"
                    />
                  </div>

                  <div className="space-y-3 max-h-[900px] overflow-y-auto pr-1">
                    {filteredAccounts.length ? (
                      filteredAccounts.map((account) => {
                        const isActive = selectedAccount?.key === account.key;

                        return (
                          <button
                            key={account.key}
                            type="button"
                            onClick={() => {
                              setSelectedKey(account.key);
                              hydrateFormFromAccount(account);
                            }}
                            className={`w-full text-left rounded-2xl border p-4 transition ${
                              isActive
                                ? "border-brand-400 bg-brand-50 shadow-paper"
                                : "border-brand-200 bg-white/75 hover:bg-white"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-black text-brand-900 break-words">
                                  {account.displayName || "Portal User"}
                                </div>
                                <div className="mt-1 text-[12px] text-brand-500 font-semibold break-all">
                                  {account.email || "No email"}
                                </div>
                              </div>

                              <div className="shrink-0">
                                {account.userId ? (
                                  <span className="inline-flex px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-[0.18em]">
                                    Signed Up
                                  </span>
                                ) : (
                                  <span className="inline-flex px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-black uppercase tracking-[0.18em]">
                                    Partial
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                              <div>
                                <div className="font-black uppercase tracking-[0.18em] text-brand-500">
                                  Puppy
                                </div>
                                <div className="mt-1 font-semibold text-brand-800">
                                  {puppyNameFromRow(account.puppy) || "Pending"}
                                </div>
                              </div>

                              <div>
                                <div className="font-black uppercase tracking-[0.18em] text-brand-500">
                                  Balance
                                </div>
                                <div className="mt-1 font-semibold text-brand-800">
                                  {formatMoneySafe(account.puppy?.balance)}
                                </div>
                              </div>

                              <div>
                                <div className="font-black uppercase tracking-[0.18em] text-brand-500">
                                  App Status
                                </div>
                                <div className="mt-1 font-semibold text-brand-800">
                                  {account.application?.status || "—"}
                                </div>
                              </div>

                              <div>
                                <div className="font-black uppercase tracking-[0.18em] text-brand-500">
                                  Total Paid
                                </div>
                                <div className="mt-1 font-semibold text-brand-800">
                                  {fmtMoney(account.totalPaid || 0)}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="text-center py-12 text-brand-400 text-sm italic">
                        No portal users found.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="xl:col-span-7 2xl:col-span-8 space-y-6">
                {selectedAccount ? (
                  <>
                    <div className="card-luxury p-7">
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                            Selected Portal User
                          </div>
                          <h3 className="mt-2 font-serif text-3xl font-bold text-brand-900">
                            {selectedAccount.displayName || "Portal User"}
                          </h3>
                          <p className="mt-2 text-brand-500 font-semibold break-all">
                            {selectedAccount.email || "No email on file"}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex px-3 py-1 rounded-full bg-white border border-brand-200 text-[10px] font-black uppercase tracking-[0.18em] text-brand-700">
                            Application: {selectedAccount.application?.status || "—"}
                          </span>
                          <span className="inline-flex px-3 py-1 rounded-full bg-white border border-brand-200 text-[10px] font-black uppercase tracking-[0.18em] text-brand-700">
                            Puppy: {selectedAccount.puppy?.status || "Pending"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <InfoTile
                          label="Puppy"
                          value={puppyNameFromRow(selectedAccount.puppy) || "Pending"}
                        />
                        <InfoTile
                          label="Price"
                          value={formatMoneySafe(selectedAccount.puppy?.price)}
                        />
                        <InfoTile
                          label="Deposit"
                          value={formatMoneySafe(selectedAccount.puppy?.deposit)}
                        />
                        <InfoTile
                          label="Balance"
                          value={formatMoneySafe(selectedAccount.puppy?.balance)}
                        />
                      </div>

                      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                        <MiniInfo
                          label="Portal Sign-Up"
                          value={selectedAccount.userId ? "Yes" : "No user_id found"}
                        />
                        <MiniInfo
                          label="Payment Count"
                          value={String(selectedAccount.paymentCount || 0)}
                        />
                        <MiniInfo
                          label="Total Paid"
                          value={fmtMoney(selectedAccount.totalPaid || 0)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6">
                      <div className="2xl:col-span-7">
                        <form onSubmit={handleSaveBalance} className="card-luxury p-7 space-y-6">
                          <div>
                            <h3 className="font-serif text-2xl font-bold text-brand-900">
                              Update Puppy Financials
                            </h3>
                            <p className="mt-2 text-brand-500 font-semibold text-sm">
                              Saving here updates the puppy record used by the buyer portal.
                            </p>
                          </div>

                          {!selectedAccount.puppy?.id ? (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                              This account does not have a puppy assigned yet, so there is no balance
                              record to update.
                            </div>
                          ) : null}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <Field
                              label="Price"
                              value={form.price}
                              onChange={(v) => setForm((prev) => ({ ...prev, price: v }))}
                              placeholder="2500"
                            />

                            <Field
                              label="Deposit"
                              value={form.deposit}
                              onChange={(v) => setForm((prev) => ({ ...prev, deposit: v }))}
                              placeholder="250"
                            />

                            <Field
                              label="Balance"
                              value={form.balance}
                              onChange={(v) => setForm((prev) => ({ ...prev, balance: v }))}
                              placeholder="2250"
                            />

                            <Field
                              label="Puppy Status"
                              value={form.status}
                              onChange={(v) => setForm((prev) => ({ ...prev, status: v }))}
                              placeholder="reserved"
                            />
                          </div>

                          <div className="rounded-2xl border border-brand-200 bg-white/65 p-4">
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
                              Important
                            </div>
                            <div className="mt-2 text-sm font-semibold text-brand-700 leading-relaxed">
                              The buyer portal financial page reads from the puppy record. Updating
                              the puppy’s balance here is what makes the new balance appear for the
                              buyer.
                            </div>
                          </div>

                          <div className="flex flex-col md:flex-row gap-3 md:items-center">
                            <button
                              type="submit"
                              disabled={saving || !selectedAccount.puppy?.id}
                              className="px-7 py-3.5 bg-brand-800 text-white font-black text-sm rounded-xl hover:bg-brand-700 transition shadow-lift uppercase tracking-[0.12em] disabled:opacity-60"
                            >
                              {saving ? "Saving..." : "Save Financial Changes"}
                            </button>

                            <button
                              type="button"
                              onClick={() => hydrateFormFromAccount(selectedAccount)}
                              className="px-7 py-3.5 bg-white border border-brand-200 text-brand-800 font-black text-sm rounded-xl hover:bg-brand-50 transition shadow-paper uppercase tracking-[0.12em]"
                            >
                              Reset Form
                            </button>
                          </div>
                        </form>
                      </div>

                      <div className="2xl:col-span-5 space-y-6">
                        <div className="card-luxury p-7">
                          <h3 className="font-serif text-2xl font-bold text-brand-900 mb-4">
                            Account Snapshot
                          </h3>

                          <div className="space-y-4">
                            <MiniInfo
                              label="Buyer Name"
                              value={
                                firstNonEmpty(
                                  selectedAccount.buyer?.full_name,
                                  selectedAccount.buyer?.name,
                                  selectedAccount.application?.full_name,
                                  selectedAccount.email,
                                  "Portal User"
                                ) || "Portal User"
                              }
                            />
                            <MiniInfo
                              label="Email"
                              value={selectedAccount.email || "—"}
                            />
                            <MiniInfo
                              label="Application Status"
                              value={selectedAccount.application?.status || "—"}
                            />
                            <MiniInfo
                              label="Puppy"
                              value={puppyNameFromRow(selectedAccount.puppy) || "Pending"}
                            />
                            <MiniInfo
                              label="Puppy Status"
                              value={selectedAccount.puppy?.status || "—"}
                            />
                            <MiniInfo
                              label="Last Payment"
                              value={
                                selectedAccount.lastPaymentAt
                                  ? fmtDate(selectedAccount.lastPaymentAt)
                                  : "—"
                              }
                            />
                          </div>
                        </div>

                        <div className="card-luxury p-7">
                          <h3 className="font-serif text-2xl font-bold text-brand-900 mb-4">
                            What This Updates
                          </h3>

                          <div className="space-y-3 text-sm font-semibold text-brand-600 leading-relaxed">
                            <p>Price, deposit, and balance are saved directly to the puppy record.</p>
                            <p>That same puppy record is what the buyer portal uses for their financial overview.</p>
                            <p>If you need manual payment entries later, that can be added as a separate admin page flow.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="card-luxury p-12 text-center">
                    <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl border border-brand-200">
                      👤
                    </div>
                    <h3 className="font-serif text-3xl font-bold text-brand-800">
                      No Portal User Selected
                    </h3>
                    <p className="text-brand-500 mt-3 max-w-md mx-auto text-sm font-semibold leading-relaxed">
                      Select a portal user from the list to review and update financial details.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-brand-500 mb-2">
        {label}
      </label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm text-brand-900 outline-none"
      />
    </div>
  );
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
      <div className="mt-1 text-sm font-semibold text-brand-800 break-words">{value}</div>
    </div>
  );
}

function AdminPaymentsLogin() {
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
    <div className="min-h-screen flex items-center justify-center bg-brand-50 p-6">
      <div className="card-luxury shine p-10 w-full max-w-md border border-white">
        <h2 className="font-serif text-4xl font-bold text-center mb-8">Admin Sign In</h2>

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