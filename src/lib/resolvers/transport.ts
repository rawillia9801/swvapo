import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type ResolverResult,
  type ResolverSourceDefinition,
  compositeKey,
  createResolverDiagnostics,
  loadResolverSources,
  numberValue,
  sortByRecent,
  textValue,
  toResolverResult,
} from "@/lib/resolvers/_shared";

const REQUEST_SOURCES: ResolverSourceDefinition[] = [
  {
    table: "portal_pickup_requests",
    classification: "canonical_base_record",
    evidence: "code",
    description: "Current portal pickup and transport request table.",
    limit: 10000,
  },
  {
    table: "transport_requests",
    classification: "parallel_live_source",
    evidence: "runtime_candidate",
    description: "Transport request intake table outside the portal namespace.",
    limit: 10000,
  },
];

const JOB_SOURCES: ResolverSourceDefinition[] = [
  {
    table: "transports",
    classification: "parallel_live_source",
    evidence: "runtime_candidate",
    description: "Operational transport jobs.",
    limit: 10000,
  },
  {
    table: "core_transports",
    classification: "core_overlay_orchestration",
    evidence: "runtime_candidate",
    description: "Core transport overlay and execution state.",
    limit: 10000,
  },
  {
    table: "core_deliveries",
    classification: "core_overlay_orchestration",
    evidence: "runtime_candidate",
    description: "Core delivery jobs and completion state.",
    limit: 10000,
  },
];

const SUPPORT_SOURCES: ResolverSourceDefinition[] = [
  {
    table: "core_delivery_readiness_view",
    classification: "derived_support_view",
    evidence: "runtime_candidate",
    description: "Derived delivery readiness view.",
    limit: 10000,
  },
  {
    table: "core_transport_pricing_rules",
    classification: "core_overlay_orchestration",
    evidence: "runtime_candidate",
    description: "Transport pricing and rules config.",
    limit: 10000,
  },
];

export type ResolvedTransport = {
  id: string;
  recordId: string | null;
  sourceTable: string;
  userId: string | null;
  buyerId: number | null;
  puppyId: number | null;
  status: string | null;
  deliveryMethod: string | null;
  requestDate: string | null;
  miles: number | null;
  fee: number | null;
  scheduledAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
  locationText: string | null;
  addressText: string | null;
  notes: string | null;
};

export type ResolvedDeliveryReadiness = {
  id: string;
  recordId: string | null;
  sourceTable: string;
  buyerId: number | null;
  puppyId: number | null;
  status: string | null;
  blocker: string | null;
  updatedAt: string | null;
};

export type ResolvedTransportWorkspace = {
  resolvedTransportRequests: ResolvedTransport[];
  resolvedTransports: ResolvedTransport[];
  resolvedDeliveryReadiness: ResolvedDeliveryReadiness[];
};

function normalizeTransport(
  sourceTable: string,
  row: Record<string, unknown>
): ResolvedTransport {
  const id =
    textValue(row, "id") ||
    compositeKey(sourceTable, textValue(row, "user_id"), textValue(row, "created_at")) ||
    sourceTable;
  return {
    id: `${sourceTable}:${id}`,
    recordId: textValue(row, "id"),
    sourceTable,
    userId: textValue(row, "user_id"),
    buyerId: numberValue(row, "buyer_id"),
    puppyId: numberValue(row, "puppy_id"),
    status: textValue(row, "status"),
    deliveryMethod: textValue(row, "request_type", "delivery_method", "transport_type"),
    requestDate: textValue(row, "request_date"),
    miles: numberValue(row, "miles"),
    fee: firstPresentNumber(numberValue(row, "fee"), numberValue(row, "delivery_fee")),
    scheduledAt: firstPresentText(row, "scheduled_at", "request_date", "delivery_date"),
    completedAt: firstPresentText(row, "completed_at", "delivered_at"),
    createdAt: textValue(row, "created_at"),
    locationText: textValue(row, "location_text"),
    addressText: textValue(row, "address_text"),
    notes: textValue(row, "notes"),
  };
}

function normalizeReadiness(
  sourceTable: string,
  row: Record<string, unknown>
): ResolvedDeliveryReadiness {
  const id =
    textValue(row, "id") ||
    compositeKey(sourceTable, numberValue(row, "buyer_id"), numberValue(row, "puppy_id")) ||
    sourceTable;
  return {
    id: `${sourceTable}:${id}`,
    recordId: textValue(row, "id"),
    sourceTable,
    buyerId: numberValue(row, "buyer_id"),
    puppyId: numberValue(row, "puppy_id"),
    status: textValue(row, "status"),
    blocker: firstPresentText(row, "blocker", "summary", "notes"),
    updatedAt: firstPresentText(row, "updated_at", "created_at"),
  };
}

function firstPresentText(row: Record<string, unknown>, ...keys: string[]) {
  return keys.map((key) => textValue(row, key)).find(Boolean) || null;
}

function firstPresentNumber(...values: Array<number | null>) {
  for (const value of values) {
    if (value !== null) return value;
  }
  return null;
}

async function resolveTransportState(service: SupabaseClient) {
  const [requestSources, jobSources, supportSources] = await Promise.all([
    loadResolverSources(service, REQUEST_SOURCES),
    loadResolverSources(service, JOB_SOURCES),
    loadResolverSources(service, SUPPORT_SOURCES),
  ]);

  const diagnostics = createResolverDiagnostics("transport", [
    ...requestSources,
    ...jobSources,
    ...supportSources,
  ]);

  return toResolverResult<ResolvedTransportWorkspace>(
    {
      resolvedTransportRequests: sortByRecent(
        requestSources.flatMap((source) => source.rows.map((row) => normalizeTransport(source.table, row))),
        "scheduledAt"
      ),
      resolvedTransports: sortByRecent(
        jobSources.flatMap((source) => source.rows.map((row) => normalizeTransport(source.table, row))),
        "scheduledAt",
        "completedAt"
      ),
      resolvedDeliveryReadiness: sortByRecent(
        supportSources
          .filter((source) => source.table.includes("readiness"))
          .flatMap((source) => source.rows.map((row) => normalizeReadiness(source.table, row))),
        "updatedAt"
      ),
    },
    diagnostics
  );
}

export async function resolveTransportRequests(
  service: SupabaseClient
): Promise<ResolverResult<ResolvedTransport[]>> {
  const resolved = await resolveTransportState(service);
  return {
    data: resolved.data.resolvedTransportRequests,
    diagnostics: resolved.diagnostics,
  };
}

export async function resolveTransports(
  service: SupabaseClient
): Promise<ResolverResult<ResolvedTransport[]>> {
  const resolved = await resolveTransportState(service);
  return {
    data: resolved.data.resolvedTransports,
    diagnostics: resolved.diagnostics,
  };
}

export async function resolveDeliveryReadiness(
  service: SupabaseClient
): Promise<ResolverResult<ResolvedDeliveryReadiness[]>> {
  const resolved = await resolveTransportState(service);
  return {
    data: resolved.data.resolvedDeliveryReadiness,
    diagnostics: resolved.diagnostics,
  };
}

export async function resolveTransportWorkspace(
  service: SupabaseClient
): Promise<ResolverResult<ResolvedTransportWorkspace>> {
  return resolveTransportState(service);
}
