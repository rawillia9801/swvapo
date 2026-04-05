"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import {
  AdminEmptyState,
  AdminHeroPrimaryAction,
  AdminHeroSecondaryAction,
  AdminInfoTile,
  AdminListCard,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPageHero,
  AdminPageShell,
  AdminPanel,
  AdminRestrictedState,
  adminStatusBadge,
} from "@/components/admin/luxury-admin-shell";
import { buildPuppyPhotoUrl, fmtDate, fmtMoney, sb } from "@/lib/utils";
import { isPortalAdminEmail } from "@/lib/portal-admin";

type BuyerOption = {
  id: number;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  status?: string | null;
  displayName?: string | null;
};

type PuppyCard = {
  id: number;
  buyer_id?: number | null;
  buyerName?: string | null;
  buyerEmail?: string | null;
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
};

type PuppyForm = {
  call_name: string;
  puppy_name: string;
  name: string;
  status: string;
  buyer_id: string;
  owner_email: string;
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
  deposit: string;
  balance: string;
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

type StatusView = "all" | "available" | "linked" | "placed";

function puppyDisplayName(puppy: PuppyCard | null) {
  return puppy?.call_name || puppy?.puppy_name || puppy?.name || "Unnamed Puppy";
}

function buyerDisplayName(buyer: BuyerOption | null | undefined) {
  return (
    buyer?.displayName ||
    buyer?.full_name ||
    buyer?.name ||
    buyer?.email ||
    (buyer?.id ? `Buyer #${buyer.id}` : "Unassigned")
  );
}

function emptyForm(): PuppyForm {
  return {
    call_name: "",
    puppy_name: "",
    name: "",
    status: "available",
    buyer_id: "",
    owner_email: "",
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
    deposit: "",
    balance: "",
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

function isAvailableStatus(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized.includes("available") || normalized.includes("expect");
}

function isPlacedStatus(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();
  return (
    normalized.includes("matched") ||
    normalized.includes("sold") ||
    normalized.includes("adopted") ||
    normalized.includes("completed")
  );
}

function resolvePhotoUrl(form: PuppyForm) {
  const direct = form.photo_url.trim() || form.image_url.trim();
  if (!direct) return "";
  return direct.startsWith("http") ? direct : buildPuppyPhotoUrl(direct);
}

function populateForm(puppy: PuppyCard | null): PuppyForm {
  if (!puppy) return emptyForm();

  return {
    call_name: String(puppy.call_name || ""),
    puppy_name: String(puppy.puppy_name || ""),
    name: String(puppy.name || ""),
    status: String(puppy.status || "available"),
    buyer_id: puppy.buyer_id ? String(puppy.buyer_id) : "",
    owner_email: String(puppy.owner_email || ""),
    sex: String(puppy.sex || ""),
    color: String(puppy.color || ""),
    coat_type: String(puppy.coat_type || ""),
    coat: String(puppy.coat || ""),
    pattern: String(puppy.pattern || ""),
    dob: String(puppy.dob || ""),
    registry: String(puppy.registry || ""),
    sire: String(puppy.sire || ""),
    dam: String(puppy.dam || ""),
    price: puppy.price !== null && puppy.price !== undefined ? String(puppy.price) : "",
    deposit: puppy.deposit !== null && puppy.deposit !== undefined ? String(puppy.deposit) : "",
    balance: puppy.balance !== null && puppy.balance !== undefined ? String(puppy.balance) : "",
    photo_url: String(puppy.photo_url || ""),
    image_url: String(puppy.image_url || ""),
    description: String(puppy.description || ""),
    notes: String(puppy.notes || ""),
    birth_weight: puppy.birth_weight !== null && puppy.birth_weight !== undefined ? String(puppy.birth_weight) : "",
    current_weight: puppy.current_weight !== null && puppy.current_weight !== undefined ? String(puppy.current_weight) : "",
    weight_unit: String(puppy.weight_unit || ""),
    weight_date: String(puppy.weight_date || ""),
    microchip: String(puppy.microchip || ""),
    registration_no: String(puppy.registration_no || ""),
    w_1: puppy.w_1 !== null && puppy.w_1 !== undefined ? String(puppy.w_1) : "",
    w_2: puppy.w_2 !== null && puppy.w_2 !== undefined ? String(puppy.w_2) : "",
    w_3: puppy.w_3 !== null && puppy.w_3 !== undefined ? String(puppy.w_3) : "",
    w_4: puppy.w_4 !== null && puppy.w_4 !== undefined ? String(puppy.w_4) : "",
    w_5: puppy.w_5 !== null && puppy.w_5 !== undefined ? String(puppy.w_5) : "",
    w_6: puppy.w_6 !== null && puppy.w_6 !== undefined ? String(puppy.w_6) : "",
    w_7: puppy.w_7 !== null && puppy.w_7 !== undefined ? String(puppy.w_7) : "",
    w_8: puppy.w_8 !== null && puppy.w_8 !== undefined ? String(puppy.w_8) : "",
  };
}

async function fetchAdminPuppies(accessToken: string) {
  if (!accessToken) {
    return { puppies: [] as PuppyCard[], buyers: [] as BuyerOption[] };
  }

  const response = await fetch("/api/admin/portal/puppies", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return { puppies: [] as PuppyCard[], buyers: [] as BuyerOption[] };
  }

  const payload = (await response.json()) as { puppies?: PuppyCard[]; buyers?: BuyerOption[] };
  return {
    puppies: Array.isArray(payload.puppies) ? payload.puppies : [],
    buyers: Array.isArray(payload.buyers) ? payload.buyers : [],
  };
}

export default function AdminPortalPuppiesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [search, setSearch] = useState("");
  const [statusView, setStatusView] = useState<StatusView>("all");
  const [puppies, setPuppies] = useState<PuppyCard[]>([]);
  const [buyers, setBuyers] = useState<BuyerOption[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [form, setForm] = useState<PuppyForm>(emptyForm());

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const {
          data: { session },
        } = await sb.auth.getSession();

        if (!mounted) return;
        const currentUser = session?.user ?? null;
        const token = session?.access_token || "";
        setUser(currentUser);
        setAccessToken(token);

        if (currentUser && isPortalAdminEmail(currentUser.email)) {
          const payload = await fetchAdminPuppies(token);
          if (!mounted) return;
          setPuppies(payload.puppies);
          setBuyers(payload.buyers);
          setSelectedKey(payload.puppies[0] ? String(payload.puppies[0].id) : "");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void bootstrap();

    const { data: authListener } = sb.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      const currentUser = session?.user ?? null;
      const token = session?.access_token || "";
      setUser(currentUser);
      setAccessToken(token);

      if (currentUser && isPortalAdminEmail(currentUser.email)) {
        const payload = await fetchAdminPuppies(token);
        if (!mounted) return;
        setPuppies(payload.puppies);
        setBuyers(payload.buyers);
        setSelectedKey((prev) =>
          payload.puppies.find((puppy) => String(puppy.id) === prev)?.id
            ? prev
            : String(payload.puppies[0]?.id || "")
        );
      } else {
        setPuppies([]);
        setBuyers([]);
        setSelectedKey("");
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const filteredPuppies = useMemo(() => {
    const q = search.trim().toLowerCase();

    return puppies.filter((puppy) => {
      if (statusView === "available" && !isAvailableStatus(puppy.status)) return false;
      if (statusView === "linked" && !puppy.buyer_id && !puppy.owner_email) return false;
      if (statusView === "placed" && !isPlacedStatus(puppy.status)) return false;

      if (!q) return true;

      return [
        puppyDisplayName(puppy),
        puppy.status,
        puppy.buyerName,
        puppy.buyerEmail,
        puppy.owner_email,
        puppy.sex,
        puppy.color,
        puppy.coat_type,
        puppy.description,
        puppy.notes,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(q);
    });
  }, [puppies, search, statusView]);

  const selectedPuppy = isCreateMode
    ? null
    : filteredPuppies.find((puppy) => String(puppy.id) === selectedKey) ||
      puppies.find((puppy) => String(puppy.id) === selectedKey) ||
      null;

  useEffect(() => {
    if (isCreateMode) return;
    if (!filteredPuppies.length) {
      setSelectedKey("");
      return;
    }
    if (!filteredPuppies.some((puppy) => String(puppy.id) === selectedKey)) {
      setSelectedKey(String(filteredPuppies[0].id));
    }
  }, [filteredPuppies, isCreateMode, selectedKey]);

  useEffect(() => {
    if (isCreateMode) {
      setForm(emptyForm());
      setStatusText("");
      return;
    }

    if (!selectedPuppy) return;
    setForm(populateForm(selectedPuppy));
    setStatusText("");
  }, [isCreateMode, selectedPuppy]);

  const buyerMap = useMemo(() => {
    const map = new Map<number, BuyerOption>();
    buyers.forEach((buyer) => map.set(Number(buyer.id), buyer));
    return map;
  }, [buyers]);

  const selectedBuyer =
    form.buyer_id && buyerMap.has(Number(form.buyer_id))
      ? buyerMap.get(Number(form.buyer_id)) || null
      : null;

  const photoPreviewUrl = useMemo(() => resolvePhotoUrl(form), [form]);
  const availableCount = puppies.filter((puppy) => isAvailableStatus(puppy.status)).length;
  const linkedCount = puppies.filter((puppy) => puppy.buyer_id || puppy.owner_email).length;
  const placedCount = puppies.filter((puppy) => isPlacedStatus(puppy.status)).length;

  async function refreshPuppies(nextSelectedId?: number | string | null, nextCreateMode = false) {
    const payload = await fetchAdminPuppies(accessToken);
    setPuppies(payload.puppies);
    setBuyers(payload.buyers);
    setIsCreateMode(nextCreateMode);
    setSelectedKey(
      nextCreateMode
        ? ""
        : String(
            nextSelectedId ||
              payload.puppies.find((puppy) => String(puppy.id) === selectedKey)?.id ||
              payload.puppies[0]?.id ||
              ""
          )
    );
  }

  function startCreateMode() {
    setIsCreateMode(true);
    setSelectedKey("");
    setForm(emptyForm());
    setStatusText("");
  }

  function selectPuppy(puppyId: number) {
    setIsCreateMode(false);
    setSelectedKey(String(puppyId));
    setStatusText("");
  }

  async function savePuppy() {
    setSaving(true);
    setStatusText("");

    try {
      const method = isCreateMode ? "POST" : "PATCH";
      const body = isCreateMode
        ? { ...form }
        : {
            id: selectedPuppy?.id,
            ...form,
          };

      const response = await fetch("/api/admin/portal/puppies", {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as { puppyId?: number; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not save the puppy record.");
      }

      await refreshPuppies(payload.puppyId || selectedPuppy?.id || null, false);
      setStatusText(isCreateMode ? "Puppy record created." : "Puppy record updated.");
    } catch (error) {
      console.error(error);
      setStatusText(error instanceof Error ? error.message : "Could not save the puppy record.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePuppy() {
    if (!selectedPuppy?.id) return;
    const confirmed = window.confirm(
      `Delete ${puppyDisplayName(selectedPuppy)}? This removes the puppy record from the shared puppies table.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setStatusText("");

    try {
      const response = await fetch("/api/admin/portal/puppies", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ id: selectedPuppy.id }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not delete the puppy record.");
      }

      await refreshPuppies(null, false);
      setStatusText("Puppy record deleted.");
    } catch (error) {
      console.error(error);
      setStatusText(error instanceof Error ? error.message : "Could not delete the puppy record.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">
        Loading puppies...
      </div>
    );
  }

  if (!user) {
    return (
      <AdminRestrictedState
        title="Sign in to access puppy records."
        details="This page is reserved for the Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!isPortalAdminEmail(user.email)) {
    return (
      <AdminRestrictedState
        title="This puppy workspace is limited to approved owner accounts."
        details="Only the approved owner emails can create, assign, and update puppy records here."
      />
    );
  }

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-12">
        <AdminPageHero
          eyebrow="Puppies"
          title="Create and manage the puppy records used by both the website listings and the buyer portal."
          description="This workspace updates the shared puppies table directly, so names, photos, pricing, buyer assignment, and portal matching stay in one place instead of being split across different screens."
          actions={
            <>
              <button
                type="button"
                onClick={startCreateMode}
                className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(181,117,47,0.26)] transition hover:-translate-y-0.5 hover:brightness-105"
              >
                Create Puppy
              </button>
              <AdminHeroPrimaryAction href="/admin/portal/puppy-payments">Open Puppy Payments</AdminHeroPrimaryAction>
              <AdminHeroSecondaryAction href="/admin/portal/users">Open Buyers</AdminHeroSecondaryAction>
            </>
          }
          aside={
            <div className="space-y-4">
              <AdminInfoTile
                label="Shared Source"
                value="Puppies"
                detail="Website listings and portal assignment both read from this same record."
              />
              <AdminInfoTile
                label="Buyer Linked"
                value={String(linkedCount)}
                detail="Puppy records currently linked to a buyer or owner email."
              />
            </div>
          }
        />

        <AdminMetricGrid>
          <AdminMetricCard label="Puppy Records" value={String(puppies.length)} detail="All puppy records currently stored in the shared puppies table." />
          <AdminMetricCard label="Available / Upcoming" value={String(availableCount)} detail="Puppy records currently marked available or expected." accent="from-[#dce9d6] via-[#b6cfaa] to-[#7e9c6f]" />
          <AdminMetricCard label="Buyer Linked" value={String(linkedCount)} detail="Puppies already assigned to a buyer record or owner email." accent="from-[#ece3d5] via-[#d7c1a3] to-[#b18d62]" />
          <AdminMetricCard label="Placed / Completed" value={String(placedCount)} detail="Puppies marked matched, sold, adopted, or completed." accent="from-[#f0dcc1] via-[#ddb68c] to-[#c98743]" />
        </AdminMetricGrid>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
          <AdminPanel title="Puppy Cards" subtitle="Search by puppy name, status, buyer, sex, color, or notes.">
            <div className="mb-4 grid grid-cols-4 gap-2">
              <StatusFilterButton active={statusView === "all"} label={`All (${puppies.length})`} onClick={() => setStatusView("all")} />
              <StatusFilterButton active={statusView === "available"} label={`Open (${availableCount})`} onClick={() => setStatusView("available")} />
              <StatusFilterButton active={statusView === "linked"} label={`Linked (${linkedCount})`} onClick={() => setStatusView("linked")} />
              <StatusFilterButton active={statusView === "placed"} label={`Placed (${placedCount})`} onClick={() => setStatusView("placed")} />
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search puppies..."
              className="w-full rounded-[20px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]"
            />

            <div className="mt-4 space-y-3">
              <AdminListCard
                selected={isCreateMode}
                onClick={startCreateMode}
                title="Create New Puppy"
                subtitle="Start a fresh puppy record for the website and portal."
                meta="Add the puppy once here, then use this same record everywhere else."
              />

              {filteredPuppies.length ? (
                filteredPuppies.map((puppy) => (
                  <AdminListCard
                    key={puppy.id}
                    selected={!isCreateMode && String(puppy.id) === selectedKey}
                    onClick={() => selectPuppy(puppy.id)}
                    title={puppyDisplayName(puppy)}
                    subtitle={puppy.buyerName || puppy.owner_email || "Not linked to a buyer yet"}
                    meta={`${puppy.status || "pending"} - ${puppy.price !== null && puppy.price !== undefined ? fmtMoney(puppy.price) : "No price"}`}
                    badge={
                      <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(puppy.status)}`}>
                        {puppy.status || "pending"}
                      </span>
                    }
                  />
                ))
              ) : (
                <AdminEmptyState title="No puppy records matched your search" description="Try a different puppy name, buyer, status, or color term." />
              )}
            </div>
          </AdminPanel>

          <div className="space-y-6">
            <AdminPanel
              title={isCreateMode ? "New Puppy Record" : "Puppy Snapshot"}
              subtitle={isCreateMode ? "Use one record to control the puppy's website listing details and buyer portal linkage." : "Review the selected puppy, current buyer linkage, pricing, and listing readiness."}
            >
              {statusText ? (
                <div className="mb-4 rounded-[18px] border border-[#ead9c7] bg-[#fff9f2] px-4 py-3 text-sm font-semibold text-[#7a5a3a]">
                  {statusText}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <AdminInfoTile label="Puppy" value={isCreateMode ? "New Record" : puppyDisplayName(selectedPuppy)} />
                <AdminInfoTile label="Buyer" value={selectedBuyer ? buyerDisplayName(selectedBuyer) : form.owner_email || "Not linked"} />
                <AdminInfoTile label="Status" value={form.status || "pending"} />
                <AdminInfoTile label="Price" value={form.price ? fmtMoney(form.price) : "Not set"} />
                <AdminInfoTile label="Created" value={!isCreateMode && selectedPuppy?.created_at ? fmtDate(selectedPuppy.created_at) : "Not saved yet"} />
              </div>
            </AdminPanel>

            <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.18fr)_420px]">
              <div className="space-y-6">
                <AdminPanel title="Core Puppy Record" subtitle="These fields control how the puppy appears across the website, available puppy listings, and buyer portal matching.">
                  <div className="grid gap-4 md:grid-cols-3">
                    <AdminField label="Call Name" value={form.call_name} onChange={(value) => setForm((prev) => ({ ...prev, call_name: value }))} />
                    <AdminField label="Puppy Name" value={form.puppy_name} onChange={(value) => setForm((prev) => ({ ...prev, puppy_name: value }))} />
                    <AdminField label="Record Name" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} />
                    <AdminSelect label="Status" value={form.status} onChange={(value) => setForm((prev) => ({ ...prev, status: value }))} options={[{ value: "available", label: "Available" }, { value: "expected", label: "Expected" }, { value: "reserved", label: "Reserved" }, { value: "on hold", label: "On Hold" }, { value: "matched", label: "Matched" }, { value: "sold", label: "Sold" }, { value: "adopted", label: "Adopted" }, { value: "completed", label: "Completed" }]} />
                    <AdminSelect
                      label="Buyer Assignment"
                      value={form.buyer_id}
                      onChange={(value) => setForm((prev) => ({ ...prev, buyer_id: value, owner_email: value ? String(buyerMap.get(Number(value))?.email || prev.owner_email) : prev.owner_email }))}
                      options={[{ value: "", label: "Unassigned" }, ...buyers.map((buyer) => ({ value: String(buyer.id), label: buyerDisplayName(buyer) }))]}
                    />
                    <AdminField label="Owner Email" value={form.owner_email} onChange={(value) => setForm((prev) => ({ ...prev, owner_email: value }))} />
                    <AdminField label="Sex" value={form.sex} onChange={(value) => setForm((prev) => ({ ...prev, sex: value }))} />
                    <AdminField label="Color" value={form.color} onChange={(value) => setForm((prev) => ({ ...prev, color: value }))} />
                    <AdminField label="Coat Type" value={form.coat_type} onChange={(value) => setForm((prev) => ({ ...prev, coat_type: value }))} />
                    <AdminField label="Coat" value={form.coat} onChange={(value) => setForm((prev) => ({ ...prev, coat: value }))} />
                    <AdminField label="Pattern" value={form.pattern} onChange={(value) => setForm((prev) => ({ ...prev, pattern: value }))} />
                    <AdminDateField label="DOB" value={form.dob} onChange={(value) => setForm((prev) => ({ ...prev, dob: value }))} />
                    <AdminField label="Registry" value={form.registry} onChange={(value) => setForm((prev) => ({ ...prev, registry: value }))} />
                    <AdminField label="Sire" value={form.sire} onChange={(value) => setForm((prev) => ({ ...prev, sire: value }))} />
                    <AdminField label="Dam" value={form.dam} onChange={(value) => setForm((prev) => ({ ...prev, dam: value }))} />
                    <AdminField label="Price" value={form.price} onChange={(value) => setForm((prev) => ({ ...prev, price: value }))} />
                    <AdminField label="Deposit" value={form.deposit} onChange={(value) => setForm((prev) => ({ ...prev, deposit: value }))} />
                    <AdminField label="Balance" value={form.balance} onChange={(value) => setForm((prev) => ({ ...prev, balance: value }))} />
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <AdminField label="Photo URL" value={form.photo_url} onChange={(value) => setForm((prev) => ({ ...prev, photo_url: value }))} />
                    <AdminField label="Image URL / Storage Path" value={form.image_url} onChange={(value) => setForm((prev) => ({ ...prev, image_url: value }))} />
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <AdminTextArea label="Description" value={form.description} onChange={(value) => setForm((prev) => ({ ...prev, description: value }))} rows={6} />
                    <AdminTextArea label="Notes" value={form.notes} onChange={(value) => setForm((prev) => ({ ...prev, notes: value }))} rows={6} />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button type="button" onClick={() => void savePuppy()} disabled={saving} className="rounded-2xl bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(181,117,47,0.26)] transition hover:brightness-105 disabled:opacity-60">
                      {saving ? "Saving..." : isCreateMode ? "Create Puppy" : "Save Puppy"}
                    </button>
                    {!isCreateMode ? (
                      <button type="button" onClick={() => void deletePuppy()} disabled={deleting} className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 shadow-[0_12px_28px_rgba(185,28,28,0.08)] transition hover:border-rose-300 disabled:opacity-60">
                        {deleting ? "Deleting..." : "Delete Puppy"}
                      </button>
                    ) : null}
                  </div>
                </AdminPanel>

                <AdminPanel title="Growth & Identification" subtitle="These fields support the My Puppy page, growth tracking, and recordkeeping after go-home.">
                  <div className="grid gap-4 md:grid-cols-3">
                    <AdminField label="Birth Weight" value={form.birth_weight} onChange={(value) => setForm((prev) => ({ ...prev, birth_weight: value }))} />
                    <AdminField label="Current Weight" value={form.current_weight} onChange={(value) => setForm((prev) => ({ ...prev, current_weight: value }))} />
                    <AdminSelect
                      label="Weight Unit"
                      value={form.weight_unit}
                      onChange={(value) => setForm((prev) => ({ ...prev, weight_unit: value }))}
                      options={[{ value: "", label: "Not set" }, { value: "oz", label: "oz" }, { value: "g", label: "g" }, { value: "lb", label: "lb" }]}
                    />
                    <AdminDateField label="Weight Date" value={form.weight_date} onChange={(value) => setForm((prev) => ({ ...prev, weight_date: value }))} />
                    <AdminField label="Microchip" value={form.microchip} onChange={(value) => setForm((prev) => ({ ...prev, microchip: value }))} />
                    <AdminField label="Registration Number" value={form.registration_no} onChange={(value) => setForm((prev) => ({ ...prev, registration_no: value }))} />
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-4">
                    <AdminField label="Week 1" value={form.w_1} onChange={(value) => setForm((prev) => ({ ...prev, w_1: value }))} />
                    <AdminField label="Week 2" value={form.w_2} onChange={(value) => setForm((prev) => ({ ...prev, w_2: value }))} />
                    <AdminField label="Week 3" value={form.w_3} onChange={(value) => setForm((prev) => ({ ...prev, w_3: value }))} />
                    <AdminField label="Week 4" value={form.w_4} onChange={(value) => setForm((prev) => ({ ...prev, w_4: value }))} />
                    <AdminField label="Week 5" value={form.w_5} onChange={(value) => setForm((prev) => ({ ...prev, w_5: value }))} />
                    <AdminField label="Week 6" value={form.w_6} onChange={(value) => setForm((prev) => ({ ...prev, w_6: value }))} />
                    <AdminField label="Week 7" value={form.w_7} onChange={(value) => setForm((prev) => ({ ...prev, w_7: value }))} />
                    <AdminField label="Week 8" value={form.w_8} onChange={(value) => setForm((prev) => ({ ...prev, w_8: value }))} />
                  </div>
                </AdminPanel>
              </div>

              <div className="space-y-6">
                <AdminPanel title="Website & Portal Placement" subtitle="Use this panel to confirm whether the puppy record is ready for the public site and buyer portal.">
                  <div className="overflow-hidden rounded-[24px] border border-[#ead9c7] bg-[#fffaf5]">
                    <div className="h-64 bg-[linear-gradient(180deg,#f6ede1_0%,#fffdfb_100%)]">
                      {photoPreviewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photoPreviewUrl}
                          alt={form.call_name || form.puppy_name || form.name || "Puppy preview"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-center text-[#8a6a49]">
                          <div>
                            <div className="text-base font-semibold">No puppy photo added yet</div>
                            <div className="mt-2 text-sm">Upload or paste a photo URL to populate website and portal cards.</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <AdminInfoTile label="Website Listing" value={isAvailableStatus(form.status) ? "Ready" : form.status || "Pending"} detail="The website listing pages read directly from this record's name, status, price, photo, and description." />
                    <AdminInfoTile label="Buyer Portal Link" value={selectedBuyer ? buyerDisplayName(selectedBuyer) : form.owner_email || "Not linked"} detail="Buyer assignment and owner email help the puppy show up in the buyer portal." />
                    <AdminInfoTile label="Public Price" value={form.price ? fmtMoney(form.price) : "Not set"} detail="Used in available puppy and buyer-facing financial views." />
                    <AdminInfoTile label="Current Weight" value={form.current_weight ? `${form.current_weight} ${form.weight_unit || ""}`.trim() : "Not set"} detail={form.weight_date ? `Last updated ${fmtDate(form.weight_date)}` : "Weight date not set"} />
                  </div>
                </AdminPanel>

                <AdminPanel title="Next Admin Actions" subtitle="Jump straight into the related workflow after the puppy record is saved.">
                  <div className="grid grid-cols-1 gap-3">
                    <Link href="/admin/portal/puppy-payments" className="rounded-[20px] border border-[#ead9c7] bg-[#fffaf5] px-4 py-4 transition hover:border-[#d8b48b] hover:bg-white">
                      <div className="text-sm font-semibold text-[#2f2218]">Open Puppy Payments</div>
                      <div className="mt-1 text-xs leading-5 text-[#8a6a49]">Manage pricing, deposits, financing, and puppy-level payment entries.</div>
                    </Link>
                    <Link href="/admin/portal/users" className="rounded-[20px] border border-[#ead9c7] bg-[#fffaf5] px-4 py-4 transition hover:border-[#d8b48b] hover:bg-white">
                      <div className="text-sm font-semibold text-[#2f2218]">Open Buyers</div>
                      <div className="mt-1 text-xs leading-5 text-[#8a6a49]">Link or review the buyer connected to this puppy record.</div>
                    </Link>
                    <Link href="/portal/available-puppies" className="rounded-[20px] border border-[#ead9c7] bg-[#fffaf5] px-4 py-4 transition hover:border-[#d8b48b] hover:bg-white">
                      <div className="text-sm font-semibold text-[#2f2218]">Open Buyer Available Puppies</div>
                      <div className="mt-1 text-xs leading-5 text-[#8a6a49]">Review how available and upcoming puppies render in the portal.</div>
                    </Link>
                    <Link href="/puppies" className="rounded-[20px] border border-[#ead9c7] bg-[#fffaf5] px-4 py-4 transition hover:border-[#d8b48b] hover:bg-white">
                      <div className="text-sm font-semibold text-[#2f2218]">Open Website Puppies Page</div>
                      <div className="mt-1 text-xs leading-5 text-[#8a6a49]">Confirm the public puppy listings reflect the latest record details.</div>
                    </Link>
                  </div>
                </AdminPanel>
              </div>
            </section>
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}

function AdminField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a47946]">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm normal-case tracking-normal text-[#3e2a1f] outline-none focus:border-[#c8a884]"
      />
    </label>
  );
}

function AdminDateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a47946]">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm normal-case tracking-normal text-[#3e2a1f] outline-none focus:border-[#c8a884]"
      />
    </label>
  );
}

function AdminSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a47946]">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm normal-case tracking-normal text-[#3e2a1f] outline-none focus:border-[#c8a884]"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value || "empty"}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AdminTextArea({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a47946]">
      {label}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-2 w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm normal-case tracking-normal text-[#3e2a1f] outline-none focus:border-[#c8a884]"
      />
    </label>
  );
}

function StatusFilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-[18px] border px-3 py-3 text-sm font-semibold transition",
        active
          ? "border-[#d8b48b] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2e9_100%)] text-[#2f2218] shadow-[0_12px_30px_rgba(106,76,45,0.08)]"
          : "border-[#ead9c7] bg-[#fffaf5] text-[#73583f] hover:border-[#d8b48b] hover:bg-white",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
