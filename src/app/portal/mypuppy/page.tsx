"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Activity,
  CalendarDays,
  HeartPulse,
  LineChart,
  PawPrint,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
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

type WeightPoint = {
  id: string;
  label: string;
  weightOz: number;
  sortDate?: string | null;
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
      focus:
        "Keep this page as your long-term record for breeder updates, early development, health notes, and reference details.",
      badgeTone: "success" as const,
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
        "Your puppy is linked to your family, and this page tracks development, wellness, and the path toward homecoming.",
      focus:
        "Check here first for progress updates, visible health records, and the most current breeder-posted milestone.",
      badgeTone: "neutral" as const,
    };
  }

  if ((ageWeeks ?? 0) >= 8) {
    return {
      label: "Preparing for Homecoming",
      summary:
        "The focus is shifting toward readiness, transition details, and final breeder updates before your puppy goes home.",
      focus:
        "Transportation planning, documents, wellness timing, and the newest breeder notes matter most in this stage.",
      badgeTone: "neutral" as const,
    };
  }

  return {
    label: "Growing With Breeder",
    summary:
      "Your puppy is still in breeder care, and this page is designed to tell the story of progress in a clear, meaningful way.",
    focus:
      "Growth, social development, breeder notes, photo moments, and wellness records should show steady progress over time.",
    badgeTone: "neutral" as const,
  };
}

function buildWeightTrend(puppy: PortalPuppy | null, weights: PortalPuppyWeight[]) {
  const detailed = [...weights]
    .sort((a, b) => {
      const left = new Date(a.weigh_date || 0).getTime();
      const right = new Date(b.weigh_date || 0).getTime();
      return left - right;
    })
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
      sortDate: entry.weigh_date || null,
    }))
    .filter((entry) => entry.weightOz > 0);

  if (detailed.length) return detailed;

  if (!puppy) return [] as WeightPoint[];

  return [
    { id: "birth", label: "Birth", weightOz: Number(puppy.birth_weight || 0), sortDate: puppy.dob || null },
    { id: "w1", label: "Week 1", weightOz: Number(puppy.w_1 || 0), sortDate: null },
    { id: "w2", label: "Week 2", weightOz: Number(puppy.w_2 || 0), sortDate: null },
    { id: "w3", label: "Week 3", weightOz: Number(puppy.w_3 || 0), sortDate: null },
    { id: "w4", label: "Week 4", weightOz: Number(puppy.w_4 || 0), sortDate: null },
    { id: "w5", label: "Week 5", weightOz: Number(puppy.w_5 || 0), sortDate: null },
    { id: "w6", label: "Week 6", weightOz: Number(puppy.w_6 || 0), sortDate: null },
    { id: "w7", label: "Week 7", weightOz: Number(puppy.w_7 || 0), sortDate: null },
    { id: "w8", label: "Week 8", weightOz: Number(puppy.w_8 || 0), sortDate: null },
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

  const timeline = useMemo<JourneyItem[]>(() => {
    return [...events, ...health]
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
            entry.summary || entry.details || "A breeder update was added to your puppy timeline.",
          tone: "neutral" as const,
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [events, health]);

  const weightTrend = useMemo(() => buildWeightTrend(puppy, weights), [puppy, weights]);

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

  const latestWeightPoint = weightTrend[weightTrend.length - 1] || null;
  const latestWeightDate = latestWeightPoint?.sortDate || weights[0]?.weigh_date || puppy.weight_date || null;
  const nextCare = health.find((record) => record.next_due_date) || null;
  const currentMilestone = timeline[0] || null;
  const pastMilestones = timeline.slice(1);
  const visibleHealth = [...health]
    .sort((a, b) => new Date(b.record_date || 0).getTime() - new Date(a.record_date || 0).getTime())
    .slice(0, 4);
  const growthPoints = weightTrend.slice(-6);
  const highestWeight = Math.max(...growthPoints.map((point) => point.weightOz), 0);
  const breederContext = [puppy.description, puppy.notes].filter(Boolean).join("\n\n");

  const profileFacts = [
    { label: "Sex", value: puppy.sex || "Not listed" },
    { label: "Color", value: puppy.color || "Not listed" },
    { label: "Coat", value: puppy.coat_type || puppy.coat || "Not listed" },
    { label: "Registry", value: puppy.registry || "Not listed" },
    { label: "Status", value: puppy.status || "Not listed" },
    { label: "Date of Birth", value: puppy.dob ? fmtDate(puppy.dob) : "Not listed" },
  ];

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="My Puppy"
        title={puppyName}
        description="Follow your puppy’s progress through breeder updates, wellness records, growth tracking, and milestone moments in one polished profile."
        actions={
          <PortalHeroPrimaryAction href="/portal/messages">
            Ask The Breeder A Question
          </PortalHeroPrimaryAction>
        }
        aside={
          <div className="grid gap-4">
            <div className="overflow-hidden rounded-[30px] border border-[var(--portal-border)] bg-[var(--portal-surface-strong)] shadow-[0_22px_48px_rgba(23,35,56,0.08)]">
              <div className="relative aspect-[4/5] overflow-hidden">
                <Image
                  src={puppyImage}
                  alt={puppyName}
                  fill
                  sizes="(max-width: 1280px) 100vw, 360px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(14,24,42,0.04)_0%,rgba(14,24,42,0.68)_100%)]" />
                <div className="absolute inset-x-4 bottom-4 rounded-[24px] border border-white/20 bg-[rgba(245,249,255,0.16)] p-4 backdrop-blur-md">
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

            <div className="grid gap-3 sm:grid-cols-3">
              <QuickFact
                icon={<CalendarDays className="h-4 w-4" />}
                label="Age"
                value={ageLabel}
              />
              <QuickFact
                icon={<LineChart className="h-4 w-4" />}
                label="Latest Weight"
                value={
                  latestWeightPoint
                    ? displayWeight(latestWeightPoint.weightOz)
                    : displayWeight(puppy.current_weight, puppy.weight_unit || "oz")
                }
              />
              <QuickFact
                icon={<Sparkles className="h-4 w-4" />}
                label="Adult Estimate"
                value={projectAdultWeight(latestWeightPoint?.weightOz || puppy.current_weight, ageWeeks)}
              />
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
          value={
            latestWeightPoint
              ? displayWeight(latestWeightPoint.weightOz)
              : displayWeight(puppy.current_weight, puppy.weight_unit || "oz")
          }
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

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_390px]">
        <div className="space-y-6">
          <PortalPanel
            title="Most Current Milestone"
            subtitle="The newest update is surfaced first so you can immediately see what changed most recently."
          >
            {currentMilestone ? (
              <div className="rounded-[28px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,249,253,0.95)_100%)] p-5 shadow-[0_14px_32px_rgba(23,35,56,0.06)]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="inline-flex items-center rounded-full border border-[rgba(181,153,116,0.22)] bg-[rgba(252,246,238,0.92)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                      {currentMilestone.label}
                    </div>
                    <div className="mt-4 text-[1.65rem] font-semibold tracking-[-0.04em] text-[var(--portal-text)]">
                      {currentMilestone.title}
                    </div>
                  </div>
                  <div className="rounded-full border border-[rgba(181,153,116,0.16)] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
                    {fmtDate(currentMilestone.date)}
                  </div>
                </div>

                <div className="mt-4 text-sm leading-7 text-[var(--portal-text-soft)]">
                  {currentMilestone.description}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <HighlightPill
                    icon={<PawPrint className="h-4 w-4" />}
                    title="Stage"
                    detail={stage.label}
                  />
                  <HighlightPill
                    icon={<HeartPulse className="h-4 w-4" />}
                    title="Wellness"
                    detail={
                      nextCare?.next_due_date ? `Next: ${fmtDate(nextCare.next_due_date)}` : "Watching for next visible date"
                    }
                  />
                  <HighlightPill
                    icon={<LineChart className="h-4 w-4" />}
                    title="Growth"
                    detail={
                      latestWeightPoint
                        ? `${displayWeight(latestWeightPoint.weightOz)} recorded`
                        : "Waiting on new entries"
                    }
                  />
                </div>
              </div>
            ) : (
              <PortalEmptyState
                title="No current milestone posted yet"
                description="When a new breeder update or visible wellness event is added, it will appear here first."
              />
            )}
          </PortalPanel>

          <PortalPanel
            title="Growth Journey"
            subtitle="Growth is shown in a more visual way so the page feels informative without becoming cluttered."
          >
            {growthPoints.length ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <PortalInfoTile
                    label="Latest Growth Point"
                    value={latestWeightPoint ? latestWeightPoint.label : "Not recorded"}
                    detail={
                      latestWeightPoint
                        ? `${displayWeight(latestWeightPoint.weightOz)}${latestWeightDate ? ` recorded on ${fmtDate(latestWeightDate)}` : ""}.`
                        : "Weight entries will appear here once added."
                    }
                    tone={latestWeightPoint ? "success" : "neutral"}
                  />
                  <PortalInfoTile
                    label="Projected Adult Size"
                    value={projectAdultWeight(latestWeightPoint?.weightOz || puppy.current_weight, ageWeeks)}
                    detail="Estimate based on the latest visible growth point."
                  />
                  <PortalInfoTile
                    label="Growth History"
                    value={`${weightTrend.length} point${weightTrend.length === 1 ? "" : "s"} recorded`}
                    detail="This gives you a cleaner view of how your puppy has progressed over time."
                  />
                </div>

                <div className="rounded-[26px] border border-[var(--portal-border)] bg-white p-5 shadow-[0_12px_26px_rgba(23,35,56,0.04)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                        Visible Weight Trend
                      </div>
                      <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                        Recent growth points are shown below in order so you can quickly spot progress.
                      </div>
                    </div>
                    <div className="hidden rounded-full border border-[rgba(181,153,116,0.16)] bg-[var(--portal-surface-muted)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-text-muted)] sm:block">
                      {growthPoints.length} entries
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    {growthPoints.map((point) => (
                      <GrowthBar
                        key={point.id}
                        label={point.label}
                        value={displayWeight(point.weightOz)}
                        widthPercent={highestWeight ? Math.max(12, (point.weightOz / highestWeight) * 100) : 0}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <PortalEmptyState
                title="No growth points published yet"
                description="Once weight records are added, growth history will appear here."
              />
            )}
          </PortalPanel>

          <PortalPanel
            title="Timeline"
            subtitle="Past updates stay organized below the current milestone so the page reads like a real journey."
          >
            {pastMilestones.length ? (
              <div className="space-y-4">
                {pastMilestones.map((entry) => (
                  <TimelineEntryCard
                    key={entry.id}
                    label={entry.label}
                    title={entry.title}
                    description={entry.description}
                    date={entry.date}
                    tone={entry.tone}
                  />
                ))}
              </div>
            ) : timeline.length ? (
              <PortalEmptyState
                title="No earlier updates yet"
                description="As more breeder notes and wellness events are added, earlier timeline entries will appear here."
              />
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
            title="Profile Snapshot"
            subtitle="A clean view of the profile details families usually want to check first."
          >
            <div className="grid gap-4 sm:grid-cols-2">
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
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                  <Sparkles className="h-4 w-4" />
                  Breeder Notes
                </div>
                <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--portal-text-soft)]">
                  {breederContext}
                </div>
              </div>
            ) : null}
          </PortalPanel>

          <PortalPanel
            title="Wellness Record"
            subtitle="A cleaner read of recent health-related entries without mixing them into everything else."
          >
            {visibleHealth.length ? (
              <div className="space-y-4">
                {visibleHealth.map((record) => (
                  <WellnessCard
                    key={record.id}
                    typeLabel={describeRecordType(record.record_type)}
                    title={record.title}
                    description={
                      record.description ||
                      `${describeRecordType(record.record_type)} added to your puppy wellness record.`
                    }
                    recordDate={record.record_date}
                    nextDueDate={record.next_due_date || null}
                  />
                ))}
              </div>
            ) : (
              <PortalEmptyState
                title="No visible wellness entries yet"
                description="Health records will appear here as they are published to your portal."
              />
            )}
          </PortalPanel>

          <PortalPanel
            title="At a Glance"
            subtitle="A compact summary that stays helpful before and after homecoming."
          >
            <div className="space-y-4">
              <StatusRow
                icon={<HeartPulse className="h-4 w-4" />}
                title="Wellness Entries"
                detail={`${health.length} visible health record${health.length === 1 ? "" : "s"} in the portal.`}
              />
              <StatusRow
                icon={<LineChart className="h-4 w-4" />}
                title="Weight Points"
                detail={`${weightTrend.length} growth point${weightTrend.length === 1 ? "" : "s"} recorded.`}
              />
              <StatusRow
                icon={<Activity className="h-4 w-4" />}
                title="Current Focus"
                detail={stage.focus}
              />
              <StatusRow
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Long-Term Use"
                detail="This page remains useful after go-home for breeder history, wellness context, and early reference details."
              />
            </div>
          </PortalPanel>

          <PortalPanel
            title="Why This Page Matters"
            subtitle="A more customer-facing explanation of what families can expect from this profile."
          >
            <div className="rounded-[26px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-5">
              <div className="space-y-4 text-sm leading-7 text-[var(--portal-text-soft)]">
                <p>
                  This page is designed to be the easiest place to follow your puppy’s early story,
                  from breeder care and visible wellness records to milestone moments and growth updates.
                </p>
                <p>
                  Rather than burying everything in scattered messages, the goal is to keep the important
                  details together in one profile that still feels warm, polished, and easy to review.
                </p>
              </div>
            </div>
          </PortalPanel>
        </div>
      </section>
    </div>
  );
}

function QuickFact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-[var(--portal-border)] bg-white px-4 py-4 shadow-[0_10px_22px_rgba(23,35,56,0.05)]">
      <div className="flex items-center gap-2 text-[var(--portal-accent-strong)]">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
          {label}
        </span>
      </div>
      <div className="mt-3 text-sm font-semibold text-[var(--portal-text)]">{value}</div>
    </div>
  );
}

function HighlightPill({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-[22px] border border-[rgba(181,153,116,0.16)] bg-white px-4 py-4 shadow-[0_10px_20px_rgba(23,35,56,0.04)]">
      <div className="flex items-center gap-2 text-[var(--portal-accent-strong)]">
        {icon}
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
          {title}
        </div>
      </div>
      <div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">{detail}</div>
    </div>
  );
}

function GrowthBar({
  label,
  value,
  widthPercent,
}: {
  label: string;
  value: string;
  widthPercent: number;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[96px_minmax(0,1fr)_88px] sm:items-center">
      <div className="text-sm font-semibold text-[var(--portal-text)]">{label}</div>
      <div className="h-3 overflow-hidden rounded-full bg-[rgba(174,191,211,0.22)]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,rgba(208,172,132,0.95)_0%,rgba(125,167,206,0.92)_100%)]"
          style={{ width: `${Math.min(100, Math.max(0, widthPercent))}%` }}
        />
      </div>
      <div className="text-sm font-medium text-[var(--portal-text-soft)] sm:text-right">{value}</div>
    </div>
  );
}

function TimelineEntryCard({
  label,
  title,
  description,
  date,
  tone,
}: {
  label: string;
  title: string;
  description: string;
  date: string;
  tone: "neutral" | "success";
}) {
  const toneStyles =
    tone === "success"
      ? "border-[rgba(113,198,164,0.22)] bg-[linear-gradient(180deg,rgba(249,255,252,1)_0%,rgba(244,252,248,1)_100%)]"
      : "border-[var(--portal-border)] bg-white";

  return (
    <div className={`rounded-[24px] border p-5 shadow-[0_10px_22px_rgba(23,35,56,0.04)] ${toneStyles}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
            {label}
          </div>
          <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--portal-text)]">
            {title}
          </div>
        </div>
        <div className="rounded-full border border-[rgba(181,153,116,0.16)] bg-[var(--portal-surface-muted)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
          {fmtDate(date)}
        </div>
      </div>
      <div className="mt-3 text-sm leading-7 text-[var(--portal-text-soft)]">{description}</div>
    </div>
  );
}

function WellnessCard({
  typeLabel,
  title,
  description,
  recordDate,
  nextDueDate,
}: {
  typeLabel: string;
  title: string;
  description: string;
  recordDate: string;
  nextDueDate: string | null;
}) {
  return (
    <div className="rounded-[24px] border border-[var(--portal-border)] bg-white p-5 shadow-[0_10px_22px_rgba(23,35,56,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
            <Stethoscope className="h-4 w-4 text-[var(--portal-accent-strong)]" />
            {typeLabel}
          </div>
          <div className="mt-2 text-base font-semibold text-[var(--portal-text)]">{title}</div>
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
          {fmtDate(recordDate)}
        </div>
      </div>

      <div className="mt-3 text-sm leading-7 text-[var(--portal-text-soft)]">{description}</div>

      <div className="mt-4 flex flex-wrap gap-2">
        {nextDueDate ? (
          <span className="inline-flex items-center rounded-full border border-[rgba(181,153,116,0.18)] bg-[var(--portal-surface-muted)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
            Next Due {fmtDate(nextDueDate)}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-[rgba(181,153,116,0.18)] bg-[var(--portal-surface-muted)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
            Wellness Record
          </span>
        )}
      </div>
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