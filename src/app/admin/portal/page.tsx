"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { sb, T, fmtMoney, fmtDate, buildPuppyPhotoUrl } from "@/lib/utils";

type AdminTab =
  | "overview"
  | "families"
  | "applications"
  | "puppies"
  | "messages"
  | "documents"
  | "financials"
  | "resources"
  | "settings";

type DashboardStats = {
  buyersCount: number;
  applicationsCount: number;
  pendingApplicationsCount: number;
  puppiesCount: number;
  assignedPuppiesCount: number;
  messagesCount: number;
  documentsCount: number;
  revenuePotential: number;
};

type DashboardData = {
  stats: DashboardStats;
  recentApplications: any[];
  recentBuyers: any[];
  recentMessages: any[];
  recentPuppies: any[];
};

type AdminTabItem = {
  id: AdminTab;
  label: string;
  icon: string;
  desc: string;
};

const ADMIN_TABS: AdminTabItem[] = [
  {
    id: "overview",
    label: "Overview",
    icon: "✨",
    desc: "Main admin dashboard and portal snapshot",
  },
  {
    id: "families",
    label: "Families",
    icon: "👨‍👩‍👧",
    desc: "Buyers, families, and linked accounts",
  },
  {
    id: "applications",
    label: "Applications",
    icon: "📝",
    desc: "Review submitted applications and statuses",
  },
  {
    id: "puppies",
    label: "Puppies",
    icon: "🐾",
    desc: "Assignments, matches, statuses, and pupdates",
  },
  {
    id: "messages",
    label: "Messages",
    icon: "💬",
    desc: "Portal communication and breeder replies",
  },
  {
    id: "documents",
    label: "Documents",
    icon: "📄",
    desc: "Contracts, files, uploads, and portal paperwork",
  },
  {
    id: "financials",
    label: "Financials",
    icon: "💳",
    desc: "Prices, payment tracking, and balances",
  },
  {
    id: "resources",
    label: "Resources",
    icon: "📚",
    desc: "Portal resource center and educational content",
  },
  {
    id: "settings",
    label: "Settings",
    icon: "⚙️",
    desc: "Portal behavior, labels, and admin preferences",
  },
];

function statusPill(statusRaw: any) {
  const raw = String(statusRaw || "").trim();
  const s = raw.toLowerCase();

  let cls = "bg-stone-100 text-stone-700 border border-stone-200";
  let label = raw || "Pending";

  if (
    ["approved", "complete", "completed", "matched", "active", "reserved"].some((x) =>
      s.includes(x)
    )
  ) {
    cls = "bg-emerald-50 text-emerald-700 border border-emerald-200";
  } else if (
    ["pending", "review", "processing", "await", "in progress", "submitted"].some((x) =>
      s.includes(x)
    )
  ) {
    cls = "bg-amber-50 text-amber-700 border border-amber-200";
  } else if (["denied", "rejected", "cancel"].some((x) => s.includes(x))) {
    cls = "bg-rose-50 text-rose-700 border border-rose-200";
  }

  return { cls, label };
}

export default function AdminPortalPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [data, setData] = useState<DashboardData | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const {
          data: { session },
        } = await sb.auth.getSession();

        if (!mounted) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          await loadDashboard();
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: authListener } = sb.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await loadDashboard();
      } else {
        setData(null);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function getCount(
    tableName: string,
    build?: (query: any) => any
  ): Promise<number> {
    try {
      let q = sb.from(tableName).select("*", { count: "exact", head: true });
      if (build) q = build(q);
      const res = await q;
      return res.error ? 0 : res.count || 0;
    } catch {
      return 0;
    }
  }

  async function loadDashboard() {
    const emptyStats: DashboardStats = {
      buyersCount: 0,
      applicationsCount: 0,
      pendingApplicationsCount: 0,
      puppiesCount: 0,
      assignedPuppiesCount: 0,
      messagesCount: 0,
      documentsCount: 0,
      revenuePotential: 0,
    };

    let stats = { ...emptyStats };
    let recentApplications: any[] = [];
    let recentBuyers: any[] = [];
    let recentMessages: any[] = [];
    let recentPuppies: any[] = [];

    try {
      stats.buyersCount = await getCount("buyers");

      stats.applicationsCount = await getCount(T.applications);

      stats.pendingApplicationsCount = await getCount(T.applications, (q) =>
        q.or(
          "status.ilike.%pending%,status.ilike.%review%,application_status.ilike.%pending%,application_status.ilike.%review%,application_status.ilike.%submitted%"
        )
      );

      stats.puppiesCount = await getCount("puppies");

      stats.assignedPuppiesCount = await getCount("puppies", (q) =>
        q.or(
          "status.ilike.%reserved%,status.ilike.%matched%,status.ilike.%active%,assignment_status.ilike.%matched%,assignment_status.ilike.%assigned%"
        )
      );

      stats.messagesCount = await getCount(T.messages);

      for (const tableName of ["documents", "portal_documents", "buyer_documents"]) {
        const count = await getCount(tableName);
        if (count > 0) {
          stats.documentsCount = count;
          break;
        }
      }

      try {
        const puppyRevenueRes = await sb
          .from("puppies")
          .select("price,total_price,adoption_fee")
          .limit(500);

        if (!puppyRevenueRes.error) {
          stats.revenuePotential = (puppyRevenueRes.data || []).reduce((sum: number, row: any) => {
            const value =
              Number(row?.price || 0) ||
              Number(row?.total_price || 0) ||
              Number(row?.adoption_fee || 0) ||
              0;
            return sum + value;
          }, 0);
        }
      } catch {
        stats.revenuePotential = 0;
      }

      try {
        const appsRes = await sb
          .from(T.applications)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(6);

        if (!appsRes.error) recentApplications = appsRes.data || [];
      } catch {
        recentApplications = [];
      }

      try {
        const buyersRes = await sb
          .from("buyers")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(6);

        if (!buyersRes.error) recentBuyers = buyersRes.data || [];
      } catch {
        recentBuyers = [];
      }

      try {
        const messagesRes = await sb
          .from(T.messages)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(6);

        if (!messagesRes.error) recentMessages = messagesRes.data || [];
      } catch {
        recentMessages = [];
      }

      try {
        const puppiesRes = await sb
          .from("puppies")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(6);

        if (!puppiesRes.error) recentPuppies = puppiesRes.data || [];
      } catch {
        recentPuppies = [];
      }
    } catch {
      // keep fallback values
    }

    setData({
      stats,
      recentApplications,
      recentBuyers,
      recentMessages,
      recentPuppies,
    });
  }

  const filteredTabs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ADMIN_TABS;
    return ADMIN_TABS.filter(
      (tab) =>
        tab.label.toLowerCase().includes(q) ||
        tab.desc.toLowerCase().includes(q)
    );
  }, [search]);

  const activeTabMeta =
    ADMIN_TABS.find((tab) => tab.id === activeTab) || ADMIN_TABS[0];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50 text-brand-700 italic">
        Loading admin portal...
      </div>
    );
  }

  if (!user) {
    return <AdminLoginPrompt />;
  }

  const stats = data?.stats || {
    buyersCount: 0,
    applicationsCount: 0,
    pendingApplicationsCount: 0,
    puppiesCount: 0,
    assignedPuppiesCount: 0,
    messagesCount: 0,
    documentsCount: 0,
    revenuePotential: 0,
  };

  return (
    <div className="min-h-screen bg-brand-50 text-brand-900">
      <main className="relative flex min-h-screen bg-texturePaper">
        <aside className="hidden xl:flex xl:w-[320px] shrink-0 border-r border-brand-200/70 bg-white/65 backdrop-blur-sm">
          <div className="flex h-screen w-full flex-col px-5 py-6">
            <div className="rounded-[28px] border border-brand-200 bg-gradient-to-br from-[#fff8f2] via-[#fffdfb] to-white p-5 shadow-paper">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3 py-2">
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                  Admin Portal
                </span>
              </div>

              <h1 className="mt-5 font-serif text-3xl font-bold leading-[0.98] text-brand-900">
                Portal Control Center
              </h1>

              <p className="mt-3 text-sm font-semibold leading-7 text-brand-500">
                Manage families, applications, puppies, communication, documents,
                and the overall portal experience from one dashboard.
              </p>
            </div>

            <div className="mt-5">
              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
                Search Areas
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Applications, puppies, messages..."
                className="w-full rounded-2xl border border-brand-200 bg-white px-4 py-3 text-sm text-brand-900 outline-none transition focus:border-brand-400"
              />
            </div>

            <div className="mt-5 flex-1 space-y-2 overflow-y-auto pr-1">
              {filteredTabs.map((tab) => {
                const active = tab.id === activeTab;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full rounded-[22px] border px-4 py-4 text-left transition ${
                      active
                        ? "border-brand-300 bg-gradient-to-r from-[#fff5ea] via-white to-[#fffaf4] shadow-paper"
                        : "border-transparent bg-white/60 hover:border-brand-200 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-brand-200 bg-white text-lg">
                        {tab.icon}
                      </div>

                      <div className="min-w-0">
                        <div className="text-sm font-black text-brand-900">
                          {tab.label}
                        </div>
                        <div className="mt-1 text-[12px] font-semibold leading-6 text-brand-500">
                          {tab.desc}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-[24px] border border-brand-200 bg-[#6b4d33] p-5 text-white shadow-luxury">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f4d7b3]">
                Quick Links
              </div>

              <div className="mt-4 space-y-3">
                <SidebarMiniLink href="/portal" label="Open Buyer Portal" />
                <SidebarMiniLink href="/admin" label="Main Admin" />
                <SidebarMiniLink href="/admin/portal" label="Refresh Admin View" />
                <SidebarMiniLink href="/admin/portal/assistant" label="Open ChiChi Console" />
              </div>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <div className="mx-auto flex w-full max-w-[1700px] flex-col px-4 py-4 md:px-8 md:py-6 lg:px-10 lg:py-8">
            <header className="rounded-[32px] border border-brand-200 bg-gradient-to-br from-[#fff8f1] via-[#fffefc] to-white p-6 shadow-paper md:p-8">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-4 py-2 shadow-sm">
                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                      Southwest Virginia Chihuahua
                    </span>
                    <span className="h-1 w-1 rounded-full bg-brand-300" />
                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                      Admin UI
                    </span>
                  </div>

                  <h2 className="mt-5 font-serif text-4xl font-bold leading-[0.96] text-brand-900 md:text-5xl">
                    {activeTabMeta.label}
                  </h2>

                  <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-brand-500 md:text-base">
                    {activeTabMeta.desc}. This page is set up as the admin shell so
                    each area can now be built out cleanly one section at a time.
                  </p>
                </div>

                <div className="flex flex-col items-stretch gap-3 xl:items-end">
                  <Link
                    href="/admin/portal/assistant"
                    className="inline-flex items-center justify-center rounded-[18px] border border-brand-200 bg-white px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-brand-700 transition hover:bg-brand-50"
                  >
                    Open ChiChi Console
                  </Link>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:w-[520px]">
                    <KpiPill label="Families" value={String(stats.buyersCount)} />
                    <KpiPill
                      label="Applications"
                      value={String(stats.applicationsCount)}
                    />
                    <KpiPill label="Puppies" value={String(stats.puppiesCount)} />
                    <KpiPill label="Messages" value={String(stats.messagesCount)} />
                  </div>
                </div>
              </div>

              <div className="mt-6 xl:hidden">
                <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
                  {ADMIN_TABS.map((tab) => {
                    const active = tab.id === activeTab;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`shrink-0 rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] transition ${
                          active
                            ? "border-brand-300 bg-brand-800 text-white"
                            : "border-brand-200 bg-white text-brand-600"
                        }`}
                      >
                        {tab.icon} {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </header>

            <div className="mt-6">
              {activeTab === "overview" ? (
                <OverviewPanel data={data} />
              ) : (
                <PlaceholderTabPanel tab={activeTabMeta} stats={stats} />
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function OverviewPanel({ data }: { data: DashboardData | null }) {
  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon="👨‍👩‍👧"
          label="Families"
          value={String(stats?.buyersCount || 0)}
          sub="Portal-linked buyer records"
        />
        <StatCard
          icon="📝"
          label="Pending Applications"
          value={String(stats?.pendingApplicationsCount || 0)}
          sub="Need review or next action"
        />
        <StatCard
          icon="🐾"
          label="Assigned Puppies"
          value={String(stats?.assignedPuppiesCount || 0)}
          sub="Matched or reserved puppies"
        />
        <StatCard
          icon="💰"
          label="Revenue Potential"
          value={stats?.revenuePotential ? fmtMoney(stats.revenuePotential) : "—"}
          sub="Based on current puppy pricing"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8 card-luxury overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-7 md:p-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-100 px-3 py-1">
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-700">
                  Portal Health
                </span>
              </div>

              <h3 className="mt-5 font-serif text-3xl font-bold leading-[1.02] text-brand-900 md:text-4xl">
                A cleaner admin experience for managing the full portal.
              </h3>

              <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-brand-600 md:text-base">
                This admin screen is designed as the command center for buyers,
                applications, puppies, messages, documents, financials, and future
                automation. Each section now has a dedicated tab so we can build the
                internals without cluttering the whole system.
              </p>

              <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FeatureCard
                  title="Portal-first structure"
                  desc="Every major admin area now has a defined place so future pages stay organized."
                />
                <FeatureCard
                  title="Faster visibility"
                  desc="Counts, recent activity, and quick actions stay visible from the overview."
                />
                <FeatureCard
                  title="Breeder-friendly flow"
                  desc="Designed around the real workflow: inquiry, application, match, documents, payments, go-home."
                />
                <FeatureCard
                  title="Build-ready tabs"
                  desc="Each tab can now be expanded one by one without reworking the layout."
                />
              </div>
            </div>

            <div className="border-t border-brand-100 bg-gradient-to-br from-[#fff8f1] via-[#f8efe4] to-[#efe2d2] p-7 lg:border-l lg:border-t-0">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                Quick Summary
              </div>

              <div className="mt-4 space-y-3">
                <SummaryLine
                  label="Families"
                  value={`${stats?.buyersCount || 0} record(s)`}
                />
                <SummaryLine
                  label="Applications"
                  value={`${stats?.applicationsCount || 0} total`}
                />
                <SummaryLine
                  label="Messages"
                  value={`${stats?.messagesCount || 0} total`}
                />
                <SummaryLine
                  label="Documents"
                  value={`${stats?.documentsCount || 0} file(s)`}
                />
              </div>

              <div className="mt-5 rounded-[24px] border border-brand-200 bg-white/70 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
                  Next Build Step
                </div>
                <div className="mt-2 text-sm font-semibold leading-7 text-brand-800">
                  Pick any tab and we can build that admin section in full next.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-4 card-luxury p-7 bg-gradient-to-br from-[#fffaf4] via-white to-[#fffdfb]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                Admin Shortcuts
              </div>
              <h4 className="mt-2 font-serif text-2xl font-bold text-brand-900">
                Quick Access
              </h4>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <QuickAdminLink
              title="Families"
              desc="View buyer records and linked portal accounts."
            />
            <QuickAdminLink
              title="Applications"
              desc="Review the newest submissions and statuses."
            />
            <QuickAdminLink
              title="Puppies"
              desc="Check assignments, matches, and profile readiness."
            />
            <QuickAdminLink
              title="Documents"
              desc="Open agreements, forms, and stored files."
            />
            <QuickAdminLink
              title="Financials"
              desc="Review prices, totals, and payment-related data."
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-6 card-luxury p-7">
          <SectionHeader
            eyebrow="Recent Activity"
            title="Applications"
            actionLabel="Build Applications Tab"
          />

          <div className="mt-5 space-y-3">
            {data?.recentApplications?.length ? (
              data.recentApplications.map((app: any) => {
                const pill = statusPill(app?.status || app?.application_status);
                return (
                  <div
                    key={app.id}
                    className="rounded-[24px] border border-brand-200 bg-white/75 p-4 transition hover:bg-white"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-black text-brand-900">
                          {app?.full_name ||
                            app?.applicant_name ||
                            app?.name ||
                            app?.email ||
                            "Applicant"}
                        </div>
                        <div className="mt-1 text-[12px] font-semibold text-brand-500">
                          {app?.email || app?.applicant_email || "No email on file"}
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${pill.cls}`}
                      >
                        <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                        {pill.label}
                      </span>
                    </div>

                    <div className="mt-3 text-[11px] font-semibold text-brand-400">
                      Submitted {fmtDate(app?.created_at)}
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyCard text="No recent applications found." />
            )}
          </div>
        </div>

        <div className="xl:col-span-6 card-luxury p-7">
          <SectionHeader
            eyebrow="Recent Activity"
            title="Families"
            actionLabel="Build Families Tab"
          />

          <div className="mt-5 space-y-3">
            {data?.recentBuyers?.length ? (
              data.recentBuyers.map((buyer: any) => (
                <div
                  key={buyer.id}
                  className="rounded-[24px] border border-brand-200 bg-white/75 p-4 transition hover:bg-white"
                >
                  <div className="text-sm font-black text-brand-900">
                    {buyer?.full_name || buyer?.name || buyer?.email || "Buyer"}
                  </div>
                  <div className="mt-1 text-[12px] font-semibold text-brand-500">
                    {buyer?.email || buyer?.buyer_email || "No email on file"}
                  </div>
                  <div className="mt-3 text-[11px] font-semibold text-brand-400">
                    Added {fmtDate(buyer?.created_at)}
                  </div>
                </div>
              ))
            ) : (
              <EmptyCard text="No recent families found." />
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7 card-luxury p-7">
          <SectionHeader
            eyebrow="Communication"
            title="Recent Messages"
            actionLabel="Build Messages Tab"
          />

          <div className="mt-5 space-y-3">
            {data?.recentMessages?.length ? (
              data.recentMessages.map((msg: any) => (
                <div
                  key={msg.id}
                  className="rounded-[24px] border border-brand-200 bg-white/75 p-4 transition hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-black text-brand-900">
                        {msg?.sender_name ||
                          msg?.sender ||
                          msg?.from_name ||
                          msg?.email ||
                          "Portal Message"}
                      </div>
                      <div className="mt-1 text-[12px] font-semibold text-brand-500">
                        {msg?.user_email || msg?.email || "No linked email"}
                      </div>
                    </div>

                    <div className="shrink-0 text-[11px] font-semibold text-brand-400">
                      {fmtDate(msg?.created_at || msg?.sent_at)}
                    </div>
                  </div>

                  <div className="mt-3 line-clamp-2 text-sm font-semibold leading-7 text-brand-800">
                    {msg?.message || msg?.content || msg?.body || msg?.text || "—"}
                  </div>
                </div>
              ))
            ) : (
              <EmptyCard text="No recent messages found." />
            )}
          </div>
        </div>

        <div className="xl:col-span-5 card-luxury p-7">
          <SectionHeader
            eyebrow="Puppies"
            title="Recent Puppy Records"
            actionLabel="Build Puppies Tab"
          />

          <div className="mt-5 space-y-4">
            {data?.recentPuppies?.length ? (
              data.recentPuppies.map((puppy: any) => {
                const image =
                  buildPuppyPhotoUrl(
                    puppy?.image_url ||
                      puppy?.image_path ||
                      puppy?.photo_url ||
                      puppy?.photo ||
                      puppy?.image
                  ) || "";

                const pill = statusPill(
                  puppy?.status || puppy?.assignment_status || "Pending"
                );

                return (
                  <div
                    key={puppy.id}
                    className="flex gap-4 rounded-[24px] border border-brand-200 bg-white/75 p-4 transition hover:bg-white"
                  >
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-[20px] border border-brand-200 bg-brand-100">
                      {image ? (
                        <img
                          src={image}
                          alt="Puppy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-2xl">
                          🐾
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-black text-brand-900">
                            {puppy?.call_name ||
                              puppy?.puppy_name ||
                              puppy?.name ||
                              "Unnamed Puppy"}
                          </div>
                          <div className="mt-1 text-[12px] font-semibold text-brand-500">
                            {puppy?.sex || puppy?.gender || "Puppy"}{" "}
                            {puppy?.color ? `• ${puppy.color}` : ""}
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${pill.cls}`}
                        >
                          <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                          {pill.label}
                        </span>
                      </div>

                      <div className="mt-3 text-[11px] font-semibold text-brand-400">
                        {puppy?.price || puppy?.total_price || puppy?.adoption_fee
                          ? fmtMoney(
                              puppy?.price ||
                                puppy?.total_price ||
                                puppy?.adoption_fee
                            )
                          : "No price"}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyCard text="No recent puppy records found." />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function PlaceholderTabPanel({
  tab,
  stats,
}: {
  tab: AdminTabItem;
  stats: DashboardStats;
}) {
  const hints: Record<AdminTab, string[]> = {
    overview: [],
    families: [
      "Search families and buyers",
      "Link users to buyer records",
      "Open profile, notes, and puppy assignment",
      "View portal readiness and account status",
    ],
    applications: [
      "Review all submissions",
      "Approve, deny, or mark pending",
      "Open full application details",
      "Convert approved applicants into matched families",
    ],
    puppies: [
      "View all puppies and statuses",
      "Assign puppies to buyers",
      "Post pupdates and milestone events",
      "Manage profile images, pricing, and go-home readiness",
    ],
    messages: [
      "View portal conversations",
      "Reply from admin",
      "Track unread or pending replies",
      "Pin important threads or notices",
    ],
    documents: [
      "Upload files and contracts",
      "Link documents to buyers or puppies",
      "Mark documents signed or pending",
      "Organize by type and stage",
    ],
    financials: [
      "View puppy pricing",
      "Track deposits and balances",
      "Show payment history and receipts",
      "See what families still owe",
    ],
    resources: [
      "Manage care guides and prep materials",
      "Pin featured resources",
      "Show role-based or stage-based content",
      "Keep portal education organized",
    ],
    settings: [
      "Portal labels and wording",
      "Status options and defaults",
      "Admin-only display preferences",
      "Future automation and integrations",
    ],
  };

  const topValue =
    tab.id === "families"
      ? String(stats.buyersCount)
      : tab.id === "applications"
        ? String(stats.applicationsCount)
        : tab.id === "puppies"
          ? String(stats.puppiesCount)
          : tab.id === "messages"
            ? String(stats.messagesCount)
            : tab.id === "documents"
              ? String(stats.documentsCount)
              : tab.id === "financials"
                ? stats.revenuePotential
                  ? fmtMoney(stats.revenuePotential)
                  : "—"
                : "Ready";

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8 card-luxury overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="p-7 md:p-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-100 px-3 py-1">
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-700">
                  {tab.label}
                </span>
              </div>

              <h3 className="mt-5 font-serif text-3xl font-bold leading-[1.02] text-brand-900 md:text-4xl">
                {tab.label} admin area is ready for build-out.
              </h3>

              <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-brand-600 md:text-base">
                This section has the layout foundation in place. We can now build
                the actual tools, tables, forms, filters, and actions for this tab
                without having to redesign the entire page again.
              </p>

              <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {hints[tab.id].map((item) => (
                  <div
                    key={item}
                    className="rounded-[22px] border border-brand-200 bg-white/75 p-4"
                  >
                    <div className="text-sm font-black text-brand-900">{item}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-brand-100 bg-gradient-to-br from-[#fff8f1] via-[#f8efe4] to-[#efe2d2] p-7 lg:border-l lg:border-t-0">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                Section Snapshot
              </div>

              <div className="mt-4 space-y-3">
                <SummaryLine label="Area" value={tab.label} />
                <SummaryLine label="Status" value="UI shell complete" />
                <SummaryLine label="Primary Metric" value={topValue} />
                <SummaryLine label="Next Step" value="Build internals" />
              </div>

              <div className="mt-5 rounded-[24px] border border-brand-200 bg-white/70 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
                  Ready
                </div>
                <div className="mt-2 text-sm font-semibold leading-7 text-brand-800">
                  This tab is intentionally staged so the next pass can focus only on
                  the real functionality.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-4 card-luxury p-7">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
            Build Queue
          </div>
          <h4 className="mt-2 font-serif text-2xl font-bold text-brand-900">
            Suggested Contents
          </h4>

          <div className="mt-5 space-y-3">
            {hints[tab.id].map((item) => (
              <div
                key={item}
                className="rounded-[22px] border border-brand-200 bg-white/75 p-4"
              >
                <div className="text-sm font-black text-brand-900">{item}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="card-luxury p-5 transition hover:-translate-y-1">
      <div className="text-2xl">{icon}</div>
      <div className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
        {label}
      </div>
      <div className="mt-1 break-words text-2xl font-black text-brand-900">
        {value}
      </div>
      <div className="mt-1 text-[12px] font-semibold text-brand-400">{sub}</div>
    </div>
  );
}

function KpiPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-brand-200 bg-white/75 px-4 py-3 shadow-sm">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-black text-brand-900">{value}</div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-brand-200 bg-white/75 px-4 py-3">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
        {label}
      </div>
      <div className="text-right text-sm font-black text-brand-900">{value}</div>
    </div>
  );
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-[22px] border border-brand-200 bg-white/75 p-4 shadow-sm">
      <div className="text-sm font-black text-brand-900">{title}</div>
      <div className="mt-1 text-[12px] font-semibold leading-6 text-brand-500">
        {desc}
      </div>
    </div>
  );
}

function QuickAdminLink({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-[22px] border border-brand-200 bg-white/75 p-4 transition hover:bg-white">
      <div className="text-sm font-black text-brand-900">{title}</div>
      <div className="mt-1 text-[12px] font-semibold leading-6 text-brand-500">
        {desc}
      </div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  actionLabel,
}: {
  eyebrow: string;
  title: string;
  actionLabel: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
          {eyebrow}
        </div>
        <h4 className="mt-2 font-serif text-2xl font-bold text-brand-900">
          {title}
        </h4>
      </div>

      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-400">
        {actionLabel}
      </div>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-brand-200 bg-white/60 px-5 py-10 text-center text-sm italic text-brand-400">
      {text}
    </div>
  );
}

function SidebarMiniLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15"
    >
      {label}
    </Link>
  );
}

function AdminLoginPrompt() {
  return (
    <div className="min-h-screen bg-[#f7f3ee] px-4 py-10 md:px-8">
      <div className="mx-auto max-w-[960px]">
        <div className="overflow-hidden rounded-[36px] border border-[#e7d9c8] bg-gradient-to-br from-[#fff8f1] via-[#fffdfb] to-white shadow-[0_30px_80px_rgba(88,63,37,0.12)]">
          <div className="px-8 py-10 md:px-12 md:py-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dcc6ad] bg-white/70 px-4 py-2 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#a47946]">
                Admin Access Required
              </span>
            </div>

            <h1 className="mt-6 font-serif text-4xl font-bold leading-[0.98] text-[#3e2a1f] md:text-5xl">
              Sign in to access the portal admin area.
            </h1>

            <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-[#7a5a3a] md:text-base">
              This page is the internal portal management area for buyers,
              applications, puppies, messages, documents, and future admin tools.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/portal"
                className="inline-flex items-center gap-2 rounded-[18px] bg-[#6b4d33] px-6 py-4 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_14px_30px_rgba(88,63,37,0.18)] transition hover:bg-[#5b412c]"
              >
                Open Portal Login <span aria-hidden="true">→</span>
              </Link>

              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-[18px] border border-[#e4d3c2] bg-white px-6 py-4 text-xs font-black uppercase tracking-[0.18em] text-[#6b4d33] transition hover:bg-[#fffaf4]"
              >
                Back Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
