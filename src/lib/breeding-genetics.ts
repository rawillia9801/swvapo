import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { queryBreedingDogs } from "@/lib/admin-data-compat";

type BreedingDogGeneticsRow = {
  role?: string | null;
  dog_name?: string | null;
  name?: string | null;
  call_name?: string | null;
  color?: string | null;
  coat?: string | null;
  genetics_summary?: string | null;
  genetics_raw?: string | null;
  genetics_report_url?: string | null;
  is_active?: boolean | null;
};

function cleanInlineText(value: string | null | undefined, max = 260) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, Math.max(0, max - 3)).trimEnd()}...` : text;
}

function dogDisplayName(row: BreedingDogGeneticsRow) {
  return (
    String(row.dog_name || "").trim() ||
    String(row.call_name || "").trim() ||
    String(row.name || "").trim() ||
    "Unnamed breeding dog"
  );
}

function normalizeRole(role: string | null | undefined) {
  return String(role || "").trim().toLowerCase() === "sire" ? "sire" : "dam";
}

export function isMissingBreedingGeneticsColumnError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message || "")
        : String(error || "");

  const lower = message.toLowerCase();
  return (
    lower.includes("bp_dogs.genetics_summary") ||
    lower.includes("breeding_dogs.genetics_summary") ||
    lower.includes("bp_dogs.genetics_raw") ||
    lower.includes("breeding_dogs.genetics_raw") ||
    lower.includes("bp_dogs.genetics_report_url") ||
    lower.includes("breeding_dogs.genetics_report_url") ||
    lower.includes("column genetics_summary does not exist") ||
    lower.includes("column genetics_raw does not exist") ||
    lower.includes("column genetics_report_url does not exist")
  );
}

export async function loadBreedingGeneticsPromptContext(
  service: SupabaseClient,
  limit = 16
) {
  const { data, error } = await queryBreedingDogs<BreedingDogGeneticsRow>(
    service,
    "role,dog_name,name,call_name,color,coat,genetics_summary,genetics_raw,genetics_report_url,is_active",
    (query) =>
      query
        .neq("is_active", false)
        .order("role", { ascending: true })
        .order("dog_name", { ascending: true })
        .order("call_name", { ascending: true })
        .limit(limit)
  );

  if (error) {
    if (isMissingBreedingGeneticsColumnError(error)) {
      return "";
    }
    const message =
      error instanceof Error
        ? error.message
        : error && typeof error === "object" && "message" in error
          ? String((error as { message?: unknown }).message || "")
          : String(error || "Unknown error");
    throw new Error(`Could not load breeding genetics context: ${message}`);
  }

  const rows = (data || []).filter(
    (row) =>
      cleanInlineText(row.genetics_summary) ||
      cleanInlineText(row.genetics_raw) ||
      cleanInlineText(row.genetics_report_url)
  );

  if (!rows.length) return "";

  return rows
    .map((row) => {
      const summary = cleanInlineText(row.genetics_summary, 320);
      const raw = summary ? "" : cleanInlineText(row.genetics_raw, 320);
      const reportUrl = cleanInlineText(row.genetics_report_url, 180);

      return [
        `${dogDisplayName(row)} (${normalizeRole(row.role)})`,
        cleanInlineText(row.color) ? `color: ${cleanInlineText(row.color, 80)}` : null,
        cleanInlineText(row.coat) ? `coat: ${cleanInlineText(row.coat, 80)}` : null,
        summary ? `genetics summary: ${summary}` : null,
        raw ? `raw genetics: ${raw}` : null,
        reportUrl ? `report: ${reportUrl}` : null,
      ]
        .filter(Boolean)
        .join(" | ");
    })
    .join("\n");
}
