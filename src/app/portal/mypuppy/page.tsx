"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { HeartPulse, LineChart, Ruler, ShieldCheck } from "lucide-react";
import { buildPuppyPhotoUrl, fmtDate } from "@/lib/utils";
import {
  findHealthRecords,
  findPuppyEvents,
  findPuppyWeights,
  loadPortalContext,
  portalPuppyName,
  type PortalHealthRecord,
  type PortalPuppy,
  type PortalPuppyEvent,
  type PortalPuppyWeight,
} from "@/lib/portal-data";
import { usePortalSession } from "@/hooks/use-portal-session";
import {
  PortalEmptyState,
  PortalErrorState,
  PortalHeroPrimaryAction,
  PortalHeroSecondaryAction,
  PortalInfoTile,
  PortalLoadingState,
  PortalMetricCard,
  PortalMetricGrid,
  PortalPageHero,
  PortalPanel,
  PortalStatusBadge,
} from "@/components/portal/luxury-shell";

type JourneyItem = {
  id: string;
  date: string;
  label: string;
  title: string;
  description: string;
  tone: "neutral" | "success";
};

function displayWeight(value?: number | null, unit = "oz") {
  if (value === null || value === undefined || Number(value) <= 0) return "—";
  return `${Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 1)} ${unit}`.trim();
}

function getAgeWeeks(dob?: string | null) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24 * 7)));
}

function getAgeLabel(dob?: string | null) {
  if (!dob) return "Age not listed";
  const diffDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24))
  );

  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} old`;
  }

  const weeks = Math.floor(diffDays / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} old`;
}

function getJourneyStage(statusRaw?: string | null, ageWeeks?: number | null) {
  const status = String(statusRaw || "").toLowerCase();

  if (status.includes("home") || status.includes("picked up") || status.includes("delivered")) {
    return {
      label: "At Home",
      summary:
        "This page stays useful after homecoming for breeder history, wellness notes, and reference details.",
      guidance: [
        "Use this page as your clean reference for breeder notes, early milestones, and wellness history.",
        "Messages and resources remain available when you need clarification or support after go-home day.",
        "The goal is continuity, not a portal that becomes irrelevant once your puppy leaves.",
      ],
    };
  }

  if (status.includes("matched") || status.includes("assigned") || status.includes("reserved") || status.includes("sold")) {
    return {
      label: "Matched",
      summary:
        "Your puppy has been matched to your family and this page will track meaningful progress toward homecoming.",
      guidance: [
        "This stage is about clear breeder updates, healthy growth, and confidence-building progress.",
        "Only meaningful milestones should show up here, not filler or duplicated information.",
        "The page is meant to feel like a real client experience, not a breeder admin screen.",
      ],
    };
  }

  if ((ageWeeks ?? 0) >= 8) {
    return {
      label: "Homecoming Planning",
      summary:
        "The focus is shifting toward readiness, transition details, and the final stretch before go-home day.",
      guidance: [
        "This is when care details, confidence, and transportation planning matter most.",
        "The portal should help you understand how close your puppy is to a smooth transition home.",
        "Use Messages for any practical questions about timing, routines, or handoff details.",
      ],
    };
  }

  return {
    label: "Growing With Breeder",
    summary:
      "Your puppy is still in breeder care, and this page is centered on healthy development rather than filler updates.",
    guidance: [
      "The most useful updates at this stage are growth, wellness, and meaningful breeder observations.",
      "This page is designed to tell a clear story of progress instead of stacking repetitive data cards.",
      "As your puppy grows, that story stays visible here in one organized journey.",
    ],
  };
}

function buildWeightTrend(puppy: PortalPuppy | null, weights: PortalPuppyWeight[]) {
  const detailed = [...weights]
    .reverse()
    .map((entry, index) => ({
      id: `weight-${entry.id}`,
      label:
        entry.age_weeks !== null && entry.age_weeks !== undefined
          ? `Wk ${entry.age_weeks}`
          : `Entry ${index + 1}`,
      weightOz:
        entry.weight_oz !== null && entry.weight_oz !== undefined
          ? Number(entry.weight_oz)
          : entry.weight_g
            ? Number(entry.weight_g) / 28.3495
            : 0,
    }))
    .filter((entry) => entry.weightOz > 0);

  if (detailed.length) return detailed;
  if (!puppy) return [];

  return [
    { id: "birth", label: "Birth", weightOz: Number(puppy.birth_weight || 0) },
    { id: "w1", label: "Wk 1", weightOz: Number(puppy.w_1 || 0) },
    { id: "w2", label: "Wk 2", weightOz: Number(puppy.w_2 || 0) },
    { id: "w3", label: "Wk 3", weightOz: Number(puppy.w_3 || 0) },
    { id: "w4", label: "Wk 4", weightOz: Number(puppy.w_4 || 0) },
    { id: "w5", label: "Wk 5", weightOz: Number(puppy.w_5 || 0) },
    { id: "w6", label: "Wk 6", weightOz: Number(puppy.w_6 || 0) },
    { id: "w7", label: "Wk 7", weightOz: Number(puppy.w_7 || 0) },
    { id: "w8", label: "Wk 8", weightOz: Number(puppy.w_8 || 0) },
  ].filter((entry) => entry.weightOz > 0);
}

function projectAdultWeight(weightOz?: number | null, ageWeeks?: number | null) {
  if (!weightOz || ageWeeks === null || ageWeeks === undefined) return "—";
  const factor = ageWeeks >= 12 ? 2 : ageWeeks >= 8 ? 2.5 : ageWeeks >= 6 ? 3 : 3.5;
  return `${((weightOz * factor) / 16).toFixed(1)} lbs est.`;
}

function describeRecordType(recordType: string) {
  const normalized = String(recordType || "").toLowerCase();
  if (normalized === "vaccine") return "Vaccine";
  if (normalized === "deworming") return "Deworming";
  if (normalized === "exam") return "Exam";
  if (normalized === "medication") return "Medication";
  if (normalized === "treatment") return "Treatment";
  return "Health";
}

export default function PortalMyPuppyPage() {
  const { user, loading: sessionLoading } = usePortalSession();
  const [puppy, setPuppy] = useState<PortalPuppy | null>(null);
  const [events, setEvents] = useState<PortalPuppyEvent[]>([]);
  const [health, setHealth] = useState<PortalHealthRecord[]>([]);
  const [weights, setWeights] = useState<PortalPuppyWeight[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPage() {
      if (!user) {
        setPuppy(null);
        setEvents([]);
        setHealth([]);
        setWeights([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorText("");

      try {
        const context = await loadPortalContext(user);
        const matchedPuppy = context.puppy;

        if (!active) return;

        setPuppy(matchedPuppy);

        if (!matchedPuppy?.id) {
          setEvents([]);
          setHealth([]);
          setWeights([]);
          setLoading(false);
          return;
        }

        const [timelineEvents, healthRecords, weightHistory] = await Promise.all([
          findPuppyEvents(matchedPuppy.id),
          findHealthRecords(matchedPuppy.id),
          findPuppyWeights(matchedPuppy.id),
        ]);

        if (!active) return;
        setEvents(timelineEvents);
        setHealth(healthRecords);
        setWeights(weightHistory);
      } catch (error) {
        console.error("Could not load My Puppy page:", error);
        if (!active) return;
        setErrorText(
          "We could not load this puppy profile right now. Please refresh or try again in a moment."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPage();

    return () => {
      active = false;
    };
  }, [user]);

  if (sessionLoading || loading) {
    return <PortalLoadingState label="Loading My Puppy..." />;
  }

  if (!user) {
    return (
      <PortalPageHero
        eyebrow="My Puppy"
        title="Sign in to view your puppy journey."
        description="Your puppy profile, growth history, breeder notes, and support details live here once you are signed in."
        actions={<PortalHeroPrimaryAction href="/portal">Open Portal Access</PortalHeroPrimaryAction>}
      />
    );
  }

  if (errorText) {
    return (
      <PortalErrorState
        title="My Puppy is unavailable"
        description={errorText}
      />
    );
  }

  if (!puppy) {
    return (
      <PortalPanel
        title="My Puppy"
        subtitle="This page becomes active once your puppy has been matched to your account."
      >
        <PortalEmptyState
          title="No puppy profile linked yet"
          description="If you expected to see your puppy here already, message us and we can make sure your account is connected correctly."
        />
      </PortalPanel>
    );
  }

  const puppyName = portalPuppyName(puppy);
  const puppyImage =
    buildPuppyPhotoUrl(puppy.image_url || puppy.photo_url || "") ||
    "https://images.unsplash.com/photo-1591769225440-811ad7d6eca6?auto=format&fit=crop&w=1200&q=80";
  const ageWeeks = getAgeWeeks(puppy.dob);
  const ageLabel = getAgeLabel(puppy.dob);
  const stage = getJourneyStage(puppy.status, ageWeeks);
  const weightTrend = buildWeightTrend(puppy, weights);
  const latestWeightPoint = weightTrend[weightTrend.length - 1] || null;
  const latestWeightDate = weights[0]?.weigh_date || puppy.weight_date || null;
  const nextCare = health.find((record) => record.next_due_date) || null;
  const timeline: JourneyItem[] = [...events, ...health]
    .map((entry) => {
      if ("record_type" in entry) {
        return {
          id: `health-${entry.id}`,
          date: entry.record_date,
          label: describeRecordType(entry.record_type),
          title: entry.title,
          description:
            entry.description ||
            `${describeRecordType(entry.record_type)} added to your puppy's wellness record.`,
          tone: "success" as const,
        };
      }

      return {
        id: `event-${entry.id}`,
        date: entry.event_date,
        label: "Breeder Note",
        title: entry.title || entry.label || "Breeder update",
        description:
          entry.summary ||
          entry.details ||
          "A new breeder update was added to your puppy journey.",
        tone: "neutral" as const,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const maxWeight = Math.max(...weightTrend.map((item) => item.weightOz), 1);
  const profileChips = [
    { label: "Sex", value: puppy.sex || "—" },
    { label: "Color", value: puppy.color || "—" },
    { label: "Coat", value: puppy.coat_type || puppy.coat || "—" },
    { label: "Registry", value: puppy.registry || "—" },
  ];

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="My Puppy"
        title={`${puppyName}'s private journey`}
        description="A calm, organized view of your puppy's growth, milestones, breeder notes, and wellness record before go-home day and afterward."
        actions={
          <>
            <PortalHeroPrimaryAction href="/portal/updates">Open Pupdates</PortalHeroPrimaryAction>
            <PortalHeroSecondaryAction href="/portal/messages">Message Support</PortalHeroSecondaryAction>
          </>
        }
        aside={
          <div className="overflow-hidden rounded-[30px] border border-[#ead9c7] bg-white shadow-[0_18px_38px_rgba(106,76,45,0.08)]">
            <div className="relative aspect-[4/3] overflow-hidden">
              <Image
                src={puppyImage}
                alt={puppyName}
                fill
                sizes="(max-width: 1280px) 100vw, 360px"
                className="object-cover"
              />
            </div>
            <div className="p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#a47946]">
                Journey Stage
              </div>
              <div className="mt-2 text-2xl font-semibold text-[#2f2218]">{stage.label}</div>
              <div className="mt-2 text-sm leading-6 text-[#73583f]">{stage.summary}</div>
            </div>
          </div>
        }
      />

      <PortalMetricGrid>
        <PortalMetricCard label="Stage" value={stage.label} detail={stage.summary} />
        <PortalMetricCard
          label="Age"
          value={ageLabel}
          detail={puppy.dob ? `Born ${fmtDate(puppy.dob)}` : "Date of birth not listed yet."}
          accent="from-[#efe3d1] via-[#dbc2a1] to-[#b99366]"
        />
        <PortalMetricCard
          label="Latest Weight"
          value={displayWeight(latestWeightPoint?.weightOz || puppy.current_weight, puppy.weight_unit || "oz")}
          detail={latestWeightDate ? `Updated ${fmtDate(latestWeightDate)}` : "Weight updates appear here as they are added."}
          accent="from-[#dce9d6] via-[#b4ceab] to-[#7f9b72]"
        />
        <PortalMetricCard
          label="Next Wellness Date"
          value={nextCare?.next_due_date ? fmtDate(nextCare.next_due_date) : "To be announced"}
          detail={nextCare?.title || "Upcoming wellness dates appear here when they are published."}
          accent="from-[#f0dcc1] via-[#ddb68c] to-[#c98743]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
        <div className="space-y-6">
          <PortalPanel
            title="Profile Overview"
            subtitle="The essentials that matter most for understanding your puppy without repeating the same information across multiple sections."
          >
            <div className="grid gap-4 md:grid-cols-2">
              {profileChips.map((chip) => (
                <PortalInfoTile
                  key={chip.label}
                  label={chip.label}
                  value={chip.value}
                  detail="Recorded in your puppy profile."
                />
              ))}
              <PortalInfoTile
                label="Parents"
                value={[puppy.sire, puppy.dam].filter(Boolean).join(" / ") || "—"}
                detail="Sire and dam listed for this puppy."
              />
              <PortalInfoTile
                label="Projected Adult Weight"
                value={projectAdultWeight(latestWeightPoint?.weightOz || puppy.current_weight, ageWeeks)}
                detail="Estimated from the most recent available growth data."
              />
            </div>

            {(puppy.description || puppy.notes) ? (
              <div className="mt-5 rounded-[24px] border border-[#eadccf] bg-[#fffaf4] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a17848]">
                  Breeder Context
                </div>
                <div className="mt-3 space-y-3 text-sm leading-7 text-[#72553c]">
                  {puppy.description ? <p>{puppy.description}</p> : null}
                  {puppy.notes ? <p>{puppy.notes}</p> : null}
                </div>
              </div>
            ) : null}
          </PortalPanel>

          <PortalPanel
            title="Growth Tracking"
            subtitle="Weight history should feel informative and easy to scan, not like a wall of breeder admin data."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <PortalInfoTile
                label="Current Weight"
                value={displayWeight(latestWeightPoint?.weightOz || puppy.current_weight, puppy.weight_unit || "oz")}
                detail="Most recent recorded weight."
              />
              <PortalInfoTile
                label="Age At Last Weight"
                value={
                  weights[0]?.age_weeks !== null && weights[0]?.age_weeks !== undefined
                    ? `${weights[0].age_weeks} weeks`
                    : ageWeeks !== null
                      ? `${ageWeeks} weeks`
                      : "—"
                }
                detail="Age tied to the latest growth point."
              />
              <PortalInfoTile
                label="Growth Pattern"
                value={weightTrend.length ? `${weightTrend.length} entries` : "No entries"}
                detail="Growth points available in your portal history."
              />
            </div>

            {weightTrend.length ? (
              <div className="mt-6 rounded-[26px] border border-[#ead9c7] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2e9_100%)] p-5 shadow-[0_12px_30px_rgba(106,76,45,0.05)]">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a47946]">
                  <LineChart className="h-4 w-4" />
                  Growth Trend
                </div>
                <div className="mt-5 flex h-52 items-end gap-3">
                  {weightTrend.map((point) => {
                    const height = Math.max(16, (point.weightOz / maxWeight) * 100);
                    return (
                      <div key={point.id} className="flex flex-1 flex-col items-center gap-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8d6f52]">
                          {point.weightOz.toFixed(1)} oz
                        </div>
                        <div className="flex h-36 w-full items-end rounded-[18px] bg-white px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                          <div
                            className="w-full rounded-[14px] bg-[linear-gradient(180deg,#d8b178_0%,#c98d49_52%,#a96a2c_100%)]"
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a47946]">
                          {point.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-6">
                <PortalEmptyState
                  title="No growth data yet"
                  description="When weight history is added to your puppy record, it will appear here as a clean trend instead of a bulky list."
                />
              </div>
            )}
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel
            title="Journey Timeline"
            subtitle="Milestones, breeder notes, and wellness updates stay together in one readable story."
          >
            <div className="space-y-4">
              {timeline.length ? (
                timeline.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[24px] border border-[#eadccf] bg-white p-4 shadow-[0_10px_24px_rgba(96,67,38,0.05)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <PortalStatusBadge label={item.label} tone={item.tone} />
                        </div>
                        <div className="mt-3 text-sm font-semibold text-[#2f2218]">{item.title}</div>
                        <div className="mt-2 text-sm leading-6 text-[#72553c]">{item.description}</div>
                      </div>
                      <div className="shrink-0 text-[11px] font-medium text-[#8a6a49]">
                        {fmtDate(item.date)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <PortalEmptyState
                  title="No published timeline entries yet"
                  description="As breeder notes and wellness records are published for your puppy, they will appear here automatically."
                />
              )}
            </div>
          </PortalPanel>

          <PortalPanel
            title="What Matters Now"
            subtitle="A focused summary of what this stage of your puppy journey is really about."
          >
            <div className="space-y-3">
              {stage.guidance.map((item) => (
                <div
                  key={item}
                  className="rounded-[22px] border border-[#eadccf] bg-[#fffaf4] px-4 py-4 text-sm leading-7 text-[#72553c]"
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-4">
              <InsightCard
                icon={<HeartPulse className="h-4 w-4" />}
                title="Wellness"
                detail="Health notes are meant to add confidence and clarity, not clutter."
              />
              <InsightCard
                icon={<Ruler className="h-4 w-4" />}
                title="Growth"
                detail="Weight tracking is here to show the trend and readiness of your puppy over time."
              />
              <InsightCard
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Support"
                detail="The portal stays useful after homecoming so breeder context remains easy to revisit."
              />
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

function InsightCard({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[22px] border border-[#eadccf] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(96,67,38,0.05)]">
      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-[#f8efe5] text-[#a17848]">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-[#2f2218]">{title}</div>
        <div className="mt-1 text-sm leading-6 text-[#72553c]">{detail}</div>
      </div>
    </div>
  );
}
