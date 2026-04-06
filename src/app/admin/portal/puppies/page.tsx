"use client";

import Image from "next/image";
import React, { useEffect, useMemo, useState } from "react";
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

type PuppyForm = Record<string, string>;

function emptyForm(): PuppyForm {
  return {
    call_name: "", puppy_name: "", name: "", status: "available", buyer_id: "", owner_email: "",
    litter_id: "", litter_name: "", dam_id: "", sire_id: "", sex: "", color: "", coat_type: "",
    coat: "", pattern: "", dob: "", registry: "", sire: "", dam: "", price: "", list_price: "",
    deposit: "", balance: "", tail_dock_cost: "", dewclaw_cost: "", vaccination_cost: "",
    microchip_cost: "", registration_cost: "", other_vet_cost: "", total_medical_cost: "",
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
  const normalized = String(status || "").toLowerCase();
  return normalized.includes("available") || normalized.includes("expected");
}

function completed(status: string | null | undefined) {
  const normalized = String(status || "").toLowerCase();
  return ["reserved", "matched", "sold", "adopted", "completed"].some((value) => normalized.includes(value));
}

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");
  const parts = [line1, line2, locality].filter(Boolean);
  return parts.join(" | ") || "No buyer address on file";
}

function transportCostTotal(buyer: BuyerOption | null) {
  if (!buyer) return 0;
  return (
    num(buyer.delivery_fee) +
    num(buyer.expense_gas) +
    num(buyer.expense_hotel) +
    num(buyer.expense_tolls)
  );
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
    setSelectedId(nextCreateMode ? "" : preferredId && payload.puppies.some((puppy) => String(puppy.id) === preferredId) ? preferredId : String(payload.puppies[0]?.id || ""));
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
        setSelectedId(String(payload.puppies[0]?.id || ""));
      } finally {
        if (active) setLoadingData(false);
      }
    }
    void bootstrap();
    return () => {
      active = false;
    };
  }, [accessToken, isAdmin]);

  const filteredPuppies = useMemo(() => puppies.filter((puppy) => {
    if (statusFilter === "available" && !available(puppy.status)) return false;
    if (statusFilter === "placed" && !completed(puppy.status)) return false;
    if (statusFilter !== "all" && !["available", "placed"].includes(statusFilter) && String(puppy.status || "").toLowerCase() !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [puppyName(puppy), puppy.status, puppy.buyerName, puppy.litter_name, puppy.sire, puppy.dam, puppy.color, puppy.notes].map((value) => String(value || "").toLowerCase()).join(" ").includes(q);
  }), [puppies, search, statusFilter]);

  const selectedPuppy = createMode ? null : filteredPuppies.find((puppy) => String(puppy.id) === selectedId) || puppies.find((puppy) => String(puppy.id) === selectedId) || null;
  const selectedBuyer = buyers.find((buyer) => String(buyer.id) === form.buyer_id) || null;
  const selectedLitter = litters.find((litter) => String(litter.id) === form.litter_id) || null;
  const selectedTransportRequest = selectedPuppy?.transportRequest || null;
  const damOptions = dogs.filter((dog) => String(dog.role || "").toLowerCase() === "dam");
  const sireOptions = dogs.filter((dog) => String(dog.role || "").toLowerCase() === "sire");
  const publicPriceHidden = shouldHidePublicPuppyPrice(form.status);
  const photoPreview = form.photo_url || form.image_url ? buildPuppyPhotoUrl(form.photo_url || form.image_url) : "";
  const itemizedCostTotal = itemizedBreederCosts(form);
  const selectedTransportTotal = transportCostTotal(selectedBuyer);
  const buyerSummaryName = selectedBuyer?.displayName || selectedPuppy?.buyerName || form.owner_email || "Not linked";
  const litterSummaryName = selectedLitter?.displayName || form.litter_name || "Not linked";
  const damSummary = damOptions.find((dog) => String(dog.id) === form.dam_id)?.displayName || form.dam || "No dam";
  const sireSummary = sireOptions.find((dog) => String(dog.id) === form.sire_id)?.displayName || form.sire || "No sire";

  useEffect(() => {
    if (createMode) {
      setForm(emptyForm());
      return;
    }
    setForm(populateForm(selectedPuppy));
  }, [createMode, selectedPuppy]);

  useEffect(() => {
    if (createMode || !filteredPuppies.length || filteredPuppies.some((puppy) => String(puppy.id) === selectedId)) return;
    setSelectedId(String(filteredPuppies[0].id));
  }, [createMode, filteredPuppies, selectedId]);

  function updateField(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
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
    try {
      const response = await fetch("/api/admin/portal/puppies", {
        method: createMode ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ id: createMode ? undefined : selectedPuppy?.id, ...form }),
      });
      const payload = (await response.json()) as {
        puppyId?: number;
        error?: string;
        saved?: { litter_id?: number | null; price?: number | null; status?: string | null };
      };
      if (!response.ok) throw new Error(payload.error || "Could not save the puppy.");
      await refresh(payload.puppyId ? String(payload.puppyId) : selectedId, false);
      const litterText = payload.saved?.litter_id ? ` Linked to litter #${payload.saved.litter_id}.` : " No litter linked.";
      const priceText =
        payload.saved?.price != null ? ` Internal sale ${fmtMoney(num(payload.saved.price))}.` : "";
      setStatusText(`${createMode ? "Puppy created." : "Puppy updated."}${litterText}${priceText}`);
    } catch (error) {
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
    try {
      const response = await fetch("/api/admin/portal/puppies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ id: selectedPuppy.id }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not delete the puppy.");
      await refresh(undefined, false);
      setStatusText("Puppy deleted.");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not delete the puppy.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading || loadingData) return <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">Loading puppies...</div>;
  if (!user) return <AdminRestrictedState title="Sign in to access puppies." details="This workspace is reserved for the Southwest Virginia Chihuahua owner accounts." />;
  if (!isAdmin) return <AdminRestrictedState title="This puppy workspace is limited to approved owner accounts." details="Only the approved owner emails can manage puppy records, lineage, and public price rules." />;

  return (
    <AdminPageShell>
      <div className="space-y-5 pb-10">
        <AdminPageHero eyebrow="Puppies" title="Manage puppy records with lineage, buyer logistics, and internal cost tracking." description="Each puppy record now acts like an operations file: lineage, buyer assignment, transport planning, breeder-incurred costs, and public visibility all stay connected to one shared record." actions={<><button type="button" onClick={() => { setCreateMode(true); setForm(emptyForm()); setStatusText(""); }} className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(159,99,49,0.22)] transition hover:-translate-y-0.5 hover:brightness-105">Create Puppy</button><AdminHeroPrimaryAction href="/admin/portal/litters">Open Litters</AdminHeroPrimaryAction><AdminHeroSecondaryAction href="/admin/portal/users">Open Buyers</AdminHeroSecondaryAction></>} aside={<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1"><AdminInfoTile label="Public Pricing" value={publicPriceHidden ? "Hidden" : "Visible"} detail="Reserved and completed puppies keep internal pricing but hide it publicly." /><AdminInfoTile label="Lineage Coverage" value={`${litters.length} litters`} detail={`${damOptions.length} dams / ${sireOptions.length} sires`} /></div>} />

        <AdminMetricGrid>
          <AdminMetricCard label="Puppies" value={String(puppies.length)} detail="All shared puppy records powering admin, portal, and public surfaces." />
          <AdminMetricCard label="Available" value={String(puppies.filter((puppy) => available(puppy.status)).length)} detail="Puppies that can still display publicly with price if configured." accent="from-[#dfe8d8] via-[#c6d6ba] to-[#8aa07e]" />
          <AdminMetricCard label="Reserved / Completed" value={String(puppies.filter((puppy) => shouldHidePublicPuppyPrice(puppy.status)).length)} detail="Records that stay visible internally while public pricing is hidden." accent="from-[#e7ddd3] via-[#c9b39a] to-[#8f6f53]" />
          <AdminMetricCard label="Buyer Linked" value={String(puppies.filter((puppy) => puppy.buyer_id || puppy.owner_email).length)} detail="Puppies currently attached to a buyer record or buyer email." accent="from-[#f0ddc5] via-[#d9b78e] to-[#be8650]" />
        </AdminMetricGrid>

        <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.24fr)_430px]">
          <AdminPanel title="Puppy Directory" subtitle="Click any puppy to open buyer profile, transport details, lineage, pricing, and cost tracking.">
            <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search puppies, litters, lineage, or buyer..." className="w-full rounded-[16px] border border-[#e6d7c7] bg-[#fffdfa] px-3.5 py-2.5 text-sm text-[#33251a] outline-none transition focus:border-[#caa074] focus:ring-2 focus:ring-[#ead7c0]" />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full rounded-[16px] border border-[#e6d7c7] bg-[#fffdfa] px-3.5 py-2.5 text-sm text-[#33251a] outline-none transition focus:border-[#caa074] focus:ring-2 focus:ring-[#ead7c0]"><option value="all">All statuses</option><option value="available">Available / Expected</option><option value="placed">Reserved / Placed</option><option value="reserved">Reserved</option><option value="completed">Completed</option></select>
            </div>
            {filteredPuppies.length ? <div className="overflow-hidden rounded-[24px] border border-[#ead9c7]"><table className="min-w-full divide-y divide-[#eee1d2] text-sm"><thead className="bg-[#faf3ea] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9c7043]"><tr><th className="px-4 py-3">Puppy</th><th className="px-4 py-3">Lineage</th><th className="px-4 py-3">Buyer</th><th className="px-4 py-3">Internal</th><th className="px-4 py-3 text-right">Open</th></tr></thead><tbody className="divide-y divide-[#f1e6da] bg-white">{filteredPuppies.map((puppy) => <tr key={puppy.id} onClick={() => { setCreateMode(false); setSelectedId(String(puppy.id)); setStatusText(""); }} className={`cursor-pointer transition hover:bg-[#fffaf4] ${!createMode && String(puppy.id) === selectedId ? "bg-[#fff8ef]" : ""}`}><td className="px-4 py-3"><div className="font-semibold text-[#2f2218]">{puppyName(puppy)}</div><div className="mt-1 text-xs text-[#8a6a49]">{puppy.status || "pending"} / {puppy.color || "Color not set"}</div></td><td className="px-4 py-3 text-[#73583f]"><div>{puppy.litter_name || "No litter"}</div><div className="mt-1 text-xs text-[#8a6a49]">{puppy.dam || "No dam"} / {puppy.sire || "No sire"}</div></td><td className="px-4 py-3 text-[#73583f]"><div>{puppy.buyerName || puppy.owner_email || "Not linked"}</div><div className="mt-1 text-xs text-[#8a6a49]">{puppy.transportRequest?.request_type ? `Transport: ${puppy.transportRequest.request_type}` : "No transport request"}</div></td><td className="px-4 py-3"><div className="font-semibold text-[#2f2218]">{formatMoneyOrDash(puppy.price)}</div><div className="mt-1 text-xs text-[#8a6a49]">Public: {shouldHidePublicPuppyPrice(puppy.status) ? "Hidden" : formatMoneyOrDash(puppy.price || puppy.list_price)}</div></td><td className="px-4 py-3 text-right"><span className="inline-flex rounded-full border border-[#e4d2be] bg-[#fff7ef] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f6843]">Open</span></td></tr>)}</tbody></table></div> : <AdminEmptyState title="No puppies match the current filters" description="Adjust the filters or create a new puppy record to restart the workflow." />}
          </AdminPanel>

          <div className="space-y-5">
            <AdminPanel title={createMode ? "Create Puppy" : "Puppy Detail"} subtitle={createMode ? "Create a shared puppy record for admin, portal, and public use." : "Buyer profile, transport planning, pricing, media, lineage, and cost tracking stay grouped together here."}>
              {statusText ? <div className="mb-4 rounded-[18px] border border-[#ead9c7] bg-[#fff9f2] px-4 py-3 text-sm font-semibold text-[#7a5a3a]">{statusText}</div> : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <AdminInfoTile label="Buyer" value={buyerSummaryName} detail={selectedBuyer?.email || "Buyer assignment and contact stay visible here."} />
                <AdminInfoTile label="Public Price" value={publicPriceHidden ? "Hidden" : hasValue(form.price || form.list_price) ? fmtMoney(num(form.price || form.list_price)) : "Not set"} detail={publicPriceHidden ? "Reserved and completed puppies hide price on public listing surfaces." : "Available puppies can show price publicly."} />
                <AdminInfoTile label="Litter" value={litterSummaryName} detail={`${damSummary} / ${sireSummary}`} />
                <AdminInfoTile label="Created" value={selectedPuppy?.created_at ? fmtDate(selectedPuppy.created_at) : "Not saved yet"} detail={form.status || "pending"} />
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <div className="rounded-[22px] border border-[#ead9c7] bg-[#fffaf4] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a17345]">Buyer Profile</div>
                      <p className="mt-1 text-sm text-[#6f5339]">Contact and assignment details tied to this puppy record.</p>
                    </div>
                    <Link href="/admin/portal/users" className="rounded-full border border-[#e4d2be] bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6d4e35] transition hover:border-[#d4b48b]">Buyers</Link>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <AdminInfoTile label="Buyer Name" value={buyerSummaryName} detail={selectedBuyer?.status || "No buyer status on file"} />
                    <AdminInfoTile label="Email / Phone" value={selectedBuyer?.email || selectedPuppy?.buyerEmail || form.owner_email || "Not set"} detail={selectedBuyer?.phone || "No phone on file"} />
                    <AdminInfoTile label="Address" value={buyerAddress(selectedBuyer)} detail={selectedBuyer?.city || selectedBuyer?.state ? "Shipping and go-home reference" : "No saved buyer address"} />
                    <AdminInfoTile label="Buyer Contract" value={selectedBuyer ? formatMoneyOrDash(selectedBuyer.sale_price) : "Not linked"} detail={selectedBuyer ? `Buyer deposit ${formatMoneyOrDash(selectedBuyer.deposit_amount)}` : "Link a buyer to surface contract totals"} />
                  </div>
                </div>

                <div className="rounded-[22px] border border-[#ead9c7] bg-[#fffaf4] p-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a17345]">Transportation</div>
                    <p className="mt-1 text-sm text-[#6f5339]">Buyer delivery planning, transport expenses, and the latest pickup request.</p>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <AdminInfoTile label="Transport Mode" value={formatTextOrDash(selectedBuyer?.delivery_option, "Not scheduled")} detail={formatDateOrDash(selectedBuyer?.delivery_date)} />
                    <AdminInfoTile label="Location" value={formatTextOrDash(selectedBuyer?.delivery_location, "No location set")} detail={formatMiles(selectedBuyer?.delivery_miles)} />
                    <AdminInfoTile label="Transport Fees" value={formatMoneyOrDash(selectedBuyer?.delivery_fee)} detail={`Total logged transport cost ${fmtMoney(selectedTransportTotal)}`} />
                    <AdminInfoTile label="Latest Request" value={selectedTransportRequest?.request_type || "No request logged"} detail={selectedTransportRequest ? `${formatDateOrDash(selectedTransportRequest.request_date)} / ${formatTextOrDash(selectedTransportRequest.status, "pending")}` : "No pickup request linked yet"} />
                  </div>
                  <div className="mt-4 overflow-hidden rounded-[18px] border border-[#ead9c7] bg-white">
                    <div className="grid grid-cols-2 gap-px bg-[#ead9c7] text-sm text-[#4c3725] sm:grid-cols-4">
                      <div className="bg-white px-3 py-3"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a17345]">Gas</div><div className="mt-1 font-semibold">{formatMoneyOrDash(selectedBuyer?.expense_gas)}</div></div>
                      <div className="bg-white px-3 py-3"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a17345]">Hotel</div><div className="mt-1 font-semibold">{formatMoneyOrDash(selectedBuyer?.expense_hotel)}</div></div>
                      <div className="bg-white px-3 py-3"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a17345]">Tolls</div><div className="mt-1 font-semibold">{formatMoneyOrDash(selectedBuyer?.expense_tolls)}</div></div>
                      <div className="bg-white px-3 py-3"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a17345]">Misc</div><div className="mt-1 font-semibold">{formatTextOrDash(selectedBuyer?.expense_misc, "None logged")}</div></div>
                    </div>
                  </div>
                  {selectedTransportRequest ? <div className="mt-4 rounded-[18px] border border-[#ead9c7] bg-white px-4 py-3"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a17345]">Request Detail</div><div className="mt-2 text-sm font-semibold text-[#3e2d20]">{formatTextOrDash(selectedTransportRequest.location_text, "No location text")}</div><div className="mt-1 text-sm text-[#6f5339]">{formatTextOrDash(selectedTransportRequest.address_text, "No address logged")}</div><div className="mt-2 text-xs text-[#8a6a49]">{formatMiles(selectedTransportRequest.miles)} / {formatTextOrDash(selectedTransportRequest.notes, "No request notes")}</div></div> : null}
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <div className="grid gap-4 sm:grid-cols-3"><AdminTextInput label="Call Name" value={form.call_name} onChange={(value) => updateField("call_name", value)} placeholder="Call name" /><AdminTextInput label="Puppy Name" value={form.puppy_name} onChange={(value) => updateField("puppy_name", value)} placeholder="Puppy name" /><AdminTextInput label="Record Name" value={form.name} onChange={(value) => updateField("name", value)} placeholder="Record name" /></div>
                <div className="grid gap-4 sm:grid-cols-3"><AdminSelectInput label="Status" value={form.status} onChange={(value) => updateField("status", value)} options={[{ value: "available", label: "Available" }, { value: "expected", label: "Expected" }, { value: "reserved", label: "Reserved" }, { value: "matched", label: "Matched" }, { value: "sold", label: "Sold" }, { value: "adopted", label: "Adopted" }, { value: "completed", label: "Completed" }]} /><AdminSelectInput label="Buyer" value={form.buyer_id} onChange={(value) => updateField("buyer_id", value)} options={[{ value: "", label: "Unassigned" }, ...buyers.map((buyer) => ({ value: String(buyer.id), label: buyer.displayName || buyer.email || `Buyer #${buyer.id}` }))]} /><AdminTextInput label="Owner Email" value={form.owner_email} onChange={(value) => updateField("owner_email", value)} placeholder="Buyer email" /></div>
                <div className="grid gap-4 sm:grid-cols-3"><AdminSelectInput label="Litter" value={form.litter_id} onChange={chooseLitter} options={[{ value: "", label: "No litter" }, ...litters.map((litter) => ({ value: String(litter.id), label: litter.displayName || `Litter #${litter.id}` }))]} /><AdminSelectInput label="Dam" value={form.dam_id} onChange={(value) => updateField("dam_id", value)} options={[{ value: "", label: "No dam" }, ...damOptions.map((dog) => ({ value: String(dog.id), label: dog.displayName || `Dam #${dog.id}` }))]} /><AdminSelectInput label="Sire" value={form.sire_id} onChange={(value) => updateField("sire_id", value)} options={[{ value: "", label: "No sire" }, ...sireOptions.map((dog) => ({ value: String(dog.id), label: dog.displayName || `Sire #${dog.id}` }))]} /></div>
                <div className="grid gap-4 sm:grid-cols-4"><AdminTextInput label="Sex" value={form.sex} onChange={(value) => updateField("sex", value)} placeholder="Sex" /><AdminTextInput label="Color" value={form.color} onChange={(value) => updateField("color", value)} placeholder="Color" /><AdminTextInput label="Coat Type" value={form.coat_type} onChange={(value) => updateField("coat_type", value)} placeholder="Coat type" /><AdminDateInput label="DOB" value={form.dob} onChange={(value) => updateField("dob", value)} /></div>
                <div className="grid gap-4 sm:grid-cols-4"><AdminNumberInput label="Internal Sale Price" value={form.price} onChange={(value) => updateField("price", value)} step="0.01" /><AdminNumberInput label="List Price" value={form.list_price} onChange={(value) => updateField("list_price", value)} step="0.01" /><AdminNumberInput label="Deposit" value={form.deposit} onChange={(value) => updateField("deposit", value)} step="0.01" /><AdminNumberInput label="Balance" value={form.balance} onChange={(value) => updateField("balance", value)} step="0.01" /></div>
                <div className="rounded-[22px] border border-[#ead9c7] bg-[#fffaf4] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a17345]">Breeder Cost Tracking</div><p className="mt-1 text-sm text-[#6f5339]">Record direct costs tied to this puppy so operations and litter reporting stay honest.</p></div><div className="grid gap-2 text-right text-sm text-[#5f4633]"><div><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a17345]">Itemized Costs</span><div className="mt-1 font-semibold">{fmtMoney(itemizedCostTotal)}</div></div><div><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a17345]">Medical Total</span><div className="mt-1 font-semibold">{formatMoneyOrDash(form.total_medical_cost)}</div></div></div></div><div className="mt-4 grid gap-4 sm:grid-cols-3"><AdminNumberInput label="Vaccination Cost" value={form.vaccination_cost} onChange={(value) => updateField("vaccination_cost", value)} step="0.01" /><AdminNumberInput label="Medical Total" value={form.total_medical_cost} onChange={(value) => updateField("total_medical_cost", value)} step="0.01" /><AdminNumberInput label="Other Vet Cost" value={form.other_vet_cost} onChange={(value) => updateField("other_vet_cost", value)} step="0.01" /><AdminNumberInput label="Microchip Cost" value={form.microchip_cost} onChange={(value) => updateField("microchip_cost", value)} step="0.01" /><AdminNumberInput label="Registration Cost" value={form.registration_cost} onChange={(value) => updateField("registration_cost", value)} step="0.01" /><AdminNumberInput label="Tail Dock Cost" value={form.tail_dock_cost} onChange={(value) => updateField("tail_dock_cost", value)} step="0.01" /><AdminNumberInput label="Dewclaw Cost" value={form.dewclaw_cost} onChange={(value) => updateField("dewclaw_cost", value)} step="0.01" /></div></div>
                <div className="grid gap-4 sm:grid-cols-2"><AdminTextInput label="Photo URL" value={form.photo_url} onChange={(value) => updateField("photo_url", value)} placeholder="Public photo URL" /><AdminTextInput label="Image Path / URL" value={form.image_url} onChange={(value) => updateField("image_url", value)} placeholder="Storage path or URL" /></div>
                <div className="grid gap-4 sm:grid-cols-2"><AdminTextAreaInput label="Description" value={form.description} onChange={(value) => updateField("description", value)} rows={5} placeholder="Public listing description" /><AdminTextAreaInput label="Notes" value={form.notes} onChange={(value) => updateField("notes", value)} rows={5} placeholder="Internal notes" /></div>
                <div className="grid gap-4 sm:grid-cols-4"><AdminNumberInput label="Birth Weight" value={form.birth_weight} onChange={(value) => updateField("birth_weight", value)} step="0.01" /><AdminNumberInput label="Current Weight" value={form.current_weight} onChange={(value) => updateField("current_weight", value)} step="0.01" /><AdminTextInput label="Weight Unit" value={form.weight_unit} onChange={(value) => updateField("weight_unit", value)} placeholder="oz" /><AdminDateInput label="Weight Date" value={form.weight_date} onChange={(value) => updateField("weight_date", value)} /></div>
                <div className="grid gap-4 sm:grid-cols-4"><AdminTextInput label="Registry" value={form.registry} onChange={(value) => updateField("registry", value)} placeholder="Registry" /><AdminTextInput label="Microchip" value={form.microchip} onChange={(value) => updateField("microchip", value)} placeholder="Microchip" /><AdminTextInput label="Registration No." value={form.registration_no} onChange={(value) => updateField("registration_no", value)} placeholder="Registration no." /><AdminTextInput label="Pattern" value={form.pattern} onChange={(value) => updateField("pattern", value)} placeholder="Pattern" /></div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => void savePuppy()} disabled={saving} className="rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(159,99,49,0.22)] transition hover:brightness-105 disabled:opacity-60">{saving ? "Saving..." : createMode ? "Create Puppy" : "Save Puppy"}</button>{!createMode ? <button type="button" onClick={() => void deletePuppy()} disabled={deleting} className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 disabled:opacity-60">{deleting ? "Deleting..." : "Delete Puppy"}</button> : null}</div>
            </AdminPanel>

            <AdminPanel title="Public & Portal Visibility" subtitle="This gives the admin a direct read on what the public can see versus what stays internal.">
              <div className="overflow-hidden rounded-[22px] border border-[#ead9c7] bg-[#fffaf4]">
                {photoPreview ? (
                  <div className="relative h-56 w-full">
                    <Image
                      src={photoPreview}
                      alt={puppyName(selectedPuppy)}
                      fill
                      className="object-cover"
                      sizes="420px"
                    />
                  </div>
                ) : (
                  <div className="flex h-56 items-center justify-center text-center text-sm text-[#8a6a49]">No photo preview available yet.</div>
                )}
              </div>
              <div className="mt-4 grid gap-3">
                <AdminInfoTile label="Public Listing Price" value={publicPriceHidden ? "Hidden" : form.price || form.list_price ? fmtMoney(num(form.price || form.list_price)) : "Not set"} detail={publicPriceHidden ? "Reserved and completed puppy records still show internally, but public listing price is hidden." : "Available puppy pricing can still show publicly."} />
                <AdminInfoTile label="Internal Sale Value" value={form.price ? fmtMoney(num(form.price)) : "Not set"} detail="Admin reporting and lineage revenue continue using the internal sale value." />
              </div>
              <div className="mt-4 flex flex-wrap gap-3"><Link href="/puppies" className="rounded-2xl border border-[#e4d2be] bg-white px-4 py-3 text-sm font-semibold text-[#5d4330] transition hover:border-[#d4b48b]">Open Public Puppies</Link><Link href="/portal/available-puppies" className="rounded-2xl border border-[#e4d2be] bg-white px-4 py-3 text-sm font-semibold text-[#5d4330] transition hover:border-[#d4b48b]">Open Portal Listings</Link></div>
            </AdminPanel>
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}
