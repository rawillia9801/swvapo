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
    return <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">Loading admin overview...</div>;
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
  const topLitters = (workspace?.litters || []).slice().sort((left, right) => right.summary.realizedRevenue - left.summary.realizedRevenue).slice(0, 5);
  const topDogs = (workspace?.dogs || []).slice().sort((left, right) => right.summary.realizedRevenue - left.summary.realizedRevenue).slice(0, 6);
  const littersMissingParents = (workspace?.litters || []).filter((litter) => !litter.dam_id || !litter.sire_id).length;
  const puppiesMissingLitter = (workspace?.puppies || []).filter((puppy) => !puppy.litter_id).length;
  const puppiesNeedingBuyer = (workspace?.puppies || []).filter((puppy) => {
    const status = String(puppy.status || "").toLowerCase();
    const inPlacementFlow = status.includes("reserv") || status.includes("completed") || status.includes("sold") || status.includes("adopt") || status.includes("matched");
    return inPlacementFlow && !puppy.buyer;
  }).length;

  const queueRows = [
    { href: "/admin/portal/users", label: "Buyers in system", value: String(stats.buyers), detail: `${stats.paymentPlans} active payment plans`, status: stats.buyers > 0 ? "active" : "pending" },
    { href: "/admin/portal/applications", label: "Applications awaiting flow", value: String(stats.applications), detail: `${stats.hotLeads} hot and ${stats.warmLeads} warm leads`, status: stats.hotLeads > 0 ? "reserved" : "pending" },
    { href: "/admin/portal/messages", label: "Unread buyer messages", value: String(stats.unreadBuyerMessages), detail: `${stats.openFollowUps} open follow-up tasks`, status: stats.unreadBuyerMessages > 0 ? "reserved" : "completed" },
    { href: "/admin/portal/litters", label: "Litters in program", value: String(totalLitters), detail: littersMissingParents > 0 ? `${littersMissingParents} litter records still need sire or dam linkage` : `${availablePuppies} puppies still available`, status: littersMissingParents > 0 ? "reserved" : totalLitters > 0 ? "active" : "pending" },
    { href: "/admin/portal/dams-sires", label: "Breeding dogs tracked", value: String(totalDams + totalSires), detail: `${totalDams} dams and ${totalSires} sires`, status: totalDams + totalSires > 0 ? "active" : "pending" },
    { href: "/admin/portal/transportation", label: "Transportation requests", value: String(stats.transportRequests), detail: stats.transportRequests > 0 ? "Pending or approved pickup and delivery scheduling requests" : "No open transportation requests right now", status: stats.transportRequests > 0 ? "reserved" : "completed" },
    { href: "/admin/portal/payments", label: "Recorded revenue", value: fmtMoney(realizedRevenue), detail: `${fmtMoney(totalDeposits)} in deposits recorded`, status: "completed" },
  ];

  const operationalAlerts = [
    { title: "Lineage gaps", value: littersMissingParents ? `${littersMissingParents} open` : "All linked", detail: littersMissingParents > 0 ? "Some litters still need a sire or dam attached for complete lineage reporting." : "Every tracked litter currently has both sire and dam linkage.", tone: littersMissingParents > 0 ? "reserved" : "completed", href: "/admin/portal/litters" },
    { title: "Placement gaps", value: puppiesNeedingBuyer ? `${puppiesNeedingBuyer} open` : "All assigned", detail: puppiesNeedingBuyer > 0 ? "Reserved or completed puppies still need a linked buyer record." : "Reserved and completed puppies are linked to buyer records.", tone: puppiesNeedingBuyer > 0 ? "reserved" : "completed", href: "/admin/portal/puppies" },
    { title: "Litter setup", value: puppiesMissingLitter ? `${puppiesMissingLitter} open` : "In sync", detail: puppiesMissingLitter > 0 ? "Some puppy records are still missing a litter assignment." : "All tracked puppies are attached to a litter record.", tone: puppiesMissingLitter > 0 ? "reserved" : "completed", href: "/admin/portal/puppies" },
    { title: "Transportation", value: stats.transportRequests ? `${stats.transportRequests} open` : "Quiet", detail: stats.transportRequests > 0 ? "Transportation requests need scheduling or final confirmation." : "No pickup or delivery requests need action right now.", tone: stats.transportRequests > 0 ? "reserved" : "completed", href: "/admin/portal/transportation" },
  ];

  return (
    <AdminPageShell>
      <div className="space-y-5 pb-10">
        <AdminPageHero
          eyebrow="Overview"
          title="Breeder operations, buyer flow, and lineage performance in one tighter command workspace."
          description="The admin is organized around the real operating model now: buyers, litters, breeding dogs, puppies, financing, payments, documents, transport requests, and message follow-up. This view stays compact, scannable, and connected to the live data model."
          actions={
            <>
              <AdminHeroPrimaryAction href="/admin/portal/users">Open Buyers</AdminHeroPrimaryAction>
              <AdminHeroSecondaryAction href="/admin/portal/litters">Open Litters</AdminHeroSecondaryAction>
              <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center rounded-2xl border border-[#e4d2be] bg-white px-5 py-3 text-sm font-semibold text-[#5d4330] shadow-[0_12px_28px_rgba(106,76,45,0.08)] transition hover:-translate-y-0.5 hover:border-[#d4b48b]">
                {refreshing ? "Refreshing..." : "Refresh Workspace"}
              </button>
            </>
          }
          aside={
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <AdminInfoTile label="Realized Revenue" value={fmtMoney(realizedRevenue)} detail="Completed and buyer-linked revenue tracked internally across litters, breeding dogs, buyers, and payments." />
              <AdminInfoTile label="Projected Revenue" value={fmtMoney(projectedRevenue)} detail="List and sale values still in play across available and reserved puppies." />
              <AdminInfoTile label="Lineage Coverage" value={`${totalLitters} litters`} detail={`${totalDams} dams / ${totalSires} sires / ${totalPuppies} puppies`} />
            </div>
          }
        />

        <AdminMetricGrid>
          <AdminMetricCard label="Buyers" value={String(stats.buyers)} detail="Active buyer records and completed accounts managed in one workspace." />
          <AdminMetricCard label="Applications" value={String(stats.applications)} detail="Application flow and review queue waiting on decisions or follow-up." accent="from-[#f0ddc5] via-[#d9b78e] to-[#be8650]" />
          <AdminMetricCard label="Litters" value={String(totalLitters)} detail="First-class litter records with linked dams, sires, puppies, and revenue." accent="from-[#e7ddd3] via-[#c9b39a] to-[#8f6f53]" />
          <AdminMetricCard label="Puppies" value={String(totalPuppies)} detail={`${availablePuppies} available / ${reservedPuppies} reserved / ${completedPuppies} completed`} accent="from-[#d8e8dc] via-[#b8d0b4] to-[#7f9f7d]" />
          <AdminMetricCard label="Open Transport" value={String(stats.transportRequests)} detail="Pickup, meet-up, and delivery requests still needing review or scheduling." accent="from-[#ece0d2] via-[#d1b193] to-[#a1724e]" />
        </AdminMetricGrid>

        <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.25fr)_420px]">
          <div className="space-y-5">
            <AdminPanel title="Operational Queue" subtitle="Instead of oversized summary cards, the admin now exposes the live queue by operating area.">
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
                        <td className="px-4 py-3"><div className="font-semibold text-[#2f2218]">{row.label}</div></td>
                        <td className="px-4 py-3"><div className="inline-flex items-center gap-2"><span className="text-base font-semibold text-[#2f2218]">{row.value}</span><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(row.status)}`}>{row.status}</span></div></td>
                        <td className="px-4 py-3 text-[#73583f]">{row.detail}</td>
                        <td className="px-4 py-3 text-right"><Link href={row.href} className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9c7043] transition hover:text-[#7b5630]">Open</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AdminPanel>

            <div className="grid gap-5 xl:grid-cols-2">
              <AdminPanel title="Litter Revenue Board" subtitle="Top litters ranked by realized revenue with direct lineage context.">
                {topLitters.length ? (
                  <div className="overflow-hidden rounded-[24px] border border-[#ead9c7]">
                    <table className="min-w-full divide-y divide-[#eee1d2] text-sm">
                      <thead className="bg-[#faf3ea] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9c7043]">
                        <tr><th className="px-4 py-3">Litter</th><th className="px-4 py-3">Parents</th><th className="px-4 py-3">Revenue</th></tr>
                      </thead>
                      <tbody className="divide-y divide-[#f1e6da] bg-white">
                        {topLitters.map((litter) => (
                          <tr key={litter.id} className="hover:bg-[#fffaf4]">
                            <td className="px-4 py-3"><div className="font-semibold text-[#2f2218]">{litter.displayName}</div><div className="mt-1 text-xs text-[#8a6a49]">{litter.whelp_date ? fmtDate(litter.whelp_date) : "Whelp date not set"} / {puppyLine(litter)}</div></td>
                            <td className="px-4 py-3 text-[#73583f]">{(litter.damProfile?.displayName || "No dam") + " / " + (litter.sireProfile?.displayName || "No sire")}</td>
                            <td className="px-4 py-3"><div className="font-semibold text-[#2f2218]">{fmtMoney(litter.summary.realizedRevenue)}</div><div className="mt-1 text-xs text-[#8a6a49]">{litter.summary.completedCount} completed / {litter.summary.reservedCount} reserved</div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <AdminEmptyState title="No litters tracked yet" description="Create litters and attach dams, sires, and puppies to turn lineage into a first-class operating view." />}
              </AdminPanel>

              <AdminPanel title="Dam and Sire Performance" subtitle="A direct read on breeding output, completion rate, and realized revenue.">
                {topDogs.length ? (
                  <div className="space-y-3">
                    {topDogs.map((dog) => (
                      <div key={`${dog.role}-${dog.id}`} className="rounded-[22px] border border-[#ead9c7] bg-[#fffaf4] px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div><div className="text-sm font-semibold text-[#2f2218]">{dog.displayName}</div><div className="mt-1 text-xs leading-5 text-[#8a6a49]">{dogLabel(dog)} / {dog.summary.totalLitters} litters / {dog.summary.totalPuppies} puppies</div></div>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(dog.status || "active")}`}>{dog.status || dogLabel(dog)}</span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <MiniSnapshot label="Revenue" value={fmtMoney(dog.summary.realizedRevenue)} />
                          <MiniSnapshot label="Complete" value={`${Math.round(dog.summary.completionRate * 100)}%`} />
                          <MiniSnapshot label="Reserved" value={`${Math.round(dog.summary.reserveRate * 100)}%`} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <AdminEmptyState title="No breeding dogs tracked yet" description="Add dams and sires so the admin can track litter output and lifetime lineage revenue." />}
              </AdminPanel>
            </div>
          </div>

          <div className="space-y-5">
            <AdminPanel title="Operational Alerts" subtitle="The overview stays software-like by surfacing the next real cleanup and assignment tasks.">
              <div className="grid gap-3">
                {operationalAlerts.map((alert) => (
                  <Link key={alert.title} href={alert.href} className="rounded-[22px] border border-[#ead9c7] bg-[#fffaf4] px-4 py-4 transition hover:border-[#d8b48b] hover:bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><div className="text-sm font-semibold text-[#2f2218]">{alert.title}</div><div className="mt-2 text-sm leading-6 text-[#73583f]">{alert.detail}</div></div>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(alert.tone)}`}>{alert.value}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </AdminPanel>

            <AdminPanel title="Command Snapshot" subtitle="Daily pressure points, conversation flow, and links into the next action.">
              <div className="grid gap-3">
                <AdminInfoTile label="Latest Digest" value={stats.latestDigest ? fmtDate(stats.latestDigest.digest_date) : "No brief yet"} detail={stats.latestDigest?.summary || "Run the daily digest to surface summarized priorities here."} />
                <AdminInfoTile label="Public Traffic" value={`${stats.visitors24h} visitors`} detail={`${stats.returningVisitors24h} returning / ${stats.publicThreads24h} threads / ${stats.publicMessages24h} messages`} />
                <AdminInfoTile label="Deposits Recorded" value={fmtMoney(totalDeposits)} detail={`${fmtMoney(projectedRevenue)} projected pipeline with ${stats.sharedContacts} shared contacts in the last 24 hours.`} />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <QuickJump href="/admin/portal/puppies" title="Puppies" detail="Listings, lineage, assignments" />
                <QuickJump href="/admin/portal/payments" title="Payments" detail="Revenue, balances, plans" />
                <QuickJump href="/admin/portal/dams-sires" title="Dams & Sires" detail="Profiles and output" />
                <QuickJump href="/admin/portal/transportation" title="Transportation" detail="Pickup and delivery queue" />
                <QuickJump href="/admin/portal/settings" title="Settings" detail="Rules and system config" />
              </div>
            </AdminPanel>

            <AdminPanel title="Recent Buyer Conversations" subtitle="A compact view of the newest buyer threads so the overview still feels operational.">
              {stats.buyerConversationSummaries.length ? (
                <div className="space-y-3">
                  {stats.buyerConversationSummaries.slice(0, 5).map((item) => (
                    <Link key={item.key} href="/admin/portal/messages" className="block rounded-[22px] border border-[#ead9c7] bg-[#fffaf4] px-4 py-4 transition hover:border-[#d8b48b] hover:bg-white">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0"><div className="truncate text-sm font-semibold text-[#2f2218]">{item.subject}</div><div className="mt-1 truncate text-xs text-[#8a6a49]">{item.email || "No email on file"}</div></div>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${item.unreadCount > 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{item.unreadCount > 0 ? `${item.unreadCount} unread` : "up to date"}</span>
                      </div>
                      <div className="mt-3 text-sm leading-6 text-[#73583f]">{item.preview}</div>
                    </Link>
                  ))}
                </div>
              ) : <AdminEmptyState title="No buyer conversations yet" description="Buyer inbox threads will appear here once the portal starts receiving messages." />}
            </AdminPanel>
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}

function QuickJump({ href, title, detail }: { href: string; title: string; detail: string }) {
  return (
    <Link href={href} className="rounded-[20px] border border-[#ead9c7] bg-[#fffaf4] px-4 py-4 transition hover:border-[#d8b48b] hover:bg-white">
      <div className="text-sm font-semibold text-[#2f2218]">{title}</div>
      <div className="mt-1 text-xs leading-5 text-[#8a6a49]">{detail}</div>
    </Link>
  );
}

function MiniSnapshot({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#ead9c7] bg-white px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9c7043]">{label}</div>
      <div className="mt-2 text-sm font-semibold text-[#2f2218]">{value}</div>
    </div>
  );
}
