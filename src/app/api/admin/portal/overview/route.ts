import { NextResponse } from "next/server";
import {
  createServiceSupabase,
  listAllAuthUsers,
  normalizeEmail,
  verifyOwner,
} from "@/lib/admin-api";
import { loadAdminLineageWorkspace } from "@/lib/admin-lineage";
import { resolveBreedingWorkspace } from "@/lib/resolvers/breeding";
import { resolveBuyers } from "@/lib/resolvers/buyers";
import { resolveChiChiWorkspace } from "@/lib/resolvers/chichi";
import { resolveCoreDashboard } from "@/lib/resolvers/core";
import { resolvePayments } from "@/lib/resolvers/payments";
import { resolvePortalWorkspace } from "@/lib/resolvers/portal";
import { resolveTransportWorkspace } from "@/lib/resolvers/transport";

type DigestRow = {
  id: number;
  digest_date: string;
  summary: string;
  priorities?: string[] | null;
  stats?: Record<string, unknown> | null;
};

type PublicThreadRow = {
  id: string | number;
  updated_at?: string | null;
  lead_status?: string | null;
  follow_up_needed?: boolean | null;
  summary?: string | null;
  intent_summary?: string | null;
  tags?: string[] | null;
};

type BuyerMessageRow = {
  id: string;
  created_at: string;
  user_id?: string | null;
  user_email?: string | null;
  subject?: string | null;
  message?: string | null;
  sender?: string | null;
  read_by_admin?: boolean | null;
};

type LeadRow = {
  email?: string | null;
  phone?: string | null;
  lead_status?: string | null;
};

type AdminAlertRow = {
  id: number;
  created_at?: string | null;
  event_type?: string | null;
  alert_scope?: string | null;
  title?: string | null;
  message?: string | null;
  tone?: string | null;
  buyer_id?: number | null;
  puppy_id?: number | null;
  reference_id?: string | null;
  source?: string | null;
  meta?: Record<string, unknown> | null;
};

function sinceIso(days = 1) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function previewText(value: string | null | undefined, fallback: string) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

async function safeCount(
  queryFactory: () => PromiseLike<{ count: number | null; error: unknown }>
): Promise<number> {
  try {
    const result = await queryFactory();
    return result.count || 0;
  } catch {
    return 0;
  }
}

async function safeRows<T>(
  queryFactory: () => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  try {
    const result = await queryFactory();
    return (result.data || []) as T[];
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const service = createServiceSupabase();
    const since = sinceIso(1);
    const sinceTime = new Date(since).getTime();
    const isRecent = (value: string | null | undefined) =>
      value ? new Date(value).getTime() >= sinceTime : false;

    const [
      authUsers,
      breedingResolved,
      buyersResolved,
      portalResolved,
      chiChiResolved,
      transportResolved,
      coreResolved,
      visitors24h,
      returningVisitors24h,
      lineageWorkspace,
    ] = await Promise.all([
      listAllAuthUsers(),
      resolveBreedingWorkspace(service),
      resolveBuyers(service),
      resolvePortalWorkspace(service),
      resolveChiChiWorkspace(service),
      resolveTransportWorkspace(service),
      resolveCoreDashboard(service),
      safeCount(() =>
        service
          .from("website_visitors")
          .select("*", { count: "exact", head: true })
          .gte("last_seen_at", since)
      ),
      safeCount(() =>
        service
          .from("website_visitors")
          .select("*", { count: "exact", head: true })
          .gte("last_seen_at", since)
          .eq("is_returning", true)
      ),
      loadAdminLineageWorkspace(service),
    ]);

    const paymentsResolved = await resolvePayments(service, {
      buyers: buyersResolved.data,
      puppies: breedingResolved.data.resolvedPuppies,
    });

    const buyers = buyersResolved.data;
    const portal = portalResolved.data;
    const chiChi = chiChiResolved.data;
    const transport = transportResolved.data;
    const payments = paymentsResolved.data;

    const applicationKeys = new Set(
      buyers.flatMap((buyer) =>
        buyer.applications.map((application) =>
          application.id !== null
            ? `id:${application.id}`
            : `fallback:${application.email || application.fullName || application.createdAt || ""}`
        )
      )
    );
    const leadRows = buyers.flatMap((buyer) => buyer.leads);
    const followUps = buyers.flatMap((buyer) => buyer.followUps);

    const overviewBuyers = buyers.length;
    const applications = applicationKeys.size;
    const paymentCount = payments.resolvedPaymentEvents.filter(
      (event) => event.eventType === "payment"
    ).length;
    const documents =
      portal.resolvedPortalForms.length + portal.resolvedPortalDocuments.length;
    const paymentPlans = payments.resolvedBuyerFinancials.filter(
      (financial) =>
        Boolean(financial.buyer?.financeEnabled) ||
        financial.financingPlans.length > 0 ||
        financial.billingSubscriptions.length > 0
    ).length;
    const transportRequests = transport.resolvedTransportRequests.filter((request) => {
      const status = String(request.status || "").trim().toLowerCase();
      return !status || ["pending", "approved", "requested", "scheduled"].includes(status);
    }).length;
    const unreadBuyerMessages = portal.resolvedPortalMessages.filter((message) => {
      const sender = String(message.sender || "").trim().toLowerCase();
      return sender === "user" && message.readByAdmin === false;
    }).length;
    const publicThreads24h = chiChi.resolvedChiChiThreads.filter(
      (thread) => thread.channelType === "public" && isRecent(thread.updatedAt)
    ).length;
    const publicMessages24h = chiChi.resolvedChiChiMessages.filter(
      (message) => message.channelType === "public" && isRecent(message.createdAt)
    ).length;
    const assistantMessages24h = chiChi.resolvedChiChiMessages.filter(
      (message) => message.channelType === "admin" && isRecent(message.createdAt)
    ).length;
    const memoryUpdates24h = chiChi.resolvedChiChiMemory.filter((memory) =>
      isRecent(memory.updatedAt)
    ).length;
    const openFollowUps = followUps.filter((followUp) =>
      ["open", "scheduled"].includes(String(followUp.status || "").trim().toLowerCase())
    ).length;
    const hotLeads = leadRows.filter(
      (lead) =>
        isRecent(lead.createdAt) &&
        String(lead.status || "").trim().toLowerCase() === "hot"
    ).length;
    const warmLeads = leadRows.filter(
      (lead) =>
        isRecent(lead.createdAt) &&
        String(lead.status || "").trim().toLowerCase() === "warm"
    ).length;
    const sharedContacts = leadRows.filter(
      (lead) => isRecent(lead.createdAt) && (!!String(lead.email || "").trim() || !!String(lead.phone || "").trim())
    ).length;
    const totalRevenue = payments.resolvedBuyerFinancials.reduce(
      (sum, row) => sum + Number(row.totalPaid || 0),
      0
    );
    const latestDigest = chiChi.resolvedChiChiDigests[0]
      ? {
          id: chiChi.resolvedChiChiDigests[0].id,
          digest_date: chiChi.resolvedChiChiDigests[0].digestDate,
          summary: chiChi.resolvedChiChiDigests[0].summary,
          priorities: chiChi.resolvedChiChiDigests[0].priorities,
          stats: null,
        }
      : null;
    const adminAlerts = [
      ...chiChi.resolvedChiChiAlerts.map((alert) => ({
        id: alert.id,
        created_at: alert.createdAt,
        event_type: alert.sourceTable,
        alert_scope: alert.sourceTable,
        title: alert.title || "Admin alert",
        message: alert.message || "",
        tone: alert.severity || "neutral",
        buyer_id: alert.buyerId,
        puppy_id: alert.puppyId,
        reference_id: null,
        source: alert.sourceTable,
        meta: null,
      })),
      ...coreResolved.data.alerts.slice(0, 6).map((entry) => ({
        id: entry.id,
        created_at: entry.createdAt,
        event_type: entry.sourceTable,
        alert_scope: "core",
        title: entry.title || "Core alert",
        message: previewText(
          typeof entry.payload.message === "string" ? entry.payload.message : "",
          "Core alert surfaced."
        ),
        tone: entry.status || "neutral",
        buyer_id: null,
        puppy_id: null,
        reference_id: null,
        source: entry.sourceTable,
        meta: entry.payload,
      })),
    ]
      .sort((left, right) => {
        const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
        const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;
        return rightTime - leftTime;
      })
      .slice(0, 6);

    const publicConversationSummaries = chiChi.resolvedChiChiThreads
      .filter((thread) => thread.channelType === "public")
      .slice(0, 8)
      .map((thread) => ({
        id: String(thread.id),
        title:
          String(thread.leadStatus || "").trim()
            ? `${String(thread.leadStatus).replace(/\b\w/g, (char) => char.toUpperCase())} visitor`
            : "Public visitor",
        preview: previewText(
          thread.summary || thread.messages[0]?.body,
          "No conversation summary has been generated yet."
        ),
        updatedAt: thread.updatedAt || null,
        leadStatus: String(thread.leadStatus || "visitor"),
        followUpNeeded: Boolean(thread.followUpNeeded),
        tags: Array.isArray(thread.tags) ? thread.tags.slice(0, 3) : [],
      }));

    const buyerMessageRows = portal.resolvedPortalMessages;
    const buyerThreadMap = new Map<
      string,
      {
        key: string;
        email: string;
        preview: string;
        updatedAt: string | null;
        unreadCount: number;
        subject: string;
      }
    >();

    for (const row of buyerMessageRows) {
      const userId = String(row.userId || "").trim();
      const email = normalizeEmail(row.userEmail);
      const key = userId || email;
      if (!key || buyerThreadMap.has(key)) continue;

      const related = buyerMessageRows.filter((entry) => {
        const entryUserId = String(entry.userId || "").trim();
        const entryEmail = normalizeEmail(entry.userEmail);
        return (userId && entryUserId === userId) || (email && entryEmail === email);
      });

      buyerThreadMap.set(key, {
        key,
        email,
        preview: previewText(row.body, "No message preview available."),
        updatedAt: row.createdAt || null,
        unreadCount: related.filter(
          (entry) =>
            String(entry.sender || "").trim().toLowerCase() === "user" &&
            entry.readByAdmin === false
        ).length,
        subject: previewText(row.subject, email || "Buyer conversation"),
      });
    }

    const buyerConversationSummaries = Array.from(buyerThreadMap.values())
      .sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 8);

    return NextResponse.json({
      ok: true,
      overview: {
        buyers: overviewBuyers,
        applications,
        payments: paymentCount,
        documents,
        paymentPlans,
        transportRequests,
        users: authUsers.length,
        unreadBuyerMessages,
        visitors24h,
        returningVisitors24h,
        publicThreads24h,
        publicMessages24h,
        assistantMessages24h,
        memoryUpdates24h,
        openFollowUps,
        hotLeads,
        warmLeads,
        sharedContacts,
        totalRevenue,
        lineage: {
          totalLitters: lineageWorkspace.summary.totalLitters,
          totalDams: lineageWorkspace.summary.totalDams,
          totalSires: lineageWorkspace.summary.totalSires,
          totalPuppies: lineageWorkspace.summary.totalPuppies,
          availablePuppies: lineageWorkspace.summary.availableCount,
          reservedPuppies: lineageWorkspace.summary.reservedCount,
          completedPuppies: lineageWorkspace.summary.completedCount,
          totalRevenue: lineageWorkspace.summary.totalRevenue,
          projectedRevenue: lineageWorkspace.summary.projectedRevenue,
          realizedRevenue: lineageWorkspace.summary.realizedRevenue,
          totalDeposits: lineageWorkspace.summary.totalDeposits,
          totalCosts: lineageWorkspace.summary.totalCosts,
          projectedCosts: lineageWorkspace.summary.projectedCosts,
          reservedCosts: lineageWorkspace.summary.reservedCosts,
          realizedCosts: lineageWorkspace.summary.realizedCosts,
          totalProfit: lineageWorkspace.summary.totalProfit,
          projectedProfit: lineageWorkspace.summary.projectedProfit,
          reservedProfit: lineageWorkspace.summary.reservedProfit,
          realizedProfit: lineageWorkspace.summary.realizedProfit,
        },
        latestDigest,
        adminAlerts,
        publicConversationSummaries,
        buyerConversationSummaries,
      },
      diagnostics: {
        breeding: breedingResolved.diagnostics,
        buyers: buyersResolved.diagnostics,
        payments: paymentsResolved.diagnostics,
        portal: portalResolved.diagnostics,
        chichi: chiChiResolved.diagnostics,
        transport: transportResolved.diagnostics,
        core: coreResolved.diagnostics,
      },
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin portal overview route error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
