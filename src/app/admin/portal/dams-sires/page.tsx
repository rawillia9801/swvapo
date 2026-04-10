"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AdminEmptyState,
  AdminPageShell,
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
  type AdminRevenueSnapshot,
} from "@/lib/admin-portal";
import { fmtMoney } from "@/lib/utils";
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

type WorkspaceTab = "studio" | "roster" | "financials";
type FinancialView = "all" | "completed" | "pipeline";

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

function isDam(role: string | null | undefined) {
  return String(role || "").trim().toLowerCase() !== "sire";
}

function roleLabel(role: string | null | undefined) {
  return isDam(role) ? "Dam" : "Sire";
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function sumSnapshots(snapshots: AdminRevenueSnapshot[]) {
  return snapshots.reduce<AdminRevenueSnapshot>(
    (acc, item) => ({
      ...acc,
      totalPuppies: acc.totalPuppies + item.totalPuppies,
      availableCount: acc.availableCount + item.availableCount,
      reservedCount: acc.reservedCount + item.reservedCount,
      completedCount: acc.completedCount + item.completedCount,
      soldCount: acc.soldCount + item.soldCount,
      unsoldCount: acc.unsoldCount + item.unsoldCount,
      totalRevenue: acc.totalRevenue + item.totalRevenue,
      contractedRevenue: acc.contractedRevenue + item.contractedRevenue,
      projectedRevenue: acc.projectedRevenue + item.projectedRevenue,
      realizedRevenue: acc.realizedRevenue + item.realizedRevenue,
      reservedRevenue: acc.reservedRevenue + item.reservedRevenue,
      totalDeposits: acc.totalDeposits + item.totalDeposits,
      totalPayments: (acc.totalPayments || 0) + (item.totalPayments || 0),
      averageSalePrice: 0,
      totalCosts: acc.totalCosts + item.totalCosts,
      projectedCosts: acc.projectedCosts + item.projectedCosts,
      reservedCosts: acc.reservedCosts + item.reservedCosts,
      realizedCosts: acc.realizedCosts + item.realizedCosts,
      totalProfit: acc.totalProfit + item.totalProfit,
      projectedProfit: acc.projectedProfit + item.projectedProfit,
      reservedProfit: acc.reservedProfit + item.reservedProfit,
      realizedProfit: acc.realizedProfit + item.realizedProfit,
      averageProfit: 0,
    }),
    {
      totalPuppies: 0,
      availableCount: 0,
      reservedCount: 0,
      completedCount: 0,
      soldCount: 0,
      unsoldCount: 0,
      totalRevenue: 0,
      contractedRevenue: 0,
      projectedRevenue: 0,
      realizedRevenue: 0,
      reservedRevenue: 0,
      totalDeposits: 0,
      totalPayments: 0,
      averageSalePrice: 0,
      totalCosts: 0,
      projectedCosts: 0,
      reservedCosts: 0,
      realizedCosts: 0,
      totalProfit: 0,
      projectedProfit: 0,
      reservedProfit: 0,
      realizedProfit: 0,
      averageProfit: 0,
    }
  );
}

function sales(snapshot: AdminRevenueSnapshot, view: FinancialView) {
  if (view === "completed") return snapshot.realizedRevenue;
  if (view === "pipeline") return snapshot.projectedRevenue + snapshot.reservedRevenue;
  return snapshot.totalRevenue;
}

function costs(snapshot: AdminRevenueSnapshot, view: FinancialView) {
  if (view === "completed") return snapshot.realizedCosts;
  if (view === "pipeline") return snapshot.projectedCosts + snapshot.reservedCosts;
  return snapshot.totalCosts;
}

function profit(snapshot: AdminRevenueSnapshot, view: FinancialView) {
  if (view === "completed") return snapshot.realizedProfit;
  if (view === "pipeline") return snapshot.projectedProfit + snapshot.reservedProfit;
  return snapshot.totalProfit;
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
  const [tab, setTab] = useState<WorkspaceTab>("studio");
  const [financialView, setFinancialView] = useState<FinancialView>("all");

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
        if (active) setLoadingData(false);
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

  const allDogs = useMemo(() => workspace?.dogs || [], [workspace]);
  const filteredDogs = useMemo(
    () =>
      allDogs.filter((dog) => {
        if (roleFilter !== "all" && String(dog.role || "").toLowerCase() !== roleFilter) {
          return false;
        }
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return [dog.displayName, dog.notes, dog.color, dog.coat, ...dog.litters.map((l) => l.displayName), ...dog.puppies.map((p) => p.displayName)]
          .join(" ")
          .toLowerCase()
          .includes(q);
      }),
    [allDogs, roleFilter, search]
  );
  const selectedDog = createMode
    ? null
    : filteredDogs.find((item) => String(item.id) === selectedId) ||
      allDogs.find((item) => String(item.id) === selectedId) ||
      null;
  const femaleDogs = useMemo(() => allDogs.filter((dog) => isDam(dog.role)), [allDogs]);
  const financeDog = selectedDog && isDam(selectedDog.role) ? selectedDog : femaleDogs[0] || null;
  const femaleSummary = useMemo(() => sumSnapshots(femaleDogs.map((dog) => dog.summary)), [femaleDogs]);
  const rankedFemales = useMemo(
    () => femaleDogs.slice().sort((a, b) => profit(b.summary, financialView) - profit(a.summary, financialView)),
    [femaleDogs, financialView]
  );
  const financePuppies = useMemo(
    () =>
      (financeDog?.puppies || []).slice().sort(
        (a, b) =>
          new Date(b.created_at || b.dob || 0).getTime() -
          new Date(a.created_at || a.dob || 0).getTime()
      ),
    [financeDog]
  );

  useEffect(() => {
    setForm(createMode ? emptyForm("dam") : populateForm(selectedDog));
  }, [createMode, selectedDog]);

  useEffect(() => {
    if (createMode || !filteredDogs.length || filteredDogs.some((item) => String(item.id) === selectedId)) {
      return;
    }
    setSelectedId(String(filteredDogs[0].id));
  }, [createMode, filteredDogs, selectedId]);

  async function saveDog() {
    if (!accessToken) return;
    setSaving(true);
    setStatusText("");
    try {
      const response = await fetch("/api/admin/portal/breeding-dogs", {
        method: createMode ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ id: createMode ? undefined : selectedDog?.id, ...form }),
      });
      const payload = (await response.json()) as { error?: string; dogId?: string };
      if (!response.ok) throw new Error(payload.error || "Could not save the breeding profile.");
      await refreshWorkspace(payload.dogId ? String(payload.dogId) : selectedId, false);
      setStatusText(createMode ? "Breeding profile created." : "Breeding profile updated.");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not save the breeding profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || loadingData) {
    return <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">Loading breeding program workspace...</div>;
  }
  if (!user) {
    return <AdminRestrictedState title="Sign in to access breeding profiles." details="This workspace is reserved for the Southwest Virginia Chihuahua owner accounts." />;
  }
  if (!isAdmin) {
    return <AdminRestrictedState title="This breeding workspace is limited to approved owner accounts." details="Only the approved owner emails can manage dams, sires, and lineage records." />;
  }

  return (
    <AdminPageShell>
      <div className="space-y-4 pb-10">
        <section className="premium-card rounded-[1.6rem] p-5 md:p-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_420px]">
            <div>
              <div className="inline-flex rounded-full border border-[rgba(200,168,132,0.45)] bg-[rgba(248,242,234,0.92)] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8c6848]">Breeding Program</div>
              <h1 className="mt-4 text-[1.9rem] font-semibold leading-[1.05] tracking-[-0.05em] text-[var(--portal-text)] [font-family:var(--font-merriweather)] md:text-[2.3rem]">Software-style breeding operations with female-only financial tracking.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--portal-text-soft)]">Manage dams and sires together, but keep sales, costs, and profit on the female side of the program.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={() => { setCreateMode(true); setTab("studio"); setForm(emptyForm("dam")); setStatusText(""); }} className="inline-flex items-center rounded-2xl bg-[linear-gradient(90deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--portal-shadow-md)] transition hover:-translate-y-0.5">Add Breeding Dog</button>
                <Link href="/admin/portal/litters" className="rounded-2xl border border-[var(--portal-border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]">Open Litters</Link>
                <Link href="/admin/portal/puppies" className="rounded-2xl border border-[var(--portal-border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]">Open Puppies</Link>
              </div>
            </div>
            <div className="overflow-hidden rounded-[1.25rem] border border-[var(--portal-border)] bg-white">
              <div className="grid gap-px bg-[var(--portal-border)] sm:grid-cols-2">
                <MetricCell label="Dams" value={String(femaleDogs.length)} detail="Lead the sales book" />
                <MetricCell label="Sires" value={String(allDogs.filter((dog) => !isDam(dog.role)).length)} detail="Lineage and pairings" />
                <MetricCell label="Female Sales" value={fmtMoney(femaleSummary.realizedRevenue)} detail={`${femaleSummary.completedCount} completed placements`} />
                <MetricCell label="Female Net" value={fmtMoney(femaleSummary.realizedProfit)} detail={`${fmtMoney(profit(femaleSummary, "pipeline"))} still in pipeline`} />
              </div>
            </div>
          </div>
        </section>

        <section className="premium-card overflow-hidden rounded-[1.6rem]">
          <div className="grid xl:grid-cols-[310px_minmax(0,1fr)]">
            <aside className="border-b border-[var(--portal-border)] bg-[rgba(249,245,238,0.7)] xl:border-b-0 xl:border-r">
              <div className="space-y-4 px-4 py-4 md:px-5">
                <div className="text-sm leading-6 text-[var(--portal-text-soft)]">Search the roster, then switch between profile studio, roster table, and financials.</div>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search dogs, litters, puppies..." className="w-full rounded-[16px] border border-[var(--portal-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--portal-text)] outline-none transition focus:border-[var(--portal-accent)] focus:ring-2 focus:ring-[rgba(90,142,245,0.14)]" />
                <div className="flex flex-wrap gap-2">
                  {["all", "dam", "sire"].map((value) => <FilterPill key={value} active={roleFilter === value} onClick={() => setRoleFilter(value)}>{value === "all" ? "All" : value === "dam" ? "Dams" : "Sires"}</FilterPill>)}
                </div>
                <div className="space-y-2">
                  {filteredDogs.length ? filteredDogs.map((dog) => (
                    <button key={dog.id} type="button" onClick={() => { setCreateMode(false); setSelectedId(String(dog.id)); setStatusText(""); }} className={`block w-full rounded-[1.05rem] border px-4 py-3 text-left transition ${!createMode && String(dog.id) === selectedId ? "border-[var(--portal-border-strong)] bg-white shadow-[var(--portal-shadow-sm)]" : "border-[var(--portal-border)] bg-[rgba(255,255,255,0.8)] hover:border-[var(--portal-border-strong)] hover:bg-white"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--portal-text)]">{dog.displayName}</div>
                          <div className="mt-1 text-xs text-[var(--portal-text-soft)]">{roleLabel(dog.role)} | {dog.summary.totalLitters} litters | {dog.summary.totalPuppies} puppies</div>
                        </div>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(dog.role || "active")}`}>{roleLabel(dog.role)}</span>
                      </div>
                    </button>
                  )) : <AdminEmptyState title="No breeding profiles match the filters" description="Adjust the search or add a new breeding dog." />}
                </div>
              </div>
            </aside>

            <div className="min-w-0">
              <div className="border-b border-[var(--portal-border)] px-4 py-4 md:px-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">{createMode ? "Create Profile" : selectedDog?.displayName || "Breeding Workspace"}</div>
                    <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{createMode ? "Add a new dam or sire." : selectedDog ? `${roleLabel(selectedDog.role)} | ${selectedDog.status || "active"} | ${selectedDog.summary.totalLitters} litters | ${selectedDog.summary.totalPuppies} puppies` : "Choose a profile from the roster."}</div>
                    {statusText ? <div className="mt-3 rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-3.5 py-2.5 text-sm font-semibold text-[var(--portal-text-soft)]">{statusText}</div> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(["studio", "roster", "financials"] as WorkspaceTab[]).map((value) => <FilterPill key={value} active={tab === value} onClick={() => setTab(value)}>{value[0].toUpperCase() + value.slice(1)}</FilterPill>)}
                  </div>
                </div>
              </div>

              <div className="space-y-5 px-4 py-5 md:px-6 md:py-6">
                {tab === "studio" && (
                  <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.15fr)_360px]">
                    <section className="rounded-[1.4rem] border border-[var(--portal-border)] bg-white p-5">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <AdminSelectInput label="Role" value={form.role} onChange={(value) => setForm((current) => ({ ...current, role: value }))} options={[{ value: "dam", label: "Dam" }, { value: "sire", label: "Sire" }]} />
                        <AdminSelectInput label="Status" value={form.status} onChange={(value) => setForm((current) => ({ ...current, status: value }))} options={[{ value: "active", label: "Active" }, { value: "retired", label: "Retired" }, { value: "planned", label: "Planned" }, { value: "archived", label: "Archived" }]} />
                        <AdminTextInput label="Dog Name" value={form.dog_name} onChange={(value) => setForm((current) => ({ ...current, dog_name: value }))} placeholder="Cocoa Belle" />
                        <AdminTextInput label="Call Name" value={form.call_name} onChange={(value) => setForm((current) => ({ ...current, call_name: value }))} placeholder="Belle" />
                        <AdminTextInput label="Formal Name" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} placeholder="Registered or formal name" />
                        <AdminTextInput label="Registry" value={form.registry} onChange={(value) => setForm((current) => ({ ...current, registry: value }))} placeholder="AKC, CKC, or registry details" />
                        <AdminDateInput label="Date of Birth" value={form.date_of_birth} onChange={(value) => setForm((current) => ({ ...current, date_of_birth: value }))} />
                        <AdminTextInput label="Color" value={form.color} onChange={(value) => setForm((current) => ({ ...current, color: value }))} placeholder="Chocolate tri" />
                      </div>
                      <div className="mt-4"><AdminTextInput label="Coat" value={form.coat} onChange={(value) => setForm((current) => ({ ...current, coat: value }))} placeholder="Short Hair" /></div>
                      <div className="mt-4"><AdminTextAreaInput label="Genetics Summary" value={form.genetics_summary} onChange={(value) => setForm((current) => ({ ...current, genetics_summary: value }))} rows={4} placeholder="Breeder-facing genetics summary and pairing guidance." /></div>
                      <div className="mt-4"><AdminTextInput label="Genetics Report Link" value={form.genetics_report_url} onChange={(value) => setForm((current) => ({ ...current, genetics_report_url: value }))} placeholder="Optional report link" /></div>
                      <div className="mt-4"><AdminTextAreaInput label="Raw Genetics / Lab Paste" value={form.genetics_raw} onChange={(value) => setForm((current) => ({ ...current, genetics_raw: value }))} rows={6} placeholder="Full genetics panel and detailed lab notes." /></div>
                      <div className="mt-4"><AdminTextAreaInput label="Notes" value={form.notes} onChange={(value) => setForm((current) => ({ ...current, notes: value }))} rows={5} placeholder="Temperament, breeding notes, or retirement notes." /></div>
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button type="button" onClick={() => void saveDog()} disabled={saving} className="rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(159,99,49,0.22)] transition hover:brightness-105 disabled:opacity-60">{saving ? "Saving..." : createMode ? "Create Profile" : "Save Profile"}</button>
                        <button type="button" onClick={() => { setCreateMode(false); setForm(populateForm(selectedDog)); setStatusText(""); }} className="rounded-2xl border border-[var(--portal-border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]">Reset</button>
                      </div>
                    </section>

                    <section className="space-y-5">
                      <div className="overflow-hidden rounded-[1.25rem] border border-[var(--portal-border)] bg-white">
                        <div className="grid gap-px bg-[var(--portal-border)] sm:grid-cols-2">
                          <MetricCell label="Litters" value={String(selectedDog?.summary.totalLitters || 0)} detail={`${selectedDog?.summary.totalPuppies || 0} linked puppies`} />
                          <MetricCell label="Completion" value={pct(selectedDog?.summary.completionRate || 0)} detail={`${selectedDog?.summary.completedCount || 0} completed`} />
                          <MetricCell label="Sales" value={selectedDog && isDam(selectedDog.role) ? fmtMoney(selectedDog.summary.realizedRevenue) : "Dam-side only"} detail={selectedDog && isDam(selectedDog.role) ? `${fmtMoney(selectedDog.summary.realizedProfit)} net` : "Sires stay out of sales attribution"} />
                          <MetricCell label="Pipeline" value={selectedDog && isDam(selectedDog.role) ? fmtMoney(profit(selectedDog.summary, "pipeline")) : "Lineage"} detail={selectedDog && isDam(selectedDog.role) ? "Open and reserved pipeline" : "Pairings and history"} />
                        </div>
                      </div>
                      <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-white p-5">
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">Linked Puppies</div>
                        <div className="mt-4 space-y-3">
                          {selectedDog ? selectedDog.puppies.slice(0, 6).map((puppy) => <div key={`${selectedDog.id}-${puppy.id}`} className="rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3"><div className="text-sm font-semibold text-[var(--portal-text)]">{puppy.displayName}</div><div className="mt-1 text-xs text-[var(--portal-text-soft)]">{puppy.buyer?.full_name || puppy.buyer?.name || puppy.owner_email || "No buyer assigned"} | {puppy.status || "pending"}</div></div>) : <AdminEmptyState title="No breeding profile selected" description="Choose a profile to review its linked puppies." />}
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                {tab === "roster" && (
                  <section className="rounded-[1.4rem] border border-[var(--portal-border)] bg-white p-5">
                    <div className="mb-4 text-sm leading-6 text-[var(--portal-text-soft)]">The roster keeps both dams and sires visible, but the sales columns only belong to females.</div>
                    <div className="overflow-x-auto rounded-[1rem] border border-[var(--portal-border)]">
                      <table className="min-w-full divide-y divide-[#eee1d2] text-sm">
                        <thead className="bg-[var(--portal-surface-muted)] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]"><tr><th className="px-4 py-3">Profile</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Litters</th><th className="px-4 py-3">Puppies</th><th className="px-4 py-3">Completion</th><th className="px-4 py-3">Sales</th><th className="px-4 py-3">Net</th></tr></thead>
                        <tbody className="divide-y divide-[#f1e6da] bg-white">{allDogs.map((dog) => <tr key={dog.id} className="hover:bg-[var(--portal-surface-muted)]"><td className="px-4 py-3 font-semibold text-[var(--portal-text)]">{dog.displayName}</td><td className="px-4 py-3 text-[var(--portal-text-soft)]">{roleLabel(dog.role)}</td><td className="px-4 py-3 text-[var(--portal-text-soft)]">{dog.status || "active"}</td><td className="px-4 py-3 text-[var(--portal-text-soft)]">{dog.summary.totalLitters}</td><td className="px-4 py-3 text-[var(--portal-text-soft)]">{dog.summary.totalPuppies}</td><td className="px-4 py-3 text-[var(--portal-text-soft)]">{pct(dog.summary.completionRate)}</td><td className="px-4 py-3">{isDam(dog.role) ? fmtMoney(dog.summary.realizedRevenue) : "Dam-side only"}</td><td className="px-4 py-3">{isDam(dog.role) ? fmtMoney(dog.summary.realizedProfit) : "Dam-side only"}</td></tr>)}</tbody>
                      </table>
                    </div>
                  </section>
                )}

                {tab === "financials" && (
                  <div className="space-y-5">
                    <section className="rounded-[1.4rem] border border-[var(--portal-border)] bg-white p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm leading-6 text-[var(--portal-text-soft)]">Financial attribution stays on the females only, using saved puppy care costs and linked buyer transport expenses.</div>
                        <div className="flex flex-wrap gap-2">
                          {(["all", "completed", "pipeline"] as FinancialView[]).map((value) => <FilterPill key={value} active={financialView === value} onClick={() => setFinancialView(value)}>{value === "all" ? "Full Book" : value === "completed" ? "Completed" : "Pipeline"}</FilterPill>)}
                        </div>
                      </div>
                      <div className="mt-5 grid gap-px overflow-hidden rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-border)] lg:grid-cols-4">
                        <MetricCell label="Sales" value={fmtMoney(sales(femaleSummary, financialView))} detail="Female-only book" />
                        <MetricCell label="Costs" value={fmtMoney(costs(femaleSummary, financialView))} detail="Puppy care and transport" />
                        <MetricCell label="Profit" value={fmtMoney(profit(femaleSummary, financialView))} detail="Net after tracked costs" />
                        <MetricCell label="Focus Female" value={financeDog?.displayName || "No dam"} detail={selectedDog && !isDam(selectedDog.role) ? "Selected sire shifted the ledger back to a female." : "Change focus from the left roster."} />
                      </div>
                    </section>

                    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <section className="rounded-[1.4rem] border border-[var(--portal-border)] bg-white p-5">
                        <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">Female Ledger</div>
                        <div className="overflow-x-auto rounded-[1rem] border border-[var(--portal-border)]">
                          <table className="min-w-full divide-y divide-[#eee1d2] text-sm">
                            <thead className="bg-[var(--portal-surface-muted)] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]"><tr><th className="px-4 py-3">Female</th><th className="px-4 py-3">Litters</th><th className="px-4 py-3">Completed</th><th className="px-4 py-3">Sales</th><th className="px-4 py-3">Costs</th><th className="px-4 py-3">Profit</th></tr></thead>
                            <tbody className="divide-y divide-[#f1e6da] bg-white">{rankedFemales.map((dog) => <tr key={dog.id} className="hover:bg-[var(--portal-surface-muted)]"><td className="px-4 py-3"><button type="button" onClick={() => { setCreateMode(false); setSelectedId(String(dog.id)); }} className="text-left font-semibold text-[var(--portal-text)]">{dog.displayName}</button></td><td className="px-4 py-3 text-[var(--portal-text-soft)]">{dog.summary.totalLitters}</td><td className="px-4 py-3 text-[var(--portal-text-soft)]">{dog.summary.completedCount}</td><td className="px-4 py-3">{fmtMoney(sales(dog.summary, financialView))}</td><td className="px-4 py-3">{fmtMoney(costs(dog.summary, financialView))}</td><td className="px-4 py-3 font-semibold text-[var(--portal-text)]">{fmtMoney(profit(dog.summary, financialView))}</td></tr>)}</tbody>
                          </table>
                        </div>
                      </section>

                      <section className="rounded-[1.4rem] border border-[var(--portal-border)] bg-white p-5">
                        <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">Puppy Ledger</div>
                        {financePuppies.length ? (
                          <div className="overflow-x-auto rounded-[1rem] border border-[var(--portal-border)]">
                            <table className="min-w-full divide-y divide-[#eee1d2] text-sm">
                              <thead className="bg-[var(--portal-surface-muted)] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]"><tr><th className="px-4 py-3">Puppy</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Sale</th><th className="px-4 py-3">Breeder</th><th className="px-4 py-3">Transport</th><th className="px-4 py-3">Net</th></tr></thead>
                              <tbody className="divide-y divide-[#f1e6da] bg-white">{financePuppies.map((puppy) => <tr key={puppy.id} className="hover:bg-[var(--portal-surface-muted)]"><td className="px-4 py-3"><div className="font-semibold text-[var(--portal-text)]">{puppy.displayName}</div><div className="mt-1 text-xs text-[var(--portal-text-soft)]">{puppy.buyer?.full_name || puppy.buyer?.name || puppy.owner_email || "No buyer assigned"}</div></td><td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(puppy.status || "pending")}`}>{puppy.status || "pending"}</span></td><td className="px-4 py-3">{fmtMoney(puppy.salePrice)}</td><td className="px-4 py-3">{fmtMoney(puppy.breederCostTotal)}</td><td className="px-4 py-3">{fmtMoney(puppy.transportCostTotal)}</td><td className="px-4 py-3 font-semibold text-[var(--portal-text)]">{fmtMoney(puppy.estimatedProfit)}</td></tr>)}</tbody>
                            </table>
                          </div>
                        ) : <AdminEmptyState title="No puppy financial rows yet" description="Link puppies and buyer records to this female to populate the per-puppy ledger." />}
                      </section>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}

function MetricCell({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="bg-white px-4 py-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-[var(--portal-text)]">{value}</div>
      <div className="mt-1.5 text-xs leading-5 text-[var(--portal-text-soft)]">{detail}</div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
        active
          ? "border-[#b67b43] bg-[#c88c52] text-white shadow-sm"
          : "border-[var(--portal-border)] bg-white text-[var(--portal-text-soft)] hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)]"
      }`}
    >
      {children}
    </button>
  );
}
