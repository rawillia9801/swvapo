export const PUPPIES_SYSTEM_TABS = [
  "overview",
  "current",
  "past",
  "care",
  "readiness",
  "buyer-matching",
  "documents",
  "messaging",
  "settings",
] as const;

export type PuppiesSystemTab = (typeof PUPPIES_SYSTEM_TABS)[number];

export type PuppiesSystemMetric = {
  key: string;
  label: string;
  value: number;
  detail: string;
  tone: "neutral" | "success" | "warning" | "danger";
};

export type ActivityFeedItem = {
  id: string;
  kind:
    | "weight"
    | "health"
    | "event"
    | "document"
    | "message"
    | "payment"
    | "template"
    | "workflow";
  title: string;
  detail: string;
  occurredAt: string | null;
  puppyId?: number | null;
  puppyName?: string | null;
  buyerId?: number | null;
  buyerName?: string | null;
};

export type ChecklistTemplateRecord = {
  id: number;
  scope: string;
  key: string;
  label: string;
  description: string | null;
  category: string;
  sortOrder: number;
  requiredForWebsite: boolean;
  requiredForPortal: boolean;
  requiredForGoHome: boolean;
  visibleToBuyer: boolean;
  isActive: boolean;
};

export type ChecklistProgressRecord = {
  id: number | null;
  templateId: number;
  key: string;
  label: string;
  category: string;
  description: string | null;
  completed: boolean;
  completedAt: string | null;
  visibleToBuyer: boolean;
  notes: string | null;
  requiredForWebsite: boolean;
  requiredForPortal: boolean;
  requiredForGoHome: boolean;
};

export type PuppyAdminProfileRecord = {
  puppyId: number;
  registeredName: string | null;
  publicVisibility: boolean;
  portalVisibility: boolean;
  featuredListing: boolean;
  specialCareFlag: boolean;
  specialCareNotes: string | null;
  feedingNotes: string | null;
  lineageNotes: string | null;
  breederNotes: string | null;
  buyerPacketReady: boolean;
  documentPacketReady: boolean;
  transportReady: boolean;
  goHomeReady: boolean;
  updatedAt: string | null;
};

export type PuppyWeightRecord = {
  id: number;
  weighDate: string | null;
  ageWeeks: number | null;
  weightOz: number | null;
  weightG: number | null;
  notes: string | null;
};

export type PuppyHealthRecordSummary = {
  id: number;
  recordDate: string;
  recordType: string;
  title: string;
  description: string | null;
  providerName: string | null;
  medicationName: string | null;
  dosage: string | null;
  lotNumber: string | null;
  nextDueDate: string | null;
  visibleToBuyer: boolean;
};

export type PuppyEventSummary = {
  id: number;
  eventDate: string;
  eventType: string | null;
  title: string;
  summary: string | null;
  details: string | null;
  published: boolean;
};

export type PuppyCareSummary = {
  latestWeight: PuppyWeightRecord | null;
  latestVaccine: PuppyHealthRecordSummary | null;
  latestDeworming: PuppyHealthRecordSummary | null;
  latestHealthRecord: PuppyHealthRecordSummary | null;
  latestEvent: PuppyEventSummary | null;
  weights: PuppyWeightRecord[];
  healthRecords: PuppyHealthRecordSummary[];
  events: PuppyEventSummary[];
  weightDue: boolean;
  vaccineDue: boolean;
  dewormingDue: boolean;
  missingRecords: string[];
};

export type ReadinessState = {
  ready: boolean;
  score: number;
  missing: string[];
  blocked: string[];
};

export type PuppyReadinessSummary = {
  website: ReadinessState;
  portal: ReadinessState;
  documents: ReadinessState;
  messaging: ReadinessState;
  placement: ReadinessState;
  goHome: ReadinessState;
  photoReady: boolean;
  copyReady: boolean;
  buyerLinked: boolean;
};

export type PuppyDocumentSummary = {
  total: number;
  ready: number;
  signed: number;
  filed: number;
  latestTitle: string | null;
};

export type PuppyPortalSummary = {
  hasPortalAccount: boolean;
  formsTotal: number;
  unsignedForms: number;
  unreadMessages: number;
  latestMessageAt: string | null;
};

export type PuppyPaymentSummary = {
  salePrice: number | null;
  depositRecorded: number;
  paymentsTotal: number;
  remainingBalance: number | null;
  overdue: boolean;
};

export type PuppyWorkspaceRecord = {
  id: number;
  displayName: string;
  callName: string | null;
  registeredName: string | null;
  sex: string | null;
  color: string | null;
  coatType: string | null;
  dob: string | null;
  ageWeeks: number | null;
  registry: string | null;
  status: string | null;
  price: number | null;
  listPrice: number | null;
  publicPrice: number | null;
  photoUrl: string | null;
  description: string | null;
  notes: string | null;
  currentWeight: number | null;
  weightUnit: string | null;
  weightDate: string | null;
  litterId: number | null;
  litterName: string | null;
  damId: string | null;
  damName: string | null;
  sireId: string | null;
  sireName: string | null;
  buyerId: number | null;
  buyerName: string | null;
  buyerEmail: string | null;
  buyerStatus: string | null;
  buyerPortalLinked: boolean;
  transportRequestType: string | null;
  transportRequestStatus: string | null;
  profile: PuppyAdminProfileRecord;
  checklist: ChecklistProgressRecord[];
  care: PuppyCareSummary;
  readiness: PuppyReadinessSummary;
  attention: string[];
  documentSummary: PuppyDocumentSummary;
  portalSummary: PuppyPortalSummary;
  paymentSummary: PuppyPaymentSummary;
};

export type LitterWorkspaceRecord = {
  id: number;
  displayName: string;
  litterCode: string | null;
  whelpDate: string | null;
  status: string | null;
  notes: string | null;
  damId: string | null;
  damName: string | null;
  sireId: string | null;
  sireName: string | null;
  puppyIds: number[];
  puppyCount: number;
  currentPuppyCount: number;
  pastPuppyCount: number;
  pendingTasks: string[];
};

export type BreedingDogWorkspaceRecord = {
  id: string;
  role: string | null;
  displayName: string;
  registeredName: string | null;
  callName: string | null;
  status: string | null;
  dob: string | null;
  color: string | null;
  coat: string | null;
  registry: string | null;
  notes: string | null;
  geneticsSummary: string | null;
  litterCount: number;
  puppyCount: number;
};

export type BuyerWorkspaceRecord = {
  id: number;
  displayName: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  linkedPuppyIds: number[];
  linkedPuppyNames: string[];
  formsTotal: number;
  unsignedForms: number;
  documentsReady: number;
  documentsSigned: number;
  unreadMessages: number;
  salePrice: number | null;
  depositAmount: number | null;
  paymentsTotal: number;
  remainingBalance: number | null;
  overdue: boolean;
  hasPortalAccount: boolean;
  pickupStatus: string | null;
};

export type DocumentWorkflowRecord = {
  id: string;
  title: string;
  category: string | null;
  status: string | null;
  buyerId: number | null;
  buyerName: string | null;
  puppyName: string | null;
  visibleToUser: boolean;
  signedAt: string | null;
  createdAt: string | null;
};

export type MessageTemplateRecord = {
  id: number | null;
  templateKey: string;
  category: string;
  label: string;
  description: string | null;
  channel: string;
  provider: string;
  subject: string;
  body: string;
  automationEnabled: boolean;
  isActive: boolean;
  previewPayload: Record<string, unknown>;
  updatedAt: string | null;
};

export type WorkflowSettingRecord = {
  id: number | null;
  workflowKey: string;
  category: string;
  label: string;
  description: string | null;
  status: string;
  owner: string | null;
  cadenceLabel: string | null;
  triggerLabel: string | null;
  nextRunHint: string | null;
  settings: Record<string, unknown>;
  isVisible: boolean;
  updatedAt: string | null;
};

export type ChiChiProgramContext = {
  publicAvailabilitySummary: string;
  availablePuppies: Array<{
    id: number;
    name: string;
    sex: string | null;
    color: string | null;
    coatType: string | null;
    status: string | null;
    price: number | null;
    description: string | null;
  }>;
  upcomingLitters: Array<{
    id: number;
    name: string;
    whelpDate: string | null;
    status: string | null;
    damName: string | null;
    sireName: string | null;
  }>;
  customerCapabilities: string[];
  adminCapabilities: string[];
};

export type PuppiesSystemSnapshot = {
  fetchedAt: string;
  ownerEmail: string | null;
  metrics: PuppiesSystemMetric[];
  puppies: PuppyWorkspaceRecord[];
  litters: LitterWorkspaceRecord[];
  breedingDogs: BreedingDogWorkspaceRecord[];
  buyers: BuyerWorkspaceRecord[];
  documents: DocumentWorkflowRecord[];
  messageTemplates: MessageTemplateRecord[];
  workflowSettings: WorkflowSettingRecord[];
  checklistTemplates: ChecklistTemplateRecord[];
  recentActivity: ActivityFeedItem[];
  chichi: ChiChiProgramContext;
};

export type PuppiesSystemResponse = {
  ok: boolean;
  snapshot?: PuppiesSystemSnapshot;
  ownerEmail?: string | null;
  error?: string;
};

export function normalizePuppyStatus(status: string | null | undefined) {
  return String(status || "").trim().toLowerCase();
}

export function isReservedPuppyStatus(status: string | null | undefined) {
  const normalized = normalizePuppyStatus(status);
  return ["reserved", "matched", "hold", "deposit", "pending pickup"].some((token) =>
    normalized.includes(token)
  );
}

export function isPastPuppyStatus(status: string | null | undefined) {
  const normalized = normalizePuppyStatus(status);
  return ["sold", "adopted", "completed", "archived", "placed", "gone home"].some((token) =>
    normalized.includes(token)
  );
}

export function isCurrentPuppyStatus(status: string | null | undefined) {
  if (isPastPuppyStatus(status)) return false;
  const normalized = normalizePuppyStatus(status);
  return (
    !normalized ||
    ["available", "expected", "reserved", "matched", "hold", "pending", "active"].some((token) =>
      normalized.includes(token)
    )
  );
}

export function computeReadinessScore(missing: string[], blocked: string[]) {
  const penalty = missing.length * 18 + blocked.length * 26;
  return Math.max(0, Math.min(100, 100 - penalty));
}

export function buildReadinessState(missing: string[], blocked: string[]): ReadinessState {
  return {
    ready: !missing.length && !blocked.length,
    score: computeReadinessScore(missing, blocked),
    missing,
    blocked,
  };
}

export function ageInWeeks(dob: string | null | undefined) {
  const value = String(dob || "").trim();
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const diff = Date.now() - parsed.getTime();
  if (diff < 0) return 0;
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
}

export function yesNoLabel(value: boolean) {
  return value ? "Yes" : "No";
}

