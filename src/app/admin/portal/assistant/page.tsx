"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { sb } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
};

type ChiChiResponse = {
  text?: string;
  threadId?: string | null;
  adminAuth?: {
    userId?: string | null;
    email?: string | null;
    canWriteCore?: boolean;
  };
};

const STARTER_MESSAGES = [
  "Add buyer Jane Doe with email jane@example.com and phone 276-555-0101",
  "Add puppy Bella, female, cream long coat, born 2026-03-01, price 2800",
  "Log a payment of 500 for Jane Doe on 2026-03-28 by cash",
  "Edit Jane Doe's payment on 2026-03-28 to status cleared and note paid in person",
  "Add a puppy weight for Bella of 24 oz on 2026-03-28",
];

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatTime() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminPortalAssistantPage() {
  const [user, setUser] = useState<{ id: string; email?: string | null } | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [statusText, setStatusText] = useState("");
  const [adminAuth, setAdminAuth] = useState<{
    userId?: string | null;
    email?: string | null;
    canWriteCore?: boolean;
  } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: makeId("assistant"),
      role: "assistant",
      text:
        "Use plain-language admin commands here. I can add buyers, add puppies, log or edit payments, add puppy events, and record puppy weights.",
      createdAt: formatTime(),
    },
  ]);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const {
          data: { session },
        } = await sb.auth.getSession();

        if (!mounted) return;

        setUser(session?.user ?? null);
        setAccessToken(session?.access_token || "");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: authListener } = sb.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      setUser(session?.user ?? null);
      setAccessToken(session?.access_token || "");
      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  const routeMessages = useMemo(
    () =>
      messages.map((message) => ({
        role: message.role,
        content: message.text,
      })),
    [messages]
  );

  async function sendMessage(overrideText?: string) {
    const text = String(overrideText ?? draft).trim();
    if (!text || sending) return;

    const userMessage: ChatMessage = {
      id: makeId("user"),
      role: "user",
      text,
      createdAt: formatTime(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!overrideText) setDraft("");
    setSending(true);
    setStatusText("");

    try {
      const res = await fetch("/api/buildlio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          threadId,
          accessToken,
          max_tokens: 1200,
          messages: [...routeMessages, { role: "user", content: text }],
        }),
      });

      const data = (await res.json()) as ChiChiResponse;
      const reply =
        String(data?.text || "").trim() ||
        "I ran into a problem while processing that admin command.";

      if (data?.threadId) setThreadId(data.threadId);
      if (data?.adminAuth) setAdminAuth(data.adminAuth);

      setMessages((prev) => [
        ...prev,
        {
          id: makeId("assistant"),
          role: "assistant",
          text: reply,
          createdAt: formatTime(),
        },
      ]);
    } catch (error) {
      console.error("Admin assistant error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: makeId("assistant"),
          role: "assistant",
          text: "I hit a connection problem while trying to complete that command.",
          createdAt: formatTime(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function handleSignOut() {
    await sb.auth.signOut();
    setUser(null);
    setAccessToken("");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50 italic text-brand-700">
        Loading admin assistant...
      </div>
    );
  }

  if (!user) {
    return <AdminAssistantLogin />;
  }

  return (
    <div className="min-h-screen bg-brand-50 text-brand-900">
      <main className="min-h-screen bg-texturePaper">
        <div className="mx-auto w-full max-w-[1700px] px-4 py-6 md:px-8 md:py-8 lg:px-10 lg:py-10">
          <div className="space-y-6">
            <header className="rounded-[32px] border border-brand-200 bg-gradient-to-br from-[#fff8f1] via-[#fffefc] to-white p-6 shadow-paper md:p-8">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-4 py-2 shadow-sm">
                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                      Admin Portal
                    </span>
                    <span className="h-1 w-1 rounded-full bg-brand-300" />
                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                      ChiChi Console
                    </span>
                  </div>

                  <h1 className="mt-5 font-serif text-4xl font-bold leading-[0.96] text-brand-900 md:text-5xl">
                    Admin Assistant
                  </h1>

                  <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-brand-500 md:text-base">
                    Type natural admin commands to create buyers and puppies, log or edit payments,
                    and add puppy weights without leaving the portal.
                  </p>
                  <p className="mt-2 max-w-3xl text-xs font-semibold leading-6 text-brand-400 md:text-sm">
                    This admin UI is always available to signed-in staff. If a command is refused,
                    that means the server-side Core admin permission list still needs your account
                    added.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/admin/portal"
                    className="inline-flex items-center gap-2 rounded-[18px] border border-brand-200 bg-white px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-brand-700 transition hover:bg-brand-50"
                  >
                    Portal Admin
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-2 rounded-[18px] border border-brand-200 bg-white px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-brand-700 transition hover:bg-brand-50"
                  >
                    Sign Out
                  </button>
                </div>
              </div>

              {adminAuth ? (
                <div className="mt-5 rounded-[20px] border border-brand-200 bg-white/80 p-4 text-xs font-semibold leading-6 text-brand-600">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
                    Server Admin Status
                  </div>
                  <div className="mt-1">
                    {adminAuth.canWriteCore ? "Write access enabled." : "Write access not enabled yet."}
                  </div>
                  <div className="break-all">{adminAuth.email || "No email returned"}</div>
                  <div className="break-all text-brand-400">
                    {adminAuth.userId || "No user id returned"}
                  </div>
                </div>
              ) : null}
            </header>

            {statusText ? (
              <div className="text-sm font-semibold text-brand-600">{statusText}</div>
            ) : null}

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
              <div className="space-y-6">
                <div className="card-luxury p-6">
                  <h2 className="font-serif text-2xl font-bold text-brand-900">
                    Quick Commands
                  </h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-brand-500">
                    Tap one to send it as-is, or use it as a starting point for your own wording.
                  </p>

                  <div className="mt-5 space-y-3">
                    {STARTER_MESSAGES.map((sample) => (
                      <button
                        key={sample}
                        type="button"
                        onClick={() => void sendMessage(sample)}
                        className="w-full rounded-2xl border border-brand-200 bg-white/85 p-4 text-left text-sm font-semibold leading-6 text-brand-800 transition hover:bg-white"
                      >
                        {sample}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="card-luxury p-6">
                  <h2 className="font-serif text-2xl font-bold text-brand-900">
                    Supported Actions
                  </h2>
                  <div className="mt-4 space-y-3 text-sm font-semibold leading-6 text-brand-600">
                    <p>`add buyer` with name, email, phone, status, and notes</p>
                    <p>`add puppy` with puppy details and optional buyer assignment</p>
                    <p>`log payment` for a buyer with amount and date</p>
                    <p>`edit payment` using buyer plus date or reference details</p>
                    <p>`add puppy weight` with ounces or grams and a date</p>
                    <p>`add puppy event` for milestones and updates</p>
                  </div>
                </div>
              </div>

              <div className="card-luxury flex min-h-[760px] flex-col p-6">
                <div className="flex items-center justify-between gap-3 border-b border-brand-200 pb-4">
                  <div>
                    <h2 className="font-serif text-2xl font-bold text-brand-900">
                      Conversation
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-brand-500">
                      Natural language works best. Include names, amounts, and dates when you can.
                    </p>
                  </div>
                  <span className="rounded-full border border-brand-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-brand-600">
                    {sending ? "Processing" : "Ready"}
                  </span>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto py-6">
                  {messages.map((message) => {
                    const isUser = message.role === "user";

                    return (
                      <div
                        key={message.id}
                        className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[88%] rounded-3xl border px-5 py-4 shadow-paper ${
                            isUser
                              ? "border-brand-800 bg-brand-800 text-white"
                              : "border-brand-200 bg-white text-brand-900"
                          }`}
                        >
                          <div
                            className={`mb-2 text-[10px] font-black uppercase tracking-[0.18em] ${
                              isUser ? "text-white/70" : "text-brand-500"
                            }`}
                          >
                            {isUser ? "Admin" : "ChiChi"}
                          </div>
                          <div className="whitespace-pre-wrap text-sm font-semibold leading-6">
                            {message.text}
                          </div>
                          <div
                            className={`mt-3 text-[10px] font-semibold ${
                              isUser ? "text-white/65" : "text-brand-400"
                            }`}
                          >
                            {message.createdAt}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sendMessage();
                  }}
                  className="border-t border-brand-200 pt-4"
                >
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
                    Command
                  </label>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={4}
                    placeholder="Example: Add buyer Jane Doe with email jane@example.com and phone 276-555-0101"
                    className="w-full rounded-2xl border border-brand-200 bg-white px-4 py-3 text-sm text-brand-900 outline-none resize-none"
                  />
                  <div className="mt-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={sending || !draft.trim()}
                      className="inline-flex items-center gap-2 rounded-[18px] bg-brand-800 px-6 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-brand-700 disabled:opacity-60"
                    >
                      {sending ? "Running..." : "Send Command"}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function AdminAssistantLogin() {
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
    <div className="min-h-screen flex items-center justify-center bg-brand-50 p-6">
      <div className="card-luxury shine p-10 w-full max-w-md border border-white">
        <h2 className="font-serif text-4xl font-bold text-center mb-8">Admin Sign In</h2>

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
