"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { fmtDate, sb } from "@/lib/utils";
import {
  PortalEmptyState,
  PortalHeroPrimaryAction,
  PortalHeroSecondaryAction,
  PortalInfoTile,
  PortalListCard,
  PortalMetricCard,
  PortalMetricGrid,
  PortalPageHero,
  PortalPanel,
} from "@/components/portal/luxury-shell";

type BuyerRow = {
  id: number;
  email: string | null;
  full_name?: string | null;
  name?: string | null;
  user_id?: string | null;
};

type PuppyRow = {
  id: number;
  call_name: string | null;
  puppy_name: string | null;
  name: string | null;
};

type ApplicationRow = {
  id: number;
  created_at: string | null;
  status: string | null;
};

type FormSubmission = {
  id: number;
  created_at: string | null;
  updated_at: string | null;
  form_key: string;
  form_title: string | null;
  version: string | null;
  signed_name: string | null;
  signed_date: string | null;
  signed_at: string | null;
  status: string;
  submitted_at: string | null;
  attachments: Record<string, unknown> | unknown[] | null;
};

type PortalDocument = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string | null;
  created_at: string | null;
  source_table: string | null;
  file_name: string | null;
};

async function findBuyerForUser(user: User): Promise<BuyerRow | null> {
  const email = String(user.email || "").trim().toLowerCase();

  if (user.id) {
    const byUserId = await sb
      .from("buyers")
      .select("id,email,full_name,name,user_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!byUserId.error && byUserId.data) return byUserId.data as BuyerRow;
  }

  if (!email) return null;

  const byEmail = await sb
    .from("buyers")
    .select("id,email,full_name,name,user_id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();

  if (!byEmail.error && byEmail.data) return byEmail.data as BuyerRow;
  return null;
}

async function findPuppyForBuyer(user: User, buyer: BuyerRow | null): Promise<PuppyRow | null> {
  if (buyer?.id) {
    const byBuyer = await sb
      .from("puppies")
      .select("id,call_name,puppy_name,name")
      .eq("buyer_id", buyer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!byBuyer.error && byBuyer.data) return byBuyer.data as PuppyRow;
  }

  const email = String(user.email || "").trim().toLowerCase();
  if (!email) return null;

  const byOwnerEmail = await sb
    .from("puppies")
    .select("id,call_name,puppy_name,name")
    .ilike("owner_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!byOwnerEmail.error && byOwnerEmail.data) return byOwnerEmail.data as PuppyRow;
  return null;
}

async function findApplicationForUser(user: User): Promise<ApplicationRow | null> {
  const email = String(user.email || "").trim().toLowerCase();

  if (user.id) {
    const byUserId = await sb
      .from("puppy_applications")
      .select("id,created_at,status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!byUserId.error && byUserId.data) return byUserId.data as ApplicationRow;
  }

  if (!email) return null;

  const byEmail = await sb
    .from("puppy_applications")
    .select("id,created_at,status")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!byEmail.error && byEmail.data) return byEmail.data as ApplicationRow;
  return null;
}

function countAttachments(raw: FormSubmission["attachments"]) {
  if (!raw) return 0;
  if (Array.isArray(raw)) return raw.length;
  if (typeof raw === "object") return Object.keys(raw).length;
  return 0;
}

function toLabel(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return "Untitled";
  return text.replace(/[_-]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

export default function PortalDocumentsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [buyer, setBuyer] = useState<BuyerRow | null>(null);
  const [puppy, setPuppy] = useState<PuppyRow | null>(null);
  const [application, setApplication] = useState<ApplicationRow | null>(null);
  const [forms, setForms] = useState<FormSubmission[]>([]);
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState("");

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const {
          data: { session },
        } = await sb.auth.getSession();
        if (!mounted) return;
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (currentUser) await loadPortalDocuments(currentUser);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void init();

    const { data: authListener } = sb.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      if (!mounted) return;
      setUser(currentUser);
      if (currentUser) await loadPortalDocuments(currentUser);
      else {
        setBuyer(null);
        setPuppy(null);
        setApplication(null);
        setForms([]);
        setDocuments([]);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function loadPortalDocuments(currentUser: User) {
    setStatusText("Loading forms and documents...");

    const matchedBuyer = await findBuyerForUser(currentUser);
    const matchedPuppy = await findPuppyForBuyer(currentUser, matchedBuyer);
    const matchedApplication = await findApplicationForUser(currentUser);
    const email = String(currentUser.email || "").trim().toLowerCase();

    setBuyer(matchedBuyer);
    setPuppy(matchedPuppy);
    setApplication(matchedApplication);

    const formsByUser = currentUser.id
      ? sb
          .from("portal_form_submissions")
          .select("id,created_at,updated_at,form_key,form_title,version,signed_name,signed_date,signed_at,status,submitted_at,attachments")
          .eq("user_id", currentUser.id)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null });

    const docsByUser = currentUser.id
      ? sb
          .from("portal_documents")
          .select("id,title,description,category,status,created_at,source_table,file_name")
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null });

    const docsByBuyer = matchedBuyer?.id
      ? sb
          .from("portal_documents")
          .select("id,title,description,category,status,created_at,source_table,file_name")
          .eq("buyer_id", matchedBuyer.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null });

    const docsByEmail = email
      ? sb
          .from("portal_documents")
          .select("id,title,description,category,status,created_at,source_table,file_name")
          .ilike("email", email)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null });

    const [formsRes, userDocsRes, buyerDocsRes, emailDocsRes] = await Promise.all([
      formsByUser,
      docsByUser,
      docsByBuyer,
      docsByEmail,
    ]);

    const allDocs = [
      ...(((userDocsRes.data as PortalDocument[]) || [])),
      ...(((buyerDocsRes.data as PortalDocument[]) || [])),
      ...(((emailDocsRes.data as PortalDocument[]) || [])),
    ];

    setForms((formsRes.data as FormSubmission[]) || []);
    setDocuments(Array.from(new Map(allDocs.map((doc) => [String(doc.id), doc])).values()));
    setStatusText("");
  }

  const draftForms = forms.filter((form) => String(form.status || "").toLowerCase() === "draft").length;
  const signedForms = forms.filter((form) => !!form.signed_at || !!form.signed_date || String(form.status || "").toLowerCase().includes("signed")).length;
  const submittedForms = forms.filter((form) => !!form.submitted_at).length;
  const attachmentCount = forms.reduce((sum, form) => sum + countAttachments(form.attachments), 0);
  const puppyName = puppy?.call_name || puppy?.puppy_name || puppy?.name || "your puppy";

  const recentForms = useMemo(
    () =>
      [...forms].sort((a, b) => {
        const aDate = new Date(a.updated_at || a.created_at || 0).getTime();
        const bDate = new Date(b.updated_at || b.created_at || 0).getTime();
        return bDate - aDate;
      }),
    [forms]
  );

  if (loading) {
    return <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">Loading forms and documents...</div>;
  }

  if (!user) {
    return <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">Please sign in to view documents.</div>;
  }

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Contracts & Docs"
        title="Important records for your puppy journey, kept beautifully organized."
        description={`Forms, agreements, submissions, and shared records stay here in one place so you can easily revisit them throughout your time with ${puppyName}.`}
        actions={
          <>
            <PortalHeroPrimaryAction href="/portal/application">Open Application</PortalHeroPrimaryAction>
            <PortalHeroSecondaryAction href="/portal/messages">Message Support</PortalHeroSecondaryAction>
          </>
        }
        aside={
          <div className="space-y-4">
            <PortalInfoTile
              label="Application Status"
              value={toLabel(application?.status || "pending")}
              detail={application?.created_at ? `Started ${fmtDate(application.created_at)}` : "Application progress appears here when available."}
            />
            <PortalInfoTile
              label="Shared Records"
              value={String(documents.length)}
              detail="Client-facing records that have been attached or published to your portal."
            />
          </div>
        }
      />

      {statusText ? <div className="text-sm font-semibold text-[#7b5f46]">{statusText}</div> : null}

      <PortalMetricGrid>
        <PortalMetricCard label="Saved Forms" value={String(forms.length)} detail="Portal form submissions tied to your account." />
        <PortalMetricCard label="Submitted" value={String(submittedForms)} detail="Forms that have been formally submitted." accent="from-[#ece3d5] via-[#d7c1a3] to-[#b18d62]" />
        <PortalMetricCard label="Signed" value={String(signedForms)} detail="Forms with signature history on file." accent="from-[#dce9d6] via-[#b6cfaa] to-[#7e9c6f]" />
        <PortalMetricCard label="Attachments" value={String(attachmentCount)} detail="Files uploaded with your submissions." accent="from-[#f0dcc1] via-[#ddb68c] to-[#c98743]" />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_380px]">
        <div className="space-y-6">
          <PortalPanel title="Forms & Signatures" subtitle="Versioned submissions, signature dates, and form status stay together so you always have a clean record of what has been completed.">
            <div className="space-y-4">
              {recentForms.length ? (
                recentForms.map((form) => (
                  <PortalListCard
                    key={form.id}
                    label={toLabel(form.status)}
                    title={form.form_title || toLabel(form.form_key)}
                    description={[
                      `Version ${form.version || "v1"}`,
                      form.submitted_at ? `Submitted ${fmtDate(form.submitted_at)}` : "Not submitted yet",
                      form.signed_date ? `Signed ${fmtDate(form.signed_date)}` : form.signed_at ? `Signed ${fmtDate(form.signed_at)}` : "Not signed yet",
                      `${countAttachments(form.attachments)} attachment${countAttachments(form.attachments) === 1 ? "" : "s"}`,
                    ].join(" • ")}
                    rightLabel={fmtDate(form.updated_at || form.created_at || "")}
                  />
                ))
              ) : (
                <PortalEmptyState
                  title="No saved form submissions yet"
                  description="When forms are saved, signed, or submitted in the portal, they will appear here automatically."
                />
              )}
            </div>
          </PortalPanel>

          <PortalPanel title="Shared Records" subtitle="Client-facing documents tied to your account can be reviewed here whenever they are uploaded or published.">
            <div className="space-y-4">
              {documents.length ? (
                documents.map((doc) => (
                  <PortalListCard
                    key={doc.id}
                    label={toLabel(doc.category || doc.status || doc.source_table || "document")}
                    title={doc.title || "Portal Document"}
                    description={[doc.description || "No description added yet.", doc.file_name || "No file name listed"].join(" • ")}
                    rightLabel={doc.created_at ? fmtDate(doc.created_at) : "Date unavailable"}
                  />
                ))
              ) : (
                <PortalEmptyState
                  title="No portal documents available yet"
                  description="As contracts, supporting files, or shared records are attached to your account, they will appear here."
                />
              )}
            </div>
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel title="Account Snapshot" subtitle="A quick view of the document-related details families tend to check most often.">
            <div className="space-y-4">
              <PortalInfoTile label="Family" value={buyer?.full_name || buyer?.name || "Portal Family"} detail="The account currently linked to this portal." />
              <PortalInfoTile label="Draft Forms" value={String(draftForms)} detail="Saved forms that have not been submitted yet." />
              <PortalInfoTile label="Signed Forms" value={String(signedForms)} detail="Forms with a signature date or signature status on file." />
              <PortalInfoTile label="Portal Documents" value={String(documents.length)} detail="Shared records available to review here." />
            </div>
          </PortalPanel>

          <PortalPanel title="Why this page matters" subtitle="This page is meant to reduce back-and-forth and keep your formal records easy to find throughout the full relationship with your puppy.">
            <div className="space-y-4">
              <PortalInfoTile label="Before Go-Home" value="Forms stay organized" detail="Applications, contracts, acknowledgements, and supporting forms remain easy to review as your process moves forward." />
              <PortalInfoTile label="After Go-Home" value="Records stay accessible" detail="Important paperwork and shared files remain available after your puppy is home so you are not searching through old emails later." />
            </div>
          </PortalPanel>
        </div>
      </section>
    </div>
  );
}
