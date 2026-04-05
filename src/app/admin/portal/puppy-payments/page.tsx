"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  AdminEmptyState,
  AdminHeroPrimaryAction,
  AdminHeroSecondaryAction,
  AdminInfoTile,
  AdminListCard,
  AdminMetricCard,
  AdminMetricGrid,
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
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  finance_enabled?: boolean | null;
  finance_admin_fee?: boolean | null;
  finance_rate?: number | null;
  finance_months?: number | null;
  finance_monthly_amount?: number | null;
  finance_next_due_date?: string | null;
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
};

type PuppyPaymentAccount = {
  key: string;
  buyer: BuyerRow;
  puppy: PuppyRow;
  linkedPuppies: PuppyRow[];
  payments: BuyerPayment[];
  adjustments: BuyerAdjustment[];
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

type PuppyBalanceSummary = {
  price: number;
  deposit: number;
  principalAfterDeposit: number;
  paymentsApplied: number;
  adjustmentCharges: number;
  adjustmentCredits: number;
  balance: number;
  financeEnabled: boolean;
  financePlanAppliesDirectly: boolean;
  financeBaseTotal: number;
  financeUplift: number;
  apr: number | null;
  monthlyAmount: number | null;
  financeMonths: number | null;
  nextDueDate: string | null;
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
  return firstValue(puppy?.call_name, puppy?.puppy_name, puppy?.name, "Unnamed Puppy");
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

function paymentBelongsToPuppy(account: PuppyPaymentAccount, payment: BuyerPayment) {
  if (payment.puppy_id) return Number(payment.puppy_id) === account.puppy.id;
  return account.linkedPuppies.length <= 1;
}

function adjustmentBelongsToPuppy(account: PuppyPaymentAccount, adjustment: BuyerAdjustment) {
  if (adjustment.puppy_id) return Number(adjustment.puppy_id) === account.puppy.id;
  return account.linkedPuppies.length <= 1;
}

function flattenPuppyAccounts(accounts: BuyerAccount[]) {
  return accounts.flatMap((account) => {
    const linkedPuppies = account.linkedPuppies || (account.puppy ? [account.puppy] : []);
    return linkedPuppies.map((puppy) => ({
      key: `${account.buyer.id}-${puppy.id}`,
      buyer: account.buyer,
      puppy,
      linkedPuppies,
      payments: account.payments.filter((payment) =>
        paymentBelongsToPuppy(
          { key: "", buyer: account.buyer, puppy, linkedPuppies, payments: [], adjustments: [] },
          payment
        )
      ),
      adjustments: account.adjustments.filter((adjustment) =>
        adjustmentBelongsToPuppy(
          { key: "", buyer: account.buyer, puppy, linkedPuppies, payments: [], adjustments: [] },
          adjustment
        )
      ),
    }));
  });
}

function calculatePuppyBalanceSummary(account: PuppyPaymentAccount, form: EditForm): PuppyBalanceSummary {
  const price = toNumberOrNull(form.price) ?? account.puppy.price ?? 0;
  const deposit = toNumberOrNull(form.deposit) ?? account.puppy.deposit ?? 0;
  const principalAfterDeposit = Math.max(0, price - deposit);
  const paymentsApplied = account.payments
    .filter((payment) => paymentCountsTowardBalance(payment.status))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const adjustmentCharges = account.adjustments.reduce((sum, adjustment) => {
    if (!adjustmentCountsTowardBalance(adjustment.status)) return sum;
    if (String(adjustment.entry_type || "").trim().toLowerCase() === "credit") return sum;
    return sum + Math.abs(Number(adjustment.amount || 0));
  }, 0);
  const adjustmentCredits = account.adjustments.reduce((sum, adjustment) => {
    if (!adjustmentCountsTowardBalance(adjustment.status)) return sum;
    if (String(adjustment.entry_type || "").trim().toLowerCase() !== "credit") return sum;
    return sum + Math.abs(Number(adjustment.amount || 0));
  }, 0);
  const financeEnabled = form.finance_enabled === "yes";
  const financePlanAppliesDirectly = account.linkedPuppies.length <= 1;
  const apr = toNumberOrNull(form.finance_rate);
  const monthlyAmount = toNumberOrNull(form.finance_monthly_amount);
  const financeMonths = toNumberOrNull(form.finance_months);
  const planTotal =
    financeEnabled &&
    financePlanAppliesDirectly &&
    monthlyAmount !== null &&
    financeMonths !== null
      ? Math.max(principalAfterDeposit, monthlyAmount * financeMonths)
      : null;
  const financeBaseTotal = planTotal ?? principalAfterDeposit;
  const financeUplift = Math.max(0, financeBaseTotal - principalAfterDeposit);
  const balance = Math.max(
    0,
    financeBaseTotal + adjustmentCharges - adjustmentCredits - paymentsApplied
  );

  return {
    price,
    deposit,
    principalAfterDeposit,
    paymentsApplied,
    adjustmentCharges,
    adjustmentCredits,
    balance,
    financeEnabled,
    financePlanAppliesDirectly,
    financeBaseTotal,
    financeUplift,
    apr,
    monthlyAmount,
    financeMonths,
    nextDueDate: form.finance_next_due_date || null,
  };
}

async function fetchBuyerPaymentAccounts(accessToken: string) {
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

export default function AdminPortalPuppyPaymentsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingEntry, setLoggingEntry] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [entryStatusText, setEntryStatusText] = useState("");
  const [search, setSearch] = useState("");
  const [accounts, setAccounts] = useState<PuppyPaymentAccount[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
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
          const nextAccounts = flattenPuppyAccounts(await fetchBuyerPaymentAccounts(token));
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
        const nextAccounts = flattenPuppyAccounts(await fetchBuyerPaymentAccounts(token));
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
        puppyName(account.puppy),
        account.puppy.status,
        account.buyer.full_name,
        account.buyer.name,
        account.buyer.email,
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
    if (!filteredAccounts.length) {
      setSelectedKey("");
      return;
    }
    if (!filteredAccounts.some((account) => account.key === selectedKey)) {
      setSelectedKey(filteredAccounts[0].key);
    }
  }, [filteredAccounts, selectedKey]);

  useEffect(() => {
    if (!selectedAccount) return;

    setForm({
      price:
        selectedAccount.puppy.price !== null && selectedAccount.puppy.price !== undefined
          ? String(selectedAccount.puppy.price)
          : "",
      deposit:
        selectedAccount.puppy.deposit !== null && selectedAccount.puppy.deposit !== undefined
          ? String(selectedAccount.puppy.deposit)
          : "",
      puppy_status: selectedAccount.puppy.status || "",
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
    setEntryMode("payment");
    setEntryForm(entryFormForMode("payment"));
    setStatusText("");
    setEntryStatusText("");
  }, [selectedAccount]);

  const balanceSummary = useMemo(
    () => (selectedAccount ? calculatePuppyBalanceSummary(selectedAccount, form) : null),
    [form, selectedAccount]
  );

  async function refreshAccounts(nextSelectedKey?: string) {
    const nextAccounts = flattenPuppyAccounts(await fetchBuyerPaymentAccounts(accessToken));
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
          puppy_id: selectedAccount.puppy.id,
          ...form,
          balance: balanceSummary.balance,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not update puppy payment settings.");
      }

      await refreshAccounts(selectedAccount.key);
      setStatusText("Puppy payment settings updated.");
    } catch (error) {
      console.error(error);
      setStatusText("Could not update puppy payment settings.");
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
                puppy_id: selectedAccount.puppy.id,
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
                puppy_id: selectedAccount.puppy.id,
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
        throw new Error(payload.error || "Could not save the puppy payment entry.");
      }

      await refreshAccounts(selectedAccount.key);
      setEntryForm(entryFormForMode(entryMode));
      setEntryStatusText(
        entryMode === "payment"
          ? "Puppy payment recorded."
          : entryMode === "credit"
            ? "Puppy credit recorded."
            : entryMode === "transportation"
              ? "Puppy transportation charge recorded."
              : "Puppy fee recorded."
      );
    } catch (error) {
      console.error(error);
      setEntryStatusText(
        error instanceof Error ? error.message : "Could not save the puppy payment entry."
      );
    } finally {
      setLoggingEntry(false);
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">
        Loading puppy payments...
      </div>
    );
  }

  if (!user) {
    return (
      <AdminRestrictedState
        title="Sign in to access puppy payments."
        details="This page is reserved for the Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!isPortalAdminEmail(user.email)) {
    return (
      <AdminRestrictedState
        title="This puppy payment workspace is limited to approved owner accounts."
        details="Only the approved owner emails can manage puppy-by-puppy financial records here."
      />
    );
  }

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-12">
        <AdminPageHero
          eyebrow="Puppy Payments"
          title="Manage pricing, deposits, payments, fees, credits, and transportation one puppy at a time."
          description="This workspace is grouped by puppy instead of buyer, so each puppy account can be reviewed cleanly even when one buyer has purchased more than one puppy."
          actions={
            <>
              <AdminHeroPrimaryAction href="/admin/portal/payments">Open Buyer Payments</AdminHeroPrimaryAction>
              <AdminHeroSecondaryAction href="/admin/portal/users">Open Buyers</AdminHeroSecondaryAction>
            </>
          }
          aside={
            <div className="space-y-4">
              <AdminInfoTile
                label="Puppy Accounts"
                value={String(accounts.length)}
                detail="Linked puppy records currently available for payment management."
              />
              <AdminInfoTile
                label="Buyer-Level Plans"
                value={String(accounts.filter((account) => account.buyer.finance_enabled).length)}
                detail="Puppy accounts whose linked buyer has financing enabled."
              />
            </div>
          }
        />

        <AdminMetricGrid>
          <AdminMetricCard
            label="Puppy Accounts"
            value={String(accounts.length)}
            detail="Puppy records currently available in this workspace."
          />
          <AdminMetricCard
            label="Payment Records"
            value={String(accounts.reduce((sum, account) => sum + account.payments.length, 0))}
            detail="Puppy-tagged or single-puppy payment entries."
            accent="from-[#ece3d5] via-[#d7c1a3] to-[#b18d62]"
          />
          <AdminMetricCard
            label="Fees & Credits"
            value={String(accounts.reduce((sum, account) => sum + account.adjustments.length, 0))}
            detail="Puppy-tagged manual entries."
            accent="from-[#dce9d6] via-[#b6cfaa] to-[#7e9c6f]"
          />
          <AdminMetricCard
            label="Search Results"
            value={String(filteredAccounts.length)}
            detail="Puppy cards matching the current search."
            accent="from-[#f0dcc1] via-[#ddb68c] to-[#c98743]"
          />
        </AdminMetricGrid>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <AdminPanel
            title="Puppy Cards"
            subtitle="Search by puppy name, status, buyer name, or buyer email."
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search puppies..."
              className="w-full rounded-[20px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]"
            />

            <div className="mt-4 space-y-3">
              {filteredAccounts.length ? (
                filteredAccounts.map((account) => (
                  <AdminListCard
                    key={account.key}
                    selected={selectedKey === account.key}
                    onClick={() => setSelectedKey(account.key)}
                    title={puppyName(account.puppy)}
                    subtitle={firstValue(account.buyer.full_name, account.buyer.name, account.buyer.email, "Buyer not linked")}
                    meta={`${account.puppy.status || "pending"} - ${fmtMoney(account.puppy.price || 0)} price`}
                    badge={
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(
                          account.puppy.status
                        )}`}
                      >
                        {account.puppy.status || "pending"}
                      </span>
                    }
                  />
                ))
              ) : (
                <AdminEmptyState
                  title="No puppy accounts matched your search"
                  description="Try a different puppy name, buyer, or status."
                />
              )}
            </div>
          </AdminPanel>

          {selectedAccount && balanceSummary ? (
            <div className="space-y-6">
              <AdminPanel
                title="Puppy Financial Snapshot"
                subtitle="Review the selected puppy, the linked buyer, and the current balance."
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <AdminInfoTile label="Puppy" value={puppyName(selectedAccount.puppy)} />
                  <AdminInfoTile
                    label="Buyer"
                    value={firstValue(selectedAccount.buyer.full_name, selectedAccount.buyer.name, selectedAccount.buyer.email, "Not linked")}
                  />
                  <AdminInfoTile label="Payments" value={fmtMoney(balanceSummary.paymentsApplied)} />
                  <AdminInfoTile
                    label="Fees / Credits"
                    value={`${fmtMoney(balanceSummary.adjustmentCharges)} / ${fmtMoney(balanceSummary.adjustmentCredits)}`}
                    detail="Charges and credits tagged to this puppy account."
                  />
                  <AdminInfoTile label="Balance" value={fmtMoney(balanceSummary.balance)} />
                </div>
              </AdminPanel>

              <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.05fr)_420px]">
                <div className="space-y-6">
                  <AdminPanel
                    title="Puppy Account Settings"
                    subtitle="Update the puppy price, deposit, puppy status, and linked buyer financing details when needed."
                  >
                    {statusText ? (
                      <div className="mb-4 rounded-[18px] border border-[#ead9c7] bg-[#fff9f2] px-4 py-3 text-sm font-semibold text-[#7a5a3a]">
                        {statusText}
                      </div>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-2">
                      <PaymentField label="Price" value={form.price} onChange={(value) => setForm((prev) => ({ ...prev, price: value }))} />
                      <PaymentField label="Deposit" value={form.deposit} onChange={(value) => setForm((prev) => ({ ...prev, deposit: value }))} />
                      <PaymentField label="Puppy Status" value={form.puppy_status} onChange={(value) => setForm((prev) => ({ ...prev, puppy_status: value }))} />
                      <PaymentSelect label="Financing Enabled" value={form.finance_enabled} onChange={(value) => setForm((prev) => ({ ...prev, finance_enabled: value }))} />
                      <PaymentSelect label="Admin Fee" value={form.finance_admin_fee} onChange={(value) => setForm((prev) => ({ ...prev, finance_admin_fee: value }))} />
                      <PaymentField label="APR / Rate" value={form.finance_rate} onChange={(value) => setForm((prev) => ({ ...prev, finance_rate: value }))} />
                      <PaymentField label="Finance Months" value={form.finance_months} onChange={(value) => setForm((prev) => ({ ...prev, finance_months: value }))} />
                      <PaymentField label="Monthly Amount" value={form.finance_monthly_amount} onChange={(value) => setForm((prev) => ({ ...prev, finance_monthly_amount: value }))} />
                      <PaymentDateField label="Next Due Date" value={form.finance_next_due_date} onChange={(value) => setForm((prev) => ({ ...prev, finance_next_due_date: value }))} />
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving}
                        className="rounded-2xl bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(181,117,47,0.26)] transition hover:brightness-105 disabled:opacity-60"
                      >
                        {saving ? "Saving..." : "Save Puppy Account"}
                      </button>
                    </div>
                  </AdminPanel>
                </div>

                <div className="space-y-6">
                  <AdminPanel
                    title="Add Puppy Entry"
                    subtitle="Record payments, fees, credits, and transportation charges directly to this puppy account."
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      <EntryModeButton active={entryMode === "payment"} label="Add Payment" onClick={() => setEntryModeAndReset("payment")} />
                      <EntryModeButton active={entryMode === "fee"} label="Add Fee" onClick={() => setEntryModeAndReset("fee")} />
                      <EntryModeButton active={entryMode === "credit"} label="Add Credit" onClick={() => setEntryModeAndReset("credit")} />
                      <EntryModeButton active={entryMode === "transportation"} label="Add Transportation" onClick={() => setEntryModeAndReset("transportation")} />
                    </div>

                    {entryStatusText ? (
                      <div className="mt-4 rounded-[18px] border border-[#ead9c7] bg-[#fff9f2] px-4 py-3 text-sm font-semibold text-[#7a5a3a]">
                        {entryStatusText}
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-4">
                      <PaymentDateField label={entryMode === "payment" ? "Payment Date" : "Entry Date"} value={entryForm.entry_date} onChange={(value) => setEntryForm((prev) => ({ ...prev, entry_date: value }))} />
                      <PaymentField label="Amount" value={entryForm.amount} onChange={(value) => setEntryForm((prev) => ({ ...prev, amount: value }))} />
                      {entryMode === "payment" ? (
                        <>
                          <PaymentField label="Payment Type" value={entryForm.payment_type} onChange={(value) => setEntryForm((prev) => ({ ...prev, payment_type: value }))} />
                          <PaymentField label="Method" value={entryForm.method} onChange={(value) => setEntryForm((prev) => ({ ...prev, method: value }))} />
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
                            onChange={(value) =>
                              setEntryForm((prev) => ({
                                ...prev,
                                entry_type: value,
                                label:
                                  value === "transportation"
                                    ? "Transportation Fee"
                                    : value === "credit"
                                      ? "Credit"
                                      : prev.label || "Fee",
                              }))
                            }
                          />
                          <PaymentField label="Label" value={entryForm.label} onChange={(value) => setEntryForm((prev) => ({ ...prev, label: value }))} />
                        </>
                      )}
                      <PaymentField label="Status" value={entryForm.status} onChange={(value) => setEntryForm((prev) => ({ ...prev, status: value }))} />
                      <PaymentField label="Reference Number" value={entryForm.reference_number} onChange={(value) => setEntryForm((prev) => ({ ...prev, reference_number: value }))} />
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a47946]">
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
                          className="mt-2 w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]"
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
                        {loggingEntry ? "Saving..." : "Record Puppy Entry"}
                      </button>
                    </div>
                  </AdminPanel>

                  <AdminPanel
                    title="Puppy Balance Logic"
                    subtitle="Balance is calculated from this puppy's price, deposit, tagged entries, and payment history."
                  >
                    <div className="grid gap-4">
                      <AdminInfoTile label="Price" value={fmtMoney(balanceSummary.price)} />
                      <AdminInfoTile label="Deposit" value={fmtMoney(balanceSummary.deposit)} />
                      <AdminInfoTile label="Principal After Deposit" value={fmtMoney(balanceSummary.principalAfterDeposit)} />
                      <AdminInfoTile label="Payments Applied" value={fmtMoney(balanceSummary.paymentsApplied)} />
                      <AdminInfoTile label="Manual Charges" value={fmtMoney(balanceSummary.adjustmentCharges)} />
                      <AdminInfoTile label="Manual Credits" value={fmtMoney(balanceSummary.adjustmentCredits)} />
                      <AdminInfoTile
                        label="Financing"
                        value={balanceSummary.financeEnabled ? "Enabled" : "Not enabled"}
                        detail={
                          balanceSummary.financeEnabled
                            ? balanceSummary.financePlanAppliesDirectly
                              ? `${balanceSummary.apr !== null ? `${balanceSummary.apr}% APR` : "APR not listed"} - ${balanceSummary.financeMonths !== null ? `${balanceSummary.financeMonths} months` : "term not listed"}`
                              : "Buyer-level financing exists, but this buyer has multiple linked puppies. Puppy-specific balance stays based on tagged puppy entries."
                            : "No financing is enabled on the linked buyer record."
                        }
                      />
                      <AdminInfoTile label="Balance" value={fmtMoney(balanceSummary.balance)} />
                    </div>
                  </AdminPanel>
                </div>
              </section>
            </div>
          ) : (
            <AdminPanel title="Puppy Payments" subtitle="Choose a puppy card to begin.">
              <AdminEmptyState
                title="No puppy selected"
                description="Choose a puppy card from the left to review pricing, payments, fees, credits, and transportation charges."
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a47946]">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm normal-case tracking-normal text-[#3e2a1f] outline-none focus:border-[#c8a884]"
      />
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
    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a47946]">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm normal-case tracking-normal text-[#3e2a1f] outline-none focus:border-[#c8a884]"
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
    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a47946]">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm normal-case tracking-normal text-[#3e2a1f] outline-none focus:border-[#c8a884]"
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
          ? "border-[#d8b48b] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2e9_100%)] text-[#2f2218] shadow-[0_12px_30px_rgba(106,76,45,0.08)]"
          : "border-[#ead9c7] bg-[#fffaf5] text-[#73583f] hover:border-[#d8b48b] hover:bg-white",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
