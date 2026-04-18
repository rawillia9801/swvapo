"use client";

import React, { useEffect, useEffectEvent, useMemo, useState } from "react";
import { Loader2, RefreshCcw, Send } from "lucide-react";
import {
  AdminEmptyState,
  AdminHeroPrimaryAction,
  AdminHeroSecondaryAction,
  AdminInfoTile,
  AdminListCard,
  AdminPageHero,
  AdminPageShell,
  AdminPanel,
  AdminRestrictedState,
  adminStatusBadge,
} from "@/components/admin/luxury-admin-shell";
import {
  adminFirstValue,
  adminNormalizeEmail,
  fetchAdminAccounts,
  type AdminPortalAccount,
} from "@/lib/admin-portal";
import { usePortalAdminSession } from "@/lib/use-portal-admin-session";
import { fmtDate } from "@/lib/utils";

type PortalMessage = {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  subject: string | null;
  message: string;
  status: string | null;
  read_by_admin: boolean;
  read_by_user: boolean;
  sender: "user" | "admin";
};

type ThreadAccount = AdminPortalAccount & {
  messages: PortalMessage[];
  unreadCount: number;
  latestMessageAt: string | null;
  latestPreview: string;
};

function buildPreview(message: string | null | undefined) {
  const text = String(message || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > 90 ? `${text.slice(0, 90)}...` : text;
}

async function loadThreads(token: string) {
  const [accounts, messagesResponse] = await Promise.all([
    fetchAdminAccounts(token),
    fetch("/api/admin/portal/messages", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
  ]);

  const payload = (await messagesResponse.json()) as {
    ok?: boolean;
    error?: string;
    messages?: PortalMessage[];
  };
  if (!messagesResponse.ok || !payload.ok) {
    throw new Error(payload.error || "Could not load buyer conversations.");
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const accountMap = new Map<string, ThreadAccount>();

  accounts.forEach((account) => {
    accountMap.set(account.key, {
      ...account,
      messages: [],
      unreadCount: 0,
      latestMessageAt: null,
      latestPreview: "",
    });
  });

  messages.forEach((entry) => {
    const userId = String(entry.user_id || "").trim();
    const email = adminNormalizeEmail(entry.user_email);
    const key = userId || email;
    if (!key) return;

    const existing = accountMap.get(key);
    if (existing) {
      existing.messages.push(entry);
      return;
    }

    accountMap.set(key, {
      key,
      email,
      userId: userId || null,
      displayName: email || "Portal User",
      phone: "",
      createdAt: null,
      lastSignInAt: null,
      buyer: null,
      application: null,
      forms: [],
      messages: [entry],
      unreadCount: 0,
      latestMessageAt: null,
      latestPreview: "",
    });
  });

  return Array.from(accountMap.values())
    .map((thread) => {
      const ordered = [...thread.messages].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const latest = ordered[ordered.length - 1] || null;
      return {
        ...thread,
        displayName:
          adminFirstValue(
            thread.buyer?.full_name,
            thread.buyer?.name,
            thread.application?.full_name,
            thread.email,
            "Portal User"
          ) || "Portal User",
        messages: ordered,
        unreadCount: ordered.filter((entry) => entry.sender === "user" && !entry.read_by_admin).length,
        latestMessageAt: latest?.created_at || null,
        latestPreview: buildPreview(latest?.message || ""),
      };
    })
    .sort((a, b) => {
      if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
      const aTime = a.latestMessageAt ? new Date(a.latestMessageAt).getTime() : 0;
      const bTime = b.latestMessageAt ? new Date(b.latestMessageAt).getTime() : 0;
      return bTime - aTime;
    });
}

export default function AdminPortalMessagesPage() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const [threads, setThreads] = useState<ThreadAccount[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [threadsRefreshing, setThreadsRefreshing] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedKey, setSelectedKey] = useState("");

  const loadInboxWorkspace = useEffectEvent(async (background = false) => {
    if (!accessToken) return;
    if (background && threads.length) setThreadsRefreshing(true);
    else setThreadsLoading(true);

    try {
      const nextThreads = await loadThreads(accessToken);
      setThreads(nextThreads);
      setSelectedKey((current) => nextThreads.find((thread) => thread.key === current)?.key || nextThreads[0]?.key || "");
      setStatusText("");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not load buyer conversations.");
    } finally {
      setThreadsLoading(false);
      setThreadsRefreshing(false);
    }
  });

  useEffect(() => {
    if (!loading && accessToken && isAdmin) {
      void loadInboxWorkspace(false);
    } else if (!loading) {
      setThreadsLoading(false);
    }
  }, [accessToken, isAdmin, loading, loadInboxWorkspace]);

  const filteredThreads = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return threads;
    return threads.filter((thread) =>
      [
        thread.displayName,
        thread.email,
        thread.latestPreview,
        thread.buyer?.status,
        thread.application?.status,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(query)
    );
  }, [search, threads]);

  const selectedThread = useMemo(
    () =>
      filteredThreads.find((thread) => thread.key === selectedKey) ||
      threads.find((thread) => thread.key === selectedKey) ||
      null,
    [filteredThreads, selectedKey, threads]
  );

  useEffect(() => {
    if (!selectedThread) return;
    if (!accessToken) return;
    const unreadIds = selectedThread.messages
      .filter((entry) => entry.sender === "user" && !entry.read_by_admin)
      .map((entry) => entry.id);

    if (!unreadIds.length) return;

    const markRead = async () => {
      setLoadingThread(true);
      try {
        const response = await fetch("/api/admin/portal/messages", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ ids: unreadIds }),
        });

        const payload = (await response.json()) as { ok?: boolean; error?: string };
        if (response.ok && payload.ok) {
          setThreads((prev) =>
            prev.map((thread) =>
              thread.key === selectedThread.key
                ? {
                    ...thread,
                    messages: thread.messages.map((entry) =>
                      unreadIds.includes(entry.id) ? { ...entry, read_by_admin: true } : entry
                    ),
                    unreadCount: 0,
                  }
                : thread
            )
          );
        }
      } finally {
        setLoadingThread(false);
      }
    };

    void markRead();
  }, [accessToken, selectedThread]);

  async function handleSendAdminMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedThread) {
      setStatusText("Choose a buyer thread first.");
      return;
    }
    if (!message.trim()) {
      setStatusText("Please enter a message.");
      return;
    }

    setSending(true);
    setStatusText("");

    try {
      const response = await fetch("/api/admin/portal/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          user_id: selectedThread.userId || null,
          user_email: selectedThread.email || null,
          subject: subject.trim() || null,
          message: message.trim(),
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not send the admin message.");
      }

      setSubject("");
      setMessage("");
      await loadInboxWorkspace(true);
      setSelectedKey(selectedThread.key);
      setStatusText("Admin message sent.");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not send the admin message.");
    } finally {
      setSending(false);
    }
  }

  if (!loading && !user) {
    return (
      <AdminRestrictedState
        title="Sign in to access portal messages."
        details="This page is reserved for the Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!loading && user && !isAdmin) {
    return (
      <AdminRestrictedState
        title="This message workspace is limited to approved owner accounts."
        details="Only approved owner emails can manage buyer conversations here."
      />
    );
  }

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-12">
        <AdminPageHero
          eyebrow="Messages"
          title="Buyer inbox"
          description="This screen is for buyer questions and breeder replies only. Each row is one buyer conversation thread with read state, latest activity, and direct reply controls."
          actions={
            <>
              <AdminHeroPrimaryAction href="/admin/portal/resend-templates">
                Open Resend Templates
              </AdminHeroPrimaryAction>
              <AdminHeroSecondaryAction href="/admin/portal/buyers">
                Open Buyers
              </AdminHeroSecondaryAction>
            </>
          }
          aside={
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <AdminInfoTile
                label="Buyer Threads"
                value={String(threads.length)}
                detail="Grouped buyer inbox records."
              />
              <AdminInfoTile
                label="Unread Replies"
                value={String(threads.reduce((sum, thread) => sum + thread.unreadCount, 0))}
                detail="Buyer questions still waiting on breeder review."
              />
              <AdminInfoTile
                label="Mapped to Buyer"
                value={String(threads.filter((thread) => !!thread.buyer).length)}
                detail={`${threads.filter((thread) => !thread.buyer).length} threads still need cleanup or matching.`}
              />
              <AdminInfoTile
                label="Visible Rows"
                value={String(filteredThreads.length)}
                detail="Current inbox slice after search filtering."
              />
            </div>
          }
        />

        {loading || (threadsLoading && !threads.length) ? (
          <div className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
            <div className="min-h-[680px] animate-pulse rounded-[1.6rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)]" />
            <div className="min-h-[680px] animate-pulse rounded-[1.6rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)]" />
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
            <AdminPanel
              title="Buyer Threads"
              subtitle="Search by buyer, email, status, or recent message text. One row equals one buyer conversation."
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search buyer conversations..."
                    className="w-full rounded-[20px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3 text-sm text-[var(--portal-text)] outline-none focus:border-[#c8a884]"
                  />
                  <button
                    type="button"
                    onClick={() => void loadInboxWorkspace(true)}
                    className="inline-flex items-center gap-2 rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)]"
                  >
                    {threadsRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                    {threadsRefreshing ? "Refreshing" : "Refresh"}
                  </button>
                </div>

                <div className="space-y-3">
                  {filteredThreads.length ? (
                    filteredThreads.map((thread) => (
                      <AdminListCard
                        key={thread.key}
                        selected={selectedKey === thread.key}
                        onClick={() => setSelectedKey(thread.key)}
                        title={thread.displayName || "Buyer"}
                        subtitle={thread.email || "No email on file"}
                        meta={`${thread.messages.length} message${thread.messages.length === 1 ? "" : "s"} | ${thread.latestMessageAt ? fmtDate(thread.latestMessageAt) : "No activity yet"}`}
                        badge={
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                              thread.unreadCount
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : adminStatusBadge("read")
                            }`}
                          >
                            {thread.unreadCount ? `${thread.unreadCount} unread` : "read"}
                          </span>
                        }
                      />
                    ))
                  ) : (
                    <AdminEmptyState
                      title="No buyer threads matched your search"
                      description="Try a different buyer name, email, or status term."
                    />
                  )}
                </div>
              </div>
            </AdminPanel>

            {selectedThread ? (
              <div className="space-y-6">
                <AdminPanel
                  title="Conversation Snapshot"
                  subtitle="This buyer's thread, read state, and reply workflow stay together here."
                >
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <AdminInfoTile label="Buyer" value={selectedThread.displayName || "Buyer"} />
                    <AdminInfoTile label="Email" value={selectedThread.email || "-"} />
                    <AdminInfoTile
                      label="Unread"
                      value={String(selectedThread.unreadCount)}
                      detail={loadingThread ? "Updating read state..." : "Unread buyer replies"}
                    />
                    <AdminInfoTile
                      label="Latest Activity"
                      value={selectedThread.latestMessageAt ? fmtDate(selectedThread.latestMessageAt) : "-"}
                    />
                  </div>

                  {statusText ? (
                    <div className="mt-4 rounded-[18px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--portal-text-soft)]">
                      {statusText}
                    </div>
                  ) : null}
                </AdminPanel>

                <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[380px_minmax(0,1fr)]">
                  <AdminPanel
                    title="Send Reply"
                    subtitle="Reply directly to the selected buyer from the portal inbox."
                  >
                    <form onSubmit={handleSendAdminMessage} className="space-y-4">
                      <Field label="Subject" value={subject} onChange={setSubject} />
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                        Message
                        <textarea
                          value={message}
                          onChange={(event) => setMessage(event.target.value)}
                          rows={9}
                          className="mt-2 w-full rounded-[18px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3.5 text-sm text-[var(--portal-text)] outline-none focus:border-[#c8a884]"
                          required
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={sending}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(181,117,47,0.26)] transition hover:brightness-105 disabled:opacity-60"
                      >
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {sending ? "Sending..." : "Send Admin Message"}
                      </button>
                    </form>
                  </AdminPanel>

                  <AdminPanel
                    title="Conversation Thread"
                    subtitle="Messages are grouped by day and stay attached to this buyer record."
                  >
                    <ConversationThread selectedThread={selectedThread} />
                  </AdminPanel>
                </section>
              </div>
            ) : (
              <AdminPanel title="Conversation Snapshot" subtitle="Choose a buyer thread to begin.">
                <AdminEmptyState
                  title={threads.length ? "No thread selected" : "No conversations yet"}
                  description={
                    threads.length
                      ? "Choose a buyer inbox row from the left to review and reply."
                      : "Buyer conversations will appear here as soon as portal messaging begins."
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

function ConversationThread({ selectedThread }: { selectedThread: ThreadAccount }) {
  const groupedMessages = selectedThread.messages.reduce<{ key: string; items: PortalMessage[] }[]>(
    (groups, entry) => {
      const label = new Date(entry.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const last = groups[groups.length - 1];
      if (!last || last.key !== label) groups.push({ key: label, items: [entry] });
      else last.items.push(entry);
      return groups;
    },
    []
  );

  if (!groupedMessages.length) {
    return (
      <AdminEmptyState
        title="No messages in this thread"
        description="This buyer has not started a portal conversation yet."
      />
    );
  }

  return (
    <div className="space-y-8">
      {groupedMessages.map((group) => (
        <div key={group.key}>
          <div className="mb-4">
            <span className="inline-flex rounded-full border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
              {group.key}
            </span>
          </div>

          <div className="space-y-4">
            {group.items.map((entry) => {
              const isAdminSender = entry.sender === "admin";
              return (
                <div key={entry.id} className={`flex ${isAdminSender ? "justify-end" : "justify-start"}`}>
                  <div
                    className={[
                      "max-w-[85%] rounded-[28px] border px-5 py-4 shadow-[0_10px_24px_rgba(106,76,45,0.05)]",
                      isAdminSender
                        ? "border-[#d8c2a8] bg-[linear-gradient(180deg,#6b4d33_0%,#5a3f2d_100%)] text-white"
                        : "border-[var(--portal-border)] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2e9_100%)] text-[var(--portal-text)]",
                    ].join(" ")}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div
                        className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
                          isAdminSender ? "text-white/70" : "text-[var(--portal-text-muted)]"
                        }`}
                      >
                        {isAdminSender ? "Admin" : selectedThread.displayName || "Buyer"}
                      </div>
                      <div className={`text-[10px] ${isAdminSender ? "text-white/60" : "text-[#8d6f52]"}`}>
                        {new Date(entry.created_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>

                    {entry.subject ? (
                      <div
                        className={`mt-2 text-sm font-semibold ${
                          isAdminSender ? "text-white" : "text-[var(--portal-text)]"
                        }`}
                      >
                        {entry.subject}
                      </div>
                    ) : null}

                    <div
                      className={`mt-3 whitespace-pre-wrap text-sm leading-7 ${
                        isAdminSender ? "text-white/92" : "text-[var(--portal-text-soft)]"
                      }`}
                    >
                      {entry.message}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                          isAdminSender
                            ? "border border-white/15 bg-white/10 text-white"
                            : `border ${adminStatusBadge(entry.status)}`
                        }`}
                      >
                        {entry.status || "open"}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                          isAdminSender
                            ? entry.read_by_user
                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border border-amber-200 bg-amber-50 text-amber-700"
                            : entry.read_by_admin
                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border border-amber-200 bg-amber-50 text-amber-700"
                        }`}
                      >
                        {isAdminSender
                          ? entry.read_by_user
                            ? "Read by buyer"
                            : "Unread by buyer"
                          : entry.read_by_admin
                            ? "Read by admin"
                            : "Unread by admin"}
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
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-[18px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3.5 text-sm text-[var(--portal-text)] outline-none focus:border-[#c8a884]"
      />
    </label>
  );
}
