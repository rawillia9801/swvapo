"use client";

import React, { useEffect, useState } from "react";
import { FileCheck2, FolderOpen, PenSquare } from "lucide-react";
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

function documentBadge(document: PortalDocument) {
  return toLabel(document.category || document.status || document.source_table || "document");
}

export default function PortalDocumentsPage() {
  const { user, loading: sessionLoading } = usePortalSession();
  const [forms, setForms] = useState<PortalFormSubmission[]>([]);
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [displayName, setDisplayName] = useState("Portal Family");
  const [puppyName, setPuppyName] = useState("your puppy");
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPage() {
      if (!user) {
        setLoading(false);
        setForms([]);
        setDocuments([]);
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
        setDisplayName(portalDisplayName(user, context.buyer, context.application));
        setPuppyName(portalPuppyName(context.puppy).toLowerCase());
        setForms(submissionRows);
        setDocuments(documentRows);
      } catch (error) {
        console.error("Could not load documents page:", error);
        if (!active) return;
        setErrorText(
          "We could not load your forms and documents right now. Please refresh or try again in a moment."
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

  if (sessionLoading || loading) {
    return <PortalLoadingState label="Loading documents..." />;
  }

  if (!user) {
    return (
      <PortalPageHero
        eyebrow="Documents"
        title="Sign in to view your records."
        description="Forms, signatures, and shared documents live here once you are signed in."
        actions={<PortalHeroPrimaryAction href="/portal">Open Portal Access</PortalHeroPrimaryAction>}
      />
    );
  }

  if (errorText) {
    return <PortalErrorState title="Documents are unavailable" description={errorText} />;
  }

  const draftForms = forms.filter((form) => String(form.status || "").toLowerCase() === "draft").length;
  const submittedForms = forms.filter((form) => !!form.submitted_at).length;
  const signedForms = forms.filter(
    (form) =>
      !!form.signed_at ||
      !!form.signed_date ||
      String(form.status || "").toLowerCase().includes("signed")
  ).length;
  const attachmentCount = forms.reduce((sum, form) => sum + countAttachments(form.attachments), 0);

  const recentForms = [...forms].sort((a, b) => {
    const aDate = new Date(a.updated_at || a.created_at || 0).getTime();
    const bDate = new Date(b.updated_at || b.created_at || 0).getTime();
    return bDate - aDate;
  });

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Documents"
        title="Your forms and records, kept organized."
        description={`This page keeps agreements, signatures, submissions, and shared files easy to revisit throughout your journey with ${puppyName}.`}
        actions={
          <>
            <PortalHeroPrimaryAction href="/portal/application">Open Application</PortalHeroPrimaryAction>
            <PortalHeroSecondaryAction href="/portal/messages">Message Support</PortalHeroSecondaryAction>
          </>
        }
        aside={
          <div className="space-y-4">
            <PortalInfoTile
              label="Portal Family"
              value={displayName}
              detail="The account currently tied to these records."
            />
            <PortalInfoTile
              label="Shared Records"
              value={String(documents.length)}
              detail="Client-facing records currently visible in the portal."
            />
          </div>
        }
      />

      <PortalMetricGrid>
        <PortalMetricCard
          label="Saved Forms"
          value={String(forms.length)}
          detail="Portal form submissions tied to your account."
        />
        <PortalMetricCard
          label="Submitted"
          value={String(submittedForms)}
          detail="Forms formally submitted through the portal."
          accent="from-[#ece3d5] via-[#d7c1a3] to-[#b18d62]"
        />
        <PortalMetricCard
          label="Signed"
          value={String(signedForms)}
          detail="Forms with a signature date or signed status on file."
          accent="from-[#dce9d6] via-[#b6cfaa] to-[#7e9c6f]"
        />
        <PortalMetricCard
          label="Attachments"
          value={String(attachmentCount)}
          detail="Files uploaded with your portal submissions."
          accent="from-[#f0dcc1] via-[#ddb68c] to-[#c98743]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
        <div className="space-y-6">
          <PortalPanel
            title="Forms & Signatures"
            subtitle="Versioned submissions, signature history, and form status stay together so your formal record is easy to follow."
          >
            {recentForms.length ? (
              <div className="space-y-4">
                {recentForms.map((form) => (
                  <div
                    key={form.id}
                    className="rounded-[24px] border border-[#ead9c7] bg-white p-5 shadow-[0_10px_24px_rgba(96,67,38,0.05)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <PortalStatusBadge label={toLabel(form.status)} tone={form.submitted_at ? "success" : "neutral"} />
                          {form.signed_at || form.signed_date ? (
                            <PortalStatusBadge label="Signed" tone="success" />
                          ) : null}
                        </div>
                        <div className="mt-3 text-lg font-semibold text-[#2f2218]">
                          {form.form_title || toLabel(form.form_key)}
                        </div>
                        <div className="mt-2 text-sm leading-7 text-[#72553c]">
                          Version {form.version || "v1"} •{" "}
                          {form.submitted_at
                            ? `Submitted ${fmtDate(form.submitted_at)}`
                            : "Not submitted yet"}{" "}
                          • {countAttachments(form.attachments)} attachment{countAttachments(form.attachments) === 1 ? "" : "s"}
                        </div>
                      </div>
                      <div className="shrink-0 text-[11px] font-medium text-[#8a6a49]">
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
            title="Shared Records"
            subtitle="Client-facing files attached or published to your account remain accessible here instead of getting lost in email."
          >
            {documents.length ? (
              <div className="space-y-4">
                {documents.map((document) => (
                  <PortalListCard
                    key={document.id}
                    label={documentBadge(document)}
                    title={document.title || "Portal document"}
                    description={[
                      document.description || "No description added yet.",
                      document.file_name || "No file name listed",
                    ].join(" • ")}
                    rightLabel={document.created_at ? fmtDate(document.created_at) : "Date unavailable"}
                  />
                ))}
              </div>
            ) : (
              <PortalEmptyState
                title="No shared records yet"
                description="When contracts, supporting files, or other portal documents are attached to your account, they will appear here."
              />
            )}
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel
            title="Snapshot"
            subtitle="A concise record summary without turning the page into a stack of repeated status cards."
          >
            <div className="space-y-4">
              <PortalInfoTile
                label="Draft Forms"
                value={String(draftForms)}
                detail="Saved but not yet submitted."
              />
              <PortalInfoTile
                label="Signed Forms"
                value={String(signedForms)}
                detail="Forms with signature history on file."
              />
              <PortalInfoTile
                label="Portal Documents"
                value={String(documents.length)}
                detail="Shared records available for review."
              />
              <PortalInfoTile
                label="Attachments"
                value={String(attachmentCount)}
                detail="Files submitted along with forms."
              />
            </div>
          </PortalPanel>

          <PortalPanel
            title="How this page helps"
            subtitle="The goal is a clear client record trail, not a cluttered file dump."
          >
            <div className="space-y-3">
              <RecordTip
                icon={<PenSquare className="h-4 w-4" />}
                title="Before go-home day"
                detail="Applications, forms, acknowledgements, and contracts remain easy to find while your process is active."
              />
              <RecordTip
                icon={<FolderOpen className="h-4 w-4" />}
                title="After go-home day"
                detail="Important records stay accessible later when you need to revisit what was signed or shared."
              />
              <RecordTip
                icon={<FileCheck2 className="h-4 w-4" />}
                title="Need clarification?"
                detail="Use Messages if a document status, requirement, or shared file needs explanation."
              />
            </div>
          </PortalPanel>
        </div>
      </section>
    </div>
  );
}

function RecordTip({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[22px] border border-[#eadccf] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(96,67,38,0.05)]">
      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-[#f8efe5] text-[#a17848]">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-[#2f2218]">{title}</div>
        <div className="mt-1 text-sm leading-6 text-[#72553c]">{detail}</div>
      </div>
    </div>
  );
}
