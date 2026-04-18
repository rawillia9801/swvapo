import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type ResolverResult,
  type ResolverSourceDefinition,
  compositeKey,
  createResolverDiagnostics,
  loadResolverSources,
  normalizedText,
  numberValue,
  sortByRecent,
  textValue,
  toResolverResult,
} from "@/lib/resolvers/_shared";

const EVENT_SOURCES: ResolverSourceDefinition[] = [
  {
    table: "puppy_events",
    classification: "canonical_base_record",
    evidence: "code",
    description: "Operational puppy event timeline.",
    limit: 10000,
  },
];

const HEALTH_SOURCES: ResolverSourceDefinition[] = [
  {
    table: "puppy_health_records",
    classification: "canonical_base_record",
    evidence: "code",
    description: "Puppy health record table.",
    limit: 10000,
  },
  {
    table: "health_records",
    classification: "parallel_live_source",
    evidence: "runtime_candidate",
    description: "Shared or legacy health record source.",
    limit: 10000,
  },
];

const WEIGHT_SOURCES: ResolverSourceDefinition[] = [
  {
    table: "puppy_weights",
    classification: "canonical_base_record",
    evidence: "code",
    description: "Puppy weekly and milestone weights.",
    limit: 10000,
  },
];

const CHECKLIST_SOURCES: ResolverSourceDefinition[] = [
  {
    table: "puppy_checklist_progress",
    classification: "parallel_live_source",
    evidence: "code",
    description: "Puppy readiness and checklist progress.",
    limit: 10000,
  },
  {
    table: "puppy_status_computed",
    classification: "derived_support_view",
    evidence: "runtime_candidate",
    description: "Computed puppy status view. Display support only.",
    limit: 10000,
  },
];

export type ResolvedPuppyHealthRecord = {
  id: string;
  puppyId: number | null;
  recordType: string | null;
  date: string | null;
  details: string | null;
  sourceTable: string;
};

export type ResolvedPuppyWeight = {
  id: string;
  puppyId: number | null;
  ageWeeks: number | null;
  weightOz: number | null;
  weightG: number | null;
  date: string | null;
  notes: string | null;
  sourceTable: string;
};

export type ResolvedPuppyLifecycle = {
  puppyId: number | null;
  status: string | null;
  birthDate: string | null;
  weightHistory: ResolvedPuppyWeight[];
  healthEvents: ResolvedPuppyHealthRecord[];
  checklistProgress: Array<Record<string, unknown>>;
  specialCareFlags: string[];
};

export type ResolvedPuppyHealthWorkspace = {
  resolvedPuppyHealth: ResolvedPuppyHealthRecord[];
  resolvedPuppyWeights: ResolvedPuppyWeight[];
  resolvedPuppyLifecycle: ResolvedPuppyLifecycle[];
};

function normalizeHealthRecord(
  sourceTable: string,
  row: Record<string, unknown>
): ResolvedPuppyHealthRecord {
  const id =
    textValue(row, "id") ||
    compositeKey(sourceTable, numberValue(row, "puppy_id"), textValue(row, "created_at")) ||
    sourceTable;
  return {
    id: `${sourceTable}:${id}`,
    puppyId: firstPresentPuppyId(row),
    recordType: firstPresentText(row, "record_type", "event_type", "label", "category"),
    date: firstPresentText(row, "record_date", "event_date", "created_at"),
    details: firstPresentText(row, "details", "summary", "notes", "description"),
    sourceTable,
  };
}

function normalizeWeight(
  sourceTable: string,
  row: Record<string, unknown>
): ResolvedPuppyWeight {
  const id =
    textValue(row, "id") ||
    compositeKey(sourceTable, numberValue(row, "puppy_id"), numberValue(row, "age_weeks"), textValue(row, "created_at")) ||
    sourceTable;
  return {
    id: `${sourceTable}:${id}`,
    puppyId: firstPresentPuppyId(row),
    ageWeeks: numberValue(row, "age_weeks"),
    weightOz: numberValue(row, "weight_oz"),
    weightG: numberValue(row, "weight_g"),
    date: firstPresentText(row, "recorded_at", "created_at", "weight_date"),
    notes: firstPresentText(row, "notes", "summary"),
    sourceTable,
  };
}

function firstPresentText(row: Record<string, unknown>, ...keys: string[]) {
  return keys.map((key) => textValue(row, key)).find(Boolean) || null;
}

function firstPresentPuppyId(row: Record<string, unknown>) {
  return firstPresentNumber(numberValue(row, "puppy_id"), numberValue(row, "id"));
}

function firstPresentNumber(...values: Array<number | null>) {
  for (const value of values) {
    if (value !== null) return value;
  }
  return null;
}

async function resolvePuppyHealthState(service: SupabaseClient) {
  const [eventSources, healthSources, weightSources, checklistSources] = await Promise.all([
    loadResolverSources(service, EVENT_SOURCES),
    loadResolverSources(service, HEALTH_SOURCES),
    loadResolverSources(service, WEIGHT_SOURCES),
    loadResolverSources(service, CHECKLIST_SOURCES),
  ]);

  const diagnostics = createResolverDiagnostics("puppy-health", [
    ...eventSources,
    ...healthSources,
    ...weightSources,
    ...checklistSources,
  ]);

  const resolvedPuppyHealth = sortByRecent(
    [...eventSources, ...healthSources].flatMap((source) =>
      source.rows.map((row) => normalizeHealthRecord(source.table, row))
    ),
    "date"
  );

  const resolvedPuppyWeights = sortByRecent(
    weightSources.flatMap((source) => source.rows.map((row) => normalizeWeight(source.table, row))),
    "date"
  );

  const checklistRows = checklistSources.flatMap((source) =>
    source.rows.map((row) => ({ ...row, sourceTable: source.table }))
  );

  const puppyIds = new Set<number>();
  resolvedPuppyHealth.forEach((record) => {
    if (record.puppyId !== null) puppyIds.add(record.puppyId);
  });
  resolvedPuppyWeights.forEach((record) => {
    if (record.puppyId !== null) puppyIds.add(record.puppyId);
  });
  checklistRows.forEach((row) => {
    const puppyId = firstPresentPuppyId(row);
    if (puppyId !== null) puppyIds.add(puppyId);
  });

  const resolvedPuppyLifecycle = Array.from(puppyIds).map((puppyId) => {
    const healthEvents = resolvedPuppyHealth.filter((record) => record.puppyId === puppyId);
    const weightHistory = resolvedPuppyWeights.filter((record) => record.puppyId === puppyId);
    const checklistProgress = checklistRows.filter(
      (row) => firstPresentPuppyId(row) === puppyId
    );
    const computedStatus =
      checklistProgress.find((row) => row.sourceTable === "puppy_status_computed") || null;
    const specialCareFlags = checklistProgress
      .map((row) => firstPresentText(row, "flag", "special_care_flag", "status"))
      .filter((value): value is string => Boolean(value))
      .filter((value) => normalizedText(value).includes("care") || normalizedText(value).includes("watch"));

    return {
      puppyId,
      status:
        firstPresentText(computedStatus || {}, "status", "current_status") ||
        healthEvents[0]?.recordType ||
        null,
      birthDate: firstPresentText(computedStatus || {}, "birth_date", "dob"),
      weightHistory,
      healthEvents,
      checklistProgress,
      specialCareFlags: Array.from(new Set(specialCareFlags)),
    };
  });

  return toResolverResult<ResolvedPuppyHealthWorkspace>(
    {
      resolvedPuppyHealth,
      resolvedPuppyWeights,
      resolvedPuppyLifecycle,
    },
    diagnostics
  );
}

export async function resolvePuppyHealth(
  service: SupabaseClient
): Promise<ResolverResult<ResolvedPuppyHealthRecord[]>> {
  const resolved = await resolvePuppyHealthState(service);
  return {
    data: resolved.data.resolvedPuppyHealth,
    diagnostics: resolved.diagnostics,
  };
}

export async function resolvePuppyWeights(
  service: SupabaseClient
): Promise<ResolverResult<ResolvedPuppyWeight[]>> {
  const resolved = await resolvePuppyHealthState(service);
  return {
    data: resolved.data.resolvedPuppyWeights,
    diagnostics: resolved.diagnostics,
  };
}

export async function resolvePuppyLifecycle(
  service: SupabaseClient
): Promise<ResolverResult<ResolvedPuppyLifecycle[]>> {
  const resolved = await resolvePuppyHealthState(service);
  return {
    data: resolved.data.resolvedPuppyLifecycle,
    diagnostics: resolved.diagnostics,
  };
}

export async function resolvePuppyStatus(
  service: SupabaseClient
): Promise<ResolverResult<ResolvedPuppyLifecycle[]>> {
  return resolvePuppyLifecycle(service);
}
