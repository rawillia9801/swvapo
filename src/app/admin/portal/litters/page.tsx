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
  fetchAdminLineageWorkspace,
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

function dogName(dog: AdminLineageDogRef | AdminLineageDog | null | undefined) {
  return dog?.displayName || "Not linked";
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
  const [statusText, setStatusText] = useState("");
  const [form, setForm] = useState<LitterForm>(emptyForm());

  async function refreshWorkspace(preferredId?: string, nextCreateMode = false) {
    if (!accessToken) return;
    const nextWorkspace = await fetchAdminLineageWorkspace(accessToken);
    setWorkspace(nextWorkspace);
    setCreateMode(nextCreateMode);
    if (nextCreateMode) {
      setSelectedId("");
      return;
    }

    const candidateId =
      preferredId && nextWorkspace?.litters.some((item) => String(item.id) === preferredId)
        ? preferredId
        : nextWorkspace?.litters[0]
          ? String(nextWorkspace.litters[0].id)
          : "";
    setSelectedId(candidateId);
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
        const nextWorkspace = await fetchAdminLineageWorkspace(accessToken);
        if (!active) return;
        setWorkspace(nextWorkspace);
        setSelectedId(nextWorkspace?.litters[0] ? String(nextWorkspace.litters[0].id) : "");
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
      litter.damProfile?.displayName,
      litter.sireProfile?.displayName,
      ...litter.puppies.map((puppy) => puppy.displayName),
    ]
      .map((value) => String(value || "").toLowerCase())
      .join(" ")
      .includes(q);
  });

  const selectedLitter = createMode
    ? null
    : litters.find((item) => String(item.id) === selectedId) ||
      workspace?.litters.find((item) => String(item.id) === selectedId) ||
      null;

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
    setStatusText("");

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

      const payload = (await response.json()) as { ok?: boolean; error?: string; litterId?: number };
      if (!response.ok) {
        throw new Error(payload.error || "Could not save the litter.");
      }

      await refreshWorkspace(payload.litterId ? String(payload.litterId) : selectedId, false);
      setStatusText(createMode ? "Litter created." : "Litter updated.");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not save the litter.");
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

  return (
    <AdminPageShell>
      <div className="space-y-5 pb-10">
        <AdminPageHero
          eyebrow="Litters"
          title="Track every litter with direct parent lineage, puppy outcomes, and revenue."
          description="Litters are now first-class records instead of implied relationships. This workspace keeps whelping, parent lineage, puppy counts, and realized revenue in one operational screen."
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  setCreateMode(true);
                  setForm(emptyForm());
                  setStatusText("");
                }}
                className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(159,99,49,0.22)] transition hover:-translate-y-0.5 hover:brightness-105"
              >
                Create Litter
              </button>
              <AdminHeroPrimaryAction href="/admin/portal/dams-sires">Open Dams & Sires</AdminHeroPrimaryAction>
              <AdminHeroSecondaryAction href="/admin/portal/puppies">Open Puppies</AdminHeroSecondaryAction>
            </>
          }
          aside={
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <AdminInfoTile
                label="Projected Revenue"
                value={fmtMoney(summary?.projectedRevenue || 0)}
                detail="Pipeline value still in play across available and reserved puppies."
              />
              <AdminInfoTile
                label="Realized Revenue"
                value={fmtMoney(summary?.realizedRevenue || 0)}
                detail="Completed lineage revenue aggregated through litter-linked puppies."
              />
            </div>
          }
        />

        <AdminMetricGrid>
          <AdminMetricCard
            label="Litters"
            value={String(workspace?.litters.length || 0)}
            detail="All tracked litters with direct dam and sire linkage."
          />
          <AdminMetricCard
            label="Puppies Produced"
            value={String(summary?.totalPuppies || 0)}
            detail={`${summary?.availableCount || 0} available • ${summary?.reservedCount || 0} reserved • ${summary?.completedCount || 0} completed`}
            accent="from-[#dfe8d8] via-[#c6d6ba] to-[#8aa07e]"
          />
          <AdminMetricCard
            label="Deposits"
            value={fmtMoney(summary?.totalDeposits || 0)}
            detail="Deposits still preserved even when public prices are hidden."
            accent="from-[#f0ddc5] via-[#d9b78e] to-[#be8650]"
          />
          <AdminMetricCard
            label="Average Sale Price"
            value={fmtMoney(summary?.averageSalePrice || 0)}
            detail="Internal reporting average across reserved and completed puppies."
            accent="from-[#e7ddd3] via-[#c9b39a] to-[#8f6f53]"
          />
        </AdminMetricGrid>

        <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.22fr)_430px]">
          <AdminPanel title="Litter Registry" subtitle="Search by litter code, name, parent, puppy, or status.">
            <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
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
                            setStatusText("");
                          }}
                          className={`cursor-pointer transition hover:bg-[#fffaf4] ${
                            active ? "bg-[#fff8ef]" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-semibold text-[#2f2218]">{litter.displayName}</div>
                            <div className="mt-1 text-xs text-[#8a6a49]">
                              {litter.litter_code || "No code"} • {litter.summary.totalPuppies} puppies
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[#73583f]">
                            {dogName(litter.damProfile)} / {dogName(litter.sireProfile)}
                          </td>
                          <td className="px-4 py-3 text-[#73583f]">
                            {litter.whelp_date ? fmtDate(litter.whelp_date) : "Not set"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-[#2f2218]">
                              {fmtMoney(litter.summary.realizedRevenue)}
                            </div>
                            <div className="mt-1 text-xs text-[#8a6a49]">
                              {fmtMoney(litter.summary.projectedRevenue)} projected
                            </div>
                          </td>
                          <td className="px-4 py-3">
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
                description="Create a litter or widen the search to bring the lineage board into view."
              />
            )}
          </AdminPanel>

          <div className="space-y-5">
            <AdminPanel
              title={createMode ? "Create Litter" : selectedLitter ? "Litter Detail" : "Litter Detail"}
              subtitle={
                createMode
                  ? "Use one record to anchor the dam, sire, puppies, and revenue for a breeding cycle."
                  : "Review the selected litter, update its lineage assignments, and inspect the linked puppy outcomes."
              }
            >
              {statusText ? (
                <div className="mb-4 rounded-[18px] border border-[#ead9c7] bg-[#fff9f2] px-4 py-3 text-sm font-semibold text-[#7a5a3a]">
                  {statusText}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <AdminInfoTile
                  label="Dam"
                  value={createMode ? "Select a dam" : dogName(selectedLitter?.damProfile)}
                  detail="Every litter belongs to one dam."
                />
                <AdminInfoTile
                  label="Sire"
                  value={createMode ? "Select a sire" : dogName(selectedLitter?.sireProfile)}
                  detail="Every litter belongs to one sire."
                />
                <AdminInfoTile
                  label="Completed Revenue"
                  value={fmtMoney(selectedLitter?.summary.realizedRevenue || 0)}
                  detail="Internal revenue kept for reporting even when public prices are hidden."
                />
                <AdminInfoTile
                  label="Projected Pipeline"
                  value={fmtMoney(selectedLitter?.summary.projectedRevenue || 0)}
                  detail={`${selectedLitter?.summary.reservedCount || 0} reserved • ${selectedLitter?.summary.availableCount || 0} available`}
                />
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
                      ...damOptions.map((dog) => ({ value: String(dog.id), label: dog.displayName })),
                    ]}
                  />
                  <AdminSelectInput
                    label="Sire"
                    value={form.sire_id}
                    onChange={(value) => setForm((current) => ({ ...current, sire_id: value }))}
                    options={[
                      { value: "", label: "Select sire" },
                      ...sireOptions.map((dog) => ({ value: String(dog.id), label: dog.displayName })),
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
                  placeholder="Health notes, go-home schedule, pairing notes, or operational reminders."
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
                    setForm(populateForm(selectedLitter));
                    setStatusText("");
                  }}
                  className="rounded-2xl border border-[#e4d2be] bg-white px-5 py-3 text-sm font-semibold text-[#5d4330] transition hover:border-[#d4b48b]"
                >
                  Reset
                </button>
              </div>
            </AdminPanel>

            <AdminPanel
              title="Linked Puppies"
              subtitle="Puppies inherit dam and sire context through the litter, while still exposing direct lineage for easier querying and reporting."
            >
              {selectedLitter?.puppies.length ? (
                <div className="space-y-3">
                  {selectedLitter.puppies.map((puppy) => (
                    <div
                      key={puppy.id}
                      className="rounded-[22px] border border-[#ead9c7] bg-[#fffaf4] px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[#2f2218]">{puppy.displayName}</div>
                          <div className="mt-1 text-xs text-[#8a6a49]">
                            {puppy.buyer?.full_name || puppy.buyer?.name || puppy.owner_email || "No buyer assigned"}
                          </div>
                        </div>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(
                            puppy.status || "pending"
                          )}`}
                        >
                          {puppy.status || "pending"}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <MiniValue label="Sale" value={fmtMoney(puppy.salePrice || puppy.listPrice || 0)} />
                        <MiniValue label="Deposit" value={fmtMoney(puppy.depositTotal || 0)} />
                        <MiniValue label="Revenue" value={fmtMoney(puppy.paymentTotal || 0)} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <AdminEmptyState
                  title="No puppies linked yet"
                  description="Assign puppies to this litter from the puppy workspace and the lineage chain will fill in automatically."
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
                  Open Dams & Sires
                </Link>
              </div>
            </AdminPanel>
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}

function MiniValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-[#ead9c7] bg-white px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9c7043]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[#2f2218]">{value}</div>
    </div>
  );
}
