"use client";

import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PencilLine, Plus, RefreshCw, Search } from "lucide-react";
import {
  AdminEmptyState,
  AdminPageShell,
  AdminRestrictedState,
  adminStatusBadge,
} from "@/components/admin/luxury-admin-shell";
import {
  AdminDateInput,
  AdminNumberInput,
  AdminSelectInput,
  AdminTextAreaInput,
  AdminTextInput,
} from "@/components/admin/admin-form-fields";
import { fmtDate, fmtMoney } from "@/lib/utils";
import { usePortalAdminSession } from "@/lib/use-portal-admin-session";

type BuyerRecord = {
  key: string;
  buyer: {
    id: number;
    full_name?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    status?: string | null;
    notes?: string | null;
    city?: string | null;
    state?: string | null;
    delivery_option?: string | null;
    delivery_date?: string | null;
    delivery_location?: string | null;
    delivery_miles?: number | null;
    delivery_fee?: number | null;
    expense_gas?: number | null;
    expense_hotel?: number | null;
    expense_tolls?: number | null;
    expense_misc?: string | null;
  };
  displayName: string;
  email: string;
  phone: string;
  hasPortalAccount: boolean;
  portalUser?: {
    id?: string;
    email: string;
    created_at?: string | null;
    last_sign_in_at?: string | null;
  } | null;
  applicationCount: number;
  latestApplication?: {
    id: number;
    status?: string | null;
    created_at?: string | null;
  } | null;
  latestApplicationStatus?: string | null;
  formCount: number;
  forms: Array<{
    id: number;
    form_key?: string | null;
    form_title?: string | null;
    version?: string | null;
    signed_name?: string | null;
    status?: string | null;
    submitted_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  }>;
  linkedPuppies: Array<{
    id: number;
    buyer_id?: number | null;
    call_name?: string | null;
    puppy_name?: string | null;
    name?: string | null;
    litter_name?: string | null;
    sire?: string | null;
    dam?: string | null;
    status?: string | null;
    price?: number | null;
    list_price?: number | null;
  }>;
};

type PuppyOption = BuyerRecord["linkedPuppies"][number] & {
  buyerName?: string | null;
};

type BuyerAccount = {
  key: string;
  buyer: {
    id: number;
    sale_price?: number | null;
    deposit_amount?: number | null;
    finance_enabled?: boolean | null;
    finance_admin_fee?: boolean | null;
    finance_rate?: number | null;
    finance_months?: number | null;
    finance_monthly_amount?: number | null;
    finance_next_due_date?: string | null;
    finance_last_payment_date?: string | null;
  };
  linkedPuppies: PuppyOption[];
  payments: Array<{
    id: string;
    amount: number;
    payment_date: string;
    payment_type?: string | null;
    method?: string | null;
    note?: string | null;
    status?: string | null;
  }>;
  adjustments: Array<{
    id: number;
    amount: number;
    entry_date: string;
    label?: string | null;
    description?: string | null;
    entry_type?: string | null;
    status?: string | null;
  }>;
  billing_subscription?: {
    subscription_status?: string | null;
    plan_name?: string | null;
    plan_code?: string | null;
    recurring_price?: number | null;
    next_billing_at?: string | null;
    card_last_four?: string | null;
  } | null;
  payment_notice_settings?: {
    enabled: boolean;
    receipt_enabled: boolean;
    due_reminder_enabled: boolean;
    due_reminder_days_before: number;
    late_notice_enabled: boolean;
    late_notice_days_after: number;
    default_notice_enabled: boolean;
    default_notice_days_after: number;
    recipient_email?: string | null;
  } | null;
  totalPaid: number;
  lastPaymentAt: string | null;
};

type TransportationRequest = {
  id: number;
  created_at?: string | null;
  request_date?: string | null;
  request_type?: string | null;
  location_text?: string | null;
  address_text?: string | null;
  notes?: string | null;
  status?: string | null;
  buyer?: {
    id: number;
  } | null;
};

type BuyerForm = {
  full_name: string;
  email: string;
  phone: string;
  status: string;
  city: string;
  state: string;
  notes: string;
  delivery_option: string;
  delivery_date: string;
  delivery_location: string;
  delivery_miles: string;
  delivery_fee: string;
  expense_gas: string;
  expense_hotel: string;
  expense_tolls: string;
  expense_misc: string;
};

type BuyerTabKey =
  | "profile"
  | "puppies"
  | "transportation"
  | "payments"
  | "documents"
  | "activity"
  | "plan";

type BuyerSummary = {
  purchasePrice: number;
  deposit: number;
  totalPaid: number;
  adjustments: number;
  balance: number;
  financeEnabled: boolean;
  monthlyAmount: number;
  financeMonths: number;
  financeRate: number;
  financeAdminFee: boolean;
  nextDueDate: string;
  lastPaymentAt: string;
};

type BuyerEntry = {
  record: BuyerRecord;
  account: BuyerAccount | null;
  summary: BuyerSummary;
};

type ActivityItem = {
  key: string;
  date: string;
  category: string;
  title: string;
  detail: string;
  amount?: number | null;
  status?: string | null;
};

type BuyerModalMode = "create" | "edit" | null;
type FeedbackTone = "success" | "error";

const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(159,99,49,0.18)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--portal-border)] bg-white/90 px-4 py-2.5 text-sm font-semibold text-[var(--portal-text)] shadow-sm transition hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60";

function emptyBuyerForm(): BuyerForm {
  return {
    full_name: "",
    email: "",
    phone: "",
    status: "pending",
    city: "",
    state: "",
    notes: "",
    delivery_option: "",
    delivery_date: "",
    delivery_location: "",
    delivery_miles: "",
    delivery_fee: "",
    expense_gas: "",
    expense_hotel: "",
    expense_tolls: "",
    expense_misc: "",
  };
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function puppyLabel(puppy: PuppyOption | null | undefined) {
  if (!puppy) return "No puppy linked";
  return puppy.call_name || puppy.puppy_name || puppy.name || `Puppy #${puppy.id}`;
}

function isCompletedStatus(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  return (
    normalized.includes("complete") ||
    normalized.includes("closed") ||
    normalized.includes("finished")
  );
}

function fillBuyerForm(record: BuyerRecord | null): BuyerForm {
  if (!record) return emptyBuyerForm();
  return {
    full_name: String(record.buyer.full_name || record.buyer.name || record.displayName || ""),
    email: String(record.buyer.email || record.email || ""),
    phone: String(record.buyer.phone || record.phone || ""),
    status: String(record.buyer.status || "pending"),
    city: String(record.buyer.city || ""),
    state: String(record.buyer.state || ""),
    notes: String(record.buyer.notes || ""),
    delivery_option: String(record.buyer.delivery_option || ""),
    delivery_date: String(record.buyer.delivery_date || ""),
    delivery_location: String(record.buyer.delivery_location || ""),
    delivery_miles:
      record.buyer.delivery_miles == null ? "" : String(record.buyer.delivery_miles),
    delivery_fee: record.buyer.delivery_fee == null ? "" : String(record.buyer.delivery_fee),
    expense_gas: record.buyer.expense_gas == null ? "" : String(record.buyer.expense_gas),
    expense_hotel:
      record.buyer.expense_hotel == null ? "" : String(record.buyer.expense_hotel),
    expense_tolls:
      record.buyer.expense_tolls == null ? "" : String(record.buyer.expense_tolls),
    expense_misc: String(record.buyer.expense_misc || ""),
  };
}

function summarizeBuyer(record: BuyerRecord, account: BuyerAccount | null): BuyerSummary {
  const linkedPuppies = account?.linkedPuppies?.length ? account.linkedPuppies : record.linkedPuppies;
  const purchasePrice = linkedPuppies.length
    ? linkedPuppies.reduce((sum, puppy) => sum + toNumber(puppy.price || puppy.list_price), 0)
    : toNumber(account?.buyer.sale_price);
  const deposit = toNumber(account?.buyer.deposit_amount);
  const totalPaid =
    account?.payments
      .filter((payment) => !["failed", "void", "cancelled", "canceled"].includes(String(payment.status || "").toLowerCase()))
      .reduce((sum, payment) => sum + toNumber(payment.amount), 0) || 0;
  const adjustments =
    account?.adjustments
      .filter((adjustment) => !["failed", "void", "cancelled", "canceled"].includes(String(adjustment.status || "").toLowerCase()))
      .reduce((sum, adjustment) => sum + toNumber(adjustment.amount), 0) || 0;

  return {
    purchasePrice,
    deposit,
    totalPaid,
    adjustments,
    balance: Math.max(0, purchasePrice + adjustments - totalPaid),
    financeEnabled: Boolean(account?.buyer.finance_enabled),
    monthlyAmount: toNumber(account?.buyer.finance_monthly_amount),
    financeMonths: toNumber(account?.buyer.finance_months),
    financeRate: toNumber(account?.buyer.finance_rate),
    financeAdminFee: Boolean(account?.buyer.finance_admin_fee),
    nextDueDate: String(account?.buyer.finance_next_due_date || ""),
    lastPaymentAt: String(account?.lastPaymentAt || account?.buyer.finance_last_payment_date || ""),
  };
}

function buildActivityItems(
  record: BuyerRecord | null,
  account: BuyerAccount | null,
  requests: TransportationRequest[]
) {
  if (!record) return [] as ActivityItem[];

  return [
    ...(account?.payments || []).map((payment) => ({
      key: `payment-${payment.id}`,
      date: payment.payment_date || "",
      category: "Payment",
      title: payment.payment_type || "Payment recorded",
      detail: [payment.method, payment.note].filter(Boolean).join(" | "),
      amount: payment.amount,
      status: payment.status || "recorded",
    })),
    ...(account?.adjustments || []).map((adjustment) => ({
      key: `adjustment-${adjustment.id}`,
      date: adjustment.entry_date || "",
      category: "Adjustment",
      title: adjustment.label || adjustment.entry_type || "Ledger adjustment",
      detail: adjustment.description || "",
      amount: adjustment.amount,
      status: adjustment.status || "recorded",
    })),
    ...requests.map((request) => ({
      key: `transport-${request.id}`,
      date: String(request.request_date || request.created_at || ""),
      category: "Transportation",
      title: request.request_type || "Transportation request",
      detail: request.location_text || request.address_text || request.notes || "",
      status: request.status || "pending",
    })),
    ...record.forms.map((form) => ({
      key: `document-${form.id}`,
      date: String(form.submitted_at || form.updated_at || form.created_at || ""),
      category: "Document",
      title: form.form_title || form.form_key || "Portal document",
      detail: form.signed_name
        ? `Signed by ${form.signed_name}`
        : form.version
          ? `Version ${form.version}`
          : "Portal submission recorded",
      status: form.status || "submitted",
    })),
    ...(record.latestApplication
      ? [
          {
            key: `application-${record.latestApplication.id}`,
            date: String(record.latestApplication.created_at || ""),
            category: "Application",
            title: "Buyer application",
            detail: record.latestApplication.status || "submitted",
            status: record.latestApplication.status || "submitted",
          },
        ]
      : []),
  ].sort((left, right) => new Date(right.date || 0).getTime() - new Date(left.date || 0).getTime());
}

function sameNumberSet(left: number[], right: number[]) {
  if (left.length !== right.length) return false;
  const leftSorted = [...left].sort((a, b) => a - b);
  const rightSorted = [...right].sort((a, b) => a - b);
  return leftSorted.every((value, index) => value === rightSorted[index]);
}

async function fetchBuyerWorkspace(accessToken: string) {
  const [buyersRes, accountsRes, transportationRes] = await Promise.all([
    fetch("/api/admin/portal/buyers", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }),
    fetch("/api/admin/portal/payments", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }),
    fetch("/api/admin/portal/transportation", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }),
  ]);

  const buyersPayload = buyersRes.ok
    ? ((await buyersRes.json()) as { buyers?: BuyerRecord[]; puppies?: PuppyOption[]; error?: string })
    : { error: "Could not load buyers." };
  const accountsPayload = accountsRes.ok
    ? ((await accountsRes.json()) as { accounts?: BuyerAccount[]; error?: string })
    : { error: "Could not load buyer payments." };
  const transportationPayload = transportationRes.ok
    ? ((await transportationRes.json()) as { requests?: TransportationRequest[]; error?: string })
    : { error: "Could not load transportation requests." };

  if (!buyersRes.ok) throw new Error(buyersPayload.error || "Could not load buyers.");
  if (!accountsRes.ok) throw new Error(accountsPayload.error || "Could not load buyer payments.");
  if (!transportationRes.ok) {
    throw new Error(transportationPayload.error || "Could not load transportation requests.");
  }

  return {
    buyers: Array.isArray(buyersPayload.buyers) ? buyersPayload.buyers : [],
    puppies: Array.isArray(buyersPayload.puppies) ? buyersPayload.puppies : [],
    accounts: Array.isArray(accountsPayload.accounts) ? accountsPayload.accounts : [],
    requests: Array.isArray(transportationPayload.requests) ? transportationPayload.requests : [],
  };
}

function WorkspaceSurface({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "rounded-[1.6rem] border border-[rgba(187,160,132,0.24)] bg-[rgba(255,252,248,0.88)] p-5 shadow-[0_18px_44px_rgba(110,79,47,0.08)] backdrop-blur-sm md:p-6",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}

function SurfaceHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
          {eyebrow}
        </div>
        <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--portal-text)]">
          {title}
        </div>
        {subtitle ? (
          <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{subtitle}</div>
        ) : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

function FeedbackBanner({
  tone,
  text,
}: {
  tone: FeedbackTone;
  text: string;
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-rose-200 bg-rose-50 text-rose-800";

  return (
    <div className={`rounded-[1.1rem] border px-4 py-3 text-sm ${toneClass}`}>{text}</div>
  );
}

function ReadField({
  label,
  value,
  detail,
  wrap = false,
}: {
  label: string;
  value: string;
  detail?: string;
  wrap?: boolean;
}) {
  return (
    <div className="space-y-1.5 rounded-[1.1rem] bg-[rgba(250,245,239,0.86)] px-4 py-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div
        className={
          wrap
            ? "text-sm font-semibold leading-6 text-[var(--portal-text)]"
            : "truncate text-sm font-semibold text-[var(--portal-text)]"
        }
      >
        {value}
      </div>
      {detail ? <div className="text-xs leading-5 text-[var(--portal-text-soft)]">{detail}</div> : null}
    </div>
  );
}

export function AdminBuyersWorkspace() {
  const { user, accessToken, isAdmin, loading } = usePortalAdminSession();
  const [buyers, setBuyers] = useState<BuyerRecord[]>([]);
  const [puppies, setPuppies] = useState<PuppyOption[]>([]);
  const [accounts, setAccounts] = useState<BuyerAccount[]>([]);
  const [requests, setRequests] = useState<TransportationRequest[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState<{ tone: FeedbackTone; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [puppySearch, setPuppySearch] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [activeTab, setActiveTab] = useState<BuyerTabKey>("puppies");
  const [selectedPuppyIds, setSelectedPuppyIds] = useState<number[]>([]);
  const [modalMode, setModalMode] = useState<BuyerModalMode>(null);
  const [modalForm, setModalForm] = useState<BuyerForm>(emptyBuyerForm());
  const [modalError, setModalError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAssignments, setSavingAssignments] = useState(false);

  const deferredSearch = useDeferredValue(search);
  const deferredPuppySearch = useDeferredValue(puppySearch);

  async function refreshWorkspace(preferredKey?: string) {
    if (!accessToken) return;
    const payload = await fetchBuyerWorkspace(accessToken);
    setBuyers(payload.buyers);
    setPuppies(payload.puppies);
    setAccounts(payload.accounts);
    setRequests(payload.requests);
    setSelectedKey((current) => {
      if (preferredKey && payload.buyers.some((buyer) => buyer.key === preferredKey)) {
        return preferredKey;
      }
      if (current && payload.buyers.some((buyer) => buyer.key === current)) return current;
      return payload.buyers[0]?.key || "";
    });
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!accessToken || !isAdmin) {
        if (active) setLoadingData(false);
        return;
      }

      setLoadingData(true);
      setLoadError("");

      try {
        const payload = await fetchBuyerWorkspace(accessToken);
        if (!active) return;
        setBuyers(payload.buyers);
        setPuppies(payload.puppies);
        setAccounts(payload.accounts);
        setRequests(payload.requests);
        setSelectedKey(payload.buyers[0]?.key || "");
      } catch (error) {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Could not load buyers.");
      } finally {
        if (active) setLoadingData(false);
      }
    }

    void bootstrap();
    return () => {
      active = false;
    };
  }, [accessToken, isAdmin]);

  const accountsByBuyerId = useMemo(
    () => new Map(accounts.map((account) => [account.buyer.id, account] as const)),
    [accounts]
  );

  const entries = useMemo<BuyerEntry[]>(
    () =>
      buyers.map((record) => {
        const account = accountsByBuyerId.get(record.buyer.id) || null;
        return { record, account, summary: summarizeBuyer(record, account) };
      }),
    [accountsByBuyerId, buyers]
  );

  const filteredEntries = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return entries.filter(({ record }) => {
      if (!query) return true;
      return [
        record.displayName,
        record.email,
        record.phone,
        record.buyer.city,
        record.buyer.state,
        ...record.linkedPuppies.map((puppy) => puppyLabel(puppy)),
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(query);
    });
  }, [deferredSearch, entries]);

  const groupedEntries = useMemo(
    () => ({
      active: filteredEntries.filter(
        (entry) => !entry.summary.financeEnabled && !isCompletedStatus(entry.record.buyer.status)
      ),
      financing: filteredEntries.filter(
        (entry) => entry.summary.financeEnabled && !isCompletedStatus(entry.record.buyer.status)
      ),
      completed: filteredEntries.filter((entry) => isCompletedStatus(entry.record.buyer.status)),
    }),
    [filteredEntries]
  );

  useEffect(() => {
    if (!filteredEntries.length) {
      setSelectedKey("");
      return;
    }
    if (!filteredEntries.some((entry) => entry.record.key === selectedKey)) {
      setSelectedKey(filteredEntries[0].record.key);
    }
  }, [filteredEntries, selectedKey]);

  const selectedEntry =
    entries.find((entry) => entry.record.key === selectedKey) ||
    filteredEntries.find((entry) => entry.record.key === selectedKey) ||
    filteredEntries[0] ||
    null;
  const selectedBuyer = selectedEntry?.record || null;
  const selectedAccount = selectedEntry?.account || null;
  const selectedSummary = selectedEntry?.summary || null;
  const linkedPuppies = useMemo(
    () =>
      selectedAccount?.linkedPuppies?.length
        ? selectedAccount.linkedPuppies
        : selectedBuyer?.linkedPuppies || [],
    [selectedAccount?.linkedPuppies, selectedBuyer?.linkedPuppies]
  );
  const linkedPuppyIds = useMemo(
    () => linkedPuppies.map((puppy) => puppy.id).sort((left, right) => left - right),
    [linkedPuppies]
  );
  const financeEnabled = Boolean(selectedSummary?.financeEnabled);
  const puppyTabLabel = linkedPuppies.length === 1 ? "Puppy" : "Puppies";
  const selectedRequests = selectedBuyer
    ? requests.filter((request) => Number(request.buyer?.id || 0) === selectedBuyer.buyer.id)
    : [];
  const activityItems = buildActivityItems(selectedBuyer, selectedAccount, selectedRequests);
  const assignmentDirty = !sameNumberSet(selectedPuppyIds, linkedPuppyIds);

  useEffect(() => {
    setSelectedPuppyIds((current) =>
      sameNumberSet(current, linkedPuppyIds) ? current : linkedPuppyIds
    );
  }, [linkedPuppyIds, selectedBuyer?.key]);

  useEffect(() => {
    if (activeTab === "plan" && !financeEnabled) {
      setActiveTab("puppies");
    }
  }, [activeTab, financeEnabled]);

  function openCreateModal() {
    setModalMode("create");
    setModalForm(emptyBuyerForm());
    setModalError("");
  }

  function openEditModal() {
    if (!selectedBuyer) return;
    setModalMode("edit");
    setModalForm(fillBuyerForm(selectedBuyer));
    setModalError("");
  }

  async function handleRefresh() {
    if (!selectedBuyer?.key) return;
    setLoadError("");
    setFeedback(null);
    try {
      await refreshWorkspace(selectedBuyer.key);
      setFeedback({ tone: "success", text: "Buyer workspace refreshed." });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not refresh buyers.");
    }
  }

  async function handleModalSave() {
    if (!accessToken || !modalMode) return;
    if (!modalForm.full_name.trim() && !modalForm.email.trim()) {
      setModalError("Name or email is required to save the buyer.");
      return;
    }

    setSavingProfile(true);
    setModalError("");
    try {
      const response = await fetch("/api/admin/portal/buyers", {
        method: modalMode === "create" ? "POST" : "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...modalForm,
          ...(modalMode === "edit" && selectedBuyer ? { id: selectedBuyer.buyer.id } : {}),
        }),
      });

      const payload = (await response.json()) as { ok?: boolean; buyerId?: number; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not save the buyer.");
      }

      await refreshWorkspace(
        modalMode === "create" ? String(payload.buyerId || "") : selectedBuyer?.key
      );
      setModalMode(null);
      setFeedback({
        tone: "success",
        text: modalMode === "create" ? "Buyer created." : "Buyer updated.",
      });
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "Could not save the buyer.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAssignmentSave() {
    if (!accessToken || !selectedBuyer || !assignmentDirty) return;
    setSavingAssignments(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/portal/buyers", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: selectedBuyer.buyer.id,
          linked_puppy_ids: selectedPuppyIds,
        }),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not save puppy assignments.");
      }

      await refreshWorkspace(selectedBuyer.key);
      setFeedback({ tone: "success", text: "Puppy assignments saved." });
    } catch (error) {
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not save puppy assignments.",
      });
    } finally {
      setSavingAssignments(false);
    }
  }

  if (loading || (loadingData && !buyers.length && !loadError)) {
    return (
      <AdminPageShell>
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <WorkspaceSurface className="h-[70vh] animate-pulse" />
          <div className="space-y-4">
            <WorkspaceSurface className="h-44 animate-pulse" />
            <WorkspaceSurface className="h-[46vh] animate-pulse" />
          </div>
        </div>
      </AdminPageShell>
    );
  }

  if (!user || !isAdmin) {
    return (
      <AdminRestrictedState
        title="Access Restricted"
        details="Admin access is required to manage buyer files."
      />
    );
  }

  return (
    <AdminPageShell>
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <WorkspaceSurface>
          <SurfaceHeader
            eyebrow="Buyers"
            title="Buyer Directory"
            subtitle="Active files, financing households, and completed placements."
            action={
              <button type="button" onClick={openCreateModal} className={primaryButtonClass}>
                <Plus className="h-4 w-4" />
                Create Buyer
              </button>
            }
          />

          <div className="mt-5">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--portal-text-muted)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search buyers, puppies, city..."
                className="w-full rounded-[1.2rem] border border-[rgba(187,160,132,0.22)] bg-white/92 py-3 pl-11 pr-4 text-sm text-[var(--portal-text)] shadow-sm outline-none transition placeholder:text-[var(--portal-text-muted)] focus:border-[rgba(166,103,51,0.45)] focus:ring-4 focus:ring-[rgba(200,140,82,0.12)]"
              />
            </label>
          </div>

          <div className="mt-5 space-y-5">
            <DirectorySection
              title="Active"
              entries={groupedEntries.active}
              selectedKey={selectedBuyer?.key || ""}
              onSelect={setSelectedKey}
            />
            <DirectorySection
              title="Financing"
              entries={groupedEntries.financing}
              selectedKey={selectedBuyer?.key || ""}
              onSelect={setSelectedKey}
            />
            <DirectorySection
              title="Completed"
              entries={groupedEntries.completed}
              selectedKey={selectedBuyer?.key || ""}
              onSelect={setSelectedKey}
            />
          </div>
        </WorkspaceSurface>

        <div className="space-y-4">
          {loadError ? <FeedbackBanner tone="error" text={loadError} /> : null}
          {feedback ? <FeedbackBanner tone={feedback.tone} text={feedback.text} /> : null}

          {!selectedEntry ? (
            <WorkspaceSurface>
              <AdminEmptyState
                title="Select a buyer"
                description="Choose a buyer from the directory to open the workspace."
              />
            </WorkspaceSurface>
          ) : (
            <>
              <div className="sticky top-4 z-10">
                <WorkspaceSurface>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                        Buyer Workspace
                      </div>
                      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--portal-text)]">
                        {selectedBuyer?.displayName}
                      </h1>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[var(--portal-text-soft)]">
                        <span>{selectedBuyer?.email || "No email"}</span>
                        <span>{selectedBuyer?.phone || "No phone"}</span>
                        <span>{fmtMoney(selectedSummary?.balance || 0)} balance</span>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(selectedBuyer?.buyer.status || "pending")}`}
                        >
                          {selectedBuyer?.buyer.status || "pending"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={openEditModal} className={secondaryButtonClass}>
                        <PencilLine className="h-4 w-4" />
                        Edit Buyer
                      </button>
                      <button type="button" onClick={() => void handleRefresh()} className={secondaryButtonClass}>
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <TabButton active={activeTab === "profile"} onClick={() => setActiveTab("profile")} label="Profile" />
                    <TabButton active={activeTab === "puppies"} onClick={() => setActiveTab("puppies")} label={puppyTabLabel} />
                    <TabButton active={activeTab === "transportation"} onClick={() => setActiveTab("transportation")} label="Transportation" />
                    <TabButton active={activeTab === "payments"} onClick={() => setActiveTab("payments")} label="Payments" />
                    {financeEnabled ? (
                      <TabButton active={activeTab === "plan"} onClick={() => setActiveTab("plan")} label="Puppy Payment Plan" />
                    ) : null}
                    <TabButton active={activeTab === "documents"} onClick={() => setActiveTab("documents")} label="Documents" />
                    <TabButton active={activeTab === "activity"} onClick={() => setActiveTab("activity")} label="Activity" />
                  </div>
                </WorkspaceSurface>
              </div>

              {activeTab === "profile" ? (
                <ProfileTab record={selectedBuyer} account={selectedAccount} />
              ) : null}
              {activeTab === "puppies" ? (
                <PuppiesTab
                  entry={selectedEntry}
                  puppies={puppies}
                  puppySearch={puppySearch}
                  deferredPuppySearch={deferredPuppySearch}
                  selectedPuppyIds={selectedPuppyIds}
                  setPuppySearch={setPuppySearch}
                  setSelectedPuppyIds={setSelectedPuppyIds}
                  onSave={handleAssignmentSave}
                  saving={savingAssignments}
                  assignmentDirty={assignmentDirty}
                />
              ) : null}
              {activeTab === "transportation" ? (
                <TransportationTab record={selectedBuyer} requests={selectedRequests} />
              ) : null}
              {activeTab === "payments" ? <PaymentsTab entry={selectedEntry} /> : null}
              {activeTab === "documents" ? <DocumentsTab record={selectedBuyer} /> : null}
              {activeTab === "activity" ? <ActivityTab items={activityItems} /> : null}
              {activeTab === "plan" && financeEnabled ? <PlanTab entry={selectedEntry} /> : null}
            </>
          )}
        </div>
      </div>
      {modalMode ? (
        <BuyerModal
          mode={modalMode}
          form={modalForm}
          onChange={(key, value) => setModalForm((current) => ({ ...current, [key]: value }))}
          onClose={() => setModalMode(null)}
          onSave={() => void handleModalSave()}
          saving={savingProfile}
          error={modalError}
        />
      ) : null}
    </AdminPageShell>
  );
}

function DirectorySection({
  title,
  entries,
  selectedKey,
  onSelect,
}: {
  title: string;
  entries: BuyerEntry[];
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
          {title}
        </div>
        <div className="text-xs text-[var(--portal-text-muted)]">{entries.length}</div>
      </div>

      {entries.length ? (
        <div className="space-y-1.5">
          {entries.map((entry) => (
            <button
              key={entry.record.key}
              type="button"
              onClick={() => onSelect(entry.record.key)}
              className={[
                "flex w-full items-center justify-between gap-3 rounded-[1rem] px-3 py-3 text-left transition",
                entry.record.key === selectedKey
                  ? "bg-[rgba(243,232,219,0.92)] text-[var(--portal-text)]"
                  : "bg-transparent text-[var(--portal-text)] hover:bg-[rgba(248,242,234,0.78)]",
              ].join(" ")}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{entry.record.displayName}</div>
                <div className="mt-0.5 truncate text-xs text-[var(--portal-text-soft)]">
                  {entry.record.linkedPuppies.length
                    ? entry.record.linkedPuppies.map((puppy) => puppyLabel(puppy)).join(", ")
                    : entry.record.email || "No puppy linked"}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xs font-semibold text-[var(--portal-text)]">
                  {fmtMoney(entry.summary.balance)}
                </div>
                <div className="mt-0.5 text-[11px] text-[var(--portal-text-muted)]">
                  {entry.summary.financeEnabled ? "Plan ready" : entry.record.buyer.status || "pending"}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-[1rem] px-3 py-4 text-sm text-[var(--portal-text-soft)]">
          No buyer files in this section.
        </div>
      )}
    </div>
  );
}

function TabButton({
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
        "rounded-full px-4 py-2 text-sm font-semibold transition",
        active
          ? "bg-[rgba(200,140,82,0.18)] text-[var(--portal-text)]"
          : "bg-transparent text-[var(--portal-text-soft)] hover:bg-[rgba(248,242,234,0.82)] hover:text-[var(--portal-text)]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function ProfileTab({
  record,
  account,
}: {
  record: BuyerRecord | null;
  account: BuyerAccount | null;
}) {
  if (!record) return null;

  return (
    <WorkspaceSurface>
      <SurfaceHeader
        eyebrow="Profile"
        title="Buyer Profile"
        subtitle="Core contact details and portal context."
      />
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <ReadField label="Buyer Name" value={record.displayName} />
        <ReadField label="Email" value={record.email || "No email on file"} />
        <ReadField label="Phone" value={record.phone || "No phone on file"} />
        <ReadField
          label="Portal Access"
          value={record.hasPortalAccount ? "Connected" : "Not connected"}
          detail={
            record.portalUser?.last_sign_in_at
              ? `Last sign-in ${fmtDate(record.portalUser.last_sign_in_at)}`
              : "No portal sign-in yet"
          }
        />
        <ReadField
          label="Application"
          value={record.latestApplicationStatus || "No application"}
          detail={
            record.latestApplication?.created_at
              ? `Submitted ${fmtDate(record.latestApplication.created_at)}`
              : `${record.applicationCount} applications`
          }
        />
        <ReadField
          label="Location"
          value={[record.buyer.city, record.buyer.state].filter(Boolean).join(", ") || "Not set"}
        />
        <ReadField label="Notes" value={record.buyer.notes || "No notes saved yet."} wrap />
        <ReadField
          label="Payments"
          value={account ? `${fmtMoney(account.totalPaid || 0)} recorded` : "No ledger synced yet"}
          detail={
            account?.lastPaymentAt
              ? `Last payment ${fmtDate(account.lastPaymentAt)}`
              : "Payments appear once recorded"
          }
          wrap
        />
      </div>
    </WorkspaceSurface>
  );
}

function PuppiesTab({
  entry,
  puppies,
  puppySearch,
  deferredPuppySearch,
  selectedPuppyIds,
  setPuppySearch,
  setSelectedPuppyIds,
  onSave,
  saving,
  assignmentDirty,
}: {
  entry: BuyerEntry | null;
  puppies: PuppyOption[];
  puppySearch: string;
  deferredPuppySearch: string;
  selectedPuppyIds: number[];
  setPuppySearch: (value: string) => void;
  setSelectedPuppyIds: React.Dispatch<React.SetStateAction<number[]>>;
  onSave: () => void;
  saving: boolean;
  assignmentDirty: boolean;
}) {
  if (!entry) return null;

  const buyerId = entry.record.buyer.id;
  const selectedLookup = new Set(selectedPuppyIds);
  const query = deferredPuppySearch.trim().toLowerCase();
  const filteredPuppies = puppies
    .filter((puppy) => {
      if (!query) return true;
      return [puppyLabel(puppy), puppy.litter_name, puppy.dam, puppy.status, puppy.buyerName]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(query);
    })
    .sort((left, right) => puppyLabel(left).localeCompare(puppyLabel(right)));

  function togglePuppy(puppy: PuppyOption) {
    const assignedBuyerId = Number(puppy.buyer_id || 0);
    if (assignedBuyerId && assignedBuyerId !== buyerId) return;
    setSelectedPuppyIds((current) =>
      current.includes(puppy.id)
        ? current.filter((value) => value !== puppy.id)
        : [...current, puppy.id]
    );
  }

  return (
    <WorkspaceSurface>
      <SurfaceHeader
        eyebrow={entry.record.linkedPuppies.length === 1 ? "Puppy" : "Puppies"}
        title="Assignment"
        subtitle="Select the puppies that belong to this buyer file, then save once the placement looks right."
        action={
          <button
            type="button"
            onClick={onSave}
            disabled={!assignmentDirty || saving}
            className={primaryButtonClass}
          >
            {saving ? "Saving..." : "Save Assignment"}
          </button>
        }
      />

      <div className="mt-5 space-y-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--portal-text-muted)]" />
          <input
            value={puppySearch}
            onChange={(event) => setPuppySearch(event.target.value)}
            placeholder="Search puppies, litter, dam..."
            className="w-full rounded-[1.2rem] border border-[rgba(187,160,132,0.22)] bg-white/92 py-3 pl-11 pr-4 text-sm text-[var(--portal-text)] shadow-sm outline-none transition placeholder:text-[var(--portal-text-muted)] focus:border-[rgba(166,103,51,0.45)] focus:ring-4 focus:ring-[rgba(200,140,82,0.12)]"
          />
        </label>

        {filteredPuppies.length ? (
          <div className="overflow-hidden rounded-[1.1rem] border border-[rgba(187,160,132,0.18)]">
            {filteredPuppies.map((puppy, index) => {
              const assignedBuyerId = Number(puppy.buyer_id || 0);
              const lockedToOtherBuyer = assignedBuyerId > 0 && assignedBuyerId !== buyerId;
              const selected = selectedLookup.has(puppy.id);

              return (
                <label
                  key={`puppy-${puppy.id}`}
                  className={[
                    "flex cursor-pointer items-center gap-4 bg-white px-4 py-4 transition",
                    index > 0 ? "border-t border-[rgba(187,160,132,0.14)]" : "",
                    lockedToOtherBuyer
                      ? "cursor-not-allowed bg-[rgba(250,245,239,0.82)]"
                      : "hover:bg-[rgba(248,242,234,0.7)]",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={lockedToOtherBuyer}
                    onChange={() => togglePuppy(puppy)}
                    className="h-4 w-4 rounded border-[var(--portal-border)] text-[#a56733] focus:ring-[#c88c52]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[var(--portal-text)]">
                          {puppyLabel(puppy)}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-[var(--portal-text-soft)]">
                          {[puppy.litter_name, puppy.dam ? `Dam: ${puppy.dam}` : null]
                            .filter(Boolean)
                            .join(" | ") || "No litter details"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-[var(--portal-text)]">
                          {fmtMoney(toNumber(puppy.price || puppy.list_price))}
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--portal-text-muted)]">
                          {lockedToOtherBuyer
                            ? `Assigned to ${puppy.buyerName || "another buyer"}`
                            : selected
                              ? "Selected"
                              : "Available"}
                        </div>
                      </div>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        ) : (
          <AdminEmptyState
            title="No puppies match this search"
            description="Try a different puppy name, litter, or dam."
          />
        )}
      </div>
    </WorkspaceSurface>
  );
}

function TransportationTab({
  record,
  requests,
}: {
  record: BuyerRecord | null;
  requests: TransportationRequest[];
}) {
  if (!record) return null;

  return (
    <WorkspaceSurface>
      <SurfaceHeader
        eyebrow="Transportation"
        title="Transportation"
        subtitle="Delivery preferences and transportation requests for this buyer."
        action={
          <Link
            href={`/admin/portal/transportation?buyer=${record.buyer.id}`}
            className={secondaryButtonClass}
          >
            Open Transportation
          </Link>
        }
      />
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <ReadField label="Transportation Type" value={record.buyer.delivery_option || "Not set"} />
        <ReadField
          label="Transportation Date"
          value={record.buyer.delivery_date ? fmtDate(record.buyer.delivery_date) : "Not scheduled"}
        />
        <ReadField label="Location" value={record.buyer.delivery_location || "No location saved"} wrap />
        <ReadField
          label="Fee / Miles"
          value={record.buyer.delivery_fee ? fmtMoney(record.buyer.delivery_fee) : "Not set"}
          detail={record.buyer.delivery_miles ? `${record.buyer.delivery_miles} miles` : "Mileage not saved"}
        />
      </div>
      <div className="mt-5 space-y-3">
        {requests.length ? (
          requests.map((request) => (
            <div
              key={`transport-request-${request.id}`}
              className="rounded-[1.1rem] bg-[rgba(250,245,239,0.86)] px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--portal-text)]">
                    {request.request_type || "Transportation request"}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                    {request.request_date ? fmtDate(request.request_date) : "No date"}
                    {request.location_text || request.address_text
                      ? ` | ${request.location_text || request.address_text}`
                      : ""}
                  </div>
                </div>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(request.status || "pending")}`}
                >
                  {request.status || "pending"}
                </span>
              </div>
              {request.notes ? (
                <div className="mt-3 text-sm leading-6 text-[var(--portal-text-soft)]">{request.notes}</div>
              ) : null}
            </div>
          ))
        ) : (
          <AdminEmptyState
            title="No transportation requests yet"
            description="Transportation activity for this buyer will appear here."
          />
        )}
      </div>
    </WorkspaceSurface>
  );
}

function PaymentsTab({ entry }: { entry: BuyerEntry | null }) {
  if (!entry) return null;

  const ledgerRows = [
    ...(entry.account?.payments || []).map((payment) => ({
      key: `payment-${payment.id}`,
      date: payment.payment_date,
      type: payment.payment_type || "Payment",
      detail: [payment.method, payment.note].filter(Boolean).join(" | "),
      amount: payment.amount,
      status: payment.status || "recorded",
    })),
    ...(entry.account?.adjustments || []).map((adjustment) => ({
      key: `adjustment-${adjustment.id}`,
      date: adjustment.entry_date,
      type: adjustment.label || adjustment.entry_type || "Adjustment",
      detail: adjustment.description || "",
      amount: adjustment.amount,
      status: adjustment.status || "recorded",
    })),
  ].sort((left, right) => new Date(right.date || 0).getTime() - new Date(left.date || 0).getTime());

  return (
    <WorkspaceSurface>
      <SurfaceHeader
        eyebrow="Payments"
        title="Payments"
        subtitle="Financial history for this buyer file."
        action={
          <Link
            href={`/admin/portal/payments?buyer=${entry.record.buyer.id}`}
            className={secondaryButtonClass}
          >
            Open Full Ledger
          </Link>
        }
      />
      <div className="mt-5 grid gap-4 lg:grid-cols-4">
        <ReadField label="Purchase" value={fmtMoney(entry.summary.purchasePrice)} />
        <ReadField label="Deposit" value={fmtMoney(entry.summary.deposit)} />
        <ReadField label="Paid" value={fmtMoney(entry.summary.totalPaid)} />
        <ReadField
          label="Balance"
          value={fmtMoney(entry.summary.balance)}
          detail={entry.summary.lastPaymentAt ? `Last payment ${fmtDate(entry.summary.lastPaymentAt)}` : "No payment recorded yet"}
        />
      </div>
      <div className="mt-5">
        {ledgerRows.length ? (
          <div className="overflow-x-auto rounded-[1.1rem] border border-[rgba(187,160,132,0.18)] bg-white">
            <table className="min-w-full divide-y divide-[rgba(187,160,132,0.18)] text-sm">
              <thead className="bg-[rgba(250,245,239,0.86)] text-left text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Entry</th>
                  <th className="px-4 py-3">Detail</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(187,160,132,0.14)]">
                {ledgerRows.map((row) => (
                  <tr key={row.key}>
                    <td className="px-4 py-3 text-[var(--portal-text-soft)]">{row.date ? fmtDate(row.date) : "No date"}</td>
                    <td className="px-4 py-3 font-semibold text-[var(--portal-text)]">{row.type}</td>
                    <td className="px-4 py-3 text-[var(--portal-text-soft)]">{row.detail || "No detail"}</td>
                    <td className="px-4 py-3 text-[var(--portal-text)]">{fmtMoney(toNumber(row.amount))}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(row.status || "recorded")}`}
                      >
                        {row.status || "recorded"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminEmptyState
            title="No payment history yet"
            description="Payments and adjustments will appear here once they are recorded."
          />
        )}
      </div>
    </WorkspaceSurface>
  );
}

function DocumentsTab({ record }: { record: BuyerRecord | null }) {
  if (!record) return null;

  return (
    <WorkspaceSurface>
      <SurfaceHeader
        eyebrow="Documents"
        title="Documents"
        subtitle="Signed forms and packet items for this buyer."
        action={<Link href="/admin/portal/documents" className={secondaryButtonClass}>Open Documents</Link>}
      />
      <div className="mt-5 space-y-3">
        {record.forms.length ? (
          record.forms.map((form) => (
            <div key={`form-${form.id}`} className="rounded-[1.1rem] bg-[rgba(250,245,239,0.86)] px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--portal-text)]">
                    {form.form_title || form.form_key || "Portal form"}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                    {form.submitted_at || form.updated_at || form.created_at
                      ? fmtDate(form.submitted_at || form.updated_at || form.created_at || "")
                      : "Not filed yet"}
                    {form.signed_name ? ` | Signed by ${form.signed_name}` : ""}
                  </div>
                </div>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(form.status || "submitted")}`}
                >
                  {form.status || "submitted"}
                </span>
              </div>
            </div>
          ))
        ) : (
          <AdminEmptyState
            title="No buyer documents yet"
            description="Portal forms and signed packet items will appear here once submitted."
          />
        )}
      </div>
    </WorkspaceSurface>
  );
}

function ActivityTab({ items }: { items: ActivityItem[] }) {
  return (
    <WorkspaceSurface>
      <SurfaceHeader eyebrow="Activity" title="Activity" subtitle="A single timeline for this buyer file." />
      <div className="mt-5 space-y-3">
        {items.length ? (
          items.map((item) => (
            <div key={item.key} className="rounded-[1.1rem] bg-[rgba(250,245,239,0.86)] px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                    {item.category}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[var(--portal-text)]">{item.title}</div>
                  <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                    {item.date ? fmtDate(item.date) : "No date"}
                    {item.detail ? ` | ${item.detail}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  {item.amount != null ? (
                    <div className="text-sm font-semibold text-[var(--portal-text)]">
                      {fmtMoney(item.amount)}
                    </div>
                  ) : null}
                  <span
                    className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(item.status || "recorded")}`}
                  >
                    {item.status || "recorded"}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <AdminEmptyState
            title="No activity yet"
            description="Payments, forms, and transportation updates will build this timeline automatically."
          />
        )}
      </div>
    </WorkspaceSurface>
  );
}

function PlanTab({ entry }: { entry: BuyerEntry | null }) {
  if (!entry || !entry.summary.financeEnabled) return null;

  return (
    <WorkspaceSurface>
      <SurfaceHeader
        eyebrow="Puppy Payment Plan"
        title="Puppy Payment Plan"
        subtitle="Financing terms, billing sync, and notice preferences for this buyer."
        action={
          <Link
            href={`/admin/portal/puppy-financing?buyer=${entry.record.buyer.id}`}
            className={secondaryButtonClass}
          >
            Open Financing
          </Link>
        }
      />
      <div className="mt-5 grid gap-4 lg:grid-cols-4">
        <ReadField
          label="Monthly"
          value={entry.summary.monthlyAmount ? fmtMoney(entry.summary.monthlyAmount) : "Not set"}
          detail={entry.summary.financeMonths ? `${entry.summary.financeMonths} month term` : "No term saved"}
        />
        <ReadField
          label="APR / Rate"
          value={entry.summary.financeRate ? `${entry.summary.financeRate}%` : "Not set"}
          detail={entry.summary.financeAdminFee ? "Admin fee enabled" : "Admin fee off"}
        />
        <ReadField
          label="Next Due"
          value={entry.summary.nextDueDate ? fmtDate(entry.summary.nextDueDate) : "Not set"}
          detail={entry.summary.lastPaymentAt ? `Last payment ${fmtDate(entry.summary.lastPaymentAt)}` : "No payment posted yet"}
        />
        <ReadField
          label="Subscription"
          value={entry.account?.billing_subscription?.subscription_status || "Not synced"}
          detail={entry.account?.billing_subscription?.plan_name || entry.account?.billing_subscription?.plan_code || "No billing plan synced"}
        />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <ReadField
          label="Saved Method"
          value={entry.account?.billing_subscription?.card_last_four ? `Ending ${entry.account.billing_subscription.card_last_four}` : "Not synced"}
          detail={entry.account?.billing_subscription?.next_billing_at ? `Next billing ${fmtDate(entry.account.billing_subscription.next_billing_at)}` : "Recurring billing has not synced yet"}
          wrap
        />
        <ReadField
          label="Notice Settings"
          value={entry.account?.payment_notice_settings?.enabled ? "Enabled" : "Not configured"}
          detail={entry.account?.payment_notice_settings ? `Due ${entry.account.payment_notice_settings.due_reminder_enabled ? `${entry.account.payment_notice_settings.due_reminder_days_before}d before` : "off"} | Late ${entry.account.payment_notice_settings.late_notice_enabled ? `${entry.account.payment_notice_settings.late_notice_days_after}d after` : "off"} | Default ${entry.account.payment_notice_settings.default_notice_enabled ? `${entry.account.payment_notice_settings.default_notice_days_after}d after` : "off"}` : "Notice defaults appear once saved"}
          wrap
        />
      </div>
    </WorkspaceSurface>
  );
}

function BuyerModal({
  mode,
  form,
  onChange,
  onClose,
  onSave,
  saving,
  error,
}: {
  mode: Exclude<BuyerModalMode, null>;
  form: BuyerForm;
  onChange: (key: keyof BuyerForm, value: string) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  error: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(34,24,17,0.42)] px-4 py-8 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[1.6rem] border border-[rgba(255,255,255,0.45)] bg-[rgba(255,252,247,0.98)] p-6 shadow-[0_30px_80px_rgba(66,44,24,0.28)]">
        <SurfaceHeader
          eyebrow={mode === "create" ? "Create Buyer" : "Edit Buyer"}
          title={mode === "create" ? "Start a new buyer file" : "Update buyer profile"}
          subtitle="Create Buyer and Edit Buyer share the same modal so the main workspace stays focused."
          action={<button type="button" onClick={onClose} className={secondaryButtonClass}>Close</button>}
        />

        {error ? (
          <div className="mt-4 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <AdminTextInput label="Buyer Name" value={form.full_name} onChange={(value) => onChange("full_name", value)} placeholder="Whitney Suarez" />
            <AdminTextInput label="Email" value={form.email} onChange={(value) => onChange("email", value)} placeholder="buyer@email.com" />
            <AdminTextInput label="Phone" value={form.phone} onChange={(value) => onChange("phone", value)} placeholder="(555) 555-5555" />
            <AdminSelectInput label="Status" value={form.status} onChange={(value) => onChange("status", value)} options={[{ value: "pending", label: "Pending" }, { value: "approved", label: "Approved" }, { value: "completed", label: "Completed" }]} />
            <AdminTextInput label="City" value={form.city} onChange={(value) => onChange("city", value)} placeholder="City" />
            <AdminTextInput label="State" value={form.state} onChange={(value) => onChange("state", value)} placeholder="State" />
          </div>

          <AdminTextAreaInput label="Notes" value={form.notes} onChange={(value) => onChange("notes", value)} rows={4} placeholder="Buyer notes, household context, or approval notes." />

          <div className="rounded-[1.2rem] bg-[rgba(250,245,239,0.86)] p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
              Transportation
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <AdminSelectInput label="Transportation Type" value={form.delivery_option} onChange={(value) => onChange("delivery_option", value)} options={[{ value: "", label: "Not set" }, { value: "pickup", label: "Pickup" }, { value: "meet", label: "Meet-Up" }, { value: "dropoff", label: "Drop-Off" }, { value: "transportation", label: "Transportation" }]} />
              <AdminDateInput label="Transportation Date" value={form.delivery_date} onChange={(value) => onChange("delivery_date", value)} />
              <AdminTextInput label="Location" value={form.delivery_location} onChange={(value) => onChange("delivery_location", value)} placeholder="Airport, city, or meet-up point" />
              <AdminNumberInput label="Mileage" value={form.delivery_miles} onChange={(value) => onChange("delivery_miles", value)} placeholder="0" min={0} />
              <AdminNumberInput label="Transportation Fee" value={form.delivery_fee} onChange={(value) => onChange("delivery_fee", value)} placeholder="0.00" min={0} step="0.01" />
              <AdminNumberInput label="Gas Cost" value={form.expense_gas} onChange={(value) => onChange("expense_gas", value)} placeholder="0.00" min={0} step="0.01" />
              <AdminNumberInput label="Hotel Cost" value={form.expense_hotel} onChange={(value) => onChange("expense_hotel", value)} placeholder="0.00" min={0} step="0.01" />
              <AdminNumberInput label="Tolls" value={form.expense_tolls} onChange={(value) => onChange("expense_tolls", value)} placeholder="0.00" min={0} step="0.01" />
            </div>
            <div className="mt-4">
              <AdminTextAreaInput label="Transportation Notes" value={form.expense_misc} onChange={(value) => onChange("expense_misc", value)} rows={3} placeholder="Special route notes or miscellaneous transportation details." />
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="button" onClick={onSave} disabled={saving} className={primaryButtonClass}>
            {saving ? "Saving..." : mode === "create" ? "Create Buyer" : "Save Buyer"}
          </button>
        </div>
      </div>
    </div>
  );
}
