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

type BuyerOption = { id: number; displayName?: string | null; email?: string | null };
type BreedingDog = { id: string; role?: string | null; displayName?: string | null };
type Litter = { id: number; displayName?: string | null; dam_id?: string | null; sire_id?: string | null };
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
};

type PuppyForm = Record<string, string>;

function emptyForm(): PuppyForm {
  return {
    call_name: "", puppy_name: "", name: "", status: "available", buyer_id: "", owner_email: "",
    litter_id: "", litter_name: "", dam_id: "", sire_id: "", sex: "", color: "", coat_type: "",
    coat: "", pattern: "", dob: "", registry: "", sire: "", dam: "", price: "", list_price: "",
    deposit: "", balance: "", photo_url: "", image_url: "", description: "", notes: "",
    birth_weight: "", current_weight: "", weight_unit: "", weight_date: "", microchip: "",
    registration_no: "", w_1: "", w_2: "", w_3: "", w_4: "", w_5: "", w_6: "", w_7: "", w_8: "",
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

async function fetchPuppies(accessToken: string) {
  const response = await fetch("/api/admin/portal/puppies", {
    headers: { Authorization: `Bearer ${accessToken}` },
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
  const damOptions = dogs.filter((dog) => String(dog.role || "").toLowerCase() === "dam");
  const sireOptions = dogs.filter((dog) => String(dog.role || "").toLowerCase() === "sire");
  const publicPriceHidden = shouldHidePublicPuppyPrice(form.status);
  const photoPreview = form.photo_url || form.image_url ? buildPuppyPhotoUrl(form.photo_url || form.image_url) : "";

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
      const payload = (await response.json()) as { puppyId?: number; error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not save the puppy.");
      await refresh(payload.puppyId ? String(payload.puppyId) : selectedId, false);
      setStatusText(createMode ? "Puppy created." : "Puppy updated.");
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
        <AdminPageHero eyebrow="Puppies" title="Manage puppy records with lineage context and public price controls." description="The puppy workspace is now built around the real operating model: one shared record controls lineage, buyer assignment, public visibility, internal pricing, and buyer-facing presentation." actions={<><button type="button" onClick={() => { setCreateMode(true); setForm(emptyForm()); setStatusText(""); }} className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(159,99,49,0.22)] transition hover:-translate-y-0.5 hover:brightness-105">Create Puppy</button><AdminHeroPrimaryAction href="/admin/portal/litters">Open Litters</AdminHeroPrimaryAction><AdminHeroSecondaryAction href="/admin/portal/puppy-financing">Open Puppy Financing</AdminHeroSecondaryAction></>} aside={<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1"><AdminInfoTile label="Public Pricing" value={publicPriceHidden ? "Hidden" : "Visible"} detail="Reserved and completed puppies keep internal pricing but hide it publicly." /><AdminInfoTile label="Lineage Coverage" value={`${litters.length} litters`} detail={`${damOptions.length} dams • ${sireOptions.length} sires`} /></div>} />

        <AdminMetricGrid>
          <AdminMetricCard label="Puppies" value={String(puppies.length)} detail="All shared puppy records powering admin, portal, and public surfaces." />
          <AdminMetricCard label="Available" value={String(puppies.filter((puppy) => available(puppy.status)).length)} detail="Puppies that can still display publicly with price if configured." accent="from-[#dfe8d8] via-[#c6d6ba] to-[#8aa07e]" />
          <AdminMetricCard label="Reserved / Completed" value={String(puppies.filter((puppy) => shouldHidePublicPuppyPrice(puppy.status)).length)} detail="Records that stay visible internally while public pricing is hidden." accent="from-[#e7ddd3] via-[#c9b39a] to-[#8f6f53]" />
          <AdminMetricCard label="Buyer Linked" value={String(puppies.filter((puppy) => puppy.buyer_id || puppy.owner_email).length)} detail="Puppies currently attached to a buyer record or buyer email." accent="from-[#f0ddc5] via-[#d9b78e] to-[#be8650]" />
        </AdminMetricGrid>

        <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.24fr)_430px]">
          <AdminPanel title="Puppy Directory" subtitle="Search by puppy, litter, lineage, buyer, color, or notes.">
            <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search puppies, litters, lineage, or buyer..." className="w-full rounded-[16px] border border-[#e6d7c7] bg-[#fffdfa] px-3.5 py-2.5 text-sm text-[#33251a] outline-none transition focus:border-[#caa074] focus:ring-2 focus:ring-[#ead7c0]" />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full rounded-[16px] border border-[#e6d7c7] bg-[#fffdfa] px-3.5 py-2.5 text-sm text-[#33251a] outline-none transition focus:border-[#caa074] focus:ring-2 focus:ring-[#ead7c0]"><option value="all">All statuses</option><option value="available">Available / Expected</option><option value="placed">Reserved / Placed</option><option value="reserved">Reserved</option><option value="completed">Completed</option></select>
            </div>
            {filteredPuppies.length ? <div className="overflow-hidden rounded-[24px] border border-[#ead9c7]"><table className="min-w-full divide-y divide-[#eee1d2] text-sm"><thead className="bg-[#faf3ea] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9c7043]"><tr><th className="px-4 py-3">Puppy</th><th className="px-4 py-3">Lineage</th><th className="px-4 py-3">Buyer</th><th className="px-4 py-3">Visibility</th></tr></thead><tbody className="divide-y divide-[#f1e6da] bg-white">{filteredPuppies.map((puppy) => <tr key={puppy.id} onClick={() => { setCreateMode(false); setSelectedId(String(puppy.id)); setStatusText(""); }} className={`cursor-pointer transition hover:bg-[#fffaf4] ${!createMode && String(puppy.id) === selectedId ? "bg-[#fff8ef]" : ""}`}><td className="px-4 py-3"><div className="font-semibold text-[#2f2218]">{puppyName(puppy)}</div><div className="mt-1 text-xs text-[#8a6a49]">{puppy.status || "pending"} • {puppy.color || "Color not set"}</div></td><td className="px-4 py-3 text-[#73583f]">{puppy.litter_name || "No litter"} • {puppy.dam || "No dam"} / {puppy.sire || "No sire"}</td><td className="px-4 py-3 text-[#73583f]">{puppy.buyerName || puppy.owner_email || "Not linked"}</td><td className="px-4 py-3"><div className="font-semibold text-[#2f2218]">{shouldHidePublicPuppyPrice(puppy.status) ? "Hidden publicly" : fmtMoney(num(puppy.price || puppy.list_price))}</div><div className="mt-1 text-xs text-[#8a6a49]">{fmtMoney(num(puppy.price || puppy.list_price))} internal</div></td></tr>)}</tbody></table></div> : <AdminEmptyState title="No puppies match the current filters" description="Adjust the filters or create a new puppy record to restart the workflow." />}
          </AdminPanel>

          <div className="space-y-5">
            <AdminPanel title={createMode ? "Create Puppy" : "Puppy Detail"} subtitle={createMode ? "Create a shared puppy record for admin, portal, and public use." : "Lineage, buyer assignment, pricing, media, and care details stay grouped together here."}>
              {statusText ? <div className="mb-4 rounded-[18px] border border-[#ead9c7] bg-[#fff9f2] px-4 py-3 text-sm font-semibold text-[#7a5a3a]">{statusText}</div> : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <AdminInfoTile label="Buyer" value={selectedBuyer?.displayName || form.owner_email || "Not linked"} detail={selectedBuyer?.email || "Buyer assignment and email stay visible here."} />
                <AdminInfoTile label="Public Price" value={publicPriceHidden ? "Hidden" : form.price || form.list_price ? fmtMoney(num(form.price || form.list_price)) : "Not set"} detail={publicPriceHidden ? "Reserved or completed puppies hide price on public listing surfaces." : "Available puppies can show price publicly."} />
                <AdminInfoTile label="Litter" value={selectedLitter?.displayName || form.litter_name || "Not linked"} detail={`${damOptions.find((dog) => String(dog.id) === form.dam_id)?.displayName || form.dam || "No dam"} / ${sireOptions.find((dog) => String(dog.id) === form.sire_id)?.displayName || form.sire || "No sire"}`} />
                <AdminInfoTile label="Created" value={selectedPuppy?.created_at ? fmtDate(selectedPuppy.created_at) : "Not saved yet"} detail={form.status || "pending"} />
              </div>

              <div className="mt-5 grid gap-4">
                <div className="grid gap-4 sm:grid-cols-3"><AdminTextInput label="Call Name" value={form.call_name} onChange={(value) => updateField("call_name", value)} placeholder="Call name" /><AdminTextInput label="Puppy Name" value={form.puppy_name} onChange={(value) => updateField("puppy_name", value)} placeholder="Puppy name" /><AdminTextInput label="Record Name" value={form.name} onChange={(value) => updateField("name", value)} placeholder="Record name" /></div>
                <div className="grid gap-4 sm:grid-cols-3"><AdminSelectInput label="Status" value={form.status} onChange={(value) => updateField("status", value)} options={[{ value: "available", label: "Available" }, { value: "expected", label: "Expected" }, { value: "reserved", label: "Reserved" }, { value: "matched", label: "Matched" }, { value: "sold", label: "Sold" }, { value: "adopted", label: "Adopted" }, { value: "completed", label: "Completed" }]} /><AdminSelectInput label="Buyer" value={form.buyer_id} onChange={(value) => updateField("buyer_id", value)} options={[{ value: "", label: "Unassigned" }, ...buyers.map((buyer) => ({ value: String(buyer.id), label: buyer.displayName || buyer.email || `Buyer #${buyer.id}` }))]} /><AdminTextInput label="Owner Email" value={form.owner_email} onChange={(value) => updateField("owner_email", value)} placeholder="Buyer email" /></div>
                <div className="grid gap-4 sm:grid-cols-3"><AdminSelectInput label="Litter" value={form.litter_id} onChange={chooseLitter} options={[{ value: "", label: "No litter" }, ...litters.map((litter) => ({ value: String(litter.id), label: litter.displayName || `Litter #${litter.id}` }))]} /><AdminSelectInput label="Dam" value={form.dam_id} onChange={(value) => updateField("dam_id", value)} options={[{ value: "", label: "No dam" }, ...damOptions.map((dog) => ({ value: String(dog.id), label: dog.displayName || `Dam #${dog.id}` }))]} /><AdminSelectInput label="Sire" value={form.sire_id} onChange={(value) => updateField("sire_id", value)} options={[{ value: "", label: "No sire" }, ...sireOptions.map((dog) => ({ value: String(dog.id), label: dog.displayName || `Sire #${dog.id}` }))]} /></div>
                <div className="grid gap-4 sm:grid-cols-4"><AdminTextInput label="Sex" value={form.sex} onChange={(value) => updateField("sex", value)} placeholder="Sex" /><AdminTextInput label="Color" value={form.color} onChange={(value) => updateField("color", value)} placeholder="Color" /><AdminTextInput label="Coat Type" value={form.coat_type} onChange={(value) => updateField("coat_type", value)} placeholder="Coat type" /><AdminDateInput label="DOB" value={form.dob} onChange={(value) => updateField("dob", value)} /></div>
                <div className="grid gap-4 sm:grid-cols-4"><AdminNumberInput label="Internal Sale Price" value={form.price} onChange={(value) => updateField("price", value)} step="0.01" /><AdminNumberInput label="List Price" value={form.list_price} onChange={(value) => updateField("list_price", value)} step="0.01" /><AdminNumberInput label="Deposit" value={form.deposit} onChange={(value) => updateField("deposit", value)} step="0.01" /><AdminNumberInput label="Balance" value={form.balance} onChange={(value) => updateField("balance", value)} step="0.01" /></div>
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
