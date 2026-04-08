"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AdminEmptyState,
  AdminHeroPrimaryAction,
  AdminHeroSecondaryAction,
  AdminInfoTile,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPageHero,
  AdminPageShell,
  AdminPanel,
  AdminRestrictedState,
  adminStatusBadge,
} from "@/components/admin/luxury-admin-shell";
import {
  fetchAdminLineageWorkspace,
  fetchAdminOverview,
  type AdminLineageDog,
  type AdminLineageLitter,
  type AdminLineageWorkspace,
  type AdminOverviewStats,
} from "@/lib/admin-portal";
import { fmtDate, fmtMoney } from "@/lib/utils";
import { usePortalAdminSession } from "@/lib/use-portal-admin-session";

function emptyStats(): AdminOverviewStats {
  return {
    buyers: 0,
    applications: 0,
    payments: 0,
    documents: 0,
    paymentPlans: 0,
    transportRequests: 0,
    users: 0,
    unreadBuyerMessages: 0,
    visitors24h: 0,
    returningVisitors24h: 0,
    publicThreads24h: 0,
    publicMessages24h: 0,
    openFollowUps: 0,
    hotLeads: 0,
    warmLeads: 0,
    sharedContacts: 0,
    totalRevenue: 0,
    lineage: null,
    latestDigest: null,
    publicConversationSummaries: [],
    buyerConversationSummaries: [],
  };
}

function puppyLine(litter: AdminLineageLitter) {
  return `${litter.summary.totalPuppies} puppies`;
}

function dogLabel(dog: AdminLineageDog) {
  return String(dog.role || "").toLowerCase() === "sire" ? "Sire" : "Dam";
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function AdminPortalPage() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const [stats, setStats] = useState<AdminOverviewStats>(emptyStats());
  const [workspace, setWorkspace] = useState<AdminLineageWorkspace | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      if (!accessToken || !isAdmin) {
        if (!active) return;
        setStats(emptyStats());
        setWorkspace(null);
        setLoaded(true);
        return;
      }

      setRefreshing(true);
      try {
        const [nextStats, nextWorkspace] = await Promise.all([
          fetchAdminOverview(accessToken),
          fetchAdminLineageWorkspace(accessToken),
        ]);

        if (!active) return;
        setStats(nextStats || emptyStats());
        setWorkspace(nextWorkspace);
      } finally {
        if (active) {
          setRefreshing(false);
          setLoaded(true);
        }
      }
    }

    void loadWorkspace();

    return () => {
      active = false;
    };
  }, [accessToken, isAdmin]);

  if (loading || !loaded) {
    return (
      <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">
        Loading admin overview...
      </div>
    );
  }

  if (!user) {
    return (
      <AdminRestrictedState
        title="Sign in to access the admin overview."
        details="This workspace is reserved for the Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!isAdmin) {
    return (
      <AdminRestrictedState
        title="This admin overview is limited to approved owner accounts."
        details="Only the approved owner emails can access the operations workspace."
      />
    );
  }

  const lineage = workspace?.summary || stats.lineage;
  const totalLitters = lineage?.totalLitters || 0;
  const totalDams = lineage?.totalDams || 0;
  const totalSires = lineage?.totalSires || 0;
  const totalPuppies = lineage?.totalPuppies || 0;
  const availablePuppies = workspace?.summary.availableCount ?? stats.lineage?.availablePuppies ?? 0;
  const reservedPuppies = workspace?.summary.reservedCount ?? stats.lineage?.reservedPuppies ?? 0;
  const completedPuppies = workspace?.summary.completedCount ?? stats.lineage?.completedPuppies ?? 0;
  const projectedRevenue = lineage?.projectedRevenue || 0;
  const realizedRevenue = lineage?.realizedRevenue || stats.totalRevenue || 0;
  const totalDeposits = lineage?.totalDeposits || 0;

  const topLitters = (workspace?.litters || [])
    .slice()
    .sort((left, right) => right.summary.realizedRevenue - left.summary.realizedRevenue)
    .slice(0, 5);

  const topDogs = (workspace?.dogs || [])
    .slice()
    .sort((left, right) => right.summary.realizedRevenue - left.summary.realizedRevenue)
    .slice(0, 6);

  const littersMissingParents = (workspace?.litters || []).filter(
    (litter) => !litter.dam_id || !litter.sire_id,
  ).length;

  const puppiesMissingLitter = (workspace?.puppies || []).filter(
    (puppy) => !puppy.litter_id,
  ).length;

  const puppiesNeedingBuyer = (workspace?.puppies || []).filter((puppy) => {
    const status = String(puppy.status || "").toLowerCase();
    const inPlacementFlow =
      status.includes("reserv") ||
      status.includes("completed") ||
      status.includes("sold") ||
      status.includes("adopt") ||
      status.includes("matched");

    return inPlacementFlow && !puppy.buyer;
  }).length;

  const conversionRate =
    totalPuppies > 0 ? completedPuppies / totalPuppies : 0;

  const commandLinks = [
    { href: "/admin/portal/users", label: "Users", detail: "buyers & portal users" },
    { href: "/admin/portal/applications", label: "Applications", detail: "review queue" },
    { href: "/admin/portal/puppies", label: "Puppies", detail: "listings & assignments" },
    { href: "/admin/portal/litters", label: "Litters", detail: "program tracking" },
    { href: "/admin/portal/dams-sires", label: "Dams & Sires", detail: "breeding dogs" },
    { href: "/admin/portal/payments", label: "Payments", detail: "revenue & plans" },
    { href: "/admin/portal/documents", label: "Documents", detail: "forms & contracts" },
    { href: "/admin/portal/messages", label: "Messages", detail: "buyer follow-up" },
    { href: "/admin/portal/transportation", label: "Transportation", detail: "delivery queue" },
    { href: "/admin/portal/settings", label: "Settings", detail: "rules & config" },
  ];

  const queueRows = [
    {
      href: "/admin/portal/users",
      label: "Users / Buyers",
      value: String(stats.buyers || stats.users),
      detail: `${stats.paymentPlans} active payment plans`,
      status: stats.buyers > 0 || stats.users > 0 ? "active" : "pending",
    },
    {
      href: "/admin/portal/applications",
      label: "Applications",
      value: String(stats.applications),
      detail: `${stats.hotLeads} hot and ${stats.warmLeads} warm leads`,
      status: stats.hotLeads > 0 ? "reserved" : "pending",
    },
    {
      href: "/admin/portal/messages",
      label: "Buyer Messages",
      value: String(stats.unreadBuyerMessages),
      detail: `${stats.openFollowUps} open follow-up tasks`,
      status: stats.unreadBuyerMessages > 0 ? "reserved" : "completed",
    },
    {
      href: "/admin/portal/litters",
      label: "Litters",
      value: String(totalLitters),
      detail:
        littersMissingParents > 0
          ? `${littersMissingParents} litters still need sire or dam linkage`
          : `${availablePuppies} puppies currently available`,
      status: littersMissingParents > 0 ? "reserved" : totalLitters > 0 ? "active" : "pending",
    },
    {
      href: "/admin/portal/dams-sires",
      label: "Breeding Dogs",
      value: String(totalDams + totalSires),
      detail: `${totalDams} dams and ${totalSires} sires tracked`,
      status: totalDams + totalSires > 0 ? "active" : "pending",
    },
    {
      href: "/admin/portal/transportation",
      label: "Transportation",
      value: String(stats.transportRequests),
      detail:
        stats.transportRequests > 0
          ? "Pending or approved pickup and delivery requests"
          : "No transportation requests need action",
      status: stats.transportRequests > 0 ? "reserved" : "completed",
    },
    {
      href: "/admin/portal/payments",
      label: "Revenue",
      value: fmtMoney(realizedRevenue),
      detail: `${fmtMoney(totalDeposits)} in deposits recorded`,
      status: "completed",
    },
  ];

  const operationalAlerts = [
    {
      title: "Lineage Gaps",
      value: littersMissingParents ? `${littersMissingParents} open` : "Clear",
      detail:
        littersMissingParents > 0
          ? "Some litters still need a sire or dam attached for clean lineage reporting."
          : "Every tracked litter currently has both sire and dam linkage.",
      tone: littersMissingParents > 0 ? "reserved" : "completed",
      href: "/admin/portal/litters",
    },
    {
      title: "Placement Gaps",
      value: puppiesNeedingBuyer ? `${puppiesNeedingBuyer} open` : "Clear",
      detail:
        puppiesNeedingBuyer > 0
          ? "Reserved or completed puppies still need a linked buyer record."
          : "Reserved and completed puppies are linked to buyer records.",
      tone: puppiesNeedingBuyer > 0 ? "reserved" : "completed",
      href: "/admin/portal/puppies",
    },
    {
      title: "Litter Assignment",
      value: puppiesMissingLitter ? `${puppiesMissingLitter} open` : "Clear",
      detail:
        puppiesMissingLitter > 0
          ? "Some puppy records are still missing a litter assignment."
          : "All tracked puppies are attached to a litter record.",
      tone: puppiesMissingLitter > 0 ? "reserved" : "completed",
      href: "/admin/portal/puppies",
    },
    {
      title: "Transport Queue",
      value: stats.transportRequests ? `${stats.transportRequests} open` : "Quiet",
      detail:
        stats.transportRequests > 0
          ? "Transportation requests need scheduling or confirmation."
          : "No pickup or delivery requests need action right now.",
      tone: stats.transportRequests > 0 ? "reserved" : "completed",
      href: "/admin/portal/transportation",
    },
  ];

  return (
    <AdminPageShell>
      <div className="space-y-5 pb-10">
        <AdminPageHero
          eyebrow="Kennel Command"
          title="A tighter software-style kennel workspace for buyers, litters, puppies, lineage, and revenue."
          description="This admin overview is rebuilt as a real command surface: faster scanning, cleaner queue management, stronger lineage visibility, and clearer movement into users, puppies, litters, payments, transport, and message follow-up."
          actions={
            <>
              <AdminHeroPrimaryAction href="/admin/portal/users">
                Open Users
              </AdminHeroPrimaryAction>
              <AdminHeroSecondaryAction href="/admin/portal/puppies">
                Open Puppies
              </AdminHeroSecondaryAction>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center rounded-2xl border border-[#e4d2be] bg-white px-5 py-3 text-sm font-semibold text-[#5d4330] shadow-[0_12px_28px_rgba(106,76,45,0.08)] transition hover:-translate-y-0.5 hover:border-[#d4b48b]"
              >
                {refreshing ? "Refreshing..." : "Refresh Workspace"}
              </button>
            </>
          }
          aside={
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <AdminInfoTile
                label="Realized Revenue"
                value={fmtMoney(realizedRevenue)}
                detail="Completed and buyer-linked revenue tracked across puppies, litters, breeding dogs, and payments."
              />
              <AdminInfoTile
                label="Projected Pipeline"
                value={fmtMoney(projectedRevenue)}
                detail={`${availablePuppies} available / ${reservedPuppies} reserved / ${completedPuppies} completed`}
              />
              <AdminInfoTile
                label="Lineage Coverage"
                value={`${totalLitters} litters`}
                detail={`${totalDams} dams / ${totalSires} sires / ${totalPuppies} puppies`}
              />
            </div>
          }
        />

        <AdminPanel
          title="Command Navigation"
          subtitle="Core admin routes in one place, including the users page."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {commandLinks.map((item) => (
              <CommandNavCard
                key={item.href}
                href={item.href}
                label={item.label}
                detail={item.detail}
              />
            ))}
          </div>
        </AdminPanel>

        <AdminMetricGrid>
          <AdminMetricCard
            label="Users / Buyers"
            value={String(stats.buyers || stats.users)}
            detail="Portal users, buyer records, and account-linked families."
          />
          <AdminMetricCard
            label="Applications"
            value={String(stats.applications)}
            detail="Intake flow waiting on review, follow-up, or decision."
            accent="from-[#f0ddc5] via-[#d9b78e] to-[#be8650]"
          />
          <AdminMetricCard
            label="Litters"
            value={String(totalLitters)}
            detail="Live litter records with lineage, pricing, and revenue visibility."
            accent="from-[#e7ddd3] via-[#c9b39a] to-[#8f6f53]"
          />
          <AdminMetricCard
            label="Puppies"
            value={String(totalPuppies)}
            detail={`${availablePuppies} available / ${reservedPuppies} reserved / ${completedPuppies} completed`}
            accent="from-[#d8e8dc] via-[#b8d0b4] to-[#7f9f7d]"
          />
          <AdminMetricCard
            label="Conversion"
            value={pct(conversionRate)}
            detail="Completed placement rate across tracked puppies."
            accent="from-[#ece0d2] via-[#d1b193] to-[#a1724e]"
          />
        </AdminMetricGrid>

        <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.25fr)_420px]">
          <div className="space-y-5">
            <AdminPanel
              title="Operations Grid"
              subtitle="A cleaner software-style queue by operating area."
            >
              <div className="overflow-hidden rounded-[24px] border border-[#ead9c7]">
                <table className="min-w-full divide-y divide-[#eee1d2] text-sm">
                  <thead className="bg-[#faf3ea] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9c7043]">
                    <tr>
                      <th className="px-4 py-3">Area</th>
                      <th className="px-4 py-3">Current Load</th>
                      <th className="px-4 py-3">Context</th>
                      <th className="px-4 py-3 text-right">Open</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1e6da] bg-white">
                    {queueRows.map((row) => (
                      <tr key={row.label} className="hover:bg-[#fffaf4]">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[#2f2218]">{row.label}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="inline-flex items-center gap-2">
                            <span className="text-base font-semibold text-[#2f2218]">
                              {row.value}
                            </span>
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(row.status)}`}
                            >
                              {row.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#73583f]">{row.detail}</td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={row.href}
                            className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9c7043] transition hover:text-[#7b5630]"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AdminPanel>

            <div className="grid gap-5 xl:grid-cols-2">
              <AdminPanel
                title="Litter Revenue Board"
                subtitle="Top litters ranked by realized revenue with lineage context."
              >
                {topLitters.length ? (
                  <div className="overflow-hidden rounded-[24px] border border-[#ead9c7]">
                    <table className="min-w-full divide-y divide-[#eee1d2] text-sm">
                      <thead className="bg-[#faf3ea] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9c7043]">
                        <tr>
                          <th className="px-4 py-3">Litter</th>
                          <th className="px-4 py-3">Parents</th>
                          <th className="px-4 py-3">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f1e6da] bg-white">
                        {topLitters.map((litter) => (
                          <tr key={litter.id} className="hover:bg-[#fffaf4]">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-[#2f2218]">
                                {litter.displayName}
                              </div>
                              <div className="mt-1 text-xs text-[#8a6a49]">
                                {litter.whelp_date
                                  ? fmtDate(litter.whelp_date)
                                  : "Whelp date not set"}{" "}
                                / {puppyLine(litter)}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[#73583f]">
                              {(litter.damProfile?.displayName || "No dam") +
                                " / " +
                                (litter.sireProfile?.displayName || "No sire")}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-[#2f2218]">
                                {fmtMoney(litter.summary.realizedRevenue)}
                              </div>
                              <div className="mt-1 text-xs text-[#8a6a49]">
                                {litter.summary.completedCount} completed /{" "}
                                {litter.summary.reservedCount} reserved
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <AdminEmptyState
                    title="No litters tracked yet"
                    description="Create litters and attach dams, sires, and puppies to turn lineage into a first-class operating view."
                  />
                )}
              </AdminPanel>

              <AdminPanel
                title="Dam and Sire Performance"
                subtitle="A sharper read on breeding output, reserve rate, and realized revenue."
              >
                {topDogs.length ? (
                  <div className="space-y-3">
                    {topDogs.map((dog) => (
                      <div
                        key={`${dog.role}-${dog.id}`}
                        className="rounded-[22px] border border-[#ead9c7] bg-[#fffaf4] px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-[#2f2218]">
                              {dog.displayName}
                            </div>
                            <div className="mt-1 text-xs leading-5 text-[#8a6a49]">
                              {dogLabel(dog)} / {dog.summary.totalLitters} litters /{" "}
                              {dog.summary.totalPuppies} puppies
                            </div>
                          </div>
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(dog.status || "active")}`}
                          >
                            {dog.status || dogLabel(dog)}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <MiniSnapshot label="Revenue" value={fmtMoney(dog.summary.realizedRevenue)} />
                          <MiniSnapshot label="Complete" value={pct(dog.summary.completionRate)} />
                          <MiniSnapshot label="Reserved" value={pct(dog.summary.reserveRate)} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <AdminEmptyState
                    title="No breeding dogs tracked yet"
                    description="Add dams and sires so the admin can track litter output and lifetime lineage revenue."
                  />
                )}
              </AdminPanel>
            </div>
          </div>

          <div className="space-y-5">
            <AdminPanel
              title="Operational Alerts"
              subtitle="The next cleanup, assignment, and flow issues that matter right now."
            >
              <div className="grid gap-3">
                {operationalAlerts.map((alert) => (
                  <Link
                    key={alert.title}
                    href={alert.href}
                    className="rounded-[22px] border border-[#ead9c7] bg-[#fffaf4] px-4 py-4 transition hover:border-[#d8b48b] hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#2f2218]">
                          {alert.title}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-[#73583f]">
                          {alert.detail}
                        </div>
                      </div>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(alert.tone)}`}
                      >
                        {alert.value}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </AdminPanel>

            <AdminPanel
              title="Snapshot"
              subtitle="Traffic, deposits, digest status, and the live state of the kennel pipeline."
            >
              <div className="grid gap-3">
                <AdminInfoTile
                  label="Latest Digest"
                  value={stats.latestDigest ? fmtDate(stats.latestDigest.digest_date) : "No brief yet"}
                  detail={
                    stats.latestDigest?.summary ||
                    "Run the daily digest to surface summarized priorities here."
                  }
                />
                <AdminInfoTile
                  label="Public Traffic"
                  value={`${stats.visitors24h} visitors`}
                  detail={`${stats.returningVisitors24h} returning / ${stats.publicThreads24h} threads / ${stats.publicMessages24h} messages`}
                />
                <AdminInfoTile
                  label="Deposits Recorded"
                  value={fmtMoney(totalDeposits)}
                  detail={`${fmtMoney(projectedRevenue)} projected pipeline with ${stats.sharedContacts} shared contacts in the last 24 hours.`}
                />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <QuickJump href="/admin/portal/users" title="Users" detail="buyer accounts & access" />
                <QuickJump href="/admin/portal/puppies" title="Puppies" detail="listings, lineage, assignments" />
                <QuickJump href="/admin/portal/payments" title="Payments" detail="revenue, balances, plans" />
                <QuickJump href="/admin/portal/dams-sires" title="Dams & Sires" detail="profiles and output" />
                <QuickJump href="/admin/portal/transportation" title="Transportation" detail="pickup and delivery queue" />
                <QuickJump href="/admin/portal/settings" title="Settings" detail="rules and system config" />
              </div>
            </AdminPanel>

            <AdminPanel
              title="Recent Buyer Conversations"
              subtitle="Newest buyer threads without leaving the main command view."
            >
              {stats.buyerConversationSummaries.length ? (
                <div className="space-y-3">
                  {stats.buyerConversationSummaries.slice(0, 5).map((item) => (
                    <Link
                      key={item.key}
                      href="/admin/portal/messages"
                      className="block rounded-[22px] border border-[#ead9c7] bg-[#fffaf4] px-4 py-4 transition hover:border-[#d8b48b] hover:bg-white"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[#2f2218]">
                            {item.subject}
                          </div>
                          <div className="mt-1 truncate text-xs text-[#8a6a49]">
                            {item.email || "No email on file"}
                          </div>
                        </div>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                            item.unreadCount > 0
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {item.unreadCount > 0 ? `${item.unreadCount} unread` : "up to date"}
                        </span>
                      </div>
                      <div className="mt-3 text-sm leading-6 text-[#73583f]">
                        {item.preview}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <AdminEmptyState
                  title="No buyer conversations yet"
                  description="Buyer inbox threads will appear here once the portal starts receiving messages."
                />
              )}
            </AdminPanel>
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}

function CommandNavCard({
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
      className="rounded-[22px] border border-[#ead9c7] bg-[#fffaf4] px-4 py-4 transition hover:-translate-y-0.5 hover:border-[#d8b48b] hover:bg-white"
    >
      <div className="text-sm font-semibold text-[#2f2218]">{label}</div>
      <div className="mt-1 text-xs leading-5 text-[#8a6a49]">{detail}</div>
    </Link>
  );
}

function QuickJump({
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
      className="rounded-[20px] border border-[#ead9c7] bg-[#fffaf4] px-4 py-4 transition hover:border-[#d8b48b] hover:bg-white"
    >
      <div className="text-sm font-semibold text-[#2f2218]">{title}</div>
      <div className="mt-1 text-xs leading-5 text-[#8a6a49]">{detail}</div>
    </Link>
  );
}

function MiniSnapshot({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-[#ead9c7] bg-white px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9c7043]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[#2f2218]">{value}</div>
    </div>
  );
}