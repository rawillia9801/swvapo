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

const CUSTOMER_DOCUMENT_COPY: Partial<
  Record<
    string,
    {
      summary: string;
      readyText?: string;
      pendingText?: string;
    }
  >
> = {
  "portal-terms-of-service": {
    summary:
      "This record confirms the expectations that protect your portal access, account communication, document delivery, and payment handling.",
    readyText:
      "This document is available in your account and may be reviewed at any time.",
    pendingText:
      "This document will become available when your portal record is ready for signature.",
  },
  application: {
    summary:
      "Your puppy application remains part of your buyer record so it is easy to revisit, update, and reference throughout your placement journey.",
    readyText:
      "Your application record is available in your account for review.",
    pendingText:
      "This application record will appear here once it has been attached to your account.",
  },
  "deposit-agreement": {
    summary:
      "This agreement confirms the puppy or approved placement being reserved, the deposit applied to your file, and the reservation terms associated with that placement.",
    readyText:
      "Your Deposit Agreement is active and available in your account.",
    pendingText:
      "This agreement will appear once your reservation step has been opened on your account.",
  },
  "bill-of-sale": {
    summary:
      "This record outlines the completed placement details, sale terms, and the formal transfer information tied to your puppy.",
    readyText:
      "Your Bill of Sale is available in your account once placement details are ready.",
    pendingText:
      "This document will activate after the placement record is ready to be finalized.",
  },
  "health-guarantee": {
    summary:
      "This document outlines the health-related terms that accompany your puppy’s placement record and breeder file.",
    readyText:
      "Your Health Guarantee is available in your account for review.",
    pendingText:
      "This document will become available when the related placement steps are ready.",
  },
  "hypoglycemia-awareness": {
    summary:
      "This record keeps important care guidance together for families whose puppy packet includes hypoglycemia-related education.",
    readyText:
      "This educational record is available in your account for review.",
    pendingText:
      "This document will appear when it is relevant to your puppy’s packet.",
  },
  "payment-plan-agreement": {
    summary:
      "This agreement keeps your approved payment-plan terms, schedule, and related acknowledgements together in one signed record.",
    readyText:
      "Your Payment Plan Agreement is available in your account.",
    pendingText:
      "This document will activate once a payment-plan arrangement is attached to your buyer record.",
  },
  "pickup-delivery-confirmation": {
    summary:
      "This record keeps your pickup, delivery, or transportation confirmation details together with your puppy’s go-home file.",
    readyText:
      "Your pickup or delivery confirmation is available in your account.",
    pendingText:
      "This document will appear once transportation or pickup details have been scheduled.",
  },
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
  return [next, ...current.filter((entry) => entry.id !== next.id)].sort(
    (left, right) => {
      const leftTime = new Date(
        left.submitted_at || left.updated_at || left.created_at || 0
      ).getTime();
      const rightTime = new Date(
        right.submitted_at || right.updated_at || right.created_at || 0
      ).getTime();
      return rightTime - leftTime;
    }
  );
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
      application.assigned_puppy_id
        ? `Puppy #${application.assigned_puppy_id}`
        : "",
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

function normalizeToken(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sortDocumentsForDisplay(documents: PortalDocument[]) {
  return documents.slice().sort((left, right) => {
    const leftTime = new Date(left.signed_at || left.created_at || 0).getTime();
    const rightTime = new Date(
      right.signed_at || right.created_at || 0
    ).getTime();
    return rightTime - leftTime;
  });
}

function findRelatedPortalDocument(
  definition: PortalDocumentDefinition,
  documents: PortalDocument[]
) {
  const titleToken = normalizeToken(definition.title);
  const categoryToken = normalizeToken(definition.category);
  const keyToken = normalizeToken(definition.key);

  return (
    sortDocumentsForDisplay(documents).find((document) => {
      const title = normalizeToken(document.title);
      const category = normalizeToken(document.category);
      const fileName = normalizeToken(document.file_name);
      const sourceTable = normalizeToken(document.source_table);

      const titleMatch =
        (!!titleToken &&
          (title.includes(titleToken) || fileName.includes(titleToken))) ||
        (!!title && titleToken.includes(title));

      const categoryMatch =
        !!categoryToken && !!category && category === categoryToken;
      const sourceMatch =
        !!keyToken && !!sourceTable && sourceTable.includes(keyToken);

      return titleMatch || categoryMatch || sourceMatch;
    }) || null
  );
}

function isPdfLike(document: PortalDocument | null) {
  const fileUrl = firstFilled(document?.file_url);
  const fileName = firstFilled(document?.file_name, document?.title);

  return /\.pdf($|\?)/i.test(fileUrl) || /\.pdf$/i.test(fileName);
}

function documentSummaryCopy(definition: PortalDocumentDefinition) {
  return CUSTOMER_DOCUMENT_COPY[definition.key]?.summary || definition.description;
}

function documentAvailabilityCopy(
  definition: PortalDocumentDefinition,
  enabled: boolean,
  fallbackReason?: string
) {
  if (enabled) {
    return (
      CUSTOMER_DOCUMENT_COPY[definition.key]?.readyText ||
      "This document is available in your account and ready for review."
    );
  }

  return (
    fallbackReason ||
    CUSTOMER_DOCUMENT_COPY[definition.key]?.pendingText ||
    "This document will appear here when it becomes active on your account."
  );
}

function documentTypeLabel(definition: PortalDocumentDefinition) {
  if (definition.key === "bill-of-sale") return "Executed Contract";
  if (definition.key === "deposit-agreement") return "Reservation Contract";
  if (definition.key === "health-guarantee") return "Health Record";
  if (definition.key === "payment-plan-agreement") return "Financing Contract";
  if (definition.key === "pickup-delivery-confirmation")
    return "Transportation Record";
  if (definition.key === "application") return "Buyer Record";
  return "Portal Record";
}

function packetReferenceNumber(definition: PortalDocumentDefinition, displayName: string) {
  const base = `${definition.key}-${displayName}`
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `SWVA-${base.slice(0, 26) || "DOCUMENT"}`;
}

function DocumentPaper({
  selected,
  onClick,
  children,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative block w-full overflow-hidden rounded-[1.15rem] border text-left transition ${
        selected
          ? "border-[#c79a69] bg-[linear-gradient(180deg,rgba(255,252,247,1)_0%,rgba(249,243,233,1)_100%)] shadow-[0_22px_42px_rgba(119,82,48,0.12)]"
          : "border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(252,249,244,1)_100%)] shadow-sm hover:-translate-y-0.5 hover:border-[#d1a577] hover:shadow-[0_18px_34px_rgba(119,82,48,0.09)]"
      }`}
    >
      <div className="absolute inset-y-0 left-0 w-2 bg-[linear-gradient(180deg,#d8b38e_0%,#bb8b5f_100%)]" />
      <div className="absolute inset-x-6 top-[4.5rem] border-t border-dashed border-[rgba(180,148,111,0.24)]" />
      <div className="absolute right-0 top-0 h-14 w-14 translate-x-5 -translate-y-5 rotate-45 border border-[rgba(201,167,127,0.25)] bg-[rgba(250,240,224,0.86)]" />
      <div className="relative px-6 pb-5 pt-5">{children}</div>
    </button>
  );
}

function ContractDirectoryCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[1rem] border border-[rgba(193,164,129,0.24)] bg-[rgba(255,252,246,0.78)] px-4 py-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
        {title}
      </div>
      <div className="mt-2 text-lg font-semibold text-[var(--portal-text)]">
        {value}
      </div>
      <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">
        {hint}
      </div>
    </div>
  );
}

function ContractMetaRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 border-b border-dashed border-[rgba(182,154,120,0.22)] py-3 md:grid-cols-[160px_minmax(0,1fr)]">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="text-sm leading-7 text-[var(--portal-text)]">{value}</div>
    </div>
  );
}

function RecordLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[0.95rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">
        {value}
      </div>
    </div>
  );
}

function ContractSection({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.1rem] border border-[rgba(193,164,129,0.24)] bg-[rgba(255,255,255,0.92)] px-5 py-5">
      <div className="border-b border-dashed border-[rgba(182,154,120,0.28)] pb-3">
        {eyebrow ? (
          <div className="text-[10px] font-bold uppercase tracking-[0.17em] text-[var(--portal-text-muted)]">
            {eyebrow}
          </div>
        ) : null}
        <div className="mt-2 text-[1.05rem] font-semibold tracking-[-0.03em] text-[var(--portal-text)]">
          {title}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SignatureGuidance({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[1rem] border border-[rgba(193,164,129,0.24)] bg-[linear-gradient(180deg,rgba(255,252,247,1)_0%,rgba(251,246,239,1)_100%)] px-5 py-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
        {title}
      </div>
      <div className="mt-2 text-sm leading-7 text-[var(--portal-text-soft)]">
        {description}
      </div>
    </div>
  );
}

function DocumentWorkspace({
  title,
  category,
  reference,
  status,
  filedDate,
  displayName,
  puppyName,
  children,
}: {
  title: string;
  category?: string;
  reference: string;
  status?: React.ReactNode;
  filedDate?: string;
  displayName: string;
  puppyName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-[rgba(191,160,121,0.34)] bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(252,248,241,1)_100%)] shadow-[0_22px_46px_rgba(94,72,45,0.08)]">
      <div className="absolute inset-y-0 left-0 w-2 bg-[linear-gradient(180deg,#d7b089_0%,#bf8d5f_100%)]" />
      <div className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(252,245,234,0.92)_0%,rgba(252,245,234,0)_100%)]" />
      <div className="absolute right-0 top-0 h-16 w-16 translate-x-5 -translate-y-5 rotate-45 border border-[rgba(201,167,127,0.25)] bg-[rgba(250,240,224,0.86)]" />
      <div className="absolute inset-x-8 top-[6.6rem] border-t border-dashed border-[rgba(182,154,120,0.28)]" />
      <div className="absolute inset-x-8 bottom-6 top-[7.2rem] bg-[linear-gradient(to_bottom,rgba(180,148,111,0.10)_1px,transparent_1px)] bg-[length:100%_2.35rem] opacity-[0.22] pointer-events-none" />

      <div className="relative px-8 pb-8 pt-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
              Southwest Virginia Chihuahua
            </div>
            <div className="mt-2 text-[1.75rem] font-semibold tracking-[-0.05em] text-[var(--portal-text)]">
              {title}
            </div>
            <div className="mt-2 text-sm leading-7 text-[var(--portal-text-soft)]">
              {category || "Buyer Document"} · Reference {reference}
            </div>
          </div>

          <div className="flex min-w-[190px] flex-col items-end gap-2">
            {status ? <div>{status}</div> : null}
            {filedDate ? (
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
                {filedDate}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <ContractDirectoryCard
            title="Document Type"
            value={category || "Buyer Document"}
            hint="Formal record held in your puppy packet and buyer file."
          />
          <ContractDirectoryCard
            title="Account Holder"
            value={displayName}
            hint="Primary portal account associated with this record."
          />
          <ContractDirectoryCard
            title="Puppy File"
            value={puppyName}
            hint="Placement, health, and go-home records stay grouped together."
          />
        </div>

        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}

function DocumentActionLink({
  href,
  children,
  tone = "primary",
}: {
  href: string;
  children: React.ReactNode;
  tone?: "primary" | "secondary";
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={
        tone === "primary"
          ? "inline-flex items-center justify-center rounded-[999px] bg-[linear-gradient(135deg,#c46b3d_0%,#8e42df_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(151,82,39,0.24)] transition hover:-translate-y-0.5"
          : "inline-flex items-center justify-center rounded-[999px] border border-[var(--portal-border-strong)] bg-white px-5 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:-translate-y-0.5"
      }
    >
      {children}
    </a>
  );
}

export default function PortalDocumentsPage() {
  const { user, loading: sessionLoading } = usePortalSession();
  const [state, setState] = useState<PageState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [editingKey, setEditingKey] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Record<string, unknown>>>(
    {}
  );
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
          displayName: portalDisplayName(
            user,
            context.buyer,
            context.application
          ),
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
      const portalDocument = findRelatedPortalDocument(definition, state.documents);

      return {
        definition,
        submission,
        status,
        availability,
        highlights,
        portalDocument,
      };
    });
  }, [packetContext, state.documents, state.forms]);

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
    const draft =
      drafts[definition.key] ||
      getDocumentInitialData(definition, packetContext);

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
        error instanceof Error
          ? error.message
          : "Could not save the document right now."
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
        title="Sign in to review your contracts and documents."
        description="Buyer forms, signatures, shared contracts, and breeder-posted documents appear here once you are signed in."
      />
    );
  }

  if (errorText) {
    return (
      <PortalErrorState
        title="Documents are unavailable"
        description={errorText}
      />
    );
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
  const selectedPortalDocument = selectedEntry?.portalDocument || null;
  const showingEditor =
    !!selectedDefinition &&
    selectedDefinition.mode === "form" &&
    (editingKey === selectedDefinition.key ||
      !selectedSubmission ||
      !selectedStatus?.complete);
  const selectedPayload = getDocumentSubmissionPayload(selectedSubmission);
  const selectedPreviewRows = selectedDefinition
    ? documentPreviewRows(selectedDefinition, selectedPayload, 20)
    : [];
  const signedFileUrl = firstFilled(selectedPortalDocument?.file_url);
  const canEmbedSignedDocument =
    !!signedFileUrl && isPdfLike(selectedPortalDocument);
  const packetReference = selectedDefinition
    ? packetReferenceNumber(selectedDefinition, state.displayName)
    : "SWVA-DOCUMENT";
  const activeReviewRows =
    selectedPreviewRows.length
      ? selectedPreviewRows.map((row) => [row.label, row.value] as [string, string])
      : selectedDefinition?.key === "application"
        ? applicationPreviewRows(state.application)
        : [];

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Document Center"
        title="Contracts & Documents"
        description={`Review signed agreements, buyer records, and breeder-shared file copies for ${state.puppyName} in a cleaner contract-style workspace designed to feel more like a formal packet and less like a generic portal page.`}
        actions={
          <PortalHeroPrimaryAction href="/portal/messages">
            Ask The Breeder A Question
          </PortalHeroPrimaryAction>
        }
        aside={
          <div className="grid gap-4">
            <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(251,247,241,1)_100%)] p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--portal-text-muted)]">
                Account Holder
              </div>
              <div className="mt-2 text-xl font-semibold text-[var(--portal-text)]">
                {state.displayName}
              </div>
              <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                Signed copies, draft records, and breeder-filed documents are kept
                together here in one organized packet.
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(251,247,241,1)_100%)] p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--portal-text-muted)]">
                Puppy Packet
              </div>
              <div className="mt-2 text-xl font-semibold text-[var(--portal-text)]">
                {portalPuppyName(state.puppy)}
              </div>
              <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                Placement records, health documents, transportation notes, and
                financing paperwork remain grouped under one file.
              </div>
            </div>
          </div>
        }
      />

      <PortalMetricGrid>
        <PortalMetricCard
          label="Packet Items"
          value={String(summary.packetCount)}
          detail="Document records currently visible in your buyer packet."
        />
        <PortalMetricCard
          label="Filed / Signed"
          value={String(summary.complete)}
          detail="Documents already completed and saved back into your account."
          accent="from-[rgba(113,198,164,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
        <PortalMetricCard
          label="Awaiting Action"
          value={String(summary.pending)}
          detail="Active items that still need review, completion, or signature."
          accent="from-[rgba(200,140,82,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
        <PortalMetricCard
          label="Shared Records"
          value={String(summary.shared)}
          detail={
            summary.shared
              ? "Breeder-posted files and completed account records."
              : "No breeder-posted files yet."
          }
          accent="from-[rgba(110,166,218,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
        <PortalPanel
          title="Packet Directory"
          subtitle="Browse each contract, application, acknowledgement, or breeder-posted record from one formal index."
        >
          <div className="space-y-4">
            {documentCards.map((entry) => (
              <DocumentPaper
                key={entry.definition.key}
                selected={selectedKey === entry.definition.key}
                onClick={() => {
                  setSelectedKey(entry.definition.key);
                  setPanelMessage("");
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                      {documentTypeLabel(entry.definition)}
                    </div>
                    <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--portal-text)]">
                      {entry.definition.title}
                    </div>
                    <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
                      {entry.definition.category}
                    </div>
                  </div>
                  <div className="shrink-0">{documentStatusLabel(entry.status)}</div>
                </div>

                <div className="mt-5 text-sm leading-7 text-[var(--portal-text-soft)]">
                  {documentSummaryCopy(entry.definition)}
                </div>

                <div className="mt-5 space-y-2">
                  {entry.highlights.length ? (
                    entry.highlights.slice(0, 3).map((line) => (
                      <div
                        key={line}
                        className="flex items-center gap-3 text-sm leading-6 text-[var(--portal-text-soft)]"
                      >
                        <span className="h-px flex-1 max-w-[2.25rem] bg-[rgba(177,150,116,0.35)]" />
                        <span className="truncate">{line}</span>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="h-px w-full bg-[rgba(177,150,116,0.18)]" />
                      <div className="h-px w-[88%] bg-[rgba(177,150,116,0.14)]" />
                      <div className="h-px w-[72%] bg-[rgba(177,150,116,0.1)]" />
                    </>
                  )}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[0.95rem] border border-[rgba(193,164,129,0.20)] bg-[rgba(255,252,247,0.8)] px-4 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                      Reference
                    </div>
                    <div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">
                      {packetReferenceNumber(entry.definition, state.displayName)}
                    </div>
                  </div>
                  <div className="rounded-[0.95rem] border border-[rgba(193,164,129,0.20)] bg-[rgba(255,252,247,0.8)] px-4 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                      File Status
                    </div>
                    <div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">
                      {entry.portalDocument?.signed_at || entry.portalDocument?.created_at
                        ? `Filed ${displayDocDate(
                            entry.portalDocument?.signed_at ||
                              entry.portalDocument?.created_at
                          )}`
                        : entry.submission
                          ? `Updated ${displayDocDate(
                              entry.submission.submitted_at ||
                                entry.submission.updated_at ||
                                entry.submission.created_at
                            )}`
                          : entry.availability.enabled
                            ? "Ready for review"
                            : "Pending activation"}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(177,150,116,0.16)] pt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
                  <span>
                    {entry.portalDocument?.file_url
                      ? "Signed copy available"
                      : entry.availability.enabled
                        ? "Open document"
                        : "Available later"}
                  </span>
                  <span>
                    {selectedKey === entry.definition.key ? "Currently selected" : "Select"}
                  </span>
                </div>
              </DocumentPaper>
            ))}
          </div>
        </PortalPanel>

        <div className="space-y-6">
          {selectedDefinition ? (
            <PortalPanel
              title="Contract Review Workspace"
              subtitle="Read the selected item in a more formal document-style layout, with account details, contract context, filed-copy access, and signing tools."
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
                    Reopen For Review
                  </PortalSecondaryButton>
                ) : null
              }
            >
              <DocumentWorkspace
                title={selectedDefinition.title}
                category={selectedDefinition.category}
                reference={packetReference}
                status={selectedStatus ? documentStatusLabel(selectedStatus) : null}
                filedDate={`Filed ${displayDocDate(
                  selectedPortalDocument?.signed_at ||
                    selectedPortalDocument?.created_at ||
                    selectedSubmission?.submitted_at ||
                    selectedSubmission?.updated_at ||
                    selectedSubmission?.created_at
                )}`}
                displayName={state.displayName}
                puppyName={portalPuppyName(state.puppy)}
              >
                <div className="space-y-6">
                  <ContractSection
                    eyebrow="Document Overview"
                    title="Record Classification & Availability"
                  >
                    <div className="space-y-1">
                      <ContractMetaRow
                        label="Record Type"
                        value={documentTypeLabel(selectedDefinition)}
                      />
                      <ContractMetaRow
                        label="Summary"
                        value={documentSummaryCopy(selectedDefinition)}
                      />
                      <ContractMetaRow
                        label="Availability"
                        value={documentAvailabilityCopy(
                          selectedDefinition,
                          selectedAvailability.enabled,
                          selectedAvailability.reason
                        )}
                      />
                      <ContractMetaRow
                        label="Packet Reference"
                        value={packetReference}
                      />
                    </div>
                  </ContractSection>

                  {panelMessage ? (
                    <div className="rounded-[1rem] border border-[rgba(200,140,82,0.35)] bg-[rgba(255,247,240,0.92)] px-5 py-4 text-sm leading-7 text-[var(--portal-text)]">
                      {panelMessage}
                    </div>
                  ) : null}

                  {activeReviewRows.length ? (
                    <ContractSection
                      eyebrow="Account Record"
                      title="Saved Details On File"
                    >
                      <div className="grid gap-3 md:grid-cols-2">
                        {activeReviewRows.map(([label, value]) => (
                          <RecordLine key={`${label}-${value}`} label={label} value={value} />
                        ))}
                      </div>
                    </ContractSection>
                  ) : null}

                  {signedFileUrl ? (
                    <ContractSection
                      eyebrow="Filed Copy"
                      title="Signed Document On Record"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="max-w-2xl text-sm leading-7 text-[var(--portal-text-soft)]">
                          Your completed document is on file and may be opened
                          directly from your portal. This copy stays connected to
                          your buyer packet and breeder record for future review.
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <DocumentActionLink href={signedFileUrl}>
                            View Signed Copy
                          </DocumentActionLink>
                          <DocumentActionLink href={signedFileUrl} tone="secondary">
                            Open In New Tab
                          </DocumentActionLink>
                        </div>
                      </div>

                      {canEmbedSignedDocument ? (
                        <div className="mt-5 overflow-hidden rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)]">
                          <iframe
                            title={`${selectedDefinition.title} Signed Copy`}
                            src={signedFileUrl}
                            className="min-h-[820px] w-full bg-white"
                          />
                        </div>
                      ) : (
                        <div className="mt-5 rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-5 py-4 text-sm leading-7 text-[var(--portal-text-soft)]">
                          A signed file is on record for this document. Use the
                          action buttons above to open the saved copy.
                        </div>
                      )}
                    </ContractSection>
                  ) : null}

                  {selectedDefinition.mode === "link" ? (
                    <div className="space-y-5">
                      <ContractSection
                        eyebrow="Application Record"
                        title="Application Access"
                      >
                        <div className="text-sm leading-7 text-[var(--portal-text-soft)]">
                          Your application remains part of your buyer file and may
                          be reopened whenever you need to review or update the
                          information associated with your account.
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <PortalHeroPrimaryAction href="/portal/application">
                            Open Application
                          </PortalHeroPrimaryAction>
                          <PortalHeroPrimaryAction href="/portal/profile">
                            Review Profile
                          </PortalHeroPrimaryAction>
                        </div>
                      </ContractSection>

                      {!selectedSubmission ? (
                        <SignatureGuidance
                          title="Portal Guidance"
                          description="This application is already part of your portal file. Opening the application page lets you review it and keep your saved record current."
                        />
                      ) : null}
                    </div>
                  ) : !selectedAvailability.enabled && !selectedSubmission ? (
                    <PortalEmptyState
                      title="This document activates later"
                      description={
                        selectedAvailability.reason ||
                        "Once the related buyer step starts, you will be able to review this record here."
                      }
                      action={
                        <PortalHeroPrimaryAction href="/portal/messages">
                          Ask About Next Steps
                        </PortalHeroPrimaryAction>
                      }
                    />
                  ) : (
                    <div className="space-y-5">
                      {showingEditor ? (
                        <>
                          <SignatureGuidance
                            title="Contract Review Notice"
                            description="Please complete the fields below carefully. Saving a draft stores your current work in the portal. Saving a signed copy files the completed record back into your account and breeder file."
                          />

                          <ContractSection
                            eyebrow="Signature & Submission"
                            title="Complete This Record"
                          >
                            <div className="grid gap-4 md:grid-cols-2">
                              {selectedDefinition.fields.map((field) => {
                                if (field.type === "textarea") {
                                  return (
                                    <div key={field.key} className="md:col-span-2">
                                      <PortalField label={field.label}>
                                        <PortalTextarea
                                          rows={field.rows || 4}
                                          value={toInputValue(
                                            selectedDraft[field.key]
                                          ) as string}
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
                                      className="md:col-span-2 flex items-start gap-3 rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4"
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
                                      step={
                                        field.type === "currency" ? "0.01" : undefined
                                      }
                                      value={toInputValue(
                                        selectedDraft[field.key]
                                      ) as string}
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

                            <div className="mt-6 flex flex-wrap gap-3 border-t border-dashed border-[rgba(182,154,120,0.28)] pt-5">
                              <PortalSecondaryButton
                                disabled={savingKey === selectedDefinition.key}
                                onClick={() =>
                                  void saveDocument(selectedDefinition, "draft")
                                }
                              >
                                {savingKey === selectedDefinition.key
                                  ? "Saving..."
                                  : "Save Draft"}
                              </PortalSecondaryButton>
                              <PortalButton
                                disabled={savingKey === selectedDefinition.key}
                                onClick={() =>
                                  void saveDocument(selectedDefinition, "submitted")
                                }
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
                          </ContractSection>
                        </>
                      ) : selectedSubmission ? (
                        <ContractSection
                          eyebrow="Saved Record"
                          title="Completed Portal Copy"
                        >
                          <div className="text-sm leading-7 text-[var(--portal-text-soft)]">
                            This portal copy has already been saved. You may reopen
                            it if you need to review or update the information on
                            file.
                          </div>

                          {selectedPreviewRows.length ? (
                            <div className="mt-5 grid gap-3 md:grid-cols-2">
                              {selectedPreviewRows.map((row) => (
                                <RecordLine
                                  key={`${row.label}-${row.value}`}
                                  label={row.label}
                                  value={row.value}
                                />
                              ))}
                            </div>
                          ) : null}
                        </ContractSection>
                      ) : null}
                    </div>
                  )}
                </div>
              </DocumentWorkspace>
            </PortalPanel>
          ) : null}

          <PortalPanel
            title="Breeder Shared Records"
            subtitle="Additional breeder-posted files are displayed as formal file cards so they read more like filed account records."
          >
            {state.documents.length ? (
              <div className="space-y-4">
                {sortDocumentsForDisplay(state.documents).map((document) => (
                  <div
                    key={document.id}
                    className="relative overflow-hidden rounded-[1.1rem] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(252,249,244,1)_100%)] shadow-sm"
                  >
                    <div className="absolute inset-y-0 left-0 w-2 bg-[linear-gradient(180deg,#d8b38e_0%,#bb8b5f_100%)]" />
                    <div className="absolute inset-x-6 top-[4.2rem] border-t border-dashed border-[rgba(182,154,120,0.22)]" />
                    <div className="absolute right-0 top-0 h-12 w-12 translate-x-4 -translate-y-4 rotate-45 border border-[rgba(207,167,127,0.28)] bg-[rgba(252,245,234,0.92)]" />
                    <div className="relative px-6 pb-5 pt-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                            {firstFilled(document.category, document.status, "Filed Record")}
                          </div>
                          <div className="mt-2 text-lg font-semibold text-[var(--portal-text)]">
                            {firstFilled(
                              document.title,
                              document.file_name,
                              `Document ${document.id}`
                            )}
                          </div>
                        </div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
                          {displayDocDate(document.signed_at || document.created_at)}
                        </div>
                      </div>

                      <div className="mt-5 text-sm leading-7 text-[var(--portal-text-soft)]">
                        {firstFilled(
                          document.description,
                          document.file_name,
                          "A breeder-shared record is on file for this account."
                        )}
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        {document.file_url ? (
                          <DocumentActionLink href={document.file_url}>
                            View File
                          </DocumentActionLink>
                        ) : null}
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