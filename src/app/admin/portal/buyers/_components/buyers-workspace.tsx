"use client";

import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileUp, PencilLine, Plus, RefreshCw, Search } from "lucide-react";
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
    address_line1?: string | null;
    address_line2?: string | null;
    status?: string | null;
    notes?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
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
    phone?: string | null;
    street_address?: string | null;
    city_state?: string | null;
    zip?: string | null;
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
  documents: Array<{
    id: string;
    title?: string | null;
    description?: string | null;
    category?: string | null;
    status?: string | null;
    created_at?: string | null;
    source_table?: string | null;
    file_name?: string | null;
    file_url?: string | null;
    visible_to_user?: boolean | null;
    signed_at?: string | null;
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
    sex?: string | null;
    color?: string | null;
    coat_type?: string | null;
    coat?: string | null;
    pattern?: string | null;
    dob?: string | null;
    registry?: string | null;
    status?: string | null;
    price?: number | null;
    list_price?: number | null;
    deposit?: number | null;
    balance?: number | null;
    photo_url?: string | null;
    image_url?: string | null;
    description?: string | null;
    notes?: string | null;
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
    finance_day_of_month?: number | null;
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
  payment_notice_logs?: Array<{
    id: number;
    created_at: string;
    notice_kind: string;
    notice_key: string;
    notice_date?: string | null;
    due_date?: string | null;
    status: string;
    recipient_email: string;
    subject: string;
    provider: string;
  }>;
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
  miles?: number | null;
  notes?: string | null;
  status?: string | null;
  buyer?: {
    id: number;
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
  address_line1: string;
  address_line2: string;
  postal_code: string;
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
type BuyerDirectoryFilter = "active" | "financing" | "completed";
type FuelEstimate = {
  requestedMonth: string;
  priceMonth: string;
  usedFallbackMonth: boolean;
  pricePerGallon: number;
  miles: number;
  assumedVehicle: string;
  assumedMpg: number;
  gallonsEstimated: number;
  estimatedFuelCost: number;
  pricingSeries: string;
};

const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(159,99,49,0.18)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--portal-border)] bg-white/90 px-4 py-2.5 text-sm font-semibold text-[var(--portal-text)] shadow-sm transition hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60";

function emptyBuyerForm(): BuyerForm {
  return {
    full_name: "",
    email: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    postal_code: "",
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

function formatBuyerAddress(record: BuyerRecord | null) {
  if (!record) return "";
  return [
    record.buyer.address_line1,
    record.buyer.address_line2,
    [record.buyer.city, record.buyer.state].filter(Boolean).join(", "),
    record.buyer.postal_code,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" | ");
}

function formatApplicationAddress(record: BuyerRecord | null) {
  if (!record?.latestApplication) return "";
  return [
    record.latestApplication.street_address,
    record.latestApplication.city_state,
    record.latestApplication.zip,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" | ");
}

function deliveryFeeStatus(record: BuyerRecord | null) {
  const fee = toNumber(record?.buyer.delivery_fee);
  const miles = toNumber(record?.buyer.delivery_miles);
  const option = String(record?.buyer.delivery_option || "").trim().toLowerCase();

  if (!record) return "Not set";
  if (option === "pickup") return "Pickup";
  if (fee > 0) return "Charged";
  if (miles > 0 || option === "meet" || option === "dropoff") return "Waived";
  return "Not set";
}

function matchesPaymentPlanForm(formKey: string | null | undefined) {
  const normalized = String(formKey || "").trim().toLowerCase();
  return ["puppy_payment_plan_agreement", "payment_plan_application", "credit_application"].includes(
    normalized
  );
}

function matchesPaymentPlanDocument(
  category: string | null | undefined,
  title: string | null | undefined,
  description: string | null | undefined
) {
  const text = [category, title, description].map((value) => String(value || "").toLowerCase()).join(" ");
  return ["finance", "financing", "payment plan", "credit application"].some((token) =>
    text.includes(token)
  );
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
    address_line1: String(record.buyer.address_line1 || ""),
    address_line2: String(record.buyer.address_line2 || ""),
    postal_code: String(record.buyer.postal_code || ""),
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
    ...record.documents.map((document) => ({
      key: `uploaded-document-${document.id}`,
      date: String(document.signed_at || document.created_at || ""),
      category: "Uploaded Document",
      title: document.title || document.file_name || "Buyer upload",
      detail: [document.category, document.description, document.file_name]
        .filter(Boolean)
        .join(" | "),
      status: document.status || "uploaded",
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
  const [directoryFilter, setDirectoryFilter] = useState<BuyerDirectoryFilter>("active");
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

  const visibleDirectoryEntries = groupedEntries[directoryFilter];

  useEffect(() => {
    if (!visibleDirectoryEntries.length) {
      setSelectedKey("");
      return;
    }
    if (!visibleDirectoryEntries.some((entry) => entry.record.key === selectedKey)) {
      setSelectedKey(visibleDirectoryEntries[0].record.key);
    }
  }, [selectedKey, visibleDirectoryEntries]);

  const selectedEntry =
    entries.find((entry) => entry.record.key === selectedKey) ||
    visibleDirectoryEntries.find((entry) => entry.record.key === selectedKey) ||
    visibleDirectoryEntries[0] ||
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
  const selectedPuppyDetails = useMemo(
    () =>
      selectedPuppyIds
        .map((puppyId) => puppies.find((puppy) => puppy.id === puppyId) || null)
        .filter((puppy): puppy is PuppyOption => Boolean(puppy)),
    [puppies, selectedPuppyIds]
  );

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

          <div className="mt-5">
            <div className="flex flex-wrap gap-2">
              <DirectoryFilterButton
                active={directoryFilter === "active"}
                label={`Active (${groupedEntries.active.length})`}
                onClick={() => setDirectoryFilter("active")}
              />
              <DirectoryFilterButton
                active={directoryFilter === "financing"}
                label={`Puppy Payment Plans (${groupedEntries.financing.length})`}
                onClick={() => setDirectoryFilter("financing")}
              />
              <DirectoryFilterButton
                active={directoryFilter === "completed"}
                label={`Completed (${groupedEntries.completed.length})`}
                onClick={() => setDirectoryFilter("completed")}
              />
            </div>
          </div>

          <div className="mt-5">
            <DirectorySection
              title={
                directoryFilter === "active"
                  ? "Active"
                  : directoryFilter === "financing"
                    ? "Puppy Payment Plans"
                    : "Completed"
              }
              entries={visibleDirectoryEntries}
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
                  selectedPuppyDetails={selectedPuppyDetails}
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
              {activeTab === "documents" ? (
                <DocumentsTab
                  record={selectedBuyer}
                  accessToken={accessToken || ""}
                  onUploaded={() => void refreshWorkspace(selectedBuyer?.key)}
                />
              ) : null}
              {activeTab === "activity" ? <ActivityTab items={activityItems} /> : null}
              {activeTab === "plan" && financeEnabled ? (
                <PlanTab
                  entry={selectedEntry}
                  accessToken={accessToken || ""}
                  onUploaded={() => void refreshWorkspace(selectedBuyer?.key)}
                />
              ) : null}
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

function DirectoryFilterButton({
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
        "rounded-full px-3.5 py-2 text-xs font-semibold transition",
        active
          ? "bg-[rgba(200,140,82,0.2)] text-[var(--portal-text)]"
          : "bg-[rgba(248,242,234,0.75)] text-[var(--portal-text-soft)] hover:bg-[rgba(243,232,219,0.85)] hover:text-[var(--portal-text)]",
      ].join(" ")}
    >
      {label}
    </button>
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

  const buyerAddress = formatBuyerAddress(record);
  const applicationAddress = formatApplicationAddress(record);

  return (
    <WorkspaceSurface>
      <SurfaceHeader
        eyebrow="Profile"
        title="Buyer Profile"
        subtitle="Core contact details, address, notes, and portal context."
      />
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <ReadField label="Buyer Name" value={record.displayName} />
        <ReadField label="Email" value={record.email || "No email on file"} />
        <ReadField label="Phone" value={record.phone || "No phone on file"} />
        <ReadField
          label="Street Address"
          value={buyerAddress || "No buyer address saved"}
          detail={applicationAddress ? `Application: ${applicationAddress}` : "Address can be added in Edit Buyer."}
          wrap
        />
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
          detail={record.buyer.postal_code ? `ZIP ${record.buyer.postal_code}` : "ZIP not saved"}
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
  selectedPuppyDetails,
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
  selectedPuppyDetails: PuppyOption[];
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
        {selectedPuppyDetails.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {selectedPuppyDetails.map((puppy) => (
              <div
                key={`selected-puppy-${puppy.id}`}
                className="overflow-hidden rounded-[1.2rem] border border-[rgba(187,160,132,0.18)] bg-white"
              >
                <div className="grid gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="min-h-[220px] bg-[rgba(246,238,228,0.82)]">
                    {puppy.photo_url || puppy.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={puppy.photo_url || puppy.image_url || ""}
                        alt={puppyLabel(puppy)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--portal-text-soft)]">
                        No puppy photo uploaded yet.
                      </div>
                    )}
                  </div>
                  <div className="space-y-4 p-5">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                        Selected Puppy
                      </div>
                      <div className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--portal-text)]">
                        {puppyLabel(puppy)}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                        {[puppy.litter_name, puppy.dam ? `Dam: ${puppy.dam}` : null, puppy.sire ? `Sire: ${puppy.sire}` : null]
                          .filter(Boolean)
                          .join(" | ") || "No litter or parent details saved yet."}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <ReadField label="Price" value={fmtMoney(toNumber(puppy.price || puppy.list_price))} />
                      <ReadField label="Deposit / Balance" value={`${fmtMoney(toNumber(puppy.deposit))} / ${fmtMoney(toNumber(puppy.balance))}`} />
                      <ReadField label="Status" value={puppy.status || "Not set"} />
                      <ReadField
                        label="Details"
                        value={[puppy.sex, puppy.color, puppy.coat_type || puppy.coat, puppy.pattern]
                          .filter(Boolean)
                          .join(" | ") || "No extra details"}
                        wrap
                      />
                    </div>

                    {(puppy.description || puppy.notes || puppy.dob || puppy.registry) ? (
                      <div className="rounded-[1rem] bg-[rgba(250,245,239,0.86)] px-4 py-4 text-sm leading-6 text-[var(--portal-text-soft)]">
                        {puppy.dob ? <div><strong className="text-[var(--portal-text)]">DOB:</strong> {fmtDate(puppy.dob)}</div> : null}
                        {puppy.registry ? <div><strong className="text-[var(--portal-text)]">Registry:</strong> {puppy.registry}</div> : null}
                        {puppy.description ? <div><strong className="text-[var(--portal-text)]">Description:</strong> {puppy.description}</div> : null}
                        {puppy.notes ? <div><strong className="text-[var(--portal-text)]">Notes:</strong> {puppy.notes}</div> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[1.2rem] bg-[rgba(250,245,239,0.82)] px-5 py-4 text-sm text-[var(--portal-text-soft)]">
            Select a puppy in the assignment list to see its detailed information here before saving.
          </div>
        )}

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
  const [fuelEstimate, setFuelEstimate] = useState<FuelEstimate | null>(null);
  const [fuelError, setFuelError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadFuelEstimate() {
      if (!record) {
        if (active) {
          setFuelEstimate(null);
          setFuelError("");
        }
        return;
      }

      const deliveryDate = String(record.buyer.delivery_date || "").trim();
      const deliveryMiles = toNumber(record.buyer.delivery_miles);

      if (!deliveryDate || !deliveryMiles) {
        if (active) {
          setFuelEstimate(null);
          setFuelError("");
        }
        return;
      }

      try {
        const response = await fetch(
          `/api/admin/portal/transportation/fuel-estimate?date=${encodeURIComponent(deliveryDate)}&miles=${encodeURIComponent(String(deliveryMiles))}`,
          { cache: "no-store" }
        );
        const payload = (await response.json()) as {
          ok?: boolean;
          error?: string;
          requestedMonth?: string;
          priceMonth?: string;
          usedFallbackMonth?: boolean;
          pricePerGallon?: number;
          miles?: number;
          assumedVehicle?: string;
          assumedMpg?: number;
          gallonsEstimated?: number;
          estimatedFuelCost?: number;
          pricingSeries?: string;
        };

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Could not estimate the fuel cost.");
        }

        if (active) {
          setFuelEstimate({
            requestedMonth: payload.requestedMonth || "",
            priceMonth: payload.priceMonth || "",
            usedFallbackMonth: Boolean(payload.usedFallbackMonth),
            pricePerGallon: toNumber(payload.pricePerGallon),
            miles: toNumber(payload.miles),
            assumedVehicle: String(payload.assumedVehicle || "2014 Kia Rio"),
            assumedMpg: toNumber(payload.assumedMpg) || 31,
            gallonsEstimated: toNumber(payload.gallonsEstimated),
            estimatedFuelCost: toNumber(payload.estimatedFuelCost),
            pricingSeries: String(payload.pricingSeries || ""),
          });
          setFuelError("");
        }
      } catch (error) {
        if (active) {
          setFuelEstimate(null);
          setFuelError(error instanceof Error ? error.message : "Could not estimate fuel.");
        }
      }
    }

    void loadFuelEstimate();
    return () => {
      active = false;
    };
  }, [record]);

  if (!record) return null;

  return (
    <WorkspaceSurface>
      <SurfaceHeader
        eyebrow="Transportation"
        title="Transportation"
        subtitle="Transportation cost details, fee status, mileage, and request history for this buyer."
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
          label="Fee Status"
          value={deliveryFeeStatus(record)}
          detail={record.buyer.delivery_fee ? `${fmtMoney(record.buyer.delivery_fee)} charged` : "No transportation fee recorded"}
        />
        <ReadField
          label="Mileage"
          value={record.buyer.delivery_miles ? `${record.buyer.delivery_miles} miles` : "Mileage not saved"}
          detail="Mileage can be entered in Edit Buyer and drives the gas estimate below."
        />
        <ReadField
          label="Tolls / Hotel"
          value={`${fmtMoney(toNumber(record.buyer.expense_tolls))} / ${fmtMoney(toNumber(record.buyer.expense_hotel))}`}
          detail={record.buyer.expense_misc || "No extra transportation notes saved"}
          wrap
        />
        <ReadField
          label="Estimated Gas"
          value={fuelEstimate ? fmtMoney(fuelEstimate.estimatedFuelCost) : record.buyer.expense_gas ? fmtMoney(record.buyer.expense_gas) : "Not available yet"}
          detail={
            fuelEstimate
              ? `${fuelEstimate.miles.toFixed(0)} miles / ${fuelEstimate.assumedMpg} MPG (${fuelEstimate.assumedVehicle}) x ${fmtMoney(fuelEstimate.pricePerGallon)} per gallon for ${fuelEstimate.priceMonth}${fuelEstimate.usedFallbackMonth ? " (closest available month)" : ""}.`
              : fuelError || "Add a transportation date and mileage to calculate the fuel estimate automatically."
          }
          wrap
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
                    {request.miles ? ` | ${request.miles} miles` : ""}
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

function DocumentUploadPanel({
  buyerId,
  accessToken,
  defaultCategory,
  heading,
  description,
  onUploaded,
}: {
  buyerId: number;
  accessToken: string;
  defaultCategory: string;
  heading: string;
  description: string;
  onUploaded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [visibleToUser, setVisibleToUser] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleUpload() {
    if (!accessToken) {
      setError("Admin access token is missing. Refresh and try again.");
      return;
    }
    if (!file) {
      setError("Choose a scanned form or document to upload.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("buyer_id", String(buyerId));
      formData.append("title", title.trim());
      formData.append("description", notes.trim());
      formData.append("category", category);
      formData.append("visible_to_user", visibleToUser ? "true" : "false");
      formData.append("file", file);

      const response = await fetch("/api/admin/portal/buyer-documents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not upload the document.");
      }

      setTitle("");
      setNotes("");
      setFile(null);
      setSuccess("Document uploaded and attached to this buyer.");
      onUploaded();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload the document.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-[1.2rem] border border-[rgba(187,160,132,0.18)] bg-[rgba(250,245,239,0.82)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
            {heading}
          </div>
          <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{description}</div>
        </div>
        <button type="button" onClick={handleUpload} disabled={submitting} className={primaryButtonClass}>
          <FileUp className="h-4 w-4" />
          {submitting ? "Uploading..." : "Upload Scan"}
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <AdminTextInput label="Document Title" value={title} onChange={setTitle} placeholder="Signed payment plan agreement" />
        <AdminSelectInput
          label="Category"
          value={category}
          onChange={setCategory}
          options={[
            { value: "buyer_forms", label: "Buyer Forms" },
            { value: "financing", label: "Financing" },
            { value: "placement", label: "Placement" },
            { value: "transportation", label: "Transportation" },
            { value: "health", label: "Health" },
          ]}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
            Scanned File
          </label>
          <input
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="mt-2 block w-full rounded-[1rem] border border-[rgba(187,160,132,0.22)] bg-white px-4 py-3 text-sm text-[var(--portal-text)] file:mr-4 file:rounded-full file:border-0 file:bg-[rgba(200,140,82,0.16)] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[var(--portal-text)]"
          />
        </div>
        <label className="flex items-center gap-3 rounded-[1rem] border border-[rgba(187,160,132,0.18)] bg-white px-4 py-3 text-sm text-[var(--portal-text)]">
          <input
            type="checkbox"
            checked={visibleToUser}
            onChange={(event) => setVisibleToUser(event.target.checked)}
            className="h-4 w-4 rounded border-[var(--portal-border)] text-[#a56733] focus:ring-[#c88c52]"
          />
          Visible to buyer
        </label>
      </div>

      <div className="mt-4">
        <AdminTextAreaInput
          label="Notes"
          value={notes}
          onChange={setNotes}
          rows={3}
          placeholder="Optional notes about the uploaded form or scan."
        />
      </div>

      {error ? <div className="mt-4 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {success ? <div className="mt-4 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}
    </div>
  );
}

function DocumentsTab({
  record,
  accessToken,
  onUploaded,
}: {
  record: BuyerRecord | null;
  accessToken: string;
  onUploaded: () => void;
}) {
  if (!record) return null;

  return (
    <WorkspaceSurface>
      <SurfaceHeader
        eyebrow="Documents"
        title="Documents"
        subtitle="Signed portal forms and scanned uploads attached to this buyer file."
        action={<Link href="/admin/portal/documents" className={secondaryButtonClass}>Open Documents</Link>}
      />

      <div className="mt-5">
        <DocumentUploadPanel
          buyerId={record.buyer.id}
          accessToken={accessToken}
          defaultCategory="buyer_forms"
          heading="Upload Scanned Forms"
          description="Attach scanned contracts, handwritten notes, or forms that were completed outside the website. Every uploaded file stays visible on this buyer record."
          onUploaded={onUploaded}
        />
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
            Portal Forms
          </div>
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
              title="No portal forms yet"
              description="Portal-generated forms will appear here after they are completed."
            />
          )}
        </div>

        <div className="space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
            Uploaded Scans
          </div>
          {record.documents.length ? (
            record.documents.map((document) => (
              <div key={`doc-${document.id}`} className="rounded-[1.1rem] bg-[rgba(250,245,239,0.86)] px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--portal-text)]">
                      {document.title || document.file_name || "Buyer upload"}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                      {document.created_at ? fmtDate(document.created_at) : "Date unavailable"}
                      {document.category ? ` | ${document.category}` : ""}
                      {document.file_name ? ` | ${document.file_name}` : ""}
                    </div>
                    {document.description ? (
                      <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                        {document.description}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(document.status || "uploaded")}`}
                    >
                      {document.status || "uploaded"}
                    </span>
                    {document.file_url ? (
                      <a href={document.file_url} target="_blank" rel="noreferrer" className={secondaryButtonClass}>
                        Open File
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <AdminEmptyState
              title="No uploaded scans yet"
              description="Scanned contracts and outside paperwork will appear here after upload."
            />
          )}
        </div>
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

function PlanTab({
  entry,
  accessToken,
  onUploaded,
}: {
  entry: BuyerEntry | null;
  accessToken: string;
  onUploaded: () => void;
}) {
  if (!entry || !entry.summary.financeEnabled) return null;

  const financingForms = entry.record.forms.filter((form) => matchesPaymentPlanForm(form.form_key));
  const financingDocuments = entry.record.documents.filter((document) =>
    matchesPaymentPlanDocument(document.category, document.title, document.description)
  );
  const recentNoticeLogs = entry.account?.payment_notice_logs || [];

  return (
    <WorkspaceSurface>
      <SurfaceHeader
        eyebrow="Puppy Payment Plan"
        title="Puppy Payment Plan"
        subtitle="Financing terms, subscription state, notice cadence, and payment-plan paperwork live together here."
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
        <ReadField label="Principal" value={fmtMoney(entry.summary.purchasePrice)} detail="Current financed puppy total." />
        <ReadField label="Deposit" value={fmtMoney(entry.summary.deposit)} detail={`${fmtMoney(entry.summary.balance)} balance remaining`} />
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
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-4">
        <ReadField
          label="Next Due"
          value={entry.summary.nextDueDate ? fmtDate(entry.summary.nextDueDate) : "Not set"}
          detail={
            entry.account?.buyer.finance_day_of_month
              ? `Due around day ${entry.account.buyer.finance_day_of_month} each month`
              : "Monthly due day not saved"
          }
        />
        <ReadField
          label="Last Payment"
          value={entry.summary.lastPaymentAt ? fmtDate(entry.summary.lastPaymentAt) : "No payment yet"}
          detail={entry.summary.totalPaid ? `${fmtMoney(entry.summary.totalPaid)} paid to date` : "No payment history recorded"}
        />
        <ReadField
          label="Subscription"
          value={entry.account?.billing_subscription?.subscription_status || "Not synced"}
          detail={entry.account?.billing_subscription?.plan_name || entry.account?.billing_subscription?.plan_code || "No billing plan synced"}
        />
        <ReadField
          label="Recurring Amount"
          value={entry.account?.billing_subscription?.recurring_price ? fmtMoney(entry.account.billing_subscription.recurring_price) : "Not synced"}
          detail={
            entry.account?.billing_subscription?.next_billing_at
              ? `Next billing ${fmtDate(entry.account.billing_subscription.next_billing_at)}`
              : "Recurring billing has not synced yet"
          }
        />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <ReadField
          label="Saved Method"
          value={entry.account?.billing_subscription?.card_last_four ? `Ending ${entry.account.billing_subscription.card_last_four}` : "Not synced"}
          detail={
            entry.account?.billing_subscription?.customer_name || entry.record.displayName
          }
          wrap
        />
        <ReadField
          label="Notice Settings"
          value={entry.account?.payment_notice_settings?.enabled ? "Enabled" : "Not configured"}
          detail={entry.account?.payment_notice_settings ? `Receipts ${entry.account.payment_notice_settings.receipt_enabled ? "on" : "off"} | Due ${entry.account.payment_notice_settings.due_reminder_enabled ? `${entry.account.payment_notice_settings.due_reminder_days_before}d before` : "off"} | Late ${entry.account.payment_notice_settings.late_notice_enabled ? `${entry.account.payment_notice_settings.late_notice_days_after}d after` : "off"} | Default ${entry.account.payment_notice_settings.default_notice_enabled ? `${entry.account.payment_notice_settings.default_notice_days_after}d after` : "off"}` : "Notice defaults appear once saved"}
          wrap
        />
      </div>

      <div className="mt-5">
        <DocumentUploadPanel
          buyerId={entry.record.buyer.id}
          accessToken={accessToken}
          defaultCategory="financing"
          heading="Upload Payment Plan Documents"
          description="If the payment plan application, credit application, or signed agreement was handled offline, upload the scanned copy here so it stays tied to this buyer's financing record."
          onUploaded={onUploaded}
        />
      </div>

      <div className="mt-5 grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
            Payment Plan Forms
          </div>
          {financingForms.length ? (
            financingForms.map((form) => (
              <div key={`finance-form-${form.id}`} className="rounded-[1.1rem] bg-[rgba(250,245,239,0.86)] px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--portal-text)]">
                      {form.form_title || form.form_key || "Payment plan form"}
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
              title="No payment-plan forms yet"
              description="Website-submitted financing forms will appear here automatically."
            />
          )}
        </div>

        <div className="space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
            Uploaded Financing Documents
          </div>
          {financingDocuments.length ? (
            financingDocuments.map((document) => (
              <div key={`finance-doc-${document.id}`} className="rounded-[1.1rem] bg-[rgba(250,245,239,0.86)] px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--portal-text)]">
                      {document.title || document.file_name || "Financing upload"}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                      {document.created_at ? fmtDate(document.created_at) : "Date unavailable"}
                      {document.file_name ? ` | ${document.file_name}` : ""}
                    </div>
                    {document.description ? (
                      <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                        {document.description}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(document.status || "uploaded")}`}
                    >
                      {document.status || "uploaded"}
                    </span>
                    {document.file_url ? (
                      <a href={document.file_url} target="_blank" rel="noreferrer" className={secondaryButtonClass}>
                        Open File
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <AdminEmptyState
              title="No offline financing docs yet"
              description="Upload scanned plan applications and agreements here when they were not completed in the portal."
            />
          )}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
          Recent Notice Activity
        </div>
        {recentNoticeLogs.length ? (
          recentNoticeLogs.map((log) => (
            <div key={`notice-log-${log.id}`} className="rounded-[1.1rem] bg-[rgba(250,245,239,0.86)] px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--portal-text)]">
                    {log.subject}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                    {fmtDate(log.created_at)} | {log.notice_kind} | {log.recipient_email}
                    {log.due_date ? ` | Due ${fmtDate(log.due_date)}` : ""}
                  </div>
                </div>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(log.status || "sent")}`}
                >
                  {log.status || "sent"}
                </span>
              </div>
            </div>
          ))
        ) : (
          <AdminEmptyState
            title="No notice log yet"
            description="Receipts, due reminders, late notices, and default notices will appear here after they are sent."
          />
        )}
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
