"use client";

import React, { useEffect, useState } from "react";
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
  AdminSelectInput,
  AdminTextAreaInput,
  AdminTextInput,
} from "@/components/admin/admin-form-fields";
import {
  type AdminLineageDog,
  type AdminLineageDogRef,
  type AdminLineageLitter,
  type AdminLineageWorkspace,
} from "@/lib/admin-portal";
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

type NoticeTone = "success" | "error" | "neutral";

type NoticeState = {
  tone: NoticeTone;
  message: string;
};

function emptyForm(): LitterForm {
  return {
    litter_code: "",
    litter_name: "",
    dam_id: "",
    sire_id: "",
    whelp_date: "",
    status: "planned",
    notes: "",
  };
}

function populateForm(litter: AdminLineageLitter | null): LitterForm {
  if (!litter) return emptyForm();
  return {
    litter_code: String(litter.litter_code || ""),
    litter_name: String(litter.litter_name || ""),
    dam_id: litter.dam_id ? String(litter.dam_id) : "",
    sire_id: litter.sire_id ? String(litter.sire_id) : "",
    whelp_date: String(litter.whelp_date || ""),
    status: String(litter.status || "planned"),
    notes: String(litter.notes || ""),
  };
}

function resolveDogName(dog: AdminLineageDogRef | AdminLineageDog | null | undefined) {
  return dog?.displayName || dog?.dog_name || dog?.name || dog?.call_name || "Not linked";
}

function resolveLitterName(litter: AdminLineageLitter | null | undefined) {
  return litter?.displayName || litter?.litter_name || litter?.litter_code || "Litter record";
}

async function requestLineageWorkspace(accessToken: string) {
  const response = await fetch("/api/admin/portal/lineage", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  let payload: { ok?: boolean; error?: string; workspace?: AdminLineageWorkspace } | null = null;
  try {
    payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
      workspace?: AdminLineageWorkspace;
    };
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.workspace) {
    throw new Error(payload?.error || "Could not load the litter workspace.");
  }

  return payload.workspace;
}

export default function AdminPortalLittersPage() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const [workspace, setWorkspace] = useState<AdminLineageWorkspace | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [createMode, setCreateMode] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [form, setForm] = useState<LitterForm>(emptyForm());

  async function loadWorkspace(
    preferredId?: string,
    nextCreateMode = false,
    options?: { preserveNotice?: boolean }
  ) {
    if (!accessToken) return null;
    const nextWorkspace = await requestLineageWorkspace(accessToken);
    setWorkspace(nextWorkspace);
    setCreateMode(nextCreateMode);

    if (!options?.preserveNotice) {
      setNotice(null);
    }

    if (nextCreateMode) {
      setSelectedId("");
      setForm(emptyForm());
      return nextWorkspace;
    }

    const candidateId =
      preferredId && nextWorkspace.litters.some((item) => String(item.id) === preferredId)
        ? preferredId
        : nextWorkspace.litters[0]
          ? String(nextWorkspace.litters[0].id)
          : "";

    setSelectedId(candidateId);
    const selected =
      nextWorkspace.litters.find((item) => String(item.id) === candidateId) || null;
    setForm(populateForm(selected));
    return nextWorkspace;
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!accessToken || !isAdmin) {
        if (!active) return;
        setWorkspace(null);
        setLoadingData(false);
        return;
      }

      setLoadingData(true);
      try {
        const nextWorkspace = await requestLineageWorkspace(accessToken);
        if (!active) return;
        setWorkspace(nextWorkspace);
        const nextSelectedId = nextWorkspace.litters[0] ? String(nextWorkspace.litters[0].id) : "";
        setSelectedId(nextSelectedId);
        setForm(
          populateForm(
            nextWorkspace.litters.find((item) => String(item.id) === nextSelectedId) || null
          )
        );
      } catch (error) {
        if (!active) return;
        setNotice({
          tone: "error",
          message:
            error instanceof Error ? error.message : "Could not load the litter workspace.",
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
  const damOptions = dogs.filter((dog) => String(dog.role || "").toLowerCase() === "dam");
  const sireOptions = dogs.filter((dog) => String(dog.role || "").toLowerCase() === "sire");

  const litters = (workspace?.litters || []).filter((litter) => {
    if (statusFilter !== "all" && String(litter.status || "").toLowerCase() !== statusFilter) {
      return false;
    }

    const q = search.trim().toLowerCase();
    if (!q) return true;

    return [
      litter.displayName,
      litter.litter_code,
      litter.status,
      litter.notes,
      resolveDogName(litter.damProfile),
      resolveDogName(litter.sireProfile),
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

  useEffect(() => {
    if (createMode) {
      setForm(emptyForm());
      return;
    }

    setForm(populateForm(selectedLitter));
  }, [createMode, selectedLitter]);

  useEffect(() => {
    if (createMode) return;
    if (!litters.length) {
      setSelectedId("");
      return;
    }

    if (!litters.some((item) => String(item.id) === selectedId)) {
      setSelectedId(String(litters[0].id));
    }
  }, [createMode, litters, selectedId]);

  async function saveLitter() {
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
        ok?: boolean;
        error?: string;
        litterId?: number;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not save the litter.");
      }

      const savedId = payload.litterId ? String(payload.litterId) : selectedId;

      try {
        await loadWorkspace(savedId, false, { preserveNotice: true });
        setNotice({
          tone: "success",
          message: createMode
            ? "Litter created and reloaded from the saved lineage record."
            : "Litter saved. Parent linkage, table rows, and summary data are now synced to the database.",
        });
      } catch (refreshError) {
        setNotice({
          tone: "error",
          message:
            refreshError instanceof Error
              ? `The litter saved, but the workspace could not be refreshed: ${refreshError.message}`
              : "The litter saved, but the workspace could not be refreshed.",
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save the litter.";
      if (!createMode && selectedId) {
        try {
          await loadWorkspace(selectedId, false, { preserveNotice: true });
        } catch {
          // Keep the last good workspace visible if a recovery refresh fails.
        }
      }
      setNotice({
        tone: "error",
        message,
      });
    } finally {
      setSaving(false);
    }
  }

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
        details="This workspace is reserved for the Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!isAdmin) {
    return (
      <AdminRestrictedState
        title="This litter workspace is limited to approved owner accounts."
        details="Only the approved owner emails can manage lineage and litter records."
      />
    );
  }

  const summary = workspace?.summary;
  const lineageGaps = (workspace?.litters || []).filter((litter) => !litter.dam_id || !litter.sire_id)
    .length;
  const activePipeline = (workspace?.litters || []).reduce(
    (sum, litter) => sum + litter.summary.reservedCount + litter.summary.availableCount,
    0
  );

  return (
    <AdminPageShell>
      <div className="space-y-4 pb-8">
        <AdminPageHero
          eyebrow="Litters"
          title="Run litters as true lineage records, not loose notes."
          description="This workspace now treats litter records as the source of truth for parent linkage, puppy rollups, and revenue reporting. The registry on the left and the saved-detail console on the right stay aligned to the same persisted record."
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  setCreateMode(true);
                  setForm(emptyForm());
                  setNotice(null);
                }}
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
                label="Projected Pipeline"
                value={fmtMoney(summary?.projectedRevenue || 0)}
                detail={`${activePipeline} puppies still in available or reserved flow.`}
              />
              <AdminInfoTile
                label="Realized Revenue"
                value={fmtMoney(summary?.realizedRevenue || 0)}
                detail="Completed lineage revenue remains visible internally even when public prices are hidden."
              />
            </div>
          }
        />

        <AdminMetricGrid>
          <AdminMetricCard
            label="Litters"
            value={String(workspace?.litters.length || 0)}
            detail="Saved litter records with direct sire and dam linkage."
          />
          <AdminMetricCard
            label="Parent Gaps"
            value={String(lineageGaps)}
            detail={
              lineageGaps
                ? "Some litters still need a saved sire or dam assignment."
                : "Every saved litter currently has both parents linked."
            }
            accent="from-[#efe2cf] via-[#ddbe97] to-[#bf8856]"
          />
          <AdminMetricCard
            label="Puppies Produced"
            value={String(summary?.totalPuppies || 0)}
            detail={`${summary?.availableCount || 0} available | ${summary?.reservedCount || 0} reserved | ${summary?.completedCount || 0} completed`}
            accent="from-[#dfe8d8] via-[#c6d6ba] to-[#8aa07e]"
          />
          <AdminMetricCard
            label="Average Sale Price"
            value={fmtMoney(summary?.averageSalePrice || 0)}
            detail="Internal average across reserved, completed, and sold outcomes."
            accent="from-[#e7ddd3] via-[#c9b39a] to-[#8f6f53]"
          />
        </AdminMetricGrid>

        <section className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.34fr)_440px]">
          <div className="space-y-4">
            <AdminPanel
              title="Litter Registry"
              subtitle="Search by litter, parent, status, or linked puppy. Parent labels in the table resolve from the saved litter record."
            >
              <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px] xl:min-w-0 xl:flex-1">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search litters, parents, or puppies..."
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
                    <option value="whelped">Whelped</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8f6f53]">
                  <span>{litters.length} in view</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                    }}
                    className="rounded-full border border-[#e4d2be] bg-white px-3 py-2 text-[11px] font-semibold text-[#7a5b3d] transition hover:border-[#d4b48b]"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>

              {litters.length ? (
                <div className="overflow-hidden rounded-[24px] border border-[#ead9c7]">
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
                            onClick={() => {
                              setCreateMode(false);
                              setSelectedId(String(litter.id));
                              setNotice(null);
                            }}
                            className={`cursor-pointer transition hover:bg-[#fffaf4] ${
                              active ? "bg-[#fff8ef]" : ""
                            }`}
                          >
                            <td className="px-4 py-3 align-top">
                              <div className="font-semibold text-[#2f2218]">{litter.displayName}</div>
                              <div className="mt-1 text-xs text-[#8a6a49]">
                                {litter.litter_code || "No code"} | {litter.summary.totalPuppies} puppies
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top text-[#73583f]">
                              <div>{resolveDogName(litter.damProfile)}</div>
                              <div className="mt-1 text-xs text-[#9a7a57]">
                                {resolveDogName(litter.sireProfile)}
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top text-[#73583f]">
                              {litter.whelp_date ? fmtDate(litter.whelp_date) : "Not set"}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <div className="font-semibold text-[#2f2218]">
                                {fmtMoney(litter.summary.realizedRevenue)}
                              </div>
                              <div className="mt-1 text-xs text-[#8a6a49]">
                                {fmtMoney(litter.summary.projectedRevenue)} projected
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(
                                  litter.status || "pending"
                                )}`}
                              >
                                {litter.status || "pending"}
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
                  description="Create a litter or widen the search to bring the lineage registry back into view."
                />
              )}
            </AdminPanel>

            <AdminPanel
              title="Linked Puppies"
              subtitle="This table resolves puppy outcomes against the selected litter so the page stays dense and operational instead of leaving empty space."
            >
              {selectedLitter?.puppies.length ? (
                <div className="overflow-hidden rounded-[24px] border border-[#ead9c7]">
                  <table className="min-w-full divide-y divide-[#eee1d2] text-sm">
                    <thead className="bg-[#faf3ea] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9c7043]">
                      <tr>
                        <th className="px-4 py-3">Puppy</th>
                        <th className="px-4 py-3">Buyer</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Sale</th>
                        <th className="px-4 py-3">Payments</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1e6da] bg-white">
                      {selectedLitter.puppies.map((puppy) => (
                        <tr key={puppy.id} className="hover:bg-[#fffaf4]">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-[#2f2218]">{puppy.displayName}</div>
                            <div className="mt-1 text-xs text-[#8a6a49]">
                              {puppy.sex || "Sex not set"} | {puppy.color || "Color not set"}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[#73583f]">
                            {puppy.buyer?.full_name ||
                              puppy.buyer?.name ||
                              puppy.owner_email ||
                              "No buyer assigned"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(
                                puppy.status || "pending"
                              )}`}
                            >
                              {puppy.status || "pending"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-[#2f2218]">
                              {fmtMoney(puppy.salePrice || puppy.listPrice || 0)}
                            </div>
                            <div className="mt-1 text-xs text-[#8a6a49]">
                              {fmtMoney(puppy.depositTotal || 0)} deposit
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[#73583f]">
                            {fmtMoney(puppy.paymentTotal || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <AdminEmptyState
                  title="No puppies linked yet"
                  description="Assign puppies to this litter from the puppy workspace and the litter revenue board will fill in automatically."
                />
              )}

              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/admin/portal/puppies"
                  className="rounded-2xl border border-[#e4d2be] bg-white px-4 py-3 text-sm font-semibold text-[#5d4330] transition hover:border-[#d4b48b]"
                >
                  Open Puppies
                </Link>
                <Link
                  href="/admin/portal/dams-sires"
                  className="rounded-2xl border border-[#e4d2be] bg-white px-4 py-3 text-sm font-semibold text-[#5d4330] transition hover:border-[#d4b48b]"
                >
                  Open Breeding Program
                </Link>
              </div>
            </AdminPanel>
          </div>

          <div className="space-y-4 2xl:sticky 2xl:top-6">
            <AdminPanel
              title={createMode ? "Create Litter" : "Litter Detail"}
              subtitle={
                createMode
                  ? "Create a new litter record with saved sire and dam linkage."
                  : "The summary below reads from the saved litter record. Edit controls update that same source of truth."
              }
            >
              {notice ? <NoticeBanner tone={notice.tone} message={notice.message} /> : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <AdminInfoTile
                  label="Dam"
                  value={createMode ? "Not saved yet" : resolveDogName(selectedLitter?.damProfile)}
                  detail="Saved parent linkage for this litter."
                />
                <AdminInfoTile
                  label="Sire"
                  value={createMode ? "Not saved yet" : resolveDogName(selectedLitter?.sireProfile)}
                  detail="Saved parent linkage for this litter."
                />
                <AdminInfoTile
                  label="Completed Revenue"
                  value={fmtMoney(selectedLitter?.summary.realizedRevenue || 0)}
                  detail="Internal revenue preserved for reporting."
                />
                <AdminInfoTile
                  label="Projected Pipeline"
                  value={fmtMoney(selectedLitter?.summary.projectedRevenue || 0)}
                  detail={`${selectedLitter?.summary.reservedCount || 0} reserved | ${selectedLitter?.summary.availableCount || 0} available`}
                />
              </div>

              <div className="mt-4 rounded-[22px] border border-[#ead9c7] bg-[#fffaf4] px-4 py-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SavedMeta label="Saved Record" value={resolveLitterName(selectedLitter)} />
                  <SavedMeta
                    label="Whelp Date"
                    value={selectedLitter?.whelp_date ? fmtDate(selectedLitter.whelp_date) : "Not set"}
                  />
                  <SavedMeta
                    label="Status"
                    value={selectedLitter?.status || (createMode ? "Planned" : "Not set")}
                  />
                  <SavedMeta
                    label="Puppy Count"
                    value={String(selectedLitter?.summary.totalPuppies || 0)}
                  />
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <AdminTextInput
                  label="Litter Code"
                  value={form.litter_code}
                  onChange={(value) => setForm((current) => ({ ...current, litter_code: value }))}
                  placeholder="2026-Spring-A"
                />
                <AdminTextInput
                  label="Litter Name"
                  value={form.litter_name}
                  onChange={(value) => setForm((current) => ({ ...current, litter_name: value }))}
                  placeholder="Spring Cocoa Pairing"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <AdminSelectInput
                    label="Dam"
                    value={form.dam_id}
                    onChange={(value) => setForm((current) => ({ ...current, dam_id: value }))}
                    options={[
                      { value: "", label: "Select dam" },
                      ...damOptions.map((dog) => ({
                        value: String(dog.id),
                        label: resolveDogName(dog),
                      })),
                    ]}
                  />
                  <AdminSelectInput
                    label="Sire"
                    value={form.sire_id}
                    onChange={(value) => setForm((current) => ({ ...current, sire_id: value }))}
                    options={[
                      { value: "", label: "Select sire" },
                      ...sireOptions.map((dog) => ({
                        value: String(dog.id),
                        label: resolveDogName(dog),
                      })),
                    ]}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <AdminDateInput
                    label="Whelp Date"
                    value={form.whelp_date}
                    onChange={(value) => setForm((current) => ({ ...current, whelp_date: value }))}
                  />
                  <AdminSelectInput
                    label="Status"
                    value={form.status}
                    onChange={(value) => setForm((current) => ({ ...current, status: value }))}
                    options={[
                      { value: "planned", label: "Planned" },
                      { value: "active", label: "Active" },
                      { value: "whelped", label: "Whelped" },
                      { value: "completed", label: "Completed" },
                      { value: "archived", label: "Archived" },
                    ]}
                  />
                </div>
                <AdminTextAreaInput
                  label="Notes"
                  value={form.notes}
                  onChange={(value) => setForm((current) => ({ ...current, notes: value }))}
                  rows={5}
                  placeholder="Pairing notes, timeline notes, or internal breeder reminders."
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
                    setCreateMode(false);
                    setForm(populateForm(savedSelectedLitter));
                    setNotice(null);
                  }}
                  className="rounded-2xl border border-[#e4d2be] bg-white px-5 py-3 text-sm font-semibold text-[#5d4330] transition hover:border-[#d4b48b]"
                >
                  Reset to Saved
                </button>
              </div>
            </AdminPanel>
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}

function NoticeBanner({ tone, message }: NoticeState) {
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
