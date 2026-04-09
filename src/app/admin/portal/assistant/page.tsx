"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BrainCircuit,
  CreditCard,
  Loader2,
  LogOut,
  MessageSquareText,
  Radar,
  RefreshCcw,
  SendHorizonal,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import {
  AdminPageShell,
  AdminRestrictedState,
  adminStatusBadge,
} from "@/components/admin/luxury-admin-shell";
import { usePortalAdminSession } from "@/lib/use-portal-admin-session";
import { fmtMoney, sb } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  kind?: "standard" | "alert";
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

type PaymentAlert = {
  id: string;
  created_at: string | null;
  event_type: string | null;
  alert_scope: string | null;
  title: string | null;
  message: string | null;
  tone: string | null;
  buyer_id: number | null;
  puppy_id: number | null;
  payment_id: string | null;
  payment_link_id: string | null;
  reference_id: string | null;
  source: string | null;
  meta?: Record<string, unknown> | null;
};

type ZohoStatus = {
  ok?: boolean;
  connected?: boolean;
  configured?: boolean;
  connection_source?: string | null;
  oauth_ready?: boolean;
  account_id?: string | null;
  has_widget_key?: boolean;
  has_signing_key?: boolean;
  has_payment_link_signing_key?: boolean;
  has_webhook_signing_key?: boolean;
  default_payment_methods?: string[] | null;
  webhook_url?: string | null;
};

type QuickLane = {
  title: string;
  detail: string;
  icon: React.ReactNode;
  prompts: string[];
};

const QUICK_LANES: QuickLane[] = [
  {
    title: "Public Intelligence",
    detail: "Exact website chat transcripts, visitor activity, and current traffic signals.",
    icon: <Radar className="h-4 w-4" />,
    prompts: ["Show exact public chat transcripts", "Show recent website activity"],
  },
  {
    title: "CRM Work Queue",
    detail: "Follow-ups, digests, leads, and the next outreach work that matters.",
    icon: <MessageSquareText className="h-4 w-4" />,
    prompts: ["Show CRM follow-ups due today", "Show today's admin digest"],
  },
  {
    title: "Buyer And Puppy Records",
    detail: "Cross-check records, financing, balances, assignments, and delivery context.",
    icon: <BrainCircuit className="h-4 w-4" />,
    prompts: [
      "Show buyer and puppy records needing attention",
      "Show active puppy financing accounts",
    ],
  },
  {
    title: "Payment Operations",
    detail: "Customer payment alerts, payment links, deposits, installments, and transport fees.",
    icon: <Wallet className="h-4 w-4" />,
    prompts: [
      "Show recent customer payment alerts",
      "Create Zoho payment link for Jane Doe for $500 deposit",
    ],
  },
];

function makeId(prefix = "msg") {
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Just now";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Just now";
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function cleanAssistantText(text: string) {
  return String(text || "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^>\s*/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderChatText(text: string) {
  const paragraphs = cleanAssistantText(text)
    .split(/\n{2,}/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const urlPattern = /(https?:\/\/[^\s]+)/gi;

  return (
    <div className="space-y-3">
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 16)}`} className="whitespace-pre-wrap leading-7">
          {paragraph.split(urlPattern).map((part, partIndex) => {
            if (/^https?:\/\//i.test(part)) {
              return (
                <a
                  key={`${index}-${partIndex}`}
                  href={part}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline underline-offset-4"
                >
                  {part}
                </a>
              );
            }

            return <React.Fragment key={`${index}-${partIndex}`}>{part}</React.Fragment>;
          })}
        </p>
      ))}
    </div>
  );
}

function summarizeAlert(alert: PaymentAlert) {
  const amount =
    typeof alert.meta?.amount === "number"
      ? fmtMoney(alert.meta.amount)
      : typeof alert.meta?.amount === "string" && alert.meta.amount.trim()
        ? fmtMoney(alert.meta.amount)
        : null;
  const chargeType =
    typeof alert.meta?.charge_type === "string" ? alert.meta.charge_type.trim() : "";
  const buyerName = typeof alert.meta?.buyer_name === "string" ? alert.meta.buyer_name.trim() : "";

  return [
    alert.title || "Payment alert",
    amount ? `Amount: ${amount}.` : null,
    chargeType ? `Charge: ${chargeType}.` : null,
    buyerName ? `Buyer: ${buyerName}.` : null,
    alert.message || null,
  ]
    .filter(Boolean)
    .join(" ");
}

function normalizeTone(tone: string | null | undefined) {
  const value = String(tone || "").trim().toLowerCase();
  return value || "active";
}

function buildFeedSummary(status: ZohoStatus | null, alerts: PaymentAlert[]) {
  const isConnected = Boolean(
    status?.connected && status?.configured && status?.has_webhook_signing_key
  );

  if (alerts.length) {
    return {
      label: "Live",
      tone: "active",
      description:
        "Zoho is connected and ChiChi is already surfacing live customer payment activity.",
    };
  }

  if (isConnected) {
    return {
      label: "Listening",
      tone: "completed",
      description:
        "Zoho Payments is connected. ChiChi is listening for the next live customer payment, link update, or payment failure event.",
    };
  }

  return {
    label: "Needs review",
    tone: "warning",
    description:
      "ChiChi can watch live payment activity here, but Zoho connection or webhook verification still needs attention in Settings.",
  };
}

const DEFAULT_MESSAGES: ChatMessage[] = [
  {
    id: makeId("assistant"),
    role: "assistant",
    content:
      "I am connected to the breeding operation and ready to pull exact chats, CRM queues, buyer records, portal activity, and Zoho payment actions from one place.",
    createdAt: formatTime(),
  },
];

export default function AdminAssistantPage() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const [messages, setMessages] = useState<ChatMessage[]>(DEFAULT_MESSAGES);
  const [draft, setDraft] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [statusText, setStatusText] = useState("ChiChi is online and ready for owner commands.");
  const [paymentAlerts, setPaymentAlerts] = useState<PaymentAlert[]>([]);
  const [zohoStatus, setZohoStatus] = useState<ZohoStatus | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [lastIntelRefresh, setLastIntelRefresh] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const seenAlertIdsRef = useRef<Set<string>>(new Set());
  const bootstrappedAlertsRef = useRef(false);

  const flattenedPrompts = useMemo(() => QUICK_LANES.flatMap((lane) => lane.prompts), []);

  useEffect(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [messages, isSending]);

  useEffect(() => {
    let active = true;

    async function loadIntel() {
      if (!accessToken || !isAdmin) {
        if (!active) return;
        setPaymentAlerts([]);
        setZohoStatus(null);
        setLastIntelRefresh(null);
        return;
      }

      setIntelLoading(true);
      try {
        const headers = {
          Authorization: `Bearer ${accessToken}`,
        };

        const [alertsResponse, zohoResponse] = await Promise.all([
          fetch("/api/admin/portal/payment-alerts?limit=8", {
            headers,
            cache: "no-store",
          }),
          fetch("/api/admin/portal/zoho-payments", {
            headers,
            cache: "no-store",
          }),
        ]);

        const alertsJson = (await alertsResponse.json()) as {
          ok?: boolean;
          alerts?: PaymentAlert[];
        };
        const zohoJson = (await zohoResponse.json()) as ZohoStatus;

        if (!active) return;

        const nextAlerts = Array.isArray(alertsJson.alerts) ? alertsJson.alerts : [];
        setPaymentAlerts(nextAlerts);
        setZohoStatus(zohoJson);
        setLastIntelRefresh(new Date().toISOString());

        if (!bootstrappedAlertsRef.current) {
          seenAlertIdsRef.current = new Set(nextAlerts.map((alert) => alert.id));
          bootstrappedAlertsRef.current = true;
          return;
        }

        const freshAlerts = nextAlerts.filter((alert) => !seenAlertIdsRef.current.has(alert.id));
        if (!freshAlerts.length) return;

        for (const alert of freshAlerts) {
          seenAlertIdsRef.current.add(alert.id);
        }

        setMessages((current) => [
          ...current,
          ...freshAlerts
            .slice()
            .reverse()
            .map((alert) => ({
              id: `alert-${alert.id}`,
              role: "assistant" as const,
              kind: "alert" as const,
              content: `Live payment alert: ${summarizeAlert(alert)}`,
              createdAt: formatTime(alert.created_at ? new Date(alert.created_at) : new Date()),
            })),
        ]);
      } catch (error) {
        if (!active) return;
        setStatusText(
          error instanceof Error
            ? `ChiChi intel refresh issue: ${error.message}`
            : "ChiChi could not refresh the live intel feed."
        );
      } finally {
        if (active) setIntelLoading(false);
      }
    }

    void loadIntel();
    const interval = window.setInterval(() => {
      void loadIntel();
    }, 15000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [accessToken, isAdmin]);

  async function sendMessage(overrideText?: string) {
    const nextText = String(overrideText ?? draft).trim();
    if (!nextText || !accessToken || isSending) return;

    const userMessage: ChatMessage = {
      id: makeId("user"),
      role: "user",
      content: nextText,
      createdAt: formatTime(),
    };

    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setIsSending(true);
    setStatusText("ChiChi is reading the live operation...");

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
          messages: [...messages, userMessage].map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      const payload = (await response.json()) as ChiChiResponse;
      const replyText =
        payload.text?.trim() ||
        "ChiChi ran into a connection issue while reading the records. Please try again.";

      if (payload.threadId) setThreadId(payload.threadId);

      setMessages((current) => [
        ...current,
        {
          id: makeId("assistant"),
          role: "assistant",
          content: replyText,
          createdAt: formatTime(),
        },
      ]);
      setStatusText("ChiChi is online and ready for the next command.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error while contacting ChiChi.";
      setMessages((current) => [
        ...current,
        {
          id: makeId("assistant"),
          role: "assistant",
          content: `ChiChi server error: ${message}`,
          createdAt: formatTime(),
        },
      ]);
      setStatusText("ChiChi hit a connection issue.");
    } finally {
      setIsSending(false);
    }
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  function handleNewSession() {
    setMessages(DEFAULT_MESSAGES.map((message) => ({ ...message, id: makeId("assistant") })));
    setDraft("");
    setThreadId(null);
    setStatusText("Started a fresh ChiChi session.");
  }

  async function handleSignOut() {
    await sb.auth.signOut();
    setThreadId(null);
    setMessages(DEFAULT_MESSAGES.map((message) => ({ ...message, id: makeId("assistant") })));
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">
        Loading ChiChi admin...
      </div>
    );
  }

  if (!user) {
    return (
      <AdminRestrictedState
        title="Sign in to access ChiChi Admin."
        details="This command center is reserved for the Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!isAdmin) {
    return (
      <AdminRestrictedState
        title="This command center is limited to approved owner accounts."
        details="Only the approved owner emails can run the ChiChi operations console."
      />
    );
  }

  const paymentFeed = buildFeedSummary(zohoStatus, paymentAlerts);
  const isZohoConnected = Boolean(
    zohoStatus?.connected && zohoStatus?.configured && zohoStatus?.has_webhook_signing_key
  );
  const paymentMethods = Array.isArray(zohoStatus?.default_payment_methods)
    ? zohoStatus.default_payment_methods
    : [];

  return (
    <AdminPageShell>
      <div className="space-y-5 pb-10">
        <section className="premium-card relative overflow-hidden rounded-[1.8rem] p-5 md:p-6 xl:p-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(178,132,78,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(117,134,203,0.14),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(250,244,236,0.94))]" />
          <div className="pointer-events-none absolute -left-12 top-16 h-44 w-44 rounded-full bg-[rgba(191,154,111,0.12)] blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full bg-[rgba(121,136,204,0.12)] blur-3xl" />

          <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(200,168,132,0.45)] bg-[rgba(255,248,240,0.92)] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8c6848] shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                ChiChi Command Nexus
              </span>

              <div className="mt-5 max-w-4xl">
                <h1 className="text-[1.95rem] font-semibold leading-[1.02] tracking-[-0.05em] text-[var(--portal-text)] [font-family:var(--font-merriweather)] md:text-[2.7rem]">
                  Run the breeding hub through one operational brain.
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--portal-text-soft)] md:text-[15px]">
                  ChiChi is your live command layer for public chat transcripts, CRM work,
                  buyer records, document status, and Zoho payment operations. This page is
                  built to think, pull, and act, not just stack repetitive cards.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2.5">
                <StatusPill
                  label="Console"
                  value="Live"
                  tone="active"
                  icon={<BrainCircuit className="h-3.5 w-3.5" />}
                />
                <StatusPill
                  label="Zoho"
                  value={isZohoConnected ? "Connected" : "Needs review"}
                  tone={isZohoConnected ? "completed" : "warning"}
                  icon={<CreditCard className="h-3.5 w-3.5" />}
                />
                <StatusPill
                  label="Payment feed"
                  value={paymentFeed.label}
                  tone={paymentFeed.tone}
                  icon={<Activity className="h-3.5 w-3.5" />}
                />
                <StatusPill
                  label="Thread"
                  value={threadId ? "Open" : "Fresh"}
                  tone={threadId ? "completed" : "pending"}
                  icon={<ShieldCheck className="h-3.5 w-3.5" />}
                />
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {QUICK_LANES.map((lane) => (
                  <div
                    key={lane.title}
                    className="rounded-[1.35rem] border border-[rgba(214,196,173,0.82)] bg-white/72 px-4 py-4 shadow-[0_14px_34px_rgba(128,98,71,0.08)] backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#8c6848]">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(191,154,111,0.15)] text-[#855f3d]">
                        {lane.icon}
                      </span>
                      {lane.title}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--portal-text-soft)]">
                      {lane.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.55rem] border border-[rgba(214,196,173,0.82)] bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(249,243,236,0.94))] p-5 shadow-[0_20px_42px_rgba(128,98,71,0.09)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                    Live Payment Feed
                  </div>
                  <div className="mt-2 text-[1.15rem] font-semibold text-[var(--portal-text)]">
                    {paymentFeed.label === "Live"
                      ? `${paymentAlerts.length} recent customer payment alert${paymentAlerts.length === 1 ? "" : "s"}`
                      : paymentFeed.label}
                  </div>
                </div>
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(paymentFeed.tone)}`}
                >
                  {paymentFeed.label}
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-[var(--portal-text-soft)]">
                {paymentFeed.description}
              </p>

              <div className="mt-5 rounded-[1.2rem] border border-[var(--portal-border)] bg-white/85 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                    Runtime
                  </div>
                  {lastIntelRefresh ? (
                    <div className="text-[11px] text-[var(--portal-text-muted)]">
                      Refreshed {formatDateTime(lastIntelRefresh)}
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <MiniIntel label="Owner session" value={user.email || "Owner"} />
                  <MiniIntel
                    label="Payment methods"
                    value={paymentMethods.length ? paymentMethods.join(", ") : "Not set"}
                  />
                  <MiniIntel
                    label="Webhook"
                    value={zohoStatus?.has_webhook_signing_key ? "Verified key in place" : "Needs webhook key"}
                  />
                  <MiniIntel label="Account" value={zohoStatus?.account_id || "Unknown"} />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleNewSession}
                  className="inline-flex items-center gap-2 rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[0_10px_24px_rgba(106,76,45,0.08)] transition hover:-translate-y-0.5"
                >
                  <RefreshCcw className="h-4 w-4" />
                  New session
                </button>
                <Link
                  href="/admin/portal/settings"
                  className="inline-flex items-center gap-2 rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)] hover:bg-white"
                >
                  Zoho settings
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="inline-flex items-center gap-2 rounded-[1rem] border border-[rgba(180,127,82,0.26)] bg-[rgba(180,127,82,0.1)] px-4 py-3 text-sm font-semibold text-[#7a5430] transition hover:bg-[rgba(180,127,82,0.16)]"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_380px]">
          <div className="premium-card overflow-hidden rounded-[1.7rem]">
            <div className="border-b border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,242,234,0.9))] px-5 py-5 md:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                    Command Console
                  </div>
                  <h2 className="mt-2 text-[1.45rem] font-semibold tracking-[-0.04em] text-[var(--portal-text)] [font-family:var(--font-merriweather)]">
                    Ask ChiChi directly and keep the thread in one place.
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--portal-text-soft)]">
                    Enter sends. Shift+Enter adds a new line. ChiChi can pull exact records,
                    explain what she finds, and generate live Zoho payment links from this console.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1.5 text-[11px] font-semibold ${adminStatusBadge("active")}`}
                  >
                    {statusText}
                  </span>
                  {intelLoading ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--portal-border)] bg-white px-3 py-1.5 text-[11px] text-[var(--portal-text-muted)]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Refreshing feed
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="bg-[linear-gradient(180deg,rgba(253,250,246,0.92),rgba(255,255,255,0.96))] px-5 py-5 md:px-6">
              <div className="max-h-[620px] min-h-[520px] space-y-4 overflow-y-auto pr-1">
                {messages.map((message) => {
                  const isUser = message.role === "user";

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      <div className={isUser ? "max-w-[78%]" : "max-w-[86%]"}>
                        {!isUser ? (
                          <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,#b67d47_0%,#7b90dd_100%)] text-white shadow-[0_10px_20px_rgba(123,144,221,0.18)]">
                              {message.kind === "alert" ? (
                                <CreditCard className="h-3.5 w-3.5" />
                              ) : (
                                <Sparkles className="h-3.5 w-3.5" />
                              )}
                            </span>
                            ChiChi
                          </div>
                        ) : (
                          <div className="mb-2 px-1 text-right text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                            Owner
                          </div>
                        )}

                        <div
                          className={[
                            "rounded-[1.4rem] px-4 py-4 shadow-[0_14px_30px_rgba(128,98,71,0.08)]",
                            isUser
                              ? "rounded-tr-md bg-[linear-gradient(135deg,#b57a45_0%,#8f5d31_100%)] text-white"
                              : message.kind === "alert"
                                ? "rounded-tl-md border border-[rgba(212,188,150,0.74)] bg-[linear-gradient(180deg,#fffaf3_0%,#f9efe1_100%)] text-[var(--portal-text)]"
                                : "rounded-tl-md border border-[var(--portal-border)] bg-white text-[var(--portal-text)]",
                          ].join(" ")}
                        >
                          {renderChatText(message.content)}
                        </div>
                        <div
                          className={`mt-2 px-1 text-[11px] ${
                            isUser
                              ? "text-right text-[rgba(83,62,46,0.72)]"
                              : "text-[var(--portal-text-muted)]"
                          }`}
                        >
                          {message.createdAt}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {isSending ? (
                  <div className="flex justify-start">
                    <div className="max-w-[86%]">
                      <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,#b67d47_0%,#7b90dd_100%)] text-white shadow-[0_10px_20px_rgba(123,144,221,0.18)]">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        </span>
                        ChiChi
                      </div>
                      <div className="rounded-[1.4rem] rounded-tl-md border border-[var(--portal-border)] bg-white px-4 py-4 text-sm leading-7 text-[var(--portal-text-soft)] shadow-[0_14px_30px_rgba(128,98,71,0.08)]">
                        Reading the live operation...
                      </div>
                    </div>
                  </div>
                ) : null}

                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="border-t border-[var(--portal-border)] bg-white px-5 py-5 md:px-6">
              <div className="rounded-[1.55rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-3 shadow-[inset_0_1px_2px_rgba(96,110,148,0.04)]">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  rows={4}
                  placeholder="Ask ChiChi for exact chats, payment links, buyer records, financing details, delivery costs, CRM follow-ups, or admin updates..."
                  className="min-h-[132px] w-full resize-none border-0 bg-transparent px-2 py-2 text-sm leading-7 text-[var(--portal-text)] outline-none placeholder:text-[var(--portal-text-muted)]"
                  disabled={isSending}
                />
              </div>

              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-xs leading-6 text-[var(--portal-text-muted)]">
                  ChiChi answers from the live records tied to this breeding hub. Press Enter to
                  send. Use Shift+Enter for a new line.
                </div>

                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={!draft.trim() || isSending}
                  className="inline-flex items-center justify-center gap-2 rounded-[1rem] bg-[linear-gradient(90deg,#b67b46_0%,#d3b08a_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(182,123,70,0.24)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <SendHorizonal className="h-4 w-4" />
                  )}
                  Send to ChiChi
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <section className="premium-card rounded-[1.55rem] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                    Live Payment Alerts
                  </div>
                  <h3 className="mt-2 text-[1.2rem] font-semibold text-[var(--portal-text)] [font-family:var(--font-merriweather)]">
                    ChiChi keeps the payment feed hot.
                  </h3>
                </div>
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(paymentFeed.tone)}`}
                >
                  {paymentFeed.label}
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-[var(--portal-text-soft)]">
                {paymentFeed.description}
              </p>

              <div className="mt-4 space-y-3">
                {paymentAlerts.length ? (
                  paymentAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="rounded-[1.2rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[var(--portal-text)]">
                            {alert.title || "Customer payment event"}
                          </div>
                          <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                            {formatDateTime(alert.created_at)}
                          </div>
                        </div>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(normalizeTone(alert.tone))}`}
                        >
                          {normalizeTone(alert.tone)}
                        </span>
                      </div>

                      <div className="mt-3 text-sm leading-6 text-[var(--portal-text-soft)]">
                        {alert.message || "ChiChi received a live payment update from Zoho."}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--portal-text-muted)]">
                        {alert.reference_id ? (
                          <span className="rounded-full border border-[var(--portal-border)] bg-white px-3 py-1.5">
                            Ref {alert.reference_id}
                          </span>
                        ) : null}
                        {typeof alert.meta?.amount === "number" ||
                        (typeof alert.meta?.amount === "string" && alert.meta.amount.trim()) ? (
                          <span className="rounded-full border border-[var(--portal-border)] bg-white px-3 py-1.5">
                            {fmtMoney(alert.meta?.amount)}
                          </span>
                        ) : null}
                        {typeof alert.meta?.charge_type === "string" && alert.meta.charge_type.trim() ? (
                          <span className="rounded-full border border-[var(--portal-border)] bg-white px-3 py-1.5">
                            {alert.meta.charge_type}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.25rem] border border-dashed border-[var(--portal-border-strong)] bg-[var(--portal-surface-muted)] px-4 py-8 text-center">
                    <div className="text-sm font-semibold text-[var(--portal-text)]">
                      {isZohoConnected
                        ? "Zoho is connected and ChiChi is listening."
                        : "Payment feed setup still needs attention."}
                    </div>
                    <div className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--portal-text-soft)]">
                      {isZohoConnected
                        ? "The feed will populate the moment a customer payment, payment-link update, or failure event reaches the webhook."
                        : "Reconnect Zoho or confirm the webhook signing key in Settings so ChiChi can surface live payment activity here."}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="premium-card rounded-[1.55rem] p-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                Command Lanes
              </div>
              <h3 className="mt-2 text-[1.2rem] font-semibold text-[var(--portal-text)] [font-family:var(--font-merriweather)]">
                Launch a live pull without typing the full command.
              </h3>

              <div className="mt-4 space-y-4">
                {QUICK_LANES.map((lane) => (
                  <div
                    key={lane.title}
                    className="rounded-[1.2rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-4"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--portal-text)]">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#8c6848]">
                        {lane.icon}
                      </span>
                      {lane.title}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                      {lane.detail}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {lane.prompts.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => void sendMessage(prompt)}
                          disabled={isSending}
                          className="rounded-full border border-[var(--portal-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)] hover:bg-[#fffaf4] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="premium-card rounded-[1.55rem] p-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                Operational Reach
              </div>
              <h3 className="mt-2 text-[1.2rem] font-semibold text-[var(--portal-text)] [font-family:var(--font-merriweather)]">
                What ChiChi can touch right now
              </h3>

              <div className="mt-4 grid gap-3">
                {flattenedPrompts.slice(0, 4).map((prompt, index) => (
                  <div
                    key={`${prompt}-${index}`}
                    className="flex items-start gap-3 rounded-[1.15rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4"
                  >
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#8c6848]">
                      {index === 0 ? (
                        <Radar className="h-4 w-4" />
                      ) : index === 1 ? (
                        <MessageSquareText className="h-4 w-4" />
                      ) : index === 2 ? (
                        <Wallet className="h-4 w-4" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--portal-text)]">{prompt}</div>
                      <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">
                        {index === 0
                          ? "Exact public-facing conversation and traffic pull."
                          : index === 1
                            ? "Work queue status for the day and the next outreach load."
                            : index === 2
                              ? "Live payment and payment-link operations through Zoho."
                              : "Cross-record buyer, puppy, and financing intelligence."}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}

function StatusPill({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(214,196,173,0.82)] bg-white/82 px-3.5 py-2 shadow-sm">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--portal-surface-muted)] text-[#8c6848]">
        {icon}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
        {label}
      </span>
      <span
        className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${adminStatusBadge(tone)}`}
      >
        {value}
      </span>
    </div>
  );
}

function MiniIntel({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-3 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold leading-6 text-[var(--portal-text)]">{value}</div>
    </div>
  );
}
