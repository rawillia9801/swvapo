import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createServiceSupabase,
  firstValue,
  listAllAuthUsers,
  normalizeEmail,
} from "@/lib/admin-api";
import { loadAdminLineageWorkspace } from "@/lib/admin-lineage";
import {
  ageInWeeks,
  buildReadinessState,
  isCurrentPuppyStatus,
  isPastPuppyStatus,
  isReservedPuppyStatus,
  type ActivityFeedItem,
  type BreedingDogWorkspaceRecord,
  type BuyerWorkspaceRecord,
  type ChecklistProgressRecord,
  type ChecklistTemplateRecord,
  type ChiChiProgramContext,
  type DocumentWorkflowRecord,
  type LitterWorkspaceRecord,
  type MessageTemplateRecord,
  type PuppyAdminProfileRecord,
  type PuppyCareSummary,
  type PuppyDocumentSummary,
  type PuppyEventSummary,
  type PuppyHealthRecordSummary,
  type PuppyPaymentSummary,
  type PuppyPortalSummary,
  type PuppyReadinessSummary,
  type PuppyWeightRecord,
  type PuppyWorkspaceRecord,
  type PuppiesSystemMetric,
  type PuppiesSystemSnapshot,
  type WorkflowSettingRecord,
} from "@/lib/admin-puppies-system";

type BuyerRow = {
  id: number;
  user_id?: string | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  notes?: string | null;
  sale_price?: number | null;
  deposit_amount?: number | null;
  finance_enabled?: boolean | null;
  finance_next_due_date?: string | null;
  delivery_option?: string | null;
  delivery_date?: string | null;
  delivery_location?: string | null;
};

type PuppyMetaRow = {
  id: number;
  registry?: string | null;
  current_weight?: number | null;
  weight_unit?: string | null;
  weight_date?: string | null;
  microchip?: string | null;
  registration_no?: string | null;
};

type PaymentRow = {
  id: string | number;
  buyer_id?: number | null;
  puppy_id?: number | null;
  amount?: number | null;
  payment_date?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type FormRow = {
  id: number;
  user_id?: string | null;
  user_email?: string | null;
  email?: string | null;
  form_key?: string | null;
  form_title?: string | null;
  status?: string | null;
  signed_at?: string | null;
  submitted_at?: string | null;
  created_at?: string | null;
};

type PortalMessageRow = {
  id: string;
  user_id?: string | null;
  user_email?: string | null;
  sender?: string | null;
  subject?: string | null;
  message?: string | null;
  read_by_admin?: boolean | null;
  read_by_user?: boolean | null;
  created_at?: string | null;
};

type DocumentRow = {
  id: string | number;
  user_id?: string | null;
  buyer_id?: number | null;
  title?: string | null;
  category?: string | null;
  status?: string | null;
  file_name?: string | null;
  visible_to_user?: boolean | null;
  signed_at?: string | null;
  created_at?: string | null;
};

type PickupRow = {
  id: number;
  user_id?: string | null;
  puppy_id?: number | null;
  request_type?: string | null;
  request_date?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type PuppyWeightRow = {
  id: number;
  puppy_id?: number | null;
  weigh_date?: string | null;
  weight_date?: string | null;
  age_weeks?: number | null;
  weight_oz?: number | null;
  weight_g?: number | null;
  notes?: string | null;
};

type PuppyHealthRow = {
  id: number;
  puppy_id?: number | null;
  record_date: string;
  record_type?: string | null;
  title?: string | null;
  description?: string | null;
  provider_name?: string | null;
  medication_name?: string | null;
  dosage?: string | null;
  lot_number?: string | null;
  next_due_date?: string | null;
  is_visible_to_buyer?: boolean | null;
};

type PuppyEventRow = {
  id: number;
  puppy_id?: number | null;
  event_date: string;
  event_type?: string | null;
  label?: string | null;
  title?: string | null;
  summary?: string | null;
  details?: string | null;
  is_published?: boolean | null;
  is_private?: boolean | null;
};

type PuppyAdminProfileRow = {
  puppy_id: number;
  registered_name?: string | null;
  public_visibility?: boolean | null;
  portal_visibility?: boolean | null;
  featured_listing?: boolean | null;
  special_care_flag?: boolean | null;
  special_care_notes?: string | null;
  feeding_notes?: string | null;
  lineage_notes?: string | null;
  breeder_notes?: string | null;
  buyer_packet_ready?: boolean | null;
  document_packet_ready?: boolean | null;
  transport_ready?: boolean | null;
  go_home_ready?: boolean | null;
  updated_at?: string | null;
};

type ChecklistTemplateRow = {
  id: number;
  scope?: string | null;
  key?: string | null;
  label?: string | null;
  description?: string | null;
  category?: string | null;
  sort_order?: number | null;
  required_for_website?: boolean | null;
  required_for_portal?: boolean | null;
  required_for_go_home?: boolean | null;
  visible_to_buyer?: boolean | null;
  is_active?: boolean | null;
};

type ChecklistProgressRow = {
  id: number;
  puppy_id?: number | null;
  template_id?: number | null;
  completed?: boolean | null;
  completed_at?: string | null;
  visible_to_buyer?: boolean | null;
  notes?: string | null;
};

type MessageTemplateRow = {
  id: number;
  template_key?: string | null;
  category?: string | null;
  label?: string | null;
  description?: string | null;
  channel?: string | null;
  provider?: string | null;
  subject?: string | null;
  body?: string | null;
  automation_enabled?: boolean | null;
  is_active?: boolean | null;
  preview_payload?: Record<string, unknown> | null;
  updated_at?: string | null;
};

type WorkflowSettingRow = {
  id: number;
  workflow_key?: string | null;
  category?: string | null;
  label?: string | null;
  description?: string | null;
  status?: string | null;
  owner?: string | null;
  cadence_label?: string | null;
  trigger_label?: string | null;
  next_run_hint?: string | null;
  settings?: Record<string, unknown> | null;
  is_visible?: boolean | null;
  updated_at?: string | null;
};

function text(value: unknown) {
  return String(value || "").trim();
}

function numberValue(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isMissingTableError(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error || "")).toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("relation") ||
    message.includes("schema cache") ||
    message.includes("could not find the table")
  );
}

async function safeRows<T>(
  query: PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  try {
    const result = await query;
    if (result.error) {
      if (isMissingTableError(result.error)) return [];
      throw result.error;
    }
    return result.data || [];
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}

async function safeAuthUsers() {
  try {
    return await listAllAuthUsers();
  } catch {
    return [];
  }
}

function groupPush<T>(map: Map<string, T[]>, key: string, value: T) {
  if (!key) return;
  const next = map.get(key) || [];
  next.push(value);
  map.set(key, next);
}

function identityKeys(userId: string | null | undefined, email: string | null | undefined) {
  const keys: string[] = [];
  const safeUserId = text(userId);
  const safeEmail = normalizeEmail(email);
  if (safeUserId) keys.push(`user:${safeUserId}`);
  if (safeEmail) keys.push(`email:${safeEmail}`);
  return keys;
}

function mergeIdentityRows<T extends { id: string | number }>(
  map: Map<string, T[]>,
  userId: string | null | undefined,
  email: string | null | undefined
) {
  const keys = identityKeys(userId, email);
  const seen = new Set<string>();
  const rows: T[] = [];

  for (const key of keys) {
    for (const row of map.get(key) || []) {
      const rowKey = String(row.id);
      if (seen.has(rowKey)) continue;
      seen.add(rowKey);
      rows.push(row);
    }
  }

  return rows;
}

function sortDescByDate<T>(rows: T[], pickDate: (row: T) => string | null | undefined) {
  return [...rows].sort((left, right) => {
    const leftTime = Date.parse(pickDate(left) || "");
    const rightTime = Date.parse(pickDate(right) || "");
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  });
}

function daysSince(value: string | null | undefined) {
  const parsed = Date.parse(value || "");
  if (!Number.isFinite(parsed)) return null;
  return Math.floor((Date.now() - parsed) / (1000 * 60 * 60 * 24));
}

function isOverdue(value: string | null | undefined) {
  const parsed = Date.parse(value || "");
  if (!Number.isFinite(parsed)) return false;
  return parsed < Date.now();
}

function isDocumentSigned(row: DocumentRow) {
  const status = text(row.status).toLowerCase();
  return Boolean(row.signed_at) || ["signed", "submitted", "complete", "completed"].some((token) => status.includes(token));
}

function isDocumentReady(row: DocumentRow) {
  const status = text(row.status).toLowerCase();
  return Boolean(text(row.file_name)) || ["ready", "draft", "signed", "submitted", "uploaded"].some((token) =>
    status.includes(token)
  );
}

function isDocumentFiled(row: DocumentRow) {
  const status = text(row.status).toLowerCase();
  return ["filed", "archived", "final"].some((token) => status.includes(token));
}

function buyerDisplayName(buyer: BuyerRow | null | undefined) {
  return firstValue(buyer?.full_name, buyer?.name, buyer?.email, buyer ? `Buyer #${buyer.id}` : "");
}

function defaultProfile(puppyId: number): PuppyAdminProfileRecord {
  return {
    puppyId,
    registeredName: null,
    publicVisibility: true,
    portalVisibility: false,
    featuredListing: false,
    specialCareFlag: false,
    specialCareNotes: null,
    feedingNotes: null,
    lineageNotes: null,
    breederNotes: null,
    buyerPacketReady: false,
    documentPacketReady: false,
    transportReady: false,
    goHomeReady: false,
    updatedAt: null,
  };
}

function toProfile(row: PuppyAdminProfileRow): PuppyAdminProfileRecord {
  return {
    puppyId: Number(row.puppy_id),
    registeredName: text(row.registered_name) || null,
    publicVisibility: row.public_visibility !== false,
    portalVisibility: Boolean(row.portal_visibility),
    featuredListing: Boolean(row.featured_listing),
    specialCareFlag: Boolean(row.special_care_flag),
    specialCareNotes: text(row.special_care_notes) || null,
    feedingNotes: text(row.feeding_notes) || null,
    lineageNotes: text(row.lineage_notes) || null,
    breederNotes: text(row.breeder_notes) || null,
    buyerPacketReady: Boolean(row.buyer_packet_ready),
    documentPacketReady: Boolean(row.document_packet_ready),
    transportReady: Boolean(row.transport_ready),
    goHomeReady: Boolean(row.go_home_ready),
    updatedAt: row.updated_at || null,
  };
}

function toTemplate(row: ChecklistTemplateRow): ChecklistTemplateRecord {
  return {
    id: Number(row.id),
    scope: text(row.scope) || "puppy_development",
    key: text(row.key),
    label: text(row.label),
    description: text(row.description) || null,
    category: text(row.category) || "development",
    sortOrder: numberValue(row.sort_order),
    requiredForWebsite: Boolean(row.required_for_website),
    requiredForPortal: Boolean(row.required_for_portal),
    requiredForGoHome: Boolean(row.required_for_go_home),
    visibleToBuyer: Boolean(row.visible_to_buyer),
    isActive: row.is_active !== false,
  };
}

function toChecklistProgress(
  template: ChecklistTemplateRecord,
  row: ChecklistProgressRow | null
): ChecklistProgressRecord {
  return {
    id: row ? Number(row.id) : null,
    templateId: template.id,
    key: template.key,
    label: template.label,
    category: template.category,
    description: template.description,
    completed: Boolean(row?.completed),
    completedAt: row?.completed_at || null,
    visibleToBuyer: row?.visible_to_buyer ?? template.visibleToBuyer,
    notes: text(row?.notes) || null,
    requiredForWebsite: template.requiredForWebsite,
    requiredForPortal: template.requiredForPortal,
    requiredForGoHome: template.requiredForGoHome,
  };
}

function toWeightRecord(row: PuppyWeightRow): PuppyWeightRecord {
  return {
    id: Number(row.id),
    weighDate: row.weigh_date || row.weight_date || null,
    ageWeeks: row.age_weeks ?? null,
    weightOz: row.weight_oz ?? null,
    weightG: row.weight_g ?? null,
    notes: text(row.notes) || null,
  };
}

function toHealthRecord(row: PuppyHealthRow): PuppyHealthRecordSummary {
  return {
    id: Number(row.id),
    recordDate: row.record_date,
    recordType: text(row.record_type) || "health",
    title: firstValue(row.title, row.record_type, "Health update"),
    description: text(row.description) || null,
    providerName: text(row.provider_name) || null,
    medicationName: text(row.medication_name) || null,
    dosage: text(row.dosage) || null,
    lotNumber: text(row.lot_number) || null,
    nextDueDate: row.next_due_date || null,
    visibleToBuyer: Boolean(row.is_visible_to_buyer),
  };
}

function toEventRecord(row: PuppyEventRow): PuppyEventSummary {
  return {
    id: Number(row.id),
    eventDate: row.event_date,
    eventType: text(row.event_type) || null,
    title: firstValue(row.title, row.label, row.event_type, "Puppy update"),
    summary: firstValue(row.summary, row.details) || null,
    details: text(row.details) || null,
    published: Boolean(row.is_published) && !Boolean(row.is_private),
  };
}

function toMessageTemplate(row: MessageTemplateRow): MessageTemplateRecord {
  return {
    id: Number(row.id),
    templateKey: text(row.template_key),
    category: text(row.category),
    label: text(row.label),
    description: text(row.description) || null,
    channel: text(row.channel) || "email",
    provider: text(row.provider) || "resend",
    subject: text(row.subject),
    body: text(row.body),
    automationEnabled: row.automation_enabled !== false,
    isActive: row.is_active !== false,
    previewPayload:
      row.preview_payload && typeof row.preview_payload === "object" && !Array.isArray(row.preview_payload)
        ? row.preview_payload
        : {},
    updatedAt: row.updated_at || null,
  };
}

function toWorkflowSetting(row: WorkflowSettingRow): WorkflowSettingRecord {
  return {
    id: Number(row.id),
    workflowKey: text(row.workflow_key),
    category: text(row.category),
    label: text(row.label),
    description: text(row.description) || null,
    status: text(row.status) || "active",
    owner: text(row.owner) || null,
    cadenceLabel: text(row.cadence_label) || null,
    triggerLabel: text(row.trigger_label) || null,
    nextRunHint: text(row.next_run_hint) || null,
    settings:
      row.settings && typeof row.settings === "object" && !Array.isArray(row.settings)
        ? row.settings
        : {},
    isVisible: row.is_visible !== false,
    updatedAt: row.updated_at || null,
  };
}

function buildCareSummary(
  puppy: {
    ageWeeks: number | null;
    currentWeight: number | null;
    weightUnit: string | null;
    weightDate: string | null;
  },
  weights: PuppyWeightRecord[],
  healthRecords: PuppyHealthRecordSummary[],
  events: PuppyEventSummary[]
): PuppyCareSummary {
  const sortedWeights = sortDescByDate(weights, (row) => row.weighDate);
  const sortedHealth = sortDescByDate(healthRecords, (row) => row.recordDate);
  const sortedEvents = sortDescByDate(events, (row) => row.eventDate);

  const latestWeight =
    sortedWeights[0] ||
    (puppy.currentWeight != null || text(puppy.weightDate)
      ? {
          id: 0,
          weighDate: puppy.weightDate,
          ageWeeks: puppy.ageWeeks,
          weightOz: puppy.weightUnit === "g" ? null : puppy.currentWeight,
          weightG: puppy.weightUnit === "g" ? puppy.currentWeight : null,
          notes: null,
        }
      : null);
  const latestVaccine =
    sortedHealth.find((row) =>
      ["vaccine", "vaccination", "shots", "shot"].some((keyword) =>
        [row.recordType, row.title, row.description].map((value) => text(value).toLowerCase()).join(" ").includes(keyword)
      )
    ) || null;
  const latestDeworming =
    sortedHealth.find((row) =>
      ["deworm", "worm", "de-worm"].some((keyword) =>
        [row.recordType, row.title, row.description].map((value) => text(value).toLowerCase()).join(" ").includes(keyword)
      )
    ) || null;

  const weightDue =
    (puppy.ageWeeks == null || puppy.ageWeeks >= 1) &&
    (!latestWeight?.weighDate || (daysSince(latestWeight.weighDate) ?? 999) > 7);
  const vaccineDue =
    puppy.ageWeeks != null &&
    puppy.ageWeeks >= 6 &&
    (!latestVaccine || (latestVaccine.nextDueDate ? isOverdue(latestVaccine.nextDueDate) : false));
  const dewormingDue =
    puppy.ageWeeks != null &&
    puppy.ageWeeks >= 2 &&
    (!latestDeworming || (latestDeworming.nextDueDate ? isOverdue(latestDeworming.nextDueDate) : false));

  return {
    latestWeight,
    latestVaccine,
    latestDeworming,
    latestHealthRecord: sortedHealth[0] || null,
    latestEvent: sortedEvents[0] || null,
    weights: sortedWeights.slice(0, 10),
    healthRecords: sortedHealth.slice(0, 10),
    events: sortedEvents.slice(0, 10),
    weightDue,
    vaccineDue,
    dewormingDue,
    missingRecords: [
      ...(weightDue ? ["Weekly weight entry"] : []),
      ...(vaccineDue ? ["Vaccine record"] : []),
      ...(dewormingDue ? ["Deworming record"] : []),
    ],
  };
}

function buildDocumentSummary(documents: DocumentRow[]): PuppyDocumentSummary {
  return {
    total: documents.length,
    ready: documents.filter(isDocumentReady).length,
    signed: documents.filter(isDocumentSigned).length,
    filed: documents.filter(isDocumentFiled).length,
    latestTitle: firstValue(documents[0]?.title),
  };
}

function buildPortalSummary(
  hasPortalAccount: boolean,
  forms: FormRow[],
  messages: PortalMessageRow[]
): PuppyPortalSummary {
  return {
    hasPortalAccount,
    formsTotal: forms.length,
    unsignedForms: forms.filter((row) => {
      const status = text(row.status).toLowerCase();
      return !["signed", "submitted", "complete", "completed"].some((token) => status.includes(token));
    }).length,
    unreadMessages: messages.filter((row) => row.sender === "user" && !row.read_by_admin).length,
    latestMessageAt: messages[0]?.created_at || null,
  };
}

function buildPaymentSummary(
  salePrice: number | null,
  depositRecorded: number,
  payments: PaymentRow[],
  explicitBalance: number | null,
  overdue: boolean
): PuppyPaymentSummary {
  const paymentsTotal = payments.reduce((sum, row) => {
    const status = text(row.status).toLowerCase();
    if (["failed", "void", "cancelled", "canceled"].includes(status)) return sum;
    return sum + numberValue(row.amount);
  }, 0);
  const remainingBalance =
    explicitBalance != null
      ? explicitBalance
      : salePrice != null
        ? Math.max(0, salePrice - paymentsTotal)
        : null;

  return {
    salePrice,
    depositRecorded,
    paymentsTotal,
    remainingBalance,
    overdue: overdue && (remainingBalance || 0) > 0,
  };
}

function buildReadiness(
  puppy: {
    status: string | null;
    description: string | null;
    buyerId: number | null;
  },
  profile: PuppyAdminProfileRecord,
  checklist: ChecklistProgressRecord[],
  care: PuppyCareSummary,
  documentSummary: PuppyDocumentSummary,
  portalSummary: PuppyPortalSummary,
  paymentSummary: PuppyPaymentSummary,
  hasPhoto: boolean,
  activeTemplateCount: number
): PuppyReadinessSummary {
  const current = isCurrentPuppyStatus(puppy.status);
  const photoReady = hasPhoto;
  const copyReady = Boolean(text(puppy.description));
  const buyerLinked = Number(puppy.buyerId || 0) > 0;

  const websiteMissing = [
    !photoReady ? "Photo set" : null,
    !copyReady ? "Website copy" : null,
    !profile.publicVisibility ? "Public visibility is off" : null,
    ...checklist.filter((row) => row.requiredForWebsite && !row.completed).map((row) => row.label),
  ].filter(Boolean) as string[];
  const portalMissing = [
    !buyerLinked ? "Buyer assignment" : null,
    !profile.portalVisibility ? "Portal visibility is off" : null,
    buyerLinked && !portalSummary.hasPortalAccount ? "Buyer portal account" : null,
    ...checklist.filter((row) => row.requiredForPortal && !row.completed).map((row) => row.label),
  ].filter(Boolean) as string[];
  const documentsMissing = [
    !profile.documentPacketReady ? "Document packet not marked ready" : null,
    documentSummary.total === 0 ? "No documents on file" : null,
    portalSummary.unsignedForms > 0 ? "Unsigned buyer forms" : null,
  ].filter(Boolean) as string[];
  const messagingMissing = [
    activeTemplateCount === 0 ? "No active message templates" : null,
    !buyerLinked ? "Buyer assignment" : null,
  ].filter(Boolean) as string[];
  const placementMissing = [
    !buyerLinked ? "Buyer assignment" : null,
    !profile.transportReady ? "Transport or pickup readiness" : null,
    paymentSummary.remainingBalance && paymentSummary.remainingBalance > 0 ? "Balance still open" : null,
  ].filter(Boolean) as string[];
  const goHomeMissing = [
    !profile.goHomeReady ? "Go-home status is not marked ready" : null,
    !profile.buyerPacketReady ? "Buyer packet not ready" : null,
    !profile.documentPacketReady ? "Document packet not ready" : null,
    !profile.transportReady ? "Transport or pickup plan" : null,
    ...checklist.filter((row) => row.requiredForGoHome && !row.completed).map((row) => row.label),
  ].filter(Boolean) as string[];

  return {
    website: buildReadinessState(websiteMissing, current ? [] : ["Inactive puppy status"]),
    portal: buildReadinessState(portalMissing, buyerLinked ? [] : ["No buyer is linked to this puppy yet"]),
    documents: buildReadinessState(
      documentsMissing,
      buyerLinked ? [] : ["No buyer is linked to this puppy yet"]
    ),
    messaging: buildReadinessState(
      messagingMissing,
      buyerLinked ? [] : ["No buyer is linked to this puppy yet"]
    ),
    placement: buildReadinessState(
      placementMissing,
      paymentSummary.overdue ? ["Payment account is overdue"] : []
    ),
    goHome: buildReadinessState(
      goHomeMissing,
      [
        ...(care.weightDue ? ["Weekly weight is overdue"] : []),
        ...(care.vaccineDue ? ["Vaccine record is due"] : []),
        ...(care.dewormingDue ? ["Deworming record is due"] : []),
      ]
    ),
    photoReady,
    copyReady,
    buyerLinked,
  };
}

function buildAttentionList(
  profile: PuppyAdminProfileRecord,
  care: PuppyCareSummary,
  readiness: PuppyReadinessSummary,
  portalSummary: PuppyPortalSummary,
  paymentSummary: PuppyPaymentSummary
) {
  const items: string[] = [];
  if (care.weightDue) items.push("Needs a weekly weight entry");
  if (care.vaccineDue) items.push("Needs a vaccine record");
  if (care.dewormingDue) items.push("Needs a deworming record");
  if (!readiness.photoReady) items.push("Missing a photo");
  if (!readiness.copyReady) items.push("Missing website copy");
  if (!readiness.buyerLinked) items.push("Missing buyer assignment");
  if (portalSummary.unsignedForms > 0) items.push("Buyer forms still need signature");
  if (paymentSummary.overdue) items.push("Payment account is overdue");
  if (profile.specialCareFlag) items.push("Special care flag is active");
  return items;
}

function metricTone(value: number, warnAt = 1): "neutral" | "success" | "warning" | "danger" {
  if (value <= 0) return "success";
  if (value >= warnAt * 3) return "danger";
  return "warning";
}

function buildProgramContext(
  puppies: Array<
    Pick<
      PuppyWorkspaceRecord,
      | "id"
      | "displayName"
      | "sex"
      | "color"
      | "coatType"
      | "status"
      | "publicPrice"
      | "description"
      | "profile"
    >
  >,
  litters: LitterWorkspaceRecord[]
): ChiChiProgramContext {
  const publicPuppies = puppies
    .filter((puppy) => puppy.profile.publicVisibility && !isPastPuppyStatus(puppy.status))
    .map((puppy) => ({
      id: puppy.id,
      name: puppy.displayName,
      sex: puppy.sex,
      color: puppy.color,
      coatType: puppy.coatType,
      status: puppy.status,
      price: puppy.publicPrice,
      description: puppy.description,
    }));
  const upcomingLitters = litters
    .filter((litter) => !["completed", "archived"].some((token) => text(litter.status).toLowerCase().includes(token)))
    .slice(0, 4)
    .map((litter) => ({
      id: litter.id,
      name: litter.displayName,
      whelpDate: litter.whelpDate,
      status: litter.status,
      damName: litter.damName,
      sireName: litter.sireName,
    }));

  let publicAvailabilitySummary = "";
  if (publicPuppies.length) {
    publicAvailabilitySummary = `${publicPuppies.length} puppy${publicPuppies.length === 1 ? " is" : "ies are"} currently visible in the live program record.`;
  } else if (upcomingLitters[0]) {
    publicAvailabilitySummary = `No puppies are currently marked public and available. The next litter on file is ${upcomingLitters[0].name}${upcomingLitters[0].whelpDate ? ` on ${upcomingLitters[0].whelpDate}` : ""}.`;
  } else {
    publicAvailabilitySummary = "No puppies are currently marked public and available in the live program record.";
  }

  return {
    publicAvailabilitySummary,
    availablePuppies: publicPuppies,
    upcomingLitters,
    customerCapabilities: [
      "Answer account-aware buyer questions when the user is signed in.",
      "Explain puppy status, payments, documents, pickup, transport, and portal next steps.",
      "Answer general Chihuahua care and breeding-program questions in a clear, natural way.",
    ],
    adminCapabilities: [
      "Summarize puppies missing care updates, photos, copy, buyer linkage, portal readiness, or documents.",
      "Help draft buyer communication, payment reminders, and progress updates.",
      "Surface broader breeding-program issues across litters, breeding dogs, buyers, and readiness workflows.",
    ],
  };
}
export async function loadPuppiesSystemSnapshot(
  service: SupabaseClient = createServiceSupabase(),
  ownerEmail: string | null = null
): Promise<PuppiesSystemSnapshot> {
  const lineage = await loadAdminLineageWorkspace(service);

  const [
    authUsers,
    buyers,
    puppyMetaRows,
    payments,
    forms,
    messages,
    documents,
    pickups,
    weights,
    healthRows,
    events,
    profileRows,
    templateRows,
    progressRows,
    messageTemplateRows,
    workflowRows,
  ] = await Promise.all([
    safeAuthUsers(),
    safeRows<BuyerRow>(
      service
        .from("buyers")
        .select(
          "id,user_id,full_name,name,email,phone,status,notes,sale_price,deposit_amount,finance_enabled,finance_next_due_date,delivery_option,delivery_date,delivery_location"
        )
        .order("created_at", { ascending: false })
    ),
    safeRows<PuppyMetaRow>(
      service
        .from("puppies")
        .select("id,registry,current_weight,weight_unit,weight_date,microchip,registration_no")
    ),
    safeRows<PaymentRow>(
      service
        .from("buyer_payments")
        .select("id,buyer_id,puppy_id,amount,payment_date,status,created_at")
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false })
    ),
    safeRows<FormRow>(
      service
        .from("portal_form_submissions")
        .select("id,user_id,user_email,email,form_key,form_title,status,signed_at,submitted_at,created_at")
        .order("created_at", { ascending: false })
    ),
    safeRows<PortalMessageRow>(
      service
        .from("portal_messages")
        .select("id,user_id,user_email,sender,subject,message,read_by_admin,read_by_user,created_at")
        .order("created_at", { ascending: false })
    ),
    safeRows<DocumentRow>(
      service
        .from("portal_documents")
        .select("id,user_id,buyer_id,title,category,status,file_name,visible_to_user,signed_at,created_at")
        .order("created_at", { ascending: false })
    ),
    safeRows<PickupRow>(
      service
        .from("portal_pickup_requests")
        .select("id,user_id,puppy_id,request_type,request_date,status,created_at")
        .order("created_at", { ascending: false })
    ),
    safeRows<PuppyWeightRow>(
      service
        .from("puppy_weights")
        .select("id,puppy_id,weigh_date,weight_date,age_weeks,weight_oz,weight_g,notes")
        .order("weigh_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false })
    ),
    safeRows<PuppyHealthRow>(
      service
        .from("puppy_health_records")
        .select(
          "id,puppy_id,record_date,record_type,title,description,provider_name,medication_name,dosage,lot_number,next_due_date,is_visible_to_buyer"
        )
        .order("record_date", { ascending: false })
        .order("created_at", { ascending: false, nullsFirst: false })
    ),
    safeRows<PuppyEventRow>(
      service
        .from("puppy_events")
        .select("id,puppy_id,event_date,event_type,label,title,summary,details,is_published,is_private")
        .order("event_date", { ascending: false })
        .order("created_at", { ascending: false, nullsFirst: false })
    ),
    safeRows<PuppyAdminProfileRow>(
      service
        .from("puppy_admin_profiles")
        .select(
          "puppy_id,registered_name,public_visibility,portal_visibility,featured_listing,special_care_flag,special_care_notes,feeding_notes,lineage_notes,breeder_notes,buyer_packet_ready,document_packet_ready,transport_ready,go_home_ready,updated_at"
        )
    ),
    safeRows<ChecklistTemplateRow>(
      service
        .from("admin_checklist_templates")
        .select(
          "id,scope,key,label,description,category,sort_order,required_for_website,required_for_portal,required_for_go_home,visible_to_buyer,is_active"
        )
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true })
    ),
    safeRows<ChecklistProgressRow>(
      service
        .from("puppy_checklist_progress")
        .select("id,puppy_id,template_id,completed,completed_at,visible_to_buyer,notes")
        .order("updated_at", { ascending: false })
    ),
    safeRows<MessageTemplateRow>(
      service
        .from("admin_message_templates")
        .select(
          "id,template_key,category,label,description,channel,provider,subject,body,automation_enabled,is_active,preview_payload,updated_at"
        )
        .order("category", { ascending: true })
        .order("label", { ascending: true })
    ),
    safeRows<WorkflowSettingRow>(
      service
        .from("admin_workflow_settings")
        .select(
          "id,workflow_key,category,label,description,status,owner,cadence_label,trigger_label,next_run_hint,settings,is_visible,updated_at"
        )
        .order("category", { ascending: true })
        .order("label", { ascending: true })
    ),
  ]);

  const authByEmail = new Map(
    authUsers
      .map((user) => [normalizeEmail(user.email), user] as const)
      .filter(([email]) => !!email)
  );
  const buyerById = new Map<number, BuyerRow>();
  buyers.forEach((buyer) => buyerById.set(Number(buyer.id), buyer));

  const puppyMetaById = new Map<number, PuppyMetaRow>();
  puppyMetaRows.forEach((row) => puppyMetaById.set(Number(row.id), row));

  const formsByKey = new Map<string, FormRow[]>();
  forms.forEach((row) => {
    identityKeys(row.user_id, firstValue(row.user_email, row.email)).forEach((key) =>
      groupPush(formsByKey, key, row)
    );
  });

  const messagesByKey = new Map<string, PortalMessageRow[]>();
  messages.forEach((row) => {
    identityKeys(row.user_id, row.user_email).forEach((key) => groupPush(messagesByKey, key, row));
  });

  const documentsByBuyerId = new Map<number, DocumentRow[]>();
  documents.forEach((row) => {
    const buyerId = Number(row.buyer_id || 0);
    if (!buyerId) return;
    const next = documentsByBuyerId.get(buyerId) || [];
    next.push(row);
    documentsByBuyerId.set(buyerId, next);
  });

  const paymentsByBuyerId = new Map<number, PaymentRow[]>();
  payments.forEach((row) => {
    const buyerId = Number(row.buyer_id || 0);
    if (!buyerId) return;
    const next = paymentsByBuyerId.get(buyerId) || [];
    next.push(row);
    paymentsByBuyerId.set(buyerId, next);
  });

  const pickupByUserId = new Map<string, PickupRow>();
  const pickupByPuppyId = new Map<number, PickupRow>();
  pickups.forEach((row) => {
    const userId = text(row.user_id);
    const puppyId = Number(row.puppy_id || 0);
    if (userId && !pickupByUserId.has(userId)) pickupByUserId.set(userId, row);
    if (puppyId && !pickupByPuppyId.has(puppyId)) pickupByPuppyId.set(puppyId, row);
  });

  const weightsByPuppyId = new Map<number, PuppyWeightRecord[]>();
  weights.forEach((row) => {
    const puppyId = Number(row.puppy_id || 0);
    if (!puppyId) return;
    const next = weightsByPuppyId.get(puppyId) || [];
    next.push(toWeightRecord(row));
    weightsByPuppyId.set(puppyId, next);
  });

  const healthByPuppyId = new Map<number, PuppyHealthRecordSummary[]>();
  healthRows.forEach((row) => {
    const puppyId = Number(row.puppy_id || 0);
    if (!puppyId) return;
    const next = healthByPuppyId.get(puppyId) || [];
    next.push(toHealthRecord(row));
    healthByPuppyId.set(puppyId, next);
  });

  const eventsByPuppyId = new Map<number, PuppyEventSummary[]>();
  events.forEach((row) => {
    const puppyId = Number(row.puppy_id || 0);
    if (!puppyId) return;
    const next = eventsByPuppyId.get(puppyId) || [];
    next.push(toEventRecord(row));
    eventsByPuppyId.set(puppyId, next);
  });

  const profileByPuppyId = new Map<number, PuppyAdminProfileRecord>();
  profileRows.forEach((row) => profileByPuppyId.set(Number(row.puppy_id), toProfile(row)));

  const checklistTemplates = templateRows
    .map(toTemplate)
    .filter((row) => row.scope === "puppy_development" && row.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder);

  const checklistProgressByPuppy = new Map<string, ChecklistProgressRow>();
  progressRows.forEach((row) => {
    const puppyId = Number(row.puppy_id || 0);
    const templateId = Number(row.template_id || 0);
    if (!puppyId || !templateId) return;
    checklistProgressByPuppy.set(`${puppyId}:${templateId}`, row);
  });

  const messageTemplates = messageTemplateRows.map(toMessageTemplate);
  const workflowSettings = workflowRows.map(toWorkflowSetting);
  const activeTemplateCount = messageTemplates.filter((row) => row.isActive).length;

  const puppies: PuppyWorkspaceRecord[] = lineage.puppies.map((puppy) => {
    const meta = puppyMetaById.get(Number(puppy.id)) || null;
    const buyer = buyerById.get(Number(puppy.buyer?.id || puppy.buyer_id || 0)) || null;
    const buyerEmail = firstValue(buyer?.email, puppy.buyer?.email, puppy.owner_email);
    const authUser = buyer?.user_id
      ? authUsers.find((user) => user.id === buyer.user_id) || null
      : authByEmail.get(normalizeEmail(buyerEmail)) || null;
    const resolvedUserId = firstValue(buyer?.user_id, authUser?.id);
    const buyerForms = sortDescByDate(
      mergeIdentityRows(formsByKey, resolvedUserId, buyerEmail),
      (row) => firstValue(row.submitted_at, row.signed_at, row.created_at)
    );
    const buyerMessages = sortDescByDate(
      mergeIdentityRows(messagesByKey, resolvedUserId, buyerEmail),
      (row) => row.created_at
    );
    const buyerDocuments = sortDescByDate(
      documentsByBuyerId.get(Number(buyer?.id || 0)) || [],
      (row) => row.created_at
    );
    const buyerPayments = sortDescByDate(
      paymentsByBuyerId.get(Number(buyer?.id || 0)) || [],
      (row) => firstValue(row.payment_date, row.created_at)
    );
    const pickup =
      pickupByPuppyId.get(Number(puppy.id)) ||
      (resolvedUserId ? pickupByUserId.get(resolvedUserId) || null : null);
    const profile = profileByPuppyId.get(Number(puppy.id)) || defaultProfile(Number(puppy.id));
    const checklist = checklistTemplates.map((template) =>
      toChecklistProgress(template, checklistProgressByPuppy.get(`${puppy.id}:${template.id}`) || null)
    );
    const care = buildCareSummary(
      {
        ageWeeks: ageInWeeks(puppy.dob),
        currentWeight: meta?.current_weight ?? null,
        weightUnit: text(meta?.weight_unit) || null,
        weightDate: meta?.weight_date || null,
      },
      weightsByPuppyId.get(Number(puppy.id)) || [],
      healthByPuppyId.get(Number(puppy.id)) || [],
      eventsByPuppyId.get(Number(puppy.id)) || []
    );
    const documentSummary = buildDocumentSummary(buyerDocuments);
    const portalSummary = buildPortalSummary(Boolean(authUser || resolvedUserId), buyerForms, buyerMessages);
    const overduePayment = Boolean(
      buyer?.finance_enabled &&
        text(buyer.finance_next_due_date) &&
        isOverdue(buyer.finance_next_due_date)
    );
    const paymentSummary = buildPaymentSummary(
      puppy.salePrice || (buyer?.sale_price ?? null),
      puppy.depositTotal || (buyer?.deposit_amount ?? 0),
      buyerPayments,
      puppy.balance ?? null,
      overduePayment
    );
    const readiness = buildReadiness(
      {
        status: text(puppy.status) || null,
        description: text(puppy.description) || null,
        buyerId: Number(buyer?.id || puppy.buyer?.id || puppy.buyer_id || 0) || null,
      },
      profile,
      checklist,
      care,
      documentSummary,
      portalSummary,
      paymentSummary,
      Boolean(text(puppy.photo_url || puppy.image_url)),
      activeTemplateCount
    );
    const attention = buildAttentionList(profile, care, readiness, portalSummary, paymentSummary);

    return {
      id: Number(puppy.id),
      displayName: puppy.displayName,
      callName: text(puppy.call_name) || null,
      registeredName: profile.registeredName,
      sex: text(puppy.sex) || null,
      color: text(puppy.color) || null,
      coatType: text(puppy.coat_type || puppy.coat) || null,
      dob: puppy.dob || null,
      ageWeeks: ageInWeeks(puppy.dob),
      registry: text(meta?.registry) || null,
      status: text(puppy.status) || null,
      price: puppy.salePrice || null,
      listPrice: puppy.listPrice || null,
      publicPrice: puppy.publicPrice ?? null,
      photoUrl: firstValue(puppy.photo_url, puppy.image_url) || null,
      description: text(puppy.description) || null,
      notes: text(puppy.notes) || null,
      currentWeight: meta?.current_weight ?? null,
      weightUnit: text(meta?.weight_unit) || null,
      weightDate: meta?.weight_date || null,
      litterId: Number(puppy.litter?.id || puppy.litter_id || 0) || null,
      litterName: firstValue(puppy.litter_name) || null,
      damId: text(puppy.damProfile?.id || puppy.dam_id) || null,
      damName: firstValue(puppy.damProfile?.displayName, puppy.dam) || null,
      sireId: text(puppy.sireProfile?.id || puppy.sire_id) || null,
      sireName: firstValue(puppy.sireProfile?.displayName, puppy.sire) || null,
      buyerId: Number(buyer?.id || puppy.buyer?.id || puppy.buyer_id || 0) || null,
      buyerName: buyerDisplayName(buyer),
      buyerEmail: buyerEmail || null,
      buyerStatus: text(buyer?.status) || null,
      buyerPortalLinked: Boolean(authUser || resolvedUserId),
      transportRequestType: text(pickup?.request_type) || null,
      transportRequestStatus: text(pickup?.status) || null,
      profile,
      checklist,
      care,
      readiness,
      attention,
      documentSummary,
      portalSummary,
      paymentSummary,
    };
  });

  const litters: LitterWorkspaceRecord[] = lineage.litters.map((litter) => {
    const litterPuppies = puppies.filter((puppy) => puppy.litterId === Number(litter.id));
    const pendingTasks = Array.from(
      new Set(
        litterPuppies.flatMap((puppy) => [
          ...(puppy.care.weightDue ? ["Weights need attention"] : []),
          ...(puppy.care.vaccineDue ? ["Vaccines need attention"] : []),
          ...(puppy.care.dewormingDue ? ["Deworming needs attention"] : []),
          ...(!puppy.readiness.photoReady ? ["Photos missing"] : []),
          ...(!puppy.readiness.copyReady ? ["Website copy missing"] : []),
          ...(puppy.attention.length ? ["Puppies still need admin attention"] : []),
        ])
      )
    );

    return {
      id: Number(litter.id),
      displayName: litter.displayName,
      litterCode: text(litter.litter_code) || null,
      whelpDate: litter.whelp_date || null,
      status: text(litter.status) || null,
      notes: text(litter.notes) || null,
      damId: text(litter.damProfile?.id || litter.dam_id) || null,
      damName: firstValue(litter.damProfile?.displayName),
      sireId: text(litter.sireProfile?.id || litter.sire_id) || null,
      sireName: firstValue(litter.sireProfile?.displayName),
      puppyIds: litterPuppies.map((puppy) => puppy.id),
      puppyCount: litterPuppies.length,
      currentPuppyCount: litterPuppies.filter((puppy) => isCurrentPuppyStatus(puppy.status)).length,
      pastPuppyCount: litterPuppies.filter((puppy) => isPastPuppyStatus(puppy.status)).length,
      pendingTasks,
    };
  });

  const breedingDogs: BreedingDogWorkspaceRecord[] = lineage.dogs.map((dog) => ({
    id: String(dog.id),
    role: text(dog.role) || null,
    displayName: dog.displayName,
    registeredName: text(dog.name) || null,
    callName: text(dog.call_name) || null,
    status: text(dog.status) || null,
    dob: dog.dob || dog.date_of_birth || null,
    color: text(dog.color) || null,
    coat: text(dog.coat) || null,
    registry: text(dog.registry) || null,
    notes: text(dog.notes) || null,
    geneticsSummary: text(dog.genetics_summary) || null,
    litterCount: Number(dog.summary.totalLitters || 0),
    puppyCount: Number(dog.summary.totalPuppies || 0),
  }));

  const buyerRecords: BuyerWorkspaceRecord[] = buyers.map((buyer) => {
    const linkedPuppies = puppies.filter((puppy) => puppy.buyerId === Number(buyer.id));
    const authUser = buyer.user_id
      ? authUsers.find((user) => user.id === buyer.user_id) || null
      : authByEmail.get(normalizeEmail(buyer.email)) || null;
    const formsForBuyer = sortDescByDate(
      mergeIdentityRows(formsByKey, firstValue(buyer.user_id, authUser?.id), buyer.email),
      (row) => firstValue(row.submitted_at, row.signed_at, row.created_at)
    );
    const messagesForBuyer = sortDescByDate(
      mergeIdentityRows(messagesByKey, firstValue(buyer.user_id, authUser?.id), buyer.email),
      (row) => row.created_at
    );
    const documentsForBuyer = sortDescByDate(
      documentsByBuyerId.get(Number(buyer.id)) || [],
      (row) => row.created_at
    );
    const paymentsForBuyer = sortDescByDate(
      paymentsByBuyerId.get(Number(buyer.id)) || [],
      (row) => firstValue(row.payment_date, row.created_at)
    );
    const salePrice =
      buyer.sale_price ?? linkedPuppies[0]?.paymentSummary.salePrice ?? linkedPuppies[0]?.price ?? null;
    const paymentsTotal = paymentsForBuyer.reduce((sum, row) => sum + numberValue(row.amount), 0);
    const remainingBalance =
      salePrice != null ? Math.max(0, numberValue(salePrice) - paymentsTotal) : null;

    return {
      id: Number(buyer.id),
      displayName: buyerDisplayName(buyer),
      email: text(buyer.email) || null,
      phone: text(buyer.phone) || null,
      status: text(buyer.status) || null,
      linkedPuppyIds: linkedPuppies.map((puppy) => puppy.id),
      linkedPuppyNames: linkedPuppies.map((puppy) => puppy.displayName),
      formsTotal: formsForBuyer.length,
      unsignedForms: formsForBuyer.filter((row) => {
        const status = text(row.status).toLowerCase();
        return !["signed", "submitted", "complete", "completed"].some((token) => status.includes(token));
      }).length,
      documentsReady: documentsForBuyer.filter(isDocumentReady).length,
      documentsSigned: documentsForBuyer.filter(isDocumentSigned).length,
      unreadMessages: messagesForBuyer.filter((row) => row.sender === "user" && !row.read_by_admin).length,
      salePrice,
      depositAmount: buyer.deposit_amount ?? null,
      paymentsTotal,
      remainingBalance,
      overdue:
        Boolean(buyer.finance_enabled) &&
        text(buyer.finance_next_due_date) !== "" &&
        isOverdue(buyer.finance_next_due_date) &&
        (remainingBalance || 0) > 0,
      hasPortalAccount: Boolean(authUser || text(buyer.user_id)),
      pickupStatus:
        text(
          pickupByUserId.get(firstValue(buyer.user_id, authUser?.id))?.status ||
            linkedPuppies[0]?.transportRequestStatus
        ) || null,
    };
  });

  const documentRecords: DocumentWorkflowRecord[] = documents.map((row) => {
    const buyer = buyerById.get(Number(row.buyer_id || 0)) || null;
    const linkedPuppies = puppies.filter((puppy) => puppy.buyerId === Number(row.buyer_id || 0));
    return {
      id: String(row.id),
      title: firstValue(row.title, row.file_name, "Document"),
      category: text(row.category) || null,
      status: text(row.status) || null,
      buyerId: Number(row.buyer_id || 0) || null,
      buyerName: buyerDisplayName(buyer),
      puppyName: linkedPuppies[0]?.displayName || null,
      visibleToUser: row.visible_to_user !== false,
      signedAt: row.signed_at || null,
      createdAt: row.created_at || null,
    };
  });

  const recentActivity: ActivityFeedItem[] = [
    ...weights.slice(0, 12).map((row) => {
      const puppy = puppies.find((candidate) => candidate.id === Number(row.puppy_id || 0));
      return {
        id: `weight-${row.id}`,
        kind: "weight" as const,
        title: puppy ? `${puppy.displayName} weight logged` : "Weight logged",
        detail:
          row.weight_oz != null
            ? `${row.weight_oz} oz`
            : row.weight_g != null
              ? `${row.weight_g} g`
              : "Weight entry saved",
        occurredAt: row.weigh_date || row.weight_date || null,
        puppyId: puppy?.id || null,
        puppyName: puppy?.displayName || null,
      };
    }),
    ...healthRows.slice(0, 12).map((row) => {
      const puppy = puppies.find((candidate) => candidate.id === Number(row.puppy_id || 0));
      return {
        id: `health-${row.id}`,
        kind: "health" as const,
        title: puppy ? `${puppy.displayName} care update` : "Care update",
        detail: firstValue(row.title, row.record_type, "Health record"),
        occurredAt: row.record_date || null,
        puppyId: puppy?.id || null,
        puppyName: puppy?.displayName || null,
      };
    }),
    ...events.slice(0, 12).map((row) => {
      const puppy = puppies.find((candidate) => candidate.id === Number(row.puppy_id || 0));
      return {
        id: `event-${row.id}`,
        kind: "event" as const,
        title: puppy ? `${puppy.displayName} milestone update` : "Milestone update",
        detail: firstValue(row.title, row.label, row.event_type, "Puppy event"),
        occurredAt: row.event_date || null,
        puppyId: puppy?.id || null,
        puppyName: puppy?.displayName || null,
      };
    }),
    ...documents.slice(0, 8).map((row) => {
      const buyer = buyerById.get(Number(row.buyer_id || 0)) || null;
      return {
        id: `document-${row.id}`,
        kind: "document" as const,
        title: `${firstValue(row.title, row.file_name, "Document")} updated`,
        detail: firstValue(row.status, row.category, "Document workflow item"),
        occurredAt: row.created_at || null,
        buyerId: Number(row.buyer_id || 0) || null,
        buyerName: buyerDisplayName(buyer),
      };
    }),
    ...messages.slice(0, 8).map((row) => ({
      id: `message-${row.id}`,
      kind: "message" as const,
      title: firstValue(row.subject, "Buyer portal message"),
      detail: firstValue(row.message, "Message activity"),
      occurredAt: row.created_at || null,
    })),
    ...payments.slice(0, 8).map((row) => {
      const buyer = buyerById.get(Number(row.buyer_id || 0)) || null;
      return {
        id: `payment-${row.id}`,
        kind: "payment" as const,
        title: buyer ? `${buyerDisplayName(buyer)} payment logged` : "Payment logged",
        detail: row.amount != null ? `$${numberValue(row.amount).toLocaleString()}` : "Payment update",
        occurredAt: row.payment_date || row.created_at || null,
        buyerId: Number(row.buyer_id || 0) || null,
        buyerName: buyerDisplayName(buyer),
      };
    }),
    ...messageTemplateRows.slice(0, 5).map((row) => ({
      id: `template-${row.id}`,
      kind: "template" as const,
      title: `${firstValue(row.label, row.template_key, "Template")} updated`,
      detail: firstValue(row.category, "Messaging template"),
      occurredAt: row.updated_at || null,
    })),
    ...workflowRows.slice(0, 5).map((row) => ({
      id: `workflow-${row.id}`,
      kind: "workflow" as const,
      title: `${firstValue(row.label, row.workflow_key, "Workflow")} updated`,
      detail: firstValue(row.status, row.category, "Workflow setting"),
      occurredAt: row.updated_at || null,
    })),
  ]
    .filter((item) => item.occurredAt)
    .sort((left, right) => Date.parse(right.occurredAt || "") - Date.parse(left.occurredAt || ""))
    .slice(0, 16);

  const currentPuppies = puppies.filter((row) => isCurrentPuppyStatus(row.status));
  const pastPuppies = puppies.filter((row) => isPastPuppyStatus(row.status));
  const availablePuppies = currentPuppies.filter((row) => !isReservedPuppyStatus(row.status));
  const reservedPuppies = currentPuppies.filter((row) => isReservedPuppyStatus(row.status));
  const careDueCount = new Set(
    currentPuppies
      .filter((row) => row.care.weightDue || row.care.vaccineDue || row.care.dewormingDue)
      .map((row) => row.id)
  ).size;
  const readyForWebsite = currentPuppies.filter((row) => row.readiness.website.ready);
  const readyForPortal = currentPuppies.filter((row) => row.readiness.portal.ready);
  const readyForDocuments = currentPuppies.filter((row) => row.readiness.documents.ready);
  const activeLitters = litters.filter((row) =>
    !["completed", "archived"].some((token) => text(row.status).toLowerCase().includes(token))
  );
  const adminAttentionCount = currentPuppies.filter((row) => row.attention.length > 0).length;

  const metrics: PuppiesSystemMetric[] = [
    {
      key: "current",
      label: "Current Puppies",
      value: currentPuppies.length,
      detail: "Actively managed puppies still moving through care, readiness, and placement.",
      tone: "neutral",
    },
    {
      key: "reserved",
      label: "Reserved Puppies",
      value: reservedPuppies.length,
      detail: "Linked or held puppies that still need breeder follow-through before completion.",
      tone: "neutral",
    },
    {
      key: "available",
      label: "Available Puppies",
      value: availablePuppies.length,
      detail: "Puppies still open for listing, inquiry, and buyer matching work.",
      tone: "success",
    },
    {
      key: "past",
      label: "Past Puppies",
      value: pastPuppies.length,
      detail: "Completed, sold, archived, or otherwise inactive puppy records.",
      tone: "neutral",
    },
    {
      key: "care-due",
      label: "Care Due",
      value: careDueCount,
      detail: "Current puppies with overdue weight, vaccine, or deworming attention.",
      tone: metricTone(careDueCount),
    },
    {
      key: "website-ready",
      label: "Website Ready",
      value: readyForWebsite.length,
      detail: "Current puppies ready for public listing without missing photos or copy gaps.",
      tone: "success",
    },
    {
      key: "portal-ready",
      label: "Portal Ready",
      value: readyForPortal.length,
      detail: "Current puppies ready for buyer portal visibility and linked account use.",
      tone: "success",
    },
    {
      key: "document-ready",
      label: "Document Ready",
      value: readyForDocuments.length,
      detail: "Current puppies with document workflows clear enough to keep placement moving.",
      tone: "success",
    },
    {
      key: "active-litters",
      label: "Active Litters",
      value: activeLitters.length,
      detail: "Litters still relevant to active puppy management and ongoing program work.",
      tone: "neutral",
    },
    {
      key: "admin-attention",
      label: "Needs Attention",
      value: adminAttentionCount,
      detail: "Current puppies with missing readiness, care, buyer, payment, or document follow-up.",
      tone: metricTone(adminAttentionCount, 2),
    },
  ];

  return {
    fetchedAt: new Date().toISOString(),
    ownerEmail,
    metrics,
    puppies,
    litters,
    breedingDogs,
    buyers: buyerRecords,
    documents: documentRecords,
    messageTemplates,
    workflowSettings,
    checklistTemplates,
    recentActivity,
    chichi: buildProgramContext(
      puppies.map((row) => ({
        id: row.id,
        displayName: row.displayName,
        sex: row.sex,
        color: row.color,
        coatType: row.coatType,
        status: row.status,
        publicPrice: row.publicPrice,
        description: row.description,
        profile: row.profile,
      })),
      litters
    ),
  };
}

export async function loadChiChiProgramContext(
  service: SupabaseClient = createServiceSupabase()
): Promise<ChiChiProgramContext> {
  const snapshot = await loadPuppiesSystemSnapshot(service, null);
  return snapshot.chichi;
}
