"use client";

import React, { useEffect, useState } from "react";
import { CalendarClock, Camera, HeartPulse, Sparkles } from "lucide-react";
import { fmtDate } from "@/lib/utils";
import {
  findHealthRecords,
  findPuppyEvents,
  loadPortalContext,
  portalDisplayName,
  portalPuppyName,
  type PortalHealthRecord,
  type PortalPuppyEvent,
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

type TimelineEntry = {
  id: string;
  date: string;
  title: string;
  description: string;
  badge: string;
  tone: "neutral" | "success";
  hasPhoto: boolean;
  nextDueDate?: string | null;
};

function entryBadge(recordType: string) {
  const normalized = String(recordType || "").toLowerCase();
  if (normalized === "vaccine") return "Vaccine";
  if (normalized === "deworming") return "Deworming";
  if (normalized === "exam") return "Exam";
  if (normalized === "medication") return "Medication";
  if (normalized === "treatment") return "Treatment";
  return "Health";
}

function photoCount(raw: unknown) {
  if (!raw) return 0;
  return Array.isArray(raw) ? raw.length : 0;
}

export default function PortalUpdatesPage() {
  const { user, loading: sessionLoading } = usePortalSession();
  const [displayName, setDisplayName] = useState("Your Family");
  const [puppyName, setPuppyName] = useState("Your Puppy");
  const [events, setEvents] = useState<PortalPuppyEvent[]>([]);
  const [health, setHealth] = useState<PortalHealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPage() {
      if (!user) {
        setLoading(false);
        setEvents([]);
        setHealth([]);
        return;
      }

      setLoading(true);
      setErrorText("");

      try {
        const context = await loadPortalContext(user);
        const [timelineEvents, healthRecords] = await Promise.all([
          findPuppyEvents(context.puppy?.id),
          findHealthRecords(context.puppy?.id),
        ]);

        if (!active) return;

        setDisplayName(portalDisplayName(user, context.buyer, context.application));
        setPuppyName(portalPuppyName(context.puppy));
        setEvents(timelineEvents);
        setHealth(healthRecords);
      } catch (error) {
        console.error("Could not load Pupdates:", error);
        if (!active) return;
        setErrorText(
          "We could not load your puppy updates right now. Please refresh or try again in a moment."
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
    return <PortalLoadingState label="Loading Pupdates..." />;
  }

  if (!user) {
    return (
      <PortalPageHero
        eyebrow="Pupdates"
        title="Sign in to follow your puppy journey."
        description="Breeder updates, milestone notes, and wellness records appear here once you are signed in."
        actions={<PortalHeroPrimaryAction href="/portal">Open Portal Access</PortalHeroPrimaryAction>}
      />
    );
  }

  if (errorText) {
    return <PortalErrorState title="Pupdates are unavailable" description={errorText} />;
  }

  const timeline: TimelineEntry[] = [...events, ...health]
    .map((entry) => {
      if ("record_type" in entry) {
        return {
          id: `health-${entry.id}`,
          date: entry.record_date,
          title: entry.title,
          description:
            entry.description ||
            `${entryBadge(entry.record_type)} added to your puppy's wellness record.`,
          badge: entryBadge(entry.record_type),
          tone: "success" as const,
          hasPhoto: false,
          nextDueDate: entry.next_due_date,
        };
      }

      return {
        id: `event-${entry.id}`,
        date: entry.event_date,
        title: entry.title || entry.label || "Breeder update",
        description:
          entry.summary ||
          entry.details ||
          "A new breeder update was added to your puppy journey.",
        badge: "Breeder Note",
        tone: "neutral" as const,
        hasPhoto: Boolean(entry.photo_url) || photoCount(entry.photos) > 0,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const featured = timeline[0] || null;
  const nextWellness = health
    .filter((record) => record.next_due_date)
    .sort(
      (a, b) =>
        new Date(a.next_due_date || a.record_date).getTime() -
        new Date(b.next_due_date || b.record_date).getTime()
    )[0] || null;
  const photoUpdates = events.filter(
    (event) => Boolean(event.photo_url) || photoCount(event.photos) > 0
  ).length;

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Pupdates"
        title={`A living record of ${puppyName}'s journey.`}
        description={`${displayName} can follow breeder notes, milestone moments, and wellness records here in one private timeline that stays useful before and after go-home day.`}
        actions={
          <>
            <PortalHeroPrimaryAction href="/portal/mypuppy">Open My Puppy</PortalHeroPrimaryAction>
            <PortalHeroSecondaryAction href="/portal/messages">Message Support</PortalHeroSecondaryAction>
          </>
        }
        aside={
          <div className="space-y-4">
            <PortalInfoTile
              label="Latest Update"
              value={featured ? fmtDate(featured.date) : "Pending"}
              detail={featured?.title || "Your next breeder or wellness update will appear here."}
            />
            <PortalInfoTile
              label="Next Wellness Date"
              value={nextWellness?.next_due_date ? fmtDate(nextWellness.next_due_date) : "To be announced"}
              detail={nextWellness?.title || "Upcoming care dates will show here when published."}
            />
          </div>
        }
      />

      <PortalMetricGrid>
        <PortalMetricCard
          label="Breeder Notes"
          value={String(events.length)}
          detail="Published breeder notes and milestone entries."
        />
        <PortalMetricCard
          label="Health Records"
          value={String(health.length)}
          detail="Visible wellness records tied to your puppy."
          accent="from-[#dce9d6] via-[#b6cfaa] to-[#7e9c6f]"
        />
        <PortalMetricCard
          label="Photo Moments"
          value={String(photoUpdates)}
          detail="Timeline entries that include photos."
          accent="from-[#f0ddc0] via-[#d8b07e] to-[#b67a33]"
        />
        <PortalMetricCard
          label="Latest Posted"
          value={featured ? fmtDate(featured.date) : "Pending"}
          detail={featured?.badge || "No published updates yet."}
          accent="from-[#ece4d6] via-[#d7c2a5] to-[#b5936c]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
        <div className="space-y-6">
          <PortalPanel
            title="Journey Timeline"
            subtitle="Every published breeder note, milestone, and visible health record lives here in one clean stream so nothing important gets buried."
          >
            {timeline.length ? (
              <div className="space-y-4">
                {timeline.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-[24px] border border-[#ead9c7] bg-white p-5 shadow-[0_10px_24px_rgba(96,67,38,0.05)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <PortalStatusBadge label={entry.badge} tone={entry.tone} />
                          {entry.hasPhoto ? (
                            <PortalStatusBadge label="Photo" tone="neutral" />
                          ) : null}
                          {entry.nextDueDate ? (
                            <PortalStatusBadge
                              label={`Next due ${fmtDate(entry.nextDueDate)}`}
                              tone="warning"
                            />
                          ) : null}
                        </div>
                        <div className="mt-3 text-lg font-semibold text-[#2f2218]">
                          {entry.title}
                        </div>
                        <div className="mt-2 text-sm leading-7 text-[#72553c]">
                          {entry.description}
                        </div>
                      </div>
                      <div className="shrink-0 text-[11px] font-medium text-[#8a6a49]">
                        {fmtDate(entry.date)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <PortalEmptyState
                title="No published updates yet"
                description="As breeder notes, milestone moments, and visible wellness records are published for your puppy, they will appear here automatically."
              />
            )}
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel
            title="Current Spotlight"
            subtitle="A quick read of the latest meaningful update without making you scan the entire page."
          >
            {featured ? (
              <div className="space-y-4">
                <InfoFeature
                  icon={<Sparkles className="h-4 w-4" />}
                  title={featured.title}
                  detail={featured.description}
                />
                <InfoFeature
                  icon={<CalendarClock className="h-4 w-4" />}
                  title={fmtDate(featured.date)}
                  detail="The newest published update on your puppy journey."
                />
                {nextWellness?.next_due_date ? (
                  <InfoFeature
                    icon={<HeartPulse className="h-4 w-4" />}
                    title={fmtDate(nextWellness.next_due_date)}
                    detail={nextWellness.title}
                  />
                ) : null}
              </div>
            ) : (
              <PortalEmptyState
                title="Awaiting the next update"
                description="When a new breeder or wellness note is published, it will be surfaced here first."
              />
            )}
          </PortalPanel>

          <PortalPanel
            title="How to use this page"
            subtitle="This timeline is meant to be genuinely useful, not just a running list of decorative portal activity."
          >
            <div className="space-y-3">
              <InfoFeature
                icon={<Sparkles className="h-4 w-4" />}
                title="Before go-home day"
                detail="Follow breeder observations, progress notes, and the practical story of how your puppy is developing."
              />
              <InfoFeature
                icon={<HeartPulse className="h-4 w-4" />}
                title="After go-home day"
                detail="Keep revisiting milestone history and wellness notes after your puppy is home."
              />
              <InfoFeature
                icon={<Camera className="h-4 w-4" />}
                title="When something needs clarity"
                detail="Use Messages if you want context on a specific update, date, or health note."
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

function InfoFeature({
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
