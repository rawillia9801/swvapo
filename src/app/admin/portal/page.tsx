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
  adminStatusBadge,
} from "@/components/admin/luxury-admin-shell";
import { fetchAdminOverview, type AdminOverviewStats } from "@/lib/admin-portal";
import { fmtDate, fmtMoney, sb } from "@/lib/utils";
import { isPortalAdminEmail } from "@/lib/portal-admin";

function emptyStats(): AdminOverviewStats {
  return {
    buyers: 0,
    applications: 0,
    payments: 0,
    documents: 0,
    paymentPlans: 0,
    users: 0,
    unreadBuyerMessages: 0,
    visitors24h: 0,
    returningVisitors24h: 0,
    publicThreads24h: 0,
    publicMessages24h: 0,
    openFollowUps: 0,
    hotLeads: 0,
    warmLeads: 0,
    sharedContacts: 0,
    totalRevenue: 0,
    latestDigest: null,
    publicConversationSummaries: [],
    buyerConversationSummaries: [],
  };
}

export default function AdminPortalPage() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<AdminOverviewStats>(emptyStats);

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
        setAccessToken(session?.access_token || "");

        if (currentUser && isPortalAdminEmail(currentUser.email)) {
          const nextStats = await fetchAdminOverview(session?.access_token || "");
          if (mounted) setStats(nextStats || emptyStats());
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
      setAccessToken(session?.access_token || "");

      if (currentUser && isPortalAdminEmail(currentUser.email)) {
        const nextStats = await fetchAdminOverview(session?.access_token || "");
        setStats(nextStats || emptyStats());
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

  async function handleRefresh() {
    if (!accessToken) return;
    setRefreshing(true);
    try {
      const nextStats = await fetchAdminOverview(accessToken);
      setStats(nextStats || emptyStats());
    } finally {
      setRefreshing(false);
    }
  }

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
          title="Run the portal from one clear owner dashboard."
          description="Review buyer volume, application flow, payments, document volume, and ChiChi activity without turning the overview into a wall of tab shortcuts."
          actions={
            <>
              <AdminHeroPrimaryAction href="/admin/portal/users">Open Buyers</AdminHeroPrimaryAction>
              <AdminHeroSecondaryAction href="/admin/portal/assistant">Open ChiChi Admin</AdminHeroSecondaryAction>
            </>
          }
          aside={
            <div className="space-y-4">
              <OverviewInfoLink href="/admin/portal/users">
                <AdminInfoTile
                  label="Portal Users"
                  value={String(stats.users)}
                  detail="Signed-up portal accounts currently recognized by the owner admin routes."
                />
              </OverviewInfoLink>
              <OverviewInfoLink href="/admin/portal/payments">
                <AdminInfoTile
                  label="Recorded Revenue"
                  value={stats.totalRevenue ? fmtMoney(stats.totalRevenue) : "-"}
                  detail="Recorded payment total from buyer payment history."
                />
              </OverviewInfoLink>
            </div>
          }
        />

        <AdminMetricGrid>
          <OverviewMetricLink href="/admin/portal/users">
            <AdminMetricCard label="Total Buyers" value={String(stats.buyers)} detail="Buyer records currently in the system." />
          </OverviewMetricLink>
          <OverviewMetricLink href="/admin/portal/applications">
            <AdminMetricCard
              label="Applications"
              value={String(stats.applications)}
              detail="Submitted application records awaiting review or follow-up."
              accent="from-[#ece3d5] via-[#d7c1a3] to-[#b18d62]"
            />
          </OverviewMetricLink>
          <OverviewMetricLink href="/admin/portal/payments">
            <AdminMetricCard
              label="Payments"
              value={String(stats.payments)}
              detail="Recorded buyer payment entries across all accounts."
              accent="from-[#dce9d6] via-[#b6cfaa] to-[#7e9c6f]"
            />
          </OverviewMetricLink>
          <OverviewMetricLink href="/admin/portal/documents">
            <AdminMetricCard
              label="Documents"
              value={String(stats.documents)}
              detail="Combined portal forms and shared document records."
              accent="from-[#e6def0] via-[#c8b6e3] to-[#8b6fbc]"
            />
          </OverviewMetricLink>
          <OverviewMetricLink href="/admin/portal/payments">
            <AdminMetricCard
              label="Puppy Payment Plans"
              value={String(stats.paymentPlans)}
              detail="Buyer accounts currently marked with financing enabled."
              accent="from-[#f0dcc1] via-[#ddb68c] to-[#c98743]"
            />
          </OverviewMetricLink>
        </AdminMetricGrid>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-7">
            <AdminPanel
              title="ChiChi Daily Brief"
              subtitle="Track public visitor traffic, returning visitors, follow-up needs, and the latest conversation summaries from ChiChi."
              action={
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleRefresh()}
                    disabled={refreshing}
                    className="inline-flex items-center rounded-2xl border border-[#e4d2be] bg-white px-4 py-2 text-sm font-semibold text-[#5d4330] shadow-[0_10px_24px_rgba(106,76,45,0.08)] transition hover:border-[#d4b48b] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {refreshing ? "Refreshing..." : "Refresh Brief"}
                  </button>
                  <Link
                    href="/admin/portal/assistant"
                    className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(181,117,47,0.22)] transition hover:-translate-y-0.5 hover:brightness-105"
                  >
                    Open ChiChi Admin
                  </Link>
                  <Link
                    href="/admin/portal/messages"
                    className="inline-flex items-center rounded-2xl border border-[#e4d2be] bg-white px-4 py-2 text-sm font-semibold text-[#5d4330] shadow-[0_10px_24px_rgba(106,76,45,0.08)] transition hover:border-[#d4b48b]"
                  >
                    Open Buyer Messages
                  </Link>
                </div>
              }
            >
              {stats.latestDigest ? (
                <div className="space-y-5">
                  <OverviewInfoLink href="/admin/portal/assistant">
                    <AdminInfoTile
                      label="Latest Brief"
                      value={fmtDate(stats.latestDigest.digest_date)}
                      detail={stats.latestDigest.summary}
                    />
                  </OverviewInfoLink>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <OverviewInfoLink href="/admin/portal/assistant">
                      <AdminInfoTile
                        label="Visitors (24h)"
                        value={String(stats.visitors24h)}
                        detail="Website visitors seen by ChiChi in the last day."
                      />
                    </OverviewInfoLink>
                    <OverviewInfoLink href="/admin/portal/assistant">
                      <AdminInfoTile
                        label="Returning Visitors"
                        value={String(stats.returningVisitors24h)}
                        detail="Visitors marked as returning during the last 24 hours."
                      />
                    </OverviewInfoLink>
                    <OverviewInfoLink href="/admin/portal/assistant">
                      <AdminInfoTile
                        label="Public Chats (24h)"
                        value={String(stats.publicThreads24h)}
                        detail="Public ChiChi conversation threads active in the last day."
                      />
                    </OverviewInfoLink>
                    <OverviewInfoLink href="/admin/portal/assistant">
                      <AdminInfoTile
                        label="Public Messages (24h)"
                        value={String(stats.publicMessages24h)}
                        detail="Total public ChiChi messages saved in the last day."
                      />
                    </OverviewInfoLink>
                    <OverviewInfoLink href="/admin/portal/assistant">
                      <AdminInfoTile
                        label="Hot Leads"
                        value={String(stats.hotLeads)}
                        detail="Public conversations currently marked hot."
                      />
                    </OverviewInfoLink>
                    <OverviewInfoLink href="/admin/portal/assistant">
                      <AdminInfoTile
                        label="Open Follow-Ups"
                        value={String(stats.openFollowUps)}
                        detail="Open or scheduled follow-up tasks still needing review."
                      />
                    </OverviewInfoLink>
                  </div>

                  {stats.latestDigest.priorities?.length ? (
                    <div className="rounded-[28px] border border-[#ead8c4] bg-[#fffaf5] p-5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a47946]">
                        Priority List
                      </div>
                      <div className="mt-4 space-y-3">
                        {stats.latestDigest.priorities.map((item, index) => (
                          <Link
                            key={`${index}-${item}`}
                            href="/admin/portal/assistant"
                            className="group flex items-start gap-3 rounded-[20px] border border-[#ead9c7] bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:border-[#d8b48b] hover:shadow-[0_14px_28px_rgba(106,76,45,0.08)]"
                          >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fff1df] text-[11px] font-semibold text-[#a66f2f]">
                              {index + 1}
                            </div>
                            <div className="text-sm leading-6 text-[#644b35]">{item}</div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-[28px] border border-[#ead8c4] bg-white p-5 shadow-[0_12px_36px_rgba(106,76,45,0.05)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a47946]">
                          Public Conversation Summaries
                        </div>
                        <div className="mt-2 text-sm leading-6 text-[#73583f]">
                          The most recent ChiChi conversations and what they were about.
                        </div>
                      </div>
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(
                          stats.hotLeads > 0 ? "active" : "pending"
                        )}`}
                      >
                        {stats.hotLeads > 0 ? "Needs Attention" : "Stable"}
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      {stats.publicConversationSummaries.length ? (
                        stats.publicConversationSummaries.map((item) => (
                          <ConversationSummaryRow
                            key={item.id}
                            href="/admin/portal/assistant"
                            title={item.title}
                            preview={item.preview}
                            meta={[
                              item.updatedAt ? fmtDate(item.updatedAt) : "Time unavailable",
                              item.followUpNeeded ? "Follow-up needed" : "No follow-up flagged",
                              item.tags.length ? item.tags.join(", ") : null,
                            ]}
                            status={item.leadStatus}
                          />
                        ))
                      ) : (
                        <AdminEmptyState
                          title="No public conversation summaries yet"
                          description="ChiChi has not recorded any recent public thread summaries yet."
                        />
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <AdminEmptyState
                  title="No daily brief yet"
                  description="Run the ChiChi digest automation and the owner brief will appear here with visitor counts, returning visitors, conversation summaries, and follow-up priorities."
                />
              )}
            </AdminPanel>
          </div>

          <div className="space-y-6 xl:col-span-5">
            <AdminPanel
              title="Buyer Message Summary"
              subtitle="Latest buyer-facing message threads with unread counts and the newest preview."
              action={
                <Link
                  href="/admin/portal/messages"
                  className="inline-flex items-center rounded-2xl border border-[#e4d2be] bg-white px-4 py-2 text-sm font-semibold text-[#5d4330] shadow-[0_10px_24px_rgba(106,76,45,0.08)] transition hover:border-[#d4b48b]"
                >
                  Open Messages
                </Link>
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <OverviewInfoLink href="/admin/portal/messages">
                  <AdminInfoTile
                    label="Unread Buyer Messages"
                    value={String(stats.unreadBuyerMessages)}
                    detail="Buyer replies that still need an admin read."
                  />
                </OverviewInfoLink>
                <OverviewInfoLink href="/admin/portal/assistant">
                  <AdminInfoTile
                    label="Shared Contacts"
                    value={String(stats.sharedContacts)}
                    detail="Public leads who shared email or phone in the last day."
                  />
                </OverviewInfoLink>
              </div>

              <div className="mt-5 space-y-3">
                {stats.buyerConversationSummaries.length ? (
                  stats.buyerConversationSummaries.map((item) => (
                    <BuyerConversationRow
                      key={item.key}
                      href="/admin/portal/messages"
                      title={item.subject}
                      email={item.email || "No email on file"}
                      preview={item.preview}
                      updatedAt={item.updatedAt}
                      unreadCount={item.unreadCount}
                    />
                  ))
                ) : (
                  <AdminEmptyState
                    title="No buyer message threads yet"
                    description="Buyer portal messages will appear here once a buyer starts a conversation."
                  />
                )}
              </div>
            </AdminPanel>

            <AdminPanel
              title="Operational Snapshot"
              subtitle="A smaller pulse of the activity that usually matters first."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <OverviewInfoLink href="/admin/portal/assistant">
                  <AdminInfoTile
                    label="Warm Leads"
                    value={String(stats.warmLeads)}
                    detail="Public conversations currently tagged warm."
                  />
                </OverviewInfoLink>
                <OverviewInfoLink href="/admin/portal/payments">
                  <AdminInfoTile
                    label="Payment Plans"
                    value={String(stats.paymentPlans)}
                    detail="Buyer accounts marked with financing enabled."
                  />
                </OverviewInfoLink>
                <OverviewInfoLink href="/admin/portal/users">
                  <AdminInfoTile
                    label="Portal Users"
                    value={String(stats.users)}
                    detail="Total signed-up portal accounts."
                  />
                </OverviewInfoLink>
                <OverviewInfoLink href="/admin/portal/documents">
                  <AdminInfoTile
                    label="Documents"
                    value={String(stats.documents)}
                    detail="Forms and portal documents combined."
                  />
                </OverviewInfoLink>
              </div>
            </AdminPanel>
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}

function ConversationSummaryRow({
  href,
  title,
  preview,
  meta,
  status,
}: {
  href: string;
  title: string;
  preview: string;
  meta: Array<string | null>;
  status: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-[24px] border border-[#ead9c7] bg-[#fffaf5] p-4 transition hover:-translate-y-0.5 hover:border-[#d8b48b] hover:bg-white hover:shadow-[0_14px_28px_rgba(106,76,45,0.08)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#2f2218]">{title}</div>
          <div className="mt-2 text-sm leading-6 text-[#73583f]">{preview}</div>
        </div>
        <span
          className={`shrink-0 inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(
            status
          )}`}
        >
          {status || "visitor"}
        </span>
      </div>
      <div className="mt-3 text-xs font-semibold text-[#9c7a57]">
        {meta.filter(Boolean).join(" - ")}
      </div>
    </Link>
  );
}

function BuyerConversationRow({
  href,
  title,
  email,
  preview,
  updatedAt,
  unreadCount,
}: {
  href: string;
  title: string;
  email: string;
  preview: string;
  updatedAt: string | null;
  unreadCount: number;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-[24px] border border-[#ead9c7] bg-[#fffaf5] p-4 transition hover:-translate-y-0.5 hover:border-[#d8b48b] hover:bg-white hover:shadow-[0_14px_28px_rgba(106,76,45,0.08)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#2f2218]">{title}</div>
          <div className="mt-1 text-xs font-semibold text-[#9c7a57]">{email}</div>
        </div>
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
            unreadCount > 0
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {unreadCount > 0 ? `${unreadCount} unread` : "up to date"}
        </span>
      </div>
      <div className="mt-3 text-sm leading-6 text-[#73583f]">{preview}</div>
      <div className="mt-3 text-xs font-semibold text-[#9c7a57]">
        {updatedAt ? `Updated ${fmtDate(updatedAt)}` : "Time unavailable"}
      </div>
    </Link>
  );
}

function OverviewMetricLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-[28px] transition hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cda470] focus-visible:ring-offset-2"
    >
      {children}
    </Link>
  );
}

function OverviewInfoLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-[24px] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cda470] focus-visible:ring-offset-2"
    >
      {children}
    </Link>
  );
}
