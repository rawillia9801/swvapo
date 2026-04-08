"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AdminEmptyState,
  AdminHeroPrimaryAction,
  AdminHeroSecondaryAction,
  AdminInfoTile,
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

const LITTER_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "planned", label: "Planned" },
  { value: "whelped", label: "Whelped" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

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
    neutral: "border-[var(--portal-border)] bg-[var(--portal-surface-muted)] text-[var(--portal-text-soft)]",
  };

  return (
    <div className={`rounded-[18px] border px-4 py-3 text-sm font-semibold ${tones[tone]}`}>
      {message}
    </div>
  );
}

function WorkspaceNavCard({
  href,
  title,
  detail,
}: {
  href: string;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[20px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,#fffdf9_0%,#fbf6ef_100%)] px-4 py-4 transition hover:-translate-y-0.5 hover:border-[#d7b28a] hover:bg-white"
    >
      <div className="text-sm font-semibold text-[var(--portal-text)]">{title}</div>
      <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">{detail}</div>
    </Link>
  );
}

function WorkspaceMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-[18px] border border-[var(--portal-border)] bg-white px-4 py-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-[var(--portal-text)]">{value}</div>
      {detail ? <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">{detail}</div> : null}
    </div>
  );
}

function SavedMeta({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">{value}</div>
    </div>
  );
}

function SecondaryMeta({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[16px] border border-[var(--portal-border)] bg-white px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">{value}</div>
    </div>
  );
}

function EmptySelection({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[22px] border border-dashed border-[#e0ccb6] bg-[var(--portal-surface-muted)] px-5 py-8 text-center">
      <div className="text-base font-semibold text-[var(--portal-text)]">{title}</div>
      <div className="mt-2 text-sm leading-6 text-[#7a5b3d]">{description}</div>
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
  const internalSale = Number(form.price || 0);
  const publicPrice = Number(form.list_price || form.price || 0);

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(46,29,14,0.28)] backdrop-blur-[2px]"
        aria-label="Close puppy editor"
      />

      <div className="absolute right-0 top-0 h-full w-full max-w-[620px] border-l border-[#e7d7c6] bg-[linear-gradient(180deg,rgba(255,252,247,0.99),rgba(252,246,239,0.99))] shadow-[0_24px_60px_rgba(72,46,24,0.18)]">
        <div className="flex h-full flex-col">
          <div className="border-b border-[var(--portal-border)] px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                  Puppy Revenue Editor
                </div>
                <div className="mt-2 text-2xl font-semibold leading-tight text-[var(--portal-text)]">
                  {puppy.displayName}
                </div>
                <div className="mt-1 text-sm leading-6 text-[#7a5b3d]">
                  Internal sale values update litter totals here without changing your public price rules.
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-[var(--portal-border)] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#7a5b3d] transition hover:border-[var(--portal-border-strong)]"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <WorkspaceMetric
                label="Internal Sale"
                value={fmtMoney(internalSale)}
                detail="Counts toward contracted litter revenue."
              />
              <WorkspaceMetric
                label="Collected"
                value={fmtMoney(puppy.paymentTotal || 0)}
                detail="Read from linked payment records."
              />
              <WorkspaceMetric
                label="Public Price"
                value={
                  shouldHidePublicPuppyPrice(form.status)
                    ? "Hidden"
                    : fmtMoney(publicPrice)
                }
                detail="Still separated from internal revenue."
              />
              <WorkspaceMetric
                label="Lineage"
                value={`${dogName(puppy.damProfile)} / ${dogName(puppy.sireProfile)}`}
                detail="Resolved from the litter relationship."
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-5">
              <div className="rounded-[22px] border border-[var(--portal-border)] bg-white p-5">
                <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                  Identity
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <AdminTextInput
                    label="Call Name"
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
              </div>

              <div className="rounded-[22px] border border-[var(--portal-border)] bg-white p-5">
                <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                  Assignment
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
              </div>

              <div className="rounded-[22px] border border-[var(--portal-border)] bg-white p-5">
                <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                  Revenue
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
                  <AdminNumberInput
                    label="Deposit"
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
              </div>

              <div className="rounded-[22px] border border-[var(--portal-border)] bg-white p-5">
                <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                  Internal Notes
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
          </div>

          <div className="border-t border-[var(--portal-border)] px-6 py-4">
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
                className="rounded-2xl border border-[var(--portal-border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]"
              >
                Open Payments
              </Link>
              <Link
                href="/admin/portal/puppies"
                className="rounded-2xl border border-[var(--portal-border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]"
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
    preservePuppyId?: string,
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
            nextWorkspace.litters.find((item) => String(item.id) === nextId) || null,
          ),
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

  const damOptions = dogs.filter(
    (dog) => String(dog.role || "").toLowerCase() === "dam",
  );
  const sireOptions = dogs.filter(
    (dog) => String(dog.role || "").toLowerCase() === "sire",
  );

  const filteredLitters = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (workspace?.litters || []).filter((litter) => {
      const litterStatus = String(litter.status || "").toLowerCase();

      if (statusFilter !== "all" && litterStatus !== statusFilter) {
        return false;
      }

      if (!q) return true;

      const haystack = [
        litter.displayName,
        litter.litter_code,
        litter.litter_name,
        litter.status,
        litter.notes,
        dogName(litter.damProfile),
        dogName(litter.sireProfile),
        ...litter.puppies.map((puppy) => puppy.displayName),
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      return haystack.includes(q);
    });
  }, [workspace?.litters, search, statusFilter]);

  const savedSelectedLitter =
    filteredLitters.find((item) => String(item.id) === selectedId) ||
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
        .map((buyer) => ({
          value: String(buyer.id),
          label: buyerName(buyer),
        })),
    ],
    [buyers],
  );

  const litterOptions = useMemo(
    () =>
      (workspace?.litters || [])
        .slice()
        .sort((a, b) => litterName(a).localeCompare(litterName(b)))
        .map((litter) => ({
          value: String(litter.id),
          label: litterName(litter),
        })),
    [workspace?.litters],
  );

  useEffect(() => {
    setForm(createMode ? emptyForm() : populateLitterForm(selectedLitter));
  }, [createMode, selectedLitter]);

  useEffect(() => {
    if (createMode) return;
    if (!filteredLitters.length) return;
    if (filteredLitters.some((item) => String(item.id) === selectedId)) return;
    setSelectedId(String(filteredLitters[0].id));
  }, [createMode, filteredLitters, selectedId]);

  useEffect(() => {
    setPuppyForm(populatePuppyForm(editingPuppy));
  }, [editingPuppy]);

  const updateForm = (key: keyof LitterForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updatePuppyForm = (key: keyof PuppyEditorForm, value: string) => {
    setPuppyForm((current) => ({ ...current, [key]: value }));
  };

  const openCreate = () => {
    setCreateMode(true);
    setSelectedId("");
    setForm(emptyForm());
    setActivePuppyId("");
    setPuppyForm(emptyPuppyForm());
    setNotice({
      tone: "neutral",
      message:
        "Create mode is open. Save the litter to turn it into a live registry record.",
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

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  const resetDetail = () => {
    if (createMode) {
      setForm(emptyForm());
      setNotice({
        tone: "neutral",
        message: "Create mode has been reset to a blank litter form.",
      });
      return;
    }

    setForm(populateLitterForm(selectedLitter));
    setNotice({
      tone: "neutral",
      message: "Litter detail has been reset to the saved record.",
    });
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

      const payload = (await response.json()) as {
        litterId?: number;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not save the litter.");
      }

      await loadWorkspace(
        payload.litterId ? String(payload.litterId) : selectedId,
        false,
        true,
      );

      setNotice({
        tone: "success",
        message: createMode
          ? "Litter created and synced into the live registry."
          : "Litter saved. Registry, parent linkage, and revenue surfaces were refreshed from saved data.",
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

      const payload = (await response.json()) as {
        puppyId?: number;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not save the puppy.");
      }

      await loadWorkspace(
        String(selectedLitter?.id || selectedId),
        false,
        true,
        payload.puppyId ? String(payload.puppyId) : String(editingPuppy.id),
      );

      setNotice({
        tone: "success",
        message:
          "Puppy saved. Contracted revenue, collected payments, and linked litter totals were recalculated from live admin data.",
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

  const totalLitters = summary?.totalLitters ?? workspace?.litters.length ?? 0;
  const contractedRevenue = summary?.contractedRevenue ?? 0;
  const projectedRevenue = summary?.projectedRevenue ?? 0;
  const totalPayments = summary?.totalPayments ?? 0;
  const lineageGapCount =
    workspace?.litters.filter((item) => !item.dam_id || !item.sire_id).length || 0;
  const totalLinkedPuppies =
    workspace?.litters.reduce((sum, litter) => sum + litter.puppies.length, 0) || 0;

  const selectedSummary = selectedLitter?.summary;
  const selectedContracted = selectedSummary?.contractedRevenue ?? 0;
  const selectedCollected = selectedSummary?.totalPayments ?? 0;
  const selectedCompleted = selectedSummary?.realizedRevenue ?? 0;
  const selectedProjected = selectedSummary?.projectedRevenue ?? 0;
  const selectedDeposits = selectedSummary?.totalDeposits ?? 0;
  const selectedAverageSale =
    selectedPuppies.length > 0
      ? selectedPuppies.reduce((sum, puppy) => sum + Number(puppy.price || 0), 0) /
        selectedPuppies.length
      : 0;

  const linkedVisiblePrices = selectedPuppies.filter(
    (puppy) => !shouldHidePublicPuppyPrice(puppy.status),
  ).length;

  return (
    <AdminPageShell>
      <div className="space-y-5 pb-10">
        <AdminPageHero
          eyebrow="Breeding • Litters"
          title="A cleaner litter registry with one control surface for lineage, puppies, and internal revenue."
          description="This page is now focused on what actually belongs here: the litter registry, the selected litter workspace, and the linked puppy ledger. Repeated summary clutter is gone, the right rail is now a real editing workspace, and navigation into users, payments, puppies, and breeding is tighter."
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
              <AdminHeroSecondaryAction href="/admin/users">
                Open Users
              </AdminHeroSecondaryAction>
            </>
          }
          aside={
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <AdminInfoTile
                label="Contracted Revenue"
                value={fmtMoney(contractedRevenue)}
                detail="Reserved, sold, and completed puppy sale values counted internally."
              />
              <AdminInfoTile
                label="Projected Pipeline"
                value={fmtMoney(projectedRevenue)}
                detail="Still-open value remaining across available puppies."
              />
              <AdminInfoTile
                label="Collected Payments"
                value={fmtMoney(totalPayments)}
                detail="Read from linked buyer payment records."
              />
            </div>
          }
        />

        <AdminPanel
          title="Workspace Navigation"
          subtitle="Quick routes that actually support the litter workflow."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <WorkspaceNavCard
              href="/admin/users"
              title="Users"
              detail="buyer accounts and portal access"
            />
            <WorkspaceNavCard
              href="/admin/portal/puppies"
              title="Puppies"
              detail="listings, assignments, pricing"
            />
            <WorkspaceNavCard
              href="/admin/portal/dams-sires"
              title="Breeding Program"
              detail="dams, sires, lifetime output"
            />
            <WorkspaceNavCard
              href="/admin/portal/payments"
              title="Payments"
              detail="deposits, balances, collected cash"
            />
            <WorkspaceNavCard
              href="/admin/portal/applications"
              title="Applications"
              detail="review queue and conversion flow"
            />
          </div>
        </AdminPanel>

        {notice ? <Notice tone={notice.tone} message={notice.message} /> : null}

        <AdminPanel
          title="Litter Bench"
          subtitle="This page should surface breeding-cycle readiness, lineage gaps, and placement progress for each litter without forcing you into a separate scorecard row."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminInfoTile
              label="Litters"
              value={String(totalLitters)}
              detail="Saved registry records across planned, whelped, active, completed, and archived litters."
            />
            <AdminInfoTile
              label="Linked Puppies"
              value={String(totalLinkedPuppies)}
              detail="Puppy records already attached to their litter source of truth."
            />
            <AdminInfoTile
              label="Parent Gaps"
              value={String(lineageGapCount)}
              detail="Litters still missing a confirmed sire or dam relationship in the breeding program."
            />
            <AdminInfoTile
              label="Collected Cash"
              value={fmtMoney(totalPayments)}
              detail="Payments already collected across puppy accounts tied back to their litter records."
            />
          </div>
        </AdminPanel>

        <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.22fr)_460px]">
          <div className="space-y-5">
            <AdminPanel
              title="Litter Registry"
              subtitle="Search, filter, and select a saved litter. The registry is the source list. The right workspace handles detail and editing."
            >
              <div className="mb-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_210px_auto_auto]">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search litter, code, parents, notes, or linked puppies..."
                  className="w-full rounded-[16px] border border-[var(--portal-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--portal-text)] outline-none transition focus:border-[var(--portal-accent)] focus:ring-2 focus:ring-[rgba(90,142,245,0.14)]"
                />

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="w-full rounded-[16px] border border-[var(--portal-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--portal-text)] outline-none transition focus:border-[var(--portal-accent)] focus:ring-2 focus:ring-[rgba(90,142,245,0.14)]"
                >
                  {LITTER_STATUS_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-[16px] border border-[var(--portal-border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]"
                >
                  Clear
                </button>

                <button
                  type="button"
                  onClick={openCreate}
                  className="rounded-[16px] border border-[#d3b08b] bg-[#fff7ed] px-4 py-2.5 text-sm font-semibold text-[#8b5f36] transition hover:border-[#bf9467]"
                >
                  New Litter
                </button>
              </div>

              {filteredLitters.length ? (
                <div className="overflow-hidden rounded-[22px] border border-[var(--portal-border)]">
                  <table className="min-w-full divide-y divide-[#eee1d2] text-sm">
                    <thead className="bg-[var(--portal-surface-muted)] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                      <tr>
                        <th className="px-4 py-3">Litter</th>
                        <th className="px-4 py-3">Parents</th>
                        <th className="px-4 py-3">Puppies</th>
                        <th className="px-4 py-3">Contracted</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Open</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1e6da] bg-white">
                      {filteredLitters.map((litter) => {
                        const active = !createMode && String(litter.id) === selectedId;
                        return (
                          <tr
                            key={litter.id}
                            onClick={() => openExisting(String(litter.id))}
                            className={`cursor-pointer transition hover:bg-[var(--portal-surface-muted)] ${
                              active ? "bg-[var(--portal-surface-muted)]" : ""
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="font-semibold text-[var(--portal-text)]">
                                {litterName(litter)}
                              </div>
                              <div className="mt-1 text-xs text-[var(--portal-text-soft)]">
                                {litter.litter_code || "No code"} • {displayDate(litter.whelp_date)}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[var(--portal-text-soft)]">
                              {dogName(litter.damProfile)} / {dogName(litter.sireProfile)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-[var(--portal-text)]">
                                {litter.puppies.length}
                              </div>
                              <div className="mt-1 text-xs text-[var(--portal-text-soft)]">
                                linked puppies
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-[var(--portal-text)]">
                                {fmtMoney(litter.summary.contractedRevenue ?? 0)}
                              </div>
                              <div className="mt-1 text-xs text-[var(--portal-text-soft)]">
                                {fmtMoney(litter.summary.totalPayments ?? 0)} collected
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${adminStatusBadge(
                                  litter.status,
                                )}`}
                              >
                                {litter.status || "planned"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openExisting(String(litter.id));
                                }}
                                className="rounded-full border border-[var(--portal-border)] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7a5b3d] transition hover:border-[var(--portal-border-strong)]"
                              >
                                Open
                              </button>
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
              title="Linked Puppy Ledger"
              subtitle={
                createMode
                  ? "Save the litter first, then linked puppies and revenue detail will activate here."
                  : "This section belongs on the litter page because it explains the numbers. Puppy editing opens in the side drawer."
              }
            >
              {selectedLitter ? (
                selectedPuppies.length ? (
                  <div className="space-y-4">
                    <div className="overflow-hidden rounded-[22px] border border-[var(--portal-border)]">
                      <table className="min-w-full divide-y divide-[#eee1d2] text-sm">
                        <thead className="bg-[var(--portal-surface-muted)] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                          <tr>
                            <th className="px-4 py-3">Puppy</th>
                            <th className="px-4 py-3">Buyer</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Internal Sale</th>
                            <th className="px-4 py-3">Public</th>
                            <th className="px-4 py-3">Payments</th>
                            <th className="px-4 py-3 text-right">Edit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f1e6da] bg-white">
                          {selectedPuppies.map((puppy) => {
                            const active = String(puppy.id) === activePuppyId;
                            const publicHidden = shouldHidePublicPuppyPrice(puppy.status);

                            return (
                              <tr
                                key={puppy.id}
                                onClick={() => openPuppy(String(puppy.id))}
                                className={`cursor-pointer transition hover:bg-[var(--portal-surface-muted)] ${
                                  active ? "bg-[var(--portal-surface-muted)]" : ""
                                }`}
                              >
                                <td className="px-4 py-3">
                                  <div className="font-semibold text-[var(--portal-text)]">
                                    {puppy.displayName}
                                  </div>
                                  <div className="mt-1 text-xs text-[var(--portal-text-soft)]">
                                    {publicHidden ? "Public price hidden" : "Public price visible"}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-[var(--portal-text-soft)]">
                                  {buyerName(puppy.buyer)}
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${adminStatusBadge(
                                      puppy.status,
                                    )}`}
                                  >
                                    {puppy.status || "available"}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-semibold text-[var(--portal-text)]">
                                    {fmtMoney(Number(puppy.price || 0))}
                                  </div>
                                  <div className="mt-1 text-xs text-[var(--portal-text-soft)]">
                                    listed {fmtMoney(Number(puppy.list_price || puppy.price || 0))}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-semibold text-[var(--portal-text)]">
                                    {publicHidden ? "Hidden" : "Visible"}
                                  </div>
                                  <div className="mt-1 text-xs text-[var(--portal-text-soft)]">
                                    {publicHidden ? "internal only" : "website eligible"}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-semibold text-[var(--portal-text)]">
                                    {fmtMoney(puppy.paymentTotal || 0)}
                                  </div>
                                  <div className="mt-1 text-xs text-[var(--portal-text-soft)]">
                                    deposit {fmtMoney(Number(puppy.deposit || 0))}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openPuppy(String(puppy.id));
                                    }}
                                    className="rounded-full border border-[#d8b188] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8b5f36] transition hover:border-[#c68e56]"
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

                    <div className="grid gap-3 md:grid-cols-5">
                      <SecondaryMeta
                        label="Linked Puppies"
                        value={String(selectedPuppies.length)}
                      />
                      <SecondaryMeta
                        label="Contracted Revenue"
                        value={fmtMoney(selectedContracted)}
                      />
                      <SecondaryMeta
                        label="Collected Payments"
                        value={fmtMoney(selectedCollected)}
                      />
                      <SecondaryMeta
                        label="Deposits"
                        value={fmtMoney(selectedDeposits)}
                      />
                      <SecondaryMeta
                        label="Visible Public Prices"
                        value={String(linkedVisiblePrices)}
                      />
                    </div>
                  </div>
                ) : (
                  <EmptySelection
                    title="No puppies linked yet"
                    description="This litter record exists, but it does not have any linked puppies yet. Once puppies are attached, this ledger becomes the quickest way to audit internal sale values, public visibility, and collected payments."
                  />
                )
              ) : (
                <EmptySelection
                  title="Select a litter to view its puppy ledger"
                  description="The linked puppy ledger belongs under the registry because it explains exactly why the litter totals look the way they do."
                />
              )}
            </AdminPanel>
          </div>

          <div className="space-y-5 2xl:sticky 2xl:top-5 self-start">
            <AdminPanel
              title={createMode ? "Create Litter Workspace" : "Selected Litter Workspace"}
              subtitle={
                createMode
                  ? "Create mode keeps the right side focused on one job: making a clean litter record."
                  : "The right side is now a true editing workspace instead of a cluttered summary wall."
              }
            >
              {createMode ? (
                <div className="mb-4 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                  You are creating a new litter record.
                </div>
              ) : selectedLitter ? (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                      Active Record
                    </div>
                    <div className="mt-1 text-base font-semibold text-[var(--portal-text)]">
                      {litterName(selectedLitter)}
                    </div>
                  </div>
                  <span
                    className={`inline-flex rounded-full border px-3 py-1.5 text-[11px] font-semibold capitalize ${adminStatusBadge(
                      selectedLitter.status,
                    )}`}
                  >
                    {selectedLitter.status || "planned"}
                  </span>
                </div>
              ) : null}

              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <WorkspaceMetric
                    label="Contracted Revenue"
                    value={fmtMoney(selectedContracted)}
                    detail="Reserved, sold, and completed puppy values."
                  />
                  <WorkspaceMetric
                    label="Collected Payments"
                    value={fmtMoney(selectedCollected)}
                    detail="Read from linked buyer payment records."
                  />
                  <WorkspaceMetric
                    label="Completed Revenue"
                    value={fmtMoney(selectedCompleted)}
                    detail="Realized revenue from completed puppies."
                  />
                  <WorkspaceMetric
                    label="Projected Pipeline"
                    value={fmtMoney(selectedProjected)}
                    detail="Still-open value from available puppies."
                  />
                </div>

                {!createMode && selectedLitter ? (
                  <div className="rounded-[22px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                      Saved Record
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <SavedMeta label="Litter" value={litterName(selectedLitter)} />
                      <SavedMeta
                        label="Parents"
                        value={`${dogName(selectedLitter.damProfile)} / ${dogName(selectedLitter.sireProfile)}`}
                      />
                      <SavedMeta
                        label="Whelp Date"
                        value={displayDate(selectedLitter.whelp_date)}
                      />
                      <SavedMeta
                        label="Status"
                        value={String(selectedLitter.status || "planned")}
                      />
                      <SavedMeta
                        label="Puppy Count"
                        value={String(selectedPuppies.length)}
                      />
                      <SavedMeta
                        label="Average Sale"
                        value={fmtMoney(selectedAverageSale)}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="rounded-[22px] border border-[var(--portal-border)] bg-white p-5">
                  <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                    Litter Record
                  </div>

                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <AdminTextInput
                        label="Litter Code"
                        value={form.litter_code}
                        onChange={(value) => updateForm("litter_code", value)}
                        placeholder="e.g. 01122026"
                      />
                      <AdminTextInput
                        label="Litter Name"
                        value={form.litter_name}
                        onChange={(value) => updateForm("litter_name", value)}
                        placeholder="Display name"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <AdminSelectInput
                        label="Dam"
                        value={form.dam_id}
                        onChange={(value) => updateForm("dam_id", value)}
                        options={[
                          { value: "", label: "No dam selected" },
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
                          { value: "", label: "No sire selected" },
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
                        options={LITTER_STATUS_OPTIONS.filter((item) => item.value !== "all")}
                      />
                    </div>

                    <AdminTextAreaInput
                      label="Notes"
                      value={form.notes}
                      onChange={(value) => updateForm("notes", value)}
                      rows={5}
                      placeholder="Internal litter notes."
                    />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={saveLitter}
                      disabled={saving}
                      className="rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(159,99,49,0.22)] transition hover:brightness-105 disabled:opacity-60"
                    >
                      {saving ? "Saving..." : createMode ? "Create Litter" : "Save Litter"}
                    </button>

                    <button
                      type="button"
                      onClick={resetDetail}
                      className="rounded-2xl border border-[var(--portal-border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]"
                    >
                      {createMode ? "Reset Form" : "Reset to Saved"}
                    </button>

                    {createMode ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCreateMode(false);
                          setSelectedId(String(workspace?.litters[0]?.id || ""));
                          setForm(
                            populateLitterForm(
                              workspace?.litters.find(
                                (item) => String(item.id) === String(workspace?.litters[0]?.id || ""),
                              ) || null,
                            ),
                          );
                          setNotice(null);
                        }}
                        className="rounded-2xl border border-[var(--portal-border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]"
                      >
                        Cancel Create
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </AdminPanel>
          </div>
        </section>

        {editingPuppy ? (
          <PuppyDrawer
            puppy={editingPuppy}
            form={puppyForm}
            onChange={updatePuppyForm}
            onClose={() => setActivePuppyId("")}
            onSave={savePuppy}
            saving={puppySaving}
            litterOptions={litterOptions}
            buyerOptions={buyerOptions}
          />
        ) : null}
      </div>
    </AdminPageShell>
  );
}

