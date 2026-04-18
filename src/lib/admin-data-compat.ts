import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export const BREEDING_DOG_TABLES = ["bp_dogs", "breeding_dogs"] as const;
export const BUYER_PAYMENT_NOTICE_LOG_TABLES = [
  "buyer_payment_notice_logs",
  "buyer_payment_notices_logs",
] as const;
export const CHICHI_ADMIN_DIGEST_TABLES = [
  "chichi_admin_digests",
  "chichi_admin_digest",
] as const;

type QueryConfig = (query: any) => any;

type QueryResult<T> = {
  data: T[] | null;
  error: unknown;
  table: string | null;
};

function isNoData(rows: unknown) {
  return !Array.isArray(rows) || rows.length === 0;
}

async function resolveQuery<T>(
  table: string,
  run: (table: string) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<QueryResult<T>> {
  try {
    const result = await run(table);
    return {
      data: result.data || [],
      error: result.error || null,
      table,
    };
  } catch (error) {
    return {
      data: null,
      error,
      table,
    };
  }
}

export function isMissingRelationError(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error || "")).toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("relation") ||
    message.includes("schema cache") ||
    message.includes("could not find the table")
  );
}

export async function queryPreferredRows<T>(
  tables: readonly [string, string],
  run: (table: string) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<QueryResult<T>> {
  const primaryResult = await resolveQuery(tables[0], run);
  if (!primaryResult.error) {
    if (!isNoData(primaryResult.data)) return primaryResult;
    const fallbackResult = await resolveQuery(tables[1], run);
    if (!fallbackResult.error && !isNoData(fallbackResult.data)) return fallbackResult;
    return primaryResult;
  }

  if (!isMissingRelationError(primaryResult.error)) return primaryResult;

  return resolveQuery(tables[1], run);
}

export async function chooseFirstAvailableTable(
  service: SupabaseClient,
  tables: readonly string[],
  probeColumn = "id"
) {
  let lastError: unknown = null;

  for (const table of tables) {
    let result: { error: unknown } | null = null;

    try {
      result = (await (service.from(table).select(probeColumn).limit(1) as any)) as {
        error: unknown;
      };
    } catch (error) {
      result = { error };
    }

    if (!result?.error) {
      return { table, error: null as unknown };
    }

    if (!isMissingRelationError(result.error)) {
      return { table: null, error: result.error };
    }

    lastError = result.error;
  }

  return { table: null, error: lastError };
}

export async function findTableWithMatch(
  service: SupabaseClient,
  tables: readonly string[],
  column: string,
  value: string | number
) {
  let lastError: unknown = null;

  for (const table of tables) {
    try {
      const result: any = await service
        .from(table)
        .select("id")
        .eq(column, value)
        .limit(1)
        .maybeSingle();

      if (result.error) {
        if (!isMissingRelationError(result.error)) {
          return { table: null, error: result.error };
        }

        lastError = result.error;
        continue;
      }

      if (result.data) {
        return { table, error: null as unknown };
      }
    } catch (error) {
      if (!isMissingRelationError(error)) {
        return { table: null, error };
      }

      lastError = error;
    }
  }

  return { table: null, error: lastError };
}

export function queryBreedingDogs<T>(
  service: SupabaseClient,
  select: string,
  configure?: QueryConfig
) {
  return queryPreferredRows<T>(BREEDING_DOG_TABLES, (table) => {
    let query: any = service.from(table).select(select);
    if (configure) query = configure(query);
    return query as PromiseLike<{ data: T[] | null; error: unknown }>;
  });
}

export function queryBuyerPaymentNoticeLogs<T>(
  service: SupabaseClient,
  select: string,
  configure?: QueryConfig
) {
  return queryPreferredRows<T>(BUYER_PAYMENT_NOTICE_LOG_TABLES, (table) => {
    let query: any = service.from(table).select(select);
    if (configure) query = configure(query);
    return query as PromiseLike<{ data: T[] | null; error: unknown }>;
  });
}

export function queryChiChiAdminDigests<T>(
  service: SupabaseClient,
  select: string,
  configure?: QueryConfig
) {
  return queryPreferredRows<T>(CHICHI_ADMIN_DIGEST_TABLES, (table) => {
    let query: any = service.from(table).select(select);
    if (configure) query = configure(query);
    return query as PromiseLike<{ data: T[] | null; error: unknown }>;
  });
}
