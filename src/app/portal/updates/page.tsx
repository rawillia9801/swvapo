"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CalendarClock, HeartPulse, Sparkles } from "lucide-react";
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
  PortalPageHero,
  PortalPanel,
  PortalStatusBadge,
} from "@/components/portal/luxury-shell";

function healthLabel(recordType: string) {
  const normalized = String(recordType || "").trim().toLowerCase();
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

  const timeline = useMemo(() => {
    return [...events, ...health]
      .map((entry) => {
        if ("record_type" in entry) {
          return {
            id: `health-${entry.id}`,
            date: entry.record_date,
            title: entry.title,
            description:
              entry.description || `${healthLabel(entry.record_type)} added to your puppy's health record.`,
            badge: healthLabel(entry.record_type),
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
            entry.summary || entry.details || "A new breeder update was added to your puppy timeline.",
          badge: "Breeder Note",
          tone: "neutral" as const,
          hasPhoto: Boolean(entry.photo_url) || photoCount(entry.photos) > 0,
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [events, health]);

  if (sessionLoading || loading) {
    return <PortalLoadingState label="Loading Pupdates..." />;
  }

  if (!user) {
    return (
      <PortalPageHero
        eyebrow="Pupdates"
        title="Sign in to follow your puppy updates."
        description="Breeder notes, milestone records, and visible wellness updates appear here once you are signed in."
        actions={<PortalHeroPrimaryAction href="/portal">Open My Puppy Portal</PortalHeroPrimaryAction>}
      />
    );
  }

  if (errorText) {
    return <PortalErrorState title="Pupdates are unavailable" description={errorText} />;
  }

  const featured = timeline[0] || null;
  const nextWellness =
    [...health]
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
        title={`Track ${puppyName}'s progress in one timeline.`}
        description={`${displayName} can review breeder notes, visible wellness entries, milestone dates, and photo moments here without having to piece updates together across tabs.`}
        actions={
          <>
            <PortalHeroPrimaryAction href="/portal/mypuppy">Open My Puppy</PortalHeroPrimaryAction>
            <PortalHeroSecondaryAction href="/portal/messages">Open Messages</PortalHeroSecondaryAction>
          </>
        }
        aside={
          <div className="space-y-4">
            <PortalInfoTile
              label="Latest Update"
              value={featured ? fmtDate(featured.date) : "Pending"}
              detail={featured?.title || "Your next published update will appear here first."}
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
          detail="Published milestone notes and breeder updates."
        />
        <PortalMetricCard
          label="Wellness"
          value={String(health.length)}
          detail="Visible wellness entries tied to your puppy."
          accent="from-[#dfe6fb] via-[#b8c7f7] to-[#7388d9]"
        />
        <PortalMetricCard
          label="Photo Moments"
          value={String(photoUpdates)}
          detail="Published updates that include photos."
          accent="from-[#d9eef4] via-[#acd4e2] to-[#6da8bd]"
        />
        <PortalMetricCard
          label="Latest Posted"
          value={featured ? fmtDate(featured.date) : "Pending"}
          detail={featured?.badge || "No published updates yet."}
          accent="from-[#e7ebf2] via-[#cfd8e6] to-[#8ea0b9]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.18fr)_380px]">
        <div className="space-y-6">
          <PortalPanel
            title="Journey Timeline"
            subtitle="Every published breeder note, milestone, and visible health update appears here in date order."
          >
            {timeline.length ? (
              <div className="space-y-4">
                {timeline.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-strong)] p-5 shadow-[0_12px_26px_rgba(31,48,79,0.05)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <PortalStatusBadge label={entry.badge} tone={entry.tone} />
                          {entry.hasPhoto ? <PortalStatusBadge label="Photo" tone="neutral" /> : null}
                          {entry.nextDueDate ? (
                            <PortalStatusBadge label={`Next due ${fmtDate(entry.nextDueDate)}`} tone="warning" />
                          ) : null}
                        </div>
                        <div className="mt-3 text-lg font-semibold text-[var(--portal-text)]">
                          {entry.title}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                          {entry.description}
                        </div>
                      </div>
                      <div className="text-xs text-[var(--portal-text-muted)]">{fmtDate(entry.date)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <PortalEmptyState
                title="No published updates yet"
                description="As breeder notes, milestone moments, and visible wellness entries are posted for your puppy, they will appear here automatically."
              />
            )}
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel
            title="Spotlight"
            subtitle="A concise read of the latest meaningful update."
          >
            {featured ? (
              <div className="space-y-4">
                <SupportRow
                  icon={<Sparkles className="h-4 w-4" />}
                  title={featured.title}
                  detail={featured.description}
                />
                <SupportRow
                  icon={<CalendarClock className="h-4 w-4" />}
                  title={fmtDate(featured.date)}
                  detail="The newest published update on your puppy journey."
                />
                {nextWellness?.next_due_date ? (
                  <SupportRow
                    icon={<HeartPulse className="h-4 w-4" />}
                    title={fmtDate(nextWellness.next_due_date)}
                    detail={nextWellness.title}
                  />
                ) : null}
              </div>
            ) : (
              <PortalEmptyState
                title="Waiting on the next update"
                description="When a new breeder note or wellness entry is published, it will appear here first."
              />
            )}
          </PortalPanel>

          <PortalPanel
            title="What to open next"
            subtitle="Move directly from the timeline to the next part of the portal that helps most."
          >
            <div className="grid gap-4">
              <PortalActionLink
                href="/portal/mypuppy"
                eyebrow="My Puppy"
                title="View the full puppy profile"
                detail="Open photos, profile details, milestones, and growth information in one place."
              />
              <PortalActionLink
                href="/portal/messages"
                eyebrow="Messages"
                title="Ask about an update"
                detail="Use Messages if you want context on a breeder note, milestone date, or wellness detail."
              />
              <PortalActionLink
                href="/portal/resources"
                eyebrow="Resources"
                title="Review care guidance"
                detail="Open curated Chihuahua resources and support material that stay useful after go-home day."
              />
            </div>
          </PortalPanel>

          <PortalPanel
            title="At a Glance"
            subtitle="A few details that matter often enough to keep visible."
          >
            <div className="space-y-4">
              {timeline.slice(0, 3).map((entry) => (
                <PortalListCard
                  key={entry.id}
                  label={entry.badge}
                  title={entry.title}
                  description={entry.description}
                  rightLabel={fmtDate(entry.date)}
                  tone={entry.tone}
                />
              ))}
            </div>
          </PortalPanel>
        </div>
      </section>
    </div>
  );
}

function SupportRow({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[22px] border border-[var(--portal-border)] bg-white px-4 py-4 shadow-[0_10px_22px_rgba(31,48,79,0.05)]">
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
