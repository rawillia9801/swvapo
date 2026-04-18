import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type ResolverResult,
  type ResolverSourceDefinition,
  compositeKey,
  createResolverDiagnostics,
  loadResolverSources,
  normalizeEmail,
  normalizedText,
  numberValue,
  sortByRecent,
  textValue,
  toResolverResult,
} from "@/lib/resolvers/_shared";

const FORM_SOURCES: ResolverSourceDefinition[] = [
  {
    table: "portal_form_submissions",
    classification: "canonical_base_record",
    evidence: "code",
    description: "Portal form workflow and signed-form submissions.",
    limit: 10000,
  },
];

const DOCUMENT_SOURCES: ResolverSourceDefinition[] = [
  {
    table: "portal_documents",
    classification: "canonical_base_record",
    evidence: "code",
    description: "Portal document truth table for generated/shared files.",
    limit: 10000,
  },
  {
    table: "documents",
    classification: "parallel_live_source",
    evidence: "runtime_candidate",
    description: "Adjacent document table. Included only when production data is split.",
    limit: 10000,
  },
  {
    table: "bill_of_sale_assignments",
    classification: "parallel_live_source",
    evidence: "runtime_candidate",
    description: "Bill-of-sale assignment records that may inform document linkage.",
    limit: 10000,
  },
];

const MESSAGE_SOURCES: ResolverSourceDefinition[] = [
  {
    table: "portal_messages",
    classification: "canonical_base_record",
    evidence: "code",
    description: "Portal buyer communication threads and messages.",
    limit: 10000,
  },
];

const ASSIGNMENT_SOURCES: ResolverSourceDefinition[] = [
  {
    table: "v_portal_assignment",
    classification: "derived_support_view",
    evidence: "runtime_candidate",
    description: "Derived mapping from buyer/user/puppy to portal assignment state.",
    limit: 10000,
  },
];

const PICKUP_SOURCES: ResolverSourceDefinition[] = [
  {
    table: "portal_pickup_requests",
    classification: "parallel_live_source",
    evidence: "code",
    description: "Portal pickup and transportation requests.",
    limit: 10000,
  },
];

const UX_SOURCES: ResolverSourceDefinition[] = [
  {
    table: "portal_notification_dismissals",
    classification: "derived_support_view",
    evidence: "runtime_candidate",
    description: "Portal notification dismissal state.",
    limit: 10000,
  },
];

export type ResolvedPortalDocument = {
  id: string;
  recordId: string | null;
  sourceTable: string;
  userId: string | null;
  buyerId: number | null;
  puppyId: number | null;
  title: string | null;
  description: string | null;
  category: string | null;
  documentType: string | null;
  status: string | null;
  signedAt: string | null;
  filedAt: string | null;
  url: string | null;
  fileName: string | null;
  visibleToUser: boolean | null;
  sourceFlow: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  linkedFormIds: string[];
};

export type ResolvedPortalForm = {
  id: string;
  recordId: string | null;
  formKey: string | null;
  formTitle: string | null;
  buyerId: number | null;
  puppyId: number | null;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  signedAt: string | null;
  signedDate: string | null;
  signedName: string | null;
  submittedAt: string | null;
  data: Record<string, unknown> | null;
  payload: Record<string, unknown> | null;
  attachments: unknown;
  sourceTable: string;
  userId: string | null;
  userEmail: string | null;
  email: string | null;
  version: string | null;
  linkedDocumentIds: string[];
};

export type ResolvedPortalMessage = {
  id: string;
  recordId: string | null;
  sourceTable: string;
  buyerId: number | null;
  puppyId: number | null;
  userId: string | null;
  userEmail: string | null;
  subject: string | null;
  body: string | null;
  sender: string | null;
  createdAt: string | null;
  readByAdmin: boolean | null;
};

export type ResolvedPortalAssignment = {
  id: string;
  sourceTable: string;
  buyerId: number | null;
  puppyId: number | null;
  userId: string | null;
  status: string | null;
  notes: string | null;
};

export type ResolvedPortalPickupRequest = {
  id: string;
  sourceTable: string;
  buyerId: number | null;
  puppyId: number | null;
  status: string | null;
  requestDate: string | null;
  requestType: string | null;
  miles: number | null;
  locationText: string | null;
  addressText: string | null;
  notes: string | null;
};

export type ResolvedPortalWorkspace = {
  resolvedPortalDocuments: ResolvedPortalDocument[];
  resolvedPortalForms: ResolvedPortalForm[];
  resolvedPortalMessages: ResolvedPortalMessage[];
  resolvedPortalAssignments: ResolvedPortalAssignment[];
  resolvedPortalPickupRequests: ResolvedPortalPickupRequest[];
};

function normalizePortalDocument(
  sourceTable: string,
  row: Record<string, unknown>
): ResolvedPortalDocument {
  const id =
    textValue(row, "id") ||
    compositeKey(sourceTable, textValue(row, "file_url"), textValue(row, "created_at")) ||
    sourceTable;
  return {
    id: `${sourceTable}:${id}`,
    recordId: textValue(row, "id"),
    sourceTable,
    userId: textValue(row, "user_id"),
    buyerId: numberValue(row, "buyer_id"),
    puppyId: numberValue(row, "puppy_id"),
    title: textValue(row, "title"),
    description: textValue(row, "description"),
    category: textValue(row, "category"),
    documentType: firstPresentText(row, "title", "category", "document_type"),
    status: textValue(row, "status"),
    signedAt: textValue(row, "signed_at"),
    filedAt: firstPresentText(row, "filed_at", "updated_at"),
    url: firstPresentText(row, "file_url", "url"),
    fileName: textValue(row, "file_name"),
    visibleToUser: row.visible_to_user === undefined ? null : Boolean(row.visible_to_user),
    sourceFlow: firstPresentText(row, "source_table", "source_flow"),
    createdAt: textValue(row, "created_at"),
    updatedAt: firstPresentText(row, "updated_at", "created_at"),
    linkedFormIds: [],
  };
}

function normalizePortalForm(
  sourceTable: string,
  row: Record<string, unknown>
): ResolvedPortalForm {
  const id =
    textValue(row, "id") ||
    compositeKey(sourceTable, textValue(row, "form_key"), textValue(row, "created_at")) ||
    sourceTable;
  const payload =
    (row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : row.data && typeof row.data === "object" && !Array.isArray(row.data)
        ? (row.data as Record<string, unknown>)
        : null);
  return {
    id: `${sourceTable}:${id}`,
    recordId: textValue(row, "id"),
    formKey: textValue(row, "form_key"),
    formTitle: textValue(row, "form_title"),
    buyerId: numberValue(row, "buyer_id"),
    puppyId: numberValue(row, "puppy_id"),
    status: textValue(row, "status"),
    createdAt: textValue(row, "created_at"),
    updatedAt: firstPresentText(row, "updated_at", "created_at"),
    signedAt: firstPresentText(row, "signed_at", "signed_date"),
    signedDate: textValue(row, "signed_date"),
    signedName: textValue(row, "signed_name"),
    submittedAt: firstPresentText(row, "submitted_at", "created_at"),
    data:
      row.data && typeof row.data === "object" && !Array.isArray(row.data)
        ? (row.data as Record<string, unknown>)
        : null,
    payload,
    attachments: row.attachments ?? null,
    sourceTable,
    userId: textValue(row, "user_id"),
    userEmail: firstPresentText(row, "user_email", "email"),
    email: textValue(row, "email"),
    version: textValue(row, "version"),
    linkedDocumentIds: [],
  };
}

function normalizePortalMessage(
  sourceTable: string,
  row: Record<string, unknown>
): ResolvedPortalMessage {
  const id =
    textValue(row, "id") ||
    compositeKey(sourceTable, textValue(row, "user_id"), textValue(row, "created_at")) ||
    sourceTable;
  return {
    id: `${sourceTable}:${id}`,
    recordId: textValue(row, "id"),
    sourceTable,
    buyerId: numberValue(row, "buyer_id"),
    puppyId: numberValue(row, "puppy_id"),
    userId: textValue(row, "user_id"),
    userEmail: firstPresentText(row, "user_email", "email"),
    subject: textValue(row, "subject"),
    body: firstPresentText(row, "message", "body"),
    sender: textValue(row, "sender"),
    createdAt: textValue(row, "created_at"),
    readByAdmin: row.read_by_admin === undefined ? null : Boolean(row.read_by_admin),
  };
}

function normalizePortalAssignment(
  sourceTable: string,
  row: Record<string, unknown>
): ResolvedPortalAssignment {
  const id =
    textValue(row, "id") ||
    compositeKey(sourceTable, textValue(row, "user_id"), numberValue(row, "buyer_id"), numberValue(row, "puppy_id")) ||
    sourceTable;
  return {
    id: `${sourceTable}:${id}`,
    sourceTable,
    buyerId: numberValue(row, "buyer_id"),
    puppyId: numberValue(row, "puppy_id"),
    userId: textValue(row, "user_id"),
    status: textValue(row, "status"),
    notes: firstPresentText(row, "notes", "summary"),
  };
}

function normalizePickupRequest(
  sourceTable: string,
  row: Record<string, unknown>
): ResolvedPortalPickupRequest {
  const id =
    textValue(row, "id") ||
    compositeKey(sourceTable, textValue(row, "user_id"), textValue(row, "created_at")) ||
    sourceTable;
  return {
    id: `${sourceTable}:${id}`,
    sourceTable,
    buyerId: numberValue(row, "buyer_id"),
    puppyId: numberValue(row, "puppy_id"),
    status: textValue(row, "status"),
    requestDate: textValue(row, "request_date"),
    requestType: textValue(row, "request_type"),
    miles: numberValue(row, "miles"),
    locationText: textValue(row, "location_text"),
    addressText: textValue(row, "address_text"),
    notes: textValue(row, "notes"),
  };
}

function firstPresentText(row: Record<string, unknown>, ...keys: string[]) {
  return keys.map((key) => textValue(row, key)).find(Boolean) || null;
}

async function resolvePortalState(service: SupabaseClient) {
  const [formSources, documentSources, messageSources, assignmentSources, pickupSources, uxSources] =
    await Promise.all([
      loadResolverSources(service, FORM_SOURCES),
      loadResolverSources(service, DOCUMENT_SOURCES),
      loadResolverSources(service, MESSAGE_SOURCES),
      loadResolverSources(service, ASSIGNMENT_SOURCES),
      loadResolverSources(service, PICKUP_SOURCES),
      loadResolverSources(service, UX_SOURCES),
    ]);

  const diagnostics = createResolverDiagnostics("portal", [
    ...formSources,
    ...documentSources,
    ...messageSources,
    ...assignmentSources,
    ...pickupSources,
    ...uxSources,
  ]);

  const resolvedPortalDocuments = sortByRecent(
    documentSources.flatMap((source) => source.rows.map((row) => normalizePortalDocument(source.table, row))),
    "createdAt",
    "filedAt"
  );

  const resolvedPortalForms = sortByRecent(
    formSources.flatMap((source) => source.rows.map((row) => normalizePortalForm(source.table, row))),
    "submittedAt",
    "signedAt"
  );

  const documentMapByBuyer = new Map<string, ResolvedPortalDocument[]>();
  resolvedPortalDocuments.forEach((document) => {
    const buyerKey = document.buyerId !== null ? `buyer:${document.buyerId}` : "";
    if (!buyerKey) return;
    const group = documentMapByBuyer.get(buyerKey) || [];
    group.push(document);
    documentMapByBuyer.set(buyerKey, group);
  });

  resolvedPortalForms.forEach((form) => {
    const buyerKey = form.buyerId !== null ? `buyer:${form.buyerId}` : "";
    const userKey = form.userId ? `user:${form.userId}` : "";
    const emailKey = form.userEmail ? `email:${normalizeEmail(form.userEmail)}` : "";
    const matchedDocuments = [
      ...(buyerKey ? documentMapByBuyer.get(buyerKey) || [] : []),
      ...resolvedPortalDocuments.filter((document) => {
        if (userKey && normalizedText(document.sourceFlow).includes(userKey)) return true;
        if (emailKey && normalizedText(document.sourceFlow).includes(emailKey)) return true;
        return false;
      }),
    ];
    form.linkedDocumentIds = Array.from(new Set(matchedDocuments.map((document) => document.id)));
    matchedDocuments.forEach((document) => {
      if (!document.linkedFormIds.includes(form.id)) {
        document.linkedFormIds.push(form.id);
      }
    });
  });

  return toResolverResult<ResolvedPortalWorkspace>(
    {
      resolvedPortalDocuments,
      resolvedPortalForms,
      resolvedPortalMessages: sortByRecent(
        messageSources.flatMap((source) => source.rows.map((row) => normalizePortalMessage(source.table, row))),
        "createdAt"
      ),
      resolvedPortalAssignments: assignmentSources.flatMap((source) =>
        source.rows.map((row) => normalizePortalAssignment(source.table, row))
      ),
      resolvedPortalPickupRequests: sortByRecent(
        pickupSources.flatMap((source) => source.rows.map((row) => normalizePickupRequest(source.table, row))),
        "requestDate",
        "createdAt"
      ),
    },
    diagnostics
  );
}

export async function resolvePortalDocuments(
  service: SupabaseClient
): Promise<ResolverResult<ResolvedPortalDocument[]>> {
  const resolved = await resolvePortalState(service);
  return {
    data: resolved.data.resolvedPortalDocuments,
    diagnostics: resolved.diagnostics,
  };
}

export async function resolvePortalForms(
  service: SupabaseClient
): Promise<ResolverResult<ResolvedPortalForm[]>> {
  const resolved = await resolvePortalState(service);
  return {
    data: resolved.data.resolvedPortalForms,
    diagnostics: resolved.diagnostics,
  };
}

export async function resolvePortalMessages(
  service: SupabaseClient
): Promise<ResolverResult<ResolvedPortalMessage[]>> {
  const resolved = await resolvePortalState(service);
  return {
    data: resolved.data.resolvedPortalMessages,
    diagnostics: resolved.diagnostics,
  };
}

export async function resolvePortalAssignments(
  service: SupabaseClient
): Promise<ResolverResult<ResolvedPortalAssignment[]>> {
  const resolved = await resolvePortalState(service);
  return {
    data: resolved.data.resolvedPortalAssignments,
    diagnostics: resolved.diagnostics,
  };
}

export async function resolvePortalWorkspace(
  service: SupabaseClient
): Promise<ResolverResult<ResolvedPortalWorkspace>> {
  return resolvePortalState(service);
}
