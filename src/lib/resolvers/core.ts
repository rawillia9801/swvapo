import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type ResolverResult,
  type ResolverSourceDefinition,
  compositeKey,
  createResolverDiagnostics,
  loadResolverSources,
  sortByRecent,
  textValue,
  toResolverResult,
} from "@/lib/resolvers/_shared";

const CORE_SOURCES: ResolverSourceDefinition[] = [
  {
    table: "core_alerts",
    classification: "core_overlay_orchestration",
    evidence: "runtime_candidate",
    description: "Core alert and intelligence overlay.",
    limit: 5000,
  },
  {
    table: "core_assistant_state",
    classification: "core_overlay_orchestration",
    evidence: "runtime_candidate",
    description: "Core assistant/control state.",
    limit: 5000,
  },
  {
    table: "core_blockers_view",
    classification: "derived_support_view",
    evidence: "runtime_candidate",
    description: "Derived blocker view.",
    limit: 5000,
  },
  {
    table: "core_command_center_snapshot",
    classification: "derived_support_view",
    evidence: "runtime_candidate",
    description: "Command center snapshot and KPIs.",
    limit: 5000,
  },
  {
    table: "core_command_requests",
    classification: "core_overlay_orchestration",
    evidence: "runtime_candidate",
    description: "Core command/orchestration requests.",
    limit: 5000,
  },
  {
    table: "core_dashboard_kpis",
    classification: "derived_support_view",
    evidence: "runtime_candidate",
    description: "Core KPI projection.",
    limit: 5000,
  },
  {
    table: "core_events",
    classification: "core_overlay_orchestration",
    evidence: "runtime_candidate",
    description: "Core orchestration events.",
    limit: 5000,
  },
  {
    table: "core_overrides",
    classification: "core_overlay_orchestration",
    evidence: "runtime_candidate",
    description: "Core override state.",
    limit: 5000,
  },
  {
    table: "core_transition_rules",
    classification: "core_overlay_orchestration",
    evidence: "runtime_candidate",
    description: "Core transition rules.",
    limit: 5000,
  },
  {
    table: "core_surface_status_view",
    classification: "derived_support_view",
    evidence: "runtime_candidate",
    description: "Surface-level status view.",
    limit: 5000,
  },
  {
    table: "core_phase_status_view",
    classification: "derived_support_view",
    evidence: "runtime_candidate",
    description: "Phase status view.",
    limit: 5000,
  },
  {
    table: "core_playbook_status_view",
    classification: "derived_support_view",
    evidence: "runtime_candidate",
    description: "Playbook status view.",
    limit: 5000,
  },
  {
    table: "core_presence_state_view",
    classification: "derived_support_view",
    evidence: "runtime_candidate",
    description: "Presence state view.",
    limit: 5000,
  },
  {
    table: "core_environment_overview_view",
    classification: "derived_support_view",
    evidence: "runtime_candidate",
    description: "Environment overview view.",
    limit: 5000,
  },
];

export type ResolvedCoreEntry = {
  id: string;
  sourceTable: string;
  title: string | null;
  status: string | null;
  createdAt: string | null;
  payload: Record<string, unknown>;
};

export type ResolvedCoreDashboard = {
  alerts: ResolvedCoreEntry[];
  blockers: ResolvedCoreEntry[];
  kpis: ResolvedCoreEntry[];
  statusViews: ResolvedCoreEntry[];
  recentCommands: ResolvedCoreEntry[];
  recentEvents: ResolvedCoreEntry[];
};

function normalizeCoreEntry(
  sourceTable: string,
  row: Record<string, unknown>
): ResolvedCoreEntry {
  const id =
    textValue(row, "id") ||
    compositeKey(sourceTable, textValue(row, "created_at"), textValue(row, "title")) ||
    sourceTable;
  return {
    id: `${sourceTable}:${id}`,
    sourceTable,
    title: firstPresentText(row, "title", "name", "label", "summary"),
    status: textValue(row, "status"),
    createdAt: firstPresentText(row, "updated_at", "created_at"),
    payload: row,
  };
}

function firstPresentText(row: Record<string, unknown>, ...keys: string[]) {
  return keys.map((key) => textValue(row, key)).find(Boolean) || null;
}

async function resolveCoreState(service: SupabaseClient) {
  const sources = await loadResolverSources(service, CORE_SOURCES);
  const diagnostics = createResolverDiagnostics("core", sources);

  const entries = sources.flatMap((source) =>
    source.rows.map((row) => normalizeCoreEntry(source.table, row))
  );

  return toResolverResult<ResolvedCoreDashboard>(
    {
      alerts: sortByRecent(entries.filter((entry) => entry.sourceTable.includes("alerts")), "createdAt"),
      blockers: sortByRecent(entries.filter((entry) => entry.sourceTable.includes("blockers")), "createdAt"),
      kpis: entries.filter(
        (entry) =>
          entry.sourceTable.includes("kpis") || entry.sourceTable.includes("snapshot")
      ),
      statusViews: entries.filter((entry) => entry.sourceTable.includes("_view")),
      recentCommands: sortByRecent(
        entries.filter((entry) => entry.sourceTable.includes("command_requests")),
        "createdAt"
      ),
      recentEvents: sortByRecent(
        entries.filter((entry) => entry.sourceTable.includes("core_events")),
        "createdAt"
      ),
    },
    diagnostics
  );
}

export async function resolveCoreDashboard(
  service: SupabaseClient
): Promise<ResolverResult<ResolvedCoreDashboard>> {
  return resolveCoreState(service);
}

export async function resolveCoreAlerts(
  service: SupabaseClient
): Promise<ResolverResult<ResolvedCoreEntry[]>> {
  const resolved = await resolveCoreState(service);
  return {
    data: resolved.data.alerts,
    diagnostics: resolved.diagnostics,
  };
}

export async function resolveCoreBlockers(
  service: SupabaseClient
): Promise<ResolverResult<ResolvedCoreEntry[]>> {
  const resolved = await resolveCoreState(service);
  return {
    data: resolved.data.blockers,
    diagnostics: resolved.diagnostics,
  };
}

export async function resolveCoreStatus(
  service: SupabaseClient
): Promise<ResolverResult<ResolvedCoreEntry[]>> {
  const resolved = await resolveCoreState(service);
  return {
    data: resolved.data.statusViews,
    diagnostics: resolved.diagnostics,
  };
}
