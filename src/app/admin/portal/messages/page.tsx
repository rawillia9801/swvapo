"use client";

import React, { useEffect, useEffectEvent, useMemo, useState } from "react";
import {
  Loader2,
  Mail,
  RefreshCcw,
  Send,
  Sparkles,
} from "lucide-react";
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
import { fmtDate, sb } from "@/lib/utils";

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

type MessageTemplateRecord = {
  id: number | null;
  templateKey: string;
  category: string;
  label: string;
  description: string;
  channel: string;
  provider: string;
  subject: string;
  body: string;
  automationEnabled: boolean;
  isActive: boolean;
  previewPayload: Record<string, unknown>;
  updatedAt: string | null;
};

type TemplateDraft = {
  id: number | null;
  templateKey: string;
  category: string;
  label: string;
  description: string;
  subject: string;
  body: string;
  previewPayload: string;
  automationEnabled: boolean;
  isActive: boolean;
};

function buildPreview(message: string | null | undefined) {
  const text = String(message || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > 90 ? `${text.slice(0, 90)}...` : text;
}

function templateDraftFromRecord(template: MessageTemplateRecord | null): TemplateDraft {
  return {
    id: template?.id ?? null,
    templateKey: template?.templateKey || "",
    category: template?.category || "custom",
    label: template?.label || "",
    description: template?.description || "",
    subject: template?.subject || "",
    body: template?.body || "",
    previewPayload: JSON.stringify(template?.previewPayload || {}, null, 2),
    automationEnabled: template?.automationEnabled ?? true,
    isActive: template?.isActive ?? true,
  };
}

function previewText(template: string, payloadText: string) {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(payloadText || "{}") as Record<string, unknown>;
  } catch {
    payload = {};
  }
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = payload[key];
    return value == null ? `{{${key}}}` : String(value);
  });
}

function extractTokens(value: string) {
  return Array.from(new Set(String(value || "").match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) || []))
    .map((token) => token.replace(/[{}]/g, "").trim())
    .filter(Boolean);
}

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

export default function AdminPortalMessagesPage() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const [activeTab, setActiveTab] = useState<"inbox" | "templates">("inbox");
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
  const [templates, setTemplates] = useState<MessageTemplateRecord[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesRefreshing, setTemplatesRefreshing] = useState(false);
  const [templateFeedback, setTemplateFeedback] = useState("");
  const [templateError, setTemplateError] = useState("");
  const [templateStorageWarning, setTemplateStorageWarning] = useState("");
  const [missingTemplateStorage, setMissingTemplateStorage] = useState(false);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>(templateDraftFromRecord(null));
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setActiveTab(params.get("tab") === "templates" ? "templates" : "inbox");
  }, []);

  const loadTemplateWorkspace = useEffectEvent(async (background = false) => {
    if (!accessToken) return;
    if (background && templates.length) setTemplatesRefreshing(true);
    else setTemplatesLoading(true);
    try {
      const response = await fetch("/api/admin/portal/message-templates", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        warning?: string;
        missingStorage?: boolean;
        templates?: MessageTemplateRecord[];
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not load the message templates.");
      }
      const nextTemplates = Array.isArray(payload.templates) ? payload.templates : [];
      setTemplates(nextTemplates);
      setMissingTemplateStorage(Boolean(payload.missingStorage));
      setTemplateStorageWarning(payload.warning || "");
      setSelectedTemplateKey((current) =>
        nextTemplates.some((template) => template.templateKey === current)
          ? current
          : nextTemplates[0]?.templateKey || ""
      );
      setTemplateError("");
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : "Could not load the message templates.");
    } finally {
      setTemplatesLoading(false);
      setTemplatesRefreshing(false);
    }
  });

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
      void loadTemplateWorkspace(false);
    } else if (!loading) {
      setThreadsLoading(false);
      setTemplatesLoading(false);
    }
  }, [accessToken, isAdmin, loading, loadInboxWorkspace, loadTemplateWorkspace]);

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

  const selectedTemplate =
    templates.find((template) => template.templateKey === selectedTemplateKey) || null;
  const templateTokens = Array.from(
    new Set([...extractTokens(templateDraft.subject), ...extractTokens(templateDraft.body)])
  );

  useEffect(() => {
    setTemplateDraft(templateDraftFromRecord(selectedTemplate));
  }, [selectedTemplate]);

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
      await loadInboxWorkspace(true);
      setSelectedKey(selectedThread.key);
      setStatusText("Admin message sent.");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not send the admin message.");
    } finally {
      setSending(false);
    }
  }

  async function saveTemplate() {
    if (!accessToken) return;
    setSavingTemplate(true);
    setTemplateFeedback("");
    setTemplateError("");
    try {
      const response = await fetch("/api/admin/portal/message-templates", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...templateDraft,
          previewPayload: templateDraft.previewPayload,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not save the message template.");
      }
      setTemplateFeedback("Message template saved.");
      await loadTemplateWorkspace(true);
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : "Could not save the message template.");
    } finally {
      setSavingTemplate(false);
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
        details="Only the approved owner emails can manage buyer conversations and breeder templates here."
      />
    );
  }

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-12">
        <AdminPageHero
          eyebrow="Messages"
          title="Buyer inbox and breeder template studio"
          description="Work buyer conversations and Resend-backed messaging from one polished admin surface instead of chasing threads or hardcoded files."
          actions={
            <>
              <AdminHeroPrimaryAction href="/admin/portal/documents">Open Documents</AdminHeroPrimaryAction>
              <AdminHeroSecondaryAction href="/admin/portal/buyers">Open Buyers</AdminHeroSecondaryAction>
            </>
          }
          aside={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("inbox")}
                className={`rounded-full border px-4 py-2 text-sm font-semibold ${activeTab === "inbox" ? "border-transparent bg-[var(--portal-accent)] text-white" : "border-[var(--portal-border)] bg-white text-[var(--portal-text-soft)]"}`}
              >
                Buyer Inbox
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("templates")}
                className={`rounded-full border px-4 py-2 text-sm font-semibold ${activeTab === "templates" ? "border-transparent bg-[var(--portal-accent)] text-white" : "border-[var(--portal-border)] bg-white text-[var(--portal-text-soft)]"}`}
              >
                Resend Templates
              </button>
            </div>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminInfoTile
            label="Buyer Threads"
            value={String(threads.length)}
            detail="Grouped buyer conversations with linked context."
          />
          <AdminInfoTile
            label="Unread Replies"
            value={String(threads.reduce((sum, thread) => sum + thread.unreadCount, 0))}
            detail="Buyer replies still waiting on breeder review."
          />
          <AdminInfoTile
            label="Templates"
            value={String(templates.length)}
            detail="Editable admin_message_templates records available in the portal."
          />
          <AdminInfoTile
            label="Automations On"
            value={String(templates.filter((template) => template.automationEnabled && template.isActive).length)}
            detail="Templates currently active for workflow use."
          />
        </div>

        {activeTab === "inbox" ? (
          <InboxWorkspace
            loading={loading || (threadsLoading && !threads.length)}
            refreshing={threadsRefreshing}
            loadingThread={loadingThread}
            threads={threads}
            filteredThreads={filteredThreads}
            selectedThread={selectedThread}
            selectedKey={selectedKey}
            search={search}
            subject={subject}
            message={message}
            statusText={statusText}
            sending={sending}
            onSearchChange={setSearch}
            onSubjectChange={setSubject}
            onMessageChange={setMessage}
            onSelectThread={setSelectedKey}
            onRefresh={() => void loadInboxWorkspace(true)}
            onSend={handleSendAdminMessage}
          />
        ) : (
          <TemplateWorkspace
            loading={loading || (templatesLoading && !templates.length && !missingTemplateStorage)}
            refreshing={templatesRefreshing}
            templates={templates}
            selectedTemplateKey={selectedTemplateKey}
            templateDraft={templateDraft}
            templateTokens={templateTokens}
            feedback={templateFeedback}
            error={templateError}
            storageWarning={templateStorageWarning}
            missingStorage={missingTemplateStorage}
            saving={savingTemplate}
            onRefresh={() => void loadTemplateWorkspace(true)}
            onSelectTemplate={setSelectedTemplateKey}
            onDraftChange={setTemplateDraft}
            onSave={() => void saveTemplate()}
          />
        )}
      </div>
    </AdminPageShell>
  );
}

function InboxWorkspace({
  loading,
  refreshing,
  loadingThread,
  threads,
  filteredThreads,
  selectedThread,
  selectedKey,
  search,
  subject,
  message,
  statusText,
  sending,
  onSearchChange,
  onSubjectChange,
  onMessageChange,
  onSelectThread,
  onRefresh,
  onSend,
}: {
  loading: boolean;
  refreshing: boolean;
  loadingThread: boolean;
  threads: ThreadAccount[];
  filteredThreads: ThreadAccount[];
  selectedThread: ThreadAccount | null;
  selectedKey: string;
  search: string;
  subject: string;
  message: string;
  statusText: string;
  sending: boolean;
  onSearchChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onMessageChange: (value: string) => void;
  onSelectThread: (value: string) => void;
  onRefresh: () => void;
  onSend: (event: React.FormEvent) => void;
}) {
  if (loading) {
    return (
      <div className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
        <div className="min-h-[680px] animate-pulse rounded-[1.6rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)]" />
        <div className="min-h-[680px] animate-pulse rounded-[1.6rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)]" />
      </div>
    );
  }

  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
      <AdminPanel
        title="Buyer Inbox"
        subtitle="Search by buyer, email, status, or recent message text. One row equals one buyer thread."
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search buyer conversations..."
              className="w-full rounded-[20px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3 text-sm text-[var(--portal-text)] outline-none focus:border-[#c8a884]"
            />
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-2 rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)]"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>

          <div className="space-y-3">
            {filteredThreads.length ? (
              filteredThreads.map((thread) => (
                <AdminListCard
                  key={thread.key}
                  selected={selectedKey === thread.key}
                  onClick={() => onSelectThread(thread.key)}
                  title={thread.displayName || "Buyer"}
                  subtitle={thread.email || "No email on file"}
                  meta={`${thread.messages.length} message${thread.messages.length === 1 ? "" : "s"} | ${thread.latestMessageAt ? fmtDate(thread.latestMessageAt) : "No activity yet"}`}
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
              <AdminInfoTile label="Unread" value={String(selectedThread.unreadCount)} detail={loadingThread ? "Updating read state..." : "Unread buyer replies"} />
              <AdminInfoTile label="Latest Activity" value={selectedThread.latestMessageAt ? fmtDate(selectedThread.latestMessageAt) : "-"} />
            </div>
            {statusText ? (
              <div className="mt-4 rounded-[18px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--portal-text-soft)]">
                {statusText}
              </div>
            ) : null}
          </AdminPanel>

          <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[380px_minmax(0,1fr)]">
            <AdminPanel title="Send Reply" subtitle="Reply directly to the selected buyer from the portal inbox.">
              <form onSubmit={onSend} className="space-y-4">
                <Field label="Subject" value={subject} onChange={onSubjectChange} />
                <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                  Message
                  <textarea
                    value={message}
                    onChange={(event) => onMessageChange(event.target.value)}
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

            <AdminPanel title="Conversation Thread" subtitle="Messages are grouped by day and stay attached to this buyer record.">
              <ConversationThread selectedThread={selectedThread} />
            </AdminPanel>
          </section>
        </div>
      ) : (
        <AdminPanel title="Conversation Snapshot" subtitle="Choose a buyer thread to begin.">
          <AdminEmptyState
            title={threads.length ? "No thread selected" : "No conversations yet"}
            description={threads.length ? "Choose a buyer inbox row from the left to review and reply." : "Buyer conversations will appear here as soon as portal messaging begins."}
          />
        </AdminPanel>
      )}
    </section>
  );
}

function TemplateWorkspace({
  loading,
  refreshing,
  templates,
  selectedTemplateKey,
  templateDraft,
  templateTokens,
  feedback,
  error,
  storageWarning,
  missingStorage,
  saving,
  onRefresh,
  onSelectTemplate,
  onDraftChange,
  onSave,
}: {
  loading: boolean;
  refreshing: boolean;
  templates: MessageTemplateRecord[];
  selectedTemplateKey: string;
  templateDraft: TemplateDraft;
  templateTokens: string[];
  feedback: string;
  error: string;
  storageWarning: string;
  missingStorage: boolean;
  saving: boolean;
  onRefresh: () => void;
  onSelectTemplate: (value: string) => void;
  onDraftChange: React.Dispatch<React.SetStateAction<TemplateDraft>>;
  onSave: () => void;
}) {
  if (loading) {
    return (
      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="min-h-[680px] animate-pulse rounded-[1.6rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)]" />
        <div className="min-h-[680px] animate-pulse rounded-[1.6rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)]" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <AdminPanel title="Resend Template Library" subtitle="Choose a template to edit subject, body, preview data, and automation state.">
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)]"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => {
              onSelectTemplate("");
              onDraftChange({
                id: null,
                templateKey: "",
                category: "custom",
                label: "",
                description: "",
                subject: "",
                body: "",
                previewPayload: "{\n  \"buyer_name\": \"Cristy\",\n  \"puppy_name\": \"Baby Girl Frey\"\n}",
                automationEnabled: true,
                isActive: true,
              });
            }}
            className="inline-flex items-center gap-2 rounded-[1rem] bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] px-4 py-3 text-sm font-semibold text-white"
          >
            <Sparkles className="h-4 w-4" />
            New Template
          </button>
        </div>

        {storageWarning ? (
          <div className="mb-4 rounded-[1.1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {storageWarning}
          </div>
        ) : null}

        <div className="space-y-3">
          {templates.length ? (
            templates.map((template) => (
              <button
                key={template.templateKey}
                type="button"
                onClick={() => onSelectTemplate(template.templateKey)}
                className={`block w-full rounded-[1rem] border px-4 py-3 text-left ${selectedTemplateKey === template.templateKey ? "border-[var(--portal-accent)] bg-[var(--portal-surface-muted)]" : "border-[var(--portal-border)] bg-white"}`}
              >
                <div className="font-semibold text-[var(--portal-text)]">{template.label}</div>
                <div className="mt-1 text-xs text-[var(--portal-text-soft)]">{template.category} | {template.provider}</div>
              </button>
            ))
          ) : (
            <AdminEmptyState
              title={missingStorage ? "Template storage is not installed" : "No templates yet"}
              description={missingStorage ? "Apply the workspace migration to enable editable Resend templates." : "Create the first breeder-facing template from this studio."}
            />
          )}
        </div>
      </AdminPanel>

      <AdminPanel title="Template Studio" subtitle="Edit the real admin_message_templates content with live token preview.">
        <div className="space-y-4">
          {feedback ? (
            <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {feedback}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Template key" value={templateDraft.templateKey} onChange={(value) => onDraftChange((current) => ({ ...current, templateKey: value }))} />
            <Field label="Label" value={templateDraft.label} onChange={(value) => onDraftChange((current) => ({ ...current, label: value }))} />
            <Field label="Category" value={templateDraft.category} onChange={(value) => onDraftChange((current) => ({ ...current, category: value }))} />
            <Field label="Status" value={templateDraft.isActive ? "active" : "inactive"} onChange={(value) => onDraftChange((current) => ({ ...current, isActive: value.trim().toLowerCase() !== "inactive" }))} />
          </div>

          <TextArea label="Description" value={templateDraft.description} onChange={(value) => onDraftChange((current) => ({ ...current, description: value }))} rows={2} />
          <Field label="Subject" value={templateDraft.subject} onChange={(value) => onDraftChange((current) => ({ ...current, subject: value }))} />
          <TextArea label="Body" value={templateDraft.body} onChange={(value) => onDraftChange((current) => ({ ...current, body: value }))} rows={12} />
          <TextArea label="Preview payload JSON" value={templateDraft.previewPayload} onChange={(value) => onDraftChange((current) => ({ ...current, previewPayload: value }))} rows={8} />

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">Preview subject</div>
              <div className="mt-2 font-semibold text-[var(--portal-text)]">{previewText(templateDraft.subject, templateDraft.previewPayload)}</div>
              <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">Preview body</div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--portal-text-soft)]">{previewText(templateDraft.body, templateDraft.previewPayload)}</div>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-white p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">Variables in use</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {templateTokens.length ? (
                  templateTokens.map((token) => (
                    <span key={token} className="rounded-full border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--portal-text-soft)]">
                      {token}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[var(--portal-text-soft)]">No variables detected yet.</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onSave}
              disabled={saving || missingStorage}
              className="inline-flex items-center gap-2 rounded-[1rem] bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {saving ? "Saving..." : "Save template"}
            </button>
            <div className="rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm text-[var(--portal-text-soft)]">
              Templates here persist to <code>admin_message_templates</code> and are intended for Resend-backed breeder messaging.
            </div>
          </div>
        </div>
      </AdminPanel>
    </div>
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
                          isAdmin ? "border border-white/15 bg-white/10 text-white" : `border ${adminStatusBadge(entry.status)}`
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

function TextArea({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="mt-2 w-full rounded-[18px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3.5 text-sm text-[var(--portal-text)] outline-none focus:border-[#c8a884]"
      />
    </label>
  );
}
