"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileCheck2,
  FileText,
  HeartPulse,
  Layers3,
  Loader2,
  MessageSquareText,
  PawPrint,
  RefreshCcw,
  Sparkles,
  Users,
} from "lucide-react";
import {
  AdminEmptyState,
  AdminHeroPrimaryAction,
  AdminHeroSecondaryAction,
  AdminPageHero,
  AdminPageShell,
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

type WorkQueueItem = {
  id: string;
  category: string;
  count: number;
  description: string;
  href: string;
  actionLabel: string;
  tone: "neutral" | "success" | "warning" | "danger";
  icon: React.ReactNode;
};

type CommandItem = {
  label: string;
  value: number;
  detail: string;
  href: string;
  actionLabel: string;
  tone: "neutral" | "success" | "warning" | "danger";
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

const secondaryInlineButton =
  "inline-flex items-center justify-center gap-2 rounded-[1rem] border border-[var(--portal-border)] bg-white/92 px-4 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[var(--portal-shadow-sm)] transition hover:bg-[var(--portal-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60";

function surface(extra = "") {
  return `rounded-[1.45rem] border border-[rgba(187,160,132,0.28)] bg-[rgba(255,252,248,0.9)] shadow-[0_18px_44px_rgba(110,79,47,0.08)] backdrop-blur-sm ${extra}`.trim();
}

function countLabel(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function displayDate(value: string | null | undefined) {
  return value ? fmtDate(value) : "No date";
}

function toneStatus(tone: string) {
  if (tone === "danger") return "failed";
  if (tone === "warning") return "warning";
  if (tone === "success") return "completed";
  return "neutral";
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

function buildWorkQueue(summary: DashboardSummary): WorkQueueItem[] {
  const careDue =
    summary.readiness.missingWeights +
    summary.readiness.missingVaccines +
    summary.readiness.missingDeworming;
  const listingBlocked = summary.readiness.missingPhotos + summary.readiness.missingCopy;
  const documentBlocked = summary.readiness.unsignedForms + summary.readiness.unfiledDocuments;

  const items: WorkQueueItem[] = [
    {
      id: "care-due",
      category: "Care Due",
      count: careDue,
      description: `${summary.readiness.missingWeights} weights, ${summary.readiness.missingVaccines} vaccines, and ${summary.readiness.missingDeworming} deworming records need review.`,
      href: "/admin/portal/puppies",
      actionLabel: "Review puppy care",
      tone: careDue ? "warning" : "success",
      icon: <HeartPulse className="h-4 w-4" />,
    },
    {
      id: "documents",
      category: "Documents",
      count: documentBlocked,
      description: `${summary.readiness.unsignedForms} unsigned forms and ${summary.readiness.unfiledDocuments} signed documents need filing.`,
      href: "/admin/portal/documents",
      actionLabel: "Open documents",
      tone: documentBlocked ? "warning" : "success",
      icon: <FileCheck2 className="h-4 w-4" />,
    },
    {
      id: "buyer-messages",
      category: "Buyer Follow-Up",
      count: summary.counts.unreadBuyerMessages,
      description: "Unread buyer portal messages that may need an owner reply.",
      href: "/admin/portal/messages",
      actionLabel: "Read messages",
      tone: summary.counts.unreadBuyerMessages ? "warning" : "success",
      icon: <MessageSquareText className="h-4 w-4" />,
    },
    {
      id: "website-chats",
      category: "Website Chats",
      count: summary.counts.websiteFollowups,
      description: `${summary.counts.websiteChatsToday} public chats today, ${summary.counts.websiteFollowups} flagged for follow-up.`,
      href: "/admin/portal/website-chats",
      actionLabel: "Review chats",
      tone: summary.counts.websiteFollowups ? "warning" : "success",
      icon: <Sparkles className="h-4 w-4" />,
    },
    {
      id: "listing-readiness",
      category: "Listing Readiness",
      count: listingBlocked,
      description: `${summary.readiness.missingPhotos} photo gaps and ${summary.readiness.missingCopy} website-copy gaps block publication.`,
      href: "/admin/portal/puppies",
      actionLabel: "Open Puppies",
      tone: listingBlocked ? "warning" : "success",
      icon: <PawPrint className="h-4 w-4" />,
    },
    {
      id: "buyer-linkage",
      category: "Placement Links",
      count: summary.readiness.noBuyer,
      description: "Current puppies without buyer linkage or intentional placement state.",
      href: "/admin/portal/puppies",
      actionLabel: "Review matches",
      tone: summary.readiness.noBuyer ? "warning" : "success",
      icon: <Users className="h-4 w-4" />,
    },
    {
      id: "finance",
      category: "Financial Follow-Up",
      count: summary.counts.overdueFinance,
      description: `${summary.counts.financeAccounts} active financed accounts, ${summary.counts.overdueFinance} overdue.`,
      href: "/admin/portal/puppy-financing",
      actionLabel: "Open financing",
      tone: summary.counts.overdueFinance ? "danger" : "success",
      icon: <CreditCard className="h-4 w-4" />,
    },
  ];

  return items.filter((item) => item.count > 0);
}

function buildCommandItems(summary: DashboardSummary): CommandItem[] {
  const careDue =
    summary.readiness.missingWeights +
    summary.readiness.missingVaccines +
    summary.readiness.missingDeworming;
  const urgentBlockers =
    summary.counts.overdueFinance +
    summary.counts.documentsNeedingAction +
    summary.counts.puppiesNeedingAttention +
    summary.counts.websiteFollowups;

  return [
    {
      label: "Active puppies",
      value: summary.counts.currentPuppies,
      detail: `${summary.counts.availablePuppies} available, ${summary.counts.reservedPuppies} reserved`,
      href: "/admin/portal/puppies/current",
      actionLabel: "Open roster",
      tone: "neutral",
    },
    {
      label: "Care due",
      value: careDue,
      detail: "Weights, vaccines, and deworming records",
      href: "/admin/portal/puppies",
      actionLabel: "Log care",
      tone: careDue ? "warning" : "success",
    },
    {
      label: "Documents",
      value: summary.counts.documentsNeedingAction,
      detail: "Unsigned or signed-not-filed records",
      href: "/admin/portal/documents",
      actionLabel: "Open docs",
      tone: summary.counts.documentsNeedingAction ? "warning" : "success",
    },
    {
      label: "Messages",
      value: summary.counts.unreadBuyerMessages,
      detail: "Unread buyer portal messages",
      href: "/admin/portal/messages",
      actionLabel: "Reply",
      tone: summary.counts.unreadBuyerMessages ? "warning" : "success",
    },
    {
      label: "Website chats",
      value: summary.counts.websiteFollowups,
      detail: `${summary.counts.websiteChatsToday} public chats today`,
      href: "/admin/portal/website-chats",
      actionLabel: "Review",
      tone: summary.counts.websiteFollowups ? "warning" : "success",
    },
    {
      label: "Urgent blockers",
      value: urgentBlockers,
      detail: "Payment, document, puppy, and chat blockers",
      href: urgentBlockers ? "/admin/portal" : "/admin/portal/puppies/current",
      actionLabel: urgentBlockers ? "Work queue" : "Healthy",
      tone: urgentBlockers ? "danger" : "success",
    },
  ];
}

export function AdminDashboardWorkspace() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState("");
  const initialLoadKeyRef = useRef("");
  const summaryRef = useRef<DashboardSummary | null>(null);

  useEffect(() => {
    summaryRef.current = summary;
  }, [summary]);

  const loadDashboard = useCallback(
    async (background = false) => {
      if (!accessToken) return;
      if (background && summaryRef.current) setRefreshing(true);
      else setLoadingData(true);

      try {
        const nextSummary = await fetchDashboardSummary(accessToken);
        setSummary(nextSummary);
        setErrorText("");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not load the dashboard summary.";
        if (!summaryRef.current) setErrorText(message);
        else setErrorText(`Refresh issue: ${message}`);
      } finally {
        setLoadingData(false);
        setRefreshing(false);
      }
    },
    [accessToken]
  );

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

  const commandItems = useMemo(() => (summary ? buildCommandItems(summary) : []), [summary]);
  const workQueue = useMemo(() => (summary ? buildWorkQueue(summary) : []), [summary]);

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
      <div className="space-y-5 pb-10">
        <AdminPageHero
          eyebrow="Dashboard"
          title="Breeding Program Command Center"
          description="Cross-program visibility for the work that needs attention now."
          actions={
            <>
              <AdminHeroPrimaryAction href="/admin/portal/puppies/current">
                Open Current Puppies
              </AdminHeroPrimaryAction>
              <AdminHeroSecondaryAction href="/admin/portal/documents">
                Open Documents
              </AdminHeroSecondaryAction>
              <button
                type="button"
                onClick={() => void loadDashboard(true)}
                disabled={refreshing || loadingData}
                className={secondaryInlineButton}
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                {refreshing ? "Refreshing" : "Refresh"}
              </button>
            </>
          }
        />

        {errorText ? (
          <div className="rounded-[1.15rem] border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm leading-6 text-amber-900">
            {errorText}
          </div>
        ) : null}

        {warnings.length ? (
          <div className="rounded-[1.15rem] border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm leading-6 text-amber-900">
            Partial data loaded. {warnings.join(" ")}
          </div>
        ) : null}

        {!summary && (loading || loadingData) ? (
          <DashboardSkeleton />
        ) : !summary ? (
          <AdminEmptyState
            title="The command center did not load."
            description="The workspaces remain available from the sidebar. Try refresh once to reload the fast operational summary."
          />
        ) : (
          <>
            <section className={surface("overflow-hidden")}>
              <div className="grid divide-y divide-[var(--portal-border)] lg:grid-cols-6 lg:divide-x lg:divide-y-0">
                {commandItems.map((item) => (
                  <CommandStripItem key={item.label} item={item} />
                ))}
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_420px]">
              <section className={surface("overflow-hidden")}>
                <SectionHeader
                  eyebrow="Owner Command Queue"
                  title="Today's Work"
                  subtitle="Only live operational categories needing movement are shown here."
                />
                {workQueue.length ? (
                  <div className="divide-y divide-[var(--portal-border)]">
                    {workQueue.map((item) => (
                      <WorkQueueRow key={item.id} item={item} />
                    ))}
                  </div>
                ) : (
                  <div className="px-5 pb-5">
                    <div className="rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-5 py-5">
                      <div className="flex items-center gap-3 text-sm font-semibold text-emerald-800">
                        <CheckCircle2 className="h-5 w-5" />
                        No urgent movement needed in the fast dashboard view.
                      </div>
                      <p className="mt-2 text-sm leading-6 text-emerald-700">
                        Care, documents, payments, listing readiness, buyer linkage, and chat follow-up are clear enough for now.
                      </p>
                    </div>
                  </div>
                )}
              </section>

              <section className={surface("p-5")}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                      Next Open
                    </div>
                    <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--portal-text)]">
                      Work Surfaces
                    </h2>
                  </div>
                  <Activity className="h-5 w-5 text-[#a56733]" />
                </div>
                <div className="mt-4 grid gap-2">
                  <WorkspaceLink href="/admin/portal/puppies/current" label="Current Puppies" detail="Care, photos, buyer links, and puppy records" />
                  <WorkspaceLink href="/admin/portal/buyers" label="Buyers" detail="Placement files, matching, balances, and portal links" />
                  <WorkspaceLink href="/admin/portal/documents" label="Documents" detail="Zoho / portal submissions, signatures, filing, and packets" />
                  <WorkspaceLink href="/admin/portal/messages" label="Portal Messages" detail="Buyer inbox and replies" />
                  <WorkspaceLink href="/admin/portal/website-chats" label="Website Chats" detail="Public ChiChi conversations and lead follow-up" />
                  <WorkspaceLink href="/admin/portal/puppy-financing" label="Financing" detail="Payment plans, overdue accounts, and notices" />
                  <WorkspaceLink href="/admin/portal/assistant" label="ChiChi Admin" detail="Operational assistant and recommended next actions" />
                </div>
              </section>
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <section className={surface("overflow-hidden")}>
                <SectionHeader
                  eyebrow="Compact Program Status"
                  title="System Health"
                  subtitle="Grouped line items instead of a wall of metric cards."
                />
                <div className="grid gap-0 divide-y divide-[var(--portal-border)] md:grid-cols-2 md:divide-x md:divide-y-0">
                  <StatusGroup
                    title="Puppy Program"
                    icon={<PawPrint className="h-4 w-4" />}
                    lines={[
                      { label: "Current puppies", value: counts.currentPuppies, href: "/admin/portal/puppies/current" },
                      { label: "Available", value: counts.availablePuppies, href: "/admin/portal/puppies/current" },
                      { label: "Reserved / linked", value: counts.reservedPuppies, href: "/admin/portal/puppies/current" },
                      { label: "Past puppies", value: counts.pastPuppies, href: "/admin/portal/puppies/past" },
                    ]}
                  />
                  <StatusGroup
                    title="Buyer & Placement"
                    icon={<Users className="h-4 w-4" />}
                    lines={[
                      { label: "Active buyers", value: counts.activeBuyers, href: "/admin/portal/buyers" },
                      { label: "No buyer link", value: readiness.noBuyer, href: "/admin/portal/puppies/current" },
                      { label: "Unsigned forms", value: readiness.unsignedForms, href: "/admin/portal/documents" },
                      { label: "Unfiled signed docs", value: readiness.unfiledDocuments, href: "/admin/portal/documents" },
                    ]}
                  />
                </div>
                <div className="grid gap-0 divide-y divide-[var(--portal-border)] border-t border-[var(--portal-border)] md:grid-cols-2 md:divide-x md:divide-y-0">
                  <StatusGroup
                    title="Readiness"
                    icon={<FileText className="h-4 w-4" />}
                    lines={[
                      { label: "Missing weights", value: readiness.missingWeights, href: "/admin/portal/puppies" },
                      { label: "Missing vaccine records", value: readiness.missingVaccines, href: "/admin/portal/puppies" },
                      { label: "Missing deworming records", value: readiness.missingDeworming, href: "/admin/portal/puppies" },
                      { label: "Listing blockers", value: readiness.missingPhotos + readiness.missingCopy, href: "/admin/portal/puppies" },
                    ]}
                  />
                  <StatusGroup
                    title="Breeding & Finance"
                    icon={<Layers3 className="h-4 w-4" />}
                    lines={[
                      { label: "Active litters", value: counts.activeLitters, href: "/admin/portal/litters" },
                      { label: "Finance accounts", value: counts.financeAccounts, href: "/admin/portal/puppy-financing" },
                      { label: "Overdue accounts", value: counts.overdueFinance, href: "/admin/portal/puppy-financing" },
                      { label: "Website follow-ups", value: counts.websiteFollowups, href: "/admin/portal/website-chats" },
                    ]}
                  />
                </div>
              </section>

              <section className={surface("overflow-hidden")}>
                <SectionHeader
                  eyebrow="Recent Movement"
                  title="Operational Feed"
                  subtitle="A concise trace of messages, documents, payments, and public chat activity."
                />
                {summary.recentItems.length ? (
                  <div className="divide-y divide-[var(--portal-border)]">
                    {summary.recentItems.map((item) => (
                      <RecentMovementRow key={item.id} item={item} />
                    ))}
                  </div>
                ) : (
                  <div className="px-5 pb-5">
                    <AdminEmptyState
                      title="No recent movement in this summary"
                      description="Recent care, documents, messages, chats, and payments will appear here when available."
                    />
                  </div>
                )}
              </section>
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
              <section className={surface("overflow-hidden")}>
                <SectionHeader
                  eyebrow="Litters"
                  title="Active Litter Watch"
                  subtitle="Enough context to know whether the litter workspace needs to be opened."
                />
                {summary.activeLitters.length ? (
                  <div className="divide-y divide-[var(--portal-border)]">
                    {summary.activeLitters.map((litter) => (
                      <Link
                        key={litter.id}
                        href={litter.href}
                        className="grid gap-3 px-5 py-4 transition hover:bg-[var(--portal-surface-muted)] md:grid-cols-[minmax(0,1fr)_130px_110px]"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-[var(--portal-text)]">{litter.name}</div>
                          <div className="mt-1 truncate text-sm text-[var(--portal-text-soft)]">
                            {litter.detail || "Active litter record"}
                          </div>
                        </div>
                        <div className="text-sm text-[var(--portal-text-soft)]">
                          {displayDate(litter.date)}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[var(--portal-text)]">
                            {countLabel(litter.puppyCount, "puppy", "puppies")}
                          </span>
                          <ArrowRight className="h-4 w-4 text-[var(--portal-text-muted)]" />
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="px-5 pb-5">
                    <AdminEmptyState
                      title="No active litters in the dashboard view"
                      description="Open Litters for historical, planned, or closed litter records."
                    />
                  </div>
                )}
              </section>

              <section className={surface("p-5")}>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                  <Clock3 className="h-4 w-4" />
                  Latest Care Entries
                </div>
                <div className="mt-4 space-y-3">
                  {summary.latestCare.length ? (
                    summary.latestCare.map((item) => (
                      <Link
                        key={item.id}
                        href={item.href}
                        className="block rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3 transition hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)]"
                      >
                        <div className="text-sm font-semibold text-[var(--portal-text)]">{item.title}</div>
                        <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                          {item.detail}
                        </div>
                        <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
                          {displayDate(item.occurredAt)}
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-[1rem] border border-dashed border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-5 text-sm text-[var(--portal-text-soft)]">
                      No recent care entries were returned in this summary.
                    </div>
                  )}
                </div>
              </section>
            </section>
          </>
        )}
      </div>
    </AdminPageShell>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="border-b border-[var(--portal-border)] px-5 py-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
        {eyebrow}
      </div>
      <div className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--portal-text)]">
        {title}
      </div>
      {subtitle ? <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">{subtitle}</div> : null}
    </div>
  );
}

function CommandStripItem({ item }: { item: CommandItem }) {
  return (
    <Link href={item.href} className="block px-4 py-4 transition hover:bg-[var(--portal-surface-muted)]">
      <div className="flex items-start justify-between gap-3 lg:block">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
            {item.label}
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--portal-text)]">
            {item.value}
          </div>
          <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">{item.detail}</div>
        </div>
        <span
          className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${adminStatusBadge(
            toneStatus(item.tone)
          )}`}
        >
          {item.actionLabel}
        </span>
      </div>
    </Link>
  );
}

function WorkQueueRow({ item }: { item: WorkQueueItem }) {
  return (
    <Link
      href={item.href}
      className="grid gap-4 px-5 py-4 transition hover:bg-[var(--portal-surface-muted)] md:grid-cols-[42px_minmax(0,1fr)_86px_150px]"
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--portal-surface-muted)] text-[#9a6437]">
        {item.icon}
      </span>
      <div className="min-w-0">
        <div className="text-base font-semibold text-[var(--portal-text)]">{item.category}</div>
        <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">{item.description}</div>
      </div>
      <div className="flex md:justify-center">
        <span
          className={`h-fit rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${adminStatusBadge(
            toneStatus(item.tone)
          )}`}
        >
          {item.count}
        </span>
      </div>
      <div className="flex items-center text-sm font-semibold text-[#9a6437]">
        {item.actionLabel}
        <ArrowRight className="ml-2 h-4 w-4" />
      </div>
    </Link>
  );
}

function StatusGroup({
  title,
  icon,
  lines,
}: {
  title: string;
  icon: React.ReactNode;
  lines: Array<{ label: string; value: number; href: string }>;
}) {
  return (
    <div className="p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--portal-text)]">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--portal-surface-muted)] text-[#9a6437]">
          {icon}
        </span>
        {title}
      </div>
      <div className="space-y-2">
        {lines.map((line) => (
          <Link
            key={`${title}-${line.label}`}
            href={line.href}
            className="flex items-center justify-between gap-3 rounded-[0.95rem] px-3 py-2 transition hover:bg-[var(--portal-surface-muted)]"
          >
            <span className="text-sm text-[var(--portal-text-soft)]">{line.label}</span>
            <span className="text-sm font-semibold text-[var(--portal-text)]">{line.value}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function WorkspaceLink({
  href,
  label,
  detail,
}: {
  href: string;
  label: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3 transition hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-[var(--portal-text)]">{label}</div>
          <div className="mt-1 truncate text-xs text-[var(--portal-text-soft)]">{detail}</div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-[var(--portal-text-muted)] transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

function RecentMovementRow({ item }: { item: DashboardRecentItem }) {
  const label = item.label.toLowerCase();
  const icon = label.includes("message") ? (
    <MessageSquareText className="h-4 w-4" />
  ) : label.includes("chat") ? (
    <Sparkles className="h-4 w-4" />
  ) : label.includes("payment") ? (
    <CreditCard className="h-4 w-4" />
  ) : (
    <FileText className="h-4 w-4" />
  );

  return (
    <Link
      href={item.href}
      className="grid gap-3 px-5 py-4 transition hover:bg-[var(--portal-surface-muted)] md:grid-cols-[42px_minmax(0,1fr)_110px]"
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--portal-surface-muted)] text-[#9a6437]">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
            {item.label}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${adminStatusBadge("open")}`}>
            movement
          </span>
        </div>
        <div className="mt-1 truncate text-sm font-semibold text-[var(--portal-text)]">{item.title}</div>
        <div className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--portal-text-soft)]">{item.detail}</div>
      </div>
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--portal-text-muted)] md:text-right">
        {displayDate(item.occurredAt)}
      </div>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <section className={surface("h-[120px] animate-pulse bg-[var(--portal-surface-muted)]/70")} />
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_420px]">
        <div className={surface("h-[420px] animate-pulse bg-[var(--portal-surface-muted)]/70")} />
        <div className={surface("h-[420px] animate-pulse bg-[var(--portal-surface-muted)]/70")} />
      </section>
    </>
  );
}
