"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  AdminEmptyState,
  AdminHeroPrimaryAction,
  AdminHeroSecondaryAction,
  AdminInfoTile,
  AdminListCard,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPageHero,
  AdminPageShell,
  AdminPanel,
  AdminRestrictedState,
  adminStatusBadge,
} from "@/components/admin/luxury-admin-shell";
import { fetchAdminAccounts, type AdminPortalAccount, type AdminFormRecord, adminNormalizeEmail } from "@/lib/admin-portal";
import { fmtDate, sb } from "@/lib/utils";
import { isPortalAdminEmail } from "@/lib/portal-admin";

type PortalDocument = {
  id: string;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  status?: string | null;
  created_at?: string | null;
  source_table?: string | null;
  file_name?: string | null;
  user_id?: string | null;
  buyer_id?: number | null;
  email?: string | null;
};

type DocumentAccount = AdminPortalAccount & {
  documents: PortalDocument[];
};

function toLabel(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return "Untitled";
  return text.replace(/[_-]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

export default function AdminPortalDocumentsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [accounts, setAccounts] = useState<DocumentAccount[]>([]);
  const [selectedKey, setSelectedKey] = useState("");

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const {
          data: { session },
        } = await sb.auth.getSession();

        if (!mounted) return;
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser && isPortalAdminEmail(currentUser.email)) {
          const nextAccounts = await loadDocumentAccounts(session?.access_token || "");
          setAccounts(nextAccounts);
          setSelectedKey(nextAccounts[0]?.key || "");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void bootstrap();

    const { data: authListener } = sb.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser && isPortalAdminEmail(currentUser.email)) {
        const nextAccounts = await loadDocumentAccounts(session?.access_token || "");
        setAccounts(nextAccounts);
        setSelectedKey((prev) =>
          nextAccounts.find((account) => account.key === prev)?.key || nextAccounts[0]?.key || ""
        );
      } else {
        setAccounts([]);
        setSelectedKey("");
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function loadDocumentAccounts(token: string) {
    const [baseAccounts, documentsRes] = await Promise.all([
      fetchAdminAccounts(token),
      sb
        .from("portal_documents")
        .select("id,title,description,category,status,created_at,source_table,file_name,user_id,buyer_id,email")
        .order("created_at", { ascending: false }),
    ]);

    const documents = (documentsRes.data || []) as PortalDocument[];

    return baseAccounts
      .map((account) => {
        const buyerId = account.buyer?.id || null;
        const email = adminNormalizeEmail(account.email);
        const docs = documents.filter((doc) => {
          const docEmail = adminNormalizeEmail(doc.email);
          return (
            (account.userId && doc.user_id === account.userId) ||
            (buyerId && Number(doc.buyer_id || 0) === buyerId) ||
            (email && docEmail === email)
          );
        });

        return {
          ...account,
          documents: docs,
        };
      })
      .filter((account) => account.forms.length > 0 || account.documents.length > 0)
      .sort((a, b) => {
        const aTotal = a.forms.length + a.documents.length;
        const bTotal = b.forms.length + b.documents.length;
        if (aTotal !== bTotal) return bTotal - aTotal;
        return a.displayName.localeCompare(b.displayName);
      });
  }

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((account) =>
      [
        account.displayName,
        account.email,
        account.buyer?.status,
        account.forms.map((form) => form.form_title || form.form_key).join(" "),
        account.documents.map((doc) => doc.title || doc.category || doc.file_name).join(" "),
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(q)
    );
  }, [accounts, search]);

  const selectedAccount = useMemo(
    () =>
      filteredAccounts.find((account) => account.key === selectedKey) ||
      accounts.find((account) => account.key === selectedKey) ||
      null,
    [accounts, filteredAccounts, selectedKey]
  );

  if (loading) {
    return <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">Loading documents...</div>;
  }

  if (!user) {
    return (
      <AdminRestrictedState
        title="Sign in to access documents."
        details="This page is reserved for the Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!isPortalAdminEmail(user.email)) {
    return (
      <AdminRestrictedState
        title="This document workspace is limited to approved owner accounts."
        details="Only the approved owner emails can manage grouped buyer forms and portal documents here."
      />
    );
  }

  const totalForms = accounts.reduce((sum, account) => sum + account.forms.length, 0);
  const totalDocuments = accounts.reduce((sum, account) => sum + account.documents.length, 0);

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-12">
        <AdminPageHero
          eyebrow="Documents"
          title="Forms and uploads are grouped by buyer so this tab stays usable."
          description="Instead of stacking a long flat list of records from one user, this page keeps buyer cards searchable and lets you open one buyer’s document set at a time."
          actions={
            <>
              <AdminHeroPrimaryAction href="/admin/portal/messages">Open Messages</AdminHeroPrimaryAction>
              <AdminHeroSecondaryAction href="/admin/portal/users">Open Buyers</AdminHeroSecondaryAction>
            </>
          }
          aside={
            <div className="space-y-4">
              <AdminInfoTile label="Buyer Document Cards" value={String(accounts.length)} detail="Each card groups one buyer’s forms and portal files." />
              <AdminInfoTile label="Total Records" value={String(totalForms + totalDocuments)} detail="Combined form submissions and portal documents." />
            </div>
          }
        />

        <AdminMetricGrid>
          <AdminMetricCard label="Buyer Cards" value={String(accounts.length)} detail="Grouped buyer records shown in the documents tab." />
          <AdminMetricCard label="Form Submissions" value={String(totalForms)} detail="Portal form submissions across grouped buyer records." accent="from-[#ece3d5] via-[#d7c1a3] to-[#b18d62]" />
          <AdminMetricCard label="Portal Documents" value={String(totalDocuments)} detail="Shared portal documents tied to grouped buyer records." accent="from-[#dce9d6] via-[#b6cfaa] to-[#7e9c6f]" />
          <AdminMetricCard label="Search Results" value={String(filteredAccounts.length)} detail="Buyer document cards matching the current search." accent="from-[#f0dcc1] via-[#ddb68c] to-[#c98743]" />
        </AdminMetricGrid>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
          <AdminPanel
            title="Buyer Document Cards"
            subtitle="Search by buyer, email, form, or document title. Each card keeps a buyer’s records together."
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search buyer documents..."
              className="w-full rounded-[20px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]"
            />

            <div className="mt-4 space-y-3">
              {filteredAccounts.length ? (
                filteredAccounts.map((account) => (
                  <AdminListCard
                    key={account.key}
                    selected={selectedKey === account.key}
                    onClick={() => setSelectedKey(account.key)}
                    title={account.displayName || "Buyer"}
                    subtitle={account.email || "No email on file"}
                    meta={`${account.forms.length} form${account.forms.length === 1 ? "" : "s"} • ${account.documents.length} document${account.documents.length === 1 ? "" : "s"}`}
                    badge={
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(
                          account.buyer?.status || account.application?.status
                        )}`}
                      >
                        {account.buyer?.status || account.application?.status || "active"}
                      </span>
                    }
                  />
                ))
              ) : (
                <AdminEmptyState
                  title="No document groups matched your search"
                  description="Try a different buyer name, email, form title, or document title."
                />
              )}
            </div>
          </AdminPanel>

          {selectedAccount ? (
            <div className="space-y-6">
              <AdminPanel
                title="Buyer Document Snapshot"
                subtitle="This panel is intentionally grouped by buyer so one user does not flood the screen with scattered records."
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <AdminInfoTile label="Buyer" value={selectedAccount.displayName || "Buyer"} />
                  <AdminInfoTile label="Email" value={selectedAccount.email || "-"} />
                  <AdminInfoTile label="Forms" value={String(selectedAccount.forms.length)} />
                  <AdminInfoTile label="Documents" value={String(selectedAccount.documents.length)} />
                </div>
              </AdminPanel>

              <section className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
                <AdminPanel
                  title="Submitted Forms"
                  subtitle="Portal form submissions for the selected buyer."
                >
                  <div className="space-y-3">
                    {selectedAccount.forms.length ? (
                      selectedAccount.forms.map((form: AdminFormRecord) => (
                        <DocumentRow
                          key={`form-${form.id}`}
                          label={toLabel(form.status)}
                          title={form.form_title || toLabel(form.form_key)}
                          detail={[
                            `Version ${form.form_key}`,
                            form.submitted_at ? `Submitted ${fmtDate(form.submitted_at)}` : `Created ${fmtDate(form.created_at)}`,
                            form.signed_name ? `Signed by ${form.signed_name}` : "Not signed yet",
                          ].join(" • ")}
                        />
                      ))
                    ) : (
                      <AdminEmptyState
                        title="No submitted forms"
                        description="This buyer does not have any form submissions on file yet."
                      />
                    )}
                  </div>
                </AdminPanel>

                <AdminPanel
                  title="Portal Documents"
                  subtitle="Shared documents or uploaded files tied to the selected buyer."
                >
                  <div className="space-y-3">
                    {selectedAccount.documents.length ? (
                      selectedAccount.documents.map((doc) => (
                        <DocumentRow
                          key={`doc-${doc.id}`}
                          label={toLabel(doc.category || doc.status || doc.source_table || "document")}
                          title={doc.title || "Portal Document"}
                          detail={[
                            doc.description || "No description added yet.",
                            doc.file_name || "No file name listed",
                            doc.created_at ? fmtDate(doc.created_at) : "Date unavailable",
                          ].join(" • ")}
                        />
                      ))
                    ) : (
                      <AdminEmptyState
                        title="No portal documents"
                        description="This buyer does not have any shared portal files attached yet."
                      />
                    )}
                  </div>
                </AdminPanel>
              </section>
            </div>
          ) : (
            <AdminPanel
              title="Buyer Document Snapshot"
              subtitle="Choose a buyer document card to begin."
            >
              <AdminEmptyState
                title="No buyer selected"
                description="Choose a buyer card from the left to review grouped forms and documents."
              />
            </AdminPanel>
          )}
        </section>
      </div>
    </AdminPageShell>
  );
}

function DocumentRow({
  label,
  title,
  detail,
}: {
  label: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-[22px] border border-[#ead9c7] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2e9_100%)] p-4 shadow-[0_10px_24px_rgba(106,76,45,0.05)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a47946]">{label}</div>
      <div className="mt-2 text-sm font-semibold text-[#2f2218]">{title}</div>
      <div className="mt-2 text-sm leading-6 text-[#73583f]">{detail}</div>
    </div>
  );
}
