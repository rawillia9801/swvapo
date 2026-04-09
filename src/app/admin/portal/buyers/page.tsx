"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AdminEmptyState,
  AdminInfoTile,
  AdminListCard,
  AdminPageShell,
  AdminPanel,
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
import {
  type DocumentLikeFormSubmission,
  documentPreviewRows,
  findMatchingDocumentSubmission,
  getDocumentSubmissionPayload,
  getVisiblePortalDocumentPacket,
  portalDocumentStatus,
} from "@/lib/portal-document-packet";
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
  portalUser: { email: string; last_sign_in_at?: string | null } | null;
  applicationCount: number;
  latestApplication: {
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

type PuppyOption = BuyerRecord["linkedPuppies"][number] & { buyerName?: string | null };

type BuyerAccount = {
  buyer: {
    id: number;
    sale_price?: number | null;
    deposit_amount?: number | null;
    finance_enabled?: boolean | null;
    finance_monthly_amount?: number | null;
    finance_months?: number | null;
    finance_rate?: number | null;
    finance_admin_fee?: boolean | null;
    finance_next_due_date?: string | null;
    finance_last_payment_date?: string | null;
  };
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
  linkedPuppies: PuppyOption[];
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
    phone?: string | null;
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

type BuyerActivity = {
  key: string;
  date: string;
  title: string;
  amount: number;
  detail: string;
  status: string;
};

const primaryButtonClass =
  "inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(159,99,49,0.22)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[0_12px_28px_rgba(106,76,45,0.08)] transition hover:-translate-y-0.5 hover:border-[var(--portal-border-strong)]";

function emptyForm(): BuyerForm {
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

function puppyLabel(puppy: PuppyOption | TransportationRequest["puppy"]) {
  if (!puppy) return "No puppy linked";
  return puppy.call_name || puppy.puppy_name || puppy.name || `Puppy #${puppy.id}`;
}

function displayDocDate(value: string | null | undefined) {
  return value ? fmtDate(value) : "Not filed yet";
}

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function complete(status: string | null | undefined) {
  return String(status || "").toLowerCase().includes("completed");
}

function summarizeBuyer(record: BuyerRecord, account: BuyerAccount | null) {
  const puppies = account?.linkedPuppies?.length ? account.linkedPuppies : record.linkedPuppies;
  const purchasePrice = puppies.length
    ? puppies.reduce((sum, puppy) => sum + num(puppy.price || puppy.list_price), 0)
    : num(account?.buyer.sale_price);
  const deposit = num(account?.buyer.deposit_amount);
  const totalPaid =
    account?.payments
      .filter(
        (payment) =>
          !["failed", "void", "cancelled", "canceled"].includes(
            String(payment.status || "").toLowerCase()
          )
      )
      .reduce((sum, payment) => sum + num(payment.amount), 0) || 0;
  const adjustments =
    account?.adjustments
      .filter(
        (adjustment) =>
          !["void", "cancelled", "canceled"].includes(
            String(adjustment.status || "").toLowerCase()
          )
      )
      .reduce((sum, adjustment) => sum + num(adjustment.amount), 0) || 0;

  return {
    purchasePrice,
    deposit,
    totalPaid,
    balance: Math.max(0, purchasePrice + adjustments - totalPaid),
    financeEnabled: Boolean(account?.buyer.finance_enabled),
    monthlyAmount: num(account?.buyer.finance_monthly_amount),
    financeMonths: num(account?.buyer.finance_months),
    financeRate: num(account?.buyer.finance_rate),
    financeAdminFee: Boolean(account?.buyer.finance_admin_fee),
    nextDueDate: account?.buyer.finance_next_due_date || "",
    lastPaymentAt: account?.lastPaymentAt || account?.buyer.finance_last_payment_date || "",
    activityCount: (account?.payments.length || 0) + (account?.adjustments.length || 0),
  };
}

function formatTransportType(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Not set";
  if (normalized === "dropoff" || normalized === "drop-off") return "Drop-Off";
  if (normalized === "meet" || normalized === "meet-up") return "Meet-Up";
  if (normalized === "transportation") return "Transportation";
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

async function fetchBuyers(accessToken: string) {
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
    ? ((await buyersRes.json()) as { buyers?: BuyerRecord[]; puppies?: PuppyOption[] })
    : {};
  const accountsPayload = accountsRes.ok
    ? ((await accountsRes.json()) as { accounts?: BuyerAccount[] })
    : {};
  const transportationPayload = transportationRes.ok
    ? ((await transportationRes.json()) as { requests?: TransportationRequest[] })
    : {};

  return {
    buyers: Array.isArray(buyersPayload.buyers) ? buyersPayload.buyers : [],
    puppies: Array.isArray(buyersPayload.puppies) ? buyersPayload.puppies : [],
    accounts: Array.isArray(accountsPayload.accounts) ? accountsPayload.accounts : [],
    requests: Array.isArray(transportationPayload.requests) ? transportationPayload.requests : [],
  };
}

export default function AdminPortalBuyersPage() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const [buyers, setBuyers] = useState<BuyerRecord[]>([]);
  const [puppies, setPuppies] = useState<PuppyOption[]>([]);
  const [accounts, setAccounts] = useState<BuyerAccount[]>([]);
  const [requests, setRequests] = useState<TransportationRequest[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [search, setSearch] = useState("");
  const [puppySearch, setPuppySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"active" | "completed">("active");
  const [selectedKey, setSelectedKey] = useState("");
  const [selectedPuppyIds, setSelectedPuppyIds] = useState<number[]>([]);
  const [form, setForm] = useState<BuyerForm>(emptyForm());
  const [statusText, setStatusText] = useState("");

  async function refresh(preferredKey?: string, nextCreateMode = false) {
    if (!accessToken) return;
    const payload = await fetchBuyers(accessToken);
    setBuyers(payload.buyers);
    setPuppies(payload.puppies);
    setAccounts(payload.accounts);
    setRequests(payload.requests);
    setCreateMode(nextCreateMode);
    setSelectedKey(
      nextCreateMode
        ? ""
        : preferredKey && payload.buyers.some((buyer) => buyer.key === preferredKey)
          ? preferredKey
          : payload.buyers[0]?.key || ""
    );
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!accessToken || !isAdmin) {
        if (active) setLoadingData(false);
        return;
      }

      setLoadingData(true);
      try {
        const payload = await fetchBuyers(accessToken);
        if (!active) return;
        setBuyers(payload.buyers);
        setPuppies(payload.puppies);
        setAccounts(payload.accounts);
        setRequests(payload.requests);
        setSelectedKey(payload.buyers[0]?.key || "");
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

  const filteredBuyers = useMemo(
    () =>
      buyers.filter((record) => {
        if (viewMode === "active" && complete(record.buyer.status)) return false;
        if (viewMode === "completed" && !complete(record.buyer.status)) return false;
        if (
          statusFilter !== "all" &&
          String(record.buyer.status || "").toLowerCase() !== statusFilter
        ) {
          return false;
        }

        const q = search.trim().toLowerCase();
        if (!q) return true;

        return [
          record.displayName,
          record.email,
          record.phone,
          record.buyer.city,
          record.buyer.state,
          record.buyer.notes,
          record.buyer.delivery_location,
          ...record.linkedPuppies.map((puppy) => puppyLabel(puppy)),
        ]
          .map((value) => String(value || "").toLowerCase())
          .join(" ")
          .includes(q);
      }),
    [buyers, search, statusFilter, viewMode]
  );

  const selectedBuyer = createMode
    ? null
    : filteredBuyers.find((buyer) => buyer.key === selectedKey) ||
      buyers.find((buyer) => buyer.key === selectedKey) ||
      null;
  const selectedAccount = selectedBuyer
    ? accountsByBuyerId.get(selectedBuyer.buyer.id) || null
    : null;
  const selectedSummary = selectedBuyer
    ? summarizeBuyer(selectedBuyer, selectedAccount)
    : null;

  const buyerRequests = useMemo(() => {
    if (!selectedBuyer) return [] as TransportationRequest[];
    return [...requests]
      .filter((request) => Number(request.buyer?.id || 0) === selectedBuyer.buyer.id)
      .sort(
        (left, right) =>
          new Date(right.created_at || right.request_date || 0).getTime() -
          new Date(left.created_at || left.request_date || 0).getTime()
      );
  }, [requests, selectedBuyer]);

  const selectedActivity: BuyerActivity[] = useMemo(() => {
    if (!selectedAccount) return [];
    return [
      ...selectedAccount.payments.map((payment) => ({
        key: `p-${payment.id}`,
        date: payment.payment_date,
        title: payment.payment_type || "Payment",
        amount: num(payment.amount),
        detail: [payment.method, payment.note].filter(Boolean).join(" | "),
        status: payment.status || "recorded",
      })),
      ...selectedAccount.adjustments.map((adjustment) => ({
        key: `a-${adjustment.id}`,
        date: adjustment.entry_date,
        title: adjustment.label || adjustment.entry_type || "Adjustment",
        amount: num(adjustment.amount),
        detail: adjustment.description || "",
        status: adjustment.status || "recorded",
      })),
    ]
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
      .slice(0, 8);
  }, [selectedAccount]);

  const buyerDocumentPacket = useMemo(() => {
    if (!selectedBuyer) return [];

    const packetContext: Parameters<typeof getVisiblePortalDocumentPacket>[0] = {
      buyer: selectedBuyer.buyer,
      application: selectedBuyer.latestApplication,
      puppy: selectedAccount?.linkedPuppies?.[0] || selectedBuyer.linkedPuppies[0] || null,
      documents: [],
    };

    return getVisiblePortalDocumentPacket(packetContext).map((definition) => {
      const submission = findMatchingDocumentSubmission(
        definition,
        selectedBuyer.forms as DocumentLikeFormSubmission[]
      );
      const status = portalDocumentStatus(definition, packetContext, submission);
      const availability = definition.getAvailability(packetContext);
      return {
        definition,
        submission,
        status,
        availability,
        previewRows: documentPreviewRows(
          definition,
          submission
            ? getDocumentSubmissionPayload(submission)
            : {},
          4
        ),
      };
    });
  }, [selectedAccount, selectedBuyer]);

  useEffect(() => {
    if (createMode) {
      setForm(emptyForm());
      setSelectedPuppyIds([]);
      setStatusText("");
      return;
    }

    if (!selectedBuyer) return;

    setForm({
      full_name: String(
        selectedBuyer.buyer.full_name || selectedBuyer.buyer.name || selectedBuyer.displayName || ""
      ),
      email: String(selectedBuyer.buyer.email || selectedBuyer.email || ""),
      phone: String(selectedBuyer.buyer.phone || selectedBuyer.phone || ""),
      status: String(selectedBuyer.buyer.status || "pending"),
      city: String(selectedBuyer.buyer.city || ""),
      state: String(selectedBuyer.buyer.state || ""),
      notes: String(selectedBuyer.buyer.notes || ""),
      delivery_option: String(selectedBuyer.buyer.delivery_option || ""),
      delivery_date: String(selectedBuyer.buyer.delivery_date || ""),
      delivery_location: String(selectedBuyer.buyer.delivery_location || ""),
      delivery_miles:
        selectedBuyer.buyer.delivery_miles === null || selectedBuyer.buyer.delivery_miles === undefined
          ? ""
          : String(selectedBuyer.buyer.delivery_miles),
      delivery_fee:
        selectedBuyer.buyer.delivery_fee === null || selectedBuyer.buyer.delivery_fee === undefined
          ? ""
          : String(selectedBuyer.buyer.delivery_fee),
      expense_gas:
        selectedBuyer.buyer.expense_gas === null || selectedBuyer.buyer.expense_gas === undefined
          ? ""
          : String(selectedBuyer.buyer.expense_gas),
      expense_hotel:
        selectedBuyer.buyer.expense_hotel === null ||
        selectedBuyer.buyer.expense_hotel === undefined
          ? ""
          : String(selectedBuyer.buyer.expense_hotel),
      expense_tolls:
        selectedBuyer.buyer.expense_tolls === null || selectedBuyer.buyer.expense_tolls === undefined
          ? ""
          : String(selectedBuyer.buyer.expense_tolls),
      expense_misc: String(selectedBuyer.buyer.expense_misc || ""),
    });
    setSelectedPuppyIds(selectedBuyer.linkedPuppies.map((puppy) => puppy.id));
    setStatusText("");
  }, [createMode, selectedBuyer]);

  useEffect(() => {
    if (createMode || !filteredBuyers.length || filteredBuyers.some((buyer) => buyer.key === selectedKey)) {
      return;
    }
    setSelectedKey(filteredBuyers[0].key);
  }, [createMode, filteredBuyers, selectedKey]);

  async function saveBuyer() {
    if (!accessToken) return;
    setSaving(true);
    setStatusText("");

    try {
      const response = await fetch("/api/admin/portal/buyers", {
        method: createMode ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          id: createMode ? undefined : selectedBuyer?.buyer.id,
          ...form,
          linked_puppy_ids: selectedPuppyIds,
        }),
      });
      const payload = (await response.json()) as { buyerId?: number; error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not save buyer.");
      await refresh(payload.buyerId ? String(payload.buyerId) : selectedKey, false);
      setStatusText(createMode ? "Buyer created." : "Buyer updated.");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not save buyer.");
    } finally {
      setSaving(false);
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

  const totalDeposits = buyers.reduce(
    (sum, buyer) => sum + summarizeBuyer(buyer, accountsByBuyerId.get(buyer.buyer.id) || null).deposit,
    0
  );
  const financeHouseholds = accounts.filter((account) => Boolean(account.buyer.finance_enabled)).length;
  const latestRequest = buyerRequests[0] || null;
  const linkedPuppies = selectedAccount?.linkedPuppies?.length
    ? selectedAccount.linkedPuppies
    : selectedBuyer?.linkedPuppies || [];

  return (
    <AdminPageShell>
      <div className="space-y-5 pb-10">
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <AdminPanel
            title="Buyer Directory"
            subtitle="Open the family you need, then work the full placement record without leaving the page."
            action={
              <button
                type="button"
                onClick={() => {
                  setCreateMode(true);
                  setForm(emptyForm());
                  setSelectedPuppyIds([]);
                  setStatusText("");
                }}
                className={primaryButtonClass}
              >
                Create Buyer
              </button>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminInfoTile
                label="Active Buyers"
                value={String(buyers.filter((buyer) => !complete(buyer.buyer.status)).length)}
                detail={`${buyers.length} total buyer records`}
              />
              <AdminInfoTile
                label="Payment Plans"
                value={String(financeHouseholds)}
                detail="Buyer records carrying a puppy payment plan"
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Toggle active={viewMode === "active"} label="Active" onClick={() => setViewMode("active")} />
              <Toggle
                active={viewMode === "completed"}
                label="Completed"
                onClick={() => setViewMode("completed")}
              />
            </div>

            <div className="mt-4 grid gap-3">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search buyer, puppy, city, notes, or delivery location..."
                className="w-full rounded-[18px] border border-[var(--portal-border)] bg-white px-4 py-3 text-sm text-[var(--portal-text)] outline-none transition focus:border-[var(--portal-accent)] focus:ring-2 focus:ring-[rgba(90,142,245,0.14)]"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-[18px] border border-[var(--portal-border)] bg-white px-4 py-3 text-sm text-[var(--portal-text)] outline-none transition focus:border-[var(--portal-accent)] focus:ring-2 focus:ring-[rgba(90,142,245,0.14)]"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="completed">Completed</option>
                <option value="denied">Denied</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </div>

            <div className="mt-5 space-y-3">
              {filteredBuyers.length ? (
                filteredBuyers.map((record) => {
                  const summary = summarizeBuyer(
                    record,
                    accountsByBuyerId.get(record.buyer.id) || null
                  );
                  const linkedLabel = record.linkedPuppies.length
                    ? record.linkedPuppies.slice(0, 2).map((puppy) => puppyLabel(puppy)).join(", ")
                    : "No puppy linked";
                  const planLabel = summary.financeEnabled
                    ? summary.monthlyAmount
                      ? `${fmtMoney(summary.monthlyAmount)} / month`
                      : "Payment plan active"
                    : "No payment plan";

                  return (
                    <AdminListCard
                      key={record.key}
                      selected={!createMode && record.key === selectedKey}
                      onClick={() => {
                        setCreateMode(false);
                        setSelectedKey(record.key);
                        setStatusText("");
                      }}
                      title={record.displayName}
                      subtitle={[record.email || "No email", record.phone || "No phone"].join(" | ")}
                      meta={[
                        linkedLabel,
                        planLabel,
                        `Balance ${fmtMoney(summary.balance)}`,
                      ].join(" | ")}
                      badge={
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(
                            record.buyer.status || "pending"
                          )}`}
                        >
                          {record.buyer.status || "pending"}
                        </span>
                      }
                    />
                  );
                })
              ) : (
                <AdminEmptyState
                  title="No buyers match the current filters"
                  description="Adjust the filters or create a new buyer record."
                />
              )}
            </div>
          </AdminPanel>

          <div className="space-y-5">
            <AdminPanel
              title={createMode ? "Create Buyer" : selectedBuyer?.displayName || "Buyer Record"}
              subtitle="Keep the buyer profile, placement, delivery plan, and ledger context together in one working record."
              action={
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void saveBuyer()}
                    disabled={saving}
                    className={primaryButtonClass}
                  >
                    {saving ? "Saving..." : createMode ? "Create Buyer" : "Save Buyer"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (createMode) {
                        setForm(emptyForm());
                        setSelectedPuppyIds([]);
                        setStatusText("");
                        return;
                      }
                      if (!selectedBuyer) return;
                      setSelectedPuppyIds(selectedBuyer.linkedPuppies.map((puppy) => puppy.id));
                      setStatusText("");
                    }}
                    className={secondaryButtonClass}
                  >
                    Reset
                  </button>
                </div>
              }
            >
              {statusText ? (
                <div className="mb-5 rounded-[18px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--portal-text-soft)]">
                  {statusText}
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <AdminInfoTile
                  label="Portal Account"
                  value={
                    selectedBuyer?.hasPortalAccount
                      ? "Connected"
                      : createMode
                        ? "New record"
                        : "No login"
                  }
                  detail={
                    selectedBuyer?.portalUser?.last_sign_in_at
                      ? `Last sign-in ${fmtDate(selectedBuyer.portalUser.last_sign_in_at)}`
                      : selectedBuyer?.portalUser?.email || "Portal sign-in status appears here."
                  }
                />
                <AdminInfoTile
                  label="Applications"
                  value={String(selectedBuyer?.applicationCount || 0)}
                  detail={
                    selectedBuyer?.latestApplicationStatus
                      ? `Latest status ${selectedBuyer.latestApplicationStatus}`
                      : `${selectedBuyer?.formCount || 0} submitted forms`
                  }
                />
                <AdminInfoTile
                  label="Linked Puppies"
                  value={String(linkedPuppies.length)}
                  detail={
                    linkedPuppies.length
                      ? linkedPuppies.map((puppy) => puppyLabel(puppy)).slice(0, 2).join(", ")
                      : "No puppy linked yet"
                  }
                />
                <AdminInfoTile
                  label="Payment Plan"
                  value={
                    selectedSummary?.financeEnabled
                      ? selectedSummary.monthlyAmount
                        ? `${fmtMoney(selectedSummary.monthlyAmount)} / month`
                        : "Plan active"
                      : "Not enrolled"
                  }
                  detail={
                    selectedSummary?.financeEnabled
                      ? selectedSummary.nextDueDate
                        ? `Next due ${fmtDate(selectedSummary.nextDueDate)}`
                        : "No next due date saved"
                      : "Buyer is not on a puppy payment plan"
                  }
                />
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <div className="space-y-4">
                  <AdminTextInput
                    label="Full Name"
                    value={form.full_name}
                    onChange={(value) => setForm((current) => ({ ...current, full_name: value }))}
                    placeholder="Buyer name"
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <AdminTextInput
                      label="Email"
                      value={form.email}
                      onChange={(value) => setForm((current) => ({ ...current, email: value }))}
                      placeholder="buyer@email.com"
                    />
                    <AdminTextInput
                      label="Phone"
                      value={form.phone}
                      onChange={(value) => setForm((current) => ({ ...current, phone: value }))}
                      placeholder="Phone number"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <AdminSelectInput
                      label="Status"
                      value={form.status}
                      onChange={(value) => setForm((current) => ({ ...current, status: value }))}
                      options={[
                        { value: "pending", label: "Pending" },
                        { value: "approved", label: "Approved" },
                        { value: "completed", label: "Completed" },
                        { value: "denied", label: "Denied" },
                        { value: "withdrawn", label: "Withdrawn" },
                      ]}
                    />
                    <AdminTextInput
                      label="City"
                      value={form.city}
                      onChange={(value) => setForm((current) => ({ ...current, city: value }))}
                      placeholder="City"
                    />
                    <AdminTextInput
                      label="State"
                      value={form.state}
                      onChange={(value) => setForm((current) => ({ ...current, state: value }))}
                      placeholder="State"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <AdminInfoTile
                    label="Balance"
                    value={fmtMoney(selectedSummary?.balance || 0)}
                    detail="Calculated from puppy pricing, payments, fees, and credits."
                  />
                  <AdminInfoTile
                    label="Last Payment"
                    value={
                      selectedSummary?.lastPaymentAt
                        ? fmtDate(selectedSummary.lastPaymentAt)
                        : "No payment yet"
                    }
                    detail={
                      selectedSummary?.activityCount
                        ? `${selectedSummary.activityCount} ledger entr${
                            selectedSummary.activityCount === 1 ? "y" : "ies"
                          }`
                        : "No financial activity recorded yet"
                    }
                  />
                </div>
              </div>

              <div className="mt-5">
                <AdminTextAreaInput
                  label="Notes"
                  value={form.notes}
                  onChange={(value) => setForm((current) => ({ ...current, notes: value }))}
                  rows={4}
                  placeholder="Internal notes, follow-up details, or placement context."
                />
              </div>
            </AdminPanel>

            <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
              <AdminPanel
                title="Puppy Placement"
                subtitle="Link the puppy here, then jump directly into the puppy record or financing file."
                action={
                  selectedBuyer ? (
                    <Link href="/admin/portal/puppies" className={secondaryButtonClass}>
                      Open Puppies
                    </Link>
                  ) : null
                }
              >
                {selectedBuyer ? (
                  <>
                    <div className="grid gap-3">
                      {linkedPuppies.length ? (
                        linkedPuppies.map((puppy) => (
                          <div
                            key={puppy.id}
                            className="rounded-[20px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-[var(--portal-text)]">
                                  {puppyLabel(puppy)}
                                </div>
                                <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                                  {[puppy.litter_name, puppy.sire, puppy.dam].filter(Boolean).join(" | ") ||
                                    "No litter or lineage details saved"}
                                </div>
                              </div>
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(
                                  puppy.status || "pending"
                                )}`}
                              >
                                {puppy.status || "pending"}
                              </span>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <Link
                                href={`/admin/portal/puppies?puppy=${puppy.id}`}
                                className={secondaryButtonClass}
                              >
                                Open Puppy
                              </Link>
                              {selectedSummary?.financeEnabled ? (
                                <Link
                                  href={`/admin/portal/puppy-financing?buyer=${selectedBuyer.buyer.id}&puppy=${puppy.id}`}
                                  className={secondaryButtonClass}
                                >
                                  Open Payment Plan
                                </Link>
                              ) : null}
                            </div>
                          </div>
                        ))
                      ) : (
                        <AdminEmptyState
                          title="No puppy linked yet"
                          description="Assign a puppy below so the buyer file and puppy file stay connected."
                        />
                      )}
                    </div>

                    <div className="mt-5">
                      <input
                        value={puppySearch}
                        onChange={(event) => setPuppySearch(event.target.value)}
                        placeholder="Search puppies by name, litter, or lineage..."
                        className="w-full rounded-[18px] border border-[var(--portal-border)] bg-white px-4 py-3 text-sm text-[var(--portal-text)] outline-none transition focus:border-[var(--portal-accent)] focus:ring-2 focus:ring-[rgba(90,142,245,0.14)]"
                      />
                    </div>

                    <div className="mt-4 max-h-[320px] space-y-3 overflow-y-auto pr-1">
                      {puppies
                        .filter((puppy) =>
                          [
                            puppyLabel(puppy),
                            puppy.status,
                            puppy.litter_name,
                            puppy.sire,
                            puppy.dam,
                            puppy.buyerName,
                          ]
                            .map((value) => String(value || "").toLowerCase())
                            .join(" ")
                            .includes(puppySearch.trim().toLowerCase())
                        )
                        .map((puppy) => {
                          const checked = selectedPuppyIds.includes(puppy.id);
                          const linkedElsewhere =
                            puppy.buyer_id && puppy.buyer_id !== selectedBuyer.buyer.id;

                          return (
                            <label
                              key={puppy.id}
                              className={`flex cursor-pointer items-start gap-3 rounded-[18px] border px-4 py-3 transition ${
                                checked
                                  ? "border-[#cfab84] bg-[var(--portal-surface-muted)]"
                                  : "border-[var(--portal-border)] bg-white hover:border-[#d8b48b]"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setSelectedPuppyIds((current) =>
                                    current.includes(puppy.id)
                                      ? current.filter((value) => value !== puppy.id)
                                      : [...current, puppy.id]
                                  )
                                }
                                className="mt-1 h-4 w-4 rounded border-[#d3b596] text-[#a56733] focus:ring-[#cba379]"
                              />
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-[var(--portal-text)]">
                                  {puppyLabel(puppy)}
                                </div>
                                <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                                  {[
                                    puppy.status || "No status",
                                    puppy.litter_name || "No litter",
                                    fmtMoney(num(puppy.price || puppy.list_price)),
                                  ].join(" | ")}
                                </div>
                                <div className="mt-1 text-[11px] text-[var(--portal-text-muted)]">
                                  {linkedElsewhere
                                    ? `Currently linked to ${puppy.buyerName || `Buyer #${puppy.buyer_id}`}`
                                    : "Available to assign"}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                    </div>
                  </>
                ) : (
                  <AdminEmptyState
                    title="Create a buyer before assigning puppies"
                    description="Once the buyer record exists, you can link the puppy here and jump straight into the puppy file."
                  />
                )}
              </AdminPanel>

              <AdminPanel
                title="Delivery & Transportation"
                subtitle="Save buyer-facing delivery details here, then jump into transportation requests when needed."
                action={
                  selectedBuyer ? (
                    <Link
                      href={
                        latestRequest
                          ? `/admin/portal/transportation?request=${latestRequest.id}`
                          : `/admin/portal/transportation?buyer=${selectedBuyer.buyer.id}`
                      }
                      className={secondaryButtonClass}
                    >
                      Open Transportation
                    </Link>
                  ) : null
                }
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <AdminSelectInput
                    label="Delivery Option"
                    value={form.delivery_option}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, delivery_option: value }))
                    }
                    options={[
                      { value: "", label: "Not set" },
                      { value: "pickup", label: "Pickup" },
                      { value: "meet-up", label: "Meet-Up" },
                      { value: "drop-off", label: "Drop-Off" },
                      { value: "transportation", label: "Transportation" },
                    ]}
                  />
                  <AdminDateInput
                    label="Delivery Date"
                    value={form.delivery_date}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, delivery_date: value }))
                    }
                  />
                  <AdminTextInput
                    label="Delivery Location"
                    value={form.delivery_location}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, delivery_location: value }))
                    }
                    placeholder="City, airport, or meet-up point"
                  />
                  <AdminNumberInput
                    label="Mileage"
                    value={form.delivery_miles}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, delivery_miles: value }))
                    }
                    placeholder="0"
                    min={0}
                  />
                  <AdminNumberInput
                    label="Delivery Fee"
                    value={form.delivery_fee}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, delivery_fee: value }))
                    }
                    placeholder="0.00"
                    min={0}
                    step="0.01"
                  />
                  <AdminNumberInput
                    label="Gas Cost"
                    value={form.expense_gas}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, expense_gas: value }))
                    }
                    placeholder="0.00"
                    min={0}
                    step="0.01"
                  />
                  <AdminNumberInput
                    label="Hotel Cost"
                    value={form.expense_hotel}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, expense_hotel: value }))
                    }
                    placeholder="0.00"
                    min={0}
                    step="0.01"
                  />
                  <AdminNumberInput
                    label="Tolls"
                    value={form.expense_tolls}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, expense_tolls: value }))
                    }
                    placeholder="0.00"
                    min={0}
                    step="0.01"
                  />
                </div>

                <div className="mt-4">
                  <AdminTextAreaInput
                    label="Delivery Notes"
                    value={form.expense_misc}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, expense_misc: value }))
                    }
                    rows={4}
                    placeholder="Special route notes, overnight details, or miscellaneous delivery costs."
                  />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <AdminInfoTile
                    label="Saved Delivery Total"
                    value={fmtMoney(
                      num(form.delivery_fee) +
                        num(form.expense_gas) +
                        num(form.expense_hotel) +
                        num(form.expense_tolls)
                    )}
                    detail="Fee plus gas, hotel, and tolls saved on the buyer record"
                  />
                  <AdminInfoTile
                    label="Transportation Requests"
                    value={String(buyerRequests.length)}
                    detail={
                      latestRequest
                        ? `Latest ${formatTransportType(latestRequest.request_type)} request is ${latestRequest.status || "pending"}`
                        : "No transportation requests linked yet"
                    }
                  />
                </div>

                {latestRequest ? (
                  <div className="mt-5 rounded-[20px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--portal-text)]">
                          {formatTransportType(latestRequest.request_type)}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                          {[
                            latestRequest.request_date ? fmtDate(latestRequest.request_date) : "No request date",
                            puppyLabel(latestRequest.puppy),
                            latestRequest.miles ? `${latestRequest.miles.toLocaleString()} miles` : "Miles not set",
                          ].join(" | ")}
                        </div>
                      </div>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(
                          latestRequest.status || "pending"
                        )}`}
                      >
                        {latestRequest.status || "pending"}
                      </span>
                    </div>
                    <div className="mt-4 text-sm leading-6 text-[var(--portal-text-soft)]">
                      {latestRequest.location_text ||
                        latestRequest.address_text ||
                        latestRequest.notes ||
                        "No transportation notes saved yet."}
                    </div>
                    <div className="mt-4">
                      <Link
                        href={`/admin/portal/transportation?request=${latestRequest.id}`}
                        className={secondaryButtonClass}
                      >
                        Open Linked Request
                      </Link>
                    </div>
                  </div>
                ) : null}
              </AdminPanel>

              <AdminPanel
                title="Puppy Payment Plan"
                subtitle="If this buyer is on financing, the plan details and direct links stay here."
                action={
                  selectedBuyer ? (
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/portal/payments?buyer=${selectedBuyer.buyer.id}`}
                        className={secondaryButtonClass}
                      >
                        Open Payments
                      </Link>
                      {linkedPuppies[0] ? (
                        <Link
                          href={`/admin/portal/puppy-financing?buyer=${selectedBuyer.buyer.id}&puppy=${linkedPuppies[0].id}`}
                          className={secondaryButtonClass}
                        >
                          Open Financing
                        </Link>
                      ) : null}
                    </div>
                  ) : null
                }
              >
                {selectedBuyer ? (
                  selectedSummary?.financeEnabled ? (
                    <>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <AdminInfoTile
                          label="Plan Status"
                          value="Active"
                          detail={
                            selectedSummary.financeAdminFee
                              ? "Admin fee enabled on this buyer plan"
                              : "Admin fee not enabled"
                          }
                        />
                        <AdminInfoTile
                          label="Monthly Payment"
                          value={
                            selectedSummary.monthlyAmount
                              ? fmtMoney(selectedSummary.monthlyAmount)
                              : "Not set"
                          }
                          detail={
                            selectedSummary.financeMonths
                              ? `${selectedSummary.financeMonths} month term`
                              : "No finance term saved"
                          }
                        />
                        <AdminInfoTile
                          label="APR / Rate"
                          value={selectedSummary.financeRate ? `${selectedSummary.financeRate}%` : "Not set"}
                          detail="Current saved financing rate on the buyer account"
                        />
                        <AdminInfoTile
                          label="Next Due"
                          value={
                            selectedSummary.nextDueDate
                              ? fmtDate(selectedSummary.nextDueDate)
                              : "Not set"
                          }
                          detail={
                            selectedSummary.lastPaymentAt
                              ? `Last payment ${fmtDate(selectedSummary.lastPaymentAt)}`
                              : "No payment posted yet"
                          }
                        />
                      </div>

                      <div className="mt-5 grid gap-3">
                        {linkedPuppies.map((puppy) => (
                          <div
                            key={`plan-${puppy.id}`}
                            className="rounded-[18px] border border-[var(--portal-border)] bg-white px-4 py-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-[var(--portal-text)]">
                                  {puppyLabel(puppy)}
                                </div>
                                <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                                  {[
                                    puppy.status || "No status",
                                    fmtMoney(num(puppy.price || puppy.list_price)),
                                    `Balance ${fmtMoney(selectedSummary.balance)}`,
                                  ].join(" | ")}
                                </div>
                              </div>
                              <Link
                                href={`/admin/portal/puppy-financing?buyer=${selectedBuyer.buyer.id}&puppy=${puppy.id}`}
                                className={secondaryButtonClass}
                              >
                                Open This Plan
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <AdminEmptyState
                      title="No puppy payment plan on this buyer"
                      description="The buyer ledger is still visible, but financing is not enabled for this household."
                    />
                  )
                ) : (
                  <AdminEmptyState
                    title="Create a buyer before opening financing"
                    description="Once the buyer and puppy are linked, financing details will show here automatically."
                  />
                )}
              </AdminPanel>

              <AdminPanel
                title="Buyer Documents"
                subtitle="The signed portal packet for this buyer stays visible here so agreements do not disappear into a separate tab."
                action={
                  selectedBuyer ? (
                    <Link
                      href="/admin/portal/documents"
                      className={secondaryButtonClass}
                    >
                      Open Documents
                    </Link>
                  ) : null
                }
              >
                {selectedBuyer ? (
                  buyerDocumentPacket.length ? (
                    <div className="grid gap-3">
                      {buyerDocumentPacket.map((entry) => (
                        <div
                          key={entry.definition.key}
                          className="rounded-[18px] border border-[var(--portal-border)] bg-white px-4 py-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                                {entry.definition.category}
                              </div>
                              <div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">
                                {entry.definition.title}
                              </div>
                              <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                                {entry.definition.key === "application" &&
                                selectedBuyer.latestApplication &&
                                !entry.submission
                                  ? `Application on file with status ${selectedBuyer.latestApplication.status || "submitted"}.`
                                  : entry.previewRows.length
                                  ? entry.previewRows
                                      .map((row) => `${row.label}: ${row.value}`)
                                      .join(" | ")
                                  : entry.availability.enabled
                                    ? entry.submission
                                      ? "Signed copy is on file."
                                      : "Waiting for the buyer to complete this document."
                                    : entry.availability.reason}
                              </div>
                            </div>
                            <div className="text-right">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(
                                  entry.status.label
                                )}`}
                              >
                                {entry.status.label}
                              </span>
                              <div className="mt-2 text-[11px] text-[var(--portal-text-muted)]">
                                {entry.submission
                                  ? displayDocDate(
                                      entry.submission.submitted_at ||
                                        entry.submission.updated_at ||
                                        entry.submission.created_at
                                    )
                                  : entry.availability.enabled
                                    ? "Not filed yet"
                                    : "Pending activation"}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <AdminEmptyState
                      title="No buyer packet items yet"
                      description="Forms saved through the portal will appear here alongside the signed document statuses."
                    />
                  )
                ) : (
                  <AdminEmptyState
                    title="Create a buyer before tracking documents"
                    description="Once the buyer record exists, their portal packet and signed copies will surface here automatically."
                  />
                )}
              </AdminPanel>

              <AdminPanel
                title="Recent Ledger Activity"
                subtitle="Payments, credits, transport charges, and adjustments stay visible inside the buyer file."
                action={
                  selectedBuyer ? (
                    <Link
                      href={`/admin/portal/payments?buyer=${selectedBuyer.buyer.id}`}
                      className={secondaryButtonClass}
                    >
                      Open Full Ledger
                    </Link>
                  ) : null
                }
              >
                {selectedActivity.length ? (
                  <div className="space-y-3">
                    {selectedActivity.map((activity) => (
                      <div
                        key={activity.key}
                        className="rounded-[18px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-[var(--portal-text)]">
                              {activity.title}
                            </div>
                            <div className="mt-1 text-xs text-[var(--portal-text-soft)]">
                              {fmtDate(activity.date)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-[var(--portal-text)]">
                              {fmtMoney(activity.amount)}
                            </div>
                            <span
                              className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(
                                activity.status
                              )}`}
                            >
                              {activity.status}
                            </span>
                          </div>
                        </div>
                        {activity.detail ? (
                          <div className="mt-3 text-sm leading-6 text-[var(--portal-text-soft)]">
                            {activity.detail}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <AdminEmptyState
                    title="No financial activity yet"
                    description="Payments, fees, credits, and transportation charges will show here once they are recorded."
                  />
                )}
              </AdminPanel>
            </div>
          </div>
        </section>

        <AdminPanel
          title="Buyer Totals"
          subtitle="A quick rollup of buyer-side money already recorded across the placement files."
        >
          <div className="grid gap-3 md:grid-cols-3">
            <AdminInfoTile
              label="Deposits Recorded"
              value={fmtMoney(totalDeposits)}
              detail="Saved deposit amounts across all buyer records"
            />
            <AdminInfoTile
              label="Portal-Ready Buyers"
              value={String(buyers.filter((buyer) => buyer.hasPortalAccount).length)}
              detail="Buyer records already linked to a portal login"
            />
            <AdminInfoTile
              label="Transportation Queue"
              value={String(requests.length)}
              detail="Current transportation requests linked to portal buyers"
            />
          </div>
        </AdminPanel>
      </div>
    </AdminPageShell>
  );
}

function Toggle({
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
      className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
        active
          ? "border-[#cfab84] bg-[var(--portal-surface-muted)] text-[var(--portal-text)]"
          : "border-[var(--portal-border)] bg-white text-[var(--portal-text-soft)] hover:border-[#d8b48b]"
      }`}
    >
      {label}
    </button>
  );
}
