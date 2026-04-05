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
  puppy_id?: number | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  sale_price?: number | null;
  deposit_amount?: number | null;
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
  puppy_id?: number | null;
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

type BalanceSummary = {
  price: number;
  deposit: number;
  paymentsApplied: number;
  principalDue: number;
  planTotal: number | null;
  financeUplift: number;
  balance: number;
  apr: number | null;
  financeEnabled: boolean;
  adminFeeEnabled: boolean;
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

type PaymentEntryForm = {
  payment_date: string;
  amount: string;
  payment_type: string;
  method: string;
  status: string;
  reference_number: string;
  note: string;
};

function firstValue(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toNumberOrNull(value: string | number | null | undefined) {
  const cleaned = String(value ?? "").replace(/[^0-9.-]/g, "").trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function toYesNo(value: boolean | null | undefined) {
  return value ? "yes" : "no";
}

function puppyName(puppy: PuppyRow | null) {
  return firstValue(puppy?.call_name, puppy?.puppy_name, puppy?.name, "Pending Match");
}

function emptyPaymentEntry(): PaymentEntryForm {
  return {
    payment_date: todayIso(),
    amount: "",
    payment_type: "payment",
    method: "",
    status: "recorded",
    reference_number: "",
    note: "",
  };
}

function calculateBalanceSummary(account: BuyerAccount, form: EditForm): BalanceSummary {
  const price =
    toNumberOrNull(form.price) ?? account.puppy?.price ?? account.buyer.sale_price ?? 0;
  const deposit =
    toNumberOrNull(form.deposit) ?? account.puppy?.deposit ?? account.buyer.deposit_amount ?? 0;
  const paymentsApplied = Number(account.totalPaid || 0);
  const principalDue = Math.max(0, price - deposit);
  const financeEnabled = form.finance_enabled === "yes";
  const adminFeeEnabled = form.finance_admin_fee === "yes";
  const apr = toNumberOrNull(form.finance_rate);
  const monthlyAmount = toNumberOrNull(form.finance_monthly_amount);
  const financeMonths = toNumberOrNull(form.finance_months);
  const rawPlanTotal =
    financeEnabled && monthlyAmount !== null && financeMonths !== null
      ? monthlyAmount * financeMonths
      : null;
  const planTotal = rawPlanTotal !== null ? Math.max(principalDue, rawPlanTotal) : null;
  const financeUplift = planTotal !== null ? Math.max(0, planTotal - principalDue) : 0;
  const balance =
    planTotal !== null
      ? Math.max(0, planTotal - paymentsApplied)
      : Math.max(0, principalDue - paymentsApplied);

  return {
    price,
    deposit,
    paymentsApplied,
    principalDue,
    planTotal,
    financeUplift,
    balance,
    apr,
    financeEnabled,
    adminFeeEnabled,
  };
}

async function fetchPaymentAccounts(accessToken: string) {
  if (!accessToken) return [] as BuyerAccount[];

  const response = await fetch("/api/admin/portal/payments", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return [] as BuyerAccount[];
  }

  const payload = (await response.json()) as { accounts?: BuyerAccount[] };
  return Array.isArray(payload.accounts) ? payload.accounts : [];
}

export default function AdminPortalPaymentsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingPayment, setLoggingPayment] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [paymentStatusText, setPaymentStatusText] = useState("");
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
  const [paymentForm, setPaymentForm] = useState<PaymentEntryForm>(emptyPaymentEntry);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const {
          data: { session },
        } = await sb.auth.getSession();

        if (!mounted) return;
        const currentUser = session?.user ?? null;
        const token = session?.access_token || "";
        setUser(currentUser);
        setAccessToken(token);

        if (currentUser && isPortalAdminEmail(currentUser.email)) {
          const nextAccounts = await fetchPaymentAccounts(token);
          if (!mounted) return;
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
      const token = session?.access_token || "";
      setUser(currentUser);
      setAccessToken(token);

      if (currentUser && isPortalAdminEmail(currentUser.email)) {
        const nextAccounts = await fetchPaymentAccounts(token);
        if (!mounted) return;
        setAccounts(nextAccounts);
        setSelectedKey((prev) => nextAccounts.find((account) => account.key === prev)?.key || nextAccounts[0]?.key || "");
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

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;

    return accounts.filter((account) =>
      [
        account.buyer.full_name,
        account.buyer.name,
        account.buyer.email,
        account.buyer.status,
        puppyName(account.puppy),
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(q)
    );
  }, [accounts, search]);

  const selectedAccount =
    filteredAccounts.find((account) => account.key === selectedKey) ||
    accounts.find((account) => account.key === selectedKey) ||
    null;

  useEffect(() => {
    if (!selectedAccount) return;

    setForm({
      price:
        selectedAccount.puppy?.price !== null && selectedAccount.puppy?.price !== undefined
          ? String(selectedAccount.puppy.price)
          : selectedAccount.buyer.sale_price !== null && selectedAccount.buyer.sale_price !== undefined
            ? String(selectedAccount.buyer.sale_price)
          : "",
      deposit:
        selectedAccount.puppy?.deposit !== null && selectedAccount.puppy?.deposit !== undefined
          ? String(selectedAccount.puppy.deposit)
          : selectedAccount.buyer.deposit_amount !== null && selectedAccount.buyer.deposit_amount !== undefined
            ? String(selectedAccount.buyer.deposit_amount)
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
    setPaymentForm(emptyPaymentEntry());
    setStatusText("");
    setPaymentStatusText("");
  }, [selectedAccount]);

  const balanceSummary = useMemo(
    () => (selectedAccount ? calculateBalanceSummary(selectedAccount, form) : null),
    [form, selectedAccount]
  );

  async function refreshAccounts(nextSelectedKey?: string) {
    const nextAccounts = await fetchPaymentAccounts(accessToken);
    setAccounts(nextAccounts);
    setSelectedKey(nextSelectedKey || nextAccounts[0]?.key || "");
  }

  async function handleSave() {
    if (!selectedAccount) return;

    setSaving(true);
    setStatusText("");

    try {
      const response = await fetch("/api/admin/portal/payments", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          buyer_id: selectedAccount.buyer.id,
          puppy_id: selectedAccount.puppy?.id || null,
          ...form,
          balance: balanceSummary ? balanceSummary.balance : toNumberOrNull(form.balance),
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not update payment settings.");
      }

      await refreshAccounts(selectedAccount.key);
      setStatusText("Payment settings updated. Balance recalculated.");
    } catch (error) {
      console.error(error);
      setStatusText("Could not update payment settings.");
    } finally {
      setSaving(false);
    }
  }

  async function logManualPayment() {
    if (!selectedAccount) return;

    setLoggingPayment(true);
    setPaymentStatusText("");

    try {
      const response = await fetch("/api/admin/portal/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          buyer_id: selectedAccount.buyer.id,
          puppy_id: selectedAccount.puppy?.id || null,
          ...paymentForm,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not log the payment.");
      }

      setPaymentForm(emptyPaymentEntry());
      await refreshAccounts(selectedAccount.key);
      setPaymentStatusText("Payment recorded.");
    } catch (error) {
      console.error(error);
      setPaymentStatusText("Could not log the payment.");
    } finally {
      setLoggingPayment(false);
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
          title="Manual payments, finance settings, and balance control all live in one place."
          description="This payment tab now reads from the real buyers, puppies, and buyer_payments tables. You can review balances, edit financing, and manually log payments without depending on the buyer portal."
          actions={
            <>
              <AdminHeroPrimaryAction href="/admin/portal/users">Open Buyers</AdminHeroPrimaryAction>
              <AdminHeroSecondaryAction href="/admin/portal/messages">Open Messages</AdminHeroSecondaryAction>
            </>
          }
          aside={
            <div className="space-y-4">
              <AdminInfoTile
                label="Buyer Accounts"
                value={String(accounts.length)}
                detail="All buyer accounts available for financial review."
              />
              <AdminInfoTile
                label="Finance Enabled"
                value={String(accounts.filter((account) => account.buyer.finance_enabled).length)}
                detail="Buyer records currently using a financing plan."
              />
            </div>
          }
        />

        <AdminMetricGrid>
          <AdminMetricCard
            label="Buyer Accounts"
            value={String(accounts.length)}
            detail="Buyers currently available in the payments workspace."
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

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
          <AdminPanel
            title="Buyer Payment Cards"
            subtitle="Search by buyer or puppy name. Each card keeps one buyer’s payment picture together."
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
                    subtitle={`${account.buyer.email || "No email"} • ${puppyName(account.puppy)}`}
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
                  title="No buyer payment records matched your search"
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
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <AdminInfoTile
                    label="Buyer"
                    value={firstValue(selectedAccount.buyer.full_name, selectedAccount.buyer.name, selectedAccount.buyer.email, "Buyer")}
                  />
                  <AdminInfoTile label="My Puppy" value={puppyName(selectedAccount.puppy)} />
                  <AdminInfoTile label="Total Paid" value={fmtMoney(selectedAccount.totalPaid)} />
                  <AdminInfoTile
                    label="Balance"
                    value={fmtMoney(balanceSummary?.balance || 0)}
                    detail={
                      balanceSummary?.financeEnabled
                        ? balanceSummary.planTotal !== null
                          ? `${fmtMoney(balanceSummary.planTotal)} plan total${balanceSummary.apr !== null ? ` • ${balanceSummary.apr}% APR` : ""}${balanceSummary.adminFeeEnabled ? " • admin fee on" : ""}`
                          : `${fmtMoney(balanceSummary.principalDue)} principal after deposit${balanceSummary.apr !== null ? ` • ${balanceSummary.apr}% APR noted` : ""}${balanceSummary.adminFeeEnabled ? " • admin fee on" : ""}`
                        : `${fmtMoney(balanceSummary?.price || 0)} price • ${fmtMoney(balanceSummary?.deposit || 0)} deposit`
                    }
                  />
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
                  subtitle="Edit price, deposit, puppy status, and financing details. Balance is calculated automatically from the recorded payment history."
                >
                  {statusText ? (
                    <div className="mb-4 rounded-[18px] border border-[#ead9c7] bg-[#fff9f2] px-4 py-3 text-sm font-semibold text-[#7a5a3a]">
                      {statusText}
                    </div>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-2">
                    <PaymentField label="Price" value={form.price} onChange={(value) => setForm((prev) => ({ ...prev, price: value }))} />
                    <PaymentField label="Deposit" value={form.deposit} onChange={(value) => setForm((prev) => ({ ...prev, deposit: value }))} />
                    <PaymentField
                      label="Balance"
                      value={balanceSummary ? String(balanceSummary.balance.toFixed(2)) : form.balance}
                      readOnly
                      detail={
                        balanceSummary?.financeEnabled
                          ? balanceSummary.planTotal !== null
                            ? `Auto-calculated from monthly amount × months, minus recorded payments.${balanceSummary.financeUplift > 0 ? ` Finance uplift over principal: ${fmtMoney(balanceSummary.financeUplift)}.` : ""}`
                            : "Payment plan is enabled. Balance currently follows price, deposit, and recorded payments until a full monthly schedule total is saved."
                          : `Auto-calculated as price - deposit - payments (${fmtMoney(balanceSummary?.paymentsApplied || 0)} recorded).`
                      }
                    />
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
                  title="Log Manual Payment"
                  subtitle="Enter a payment directly so the buyer portal updates from the real payment history."
                >
                  {paymentStatusText ? (
                    <div className="mb-4 rounded-[18px] border border-[#ead9c7] bg-[#fff9f2] px-4 py-3 text-sm font-semibold text-[#7a5a3a]">
                      {paymentStatusText}
                    </div>
                  ) : null}

                  <div className="grid gap-4">
                    <PaymentDateField label="Payment Date" value={paymentForm.payment_date} onChange={(value) => setPaymentForm((prev) => ({ ...prev, payment_date: value }))} />
                    <PaymentField label="Amount" value={paymentForm.amount} onChange={(value) => setPaymentForm((prev) => ({ ...prev, amount: value }))} />
                    <PaymentField label="Payment Type" value={paymentForm.payment_type} onChange={(value) => setPaymentForm((prev) => ({ ...prev, payment_type: value }))} />
                    <PaymentField label="Method" value={paymentForm.method} onChange={(value) => setPaymentForm((prev) => ({ ...prev, method: value }))} />
                    <PaymentField label="Status" value={paymentForm.status} onChange={(value) => setPaymentForm((prev) => ({ ...prev, status: value }))} />
                    <PaymentField label="Reference Number" value={paymentForm.reference_number} onChange={(value) => setPaymentForm((prev) => ({ ...prev, reference_number: value }))} />
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a47946]">
                      Note
                      <textarea
                        value={paymentForm.note}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, note: e.target.value }))}
                        rows={5}
                        className="mt-2 w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]"
                      />
                    </label>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void logManualPayment()}
                      disabled={loggingPayment}
                      className="rounded-2xl bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(181,117,47,0.26)] transition hover:brightness-105 disabled:opacity-60"
                    >
                      {loggingPayment ? "Saving..." : "Record Payment"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentForm(emptyPaymentEntry());
                        setPaymentStatusText("");
                      }}
                      className="rounded-2xl border border-[#e4d2be] bg-white px-5 py-3 text-sm font-semibold text-[#5d4330] shadow-[0_12px_28px_rgba(106,76,45,0.08)] transition hover:border-[#d4b48b]"
                    >
                      Reset
                    </button>
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
                        {payment.reference_number ? (
                          <div className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#a47946]">
                            Ref: {payment.reference_number}
                          </div>
                        ) : null}
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
            <AdminPanel title="Financial Snapshot" subtitle="Choose a buyer card to begin.">
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
  readOnly = false,
  detail,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  detail?: string;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a47946]">
      {label}
      <input
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        className={`mt-2 w-full rounded-[18px] border px-4 py-3.5 text-sm normal-case tracking-normal text-[#3e2a1f] outline-none ${
          readOnly
            ? "border-[#ead9c7] bg-[#f8f1e7]"
            : "border-[#e4d3c2] bg-[#fffdfb] focus:border-[#c8a884]"
        }`}
      />
      {detail ? (
        <div className="mt-2 text-[12px] normal-case tracking-normal text-[#8a6a49]">
          {detail}
        </div>
      ) : null}
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
