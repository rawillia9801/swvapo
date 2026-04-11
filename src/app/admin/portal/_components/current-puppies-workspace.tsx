"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  ExternalLink,
  PawPrint,
  Plus,
  RefreshCw,
  Search,
  UploadCloud,
} from "lucide-react";
import {
  AdminEmptyState,
  AdminPageShell,
  AdminRestrictedState,
} from "@/components/admin/luxury-admin-shell";
import {
  AdminDateInput,
  AdminNumberInput,
  AdminSelectInput,
  AdminTextAreaInput,
  AdminTextInput,
} from "@/components/admin/admin-form-fields";
import { buildPuppyPhotoUrl, fmtDate, fmtMoney } from "@/lib/utils";
import { usePortalAdminSession } from "@/lib/use-portal-admin-session";

type BuyerOption = {
  id: number;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  notes?: string | null;
  city?: string | null;
  state?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  sale_price?: number | null;
  deposit_amount?: number | null;
  delivery_option?: string | null;
  delivery_date?: string | null;
  delivery_location?: string | null;
  delivery_miles?: number | null;
  delivery_fee?: number | null;
  expense_gas?: number | null;
  expense_hotel?: number | null;
  expense_tolls?: number | null;
  expense_misc?: string | null;
  portal_profile_photo_url?: string | null;
};

type BreedingDog = {
  id: string;
  role?: string | null;
  displayName?: string | null;
};

type Litter = {
  id: number;
  displayName?: string | null;
  dam_id?: string | null;
  sire_id?: string | null;
};

type TransportRequest = {
  id: number;
  request_date?: string | null;
  request_type?: string | null;
  miles?: number | null;
  location_text?: string | null;
  address_text?: string | null;
  notes?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type PuppyRecord = {
  id: number;
  buyer_id?: number | null;
  litter_id?: number | null;
  litter_name?: string | null;
  dam_id?: string | null;
  sire_id?: string | null;
  call_name?: string | null;
  puppy_name?: string | null;
  name?: string | null;
  sire?: string | null;
  dam?: string | null;
  sex?: string | null;
  color?: string | null;
  coat_type?: string | null;
  coat?: string | null;
  pattern?: string | null;
  dob?: string | null;
  registry?: string | null;
  price?: number | null;
  list_price?: number | null;
  deposit?: number | null;
  balance?: number | null;
  status?: string | null;
  birth_weight?: number | null;
  current_weight?: number | null;
  weight_unit?: string | null;
  weight_date?: string | null;
  image_url?: string | null;
  photo_url?: string | null;
  owner_email?: string | null;
  description?: string | null;
  notes?: string | null;
  microchip?: string | null;
  registration_no?: string | null;
  tail_dock_cost?: number | null;
  dewclaw_cost?: number | null;
  vaccination_cost?: number | null;
  microchip_cost?: number | null;
  registration_cost?: number | null;
  other_vet_cost?: number | null;
  total_medical_cost?: number | null;
  w_1?: number | null;
  w_2?: number | null;
  w_3?: number | null;
  w_4?: number | null;
  w_5?: number | null;
  w_6?: number | null;
  w_7?: number | null;
  w_8?: number | null;
  created_at?: string | null;
  buyerName?: string | null;
  buyerEmail?: string | null;
  transportRequest?: TransportRequest | null;
};

type PuppyEvent = {
  id: number;
  puppy_id?: number | null;
  event_date: string;
  event_type?: string | null;
  label?: string | null;
  title?: string | null;
  summary?: string | null;
  details?: string | null;
  auto_generated?: boolean | null;
  photo_url?: string | null;
  photos?: unknown;
  is_published?: boolean | null;
  is_private?: boolean | null;
};

type PuppyHealthRecord = {
  id: number;
  puppy_id?: number | null;
  record_date: string;
  record_type: string;
  title: string;
  description?: string | null;
  provider_name?: string | null;
  medication_name?: string | null;
  dosage?: string | null;
  lot_number?: string | null;
  next_due_date?: string | null;
  is_visible_to_buyer?: boolean | null;
};

type PuppyWeight = {
  id: number;
  puppy_id?: number | null;
  weigh_date?: string | null;
  weight_date?: string | null;
  age_weeks?: number | null;
  weight_oz?: number | null;
  weight_g?: number | null;
  notes?: string | null;
  source?: string | null;
};

type PuppyExtras = {
  events: PuppyEvent[];
  healthRecords: PuppyHealthRecord[];
  weights: PuppyWeight[];
};

type PuppyForm = {
  call_name: string;
  puppy_name: string;
  name: string;
  status: string;
  buyer_id: string;
  owner_email: string;
  litter_id: string;
  litter_name: string;
  dam_id: string;
  sire_id: string;
  sex: string;
  color: string;
  coat_type: string;
  coat: string;
  pattern: string;
  dob: string;
  registry: string;
  sire: string;
  dam: string;
  price: string;
  list_price: string;
  deposit: string;
  balance: string;
  tail_dock_cost: string;
  dewclaw_cost: string;
  vaccination_cost: string;
  microchip_cost: string;
  registration_cost: string;
  other_vet_cost: string;
  photo_url: string;
  image_url: string;
  description: string;
  notes: string;
  birth_weight: string;
  current_weight: string;
  weight_unit: string;
  weight_date: string;
  microchip: string;
  registration_no: string;
  w_1: string;
  w_2: string;
  w_3: string;
  w_4: string;
  w_5: string;
  w_6: string;
  w_7: string;
  w_8: string;
};

type WeightLogForm = {
  weigh_date: string;
  age_weeks: string;
  weight_oz: string;
  weight_g: string;
  notes: string;
};

type CareUpdateForm = {
  update_type: string;
  update_date: string;
  title: string;
  label: string;
  summary: string;
  details: string;
  photo_url: string;
  provider_name: string;
  next_due_date: string;
  medication_name: string;
  dosage: string;
  lot_number: string;
  publish_to_portal: boolean;
  create_health_record: boolean;
};

type FeedbackTone = "success" | "error";

const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(159,99,49,0.18)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--portal-border)] bg-white/90 px-4 py-2.5 text-sm font-semibold text-[var(--portal-text)] shadow-sm transition hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60";

function emptyForm(): PuppyForm {
  return {
    call_name: "",
    puppy_name: "",
    name: "",
    status: "available",
    buyer_id: "",
    owner_email: "",
    litter_id: "",
    litter_name: "",
    dam_id: "",
    sire_id: "",
    sex: "",
    color: "",
    coat_type: "",
    coat: "",
    pattern: "",
    dob: "",
    registry: "",
    sire: "",
    dam: "",
    price: "",
    list_price: "",
    deposit: "",
    balance: "",
    tail_dock_cost: "",
    dewclaw_cost: "",
    vaccination_cost: "",
    microchip_cost: "",
    registration_cost: "",
    other_vet_cost: "",
    photo_url: "",
    image_url: "",
    description: "",
    notes: "",
    birth_weight: "",
    current_weight: "",
    weight_unit: "",
    weight_date: "",
    microchip: "",
    registration_no: "",
    w_1: "",
    w_2: "",
    w_3: "",
    w_4: "",
    w_5: "",
    w_6: "",
    w_7: "",
    w_8: "",
  };
}

function emptyWeightLogForm(): WeightLogForm {
  return {
    weigh_date: new Date().toISOString().slice(0, 10),
    age_weeks: "",
    weight_oz: "",
    weight_g: "",
    notes: "",
  };
}

function emptyCareUpdateForm(): CareUpdateForm {
  return {
    update_type: "socialization",
    update_date: new Date().toISOString().slice(0, 10),
    title: "",
    label: "",
    summary: "",
    details: "",
    photo_url: "",
    provider_name: "",
    next_due_date: "",
    medication_name: "",
    dosage: "",
    lot_number: "",
    publish_to_portal: true,
    create_health_record: false,
  };
}

function puppyName(puppy: PuppyRecord | null) {
  return puppy?.call_name || puppy?.puppy_name || puppy?.name || "Unnamed Puppy";
}

function populateForm(puppy: PuppyRecord | null): PuppyForm {
  if (!puppy) return emptyForm();
  const base = emptyForm();
  for (const key of Object.keys(base) as Array<keyof PuppyForm>) {
    const value = (puppy as Record<string, unknown>)[key];
    base[key] = value == null ? "" : String(value);
  }
  return base;
}

function isCurrentPuppyStatus(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized.includes("available") || normalized.includes("expected");
}

function hasValue(value: unknown) {
  return String(value ?? "").trim().length > 0;
}

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function itemizedBreederCosts(form: PuppyForm) {
  return (
    num(form.tail_dock_cost) +
    num(form.dewclaw_cost) +
    num(form.vaccination_cost) +
    num(form.microchip_cost) +
    num(form.registration_cost) +
    num(form.other_vet_cost)
  );
}

function labelizeUpdateType(value: string | null | undefined) {
  const normalized = String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .toLowerCase();
  if (!normalized) return "Update";
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function fetchPuppies(accessToken: string) {
  const response = await fetch("/api/admin/portal/puppies", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Could not load puppy records.");
  }

  const payload = (await response.json()) as {
    puppies?: PuppyRecord[];
    buyers?: BuyerOption[];
    litters?: Litter[];
    breedingDogs?: BreedingDog[];
  };

  return {
    puppies: Array.isArray(payload.puppies) ? payload.puppies : [],
    buyers: Array.isArray(payload.buyers) ? payload.buyers : [],
    litters: Array.isArray(payload.litters) ? payload.litters : [],
    breedingDogs: Array.isArray(payload.breedingDogs) ? payload.breedingDogs : [],
  };
}

async function fetchPuppyExtras(accessToken: string, puppyId: number) {
  const response = await fetch(`/api/admin/portal/puppy-care?puppy_id=${puppyId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Could not load puppy activity.");
  }

  const payload = (await response.json()) as {
    events?: PuppyEvent[];
    healthRecords?: PuppyHealthRecord[];
    weights?: PuppyWeight[];
  };

  return {
    events: Array.isArray(payload.events) ? payload.events : [],
    healthRecords: Array.isArray(payload.healthRecords) ? payload.healthRecords : [],
    weights: Array.isArray(payload.weights) ? payload.weights : [],
  };
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const key = String(status || "").trim().toLowerCase();
  const style =
    key.includes("expected")
      ? "border-sky-200 bg-sky-50 text-sky-700"
      : key.includes("available")
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-[var(--portal-border)] bg-[var(--portal-surface-muted)] text-[var(--portal-text-soft)]";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${style}`}
    >
      {key || "pending"}
    </span>
  );
}

function FeedbackBanner({ tone, text }: { tone: FeedbackTone; text: string }) {
  return (
    <div
      className={`rounded-[1.2rem] border px-4 py-3 text-sm ${
        tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-rose-200 bg-rose-50 text-rose-800"
      }`}
    >
      {text}
    </div>
  );
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
        "rounded-[1.6rem] border border-[rgba(187,160,132,0.24)] bg-[rgba(255,252,248,0.88)] shadow-[0_18px_44px_rgba(110,79,47,0.08)] backdrop-blur-sm",
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
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
          {eyebrow}
        </div>
        <div className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--portal-text)]">
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

function MetricPill({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.2rem] border border-[rgba(187,160,132,0.18)] bg-white/90 px-4 py-4 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold text-[var(--portal-text)]">{value}</div>
      <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">{detail}</div>
    </div>
  );
}

function ReadStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-[1.1rem] bg-[rgba(250,245,239,0.88)] px-4 py-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">{value}</div>
      {detail ? <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">{detail}</div> : null}
    </div>
  );
}

function PuppyBoardCard({
  puppy,
  onOpen,
}: {
  puppy: PuppyRecord;
  onOpen: () => void;
}) {
  const rawPhoto = puppy.photo_url ?? puppy.image_url ?? "";
  const photo = rawPhoto ? buildPuppyPhotoUrl(rawPhoto) : "";
  const price = hasValue(puppy.price || puppy.list_price) ? fmtMoney(num(puppy.price || puppy.list_price)) : "Not set";
  const currentWeight = hasValue(puppy.current_weight)
    ? `${num(puppy.current_weight)} ${puppy.weight_unit || ""}`.trim()
    : "Not logged";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full min-h-[290px] flex-col overflow-hidden rounded-[1.6rem] border border-[rgba(187,160,132,0.24)] bg-[rgba(255,252,248,0.95)] text-left shadow-[0_18px_40px_rgba(110,79,47,0.08)] transition hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(110,79,47,0.14)]"
    >
      <div className="relative h-44 w-full overflow-hidden bg-[linear-gradient(135deg,#f0dfcb_0%,#d7b48c_100%)]">
        {photo ? (
          <Image
            src={photo}
            alt={puppyName(puppy)}
            fill
            className="object-cover transition duration-500 group-hover:scale-105"
            sizes="(max-width: 1280px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[#8c6848]">
            <div className="flex flex-col items-center gap-2">
              <Camera className="h-8 w-8" />
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em]">Add Photo</div>
            </div>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent" />
        <div className="absolute left-4 top-4">
          <StatusBadge status={puppy.status} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-xl font-semibold tracking-[-0.03em] text-[var(--portal-text)]">
              {puppyName(puppy)}
            </div>
            <div className="mt-1 text-sm text-[var(--portal-text-soft)]">
              {[puppy.sex, puppy.color, puppy.coat_type].filter(Boolean).join(" | ") || "Profile details still being filled in"}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
              Price
            </div>
            <div className="mt-1 text-sm font-semibold text-[var(--portal-text)]">{price}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ReadStat label="Buyer" value={puppy.buyerName || "Not attached"} detail={puppy.buyerEmail || "Attach a buyer when placement is ready"} />
          <ReadStat label="Current Weight" value={currentWeight} detail={puppy.weight_date ? `Logged ${fmtDate(puppy.weight_date)}` : "No recent weight log"} />
          <ReadStat label="Litter" value={puppy.litter_name || "No litter linked"} detail={puppy.dam ? `Dam: ${puppy.dam}` : "Dam not linked yet"} />
          <ReadStat label="Website" value={photo ? "Photo ready" : "Needs photo"} detail={puppy.description ? "Description saved" : "Description still needed"} />
        </div>

        <div className="mt-auto flex items-center justify-between pt-5">
          <div className="text-xs text-[var(--portal-text-soft)]">
            {puppy.transportRequest?.request_type
              ? `${puppy.transportRequest.request_type} scheduled`
              : "No transportation request"}
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#9a6437]">
            Open
            <ExternalLink className="h-4 w-4" />
          </span>
        </div>
      </div>
    </button>
  );
}

function WeightList({ weights }: { weights: PuppyWeight[] }) {
  if (!weights.length) {
    return (
      <div className="rounded-[1.2rem] border border-dashed border-[rgba(187,160,132,0.28)] bg-[rgba(250,245,239,0.7)] px-4 py-5 text-sm text-[var(--portal-text-soft)]">
        Weekly weights will appear here after you log them.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.2rem] border border-[rgba(187,160,132,0.18)] bg-white">
      {weights.map((weight, index) => {
        const label =
          weight.weight_oz != null
            ? `${weight.weight_oz} oz`
            : weight.weight_g != null
              ? `${weight.weight_g} g`
              : "No weight";

        return (
          <div
            key={`weight-${weight.id}`}
            className={`flex flex-wrap items-start justify-between gap-3 px-4 py-3 ${
              index > 0 ? "border-t border-[rgba(187,160,132,0.14)]" : ""
            }`}
          >
            <div>
              <div className="text-sm font-semibold text-[var(--portal-text)]">{label}</div>
              <div className="mt-1 text-xs text-[var(--portal-text-soft)]">
                {(weight.weigh_date || weight.weight_date) ? fmtDate(weight.weigh_date || weight.weight_date || "") : "No date"}
                {weight.age_weeks ? ` | Week ${weight.age_weeks}` : ""}
              </div>
            </div>
            <div className="max-w-[280px] text-right text-xs leading-5 text-[var(--portal-text-soft)]">
              {weight.notes || weight.source || "Logged from Current Puppies"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EventList({ events }: { events: PuppyEvent[] }) {
  if (!events.length) {
    return (
      <div className="rounded-[1.2rem] border border-dashed border-[rgba(187,160,132,0.28)] bg-[rgba(250,245,239,0.7)] px-4 py-5 text-sm text-[var(--portal-text-soft)]">
        Socialization and milestone updates will appear here once posted.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <div key={`event-${event.id}`} className="rounded-[1.2rem] bg-[rgba(250,245,239,0.88)] px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                {labelizeUpdateType(event.event_type)}
              </div>
              <div className="mt-1 text-sm font-semibold text-[var(--portal-text)]">
                {event.title || event.label || "Puppy update"}
              </div>
              <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                {event.event_date ? fmtDate(event.event_date) : "No date"}
                {event.is_published ? " | Published to portal + website" : " | Internal only"}
              </div>
            </div>
          </div>
          {event.summary ? <div className="mt-3 text-sm leading-6 text-[var(--portal-text-soft)]">{event.summary}</div> : null}
          {event.details ? <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{event.details}</div> : null}
        </div>
      ))}
    </div>
  );
}

function HealthList({ records }: { records: PuppyHealthRecord[] }) {
  if (!records.length) {
    return (
      <div className="rounded-[1.2rem] border border-dashed border-[rgba(187,160,132,0.28)] bg-[rgba(250,245,239,0.7)] px-4 py-5 text-sm text-[var(--portal-text-soft)]">
        Vaccinations, de-wormings, and other health records will appear here after posting.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {records.map((record) => (
        <div key={`health-${record.id}`} className="rounded-[1.2rem] bg-[rgba(250,245,239,0.88)] px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                {labelizeUpdateType(record.record_type)}
              </div>
              <div className="mt-1 text-sm font-semibold text-[var(--portal-text)]">{record.title}</div>
              <div className="mt-1 text-xs text-[var(--portal-text-soft)]">
                {record.record_date ? fmtDate(record.record_date) : "No date"}
                {record.is_visible_to_buyer ? " | Visible to buyer" : " | Internal only"}
              </div>
            </div>
            {record.next_due_date ? (
              <div className="text-xs font-semibold text-[var(--portal-text-soft)]">
                Next due {fmtDate(record.next_due_date)}
              </div>
            ) : null}
          </div>
          {record.description ? <div className="mt-3 text-sm leading-6 text-[var(--portal-text-soft)]">{record.description}</div> : null}
          {record.provider_name || record.medication_name ? (
            <div className="mt-2 text-xs text-[var(--portal-text-soft)]">
              {[record.provider_name, record.medication_name, record.dosage].filter(Boolean).join(" | ")}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function DrawerSection({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.4rem] border border-[rgba(187,160,132,0.18)] bg-white p-5">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
        {eyebrow}
      </div>
      <div className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--portal-text)]">
        {title}
      </div>
      {subtitle ? <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{subtitle}</div> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

type CurrentPuppyDrawerProps = {
  puppy: PuppyRecord | null;
  buyers: BuyerOption[];
  litters: Litter[];
  dogs: BreedingDog[];
  form: PuppyForm;
  extras: PuppyExtras;
  extrasLoading: boolean;
  extrasError: string;
  createMode: boolean;
  saving: boolean;
  deleting: boolean;
  uploadingPhoto: boolean;
  postingWeight: boolean;
  postingUpdate: boolean;
  statusTone: FeedbackTone | null;
  statusText: string;
  weightForm: WeightLogForm;
  updateForm: CareUpdateForm;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  onUploadPhoto: (file: File) => void;
  onFieldChange: (key: keyof PuppyForm, value: string) => void;
  onLitterChange: (value: string) => void;
  onWeightChange: (key: keyof WeightLogForm, value: string) => void;
  onUpdateChange: (key: keyof CareUpdateForm, value: string | boolean) => void;
  onLogWeight: () => void;
  onPublishUpdate: () => void;
};

function CurrentPuppyDrawer({
  puppy,
  buyers,
  litters,
  dogs,
  form,
  extras,
  extrasLoading,
  extrasError,
  createMode,
  saving,
  deleting,
  uploadingPhoto,
  postingWeight,
  postingUpdate,
  statusTone,
  statusText,
  weightForm,
  updateForm,
  onClose,
  onSave,
  onDelete,
  onUploadPhoto,
  onFieldChange,
  onLitterChange,
  onWeightChange,
  onUpdateChange,
  onLogWeight,
  onPublishUpdate,
}: CurrentPuppyDrawerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const rawPhoto = form.photo_url || form.image_url;
  const photo = rawPhoto ? buildPuppyPhotoUrl(rawPhoto) : "";
  const totalCosts = itemizedBreederCosts(form);
  const selectedBuyer = buyers.find((buyer) => String(buyer.id) === form.buyer_id) || null;
  const latestEvent = extras.events[0] || null;
  const latestWeight = extras.weights[0] || null;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[rgba(34,24,17,0.38)] backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[1120px] flex-col bg-[rgba(255,252,247,0.98)] shadow-[0_30px_80px_rgba(66,44,24,0.28)]">
        <div className="relative h-60 overflow-hidden border-b border-[rgba(187,160,132,0.18)] bg-[linear-gradient(135deg,#efe1ce_0%,#d5b089_100%)]">
          {photo ? (
            <Image src={photo} alt={puppyName(puppy)} fill className="object-cover" sizes="1120px" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/55" />
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-3">
              <StatusBadge status={form.status} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/90 px-3 py-1.5 text-xs font-semibold text-[var(--portal-text)] shadow-sm backdrop-blur-sm transition hover:bg-white disabled:opacity-60"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                {uploadingPhoto ? "Uploading..." : "Upload Photo"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onUploadPhoto(file);
                  event.target.value = "";
                }}
              />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/40 bg-white/90 px-3 py-1.5 text-xs font-semibold text-[var(--portal-text)] shadow-sm backdrop-blur-sm transition hover:bg-white"
            >
              Close
            </button>
          </div>
          <div className="absolute bottom-0 left-0 right-0 px-6 pb-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
                  Current Puppies
                </div>
                <div className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white">
                  {createMode ? "New Puppy Record" : puppyName(puppy)}
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-white/85">
                  <span>{selectedBuyer?.displayName || "No buyer attached"}</span>
                  <span>{form.litter_id ? `Litter #${form.litter_id}` : "No litter linked"}</span>
                  <span>{hasValue(form.price || form.list_price) ? fmtMoney(num(form.price || form.list_price)) : "Price not set"}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {!createMode && puppy ? (
                  <Link href={`/admin/portal/puppies?puppy=${puppy.id}`} className={secondaryButtonClass}>
                    Open Full Puppy Page
                  </Link>
                ) : null}
                <button type="button" onClick={onSave} disabled={saving} className={primaryButtonClass}>
                  {saving ? "Saving..." : createMode ? "Create Puppy" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-5">
            {statusTone && statusText ? <FeedbackBanner tone={statusTone} text={statusText} /> : null}
            {extrasError ? <FeedbackBanner tone="error" text={extrasError} /> : null}

            <div className="grid gap-4 lg:grid-cols-4">
              <ReadStat
                label="Buyer"
                value={selectedBuyer?.displayName || "Not attached"}
                detail={selectedBuyer?.email || "Attach a buyer when the placement is ready"}
              />
              <ReadStat
                label="Current Weight"
                value={
                  hasValue(form.current_weight)
                    ? `${num(form.current_weight)} ${form.weight_unit || ""}`.trim()
                    : "Not logged"
                }
                detail={form.weight_date ? `Updated ${fmtDate(form.weight_date)}` : "No weight date saved yet"}
              />
              <ReadStat
                label="Latest Update"
                value={latestEvent?.title || latestEvent?.label || "No recent update"}
                detail={latestEvent?.event_date ? fmtDate(latestEvent.event_date) : "Post care and milestone updates from this drawer"}
              />
              <ReadStat
                label="Latest Weight Log"
                value={
                  latestWeight
                    ? latestWeight.weight_oz != null
                      ? `${latestWeight.weight_oz} oz`
                      : latestWeight.weight_g != null
                        ? `${latestWeight.weight_g} g`
                        : "Logged"
                    : "No log yet"
                }
                detail={
                  latestWeight?.weigh_date || latestWeight?.weight_date
                    ? fmtDate(latestWeight.weigh_date || latestWeight.weight_date || "")
                    : "Use the weekly log below"
                }
              />
            </div>

            <DrawerSection
              eyebrow="Public Listing"
              title="Website And Buyer-Facing Profile"
              subtitle="Everything here feeds the public listing and the buyer-facing puppy record."
            >
              <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-[1.2rem] border border-[rgba(187,160,132,0.18)] bg-[rgba(250,245,239,0.86)]">
                    <div className="relative h-64 bg-[linear-gradient(135deg,#efe1ce_0%,#d5b089_100%)]">
                      {photo ? (
                        <Image src={photo} alt={puppyName(puppy)} fill className="object-cover" sizes="320px" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[#8c6848]">
                          <div className="flex flex-col items-center gap-2">
                            <Camera className="h-8 w-8" />
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                              No puppy photo yet
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPhoto}
                        className={`${secondaryButtonClass} w-full`}
                      >
                        {uploadingPhoto ? "Uploading Photo..." : "Upload Puppy Photo"}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <ReadStat
                      label="Website Description"
                      value={form.description ? "Ready" : "Missing"}
                      detail={form.description ? "Public listing copy has been written." : "Add a description before publishing widely."}
                    />
                    <ReadStat
                      label="Card Photo"
                      value={photo ? "Ready" : "Missing"}
                      detail={photo ? "The puppy card can render a photo now." : "Upload a photo or paste a path/URL."}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <AdminSelectInput
                      label="Status"
                      value={form.status}
                      onChange={(value) => onFieldChange("status", value)}
                      options={[
                        { value: "available", label: "Available" },
                        { value: "expected", label: "Expected" },
                        { value: "reserved", label: "Reserved" },
                        { value: "matched", label: "Matched" },
                        { value: "sold", label: "Sold" },
                        { value: "adopted", label: "Adopted" },
                        { value: "completed", label: "Completed" },
                      ]}
                    />
                    <AdminNumberInput label="Internal Price" value={form.price} onChange={(value) => onFieldChange("price", value)} placeholder="0.00" step="0.01" min={0} />
                    <AdminNumberInput label="Listing Price" value={form.list_price} onChange={(value) => onFieldChange("list_price", value)} placeholder="0.00" step="0.01" min={0} />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <AdminTextInput label="Photo URL" value={form.photo_url} onChange={(value) => onFieldChange("photo_url", value)} placeholder="Public image URL" />
                    <AdminTextInput label="Storage Path / Image URL" value={form.image_url} onChange={(value) => onFieldChange("image_url", value)} placeholder="Supabase path or URL" />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <AdminTextAreaInput label="Website Description" value={form.description} onChange={(value) => onFieldChange("description", value)} rows={5} placeholder="Public listing story, temperament, highlights..." />
                    <AdminTextAreaInput label="Internal Notes" value={form.notes} onChange={(value) => onFieldChange("notes", value)} rows={5} placeholder="Internal breeder notes, placement notes, or care reminders." />
                  </div>
                </div>
              </div>
            </DrawerSection>

            <DrawerSection
              eyebrow="Placement"
              title="Buyer Attachment And Puppy Record"
              subtitle="Attach the buyer, keep the placement pricing straight, and preserve the full puppy profile."
            >
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <AdminTextInput label="Call Name" value={form.call_name} onChange={(value) => onFieldChange("call_name", value)} placeholder="Call name" />
                  <AdminTextInput label="Puppy Name" value={form.puppy_name} onChange={(value) => onFieldChange("puppy_name", value)} placeholder="Puppy name" />
                  <AdminTextInput label="Record Name" value={form.name} onChange={(value) => onFieldChange("name", value)} placeholder="Record name" />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <AdminSelectInput
                    label="Buyer"
                    value={form.buyer_id}
                    onChange={(value) => onFieldChange("buyer_id", value)}
                    options={[
                      { value: "", label: "Unassigned" },
                      ...buyers.map((buyer) => ({
                        value: String(buyer.id),
                        label: buyer.displayName || buyer.email || `Buyer #${buyer.id}`,
                      })),
                    ]}
                  />
                  <AdminTextInput label="Owner Email" value={form.owner_email} onChange={(value) => onFieldChange("owner_email", value)} placeholder="Buyer email" />
                  <AdminTextInput
                    label="Buyer Summary"
                    value={selectedBuyer?.displayName || ""}
                    onChange={() => {}}
                    placeholder="Selected automatically"
                    disabled
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-4">
                  <AdminSelectInput
                    label="Litter"
                    value={form.litter_id}
                    onChange={onLitterChange}
                    options={[
                      { value: "", label: "No litter" },
                      ...litters.map((litter) => ({
                        value: String(litter.id),
                        label: litter.displayName || `Litter #${litter.id}`,
                      })),
                    ]}
                  />
                  <AdminSelectInput
                    label="Dam"
                    value={form.dam_id}
                    onChange={(value) => onFieldChange("dam_id", value)}
                    options={[
                      { value: "", label: "No dam" },
                      ...dogs
                        .filter((dog) => String(dog.role || "").toLowerCase() === "dam")
                        .map((dog) => ({
                          value: String(dog.id),
                          label: dog.displayName || `Dam #${dog.id}`,
                        })),
                    ]}
                  />
                  <AdminSelectInput
                    label="Sire"
                    value={form.sire_id}
                    onChange={(value) => onFieldChange("sire_id", value)}
                    options={[
                      { value: "", label: "No sire" },
                      ...dogs
                        .filter((dog) => String(dog.role || "").toLowerCase() === "sire")
                        .map((dog) => ({
                          value: String(dog.id),
                          label: dog.displayName || `Sire #${dog.id}`,
                        })),
                    ]}
                  />
                  <AdminTextInput label="Registry" value={form.registry} onChange={(value) => onFieldChange("registry", value)} placeholder="AKC, CKC..." />
                </div>

                <div className="grid gap-4 sm:grid-cols-4">
                  <AdminTextInput label="Sex" value={form.sex} onChange={(value) => onFieldChange("sex", value)} placeholder="Male / Female" />
                  <AdminTextInput label="Color" value={form.color} onChange={(value) => onFieldChange("color", value)} placeholder="Chocolate" />
                  <AdminTextInput label="Coat Type" value={form.coat_type} onChange={(value) => onFieldChange("coat_type", value)} placeholder="Long coat" />
                  <AdminTextInput label="Pattern" value={form.pattern} onChange={(value) => onFieldChange("pattern", value)} placeholder="Pattern" />
                </div>

                <div className="grid gap-4 sm:grid-cols-4">
                  <AdminTextInput label="Coat" value={form.coat} onChange={(value) => onFieldChange("coat", value)} placeholder="Coat notes" />
                  <AdminDateInput label="Date of Birth" value={form.dob} onChange={(value) => onFieldChange("dob", value)} />
                  <AdminNumberInput label="Deposit" value={form.deposit} onChange={(value) => onFieldChange("deposit", value)} placeholder="0.00" step="0.01" min={0} />
                  <AdminNumberInput label="Balance" value={form.balance} onChange={(value) => onFieldChange("balance", value)} placeholder="0.00" step="0.01" min={0} />
                </div>
              </div>
            </DrawerSection>

            <DrawerSection
              eyebrow="Growth"
              title="Weekly Weights And Growth Log"
              subtitle="Keep the built-in week fields updated and also write real weight history entries."
            >
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-4">
                  <AdminNumberInput label="Birth Weight" value={form.birth_weight} onChange={(value) => onFieldChange("birth_weight", value)} placeholder="0" step="0.01" min={0} />
                  <AdminNumberInput label="Current Weight" value={form.current_weight} onChange={(value) => onFieldChange("current_weight", value)} placeholder="0" step="0.01" min={0} />
                  <AdminTextInput label="Weight Unit" value={form.weight_unit} onChange={(value) => onFieldChange("weight_unit", value)} placeholder="oz" />
                  <AdminDateInput label="Weight Date" value={form.weight_date} onChange={(value) => onFieldChange("weight_date", value)} />
                </div>

                <div className="grid gap-4 sm:grid-cols-4">
                  <AdminNumberInput label="Week 1" value={form.w_1} onChange={(value) => onFieldChange("w_1", value)} placeholder="0" step="0.01" min={0} />
                  <AdminNumberInput label="Week 2" value={form.w_2} onChange={(value) => onFieldChange("w_2", value)} placeholder="0" step="0.01" min={0} />
                  <AdminNumberInput label="Week 3" value={form.w_3} onChange={(value) => onFieldChange("w_3", value)} placeholder="0" step="0.01" min={0} />
                  <AdminNumberInput label="Week 4" value={form.w_4} onChange={(value) => onFieldChange("w_4", value)} placeholder="0" step="0.01" min={0} />
                  <AdminNumberInput label="Week 5" value={form.w_5} onChange={(value) => onFieldChange("w_5", value)} placeholder="0" step="0.01" min={0} />
                  <AdminNumberInput label="Week 6" value={form.w_6} onChange={(value) => onFieldChange("w_6", value)} placeholder="0" step="0.01" min={0} />
                  <AdminNumberInput label="Week 7" value={form.w_7} onChange={(value) => onFieldChange("w_7", value)} placeholder="0" step="0.01" min={0} />
                  <AdminNumberInput label="Week 8" value={form.w_8} onChange={(value) => onFieldChange("w_8", value)} placeholder="0" step="0.01" min={0} />
                </div>

                <div className="rounded-[1.2rem] bg-[rgba(250,245,239,0.88)] p-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                    Log A Weight Entry
                  </div>
                  {createMode ? (
                    <div className="mt-3 text-sm text-[var(--portal-text-soft)]">
                      Save the puppy record first, then you can start logging real weekly weight entries.
                    </div>
                  ) : (
                    <>
                      <div className="mt-4 grid gap-4 sm:grid-cols-4">
                        <AdminDateInput label="Weigh Date" value={weightForm.weigh_date} onChange={(value) => onWeightChange("weigh_date", value)} />
                        <AdminNumberInput label="Age In Weeks" value={weightForm.age_weeks} onChange={(value) => onWeightChange("age_weeks", value)} placeholder="1-8" min={1} step="1" />
                        <AdminNumberInput label="Weight (oz)" value={weightForm.weight_oz} onChange={(value) => onWeightChange("weight_oz", value)} placeholder="0" step="0.01" min={0} />
                        <AdminNumberInput label="Weight (g)" value={weightForm.weight_g} onChange={(value) => onWeightChange("weight_g", value)} placeholder="0" step="0.01" min={0} />
                      </div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
                        <AdminTextAreaInput label="Weight Notes" value={weightForm.notes} onChange={(value) => onWeightChange("notes", value)} rows={3} placeholder="Weekly progress, appetite, milestone notes..." />
                        <div className="flex items-end">
                          <button type="button" onClick={onLogWeight} disabled={postingWeight} className={`${primaryButtonClass} w-full`}>
                            {postingWeight ? "Logging..." : "Log Weekly Weight"}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {extrasLoading && !createMode ? (
                  <div className="rounded-[1.2rem] bg-[rgba(250,245,239,0.7)] px-4 py-5 text-sm text-[var(--portal-text-soft)]">
                    Loading weight history...
                  </div>
                ) : (
                  <WeightList weights={extras.weights} />
                )}
              </div>
            </DrawerSection>

            <DrawerSection
              eyebrow="Portal Publishing"
              title="Socialization, Vaccination, And Buyer-Facing Updates"
              subtitle="Use this checkbox-driven form to publish milestone and care updates to the buyer portal and website."
            >
              <div className="space-y-5">
                <div className="rounded-[1.2rem] bg-[rgba(250,245,239,0.88)] p-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                    Post A Puppy Update
                  </div>
                  {createMode ? (
                    <div className="mt-3 text-sm text-[var(--portal-text-soft)]">
                      Save the puppy first, then post socialization, vaccination, de-worming, and milestone updates from here.
                    </div>
                  ) : (
                    <>
                      <div className="mt-4 grid gap-4 sm:grid-cols-3">
                        <AdminSelectInput
                          label="Update Type"
                          value={updateForm.update_type}
                          onChange={(value) => onUpdateChange("update_type", value)}
                          options={[
                            { value: "socialization", label: "Socialization" },
                            { value: "earmarks", label: "Earmarks" },
                            { value: "vaccination", label: "Vaccination" },
                            { value: "deworming", label: "De-Worming" },
                            { value: "milestone", label: "Milestone" },
                            { value: "vet", label: "Vet / Wellness" },
                          ]}
                        />
                        <AdminDateInput label="Update Date" value={updateForm.update_date} onChange={(value) => onUpdateChange("update_date", value)} />
                        <AdminTextInput label="Photo URL For Update" value={updateForm.photo_url} onChange={(value) => onUpdateChange("photo_url", value)} placeholder="Optional update photo" />
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <AdminTextInput label="Title" value={updateForm.title} onChange={(value) => onUpdateChange("title", value)} placeholder="Six week socialization session" />
                        <AdminTextInput label="Label" value={updateForm.label} onChange={(value) => onUpdateChange("label", value)} placeholder="Socialization" />
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <AdminTextAreaInput label="Summary" value={updateForm.summary} onChange={(value) => onUpdateChange("summary", value)} rows={3} placeholder="Short buyer-facing summary" />
                        <AdminTextAreaInput label="Details" value={updateForm.details} onChange={(value) => onUpdateChange("details", value)} rows={3} placeholder="Optional details for the portal and website timeline" />
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-4">
                        <AdminTextInput label="Provider" value={updateForm.provider_name} onChange={(value) => onUpdateChange("provider_name", value)} placeholder="Vet or breeder" />
                        <AdminDateInput label="Next Due Date" value={updateForm.next_due_date} onChange={(value) => onUpdateChange("next_due_date", value)} />
                        <AdminTextInput label="Medication" value={updateForm.medication_name} onChange={(value) => onUpdateChange("medication_name", value)} placeholder="Optional" />
                        <AdminTextInput label="Dosage" value={updateForm.dosage} onChange={(value) => onUpdateChange("dosage", value)} placeholder="Optional" />
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <AdminTextInput label="Lot Number" value={updateForm.lot_number} onChange={(value) => onUpdateChange("lot_number", value)} placeholder="Optional" />
                        <label className="flex items-start gap-3 rounded-[1.1rem] border border-[rgba(187,160,132,0.18)] bg-white px-4 py-4 text-sm text-[var(--portal-text)]">
                          <input
                            type="checkbox"
                            checked={updateForm.publish_to_portal}
                            onChange={(event) => onUpdateChange("publish_to_portal", event.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-[var(--portal-border)] text-[#a56733] focus:ring-[#c88c52]"
                          />
                          <span>
                            <span className="block font-semibold">Publish to buyer portal + website</span>
                            <span className="mt-1 block text-xs leading-5 text-[var(--portal-text-soft)]">
                              When checked, this update appears publicly for the buyer and on the website timeline.
                            </span>
                          </span>
                        </label>
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <label className="flex items-start gap-3 rounded-[1.1rem] border border-[rgba(187,160,132,0.18)] bg-white px-4 py-4 text-sm text-[var(--portal-text)]">
                          <input
                            type="checkbox"
                            checked={updateForm.create_health_record}
                            onChange={(event) => onUpdateChange("create_health_record", event.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-[var(--portal-border)] text-[#a56733] focus:ring-[#c88c52]"
                          />
                          <span>
                            <span className="block font-semibold">Also create a health record</span>
                            <span className="mt-1 block text-xs leading-5 text-[var(--portal-text-soft)]">
                              Use this for vaccinations, de-wormings, and other medical care that should land in the health record list too.
                            </span>
                          </span>
                        </label>
                        <div className="flex items-end justify-end">
                          <button type="button" onClick={onPublishUpdate} disabled={postingUpdate} className={primaryButtonClass}>
                            {postingUpdate ? "Posting..." : "Post Puppy Update"}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {extrasLoading && !createMode ? (
                  <div className="rounded-[1.2rem] bg-[rgba(250,245,239,0.7)] px-4 py-5 text-sm text-[var(--portal-text-soft)]">
                    Loading published care history...
                  </div>
                ) : (
                  <div className="grid gap-5 xl:grid-cols-2">
                    <div>
                      <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                        Recent Updates
                      </div>
                      <EventList events={extras.events} />
                    </div>
                    <div>
                      <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                        Recent Health Records
                      </div>
                      <HealthList records={extras.healthRecords} />
                    </div>
                  </div>
                )}
              </div>
            </DrawerSection>

            <DrawerSection
              eyebrow="Costs"
              title="Costs, Registry, And Internal Medical Totals"
              subtitle="Track breeder-side costs without leaving the puppy record."
            >
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <AdminTextInput label="Microchip" value={form.microchip} onChange={(value) => onFieldChange("microchip", value)} placeholder="Microchip number" />
                  <AdminTextInput label="Registration No." value={form.registration_no} onChange={(value) => onFieldChange("registration_no", value)} placeholder="Registration number" />
                  <ReadStat label="Itemized Costs" value={fmtMoney(totalCosts)} detail="Tail dock, dewclaw, vaccines, chip, registration, and other vet care." />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <AdminNumberInput label="Tail Dock Cost" value={form.tail_dock_cost} onChange={(value) => onFieldChange("tail_dock_cost", value)} placeholder="0.00" step="0.01" min={0} />
                  <AdminNumberInput label="Dewclaw Cost" value={form.dewclaw_cost} onChange={(value) => onFieldChange("dewclaw_cost", value)} placeholder="0.00" step="0.01" min={0} />
                  <AdminNumberInput label="Vaccination Cost" value={form.vaccination_cost} onChange={(value) => onFieldChange("vaccination_cost", value)} placeholder="0.00" step="0.01" min={0} />
                  <AdminNumberInput label="Microchip Cost" value={form.microchip_cost} onChange={(value) => onFieldChange("microchip_cost", value)} placeholder="0.00" step="0.01" min={0} />
                  <AdminNumberInput label="Registration Cost" value={form.registration_cost} onChange={(value) => onFieldChange("registration_cost", value)} placeholder="0.00" step="0.01" min={0} />
                  <AdminNumberInput label="Other Vet Cost" value={form.other_vet_cost} onChange={(value) => onFieldChange("other_vet_cost", value)} placeholder="0.00" step="0.01" min={0} />
                </div>
              </div>
            </DrawerSection>
          </div>
        </div>

        <div className="border-t border-[rgba(187,160,132,0.18)] bg-white/90 px-6 py-4 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-[var(--portal-text-soft)]">
              {createMode
                ? "Create the puppy first, then keep photos, care updates, and weekly weights flowing from this drawer."
                : "This drawer writes to the real puppy record, weekly weight log, and buyer-facing care timeline."}
            </div>
            <div className="flex flex-wrap gap-2">
              {!createMode && puppy ? (
                <button type="button" onClick={onDelete} disabled={deleting} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60">
                  {deleting ? "Deleting..." : "Delete Puppy"}
                </button>
              ) : null}
              <button type="button" onClick={onClose} className={secondaryButtonClass}>
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function CurrentPuppiesWorkspace() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const [puppies, setPuppies] = useState<PuppyRecord[]>([]);
  const [buyers, setBuyers] = useState<BuyerOption[]>([]);
  const [litters, setLitters] = useState<Litter[]>([]);
  const [dogs, setDogs] = useState<BreedingDog[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState<PuppyForm>(emptyForm());
  const [statusText, setStatusText] = useState("");
  const [statusTone, setStatusTone] = useState<FeedbackTone | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [extras, setExtras] = useState<PuppyExtras>({ events: [], healthRecords: [], weights: [] });
  const [extrasLoading, setExtrasLoading] = useState(false);
  const [extrasError, setExtrasError] = useState("");
  const [weightForm, setWeightForm] = useState<WeightLogForm>(emptyWeightLogForm());
  const [updateForm, setUpdateForm] = useState<CareUpdateForm>(emptyCareUpdateForm());
  const [postingWeight, setPostingWeight] = useState(false);
  const [postingUpdate, setPostingUpdate] = useState(false);
  const [pageFeedback, setPageFeedback] = useState<{ tone: FeedbackTone; text: string } | null>(null);

  const currentPuppies = useMemo(
    () => puppies.filter((puppy) => isCurrentPuppyStatus(puppy.status)),
    [puppies]
  );

  const filteredPuppies = useMemo(() => {
    const query = search.trim().toLowerCase();
    return currentPuppies.filter((puppy) => {
      if (!query) return true;
      return [
        puppyName(puppy),
        puppy.status,
        puppy.buyerName,
        puppy.litter_name,
        puppy.dam,
        puppy.sire,
        puppy.color,
        puppy.description,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(query);
    });
  }, [currentPuppies, search]);

  const selectedPuppy =
    createMode
      ? null
      : puppies.find((puppy) => String(puppy.id) === selectedId) ||
        currentPuppies.find((puppy) => String(puppy.id) === selectedId) ||
        null;

  async function refresh(preferredId?: string, nextCreateMode = false) {
    if (!accessToken) return;
    const payload = await fetchPuppies(accessToken);
    setPuppies(payload.puppies);
    setBuyers(payload.buyers);
    setLitters(payload.litters);
    setDogs(payload.breedingDogs);
    setCreateMode(nextCreateMode);

    const availableIds = payload.puppies
      .filter((puppy) => isCurrentPuppyStatus(puppy.status))
      .map((puppy) => String(puppy.id));

    setSelectedId((current) => {
      if (nextCreateMode) return "";
      if (preferredId && payload.puppies.some((puppy) => String(puppy.id) === preferredId)) {
        return preferredId;
      }
      if (current && payload.puppies.some((puppy) => String(puppy.id) === current)) {
        return current;
      }
      return availableIds[0] || String(payload.puppies[0]?.id || "");
    });
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
        const payload = await fetchPuppies(accessToken);
        if (!active) return;
        setPuppies(payload.puppies);
        setBuyers(payload.buyers);
        setLitters(payload.litters);
        setDogs(payload.breedingDogs);
        const firstCurrent = payload.puppies.find((puppy) => isCurrentPuppyStatus(puppy.status));
        setSelectedId(String(firstCurrent?.id || payload.puppies[0]?.id || ""));
      } catch (error) {
        if (!active) return;
        setPageFeedback({
          tone: "error",
          text: error instanceof Error ? error.message : "Could not load current puppies.",
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

  useEffect(() => {
    if (createMode) {
      setForm(emptyForm());
      setExtras({ events: [], healthRecords: [], weights: [] });
      setExtrasError("");
      setWeightForm(emptyWeightLogForm());
      setUpdateForm(emptyCareUpdateForm());
      return;
    }

    setForm(populateForm(selectedPuppy));
    setWeightForm(emptyWeightLogForm());
    setUpdateForm((current) => ({
      ...emptyCareUpdateForm(),
      photo_url: current.photo_url || selectedPuppy?.photo_url || selectedPuppy?.image_url || "",
    }));
  }, [createMode, selectedPuppy]);

  useEffect(() => {
    if (typeof window === "undefined" || createMode) return;
    const params = new URLSearchParams(window.location.search);
    const requestedPuppyId = params.get("puppy");
    if (!requestedPuppyId) return;
    if (!puppies.some((puppy) => String(puppy.id) === requestedPuppyId)) return;
    setSelectedId(requestedPuppyId);
    setDrawerOpen(true);
  }, [createMode, puppies]);

  useEffect(() => {
    let active = true;

    async function loadExtras() {
      if (!accessToken || createMode || !selectedPuppy || !drawerOpen) {
        if (active) {
          setExtras({ events: [], healthRecords: [], weights: [] });
          setExtrasError("");
          setExtrasLoading(false);
        }
        return;
      }

      setExtrasLoading(true);
      setExtrasError("");

      try {
        const payload = await fetchPuppyExtras(accessToken, selectedPuppy.id);
        if (!active) return;
        setExtras(payload);
      } catch (error) {
        if (!active) return;
        setExtrasError(error instanceof Error ? error.message : "Could not load puppy activity.");
      } finally {
        if (active) setExtrasLoading(false);
      }
    }

    void loadExtras();
    return () => {
      active = false;
    };
  }, [accessToken, createMode, drawerOpen, selectedPuppy]);

  function openCreateDrawer() {
    setCreateMode(true);
    setSelectedId("");
    setForm(emptyForm());
    setStatusText("");
    setStatusTone(null);
    setDrawerOpen(true);
    setWeightForm(emptyWeightLogForm());
    setUpdateForm(emptyCareUpdateForm());
  }

  function openPuppyDrawer(puppyId: string) {
    setCreateMode(false);
    setSelectedId(puppyId);
    setStatusText("");
    setStatusTone(null);
    setDrawerOpen(true);
  }

  function updateField(key: keyof PuppyForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateWeightForm(key: keyof WeightLogForm, value: string) {
    setWeightForm((current) => ({ ...current, [key]: value }));
  }

  function updateCareForm(key: keyof CareUpdateForm, value: string | boolean) {
    setUpdateForm((current) => ({
      ...current,
      [key]: value as never,
    }));
  }

  function chooseLitter(value: string) {
    const litter = litters.find((item) => String(item.id) === value) || null;
    setForm((current) => ({
      ...current,
      litter_id: value,
      litter_name: litter?.displayName || current.litter_name,
      dam_id: litter?.dam_id ? String(litter.dam_id) : current.dam_id,
      sire_id: litter?.sire_id ? String(litter.sire_id) : current.sire_id,
    }));
  }

  async function savePuppy() {
    if (!accessToken) return;

    setSaving(true);
    setStatusText("");
    setStatusTone(null);

    try {
      const response = await fetch("/api/admin/portal/puppies", {
        method: createMode ? "POST" : "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(createMode ? {} : { id: selectedPuppy?.id }),
          ...form,
        }),
      });

      const payload = (await response.json()) as {
        puppyId?: number;
        error?: string;
        saved?: { status?: string | null };
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not save the puppy.");
      }

      const nextId = payload.puppyId ? String(payload.puppyId) : selectedId;
      await refresh(nextId, false);

      const nextStatus = String(payload.saved?.status || form.status || "").toLowerCase();
      const stillCurrent = isCurrentPuppyStatus(nextStatus);

      setStatusTone("success");
      setStatusText(
        createMode
          ? "Puppy created successfully."
          : stillCurrent
            ? "Puppy record updated."
            : "Puppy record updated and moved out of Current Puppies because the status is no longer available."
      );

      if (createMode) {
        setCreateMode(false);
        setSelectedId(nextId);
      }

      if (!stillCurrent) {
        setDrawerOpen(false);
        setPageFeedback({
          tone: "success",
          text: "Puppy saved and removed from the Current Puppies board because it is no longer available.",
        });
      }
    } catch (error) {
      setStatusTone("error");
      setStatusText(error instanceof Error ? error.message : "Could not save the puppy.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePuppy() {
    if (!accessToken || !selectedPuppy) return;
    if (!window.confirm(`Delete ${puppyName(selectedPuppy)}?`)) return;

    setDeleting(true);
    setStatusText("");
    setStatusTone(null);

    try {
      const response = await fetch("/api/admin/portal/puppies", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: selectedPuppy.id }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not delete the puppy.");
      }

      await refresh(undefined, false);
      setDrawerOpen(false);
      setPageFeedback({ tone: "success", text: "Puppy deleted." });
    } catch (error) {
      setStatusTone("error");
      setStatusText(error instanceof Error ? error.message : "Could not delete the puppy.");
    } finally {
      setDeleting(false);
    }
  }

  async function uploadPhoto(file: File) {
    if (!accessToken) return;

    setUploadingPhoto(true);
    setStatusText("");
    setStatusTone(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (!createMode && selectedPuppy) {
        formData.append("puppy_id", String(selectedPuppy.id));
      }

      const response = await fetch("/api/admin/portal/puppy-photo", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });

      const payload = (await response.json()) as {
        error?: string;
        uploadPath?: string;
        publicUrl?: string | null;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not upload the puppy photo.");
      }

      setForm((current) => ({
        ...current,
        image_url: payload.uploadPath || current.image_url,
        photo_url: payload.publicUrl || current.photo_url,
      }));

      if (!createMode && selectedPuppy) {
        await refresh(String(selectedPuppy.id), false);
      }

      setStatusTone("success");
      setStatusText(createMode ? "Photo uploaded. Save the puppy to attach it to the record." : "Photo uploaded.");
    } catch (error) {
      setStatusTone("error");
      setStatusText(error instanceof Error ? error.message : "Could not upload the puppy photo.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function logWeight() {
    if (!accessToken || !selectedPuppy) return;

    setPostingWeight(true);
    setStatusText("");
    setStatusTone(null);

    try {
      const response = await fetch("/api/admin/portal/puppy-care", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "log_weight",
          puppy_id: selectedPuppy.id,
          ...weightForm,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not log the weekly weight.");
      }

      await refresh(String(selectedPuppy.id), false);
      const freshExtras = await fetchPuppyExtras(accessToken, selectedPuppy.id);
      setExtras(freshExtras);
      setWeightForm(emptyWeightLogForm());
      setStatusTone("success");
      setStatusText("Weekly weight logged.");
    } catch (error) {
      setStatusTone("error");
      setStatusText(error instanceof Error ? error.message : "Could not log the weekly weight.");
    } finally {
      setPostingWeight(false);
    }
  }

  async function publishUpdate() {
    if (!accessToken || !selectedPuppy) return;

    setPostingUpdate(true);
    setStatusText("");
    setStatusTone(null);

    try {
      const response = await fetch("/api/admin/portal/puppy-care", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "publish_update",
          puppy_id: selectedPuppy.id,
          ...updateForm,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not post the puppy update.");
      }

      const freshExtras = await fetchPuppyExtras(accessToken, selectedPuppy.id);
      setExtras(freshExtras);
      setUpdateForm((current) => ({
        ...emptyCareUpdateForm(),
        photo_url: current.photo_url || form.photo_url || form.image_url || "",
      }));
      setStatusTone("success");
      setStatusText("Puppy update posted.");
    } catch (error) {
      setStatusTone("error");
      setStatusText(error instanceof Error ? error.message : "Could not post the puppy update.");
    } finally {
      setPostingUpdate(false);
    }
  }

  if (loading || loadingData) {
    return (
      <AdminPageShell>
        <div className="space-y-6 pb-12">
          <Surface className="p-6">
            <div className="h-10 w-48 animate-pulse rounded-full bg-[rgba(187,160,132,0.18)]" />
            <div className="mt-4 h-10 w-80 animate-pulse rounded-full bg-[rgba(187,160,132,0.14)]" />
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`metric-skeleton-${index}`} className="h-28 animate-pulse rounded-[1.2rem] bg-[rgba(187,160,132,0.12)]" />
              ))}
            </div>
          </Surface>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={`card-skeleton-${index}`} className="h-[290px] animate-pulse rounded-[1.6rem] bg-[rgba(187,160,132,0.12)]" />
            ))}
          </div>
        </div>
      </AdminPageShell>
    );
  }

  if (!user) {
    return (
      <AdminRestrictedState
        title="Sign in to manage current puppies."
        details="This workspace is reserved for the Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!isAdmin) {
    return (
      <AdminRestrictedState
        title="This puppy workspace is limited to approved owner accounts."
        details="Only approved owner emails can manage current puppies, photos, weights, and public updates."
      />
    );
  }

  const buyerLinkedCount = currentPuppies.filter((puppy) => puppy.buyer_id || puppy.owner_email).length;
  const photoReadyCount = currentPuppies.filter((puppy) => puppy.photo_url || puppy.image_url).length;
  const descriptionReadyCount = currentPuppies.filter((puppy) => puppy.description).length;

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-12">
        {pageFeedback ? <FeedbackBanner tone={pageFeedback.tone} text={pageFeedback.text} /> : null}

        <Surface className="p-6 md:p-7">
          <SurfaceHeader
            eyebrow="Current Puppies"
            title="Current Puppies"
            subtitle="A clean board for the puppies that are still actively being worked, marketed, and updated for buyers."
            action={
              <>
                <button type="button" onClick={openCreateDrawer} className={primaryButtonClass}>
                  <Plus className="h-4 w-4" />
                  Add Puppy
                </button>
                <button
                  type="button"
                  onClick={() => void refresh(selectedId, createMode)}
                  className={secondaryButtonClass}
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
                <Link href="/admin/portal/puppies" className={secondaryButtonClass}>
                  Open Full Puppies
                </Link>
              </>
            }
          />

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <MetricPill
              label="Available Board"
              value={String(currentPuppies.length)}
              detail="The current puppy board only shows available and expected puppies."
            />
            <MetricPill
              label="Buyer Attached"
              value={String(buyerLinkedCount)}
              detail="Attach buyers here when the puppy is reserved or matched."
            />
            <MetricPill
              label="Photo Ready"
              value={String(photoReadyCount)}
              detail="Cards with photos are ready for the public site and buyer portal."
            />
            <MetricPill
              label="Website Copy Ready"
              value={String(descriptionReadyCount)}
              detail="Descriptions are saved and ready to publish to the website."
            />
          </div>
        </Surface>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="relative block w-full max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--portal-text-muted)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search current puppies, litter, dam, buyer..."
              className="w-full rounded-[1.2rem] border border-[rgba(187,160,132,0.22)] bg-white/92 py-3 pl-11 pr-4 text-sm text-[var(--portal-text)] shadow-sm outline-none transition placeholder:text-[var(--portal-text-muted)] focus:border-[rgba(166,103,51,0.45)] focus:ring-4 focus:ring-[rgba(200,140,82,0.12)]"
            />
          </label>

          <div className="flex items-center gap-3 rounded-full border border-[rgba(187,160,132,0.18)] bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)] shadow-sm">
            <PawPrint className="h-4 w-4 text-[#a56733]" />
            {filteredPuppies.length} current {filteredPuppies.length === 1 ? "puppy" : "puppies"}
          </div>
        </div>

        {filteredPuppies.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredPuppies.map((puppy) => (
              <PuppyBoardCard key={puppy.id} puppy={puppy} onOpen={() => openPuppyDrawer(String(puppy.id))} />
            ))}
          </div>
        ) : (
          <Surface className="p-10">
            <AdminEmptyState
              title="No current puppies match this search"
              description="Try a different search or create a new puppy record."
            />
          </Surface>
        )}
      </div>

      {drawerOpen ? (
        <CurrentPuppyDrawer
          puppy={selectedPuppy}
          buyers={buyers}
          litters={litters}
          dogs={dogs}
          form={form}
          extras={extras}
          extrasLoading={extrasLoading}
          extrasError={extrasError}
          createMode={createMode}
          saving={saving}
          deleting={deleting}
          uploadingPhoto={uploadingPhoto}
          postingWeight={postingWeight}
          postingUpdate={postingUpdate}
          statusTone={statusTone}
          statusText={statusText}
          weightForm={weightForm}
          updateForm={updateForm}
          onClose={() => setDrawerOpen(false)}
          onSave={() => void savePuppy()}
          onDelete={() => void deletePuppy()}
          onUploadPhoto={(file) => void uploadPhoto(file)}
          onFieldChange={updateField}
          onLitterChange={chooseLitter}
          onWeightChange={updateWeightForm}
          onUpdateChange={updateCareForm}
          onLogWeight={() => void logWeight()}
          onPublishUpdate={() => void publishUpdate()}
        />
      ) : null}
    </AdminPageShell>
  );
}
