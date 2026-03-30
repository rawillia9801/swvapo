"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { sb } from "@/lib/utils";
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

type PortalMessage = {
  id: string;
  created_at: string;
  user_id: string;
  user_email: string;
  subject: string | null;
  message: string;
  status: string;
  read_by_admin: boolean;
  read_by_user: boolean;
  sender: "user" | "admin";
};

export default function PortalMessagesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
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
        if (currentUser) await loadMessages(currentUser);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void init();

    const { data: authListener } = sb.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      if (!mounted) return;
      setUser(currentUser);
      if (currentUser) await loadMessages(currentUser);
      else setMessages([]);
      setLoading(false);
    });

    const onStorage = async (event: StorageEvent) => {
      if (!String(event.key || "").includes("supabase")) return;
      const {
        data: { session },
      } = await sb.auth.getSession();
      const currentUser = session?.user ?? null;
      if (!mounted) return;
      setUser(currentUser);
      if (currentUser) await loadMessages(currentUser);
      else setMessages([]);
    };

    window.addEventListener("storage", onStorage);

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  async function loadMessages(currentUser: User) {
    const email = String(currentUser.email || "").trim().toLowerCase();
    const uid = currentUser.id;

    try {
      let loadedMessages: PortalMessage[] = [];

      if (uid) {
        const byUserId = await sb
          .from("portal_messages")
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: false });

        if (!byUserId.error && byUserId.data?.length) {
          loadedMessages = byUserId.data as PortalMessage[];
        }
      }

      if (!loadedMessages.length && email) {
        const byUserEmail = await sb
          .from("portal_messages")
          .select("*")
          .ilike("user_email", email)
          .order("created_at", { ascending: false });

        if (!byUserEmail.error && byUserEmail.data?.length) {
          loadedMessages = byUserEmail.data as PortalMessage[];
        }
      }

      setMessages(loadedMessages);
    } catch (error) {
      console.error("loadMessages failed:", error);
      setMessages([]);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!message.trim()) {
      setStatusText("Please enter a message.");
      return;
    }

    setSending(true);
    setStatusText("");

    const payload = {
      user_id: user.id,
      user_email: String(user.email || "").trim(),
      subject: subject.trim() || null,
      message: message.trim(),
      status: "open",
      read_by_admin: false,
      read_by_user: true,
      sender: "user",
    };

    const { error } = await sb.from("portal_messages").insert(payload);

    if (error) {
      setStatusText(error.message || "Unable to send message.");
      setSending(false);
      return;
    }

    setSubject("");
    setMessage("");
    setStatusText("Message sent.");
    await loadMessages(user);
    setSending(false);
  }

  async function handleRefresh() {
    if (!user) return;
    setStatusText("");
    await loadMessages(user);
  }

  const groupedMessages = useMemo(() => {
    const sorted = [...messages].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const groups: { key: string; items: PortalMessage[] }[] = [];
    for (const entry of sorted) {
      const key = new Date(entry.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const last = groups[groups.length - 1];
      if (!last || last.key !== key) groups.push({ key, items: [entry] });
      else last.items.push(entry);
    }

    return groups;
  }, [messages]);

  const adminMessages = messages.filter((entry) => entry.sender === "admin").length;
  const userMessages = messages.filter((entry) => entry.sender === "user").length;
  const unreadByUser = messages.filter((entry) => entry.sender === "admin" && !entry.read_by_user).length;

  if (loading) {
    return <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">Loading messages...</div>;
  }

  if (!user) {
    return <MessagesLogin />;
  }

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Messages"
        title="A private conversation space for your puppy journey."
        description="Use Messages for questions, breeder updates, logistics, and ongoing support before go-home day and afterward."
        actions={
          <>
            <PortalHeroPrimaryAction href="/portal/mypuppy">Open My Puppy</PortalHeroPrimaryAction>
            <PortalHeroSecondaryAction href="/portal/documents">Open Documents</PortalHeroSecondaryAction>
          </>
        }
        aside={
          <div className="space-y-4">
            <PortalInfoTile
              label="Portal Email"
              value={user.email || "No email on file"}
              detail="Messages sent here stay connected to your portal account."
            />
            <PortalInfoTile
              label="Unread From Breeder"
              value={String(unreadByUser)}
              detail="New breeder replies you may want to review."
            />
          </div>
        }
      />

      <PortalMetricGrid>
        <PortalMetricCard label="Total Messages" value={String(messages.length)} detail="Every saved portal message in this conversation." />
        <PortalMetricCard label="From Breeder" value={String(adminMessages)} detail="Messages sent from Southwest Virginia Chihuahua." accent="from-[#dce9d6] via-[#b6cfaa] to-[#7e9c6f]" />
        <PortalMetricCard label="From You" value={String(userMessages)} detail="Messages you have sent through the portal." accent="from-[#ece3d5] via-[#d7c1a3] to-[#b18d62]" />
        <PortalMetricCard label="Unread" value={String(unreadByUser)} detail="Breeder replies still marked unread on your side." accent="from-[#f0dcc1] via-[#ddb68c] to-[#c98743]" />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <PortalPanel title="Send a Message" subtitle="Use this form whenever you need an update, want to confirm details, or need help with your account.">
            <form onSubmit={handleSendMessage} className="space-y-4">
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-[#a47946]">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Optional subject"
                  className="w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]"
                />
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-[#a47946]">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                  placeholder="Write your message here..."
                  className="w-full resize-none rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]"
                  required
                />
              </div>

              {statusText ? (
                <div className="rounded-[18px] border border-[#ead9c7] bg-[#fff9f2] px-4 py-3 text-sm text-[#7a5a3a]">
                  {statusText}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={sending}
                className="w-full rounded-[18px] bg-[#6b4d33] px-5 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-[0_14px_30px_rgba(88,63,37,0.18)] transition hover:bg-[#5b412c] disabled:opacity-60"
              >
                {sending ? "Sending..." : "Send Message"}
              </button>
            </form>
          </PortalPanel>

          <PortalPanel title="Conversation Tips" subtitle="A simple rhythm helps these conversations stay efficient and easy to track.">
            <div className="space-y-4">
              <PortalInfoTile
                label="Use clear subjects"
                value="Keep topics easy to spot"
                detail="A short subject helps when you return to earlier messages later."
              />
              <PortalInfoTile
                label="Ask here first"
                value="Keep support organized"
                detail="Using the portal keeps your puppy questions, updates, and breeder replies together."
              />
            </div>
          </PortalPanel>
        </div>

        <PortalPanel
          title="Conversation"
          subtitle="Your portal conversation history is collected here so you can follow updates without digging through texts or emails."
          actionHref="#"
          actionLabel="Refresh"
        >
          <div className="mb-5">
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex rounded-full border border-[#e5d2bc] bg-[#fff9f2] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b8772f] transition hover:border-[#d8b48b]"
            >
              Refresh Conversation
            </button>
          </div>

          {!messages.length ? (
            <PortalEmptyState
              title="No messages yet"
              description="Send your first message here whenever you need an update, want to confirm a detail, or have a question about your puppy journey."
            />
          ) : (
            <div className="space-y-8">
              {groupedMessages.map((group) => (
                <div key={group.key}>
                  <div className="mb-4">
                    <span className="inline-flex rounded-full border border-[#ead9c7] bg-[#fff9f2] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a47946]">
                      {group.key}
                    </span>
                  </div>

                  <div className="space-y-4">
                    {group.items.map((entry) => {
                      const isAdmin = entry.sender === "admin";
                      return (
                        <div
                          key={entry.id}
                          className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}
                        >
                          <div
                            className={[
                              "max-w-[85%] rounded-[28px] border px-5 py-4 shadow-[0_10px_24px_rgba(106,76,45,0.05)]",
                              isAdmin
                                ? "border-[#ead9c7] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2e9_100%)] text-[#2f2218]"
                                : "border-[#d8c2a8] bg-[linear-gradient(180deg,#6b4d33_0%,#5a3f2d_100%)] text-white",
                            ].join(" ")}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div
                                className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
                                  isAdmin ? "text-[#a47946]" : "text-white/70"
                                }`}
                              >
                                {isAdmin ? "Southwest Virginia Chihuahua" : "You"}
                              </div>
                              <div
                                className={`text-[10px] ${isAdmin ? "text-[#8d6f52]" : "text-white/60"}`}
                              >
                                {new Date(entry.created_at).toLocaleString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>

                            {entry.subject ? (
                              <div className={`mt-2 text-sm font-semibold ${isAdmin ? "text-[#2f2218]" : "text-white"}`}>
                                {entry.subject}
                              </div>
                            ) : null}

                            <div className={`mt-3 whitespace-pre-wrap text-sm leading-7 ${isAdmin ? "text-[#73583f]" : "text-white/92"}`}>
                              {entry.message}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <span
                                className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                                  isAdmin
                                    ? "border border-[#ead9c7] bg-white text-[#8d6f52]"
                                    : "border border-white/15 bg-white/10 text-white"
                                }`}
                              >
                                {entry.status || "open"}
                              </span>
                              <span
                                className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                                  isAdmin
                                    ? entry.read_by_user
                                      ? "border border-[#d5e3ce] bg-[#f6fbf2] text-[#6d8a5d]"
                                      : "border border-[#f0deb7] bg-[#fff8e8] text-[#b37a2d]"
                                    : entry.read_by_admin
                                      ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                                      : "border border-amber-200 bg-amber-50 text-amber-700"
                                }`}
                              >
                                {isAdmin
                                  ? entry.read_by_user
                                    ? "Read by you"
                                    : "Unread by you"
                                  : entry.read_by_admin
                                    ? "Read by breeder"
                                    : "Unread by breeder"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </PortalPanel>
      </section>
    </div>
  );
}

function MessagesLogin() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) alert(error.message);
  };

  return (
    <div className="grid min-h-[80vh] grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="overflow-hidden rounded-[36px] border border-[#e2d4c5] bg-[linear-gradient(135deg,#fff8f1_0%,#f8efe4_55%,#efe2d2_100%)] shadow-[0_26px_70px_rgba(88,63,37,0.10)]">
        <div className="px-7 py-8 md:px-10 md:py-10 lg:px-14 lg:py-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#dcc6ad] bg-white/70 px-4 py-2 shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#a47946]">Portal Messages</span>
          </div>
          <div className="mt-10 max-w-3xl">
            <h1 className="font-serif text-5xl font-bold leading-[0.95] text-[#3e2a1f] md:text-6xl">Welcome to your private conversation space.</h1>
            <p className="mt-6 max-w-2xl text-[17px] font-semibold leading-8 text-[#7a5a3a]">
              Sign in to review breeder updates and send questions through the portal instead of searching through email and text threads.
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[36px] border border-[#ead9c7] bg-white shadow-[0_30px_80px_rgba(88,63,37,0.10)]">
        <div className="px-7 py-8 md:px-10 md:py-10">
          <div className="mb-8">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#b08251]">Portal Messages Access</div>
            <h2 className="mt-3 font-serif text-4xl font-bold leading-none text-[#3e2a1f]">Sign in</h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-[#8a6a49]">Enter your portal login to continue your conversation.</p>
          </div>

          <form onSubmit={login} className="space-y-5">
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-[#a47946]">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]" required />
            </div>
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-[#a47946]">Password</label>
              <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} className="w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]" required />
            </div>
            <button className="w-full rounded-[18px] bg-[#6b4d33] px-5 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-[0_14px_30px_rgba(88,63,37,0.18)] transition hover:bg-[#5b412c]">Sign In</button>
          </form>
        </div>
      </section>
    </div>
  );
}
