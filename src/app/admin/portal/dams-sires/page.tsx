"use client";

import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  CircleAlert,
  Clock3,
  Dog,
  Filter,
  GitBranch,
  Layers3,
  PawPrint,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
} from "lucide-react";
import {
  AdminEmptyState,
  AdminHeroPrimaryAction,
  AdminHeroSecondaryAction,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPageHero,
  AdminPageShell,
  AdminRestrictedState,
  adminStatusBadge,
} from "@/components/admin/luxury-admin-shell";
import {
  AdminDateInput,
  AdminSelectInput,
  AdminTextAreaInput,
  AdminTextInput,
} from "@/components/admin/admin-form-fields";
import {
  fetchAdminLineageWorkspace,
  type AdminLineageDog,
  type AdminLineageLitter,
  type AdminLineagePuppy,
  type AdminLineageWorkspace,
} from "@/lib/admin-portal";
import {
  BREEDING_DOG_STATUS_OPTIONS,
  BREEDING_ELIGIBILITY_OPTIONS,
  BREEDING_PROGRAM_STATE_OPTIONS,
  BREEDING_PROVEN_OPTIONS,
  BREEDING_VALUE_TIER_OPTIONS,
  type BreedingProgramMetadata,
  emptyBreedingProgramMetadata,
  firstPhotoUrl,
  parseBreedingProgramMetadata,
  serializeBreedingProgramGenetics,
  serializeBreedingProgramNotes,
  splitMultilineList,
} from "@/lib/breeding-program";
import { normalizeLineageRole } from "@/lib/lineage";
import { usePortalAdminSession } from "@/lib/use-portal-admin-session";
import { buildPuppyPhotoUrl, fmtDate, fmtMoney } from "@/lib/utils";

type ProgramTab = "overview" | "dogs" | "pairings" | "timeline" | "insights";
type DogTab =
  | "profile"
  | "lineage"
  | "health"
  | "genetics"
  | "reproduction"
  | "litters"
  | "offspring"
  | "financials";
type NoticeTone = "success" | "error" | "neutral";

type NoticeState = {
  tone: NoticeTone;
  message: string;
};

type DogForm = {
  role: string;
  dog_name: string;
  name: string;
  call_name: string;
  status: string;
  date_of_birth: string;
  color: string;
  coat: string;
  registry: string;
  genetics_summary: string;
  genetics_report_url: string;
  metadata: BreedingProgramMetadata;
};

type ProgramDogRecord = {
  dog: AdminLineageDog;
  role: "dam" | "sire";
  metadata: BreedingProgramMetadata;
  litters: AdminLineageLitter[];
  puppies: AdminLineagePuppy[];
  ageMonths: number | null;
  ageLabel: string;
  photoUrl: string;
  bloodlineLabel: string;
  warnings: string[];
  completedPuppies: number;
  retainedPuppies: number;
  survivingPuppies: number;
  averageLitterSize: number;
  lastLitterDate: string;
  stateLabel: string;
};

type PairingSummary = {
  key: string;
  dam: ProgramDogRecord | null;
  sire: ProgramDogRecord | null;
  litters: AdminLineageLitter[];
  puppies: AdminLineagePuppy[];
  totalRevenue: number;
  totalProfit: number;
  totalPuppies: number;
  survivingPuppies: number;
  retainedPuppies: number;
  averageLitterSize: number;
  averageSalePrice: number;
  lastWhelpDate: string;
  pregnancyResult: string;
  colorSummary: string;
  coatSummary: string;
};

type TimelineEvent = {
  key: string;
  date: string;
  title: string;
  detail: string;
  category: string;
  dogId?: string;
};

const STATUS_OPTIONS = BREEDING_DOG_STATUS_OPTIONS.map((value) => ({
  value,
  label: value,
}));

const PROGRAM_STATE_OPTIONS = BREEDING_PROGRAM_STATE_OPTIONS.map((value) => ({
  value,
  label: value,
}));

const ELIGIBILITY_OPTIONS = BREEDING_ELIGIBILITY_OPTIONS.map((value) => ({
  value,
  label: value,
}));

const PROVEN_OPTIONS = BREEDING_PROVEN_OPTIONS.map((value) => ({
  value,
  label: value,
}));

const VALUE_TIER_OPTIONS = BREEDING_VALUE_TIER_OPTIONS.map((value) => ({
  value,
  label: value,
}));

const ROLE_OPTIONS = [
  { value: "dam", label: "Dam" },
  { value: "sire", label: "Sire" },
];

const PROGRAM_TABS: Array<{ value: ProgramTab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "dogs", label: "Dogs" },
  { value: "pairings", label: "Pairings" },
  { value: "timeline", label: "Calendar / Timeline" },
  { value: "insights", label: "Reports / Insights" },
];

const DOG_TABS: Array<{ value: DogTab; label: string }> = [
  { value: "profile", label: "Profile" },
  { value: "lineage", label: "Lineage" },
  { value: "health", label: "Health" },
  { value: "genetics", label: "Genetics" },
  { value: "reproduction", label: "Reproduction" },
  { value: "litters", label: "Litters" },
  { value: "offspring", label: "Puppies Produced" },
  { value: "financials", label: "Financials" },
];

const AGE_FILTER_OPTIONS = [
  { value: "all", label: "All ages" },
  { value: "under2", label: "Under 2 years" },
  { value: "prime", label: "2-6 years" },
  { value: "mature", label: "6-8 years" },
  { value: "senior", label: "8+ years" },
];

function text(value: unknown) {
  return String(value || "").trim();
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function dateDiffDays(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor((parsed.getTime() - Date.now()) / 86400000);
}

function ageInMonths(value: string | null | undefined) {
  if (!value) return null;
  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) return null;

  const now = new Date();
  let months =
    (now.getFullYear() - birthDate.getFullYear()) * 12 +
    (now.getMonth() - birthDate.getMonth());

  if (now.getDate() < birthDate.getDate()) {
    months -= 1;
  }

  return months >= 0 ? months : null;
}

function formatAge(value: number | null) {
  if (value == null) return "Age not logged";
  if (value < 12) return `${value} mo`;
  const years = Math.floor(value / 12);
  const months = value % 12;
  return months ? `${years}y ${months}m` : `${years}y`;
}

function matchesAgeBand(months: number | null, filter: string) {
  if (filter === "all") return true;
  if (months == null) return false;
  if (filter === "under2") return months < 24;
  if (filter === "prime") return months >= 24 && months < 72;
  if (filter === "mature") return months >= 72 && months < 96;
  if (filter === "senior") return months >= 96;
  return true;
}

function roleLabel(value: string | null | undefined) {
  return normalizeLineageRole(value) === "sire" ? "Sire" : "Dam";
}

function normalizeStatusGroup(value: string | null | undefined) {
  const status = text(value).toLowerCase();
  if (!status) return "active";
  if (status.includes("prospect")) return "prospect";
  if (status.includes("pregnant")) return "pregnant";
  if (status.includes("nursing")) return "nursing";
  if (status.includes("recover")) return "recovering";
  if (status.includes("pause") || status.includes("hold")) return "paused";
  if (status.includes("retire")) return "retired";
  if (status.includes("deceased") || status.includes("passed")) return "deceased";
  if (status.includes("sold")) return "sold";
  if (status.includes("pet")) return "pet_home";
  if (status.includes("archive")) return "archived";
  return "active";
}

function isInactiveStatus(value: string | null | undefined) {
  return ["retired", "deceased", "sold", "pet_home", "archived"].includes(
    normalizeStatusGroup(value)
  );
}

function isRetainedStatus(value: string | null | undefined) {
  const status = text(value).toLowerCase();
  return (
    status.includes("retain") ||
    status.includes("keeper") ||
    status.includes("holdback") ||
    status.includes("program")
  );
}

function isCompletedStatus(value: string | null | undefined) {
  const status = text(value).toLowerCase();
  return (
    status.includes("complete") ||
    status.includes("sold") ||
    status.includes("matched") ||
    status.includes("adopt")
  );
}

function isLossStatus(value: string | null | undefined) {
  const status = text(value).toLowerCase();
  return (
    status.includes("deceased") ||
    status.includes("loss") ||
    status.includes("pass") ||
    status.includes("stillborn")
  );
}

function resolvePhotoUrl(raw: string) {
  if (!raw) return "";
  if (raw.startsWith("http")) return raw;
  return buildPuppyPhotoUrl(raw);
}

function joinMeta(parts: Array<string | null | undefined>) {
  return parts.map(text).filter(Boolean).join(" | ");
}

function sortByDateDesc<T>(items: T[], getDate: (item: T) => string | null | undefined) {
  return [...items].sort((left, right) => dateValue(getDate(right)) - dateValue(getDate(left)));
}

function newlineList(value: string | null | undefined) {
  return splitMultilineList(value).slice(0, 8);
}

function topLabelFromCounts(values: Array<string | null | undefined>) {
  const counts = new Map<string, number>();
  values
    .map(text)
    .filter(Boolean)
    .forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  const sorted = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  if (!sorted.length) return "No strong trend yet";
  const [label, count] = sorted[0];
  return `${label} (${count})`;
}

function emptyDogForm(role = "dam"): DogForm {
  return {
    role,
    dog_name: "",
    name: "",
    call_name: "",
    status: "Active",
    date_of_birth: "",
    color: "",
    coat: "",
    registry: "",
    genetics_summary: "",
    genetics_report_url: "",
    metadata: emptyBreedingProgramMetadata(),
  };
}

function populateDogForm(record: ProgramDogRecord | null): DogForm {
  if (!record) return emptyDogForm();

  return {
    role: record.role,
    dog_name: text(record.dog.dog_name || record.dog.displayName),
    name: text(record.dog.name || record.metadata.profile.registeredName),
    call_name: text(record.dog.call_name),
    status: text(record.dog.status || "Active"),
    date_of_birth: text(record.dog.date_of_birth || record.dog.dob),
    color: text(record.dog.color),
    coat: text(record.dog.coat || record.dog.coat_type),
    registry: text(record.dog.registry),
    genetics_summary: text(record.dog.genetics_summary),
    genetics_report_url: text(record.dog.genetics_report_url),
    metadata: {
      profile: { ...record.metadata.profile },
      lineage: { ...record.metadata.lineage },
      health: { ...record.metadata.health },
      genetics: { ...record.metadata.genetics },
      reproduction: { ...record.metadata.reproduction },
      admin: { ...record.metadata.admin },
    },
  };
}

function buildDogWarnings(record: ProgramDogRecord) {
  const warnings: string[] = [];
  const { dog, metadata, role, litters } = record;
  const lastHeatGap = dateDiffDays(metadata.reproduction.expectedNextHeat);
  const dueGap = dateDiffDays(metadata.reproduction.dueDate);
  const retirementGap = dateDiffDays(
    metadata.profile.retirementTarget || metadata.profile.retirementDate
  );

  if (!text(dog.date_of_birth || dog.dob)) warnings.push("Birthday missing");
  if (!text(dog.registry) && !text(metadata.profile.registrationNumber)) {
    warnings.push("Registry details incomplete");
  }
  if (!text(dog.genetics_summary) && !text(metadata.genetics.dnaResults)) {
    warnings.push("Genetics summary missing");
  }
  if (!text(metadata.health.testingSummary) && !text(metadata.health.screeningSummary)) {
    warnings.push("Health testing not logged");
  }
  if (role === "dam" && !text(metadata.reproduction.heatCycleHistory) && !litters.length) {
    warnings.push("Heat cycle history missing");
  }
  if (!text(metadata.lineage.bloodlineLabel) && !text(metadata.lineage.pedigreeSummary)) {
    warnings.push("Lineage notes incomplete");
  }
  if (dueGap != null && dueGap >= -7 && dueGap <= 30) warnings.push("Due date within 30 days");
  if (lastHeatGap != null && lastHeatGap >= -5 && lastHeatGap <= 21) {
    warnings.push("Heat window approaching");
  }
  if (retirementGap != null && retirementGap >= 0 && retirementGap <= 180) {
    warnings.push("Retirement review within 6 months");
  }
  if (isInactiveStatus(dog.status) && !text(metadata.admin.incompleteRecordNotes)) {
    warnings.push("Inactive record should include exit notes");
  }

  return warnings.slice(0, 5);
}

function buildPairingSummaries(
  litters: AdminLineageLitter[],
  dogsById: Map<string, ProgramDogRecord>,
) {
  const grouped = new Map<string, PairingSummary>();

  litters.forEach((litter) => {
    const key = `${text(litter.dam_id)}::${text(litter.sire_id)}`;
    if (!key.replace(/:/g, "")) return;

    const existing = grouped.get(key);
    const puppies = litter.puppies || [];
    const summary = existing || {
      key,
      dam: text(litter.dam_id) ? dogsById.get(text(litter.dam_id)) || null : null,
      sire: text(litter.sire_id) ? dogsById.get(text(litter.sire_id)) || null : null,
      litters: [],
      puppies: [],
      totalRevenue: 0,
      totalProfit: 0,
      totalPuppies: 0,
      survivingPuppies: 0,
      retainedPuppies: 0,
      averageLitterSize: 0,
      averageSalePrice: 0,
      lastWhelpDate: "",
      pregnancyResult: "",
      colorSummary: "",
      coatSummary: "",
    };

    summary.litters.push(litter);
    summary.puppies.push(...puppies);
    summary.totalRevenue += toNumber(litter.summary?.totalRevenue);
    summary.totalProfit += toNumber(litter.summary?.totalProfit);
    summary.totalPuppies += puppies.length;
    summary.survivingPuppies += puppies.filter((puppy) => !isLossStatus(puppy.status)).length;
    summary.retainedPuppies += puppies.filter((puppy) => isRetainedStatus(puppy.status)).length;
    summary.lastWhelpDate =
      dateValue(litter.whelp_date) > dateValue(summary.lastWhelpDate)
        ? text(litter.whelp_date)
        : summary.lastWhelpDate;
    summary.pregnancyResult =
      summary.totalPuppies > 0
        ? `${summary.totalPuppies} puppies produced`
        : text(litter.status || "Outcome pending");

    grouped.set(key, summary);
  });

  return [...grouped.values()]
    .map((pairing) => ({
      ...pairing,
      averageLitterSize: pairing.litters.length
        ? pairing.totalPuppies / pairing.litters.length
        : 0,
      averageSalePrice: pairing.totalPuppies
        ? pairing.totalRevenue / pairing.totalPuppies
        : 0,
      colorSummary: topLabelFromCounts(pairing.puppies.map((puppy) => puppy.color)),
      coatSummary: topLabelFromCounts(
        pairing.puppies.map((puppy) => puppy.coat_type || puppy.coat)
      ),
    }))
    .sort((left, right) => right.totalRevenue - left.totalRevenue);
}

function buildTimelineEvents(records: ProgramDogRecord[], litters: AdminLineageLitter[]) {
  const events: TimelineEvent[] = [];

  records.forEach((record) => {
    const { metadata, dog } = record;
    const push = (date: string, title: string, detail: string, category: string) => {
      if (!text(date)) return;
      events.push({
        key: `${dog.id}-${category}-${date}-${title}`,
        date,
        title,
        detail,
        category,
        dogId: String(dog.id),
      });
    };

    push(
      metadata.reproduction.lastHeatDate,
      `${record.dog.displayName} heat recorded`,
      "Most recent heat cycle on file.",
      "Heat Cycle"
    );
    push(
      metadata.reproduction.expectedNextHeat,
      `${record.dog.displayName} next heat window`,
      "Use this to plan breeding timing, progesterone notes, and recovery spacing.",
      "Next Heat"
    );
    push(
      metadata.reproduction.pregnancyConfirmedDate,
      `${record.dog.displayName} pregnancy confirmed`,
      "Pregnancy confirmation entered on the dog profile.",
      "Pregnancy"
    );
    push(
      metadata.reproduction.dueDate,
      `${record.dog.displayName} litter due`,
      "Expected due date pulled from reproductive tracking.",
      "Due Date"
    );
    push(
      metadata.reproduction.whelpDate,
      `${record.dog.displayName} whelped`,
      "Recorded whelp date from the dog profile.",
      "Whelping"
    );
    push(
      metadata.reproduction.nextBreedingWindow,
      `${record.dog.displayName} recommended next breeding window`,
      "Use this as a planning reminder, not an automatic scheduling rule.",
      "Planning"
    );
    push(
      metadata.profile.retirementTarget || metadata.profile.retirementDate,
      `${record.dog.displayName} retirement review`,
      "Program retirement milestone tracked on the profile.",
      "Retirement"
    );
  });

  litters.forEach((litter) => {
    if (!text(litter.whelp_date)) return;
    events.push({
      key: `litter-${litter.id}-${litter.whelp_date}`,
      date: text(litter.whelp_date),
      title: `${text(litter.displayName)} whelp date`,
      detail: joinMeta([
        litter.damProfile?.displayName ? `Dam: ${litter.damProfile.displayName}` : "",
        litter.sireProfile?.displayName ? `Sire: ${litter.sireProfile.displayName}` : "",
        litter.status || "",
      ]),
      category: "Litter",
    });
  });

  return events.sort((left, right) => dateValue(left.date) - dateValue(right.date));
}

function statusToneClass(tone: NoticeTone) {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "error") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-[var(--portal-border)] bg-[var(--portal-surface-muted)] text-[var(--portal-text-soft)]";
}

function Surface({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "rounded-[1.6rem] border border-[rgba(188,162,133,0.2)] bg-[rgba(255,252,248,0.96)] shadow-[0_18px_46px_rgba(92,68,43,0.07)]",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}

function SurfaceHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
          {eyebrow}
        </div>
        <div className="mt-2 text-[1.55rem] font-semibold tracking-[-0.04em] text-[var(--portal-text)]">
          {title}
        </div>
        {subtitle ? (
          <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{subtitle}</div>
        ) : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition",
        active
          ? "border-[#b67b43] bg-[#c88c52] text-white shadow-sm"
          : "border-[var(--portal-border)] bg-white text-[var(--portal-text-soft)] hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function StatChip({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-[1.1rem] border border-[var(--portal-border)] bg-white px-4 py-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-[1.25rem] font-semibold text-[var(--portal-text)]">{value}</div>
      {detail ? (
        <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">{detail}</div>
      ) : null}
    </div>
  );
}

function ReadTile({
  label,
  value,
  detail,
  wrap = false,
}: {
  label: string;
  value: string;
  detail?: string;
  wrap?: boolean;
}) {
  return (
    <div className="rounded-[1.15rem] bg-[rgba(249,244,237,0.8)] px-4 py-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div
        className={
          wrap
            ? "mt-2 text-sm font-semibold leading-6 text-[var(--portal-text)]"
            : "mt-2 truncate text-sm font-semibold text-[var(--portal-text)]"
        }
      >
        {value}
      </div>
      {detail ? (
        <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">{detail}</div>
      ) : null}
    </div>
  );
}

function ListPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "warning" | "success";
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-[var(--portal-border)] bg-white text-[var(--portal-text-soft)]";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}
    >
      {children}
    </span>
  );
}

function BrowserDogCard({
  record,
  selected,
  onClick,
}: {
  record: ProgramDogRecord;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "block w-full rounded-[1.25rem] border px-4 py-4 text-left transition",
        selected
          ? "border-[var(--portal-border-strong)] bg-white shadow-[var(--portal-shadow-sm)]"
          : "border-[var(--portal-border)] bg-[rgba(255,255,255,0.72)] hover:border-[var(--portal-border-strong)] hover:bg-white",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[1rem] bg-[rgba(236,224,210,0.7)]">
          {record.photoUrl ? (
            <div className="relative h-full w-full">
              <Image
                src={record.photoUrl}
                alt={record.dog.displayName}
                fill
                unoptimized
                sizes="56px"
                className="object-cover"
              />
            </div>
          ) : (
            <Dog className="h-6 w-6 text-[#9b6b3c]" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[var(--portal-text)]">
                {record.dog.displayName}
              </div>
              <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                {joinMeta([
                  roleLabel(record.role),
                  record.ageLabel,
                  record.dog.color || "",
                  record.dog.coat || "",
                ])}
              </div>
            </div>
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${adminStatusBadge(
                record.dog.status || record.stateLabel,
              )}`}
            >
              {record.dog.status || record.stateLabel || "Active"}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[var(--portal-text-muted)]">
            <span>{record.litters.length} litters</span>
            <span>•</span>
            <span>{record.puppies.length} puppies</span>
            <span>•</span>
            <span>{fmtMoney(record.dog.summary.totalRevenue)}</span>
          </div>

          {record.warnings.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {record.warnings.slice(0, 2).map((warning) => (
                <ListPill key={`${record.dog.id}-${warning}`} tone="warning">
                  {warning}
                </ListPill>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function TimelineRow({ event }: { event: TimelineEvent }) {
  return (
    <div className="rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
            {event.category}
          </div>
          <div className="mt-1 text-sm font-semibold text-[var(--portal-text)]">{event.title}</div>
          <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">{event.detail}</div>
        </div>
        <ListPill>{fmtDate(event.date)}</ListPill>
      </div>
    </div>
  );
}

function TimelineColumn({
  title,
  events,
  empty,
}: {
  title: string;
  events: TimelineEvent[];
  empty: string;
}) {
  return (
    <div className="rounded-[1.3rem] border border-[var(--portal-border)] bg-white p-4">
      <div className="text-sm font-semibold text-[var(--portal-text)]">{title}</div>
      <div className="mt-4 space-y-3">
        {events.length ? (
          events.map((event) => <TimelineRow key={event.key} event={event} />)
        ) : (
          <div className="rounded-[1rem] bg-[var(--portal-surface-muted)] px-4 py-5 text-xs leading-5 text-[var(--portal-text-soft)]">
            {empty}
          </div>
        )}
      </div>
    </div>
  );
}

function InsightCard({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.2rem] border border-[var(--portal-border)] bg-white p-4">
      <div className="flex items-center gap-2 text-[var(--portal-text)]">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(214,179,141,0.18)] text-[#b67744]">
          {icon}
        </span>
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <div className="mt-4 text-base font-semibold text-[var(--portal-text)]">{value}</div>
      <div className="mt-2 text-xs leading-5 text-[var(--portal-text-soft)]">{detail}</div>
    </div>
  );
}

export default function AdminPortalBreedingProgramPage() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const [workspace, setWorkspace] = useState<AdminLineageWorkspace | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [programTab, setProgramTab] = useState<ProgramTab>("overview");
  const [dogTab, setDogTab] = useState<DogTab>("profile");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [registryFilter, setRegistryFilter] = useState("all");
  const [coatFilter, setCoatFilter] = useState("all");
  const [bloodlineFilter, setBloodlineFilter] = useState("all");
  const [ageFilter, setAgeFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [createMode, setCreateMode] = useState(false);
  const [form, setForm] = useState<DogForm>(emptyDogForm());
  const deferredSearch = useDeferredValue(search);

  async function loadWorkspace(preferredId?: string, nextCreateMode = false) {
    if (!accessToken) return null;

    const nextWorkspace = await fetchAdminLineageWorkspace(accessToken);
    setWorkspace(nextWorkspace);

    if (!nextWorkspace) {
      throw new Error("Could not load the breeding workspace.");
    }

    setCreateMode(nextCreateMode);

    if (nextCreateMode) {
      setSelectedId("");
      return nextWorkspace;
    }

    const nextSelected =
      preferredId && nextWorkspace.dogs.some((dog) => String(dog.id) === preferredId)
        ? preferredId
        : nextWorkspace.dogs[0]
          ? String(nextWorkspace.dogs[0].id)
          : "";

    setSelectedId(nextSelected);
    return nextWorkspace;
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!accessToken || !isAdmin) {
        if (active) setLoadingData(false);
        return;
      }

      setLoadingData(true);
      try {
        const nextWorkspace = await fetchAdminLineageWorkspace(accessToken);
        if (!active) return;
        setWorkspace(nextWorkspace);
        setSelectedId(nextWorkspace?.dogs[0] ? String(nextWorkspace.dogs[0].id) : "");
      } catch (error) {
        if (!active) return;
        setNotice({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Could not load the breeding program workspace.",
        });
      } finally {
        if (active) setLoadingData(false);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [accessToken, isAdmin]);

  const programDogs = useMemo<ProgramDogRecord[]>(() => {
    if (!workspace) return [];

    const litters = workspace.litters || [];
    const puppies = workspace.puppies || [];

    return workspace.dogs.map((dog) => {
      const role = normalizeLineageRole(dog.role);
      const dogLitters = litters.filter((litter) =>
        role === "dam"
          ? text(litter.dam_id) === String(dog.id)
          : text(litter.sire_id) === String(dog.id)
      );
      const dogPuppies = puppies.filter((puppy) =>
        role === "dam"
          ? text(puppy.dam_id || puppy.damProfile?.id) === String(dog.id)
          : text(puppy.sire_id || puppy.sireProfile?.id) === String(dog.id)
      );
      const metadata = parseBreedingProgramMetadata(dog);
      const photoFromDog = resolvePhotoUrl(firstPhotoUrl(metadata));
      const photoFromPuppy = resolvePhotoUrl(
        text(dogPuppies[0]?.photo_url || dogPuppies[0]?.image_url)
      );
      const ageMonths = ageInMonths(dog.date_of_birth || dog.dob);
      const lastLitterDate = sortByDateDesc(dogLitters, (litter) => litter.whelp_date)[0]?.whelp_date || "";

      const record: ProgramDogRecord = {
        dog,
        role,
        metadata,
        litters: dogLitters,
        puppies: dogPuppies,
        ageMonths,
        ageLabel: formatAge(ageMonths),
        photoUrl: photoFromDog || photoFromPuppy,
        bloodlineLabel: text(metadata.lineage.bloodlineLabel) || "Bloodline not tagged",
        warnings: [],
        completedPuppies: dogPuppies.filter((puppy) => isCompletedStatus(puppy.status)).length,
        retainedPuppies: dogPuppies.filter((puppy) => isRetainedStatus(puppy.status)).length,
        survivingPuppies: dogPuppies.filter((puppy) => !isLossStatus(puppy.status)).length,
        averageLitterSize: dogLitters.length ? dogPuppies.length / dogLitters.length : 0,
        lastLitterDate,
        stateLabel: text(metadata.profile.currentProgramState || dog.status || "Active"),
      };

      record.warnings = buildDogWarnings(record);
      return record;
    });
  }, [workspace]);

  const dogsById = useMemo(
    () => new Map(programDogs.map((record) => [String(record.dog.id), record] as const)),
    [programDogs]
  );

  const registryOptions = useMemo(
    () =>
      ["all", ...new Set(programDogs.map((record) => text(record.dog.registry)).filter(Boolean))].map(
        (value) => ({
          value,
          label: value === "all" ? "All registries" : value,
        })
      ),
    [programDogs]
  );

  const coatOptions = useMemo(
    () =>
      ["all", ...new Set(programDogs.map((record) => text(record.dog.coat || record.dog.coat_type)).filter(Boolean))].map(
        (value) => ({
          value,
          label: value === "all" ? "All coats" : value,
        })
      ),
    [programDogs]
  );

  const bloodlineOptions = useMemo(
    () =>
      ["all", ...new Set(programDogs.map((record) => text(record.metadata.lineage.bloodlineLabel)).filter(Boolean))].map(
        (value) => ({
          value,
          label: value === "all" ? "All bloodlines" : value,
        })
      ),
    [programDogs]
  );

  const filteredDogs = useMemo(() => {
    return programDogs.filter((record) => {
      if (roleFilter !== "all" && record.role !== roleFilter) return false;
      if (statusFilter !== "all" && normalizeStatusGroup(record.dog.status) !== statusFilter) {
        return false;
      }
      if (registryFilter !== "all" && text(record.dog.registry) !== registryFilter) return false;
      if (coatFilter !== "all" && text(record.dog.coat || record.dog.coat_type) !== coatFilter) {
        return false;
      }
      if (
        bloodlineFilter !== "all" &&
        text(record.metadata.lineage.bloodlineLabel) !== bloodlineFilter
      ) {
        return false;
      }
      if (!matchesAgeBand(record.ageMonths, ageFilter)) return false;

      const q = text(deferredSearch).toLowerCase();
      if (!q) return true;

      const haystack = [
        record.dog.displayName,
        record.dog.dog_name,
        record.dog.call_name,
        record.dog.name,
        record.dog.registry,
        record.dog.color,
        record.dog.coat,
        record.metadata.lineage.bloodlineLabel,
        record.metadata.lineage.pedigreeSummary,
        record.metadata.profile.sourceBreeder,
        ...record.litters.map((litter) => litter.displayName),
        ...record.puppies.map((puppy) => puppy.displayName),
      ]
        .map(text)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [
    ageFilter,
    bloodlineFilter,
    coatFilter,
    deferredSearch,
    programDogs,
    registryFilter,
    roleFilter,
    statusFilter,
  ]);

  const selectedRecord = createMode
    ? null
    : filteredDogs.find((record) => String(record.dog.id) === selectedId) ||
      programDogs.find((record) => String(record.dog.id) === selectedId) ||
      null;

  useEffect(() => {
    if (createMode) {
      setForm(emptyDogForm("dam"));
      return;
    }

    setForm(populateDogForm(selectedRecord));
  }, [createMode, selectedRecord]);

  useEffect(() => {
    if (createMode || !filteredDogs.length) return;
    if (filteredDogs.some((record) => String(record.dog.id) === selectedId)) return;
    setSelectedId(String(filteredDogs[0].dog.id));
  }, [createMode, filteredDogs, selectedId]);

  const pairingSummaries = useMemo(
    () => buildPairingSummaries(workspace?.litters || [], dogsById),
    [dogsById, workspace?.litters]
  );

  const timelineEvents = useMemo(
    () => buildTimelineEvents(programDogs, workspace?.litters || []),
    [programDogs, workspace?.litters]
  );

  const topDam = useMemo(
    () =>
      [...programDogs]
        .filter((record) => record.role === "dam")
        .sort((left, right) => right.dog.summary.totalRevenue - left.dog.summary.totalRevenue)[0] ||
      null,
    [programDogs]
  );

  const topSire = useMemo(
    () =>
      [...programDogs]
        .filter((record) => record.role === "sire")
        .sort((left, right) => right.dog.summary.totalRevenue - left.dog.summary.totalRevenue)[0] ||
      null,
    [programDogs]
  );

  const bloodlineLeaderboard = useMemo(() => {
    const grouped = new Map<
      string,
      { label: string; revenue: number; puppies: number; dogs: number }
    >();

    programDogs.forEach((record) => {
      const label = text(record.metadata.lineage.bloodlineLabel);
      if (!label) return;
      const current = grouped.get(label) || { label, revenue: 0, puppies: 0, dogs: 0 };
      current.revenue += toNumber(record.dog.summary.totalRevenue);
      current.puppies += record.puppies.length;
      current.dogs += 1;
      grouped.set(label, current);
    });

    return [...grouped.values()].sort((left, right) => right.revenue - left.revenue);
  }, [programDogs]);

  const activeDams = programDogs.filter(
    (record) => record.role === "dam" && !["prospect", "retired", "deceased", "sold", "pet_home", "archived"].includes(normalizeStatusGroup(record.dog.status))
  ).length;

  const activeSires = programDogs.filter(
    (record) => record.role === "sire" && !["prospect", "retired", "deceased", "sold", "pet_home", "archived"].includes(normalizeStatusGroup(record.dog.status))
  ).length;

  const prospects = programDogs.filter(
    (record) => normalizeStatusGroup(record.dog.status) === "prospect"
  ).length;

  const retiredDogs = programDogs.filter(
    (record) => normalizeStatusGroup(record.dog.status) === "retired"
  ).length;

  const pregnantDogs = programDogs.filter(
    (record) =>
      normalizeStatusGroup(record.dog.status) === "pregnant" ||
      text(record.metadata.profile.currentProgramState).toLowerCase() === "pregnant"
  ).length;

  const dueSoonDogs = programDogs.filter((record) => {
    const diff = dateDiffDays(record.metadata.reproduction.dueDate);
    return diff != null && diff >= -7 && diff <= 30;
  });

  const onGroundLitters = (workspace?.litters || []).filter((litter) => {
    const diff = dateDiffDays(litter.whelp_date);
    return diff != null && diff <= 0 && diff >= -84;
  });

  const retainedProgramPuppies = (workspace?.puppies || []).filter((puppy) =>
    isRetainedStatus(puppy.status)
  ).length;

  const totalLittersThisYear = (workspace?.litters || []).filter((litter) => {
    const value = text(litter.whelp_date);
    return value ? new Date(value).getFullYear() === new Date().getFullYear() : false;
  }).length;

  const averageLitterSize = workspace?.summary.totalLitters
    ? workspace.summary.totalPuppies / workspace.summary.totalLitters
    : 0;

  const averageRevenuePerLitter = workspace?.summary.totalLitters
    ? workspace.summary.totalRevenue / workspace.summary.totalLitters
    : 0;

  const incompleteDogs = programDogs.filter((record) => record.warnings.length > 0);
  const missingHealthItems = programDogs.filter(
    (record) =>
      !text(record.metadata.health.testingSummary) || !text(record.metadata.genetics.dnaResults)
  );
  const retirementReviews = programDogs.filter((record) => {
    const diff = dateDiffDays(record.metadata.profile.retirementTarget);
    return diff != null && diff >= 0 && diff <= 365;
  });

  const selectedPairings = useMemo(
    () =>
      selectedRecord
        ? pairingSummaries.filter(
            (pairing) =>
              pairing.dam?.dog.id === selectedRecord.dog.id ||
              pairing.sire?.dog.id === selectedRecord.dog.id
          )
        : [],
    [pairingSummaries, selectedRecord]
  );

  const selectedDogTimeline = useMemo(
    () =>
      selectedRecord
        ? timelineEvents.filter((event) => event.dogId === String(selectedRecord.dog.id))
        : [],
    [selectedRecord, timelineEvents]
  );

  const selectedBestLitter = useMemo(
    () =>
      selectedRecord
        ? [...selectedRecord.litters].sort(
            (left, right) => toNumber(right.summary.totalRevenue) - toNumber(left.summary.totalRevenue)
          )[0] || null
        : null,
    [selectedRecord]
  );

  async function handleRefresh() {
    if (!accessToken) return;
    setNotice({ tone: "neutral", message: "Refreshing breeding program data..." });
    try {
      await loadWorkspace(createMode ? undefined : selectedId, createMode);
      setNotice({ tone: "success", message: "Breeding program refreshed." });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Could not refresh the breeding program.",
      });
    }
  }

  function updateFormValue(key: keyof Omit<DogForm, "metadata">, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateMetadata<
    TSection extends keyof BreedingProgramMetadata,
    TKey extends keyof BreedingProgramMetadata[TSection],
  >(section: TSection, key: TKey, value: string) {
    setForm((current) => ({
      ...current,
      metadata: {
        ...current.metadata,
        [section]: {
          ...current.metadata[section],
          [key]: value,
        },
      },
    }));
  }

  async function saveDog() {
    if (!accessToken) return;

    setSaving(true);
    setNotice(null);

    try {
      const payload = {
        id: createMode ? undefined : selectedRecord?.dog.id,
        role: form.role,
        dog_name: form.dog_name,
        name: form.name,
        call_name: form.call_name,
        status: form.status,
        date_of_birth: form.date_of_birth,
        color: form.color,
        coat: form.coat,
        registry: form.registry,
        genetics_summary: form.genetics_summary,
        genetics_report_url: form.genetics_report_url,
        notes: serializeBreedingProgramNotes(form.metadata),
        genetics_raw: serializeBreedingProgramGenetics(form.metadata),
      };

      const response = await fetch("/api/admin/portal/breeding-dogs", {
        method: createMode ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { ok?: boolean; error?: string; dogId?: string };
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Could not save the breeding profile.");
      }

      await loadWorkspace(result.dogId ? String(result.dogId) : selectedId, false);
      setSelectedId(result.dogId ? String(result.dogId) : selectedId);
      setCreateMode(false);
      setNotice({
        tone: "success",
        message: createMode
          ? "Breeding profile created."
          : "Breeding profile updated successfully.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Could not save the breeding profile.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading || loadingData) {
    return (
      <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">
        Loading breeding operations command center...
      </div>
    );
  }

  if (!user) {
    return (
      <AdminRestrictedState
        title="Sign in to access breeding operations."
        details="This workspace is reserved for Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!isAdmin) {
    return (
      <AdminRestrictedState
        title="This breeding workspace is limited to approved owner accounts."
        details="Only approved owner emails can access program records, pairings, lineage, and financial performance."
      />
    );
  }

  return (
    <AdminPageShell>
      <div className="space-y-5 pb-10">
        <AdminPageHero
          eyebrow="Breeding Operations"
          title="Breeding Program"
          description="A full breeding operations command center for Southwest Virginia Chihuahua."
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  setCreateMode(true);
                  setProgramTab("dogs");
                  setDogTab("profile");
                  setForm(emptyDogForm("dam"));
                  setNotice(null);
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(159,99,49,0.22)] transition hover:brightness-105"
              >
                <Plus className="h-4 w-4" />
                Add Breeding Dog
              </button>
              <button
                type="button"
                onClick={() => void handleRefresh()}
                className="inline-flex items-center gap-2 rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </>
          }
          aside={
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              <div>
                <div className="max-w-4xl text-sm leading-7 text-[var(--portal-text-soft)]">
                  This workspace now ties together dams, sires, pairings, heat cycles, pregnancies, litters, produced puppies, health, genetics, and financial value so you can manage the program from one breeder-grade command center instead of a single dog form.
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <AdminHeroPrimaryAction href="/admin/portal/litters">
                    Open Litters
                  </AdminHeroPrimaryAction>
                  <AdminHeroSecondaryAction href="/admin/portal/puppies">
                    Open Puppies
                  </AdminHeroSecondaryAction>
                  <AdminHeroSecondaryAction href="/admin/portal/documents">
                    Open Documents
                  </AdminHeroSecondaryAction>
                </div>
              </div>

              <Surface className="p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <StatChip
                    label="Top Dam"
                    value={topDam?.dog.displayName || "No dam yet"}
                    detail={topDam ? fmtMoney(topDam.dog.summary.totalRevenue) : "Awaiting litter output"}
                  />
                  <StatChip
                    label="Top Sire"
                    value={topSire?.dog.displayName || "No sire yet"}
                    detail={topSire ? fmtMoney(topSire.dog.summary.totalRevenue) : "Awaiting litter output"}
                  />
                  <StatChip
                    label="Strongest Bloodline"
                    value={bloodlineLeaderboard[0]?.label || "Not tagged yet"}
                    detail={
                      bloodlineLeaderboard[0]
                        ? `${fmtMoney(bloodlineLeaderboard[0].revenue)} across ${bloodlineLeaderboard[0].dogs} dogs`
                        : "Add bloodline tags to compare program strength"
                    }
                  />
                  <StatChip
                    label="Due Soon"
                    value={String(dueSoonDogs.length)}
                    detail="Pregnancy due dates within the next 30 days"
                  />
                </div>
              </Surface>
            </div>
          }
        />

        {notice ? (
          <div className={`rounded-[1.2rem] border px-4 py-3 text-sm font-semibold ${statusToneClass(notice.tone)}`}>
            {notice.message}
          </div>
        ) : null}

        <AdminMetricGrid>
          <AdminMetricCard
            label="Active Dams"
            value={String(activeDams)}
            detail={`${pregnantDogs} pregnant and ${onGroundLitters.length} litters on the ground`}
          />
          <AdminMetricCard
            label="Active Sires"
            value={String(activeSires)}
            detail={`${prospects} prospects and ${retiredDogs} retired dogs tracked`}
          />
          <AdminMetricCard
            label="Program Revenue"
            value={fmtMoney(workspace?.summary.totalRevenue || 0)}
            detail={`${fmtMoney(workspace?.summary.totalProfit || 0)} estimated total profit`}
          />
          <AdminMetricCard
            label="Available / Retained"
            value={`${workspace?.summary.availableCount || 0} / ${retainedProgramPuppies}`}
            detail="Available puppies and retained-program puppies"
          />
          <AdminMetricCard
            label="Litters This Year"
            value={String(totalLittersThisYear)}
            detail={`${averageLitterSize ? averageLitterSize.toFixed(1) : "0.0"} average litter size`}
          />
          <AdminMetricCard
            label="Average Revenue / Litter"
            value={fmtMoney(averageRevenuePerLitter)}
            detail={`${fmtMoney(workspace?.summary.averageSalePrice || 0)} average puppy sale price`}
          />
          <AdminMetricCard
            label="Missing Records"
            value={String(incompleteDogs.length)}
            detail={`${missingHealthItems.length} dogs missing health or genetics detail`}
          />
          <AdminMetricCard
            label="Retirement Reviews"
            value={String(retirementReviews.length)}
            detail="Dogs with retirement targets within 12 months"
          />
        </AdminMetricGrid>

        <Surface className="p-5 md:p-6">
          <div className="grid gap-5 xl:grid-cols-[310px_minmax(0,1fr)_340px]">
            <aside className="space-y-5">
              <Surface className="p-4">
                <SurfaceHeader
                  eyebrow="Dog Browser"
                  title="Program roster"
                  subtitle="Search and filter dams and sires, then jump straight into the selected dog workspace."
                />

                <div className="mt-5 space-y-4">
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--portal-text-muted)]" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search dogs, litters, bloodlines..."
                      className="w-full rounded-2xl border border-[var(--portal-border)] bg-white py-3 pl-11 pr-4 text-sm text-[var(--portal-text)] shadow-sm outline-none transition focus:border-[var(--portal-accent)] focus:ring-4 focus:ring-[rgba(90,142,245,0.14)]"
                    />
                  </label>

                  <div className="grid gap-3">
                    <AdminSelectInput
                      label="Role"
                      value={roleFilter}
                      onChange={setRoleFilter}
                      options={[
                        { value: "all", label: "All dogs" },
                        { value: "dam", label: "Dams" },
                        { value: "sire", label: "Sires" },
                      ]}
                    />
                    <AdminSelectInput
                      label="Status"
                      value={statusFilter}
                      onChange={setStatusFilter}
                      options={[
                        { value: "all", label: "All statuses" },
                        { value: "active", label: "Active" },
                        { value: "prospect", label: "Prospect" },
                        { value: "pregnant", label: "Pregnant" },
                        { value: "nursing", label: "Nursing" },
                        { value: "recovering", label: "Recovering" },
                        { value: "paused", label: "Paused / Hold" },
                        { value: "retired", label: "Retired" },
                        { value: "deceased", label: "Deceased" },
                        { value: "sold", label: "Sold" },
                        { value: "pet_home", label: "Pet home" },
                        { value: "archived", label: "Archived" },
                      ]}
                    />
                    <AdminSelectInput
                      label="Registry"
                      value={registryFilter}
                      onChange={setRegistryFilter}
                      options={registryOptions}
                    />
                    <AdminSelectInput
                      label="Coat"
                      value={coatFilter}
                      onChange={setCoatFilter}
                      options={coatOptions}
                    />
                    <AdminSelectInput
                      label="Bloodline"
                      value={bloodlineFilter}
                      onChange={setBloodlineFilter}
                      options={bloodlineOptions}
                    />
                    <AdminSelectInput
                      label="Age"
                      value={ageFilter}
                      onChange={setAgeFilter}
                      options={AGE_FILTER_OPTIONS}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <TabButton
                      active={roleFilter === "all" && statusFilter === "all" && registryFilter === "all" && coatFilter === "all" && bloodlineFilter === "all" && ageFilter === "all" && !search}
                      onClick={() => {
                        setSearch("");
                        setRoleFilter("all");
                        setStatusFilter("all");
                        setRegistryFilter("all");
                        setCoatFilter("all");
                        setBloodlineFilter("all");
                        setAgeFilter("all");
                      }}
                    >
                      Clear filters
                    </TabButton>
                  </div>
                </div>
              </Surface>

              <Surface className="max-h-[calc(100vh-21rem)] overflow-hidden">
                <div className="flex items-center justify-between border-b border-[var(--portal-border)] px-4 py-4">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                      Results
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[var(--portal-text)]">
                      {filteredDogs.length} breeding dogs
                    </div>
                  </div>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--portal-surface-muted)] text-[var(--portal-text-muted)]">
                    <Filter className="h-4 w-4" />
                  </span>
                </div>

                <div className="max-h-[calc(100vh-27rem)] space-y-3 overflow-y-auto px-4 py-4">
                  {filteredDogs.length ? (
                    filteredDogs.map((record) => (
                      <BrowserDogCard
                        key={record.dog.id}
                        record={record}
                        selected={!createMode && String(record.dog.id) === selectedId}
                        onClick={() => {
                          setCreateMode(false);
                          setProgramTab("dogs");
                          setSelectedId(String(record.dog.id));
                          setNotice(null);
                        }}
                      />
                    ))
                  ) : (
                    <AdminEmptyState
                      title="No breeding dogs match the current filters"
                      description="Adjust the roster filters or add a new dog to expand the program records."
                    />
                  )}
                </div>
              </Surface>
            </aside>

            <div className="space-y-5">
              <Surface className="p-5">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                      Command Center
                    </div>
                    <div className="mt-2 text-[1.65rem] font-semibold tracking-[-0.04em] text-[var(--portal-text)]">
                      {createMode
                        ? "Create a new breeding profile"
                        : selectedRecord
                          ? `${selectedRecord.dog.displayName} workspace`
                          : "Select a breeding dog"}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                      {createMode
                        ? "Start with the dog profile, then layer in lineage, genetics, reproductive tracking, and internal program notes."
                        : selectedRecord
                          ? joinMeta([
                              roleLabel(selectedRecord.role),
                              selectedRecord.dog.status || selectedRecord.stateLabel,
                              `${selectedRecord.litters.length} litters`,
                              `${selectedRecord.puppies.length} puppies produced`,
                            ])
                          : "Choose a dog from the roster to open the full breeding workspace."}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {PROGRAM_TABS.map((tab) => (
                      <TabButton
                        key={tab.value}
                        active={programTab === tab.value}
                        onClick={() => setProgramTab(tab.value)}
                      >
                        {tab.label}
                      </TabButton>
                    ))}
                  </div>
                </div>
              </Surface>

              {programTab === "overview" ? (
                <ProgramOverview
                  workspace={workspace}
                  programDogs={programDogs}
                  topDam={topDam}
                  topSire={topSire}
                  bloodlineLeaderboard={bloodlineLeaderboard}
                  pairingSummaries={pairingSummaries}
                  dueSoonDogs={dueSoonDogs}
                  onGroundLitters={onGroundLitters}
                  timelineEvents={timelineEvents}
                />
              ) : null}

              {programTab === "dogs" ? (
                <DogWorkspace
                  createMode={createMode}
                  selectedRecord={selectedRecord}
                  form={form}
                  dogTab={dogTab}
                  setDogTab={setDogTab}
                  updateFormValue={updateFormValue}
                  updateMetadata={updateMetadata}
                  saveDog={saveDog}
                  saving={saving}
                  resetForm={() => setForm(createMode ? emptyDogForm(form.role) : populateDogForm(selectedRecord))}
                  selectedPairings={selectedPairings}
                  selectedTimeline={selectedDogTimeline}
                  selectedBestLitter={selectedBestLitter}
                  onCancelCreate={() => {
                    setCreateMode(false);
                    setForm(populateDogForm(selectedRecord));
                    setNotice(null);
                  }}
                />
              ) : null}

              {programTab === "pairings" ? (
                <PairingWorkspace pairings={pairingSummaries} selectedRecord={selectedRecord} />
              ) : null}

              {programTab === "timeline" ? (
                <TimelineWorkspace
                  timelineEvents={timelineEvents}
                  selectedTimeline={selectedDogTimeline}
                  selectedRecord={selectedRecord}
                />
              ) : null}

              {programTab === "insights" ? (
                <InsightsWorkspace
                  programDogs={programDogs}
                  pairings={pairingSummaries}
                  bloodlineLeaderboard={bloodlineLeaderboard}
                  incompleteDogs={incompleteDogs}
                />
              ) : null}
            </div>

            <SelectedDogRail
              selectedRecord={selectedRecord}
              createMode={createMode}
              onOpenDogTab={(value) => {
                setProgramTab("dogs");
                setDogTab(value);
              }}
            />
          </div>
        </Surface>
      </div>
    </AdminPageShell>
  );
}

function ProgramOverview({
  workspace,
  programDogs,
  topDam,
  topSire,
  bloodlineLeaderboard,
  pairingSummaries,
  dueSoonDogs,
  onGroundLitters,
  timelineEvents,
}: {
  workspace: AdminLineageWorkspace | null;
  programDogs: ProgramDogRecord[];
  topDam: ProgramDogRecord | null;
  topSire: ProgramDogRecord | null;
  bloodlineLeaderboard: Array<{ label: string; revenue: number; puppies: number; dogs: number }>;
  pairingSummaries: PairingSummary[];
  dueSoonDogs: ProgramDogRecord[];
  onGroundLitters: AdminLineageLitter[];
  timelineEvents: TimelineEvent[];
}) {
  const recentEvents = timelineEvents
    .filter((event) => dateDiffDays(event.date) != null && (dateDiffDays(event.date) || 0) >= -45)
    .sort(
      (left, right) =>
        Math.abs(dateDiffDays(left.date) || 999) - Math.abs(dateDiffDays(right.date) || 999)
    )
    .slice(0, 6);

  const strongestPairing = pairingSummaries[0] || null;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.14fr)_360px]">
        <Surface className="p-5 md:p-6">
          <SurfaceHeader
            eyebrow="Program Dashboard"
            title="At-a-glance breeding intelligence"
            subtitle="This is the top command area for the whole program: active dogs, litters, upcoming work, and which bloodlines and pairings are producing the strongest outcomes."
          />

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ReadTile
              label="Program Dogs"
              value={String(programDogs.length)}
              detail={`${workspace?.summary.totalDams || 0} dams and ${workspace?.summary.totalSires || 0} sires`}
            />
            <ReadTile
              label="Litters on Ground"
              value={String(onGroundLitters.length)}
              detail={`${workspace?.summary.totalLitters || 0} total litters tracked`}
            />
            <ReadTile
              label="Puppies Produced"
              value={String(workspace?.summary.totalPuppies || 0)}
              detail={`${workspace?.summary.completedCount || 0} completed placements`}
            />
            <ReadTile
              label="Program Profit"
              value={fmtMoney(workspace?.summary.totalProfit || 0)}
              detail={`${fmtMoney(workspace?.summary.totalRevenue || 0)} gross revenue`}
            />
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div className="rounded-[1.3rem] border border-[var(--portal-border)] bg-white p-4">
              <div className="flex items-center gap-2 text-[var(--portal-text)]">
                <TrendingUp className="h-4 w-4 text-[#a56a37]" />
                <div className="text-sm font-semibold">Top performance snapshot</div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <ReadTile
                  label="Best Dam"
                  value={topDam?.dog.displayName || "No dam yet"}
                  detail={topDam ? fmtMoney(topDam.dog.summary.totalRevenue) : "Awaiting litter output"}
                />
                <ReadTile
                  label="Best Sire"
                  value={topSire?.dog.displayName || "No sire yet"}
                  detail={topSire ? fmtMoney(topSire.dog.summary.totalRevenue) : "Awaiting litter output"}
                />
                <ReadTile
                  label="Best Pairing"
                  value={
                    strongestPairing
                      ? `${strongestPairing.dam?.dog.displayName || "Unknown"} x ${strongestPairing.sire?.dog.displayName || "Unknown"}`
                      : "No pairing history yet"
                  }
                  detail={strongestPairing ? fmtMoney(strongestPairing.totalRevenue) : "Awaiting completed litters"}
                  wrap
                />
                <ReadTile
                  label="Strongest Bloodline"
                  value={bloodlineLeaderboard[0]?.label || "Not tagged yet"}
                  detail={
                    bloodlineLeaderboard[0]
                      ? `${fmtMoney(bloodlineLeaderboard[0].revenue)} across ${bloodlineLeaderboard[0].puppies} puppies`
                      : "Add bloodline labels on the dog profiles"
                  }
                  wrap
                />
              </div>
            </div>

            <div className="rounded-[1.3rem] border border-[var(--portal-border)] bg-white p-4">
              <div className="flex items-center gap-2 text-[var(--portal-text)]">
                <Clock3 className="h-4 w-4 text-[#a56a37]" />
                <div className="text-sm font-semibold">Upcoming program workload</div>
              </div>
              <div className="mt-4 space-y-3">
                {dueSoonDogs.length ? (
                  dueSoonDogs.slice(0, 4).map((record) => (
                    <div
                      key={`due-${record.dog.id}`}
                      className="rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3"
                    >
                      <div className="text-sm font-semibold text-[var(--portal-text)]">
                        {record.dog.displayName}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                        {record.metadata.reproduction.dueDate
                          ? `Due ${fmtDate(record.metadata.reproduction.dueDate)}`
                          : "Due date not logged"}
                      </div>
                    </div>
                  ))
                ) : (
                  <AdminEmptyState
                    title="No due dates within 30 days"
                    description="Pregnancy and due date tracking will show up here once those milestones are logged."
                  />
                )}
              </div>
            </div>
          </div>
        </Surface>

        <Surface className="p-5">
          <SurfaceHeader
            eyebrow="Recent Activity"
            title="Program movement"
            subtitle="The most recent breeding milestones, litter events, and timing signals."
          />

          <div className="mt-5 space-y-3">
            {recentEvents.length ? (
              recentEvents.map((event) => (
                <div
                  key={event.key}
                  className="rounded-[1.1rem] border border-[var(--portal-border)] bg-white px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                        {event.category}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-[var(--portal-text)]">
                        {event.title}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                        {event.detail}
                      </div>
                    </div>
                    <ListPill>{fmtDate(event.date)}</ListPill>
                  </div>
                </div>
              ))
            ) : (
              <AdminEmptyState
                title="No recent timeline activity"
                description="Heat windows, due dates, and litter milestones will populate this activity lane."
              />
            )}
          </div>
        </Surface>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.12fr)_360px]">
        <Surface className="p-5 md:p-6">
          <SurfaceHeader
            eyebrow="Pairing Board"
            title="Current pairing intelligence"
            subtitle="The strongest pairings bubble up here so you can see which dam-and-sire combinations are producing the best size, value, and follow-through."
          />

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pairingSummaries.slice(0, 6).map((pairing) => (
              <div
                key={pairing.key}
                className="rounded-[1.2rem] border border-[var(--portal-border)] bg-white p-4"
              >
                <div className="text-sm font-semibold text-[var(--portal-text)]">
                  {pairing.dam?.dog.displayName || "Unknown dam"} x{" "}
                  {pairing.sire?.dog.displayName || "Unknown sire"}
                </div>
                <div className="mt-2 text-xs leading-5 text-[var(--portal-text-soft)]">
                  {pairing.litters.length} litters | {pairing.totalPuppies} puppies |{" "}
                  {pairing.survivingPuppies} surviving
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <ReadTile label="Revenue" value={fmtMoney(pairing.totalRevenue)} />
                  <ReadTile
                    label="Avg litter"
                    value={pairing.averageLitterSize ? pairing.averageLitterSize.toFixed(1) : "0.0"}
                  />
                </div>
                <div className="mt-3 text-xs leading-5 text-[var(--portal-text-soft)]">
                  Strongest color outcome: {pairing.colorSummary}
                </div>
              </div>
            ))}
          </div>
        </Surface>

        <Surface className="p-5">
          <SurfaceHeader
            eyebrow="Coverage"
            title="Program gaps"
            subtitle="The records that still need breeder attention."
          />

          <div className="mt-5 space-y-3">
            {programDogs.filter((record) => record.warnings.length).slice(0, 6).map((record) => (
              <div
                key={`gap-${record.dog.id}`}
                className="rounded-[1.1rem] border border-[var(--portal-border)] bg-white px-4 py-4"
              >
                <div className="flex items-start gap-3">
                  <CircleAlert className="mt-0.5 h-4 w-4 text-[#b67744]" />
                  <div>
                    <div className="text-sm font-semibold text-[var(--portal-text)]">
                      {record.dog.displayName}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {record.warnings.map((warning) => (
                        <ListPill key={`${record.dog.id}-${warning}`} tone="warning">
                          {warning}
                        </ListPill>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
}

function DogWorkspace({
  createMode,
  selectedRecord,
  form,
  dogTab,
  setDogTab,
  updateFormValue,
  updateMetadata,
  saveDog,
  saving,
  resetForm,
  selectedPairings,
  selectedTimeline,
  selectedBestLitter,
  onCancelCreate,
}: {
  createMode: boolean;
  selectedRecord: ProgramDogRecord | null;
  form: DogForm;
  dogTab: DogTab;
  setDogTab: (value: DogTab) => void;
  updateFormValue: (key: keyof Omit<DogForm, "metadata">, value: string) => void;
  updateMetadata: <
    TSection extends keyof BreedingProgramMetadata,
    TKey extends keyof BreedingProgramMetadata[TSection],
  >(
    section: TSection,
    key: TKey,
    value: string
  ) => void;
  saveDog: () => Promise<void>;
  saving: boolean;
  resetForm: () => void;
  selectedPairings: PairingSummary[];
  selectedTimeline: TimelineEvent[];
  selectedBestLitter: AdminLineageLitter | null;
  onCancelCreate: () => void;
}) {
  return (
    <div className="space-y-5">
      <Surface className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
              Dog Workspace
            </div>
            <div className="mt-2 text-[1.55rem] font-semibold tracking-[-0.04em] text-[var(--portal-text)]">
              {createMode
                ? "Build a new breeding dog profile"
                : selectedRecord?.dog.displayName || "Select a dog"}
            </div>
            <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
              {createMode
                ? "Use this profile to capture both the polished summary and the breeder-only detail that drives pairings, timing, genetics, and program value."
                : selectedRecord
                  ? "Everything here rolls up into the breeding program dashboard: lineage, reproductive status, litter history, puppies produced, and financial contribution."
                  : "Choose a dog from the roster to edit its full breeding record."}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {DOG_TABS.map((tab) => (
              <TabButton
                key={tab.value}
                active={dogTab === tab.value}
                onClick={() => setDogTab(tab.value)}
              >
                {tab.label}
              </TabButton>
            ))}
          </div>
        </div>
      </Surface>

      {dogTab === "profile" ? (
        <Surface className="p-5 md:p-6">
          <SurfaceHeader
            eyebrow="Basic Profile"
            title="Identity, role, and program status"
            subtitle="The core profile fields that define how this dog appears across breeding operations, lineage reporting, and future litters."
            action={
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void saveDog()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(159,99,49,0.22)] transition hover:brightness-105 disabled:opacity-60"
                >
                  {saving ? "Saving..." : createMode ? "Create Dog" : "Save Dog"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-2 rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]"
                >
                  Reset
                </button>
                {createMode ? (
                  <button
                    type="button"
                    onClick={onCancelCreate}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            }
          />

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div className="rounded-[1.3rem] border border-[var(--portal-border)] bg-white p-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                Identity
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <AdminSelectInput label="Role" value={form.role} onChange={(value) => updateFormValue("role", value)} options={ROLE_OPTIONS} />
                <AdminSelectInput label="Status" value={form.status} onChange={(value) => updateFormValue("status", value)} options={STATUS_OPTIONS} />
                <AdminTextInput label="Call Name" value={form.call_name} onChange={(value) => updateFormValue("call_name", value)} placeholder="Call name" />
                <AdminTextInput label="Display Name" value={form.dog_name} onChange={(value) => updateFormValue("dog_name", value)} placeholder="Visible kennel name" />
                <AdminTextInput label="Registered Name" value={form.name} onChange={(value) => updateFormValue("name", value)} placeholder="Formal name" />
                <AdminTextInput label="Internal ID" value={form.metadata.profile.internalId} onChange={(value) => updateMetadata("profile", "internalId", value)} placeholder="Internal program id" />
                <AdminDateInput label="Date of Birth" value={form.date_of_birth} onChange={(value) => updateFormValue("date_of_birth", value)} />
                <AdminTextInput label="Weight" value={form.metadata.profile.weight} onChange={(value) => updateMetadata("profile", "weight", value)} placeholder="Current weight" />
                <AdminTextInput label="Color" value={form.color} onChange={(value) => updateFormValue("color", value)} placeholder="Color" />
                <AdminTextInput label="Coat Type" value={form.coat} onChange={(value) => updateFormValue("coat", value)} placeholder="Coat type" />
                <AdminTextInput label="Registry" value={form.registry} onChange={(value) => updateFormValue("registry", value)} placeholder="Registry" />
                <AdminTextInput label="Registration Number" value={form.metadata.profile.registrationNumber} onChange={(value) => updateMetadata("profile", "registrationNumber", value)} placeholder="Registration number" />
                <AdminTextInput label="Microchip" value={form.metadata.profile.microchip} onChange={(value) => updateMetadata("profile", "microchip", value)} placeholder="Microchip or identifier" />
                <AdminTextInput label="Source Breeder" value={form.metadata.profile.sourceBreeder} onChange={(value) => updateMetadata("profile", "sourceBreeder", value)} placeholder="Breeder or origin" />
              </div>
            </div>

            <div className="rounded-[1.3rem] border border-[var(--portal-border)] bg-white p-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                Breeding role + program status
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <AdminSelectInput label="Program State" value={form.metadata.profile.currentProgramState} onChange={(value) => updateMetadata("profile", "currentProgramState", value)} options={[{ value: "", label: "Not set" }, ...PROGRAM_STATE_OPTIONS]} />
                <AdminSelectInput label="Breeding Eligibility" value={form.metadata.profile.breedingEligibility} onChange={(value) => updateMetadata("profile", "breedingEligibility", value)} options={[{ value: "", label: "Not set" }, ...ELIGIBILITY_OPTIONS]} />
                <AdminSelectInput label="Proven Status" value={form.metadata.profile.provenStatus} onChange={(value) => updateMetadata("profile", "provenStatus", value)} options={[{ value: "", label: "Not set" }, ...PROVEN_OPTIONS]} />
                <AdminSelectInput label="Value Tier" value={form.metadata.profile.valueTier} onChange={(value) => updateMetadata("profile", "valueTier", value)} options={[{ value: "", label: "Not set" }, ...VALUE_TIER_OPTIONS]} />
                <AdminTextInput label="Age at First Breeding" value={form.metadata.profile.ageAtFirstBreeding} onChange={(value) => updateMetadata("profile", "ageAtFirstBreeding", value)} placeholder="Example: 2y 3m" />
                <AdminDateInput label="Retirement Target" value={form.metadata.profile.retirementTarget} onChange={(value) => updateMetadata("profile", "retirementTarget", value)} />
                <AdminDateInput label="Retirement Date" value={form.metadata.profile.retirementDate} onChange={(value) => updateMetadata("profile", "retirementDate", value)} />
                <AdminTextInput label="Photo URLs" value={form.metadata.profile.photoUrls} onChange={(value) => updateMetadata("profile", "photoUrls", value)} placeholder="One url or newline-separated list" />
              </div>

              <div className="mt-4">
                <AdminTextAreaInput
                  label="Notes"
                  value={form.metadata.profile.freeformNotes}
                  onChange={(value) => updateMetadata("profile", "freeformNotes", value)}
                  rows={6}
                  placeholder="Temperament, structure, program notes, handling notes, or breeder observations."
                />
              </div>
            </div>
          </div>
        </Surface>
      ) : null}

      {dogTab === "lineage" ? (
        <Surface className="p-5 md:p-6">
          <SurfaceHeader
            eyebrow="Lineage / Pedigree"
            title="Bloodline, pedigree, and relationship context"
            subtitle="Use this area to keep pedigree notes, program relationships, bloodline tags, and breeder context close to the dog record."
          />

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminTextInput label="Sire Name" value={form.metadata.lineage.sireName} onChange={(value) => updateMetadata("lineage", "sireName", value)} placeholder="Dog's sire" />
                <AdminTextInput label="Dam Name" value={form.metadata.lineage.damName} onChange={(value) => updateMetadata("lineage", "damName", value)} placeholder="Dog's dam" />
                <AdminTextInput label="Bloodline Label" value={form.metadata.lineage.bloodlineLabel} onChange={(value) => updateMetadata("lineage", "bloodlineLabel", value)} placeholder="Bloodline tag" />
                <AdminTextInput label="Related Dogs in Program" value={form.metadata.lineage.relatedDogNames} onChange={(value) => updateMetadata("lineage", "relatedDogNames", value)} placeholder="One line or comma-separated" />
              </div>
              <AdminTextAreaInput label="Pedigree Summary" value={form.metadata.lineage.pedigreeSummary} onChange={(value) => updateMetadata("lineage", "pedigreeSummary", value)} rows={5} placeholder="Compact pedigree chart notes, strengths, and overlaps." />
              <AdminTextAreaInput label="Bloodline Notes" value={form.metadata.lineage.bloodlineNotes} onChange={(value) => updateMetadata("lineage", "bloodlineNotes", value)} rows={5} placeholder="Traits, consistency, source, structure, or size notes." />
              <AdminTextAreaInput label="Mating Compatibility Notes" value={form.metadata.lineage.pairingCompatibilityNotes} onChange={(value) => updateMetadata("lineage", "pairingCompatibilityNotes", value)} rows={4} placeholder="Lineage overlap warnings or best-match observations." />
            </div>

            <div className="space-y-4">
              <div className="rounded-[1.3rem] border border-[var(--portal-border)] bg-white p-5">
                <div className="flex items-center gap-2 text-[var(--portal-text)]">
                  <GitBranch className="h-4 w-4 text-[#a56a37]" />
                  <div className="text-sm font-semibold">Compact lineage preview</div>
                </div>
                <div className="mt-4 space-y-3">
                  <ReadTile label="Sire" value={form.metadata.lineage.sireName || "Not logged"} />
                  <ReadTile label="Dam" value={form.metadata.lineage.damName || "Not logged"} />
                  <ReadTile
                    label="Bloodline"
                    value={form.metadata.lineage.bloodlineLabel || "Not tagged"}
                    detail={form.metadata.lineage.bloodlineNotes || "Add a bloodline summary to strengthen the program reports."}
                    wrap
                  />
                </div>
              </div>

              <div className="rounded-[1.3rem] border border-[var(--portal-border)] bg-white p-5">
                <div className="text-sm font-semibold text-[var(--portal-text)]">
                  Related program links
                </div>
                <div className="mt-4 space-y-3">
                  {newlineList(form.metadata.lineage.relatedDogNames).length ? (
                    newlineList(form.metadata.lineage.relatedDogNames).map((item) => (
                      <div key={item} className="rounded-[1rem] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--portal-text)]">
                        {item}
                      </div>
                    ))
                  ) : (
                    <AdminEmptyState
                      title="No related dogs linked yet"
                      description="Add parents, littermates, offspring notes, or overlapping program dogs here."
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </Surface>
      ) : null}

      {dogTab === "health" ? (
        <Surface className="p-5 md:p-6">
          <SurfaceHeader
            eyebrow="Health + Wellness"
            title="Health records, screening notes, and restrictions"
            subtitle="Track general wellness, vet care, reproductive health, and any conditions that affect breeding recommendations or program eligibility."
          />

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <AdminTextAreaInput label="General Health Notes" value={form.metadata.health.generalNotes} onChange={(value) => updateMetadata("health", "generalNotes", value)} rows={5} placeholder="General condition, wellness notes, and watch items." />
            <AdminTextAreaInput label="Vaccination Log" value={form.metadata.health.vaccinationLog} onChange={(value) => updateMetadata("health", "vaccinationLog", value)} rows={5} placeholder="Vaccinations or preventive care timeline." />
            <AdminTextAreaInput label="Vet Care History" value={form.metadata.health.vetHistory} onChange={(value) => updateMetadata("health", "vetHistory", value)} rows={5} placeholder="Visits, findings, or care history." />
            <AdminTextAreaInput label="Weight History" value={form.metadata.health.weightHistory} onChange={(value) => updateMetadata("health", "weightHistory", value)} rows={5} placeholder="Weight tracking history or body condition notes." />
            <AdminTextAreaInput label="Reproductive Health Notes" value={form.metadata.health.reproductiveHealthNotes} onChange={(value) => updateMetadata("health", "reproductiveHealthNotes", value)} rows={5} placeholder="Reproductive wellness, timing, and recovery notes." />
            <AdminTextAreaInput label="Testing Summary" value={form.metadata.health.testingSummary} onChange={(value) => updateMetadata("health", "testingSummary", value)} rows={5} placeholder="General health tests on file." />
            <AdminTextAreaInput label="Screening Summary" value={form.metadata.health.screeningSummary} onChange={(value) => updateMetadata("health", "screeningSummary", value)} rows={5} placeholder="OFA or equivalent health screening notes." />
            <AdminTextAreaInput label="Conditions / Surgical History" value={form.metadata.health.conditions} onChange={(value) => updateMetadata("health", "conditions", value)} rows={5} placeholder="Conditions, surgery, disqualifying notes, or concerns." />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <AdminTextAreaInput label="Breeding Restrictions" value={form.metadata.health.restrictions} onChange={(value) => updateMetadata("health", "restrictions", value)} rows={4} placeholder="Restrictions, rest periods, or do-not-breed notes." />
            <AdminTextAreaInput label="Emergency Warnings" value={form.metadata.health.emergencyWarnings} onChange={(value) => updateMetadata("health", "emergencyWarnings", value)} rows={4} placeholder="Emergency breeding restrictions, anesthesia concerns, or urgent warnings." />
          </div>
        </Surface>
      ) : null}

      {dogTab === "genetics" ? (
        <Surface className="p-5 md:p-6">
          <SurfaceHeader
            eyebrow="Genetics"
            title="Coat, color, DNA, and pairing risk"
            subtitle="This is where the lab detail and breeder interpretation come together: visible summary on top, structured detail underneath."
          />

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <AdminTextAreaInput label="Visible Genetics Summary" value={form.genetics_summary} onChange={(value) => updateFormValue("genetics_summary", value)} rows={4} placeholder="Short breeder-facing summary." />
            <AdminTextInput label="Genetics Report Link" value={form.genetics_report_url} onChange={(value) => updateFormValue("genetics_report_url", value)} placeholder="Report url" />
            <AdminTextAreaInput label="Coat Genetics" value={form.metadata.genetics.coatGenetics} onChange={(value) => updateMetadata("genetics", "coatGenetics", value)} rows={4} placeholder="Coat genetics notes." />
            <AdminTextAreaInput label="Color Genetics" value={form.metadata.genetics.colorGenetics} onChange={(value) => updateMetadata("genetics", "colorGenetics", value)} rows={4} placeholder="Color genetics notes." />
            <AdminTextAreaInput label="DNA Results" value={form.metadata.genetics.dnaResults} onChange={(value) => updateMetadata("genetics", "dnaResults", value)} rows={4} placeholder="DNA results or marker summary." />
            <AdminTextAreaInput label="Carrier / Clear / Affected States" value={form.metadata.genetics.carrierStates} onChange={(value) => updateMetadata("genetics", "carrierStates", value)} rows={4} placeholder="Carrier state interpretation." />
            <AdminTextAreaInput label="Mating Compatibility Notes" value={form.metadata.genetics.compatibilityNotes} onChange={(value) => updateMetadata("genetics", "compatibilityNotes", value)} rows={4} placeholder="Compatible pairings and strengths." />
            <AdminTextAreaInput label="Risky Pairing Warnings" value={form.metadata.genetics.riskyPairingWarnings} onChange={(value) => updateMetadata("genetics", "riskyPairingWarnings", value)} rows={4} placeholder="Known genetic warnings or avoid-pairing notes." />
            <AdminTextAreaInput label="Document Links" value={form.metadata.genetics.documentLinks} onChange={(value) => updateMetadata("genetics", "documentLinks", value)} rows={3} placeholder="Links to DNA documents or lab PDFs." />
            <AdminTextAreaInput label="Raw Lab Notes" value={form.metadata.genetics.rawLabNotes} onChange={(value) => updateMetadata("genetics", "rawLabNotes", value)} rows={6} placeholder="Full pasted lab output or interpretation notes." />
          </div>
        </Surface>
      ) : null}

      {dogTab === "reproduction" ? (
        <Surface className="p-5 md:p-6">
          <SurfaceHeader
            eyebrow="Reproductive Tracking"
            title="Heat cycles, breeding windows, pregnancy, and recovery"
            subtitle="The timing side of the breeding business lives here, including dams, sires, confirmed pregnancies, whelping, and next-window planning."
          />

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ReadTile
              label="Litters"
              value={String(selectedRecord?.litters.length || 0)}
              detail={`${selectedRecord?.puppies.length || 0} puppies produced`}
            />
            <ReadTile
              label="Avg litter size"
              value={
                selectedRecord?.averageLitterSize
                  ? selectedRecord.averageLitterSize.toFixed(1)
                  : "0.0"
              }
              detail={`${selectedRecord?.completedPuppies || 0} completed puppies`}
            />
            <ReadTile
              label="Last litter"
              value={selectedRecord?.lastLitterDate ? fmtDate(selectedRecord.lastLitterDate) : "Not logged"}
              detail="Latest litter date tied to this dog"
            />
            <ReadTile
              label="Current state"
              value={form.metadata.profile.currentProgramState || form.status || "Active"}
              detail="Program-side state for timing and readiness"
            />
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div className="rounded-[1.3rem] border border-[var(--portal-border)] bg-white p-5">
              <div className="text-sm font-semibold text-[var(--portal-text)]">
                Dam-side tracking
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <AdminDateInput label="Last Heat" value={form.metadata.reproduction.lastHeatDate} onChange={(value) => updateMetadata("reproduction", "lastHeatDate", value)} />
                <AdminDateInput label="Expected Next Heat" value={form.metadata.reproduction.expectedNextHeat} onChange={(value) => updateMetadata("reproduction", "expectedNextHeat", value)} />
                <AdminTextInput label="Breeding Window" value={form.metadata.reproduction.breedingWindow} onChange={(value) => updateMetadata("reproduction", "breedingWindow", value)} placeholder="Timing window" />
                <AdminTextInput label="Ovulation Notes" value={form.metadata.reproduction.ovulationNotes} onChange={(value) => updateMetadata("reproduction", "ovulationNotes", value)} placeholder="Progesterone or timing notes" />
                <AdminDateInput label="Pregnancy Confirmed" value={form.metadata.reproduction.pregnancyConfirmedDate} onChange={(value) => updateMetadata("reproduction", "pregnancyConfirmedDate", value)} />
                <AdminDateInput label="Due Date" value={form.metadata.reproduction.dueDate} onChange={(value) => updateMetadata("reproduction", "dueDate", value)} />
                <AdminDateInput label="Whelp Date" value={form.metadata.reproduction.whelpDate} onChange={(value) => updateMetadata("reproduction", "whelpDate", value)} />
                <AdminTextInput label="Next Breeding Window" value={form.metadata.reproduction.nextBreedingWindow} onChange={(value) => updateMetadata("reproduction", "nextBreedingWindow", value)} placeholder="Recommended next window" />
              </div>
              <div className="mt-4 space-y-4">
                <AdminTextAreaInput label="Heat Cycle History" value={form.metadata.reproduction.heatCycleHistory} onChange={(value) => updateMetadata("reproduction", "heatCycleHistory", value)} rows={5} placeholder="Heat cycle history notes." />
                <AdminTextAreaInput label="Mating Attempts" value={form.metadata.reproduction.matingAttempts} onChange={(value) => updateMetadata("reproduction", "matingAttempts", value)} rows={4} placeholder="Mating attempts, timing, and notes." />
                <AdminTextAreaInput label="Recovery Notes" value={form.metadata.reproduction.recoveryNotes} onChange={(value) => updateMetadata("reproduction", "recoveryNotes", value)} rows={4} placeholder="Recovery intervals and rest notes." />
              </div>
            </div>

            <div className="rounded-[1.3rem] border border-[var(--portal-border)] bg-white p-5">
              <div className="text-sm font-semibold text-[var(--portal-text)]">
                Sire / fertility notes
              </div>
              <div className="mt-4 space-y-4">
                <AdminTextAreaInput label="Fertility Notes" value={form.metadata.reproduction.fertilityNotes} onChange={(value) => updateMetadata("reproduction", "fertilityNotes", value)} rows={4} placeholder="Fertility, collection, or breeding count notes." />
                <AdminTextAreaInput label="Breeding Count Notes" value={form.metadata.reproduction.breedingCountNotes} onChange={(value) => updateMetadata("reproduction", "breedingCountNotes", value)} rows={4} placeholder="Breeding count observations." />
                <AdminTextAreaInput label="Male Observation Notes" value={form.metadata.reproduction.maleObservationNotes} onChange={(value) => updateMetadata("reproduction", "maleObservationNotes", value)} rows={4} placeholder="General sire-side observations." />
                <AdminTextAreaInput label="Collection Notes" value={form.metadata.reproduction.collectionNotes} onChange={(value) => updateMetadata("reproduction", "collectionNotes", value)} rows={4} placeholder="Collection or semen notes if used." />
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[1.3rem] border border-[var(--portal-border)] bg-white p-5">
            <div className="text-sm font-semibold text-[var(--portal-text)]">
              Pairing history for this dog
            </div>
            <div className="mt-4 space-y-3">
              {selectedPairings.length ? (
                selectedPairings.slice(0, 6).map((pairing) => (
                  <div
                    key={pairing.key}
                    className="rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4"
                  >
                    <div className="text-sm font-semibold text-[var(--portal-text)]">
                      {pairing.dam?.dog.displayName || "Unknown dam"} x{" "}
                      {pairing.sire?.dog.displayName || "Unknown sire"}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                      {pairing.litters.length} litters | {pairing.totalPuppies} puppies | last whelp{" "}
                      {pairing.lastWhelpDate ? fmtDate(pairing.lastWhelpDate) : "not logged"}
                    </div>
                  </div>
                ))
              ) : (
                <AdminEmptyState
                  title="No pairing history yet"
                  description="Once a sire and dam are tied together through litters, the pairing timeline will populate here."
                />
              )}
            </div>
          </div>
        </Surface>
      ) : null}

      {dogTab === "litters" ? (
        <Surface className="p-5 md:p-6">
          <SurfaceHeader
            eyebrow="Litter History"
            title="Every litter tied to this dog"
            subtitle="This section connects whelping dates, puppy counts, survival, and revenue back to the selected sire or dam."
          />

          <div className="mt-5">
            {selectedRecord?.litters.length ? (
              <div className="overflow-x-auto rounded-[1.2rem] border border-[var(--portal-border)]">
                <table className="min-w-full divide-y divide-[#eee1d2] text-sm">
                  <thead className="bg-[var(--portal-surface-muted)] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                    <tr>
                      <th className="px-4 py-3">Litter</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Puppies</th>
                      <th className="px-4 py-3">Surviving</th>
                      <th className="px-4 py-3">Revenue</th>
                      <th className="px-4 py-3">Profit</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1e6da] bg-white">
                    {sortByDateDesc(selectedRecord.litters, (litter) => litter.whelp_date).map((litter) => (
                      <tr key={litter.id}>
                        <td className="px-4 py-3 font-semibold text-[var(--portal-text)]">
                          {litter.displayName}
                        </td>
                        <td className="px-4 py-3 text-[var(--portal-text-soft)]">
                          {litter.whelp_date ? fmtDate(litter.whelp_date) : "Not set"}
                        </td>
                        <td className="px-4 py-3 text-[var(--portal-text-soft)]">
                          {litter.puppies.length}
                        </td>
                        <td className="px-4 py-3 text-[var(--portal-text-soft)]">
                          {litter.puppies.filter((puppy) => !isLossStatus(puppy.status)).length}
                        </td>
                        <td className="px-4 py-3 text-[var(--portal-text)]">
                          {fmtMoney(litter.summary.totalRevenue)}
                        </td>
                        <td className="px-4 py-3 text-[var(--portal-text)]">
                          {fmtMoney(litter.summary.totalProfit)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${adminStatusBadge(
                              litter.status || "planned",
                            )}`}
                          >
                            {litter.status || "planned"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <AdminEmptyState
                title="No litters linked yet"
                description="This dog does not have litter records linked yet. As litters are created, they will roll up into this history automatically."
              />
            )}
          </div>
        </Surface>
      ) : null}

      {dogTab === "offspring" ? (
        <Surface className="p-5 md:p-6">
          <SurfaceHeader
            eyebrow="Produced Puppies"
            title="Every puppy produced by this dog"
            subtitle="Use this list to understand output quality, retained-program value, buyer outcomes, and which puppies moved into the next stage of the kennel."
          />

          <div className="mt-5">
            {selectedRecord?.puppies.length ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {selectedRecord.puppies.map((puppy) => (
                  <div
                    key={puppy.id}
                    className="rounded-[1.2rem] border border-[var(--portal-border)] bg-white p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[1rem] bg-[var(--portal-surface-muted)]">
                        {text(puppy.photo_url || puppy.image_url) ? (
                          <div className="relative h-full w-full">
                            <Image
                              src={resolvePhotoUrl(text(puppy.photo_url || puppy.image_url))}
                              alt={puppy.displayName}
                              fill
                              unoptimized
                              sizes="56px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <PawPrint className="h-5 w-5 text-[#9b6b3c]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-[var(--portal-text)]">
                          {puppy.displayName}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                          {joinMeta([
                            puppy.sex,
                            puppy.color,
                            puppy.coat_type || puppy.coat,
                            puppy.status,
                          ])}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <ReadTile label="Buyer" value={text(puppy.buyer?.full_name || puppy.buyer?.name || puppy.owner_email) || "No buyer"} />
                      <ReadTile label="Sale Price" value={fmtMoney(puppy.salePrice || puppy.price || 0)} />
                      <ReadTile label="Litter" value={puppy.litter?.displayName || puppy.litter_name || "No litter"} />
                      <ReadTile label="Program Value" value={isRetainedStatus(puppy.status) ? "Retained" : "Placed"} />
                    </div>

                    {(text(puppy.description) || text(puppy.notes)) ? (
                      <div className="mt-3 text-xs leading-6 text-[var(--portal-text-soft)]">
                        {text(puppy.description || puppy.notes)}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <AdminEmptyState
                title="No produced puppies linked yet"
                description="Once puppies are tied to litters for this dog, the full offspring record will appear here."
              />
            )}
          </div>
        </Surface>
      ) : null}

      {dogTab === "financials" ? (
        <Surface className="p-5 md:p-6">
          <SurfaceHeader
            eyebrow="Financial Performance"
            title="Revenue, profit, and breeding value"
            subtitle="This view rolls litter output back to the selected dog so you can see which dogs are strongest financially, not just reproductively."
          />

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ReadTile
              label="Total Revenue"
              value={fmtMoney(selectedRecord?.dog.summary.totalRevenue || 0)}
              detail={`${selectedRecord?.puppies.length || 0} puppies across ${selectedRecord?.litters.length || 0} litters`}
            />
            <ReadTile
              label="Total Profit"
              value={fmtMoney(selectedRecord?.dog.summary.totalProfit || 0)}
              detail={`${fmtMoney(selectedRecord?.dog.summary.totalCosts || 0)} tracked costs`}
            />
            <ReadTile
              label="Average Sale"
              value={fmtMoney(selectedRecord?.dog.summary.averageSalePrice || 0)}
              detail={`${fmtMoney(selectedRecord?.dog.summary.averageProfit || 0)} average profit`}
            />
            <ReadTile
              label="Highest Litter"
              value={selectedBestLitter ? selectedBestLitter.displayName : "No litter yet"}
              detail={selectedBestLitter ? fmtMoney(selectedBestLitter.summary.totalRevenue) : "Awaiting litter records"}
              wrap
            />
          </div>

          <div className="mt-5 rounded-[1.2rem] border border-[var(--portal-border)] bg-white p-4">
            <div className="text-sm font-semibold text-[var(--portal-text)]">
              Recent timing items for this dog
            </div>
            <div className="mt-4 space-y-3">
              {selectedTimeline.length ? (
                selectedTimeline.slice(0, 4).map((event) => <TimelineRow key={event.key} event={event} />)
              ) : (
                <div className="rounded-[1rem] bg-[var(--portal-surface-muted)] px-4 py-5 text-xs leading-5 text-[var(--portal-text-soft)]">
                  No recorded milestones yet.
                </div>
              )}
            </div>
          </div>
        </Surface>
      ) : null}

      {!createMode && !selectedRecord ? (
        <AdminEmptyState
          title="Select a breeding dog"
          description="Choose a dog from the roster to open profile, lineage, reproduction, litter, and financial records."
        />
      ) : null}
    </div>
  );
}

function PairingWorkspace({
  pairings,
  selectedRecord,
}: {
  pairings: PairingSummary[];
  selectedRecord: ProgramDogRecord | null;
}) {
  const visiblePairings = selectedRecord
    ? pairings.filter(
        (pairing) =>
          pairing.dam?.dog.id === selectedRecord.dog.id ||
          pairing.sire?.dog.id === selectedRecord.dog.id
      )
    : pairings;

  return (
    <div className="space-y-5">
      <Surface className="p-5 md:p-6">
        <SurfaceHeader
          eyebrow="Pairings"
          title={selectedRecord ? `Pairings involving ${selectedRecord.dog.displayName}` : "All pairing history"}
          subtitle="Each pairing aggregates every linked litter so you can compare performance by revenue, litter size, and color or coat outcome."
        />

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visiblePairings.length ? (
            visiblePairings.map((pairing) => (
              <div
                key={pairing.key}
                className="rounded-[1.2rem] border border-[var(--portal-border)] bg-white p-4"
              >
                <div className="text-sm font-semibold text-[var(--portal-text)]">
                  {pairing.dam?.dog.displayName || "Unknown dam"} x{" "}
                  {pairing.sire?.dog.displayName || "Unknown sire"}
                </div>
                <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                  {pairing.litters.length} litters | {pairing.totalPuppies} puppies |{" "}
                  {pairing.retainedPuppies} retained
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <ReadTile label="Revenue" value={fmtMoney(pairing.totalRevenue)} />
                  <ReadTile label="Profit" value={fmtMoney(pairing.totalProfit)} />
                  <ReadTile
                    label="Avg litter size"
                    value={pairing.averageLitterSize ? pairing.averageLitterSize.toFixed(1) : "0.0"}
                  />
                  <ReadTile label="Avg sale price" value={fmtMoney(pairing.averageSalePrice)} />
                </div>
                <div className="mt-3 text-xs leading-5 text-[var(--portal-text-soft)]">
                  Color trend: {pairing.colorSummary}
                </div>
                <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                  Coat trend: {pairing.coatSummary}
                </div>
              </div>
            ))
          ) : (
            <AdminEmptyState
              title="No pairings to show yet"
              description="Create litters with linked dams and sires to turn this area into a true pairing board."
            />
          )}
        </div>
      </Surface>
    </div>
  );
}

function TimelineWorkspace({
  timelineEvents,
  selectedTimeline,
  selectedRecord,
}: {
  timelineEvents: TimelineEvent[];
  selectedTimeline: TimelineEvent[];
  selectedRecord: ProgramDogRecord | null;
}) {
  const upcoming30 = timelineEvents.filter((event) => {
    const diff = dateDiffDays(event.date);
    return diff != null && diff >= 0 && diff <= 30;
  });
  const upcoming90 = timelineEvents.filter((event) => {
    const diff = dateDiffDays(event.date);
    return diff != null && diff > 30 && diff <= 90;
  });
  const recent = timelineEvents
    .filter((event) => {
      const diff = dateDiffDays(event.date);
      return diff != null && diff < 0 && diff >= -120;
    })
    .sort((left, right) => dateValue(right.date) - dateValue(left.date));

  return (
    <div className="space-y-5">
      <Surface className="p-5 md:p-6">
        <SurfaceHeader
          eyebrow="Timeline"
          title="Breeding calendar and milestone flow"
          subtitle="Use this view to watch heat cycles, due dates, whelping, next breeding windows, and retirement planning milestones."
        />

        <div className="mt-5 grid gap-5 xl:grid-cols-3">
          <TimelineColumn title="Next 30 days" events={upcoming30} empty="No upcoming events in the next 30 days." />
          <TimelineColumn title="31 to 90 days" events={upcoming90} empty="No events staged in the 31-90 day window." />
          <TimelineColumn title="Recent history" events={recent} empty="No recent milestones recorded." />
        </div>
      </Surface>

      {selectedRecord ? (
        <Surface className="p-5 md:p-6">
          <SurfaceHeader
            eyebrow="Selected Dog Timeline"
            title={`${selectedRecord.dog.displayName} timing lane`}
            subtitle="This isolates the current dog's breeding schedule and recent milestones."
          />

          <div className="mt-5 space-y-3">
            {selectedTimeline.length ? (
              selectedTimeline.map((event) => (
                <TimelineRow key={event.key} event={event} />
              ))
            ) : (
              <AdminEmptyState
                title="No timeline items for this dog yet"
                description="Add reproductive dates to the dog profile and they will appear here automatically."
              />
            )}
          </div>
        </Surface>
      ) : null}
    </div>
  );
}

function InsightsWorkspace({
  programDogs,
  pairings,
  bloodlineLeaderboard,
  incompleteDogs,
}: {
  programDogs: ProgramDogRecord[];
  pairings: PairingSummary[];
  bloodlineLeaderboard: Array<{ label: string; revenue: number; puppies: number; dogs: number }>;
  incompleteDogs: ProgramDogRecord[];
}) {
  const bestPairingBySize =
    [...pairings].sort((left, right) => right.averageLitterSize - left.averageLitterSize)[0] || null;
  const topRetainedValue =
    [...programDogs].sort((left, right) => right.retainedPuppies - left.retainedPuppies)[0] || null;
  const decliningLitters = [...programDogs]
    .map((record) => {
      const sorted = sortByDateDesc(record.litters, (litter) => litter.whelp_date).reverse();
      if (sorted.length < 2) return null;
      const previous = sorted.slice(0, -1);
      const latest = sorted[sorted.length - 1];
      const previousAverage =
        previous.reduce((sum, litter) => sum + litter.puppies.length, 0) / previous.length;
      return latest.puppies.length < previousAverage
        ? {
            record,
            latestSize: latest.puppies.length,
            previousAverage,
          }
        : null;
    })
    .filter(Boolean) as Array<{ record: ProgramDogRecord; latestSize: number; previousAverage: number }>;

  return (
    <div className="space-y-5">
      <Surface className="p-5 md:p-6">
        <SurfaceHeader
          eyebrow="Reports / Insights"
          title="Breeding trends and decision support"
          subtitle="This is the reporting layer for the program: strongest pairings, most productive dogs, bloodline direction, and record-quality issues."
        />

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InsightCard
            title="Best pairing by revenue"
            value={
              pairings[0]
                ? `${pairings[0].dam?.dog.displayName || "Unknown"} x ${pairings[0].sire?.dog.displayName || "Unknown"}`
                : "No pairing data yet"
            }
            detail={pairings[0] ? fmtMoney(pairings[0].totalRevenue) : "Awaiting litter records"}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <InsightCard
            title="Best pairing by litter size"
            value={
              bestPairingBySize
                ? `${bestPairingBySize.dam?.dog.displayName || "Unknown"} x ${bestPairingBySize.sire?.dog.displayName || "Unknown"}`
                : "Not enough history"
            }
            detail={
              bestPairingBySize
                ? `${bestPairingBySize.averageLitterSize.toFixed(1)} average puppies`
                : "Need at least one completed litter"
            }
            icon={<Layers3 className="h-4 w-4" />}
          />
          <InsightCard
            title="Highest retained-program value"
            value={topRetainedValue?.dog.displayName || "No retained dogs yet"}
            detail={
              topRetainedValue
                ? `${topRetainedValue.retainedPuppies} retained puppies`
                : "Retained-program statuses will surface here"
            }
            icon={<PawPrint className="h-4 w-4" />}
          />
          <InsightCard
            title="Most successful bloodline"
            value={bloodlineLeaderboard[0]?.label || "Not tagged yet"}
            detail={
              bloodlineLeaderboard[0]
                ? `${fmtMoney(bloodlineLeaderboard[0].revenue)} across ${bloodlineLeaderboard[0].dogs} dogs`
                : "Add bloodline labels on dog profiles"
            }
            icon={<GitBranch className="h-4 w-4" />}
          />
        </div>
      </Surface>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Surface className="p-5 md:p-6">
          <SurfaceHeader
            eyebrow="Program Watchlist"
            title="Trends to review"
            subtitle="These are not hard rules. They are operational signals that can help you review litter direction and record health."
          />

          <div className="mt-5 space-y-4">
            {decliningLitters.length ? (
              decliningLitters.map((item) => (
                <div
                  key={`decline-${item.record.dog.id}`}
                  className="rounded-[1.2rem] border border-[var(--portal-border)] bg-white p-4"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-[#b67744]" />
                    <div>
                      <div className="text-sm font-semibold text-[var(--portal-text)]">
                        {item.record.dog.displayName}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                        Latest litter size {item.latestSize} vs. prior average{" "}
                        {item.previousAverage.toFixed(1)}. Review pairing quality, age, recovery
                        spacing, and record completeness.
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <AdminEmptyState
                title="No declining litter-size signals"
                description="Once dogs have multiple litters on file, this view will surface performance changes over time."
              />
            )}
          </div>
        </Surface>

        <Surface className="p-5">
          <SurfaceHeader
            eyebrow="Record Quality"
            title="Dogs needing updates"
            subtitle="The records most likely to weaken pairing, health, or reporting confidence."
          />

          <div className="mt-5 space-y-3">
            {incompleteDogs.length ? (
              incompleteDogs.slice(0, 8).map((record) => (
                <div
                  key={`incomplete-${record.dog.id}`}
                  className="rounded-[1.1rem] border border-[var(--portal-border)] bg-white px-4 py-4"
                >
                  <div className="text-sm font-semibold text-[var(--portal-text)]">
                    {record.dog.displayName}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {record.warnings.map((warning) => (
                      <ListPill key={`${record.dog.id}-${warning}`} tone="warning">
                        {warning}
                      </ListPill>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <AdminEmptyState
                title="No missing-record warnings"
                description="The current dog set looks well covered across health, lineage, and program notes."
              />
            )}
          </div>
        </Surface>
      </div>
    </div>
  );
}

function SelectedDogRail({
  selectedRecord,
  createMode,
  onOpenDogTab,
}: {
  selectedRecord: ProgramDogRecord | null;
  createMode: boolean;
  onOpenDogTab: (value: DogTab) => void;
}) {
  if (createMode) {
    return (
      <aside className="space-y-5 self-start">
        <Surface className="p-5">
          <SurfaceHeader
            eyebrow="Create Mode"
            title="New breeding profile"
            subtitle="Build the record in the center workspace, then save it to bring it into the browser, metrics, and insight views."
          />

          <div className="mt-5 space-y-3">
            <ReadTile label="Starts With" value="Basic profile" detail="Role, identity, registry, and program state" />
            <ReadTile label="Then Layer In" value="Lineage + genetics" detail="Pedigree, compatibility, health, and breeder notes" />
            <ReadTile label="Command Center Benefit" value="Program rollups" detail="As soon as the dog is saved, litters and puppies can start rolling into analytics" />
          </div>
        </Surface>
      </aside>
    );
  }

  return (
    <aside className="space-y-5 self-start">
      {selectedRecord ? (
        <>
          <Surface className="overflow-hidden">
            <div className="relative aspect-[4/3] bg-[linear-gradient(135deg,rgba(245,233,219,0.95)_0%,rgba(255,252,248,0.98)_100%)]">
              {selectedRecord.photoUrl ? (
                <Image
                  src={selectedRecord.photoUrl}
                  alt={selectedRecord.dog.displayName}
                  fill
                  unoptimized
                  sizes="340px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Dog className="h-10 w-10 text-[#a56a37]" />
                </div>
              )}

              <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(42,28,17,0.02)_0%,rgba(42,28,17,0.78)_100%)] px-5 py-5 text-white">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/75">
                  Selected Dog
                </div>
                <div className="mt-2 text-[1.6rem] font-semibold tracking-[-0.04em]">
                  {selectedRecord.dog.displayName}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <ListPill tone="neutral">{roleLabel(selectedRecord.role)}</ListPill>
                  <ListPill tone="neutral">
                    {selectedRecord.dog.status || selectedRecord.stateLabel || "Active"}
                  </ListPill>
                </div>
              </div>
            </div>
          </Surface>

          <Surface className="p-5">
            <SurfaceHeader
              eyebrow="Selected Dog"
              title="Quick intelligence"
              subtitle="This rail keeps the selected dog's context, warnings, lineage, and metrics visible while you work."
            />

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <StatChip label="Age" value={selectedRecord.ageLabel} />
              <StatChip label="Litters" value={String(selectedRecord.litters.length)} />
              <StatChip label="Puppies" value={String(selectedRecord.puppies.length)} />
              <StatChip label="Revenue" value={fmtMoney(selectedRecord.dog.summary.totalRevenue)} />
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-[1.2rem] border border-[var(--portal-border)] bg-white p-4">
                <div className="text-sm font-semibold text-[var(--portal-text)]">
                  Alerts and reminders
                </div>
                <div className="mt-3 space-y-2">
                  {selectedRecord.warnings.length ? (
                    selectedRecord.warnings.map((warning) => (
                      <div
                        key={`${selectedRecord.dog.id}-${warning}`}
                        className="flex items-start gap-2 rounded-[1rem] bg-[var(--portal-surface-muted)] px-3 py-3"
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 text-[#b67744]" />
                        <div className="text-xs leading-5 text-[var(--portal-text-soft)]">{warning}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs leading-5 text-[var(--portal-text-soft)]">
                      No immediate record warnings. This dog&apos;s program file looks fairly complete.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-[var(--portal-border)] bg-white p-4">
                <div className="text-sm font-semibold text-[var(--portal-text)]">
                  Lineage quick view
                </div>
                <div className="mt-3 space-y-3">
                  <ReadTile label="Sire" value={selectedRecord.metadata.lineage.sireName || "Not logged"} />
                  <ReadTile label="Dam" value={selectedRecord.metadata.lineage.damName || "Not logged"} />
                  <ReadTile
                    label="Bloodline"
                    value={selectedRecord.metadata.lineage.bloodlineLabel || "Not tagged"}
                    detail={selectedRecord.metadata.lineage.pedigreeSummary || "Add a pedigree summary in the lineage tab."}
                    wrap
                  />
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-[var(--portal-border)] bg-white p-4">
                <div className="text-sm font-semibold text-[var(--portal-text)]">
                  Quick jumps
                </div>
                <div className="mt-3 space-y-2">
                  {([
                    { tab: "profile", label: "Basic profile" },
                    { tab: "reproduction", label: "Reproductive tracking" },
                    { tab: "litters", label: "Litter history" },
                    { tab: "financials", label: "Financial performance" },
                  ] as Array<{ tab: DogTab; label: string }>).map((item) => (
                    <button
                      key={item.tab}
                      type="button"
                      onClick={() => onOpenDogTab(item.tab)}
                      className="flex w-full items-center justify-between rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-3 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)] hover:bg-white"
                    >
                      {item.label}
                      <span className="text-[#a56a37]">Open</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Surface>
        </>
      ) : (
        <Surface className="p-5">
          <SurfaceHeader
            eyebrow="No Dog Selected"
            title="Choose a dog from the roster"
            subtitle="The right rail will show the selected dog's metrics, warnings, and lineage once a profile is open."
          />
        </Surface>
      )}
    </aside>
  );
}
