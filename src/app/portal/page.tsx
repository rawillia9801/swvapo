"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { sb, T, fmtMoney, fmtDate, buildPuppyPhotoUrl } from "@/lib/utils";

type PortalData = {
  buyer: BuyerRow | null;
  app: any | null;
  puppy: any | null;
  msgs: any[];
  updates: any[];
  docCount: number;
};

type BuyerRow = {
  id: number;
  email: string | null;
  buyer_email?: string | null;
  full_name?: string | null;
  name?: string | null;
  user_id?: string | null;
};

type NextStep = {
  icon: string;
  title: string;
  desc: string;
  href: string;
  cta: string;
};

function statusPill(statusRaw: any, type?: "application" | "puppy") {
  const raw = String(statusRaw || "").trim();
  const s = raw.toLowerCase();

  let cls = "bg-stone-100 text-stone-700 border border-stone-200";
  let label = raw || "Status";

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

  if (!raw && type === "application") label = "Pending";
  if (!raw && type === "puppy") label = "Pending Match";

  return { cls, label };
}

function nextSteps(hasApp: boolean, hasPuppy: boolean): NextStep[] {
  if (hasPuppy) {
    return [
      {
        icon: "🐾",
        title: "My Puppy",
        desc: "See your puppy profile, milestones, photos, and breeder updates.",
        href: "/portal/mypuppy",
        cta: "Open My Puppy",
      },
      {
        icon: "📄",
        title: "Documents",
        desc: "Review contracts, portal files, and anything that needs your attention.",
        href: "/portal/documents",
        cta: "Open Documents",
      },
      {
        icon: "💬",
        title: "Messages",
        desc: "Check breeder updates and send questions anytime.",
        href: "/portal/messages",
        cta: "Open Messages",
      },
      {
        icon: "📚",
        title: "Resources",
        desc: "Open care guides, prep materials, and important puppy information.",
        href: "/portal/resources",
        cta: "Open Resources",
      },
    ];
  }

  if (hasApp) {
    return [
      {
        icon: "✅",
        title: "Application",
        desc: "Your application is on file. Review it or update details if needed.",
        href: "/portal/application",
        cta: "View Application",
      },
      {
        icon: "💬",
        title: "Messages",
        desc: "We’ll use messages for questions, updates, and next steps.",
        href: "/portal/messages",
        cta: "Open Messages",
      },
      {
        icon: "📄",
        title: "Documents",
        desc: "Read through agreements and stay ready as your process moves forward.",
        href: "/portal/documents",
        cta: "View Documents",
      },
      {
        icon: "📚",
        title: "Resources",
        desc: "Start preparing now with feeding, safety, and first-week guidance.",
        href: "/portal/resources",
        cta: "Open Resources",
      },
    ];
  }

  return [
    {
      icon: "📝",
      title: "Start Application",
      desc: "Begin your puppy journey and submit your information for review.",
      href: "/portal/application",
      cta: "Start Application",
    },
    {
      icon: "📄",
      title: "Read Policies",
      desc: "Review expectations, agreements, and important details up front.",
      href: "/portal/documents",
      cta: "Open Documents",
    },
    {
      icon: "📚",
      title: "Learn the Basics",
      desc: "Open care resources and puppy preparation information.",
      href: "/portal/resources",
      cta: "Open Resources",
    },
    {
      icon: "💬",
      title: "Ask a Question",
      desc: "Use messages anytime if you need help or clarification.",
      href: "/portal/messages",
      cta: "Open Messages",
    },
  ];
}

export default function PortalPage() {
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const {
          data: { session },
        } = await sb.auth.getSession();

        if (!mounted) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          await loadData(currentUser);
        } else {
          setData(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: authListener } = sb.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;
        if (!mounted) return;

        setUser(currentUser);

        if (currentUser) {
          await loadData(currentUser);
        } else {
          setData(null);
        }

        setLoading(false);
      }
    );

    const onStorage = async (e: StorageEvent) => {
      if (!String(e.key || "").includes("supabase")) return;

      const {
        data: { session },
      } = await sb.auth.getSession();

      const currentUser = session?.user ?? null;
      if (!mounted) return;

      setUser(currentUser);

      if (currentUser) {
        await loadData(currentUser);
      } else {
        setData(null);
      }
    };

    window.addEventListener("storage", onStorage);

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  async function findBuyer(uid: string | undefined, email: string): Promise<BuyerRow | null> {
    if (uid) {
      try {
        const byUserId = await sb
          .from("buyers")
          .select("*")
          .eq("user_id", uid)
          .limit(1)
          .maybeSingle();

        if (!byUserId.error && byUserId.data) {
          return byUserId.data as BuyerRow;
        }
      } catch {}
    }

    if (email) {
      try {
        const byEmail = await sb
          .from("buyers")
          .select("*")
          .ilike("email", email)
          .limit(1)
          .maybeSingle();

        if (!byEmail.error && byEmail.data) {
          return byEmail.data as BuyerRow;
        }
      } catch {}

      try {
        const byBuyerEmail = await sb
          .from("buyers")
          .select("*")
          .ilike("buyer_email", email)
          .limit(1)
          .maybeSingle();

        if (!byBuyerEmail.error && byBuyerEmail.data) {
          return byBuyerEmail.data as BuyerRow;
        }
      } catch {}
    }

    return null;
  }

  async function findApplication(uid: string | undefined, email: string) {
    const tableName = T.applications;

    if (uid) {
      try {
        const byUserId = await sb
          .from(tableName)
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!byUserId.error && byUserId.data) return byUserId.data;
      } catch {}
    }

    if (email) {
      try {
        const byEmail = await sb
          .from(tableName)
          .select("*")
          .ilike("email", email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!byEmail.error && byEmail.data) return byEmail.data;
      } catch {}

      try {
        const byApplicantEmail = await sb
          .from(tableName)
          .select("*")
          .ilike("applicant_email", email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!byApplicantEmail.error && byApplicantEmail.data) return byApplicantEmail.data;
      } catch {}
    }

    return null;
  }

  async function findPuppy(buyerId: number | undefined, email: string) {
    if (buyerId) {
      try {
        const byBuyer = await sb
          .from("puppies")
          .select("*")
          .eq("buyer_id", buyerId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!byBuyer.error && byBuyer.data) return byBuyer.data;
      } catch {}
    }

    if (email) {
      try {
        const byOwnerEmail = await sb
          .from("puppies")
          .select("*")
          .ilike("owner_email", email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!byOwnerEmail.error && byOwnerEmail.data) return byOwnerEmail.data;
      } catch {}
    }

    return null;
  }

  async function findMessages(uid: string | undefined, email: string) {
    const tableName = T.messages;

    if (uid) {
      try {
        const byUserId = await sb
          .from(tableName)
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(5);

        if (!byUserId.error && byUserId.data?.length) {
          return byUserId.data;
        }
      } catch {}
    }

    if (email) {
      try {
        const byEmail = await sb
          .from(tableName)
          .select("*")
          .ilike("email", email)
          .order("created_at", { ascending: false })
          .limit(5);

        if (!byEmail.error && byEmail.data?.length) {
          return byEmail.data;
        }
      } catch {}

      try {
        const byUserEmail = await sb
          .from(tableName)
          .select("*")
          .ilike("user_email", email)
          .order("created_at", { ascending: false })
          .limit(5);

        if (!byUserEmail.error && byUserEmail.data?.length) {
          return byUserEmail.data;
        }
      } catch {}
    }

    return [];
  }

  async function findDocumentCount(
    buyer: BuyerRow | null,
    uid: string | undefined,
    email: string
  ) {
    const docTables = ["documents", "portal_documents", "buyer_documents"];

    for (const tableName of docTables) {
      try {
        if (buyer?.id) {
          const byBuyerId = await sb
            .from(tableName)
            .select("*", { count: "exact", head: true })
            .eq("buyer_id", buyer.id);

          if (!byBuyerId.error) return byBuyerId.count || 0;
        }
      } catch {}

      try {
        if (uid) {
          const byUserId = await sb
            .from(tableName)
            .select("*", { count: "exact", head: true })
            .eq("user_id", uid);

          if (!byUserId.error) return byUserId.count || 0;
        }
      } catch {}

      try {
        if (email) {
          const byEmail = await sb
            .from(tableName)
            .select("*", { count: "exact", head: true })
            .ilike("email", email);

          if (!byEmail.error) return byEmail.count || 0;
        }
      } catch {}

      try {
        if (email) {
          const byBuyerEmail = await sb
            .from(tableName)
            .select("*", { count: "exact", head: true })
            .ilike("buyer_email", email);

          if (!byBuyerEmail.error) return byBuyerEmail.count || 0;
        }
      } catch {}
    }

    return 0;
  }

  async function findUpdates(puppyId: number | undefined) {
    if (!puppyId) return [];

    try {
      const updatesRes = await sb
        .from("puppy_events")
        .select("*")
        .eq("puppy_id", puppyId)
        .order("event_date", { ascending: true });

      if (updatesRes.error) return [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return (updatesRes.data || []).filter((u: any) => {
        const eventDate = new Date(u.event_date || u.created_at);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate.getTime() <= today.getTime();
      });
    } catch {
      return [];
    }
  }

  async function loadData(currUser: any) {
    const email = String(currUser?.email || "").trim().toLowerCase();
    const uid = currUser?.id as string | undefined;

    const fallback: PortalData = {
      buyer: null,
      app: null,
      puppy: null,
      msgs: [],
      updates: [],
      docCount: 0,
    };

    try {
      const buyer = await findBuyer(uid, email);
      const app = await findApplication(uid, email);
      const puppy = await findPuppy(buyer?.id, email);
      const msgs = await findMessages(uid, email);
      const docCount = await findDocumentCount(buyer, uid, email);
      const updates = await findUpdates(puppy?.id);

      setData({
        buyer,
        app,
        puppy,
        msgs: msgs || [],
        updates: updates || [],
        docCount: docCount || 0,
      });
    } catch {
      setData(fallback);
    }
  }

  const hasPuppy = !!data?.puppy;
  const hasApp = !!data?.app;

  const appStatus = statusPill(
    data?.app?.status || data?.app?.application_status,
    "application"
  );

  const puppyStatus = statusPill(
    data?.puppy?.status ||
      data?.puppy?.assignment_status ||
      (hasPuppy ? "In Progress" : "Pending Match"),
    "puppy"
  );

  const greetingName =
    data?.buyer?.full_name ||
    data?.buyer?.name ||
    user?.user_metadata?.full_name ||
    "Family";

  const puppyImage =
    buildPuppyPhotoUrl(
      data?.puppy?.image_url ||
        data?.puppy?.image_path ||
        data?.puppy?.photo_url ||
        data?.puppy?.photo ||
        data?.puppy?.image
    ) ||
    "https://images.unsplash.com/photo-1591769225440-811ad7d6eca6?auto=format&fit=crop&w=1200&q=80";

  const primaryHref = hasPuppy ? "/portal/mypuppy" : "/portal/application";
  const primaryLabel = hasPuppy
    ? "Open My Puppy"
    : hasApp
      ? "View Application"
      : "Start Application";

  const financialValue =
    data?.puppy?.balance || data?.puppy?.balance === 0
      ? fmtMoney(data.puppy.balance)
      : data?.puppy?.price || data?.puppy?.total_price || data?.puppy?.adoption_fee
        ? fmtMoney(
            data?.puppy?.price || data?.puppy?.total_price || data?.puppy?.adoption_fee
          )
        : "—";

  const puppyDisplayName =
    data?.puppy?.call_name || data?.puppy?.puppy_name || data?.puppy?.name || "My Puppy";

  const recentUpdates =
    data?.updates?.length
      ? data.updates.slice(0, 2).map((u: any) => ({
          id: String(u.id),
          title: u.title || u.label || u.name || "Update",
          date: fmtDate(u.event_date || u.created_at || u.date),
        }))
      : [];

  const nextUpdateLabel =
    recentUpdates[0]?.date ||
    (hasPuppy ? "Check My Puppy" : hasApp ? "Watch Messages" : "Portal updates");

  const recentMessages = data?.msgs?.slice(0, 3) || [];
  const actionSteps = nextSteps(hasApp, hasPuppy);

  const overviewCards = [
    {
      label: "Application",
      value: data?.app?.status || data?.app?.application_status || "Not started",
      sub: data?.app?.created_at
        ? `Submitted ${fmtDate(data.app.created_at)}`
        : "Complete when ready",
      href: "/portal/application",
      icon: "✓",
    },
    {
      label: "Latest Update",
      value: nextUpdateLabel,
      sub:
        recentUpdates[0]?.title ||
        (hasPuppy
          ? "Breeder updates and milestones appear here."
          : hasApp
            ? "Stay in touch with us through the portal."
            : "Complete your portal setup."),
      href: hasPuppy ? "/portal/mypuppy" : hasApp ? "/portal/messages" : "/portal/application",
      icon: "→",
    },
    {
      label: "Balance",
      value: financialValue,
      sub: "Open payments for details",
      href: "/portal/payments",
      icon: "$",
    },
    {
      label: hasPuppy ? "Assigned Puppy" : "Available Puppies",
      value: hasPuppy ? puppyDisplayName : "Browse now",
      sub: hasPuppy ? "Full profile and updates" : "See current and future matches",
      href: hasPuppy ? "/portal/mypuppy" : "/portal/available-puppies",
      icon: "🐾",
    },
  ];

  const resourceTiles = [
    {
      title: "Contracts & Docs",
      desc: "Open agreements, forms, and portal records in one place.",
      href: "/portal/documents",
    },
    {
      title: "Resources",
      desc: "Helpful Chihuahua care guidance and trusted breeder links.",
      href: "/portal/resources",
    },
    {
      title: "Transporation",
      desc: "Request pickup, meet-up, or delivery details and pricing.",
      href: "/portal/transportation",
    },
  ];

  const timelineItems =
    data?.updates?.length
      ? data.updates.slice(0, 3).map((u: any) => ({
          id: String(u.id),
          title: u.title || u.label || u.name || "Update",
          date: fmtDate(u.event_date || u.created_at || u.date),
        }))
      : [
          {
            id: "placeholder-1",
            title: hasPuppy ? "Puppy profile updates will appear here" : "Puppy match updates will appear here",
            date: "Check My Puppy",
          },
          {
            id: "placeholder-2",
            title: "Messages and milestones stay organized in one place",
            date: "Portal timeline",
          },
        ];

  const spotlightMetrics = [
    {
      label: "Messages",
      value: `${recentMessages.length}`,
      detail: recentMessages.length
        ? "Recent conversations ready to review"
        : "No unread conversation pressure",
    },
    {
      label: "Documents",
      value: `${data?.docCount || 0}`,
      detail: data?.docCount
        ? "Forms, contracts, and records in one place"
        : "New files appear here automatically",
    },
    {
      label: "Updates",
      value: `${data?.updates?.length || 0}`,
      detail: hasPuppy
        ? "Milestones, breeder notes, and care updates"
        : "Profile activity will appear here",
    },
  ];
  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center rounded-[28px] border border-[#dcc9b7] bg-white text-sm font-semibold text-[#7f6144] shadow-sm">
        Loading My Puppy Portal...
      </div>
    );
  }

  if (!user) return <LoginComponent />;

  return (
    <PortalHomeDashboard
      greetingName={greetingName}
      puppyImage={puppyImage}
      primaryHref={primaryHref}
      primaryLabel={primaryLabel}
      hasPuppy={hasPuppy}
      hasApp={hasApp}
      puppyDisplayName={puppyDisplayName}
      puppyStatus={puppyStatus.label}
      appStatus={appStatus.label}
      nextUpdateLabel={nextUpdateLabel}
      financialValue={financialValue}
      overviewCards={overviewCards}
      recentMessages={recentMessages}
      timelineItems={timelineItems}
      resourceTiles={resourceTiles}
      actionSteps={actionSteps}
      spotlightMetrics={spotlightMetrics}
      docCount={data?.docCount || 0}
      totalMessages={data?.msgs?.length || 0}
    />
  );
}


function PortalHomeDashboard({
  greetingName,
  puppyImage,
  primaryHref,
  primaryLabel,
  hasPuppy,
  hasApp,
  puppyDisplayName,
  puppyStatus,
  appStatus,
  nextUpdateLabel,
  financialValue,
  overviewCards,
  recentMessages,
  timelineItems,
  resourceTiles,
  actionSteps,
  spotlightMetrics,
  docCount,
  totalMessages,
}: {
  greetingName: string;
  puppyImage: string;
  primaryHref: string;
  primaryLabel: string;
  hasPuppy: boolean;
  hasApp: boolean;
  puppyDisplayName: string;
  puppyStatus: string;
  appStatus: string;
  nextUpdateLabel: string;
  financialValue: string;
  overviewCards: Array<{ label: string; value: string; sub: string; href: string; accent?: string }>;
  recentMessages: any[];
  timelineItems: Array<{ id: string; title: string; date: string }>;
  resourceTiles: Array<{ title: string; desc: string; href: string }>;
  actionSteps: NextStep[];
  spotlightMetrics: Array<{ label: string; value: string; detail: string }>;
  docCount: number;
  totalMessages: number;
}) {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(84,120,255,0.18),transparent_26%),radial-gradient(circle_at_85%_15%,rgba(96,211,255,0.16),transparent_28%),linear-gradient(135deg,#0b1120_0%,#121a31_48%,#1b2340_100%)] p-6 shadow-[0_32px_80px_rgba(3,8,23,0.48)] md:p-8">
        <div className="absolute inset-y-0 right-0 hidden w-[34%] overflow-hidden lg:block">
          <img
            src={puppyImage}
            alt={hasPuppy ? "Portal hero puppy" : "Portal welcome puppy"}
            className="h-full w-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,23,42,1)_0%,rgba(15,23,42,0.72)_35%,rgba(15,23,42,0.18)_100%)]" />
        </div>

        <div className="relative z-10 grid gap-8 xl:grid-cols-[minmax(0,1.3fr)_360px]">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-100">
                Private Client Dashboard
              </span>
              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-slate-300">
                Southwest Virginia Chihuahua
              </span>
            </div>

            <h1 className="mt-6 max-w-3xl font-serif text-4xl font-bold leading-[1.02] text-white [font-family:var(--font-merriweather)] md:text-5xl xl:text-[56px]">
              A premium portal for your puppy journey.
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate-300 md:text-base">
              Your updates, documents, breeder communication, payment details, and puppy
              profile all live here in one polished private experience for {greetingName}.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={primaryHref}
                className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#60a5fa_0%,#7c3aed_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_38px_rgba(96,165,250,0.28)] transition hover:-translate-y-0.5"
              >
                {primaryLabel}
              </Link>
              <Link
                href="/portal/messages"
                className="inline-flex items-center rounded-2xl border border-white/10 bg-white/6 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/10"
              >
                Open Messages
              </Link>
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-3">
              {spotlightMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4 backdrop-blur-sm"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                    {metric.label}
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-white">{metric.value}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-300">{metric.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10">
            <div className="rounded-[26px] border border-white/10 bg-slate-950/45 p-5 shadow-[0_18px_42px_rgba(2,6,23,0.45)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                    Client Snapshot
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">{greetingName}</div>
                </div>
                <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                  {appStatus}
                </span>
              </div>

              <div className="mt-5 space-y-3">
                <GlassMetric
                  label="Assigned Puppy"
                  value={hasPuppy ? puppyDisplayName : "Waiting for match"}
                />
                <GlassMetric label="Portal Balance" value={financialValue} />
                <GlassMetric label="Latest Activity" value={nextUpdateLabel} />
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Experience Standard
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Built for high-touch puppy placement with organized records, proactive
                  updates, and a cleaner luxury client experience.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {overviewCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="group overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.88)_0%,rgba(15,23,42,0.72)_100%)] p-5 shadow-[0_20px_44px_rgba(2,6,23,0.26)] transition hover:-translate-y-1 hover:border-sky-300/20"
          >
            <div
              className={`h-1.5 w-full rounded-full bg-gradient-to-r ${
                card.accent || "from-slate-400/20 to-slate-500/10"
              }`}
            />
            <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              {card.label}
            </div>
            <div className="mt-3 break-words text-[28px] font-semibold leading-tight text-white">
              {card.value}
            </div>
            <div className="mt-3 text-sm leading-6 text-slate-300">{card.sub}</div>
            <div className="mt-5 text-[12px] font-semibold uppercase tracking-[0.2em] text-sky-300 transition group-hover:text-sky-200">
              Open Panel
            </div>
          </Link>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.25fr)_390px]">
        <div className="space-y-5">
          <DashboardPanel
            title="Puppy Command Center"
            subtitle={
              hasPuppy
                ? "Your puppy profile, current status, and fastest next actions."
                : "Portal setup and match readiness in one place."
            }
            actionHref={hasPuppy ? "/portal/mypuppy" : "/portal/available-puppies"}
            actionLabel={hasPuppy ? "Open My Puppy" : "Browse Puppies"}
          >
            <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
              <div className="relative min-h-[320px] overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/60">
                <img
                  src={puppyImage}
                  alt={hasPuppy ? "My puppy preview" : "Available puppies preview"}
                  className="absolute inset-0 h-full w-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.08)_0%,rgba(2,6,23,0.72)_65%,rgba(2,6,23,0.96)_100%)]" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200/90">
                    {hasPuppy ? "Assigned Puppy" : "Available Puppies"}
                  </div>
                  <div className="mt-2 font-serif text-3xl text-white [font-family:var(--font-merriweather)]">
                    {hasPuppy ? puppyDisplayName : "Your next match starts here"}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-200">
                    {hasPuppy
                      ? "Profile details, milestones, and breeder updates are organized in a single luxury experience."
                      : "Explore available puppies, monitor updates, and stay ready for the right match."}
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <InfoTile
                    label="Application Status"
                    value={appStatus}
                    detail={hasApp ? "Your portal record is active." : "Start when you are ready."}
                  />
                  <InfoTile
                    label="Puppy Status"
                    value={puppyStatus}
                    detail={
                      hasPuppy
                        ? "Current assignment is visible in My Puppy."
                        : "Assignment appears once matched."
                    }
                  />
                </div>

                <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                    Recommended Next Steps
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {actionSteps.map((step) => (
                      <Link
                        key={step.title}
                        href={step.href}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-sky-300/20 hover:bg-white/8"
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                          {step.title}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-slate-200">{step.desc}</div>
                        <div className="mt-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-sky-300">
                          {step.cta}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </DashboardPanel>

          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <DashboardPanel
              title="Recent Messages"
              subtitle="Important communication stays visible and easy to scan."
              actionHref="/portal/messages"
              actionLabel="View All"
            >
              <div className="space-y-3">
                {recentMessages.length ? (
                  recentMessages.map((m: any) => (
                    <div
                      key={m.id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-sky-300/20 hover:bg-white/7"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                            {m.sender_name || m.sender || m.from_name || "Support Team"}
                          </div>
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-100">
                            {m.message || m.content || m.body || m.text || "-"}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] font-medium text-slate-400">
                          {fmtDate(m.created_at || m.sent_at)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="No recent messages"
                    desc="When breeder messages or account updates arrive, they will appear here automatically."
                  />
                )}
              </div>
            </DashboardPanel>

            <DashboardPanel
              title="Portal Activity"
              subtitle="Updates, milestones, and client-visible timeline items."
              actionHref="/portal/updates"
              actionLabel="Open Updates"
            >
              <div className="space-y-3">
                {timelineItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                      {item.date}
                    </div>
                    <div className="mt-2 text-sm font-medium leading-6 text-slate-100">
                      {item.title}
                    </div>
                  </div>
                ))}
              </div>
            </DashboardPanel>
          </div>
        </div>

        <div className="space-y-5">
          <DashboardPanel
            title="Financial Snapshot"
            subtitle="A cleaner overview before opening full payments."
            actionHref="/portal/payments"
            actionLabel="Open Payments"
          >
            <div className="space-y-3">
              <MetricRow label="Balance Due" value={financialValue} />
              <MetricRow label="Documents Ready" value={`${docCount}`} />
              <MetricRow label="Messages Logged" value={`${totalMessages}`} />
            </div>
            <div className="mt-5 rounded-2xl border border-emerald-400/15 bg-emerald-400/8 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
                Buyer Transparency
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                Your payment history, financing details, and remaining balance stay visible
                in the payments dashboard.
              </p>
            </div>
          </DashboardPanel>

          <DashboardPanel
            title="Resource Library"
            subtitle="Quick access to guidance, transportation, and portal essentials."
            actionHref="/portal/resources"
            actionLabel="Open Resources"
          >
            <div className="space-y-3">
              {resourceTiles.map((tile) => (
                <QuickLink key={tile.title} href={tile.href} title={tile.title} desc={tile.desc} />
              ))}
            </div>
          </DashboardPanel>
        </div>
      </section>
    </div>
  );
}

function DashboardPanel({
  title,
  subtitle,
  actionHref,
  actionLabel,
  children,
}: {
  title: string;
  subtitle?: string;
  actionHref?: string;
  actionLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.82)_0%,rgba(15,23,42,0.66)_100%)] p-5 shadow-[0_20px_50px_rgba(2,6,23,0.3)] backdrop-blur-xl md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            {title}
          </div>
          {subtitle ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{subtitle}</p>
          ) : null}
        </div>
        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-200 transition hover:border-sky-300/20 hover:bg-white/10"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function GlassMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
        {label}
      </span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
        {label}
      </span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

function QuickLink({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-sky-300/20 hover:bg-white/8"
    >
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-1 text-[13px] leading-6 text-slate-300">
        {desc}
      </div>
    </Link>
  );
}

function InfoTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
      <div className="mt-2 text-sm leading-6 text-slate-300">{detail}</div>
    </div>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/4 px-5 py-10 text-center">
      <div className="text-base font-semibold text-white">{title}</div>
      <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-300">{desc}</div>
    </div>
  );
}

function PortalValueCard({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#e2cfba] bg-white/75 p-5 shadow-[0_10px_30px_rgba(88,63,37,0.06)]">
      <div className="text-lg font-black text-[#3f2b20]">{title}</div>
      <div className="mt-2 text-sm font-semibold leading-7 text-[#8a6a49]">
        {desc}
      </div>
    </div>
  );
}

function FeatureLine({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e2cfba] bg-white/70 p-4">
      <div className="text-sm font-black text-[#3f2b20]">{title}</div>
      <div className="mt-1 text-sm font-semibold leading-7 text-[#8a6a49]">
        {desc}
      </div>
    </div>
  );
}

function MiniTile({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-center text-sm font-black text-white">
      {label}
    </div>
  );
}

function LoginComponent() {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setMessage("");

    const { error } = await sb.auth.signInWithPassword({
      email,
      password,
    });

    setWorking(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Signed in.");
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setMessage("");

    const { error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    });

    setWorking(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Account created. Please check your email to confirm your account.");
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setMessage("");

    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo:
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : undefined,
    });

    setWorking(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Password reset email sent. Please check your inbox.");
  }

  return (
    <div className="min-h-[80vh] px-0 py-1">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="relative overflow-hidden rounded-[36px] border border-[#e2d4c5] bg-[linear-gradient(135deg,#fff8f1_0%,#f8efe4_55%,#efe2d2_100%)] shadow-[0_26px_70px_rgba(88,63,37,0.10)]">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-white/35 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-[#f5d9b8]/30 blur-3xl" />
          </div>

          <div className="relative z-10 px-7 py-8 md:px-10 md:py-10 lg:px-14 lg:py-14">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#dcc6ad] bg-white/70 px-4 py-2 shadow-sm">
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#a47946]">
                  Private Client Access
                </span>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-[#dcc6ad] bg-white/70 px-4 py-2 shadow-sm">
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#a47946]">
                  Southwest Virginia Chihuahua
                </span>
              </div>
            </div>

            <div className="mt-10 max-w-3xl">
              <h1 className="font-serif text-5xl font-bold leading-[0.95] text-[#3e2a1f] md:text-6xl xl:text-7xl">
                Welcome to your puppy’s private portal.
              </h1>

              <p className="mt-6 max-w-2xl text-[17px] font-semibold leading-8 text-[#7a5a3a]">
                A beautifully organized place for your application, puppy updates,
                contracts, payments, messages, and care resources — all in one secure space designed for our families.
              </p>
            </div>

            <div className="mt-10 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
              <PortalValueCard
                title="Application & Approval"
                desc="Track your status, review progress, and stay ready for next steps."
              />
              <PortalValueCard
                title="My Puppy"
                desc="Once matched, your puppy profile, milestones, and updates appear automatically."
              />
              <PortalValueCard
                title="Messages & Documents"
                desc="Open breeder messages, contracts, and important files anytime."
              />
            </div>

            <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_0.9fr]">
              <div className="rounded-[28px] border border-[#e2cfba] bg-white/78 p-6 shadow-[0_16px_40px_rgba(88,63,37,0.08)]">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#b08251]">
                  Built around transparency
                </div>

                <div className="mt-4 space-y-4">
                  <FeatureLine
                    title="Everything in one place"
                    desc="No searching through texts, emails, screenshots, or paper files."
                  />
                  <FeatureLine
                    title="Clear communication"
                    desc="Updates, notes, and breeder communication stay easy to follow."
                  />
                  <FeatureLine
                    title="Straightforward access"
                    desc="Application, documents, payment details, and resources stay visible in one organized space."
                  />
                </div>
              </div>

              <div className="rounded-[28px] border border-[#e2cfba] bg-[#5d4330] p-6 text-white shadow-[0_18px_50px_rgba(88,63,37,0.18)]">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#f4d7b3]">
                  Inside your portal
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <MiniTile label="Application" />
                  <MiniTile label="My Puppy" />
                  <MiniTile label="Messages" />
                  <MiniTile label="Documents" />
                  <MiniTile label="Payments" />
                  <MiniTile label="Resources" />
                </div>

                <div className="mt-6 rounded-2xl border border-white/15 bg-white/10 p-4">
                  <p className="text-sm font-semibold leading-7 text-[#fff3e7]">
                    Designed to make your experience feel more personal, more organized,
                    and less stressful from application through go-home day.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[36px] border border-[#ead9c7] bg-white shadow-[0_30px_80px_rgba(88,63,37,0.10)]">
          <div className="px-7 py-8 md:px-10 md:py-10">
            <div className="mb-8">
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#b08251]">
                My Puppy Portal Access
              </div>
              <h2 className="mt-3 font-serif text-4xl font-bold leading-none text-[#3e2a1f]">
                {mode === "login"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create your account"
                    : "Reset your password"}
              </h2>
              <p className="mt-3 text-sm font-semibold leading-7 text-[#8a6a49]">
                {mode === "login"
                  ? "Enter your details to access your private portal."
                  : mode === "signup"
                    ? "Create your portal login to access updates, documents, and your puppy journey."
                    : "We’ll email you a secure link so you can set a new password."}
              </p>
            </div>

            <div className="mb-8 grid grid-cols-3 gap-2 rounded-[20px] border border-[#ead9c7] bg-[#fbf7f1] p-1.5">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setMessage("");
                }}
                className={`rounded-[16px] px-3 py-3 text-[11px] font-black uppercase tracking-[0.18em] transition ${
                  mode === "login"
                    ? "bg-[#6b4d33] text-white shadow-md"
                    : "text-[#a47946] hover:text-[#6b4d33]"
                }`}
              >
                Sign In
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setMessage("");
                }}
                className={`rounded-[16px] px-3 py-3 text-[11px] font-black uppercase tracking-[0.18em] transition ${
                  mode === "signup"
                    ? "bg-[#6b4d33] text-white shadow-md"
                    : "text-[#a47946] hover:text-[#6b4d33]"
                }`}
              >
                Sign Up
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setMessage("");
                }}
                className={`rounded-[16px] px-3 py-3 text-[11px] font-black uppercase tracking-[0.18em] transition ${
                  mode === "forgot"
                    ? "bg-[#6b4d33] text-white shadow-md"
                    : "text-[#a47946] hover:text-[#6b4d33]"
                }`}
              >
                Reset
              </button>
            </div>

            {mode === "login" && (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-[#a47946]">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-[#a47946]">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]"
                    required
                  />
                </div>

                {message ? (
                  <div className="rounded-2xl border border-[#ead9c7] bg-[#fbf7f1] px-4 py-3 text-sm font-semibold text-[#7a5a3a]">
                    {message}
                  </div>
                ) : null}

                <button
                  disabled={working}
                  className="w-full rounded-[18px] bg-[#6b4d33] px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_14px_30px_rgba(88,63,37,0.18)] transition hover:bg-[#5b412c] disabled:opacity-60"
                >
                  {working ? "Signing In..." : "Sign In"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setMessage("");
                  }}
                  className="w-full text-center text-[11px] font-black uppercase tracking-[0.18em] text-[#a47946] hover:text-[#6b4d33]"
                >
                  Forgot Password?
                </button>
              </form>
            )}

            {mode === "signup" && (
              <form onSubmit={handleSignUp} className="space-y-5">
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-[#a47946]">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-[#a47946]">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-[#a47946]">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]"
                    required
                  />
                </div>

                {message ? (
                  <div className="rounded-2xl border border-[#ead9c7] bg-[#fbf7f1] px-4 py-3 text-sm font-semibold text-[#7a5a3a]">
                    {message}
                  </div>
                ) : null}

                <button
                  disabled={working}
                  className="w-full rounded-[18px] bg-[#6b4d33] px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_14px_30px_rgba(88,63,37,0.18)] transition hover:bg-[#5b412c] disabled:opacity-60"
                >
                  {working ? "Creating Account..." : "Create Account"}
                </button>
              </form>
            )}

            {mode === "forgot" && (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-[#a47946]">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]"
                    required
                  />
                </div>

                {message ? (
                  <div className="rounded-2xl border border-[#ead9c7] bg-[#fbf7f1] px-4 py-3 text-sm font-semibold text-[#7a5a3a]">
                    {message}
                  </div>
                ) : null}

                <button
                  disabled={working}
                  className="w-full rounded-[18px] bg-[#6b4d33] px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_14px_30px_rgba(88,63,37,0.18)] transition hover:bg-[#5b412c] disabled:opacity-60"
                >
                  {working ? "Sending..." : "Send Reset Email"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setMessage("");
                  }}
                  className="w-full text-center text-[11px] font-black uppercase tracking-[0.18em] text-[#a47946] hover:text-[#6b4d33]"
                >
                  Back To Sign In
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

