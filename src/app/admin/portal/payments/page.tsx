"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  AdminEmptyState,
  AdminHeroPrimaryAction,
  AdminHeroSecondaryAction,
  AdminInfoTile,
  AdminListCard,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPageHero,
  AdminPageShell,
  AdminPanel,
  AdminRestrictedState,
  adminStatusBadge,
} from "@/components/admin/luxury-admin-shell";
import { fmtDate, fmtMoney, sb } from "@/lib/utils";
import { isPortalAdminEmail } from "@/lib/portal-admin";

type BuyerRow = {
  id: number;
  user_id?: string | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  buyer_email?: string | null;
  finance_enabled?: boolean | null;
  finance_admin_fee?: boolean | null;
  finance_rate?: number | null;
  finance_months?: number | null;
  finance_monthly_amount?: number | null;
  finance_next_due_date?: string | null;
  finance_last_payment_date?: string | null;
  status?: string | null;
};

type PuppyRow = {
  id: number;
  buyer_id?: number | null;
  call_name?: string | null;
  puppy_name?: string | null;
  name?: string | null;
  price?: number | null;
  deposit?: number | null;
  balance?: number | null;
  status?: string | null;
};

type BuyerPayment = {
  id: string;
  created_at: string;
  buyer_id: number;
  payment_date: string;
  amount: number;
  payment_type: string | null;
  method: string | null;
  note: string | null;
  status: string | null;
  reference_number: string | null;
};

type BuyerAccount = {
  key: string;
  buyer: BuyerRow;
  puppy: PuppyRow | null;
  payments: BuyerPayment[];
  totalPaid: number;
  lastPaymentAt: string | null;
};

type EditForm = {
  price: string;
  deposit: string;
  balance: string;
  puppy_status: string;
  finance_enabled: string;
  finance_admin_fee: string;
  finance_rate: string;
  finance_months: string;
  finance_monthly_amount: string;
  finance_next_due_date: string;
};

function firstValue(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function moneyInputToNumber(value: string): number | null {
  const cleaned = String(value || "").replace(/[^0-9.-]/g, "").trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function toYesNo(value: boolean | null | undefined) {
  return value ? "yes" : "no";
}

function paymentCountsTowardBalance(status: string | null | undefined) {
  const normalized = String(status || "").toLowerCase();
  if (!normalized) return true;
  return !["failed", "void", "canceled", "cancelled"].includes(normalized);
}

function puppyName(puppy: PuppyRow | null) {
  return firstValue(puppy?.call_name, puppy?.puppy_name, puppy?.name, "Pending Match");
}

export default function AdminPortalPaymentsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [search, setSearch] = useState("");
  const [accounts, setAccounts] = useState<BuyerAccount[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [form, setForm] = useState<EditForm>({
    price: "",
    deposit: "",
    balance: "",
    puppy_status: "",
    finance_enabled: "no",
    finance_admin_fee: "no",
    finance_rate: "",
    finance_months: "",
    finance_monthly_amount: "",
    finance_next_due_date: "",
  });

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const {
          data: { session },
        } = await sb.auth.getSession();

        if (!mounted) return;
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser && isPortalAdminEmail(currentUser.email)) {
          const nextAccounts = await loadAccounts();
          setAccounts(nextAccounts);
          setSelectedKey(nextAccounts[0]?.key || "");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void bootstrap();

    const { data: authListener } = sb.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser && isPortalAdminEmail(currentUser.email)) {
        const nextAccounts = await loadAccounts();
        setAccounts(nextAccounts);
        setSelectedKey((prev) =>
          nextAccounts.find((account) => account.key === prev)?.key || nextAccounts[0]?.key || ""
        );
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

  async function loadAccounts() {
    const [buyersRes, puppiesRes, paymentsRes] = await Promise.all([
      sb
        .from("buyers")
        .select("id,user_id,full_name,name,email,buyer_email,finance_enabled,finance_admin_fee,finance_rate,finance_months,finance_monthly_amount,finance_next_due_date,finance_last_payment_date,status")
        .order("created_at", { ascending: false }),
      sb
        .from("puppies")
        .select("id,buyer_id,call_name,puppy_name,name,price,deposit,balance,status")
        .order("created_at", { ascending: false }),
      sb
        .from("buyer_payments")
        .select("id,created_at,buyer_id,payment_date,amount,payment_type,method,note,status,reference_number")
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    const buyers = (buyersRes.data || []) as BuyerRow[];
    const puppies = (puppiesRes.data || []) as PuppyRow[];
    const payments = (paymentsRes.data || []) as BuyerPayment[];

    const puppyByBuyerId = new Map<number, PuppyRow>();
    puppies.forEach((puppy) => {
      const buyerId = Number(puppy.buyer_id || 0);
      if (buyerId && !puppyByBuyerId.has(buyerId)) {
        puppyByBuyerId.set(buyerId, puppy);
      }
    });

    const paymentsByBuyerId = new Map<number, BuyerPayment[]>();
    payments.forEach((payment) => {
      const buyerId = Number(payment.buyer_id || 0);
      if (!buyerId) return;
      const group = paymentsByBuyerId.get(buyerId) || [];
      group.push(payment);
      paymentsByBuyerId.set(buyerId, group);
    });

    return buyers
      .map((buyer) => {
        const paymentGroup = paymentsByBuyerId.get(buyer.id) || [];
        const totalPaid = paymentGroup
          .filter((payment) => paymentCountsTowardBalance(payment.status))
          .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

        return {
          key: String(buyer.id),
          buyer,
          puppy: puppyByBuyerId.get(buyer.id) || null,
          payments: paymentGroup,
          totalPaid,
          lastPaymentAt: paymentGroup[0]?.payment_date || paymentGroup[0]?.created_at || null,
        };
      })
      .sort((a, b) =>
        firstValue(a.buyer.full_name, a.buyer.name, a.buyer.email).localeCompare(
          firstValue(b.buyer.full_name, b.buyer.name, b.buyer.email)
        )
      );
  }

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((account) =>
      [
        account.buyer.full_name,
        account.buyer.name,
        account.buyer.email,
        account.buyer.buyer_email,
        account.buyer.status,
        puppyName(account.puppy),
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(q)
    );
  }, [accounts, search]);

  const selectedAccount = useMemo(
    () =>
      filteredAccounts.find((account) => account.key === selectedKey) ||
      accounts.find((account) => account.key === selectedKey) ||
      null,
    [accounts, filteredAccounts, selectedKey]
  );

  useEffect(() => {
    if (!selectedAccount) return;
    setForm({
      price:
        selectedAccount.puppy?.price !== null && selectedAccount.puppy?.price !== undefined
          ? String(selectedAccount.puppy.price)
          : "",
      deposit:
        selectedAccount.puppy?.deposit !== null && selectedAccount.puppy?.deposit !== undefined
          ? String(selectedAccount.puppy.deposit)
          : "",
      balance:
        selectedAccount.puppy?.balance !== null && selectedAccount.puppy?.balance !== undefined
          ? String(selectedAccount.puppy.balance)
          : "",
      puppy_status: selectedAccount.puppy?.status || "",
      finance_enabled: toYesNo(selectedAccount.buyer.finance_enabled),
      finance_admin_fee: toYesNo(selectedAccount.buyer.finance_admin_fee),
      finance_rate:
        selectedAccount.buyer.finance_rate !== null && selectedAccount.buyer.finance_rate !== undefined
          ? String(selectedAccount.buyer.finance_rate)
          : "",
      finance_months:
        selectedAccount.buyer.finance_months !== null && selectedAccount.buyer.finance_months !== undefined
          ? String(selectedAccount.buyer.finance_months)
          : "",
      finance_monthly_amount:
        selectedAccount.buyer.finance_monthly_amount !== null &&
        selectedAccount.buyer.finance_monthly_amount !== undefined
          ? String(selectedAccount.buyer.finance_monthly_amount)
          : "",
      finance_next_due_date: selectedAccount.buyer.finance_next_due_date || "",
    });
    setStatusText("");
  }, [selectedAccount]);

  async function handleSave() {
    if (!selectedAccount) return;
    setSaving(true);
    setStatusText("");

    try {
      const buyerUpdate = {
        finance_enabled: form.finance_enabled === "yes",
        finance_admin_fee: form.finance_admin_fee === "yes",
        finance_rate: moneyInputToNumber(form.finance_rate),
        finance_months: moneyInputToNumber(form.finance_months),
        finance_monthly_amount: moneyInputToNumber(form.finance_monthly_amount),
        finance_next_due_date: form.finance_next_due_date || null,
      };

      const buyerResult = await sb.from("buyers").update(buyerUpdate).eq("id", selectedAccount.buyer.id);
      if (buyerResult.error) throw buyerResult.error;

      if (selectedAccount.puppy?.id) {
        const puppyResult = await sb
          .from("puppies")
          .update({
            price: moneyInputToNumber(form.price),
            deposit: moneyInputToNumber(form.deposit),
            balance: moneyInputToNumber(form.balance),
            status: form.puppy_status.trim() || null,
          })
          .eq("id", selectedAccount.puppy.id);

        if (puppyResult.error) throw puppyResult.error;
      }

      const nextAccounts = await loadAccounts();
      setAccounts(nextAccounts);
      setSelectedKey(selectedAccount.key);
      setStatusText("Payment settings updated.");
    } catch (error) {
      console.error(error);
      setStatusText("Could not update payment settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">Loading payments...</div>;
  }

  if (!user) {
    return (
      <AdminRestrictedState
        title="Sign in to access payments."
        details="This page is reserved for the Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!isPortalAdminEmail(user.email)) {
    return (
      <AdminRestrictedState
        title="This payment workspace is limited to approved owner accounts."
        details="Only the approved owner emails can manage balances, payment history, and finance settings here."
      />
    );
  }

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-12">
        <AdminPageHero
          eyebrow="Payments"
          title="Balances, financing, and payment history stay together in one payment-only workspace."
          description="This tab is dedicated to the buyer’s financial record, so you are not sorting through applications or messages while making money-related updates."
          actions={
            <>
              <AdminHeroPrimaryAction href="/admin/portal/messages">Open Messages</AdminHeroPrimaryAction>
              <AdminHeroSecondaryAction href="/admin/portal/users">Open Buyers</AdminHeroSecondaryAction>
            </>
          }
          aside={
            <div className="space-y-4">
              <AdminInfoTile
                label="Buyer Accounts"
                value={String(accounts.length)}
                detail="Searchable buyer cards grouped for financial review."
              />
              <AdminInfoTile
                label="Finance Enabled"
                value={String(accounts.filter((account) => account.buyer.finance_enabled).length)}
                detail="Buyer accounts currently using a financing plan."
              />
            </div>
          }
        />

        <AdminMetricGrid>
          <AdminMetricCard
            label="Buyer Accounts"
            value={String(accounts.length)}
            detail="Buyers available to review in the payments tab."
          />
          <AdminMetricCard
            label="Payment Records"
            value={String(accounts.reduce((sum, account) => sum + account.payments.length, 0))}
            detail="All recorded buyer payment entries."
            accent="from-[#ece3d5] via-[#d7c1a3] to-[#b18d62]"
          />
          <AdminMetricCard
            label="Finance Plans"
            value={String(accounts.filter((account) => account.buyer.finance_enabled).length)}
            detail="Buyer records with financing enabled."
            accent="from-[#dce9d6] via-[#b6cfaa] to-[#7e9c6f]"
          />
          <AdminMetricCard
            label="Search Results"
            value={String(filteredAccounts.length)}
            detail="Buyer cards matching the current payment search."
            accent="from-[#f0dcc1] via-[#ddb68c] to-[#c98743]"
          />
        </AdminMetricGrid>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
          <AdminPanel
            title="Buyer Payment Cards"
            subtitle="Search by buyer or puppy name. Each card keeps one buyer’s full payment picture together."
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search buyers or puppies..."
              className="w-full rounded-[20px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]"
            />

            <div className="mt-4 space-y-3">
              {filteredAccounts.length ? (
                filteredAccounts.map((account) => (
                  <AdminListCard
                    key={account.key}
                    selected={selectedKey === account.key}
                    onClick={() => setSelectedKey(account.key)}
                    title={firstValue(account.buyer.full_name, account.buyer.name, account.buyer.email, `Buyer #${account.buyer.id}`)}
                    subtitle={`${account.buyer.email || account.buyer.buyer_email || "No email"} • ${puppyName(account.puppy)}`}
                    meta={`${fmtMoney(account.totalPaid)} paid • ${account.payments.length} payment${account.payments.length === 1 ? "" : "s"}`}
                    badge={
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(
                          account.puppy?.status || account.buyer.status
                        )}`}
                      >
                        {account.puppy?.status || account.buyer.status || "pending"}
                      </span>
                    }
                  />
                ))
              ) : (
                <AdminEmptyState
                  title="No buyer payments matched your search"
                  description="Try a different buyer name, email, or puppy name."
                />
              )}
            </div>
          </AdminPanel>

          {selectedAccount ? (
            <div className="space-y-6">
              <AdminPanel
                title="Financial Snapshot"
                subtitle="A clean read of the selected buyer’s current pricing, financing, and payment history."
              >
                {statusText ? (
                  <div className="mb-4 rounded-[18px] border border-[#ead9c7] bg-[#fff9f2] px-4 py-3 text-sm font-semibold text-[#7a5a3a]">
                    {statusText}
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <AdminInfoTile label="Buyer" value={firstValue(selectedAccount.buyer.full_name, selectedAccount.buyer.name, selectedAccount.buyer.email, "Buyer")} />
                  <AdminInfoTile label="My Puppy" value={puppyName(selectedAccount.puppy)} />
                  <AdminInfoTile label="Total Paid" value={fmtMoney(selectedAccount.totalPaid)} />
                  <AdminInfoTile
                    label="Last Payment"
                    value={selectedAccount.lastPaymentAt ? fmtDate(selectedAccount.lastPaymentAt) : "-"}
                    detail={`${selectedAccount.payments.length} payment record(s)`}
                  />
                </div>
              </AdminPanel>

              <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.05fr)_420px]">
                <AdminPanel
                  title="Payment Settings"
                  subtitle="This is where price, deposit, balance, and financing settings are edited."
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <PaymentField label="Price" value={form.price} onChange={(value) => setForm((prev) => ({ ...prev, price: value }))} />
                    <PaymentField label="Deposit" value={form.deposit} onChange={(value) => setForm((prev) => ({ ...prev, deposit: value }))} />
                    <PaymentField label="Balance" value={form.balance} onChange={(value) => setForm((prev) => ({ ...prev, balance: value }))} />
                    <PaymentField label="Puppy Status" value={form.puppy_status} onChange={(value) => setForm((prev) => ({ ...prev, puppy_status: value }))} />
                    <PaymentSelect label="Financing Enabled" value={form.finance_enabled} onChange={(value) => setForm((prev) => ({ ...prev, finance_enabled: value }))} />
                    <PaymentSelect label="Admin Fee" value={form.finance_admin_fee} onChange={(value) => setForm((prev) => ({ ...prev, finance_admin_fee: value }))} />
                    <PaymentField label="APR / Rate" value={form.finance_rate} onChange={(value) => setForm((prev) => ({ ...prev, finance_rate: value }))} />
                    <PaymentField label="Finance Months" value={form.finance_months} onChange={(value) => setForm((prev) => ({ ...prev, finance_months: value }))} />
                    <PaymentField label="Monthly Amount" value={form.finance_monthly_amount} onChange={(value) => setForm((prev) => ({ ...prev, finance_monthly_amount: value }))} />
                    <PaymentDateField label="Next Due Date" value={form.finance_next_due_date} onChange={(value) => setForm((prev) => ({ ...prev, finance_next_due_date: value }))} />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={saving}
                      className="rounded-2xl bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(181,117,47,0.26)] transition hover:brightness-105 disabled:opacity-60"
                    >
                      {saving ? "Saving..." : "Save Payment Settings"}
                    </button>
                  </div>
                </AdminPanel>

                <AdminPanel
                  title="Finance Snapshot"
                  subtitle="Use this side panel to quickly confirm plan details before or after editing."
                >
                  <div className="space-y-4">
                    <AdminInfoTile label="Financing" value={selectedAccount.buyer.finance_enabled ? "Enabled" : "Not enabled"} />
                    <AdminInfoTile label="APR / Rate" value={selectedAccount.buyer.finance_rate !== null && selectedAccount.buyer.finance_rate !== undefined ? String(selectedAccount.buyer.finance_rate) : "-"} />
                    <AdminInfoTile label="Monthly Amount" value={selectedAccount.buyer.finance_monthly_amount !== null && selectedAccount.buyer.finance_monthly_amount !== undefined ? fmtMoney(selectedAccount.buyer.finance_monthly_amount) : "-"} />
                    <AdminInfoTile label="Next Due" value={selectedAccount.buyer.finance_next_due_date ? fmtDate(selectedAccount.buyer.finance_next_due_date) : "-"} />
                  </div>
                </AdminPanel>
              </section>

              <AdminPanel
                title="Payment History"
                subtitle="Recorded buyer payments stay grouped under the buyer instead of being scattered across the page."
              >
                <div className="space-y-3">
                  {selectedAccount.payments.length ? (
                    selectedAccount.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="rounded-[22px] border border-[#ead9c7] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2e9_100%)] p-4 shadow-[0_10px_24px_rgba(106,76,45,0.05)]"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-[#2f2218]">
                              {payment.payment_type || "Payment"} • {fmtMoney(payment.amount)}
                            </div>
                            <div className="mt-1 text-xs leading-5 text-[#8a6a49]">
                              {payment.method || "No method"} • {fmtDate(payment.payment_date || payment.created_at)}
                            </div>
                          </div>
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(
                              payment.status
                            )}`}
                          >
                            {payment.status || "recorded"}
                          </span>
                        </div>
                        {payment.note ? (
                          <div className="mt-3 text-sm leading-6 text-[#73583f]">{payment.note}</div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <AdminEmptyState
                      title="No payment records yet"
                      description="Buyer payment entries will appear here once they are recorded."
                    />
                  )}
                </div>
              </AdminPanel>
            </div>
          ) : (
            <AdminPanel
              title="Financial Snapshot"
              subtitle="Choose a buyer card to begin."
            >
              <AdminEmptyState
                title="No buyer selected"
                description="Choose a buyer card from the left to review payment settings and history."
              />
            </AdminPanel>
          )}
        </section>
      </div>
    </AdminPageShell>
  );
}

function PaymentField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a47946]">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm normal-case tracking-normal text-[#3e2a1f] outline-none focus:border-[#c8a884]"
      />
    </label>
  );
}

function PaymentDateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a47946]">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm normal-case tracking-normal text-[#3e2a1f] outline-none focus:border-[#c8a884]"
      />
    </label>
  );
}

function PaymentSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a47946]">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm normal-case tracking-normal text-[#3e2a1f] outline-none focus:border-[#c8a884]"
      >
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </label>
  );
}
