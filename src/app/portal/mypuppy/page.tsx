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
  const [statusText, setStatusText] = useState("");
  const [showPastMilestones, setShowPastMilestones] = useState(false);

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
          setStatusText("");
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function tryBuyerByUserId(uid: string | undefined): Promise<BuyerRow | null> {
    if (!uid) return null;

    const { data, error } = await sb
      .from("buyers")
      .select("*")
      .eq("user_id", uid)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("buyers by user_id failed:", error.message);
      return null;
    }

    return (data as BuyerRow | null) ?? null;
  }

  async function tryBuyerByEmail(email: string): Promise<BuyerRow | null> {
    if (!email) return null;

    const attempts = [
      () =>
        sb.from("buyers").select("*").ilike("email", email).limit(1).maybeSingle(),
      () =>
        sb.from("buyers").select("*").ilike("buyer_email", email).limit(1).maybeSingle(),
    ];

    for (const run of attempts) {
      const { data, error } = await run();
      if (!error && data) return data as BuyerRow;
      if (error) console.warn("buyers by email failed:", error.message);
    }

    return null;
  }

  async function tryPuppyByBuyerId(buyerId: number | null | undefined): Promise<PuppyRow | null> {
    if (!buyerId) return null;

    const { data, error } = await sb
      .from("puppies")
      .select("*")
      .eq("buyer_id", buyerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("puppies by buyer_id failed:", error.message);
      return null;
    }

    return (data as PuppyRow | null) ?? null;
  }

  async function tryPuppyByOwnerEmail(email: string): Promise<PuppyRow | null> {
    if (!email) return null;

    const { data, error } = await sb
      .from("puppies")
      .select("*")
      .ilike("owner_email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("puppies by owner_email failed:", error.message);
      return null;
    }

    return (data as PuppyRow | null) ?? null;
  }

  async function loadPuppyProfile(currUser: any) {
    const email = String(currUser?.email || "").trim().toLowerCase();
    const uid = currUser?.id as string | undefined;

    setStatusText("Loading puppy profile...");
    setPuppy(null);
    setWeights([]);
    setEvents([]);

    try {
      let matchedBuyer: BuyerRow | null = null;
      let matchedPuppy: PuppyRow | null = null;

      matchedBuyer = await tryBuyerByUserId(uid);

      if (!matchedBuyer && email) {
        matchedBuyer = await tryBuyerByEmail(email);
      }

      if (matchedBuyer?.id) {
        matchedPuppy = await tryPuppyByBuyerId(matchedBuyer.id);
      }

      if (!matchedPuppy && email) {
        matchedPuppy = await tryPuppyByOwnerEmail(email);
      }

      setPuppy(matchedPuppy);

      if (!matchedPuppy?.id) {
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

      if (weightsRes.error) {
        console.warn("puppy_weights fetch failed:", weightsRes.error.message);
        setWeights([]);
      } else {
        setWeights((weightsRes.data as PuppyWeightRow[]) || []);
      }

      if (eventsRes.error) {
        console.warn("puppy_events fetch failed:", eventsRes.error.message);
        setEvents([]);
      } else {
        setEvents((eventsRes.data as PuppyEventRow[]) || []);
      }

      setStatusText("");
    } catch (error) {
      console.error("loadPuppyProfile failed:", error);
      setPuppy(null);
      setWeights([]);
      setEvents([]);
      setStatusText("");
    }
  }

  async function handleRefresh() {
    if (!user) return;
    await loadPuppyProfile(user);
  }

  const puppyName =
    puppy?.call_name || puppy?.puppy_name || puppy?.name || "Your Puppy";

  const puppyImage =
    buildPuppyPhotoUrl(puppy?.image_url || puppy?.photo_url || "") ||
    "https://images.unsplash.com/photo-1591769225440-811ad7d6eca6?auto=format&fit=crop&w=1200&q=80";

  const visibleEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (events || []).filter((event) => {
      const eventDate = new Date(event.event_date);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate.getTime() <= today.getTime();
    });
  }, [events]);

  const latestMilestone = useMemo(() => {
    if (!visibleEvents.length) return null;
    return [...visibleEvents].sort(
      (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
    )[0];
  }, [visibleEvents]);

  const pastMilestones = useMemo(() => {
    if (!latestMilestone) return visibleEvents;
    return [...visibleEvents]
      .filter((e) => e.id !== latestMilestone.id)
      .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
  }, [visibleEvents, latestMilestone]);

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

  const ageNumber = useMemo(() => {
    if (!puppy?.dob) return null;
    const dob = new Date(puppy.dob);
    const today = new Date();
    const diffMs = today.getTime() - dob.getTime();
    const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    return Math.floor(diffDays / 7);
  }, [puppy]);

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

  const careOverview = useMemo(() => {
    const week = ageNumber ?? 0;

    const byWeek = [
      {
        min: 0,
        max: 1,
        title: "Your Puppy at Week 0–1",
        facts: [
          "Newborn Chihuahua puppies sleep most of the day and depend fully on warmth and nursing.",
          "Weight checks are especially important in these early days.",
          "Tiny puppies can change quickly, so gentle close observation matters.",
        ],
      },
      {
        min: 2,
        max: 3,
        title: "Your Puppy at Week 2–3",
        facts: [
          "Eyes and ears begin opening, and puppies become a little more aware of the world around them.",
          "Early strength and coordination begin developing.",
          "Small daily changes are often easier to notice in photos and weights.",
        ],
      },
      {
        min: 4,
        max: 5,
        title: "Your Puppy at Week 4–5",
        facts: [
          "Chihuahua puppies begin exploring more and showing early personality traits.",
          "They often become more curious, alert, and interactive.",
          "This stage is a big bridge between newborn care and playful puppy behavior.",
        ],
      },
      {
        min: 6,
        max: 7,
        title: "Your Puppy at Week 6–7",
        facts: [
          "Social development becomes more noticeable during this stage.",
          "Routine handling, gentle exposure, and structure matter a lot.",
          "Weight and overall condition still remain very important for toy breeds.",
        ],
      },
      {
        min: 8,
        max: 10,
        title: "Your Puppy at Week 8–10",
        facts: [
          "This is often the stage when families become especially focused on transition and go-home prep.",
          "Consistency with feeding and routine helps small breeds adjust well.",
          "Chihuahuas may be tiny, but they are often observant, sensitive, and full of personality.",
        ],
      },
      {
        min: 11,
        max: 999,
        title: `Your Puppy at Week ${week || "—"}`,
        facts: [
          "As Chihuahua puppies grow, confidence, routine, and bonding become just as important as size.",
          "Small-breed puppies often benefit from predictable structure and careful observation.",
          "Progress is best understood as a full picture: weight, milestones, health, and temperament together.",
        ],
      },
    ];

    const matched =
      byWeek.find((item) => week >= item.min && week <= item.max) || byWeek[byWeek.length - 1];

    return matched;
  }, [ageNumber]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center rounded-[28px] border border-[#dcc9b7] bg-white text-sm font-semibold text-[#7f6144] shadow-sm">
        Loading My Puppy...
      </div>
    );
  }

  if (!user) {
    return <MyPuppyLogin />;
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[30px] border border-[#d7c7b6] bg-white shadow-[0_14px_40px_rgba(61,39,22,0.08)]">
        <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="bg-[linear-gradient(135deg,#8f6945_0%,#6f5037_100%)] px-6 py-7 text-white md:px-8 md:py-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/85">
              <span>My Puppy</span>
              <span className="h-1 w-1 rounded-full bg-white/50" />
              <span>My Puppy Portal</span>
            </div>

            <h1 className="mt-5 font-serif text-3xl font-bold leading-[0.95] md:text-5xl">
              {puppy ? puppyName : "My Puppy"}
            </h1>

            <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-white/82 md:text-[15px]">
              {puppy
                ? "A complete view of your puppy’s profile, milestones, progress, and breeder updates."
                : "Your puppy profile will appear here once a puppy has been matched to your portal."}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {puppy?.status ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                  Status: {puppy.status}
                </span>
              ) : null}

              {puppy?.registry ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                  Registry: {puppy.registry}
                </span>
              ) : null}

              {ageDisplay !== "—" ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                  Age: {ageDisplay}
                </span>
              ) : null}
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#d6ab73] px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-[#24180f] transition hover:bg-[#dfba87]"
              >
                Refresh Profile
              </button>

              <Link
                href="/portal/messages"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/18 bg-white/10 px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/14"
              >
                Message Support
              </Link>
            </div>

            {statusText ? (
              <div className="mt-4 text-sm font-semibold text-white/80">{statusText}</div>
            ) : null}
          </div>

          <div className="relative min-h-[320px] bg-[#efe6dc]">
            {puppy ? (
              <>
                <img
                  src={puppyImage}
                  alt={puppyName}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                <div className="absolute left-0 top-0 p-6">
                  <div className="flex flex-wrap gap-2">
                    {puppy.sex ? (
                      <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white backdrop-blur-sm">
                        {puppy.sex}
                      </span>
                    ) : null}
                    {puppy.color ? (
                      <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white backdrop-blur-sm">
                        {puppy.color}
                      </span>
                    ) : null}
                    {puppy.coat_type || puppy.coat ? (
                      <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white backdrop-blur-sm">
                        {puppy.coat_type || puppy.coat}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="absolute inset-x-0 bottom-0 p-6">
                  <div className="font-serif text-3xl font-bold text-white">
                    {puppyName}
                  </div>
                  <div className="mt-2 max-w-xl text-sm font-semibold text-white/84">
                    {puppy.description ||
                      "Your puppy’s profile, milestones, progress, and breeder updates all in one place."}
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
                    Once your application is approved and a puppy is assigned to your portal, the full profile will appear here automatically.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {!puppy ? (
        <section className="rounded-[30px] border border-[#dccab7] bg-white p-10 text-center shadow-[0_12px_28px_rgba(74,51,33,0.06)]">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#dcc8b2] bg-[#fcf8f3] text-2xl shadow-sm">
            🐾
          </div>
          <h2 className="font-serif text-3xl font-bold text-[#3b271b]">
            No Puppy Assigned Yet
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-7 text-[#8b6b4d]">
            Once your application is approved and a puppy is matched to your portal,
            this page will become your full puppy dashboard with milestones, growth,
            and breeder updates.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/portal/application"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#8f6945] px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#7d5b3c]"
            >
              View Application
            </Link>
            <Link
              href="/portal/messages"
              className="inline-flex items-center gap-2 rounded-2xl border border-[#dccab7] bg-[#fcf8f3] px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-[#6f5037] transition hover:bg-white"
            >
              Message Support
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <InfoTile label="Price" value={puppy.price ? fmtMoney(puppy.price) : "—"} />
            <InfoTile label="Deposit" value={puppy.deposit ? fmtMoney(puppy.deposit) : "—"} />
            <InfoTile label="Balance" value={puppy.balance ? fmtMoney(puppy.balance) : "—"} />
            <InfoTile label="Age" value={ageDisplay} />
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="space-y-6 xl:col-span-8">
              <div className="rounded-[30px] border border-[#dccab7] bg-white p-6 shadow-[0_12px_28px_rgba(74,51,33,0.06)] md:p-7">
                <div className="mb-5">
                  <h2 className="font-serif text-2xl font-bold text-[#3b271b]">
                    Puppy Overview
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-[#8b6b4d]">
                    A polished overview of your puppy’s details and progress.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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

                {(puppy.description || puppy.notes) && (
                  <div className="mt-6 grid grid-cols-1 gap-4">
                    {puppy.description ? (
                      <div className="rounded-[22px] border border-[#e5d7c8] bg-[#fcf9f5] p-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
                          About Your Puppy
                        </div>
                        <div className="mt-2 whitespace-pre-wrap text-sm font-semibold text-[#4e3727]">
                          {puppy.description}
                        </div>
                      </div>
                    ) : null}

                    {puppy.notes ? (
                      <div className="rounded-[22px] border border-[#e5d7c8] bg-[#fcf9f5] p-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
                          Breeder Notes
                        </div>
                        <div className="mt-2 whitespace-pre-wrap text-sm font-semibold text-[#4e3727]">
                          {puppy.notes}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="rounded-[30px] border border-[#dccab7] bg-white p-6 shadow-[0_12px_28px_rgba(74,51,33,0.06)] md:p-7">
                <div className="mb-5">
                  <h2 className="font-serif text-2xl font-bold text-[#3b271b]">
                    Care Overview
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-[#8b6b4d]">
                    Age-based Chihuahua facts and development notes.
                  </p>
                </div>

                <div className="rounded-[24px] bg-[linear-gradient(135deg,#8f6945_0%,#6f5037_100%)] p-6 text-white">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/75">
                    Rotating Care Snapshot
                  </div>
                  <h3 className="mt-2 font-serif text-3xl font-bold">
                    {careOverview.title}
                  </h3>

                  <div className="mt-5 grid grid-cols-1 gap-3">
                    {careOverview.facts.map((fact, idx) => (
                      <div
                        key={idx}
                        className="rounded-[18px] border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold leading-7 text-white/88"
                      >
                        {fact}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[30px] border border-[#dccab7] bg-white p-6 shadow-[0_12px_28px_rgba(74,51,33,0.06)] md:p-7">
                <div className="mb-5">
                  <h2 className="font-serif text-2xl font-bold text-[#3b271b]">
                    Weight Tracking
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-[#8b6b4d]">
                    Weekly growth and recorded weigh-ins, plus projected adult size.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                  <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
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
                        className="rounded-[22px] border border-[#e5d7c8] bg-[#fcf9f5] p-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="text-sm font-black text-[#342116]">
                              {w.weigh_date ? fmtDate(w.weigh_date) : "Recorded Weight"}
                            </div>
                            <div className="mt-1 text-[12px] font-semibold text-[#8d6f52]">
                              {w.age_weeks !== null && w.age_weeks !== undefined
                                ? `Age: ${w.age_weeks} week${w.age_weeks === 1 ? "" : "s"}`
                                : "Age not provided"}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {w.weight_oz ? (
                              <span className="rounded-full border border-[#e1cfbb] bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#7f5f42]">
                                {w.weight_oz} oz
                              </span>
                            ) : null}
                            {w.weight_g ? (
                              <span className="rounded-full border border-[#e1cfbb] bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#7f5f42]">
                                {w.weight_g} g
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {w.notes ? (
                          <div className="mt-3 whitespace-pre-wrap text-sm font-semibold text-[#4e3727]">
                            {w.notes}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-[#e3d4c2] bg-[#fcf8f3] py-10 text-center text-sm italic text-[#9e8164]">
                      No detailed weight entries have been posted yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6 xl:col-span-4">
              <div className="rounded-[30px] border border-[#dccab7] bg-white p-6 shadow-[0_12px_28px_rgba(74,51,33,0.06)] md:p-7">
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <h2 className="font-serif text-2xl font-bold text-[#3b271b]">
                      Health & Milestones
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-[#8b6b4d]">
                      Most recent milestone first, with past milestones available on demand.
                    </p>
                  </div>
                </div>

                {latestMilestone ? (
                  <div className="space-y-4">
                    <div className="rounded-[24px] bg-[linear-gradient(135deg,#8f6945_0%,#6f5037_100%)] p-5 text-white">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/75">
                          Most Current Milestone
                        </div>
                        <div className="text-[10px] font-semibold text-white/75">
                          {fmtDate(latestMilestone.event_date)}
                        </div>
                      </div>

                      <div className="mt-2 text-xl font-black">
                        {latestMilestone.label || "Update"}
                      </div>

                      {latestMilestone.details ? (
                        <div className="mt-2 text-sm font-semibold leading-7 text-white/88">
                          {latestMilestone.details}
                        </div>
                      ) : null}

                      {latestMilestone.value !== null && latestMilestone.value !== undefined ? (
                        <div className="mt-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/82">
                          {latestMilestone.value} {latestMilestone.unit || ""}
                        </div>
                      ) : null}
                    </div>

                    {pastMilestones.length ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => setShowPastMilestones((v) => !v)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-[#dccab7] bg-[#fcf8f3] px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#7f5f42] transition hover:bg-white"
                        >
                          {showPastMilestones ? "Hide Past Milestones" : "View Past Milestones"}
                        </button>

                        {showPastMilestones ? (
                          <div className="mt-4 space-y-3">
                            {pastMilestones.map((event) => (
                              <div
                                key={event.id}
                                className="rounded-[22px] border border-[#e5d7c8] bg-[#fcf9f5] p-4"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
                                    {event.event_type || "Update"}
                                  </div>
                                  <div className="text-[10px] font-semibold text-[#bea184]">
                                    {fmtDate(event.event_date)}
                                  </div>
                                </div>

                                <div className="mt-1 text-sm font-black text-[#342116]">
                                  {event.label || "Milestone"}
                                </div>

                                {event.details ? (
                                  <div className="mt-1 text-[12px] font-semibold leading-6 text-[#8d6f52]">
                                    {event.details}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-[22px] border border-dashed border-[#e3d4c2] bg-[#fcf8f3] py-10 text-center text-sm italic text-[#9e8164]">
                    No milestones are visible yet.
                  </div>
                )}
              </div>

              <div className="rounded-[30px] border border-[#dccab7] bg-white p-6 shadow-[0_12px_28px_rgba(74,51,33,0.06)] md:p-7">
                <h2 className="font-serif text-2xl font-bold text-[#3b271b]">
                  Edit With ChiChi
                </h2>
                <p className="mt-1 text-sm font-semibold text-[#8b6b4d]">
                  Repetitive sidebar details were replaced with direct edit help for ChiChi.
                </p>

                <div className="mt-5 space-y-3">
                  <div className="rounded-[22px] border border-[#e5d7c8] bg-[#fcf9f5] p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
                      Good For Edits
                    </div>
                    <div className="mt-2 text-sm font-semibold leading-7 text-[#4e3727]">
                      Microchip, registration number, litter name, sire, dam, coat, color, pattern, status, description, breeder notes, birth weight, current weight, and more.
                    </div>
                  </div>
                  <div className="rounded-[22px] border border-[#e5d7c8] bg-[#fcf9f5] p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
                      Example Commands
                    </div>
                    <div className="mt-2 space-y-2 text-sm font-semibold leading-7 text-[#4e3727]">
                      <div>{`Edit puppy ${puppy.call_name || puppy.puppy_name || puppy.name || "this puppy"} microchip to 981000123456789`}</div>
                      <div>{`Update puppy ${puppy.call_name || puppy.puppy_name || puppy.name || "this puppy"} registration number to CKC-12345`}</div>
                      <div>{`Update puppy ${puppy.call_name || puppy.puppy_name || puppy.name || "this puppy"} sire to Gus Gus`}</div>
                      <div>{`Update puppy ${puppy.call_name || puppy.puppy_name || puppy.name || "this puppy"} description to playful, confident, and loves to cuddle`}</div>
                    </div>
                  </div>
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

              <div className="rounded-[30px] border border-[#dccab7] bg-white p-6 shadow-[0_12px_28px_rgba(74,51,33,0.06)] md:p-7">
                <h2 className="font-serif text-2xl font-bold text-[#3b271b]">
                  Quick Links
                </h2>

                <div className="mt-5 space-y-3">
                  <QuickLink
                    href="/portal/messages"
                    title="Messages"
                    desc="Ask questions or request updates."
                  />
                  <QuickLink
                    href="/portal/documents"
                    title="Documents"
                    desc="View contracts and saved portal documents."
                  />
                  <QuickLink
                    href="/portal/payments"
                    title="Financials"
                    desc="Review payment activity and remaining balance."
                  />
                  <QuickLink
                    href="/portal/resources"
                    title="Resources"
                    desc="Puppy prep, feeding guidance, and care help."
                  />
                </div>
              </div>

              <div className="rounded-[30px] bg-[linear-gradient(135deg,#8f6945_0%,#6f5037_100%)] p-6 text-white shadow-[0_20px_44px_rgba(74,51,33,0.18)] md:p-7">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/75">
                  Assistant
                </div>
                <h2 className="mt-2 font-serif text-2xl font-bold">ChiChi Assistant</h2>
                <p className="mt-2 text-sm font-semibold leading-7 text-white/82">
                  Need help finding something in your portal or updating puppy profile fields? Use the ChiChi chat button in the bottom right for account-aware answers and admin edits.
                </p>

                <div className="mt-5 rounded-[22px] border border-white/15 bg-white/10 p-4 text-sm font-semibold leading-7 text-white/82">
                  Ask about payments, documents, breeder messages, puppy updates, milestones, or say things like &quot;Edit puppy Frey microchip to ...&quot; when you want to change a field.
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-[#dccab7] bg-white p-5 text-center shadow-[0_12px_28px_rgba(74,51,33,0.06)] transition hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(74,51,33,0.10)]">
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
        {label}
      </div>
      <div className="mt-2 break-words text-sm font-black text-[#342116]">{value}</div>
    </div>
  );
}

function HighlightCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[#e5d7c8] bg-[#fcf9f5] p-5">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
        {label}
      </div>
      <div className="mt-2 text-xl font-black text-[#342116]">{value}</div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[#e5d7c8] bg-[#fcf9f5] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#9c7b58]">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-black text-[#342116]">{value}</div>
    </div>
  );
}

function MiniInfo(_props: { label: string; value: string }) {
  void _props;
  return null;
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
    <div className="grid min-h-[80vh] grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="overflow-hidden rounded-[36px] border border-[#e2d4c5] bg-[linear-gradient(135deg,#fff8f1_0%,#f8efe4_55%,#efe2d2_100%)] shadow-[0_26px_70px_rgba(88,63,37,0.10)]">
        <div className="px-7 py-8 md:px-10 md:py-10 lg:px-14 lg:py-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#dcc6ad] bg-white/70 px-4 py-2 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#a47946]">
              My Puppy Portal
            </span>
          </div>

          <div className="mt-10 max-w-3xl">
            <h1 className="font-serif text-5xl font-bold leading-[0.95] text-[#3e2a1f] md:text-6xl">
              Welcome to your puppy’s private profile.
            </h1>

            <p className="mt-6 max-w-2xl text-[17px] font-semibold leading-8 text-[#7a5a3a]">
              Sign in to view your puppy’s profile, milestones, weight progress,
              breeder notes, and account-connected portal details.
            </p>
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
              Sign in
            </h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-[#8a6a49]">
              Enter your portal login to open your puppy profile.
            </p>
          </div>

          <form onSubmit={login} className="space-y-5">
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
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                className="w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]"
                required
              />
            </div>

            <button className="w-full rounded-[18px] bg-[#6b4d33] px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_14px_30px_rgba(88,63,37,0.18)] transition hover:bg-[#5b412c]">
              Sign In
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
