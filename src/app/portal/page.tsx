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

  const heroTitle = hasPuppy
    ? `Welcome back, ${
        data?.puppy?.call_name || data?.puppy?.puppy_name || data?.puppy?.name || "Puppy Family"
      }`
    : hasApp
      ? "Your Application Is In"
      : "Welcome To My Puppy Portal";

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

  const overviewCards = [
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
      sub: "View payment details",
      href: "/portal/payments",
      icon: "💳",
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
    <div className="space-y-6">
      <section className="rounded-[30px] border border-[#d7c7b6] bg-white shadow-[0_14px_40px_rgba(61,39,22,0.08)] overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="bg-[linear-gradient(135deg,#8f6945_0%,#6f5037_100%)] px-6 py-7 text-white md:px-8 md:py-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/85">
              <span>My Puppy Portal</span>
              <span className="h-1 w-1 rounded-full bg-white/50" />
              <span>Southwest Virginia Chihuahua</span>
            </div>

            <h1 className="mt-5 font-serif text-3xl font-bold leading-[0.95] md:text-5xl">
              Hello, {greetingName}
            </h1>

            <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-white/82 md:text-[15px]">
              Your dashboard keeps everything important organized in one place —
              application status, messages, documents, financials, resources, and next steps.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${appStatus.cls}`}
              >
                <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                Application: {appStatus.label}
              </span>

              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${puppyStatus.cls}`}
              >
                <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                Puppy: {puppyStatus.label}
              </span>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={primaryHref}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#d6ab73] px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-[#24180f] transition hover:bg-[#dfba87]"
              >
                {primaryLabel}
                <span aria-hidden="true">→</span>
              </Link>

              <Link
                href="/portal/messages"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/18 bg-white/10 px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/14"
              >
                Open Messages
                <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>

          <div className="relative min-h-[280px] bg-[#efe6dc]">
            {hasPuppy ? (
              <>
                <img
                  src={puppyImage}
                  alt="Puppy"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white backdrop-blur-sm">
                      {data?.puppy?.sex || data?.puppy?.gender || "Puppy"}
                    </span>

                    {(data?.puppy?.dob || data?.puppy?.birth_date) && (
                      <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white backdrop-blur-sm">
                        Born {fmtDate(data?.puppy?.dob || data?.puppy?.birth_date)}
                      </span>
                    )}
                  </div>

                  <div className="font-serif text-3xl font-bold text-white">
                    {data?.puppy?.call_name ||
                      data?.puppy?.puppy_name ||
                      data?.puppy?.name ||
                      "Your Puppy"}
                  </div>

                  <div className="mt-2 max-w-xl text-sm font-semibold text-white/84">
                    Full profile, milestones, photos, and breeder updates are available in the My Puppy section.
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center">
                <div>
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#dcc8b2] bg-white text-2xl shadow-sm">
                    🐾
                  </div>
                  <div className="font-serif text-2xl font-bold text-[#4a3325]">
                    No Puppy Assigned Yet
                  </div>
                  <div className="mt-2 max-w-sm text-sm font-semibold leading-7 text-[#8b6b4d]">
                    Once a match is confirmed, this area will highlight your puppy while the full details live in My Puppy.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {overviewCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-[24px] border border-[#dccab7] bg-white p-5 shadow-[0_12px_28px_rgba(74,51,33,0.06)] transition hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(74,51,33,0.10)]"
          >
            <div className="text-2xl">{card.icon}</div>
            <div className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#9d7a55]">
              {card.label}
            </div>
            <div className="mt-1 break-words text-sm font-black text-[#342116]">
              {card.value}
            </div>
            <div className="mt-1 text-[11px] font-semibold text-[#8d6f52]">
              {card.sub}
            </div>
          </Link>
        ))}
      </section>

      <section className="rounded-[30px] border border-[#dccab7] bg-white p-6 shadow-[0_12px_28px_rgba(74,51,33,0.06)] md:p-7">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-serif text-2xl font-bold text-[#3b271b]">Next Steps</h2>
            <p className="mt-1 text-sm font-semibold text-[#8b6b4d]">
              Your dashboard overview of what to do next.
            </p>
          </div>

          <Link
            href={primaryHref}
            className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9a7854] hover:text-[#4f3726]"
          >
            Open Main Area →
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step) => (
            <Link
              key={step.title}
              href={step.href}
              className="rounded-[24px] border border-[#e4d5c4] bg-[#fcf8f3] p-5 transition hover:bg-white"
            >
              <div className="text-2xl">{step.icon}</div>
              <div className="mt-3 text-sm font-black text-[#372419]">{step.title}</div>
              <div className="mt-1 text-[12px] font-semibold leading-6 text-[#8b6d50]">
                {step.desc}
              </div>
              <div className="mt-4 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#7f5f42]">
                {step.cta}
                <span aria-hidden="true">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-7">
          <div className="rounded-[30px] border border-[#dccab7] bg-white p-6 shadow-[0_12px_28px_rgba(74,51,33,0.06)] md:p-7">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="font-serif text-2xl font-bold text-[#3b271b]">
                  Recent Messages
                </h2>
                <p className="mt-1 text-sm font-semibold text-[#8b6b4d]">
                  Your latest conversation activity at a glance.
                </p>
              </div>

              <Link
                href="/portal/messages"
                className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9a7854] hover:text-[#4f3726]"
              >
                View All
              </Link>
            </div>

            <div className="space-y-3">
              {data?.msgs?.length ? (
                data.msgs.map((m: any) => (
                  <div
                    key={m.id}
                    className="rounded-[22px] border border-[#e5d7c8] bg-[#fcf9f5] p-4 transition hover:bg-white"
                  >
                    <div className="mb-2 flex justify-between gap-4">
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
                        {m.sender_name || m.sender || m.from_name || "Support"}
                      </span>
                      <span className="shrink-0 text-[10px] font-semibold text-[#bea184]">
                        {fmtDate(m.created_at || m.sent_at)}
                      </span>
                    </div>

                    <p className="line-clamp-2 text-sm font-semibold text-[#4e3727]">
                      {m.message || m.content || m.body || m.text || "—"}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-[#e3d4c2] bg-[#fcf8f3] py-10 text-center text-sm italic text-[#9e8164]">
                  No recent messages
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[30px] border border-[#dccab7] bg-white p-6 shadow-[0_12px_28px_rgba(74,51,33,0.06)] md:p-7">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="font-serif text-2xl font-bold text-[#3b271b]">
                  Pupdates
                </h2>
                <p className="mt-1 text-sm font-semibold text-[#8b6b4d]">
                  A quick look at recent puppy-related updates.
                </p>
              </div>

              <Link
                href="/portal/mypuppy"
                className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9a7854] hover:text-[#4f3726]"
              >
                Open My Puppy
              </Link>
            </div>

            <div className="space-y-3">
              {data?.updates?.length ? (
                data.updates.slice(0, 5).map((u: any) => (
                  <div
                    key={u.id}
                    className="rounded-[22px] border border-[#e5d7c8] bg-[#fcf9f5] p-4 transition hover:bg-white"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
                        {u.event_type || u.type || u.category || "Update"}
                      </div>
                      <div className="text-[10px] font-semibold text-[#bea184]">
                        {fmtDate(u.event_date || u.created_at || u.date)}
                      </div>
                    </div>

                    <div className="mt-1 text-sm font-black text-[#342116]">
                      {u.title || u.label || u.name || "Update"}
                    </div>

                    {(u.summary || u.details || u.description || u.notes || u.value) && (
                      <div className="mt-1 line-clamp-2 text-[12px] font-semibold text-[#8d6f52]">
                        {u.summary || u.details || u.description || u.notes || u.value}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-dashed border-[#e3d4c2] bg-[#fcf8f3] py-10 text-center text-sm italic text-[#9e8164]">
                  {hasPuppy
                    ? "No pupdates posted yet."
                    : "Pupdates will appear after a puppy is matched."}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6 xl:col-span-5">
          <div className="rounded-[30px] border border-[#dccab7] bg-white p-6 shadow-[0_12px_28px_rgba(74,51,33,0.06)] md:p-7">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-serif text-2xl font-bold text-[#3b271b]">
                  Financial Overview
                </h2>
                <p className="mt-1 text-sm font-semibold text-[#8b6b4d]">
                  A quick look before opening the full payments page.
                </p>
              </div>

              <Link
                href="/portal/payments"
                className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9a7854] hover:text-[#4f3726]"
              >
                Open
              </Link>
            </div>

            <div className="mt-6 space-y-4">
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

              <div className="rounded-[22px] border border-[#e5d7c8] bg-[#fcf9f5] p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9c7b58]">
                  Transparency
                </div>
                <div className="mt-1 text-sm font-semibold leading-7 text-[#5b4331]">
                  For the most accurate balances, payment history, and receipts, use the Payments page.
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-[#dccab7] bg-white p-6 shadow-[0_12px_28px_rgba(74,51,33,0.06)] md:p-7">
            <h2 className="font-serif text-2xl font-bold text-[#3b271b]">
              Quick Access
            </h2>

            <div className="mt-5 space-y-3">
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
                title="Payments"
                desc="View payment records and financial details."
              />
              <QuickLink
                href="/portal/resources"
                title="Resources"
                desc="Care guidance, prep tips, and important reading."
              />
            </div>
          </div>

          <div className="rounded-[30px] bg-[linear-gradient(135deg,#8f6945_0%,#6f5037_100%)] p-6 text-white shadow-[0_20px_44px_rgba(74,51,33,0.18)] md:p-7">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/75">
              Assistant
            </div>
            <h2 className="mt-2 font-serif text-2xl font-bold">ChiChi Assistant</h2>
            <p className="mt-2 text-sm font-semibold leading-7 text-white/82">
              Need help finding something in your portal? Use the ChiChi chat button in the bottom right for account-aware answers.
            </p>

            <div className="mt-5 rounded-[22px] border border-white/15 bg-white/10 p-4 text-sm font-semibold leading-7 text-white/82">
              Ask about payments, documents, breeder messages, puppy updates, milestones, and more.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function FinancialRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
        {label}
      </span>
      <span className="text-sm font-black text-[#342116]">{value}</span>
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
      className="block rounded-[22px] border border-[#e5d7c8] bg-[#fcf9f5] p-4 transition hover:bg-white"
    >
      <div className="text-sm font-black text-[#342116]">{title}</div>
      <div className="mt-1 text-[12px] font-semibold leading-6 text-[#8d6f52]">
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