"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import {
  AdminEmptyState,
  AdminHeroPrimaryAction,
  AdminHeroSecondaryAction,
  AdminInfoTile,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPageHero,
  AdminPageShell,
  AdminPanel,
  AdminRestrictedState,
} from "@/components/admin/luxury-admin-shell";
import { fetchAdminAccounts } from "@/lib/admin-portal";
import { fmtDate, fmtMoney, sb } from "@/lib/utils";
import { isPortalAdminEmail } from "@/lib/portal-admin";

type DigestRow = {
  id: number;
  digest_date: string;
  summary: string;
  priorities?: string[] | null;
};

type OverviewStats = {
  buyers: number;
  applications: number;
  payments: number;
  messages: number;
  unreadMessages: number;
  forms: number;
  documents: number;
  users: number;
  totalRevenue: number;
  latestDigest: DigestRow | null;
};

function emptyStats(): OverviewStats {
  return {
    buyers: 0,
    applications: 0,
    payments: 0,
    messages: 0,
    unreadMessages: 0,
    forms: 0,
    documents: 0,
    users: 0,
    totalRevenue: 0,
    latestDigest: null,
  };
}

export default function AdminPortalPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<OverviewStats>(emptyStats);

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
          const nextStats = await loadStats(session?.access_token || "");
          if (mounted) setStats(nextStats);
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
        setStats(await loadStats(session?.access_token || ""));
      } else {
        setStats(emptyStats());
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">Loading admin overview...</div>;
  }

  if (!user) {
    return (
      <AdminRestrictedState
        title="Sign in to access the admin overview."
        details="This area is reserved for the Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!isPortalAdminEmail(user.email)) {
    return (
      <AdminRestrictedState
        title="This admin overview is limited to approved owner accounts."
        details="Only the approved owner emails can access the owner command center."
      />
    );
  }

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-12">
        <AdminPageHero
          eyebrow="Overview"
          title="A cleaner admin command center built around the actual tabs you use."
          description="Use this overview to jump into buyers, applications, payments, documents, and messages without mixing those workflows together on the same page."
          actions={
            <>
              <AdminHeroPrimaryAction href="/admin/portal/users">Open Buyers</AdminHeroPrimaryAction>
              <AdminHeroSecondaryAction href="/admin/portal/messages">Open Messages</AdminHeroSecondaryAction>
            </>
          }
          aside={
            <div className="space-y-4">
              <AdminInfoTile label="Portal Users" value={String(stats.users)} detail="Signed-up portal accounts tracked through the owner admin route." />
              <AdminInfoTile label="Recorded Revenue" value={stats.totalRevenue ? fmtMoney(stats.totalRevenue) : "-"} detail="Buyer payment totals currently recorded in buyer_payments." />
            </div>
          }
        />

        <AdminMetricGrid>
          <AdminMetricCard label="Buyers" value={String(stats.buyers)} detail="Buyer records managed in the Buyers tab." />
          <AdminMetricCard label="Applications" value={String(stats.applications)} detail="Submitted portal applications waiting for review or follow-up." accent="from-[#ece3d5] via-[#d7c1a3] to-[#b18d62]" />
          <AdminMetricCard label="Payments" value={String(stats.payments)} detail="Payment records tracked in buyer_payments." accent="from-[#dce9d6] via-[#b6cfaa] to-[#7e9c6f]" />
          <AdminMetricCard label="Documents" value={String(stats.forms + stats.documents)} detail="Combined forms and shared portal documents." accent="from-[#f0dcc1] via-[#ddb68c] to-[#c98743]" />
        </AdminMetricGrid>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="xl:col-span-7 space-y-6">
            <AdminPanel
              title="Primary Admin Tabs"
              subtitle="Each tab now has a cleaner purpose so buyer records, money, messages, and documents stay organized."
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <QuickLinkCard title="Buyers" detail="Buyer records only: contact details, notes, and linked portal status." href="/admin/portal/users" />
                <QuickLinkCard title="Applications" detail="Application review, assignment, approval, and denial flow." href="/admin/portal/applications" />
                <QuickLinkCard title="Payments" detail="Financial settings, finance plans, and grouped payment history by buyer." href="/admin/portal/payments" />
                <QuickLinkCard title="Documents" detail="Grouped forms and files by buyer, not a flat pile of records." href="/admin/portal/documents" />
                <QuickLinkCard title="Messages" detail="Grouped buyer inbox cards with one thread per buyer." href="/admin/portal/messages" />
                <QuickLinkCard title="ChiChi Admin" detail="Natural-language admin changes and operational memory." href="/admin/portal/assistant" />
              </div>
            </AdminPanel>

            <AdminPanel
              title="Live Admin Snapshot"
              subtitle="A compact pulse of the most useful operational counts."
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <AdminInfoTile label="Unread Messages" value={String(stats.unreadMessages)} detail="Buyer replies still unread by admin." />
                <AdminInfoTile label="Form Submissions" value={String(stats.forms)} detail="Portal form submissions stored under portal_form_submissions." />
                <AdminInfoTile label="Shared Documents" value={String(stats.documents)} detail="Portal files stored under portal_documents." />
              </div>
            </AdminPanel>
          </div>

          <div className="xl:col-span-5 space-y-6">
            <AdminPanel
              title="ChiChi Daily Brief"
              subtitle="Your current admin digest and next priorities."
            >
              {stats.latestDigest ? (
                <div className="space-y-4">
                  <AdminInfoTile
                    label="Latest Brief"
                    value={fmtDate(stats.latestDigest.digest_date)}
                    detail={stats.latestDigest.summary}
                  />
                  {stats.latestDigest.priorities?.length ? (
                    <div className="space-y-3">
                      {stats.latestDigest.priorities.map((item) => (
                        <div
                          key={item}
                          className="rounded-[22px] border border-[#ead9c7] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2e9_100%)] p-4 text-sm leading-6 text-[#73583f]"
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <AdminEmptyState
                  title="No daily brief yet"
                  description="Run the ChiChi digest automation to populate the daily owner brief."
                />
              )}
            </AdminPanel>
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}

async function loadStats(accessToken: string) {
  const [users, paymentsRes, digestRes] = await Promise.all([
    fetchAdminAccounts(accessToken),
    sb.from("buyer_payments").select("amount,status"),
    sb
      .from("chichi_admin_digests")
      .select("id,digest_date,summary,priorities")
      .order("digest_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const [buyers, applications, messages, forms, documents, unreadMessages] = await Promise.all([
    getCount("buyers"),
    getCount("puppy_applications"),
    getCount("portal_messages"),
    getCount("portal_form_submissions"),
    getCount("portal_documents"),
    getUnreadMessageCount(),
  ]);

  const paymentRows = (paymentsRes.data || []) as Array<{ amount?: number | null; status?: string | null }>;
  const totalRevenue = paymentRows.reduce((sum, row) => {
    const status = String(row.status || "").toLowerCase();
    if (["failed", "void", "canceled", "cancelled"].includes(status)) return sum;
    return sum + Number(row.amount || 0);
  }, 0);

  return {
    buyers,
    applications,
    payments: paymentRows.length,
    messages,
    unreadMessages,
    forms,
    documents,
    users: users.length,
    totalRevenue,
    latestDigest: (digestRes.data as DigestRow | null) || null,
  };
}

async function getCount(tableName: string) {
  try {
    const result = await sb.from(tableName).select("*", { count: "exact", head: true });
    return result.count || 0;
  } catch {
    return 0;
  }
}

async function getUnreadMessageCount() {
  try {
    const result = await sb
      .from("portal_messages")
      .select("*", { count: "exact", head: true })
      .eq("read_by_admin", false);
    return result.count || 0;
  } catch {
    return 0;
  }
}

function QuickLinkCard({
  title,
  detail,
  href,
}: {
  title: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[24px] border border-[#ead9c7] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2e9_100%)] p-5 shadow-[0_10px_24px_rgba(106,76,45,0.05)] transition hover:-translate-y-1 hover:border-[#d8b48b]"
    >
      <div className="text-lg font-semibold text-[#2f2218]">{title}</div>
      <div className="mt-2 text-sm leading-6 text-[#73583f]">{detail}</div>
      <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b8772f]">Open Tab</div>
    </Link>
  );
}
