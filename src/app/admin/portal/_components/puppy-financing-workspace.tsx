"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BellRing, Loader2, RefreshCcw, Wallet } from "lucide-react";
import {
  AdminEmptyState,
  AdminPageShell,
  AdminPanel,
  AdminRestrictedState,
  adminStatusBadge,
} from "@/components/admin/luxury-admin-shell";
import { usePortalAdminSession } from "@/lib/use-portal-admin-session";
import { fmtDate, fmtMoney } from "@/lib/utils";

type BuyerRow = {
  id: number;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  finance_enabled?: boolean | null;
  finance_rate?: number | null;
  finance_months?: number | null;
  finance_monthly_amount?: number | null;
  finance_next_due_date?: string | null;
};

type PuppyRow = {
  id: number;
  call_name?: string | null;
  puppy_name?: string | null;
  name?: string | null;
  price?: number | null;
  deposit?: number | null;
};

type BuyerPayment = {
  id: string;
  payment_date: string;
  amount: number;
  payment_type?: string | null;
  status?: string | null;
};

type BuyerAccount = {
  key: string;
  buyer: BuyerRow;
  puppy: PuppyRow | null;
  payments: BuyerPayment[];
  totalPaid: number;
  lastPaymentAt: string | null;
};

function firstValue(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function buyerName(account: BuyerAccount) {
  return firstValue(account.buyer.full_name, account.buyer.name, account.buyer.email, `Buyer #${account.buyer.id}`);
}

function puppyName(account: BuyerAccount) {
  return firstValue(account.puppy?.call_name, account.puppy?.puppy_name, account.puppy?.name, "No puppy linked");
}

function accountSummary(account: BuyerAccount) {
  const price = Number(account.puppy?.price || 0);
  const deposit = Number(account.puppy?.deposit || 0);
  const financedBase = Math.max(0, price - deposit);
  const balance = Math.max(0, financedBase - Number(account.totalPaid || 0));
  const nextDueDate = account.buyer.finance_next_due_date || null;
  const daysLate =
    nextDueDate && balance > 0 ? Math.floor((Date.now() - Date.parse(nextDueDate)) / 86400000) : null;
  const overdue = daysLate != null && daysLate > 0;
  const dueSoon = !overdue && nextDueDate ? (Date.parse(nextDueDate) - Date.now()) / 86400000 <= 7 : false;
  const paidOff = balance <= 0;

  return {
    price,
    deposit,
    financedBase,
    balance,
    overdue,
    dueSoon,
    paidOff,
    nextDueDate,
    daysLate: overdue ? daysLate : 0,
  };
}

export function PuppyFinancingWorkspace() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const [accounts, setAccounts] = useState<BuyerAccount[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [statusText, setStatusText] = useState("");
  const [search, setSearch] = useState("");
  const [workingAction, setWorkingAction] = useState("");
  const hasLoadedAccountsRef = useRef(false);
  const initialLoadKeyRef = useRef("");

  const loadAccounts = useCallback(async (background = false) => {
    if (!accessToken) return;
    if (!background || !hasLoadedAccountsRef.current) setLoadingData(true);
    setStatusText("");

    try {
      const response = await fetch("/api/admin/portal/payments", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; accounts?: BuyerAccount[] };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not load financing accounts.");
      }

      const financedAccounts = (payload.accounts || []).filter((account) => account.buyer.finance_enabled);
      setAccounts(financedAccounts);
      hasLoadedAccountsRef.current = true;
      setSelectedKey((current) =>
        financedAccounts.some((account) => account.key === current) ? current : financedAccounts[0]?.key || ""
      );
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not load financing accounts.");
    } finally {
      setLoadingData(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!loading && accessToken && isAdmin) {
      if (initialLoadKeyRef.current === accessToken) return;
      initialLoadKeyRef.current = accessToken;
      void loadAccounts(false);
    } else if (!loading) {
      initialLoadKeyRef.current = "";
      setLoadingData(false);
    }
  }, [accessToken, isAdmin, loading, loadAccounts]);

  const visibleAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return accounts.filter((account) => {
      if (!query) return true;
      return [buyerName(account), puppyName(account), account.buyer.email]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(query);
    });
  }, [accounts, search]);

  const selectedAccount =
    visibleAccounts.find((account) => account.key === selectedKey) ||
    accounts.find((account) => account.key === selectedKey) ||
    null;

  async function sendReminder(kind: "due_reminder" | "late_notice" | "default_notice") {
    if (!selectedAccount || !accessToken) return;
    setWorkingAction(kind);
    setStatusText("");
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
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not send the financing notice.");
      }
      setStatusText(kind === "default_notice" ? "Default notice sent." : "Financing reminder sent.");
      await loadAccounts(true);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not send the financing notice.");
    } finally {
      setWorkingAction("");
    }
  }

  if (loading || loadingData) {
    return (
      <AdminPageShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="inline-flex items-center gap-3 rounded-full border border-[var(--portal-border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--portal-text-soft)] shadow-[var(--portal-shadow-sm)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading puppy financing...
          </div>
        </div>
      </AdminPageShell>
    );
  }

  if (!user) {
    return <AdminRestrictedState title="Sign in to access puppy financing." details="This workspace is reserved for Southwest Virginia Chihuahua owner accounts." />;
  }

  if (!isAdmin) {
    return <AdminRestrictedState title="This financing workspace is limited to approved owner accounts." details="Only approved owner accounts can manage financed puppy accounts here." />;
  }

  const financedSummaries = accounts.map(accountSummary);
  const overdueCount = financedSummaries.filter((row) => row.overdue).length;
  const dueSoonCount = financedSummaries.filter((row) => row.dueSoon).length;
  const currentCount = financedSummaries.filter((row) => !row.overdue && !row.dueSoon && !row.paidOff).length;
  const paidOffCount = financedSummaries.filter((row) => row.paidOff).length;

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-12">
        <section className="rounded-[1.8rem] border border-[var(--portal-border)] bg-[linear-gradient(135deg,rgba(255,250,243,0.96)_0%,rgba(247,239,227,0.94)_100%)] px-6 py-6 shadow-[0_18px_40px_rgba(106,76,45,0.08)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--portal-text-muted)]">Puppy Financing</div>
              <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-[var(--portal-text)]">Financed puppy accounts only</h1>
              <p className="mt-3 text-sm leading-7 text-[var(--portal-text-soft)]">
                This workspace only shows buyers with payment plans enabled, so you can manage financing without wading through standard paid-in-full records.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => void loadAccounts(true)} className="inline-flex items-center gap-2 rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)]">
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </button>
              <Link href="/admin/portal/payments" className="inline-flex items-center gap-2 rounded-[1rem] bg-[linear-gradient(90deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--portal-shadow-md)]">
                <Wallet className="h-4 w-4" />
                Open Full Payments
              </Link>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-5">
            <SummaryStat label="Active financed accounts" value={String(accounts.length)} />
            <SummaryStat label="Overdue" value={String(overdueCount)} />
            <SummaryStat label="Due soon" value={String(dueSoonCount)} />
            <SummaryStat label="Current" value={String(currentCount)} />
            <SummaryStat label="Paid off" value={String(paidOffCount)} />
          </div>
        </section>

        {statusText ? <div className="rounded-[1.2rem] border border-[var(--portal-border)] bg-white px-5 py-4 text-sm text-[var(--portal-text-soft)]">{statusText}</div> : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_420px]">
          <AdminPanel title="Financing Accounts" subtitle="Only buyer records with Payment Plan enabled are shown here.">
            <div className="mb-4">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search financed buyer or puppy..."
                className="w-full rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3 text-sm text-[var(--portal-text)] outline-none"
              />
            </div>
            <div className="overflow-hidden rounded-[1rem] border border-[var(--portal-border)]">
              <table className="min-w-full border-collapse text-left">
                <thead className="bg-[var(--portal-surface-muted)] text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                  <tr>
                    <th className="px-4 py-3">Buyer</th>
                    <th className="px-4 py-3">Puppy</th>
                    <th className="px-4 py-3">Balance</th>
                    <th className="px-4 py-3">Next Due</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAccounts.length ? visibleAccounts.map((account) => {
                    const summary = accountSummary(account);
                    return (
                      <tr key={account.key} className={`cursor-pointer transition hover:bg-[var(--portal-surface-muted)] ${selectedKey === account.key ? "bg-[rgba(242,230,212,0.34)]" : "bg-white"}`} onClick={() => setSelectedKey(account.key)}>
                        <td className="border-t border-[var(--portal-border)] px-4 py-4 text-sm font-semibold text-[var(--portal-text)]">{buyerName(account)}</td>
                        <td className="border-t border-[var(--portal-border)] px-4 py-4 text-sm text-[var(--portal-text-soft)]">{puppyName(account)}</td>
                        <td className="border-t border-[var(--portal-border)] px-4 py-4 text-sm font-semibold text-[var(--portal-text)]">{fmtMoney(summary.balance)}</td>
                        <td className="border-t border-[var(--portal-border)] px-4 py-4 text-sm text-[var(--portal-text-soft)]">{summary.nextDueDate ? fmtDate(summary.nextDueDate) : "-"}</td>
                        <td className="border-t border-[var(--portal-border)] px-4 py-4"><span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${adminStatusBadge(summary.paidOff ? "paid" : summary.overdue ? "overdue" : summary.dueSoon ? "due" : "active")}`}>{summary.paidOff ? "Paid Off" : summary.overdue ? "Overdue" : summary.dueSoon ? "Due Soon" : "Current"}</span></td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={5} className="px-0 py-8">
                        <AdminEmptyState title="No financed accounts matched your search" description="Only buyers with Payment Plan enabled appear in this workspace." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </AdminPanel>

          <AdminPanel title={selectedAccount ? buyerName(selectedAccount) : "Financing Detail"} subtitle={selectedAccount ? puppyName(selectedAccount) : "Select an account to open the financing detail."}>
            {selectedAccount ? (
              <div className="space-y-4">
                {(() => {
                  const summary = accountSummary(selectedAccount);
                  const noticeKind = summary.overdue ? (summary.daysLate >= 30 ? "default_notice" : "late_notice") : "due_reminder";
                  return (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <MiniStat label="Original price" value={fmtMoney(summary.price)} />
                        <MiniStat label="Deposit" value={fmtMoney(summary.deposit)} />
                        <MiniStat label="Financed base" value={fmtMoney(summary.financedBase)} />
                        <MiniStat label="Balance" value={fmtMoney(summary.balance)} />
                        <MiniStat label="APR" value={`${Number(selectedAccount.buyer.finance_rate || 0)}%`} />
                        <MiniStat label="Term" value={`${Number(selectedAccount.buyer.finance_months || 0)} months`} />
                        <MiniStat label="Monthly amount" value={fmtMoney(selectedAccount.buyer.finance_monthly_amount || 0)} />
                        <MiniStat label="Last payment" value={selectedAccount.lastPaymentAt ? fmtDate(selectedAccount.lastPaymentAt) : "None"} />
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button type="button" disabled={!!workingAction} onClick={() => void sendReminder(noticeKind)} className="inline-flex items-center gap-2 rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] disabled:opacity-60">
                          <BellRing className="h-4 w-4" />
                          {summary.overdue ? "Send Notice" : "Send Reminder"}
                        </button>
                        <Link href="/admin/portal/payments" className="inline-flex items-center gap-2 rounded-[1rem] bg-[linear-gradient(90deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--portal-shadow-md)]">
                          <Wallet className="h-4 w-4" />
                          Open Full Ledger
                        </Link>
                      </div>

                      <div className="rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4">
                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">Recent payments</div>
                        <div className="mt-3 space-y-3">
                          {selectedAccount.payments.length ? selectedAccount.payments.slice(0, 6).map((payment) => (
                            <div key={payment.id} className="rounded-[0.95rem] border border-[var(--portal-border)] bg-white px-4 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-[var(--portal-text)]">{payment.payment_type || "Payment"}</div>
                                  <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">{fmtDate(payment.payment_date)}</div>
                                </div>
                                <div className="text-sm font-semibold text-[var(--portal-text)]">{fmtMoney(payment.amount)}</div>
                              </div>
                            </div>
                          )) : <AdminEmptyState title="No payments recorded yet" description="Payment history will appear here as installments are logged." />}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <AdminEmptyState title="No financing account selected" description="Choose a financed buyer on the left to review the plan detail." />
            )}
          </AdminPanel>
        </div>
      </div>
    </AdminPageShell>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[1.2rem] border border-[var(--portal-border)] bg-white px-4 py-4"><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">{label}</div><div className="mt-2 text-lg font-semibold text-[var(--portal-text)]">{value}</div></div>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3"><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">{label}</div><div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">{value}</div></div>;
}
