"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import {
  AdminEmptyState,
  AdminRestrictedState,
  AdminPageShell,
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
  status?: string | null;
  notes?: string | null;
  city?: string | null;
  state?: string | null;
  created_at?: string | null;
};

type LinkedPuppy = {
  id: number;
  buyer_id?: number | null;
  call_name?: string | null;
  puppy_name?: string | null;
  name?: string | null;
  status?: string | null;
  price?: number | null;
  deposit?: number | null;
  balance?: number | null;
  created_at?: string | null;
};

type PuppyOption = LinkedPuppy & {
  buyerName?: string | null;
};

type BuyerCard = {
  key: string;
  buyer: BuyerRow;
  displayName: string;
  email: string;
  phone: string;
  hasPortalAccount: boolean;
  portalUser: {
    id: string;
    email: string;
    created_at?: string | null;
    last_sign_in_at?: string | null;
  } | null;
  applicationCount: number;
  latestApplicationStatus?: string | null;
  formCount: number;
  linkedPuppies: LinkedPuppy[];
};

type BuyerFinanceRow = {
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
  buyer: BuyerFinanceRow;
  puppy: LinkedPuppy | null;
  linkedPuppies: LinkedPuppy[];
  payments: BuyerPayment[];
  adjustments: BuyerAdjustment[];
  totalPaid: number;
  lastPaymentAt: string | null;
};

type BuyerForm = {
  full_name: string;
  email: string;
  phone: string;
  status: string;
  notes: string;
  city: string;
  state: string;
};

type BuyerSummary = {
  purchasePrice: number;
  deposit: number;
  principalAfterDeposit: number;
  totalPaid: number;
  adjustmentCharges: number;
  adjustmentCredits: number;
  planTotal: number;
  balance: number;
  financeEnabled: boolean;
  adminFeeEnabled: boolean;
  financeRate: number | null;
  financeMonths: number;
  monthlyAmount: number;
  nextDueDate: string;
  lastPaymentAt: string;
  activityCount: number;
};

type BuyerActivity = {
  key: string;
  kind: "payment" | "adjustment";
  date: string;
  title: string;
  amount: number;
  detail: string;
  status: string;
};

type SortMode =
  | "name_az"
  | "name_za"
  | "newest"
  | "oldest"
  | "balance_high"
  | "payments_high";

type ViewMode = "active" | "completed";

function emptyBuyerForm(): BuyerForm {
  return {
    full_name: "",
    email: "",
    phone: "",
    status: "pending",
    notes: "",
    city: "",
    state: "",
  };
}

function puppyLabel(puppy: LinkedPuppy | PuppyOption) {
  return puppy.call_name || puppy.puppy_name || puppy.name || `Puppy #${puppy.id}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "BV";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

function normalizedStatus(status: string | null | undefined) {
  return String(status || "pending").trim().toLowerCase();
}

function isCompletedStatus(status: string | null | undefined) {
  const normalized = normalizedStatus(status);
  return normalized.includes("completed") || normalized === "complete";
}

function isActiveStatus(status: string | null | undefined) {
  return !isCompletedStatus(status);
}

function paymentCountsTowardBalance(status: string | null | undefined) {
  const normalized = normalizedStatus(status);
  if (!normalized) return true;
  return !["failed", "void", "cancelled", "canceled"].includes(normalized);
}

function adjustmentCountsTowardBalance(status: string | null | undefined) {
  const normalized = normalizedStatus(status);
  if (!normalized) return true;
  return !["void", "cancelled", "canceled"].includes(normalized);
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toOptionalNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sumLinkedPuppyAmount(
  puppies: LinkedPuppy[],
  field: "price" | "deposit"
) {
  const values = puppies
    .map((puppy) => puppy[field])
    .filter((value) => value !== null && value !== undefined)
    .map((value) => toNumber(value));

  return {
    hasAny: values.length > 0,
    total: values.reduce((sum, value) => sum + value, 0),
  };
}

function buildBuyerSummary(record: BuyerCard, account: BuyerAccount | null) {
  const linkedPuppies = account?.linkedPuppies?.length ? account.linkedPuppies : record.linkedPuppies;
  const priceFromPuppies = sumLinkedPuppyAmount(linkedPuppies, "price");
  const depositFromPuppies = sumLinkedPuppyAmount(linkedPuppies, "deposit");
  const financeBuyer = account?.buyer || null;
  const purchasePrice = priceFromPuppies.hasAny
    ? priceFromPuppies.total
    : toNumber(financeBuyer?.sale_price);
  const deposit = depositFromPuppies.hasAny
    ? depositFromPuppies.total
    : toNumber(financeBuyer?.deposit_amount);
  const principalAfterDeposit = Math.max(0, purchasePrice - deposit);
  const totalPaid = account?.payments
    ?.filter((payment) => paymentCountsTowardBalance(payment.status))
    .reduce((sum, payment) => sum + toNumber(payment.amount), 0) || 0;
  const adjustmentCharges = account?.adjustments
    ?.filter((adjustment) => adjustmentCountsTowardBalance(adjustment.status))
    .filter((adjustment) => normalizedStatus(adjustment.entry_type) !== "credit")
    .reduce((sum, adjustment) => sum + Math.abs(toNumber(adjustment.amount)), 0) || 0;
  const adjustmentCredits = account?.adjustments
    ?.filter((adjustment) => adjustmentCountsTowardBalance(adjustment.status))
    .filter((adjustment) => normalizedStatus(adjustment.entry_type) === "credit")
    .reduce((sum, adjustment) => sum + Math.abs(toNumber(adjustment.amount)), 0) || 0;
  const financeEnabled = Boolean(financeBuyer?.finance_enabled);
  const financeMonths = Math.max(0, toNumber(financeBuyer?.finance_months));
  const monthlyAmount = Math.max(0, toNumber(financeBuyer?.finance_monthly_amount));
  const planPrincipal =
    financeEnabled && financeMonths > 0 && monthlyAmount > 0
      ? Math.max(principalAfterDeposit, financeMonths * monthlyAmount)
      : principalAfterDeposit;
  const balance = Math.max(
    0,
    planPrincipal + adjustmentCharges - adjustmentCredits - totalPaid
  );

  return {
    purchasePrice,
    deposit,
    principalAfterDeposit,
    totalPaid,
    adjustmentCharges,
    adjustmentCredits,
    planTotal: planPrincipal,
    balance,
    financeEnabled,
    adminFeeEnabled: Boolean(financeBuyer?.finance_admin_fee),
    financeRate: toOptionalNumber(financeBuyer?.finance_rate),
    financeMonths,
    monthlyAmount,
    nextDueDate: financeBuyer?.finance_next_due_date || "",
    lastPaymentAt: account?.lastPaymentAt || financeBuyer?.finance_last_payment_date || "",
    activityCount: (account?.payments?.length || 0) + (account?.adjustments?.length || 0),
  } satisfies BuyerSummary;
}

function buildBuyerActivity(account: BuyerAccount | null) {
  if (!account) return [] as BuyerActivity[];

  const paymentRows: BuyerActivity[] = account.payments.map((payment) => ({
    key: `payment-${payment.id}`,
    kind: "payment",
    date: payment.payment_date || payment.created_at,
    title: payment.payment_type || "Payment",
    amount: toNumber(payment.amount),
    detail: [payment.method, payment.note].filter(Boolean).join(" - "),
    status: payment.status || "recorded",
  }));

  const adjustmentRows: BuyerActivity[] = account.adjustments.map((adjustment) => ({
    key: `adjustment-${adjustment.id}`,
    kind: "adjustment",
    date: adjustment.entry_date || adjustment.created_at,
    title:
      adjustment.label ||
      (normalizedStatus(adjustment.entry_type) === "credit"
        ? "Credit"
        : normalizedStatus(adjustment.entry_type) === "transportation"
          ? "Transportation Fee"
          : "Fee"),
    amount: Math.abs(toNumber(adjustment.amount)),
    detail: adjustment.description || adjustment.entry_type || "",
    status: adjustment.status || "recorded",
  }));

  return [...paymentRows, ...adjustmentRows].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

async function fetchAdminBuyers(accessToken: string) {
  if (!accessToken) return { buyers: [] as BuyerCard[], puppies: [] as PuppyOption[] };

  const response = await fetch("/api/admin/portal/buyers", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return { buyers: [] as BuyerCard[], puppies: [] as PuppyOption[] };
  }

  const payload = (await response.json()) as { buyers?: BuyerCard[]; puppies?: PuppyOption[] };
  return {
    buyers: Array.isArray(payload.buyers) ? payload.buyers : [],
    puppies: Array.isArray(payload.puppies) ? payload.puppies : [],
  };
}

async function fetchPaymentAccounts(accessToken: string) {
  if (!accessToken) return [] as BuyerAccount[];

  const response = await fetch("/api/admin/portal/payments", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) return [] as BuyerAccount[];

  const payload = (await response.json()) as { accounts?: BuyerAccount[] };
  return Array.isArray(payload.accounts) ? payload.accounts : [];
}

async function fetchAllBuyerData(accessToken: string) {
  const [buyersPayload, accounts] = await Promise.all([
    fetchAdminBuyers(accessToken),
    fetchPaymentAccounts(accessToken),
  ]);

  return {
    buyers: buyersPayload.buyers,
    puppies: buyersPayload.puppies,
    accounts,
  };
}

export default function AdminPortalBuyersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [createStatusText, setCreateStatusText] = useState("");
  const [search, setSearch] = useState("");
  const [puppySearch, setPuppySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("name_az");
  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [buyers, setBuyers] = useState<BuyerCard[]>([]);
  const [allPuppies, setAllPuppies] = useState<PuppyOption[]>([]);
  const [accounts, setAccounts] = useState<BuyerAccount[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [selectedPuppyIds, setSelectedPuppyIds] = useState<number[]>([]);
  const [form, setForm] = useState<BuyerForm>(emptyBuyerForm);
  const [createForm, setCreateForm] = useState<BuyerForm>(emptyBuyerForm);

  function applyFetchedData(
    payload: { buyers: BuyerCard[]; puppies: PuppyOption[]; accounts: BuyerAccount[] },
    preferredKey?: string
  ) {
    setBuyers(payload.buyers);
    setAllPuppies(payload.puppies);
    setAccounts(payload.accounts);
    setSelectedKey((current) => {
      if (preferredKey && payload.buyers.some((buyer) => buyer.key === preferredKey)) {
        return preferredKey;
      }
      if (payload.buyers.some((buyer) => buyer.key === current)) return current;
      return payload.buyers[0]?.key || "";
    });
  }

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
          const payload = await fetchAllBuyerData(token);
          if (!mounted) return;
          applyFetchedData(payload);
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
        const payload = await fetchAllBuyerData(token);
        if (!mounted) return;
        applyFetchedData(payload);
      } else {
        setBuyers([]);
        setAllPuppies([]);
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

  const accountByBuyerId = useMemo(
    () => new Map(accounts.map((account) => [account.buyer.id, account])),
    [accounts]
  );

  const buyerSummaryById = useMemo(() => {
    const next = new Map<number, BuyerSummary>();
    buyers.forEach((record) => {
      next.set(record.buyer.id, buildBuyerSummary(record, accountByBuyerId.get(record.buyer.id) || null));
    });
    return next;
  }, [accountByBuyerId, buyers]);

  const filteredBuyers = useMemo(() => {
    const q = search.trim().toLowerCase();

    const results = buyers.filter((record) => {
      if (viewMode === "completed" && !isCompletedStatus(record.buyer.status)) return false;
      if (viewMode === "active" && !isActiveStatus(record.buyer.status)) return false;
      if (statusFilter !== "all" && normalizedStatus(record.buyer.status) !== statusFilter) return false;

      if (!q) return true;

      const summary = buyerSummaryById.get(record.buyer.id);
      return [
        record.displayName,
        record.email,
        record.phone,
        record.buyer.status,
        record.buyer.city,
        record.buyer.state,
        record.buyer.notes,
        record.latestApplicationStatus,
        record.portalUser?.email,
        summary?.balance ? String(summary.balance) : "",
        ...record.linkedPuppies.map((puppy) => puppyLabel(puppy)),
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(q);
    });

    results.sort((left, right) => {
      const leftSummary = buyerSummaryById.get(left.buyer.id);
      const rightSummary = buyerSummaryById.get(right.buyer.id);
      const leftName = left.displayName.toLowerCase();
      const rightName = right.displayName.toLowerCase();
      const leftCreated = new Date(left.buyer.created_at || 0).getTime();
      const rightCreated = new Date(right.buyer.created_at || 0).getTime();

      switch (sortMode) {
        case "name_za":
          return rightName.localeCompare(leftName);
        case "newest":
          return rightCreated - leftCreated;
        case "oldest":
          return leftCreated - rightCreated;
        case "balance_high":
          return (rightSummary?.balance || 0) - (leftSummary?.balance || 0);
        case "payments_high":
          return (rightSummary?.totalPaid || 0) - (leftSummary?.totalPaid || 0);
        case "name_az":
        default:
          return leftName.localeCompare(rightName);
      }
    });

    return results;
  }, [buyerSummaryById, buyers, search, sortMode, statusFilter, viewMode]);

  const selectedBuyer =
    filteredBuyers.find((record) => record.key === selectedKey) ||
    buyers.find((record) => record.key === selectedKey) ||
    null;

  const selectedAccount = selectedBuyer
    ? accountByBuyerId.get(selectedBuyer.buyer.id) || null
    : null;

  const selectedSummary = selectedBuyer
    ? buyerSummaryById.get(selectedBuyer.buyer.id) || null
    : null;

  const selectedActivity = useMemo(
    () => buildBuyerActivity(selectedAccount).slice(0, 8),
    [selectedAccount]
  );

  useEffect(() => {
    if (!filteredBuyers.length) {
      setSelectedKey("");
      return;
    }
    if (!filteredBuyers.some((record) => record.key === selectedKey)) {
      setSelectedKey(filteredBuyers[0].key);
    }
  }, [filteredBuyers, selectedKey]);

  useEffect(() => {
    if (!selectedBuyer) return;

    setForm({
      full_name: String(
        selectedBuyer.buyer.full_name || selectedBuyer.buyer.name || selectedBuyer.displayName || ""
      ),
      email: String(selectedBuyer.buyer.email || selectedBuyer.email || ""),
      phone: String(selectedBuyer.buyer.phone || selectedBuyer.phone || ""),
      status: String(selectedBuyer.buyer.status || "pending"),
      notes: String(selectedBuyer.buyer.notes || ""),
      city: String(selectedBuyer.buyer.city || ""),
      state: String(selectedBuyer.buyer.state || ""),
    });
    setSelectedPuppyIds(selectedBuyer.linkedPuppies.map((puppy) => puppy.id));
    setStatusText("");
    setPuppySearch("");
  }, [selectedBuyer]);

  const filteredPuppies = useMemo(() => {
    const q = puppySearch.trim().toLowerCase();
    if (!q) return allPuppies;

    return allPuppies.filter((puppy) =>
      [puppyLabel(puppy), puppy.status, puppy.buyerName]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(q)
    );
  }, [allPuppies, puppySearch]);

  const totalBuyerCount = buyers.length;
  const activeBuyerCount = buyers.filter((record) => isActiveStatus(record.buyer.status)).length;
  const completedBuyerCount = buyers.filter((record) => isCompletedStatus(record.buyer.status)).length;
  const financedBuyerCount = accounts.filter((account) => {
    const buyerRecord = buyers.find((buyer) => buyer.buyer.id === account.buyer.id);
    if (!buyerRecord) return false;
    return buildBuyerSummary(buyerRecord, account).financeEnabled;
  }).length;
  const portalBuyerCount = buyers.filter((record) => record.hasPortalAccount).length;
  const totalDeposits = buyers.reduce((sum, record) => {
    const summary = buyerSummaryById.get(record.buyer.id);
    return sum + (summary?.deposit || 0);
  }, 0);
  const totalOutstanding = buyers.reduce((sum, record) => {
    const summary = buyerSummaryById.get(record.buyer.id);
    return sum + (summary?.balance || 0);
  }, 0);
  const nextDueRecord = buyers
    .map((record) => ({
      record,
      summary: buyerSummaryById.get(record.buyer.id) || null,
    }))
    .filter((item) => item.summary?.nextDueDate)
    .sort(
      (left, right) =>
        new Date(left.summary?.nextDueDate || 0).getTime() -
        new Date(right.summary?.nextDueDate || 0).getTime()
    )[0];

  async function refreshBuyers(preferredKey?: string) {
    if (!accessToken) return;
    const payload = await fetchAllBuyerData(accessToken);
    applyFetchedData(payload, preferredKey);
  }

  async function saveBuyer() {
    if (!selectedBuyer?.buyer?.id) return;

    setSaving(true);
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
          ...form,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not update the buyer record.");
      }

      await refreshBuyers(selectedBuyer.key);
      setStatusText("Buyer details and puppy assignments saved.");
    } catch (error) {
      console.error(error);
      setStatusText("Could not update the buyer record.");
    } finally {
      setSaving(false);
    }
  }

  async function createBuyer() {
    setCreating(true);
    setCreateStatusText("");

    try {
      const response = await fetch("/api/admin/portal/buyers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(createForm),
      });

      const payload = (await response.json()) as { buyerId?: number; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not create the buyer.");
      }

      setCreateForm(emptyBuyerForm());
      setShowCreateForm(false);
      await refreshBuyers(String(payload.buyerId || ""));
      setCreateStatusText("Buyer record created.");
    } catch (error) {
      console.error(error);
      setCreateStatusText("Could not create the buyer.");
    } finally {
      setCreating(false);
    }
  }

  function togglePuppySelection(puppyId: number) {
    setSelectedPuppyIds((current) =>
      current.includes(puppyId)
        ? current.filter((value) => value !== puppyId)
        : [...current, puppyId]
    );
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">
        Loading buyers...
      </div>
    );
  }

  if (!user) {
    return (
      <AdminRestrictedState
        title="Sign in to access buyer records."
        details="This page is reserved for the Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!isPortalAdminEmail(user.email)) {
    return (
      <AdminRestrictedState
        title="This buyer workspace is limited to approved owner accounts."
        details="Only the approved owner emails can manage buyer records from this area."
      />
    );
  }

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-12">
        <section className="overflow-hidden rounded-[36px] border border-[#ead8c4] bg-[radial-gradient(circle_at_top_left,rgba(246,223,191,0.56),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(209,175,137,0.24),transparent_36%),linear-gradient(180deg,#fffdf9_0%,#f7efe5_100%)] p-5 shadow-[0_30px_80px_rgba(106,76,45,0.10)] md:p-7">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.22fr)_340px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#e6d1ba] bg-white/90 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-[#9c7043]">
                Buyers
                <span className="h-1.5 w-1.5 rounded-full bg-[#c98b4f]" />
                Profiles • archive • financing view
              </div>

              <h1 className="mt-5 font-serif text-4xl font-bold leading-[0.95] text-[#2f2218] [font-family:var(--font-merriweather)] md:text-6xl">
                Buyer Management
              </h1>
              <p className="mt-4 max-w-3xl text-[15px] leading-7 text-[#72553c] md:text-base">
                A cleaner operations view for buyer profiles, linked puppies, payment visibility,
                and completed-buyer archive lookup. This layout keeps the real portal data intact
                while matching the warmer Southwest Virginia Chihuahua admin look.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm((current) => !current);
                    setCreateStatusText("");
                  }}
                  className="inline-flex items-center rounded-full bg-[linear-gradient(135deg,#c88c52_0%,#9f6331_100%)] px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_18px_34px_rgba(159,99,49,0.24)] transition hover:-translate-y-0.5 hover:brightness-105"
                >
                  {showCreateForm ? "Close New Buyer" : "Add Buyer"}
                </button>
                <button
                  type="button"
                  onClick={() => void refreshBuyers(selectedBuyer?.key)}
                  className="inline-flex items-center rounded-full border border-[#dfc5a7] bg-white/90 px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-[#5d4330] shadow-[0_12px_28px_rgba(106,76,45,0.08)] transition hover:-translate-y-0.5 hover:border-[#cba379]"
                >
                  Refresh
                </button>
                <Link
                  href="/admin/portal/payments"
                  className="inline-flex items-center rounded-full border border-[#dfc5a7] bg-white/90 px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-[#5d4330] shadow-[0_12px_28px_rgba(106,76,45,0.08)] transition hover:-translate-y-0.5 hover:border-[#cba379]"
                >
                  Payments
                </Link>
                <Link
                  href="/admin/portal/puppy-payments"
                  className="inline-flex items-center rounded-full border border-[#dfc5a7] bg-white/90 px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-[#5d4330] shadow-[0_12px_28px_rgba(106,76,45,0.08)] transition hover:-translate-y-0.5 hover:border-[#cba379]"
                >
                  Puppy Financing
                </Link>
              </div>

              <div className="mt-7 grid gap-3 lg:grid-cols-12">
                <div className="lg:col-span-5">
                  <label className="text-[11px] font-black uppercase tracking-[0.22em] text-[#9c7043]">
                    Search
                  </label>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Name, email, phone, notes, puppy, city..."
                    className="mt-2 w-full rounded-[22px] border border-[#e4d2be] bg-white/92 px-4 py-3.5 text-sm text-[#33251a] outline-none transition focus:border-[#c9a279]"
                  />
                </div>

                <div className="lg:col-span-3">
                  <label className="text-[11px] font-black uppercase tracking-[0.22em] text-[#9c7043]">
                    Status Filter
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="mt-2 w-full rounded-[22px] border border-[#e4d2be] bg-white/92 px-4 py-3.5 text-sm text-[#33251a] outline-none transition focus:border-[#c9a279]"
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="completed">Completed</option>
                    <option value="denied">Denied</option>
                    <option value="withdrawn">Withdrawn</option>
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label className="text-[11px] font-black uppercase tracking-[0.22em] text-[#9c7043]">
                    Sort
                  </label>
                  <select
                    value={sortMode}
                    onChange={(event) => setSortMode(event.target.value as SortMode)}
                    className="mt-2 w-full rounded-[22px] border border-[#e4d2be] bg-white/92 px-4 py-3.5 text-sm text-[#33251a] outline-none transition focus:border-[#c9a279]"
                  >
                    <option value="name_az">Name A-Z</option>
                    <option value="name_za">Name Z-A</option>
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="balance_high">Balance High</option>
                    <option value="payments_high">Payments High</option>
                  </select>
                </div>

                <div className="lg:col-span-2 flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                      setSortMode("name_az");
                      setViewMode("active");
                    }}
                    className="w-full rounded-[22px] border border-[#e4d2be] bg-white/92 px-4 py-3.5 text-sm font-black uppercase tracking-[0.14em] text-[#5d4330] shadow-[0_12px_28px_rgba(106,76,45,0.05)] transition hover:border-[#cba379]"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <aside className="space-y-4 xl:pl-2">
              <div className="rounded-[30px] border border-[#ead8c4] bg-white/88 p-5 shadow-[0_18px_52px_rgba(106,76,45,0.08)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#9c7043]">
                      Command Snapshot
                    </div>
                    <div className="mt-1 text-sm leading-6 text-[#7a5d42]">
                      Quick read on buyer records, archive volume, and financing exposure.
                    </div>
                  </div>
                  <div className="rounded-full border border-[#e6d1ba] bg-[#fff6ed] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7043]">
                    Live
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <SnapshotCard label="Portal Linked" value={String(portalBuyerCount)} detail="Buyer records with a live portal sign-in." />
                  <SnapshotCard label="Financed" value={String(financedBuyerCount)} detail="Buyer accounts using financing terms." />
                  <SnapshotCard label="Deposits" value={fmtMoney(totalDeposits)} detail="Deposit value currently saved across buyer accounts." />
                  <SnapshotCard label="Outstanding" value={fmtMoney(totalOutstanding)} detail="Open balance still remaining across all buyers." />
                </div>

                <div className="mt-4 rounded-[24px] border border-[#ead8c4] bg-[#fffaf4] p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#9c7043]">
                    Next Due
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-[#2f2218]">
                    {nextDueRecord?.summary?.nextDueDate
                      ? fmtDate(nextDueRecord.summary.nextDueDate)
                      : "No due date saved"}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-[#7a5d42]">
                    {nextDueRecord
                      ? `${nextDueRecord.record.displayName} • ${fmtMoney(nextDueRecord.summary?.monthlyAmount || 0)}`
                      : "Financing accounts with upcoming due dates will surface here."}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-6">
          <MetricCard label="Total Buyers" value={String(totalBuyerCount)} detail="Every buyer record currently in the system." />
          <MetricCard label="Active Buyers" value={String(activeBuyerCount)} detail="Pending, approved, matched, and open records." />
          <MetricCard label="Completed" value={String(completedBuyerCount)} detail="Archive-ready completed buyer profiles." />
          <MetricCard label="Portal Linked" value={String(portalBuyerCount)} detail="Accounts tied to a real portal login." />
          <MetricCard label="Financed" value={String(financedBuyerCount)} detail="Buyer accounts with financing enabled." />
          <MetricCard label="In View" value={String(filteredBuyers.length)} detail={`Showing ${viewMode === "completed" ? "completed archive" : "active buyers"} after filters.`} />
        </section>

        <section className="grid gap-6 2xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <section className="rounded-[34px] border border-[#ead8c4] bg-white p-5 shadow-[0_24px_70px_rgba(106,76,45,0.09)] md:p-6">
            <div className="flex flex-col gap-4 border-b border-[#efe0cf] pb-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[#9c7043]">
                  Buyers
                </div>
                <h2 className="mt-3 font-serif text-2xl font-bold text-[#2f2218] [font-family:var(--font-merriweather)]">
                  Active Records and Completed Archive
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7a5d42]">
                  Click any buyer card to open the detail workspace, review linked puppies, and
                  confirm payment visibility before jumping into the dedicated financial tabs.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <ViewTab active={viewMode === "active"} label={`Active Buyers (${activeBuyerCount})`} onClick={() => setViewMode("active")} />
                <ViewTab active={viewMode === "completed"} label={`Completed Archive (${completedBuyerCount})`} onClick={() => setViewMode("completed")} />
              </div>
            </div>

            {showCreateForm ? (
              <div className="mt-5 rounded-[28px] border border-[#ead8c4] bg-[linear-gradient(180deg,#fffdf9_0%,#f8efe3_100%)] p-5 shadow-[0_16px_40px_rgba(106,76,45,0.06)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#9c7043]">
                      Manual Entry
                    </div>
                    <h3 className="mt-2 text-xl font-semibold text-[#2f2218]">
                      Create a new buyer record
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7a5d42]">
                      Use this when a buyer needs to exist in the admin system before they ever sign
                      into the portal.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateForm(emptyBuyerForm());
                      setCreateStatusText("");
                      setShowCreateForm(false);
                    }}
                    className="rounded-full border border-[#dfc5a7] bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-[#5d4330] transition hover:border-[#cba379]"
                  >
                    Close
                  </button>
                </div>

                {createStatusText ? (
                  <div className="mt-4 rounded-[18px] border border-[#ead8c4] bg-white/80 px-4 py-3 text-sm font-semibold text-[#6b5038]">
                    {createStatusText}
                  </div>
                ) : null}

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <FormField label="Full Name" value={createForm.full_name} onChange={(value) => setCreateForm((current) => ({ ...current, full_name: value }))} />
                  <FormField label="Email" value={createForm.email} onChange={(value) => setCreateForm((current) => ({ ...current, email: value }))} />
                  <FormField label="Phone" value={createForm.phone} onChange={(value) => setCreateForm((current) => ({ ...current, phone: value }))} />
                  <SelectField
                    label="Status"
                    value={createForm.status}
                    onChange={(value) => setCreateForm((current) => ({ ...current, status: value }))}
                    options={[
                      { value: "pending", label: "Pending" },
                      { value: "approved", label: "Approved" },
                      { value: "completed", label: "Completed" },
                      { value: "denied", label: "Denied" },
                      { value: "withdrawn", label: "Withdrawn" },
                    ]}
                  />
                  <FormField label="City" value={createForm.city} onChange={(value) => setCreateForm((current) => ({ ...current, city: value }))} />
                  <FormField label="State" value={createForm.state} onChange={(value) => setCreateForm((current) => ({ ...current, state: value }))} />
                </div>

                <div className="mt-4">
                  <TextAreaField label="Notes" value={createForm.notes} onChange={(value) => setCreateForm((current) => ({ ...current, notes: value }))} rows={4} />
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void createBuyer()}
                    disabled={creating}
                    className="rounded-full bg-[linear-gradient(135deg,#c88c52_0%,#9f6331_100%)] px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_18px_34px_rgba(159,99,49,0.24)] transition hover:brightness-105 disabled:opacity-60"
                  >
                    {creating ? "Creating..." : "Create Buyer"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateForm(emptyBuyerForm());
                      setCreateStatusText("");
                    }}
                    className="rounded-full border border-[#dfc5a7] bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-[#5d4330] transition hover:border-[#cba379]"
                  >
                    Reset
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
              {filteredBuyers.length ? (
                filteredBuyers.map((record) => {
                  const summary = buyerSummaryById.get(record.buyer.id);

                  return (
                    <button
                      key={record.key}
                      type="button"
                      onClick={() => setSelectedKey(record.key)}
                      className={[
                        "group rounded-[28px] border p-5 text-left transition",
                        selectedKey === record.key
                          ? "border-[#cba379] bg-[linear-gradient(180deg,#fffdf8_0%,#f7ecde_100%)] shadow-[0_20px_60px_rgba(106,76,45,0.10)]"
                          : "border-[#ead8c4] bg-[#fffaf5] shadow-[0_12px_30px_rgba(106,76,45,0.05)] hover:-translate-y-0.5 hover:border-[#cba379] hover:bg-white",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-[#ead8c4] bg-white text-lg font-black text-[#9c7043]">
                            {initials(record.displayName)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-base font-semibold text-[#2f2218]">
                              {record.displayName}
                            </div>
                            <div className="mt-1 truncate text-sm text-[#7a5d42]">
                              {record.email || "No email on file"}
                            </div>
                            <div className="mt-1 text-xs text-[#9c7a57]">
                              {record.phone || "No phone"}
                              {record.buyer.city || record.buyer.state
                                ? ` • ${[record.buyer.city, record.buyer.state].filter(Boolean).join(", ")}`
                                : ""}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(
                            record.buyer.status
                          )}`}
                        >
                          {record.buyer.status || "pending"}
                        </span>
                      </div>

                      <div className="mt-4 rounded-[22px] border border-[#ead8c4] bg-white/88 p-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9c7043]">
                          Assigned Puppies
                        </div>
                        <div className="mt-2 text-sm font-semibold text-[#2f2218]">
                          {record.linkedPuppies.length
                            ? record.linkedPuppies.map((puppy) => puppyLabel(puppy)).join(", ")
                            : "No puppies linked yet"}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-3">
                        <MiniStat label="Sale" value={fmtMoney(summary?.purchasePrice || 0)} />
                        <MiniStat label="Paid" value={fmtMoney(summary?.totalPaid || 0)} />
                        <MiniStat label="Balance" value={fmtMoney(summary?.balance || 0)} />
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-[#8a6a49]">
                          {record.hasPortalAccount ? "Portal linked" : "Manual admin record"} •{" "}
                          {record.linkedPuppies.length} linked pupp
                          {record.linkedPuppies.length === 1 ? "y" : "ies"}
                        </div>
                        <div className="rounded-full border border-[#ead8c4] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7043]">
                          Open profile
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="sm:col-span-2 xl:col-span-2 2xl:col-span-3">
                  <AdminEmptyState
                    title="No buyers matched your filters"
                    description="Try a different search term, switch between active and completed, or clear the status filter."
                  />
                </div>
              )}
            </div>
          </section>

          {selectedBuyer ? (
            <div className="space-y-6">
              <section className="rounded-[34px] border border-[#ead8c4] bg-white p-5 shadow-[0_24px_70px_rgba(106,76,45,0.09)] md:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px] border border-[#ead8c4] bg-[linear-gradient(180deg,#fffdf8_0%,#f4e7d7_100%)] text-xl font-black text-[#9c7043]">
                      {initials(selectedBuyer.displayName)}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-serif text-3xl font-bold text-[#2f2218] [font-family:var(--font-merriweather)]">
                          {selectedBuyer.displayName}
                        </h2>
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(
                            selectedBuyer.buyer.status
                          )}`}
                        >
                          {selectedBuyer.buyer.status || "pending"}
                        </span>
                        <span className="inline-flex rounded-full border border-[#ead8c4] bg-[#fffaf4] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7043]">
                          {selectedBuyer.hasPortalAccount ? "Portal Linked" : "Manual Record"}
                        </span>
                      </div>
                      <div className="mt-2 text-sm leading-6 text-[#7a5d42]">
                        {[
                          selectedBuyer.email || "No email",
                          selectedBuyer.phone || "No phone",
                          [selectedBuyer.buyer.city, selectedBuyer.buyer.state]
                            .filter(Boolean)
                            .join(", "),
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      </div>
                      <div className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#9c7043]">
                        Buyer ID {selectedBuyer.buyer.id} • Created{" "}
                        {fmtDate(selectedBuyer.buyer.created_at || "") || "Date unavailable"}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <QuickActionLink href="/admin/portal/payments" title="Open Payments" detail="Buyer-level balances and ledger." />
                    <QuickActionLink href="/admin/portal/puppy-payments" title="Open Puppy Financing" detail="Per-puppy financing controls." />
                    <QuickActionLink href="/admin/portal/documents" title="Open Documents" detail="Applications, forms, and signed files." />
                    <QuickActionLink href="/admin/portal/messages" title="Open Messages" detail="Communication follow-up and support." />
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <SnapshotCard label="Linked Puppies" value={String(selectedPuppyIds.length)} detail="Multi-puppy buyer assignments stay here." />
                  <SnapshotCard label="Applications" value={String(selectedBuyer.applicationCount)} detail={selectedBuyer.latestApplicationStatus || "No application status yet"} />
                  <SnapshotCard label="Forms" value={String(selectedBuyer.formCount)} detail="Portal-submitted forms on file." />
                  <SnapshotCard
                    label="Last Sign-In"
                    value={selectedBuyer.portalUser?.last_sign_in_at ? fmtDate(selectedBuyer.portalUser.last_sign_in_at) : "No sign-in"}
                    detail={selectedBuyer.portalUser?.email || "No linked auth user yet."}
                  />
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
                <div className="space-y-6">
                  <section className="rounded-[32px] border border-[#ead8c4] bg-white p-5 shadow-[0_20px_60px_rgba(106,76,45,0.08)] md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#9c7043]">
                          Buyer Profile
                        </div>
                        <h3 className="mt-2 text-2xl font-semibold text-[#2f2218]">
                          Contact and status details
                        </h3>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7a5d42]">
                          Update the buyer record here, then use the linked puppies panel and the
                          payment tabs for the rest of the workflow.
                        </p>
                      </div>
                    </div>

                    {statusText ? (
                      <div className="mt-4 rounded-[18px] border border-[#ead8c4] bg-[#fffaf4] px-4 py-3 text-sm font-semibold text-[#6b5038]">
                        {statusText}
                      </div>
                    ) : null}

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <FormField label="Full Name" value={form.full_name} onChange={(value) => setForm((current) => ({ ...current, full_name: value }))} />
                      <FormField label="Email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
                      <FormField label="Phone" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} />
                      <SelectField
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
                      <FormField label="City" value={form.city} onChange={(value) => setForm((current) => ({ ...current, city: value }))} />
                      <FormField label="State" value={form.state} onChange={(value) => setForm((current) => ({ ...current, state: value }))} />
                    </div>

                    <div className="mt-4">
                      <TextAreaField label="Notes" value={form.notes} onChange={(value) => setForm((current) => ({ ...current, notes: value }))} rows={5} />
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void saveBuyer()}
                        disabled={saving}
                        className="rounded-full bg-[linear-gradient(135deg,#c88c52_0%,#9f6331_100%)] px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_18px_34px_rgba(159,99,49,0.24)] transition hover:brightness-105 disabled:opacity-60"
                      >
                        {saving ? "Saving..." : "Save Buyer"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedBuyer) return;
                          setForm({
                            full_name: String(
                              selectedBuyer.buyer.full_name ||
                                selectedBuyer.buyer.name ||
                                selectedBuyer.displayName ||
                                ""
                            ),
                            email: String(selectedBuyer.buyer.email || selectedBuyer.email || ""),
                            phone: String(selectedBuyer.buyer.phone || selectedBuyer.phone || ""),
                            status: String(selectedBuyer.buyer.status || "pending"),
                            notes: String(selectedBuyer.buyer.notes || ""),
                            city: String(selectedBuyer.buyer.city || ""),
                            state: String(selectedBuyer.buyer.state || ""),
                          });
                          setSelectedPuppyIds(selectedBuyer.linkedPuppies.map((puppy) => puppy.id));
                          setStatusText("");
                        }}
                        className="rounded-full border border-[#dfc5a7] bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-[#5d4330] transition hover:border-[#cba379]"
                      >
                        Reset
                      </button>
                    </div>
                  </section>

                  <section className="rounded-[32px] border border-[#ead8c4] bg-white p-5 shadow-[0_20px_60px_rgba(106,76,45,0.08)] md:p-6">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#9c7043]">
                          Linked Puppies
                        </div>
                        <h3 className="mt-2 text-2xl font-semibold text-[#2f2218]">
                          Multi-puppy assignment
                        </h3>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7a5d42]">
                          Select one or more puppies for this buyer. Saving here updates the buyer
                          record and the shared puppy assignment relationship.
                        </p>
                      </div>

                      <Link
                        href="/admin/portal/puppies"
                        className="inline-flex items-center rounded-full border border-[#dfc5a7] bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-[#5d4330] transition hover:border-[#cba379]"
                      >
                        Open Puppies
                      </Link>
                    </div>

                    <div className="mt-4">
                      <input
                        value={puppySearch}
                        onChange={(event) => setPuppySearch(event.target.value)}
                        placeholder="Search puppies by name or status..."
                        className="w-full rounded-[22px] border border-[#e4d2be] bg-[#fffdf9] px-4 py-3.5 text-sm text-[#33251a] outline-none transition focus:border-[#c9a279]"
                      />
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {filteredPuppies.length ? (
                        filteredPuppies.map((puppy) => {
                          const checked = selectedPuppyIds.includes(puppy.id);
                          const linkedElsewhere =
                            puppy.buyer_id && puppy.buyer_id !== selectedBuyer.buyer.id;

                          return (
                            <label
                              key={puppy.id}
                              className={[
                                "flex cursor-pointer items-start gap-3 rounded-[24px] border p-4 transition",
                                checked
                                  ? "border-[#cba379] bg-[linear-gradient(180deg,#fffdf8_0%,#f7ecde_100%)]"
                                  : "border-[#ead8c4] bg-[#fffaf5] hover:border-[#cba379] hover:bg-white",
                              ].join(" ")}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePuppySelection(puppy.id)}
                                className="mt-1 h-4 w-4 rounded border-[#d0b290] text-[#9f6331] focus:ring-[#d0b290]"
                              />
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-[#2f2218]">
                                  {puppyLabel(puppy)}
                                </div>
                                <div className="mt-1 text-xs leading-5 text-[#8a6a49]">
                                  {puppy.status || "No status"} • {puppy.price !== null && puppy.price !== undefined ? fmtMoney(puppy.price) : "No price"}
                                </div>
                                <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a47946]">
                                  {linkedElsewhere
                                    ? `Currently linked to ${puppy.buyerName || `Buyer #${puppy.buyer_id}`}`
                                    : puppy.buyer_id === selectedBuyer.buyer.id
                                      ? "Already linked to this buyer"
                                      : "Available to assign"}
                                </div>
                              </div>
                            </label>
                          );
                        })
                      ) : (
                        <div className="sm:col-span-2">
                          <AdminEmptyState
                            title="No puppies matched your search"
                            description="Try a different puppy name or status term."
                          />
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                <div className="space-y-6">
                  <section className="rounded-[32px] border border-[#ead8c4] bg-white p-5 shadow-[0_20px_60px_rgba(106,76,45,0.08)] md:p-6">
                    <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#9c7043]">
                      Financial Snapshot
                    </div>
                    <h3 className="mt-2 text-2xl font-semibold text-[#2f2218]">
                      Buyer balance and financing visibility
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#7a5d42]">
                      This section mirrors the buyer financial picture from the admin payment
                      system without forcing you to leave the buyer workspace.
                    </p>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <SnapshotCard label="Purchase Price" value={fmtMoney(selectedSummary?.purchasePrice || 0)} detail="Combined puppy pricing or buyer sale price." />
                      <SnapshotCard label="Deposit" value={fmtMoney(selectedSummary?.deposit || 0)} detail="Recorded deposit currently attached to the account." />
                      <SnapshotCard label="Payments Applied" value={fmtMoney(selectedSummary?.totalPaid || 0)} detail="Logged payments reducing the current balance." />
                      <SnapshotCard label="Balance" value={fmtMoney(selectedSummary?.balance || 0)} detail="After financing terms, charges, credits, and payments." />
                      <SnapshotCard label="Monthly Payment" value={selectedSummary?.monthlyAmount ? fmtMoney(selectedSummary.monthlyAmount) : "Not listed"} detail={selectedSummary?.financeMonths ? `${selectedSummary.financeMonths} month term` : "No monthly schedule saved"} />
                      <SnapshotCard label="Next Due" value={selectedSummary?.nextDueDate ? fmtDate(selectedSummary.nextDueDate) : "Not listed"} detail={selectedSummary?.financeEnabled ? "From buyer financing settings." : "Financing not enabled."} />
                    </div>

                    <div className="mt-5 rounded-[24px] border border-[#ead8c4] bg-[#fffaf4] p-4">
                      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#9c7043]">
                        Financing Breakdown
                      </div>
                      <div className="mt-4 space-y-3">
                        <FinancialLineItem label="Principal After Deposit" value={fmtMoney(selectedSummary?.principalAfterDeposit || 0)} />
                        <FinancialLineItem label="Plan Total" value={fmtMoney(selectedSummary?.planTotal || 0)} />
                        <FinancialLineItem label="Manual Fees & Transportation" value={fmtMoney(selectedSummary?.adjustmentCharges || 0)} />
                        <FinancialLineItem label="Manual Credits" value={fmtMoney(selectedSummary?.adjustmentCredits || 0)} />
                        <FinancialLineItem label="Payments Applied" value={fmtMoney(selectedSummary?.totalPaid || 0)} />
                        <FinancialLineItem label="APR" value={selectedSummary?.financeRate !== null && selectedSummary?.financeRate !== undefined ? `${selectedSummary.financeRate}%` : "Not listed"} />
                        <FinancialLineItem label="Admin Fee Flag" value={selectedSummary?.adminFeeEnabled ? "On" : "Off"} />
                      </div>
                    </div>
                  </section>

                  <section className="rounded-[32px] border border-[#ead8c4] bg-white p-5 shadow-[0_20px_60px_rgba(106,76,45,0.08)] md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#9c7043]">
                          Recent Activity
                        </div>
                        <h3 className="mt-2 text-2xl font-semibold text-[#2f2218]">
                          Payments, fees, credits, and notes
                        </h3>
                      </div>
                      <div className="rounded-full border border-[#ead8c4] bg-[#fffaf4] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7043]">
                        {selectedSummary?.activityCount || 0} entries
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      {selectedActivity.length ? (
                        selectedActivity.map((activity) => (
                          <div
                            key={activity.key}
                            className="rounded-[22px] border border-[#ead8c4] bg-[linear-gradient(180deg,#fffdf9_0%,#f8efe4_100%)] p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-[#2f2218]">
                                  {activity.title}
                                </div>
                                <div className="mt-1 text-xs leading-5 text-[#8a6a49]">
                                  {fmtDate(activity.date)} • {activity.kind === "payment" ? "payment entry" : "manual adjustment"}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-[#2f2218]">
                                  {fmtMoney(activity.amount)}
                                </div>
                                <span
                                  className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(
                                    activity.status
                                  )}`}
                                >
                                  {activity.status}
                                </span>
                              </div>
                            </div>
                            {activity.detail ? (
                              <div className="mt-3 text-sm leading-6 text-[#7a5d42]">
                                {activity.detail}
                              </div>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <AdminEmptyState
                          title="No payment activity yet"
                          description="Payments, fees, credits, and transportation entries will surface here once they are logged."
                        />
                      )}
                    </div>
                  </section>
                </div>
              </section>
            </div>
          ) : (
            <section className="rounded-[34px] border border-[#ead8c4] bg-white p-6 shadow-[0_24px_70px_rgba(106,76,45,0.09)]">
              <AdminEmptyState
                title="No buyer selected"
                description="Choose a buyer card to open the profile, linked puppy assignments, and financial snapshot."
              />
            </section>
          )}
        </section>
      </div>
    </AdminPageShell>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-[#ead8c4] bg-white shadow-[0_18px_48px_rgba(106,76,45,0.08)]">
      <div className="h-1.5 w-full bg-[linear-gradient(90deg,#f1d7b0_0%,#cf9a60_50%,#a76532_100%)]" />
      <div className="p-5">
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[#9c7043]">
          {label}
        </div>
        <div className="mt-3 text-[30px] font-semibold leading-tight text-[#2f2218]">
          {value}
        </div>
        <div className="mt-3 text-sm leading-6 text-[#73583f]">{detail}</div>
      </div>
    </div>
  );
}

function SnapshotCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#ead8c4] bg-white p-4 shadow-[0_12px_32px_rgba(106,76,45,0.05)]">
      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#9c7043]">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-[#2f2218]">{value}</div>
      <div className="mt-2 text-sm leading-6 text-[#73583f]">{detail}</div>
    </div>
  );
}

function ViewTab({
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
        "rounded-full border px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] transition",
        active
          ? "border-[#cba379] bg-[linear-gradient(180deg,#fffdf8_0%,#f7ecde_100%)] text-[#2f2218] shadow-[0_12px_28px_rgba(106,76,45,0.08)]"
          : "border-[#ead8c4] bg-white text-[#7a5d42] hover:border-[#cba379]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-[#ead8c4] bg-white/88 p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7043]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[#2f2218]">{value}</div>
    </div>
  );
}

function QuickActionLink({
  href,
  title,
  detail,
}: {
  href: string;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[20px] border border-[#ead8c4] bg-[#fffaf4] px-4 py-3 transition hover:border-[#cba379] hover:bg-white"
    >
      <div className="text-sm font-semibold text-[#2f2218]">{title}</div>
      <div className="mt-1 text-xs leading-5 text-[#8a6a49]">{detail}</div>
    </Link>
  );
}

function FinancialLineItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[#ead8c4] bg-white px-4 py-3">
      <div className="text-sm font-semibold text-[#5d4330]">{label}</div>
      <div className="text-sm font-semibold text-[#2f2218]">{value}</div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[11px] font-black uppercase tracking-[0.16em] text-[#9c7043]">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-[20px] border border-[#e4d2be] bg-[#fffdf9] px-4 py-3.5 text-sm normal-case tracking-normal text-[#33251a] outline-none transition focus:border-[#c9a279]"
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
    <label className="block text-[11px] font-black uppercase tracking-[0.16em] text-[#9c7043]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-[20px] border border-[#e4d2be] bg-[#fffdf9] px-4 py-3.5 text-sm normal-case tracking-normal text-[#33251a] outline-none transition focus:border-[#c9a279]"
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

function TextAreaField({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <label className="block text-[11px] font-black uppercase tracking-[0.16em] text-[#9c7043]">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="mt-2 w-full rounded-[20px] border border-[#e4d2be] bg-[#fffdf9] px-4 py-3.5 text-sm normal-case tracking-normal text-[#33251a] outline-none transition focus:border-[#c9a279]"
      />
    </label>
  );
}
