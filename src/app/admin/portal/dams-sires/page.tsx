"use client";

import React, { useEffect, useState } from "react";
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
  AdminSelectInput,
  AdminTextAreaInput,
  AdminTextInput,
} from "@/components/admin/admin-form-fields";
import {
  fetchAdminLineageWorkspace,
  type AdminLineageDog,
  type AdminLineageWorkspace,
} from "@/lib/admin-portal";
import { fmtDate, fmtMoney } from "@/lib/utils";
import { usePortalAdminSession } from "@/lib/use-portal-admin-session";

type DogForm = {
  role: string;
  dog_name: string;
  name: string;
  call_name: string;
  status: string;
  date_of_birth: string;
  color: string;
  coat: string;
  registry: string;
  genetics_summary: string;
  genetics_report_url: string;
  genetics_raw: string;
  notes: string;
};

function emptyForm(role = "dam"): DogForm {
  return {
    role,
    dog_name: "",
    name: "",
    call_name: "",
    status: "active",
    date_of_birth: "",
    color: "",
    coat: "",
    registry: "",
    genetics_summary: "",
    genetics_report_url: "",
    genetics_raw: "",
    notes: "",
  };
}

function populateForm(dog: AdminLineageDog | null): DogForm {
  if (!dog) return emptyForm();
  return {
    role: String(dog.role || "dam"),
    dog_name: String(dog.dog_name || dog.displayName || ""),
    name: String(dog.name || dog.registered_name || ""),
    call_name: String(dog.call_name || ""),
    status: String(dog.status || (dog.is_active === false ? "archived" : "active")),
    date_of_birth: String(dog.date_of_birth || dog.dob || ""),
    color: String(dog.color || ""),
    coat: String(dog.coat || dog.coat_type || ""),
    registry: String(dog.registry || dog.registration_no || ""),
    genetics_summary: String(dog.genetics_summary || ""),
    genetics_report_url: String(dog.genetics_report_url || ""),
    genetics_raw: String(dog.genetics_raw || ""),
    notes: String(dog.notes || ""),
  };
}

function roleLabel(role: string | null | undefined) {
  return String(role || "").toLowerCase() === "sire" ? "Sire" : "Dam";
}

export default function AdminPortalDamsSiresPage() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const [workspace, setWorkspace] = useState<AdminLineageWorkspace | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [createMode, setCreateMode] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [form, setForm] = useState<DogForm>(emptyForm());

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
      preferredId && nextWorkspace?.dogs.some((item) => String(item.id) === preferredId)
        ? preferredId
        : nextWorkspace?.dogs[0]
          ? String(nextWorkspace.dogs[0].id)
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
        setSelectedId(nextWorkspace?.dogs[0] ? String(nextWorkspace.dogs[0].id) : "");
      } finally {
        if (active) setLoadingData(false);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [accessToken, isAdmin]);

  const dogs = (workspace?.dogs || []).filter((dog) => {
    if (roleFilter !== "all" && String(dog.role || "").toLowerCase() !== roleFilter) {
      return false;
    }

    const q = search.trim().toLowerCase();
    if (!q) return true;

    return [
      dog.displayName,
      dog.call_name,
      dog.name,
      dog.status,
      dog.notes,
      dog.color,
      dog.coat,
      dog.registry,
      dog.genetics_summary,
      dog.genetics_raw,
      ...dog.litters.map((litter) => litter.displayName),
      ...dog.puppies.map((puppy) => puppy.displayName),
    ]
      .map((value) => String(value || "").toLowerCase())
      .join(" ")
      .includes(q);
  });

  const selectedDog = createMode
    ? null
    : dogs.find((item) => String(item.id) === selectedId) ||
      workspace?.dogs.find((item) => String(item.id) === selectedId) ||
      null;

  useEffect(() => {
    if (createMode) {
      setForm(emptyForm("dam"));
      return;
    }

    setForm(populateForm(selectedDog));
  }, [createMode, selectedDog]);

  useEffect(() => {
    if (createMode) return;
    if (!dogs.length) {
      setSelectedId("");
      return;
    }

    if (!dogs.some((item) => String(item.id) === selectedId)) {
      setSelectedId(String(dogs[0].id));
    }
  }, [createMode, dogs, selectedId]);

  async function saveDog() {
    if (!accessToken) return;
    setSaving(true);
    setStatusText("");

    try {
      const response = await fetch("/api/admin/portal/breeding-dogs", {
        method: createMode ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          id: createMode ? undefined : selectedDog?.id,
          ...form,
        }),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string; dogId?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not save the breeding profile.");
      }

      await refreshWorkspace(payload.dogId ? String(payload.dogId) : selectedId, false);
      setStatusText(createMode ? "Breeding profile created." : "Breeding profile updated.");
    } catch (error) {
      setStatusText(
        error instanceof Error ? error.message : "Could not save the breeding profile."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading || loadingData) {
    return (
      <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">
        Loading dams and sires...
      </div>
    );
  }

  if (!user) {
    return (
      <AdminRestrictedState
        title="Sign in to access breeding profiles."
        details="This workspace is reserved for the Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!isAdmin) {
    return (
      <AdminRestrictedState
        title="This breeding workspace is limited to approved owner accounts."
        details="Only the approved owner emails can manage dams, sires, and lineage records."
      />
    );
  }

  const totalDams =
    workspace?.dogs.filter((dog) => String(dog.role || "").toLowerCase() === "dam").length || 0;
  const totalSires =
    workspace?.dogs.filter((dog) => String(dog.role || "").toLowerCase() === "sire").length || 0;

  return (
    <AdminPageShell>
      <div className="space-y-5 pb-10">
        <AdminPageHero
          eyebrow="Dams & Sires"
          title="Manage breeding profiles with linked litters, puppies, and lifetime revenue."
          description="This page makes parent lineage usable across admin, portal, and public logic. Each dam and sire profile now rolls up litters, puppies produced, completion rate, and realized revenue."
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  setCreateMode(true);
                  setForm(emptyForm("dam"));
                  setStatusText("");
                }}
                className="inline-flex items-center rounded-2xl bg-[linear-gradient(90deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--portal-shadow-md)] transition hover:-translate-y-0.5"
              >
                Add Breeding Dog
              </button>
              <AdminHeroPrimaryAction href="/admin/portal/litters">Open Litters</AdminHeroPrimaryAction>
              <AdminHeroSecondaryAction href="/admin/portal/puppies">Open Puppies</AdminHeroSecondaryAction>
            </>
          }
          aside={
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <AdminInfoTile
                label="Dams"
                value={String(totalDams)}
                detail="Female breeding profiles linked directly to litters and puppies."
              />
              <AdminInfoTile
                label="Sires"
                value={String(totalSires)}
                detail="Male breeding profiles linked directly to litters and puppies."
              />
            </div>
          }
        />

        <AdminPanel
          title="Program Bench"
          subtitle="The breeding program page should immediately show roster strength, litter output, and lifetime contribution."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminInfoTile
              label="Breeding Roster"
              value={String(workspace?.dogs.length || 0)}
              detail={`${totalDams} dams and ${totalSires} sires currently tracked in the program.`}
            />
            <AdminInfoTile
              label="Linked Litters"
              value={String(workspace?.summary.totalLitters || 0)}
              detail="Every litter connected back to parent profiles for cleaner lineage records."
            />
            <AdminInfoTile
              label="Realized Contribution"
              value={fmtMoney(workspace?.summary.realizedRevenue || 0)}
              detail="Completed puppy revenue preserved as lifetime output across the breeding roster."
            />
            <AdminInfoTile
              label="Open Pipeline"
              value={fmtMoney(workspace?.summary.projectedRevenue || 0)}
              detail="Current available and reserved value still working through the program."
            />
          </div>
        </AdminPanel>

        <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.22fr)_430px]">
          <AdminPanel title="Breeding Directory" subtitle="Search by profile name, litter, puppy, color, coat, or notes.">
            <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search dams, sires, litters, or puppies..."
                className="w-full rounded-[16px] border border-[var(--portal-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--portal-text)] outline-none transition focus:border-[var(--portal-accent)] focus:ring-2 focus:ring-[rgba(90,142,245,0.14)]"
              />
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="w-full rounded-[16px] border border-[var(--portal-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--portal-text)] outline-none transition focus:border-[var(--portal-accent)] focus:ring-2 focus:ring-[rgba(90,142,245,0.14)]"
              >
                <option value="all">All roles</option>
                <option value="dam">Dams</option>
                <option value="sire">Sires</option>
              </select>
            </div>

            {dogs.length ? (
              <div className="overflow-hidden rounded-[24px] border border-[var(--portal-border)]">
                <table className="min-w-full divide-y divide-[#eee1d2] text-sm">
                  <thead className="bg-[var(--portal-surface-muted)] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                    <tr>
                      <th className="px-4 py-3">Profile</th>
                      <th className="px-4 py-3">Output</th>
                      <th className="px-4 py-3">Completion</th>
                      <th className="px-4 py-3">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1e6da] bg-white">
                    {dogs.map((dog) => {
                      const active = !createMode && String(dog.id) === selectedId;
                      return (
                        <tr
                          key={dog.id}
                          onClick={() => {
                            setCreateMode(false);
                            setSelectedId(String(dog.id));
                            setStatusText("");
                          }}
                          className={`cursor-pointer transition hover:bg-[var(--portal-surface-muted)] ${
                            active ? "bg-[var(--portal-surface-muted)]" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-[var(--portal-text)]">{dog.displayName}</div>
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(
                                  dog.role || "active"
                                )}`}
                              >
                                {roleLabel(dog.role)}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-[var(--portal-text-soft)]">
                              {dog.status || "active"} • {dog.color || "Color not set"} • {dog.coat || "Coat not set"}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[var(--portal-text-soft)]">
                            {dog.summary.totalLitters} litters • {dog.summary.totalPuppies} puppies
                          </td>
                          <td className="px-4 py-3 text-[var(--portal-text-soft)]">
                            {Math.round(dog.summary.completionRate * 100)}%
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-[var(--portal-text)]">
                              {fmtMoney(dog.summary.realizedRevenue)}
                            </div>
                            <div className="mt-1 text-xs text-[var(--portal-text-soft)]">
                              {fmtMoney(dog.summary.projectedRevenue)} projected
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <AdminEmptyState
                title="No breeding profiles match the current filters"
                description="Add a dam or sire to start tracking lineage output and revenue."
              />
            )}
          </AdminPanel>

          <div className="space-y-5">
            <AdminPanel
              title={createMode ? "Create Breeding Profile" : "Breeding Profile"}
              subtitle={
                createMode
                  ? "Add a dam or sire with the profile details the admin needs for lineage reporting."
                  : "Review the selected profile, update its details, and inspect linked litters and puppies."
              }
            >
              {statusText ? (
                <div className="mb-4 rounded-[18px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--portal-text-soft)]">
                  {statusText}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <AdminInfoTile
                  label="Litters"
                  value={String(selectedDog?.summary.totalLitters || 0)}
                  detail="Total litters linked directly to this breeding profile."
                />
                <AdminInfoTile
                  label="Puppies Produced"
                  value={String(selectedDog?.summary.totalPuppies || 0)}
                  detail={`${selectedDog?.summary.completedCount || 0} completed • ${selectedDog?.summary.reservedCount || 0} reserved`}
                />
                <AdminInfoTile
                  label="Completion Rate"
                  value={`${Math.round((selectedDog?.summary.completionRate || 0) * 100)}%`}
                  detail="Completed puppies divided by total puppies produced."
                />
                <AdminInfoTile
                  label="Realized Revenue"
                  value={fmtMoney(selectedDog?.summary.realizedRevenue || 0)}
                  detail="Lifetime completed revenue linked through litters and puppies."
                />
              </div>

              <div className="mt-5 grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <AdminSelectInput
                    label="Role"
                    value={form.role}
                    onChange={(value) => setForm((current) => ({ ...current, role: value }))}
                    options={[
                      { value: "dam", label: "Dam" },
                      { value: "sire", label: "Sire" },
                    ]}
                  />
                  <AdminSelectInput
                    label="Status"
                    value={form.status}
                    onChange={(value) => setForm((current) => ({ ...current, status: value }))}
                    options={[
                      { value: "active", label: "Active" },
                      { value: "retired", label: "Retired" },
                      { value: "planned", label: "Planned" },
                      { value: "archived", label: "Archived" },
                    ]}
                  />
                </div>
                <AdminTextInput
                  label="Dog Name"
                  value={form.dog_name}
                  onChange={(value) => setForm((current) => ({ ...current, dog_name: value }))}
                  placeholder="Cocoa Belle"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <AdminTextInput
                    label="Call Name"
                    value={form.call_name}
                    onChange={(value) => setForm((current) => ({ ...current, call_name: value }))}
                    placeholder="Belle"
                  />
                  <AdminTextInput
                    label="Formal Name"
                    value={form.name}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, name: value }))
                    }
                    placeholder="Formal or registered name"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <AdminDateInput
                    label="Date of Birth"
                    value={form.date_of_birth}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, date_of_birth: value }))
                    }
                  />
                  <AdminTextInput
                    label="Registry"
                    value={form.registry}
                    onChange={(value) =>
                      setForm((current) => ({ ...current, registry: value }))
                    }
                    placeholder="AKC, CKC, or registry details"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <AdminTextInput
                    label="Color"
                    value={form.color}
                    onChange={(value) => setForm((current) => ({ ...current, color: value }))}
                    placeholder="Chocolate tri"
                  />
                  <AdminTextInput
                    label="Coat"
                    value={form.coat}
                    onChange={(value) => setForm((current) => ({ ...current, coat: value }))}
                    placeholder="Short Hair"
                  />
                </div>
                <AdminTextAreaInput
                  label="Genetics Summary"
                  value={form.genetics_summary}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, genetics_summary: value }))
                  }
                  rows={4}
                  placeholder="Paste the breeder-facing takeaway here: coat/color genes, size notes, health carrier notes, pair-planning guidance, and anything ChiChi should answer from directly."
                />
                <AdminTextInput
                  label="Genetics Report Link"
                  value={form.genetics_report_url}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, genetics_report_url: value }))
                  }
                  placeholder="Optional link to Embark, Paw Print, PDF, or stored report"
                />
                <AdminTextAreaInput
                  label="Raw Genetics / Lab Paste"
                  value={form.genetics_raw}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, genetics_raw: value }))
                  }
                  rows={8}
                  placeholder="Paste the full genetics panel, marker results, color/coat traits, size notes, health findings, or pairing notes here."
                />
                <AdminTextAreaInput
                  label="Notes"
                  value={form.notes}
                  onChange={(value) => setForm((current) => ({ ...current, notes: value }))}
                  rows={5}
                  placeholder="Temperament, health notes, pairing notes, or retirement notes."
                />
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void saveDog()}
                  disabled={saving}
                  className="rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(159,99,49,0.22)] transition hover:brightness-105 disabled:opacity-60"
                >
                  {saving ? "Saving..." : createMode ? "Create Profile" : "Save Profile"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreateMode(false);
                    setForm(populateForm(selectedDog));
                    setStatusText("");
                  }}
                  className="rounded-2xl border border-[var(--portal-border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]"
                >
                  Reset
                </button>
              </div>
            </AdminPanel>

            <AdminPanel
              title="Linked Output"
              subtitle="Recent litters and puppies connected to the selected breeding profile."
            >
              {selectedDog ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                      Recent Litters
                    </div>
                    <div className="mt-3 space-y-3">
                      {selectedDog.litters.length ? (
                        selectedDog.litters.slice(0, 4).map((litter) => (
                          <div
                            key={`${selectedDog.id}-${litter.id}`}
                            className="rounded-[20px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3"
                          >
                            <div className="text-sm font-semibold text-[var(--portal-text)]">
                              {litter.displayName}
                            </div>
                            <div className="mt-1 text-xs text-[var(--portal-text-soft)]">
                              {litter.whelp_date ? fmtDate(litter.whelp_date) : "No whelp date"} •{" "}
                              {litter.status || "pending"}
                            </div>
                          </div>
                        ))
                      ) : (
                        <AdminEmptyState
                          title="No litters linked yet"
                          description="Once a litter is assigned to this profile it will appear here."
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                      Linked Puppies
                    </div>
                    <div className="mt-3 space-y-3">
                      {selectedDog.puppies.length ? (
                        selectedDog.puppies.slice(0, 6).map((puppy) => (
                          <div
                            key={`${selectedDog.id}-puppy-${puppy.id}`}
                            className="rounded-[20px] border border-[var(--portal-border)] bg-white px-4 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-[var(--portal-text)]">
                                  {puppy.displayName}
                                </div>
                                <div className="mt-1 text-xs text-[var(--portal-text-soft)]">
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
                          </div>
                        ))
                      ) : (
                        <AdminEmptyState
                          title="No puppies linked yet"
                          description="Puppies connected through this profile's litters will appear here."
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/admin/portal/litters"
                      className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]"
                    >
                      Open Litters
                    </Link>
                    <Link
                      href="/admin/portal/puppies"
                      className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]"
                    >
                      Open Puppies
                    </Link>
                  </div>
                </div>
              ) : (
                <AdminEmptyState
                  title="No breeding profile selected"
                  description="Choose a dam or sire to review its litters, puppies, and revenue."
                />
              )}
            </AdminPanel>
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}

