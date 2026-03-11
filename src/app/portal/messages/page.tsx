"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { sb, fmtDate } from "@/lib/utils";

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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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
    const email = String(currUser?.email || "").toLowerCase();
    const uid = currUser?.id;

    const { data, error } = await sb
      .from("portal_messages")
      .select("*")
      .or(`user_id.eq.${uid},user_email.ilike.%${email}%`)
      .order("created_at", { ascending: false });

    if (!error) {
      setMessages((data || []) as PortalMessage[]);
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
    <div className="flex h-screen overflow-hidden text-brand-900 bg-brand-50">
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white/80 backdrop-blur-md h-16 flex items-center justify-between px-6 border-b border-brand-200/50">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsDrawerOpen(true)} className="text-brand-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-serif font-bold text-xl">SWVA</span>
        </div>

        <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center border border-brand-200 font-bold text-brand-600">
          {user.email?.[0]?.toUpperCase() || "U"}
        </div>
      </header>

      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-brand-900/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 bottom-0 w-[82%] max-w-[320px] bg-[#FDFBF9] z-50 shadow-2xl flex flex-col transition-transform duration-300 md:hidden ${
          isDrawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 border-b border-brand-100 flex justify-between items-center">
          <div>
            <div className="font-serif font-bold text-xl">Menu</div>
            <div className="text-[11px] text-brand-400 font-semibold mt-1 truncate max-w-[220px]">
              {user.email}
            </div>
          </div>
          <button onClick={() => setIsDrawerOpen(false)}>×</button>
        </div>

        <nav className="p-5 pt-7 flex flex-col gap-3 flex-1 overflow-y-auto">
          <Link href="/portal" className="nav-item">
            Dashboard
          </Link>
          <Link href="/portal/application" className="nav-item">
            Application
          </Link>
          <Link href="/portal/mypuppy" className="nav-item">
            My Puppy
          </Link>
          <Link href="/portal/messages" className="nav-item active">
            Messages
          </Link>
          <Link href="/portal/documents" className="nav-item">
            Documents
          </Link>
          <Link href="/portal/payments" className="nav-item">
            Financials
          </Link>
          <Link href="/portal/resources" className="nav-item">
            Resources
          </Link>
        </nav>

        <div className="p-6 border-t border-brand-100 bg-brand-50">
          <button
            onClick={handleSignOut}
            className="w-full py-3 rounded-lg border border-brand-200 text-brand-700 font-black text-sm hover:bg-white transition"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <aside className="hidden md:flex flex-col w-72 bg-white/80 border-r border-brand-200/60 z-20 h-full backdrop-blur-sm">
        <div className="p-8">
          <h1 className="font-serif font-bold text-xl leading-none">SWVA</h1>
          <p className="text-[10px] uppercase tracking-widest text-brand-500 font-black mt-1">
            Chihuahua
          </p>
        </div>

        <nav className="flex-1 px-4 pt-6 pb-6 overflow-y-auto">
          <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-brand-400">
            Portal
          </div>

          <div className="mt-3 flex flex-col gap-3">
            <Link href="/portal" className="nav-item">
              Dashboard
            </Link>
            <Link href="/portal/application" className="nav-item">
              Application
            </Link>
            <Link href="/portal/mypuppy" className="nav-item">
              My Puppy
            </Link>
          </div>

          <div className="px-4 py-2 mt-8 text-[10px] font-black uppercase tracking-widest text-brand-400">
            Communication
          </div>

          <div className="mt-3 flex flex-col gap-3">
            <Link href="/portal/messages" className="nav-item active">
              Messages
            </Link>
            <Link href="/portal/documents" className="nav-item">
              Contracts
            </Link>
            <Link href="/portal/payments" className="nav-item">
              Financials
            </Link>
            <Link href="/portal/resources" className="nav-item">
              Resources
            </Link>
          </div>
        </nav>

        <div className="p-4 border-t border-brand-100 bg-brand-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-200 flex items-center justify-center text-brand-700 font-black text-xs">
              {user.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black truncate">{user.email}</p>
              <div className="flex items-center gap-3 mt-1">
                <button
                  onClick={handleRefresh}
                  className="text-[10px] font-black uppercase text-brand-500 hover:text-brand-800"
                >
                  Refresh
                </button>
                <button
                  onClick={handleSignOut}
                  className="text-[10px] font-black uppercase text-brand-500 hover:text-brand-800"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 h-full relative flex flex-col overflow-hidden bg-texturePaper pt-16 md:pt-0">
        <div className="flex-1 p-6 md:p-10 lg:p-12 overflow-y-auto scroller max-w-[1600px] mx-auto w-full">
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