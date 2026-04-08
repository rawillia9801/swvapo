"use client";

import Image from "next/image";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  AdminEmptyState,
  AdminHeroPrimaryAction,
  AdminHeroSecondaryAction,
  AdminInfoTile,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPageHero,
  AdminPageShell,
  AdminPanel,
  AdminRestrictedState,
} from "@/components/admin/luxury-admin-shell";
import {
  AdminDateInput,
  AdminNumberInput,
  AdminSelectInput,
  AdminTextAreaInput,
  AdminTextInput,
} from "@/components/admin/admin-form-fields";
import { shouldHidePublicPuppyPrice } from "@/lib/lineage";
import { buildPuppyPhotoUrl, fmtDate, fmtMoney } from "@/lib/utils";
import { usePortalAdminSession } from "@/lib/use-portal-admin-session";

/* ─────────────────────────── types ─────────────────────────── */

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
type BreedingDog = { id: string; role?: string | null; displayName?: string | null };
type Litter = { id: number; displayName?: string | null; dam_id?: string | null; sire_id?: string | null };
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
  w_1?: number | null; w_2?: number | null; w_3?: number | null; w_4?: number | null;
  w_5?: number | null; w_6?: number | null; w_7?: number | null; w_8?: number | null;
  created_at?: string | null;
  buyerName?: string | null;
  buyerEmail?: string | null;
  transportRequest?: TransportRequest | null;
};

type PuppyForm = Record<string, string>;

/* ─────────────────────────── helpers ─────────────────────────── */

function emptyForm(): PuppyForm {
  return {
    call_name: "", puppy_name: "", name: "", status: "available", buyer_id: "", owner_email: "",
    litter_id: "", litter_name: "", dam_id: "", sire_id: "", sex: "", color: "", coat_type: "",
    coat: "", pattern: "", dob: "", registry: "", sire: "", dam: "", price: "", list_price: "",
    deposit: "", balance: "", tail_dock_cost: "", dewclaw_cost: "", vaccination_cost: "",
    microchip_cost: "", registration_cost: "", other_vet_cost: "",
    photo_url: "", image_url: "", description: "", notes: "", birth_weight: "", current_weight: "",
    weight_unit: "", weight_date: "", microchip: "", registration_no: "", w_1: "", w_2: "",
    w_3: "", w_4: "", w_5: "", w_6: "", w_7: "", w_8: "",
  };
}

function puppyName(puppy: PuppyRecord | null) {
  return puppy?.call_name || puppy?.puppy_name || puppy?.name || "Unnamed Puppy";
}

function populateForm(puppy: PuppyRecord | null): PuppyForm {
  if (!puppy) return emptyForm();
  const form = emptyForm();
  Object.keys(form).forEach((key) => {
    const value = (puppy as Record<string, unknown>)[key];
    form[key] = value === null || value === undefined ? "" : String(value);
  });
  return form;
}

function available(status: string | null | undefined) {
  const n = String(status || "").toLowerCase();
  return n.includes("available") || n.includes("expected");
}

function completed(status: string | null | undefined) {
  const n = String(status || "").toLowerCase();
  return ["reserved", "matched", "sold", "adopted", "completed"].some((v) => n.includes(v));
}

function num(value: unknown) {
  const p = Number(value);
  return Number.isFinite(p) ? p : 0;
}

function hasValue(value: unknown) {
  return String(value ?? "").trim().length > 0;
}

function formatMoneyOrDash(value: unknown) {
  if (!hasValue(value)) return "Not set";
  return fmtMoney(num(value));
}

function formatMiles(value: unknown) {
  if (!hasValue(value)) return "Not set";
  return `${num(value).toLocaleString()} mi`;
}

function formatTextOrDash(value: unknown, fallback = "Not set") {
  return String(value ?? "").trim() || fallback;
}

function formatDateOrDash(value: string | null | undefined, fallback = "Not scheduled") {
  if (!value) return fallback;
  return fmtDate(value);
}

function buyerAddress(buyer: BuyerOption | null) {
  if (!buyer) return "No buyer address on file";
  const line1 = String(buyer.address_line1 || "").trim();
  const line2 = String(buyer.address_line2 || "").trim();
  const locality = [buyer.city, buyer.state, buyer.postal_code]
    .map((p) => String(p || "").trim()).filter(Boolean).join(", ");
  return [line1, line2, locality].filter(Boolean).join(" | ") || "No buyer address on file";
}

function transportCostTotal(buyer: BuyerOption | null) {
  if (!buyer) return 0;
  return num(buyer.delivery_fee) + num(buyer.expense_gas) + num(buyer.expense_hotel) + num(buyer.expense_tolls);
}

function itemizedBreederCosts(form: PuppyForm) {
  return num(form.tail_dock_cost) + num(form.dewclaw_cost) + num(form.vaccination_cost) +
    num(form.microchip_cost) + num(form.registration_cost) + num(form.other_vet_cost);
}

async function fetchPuppies(accessToken: string) {
  const response = await fetch("/api/admin/portal/puppies", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return { puppies: [] as PuppyRecord[], buyers: [] as BuyerOption[], litters: [] as Litter[], breedingDogs: [] as BreedingDog[] };
  const payload = (await response.json()) as { puppies?: PuppyRecord[]; buyers?: BuyerOption[]; litters?: Litter[]; breedingDogs?: BreedingDog[] };
  return {
    puppies: Array.isArray(payload.puppies) ? payload.puppies : [],
    buyers: Array.isArray(payload.buyers) ? payload.buyers : [],
    litters: Array.isArray(payload.litters) ? payload.litters : [],
    breedingDogs: Array.isArray(payload.breedingDogs) ? payload.breedingDogs : [],
  };
}

/* ─────────────────────────── status badge ─────────────────────────── */

const STATUS_STYLES: Record<string, string> = {
  available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  expected:  "bg-sky-50 text-sky-700 border-sky-200",
  reserved:  "bg-amber-50 text-amber-700 border-amber-200",
  matched:   "bg-violet-50 text-violet-700 border-violet-200",
  sold:      "bg-rose-50 text-rose-700 border-rose-200",
  adopted:   "bg-teal-50 text-teal-700 border-teal-200",
  completed: "bg-slate-100 text-slate-600 border-slate-200",
};

function StatusBadge({ status }: { status: string | null | undefined }) {
  const key = String(status || "").toLowerCase();
  const style = STATUS_STYLES[key] || "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${style}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
      {key || "pending"}
    </span>
  );
}

/* ─────────────────────────── puppy card ─────────────────────────── */

function PuppyCard({
  puppy,
  isSelected,
  onSelect,
  onOpenDetail,
}: {
  puppy: PuppyRecord;
  isSelected: boolean;
  onSelect: () => void;
  onOpenDetail: () => void;
}) {
  const photo = puppy.photo_url || puppy.image_url ? buildPuppyPhotoUrl(puppy.photo_url || puppy.image_url) : "";
  const priceHidden = shouldHidePublicPuppyPrice(puppy.status);

  return (
    <div
      onClick={onSelect}
      className={`
        group relative flex flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-200
        cursor-pointer hover:shadow-[0_8px_30px_rgba(168,120,72,0.18)] hover:-translate-y-0.5
        ${isSelected
          ? "border-[#c88c52] shadow-[0_0_0_2px_rgba(200,140,82,0.25),0_8px_24px_rgba(168,120,72,0.16)]"
          : "border-[#ead9c7] shadow-sm"
        }
      `}
    >
      {/* Photo strip */}
      <div className="relative h-36 w-full overflow-hidden bg-[#f5ebe0]">
        {photo ? (
          <Image
            src={photo}
            alt={puppyName(puppy)}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="320px"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[#c4a882]">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
              <path d="M8.5 14s1.5 2 3.5 2 3.5-2 3.5-2" />
              <path d="M9 9h.01M15 9h.01" strokeLinecap="round" strokeWidth="2" />
            </svg>
            <span className="text-[10px] font-medium">No photo</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />
        <div className="absolute bottom-2 left-2.5">
          <StatusBadge status={puppy.status} />
        </div>
        {/* Open in new window button */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpenDetail(); }}
          className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-white/40 bg-white/80 px-2 py-1 text-[10px] font-semibold text-[#5d4330] opacity-0 shadow backdrop-blur-sm transition-all duration-200 group-hover:opacity-100 hover:bg-white"
          title="Open detail panel"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 2H2v12h12V9M10 2h4v4M9 7l5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Detail
        </button>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div>
          <div className="font-semibold text-[#2f2218] leading-tight">{puppyName(puppy)}</div>
          <div className="mt-0.5 text-[11px] text-[#9c7a55]">
            {[puppy.sex, puppy.color, puppy.coat_type].filter(Boolean).join(" · ") || "Details not set"}
          </div>
        </div>

        <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-[#7a5c40]">
          <span className="inline-flex items-center gap-1 rounded-md bg-[#faf3ea] px-2 py-0.5">
            <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a5 5 0 100 10A5 5 0 008 1zM3 8a5 5 0 1110 0A5 5 0 013 8z" opacity=".3"/><path d="M7 4h2v5H7zM7 10h2v2H7z"/></svg>
            {puppy.litter_name || "No litter"}
          </span>
          {(puppy.buyerName || puppy.owner_email) && (
            <span className="inline-flex items-center gap-1 rounded-md bg-[#f0f7ee] px-2 py-0.5 text-emerald-700">
              <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6H2z"/></svg>
              {puppy.buyerName || puppy.owner_email}
            </span>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between pt-2 border-t border-[#f0e4d4]">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[#a17345]">
              {priceHidden ? "Price hidden" : "Listed"}
            </div>
            <div className="text-sm font-bold text-[#2f2218]">
              {priceHidden ? "—" : hasValue(puppy.price || puppy.list_price) ? fmtMoney(num(puppy.price || puppy.list_price)) : "Not set"}
            </div>
          </div>
          {puppy.transportRequest && (
            <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              {puppy.transportRequest.request_type || "Transport"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── slide-over detail drawer ─────────────────────────── */

function PuppyDetailDrawer({
  puppy,
  buyer,
  litters,
  dogs,
  buyers,
  form,
  saving,
  deleting,
  statusText,
  createMode,
  onClose,
  onSave,
  onDelete,
  onFieldChange,
  onLitterChange,
}: {
  puppy: PuppyRecord | null;
  buyer: BuyerOption | null;
  litters: Litter[];
  dogs: BreedingDog[];
  buyers: BuyerOption[];
  form: PuppyForm;
  saving: boolean;
  deleting: boolean;
  statusText: string;
  createMode: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  onFieldChange: (key: string, value: string) => void;
  onLitterChange: (value: string) => void;
}) {
  const photo = form.photo_url || form.image_url ? buildPuppyPhotoUrl(form.photo_url || form.image_url) : "";
  const priceHidden = shouldHidePublicPuppyPrice(form.status);
  const itemizedCostTotal = itemizedBreederCosts(form);
  const medicalTotalValue = puppy?.total_medical_cost;
  const selectedTransportTotal = transportCostTotal(buyer);
  const selectedTransportRequest = puppy?.transportRequest || null;
  const damOptions = dogs.filter((d) => String(d.role || "").toLowerCase() === "dam");
  const sireOptions = dogs.filter((d) => String(d.role || "").toLowerCase() === "sire");
  const buyerSummaryName = buyer?.displayName || puppy?.buyerName || form.owner_email || "Not linked";
  const litterSummaryName = litters.find((l) => String(l.id) === form.litter_id)?.displayName || form.litter_name || "Not linked";
  const damSummary = damOptions.find((d) => String(d.id) === form.dam_id)?.displayName || form.dam || "No dam";
  const sireSummary = sireOptions.find((d) => String(d.id) === form.sire_id)?.displayName || form.sire || "No sire";

  // Trap focus / close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-[#fffdf9] shadow-[−20px_0_60px_rgba(0,0,0,0.15)] animate-[slideIn_0.25s_cubic-bezier(0.32,0.72,0,1)]">
        <style>{`
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0.6; }
            to   { transform: translateX(0);    opacity: 1; }
          }
        `}</style>

        {/* Header */}
        <div className="relative flex-shrink-0">
          {photo ? (
            <div className="relative h-48 w-full overflow-hidden">
              <Image src={photo} alt={puppyName(puppy)} fill className="object-cover" sizes="672px" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60" />
            </div>
          ) : (
            <div className="h-24 w-full bg-gradient-to-br from-[#e8d5bc] via-[#d4b48b] to-[#b88a5c]" />
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow backdrop-blur-sm transition hover:bg-white"
            aria-label="Close detail panel"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#5d4330" strokeWidth="2.2" strokeLinecap="round">
              <path d="M2 2l12 12M14 2L2 14" />
            </svg>
          </button>
          <div className={`absolute bottom-4 left-5 ${photo ? "" : "bottom-4"}`}>
            <div className="flex items-end gap-3">
              <div>
                <div className={`text-xl font-bold ${photo ? "text-white drop-shadow" : "text-[#2f2218]"}`}>
                  {createMode ? "New Puppy" : puppyName(puppy)}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge status={form.status} />
                  {!createMode && puppy?.dob && (
                    <span className={`text-xs ${photo ? "text-white/80" : "text-[#7a5c40]"}`}>
                      Born {fmtDate(puppy.dob)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6 p-6">
            {statusText ? (
              <div className="rounded-2xl border border-[#ead9c7] bg-[#fff9f2] px-4 py-3 text-sm font-semibold text-[#7a5a3a]">
                {statusText}
              </div>
            ) : null}

            {/* Quick summary tiles */}
            {!createMode && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-[#faf3ea] border border-[#ead9c7] p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-[#a17345]">Buyer</div>
                  <div className="mt-1 text-sm font-semibold text-[#2f2218] truncate">{buyerSummaryName}</div>
                  <div className="mt-0.5 text-[11px] text-[#9c7a55] truncate">{buyer?.email || "—"}</div>
                </div>
                <div className="rounded-2xl bg-[#faf3ea] border border-[#ead9c7] p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-[#a17345]">Public Price</div>
                  <div className="mt-1 text-sm font-semibold text-[#2f2218]">
                    {priceHidden ? "Hidden" : hasValue(form.price || form.list_price) ? fmtMoney(num(form.price || form.list_price)) : "Not set"}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#9c7a55]">{priceHidden ? "Reserved/completed" : "Publicly visible"}</div>
                </div>
                <div className="rounded-2xl bg-[#faf3ea] border border-[#ead9c7] p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-[#a17345]">Litter</div>
                  <div className="mt-1 text-sm font-semibold text-[#2f2218] truncate">{litterSummaryName}</div>
                  <div className="mt-0.5 text-[11px] text-[#9c7a55] truncate">{damSummary} / {sireSummary}</div>
                </div>
                <div className="rounded-2xl bg-[#faf3ea] border border-[#ead9c7] p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-[#a17345]">Created</div>
                  <div className="mt-1 text-sm font-semibold text-[#2f2218]">
                    {puppy?.created_at ? fmtDate(puppy.created_at) : "Not saved"}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#9c7a55]">{form.status || "pending"}</div>
                </div>
              </div>
            )}

            {/* Buyer & Transport */}
            {!createMode && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#ead9c7] bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-[#a17345]">Buyer Profile</div>
                    <Link href="/admin/portal/users" className="text-[10px] font-semibold text-[#c88c52] hover:underline">Manage →</Link>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-[#9c7a55]">Name</span><span className="font-medium text-[#2f2218] text-right">{buyerSummaryName}</span></div>
                    <div className="flex justify-between"><span className="text-[#9c7a55]">Email</span><span className="font-medium text-[#2f2218] text-right truncate max-w-[140px]">{buyer?.email || form.owner_email || "—"}</span></div>
                    <div className="flex justify-between"><span className="text-[#9c7a55]">Phone</span><span className="font-medium text-[#2f2218]">{buyer?.phone || "—"}</span></div>
                    <div className="flex justify-between"><span className="text-[#9c7a55]">Contract</span><span className="font-medium text-[#2f2218]">{formatMoneyOrDash(buyer?.sale_price)}</span></div>
                    <div className="flex justify-between"><span className="text-[#9c7a55]">Deposit</span><span className="font-medium text-[#2f2218]">{formatMoneyOrDash(buyer?.deposit_amount)}</span></div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#ead9c7] bg-white p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-[#a17345] mb-3">Transportation</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-[#9c7a55]">Mode</span><span className="font-medium text-[#2f2218]">{formatTextOrDash(buyer?.delivery_option, "Not set")}</span></div>
                    <div className="flex justify-between"><span className="text-[#9c7a55]">Date</span><span className="font-medium text-[#2f2218]">{formatDateOrDash(buyer?.delivery_date)}</span></div>
                    <div className="flex justify-between"><span className="text-[#9c7a55]">Location</span><span className="font-medium text-[#2f2218]">{formatTextOrDash(buyer?.delivery_location, "—")}</span></div>
                    <div className="flex justify-between"><span className="text-[#9c7a55]">Miles</span><span className="font-medium text-[#2f2218]">{formatMiles(buyer?.delivery_miles)}</span></div>
                    <div className="flex justify-between"><span className="text-[#9c7a55]">Total Cost</span><span className="font-bold text-[#2f2218]">{fmtMoney(selectedTransportTotal)}</span></div>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-1.5">
                    {[
                      { label: "Gas", value: buyer?.expense_gas },
                      { label: "Hotel", value: buyer?.expense_hotel },
                      { label: "Tolls", value: buyer?.expense_tolls },
                      { label: "Misc", value: buyer?.expense_misc },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl bg-[#faf3ea] p-2 text-center">
                        <div className="text-[9px] font-semibold uppercase tracking-widest text-[#a17345]">{label}</div>
                        <div className="mt-0.5 text-[11px] font-semibold text-[#2f2218]">{hasValue(value) ? (typeof value === "number" ? fmtMoney(value) : String(value)) : "—"}</div>
                      </div>
                    ))}
                  </div>
                  {selectedTransportRequest && (
                    <div className="mt-3 rounded-xl border border-[#ead9c7] bg-[#faf3ea] p-3 text-sm">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-[#a17345]">Latest Request</div>
                      <div className="mt-1 font-semibold text-[#2f2218]">{selectedTransportRequest.request_type || "—"}</div>
                      <div className="mt-0.5 text-[11px] text-[#9c7a55]">{formatTextOrDash(selectedTransportRequest.location_text)} · {formatMiles(selectedTransportRequest.miles)}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Edit form */}
            <div className="rounded-2xl border border-[#ead9c7] bg-white p-5">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-[#a17345] mb-4">Puppy Record</div>
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <AdminTextInput label="Call Name" value={form.call_name} onChange={(v) => onFieldChange("call_name", v)} placeholder="Call name" />
                  <AdminTextInput label="Puppy Name" value={form.puppy_name} onChange={(v) => onFieldChange("puppy_name", v)} placeholder="Puppy name" />
                  <AdminTextInput label="Record Name" value={form.name} onChange={(v) => onFieldChange("name", v)} placeholder="Record name" />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <AdminSelectInput label="Status" value={form.status} onChange={(v) => onFieldChange("status", v)} options={[
                    { value: "available", label: "Available" }, { value: "expected", label: "Expected" },
                    { value: "reserved", label: "Reserved" }, { value: "matched", label: "Matched" },
                    { value: "sold", label: "Sold" }, { value: "adopted", label: "Adopted" }, { value: "completed", label: "Completed" },
                  ]} />
                  <AdminSelectInput label="Buyer" value={form.buyer_id} onChange={(v) => onFieldChange("buyer_id", v)} options={[
                    { value: "", label: "Unassigned" },
                    ...buyers.map((b) => ({ value: String(b.id), label: b.displayName || b.email || `Buyer #${b.id}` })),
                  ]} />
                  <AdminTextInput label="Owner Email" value={form.owner_email} onChange={(v) => onFieldChange("owner_email", v)} placeholder="Buyer email" />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <AdminSelectInput label="Litter" value={form.litter_id} onChange={onLitterChange} options={[
                    { value: "", label: "No litter" },
                    ...litters.map((l) => ({ value: String(l.id), label: l.displayName || `Litter #${l.id}` })),
                  ]} />
                  <AdminSelectInput label="Dam" value={form.dam_id} onChange={(v) => onFieldChange("dam_id", v)} options={[
                    { value: "", label: "No dam" },
                    ...dogs.filter((d) => String(d.role || "").toLowerCase() === "dam").map((d) => ({ value: String(d.id), label: d.displayName || `Dam #${d.id}` })),
                  ]} />
                  <AdminSelectInput label="Sire" value={form.sire_id} onChange={(v) => onFieldChange("sire_id", v)} options={[
                    { value: "", label: "No sire" },
                    ...dogs.filter((d) => String(d.role || "").toLowerCase() === "sire").map((d) => ({ value: String(d.id), label: d.displayName || `Sire #${d.id}` })),
                  ]} />
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <AdminTextInput label="Sex" value={form.sex} onChange={(v) => onFieldChange("sex", v)} placeholder="Sex" />
                  <AdminTextInput label="Color" value={form.color} onChange={(v) => onFieldChange("color", v)} placeholder="Color" />
                  <AdminTextInput label="Coat Type" value={form.coat_type} onChange={(v) => onFieldChange("coat_type", v)} placeholder="Coat type" />
                  <AdminDateInput label="DOB" value={form.dob} onChange={(v) => onFieldChange("dob", v)} />
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <AdminNumberInput label="Internal Sale Price" value={form.price} onChange={(v) => onFieldChange("price", v)} step="0.01" />
                  <AdminNumberInput label="List Price" value={form.list_price} onChange={(v) => onFieldChange("list_price", v)} step="0.01" />
                  <AdminNumberInput label="Deposit" value={form.deposit} onChange={(v) => onFieldChange("deposit", v)} step="0.01" />
                  <AdminNumberInput label="Balance" value={form.balance} onChange={(v) => onFieldChange("balance", v)} step="0.01" />
                </div>

                {/* Costs */}
                <div className="rounded-xl border border-[#ead9c7] bg-[#faf3ea] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-[#a17345]">Breeder Costs</div>
                    <div className="text-sm font-bold text-[#2f2218]">Itemized: {fmtMoney(itemizedCostTotal)}</div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <AdminNumberInput label="Vaccination" value={form.vaccination_cost} onChange={(v) => onFieldChange("vaccination_cost", v)} step="0.01" />
                    <AdminNumberInput label="Medical Total" value={medicalTotalValue == null ? "" : String(medicalTotalValue)} onChange={() => {}} step="0.01" disabled />
                    <AdminNumberInput label="Other Vet" value={form.other_vet_cost} onChange={(v) => onFieldChange("other_vet_cost", v)} step="0.01" />
                    <AdminNumberInput label="Microchip" value={form.microchip_cost} onChange={(v) => onFieldChange("microchip_cost", v)} step="0.01" />
                    <AdminNumberInput label="Registration" value={form.registration_cost} onChange={(v) => onFieldChange("registration_cost", v)} step="0.01" />
                    <AdminNumberInput label="Tail Dock" value={form.tail_dock_cost} onChange={(v) => onFieldChange("tail_dock_cost", v)} step="0.01" />
                    <AdminNumberInput label="Dewclaw" value={form.dewclaw_cost} onChange={(v) => onFieldChange("dewclaw_cost", v)} step="0.01" />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <AdminTextInput label="Photo URL" value={form.photo_url} onChange={(v) => onFieldChange("photo_url", v)} placeholder="Public photo URL" />
                  <AdminTextInput label="Image Path / URL" value={form.image_url} onChange={(v) => onFieldChange("image_url", v)} placeholder="Storage path or URL" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <AdminTextAreaInput label="Description" value={form.description} onChange={(v) => onFieldChange("description", v)} rows={4} placeholder="Public listing description" />
                  <AdminTextAreaInput label="Notes" value={form.notes} onChange={(v) => onFieldChange("notes", v)} rows={4} placeholder="Internal notes" />
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <AdminNumberInput label="Birth Weight" value={form.birth_weight} onChange={(v) => onFieldChange("birth_weight", v)} step="0.01" />
                  <AdminNumberInput label="Current Weight" value={form.current_weight} onChange={(v) => onFieldChange("current_weight", v)} step="0.01" />
                  <AdminTextInput label="Weight Unit" value={form.weight_unit} onChange={(v) => onFieldChange("weight_unit", v)} placeholder="oz" />
                  <AdminDateInput label="Weight Date" value={form.weight_date} onChange={(v) => onFieldChange("weight_date", v)} />
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <AdminTextInput label="Registry" value={form.registry} onChange={(v) => onFieldChange("registry", v)} placeholder="Registry" />
                  <AdminTextInput label="Microchip" value={form.microchip} onChange={(v) => onFieldChange("microchip", v)} placeholder="Microchip" />
                  <AdminTextInput label="Registration No." value={form.registration_no} onChange={(v) => onFieldChange("registration_no", v)} placeholder="Reg. no." />
                  <AdminTextInput label="Pattern" value={form.pattern} onChange={(v) => onFieldChange("pattern", v)} placeholder="Pattern" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex-shrink-0 border-t border-[#ead9c7] bg-white/80 backdrop-blur-sm px-6 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex-1 rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(159,99,49,0.3)] transition hover:brightness-105 disabled:opacity-60"
          >
            {saving ? "Saving…" : createMode ? "Create Puppy" : "Save Changes"}
          </button>
          {!createMode && (
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-[#e4d2be] bg-white px-5 py-3 text-sm font-semibold text-[#5d4330] transition hover:bg-[#faf3ea]"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────── main page ─────────────────────────── */

export default function AdminPortalPuppiesPage() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const [puppies, setPuppies] = useState<PuppyRecord[]>([]);
  const [buyers, setBuyers] = useState<BuyerOption[]>([]);
  const [litters, setLitters] = useState<Litter[]>([]);
  const [dogs, setDogs] = useState<BreedingDog[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [form, setForm] = useState<PuppyForm>(emptyForm());

  async function refresh(preferredId?: string, nextCreateMode = false) {
    if (!accessToken) return;
    const payload = await fetchPuppies(accessToken);
    setPuppies(payload.puppies);
    setBuyers(payload.buyers);
    setLitters(payload.litters);
    setDogs(payload.breedingDogs);
    setCreateMode(nextCreateMode);
    setSelectedId(
      nextCreateMode ? "" :
      preferredId && payload.puppies.some((p) => String(p.id) === preferredId) ? preferredId :
      String(payload.puppies[0]?.id || "")
    );
  }

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      if (!accessToken || !isAdmin) { if (active) setLoadingData(false); return; }
      setLoadingData(true);
      try {
        const payload = await fetchPuppies(accessToken);
        if (!active) return;
        setPuppies(payload.puppies);
        setBuyers(payload.buyers);
        setLitters(payload.litters);
        setDogs(payload.breedingDogs);
        setSelectedId(String(payload.puppies[0]?.id || ""));
      } finally { if (active) setLoadingData(false); }
    }
    void bootstrap();
    return () => { active = false; };
  }, [accessToken, isAdmin]);

  const filteredPuppies = useMemo(() => puppies.filter((p) => {
    if (statusFilter === "available" && !available(p.status)) return false;
    if (statusFilter === "placed" && !completed(p.status)) return false;
    if (statusFilter !== "all" && !["available", "placed"].includes(statusFilter) && String(p.status || "").toLowerCase() !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [puppyName(p), p.status, p.buyerName, p.litter_name, p.sire, p.dam, p.color, p.notes]
      .map((v) => String(v || "").toLowerCase()).join(" ").includes(q);
  }), [puppies, search, statusFilter]);

  const selectedPuppy = createMode ? null : filteredPuppies.find((p) => String(p.id) === selectedId) || puppies.find((p) => String(p.id) === selectedId) || null;
  const selectedBuyer = buyers.find((b) => String(b.id) === form.buyer_id) || null;

  useEffect(() => {
    if (createMode) { setForm(emptyForm()); return; }
    setForm(populateForm(selectedPuppy));
  }, [createMode, selectedPuppy]);

  useEffect(() => {
    if (createMode || !filteredPuppies.length || filteredPuppies.some((p) => String(p.id) === selectedId)) return;
    setSelectedId(String(filteredPuppies[0].id));
  }, [createMode, filteredPuppies, selectedId]);

  function updateField(key: string, value: string) {
    setForm((c) => ({ ...c, [key]: value }));
  }

  function chooseLitter(value: string) {
    const litter = litters.find((l) => String(l.id) === value) || null;
    setForm((c) => ({
      ...c,
      litter_id: value,
      litter_name: litter?.displayName || c.litter_name,
      dam_id: litter?.dam_id ? String(litter.dam_id) : c.dam_id,
      sire_id: litter?.sire_id ? String(litter.sire_id) : c.sire_id,
    }));
  }

  function openDetail(puppyId: string, nextCreateMode = false) {
    setCreateMode(nextCreateMode);
    if (!nextCreateMode) setSelectedId(puppyId);
    setStatusText("");
    setDrawerOpen(true);
  }

  async function savePuppy() {
    if (!accessToken) return;
    setSaving(true); setStatusText("");
    try {
      const submission = { ...form } as PuppyForm & { total_medical_cost?: string };
      delete submission.total_medical_cost;
      const response = await fetch("/api/admin/portal/puppies", {
        method: createMode ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ id: createMode ? undefined : selectedPuppy?.id, ...submission }),
      });
      const payload = (await response.json()) as { puppyId?: number; error?: string; saved?: { litter_id?: number | null; price?: number | null; status?: string | null } };
      if (!response.ok) throw new Error(payload.error || "Could not save the puppy.");
      await refresh(payload.puppyId ? String(payload.puppyId) : selectedId, false);
      const litterText = payload.saved?.litter_id ? ` Linked to litter #${payload.saved.litter_id}.` : " No litter linked.";
      const priceText = payload.saved?.price != null ? ` Internal sale ${fmtMoney(num(payload.saved.price))}.` : "";
      setStatusText(`${createMode ? "Puppy created." : "Puppy updated."}${litterText}${priceText}`);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not save the puppy.");
    } finally { setSaving(false); }
  }

  async function deletePuppy() {
    if (!accessToken || !selectedPuppy) return;
    if (!window.confirm(`Delete ${puppyName(selectedPuppy)}?`)) return;
    setDeleting(true); setStatusText("");
    try {
      const response = await fetch("/api/admin/portal/puppies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ id: selectedPuppy.id }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not delete the puppy.");
      await refresh(undefined, false);
      setDrawerOpen(false);
      setStatusText("Puppy deleted.");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not delete the puppy.");
    } finally { setDeleting(false); }
  }

  if (loading || loadingData) return (
    <div className="flex min-h-screen items-center justify-center bg-[#fffdf9]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#ead9c7] border-t-[#c88c52]" />
        <div className="text-sm font-semibold text-[#7b5f46]">Loading puppies…</div>
      </div>
    </div>
  );

  if (!user) return <AdminRestrictedState title="Sign in to access puppies." details="This workspace is reserved for the Southwest Virginia Chihuahua owner accounts." />;
  if (!isAdmin) return <AdminRestrictedState title="This puppy workspace is limited to approved owner accounts." details="Only the approved owner emails can manage puppy records, lineage, and public price rules." />;

  const damOptions = dogs.filter((d) => String(d.role || "").toLowerCase() === "dam");
  const sireOptions = dogs.filter((d) => String(d.role || "").toLowerCase() === "sire");

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-12">
        {/* Hero */}
        <AdminPageHero
          eyebrow="Puppies"
          title="Manage puppy records with lineage, buyer logistics, and internal cost tracking."
          description="Each puppy record acts as a full operations file — lineage, buyer assignment, transport planning, breeder costs, and public visibility all in one place."
          actions={
            <>
              <button
                type="button"
                onClick={() => { openDetail("", true); setForm(emptyForm()); }}
                className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(159,99,49,0.28)] transition hover:-translate-y-0.5 hover:brightness-105"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M8 2v12M2 8h12" /></svg>
                Create Puppy
              </button>
              <AdminHeroPrimaryAction href="/admin/portal/litters">Open Litters</AdminHeroPrimaryAction>
              <AdminHeroSecondaryAction href="/admin/portal/users">Open Buyers</AdminHeroSecondaryAction>
            </>
          }
          aside={
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <AdminInfoTile label="Public Pricing" value="Auto-managed" detail="Reserved and completed puppies hide pricing publicly." />
              <AdminInfoTile label="Lineage Coverage" value={`${litters.length} litters`} detail={`${damOptions.length} dams / ${sireOptions.length} sires`} />
            </div>
          }
        />

        {/* Metrics */}
        <AdminMetricGrid>
          <AdminMetricCard label="Total Puppies" value={String(puppies.length)} detail="All records across admin, portal, and public surfaces." />
          <AdminMetricCard label="Available" value={String(puppies.filter((p) => available(p.status)).length)} detail="Puppies that can display publicly with price." accent="from-[#dfe8d8] via-[#c6d6ba] to-[#8aa07e]" />
          <AdminMetricCard label="Reserved / Completed" value={String(puppies.filter((p) => shouldHidePublicPuppyPrice(p.status)).length)} detail="Public pricing hidden; records remain internal." accent="from-[#e7ddd3] via-[#c9b39a] to-[#8f6f53]" />
          <AdminMetricCard label="Buyer Linked" value={String(puppies.filter((p) => p.buyer_id || p.owner_email).length)} detail="Puppies attached to a buyer record or email." accent="from-[#f0ddc5] via-[#d9b78e] to-[#be8650]" />
        </AdminMetricGrid>

        {/* Directory */}
        <AdminPanel
          title="Puppy Directory"
          subtitle="Click any card to open the full detail panel. Use the ↗ button on hover to open it directly."
        >
          {/* Filters */}
          <div className="mb-5 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c4a882]" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="6.5" cy="6.5" r="4.5" /><path d="M10.5 10.5l3 3" strokeLinecap="round" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search puppies, litters, lineage, buyer…"
                className="w-full rounded-[16px] border border-[#e6d7c7] bg-[#fffdfa] pl-9 pr-3.5 py-2.5 text-sm text-[#33251a] outline-none transition focus:border-[#caa074] focus:ring-2 focus:ring-[#ead7c0]"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: "all", label: "All" },
                { value: "available", label: "Available" },
                { value: "placed", label: "Placed" },
                { value: "reserved", label: "Reserved" },
                { value: "completed", label: "Completed" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                    statusFilter === value
                      ? "bg-[#c88c52] border-[#a56733] text-white shadow-sm"
                      : "border-[#e6d7c7] bg-white text-[#7a5c40] hover:border-[#d4b48b] hover:bg-[#faf3ea]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Count */}
          {filteredPuppies.length > 0 && (
            <div className="mb-4 text-xs font-semibold text-[#a17345] uppercase tracking-widest">
              {filteredPuppies.length} {filteredPuppies.length === 1 ? "puppy" : "puppies"} found
            </div>
          )}

          {/* Card grid */}
          {filteredPuppies.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredPuppies.map((puppy) => (
                <PuppyCard
                  key={puppy.id}
                  puppy={puppy}
                  isSelected={!createMode && String(puppy.id) === selectedId}
                  onSelect={() => {
                    setCreateMode(false);
                    setSelectedId(String(puppy.id));
                    setStatusText("");
                  }}
                  onOpenDetail={() => openDetail(String(puppy.id))}
                />
              ))}
            </div>
          ) : (
            <AdminEmptyState
              title="No puppies match the current filters"
              description="Adjust the filters or create a new puppy record."
            />
          )}
        </AdminPanel>

        {/* Public visibility summary */}
        <AdminPanel title="Public & Portal Visibility" subtitle="Review what surfaces publicly versus what stays internal.">
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminInfoTile
              label="Available Puppies (Public)"
              value={String(puppies.filter((p) => available(p.status)).length)}
              detail="These records can show pricing publicly based on your listing rules."
            />
            <AdminInfoTile
              label="Hidden from Public"
              value={String(puppies.filter((p) => shouldHidePublicPuppyPrice(p.status)).length)}
              detail="Reserved and completed records keep pricing internal-only."
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/puppies" className="rounded-2xl border border-[#e4d2be] bg-white px-4 py-3 text-sm font-semibold text-[#5d4330] transition hover:border-[#d4b48b] hover:bg-[#faf3ea]">
              Open Public Puppies →
            </Link>
            <Link href="/portal/available-puppies" className="rounded-2xl border border-[#e4d2be] bg-white px-4 py-3 text-sm font-semibold text-[#5d4330] transition hover:border-[#d4b48b] hover:bg-[#faf3ea]">
              Open Portal Listings →
            </Link>
          </div>
        </AdminPanel>
      </div>

      {/* Slide-over drawer */}
      {drawerOpen && (
        <PuppyDetailDrawer
          puppy={selectedPuppy}
          buyer={selectedBuyer}
          litters={litters}
          dogs={dogs}
          buyers={buyers}
          form={form}
          saving={saving}
          deleting={deleting}
          statusText={statusText}
          createMode={createMode}
          onClose={() => setDrawerOpen(false)}
          onSave={() => void savePuppy()}
          onDelete={() => void deletePuppy()}
          onFieldChange={updateField}
          onLitterChange={chooseLitter}
        />
      )}
    </AdminPageShell>
  );
}