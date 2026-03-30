"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Activity, HeartPulse, LineChart, ShieldCheck } from "lucide-react";
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
  PortalInfoTile,
  PortalListCard,
  PortalLoadingState,
  PortalMetricCard,
  PortalMetricGrid,
  PortalNarrativeCard,
  PortalPageHero,
  PortalPanel,
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
  if (value === null || value === undefined || Number(value) <= 0) return "Not recorded";
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

  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} old`;

  const weeks = Math.floor(diffDays / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} old`;
}

function getJourneyStage(statusRaw?: string | null, ageWeeks?: number | null) {
  const status = String(statusRaw || "").toLowerCase();

  if (status.includes("home") || status.includes("picked up") || status.includes("delivered")) {
    return {
      label: "At Home",
      summary:
        "This page remains the cleanest place to review breeder history, early milestones, and wellness notes after homecoming.",
      focus: "Continue using this page as the permanent record of early development, breeder updates, and health context.",
    };
  }

  if (
    status.includes("matched") ||
    status.includes("assigned") ||
    status.includes("reserved") ||
    status.includes("sold")
  ) {
    return {
      label: "Matched",
      summary:
        "Your puppy is linked to your family, and this page tracks development, breeder care, and the path toward homecoming.",
      focus: "Check progress here first when you want a grounded view of what is new, what is scheduled, and what comes next.",
    };
  }

  if ((ageWeeks ?? 0) >= 8) {
    return {
      label: "Preparing for Homecoming",
      summary:
        "The focus is shifting toward readiness, transition details, and final breeder updates before the puppy goes home.",
      focus: "Transportation, documents, wellness dates, and final breeder notes matter most in this stage.",
    };
  }

  return {
    label: "Growing With Breeder",
    summary:
      "Your puppy is still in breeder care, and this page is here to track meaningful progress rather than just list raw data.",
    focus: "Growth, breeder notes, wellness records, and photo moments should tell the story of steady development.",
  };
}

function buildWeightTrend(puppy: PortalPuppy | null, weights: PortalPuppyWeight[]) {
  const detailed = [...weights]
    .reverse()
    .map((entry, index) => ({
      id: `weight-${entry.id}`,
      label:
        entry.age_weeks !== null && entry.age_weeks !== undefined
          ? `Week ${entry.age_weeks}`
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
    { id: "w1", label: "Week 1", weightOz: Number(puppy.w_1 || 0) },
    { id: "w2", label: "Week 2", weightOz: Number(puppy.w_2 || 0) },
    { id: "w3", label: "Week 3", weightOz: Number(puppy.w_3 || 0) },
    { id: "w4", label: "Week 4", weightOz: Number(puppy.w_4 || 0) },
    { id: "w5", label: "Week 5", weightOz: Number(puppy.w_5 || 0) },
    { id: "w6", label: "Week 6", weightOz: Number(puppy.w_6 || 0) },
    { id: "w7", label: "Week 7", weightOz: Number(puppy.w_7 || 0) },
    { id: "w8", label: "Week 8", weightOz: Number(puppy.w_8 || 0) },
  ].filter((entry) => entry.weightOz > 0);
}

function projectAdultWeight(weightOz?: number | null, ageWeeks?: number | null) {
  if (!weightOz || ageWeeks === null || ageWeeks === undefined) return "Not estimated";
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
        title="Sign in to view your puppy profile."
        description="Your puppy profile, breeder notes, timeline, wellness records, and growth details appear here once you are signed in."
      />
    );
  }

  if (errorText) {
    return <PortalErrorState title="My Puppy is unavailable" description={errorText} />;
  }

  if (!puppy) {
    return (
      <PortalNarrativeCard
        eyebrow="My Puppy"
        title="This page becomes the center of your puppy journey once a profile is linked."
        description="When your account is matched to a puppy, this page turns into the photo-first record for milestones, wellness, growth, and breeder updates."
      >
        <PortalEmptyState
          title="No puppy profile linked yet"
          description="If you expected a puppy to appear already, open Messages and we can help verify the account connection."
          action={<PortalHeroPrimaryAction href="/portal/messages">Open Messages</PortalHeroPrimaryAction>}
        />
      </PortalNarrativeCard>
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
            `${describeRecordType(entry.record_type)} added to your puppy wellness record.`,
          tone: "success" as const,
        };
      }

      return {
        id: `event-${entry.id}`,
        date: entry.event_date,
        label: "Pupdate",
        title: entry.title || entry.label || "Breeder update",
        description:
          entry.summary ||
          entry.details ||
          "A breeder update was added to your puppy timeline.",
        tone: "neutral" as const,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const profileFacts = [
    { label: "Sex", value: puppy.sex || "Not listed" },
    { label: "Color", value: puppy.color || "Not listed" },
    { label: "Coat", value: puppy.coat_type || puppy.coat || "Not listed" },
    { label: "Registry", value: puppy.registry || "Not listed" },
  ];

  const breederContext = [puppy.description, puppy.notes].filter(Boolean).join("\n\n");

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="My Puppy"
        title={`${puppyName}`}
        description="Review the full puppy profile, photo moments, breeder notes, wellness record, and growth details in one page."
        aside={
          <div className="overflow-hidden rounded-[30px] border border-[var(--portal-border)] bg-[var(--portal-surface-strong)] shadow-[0_20px_44px_rgba(23,35,56,0.08)]">
            <div className="relative aspect-[4/5] overflow-hidden">
              <Image
                src={puppyImage}
                alt={puppyName}
                fill
                sizes="(max-width: 1280px) 100vw, 360px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(14,24,42,0.04)_0%,rgba(14,24,42,0.62)_100%)]" />
              <div className="absolute inset-x-4 bottom-4 rounded-[24px] border border-white/24 bg-[rgba(245,249,255,0.16)] p-4 backdrop-blur-md">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">
                  Current Stage
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
                  {stage.label}
                </div>
                <div className="mt-2 text-sm leading-6 text-white/84">{stage.summary}</div>
              </div>
            </div>
          </div>
        }
      />

      <PortalMetricGrid>
        <PortalMetricCard
          label="Age"
          value={ageLabel}
          detail={puppy.dob ? `Born ${fmtDate(puppy.dob)}.` : "Date of birth is not listed."}
        />
        <PortalMetricCard
          label="Latest Weight"
          value={latestWeightPoint ? displayWeight(latestWeightPoint.weightOz) : displayWeight(puppy.current_weight, puppy.weight_unit || "oz")}
          detail={latestWeightDate ? `Recorded ${fmtDate(latestWeightDate)}.` : "No dated weight entry on file."}
          accent="from-[rgba(93,121,255,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
        <PortalMetricCard
          label="Adult Estimate"
          value={projectAdultWeight(latestWeightPoint?.weightOz || puppy.current_weight, ageWeeks)}
          detail="Estimate based on the latest recorded growth point."
          accent="from-[rgba(110,166,218,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
        <PortalMetricCard
          label="Next Wellness"
          value={nextCare?.next_due_date ? fmtDate(nextCare.next_due_date) : "To be announced"}
          detail={nextCare?.title || "The next visible wellness date will appear here."}
          accent="from-[rgba(113,198,164,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_380px]">
        <div className="space-y-6">
          <PortalPanel
            title="Profile Snapshot"
            subtitle="A clear read of the puppy details that matter most, without turning the page into a raw data dump."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {profileFacts.map((item) => (
                <PortalInfoTile
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  detail={`${puppyName}'s ${item.label.toLowerCase()} record.`}
                />
              ))}
            </div>

            {breederContext ? (
              <div className="mt-5 rounded-[26px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(243,248,253,0.95)_100%)] p-5 shadow-[0_12px_26px_rgba(23,35,56,0.05)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                  Breeder Notes
                </div>
                <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--portal-text-soft)]">
                  {breederContext}
                </div>
              </div>
            ) : null}
          </PortalPanel>

          <PortalPanel
            title="Timeline"
            subtitle="Milestones, breeder notes, and wellness records stay together in one readable sequence."
          >
            {timeline.length ? (
              <div className="space-y-4">
                {timeline.map((entry) => (
                  <PortalListCard
                    key={entry.id}
                    label={entry.label}
                    title={entry.title}
                    description={entry.description}
                    rightLabel={fmtDate(entry.date)}
                    tone={entry.tone}
                  />
                ))}
              </div>
            ) : (
              <PortalEmptyState
                title="No timeline entries published yet"
                description="Breeder updates and wellness entries will appear here as they are posted."
              />
            )}
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel
            title="Growth and Care"
            subtitle="The newest growth point and next wellness date are surfaced without clutter."
          >
            <div className="grid gap-4">
              <PortalInfoTile
                label="Growth Status"
                value={latestWeightPoint ? `${latestWeightPoint.label} recorded` : "Waiting on entries"}
                detail={
                  latestWeightPoint
                    ? `${displayWeight(latestWeightPoint.weightOz)} recorded${latestWeightDate ? ` on ${fmtDate(latestWeightDate)}` : ""}.`
                    : "Weight entries will populate here as they are added."
                }
                tone={latestWeightPoint ? "success" : "neutral"}
              />
              <PortalInfoTile
                label="Current Focus"
                value={stage.label}
                detail={stage.focus}
              />
              <PortalInfoTile
                label="Next Wellness"
                value={nextCare?.next_due_date ? fmtDate(nextCare.next_due_date) : "Not scheduled"}
                detail={nextCare?.title || "A visible due date will appear here once it is on file."}
                tone={nextCare?.next_due_date ? "warning" : "neutral"}
              />
            </div>
          </PortalPanel>

          <PortalPanel
            title="At a Glance"
            subtitle="A compact status column that stays useful before and after homecoming."
          >
            <div className="space-y-4">
              <StatusRow icon={<HeartPulse className="h-4 w-4" />} title="Wellness Entries" detail={`${health.length} visible health record${health.length === 1 ? "" : "s"} in the portal.`} />
              <StatusRow icon={<LineChart className="h-4 w-4" />} title="Weight Points" detail={`${weightTrend.length} growth point${weightTrend.length === 1 ? "" : "s"} recorded.`} />
              <StatusRow icon={<Activity className="h-4 w-4" />} title="Stage" detail={stage.summary} />
              <StatusRow icon={<ShieldCheck className="h-4 w-4" />} title="Portal Use" detail="This page remains useful after go-home for breeder history, wellness, and reference." />
            </div>
          </PortalPanel>
        </div>
      </section>
    </div>
  );
}

function StatusRow({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[22px] border border-[var(--portal-border)] bg-white px-4 py-4 shadow-[0_10px_22px_rgba(23,35,56,0.05)]">
      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--portal-surface-muted)] text-[var(--portal-accent-strong)]">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-[var(--portal-text)]">{title}</div>
        <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
      </div>
    </div>
  );
}
