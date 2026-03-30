"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { fmtDate, sb } from "@/lib/utils";
import {
  PortalEmptyState,
  PortalHeroPrimaryAction,
  PortalHeroSecondaryAction,
  PortalInfoTile,
  PortalMetricCard,
  PortalMetricGrid,
  PortalPageHero,
  PortalPanel,
} from "@/components/portal/luxury-shell";

type BuyerRow = {
  id: number;
  email: string | null;
  full_name?: string | null;
  name?: string | null;
  user_id?: string | null;
};

type PuppyRow = {
  id: number;
  call_name: string | null;
  puppy_name: string | null;
  name: string | null;
};

type PuppyEvent = {
  id: number;
  event_date: string;
  event_type: string;
  label: string | null;
  title: string | null;
  summary: string | null;
  details: string | null;
  auto_generated: boolean;
  photo_url: string | null;
  photos: unknown;
};

type HealthRecord = {
  id: number;
  record_date: string;
  record_type: string;
  title: string;
  description: string | null;
  provider_name: string | null;
  next_due_date: string | null;
  is_visible_to_buyer: boolean;
};

type TimelineItem = {
  id: string;
  date: string;
  title: string;
  summary: string;
  detail: string | null;
  badge: string;
  tone: "breeder" | "health";
  hasPhoto: boolean;
};

async function findBuyerForUser(user: User): Promise<BuyerRow | null> {
  const email = String(user.email || "").trim().toLowerCase();

  if (user.id) {
    const byUserId = await sb
      .from("buyers")
      .select("id,email,full_name,name,user_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!byUserId.error && byUserId.data) return byUserId.data as BuyerRow;
  }

  if (!email) return null;

  const byEmail = await sb
    .from("buyers")
    .select("id,email,full_name,name,user_id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (!byEmail.error && byEmail.data) return byEmail.data as BuyerRow;
  return null;
}

async function findPuppyForBuyer(user: User, buyer: BuyerRow | null): Promise<PuppyRow | null> {
  if (buyer?.id) {
    const byBuyer = await sb
      .from("puppies")
      .select("id,call_name,puppy_name,name")
      .eq("buyer_id", buyer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!byBuyer.error && byBuyer.data) return byBuyer.data as PuppyRow;
  }

  const email = String(user.email || "").trim().toLowerCase();
  if (!email) return null;

  const byOwnerEmail = await sb
    .from("puppies")
    .select("id,call_name,puppy_name,name")
    .ilike("owner_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!byOwnerEmail.error && byOwnerEmail.data) return byOwnerEmail.data as PuppyRow;
  return null;
}

function getPhotoCount(raw: unknown): number {
  if (!raw) return 0;
  if (Array.isArray(raw)) return raw.length;
  return 0;
}

function badgeFromRecordType(recordType: string) {
  const normalized = String(recordType || "").toLowerCase();
  if (normalized === "vaccine") return "Vaccine";
  if (normalized === "deworming") return "Deworming";
  if (normalized === "exam") return "Exam";
  if (normalized === "medication") return "Medication";
  if (normalized === "treatment") return "Treatment";
  return "Health";
}

export default function PortalUpdatesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [buyer, setBuyer] = useState<BuyerRow | null>(null);
  const [puppy, setPuppy] = useState<PuppyRow | null>(null);
  const [events, setEvents] = useState<PuppyEvent[]>([]);
  const [health, setHealth] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState("");

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
          await loadUpdates(currentUser);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void init();

    const { data: authListener } = sb.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      if (!mounted) return;

      setUser(currentUser);
      if (currentUser) {
        await loadUpdates(currentUser);
      } else {
        setBuyer(null);
        setPuppy(null);
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

  async function loadUpdates(currentUser: User) {
    setStatusText("Loading your puppy updates...");

    const matchedBuyer = await findBuyerForUser(currentUser);
    const matchedPuppy = await findPuppyForBuyer(currentUser, matchedBuyer);

    setBuyer(matchedBuyer);
    setPuppy(matchedPuppy);

    if (!matchedPuppy?.id) {
      setEvents([]);
      setHealth([]);
      setStatusText("");
      return;
    }

    const [eventsRes, healthRes] = await Promise.all([
      sb
        .from("puppy_events")
        .select("id,event_date,event_type,label,title,summary,details,auto_generated,photo_url,photos")
        .eq("puppy_id", matchedPuppy.id)
        .eq("is_published", true)
        .eq("is_private", false)
        .order("event_date", { ascending: false })
        .order("sort_order", { ascending: false }),
      sb
        .from("puppy_health_records")
        .select("id,record_date,record_type,title,description,provider_name,next_due_date,is_visible_to_buyer")
        .eq("puppy_id", matchedPuppy.id)
        .eq("is_visible_to_buyer", true)
        .order("record_date", { ascending: false }),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const visibleEvents = ((eventsRes.data as PuppyEvent[]) || []).filter((event) => {
      if (event.auto_generated) return false;
      const eventDate = new Date(event.event_date);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate.getTime() <= today.getTime();
    });

    setEvents(visibleEvents);
    setHealth((healthRes.data as HealthRecord[]) || []);
    setStatusText("");
  }

  const timeline = useMemo<TimelineItem[]>(() => {
    const eventItems = events.map((event) => ({
      id: `event-${event.id}`,
      date: event.event_date,
      title: event.title || event.label || "Breeder Update",
      summary:
        event.summary ||
        event.details ||
        "A new breeder update was added to your puppy journey.",
      detail: null,
      badge: "Breeder Note",
      tone: "breeder" as const,
      hasPhoto: Boolean(event.photo_url) || getPhotoCount(event.photos) > 0,
    }));

    const healthItems = health.map((record) => ({
      id: `health-${record.id}`,
      date: record.record_date,
      title: record.title || "Health Record",
      summary:
        record.description ||
        `${badgeFromRecordType(record.record_type)} added to your puppy's wellness history.`,
      detail: record.next_due_date ? `Next due ${fmtDate(record.next_due_date)}` : null,
      badge: badgeFromRecordType(record.record_type),
      tone: "health" as const,
      hasPhoto: false,
    }));

    return [...eventItems, ...healthItems].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [events, health]);

  const featuredUpdate = timeline[0] || null;
  const breederUpdateCount = events.length;
  const healthUpdateCount = health.length;
  const photoUpdateCount = events.filter(
    (event) => Boolean(event.photo_url) || getPhotoCount(event.photos) > 0
  ).length;
  const puppyName = puppy?.call_name || puppy?.puppy_name || puppy?.name || "Your Puppy";
  const familyName = buyer?.full_name || buyer?.name || "Your Family";

  const nextWellnessRecord = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return health
      .filter((record) => record.next_due_date)
      .sort(
        (a, b) =>
          new Date(a.next_due_date || a.record_date).getTime() -
          new Date(b.next_due_date || b.record_date).getTime()
      )
      .find((record) => {
        const due = new Date(record.next_due_date || record.record_date);
        due.setHours(0, 0, 0, 0);
        return due.getTime() >= today.getTime();
      });
  }, [health]);

  if (loading) {
    return (
      <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">
        Loading updates...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">
        Please sign in to view updates.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Pupdates"
        title={`The journey of ${puppyName}, beautifully organized.`}
        description={`${familyName} can follow breeder notes, meaningful milestones, photos, and wellness records here before go-home day and long after your puppy is home.`}
        actions={
          <>
            <PortalHeroPrimaryAction href="/portal/mypuppy">Open My Puppy</PortalHeroPrimaryAction>
            <PortalHeroSecondaryAction href="/portal/messages">Message Support</PortalHeroSecondaryAction>
          </>
        }
        aside={
          <div className="space-y-4">
            <PortalInfoTile
              label="Latest Highlight"
              value={featuredUpdate ? fmtDate(featuredUpdate.date) : "Pending"}
              detail={
                featuredUpdate?.title ||
                "Your newest breeder update or health note will appear here."
              }
            />
            <PortalInfoTile
              label="Next Wellness Date"
              value={
                nextWellnessRecord?.next_due_date
                  ? fmtDate(nextWellnessRecord.next_due_date)
                  : "To be announced"
              }
              detail={
                nextWellnessRecord?.title ||
                "When upcoming care is published, it will be surfaced here."
              }
            />
          </div>
        }
      />

      {statusText ? <div className="text-sm font-semibold text-[#7b5f46]">{statusText}</div> : null}

      <PortalMetricGrid>
        <PortalMetricCard
          label="Breeder Notes"
          value={String(breederUpdateCount)}
          detail="Published breeder timeline entries."
        />
        <PortalMetricCard
          label="Health Records"
          value={String(healthUpdateCount)}
          detail="Visible wellness notes and care updates."
          accent="from-[#d9e9d7] via-[#b6cfaa] to-[#7e9c6f]"
        />
        <PortalMetricCard
          label="Photo Moments"
          value={String(photoUpdateCount)}
          detail="Timeline entries that include photos."
          accent="from-[#f0ddc0] via-[#d8b07e] to-[#b67a33]"
        />
        <PortalMetricCard
          label="Latest Posted"
          value={featuredUpdate ? fmtDate(featuredUpdate.date) : "Pending"}
          detail={featuredUpdate ? featuredUpdate.badge : "No published updates yet."}
          accent="from-[#ece4d6] via-[#d7c2a5] to-[#b5936c]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_380px]">
        <div className="space-y-6">
          <PortalPanel
            title="Journey Timeline"
            subtitle="Every published note, milestone, and visible health record appears here in one timeline so nothing important gets lost."
          >
            <div className="space-y-4">
              {timeline.length ? (
                timeline.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[24px] border border-[#ead9c7] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2e9_100%)] p-5 shadow-[0_12px_30px_rgba(106,76,45,0.05)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span
                        className={[
                          "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]",
                          item.tone === "health"
                            ? "border-[#dbe4d0] bg-[#f7fbf3] text-[#5f7b4d]"
                            : "border-[#ead9c7] bg-white text-[#a47946]",
                        ].join(" ")}
                      >
                        {item.badge}
                      </span>
                      <span className="text-[11px] font-semibold text-[#8d6f52]">
                        {fmtDate(item.date)}
                      </span>
                    </div>

                    <div className="mt-3 text-lg font-semibold text-[#2f2218]">{item.title}</div>
                    <div className="mt-2 text-sm leading-7 text-[#73583f]">{item.summary}</div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {item.detail ? (
                        <span className="rounded-full border border-[#ead9c7] bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8d6f52]">
                          {item.detail}
                        </span>
                      ) : null}
                      {item.hasPhoto ? (
                        <span className="rounded-full border border-[#ead9c7] bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8d6f52]">
                          Photo update
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <PortalEmptyState
                  title="No published updates yet"
                  description="As milestones, breeder notes, and wellness records are published for your puppy, they will appear here automatically."
                />
              )}
            </div>
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel
            title="Current Spotlight"
            subtitle="A quick look at the newest meaningful update in your puppy journey."
          >
            {featuredUpdate ? (
              <div className="space-y-4">
                <PortalInfoTile
                  label={featuredUpdate.badge}
                  value={featuredUpdate.title}
                  detail={featuredUpdate.summary}
                />
                <PortalInfoTile
                  label="Posted"
                  value={fmtDate(featuredUpdate.date)}
                  detail={
                    featuredUpdate.detail ||
                    "Published as part of your ongoing puppy journey timeline."
                  }
                />
              </div>
            ) : (
              <PortalEmptyState
                title="Awaiting the next update"
                description="When a new breeder or wellness update is published, it will be highlighted here for quick viewing."
              />
            )}
          </PortalPanel>

          <PortalPanel
            title="What this page is for"
            subtitle="This timeline is designed to stay useful throughout the full relationship with your puppy, not only before homecoming."
          >
            <div className="space-y-4">
              <PortalInfoTile
                label="Before Go-Home"
                value="Milestones & preparation"
                detail="Breeder updates, photo moments, and readiness notes help you follow progress before your puppy comes home."
              />
              <PortalInfoTile
                label="After Go-Home"
                value="Ongoing reference"
                detail="Wellness records, milestone history, and breeder context remain easy to revisit after your puppy is home."
              />
              <PortalInfoTile
                label="Need a closer look?"
                value="Open Messages"
                detail="If you need clarification on any update, message us directly through the portal."
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
