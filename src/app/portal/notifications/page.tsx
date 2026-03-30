"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fmtDate } from "@/lib/utils";
import {
  findHealthRecords,
  findPortalMessagesForUser,
  findPuppyEvents,
  loadPortalContext,
  type PortalHealthRecord,
  type PortalMessage,
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

type Notice = {
  id: string;
  kind: "message" | "milestone" | "health";
  date: string;
  title: string;
  body: string;
  href: string;
  isUnread?: boolean;
};

function healthLabel(recordType: string) {
  const normalized = String(recordType || "").trim().toLowerCase();
  if (normalized === "vaccine") return "Vaccine";
  if (normalized === "deworming") return "Deworming";
  if (normalized === "exam") return "Exam";
  return "Health";
}

export default function PortalNotificationsPage() {
  const { user, loading: sessionLoading } = usePortalSession();
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [events, setEvents] = useState<PortalPuppyEvent[]>([]);
  const [health, setHealth] = useState<PortalHealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPage() {
      if (!user) {
        setLoading(false);
        setMessages([]);
        setEvents([]);
        setHealth([]);
        return;
      }

      setLoading(true);
      setErrorText("");

      try {
        const context = await loadPortalContext(user);
        const [portalMessages, puppyEvents, healthRecords] = await Promise.all([
          findPortalMessagesForUser(user, 12),
          findPuppyEvents(context.puppy?.id),
          findHealthRecords(context.puppy?.id),
        ]);

        if (!active) return;
        setMessages(portalMessages);
        setEvents(puppyEvents.slice(0, 8));
        setHealth(healthRecords.slice(0, 8));
      } catch (error) {
        console.error("Could not load notifications page:", error);
        if (!active) return;
        setErrorText(
          "We could not load notifications right now. Please refresh or try again in a moment."
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

  const notices = useMemo<Notice[]>(() => {
    return [
      ...messages.map((message) => ({
        id: `message-${message.id}`,
        kind: "message" as const,
        date: message.created_at,
        title: message.subject || "New portal message",
        body: message.message || "A new portal message was added to your conversation.",
        href: "/portal/messages",
        isUnread: message.sender === "admin" && !message.read_by_user,
      })),
      ...events.map((event) => ({
        id: `event-${event.id}`,
        kind: "milestone" as const,
        date: event.event_date,
        title: event.title || event.label || "Puppy update",
        body:
          event.summary ||
          event.details ||
          "A new puppy milestone or breeder update was posted to your timeline.",
        href: "/portal/updates",
      })),
      ...health.map((record) => ({
        id: `health-${record.id}`,
        kind: "health" as const,
        date: record.record_date,
        title: record.title || "Health update",
        body:
          record.description ||
          `${healthLabel(record.record_type)} added to your puppy's visible wellness history.`,
        href: "/portal/updates",
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [events, health, messages]);

  if (sessionLoading || loading) {
    return <PortalLoadingState label="Loading notifications..." />;
  }

  if (!user) {
    return (
      <PortalPageHero
        eyebrow="Notifications"
        title="Sign in to view recent activity."
        description="Messages, milestones, and visible health updates appear here once you are signed in."
        actions={<PortalHeroPrimaryAction href="/portal">Open My Puppy Portal</PortalHeroPrimaryAction>}
      />
    );
  }

  if (errorText) {
    return <PortalErrorState title="Notifications are unavailable" description={errorText} />;
  }

  const unreadCount = notices.filter((notice) => notice.kind === "message" && notice.isUnread).length;

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Notifications"
        title="Recent activity, collected in one stream."
        description="Messages, breeder notes, and visible health updates are gathered here so important changes are easy to spot without moving between tabs."
        actions={
          <>
            <PortalHeroPrimaryAction href="/portal/messages">Open Messages</PortalHeroPrimaryAction>
            <PortalHeroSecondaryAction href="/portal/updates">Open Pupdates</PortalHeroSecondaryAction>
          </>
        }
        aside={
          <div className="space-y-4">
            <PortalInfoTile
              label="Unread Messages"
              value={String(unreadCount)}
              detail="Breeder replies that still need your attention."
              tone={unreadCount ? "warning" : "neutral"}
            />
            <PortalInfoTile
              label="Recent Activity"
              value={String(notices.length)}
              detail="Combined notifications from messages, milestones, and health updates."
            />
          </div>
        }
      />

      <PortalMetricGrid>
        <PortalMetricCard
          label="Unread"
          value={String(unreadCount)}
          detail="Breeder messages that have not been read on your side."
        />
        <PortalMetricCard
          label="Messages"
          value={String(messages.length)}
          detail="Recent portal message activity."
          accent="from-[#e9efff] via-[#d7e2ff] to-[#9eb5ef]"
        />
        <PortalMetricCard
          label="Milestones"
          value={String(events.length)}
          detail="Recent breeder note and milestone activity."
          accent="from-[#e8f4fb] via-[#d4e7f5] to-[#9dbddb]"
        />
        <PortalMetricCard
          label="Health Updates"
          value={String(health.length)}
          detail="Recent visible wellness activity."
          accent="from-[#eef2f8] via-[#dbe4ef] to-[#a9bbd1]"
        />
      </PortalMetricGrid>

      <PortalPanel
        title="Recent Activity"
        subtitle="A combined view of your newest messages, milestone notes, and visible health records."
      >
        {notices.length ? (
          <div className="space-y-4">
            {notices.map((notice) => (
              <Link
                key={notice.id}
                href={notice.href}
                className="block rounded-[24px] border border-[var(--portal-border)] bg-white px-5 py-5 shadow-[0_10px_22px_rgba(31,48,79,0.05)] transition hover:-translate-y-0.5 hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <PortalStatusBadge
                        label={notice.kind}
                        tone={notice.kind === "health" ? "success" : "neutral"}
                      />
                      {notice.isUnread ? <PortalStatusBadge label="Unread" tone="warning" /> : null}
                    </div>
                    <div className="mt-3 text-lg font-semibold text-[var(--portal-text)]">
                      {notice.title}
                    </div>
                    <div className="mt-2 text-sm leading-7 text-[var(--portal-text-soft)]">
                      {notice.body}
                    </div>
                  </div>
                  <div className="text-xs text-[var(--portal-text-muted)]">{fmtDate(notice.date)}</div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <PortalEmptyState
            title="No notifications yet"
            description="Messages, milestones, and visible health activity will appear here as they are added to your portal."
          />
        )}
      </PortalPanel>
    </div>
  );
}
