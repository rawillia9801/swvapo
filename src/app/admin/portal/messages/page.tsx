"use client";

import React, { useEffect, useMemo, useState } from "react";
import { sb, fmtDate } from "@/lib/utils";

type BuyerRow = {
  id: number;
  email: string | null;
  buyer_email?: string | null;
  full_name?: string | null;
  name?: string | null;
  user_id?: string | null;
};

type ApplicationRow = {
  id: number;
  created_at: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
  applicant_email: string | null;
  status: string | null;
};

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

type PortalUser = {
  key: string;
  userId: string | null;
  email: string;
  displayName: string;
  buyer: BuyerRow | null;
  application: ApplicationRow | null;
  messages: PortalMessage[];
  unreadCount: number;
  latestMessageAt: string | null;
  latestMessagePreview: string;
};

function normalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (String(value || "").trim()) return String(value).trim();
  }
  return "";
}

function buildPreview(message: string | null | undefined) {
  const text = String(message || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > 90 ? `${text.slice(0, 90)}...` : text;
}

export default function AdminPortalMessagesPage() {
  const [user, setUser] = useState<any>(null);
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

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
          await loadAdminMessages();
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: authListener } = sb.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      if (!mounted) return;

      setUser(currentUser);

      if (currentUser) {
        await loadAdminMessages();
      } else {
        setPortalUsers([]);
        setSelectedKey("");
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function loadAdminMessages(preserveSelected = true) {
    setStatusText("Loading portal messages...");

    try {
      const [buyersRes, appsRes, messagesRes] = await Promise.all([
        sb
          .from("buyers")
          .select("id,email,buyer_email,full_name,name,user_id")
          .order("id", { ascending: false }),
        sb
          .from("puppy_applications")
          .select("id,created_at,user_id,full_name,email,applicant_email,status")
          .order("created_at", { ascending: false }),
        sb
          .from("portal_messages")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      const buyers = (buyersRes.data || []) as BuyerRow[];
      const apps = (appsRes.data || []) as ApplicationRow[];
      const messages = (messagesRes.data || []) as PortalMessage[];

      const accountMap = new Map<string, PortalUser>();

      const ensureUser = (seed: {
        userId?: string | null;
        email?: string | null;
        displayName?: string | null;
        buyer?: BuyerRow | null;
        application?: ApplicationRow | null;
      }) => {
        const userId = String(seed.userId || "").trim() || null;
        const email = normalizeEmail(seed.email);
        if (!userId && !email) return null;

        const key = userId || email;
        const existing = accountMap.get(key);

        if (existing) {
          if (!existing.userId && userId) existing.userId = userId;
          if (!existing.email && email) existing.email = email;
          if (!existing.displayName && seed.displayName) {
            existing.displayName = String(seed.displayName);
          }
          if (!existing.buyer && seed.buyer) existing.buyer = seed.buyer;
          if (!existing.application && seed.application) existing.application = seed.application;
          return existing;
        }

        const created: PortalUser = {
          key,
          userId,
          email,
          displayName: String(seed.displayName || ""),
          buyer: seed.buyer || null,
          application: seed.application || null,
          messages: [],
          unreadCount: 0,
          latestMessageAt: null,
          latestMessagePreview: "",
        };

        accountMap.set(key, created);
        return created;
      };

      for (const buyer of buyers) {
        const email = firstNonEmpty(buyer.email, buyer.buyer_email);
        const displayName = firstNonEmpty(buyer.full_name, buyer.name, email, "Portal User");

        ensureUser({
          userId: buyer.user_id || null,
          email,
          displayName,
          buyer,
        });
      }

      for (const app of apps) {
        const email = firstNonEmpty(app.email, app.applicant_email);
        const displayName = firstNonEmpty(app.full_name, email, "Portal User");

        ensureUser({
          userId: app.user_id || null,
          email,
          displayName,
          application: app,
        });
      }

      for (const msg of messages) {
        const email = normalizeEmail(msg.user_email);
        const userId = String(msg.user_id || "").trim() || null;

        const seeded = ensureUser({
          userId,
          email,
          displayName: firstNonEmpty(email, "Portal User"),
        });

        if (!seeded) continue;
        seeded.messages.push(msg);
      }

      const builtUsers = Array.from(accountMap.values())
        .map((portalUser) => {
          const sortedMessages = [...portalUser.messages].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );

          const unreadCount = sortedMessages.filter(
            (m) => m.sender === "user" && !m.read_by_admin
          ).length;

          const latest = sortedMessages.length
            ? sortedMessages[sortedMessages.length - 1]
            : null;

          return {
            ...portalUser,
            displayName:
              firstNonEmpty(
                portalUser.buyer?.full_name,
                portalUser.buyer?.name,
                portalUser.application?.full_name,
                portalUser.email,
                "Portal User"
              ) || "Portal User",
            messages: sortedMessages,
            unreadCount,
            latestMessageAt: latest?.created_at || null,
            latestMessagePreview: buildPreview(latest?.message || ""),
          };
        })
        .sort((a, b) => {
          if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;

          const aHasMessages = a.messages.length ? 1 : 0;
          const bHasMessages = b.messages.length ? 1 : 0;
          if (aHasMessages !== bHasMessages) return bHasMessages - aHasMessages;

          const aTime = a.latestMessageAt ? new Date(a.latestMessageAt).getTime() : 0;
          const bTime = b.latestMessageAt ? new Date(b.latestMessageAt).getTime() : 0;
          if (aTime !== bTime) return bTime - aTime;

          return a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase());
        });

      setPortalUsers(builtUsers);

      const nextSelected =
        preserveSelected && builtUsers.find((x) => x.key === selectedKey)
          ? selectedKey
          : builtUsers[0]?.key || "";

      setSelectedKey(nextSelected);
      setStatusText("");
    } catch (error) {
      console.error("Admin portal messages load failed:", error);
      setPortalUsers([]);
      setSelectedKey("");
      setStatusText("Unable to load portal users or messages.");
    }
  }

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return portalUsers;

    return portalUsers.filter((portalUser) => {
      const haystack = [
        portalUser.displayName,
        portalUser.email,
        portalUser.application?.status || "",
        portalUser.latestMessagePreview || "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [portalUsers, search]);

  const selectedUser =
    portalUsers.find((portalUser) => portalUser.key === selectedKey) ||
    filteredUsers[0] ||
    null;

  useEffect(() => {
    if (!selectedUser) return;

    const unreadUserMessages = selectedUser.messages.filter(
      (m) => m.sender === "user" && !m.read_by_admin
    );

    if (!unreadUserMessages.length) return;

    markThreadReadByAdmin(selectedUser);
  }, [selectedKey]);

  async function markThreadReadByAdmin(portalUser: PortalUser) {
    const unreadIds = portalUser.messages
      .filter((m) => m.sender === "user" && !m.read_by_admin)
      .map((m) => m.id);

    if (!unreadIds.length) return;

    setLoadingThread(true);

    try {
      const { error } = await sb
        .from("portal_messages")
        .update({ read_by_admin: true })
        .in("id", unreadIds);

      if (!error) {
        setPortalUsers((prev) =>
          prev.map((u) => {
            if (u.key !== portalUser.key) return u;

            const updatedMessages = u.messages.map((m) =>
              unreadIds.includes(m.id) ? { ...m, read_by_admin: true } : m
            );

            return {
              ...u,
              messages: updatedMessages,
              unreadCount: updatedMessages.filter(
                (m) => m.sender === "user" && !m.read_by_admin
              ).length,
            };
          })
        );
      }
    } catch (error) {
      console.error("markThreadReadByAdmin failed:", error);
    } finally {
      setLoadingThread(false);
    }
  }

  async function handleRefresh() {
    await loadAdminMessages();
  }

  async function handleSendAdminMessage(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedUser) {
      setStatusText("Select a portal user first.");
      return;
    }

    if (!message.trim()) {
      setStatusText("Please enter a message.");
      return;
    }

    setSending(true);
    setStatusText("");

    try {
      const payload = {
        user_id: selectedUser.userId || null,
        user_email: selectedUser.email || null,
        subject: subject.trim() || null,
        message: message.trim(),
        status: "open",
        read_by_admin: true,
        read_by_user: false,
        sender: "admin",
      };

      const { error } = await sb.from("portal_messages").insert(payload);

      if (error) {
        setStatusText(error.message || "Unable to send admin message.");
        setSending(false);
        return;
      }

      setSubject("");
      setMessage("");
      await loadAdminMessages();
      setSelectedKey(selectedUser.key);
      setStatusText("Admin message sent.");
    } catch (error) {
      console.error(error);
      setStatusText("Unable to send admin message.");
    } finally {
      setSending(false);
    }
  }

  async function handleSignOut() {
    await sb.auth.signOut();
    setUser(null);
    setPortalUsers([]);
    setSelectedKey("");
  }

  const groupedMessages = useMemo(() => {
    if (!selectedUser?.messages?.length) return [];

    const groups: { key: string; items: PortalMessage[] }[] = [];

    for (const msg of selectedUser.messages) {
      const label = new Date(msg.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      const last = groups[groups.length - 1];
      if (!last || last.key !== label) {
        groups.push({ key: label, items: [msg] });
      } else {
        last.items.push(msg);
      }
    }

    return groups;
  }, [selectedUser]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50 italic">
        Loading Admin Messages...
      </div>
    );
  }

  if (!user) {
    return <AdminMessagesLogin />;
  }

  return (
    <div className="min-h-screen text-brand-900 bg-brand-50">
      <main className="relative flex flex-col bg-texturePaper">
        <div className="w-full max-w-[1700px] mx-auto p-6 md:p-10 lg:p-12">
          <div className="space-y-8 pb-14">
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-5">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-brand-200 shadow-paper">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                    Admin Portal
                  </span>
                  <span className="w-1 h-1 rounded-full bg-brand-300" />
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                    Messages
                  </span>
                </div>

                <h2 className="mt-5 font-serif text-4xl md:text-5xl font-bold text-brand-900 leading-[0.95]">
                  Portal Messages
                </h2>

                <p className="mt-2 text-brand-500 font-semibold max-w-3xl">
                  View all portal users, see who has active message threads, and reply directly as
                  admin.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] bg-white border border-brand-200 text-brand-700">
                  Users: {portalUsers.length}
                </span>

                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] bg-white border border-brand-200 text-brand-700">
                  Unread: {portalUsers.reduce((sum, u) => sum + u.unreadCount, 0)}
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

            {statusText ? (
              <div className="text-sm font-semibold text-brand-600">{statusText}</div>
            ) : null}

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              <div className="xl:col-span-4 2xl:col-span-4 space-y-6">
                <div className="card-luxury p-7">
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <div>
                      <h3 className="font-serif text-2xl font-bold text-brand-900">
                        Portal Users
                      </h3>
                      <p className="text-brand-500 font-semibold text-sm mt-1">
                        Highlighted when messages exist.
                      </p>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-400">
                      Select One
                    </span>
                  </div>

                  <div className="mb-5">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search name, email, status, message..."
                      className="w-full rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm text-brand-900 outline-none"
                    />
                  </div>

                  <div className="space-y-3 max-h-[900px] overflow-y-auto pr-1">
                    {filteredUsers.length ? (
                      filteredUsers.map((portalUser) => {
                        const isSelected = selectedUser?.key === portalUser.key;
                        const hasMessages = portalUser.messages.length > 0;
                        const hasUnread = portalUser.unreadCount > 0;

                        return (
                          <button
                            key={portalUser.key}
                            type="button"
                            onClick={() => setSelectedKey(portalUser.key)}
                            className={`w-full text-left rounded-2xl border p-4 transition ${
                              isSelected
                                ? "border-brand-400 bg-brand-50 shadow-paper"
                                : hasUnread
                                  ? "border-amber-300 bg-amber-50/70 hover:bg-amber-50"
                                  : hasMessages
                                    ? "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50/60"
                                    : "border-brand-200 bg-white/75 hover:bg-white"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-black text-brand-900 break-words">
                                  {portalUser.displayName || "Portal User"}
                                </div>

                                <div className="mt-1 text-[12px] text-brand-500 font-semibold break-all">
                                  {portalUser.email || "No email"}
                                </div>
                              </div>

                              <div className="shrink-0 flex flex-col gap-2 items-end">
                                {hasUnread ? (
                                  <span className="inline-flex px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-black uppercase tracking-[0.18em]">
                                    {portalUser.unreadCount} unread
                                  </span>
                                ) : hasMessages ? (
                                  <span className="inline-flex px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-[0.18em]">
                                    Has Messages
                                  </span>
                                ) : (
                                  <span className="inline-flex px-2.5 py-1 rounded-full bg-white text-brand-500 border border-brand-200 text-[10px] font-black uppercase tracking-[0.18em]">
                                    No Messages
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                              <div>
                                <div className="font-black uppercase tracking-[0.18em] text-brand-500">
                                  App Status
                                </div>
                                <div className="mt-1 font-semibold text-brand-800">
                                  {portalUser.application?.status || "—"}
                                </div>
                              </div>

                              <div>
                                <div className="font-black uppercase tracking-[0.18em] text-brand-500">
                                  Last Message
                                </div>
                                <div className="mt-1 font-semibold text-brand-800">
                                  {portalUser.latestMessageAt
                                    ? fmtDate(portalUser.latestMessageAt)
                                    : "—"}
                                </div>
                              </div>
                            </div>

                            {portalUser.latestMessagePreview ? (
                              <div className="mt-3 text-[12px] text-brand-600 font-semibold leading-relaxed">
                                {portalUser.latestMessagePreview}
                              </div>
                            ) : null}
                          </button>
                        );
                      })
                    ) : (
                      <div className="text-center py-12 text-brand-400 text-sm italic">
                        No portal users found.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="xl:col-span-8 2xl:col-span-8 space-y-6">
                {selectedUser ? (
                  <>
                    <div className="card-luxury p-7">
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                            Selected User
                          </div>
                          <h3 className="mt-2 font-serif text-3xl font-bold text-brand-900">
                            {selectedUser.displayName || "Portal User"}
                          </h3>
                          <p className="mt-2 text-brand-500 font-semibold break-all">
                            {selectedUser.email || "No email on file"}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex px-3 py-1 rounded-full bg-white border border-brand-200 text-[10px] font-black uppercase tracking-[0.18em] text-brand-700">
                            Application: {selectedUser.application?.status || "—"}
                          </span>
                          <span className="inline-flex px-3 py-1 rounded-full bg-white border border-brand-200 text-[10px] font-black uppercase tracking-[0.18em] text-brand-700">
                            Messages: {selectedUser.messages.length}
                          </span>
                          <span className="inline-flex px-3 py-1 rounded-full bg-white border border-brand-200 text-[10px] font-black uppercase tracking-[0.18em] text-brand-700">
                            Unread: {selectedUser.unreadCount}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6">
                      <div className="2xl:col-span-5">
                        <div className="card-luxury p-7 sticky top-6">
                          <div className="flex items-center justify-between gap-3 mb-5">
                            <h3 className="font-serif text-2xl font-bold text-brand-900">
                              Send Admin Reply
                            </h3>
                            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-400">
                              Portal Support
                            </span>
                          </div>

                          <form onSubmit={handleSendAdminMessage} className="space-y-4">
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
                                rows={8}
                                placeholder="Write your reply here..."
                                className="w-full rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm text-brand-900 outline-none resize-none"
                                required
                              />
                            </div>

                            <div className="rounded-2xl border border-brand-200 bg-white/60 p-4">
                              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
                                Replying To
                              </div>
                              <div className="mt-1 text-sm font-black text-brand-900 break-all">
                                {selectedUser.email || "No email"}
                              </div>
                            </div>

                            <button
                              type="submit"
                              disabled={sending}
                              className="w-full px-6 py-3 rounded-xl bg-brand-800 text-white font-black text-xs uppercase tracking-[0.18em] hover:bg-brand-700 transition shadow-lift disabled:opacity-60"
                            >
                              {sending ? "Sending..." : "Send Admin Message"}
                            </button>
                          </form>
                        </div>
                      </div>

                      <div className="2xl:col-span-7">
                        <div className="card-luxury p-7">
                          <div className="flex items-center justify-between gap-3 mb-6">
                            <h3 className="font-serif text-2xl font-bold text-brand-900">
                              Conversation
                            </h3>
                            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-400">
                              {loadingThread ? "Updating read status..." : "Thread View"}
                            </span>
                          </div>

                          {!selectedUser.messages.length ? (
                            <div className="text-center py-16">
                              <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl border border-brand-200">
                                💬
                              </div>
                              <h4 className="font-serif text-3xl font-bold text-brand-800">
                                No Messages Yet
                              </h4>
                              <p className="text-brand-500 mt-3 max-w-md mx-auto text-sm font-semibold leading-relaxed">
                                This portal user has not started a conversation yet.
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
                                          className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                                        >
                                          <div
                                            className={`max-w-[88%] rounded-3xl px-5 py-4 border shadow-paper ${
                                              isAdmin
                                                ? "bg-brand-800 border-brand-800 text-white"
                                                : "bg-white border-brand-200 text-brand-900"
                                            }`}
                                          >
                                            <div className="flex items-center justify-between gap-4 mb-2">
                                              <div
                                                className={`text-[10px] font-black uppercase tracking-[0.18em] ${
                                                  isAdmin ? "text-white/70" : "text-brand-500"
                                                }`}
                                              >
                                                {isAdmin ? "Admin" : selectedUser.displayName || "User"}
                                              </div>

                                              <div
                                                className={`text-[10px] font-semibold ${
                                                  isAdmin ? "text-white/60" : "text-brand-400"
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
                                                  isAdmin ? "text-white" : "text-brand-800"
                                                }`}
                                              >
                                                {m.subject}
                                              </div>
                                            ) : null}

                                            <div
                                              className={`text-sm leading-relaxed font-semibold whitespace-pre-wrap ${
                                                isAdmin ? "text-white" : "text-brand-800"
                                              }`}
                                            >
                                              {m.message}
                                            </div>

                                            <div className="mt-3 flex items-center gap-2 flex-wrap">
                                              <span
                                                className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] ${
                                                  isAdmin
                                                    ? "bg-white/10 text-white border border-white/20"
                                                    : "bg-brand-50 text-brand-600 border border-brand-200"
                                                }`}
                                              >
                                                {m.status || "open"}
                                              </span>

                                              {isAdmin ? (
                                                <span
                                                  className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] ${
                                                    m.read_by_user
                                                      ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                                      : "bg-amber-100 text-amber-700 border border-amber-200"
                                                  }`}
                                                >
                                                  {m.read_by_user ? "Read by user" : "Unread by user"}
                                                </span>
                                              ) : (
                                                <span
                                                  className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] ${
                                                    m.read_by_admin
                                                      ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                                      : "bg-amber-100 text-amber-700 border border-amber-200"
                                                  }`}
                                                >
                                                  {m.read_by_admin ? "Read by admin" : "Unread by admin"}
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
                  </>
                ) : (
                  <div className="card-luxury p-12 text-center">
                    <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl border border-brand-200">
                      👤
                    </div>
                    <h3 className="font-serif text-3xl font-bold text-brand-800">
                      No Portal User Selected
                    </h3>
                    <p className="text-brand-500 mt-3 max-w-md mx-auto text-sm font-semibold leading-relaxed">
                      Select a portal user to review and reply to messages.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function AdminMessagesLogin() {
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