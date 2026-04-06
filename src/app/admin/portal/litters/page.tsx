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
  return <div className={`mb-4 rounded-[18px] border px-4 py-3 text-sm font-semibold ${tones[tone]}`}>{message}</div>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[#ead9c7] bg-white px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9c7043]">{label}</div>
      <div className="mt-2 text-sm font-semibold text-[#2f2218]">{value}</div>
    </div>
  );
}

function SavedMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9c7043]">{label}</div>
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
      <button type="button" onClick={onClose} className="absolute inset-0 bg-[rgba(46,29,14,0.28)] backdrop-blur-[2px]" />
      <div className="absolute right-0 top-0 h-full w-full max-w-[540px] border-l border-[#e7d7c6] bg-[linear-gradient(180deg,rgba(255,252,247,0.98),rgba(252,246,239,0.98))] shadow-[0_24px_60px_rgba(72,46,24,0.18)]">
        <div className="flex h-full flex-col">
          <div className="border-b border-[#ead9c7] px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9c7043]">Linked Puppy</div>
                <div className="mt-2 text-xl font-semibold text-[#2f2218]">{puppy.displayName}</div>
                <div className="mt-1 text-sm text-[#7a5b3d]">Internal price edits here refresh the litter revenue immediately.</div>
              </div>
              <button type="button" onClick={onClose} className="rounded-full border border-[#e4d2be] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#7a5b3d] transition hover:border-[#d4b48b]">Close</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <AdminInfoTile label="Internal Sale" value={fmtMoney(Number(form.price || 0))} detail="Used for admin contracted revenue." />
                <AdminInfoTile label="Collected Payments" value={fmtMoney(puppy.paymentTotal || 0)} detail="Read-only here. Manage payments in Payments." />
                <AdminInfoTile label="Public Listing" value={shouldHidePublicPuppyPrice(form.status) ? "Hidden" : fmtMoney(Number(form.list_price || form.price || 0))} detail="Public display is separate from internal revenue." />
                <AdminInfoTile label="Lineage" value={`${dogName(puppy.damProfile)} / ${dogName(puppy.sireProfile)}`} detail="Shown via the litter relationship." />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminTextInput label="Puppy Name" value={form.call_name} onChange={(value) => onChange("call_name", value)} placeholder="Call name" />
                <AdminTextInput label="Record Name" value={form.name} onChange={(value) => onChange("name", value)} placeholder="Formal record name" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminTextInput label="Secondary Name" value={form.puppy_name} onChange={(value) => onChange("puppy_name", value)} placeholder="Optional alternate name" />
                <AdminSelectInput label="Status" value={form.status} onChange={(value) => onChange("status", value)} options={[{ value: "available", label: "Available" }, { value: "expected", label: "Expected" }, { value: "reserved", label: "Reserved" }, { value: "matched", label: "Matched" }, { value: "sold", label: "Sold" }, { value: "adopted", label: "Adopted" }, { value: "completed", label: "Completed" }]} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminSelectInput label="Buyer" value={form.buyer_id} onChange={(value) => onChange("buyer_id", value)} options={buyerOptions} />
                <AdminSelectInput label="Litter Assignment" value={form.litter_id} onChange={(value) => onChange("litter_id", value)} options={[{ value: "", label: "No litter" }, ...litterOptions]} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminNumberInput label="Internal Final Sale Price" value={form.price} onChange={(value) => onChange("price", value)} step="0.01" />
                <AdminNumberInput label="Listed / Public Price" value={form.list_price} onChange={(value) => onChange("list_price", value)} step="0.01" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminNumberInput label="Deposit Amount" value={form.deposit} onChange={(value) => onChange("deposit", value)} step="0.01" />
                <AdminNumberInput label="Balance" value={form.balance} onChange={(value) => onChange("balance", value)} step="0.01" />
              </div>
              <AdminTextAreaInput label="Notes" value={form.notes} onChange={(value) => onChange("notes", value)} rows={5} placeholder="Internal notes for this puppy." />
            </div>
          </div>
          <div className="border-t border-[#ead9c7] px-5 py-4">
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={onSave} disabled={saving} className="rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(159,99,49,0.22)] transition hover:brightness-105 disabled:opacity-60">{saving ? "Saving..." : "Save Puppy"}</button>
              <Link href="/admin/portal/payments" className="rounded-2xl border border-[#e4d2be] bg-white px-5 py-3 text-sm font-semibold text-[#5d4330] transition hover:border-[#d4b48b]">Open Payments</Link>
              <Link href="/admin/portal/puppies" className="rounded-2xl border border-[#e4d2be] bg-white px-5 py-3 text-sm font-semibold text-[#5d4330] transition hover:border-[#d4b48b]">Full Puppy Workspace</Link>
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
      return nextWorkspace;
    }
    const nextId =
      preferredId && nextWorkspace.litters.some((item) => String(item.id) === preferredId)
        ? preferredId
        : String(nextWorkspace.litters[0]?.id || "");
    setSelectedId(nextId);
    const selected = nextWorkspace.litters.find((item) => String(item.id) === nextId) || null;
    setForm(populateLitterForm(selected));
    if (preservePuppyId) {
      const nextPuppy =
        nextWorkspace.puppies.find((item) => String(item.id) === preservePuppyId) || null;
      setActivePuppyId(nextPuppy ? String(nextPuppy.id) : "");
      setPuppyForm(populatePuppyForm(nextPuppy));
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
        if (active) {
          setNotice({
            tone: "error",
            message:
              error instanceof Error ? error.message : "Could not load the litter workspace.",
          });
        }
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
  const buyers = workspace?.buyers || [];
  const damOptions = dogs.filter((dog) => String(dog.role || "").toLowerCase() === "dam");
  const sireOptions = dogs.filter((dog) => String(dog.role || "").toLowerCase() === "sire");
  const litters = (workspace?.litters || []).filter((litter) => {
    if (statusFilter !== "all" && String(litter.status || "").toLowerCase() !== statusFilter) return false;
    const q = search.trim().toLowerCase();
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
  const savedSelectedLitter =
    litters.find((item) => String(item.id) === selectedId) ||
    workspace?.litters.find((item) => String(item.id) === selectedId) ||
    null;
  const selectedLitter = createMode ? null : savedSelectedLitter;
  const editingPuppy =
    selectedLitter?.puppies.find((item) => String(item.id) === activePuppyId) ||
    workspace?.puppies.find((item) => String(item.id) === activePuppyId) ||
    null;
  const buyerOptions = useMemo(
    () => [
      { value: "", label: "Unassigned" },
      ...buyers
        .slice()
        .sort((a, b) => buyerName(a).localeCompare(buyerName(b)))
        .map((buyer) => ({ value: String(buyer.id), label: buyerName(buyer) })),
    ],
    [buyers]
  );

  useEffect(() => {
    setForm(createMode ? emptyForm() : populateLitterForm(selectedLitter));
  }, [createMode, selectedLitter]);

  useEffect(() => {
    if (createMode || !litters.length || litters.some((item) => String(item.id) === selectedId)) return;
    setSelectedId(String(litters[0].id));
  }, [createMode, litters, selectedId]);

  useEffect(() => {
    setPuppyForm(populatePuppyForm(editingPuppy));
  }, [editingPuppy]);

  const saveLitter = async () => {
    if (!accessToken) return;
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/portal/litters", {
        method: createMode ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ id: createMode ? undefined : selectedLitter?.id, ...form }),
      });
      const payload = (await response.json()) as { litterId?: number; error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not save the litter.");
      await loadWorkspace(payload.litterId ? String(payload.litterId) : selectedId, false, true);
      setNotice({
        tone: "success",
        message: createMode
          ? "Litter created and reloaded from the saved lineage record."
          : "Litter saved. Parent linkage and saved summaries are now synchronized.",
      });
    } catch (error) {
      if (!createMode && selectedId) {
        try {
          await loadWorkspace(selectedId, false, true);
        } catch {}
      }
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not save the litter.",
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ id: editingPuppy.id, ...puppyForm }),
      });
      const payload = (await response.json()) as { puppyId?: number; error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not save the puppy.");
      await loadWorkspace(
        String(selectedLitter?.id || selectedId),
        false,
        true,
        payload.puppyId ? String(payload.puppyId) : String(editingPuppy.id)
      );
      setNotice({
        tone: "success",
        message:
          "Puppy saved. Contracted litter revenue, payments, and linked pricing were refreshed from the live admin data.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not save the puppy.",
      });
    } finally {
      setPuppySaving(false);
    }
  };
