"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  findFormSubmissionsForUser,
  findPortalDocumentsForUser,
  loadPortalContext,
  portalDisplayName,
  portalPuppyName,
  type PortalApplication,
  type PortalBuyer,
  type PortalDocument,
  type PortalFormSubmission,
  type PortalPuppy,
} from "@/lib/portal-data";
import { fmtDate, sb } from "@/lib/utils";
import {
  documentHighlightText,
  documentPreviewRows,
  findMatchingDocumentSubmission,
  getDocumentInitialData,
  getDocumentSubmissionPayload,
  getVisiblePortalDocumentPacket,
  portalDocumentStatus,
  validateDocumentPayload,
  type PortalDocumentDefinition,
} from "@/lib/portal-document-packet";
import { usePortalSession } from "@/hooks/use-portal-session";
import {
  PortalButton,
  PortalEmptyState,
  PortalErrorState,
  PortalField,
  PortalHeroPrimaryAction,
  PortalInput,
  PortalLoadingState,
  PortalMetricCard,
  PortalMetricGrid,
  PortalPageHero,
  PortalPanel,
  PortalSecondaryButton,
  PortalStatusBadge,
  PortalTextarea,
} from "@/components/portal/luxury-shell";

type PageState = {
  buyer: PortalBuyer | null;
  application: PortalApplication | null;
  puppy: PortalPuppy | null;
  forms: PortalFormSubmission[];
  documents: PortalDocument[];
  displayName: string;
  puppyName: string;
};

type SavedSubmission = PortalFormSubmission & {
  data?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
};

function emptyState(): PageState {
  return {
    buyer: null,
    application: null,
    puppy: null,
    forms: [],
    documents: [],
    displayName: "Portal Family",
    puppyName: "your puppy",
  };
}

function firstFilled(...values: Array<unknown>) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function mergeSubmission(
  current: PortalFormSubmission[],
  next: SavedSubmission
): PortalFormSubmission[] {
  return [next, ...current.filter((entry) => entry.id !== next.id)].sort((left, right) => {
    const leftTime = new Date(
      left.submitted_at || left.updated_at || left.created_at || 0
    ).getTime();
    const rightTime = new Date(
      right.submitted_at || right.updated_at || right.created_at || 0
    ).getTime();
    return rightTime - leftTime;
  });
}

function displayDocDate(value: string | null | undefined) {
  return value ? fmtDate(value) : "Not filed yet";
}

function applicationPreviewRows(application: PortalApplication | null) {
  if (!application) return [] as Array<[string, string]>;

  return [
    ["Applicant", firstFilled(application.full_name)],
    ["Email", firstFilled(application.email, application.applicant_email)],
    ["Phone", firstFilled(application.phone)],
    ["Status", firstFilled(application.status)],
    [
      "Assigned puppy",
      application.assigned_puppy_id ? `Puppy #${application.assigned_puppy_id}` : "",
    ],
  ].filter((entry) => entry[1]) as Array<[string, string]>;
}

function documentStatusLabel(status: ReturnType<typeof portalDocumentStatus>) {
  return <PortalStatusBadge label={status.label} tone={status.tone} />;
}

function toInputValue(value: unknown) {
  if (typeof value === "boolean") return value;
  return String(value ?? "");
}

export default function PortalDocumentsPage() {
  const { user, loading: sessionLoading } = usePortalSession();
  const [state, setState] = useState<PageState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [editingKey, setEditingKey] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Record<string, unknown>>>({});
  const [savingKey, setSavingKey] = useState("");
  const [panelMessage, setPanelMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPage() {
      if (!user) {
        setState(emptyState());
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorText("");

      try {
        const context = await loadPortalContext(user);
        const [submissionRows, documentRows] = await Promise.all([
          findFormSubmissionsForUser(user),
          findPortalDocumentsForUser(user, context.buyer),
        ]);

        if (!active) return;
        setState({
          buyer: context.buyer,
          application: context.application,
          puppy: context.puppy,
          forms: submissionRows,
          documents: documentRows,
          displayName: portalDisplayName(user, context.buyer, context.application),
          puppyName: portalPuppyName(context.puppy).toLowerCase(),
        });
      } catch (error) {
        console.error("Could not load documents page:", error);
        if (!active) return;
        setErrorText(
          "We could not load your buyer packet right now. Please refresh or try again in a moment."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPage();

    return () => {
      active = false;
    };
  }, [user]);

  const packetContext = useMemo(
    () => ({
      buyer: state.buyer,
      application: state.application,
      puppy: state.puppy,
      documents: state.documents,
    }),
    [state.application, state.buyer, state.documents, state.puppy]
  );

  const documentCards = useMemo(() => {
    return getVisiblePortalDocumentPacket(packetContext).map((definition) => {
      const submission = findMatchingDocumentSubmission(
        definition,
        state.forms as SavedSubmission[]
      );
      const status = portalDocumentStatus(definition, packetContext, submission);
      const availability = definition.getAvailability(packetContext);
      const highlights = documentHighlightText(definition, submission);
      return {
        definition,
        submission,
        status,
        availability,
        highlights,
      };
    });
  }, [packetContext, state.forms]);

  useEffect(() => {
    if (!documentCards.length) {
      setSelectedKey("");
      return;
    }

    if (documentCards.some((entry) => entry.definition.key === selectedKey)) {
      return;
    }

    const preferred =
      documentCards.find(
        (entry) => entry.availability.enabled && !entry.status.complete
      ) || documentCards[0];

    setSelectedKey(preferred.definition.key);
  }, [documentCards, selectedKey]);

  const selectedEntry =
    documentCards.find((entry) => entry.definition.key === selectedKey) ||
    documentCards[0] ||
    null;

  useEffect(() => {
    if (!selectedEntry) return;
    if (drafts[selectedEntry.definition.key]) return;

    setDrafts((current) => ({
      ...current,
      [selectedEntry.definition.key]: getDocumentInitialData(
        selectedEntry.definition,
        packetContext,
        selectedEntry.submission
      ),
    }));
  }, [drafts, packetContext, selectedEntry]);

  const summary = useMemo(() => {
    const complete = documentCards.filter((entry) => entry.status.complete).length;
    const pending = documentCards.filter(
      (entry) => entry.availability.enabled && !entry.status.complete
    ).length;

    return {
      complete,
      pending,
      shared: state.documents.length,
      packetCount: documentCards.length,
    };
  }, [documentCards, state.documents.length]);

  async function saveDocument(
    definition: PortalDocumentDefinition,
    mode: "draft" | "submitted"
  ) {
    const draft = drafts[definition.key] || getDocumentInitialData(definition, packetContext);

    if (mode === "submitted") {
      const validationErrors = validateDocumentPayload(definition, draft);
      if (validationErrors.length) {
        setPanelMessage(
          `Please complete the required fields before signing: ${validationErrors
            .slice(0, 3)
            .join(", ")}.`
        );
        return;
      }
    }

    const {
      data: { session },
    } = await sb.auth.getSession();

    if (!session?.access_token) {
      setPanelMessage("Your session expired before the document could be saved.");
      return;
    }

    setSavingKey(definition.key);
    setPanelMessage("");

    try {
      const response = await fetch("/api/portal/forms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          documentKey: definition.key,
          status: mode,
          version: "2026-04",
          data: draft,
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        submission?: SavedSubmission;
      };
      const submission = payload.submission;

      if (!response.ok || !submission) {
        throw new Error(payload.error || "Could not save the document.");
      }

      setState((current) => ({
        ...current,
        forms: mergeSubmission(current.forms, submission),
      }));
      setDrafts((current) => ({
        ...current,
        [definition.key]: getDocumentSubmissionPayload(submission),
      }));
      setEditingKey("");
      setPanelMessage(
        mode === "draft"
          ? `${definition.title} draft saved.`
          : `${definition.title} signed copy saved to your portal and breeder file.`
      );
    } catch (error) {
      console.error("Could not save portal document:", error);
      setPanelMessage(
        error instanceof Error ? error.message : "Could not save the document right now."
      );
    } finally {
      setSavingKey("");
    }
  }

  if (sessionLoading || loading) {
    return <PortalLoadingState label="Loading buyer documents..." />;
  }

  if (!user) {
    return (
      <PortalPageHero
        eyebrow="Documents"
        title="Sign in to review your buyer packet."
        description="Buyer forms, signatures, shared contracts, and breeder-posted documents appear here once you are signed in."
      />
    );
  }

  if (errorText) {
    return <PortalErrorState title="Documents are unavailable" description={errorText} />;
  }

  const selectedDefinition = selectedEntry?.definition || null;
  const selectedSubmission = selectedEntry?.submission || null;
  const selectedAvailability = selectedEntry?.availability || { enabled: false };
  const selectedStatus = selectedEntry?.status || null;
  const selectedDraft =
    (selectedDefinition && drafts[selectedDefinition.key]) ||
    (selectedDefinition
      ? getDocumentInitialData(selectedDefinition, packetContext, selectedSubmission)
      : {});
  const showingEditor =
    !!selectedDefinition &&
    selectedDefinition.mode === "form" &&
    (editingKey === selectedDefinition.key ||
      !selectedSubmission ||
      !selectedStatus?.complete);
  const selectedPayload = getDocumentSubmissionPayload(selectedSubmission);

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Documents"
        title="Your buyer packet stays organized in one portal file."
        description={`Each required form for ${state.puppyName} lives here with the saved copy, signature date, and next step so you do not have to hunt through messages or email.`}
        actions={
          <PortalHeroPrimaryAction href="/portal/messages">
            Ask The Breeder A Question
          </PortalHeroPrimaryAction>
        }
        aside={
          <div className="grid gap-4">
            <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-white p-4 shadow-sm">
              <div className="text-[11px] font-semibold tracking-[-0.01em] text-[var(--portal-text-muted)]">
                Account
              </div>
              <div className="mt-2 text-xl font-semibold text-[var(--portal-text)]">
                {state.displayName}
              </div>
              <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                Signed copies saved here also surface inside the breeder buyer profile.
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-white p-4 shadow-sm">
              <div className="text-[11px] font-semibold tracking-[-0.01em] text-[var(--portal-text-muted)]">
                Puppy Packet
              </div>
              <div className="mt-2 text-xl font-semibold text-[var(--portal-text)]">
                {portalPuppyName(state.puppy)}
              </div>
              <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                Health, placement, financing, and handoff records stay grouped here.
              </div>
            </div>
          </div>
        }
      />

      <PortalMetricGrid>
        <PortalMetricCard
          label="Packet Items"
          value={String(summary.packetCount)}
          detail="Required and conditional buyer documents tracked from one portal tab."
        />
        <PortalMetricCard
          label="Signed Copies"
          value={String(summary.complete)}
          detail="Records already filed back into your account."
          accent="from-[rgba(113,198,164,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
        <PortalMetricCard
          label="Still Needed"
          value={String(summary.pending)}
          detail="Items that are active and still waiting to be completed."
          accent="from-[rgba(200,140,82,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
        <PortalMetricCard
          label="Breeder Shared Files"
          value={String(summary.shared)}
          detail={
            summary.shared
              ? "Published breeder records and uploaded files on your account."
              : "No breeder-posted files yet."
          }
          accent="from-[rgba(110,166,218,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
        <PortalPanel
          title="Buyer Document Packet"
          subtitle="Every buyer-facing document sits on its own card so you can see what is filed, what is next, and what activates later in the process."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {documentCards.map((entry) => (
              <button
                key={entry.definition.key}
                type="button"
                onClick={() => {
                  setSelectedKey(entry.definition.key);
                  setPanelMessage("");
                }}
                className={`rounded-[1.4rem] border p-5 text-left shadow-sm transition ${
                  selectedKey === entry.definition.key
                    ? "border-[#cfa77f] bg-[linear-gradient(180deg,rgba(255,252,246,0.98)_0%,rgba(249,242,232,0.98)_100%)] shadow-[0_18px_32px_rgba(120,81,45,0.12)]"
                    : "border-[var(--portal-border)] bg-white hover:-translate-y-0.5 hover:border-[#d5b28a]"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                      {entry.definition.category}
                    </div>
                    <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--portal-text)]">
                      {entry.definition.title}
                    </div>
                  </div>
                  <div className="shrink-0">{documentStatusLabel(entry.status)}</div>
                </div>

                <div className="mt-3 text-sm leading-6 text-[var(--portal-text-soft)]">
                  {entry.definition.description}
                </div>

                {entry.highlights.length ? (
                  <div className="mt-4 space-y-1.5">
                    {entry.highlights.map((line) => (
                      <div
                        key={line}
                        className="text-xs font-medium leading-5 text-[var(--portal-text-soft)]"
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 text-xs font-medium leading-5 text-[var(--portal-text-muted)]">
                    {entry.availability.enabled
                      ? entry.status.complete
                        ? entry.definition.completionSummary
                        : "Open this card to review or file the signed copy."
                      : entry.availability.reason}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
                  <span>
                    {entry.submission
                      ? `Updated ${displayDocDate(
                          entry.submission.submitted_at ||
                            entry.submission.updated_at ||
                            entry.submission.created_at
                        )}`
                      : entry.availability.enabled
                        ? "Ready to file"
                        : "Activates later"}
                  </span>
                  <span>{selectedKey === entry.definition.key ? "Open" : "View"}</span>
                </div>
              </button>
            ))}
          </div>
        </PortalPanel>

        <div className="space-y-6">
          {selectedDefinition ? (
            <PortalPanel
              title={selectedDefinition.title}
              subtitle={selectedDefinition.completionSummary}
              action={
                selectedDefinition.mode === "link" && selectedDefinition.href ? (
                  <PortalHeroPrimaryAction href={selectedDefinition.href}>
                    Open Application
                  </PortalHeroPrimaryAction>
                ) : selectedSubmission && !showingEditor ? (
                  <PortalSecondaryButton
                    onClick={() => {
                      setEditingKey(selectedDefinition.key);
                      setPanelMessage("");
                    }}
                  >
                    Update Signed Copy
                  </PortalSecondaryButton>
                ) : null
              }
            >
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-[1.15rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-4">
                    <div className="text-[11px] font-semibold tracking-[-0.01em] text-[var(--portal-text-muted)]">
                      Status
                    </div>
                    <div className="mt-3">{selectedStatus ? documentStatusLabel(selectedStatus) : null}</div>
                    <div className="mt-3 text-sm leading-6 text-[var(--portal-text-soft)]">
                      {selectedAvailability.enabled
                        ? "This document is active for your account."
                        : selectedAvailability.reason || "This document will activate later."}
                    </div>
                  </div>
                  <div className="rounded-[1.15rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-4">
                    <div className="text-[11px] font-semibold tracking-[-0.01em] text-[var(--portal-text-muted)]">
                      Last Filed
                    </div>
                    <div className="mt-2 text-lg font-semibold text-[var(--portal-text)]">
                      {displayDocDate(
                        selectedSubmission?.submitted_at ||
                          selectedSubmission?.updated_at ||
                          selectedSubmission?.created_at
                      )}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                      {selectedSubmission?.signed_name
                        ? `Signed by ${selectedSubmission.signed_name}.`
                        : selectedDefinition.mode === "link" && state.application
                          ? "Application record is already on file."
                          : "No signed copy filed yet."}
                    </div>
                  </div>
                </div>

                {panelMessage ? (
                  <div className="rounded-[1.15rem] border border-[rgba(200,140,82,0.35)] bg-[rgba(255,247,240,0.92)] px-4 py-3 text-sm leading-6 text-[var(--portal-text)]">
                    {panelMessage}
                  </div>
                ) : null}

                {selectedDefinition.mode === "link" ? (
                  <div className="space-y-4">
                    <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-white p-5 shadow-sm">
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                        Saved Copy
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {(documentPreviewRows(
                          selectedDefinition,
                          selectedPayload,
                          12
                        ).length
                          ? documentPreviewRows(selectedDefinition, selectedPayload, 12).map(
                              (row) => [row.label, row.value] as [string, string]
                            )
                          : applicationPreviewRows(state.application)
                        ).map(([label, value]) => (
                          <div
                            key={`${label}-${value}`}
                            className="rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3"
                          >
                            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                              {label}
                            </div>
                            <div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">
                              {value}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <PortalHeroPrimaryAction href="/portal/application">
                          Open Application
                        </PortalHeroPrimaryAction>
                        <PortalHeroPrimaryAction href="/portal/profile">
                          Review Profile
                        </PortalHeroPrimaryAction>
                      </div>
                    </div>

                    {!selectedSubmission ? (
                      <div className="rounded-[1.15rem] border border-dashed border-[var(--portal-border-strong)] bg-[var(--portal-surface-muted)] px-4 py-4 text-sm leading-6 text-[var(--portal-text-soft)]">
                        This application is already part of your portal file. Opening the application page lets you update it and refresh the saved document copy here.
                      </div>
                    ) : null}
                  </div>
                ) : !selectedAvailability.enabled && !selectedSubmission ? (
                  <PortalEmptyState
                    title="This document activates later"
                    description={
                      selectedAvailability.reason ||
                      "Once the related buyer step starts, you will be able to sign this form here."
                    }
                    action={
                      <PortalHeroPrimaryAction href="/portal/messages">
                        Ask About Next Steps
                      </PortalHeroPrimaryAction>
                    }
                  />
                ) : (
                  <div className="space-y-5">
                    {selectedSubmission && !showingEditor ? (
                      <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-white p-5 shadow-sm">
                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                          Saved Copy
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {documentPreviewRows(selectedDefinition, selectedPayload, 20).map((row) => (
                            <div
                              key={`${row.label}-${row.value}`}
                              className="rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3"
                            >
                              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                                {row.label}
                              </div>
                              <div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">
                                {row.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {showingEditor ? (
                      <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-white p-5 shadow-sm">
                        <div className="mb-4 text-sm leading-6 text-[var(--portal-text-soft)]">
                          Saving here stores a signed copy in your portal and mirrors it into the breeder&apos;s buyer profile.
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          {selectedDefinition.fields.map((field) => {
                            if (field.type === "textarea") {
                              return (
                                <div key={field.key} className="md:col-span-2">
                                  <PortalField label={field.label}>
                                    <PortalTextarea
                                      rows={field.rows || 4}
                                      value={toInputValue(selectedDraft[field.key]) as string}
                                      placeholder={field.placeholder}
                                      onChange={(event) =>
                                        setDrafts((current) => ({
                                          ...current,
                                          [selectedDefinition.key]: {
                                            ...current[selectedDefinition.key],
                                            [field.key]: event.target.value,
                                          },
                                        }))
                                      }
                                    />
                                  </PortalField>
                                </div>
                              );
                            }

                            if (field.type === "checkbox") {
                              return (
                                <label
                                  key={field.key}
                                  className="flex items-start gap-3 rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4"
                                >
                                  <input
                                    type="checkbox"
                                    checked={Boolean(selectedDraft[field.key])}
                                    onChange={(event) =>
                                      setDrafts((current) => ({
                                        ...current,
                                        [selectedDefinition.key]: {
                                          ...current[selectedDefinition.key],
                                          [field.key]: event.target.checked,
                                        },
                                      }))
                                    }
                                    className="mt-1 h-4 w-4 rounded border-[#d3b596] text-[#a56733] focus:ring-[#cba379]"
                                  />
                                  <span className="text-sm leading-6 text-[var(--portal-text)]">
                                    {field.label}
                                  </span>
                                </label>
                              );
                            }

                            return (
                              <PortalField key={field.key} label={field.label}>
                                <PortalInput
                                  type={
                                    field.type === "date"
                                      ? "date"
                                      : field.type === "currency"
                                        ? "number"
                                        : "text"
                                  }
                                  step={field.type === "currency" ? "0.01" : undefined}
                                  value={toInputValue(selectedDraft[field.key]) as string}
                                  placeholder={field.placeholder}
                                  onChange={(event) =>
                                    setDrafts((current) => ({
                                      ...current,
                                      [selectedDefinition.key]: {
                                        ...current[selectedDefinition.key],
                                        [field.key]: event.target.value,
                                      },
                                    }))
                                  }
                                />
                              </PortalField>
                            );
                          })}
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <PortalSecondaryButton
                            disabled={savingKey === selectedDefinition.key}
                            onClick={() => void saveDocument(selectedDefinition, "draft")}
                          >
                            {savingKey === selectedDefinition.key ? "Saving..." : "Save Draft"}
                          </PortalSecondaryButton>
                          <PortalButton
                            disabled={savingKey === selectedDefinition.key}
                            onClick={() => void saveDocument(selectedDefinition, "submitted")}
                          >
                            {savingKey === selectedDefinition.key
                              ? "Saving Signed Copy..."
                              : "Save Signed Copy"}
                          </PortalButton>
                          {selectedSubmission ? (
                            <PortalSecondaryButton
                              disabled={savingKey === selectedDefinition.key}
                              onClick={() => {
                                setEditingKey("");
                                setDrafts((current) => ({
                                  ...current,
                                  [selectedDefinition.key]: getDocumentInitialData(
                                    selectedDefinition,
                                    packetContext,
                                    selectedSubmission
                                  ),
                                }));
                                setPanelMessage("");
                              }}
                            >
                              Cancel
                            </PortalSecondaryButton>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </PortalPanel>
          ) : null}

          <PortalPanel
            title="Breeder Shared Records"
            subtitle="Files posted by the breeder stay separate from the forms you sign yourself."
          >
            {state.documents.length ? (
              <div className="space-y-3">
                {state.documents.map((document) => (
                  <div
                    key={document.id}
                    className="rounded-[1.15rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                          {firstFilled(document.category, document.status, "Document")}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">
                          {firstFilled(document.title, document.file_name, `Document ${document.id}`)}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                          {firstFilled(
                            document.description,
                            document.file_name,
                            "A breeder-posted record is on file for this account."
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
                        {displayDocDate(document.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <PortalEmptyState
                title="No breeder-shared files yet"
                description="Health packets, breeder uploads, and other shared reference files will appear here when they are posted to your account."
              />
            )}
          </PortalPanel>
        </div>
      </section>
    </div>
  );
}
