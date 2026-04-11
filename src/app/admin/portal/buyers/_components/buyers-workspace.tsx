"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
    created_at?: string | null;
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
    full_name?: string | null;
    email?: string | null;
    applicant_email?: string | null;
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
    signed_date?: string | null;
    signed_at?: string | null;
    status?: string | null;
    submitted_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    data?: Record<string, unknown> | null;
    payload?: Record<string, unknown> | null;
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
    status?: string | null;
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
    currency_code?: string | null;
    billing_cycles?: number | null;
    next_billing_at?: string | null;
    current_term_ends_at?: string | null;
    last_payment_at?: string | null;
    last_payment_amount?: number | null;
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
  payment_notice_logs?: Array<{
    id: number;
    created_at: string;
    notice_kind: string;
    status: string;
    subject: string;
    recipient_email: string;
  }>;
  totalPaid: number;
  lastPaymentAt: string | null;
};

type TransportationRequest = {
  id: number;
  created_at?: string | null;
  request_date?: string | null;
  request_type?: string | null;
  miles?: number | null;
  location_text?: string | null;
  address_text?: string | null;
  notes?: string | null;
  status?: string | null;
  buyer?: {
    id: number;
    full_name?: string | null;
    name?: string | null;
    email?: string | null;
  } | null;
  puppy?: {
    id: number;
    call_name?: string | null;
    puppy_name?: string | null;
    name?: string | null;
    status?: string | null;
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
  | "plan"
  | "documents"
  | "activity";

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

const headerButtonClass =
  "inline-flex items-center justify-center rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)]";
const primaryButtonClass =
  "inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(159,99,49,0.22)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-60";

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

function isCompletedStatus(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  return (
    normalized.includes("complete") ||
    normalized.includes("closed") ||
    normalized.includes("finished")
  );
}

function puppyLabel(puppy: PuppyOption | TransportationRequest["puppy"] | null | undefined) {
  if (!puppy) return "No puppy linked";
  return puppy.call_name || puppy.puppy_name || puppy.name || `Puppy #${puppy.id}`;
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
    delivery_fee:
      record.buyer.delivery_fee == null ? "" : String(record.buyer.delivery_fee),
    expense_gas:
      record.buyer.expense_gas == null ? "" : String(record.buyer.expense_gas),
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
  const totalPaid = account?.payments
    .filter((payment) => {
      const normalized = String(payment.status || "").trim().toLowerCase();
      return !["failed", "void", "cancelled", "canceled"].includes(normalized);
    })
    .reduce((sum, payment) => sum + toNumber(payment.amount), 0) || 0;
  const adjustments = account?.adjustments
    .filter((adjustment) => {
      const normalized = String(adjustment.status || "").trim().toLowerCase();
      return !["failed", "void", "cancelled", "canceled"].includes(normalized);
    })
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

  const paymentItems: ActivityItem[] = (account?.payments || []).map((payment) => ({
    key: `payment-${payment.id}`,
    date: payment.payment_date || "",
    category: "Payment",
    title: payment.payment_type || "Payment recorded",
    detail: [payment.method, payment.note].filter(Boolean).join(" | "),
    amount: payment.amount,
    status: payment.status || "recorded",
  }));

  const adjustmentItems: ActivityItem[] = (account?.adjustments || []).map((adjustment) => ({
    key: `adjustment-${adjustment.id}`,
    date: adjustment.entry_date || "",
    category: "Adjustment",
    title: adjustment.label || adjustment.entry_type || "Ledger adjustment",
    detail: adjustment.description || "",
    amount: adjustment.amount,
    status: adjustment.status || "recorded",
  }));

  const requestItems: ActivityItem[] = requests.map((request) => ({
    key: `transport-${request.id}`,
    date: String(request.request_date || request.created_at || ""),
    category: "Transportation",
    title: request.request_type || "Transportation request",
    detail:
      request.location_text ||
      request.address_text ||
      request.notes ||
      puppyLabel(request.puppy),
    status: request.status || "pending",
  }));

  const documentItems: ActivityItem[] = record.forms.map((form) => ({
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
  }));

  const applicationItems: ActivityItem[] = record.latestApplication
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
    : [];

  return [
    ...paymentItems,
    ...adjustmentItems,
    ...requestItems,
    ...documentItems,
    ...applicationItems,
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

  if (!buyersRes.ok) {
    throw new Error(buyersPayload.error || "Could not load buyers.");
  }
  if (!accountsRes.ok) {
    throw new Error(accountsPayload.error || "Could not load buyer payments.");
  }
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

export function AdminBuyersWorkspace() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const [buyers, setBuyers] = useState<BuyerRecord[]>([]);
  const [puppies, setPuppies] = useState<PuppyOption[]>([]);
  const [accounts, setAccounts] = useState<BuyerAccount[]>([]);
  const [requests, setRequests] = useState<TransportationRequest[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [statusText, setStatusText] = useState("");
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
      if (current && payload.buyers.some((buyer) => buyer.key === current)) {
        return current;
      }
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
      buyers.map((record) => ({
        record,
        account: accountsByBuyerId.get(record.buyer.id) || null,
        summary: summarizeBuyer(record, accountsByBuyerId.get(record.buyer.id) || null),
      })),
    [accountsByBuyerId, buyers]
  );

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries.filter(({ record }) => {
      if (!query) return true;
      return [
        record.displayName,
        record.email,
        record.phone,
        record.buyer.city,
        record.buyer.state,
        record.buyer.notes,
        ...record.linkedPuppies.map((puppy) => puppyLabel(puppy)),
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(query);
    });
  }, [entries, search]);

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
    if (!filteredEntries.length) return;
    if (filteredEntries.some((entry) => entry.record.key === selectedKey)) return;
    setSelectedKey(filteredEntries[0].record.key);
  }, [filteredEntries, selectedKey]);

  const selectedEntry = filteredEntries.some((entry) => entry.record.key === selectedKey)
    ? entries.find((entry) => entry.record.key === selectedKey) || null
    : filteredEntries[0] || null;
  const selectedBuyer = selectedEntry?.record || null;
  const selectedAccount = selectedEntry?.account || null;
  const selectedSummary = selectedEntry?.summary || null;
  const linkedPuppies = useMemo(
    () =>
      selectedAccount?.linkedPuppies?.length
        ? selectedAccount.linkedPuppies
        : selectedBuyer?.linkedPuppies || [],
    [selectedAccount, selectedBuyer]
  );
  const originalPuppyIds = useMemo(
    () => linkedPuppies.map((puppy) => puppy.id),
    [linkedPuppies]
  );
  const originalPuppyIdsKey = useMemo(
    () => originalPuppyIds.join(","),
    [originalPuppyIds]
  );

  const buyerRequests = useMemo(
    () =>
      selectedBuyer
        ? requests
            .filter((request) => Number(request.buyer?.id || 0) === selectedBuyer.buyer.id)
            .sort(
              (left, right) =>
                new Date(right.created_at || right.request_date || 0).getTime() -
                new Date(left.created_at || left.request_date || 0).getTime()
            )
        : [],
    [requests, selectedBuyer]
  );

  const activityItems = useMemo(
    () => buildActivityItems(selectedBuyer, selectedAccount, buyerRequests),
    [buyerRequests, selectedAccount, selectedBuyer]
  );

  useEffect(() => {
    setSelectedPuppyIds(originalPuppyIds);
    setPuppySearch("");
  }, [selectedKey, originalPuppyIds, originalPuppyIdsKey]);

  const puppyTabLabel = selectedPuppyIds.length === 1 ? "Puppy" : "Puppies";
  const tabs = useMemo(() => {
    const nextTabs = [
      { key: "profile" as const, label: "Profile" },
      { key: "puppies" as const, label: puppyTabLabel },
      { key: "transportation" as const, label: "Transportation" },
      { key: "payments" as const, label: "Payments" },
      ...(selectedSummary?.financeEnabled
        ? [{ key: "plan" as const, label: "Puppy Payment Plan" }]
        : []),
      { key: "documents" as const, label: "Documents" },
      { key: "activity" as const, label: "Activity" },
    ];
    return nextTabs;
  }, [puppyTabLabel, selectedSummary?.financeEnabled]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.key === activeTab)) {
      setActiveTab("puppies");
    }
  }, [activeTab, tabs]);

  async function saveBuyerProfile() {
    if (!accessToken || !modalMode) return;

    if (!modalForm.full_name.trim() || !modalForm.email.trim()) {
      setModalError("Name and email are required.");
      return;
    }

    setSavingProfile(true);
    setModalError("");
    setStatusText("");

    try {
      const response = await fetch("/api/admin/portal/buyers", {
        method: modalMode === "create" ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          ...(modalMode === "edit" ? { id: selectedBuyer?.buyer.id } : {}),
          ...modalForm,
        }),
      });

      const payload = (await response.json()) as { buyerId?: number; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not save buyer.");
      }

      await refreshWorkspace(payload.buyerId ? String(payload.buyerId) : selectedKey);
      setModalMode(null);
      setStatusText(modalMode === "create" ? "Buyer created." : "Buyer updated.");
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "Could not save buyer.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveAssignments() {
    if (!accessToken || !selectedBuyer) return;
    setSavingAssignments(true);
    setStatusText("");
    try {
      const response = await fetch("/api/admin/portal/buyers", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          id: selectedBuyer.buyer.id,
          linked_puppy_ids: selectedPuppyIds,
        }),
      });

      const payload = (await response.json()) as { buyerId?: number; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not save puppy assignments.");
      }

      await refreshWorkspace(String(payload.buyerId || selectedBuyer.buyer.id));
      setStatusText("Puppy assignments updated.");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not save puppy assignments.");
    } finally {
      setSavingAssignments(false);
    }
  }

  if (loading || loadingData) {
    return (
      <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">
        Loading buyers...
      </div>
    );
  }

  if (!user) {
    return (
      <AdminRestrictedState
        title="Sign in to access buyers."
        details="This workspace is reserved for the Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!isAdmin) {
    return (
      <AdminRestrictedState
        title="This buyer workspace is limited to approved owner accounts."
        details="Only the approved owner emails can manage buyer records and assignments."
      />
    );
  }

  const assignmentDirty = !sameNumberSet(selectedPuppyIds, originalPuppyIds);
  const activeCount = groupedEntries.active.length;
  const financingCount = groupedEntries.financing.length;
  const completedCount = groupedEntries.completed.length;

  return (
    <AdminPageShell>
      <div className="space-y-4 pb-10">
        <section className="premium-card rounded-[1.6rem] p-5 md:p-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_420px]">
            <div>
              <div className="inline-flex rounded-full border border-[rgba(200,168,132,0.45)] bg-[rgba(248,242,234,0.92)] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8c6848]">
                Buyer Workspace
              </div>
              <h1 className="mt-4 text-[1.9rem] font-semibold leading-[1.05] tracking-[-0.05em] text-[var(--portal-text)] [font-family:var(--font-merriweather)] md:text-[2.25rem]">
                A cleaner buyer command center built around assignments, payments, and next actions.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--portal-text-soft)]">
                The buyer file now opens into a focused, tab-driven workspace instead of one long
                scroll stack. Puppy assignment leads the flow, while profile, transportation,
                payments, documents, and activity stay one click away.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setModalForm(emptyBuyerForm());
                    setModalError("");
                    setModalMode("create");
                  }}
                  className={primaryButtonClass}
                >
                  Create Buyer
                </button>
                <Link href="/admin/portal/payments" className={headerButtonClass}>
                  Open Payments
                </Link>
                <Link href="/admin/portal/transportation" className={headerButtonClass}>
                  Open Transportation
                </Link>
              </div>
            </div>

            <div className="overflow-hidden rounded-[1.25rem] border border-[var(--portal-border)] bg-white">
              <div className="grid gap-px bg-[var(--portal-border)] sm:grid-cols-3">
                <MetricCell label="Active" value={String(activeCount)} detail="Ready for assignment and follow-up" />
                <MetricCell label="Financing" value={String(financingCount)} detail="Payment-plan households" />
                <MetricCell label="Completed" value={String(completedCount)} detail="Closed buyer files" />
              </div>
            </div>
          </div>
        </section>

        <section className="premium-card overflow-hidden rounded-[1.6rem]">
          <div className="grid xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="border-b border-[var(--portal-border)] bg-[rgba(249,245,238,0.72)] xl:border-b-0 xl:border-r">
              <div className="space-y-4 px-4 py-4 md:px-5">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search buyers, notes, puppies..."
                  className="w-full rounded-[16px] border border-[var(--portal-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--portal-text)] outline-none transition focus:border-[var(--portal-accent)] focus:ring-2 focus:ring-[rgba(90,142,245,0.14)]"
                />
                <SidebarSection label="Active" items={groupedEntries.active} selectedKey={selectedKey} onSelect={setSelectedKey} />
                <SidebarSection label="Financing" items={groupedEntries.financing} selectedKey={selectedKey} onSelect={setSelectedKey} />
                <SidebarSection label="Completed" items={groupedEntries.completed} selectedKey={selectedKey} onSelect={setSelectedKey} />
              </div>
            </aside>

            <div className="min-w-0">
              {selectedBuyer ? (
                <>
                  <div className="sticky top-0 z-10 border-b border-[var(--portal-border)] bg-[rgba(255,252,247,0.95)] px-4 py-4 backdrop-blur-md md:px-6">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                          Selected Buyer
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <h2 className="truncate text-[1.55rem] font-semibold tracking-[-0.04em] text-[var(--portal-text)]">
                            {selectedBuyer.displayName}
                          </h2>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(selectedBuyer.buyer.status || "pending")}`}>
                            {selectedBuyer.buyer.status || "pending"}
                          </span>
                        </div>
                        <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                          {[selectedBuyer.email || "No email", selectedBuyer.phone || "No phone", selectedBuyer.hasPortalAccount ? "Portal account linked" : "No portal account"].join(" | ")}
                        </div>
                        {statusText ? (
                          <div className="mt-3 rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-3.5 py-2.5 text-sm font-semibold text-[var(--portal-text-soft)]">
                            {statusText}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setModalForm(fillBuyerForm(selectedBuyer));
                            setModalError("");
                            setModalMode("edit");
                          }}
                          className={headerButtonClass}
                        >
                          Edit Buyer
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {tabs.map((tab) => (
                        <TabPill
                          key={tab.key}
                          active={activeTab === tab.key}
                          onClick={() => setActiveTab(tab.key)}
                        >
                          {tab.label}
                        </TabPill>
                      ))}
                    </div>
                  </div>

                  <div className="px-4 py-5 md:px-6 md:py-6">
                    {activeTab === "profile" ? <ProfileTab entry={selectedEntry} /> : null}
                    {activeTab === "puppies" ? (
                      <PuppiesTab
                        puppies={puppies}
                        selectedBuyer={selectedBuyer}
                        selectedPuppyIds={selectedPuppyIds}
                        setSelectedPuppyIds={setSelectedPuppyIds}
                        puppySearch={puppySearch}
                        setPuppySearch={setPuppySearch}
                        assignmentDirty={assignmentDirty}
                        savingAssignments={savingAssignments}
                        onSaveAssignments={() => void saveAssignments()}
                      />
                    ) : null}
                    {activeTab === "transportation" ? (
                      <TransportationTab record={selectedBuyer} requests={buyerRequests} />
                    ) : null}
                    {activeTab === "payments" ? (
                      <PaymentsTab entry={selectedEntry} />
                    ) : null}
                    {activeTab === "plan" ? (
                      <PaymentPlanTab entry={selectedEntry} />
                    ) : null}
                    {activeTab === "documents" ? (
                      <DocumentsTab record={selectedBuyer} />
                    ) : null}
                    {activeTab === "activity" ? (
                      <ActivityTab items={activityItems} />
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="p-8">
                  <AdminEmptyState
                    title={loadError || "No buyer selected"}
                    description={
                      loadError
                        ? "Refresh the page after the route issue is resolved."
                        : "Create a buyer or choose one from the sidebar to open the workspace."
                    }
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {modalMode ? (
        <BuyerModal
          mode={modalMode}
          form={modalForm}
          onChange={(key, value) => setModalForm((current) => ({ ...current, [key]: value }))}
          onClose={() => setModalMode(null)}
          onSave={() => void saveBuyerProfile()}
          saving={savingProfile}
          error={modalError}
        />
      ) : null}
    </AdminPageShell>
  );
}

function MetricCell({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="bg-white px-4 py-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-[var(--portal-text)]">{value}</div>
      <div className="mt-1.5 text-xs leading-5 text-[var(--portal-text-soft)]">{detail}</div>
    </div>
  );
}

function TabPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${
        active
          ? "border-[#b67b43] bg-[#c88c52] text-white shadow-sm"
          : "border-[var(--portal-border)] bg-white text-[var(--portal-text-soft)] hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)]"
      }`}
    >
      {children}
    </button>
  );
}

function SidebarSection({
  label,
  items,
  selectedKey,
  onSelect,
}: {
  label: string;
  items: BuyerEntry[];
  selectedKey: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
          {label}
        </div>
        <div className="text-[11px] font-semibold text-[var(--portal-text-muted)]">{items.length}</div>
      </div>
      {items.length ? (
        <div className="space-y-2">
          {items.map((entry) => (
            <button
              key={`${label}-${entry.record.key}`}
              type="button"
              onClick={() => onSelect(entry.record.key)}
              className={`block w-full rounded-[1.05rem] border px-4 py-3 text-left transition ${
                selectedKey === entry.record.key
                  ? "border-[var(--portal-border-strong)] bg-white shadow-[var(--portal-shadow-sm)]"
                  : "border-[var(--portal-border)] bg-[rgba(255,255,255,0.85)] hover:border-[var(--portal-border-strong)] hover:bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--portal-text)]">
                            {entry.record.displayName}
                          </div>
                          <div className="mt-1 truncate text-xs text-[var(--portal-text-soft)]">
                            {entry.record.linkedPuppies.length
                      ? `${entry.record.linkedPuppies.length} ${entry.record.linkedPuppies.length === 1 ? "puppy" : "puppies"}`
                      : "No puppy assigned"}
                          </div>
                </div>
                <span className="shrink-0 text-xs font-semibold text-[var(--portal-text)]">
                  {fmtMoney(entry.summary.balance)}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-[1rem] border border-dashed border-[var(--portal-border)] bg-[rgba(255,255,255,0.5)] px-3 py-4 text-sm text-[var(--portal-text-soft)]">
          No buyers in this section.
        </div>
      )}
    </div>
  );
}

function WorkspaceCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.4rem] border border-[var(--portal-border)] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
            {title}
          </div>
          {subtitle ? (
            <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{subtitle}</div>
          ) : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ProfileTab({ entry }: { entry: BuyerEntry | null }) {
  if (!entry) {
    return <AdminEmptyState title="No buyer selected" description="Choose a buyer to review the profile." />;
  }

  const { record, summary } = entry;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <WorkspaceCard title="Profile Overview" subtitle="Core buyer details and linked portal context.">
        <div className="grid gap-px overflow-hidden rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-border)] sm:grid-cols-2">
          <MetricCell label="Balance" value={fmtMoney(summary.balance)} detail="Remaining on the buyer ledger" />
          <MetricCell label="Purchase" value={fmtMoney(summary.purchasePrice)} detail="Combined puppy pricing on file" />
          <MetricCell label="Deposits" value={fmtMoney(summary.deposit)} detail="Saved deposit amount on the buyer record" />
          <MetricCell label="Portal" value={record.hasPortalAccount ? "Linked" : "Not linked"} detail={record.portalUser?.email || "No portal account found"} />
        </div>
      </WorkspaceCard>

      <WorkspaceCard title="Buyer Details" subtitle="Profile and transportation details now stay readable instead of living inside stacked forms.">
        <div className="grid gap-4 md:grid-cols-2">
          <ReadField label="Name" value={record.displayName} />
          <ReadField label="Status" value={record.buyer.status || "pending"} />
          <ReadField label="Email" value={record.email || "No email"} />
          <ReadField label="Phone" value={record.phone || "No phone"} />
          <ReadField label="City" value={record.buyer.city || "Not set"} />
          <ReadField label="State" value={record.buyer.state || "Not set"} />
          <ReadField label="Transportation" value={record.buyer.delivery_option || "Not set"} />
          <ReadField label="Next Delivery Date" value={record.buyer.delivery_date ? fmtDate(record.buyer.delivery_date) : "Not scheduled"} />
        </div>
        <div className="mt-4 rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4 text-sm leading-6 text-[var(--portal-text-soft)]">
          {record.buyer.notes || "No buyer notes have been added yet."}
        </div>
      </WorkspaceCard>
    </div>
  );
}

function PuppiesTab({
  puppies,
  selectedBuyer,
  selectedPuppyIds,
  setSelectedPuppyIds,
  puppySearch,
  setPuppySearch,
  assignmentDirty,
  savingAssignments,
  onSaveAssignments,
}: {
  puppies: PuppyOption[];
  selectedBuyer: BuyerRecord;
  selectedPuppyIds: number[];
  setSelectedPuppyIds: React.Dispatch<React.SetStateAction<number[]>>;
  puppySearch: string;
  setPuppySearch: (value: string) => void;
  assignmentDirty: boolean;
  savingAssignments: boolean;
  onSaveAssignments: () => void;
}) {
  const filteredPuppies = useMemo(() => {
    const query = puppySearch.trim().toLowerCase();
    return puppies.filter((puppy) => {
      if (!query) return true;
      return [
        puppyLabel(puppy),
        puppy.litter_name,
        puppy.status,
        puppy.buyerName,
        puppy.dam,
        puppy.sire,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(query);
    });
  }, [puppies, puppySearch]);

  function togglePuppy(puppyId: number) {
    setSelectedPuppyIds((current) =>
      current.includes(puppyId)
        ? current.filter((value) => value !== puppyId)
        : [...current, puppyId]
    );
  }

  return (
    <div className="space-y-5">
      <WorkspaceCard
        title="Puppy Assignment"
        subtitle="This tab is the default landing view so assignments stay fast, visible, and safe."
        action={
          <button
            type="button"
            onClick={onSaveAssignments}
            disabled={!assignmentDirty || savingAssignments}
            className={primaryButtonClass}
          >
            {savingAssignments ? "Saving..." : "Save Assignment"}
          </button>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <input
              value={puppySearch}
              onChange={(event) => setPuppySearch(event.target.value)}
              placeholder="Search puppies, litters, buyers..."
              className="w-full rounded-[16px] border border-[var(--portal-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--portal-text)] outline-none transition focus:border-[var(--portal-accent)] focus:ring-2 focus:ring-[rgba(90,142,245,0.14)]"
            />
            {assignmentDirty ? (
              <div className="mt-3 rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                Assignment changes are staged for {selectedBuyer.displayName} but not saved yet.
              </div>
            ) : null}
            <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {filteredPuppies.map((puppy) => {
                const assignedElsewhere =
                  Number(puppy.buyer_id || 0) > 0 &&
                  Number(puppy.buyer_id || 0) !== Number(selectedBuyer.buyer.id);
                const isSelected = selectedPuppyIds.includes(puppy.id);
                return (
                  <button
                    key={`puppy-option-${puppy.id}`}
                    type="button"
                    disabled={assignedElsewhere}
                    onClick={() => togglePuppy(puppy.id)}
                    className={`rounded-[1.1rem] border px-4 py-4 text-left transition ${
                      assignedElsewhere
                        ? "cursor-not-allowed border-rose-200 bg-rose-50/70 opacity-80"
                        : isSelected
                          ? "border-[#b67b43] bg-[rgba(200,140,82,0.12)] shadow-sm"
                          : "border-[var(--portal-border)] bg-white hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[var(--portal-text)]">
                          {puppyLabel(puppy)}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                          {[puppy.litter_name || "No litter", puppy.status || "pending"].join(" | ")}
                        </div>
                      </div>
                      <div className={`h-5 w-5 rounded-full border ${isSelected ? "border-[#b67b43] bg-[#c88c52]" : "border-[var(--portal-border)] bg-white"}`} />
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--portal-text)]">
                        {fmtMoney(toNumber(puppy.price || puppy.list_price))}
                      </span>
                      <span className="text-[var(--portal-text-soft)]">
                        {assignedElsewhere
                          ? `Assigned to ${puppy.buyerName || "another buyer"}`
                          : isSelected
                            ? "Assigned here"
                            : "Available to assign"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[1.1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
              Current Selection
            </div>
            <div className="mt-3 space-y-2">
              {selectedPuppyIds.length ? (
                selectedPuppyIds.map((id) => {
                  const puppy = puppies.find((item) => item.id === id) || null;
                  if (!puppy) return null;
                  return (
                    <div key={`selected-puppy-${id}`} className="rounded-[0.95rem] border border-[var(--portal-border)] bg-white px-3 py-3">
                      <div className="text-sm font-semibold text-[var(--portal-text)]">
                        {puppyLabel(puppy)}
                      </div>
                      <div className="mt-1 text-xs text-[var(--portal-text-soft)]">
                        {puppy.litter_name || "No litter"} | {fmtMoney(toNumber(puppy.price || puppy.list_price))}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[0.95rem] border border-dashed border-[var(--portal-border)] bg-white px-3 py-4 text-sm text-[var(--portal-text-soft)]">
                  No puppies currently assigned.
                </div>
              )}
            </div>
          </div>
        </div>
      </WorkspaceCard>
    </div>
  );
}

function TransportationTab({
  record,
  requests,
}: {
  record: BuyerRecord;
  requests: TransportationRequest[];
}) {
  const savedCost =
    toNumber(record.buyer.delivery_fee) +
    toNumber(record.buyer.expense_gas) +
    toNumber(record.buyer.expense_hotel) +
    toNumber(record.buyer.expense_tolls);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <WorkspaceCard title="Transportation Profile" subtitle="Saved transportation settings on the buyer file.">
        <div className="grid gap-4 md:grid-cols-2">
          <ReadField label="Request Type" value={record.buyer.delivery_option || "Not set"} />
          <ReadField label="Request Date" value={record.buyer.delivery_date ? fmtDate(record.buyer.delivery_date) : "Not scheduled"} />
          <ReadField label="Location" value={record.buyer.delivery_location || "Not set"} />
          <ReadField label="Miles" value={record.buyer.delivery_miles ? `${record.buyer.delivery_miles.toLocaleString()} mi` : "Not set"} />
          <ReadField label="Delivery Fee" value={fmtMoney(toNumber(record.buyer.delivery_fee))} />
          <ReadField label="Saved Total" value={fmtMoney(savedCost)} />
        </div>
        <div className="mt-4 rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4 text-sm leading-6 text-[var(--portal-text-soft)]">
          {record.buyer.expense_misc || "No additional transportation notes saved yet."}
        </div>
      </WorkspaceCard>

      <WorkspaceCard
        title="Transportation Requests"
        subtitle="Recent requests tied to this buyer."
        action={<Link href="/admin/portal/transportation" className={headerButtonClass}>Open Full Queue</Link>}
      >
        {requests.length ? (
          <div className="space-y-3">
            {requests.map((request) => (
              <div key={`request-${request.id}`} className="rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--portal-text)]">
                      {request.request_type || "Transportation request"}
                    </div>
                    <div className="mt-1 text-xs text-[var(--portal-text-soft)]">
                      {[request.request_date ? fmtDate(request.request_date) : "No date", puppyLabel(request.puppy)].join(" | ")}
                    </div>
                  </div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(request.status || "pending")}`}>
                    {request.status || "pending"}
                  </span>
                </div>
                <div className="mt-3 text-sm leading-6 text-[var(--portal-text-soft)]">
                  {request.location_text || request.address_text || request.notes || "No route details saved yet."}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <AdminEmptyState title="No transportation requests yet" description="Transportation activity for this buyer will appear here." />
        )}
      </WorkspaceCard>
    </div>
  );
}

function PaymentsTab({ entry }: { entry: BuyerEntry | null }) {
  if (!entry) {
    return <AdminEmptyState title="No buyer selected" description="Choose a buyer to review the ledger." />;
  }

  const { record, account, summary } = entry;
  const ledgerRows = [
    ...(account?.payments || []).map((payment) => ({
      key: `payment-${payment.id}`,
      date: payment.payment_date,
      type: payment.payment_type || "Payment",
      detail: [payment.method, payment.note].filter(Boolean).join(" | "),
      amount: payment.amount,
      status: payment.status || "recorded",
    })),
    ...(account?.adjustments || []).map((adjustment) => ({
      key: `adjustment-${adjustment.id}`,
      date: adjustment.entry_date,
      type: adjustment.label || adjustment.entry_type || "Adjustment",
      detail: adjustment.description || "",
      amount: adjustment.amount,
      status: adjustment.status || "recorded",
    })),
  ].sort((left, right) => new Date(right.date || 0).getTime() - new Date(left.date || 0).getTime());

  return (
    <div className="space-y-5">
      <WorkspaceCard
        title="Payments"
        subtitle="Balance and history stay visible without leaving the buyer file."
        action={<Link href={`/admin/portal/payments?buyer=${record.buyer.id}`} className={headerButtonClass}>Open Full Ledger</Link>}
      >
        <div className="grid gap-px overflow-hidden rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-border)] lg:grid-cols-4">
          <MetricCell label="Purchase" value={fmtMoney(summary.purchasePrice)} detail="Total puppy pricing on file" />
          <MetricCell label="Paid" value={fmtMoney(summary.totalPaid)} detail="Payments recorded so far" />
          <MetricCell label="Adjustments" value={fmtMoney(summary.adjustments)} detail="Fees, credits, and transportation entries" />
          <MetricCell label="Balance" value={fmtMoney(summary.balance)} detail={summary.lastPaymentAt ? `Last payment ${fmtDate(summary.lastPaymentAt)}` : "No payment recorded yet"} />
        </div>
      </WorkspaceCard>

      <WorkspaceCard title="Ledger History" subtitle="Combined payments and adjustments for faster review.">
        {ledgerRows.length ? (
          <div className="overflow-x-auto rounded-[1rem] border border-[var(--portal-border)]">
            <table className="min-w-full divide-y divide-[#eee1d2] text-sm">
              <thead className="bg-[var(--portal-surface-muted)] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Entry</th>
                  <th className="px-4 py-3">Detail</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1e6da] bg-white">
                {ledgerRows.map((row) => (
                  <tr key={row.key} className="hover:bg-[var(--portal-surface-muted)]">
                    <td className="px-4 py-3 text-[var(--portal-text-soft)]">{row.date ? fmtDate(row.date) : "No date"}</td>
                    <td className="px-4 py-3 font-semibold text-[var(--portal-text)]">{row.type}</td>
                    <td className="px-4 py-3 text-[var(--portal-text-soft)]">{row.detail || "No detail"}</td>
                    <td className="px-4 py-3 text-[var(--portal-text)]">{fmtMoney(toNumber(row.amount))}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(row.status || "recorded")}`}>
                        {row.status || "recorded"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminEmptyState title="No payment history yet" description="Payments and adjustments will appear here once they are recorded." />
        )}
      </WorkspaceCard>
    </div>
  );
}

function PaymentPlanTab({ entry }: { entry: BuyerEntry | null }) {
  if (!entry || !entry.summary.financeEnabled) {
    return <AdminEmptyState title="No puppy payment plan on this buyer" description="Enable financing to surface the payment-plan workspace for this household." />;
  }

  const { record, account, summary } = entry;

  return (
    <div className="space-y-5">
      <WorkspaceCard
        title="Puppy Payment Plan"
        subtitle="Financing details, subscription state, and notice settings stay grouped together."
        action={<Link href={`/admin/portal/puppy-financing?buyer=${record.buyer.id}${record.linkedPuppies[0] ? `&puppy=${record.linkedPuppies[0].id}` : ""}`} className={headerButtonClass}>Open Financing</Link>}
      >
        <div className="grid gap-px overflow-hidden rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-border)] lg:grid-cols-4">
          <MetricCell label="Monthly" value={summary.monthlyAmount ? fmtMoney(summary.monthlyAmount) : "Not set"} detail={summary.financeMonths ? `${summary.financeMonths} month term` : "No term saved"} />
          <MetricCell label="APR / Rate" value={summary.financeRate ? `${summary.financeRate}%` : "Not set"} detail={summary.financeAdminFee ? "Admin fee enabled" : "Admin fee off"} />
          <MetricCell label="Next Due" value={summary.nextDueDate ? fmtDate(summary.nextDueDate) : "Not set"} detail={summary.lastPaymentAt ? `Last payment ${fmtDate(summary.lastPaymentAt)}` : "No payment posted yet"} />
          <MetricCell label="Subscription" value={account?.billing_subscription?.subscription_status || "Not synced"} detail={account?.billing_subscription?.plan_name || account?.billing_subscription?.plan_code || "No billing plan synced"} />
        </div>
      </WorkspaceCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <WorkspaceCard title="Billing Subscription" subtitle="Recurring billing sync from Zoho Billing.">
          {account?.billing_subscription ? (
            <div className="grid gap-4 md:grid-cols-2">
              <ReadField label="Plan" value={account.billing_subscription.plan_name || account.billing_subscription.plan_code || "Not set"} />
              <ReadField label="Recurring Price" value={account.billing_subscription.recurring_price ? fmtMoney(account.billing_subscription.recurring_price) : "Not set"} />
              <ReadField label="Next Billing" value={account.billing_subscription.next_billing_at ? fmtDate(account.billing_subscription.next_billing_at) : "Not set"} />
              <ReadField label="Card" value={account.billing_subscription.card_last_four ? `•••• ${account.billing_subscription.card_last_four}` : "Not synced"} />
            </div>
          ) : (
            <AdminEmptyState title="No subscription synced yet" description="Start recurring billing from the puppy payments workspace to see it here." />
          )}
        </WorkspaceCard>

        <WorkspaceCard title="Notice Settings" subtitle="Receipt, due, late, and default notice preferences on this buyer account.">
          {account?.payment_notice_settings ? (
            <div className="grid gap-4 md:grid-cols-2">
              <ReadField label="Notices Enabled" value={account.payment_notice_settings.enabled ? "Yes" : "No"} />
              <ReadField label="Receipts" value={account.payment_notice_settings.receipt_enabled ? "On" : "Off"} />
              <ReadField label="Due Reminder" value={account.payment_notice_settings.due_reminder_enabled ? `${account.payment_notice_settings.due_reminder_days_before} days before` : "Off"} />
              <ReadField label="Late Notice" value={account.payment_notice_settings.late_notice_enabled ? `${account.payment_notice_settings.late_notice_days_after} days after` : "Off"} />
              <ReadField label="Default Notice" value={account.payment_notice_settings.default_notice_enabled ? `${account.payment_notice_settings.default_notice_days_after} days after` : "Off"} />
              <ReadField label="Recipient" value={account.payment_notice_settings.recipient_email || record.email || "No email"} />
            </div>
          ) : (
            <AdminEmptyState title="No notice settings saved" description="Notice defaults will appear here once a payment notice profile exists for this buyer." />
          )}
        </WorkspaceCard>
      </div>
    </div>
  );
}

function DocumentsTab({ record }: { record: BuyerRecord | null }) {
  if (!record) {
    return <AdminEmptyState title="No buyer selected" description="Choose a buyer to review documents." />;
  }

  return (
    <WorkspaceCard
      title="Documents"
      subtitle="Buyer forms and signed packet items stay in one place."
      action={<Link href="/admin/portal/documents" className={headerButtonClass}>Open Documents</Link>}
    >
      {record.forms.length ? (
        <div className="space-y-3">
          {record.forms.map((form) => (
            <div key={`form-${form.id}`} className="rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--portal-text)]">
                    {form.form_title || form.form_key || "Portal form"}
                  </div>
                  <div className="mt-1 text-xs text-[var(--portal-text-soft)]">
                    {form.submitted_at || form.updated_at || form.created_at
                      ? fmtDate(form.submitted_at || form.updated_at || form.created_at || "")
                      : "Not filed yet"}
                    {form.signed_name ? ` | Signed by ${form.signed_name}` : ""}
                  </div>
                </div>
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(form.status || "submitted")}`}>
                  {form.status || "submitted"}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <AdminEmptyState title="No buyer documents yet" description="Portal forms and signed packet items will appear here once submitted." />
      )}
    </WorkspaceCard>
  );
}

function ActivityTab({ items }: { items: ActivityItem[] }) {
  return (
    <WorkspaceCard title="Activity" subtitle="A single timeline across payments, documents, applications, and transportation.">
      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.key} className="rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                    {item.category}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[var(--portal-text)]">
                    {item.title}
                  </div>
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
                  <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(item.status || "recorded")}`}>
                    {item.status || "recorded"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <AdminEmptyState title="No activity yet" description="Payments, documents, and transportation updates will build this timeline automatically." />
      )}
    </WorkspaceCard>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">{value}</div>
    </div>
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
              {mode === "create" ? "Create Buyer" : "Edit Buyer"}
            </div>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--portal-text)]">
              {mode === "create" ? "Start a new buyer file" : "Update buyer profile"}
            </h3>
            <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
              Name and email are required. Everything else stays optional and can grow with the workspace later.
            </div>
          </div>
          <button type="button" onClick={onClose} className={headerButtonClass}>
            Close
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <AdminTextInput label="Buyer Name" value={form.full_name} onChange={(value) => onChange("full_name", value)} placeholder="Whitney Suarez" />
            <AdminTextInput label="Email" value={form.email} onChange={(value) => onChange("email", value)} placeholder="buyer@email.com" />
            <AdminTextInput label="Phone" value={form.phone} onChange={(value) => onChange("phone", value)} placeholder="(555) 555-5555" />
            <AdminSelectInput label="Status" value={form.status} onChange={(value) => onChange("status", value)} options={[{ value: "pending", label: "Pending" }, { value: "approved", label: "Approved" }, { value: "completed", label: "Completed" }]} />
            <AdminTextInput label="City" value={form.city} onChange={(value) => onChange("city", value)} placeholder="City" />
            <AdminTextInput label="State" value={form.state} onChange={(value) => onChange("state", value)} placeholder="State" />
          </div>

          <AdminTextAreaInput label="Notes" value={form.notes} onChange={(value) => onChange("notes", value)} rows={4} placeholder="Buyer notes, household context, or approval notes." />

          <div className="rounded-[1.2rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
              Transportation
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <AdminSelectInput label="Transportation Type" value={form.delivery_option} onChange={(value) => onChange("delivery_option", value)} options={[{ value: "", label: "Not set" }, { value: "pickup", label: "Pickup" }, { value: "meet", label: "Meet-Up" }, { value: "dropoff", label: "Drop-Off" }, { value: "transportation", label: "Transportation" }]} />
              <AdminDateInput label="Transportation Date" value={form.delivery_date} onChange={(value) => onChange("delivery_date", value)} />
              <AdminTextInput label="Location" value={form.delivery_location} onChange={(value) => onChange("delivery_location", value)} placeholder="Airport, city, or meet-up point" />
              <AdminNumberInput label="Mileage" value={form.delivery_miles} onChange={(value) => onChange("delivery_miles", value)} placeholder="0" min={0} />
              <AdminNumberInput label="Delivery Fee" value={form.delivery_fee} onChange={(value) => onChange("delivery_fee", value)} placeholder="0.00" min={0} step="0.01" />
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
          <button type="button" onClick={onClose} className={headerButtonClass}>
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
