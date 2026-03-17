"use client";

import React, { useEffect, useMemo, useState } from "react";
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
      const byUserId = await sb
        .from("buyers")
        .select("*")
        .eq("user_id", uid)
        .limit(1)
        .maybeSingle();

      if (!byUserId.error && byUserId.data) {
        return byUserId.data as BuyerRow;
      }

      if (byUserId.error) {
        console.warn("buyers by user_id failed:", byUserId.error.message);
      }
    }

    if (email) {
      const byEmail = await sb
        .from("buyers")
        .select("*")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();

      if (!byEmail.error && byEmail.data) {
        return byEmail.data as BuyerRow;
      }

      if (byEmail.error) {
        console.warn("buyers by email failed:", byEmail.error.message);
      }

      const byBuyerEmail = await sb
        .from("buyers")
        .select("*")
        .ilike("buyer_email", email)
        .limit(1)
        .maybeSingle();

      if (!byBuyerEmail.error && byBuyerEmail.data) {
        return byBuyerEmail.data as BuyerRow;
      }

      if (byBuyerEmail.error) {
        console.warn("buyers by buyer_email failed:", byBuyerEmail.error.message);
      }
    }

    return null;
  }

  async function findApplication(uid: string | undefined, email: string) {
    const tableName = T.applications;

    if (uid) {
      const byUserId = await sb
        .from(tableName)
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!byUserId.error && byUserId.data) return byUserId.data;
      if (byUserId.error) {
        console.warn(`${tableName} by user_id failed:`, byUserId.error.message);
      }
    }

    if (email) {
      const byEmail = await sb
        .from(tableName)
        .select("*")
        .ilike("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!byEmail.error && byEmail.data) return byEmail.data;
      if (byEmail.error) {
        console.warn(`${tableName} by email failed:`, byEmail.error.message);
      }

      const byApplicantEmail = await sb
        .from(tableName)
        .select("*")
        .ilike("applicant_email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!byApplicantEmail.error && byApplicantEmail.data) return byApplicantEmail.data;
      if (byApplicantEmail.error) {
        console.warn(`${tableName} by applicant_email failed:`, byApplicantEmail.error.message);
      }
    }

    return null;
  }

  async function findPuppy(buyerId: number | undefined, email: string) {
    if (buyerId) {
      const byBuyer = await sb
        .from("puppies")
        .select("*")
        .eq("buyer_id", buyerId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!byBuyer.error && byBuyer.data) return byBuyer.data;
      if (byBuyer.error) {
        console.warn("puppies by buyer_id failed:", byBuyer.error.message);
      }
    }

    if (email) {
      const byOwnerEmail = await sb
        .from("puppies")
        .select("*")
        .ilike("owner_email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!byOwnerEmail.error && byOwnerEmail.data) return byOwnerEmail.data;
      if (byOwnerEmail.error) {
        console.warn("puppies by owner_email failed:", byOwnerEmail.error.message);
      }
    }

    return null;
  }

  async function findMessages(uid: string | undefined, email: string) {
    const tableName = T.messages;
    let messages: any[] = [];

    if (uid) {
      const byUserId = await sb
        .from(tableName)
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!byUserId.error && byUserId.data?.length) {
        return byUserId.data;
      }

      if (byUserId.error) {
        console.warn(`${tableName} by user_id failed:`, byUserId.error.message);
      }
    }

    if (email) {
      const byEmail = await sb
        .from(tableName)
        .select("*")
        .ilike("email", email)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!byEmail.error && byEmail.data?.length) {
        messages = byEmail.data;
      } else if (byEmail.error) {
        console.warn(`${tableName} by email failed:`, byEmail.error.message);
      }

      if (!messages.length) {
        const byUserEmail = await sb
          .from(tableName)
          .select("*")
          .ilike("user_email", email)
          .order("created_at", { ascending: false })
          .limit(5);

        if (!byUserEmail.error && byUserEmail.data?.length) {
          messages = byUserEmail.data;
        } else if (byUserEmail.error) {
          console.warn(`${tableName} by user_email failed:`, byUserEmail.error.message);
        }
      }
    }

    return messages || [];
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

          const byUserId = uid
            ? await sb
                .from(tableName)
                .select("*", { count: "exact", head: true })
                .eq("user_id", uid)
            : null;

          if (byUserId && !byUserId.error) return byUserId.count || 0;
        } else if (uid) {
          const byUserId = await sb
            .from(tableName)
            .select("*", { count: "exact", head: true })
            .eq("user_id", uid);

          if (!byUserId.error) return byUserId.count || 0;
        }

        if (email) {
          const byEmail = await sb
            .from(tableName)
            .select("*", { count: "exact", head: true })
            .ilike("email", email);

          if (!byEmail.error) return byEmail.count || 0;

          const byBuyerEmail = await sb
            .from(tableName)
            .select("*", { count: "exact", head: true })
            .ilike("buyer_email", email);

          if (!byBuyerEmail.error) return byBuyerEmail.count || 0;
        }
      } catch (error) {
        console.warn(`document count lookup failed for ${tableName}:`, error);
      }
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

      if (updatesRes.error) {
        console.warn("puppy_events failed:", updatesRes.error.message);
        return [];
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return (updatesRes.data || []).filter((u: any) => {
        const eventDate = new Date(u.event_date || u.created_at);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate.getTime() <= today.getTime();
      });
    } catch (error) {
      console.warn("findUpdates failed:", error);
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
    } catch (error) {
      console.error("Portal loadData failed:", error);
      setData(fallback);
    }
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

  const primaryHref = hasPuppy ? "/portal/mypuppy" : "/portal/application";
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
        sub: data?.app?.created_at
          ? `Submitted ${fmtDate(data.app.created_at)}`
          : "Complete when ready",
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
                        Transparency
                      </div>
                      <div className="mt-1 text-sm font-semibold text-brand-800 leading-relaxed">
                        For the most accurate balances, payment history, and receipts, use the Financials page.
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
    <div className="min-h-screen bg-[#f7f3ee] px-4 py-8 md:px-8 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-8 items-stretch">
          <section className="relative overflow-hidden rounded-[36px] border border-[#e7d9c8] bg-gradient-to-br from-[#fff8f1] via-[#f8efe4] to-[#efe2d2] shadow-[0_30px_80px_rgba(88,63,37,0.14)]">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-0 h-72 w-72 rounded-full bg-white/35 blur-3xl" />
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
                <h1 className="font-serif text-5xl md:text-6xl xl:text-7xl leading-[0.95] text-[#3e2a1f] font-bold">
                  Welcome to your puppy’s private portal.
                </h1>

                <p className="mt-6 max-w-2xl text-[17px] leading-8 text-[#7a5a3a] font-semibold">
                  A beautifully organized place for your application, puppy updates,
                  contracts, payments, messages, and care resources — all in one
                  secure space designed for our families.
                </p>
              </div>

              <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl">
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

              <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1fr_0.9fr] gap-5 items-stretch">
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
                    <p className="text-sm leading-7 text-[#fff3e7] font-semibold">
                      Designed to make your experience feel more personal, more organized,
                      and less stressful from application through go-home day.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[36px] border border-[#ead9c7] bg-white shadow-[0_30px_80px_rgba(88,63,37,0.10)] overflow-hidden">
            <div className="px-7 py-8 md:px-10 md:py-10">
              <div className="mb-8">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#b08251]">
                  Puppy Portal Access
                </div>
                <h2 className="mt-3 font-serif text-4xl text-[#3e2a1f] font-bold leading-none">
                  {mode === "login"
                    ? "Sign in"
                    : mode === "signup"
                      ? "Create your account"
                      : "Reset your password"}
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#8a6a49] font-semibold">
                  {mode === "login"
                    ? "Enter your details to access your private portal."
                    : mode === "signup"
                      ? "Create your portal login to access updates, documents, and your puppy journey."
                      : "We’ll email you a secure link so you can set a new password."}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-[20px] border border-[#ead9c7] bg-[#fbf7f1] p-1.5 mb-8">
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
                    <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-[#a47946] mb-2">
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
                    <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-[#a47946] mb-2">
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
                    className="w-full rounded-[18px] bg-[#6b4d33] px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_14px_30px_rgba(88,63,37,0.18)] hover:bg-[#5b412c] transition disabled:opacity-60"
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
                    <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-[#a47946] mb-2">
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
                    <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-[#a47946] mb-2">
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
                    <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-[#a47946] mb-2">
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
                    className="w-full rounded-[18px] bg-[#6b4d33] px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_14px_30px_rgba(88,63,37,0.18)] hover:bg-[#5b412c] transition disabled:opacity-60"
                  >
                    {working ? "Creating Account..." : "Create Account"}
                  </button>
                </form>
              )}

              {mode === "forgot" && (
                <form onSubmit={handleForgotPassword} className="space-y-5">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-[#a47946] mb-2">
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
                    className="w-full rounded-[18px] bg-[#6b4d33] px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_14px_30px_rgba(88,63,37,0.18)] hover:bg-[#5b412c] transition disabled:opacity-60"
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
    </div>
  );
}