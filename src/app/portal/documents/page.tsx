"use client";

import React, { useEffect, useMemo, useState } from "react";
import { fmtDate } from "@/lib/utils";
import {
  countAttachments,
  findFormSubmissionsForUser,
  findPortalDocumentsForUser,
  loadPortalContext,
  portalDisplayName,
  portalPuppyName,
  type PortalDocument,
  type PortalFormSubmission,
} from "@/lib/portal-data";
import { usePortalSession } from "@/hooks/use-portal-session";
import {
  PortalEmptyState,
  PortalErrorState,
  PortalInfoTile,
  PortalListCard,
  PortalLoadingState,
  PortalMetricCard,
  PortalMetricGrid,
  PortalPageHero,
  PortalPanel,
  PortalStatusBadge,
} from "@/components/portal/luxury-shell";

function toLabel(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return "Untitled";
  return text.replace(/[_-]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function documentTone(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();
  if (["complete", "completed", "signed", "approved"].some((item) => normalized.includes(item))) {
    return "success" as const;
  }
  if (["draft", "pending", "submitted", "review"].some((item) => normalized.includes(item))) {
    return "warning" as const;
  }
  return "neutral" as const;
}

type PageState = {
  forms: PortalFormSubmission[];
  documents: PortalDocument[];
  displayName: string;
  puppyName: string;
};

function emptyState(): PageState {
  return {
    forms: [],
    documents: [],
    displayName: "Portal Family",
    puppyName: "your puppy",
  };
}

export default function PortalDocumentsPage() {
  const { user, loading: sessionLoading } = usePortalSession();
  const [state, setState] = useState<PageState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

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
          forms: submissionRows,
          documents: documentRows,
          displayName: portalDisplayName(user, context.buyer, context.application),
          puppyName: portalPuppyName(context.puppy).toLowerCase(),
        });
      } catch (error) {
        console.error("Could not load documents page:", error);
        if (!active) return;
        setErrorText(
          "We could not load your documents right now. Please refresh or try again in a moment."
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

  const summary = useMemo(() => {
    const drafts = state.forms.filter((form) => String(form.status || "").toLowerCase() === "draft");
    const submitted = state.forms.filter((form) => !!form.submitted_at);
    const signed = state.forms.filter(
      (form) =>
        !!form.signed_at ||
        !!form.signed_date ||
        String(form.status || "").toLowerCase().includes("signed")
    );
    const attachments = state.forms.reduce((sum, form) => sum + countAttachments(form.attachments), 0);
    const publishedDocuments = state.documents.filter(
      (document) => !["draft", "hidden"].includes(String(document.status || "").toLowerCase())
    );

    return {
      drafts,
      submitted,
      signed,
      attachments,
      publishedDocuments,
    };
  }, [state]);

  if (sessionLoading || loading) {
    return <PortalLoadingState label="Loading documents..." />;
  }

  if (!user) {
    return (
      <PortalPageHero
        eyebrow="Documents"
        title="Sign in to review your forms and records."
        description="Forms, signatures, uploaded files, and shared documents appear here once you are signed in."
      />
    );
  }

  if (errorText) {
    return <PortalErrorState title="Documents are unavailable" description={errorText} />;
  }

  const recentForms = [...state.forms].sort((a, b) => {
    const aDate = new Date(a.updated_at || a.created_at || 0).getTime();
    const bDate = new Date(b.updated_at || b.created_at || 0).getTime();
    return bDate - aDate;
  });

  const needsAttention = [
    ...summary.drafts.map((form) => ({
      id: `draft-${form.id}`,
      label: "Draft Form",
      title: form.form_title || toLabel(form.form_key),
      description: "Saved in the portal and still waiting to be finished or submitted.",
      rightLabel: form.updated_at ? fmtDate(form.updated_at) : "Saved",
      tone: "warning" as const,
    })),
    ...state.documents
      .filter((document) => ["pending", "review"].includes(String(document.status || "").toLowerCase()))
      .map((document) => ({
        id: `doc-${document.id}`,
        label: toLabel(document.category || "Document"),
        title: document.title || "Portal record",
        description: document.description || "This record still needs attention.",
        rightLabel: document.created_at ? fmtDate(document.created_at) : "Pending",
        tone: "warning" as const,
      })),
  ].slice(0, 5);

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Documents"
        title="Review forms, signatures, and shared records without the clutter."
        description={`Everything filed for ${state.puppyName} is organized here so contracts, uploads, and submitted forms stay easy to scan.`}
        aside={
          <div className="grid gap-4">
            <PortalInfoTile
              label="Portal Family"
              value={state.displayName}
              detail="The account currently tied to these records."
            />
            <PortalInfoTile
              label="Files on Hand"
              value={String(summary.attachments)}
              detail="Uploads attached to forms or stored with records."
            />
          </div>
        }
      />

      <PortalMetricGrid>
        <PortalMetricCard
          label="Forms"
          value={String(state.forms.length)}
          detail="Saved form submissions tied to your account."
        />
        <PortalMetricCard
          label="Submitted"
          value={String(summary.submitted.length)}
          detail="Forms formally submitted through the portal."
          accent="from-[rgba(93,121,255,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
        <PortalMetricCard
          label="Signed"
          value={String(summary.signed.length)}
          detail="Forms with a signature on file."
          accent="from-[rgba(113,198,164,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
        <PortalMetricCard
          label="Shared Documents"
          value={String(summary.publishedDocuments.length)}
          detail="Records published to the portal for this account."
          accent="from-[rgba(110,166,218,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.18fr)_380px]">
        <div className="space-y-6">
          <PortalPanel
            title="Forms and Signatures"
            subtitle="Saved forms, signed acknowledgements, and submitted records stay together in a cleaner filing view."
          >
            {recentForms.length ? (
              <div className="space-y-4">
                {recentForms.map((form) => (
                  <div
                    key={form.id}
                    className="rounded-[26px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(243,248,253,0.95)_100%)] p-5 shadow-[0_12px_26px_rgba(23,35,56,0.05)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <PortalStatusBadge label={toLabel(form.status)} tone={documentTone(form.status)} />
                          {form.signed_at || form.signed_date ? (
                            <PortalStatusBadge label="Signed" tone="success" />
                          ) : null}
                        </div>
                        <div className="mt-3 text-lg font-semibold tracking-[-0.03em] text-[var(--portal-text)]">
                          {form.form_title || toLabel(form.form_key)}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                          Version {form.version || "v1"} ·{" "}
                          {form.submitted_at ? `Submitted ${fmtDate(form.submitted_at)}` : "Not submitted yet"} ·{" "}
                          {countAttachments(form.attachments)} attachment
                          {countAttachments(form.attachments) === 1 ? "" : "s"}
                        </div>
                      </div>
                      <div className="text-right text-xs text-[var(--portal-text-muted)]">
                        {fmtDate(form.updated_at || form.created_at || "")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <PortalEmptyState
                title="No saved forms yet"
                description="Forms will appear here automatically once they are saved, signed, or submitted through the portal."
              />
            )}
          </PortalPanel>

          <PortalPanel
            title="Shared Documents"
            subtitle="Published files and breeder records remain easy to revisit without searching across messages or email."
          >
            {state.documents.length ? (
              <div className="space-y-4">
                {state.documents.map((document) => (
                  <PortalListCard
                    key={document.id}
                    label={toLabel(document.category || document.status || document.source_table || "Document")}
                    title={document.title || "Portal record"}
                    description={
                      document.description ||
                      `${document.file_name || "File attached"}${
                        document.created_at ? ` · added ${fmtDate(document.created_at)}` : ""
                      }`
                    }
                    rightLabel={document.file_name || "Record"}
                    tone={documentTone(document.status)}
                  />
                ))}
              </div>
            ) : (
              <PortalEmptyState
                title="No shared documents yet"
                description="When contracts, supporting files, or breeder records are posted to your account, they will appear here."
              />
            )}
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel
            title="Needs Attention"
            subtitle="Only the items still waiting for review or completion belong here."
          >
            {needsAttention.length ? (
              <div className="space-y-4">
                {needsAttention.map((entry) => (
                  <PortalListCard
                    key={entry.id}
                    label={entry.label}
                    title={entry.title}
                    description={entry.description}
                    rightLabel={entry.rightLabel}
                    tone={entry.tone}
                  />
                ))}
              </div>
            ) : (
              <PortalEmptyState
                title="Nothing is waiting right now"
                description="Any record that still needs your attention will appear here instead of getting buried in a longer list."
              />
            )}
          </PortalPanel>

        </div>
      </section>
    </div>
  );
}
