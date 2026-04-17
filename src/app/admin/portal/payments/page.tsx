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
      if (filterMode === "financed" && form.finance_enabled !== "yes" && !account.buyer.finance_enabled) return false;
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
