"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fmtDate, sb } from "@/lib/utils";

type SessionUser = {
  id: string;
  email?: string | null;
};

type PortalMessage = {
  id: string;
  created_at: string;
  subject: string | null;
  message: string;
  read_by_user: boolean;
};

type PuppyEvent = {
  id: number;
  event_date: string;
  label: string | null;
  details: string | null;
  event_type: string;
};

type HealthRecord = {
  id: number;
  record_date: string;
  title: string;
  description: string | null;
};

type Notice = {
  id: string;
  kind: "message" | "milestone" | "health";
  date: string;
  title: string;
  body: string;
  href: string;
  isUnread?: boolean;
};

export default function PortalNotificationsPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
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
        if (currentUser) {
          await loadNotifications(currentUser);
        }
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
        await loadNotifications(currentUser);
      } else {
        setMessages([]);
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

  async function loadNotifications(currentUser: SessionUser) {
    const email = String(currentUser.email || "").trim().toLowerCase();

    const unreadMessagesRes = await sb
      .from("portal_messages")
      .select("id,created_at,subject,message,read_by_user")
      .or(`user_id.eq.${currentUser.id},user_email.ilike.${email}`)
      .order("created_at", { ascending: false })
      .limit(12);

    setMessages((unreadMessagesRes.data as PortalMessage[]) || []);

    const buyerRes = await sb
      .from("buyers")
      .select("id")
      .or(`user_id.eq.${currentUser.id},email.ilike.${email},buyer_email.ilike.${email}`)
      .limit(1)
      .maybeSingle();

    const buyerId = Number(buyerRes.data?.id || 0) || null;
    let puppyId: number | null = null;

    if (buyerId) {
      const puppyRes = await sb
        .from("puppies")
        .select("id")
        .eq("buyer_id", buyerId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      puppyId = Number(puppyRes.data?.id || 0) || null;
    }

    if (!puppyId) {
      setEvents([]);
      setHealth([]);
      return;
    }

    const [eventsRes, healthRes] = await Promise.all([
      sb
        .from("puppy_events")
        .select("id,event_date,label,details,event_type")
        .eq("puppy_id", puppyId)
        .order("event_date", { ascending: false })
        .limit(8),
      sb
        .from("puppy_health")
        .select("id,record_date,title,description")
        .eq("puppy_id", puppyId)
        .eq("is_visible_to_buyer", true)
        .order("record_date", { ascending: false })
        .limit(8),
    ]);

    setEvents((eventsRes.data as PuppyEvent[]) || []);
    setHealth((healthRes.data as HealthRecord[]) || []);
  }

  const notices = useMemo<Notice[]>(() => {
    const items: Notice[] = [
      ...messages.map((message) => ({
        id: `message-${message.id}`,
        kind: "message" as const,
        date: message.created_at,
        title: message.subject || "New portal message",
        body: message.message,
        href: "/portal/messages",
        isUnread: !message.read_by_user,
      })),
      ...events.map((event) => ({
        id: `event-${event.id}`,
        kind: "milestone" as const,
        date: event.event_date,
        title: event.label || event.event_type || "Puppy update",
        body: event.details || "A new puppy milestone was added to your portal.",
        href: "/portal/updates",
      })),
      ...health.map((record) => ({
        id: `health-${record.id}`,
        kind: "health" as const,
        date: record.record_date,
        title: record.title || "Health update",
        body: record.description || "A new health record was posted to your portal.",
        href: "/portal/updates",
      })),
    ];

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [events, health, messages]);

  if (loading) {
    return <div className="py-20 text-center text-sm font-semibold text-[#8b6b4d]">Loading notifications...</div>;
  }

  if (!user) {
    return <div className="py-20 text-center text-sm font-semibold text-[#8b6b4d]">Please sign in to view notifications.</div>;
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-[#dccab7] bg-white p-7 shadow-[0_16px_40px_rgba(74,51,33,0.08)]">
        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#9c7b58]">Notifications</div>
        <h1 className="mt-3 font-serif text-4xl font-bold text-[#3b271b]">Recent Activity</h1>
        <p className="mt-3 text-sm font-semibold leading-7 text-[#8b6b4d]">
          Messages, milestones, and health updates for your account are collected here so nothing important gets missed.
        </p>
      </section>

      <section className="rounded-[2rem] border border-[#dccab7] bg-white p-7 shadow-[0_16px_40px_rgba(74,51,33,0.08)]">
        <div className="space-y-4">
          {notices.length ? (
            notices.map((notice) => (
              <Link
                key={notice.id}
                href={notice.href}
                className="block rounded-[1.4rem] border border-[#e5d7c8] bg-[#fcf9f5] p-5 transition hover:bg-white"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#8b6b4d]">
                      {notice.kind}
                    </span>
                    {notice.isUnread ? <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" /> : null}
                  </div>
                  <div className="text-xs font-semibold text-[#8b6b4d]">{fmtDate(notice.date)}</div>
                </div>
                <div className="mt-3 text-lg font-black text-[#342116]">{notice.title}</div>
                <div className="mt-2 text-sm font-semibold leading-7 text-[#6f5037]">{notice.body}</div>
              </Link>
            ))
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-[#e5d7c8] bg-[#fcf8f3] py-14 text-center text-sm font-semibold italic text-[#9e8164]">
              You do not have any notifications yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
