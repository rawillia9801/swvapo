"use client";

import React, { useEffect, useMemo, useState } from "react";
import { fmtDate, sb } from "@/lib/utils";

type SessionUser = {
  id: string;
  email?: string | null;
};

type PuppyEvent = {
  id: number;
  event_date: string;
  event_type: string;
  label: string | null;
  details: string | null;
  value: number | null;
  unit: string | null;
};

type HealthRecord = {
  id: number;
  record_date: string;
  record_type: string;
  title: string;
  description: string | null;
  next_due_date: string | null;
};

type TimelineItem = {
  id: string;
  date: string;
  title: string;
  body: string;
  badge: string;
};

export default function PortalUpdatesPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [events, setEvents] = useState<PuppyEvent[]>([]);
  const [health, setHealth] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const {
          data: { session },
        } = await sb.auth.getSession();

        if (!mounted) return;
        const currentUser = (session?.user as SessionUser | null) ?? null;
        setUser(currentUser);
        if (currentUser) await loadUpdates(currentUser);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void init();

    const { data: authListener } = sb.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = (session?.user as SessionUser | null) ?? null;
      if (!mounted) return;
      setUser(currentUser);
      if (currentUser) {
        await loadUpdates(currentUser);
      } else {
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

  async function loadUpdates(currentUser: SessionUser) {
    const email = String(currentUser.email || "").trim().toLowerCase();

    const buyerRes = await sb
      .from("buyers")
      .select("id")
      .or(`user_id.eq.${currentUser.id},email.ilike.${email},buyer_email.ilike.${email}`)
      .limit(1)
      .maybeSingle();

    const buyerId = Number(buyerRes.data?.id || 0) || null;
    if (!buyerId) {
      setEvents([]);
      setHealth([]);
      return;
    }

    const puppyRes = await sb
      .from("puppies")
      .select("id")
      .eq("buyer_id", buyerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const puppyId = Number(puppyRes.data?.id || 0) || null;
    if (!puppyId) {
      setEvents([]);
      setHealth([]);
      return;
    }

    const [eventsRes, healthRes] = await Promise.all([
      sb
        .from("puppy_events")
        .select("id,event_date,event_type,label,details,value,unit")
        .eq("puppy_id", puppyId)
        .order("event_date", { ascending: false }),
      sb
        .from("puppy_health")
        .select("id,record_date,record_type,title,description,next_due_date")
        .eq("puppy_id", puppyId)
        .eq("is_visible_to_buyer", true)
        .order("record_date", { ascending: false }),
    ]);

    setEvents((eventsRes.data as PuppyEvent[]) || []);
    setHealth((healthRes.data as HealthRecord[]) || []);
  }

  const timeline = useMemo<TimelineItem[]>(() => {
    const rows: TimelineItem[] = [
      ...events.map((event) => ({
        id: `event-${event.id}`,
        date: event.event_date,
        title: event.label || event.event_type || "Puppy update",
        body:
          `${event.details || "A new milestone was posted."}${event.value !== null && event.value !== undefined ? ` ${event.value}${event.unit ? ` ${event.unit}` : ""}` : ""}`.trim(),
        badge: "Milestone",
      })),
      ...health.map((record) => ({
        id: `health-${record.id}`,
        date: record.record_date,
        title: record.title || record.record_type || "Health update",
        body:
          `${record.description || "A health note was posted."}${record.next_due_date ? ` Next due: ${fmtDate(record.next_due_date)}.` : ""}`.trim(),
        badge: "Health",
      })),
    ];

    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [events, health]);

  if (loading) {
    return <div className="py-20 text-center text-sm font-semibold text-[#8b6b4d]">Loading updates...</div>;
  }

  if (!user) {
    return <div className="py-20 text-center text-sm font-semibold text-[#8b6b4d]">Please sign in to view updates.</div>;
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-[#dccab7] bg-white p-7 shadow-[0_16px_40px_rgba(74,51,33,0.08)]">
        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#9c7b58]">Updates</div>
        <h1 className="mt-3 font-serif text-4xl font-bold text-[#3b271b]">Puppy Updates</h1>
        <p className="mt-3 text-sm font-semibold leading-7 text-[#8b6b4d]">
          Milestones, health notes, and breeder-posted progress all live here in one timeline.
        </p>
      </section>

      <section className="rounded-[2rem] border border-[#dccab7] bg-white p-7 shadow-[0_16px_40px_rgba(74,51,33,0.08)]">
        <div className="space-y-4">
          {timeline.length ? (
            timeline.map((item) => (
              <div
                key={item.id}
                className="rounded-[1.4rem] border border-[#e5d7c8] bg-[#fcf9f5] p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#8b6b4d]">
                    {item.badge}
                  </span>
                  <div className="text-xs font-semibold text-[#8b6b4d]">{fmtDate(item.date)}</div>
                </div>
                <div className="mt-3 text-lg font-black text-[#342116]">{item.title}</div>
                <div className="mt-2 text-sm font-semibold leading-7 text-[#6f5037]">{item.body}</div>
              </div>
            ))
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-[#e5d7c8] bg-[#fcf8f3] py-14 text-center text-sm font-semibold italic text-[#9e8164]">
              No updates have been posted yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
