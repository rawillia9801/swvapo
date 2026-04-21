"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  MessageSquareText,
  PawPrint,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import {
  AdminEmptyState,
  AdminHeroPrimaryAction,
  AdminHeroSecondaryAction,
  AdminPageHero,
  AdminPageShell,
  AdminPanel,
  AdminRestrictedState,
  adminStatusBadge,
} from "@/components/admin/luxury-admin-shell";
import { usePortalAdminSession } from "@/lib/use-portal-admin-session";
import { fmtDate } from "@/lib/utils";

type DashboardAttention = {
  id: string;
  title: string;
  count: number;
  detail: string;
  href: string;
  tone: string;
};

type DashboardRecentItem = {
  id: string;
  label: string;
  title: string;
  detail: string;
  href: string;
  occurredAt: string | null;
};

type DashboardLitter = {
  id: string;
  name: string;
  status: string;
  date: string | null;
  puppyCount: number;
  detail: string;
  href: string;
};

type DashboardCareItem = {
  id: string;
  title: string;
  detail: string;
  occurredAt: string | null;
  href: string;
};

type DashboardSummary = {
  fetchedAt: string;
  counts: {
    currentPuppies: number;
    availablePuppies: number;
    reservedPuppies: number;
    pastPuppies: number;
    activeLitters: number;
    activeBuyers: number;
    unreadBuyerMessages: number;
    websiteChatsToday: number;
    websiteFollowups: number;
    financeAccounts: number;
    overdueFinance: number;
    documentsNeedingAction: number;
    puppiesNeedingAttention: number;
  };
  attention: DashboardAttention[];
  readiness: {
    missingWeights: number;
    missingVaccines: number;
    missingDeworming: number;
    missingPhotos: number;
    missingCopy: number;
    noBuyer: number;
    unsignedForms: number;
    unfiledDocuments: number;
  };
  recentItems: DashboardRecentItem[];
  activeLitters: DashboardLitter[];
  latestCare: DashboardCareItem[];
  warnings: string[];
};

type DashboardResponse = {
  ok?: boolean;
  error?: string;
  summary?: DashboardSummary;
};

const EMPTY_COUNTS: DashboardSummary["counts"] = {
  currentPuppies: 0,
  availablePuppies: 0,
  reservedPuppies: 0,
  pastPuppies: 0,
  activeLitters: 0,
  activeBuyers: 0,
  unreadBuyerMessages: 0,
  websiteChatsToday: 0,
  websiteFollowups: 0,
  financeAccounts: 0,
  overdueFinance: 0,
  documentsNeedingAction: 0,
  puppiesNeedingAttention: 0,
};

const EMPTY_READINESS: DashboardSummary["readiness"] = {
  missingWeights: 0,
  missingVaccines: 0,
  missingDeworming: 0,
  missingPhotos: 0,
  missingCopy: 0,
  noBuyer: 0,
  unsignedForms: 0,
  unfiledDocuments: 0,
};

function card(extra = "") {
  return `rounded-[1.35rem] border border-[var(--portal-border)] bg-white/94 shadow-[0_14px_30px_rgba(106,76,45,0.08)] ${extra}`.trim();
}

function countLabel(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function displayDate(value: string | null | undefined) {
  return value ? fmtDate(value) : "No date";
}

async function fetchDashboardSummary(accessToken: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch("/api/admin/portal/dashboard", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = (await response.json()) as DashboardResponse;

    if (!response.ok || !payload.ok || !payload.summary) {
      throw new Error(payload.error || "Could not load the dashboard summary.");
    }

    return payload.summary;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function AdminDashboardWorkspace() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState("");
  const initialLoadKeyRef = useRef("");

  const loadDashboard = useCallback(async (background = false) => {
    if (!accessToken) return;
    if (background && summary) setRefreshing(true);
    else setLoadingData(true);

    try {
      const nextSummary = await fetchDashboardSummary(accessToken);
      setSummary(nextSummary);
      setErrorText("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not load the dashboard summary.";
      if (!summary) setErrorText(message);
      else setErrorText(`Refresh issue: ${message}`);
    } finally {
      setLoadingData(false);
      setRefreshing(false);
    }
  }, [accessToken, summary]);

  useEffect(() => {
    if (!loading && accessToken && isAdmin) {
      if (initialLoadKeyRef.current === accessToken) return;
      initialLoadKeyRef.current = accessToken;
      void loadDashboard(false);
    } else if (!loading) {
      initialLoadKeyRef.current = "";
      setLoadingData(false);
    }
  }, [accessToken, isAdmin, loading, loadDashboard]);

  if (!loading && !user) {
    return (
      <AdminRestrictedState
        title="Sign in to access the breeding-program dashboard."
        details="This dashboard is reserved for the Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!loading && user && !isAdmin) {
    return (
      <AdminRestrictedState
        title="This dashboard is limited to approved owner accounts."
        details="Only approved owner accounts can access the breeding-program command center."
      />
    );
  }

  const counts = summary?.counts || EMPTY_COUNTS;
  const readiness = summary?.readiness || EMPTY_READINESS;
  const warnings = summary?.warnings || [];

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-12">
        <AdminPageHero
          eyebrow="Dashboard"
          title="Breeding-program command center"
          description="A fast visibility screen for what needs attention now. Deep editing stays in Puppies, Buyers, Documents, Payments, and ChiChi."
          actions={
            <>
              <AdminHeroPrimaryAction href="/admin/portal/puppies/current">
                Open Current Puppies
              </AdminHeroPrimaryAction>
              <AdminHeroSecondaryAction href="/admin/portal/website-chats">
                Read Website Chats
              </AdminHeroSecondaryAction>
              <button
                type="button"
                onClick={() => void loadDashboard(true)}
                disabled={refreshing || loadingData}
                className="inline-flex items-center justify-center gap-2 rounded-[1rem] border border-[var(--portal-border)] bg-white/92 px-4 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[var(--portal-shadow-sm)] transition hover:bg-[var(--portal-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                {refreshing ? "Refreshing" : "Refresh"}
              </button>
            </>
          }
          aside={
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Signal
                label="Current puppies"
                value={String(counts?.currentPuppies ?? "-")}
                href="/admin/portal/puppies/current"
              />
              <Signal
                label="Needs attention"
                value={String(counts?.puppiesNeedingAttention ?? "-")}
                href="/admin/portal/puppies/current"
              />
              <Signal
                label="Buyer messages"
                value={String(counts?.unreadBuyerMessages ?? "-")}
                href="/admin/portal/messages"
              />
              <Signal
                label="Website chats today"
                value={String(counts?.websiteChatsToday ?? "-")}
                href="/admin/portal/website-chats"
              />
            </div>
          }
        />

        {errorText ? (
          <div className="rounded-[1.35rem] border border-amber-200 bg-amber-50/90 px-5 py-4 text-sm leading-6 text-amber-900">
            {errorText}
          </div>
        ) : null}

        {warnings.length ? (
          <div className="rounded-[1.35rem] border border-amber-200 bg-amber-50/90 px-5 py-4 text-sm leading-6 text-amber-900">
            Some dashboard data was skipped so the page could stay fast: {warnings.join(" ")}
          </div>
        ) : null}

        {!summary && (loading || loadingData) ? (
          <DashboardSkeleton />
        ) : !summary ? (
          <AdminEmptyState
            title="Dashboard summary did not load."
            description="The dashboard uses a lightweight summary endpoint now. Try refresh once; deep workspaces are still available from the sidebar."
          />
        ) : (
          <>
            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_390px]">
              <AdminPanel
                title="Today's Priorities"
                subtitle="Only items with real counts appear here. Open the workspace to do the work."
              >
                {summary.attention.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {summary.attention.slice(0, 6).map((item) => (
                      <PriorityCard key={item.id} item={item} />
                    ))}
                  </div>
                ) : (
                  <AdminEmptyState
                    title="No urgent blockers in the fast dashboard view"
                    description="Weights, vaccine/deworming gaps, listing blockers, document gaps, overdue finance accounts, and public chat follow-ups are clear in this summary."
                  />
                )}
              </AdminPanel>

              <AdminPanel
                title="Communication Watch"
                subtitle="The dashboard should make message work obvious, not hide it behind counts."
              >
                <div className="grid gap-3">
                  <FocusLink
                    href="/admin/portal/messages"
                    icon={<MessageSquareText className="h-4 w-4" />}
                    label="Unread buyer portal messages"
                    value={counts.unreadBuyerMessages}
                    detail="Portal Messages is buyer-to-owner messaging only."
                    tone={counts.unreadBuyerMessages ? "warning" : "completed"}
                  />
                  <FocusLink
                    href="/admin/portal/website-chats"
                    icon={<Sparkles className="h-4 w-4" />}
                    label="Website chats today"
                    value={counts.websiteChatsToday}
                    detail={`${countLabel(counts.websiteFollowups, "chat")} flagged for follow-up.`}
                    tone={counts.websiteFollowups ? "warning" : "completed"}
                  />
                  <FocusLink
                    href="/admin/portal/resend-templates"
                    icon={<FileText className="h-4 w-4" />}
                    label="Resend template library"
                    value={counts.overdueFinance}
                    detail="Edit automatic payment, due-date, credit, and default emails."
                    tone={counts.overdueFinance ? "danger" : "neutral"}
                  />
                </div>
              </AdminPanel>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <MetricCard
                label="Available"
                value={counts.availablePuppies}
                detail="Current puppies not reserved or buyer-linked."
                href="/admin/portal/puppies/current"
              />
              <MetricCard
                label="Reserved"
                value={counts.reservedPuppies}
                detail="Reserved, held, matched, or buyer-linked."
                href="/admin/portal/puppies/current"
              />
              <MetricCard
                label="Past"
                value={counts.pastPuppies}
                detail="Historical puppy records."
                href="/admin/portal/puppies/past"
              />
              <MetricCard
                label="Litters"
                value={counts.activeLitters}
                detail="Active or open litter records."
                href="/admin/portal/litters"
              />
              <MetricCard
                label="Buyers"
                value={counts.activeBuyers}
                detail="Active buyer records."
                href="/admin/portal/buyers"
              />
              <MetricCard
                label="Finance"
                value={counts.financeAccounts}
                detail={`${countLabel(counts.overdueFinance, "overdue account")}.`}
                href="/admin/portal/puppy-financing"
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <AdminPanel
                title="Readiness Snapshot"
                subtitle="A small set of signals that determine whether puppies, documents, and placement work can move."
              >
                <div className="grid gap-3">
                  <ReadinessRow
                    href="/admin/portal/puppies/current"
                    label="Care data"
                    value={
                      readiness.missingWeights +
                      readiness.missingVaccines +
                      readiness.missingDeworming
                    }
                    detail={`${readiness.missingWeights} weights, ${readiness.missingVaccines} vaccines, ${readiness.missingDeworming} deworming records need review.`}
                  />
                  <ReadinessRow
                    href="/admin/portal/puppies/current"
                    label="Website listing readiness"
                    value={readiness.missingPhotos + readiness.missingCopy}
                    detail={`${readiness.missingPhotos} photo gaps and ${readiness.missingCopy} copy gaps.`}
                  />
                  <ReadinessRow
                    href="/admin/portal/puppies/current"
                    label="Buyer linkage"
                    value={readiness.noBuyer}
                    detail="Current puppies without a buyer link."
                  />
                  <ReadinessRow
                    href="/admin/portal/documents"
                    label="Document workflow"
                    value={readiness.unsignedForms + readiness.unfiledDocuments}
                    detail={`${readiness.unsignedForms} unsigned forms and ${readiness.unfiledDocuments} signed documents needing filing.`}
                  />
                </div>
              </AdminPanel>

              <AdminPanel
                title="Active Litters"
                subtitle="Just enough litter context to know whether to open the litter workspace."
              >
                {summary.activeLitters.length ? (
                  <div className="grid gap-3">
                    {summary.activeLitters.map((litter) => (
                      <Link
                        key={litter.id}
                        href={litter.href}
                        className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-4 transition hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-[var(--portal-text)]">
                              {litter.name}
                            </div>
                            <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                              {[displayDate(litter.date), countLabel(litter.puppyCount, "puppy", "puppies")]
                                .filter(Boolean)
                                .join(" / ")}
                            </div>
                          </div>
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${adminStatusBadge(
                              litter.status
                            )}`}
                          >
                            {litter.status}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <AdminEmptyState
                    title="No active litters in the fast dashboard view"
                    description="Open Litters for full historical and lifecycle records."
                  />
                )}
              </AdminPanel>
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <AdminPanel
                title="Recent Movement"
                subtitle="The latest buyer messages, website chats, documents, and payment records."
              >
                {summary.recentItems.length ? (
                  <div className="space-y-3">
                    {summary.recentItems.map((item) => (
                      <RecentRow key={item.id} item={item} />
                    ))}
                  </div>
                ) : (
                  <AdminEmptyState
                    title="No recent activity in this summary"
                    description="Recent portal activity will appear here when records are present."
                  />
                )}
              </AdminPanel>

              <AdminPanel
                title="Quick Open"
                subtitle="The dashboard is visibility only. These are the work surfaces."
              >
                <div className="grid gap-3">
                  <QuickLink href="/admin/portal/puppies/current" label="Current Puppies" />
                  <QuickLink href="/admin/portal/documents" label="Documents" />
                  <QuickLink href="/admin/portal/messages" label="Portal Messages" />
                  <QuickLink href="/admin/portal/website-chats" label="Website Chats" />
                  <QuickLink href="/admin/portal/puppy-financing" label="Puppy Financing" />
                  <QuickLink href="/admin/portal/assistant" label="ChiChi Admin" />
                </div>
              </AdminPanel>
            </section>
          </>
        )}
      </div>
    </AdminPageShell>
  );
}

function Signal({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-[1rem] border border-[var(--portal-border)] bg-white/88 px-4 py-3 transition hover:border-[var(--portal-border-strong)] hover:bg-white"
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">{value}</div>
    </Link>
  );
}

function MetricCard({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: number;
  detail: string;
  href: string;
}) {
  return (
    <Link href={href} className={card("block px-5 py-5 transition hover:border-[var(--portal-border-strong)]")}>
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-[1.55rem] font-semibold tracking-[-0.04em] text-[var(--portal-text)]">
        {value}
      </div>
      <div className="mt-2 text-xs leading-5 text-[var(--portal-text-soft)]">{detail}</div>
    </Link>
  );
}

function PriorityCard({ item }: { item: DashboardAttention }) {
  return (
    <Link
      href={item.href}
      className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-4 transition hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--portal-text)]">
            {item.tone === "danger" ? (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            ) : (
              <Clock3 className="h-4 w-4 text-[#a56733]" />
            )}
            {item.title}
          </div>
          <div className="mt-2 text-xs leading-5 text-[var(--portal-text-soft)]">{item.detail}</div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${adminStatusBadge(
            item.tone
          )}`}
        >
          {item.count}
        </span>
      </div>
    </Link>
  );
}

function FocusLink({
  href,
  icon,
  label,
  value,
  detail,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: number;
  detail: string;
  tone: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-4 transition hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--portal-text)]">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--portal-surface-muted)] text-[#8c6848]">
              {icon}
            </span>
            {label}
          </div>
          <div className="mt-2 text-xs leading-5 text-[var(--portal-text-soft)]">{detail}</div>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${adminStatusBadge(
            tone
          )}`}
        >
          {value}
        </span>
      </div>
    </Link>
  );
}

function ReadinessRow({
  href,
  label,
  value,
  detail,
}: {
  href: string;
  label: string;
  value: number;
  detail: string;
}) {
  const clear = value === 0;
  return (
    <Link
      href={href}
      className="flex items-start justify-between gap-4 rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-4 transition hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)]"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--portal-text)]">
          {clear ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          )}
          {label}
        </div>
        <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">{detail}</div>
      </div>
      <span
        className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${adminStatusBadge(
          clear ? "completed" : "warning"
        )}`}
      >
        {value}
      </span>
    </Link>
  );
}

function RecentRow({ item }: { item: DashboardRecentItem }) {
  return (
    <Link
      href={item.href}
      className="flex items-start gap-3 rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3 transition hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)]"
    >
      <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--portal-surface-muted)] text-[#8c6848]">
        {item.label.toLowerCase().includes("message") ? (
          <MessageSquareText className="h-4 w-4" />
        ) : item.label.toLowerCase().includes("payment") ? (
          <PawPrint className="h-4 w-4" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
          {item.label} / {displayDate(item.occurredAt)}
        </div>
        <div className="mt-1 text-sm font-semibold text-[var(--portal-text)]">{item.title}</div>
        <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">{item.detail}</div>
      </div>
    </Link>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)]"
    >
      {label}
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_390px]">
        <div className={card("min-h-[310px] animate-pulse bg-[var(--portal-surface-muted)]/70")} />
        <div className={card("min-h-[310px] animate-pulse bg-[var(--portal-surface-muted)]/70")} />
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={`metric-skeleton-${index}`}
            className={card("min-h-[124px] animate-pulse bg-[var(--portal-surface-muted)]/70")}
          />
        ))}
      </section>
    </>
  );
}
