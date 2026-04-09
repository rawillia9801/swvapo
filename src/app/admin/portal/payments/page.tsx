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
  const haystack = [payment.method, payment.note].map((value) => String(value || "").toLowerCase()).join(" ");
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
  const [loggingEntry, setLoggingEntry] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [entryStatusText, setEntryStatusText] = useState("");
  const [search, setSearch] = useState("");
  const [accounts, setAccounts] = useState<BuyerAccount[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [entryMode, setEntryMode] = useState<EntryMode>("payment");
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
        setSelectedKey(
          (prev) => nextAccounts.find((account) => account.key === prev)?.key || nextAccounts[0]?.key || ""
        );
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

  const accountActivity = useMemo(
    () => (selectedAccount ? buildAccountActivity(selectedAccount) : []),
    [selectedAccount]
  );

  async function refreshAccounts(nextSelectedKey?: string) {
    const nextAccounts = await fetchPaymentAccounts(accessToken);
    setAccounts(nextAccounts);
    setSelectedKey(
      nextSelectedKey || nextAccounts.find((account) => account.key === selectedKey)?.key || nextAccounts[0]?.key || ""
    );
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
          title="Every buyer payment, fee, credit, and transportation charge stays in one account workspace."
          description="Review balances, edit financing, log manual payments, add fees or credits, and keep the buyer-facing ledger clear and consistent."
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
                label="Payment Plans"
                value={String(accounts.filter((account) => account.buyer.finance_enabled).length)}
                detail="Buyer accounts currently using a financing plan."
              />
            </div>
          }
        />

        <AdminPanel
          title="Finance Bench"
          subtitle="The buyer ledger should surface collection workload, plan management, and manual entry volume at a glance."
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

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
          <AdminPanel
            title="Buyer Payment Cards"
            subtitle="Search by buyer or puppy name. Each card keeps one buyer account together."
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search buyers or puppies..."
              className="w-full rounded-[20px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3 text-sm text-[var(--portal-text)] outline-none focus:border-[#c8a884]"
            />

            <div className="mt-4 space-y-3">
              {filteredAccounts.length ? (
                filteredAccounts.map((account) => (
                  <AdminListCard
                    key={account.key}
                    selected={selectedKey === account.key}
                    onClick={() => setSelectedKey(account.key)}
                    title={firstValue(
                      account.buyer.full_name,
                      account.buyer.name,
                      account.buyer.email,
                      `Buyer #${account.buyer.id}`
                    )}
                    subtitle={`${account.buyer.email || "No email"} - ${puppyName(account.puppy)}`}
                    meta={`${fmtMoney(account.totalPaid)} paid - ${account.adjustments.length} fee/credit entr${account.adjustments.length === 1 ? "y" : "ies"}${
                      countZohoPayments(account)
                        ? ` - ${countZohoPayments(account)} Zoho receipt${countZohoPayments(account) === 1 ? "" : "s"}`
                        : ""
                    }`}
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

          {selectedAccount && balanceSummary ? (
            <div className="space-y-6">
              <AdminPanel
                title="Financial Snapshot"
                subtitle="A clean read of the selected buyer's pricing, financing, payments, and manual account adjustments."
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                  <AdminInfoTile
                    label="Buyer"
                    value={firstValue(
                      selectedAccount.buyer.full_name,
                      selectedAccount.buyer.name,
                      selectedAccount.buyer.email,
                      "Buyer"
                    )}
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

                <div className="mt-4 grid gap-4 md:grid-cols-2">
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
                      Last Zoho Receipt
                    </div>
                    <div className="mt-2 text-lg font-semibold text-[var(--portal-text)]">
                      {latestZohoPaymentDate(selectedAccount)
                        ? fmtDate(latestZohoPaymentDate(selectedAccount) || "")
                        : "No Zoho receipt yet"}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                      This helps confirm the most recent portal-synced customer payment for this account.
                    </div>
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
                    subtitle="Payments, fees, credits, and transportation charges stay together in one chronological record."
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
                                  {entry.title} - {fmtMoney(entry.amount)}
                                </div>
                                <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                                  {fmtDate(entry.date)} - {entry.kind === "payment" ? "payment entry" : "manual adjustment"}
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
                              <div className="mt-3 text-sm leading-6 text-[var(--portal-text-soft)]">{entry.detail}</div>
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
                        onChange={(value) => setEntryForm((prev) => ({ ...prev, entry_date: value }))}
                      />
                      <PaymentField
                        label="Amount"
                        value={entryForm.amount}
                        onChange={(value) => setEntryForm((prev) => ({ ...prev, amount: value }))}
                      />

                      {entryMode === "payment" ? (
                        <>
                          <PaymentField
                            label="Payment Type"
                            value={entryForm.payment_type}
                            onChange={(value) => setEntryForm((prev) => ({ ...prev, payment_type: value }))}
                          />
                          <PaymentField
                            label="Method"
                            value={entryForm.method}
                            onChange={(value) => setEntryForm((prev) => ({ ...prev, method: value }))}
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
                            onChange={(value) => setEntryForm((prev) => ({ ...prev, label: value }))}
                          />
                        </>
                      )}

                      <PaymentField
                        label="Status"
                        value={entryForm.status}
                        onChange={(value) => setEntryForm((prev) => ({ ...prev, status: value }))}
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
                    subtitle="This card shows exactly how the buyer balance is being calculated."
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
                        detail="Deposit already applied before plan terms and payments."
                      />
                      <AdminInfoTile
                        label="Principal After Deposit"
                        value={fmtMoney(balanceSummary.principalAfterDeposit)}
                        detail="Base principal after subtracting the deposit."
                      />
                      <AdminInfoTile
                        label="Plan Base Total"
                        value={fmtMoney(balanceSummary.financeBaseTotal)}
                        detail={
                          balanceSummary.financeEnabled
                            ? "Financing-adjusted total before fees, transportation, and credits."
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
                            ? `${balanceSummary.apr !== null ? `${balanceSummary.apr}% APR` : "APR not listed"}${balanceSummary.adminFeeEnabled ? " - admin fee marked on." : "."}`
                            : "No financing uplift is being added."
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
                    </div>
                  </AdminPanel>
                </div>
              </section>
            </div>
          ) : (
            <AdminPanel title="Financial Snapshot" subtitle="Choose a buyer card to begin.">
              <AdminEmptyState
                title="No buyer selected"
                description="Choose a buyer card from the left to review payment settings, account entries, and balance details."
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

