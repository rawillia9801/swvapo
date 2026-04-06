"use client";

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
  adminStatusBadge,
} from "@/components/admin/luxury-admin-shell";
import {
  AdminDateInput,
  AdminNumberInput,
  AdminSelectInput,
  AdminTextAreaInput,
  AdminTextInput,
} from "@/components/admin/admin-form-fields";
import {
  type AdminLineageBuyer,
  type AdminLineageDog,
  type AdminLineageDogRef,
  type AdminLineageLitter,
  type AdminLineagePuppy,
  type AdminLineageWorkspace,
} from "@/lib/admin-portal";
import { shouldHidePublicPuppyPrice } from "@/lib/lineage";
import { fmtDate, fmtMoney } from "@/lib/utils";
import { usePortalAdminSession } from "@/lib/use-portal-admin-session";

type LitterForm = {
  litter_code: string;
  litter_name: string;
  dam_id: string;
  sire_id: string;
  whelp_date: string;
  status: string;
  notes: string;
};

type PuppyEditorForm = {
  call_name: string;
  puppy_name: string;
  name: string;
  status: string;
  buyer_id: string;
  litter_id: string;
  price: string;
  list_price: string;
  deposit: string;
  balance: string;
  notes: string;
};

type NoticeTone = "success" | "error" | "neutral";
type NoticeState = { tone: NoticeTone; message: string };

const emptyForm = (): LitterForm => ({
  litter_code: "",
  litter_name: "",
  dam_id: "",
  sire_id: "",
  whelp_date: "",
  status: "planned",
  notes: "",
});

const emptyPuppyForm = (): PuppyEditorForm => ({
  call_name: "",
  puppy_name: "",
  name: "",
  status: "available",
  buyer_id: "",
  litter_id: "",
  price: "",
  list_price: "",
  deposit: "",
  balance: "",
  notes: "",
});

const dogName = (dog: AdminLineageDogRef | AdminLineageDog | null | undefined) =>
  dog?.displayName || dog?.dog_name || dog?.name || dog?.call_name || "Not linked";

const buyerName = (buyer: AdminLineageBuyer | null | undefined) =>
  buyer?.full_name || buyer?.name || buyer?.email || "No buyer assigned";

const litterName = (litter: AdminLineageLitter | null | undefined) =>
  litter?.displayName || litter?.litter_name || litter?.litter_code || "Litter record";

const displayDate = (value: string | null | undefined) =>
  value ? fmtDate(value) : "Not set";

const populateLitterForm = (litter: AdminLineageLitter | null): LitterForm =>
  litter
    ? {
        litter_code: String(litter.litter_code || ""),
        litter_name: String(litter.litter_name || ""),
        dam_id: litter.dam_id ? String(litter.dam_id) : "",
        sire_id: litter.sire_id ? String(litter.sire_id) : "",
        whelp_date: String(litter.whelp_date || ""),
        status: String(litter.status || "planned"),
        notes: String(litter.notes || ""),
      }
    : emptyForm();

const populatePuppyForm = (puppy: AdminLineagePuppy | null): PuppyEditorForm =>
  puppy
    ? {
        call_name: String(puppy.call_name || ""),
        puppy_name: String(puppy.puppy_name || ""),
        name: String(puppy.name || ""),
        status: String(puppy.status || "available"),
        buyer_id: puppy.buyer_id ? String(puppy.buyer_id) : "",
        litter_id: puppy.litter_id ? String(puppy.litter_id) : "",
        price: puppy.price == null ? "" : String(puppy.price),
        list_price: puppy.list_price == null ? "" : String(puppy.list_price),
        deposit: puppy.deposit == null ? "" : String(puppy.deposit),
        balance: puppy.balance == null ? "" : String(puppy.balance),
        notes: String(puppy.notes || ""),
      }
    : emptyPuppyForm();

async function requestLineageWorkspace(accessToken: string) {
  const response = await fetch("/api/admin/portal/lineage", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | { workspace?: AdminLineageWorkspace; error?: string }
    | null;
  if (!response.ok || !payload?.workspace) {
    throw new Error(payload?.error || "Could not load the litter workspace.");
  }
  return payload.workspace;
}

function Notice({ tone, message }: NoticeState) {
  const tones: Record<NoticeTone, string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    error: "border-rose-200 bg-rose-50 text-rose-900",
    neutral: "border-[#ead9c7] bg-[#fff9f2] text-[#7a5a3a]",
  };

  return (
    <div className={`mb-4 rounded-[18px] border px-4 py-3 text-sm font-semibold ${tones[tone]}`}>
      {message}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#ead9c7] bg-white px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9c7043]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[#2f2218]">{value}</div>
    </div>
  );
}

function SavedMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9c7043]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[#2f2218]">{value}</div>
    </div>
  );
}

function PuppyDrawer({
  puppy,
  form,
  onChange,
  onClose,
  onSave,
  saving,
  litterOptions,
  buyerOptions,
}: {
  puppy: AdminLineagePuppy;
  form: PuppyEditorForm;
  onChange: (key: keyof PuppyEditorForm, value: string) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  litterOptions: Array<{ value: string; label: string }>;
  buyerOptions: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(46,29,14,0.28)] backdrop-blur-[2px]"
        aria-label="Close puppy editor"
      />

      <div className="absolute right-0 top-0 h-full w-full max-w-[560px] border-l border-[#e7d7c6] bg-[linear-gradient(180deg,rgba(255,252,247,0.98),rgba(252,246,239,0.98))] shadow-[0_24px_60px_rgba(72,46,24,0.18)]">
        <div className="flex h-full flex-col">
          <div className="border-b border-[#ead9c7] px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9c7043]">
                  Linked Puppy
                </div>
                <div className="mt-2 text-xl font-semibold text-[#2f2218]">{puppy.displayName}</div>
                <div className="mt-1 text-sm text-[#7a5b3d]">
                  Internal pricing edits here recalculate the saved litter revenue after each save.
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-[#e4d2be] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#7a5b3d] transition hover:border-[#d4b48b]"
              >
                Close
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <AdminInfoTile
                  label="Internal Sale"
                  value={fmtMoney(Number(form.price || 0))}
                  detail="Used for contracted litter revenue in admin."
                />
                <AdminInfoTile
                  label="Collected Payments"
                  value={fmtMoney(puppy.paymentTotal || 0)}
                  detail="Read-only here. Manage payment entries in Payments."
                />
                <AdminInfoTile
                  label="Public Listing"
                  value={
                    shouldHidePublicPuppyPrice(form.status)
                      ? "Hidden publicly"
                      : fmtMoney(Number(form.list_price || form.price || 0))
                  }
                  detail="Public price visibility is separate from internal revenue."
                />
                <AdminInfoTile
                  label="Lineage"
                  value={`${dogName(puppy.damProfile)} / ${dogName(puppy.sireProfile)}`}
                  detail="Resolved through the litter relationship."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <AdminTextInput
                  label="Puppy Name"
                  value={form.call_name}
                  onChange={(value) => onChange("call_name", value)}
                  placeholder="Call name"
                />
                <AdminTextInput
                  label="Record Name"
                  value={form.name}
                  onChange={(value) => onChange("name", value)}
                  placeholder="Formal record name"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <AdminTextInput
                  label="Secondary Name"
                  value={form.puppy_name}
                  onChange={(value) => onChange("puppy_name", value)}
                  placeholder="Optional alternate name"
                />
                <AdminSelectInput
                  label="Status"
                  value={form.status}
                  onChange={(value) => onChange("status", value)}
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
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <AdminSelectInput
                  label="Buyer"
                  value={form.buyer_id}
                  onChange={(value) => onChange("buyer_id", value)}
                  options={buyerOptions}
                />
                <AdminSelectInput
                  label="Litter Assignment"
                  value={form.litter_id}
                  onChange={(value) => onChange("litter_id", value)}
                  options={[{ value: "", label: "No litter" }, ...litterOptions]}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <AdminNumberInput
                  label="Internal Final Sale Price"
                  value={form.price}
                  onChange={(value) => onChange("price", value)}
                  step="0.01"
                />
                <AdminNumberInput
                  label="Listed / Public Price"
                  value={form.list_price}
                  onChange={(value) => onChange("list_price", value)}
                  step="0.01"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <AdminNumberInput
                  label="Deposit Amount"
                  value={form.deposit}
                  onChange={(value) => onChange("deposit", value)}
                  step="0.01"
                />
                <AdminNumberInput
                  label="Balance"
                  value={form.balance}
                  onChange={(value) => onChange("balance", value)}
                  step="0.01"
                />
              </div>

              <AdminTextAreaInput
                label="Notes"
                value={form.notes}
                onChange={(value) => onChange("notes", value)}
                rows={5}
                placeholder="Internal notes for this puppy."
              />
            </div>
          </div>

          <div className="border-t border-[#ead9c7] px-5 py-4">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(159,99,49,0.22)] transition hover:brightness-105 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Puppy"}
              </button>
              <Link
                href="/admin/portal/payments"
                className="rounded-2xl border border-[#e4d2be] bg-white px-5 py-3 text-sm font-semibold text-[#5d4330] transition hover:border-[#d4b48b]"
              >
                Open Payments
              </Link>
              <Link
                href="/admin/portal/puppies"
                className="rounded-2xl border border-[#e4d2be] bg-white px-5 py-3 text-sm font-semibold text-[#5d4330] transition hover:border-[#d4b48b]"
              >
                Full Puppy Workspace
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPortalLittersPage() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const [workspace, setWorkspace] = useState<AdminLineageWorkspace | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [puppySaving, setPuppySaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [createMode, setCreateMode] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [form, setForm] = useState<LitterForm>(emptyForm());
  const [activePuppyId, setActivePuppyId] = useState("");
  const [puppyForm, setPuppyForm] = useState<PuppyEditorForm>(emptyPuppyForm());

  const loadWorkspace = async (
    preferredId?: string,
    nextCreateMode = false,
    preserveNotice = false,
    preservePuppyId?: string
  ) => {
    if (!accessToken) return null;

    const nextWorkspace = await requestLineageWorkspace(accessToken);
    setWorkspace(nextWorkspace);
    setCreateMode(nextCreateMode);
    if (!preserveNotice) setNotice(null);

    if (nextCreateMode) {
      setSelectedId("");
      setForm(emptyForm());
      setActivePuppyId("");
      setPuppyForm(emptyPuppyForm());
      return nextWorkspace;
    }

    const nextId =
      preferredId && nextWorkspace.litters.some((item) => String(item.id) === preferredId)
        ? preferredId
        : String(nextWorkspace.litters[0]?.id || "");

    setSelectedId(nextId);
    const selected =
      nextWorkspace.litters.find((item) => String(item.id) === nextId) || null;
    setForm(populateLitterForm(selected));

    if (preservePuppyId) {
      const nextPuppy =
        nextWorkspace.puppies.find((item) => String(item.id) === preservePuppyId) || null;
      setActivePuppyId(nextPuppy ? String(nextPuppy.id) : "");
      setPuppyForm(populatePuppyForm(nextPuppy));
    } else {
      setActivePuppyId("");
      setPuppyForm(emptyPuppyForm());
    }

    return nextWorkspace;
  };

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!accessToken || !isAdmin) {
        if (active) setLoadingData(false);
        return;
      }

      setLoadingData(true);
      try {
        const nextWorkspace = await requestLineageWorkspace(accessToken);
        if (!active) return;

        setWorkspace(nextWorkspace);
        const nextId = String(nextWorkspace.litters[0]?.id || "");
        setSelectedId(nextId);
        setForm(
          populateLitterForm(
            nextWorkspace.litters.find((item) => String(item.id) === nextId) || null
          )
        );
      } catch (error) {
        if (!active) return;
        setNotice({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Could not load the litter workspace.",
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

  const dogs = workspace?.dogs || [];
  const buyers = workspace?.buyers;
  const damOptions = dogs.filter((dog) => String(dog.role || "").toLowerCase() === "dam");
  const sireOptions = dogs.filter((dog) => String(dog.role || "").toLowerCase() === "sire");

  const litters = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (workspace?.litters || []).filter((litter) => {
      if (
        statusFilter !== "all" &&
        String(litter.status || "").toLowerCase() !== statusFilter
      ) {
        return false;
      }

      if (!q) return true;

      return [
        litter.displayName,
        litter.litter_code,
        litter.status,
        litter.notes,
        dogName(litter.damProfile),
        dogName(litter.sireProfile),
        ...litter.puppies.map((puppy) => puppy.displayName),
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(q);
    });
  }, [workspace?.litters, search, statusFilter]);

  const savedSelectedLitter =
    litters.find((item) => String(item.id) === selectedId) ||
    workspace?.litters.find((item) => String(item.id) === selectedId) ||
    null;

  const selectedLitter = createMode ? null : savedSelectedLitter;
  const selectedPuppies = selectedLitter?.puppies || [];

  const editingPuppy =
    selectedPuppies.find((item) => String(item.id) === activePuppyId) ||
    workspace?.puppies.find((item) => String(item.id) === activePuppyId) ||
    null;

  const buyerOptions = useMemo(
    () => [
      { value: "", label: "Unassigned" },
      ...(buyers || [])
        .slice()
        .sort((a, b) => buyerName(a).localeCompare(buyerName(b)))
        .map((buyer) => ({ value: String(buyer.id), label: buyerName(buyer) })),
    ],
    [buyers]
  );

  const litterOptions = useMemo(
    () =>
      (workspace?.litters || [])
        .slice()
        .sort((a, b) => litterName(a).localeCompare(litterName(b)))
        .map((litter) => ({ value: String(litter.id), label: litterName(litter) })),
    [workspace?.litters]
  );

  useEffect(() => {
    setForm(createMode ? emptyForm() : populateLitterForm(selectedLitter));
  }, [createMode, selectedLitter]);

  useEffect(() => {
    if (createMode || !litters.length || litters.some((item) => String(item.id) === selectedId)) {
      return;
    }
    setSelectedId(String(litters[0].id));
  }, [createMode, litters, selectedId]);

  useEffect(() => {
    setPuppyForm(populatePuppyForm(editingPuppy));
  }, [editingPuppy]);

  const updateForm = (key: keyof LitterForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updatePuppyForm = (key: keyof PuppyEditorForm, value: string) => {
    setPuppyForm((current) => ({ ...current, [key]: value }));
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  const openCreate = () => {
    setCreateMode(true);
    setSelectedId("");
    setForm(emptyForm());
    setActivePuppyId("");
    setPuppyForm(emptyPuppyForm());
    setNotice({
      tone: "neutral",
      message: "Create mode is open. Save the litter to generate a synced lineage record.",
    });
  };

  const openExisting = (litterId: string) => {
    setCreateMode(false);
    setSelectedId(litterId);
    setActivePuppyId("");
    setNotice(null);
  };

  const openPuppy = (puppyId: string) => {
    setActivePuppyId(puppyId);
    setNotice(null);
  };

  const saveLitter = async () => {
    if (!accessToken) return;

    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/portal/litters", {
        method: createMode ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          id: createMode ? undefined : selectedLitter?.id,
          ...form,
        }),
      });

      const payload = (await response.json()) as { litterId?: number; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not save the litter.");
      }

      await loadWorkspace(payload.litterId ? String(payload.litterId) : selectedId, false, true);
      setNotice({
        tone: "success",
        message: createMode
          ? "Litter created and synced from the saved lineage record."
          : "Litter saved. Table, summary cards, and parent linkage were refreshed from the saved data.",
      });
    } catch (error) {
      if (!createMode && selectedId) {
        try {
          await loadWorkspace(selectedId, false, true);
        } catch {}
      }

      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Could not save the litter.",
      });
    } finally {
      setSaving(false);
    }
  };

  const savePuppy = async () => {
    if (!accessToken || !editingPuppy) return;

    setPuppySaving(true);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/portal/puppies", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ id: editingPuppy.id, ...puppyForm }),
      });

      const payload = (await response.json()) as { puppyId?: number; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not save the puppy.");
      }

      await loadWorkspace(
        String(selectedLitter?.id || selectedId),
        false,
        true,
        payload.puppyId ? String(payload.puppyId) : String(editingPuppy.id)
      );

      setNotice({
        tone: "success",
        message:
          "Puppy saved. Contracted revenue, collected payments, and linked litter totals were recalculated from the live admin data.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Could not save the puppy.",
      });
    } finally {
      setPuppySaving(false);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">
        Loading litters...
      </div>
    );
  }

  if (!user) {
    return (
      <AdminRestrictedState
        title="Sign in to access litters."
        details="This workspace is reserved for Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!isAdmin) {
    return (
      <AdminRestrictedState
        title="This litter workspace is limited to approved owner accounts."
        details="Only approved owner emails can manage lineage, litter revenue, and linked puppy pricing."
      />
    );
  }

  const summary = workspace?.summary;
  const lineageGapCount =
    workspace?.litters.filter((item) => !item.dam_id || !item.sire_id).length || 0;
  const selectedSummary = selectedLitter?.summary;
  const contractedRevenue = selectedSummary?.contractedRevenue ?? 0;
  const collectedPayments = selectedSummary?.totalPayments ?? 0;
  const completedRevenue = selectedSummary?.realizedRevenue ?? 0;
  const projectedPipeline = selectedSummary?.projectedRevenue ?? 0;
  const deposits = selectedSummary?.totalDeposits ?? 0;

  return (
    <AdminPageShell>
      <div className="space-y-5 pb-10">
        <AdminPageHero
          eyebrow="Litters"
          title="Run litters as a breeder operations registry, not a loose set of cards."
          description="Contracted litter revenue now uses internal puppy sale values, while public price hiding stays separate. The registry, saved summary rail, and linked puppy editor all refresh from the same saved lineage workspace."
          actions={
            <>
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(159,99,49,0.22)] transition hover:-translate-y-0.5 hover:brightness-105"
              >
                Create Litter
              </button>
              <AdminHeroPrimaryAction href="/admin/portal/dams-sires">
                Open Breeding Program
              </AdminHeroPrimaryAction>
              <AdminHeroSecondaryAction href="/admin/portal/puppies">
                Open Puppies
              </AdminHeroSecondaryAction>
            </>
          }
          aside={
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <AdminInfoTile
                label="Contracted Revenue"
                value={fmtMoney(summary?.contractedRevenue ?? 0)}
                detail="Reserved, sold, and completed puppy sale values counted internally."
              />
              <AdminInfoTile
                label="Projected Pipeline"
                value={fmtMoney(summary?.projectedRevenue ?? 0)}
                detail="Available puppy opportunity still open across the breeding program."
              />
            </div>
          }
        />

        <AdminMetricGrid>
          <AdminMetricCard
            label="Litters"
            value={String(summary?.totalLitters || 0)}
            detail="Saved litter records with live parent linkage and revenue summaries."
          />
          <AdminMetricCard
            label="Parent Gaps"
            value={String(lineageGapCount)}
            detail="Litters still missing a saved sire or dam relationship."
            accent="from-[#efe1d2] via-[#d7b999] to-[#b88255]"
          />
          <AdminMetricCard
            label="Contracted Sales"
            value={fmtMoney(summary?.contractedRevenue ?? 0)}
            detail="Internal contracted revenue from reserved, sold, and completed puppies."
            accent="from-[#e2e5d4] via-[#bec49f] to-[#8c9873]"
          />
          <AdminMetricCard
            label="Collected Payments"
            value={fmtMoney(summary?.totalPayments ?? 0)}
            detail="Cash collected across linked buyer payment records."
            accent="from-[#efe3d3] via-[#d7bf9f] to-[#bb8858]"
          />
        </AdminMetricGrid>

        <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.28fr)_460px]">
          <div className="space-y-5">
            <AdminPanel
              title="Litter Registry"
              subtitle="Saved litter rows read directly from persisted sire and dam relationships. Select a row to review the saved record and edit it in the detail rail."
            >
              <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search litter, sire, dam, notes, or linked puppies..."
                  className="w-full rounded-[16px] border border-[#e6d7c7] bg-[#fffdfa] px-3.5 py-2.5 text-sm text-[#33251a] outline-none transition focus:border-[#caa074] focus:ring-2 focus:ring-[#ead7c0]"
                />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="w-full rounded-[16px] border border-[#e6d7c7] bg-[#fffdfa] px-3.5 py-2.5 text-sm text-[#33251a] outline-none transition focus:border-[#caa074] focus:ring-2 focus:ring-[#ead7c0]"
                >
                  <option value="all">All statuses</option>
                  <option value="planned">Planned</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-[16px] border border-[#e4d2be] bg-white px-4 py-2.5 text-sm font-semibold text-[#5d4330] transition hover:border-[#d4b48b]"
                >
                  Clear filters
                </button>
              </div>

              {litters.length ? (
                <div className="overflow-hidden rounded-[22px] border border-[#ead9c7]">
                  <table className="min-w-full divide-y divide-[#eee1d2] text-sm">
                    <thead className="bg-[#faf3ea] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9c7043]">
                      <tr>
                        <th className="px-4 py-3">Litter</th>
                        <th className="px-4 py-3">Parents</th>
                        <th className="px-4 py-3">Whelp Date</th>
                        <th className="px-4 py-3">Revenue</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1e6da] bg-white">
                      {litters.map((litter) => {
                        const active = !createMode && String(litter.id) === selectedId;
                        return (
                          <tr
                            key={litter.id}
                            onClick={() => openExisting(String(litter.id))}
                            className={`cursor-pointer transition hover:bg-[#fffaf4] ${
                              active ? "bg-[#fff8ef]" : ""
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="font-semibold text-[#2f2218]">{litterName(litter)}</div>
                              <div className="mt-1 text-xs text-[#8a6a49]">
                                {litter.puppies.length} puppies linked
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[#73583f]">
                              {dogName(litter.damProfile)} / {dogName(litter.sireProfile)}
                            </td>
                            <td className="px-4 py-3 text-[#73583f]">
                              {displayDate(litter.whelp_date)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-[#2f2218]">
                                {fmtMoney(litter.summary.contractedRevenue ?? 0)}
                              </div>
                              <div className="mt-1 text-xs text-[#8a6a49]">
                                {fmtMoney(litter.summary.totalPayments ?? 0)} collected
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${adminStatusBadge(
                                  litter.status
                                )}`}
                              >
                                {litter.status || "planned"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <AdminEmptyState
                  title="No litters match the current filters"
                  description="Adjust the filters or create a new litter to restart the registry."
                />
              )}
            </AdminPanel>

            <AdminPanel
              title="Linked Puppies"
              subtitle={
                createMode
                  ? "Save the litter first to attach puppies and activate the revenue drill-down."
                  : "Each row opens a live puppy editor so internal pricing updates can refresh this litter immediately."
              }
            >
              {selectedLitter ? (
                selectedPuppies.length ? (
                  <>
                    <div className="overflow-hidden rounded-[22px] border border-[#ead9c7]">
                      <table className="min-w-full divide-y divide-[#eee1d2] text-sm">
                        <thead className="bg-[#faf3ea] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9c7043]">
                          <tr>
                            <th className="px-4 py-3">Puppy</th>
                            <th className="px-4 py-3">Buyer</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Internal Sale</th>
                            <th className="px-4 py-3">Payments</th>
                            <th className="px-4 py-3">Edit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f1e6da] bg-white">
                          {selectedPuppies.map((puppy) => {
                            const active = String(puppy.id) === activePuppyId;
                            return (
                              <tr
                                key={puppy.id}
                                onClick={() => openPuppy(String(puppy.id))}
                                className={`cursor-pointer transition hover:bg-[#fffaf4] ${
                                  active ? "bg-[#fff8ef]" : ""
                                }`}
                              >
                                <td className="px-4 py-3">
                                  <div className="font-semibold text-[#2f2218]">{puppy.displayName}</div>
                                  <div className="mt-1 text-xs text-[#8a6a49]">
                                    {shouldHidePublicPuppyPrice(puppy.status)
                                      ? "Public price hidden"
                                      : "Public price visible"}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-[#73583f]">
                                  {buyerName(puppy.buyer)}
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${adminStatusBadge(
                                      puppy.status
                                    )}`}
                                  >
                                    {puppy.status || "available"}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-semibold text-[#2f2218]">
                                    {fmtMoney(puppy.salePrice || 0)}
                                  </div>
                                  <div className="mt-1 text-xs text-[#8a6a49]">
                                    Listed {fmtMoney(puppy.listPrice || 0)}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-semibold text-[#2f2218]">
                                    {fmtMoney(puppy.paymentTotal || 0)}
                                  </div>
                                  <div className="mt-1 text-xs text-[#8a6a49]">
                                    Deposit {fmtMoney(puppy.depositTotal || 0)}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openPuppy(String(puppy.id));
                                    }}
                                    className="rounded-full border border-[#e4d2be] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#6b4c33] transition hover:border-[#d4b48b]"
                                  >
                                    Edit
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <MiniMetric label="Linked Puppies" value={String(selectedPuppies.length)} />
                      <MiniMetric label="Contracted Revenue" value={fmtMoney(contractedRevenue)} />
                      <MiniMetric label="Collected Payments" value={fmtMoney(collectedPayments)} />
                    </div>
                  </>
                ) : (
                  <AdminEmptyState
                    title="No puppies linked to this litter yet"
                    description="Assign puppies to this litter from the puppy workspace, then return here to review internal sale totals and lineage."
                  />
                )
              ) : (
                <AdminEmptyState
                  title="Select or save a litter to review linked puppies"
                  description="The linked puppy table becomes a live admin drill-down once a saved litter record is active."
                />
              )}
            </AdminPanel>
          </div>

          <div className="space-y-5 2xl:sticky 2xl:top-5 2xl:self-start">
            <AdminPanel
              title={createMode ? "Create Litter" : "Litter Detail"}
              subtitle={
                createMode
                  ? "Build the saved litter record with explicit sire and dam linkage."
                  : "Saved summary metrics stay tied to the live database record while edits happen below."
              }
            >
              {notice ? <Notice {...notice} /> : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <AdminInfoTile
                  label="Dam"
                  value={dogName(selectedLitter?.damProfile)}
                  detail="Saved sire and dam values resolve from persisted lineage links."
                />
                <AdminInfoTile
                  label="Sire"
                  value={dogName(selectedLitter?.sireProfile)}
                  detail="Every summary surface reads from the same saved litter record."
                />
                <AdminInfoTile
                  label="Contracted Revenue"
                  value={fmtMoney(contractedRevenue)}
                  detail="Internal sale values for reserved, sold, and completed puppies."
                />
                <AdminInfoTile
                  label="Collected Payments"
                  value={fmtMoney(collectedPayments)}
                  detail="Payments collected against linked buyer records."
                />
                <AdminInfoTile
                  label="Completed Revenue"
                  value={fmtMoney(completedRevenue)}
                  detail="Realized completed-sales revenue for this litter."
                />
                <AdminInfoTile
                  label="Projected Pipeline"
                  value={fmtMoney(projectedPipeline)}
                  detail="Still-open value from available puppy pricing."
                />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MiniMetric label="Deposits" value={fmtMoney(deposits)} />
                <MiniMetric
                  label="Average Sale"
                  value={fmtMoney(selectedSummary?.averageSalePrice ?? 0)}
                />
              </div>

              <div className="mt-5 rounded-[22px] border border-[#ead9c7] bg-[#fffaf4] px-4 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9c7043]">
                  Saved Record
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <SavedMeta label="Litter" value={litterName(selectedLitter)} />
                  <SavedMeta
                    label="Parents"
                    value={`${dogName(selectedLitter?.damProfile)} / ${dogName(
                      selectedLitter?.sireProfile
                    )}`}
                  />
                  <SavedMeta label="Whelp Date" value={displayDate(selectedLitter?.whelp_date)} />
                  <SavedMeta label="Status" value={selectedLitter?.status || "planned"} />
                  <SavedMeta label="Puppy Count" value={String(selectedLitter?.puppies.length || 0)} />
                  <SavedMeta label="Revenue Surface" value={`${fmtMoney(contractedRevenue)} contracted`} />
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <AdminTextInput
                    label="Litter Code"
                    value={form.litter_code}
                    onChange={(value) => updateForm("litter_code", value)}
                    placeholder="Litter code"
                  />
                  <AdminTextInput
                    label="Litter Name"
                    value={form.litter_name}
                    onChange={(value) => updateForm("litter_name", value)}
                    placeholder="Litter name"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <AdminSelectInput
                    label="Dam"
                    value={form.dam_id}
                    onChange={(value) => updateForm("dam_id", value)}
                    options={[
                      { value: "", label: "Select a dam" },
                      ...damOptions.map((dog) => ({
                        value: String(dog.id),
                        label: dogName(dog),
                      })),
                    ]}
                  />
                  <AdminSelectInput
                    label="Sire"
                    value={form.sire_id}
                    onChange={(value) => updateForm("sire_id", value)}
                    options={[
                      { value: "", label: "Select a sire" },
                      ...sireOptions.map((dog) => ({
                        value: String(dog.id),
                        label: dogName(dog),
                      })),
                    ]}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <AdminDateInput
                    label="Whelp Date"
                    value={form.whelp_date}
                    onChange={(value) => updateForm("whelp_date", value)}
                  />
                  <AdminSelectInput
                    label="Status"
                    value={form.status}
                    onChange={(value) => updateForm("status", value)}
                    options={[
                      { value: "planned", label: "Planned" },
                      { value: "active", label: "Active" },
                      { value: "completed", label: "Completed" },
                      { value: "archived", label: "Archived" },
                    ]}
                  />
                </div>

                <AdminTextAreaInput
                  label="Notes"
                  value={form.notes}
                  onChange={(value) => updateForm("notes", value)}
                  rows={5}
                  placeholder="Internal litter notes"
                />
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void saveLitter()}
                  disabled={saving}
                  className="rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(159,99,49,0.22)] transition hover:brightness-105 disabled:opacity-60"
                >
                  {saving ? "Saving..." : createMode ? "Create Litter" : "Save Litter"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setForm(createMode ? emptyForm() : populateLitterForm(selectedLitter));
                    setNotice({
                      tone: "neutral",
                      message: createMode
                        ? "Draft reset."
                        : "Draft reset to the saved litter record.",
                    });
                  }}
                  className="rounded-2xl border border-[#e4d2be] bg-white px-5 py-3 text-sm font-semibold text-[#5d4330] transition hover:border-[#d4b48b]"
                >
                  Reset to Saved
                </button>
              </div>
            </AdminPanel>
          </div>
        </section>

        {editingPuppy ? (
          <PuppyDrawer
            puppy={editingPuppy}
            form={puppyForm}
            onChange={updatePuppyForm}
            onClose={() => {
              setActivePuppyId("");
              setPuppyForm(emptyPuppyForm());
            }}
            onSave={() => void savePuppy()}
            saving={puppySaving}
            litterOptions={litterOptions}
            buyerOptions={buyerOptions}
          />
        ) : null}
      </div>
    </AdminPageShell>
  );
}
