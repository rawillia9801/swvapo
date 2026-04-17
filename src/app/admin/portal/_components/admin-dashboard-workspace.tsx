"use client";

import Link from "next/link";
import React, { useEffect, useEffectEvent, useMemo, useState } from "react";
import {
  CalendarClock,
  FileText,
  HeartPulse,
  Loader2,
  MessageSquareText,
  RefreshCcw,
  Sparkles,
  Stethoscope,
  Wallet,
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
import type { AdminOverviewStats } from "@/lib/admin-portal";
import { fetchAdminOverview } from "@/lib/admin-portal";
import type {
  ActivityFeedItem,
  LitterWorkspaceRecord,
  PuppiesSystemSnapshot,
  PuppyWorkspaceRecord,
} from "@/lib/admin-puppies-system";
import { fetchAdminPuppiesSnapshot } from "@/lib/admin-puppies-client";
import { isCurrentPuppyStatus, isReservedPuppyStatus } from "@/lib/admin-puppies-system";
import { usePortalAdminSession } from "@/lib/use-portal-admin-session";
import { fmtDate } from "@/lib/utils";

function card(extra = "") {
  return `rounded-[1.35rem] border border-[var(--portal-border)] bg-white/94 shadow-[0_14px_30px_rgba(106,76,45,0.08)] ${extra}`.trim();
}

function names(rows: PuppyWorkspaceRecord[]) {
  return rows.slice(0, 3).map((row) => row.displayName).join(", ") || "No matching puppies right now.";
}

function activityGlyph(kind: ActivityFeedItem["kind"]) {
  if (kind === "payment") return <Wallet className="h-4 w-4" />;
  if (kind === "document") return <FileText className="h-4 w-4" />;
  if (kind === "message") return <MessageSquareText className="h-4 w-4" />;
  if (kind === "weight" || kind === "health") return <HeartPulse className="h-4 w-4" />;
  return <Sparkles className="h-4 w-4" />;
}

function litterStage(litter: LitterWorkspaceRecord) {
  if (!litter.whelpDate) return "Stage not set";
  const ageDays = Math.floor((Date.now() - Date.parse(litter.whelpDate)) / 86400000);
  if (!Number.isFinite(ageDays)) return "Stage not set";
  if (ageDays < 0) return "Upcoming";
  if (ageDays < 14) return "Neonatal";
  if (ageDays < 28) return "Transition";
  if (ageDays < 56) return "Socialization";
  return "Grow-out";
}

export function AdminDashboardWorkspace() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const [snapshot, setSnapshot] = useState<PuppiesSystemSnapshot | null>(null);
  const [overview, setOverview] = useState<AdminOverviewStats | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [warningText, setWarningText] = useState("");
  const [errorText, setErrorText] = useState("");

  const hasWorkspaceData = Boolean(snapshot || overview);

  const loadWorkspace = useEffectEvent(async (background = false) => {
    if (!accessToken) return;

    if (background && hasWorkspaceData) setRefreshing(true);
    else setLoadingData(true);

    if (!background) {
      setWarningText("");
      setErrorText("");
    }

    try {
      const [snapshotResult, overviewResult] = await Promise.allSettled([
        fetchAdminPuppiesSnapshot(accessToken),
        fetchAdminOverview(accessToken),
      ]);

      const warnings: string[] = [];
      const nextSnapshot =
        snapshotResult.status === "fulfilled" ? snapshotResult.value.snapshot : null;
      const nextOverview =
        overviewResult.status === "fulfilled" ? overviewResult.value : null;

      if (snapshotResult.status === "fulfilled" && snapshotResult.value.error) {
        warnings.push(`Puppies snapshot: ${snapshotResult.value.error}`);
      } else if (snapshotResult.status === "rejected") {
        warnings.push("Puppies snapshot could not load.");
      }

      if (overviewResult.status === "fulfilled" && !overviewResult.value) {
        warnings.push("Program overview could not load.");
      } else if (overviewResult.status === "rejected") {
        warnings.push("Program overview could not load.");
      }

      if (nextSnapshot) setSnapshot(nextSnapshot);
      if (nextOverview) setOverview(nextOverview);

      if (!nextSnapshot && !nextOverview && !hasWorkspaceData) {
        setErrorText("The breeding-program dashboard could not load right now.");
      } else {
        setErrorText("");
      }

      setWarningText(warnings.length ? `Partial data loaded. ${warnings.join(" ")}` : "");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The breeding-program dashboard could not load right now.";
      if (!hasWorkspaceData) setErrorText(message);
      else setWarningText(message);
    } finally {
      setLoadingData(false);
      setRefreshing(false);
    }
  });

  useEffect(() => {
    if (!loading && accessToken && isAdmin) {
      void loadWorkspace(false);
    } else if (!loading) {
      setLoadingData(false);
    }
  }, [accessToken, isAdmin, loading, loadWorkspace]);

  const currentPuppies = useMemo(
    () => (snapshot?.puppies || []).filter((row) => isCurrentPuppyStatus(row.status)),
    [snapshot]
  );
  const pastPuppies = useMemo(
    () => (snapshot?.puppies || []).filter((row) => !isCurrentPuppyStatus(row.status)),
    [snapshot]
  );
  const availablePuppies = currentPuppies.filter((row) => !isReservedPuppyStatus(row.status));
  const reservedPuppies = currentPuppies.filter((row) => isReservedPuppyStatus(row.status));
  const activeLitters = (snapshot?.litters || []).filter(
    (row) =>
      row.currentPuppyCount > 0 ||
      !["completed", "archived"].includes(String(row.status || "").toLowerCase())
  );
  const weightDue = currentPuppies.filter((row) => row.care.weightDue);
  const vaccineDue = currentPuppies.filter((row) => row.care.vaccineDue);
  const dewormDue = currentPuppies.filter((row) => row.care.dewormingDue);
  const missingPhotos = currentPuppies.filter((row) => !row.readiness.photoReady);
  const missingCopy = currentPuppies.filter((row) => !row.readiness.copyReady);
  const noBuyer = currentPuppies.filter((row) => !row.buyerId);
  const missingPortal = currentPuppies.filter((row) => !row.readiness.portal.ready);
  const missingWebsite = currentPuppies.filter((row) => !row.readiness.website.ready);
  const blockedGoHome = currentPuppies.filter((row) => !row.readiness.goHome.ready);
  const overdueBuyers = (snapshot?.buyers || []).filter((row) => row.overdue);
  const buyersMissingDocs = (snapshot?.buyers || []).filter((row) => row.unsignedForms > 0);
  const recentCare = (snapshot?.recentActivity || []).filter((row) =>
    ["weight", "health", "event"].includes(row.kind)
  );
  const recentAlerts = (snapshot?.recentActivity || []).filter((row) =>
    ["document", "message", "payment", "template", "workflow"].includes(row.kind)
  );

  const metrics = [
    ["Current Puppies", currentPuppies.length, "Still active in care, readiness, and placement."],
    ["Available Puppies", availablePuppies.length, "Open for listing, inquiry, and matching."],
    ["Reserved Puppies", reservedPuppies.length, "Linked or held and still in follow-through."],
    ["Past Puppies", pastPuppies.length, "Placed, sold, completed, or archived."],
    ["Active Litters", activeLitters.length, "Litters still connected to active operations."],
    ["Active Buyers", snapshot?.buyers.length || 0, "Buyer records currently in motion."],
    [
      "Needs Attention",
      currentPuppies.filter((row) => row.attention.length > 0).length,
      "Current puppies with unresolved blockers.",
    ],
    ["Overdue Payments", overdueBuyers.length, "Financed accounts that need action now."],
  ] as const;

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

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-12">
        <AdminPageHero
          eyebrow="Dashboard"
          title="Breeding-program command center"
          description="High-signal visibility across puppies, litters, buyers, care, readiness, documents, financing, and next operational actions."
          actions={
            <>
              <AdminHeroPrimaryAction href="/admin/portal/puppies/current">
                Open Current Puppies
              </AdminHeroPrimaryAction>
              <AdminHeroSecondaryAction href="/admin/portal/litters">
                Open Litters
              </AdminHeroSecondaryAction>
              <button
                type="button"
                onClick={() => void loadWorkspace(true)}
                disabled={refreshing || loading}
                className="inline-flex items-center justify-center gap-2 rounded-[1rem] border border-[var(--portal-border)] bg-white/92 px-4 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[var(--portal-shadow-sm)] transition hover:bg-[var(--portal-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                {refreshing ? "Refreshing" : "Refresh"}
              </button>
            </>
          }
          aside={
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Signal label="Unread buyer messages" value={String(overview?.unreadBuyerMessages || 0)} />
              <Signal label="Open follow-ups" value={String(overview?.openFollowUps || 0)} />
              <Signal label="Public chats today" value={String(overview?.publicThreads24h || 0)} />
              <Signal
                label="Latest digest"
                value={
                  overview?.latestDigest?.digest_date
                    ? fmtDate(overview.latestDigest.digest_date)
                    : "No digest"
                }
              />
            </div>
          }
        />

        {warningText ? (
          <div className="rounded-[1.35rem] border border-amber-200 bg-amber-50/90 px-5 py-4 text-sm leading-6 text-amber-900">
            {warningText}
          </div>
        ) : null}

        {!hasWorkspaceData && (loading || loadingData) ? (
          <DashboardSkeleton />
        ) : !hasWorkspaceData ? (
          <AdminEmptyState
            title="The breeding-program dashboard did not load."
            description={errorText || "Try refreshing the dashboard."}
          />
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {metrics.map(([label, value, detail]) => (
                <div key={label} className={card("px-5 py-5")}>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                    {label}
                  </div>
                  <div className="mt-2 text-[1.55rem] font-semibold tracking-[-0.04em] text-[var(--portal-text)]">
                    {value}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
                </div>
              ))}
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
              <AdminPanel
                title="Immediate Attention"
                subtitle="These are the issues that still need breeder action, not just passive visibility."
              >
                <div className="grid gap-4 xl:grid-cols-2">
                  <QueueCard
                    title="Care Gaps"
                    items={[
                      ["Weights missing this week", weightDue.length, names(weightDue), "/admin/portal/puppies/current"],
                      ["Vaccine records missing", vaccineDue.length, names(vaccineDue), "/admin/portal/puppies/current"],
                      ["Deworming records missing", dewormDue.length, names(dewormDue), "/admin/portal/puppies/current"],
                    ]}
                  />
                  <QueueCard
                    title="Publication Blockers"
                    items={[
                      ["Photos missing", missingPhotos.length, names(missingPhotos), "/admin/portal/puppies/current"],
                      ["Website copy missing", missingCopy.length, names(missingCopy), "/admin/portal/puppies/current"],
                      ["Website readiness blocked", missingWebsite.length, names(missingWebsite), "/admin/portal/puppies"],
                    ]}
                  />
                  <QueueCard
                    title="Buyer & Placement"
                    items={[
                      ["No buyer linkage", noBuyer.length, names(noBuyer), "/admin/portal/puppies/current"],
                      [
                        "Buyers missing documents",
                        buyersMissingDocs.length,
                        buyersMissingDocs.slice(0, 3).map((row) => row.displayName).join(", ") || "No buyer document gaps right now.",
                        "/admin/portal/documents",
                      ],
                      ["Portal readiness incomplete", missingPortal.length, names(missingPortal), "/admin/portal/puppies"],
                    ]}
                  />
                  <QueueCard
                    title="Financial & Go-Home"
                    items={[
                      [
                        "Overdue payment-plan accounts",
                        overdueBuyers.length,
                        overdueBuyers.slice(0, 3).map((row) => row.displayName).join(", ") || "No overdue financed buyers right now.",
                        "/admin/portal/puppy-financing",
                      ],
                      ["Go-home blockers", blockedGoHome.length, names(blockedGoHome), "/admin/portal/puppies"],
                      [
                        "Assigned puppies",
                        currentPuppies.filter((row) => row.buyerId).length,
                        names(currentPuppies.filter((row) => row.buyerId)),
                        "/admin/portal/buyers",
                      ],
                    ]}
                  />
                </div>
              </AdminPanel>

              <AdminPanel title="Quick Actions" subtitle="Jump straight into the next admin surface.">
                <div className="grid gap-3">
                  <QuickLink href="/admin/portal/puppies/current" label="Open Current Puppies" detail="Use the stronger record manager and drawer editing flow." />
                  <QuickLink href="/admin/portal/puppies/past" label="Open Past Puppies" detail="Review historical records with the same detailed drawer." />
                  <QuickLink href="/admin/portal/litters" label="Open Litters" detail="Track pairings, whelping, and litter blockers." />
                  <QuickLink href="/admin/portal/buyers" label="Open Buyers" detail="View linkage, balances, documents, and placement progress." />
                  <QuickLink href="/admin/portal/documents" label="Open Documents" detail="Work filing, resend, override, and buyer submission records." />
                  <QuickLink href="/admin/portal/messages" label="Open Messages" detail="Review the buyer inbox and message follow-through." />
                  <QuickLink href="/admin/portal/messages?tab=templates" label="Open Messaging Templates" detail="Edit Resend-backed breeder templates without leaving the admin UI." />
                  <QuickLink href="/admin/portal/assistant" label="Open ChiChi" detail="Ask for blockers, drafts, reminders, and next actions." />
                </div>
              </AdminPanel>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <AdminPanel
                title="Care & Health"
                subtitle="Upcoming husbandry work and the latest care signals stay together here."
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  <SummaryStack
                    title="Upcoming and overdue care"
                    items={[
                      ["Weights due", weightDue.length, names(weightDue)],
                      ["Vaccines due", vaccineDue.length, names(vaccineDue)],
                      ["Deworming due", dewormDue.length, names(dewormDue)],
                      [
                        "Special-care puppies",
                        currentPuppies.filter((row) => row.profile.specialCareFlag).length,
                        names(currentPuppies.filter((row) => row.profile.specialCareFlag)),
                      ],
                    ]}
                  />
                  <ActivityStack
                    title="Recent care entries"
                    icon={<CalendarClock className="h-4 w-4 text-[#a56733]" />}
                    items={recentCare}
                  />
                </div>
              </AdminPanel>

              <AdminPanel
                title="Website, Portal & Litters"
                subtitle="Publication readiness and litter oversight stay visible without turning into a wall of filler."
              >
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <ReadinessCard
                      title="Website Ready"
                      ready={currentPuppies.filter((row) => row.readiness.website.ready).length}
                      total={currentPuppies.length}
                      blocker={`${missingPhotos.length} missing photos | ${missingCopy.length} missing descriptions`}
                    />
                    <ReadinessCard
                      title="Portal Ready"
                      ready={currentPuppies.filter((row) => row.readiness.portal.ready).length}
                      total={currentPuppies.length}
                      blocker={`${missingPortal.length} not portal-ready`}
                    />
                  </div>
                  <div className="space-y-3">
                    {activeLitters.length ? (
                      activeLitters.slice(0, 5).map((litter) => (
                        <div key={litter.id} className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-[var(--portal-text)]">{litter.displayName}</div>
                              <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                                {[litter.damName, litter.sireName, litter.whelpDate ? fmtDate(litter.whelpDate) : null].filter(Boolean).join(" | ")}
                              </div>
                            </div>
                            <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${adminStatusBadge(litter.status || "active")}`}>
                              {litterStage(litter)}
                            </span>
                          </div>
                          <div className="mt-3 text-xs leading-5 text-[var(--portal-text-soft)]">
                            {litter.pendingTasks[0] || "No obvious litter blockers right now."}
                          </div>
                        </div>
                      ))
                    ) : (
                      <AdminEmptyState
                        title="No active litters right now"
                        description="Active or upcoming litters will appear here as soon as the breeding record is updated."
                      />
                    )}
                  </div>
                </div>
              </AdminPanel>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_360px]">
              <AdminPanel
                title="Recent Activity / Alerts"
                subtitle="Recent care, documents, messages, payments, and workflow updates stay visible here."
              >
                <div className="space-y-3">
                  {overview?.latestDigest?.summary ? (
                    <div className="rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4 text-sm leading-6 text-[var(--portal-text-soft)]">
                      {overview.latestDigest.summary}
                    </div>
                  ) : null}
                  {[...recentAlerts.slice(0, 4), ...recentCare.slice(0, 4)].slice(0, 8).map((item) => (
                    <div key={item.id} className="flex items-start gap-3 rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3">
                      <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--portal-surface-muted)] text-[#8c6848]">
                        {activityGlyph(item.kind)}
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-[var(--portal-text)]">{item.title}</div>
                        <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                          {[item.detail, item.occurredAt ? fmtDate(item.occurredAt) : null].filter(Boolean).join(" | ")}
                        </div>
                      </div>
                    </div>
                  ))}
                  {!recentAlerts.length && !recentCare.length ? (
                    <AdminEmptyState
                      title="No recent operational activity"
                      description="Recent care, document, message, and payment events will surface here."
                    />
                  ) : null}
                </div>
              </AdminPanel>

              <AdminPanel
                title="ChiChi & Workflow Intelligence"
                subtitle="Use ChiChi for operational summaries, drafts, reminders, and supported task workflows."
              >
                <div className="space-y-4">
                  <div className={card("p-4")}>
                    <div className="text-sm font-semibold text-[var(--portal-text)]">Admin capabilities</div>
                    <div className="mt-3 space-y-2">
                      {(snapshot?.chichi.adminCapabilities || []).map((item) => (
                        <div key={item} className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3 text-sm leading-6 text-[var(--portal-text-soft)]">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={card("p-4")}>
                    <div className="text-sm font-semibold text-[var(--portal-text)]">Suggested prompts</div>
                    <div className="mt-3 space-y-2 text-sm text-[var(--portal-text-soft)]">
                      <div className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3">Which puppies need weights updated this week?</div>
                      <div className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3">Show buyers still missing signed documents.</div>
                      <div className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3">Which puppies are ready for website but not portal?</div>
                      <div className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3">Draft a payment reminder for overdue accounts.</div>
                    </div>
                  </div>
                  <Link href="/admin/portal/assistant" className="inline-flex items-center justify-center gap-2 rounded-[1rem] bg-[linear-gradient(90deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--portal-shadow-md)]">
                    <Sparkles className="h-4 w-4" />
                    Open ChiChi Admin
                  </Link>
                </div>
              </AdminPanel>
            </div>
          </>
        )}
      </div>
    </AdminPageShell>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-[var(--portal-border)] bg-white/88 px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">{value}</div>
    </div>
  );
}

function QueueCard({
  title,
  items,
}: {
  title: string;
  items: Array<[string, number, string, string]>;
}) {
  return (
    <div className={card("p-4")}>
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--portal-text)]">
        <Stethoscope className="h-4 w-4 text-[#a56733]" />
        {title}
      </div>
      <div className="mt-4 space-y-3">
        {items.map(([label, count, detail, href]) => (
          <Link
            key={label}
            href={href}
            className="block rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 transition hover:border-[var(--portal-border-strong)] hover:bg-white"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--portal-text)]">{label}</div>
                <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">{detail}</div>
              </div>
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${adminStatusBadge(
                  count ? "warning" : "completed"
                )}`}
              >
                {count}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function QuickLink({
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
      className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-4 transition hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)]"
    >
      <div className="text-sm font-semibold text-[var(--portal-text)]">{label}</div>
      <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">{detail}</div>
    </Link>
  );
}

function SummaryStack({
  title,
  items,
}: {
  title: string;
  items: Array<[string, number, string]>;
}) {
  return (
    <div className={card("p-4")}>
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--portal-text)]">
        <HeartPulse className="h-4 w-4 text-[#a56733]" />
        {title}
      </div>
      <div className="mt-4 space-y-3">
        {items.map(([label, count, detail]) => (
          <div key={label} className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--portal-text)]">{label}</div>
                <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">{detail}</div>
              </div>
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${adminStatusBadge(
                  count ? "warning" : "completed"
                )}`}
              >
                {count}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityStack({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: ActivityFeedItem[];
}) {
  return (
    <div className={card("p-4")}>
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--portal-text)]">
        {icon}
        {title}
      </div>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.slice(0, 6).map((item) => (
            <div key={item.id} className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3">
              <div className="text-sm font-semibold text-[var(--portal-text)]">{item.title}</div>
              <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                {[item.puppyName, item.detail, item.occurredAt ? fmtDate(item.occurredAt) : null]
                  .filter(Boolean)
                  .join(" | ")}
              </div>
            </div>
          ))
        ) : (
          <AdminEmptyState
            title="No recent care activity"
            description="Recent weight logs, care records, and milestones will surface here."
          />
        )}
      </div>
    </div>
  );
}

function ReadinessCard({
  title,
  ready,
  total,
  blocker,
}: {
  title: string;
  ready: number;
  total: number;
  blocker: string;
}) {
  return (
    <div className={card("p-4")}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-[var(--portal-text)]">{title}</div>
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${adminStatusBadge(
            ready === total ? "completed" : ready > 0 ? "pending" : "warning"
          )}`}
        >
          {ready}/{total}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--portal-surface-muted)]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)]"
          style={{ width: `${total ? Math.max(0, Math.min(100, (ready / total) * 100)) : 0}%` }}
        />
      </div>
      <div className="mt-3 text-xs leading-5 text-[var(--portal-text-soft)]">{blocker}</div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={`metric-skeleton-${index}`}
            className={card("min-h-[124px] animate-pulse bg-[var(--portal-surface-muted)]/70")}
          />
        ))}
      </section>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <div className={card("min-h-[340px] animate-pulse bg-[var(--portal-surface-muted)]/70")} />
        <div className={card("min-h-[340px] animate-pulse bg-[var(--portal-surface-muted)]/70")} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className={card("min-h-[280px] animate-pulse bg-[var(--portal-surface-muted)]/70")} />
        <div className={card("min-h-[280px] animate-pulse bg-[var(--portal-surface-muted)]/70")} />
      </div>
    </>
  );
}
