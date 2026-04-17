"use client";

import React, { useEffect, useEffectEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Eye,
  Loader2,
  Mail,
  Plus,
  RefreshCcw,
  Save,
  Search,
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

type TemplatesWorkspaceResponse = {
  ok?: boolean;
  error?: string;
  warning?: string;
  missingStorage?: boolean;
  webhookConfigured?: boolean;
  templates?: MessageTemplateRecord[];
  recentActivity?: RecentDeliveryActivity[];
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

type StarterTemplate = {
  templateKey: string;
  category: string;
  label: string;
  description: string;
  subject: string;
  body: string;
  previewPayload: Record<string, unknown>;
};

const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-[1rem] bg-[linear-gradient(135deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--portal-shadow-md)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-[1rem] border border-[var(--portal-border)] bg-white/92 px-4 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[var(--portal-shadow-sm)] transition hover:bg-[var(--portal-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60";

const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    templateKey: "payment_receipt",
    category: "payments",
    label: "Payment Receipt",
    description: "Automatic receipt sent when a buyer payment is posted.",
    subject: "Payment received for {{puppy_name}}",
    body: `Hi {{buyer_name}},

We received your payment for {{puppy_name}}.

Payment amount: {{payment_amount}}
Payment date: {{payment_date}}
Updated balance: {{balance}}

You can review the latest account details in the portal any time.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "The Carter Family",
      puppy_name: "Baby Girl Frey",
      payment_amount: "$300.00",
      payment_date: "April 17, 2026",
      balance: "$1,500.00",
    },
  },
  {
    templateKey: "payment_reminder",
    category: "payments",
    label: "Payment Reminder",
    description: "Friendly reminder sent before a payment plan due date.",
    subject: "Friendly reminder: payment due {{due_date}} for {{puppy_name}}",
    body: `Hi {{buyer_name}},

This is a friendly reminder that your next payment for {{puppy_name}} is due {{due_date}}.

Current monthly amount: {{monthly_amount}}
Current balance: {{balance}}

If you need help reviewing the plan or timing, just reply here and we can help.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "The Carter Family",
      puppy_name: "Baby Girl Frey",
      due_date: "May 15, 2026",
      monthly_amount: "$300.00",
      balance: "$1,800.00",
    },
  },
  {
    templateKey: "payment_overdue",
    category: "payments",
    label: "Payment Overdue",
    description: "Operational overdue notice when an installment is past due.",
    subject: "Payment for {{puppy_name}} is now overdue",
    body: `Hi {{buyer_name}},

Your scheduled payment for {{puppy_name}} is now overdue.

Original due date: {{due_date}}
Current balance: {{balance}}

If payment has already been made, or if you need help coordinating next steps, reply here so we can review the account with you.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "The Carter Family",
      puppy_name: "Baby Girl Frey",
      due_date: "May 15, 2026",
      balance: "$1,800.00",
    },
  },
  {
    templateKey: "payment_default_notice",
    category: "payments",
    label: "Payment Default Notice",
    description: "Escalated notice for significantly overdue accounts.",
    subject: "Important payment notice for {{puppy_name}}",
    body: `Hi {{buyer_name}},

Your payment plan for {{puppy_name}} is significantly past due and now needs direct review.

Original due date: {{due_date}}
Current balance: {{balance}}

Please reply as soon as you can if you need help reviewing the account or making arrangements.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "The Carter Family",
      puppy_name: "Baby Girl Frey",
      due_date: "May 15, 2026",
      balance: "$1,800.00",
    },
  },
  {
    templateKey: "payment_credit_applied",
    category: "payments",
    label: "Payment Credit Applied",
    description: "Use when a credit or manual adjustment changes the buyer balance.",
    subject: "Credit applied to {{puppy_name}} payment plan",
    body: `Hi {{buyer_name}},

We applied a credit to {{puppy_name}}'s payment plan.

Credit amount: {{credit_amount}}
Updated balance: {{balance}}

You can review the updated account details in the portal, and you are always welcome to reply if you want us to walk through the changes with you.

Southwest Virginia Chihuahua`,
    previewPayload: {
      buyer_name: "The Carter Family",
      puppy_name: "Baby Girl Frey",
      credit_amount: "$125.00",
      balance: "$1,375.00",
    },
  },
];

function templateDraftFromRecord(template: MessageTemplateRecord | null): TemplateDraft {
  return {
    id: template?.id ?? null,
    templateKey: template?.templateKey || "",
    category: template?.category || "payments",
    label: template?.label || "",
    description: template?.description || "",
    subject: template?.subject || "",
    body: template?.body || "",
    previewPayload: JSON.stringify(template?.previewPayload || {}, null, 2),
    automationEnabled: template?.automationEnabled ?? true,
    isActive: template?.isActive ?? true,
  };
}

function templateDraftFromStarter(template: StarterTemplate): TemplateDraft {
  return {
    id: null,
    templateKey: template.templateKey,
    category: template.category,
    label: template.label,
    description: template.description,
    subject: template.subject,
    body: template.body,
    previewPayload: JSON.stringify(template.previewPayload, null, 2),
    automationEnabled: true,
    isActive: true,
  };
}

function blankTemplateDraft(): TemplateDraft {
  return {
    id: null,
    templateKey: "",
    category: "payments",
    label: "",
    description: "",
    subject: "",
    body: "",
    previewPayload: "{}",
    automationEnabled: true,
    isActive: true,
  };
}

function text(value: unknown) {
  return String(value || "").trim();
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

function cardClassName(extra = "") {
  return `rounded-[1.5rem] border border-[var(--portal-border)] bg-[var(--portal-surface)] shadow-[var(--portal-shadow-sm)] ${extra}`.trim();
}

export function ResendTemplatesWorkspace() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();

  const [templates, setTemplates] = useState<MessageTemplateRecord[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentDeliveryActivity[]>([]);

  const [initializing, setInitializing] = useState(true);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [statusText, setStatusText] = useState("");
  const [warningText, setWarningText] = useState("");
  const [missingStorage, setMissingStorage] = useState(false);
  const [webhookConfigured, setWebhookConfigured] = useState(false);

  const [search, setSearch] = useState("");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>(
    templateDraftFromStarter(STARTER_TEMPLATES[0])
  );

  const hasLoadedOnce = templates.length > 0 || recentActivity.length > 0;

  const loadWorkspace = useEffectEvent(async (background = false) => {
    if (!accessToken) {
      setInitializing(false);
      setLoadingWorkspace(false);
      setRefreshing(false);
      return;
    }

    if (background) {
      setRefreshing(true);
    } else if (!hasLoadedOnce) {
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
      const nextActivity = payload.recentActivity || [];

      setTemplates(nextTemplates);
      setRecentActivity(nextActivity);
      setMissingStorage(Boolean(payload.missingStorage));
      setWebhookConfigured(Boolean(payload.webhookConfigured));
      setWarningText(payload.warning || "");
      setStatusText((current) => {
        if (current.toLowerCase().includes("saved")) return current;
        return "";
      });

      setSelectedTemplateKey((current) => {
        if (current && nextTemplates.some((template) => template.templateKey === current)) {
          return current;
        }
        return nextTemplates[0]?.templateKey || current;
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not load the automatic email templates.";

      if (!hasLoadedOnce) {
        setStatusText(message);
      } else {
        setWarningText(message);
      }
    } finally {
      setInitializing(false);
      setLoadingWorkspace(false);
      setRefreshing(false);
    }
  });

  useEffect(() => {
    if (!loading && accessToken && isAdmin) {
      void loadWorkspace(false);
      return;
    }

    if (!loading) {
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
      return;
    }

    if (!templates.length && !selectedTemplateKey) {
      setTemplateDraft((current) =>
        current.templateKey || current.label || current.subject || current.body
          ? current
          : templateDraftFromStarter(STARTER_TEMPLATES[0])
      );
    }
  }, [selectedTemplate, selectedTemplateKey, templates.length]);

  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return templates;

    return templates.filter((template) =>
      [
        template.label,
        template.templateKey,
        template.category,
        template.description,
        template.subject,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(query)
    );
  }, [search, templates]);

  const visibleStarterTemplates = useMemo(() => {
    const existingKeys = new Set(templates.map((template) => template.templateKey));
    return STARTER_TEMPLATES.filter((template) => !existingKeys.has(template.templateKey));
  }, [templates]);

  const templateTokens = useMemo(
    () =>
      Array.from(
        new Set([...extractTokens(templateDraft.subject), ...extractTokens(templateDraft.body)])
      ),
    [templateDraft.body, templateDraft.subject]
  );

  const paymentTemplateCount = templates.filter((template) => template.category === "payments").length;
  const activeTemplateCount = templates.filter((template) => template.isActive).length;
   const automationTemplateCount = templates.filter(
    (template) => template.automationEnabled
  ).length;
  const trackedActivityCount = recentActivity.filter(
    (activity) => activity.lastEventType
  ).length;

  const hasDraftChanges = useMemo(() => {
    if (!selectedTemplate) {
      return (
        text(templateDraft.templateKey).length > 0 ||
        text(templateDraft.label).length > 0 ||
        text(templateDraft.description).length > 0 ||
        text(templateDraft.subject).length > 0 ||
        text(templateDraft.body).length > 0 ||
        text(templateDraft.previewPayload) !== "{}" ||
        !templateDraft.automationEnabled ||
        !templateDraft.isActive
      );
    }

    const baseline = templateDraftFromRecord(selectedTemplate);
    return JSON.stringify(baseline) !== JSON.stringify(templateDraft);
  }, [selectedTemplate, templateDraft]);

  async function handleSave() {
    if (!accessToken) return;

    setSaving(true);
    setStatusText("");

    try {
      const response = await fetch("/api/admin/portal/message-templates", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(templateDraft),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "Could not save the template.");
      }

      setStatusText("Template saved.");
      await loadWorkspace(true);
      setSelectedTemplateKey(templateDraft.templateKey);
    } catch (error) {
      setStatusText(
        error instanceof Error ? error.message : "Could not save the template."
      );
    } finally {
      setSaving(false);
    }
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
        details="Only approved owner emails can manage automatic payment and reminder templates."
      />
    );
  }

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-10">
        <AdminPageHero
          eyebrow="Resend Templates"
          title="Automatic email templates and delivery tracking"
          description="This workspace is for automatic outbound Resend emails only, including receipts, reminders, overdue notices, default notices, credits, and other breeder automation content. Buyer conversations and replies stay in Portal Messages."
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
                detail={`${paymentTemplateCount} payment and financing templates.`}
              />
              <AdminInfoTile
                label="Automation Ready"
                value={String(automationTemplateCount)}
                detail="Templates currently enabled for operational use."
              />
              <AdminInfoTile
                label="Tracked Sends"
                value={String(trackedActivityCount)}
                detail="Recent sends with a tracked delivery event on file."
              />
              <AdminInfoTile
                label="Webhook Tracking"
                value={webhookConfigured ? "Live" : "Needs Secret"}
                detail={
                  webhookConfigured
                    ? "Open, click, bounce, and delivery events can be recorded."
                    : "Add the Resend webhook secret to capture opens and deliveries."
                }
              />
            </div>
          }
        />

        {warningText ? (
          <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {warningText}
          </div>
        ) : null}

        {statusText ? (
          <div
            className={`rounded-[1.25rem] border px-4 py-3 text-sm font-semibold ${
              statusText.toLowerCase().includes("saved")
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {statusText}
          </div>
        ) : null}

        <div className={cardClassName("p-5")}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative max-w-xl flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--portal-text-muted)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search automatic templates by key, label, category, or subject..."
                className="w-full rounded-[1rem] border border-[var(--portal-border)] bg-white py-3 pl-11 pr-4 text-sm text-[var(--portal-text)] outline-none transition focus:border-[var(--portal-accent)]"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void loadWorkspace(true)}
                className={secondaryButtonClass}
                disabled={refreshing || loadingWorkspace}
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                {refreshing ? "Refreshing" : "Refresh"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedTemplateKey("");
                  setTemplateDraft(blankTemplateDraft());
                  setStatusText("");
                }}
                className={secondaryButtonClass}
                disabled={saving}
              >
                <Plus className="h-4 w-4" />
                New Blank Template
              </button>
            </div>
          </div>
        </div>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <AdminPanel
            title="Automatic Templates"
            subtitle="This is the editable library for outbound Resend automation content. Portal Messages remains the buyer inbox and reply surface."
          >
            <div className="space-y-4">
              {visibleStarterTemplates.length ? (
                <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                    Quick Starters
                  </div>
                  <div className="mt-3 grid gap-2">
                    {visibleStarterTemplates.slice(0, 5).map((template) => (
                      <button
                        key={template.templateKey}
                        type="button"
                        onClick={() => {
                          setSelectedTemplateKey("");
                          setStatusText("");
                          setTemplateDraft(templateDraftFromStarter(template));
                        }}
                        className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-3 py-3 text-left text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]"
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {initializing || (loadingWorkspace && !hasLoadedOnce) ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={`template-skeleton-${index}`}
                      className="h-[84px] animate-pulse rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)]"
                    />
                  ))}
                </div>
              ) : filteredTemplates.length ? (
                <div className="space-y-3">
                  {filteredTemplates.map((template) => (
                    <AdminListCard
                      key={template.templateKey}
                      selected={selectedTemplateKey === template.templateKey}
                      onClick={() => {
                        setSelectedTemplateKey(template.templateKey);
                        setStatusText("");
                      }}
                      title={template.label}
                      subtitle={template.description || template.subject}
                      meta={`${template.category} | ${template.templateKey}`}
                      badge={
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                            template.isActive
                              ? adminStatusBadge("active")
                              : "border-amber-200 bg-amber-50 text-amber-700"
                          }`}
                        >
                          {template.isActive ? "active" : "inactive"}
                        </span>
                      }
                    />
                  ))}
                </div>
              ) : (
                <AdminEmptyState
                  title="No templates matched your search"
                  description="Try a different payment, reminder, credit, or document keyword."
                />
              )}
            </div>
          </AdminPanel>

          <div className="space-y-6">
            <AdminPanel
              title="Template Editor"
              subtitle="Edit the actual subject, body, variables, and automation flags for breeder-facing outbound emails."
              action={
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  className={primaryButtonClass}
                  disabled={
                    saving ||
                    missingStorage ||
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
                <Field
                  label="Category"
                  value={templateDraft.category}
                  onChange={(value) =>
                    setTemplateDraft((current) => ({ ...current, category: value }))
                  }
                />
                <Field
                  label="Description"
                  value={templateDraft.description}
                  onChange={(value) =>
                    setTemplateDraft((current) => ({ ...current, description: value }))
                  }
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
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <ToggleCard
                  label="Automation enabled"
                  enabled={templateDraft.automationEnabled}
                  description="Leave this on when the system should use this template for automatic workflows."
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
                  description="Inactive templates stay editable but will not be preferred for outbound sends."
                  onToggle={() =>
                    setTemplateDraft((current) => ({
                      ...current,
                      isActive: !current.isActive,
                    }))
                  }
                />
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-4">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                    <Eye className="h-4 w-4" />
                    Preview
                  </div>
                  <div className="mt-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                      Subject
                    </div>
                    <div className="mt-2 text-base font-semibold text-[var(--portal-text)]">
                      {previewText(templateDraft.subject, templateDraft.previewPayload) || "No subject yet"}
                    </div>
                  </div>
                  <div className="mt-5">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                      Body
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--portal-text-soft)]">
                      {previewText(templateDraft.body, templateDraft.previewPayload) || "No body yet"}
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-white p-4">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                    <Sparkles className="h-4 w-4" />
                    Variables In Use
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
                        No variables detected yet.
                      </span>
                    )}
                  </div>

                  <div className="mt-5 rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4 text-sm leading-6 text-[var(--portal-text-soft)]">
                    Payment automations currently use:
                    <div className="mt-3 space-y-2 text-[var(--portal-text)]">
                      <div>
                        <strong>Receipts</strong>: <code>payment_receipt</code>
                      </div>
                      <div>
                        <strong>Due reminders</strong>: <code>payment_reminder</code>
                      </div>
                      <div>
                        <strong>Overdue notices</strong>: <code>payment_overdue</code>
                      </div>
                      <div>
                        <strong>Default notices</strong>: <code>payment_default_notice</code>
                      </div>
                      <div>
                        <strong>Credits / adjustments</strong>: <code>payment_credit_applied</code>
                      </div>
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

            <AdminPanel
              title="Recent Resend Activity"
              subtitle="This shows the latest automatic payment and reminder emails along with delivery, open, click, and bounce tracking where the webhook is available."
            >
              {recentActivity.length ? (
                <div className="overflow-hidden rounded-[1.25rem] border border-[var(--portal-border)]">
                  <div className="grid grid-cols-[1.1fr_1fr_0.9fr_0.9fr_0.8fr_0.9fr] gap-3 border-b border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                    <div>Buyer</div>
                    <div>Puppy</div>
                    <div>Notice</div>
                    <div>Recipient</div>
                    <div>Event</div>
                    <div>Tracking</div>
                  </div>

                  {recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="grid grid-cols-[1.1fr_1fr_0.9fr_0.9fr_0.8fr_0.9fr] gap-3 border-b border-[var(--portal-border)] bg-white px-4 py-4 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-[var(--portal-text)]">
                          {activity.buyerName}
                        </div>
                        <div className="mt-1 text-xs text-[var(--portal-text-muted)]">
                          {activity.createdAt ? fmtDate(activity.createdAt) : "Recent send"}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="font-semibold text-[var(--portal-text)]">
                          {activity.puppyName || "Not linked"}
                        </div>
                        <div className="mt-1 truncate text-xs text-[var(--portal-text-muted)]">
                          {activity.subject}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="font-semibold text-[var(--portal-text)]">
                          {prettyNoticeKind(activity.noticeKind)}
                        </div>
                        <div className="mt-1 text-xs text-[var(--portal-text-muted)]">
                          {activity.providerMessageId || "No provider id"}
                        </div>
                      </div>

                      <div className="truncate font-medium text-[var(--portal-text-soft)]">
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
                          {activity.lastEventAt
                            ? fmtDate(activity.lastEventAt)
                            : "Waiting on next event"}
                        </div>
                      </div>

                      <div className="space-y-1 text-xs text-[var(--portal-text-soft)]">
                        <div>Delivered: {activity.deliveredAt ? fmtDate(activity.deliveredAt) : "-"}</div>
                        <div>Opened: {activity.openedAt ? fmtDate(activity.openedAt) : "-"}</div>
                        <div>
                          Opens {activity.openCount} | Clicks {activity.clickCount}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                 <AdminEmptyState
                  title="No tracked automatic email activity yet"
                  description={
                    webhookConfigured
                      ? "The log will begin to populate after the next automatic send and webhook event."
                      : "Automatic sends can still go out, but open and delivery tracking needs the Resend webhook secret."
                  }
                />
              )}
            </AdminPanel>
          </div>
        </section>

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
                  Automatic receipts, due reminders, overdue notices, default notices, credits,
                  and breeder automation content.
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--portal-text)]">
                  <Activity className="h-4 w-4 text-[var(--portal-accent)]" />
                  Portal Messages
                </div>
                <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                  Actual inbox conversations, buyer portal threads, and manual breeder replies.
                </div>
              </div>
            </div>
          </AdminPanel>

          <AdminPanel
            title="Operational Shortcuts"
            subtitle="Move straight from the template editor into the related workflow surfaces."
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