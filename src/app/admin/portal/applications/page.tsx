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
} from "@/components/admin/luxury-admin-shell";
import {
  AdminSelectInput,
  AdminTextAreaInput,
} from "@/components/admin/admin-form-fields";
import {
  fetchAdminApplicationsWorkspace,
  type AdminApplicationWorkspace,
} from "@/lib/admin-portal";
import { fmtDate } from "@/lib/utils";
import { usePortalAdminSession } from "@/lib/use-portal-admin-session";

type SortMode = "newest" | "oldest" | "name" | "status";

type ReviewForm = {
  status: string;
  assigned_puppy_id: string;
  admin_notes: string;
};

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "under review", label: "Under Review" },
  { value: "follow up needed", label: "Follow Up Needed" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
  { value: "converted to buyer", label: "Converted to Buyer" },
];

function emptyWorkspace(): AdminApplicationWorkspace {
  return {
    summary: {
      total: 0,
      newCount: 0,
      underReviewCount: 0,
      followUpCount: 0,
      approvedCount: 0,
      deniedCount: 0,
      convertedCount: 0,
      financingInterested: 0,
      transportInterested: 0,
      matchedCount: 0,
    },
    applications: [],
    puppyOptions: [],
  };
}

function emptyForm(): ReviewForm {
  return { status: "new", assigned_puppy_id: "", admin_notes: "" };
}

function statusTone(status: string) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "denied") return "border-rose-200 bg-rose-50 text-rose-700";
  if (normalized === "converted to buyer") return "border-sky-200 bg-sky-50 text-sky-700";
  if (normalized === "follow up needed") return "border-amber-200 bg-amber-50 text-amber-700";
  if (normalized === "under review") return "border-stone-200 bg-stone-100 text-stone-700";
  return "border-[var(--portal-border)] bg-[var(--portal-surface-muted)] text-[#8a633c]";
}

function statusLabel(status: string) {
  return status
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function snippet(value: string | null | undefined, fallback: string) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function signalBadge(label: string, tone: "warm" | "cool" | "neutral") {
  const toneClass =
    tone === "warm"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : tone === "cool"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : "border-[var(--portal-border)] bg-[var(--portal-surface-muted)] text-[#7b5c40]";

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${toneClass}`}
    >
      {label}
    </span>
  );
}

async function saveApplicationReview(
  accessToken: string,
  applicationId: number,
  form: ReviewForm
) {
  const response = await fetch("/api/admin/portal/applications", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      id: applicationId,
      status: form.status,
      assigned_puppy_id: form.assigned_puppy_id ? Number(form.assigned_puppy_id) : null,
      admin_notes: form.admin_notes,
    }),
  });

  const payload = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || "Could not save application review.");
  }
}

async function convertApplicationToBuyer(
  accessToken: string,
  applicationId: number,
  assignedPuppyId: string
) {
  const response = await fetch("/api/admin/portal/applications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      action: "convert_to_buyer",
      id: applicationId,
      assigned_puppy_id: assignedPuppyId ? Number(assignedPuppyId) : null,
    }),
  });

  const payload = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || "Could not convert application to buyer.");
  }
}

export default function AdminPortalApplicationsPage() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const [workspace, setWorkspace] = useState<AdminApplicationWorkspace>(emptyWorkspace());
  const [loadingData, setLoadingData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<ReviewForm>(emptyForm());
  const [statusText, setStatusText] = useState("");

  async function refresh(preferredId?: number | null) {
    if (!accessToken) return;
    const nextWorkspace = (await fetchAdminApplicationsWorkspace(accessToken)) || emptyWorkspace();
    setWorkspace(nextWorkspace);
    setSelectedId(
      preferredId && nextWorkspace.applications.some((item) => item.id === preferredId)
        ? preferredId
        : nextWorkspace.applications[0]?.id || null
    );
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
        const nextWorkspace =
          (await fetchAdminApplicationsWorkspace(accessToken)) || emptyWorkspace();
        if (!active) return;
        setWorkspace(nextWorkspace);
        setSelectedId(nextWorkspace.applications[0]?.id || null);
      } finally {
        if (active) setLoadingData(false);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [accessToken, isAdmin]);

  const filteredApplications = useMemo(() => {
    const query = search.trim().toLowerCase();
    const results = workspace.applications.filter((application) => {
      if (statusFilter !== "all" && application.status !== statusFilter) return false;
      if (!query) return true;

      return [
        application.displayName,
        application.email,
        application.phone,
        application.cityState,
        application.puppyInterest,
        application.status,
        application.paymentPreference,
        application.questions,
        application.matchedBuyer?.displayName,
        application.matchedPuppy?.displayName,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(query);
    });

    results.sort((left, right) => {
      if (sortMode === "oldest") {
        return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
      }
      if (sortMode === "name") return left.displayName.localeCompare(right.displayName);
      if (sortMode === "status") return left.status.localeCompare(right.status) || right.id - left.id;
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });

    return results;
  }, [search, sortMode, statusFilter, workspace.applications]);

  const selectedApplication =
    filteredApplications.find((application) => application.id === selectedId) ||
    workspace.applications.find((application) => application.id === selectedId) ||
    null;

  useEffect(() => {
    if (!filteredApplications.length) {
      setSelectedId(null);
      return;
    }

    if (!filteredApplications.some((application) => application.id === selectedId)) {
      setSelectedId(filteredApplications[0].id);
    }
  }, [filteredApplications, selectedId]);

  useEffect(() => {
    if (!selectedApplication) {
      setForm(emptyForm());
      return;
    }

    setForm({
      status: selectedApplication.status || "new",
      assigned_puppy_id: selectedApplication.assigned_puppy_id
        ? String(selectedApplication.assigned_puppy_id)
        : "",
      admin_notes: selectedApplication.admin_notes || "",
    });
    setStatusText("");
  }, [selectedApplication]);

  async function handleRefresh() {
    if (!accessToken) return;
    setRefreshing(true);
    try {
      await refresh(selectedId);
      setStatusText("Application queue refreshed.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSave() {
    if (!accessToken || !selectedApplication) return;
    setSaving(true);
    try {
      await saveApplicationReview(accessToken, selectedApplication.id, form);
      await refresh(selectedApplication.id);
      setStatusText("Application review saved.");
    } catch (error) {
      setStatusText(
        error instanceof Error ? error.message : "Could not save application review."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleConvert() {
    if (!accessToken || !selectedApplication) return;
    setConverting(true);
    try {
      await convertApplicationToBuyer(
        accessToken,
        selectedApplication.id,
        form.assigned_puppy_id
      );
      await refresh(selectedApplication.id);
      setStatusText(
        selectedApplication.matchedBuyer
          ? "Application synced to the linked buyer record."
          : "Application converted to a buyer record."
      );
    } catch (error) {
      setStatusText(
        error instanceof Error ? error.message : "Could not convert application to buyer."
      );
    } finally {
      setConverting(false);
    }
  }

  if (loading || loadingData) {
    return <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">Loading applications...</div>;
  }

  if (!user) {
    return (
      <AdminRestrictedState
        title="Sign in to access applications."
        details="This workspace is reserved for the Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!isAdmin) {
    return (
      <AdminRestrictedState
        title="This application workspace is limited to approved owner accounts."
        details="Only the approved owner emails can review, assign, and convert puppy applications here."
      />
    );
  }

  const summary = workspace.summary;
  const selectedPuppy =
    workspace.puppyOptions.find(
      (option) => Number(option.id) === Number(form.assigned_puppy_id || 0)
    ) ||
    selectedApplication?.matchedPuppy ||
    null;

  return (
    <AdminPageShell>
      <div className="space-y-5 pb-10">
        <AdminPageHero
          eyebrow="Applications"
          title="Review applications as structured cases, not loose portal cards."
          description="The application tab now behaves like a breeder review queue: searchable intake on the left, a case console on the right, linked buyer and puppy context, recent messages, and a clean path from approval to buyer conversion."
          actions={
            <>
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={refreshing}
                className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(159,99,49,0.22)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-60"
              >
                {refreshing ? "Refreshing..." : "Refresh Queue"}
              </button>
              <AdminHeroPrimaryAction href="/admin/users">Open Users</AdminHeroPrimaryAction>
              <AdminHeroSecondaryAction href="/admin/portal/puppies">Open Puppies</AdminHeroSecondaryAction>
            </>
          }
          aside={
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <AdminInfoTile
                label="Selected Status"
                value={selectedApplication ? statusLabel(selectedApplication.status) : "None"}
                detail={
                  selectedApplication
                    ? `${selectedApplication.displayName} / ${fmtDate(selectedApplication.created_at)}`
                    : "Select a case from the queue to begin."
                }
              />
              <AdminInfoTile
                label="Buyer Match"
                value={selectedApplication?.matchedBuyer?.displayName || "Not linked"}
                detail={
                  selectedApplication?.matchedBuyer?.email ||
                  "Convert the case to buyer when the review is ready."
                }
              />
              <AdminInfoTile
                label="Assigned Puppy"
                value={selectedApplication?.matchedPuppy?.displayName || "Not assigned"}
                detail={
                  selectedApplication?.matchedPuppy?.litterName ||
                  "Assign a puppy in the review console when ready."
                }
              />
            </div>
          }
        />

        <AdminPanel
          title="Review Bench"
          subtitle="Application work should show queue pressure, match readiness, and special handling signals at a glance."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminInfoTile
              label="Fresh Intake"
              value={String(summary.newCount)}
              detail={`${summary.total} total applications currently in the breeding program queue.`}
            />
            <AdminInfoTile
              label="Active Review"
              value={String(summary.underReviewCount)}
              detail={`${summary.followUpCount} applications still need breeder follow-up before a final decision.`}
            />
            <AdminInfoTile
              label="Match Ready"
              value={String(summary.approvedCount)}
              detail={`${summary.matchedCount} already have a puppy match and ${summary.convertedCount} have converted into buyer records.`}
            />
            <AdminInfoTile
              label="Special Signals"
              value={`${summary.financingInterested} finance / ${summary.transportInterested} transport`}
              detail="Use these flags to spot cases that need payment-plan or delivery coordination early."
            />
          </div>
        </AdminPanel>

        <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.3fr)_430px]">
          <AdminPanel
            title="Application Queue"
            subtitle="Search by applicant, puppy interest, contact info, or internal notes. Use the table as the intake queue and the right rail as the active case console."
          >
            <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_180px]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search applicant, email, puppy interest, city, or notes..."
                className="w-full rounded-[16px] border border-[var(--portal-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--portal-text)] outline-none transition focus:border-[var(--portal-accent)] focus:ring-2 focus:ring-[rgba(90,142,245,0.14)]"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-[16px] border border-[var(--portal-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--portal-text)] outline-none transition focus:border-[var(--portal-accent)] focus:ring-2 focus:ring-[rgba(90,142,245,0.14)]"
              >
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="w-full rounded-[16px] border border-[var(--portal-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--portal-text)] outline-none transition focus:border-[var(--portal-accent)] focus:ring-2 focus:ring-[rgba(90,142,245,0.14)]"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name">Applicant name</option>
                <option value="status">Status</option>
              </select>
            </div>

            {filteredApplications.length ? (
              <div className="overflow-hidden rounded-[24px] border border-[var(--portal-border)]">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[#eee1d2] text-sm">
                    <thead className="bg-[var(--portal-surface-muted)] text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                      <tr>
                        <th className="px-4 py-3">Applicant</th>
                        <th className="px-4 py-3">Interest</th>
                        <th className="px-4 py-3">Submitted</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Signals</th>
                        <th className="px-4 py-3">Links</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1e6da] bg-white">
                      {filteredApplications.map((application) => {
                        const active = application.id === selectedId;
                        return (
                          <tr
                            key={application.id}
                            onClick={() => setSelectedId(application.id)}
                            className={`cursor-pointer transition hover:bg-[var(--portal-surface-muted)] ${active ? "bg-[var(--portal-surface-muted)]" : ""}`}
                          >
                            <td className="px-4 py-3">
                              <div className="font-semibold text-[var(--portal-text)]">{application.displayName}</div>
                              <div className="mt-1 text-xs text-[var(--portal-text-soft)]">
                                {application.email || "No email"} / {application.phone || "No phone"}
                              </div>
                              <div className="mt-1 text-xs text-[#a07a55]">
                                {application.cityState || "Location not provided"}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[var(--portal-text-soft)]">
                              <div className="font-semibold text-[var(--portal-text)]">{application.puppyInterest}</div>
                              <div className="mt-1 text-xs text-[var(--portal-text-soft)]">
                                {snippet(application.questions, "No applicant questions saved yet.")}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[var(--portal-text-soft)]">
                              <div className="font-semibold text-[var(--portal-text)]">{fmtDate(application.created_at)}</div>
                              <div className="mt-1 text-xs text-[var(--portal-text-soft)]">#{application.id}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(application.status)}`}>
                                {statusLabel(application.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                {application.financingInterest ? signalBadge("Financing", "warm") : null}
                                {application.transportInterest ? signalBadge("Transport", "cool") : null}
                                {application.depositReady ? signalBadge("Deposit Ready", "neutral") : null}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[var(--portal-text-soft)]">
                              <div className="text-xs font-semibold">
                                {application.matchedBuyer ? "Buyer linked" : "No buyer"}
                              </div>
                              <div className="mt-1 text-xs text-[var(--portal-text-soft)]">
                                {application.matchedPuppy ? `Puppy ${application.matchedPuppy.displayName}` : "No puppy assigned"}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <AdminEmptyState
                title="No applications match the current filters"
                description="Adjust the search or status filters to bring the queue back into view."
              />
            )}
          </AdminPanel>

          <div className="space-y-5 2xl:sticky 2xl:top-6 2xl:self-start">
            {selectedApplication ? (
              <>
                <AdminPanel
                  title="Case Console"
                  subtitle="Status changes, puppy assignment, internal notes, and conversion all stay in one controlled review area."
                >
                  {statusText ? (
                    <div className="mb-4 rounded-[18px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--portal-text-soft)]">
                      {statusText}
                    </div>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <AdminInfoTile label="Application" value={`#${selectedApplication.id}`} detail={fmtDate(selectedApplication.created_at)} />
                    <AdminInfoTile label="Queue Match" value={selectedApplication.matchedBuyer || selectedApplication.matchedPuppy ? "Linked" : "Open"} detail={selectedApplication.matchedBuyer ? selectedApplication.matchedBuyer.displayName : "No buyer linked yet"} />
                  </div>

                  <div className="mt-5 grid gap-4">
                    <AdminSelectInput label="Review Status" value={form.status} onChange={(value) => setForm((current) => ({ ...current, status: value }))} options={STATUS_OPTIONS} />
                    <AdminSelectInput
                      label="Assigned Puppy"
                      value={form.assigned_puppy_id}
                      onChange={(value) => setForm((current) => ({ ...current, assigned_puppy_id: value }))}
                      options={[
                        { value: "", label: "No puppy assigned" },
                        ...workspace.puppyOptions.map((option) => ({
                          value: String(option.id),
                          label: [option.displayName, option.status || "pending", option.buyer_id ? "buyer linked" : "open"].join(" / "),
                        })),
                      ]}
                    />
                    <AdminTextAreaInput label="Internal Notes" value={form.admin_notes} onChange={(value) => setForm((current) => ({ ...current, admin_notes: value }))} rows={6} placeholder="Decision notes, next steps, transport details, or follow-up reminders." />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button type="button" onClick={() => void handleSave()} disabled={saving} className="rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(159,99,49,0.22)] transition hover:brightness-105 disabled:opacity-60">
                      {saving ? "Saving..." : "Save Review"}
                    </button>
                    <button type="button" onClick={() => void handleConvert()} disabled={converting} className="rounded-2xl border border-[#cfb089] bg-[var(--portal-surface-muted)] px-5 py-3 text-sm font-semibold text-[#6e4d31] transition hover:border-[#ba8c57] disabled:opacity-60">
                      {converting ? "Converting..." : selectedApplication.matchedBuyer ? "Sync to Buyer" : "Convert to Buyer"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          status: selectedApplication.status || "new",
                          assigned_puppy_id: selectedApplication.assigned_puppy_id ? String(selectedApplication.assigned_puppy_id) : "",
                          admin_notes: selectedApplication.admin_notes || "",
                        })
                      }
                      className="rounded-2xl border border-[var(--portal-border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]"
                    >
                      Reset
                    </button>
                  </div>
                </AdminPanel>

                <AdminPanel
                  title="Placement Signals"
                  subtitle="Puppy interest, payment intent, transport interest, and linked records stay grouped together."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoLine label="Puppy Interest" value={selectedApplication.puppyInterest} />
                    <InfoLine label="Payment Preference" value={selectedApplication.paymentPreference || "Not provided"} />
                    <InfoLine label="Preferred Gender" value={selectedApplication.preferredGender || "Not provided"} />
                    <InfoLine label="Preferred Coat" value={selectedApplication.preferredCoatType || "Not provided"} />
                    <InfoLine label="Financing Interest" value={yesNo(selectedApplication.financingInterest)} />
                    <InfoLine label="Transport Interest" value={yesNo(selectedApplication.transportInterest)} />
                    <InfoLine label="Deposit Ready" value={yesNo(selectedApplication.depositReady)} />
                    <InfoLine label="Assigned Puppy" value={selectedPuppy?.displayName || "Not assigned"} />
                  </div>

                  <div className="mt-5 grid gap-3">
                    <InfoBlock label="Matched Buyer" value={selectedApplication.matchedBuyer ? `${selectedApplication.matchedBuyer.displayName} / ${selectedApplication.matchedBuyer.email || "No email"}` : "No buyer linked yet."} />
                    <InfoBlock label="Matched Puppy" value={selectedApplication.matchedPuppy ? [selectedApplication.matchedPuppy.displayName, selectedApplication.matchedPuppy.litterName, selectedApplication.matchedPuppy.dam, selectedApplication.matchedPuppy.sire].filter(Boolean).join(" / ") : "No puppy linked yet."} />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link href="/admin/users" className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]">Open Users</Link>
                    <Link href="/admin/portal/puppies" className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]">Open Puppies</Link>
                  </div>
                </AdminPanel>

                <AdminPanel
                  title="Applicant Background"
                  subtitle="Keep the household and experience notes visible while making the approval decision."
                >
                  <div className="grid gap-3">
                    <InfoBlock label="Contact" value={[selectedApplication.displayName, selectedApplication.email || "No email", selectedApplication.phone || "No phone", selectedApplication.cityState || "No location"].join(" / ")} />
                    <InfoBlock label="Household" value={selectedApplication.householdSummary} />
                    <InfoBlock label="Experience" value={selectedApplication.experienceSummary} />
                    <InfoBlock label="Questions" value={selectedApplication.questions || "No applicant questions on file."} multiline />
                  </div>
                </AdminPanel>

                <AdminPanel
                  title="Messages and History"
                  subtitle="Recent portal messages stay attached to the case so review work does not feel disconnected from conversation history."
                >
                  {selectedApplication.messages.length ? (
                    <div className="space-y-3">
                      {selectedApplication.messages.map((message) => (
                        <div key={message.id} className="rounded-[20px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-[var(--portal-text)]">{message.subject || "Portal message"}</div>
                              <div className="mt-1 text-xs text-[var(--portal-text-soft)]">{fmtDate(message.created_at)} / {message.sender || "unknown sender"}</div>
                            </div>
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${message.read_by_admin ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                              {message.read_by_admin ? "Reviewed" : "Unread"}
                            </span>
                          </div>
                          <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--portal-text-soft)]">
                            {snippet(message.message, "No message body available.")}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <AdminEmptyState
                      title="No message history yet"
                      description="Portal messages tied to this applicant will appear here automatically when they exist."
                    />
                  )}
                </AdminPanel>
              </>
            ) : (
              <AdminPanel title="Case Console" subtitle="Choose a queue row to open the active application review panel.">
                <AdminEmptyState
                  title="No application selected"
                  description="Select an application from the queue to review details, assign a puppy, add internal notes, and convert the applicant to a buyer."
                />
              </AdminPanel>
            )}
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}

function InfoLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-[var(--portal-border)] bg-white px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">{label}</div>
      <div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">{value}</div>
    </div>
  );
}

function InfoBlock({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="rounded-[20px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">{label}</div>
      <div className={`mt-3 text-sm leading-6 text-[var(--portal-text-soft)] ${multiline ? "whitespace-pre-wrap" : ""}`}>
        {value}
      </div>
    </div>
  );
}

