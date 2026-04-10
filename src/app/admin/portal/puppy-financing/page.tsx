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
import { fmtMoney, sb } from "@/lib/utils";
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
  linkedPuppies?: PuppyRow[];
  payments: BuyerPayment[];
  adjustments: BuyerAdjustment[];
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

type AdjustmentForm = {
  entry_date: string;
  amount: string;
  entry_type: "fee" | "credit";
  label: string;
  description: string;
  status: string;
  reference_number: string;
};

type FinancingFilter = "all" | "enabled" | "draft" | "inactive";

type PlannerAccount = {
  key: string;
  buyer: BuyerRow;
  puppy: PuppyRow | null;
  linkedPuppies: PuppyRow[];
  payments: BuyerPayment[];
  adjustments: BuyerAdjustment[];
  totalPaid: number;
  lastPaymentAt: string | null;
};

type BalanceSummary = {
  price: number;
  deposit: number;
  principalAfterDeposit: number;
  paymentsApplied: number;
  adjustmentCharges: number;
  adjustmentCredits: number;
  adminFeeCharges: number;
  totalCharges: number;
  totalCredits: number;
  balance: number;
  apr: number | null;
  financeEnabled: boolean;
  adminFeeEnabled: boolean;
  financeMonths: number | null;
  monthlyAmount: number | null;
  recommendedMonthlyAmount: number | null;
  previewMonthlyAmount: number | null;
  planTotal: number | null;
  financeUplift: number;
  nextDueDate: string | null;
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
};

type PaymentNoticeSettings = {
  enabled: boolean;
  receipt_enabled: boolean;
  due_reminder_enabled: boolean;
  due_reminder_days_before: number;
  late_notice_enabled: boolean;
  late_notice_days_after: number;
  default_notice_enabled: boolean;
  default_notice_days_after: number;
  recipient_email?: string | null;
  cc_emails?: string[] | null;
  internal_note?: string | null;
};

type PaymentNoticeLog = {
  id: number;
  created_at: string;
  notice_kind: string;
  notice_date?: string | null;
  due_date?: string | null;
  recipient_email: string;
  subject: string;
  status: string;
};

type NoticeSettingsForm = {
  enabled: string;
  receipt_enabled: string;
  due_reminder_enabled: string;
  due_reminder_days_before: string;
  late_notice_enabled: string;
  late_notice_days_after: string;
  default_notice_enabled: string;
  default_notice_days_after: string;
  recipient_email: string;
  cc_emails: string;
  internal_note: string;
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

function emptyNoticeSettingsForm(): NoticeSettingsForm {
  return {
    enabled: "yes",
    receipt_enabled: "yes",
    due_reminder_enabled: "yes",
    due_reminder_days_before: "5",
    late_notice_enabled: "yes",
    late_notice_days_after: "3",
    default_notice_enabled: "yes",
    default_notice_days_after: "14",
    recipient_email: "",
    cc_emails: "",
    internal_note: "",
  };
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

function formatShortDate(value: string | null | undefined) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatNoticeKindLabel(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "due_reminder") return "Due Reminder";
  if (normalized === "late_notice") return "Late Notice";
  if (normalized === "default_notice") return "Default Notice";
  if (normalized === "receipt") return "Receipt";
  return normalized ? normalized.replace(/_/g, " ") : "Notice";
}

function buyerName(buyer: BuyerRow) {
  return firstValue(buyer.full_name, buyer.name, buyer.email, `Buyer #${buyer.id}`);
}

function puppyName(puppy: PuppyRow | null) {
  return firstValue(puppy?.call_name, puppy?.puppy_name, puppy?.name, "Puppy not linked yet");
}

function linkedPuppyNames(account: PlannerAccount) {
  if (!account.linkedPuppies.length) return "No puppy linked yet";
  return account.linkedPuppies.map((row) => puppyName(row)).join(", ");
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

function isAdjustmentCredit(adjustment: BuyerAdjustment) {
  return String(adjustment.entry_type || "").trim().toLowerCase() === "credit";
}

function isAdminFeeAdjustment(adjustment: BuyerAdjustment) {
  const haystack = [adjustment.label, adjustment.description]
    .map((value) => String(value || "").trim().toLowerCase())
    .join(" ");
  return haystack.includes("admin fee");
}

function calculateSuggestedMonthlyAmount(
  principal: number,
  apr: number | null,
  months: number | null
) {
  if (!(principal > 0) || !(months && months > 0)) return null;

  const monthlyRate = Math.max(0, Number(apr || 0)) / 100 / 12;
  if (!monthlyRate) {
    return Number((principal / months).toFixed(2));
  }

  const payment =
    (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));

  if (!Number.isFinite(payment)) return null;
  return Number(payment.toFixed(2));
}

function financingStatus(account: PlannerAccount) {
  const enabled = Boolean(account.buyer.finance_enabled);
  const monthly = Number(account.buyer.finance_monthly_amount || 0);
  const months = Number(account.buyer.finance_months || 0);

  if (enabled && monthly > 0 && months > 0) return "enabled" as const;
  if (enabled) return "draft" as const;
  return "inactive" as const;
}

function financingStatusLabel(account: PlannerAccount) {
  const status = financingStatus(account);
  if (status === "enabled") return "Plan Ready";
  if (status === "draft") return "Needs Setup";
  return "Financing Off";
}

function flattenAccounts(accounts: BuyerAccount[]) {
  return accounts.flatMap<PlannerAccount>((account) => {
    const linkedPuppies = account.linkedPuppies || (account.puppy ? [account.puppy] : []);

    if (!linkedPuppies.length) {
      return [
        {
          key: `${account.buyer.id}-buyer`,
          buyer: account.buyer,
          puppy: null,
          linkedPuppies: [],
          payments: account.payments,
          adjustments: account.adjustments,
          totalPaid: account.totalPaid,
          lastPaymentAt: account.lastPaymentAt,
        },
      ];
    }

    return linkedPuppies.map((puppy) => ({
      key: `${account.buyer.id}-${puppy.id}`,
      buyer: account.buyer,
      puppy,
      linkedPuppies,
      payments: account.payments.filter((payment) => {
        if (payment.puppy_id) return Number(payment.puppy_id) === Number(puppy.id);
        return linkedPuppies.length <= 1;
      }),
      adjustments: account.adjustments.filter((adjustment) => {
        if (adjustment.puppy_id) return Number(adjustment.puppy_id) === Number(puppy.id);
        return linkedPuppies.length <= 1;
      }),
      totalPaid: account.totalPaid,
      lastPaymentAt: account.lastPaymentAt,
    }));
  });
}

function calculateBalanceSummary(account: PlannerAccount, form: EditForm): BalanceSummary {
  const price =
    toNumberOrNull(form.price) ?? account.puppy?.price ?? account.buyer.sale_price ?? 0;
  const deposit =
    toNumberOrNull(form.deposit) ?? account.puppy?.deposit ?? account.buyer.deposit_amount ?? 0;
  const principalAfterDeposit = Math.max(0, price - deposit);
  const paymentsApplied = account.payments
    .filter((payment) => paymentCountsTowardBalance(payment.status))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const adjustmentCharges = account.adjustments.reduce((sum, adjustment) => {
    if (!adjustmentCountsTowardBalance(adjustment.status) || isAdjustmentCredit(adjustment)) return sum;
    return sum + Math.abs(Number(adjustment.amount || 0));
  }, 0);
  const adjustmentCredits = account.adjustments.reduce((sum, adjustment) => {
    if (!adjustmentCountsTowardBalance(adjustment.status) || !isAdjustmentCredit(adjustment)) return sum;
    return sum + Math.abs(Number(adjustment.amount || 0));
  }, 0);
  const adminFeeCharges = account.adjustments.reduce((sum, adjustment) => {
    if (!adjustmentCountsTowardBalance(adjustment.status) || isAdjustmentCredit(adjustment)) return sum;
    if (!isAdminFeeAdjustment(adjustment)) return sum;
    return sum + Math.abs(Number(adjustment.amount || 0));
  }, 0);

  const financeEnabled = form.finance_enabled === "yes";
  const adminFeeEnabled = form.finance_admin_fee === "yes";
  const apr = toNumberOrNull(form.finance_rate);
  const financeMonths = toNumberOrNull(form.finance_months);
  const monthlyAmount = toNumberOrNull(form.finance_monthly_amount);
  const recommendedMonthlyAmount = calculateSuggestedMonthlyAmount(
    principalAfterDeposit,
    apr,
    financeMonths
  );
  const previewMonthlyAmount = monthlyAmount ?? recommendedMonthlyAmount;
  const rawPlanTotal =
    financeEnabled && previewMonthlyAmount !== null && financeMonths !== null
      ? previewMonthlyAmount * financeMonths
      : null;
  const planTotal = rawPlanTotal !== null ? Math.max(principalAfterDeposit, rawPlanTotal) : null;
  const financeBaseTotal = planTotal ?? principalAfterDeposit;
  const financeUplift = Math.max(0, financeBaseTotal - principalAfterDeposit);
  const totalCharges = financeBaseTotal + adjustmentCharges;
  const totalCredits = paymentsApplied + adjustmentCredits;
  const balance = Math.max(0, totalCharges - totalCredits);

  return {
    price,
    deposit,
    principalAfterDeposit,
    paymentsApplied,
    adjustmentCharges,
    adjustmentCredits,
    adminFeeCharges,
    totalCharges,
    totalCredits,
    balance,
    apr,
    financeEnabled,
    adminFeeEnabled,
    financeMonths,
    monthlyAmount,
    recommendedMonthlyAmount,
    previewMonthlyAmount,
    planTotal,
    financeUplift,
    nextDueDate: form.finance_next_due_date || null,
  };
}

function paymentTitle(payment: BuyerPayment) {
  return firstValue(payment.payment_type, "Payment");
}

function adjustmentTitle(adjustment: BuyerAdjustment) {
  return firstValue(
    adjustment.label,
    isAdjustmentCredit(adjustment) ? "Credit" : "Fee"
  );
}

function buildAccountActivity(account: PlannerAccount): AccountActivity[] {
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
    sourceLabel: "Payment",
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
    sourceLabel: isAdjustmentCredit(adjustment) ? "Credit" : "Adjustment",
  }));

  return [...paymentRows, ...adjustmentRows].sort((left, right) => {
    const leftTime = new Date(left.date).getTime();
    const rightTime = new Date(right.date).getTime();
    return rightTime - leftTime;
  });
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

export default function AdminPortalPuppyFinancingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingAdjustment, setLoggingAdjustment] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [adjustmentStatusText, setAdjustmentStatusText] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FinancingFilter>("all");
  const [accounts, setAccounts] = useState<PlannerAccount[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [requestedBuyerId, setRequestedBuyerId] = useState("");
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
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentForm>({
    entry_date: todayIso(),
    amount: "",
    entry_type: "fee",
    label: "Admin Fee",
    description: "",
    status: "recorded",
    reference_number: "",
  });
  const [noticeLoading, setNoticeLoading] = useState(false);
  const [noticeSaving, setNoticeSaving] = useState(false);
  const [noticeSending, setNoticeSending] = useState(false);
  const [noticeStatusText, setNoticeStatusText] = useState("");
  const [noticeLogs, setNoticeLogs] = useState<PaymentNoticeLog[]>([]);
  const [noticeForm, setNoticeForm] = useState<NoticeSettingsForm>(emptyNoticeSettingsForm());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setRequestedBuyerId(params.get("buyer") || "");
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const {
          data: { session },
        } = await sb.auth.getSession();

        if (!mounted) return;

        const nextUser = session?.user || null;
        const token = session?.access_token || "";
        setUser(nextUser);
        setAccessToken(token);

        if (nextUser && token) {
          const nextAccounts = flattenAccounts(await fetchPaymentAccounts(token));
          if (!mounted) return;
          setAccounts(nextAccounts);
          setSelectedKey(nextAccounts[0]?.key || "");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadSession();

    const { data: listener } = sb.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const nextUser = session?.user || null;
      const token = session?.access_token || "";
      setUser(nextUser);
      setAccessToken(token);

      if (nextUser && token) {
        void fetchPaymentAccounts(token).then((rows) => {
          if (!mounted) return;
          const nextAccounts = flattenAccounts(rows);
          setAccounts(nextAccounts);
          setSelectedKey(
            (previous) =>
              nextAccounts.find((account) => account.key === previous)?.key ||
              nextAccounts[0]?.key ||
              ""
          );
        });
      } else {
        setAccounts([]);
        setSelectedKey("");
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return accounts.filter((account) => {
      const state = financingStatus(account);
      if (filter !== "all" && state !== filter) return false;

      if (!query) return true;

      const haystack = [
        buyerName(account.buyer),
        account.buyer.email,
        linkedPuppyNames(account),
        account.puppy?.status,
        account.buyer.finance_next_due_date,
        account.buyer.finance_monthly_amount,
      ]
        .map((value) => String(value || "").trim().toLowerCase())
        .join(" ");

      return haystack.includes(query);
    });
  }, [accounts, filter, search]);

  useEffect(() => {
    if (!requestedBuyerId) return;
    const match = filteredAccounts.find((account) => String(account.buyer.id) === requestedBuyerId);
    if (match) {
      setSelectedKey(match.key);
    }
  }, [filteredAccounts, requestedBuyerId]);

  useEffect(() => {
    if (!filteredAccounts.length) {
      setSelectedKey("");
      return;
    }

    if (!filteredAccounts.some((account) => account.key === selectedKey)) {
      setSelectedKey(filteredAccounts[0]?.key || "");
    }
  }, [filteredAccounts, selectedKey]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.key === selectedKey) || null,
    [accounts, selectedKey]
  );

  useEffect(() => {
    if (!selectedAccount) return;

    setForm({
      price:
        selectedAccount.puppy?.price !== null && selectedAccount.puppy?.price !== undefined
          ? String(selectedAccount.puppy.price)
          : selectedAccount.buyer.sale_price !== null &&
              selectedAccount.buyer.sale_price !== undefined
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
        selectedAccount.buyer.finance_rate !== null &&
        selectedAccount.buyer.finance_rate !== undefined
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
    setAdjustmentForm({
      entry_date: todayIso(),
      amount: "",
      entry_type: "fee",
      label: "Admin Fee",
      description: "",
      status: "recorded",
      reference_number: "",
    });
    setStatusText("");
    setAdjustmentStatusText("");
  }, [selectedAccount]);

  useEffect(() => {
    if (!selectedAccount || !accessToken) {
      setNoticeLogs([]);
      setNoticeForm(emptyNoticeSettingsForm());
      return;
    }

    let cancelled = false;
    setNoticeLoading(true);
    setNoticeStatusText("");

    void fetch(`/api/admin/portal/payment-notices?buyer_id=${selectedAccount.buyer.id}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          ok?: boolean;
          error?: string;
          settings?: PaymentNoticeSettings;
          logs?: PaymentNoticeLog[];
        };

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Could not load email notice settings.");
        }

        if (cancelled) return;
        const settings = payload.settings;
        setNoticeForm({
          enabled: settings?.enabled === false ? "no" : "yes",
          receipt_enabled: settings?.receipt_enabled === false ? "no" : "yes",
          due_reminder_enabled: settings?.due_reminder_enabled === false ? "no" : "yes",
          due_reminder_days_before: String(settings?.due_reminder_days_before ?? 5),
          late_notice_enabled: settings?.late_notice_enabled === false ? "no" : "yes",
          late_notice_days_after: String(settings?.late_notice_days_after ?? 3),
          default_notice_enabled: settings?.default_notice_enabled === false ? "no" : "yes",
          default_notice_days_after: String(settings?.default_notice_days_after ?? 14),
          recipient_email: settings?.recipient_email || selectedAccount.buyer.email || "",
          cc_emails: Array.isArray(settings?.cc_emails) ? settings.cc_emails.join(", ") : "",
          internal_note: settings?.internal_note || "",
        });
        setNoticeLogs(Array.isArray(payload.logs) ? payload.logs : []);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error(error);
        setNoticeStatusText(
          error instanceof Error ? error.message : "Could not load email notice settings."
        );
        setNoticeLogs([]);
      })
      .finally(() => {
        if (!cancelled) {
          setNoticeLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, selectedAccount]);

  const balanceSummary = useMemo(
    () => (selectedAccount ? calculateBalanceSummary(selectedAccount, form) : null),
    [form, selectedAccount]
  );

  const accountActivity = useMemo(
    () => (selectedAccount ? buildAccountActivity(selectedAccount).slice(0, 8) : []),
    [selectedAccount]
  );

  const activePlansCount = useMemo(
    () => accounts.filter((account) => financingStatus(account) === "enabled").length,
    [accounts]
  );
  const draftPlansCount = useMemo(
    () => accounts.filter((account) => financingStatus(account) === "draft").length,
    [accounts]
  );
  const creditAccountsCount = useMemo(
    () =>
      accounts.filter((account) =>
        account.adjustments.some(
          (adjustment) => adjustmentCountsTowardBalance(adjustment.status) && isAdjustmentCredit(adjustment)
        )
      ).length,
    [accounts]
  );

  async function refreshAccounts(nextSelectedKey?: string) {
    const nextAccounts = flattenAccounts(await fetchPaymentAccounts(accessToken));
    setAccounts(nextAccounts);
    setSelectedKey(
      nextSelectedKey ||
        nextAccounts.find((account) => account.key === selectedKey)?.key ||
        nextAccounts[0]?.key ||
        ""
    );
  }

  function presetAdjustment(entryType: "fee" | "credit") {
    setAdjustmentForm((previous) => ({
      ...previous,
      entry_type: entryType,
      label: entryType === "fee" ? "Admin Fee" : "Credit",
    }));
  }

  async function handleSavePlan() {
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
          price: form.price,
          deposit: form.deposit,
          balance: String(balanceSummary.balance),
          puppy_status: form.puppy_status,
          finance_enabled: form.finance_enabled,
          finance_admin_fee: form.finance_admin_fee,
          finance_rate: form.finance_rate,
          finance_months: form.finance_months,
          finance_monthly_amount: form.finance_monthly_amount,
          finance_next_due_date: form.finance_next_due_date,
        }),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not save the financing plan.");
      }

      await refreshAccounts(selectedAccount.key);
      setStatusText("Financing plan updated.");
    } catch (error) {
      console.error(error);
      setStatusText(error instanceof Error ? error.message : "Could not save the financing plan.");
    } finally {
      setSaving(false);
    }
  }

  async function logAdjustment() {
    if (!selectedAccount) return;

    setLoggingAdjustment(true);
    setAdjustmentStatusText("");

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
          entry_kind: "adjustment",
          entry_date: adjustmentForm.entry_date,
          amount: adjustmentForm.amount,
          entry_type: adjustmentForm.entry_type,
          label: adjustmentForm.label,
          description: adjustmentForm.description,
          status: adjustmentForm.status,
          reference_number: adjustmentForm.reference_number,
        }),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not record the financing adjustment.");
      }

      await refreshAccounts(selectedAccount.key);
      setAdjustmentForm((previous) => ({
        ...previous,
        amount: "",
        description: "",
        reference_number: "",
      }));
      setAdjustmentStatusText(
        adjustmentForm.entry_type === "credit" ? "Credit recorded." : "Admin fee recorded."
      );
    } catch (error) {
      console.error(error);
      setAdjustmentStatusText(
        error instanceof Error ? error.message : "Could not record the financing adjustment."
      );
    } finally {
      setLoggingAdjustment(false);
    }
  }

  async function saveNoticeSettings() {
    if (!selectedAccount) return;

    setNoticeSaving(true);
    setNoticeStatusText("");

    try {
      const response = await fetch("/api/admin/portal/payment-notices", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          buyer_id: selectedAccount.buyer.id,
          enabled: noticeForm.enabled === "yes",
          receipt_enabled: noticeForm.receipt_enabled === "yes",
          due_reminder_enabled: noticeForm.due_reminder_enabled === "yes",
          due_reminder_days_before: noticeForm.due_reminder_days_before,
          late_notice_enabled: noticeForm.late_notice_enabled === "yes",
          late_notice_days_after: noticeForm.late_notice_days_after,
          default_notice_enabled: noticeForm.default_notice_enabled === "yes",
          default_notice_days_after: noticeForm.default_notice_days_after,
          recipient_email: noticeForm.recipient_email,
          cc_emails: noticeForm.cc_emails,
          internal_note: noticeForm.internal_note,
        }),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not save the email notice settings.");
      }

      setNoticeStatusText("Email notice settings updated.");
    } catch (error) {
      console.error(error);
      setNoticeStatusText(
        error instanceof Error ? error.message : "Could not save the email notice settings."
      );
    } finally {
      setNoticeSaving(false);
    }
  }

  async function sendNoticeNow(kind: "due_reminder" | "late_notice" | "default_notice") {
    if (!selectedAccount) return;

    setNoticeSending(true);
    setNoticeStatusText("");

    try {
      const response = await fetch("/api/admin/portal/payment-notices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          buyer_id: selectedAccount.buyer.id,
          kind,
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        result?: { sent?: boolean; skippedReason?: string };
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not send the payment notice.");
      }

      setNoticeStatusText(
        payload.result?.sent
          ? `${formatNoticeKindLabel(kind)} emailed.`
          : payload.result?.skippedReason || `${formatNoticeKindLabel(kind)} skipped.`
      );

      const refreshResponse = await fetch(
        `/api/admin/portal/payment-notices?buyer_id=${selectedAccount.buyer.id}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      const refreshPayload = (await refreshResponse.json()) as {
        ok?: boolean;
        logs?: PaymentNoticeLog[];
      };
      if (refreshResponse.ok && refreshPayload.ok) {
        setNoticeLogs(Array.isArray(refreshPayload.logs) ? refreshPayload.logs : []);
      }
    } catch (error) {
      console.error(error);
      setNoticeStatusText(
        error instanceof Error ? error.message : "Could not send the payment notice."
      );
    } finally {
      setNoticeSending(false);
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">
        Loading financing planner...
      </div>
    );
  }

  if (!user) {
    return (
      <AdminRestrictedState
        title="Sign in to access puppy financing."
        details="This page is reserved for the Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!isPortalAdminEmail(user.email)) {
    return (
      <AdminRestrictedState
        title="This financing planner is limited to approved owner accounts."
        details="Only the approved owner emails can build and edit puppy payment plans here."
      />
    );
  }

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-12">
        <AdminPageHero
          eyebrow="Puppy Financing"
          title="Build financed payment plans with live math and quick adjustments."
          description="Select a customer, tune the amount financed, APR, term, and due date, then apply admin fees or credits without leaving the planner."
          actions={
            <>
              <AdminHeroPrimaryAction href="/admin/portal/payments">Open Buyer Payments</AdminHeroPrimaryAction>
              <AdminHeroSecondaryAction href="/admin/portal/buyers">Open Buyers</AdminHeroSecondaryAction>
            </>
          }
          aside={
            <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
              <AdminInfoTile
                label="Plan Ready"
                value={String(activePlansCount)}
                detail="Buyer plans with financing enabled and monthly terms filled in."
              />
              <AdminInfoTile
                label="Needs Setup"
                value={String(draftPlansCount)}
                detail="Buyer plans marked for financing but still missing monthly terms or a due date."
              />
              <AdminInfoTile
                label="Credits Active"
                value={String(creditAccountsCount)}
                detail="Buyer plans that already have manual credits on the ledger."
              />
            </div>
          }
        />

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <AdminPanel
            title="Customer Plan Selector"
            subtitle="Choose the buyer account you want to finance, then refine the terms on the right."
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customers, puppies, due dates..."
              className="w-full rounded-[20px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3 text-sm text-[var(--portal-text)] outline-none focus:border-[#c8a884]"
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" />
              <FilterChip active={filter === "enabled"} onClick={() => setFilter("enabled")} label="Plan Ready" />
              <FilterChip active={filter === "draft"} onClick={() => setFilter("draft")} label="Needs Setup" />
              <FilterChip active={filter === "inactive"} onClick={() => setFilter("inactive")} label="Financing Off" />
            </div>

            <div className="mt-4 space-y-3">
              {filteredAccounts.length ? (
                filteredAccounts.map((account) => (
                  <AdminListCard
                    key={account.key}
                    selected={selectedKey === account.key}
                    onClick={() => setSelectedKey(account.key)}
                    title={buyerName(account.buyer)}
                    subtitle={linkedPuppyNames(account)}
                    meta={[
                      financingStatusLabel(account),
                      account.buyer.finance_monthly_amount
                        ? `${fmtMoney(account.buyer.finance_monthly_amount)} / month`
                        : "Monthly amount not set",
                      `Due ${formatShortDate(account.buyer.finance_next_due_date)}`,
                    ].join(" - ")}
                    badge={
                      account.puppy ? (
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(
                            account.puppy.status
                          )}`}
                        >
                          {account.puppy.status || "pending"}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-[var(--portal-border)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-soft)]">
                          Buyer only
                        </span>
                      )
                    }
                  />
                ))
              ) : (
                <AdminEmptyState
                  title="No customer plans matched your search"
                  description="Try a different buyer name, puppy name, or financing state."
                />
              )}
            </div>
          </AdminPanel>

          {selectedAccount && balanceSummary ? (
            <div className="space-y-6">
              <AdminPanel
                title="Plan Snapshot"
                subtitle="Review the selected customer, linked puppy, and the current plan math before saving."
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                  <AdminInfoTile label="Customer" value={buyerName(selectedAccount.buyer)} />
                  <AdminInfoTile
                    label="Linked Puppy"
                    value={puppyName(selectedAccount.puppy)}
                    detail={linkedPuppyNames(selectedAccount)}
                  />
                  <AdminInfoTile
                    label="Principal"
                    value={fmtMoney(balanceSummary.principalAfterDeposit)}
                    detail="Purchase price minus deposit."
                  />
                  <AdminInfoTile
                    label="Suggested Monthly"
                    value={
                      balanceSummary.recommendedMonthlyAmount !== null
                        ? fmtMoney(balanceSummary.recommendedMonthlyAmount)
                        : "Add APR and months"
                    }
                    detail={
                      balanceSummary.recommendedMonthlyAmount !== null && balanceSummary.financeMonths
                        ? `${balanceSummary.financeMonths} month amortized estimate.`
                        : "Set the APR and term to generate a recommendation."
                    }
                  />
                  <AdminInfoTile
                    label="Manual Fees / Credits"
                    value={`${fmtMoney(balanceSummary.adjustmentCharges)} / ${fmtMoney(balanceSummary.adjustmentCredits)}`}
                    detail={`${fmtMoney(balanceSummary.adminFeeCharges)} currently tagged as admin fees.`}
                  />
                  <AdminInfoTile
                    label="Projected Balance"
                    value={fmtMoney(balanceSummary.balance)}
                    detail={balanceSummary.nextDueDate ? `Next due ${formatShortDate(balanceSummary.nextDueDate)}.` : "Next due date not set."}
                  />
                </div>
              </AdminPanel>

              <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.05fr)_420px]">
                <div className="space-y-6">
                  <AdminPanel
                    title="Interactive Plan Builder"
                    subtitle="Update customer financing terms live, then save the plan back to the buyer and linked puppy records."
                  >
                    {statusText ? (
                      <div className="mb-4 rounded-[18px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--portal-text-soft)]">
                        {statusText}
                      </div>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-2">
                      <PlannerField label="Purchase Price" value={form.price} onChange={(value) => setForm((previous) => ({ ...previous, price: value }))} />
                      <PlannerField label="Deposit" value={form.deposit} onChange={(value) => setForm((previous) => ({ ...previous, deposit: value }))} />
                      <PlannerSelect label="Financing Enabled" value={form.finance_enabled} onChange={(value) => setForm((previous) => ({ ...previous, finance_enabled: value }))} />
                      <PlannerSelect label="Admin Fee Marked" value={form.finance_admin_fee} onChange={(value) => setForm((previous) => ({ ...previous, finance_admin_fee: value }))} />
                      <PlannerField label="APR / Rate" value={form.finance_rate} onChange={(value) => setForm((previous) => ({ ...previous, finance_rate: value }))} />
                      <PlannerField label="Finance Months" value={form.finance_months} onChange={(value) => setForm((previous) => ({ ...previous, finance_months: value }))} />
                      <PlannerField label="Monthly Amount" value={form.finance_monthly_amount} onChange={(value) => setForm((previous) => ({ ...previous, finance_monthly_amount: value }))} />
                      <PlannerDateField label="Next Due Date" value={form.finance_next_due_date} onChange={(value) => setForm((previous) => ({ ...previous, finance_next_due_date: value }))} />
                      <PlannerField label="Current Balance Snapshot" value={form.balance} onChange={(value) => setForm((previous) => ({ ...previous, balance: value }))} />
                      <PlannerField label="Puppy Status" value={form.puppy_status} onChange={(value) => setForm((previous) => ({ ...previous, puppy_status: value }))} />
                    </div>

                    <div className="mt-4 rounded-[20px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,253,247,0.96)_0%,rgba(250,244,235,0.92)_100%)] px-4 py-4 text-sm leading-6 text-[var(--portal-text-soft)]">
                      The admin-fee switch marks the plan, but the actual admin fee dollars should be logged below as an adjustment so the ledger and balance stay accurate.
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (balanceSummary.recommendedMonthlyAmount === null) return;
                          setForm((previous) => ({
                            ...previous,
                            finance_monthly_amount: String(balanceSummary.recommendedMonthlyAmount),
                          }));
                        }}
                        disabled={balanceSummary.recommendedMonthlyAmount === null}
                        className="rounded-2xl border border-[var(--portal-border)] bg-[#fffdfb] px-5 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[0_12px_30px_rgba(106,76,45,0.08)] transition hover:border-[#d8b48b] hover:bg-white disabled:opacity-60"
                      >
                        Use Suggested Monthly Amount
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSavePlan()}
                        disabled={saving}
                        className="rounded-2xl bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(181,117,47,0.26)] transition hover:brightness-105 disabled:opacity-60"
                      >
                        {saving ? "Saving..." : "Save Payment Plan"}
                      </button>
                    </div>
                  </AdminPanel>

                  <AdminPanel
                    title="Live Projection"
                    subtitle="Preview how the current APR, term, fees, and credits change the financed plan before you save."
                  >
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <AdminInfoTile
                        label="Plan Total"
                        value={balanceSummary.planTotal !== null ? fmtMoney(balanceSummary.planTotal) : "Not enough inputs"}
                        detail="Based on the monthly amount shown in the builder."
                      />
                      <AdminInfoTile
                        label="Finance Uplift"
                        value={balanceSummary.financeUplift > 0 ? fmtMoney(balanceSummary.financeUplift) : "$0.00"}
                        detail={
                          balanceSummary.financeEnabled
                            ? `${balanceSummary.apr !== null ? `${balanceSummary.apr}% APR` : "APR not listed"}${balanceSummary.adminFeeEnabled ? " - admin fee marked on." : "."}`
                            : "No financing uplift is being added."
                        }
                      />
                      <AdminInfoTile
                        label="Total Charges"
                        value={fmtMoney(balanceSummary.totalCharges)}
                        detail="Financed base plus all manual charges."
                      />
                      <AdminInfoTile
                        label="Total Credits"
                        value={fmtMoney(balanceSummary.totalCredits)}
                        detail="Payments received plus credits applied."
                      />
                    </div>
                  </AdminPanel>
                </div>

                <div className="space-y-6">
                  <AdminPanel
                    title="Quick Admin Fees And Credits"
                    subtitle="Apply a charge or credit directly to this payment plan without leaving the planner."
                  >
                    {adjustmentStatusText ? (
                      <div className="mb-4 rounded-[18px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--portal-text-soft)]">
                        {adjustmentStatusText}
                      </div>
                    ) : null}

                    <div className="grid gap-2 sm:grid-cols-2">
                      <QuickActionButton
                        active={adjustmentForm.entry_type === "fee" && adjustmentForm.label === "Admin Fee"}
                        label="Admin Fee"
                        onClick={() => presetAdjustment("fee")}
                      />
                      <QuickActionButton
                        active={adjustmentForm.entry_type === "credit"}
                        label="Credit"
                        onClick={() => presetAdjustment("credit")}
                      />
                    </div>

                    <div className="mt-4 grid gap-4">
                      <PlannerDateField label="Entry Date" value={adjustmentForm.entry_date} onChange={(value) => setAdjustmentForm((previous) => ({ ...previous, entry_date: value }))} />
                      <PlannerField label="Amount" value={adjustmentForm.amount} onChange={(value) => setAdjustmentForm((previous) => ({ ...previous, amount: value }))} />
                      <PlannerSelect
                        label="Type"
                        value={adjustmentForm.entry_type}
                        options={[
                          { value: "fee", label: "Fee" },
                          { value: "credit", label: "Credit" },
                        ]}
                        onChange={(value) =>
                          setAdjustmentForm((previous) => ({
                            ...previous,
                            entry_type: value as "fee" | "credit",
                            label:
                              value === "credit"
                                ? "Credit"
                                : previous.label === "Credit"
                                  ? "Admin Fee"
                                  : previous.label,
                          }))
                        }
                      />
                      <PlannerField label="Label" value={adjustmentForm.label} onChange={(value) => setAdjustmentForm((previous) => ({ ...previous, label: value }))} />
                      <PlannerField label="Reference Number" value={adjustmentForm.reference_number} onChange={(value) => setAdjustmentForm((previous) => ({ ...previous, reference_number: value }))} />
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                        Description
                        <textarea
                          value={adjustmentForm.description}
                          onChange={(event) =>
                            setAdjustmentForm((previous) => ({ ...previous, description: event.target.value }))
                          }
                          rows={5}
                          className="mt-2 w-full rounded-[18px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3.5 text-sm text-[var(--portal-text)] outline-none focus:border-[#c8a884]"
                        />
                      </label>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void logAdjustment()}
                        disabled={loggingAdjustment}
                        className="rounded-2xl bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(181,117,47,0.26)] transition hover:brightness-105 disabled:opacity-60"
                      >
                        {loggingAdjustment ? "Saving..." : "Record Adjustment"}
                      </button>
                    </div>
                  </AdminPanel>

                  <AdminPanel
                    title="Email Notice Settings"
                    subtitle="Control payment receipts, due reminders, late notices, and default notices for this buyer plan."
                  >
                    {noticeStatusText ? (
                      <div className="mb-4 rounded-[18px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--portal-text-soft)]">
                        {noticeStatusText}
                      </div>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-2">
                      <PlannerSelect
                        label="Email Notices Enabled"
                        value={noticeForm.enabled}
                        onChange={(value) => setNoticeForm((previous) => ({ ...previous, enabled: value }))}
                      />
                      <PlannerSelect
                        label="Payment Receipts"
                        value={noticeForm.receipt_enabled}
                        onChange={(value) =>
                          setNoticeForm((previous) => ({ ...previous, receipt_enabled: value }))
                        }
                      />
                      <PlannerSelect
                        label="Due Reminder"
                        value={noticeForm.due_reminder_enabled}
                        onChange={(value) =>
                          setNoticeForm((previous) => ({ ...previous, due_reminder_enabled: value }))
                        }
                      />
                      <PlannerField
                        label="Days Before Due"
                        value={noticeForm.due_reminder_days_before}
                        onChange={(value) =>
                          setNoticeForm((previous) => ({
                            ...previous,
                            due_reminder_days_before: value,
                          }))
                        }
                      />
                      <PlannerSelect
                        label="Late Notice"
                        value={noticeForm.late_notice_enabled}
                        onChange={(value) =>
                          setNoticeForm((previous) => ({ ...previous, late_notice_enabled: value }))
                        }
                      />
                      <PlannerField
                        label="Days After Due"
                        value={noticeForm.late_notice_days_after}
                        onChange={(value) =>
                          setNoticeForm((previous) => ({
                            ...previous,
                            late_notice_days_after: value,
                          }))
                        }
                      />
                      <PlannerSelect
                        label="Default Notice"
                        value={noticeForm.default_notice_enabled}
                        onChange={(value) =>
                          setNoticeForm((previous) => ({ ...previous, default_notice_enabled: value }))
                        }
                      />
                      <PlannerField
                        label="Default After Days"
                        value={noticeForm.default_notice_days_after}
                        onChange={(value) =>
                          setNoticeForm((previous) => ({
                            ...previous,
                            default_notice_days_after: value,
                          }))
                        }
                      />
                      <PlannerField
                        label="Recipient Email"
                        value={noticeForm.recipient_email}
                        onChange={(value) =>
                          setNoticeForm((previous) => ({ ...previous, recipient_email: value }))
                        }
                      />
                      <PlannerField
                        label="CC Emails"
                        value={noticeForm.cc_emails}
                        onChange={(value) =>
                          setNoticeForm((previous) => ({ ...previous, cc_emails: value }))
                        }
                      />
                    </div>

                    <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                      Internal Note
                      <textarea
                        value={noticeForm.internal_note}
                        onChange={(event) =>
                          setNoticeForm((previous) => ({
                            ...previous,
                            internal_note: event.target.value,
                          }))
                        }
                        rows={4}
                        className="mt-2 w-full rounded-[18px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3.5 text-sm text-[var(--portal-text)] outline-none focus:border-[#c8a884]"
                      />
                    </label>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void saveNoticeSettings()}
                        disabled={noticeSaving || noticeLoading}
                        className="rounded-2xl bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(181,117,47,0.26)] transition hover:brightness-105 disabled:opacity-60"
                      >
                        {noticeSaving ? "Saving..." : "Save Email Settings"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void sendNoticeNow("due_reminder")}
                        disabled={noticeSending || noticeLoading}
                        className="rounded-2xl border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[0_12px_30px_rgba(106,76,45,0.08)] transition hover:border-[#d8b48b] hover:bg-white disabled:opacity-60"
                      >
                        Send Due Reminder
                      </button>
                      <button
                        type="button"
                        onClick={() => void sendNoticeNow("late_notice")}
                        disabled={noticeSending || noticeLoading}
                        className="rounded-2xl border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[0_12px_30px_rgba(106,76,45,0.08)] transition hover:border-[#d8b48b] hover:bg-white disabled:opacity-60"
                      >
                        Send Late Notice
                      </button>
                      <button
                        type="button"
                        onClick={() => void sendNoticeNow("default_notice")}
                        disabled={noticeSending || noticeLoading}
                        className="rounded-2xl border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[0_12px_30px_rgba(106,76,45,0.08)] transition hover:border-[#d8b48b] hover:bg-white disabled:opacity-60"
                      >
                        Send Default Notice
                      </button>
                    </div>

                    <div className="mt-5 grid gap-3">
                      <AdminInfoTile
                        label="Buyer Email"
                        value={noticeForm.recipient_email || selectedAccount.buyer.email || "Not set"}
                        detail="Receipts send immediately when a payment posts. Scheduled notices run daily from the cron route."
                      />
                    </div>

                    <div className="mt-5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                        Recent Email Activity
                      </div>
                      <div className="mt-3 space-y-3">
                        {noticeLogs.length ? (
                          noticeLogs.map((log) => (
                            <div
                              key={log.id}
                              className="rounded-[18px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-4 shadow-[0_12px_30px_rgba(106,76,45,0.07)]"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-[var(--portal-text)]">
                                    {formatNoticeKindLabel(log.notice_kind)}
                                  </div>
                                  <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                                    {formatShortDate(log.notice_date || log.created_at)}
                                    {log.due_date ? ` - due ${formatShortDate(log.due_date)}` : ""}
                                  </div>
                                </div>
                                <span
                                  className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${adminStatusBadge(
                                    log.status
                                  )}`}
                                >
                                  {log.status || "sent"}
                                </span>
                              </div>
                              <div className="mt-3 text-sm leading-6 text-[var(--portal-text-soft)]">
                                {log.subject}
                              </div>
                              <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                                {log.recipient_email}
                              </div>
                            </div>
                          ))
                        ) : (
                          <AdminEmptyState
                            title={noticeLoading ? "Loading email history" : "No email activity yet"}
                            description={
                              noticeLoading
                                ? "Pulling the recent receipt and notice history for this buyer plan."
                                : "Payment receipts, reminders, late notices, and default notices will appear here after they are sent."
                            }
                          />
                        )}
                      </div>
                    </div>
                  </AdminPanel>

                  <AdminPanel
                    title="Recent Plan Activity"
                    subtitle="Keep the full context close while you update terms and ledger adjustments."
                  >
                    {accountActivity.length ? (
                      <div className="space-y-3">
                        {accountActivity.map((entry) => (
                          <div
                            key={entry.key}
                            className="rounded-[20px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-4 shadow-[0_12px_30px_rgba(106,76,45,0.07)]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-[var(--portal-text)]">{entry.title}</div>
                                <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                                  {entry.sourceLabel} - {formatShortDate(entry.date)}
                                </div>
                              </div>
                              <div
                                className={`text-sm font-semibold ${
                                  entry.sourceLabel === "Credit" ? "text-[#2f7f5f]" : "text-[var(--portal-text)]"
                                }`}
                              >
                                {entry.sourceLabel === "Credit" ? "-" : ""}
                                {fmtMoney(Math.abs(entry.amount))}
                              </div>
                            </div>
                            {entry.referenceNumber ? (
                              <div className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                                Ref: {entry.referenceNumber}
                              </div>
                            ) : null}
                            {entry.detail ? (
                              <div className="mt-3 text-sm leading-6 text-[var(--portal-text-soft)]">{entry.detail}</div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <AdminEmptyState
                        title="No plan activity yet"
                        description="Payments, fees, and credits for this customer will appear here after they are recorded."
                      />
                    )}
                  </AdminPanel>
                </div>
              </section>
            </div>
          ) : (
            <AdminPanel title="Interactive Payment Plan" subtitle="Choose a customer plan to begin.">
              <AdminEmptyState
                title="No customer selected"
                description="Pick a customer from the left to update APR, monthly amounts, admin fees, and credits."
              />
            </AdminPanel>
          )}
        </section>
      </div>
    </AdminPageShell>
  );
}

function PlannerField({
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
        className="mt-2 w-full rounded-[18px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3.5 text-sm normal-case tracking-normal text-[var(--portal-text)] outline-none focus:border-[#c8a884]"
      />
    </label>
  );
}

function PlannerDateField({
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
        className="mt-2 w-full rounded-[18px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3.5 text-sm normal-case tracking-normal text-[var(--portal-text)] outline-none focus:border-[#c8a884]"
      />
    </label>
  );
}

function PlannerSelect({
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
        onChange={(event) => onChange(event.target.value)}
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

function FilterChip({
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
        "rounded-full border px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition",
        active
          ? "border-transparent bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] text-white shadow-[0_14px_28px_rgba(181,117,47,0.22)]"
          : "border-[var(--portal-border)] bg-white text-[var(--portal-text-soft)] hover:border-[#d8b48b] hover:text-[var(--portal-text)]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function QuickActionButton({
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
          ? "border-transparent bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] text-white shadow-[0_16px_30px_rgba(181,117,47,0.24)]"
          : "border-[var(--portal-border)] bg-[#fffdfb] text-[var(--portal-text)] hover:border-[#d8b48b] hover:bg-white",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
