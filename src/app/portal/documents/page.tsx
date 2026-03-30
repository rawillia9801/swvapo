"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FileCheck2, Files, FolderOpen, PenSquare } from "lucide-react";
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
  PortalActionLink,
  PortalEmptyState,
  PortalErrorState,
  PortalHeroPrimaryAction,
  PortalHeroSecondaryAction,
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
  if (["draft", "pending", "submitted"].some((item) => normalized.includes(item))) {
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
    const { forms, documents } = state;
    const drafts = forms.filter((form) => String(form.status || "").toLowerCase() === "draft");
    const submitted = forms.filter((form) => !!form.submitted_at);
    const signed = forms.filter(
      (form) =>
        !!form.signed_at ||
        !!form.signed_date ||
        String(form.status || "").toLowerCase().includes("signed")
    );
    const attachments = forms.reduce((sum, form) => sum + countAttachments(form.attachments), 0);

    return {
      drafts,
      submitted,
      signed,
      attachments,
      publishedDocuments: documents.filter(
        (document) => !["draft", "hidden"].includes(String(document.status || "").toLowerCase())
      ),
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
        actions={<PortalHeroPrimaryAction href="/portal">Open My Puppy Portal</PortalHeroPrimaryAction>}
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
      label: "Draft form",
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
        title: document.title || "Portal document",
        description: document.description || "This record still needs attention.",
        rightLabel: document.created_at ? fmtDate(document.created_at) : "Pending",
        tone: "warning" as const,
      })),
  ].slice(0, 4);

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Documents"
        title="Keep your records organized and easy to review."
        description={`Applications, signatures, uploaded files, and shared records for ${state.puppyName} are collected here in one clean document center.`}
        actions={
          <>
            <PortalHeroPrimaryAction href="/portal/application">Open Application</PortalHeroPrimaryAction>
            <PortalHeroSecondaryAction href="/portal/messages">Open Messages</PortalHeroSecondaryAction>
          </>
        }
        aside={
          <div className="space-y-4">
            <PortalInfoTile
              label="Portal Family"
              value={state.displayName}
              detail="The account currently tied to these records."
            />
            <PortalInfoTile
              label="Shared Records"
              value={String(summary.publishedDocuments.length)}
              detail="Visible files and documents posted to the portal."
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
          accent="from-[#dfe6fb] via-[#b8c7f7] to-[#7388d9]"
        />
        <PortalMetricCard
          label="Signed"
          value={String(summary.signed.length)}
          detail="Forms with a signature on file."
          accent="from-[#d9eef4] via-[#acd4e2] to-[#6da8bd]"
        />
        <PortalMetricCard
          label="Attachments"
          value={String(summary.attachments)}
          detail="Files uploaded along with forms or records."
          accent="from-[#e7ebf2] via-[#cfd8e6] to-[#8ea0b9]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.16fr)_380px]">
        <div className="space-y-6">
          <PortalPanel
            title="Forms and Signatures"
            subtitle="The formal record of your application, acknowledgements, and signed items stays together here."
          >
            {recentForms.length ? (
              <div className="space-y-4">
                {recentForms.map((form) => (
                  <div
                    key={form.id}
                    className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-strong)] p-5 shadow-[0_12px_26px_rgba(31,48,79,0.05)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <PortalStatusBadge label={toLabel(form.status)} tone={documentTone(form.status)} />
                          {form.signed_at || form.signed_date ? (
                            <PortalStatusBadge label="Signed" tone="success" />
                          ) : null}
                        </div>
                        <div className="mt-3 text-lg font-semibold text-[var(--portal-text)]">
                          {form.form_title || toLabel(form.form_key)}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                          Version {form.version || "v1"} -{" "}
                          {form.submitted_at ? `Submitted ${fmtDate(form.submitted_at)}` : "Not submitted yet"} -{" "}
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
                description="When forms are saved, signed, or submitted through the portal, they will appear here automatically."
              />
            )}
          </PortalPanel>

          <PortalPanel
            title="Shared Documents"
            subtitle="Published files, forms, and other records remain easy to revisit without digging through email."
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
                        document.created_at ? ` - added ${fmtDate(document.created_at)}` : ""
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
            subtitle="This keeps the few items that still need action from getting buried under everything else."
          >
            {needsAttention.length ? (
              <div className="space-y-4">
                {needsAttention.map((item) => (
                  <PortalListCard
                    key={item.id}
                    label={item.label}
                    title={item.title}
                    description={item.description}
                    rightLabel={item.rightLabel}
                    tone={item.tone}
                  />
                ))}
              </div>
            ) : (
              <PortalEmptyState
                title="Nothing is waiting on you"
                description="There are no draft forms or pending records needing attention right now."
              />
            )}
          </PortalPanel>

          <PortalPanel
            title="Quick Links"
            subtitle="Open the next page most likely to matter."
          >
            <div className="grid gap-4">
              <PortalActionLink
                href="/portal/application"
                eyebrow="Application"
                title="Review buyer details"
                detail="Open your application if you need to update household details, preferences, or declarations."
              />
              <PortalActionLink
                href="/portal/messages"
                eyebrow="Messages"
                title="Ask about a document"
                detail="Use Messages if a signature, upload, or document status needs clarification."
              />
            </div>
          </PortalPanel>

          <PortalPanel
            title="Record Summary"
            subtitle="A short overview of what is already organized for you."
          >
            <div className="space-y-4">
              <SupportRow
                icon={<PenSquare className="h-4 w-4" />}
                title="Application trail"
                detail="Saved forms and signatures stay tied to the same portal account."
              />
              <SupportRow
                icon={<FolderOpen className="h-4 w-4" />}
                title="Shared records"
                detail="Contracts, uploaded files, and supporting documents remain easy to reopen later."
              />
              <SupportRow
                icon={<FileCheck2 className="h-4 w-4" />}
                title="Clear statuses"
                detail="Draft, submitted, signed, and completed states are visible without making the page feel cluttered."
              />
              <SupportRow
                icon={<Files className="h-4 w-4" />}
                title="Portable reference"
                detail="This page stays useful both before and after your puppy goes home."
              />
            </div>
          </PortalPanel>
        </div>
      </section>
    </div>
  );
}

function SupportRow({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[22px] border border-[var(--portal-border)] bg-white px-4 py-4 shadow-[0_10px_22px_rgba(31,48,79,0.05)]">
      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--portal-surface-muted)] text-[var(--portal-accent-strong)]">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-[var(--portal-text)]">{title}</div>
        <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
      </div>
    </div>
  );
}
