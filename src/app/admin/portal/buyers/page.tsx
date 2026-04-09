"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AdminEmptyState,
  AdminHeroPrimaryAction,
  AdminHeroSecondaryAction,
  AdminInfoTile,
  AdminPageHero,
  AdminPageShell,
  AdminPanel,
  AdminRestrictedState,
  adminStatusBadge,
} from "@/components/admin/luxury-admin-shell";
import {
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
    created_at?: string | null;
  };
  displayName: string;
  email: string;
  phone: string;
  hasPortalAccount: boolean;
  portalUser: { email: string; last_sign_in_at?: string | null } | null;
  applicationCount: number;
  formCount: number;
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
    finance_next_due_date?: string | null;
    finance_last_payment_date?: string | null;
  };
  payments: Array<{ id: string; amount: number; payment_date: string; payment_type?: string | null; method?: string | null; note?: string | null; status?: string | null }>;
  adjustments: Array<{ id: number; amount: number; entry_date: string; label?: string | null; description?: string | null; entry_type?: string | null; status?: string | null }>;
  linkedPuppies: PuppyOption[];
  lastPaymentAt: string | null;
};

type BuyerForm = {
  full_name: string;
  email: string;
  phone: string;
  status: string;
  city: string;
  state: string;
  notes: string;
};

function emptyForm(): BuyerForm {
  return { full_name: "", email: "", phone: "", status: "pending", city: "", state: "", notes: "" };
}

function puppyLabel(puppy: PuppyOption) {
  return puppy.call_name || puppy.puppy_name || puppy.name || `Puppy #${puppy.id}`;
}

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function complete(status: string | null | undefined) {
  return String(status || "").toLowerCase().includes("completed");
}

function summaryForBuyer(buyer: BuyerRecord, account: BuyerAccount | null) {
  const puppies = account?.linkedPuppies?.length ? account.linkedPuppies : buyer.linkedPuppies;
  const purchasePrice = puppies.length ? puppies.reduce((sum, puppy) => sum + num(puppy.price || puppy.list_price), 0) : num(account?.buyer.sale_price);
  const deposit = num(account?.buyer.deposit_amount);
  const totalPaid = account?.payments.filter((item) => !["failed", "void", "cancelled", "canceled"].includes(String(item.status || "").toLowerCase())).reduce((sum, item) => sum + num(item.amount), 0) || 0;
  const adjustments = account?.adjustments.filter((item) => !["void", "cancelled", "canceled"].includes(String(item.status || "").toLowerCase())).reduce((sum, item) => sum + num(item.amount), 0) || 0;
  return {
    purchasePrice,
    deposit,
    totalPaid,
    balance: Math.max(0, purchasePrice + adjustments - totalPaid),
    monthlyAmount: num(account?.buyer.finance_monthly_amount),
    financeEnabled: Boolean(account?.buyer.finance_enabled),
    nextDueDate: account?.buyer.finance_next_due_date || "",
    lastPaymentAt: account?.lastPaymentAt || account?.buyer.finance_last_payment_date || "",
    activityCount: (account?.payments.length || 0) + (account?.adjustments.length || 0),
  };
}

async function fetchBuyers(accessToken: string) {
  const [buyersRes, accountsRes] = await Promise.all([
    fetch("/api/admin/portal/buyers", { headers: { Authorization: `Bearer ${accessToken}` } }),
    fetch("/api/admin/portal/payments", { headers: { Authorization: `Bearer ${accessToken}` } }),
  ]);
  const buyersPayload = buyersRes.ok ? ((await buyersRes.json()) as { buyers?: BuyerRecord[]; puppies?: PuppyOption[] }) : {};
  const accountsPayload = accountsRes.ok ? ((await accountsRes.json()) as { accounts?: BuyerAccount[] }) : {};
  return {
    buyers: Array.isArray(buyersPayload.buyers) ? buyersPayload.buyers : [],
    puppies: Array.isArray(buyersPayload.puppies) ? buyersPayload.puppies : [],
    accounts: Array.isArray(accountsPayload.accounts) ? accountsPayload.accounts : [],
  };
}

export default function AdminPortalBuyersPage() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const [buyers, setBuyers] = useState<BuyerRecord[]>([]);
  const [puppies, setPuppies] = useState<PuppyOption[]>([]);
  const [accounts, setAccounts] = useState<BuyerAccount[]>([]);
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
    setCreateMode(nextCreateMode);
    setSelectedKey(nextCreateMode ? "" : preferredKey && payload.buyers.some((buyer) => buyer.key === preferredKey) ? preferredKey : payload.buyers[0]?.key || "");
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

  const accountsByBuyerId = useMemo(() => new Map(accounts.map((account) => [account.buyer.id, account] as const)), [accounts]);
  const filteredBuyers = useMemo(() => buyers.filter((record) => {
    if (viewMode === "active" && complete(record.buyer.status)) return false;
    if (viewMode === "completed" && !complete(record.buyer.status)) return false;
    if (statusFilter !== "all" && String(record.buyer.status || "").toLowerCase() !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [record.displayName, record.email, record.phone, record.buyer.city, record.buyer.state, record.buyer.notes, ...record.linkedPuppies.map((puppy) => puppyLabel(puppy))].map((value) => String(value || "").toLowerCase()).join(" ").includes(q);
  }), [buyers, search, statusFilter, viewMode]);

  const selectedBuyer = createMode ? null : filteredBuyers.find((buyer) => buyer.key === selectedKey) || buyers.find((buyer) => buyer.key === selectedKey) || null;
  const selectedAccount = selectedBuyer ? accountsByBuyerId.get(selectedBuyer.buyer.id) || null : null;
  const selectedSummary = selectedBuyer ? summaryForBuyer(selectedBuyer, selectedAccount) : null;
  const selectedActivity = (selectedAccount ? [
    ...selectedAccount.payments.map((item) => ({ key: `p-${item.id}`, date: item.payment_date, title: item.payment_type || "Payment", amount: num(item.amount), detail: [item.method, item.note].filter(Boolean).join(" • "), status: item.status || "recorded" })),
    ...selectedAccount.adjustments.map((item) => ({ key: `a-${item.id}`, date: item.entry_date, title: item.label || item.entry_type || "Adjustment", amount: num(item.amount), detail: item.description || "", status: item.status || "recorded" })),
  ] : []).sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()).slice(0, 6);

  useEffect(() => {
    if (createMode) {
      setForm(emptyForm());
      setSelectedPuppyIds([]);
      return;
    }
    if (!selectedBuyer) return;
    setForm({
      full_name: String(selectedBuyer.buyer.full_name || selectedBuyer.buyer.name || selectedBuyer.displayName || ""),
      email: String(selectedBuyer.buyer.email || selectedBuyer.email || ""),
      phone: String(selectedBuyer.buyer.phone || selectedBuyer.phone || ""),
      status: String(selectedBuyer.buyer.status || "pending"),
      city: String(selectedBuyer.buyer.city || ""),
      state: String(selectedBuyer.buyer.state || ""),
      notes: String(selectedBuyer.buyer.notes || ""),
    });
    setSelectedPuppyIds(selectedBuyer.linkedPuppies.map((puppy) => puppy.id));
    setStatusText("");
  }, [createMode, selectedBuyer]);

  useEffect(() => {
    if (createMode || !filteredBuyers.length || filteredBuyers.some((buyer) => buyer.key === selectedKey)) return;
    setSelectedKey(filteredBuyers[0].key);
  }, [createMode, filteredBuyers, selectedKey]);

  async function saveBuyer() {
    if (!accessToken) return;
    setSaving(true);
    setStatusText("");
    try {
      const response = await fetch("/api/admin/portal/buyers", {
        method: createMode ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ id: createMode ? undefined : selectedBuyer?.buyer.id, ...form, linked_puppy_ids: selectedPuppyIds }),
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

  if (loading || loadingData) return <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">Loading buyers...</div>;
  if (!user) return <AdminRestrictedState title="Sign in to access buyers." details="This workspace is reserved for the Southwest Virginia Chihuahua owner accounts." />;
  if (!isAdmin) return <AdminRestrictedState title="This buyer workspace is limited to approved owner accounts." details="Only the approved owner emails can manage buyer records and assignments." />;

  const totalDeposits = buyers.reduce((sum, buyer) => sum + summaryForBuyer(buyer, accountsByBuyerId.get(buyer.buyer.id) || null).deposit, 0);

  return (
    <AdminPageShell>
      <div className="space-y-5 pb-10">
        <AdminPageHero eyebrow="Buyers" title="Run buyer accounts as placement files, not loose contact records." description="Families, puppy assignments, financing context, portal access, and recent payment activity stay together here so the buyer side of the breeding hub is easy to operate and hard to miss details in." actions={<><button type="button" onClick={() => { setCreateMode(true); setForm(emptyForm()); setSelectedPuppyIds([]); setStatusText(""); }} className="inline-flex items-center rounded-2xl bg-[linear-gradient(90deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--portal-shadow-md)] transition hover:-translate-y-0.5">Create Buyer</button><AdminHeroPrimaryAction href="/admin/portal/payments">Open Payments</AdminHeroPrimaryAction><AdminHeroSecondaryAction href="/admin/portal/messages">Open Messages</AdminHeroSecondaryAction></>} aside={<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1"><AdminInfoTile label="Portal Accounts" value={String(buyers.filter((buyer) => buyer.hasPortalAccount).length)} detail="Buyer records already linked to a portal login." /><AdminInfoTile label="Deposits Recorded" value={fmtMoney(totalDeposits)} detail="Deposits tied to buyer and puppy records across the directory." /></div>} />

        <AdminPanel
          title="Buyer Workbench"
          subtitle="The buyer page should highlight placement and account hygiene, not just totals."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminInfoTile
              label="Active Families"
              value={String(buyers.filter((buyer) => !complete(buyer.buyer.status)).length)}
              detail={`${buyers.length} buyer records total across active and completed placements.`}
            />
            <AdminInfoTile
              label="Financing Households"
              value={String(accounts.filter((account) => Boolean(account.buyer.finance_enabled)).length)}
              detail="Families with payment-plan terms that need due-date and ledger visibility."
            />
            <AdminInfoTile
              label="Portal Setup Gaps"
              value={String(buyers.filter((buyer) => !buyer.hasPortalAccount).length)}
              detail="Buyer records still missing an account connection for the portal experience."
            />
            <AdminInfoTile
              label="Unassigned Puppies"
              value={String(puppies.filter((puppy) => !puppy.buyer_id).length)}
              detail="Available puppy records that are still open for matching or reassignment."
            />
          </div>
        </AdminPanel>

        <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.24fr)_430px]">
          <AdminPanel title="Buyer Directory" subtitle="Search by buyer, linked puppy, location, or notes.">
            <div className="mb-4 flex flex-wrap gap-2">
              <Toggle active={viewMode === "active"} label="Active" onClick={() => setViewMode("active")} />
              <Toggle active={viewMode === "completed"} label="Completed" onClick={() => setViewMode("completed")} />
            </div>
            <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search buyers, puppies, notes, or location..." className="w-full rounded-[16px] border border-[var(--portal-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--portal-text)] outline-none transition focus:border-[var(--portal-accent)] focus:ring-2 focus:ring-[rgba(90,142,245,0.14)]" />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full rounded-[16px] border border-[var(--portal-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--portal-text)] outline-none transition focus:border-[var(--portal-accent)] focus:ring-2 focus:ring-[rgba(90,142,245,0.14)]"><option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="completed">Completed</option><option value="denied">Denied</option><option value="withdrawn">Withdrawn</option></select>
            </div>

            {filteredBuyers.length ? (
              <div className="overflow-hidden rounded-[24px] border border-[var(--portal-border)]">
                <table className="min-w-full divide-y divide-[#eee1d2] text-sm">
                  <thead className="bg-[var(--portal-surface-muted)] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]"><tr><th className="px-4 py-3">Buyer</th><th className="px-4 py-3">Linked Puppies</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Portal</th><th className="px-4 py-3">Balance</th></tr></thead>
                  <tbody className="divide-y divide-[#f1e6da] bg-white">
                    {filteredBuyers.map((record) => {
                      const active = !createMode && record.key === selectedKey;
                      const summary = summaryForBuyer(record, accountsByBuyerId.get(record.buyer.id) || null);
                      return (
                        <tr key={record.key} onClick={() => { setCreateMode(false); setSelectedKey(record.key); setStatusText(""); }} className={`cursor-pointer transition hover:bg-[var(--portal-surface-muted)] ${active ? "bg-[var(--portal-surface-muted)]" : ""}`}>
                          <td className="px-4 py-3"><div className="font-semibold text-[var(--portal-text)]">{record.displayName}</div><div className="mt-1 text-xs text-[var(--portal-text-soft)]">{record.email || "No email"} • {record.phone || "No phone"}</div></td>
                          <td className="px-4 py-3 text-[var(--portal-text-soft)]">{record.linkedPuppies.length ? record.linkedPuppies.slice(0, 2).map((puppy) => puppyLabel(puppy)).join(", ") : "No puppy linked"}{record.linkedPuppies.length > 2 ? ` +${record.linkedPuppies.length - 2}` : ""}</td>
                          <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(record.buyer.status || "pending")}`}>{record.buyer.status || "pending"}</span></td>
                          <td className="px-4 py-3 text-[var(--portal-text-soft)]">{record.hasPortalAccount ? "Connected" : "No login"}</td>
                          <td className="px-4 py-3"><div className="font-semibold text-[var(--portal-text)]">{fmtMoney(summary.balance)}</div><div className="mt-1 text-xs text-[var(--portal-text-soft)]">{summary.activityCount} activity entries</div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <AdminEmptyState title="No buyers match the current filters" description="Adjust the filters or create a new buyer record to restart the workflow." />}
          </AdminPanel>

          <div className="space-y-5">
            <AdminPanel title={createMode ? "Create Buyer" : "Buyer Detail"} subtitle={createMode ? "Create a buyer record and attach puppies right away." : "Profile, assignment, financial context, and recent activity stay grouped together here."}>
              {statusText ? <div className="mb-4 rounded-[18px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--portal-text-soft)]">{statusText}</div> : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <AdminInfoTile label="Portal Account" value={selectedBuyer?.hasPortalAccount ? "Connected" : createMode ? "New record" : "Not connected"} detail={selectedBuyer?.portalUser?.email || "Buyer login status and last sign-in stay visible here."} />
                <AdminInfoTile label="Applications" value={String(selectedBuyer?.applicationCount || 0)} detail={`${selectedBuyer?.formCount || 0} submitted forms`} />
                <AdminInfoTile label="Balance" value={fmtMoney(selectedSummary?.balance || 0)} detail="Live balance view from pricing, payments, and adjustments." />
                <AdminInfoTile label="Last Payment" value={selectedSummary?.lastPaymentAt ? fmtDate(selectedSummary.lastPaymentAt) : "No payment yet"} detail={selectedSummary?.nextDueDate ? `Next due ${fmtDate(selectedSummary.nextDueDate)}` : "No next due date saved"} />
              </div>

              <div className="mt-5 grid gap-4">
                <AdminTextInput label="Full Name" value={form.full_name} onChange={(value) => setForm((current) => ({ ...current, full_name: value }))} placeholder="Buyer name" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <AdminTextInput label="Email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} placeholder="buyer@email.com" />
                  <AdminTextInput label="Phone" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} placeholder="Phone number" />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <AdminSelectInput label="Status" value={form.status} onChange={(value) => setForm((current) => ({ ...current, status: value }))} options={[{ value: "pending", label: "Pending" }, { value: "approved", label: "Approved" }, { value: "completed", label: "Completed" }, { value: "denied", label: "Denied" }, { value: "withdrawn", label: "Withdrawn" }]} />
                  <AdminTextInput label="City" value={form.city} onChange={(value) => setForm((current) => ({ ...current, city: value }))} placeholder="City" />
                  <AdminTextInput label="State" value={form.state} onChange={(value) => setForm((current) => ({ ...current, state: value }))} placeholder="State" />
                </div>
                <AdminTextAreaInput label="Notes" value={form.notes} onChange={(value) => setForm((current) => ({ ...current, notes: value }))} rows={5} placeholder="Internal notes, follow-up details, or buyer context." />
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={() => void saveBuyer()} disabled={saving} className="rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(159,99,49,0.22)] transition hover:brightness-105 disabled:opacity-60">{saving ? "Saving..." : createMode ? "Create Buyer" : "Save Buyer"}</button>
                <button type="button" onClick={() => { setCreateMode(false); setStatusText(""); if (!selectedBuyer) return; setSelectedPuppyIds(selectedBuyer.linkedPuppies.map((puppy) => puppy.id)); }} className="rounded-2xl border border-[var(--portal-border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]">Reset</button>
              </div>
            </AdminPanel>

            <AdminPanel title="Linked Puppies" subtitle="Use buyer assignment here to keep the shared puppy relationship in sync.">
              <div className="mb-4"><input value={puppySearch} onChange={(event) => setPuppySearch(event.target.value)} placeholder="Search puppies by name, litter, or lineage..." className="w-full rounded-[16px] border border-[var(--portal-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--portal-text)] outline-none transition focus:border-[var(--portal-accent)] focus:ring-2 focus:ring-[rgba(90,142,245,0.14)]" /></div>
              <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
                {puppies.filter((puppy) => [puppyLabel(puppy), puppy.status, puppy.litter_name, puppy.sire, puppy.dam, puppy.buyerName].map((value) => String(value || "").toLowerCase()).join(" ").includes(puppySearch.trim().toLowerCase())).map((puppy) => {
                  const checked = selectedPuppyIds.includes(puppy.id);
                  const linkedElsewhere = puppy.buyer_id && (!selectedBuyer || puppy.buyer_id !== selectedBuyer.buyer.id);
                  return <label key={puppy.id} className={`flex cursor-pointer items-start gap-3 rounded-[20px] border px-4 py-3 transition ${checked ? "border-[#cfab84] bg-[var(--portal-surface-muted)]" : "border-[var(--portal-border)] bg-[var(--portal-surface-muted)] hover:border-[#d8b48b]"}`}><input type="checkbox" checked={checked} onChange={() => setSelectedPuppyIds((current) => current.includes(puppy.id) ? current.filter((value) => value !== puppy.id) : [...current, puppy.id])} className="mt-1 h-4 w-4 rounded border-[#d3b596] text-[#a56733] focus:ring-[#cba379]" /><div className="min-w-0"><div className="text-sm font-semibold text-[var(--portal-text)]">{puppyLabel(puppy)}</div><div className="mt-1 text-xs text-[var(--portal-text-soft)]">{puppy.status || "No status"} • {puppy.litter_name || "No litter"} • {fmtMoney(num(puppy.price || puppy.list_price))}</div><div className="mt-1 text-[11px] text-[var(--portal-text-muted)]">{linkedElsewhere ? `Currently linked to ${puppy.buyerName || `Buyer #${puppy.buyer_id}`}` : "Available to assign"}</div></div></label>;
                })}
              </div>
            </AdminPanel>

            <AdminPanel title="Financial Snapshot" subtitle="Buyer pricing, plan context, and recent financial activity stay grouped together.">
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoLine label="Purchase Price" value={fmtMoney(selectedSummary?.purchasePrice || 0)} />
                <InfoLine label="Deposit" value={fmtMoney(selectedSummary?.deposit || 0)} />
                <InfoLine label="Payments Applied" value={fmtMoney(selectedSummary?.totalPaid || 0)} />
                <InfoLine label="Balance" value={fmtMoney(selectedSummary?.balance || 0)} />
                <InfoLine label="Monthly Payment" value={selectedSummary?.monthlyAmount ? fmtMoney(selectedSummary.monthlyAmount) : "Not set"} />
                <InfoLine label="Next Due" value={selectedSummary?.nextDueDate ? fmtDate(selectedSummary.nextDueDate) : "Not set"} />
              </div>
              <div className="mt-5 space-y-3">
                {selectedActivity.length ? selectedActivity.map((activity) => <div key={activity.key} className="rounded-[20px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold text-[var(--portal-text)]">{activity.title}</div><div className="mt-1 text-xs text-[var(--portal-text-soft)]">{fmtDate(activity.date)}</div></div><div className="text-right"><div className="text-sm font-semibold text-[var(--portal-text)]">{fmtMoney(activity.amount)}</div><span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(activity.status)}`}>{activity.status}</span></div></div>{activity.detail ? <div className="mt-3 text-sm leading-6 text-[var(--portal-text-soft)]">{activity.detail}</div> : null}</div>) : <AdminEmptyState title="No financial activity yet" description="Payments, fees, credits, and transport adjustments will appear here once they are logged." />}
              </div>
              <div className="mt-4 flex flex-wrap gap-3"><Link href="/admin/portal/payments" className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]">Open Payments</Link><Link href="/admin/portal/messages" className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]">Open Messages</Link></div>
            </AdminPanel>
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}

function Toggle({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${active ? "border-[#cfab84] bg-[var(--portal-surface-muted)] text-[var(--portal-text)]" : "border-[var(--portal-border)] bg-white text-[var(--portal-text-soft)] hover:border-[#d8b48b]"}`}>{label}</button>;
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[18px] border border-[var(--portal-border)] bg-white px-3 py-3"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">{label}</div><div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">{value}</div></div>;
}

