import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isMissingRelationError } from "@/lib/admin-data-compat";

export type ResolverSourceClassification =
  | "canonical_base_record"
  | "parallel_live_source"
  | "derived_support_view"
  | "core_overlay_orchestration";

export type ResolverEvidence = "code" | "migration" | "runtime_candidate";

export type ResolverSourceDefinition = {
  table: string;
  classification: ResolverSourceClassification;
  evidence: ResolverEvidence;
  description: string;
  limit?: number;
};

export type LoadedResolverSource = ResolverSourceDefinition & {
  status: "data" | "empty" | "missing" | "error";
  rowCount: number;
  rows: Array<Record<string, unknown>>;
  error: string | null;
};

export type ResolverDiagnostics = {
  domain: string;
  sources: LoadedResolverSource[];
  mergedTables: string[];
  deduped: number;
  conflicts: string[];
  notes: string[];
};

export type ResolverResult<T> = {
  data: T;
  diagnostics: {
    sourcesChecked: string[];
    sourcesUsed: string[];
    missingTables: string[];
    rowCounts: Record<string, number>;
    mergeNotes: string[];
    warnings: string[];
  };
};

const DEFAULT_SOURCE_LIMIT = 5000;

export function hasValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

export function normalizedText(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function normalizeEmail(value: unknown) {
  return normalizedText(value);
}

export function normalizePhone(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function sameScalarValue(left: unknown, right: unknown) {
  if (!hasValue(left) && !hasValue(right)) return true;
  if (typeof left === "number" || typeof right === "number") {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber === rightNumber;
    }
  }
  return normalizedText(left) === normalizedText(right);
}

export function textValue(
  row: Record<string, unknown> | null | undefined,
  ...keys: string[]
) {
  if (!row) return null;
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

export function numberValue(
  row: Record<string, unknown> | null | undefined,
  ...keys: string[]
) {
  if (!row) return null;
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/[^0-9.-]/g, "").trim());
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

export function booleanValue(
  row: Record<string, unknown> | null | undefined,
  ...keys: string[]
) {
  if (!row) return null;
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "boolean") return value;
    const normalized = normalizedText(value);
    if (!normalized) continue;
    if (["true", "yes", "1", "active", "enabled"].includes(normalized)) return true;
    if (["false", "no", "0", "inactive", "disabled"].includes(normalized)) return false;
  }
  return null;
}

export function arrayValue<T = unknown>(
  row: Record<string, unknown> | null | undefined,
  ...keys: string[]
) {
  if (!row) return null;
  for (const key of keys) {
    const value = row[key];
    if (Array.isArray(value)) return value as T[];
  }
  return null;
}

export function recordValue(
  row: Record<string, unknown> | null | undefined,
  ...keys: string[]
) {
  if (!row) return null;
  for (const key of keys) {
    const value = row[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return null;
}

export function firstPresent<T>(...values: Array<T | null | undefined>) {
  for (const value of values) {
    if (hasValue(value)) return value;
  }
  return null;
}

export function compositeKey(...parts: Array<string | number | null | undefined>) {
  return parts
    .map((part) => normalizedText(part))
    .filter(Boolean)
    .join("|");
}

export function sortByRecent<T extends Record<string, unknown>>(
  rows: T[],
  ...keys: string[]
) {
  return [...rows].sort((left, right) => {
    const leftValue = firstPresent(...keys.map((key) => textValue(left, key)));
    const rightValue = firstPresent(...keys.map((key) => textValue(right, key)));
    const leftTime = leftValue ? new Date(String(leftValue)).getTime() : 0;
    const rightTime = rightValue ? new Date(String(rightValue)).getTime() : 0;
    return rightTime - leftTime;
  });
}

export async function loadResolverSources(
  service: SupabaseClient,
  definitions: ResolverSourceDefinition[],
  defaultLimit = DEFAULT_SOURCE_LIMIT
) {
  return Promise.all(
    definitions.map(async (definition) => {
      try {
        const result: any = await service
          .from(definition.table)
          .select("*")
          .limit(definition.limit ?? defaultLimit);

        if (result.error) {
          return {
            ...definition,
            status: isMissingRelationError(result.error) ? "missing" : "error",
            rowCount: 0,
            rows: [],
            error:
              result.error instanceof Error
                ? result.error.message
                : String(result.error?.message || result.error || ""),
          } satisfies LoadedResolverSource;
        }

        const rows = Array.isArray(result.data)
          ? (result.data as Array<Record<string, unknown>>)
          : [];
        return {
          ...definition,
          status: rows.length ? "data" : "empty",
          rowCount: rows.length,
          rows,
          error: null,
        } satisfies LoadedResolverSource;
      } catch (error) {
        return {
          ...definition,
          status: isMissingRelationError(error) ? "missing" : "error",
          rowCount: 0,
          rows: [],
          error: error instanceof Error ? error.message : String(error || ""),
        } satisfies LoadedResolverSource;
      }
    })
  );
}

export function createResolverDiagnostics(
  domain: string,
  sources: LoadedResolverSource[],
  notes: string[] = []
): ResolverDiagnostics {
  return {
    domain,
    sources,
    mergedTables: sources.filter((source) => source.status === "data").map((source) => source.table),
    deduped: 0,
    conflicts: [],
    notes,
  };
}

export function recordDedupe(diagnostics: ResolverDiagnostics, count = 1) {
  diagnostics.deduped += count;
}

export function recordConflict(diagnostics: ResolverDiagnostics, message: string) {
  if (!message) return;
  if (diagnostics.conflicts.includes(message)) return;
  if (diagnostics.conflicts.length >= 50) return;
  diagnostics.conflicts.push(message);
}

export function mergeSourceTables(
  current: string[] | null | undefined,
  incoming: string[] | null | undefined
) {
  return Array.from(new Set([...(current || []), ...(incoming || [])]));
}

export function mergeResolvedRecord<
  T extends {
    source_tables?: string[];
    primary_source_table?: string | null;
    [key: string]: unknown;
  },
>(
  current: T,
  incoming: T,
  diagnostics: ResolverDiagnostics,
  label: string,
  trackedKeys: string[]
) {
  const next = { ...current } as T;

  for (const [key, value] of Object.entries(incoming)) {
    if (key === "source_tables") {
      next.source_tables = mergeSourceTables(
        current.source_tables,
        value as string[] | null | undefined
      );
      continue;
    }

    if (key === "primary_source_table") continue;

    if (!hasValue(next[key]) && hasValue(value)) {
      (next as Record<string, unknown>)[key] = value;
      continue;
    }

    if (!trackedKeys.includes(key)) continue;
    if (!hasValue(next[key]) || !hasValue(value)) continue;
    if (sameScalarValue(next[key], value)) continue;

    recordConflict(
      diagnostics,
      `${label}: conflict on ${key} between ${String(current.primary_source_table || "unknown")} and ${String(incoming.primary_source_table || "unknown")}`
    );
  }

  return next;
}

export function finalizeResolverDiagnostics(diagnostics: ResolverDiagnostics) {
  const errorSources = diagnostics.sources.filter((source) => source.status === "error");
  const activeSources = diagnostics.sources.filter((source) => source.status === "data");

  if (!activeSources.length) {
    console.warn(
      `[resolver:${diagnostics.domain}] no active sources`,
      JSON.stringify({
        sources: diagnostics.sources.map((source) => ({
          table: source.table,
          classification: source.classification,
          status: source.status,
          rowCount: source.rowCount,
          error: source.error,
        })),
        notes: diagnostics.notes,
      })
    );
    return diagnostics;
  }

  if (activeSources.length > 1 || diagnostics.conflicts.length || errorSources.length) {
    console.info(
      `[resolver:${diagnostics.domain}]`,
      JSON.stringify({
        mergedTables: diagnostics.mergedTables,
        deduped: diagnostics.deduped,
        conflicts: diagnostics.conflicts,
        sources: diagnostics.sources.map((source) => ({
          table: source.table,
          classification: source.classification,
          evidence: source.evidence,
          status: source.status,
          rowCount: source.rowCount,
          error: source.error,
        })),
        notes: diagnostics.notes,
      })
    );
  }

  return diagnostics;
}

export function toResolverResult<T>(
  data: T,
  diagnostics: ResolverDiagnostics
): ResolverResult<T> {
  const finalized = finalizeResolverDiagnostics(diagnostics);

  return {
    data,
    diagnostics: {
      sourcesChecked: finalized.sources.map((source) => source.table),
      sourcesUsed: finalized.sources
        .filter((source) => source.status === "data")
        .map((source) => source.table),
      missingTables: finalized.sources
        .filter((source) => source.status === "missing")
        .map((source) => source.table),
      rowCounts: Object.fromEntries(
        finalized.sources.map((source) => [source.table, source.rowCount] as const)
      ),
      mergeNotes: [
        ...(finalized.mergedTables.length > 1
          ? [`Merged parallel sources: ${finalized.mergedTables.join(", ")}`]
          : []),
        ...(finalized.deduped > 0
          ? [`Deduped ${finalized.deduped} records during merge.`]
          : []),
        ...finalized.notes,
      ],
      warnings: [
        ...finalized.conflicts,
        ...finalized.sources
          .filter((source) => source.status === "error")
          .map(
            (source) =>
              `${source.table}: ${source.error || "Unexpected resolver source error."}`
          ),
      ],
    },
  };
}
