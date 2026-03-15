"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { sb, T, fmtMoney, fmtDate, buildPuppyPhotoUrl } from "@/lib/utils";

type PortalData = {
  buyer: any;
  app: any;
  puppy: any;
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
        desc: "See your puppy profile, milestones, photos, and updates.",
        href: "/portal/mypuppy",
        cta: "Open My Puppy",
      },
      {
        icon: "📄",
        title: "Documents",
        desc: "Review contracts, portal files, and anything needing attention.",
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
        desc: "Open care guides, prep materials, and important puppy info.",
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
        desc: "Read through agreements and be ready when a match is finalized.",
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
      desc: "Open care resources and puppy prep information.",
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

  async function loadData(currUser: any) {
    const email = String(currUser?.email || "").toLowerCase();
    const uid = currUser?.id;

    let buyer: BuyerRow | null = null;
    let app: any = null;
    let puppy: any = null;
    let msgs: any[] = [];
    let updates: any[] = [];
    let docCount = 0;

    try {
      const buyerRes = await sb
        .from("buyers")
        .select("*")
        .or(`user_id.eq.${uid},email.ilike.%${email}%,buyer_email.ilike.%${email}%`)
        .limit(1)
        .maybeSingle();

      buyer = (buyerRes.data as BuyerRow | null) ?? null;
    } catch {
      buyer = null;
    }

    try {
      const appRes = await sb
        .from(T.applications)
        .select("*")
        .or(`user_id.eq.${uid},email.ilike.%${email}%,applicant_email.ilike.%${email}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      app = appRes.data ?? null;
    } catch {
      app = null;
    }

    if (buyer?.id) {
      const puppyByBuyer = await sb
        .from("puppies")
        .select("*")
        .eq("buyer_id", buyer.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      puppy = puppyByBuyer.data ?? null;
    }

    if (!puppy) {
      const puppyByEmail = await sb
        .from("puppies")
        .select("*")
        .or(`owner_email.ilike.%${email}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      puppy = puppyByEmail.data ?? null;
    }

    try {
      const msgRes = await sb
        .from(T.messages)
        .select("*")
        .or(`user_id.eq.${uid},email.ilike.%${email}%,user_email.ilike.%${email}%`)
        .order("created_at", { ascending: false })
        .limit(5);

      msgs = msgRes.data || [];
    } catch {
      msgs = [];
    }

    const docTables = ["documents", "portal_documents", "buyer_documents"];

    for (const tableName of docTables) {
      try {
        let q = sb.from(tableName).select("*", { count: "exact", head: true });

        if (buyer?.id) {
          q = q.or(`buyer_id.eq.${buyer.id},user_id.eq.${uid}`);
        } else {
          q = q.or(`user_id.eq.${uid},email.ilike.%${email}%,buyer_email.ilike.%${email}%`);
        }

        const res = await q;
        if (!res.error) {
          docCount = res.count || 0;
          break;
        }
      } catch {
        // ignore missing tables
      }
    }

    if (puppy?.id) {
      try {
        const updatesRes = await sb
          .from("puppy_events")
          .select("*")
          .eq("puppy_id", puppy.id)
          .order("event_date", { ascending: true });

        if (!updatesRes.error) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          updates = (updatesRes.data || []).filter((u: any) => {
            const eventDate = new Date(u.event_date || u.created_at);
            eventDate.setHours(0, 0, 0, 0);
            return eventDate.getTime() <= today.getTime();
          });
        }
      } catch {
        updates = [];
      }
    }

    setData({
      buyer,
      app,
      puppy,
      msgs,
      updates,
      docCount,
    });
  }

  if (loading) {
    return (
      <div className="h-full min-h-screen flex items-center justify-center bg-brand-50 italic">
        Loading Portal...
      </div>
    );
  }

  if (!user) return <LoginComponent />;

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

  const heroTitle = hasPuppy
    ? `Welcome back, ${
        data?.puppy?.call_name || data?.puppy?.puppy_name || data?.puppy?.name || "Puppy Family"
      }`
    : hasApp
      ? "Your Application Is In"
      : "Welcome To Your Puppy Portal";

  const heroDesc = hasPuppy
    ? "This is your overview hub for messages, documents, financials, resources, and your puppy’s current progress."
    : hasApp
      ? "Your dashboard keeps your application, communication, and next steps organized in one place."
      : "Start here to access your application, messages, documents, and everything connected to your puppy journey.";

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

  const primaryHref = hasPuppy
    ? "/portal/mypuppy"
    : hasApp
      ? "/portal/application"
      : "/portal/application";

  const primaryLabel = hasPuppy
    ? "Open My Puppy"
    : hasApp
      ? "View Application"
      : "Start Application";

  const steps = nextSteps(hasApp, hasPuppy);

  const overviewCards = useMemo(
    () => [
      {
        label: "Application",
        value: data?.app?.status || data?.app?.application_status || "Not started",
        sub: data?.app?.created_at ? `Submitted ${fmtDate(data.app.created_at)}` : "Complete when ready",
        href: "/portal/application",
        icon: "📝",
      },
      {
        label: "Documents",
        value: data?.docCount ? `${data.docCount} file(s)` : "—",
        sub: "Contracts and saved files",
        href: "/portal/documents",
        icon: "📄",
      },
      {
        label: "Messages",
        value: `${data?.msgs?.length || 0}`,
        sub: "Recent message activity",
        href: "/portal/messages",
        icon: "💬",
      },
      {
        label: "Financials",
        value:
          data?.puppy?.price || data?.puppy?.total_price || data?.puppy?.adoption_fee
            ? fmtMoney(
                data?.puppy?.price ||
                  data?.puppy?.total_price ||
                  data?.puppy?.adoption_fee
              )
            : "—",
        sub: "View full payment details",
        href: "/portal/payments",
        icon: "💳",
      },
    ],
    [data]
  );

  return (
    <div className="h-full w-full text-brand-900 bg-brand-50">
      <main className="h-full relative flex flex-col overflow-hidden bg-texturePaper">
        <div className="flex-1 p-6 md:p-10 lg:p-12 overflow-y-auto scroller max-w-[1600px] mx-auto w-full">
          <div className="space-y-8 pb-14">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/75 border border-brand-200 shadow-paper">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                    Puppy Portal
                  </span>
                  <span className="w-1 h-1 rounded-full bg-brand-300" />
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                    Southwest Virginia Chihuahua
                  </span>
                </div>

                <h2 className="mt-5 font-serif text-4xl md:text-5xl font-bold text-brand-900 leading-[0.96]">
                  Hello, {greetingName}
                </h2>

                <p className="mt-2 text-brand-500 font-semibold max-w-3xl">
                  Your dashboard is your overview of everything important — status,
                  messages, documents, financials, resources, and next steps.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] ${appStatus.cls}`}
                >
                  <span className="w-2 h-2 rounded-full bg-current opacity-70" />
                  Application: {appStatus.label}
                </span>

                <span
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] ${puppyStatus.cls}`}
                >
                  <span className="w-2 h-2 rounded-full bg-current opacity-70" />
                  Puppy: {puppyStatus.label}
                </span>
              </div>
            </div>

            <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-8 card-luxury overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_.85fr] min-h-[360px]">
                  <div className="p-7 md:p-9 flex flex-col justify-between">
                    <div>
                      <span className="inline-block px-3 py-1 bg-brand-100 text-brand-700 text-[10px] font-black uppercase tracking-[0.22em] rounded-full mb-4 border border-brand-200">
                        Overview
                      </span>

                      <h3 className="font-serif text-3xl md:text-4xl font-bold text-brand-900 leading-[1.04]">
                        {heroTitle}
                      </h3>

                      <p className="mt-3 text-brand-600 font-semibold max-w-2xl leading-relaxed">
                        {heroDesc}
                      </p>
                    </div>

                    <div className="mt-8 flex flex-wrap items-center gap-3">
                      <Link
                        href={primaryHref}
                        className="inline-flex items-center gap-2 px-7 py-3.5 bg-brand-800 text-white font-black text-sm rounded-xl hover:bg-brand-700 transition shadow-lift uppercase tracking-[0.12em]"
                      >
                        {primaryLabel} <span aria-hidden="true">→</span>
                      </Link>

                      <Link
                        href="/portal/messages"
                        className="inline-flex items-center gap-2 px-7 py-3.5 bg-white border border-brand-200 text-brand-800 font-black text-sm rounded-xl hover:bg-brand-50 transition shadow-paper uppercase tracking-[0.12em]"
                      >
                        Open Messages <span aria-hidden="true">↗</span>
                      </Link>
                    </div>
                  </div>

                  <div className="relative min-h-[260px] lg:min-h-full bg-brand-100">
                    {hasPuppy ? (
                      <>
                        <img
                          src={puppyImage}
                          alt="Puppy"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-6">
                          <div className="flex flex-wrap gap-2 mb-3">
                            <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-white border border-white/30 rounded-full text-[10px] font-black uppercase tracking-[0.22em]">
                              {data?.puppy?.sex || data?.puppy?.gender || "Puppy"}
                            </span>

                            {(data?.puppy?.dob || data?.puppy?.birth_date) && (
                              <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-white border border-white/30 rounded-full text-[10px] font-black uppercase tracking-[0.22em]">
                                Born {fmtDate(data?.puppy?.dob || data?.puppy?.birth_date)}
                              </span>
                            )}
                          </div>

                          <div className="font-serif text-3xl font-bold text-white leading-none">
                            {data?.puppy?.call_name ||
                              data?.puppy?.puppy_name ||
                              data?.puppy?.name ||
                              "Your Puppy"}
                          </div>
                          <div className="mt-2 text-white/85 text-sm font-semibold">
                            Full profile, milestones, and deeper puppy details are in the My Puppy tab.
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="h-full flex items-center justify-center p-8 text-center">
                        <div>
                          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl border border-brand-200">
                            🐾
                          </div>
                          <div className="font-serif text-2xl font-bold text-brand-800">
                            No Puppy Assigned Yet
                          </div>
                          <div className="mt-2 text-sm font-semibold text-brand-500 max-w-sm">
                            Once a match is confirmed, this area will highlight your puppy while the
                            full details live in the My Puppy page.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="xl:col-span-4 card-luxury p-7 bg-gradient-to-br from-[#FFF9F2] via-[#FFFDFC] to-white border-brand-200">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-400">
                  Portal Snapshot
                </div>

                <div className="mt-4 space-y-4">
                  <SnapshotRow label="Account" value={user.email || "—"} />
                  <SnapshotRow label="Application" value={appStatus.label} />
                  <SnapshotRow label="Puppy Status" value={puppyStatus.label} />
                  <SnapshotRow
                    label="Documents"
                    value={data?.docCount ? `${data.docCount} file(s)` : "—"}
                  />
                </div>

                <div className="mt-6 pt-5 border-t border-brand-100">
                  <p className="font-serif text-xl italic text-brand-800 leading-relaxed">
                    “A polished place to keep every part of your puppy journey organized.”
                  </p>

                  <Link
                    href="/portal/resources"
                    className="inline-flex items-center gap-2 mt-5 text-[11px] font-black uppercase tracking-[0.18em] text-brand-600 hover:text-brand-800"
                  >
                    Open Resources <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {overviewCards.map((card) => (
                <Link
                  key={card.label}
                  href={card.href}
                  className="card-luxury p-5 hover:-translate-y-1 transition"
                >
                  <div className="text-2xl">{card.icon}</div>
                  <div className="mt-3 text-[10px] font-black text-brand-500 uppercase tracking-[0.18em]">
                    {card.label}
                  </div>
                  <div className="mt-1 text-sm font-black text-brand-900 break-words">
                    {card.value}
                  </div>
                  <div className="mt-1 text-[11px] text-brand-400 font-semibold">
                    {card.sub}
                  </div>
                </Link>
              ))}
            </section>

            <section className="card-luxury p-7 md:p-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h4 className="font-serif font-bold text-2xl text-brand-800">Next Steps</h4>
                  <p className="text-brand-500 font-semibold text-sm mt-1">
                    Your dashboard overview of what to do next.
                  </p>
                </div>

                <Link
                  href={primaryHref}
                  className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500 hover:text-brand-800"
                >
                  Open Main Area →
                </Link>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {steps.map((step) => (
                  <Link
                    key={step.title}
                    href={step.href}
                    className="p-5 rounded-2xl bg-white/75 border border-brand-200 shadow-paper hover:bg-white transition block"
                  >
                    <div className="text-2xl">{step.icon}</div>
                    <div className="mt-3 text-sm font-black text-brand-900">{step.title}</div>
                    <div className="mt-1 text-[12px] text-brand-500 font-semibold leading-relaxed">
                      {step.desc}
                    </div>
                    <div className="mt-4 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-brand-600">
                      {step.cta} <span aria-hidden="true">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 space-y-6">
                <div className="card-luxury p-7">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h4 className="font-serif font-bold text-2xl text-brand-800">
                        Recent Messages
                      </h4>
                      <p className="text-brand-500 font-semibold text-sm mt-1">
                        Your latest conversation activity at a glance.
                      </p>
                    </div>

                    <Link
                      href="/portal/messages"
                      className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500 hover:text-brand-800"
                    >
                      View All
                    </Link>
                  </div>

                  <div className="space-y-3">
                    {data?.msgs?.length ? (
                      data.msgs.map((m: any) => (
                        <div
                          key={m.id}
                          className="p-4 rounded-2xl bg-white/75 border border-brand-200 hover:bg-white transition"
                        >
                          <div className="flex justify-between gap-4 mb-2">
                            <span className="text-[10px] font-black text-brand-500 uppercase tracking-[0.18em]">
                              {m.sender_name || m.sender || m.from_name || "Support"}
                            </span>
                            <span className="text-[10px] text-brand-300 font-semibold shrink-0">
                              {fmtDate(m.created_at || m.sent_at)}
                            </span>
                          </div>

                          <p className="text-sm font-semibold text-brand-800 line-clamp-2">
                            {m.message || m.content || m.body || m.text || "—"}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-10 text-brand-400 text-sm italic">
                        No recent messages
                      </div>
                    )}
                  </div>
                </div>

                <div className="card-luxury p-7">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h4 className="font-serif font-bold text-2xl text-brand-800">
                        Pupdates
                      </h4>
                      <p className="text-brand-500 font-semibold text-sm mt-1">
                        A quick look at recent puppy-related updates.
                      </p>
                    </div>

                    <Link
                      href="/portal/mypuppy"
                      className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500 hover:text-brand-800"
                    >
                      Open My Puppy
                    </Link>
                  </div>

                  <div className="space-y-3">
                    {data?.updates?.length ? (
                      data.updates.slice(0, 5).map((u: any) => (
                        <div
                          key={u.id}
                          className="p-4 rounded-2xl bg-white/75 border border-brand-200 hover:bg-white transition"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
                              {u.event_type || u.type || u.category || "Update"}
                            </div>
                            <div className="text-[10px] font-semibold text-brand-300">
                              {fmtDate(u.event_date || u.created_at || u.date)}
                            </div>
                          </div>

                          <div className="mt-1 text-sm font-black text-brand-900">
                            {u.label || u.title || u.name || "Update"}
                          </div>

                          {(u.details || u.description || u.notes || u.value) && (
                            <div className="mt-1 text-[12px] text-brand-600 font-semibold line-clamp-2">
                              {u.details || u.description || u.notes || u.value}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-10 text-brand-400 text-sm italic">
                        {hasPuppy
                          ? "No pupdates posted yet."
                          : "Pupdates will appear after a puppy is matched."}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-6">
                <div className="card-luxury p-7">
                  <div className="flex items-center justify-between">
                    <h4 className="font-serif font-bold text-2xl text-brand-800">
                      Financial Overview
                    </h4>
                    <Link
                      href="/portal/payments"
                      className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500 hover:text-brand-800"
                    >
                      Open
                    </Link>
                  </div>

                  <div className="mt-5 space-y-4">
                    <FinancialRow
                      label="Adoption Fee"
                      value={
                        data?.puppy?.price ||
                        data?.puppy?.total_price ||
                        data?.puppy?.adoption_fee
                          ? fmtMoney(
                              data?.puppy?.price ||
                                data?.puppy?.total_price ||
                                data?.puppy?.adoption_fee
                            )
                          : "—"
                      }
                    />

                    <div className="p-4 rounded-2xl bg-white/70 border border-brand-200">
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                        Note
                      </div>
                      <div className="mt-1 text-sm font-semibold text-brand-800 leading-relaxed">
                        Use the Financials page for the most accurate balance, receipts, and payment history.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card-luxury p-7">
                  <h4 className="font-serif font-bold text-2xl text-brand-800 mb-4">
                    Quick Access
                  </h4>

                  <div className="space-y-3">
                    <QuickLink
                      href="/portal/application"
                      title="Application"
                      desc="Review or update your submitted information."
                    />
                    <QuickLink
                      href="/portal/documents"
                      title="Documents"
                      desc="Open contracts, files, and saved paperwork."
                    />
                    <QuickLink
                      href="/portal/payments"
                      title="Financials"
                      desc="View payment records and financial details."
                    />
                    <QuickLink
                      href="/portal/resources"
                      title="Resources"
                      desc="Care guidance, prep tips, and important reading."
                    />
                  </div>
                </div>

                <div className="rounded-3xl bg-gradient-to-br from-brand-800 via-brand-800 to-brand-700 text-white p-7 shadow-luxury">
                  <h4 className="font-serif font-bold text-2xl mb-1">ChiChi AI</h4>
                  <p className="text-brand-200 text-sm font-semibold mb-5">
                    AI chatbot embed area.
                  </p>
                  <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-sm text-brand-100">
                    Claude chatbot will be linked or embedded here.
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-white/75 border border-brand-200 px-4 py-3">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
        {label}
      </div>
      <div className="text-sm font-black text-brand-900 text-right break-words">
        {value}
      </div>
    </div>
  );
}

function FinancialRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center gap-4">
      <span className="text-[11px] font-black text-brand-500 uppercase tracking-[0.18em]">
        {label}
      </span>
      <span className="text-sm font-black text-brand-900 text-right">{value}</span>
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
      className="block p-4 rounded-2xl bg-white/75 border border-brand-200 hover:bg-white transition"
    >
      <div className="text-sm font-black text-brand-900">{title}</div>
      <div className="mt-1 text-[12px] text-brand-500 font-semibold leading-relaxed">
        {desc}
      </div>
    </Link>
  );
}

function LoginComponent() {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [fullName, setFullName] = useState("");
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorking(true);
    setStatus("");

    const { error } = await sb.auth.signInWithPassword({
      email,
      password: pass,
    });

    setWorking(false);
    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus("Signed in.");
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorking(true);
    setStatus("");

    const { error } = await sb.auth.signUp({
      email,
      password: pass,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    setWorking(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus("Account created. Check your email to confirm your sign up.");
  };

  const forgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorking(true);
    setStatus("");

    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo:
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : undefined,
    });

    setWorking(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus("Password reset email sent. Please check your inbox.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50 p-6">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.05fr_.95fr] rounded-[32px] overflow-hidden shadow-luxury border border-white/70 bg-white">
        <div className="relative bg-gradient-to-br from-[#f7efe6] via-[#fffaf7] to-[#f4ece2] p-10 lg:p-14">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 border border-brand-200 shadow-paper">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
              Puppy Portal
            </span>
            <span className="w-1 h-1 rounded-full bg-brand-300" />
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
              Southwest Virginia Chihuahua
            </span>
          </div>

          <h2 className="mt-8 font-serif text-4xl lg:text-5xl font-bold text-brand-900 leading-[0.96]">
            Welcome Home
          </h2>

          <p className="mt-4 text-brand-600 font-semibold leading-relaxed max-w-xl">
            Access your application, documents, messages, puppy updates, and care
            resources in one beautifully organized place.
          </p>

          <div className="mt-10 space-y-4">
            <FeatureRow
              title="Application Tracking"
              desc="Keep your status and next steps visible at all times."
            />
            <FeatureRow
              title="My Puppy"
              desc="Once matched, your puppy profile and updates will appear automatically."
            />
            <FeatureRow
              title="Messages & Documents"
              desc="Open contracts, portal files, and breeder communication in one place."
            />
          </div>
        </div>

        <div className="p-8 md:p-10 lg:p-12 bg-white">
          <div className="flex gap-2 p-1 rounded-2xl bg-brand-50 border border-brand-100 mb-8">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setStatus("");
              }}
              className={`flex-1 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-[0.18em] transition ${
                mode === "login"
                  ? "bg-brand-800 text-white shadow-lift"
                  : "text-brand-500 hover:text-brand-800"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setStatus("");
              }}
              className={`flex-1 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-[0.18em] transition ${
                mode === "signup"
                  ? "bg-brand-800 text-white shadow-lift"
                  : "text-brand-500 hover:text-brand-800"
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("forgot");
                setStatus("");
              }}
              className={`flex-1 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-[0.18em] transition ${
                mode === "forgot"
                  ? "bg-brand-800 text-white shadow-lift"
                  : "text-brand-500 hover:text-brand-800"
              }`}
            >
              Reset
            </button>
          </div>

          {mode === "login" && (
            <form onSubmit={login} className="space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase text-brand-500 mb-2 block tracking-[0.18em]">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3.5 rounded-xl border border-brand-200 bg-white"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-brand-500 mb-2 block tracking-[0.18em]">
                  Password
                </label>
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  className="w-full p-3.5 rounded-xl border border-brand-200 bg-white"
                  required
                />
              </div>

              {status ? (
                <div className="text-sm font-semibold text-brand-600">{status}</div>
              ) : null}

              <button
                disabled={working}
                className="w-full bg-brand-800 text-white p-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lift disabled:opacity-60"
              >
                {working ? "Signing In..." : "Sign In"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setStatus("");
                }}
                className="w-full text-center text-[11px] font-black uppercase tracking-[0.18em] text-brand-500 hover:text-brand-800"
              >
                Forgot Password?
              </button>
            </form>
          )}

          {mode === "signup" && (
            <form onSubmit={signUp} className="space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase text-brand-500 mb-2 block tracking-[0.18em]">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full p-3.5 rounded-xl border border-brand-200 bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-brand-500 mb-2 block tracking-[0.18em]">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3.5 rounded-xl border border-brand-200 bg-white"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-brand-500 mb-2 block tracking-[0.18em]">
                  Password
                </label>
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  className="w-full p-3.5 rounded-xl border border-brand-200 bg-white"
                  required
                />
              </div>

              {status ? (
                <div className="text-sm font-semibold text-brand-600">{status}</div>
              ) : null}

              <button
                disabled={working}
                className="w-full bg-brand-800 text-white p-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lift disabled:opacity-60"
              >
                {working ? "Creating Account..." : "Create Account"}
              </button>
            </form>
          )}

          {mode === "forgot" && (
            <form onSubmit={forgotPassword} className="space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase text-brand-500 mb-2 block tracking-[0.18em]">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3.5 rounded-xl border border-brand-200 bg-white"
                  required
                />
              </div>

              {status ? (
                <div className="text-sm font-semibold text-brand-600">{status}</div>
              ) : null}

              <button
                disabled={working}
                className="w-full bg-brand-800 text-white p-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lift disabled:opacity-60"
              >
                {working ? "Sending..." : "Send Reset Email"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setStatus("");
                }}
                className="w-full text-center text-[11px] font-black uppercase tracking-[0.18em] text-brand-500 hover:text-brand-800"
              >
                Back To Sign In
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function FeatureRow({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl bg-white/70 border border-brand-200 p-4">
      <div className="text-sm font-black text-brand-900">{title}</div>
      <div className="mt-1 text-sm font-semibold text-brand-600 leading-relaxed">
        {desc}
      </div>
    </div>
  );
}