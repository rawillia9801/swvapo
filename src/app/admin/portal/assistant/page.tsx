"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Activity, Bot, RefreshCcw, ShieldCheck, Sparkles } from "lucide-react";
import { sb } from "@/lib/utils";
import { getPortalAdminEmails, isPortalAdminEmail } from "@/lib/portal-admin";

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

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function shortThreadId(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return "No active thread";
  return text.length > 18 ? `${text.slice(0, 18)}...` : text;
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
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
    }

    void init();

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

  async function sendMessage() {
    const text = draft.trim();
    if (!text || sending) return;

    const userMessage: ChatMessage = {
      id: makeId("user"),
      role: "user",
      text,
      createdAt: formatTime(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setDraft("");
    setSending(true);
    setStatusText("");

    try {
      const response = await fetch("/api/buildlio", {
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

      const data = (await response.json()) as ChiChiResponse;
      const reply =
        String(data?.text || "").trim() ||
        "I ran into a problem while processing that request.";

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
          text: "I hit a connection problem while trying to complete that request.",
          createdAt: formatTime(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleResetSession() {
    setThreadId(null);
    setMessages([]);
    setStatusText("");
  }

  async function handleSignOut() {
    await sb.auth.signOut();
    setUser(null);
    setAccessToken("");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#eef3fb_0%,#f8fbff_100%)] text-[#22324a]">
        <div className="mx-auto flex min-h-screen max-w-[1440px] items-center justify-center px-6 py-10">
          <div className="rounded-[32px] border border-white/70 bg-white/80 px-8 py-6 shadow-[0_30px_80px_rgba(43,71,113,0.10)] backdrop-blur-xl">
            <div className="flex items-center gap-3 text-sm font-semibold tracking-[0.14em] text-[#607089] uppercase">
              <Bot className="h-4 w-4 text-[#5474d8]" />
              Loading ChiChi
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AdminAssistantLogin />;
  }

  if (!isPortalAdminEmail(user.email)) {
    return (
      <RestrictedOwnerConsole />
    );
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#edf2fa_0%,#f8fbff_40%,#eef4fb_100%)] text-[#1e2d42]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top_left,rgba(104,136,255,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(96,166,255,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0))]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(120,144,180,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(120,144,180,0.08)_1px,transparent_1px)] bg-[size:52px_52px] opacity-30" />
      </div>

      <main className="relative mx-auto min-h-screen w-full max-w-[1820px] px-4 py-5 md:px-8 md:py-8 xl:px-10">
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <section className="overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(244,248,255,0.96)_100%)] p-6 shadow-[0_28px_90px_rgba(47,77,120,0.12)] backdrop-blur-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d9e4f5] bg-white/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#6981a8]">
                <Sparkles className="h-3.5 w-3.5 text-[#5576dd]" />
                ChiChi
              </div>
              <h1 className="mt-5 text-[2.9rem] font-semibold tracking-[-0.06em] text-[#162334] md:text-[3.6rem]">
                ChiChi
              </h1>
              <p className="mt-3 text-sm leading-7 text-[#617188]">
                Run direct changes across buyers, puppies, payments, documents, updates, and portal records from one console.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/admin/portal"
                  className="inline-flex items-center rounded-2xl border border-[#d7e0f0] bg-white px-4 py-3 text-sm font-semibold text-[#324763] shadow-[0_12px_30px_rgba(44,72,113,0.08)] transition hover:-translate-y-0.5 hover:border-[#adc2eb]"
                >
                  Admin Overview
                </Link>
                <button
                  type="button"
                  onClick={handleResetSession}
                  className="inline-flex items-center gap-2 rounded-2xl border border-[#d7e0f0] bg-white px-4 py-3 text-sm font-semibold text-[#324763] shadow-[0_12px_30px_rgba(44,72,113,0.08)] transition hover:-translate-y-0.5 hover:border-[#adc2eb]"
                >
                  <RefreshCcw className="h-4 w-4" />
                  New Session
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#253956_0%,#3c5379_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(38,57,87,0.22)] transition hover:-translate-y-0.5 hover:brightness-105"
                >
                  Sign Out
                </button>
              </div>
            </section>

            <section className="space-y-4 rounded-[34px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(241,246,255,0.95)_100%)] p-6 shadow-[0_28px_90px_rgba(47,77,120,0.10)] backdrop-blur-2xl">
              <ConsoleStat
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Owner Session"
                value={user.email || "Owner account"}
                detail={adminAuth?.canWriteCore ? "Write access enabled" : "Awaiting write confirmation"}
              />
              <ConsoleStat
                icon={<Activity className="h-4 w-4" />}
                label="Console Status"
                value={sending ? "Processing" : "Ready"}
                detail={sending ? "ChiChi is processing the current request." : "Console is connected and ready."}
              />
              <ConsoleStat
                icon={<Bot className="h-4 w-4" />}
                label="Thread"
                value={shortThreadId(threadId)}
                detail={adminAuth?.userId ? `Server user ${shortThreadId(adminAuth.userId)}` : "No active server thread yet."}
              />
            </section>

            {statusText ? (
              <section className="rounded-[28px] border border-[#d7e0f0] bg-white/85 px-5 py-4 text-sm font-semibold text-[#4c607b] shadow-[0_16px_46px_rgba(47,77,120,0.08)] backdrop-blur-xl">
                {statusText}
              </section>
            ) : null}
          </aside>

          <section className="overflow-hidden rounded-[36px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(243,247,255,0.96)_100%)] shadow-[0_36px_120px_rgba(47,77,120,0.14)] backdrop-blur-2xl">
            <div className="border-b border-[#d9e3f3] px-6 py-6 md:px-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="inline-flex items-center rounded-full border border-[#dce5f5] bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#7187aa]">
                    Conversation
                  </div>
                  <div className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#142236] md:text-4xl">
                    Command Console
                  </div>
                </div>

                <span
                  className={`inline-flex w-fit items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] ${
                    sending
                      ? "border-[#d8e4ff] bg-[#eef4ff] text-[#5571c8]"
                      : "border-[#d7e8de] bg-[#effaf2] text-[#3e8b5d]"
                  }`}
                >
                  {sending ? "Processing" : "Ready"}
                </span>
              </div>
            </div>

            <div className="flex min-h-[760px] flex-col">
              <div className="flex-1 overflow-y-auto px-5 py-6 md:px-8">
                {messages.length ? (
                  <div className="space-y-5">
                    {messages.map((message) => {
                      const isUser = message.role === "user";

                      return (
                        <div
                          key={message.id}
                          className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[88%] rounded-[30px] border px-5 py-4 shadow-[0_18px_48px_rgba(47,77,120,0.08)] ${
                              isUser
                                ? "border-[#2d4673] bg-[linear-gradient(135deg,#263b61_0%,#35517f_100%)] text-white"
                                : "border-[#d8e2f2] bg-[linear-gradient(180deg,#ffffff_0%,#f4f8ff_100%)] text-[#1f2d43]"
                            }`}
                          >
                            <div
                              className={`mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] ${
                                isUser ? "text-white/68" : "text-[#6d82a5]"
                              }`}
                            >
                              {isUser ? "Owner" : "ChiChi"}
                            </div>
                            <div className="whitespace-pre-wrap text-sm font-medium leading-7 md:text-[15px]">
                              {message.text}
                            </div>
                            <div
                              className={`mt-3 text-[10px] font-semibold ${
                                isUser ? "text-white/60" : "text-[#8da0bc]"
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
                ) : (
                  <div className="flex min-h-[520px] items-center justify-center">
                    <div className="max-w-[620px] rounded-[34px] border border-dashed border-[#d9e2f1] bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,rgba(244,248,255,0.96)_100%)] px-8 py-12 text-center shadow-[0_24px_80px_rgba(47,77,120,0.07)]">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] border border-[#dbe5f5] bg-white text-[#5774da] shadow-[0_14px_36px_rgba(87,116,218,0.12)]">
                        <Bot className="h-8 w-8" />
                      </div>
                      <div className="mt-6 text-2xl font-semibold tracking-[-0.04em] text-[#162334]">
                        Start with what you want changed.
                      </div>
                      <div className="mt-3 text-sm leading-7 text-[#687a92]">
                        Tell ChiChi exactly what to add, update, remove, approve, deny, or remember.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendMessage();
                }}
                className="border-t border-[#d9e3f3] bg-[linear-gradient(180deg,rgba(252,254,255,0.92)_0%,rgba(244,248,255,0.98)_100%)] px-5 py-5 md:px-8"
              >
                <div className="rounded-[30px] border border-[#d5e0f1] bg-white/90 p-3 shadow-[0_18px_50px_rgba(47,77,120,0.08)]">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={5}
                    placeholder="Tell ChiChi exactly what to change..."
                    className="min-h-[150px] w-full resize-none rounded-[22px] border border-[#e2eaf7] bg-[linear-gradient(180deg,#fbfdff_0%,#f5f9ff_100%)] px-4 py-4 text-sm text-[#142236] outline-none transition placeholder:text-[#8ca0bc] focus:border-[#a5bbeb] md:text-[15px]"
                  />

                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs font-semibold text-[#7689a7]">
                      {draft.trim() ? `${draft.trim().length} characters` : "No active draft"}
                    </div>

                    <button
                      type="submit"
                      disabled={sending || !draft.trim()}
                      className="inline-flex items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#284068_0%,#3a5a8c_100%)] px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(47,77,120,0.24)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {sending ? "Running..." : "Send to ChiChi"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function ConsoleStat({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[26px] border border-[#dae4f4] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(246,250,255,0.98)_100%)] p-4 shadow-[0_18px_46px_rgba(47,77,120,0.08)]">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7087aa]">
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d8e3f5] bg-white text-[#5977db]">
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-3 break-all text-base font-semibold text-[#172437]">{value}</div>
      <div className="mt-2 text-sm leading-6 text-[#697b93]">{detail}</div>
    </div>
  );
}

function RestrictedOwnerConsole() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#edf2fa_0%,#f8fbff_100%)] text-[#22324a]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1100px] items-center justify-center px-6 py-10">
        <div className="w-full max-w-[760px] rounded-[36px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(242,247,255,0.96)_100%)] p-8 shadow-[0_30px_120px_rgba(47,77,120,0.14)] backdrop-blur-2xl md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#f1d2d7] bg-[#fff5f7] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b8526a]">
            Owner Access Only
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-[#142236] md:text-5xl">
            This console is limited to approved owner accounts.
          </h1>
          <p className="mt-4 text-sm leading-7 text-[#657891] md:text-base">
            Sign in with one of the approved owner email addresses to access ChiChi for portal administration.
          </p>
          <div className="mt-5 rounded-[26px] border border-[#d9e3f4] bg-white/85 p-5 text-sm font-medium leading-7 text-[#4f6179]">
            Allowed emails: {getPortalAdminEmails().join(" - ")}
          </div>
          <div className="mt-6">
            <Link
              href="/portal"
              className="inline-flex items-center rounded-2xl border border-[#d7e0f0] bg-white px-5 py-3 text-sm font-semibold text-[#324763] shadow-[0_12px_30px_rgba(44,72,113,0.08)] transition hover:-translate-y-0.5 hover:border-[#adc2eb]"
            >
              Return to Buyer Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminAssistantLogin() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  async function login(event: React.FormEvent) {
    event.preventDefault();

    const { error } = await sb.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error) alert(error.message);
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#edf2fa_0%,#f8fbff_100%)] p-6 text-[#1f2e43]">
      <div className="mx-auto flex min-h-screen max-w-[1200px] items-center justify-center">
        <div className="w-full max-w-[520px] rounded-[36px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(242,247,255,0.96)_100%)] p-8 shadow-[0_34px_110px_rgba(47,77,120,0.14)] backdrop-blur-2xl md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#d9e4f5] bg-white px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6981a8]">
            <Bot className="h-3.5 w-3.5 text-[#5576dd]" />
            ChiChi
          </div>
          <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-[#142236]">
            Owner Sign In
          </h2>

          <form onSubmit={login} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7187aa]">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-[20px] border border-[#d8e2f3] bg-[linear-gradient(180deg,#fbfdff_0%,#f5f9ff_100%)] px-4 py-3 text-sm text-[#142236] outline-none transition focus:border-[#a5bbeb]"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7187aa]">
                Password
              </label>
              <input
                type="password"
                value={pass}
                onChange={(event) => setPass(event.target.value)}
                className="w-full rounded-[20px] border border-[#d8e2f3] bg-[linear-gradient(180deg,#fbfdff_0%,#f5f9ff_100%)] px-4 py-3 text-sm text-[#142236] outline-none transition focus:border-[#a5bbeb]"
                required
              />
            </div>

            <button className="inline-flex w-full items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#284068_0%,#3a5a8c_100%)] px-6 py-4 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(47,77,120,0.24)] transition hover:-translate-y-0.5 hover:brightness-105">
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
