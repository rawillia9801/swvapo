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
};

type PaymentAlert = {
  id: string;
  created_at: string | null;
  title: string | null;
  message: string | null;
  tone: string | null;
  reference_id: string | null;
  meta?: Record<string, unknown> | null;
};

type ZohoStatus = {
  connected?: boolean;
  configured?: boolean;
  account_id?: string | null;
  has_webhook_signing_key?: boolean;
  default_payment_methods?: string[] | null;
};

type OverviewSnapshot = {
  buyers?: number;
  paymentPlans?: number;
  unreadBuyerMessages?: number;
  visitors24h?: number;
  publicThreads24h?: number;
  publicMessages24h?: number;
  openFollowUps?: number;
  assistantMessages24h?: number;
  memoryUpdates24h?: number;
  latestDigest?: {
    digest_date?: string | null;
    summary?: string | null;
  } | null;
};

type QuickLane = {
  title: string;
  detail: string;
  icon: React.ReactNode;
};

const QUICK_LANES: QuickLane[] = [
  {
    title: "Breeding Ops",
    detail: "Puppies, litters, breeding dogs, buyer linkage, care gaps, and readiness blockers.",
    icon: <BrainCircuit className="h-4 w-4" />,
  },
  {
    title: "Buyer Follow-Through",
    detail: "Documents, overdue balances, portal gaps, transport questions, and outreach drafts.",
    icon: <MessageSquareText className="h-4 w-4" />,
  },
  {
    title: "Public Intelligence",
    detail: "Website conversations, visitor patterns, and live public-facing activity when needed.",
    icon: <Radar className="h-4 w-4" />,
  },
  {
    title: "Payment Ops",
    detail: "Live customer payments, Zoho links, deposits, installments, and transport fees.",
    icon: <Wallet className="h-4 w-4" />,
  },
];

const COMMAND_DOCK_PROMPTS = [
  "Which puppies need weights updated this week?",
  "Show puppies missing vaccine records",
  "Which buyers still need documents signed?",
  "Which puppies are ready for website but not portal?",
  "Draft a payment reminder for overdue accounts",
  "Summarize all puppies needing attention today",
  "Create Zoho payment link for Jane Doe for $500 deposit",
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
        <p key={`${index}-${paragraph.slice(0, 12)}`} className="whitespace-pre-wrap leading-7">
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
  return String(tone || "").trim().toLowerCase() || "active";
}

function buildFeedSummary(status: ZohoStatus | null, alerts: PaymentAlert[]) {
  const connected = Boolean(
    status?.connected && status?.configured && status?.has_webhook_signing_key
  );

  if (alerts.length) {
    return {
      label: "Live",
      tone: "active",
      description:
        "Zoho is connected and ChiChi is already surfacing real customer payment activity.",
    };
  }

  if (connected) {
    return {
      label: "Listening",
      tone: "completed",
      description:
        "Zoho Payments is connected. ChiChi is waiting for the next real payment, failure, or payment-link event.",
    };
  }

  return {
    label: "Needs review",
    tone: "warning",
    description:
      "ChiChi can watch live payment activity here, but the Zoho connection or webhook verification still needs attention.",
  };
}

const DEFAULT_MESSAGES: ChatMessage[] = [
  {
    id: makeId("assistant"),
    role: "assistant",
    content:
      "I am online. Ask me for breeding-program totals, portal users, financing accounts, payment activity, CRM work, exact public chats, or a Zoho payment link.",
    createdAt: formatTime(),
  },
];

export default function AdminAssistantPage() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const [messages, setMessages] = useState<ChatMessage[]>(DEFAULT_MESSAGES);
  const [draft, setDraft] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [statusText, setStatusText] = useState("ChiChi is online and ready for the next command.");
  const [paymentAlerts, setPaymentAlerts] = useState<PaymentAlert[]>([]);
  const [zohoStatus, setZohoStatus] = useState<ZohoStatus | null>(null);
  const [overview, setOverview] = useState<OverviewSnapshot | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [lastIntelRefresh, setLastIntelRefresh] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const seenAlertIdsRef = useRef<Set<string>>(new Set());
  const bootstrappedAlertsRef = useRef(false);
  const intelAbortRef = useRef<AbortController | null>(null);
  const intelRequestIdRef = useRef(0);
  const commandDockPrompts = useMemo(() => COMMAND_DOCK_PROMPTS, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [messages, isSending]);

  useEffect(() => {
    let active = true;
    let timer: number | null = null;

    const clearPendingRequest = () => {
      if (intelAbortRef.current) {
        intelAbortRef.current.abort();
        intelAbortRef.current = null;
      }
    };

    const scheduleNextRefresh = (delay = 15000) => {
      if (!active || typeof window === "undefined") return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void loadIntel(true);
      }, delay);
    };

    async function loadIntel(background = false) {
      if (!accessToken || !isAdmin) {
        if (!active) return;
        clearPendingRequest();
        setPaymentAlerts([]);
        setZohoStatus(null);
        setOverview(null);
        setLastIntelRefresh(null);
        setIntelLoading(false);
        return;
      }

      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        scheduleNextRefresh();
        return;
      }

      const requestId = intelRequestIdRef.current + 1;
      intelRequestIdRef.current = requestId;
      clearPendingRequest();
      const controller = new AbortController();
      intelAbortRef.current = controller;

      if (!background) setIntelLoading(true);
      try {
        const headers = { Authorization: `Bearer ${accessToken}` };

        const [alertsResponse, zohoResponse, overviewResponse] = await Promise.all([
          fetch("/api/admin/portal/payment-alerts?limit=8", {
            headers,
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch("/api/admin/portal/zoho-payments", {
            headers,
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch("/api/admin/portal/overview", {
            headers,
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);

        const alertsJson = (await alertsResponse.json()) as {
          alerts?: PaymentAlert[];
        };
        const zohoJson = (await zohoResponse.json()) as ZohoStatus;
        const overviewJson = (await overviewResponse.json()) as {
          overview?: OverviewSnapshot;
        };

        if (!active || intelRequestIdRef.current !== requestId) return;

        const nextAlerts = Array.isArray(alertsJson.alerts) ? alertsJson.alerts : [];
        setPaymentAlerts(nextAlerts);
        setZohoStatus(zohoJson);
        setOverview(overviewJson.overview || null);
        setLastIntelRefresh(new Date().toISOString());

        if (!bootstrappedAlertsRef.current) {
          seenAlertIdsRef.current = new Set(nextAlerts.map((alert) => alert.id));
          bootstrappedAlertsRef.current = true;
          return;
        }

        const freshAlerts = nextAlerts.filter((alert) => !seenAlertIdsRef.current.has(alert.id));
        if (!freshAlerts.length) return;

        freshAlerts.forEach((alert) => seenAlertIdsRef.current.add(alert.id));

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
        if (
          error instanceof Error &&
          (error.name === "AbortError" || error.message.toLowerCase().includes("aborted"))
        ) {
          return;
        }
        if (!active) return;
        setStatusText(
          error instanceof Error
            ? `ChiChi intel refresh issue: ${error.message}`
            : "ChiChi could not refresh the live intel feed."
        );
      } finally {
        if (intelAbortRef.current === controller) {
          intelAbortRef.current = null;
        }
        if (active) {
          setIntelLoading(false);
          scheduleNextRefresh();
        }
      }
    }

    const handleVisibilityChange = () => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") return;
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
      void loadIntel(true);
    };

    void loadIntel(false);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      active = false;
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      if (timer) window.clearTimeout(timer);
      clearPendingRequest();
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
  const autonomousWatchlist = [
    {
      label: "Financing",
      value: `${Number(overview?.paymentPlans || 0)} active plans`,
      detail:
        Number(overview?.paymentPlans || 0) > 0
          ? "ChiChi can pull exact puppy financing accounts, monthly amounts, and due dates."
          : "No financed puppy accounts are active right now.",
    },
    {
      label: "CRM",
      value: `${Number(overview?.openFollowUps || 0)} follow-ups open`,
      detail:
        Number(overview?.openFollowUps || 0) > 0
          ? "There is outreach work waiting and ChiChi can pull the exact queue."
          : "No CRM follow-up queue is open right now.",
    },
    {
      label: "Buyer Inbox",
      value: `${Number(overview?.unreadBuyerMessages || 0)} unread`,
      detail:
        Number(overview?.unreadBuyerMessages || 0) > 0
          ? "Buyer-side portal messages are waiting for review."
          : "Buyer inbox is currently caught up.",
    },
    {
      label: "Public Traffic",
      value: `${Number(overview?.publicThreads24h || 0)} chats / ${Number(overview?.visitors24h || 0)} visitors`,
      detail:
        overview?.latestDigest?.summary?.trim() ||
        "ChiChi is watching site traffic, public chats, and visitor behavior in the background.",
    },
    {
      label: "ChiChi Memory",
      value: `${Number(overview?.assistantMessages24h || 0)} msgs / ${Number(overview?.memoryUpdates24h || 0)} memories`,
      detail:
        Number(overview?.memoryUpdates24h || 0) > 0
          ? "Recent assistant activity is persisting fresh business memory and operational context."
          : "ChiChi memory updates will appear here as the system learns and saves more operational context.",
    },
  ];

  return (
    <AdminPageShell>
      <div className="pb-10">
        <section className="premium-card relative overflow-hidden rounded-[2rem] border border-[rgba(214,196,173,0.84)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(178,132,78,0.16),transparent_28%),radial-gradient(circle_at_88%_14%,rgba(120,138,214,0.12),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,244,237,0.98))]" />
          <div className="pointer-events-none absolute left-8 top-8 h-48 w-48 rounded-full bg-[rgba(191,154,111,0.09)] blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-[rgba(121,136,204,0.09)] blur-3xl" />

          <div className="relative border-b border-[var(--portal-border)] px-5 py-6 md:px-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0 max-w-5xl">
                <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(200,168,132,0.45)] bg-[rgba(255,248,240,0.96)] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8c6848] shadow-sm">
                  <Sparkles className="h-3.5 w-3.5" />
                  ChiChi Core
                </span>
                <h1 className="mt-4 text-[1.8rem] font-semibold leading-[1.02] tracking-[-0.05em] text-[var(--portal-text)] [font-family:var(--font-merriweather)] md:text-[2.55rem]">
                  ChiChi for breeding operations, buyer follow-through, financing, and live support work.
                </h1>
                <p className="mt-3 max-w-4xl text-sm leading-7 text-[var(--portal-text-soft)] md:text-[15px]">
                  Pull, decide, and act from one command surface. ChiChi is wired into the live
                  breeding records, buyer workflows, payment events, follow-up queues, and public conversation stream.
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <StatusPill label="Console" value="Live" tone="active" icon={<BrainCircuit className="h-3.5 w-3.5" />} />
                <StatusPill
                  label="Zoho"
                  value={isZohoConnected ? "Connected" : "Needs review"}
                  tone={isZohoConnected ? "completed" : "warning"}
                  icon={<CreditCard className="h-3.5 w-3.5" />}
                />
                <StatusPill
                  label="Feed"
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
            </div>
          </div>

          <div className="relative grid xl:grid-cols-[minmax(0,1.45fr)_380px]">
            <div className="min-w-0 xl:border-r xl:border-[var(--portal-border)]">
              <div className="border-b border-[var(--portal-border)] px-5 py-4 md:px-7">
                <div className="flex flex-wrap items-center gap-2">
                  {commandDockPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void sendMessage(prompt)}
                      disabled={isSending}
                      className="rounded-full border border-[var(--portal-border)] bg-white/88 px-3.5 py-2 text-xs font-semibold text-[var(--portal-text)] shadow-sm transition hover:border-[var(--portal-border-strong)] hover:bg-[#fffaf4] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <div className="mt-3 flex flex-col gap-2 text-sm text-[var(--portal-text-soft)] md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2">
                    <span>{statusText}</span>
                    {intelLoading ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--portal-border)] bg-white px-2.5 py-1 text-[11px] text-[var(--portal-text-muted)]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Refreshing
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[12px] text-[var(--portal-text-muted)]">
                    <span>Enter sends</span>
                    <span>Shift+Enter adds a new line</span>
                    {lastIntelRefresh ? <span>Feed refreshed {formatDateTime(lastIntelRefresh)}</span> : null}
                  </div>
                </div>
              </div>

              <div className="max-h-[620px] min-h-[540px] overflow-y-auto bg-[linear-gradient(180deg,rgba(253,250,246,0.72),rgba(255,255,255,0.96))] px-5 py-6 md:px-7">
                <div className="space-y-5">
                  {messages.map((message) => {
                    const isUser = message.role === "user";

                    return (
                      <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                        <div className={isUser ? "max-w-[74%]" : "max-w-[88%]"}>
                          {!isUser ? (
                            <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#b67d47_0%,#7b90dd_100%)] text-white shadow-[0_10px_20px_rgba(123,144,221,0.18)]">
                                {message.kind === "alert" ? <CreditCard className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
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
                              "rounded-[1.5rem] px-4 py-4 shadow-[0_16px_34px_rgba(128,98,71,0.08)]",
                              isUser
                                ? "rounded-tr-md bg-[linear-gradient(135deg,#b57a45_0%,#8f5d31_100%)] text-white"
                                : message.kind === "alert"
                                  ? "rounded-tl-md border border-[rgba(212,188,150,0.78)] bg-[linear-gradient(180deg,#fffaf3_0%,#f8ecdc_100%)] text-[var(--portal-text)]"
                                  : "rounded-tl-md border border-[var(--portal-border)] bg-white/94 text-[var(--portal-text)]",
                            ].join(" ")}
                          >
                            {renderChatText(message.content)}
                          </div>
                          <div
                            className={`mt-2 px-1 text-[11px] ${isUser ? "text-right text-[rgba(83,62,46,0.72)]" : "text-[var(--portal-text-muted)]"}`}
                          >
                            {message.createdAt}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {isSending ? (
                    <div className="flex justify-start">
                      <div className="max-w-[88%]">
                        <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#b67d47_0%,#7b90dd_100%)] text-white shadow-[0_10px_20px_rgba(123,144,221,0.18)]">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </span>
                          ChiChi
                        </div>
                        <div className="rounded-[1.5rem] rounded-tl-md border border-[var(--portal-border)] bg-white/94 px-4 py-4 text-sm leading-7 text-[var(--portal-text-soft)] shadow-[0_16px_34px_rgba(128,98,71,0.08)]">
                          Reading the live operation...
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="border-t border-[var(--portal-border)] bg-white/92 px-5 py-5 md:px-7">
                <div className="rounded-[1.7rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-3 shadow-[inset_0_1px_2px_rgba(96,110,148,0.04)]">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    rows={4}
                    placeholder="Ask ChiChi for breeding-program totals, breeding dogs, portal users, exact chats, payment links, financing details, delivery costs, CRM follow-ups, or admin updates..."
                    className="min-h-[128px] w-full resize-none border-0 bg-transparent px-2 py-2 text-sm leading-7 text-[var(--portal-text)] outline-none placeholder:text-[var(--portal-text-muted)]"
                    disabled={isSending}
                  />
                </div>

                <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-xs leading-6 text-[var(--portal-text-muted)]">
                    ChiChi answers from the live records tied to this breeding hub and can help move operational work forward.
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleNewSession}
                      className="inline-flex items-center gap-2 rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[0_10px_24px_rgba(106,76,45,0.08)] transition hover:-translate-y-0.5"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      New session
                    </button>
                    <button
                      type="button"
                      onClick={() => void sendMessage()}
                      disabled={!draft.trim() || isSending}
                      className="inline-flex items-center justify-center gap-2 rounded-[1rem] bg-[linear-gradient(90deg,#b67b46_0%,#d3b08a_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(182,123,70,0.24)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                      Send to ChiChi
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <aside className="bg-[linear-gradient(180deg,rgba(255,250,244,0.76),rgba(248,243,236,0.92))]">
              <div className="space-y-6 px-5 py-6 md:px-6">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                    Payment Stream
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <h3 className="text-[1.25rem] font-semibold text-[var(--portal-text)] [font-family:var(--font-merriweather)]">
                      ChiChi is watching live money movement.
                    </h3>
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(paymentFeed.tone)}`}
                    >
                      {paymentFeed.label}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--portal-text-soft)]">
                    {paymentFeed.description}
                  </p>
                </div>

                <div className="space-y-3 border-t border-[var(--portal-border)] pt-5">
                  {paymentAlerts.length ? (
                    paymentAlerts.map((alert) => (
                      <div key={alert.id} className="rounded-[1.2rem] border border-[var(--portal-border)] bg-white/88 px-4 py-4 shadow-sm">
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
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1.25rem] border border-dashed border-[var(--portal-border-strong)] bg-white/74 px-4 py-8 text-center">
                      <div className="text-sm font-semibold text-[var(--portal-text)]">
                        {isZohoConnected ? "Zoho is connected and ChiChi is listening." : "Payment feed setup still needs attention."}
                      </div>
                      <div className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--portal-text-soft)]">
                        {isZohoConnected
                          ? "The stream will populate as soon as a real customer payment or payment-link event hits the webhook."
                          : "Reconnect Zoho or confirm the webhook signing key in Settings so ChiChi can surface live payment activity here."}
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-[var(--portal-border)] pt-5">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                    Autonomous Watchlist
                  </div>
                  <div className="mt-3 space-y-3">
                    {autonomousWatchlist.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-[1.15rem] border border-[var(--portal-border)] bg-white/82 px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-[var(--portal-text)]">
                              {item.label}
                            </div>
                            <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">
                              {item.detail}
                            </div>
                          </div>
                          <span className="shrink-0 text-right text-[11px] font-bold uppercase tracking-[0.16em] text-[#8c6848]">
                            {item.value}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-[var(--portal-border)] pt-5">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                    Active Senses
                  </div>
                  <div className="mt-3 space-y-3">
                    {QUICK_LANES.map((lane) => (
                      <div key={lane.title} className="flex items-start gap-3 rounded-[1.15rem] border border-[var(--portal-border)] bg-white/78 px-4 py-4">
                        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--portal-surface-muted)] text-[#8c6848]">
                          {lane.icon}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[var(--portal-text)]">
                            {lane.title}
                          </div>
                          <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">
                            {lane.detail}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-[var(--portal-border)] pt-5">
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                    Runtime
                  </div>
                  <div className="mt-3 grid gap-3">
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

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href="/admin/portal/settings"
                      className="inline-flex items-center gap-2 rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[0_10px_24px_rgba(106,76,45,0.08)] transition hover:-translate-y-0.5"
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
            </aside>
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
