"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Activity, Bot, RefreshCcw, ShieldCheck, Sparkles } from "lucide-react";
import {
  AdminPageShell,
  AdminPanel,
  AdminRestrictedState,
} from "@/components/admin/luxury-admin-shell";
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
  error?: string;
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

const starterPrompts = [
  "Show today's admin digest",
  "Show exact public chat transcripts",
  "Show recent public chat threads about payment plans",
  "Show CRM follow-ups due today",
  "Create Zoho payment link for Jane Doe for $500 deposit",
];

const capabilityHighlights = [
  "Exact public chat transcripts",
  "Website activity",
  "CRM follow-ups",
  "Buyer and puppy records",
  "Zoho customers and payments",
];

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
  const hasOwnerWrite = isPortalAdminEmail(user?.email) || !!adminAuth?.canWriteCore;

  async function sendMessage(overrideText?: string) {
    const text = (overrideText ?? draft).trim();
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
      if (!response.ok) {
        throw new Error(
          String(data?.error || data?.text || "ChiChi could not complete that request.")
        );
      }

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
          text:
            error instanceof Error && error.message
              ? error.message
              : "I hit a connection problem while trying to complete that request.",
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
      <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">
        Loading ChiChi...
      </div>
    );
  }

  if (!user) {
    return <AdminAssistantLogin />;
  }

  if (!isPortalAdminEmail(user.email)) {
    return (
      <AdminRestrictedState
        title="This ChiChi console is limited to approved owner accounts."
        details={`Sign in with one of the approved owner emails to access ChiChi for portal administration: ${getPortalAdminEmails().join(", ")}.`}
      />
    );
  }

  return (
    <AdminPageShell>
      <div className="space-y-5 pb-10">
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-5">
            <AdminPanel
              title="ChiChi Control"
              subtitle="Owner-side command access for live website activity, CRM work, and Zoho payment operations."
            >
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/admin/portal"
                  className="inline-flex items-center rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]"
                >
                  Admin Overview
                </Link>
                <button
                  type="button"
                  onClick={handleResetSession}
                  className="inline-flex items-center gap-2 rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]"
                >
                  <RefreshCcw className="h-4 w-4" />
                  New Session
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#b78252_0%,#8c603a_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(140,96,58,0.22)] transition hover:brightness-105"
                >
                  Sign Out
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {capabilityHighlights.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-[rgba(200,168,132,0.45)] bg-[rgba(248,242,234,0.92)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8c6848]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </AdminPanel>

            <div className="grid gap-4">
              <ConsoleStatCard
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Owner Session"
                value={user.email || "Owner account"}
                detail={hasOwnerWrite ? "Owner access confirmed." : "Awaiting server confirmation."}
              />
              <ConsoleStatCard
                icon={<Activity className="h-4 w-4" />}
                label="Console Status"
                value={sending ? "Processing" : "Ready"}
                detail={
                  sending
                    ? "ChiChi is working through the active request."
                    : "Console is connected and ready for live admin work."
                }
              />
              <ConsoleStatCard
                icon={<Bot className="h-4 w-4" />}
                label="Thread"
                value={shortThreadId(threadId)}
                detail={
                  adminAuth?.userId
                    ? `Server user ${shortThreadId(adminAuth.userId)}`
                    : "No active server thread yet."
                }
              />
            </div>

            {statusText ? (
              <div className="rounded-[1.35rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--portal-text-soft)]">
                {statusText}
              </div>
            ) : null}

            <AdminPanel
              title="Starter Tasks"
              subtitle="Quick asks to pull live ops context without typing the whole prompt."
            >
              <div className="flex flex-wrap gap-3">
                {starterPrompts.map((prompt) => (
                  <QuickPromptButton
                    key={prompt}
                    prompt={prompt}
                    onClick={() => void sendMessage(prompt)}
                  />
                ))}
              </div>
            </AdminPanel>
          </div>

          <AdminPanel
            title="Command Console"
            subtitle="Ask ChiChi for exact public chat transcripts, website activity, CRM follow-ups, buyer records, or Zoho payment links."
          >
            <div className="flex min-h-[720px] flex-col">
              <div className="flex-1 overflow-y-auto">
                {messages.length ? (
                  <div className="space-y-4">
                    {messages.map((message) => {
                      const isUser = message.role === "user";

                      return (
                        <div
                          key={message.id}
                          className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={[
                              "max-w-[92%] rounded-[1.7rem] border px-5 py-4 shadow-[var(--portal-shadow-sm)]",
                              isUser
                                ? "border-[#b98e67] bg-[linear-gradient(135deg,#8f623d_0%,#b78454_100%)] text-white"
                                : "border-[var(--portal-border)] bg-[linear-gradient(180deg,#fffdf9_0%,#f6efe4_100%)] text-[var(--portal-text)]",
                            ].join(" ")}
                          >
                            <div
                              className={[
                                "mb-2 text-[10px] font-semibold uppercase tracking-[0.22em]",
                                isUser ? "text-white/72" : "text-[#8c6848]",
                              ].join(" ")}
                            >
                              {isUser ? "Owner" : "ChiChi"}
                            </div>
                            <div className="whitespace-pre-wrap text-sm font-medium leading-7 md:text-[15px]">
                              {message.text}
                            </div>
                            <div
                              className={[
                                "mt-3 text-[10px] font-semibold",
                                isUser ? "text-white/62" : "text-[var(--portal-text-muted)]",
                              ].join(" ")}
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
                    <div className="w-full max-w-[720px] rounded-[1.8rem] border border-dashed border-[var(--portal-border-strong)] bg-[linear-gradient(180deg,#fffdf9_0%,#f6efe4_100%)] px-7 py-10 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-[rgba(200,168,132,0.45)] bg-white text-[#a46f42] shadow-[var(--portal-shadow-sm)]">
                        <Sparkles className="h-8 w-8" />
                      </div>
                      <div className="mt-6 text-2xl font-semibold tracking-[-0.04em] text-[var(--portal-text)] [font-family:var(--font-merriweather)]">
                        Start with what you want pulled or changed.
                      </div>
                      <div className="mt-3 text-sm leading-7 text-[var(--portal-text-soft)]">
                        ChiChi can show the exact public chats, website activity, CRM follow-ups, buyer records, and Zoho payment operations from one place.
                      </div>
                      <div className="mt-6 flex flex-wrap justify-center gap-3">
                        {starterPrompts.map((prompt) => (
                          <QuickPromptButton
                            key={prompt}
                            prompt={prompt}
                            onClick={() => void sendMessage(prompt)}
                          />
                        ))}
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
                className="mt-5 border-t border-[var(--portal-border)] pt-5"
              >
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={5}
                  placeholder="Ask for exact public chat transcripts, CRM follow-ups, records, website activity, or Zoho payment links..."
                  className="min-h-[150px] w-full resize-none rounded-[1.45rem] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-4 text-sm text-[var(--portal-text)] outline-none transition placeholder:text-[var(--portal-text-muted)] focus:border-[#c8a884] md:text-[15px]"
                />

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs font-semibold text-[var(--portal-text-muted)]">
                    {draft.trim() ? `${draft.trim().length} characters` : "No active draft"}
                  </div>

                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    className="inline-flex items-center justify-center rounded-[1.2rem] bg-[linear-gradient(135deg,#b78252_0%,#8c603a_100%)] px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(140,96,58,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sending ? "Running..." : "Send to ChiChi"}
                  </button>
                </div>
              </form>
            </div>
          </AdminPanel>
        </section>
      </div>
    </AdminPageShell>
  );
}

function QuickPromptButton({
  prompt,
  onClick,
}: {
  prompt: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-full border border-[var(--portal-border)] bg-white px-4 py-2 text-xs font-semibold text-[var(--portal-text-soft)] shadow-[var(--portal-shadow-sm)] transition hover:border-[#c8a884] hover:bg-[var(--portal-surface-muted)] hover:text-[var(--portal-text)]"
    >
      {prompt}
    </button>
  );
}

function ConsoleStatCard({
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
    <div className="premium-card rounded-[1.45rem] p-4">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--portal-text-muted)]">
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] text-[#a46f42]">
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-3 break-all text-base font-semibold text-[var(--portal-text)]">{value}</div>
      <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
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
    <div className="min-h-screen bg-[var(--portal-bg)] p-6 text-[var(--portal-text)]">
      <div className="mx-auto flex min-h-screen max-w-[1200px] items-center justify-center">
        <div className="premium-card w-full max-w-[540px] rounded-[2rem] p-8 md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(200,168,132,0.45)] bg-[rgba(248,242,234,0.92)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8c6848]">
            <Bot className="h-3.5 w-3.5 text-[#a46f42]" />
            ChiChi
          </div>
          <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-[var(--portal-text)] [font-family:var(--font-merriweather)]">
            Owner Sign In
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--portal-text-soft)]">
            Sign in with an approved owner email to access live admin actions, public chat transcripts, CRM follow-ups, and Zoho payment tools.
          </p>

          <form onSubmit={login} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--portal-text-muted)]">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-[1.2rem] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3 text-sm text-[var(--portal-text)] outline-none transition focus:border-[#c8a884]"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--portal-text-muted)]">
                Password
              </label>
              <input
                type="password"
                value={pass}
                onChange={(event) => setPass(event.target.value)}
                className="w-full rounded-[1.2rem] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3 text-sm text-[var(--portal-text)] outline-none transition focus:border-[#c8a884]"
                required
              />
            </div>

            <button className="inline-flex w-full items-center justify-center rounded-[1.2rem] bg-[linear-gradient(135deg,#b78252_0%,#8c603a_100%)] px-6 py-4 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(140,96,58,0.22)] transition hover:brightness-105">
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
