"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Circle,
  CreditCard,
  ExternalLink,
  FileCheck2,
  HeartPulse,
  Layers3,
  Loader2,
  MessageSquareText,
  PawPrint,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
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
import {
  type ActivityFeedItem,
  type LitterWorkspaceRecord,
  type PuppiesSystemSnapshot,
  type PuppiesSystemTab,
  type PuppyWorkspaceRecord,
  isCurrentPuppyStatus,
  isPastPuppyStatus,
  isReservedPuppyStatus,
} from "@/lib/admin-puppies-system";
import { fetchAdminPuppiesSnapshot } from "@/lib/admin-puppies-client";
import { usePortalAdminSession } from "@/lib/use-portal-admin-session";
import { buildPuppyPhotoUrl, fmtDate, fmtMoney } from "@/lib/utils";

type RosterFilter = "all" | "attention" | "available" | "reserved" | "unlinked" | "care_due";

type ReadinessLine = {
  label: string;
  ready: boolean;
  score?: number;
  detail: string;
  href: string;
};

type WorkItem = {
  label: string;
  count: number;
  detail: string;
  href: string;
  tone: "success" | "warning" | "danger" | "neutral";
  icon: React.ReactNode;
};

const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-[1rem] border border-[var(--portal-border)] bg-white/92 px-4 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[var(--portal-shadow-sm)] transition hover:bg-[var(--portal-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60";

const filterOptions: Array<{ key: RosterFilter; label: string }> = [
  { key: "all", label: "All Current" },
  { key: "attention", label: "Needs Attention" },
  { key: "available", label: "Available" },
  { key: "reserved", label: "Reserved" },
  { key: "unlinked", label: "No Buyer" },
  { key: "care_due", label: "Care Due" },
];

function surface(extra = "") {
  return `rounded-[1.45rem] border border-[rgba(187,160,132,0.28)] bg-[rgba(255,252,248,0.9)] shadow-[0_18px_44px_rgba(110,79,47,0.08)] backdrop-blur-sm ${extra}`.trim();
}

function text(value: unknown) {
  return String(value || "").trim();
}

function money(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "Not set";
  return fmtMoney(Number(value));
}

function ageLabel(puppy: PuppyWorkspaceRecord) {
  if (puppy.ageWeeks == null) return puppy.dob ? fmtDate(puppy.dob) : "Age not set";
  return `${puppy.ageWeeks} ${puppy.ageWeeks === 1 ? "week" : "weeks"}`;
}

function latestWeightLabel(puppy: PuppyWorkspaceRecord) {
  const latestWeight = puppy.care.latestWeight;
  if (latestWeight?.weightOz != null) return `${latestWeight.weightOz} oz`;
  if (latestWeight?.weightG != null) return `${latestWeight.weightG} g`;
  if (puppy.currentWeight != null) return `${puppy.currentWeight} ${puppy.weightUnit || ""}`.trim();
  return "No weight";
}

function latestCareDate(puppy: PuppyWorkspaceRecord) {
  return (
    puppy.care.latestWeight?.weighDate ||
    puppy.care.latestHealthRecord?.recordDate ||
    puppy.care.latestEvent?.eventDate ||
    puppy.weightDate ||
    null
  );
}

function nextCareLabel(puppy: PuppyWorkspaceRecord) {
  if (puppy.care.weightDue) return "Weight due";
  if (puppy.care.vaccineDue) return "Vaccine due";
  if (puppy.care.dewormingDue) return "Deworming due";
  return "Care current";
}

function careDue(puppy: PuppyWorkspaceRecord) {
  return puppy.care.weightDue || puppy.care.vaccineDue || puppy.care.dewormingDue;
}

function readinessTone(score: number) {
  if (score >= 90) return "completed";
  if (score >= 70) return "warning";
  return "failed";
}

function readinessClass(score: number) {
  if (score >= 90) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (score >= 70) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function statusTone(status: string | null | undefined) {
  if (isPastPuppyStatus(status)) return "completed";
  if (isReservedPuppyStatus(status)) return "reserved";
  if (text(status).toLowerCase().includes("available")) return "available";
  return "pending";
}

function rowMatchesSearch(puppy: PuppyWorkspaceRecord, search: string) {
  if (!search) return true;
  return [
    puppy.displayName,
    puppy.callName,
    puppy.registeredName,
    puppy.litterName,
    puppy.damName,
    puppy.sireName,
    puppy.sex,
    puppy.color,
    puppy.coatType,
    puppy.status,
    puppy.buyerName,
    puppy.buyerEmail,
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ")
    .includes(search);
}

function rowMatchesFilter(puppy: PuppyWorkspaceRecord, filter: RosterFilter) {
  if (filter === "attention") return puppy.attention.length > 0;
  if (filter === "available") return !isReservedPuppyStatus(puppy.status) && !puppy.buyerId;
  if (filter === "reserved") return isReservedPuppyStatus(puppy.status) || Boolean(puppy.buyerId);
  if (filter === "unlinked") return !puppy.buyerId;
  if (filter === "care_due") return careDue(puppy);
  return true;
}

function selectedPuppyHref(puppy: PuppyWorkspaceRecord | null) {
  return puppy ? `/admin/portal/puppies/current?puppy=${puppy.id}` : "/admin/portal/puppies/current";
}

function selectedPuppyDocumentHref(puppy: PuppyWorkspaceRecord | null) {
  if (!puppy) return "/admin/portal/documents";
  return `/admin/portal/documents?puppy=${puppy.id}`;
}

function selectedPuppyBuyerHref(puppy: PuppyWorkspaceRecord | null) {
  if (!puppy?.buyerId) return "/admin/portal/buyers";
  return `/admin/portal/buyers?buyer=${puppy.buyerId}`;
}

function selectedPuppyLitterHref(puppy: PuppyWorkspaceRecord | null) {
  if (!puppy?.litterId) return "/admin/portal/litters";
  return `/admin/portal/litters?litter=${puppy.litterId}`;
}

function buildReadinessLines(puppy: PuppyWorkspaceRecord | null): ReadinessLine[] {
  if (!puppy) return [];

  return [
    {
      label: "Care Ready",
      ready: !careDue(puppy),
      score: careDue(puppy) ? 68 : 100,
      detail: nextCareLabel(puppy),
      href: selectedPuppyHref(puppy),
    },
    {
      label: "Website Ready",
      ready: puppy.readiness.website.ready,
      score: puppy.readiness.website.score,
      detail:
        puppy.readiness.website.missing.concat(puppy.readiness.website.blocked).join(", ") ||
        "Listing requirements look ready.",
      href: selectedPuppyHref(puppy),
    },
    {
      label: "Portal Ready",
      ready: puppy.readiness.portal.ready,
      score: puppy.readiness.portal.score,
      detail:
        puppy.readiness.portal.missing.concat(puppy.readiness.portal.blocked).join(", ") ||
        "Buyer-facing portal information is ready.",
      href: selectedPuppyHref(puppy),
    },
    {
      label: "Buyer Linked",
      ready: Boolean(puppy.buyerId),
      score: puppy.buyerId ? 100 : 52,
      detail: puppy.buyerName || "No buyer attached yet.",
      href: selectedPuppyBuyerHref(puppy),
    },
    {
      label: "Documents Ready",
      ready: puppy.readiness.documents.ready,
      score: puppy.readiness.documents.score,
      detail:
        puppy.documentSummary.total > 0
          ? `${puppy.documentSummary.signed} signed, ${puppy.documentSummary.filed} filed.`
          : "No document package attached yet.",
      href: selectedPuppyDocumentHref(puppy),
    },
    {
      label: "Payment Status",
      ready: !puppy.paymentSummary.overdue,
      score: puppy.paymentSummary.overdue ? 40 : 100,
      detail:
        puppy.paymentSummary.remainingBalance != null
          ? `${money(puppy.paymentSummary.remainingBalance)} remaining.`
          : "No payment balance available.",
      href: "/admin/portal/puppy-financing",
    },
    {
      label: "Go-Home Ready",
      ready: puppy.readiness.goHome.ready,
      score: puppy.readiness.goHome.score,
      detail:
        puppy.readiness.goHome.missing.concat(puppy.readiness.goHome.blocked).join(", ") ||
        "Go-home readiness looks complete.",
      href: selectedPuppyHref(puppy),
    },
  ];
}

function buildWorkItems(snapshot: PuppiesSystemSnapshot, currentPuppies: PuppyWorkspaceRecord[]): WorkItem[] {
  const weightsDue = currentPuppies.filter((puppy) => puppy.care.weightDue).length;
  const vaccinesDue = currentPuppies.filter((puppy) => puppy.care.vaccineDue).length;
  const dewormingDue = currentPuppies.filter((puppy) => puppy.care.dewormingDue).length;
  const noBuyer = currentPuppies.filter((puppy) => !puppy.buyerId).length;
  const listingBlocked = currentPuppies.filter(
    (puppy) => !puppy.readiness.website.ready || !puppy.readiness.portal.ready
  ).length;
  const documentsBlocked = currentPuppies.filter((puppy) => !puppy.readiness.documents.ready).length;
  const overdueBuyers = snapshot.buyers.filter((buyer) => buyer.overdue).length;
  const unreadMessages = currentPuppies.reduce(
    (total, puppy) => total + Number(puppy.portalSummary.unreadMessages || 0),
    0
  );

  return [
    {
      label: "Care due",
      count: weightsDue + vaccinesDue + dewormingDue,
      detail: `${weightsDue} weights, ${vaccinesDue} vaccines, ${dewormingDue} deworming records need review.`,
      href: "/admin/portal/puppies/current",
      tone: weightsDue + vaccinesDue + dewormingDue ? "warning" : "success",
      icon: <HeartPulse className="h-4 w-4" />,
    },
    {
      label: "Buyer linkage",
      count: noBuyer,
      detail: "Current puppies without an attached buyer or placement file.",
      href: "/admin/portal/buyers",
      tone: noBuyer ? "warning" : "success",
      icon: <Users className="h-4 w-4" />,
    },
    {
      label: "Listing / portal blockers",
      count: listingBlocked,
      detail: "Puppies missing website or buyer-portal readiness requirements.",
      href: "/admin/portal/puppies/current",
      tone: listingBlocked ? "warning" : "success",
      icon: <Sparkles className="h-4 w-4" />,
    },
    {
      label: "Document blockers",
      count: documentsBlocked,
      detail: "Current puppies without complete document readiness.",
      href: "/admin/portal/documents",
      tone: documentsBlocked ? "warning" : "success",
      icon: <FileCheck2 className="h-4 w-4" />,
    },
    {
      label: "Payment follow-up",
      count: overdueBuyers,
      detail: "Buyer payment-plan accounts currently marked overdue.",
      href: "/admin/portal/puppy-financing",
      tone: overdueBuyers ? "danger" : "success",
      icon: <CreditCard className="h-4 w-4" />,
    },
    {
      label: "Unread portal messages",
      count: unreadMessages,
      detail: "Buyer messages connected to current puppy records.",
      href: "/admin/portal/messages",
      tone: unreadMessages ? "warning" : "success",
      icon: <MessageSquareText className="h-4 w-4" />,
    },
  ];
}

export function PuppiesSystemWorkspace({
  defaultTab = "overview",
}: {
  defaultTab?: PuppiesSystemTab;
}) {
  void defaultTab;

  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const [snapshot, setSnapshot] = useState<PuppiesSystemSnapshot | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RosterFilter>("all");
  const [selectedPuppyId, setSelectedPuppyId] = useState("");
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [warningText, setWarningText] = useState("");
  const deferredSearch = useDeferredValue(search);
  const snapshotRef = useRef<PuppiesSystemSnapshot | null>(snapshot);
  const initialLoadKeyRef = useRef("");

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const loadSnapshot = useCallback(
    async (background = false) => {
      if (!accessToken) return;
      const existingSnapshot = snapshotRef.current;
      if (background && existingSnapshot) setRefreshing(true);
      else setLoadingSnapshot(true);
      if (!background) {
        setErrorText("");
        setWarningText("");
      }

      try {
        const payload = await fetchAdminPuppiesSnapshot(accessToken);
        if (!payload.snapshot) {
          const message = payload.error || "Could not load the Puppies workspace.";
          if (existingSnapshot) setWarningText(message);
          else setErrorText(message);
          return;
        }

        setSnapshot(payload.snapshot);
        setWarningText(payload.error || "");
        const current = payload.snapshot.puppies.find((puppy) =>
          isCurrentPuppyStatus(puppy.status)
        );
        setSelectedPuppyId((currentId) =>
          currentId && payload.snapshot?.puppies.some((puppy) => String(puppy.id) === currentId)
            ? currentId
            : current
              ? String(current.id)
              : ""
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not load the Puppies workspace.";
        if (existingSnapshot) setWarningText(message);
        else setErrorText(message);
      } finally {
        setLoadingSnapshot(false);
        setRefreshing(false);
      }
    },
    [accessToken]
  );

  useEffect(() => {
    if (!loading && accessToken && isAdmin) {
      if (initialLoadKeyRef.current === accessToken) return;
      initialLoadKeyRef.current = accessToken;
      void loadSnapshot(false);
    } else if (!loading) {
      initialLoadKeyRef.current = "";
      setLoadingSnapshot(false);
    }
  }, [accessToken, isAdmin, loading, loadSnapshot]);

  const currentPuppies = useMemo(
    () => (snapshot?.puppies || []).filter((puppy) => isCurrentPuppyStatus(puppy.status)),
    [snapshot]
  );
  const pastPuppies = useMemo(
    () => (snapshot?.puppies || []).filter((puppy) => isPastPuppyStatus(puppy.status)),
    [snapshot]
  );
  const activeLitters = useMemo(
    () => (snapshot?.litters || []).filter((litter) => litter.currentPuppyCount > 0),
    [snapshot]
  );
  const searchText = deferredSearch.trim().toLowerCase();
  const visibleCurrent = useMemo(
    () =>
      currentPuppies
        .filter((puppy) => rowMatchesSearch(puppy, searchText))
        .filter((puppy) => rowMatchesFilter(puppy, filter))
        .sort((left, right) => {
          const leftAttention = left.attention.length + (careDue(left) ? 2 : 0);
          const rightAttention = right.attention.length + (careDue(right) ? 2 : 0);
          if (rightAttention !== leftAttention) return rightAttention - leftAttention;
          return left.displayName.localeCompare(right.displayName);
        }),
    [currentPuppies, filter, searchText]
  );

  const selectedPuppy = useMemo(() => {
    if (!snapshot) return null;
    return (
      currentPuppies.find((puppy) => String(puppy.id) === selectedPuppyId) ||
      visibleCurrent[0] ||
      currentPuppies[0] ||
      null
    );
  }, [currentPuppies, selectedPuppyId, snapshot, visibleCurrent]);

  useEffect(() => {
    if (!selectedPuppy && visibleCurrent[0]) {
      setSelectedPuppyId(String(visibleCurrent[0].id));
    }
  }, [selectedPuppy, visibleCurrent]);

  const readinessLines = useMemo(() => buildReadinessLines(selectedPuppy), [selectedPuppy]);
  const workItems = useMemo(
    () => (snapshot ? buildWorkItems(snapshot, currentPuppies) : []),
    [currentPuppies, snapshot]
  );
  const recentForSelected = useMemo(() => {
    if (!snapshot || !selectedPuppy) return [];
    return snapshot.recentActivity.filter(
      (item) => item.puppyId === selectedPuppy.id || item.puppyName === selectedPuppy.displayName
    );
  }, [selectedPuppy, snapshot]);

  const availableCount = currentPuppies.filter(
    (puppy) => !isReservedPuppyStatus(puppy.status) && !puppy.buyerId
  ).length;
  const reservedCount = currentPuppies.filter(
    (puppy) => isReservedPuppyStatus(puppy.status) || Boolean(puppy.buyerId)
  ).length;
  const careDueCount = currentPuppies.filter(careDue).length;
  const listingBlockers = currentPuppies.filter(
    (puppy) => !puppy.readiness.website.ready || !puppy.readiness.portal.ready
  ).length;
  const goHomeBlocked = currentPuppies.filter((puppy) => !puppy.readiness.goHome.ready).length;

  const initialLoading = (loading || loadingSnapshot) && !snapshot;

  if (initialLoading) {
    return (
      <AdminPageShell>
        <div className="space-y-5 pb-10">
          <div className={surface("h-[150px] animate-pulse bg-[var(--portal-surface-muted)]/70")} />
          <div className={surface("h-[92px] animate-pulse bg-[var(--portal-surface-muted)]/70")} />
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(420px,0.8fr)]">
            <div className={surface("h-[560px] animate-pulse bg-[var(--portal-surface-muted)]/70")} />
            <div className={surface("h-[560px] animate-pulse bg-[var(--portal-surface-muted)]/70")} />
          </div>
        </div>
      </AdminPageShell>
    );
  }

  if (!loading && !user) {
    return (
      <AdminRestrictedState
        title="Sign in to access the Puppies workspace."
        details="This workspace is reserved for the Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!loading && user && !isAdmin) {
    return (
      <AdminRestrictedState
        title="This workspace is limited to approved owner accounts."
        details="Only approved owner accounts can manage puppy operations, buyer workflows, and readiness records."
      />
    );
  }

  if (!snapshot) {
    return (
      <AdminPageShell>
        <AdminEmptyState
          title="The Puppies workspace did not load."
          description={errorText || "Try refreshing the workspace. Current and Past Puppies remain available from the sub-navigation."}
        />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell>
      <div className="space-y-5 pb-10">
        <AdminPageHero
          eyebrow="Puppies"
          title="Puppy Operations Workspace"
          description="A working surface for active puppies, care readiness, buyer linkage, documents, listing status, and go-home preparation."
          actions={
            <>
              <AdminHeroPrimaryAction href="/admin/portal/puppies/current">
                Open Current Manager
              </AdminHeroPrimaryAction>
              <AdminHeroSecondaryAction href="/admin/portal/puppies/past">
                Open Past Puppies
              </AdminHeroSecondaryAction>
              <button
                type="button"
                onClick={() => void loadSnapshot(true)}
                disabled={refreshing || loadingSnapshot}
                className={secondaryButtonClass}
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                {refreshing ? "Refreshing" : "Refresh"}
              </button>
            </>
          }
        />

        {warningText ? (
          <div className="rounded-[1.15rem] border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm leading-6 text-amber-900">
            Partial data loaded. {warningText}
          </div>
        ) : null}

        {errorText ? (
          <div className="rounded-[1.15rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800">
            {errorText}
          </div>
        ) : null}

        <section className={surface("overflow-hidden")}>
          <div className="grid divide-y divide-[var(--portal-border)] md:grid-cols-3 md:divide-x md:divide-y-0 xl:grid-cols-6">
            <CompactSignal label="Current" value={currentPuppies.length} detail="Active puppy records" href="/admin/portal/puppies/current" />
            <CompactSignal label="Available" value={availableCount} detail="Not reserved or buyer-linked" href="/admin/portal/puppies/current" />
            <CompactSignal label="Reserved" value={reservedCount} detail="Reserved, matched, or linked" href="/admin/portal/puppies/current" />
            <CompactSignal label="Care Due" value={careDueCount} detail="Weight, vaccine, or deworming" href="/admin/portal/puppies/current" tone={careDueCount ? "warning" : "success"} />
            <CompactSignal label="Readiness Blocks" value={listingBlockers + goHomeBlocked} detail="Website, portal, or go-home" href="/admin/portal/puppies/current" tone={listingBlockers + goHomeBlocked ? "warning" : "success"} />
            <CompactSignal label="Past" value={pastPuppies.length} detail="Completed history" href="/admin/portal/puppies/past" />
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.24fr)_minmax(420px,0.86fr)]">
          <section className={surface("overflow-hidden")}>
            <div className="border-b border-[var(--portal-border)] px-5 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                    Current Puppy Roster
                  </div>
                  <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--portal-text)]">
                    Active management queue
                  </h2>
                </div>
                <label className="relative block w-full max-w-md">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--portal-text-muted)]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search puppy, buyer, litter, color..."
                    className="w-full rounded-[1rem] border border-[var(--portal-border)] bg-white py-3 pl-11 pr-4 text-sm text-[var(--portal-text)] shadow-sm outline-none placeholder:text-[var(--portal-text-muted)] focus:border-[var(--portal-border-strong)]"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {filterOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setFilter(option.key)}
                    className={[
                      "rounded-full border px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition",
                      filter === option.key
                        ? "border-transparent bg-[var(--portal-accent)] text-white"
                        : "border-[var(--portal-border)] bg-white text-[var(--portal-text-soft)] hover:text-[var(--portal-text)]",
                    ].join(" ")}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                <div className="grid grid-cols-[minmax(210px,1.2fr)_120px_160px_120px_190px_116px] gap-3 border-b border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                  <div>Puppy</div>
                  <div>Litter / Age</div>
                  <div>Buyer</div>
                  <div>Care</div>
                  <div>Readiness</div>
                  <div>Open</div>
                </div>
                {visibleCurrent.length ? (
                  visibleCurrent.map((puppy) => (
                    <RosterRow
                      key={puppy.id}
                      puppy={puppy}
                      selected={selectedPuppy?.id === puppy.id}
                      onSelect={() => setSelectedPuppyId(String(puppy.id))}
                    />
                  ))
                ) : (
                  <div className="px-5 py-8">
                    <AdminEmptyState
                      title="No current puppies match this view"
                      description="Adjust the search or filter, or open the Current Manager to review the full working surface."
                    />
                  </div>
                )}
              </div>
            </div>
          </section>

          <DetailWorkspace
            puppy={selectedPuppy}
            readinessLines={readinessLines}
            recentActivity={recentForSelected}
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className={surface("overflow-hidden")}>
            <SectionHeader
              eyebrow="Workflow Health"
              title="Puppy work that needs movement"
              subtitle="These are breeder operations categories, not passive stats."
            />
            <div className="divide-y divide-[var(--portal-border)]">
              {workItems.map((item) => (
                <WorkQueueRow key={item.label} item={item} />
              ))}
            </div>
          </section>

          <section className={surface("p-5")}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                  Actions
                </div>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--portal-text)]">
                  Continue the work
                </h2>
              </div>
              <PawPrint className="h-5 w-5 text-[#a56733]" />
            </div>
            <div className="mt-4 grid gap-2">
              <ActionLink href="/admin/portal/puppies/current" label="Add or edit puppy record" detail="Identity, pricing, buyer link, photos, and notes" icon={<PawPrint className="h-4 w-4" />} />
              <ActionLink href={selectedPuppyHref(selectedPuppy)} label="Log weight / care update" detail={selectedPuppy ? `Open ${selectedPuppy.displayName}'s care drawer` : "Open the current puppy manager"} icon={<Stethoscope className="h-4 w-4" />} />
              <ActionLink href={selectedPuppyHref(selectedPuppy)} label="Log vaccine or deworming" detail="Use the puppy care update workflow" icon={<HeartPulse className="h-4 w-4" />} />
              <ActionLink href={selectedPuppyBuyerHref(selectedPuppy)} label="Link buyer / review placement" detail="Buyer matching, portal status, and placement file" icon={<Users className="h-4 w-4" />} />
              <ActionLink href={selectedPuppyDocumentHref(selectedPuppy)} label="Open documents" detail="Packets, signatures, filing, and portal forms" icon={<FileCheck2 className="h-4 w-4" />} />
              <ActionLink href={selectedPuppyLitterHref(selectedPuppy)} label="Open litter management" detail="Dam, sire, litter stage, and linked puppies" icon={<Layers3 className="h-4 w-4" />} />
              <ActionLink href="/admin/portal/resend-templates" label="Edit Resend templates" detail="Payment, document, puppy update, and transport emails" icon={<MessageSquareText className="h-4 w-4" />} />
            </div>
          </section>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className={surface("overflow-hidden")}>
            <SectionHeader
              eyebrow="Litters"
              title="Active litter context"
              subtitle="The puppy workspace stays connected to litter and lineage work without becoming a litter dashboard."
            />
            {activeLitters.length ? (
              <div className="divide-y divide-[var(--portal-border)]">
                {activeLitters.slice(0, 6).map((litter) => (
                  <LitterRow key={litter.id} litter={litter} />
                ))}
              </div>
            ) : (
              <div className="px-5 pb-5">
                <AdminEmptyState
                  title="No active litters in the puppy snapshot"
                  description="Open Litters to review historical, planned, or closed litter records."
                />
              </div>
            )}
          </section>

          <section className={surface("overflow-hidden")}>
            <SectionHeader
              eyebrow="Recent Puppy Movement"
              title="Latest puppy operations"
              subtitle="Care, document, message, payment, and workflow activity connected to puppy operations."
            />
            {snapshot.recentActivity.length ? (
              <div className="divide-y divide-[var(--portal-border)]">
                {snapshot.recentActivity.slice(0, 8).map((item) => (
                  <ActivityRow key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="px-5 pb-5">
                <AdminEmptyState
                  title="No recent puppy activity returned"
                  description="Care logs, document movement, messages, and payment events will appear here when available."
                />
              </div>
            )}
          </section>
        </section>
      </div>
    </AdminPageShell>
  );
}

function CompactSignal({
  label,
  value,
  detail,
  href,
  tone = "neutral",
}: {
  label: string;
  value: number;
  detail: string;
  href: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <Link href={href} className="block px-4 py-4 transition hover:bg-[var(--portal-surface-muted)]">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="text-2xl font-semibold tracking-[-0.04em] text-[var(--portal-text)]">{value}</div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${adminStatusBadge(
            tone === "danger" ? "failed" : tone === "warning" ? "warning" : tone === "success" ? "completed" : "neutral"
          )}`}
        >
          {tone === "success" ? "clear" : tone === "warning" ? "review" : tone === "danger" ? "urgent" : "open"}
        </span>
      </div>
      <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">{detail}</div>
    </Link>
  );
}

function RosterRow({
  puppy,
  selected,
  onSelect,
}: {
  puppy: PuppyWorkspaceRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  const readinessAverage = Math.round(
    (puppy.readiness.website.score +
      puppy.readiness.portal.score +
      puppy.readiness.documents.score +
      puppy.readiness.goHome.score) /
      4
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "grid w-full grid-cols-[minmax(210px,1.2fr)_120px_160px_120px_190px_116px] gap-3 border-b border-[var(--portal-border)] px-5 py-4 text-left transition last:border-b-0",
        selected ? "bg-white" : "bg-transparent hover:bg-[var(--portal-surface-muted)]",
      ].join(" ")}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-[var(--portal-text)]">
            {puppy.displayName}
          </span>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${adminStatusBadge(
              statusTone(puppy.status)
            )}`}
          >
            {puppy.status || "pending"}
          </span>
        </div>
        <div className="mt-1 truncate text-xs text-[var(--portal-text-soft)]">
          {[puppy.sex, puppy.color, puppy.coatType].filter(Boolean).join(" / ") ||
            "Identity details still being completed"}
        </div>
      </div>

      <div className="text-sm text-[var(--portal-text-soft)]">
        <div className="font-semibold text-[var(--portal-text)]">{puppy.litterName || "No litter"}</div>
        <div className="mt-1 text-xs">{ageLabel(puppy)}</div>
      </div>

      <div className="min-w-0 text-sm">
        <div className="truncate font-semibold text-[var(--portal-text)]">
          {puppy.buyerName || "Unassigned"}
        </div>
        <div className="mt-1 truncate text-xs text-[var(--portal-text-soft)]">
          {puppy.buyerPortalLinked ? "Portal linked" : puppy.buyerId ? "Buyer attached" : "Needs match review"}
        </div>
      </div>

      <div className="text-sm">
        <div className="font-semibold text-[var(--portal-text)]">{latestWeightLabel(puppy)}</div>
        <div className={`mt-1 text-xs ${careDue(puppy) ? "text-amber-700" : "text-emerald-700"}`}>
          {nextCareLabel(puppy)}
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap gap-1.5">
          <ReadinessMini label="Web" score={puppy.readiness.website.score} />
          <ReadinessMini label="Portal" score={puppy.readiness.portal.score} />
          <ReadinessMini label="Docs" score={puppy.readiness.documents.score} />
        </div>
        <div className="mt-1 text-xs text-[var(--portal-text-soft)]">
          Overall {readinessAverage}%
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Link
          href={selectedPuppyHref(puppy)}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--portal-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[#9a6437] shadow-sm transition hover:bg-[var(--portal-surface-muted)]"
          onClick={(event) => event.stopPropagation()}
        >
          Manage
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </button>
  );
}

function ReadinessMini({ label, score }: { label: string; score: number }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${readinessClass(score)}`}>
      {label} {score}%
    </span>
  );
}

function DetailWorkspace({
  puppy,
  readinessLines,
  recentActivity,
}: {
  puppy: PuppyWorkspaceRecord | null;
  readinessLines: ReadinessLine[];
  recentActivity: ActivityFeedItem[];
}) {
  if (!puppy) {
    return (
      <section className={surface("p-6")}>
        <AdminEmptyState
          title="Select a puppy"
          description="Choose a current puppy from the roster to inspect care, readiness, buyer linkage, and next actions."
        />
      </section>
    );
  }

  return (
    <section className={surface("overflow-hidden")}>
      <div className="border-b border-[var(--portal-border)] p-5">
        <div className="flex gap-4">
          <PuppyPhoto puppy={puppy} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-2xl font-semibold tracking-[-0.05em] text-[var(--portal-text)]">
                {puppy.displayName}
              </h2>
              <span
                className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${adminStatusBadge(
                  statusTone(puppy.status)
                )}`}
              >
                {puppy.status || "pending"}
              </span>
            </div>
            <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
              {[puppy.sex, puppy.color, puppy.coatType, puppy.registry].filter(Boolean).join(" / ") ||
                "Puppy identity details still being completed."}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <DetailFact label="DOB / age" value={puppy.dob ? `${fmtDate(puppy.dob)} / ${ageLabel(puppy)}` : ageLabel(puppy)} />
              <DetailFact label="Price" value={money(puppy.price ?? puppy.listPrice ?? puppy.publicPrice)} />
              <DetailFact label="Litter" value={puppy.litterName || "No litter linked"} />
              <DetailFact label="Buyer" value={puppy.buyerName || "No buyer attached"} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="divide-y divide-[var(--portal-border)]">
          <div className="p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                  Lifecycle
                </div>
                <div className="mt-1 text-base font-semibold text-[var(--portal-text)]">
                  Care, placement, and go-home status
                </div>
              </div>
              <Link href={selectedPuppyHref(puppy)} className="text-sm font-semibold text-[#9a6437]">
                Open full record
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <LifecycleStat
                label="Latest weight"
                value={latestWeightLabel(puppy)}
                detail={latestCareDate(puppy) ? `Updated ${fmtDate(latestCareDate(puppy) || "")}` : "No recent care date"}
                icon={<Stethoscope className="h-4 w-4" />}
              />
              <LifecycleStat
                label="Documents"
                value={`${puppy.documentSummary.signed}/${puppy.documentSummary.total || 0} signed`}
                detail={puppy.documentSummary.latestTitle || "No latest document"}
                icon={<FileCheck2 className="h-4 w-4" />}
              />
              <LifecycleStat
                label="Portal"
                value={puppy.buyerPortalLinked ? "Linked" : "Not linked"}
                detail={`${puppy.portalSummary.unreadMessages} unread buyer messages`}
                icon={<ShieldCheck className="h-4 w-4" />}
              />
            </div>
          </div>

          <div className="p-5">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
              Readiness Model
            </div>
            <div className="space-y-2">
              {readinessLines.map((line) => (
                <ReadinessRow key={line.label} line={line} />
              ))}
            </div>
          </div>

          <div className="p-5">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
              Recent movement for this puppy
            </div>
            {recentActivity.length ? (
              <div className="space-y-2">
                {recentActivity.slice(0, 4).map((item) => (
                  <ActivityCompactRow key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="rounded-[1rem] border border-dashed border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4 text-sm leading-6 text-[var(--portal-text-soft)]">
                No recent activity tied directly to this puppy was returned in the snapshot.
              </div>
            )}
          </div>
        </div>

        <aside className="border-t border-[var(--portal-border)] p-5 xl:border-l xl:border-t-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
            Attention
          </div>
          <div className="mt-3 space-y-2">
            {puppy.attention.length ? (
              puppy.attention.slice(0, 6).map((item) => (
                <div
                  key={item}
                  className="rounded-[1rem] border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-5 text-amber-900"
                >
                  {item}
                </div>
              ))
            ) : (
              <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm leading-5 text-emerald-800">
                This puppy has no attention flags in the snapshot.
              </div>
            )}
          </div>

          <div className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
            Linked work
          </div>
          <div className="mt-3 space-y-2">
            <SideLink href={selectedPuppyBuyerHref(puppy)} label="Buyer file" value={puppy.buyerName || "Unassigned"} />
            <SideLink href={selectedPuppyDocumentHref(puppy)} label="Documents" value={`${puppy.documentSummary.total} records`} />
            <SideLink href="/admin/portal/puppy-financing" label="Payments" value={puppy.paymentSummary.overdue ? "Overdue" : "Open ledger"} />
            <SideLink href={selectedPuppyLitterHref(puppy)} label="Litter" value={puppy.litterName || "Not linked"} />
            <SideLink href="/admin/portal/transportation" label="Transport" value={puppy.transportRequestStatus || "No request"} />
          </div>
        </aside>
      </div>
    </section>
  );
}

function PuppyPhoto({ puppy }: { puppy: PuppyWorkspaceRecord }) {
  const photo = puppy.photoUrl ? buildPuppyPhotoUrl(puppy.photoUrl) : "";

  return (
    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[1.25rem] bg-[linear-gradient(135deg,#f0dfcb_0%,#d7b48c_100%)]">
      {photo ? (
        <Image src={photo} alt={puppy.displayName} fill sizes="96px" className="object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[#8c6848]">
          <Camera className="h-7 w-7" />
        </div>
      )}
    </div>
  );
}

function DetailFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] bg-[var(--portal-surface-muted)] px-3 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-[var(--portal-text)]">{value}</div>
    </div>
  );
}

function LifecycleStat({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-4">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">{value}</div>
      <div className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--portal-text-soft)]">{detail}</div>
    </div>
  );
}

function ReadinessRow({ line }: { line: ReadinessLine }) {
  const score = line.score ?? (line.ready ? 100 : 0);

  return (
    <Link
      href={line.href}
      className="grid gap-3 rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3 transition hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)] sm:grid-cols-[minmax(0,1fr)_96px]"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--portal-text)]">
          {line.ready ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          )}
          {line.label}
        </div>
        <div className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--portal-text-soft)]">
          {line.detail}
        </div>
      </div>
      <div className="flex items-center sm:justify-end">
        <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${readinessClass(score)}`}>
          {score}%
        </span>
      </div>
    </Link>
  );
}

function SideLink({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-[0.95rem] border border-[var(--portal-border)] bg-white px-3 py-3 text-sm transition hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)]"
    >
      <span className="font-semibold text-[var(--portal-text)]">{label}</span>
      <span className="truncate text-right text-xs text-[var(--portal-text-soft)]">{value}</span>
    </Link>
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
      <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[var(--portal-text)]">
        {title}
      </h2>
      {subtitle ? <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">{subtitle}</div> : null}
    </div>
  );
}

function WorkQueueRow({ item }: { item: WorkItem }) {
  return (
    <Link
      href={item.href}
      className="grid gap-3 px-5 py-4 transition hover:bg-[var(--portal-surface-muted)] md:grid-cols-[42px_minmax(0,1fr)_82px_120px]"
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--portal-surface-muted)] text-[#9a6437]">
        {item.icon}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[var(--portal-text)]">{item.label}</div>
        <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">{item.detail}</div>
      </div>
      <div className="flex items-center">
        <span
          className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${adminStatusBadge(
            item.tone === "danger" ? "failed" : item.tone === "warning" ? "warning" : item.tone === "success" ? "completed" : "neutral"
          )}`}
        >
          {item.count}
        </span>
      </div>
      <div className="flex items-center text-sm font-semibold text-[#9a6437]">
        Open
        <ArrowRight className="ml-2 h-4 w-4" />
      </div>
    </Link>
  );
}

function ActionLink({
  href,
  label,
  detail,
  icon,
}: {
  href: string;
  label: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3 transition hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)]"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--portal-surface-muted)] text-[#9a6437]">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[var(--portal-text)]">{label}</div>
          <div className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--portal-text-soft)]">{detail}</div>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--portal-text-muted)] transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

function LitterRow({ litter }: { litter: LitterWorkspaceRecord }) {
  return (
    <Link
      href={`/admin/portal/litters?litter=${litter.id}`}
      className="grid gap-3 px-5 py-4 transition hover:bg-[var(--portal-surface-muted)] md:grid-cols-[minmax(0,1fr)_120px_130px]"
    >
      <div className="min-w-0">
        <div className="font-semibold text-[var(--portal-text)]">{litter.displayName}</div>
        <div className="mt-1 truncate text-sm text-[var(--portal-text-soft)]">
          {[litter.damName ? `Dam: ${litter.damName}` : "", litter.sireName ? `Sire: ${litter.sireName}` : ""]
            .filter(Boolean)
            .join(" / ") || "Lineage not linked"}
        </div>
      </div>
      <div className="text-sm text-[var(--portal-text-soft)]">
        {litter.whelpDate ? fmtDate(litter.whelpDate) : "No date"}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-[var(--portal-text)]">
          {litter.currentPuppyCount} current
        </span>
        <ArrowRight className="h-4 w-4 text-[var(--portal-text-muted)]" />
      </div>
    </Link>
  );
}

function ActivityRow({ item }: { item: ActivityFeedItem }) {
  return (
    <Link
      href={item.puppyId ? `/admin/portal/puppies/current?puppy=${item.puppyId}` : "/admin/portal/puppies/current"}
      className="grid gap-3 px-5 py-4 transition hover:bg-[var(--portal-surface-muted)] md:grid-cols-[42px_minmax(0,1fr)_110px]"
    >
      <ActivityIcon kind={item.kind} />
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
          {item.kind.replace(/_/g, " ")}
        </div>
        <div className="mt-1 truncate text-sm font-semibold text-[var(--portal-text)]">{item.title}</div>
        <div className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--portal-text-soft)]">{item.detail}</div>
      </div>
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--portal-text-muted)] md:text-right">
        {item.occurredAt ? fmtDate(item.occurredAt) : "No date"}
      </div>
    </Link>
  );
}

function ActivityCompactRow({ item }: { item: ActivityFeedItem }) {
  return (
    <Link
      href={item.puppyId ? `/admin/portal/puppies/current?puppy=${item.puppyId}` : "/admin/portal/puppies/current"}
      className="flex items-start gap-3 rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3 transition hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)]"
    >
      <ActivityIcon kind={item.kind} small />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-[var(--portal-text)]">{item.title}</div>
        <div className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--portal-text-soft)]">
          {item.detail}
        </div>
      </div>
    </Link>
  );
}

function ActivityIcon({
  kind,
  small = false,
}: {
  kind: ActivityFeedItem["kind"];
  small?: boolean;
}) {
  const icon =
    kind === "weight" ? (
      <Stethoscope className="h-4 w-4" />
    ) : kind === "health" ? (
      <HeartPulse className="h-4 w-4" />
    ) : kind === "document" ? (
      <FileCheck2 className="h-4 w-4" />
    ) : kind === "message" ? (
      <MessageSquareText className="h-4 w-4" />
    ) : kind === "payment" ? (
      <CreditCard className="h-4 w-4" />
    ) : kind === "event" ? (
      <Sparkles className="h-4 w-4" />
    ) : (
      <Circle className="h-4 w-4" />
    );

  return (
    <span
      className={`inline-flex ${small ? "h-8 w-8" : "h-10 w-10"} shrink-0 items-center justify-center rounded-full bg-[var(--portal-surface-muted)] text-[#9a6437]`}
    >
      {icon}
    </span>
  );
}
