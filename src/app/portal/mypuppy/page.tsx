"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { User } from "@supabase/supabase-js";
import { buildPuppyPhotoUrl, fmtDate, sb } from "@/lib/utils";
import {
  PortalEmptyState,
  PortalHeroPrimaryAction,
  PortalHeroSecondaryAction,
  PortalInfoTile,
  PortalListCard,
  PortalMetricCard,
  PortalMetricGrid,
  PortalPageHero,
  PortalPanel,
} from "@/components/portal/luxury-shell";

type BuyerRow = { id: number; user_id?: string | null; email?: string | null; buyer_email?: string | null };
type PuppyRow = {
  id: number;
  call_name: string | null;
  puppy_name: string | null;
  name: string | null;
  sire: string | null;
  dam: string | null;
  color: string | null;
  coat_type: string | null;
  coat: string | null;
  pattern: string | null;
  dob: string | null;
  registry: string | null;
  status: string | null;
  w_1: number | null;
  w_2: number | null;
  w_3: number | null;
  w_4: number | null;
  w_5: number | null;
  w_6: number | null;
  w_7: number | null;
  w_8: number | null;
  birth_weight: number | null;
  current_weight: number | null;
  weight_unit: string | null;
  weight_date: string | null;
  image_url: string | null;
  photo_url: string | null;
  description: string | null;
  notes: string | null;
};
type PuppyEventRow = {
  id: number;
  event_date: string;
  event_type: string;
  label: string | null;
  title: string | null;
  summary: string | null;
  details: string | null;
  auto_generated: boolean;
};
type PuppyWeightRow = {
  id: number;
  weigh_date: string;
  age_weeks: number | null;
  weight_oz: number | null;
  weight_g: number | null;
  notes: string | null;
};
type HealthRecord = {
  id: number;
  record_date: string;
  record_type: string;
  title: string;
  description: string | null;
  next_due_date: string | null;
};

async function findBuyer(user: User) {
  if (user.id) {
    const byUser = await sb.from("buyers").select("id,user_id,email,buyer_email").eq("user_id", user.id).limit(1).maybeSingle();
    if (!byUser.error && byUser.data) return byUser.data as BuyerRow;
  }

  const email = String(user.email || "").trim().toLowerCase();
  if (!email) return null;

  for (const column of ["email", "buyer_email"]) {
    const byEmail = await sb.from("buyers").select("id,user_id,email,buyer_email").ilike(column, email).limit(1).maybeSingle();
    if (!byEmail.error && byEmail.data) return byEmail.data as BuyerRow;
  }

  return null;
}

async function findPuppy(user: User, buyer: BuyerRow | null) {
  if (buyer?.id) {
    const byBuyer = await sb.from("puppies").select("*").eq("buyer_id", buyer.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!byBuyer.error && byBuyer.data) return byBuyer.data as PuppyRow;
  }

  const email = String(user.email || "").trim().toLowerCase();
  if (!email) return null;

  const byOwner = await sb.from("puppies").select("*").ilike("owner_email", email).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!byOwner.error && byOwner.data) return byOwner.data as PuppyRow;
  return null;
}

function badgeFromRecordType(recordType: string) {
  const normalized = String(recordType || "").toLowerCase();
  if (normalized === "vaccine") return "Vaccine";
  if (normalized === "deworming") return "Deworming";
  if (normalized === "exam") return "Exam";
  return "Health";
}

function getStage(statusRaw: string | null | undefined, ageWeeks: number | null) {
  const status = String(statusRaw || "").toLowerCase();
  if (status.includes("home") || status.includes("picked up") || status.includes("delivered")) {
    return {
      label: "At Home",
      detail: "Your portal remains useful after go-home day for wellness notes, breeder context, and support.",
    };
  }
  if (ageWeeks !== null && ageWeeks >= 8) {
    return {
      label: "Homecoming Planning",
      detail: "Your puppy is in the transition stage where readiness, scheduling, and confidence matter most.",
    };
  }
  if (status.includes("matched") || status.includes("assigned") || status.includes("sold") || status.includes("reserved")) {
    return {
      label: "Matched",
      detail: "Your puppy has been matched to your family and this page will keep the full journey organized.",
    };
  }
  return {
    label: "Growing With Breeder",
    detail: "Daily care, weight checks, and milestones are still unfolding with the breeder.",
  };
}

function getFocus(ageWeeks: number | null, stageLabel: string) {
  if (stageLabel === "At Home") {
    return [
      "Consistent routines help your puppy settle in at home with less stress.",
      "This portal stays useful for revisiting breeder guidance, wellness history, and milestone notes.",
      "Support continues after go-home day through Messages and Resources.",
    ];
  }
  if (ageWeeks === null || ageWeeks <= 2) {
    return [
      "The focus is warmth, feeding rhythm, rest, and closely monitored early growth.",
      "Progress at this stage is about stability and healthy development, not just age.",
      "Updates appear here when they add real context to the journey.",
    ];
  }
  if (ageWeeks <= 5) {
    return [
      "Movement, awareness, and early personality usually become easier to see week by week.",
      "Breeder notes focus on healthy progress and consistency, not filler updates.",
      "This profile is meant to help you understand meaningful change as it happens.",
    ];
  }
  return [
    "Confidence, routine, and transition readiness are the main priorities now.",
    "Weight, wellness, and milestone notes work together to show real homecoming progress.",
    "This page should remain useful after pickup, not end when the puppy leaves our care.",
  ];
}

function formatWeight(value?: number | null, unit?: string | null) {
  if (value === null || value === undefined || Number(value) === 0) return "—";
  return `${Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 1)} ${unit || ""}`.trim();
}

export default function PortalMyPuppyPage() {
  const [user, setUser] = useState<User | null>(null);
  const [puppy, setPuppy] = useState<PuppyRow | null>(null);
  const [weights, setWeights] = useState<PuppyWeightRow[]>([]);
  const [events, setEvents] = useState<PuppyEventRow[]>([]);
  const [health, setHealth] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState("");

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (!mounted) return;
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) await loadProfile(currentUser);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void init();

    const { data: authListener } = sb.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      if (!mounted) return;
      setUser(currentUser);
      if (currentUser) await loadProfile(currentUser);
      else {
        setPuppy(null);
        setWeights([]);
        setEvents([]);
        setHealth([]);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function loadProfile(currentUser: User) {
    setStatusText("Loading puppy profile...");
    const buyer = await findBuyer(currentUser);
    const matchedPuppy = await findPuppy(currentUser, buyer);

    setPuppy(matchedPuppy);
    if (!matchedPuppy?.id) {
      setWeights([]);
      setEvents([]);
      setHealth([]);
      setStatusText("");
      return;
    }

    const [weightsRes, eventsRes, healthRes] = await Promise.all([
      sb.from("puppy_weights").select("id,weigh_date,age_weeks,weight_oz,weight_g,notes").eq("puppy_id", matchedPuppy.id).order("weigh_date", { ascending: false }).limit(20),
      sb.from("puppy_events").select("id,event_date,event_type,label,title,summary,details,auto_generated").eq("puppy_id", matchedPuppy.id).eq("is_published", true).eq("is_private", false).order("event_date", { ascending: false }),
      sb.from("puppy_health_records").select("id,record_date,record_type,title,description,next_due_date").eq("puppy_id", matchedPuppy.id).eq("is_visible_to_buyer", true).order("record_date", { ascending: false }),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const visibleEvents = ((eventsRes.data as PuppyEventRow[]) || []).filter((event) => {
      if (event.auto_generated) return false;
      const eventDate = new Date(event.event_date);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate.getTime() <= today.getTime();
    });

    setWeights((weightsRes.data as PuppyWeightRow[]) || []);
    setEvents(visibleEvents);
    setHealth((healthRes.data as HealthRecord[]) || []);
    setStatusText("");
  }

  const puppyName = puppy?.call_name || puppy?.puppy_name || puppy?.name || "Your Puppy";
  const puppyImage = buildPuppyPhotoUrl(puppy?.image_url || puppy?.photo_url || "") || "https://images.unsplash.com/photo-1591769225440-811ad7d6eca6?auto=format&fit=crop&w=1200&q=80";

  const ageWeeks = useMemo(() => {
    if (!puppy?.dob) return null;
    const diffMs = Date.now() - new Date(puppy.dob).getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7)));
  }, [puppy?.dob]);

  const ageDisplay = useMemo(() => {
    if (!puppy?.dob) return "—";
    const diffDays = Math.max(0, Math.floor((Date.now() - new Date(puppy.dob).getTime()) / (1000 * 60 * 60 * 24)));
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"}`;
  }, [puppy?.dob]);

  const stage = useMemo(() => getStage(puppy?.status, ageWeeks), [ageWeeks, puppy?.status]);
  const focusFacts = useMemo(() => getFocus(ageWeeks, stage.label), [ageWeeks, stage.label]);

  const weeklyWeights = useMemo(() => {
    if (!puppy) return [];
    return [
      { label: "Birth", value: puppy.birth_weight },
      { label: "Week 1", value: puppy.w_1 },
      { label: "Week 2", value: puppy.w_2 },
      { label: "Week 3", value: puppy.w_3 },
      { label: "Week 4", value: puppy.w_4 },
      { label: "Week 5", value: puppy.w_5 },
      { label: "Week 6", value: puppy.w_6 },
      { label: "Week 7", value: puppy.w_7 },
      { label: "Week 8", value: puppy.w_8 },
    ].filter((item) => item.value !== null && item.value !== undefined && Number(item.value) > 0);
  }, [puppy]);

  const latestWeight = useMemo(() => {
    if (weights.length) {
      const first = weights[0];
      return {
        oz: first.weight_oz !== null && first.weight_oz !== undefined ? Number(first.weight_oz) : first.weight_g ? Number(first.weight_g) / 28.3495 : null,
        ageWeeks: first.age_weeks,
      };
    }
    if (puppy?.current_weight) return { oz: Number(puppy.current_weight), ageWeeks };
    const fallback = weeklyWeights[weeklyWeights.length - 1];
    if (!fallback) return null;
    return { oz: Number(fallback.value), ageWeeks: fallback.label === "Birth" ? 0 : Number(fallback.label.replace("Week ", "")) };
  }, [ageWeeks, puppy?.current_weight, weeklyWeights, weights]);

  const projectedAdultWeight = useMemo(() => {
    if (!latestWeight?.oz || latestWeight.ageWeeks === null || latestWeight.ageWeeks === undefined) return "—";
    const currentOz = Number(latestWeight.oz);
    const weeks = Number(latestWeight.ageWeeks);
    const projectedOz = weeks >= 12 ? currentOz * 2 : weeks >= 8 ? currentOz * 2.5 : weeks >= 6 ? currentOz * 3 : currentOz * 3.5;
    return `${(projectedOz / 16).toFixed(1)} lbs est.`;
  }, [latestWeight]);

  const timeline = useMemo(() => {
    const eventItems = events.map((event) => ({
      id: `event-${event.id}`,
      date: event.event_date,
      title: event.title || event.label || "Breeder Update",
      summary: event.summary || event.details || "A new breeder update was posted to your puppy journey.",
      badge: "Breeder Note",
    }));
    const healthItems = health.map((record) => ({
      id: `health-${record.id}`,
      date: record.record_date,
      title: record.title || "Health Record",
      summary: record.description || `${badgeFromRecordType(record.record_type)} added to your puppy’s wellness record.`,
      badge: badgeFromRecordType(record.record_type),
    }));
    return [...eventItems, ...healthItems].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [events, health]);

  const weightTrend = useMemo(() => {
    const detailed = [...weights].reverse().map((weight, index) => ({
      id: `weight-${weight.id}`,
      label: weight.age_weeks !== null && weight.age_weeks !== undefined ? `Wk ${weight.age_weeks}` : `Entry ${index + 1}`,
      value: weight.weight_oz !== null && weight.weight_oz !== undefined ? Number(weight.weight_oz) : weight.weight_g ? Number(weight.weight_g) / 28.3495 : 0,
    })).filter((item) => item.value > 0);
    if (detailed.length) return detailed;
    return weeklyWeights.map((item) => ({
      id: item.label,
      label: item.label === "Birth" ? "Birth" : item.label.replace("Week ", "Wk "),
      value: Number(item.value || 0),
    })).filter((item) => item.value > 0);
  }, [weights, weeklyWeights]);

  const weightTrendMax = useMemo(() => weightTrend.length ? Math.max(...weightTrend.map((item) => item.value), 1) : 1, [weightTrend]);

  if (loading) {
    return <div className="flex min-h-[70vh] items-center justify-center rounded-[28px] border border-[#dcc9b7] bg-white text-sm font-semibold text-[#7f6144] shadow-sm">Loading My Puppy...</div>;
  }

  if (!user) return <MyPuppyLogin />;

  if (!puppy) {
    return (
      <PortalPanel title="My Puppy" subtitle="Your puppy profile will appear here once a puppy has been matched to your account.">
        <PortalEmptyState title="No puppy profile has been linked yet" description="If you were expecting to see your puppy here, message us and we can make sure your account is connected correctly." />
      </PortalPanel>
    );
  }

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="My Puppy"
        title={`${puppyName}'s private journey`}
        description="This profile is built to feel useful before go-home day and after. It keeps breeder context, milestones, growth, and support resources organized in one polished place."
        actions={
          <>
            <PortalHeroPrimaryAction href="/portal/updates">Open Pupdates</PortalHeroPrimaryAction>
            <PortalHeroSecondaryAction href="/portal/messages">Message Support</PortalHeroSecondaryAction>
          </>
        }
        aside={
          <div className="overflow-hidden rounded-[30px] border border-[#ead9c7] bg-white/90 shadow-[0_18px_38px_rgba(106,76,45,0.08)]">
            <div className="relative aspect-[4/3] overflow-hidden">
              <Image src={puppyImage} alt={puppyName} fill className="object-cover" sizes="(max-width: 1280px) 100vw, 360px" />
            </div>
            <div className="p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#a47946]">Journey Stage</div>
              <div className="mt-2 text-2xl font-semibold text-[#2f2218]">{stage.label}</div>
              <div className="mt-2 text-sm leading-6 text-[#73583f]">{stage.detail}</div>
            </div>
          </div>
        }
      />

      {statusText ? <div className="text-sm font-semibold text-[#7b5f46]">{statusText}</div> : null}

      <PortalMetricGrid>
        <PortalMetricCard label="Journey Stage" value={stage.label} detail={stage.detail} />
        <PortalMetricCard label="Age" value={ageDisplay} detail={puppy.dob ? `Born ${fmtDate(puppy.dob)}` : "Date of birth not listed yet."} accent="from-[#efe3d1] via-[#dbc2a1] to-[#b99366]" />
        <PortalMetricCard label="Latest Weight" value={formatWeight(latestWeight?.oz, puppy.weight_unit || "oz")} detail={puppy.weight_date ? `Most recently updated ${fmtDate(puppy.weight_date)}` : "Updated as new weight checks are added."} accent="from-[#dce9d6] via-[#b4ceab] to-[#7f9b72]" />
        <PortalMetricCard label="Projected Adult Weight" value={projectedAdultWeight} detail="Estimated from the most recent available growth data." accent="from-[#f0dcc1] via-[#ddb68c] to-[#c98743]" />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_380px]">
        <div className="space-y-6">
          <PortalPanel title="Journey Timeline" subtitle="Milestones, breeder notes, and visible wellness records stay together here so you can follow your puppy’s story in order.">
            <div className="space-y-4">
              {timeline.length ? timeline.map((item) => (
                <PortalListCard key={item.id} label={item.badge} title={item.title} description={item.summary} rightLabel={fmtDate(item.date)} />
              )) : (
                <PortalEmptyState title="No published timeline entries yet" description="As milestones and breeder updates are published for your puppy, they will appear here automatically." />
              )}
            </div>
          </PortalPanel>

          <PortalPanel title="Growth & Weight Tracking" subtitle="Weight history helps you see meaningful growth over time, not just isolated numbers.">
            <div className="grid gap-4 md:grid-cols-3">
              <PortalInfoTile label="Current Weight" value={formatWeight(latestWeight?.oz, puppy.weight_unit || "oz")} detail="Most recent weight available on file." />
              <PortalInfoTile label="Age At Last Weight" value={latestWeight?.ageWeeks !== null && latestWeight?.ageWeeks !== undefined ? `${latestWeight.ageWeeks} weeks` : "—"} detail="Age when the most recent growth point was recorded." />
              <PortalInfoTile label="Projected Adult Weight" value={projectedAdultWeight} detail="Estimate based on the latest recorded growth data." />
            </div>

            {weightTrend.length ? (
              <div className="mt-6 rounded-[26px] border border-[#ead9c7] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2e9_100%)] p-5 shadow-[0_12px_30px_rgba(106,76,45,0.05)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a47946]">Growth Trend</div>
                <div className="mt-5 flex h-52 items-end gap-3">
                  {weightTrend.map((point) => {
                    const height = Math.max(16, (point.value / weightTrendMax) * 100);
                    return (
                      <div key={point.id} className="flex flex-1 flex-col items-center gap-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8d6f52]">{point.value.toFixed(1)} oz</div>
                        <div className="flex h-36 w-full items-end rounded-[18px] bg-white px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                          <div className="w-full rounded-[14px] bg-[linear-gradient(180deg,#d8b178_0%,#c98d49_52%,#a96a2c_100%)]" style={{ height: `${height}%` }} />
                        </div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a47946]">{point.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="mt-6 space-y-4">
              {weights.length ? weights.map((weight) => (
                <div key={weight.id} className="rounded-[22px] border border-[#ead9c7] bg-white p-4 shadow-[0_10px_24px_rgba(106,76,45,0.05)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[#2f2218]">{weight.weigh_date ? fmtDate(weight.weigh_date) : "Recorded weight"}</div>
                      <div className="mt-1 text-[12px] leading-6 text-[#73583f]">
                        {weight.age_weeks !== null && weight.age_weeks !== undefined ? `Age ${weight.age_weeks} week${weight.age_weeks === 1 ? "" : "s"}` : "Age not listed"}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {weight.weight_oz ? <span className="rounded-full border border-[#ead9c7] bg-[#fff9f2] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8d6f52]">{weight.weight_oz} oz</span> : null}
                      {weight.weight_g ? <span className="rounded-full border border-[#ead9c7] bg-[#fff9f2] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8d6f52]">{weight.weight_g} g</span> : null}
                    </div>
                  </div>
                  {weight.notes ? <div className="mt-3 text-sm leading-6 text-[#73583f]">{weight.notes}</div> : null}
                </div>
              )) : weeklyWeights.length ? (
                <div className="grid gap-4 md:grid-cols-3">
                  {weeklyWeights.map((item) => (
                    <PortalInfoTile key={item.label} label={item.label} value={formatWeight(Number(item.value), puppy.weight_unit || "oz")} detail="Saved weekly snapshot" />
                  ))}
                </div>
              ) : (
                <PortalEmptyState title="No weight entries yet" description="Weekly snapshots and detailed weigh-ins will appear here as they are added." />
              )}
            </div>
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel title="Profile Snapshot" subtitle="A concise view of the details families reference most often.">
            <div className="space-y-4">
              <PortalInfoTile label="Registration" value={puppy.registry || "—"} detail="Registry information on file." />
              <PortalInfoTile label="Coat" value={puppy.coat_type || puppy.coat || "—"} detail="Current coat detail recorded in the portal." />
              <PortalInfoTile label="Color / Pattern" value={[puppy.color, puppy.pattern].filter(Boolean).join(" • ") || "—"} detail="Current color and pattern information." />
              <PortalInfoTile label="Parents" value={[puppy.sire, puppy.dam].filter(Boolean).join(" / ") || "—"} detail="Sire and dam details connected to this puppy." />
              <PortalInfoTile label="Description" value={puppy.description || "Breeder description will appear here."} detail={puppy.notes || "Notes and highlights are posted when relevant."} />
            </div>
          </PortalPanel>

          <PortalPanel title="Current Development Focus" subtitle="A meaningful breeder-facing summary of what matters most at this stage.">
            <div className="space-y-4">
              {focusFacts.map((fact, index) => (
                <div key={index} className="rounded-[22px] border border-[#ead9c7] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2e9_100%)] px-4 py-4 text-sm leading-7 text-[#73583f] shadow-[0_10px_24px_rgba(106,76,45,0.05)]">
                  {fact}
                </div>
              ))}
            </div>
          </PortalPanel>

          <PortalPanel title="Go-Home & After-Care" subtitle="This portal is built to stay useful once your puppy is home, not disappear after pickup.">
            <div className="space-y-4">
              <PortalInfoTile label="Before Go-Home" value="Preparation & clarity" detail="Use this profile for progress tracking, breeder notes, and homecoming readiness before your puppy leaves our care." />
              <PortalInfoTile label="After Go-Home" value="Reference & support" detail="Your wellness history, breeder guidance, and messages remain available here after your puppy is home." />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <PortalHeroPrimaryAction href="/portal/messages">Open Messages</PortalHeroPrimaryAction>
              <PortalHeroSecondaryAction href="/portal/resources">Open Resources</PortalHeroSecondaryAction>
            </div>
          </PortalPanel>
        </div>
      </section>
    </div>
  );
}

function MyPuppyLogin() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) alert(error.message);
  };

  return (
    <div className="grid min-h-[80vh] grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="overflow-hidden rounded-[36px] border border-[#e2d4c5] bg-[linear-gradient(135deg,#fff8f1_0%,#f8efe4_55%,#efe2d2_100%)] shadow-[0_26px_70px_rgba(88,63,37,0.10)]">
        <div className="px-7 py-8 md:px-10 md:py-10 lg:px-14 lg:py-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#dcc6ad] bg-white/70 px-4 py-2 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#a47946]">My Puppy Portal</span>
          </div>
          <div className="mt-10 max-w-3xl">
            <h1 className="font-serif text-5xl font-bold leading-[0.95] text-[#3e2a1f] md:text-6xl">Welcome to your puppy’s private profile.</h1>
            <p className="mt-6 max-w-2xl text-[17px] font-semibold leading-8 text-[#7a5a3a]">
              Sign in to view your puppy’s profile, milestones, weight progress, breeder notes, and support resources before and after go-home day.
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[36px] border border-[#ead9c7] bg-white shadow-[0_30px_80px_rgba(88,63,37,0.10)]">
        <div className="px-7 py-8 md:px-10 md:py-10">
          <div className="mb-8">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#b08251]">My Puppy Portal Access</div>
            <h2 className="mt-3 font-serif text-4xl font-bold leading-none text-[#3e2a1f]">Sign in</h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-[#8a6a49]">Enter your portal login to open your puppy journey.</p>
          </div>

          <form onSubmit={login} className="space-y-5">
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-[#a47946]">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]" required />
            </div>
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-[#a47946]">Password</label>
              <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} className="w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]" required />
            </div>
            <button className="w-full rounded-[18px] bg-[#6b4d33] px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_14px_30px_rgba(88,63,37,0.18)] transition hover:bg-[#5b412c]">Sign In</button>
          </form>
        </div>
      </section>
    </div>
  );
}
