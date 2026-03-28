"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
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
  const [user, setUser] = useState<User | null>(null);
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
  // We intentionally subscribe once on mount and handle auth changes from the listener.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function loadPuppyProfile(currUser: User) {
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
      if (event.auto_generated) return false;
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
    if (!latestWeight?.oz) return "â€”";

    const currentOz = Number(latestWeight.oz);
    const ageWeeks = latestWeight.ageWeeks;

    if (!currentOz || !ageWeeks) return "â€”";

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
    if (!puppy?.dob) return "â€”";

    const dob = new Date(puppy.dob);
    const today = new Date();
    const diffMs = today.getTime() - dob.getTime();
    const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    const weeks = Math.floor(diffDays / 7);

    if (weeks < 1) return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
    return `${weeks} week${weeks === 1 ? "" : "s"}`;
  }, [puppy]);

  const careOverview = useMemo(() => {
    const week = ageNumber ?? 0;

    const byWeek = [
      {
        min: 0,
        max: 1,
        title: "A gentle start focused on stability and healthy early growth",
        facts: [
          "Daily care is centered on warmth, feeding, rest, and close observation.",
          "Toy breed puppies can change quickly in the first days, so steady breeder monitoring matters.",
          "The goal at this stage is dependable early growth and calm, consistent care.",
        ],
      },
      {
        min: 2,
        max: 3,
        title: "Awareness and strength are beginning to build",
        facts: [
          "You may start to see more responsiveness, stronger movement, and early awareness.",
          "Progress is tracked through thoughtful breeder notes, weight checks, and visible development.",
          "This stage is about a healthy transition from fragile newborn care into stronger early development.",
        ],
      },
      {
        min: 4,
        max: 5,
        title: "Exploration and personality are becoming easier to see",
        facts: [
          "Curiosity, movement, and early personality are usually much more noticeable now.",
          "This is an important bridge between early routines and more playful puppy behavior.",
          "Healthy progress includes confidence, body condition, and how your puppy is developing overall.",
        ],
      },
      {
        min: 6,
        max: 7,
        title: "Confidence, structure, and social progress are taking shape",
        facts: [
          "Routine handling and gentle structure help support confidence during this stage.",
          "Toy breeds still benefit from close attention to body condition and weight consistency.",
          "Development becomes a fuller picture of behavior, strength, routine, and readiness.",
        ],
      },
      {
        min: 8,
        max: 10,
        title: "Preparation, consistency, and transition readiness",
        facts: [
          "Consistency with feeding, routine, and handling supports a smoother transition.",
          "Readiness is measured by more than age alone, especially in a very small breed.",
          "The focus is on stability, confidence, and thoughtful preparation for the next step.",
        ],
      },
      {
        min: 11,
        max: 999,
        title: `Current developmental focus for week ${week || "—"}`,
        facts: [
          "As Chihuahua puppies mature, routine, bonding, and confidence remain just as important as size.",
          "Predictable structure and thoughtful observation continue to matter for small-breed development.",
          "Progress is best understood as the full picture of weight, health, milestones, and temperament together.",
        ],
      },
    ];

    const matched =
      byWeek.find((item) => week >= item.min && week <= item.max) || byWeek[byWeek.length - 1];

    return matched;
  }, [ageNumber]);
  const weightTrend = useMemo(() => {
    const detailed = [...weights]
      .slice()
      .reverse()
      .map((weight, index) => ({
        id: `weight-${weight.id}`,
        label:
          weight.age_weeks !== null && weight.age_weeks !== undefined
            ? `Wk ${weight.age_weeks}`
            : `Entry ${index + 1}`,
        value:
          weight.weight_oz !== null && weight.weight_oz !== undefined
            ? Number(weight.weight_oz)
            : weight.weight_g !== null && weight.weight_g !== undefined
              ? Number(weight.weight_g) / 28.3495
              : 0,
      }))
      .filter((item) => item.value > 0);

    if (detailed.length) return detailed;

    return weeklyWeights
      .map((item) => ({
        id: item.label,
        label: item.label.replace("Week ", "Wk "),
        value: Number(item.value || 0),
      }))
      .filter((item) => item.value > 0);
  }, [weights, weeklyWeights]);

  const weightTrendMax = useMemo(() => {
    return weightTrend.length ? Math.max(...weightTrend.map((item) => item.value), 1) : 1;
  }, [weightTrend]);

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
                ? "A complete view of your puppyâ€™s profile, milestones, progress, and breeder updates."
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

              {ageDisplay !== "â€”" ? (
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
                <Image
                  src={puppyImage}
                  alt={puppyName}
                  fill
                  sizes="(min-width: 1280px) 45vw, 100vw"
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
                      "Your puppyâ€™s profile, milestones, progress, and breeder updates all in one place."}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center">
                <div>
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#dcc8b2] bg-white text-2xl shadow-sm">
                    ðŸ¾
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
            ðŸ¾
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
            <InfoTile label="Price" value={puppy.price ? fmtMoney(puppy.price) : "â€”"} />
            <InfoTile label="Deposit" value={puppy.deposit ? fmtMoney(puppy.deposit) : "â€”"} />
            <InfoTile label="Balance" value={puppy.balance ? fmtMoney(puppy.balance) : "â€”"} />
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
                    A polished overview of your puppyâ€™s details and progress.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <SummaryCard label="Call Name" value={puppy.call_name || puppy.puppy_name || puppy.name || "â€”"} />
                  <SummaryCard label="Sex" value={puppy.sex || "â€”"} />
                  <SummaryCard label="Color" value={puppy.color || "â€”"} />
                  <SummaryCard label="Pattern" value={puppy.pattern || "â€”"} />
                  <SummaryCard label="Coat Type" value={puppy.coat_type || puppy.coat || "â€”"} />
                  <SummaryCard label="DOB" value={puppy.dob ? fmtDate(puppy.dob) : "â€”"} />
                  <SummaryCard label="Registry" value={puppy.registry || "â€”"} />
                  <SummaryCard label="Sire" value={puppy.sire || "â€”"} />
                  <SummaryCard label="Dam" value={puppy.dam || "â€”"} />
                  <SummaryCard label="Status" value={puppy.status || "â€”"} />
                  <SummaryCard label="Birth Weight" value={formatWeight(puppy.birth_weight, puppy.weight_unit)} />
                  <SummaryCard label="Current Weight" value={formatWeight(puppy.current_weight, puppy.weight_unit)} />
                  <SummaryCard label="Projected Adult Weight" value={projectedAdultWeight} />
                  <SummaryCard label="Weight Date" value={puppy.weight_date ? fmtDate(puppy.weight_date) : "â€”"} />
                  <SummaryCard label="Microchip" value={puppy.microchip || "â€”"} />
                  <SummaryCard label="Registration No." value={puppy.registration_no || "â€”"} />
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
                    Meaningful breeder guidance, developmental progress, and timely care notes.
                  </p>
                </div>

                <div className="rounded-[24px] bg-[linear-gradient(135deg,#8f6945_0%,#6f5037_100%)] p-6 text-white">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/75">
                    Current Care Focus
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

                <div className="mt-6 rounded-[24px] border border-[#e5d7c8] bg-[#fcf9f5] p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
                        Milestone Timeline
                      </div>
                      <div className="mt-2 text-lg font-black text-[#342116]">
                        {latestMilestone?.label || "No visible milestone has been posted yet"}
                      </div>
                      <div className="mt-1 text-sm font-semibold leading-7 text-[#8d6f52]">
                        {latestMilestone?.details || "Important updates will appear here as your puppy reaches meaningful milestones."}
                      </div>
                    </div>

                    {latestMilestone ? (
                      <div className="rounded-full border border-[#dccab7] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#7f5f42]">
                        {fmtDate(latestMilestone.event_date)}
                      </div>
                    ) : null}
                  </div>

                  {pastMilestones.length ? (
                    <div className="mt-5">
                      <button
                        type="button"
                        onClick={() => setShowPastMilestones((v) => !v)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-[#dccab7] bg-white px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#7f5f42] transition hover:bg-[#fffaf4]"
                      >
                        {showPastMilestones ? "Hide Past Updates" : "View Past Updates"}
                      </button>

                      {showPastMilestones ? (
                        <div className="mt-4 space-y-3">
                          {pastMilestones.map((event) => (
                            <div
                              key={event.id}
                              className="rounded-[20px] border border-[#e5d7c8] bg-white p-4"
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
                        : "â€”"
                    }
                  />
                  <HighlightCard
                    label="Projected Adult Weight"
                    value={projectedAdultWeight}
                  />
                </div>

                {weightTrend.length ? (
                  <div className="mt-6 rounded-[24px] border border-[#e5d7c8] bg-[#fcf9f5] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
                          Growth Trend
                        </div>
                        <div className="mt-1 text-sm font-semibold text-[#8d6f52]">
                          A visual look at recorded growth over time.
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex h-48 items-end gap-3">
                      {weightTrend.map((point) => {
                        const height = Math.max(18, (point.value / weightTrendMax) * 100);
                        return (
                          <div key={point.id} className="flex flex-1 flex-col items-center gap-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8d6f52]">
                              {point.value.toFixed(1)} oz
                            </div>
                            <div className="flex h-32 w-full items-end rounded-[18px] bg-white px-2 py-2">
                              <div
                                className="w-full rounded-[14px] bg-[linear-gradient(180deg,#c78a58_0%,#8f6945_100%)]"
                                style={{ height: `${height}%` }}
                              />
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
                              {point.label}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

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
                <h2 className="font-serif text-2xl font-bold text-[#3b271b]">
                  Notes & Highlights
                </h2>
                <p className="mt-1 text-sm font-semibold text-[#8b6b4d]">
                  A cleaner summary of the details that matter most for your puppy.
                </p>

                <div className="mt-5 space-y-3">
                  <SummaryCard label="Registration" value={puppy.registry || "â€”"} />
                  <SummaryCard label="Coat Type" value={puppy.coat_type || puppy.coat || "â€”"} />
                  <SummaryCard
                    label="Color / Pattern"
                    value={[puppy.color, puppy.pattern].filter(Boolean).join(" â€¢ ") || "â€”"}
                  />
                  <SummaryCard label="Status" value={puppy.status || "â€”"} />
                  <SummaryCard label="Sire" value={puppy.sire || "â€”"} />
                  <SummaryCard label="Dam" value={puppy.dam || "â€”"} />
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
  if (value === null || value === undefined || Number(value) === 0) return "â€”";
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
              Welcome to your puppyâ€™s private profile.
            </h1>

            <p className="mt-6 max-w-2xl text-[17px] font-semibold leading-8 text-[#7a5a3a]">
              Sign in to view your puppyâ€™s profile, milestones, weight progress,
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

