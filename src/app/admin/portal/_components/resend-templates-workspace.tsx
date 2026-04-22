"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Eye,
  Loader2,
  Mail,
  Plus,
  RefreshCcw,
  RotateCcw,
  Save,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import {
  AdminHeroPrimaryAction,
  AdminHeroSecondaryAction,
  AdminInfoTile,
  AdminPageHero,
  AdminPageShell,
  AdminPanel,
  AdminRestrictedState,
  adminStatusBadge,
} from "@/components/admin/luxury-admin-shell";
import {
  extractTemplateVariables,
  parseTemplatePayload,
  renderMessageTemplate,
} from "@/lib/message-template-renderer";
import {
  DEFAULT_RESEND_TEMPLATES,
  REQUIRED_RESEND_TEMPLATE_KEYS,
  RESEND_TEMPLATE_CATEGORIES,
  RESEND_TEMPLATE_CATEGORY_LABELS,
  type ResendTemplateCategory,
} from "@/lib/resend-template-defaults";
import { usePortalAdminSession } from "@/lib/use-portal-admin-session";
import { fmtDate } from "@/lib/utils";

type MessageTemplateRecord = {
  id: number;
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

type RecentDeliveryActivity = {
  id: number;
  buyerId: number | null;
  buyerName: string;
  puppyId: number | null;
  puppyName: string;
  noticeKind: string;
  recipientEmail: string;
  subject: string;
  status: string;
  providerMessageId: string | null;
  lastEventType: string | null;
  lastEventAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  openCount: number;
  clickCount: number;
  createdAt: string | null;
};

type RecentTestSend = {
  id: number;
  templateKey: string;
  category: string;
  label: string;
  recipientEmail: string;
  subject: string;
  status: string;
  providerMessageId: string | null;
  lastEventType: string | null;
  lastEventAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  openCount: number;
  clickCount: number;
  sentByEmail: string;
  renderMode: string;
  missingVariables: string[];
  createdAt: string | null;
};

type TemplatesWorkspaceResponse = {
  ok?: boolean;
  error?: string;
  warning?: string;
  missingStorage?: boolean;
  webhookConfigured?: boolean;
  testSendTrackingReady?: boolean;
  templates?: MessageTemplateRecord[];
  recentActivity?: RecentDeliveryActivity[];
  recentTestSends?: RecentTestSend[];
};

type TemplateDraft = {
  id: number | null;
  templateKey: string;
  category: string;
  label: string;
  description: string;
  provider: string;
  subject: string;
  body: string;
  previewPayload: string;
  automationEnabled: boolean;
  isActive: boolean;
};

const ALL_CATEGORIES = "all";
const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-[1rem] bg-[linear-gradient(135deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--portal-shadow-md)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-[1rem] border border-[var(--portal-border)] bg-white/92 px-4 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[var(--portal-shadow-sm)] transition hover:bg-[var(--portal-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60";

const subtleButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-[0.9rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--portal-text-soft)] transition hover:bg-white hover:text-[var(--portal-text)] disabled:cursor-not-allowed disabled:opacity-60";

function text(value: unknown) {
  return String(value || "").trim();
}

function categoryLabel(value: string) {
  return (
    RESEND_TEMPLATE_CATEGORY_LABELS[value as ResendTemplateCategory] ||
    value
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") ||
    "Other"
  );
}

function blankTemplateDraft(): TemplateDraft {
  return {
    id: null,
    templateKey: "",
    category: "buyer_lifecycle",
    label: "",
    description: "",
    provider: "resend",
    subject: "",
    body: "",
    previewPayload: "{}",
    automationEnabled: true,
    isActive: true,
  };
}

function draftFromDefault(templateKey: string): TemplateDraft {
  const template = DEFAULT_RESEND_TEMPLATES.find((entry) => entry.templateKey === templateKey);
  if (!template) return blankTemplateDraft();

  return {
    id: null,
    templateKey: template.templateKey,
    category: template.category,
    label: template.label,
    description: template.description,
    provider: "resend",
    subject: template.subject,
    body: template.body,
    previewPayload: JSON.stringify(template.previewPayload, null, 2),
    automationEnabled: true,
    isActive: true,
  };
}

function templateDraftFromRecord(template: MessageTemplateRecord | null): TemplateDraft {
  return {
    id: template?.id ?? null,
    templateKey: template?.templateKey || "",
    category: template?.category || "buyer_lifecycle",
    label: template?.label || "",
    description: template?.description || "",
    provider: template?.provider || "resend",
    subject: template?.subject || "",
    body: template?.body || "",
    previewPayload: JSON.stringify(template?.previewPayload || {}, null, 2),
    automationEnabled: template?.automationEnabled ?? true,
    isActive: template?.isActive ?? true,
  };
}

function normalizePayloadText(value: string) {
  const parsed = parseTemplatePayload(value);
  return parsed.ok ? parsed.normalized : value;
}

function draftSignature(draft: TemplateDraft) {
  return JSON.stringify({
    ...draft,
    previewPayload: normalizePayloadText(draft.previewPayload),
  });
}

function formatEventLabel(value: string | null | undefined) {
  const normalized = text(value).toLowerCase();
  if (!normalized) return "Sent";
  return normalized.replace(/^email\./, "").replace(/_/g, " ");
}

function prettyNoticeKind(value: string | null | undefined) {
  const normalized = text(value).replace(/_/g, " ").trim();
  if (!normalized) return "Notice";
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function compactDate(value: string | null | undefined) {
  return value ? fmtDate(value) : "-";
}

function templateStatusBadge(template: MessageTemplateRecord | TemplateDraft) {
  if (!template.isActive) return "Inactive";
  if (!template.automationEnabled) return "Manual";
  return "Automation";
}

function categoryAccent(category: string) {
  if (category === "payments") return "border-amber-200 bg-amber-50 text-amber-800";
  if (category === "documents") return "border-sky-200 bg-sky-50 text-sky-800";
  if (category === "transport") return "border-teal-200 bg-teal-50 text-teal-800";
  if (category === "puppy_updates") return "border-rose-200 bg-rose-50 text-rose-800";
  if (category === "relationship") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-violet-200 bg-violet-50 text-violet-800";
}

function nextDuplicateKey(baseKey: string, templates: MessageTemplateRecord[]) {
  const existing = new Set(templates.map((template) => template.templateKey));
  const root = `${baseKey || "resend_template"}_copy`;
  if (!existing.has(root)) return root;

  let index = 2;
  while (existing.has(`${root}_${index}`)) index += 1;
  return `${root}_${index}`;
}

export function ResendTemplatesWorkspace() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();

  const [templates, setTemplates] = useState<MessageTemplateRecord[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentDeliveryActivity[]>([]);
  const [recentTestSends, setRecentTestSends] = useState<RecentTestSend[]>([]);

  const [initializing, setInitializing] = useState(true);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const [statusText, setStatusText] = useState("");
  const [warningText, setWarningText] = useState("");
  const [testFeedback, setTestFeedback] = useState("");
  const [missingStorage, setMissingStorage] = useState(false);
  const [webhookConfigured, setWebhookConfigured] = useState(false);
  const [testSendTrackingReady, setTestSendTrackingReady] = useState(false);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>(() =>
    draftFromDefault("buyer_application_received")
  );
  const [testRecipient, setTestRecipient] = useState("");
  const [testMode, setTestMode] = useState<"draft" | "saved">("draft");

  const hasLoadedOnce = templates.length > 0 || recentActivity.length > 0 || recentTestSends.length > 0;
  const hasLoadedOnceRef = useRef(hasLoadedOnce);
  const initialLoadKeyRef = useRef("");

  useEffect(() => {
    hasLoadedOnceRef.current = hasLoadedOnce;
  }, [hasLoadedOnce]);

  useEffect(() => {
    if (!testRecipient && user?.email) {
      setTestRecipient(user.email);
    }
  }, [testRecipient, user?.email]);

  const loadWorkspace = useCallback(
    async (background = false) => {
      if (!accessToken) {
        setInitializing(false);
        setLoadingWorkspace(false);
        setRefreshing(false);
        return;
      }

      if (background) {
        setRefreshing(true);
      } else if (!hasLoadedOnceRef.current) {
        setLoadingWorkspace(true);
      } else {
        setRefreshing(true);
      }

      try {
        const response = await fetch("/api/admin/portal/message-templates", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });

        const payload = (await response.json()) as TemplatesWorkspaceResponse;

        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error || "Could not load the automatic email templates.");
        }

        const nextTemplates = payload.templates || [];
        setTemplates(nextTemplates);
        setRecentActivity(payload.recentActivity || []);
        setRecentTestSends(payload.recentTestSends || []);
        setMissingStorage(Boolean(payload.missingStorage));
        setWebhookConfigured(Boolean(payload.webhookConfigured));
        setTestSendTrackingReady(Boolean(payload.testSendTrackingReady));
        setWarningText(payload.warning || "");

        setStatusText((current) => {
          if (current.toLowerCase().includes("saved")) return current;
          if (current.toLowerCase().includes("test")) return current;
          return "";
        });

        setSelectedTemplateKey((current) => {
          if (current && nextTemplates.some((template) => template.templateKey === current)) {
            return current;
          }
          return nextTemplates[0]?.templateKey || "";
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not load the automatic email templates.";

        if (!hasLoadedOnceRef.current) {
          setStatusText(message);
        } else {
          setWarningText(message);
        }
      } finally {
        setInitializing(false);
        setLoadingWorkspace(false);
        setRefreshing(false);
      }
    },
    [accessToken]
  );

  useEffect(() => {
    if (!loading && accessToken && isAdmin) {
      if (initialLoadKeyRef.current === accessToken) return;
      initialLoadKeyRef.current = accessToken;
      void loadWorkspace(false);
      return;
    }

    if (!loading) {
      initialLoadKeyRef.current = "";
      setInitializing(false);
      setLoadingWorkspace(false);
      setRefreshing(false);
    }
  }, [accessToken, isAdmin, loading, loadWorkspace]);

  const selectedTemplate =
    templates.find((template) => template.templateKey === selectedTemplateKey) || null;

  useEffect(() => {
    if (selectedTemplate) {
      setTemplateDraft(templateDraftFromRecord(selectedTemplate));
      setTestFeedback("");
      return;
    }

    if (!templates.length && !selectedTemplateKey) {
      setTemplateDraft((current) =>
        current.templateKey || current.label || current.subject || current.body
          ? current
          : draftFromDefault("buyer_application_received")
      );
    }
  }, [selectedTemplate, selectedTemplateKey, templates.length]);

  const availableCategories = useMemo(() => {
    const currentCategories = new Set<string>(RESEND_TEMPLATE_CATEGORIES);
    templates.forEach((template) => {
      if (template.category) currentCategories.add(template.category);
    });
    return Array.from(currentCategories);
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();
    return templates.filter((template) => {
      const matchesCategory =
        categoryFilter === ALL_CATEGORIES || template.category === categoryFilter;
      if (!matchesCategory) return false;
      if (!query) return true;

      return [
        template.label,
        template.templateKey,
        template.category,
        template.description,
        template.subject,
        template.provider,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(query);
    });
  }, [categoryFilter, search, templates]);

  const missingDefaultTemplates = useMemo(() => {
    const existingKeys = new Set(templates.map((template) => template.templateKey));
    return DEFAULT_RESEND_TEMPLATES.filter((template) => !existingKeys.has(template.templateKey));
  }, [templates]);

  const payloadState = useMemo(
    () => parseTemplatePayload(templateDraft.previewPayload),
    [templateDraft.previewPayload]
  );
  const renderedPreview = useMemo(
    () =>
      renderMessageTemplate({
        subject: templateDraft.subject,
        body: templateDraft.body,
        payload: payloadState.ok ? payloadState.payload : {},
        missingMode: "mark",
      }),
    [payloadState, templateDraft.body, templateDraft.subject]
  );
  const templateTokens = useMemo(
    () => extractTemplateVariables(templateDraft.subject, templateDraft.body),
    [templateDraft.body, templateDraft.subject]
  );

  const hasDraftChanges = useMemo(() => {
    if (!selectedTemplate) {
      return draftSignature(templateDraft) !== draftSignature(blankTemplateDraft());
    }

    return draftSignature(templateDraft) !== draftSignature(templateDraftFromRecord(selectedTemplate));
  }, [selectedTemplate, templateDraft]);

  const activeTemplateCount = templates.filter((template) => template.isActive).length;
  const automationTemplateCount = templates.filter((template) => template.automationEnabled).length;
  const requiredTemplateCount = templates.filter((template) =>
    REQUIRED_RESEND_TEMPLATE_KEYS.includes(template.templateKey)
  ).length;
  const trackedActivityCount =
    recentActivity.filter((activity) => activity.lastEventType).length +
    recentTestSends.filter((activity) => activity.lastEventType).length;

  async function handleSave() {
    if (!accessToken || !payloadState.ok) return;

    setSaving(true);
    setStatusText("");

    try {
      const response = await fetch("/api/admin/portal/message-templates", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...templateDraft,
          previewPayload: payloadState.normalized,
        }),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "Could not save the template.");
      }

      setStatusText("Template saved.");
      await loadWorkspace(true);
      setSelectedTemplateKey(templateDraft.templateKey);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not save the template.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    if (!accessToken || !payloadState.ok) return;

    setSendingTest(true);
    setTestFeedback("");

    try {
      const response = await fetch("/api/admin/portal/message-templates/test-send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: testMode,
          recipientEmail: testRecipient,
          templateKey: templateDraft.templateKey,
          label: templateDraft.label,
          category: templateDraft.category,
          subject: templateDraft.subject,
          body: templateDraft.body,
          previewPayload: payloadState.normalized,
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        providerMessageId?: string | null;
        missingVariables?: string[];
      };

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "Could not send the test email.");
      }

      const missing = payload.missingVariables?.length
        ? ` Missing variables were marked: ${payload.missingVariables.join(", ")}.`
        : "";
      setTestFeedback(
        `Test email sent to ${testRecipient}.${payload.providerMessageId ? ` Resend id: ${payload.providerMessageId}.` : ""}${missing}`
      );
      await loadWorkspace(true);
    } catch (error) {
      setTestFeedback(error instanceof Error ? error.message : "Could not send the test email.");
    } finally {
      setSendingTest(false);
    }
  }

  function startNewTemplate() {
    setSelectedTemplateKey("");
    setTemplateDraft(blankTemplateDraft());
    setStatusText("");
    setTestFeedback("");
  }

  function duplicateCurrentTemplate() {
    setSelectedTemplateKey("");
    setTemplateDraft((current) => ({
      ...current,
      id: null,
      templateKey: nextDuplicateKey(current.templateKey, templates),
      label: current.label ? `${current.label} Copy` : "New Template",
      isActive: false,
      automationEnabled: false,
    }));
    setStatusText("Duplicated into a new inactive draft. Review the key, label, and content before saving.");
    setTestFeedback("");
  }

  if (!loading && !user) {
    return (
      <AdminRestrictedState
        title="Sign in to manage automatic email templates."
        details="This screen is reserved for the Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!loading && user && !isAdmin) {
    return (
      <AdminRestrictedState
        title="This template workspace is limited to approved owner accounts."
        details="Only approved owner emails can manage automatic Resend templates and test sends."
      />
    );
  }

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-10">
        <AdminPageHero
          eyebrow="Resend Templates"
          title="Automatic email templates and delivery tracking"
          description="This workspace manages outbound Resend automation content. Portal Messages remains the buyer inbox and reply surface."
          actions={
            <>
              <AdminHeroPrimaryAction href="/admin/portal/messages">
                Open Portal Messages
              </AdminHeroPrimaryAction>
              <AdminHeroSecondaryAction href="/admin/portal/puppy-financing">
                Open Financing
              </AdminHeroSecondaryAction>
            </>
          }
          aside={
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <AdminInfoTile
                label="Active Templates"
                value={String(activeTemplateCount)}
                detail={`${requiredTemplateCount}/${REQUIRED_RESEND_TEMPLATE_KEYS.length} core automation templates installed.`}
              />
              <AdminInfoTile
                label="Automation Ready"
                value={String(automationTemplateCount)}
                detail="Templates enabled for automated outbound workflow use."
              />
              <AdminInfoTile
                label="Tracked Events"
                value={String(trackedActivityCount)}
                detail="Delivery, open, click, bounce, or test-send events recorded."
              />
              <AdminInfoTile
                label="Webhook Tracking"
                value={webhookConfigured ? "Live" : "Needs Secret"}
                detail={
                  webhookConfigured
                    ? "Resend webhook events can update automatic and test sends."
                    : "Add the Resend webhook secret to capture opens and deliveries."
                }
              />
            </div>
          }
        />

        {warningText ? (
          <div className="rounded-[1.15rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            {warningText}
          </div>
        ) : null}

        {statusText ? (
          <div
            className={`rounded-[1.15rem] border px-4 py-3 text-sm font-medium ${
              statusText.toLowerCase().includes("saved") ||
              statusText.toLowerCase().includes("duplicated")
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {statusText}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
          <AdminPanel
            title="Template Library"
            subtitle="Outbound Resend automation templates only. Buyer conversations stay in Portal Messages."
            action={
              <button
                type="button"
                onClick={() => void loadWorkspace(true)}
                className={subtleButtonClass}
                disabled={refreshing || loadingWorkspace}
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Refresh
              </button>
            }
          >
            <div className="space-y-4">
              <div className="flex gap-2 rounded-[1rem] border border-[var(--portal-border)] bg-white px-3 py-2 shadow-[var(--portal-shadow-sm)]">
                <Search className="mt-1 h-4 w-4 shrink-0 text-[var(--portal-text-muted)]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search templates, keys, subjects..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-[var(--portal-text)] outline-none placeholder:text-[var(--portal-text-muted)]"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <CategoryFilterButton
                  active={categoryFilter === ALL_CATEGORIES}
                  label="All"
                  onClick={() => setCategoryFilter(ALL_CATEGORIES)}
                />
                {availableCategories.map((category) => (
                  <CategoryFilterButton
                    key={category}
                    active={categoryFilter === category}
                    label={categoryLabel(category)}
                    onClick={() => setCategoryFilter(category)}
                  />
                ))}
              </div>

              <button type="button" onClick={startNewTemplate} className={`${secondaryButtonClass} w-full`}>
                <Plus className="h-4 w-4" />
                Create Template
              </button>

              {loadingWorkspace && !hasLoadedOnce ? (
                <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-5 py-8 text-center text-sm text-[var(--portal-text-soft)]">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-[var(--portal-accent)]" />
                  <div className="mt-3 font-semibold text-[var(--portal-text)]">Loading template library</div>
                </div>
              ) : null}

              {!loadingWorkspace || hasLoadedOnce ? (
                <div className="max-h-[720px] space-y-3 overflow-y-auto pr-1">
                  {filteredTemplates.map((template) => (
                    <button
                      key={template.templateKey}
                      type="button"
                      onClick={() => setSelectedTemplateKey(template.templateKey)}
                      className={[
                        "block w-full rounded-[1.2rem] border px-4 py-4 text-left transition-all",
                        selectedTemplateKey === template.templateKey
                          ? "border-[var(--portal-border-strong)] bg-white shadow-[var(--portal-shadow-sm)]"
                          : "border-[var(--portal-border)] bg-[var(--portal-surface-muted)] hover:border-[var(--portal-border-strong)] hover:bg-white",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--portal-text)]">
                            {template.label || template.templateKey}
                          </div>
                          <div className="mt-1 truncate text-xs font-semibold text-[var(--portal-text-muted)]">
                            {template.templateKey}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${categoryAccent(
                            template.category
                          )}`}
                        >
                          {categoryLabel(template.category)}
                        </span>
                      </div>
                      <div className="mt-3 line-clamp-2 text-xs leading-5 text-[var(--portal-text-soft)]">
                        {template.description || template.subject}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${adminStatusBadge(
                            templateStatusBadge(template)
                          )}`}
                        >
                          {templateStatusBadge(template)}
                        </span>
                        <span className="rounded-full border border-[var(--portal-border)] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                          {template.provider || "resend"}
                        </span>
                      </div>
                    </button>
                  ))}

                  {!filteredTemplates.length ? (
                    <div className="rounded-[1.25rem] border border-dashed border-[var(--portal-border-strong)] bg-[var(--portal-surface-muted)] px-5 py-8 text-center">
                      <div className="text-sm font-semibold text-[var(--portal-text)]">
                        No templates match this view
                      </div>
                      <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                        Adjust the search or category filter to bring templates back into view.
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {missingDefaultTemplates.length ? (
                <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50/70 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-800">
                    Missing Core Templates
                  </div>
                  <div className="mt-2 text-sm leading-6 text-amber-900">
                    These default templates are available to add without replacing anything already saved.
                  </div>
                  <div className="mt-3 space-y-2">
                    {missingDefaultTemplates.slice(0, 5).map((template) => (
                      <button
                        key={template.templateKey}
                        type="button"
                        onClick={() => {
                          setSelectedTemplateKey("");
                          setTemplateDraft(draftFromDefault(template.templateKey));
                        }}
                        className="flex w-full items-center justify-between gap-3 rounded-[0.95rem] border border-amber-200 bg-white px-3 py-2 text-left text-xs font-semibold text-amber-950"
                      >
                        <span>{template.label}</span>
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </AdminPanel>

          <div className="space-y-6">
            <AdminPanel
              title="Template Editor"
              subtitle="Edit the actual key, category, subject, body, preview variables, and automation flags for Resend-backed outbound emails."
              action={
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setTemplateDraft(selectedTemplate ? templateDraftFromRecord(selectedTemplate) : blankTemplateDraft());
                      setStatusText("");
                      setTestFeedback("");
                    }}
                    className={secondaryButtonClass}
                    disabled={saving}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset Draft
                  </button>
                  <button
                    type="button"
                    onClick={duplicateCurrentTemplate}
                    className={secondaryButtonClass}
                    disabled={saving || !text(templateDraft.subject) || !text(templateDraft.body)}
                  >
                    <Copy className="h-4 w-4" />
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    className={primaryButtonClass}
                    disabled={
                      saving ||
                      missingStorage ||
                      !payloadState.ok ||
                      !text(templateDraft.templateKey) ||
                      !text(templateDraft.label) ||
                      !text(templateDraft.subject) ||
                      !text(templateDraft.body) ||
                      !hasDraftChanges
                    }
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? "Saving" : "Save Template"}
                  </button>
                </div>
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Template key"
                  value={templateDraft.templateKey}
                  onChange={(value) =>
                    setTemplateDraft((current) => ({ ...current, templateKey: value }))
                  }
                />
                <Field
                  label="Label"
                  value={templateDraft.label}
                  onChange={(value) =>
                    setTemplateDraft((current) => ({ ...current, label: value }))
                  }
                />
                <SelectField
                  label="Category"
                  value={templateDraft.category}
                  options={availableCategories}
                  onChange={(value) =>
                    setTemplateDraft((current) => ({ ...current, category: value }))
                  }
                />
                <Field
                  label="Provider"
                  value={templateDraft.provider}
                  onChange={(value) =>
                    setTemplateDraft((current) => ({ ...current, provider: value || "resend" }))
                  }
                />
              </div>

              <div className="mt-4">
                <TextArea
                  label="Description"
                  value={templateDraft.description}
                  onChange={(value) =>
                    setTemplateDraft((current) => ({ ...current, description: value }))
                  }
                  rows={3}
                />
              </div>

              <div className="mt-4">
                <Field
                  label="Subject"
                  value={templateDraft.subject}
                  onChange={(value) =>
                    setTemplateDraft((current) => ({ ...current, subject: value }))
                  }
                />
              </div>

              <div className="mt-4">
                <TextArea
                  label="Body"
                  value={templateDraft.body}
                  onChange={(value) =>
                    setTemplateDraft((current) => ({ ...current, body: value }))
                  }
                  rows={12}
                />
              </div>

              <div className="mt-4">
                <TextArea
                  label="Preview payload JSON"
                  value={templateDraft.previewPayload}
                  onChange={(value) =>
                    setTemplateDraft((current) => ({ ...current, previewPayload: value }))
                  }
                  rows={7}
                />
                <div className="mt-2 flex items-center gap-2 text-xs">
                  {payloadState.ok ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="text-emerald-700">Preview payload JSON is valid.</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span className="text-amber-700">
                        Preview payload JSON is invalid: {payloadState.error}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <ToggleCard
                  label="Automation enabled"
                  enabled={templateDraft.automationEnabled}
                  description="Use this template for automatic workflow sends when the related automation is active."
                  onToggle={() =>
                    setTemplateDraft((current) => ({
                      ...current,
                      automationEnabled: !current.automationEnabled,
                    }))
                  }
                />
                <ToggleCard
                  label="Template active"
                  enabled={templateDraft.isActive}
                  description="Inactive templates remain editable but are not preferred for outbound automation."
                  onToggle={() =>
                    setTemplateDraft((current) => ({
                      ...current,
                      isActive: !current.isActive,
                    }))
                  }
                />
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-4">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                    <Eye className="h-4 w-4" />
                    Template Preview
                  </div>
                  <div className="mt-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                      Subject
                    </div>
                    <div className="mt-2 text-base font-semibold text-[var(--portal-text)]">
                      {renderedPreview.subject || "No subject yet"}
                    </div>
                  </div>
                  <div className="mt-5">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                      Body
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--portal-text-soft)]">
                      {renderedPreview.body || "No body yet"}
                    </div>
                  </div>
                  {renderedPreview.missingVariables.length ? (
                    <div className="mt-4 rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      Missing variables are marked in the preview:{" "}
                      {renderedPreview.missingVariables.join(", ")}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-white p-4">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                      <Sparkles className="h-4 w-4" />
                      Variables
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {templateTokens.length ? (
                        templateTokens.map((token) => (
                          <span
                            key={token}
                            className="rounded-full border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--portal-text-soft)]"
                          >
                            {token}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-[var(--portal-text-soft)]">
                          No variables detected.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-white p-4">
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                      <Send className="h-4 w-4" />
                      Test Email
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                      Test-only send. This does not send to buyers automatically and does not save draft edits.
                    </p>
                    <div className="mt-4 space-y-3">
                      <Field
                        label="Test recipient"
                        value={testRecipient}
                        onChange={setTestRecipient}
                      />
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                        Send mode
                        <select
                          value={testMode}
                          onChange={(event) => setTestMode(event.target.value === "saved" ? "saved" : "draft")}
                          className="mt-2 w-full rounded-[18px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3.5 text-sm text-[var(--portal-text)] outline-none focus:border-[#c8a884]"
                        >
                          <option value="draft">Rendered editor draft</option>
                          <option value="saved">Saved template from database</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => void handleSendTest()}
                        className={`${primaryButtonClass} w-full`}
                        disabled={
                          sendingTest ||
                          !payloadState.ok ||
                          !text(testRecipient) ||
                          !text(templateDraft.subject) ||
                          !text(templateDraft.body) ||
                          (testMode === "saved" && !selectedTemplate)
                        }
                      >
                        {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {sendingTest ? "Sending Test" : "Send Test Email"}
                      </button>
                      {testFeedback ? (
                        <div
                          className={`rounded-[1rem] border px-4 py-3 text-sm ${
                            testFeedback.toLowerCase().includes("sent")
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-rose-200 bg-rose-50 text-rose-800"
                          }`}
                        >
                          {testFeedback}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {missingStorage ? (
                <div className="mt-4 rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Template storage is not installed yet, so saving is disabled until the migration is applied.
                </div>
              ) : null}
            </AdminPanel>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <AdminPanel
            title="Recent Resend Activity"
            subtitle="Automatic payment and reminder emails with webhook delivery, open, click, and bounce tracking where available."
          >
            {recentActivity.length ? (
              <div className="overflow-hidden rounded-[1.25rem] border border-[var(--portal-border)]">
                <div className="grid grid-cols-[1fr_0.9fr_0.8fr_1fr_0.8fr] gap-3 border-b border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                  <div>Buyer</div>
                  <div>Puppy</div>
                  <div>Notice</div>
                  <div>Recipient</div>
                  <div>Event</div>
                </div>
                {recentActivity.slice(0, 10).map((activity) => (
                  <div
                    key={activity.id}
                    className="grid grid-cols-[1fr_0.9fr_0.8fr_1fr_0.8fr] gap-3 border-b border-[var(--portal-border)] bg-white px-4 py-4 text-sm last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-[var(--portal-text)]">
                        {activity.buyerName}
                      </div>
                      <div className="mt-1 text-xs text-[var(--portal-text-muted)]">
                        {compactDate(activity.createdAt)}
                      </div>
                    </div>
                    <div className="min-w-0 truncate text-[var(--portal-text-soft)]">
                      {activity.puppyName || "Not linked"}
                    </div>
                    <div className="min-w-0 truncate font-medium text-[var(--portal-text)]">
                      {prettyNoticeKind(activity.noticeKind)}
                    </div>
                    <div className="min-w-0 truncate text-[var(--portal-text-soft)]">
                      {activity.recipientEmail}
                    </div>
                    <div>
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(
                          activity.lastEventType || activity.status
                        )}`}
                      >
                        {formatEventLabel(activity.lastEventType || activity.status)}
                      </span>
                      <div className="mt-2 text-xs text-[var(--portal-text-muted)]">
                        Opens {activity.openCount} | Clicks {activity.clickCount}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ActivityEmptyState
                title="No automatic email activity yet"
                description={
                  webhookConfigured
                    ? "The log will populate after automatic sends begin receiving Resend events."
                    : "Automatic sends can still go out, but webhook tracking needs the Resend webhook secret."
                }
              />
            )}
          </AdminPanel>

          <AdminPanel
            title="Recent Test Sends"
            subtitle="Test emails sent from this editor, including webhook events when Resend reports them."
          >
            {recentTestSends.length ? (
              <div className="space-y-3">
                {recentTestSends.map((send) => (
                  <div
                    key={send.id}
                    className="rounded-[1.15rem] border border-[var(--portal-border)] bg-white px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[var(--portal-text)]">
                          {send.label || send.templateKey}
                        </div>
                        <div className="mt-1 truncate text-xs text-[var(--portal-text-muted)]">
                          {send.recipientEmail} | {compactDate(send.createdAt)}
                        </div>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(
                          send.lastEventType || send.status
                        )}`}
                      >
                        {formatEventLabel(send.lastEventType || send.status)}
                      </span>
                    </div>
                    <div className="mt-3 truncate text-xs text-[var(--portal-text-soft)]">
                      {send.subject}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-[var(--portal-text-muted)]">
                      <span>Mode: {send.renderMode}</span>
                      <span>Opens {send.openCount}</span>
                      <span>Clicks {send.clickCount}</span>
                      {send.providerMessageId ? <span>ID {send.providerMessageId}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ActivityEmptyState
                title="No test sends yet"
                description={
                  testSendTrackingReady
                    ? "Use the Test Email panel to send a rendered template to the owner/admin address."
                    : "Apply the template test-send migration to keep test history and webhook tracking."
                }
              />
            )}
          </AdminPanel>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <AdminPanel
            title="Where Things Live"
            subtitle="This keeps buyer conversations separate from automatic template management."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.2rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--portal-text)]">
                  <Mail className="h-4 w-4 text-[var(--portal-accent)]" />
                  Resend Templates
                </div>
                <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                  Automatic receipts, reminders, document notices, transport notices, puppy updates,
                  and relationship follow-up emails.
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--portal-text)]">
                  <Activity className="h-4 w-4 text-[var(--portal-accent)]" />
                  Portal Messages
                </div>
                <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                  Buyer inbox conversations, portal message threads, and manual breeder replies.
                </div>
              </div>
            </div>
          </AdminPanel>

          <AdminPanel
            title="Operational Shortcuts"
            subtitle="Move from template work into the related operational surface."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <Link href="/admin/portal/messages" className={secondaryButtonClass}>
                Open Portal Messages
              </Link>
              <Link href="/admin/portal/puppy-financing" className={secondaryButtonClass}>
                Open Financing Accounts
              </Link>
              <Link href="/admin/portal/payments" className={secondaryButtonClass}>
                Open Payments Workspace
              </Link>
              <Link href="/admin/portal/assistant" className={secondaryButtonClass}>
                Ask ChiChi To Draft Follow-Up
              </Link>
            </div>
          </AdminPanel>
        </div>
      </div>
    </AdminPageShell>
  );
}

function CategoryFilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition",
        active
          ? "border-transparent bg-[var(--portal-accent)] text-white"
          : "border-[var(--portal-border)] bg-white text-[var(--portal-text-soft)] hover:text-[var(--portal-text)]",
      ].join(" ")}
    >
      {label}
    </button>
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

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const normalizedOptions = Array.from(new Set([value, ...options].filter(Boolean)));

  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-[18px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3.5 text-sm text-[var(--portal-text)] outline-none focus:border-[#c8a884]"
      >
        {normalizedOptions.map((option) => (
          <option key={option} value={option}>
            {categoryLabel(option)}
          </option>
        ))}
      </select>
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

function ToggleCard({
  label,
  description,
  enabled,
  onToggle,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`rounded-[1.2rem] border px-4 py-4 text-left transition ${
        enabled
          ? "border-emerald-200 bg-emerald-50"
          : "border-[var(--portal-border)] bg-[var(--portal-surface-muted)]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--portal-text)]">{label}</div>
          <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">
            {description}
          </div>
        </div>
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
            enabled
              ? "border-emerald-200 bg-white text-emerald-700"
              : "border-amber-200 bg-white text-amber-700"
          }`}
        >
          {enabled ? "on" : "off"}
        </span>
      </div>
    </button>
  );
}

function ActivityEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-5 py-6 text-sm text-[var(--portal-text-soft)]">
      <div className="font-semibold text-[var(--portal-text)]">{title}</div>
      <div className="mt-1 leading-6">{description}</div>
    </div>
  );
}
