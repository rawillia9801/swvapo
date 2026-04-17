"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useDeferredValue, useEffect, useEffectEvent, useState, useTransition } from "react";
import {
  AlertTriangle,
  FileText,
  HeartPulse,
  Loader2,
  MessageSquareText,
  PawPrint,
  RefreshCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
  WandSparkles,
} from "lucide-react";
import {
  AdminEmptyState,
  AdminPageHero,
  AdminPageShell,
  AdminRestrictedState,
} from "@/components/admin/luxury-admin-shell";
import {
  PUPPIES_SYSTEM_TABS,
  isCurrentPuppyStatus,
  isPastPuppyStatus,
  type BuyerWorkspaceRecord,
  type ChecklistTemplateRecord,
  type MessageTemplateRecord,
  type PuppiesSystemResponse,
  type PuppiesSystemSnapshot,
  type PuppiesSystemTab,
  type PuppyWorkspaceRecord,
  type WorkflowSettingRecord,
} from "@/lib/admin-puppies-system";
import { usePortalAdminSession } from "@/lib/use-portal-admin-session";
import { buildPuppyPhotoUrl, fmtDate } from "@/lib/utils";

const TAB_LABELS: Record<PuppiesSystemTab, string> = {
  overview: "Overview",
  current: "Current Puppies",
  past: "Past Puppies",
  care: "Care & Health",
  readiness: "Website & Portal Readiness",
  "buyer-matching": "Buyer Matching",
  documents: "Documents",
  messaging: "Messaging / Email Templates",
  settings: "Settings / Automations",
};

const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-[1rem] bg-[linear-gradient(135deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--portal-shadow-md)] transition hover:-translate-y-0.5 disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-[1rem] border border-[var(--portal-border)] bg-white/92 px-4 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[var(--portal-shadow-sm)] transition hover:bg-[var(--portal-surface-muted)] disabled:opacity-60";

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

type WorkflowDraft = {
  id: number | null;
  workflowKey: string;
  category: string;
  label: string;
  description: string;
  status: string;
  settings: string;
};

type ChecklistDraft = {
  id: number | null;
  key: string;
  label: string;
  description: string;
  category: string;
  sortOrder: string;
};

function cardClassName(extra = "") {
  return `rounded-[1.5rem] border border-[var(--portal-border)] bg-[var(--portal-surface)] shadow-[var(--portal-shadow-sm)] ${extra}`.trim();
}

function readinessClass(score: number) {
  if (score >= 90) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (score >= 70) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
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

function workflowDraftFromRecord(workflow: WorkflowSettingRecord | null): WorkflowDraft {
  return {
    id: workflow?.id ?? null,
    workflowKey: workflow?.workflowKey || "",
    category: workflow?.category || "operations",
    label: workflow?.label || "",
    description: workflow?.description || "",
    status: workflow?.status || "active",
    settings: JSON.stringify(workflow?.settings || {}, null, 2),
  };
}

function checklistDraftFromRecord(template: ChecklistTemplateRecord | null): ChecklistDraft {
  return {
    id: template?.id ?? null,
    key: template?.key || "",
    label: template?.label || "",
    description: template?.description || "",
    category: template?.category || "development",
    sortOrder: template?.sortOrder != null ? String(template.sortOrder) : "0",
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

function latestWeightLabel(puppy: PuppyWorkspaceRecord) {
  const latestWeight = puppy.care.latestWeight;
  if (!latestWeight) return "No weight";
  if (latestWeight.weightOz != null) return `${latestWeight.weightOz} oz`;
  if (latestWeight.weightG != null) return `${latestWeight.weightG} g`;
  return "No weight";
}

function nextCareLabel(puppy: PuppyWorkspaceRecord) {
  if (puppy.care.weightDue) return "Weight due";
  if (puppy.care.vaccineDue) return "Vaccine due";
  if (puppy.care.dewormingDue) return "Deworming due";
  return "Up to date";
}

function buyerAttentionLabel(buyer: BuyerWorkspaceRecord) {
  if (buyer.overdue) return "Payment overdue";
  if (buyer.unsignedForms > 0) return "Documents pending";
  if (!buyer.linkedPuppyIds.length) return "Needs puppy match";
  if (!buyer.hasPortalAccount) return "Portal not linked";
  return "Healthy";
}

function PuppyQuickCard({ puppy }: { puppy: PuppyWorkspaceRecord }) {
  const photo = puppy.photoUrl ? buildPuppyPhotoUrl(puppy.photoUrl) : "";
  return (
    <Link href={`/admin/portal/puppies?puppy=${puppy.id}`} className="group overflow-hidden rounded-[1.4rem] border border-[var(--portal-border)] bg-white shadow-[var(--portal-shadow-sm)] transition hover:-translate-y-1 hover:shadow-[var(--portal-shadow-lg)]">
      <div className="relative h-36 bg-[linear-gradient(135deg,#efe0cf_0%,#dbb894_100%)]">
        {photo ? <Image src={photo} alt={puppy.displayName} fill className="object-cover transition duration-500 group-hover:scale-105" sizes="320px" /> : <div className="flex h-full items-center justify-center text-[#8f6a48]"><PawPrint className="h-10 w-10" /></div>}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div><div className="text-base font-semibold text-[var(--portal-text)]">{puppy.displayName}</div><div className="text-sm text-[var(--portal-text-soft)]">{[puppy.sex, puppy.color, puppy.coatType].filter(Boolean).join(" | ") || "Profile still being completed"}</div></div>
          <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${readinessClass(puppy.readiness.website.score)}`}>{puppy.status || "pending"}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-[0.9rem] bg-[var(--portal-surface-muted)] px-3 py-2 text-[var(--portal-text-soft)]">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">Buyer</div>
            <div className="mt-1 font-semibold text-[var(--portal-text)]">{puppy.buyerName || "Unassigned"}</div>
          </div>
          <div className="rounded-[0.9rem] bg-[var(--portal-surface-muted)] px-3 py-2 text-[var(--portal-text-soft)]">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">Litter</div>
            <div className="mt-1 font-semibold text-[var(--portal-text)]">{puppy.litterName || "Not linked"}</div>
          </div>
          <div className="rounded-[0.9rem] bg-[var(--portal-surface-muted)] px-3 py-2 text-[var(--portal-text-soft)]">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">Latest Weight</div>
            <div className="mt-1 font-semibold text-[var(--portal-text)]">{latestWeightLabel(puppy)}</div>
          </div>
          <div className="rounded-[0.9rem] bg-[var(--portal-surface-muted)] px-3 py-2 text-[var(--portal-text-soft)]">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">Next Care</div>
            <div className="mt-1 font-semibold text-[var(--portal-text)]">{nextCareLabel(puppy)}</div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-semibold">
          <div className={`rounded-[0.9rem] border px-2 py-2 ${readinessClass(puppy.readiness.website.score)}`}>Web {puppy.readiness.website.score}%</div>
          <div className={`rounded-[0.9rem] border px-2 py-2 ${readinessClass(puppy.readiness.portal.score)}`}>Portal {puppy.readiness.portal.score}%</div>
          <div className={`rounded-[0.9rem] border px-2 py-2 ${readinessClass(puppy.readiness.documents.score)}`}>Docs {puppy.readiness.documents.score}%</div>
          <div className={`rounded-[0.9rem] border px-2 py-2 ${readinessClass(puppy.readiness.goHome.score)}`}>Go Home {puppy.readiness.goHome.score}%</div>
        </div>
        {puppy.attention.length ? (
          <div className="rounded-[0.9rem] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {puppy.attention.slice(0, 2).join(" • ")}
          </div>
        ) : (
          <div className="rounded-[0.9rem] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Record looks healthy across care, readiness, and buyer linkage.
          </div>
        )}
      </div>
    </Link>
  );
}

export function PuppiesSystemWorkspace({
  defaultTab = "overview",
}: {
  defaultTab?: PuppiesSystemTab;
}) {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const [snapshot, setSnapshot] = useState<PuppiesSystemSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<PuppiesSystemTab>(defaultTab);
  const [search, setSearch] = useState("");
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [feedback, setFeedback] = useState("");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [selectedWorkflowKey, setSelectedWorkflowKey] = useState("");
  const [selectedChecklistKey, setSelectedChecklistKey] = useState("");
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>(templateDraftFromRecord(null));
  const [workflowDraft, setWorkflowDraft] = useState<WorkflowDraft>(workflowDraftFromRecord(null));
  const [checklistDraft, setChecklistDraft] = useState<ChecklistDraft>(checklistDraftFromRecord(null));
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingWorkflow, setSavingWorkflow] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [isPending, startTransition] = useTransition();
  const deferredSearch = useDeferredValue(search);

  const loadSnapshot = useEffectEvent(async () => {
    if (!accessToken) return;
    setLoadingSnapshot(true);
    setErrorText("");
    try {
      const response = await fetch("/api/admin/portal/puppies-system", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = (await response.json()) as PuppiesSystemResponse;
      if (!response.ok || !payload.snapshot) throw new Error(payload.error || "Could not load the Puppies system.");
      setSnapshot(payload.snapshot);
      if (!selectedTemplateKey && payload.snapshot.messageTemplates[0]) setSelectedTemplateKey(payload.snapshot.messageTemplates[0].templateKey);
      if (!selectedWorkflowKey && payload.snapshot.workflowSettings[0]) setSelectedWorkflowKey(payload.snapshot.workflowSettings[0].workflowKey);
      if (!selectedChecklistKey && payload.snapshot.checklistTemplates[0]) setSelectedChecklistKey(payload.snapshot.checklistTemplates[0].key);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Could not load the Puppies system.");
    } finally {
      setLoadingSnapshot(false);
    }
  });

  async function saveAction(action: string, body: Record<string, unknown>) {
    if (!accessToken) return;
    const response = await fetch("/api/admin/portal/puppies-system", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || payload.ok === false) throw new Error(payload.error || "Could not save the update.");
  }

  useEffect(() => {
    if (!loading && accessToken && isAdmin) void loadSnapshot();
    else if (!loading) setLoadingSnapshot(false);
  }, [accessToken, isAdmin, loading]);

  const selectedTemplate = snapshot?.messageTemplates.find((template) => template.templateKey === selectedTemplateKey) || null;
  const selectedWorkflow = snapshot?.workflowSettings.find((workflow) => workflow.workflowKey === selectedWorkflowKey) || null;
  const selectedChecklist = snapshot?.checklistTemplates.find((template) => template.key === selectedChecklistKey) || null;

  useEffect(() => setTemplateDraft(templateDraftFromRecord(selectedTemplate)), [selectedTemplate]);
  useEffect(() => setWorkflowDraft(workflowDraftFromRecord(selectedWorkflow)), [selectedWorkflow]);
  useEffect(() => setChecklistDraft(checklistDraftFromRecord(selectedChecklist)), [selectedChecklist]);

  const currentPuppies = (snapshot?.puppies || []).filter((puppy) => isCurrentPuppyStatus(puppy.status));
  const pastPuppies = (snapshot?.puppies || []).filter((puppy) => isPastPuppyStatus(puppy.status));
  const searchText = deferredSearch.trim().toLowerCase();
  const visibleCurrent = currentPuppies.filter((puppy) =>
    !searchText ||
    [puppy.displayName, puppy.buyerName, puppy.litterName, puppy.color, puppy.status]
      .map((value) => String(value || "").toLowerCase())
      .join(" ")
      .includes(searchText)
  );
  const visiblePast = pastPuppies.filter((puppy) =>
    !searchText ||
    [puppy.displayName, puppy.buyerName, puppy.litterName, puppy.status]
      .map((value) => String(value || "").toLowerCase())
      .join(" ")
      .includes(searchText)
  );
  const weightsDue = currentPuppies.filter((puppy) => puppy.care.weightDue);
  const vaccinesDue = currentPuppies.filter((puppy) => puppy.care.vaccineDue);
  const dewormingDue = currentPuppies.filter((puppy) => puppy.care.dewormingDue);
  const specialCarePuppies = currentPuppies.filter((puppy) => puppy.profile.specialCareFlag);
  const noRecentCare = currentPuppies.filter(
    (puppy) => !puppy.care.latestWeight && !puppy.care.latestHealthRecord && !puppy.care.latestEvent
  );
  const unmatchedPuppies = currentPuppies.filter((puppy) => !puppy.buyerId);
  const buyersNeedingAttention = (snapshot?.buyers || []).filter(
    (buyer) => buyer.overdue || buyer.unsignedForms > 0 || !buyer.linkedPuppyIds.length
  );
  const overdueAccounts = (snapshot?.buyers || []).filter((buyer) => buyer.overdue);
  const buyersMissingDocuments = (snapshot?.buyers || []).filter((buyer) => buyer.unsignedForms > 0);
  const activeLitters = (snapshot?.litters || []).filter((litter) => litter.currentPuppyCount > 0);
  const websiteReadyOnly = currentPuppies.filter(
    (puppy) => puppy.readiness.website.ready && !puppy.readiness.portal.ready
  );
  const templateTokens = Array.from(
    new Set([...extractTokens(templateDraft.subject), ...extractTokens(templateDraft.body)])
  );

  if (loading || loadingSnapshot) {
    return (
      <AdminPageShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex items-center gap-3 rounded-full border border-[var(--portal-border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--portal-text-soft)] shadow-[var(--portal-shadow-sm)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading the Puppies system...
          </div>
        </div>
      </AdminPageShell>
    );
  }

  if (!user) {
    return <AdminRestrictedState title="Sign in to access the Puppies system." details="This workspace is reserved for the Southwest Virginia Chihuahua owner accounts." />;
  }

  if (!isAdmin) {
    return <AdminRestrictedState title="This workspace is limited to approved owner accounts." details="Only approved owner accounts can manage breeding operations, buyer workflows, and ChiChi admin controls." />;
  }

  if (!snapshot) {
    return (
      <AdminPageShell>
        <AdminEmptyState title="The Puppies system did not load." description={errorText || "Try refreshing the workspace."} />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-10">
        <AdminPageHero
          eyebrow="Puppies"
          title="Breeding-program command center"
          description="One main Puppies workspace for overview, care, readiness, matching, documents, messaging, automations, and ChiChi operational context."
          actions={
            <>
              <button type="button" onClick={() => void loadSnapshot()} className={secondaryButtonClass}>
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </button>
              <Link href="/admin/portal/puppies" className={primaryButtonClass}>
                <PawPrint className="h-4 w-4" />
                Open Current Puppies
              </Link>
            </>
          }
          aside={
            <div className="flex flex-wrap gap-2">
              {PUPPIES_SYSTEM_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => startTransition(() => setActiveTab(tab))}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${activeTab === tab ? "border-transparent bg-[var(--portal-accent)] text-white" : "border-[var(--portal-border)] bg-white text-[var(--portal-text-soft)]"}`}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>
          }
        />

        <div className={cardClassName("p-5")}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative max-w-xl flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--portal-text-muted)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search puppies, buyers, litters, documents, or templates..."
                className="w-full rounded-[1rem] border border-[var(--portal-border)] bg-white py-3 pl-11 pr-4 text-sm text-[var(--portal-text)] outline-none transition focus:border-[var(--portal-accent)]"
              />
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-[var(--portal-text-soft)]">
              <Link href="/admin/portal/litters" className={secondaryButtonClass}>Open Litters</Link>
              <Link href="/admin/portal/buyers" className={secondaryButtonClass}>Open Buyers</Link>
              <Link href="/admin/portal/assistant" className={secondaryButtonClass}>Open ChiChi</Link>
            </div>
          </div>
        </div>

        {activeTab === "overview" && (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {snapshot.metrics.map((metric) => (
                <div key={metric.key} className={cardClassName("p-5")}>
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">{metric.label}</div>
                  <div className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-[var(--portal-text)]">{metric.value}</div>
                  <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{metric.detail}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_380px]">
              <div className="space-y-6">
                <div className={cardClassName("p-5")}>
                  <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--portal-text)]">
                    <AlertTriangle className="h-5 w-5 text-[var(--portal-warning)]" />
                    Puppies needing attention
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <AttentionTile label="Weights due" count={weightsDue.length} />
                    <AttentionTile label="Vaccines due" count={vaccinesDue.length} />
                    <AttentionTile label="Deworming due" count={dewormingDue.length} />
                    <AttentionTile label="Missing photos" count={currentPuppies.filter((puppy) => !puppy.readiness.photoReady).length} />
                    <AttentionTile label="Missing website copy" count={currentPuppies.filter((puppy) => !puppy.readiness.copyReady).length} />
                    <AttentionTile label="Missing buyer link" count={unmatchedPuppies.length} />
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <div className={cardClassName("p-5")}>
                    <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--portal-text)]">
                      <WandSparkles className="h-5 w-5 text-[var(--portal-accent)]" />
                      Quick actions
                    </div>
                    <div className="grid gap-3">
                      <Link href="/admin/portal/puppies" className={secondaryButtonClass}>
                        Add or edit puppy records
                      </Link>
                      <Link href="/admin/portal/litters" className={secondaryButtonClass}>
                        Open litter management
                      </Link>
                      <Link href="/admin/portal/buyers" className={secondaryButtonClass}>
                        Open buyer matching
                      </Link>
                      <button type="button" onClick={() => setActiveTab("messaging")} className={secondaryButtonClass}>
                        Edit email templates
                      </button>
                      <Link href="/admin/portal/documents" className={secondaryButtonClass}>
                        Open document workflows
                      </Link>
                    </div>
                  </div>

                  <div className={cardClassName("p-5")}>
                    <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--portal-text)]">
                      <HeartPulse className="h-5 w-5 text-[var(--portal-warning)]" />
                      Workflow health
                    </div>
                    <div className="space-y-3 text-sm text-[var(--portal-text-soft)]">
                      <ReadinessLine label="Puppies needing admin attention" value={`${currentPuppies.filter((puppy) => puppy.attention.length > 0).length} of ${currentPuppies.length}`} />
                      <ReadinessLine label="Buyer records needing follow-through" value={`${buyersNeedingAttention.length} buyer accounts`} />
                      <ReadinessLine label="Puppies with no recent care log" value={`${noRecentCare.length} current puppy records`} />
                      <ReadinessLine label="Website ready but portal blocked" value={`${websiteReadyOnly.length} current puppies`} />
                    </div>
                  </div>
                </div>

                <div className={cardClassName("p-5")}>
                  <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--portal-text)]">
                    <WandSparkles className="h-5 w-5 text-[var(--portal-accent-strong)]" />
                    Recent operational activity
                  </div>
                  <div className="space-y-3">
                    {snapshot.recentActivity.slice(0, 10).map((item) => (
                      <div key={item.id} className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-[var(--portal-text)]">{item.title}</div>
                            <div className="text-sm text-[var(--portal-text-soft)]">{item.detail}</div>
                          </div>
                          <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                            {item.occurredAt ? fmtDate(item.occurredAt) : "Recent"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className={cardClassName("p-5")}>
                  <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--portal-text)]">
                    <ShieldCheck className="h-5 w-5 text-[var(--portal-success)]" />
                    Readiness health
                  </div>
                  <div className="space-y-3 text-sm text-[var(--portal-text-soft)]">
                    <ReadinessLine label="Website ready" value={`${currentPuppies.filter((puppy) => puppy.readiness.website.ready).length} of ${currentPuppies.length}`} />
                    <ReadinessLine label="Portal ready" value={`${currentPuppies.filter((puppy) => puppy.readiness.portal.ready).length} of ${currentPuppies.length}`} />
                    <ReadinessLine label="Document ready" value={`${currentPuppies.filter((puppy) => puppy.readiness.documents.ready).length} of ${currentPuppies.length}`} />
                    <ReadinessLine label="Go-home ready" value={`${currentPuppies.filter((puppy) => puppy.readiness.goHome.ready).length} of ${currentPuppies.length}`} />
                  </div>
                </div>

                <div className={cardClassName("p-5")}>
                  <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--portal-text)]">
                    <Users className="h-5 w-5 text-[var(--portal-accent)]" />
                    Buyer workflow health
                  </div>
                  <div className="space-y-3 text-sm text-[var(--portal-text-soft)]">
                    <ReadinessLine label="Overdue payment accounts" value={`${overdueAccounts.length} buyers`} />
                    <ReadinessLine label="Unsigned documents" value={`${buyersMissingDocuments.length} buyers`} />
                    <ReadinessLine label="Portal-linked buyers" value={`${snapshot.buyers.filter((buyer) => buyer.hasPortalAccount).length} of ${snapshot.buyers.length}`} />
                    <ReadinessLine label="Unmatched buyers" value={`${snapshot.buyers.filter((buyer) => !buyer.linkedPuppyIds.length).length} buyer records`} />
                  </div>
                </div>

                <div className={cardClassName("p-5")}>
                  <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--portal-text)]">
                    <PawPrint className="h-5 w-5 text-[var(--portal-accent)]" />
                    Active litters & breeding dogs
                  </div>
                  <div className="space-y-3 text-sm text-[var(--portal-text-soft)]">
                    {activeLitters.slice(0, 4).map((litter) => (
                      <div key={litter.id} className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3">
                        <div className="font-semibold text-[var(--portal-text)]">{litter.displayName}</div>
                        <div className="mt-1 text-[var(--portal-text-soft)]">
                          {litter.currentPuppyCount} current puppies • {litter.pendingTasks.slice(0, 2).join(" • ") || "No major blockers"}
                        </div>
                      </div>
                    ))}
                    <div className="rounded-[1rem] bg-[var(--portal-surface-muted)] px-4 py-3">
                      {snapshot.breedingDogs.filter((dog) => String(dog.status || "").toLowerCase() !== "retired").length} active breeding dogs tracked across the breeding program.
                    </div>
                  </div>
                </div>

                <div className={cardClassName("p-5")}>
                  <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--portal-text)]">
                    <Sparkles className="h-5 w-5 text-[var(--portal-accent)]" />
                    ChiChi modes
                  </div>
                  <div className="space-y-4 text-sm leading-6 text-[var(--portal-text-soft)]">
                    <div>
                      <div className="font-semibold text-[var(--portal-text)]">Customer-facing assistant</div>
                      <div>{snapshot.chichi.publicAvailabilitySummary}</div>
                    </div>
                    <div>
                      <div className="font-semibold text-[var(--portal-text)]">Admin operational assistant</div>
                      <div>ChiChi can summarize missing care updates, readiness blockers, buyer follow-up, and broader breeding-program issues from the same live data.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "current" && (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <AttentionTile label="Current puppies" count={currentPuppies.length} />
              <AttentionTile label="Need care updates" count={weightsDue.length + vaccinesDue.length + dewormingDue.length} />
              <AttentionTile label="Need buyer linkage" count={unmatchedPuppies.length} />
              <AttentionTile label="Blocked for publishing" count={currentPuppies.filter((puppy) => !puppy.readiness.website.ready).length} />
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visibleCurrent.length ? visibleCurrent.map((puppy) => <PuppyQuickCard key={puppy.id} puppy={puppy} />) : <div className={cardClassName("p-8 md:col-span-2 xl:col-span-3")}><AdminEmptyState title="No current puppies match this search." description="Try a different search or open the full current-puppy manager." /></div>}
            </div>
          </>
        )}

        {activeTab === "past" && (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <AttentionTile label="Past puppies" count={pastPuppies.length} />
              <AttentionTile label="With buyer records" count={pastPuppies.filter((puppy) => puppy.buyerId).length} />
              <AttentionTile label="Signed docs" count={pastPuppies.filter((puppy) => puppy.documentSummary.signed > 0).length} />
              <AttentionTile label="Go-home complete" count={pastPuppies.filter((puppy) => puppy.profile.goHomeReady).length} />
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visiblePast.length ? visiblePast.map((puppy) => <PuppyQuickCard key={puppy.id} puppy={puppy} />) : <div className={cardClassName("p-8 md:col-span-2 xl:col-span-3")}><AdminEmptyState title="No past puppies match this search." description="Try a different search or open the full puppy manager." /></div>}
            </div>
          </>
        )}

        {activeTab === "care" && (
          <div className="grid gap-5 xl:grid-cols-4">
            <CareColumn title="Weights due" icon={<Stethoscope className="h-5 w-5 text-[var(--portal-warning)]" />} puppies={weightsDue} />
            <CareColumn title="Vaccines due" icon={<AlertTriangle className="h-5 w-5 text-[var(--portal-warning)]" />} puppies={vaccinesDue} />
            <CareColumn title="Deworming due" icon={<HeartPulse className="h-5 w-5 text-[var(--portal-warning)]" />} puppies={dewormingDue} />
            <CareColumn title="Special care" icon={<AlertTriangle className="h-5 w-5 text-[var(--portal-danger)]" />} puppies={specialCarePuppies.length ? specialCarePuppies : noRecentCare} />
          </div>
        )}

        {activeTab === "readiness" && (
          <div className={cardClassName("overflow-hidden")}>
            <div className="grid grid-cols-[1.1fr_repeat(5,minmax(0,0.7fr))] gap-3 border-b border-[var(--portal-border)] px-5 py-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
              <div>Puppy</div><div>Website</div><div>Portal</div><div>Documents</div><div>Placement</div><div>Go-home</div>
            </div>
            {currentPuppies.map((puppy) => (
              <Link key={puppy.id} href={`/admin/portal/puppies?puppy=${puppy.id}`} className="grid grid-cols-[1.1fr_repeat(5,minmax(0,0.7fr))] gap-3 border-b border-[var(--portal-border)] px-5 py-4 hover:bg-[var(--portal-surface-muted)]">
                <div><div className="font-semibold text-[var(--portal-text)]">{puppy.displayName}</div><div className="text-sm text-[var(--portal-text-soft)]">{puppy.buyerName || "No buyer linked"}</div></div>
                <ReadinessBadge score={puppy.readiness.website.score} />
                <ReadinessBadge score={puppy.readiness.portal.score} />
                <ReadinessBadge score={puppy.readiness.documents.score} />
                <ReadinessBadge score={puppy.readiness.placement.score} />
                <ReadinessBadge score={puppy.readiness.goHome.score} />
              </Link>
            ))}
          </div>
        )}

        {activeTab === "buyer-matching" && (
          <div className="grid gap-6 xl:grid-cols-2">
            <div className={cardClassName("p-5")}>
              <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--portal-text)]"><Users className="h-5 w-5 text-[var(--portal-accent)]" />Unmatched puppies</div>
              <div className="space-y-3">{unmatchedPuppies.length ? unmatchedPuppies.map((puppy) => <Link key={puppy.id} href={`/admin/portal/puppies?puppy=${puppy.id}`} className="block rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3 text-sm text-[var(--portal-text)]"><div className="font-semibold">{puppy.displayName}</div><div className="mt-1 text-[var(--portal-text-soft)]">{puppy.litterName || "No litter linked"} • {puppy.readiness.placement.missing[0] || "Ready for matching review"}</div></Link>) : <div className="rounded-[1rem] border border-dashed border-[var(--portal-border)] px-4 py-6 text-sm text-[var(--portal-text-soft)]">Every current puppy is linked to a buyer right now.</div>}</div>
            </div>
            <div className={cardClassName("p-5")}>
              <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--portal-text)]"><Users className="h-5 w-5 text-[var(--portal-accent)]" />Buyer records needing follow-through</div>
              <div className="space-y-3">{buyersNeedingAttention.length ? buyersNeedingAttention.map((buyer) => <div key={buyer.id} className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3 text-sm"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-[var(--portal-text)]">{buyer.displayName}</div><div className="mt-1 text-[var(--portal-text-soft)]">{buyer.linkedPuppyNames.join(", ") || "No puppy linked"}</div></div><span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${readinessClass(buyer.overdue ? 20 : buyer.unsignedForms > 0 ? 72 : 92)}`}>{buyerAttentionLabel(buyer)}</span></div></div>) : <div className="rounded-[1rem] border border-dashed border-[var(--portal-border)] px-4 py-6 text-sm text-[var(--portal-text-soft)]">Buyer matching and follow-through look healthy right now.</div>}</div>
            </div>
          </div>
        )}

        {activeTab === "documents" && (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <AttentionTile label="Document workflows" count={snapshot.documents.length} />
              <AttentionTile label="Signed" count={snapshot.documents.filter((document) => Boolean(document.signedAt)).length} />
              <AttentionTile label="Visible in portal" count={snapshot.documents.filter((document) => document.visibleToUser).length} />
              <AttentionTile label="Buyers missing docs" count={buyersMissingDocuments.length} />
            </div>
            <div className={cardClassName("p-5")}>
              <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--portal-text)]"><FileText className="h-5 w-5 text-[var(--portal-accent)]" />Document workflows</div>
              <div className="space-y-3">{snapshot.documents.length ? snapshot.documents.map((document) => <div key={document.id} className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-[var(--portal-text)]">{document.title}</div><div className="text-sm text-[var(--portal-text-soft)]">{document.buyerName || "No buyer linked"}{document.puppyName ? ` | ${document.puppyName}` : ""}{document.category ? ` | ${document.category}` : ""}</div></div><span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${readinessClass(document.signedAt ? 100 : 72)}`}>{document.status || "pending"}</span></div></div>) : <AdminEmptyState title="No document workflows are available." description="Add or sync documents to surface packet readiness here." />}</div>
            </div>
          </>
        )}

        {activeTab === "messaging" && (
          <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
            <div className={cardClassName("p-4")}>
              <div className="mb-3 flex items-center gap-2 text-lg font-semibold text-[var(--portal-text)]"><MessageSquareText className="h-5 w-5 text-[var(--portal-accent)]" />Templates</div>
              {snapshot.messageTemplates.map((template) => <button key={template.templateKey} type="button" onClick={() => setSelectedTemplateKey(template.templateKey)} className={`mb-2 block w-full rounded-[1rem] border px-4 py-3 text-left ${selectedTemplateKey === template.templateKey ? "border-[var(--portal-accent)] bg-[var(--portal-surface-muted)]" : "border-[var(--portal-border)] bg-white"}`}><div className="font-semibold text-[var(--portal-text)]">{template.label}</div><div className="text-sm text-[var(--portal-text-soft)]">{template.category}</div></button>)}
            </div>
            <div className={cardClassName("p-5")}>
              <Field label="Template key" value={templateDraft.templateKey} onChange={(value) => setTemplateDraft((current) => ({ ...current, templateKey: value }))} />
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Label" value={templateDraft.label} onChange={(value) => setTemplateDraft((current) => ({ ...current, label: value }))} />
                <Field label="Category" value={templateDraft.category} onChange={(value) => setTemplateDraft((current) => ({ ...current, category: value }))} />
              </div>
              <div className="mt-4"><TextArea label="Description" value={templateDraft.description} onChange={(value) => setTemplateDraft((current) => ({ ...current, description: value }))} rows={2} /></div>
              <div className="mt-4"><Field label="Subject" value={templateDraft.subject} onChange={(value) => setTemplateDraft((current) => ({ ...current, subject: value }))} /></div>
              <div className="mt-4"><TextArea label="Body" value={templateDraft.body} onChange={(value) => setTemplateDraft((current) => ({ ...current, body: value }))} rows={10} /></div>
              <div className="mt-4"><TextArea label="Preview payload JSON" value={templateDraft.previewPayload} onChange={(value) => setTemplateDraft((current) => ({ ...current, previewPayload: value }))} rows={6} /></div>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">Preview subject</div>
                  <div className="mt-2 font-semibold text-[var(--portal-text)]">{previewText(templateDraft.subject, templateDraft.previewPayload)}</div>
                  <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">Preview body</div>
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--portal-text-soft)]">{previewText(templateDraft.body, templateDraft.previewPayload)}</div>
                </div>
                <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-white p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">Variables in use</div>
                  <div className="mt-3 flex flex-wrap gap-2">{templateTokens.length ? templateTokens.map((token) => <span key={token} className="rounded-full border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--portal-text-soft)]">{token}</span>) : <span className="text-sm text-[var(--portal-text-soft)]">No variables detected yet.</span>}</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={async () => { setSavingTemplate(true); setFeedback(""); setErrorText(""); try { await saveAction("save_message_template", { ...templateDraft, previewPayload: templateDraft.previewPayload }); setFeedback("Message template saved."); await loadSnapshot(); } catch (error) { setErrorText(error instanceof Error ? error.message : "Could not save the message template."); } finally { setSavingTemplate(false); } }} className={primaryButtonClass} disabled={savingTemplate}>{savingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save template</button><div className="rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm text-[var(--portal-text-soft)]">Templates here are structured for Resend-backed messaging and automation content.</div></div>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="grid gap-6 xl:grid-cols-2">
            <div className={cardClassName("p-5")}>
              <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--portal-text)]"><Settings2 className="h-5 w-5 text-[var(--portal-accent)]" />Workflow settings</div>
              {snapshot.workflowSettings.map((workflow) => <button key={workflow.workflowKey} type="button" onClick={() => setSelectedWorkflowKey(workflow.workflowKey)} className={`mb-2 block w-full rounded-[1rem] border px-4 py-3 text-left ${selectedWorkflowKey === workflow.workflowKey ? "border-[var(--portal-accent)] bg-[var(--portal-surface-muted)]" : "border-[var(--portal-border)] bg-white"}`}><div className="font-semibold text-[var(--portal-text)]">{workflow.label}</div><div className="text-sm text-[var(--portal-text-soft)]">{workflow.status}</div></button>)}
              <div className="mt-4 grid gap-3"><Field label="Workflow key" value={workflowDraft.workflowKey} onChange={(value) => setWorkflowDraft((current) => ({ ...current, workflowKey: value }))} /><Field label="Label" value={workflowDraft.label} onChange={(value) => setWorkflowDraft((current) => ({ ...current, label: value }))} /><Field label="Status" value={workflowDraft.status} onChange={(value) => setWorkflowDraft((current) => ({ ...current, status: value }))} /><TextArea label="Settings JSON" value={workflowDraft.settings} onChange={(value) => setWorkflowDraft((current) => ({ ...current, settings: value }))} rows={5} /></div>
              <button type="button" onClick={async () => { setSavingWorkflow(true); setFeedback(""); try { await saveAction("save_workflow_setting", { ...workflowDraft, settings: workflowDraft.settings }); setFeedback("Workflow setting saved."); await loadSnapshot(); } catch (error) { setErrorText(error instanceof Error ? error.message : "Could not save the workflow setting."); } finally { setSavingWorkflow(false); } }} className={`${primaryButtonClass} mt-4`} disabled={savingWorkflow}>{savingWorkflow ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save workflow</button>
            </div>

            <div className={cardClassName("p-5")}>
              <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--portal-text)]"><Settings2 className="h-5 w-5 text-[var(--portal-accent)]" />Checklist templates</div>
              {snapshot.checklistTemplates.map((template) => <button key={template.key} type="button" onClick={() => setSelectedChecklistKey(template.key)} className={`mb-2 block w-full rounded-[1rem] border px-4 py-3 text-left ${selectedChecklistKey === template.key ? "border-[var(--portal-accent)] bg-[var(--portal-surface-muted)]" : "border-[var(--portal-border)] bg-white"}`}><div className="font-semibold text-[var(--portal-text)]">{template.label}</div><div className="text-sm text-[var(--portal-text-soft)]">{template.category}</div></button>)}
              <div className="mt-4 grid gap-3"><Field label="Key" value={checklistDraft.key} onChange={(value) => setChecklistDraft((current) => ({ ...current, key: value }))} /><Field label="Label" value={checklistDraft.label} onChange={(value) => setChecklistDraft((current) => ({ ...current, label: value }))} /><Field label="Category" value={checklistDraft.category} onChange={(value) => setChecklistDraft((current) => ({ ...current, category: value }))} /><Field label="Sort order" value={checklistDraft.sortOrder} onChange={(value) => setChecklistDraft((current) => ({ ...current, sortOrder: value }))} /><TextArea label="Description" value={checklistDraft.description} onChange={(value) => setChecklistDraft((current) => ({ ...current, description: value }))} rows={3} /></div>
              <button type="button" onClick={async () => { setSavingChecklist(true); setFeedback(""); try { await saveAction("save_checklist_template", checklistDraft); setFeedback("Checklist template saved."); await loadSnapshot(); } catch (error) { setErrorText(error instanceof Error ? error.message : "Could not save the checklist template."); } finally { setSavingChecklist(false); } }} className={`${primaryButtonClass} mt-4`} disabled={savingChecklist}>{savingChecklist ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save checklist template</button>
            </div>
          </div>
        )}

        {feedback ? <div className={cardClassName("px-4 py-3 text-sm text-emerald-700")}>{feedback}</div> : null}
        {errorText ? <div className={cardClassName("px-4 py-3 text-sm text-rose-700")}>{errorText}</div> : null}
        {isPending ? <div className="text-sm text-[var(--portal-text-muted)]">Updating view...</div> : null}
      </div>
    </AdminPageShell>
  );
}

function AttentionTile({ label, count }: { label: string; count: number }) {
  return <div className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-4"><div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">{label}</div><div className="mt-2 text-2xl font-semibold text-[var(--portal-text)]">{count}</div></div>;
}

function ReadinessLine({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[1rem] bg-[var(--portal-surface-muted)] px-4 py-3"><div className="font-semibold text-[var(--portal-text)]">{label}</div><div>{value}</div></div>;
}

function ReadinessBadge({ score }: { score: number }) {
  return <div className={`rounded-full border px-3 py-1 text-center text-[11px] font-semibold ${readinessClass(score)}`}>{score}%</div>;
}

function CareColumn({ title, icon, puppies }: { title: string; icon: React.ReactNode; puppies: PuppyWorkspaceRecord[] }) {
  return <div className={cardClassName("p-5")}><div className="mb-4 flex items-center gap-2 text-lg font-semibold text-[var(--portal-text)]">{icon}{title}</div><div className="space-y-3">{puppies.length ? puppies.map((puppy) => <Link key={puppy.id} href={`/admin/portal/puppies?puppy=${puppy.id}`} className="block rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3 text-sm text-[var(--portal-text)]">{puppy.displayName}</Link>) : <div className="rounded-[1rem] border border-dashed border-[var(--portal-border)] px-4 py-6 text-sm text-[var(--portal-text-soft)]">Nothing due right now.</div>}</div></div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3 text-sm text-[var(--portal-text)] outline-none" /></label>;
}

function TextArea({ label, value, onChange, rows }: { label: string; value: string; onChange: (value: string) => void; rows: number }) {
  return <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className="mt-2 w-full rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3 text-sm text-[var(--portal-text)] outline-none" /></label>;
}
