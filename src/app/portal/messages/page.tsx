"use client";

import React, { useEffect, useMemo, useState } from "react";
import { sb } from "@/lib/utils";

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
  const [user, setUser] = useState<any>(null);
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

        if (currentUser) {
          await loadMessages(currentUser);
        } else {
          setMessages([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: authListener } = sb.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;
        if (!mounted) return;

        setUser(currentUser);

        if (currentUser) {
          await loadMessages(currentUser);
        } else {
          setMessages([]);
        }

        setLoading(false);
      }
    );

    const onStorage = async (e: StorageEvent) => {
      if (!String(e.key || "").includes("supabase")) return;

      const {
        data: { session },
      } = await sb.auth.getSession();

      const currentUser = session?.user ?? null;
      if (!mounted) return;

      setUser(currentUser);

      if (currentUser) {
        await loadMessages(currentUser);
      } else {
        setMessages([]);
      }
    };

    window.addEventListener("storage", onStorage);

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  async function loadMessages(currUser: any) {
    const email = String(currUser?.email || "").trim().toLowerCase();
    const uid = currUser?.id as string | undefined;

    try {
      let data: PortalMessage[] = [];

      if (uid) {
        const byUserId = await sb
          .from("portal_messages")
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: false });

        if (!byUserId.error && byUserId.data?.length) {
          data = byUserId.data as PortalMessage[];
        } else if (byUserId.error) {
          console.warn("portal_messages by user_id failed:", byUserId.error.message);
        }
      }

      if (!data.length && email) {
        const byEmail = await sb
          .from("portal_messages")
          .select("*")
          .ilike("user_email", email)
          .order("created_at", { ascending: false });

        if (!byEmail.error && byEmail.data?.length) {
          data = byEmail.data as PortalMessage[];
        } else if (byEmail.error) {
          console.warn("portal_messages by user_email failed:", byEmail.error.message);
        }
      }

      setMessages(data || []);
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

  async function handleSignOut() {
    await sb.auth.signOut();
    setUser(null);
    setMessages([]);
  }

  const groupedMessages = useMemo(() => {
    const sorted = [...messages].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const groups: { key: string; items: PortalMessage[] }[] = [];

    for (const msg of sorted) {
      const d = new Date(msg.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      const last = groups[groups.length - 1];
      if (!last || last.key !== d) {
        groups.push({ key: d, items: [msg] });
      } else {
        last.items.push(msg);
      }
    }

    return groups;
  }, [messages]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-50 italic">
        Loading Messages...
      </div>
    );
  }

  if (!user) {
    return <MessagesLogin />;
  }

  return (
    <div className="min-h-screen text-brand-900 bg-brand-50">
      <main className="relative flex flex-col bg-texturePaper">
        <div className="w-full max-w-[1600px] mx-auto p-6 md:p-10 lg:p-12">
          <div className="space-y-8 pb-14">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-brand-200 shadow-paper">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                    Messages
                  </span>
                  <span className="w-1 h-1 rounded-full bg-brand-300" />
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                    SWVA Chihuahua
                  </span>
                </div>

                <h2 className="mt-5 font-serif text-4xl md:text-5xl font-bold text-brand-900 leading-[0.95]">
                  Your Messages
                </h2>

                <p className="mt-2 text-brand-500 font-semibold">
                  Send updates or questions to the breeder and review your conversation history.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] bg-white border border-brand-200 text-brand-700">
                  Total: {messages.length}
                </span>
                <button
                  onClick={handleRefresh}
                  className="px-5 py-3 bg-white border border-brand-200 text-brand-800 font-black text-xs uppercase tracking-[0.18em] rounded-xl hover:bg-brand-50 transition shadow-paper"
                >
                  Refresh
                </button>
                <button
                  onClick={handleSignOut}
                  className="px-5 py-3 bg-white border border-brand-200 text-brand-800 font-black text-xs uppercase tracking-[0.18em] rounded-xl hover:bg-brand-50 transition shadow-paper"
                >
                  Sign Out
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              <div className="xl:col-span-4">
                <div className="card-luxury p-7 sticky top-6">
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <h3 className="font-serif text-2xl font-bold text-brand-900">
                      Send Message
                    </h3>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-400">
                      Portal Support
                    </span>
                  </div>

                  <form onSubmit={handleSendMessage} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-brand-500 mb-2">
                        Subject
                      </label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Optional subject"
                        className="w-full rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm text-brand-900 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-brand-500 mb-2">
                        Message
                      </label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={7}
                        placeholder="Write your message here..."
                        className="w-full rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm text-brand-900 outline-none resize-none"
                        required
                      />
                    </div>

                    {statusText ? (
                      <div className="text-sm font-semibold text-brand-600">{statusText}</div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={sending}
                      className="w-full px-6 py-3 rounded-xl bg-brand-800 text-white font-black text-xs uppercase tracking-[0.18em] hover:bg-brand-700 transition shadow-lift disabled:opacity-60"
                    >
                      {sending ? "Sending..." : "Send Message"}
                    </button>
                  </form>

                  <div className="mt-5 p-4 rounded-2xl bg-white/60 border border-brand-200">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
                      Account
                    </div>
                    <div className="mt-1 text-sm font-black text-brand-900 break-all">
                      {user.email}
                    </div>
                  </div>
                </div>
              </div>

              <div className="xl:col-span-8">
                <div className="card-luxury p-7">
                  <div className="flex items-center justify-between gap-3 mb-6">
                    <h3 className="font-serif text-2xl font-bold text-brand-900">
                      Conversation
                    </h3>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-400">
                      Latest first in database
                    </span>
                  </div>

                  {!messages.length ? (
                    <div className="text-center py-16">
                      <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl border border-brand-200">
                        💬
                      </div>
                      <h4 className="font-serif text-3xl font-bold text-brand-800">
                        No Messages Yet
                      </h4>
                      <p className="text-brand-500 mt-3 max-w-md mx-auto text-sm font-semibold leading-relaxed">
                        Send your first message to get in touch with the breeder through the portal.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {groupedMessages.map((group) => (
                        <div key={group.key}>
                          <div className="sticky top-0 z-10 mb-4">
                            <span className="inline-flex px-3 py-1 rounded-full bg-brand-100 border border-brand-200 text-[10px] font-black uppercase tracking-[0.18em] text-brand-600">
                              {group.key}
                            </span>
                          </div>

                          <div className="space-y-4">
                            {group.items.map((m) => {
                              const isAdmin = m.sender === "admin";

                              return (
                                <div
                                  key={m.id}
                                  className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}
                                >
                                  <div
                                    className={`max-w-[85%] rounded-3xl px-5 py-4 border shadow-paper ${
                                      isAdmin
                                        ? "bg-white border-brand-200 text-brand-900"
                                        : "bg-brand-800 border-brand-800 text-white"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-4 mb-2">
                                      <div
                                        className={`text-[10px] font-black uppercase tracking-[0.18em] ${
                                          isAdmin ? "text-brand-500" : "text-white/70"
                                        }`}
                                      >
                                        {isAdmin ? "Support" : "You"}
                                      </div>

                                      <div
                                        className={`text-[10px] font-semibold ${
                                          isAdmin ? "text-brand-400" : "text-white/60"
                                        }`}
                                      >
                                        {new Date(m.created_at).toLocaleString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                          hour: "numeric",
                                          minute: "2-digit",
                                        })}
                                      </div>
                                    </div>

                                    {m.subject ? (
                                      <div
                                        className={`text-xs font-black mb-2 ${
                                          isAdmin ? "text-brand-800" : "text-white"
                                        }`}
                                      >
                                        {m.subject}
                                      </div>
                                    ) : null}

                                    <div
                                      className={`text-sm leading-relaxed font-semibold whitespace-pre-wrap ${
                                        isAdmin ? "text-brand-800" : "text-white"
                                      }`}
                                    >
                                      {m.message}
                                    </div>

                                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                                      <span
                                        className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] ${
                                          isAdmin
                                            ? "bg-brand-50 text-brand-600 border border-brand-200"
                                            : "bg-white/10 text-white border border-white/20"
                                        }`}
                                      >
                                        {m.status || "open"}
                                      </span>

                                      {!isAdmin ? (
                                        <span
                                          className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] ${
                                            m.read_by_admin
                                              ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                              : "bg-amber-100 text-amber-700 border border-amber-200"
                                          }`}
                                        >
                                          {m.read_by_admin ? "Read by admin" : "Unread by admin"}
                                        </span>
                                      ) : (
                                        <span
                                          className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] ${
                                            m.read_by_user
                                              ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                              : "bg-amber-100 text-amber-700 border border-amber-200"
                                          }`}
                                        >
                                          {m.read_by_user ? "Read by you" : "Unread by you"}
                                        </span>
                                      )}
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
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function MessagesLogin() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const login = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await sb.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error) alert(error.message);
  };

  return (
    <div className="h-screen flex items-center justify-center bg-brand-50 p-6">
      <div className="card-luxury shine p-10 w-full max-w-md border border-white">
        <h2 className="font-serif text-4xl font-bold text-center mb-8">
          Welcome Home
        </h2>

        <form onSubmit={login} className="space-y-5">
          <div>
            <label className="text-[10px] font-black uppercase text-brand-500 mb-1 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-xl border border-brand-200"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-brand-500 mb-1 block">
              Password
            </label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="w-full p-3 rounded-xl border border-brand-200"
              required
            />
          </div>

          <button className="w-full bg-brand-800 text-white p-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lift">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}