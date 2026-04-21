"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessageSquareText,
  RefreshCcw,
  Search,
  XCircle,
} from "lucide-react";
import {
  AdminEmptyState,
  AdminHeroPrimaryAction,
  AdminHeroSecondaryAction,
  AdminInfoTile,
  AdminPageHero,
  AdminPageShell,
  AdminPanel,
  AdminRestrictedState,
  adminStatusBadge,
} from "@/components/admin/luxury-admin-shell";
import { usePortalAdminSession } from "@/lib/use-portal-admin-session";
import { fmtDate } from "@/lib/utils";

type WebsiteChatMessage = {
  id: string;
  created_at: string | null;
  thread_id: string | null;
  visitor_id: string | null;
  sender: string;
  content: string;
  intent: string | null;
  topic: string | null;
  requires_follow_up: boolean;
  follow_up_reason: string | null;
  tags: string[];
};

type WebsiteChatThreadRecord = {
  id: string;
  visitor_id: string | null;
  source_page: string | null;
  source_site: string | null;
  status: string;
  lead_status: string;
  follow_up_needed: boolean;
  follow_up_reason: string | null;
  priority: string;
  summary: string | null;
  intent_summary: string | null;
  tags: string[];
  updated_at: string | null;
  last_user_message_at: string | null;
  created_at: string | null;
};

type WebsiteVisitorRecord = {
  id: string;
  session_id: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  current_page: string | null;
  landing_page: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  is_returning: boolean;
  visit_count: number | null;
};

type WebsiteChatThread = WebsiteChatThreadRecord & {
  key: string;
  messages: WebsiteChatMessage[];
  visitor: WebsiteVisitorRecord | null;
  latestMessageAt: string | null;
  latestPreview: string;
  latestSender: string;
  visitorLabel: string;
};

type WebsiteChatsPayload = {
  ok?: boolean;
  error?: string;
  threads?: WebsiteChatThreadRecord[];
  messages?: WebsiteChatMessage[];
  visitors?: WebsiteVisitorRecord[];
  warnings?: string[];
};

function buildPreview(value: string | null | undefined, fallback = "No message preview available.") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
}

function normalizeSender(value: string | null | undefined) {
  const sender = String(value || "").trim().toLowerCase();
  if (sender === "assistant" || sender === "admin" || sender === "system") return sender;
  return "visitor";
}

function isVisitorSender(value: string | null | undefined) {
  return normalizeSender(value) === "visitor";
}

function dateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function shortSession(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return "Website visitor";
  if (text.length <= 14) return text;
  return `${text.slice(0, 8)}...${text.slice(-4)}`;
}

function sourceLabel(thread: WebsiteChatThread) {
  return (
    thread.source_page ||
    thread.visitor?.current_page ||
    thread.visitor?.landing_page ||
    thread.source_site ||
    "Website"
  );
}

function isAbsoluteUrl(value: string | null | undefined) {
  if (!value) return false;
  return /^https?:\/\//i.test(value);
}

function todayCount(threads: WebsiteChatThread[]) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return threads.filter((thread) => {
    const value = thread.latestMessageAt || thread.updated_at || thread.created_at;
    return value ? new Date(value).getTime() >= start.getTime() : false;
  }).length;
}

function buildThreads(payload: WebsiteChatsPayload) {
  const visitors = new Map(
    (payload.visitors || []).filter((visitor) => visitor.id).map((visitor) => [visitor.id, visitor])
  );
  const threadMap = new Map<string, WebsiteChatThread>();

  (payload.threads || []).forEach((thread) => {
    const visitor = thread.visitor_id ? visitors.get(thread.visitor_id) || null : null;
    threadMap.set(thread.id, {
      ...thread,
      key: thread.id,
      messages: [],
      visitor,
      latestMessageAt: thread.last_user_message_at || thread.updated_at || thread.created_at,
      latestPreview: buildPreview(thread.summary || thread.intent_summary),
      latestSender: "system",
      visitorLabel: visitor?.is_returning
        ? `Returning ${shortSession(visitor.session_id)}`
        : shortSession(visitor?.session_id),
    });
  });

  (payload.messages || []).forEach((message) => {
    const threadId = message.thread_id || `standalone:${message.id}`;
    const existing = threadMap.get(threadId);
    if (existing) {
      existing.messages.push(message);
      return;
    }

    const visitor = message.visitor_id ? visitors.get(message.visitor_id) || null : null;
    threadMap.set(threadId, {
      id: threadId,
      key: threadId,
      visitor_id: message.visitor_id,
      source_page: visitor?.current_page || visitor?.landing_page || null,
      source_site: "public_website",
      status: "open",
      lead_status: "visitor",
      follow_up_needed: message.requires_follow_up,
      follow_up_reason: message.follow_up_reason,
      priority: message.requires_follow_up ? "high" : "normal",
      summary: null,
      intent_summary: message.topic || message.intent,
      tags: message.tags || [],
      updated_at: message.created_at,
      last_user_message_at: isVisitorSender(message.sender) ? message.created_at : null,
      created_at: message.created_at,
      messages: [message],
      visitor,
      latestMessageAt: message.created_at,
      latestPreview: buildPreview(message.content),
      latestSender: normalizeSender(message.sender),
      visitorLabel: visitor?.is_returning
        ? `Returning ${shortSession(visitor.session_id)}`
        : shortSession(visitor?.session_id),
    });
  });

  return Array.from(threadMap.values())
    .map((thread) => {
      const messages = [...thread.messages].sort((left, right) => {
        const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
        const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;
        return leftTime - rightTime;
      });
      const latest = messages[messages.length - 1] || null;
      const mergedTags = Array.from(
        new Set([...(thread.tags || []), ...messages.flatMap((message) => message.tags || [])])
      );

      return {
        ...thread,
        messages,
        tags: mergedTags,
        latestMessageAt: latest?.created_at || thread.latestMessageAt,
        latestPreview: buildPreview(latest?.content || thread.summary || thread.intent_summary),
        latestSender: normalizeSender(latest?.sender || thread.latestSender),
        follow_up_needed:
          thread.follow_up_needed || messages.some((message) => message.requires_follow_up),
        follow_up_reason:
          thread.follow_up_reason ||
          messages.find((message) => message.follow_up_reason)?.follow_up_reason ||
          null,
      };
    })
    .sort((left, right) => {
      if (left.follow_up_needed !== right.follow_up_needed) {
        return left.follow_up_needed ? -1 : 1;
      }
      const leftTime = left.latestMessageAt ? new Date(left.latestMessageAt).getTime() : 0;
      const rightTime = right.latestMessageAt ? new Date(right.latestMessageAt).getTime() : 0;
      return rightTime - leftTime;
    });
}

async function fetchWebsiteChats(token: string) {
  const response = await fetch("/api/admin/portal/website-chats", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = (await response.json()) as WebsiteChatsPayload;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Could not load website chats.");
  }
  return {
    threads: buildThreads(payload),
    warnings: payload.warnings || [],
  };
}

export default function AdminWebsiteChatsPage() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const [threads, setThreads] = useState<WebsiteChatThread[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "followup" | "visitor-last" | "closed">("all");
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [threadsRefreshing, setThreadsRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [statusText, setStatusText] = useState("");
  const [warningText, setWarningText] = useState("");
  const hasLoadedThreadsRef = useRef(false);
  const initialLoadKeyRef = useRef("");

  const loadWorkspace = useCallback(async (background = false) => {
    if (!accessToken) return;
    if (background && hasLoadedThreadsRef.current) setThreadsRefreshing(true);
    else setThreadsLoading(true);

    try {
      const result = await fetchWebsiteChats(accessToken);
      setThreads(result.threads);
      hasLoadedThreadsRef.current = true;
      setSelectedKey(
        (current) =>
          result.threads.find((thread) => thread.key === current)?.key ||
          result.threads[0]?.key ||
          ""
      );
      setStatusText("");
      setWarningText(result.warnings.length ? result.warnings.join(" ") : "");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not load website chats.");
    } finally {
      setThreadsLoading(false);
      setThreadsRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!loading && accessToken && isAdmin) {
      if (initialLoadKeyRef.current === accessToken) return;
      initialLoadKeyRef.current = accessToken;
      void loadWorkspace(false);
    } else if (!loading) {
      initialLoadKeyRef.current = "";
      setThreadsLoading(false);
    }
  }, [accessToken, isAdmin, loading, loadWorkspace]);

  const filteredThreads = useMemo(() => {
    const query = search.trim().toLowerCase();
    return threads.filter((thread) => {
      const statusMatch =
        statusFilter === "all" ||
        (statusFilter === "followup" && thread.follow_up_needed) ||
        (statusFilter === "visitor-last" && isVisitorSender(thread.latestSender)) ||
        (statusFilter === "closed" && String(thread.status || "").toLowerCase() === "closed");

      if (!statusMatch) return false;
      if (!query) return true;

      return [
        thread.visitorLabel,
        sourceLabel(thread),
        thread.status,
        thread.lead_status,
        thread.priority,
        thread.summary,
        thread.intent_summary,
        thread.latestPreview,
        thread.follow_up_reason,
        thread.tags.join(" "),
        thread.messages.map((message) => message.content).join(" "),
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(query);
    });
  }, [search, statusFilter, threads]);

  const selectedThread = useMemo(
    () =>
      filteredThreads.find((thread) => thread.key === selectedKey) ||
      threads.find((thread) => thread.key === selectedKey) ||
      null,
    [filteredThreads, selectedKey, threads]
  );

  async function updateThread(action: "reviewed" | "close") {
    if (!selectedThread || !accessToken) return;
    if (selectedThread.id.startsWith("standalone:")) {
      setStatusText("This message does not have a saved website chat thread to update.");
      return;
    }

    setActionLoading(action);
    setStatusText("");

    try {
      const response = await fetch("/api/admin/portal/website-chats", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          threadId: selectedThread.id,
          action,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not update website chat.");
      }
      await loadWorkspace(true);
      setSelectedKey(selectedThread.key);
      setStatusText(action === "close" ? "Website chat closed." : "Follow-up cleared.");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not update website chat.");
    } finally {
      setActionLoading("");
    }
  }

  if (!loading && !user) {
    return (
      <AdminRestrictedState
        title="Sign in to access website chats."
        details="This page is reserved for the Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!loading && user && !isAdmin) {
    return (
      <AdminRestrictedState
        title="This website chat workspace is limited to approved owner accounts."
        details="Only approved owner emails can read public ChiChi website conversations."
      />
    );
  }

  const followUpCount = threads.filter((thread) => thread.follow_up_needed).length;
  const visitorLastCount = threads.filter((thread) => isVisitorSender(thread.latestSender)).length;
  const openCount = threads.filter((thread) => String(thread.status || "").toLowerCase() !== "closed").length;

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-12">
        <AdminPageHero
          eyebrow="Website Chats"
          title="Public ChiChi conversations"
          description="Read the public website chats separately from Portal Messages. This is the live ChiChi intake surface for anonymous visitors, availability questions, lead signals, and follow-up needs."
          actions={
            <>
              <AdminHeroPrimaryAction href="/admin/portal/assistant">
                Open ChiChi Admin
              </AdminHeroPrimaryAction>
              <AdminHeroSecondaryAction href="/admin/portal/messages">
                Open Portal Messages
              </AdminHeroSecondaryAction>
            </>
          }
          aside={
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <AdminInfoTile label="Website Chats" value={String(threads.length)} detail="Public ChiChi threads available to read." />
              <AdminInfoTile label="Needs Follow-Up" value={String(followUpCount)} detail="Threads ChiChi flagged for owner attention." />
              <AdminInfoTile label="Visitor Last" value={String(visitorLastCount)} detail="Chats where the last message came from the visitor." />
              <AdminInfoTile label="Today" value={String(todayCount(threads))} detail={`${openCount} open public chat${openCount === 1 ? "" : "s"}.`} />
            </div>
          }
        />

        {warningText ? (
          <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50/90 px-5 py-4 text-sm leading-6 text-amber-900">
            Partial website chat data loaded. {warningText}
          </div>
        ) : null}

        {statusText ? (
          <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-5 py-4 text-sm font-semibold text-[var(--portal-text-soft)]">
            {statusText}
          </div>
        ) : null}

        {loading || (threadsLoading && !threads.length) ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
            <div className="min-h-[680px] animate-pulse rounded-[1.6rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)]" />
            <div className="min-h-[680px] animate-pulse rounded-[1.6rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)]" />
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
            <AdminPanel
              title="Website Chat Queue"
              subtitle="Select a public ChiChi chat to read the full transcript and visitor context."
            >
              <div className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row">
                  <label className="relative block flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--portal-text-muted)]" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search website chats, topics, pages..."
                      className="w-full rounded-[20px] border border-[var(--portal-border)] bg-[#fffdfb] py-3 pl-11 pr-4 text-sm text-[var(--portal-text)] outline-none focus:border-[#c8a884]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void loadWorkspace(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)]"
                  >
                    {threadsRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                    {threadsRefreshing ? "Refreshing" : "Refresh"}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    ["all", "All"],
                    ["followup", "Needs follow-up"],
                    ["visitor-last", "Visitor last"],
                    ["closed", "Closed"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStatusFilter(value as typeof statusFilter)}
                      className={[
                        "rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition",
                        statusFilter === value
                          ? "border-transparent bg-[var(--portal-accent)] text-white shadow-[var(--portal-shadow-sm)]"
                          : "border-[var(--portal-border)] bg-white text-[var(--portal-text-soft)] hover:border-[var(--portal-border-strong)]",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {filteredThreads.length ? (
                  <div className="overflow-hidden rounded-[1.25rem] border border-[var(--portal-border)] bg-white">
                    <div className="max-h-[680px] overflow-auto">
                      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                        <thead className="sticky top-0 z-10 bg-[#f8efe3] text-[10px] uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                          <tr>
                            <th className="px-4 py-3 font-bold">Visitor</th>
                            <th className="px-4 py-3 font-bold">Status</th>
                            <th className="px-4 py-3 font-bold">Last Message</th>
                            <th className="px-4 py-3 font-bold">Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredThreads.map((thread) => {
                            const selected = selectedThread?.key === thread.key;
                            return (
                              <tr
                                key={thread.key}
                                onClick={() => setSelectedKey(thread.key)}
                                className={[
                                  "cursor-pointer border-t border-[var(--portal-border)] transition",
                                  selected ? "bg-[#fff4e8]" : "bg-white hover:bg-[var(--portal-surface-muted)]",
                                ].join(" ")}
                              >
                                <td className="border-t border-[var(--portal-border)] px-4 py-4 align-top">
                                  <div className="font-semibold text-[var(--portal-text)]">{thread.visitorLabel}</div>
                                  <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                                    {thread.visitor?.is_returning ? "Returning visitor" : "New or anonymous visitor"}
                                  </div>
                                </td>
                                <td className="border-t border-[var(--portal-border)] px-4 py-4 align-top">
                                  <div className="flex flex-wrap gap-2">
                                    <Badge tone={thread.follow_up_needed ? "warning" : thread.status}>
                                      {thread.follow_up_needed ? "follow-up" : thread.status}
                                    </Badge>
                                    <Badge tone={thread.priority}>{thread.lead_status || "visitor"}</Badge>
                                  </div>
                                </td>
                                <td className="border-t border-[var(--portal-border)] px-4 py-4 align-top">
                                  <div className="max-w-[240px] text-xs leading-5 text-[var(--portal-text-soft)]">
                                    {thread.latestPreview}
                                  </div>
                                  <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
                                    {dateTime(thread.latestMessageAt)}
                                  </div>
                                </td>
                                <td className="border-t border-[var(--portal-border)] px-4 py-4 align-top">
                                  <div className="max-w-[190px] truncate text-xs font-semibold text-[var(--portal-text)]">
                                    {sourceLabel(thread)}
                                  </div>
                                  <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
                                    {thread.messages.length} msg{thread.messages.length === 1 ? "" : "s"}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <AdminEmptyState
                    title="No website chats matched"
                    description="Try clearing the search or switching the filter. Public ChiChi conversations will appear here when the website widget stores them."
                  />
                )}
              </div>
            </AdminPanel>

            {selectedThread ? (
              <div className="space-y-6">
                <AdminPanel
                  title="Selected Website Chat"
                  subtitle="Public website chat details, source page, visitor footprint, and follow-up state."
                >
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <AdminInfoTile label="Visitor" value={selectedThread.visitorLabel} detail={selectedThread.visitor?.session_id || "Anonymous session"} />
                    <AdminInfoTile label="Lead Status" value={selectedThread.lead_status || "visitor"} detail={`Priority: ${selectedThread.priority || "normal"}`} />
                    <AdminInfoTile label="Status" value={selectedThread.status || "open"} detail={selectedThread.follow_up_needed ? "Follow-up needed" : "No follow-up flag"} />
                    <AdminInfoTile label="Last Activity" value={dateTime(selectedThread.latestMessageAt)} detail={`${selectedThread.messages.length} recorded message${selectedThread.messages.length === 1 ? "" : "s"}`} />
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <div className="rounded-[1.1rem] border border-[var(--portal-border)] bg-[#fffdfb] p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                        Summary
                      </div>
                      <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                        {selectedThread.summary ||
                          selectedThread.intent_summary ||
                          selectedThread.latestPreview ||
                          "No summary has been stored for this website chat yet."}
                      </div>
                      {selectedThread.follow_up_reason ? (
                        <div className="mt-4 rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                          {selectedThread.follow_up_reason}
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => void updateThread("reviewed")}
                        disabled={Boolean(actionLoading)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[var(--portal-shadow-sm)] transition hover:bg-[var(--portal-surface-muted)] disabled:opacity-60"
                      >
                        {actionLoading === "reviewed" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Mark Reviewed
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateThread("close")}
                        disabled={Boolean(actionLoading)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--portal-border)] bg-[#fff7f1] px-4 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[var(--portal-shadow-sm)] transition hover:bg-white disabled:opacity-60"
                      >
                        {actionLoading === "close" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                        Close Chat
                      </button>
                      {isAbsoluteUrl(sourceLabel(selectedThread)) ? (
                        <a
                          href={sourceLabel(selectedThread)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(181,117,47,0.24)] transition hover:brightness-105"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open Source Page
                        </a>
                      ) : null}
                    </div>
                  </div>
                </AdminPanel>

                <section className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
                  <AdminPanel
                    title="Conversation Transcript"
                    subtitle="Read the actual visitor and ChiChi exchange from the public website widget."
                  >
                    <Transcript thread={selectedThread} />
                  </AdminPanel>

                  <AdminPanel title="Visitor Footprint" subtitle="Website context captured with this public chat.">
                    <div className="space-y-3 text-sm leading-6 text-[var(--portal-text-soft)]">
                      <DetailRow label="Current page" value={selectedThread.visitor?.current_page || selectedThread.source_page} />
                      <DetailRow label="Landing page" value={selectedThread.visitor?.landing_page} />
                      <DetailRow label="Referrer" value={selectedThread.visitor?.referrer} />
                      <DetailRow label="First seen" value={dateTime(selectedThread.visitor?.first_seen_at)} />
                      <DetailRow label="Last seen" value={dateTime(selectedThread.visitor?.last_seen_at || selectedThread.updated_at)} />
                      <DetailRow label="Visits" value={selectedThread.visitor?.visit_count == null ? "-" : String(selectedThread.visitor.visit_count)} />
                      <DetailRow
                        label="Campaign"
                        value={[
                          selectedThread.visitor?.utm_source,
                          selectedThread.visitor?.utm_medium,
                          selectedThread.visitor?.utm_campaign,
                        ].filter(Boolean).join(" / ")}
                      />
                    </div>

                    {selectedThread.tags.length ? (
                      <div className="mt-5 flex flex-wrap gap-2">
                        {selectedThread.tags.map((tag) => (
                          <Badge key={tag} tone="neutral">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </AdminPanel>
                </section>
              </div>
            ) : (
              <AdminPanel title="Selected Website Chat" subtitle="Choose a website chat row to read it.">
                <AdminEmptyState
                  title={threads.length ? "No chat selected" : "No website chats stored yet"}
                  description={
                    threads.length
                      ? "Select a chat from the queue to read the transcript and visitor details."
                      : "Once public ChiChi conversations are stored, they will appear here as readable website chat records."
                  }
                />
              </AdminPanel>
            )}
          </section>
        )}
      </div>
    </AdminPageShell>
  );
}

function Badge({ tone, children }: { tone?: string | null; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${adminStatusBadge(
        tone || "neutral"
      )}`}
    >
      {children}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-semibold text-[var(--portal-text)]">
        {value || "-"}
      </div>
    </div>
  );
}

function Transcript({ thread }: { thread: WebsiteChatThread }) {
  if (!thread.messages.length) {
    return (
      <AdminEmptyState
        title="No transcript messages"
        description="This website chat thread exists, but no message rows were returned for it."
      />
    );
  }

  return (
    <div className="space-y-5">
      {thread.messages.map((message) => {
        const sender = normalizeSender(message.sender);
        const isAssistant = sender === "assistant" || sender === "admin";
        const isSystem = sender === "system";
        return (
          <div
            key={`${message.id}:${message.created_at || ""}`}
            className={`flex ${isAssistant || isSystem ? "justify-end" : "justify-start"}`}
          >
            <div
              className={[
                "max-w-[88%] rounded-[28px] border px-5 py-4 shadow-[0_10px_24px_rgba(106,76,45,0.05)]",
                isAssistant
                  ? "border-[#d8c2a8] bg-[linear-gradient(180deg,#6b4d33_0%,#5a3f2d_100%)] text-white"
                  : isSystem
                    ? "border-[var(--portal-border)] bg-[#f4eadf] text-[var(--portal-text)]"
                    : "border-[var(--portal-border)] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2e9_100%)] text-[var(--portal-text)]",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div
                  className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
                    isAssistant ? "text-white/70" : "text-[var(--portal-text-muted)]"
                  }`}
                >
                  {isAssistant ? "ChiChi" : isSystem ? "System" : "Website Visitor"}
                </div>
                <div className={`text-[10px] ${isAssistant ? "text-white/60" : "text-[#8d6f52]"}`}>
                  {dateTime(message.created_at)}
                </div>
              </div>
              <div
                className={`mt-3 whitespace-pre-wrap text-sm leading-7 ${
                  isAssistant ? "text-white/92" : "text-[var(--portal-text-soft)]"
                }`}
              >
                {message.content || "-"}
              </div>
              {(message.topic || message.intent || message.requires_follow_up) ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {message.topic ? <Badge tone="neutral">{message.topic}</Badge> : null}
                  {message.intent && message.intent !== message.topic ? (
                    <Badge tone="neutral">{message.intent}</Badge>
                  ) : null}
                  {message.requires_follow_up ? <Badge tone="warning">follow-up</Badge> : null}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
