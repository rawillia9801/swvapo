"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  AdminEmptyState,
  AdminHeroPrimaryAction,
  AdminHeroSecondaryAction,
  AdminInfoTile,
  AdminListCard,
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

type BuyerAdjustment = {
  id: number;
  created_at: string;
  buyer_id: number;
  puppy_id?: number | null;
  entry_date: string;
  entry_type: string | null;
  label: string | null;
  description: string | null;
  amount: number;
  status: string | null;
  reference_number: string | null;
};

type BuyerAccount = {
  key: string;
  buyer: BuyerRow;
  puppy: PuppyRow | null;
  payments: BuyerPayment[];
  adjustments: BuyerAdjustment[];
  totalPaid: number;
  lastPaymentAt: string | null;
};

type BalanceSummary = {
  price: number;
  deposit: number;
  paymentsApplied: number;
  principalAfterDeposit: number;
  financeBaseTotal: number;
  planTotal: number | null;
  financeUplift: number;
  adjustmentCharges: number;
  adjustmentCredits: number;
  totalCharges: number;
  totalCredits: number;
  balance: number;
  apr: number | null;
  financeEnabled: boolean;
  adminFeeEnabled: boolean;
  financeMonths: number | null;
  monthlyAmount: number | null;
  nextDueDate: string | null;
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

type EntryMode = "payment" | "fee" | "credit" | "transportation";

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

type AccountActivity = {
  key: string;
  kind: "payment" | "adjustment";
  date: string;
  amount: number;
  title: string;
  detail: string;
  status: string;
  referenceNumber: string;
  sourceLabel: string;
  isZoho: boolean;
  isPortalLinked: boolean;
};

type IntegrationStatusGroup = {
  id: string;
  label: string;
  ready: boolean;
  summary: string;
  missing: string[];
};

type FilterMode =
  | "all"
  | "financing"
  | "with-balance"
  | "overdue"
  | "due-soon"
  | "zoho"
  | "manual-only";

type SortMode =
  | "balance-desc"
  | "balance-asc"
  | "name-asc"
  | "last-payment-desc"
  | "next-due-asc";

type AccountInsight = {
  statusTone: "emerald" | "amber" | "rose" | "slate";
  statusLabel: string;
  collectionTone: string;
  collectionLabel: string;
  isOverdue: boolean;
  isDueSoon: boolean;
  daysPastDue: number | null;
  daysUntilDue: number | null;
  percentPaid: number;
  hasZoho: boolean;
  hasPortalLinkedZoho: boolean;
  nextDueLabel: string;
  accountHeadline: string;
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

function buyerDisplayName(account: BuyerAccount) {
  return firstValue(
    account.buyer.full_name,
    account.buyer.name,
    account.buyer.email,
    `Buyer #${account.buyer.id}`
  );
}

function paymentCountsTowardBalance(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return true;
  return !["failed", "void", "cancelled", "canceled"].includes(normalized);
}

function adjustmentCountsTowardBalance(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return true;
  return !["void", "cancelled", "canceled"].includes(normalized);
}

function entryFormForMode(mode: EntryMode): EntryForm {
  const common = {
    entry_date: todayIso(),
    amount: "",
    method: "",
    status: "recorded",
    reference_number: "",
    note: "",
    description: "",
  };

  if (mode === "payment") {
    return {
      ...common,
      payment_type: "payment",
      entry_type: "",
      label: "",
    };
  }

  if (mode === "credit") {
    return {
      ...common,
      payment_type: "",
      entry_type: "credit",
      label: "Credit",
    };
  }

  if (mode === "transportation") {
    return {
      ...common,
      payment_type: "",
      entry_type: "transportation",
      label: "Transportation Fee",
    };
  }

  return {
    ...common,
    payment_type: "",
    entry_type: "fee",
    label: "Fee",
  };
}

function calculateBalanceSummary(account: BuyerAccount, form: EditForm): BalanceSummary {
  const price =
    toNumberOrNull(form.price) ?? account.puppy?.price ?? account.buyer.sale_price ?? 0;
  const deposit =
    toNumberOrNull(form.deposit) ?? account.puppy?.deposit ?? account.buyer.deposit_amount ?? 0;

  const paymentsApplied = account.payments
    .filter((payment) => paymentCountsTowardBalance(payment.status))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const principalAfterDeposit = Math.max(0, price - deposit);
  const financeEnabled = form.finance_enabled === "yes";
  const adminFeeEnabled = form.finance_admin_fee === "yes";
  const apr = toNumberOrNull(form.finance_rate);
  const monthlyAmount = toNumberOrNull(form.finance_monthly_amount);
  const financeMonths = toNumberOrNull(form.finance_months);

  const rawPlanTotal =
    financeEnabled && monthlyAmount !== null && financeMonths !== null
      ? monthlyAmount * financeMonths
      : null;

  const planTotal = rawPlanTotal !== null ? Math.max(principalAfterDeposit, rawPlanTotal) : null;
  const financeBaseTotal =
    planTotal !== null ? Math.max(principalAfterDeposit, planTotal) : principalAfterDeposit;
  const financeUplift = Math.max(0, financeBaseTotal - principalAfterDeposit);

  const adjustmentCharges = account.adjustments.reduce((sum, adjustment) => {
    if (!adjustmentCountsTowardBalance(adjustment.status)) return sum;
    const entryType = String(adjustment.entry_type || "").trim().toLowerCase();
    if (entryType === "credit") return sum;
    return sum + Math.abs(Number(adjustment.amount || 0));
  }, 0);

  const adjustmentCredits = account.adjustments.reduce((sum, adjustment) => {
    if (!adjustmentCountsTowardBalance(adjustment.status)) return sum;
    const entryType = String(adjustment.entry_type || "").trim().toLowerCase();
    if (entryType !== "credit") return sum;
    return sum + Math.abs(Number(adjustment.amount || 0));
  }, 0);

  const totalCharges = financeBaseTotal + adjustmentCharges;
  const totalCredits = paymentsApplied + adjustmentCredits;
  const balance = Math.max(0, totalCharges - totalCredits);

  return {
    price,
    deposit,
    paymentsApplied,
    principalAfterDeposit,
    financeBaseTotal,
    planTotal,
    financeUplift,
    adjustmentCharges,
    adjustmentCredits,
    totalCharges,
    totalCredits,
    balance,
    apr,
    financeEnabled,
    adminFeeEnabled,
    financeMonths,
    monthlyAmount,
    nextDueDate: form.finance_next_due_date || null,
  };
}

function paymentTitle(payment: BuyerPayment) {
  return firstValue(payment.payment_type, "Payment");
}

function adjustmentTitle(adjustment: BuyerAdjustment) {
  return firstValue(
    adjustment.label,
    adjustment.entry_type === "transportation"
      ? "Transportation Fee"
      : adjustment.entry_type === "credit"
        ? "Credit"
        : "Fee"
  );
}

function isZohoPayment(payment: BuyerPayment) {
  const haystack = [payment.method, payment.note]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  return haystack.includes("zoho");
}

function isPortalLinkedPayment(payment: BuyerPayment) {
  return [payment.method, payment.note]
    .map((value) => String(value || "").toLowerCase())
    .join(" ")
    .includes("via zoho payment link");
}

function countZohoPayments(account: BuyerAccount) {
  return account.payments.filter((payment) => isZohoPayment(payment)).length;
}

function latestZohoPaymentDate(account: BuyerAccount) {
  const latest = account.payments
    .filter((payment) => isZohoPayment(payment))
    .sort((left, right) => {
      const leftTime = new Date(left.payment_date || left.created_at).getTime();
      const rightTime = new Date(right.payment_date || right.created_at).getTime();
      return rightTime - leftTime;
    })[0];

  return latest?.payment_date || latest?.created_at || null;
}

function buildAccountActivity(account: BuyerAccount): AccountActivity[] {
  const paymentRows: AccountActivity[] = account.payments.map((payment) => ({
    key: `payment-${payment.id}`,
    kind: "payment",
    date: payment.payment_date || payment.created_at,
    amount: Number(payment.amount || 0),
    title: paymentTitle(payment),
    detail: [firstValue(payment.method, "Method not listed"), firstValue(payment.note)]
      .filter(Boolean)
      .join(" - "),
    status: firstValue(payment.status, "recorded"),
    referenceNumber: firstValue(payment.reference_number),
    sourceLabel: isZohoPayment(payment) ? "Zoho receipt" : "Manual payment",
    isZoho: isZohoPayment(payment),
    isPortalLinked: isPortalLinkedPayment(payment),
  }));

  const adjustmentRows: AccountActivity[] = account.adjustments.map((adjustment) => ({
    key: `adjustment-${adjustment.id}`,
    kind: "adjustment",
    date: adjustment.entry_date || adjustment.created_at,
    amount: Number(adjustment.amount || 0),
    title: adjustmentTitle(adjustment),
    detail: firstValue(adjustment.description, adjustment.entry_type),
    status: firstValue(adjustment.status, "recorded"),
    referenceNumber: firstValue(adjustment.reference_number),
    sourceLabel: "Manual adjustment",
    isZoho: false,
    isPortalLinked: false,
  }));

  return [...paymentRows, ...adjustmentRows].sort((a, b) => {
    const aTime = new Date(a.date).getTime();
    const bTime = new Date(b.date).getTime();
    return bTime - aTime;
  });
}

function dateDiffInDays(baseDate: string) {
  const target = new Date(baseDate);
  const now = new Date();
  const utcTarget = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const utcNow = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((utcTarget - utcNow) / (1000 * 60 * 60 * 24));
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function buildAccountInsight(
  account: BuyerAccount,
  balanceSummary: BalanceSummary
): AccountInsight {
  const dueDate = balanceSummary.nextDueDate;
  const daysUntilDue = dueDate ? dateDiffInDays(dueDate) : null;
  const isOverdue = balanceSummary.balance > 0 && daysUntilDue !== null && daysUntilDue < 0;
  const isDueSoon =
    balanceSummary.balance > 0 && daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 7;

  const percentPaid =
    balanceSummary.totalCharges > 0
      ? clampPercent((balanceSummary.totalCredits / balanceSummary.totalCharges) * 100)
      : 100;

  const hasZoho = countZohoPayments(account) > 0;
  const hasPortalLinkedZoho = account.payments.some((payment) => isPortalLinkedPayment(payment));

  let statusTone: AccountInsight["statusTone"] = "slate";
  let statusLabel = "Stable";
  let collectionLabel = "Monitor";

  if (balanceSummary.balance <= 0) {
    statusTone = "emerald";
    statusLabel = "Paid Off";
    collectionLabel = "Closed";
  } else if (isOverdue) {
    statusTone = "rose";
    statusLabel = "Overdue";
    collectionLabel = "Collections Risk";
  } else if (isDueSoon) {
    statusTone = "amber";
    statusLabel = "Due Soon";
    collectionLabel = "Reminder Window";
  } else if (balanceSummary.balance > 0 && balanceSummary.financeEnabled) {
    statusTone = "amber";
    statusLabel = "Active Plan";
    collectionLabel = "Plan Monitoring";
  }

  const nextDueLabel =
    dueDate && daysUntilDue !== null
      ? isOverdue
        ? `${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? "" : "s"} past due`
        : daysUntilDue === 0
          ? "Due today"
          : `${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"} until due`
      : "No due date saved";

  let accountHeadline = "Ledger looks routine.";
  if (balanceSummary.balance <= 0) {
    accountHeadline = "Buyer account is fully satisfied.";
  } else if (isOverdue) {
    accountHeadline = "Action recommended: balance is overdue and should be reviewed for follow-up.";
  } else if (isDueSoon) {
    accountHeadline = "Payment window is approaching soon.";
  } else if (balanceSummary.financeEnabled) {
    accountHeadline = "Financing terms are active and should be monitored.";
  }

  return {
    statusTone,
    statusLabel,
    collectionTone:
      statusTone === "rose"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : statusTone === "amber"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : statusTone === "emerald"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-[var(--portal-border)] bg-white text-[var(--portal-text-soft)]",
    collectionLabel,
    isOverdue,
    isDueSoon,
    daysPastDue: isOverdue && daysUntilDue !== null ? Math.abs(daysUntilDue) : null,
    daysUntilDue,
    percentPaid,
    hasZoho,
    hasPortalLinkedZoho,
    nextDueLabel,
    accountHeadline,
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

async function fetchIntegrationStatus(accessToken: string) {
  if (!accessToken) return [] as IntegrationStatusGroup[];

  const response = await fetch("/api/admin/portal/integration-status", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return [] as IntegrationStatusGroup[];
  }

  const payload = (await response.json()) as { groups?: IntegrationStatusGroup[] };
  return Array.isArray(payload.groups) ? payload.groups : [];
}

export default function AdminPortalPaymentsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingEntry, setLoggingEntry] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [entryStatusText, setEntryStatusText] = useState("");
  const [integrationLoading, setIntegrationLoading] = useState(false);
  const [integrationStatusText, setIntegrationStatusText] = useState("");
  const [integrationGroups, setIntegrationGroups] = useState<IntegrationStatusGroup[]>([]);
  const [search, setSearch] = useState("");
  const [accounts, setAccounts] = useState<BuyerAccount[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [handledQuerySelection, setHandledQuerySelection] = useState("");
  const [requestedBuyerId, setRequestedBuyerId] = useState("");
  const [entryMode, setEntryMode] = useState<EntryMode>("payment");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("balance-desc");
  const [showOnlyOpenBalances, setShowOnlyOpenBalances] = useState(false);
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
  const [entryForm, setEntryForm] = useState<EntryForm>(entryFormForMode("payment"));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setRequestedBuyerId(params.get("buyer") || "");
  }, []);

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
          const [nextAccounts, nextGroups] = await Promise.all([
            fetchPaymentAccounts(token),
            fetchIntegrationStatus(token),
          ]);
          if (!mounted) return;
          setAccounts(nextAccounts);
          setIntegrationGroups(nextGroups);
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
        const [nextAccounts, nextGroups] = await Promise.all([
          fetchPaymentAccounts(token),
          fetchIntegrationStatus(token),
        ]);
        if (!mounted) return;
        setAccounts(nextAccounts);
        setIntegrationGroups(nextGroups);
        setSelectedKey(
          (prev) =>
            nextAccounts.find((account) => account.key === prev)?.key ||
            nextAccounts[0]?.key ||
            ""
        );
      } else {
        setAccounts([]);
        setIntegrationGroups([]);
        setSelectedKey("");
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const accountLedgerMap = useMemo(() => {
    return new Map(
      accounts.map((account) => {
        const syntheticForm: EditForm = {
          price:
            account.puppy?.price !== null && account.puppy?.price !== undefined
              ? String(account.puppy.price)
              : account.buyer.sale_price !== null && account.buyer.sale_price !== undefined
                ? String(account.buyer.sale_price)
                : "",
          deposit:
            account.puppy?.deposit !== null && account.puppy?.deposit !== undefined
              ? String(account.puppy.deposit)
              : account.buyer.deposit_amount !== null && account.buyer.deposit_amount !== undefined
                ? String(account.buyer.deposit_amount)
                : "",
          balance:
            account.puppy?.balance !== null && account.puppy?.balance !== undefined
              ? String(account.puppy.balance)
              : "",
          puppy_status: account.puppy?.status || "",
          finance_enabled: toYesNo(account.buyer.finance_enabled),
          finance_admin_fee: toYesNo(account.buyer.finance_admin_fee),
          finance_rate:
            account.buyer.finance_rate !== null && account.buyer.finance_rate !== undefined
              ? String(account.buyer.finance_rate)
              : "",
          finance_months:
            account.buyer.finance_months !== null && account.buyer.finance_months !== undefined
              ? String(account.buyer.finance_months)
              : "",
          finance_monthly_amount:
            account.buyer.finance_monthly_amount !== null &&
            account.buyer.finance_monthly_amount !== undefined
              ? String(account.buyer.finance_monthly_amount)
              : "",
          finance_next_due_date: account.buyer.finance_next_due_date || "",
        };

        const balanceSummary = calculateBalanceSummary(account, syntheticForm);
        const insight = buildAccountInsight(account, balanceSummary);
        return [account.key, { balanceSummary, insight }] as const;
      })
    );
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();

    let next = accounts.filter((account) => {
      const haystack = [
        account.buyer.full_name,
        account.buyer.name,
        account.buyer.email,
        account.buyer.phone,
        account.buyer.status,
        puppyName(account.puppy),
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      if (q && !haystack.includes(q)) return false;

      const ledger = accountLedgerMap.get(account.key);
      const summary = ledger?.balanceSummary;
      const insight = ledger?.insight;

      if (!summary || !insight) return true;

      if (showOnlyOpenBalances && summary.balance <= 0) return false;

      switch (filterMode) {
        case "financing":
          return summary.financeEnabled;
        case "with-balance":
          return summary.balance > 0;
        case "overdue":
          return insight.isOverdue;
        case "due-soon":
          return insight.isDueSoon;
        case "zoho":
          return insight.hasZoho;
        case "manual-only":
          return !insight.hasZoho;
        case "all":
        default:
          return true;
      }
    });

    next = [...next].sort((left, right) => {
      const leftLedger = accountLedgerMap.get(left.key);
      const rightLedger = accountLedgerMap.get(right.key);

      const leftSummary = leftLedger?.balanceSummary;
      const rightSummary = rightLedger?.balanceSummary;
      const leftInsight = leftLedger?.insight;
      const rightInsight = rightLedger?.insight;

      switch (sortMode) {
        case "balance-asc":
          return (leftSummary?.balance || 0) - (rightSummary?.balance || 0);
        case "balance-desc":
          return (rightSummary?.balance || 0) - (leftSummary?.balance || 0);
        case "name-asc":
          return buyerDisplayName(left).localeCompare(buyerDisplayName(right));
        case "last-payment-desc": {
          const leftTime = new Date(left.lastPaymentAt || 0).getTime();
          const rightTime = new Date(right.lastPaymentAt || 0).getTime();
          return rightTime - leftTime;
        }
        case "next-due-asc": {
          const leftDue =
            leftInsight?.daysUntilDue !== null && leftInsight?.daysUntilDue !== undefined
              ? leftInsight.daysUntilDue
              : Number.POSITIVE_INFINITY;
          const rightDue =
            rightInsight?.daysUntilDue !== null && rightInsight?.daysUntilDue !== undefined
              ? rightInsight.daysUntilDue
              : Number.POSITIVE_INFINITY;
          return leftDue - rightDue;
        }
        default:
          return 0;
      }
    });

    return next;
  }, [accountLedgerMap, accounts, filterMode, search, showOnlyOpenBalances, sortMode]);

  const selectedAccount =
    filteredAccounts.find((account) => account.key === selectedKey) ||
    accounts.find((account) => account.key === selectedKey) ||
    null;

  const requestedAccountKey = useMemo(() => {
    if (!requestedBuyerId) return "";
    return accounts.find((account) => String(account.buyer.id) === requestedBuyerId)?.key || "";
  }, [accounts, requestedBuyerId]);

  useEffect(() => {
    if (!requestedBuyerId) {
      setHandledQuerySelection("");
      return;
    }
    if (!requestedAccountKey || handledQuerySelection === requestedAccountKey) return;
    setSelectedKey(requestedAccountKey);
    setHandledQuerySelection(requestedAccountKey);
  }, [handledQuerySelection, requestedAccountKey, requestedBuyerId]);

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
          : selectedAccount.buyer.deposit_amount !== null &&
              selectedAccount.buyer.deposit_amount !== undefined
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
        selectedAccount.buyer.finance_months !== null &&
        selectedAccount.buyer.finance_months !== undefined
          ? String(selectedAccount.buyer.finance_months)
          : "",
      finance_monthly_amount:
        selectedAccount.buyer.finance_monthly_amount !== null &&
        selectedAccount.buyer.finance_monthly_amount !== undefined
          ? String(selectedAccount.buyer.finance_monthly_amount)
          : "",
      finance_next_due_date: selectedAccount.buyer.finance_next_due_date || "",
    });
    setEntryMode("payment");
    setEntryForm(entryFormForMode("payment"));
    setStatusText("");
    setEntryStatusText("");
  }, [selectedAccount]);

  const balanceSummary = useMemo(
    () => (selectedAccount ? calculateBalanceSummary(selectedAccount, form) : null),
    [form, selectedAccount]
  );

  const accountInsight = useMemo(() => {
    if (!selectedAccount || !balanceSummary) return null;
    return buildAccountInsight(selectedAccount, balanceSummary);
  }, [balanceSummary, selectedAccount]);

  const accountActivity = useMemo(
    () => (selectedAccount ? buildAccountActivity(selectedAccount) : []),
    [selectedAccount]
  );

  const collectionStats = useMemo(() => {
    let overdue = 0;
    let dueSoon = 0;
    let outstanding = 0;
    let paidOff = 0;

    for (const account of accounts) {
      const ledger = accountLedgerMap.get(account.key);
      if (!ledger) continue;

      if (ledger.balanceSummary.balance > 0) outstanding += 1;
      if (ledger.balanceSummary.balance <= 0) paidOff += 1;
      if (ledger.insight.isOverdue) overdue += 1;
      if (ledger.insight.isDueSoon) dueSoon += 1;
    }

    return { overdue, dueSoon, outstanding, paidOff };
  }, [accountLedgerMap, accounts]);

  async function refreshAccounts(nextSelectedKey?: string) {
    const nextAccounts = await fetchPaymentAccounts(accessToken);
    setAccounts(nextAccounts);
    setSelectedKey(
      nextSelectedKey ||
        nextAccounts.find((account) => account.key === selectedKey)?.key ||
        nextAccounts[0]?.key ||
        ""
    );
  }

  async function refreshIntegrationGroups() {
    setIntegrationLoading(true);
    setIntegrationStatusText("");

    try {
      const nextGroups = await fetchIntegrationStatus(accessToken);
      setIntegrationGroups(nextGroups);
      setIntegrationStatusText("Integration status refreshed.");
    } catch (error) {
      console.error(error);
      setIntegrationStatusText("Could not refresh integration status.");
    } finally {
      setIntegrationLoading(false);
    }
  }

  function setEntryModeAndReset(mode: EntryMode) {
    setEntryMode(mode);
    setEntryForm(entryFormForMode(mode));
    setEntryStatusText("");
  }

  async function handleSave() {
    if (!selectedAccount || !balanceSummary) return;

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
          balance: balanceSummary.balance,
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

  async function logAccountEntry() {
    if (!selectedAccount) return;

    setLoggingEntry(true);
    setEntryStatusText("");

    try {
      const isPayment = entryMode === "payment";
      const response = await fetch("/api/admin/portal/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(
          isPayment
            ? {
                entry_kind: "payment",
                buyer_id: selectedAccount.buyer.id,
                puppy_id: selectedAccount.puppy?.id || null,
                payment_date: entryForm.entry_date,
                amount: entryForm.amount,
                payment_type: entryForm.payment_type,
                method: entryForm.method,
                status: entryForm.status,
                reference_number: entryForm.reference_number,
                note: entryForm.note,
              }
            : {
                entry_kind: "adjustment",
                buyer_id: selectedAccount.buyer.id,
                puppy_id: selectedAccount.puppy?.id || null,
                entry_date: entryForm.entry_date,
                amount: entryForm.amount,
                entry_type: entryForm.entry_type,
                label: entryForm.label,
                description: entryForm.description,
                status: entryForm.status,
                reference_number: entryForm.reference_number,
              }
        ),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not save the account entry.");
      }

      await refreshAccounts(selectedAccount.key);
      setEntryForm(entryFormForMode(entryMode));
      setEntryStatusText(
        isPayment
          ? "Payment recorded."
          : entryMode === "credit"
            ? "Credit recorded."
            : entryMode === "transportation"
              ? "Transportation fee recorded."
              : "Fee recorded."
      );
    } catch (error) {
      console.error(error);
      setEntryStatusText(
        error instanceof Error ? error.message : "Could not save the account entry."
      );
    } finally {
      setLoggingEntry(false);
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">
        Loading payments...
      </div>
    );
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
        details="Only the approved owner emails can manage balances, fees, credits, transportation charges, and finance settings here."
      />
    );
  }

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-12">
        <AdminPageHero
          eyebrow="Payments"
          title="Financial control center for buyer balances, financing, collections, and ledger activity."
          description="Review account health, surface overdue families, adjust terms, record payments, and keep the buyer-facing ledger accurate and court-ready."
          actions={
            <>
              <AdminHeroPrimaryAction href="/admin/portal/buyers">Open Buyers</AdminHeroPrimaryAction>
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
                label="Outstanding"
                value={String(collectionStats.outstanding)}
                detail="Accounts with an open balance still remaining."
              />
            </div>
          }
        />

        <AdminPanel
          title="Collections Overview"
          subtitle="This turns the payments page into a real operating surface by showing which accounts need attention first."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminInfoTile
              label="Overdue"
              value={String(collectionStats.overdue)}
              detail="Accounts whose next due date has already passed and still carry an open balance."
            />
            <AdminInfoTile
              label="Due Soon"
              value={String(collectionStats.dueSoon)}
              detail="Accounts due within the next 7 days."
            />
            <AdminInfoTile
              label="Outstanding"
              value={String(collectionStats.outstanding)}
              detail="Total buyer ledgers with money still owed."
            />
            <AdminInfoTile
              label="Paid Off"
              value={String(collectionStats.paidOff)}
              detail="Accounts whose ledger currently shows no remaining balance."
            />
          </div>
        </AdminPanel>

        <AdminPanel
          title="Integration Status"
          subtitle="This checks runtime configuration only. It confirms whether the payment-link, subscription, email, and reminder-cron env groups are present without exposing any secret values."
          action={
            <button
              type="button"
              onClick={() => void refreshIntegrationGroups()}
              disabled={integrationLoading}
              className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[0_12px_28px_rgba(106,76,45,0.08)] transition hover:border-[var(--portal-border-strong)] disabled:opacity-60"
            >
              {integrationLoading ? "Refreshing..." : "Refresh Status"}
            </button>
          }
        >
          {integrationStatusText ? (
            <div className="mb-4 rounded-[18px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--portal-text-soft)]">
              {integrationStatusText}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {integrationGroups.length ? (
              integrationGroups.map((group) => (
                <AdminInfoTile
                  key={group.id}
                  label={group.label}
                  value={group.ready ? "Ready" : "Needs Setup"}
                  detail={
                    group.ready
                      ? group.summary
                      : `${group.summary} Missing: ${group.missing.join(", ")}.`
                  }
                />
              ))
            ) : (
              <div className="md:col-span-2 xl:col-span-4">
                <AdminEmptyState
                  title="Integration status unavailable"
                  description="Refresh the panel to check which payment and notice integrations are configured in the current environment."
                />
              </div>
            )}
          </div>
        </AdminPanel>

        <AdminPanel
          title="Finance Bench"
          subtitle="The buyer ledger should surface collection workload, plan management, risk visibility, and manual entry volume at a glance."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminInfoTile
              label="Buyer Ledgers"
              value={String(accounts.length)}
              detail="Families currently available for payment review, collection, and ledger cleanup."
            />
            <AdminInfoTile
              label="Recorded Payments"
              value={String(accounts.reduce((sum, account) => sum + account.payments.length, 0))}
              detail="All posted buyer payment entries across deposits, installments, and payoff activity."
            />
            <AdminInfoTile
              label="Manual Entries"
              value={String(accounts.reduce((sum, account) => sum + account.adjustments.length, 0))}
              detail="Fees, credits, and transportation-related adjustments already logged to buyer accounts."
            />
            <AdminInfoTile
              label="Financing Plans"
              value={String(accounts.filter((account) => account.buyer.finance_enabled).length)}
              detail={`${filteredAccounts.length} buyer cards match the current search and filter state.`}
            />
          </div>
        </AdminPanel>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
          <AdminPanel
            title="Buyer Payment Cards"
            subtitle="Search, filter, and sort by balance risk, due dates, financing, Zoho usage, and collection urgency."
          >
            <div className="space-y-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search buyers, email, phone, or puppy..."
                className="w-full rounded-[20px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3 text-sm text-[var(--portal-text)] outline-none focus:border-[#c8a884]"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <PaymentSelect
                  label="Filter"
                  value={filterMode}
                  onChange={(value) => setFilterMode(value as FilterMode)}
                  options={[
                    { value: "all", label: "All Accounts" },
                    { value: "financing", label: "Financing" },
                    { value: "with-balance", label: "With Balance" },
                    { value: "overdue", label: "Overdue" },
                    { value: "due-soon", label: "Due Soon" },
                    { value: "zoho", label: "Zoho Payments" },
                    { value: "manual-only", label: "Manual Only" },
                  ]}
                />
                <PaymentSelect
                  label="Sort"
                  value={sortMode}
                  onChange={(value) => setSortMode(value as SortMode)}
                  options={[
                    { value: "balance-desc", label: "Balance High to Low" },
                    { value: "balance-asc", label: "Balance Low to High" },
                    { value: "name-asc", label: "Buyer Name" },
                    { value: "last-payment-desc", label: "Latest Payment" },
                    { value: "next-due-asc", label: "Next Due Date" },
                  ]}
                />
              </div>

              <label className="flex items-center gap-3 rounded-[18px] border border-[var(--portal-border)] bg-[#fffaf5] px-4 py-3 text-sm font-medium text-[var(--portal-text)]">
                <input
                  type="checkbox"
                  checked={showOnlyOpenBalances}
                  onChange={(e) => setShowOnlyOpenBalances(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--portal-border)] text-[#b5752f] focus:ring-[#d3a056]"
                />
                Show only accounts with an open balance
              </label>
            </div>

            <div className="mt-4 space-y-3">
              {filteredAccounts.length ? (
                filteredAccounts.map((account) => {
                  const ledger = accountLedgerMap.get(account.key);
                  const summary = ledger?.balanceSummary;
                  const insight = ledger?.insight;

                  return (
                    <AdminListCard
                      key={account.key}
                      selected={selectedKey === account.key}
                      onClick={() => setSelectedKey(account.key)}
                      title={buyerDisplayName(account)}
                      subtitle={`${account.buyer.email || "No email"} • ${puppyName(account.puppy)}`}
                      meta={
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[var(--portal-text-soft)]">
                            <span>{fmtMoney(summary?.balance || 0)} balance</span>
                            <span>•</span>
                            <span>{insight?.nextDueLabel || "No due date saved"}</span>
                          </div>

                          <div className="h-2 overflow-hidden rounded-full bg-[#efe4d5]">
                            <div
                              className="h-full rounded-full bg-[linear-gradient(90deg,#d3a056_0%,#b5752f_100%)] transition-all"
                              style={{ width: `${insight?.percentPaid || 0}%` }}
                            />
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span
                              className={[
                                "inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                                insight?.collectionTone ||
                                  "border-[var(--portal-border)] bg-white text-[var(--portal-text-soft)]",
                              ].join(" ")}
                            >
                              {insight?.statusLabel || "Stable"}
                            </span>

                            {summary?.financeEnabled ? (
                              <span className="inline-flex rounded-full border border-[rgba(92,123,214,0.2)] bg-[rgba(243,246,255,0.95)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5c7bd6]">
                                Financing
                              </span>
                            ) : null}

                            {insight?.hasZoho ? (
                              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                                Zoho
                              </span>
                            ) : null}
                          </div>
                        </div>
                      }
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
                  );
                })
              ) : (
                <AdminEmptyState
                  title="No buyer payment records matched your filters"
                  description="Try another buyer name, puppy name, email, filter, or sort combination."
                />
              )}
            </div>
          </AdminPanel>

          {selectedAccount && balanceSummary && accountInsight ? (
            <div className="space-y-6">
              <AdminPanel
                title="Financial Snapshot"
                subtitle="A clean read of the selected buyer's pricing, financing, payments, due-date pressure, and manual ledger adjustments."
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                  <AdminInfoTile
                    label="Buyer"
                    value={buyerDisplayName(selectedAccount)}
                  />
                  <AdminInfoTile label="My Puppy" value={puppyName(selectedAccount.puppy)} />
                  <AdminInfoTile
                    label="Payments"
                    value={fmtMoney(balanceSummary.paymentsApplied)}
                    detail={`${selectedAccount.payments.length} payment record(s)`}
                  />
                  <AdminInfoTile
                    label="Fees"
                    value={fmtMoney(balanceSummary.adjustmentCharges)}
                    detail="Manual fees and transportation charges."
                  />
                  <AdminInfoTile
                    label="Credits"
                    value={fmtMoney(balanceSummary.adjustmentCredits)}
                    detail="Credits or discounts recorded separately from payments."
                  />
                  <AdminInfoTile
                    label="Balance"
                    value={fmtMoney(balanceSummary.balance)}
                    detail="Automatically recalculated from the full account ledger."
                  />
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-[20px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,#fffdfb_0%,#f8efe4_100%)] px-4 py-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                      Account Health
                    </div>
                    <div className="mt-2 text-lg font-semibold text-[var(--portal-text)]">
                      {accountInsight.statusLabel}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                      {accountInsight.accountHeadline}
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-[rgba(47,143,103,0.18)] bg-[linear-gradient(180deg,rgba(246,253,249,0.98)_0%,rgba(240,249,245,0.94)_100%)] px-4 py-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#4d8a6d]">
                      Zoho Receipts
                    </div>
                    <div className="mt-2 text-lg font-semibold text-[#275f47]">
                      {countZohoPayments(selectedAccount)} synced payment{countZohoPayments(selectedAccount) === 1 ? "" : "s"}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-[#3f735a]">
                      Payments completed through Zoho and written back into this buyer ledger.
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                      Next Due
                    </div>
                    <div className="mt-2 text-lg font-semibold text-[var(--portal-text)]">
                      {accountInsight.nextDueLabel}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                      {balanceSummary.nextDueDate
                        ? `Saved next due date: ${fmtDate(balanceSummary.nextDueDate)}`
                        : "No due date is currently saved for this account."}
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-[22px] border border-[var(--portal-border)] bg-white px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                        Payment Progress
                      </div>
                      <div className="mt-1 text-sm font-semibold text-[var(--portal-text)]">
                        {accountInsight.percentPaid.toFixed(0)}% satisfied
                      </div>
                    </div>
                    <div
                      className={[
                        "inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                        accountInsight.collectionTone,
                      ].join(" ")}
                    >
                      {accountInsight.collectionLabel}
                    </div>
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#efe4d5]">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#d3a056_0%,#b5752f_100%)] transition-all"
                      style={{ width: `${accountInsight.percentPaid}%` }}
                    />
                  </div>
                </div>
              </AdminPanel>

              <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.05fr)_420px]">
                <div className="space-y-6">
                  <AdminPanel
                    title="Payment Settings"
                    subtitle="Edit price, deposit, puppy status, and financing details. Balance is calculated automatically from the itemized account record."
                  >
                    {statusText ? (
                      <div className="mb-4 rounded-[18px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--portal-text-soft)]">
                        {statusText}
                      </div>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-2">
                      <PaymentField
                        label="Price"
                        value={form.price}
                        onChange={(value) => setForm((prev) => ({ ...prev, price: value }))}
                      />
                      <PaymentField
                        label="Deposit"
                        value={form.deposit}
                        onChange={(value) => setForm((prev) => ({ ...prev, deposit: value }))}
                      />
                      <PaymentField
                        label="Balance"
                        value={String(balanceSummary.balance.toFixed(2))}
                        readOnly
                        detail={`Auto-calculated from charges ${fmtMoney(balanceSummary.totalCharges)} minus credits ${fmtMoney(balanceSummary.totalCredits)}.`}
                      />
                      <PaymentField
                        label="Puppy Status"
                        value={form.puppy_status}
                        onChange={(value) => setForm((prev) => ({ ...prev, puppy_status: value }))}
                      />
                      <PaymentSelect
                        label="Financing Enabled"
                        value={form.finance_enabled}
                        onChange={(value) => setForm((prev) => ({ ...prev, finance_enabled: value }))}
                      />
                      <PaymentSelect
                        label="Admin Fee"
                        value={form.finance_admin_fee}
                        onChange={(value) => setForm((prev) => ({ ...prev, finance_admin_fee: value }))}
                      />
                      <PaymentField
                        label="APR / Rate"
                        value={form.finance_rate}
                        onChange={(value) => setForm((prev) => ({ ...prev, finance_rate: value }))}
                      />
                      <PaymentField
                        label="Finance Months"
                        value={form.finance_months}
                        onChange={(value) => setForm((prev) => ({ ...prev, finance_months: value }))}
                      />
                      <PaymentField
                        label="Monthly Amount"
                        value={form.finance_monthly_amount}
                        onChange={(value) => setForm((prev) => ({ ...prev, finance_monthly_amount: value }))}
                      />
                      <PaymentDateField
                        label="Next Due Date"
                        value={form.finance_next_due_date}
                        onChange={(value) => setForm((prev) => ({ ...prev, finance_next_due_date: value }))}
                      />
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
                    title="Itemized Account Activity"
                    subtitle="Payments, fees, credits, and transportation charges stay together in one chronological record with source visibility."
                  >
                    <div className="space-y-3">
                      {accountActivity.length ? (
                        accountActivity.map((entry) => (
                          <div
                            key={entry.key}
                            className="rounded-[22px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2e9_100%)] p-4 shadow-[0_10px_24px_rgba(106,76,45,0.05)]"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-[var(--portal-text)]">
                                  {entry.title} • {fmtMoney(entry.amount)}
                                </div>
                                <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                                  {fmtDate(entry.date)} • {entry.kind === "payment" ? "payment entry" : "manual adjustment"}
                                </div>
                              </div>
                              <span
                                className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(
                                  entry.status
                                )}`}
                              >
                                {entry.status}
                              </span>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="inline-flex rounded-full border border-[var(--portal-border)] bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                                {entry.sourceLabel}
                              </span>
                              {entry.isZoho ? (
                                <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                                  Customer paid you
                                </span>
                              ) : null}
                              {entry.isPortalLinked ? (
                                <span className="inline-flex rounded-full border border-[rgba(92,123,214,0.2)] bg-[rgba(243,246,255,0.95)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5c7bd6]">
                                  Portal synced
                                </span>
                              ) : null}
                            </div>

                            {entry.referenceNumber ? (
                              <div className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                                Ref: {entry.referenceNumber}
                              </div>
                            ) : null}

                            {entry.detail ? (
                              <div className="mt-3 text-sm leading-6 text-[var(--portal-text-soft)]">
                                {entry.detail}
                              </div>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <AdminEmptyState
                          title="No account activity yet"
                          description="Recorded payments, fees, credits, and transportation charges will appear here."
                        />
                      )}
                    </div>
                  </AdminPanel>
                </div>

                <div className="space-y-6">
                  <AdminPanel
                    title="Add Account Entry"
                    subtitle="Choose the kind of entry you want to record for this buyer account."
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      <EntryModeButton
                        active={entryMode === "payment"}
                                                label="Add Payment"
                        onClick={() => setEntryModeAndReset("payment")}
                      />
                      <EntryModeButton
                        active={entryMode === "fee"}
                        label="Add Fee"
                        onClick={() => setEntryModeAndReset("fee")}
                      />
                      <EntryModeButton
                        active={entryMode === "credit"}
                        label="Add Credit"
                        onClick={() => setEntryModeAndReset("credit")}
                      />
                      <EntryModeButton
                        active={entryMode === "transportation"}
                        label="Add Transportation"
                        onClick={() => setEntryModeAndReset("transportation")}
                      />
                    </div>

                    {entryStatusText ? (
                      <div className="mt-4 rounded-[18px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--portal-text-soft)]">
                        {entryStatusText}
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-4">
                      <PaymentDateField
                        label={entryMode === "payment" ? "Payment Date" : "Entry Date"}
                        value={entryForm.entry_date}
                        onChange={(value) =>
                          setEntryForm((prev) => ({ ...prev, entry_date: value }))
                        }
                      />
                      <PaymentField
                        label="Amount"
                        value={entryForm.amount}
                        onChange={(value) =>
                          setEntryForm((prev) => ({ ...prev, amount: value }))
                        }
                      />

                      {entryMode === "payment" ? (
                        <>
                          <PaymentField
                            label="Payment Type"
                            value={entryForm.payment_type}
                            onChange={(value) =>
                              setEntryForm((prev) => ({ ...prev, payment_type: value }))
                            }
                          />
                          <PaymentField
                            label="Method"
                            value={entryForm.method}
                            onChange={(value) =>
                              setEntryForm((prev) => ({ ...prev, method: value }))
                            }
                          />
                        </>
                      ) : (
                        <>
                          <PaymentSelect
                            label="Entry Type"
                            value={entryForm.entry_type}
                            options={[
                              { value: "fee", label: "Fee" },
                              { value: "credit", label: "Credit" },
                              { value: "transportation", label: "Transportation Fee" },
                            ]}
                            onChange={(value) => {
                              setEntryForm((prev) => ({
                                ...prev,
                                entry_type: value,
                                label:
                                  value === "transportation"
                                    ? "Transportation Fee"
                                    : value === "credit"
                                      ? "Credit"
                                      : prev.label || "Fee",
                              }));
                            }}
                          />
                          <PaymentField
                            label="Label"
                            value={entryForm.label}
                            onChange={(value) =>
                              setEntryForm((prev) => ({ ...prev, label: value }))
                            }
                          />
                        </>
                      )}

                      <PaymentField
                        label="Status"
                        value={entryForm.status}
                        onChange={(value) =>
                          setEntryForm((prev) => ({ ...prev, status: value }))
                        }
                      />
                      <PaymentField
                        label="Reference Number"
                        value={entryForm.reference_number}
                        onChange={(value) =>
                          setEntryForm((prev) => ({ ...prev, reference_number: value }))
                        }
                      />

                      <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                        {entryMode === "payment" ? "Note" : "Description"}
                        <textarea
                          value={entryMode === "payment" ? entryForm.note : entryForm.description}
                          onChange={(e) =>
                            setEntryForm((prev) => ({
                              ...prev,
                              [entryMode === "payment" ? "note" : "description"]: e.target.value,
                            }))
                          }
                          rows={5}
                          className="mt-2 w-full rounded-[18px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3.5 text-sm text-[var(--portal-text)] outline-none focus:border-[#c8a884]"
                        />
                      </label>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void logAccountEntry()}
                        disabled={loggingEntry}
                        className="rounded-2xl bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(181,117,47,0.26)] transition hover:brightness-105 disabled:opacity-60"
                      >
                        {loggingEntry
                          ? "Saving..."
                          : entryMode === "payment"
                            ? "Record Payment"
                            : entryMode === "credit"
                              ? "Record Credit"
                              : entryMode === "transportation"
                                ? "Record Transportation Fee"
                                : "Record Fee"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEntryForm(entryFormForMode(entryMode));
                          setEntryStatusText("");
                        }}
                        className="rounded-2xl border border-[var(--portal-border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[0_12px_28px_rgba(106,76,45,0.08)] transition hover:border-[var(--portal-border-strong)]"
                      >
                        Reset
                      </button>
                    </div>
                  </AdminPanel>

                  <AdminPanel
                    title="Financing Breakdown"
                    subtitle="This shows exactly how the selected buyer balance is being calculated, including plan totals, fees, credits, and payment progress."
                  >
                    <div className="grid gap-4">
                      <AdminInfoTile
                        label="Purchase Price"
                        value={fmtMoney(balanceSummary.price)}
                        detail="Saved sale price for the buyer account."
                      />
                      <AdminInfoTile
                        label="Deposit"
                        value={fmtMoney(balanceSummary.deposit)}
                        detail="Deposit already applied before financing and later payments."
                      />
                      <AdminInfoTile
                        label="Principal After Deposit"
                        value={fmtMoney(balanceSummary.principalAfterDeposit)}
                        detail="Base principal remaining after subtracting the deposit."
                      />
                      <AdminInfoTile
                        label="Plan Base Total"
                        value={fmtMoney(balanceSummary.financeBaseTotal)}
                        detail={
                          balanceSummary.financeEnabled
                            ? "Financing-adjusted total before manual fees, transportation, and credits."
                            : "Base total before manual fees, transportation, and credits."
                        }
                      />
                      <AdminInfoTile
                        label="Finance Uplift"
                        value={
                          balanceSummary.financeUplift > 0
                            ? fmtMoney(balanceSummary.financeUplift)
                            : "$0.00"
                        }
                        detail={
                          balanceSummary.financeEnabled
                            ? `${balanceSummary.apr !== null ? `${balanceSummary.apr}% APR` : "APR not listed"}${
                                balanceSummary.adminFeeEnabled ? " • admin fee enabled." : "."
                              }`
                            : "No financing uplift is currently being added."
                        }
                      />
                      <AdminInfoTile
                        label="Monthly Payment"
                        value={
                          balanceSummary.monthlyAmount !== null
                            ? fmtMoney(balanceSummary.monthlyAmount)
                            : "Not listed"
                        }
                        detail={
                          balanceSummary.financeMonths !== null
                            ? `${balanceSummary.financeMonths} month plan`
                            : "Plan length not listed"
                        }
                      />
                      <AdminInfoTile
                        label="Plan Total"
                        value={
                          balanceSummary.planTotal !== null
                            ? fmtMoney(balanceSummary.planTotal)
                            : "Not calculated"
                        }
                        detail="The total plan amount based on the financing terms saved on this account."
                      />
                      <AdminInfoTile
                        label="Manual Fees & Transportation"
                        value={fmtMoney(balanceSummary.adjustmentCharges)}
                        detail="Manual fees and transportation charges recorded to the account."
                      />
                      <AdminInfoTile
                        label="Manual Credits"
                        value={fmtMoney(balanceSummary.adjustmentCredits)}
                        detail="Credits or discounts recorded separately from payments."
                      />
                      <AdminInfoTile
                        label="Payments Applied"
                        value={fmtMoney(balanceSummary.paymentsApplied)}
                        detail="Recorded payments currently reducing the balance."
                      />
                      <AdminInfoTile
                        label="Current Balance"
                        value={fmtMoney(balanceSummary.balance)}
                        detail={
                          balanceSummary.nextDueDate
                            ? `Next due ${fmtDate(balanceSummary.nextDueDate)}`
                            : "No next due date saved"
                        }
                      />
                      <AdminInfoTile
                        label="Last Payment"
                        value={
                          selectedAccount.lastPaymentAt
                            ? fmtDate(selectedAccount.lastPaymentAt)
                            : "No payment recorded"
                        }
                        detail="Most recent payment date found on this buyer account."
                      />
                    </div>
                  </AdminPanel>
                </div>
              </section>
            </div>
          ) : (
            <AdminPanel title="Financial Snapshot" subtitle="Choose a buyer card to begin.">
              <AdminEmptyState
                title="No buyer selected"
                description="Choose a buyer card from the left to review payment settings, collection status, account entries, and financing details."
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
    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
      {label}
      <input
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        className={`mt-2 w-full rounded-[18px] border px-4 py-3.5 text-sm normal-case tracking-normal text-[var(--portal-text)] outline-none ${
          readOnly
            ? "border-[var(--portal-border)] bg-[#f8f1e7]"
            : "border-[var(--portal-border)] bg-[#fffdfb] focus:border-[#c8a884]"
        }`}
      />
      {detail ? (
        <div className="mt-2 text-[12px] normal-case tracking-normal text-[var(--portal-text-soft)]">
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
    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-[18px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3.5 text-sm normal-case tracking-normal text-[var(--portal-text)] outline-none focus:border-[#c8a884]"
      />
    </label>
  );
}

function PaymentSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options?: Array<{ value: string; label: string }>;
}) {
  const selectOptions =
    options ||
    [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ];

  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-[18px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3.5 text-sm normal-case tracking-normal text-[var(--portal-text)] outline-none focus:border-[#c8a884]"
      >
        {selectOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EntryModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-[18px] border px-4 py-3 text-sm font-semibold transition",
        active
          ? "border-[#d8b48b] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2e9_100%)] text-[var(--portal-text)] shadow-[0_12px_30px_rgba(106,76,45,0.08)]"
          : "border-[var(--portal-border)] bg-[#fffaf5] text-[var(--portal-text-soft)] hover:border-[#d8b48b] hover:bg-white",
      ].join(" ")}
    >
      {label}
    </button>
  );
} 