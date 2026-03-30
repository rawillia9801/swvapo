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
  PortalActionLink,
  PortalEmptyState,
  PortalErrorState,
  PortalHeroPrimaryAction,
  PortalHeroSecondaryAction,
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
        "This page stays useful after homecoming for breeder history, wellness records, and early development context.",
      guidance: [
        "Use this page as your clean reference for breeder notes, early milestones, and wellness history.",
        "Messages and resources remain available whenever you need support after homecoming.",
        "The goal is continuity, not a portal that stops being useful once your puppy leaves breeder care.",
      ],
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
        "Your puppy has been matched to your family, and this page is here to show meaningful progress toward homecoming.",
      guidance: [
        "This stage is about healthy development, breeder confidence, and clear next steps.",
        "Only meaningful milestones should appear here, not filler or duplicated profile details.",
        "The page should feel like a private puppy story, not a breeder admin screen.",
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
        "Your portal should help you understand how close your puppy is to a smooth transition home.",
        "Use Messages for practical questions about timing, routines, or handoff details.",
      ],
    };
  }

  return {
    label: "Growing With Breeder",
    summary:
      "Your puppy is still in breeder care, and this page is centered on development, confidence, and real progress.",
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
        title="Sign in to view your puppy journey."
        description="Your puppy profile, growth history, breeder notes, and support details live here once you are signed in."
        actions={<PortalHeroPrimaryAction href="/portal">Open My Puppy Portal</PortalHeroPrimaryAction>}
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
        title="Your puppy profile will become the heart of this portal."
        description="Once your puppy has been matched to your account, this page becomes a private place for milestones, growth, breeder notes, and the story leading up to homecoming."
      >
        <PortalEmptyState
          title="No puppy profile linked yet"
          description="If you expected to see your puppy here already, send a portal message and we can make sure your account is connected correctly."
          action={<PortalHeroPrimaryAction href="/portal/messages">Message Support</PortalHeroPrimaryAction>}
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
        title={`${puppyName}'s private journey`}
        description="View photos, milestones, wellness records, breeder notes, and growth details for your puppy in one place."
        actions={
          <>
            <PortalHeroPrimaryAction href="/portal/updates">Open Pupdates</PortalHeroPrimaryAction>
            <PortalHeroSecondaryAction href="/portal/messages">Message Support</PortalHeroSecondaryAction>
          </>
        }
        aside={
          <div className="overflow-hidden rounded-[28px] border border-[var(--portal-border)] bg-[var(--portal-surface-strong)] shadow-[0_18px_40px_rgba(31,48,79,0.08)]">
            <div className="relative aspect-[4/5] overflow-hidden">
              <Image
                src={puppyImage}
                alt={puppyName}
                fill
                sizes="(max-width: 1280px) 100vw, 360px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,29,48,0.05)_0%,rgba(17,29,48,0.62)_100%)]" />
              <div className="absolute inset-x-4 bottom-4 rounded-[24px] border border-white/30 bg-[rgba(244,248,255,0.16)] p-4 backdrop-blur-md">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">
                  Journey Stage
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">{stage.label}</div>
                <div className="mt-2 text-sm leading-6 text-white/85">{stage.summary}</div>
              </div>
            </div>
          </div>
        }
      />

      <PortalMetricGrid>
        <PortalMetricCard label="Age" value={ageLabel} detail={puppy.dob ? `Born ${fmtDate(puppy.dob)}` : "Date of birth not listed yet."} />
        <PortalMetricCard
          label="Latest Weight"
          value={displayWeight(latestWeightPoint?.weightOz || puppy.current_weight, puppy.weight_unit || "oz")}
          detail={latestWeightDate ? `Updated ${fmtDate(latestWeightDate)}` : "Weight updates appear here as they are added."}
          accent="from-[#dfe6fb] via-[#b8c7f7] to-[#7388d9]"
        />
        <PortalMetricCard
          label="Projected Adult Weight"
          value={projectAdultWeight(latestWeightPoint?.weightOz || puppy.current_weight, ageWeeks)}
          detail="Estimated from the most recent available growth data."
          accent="from-[#d9eef4] via-[#acd4e2] to-[#6da8bd]"
        />
        <PortalMetricCard
          label="Next Wellness Date"
          value={nextCare?.next_due_date ? fmtDate(nextCare.next_due_date) : "To be announced"}
          detail={nextCare?.title || "Upcoming wellness dates appear here when they are published."}
          accent="from-[#e7ebf2] via-[#cfd8e6] to-[#8ea0b9]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_390px]">
        <div className="space-y-6">
          <PortalPanel
            title="Puppy Story"
            subtitle="Profile details, breeder context, and identifying information for your puppy."
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
                value={[puppy.sire, puppy.dam].filter(Boolean).join(" / ") || "Not listed"}
                detail="Sire and dam listed for this puppy."
              />
              <PortalInfoTile
                label="Current Stage"
                value={stage.label}
                detail="A concise read on where your puppy is in the journey right now."
                tone={stage.label === "At Home" ? "success" : "neutral"}
              />
            </div>

            {breederContext ? (
              <div className="mt-5 rounded-[26px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,var(--portal-surface-muted)_0%,#ffffff_100%)] p-5 shadow-[0_10px_24px_rgba(31,48,79,0.04)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--portal-text-muted)]">
                  Profile Notes
                </div>
                <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--portal-text-soft)]">
                  {breederContext}
                </div>
              </div>
            ) : null}
          </PortalPanel>

          <PortalPanel
            title="Growth Tracking"
            subtitle="Weight history and trend data tied to your puppy record."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <PortalInfoTile
                label="Current Weight"
                value={displayWeight(latestWeightPoint?.weightOz || puppy.current_weight, puppy.weight_unit || "oz")}
                detail="Most recent recorded weight."
              />
              <PortalInfoTile
                label="Latest Growth Entry"
                value={
                  weights[0]?.age_weeks !== null && weights[0]?.age_weeks !== undefined
                    ? `${weights[0].age_weeks} weeks`
                    : ageWeeks !== null
                      ? `${ageWeeks} weeks`
                      : "Not listed"
                }
                detail="Age tied to the newest growth point."
              />
              <PortalInfoTile
                label="Growth Entries"
                value={weightTrend.length ? `${weightTrend.length}` : "0"}
                detail="Growth points currently visible in the portal."
              />
            </div>

            {weightTrend.length ? (
              <div className="mt-6 rounded-[28px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,#fbfdff_0%,var(--portal-surface-muted)_100%)] p-5 shadow-[0_12px_30px_rgba(31,48,79,0.06)]">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--portal-text-muted)]">
                  <LineChart className="h-4 w-4" />
                  Growth Trend
                </div>
                <div className="mt-5 flex h-56 items-end gap-3">
                  {weightTrend.map((point) => {
                    const height = Math.max(16, (point.weightOz / maxWeight) * 100);
                    return (
                      <div key={point.id} className="flex flex-1 flex-col items-center gap-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8d6f52]">
                          {point.weightOz.toFixed(1)} oz
                        </div>
                        <div className="flex h-40 w-full items-end rounded-[18px] bg-white px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                          <div
                            className="w-full rounded-[14px] bg-[linear-gradient(180deg,#d6defc_0%,#93a5eb_56%,#5b70cb_100%)]"
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
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
                  description="When weight history is added to your puppy record, it will appear here as a clear growth story instead of a cluttered list."
                />
              </div>
            )}
          </PortalPanel>

          <PortalPanel
            title="Milestones & Memories"
            subtitle="Breeder notes and wellness records, presented in one clear timeline."
          >
            {timeline.length ? (
              <div className="space-y-4">
                {timeline.slice(0, 8).map((item) => (
                  <PortalListCard
                    key={item.id}
                    label={item.label}
                    title={item.title}
                    description={item.description}
                    rightLabel={fmtDate(item.date)}
                    tone={item.tone}
                  />
                ))}
              </div>
            ) : (
              <PortalEmptyState
                title="No milestones published yet"
                description="As breeder notes and wellness records are published for your puppy, they will appear here automatically."
              />
            )}
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel
            title="What Matters Now"
            subtitle="The most relevant context for the current stage of your puppy profile."
          >
            <div className="space-y-3">
              {stage.guidance.map((item) => (
                <div
                  key={item}
                  className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4 text-sm leading-7 text-[var(--portal-text-soft)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </PortalPanel>

          <PortalPanel
            title="Support Highlights"
            subtitle="Key support context surfaced without turning the page into a generic dashboard."
          >
            <div className="space-y-3">
              <InsightCard
                icon={<HeartPulse className="h-4 w-4" />}
                title="Wellness"
                detail="Health notes are here to add confidence and clarity, not clutter."
              />
              <InsightCard
                icon={<Ruler className="h-4 w-4" />}
                title="Growth"
                detail="Weight tracking is meant to show readiness and progress over time."
              />
              <InsightCard
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Continuity"
                detail="This page stays useful after homecoming, so breeder context remains easy to revisit."
              />
            </div>
          </PortalPanel>

          <PortalPanel
            title="Quick Links"
            subtitle="Open the pages most likely to matter next."
          >
            <div className="grid gap-4">
              <PortalActionLink
                href="/portal/updates"
                eyebrow="Pupdates"
                title="See the latest breeder notes"
                detail="Open the broader journey timeline and health updates."
              />
              <PortalActionLink
                href="/portal/messages"
                eyebrow="Messages"
                title="Ask a question"
                detail="Reach out if you want clarification about your puppy's progress or next steps."
              />
              <PortalActionLink
                href="/portal/resources"
                eyebrow="Resources"
                title="Open care guidance"
                detail="Review breeder-recommended care, health, and support resources."
              />
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
    <div className="flex items-start gap-3 rounded-[20px] border border-[var(--portal-border)] bg-[var(--portal-surface-strong)] px-4 py-4 shadow-[0_10px_22px_rgba(31,48,79,0.05)]">
      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--portal-surface-muted)] text-[var(--portal-accent-strong)]">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-[var(--portal-text)]">{title}</div>
        <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
      </div>
    </div>
  );
}
