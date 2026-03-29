"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { fmtDate, sb } from "@/lib/utils";

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
  full_name: string | null;
  email: string;
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
  file_url: string | null;
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
      .select("id,created_at,status,full_name,email")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!byUserId.error && byUserId.data) return byUserId.data as ApplicationRow;
  }

  if (!email) return null;

  const byEmail = await sb
    .from("puppy_applications")
    .select("id,created_at,status,full_name,email")
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
  return text
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
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
        if (currentUser) {
          await loadPortalDocuments(currentUser);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void init();

    const { data: authListener } = sb.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      if (!mounted) return;

      setUser(currentUser);
      if (currentUser) {
        await loadPortalDocuments(currentUser);
      } else {
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
          .select(
            "id,created_at,updated_at,form_key,form_title,version,signed_name,signed_date,signed_at,status,submitted_at,attachments"
          )
          .eq("user_id", currentUser.id)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null });

    const docsByUser = currentUser.id
      ? sb
          .from("portal_documents")
          .select("id,title,description,category,status,created_at,source_table,file_url,file_name")
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null });

    const docsByBuyer = matchedBuyer?.id
      ? sb
          .from("portal_documents")
          .select("id,title,description,category,status,created_at,source_table,file_url,file_name")
          .eq("buyer_id", matchedBuyer.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null });

    const docsByEmail = email
      ? sb
          .from("portal_documents")
          .select("id,title,description,category,status,created_at,source_table,file_url,file_name")
          .ilike("email", email)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null });

    const [formsRes, portalUserDocsRes, portalBuyerDocsRes, portalEmailDocsRes] = await Promise.all([
      formsByUser,
      docsByUser,
      docsByBuyer,
      docsByEmail,
    ]);

    const formRows = (formsRes.data as FormSubmission[]) || [];
    const allDocs = [
      ...(((portalUserDocsRes.data as PortalDocument[]) || [])),
      ...(((portalBuyerDocsRes.data as PortalDocument[]) || [])),
      ...(((portalEmailDocsRes.data as PortalDocument[]) || [])),
    ];

    const uniqueDocs = Array.from(
      new Map(allDocs.map((doc) => [String(doc.id), doc])).values()
    );

    setForms(formRows);
    setDocuments(uniqueDocs);
    setStatusText("");
  }

  const draftForms = forms.filter((form) => String(form.status || "").toLowerCase() === "draft").length;
  const signedForms = forms.filter(
    (form) =>
      !!form.signed_at ||
      !!form.signed_date ||
      String(form.status || "").toLowerCase().includes("signed")
  ).length;
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
    return <div className="py-20 text-center text-sm font-semibold text-slate-300">Loading forms and documents...</div>;
  }

  if (!user) {
    return <div className="py-20 text-center text-sm font-semibold text-slate-300">Please sign in to view documents.</div>;
  }

  return (
    <div className="space-y-6 pb-14">
      <section className="overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(135deg,#0b1120_0%,#111827_45%,#172036_100%)] shadow-[0_30px_80px_rgba(2,6,23,0.42)]">
        <div className="grid grid-cols-1 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.18),transparent_24%),linear-gradient(145deg,#0b1120_0%,#172554_48%,#312e81_100%)] px-7 py-8 text-white md:px-9 md:py-10">
            <div className="absolute -left-6 top-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-52 w-52 rounded-full bg-[#f1d3ab]/20 blur-3xl" />

            <div className="relative inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/82">
              Documents & Forms
            </div>

            <h1 className="relative mt-6 max-w-2xl font-serif text-4xl font-bold leading-[0.94] md:text-6xl">
              Your signed forms and shared records, all in one place.
            </h1>

            <p className="relative mt-4 max-w-2xl text-sm font-semibold leading-7 text-white/80 md:text-[15px]">
              Keep agreements, submissions, and client-facing portal records neatly organized throughout the journey with {puppyName}.
            </p>

            <div className="relative mt-8 flex flex-wrap gap-3">
              <Link
                href="/portal/application"
                className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#60a5fa_0%,#7c3aed_100%)] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_18px_32px_rgba(59,130,246,0.26)] transition hover:translate-y-[-1px]"
              >
                View Application
              </Link>
              <Link
                href="/portal/messages"
                className="inline-flex items-center rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white backdrop-blur-sm transition hover:bg-white/15"
              >
                Message Support
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 bg-[linear-gradient(180deg,rgba(15,23,42,0.72)_0%,rgba(15,23,42,0.44)_100%)] p-7 md:grid-cols-2 md:p-8">
            <PremiumStat label="Forms" value={String(forms.length)} detail="Saved portal submissions" />
            <PremiumStat label="Submitted" value={String(submittedForms)} detail="Forms turned in" />
            <PremiumStat label="Signed" value={String(signedForms)} detail="Signature records on file" />
            <PremiumStat label="Attachments" value={String(attachmentCount)} detail="Files included with submissions" />
          </div>
        </div>
      </section>

      {statusText ? <div className="text-sm font-semibold text-slate-300">{statusText}</div> : null}

      <section className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        <div className="space-y-8 xl:col-span-8">
          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9)_0%,rgba(15,23,42,0.72)_100%)] p-7 shadow-[0_20px_50px_rgba(2,6,23,0.3)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Forms
                </div>
                <h2 className="mt-3 font-serif text-3xl font-bold text-white">
                  Portal submissions and signature history
                </h2>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {recentForms.length ? (
                recentForms.map((form) => (
                  <div key={form.id} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
                        {toLabel(form.status)}
                      </span>
                      <div className="text-xs font-semibold text-slate-400">
                        {fmtDate(form.updated_at || form.created_at || "")}
                      </div>
                    </div>

                    <div className="mt-4 text-xl font-black text-white">
                      {form.form_title || toLabel(form.form_key)}
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <InfoLine label="Version" value={form.version || "v1"} />
                      <InfoLine label="Submitted" value={form.submitted_at ? fmtDate(form.submitted_at) : "Not submitted"} />
                      <InfoLine label="Signed" value={form.signed_date ? fmtDate(form.signed_date) : form.signed_at ? fmtDate(form.signed_at) : "Not signed"} />
                      <InfoLine label="Attachments" value={String(countAttachments(form.attachments))} />
                    </div>

                    {form.signed_name ? (
                      <div className="mt-4 rounded-[18px] border border-white/10 bg-slate-950/35 px-4 py-3 text-sm font-semibold text-slate-200">
                        Signed by {form.signed_name}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-white/10 bg-white/4 py-14 text-center text-sm font-semibold italic text-slate-400">
                  No saved form submissions were found yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9)_0%,rgba(15,23,42,0.72)_100%)] p-7 shadow-[0_20px_50px_rgba(2,6,23,0.3)]">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
              Shared Records
            </div>
            <h2 className="mt-3 font-serif text-3xl font-bold text-white">
              Portal documents
            </h2>

            <div className="mt-6 space-y-4">
              {documents.length ? (
                documents.map((doc) => (
                  <div key={doc.id} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-lg font-black text-white">{doc.title || "Portal Document"}</div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
                        {toLabel(doc.category || doc.status || doc.source_table || "document")}
                      </span>
                    </div>

                    {doc.description ? (
                      <div className="mt-2 text-sm font-semibold leading-7 text-slate-300">{doc.description}</div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-400">
                      <span>{doc.created_at ? fmtDate(doc.created_at) : "Date unavailable"}</span>
                      {doc.file_name ? <span>{doc.file_name}</span> : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-white/10 bg-white/4 py-14 text-center text-sm font-semibold italic text-slate-400">
                  No portal documents are available yet.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6 xl:col-span-4">
          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9)_0%,rgba(15,23,42,0.72)_100%)] p-7 shadow-[0_20px_50px_rgba(2,6,23,0.3)]">
            <h3 className="font-serif text-2xl font-bold text-white">Account Snapshot</h3>
            <div className="mt-5 space-y-3">
              <InfoTile label="Family" value={buyer?.full_name || buyer?.name || "Portal Family"} />
              <InfoTile label="Application Status" value={toLabel(application?.status || "pending")} />
              <InfoTile label="Draft Forms" value={String(draftForms)} />
              <InfoTile label="Shared Documents" value={String(documents.length)} />
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9)_0%,rgba(15,23,42,0.72)_100%)] p-7 shadow-[0_20px_50px_rgba(2,6,23,0.3)]">
            <h3 className="font-serif text-2xl font-bold text-white">What belongs here</h3>
            <div className="mt-5 space-y-3">
              <FeatureCard title="Signed Agreements" desc="Versioned forms, signature dates, and status history stay together in one place." />
              <FeatureCard title="Shared Records" desc="Client-facing files from your portal can appear here as they are prepared and published." />
              <FeatureCard title="Application History" desc="Your application progress stays connected to the broader portal record." />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function PremiumStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-white/5 p-5 shadow-[0_20px_44px_rgba(2,6,23,0.26)]">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-3 font-serif text-3xl font-bold text-white">{value}</div>
      <div className="mt-2 text-sm font-semibold leading-6 text-slate-300">{detail}</div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-200">{value}</div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-black text-white">{title}</div>
      <div className="mt-1 text-[12px] font-semibold leading-6 text-slate-300">{desc}</div>
    </div>
  );
}
