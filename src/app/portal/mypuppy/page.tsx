"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { sb, fmtMoney, fmtDate, buildPuppyPhotoUrl } from "@/lib/utils";

type PuppyRow = {
  id: number;
  litter_id: number | null;
  call_name: string | null;
  sire: string | null;
  dam: string | null;
  sex: string | null;
  color: string | null;
  coat_type: string | null;
  dob: string | null;
  registry: string | null;
  price: number | null;
  status: string | null;
  w_1: number | null;
  w_2: number | null;
  w_3: number | null;
  w_4: number | null;
  w_5: number | null;
  w_6: number | null;
  w_7: number | null;
  w_8: number | null;
  buyer_name: string | null;
  litter_name: string | null;
  photo_url: string | null;
  notes: string | null;
  buyer_id: number | null;
  name: string | null;
  coat: string | null;
  buyer: string | null;
  puppy_name: string | null;
  pattern: string | null;
  deposit: number | null;
  balance: number | null;
  created_at: string | null;
  current_weight: number | null;
  microchip: string | null;
  registration_no: string | null;
  birth_weight: number | null;
  weight_unit: string | null;
  weight_date: string | null;
  updated_at: string | null;
  image_url: string | null;
  description: string | null;
  sire_id: number | null;
  dam_id: number | null;
  owner_email: string | null;
};

type PuppyEventRow = {
  id: number;
  created_at: string;
  puppy_id: number;
  event_date: string;
  event_type: string;
  label: string | null;
  details: string | null;
  value: number | null;
  unit: string | null;
  auto_generated: boolean;
};

type PuppyWeightRow = {
  id: number;
  created_at: string;
  puppy_id: number;
  weigh_date: string;
  age_weeks: number | null;
  weight_oz: number | null;
  weight_g: number | null;
  notes: string | null;
  source: string | null;
};

type BuyerRow = {
  id: number;
  email: string | null;
  buyer_email?: string | null;
  full_name?: string | null;
  name?: string | null;
  user_id?: string | null;
};

export default function PortalMyPuppyPage() {
  const [user, setUser] = useState<any>(null);
  const [puppy, setPuppy] = useState<PuppyRow | null>(null);
  const [weights, setWeights] = useState<PuppyWeightRow[]>([]);
  const [events, setEvents] = useState<PuppyEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [statusText, setStatusText] = useState("");

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
          await loadPuppyProfile(currentUser);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: authListener } = sb.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;
        if (!mounted) return;

        setUser(currentUser);

        if (currentUser) {
          await loadPuppyProfile(currentUser);
        } else {
          setPuppy(null);
          setWeights([]);
          setEvents([]);
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function loadPuppyProfile(currUser: any) {
    const email = String(currUser?.email || "").toLowerCase();
    const uid = currUser?.id;

    setStatusText("Loading puppy profile...");

    let matchedBuyer: BuyerRow | null = null;
    let matchedPuppy: PuppyRow | null = null;

    try {
      const buyerRes = await sb
        .from("buyers")
        .select("*")
        .or(`user_id.eq.${uid},email.ilike.%${email}%,buyer_email.ilike.%${email}%`)
        .limit(1)
        .maybeSingle();

      matchedBuyer = (buyerRes.data as BuyerRow | null) ?? null;
    } catch {
      matchedBuyer = null;
    }

    if (matchedBuyer?.id) {
      const puppyByBuyer = await sb
        .from("puppies")
        .select("*")
        .eq("buyer_id", matchedBuyer.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      matchedPuppy = (puppyByBuyer.data as PuppyRow | null) ?? null;
    }

    if (!matchedPuppy) {
      const puppyByEmail = await sb
        .from("puppies")
        .select("*")
        .or(`owner_email.ilike.%${email}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      matchedPuppy = (puppyByEmail.data as PuppyRow | null) ?? null;
    }

    setPuppy(matchedPuppy);

    if (!matchedPuppy?.id) {
      setWeights([]);
      setEvents([]);
      setStatusText("");
      return;
    }

    const [weightsRes, eventsRes] = await Promise.all([
      sb
        .from("puppy_weights")
        .select("*")
        .eq("puppy_id", matchedPuppy.id)
        .order("weigh_date", { ascending: false })
        .limit(20),
      sb
        .from("puppy_events")
        .select("*")
        .eq("puppy_id", matchedPuppy.id)
        .order("event_date", { ascending: true }),
    ]);

    setWeights((weightsRes.data as PuppyWeightRow[]) || []);
    setEvents((eventsRes.data as PuppyEventRow[]) || []);
    setStatusText("");
  }

  async function handleRefresh() {
    if (!user) return;
    await loadPuppyProfile(user);
  }

  async function handleSignOut() {
    await sb.auth.signOut();
    setUser(null);
    setPuppy(null);
    setWeights([]);
    setEvents([]);
  }

  const puppyName =
    puppy?.call_name || puppy?.puppy_name || puppy?.name || "Your Puppy";

  const puppyImage =
    buildPuppyPhotoUrl(puppy?.image_url || puppy?.photo_url || "") ||
    "https://images.unsplash.com/photo-1591769225440-811ad7d6eca6?auto=format&fit=crop&w=1200&q=80";

  const pudates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return events.filter((event) => {
      const eventDate = new Date(event.event_date);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate.getTime() <= today.getTime();
    });
  }, [events]);

  const weeklyWeights = useMemo(() => {
    if (!puppy) return [];

    const quickWeights = [
      { label: "Week 1", value: puppy.w_1 },
      { label: "Week 2", value: puppy.w_2 },
      { label: "Week 3", value: puppy.w_3 },
      { label: "Week 4", value: puppy.w_4 },
      { label: "Week 5", value: puppy.w_5 },
      { label: "Week 6", value: puppy.w_6 },
      { label: "Week 7", value: puppy.w_7 },
      { label: "Week 8", value: puppy.w_8 },
    ];

    return quickWeights.filter(
      (w) => w.value !== null && w.value !== undefined && Number(w.value) > 0
    );
  }, [puppy]);

  const latestWeight = useMemo(() => {
    if (weights.length) {
      const first = weights[0];
      return {
        oz: first.weight_oz,
        g: first.weight_g,
        ageWeeks: first.age_weeks,
      };
    }

    if (puppy?.current_weight) {
      return {
        oz: puppy.current_weight,
        g: null,
        ageWeeks: null,
      };
    }

    const fallback = weeklyWeights
      .slice()
      .reverse()
      .find((w) => Number(w.value) > 0);

    if (!fallback) return null;

    const ageWeeks = Number(fallback.label.replace("Week ", ""));
    return {
      oz: Number(fallback.value),
      g: null,
      ageWeeks,
    };
  }, [weights, puppy, weeklyWeights]);

  const projectedAdultWeight = useMemo(() => {
    if (!latestWeight?.oz) return "—";

    const currentOz = Number(latestWeight.oz);
    const ageWeeks = latestWeight.ageWeeks;

    if (!currentOz || !ageWeeks) return "—";

    let projectedOz = 0;

    if (ageWeeks >= 12) {
      projectedOz = currentOz * 2;
    } else if (ageWeeks >= 8) {
      projectedOz = currentOz * 2.5;
    } else if (ageWeeks >= 6) {
      projectedOz = currentOz * 3;
    } else {
      projectedOz = currentOz * 3.5;
    }

    const pounds = projectedOz / 16;
    return `${pounds.toFixed(1)} lbs est.`;
  }, [latestWeight]);

  const ageDisplay = useMemo(() => {
    if (!puppy?.dob) return "—";

    const dob = new Date(puppy.dob);
    const today = new Date();
    const diffMs = today.getTime() - dob.getTime();
    const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    const weeks = Math.floor(diffDays / 7);

    if (weeks < 1) return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
    return `${weeks} week${weeks === 1 ? "" : "s"}`;
  }, [puppy]);

  const buyerExperience = useMemo(() => {
    if (!puppy) return "Companion";

    if ((puppy.registry || "").toLowerCase().includes("akc")) return "AKC puppy";
    if ((puppy.registry || "").toLowerCase().includes("ckc")) return "CKC puppy";
    if ((puppy.registry || "").toLowerCase().includes("aca")) return "ACA puppy";
    return "Family puppy";
  }, [puppy]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-50 italic">
        Loading My Puppy...
      </div>
    );
  }

  if (!user) {
    return <MyPuppyLogin />;
  }

  return (
    <div className="flex h-screen overflow-hidden text-brand-900 bg-brand-50">
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white/80 backdrop-blur-md h-16 flex items-center justify-between px-6 border-b border-brand-200/50">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsDrawerOpen(true)} className="text-brand-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-serif font-bold text-xl">SWVA</span>
        </div>

        <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center border border-brand-200 font-bold text-brand-600">
          {user.email?.[0]?.toUpperCase() || "U"}
        </div>
      </header>

      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-brand-900/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

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
          <Link href="/portal" className="nav-item">Dashboard</Link>
          <Link href="/portal/application" className="nav-item">Application</Link>
          <Link href="/portal/mypuppy" className="nav-item active">My Puppy</Link>
          <Link href="/portal/messages" className="nav-item">Messages</Link>
          <Link href="/portal/documents" className="nav-item">Documents</Link>
          <Link href="/portal/payments" className="nav-item">Financials</Link>
          <Link href="/portal/resources" className="nav-item">Resources</Link>
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
            <Link href="/portal" className="nav-item">Dashboard</Link>
            <Link href="/portal/application" className="nav-item">Application</Link>
            <Link href="/portal/mypuppy" className="nav-item active">My Puppy</Link>
          </div>

          <div className="px-4 py-2 mt-8 text-[10px] font-black uppercase tracking-widest text-brand-400">
            Communication
          </div>

          <div className="mt-3 flex flex-col gap-3">
            <Link href="/portal/messages" className="nav-item">Messages</Link>
            <Link href="/portal/documents" className="nav-item">Contracts</Link>
            <Link href="/portal/payments" className="nav-item">Financials</Link>
            <Link href="/portal/resources" className="nav-item">Resources</Link>
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
                  onClick={handleRefresh}
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
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 h-full relative flex flex-col overflow-hidden bg-texturePaper pt-16 md:pt-0">
        <div className="flex-1 p-6 md:p-10 lg:p-12 overflow-y-auto scroller max-w-[1600px] mx-auto w-full">
          <div className="space-y-8 pb-14">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-brand-200 shadow-paper">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                    My Puppy
                  </span>
                  <span className="w-1 h-1 rounded-full bg-brand-300" />
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                    SWVA Chihuahua
                  </span>
                </div>

                <h2 className="mt-5 font-serif text-4xl md:text-5xl font-bold text-brand-900 leading-[0.95]">
                  {puppy ? puppyName : "My Puppy"}
                </h2>

                <p className="mt-2 text-brand-500 font-semibold">
                  {puppy
                    ? "A complete view of your puppy’s profile, milestones, progress, and updates."
                    : "Your puppy profile will appear here once a puppy has been matched to your portal."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {puppy?.status ? (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] bg-white border border-brand-200 text-brand-700">
                    Status: {puppy.status}
                  </span>
                ) : null}

                {puppy?.registry ? (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] bg-white border border-brand-200 text-brand-700">
                    Registry: {puppy.registry}
                  </span>
                ) : null}
              </div>
            </div>

            {statusText ? (
              <div className="text-sm font-semibold text-brand-500">{statusText}</div>
            ) : null}

            {!puppy ? (
              <div className="card-luxury p-12 text-center border-dashed border-2 border-brand-200">
                <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl border border-brand-200">
                  🐾
                </div>
                <h3 className="font-serif text-3xl font-bold text-brand-800">
                  No Puppy Assigned Yet
                </h3>
                <p className="text-brand-500 mt-3 max-w-md mx-auto text-sm font-semibold leading-relaxed">
                  Once your application is approved and a puppy is assigned to your portal, the full profile will appear here automatically.
                </p>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <Link
                    href="/portal/application"
                    className="px-6 py-3 rounded-xl bg-brand-800 text-white font-black text-xs uppercase tracking-[0.18em] hover:bg-brand-700 transition shadow-lift"
                  >
                    View Application →
                  </Link>
                  <Link
                    href="/portal/messages"
                    className="px-6 py-3 rounded-xl bg-white border border-brand-200 text-brand-800 font-black text-xs uppercase tracking-[0.18em] hover:bg-brand-50 transition shadow-paper"
                  >
                    Message Support →
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-8 space-y-8">
                    <div className="card-luxury overflow-hidden group">
                      <div className="relative h-[470px] w-full bg-brand-900">
                        <img
                          src={puppyImage}
                          className="w-full h-full object-cover opacity-95 group-hover:scale-[1.03] transition duration-700 ease-in-out"
                          alt={puppyName}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

                        <div className="absolute top-6 left-6 flex flex-wrap items-center gap-2">
                          {puppy.sex ? (
                            <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-white border border-white/30 rounded-full text-[10px] font-black uppercase tracking-[0.22em]">
                              {puppy.sex}
                            </span>
                          ) : null}

                          {puppy.color ? (
                            <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-white border border-white/30 rounded-full text-[10px] font-black uppercase tracking-[0.22em]">
                              {puppy.color}
                            </span>
                          ) : null}

                          {puppy.coat_type || puppy.coat ? (
                            <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-white border border-white/30 rounded-full text-[10px] font-black uppercase tracking-[0.22em]">
                              {puppy.coat_type || puppy.coat}
                            </span>
                          ) : null}
                        </div>

                        <div className="absolute bottom-0 left-0 p-8">
                          <h3 className="font-serif text-5xl font-bold text-white mb-2 leading-none">
                            {puppyName}
                          </h3>
                          <p className="text-white/85 text-sm font-semibold max-w-xl">
                            {puppy.description ||
                              "Your puppy’s profile, milestones, progress, and breeder updates all in one place."}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <InfoTile label="Price" value={puppy.price ? fmtMoney(puppy.price) : "—"} />
                      <InfoTile label="Deposit" value={puppy.deposit ? fmtMoney(puppy.deposit) : "—"} />
                      <InfoTile label="Balance" value={puppy.balance ? fmtMoney(puppy.balance) : "—"} />
                      <InfoTile label="Age" value={ageDisplay} />
                    </div>

                    <div className="card-luxury p-7">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-serif text-2xl font-bold text-brand-900">
                            At a Glance
                          </h3>
                          <p className="text-brand-500 font-semibold text-sm mt-1">
                            A polished overview of your puppy’s details and progress.
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <SummaryCard label="Call Name" value={puppy.call_name || puppy.puppy_name || puppy.name || "—"} />
                        <SummaryCard label="Litter Name" value={puppy.litter_name || "—"} />
                        <SummaryCard label="Type" value={buyerExperience} />
                        <SummaryCard label="Sex" value={puppy.sex || "—"} />
                        <SummaryCard label="Color" value={puppy.color || "—"} />
                        <SummaryCard label="Pattern" value={puppy.pattern || "—"} />
                        <SummaryCard label="Coat Type" value={puppy.coat_type || puppy.coat || "—"} />
                        <SummaryCard label="DOB" value={puppy.dob ? fmtDate(puppy.dob) : "—"} />
                        <SummaryCard label="Registry" value={puppy.registry || "—"} />
                        <SummaryCard label="Sire" value={puppy.sire || "—"} />
                        <SummaryCard label="Dam" value={puppy.dam || "—"} />
                        <SummaryCard label="Status" value={puppy.status || "—"} />
                        <SummaryCard label="Birth Weight" value={formatWeight(puppy.birth_weight, puppy.weight_unit)} />
                        <SummaryCard label="Current Weight" value={formatWeight(puppy.current_weight, puppy.weight_unit)} />
                        <SummaryCard label="Projected Adult Weight" value={projectedAdultWeight} />
                        <SummaryCard label="Weight Date" value={puppy.weight_date ? fmtDate(puppy.weight_date) : "—"} />
                        <SummaryCard label="Microchip" value={puppy.microchip || "—"} />
                        <SummaryCard label="Registration No." value={puppy.registration_no || "—"} />
                      </div>

                      {(puppy.description || puppy.notes) ? (
                        <div className="mt-6 grid grid-cols-1 gap-4">
                          {puppy.description ? (
                            <div className="rounded-2xl border border-brand-200 bg-white/60 p-4">
                              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
                                About Your Puppy
                              </div>
                              <div className="mt-2 text-sm font-semibold text-brand-800 whitespace-pre-wrap">
                                {puppy.description}
                              </div>
                            </div>
                          ) : null}

                          {puppy.notes ? (
                            <div className="rounded-2xl border border-brand-200 bg-white/60 p-4">
                              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
                                Breeder Notes
                              </div>
                              <div className="mt-2 text-sm font-semibold text-brand-800 whitespace-pre-wrap">
                                {puppy.notes}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="card-luxury p-7">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-serif text-2xl font-bold text-brand-900">
                            Weight Tracking
                          </h3>
                          <p className="text-brand-500 font-semibold text-sm mt-1">
                            Weekly growth and recorded weigh-ins, plus projected adult size.
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <HighlightCard
                          label="Current Weight"
                          value={formatWeight(
                            latestWeight?.oz || puppy.current_weight,
                            puppy.weight_unit || "oz"
                          )}
                        />
                        <HighlightCard
                          label="Age at Last Weight"
                          value={
                            latestWeight?.ageWeeks !== null &&
                            latestWeight?.ageWeeks !== undefined
                              ? `${latestWeight.ageWeeks} weeks`
                              : "—"
                          }
                        />
                        <HighlightCard
                          label="Projected Adult Weight"
                          value={projectedAdultWeight}
                        />
                      </div>

                      {weeklyWeights.length ? (
                        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                          {weeklyWeights.map((item) => (
                            <InfoTile
                              key={item.label}
                              label={item.label}
                              value={formatWeight(Number(item.value), puppy.weight_unit || "oz")}
                            />
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-6 space-y-3">
                        {weights.length ? (
                          weights.map((w) => (
                            <div
                              key={w.id}
                              className="p-4 rounded-2xl bg-white/70 border border-brand-200"
                            >
                              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div>
                                  <div className="text-sm font-black text-brand-900">
                                    {w.weigh_date ? fmtDate(w.weigh_date) : "Recorded Weight"}
                                  </div>
                                  <div className="text-[12px] text-brand-500 font-semibold mt-1">
                                    {w.age_weeks !== null && w.age_weeks !== undefined
                                      ? `Age: ${w.age_weeks} week${w.age_weeks === 1 ? "" : "s"}`
                                      : "Age not provided"}
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  {w.weight_oz ? (
                                    <span className="px-3 py-1 rounded-full bg-brand-100 border border-brand-200 text-[11px] font-black uppercase tracking-[0.18em] text-brand-700">
                                      {w.weight_oz} oz
                                    </span>
                                  ) : null}
                                  {w.weight_g ? (
                                    <span className="px-3 py-1 rounded-full bg-brand-100 border border-brand-200 text-[11px] font-black uppercase tracking-[0.18em] text-brand-700">
                                      {w.weight_g} g
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              {w.notes ? (
                                <div className="mt-3 text-sm font-semibold text-brand-700 whitespace-pre-wrap">
                                  {w.notes}
                                </div>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-10 text-brand-400 text-sm italic">
                            No detailed weight entries have been posted yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-4 space-y-6">
                    <div className="card-luxury p-7">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <h3 className="font-serif text-2xl font-bold text-brand-900">
                          Pupdates
                        </h3>
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-400">
                          Live Now
                        </span>
                      </div>

                      <div className="space-y-3">
                        {pudates.length ? (
                          pudates.map((event) => (
                            <div
                              key={event.id}
                              className="p-4 rounded-2xl bg-white/70 border border-brand-200"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
                                  {event.event_type || "Update"}
                                </div>
                                <div className="text-[10px] text-brand-300 font-semibold">
                                  {fmtDate(event.event_date)}
                                </div>
                              </div>

                              <div className="mt-2 text-sm font-black text-brand-900">
                                {event.label || "Update"}
                              </div>

                              {event.details ? (
                                <div className="mt-1 text-[12px] text-brand-600 font-semibold leading-relaxed">
                                  {event.details}
                                </div>
                              ) : null}

                              {event.value !== null && event.value !== undefined ? (
                                <div className="mt-3 text-[11px] font-black uppercase tracking-[0.18em] text-brand-700">
                                  {event.value} {event.unit || ""}
                                </div>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-10 text-brand-400 text-sm italic">
                            No pupdates have been posted yet.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="card-luxury p-7">
                      <h3 className="font-serif text-2xl font-bold text-brand-900 mb-4">
                        Personality & Highlights
                      </h3>

                      <div className="space-y-4">
                        <MiniInfo label="Family Type" value={buyerExperience} />
                        <MiniInfo
                          label="Coat"
                          value={puppy.coat_type || puppy.coat || "—"}
                        />
                        <MiniInfo
                          label="Color / Pattern"
                          value={[puppy.color, puppy.pattern].filter(Boolean).join(" • ") || "—"}
                        />
                        <MiniInfo
                          label="Registration"
                          value={puppy.registry || "—"}
                        />
                        <MiniInfo
                          label="Go-Home Progress"
                          value={puppy.status || "In Progress"}
                        />
                      </div>
                    </div>

                    <div className="card-luxury p-7">
                      <h3 className="font-serif text-2xl font-bold text-brand-900 mb-4">
                        Quick Links
                      </h3>

                      <div className="space-y-3">
                        <Link
                          href="/portal/messages"
                          className="block p-4 rounded-2xl bg-white/70 border border-brand-200 hover:bg-white transition"
                        >
                          <div className="text-sm font-black text-brand-900">Messages</div>
                          <div className="mt-1 text-[12px] text-brand-500 font-semibold">
                            Ask questions or request updates.
                          </div>
                        </Link>

                        <Link
                          href="/portal/documents"
                          className="block p-4 rounded-2xl bg-white/70 border border-brand-200 hover:bg-white transition"
                        >
                          <div className="text-sm font-black text-brand-900">Documents</div>
                          <div className="mt-1 text-[12px] text-brand-500 font-semibold">
                            View contracts and saved portal documents.
                          </div>
                        </Link>

                        <Link
                          href="/portal/payments"
                          className="block p-4 rounded-2xl bg-white/70 border border-brand-200 hover:bg-white transition"
                        >
                          <div className="text-sm font-black text-brand-900">Financials</div>
                          <div className="mt-1 text-[12px] text-brand-500 font-semibold">
                            Review payment activity and remaining balance.
                          </div>
                        </Link>

                        <Link
                          href="/portal/resources"
                          className="block p-4 rounded-2xl bg-white/70 border border-brand-200 hover:bg-white transition"
                        >
                          <div className="text-sm font-black text-brand-900">Resources</div>
                          <div className="mt-1 text-[12px] text-brand-500 font-semibold">
                            Puppy prep, feeding guidance, and care help.
                          </div>
                        </Link>
                      </div>
                    </div>

                    <div className="rounded-3xl bg-brand-800 text-white p-7 shadow-luxury">
                      <h4 className="font-serif text-2xl font-bold">Need an Update?</h4>
                      <p className="mt-2 text-brand-200 text-sm font-semibold">
                        Use Messages anytime if you would like a fresh note, photo, or progress update.
                      </p>
                      <Link
                        href="/portal/messages"
                        className="inline-block mt-5 px-5 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-black uppercase tracking-[0.18em] hover:bg-white/20 transition"
                      >
                        Message Support
                      </Link>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-luxury p-5 text-center">
      <div className="text-[11px] font-black text-brand-700 uppercase tracking-[0.18em]">
        {label}
      </div>
      <div className="mt-2 text-sm font-black text-brand-900 break-words">{value}</div>
    </div>
  );
}

function HighlightCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-white/70 p-5">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
        {label}
      </div>
      <div className="mt-2 text-xl font-black text-brand-900">{value}</div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-white/65 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-black text-brand-900 break-words">{value}</div>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-white/65 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-brand-800">{value}</div>
    </div>
  );
}

function formatWeight(value?: number | null, unit?: string | null) {
  if (value === null || value === undefined || Number(value) === 0) return "—";
  return `${value} ${unit || ""}`.trim();
}

function MyPuppyLogin() {
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