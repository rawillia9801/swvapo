import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type ResolverResult,
  type ResolverSourceDefinition,
  compositeKey,
  createResolverDiagnostics,
  firstPresent,
  hasValue,
  loadResolverSources,
  mergeResolvedRecord,
  normalizedText,
  numberValue,
  recordDedupe,
  recordValue,
  sortByRecent,
  textValue,
  toResolverResult,
} from "@/lib/resolvers/_shared";

const DOG_SOURCE_DEFINITIONS: ResolverSourceDefinition[] = [
  {
    table: "bp_dogs",
    classification: "canonical_base_record",
    evidence: "code",
    description: "Current breeding-program dog records used by lineage and admin routes.",
  },
  {
    table: "breeding_dogs",
    classification: "parallel_live_source",
    evidence: "runtime_candidate",
    description: "Parallel breeding dog source present in production schema drift scenarios.",
  },
  {
    table: "our_dogs",
    classification: "parallel_live_source",
    evidence: "runtime_candidate",
    description: "Adjacent public-facing dog records used only to fill missing presentation fields.",
  },
  {
    table: "lineage_breeding_dog_stats",
    classification: "derived_support_view",
    evidence: "migration",
    description: "Derived breeding dog metrics view. Never canonical truth.",
  },
];

const LITTER_SOURCE_DEFINITIONS: ResolverSourceDefinition[] = [
  {
    table: "litters",
    classification: "canonical_base_record",
    evidence: "code",
    description: "Current breeding-program litter table.",
  },
  {
    table: "bp_litters",
    classification: "parallel_live_source",
    evidence: "runtime_candidate",
    description: "Legacy or parallel litter source that may still hold live rows.",
  },
  {
    table: "lineage_litter_stats",
    classification: "derived_support_view",
    evidence: "migration",
    description: "Derived litter metrics view. Support only.",
  },
];

const PUPPY_SOURCE_DEFINITIONS: ResolverSourceDefinition[] = [
  {
    table: "puppies",
    classification: "canonical_base_record",
    evidence: "code",
    description: "Current puppy table used by admin and portal routes.",
  },
  {
    table: "bp_puppies",
    classification: "parallel_live_source",
    evidence: "runtime_candidate",
    description: "Parallel or legacy breeding-program puppy source.",
  },
  {
    table: "core_puppies",
    classification: "core_overlay_orchestration",
    evidence: "runtime_candidate",
    description: "Core overlay for puppy state. Used only to enrich base records.",
  },
];

type SupportMetricRow = Record<string, unknown>;

export type ResolvedBreedingDog = {
  id: string;
  resolver_key: string;
  sourceTable: string;
  sourceTables: string[];
  displayName: string;
  callName: string | null;
  sex: string | null;
  dob: string | null;
  status: string | null;
  color: string | null;
  coatType: string | null;
  photoUrl: string | null;
  damId: string | null;
  sireId: string | null;
  notes: string | null;
  role: string | null;
  registry: string | null;
  registrationNo: string | null;
  geneticsSummary: string | null;
  geneticsRaw: string | null;
  geneticsReportUrl: string | null;
  supportMetrics: Record<string, unknown> | null;
};

export type ResolvedLitter = {
  id: number | null;
  resolver_key: string;
  sourceTable: string;
  sourceTables: string[];
  damId: string | null;
  sireId: string | null;
  birthDate: string | null;
  litterName: string | null;
  puppyCount: number;
  status: string | null;
  litterCode: string | null;
  notes: string | null;
  supportMetrics: Record<string, unknown> | null;
};

export type ResolvedBreedingPuppy = {
  id: number | null;
  resolver_key: string;
  sourceTable: string;
  sourceTables: string[];
  buyerId: number | null;
  litterId: number | null;
  litterName: string | null;
  damId: string | null;
  sireId: string | null;
  displayName: string;
  callName: string | null;
  sex: string | null;
  dob: string | null;
  color: string | null;
  coatType: string | null;
  status: string | null;
  price: number | null;
  listPrice: number | null;
  deposit: number | null;
  balance: number | null;
  photoUrl: string | null;
  ownerEmail: string | null;
  notes: string | null;
};

export type ResolvedBreedingWorkspace = {
  resolvedDogs: ResolvedBreedingDog[];
  resolvedLitters: ResolvedLitter[];
  resolvedPuppies: ResolvedBreedingPuppy[];
};

function normalizeDogRole(row: Record<string, unknown>) {
  const raw = normalizedText(
    firstPresent(textValue(row, "role"), textValue(row, "sex"), textValue(row, "gender"))
  );
  if (!raw) return null;
  if (raw === "male" || raw === "stud") return "sire";
  if (raw === "female") return "dam";
  return raw;
}

function normalizeDogRow(table: string, row: Record<string, unknown>): ResolvedBreedingDog {
  const displayName =
    firstPresent(
      textValue(row, "display_name"),
      textValue(row, "dog_name"),
      textValue(row, "call_name"),
      textValue(row, "name"),
      textValue(row, "registered_name")
    ) || textValue(row, "id") || table;

  const id =
    textValue(row, "id") ||
    compositeKey(displayName, textValue(row, "dob"), textValue(row, "date_of_birth")) ||
    table;

  return {
    id,
    resolver_key: dogResolverKey(table, row),
    sourceTable: table,
    sourceTables: [table],
    displayName: String(displayName),
    callName: textValue(row, "call_name"),
    sex: firstPresent(textValue(row, "sex"), normalizeDogRole(row)) ?? null,
    dob: firstPresent(textValue(row, "dob"), textValue(row, "date_of_birth")) ?? null,
    status: textValue(row, "status"),
    color: textValue(row, "color"),
    coatType: firstPresent(textValue(row, "coat_type"), textValue(row, "coat")) ?? null,
    photoUrl:
      firstPresent(
      textValue(row, "photo_url"),
      textValue(row, "image_url"),
      textValue(row, "profile_photo_url")
      ) ?? null,
    damId: textValue(row, "dam_id"),
    sireId: textValue(row, "sire_id"),
    notes: textValue(row, "notes", "description"),
    role: normalizeDogRole(row),
    registry: textValue(row, "registry"),
    registrationNo:
      firstPresent(textValue(row, "registration_no"), textValue(row, "registration_number")) ??
      null,
    geneticsSummary: textValue(row, "genetics_summary"),
    geneticsRaw: textValue(row, "genetics_raw"),
    geneticsReportUrl: textValue(row, "genetics_report_url"),
    supportMetrics: null,
  };
}

function normalizeLitterRow(table: string, row: Record<string, unknown>): ResolvedLitter {
  const id = numberValue(row, "id");
  const litterName = firstPresent(textValue(row, "litter_name"), textValue(row, "litter_code"));

  return {
    id,
    resolver_key: litterResolverKey(table, row),
    sourceTable: table,
    sourceTables: [table],
    damId: textValue(row, "dam_id"),
    sireId: textValue(row, "sire_id"),
    birthDate: firstPresent(textValue(row, "birth_date"), textValue(row, "whelp_date")) ?? null,
    litterName: litterName ?? null,
    puppyCount: numberValue(row, "total_puppies", "puppy_count") || 0,
    status: textValue(row, "status"),
    litterCode: textValue(row, "litter_code"),
    notes: textValue(row, "notes"),
    supportMetrics: null,
  };
}

function normalizePuppyRow(table: string, row: Record<string, unknown>): ResolvedBreedingPuppy {
  const id = numberValue(row, "id");
  const displayName =
    firstPresent(textValue(row, "call_name"), textValue(row, "puppy_name"), textValue(row, "name")) ||
    textValue(row, "id") ||
    table;

  return {
    id,
    resolver_key: puppyResolverKey(table, row),
    sourceTable: table,
    sourceTables: [table],
    buyerId: numberValue(row, "buyer_id"),
    litterId: numberValue(row, "litter_id"),
    litterName: textValue(row, "litter_name"),
    damId: textValue(row, "dam_id"),
    sireId: textValue(row, "sire_id"),
    displayName: String(displayName),
    callName: textValue(row, "call_name"),
    sex: firstPresent(textValue(row, "sex"), textValue(row, "gender")) ?? null,
    dob: firstPresent(textValue(row, "dob"), textValue(row, "birth_date")) ?? null,
    color: textValue(row, "color"),
    coatType: firstPresent(textValue(row, "coat_type"), textValue(row, "coat")) ?? null,
    status: textValue(row, "status"),
    price: numberValue(row, "price", "sale_price"),
    listPrice: numberValue(row, "list_price"),
    deposit: numberValue(row, "deposit", "deposit_amount"),
    balance: numberValue(row, "balance"),
    photoUrl: firstPresent(textValue(row, "photo_url"), textValue(row, "image_url")) ?? null,
    ownerEmail: firstPresent(textValue(row, "owner_email"), textValue(row, "email")) ?? null,
    notes: textValue(row, "notes", "description"),
  };
}

function dogResolverKey(table: string, row: Record<string, unknown>) {
  const id = textValue(row, "id");
  if (id) return `id:${id}`;

  const byNameSexDob = compositeKey(
    textValue(row, "dog_name"),
    textValue(row, "call_name"),
    textValue(row, "name"),
    normalizeDogRole(row),
    textValue(row, "dob"),
    textValue(row, "date_of_birth")
  );
  if (byNameSexDob) return `identity:${byNameSexDob}`;

  const byLineage = compositeKey(
    textValue(row, "dam_id"),
    textValue(row, "sire_id"),
    textValue(row, "dog_name"),
    textValue(row, "call_name"),
    textValue(row, "name")
  );
  if (byLineage) return `lineage:${byLineage}`;

  return `source:${table}:${compositeKey(
    textValue(row, "display_name"),
    textValue(row, "dog_name"),
    textValue(row, "call_name"),
    textValue(row, "name"),
    textValue(row, "registered_name"),
    textValue(row, "status")
  )}`;
}

function dogSourcePriority(table: string | null | undefined) {
  if (table === "bp_dogs") return 0;
  if (table === "breeding_dogs") return 1;
  if (table === "our_dogs") return 2;
  return 9;
}

function dogIdentityKey(dog: ResolvedBreedingDog) {
  const name = normalizedText(firstPresent(dog.callName, dog.displayName));
  if (!name) return `source:${dog.resolver_key}`;

  const role = normalizedText(dog.role) || "dog";
  const dob = normalizedText(dog.dob);
  const registration = normalizedText(dog.registrationNo || dog.registry);
  return `identity:${role}:${name}:${dob || registration}`;
}

function mergeDogIdentityRecords(
  dogs: ResolvedBreedingDog[],
  diagnostics: ReturnType<typeof createResolverDiagnostics>
) {
  const grouped = new Map<string, ResolvedBreedingDog>();

  dogs
    .slice()
    .sort((left, right) => dogSourcePriority(left.sourceTable) - dogSourcePriority(right.sourceTable))
    .forEach((dog) => {
      const key = dogIdentityKey(dog);
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, dog);
        return;
      }

      const preferred =
        dogSourcePriority(dog.sourceTable) < dogSourcePriority(existing.sourceTable)
          ? dog
          : existing;
      const supplemental = preferred === dog ? existing : dog;
      const merged = mergeResolvedRecord(
        preferred,
        supplemental,
        diagnostics,
        `breeding dog ${preferred.displayName}`,
        ["displayName", "sex", "dob", "status", "color", "coatType", "damId", "sireId"]
      );

      grouped.set(key, {
        ...merged,
        id: preferred.id,
        resolver_key: preferred.resolver_key,
        sourceTable: preferred.sourceTable,
        sourceTables: Array.from(
          new Set([...(preferred.sourceTables || []), ...(supplemental.sourceTables || [])])
        ),
        supportMetrics: preferred.supportMetrics || supplemental.supportMetrics || null,
      });
      recordDedupe(diagnostics);
    });

  return Array.from(grouped.values());
}

function litterResolverKey(table: string, row: Record<string, unknown>) {
  const id = numberValue(row, "id");
  if (id !== null) return `id:${id}`;

  const byNameDate = compositeKey(
    textValue(row, "litter_name"),
    textValue(row, "litter_code"),
    textValue(row, "birth_date"),
    textValue(row, "whelp_date")
  );
  if (byNameDate) return `identity:${byNameDate}`;

  return `source:${table}:${compositeKey(
    textValue(row, "dam_id"),
    textValue(row, "sire_id"),
    textValue(row, "status"),
    textValue(row, "notes")
  )}`;
}

function puppyResolverKey(table: string, row: Record<string, unknown>) {
  const id = numberValue(row, "id");
  if (id !== null) return `id:${id}`;

  const byNameDob = compositeKey(
    textValue(row, "call_name"),
    textValue(row, "puppy_name"),
    textValue(row, "name"),
    textValue(row, "dob"),
    textValue(row, "birth_date"),
    textValue(row, "sex")
  );
  if (byNameDob) return `identity:${byNameDob}`;

  return `source:${table}:${compositeKey(
    textValue(row, "call_name"),
    textValue(row, "puppy_name"),
    textValue(row, "name"),
    textValue(row, "litter_name"),
    textValue(row, "status")
  )}`;
}

function supportMetricMap(
  rows: LoadedSupportSource[],
  keyName: "id"
) {
  const map = new Map<string, SupportMetricRow>();
  rows.forEach((source) => {
    source.rows.forEach((row) => {
      const id = textValue(row, keyName);
      if (!id) return;
      if (map.has(id)) return;
      map.set(id, row);
    });
  });
  return map;
}

type LoadedSupportSource = Awaited<ReturnType<typeof loadResolverSources>>[number];

async function resolveWorkspaceState(service: SupabaseClient) {
  const [dogSources, litterSources, puppySources] = await Promise.all([
    loadResolverSources(service, DOG_SOURCE_DEFINITIONS),
    loadResolverSources(service, LITTER_SOURCE_DEFINITIONS),
    loadResolverSources(service, PUPPY_SOURCE_DEFINITIONS),
  ]);

  const diagnostics = createResolverDiagnostics("breeding", [
    ...dogSources,
    ...litterSources,
    ...puppySources,
  ]);

  const dogMetrics = supportMetricMap(
    dogSources.filter((source) => source.table === "lineage_breeding_dog_stats"),
    "id"
  );
  const litterMetrics = supportMetricMap(
    litterSources.filter((source) => source.table === "lineage_litter_stats"),
    "id"
  );

  const dogRecords = new Map<string, ResolvedBreedingDog>();
  dogSources
    .filter((source) => source.classification !== "derived_support_view")
    .forEach((source) => {
      source.rows.forEach((row) => {
        const normalized = normalizeDogRow(source.table, row);
        const existing = dogRecords.get(normalized.resolver_key);
        if (!existing) {
          dogRecords.set(normalized.resolver_key, {
            ...normalized,
            supportMetrics: dogMetrics.get(normalized.id) || null,
          });
          return;
        }

        const merged = mergeResolvedRecord(
          existing,
          normalized,
          diagnostics,
          `breeding dog ${existing.displayName}`,
          ["displayName", "sex", "dob", "status", "color", "coatType", "damId", "sireId"]
        );
        merged.sourceTables = Array.from(new Set([...(existing.sourceTables || []), source.table]));
        dogRecords.set(normalized.resolver_key, {
          ...merged,
          supportMetrics: existing.supportMetrics || dogMetrics.get(existing.id) || null,
        });
        recordDedupe(diagnostics);
      });
    });

  const puppyRecords = new Map<string, ResolvedBreedingPuppy>();
  puppySources.forEach((source) => {
    source.rows.forEach((row) => {
      const normalized = normalizePuppyRow(source.table, row);
      const existing = puppyRecords.get(normalized.resolver_key);
      if (!existing) {
        puppyRecords.set(normalized.resolver_key, normalized);
        return;
      }

      const merged = mergeResolvedRecord(
        existing,
        normalized,
        diagnostics,
        `puppy ${existing.displayName}`,
        ["displayName", "sex", "dob", "status", "buyerId", "litterId", "damId", "sireId"]
      );
      merged.sourceTables = Array.from(new Set([...(existing.sourceTables || []), source.table]));
      puppyRecords.set(normalized.resolver_key, merged);
      recordDedupe(diagnostics);
    });
  });

  const litterRecords = new Map<string, ResolvedLitter>();
  litterSources
    .filter((source) => source.classification !== "derived_support_view")
    .forEach((source) => {
      source.rows.forEach((row) => {
        const normalized = normalizeLitterRow(source.table, row);
        const existing = litterRecords.get(normalized.resolver_key);
        if (!existing) {
          litterRecords.set(normalized.resolver_key, {
            ...normalized,
            supportMetrics:
              normalized.id !== null
                ? litterMetrics.get(String(normalized.id)) || null
                : null,
          });
          return;
        }

        const merged = mergeResolvedRecord(
          existing,
          normalized,
          diagnostics,
          `litter ${existing.litterName || existing.resolver_key}`,
          ["damId", "sireId", "birthDate", "status", "litterName", "puppyCount"]
        );
        merged.sourceTables = Array.from(new Set([...(existing.sourceTables || []), source.table]));
        litterRecords.set(normalized.resolver_key, {
          ...merged,
          supportMetrics:
            existing.supportMetrics ||
            (existing.id !== null ? litterMetrics.get(String(existing.id)) || null : null),
        });
        recordDedupe(diagnostics);
      });
    });

  const puppies = sortByRecent(Array.from(puppyRecords.values()), "created_at", "dob");
  const puppyCountByLitterId = new Map<number, number>();
  puppies.forEach((puppy) => {
    if (puppy.litterId === null) return;
    puppyCountByLitterId.set(
      puppy.litterId,
      Number(puppyCountByLitterId.get(puppy.litterId) || 0) + 1
    );
  });

  const litters = sortByRecent(Array.from(litterRecords.values()), "birthDate").map((litter) => {
    const supportCount = numberValue(litter.supportMetrics || null, "total_puppies", "puppy_count");
    return {
      ...litter,
      puppyCount:
        supportCount ??
        (litter.id !== null ? Number(puppyCountByLitterId.get(litter.id) || 0) : litter.puppyCount),
    };
  });

  const dogs = mergeDogIdentityRecords(Array.from(dogRecords.values()), diagnostics).sort(
    (left, right) => left.displayName.localeCompare(right.displayName)
  );

  return toResolverResult<ResolvedBreedingWorkspace>(
    {
      resolvedDogs: dogs,
      resolvedLitters: litters,
      resolvedPuppies: puppies,
    },
    diagnostics
  );
}

export async function resolveBreedingWorkspace(service: SupabaseClient) {
  return resolveWorkspaceState(service);
}

export async function resolveBreedingDogs(
  service: SupabaseClient
): Promise<ResolverResult<ResolvedBreedingDog[]>> {
  const workspace = await resolveWorkspaceState(service);
  return {
    data: workspace.data.resolvedDogs,
    diagnostics: workspace.diagnostics,
  };
}

export async function resolveLitters(
  service: SupabaseClient
): Promise<ResolverResult<ResolvedLitter[]>> {
  const workspace = await resolveWorkspaceState(service);
  return {
    data: workspace.data.resolvedLitters,
    diagnostics: workspace.diagnostics,
  };
}
