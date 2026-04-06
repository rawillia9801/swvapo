import { NextResponse } from "next/server";
import {
  createServiceSupabase,
  listAllAuthUsers,
  normalizeEmail,
  verifyOwner,
} from "@/lib/admin-api";
import { loadAdminLineageWorkspace } from "@/lib/admin-lineage";

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
    const authUsers = await listAllAuthUsers();
    const lineageWorkspacePromise = loadAdminLineageWorkspace(service);

    const [
      buyers,
      applications,
      payments,
      formSubmissions,
      portalDocuments,
      paymentPlans,
      transportRequests,
      unreadBuyerMessages,
      visitors24h,
      returningVisitors24h,
      publicThreads24h,
      publicMessages24h,
      openFollowUps,
      hotLeadRows,
      warmLeadRows,
      sharedContactLeadRows,
      paymentRows,
      latestDigestRows,
      publicThreadRows,
      buyerMessageRows,
      lineageWorkspace,
    ] = await Promise.all([
      safeCount(() => service.from("buyers").select("*", { count: "exact", head: true })),
      safeCount(() => service.from("puppy_applications").select("*", { count: "exact", head: true })),
      safeCount(() => service.from("buyer_payments").select("*", { count: "exact", head: true })),
      safeCount(() => service.from("portal_form_submissions").select("*", { count: "exact", head: true })),
      safeCount(() => service.from("portal_documents").select("*", { count: "exact", head: true })),
      safeCount(() =>
        service.from("buyers").select("*", { count: "exact", head: true }).eq("finance_enabled", true)
      ),
      safeCount(() =>
        service
          .from("portal_pickup_requests")
          .select("*", { count: "exact", head: true })
          .in("status", ["pending", "approved"])
      ),
      safeCount(() =>
        service.from("portal_messages").select("*", { count: "exact", head: true }).eq("read_by_admin", false)
      ),
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
      safeCount(() =>
        service
          .from("chichi_public_threads")
          .select("*", { count: "exact", head: true })
          .gte("updated_at", since)
      ),
      safeCount(() =>
        service
          .from("chichi_public_messages")
          .select("*", { count: "exact", head: true })
          .gte("created_at", since)
      ),
      safeCount(() =>
        service
          .from("crm_followups")
          .select("*", { count: "exact", head: true })
          .in("status", ["open", "scheduled"])
      ),
      safeRows<LeadRow>(() =>
        service.from("crm_leads").select("email,phone,lead_status").gte("created_at", since).limit(200)
      ),
      safeRows<LeadRow>(() =>
        service.from("crm_leads").select("email,phone,lead_status").gte("created_at", since).limit(200)
      ),
      safeRows<LeadRow>(() =>
        service.from("crm_leads").select("email,phone,lead_status").gte("created_at", since).limit(200)
      ),
      safeRows<{ amount?: number | null; status?: string | null }>(() =>
        service.from("buyer_payments").select("amount,status").limit(5000)
      ),
      safeRows<DigestRow>(() =>
        service
          .from("chichi_admin_digests")
          .select("id,digest_date,summary,priorities,stats")
          .order("digest_date", { ascending: false })
          .limit(1)
      ),
      safeRows<PublicThreadRow>(() =>
        service
          .from("chichi_public_threads")
          .select("id,updated_at,lead_status,follow_up_needed,summary,intent_summary,tags")
          .order("updated_at", { ascending: false })
          .limit(8)
      ),
      safeRows<BuyerMessageRow>(() =>
        service
          .from("portal_messages")
          .select("id,created_at,user_id,user_email,subject,message,sender,read_by_admin")
          .order("created_at", { ascending: false })
          .limit(250)
      ),
      lineageWorkspacePromise,
    ]);

    const documents = formSubmissions + portalDocuments;
    const latestDigest = latestDigestRows[0] || null;
    const hotLeads = hotLeadRows.filter((lead) => String(lead.lead_status || "").toLowerCase() === "hot").length;
    const warmLeads = warmLeadRows.filter((lead) => String(lead.lead_status || "").toLowerCase() === "warm").length;
    const sharedContacts = sharedContactLeadRows.filter(
      (lead) => !!String(lead.email || "").trim() || !!String(lead.phone || "").trim()
    ).length;

    const totalRevenue = paymentRows.reduce((sum, row) => {
      const status = String(row.status || "").trim().toLowerCase();
      if (["failed", "void", "cancelled", "canceled"].includes(status)) return sum;
      return sum + Number(row.amount || 0);
    }, 0);

    const publicConversationSummaries = publicThreadRows.map((thread) => ({
      id: String(thread.id),
      title:
        String(thread.lead_status || "").trim()
          ? `${String(thread.lead_status).replace(/\b\w/g, (char) => char.toUpperCase())} visitor`
          : "Public visitor",
      preview: previewText(
        thread.summary || thread.intent_summary,
        "No conversation summary has been generated yet."
      ),
      updatedAt: thread.updated_at || null,
      leadStatus: String(thread.lead_status || "visitor"),
      followUpNeeded: Boolean(thread.follow_up_needed),
      tags: Array.isArray(thread.tags) ? thread.tags.slice(0, 3) : [],
    }));

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
      const userId = String(row.user_id || "").trim();
      const email = normalizeEmail(row.user_email);
      const key = userId || email;
      if (!key || buyerThreadMap.has(key)) continue;

      const related = buyerMessageRows.filter((entry) => {
        const entryUserId = String(entry.user_id || "").trim();
        const entryEmail = normalizeEmail(entry.user_email);
        return (userId && entryUserId === userId) || (email && entryEmail === email);
      });

      buyerThreadMap.set(key, {
        key,
        email,
        preview: previewText(row.message, "No message preview available."),
        updatedAt: row.created_at || null,
        unreadCount: related.filter((entry) => entry.sender === "user" && !entry.read_by_admin).length,
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
        buyers,
        applications,
        payments,
        documents,
        paymentPlans,
        transportRequests,
        users: authUsers.length,
        unreadBuyerMessages,
        visitors24h,
        returningVisitors24h,
        publicThreads24h,
        publicMessages24h,
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
        },
        latestDigest,
        publicConversationSummaries,
        buyerConversationSummaries,
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
