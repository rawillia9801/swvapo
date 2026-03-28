"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { fmtDate, sb } from "@/lib/utils";

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
  value: number | null;
  unit: string | null;
  is_private: boolean;
  is_published: boolean;
  auto_generated: boolean;
  sort_order: number | null;
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
  accent: string;
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
        .select(
          "id,event_date,event_type,label,title,summary,details,value,unit,is_private,is_published,auto_generated,sort_order,photo_url,photos"
        )
        .eq("puppy_id", matchedPuppy.id)
        .eq("is_published", true)
        .eq("is_private", false)
        .order("event_date", { ascending: false })
        .order("sort_order", { ascending: false }),
      sb
        .from("puppy_health_records")
        .select(
          "id,record_date,record_type,title,description,provider_name,next_due_date,is_visible_to_buyer"
        )
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
      title: event.title || event.label || "Puppy Update",
      summary:
        event.summary ||
        event.details ||
        `${event.event_type || "Update"} posted for your puppy.`,
      detail:
        event.value !== null && event.value !== undefined
          ? `${event.value}${event.unit ? ` ${event.unit}` : ""}`
          : null,
      badge: "Breeder Update",
      accent: "bg-[#fff7ef] border-[#ecd7be] text-[#8b5f35]",
      hasPhoto: !!event.photo_url || getPhotoCount(event.photos) > 0,
    }));

    const healthItems = health.map((record) => ({
      id: `health-${record.id}`,
      date: record.record_date,
      title: record.title || "Health Record",
      summary:
        record.description ||
        `${badgeFromRecordType(record.record_type)} added to your puppy's wellness record.`,
      detail: record.next_due_date ? `Next due ${fmtDate(record.next_due_date)}` : null,
      badge: badgeFromRecordType(record.record_type),
      accent: "bg-[#f7f9f5] border-[#dbe4d0] text-[#56704a]",
      hasPhoto: false,
    }));

    return [...eventItems, ...healthItems].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [events, health]);

  const featuredUpdate = timeline[0] || null;
  const breederUpdateCount = events.length;
  const healthUpdateCount = health.length;
  const photoUpdateCount = events.filter((event) => !!event.photo_url || getPhotoCount(event.photos) > 0).length;
  const puppyName = puppy?.call_name || puppy?.puppy_name || puppy?.name || "Your Puppy";
  const familyName = buyer?.full_name || buyer?.name || "Your Family";

  if (loading) {
    return <div className="py-20 text-center text-sm font-semibold text-[#8b6b4d]">Loading updates...</div>;
  }

  if (!user) {
    return <div className="py-20 text-center text-sm font-semibold text-[#8b6b4d]">Please sign in to view updates.</div>;
  }

  return (
    <div className="space-y-8 pb-14">
      <section className="overflow-hidden rounded-[34px] border border-[#dccab7] bg-white shadow-[0_20px_50px_rgba(74,51,33,0.10)]">
        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="relative overflow-hidden bg-[linear-gradient(145deg,#2f2118_0%,#6f5037_45%,#af7b4a_100%)] px-7 py-8 text-white md:px-9 md:py-10">
            <div className="absolute -left-8 top-0 h-36 w-36 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-48 w-48 rounded-full bg-[#f1d3ab]/20 blur-3xl" />

            <div className="relative inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/82">
              Updates
            </div>

            <h1 className="relative mt-6 max-w-2xl font-serif text-4xl font-bold leading-[0.94] md:text-6xl">
              A private timeline for {puppyName}.
            </h1>

            <p className="relative mt-4 max-w-2xl text-sm font-semibold leading-7 text-white/80 md:text-[15px]">
              Breeder milestones, wellness records, and meaningful progress notes are collected here so {familyName} can follow the journey with clarity.
            </p>

            <div className="relative mt-8 flex flex-wrap gap-3">
              <Link
                href="/portal/mypuppy"
                className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#f0c98f_0%,#d9a666_100%)] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-[#24180f] shadow-[0_14px_28px_rgba(33,22,15,0.18)] transition hover:translate-y-[-1px]"
              >
                Open My Puppy
              </Link>
              <Link
                href="/portal/messages"
                className="inline-flex items-center rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white backdrop-blur-sm transition hover:bg-white/15"
              >
                Message Support
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 bg-[linear-gradient(180deg,#fffdfa_0%,#faf4ed_100%)] p-7 md:grid-cols-2 md:p-8">
            <PremiumStat label="Breeder Updates" value={String(breederUpdateCount)} detail="Published timeline entries" />
            <PremiumStat label="Health Records" value={String(healthUpdateCount)} detail="Visible wellness notes" />
            <PremiumStat label="Photo Moments" value={String(photoUpdateCount)} detail="Timeline posts with photos" />
            <PremiumStat
              label="Latest Post"
              value={featuredUpdate ? fmtDate(featuredUpdate.date) : "Pending"}
              detail={featuredUpdate ? featuredUpdate.badge : "No published updates yet"}
            />
          </div>
        </div>
      </section>

      {statusText ? <div className="text-sm font-semibold text-[#8b6b4d]">{statusText}</div> : null}

      <section className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        <div className="space-y-8 xl:col-span-8">
          <div className="rounded-[30px] border border-[#dccab7] bg-white p-7 shadow-[0_16px_40px_rgba(74,51,33,0.08)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#9c7b58]">
                  Timeline
                </div>
                <h2 className="mt-3 font-serif text-3xl font-bold text-[#3b271b]">
                  Published updates and wellness notes
                </h2>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {timeline.length ? (
                timeline.map((item) => (
                  <div key={item.id} className="rounded-[24px] border border-[#e5d7c8] bg-[#fcf9f5] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${item.accent}`}>
                        {item.badge}
                      </span>
                      <div className="text-xs font-semibold text-[#8b6b4d]">{fmtDate(item.date)}</div>
                    </div>

                    <div className="mt-4 text-xl font-black text-[#342116]">{item.title}</div>
                    <div className="mt-2 text-sm font-semibold leading-7 text-[#6f5037]">{item.summary}</div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {item.detail ? (
                        <span className="rounded-full border border-[#dccab7] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#7f5f42]">
                          {item.detail}
                        </span>
                      ) : null}
                      {item.hasPhoto ? (
                        <span className="rounded-full border border-[#dccab7] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#7f5f42]">
                          Photo update
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[#e5d7c8] bg-[#fcf8f3] py-14 text-center text-sm font-semibold italic text-[#9e8164]">
                  No published updates have been posted yet.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6 xl:col-span-4">
          <div className="rounded-[30px] border border-[#dccab7] bg-white p-7 shadow-[0_16px_40px_rgba(74,51,33,0.08)]">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#9c7b58]">
              Current Spotlight
            </div>
            <h3 className="mt-3 font-serif text-2xl font-bold text-[#3b271b]">
              {featuredUpdate?.title || "Awaiting the next update"}
            </h3>
            <p className="mt-3 text-sm font-semibold leading-7 text-[#8b6b4d]">
              {featuredUpdate?.summary || "As new breeder notes and health records are published, the latest one will be highlighted here for quick viewing."}
            </p>

            {featuredUpdate ? (
              <div className="mt-5 rounded-[22px] bg-[linear-gradient(135deg,#8f6945_0%,#6f5037_100%)] p-5 text-white">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">
                  Latest posted
                </div>
                <div className="mt-2 text-lg font-black">{fmtDate(featuredUpdate.date)}</div>
                <div className="mt-1 text-sm font-semibold text-white/82">{featuredUpdate.badge}</div>
              </div>
            ) : null}
          </div>

          <div className="rounded-[30px] border border-[#dccab7] bg-white p-7 shadow-[0_16px_40px_rgba(74,51,33,0.08)]">
            <h3 className="font-serif text-2xl font-bold text-[#3b271b]">What you will see here</h3>
            <div className="mt-5 space-y-3">
              <FeatureCard
                title="Breeder Milestones"
                desc="Milestone posts can include custom titles, summaries, notes, and photo moments."
              />
              <FeatureCard
                title="Health & Wellness"
                desc="Vaccines, deworming, exams, and wellness notes are shown when marked visible to buyers."
              />
              <FeatureCard
                title="Curated Visibility"
                desc="Only published, client-facing updates appear here so the timeline stays intentional and easy to follow."
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function PremiumStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[26px] border border-[#e2d4c6] bg-white p-5 shadow-[0_14px_30px_rgba(74,51,33,0.06)]">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">{label}</div>
      <div className="mt-3 font-serif text-3xl font-bold text-[#342116]">{value}</div>
      <div className="mt-2 text-sm font-semibold leading-6 text-[#8b6b4d]">{detail}</div>
    </div>
  );
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-[22px] border border-[#e5d7c8] bg-[#fcf9f5] p-4">
      <div className="text-sm font-black text-[#342116]">{title}</div>
      <div className="mt-1 text-[12px] font-semibold leading-6 text-[#8d6f52]">{desc}</div>
    </div>
  );
}
