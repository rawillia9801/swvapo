"use client";

import Link from "next/link";
import React, { useEffect, useEffectEvent, useMemo, useState } from "react";
import {
  BellRing,
  CalendarClock,
  Download,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import {
  AdminEmptyState,
  AdminPageShell,
  AdminPanel,
  AdminRestrictedState,
  adminStatusBadge,
} from "@/components/admin/luxury-admin-shell";
import { fmtDate, fmtMoney } from "@/lib/utils";
import { usePortalAdminSession } from "@/lib/use-portal-admin-session";

type BuyerRow = {
  id: number;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  sale_price?: number | null;
  deposit_amount?: number | null;
  finance_enabled?: boolean | null;
  finance_admin_fee?: boolean | null;
  finance_rate?: number | null;
  finance_months?: number | null;
  finance_monthly_amount?: number | null;
  finance_next_due_date?: string | null;
  status?: string | null;
};

type PuppyRow = {
  id: number;
  call_name?: string | null;
  puppy_name?: string | null;
  name?: string | null;
  price?: number | null;
  deposit?: number | null;
  status?: string | null;
};

type BuyerPayment = {
  id: string;
  created_at: string;
  payment_date: string;
  amount: number;
  payment_type?: string | null;
  method?: string | null;
  note?: string | null;
  status?: string | null;
  reference_number?: string | null;
};

type BuyerAdjustment = {
  id: number;
  created_at: string;
  entry_date: string;
  entry_type?: string | null;
  label?: string | null;
  description?: string | null;
  amount: number;
  status?: string | null;
  reference_number?: string | null;
};

type BuyerAccount = {
  key: string;
  buyer: BuyerRow;
  puppy: PuppyRow | null;
  payments: BuyerPayment[];
  adjustments: BuyerAdjustment[];
  billing_subscription?: {
    hostedpage_url?: string | null;
    subscription_status?: string | null;
    next_billing_at?: string | null;
    plan_name?: string | null;
    recurring_price?: number | null;
  } | null;
  payment_notice_logs?: Array<{
    id: number;
    created_at: string;
    notice_kind: string;
    status: string;
    subject: string;
  }>;
  totalPaid: number;
  lastPaymentAt: string | null;
};

type EditForm = {
  price: string;
  deposit: string;
  puppy_status: string;
  finance_enabled: string;
  finance_admin_fee: string;
  finance_rate: string;
  finance_months: string;
  finance_monthly_amount: string;
  finance_next_due_date: string;
};

type EntryMode = "payment" | "fee" | "credit";
type DetailTab = "ledger" | "terms" | "entry" | "notices";

type EntryForm = {
  entry_date: string;
  amount: string;
  payment_type: string;
  method: string;
  status: string;
  reference_number: string;
  note: string;
  entry_type: string;
  label: string;
  description: string;
};

type ActivityRow = {
  key: string;
  kind: "payment" | "adjustment";
  date: string;
  amount: number;
  title: string;
  detail: string;
  status: string;
};

function firstValue(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toNumberOrNull(value: string | number | null | undefined) {
  const normalized = String(value ?? "").replace(/[^0-9.-]/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function buyerDisplayName(account: BuyerAccount) {
  return firstValue(account.buyer.full_name, account.buyer.name, account.buyer.email, `Buyer #${account.buyer.id}`);
}

function puppyDisplayName(puppy: PuppyRow | null) {
  return firstValue(puppy?.call_name, puppy?.puppy_name, puppy?.name, "Pending match");
}

function paymentCounts(status: string | null | undefined) {
  return !["failed", "void", "cancelled", "canceled"].includes(String(status || "").toLowerCase());
}

function adjustmentCounts(status: string | null | undefined) {
  return !["void", "cancelled", "canceled"].includes(String(status || "").toLowerCase());
}

function buildEditForm(account: BuyerAccount): EditForm {
  return {
    price: String(account.puppy?.price ?? account.buyer.sale_price ?? ""),
    deposit: String(account.puppy?.deposit ?? account.buyer.deposit_amount ?? ""),
    puppy_status: String(account.puppy?.status || ""),
    finance_enabled: account.buyer.finance_enabled ? "yes" : "no",
    finance_admin_fee: account.buyer.finance_admin_fee ? "yes" : "no",
    finance_rate: String(account.buyer.finance_rate ?? ""),
    finance_months: String(account.buyer.finance_months ?? ""),
    finance_monthly_amount: String(account.buyer.finance_monthly_amount ?? ""),
    finance_next_due_date: String(account.buyer.finance_next_due_date || ""),
  };
}

function entryFormForMode(mode: EntryMode): EntryForm {
  const base = {
    entry_date: todayIso(),
    amount: "",
    payment_type: "payment",
    method: "",
    status: "recorded",
    reference_number: "",
    note: "",
    entry_type: mode === "credit" ? "credit" : "fee",
    label: mode === "credit" ? "Credit" : "Fee",
    description: "",
  };

  if (mode === "payment") {
    return {
      ...base,
      entry_type: "",
      label: "",
    };
  }

  return base;
}

function calculateAccount(account: BuyerAccount, form: EditForm) {
  const price = toNumberOrNull(form.price) ?? account.puppy?.price ?? account.buyer.sale_price ?? 0;
  const deposit = toNumberOrNull(form.deposit) ?? account.puppy?.deposit ?? account.buyer.deposit_amount ?? 0;
  const paymentsApplied = account.payments
    .filter((payment) => paymentCounts(payment.status))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const adjustmentCharges = account.adjustments.reduce((sum, adjustment) => {
    if (!adjustmentCounts(adjustment.status)) return sum;
    return String(adjustment.entry_type || "").toLowerCase() === "credit"
      ? sum
      : sum + Math.abs(Number(adjustment.amount || 0));
  }, 0);
  const adjustmentCredits = account.adjustments.reduce((sum, adjustment) => {
    if (!adjustmentCounts(adjustment.status)) return sum;
    return String(adjustment.entry_type || "").toLowerCase() === "credit"
      ? sum + Math.abs(Number(adjustment.amount || 0))
      : sum;
  }, 0);
  const principal = Math.max(0, price - deposit);
  const financeMonths = toNumberOrNull(form.finance_months);
  const monthly = toNumberOrNull(form.finance_monthly_amount);
  const planTotal =
    form.finance_enabled === "yes" && financeMonths !== null && monthly !== null
      ? Math.max(principal, financeMonths * monthly)
      : principal;
  const totalCharges = planTotal + adjustmentCharges;
  const totalCredits = paymentsApplied + adjustmentCredits;
  const balance = Math.max(0, totalCharges - totalCredits);
  const nextDueDate = form.finance_next_due_date || null;
  const daysUntilDue = nextDueDate
    ? Math.floor(
        (Date.parse(nextDueDate) -
          Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) /
          86400000
      )
    : null;
  const isOverdue = balance > 0 && daysUntilDue !== null && daysUntilDue < 0;
  const isDueSoon = balance > 0 && daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 7;
  const paidPct = totalCharges > 0 ? Math.max(0, Math.min(100, (totalCredits / totalCharges) * 100)) : 100;

  return {
    price,
    deposit,
    principal,
    totalCharges,
    totalCredits,
    balance,
    nextDueDate,
    daysUntilDue,
    isOverdue,
    isDueSoon,
    paidPct,
  };
}

function buildActivity(account: BuyerAccount): ActivityRow[] {
  const payments = account.payments.map((payment) => ({
    key: `payment-${payment.id}`,
    kind: "payment" as const,
    date: payment.payment_date || payment.created_at,
    amount: Number(payment.amount || 0),
    title: firstValue(payment.payment_type, "Payment"),
    detail: [firstValue(payment.method), firstValue(payment.note)].filter(Boolean).join(" | "),
    status: firstValue(payment.status, "recorded"),
  }));

  const adjustments = account.adjustments.map((adjustment) => ({
    key: `adjustment-${adjustment.id}`,
    kind: "adjustment" as const,
    date: adjustment.entry_date || adjustment.created_at,
    amount: Number(adjustment.amount || 0),
    title: firstValue(adjustment.label, adjustment.entry_type, "Adjustment"),
    detail: firstValue(adjustment.description),
    status: firstValue(adjustment.status, "recorded"),
  }));

  return [...payments, ...adjustments].sort((left, right) => Date.parse(right.date) - Date.parse(left.date));
}

function reminderKind(summary: ReturnType<typeof calculateAccount>) {
  if (summary.isOverdue && Math.abs(summary.daysUntilDue || 0) >= 30) return "default_notice";
  if (summary.isOverdue) return "late_notice";
  return "due_reminder";
}

export default function AdminPortalPaymentsPage() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const [accounts, setAccounts] = useState<BuyerAccount[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [statusText, setStatusText] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("all");
  const [detailTab, setDetailTab] = useState<DetailTab>("ledger");
  const [entryMode, setEntryMode] = useState<EntryMode>("payment");
  const [form, setForm] = useState<EditForm>({
    price: "",
    deposit: "",
    puppy_status: "",
    finance_enabled: "no",
    finance_admin_fee: "no",
    finance_rate: "",
    finance_months: "",
    finance_monthly_amount: "",
    finance_next_due_date: "",
  });
  const [entryForm, setEntryForm] = useState<EntryForm>(entryFormForMode("payment"));
  const [workingAction, setWorkingAction] = useState("");

  const loadAccounts = useEffectEvent(async () => {
    if (!accessToken) return;
    setLoadingData(true);
    try {
      const response = await fetch("/api/admin/portal/payments", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        accounts?: BuyerAccount[];
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not load payment accounts.");
      }

      const nextAccounts = Array.isArray(payload.accounts) ? payload.accounts : [];
      setAccounts(nextAccounts);
      setSelectedKey((current) =>
        nextAccounts.some((account) => account.key === current) ? current : nextAccounts[0]?.key || ""
      );
      setStatusText("");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not load payment accounts.");
    } finally {
      setLoadingData(false);
    }
  });

  useEffect(() => {
    if (!accessToken || !isAdmin) {
      setLoadingData(false);
      return;
    }
    void loadAccounts();
  }, [accessToken, isAdmin, loadAccounts]);

  const decoratedAccounts = useMemo(
    () =>
      accounts.map((account) => {
        const editForm = account.key === selectedKey ? form : buildEditForm(account);
        const summary = calculateAccount(account, editForm);
        return {
          account,
          summary,
          activity: buildActivity(account),
        };
      }),
    [accounts, form, selectedKey]
  );

  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return decoratedAccounts.filter(({ account, summary }) => {
      const financeEnabled =
        account.key === selectedKey ? form.finance_enabled === "yes" : Boolean(account.buyer.finance_enabled);
      if (filterMode === "financed" && !financeEnabled) return false;
      if (filterMode === "overdue" && !summary.isOverdue) return false;
      if (filterMode === "due_soon" && !summary.isDueSoon) return false;
      if (filterMode === "current" && (summary.balance <= 0 || summary.isOverdue || summary.isDueSoon)) return false;
      if (filterMode === "paid_off" && summary.balance > 0) return false;
      if (!query) return true;
      return [buyerDisplayName(account), account.buyer.email, puppyDisplayName(account.puppy), account.puppy?.status]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(query);
    });
  }, [decoratedAccounts, filterMode, form.finance_enabled, search]);

  const selectedBundle =
    filteredAccounts.find(({ account }) => account.key === selectedKey) ||
    decoratedAccounts.find(({ account }) => account.key === selectedKey) ||
    null;

  useEffect(() => {
    if (!selectedBundle) return;
    setForm(buildEditForm(selectedBundle.account));
    setEntryForm(entryFormForMode(entryMode));
  }, [selectedBundle, entryMode]);

  async function saveTerms() {
    if (!selectedBundle || !accessToken) return;
    setWorkingAction("save_terms");
    setStatusText("");
    try {
      const response = await fetch("/api/admin/portal/payments", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          buyer_id: selectedBundle.account.buyer.id,
          puppy_id: selectedBundle.account.puppy?.id || null,
          ...form,
        }),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not save the account terms.");
      }

      setStatusText("Account terms updated.");
      await loadAccounts();
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not save the account terms.");
    } finally {
      setWorkingAction("");
    }
  }

  async function recordEntry() {
    if (!selectedBundle || !accessToken) return;
    setWorkingAction("record_entry");
    setStatusText("");
    try {
      const response = await fetch("/api/admin/portal/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(
          entryMode === "payment"
            ? {
                buyer_id: selectedBundle.account.buyer.id,
                puppy_id: selectedBundle.account.puppy?.id || null,
                payment_date: entryForm.entry_date,
                amount: entryForm.amount,
                payment_type: entryForm.payment_type,
                method: entryForm.method,
                status: entryForm.status,
                reference_number: entryForm.reference_number,
                note: entryForm.note,
              }
            : {
                buyer_id: selectedBundle.account.buyer.id,
                puppy_id: selectedBundle.account.puppy?.id || null,
                entry_kind: "adjustment",
                entry_date: entryForm.entry_date,
                amount: entryForm.amount,
                entry_type: entryMode === "credit" ? "credit" : "fee",
                label: entryForm.label,
                status: entryForm.status,
                reference_number: entryForm.reference_number,
                description: entryForm.description,
              }
        ),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not record the account entry.");
      }

      setEntryForm(entryFormForMode(entryMode));
      setStatusText(entryMode === "payment" ? "Payment recorded." : "Account adjustment recorded.");
      await loadAccounts();
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not record the account entry.");
    } finally {
      setWorkingAction("");
    }
  }

  async function sendNotice(kind: "due_reminder" | "late_notice" | "default_notice") {
    if (!selectedBundle || !accessToken) return;
    setWorkingAction(kind);
    setStatusText("");
    try {
      const response = await fetch("/api/admin/portal/payment-notices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          buyer_id: selectedBundle.account.buyer.id,
          kind,
        }),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not send the payment notice.");
      }

      setStatusText(kind === "default_notice" ? "Default notice sent." : "Payment reminder sent.");
      await loadAccounts();
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not send the payment notice.");
    } finally {
      setWorkingAction("");
    }
  }

  function exportHistory() {
    if (!selectedBundle) return;
    const csv = [
      ["Date", "Type", "Title", "Amount", "Status", "Detail"].join(","),
      ...selectedBundle.activity.map((row) =>
        [row.date, row.kind, row.title, row.amount, row.status, row.detail]
          .map((value) => `"${String(value || "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${buyerDisplayName(selectedBundle.account).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-account-history.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading || loadingData) {
    return <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">Loading payments workspace...</div>;
  }

  if (!user) {
    return (
      <AdminRestrictedState
        title="Sign in to access payments."
        details="This workspace is reserved for Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!isAdmin) {
    return (
      <AdminRestrictedState
        title="This payments workspace is limited to approved owner accounts."
        details="Only approved owner emails can review balances, plans, and payment history here."
      />
    );
  }

  const overdueCount = decoratedAccounts.filter(({ summary }) => summary.isOverdue).length;
  const dueSoonCount = decoratedAccounts.filter(({ summary }) => summary.isDueSoon).length;
  const paidOffCount = decoratedAccounts.filter(({ summary }) => summary.balance <= 0).length;
  const activeFinancedCount = decoratedAccounts.filter(({ account }) => account.buyer.finance_enabled).length;
  const currentCount = decoratedAccounts.filter(({ summary }) => summary.balance > 0 && !summary.isOverdue && !summary.isDueSoon).length;

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-12">
        <section className="rounded-[2rem] border border-[var(--portal-border)] bg-[linear-gradient(135deg,rgba(255,250,243,0.96)_0%,rgba(247,239,227,0.94)_100%)] px-6 py-6 shadow-[0_18px_40px_rgba(106,76,45,0.08)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--portal-text-muted)]">Payments</div>
              <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-[var(--portal-text)]">Accounts receivable workspace</h1>
              <p className="mt-3 text-sm leading-7 text-[var(--portal-text-soft)]">
                Work balances like an accounts tool: review the table, open an account, inspect the ledger, send notices, edit terms, and record payments without hunting across separate cards.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/admin/portal/buyers" className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]">
                Open Buyers
              </Link>
              <button type="button" onClick={() => void loadAccounts()} className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(181,117,47,0.24)] transition hover:brightness-105">
                <RefreshCw className="h-4 w-4" />
                Refresh Accounts
              </button>
            </div>
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <SummaryStat label="Active financed" value={String(activeFinancedCount)} detail="Buyer accounts with financing enabled." />
          <SummaryStat label="Overdue" value={String(overdueCount)} detail="Accounts currently past due." />
          <SummaryStat label="Due soon" value={String(dueSoonCount)} detail="Balances entering the reminder window." />
          <SummaryStat label="Current" value={String(currentCount)} detail="Open accounts not yet due." />
          <SummaryStat label="Paid off" value={String(paidOffCount)} detail="Closed balances with no amount remaining." />
        </div>

        {statusText ? (
          <div className="rounded-[1.2rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--portal-text-soft)]">
            {statusText}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.14fr)_440px]">
          <AdminPanel title="Accounts table" subtitle="Select a buyer account to open the ledger, plan, and receivables actions.">
            <div className="flex flex-col gap-3 border-b border-[var(--portal-border)] pb-4 lg:flex-row">
              <label className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--portal-text-muted)]" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search buyer or puppy..." className="w-full rounded-2xl border border-[var(--portal-border)] bg-white py-3 pl-11 pr-4 text-sm text-[var(--portal-text)] outline-none" />
              </label>
              <select value={filterMode} onChange={(event) => setFilterMode(event.target.value)} className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm text-[var(--portal-text)] outline-none">
                <option value="all">All accounts</option>
                <option value="financed">Financed</option>
                <option value="overdue">Overdue</option>
                <option value="due_soon">Due soon</option>
                <option value="current">Current</option>
                <option value="paid_off">Paid off</option>
              </select>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                    <th className="px-3 py-3">Buyer</th>
                    <th className="px-3 py-3">Puppy</th>
                    <th className="px-3 py-3">Plan Type</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Balance</th>
                    <th className="px-3 py-3">Next Due</th>
                    <th className="px-3 py-3">Days Late</th>
                    <th className="px-3 py-3">Last Payment</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.length ? (
                    filteredAccounts.map(({ account, summary }) => (
                      <tr key={account.key} className={`cursor-pointer transition ${selectedKey === account.key ? "bg-[rgba(241,230,214,0.58)]" : "hover:bg-[rgba(247,240,230,0.52)]"}`} onClick={() => setSelectedKey(account.key)}>
                        <td className="border-t border-[var(--portal-border)] px-3 py-4">
                          <div className="font-semibold text-[var(--portal-text)]">{buyerDisplayName(account)}</div>
                          <div className="mt-1 text-xs text-[var(--portal-text-soft)]">{account.buyer.email || "No email"}</div>
                        </td>
                        <td className="border-t border-[var(--portal-border)] px-3 py-4 text-sm text-[var(--portal-text-soft)]">{puppyDisplayName(account.puppy)}</td>
                        <td className="border-t border-[var(--portal-border)] px-3 py-4 text-sm text-[var(--portal-text-soft)]">{account.buyer.finance_enabled ? "Financing" : "Standard"}</td>
                        <td className="border-t border-[var(--portal-border)] px-3 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(summary.balance <= 0 ? "paid" : summary.isOverdue ? "overdue" : summary.isDueSoon ? "due" : "active")}`}>
                            {summary.balance <= 0 ? "Paid Off" : summary.isOverdue ? "Overdue" : summary.isDueSoon ? "Due Soon" : "Current"}
                          </span>
                        </td>
                        <td className="border-t border-[var(--portal-border)] px-3 py-4 text-sm font-semibold text-[var(--portal-text)]">{fmtMoney(summary.balance)}</td>
                        <td className="border-t border-[var(--portal-border)] px-3 py-4 text-sm text-[var(--portal-text-soft)]">{summary.nextDueDate ? fmtDate(summary.nextDueDate) : "-"}</td>
                        <td className="border-t border-[var(--portal-border)] px-3 py-4 text-sm text-[var(--portal-text-soft)]">{summary.isOverdue ? Math.abs(summary.daysUntilDue || 0) : "-"}</td>
                        <td className="border-t border-[var(--portal-border)] px-3 py-4 text-sm text-[var(--portal-text-soft)]">{account.lastPaymentAt ? fmtDate(account.lastPaymentAt) : "-"}</td>
                        <td className="border-t border-[var(--portal-border)] px-3 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedKey(account.key); }} className="rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]">
                              Open
                            </button>
                            <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedKey(account.key); setDetailTab("entry"); }} className="rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]">
                              Record
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-0 py-8">
                        <AdminEmptyState title="No accounts matched your filters" description="Adjust the search or status filter to reopen the receivables list." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </AdminPanel>
          <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
            {selectedBundle ? (
              <>
                <AdminPanel title={buyerDisplayName(selectedBundle.account)} subtitle={puppyDisplayName(selectedBundle.account.puppy)}>
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-[var(--portal-text)]">{puppyDisplayName(selectedBundle.account.puppy)}</div>
                        <div className="mt-1 text-sm text-[var(--portal-text-soft)]">
                          {selectedBundle.account.billing_subscription?.plan_name || (selectedBundle.account.buyer.finance_enabled ? "Financing plan" : "Standard sale")}
                        </div>
                      </div>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(selectedBundle.summary.balance <= 0 ? "paid" : selectedBundle.summary.isOverdue ? "overdue" : selectedBundle.summary.isDueSoon ? "due" : "active")}`}>
                        {selectedBundle.summary.balance <= 0 ? "Paid Off" : selectedBundle.summary.isOverdue ? "Overdue" : selectedBundle.summary.isDueSoon ? "Due Soon" : "Current"}
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <MiniStat label="Balance" value={fmtMoney(selectedBundle.summary.balance)} />
                      <MiniStat label="Paid" value={`${selectedBundle.summary.paidPct.toFixed(0)}%`} />
                      <MiniStat label="Next due" value={selectedBundle.summary.nextDueDate ? fmtDate(selectedBundle.summary.nextDueDate) : "Not set"} />
                      <MiniStat label="Last payment" value={selectedBundle.account.lastPaymentAt ? fmtDate(selectedBundle.account.lastPaymentAt) : "None"} />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <ActionButton icon={<BellRing className="h-4 w-4" />} disabled={workingAction === "due_reminder" || workingAction === "late_notice" || workingAction === "default_notice"} onClick={() => void sendNotice(reminderKind(selectedBundle.summary))}>
                        {selectedBundle.summary.isOverdue ? "Send Notice" : "Send Reminder"}
                      </ActionButton>
                      <ActionButton icon={<Wallet className="h-4 w-4" />} onClick={() => setDetailTab("entry")}>Record Payment</ActionButton>
                      <ActionButton icon={<CalendarClock className="h-4 w-4" />} disabled={workingAction === "default_notice"} onClick={() => void sendNotice("default_notice")}>Mark Default</ActionButton>
                      <ActionButton icon={<Download className="h-4 w-4" />} onClick={() => exportHistory()}>Export History</ActionButton>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {([
                        { value: "ledger", label: "Ledger" },
                        { value: "terms", label: "Terms" },
                        { value: "entry", label: "Record Entry" },
                        { value: "notices", label: "Notices" },
                      ] as Array<{ value: DetailTab; label: string }>).map((tab) => (
                        <button key={tab.value} type="button" onClick={() => setDetailTab(tab.value)} className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${detailTab === tab.value ? "border-[#d3a056] bg-[rgba(242,230,212,0.72)] text-[var(--portal-text)]" : "border-[var(--portal-border)] bg-white text-[var(--portal-text-soft)]"}`}>
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </AdminPanel>

                {detailTab === "ledger" ? (
                  <AdminPanel title="Ledger" subtitle="Payment history, fees, credits, and account timeline.">
                    <div className="space-y-3">
                      {selectedBundle.activity.length ? (
                        selectedBundle.activity.map((row) => (
                          <div key={row.key} className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-[var(--portal-text)]">{row.title}</div>
                                <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">{[fmtDate(row.date), row.kind, row.detail].filter(Boolean).join(" | ")}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-[var(--portal-text)]">{fmtMoney(row.amount)}</div>
                                <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">{row.status}</div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <AdminEmptyState title="No ledger entries yet" description="Payments, fees, and credits will appear here as they are recorded." />
                      )}
                    </div>
                  </AdminPanel>
                ) : null}

                {detailTab === "terms" ? (
                  <AdminPanel title="Plan and account terms" subtitle="Update the sale price, deposit, financing, and next due date.">
                    <div className="grid gap-3">
                      <Field label="Purchase price" value={form.price} onChange={(value) => setForm((current) => ({ ...current, price: value }))} />
                      <Field label="Deposit" value={form.deposit} onChange={(value) => setForm((current) => ({ ...current, deposit: value }))} />
                      <Field label="Puppy status" value={form.puppy_status} onChange={(value) => setForm((current) => ({ ...current, puppy_status: value }))} />
                      <SelectField label="Financing enabled" value={form.finance_enabled} onChange={(value) => setForm((current) => ({ ...current, finance_enabled: value }))} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
                      <SelectField label="Admin fee enabled" value={form.finance_admin_fee} onChange={(value) => setForm((current) => ({ ...current, finance_admin_fee: value }))} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
                      <Field label="APR" value={form.finance_rate} onChange={(value) => setForm((current) => ({ ...current, finance_rate: value }))} />
                      <Field label="Term (months)" value={form.finance_months} onChange={(value) => setForm((current) => ({ ...current, finance_months: value }))} />
                      <Field label="Monthly amount" value={form.finance_monthly_amount} onChange={(value) => setForm((current) => ({ ...current, finance_monthly_amount: value }))} />
                      <DateField label="Next due date" value={form.finance_next_due_date} onChange={(value) => setForm((current) => ({ ...current, finance_next_due_date: value }))} />
                    </div>
                    <div className="mt-4">
                      <ActionButton icon={<Wallet className="h-4 w-4" />} disabled={workingAction === "save_terms"} onClick={() => void saveTerms()}>Save Terms</ActionButton>
                    </div>
                  </AdminPanel>
                ) : null}

                {detailTab === "entry" ? (
                  <AdminPanel title="Record entry" subtitle="Add a payment, fee, or credit to this account.">
                    <div className="flex flex-wrap gap-2">
                      {([
                        { value: "payment", label: "Payment" },
                        { value: "fee", label: "Fee" },
                        { value: "credit", label: "Credit" },
                      ] as Array<{ value: EntryMode; label: string }>).map((mode) => (
                        <button key={mode.value} type="button" onClick={() => { setEntryMode(mode.value); setEntryForm(entryFormForMode(mode.value)); }} className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${entryMode === mode.value ? "border-[#d3a056] bg-[rgba(242,230,212,0.72)] text-[var(--portal-text)]" : "border-[var(--portal-border)] bg-white text-[var(--portal-text-soft)]"}`}>
                          {mode.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 grid gap-3">
                      <DateField label="Entry date" value={entryForm.entry_date} onChange={(value) => setEntryForm((current) => ({ ...current, entry_date: value }))} />
                      <Field label="Amount" value={entryForm.amount} onChange={(value) => setEntryForm((current) => ({ ...current, amount: value }))} />
                      {entryMode === "payment" ? (
                        <>
                          <Field label="Payment type" value={entryForm.payment_type} onChange={(value) => setEntryForm((current) => ({ ...current, payment_type: value }))} />
                          <Field label="Method" value={entryForm.method} onChange={(value) => setEntryForm((current) => ({ ...current, method: value }))} />
                          <Field label="Note" value={entryForm.note} onChange={(value) => setEntryForm((current) => ({ ...current, note: value }))} />
                        </>
                      ) : (
                        <>
                          <Field label="Label" value={entryForm.label} onChange={(value) => setEntryForm((current) => ({ ...current, label: value }))} />
                          <Field label="Description" value={entryForm.description} onChange={(value) => setEntryForm((current) => ({ ...current, description: value }))} />
                        </>
                      )}
                      <Field label="Status" value={entryForm.status} onChange={(value) => setEntryForm((current) => ({ ...current, status: value }))} />
                      <Field label="Reference number" value={entryForm.reference_number} onChange={(value) => setEntryForm((current) => ({ ...current, reference_number: value }))} />
                    </div>
                    <div className="mt-4">
                      <ActionButton icon={<Wallet className="h-4 w-4" />} disabled={workingAction === "record_entry"} onClick={() => void recordEntry()}>
                        {entryMode === "payment" ? "Record Payment" : "Record Adjustment"}
                      </ActionButton>
                    </div>
                  </AdminPanel>
                ) : null}

                {detailTab === "notices" ? (
                  <AdminPanel title="Notices and payment link" subtitle="Recent reminders plus portal billing status for this account.">
                    <div className="space-y-4">
                      <MiniStat label="Portal payment link" value={selectedBundle.account.billing_subscription?.hostedpage_url ? "Available" : "Not linked"} detail={selectedBundle.account.billing_subscription?.subscription_status || "No billing subscription"} />
                      {selectedBundle.account.billing_subscription?.hostedpage_url ? (
                        <Link href={selectedBundle.account.billing_subscription.hostedpage_url} target="_blank" className="inline-flex items-center gap-2 text-sm font-semibold text-[#a56a37]">
                          Open hosted payment link
                        </Link>
                      ) : null}
                      <div className="space-y-3">
                        {selectedBundle.account.payment_notice_logs?.length ? (
                          selectedBundle.account.payment_notice_logs.map((log) => (
                            <div key={log.id} className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-4">
                              <div className="text-sm font-semibold text-[var(--portal-text)]">{log.subject}</div>
                              <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">{[fmtDate(log.created_at), log.notice_kind, log.status].join(" | ")}</div>
                            </div>
                          ))
                        ) : (
                          <AdminEmptyState title="No notice history yet" description="Sent reminders and default notices will appear here." />
                        )}
                      </div>
                    </div>
                  </AdminPanel>
                ) : null}
              </>
            ) : (
              <AdminPanel title="Account workspace" subtitle="Select a buyer account from the table to begin.">
                <AdminEmptyState title="No account selected" description="Choose a row on the left to open the ledger, plan, and notice actions." />
              </AdminPanel>
            )}
          </div>
        </div>
      </div>
    </AdminPageShell>
  );
}

function SummaryStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[1.4rem] border border-[var(--portal-border)] bg-white px-5 py-4 shadow-[0_12px_28px_rgba(106,76,45,0.06)]">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">{label}</div>
      <div className="mt-2 text-[1.45rem] font-semibold tracking-[-0.04em] text-[var(--portal-text)]">{value}</div>
      <div className="mt-2 text-xs leading-5 text-[var(--portal-text-soft)]">{detail}</div>
    </div>
  );
}

function MiniStat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">{label}</div>
      <div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">{value}</div>
      {detail ? <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">{detail}</div> : null}
    </div>
  );
}

function ActionButton({
  children,
  icon,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)] disabled:cursor-not-allowed disabled:opacity-45"
    >
      {icon}
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm text-[var(--portal-text)] outline-none"
      />
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
      {label}
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm text-[var(--portal-text)] outline-none"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm text-[var(--portal-text)] outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
