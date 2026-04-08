"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
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
import { fetchAdminAccounts, type AdminPortalAccount, adminFirstValue, adminNormalizeEmail } from "@/lib/admin-portal";
import { fmtDate, sb } from "@/lib/utils";
import { isPortalAdminEmail } from "@/lib/portal-admin";

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

export default function AdminPortalMessagesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [threads, setThreads] = useState<ThreadAccount[]>([]);
  const [selectedKey, setSelectedKey] = useState("");

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const {
          data: { session },
        } = await sb.auth.getSession();

        if (!mounted) return;
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setAccessToken(session?.access_token || "");

        if (currentUser && isPortalAdminEmail(currentUser.email)) {
          const nextThreads = await loadThreads(session?.access_token || "");
          setThreads(nextThreads);
          setSelectedKey(nextThreads[0]?.key || "");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void bootstrap();

    const { data: authListener } = sb.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setAccessToken(session?.access_token || "");

      if (currentUser && isPortalAdminEmail(currentUser.email)) {
        const nextThreads = await loadThreads(session?.access_token || "");
        setThreads(nextThreads);
        setSelectedKey((prev) =>
          nextThreads.find((thread) => thread.key === prev)?.key || nextThreads[0]?.key || ""
        );
      } else {
        setThreads([]);
        setSelectedKey("");
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function loadThreads(token: string) {
    const [accounts, messagesRes] = await Promise.all([
      fetchAdminAccounts(token),
      sb.from("portal_messages").select("*").order("created_at", { ascending: false }),
    ]);

    const messages = (messagesRes.data || []) as PortalMessage[];
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

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
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
        .includes(q)
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
    const unreadIds = selectedThread.messages
      .filter((entry) => entry.sender === "user" && !entry.read_by_admin)
      .map((entry) => entry.id);

    if (!unreadIds.length) return;

    const markRead = async () => {
      setLoadingThread(true);
      try {
        const { error } = await sb.from("portal_messages").update({ read_by_admin: true }).in("id", unreadIds);
        if (!error) {
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
  }, [selectedThread]);

  async function handleRefresh() {
    const nextThreads = await loadThreads(accessToken);
    setThreads(nextThreads);
    setSelectedKey((prev) => nextThreads.find((thread) => thread.key === prev)?.key || nextThreads[0]?.key || "");
  }

  async function handleSendAdminMessage(e: React.FormEvent) {
    e.preventDefault();
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
      const { error } = await sb.from("portal_messages").insert({
        user_id: selectedThread.userId || null,
        user_email: selectedThread.email || null,
        subject: subject.trim() || null,
        message: message.trim(),
        status: "open",
        read_by_admin: true,
        read_by_user: false,
        sender: "admin",
      });

      if (error) throw error;

      setSubject("");
      setMessage("");
      await handleRefresh();
      setSelectedKey(selectedThread.key);
      setStatusText("Admin message sent.");
    } catch (error) {
      console.error(error);
      setStatusText("Could not send the admin message.");
    } finally {
      setSending(false);
    }
  }

  const groupedMessages = useMemo(() => {
    if (!selectedThread?.messages.length) return [];
    const groups: { key: string; items: PortalMessage[] }[] = [];

    selectedThread.messages.forEach((entry) => {
      const label = new Date(entry.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const last = groups[groups.length - 1];
      if (!last || last.key !== label) groups.push({ key: label, items: [entry] });
      else last.items.push(entry);
    });

    return groups;
  }, [selectedThread]);

  if (loading) {
    return <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">Loading messages...</div>;
  }

  if (!user) {
    return (
      <AdminRestrictedState
        title="Sign in to access portal messages."
        details="This page is reserved for the Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!isPortalAdminEmail(user.email)) {
    return (
      <AdminRestrictedState
        title="This message workspace is limited to approved owner accounts."
        details="Only the approved owner emails can manage buyer conversations here."
      />
    );
  }

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-12">
        <AdminPageHero
          eyebrow="Messages"
          title="Buyer conversations stay grouped by buyer, not scattered by message."
          description="This tab is designed as a true buyer inbox so you can search by buyer and open one organized thread at a time."
          actions={
            <>
              <AdminHeroPrimaryAction href="/admin/portal/documents">Open Documents</AdminHeroPrimaryAction>
              <AdminHeroSecondaryAction href="/admin/users">Open Users</AdminHeroSecondaryAction>
            </>
          }
          aside={
            <div className="space-y-4">
              <AdminInfoTile
                label="Buyer Threads"
                value={String(threads.length)}
                detail="Each card represents one buyer or portal account thread."
              />
              <AdminInfoTile
                label="Unread Buyer Replies"
                value={String(threads.reduce((sum, thread) => sum + thread.unreadCount, 0))}
                detail="Unread buyer messages still waiting in the inbox."
              />
            </div>
          }
        />

        <AdminPanel
          title="Inbox Bench"
          subtitle="The message workspace should show which conversations need human response, cleanup, or buyer linking."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminInfoTile
              label="Buyer Threads"
              value={String(threads.length)}
              detail="Grouped conversations for portal families and unmatched portal contacts."
            />
            <AdminInfoTile
              label="Unread Replies"
              value={String(threads.reduce((sum, thread) => sum + thread.unreadCount, 0))}
              detail="Buyer replies still waiting on breeder review or response."
            />
            <AdminInfoTile
              label="Mapped to Buyer"
              value={String(threads.filter((thread) => !!thread.buyer).length)}
              detail={`${threads.filter((thread) => !thread.buyer).length} threads still need cleanup or buyer matching.`}
            />
            <AdminInfoTile
              label="Current Search"
              value={String(filteredThreads.length)}
              detail="Filtered thread count so you can work a focused inbox slice without losing context."
            />
          </div>
        </AdminPanel>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
          <AdminPanel
            title="Buyer Inbox Cards"
            subtitle="Search by buyer name, email, status, or recent message text. One card equals one buyer thread."
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search buyer conversations..."
              className="w-full rounded-[20px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3 text-sm text-[var(--portal-text)] outline-none focus:border-[#c8a884]"
            />

            <div className="mt-4 space-y-3">
              {filteredThreads.length ? (
                filteredThreads.map((thread) => (
                  <AdminListCard
                    key={thread.key}
                    selected={selectedKey === thread.key}
                    onClick={() => setSelectedKey(thread.key)}
                    title={thread.displayName || "Buyer"}
                    subtitle={thread.email || "No email on file"}
                    meta={`${thread.messages.length} message${thread.messages.length === 1 ? "" : "s"} • ${thread.latestMessageAt ? fmtDate(thread.latestMessageAt) : "No activity yet"}`}
                    badge={
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                          thread.unreadCount ? "border-amber-200 bg-amber-50 text-amber-700" : adminStatusBadge("read")
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
          </AdminPanel>

          {selectedThread ? (
            <div className="space-y-6">
              <AdminPanel
                title="Conversation Snapshot"
                subtitle="This buyer’s thread, read state, and reply workflow stay together here."
                action={
                  <button
                    type="button"
                    onClick={() => void handleRefresh()}
                    className="rounded-full border border-[#e5d2bc] bg-[var(--portal-surface-muted)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b8772f] transition hover:border-[#d8b48b]"
                  >
                    Refresh
                  </button>
                }
              >
                {statusText ? (
                  <div className="mb-4 rounded-[18px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--portal-text-soft)]">
                    {statusText}
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <AdminInfoTile label="Buyer" value={selectedThread.displayName || "Buyer"} />
                  <AdminInfoTile label="Email" value={selectedThread.email || "-"} />
                  <AdminInfoTile label="Unread" value={String(selectedThread.unreadCount)} detail={loadingThread ? "Updating read state..." : "Unread buyer replies"} />
                  <AdminInfoTile label="Latest Activity" value={selectedThread.latestMessageAt ? fmtDate(selectedThread.latestMessageAt) : "-"} />
                </div>
              </AdminPanel>

              <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[380px_minmax(0,1fr)]">
                <AdminPanel
                  title="Send Reply"
                  subtitle="Reply directly to the selected buyer from the portal inbox."
                >
                  <form onSubmit={handleSendAdminMessage} className="space-y-4">
                    <MessageField label="Subject" value={subject} onChange={setSubject} />
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                      Message
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={9}
                        className="mt-2 w-full rounded-[18px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3.5 text-sm normal-case tracking-normal text-[var(--portal-text)] outline-none focus:border-[#c8a884]"
                        required
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={sending}
                      className="w-full rounded-2xl bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(181,117,47,0.26)] transition hover:brightness-105 disabled:opacity-60"
                    >
                      {sending ? "Sending..." : "Send Admin Message"}
                    </button>
                  </form>
                </AdminPanel>

                <AdminPanel
                  title="Conversation Thread"
                  subtitle="Messages are grouped by day and stay attached to this single buyer card."
                >
                  {groupedMessages.length ? (
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
                              const isAdmin = entry.sender === "admin";
                              return (
                                <div key={entry.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                                  <div
                                    className={[
                                      "max-w-[85%] rounded-[28px] border px-5 py-4 shadow-[0_10px_24px_rgba(106,76,45,0.05)]",
                                      isAdmin
                                        ? "border-[#d8c2a8] bg-[linear-gradient(180deg,#6b4d33_0%,#5a3f2d_100%)] text-white"
                                        : "border-[var(--portal-border)] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2e9_100%)] text-[var(--portal-text)]",
                                    ].join(" ")}
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${isAdmin ? "text-white/70" : "text-[var(--portal-text-muted)]"}`}>
                                        {isAdmin ? "Admin" : selectedThread.displayName || "Buyer"}
                                      </div>
                                      <div className={`text-[10px] ${isAdmin ? "text-white/60" : "text-[#8d6f52]"}`}>
                                        {new Date(entry.created_at).toLocaleString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                          hour: "numeric",
                                          minute: "2-digit",
                                        })}
                                      </div>
                                    </div>

                                    {entry.subject ? (
                                      <div className={`mt-2 text-sm font-semibold ${isAdmin ? "text-white" : "text-[var(--portal-text)]"}`}>
                                        {entry.subject}
                                      </div>
                                    ) : null}

                                    <div className={`mt-3 whitespace-pre-wrap text-sm leading-7 ${isAdmin ? "text-white/92" : "text-[var(--portal-text-soft)]"}`}>
                                      {entry.message}
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                      <span
                                        className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                                          isAdmin
                                            ? "border border-white/15 bg-white/10 text-white"
                                            : `border ${adminStatusBadge(entry.status)}`
                                        }`}
                                      >
                                        {entry.status || "open"}
                                      </span>
                                      <span
                                        className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                                          isAdmin
                                            ? entry.read_by_user
                                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                                              : "border border-amber-200 bg-amber-50 text-amber-700"
                                            : entry.read_by_admin
                                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                                              : "border border-amber-200 bg-amber-50 text-amber-700"
                                        }`}
                                      >
                                        {isAdmin
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
                  ) : (
                    <AdminEmptyState
                      title="No messages in this thread"
                      description="This buyer has not started a portal conversation yet."
                    />
                  )}
                </AdminPanel>
              </section>
            </div>
          ) : (
            <AdminPanel
              title="Conversation Snapshot"
              subtitle="Choose a buyer thread to begin."
            >
              <AdminEmptyState
                title="No thread selected"
                description="Choose a buyer inbox card from the left to review and reply."
              />
            </AdminPanel>
          )}
        </section>
      </div>
    </AdminPageShell>
  );
}

function MessageField({
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
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-[18px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3.5 text-sm normal-case tracking-normal text-[var(--portal-text)] outline-none focus:border-[#c8a884]"
      />
    </label>
  );
}

