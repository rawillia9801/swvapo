"use client";

import Link from "next/link";
import React, { useEffect, useEffectEvent, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Archive,
  Download,
  FileText,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Upload,
} from "lucide-react";
import {
  AdminEmptyState,
  AdminPageShell,
  AdminPanel,
  AdminRestrictedState,
  adminStatusBadge,
} from "@/components/admin/luxury-admin-shell";
import { fmtDate } from "@/lib/utils";
import { usePortalAdminSession } from "@/lib/use-portal-admin-session";

type DocumentWorkspaceRecord = {
  key: string;
  recordType: "submission" | "document";
  submissionId: number | null;
  documentId: string | null;
  buyerId: number | null;
  buyerName: string;
  buyerEmail: string | null;
  buyerStatus: string | null;
  puppyId: number | null;
  puppyName: string | null;
  puppyStatus: string | null;
  documentType: string;
  status: string;
  statusLabel: string;
  source: string;
  signerName: string | null;
  signedDate: string | null;
  filedDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  fileUrl: string | null;
  fileName: string | null;
  launchUrl: string | null;
  visibleToUser: boolean | null;
  summary: string | null;
  payload: Record<string, unknown> | null;
  portalFormData: Record<string, unknown> | null;
  attachments: Array<{
    id: string;
    label: string;
    fileName: string | null;
    url: string | null;
  }>;
  filedDocuments: Array<{
    id: string;
    label: string;
    fileName: string | null;
    url: string | null;
    createdAt: string | null;
    signedAt: string | null;
    status: string | null;
  }>;
  workflow: {
    package_id?: string | null;
    package_key?: string | null;
    package_title?: string | null;
    review_note?: string | null;
  } | null;
  timeline: Array<{
    id: string;
    label: string;
    at: string | null;
    detail: string | null;
  }>;
  actionSupport: {
    canView: boolean;
    canResend: boolean;
    canOverride: boolean;
    canReplace: boolean;
    canMarkFiled: boolean;
    canDownload: boolean;
    canOpenBuyer: boolean;
    canOpenPuppy: boolean;
  };
};

function prettyLabel(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Unspecified";
  return normalized.replace(/[_-]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function detailHref(base: string, id: number | null) {
  return id ? `${base}?id=${id}` : base;
}

function selectStatusOptions(record: DocumentWorkspaceRecord | null) {
  if (!record) return [];
  return [
    { value: "needs_review", label: "Needs review" },
    { value: "signed", label: "Signed" },
    { value: "filed", label: "Filed" },
    { value: "archived", label: "Archived" },
  ];
}

export default function AdminPortalDocumentsPage() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const [records, setRecords] = useState<DocumentWorkspaceRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [statusText, setStatusText] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedKey, setSelectedKey] = useState("");
  const [overrideStatus, setOverrideStatus] = useState("needs_review");
  const [overrideNote, setOverrideNote] = useState("");
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [workingAction, setWorkingAction] = useState("");

  const loadWorkspace = useEffectEvent(async () => {
    if (!accessToken) return;
    setLoadingData(true);
    try {
      const response = await fetch("/api/admin/portal/buyer-documents", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        records?: DocumentWorkspaceRecord[];
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not load the document workspace.");
      }

      const nextRecords = Array.isArray(payload.records) ? payload.records : [];
      setRecords(nextRecords);
      setSelectedKey((current) =>
        nextRecords.some((record) => record.key === current) ? current : nextRecords[0]?.key || ""
      );
      setStatusText("");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not load the document workspace.");
    } finally {
      setLoadingData(false);
    }
  });

  useEffect(() => {
    if (!accessToken || !isAdmin) {
      setLoadingData(false);
      return;
    }
    void loadWorkspace();
  }, [accessToken, isAdmin, loadWorkspace]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      if (statusFilter !== "all" && record.status !== statusFilter) return false;
      if (sourceFilter !== "all" && record.source !== sourceFilter) return false;
      if (!query) return true;
      return [
        record.buyerName,
        record.buyerEmail,
        record.puppyName,
        record.documentType,
        record.statusLabel,
        record.source,
        record.signerName,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(query);
    });
  }, [records, search, sourceFilter, statusFilter]);

  const selectedRecord =
    filteredRecords.find((record) => record.key === selectedKey) ||
    records.find((record) => record.key === selectedKey) ||
    null;

  useEffect(() => {
    if (!selectedRecord) return;
    setOverrideStatus(selectedRecord.status === "filed" ? "filed" : "needs_review");
    setOverrideNote(selectedRecord.workflow?.review_note || "");
    setReplacementFile(null);
  }, [selectedRecord]);

  const sourceOptions = useMemo(
    () =>
      ["all", ...new Set(records.map((record) => record.source).filter(Boolean))].map((value) => ({
        value,
        label: value === "all" ? "All sources" : prettyLabel(value),
      })),
    [records]
  );

  async function runAction(action: string, extra: Record<string, unknown> = {}) {
    if (!selectedRecord || !accessToken) return;
    setWorkingAction(action);
    setStatusText("");
    try {
      const response = await fetch("/api/admin/portal/buyer-documents", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action,
          record_type: selectedRecord.recordType,
          submission_id: selectedRecord.submissionId,
          document_id: selectedRecord.documentId,
          buyer_id: selectedRecord.buyerId,
          package_key: selectedRecord.workflow?.package_key || null,
          ...extra,
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        launchUrl?: string | null;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not update the document record.");
      }

      if (payload.launchUrl) window.open(payload.launchUrl, "_blank", "noopener,noreferrer");
      setStatusText(
        action === "resend_package"
          ? "Document package resent."
          : action === "mark_filed"
            ? "Document marked filed."
            : action === "archive_record"
              ? "Document archived."
              : "Document override saved."
      );
      await loadWorkspace();
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not update the document record.");
    } finally {
      setWorkingAction("");
    }
  }

  async function uploadReplacement() {
    if (!selectedRecord || !replacementFile || !accessToken || !selectedRecord.buyerId) return;
    setWorkingAction("replace_document");
    setStatusText("");
    try {
      const formData = new FormData();
      formData.set("buyer_id", String(selectedRecord.buyerId));
      formData.set("file", replacementFile);
      formData.set("title", selectedRecord.documentType);
      formData.set("description", selectedRecord.summary || "");
      formData.set("category", selectedRecord.source);
      formData.set("visible_to_user", String(selectedRecord.visibleToUser ?? true));
      if (selectedRecord.workflow?.package_id) formData.set("package_id", selectedRecord.workflow.package_id);
      if (selectedRecord.workflow?.package_key) formData.set("package_key", selectedRecord.workflow.package_key);
      if (selectedRecord.signedDate) formData.set("signed_at", selectedRecord.signedDate);

      const response = await fetch("/api/admin/portal/buyer-documents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not upload the replacement document.");
      }

      setReplacementFile(null);
      setStatusText("Replacement document uploaded.");
      await loadWorkspace();
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not upload the replacement document.");
    } finally {
      setWorkingAction("");
    }
  }

  function openRecordUrl(kind: "view" | "download") {
    if (!selectedRecord) return;
    const url =
      (kind === "download" ? selectedRecord.fileUrl : null) ||
      selectedRecord.fileUrl ||
      selectedRecord.launchUrl;
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (loading || loadingData) {
    return <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">Loading document workspace...</div>;
  }

  if (!user) {
    return (
      <AdminRestrictedState
        title="Sign in to access documents."
        details="This workspace is reserved for Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!isAdmin) {
    return (
      <AdminRestrictedState
        title="This document workspace is limited to approved owner accounts."
        details="Only approved owner emails can review submissions, filed records, and buyer document workflows here."
      />
    );
  }

  const signedNotFiled = records.filter((record) => record.status === "signed" && !record.filedDate).length;
  const needsReview = records.filter((record) => record.status === "needs_review").length;
  const filed = records.filter((record) => record.status === "filed").length;

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-12">
        <section className="rounded-[2rem] border border-[var(--portal-border)] bg-[linear-gradient(135deg,rgba(255,250,243,0.96)_0%,rgba(247,239,227,0.94)_100%)] px-6 py-6 shadow-[0_18px_40px_rgba(106,76,45,0.08)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--portal-text-muted)]">Documents</div>
              <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-[var(--portal-text)]">Submission records workspace</h1>
              <p className="mt-3 text-sm leading-7 text-[var(--portal-text-soft)]">
                This screen is built to process document submissions, not summarize them. Use the left table to open a specific submission immediately, then work the signer, payload, filed copy, and follow-up actions from the detail pane.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/admin/portal/buyers" className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]">
                Open Buyers
              </Link>
              <button
                type="button"
                onClick={() => void loadWorkspace()}
                className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(181,117,47,0.24)] transition hover:brightness-105"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh Records
              </button>
            </div>
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryStat label="Total records" value={String(records.length)} detail="Submissions and standalone filed documents." />
          <SummaryStat label="Needs review" value={String(needsReview)} detail="Overrides, incomplete records, or flagged packages." />
          <SummaryStat label="Signed not filed" value={String(signedNotFiled)} detail="Ready for filing or scanned-copy replacement." />
          <SummaryStat label="Filed" value={String(filed)} detail="Records already finalized into the buyer file." />
        </div>

        {statusText ? (
          <div className="rounded-[1.2rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--portal-text-soft)]">
            {statusText}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_430px]">
          <AdminPanel title="Submission ledger" subtitle="Click a row to open the operational detail workspace for that submission or filed record.">
            <div className="flex flex-col gap-3 border-b border-[var(--portal-border)] pb-4 lg:flex-row">
              <label className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--portal-text-muted)]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search buyer, puppy, document type, signer..."
                  className="w-full rounded-2xl border border-[var(--portal-border)] bg-white py-3 pl-11 pr-4 text-sm text-[var(--portal-text)] outline-none transition focus:border-[var(--portal-border-strong)]"
                />
              </label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm text-[var(--portal-text)] outline-none">
                <option value="all">All statuses</option>
                <option value="needs_review">Needs review</option>
                <option value="submitted">Submitted</option>
                <option value="signed">Signed</option>
                <option value="filed">Filed</option>
                <option value="archived">Archived</option>
              </select>
              <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm text-[var(--portal-text)] outline-none">
                {sourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                    <th className="px-3 py-3">Buyer</th>
                    <th className="px-3 py-3">Puppy</th>
                    <th className="px-3 py-3">Document Type</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Signed Date</th>
                    <th className="px-3 py-3">Filed Date</th>
                    <th className="px-3 py-3">Source</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length ? (
                    filteredRecords.map((record) => (
                      <tr key={record.key} className={`cursor-pointer transition ${selectedKey === record.key ? "bg-[rgba(241,230,214,0.58)]" : "hover:bg-[rgba(247,240,230,0.52)]"}`} onClick={() => setSelectedKey(record.key)}>
                        <td className="border-t border-[var(--portal-border)] px-3 py-4">
                          <div className="font-semibold text-[var(--portal-text)]">{record.buyerName}</div>
                          <div className="mt-1 text-xs text-[var(--portal-text-soft)]">{record.buyerEmail || "No buyer email"}</div>
                        </td>
                        <td className="border-t border-[var(--portal-border)] px-3 py-4 text-sm text-[var(--portal-text-soft)]">{record.puppyName || "Not linked"}</td>
                        <td className="border-t border-[var(--portal-border)] px-3 py-4">
                          <div className="font-semibold text-[var(--portal-text)]">{record.documentType}</div>
                          <div className="mt-1 text-xs text-[var(--portal-text-soft)]">{record.signerName ? `Signer: ${record.signerName}` : "No signer yet"}</div>
                        </td>
                        <td className="border-t border-[var(--portal-border)] px-3 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(record.status)}`}>{record.statusLabel}</span>
                        </td>
                        <td className="border-t border-[var(--portal-border)] px-3 py-4 text-sm text-[var(--portal-text-soft)]">{record.signedDate ? fmtDate(record.signedDate) : "-"}</td>
                        <td className="border-t border-[var(--portal-border)] px-3 py-4 text-sm text-[var(--portal-text-soft)]">{record.filedDate ? fmtDate(record.filedDate) : "-"}</td>
                        <td className="border-t border-[var(--portal-border)] px-3 py-4 text-sm text-[var(--portal-text-soft)]">{prettyLabel(record.source)}</td>
                        <td className="border-t border-[var(--portal-border)] px-3 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={(event) => { event.stopPropagation(); setSelectedKey(record.key); }} className="rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]">
                              Open
                            </button>
                            <button type="button" disabled={!record.actionSupport.canView} onClick={(event) => { event.stopPropagation(); window.open(record.fileUrl || record.launchUrl || "", "_blank", "noopener,noreferrer"); }} className="rounded-xl border border-[var(--portal-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)] disabled:cursor-not-allowed disabled:opacity-45">
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-0 py-8">
                        <AdminEmptyState title="No document records matched your filters" description="Adjust the search, status, or source filters to reopen the full records list." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </AdminPanel>
          <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
            {selectedRecord ? (
              <>
                <AdminPanel title={selectedRecord.documentType} subtitle="Selected record detail and next actions.">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">{prettyLabel(selectedRecord.source)}</div>
                        <div className="mt-2 text-base font-semibold text-[var(--portal-text)]">{selectedRecord.buyerName}</div>
                        <div className="mt-1 text-sm text-[var(--portal-text-soft)]">{selectedRecord.summary || "No extra summary has been saved for this record yet."}</div>
                      </div>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(selectedRecord.status)}`}>{selectedRecord.statusLabel}</span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <MiniField label="Signer" value={selectedRecord.signerName || "Not signed"} />
                      <MiniField label="Created" value={selectedRecord.createdAt ? fmtDate(selectedRecord.createdAt) : "Unknown"} />
                      <MiniField label="Signed" value={selectedRecord.signedDate ? fmtDate(selectedRecord.signedDate) : "Not signed"} />
                      <MiniField label="Filed" value={selectedRecord.filedDate ? fmtDate(selectedRecord.filedDate) : "Not filed"} />
                    </div>

                    <div className="grid gap-3">
                      <LinkedRow label="Buyer" href={selectedRecord.actionSupport.canOpenBuyer ? detailHref("/admin/portal/buyers", selectedRecord.buyerId) : null} value={selectedRecord.buyerName} />
                      <LinkedRow label="Puppy" href={selectedRecord.actionSupport.canOpenPuppy ? detailHref("/admin/portal/puppies", selectedRecord.puppyId) : null} value={selectedRecord.puppyName || "Not linked"} />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <ActionButton icon={<ArrowUpRight className="h-4 w-4" />} disabled={!selectedRecord.actionSupport.canView} onClick={() => openRecordUrl("view")}>View</ActionButton>
                      <ActionButton icon={<Send className="h-4 w-4" />} disabled={!selectedRecord.actionSupport.canResend || workingAction === "resend_package"} onClick={() => void runAction("resend_package")}>Resend</ActionButton>
                      <ActionButton icon={<Download className="h-4 w-4" />} disabled={!selectedRecord.actionSupport.canDownload} onClick={() => openRecordUrl("download")}>Download PDF</ActionButton>
                      <ActionButton icon={<FileText className="h-4 w-4" />} disabled={!selectedRecord.actionSupport.canOpenBuyer} href={detailHref("/admin/portal/buyers", selectedRecord.buyerId)}>Open Buyer</ActionButton>
                    </div>
                  </div>
                </AdminPanel>

                <AdminPanel title="Timeline" subtitle="Submission, signature, filing, and override history for this record.">
                  <div className="space-y-3">
                    {selectedRecord.timeline.length ? (
                      selectedRecord.timeline.map((item) => (
                        <div key={item.id} className="rounded-[1.1rem] border border-[var(--portal-border)] bg-white px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-[var(--portal-text)]">{item.label}</div>
                              {item.detail ? <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">{item.detail}</div> : null}
                            </div>
                            <div className="text-xs font-semibold text-[var(--portal-text-muted)]">{item.at ? fmtDate(item.at) : "-"}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <AdminEmptyState title="No timeline entries yet" description="New timeline activity will appear here once the record is submitted, signed, or filed." />
                    )}
                  </div>
                </AdminPanel>

                <AdminPanel title="Files and payload" subtitle="Attached files, filed copies, portal form payload, and admin override controls.">
                  <div className="space-y-5">
                    <DocumentFileSection title="Filed documents" files={selectedRecord.filedDocuments} empty="No filed copy is attached yet." />
                    <DocumentFileSection title="Submission attachments" files={selectedRecord.attachments} empty="No attachment files were included with this submission." />

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                        Override status
                        <select value={overrideStatus} onChange={(event) => setOverrideStatus(event.target.value)} className="mt-2 w-full rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm text-[var(--portal-text)] outline-none">
                          {selectStatusOptions(selectedRecord).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                        Replace filed copy
                        <input type="file" onChange={(event) => setReplacementFile(event.target.files?.[0] || null)} className="mt-2 w-full rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm text-[var(--portal-text)]" />
                      </label>
                    </div>

                    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                      Override note
                      <textarea value={overrideNote} onChange={(event) => setOverrideNote(event.target.value)} rows={4} className="mt-2 w-full rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm text-[var(--portal-text)] outline-none" />
                    </label>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <ActionButton icon={<ShieldAlert className="h-4 w-4" />} disabled={!selectedRecord.actionSupport.canOverride || workingAction === "override_status"} onClick={() => void runAction("override_status", { status: overrideStatus, note: overrideNote })}>Override</ActionButton>
                      <ActionButton icon={<FileText className="h-4 w-4" />} disabled={!selectedRecord.actionSupport.canMarkFiled || workingAction === "mark_filed"} onClick={() => void runAction("mark_filed", { note: overrideNote, filed_document_id: selectedRecord.filedDocuments[0]?.id || null })}>Mark Filed</ActionButton>
                      <ActionButton icon={<Upload className="h-4 w-4" />} disabled={!selectedRecord.actionSupport.canReplace || !replacementFile || workingAction === "replace_document"} onClick={() => void uploadReplacement()}>Replace</ActionButton>
                      <ActionButton icon={<Archive className="h-4 w-4" />} disabled={workingAction === "archive_record"} onClick={() => void runAction("archive_record", { note: overrideNote })}>Archive</ActionButton>
                    </div>

                    <JsonPanel title="Portal form data" value={selectedRecord.portalFormData} />
                    <JsonPanel title="Submission payload" value={selectedRecord.payload} />
                  </div>
                </AdminPanel>
              </>
            ) : (
              <AdminPanel title="Document detail" subtitle="Choose a record from the left table to inspect it.">
                <AdminEmptyState title="No record selected" description="Select a submission or filed document to view signer, payload, filed copy, and record actions." />
              </AdminPanel>
            )}
          </div>
        </div>
      </div>
    </AdminPageShell>
  );
}

function SummaryStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[1.4rem] border border-[var(--portal-border)] bg-white px-5 py-4 shadow-[0_12px_28px_rgba(106,76,45,0.06)]">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">{label}</div>
      <div className="mt-2 text-[1.45rem] font-semibold tracking-[-0.04em] text-[var(--portal-text)]">{value}</div>
      <div className="mt-2 text-xs leading-5 text-[var(--portal-text-soft)]">{detail}</div>
    </div>
  );
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">{label}</div>
      <div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">{value}</div>
    </div>
  );
}

function LinkedRow({ label, value, href }: { label: string; value: string; href: string | null }) {
  return (
    <div className="flex items-center justify-between rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">{label}</div>
        <div className="mt-1 text-sm font-semibold text-[var(--portal-text)]">{value}</div>
      </div>
      {href ? <Link href={href} className="text-xs font-semibold text-[#a56a37]">Open</Link> : null}
    </div>
  );
}

function ActionButton({
  children,
  icon,
  disabled = false,
  onClick,
  href,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const className =
    "inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)] disabled:cursor-not-allowed disabled:opacity-45";
  if (href) {
    return (
      <Link href={href} className={className}>
        {icon}
        {children}
      </Link>
    );
  }
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={className}>
      {icon}
      {children}
    </button>
  );
}

function DocumentFileSection({
  title,
  files,
  empty,
}: {
  title: string;
  files: Array<{
    id: string;
    label: string;
    fileName: string | null;
    url: string | null;
    createdAt?: string | null;
    signedAt?: string | null;
    status?: string | null;
  }>;
  empty: string;
}) {
  return (
    <div>
      <div className="text-sm font-semibold text-[var(--portal-text)]">{title}</div>
      <div className="mt-3 space-y-3">
        {files.length ? (
          files.map((file) => (
            <div key={file.id} className="flex items-start justify-between gap-3 rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-4">
              <div>
                <div className="text-sm font-semibold text-[var(--portal-text)]">{file.label}</div>
                <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                  {[file.fileName, file.createdAt ? `Created ${fmtDate(file.createdAt)}` : null, file.signedAt ? `Signed ${fmtDate(file.signedAt)}` : null, file.status ? prettyLabel(file.status) : null]
                    .filter(Boolean)
                    .join(" | ")}
                </div>
              </div>
              {file.url ? (
                <button type="button" onClick={() => window.open(file.url || "", "_blank", "noopener,noreferrer")} className="text-xs font-semibold text-[#a56a37]">
                  Open
                </button>
              ) : null}
            </div>
          ))
        ) : (
          <div className="rounded-[1rem] border border-dashed border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4 text-sm text-[var(--portal-text-soft)]">
            {empty}
          </div>
        )}
      </div>
    </div>
  );
}

function JsonPanel({ title, value }: { title: string; value: Record<string, unknown> | null }) {
  return (
    <details className="rounded-[1rem] border border-[var(--portal-border)] bg-white">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[var(--portal-text)]">{title}</summary>
      <div className="border-t border-[var(--portal-border)] px-4 py-4">
        {value ? (
          <pre className="overflow-x-auto rounded-[1rem] bg-[var(--portal-surface-muted)] p-4 text-xs leading-6 text-[var(--portal-text-soft)]">
            {JSON.stringify(value, null, 2)}
          </pre>
        ) : (
          <div className="text-sm text-[var(--portal-text-soft)]">No structured data was saved for this section.</div>
        )}
      </div>
    </details>
  );
}
