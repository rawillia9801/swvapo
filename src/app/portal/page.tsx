"use client";

import React, { useEffect, useState } from "react";
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

function statusPill(statusRaw: any, type?: "application" | "puppy") {
  const raw = String(statusRaw || "").trim();
  const s = raw.toLowerCase();

  let cls =
    "bg-gray-100 text-gray-700 border border-gray-200";
  let label = raw || "Status";

  if (
    ["approved", "complete", "completed", "matched", "active"].some((x) =>
      s.includes(x)
    )
  ) {
    cls = "bg-emerald-50 text-emerald-700 border border-emerald-200";
  } else if (
    ["pending", "review", "processing", "await", "in progress"].some((x) =>
      s.includes(x)
    )
  ) {
    cls = "bg-amber-50 text-amber-700 border border-amber-200";
  } else if (
    ["denied", "rejected", "cancel"].some((x) => s.includes(x))
  ) {
    cls = "bg-rose-50 text-rose-700 border border-rose-200";
  }

  if (!raw && type === "application") label = "Pending";
  if (!raw && type === "puppy") label = "Pending Match";

  return {
    cls,
    label,
  };
}

function nextSteps(hasApp: boolean, hasPuppy: boolean) {
  if (hasPuppy) {
    return [
      {
        icon: "📄",
        title: "Review Contracts",
        desc: "Open your documents and confirm you’re set.",
        href: "/portal/documents",
        cta: "Open Documents",
      },
      {
        icon: "🚗",
        title: "Pickup / Delivery",
        desc: "Confirm the plan and timing for go-home day.",
        href: "/portal/pickup",
        cta: "Open Checklist",
      },
      {
        icon: "💬",
        title: "Check Messages",
        desc: "Time-sensitive updates will show up there first.",
        href: "/portal/messages",
        cta: "Open Inbox",
      },
      {
        icon: "📚",
        title: "Care Resources",
        desc: "Hypoglycemia, schedule, and first-week guidance.",
        href: "/portal/resources",
        cta: "Open Resources",
      },
    ];
  }

  if (hasApp) {
    return [
      {
        icon: "✅",
        title: "Application Received",
        desc: "We’ll review and message you with next steps.",
        href: "/portal/messages",
        cta: "Open Messages",
      },
      {
        icon: "📄",
        title: "Pre-Read Contracts",
        desc: "Get familiar before the match is finalized.",
        href: "/portal/documents",
        cta: "View Contracts",
      },
      {
        icon: "📚",
        title: "New Puppy Prep",
        desc: "First days, feeding, routine, and safety.",
        href: "/portal/resources",
        cta: "Open Resources",
      },
      {
        icon: "📝",
        title: "Update Application",
        desc: "If something changed, update it anytime.",
        href: "/portal/application",
        cta: "Open Application",
      },
    ];
  }

  return [
    {
      icon: "📝",
      title: "Start Application",
      desc: "This is how we get you approved and matched.",
      href: "/portal/application",
      cta: "Start Now",
    },
    {
      icon: "📄",
      title: "Read Agreements",
      desc: "See policies up front so there are no surprises.",
      href: "/portal/documents",
      cta: "View Contracts",
    },
    {
      icon: "📚",
      title: "Learn the Basics",
      desc: "Hypoglycemia, vaccination, first-week tips.",
      href: "/portal/resources",
      cta: "Open Resources",
    },
    {
      icon: "💬",
      title: "Ask a Question",
      desc: "Use Messages if you’re unsure about anything.",
      href: "/portal/messages",
      cta: "Open Messages",
    },
  ];
}

export default function PortalPage() {
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [lastSync, setLastSync] = useState("—");

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

    let buyer: any = null;
    let app: any = null;
    let puppy: any = null;
    let msgs: any[] = [];
    let updates: any[] = [];
    let docCount = 0;

    const buyerRes = await sb
      .from(T.buyers)
      .select("*")
      .or(`user_id.eq.${uid},email.ilike.%${email}%`)
      .limit(1)
      .maybeSingle();

    buyer = buyerRes.data ?? null;

    const appRes = await sb
      .from(T.applications)
      .select("*")
      .or(`user_id.eq.${uid},email.ilike.%${email}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    app = appRes.data ?? null;

    if (buyer?.id) {
      const puppyByBuyerRes = await sb
        .from(T.puppies)
        .select("*")
        .eq("buyer_id", buyer.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      puppy = puppyByBuyerRes.data ?? null;
    }

    if (!puppy) {
      const puppyByEmailRes = await sb
        .from(T.puppies)
        .select("*")
        .or(
          `owner_email.ilike.%${email}%,buyer_email.ilike.%${email}%,email.ilike.%${email}%`
        )
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      puppy = puppyByEmailRes.data ?? null;
    }

    if (buyer?.id) {
      const msgRes = await sb
        .from(T.messages)
        .select("*")
        .or(`buyer_id.eq.${buyer.id},user_id.eq.${uid}`)
        .order("created_at", { ascending: false })
        .limit(5);

      msgs = msgRes.data || [];
    } else {
      const msgRes = await sb
        .from(T.messages)
        .select("*")
        .or(`user_id.eq.${uid},email.ilike.%${email}%,user_email.ilike.%${email}%`)
        .order("created_at", { ascending: false })
        .limit(5);

      msgs = msgRes.data || [];
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
          .order("created_at", { ascending: false })
          .limit(6);

        if (!updatesRes.error) {
          updates = updatesRes.data || [];
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

    setLastSync(
      `Last sync: ${new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`
    );
  }

  async function handleSignOut() {
    await sb.auth.signOut();
    setUser(null);
    setData(null);
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-50 italic">
        Loading Portal...
      </div>
    );
  }

  if (!user) return <LoginComponent />;

  const hasPuppy = !!data?.puppy;
  const hasApp = !!data?.app;

  const appStatus = statusPill(data?.app?.status || data?.app?.application_status, "application");
  const puppyStatus = statusPill(
    data?.puppy?.status || data?.puppy?.assignment_status || (hasPuppy ? "In Progress" : "Pending Match"),
    "puppy"
  );

  const heroTitle = hasPuppy
    ? `Match Confirmed: ${data?.puppy?.call_name || data?.puppy?.name || "Your Puppy"}`
    : hasApp
    ? "Application Received"
    : "Welcome Aboard";

  const heroDesc = hasPuppy
    ? "You’re matched. Review documents, confirm pickup/delivery, and keep an eye on Messages for updates."
    : hasApp
    ? "Your application is in review. We’ll message you with next steps and any questions."
    : "Start with the application. Once approved and matched, your puppy profile and documents will appear automatically.";

  const greetingName = hasPuppy
    ? `${data?.puppy?.call_name || data?.puppy?.name || "Puppy"}'s Family`
    : data?.buyer?.full_name || "Family";

  const puppyImage =
    buildPuppyPhotoUrl(
      data?.puppy?.image_url ||
        data?.puppy?.image_path ||
        data?.puppy?.photo_url ||
        data?.puppy?.photo ||
        data?.puppy?.image
    ) ||
    "https://images.unsplash.com/photo-1591769225440-811ad7d6eca6?auto=format&fit=crop&w=1200&q=80";

  const actionHref = hasPuppy
    ? "/portal/pickup"
    : "/portal/application";

  const actionLabel = hasPuppy
    ? "Open Checklist"
    : hasApp
    ? "View Application"
    : "Start Now";

  const steps = nextSteps(hasApp, hasPuppy);

  return (
    <div className="flex h-screen overflow-hidden text-brand-900 bg-brand-50">
      {/* MOBILE HEADER */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white/80 backdrop-blur-md h-16 flex items-center justify-between px-6 border-b border-brand-200/50">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsDrawerOpen(true)} className="text-brand-700">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <span className="font-serif font-bold text-xl">SWVA</span>
        </div>

        <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center border border-brand-200 font-bold text-brand-600">
          {user.email?.[0]?.toUpperCase() || "U"}
        </div>
      </header>

      {/* MOBILE DRAWER OVERLAY */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-brand-900/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* MOBILE DRAWER */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-[82%] max-w-[320px] bg-[#FDFBF9] z-50 shadow-2xl flex flex-col transition-transform duration-300 md:hidden ${
          isDrawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 border-b border-brand-100 flex justify-between items-center">
          <div>
            <div className="font-serif font-bold text-xl">Menu</div>
            <div className="text-[11px] text-brand-400 font-semibold mt-1 truncate max-w-[220px]">
              {user.email}
            </div>
          </div>
          <button onClick={() => setIsDrawerOpen(false)}>×</button>
        </div>

        <nav className="p-5 pt-7 flex flex-col gap-3 flex-1 overflow-y-auto">
          <Link href="/portal" className="nav-item active">
            Dashboard
          </Link>
          <Link href="/portal/application" className="nav-item">
            Application
          </Link>
          <Link href="/portal/mypuppy" className="nav-item">
            My Puppy
          </Link>
          <Link href="/portal/messages" className="nav-item">
            Messages
          </Link>
          <Link href="/portal/documents" className="nav-item">
            Documents
          </Link>
          <Link href="/portal/payments" className="nav-item">
            Financials
          </Link>
          <Link href="/portal/resources" className="nav-item">
            Resources
          </Link>
        </nav>

        <div className="p-6 border-t border-brand-100 bg-brand-50">
          <button
            onClick={handleSignOut}
            className="w-full py-3 rounded-lg border border-brand-200 text-brand-700 font-black text-sm hover:bg-white transition"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-72 bg-white/80 border-r border-brand-200/60 z-20 h-full backdrop-blur-sm">
        <div className="p-8">
          <h1 className="font-serif font-bold text-xl leading-none">SWVA</h1>
          <p className="text-[10px] uppercase tracking-widest text-brand-500 font-black mt-1">
            Chihuahua
          </p>
        </div>

        <nav className="flex-1 px-4 pt-6 pb-6 overflow-y-auto">
          <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-brand-400">
            Portal
          </div>

          <div className="mt-3 flex flex-col gap-3">
            <Link href="/portal" className="nav-item active">
              Dashboard
            </Link>
            <Link href="/portal/application" className="nav-item">
              Application
            </Link>
            <Link href="/portal/mypuppy" className="nav-item">
              My Puppy
            </Link>
          </div>

          <div className="px-4 py-2 mt-8 text-[10px] font-black uppercase tracking-widest text-brand-400">
            Communication
          </div>

          <div className="mt-3 flex flex-col gap-3">
            <Link href="/portal/messages" className="nav-item">
              Messages
            </Link>
            <Link href="/portal/documents" className="nav-item">
              Contracts
            </Link>
            <Link href="/portal/payments" className="nav-item">
              Financials
            </Link>
            <Link href="/portal/resources" className="nav-item">
              Resources
            </Link>
          </div>
        </nav>

        <div className="p-4 border-t border-brand-100 bg-brand-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-200 flex items-center justify-center text-brand-700 font-black text-xs">
              {user.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black truncate">{user.email}</p>
              <div className="flex items-center gap-3 mt-1">
                <button
                  onClick={() => loadData(user)}
                  className="text-[10px] font-black uppercase text-brand-500 hover:text-brand-800"
                >
                  Refresh
                </button>
                <button
                  onClick={handleSignOut}
                  className="text-[10px] font-black uppercase text-brand-500 hover:text-brand-800"
                >
                  Sign Out
                </button>
              </div>
              <p className="text-[10px] text-brand-400 font-semibold mt-1">{lastSync}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 h-full relative flex flex-col overflow-hidden bg-texturePaper pt-16 md:pt-0">
        <div className="flex-1 p-6 md:p-10 lg:p-12 overflow-y-auto scroller max-w-[1600px] mx-auto w-full">
          <div className="space-y-10 pb-14">
            {/* TOP */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-brand-200 shadow-paper">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                    My Puppy Portal
                  </span>
                  <span className="w-1 h-1 rounded-full bg-brand-300" />
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                    SWVA Chihuahua
                  </span>
                </div>

                <h2 className="mt-5 font-serif text-4xl md:text-5xl font-bold text-brand-900 leading-[0.95]">
                  Hello, {greetingName}
                </h2>

                <p className="mt-2 text-brand-500 font-semibold">
                  Everything in one place — application, messages, documents, and your puppy profile.
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

                <Link
                  href="/portal/messages"
                  className="px-5 py-3 bg-white border border-brand-200 text-brand-800 font-black text-xs uppercase tracking-[0.18em] rounded-xl hover:bg-brand-50 transition shadow-paper"
                >
                  Inbox ({data?.msgs?.length || 0})
                </Link>
              </div>
            </div>

            {/* HERO */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 card-luxury shine p-7 md:p-9 relative overflow-hidden">
                <div className="relative z-10">
                  <span className="inline-block px-3 py-1 bg-brand-100 text-brand-700 text-[10px] font-black uppercase tracking-[0.22em] rounded-full mb-4 border border-brand-200">
                    Current Status
                  </span>

                  <h3 className="font-serif text-3xl md:text-4xl font-bold text-brand-900 mb-2 leading-[1.05]">
                    {heroTitle}
                  </h3>

                  <p className="text-brand-600 font-semibold max-w-2xl mb-7 leading-relaxed">
                    {heroDesc}
                  </p>

                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={actionHref}
                      className="inline-flex items-center gap-2 px-7 py-3.5 bg-brand-800 text-white font-black text-sm rounded-xl hover:bg-brand-700 transition shadow-lift uppercase tracking-[0.12em]"
                    >
                      {actionLabel} <span aria-hidden="true">→</span>
                    </Link>

                    <Link
                      href="/portal/messages"
                      className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/80 border border-brand-200 text-brand-800 font-black text-sm rounded-xl hover:bg-white transition shadow-paper uppercase tracking-[0.12em]"
                    >
                      Message Support <span aria-hidden="true">↗</span>
                    </Link>
                  </div>

                  <div className="mt-7 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-white/70 border border-brand-200 shadow-paper">
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                        Account
                      </div>
                      <div className="mt-1 text-sm font-black text-brand-900 truncate">
                        {user.email || "—"}
                      </div>
                      <div className="mt-1 text-[11px] text-brand-500 font-semibold">
                        Secure session active
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/70 border border-brand-200 shadow-paper">
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                        Application
                      </div>
                      <div className="mt-1 text-sm font-black text-brand-900">
                        {data?.app?.status || data?.app?.application_status || "Not started"}
                      </div>
                      <div className="mt-1 text-[11px] text-brand-500 font-semibold">
                        {data?.app?.created_at
                          ? `Submitted ${fmtDate(data.app.created_at)}`
                          : "Complete when ready"}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/70 border border-brand-200 shadow-paper">
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                        Puppy
                      </div>
                      <div className="mt-1 text-sm font-black text-brand-900">
                        {hasPuppy
                          ? data?.puppy?.call_name || data?.puppy?.name || "Your Puppy"
                          : "Pending match"}
                      </div>
                      <div className="mt-1 text-[11px] text-brand-500 font-semibold">
                        {hasPuppy
                          ? `Born ${fmtDate(data?.puppy?.dob || data?.puppy?.birth_date)}`
                          : "Will appear after match"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-luxury p-7 bg-gradient-to-br from-[#FFFBF0] to-white border-brand-200 relative overflow-hidden">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-400">
                    Breeder Note
                  </span>
                </div>

                <p className="font-serif text-xl italic text-brand-800 mb-4 leading-relaxed">
                  “We’ll post updates as soon as they’re ready. Keep an eye on Messages for anything time-sensitive.”
                </p>

                <div className="mt-6 pt-4 border-t border-brand-100/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-2xl bg-brand-200 border border-brand-300" />
                    <div>
                      <div className="text-xs font-black text-brand-700">The SWVA Team</div>
                      <div className="text-[11px] text-brand-400 font-semibold">
                        Always here to help
                      </div>
                    </div>
                  </div>

                  <Link
                    href="/portal/resources"
                    className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-500 hover:text-brand-800"
                  >
                    Resources →
                  </Link>
                </div>
              </div>
            </div>

            {/* NEXT STEPS */}
            <div className="card-luxury p-7 md:p-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h4 className="font-serif font-bold text-2xl text-brand-800">Next Steps</h4>
                  <p className="text-brand-500 font-semibold text-sm mt-1">
                    A simple checklist to keep everything moving smoothly.
                  </p>
                </div>

                <Link
                  href={hasPuppy ? "/portal/pickup" : "/portal/application"}
                  className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500 hover:text-brand-800"
                >
                  Open {hasPuppy ? "Checklist" : "Application"} →
                </Link>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {steps.map((step) => (
                  <Link
                    key={step.title}
                    href={step.href}
                    className="p-5 rounded-2xl bg-white/70 border border-brand-200 shadow-paper hover:bg-white transition block"
                  >
                    <div className="text-2xl">{step.icon}</div>
                    <div className="mt-3 text-sm font-black text-brand-900">
                      {step.title}
                    </div>
                    <div className="mt-1 text-[12px] text-brand-500 font-semibold leading-relaxed">
                      {step.desc}
                    </div>
                    <div className="mt-4 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-brand-600">
                      {step.cta} <span aria-hidden="true">→</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* MAIN GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 space-y-8">
                {/* PUPPY / EMPTY STATE */}
                {hasPuppy ? (
                  <div className="card-luxury overflow-hidden group">
                    <div className="relative h-[420px] w-full bg-brand-900">
                      <img
                        src={puppyImage}
                        className="w-full h-full object-cover opacity-92 group-hover:scale-[1.03] transition duration-700 ease-in-out"
                        alt="Puppy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />

                      <div className="absolute top-6 left-6 flex flex-wrap items-center gap-2">
                        <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-white border border-white/30 rounded-full text-[10px] font-black uppercase tracking-[0.22em]">
                          {data?.puppy?.sex || data?.puppy?.gender || "Puppy"}
                        </span>

                        {(data?.puppy?.dob || data?.puppy?.birth_date) && (
                          <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-white border border-white/30 rounded-full text-[10px] font-black uppercase tracking-[0.22em]">
                            Born {fmtDate(data?.puppy?.dob || data?.puppy?.birth_date)}
                          </span>
                        )}

                        {(data?.puppy?.price || data?.puppy?.total_price || data?.puppy?.adoption_fee) && (
                          <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-white border border-white/30 rounded-full text-[10px] font-black uppercase tracking-[0.22em]">
                            Fee {fmtMoney(data?.puppy?.price || data?.puppy?.total_price || data?.puppy?.adoption_fee)}
                          </span>
                        )}
                      </div>

                      <div className="absolute bottom-0 left-0 p-8">
                        <h3 className="font-serif text-5xl font-bold text-white mb-2 leading-none">
                          {data?.puppy?.call_name || data?.puppy?.name || "Your Puppy"}
                        </h3>
                        <p className="text-white/85 text-sm font-semibold max-w-xl">
                          View your puppy’s profile, photos, milestones, and care notes anytime.
                        </p>
                        <div className="mt-5 flex flex-wrap gap-3">
                          <Link
                            href="/portal/mypuppy"
                            className="px-6 py-3 rounded-xl bg-white/15 border border-white/25 text-white font-black text-xs uppercase tracking-[0.18em] hover:bg-white/20 transition"
                          >
                            View Full Profile →
                          </Link>
                          <Link
                            href="/portal/pickup"
                            className="px-6 py-3 rounded-xl bg-white/15 border border-white/25 text-white font-black text-xs uppercase tracking-[0.18em] hover:bg-white/20 transition"
                          >
                            Pickup / Delivery →
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="card-luxury p-12 text-center border-dashed border-2 border-brand-200">
                    <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl border border-brand-200">
                      🐾
                    </div>
                    <h3 className="font-serif text-3xl font-bold text-brand-800">
                      No Puppy Assigned Yet
                    </h3>
                    <p className="text-brand-500 mt-3 max-w-md mx-auto text-sm font-semibold leading-relaxed">
                      Once your application is approved and a match is made, your puppy’s profile, photos, and details will appear here automatically.
                    </p>
                    <div className="mt-6 flex items-center justify-center gap-3">
                      <Link
                        href="/portal/application"
                        className="px-6 py-3 rounded-xl bg-brand-800 text-white font-black text-xs uppercase tracking-[0.18em] hover:bg-brand-700 transition shadow-lift"
                      >
                        Application →
                      </Link>
                      <Link
                        href="/portal/messages"
                        className="px-6 py-3 rounded-xl bg-white border border-brand-200 text-brand-800 font-black text-xs uppercase tracking-[0.18em] hover:bg-brand-50 transition shadow-paper"
                      >
                        Messages →
                      </Link>
                    </div>
                  </div>
                )}

                {/* QUICK TILES */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Link href="/portal/application" className="card-luxury p-5 text-center hover:-translate-y-1 transition">
                    <div className="text-2xl mb-2">📝</div>
                    <div className="text-[11px] font-black text-brand-700 uppercase tracking-[0.18em]">
                      Application
                    </div>
                    <div className="mt-1 text-[11px] text-brand-400 font-semibold">
                      {data?.app?.status || data?.app?.application_status || "Start here"}
                    </div>
                  </Link>

                  <Link href="/portal/documents" className="card-luxury p-5 text-center hover:-translate-y-1 transition">
                    <div className="text-2xl mb-2">📂</div>
                    <div className="text-[11px] font-black text-brand-700 uppercase tracking-[0.18em]">
                      Documents
                    </div>
                    <div className="mt-1 text-[11px] text-brand-400 font-semibold">
                      {data?.docCount ? `${data.docCount} file(s)` : "—"}
                    </div>
                  </Link>

                  <Link href="/portal/payments" className="card-luxury p-5 text-center hover:-translate-y-1 transition">
                    <div className="text-2xl mb-2">💳</div>
                    <div className="text-[11px] font-black text-brand-700 uppercase tracking-[0.18em]">
                      Financials
                    </div>
                    <div className="mt-1 text-[11px] text-brand-400 font-semibold">
                      View history
                    </div>
                  </Link>

                  <Link href="/portal/resources" className="card-luxury p-5 text-center hover:-translate-y-1 transition">
                    <div className="text-2xl mb-2">📚</div>
                    <div className="text-[11px] font-black text-brand-700 uppercase tracking-[0.18em]">
                      Resources
                    </div>
                    <div className="mt-1 text-[11px] text-brand-400 font-semibold">
                      Care & guides
                    </div>
                  </Link>
                </div>

                {/* APPLICATION SUMMARY */}
                <div className="card-luxury p-7">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-serif font-bold text-2xl text-brand-800">
                        Application Summary
                      </h4>
                      <p className="text-brand-500 font-semibold text-sm mt-1">
                        A quick snapshot of what we have on file.
                      </p>
                    </div>

                    <span
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] ${appStatus.cls}`}
                    >
                      {appStatus.label}
                    </span>
                  </div>

                  <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-white/65 border border-brand-200">
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                        Submitted
                      </div>
                      <div className="mt-1 text-sm font-black text-brand-900">
                        {data?.app?.created_at ? fmtDate(data.app.created_at) : "—"}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/65 border border-brand-200">
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                        Interest
                      </div>
                      <div className="mt-1 text-sm font-black text-brand-900 truncate">
                        {data?.app?.puppy_interest ||
                          data?.app?.interest ||
                          data?.app?.puppy_name ||
                          "—"}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/65 border border-brand-200">
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                        Buyer
                      </div>
                      <div className="mt-1 text-sm font-black text-brand-900 truncate">
                        {data?.buyer?.full_name || data?.buyer?.email || user.email || "—"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href="/portal/application"
                      className="px-6 py-3 rounded-xl bg-brand-800 text-white font-black text-xs uppercase tracking-[0.18em] hover:bg-brand-700 transition shadow-lift"
                    >
                      View / Update Application →
                    </Link>
                    <Link
                      href="/portal/messages"
                      className="px-6 py-3 rounded-xl bg-white border border-brand-200 text-brand-800 font-black text-xs uppercase tracking-[0.18em] hover:bg-brand-50 transition shadow-paper"
                    >
                      Ask a Question →
                    </Link>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="lg:col-span-4 space-y-6">
                {/* RECENT MESSAGES */}
                <div className="card-luxury p-7">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-serif font-bold text-2xl text-brand-800">
                      Recent Messages
                    </h4>
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
                          className="p-3 bg-brand-50/50 rounded-xl border border-brand-100 hover:bg-white transition"
                        >
                          <div className="flex justify-between mb-1">
                            <span className="text-[10px] font-black text-brand-500 uppercase tracking-[0.18em]">
                              {m.sender_name || m.sender || m.from_name || "Support"}
                            </span>
                            <span className="text-[10px] text-brand-300 font-semibold">
                              {fmtDate(m.created_at || m.sent_at)}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-brand-800 line-clamp-2">
                            {m.message || m.content || m.body || m.text || "—"}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-brand-400 text-sm italic">
                        No new messages
                      </div>
                    )}
                  </div>

                  <Link
                    href="/portal/messages"
                    className="block text-center w-full mt-5 py-3 rounded-xl bg-brand-100 text-brand-800 text-xs font-black uppercase tracking-[0.18em] hover:bg-brand-200 transition"
                  >
                    Send Message
                  </Link>
                </div>

                {/* LATEST UPDATES */}
                <div className="card-luxury p-7">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-serif font-bold text-2xl text-brand-800">
                      Latest Updates
                    </h4>
                    <Link
                      href="/portal/updates"
                      className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500 hover:text-brand-800"
                    >
                      Open
                    </Link>
                  </div>

                  <div className="space-y-3">
                    {data?.updates?.length ? (
                      data.updates.slice(0, 5).map((u: any) => (
                        <div
                          key={u.id}
                          className="p-3 rounded-xl bg-white/70 border border-brand-200 hover:bg-white transition"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
                              {u.event_type || u.type || u.category || "Update"}
                            </div>
                            <div className="text-[10px] font-semibold text-brand-300">
                              {fmtDate(u.created_at || u.event_date || u.date)}
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
                      <div className="text-center py-8 text-brand-400 text-sm italic">
                        {hasPuppy ? "No updates posted yet." : "Updates appear after a match."}
                      </div>
                    )}
                  </div>
                </div>

                {/* FINANCIAL OVERVIEW */}
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

                  <div className="mt-5 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-black text-brand-500 uppercase tracking-[0.18em]">
                        Adoption Fee
                      </span>
                      <span className="text-sm font-black text-brand-900">
                        {data?.puppy?.price ||
                        data?.puppy?.total_price ||
                        data?.puppy?.adoption_fee
                          ? fmtMoney(
                              data?.puppy?.price ||
                                data?.puppy?.total_price ||
                                data?.puppy?.adoption_fee
                            )
                          : "—"}
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/65 border border-brand-200">
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                        Tip
                      </div>
                      <div className="mt-1 text-sm font-semibold text-brand-800 leading-relaxed">
                        For the most accurate balances and receipts, always use the Financials page.
                      </div>
                    </div>

                    <Link
                      href="/portal/payments"
                      className="block text-center text-[11px] text-brand-600 hover:text-brand-800 font-black underline underline-offset-4"
                    >
                      View Payment History
                    </Link>
                  </div>
                </div>

                {/* HELP */}
                <div className="p-7 rounded-3xl bg-brand-800 text-white text-center shadow-luxury">
                  <h4 className="font-serif font-bold text-2xl mb-1">Need Help?</h4>
                  <p className="text-brand-200 text-sm font-semibold mb-5">
                    Questions about application, pickup, or puppy care?
                  </p>
                  <a
                    href="mailto:support@swvachihuahua.com"
                    className="inline-block px-5 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-black uppercase tracking-[0.18em] hover:bg-white/20 transition"
                  >
                    Contact Breeder
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* FLOATING ACTION */}
      <Link
        href="/portal/messages"
        className="fixed bottom-6 right-6 w-14 h-14 bg-brand-800 text-white rounded-full shadow-luxury flex items-center justify-center hover:scale-105 transition z-50"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </Link>
    </div>
  );
}

function LoginComponent() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const login = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await sb.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error) alert(error.message);
  };

  return (
    <div className="h-screen flex items-center justify-center bg-brand-50 p-6">
      <div className="card-luxury shine p-10 w-full max-w-md border border-white">
        <h2 className="font-serif text-4xl font-bold text-center mb-8">
          Welcome Home
        </h2>

        <form onSubmit={login} className="space-y-5">
          <div>
            <label className="text-[10px] font-black uppercase text-brand-500 mb-1 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-xl border border-brand-200"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-brand-500 mb-1 block">
              Password
            </label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="w-full p-3 rounded-xl border border-brand-200"
              required
            />
          </div>

          <button className="w-full bg-brand-800 text-white p-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lift">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}