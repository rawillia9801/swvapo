import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type LeadRow = {
  id: string | number;
  created_at?: string | null;
  lead_status?: string | null;
  follow_up_needed?: boolean | null;
  email?: string | null;
  phone?: string | null;
  tags?: string[] | null;
  summary?: string | null;
};

type FollowUpRow = {
  id: string | number;
  status?: string | null;
  priority?: string | null;
  reason?: string | null;
  created_at?: string | null;
};

type ThreadRow = {
  id: string | number;
  created_at?: string | null;
  updated_at?: string | null;
  lead_status?: string | null;
  follow_up_needed?: boolean | null;
  tags?: string[] | null;
};

type MemoryRow = {
  subject?: string | null;
  memory_kind?: string | null;
  updated_at?: string | null;
};

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function createServiceSupabase() {
  return createClient(getEnv("NEXT_PUBLIC_SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayIsoTimestamp() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString();
}

function titleizeTag(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function topTags(rows: Array<{ tags?: string[] | null }>, limit = 4) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    for (const tag of row.tags || []) {
      const key = String(tag || "").trim().toLowerCase();
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

function buildSummary(params: {
  threadCount: number;
  newLeads: number;
  warmLeads: number;
  hotLeads: number;
  sharedContacts: number;
  openFollowUps: number;
  topTopicLabels: string[];
  updatedBusinessMemory: number;
}) {
  const {
    threadCount,
    newLeads,
    warmLeads,
    hotLeads,
    sharedContacts,
    openFollowUps,
    topTopicLabels,
    updatedBusinessMemory,
  } = params;

  const parts = [
    `ChiChi handled ${threadCount} public chat ${threadCount === 1 ? "thread" : "threads"} in the last 24 hours.`,
    `${newLeads} ${newLeads === 1 ? "lead was" : "leads were"} created or updated.`,
    `${warmLeads} warm and ${hotLeads} hot ${warmLeads + hotLeads === 1 ? "lead was" : "leads were"} identified.`,
    sharedContacts
      ? `${sharedContacts} ${sharedContacts === 1 ? "visitor shared" : "visitors shared"} contact details.`
      : "No visitors shared contact details yesterday.",
    openFollowUps
      ? `${openFollowUps} follow-up ${openFollowUps === 1 ? "task remains" : "tasks remain"} open.`
      : "There are no open follow-up tasks right now.",
  ];

  if (topTopicLabels.length) {
    parts.push(`Top conversation topics: ${topTopicLabels.join(", ")}.`);
  }

  if (updatedBusinessMemory) {
    parts.push(
      `${updatedBusinessMemory} business ${updatedBusinessMemory === 1 ? "memory update was" : "memory updates were"} saved recently.`
    );
  }

  return parts.join(" ");
}

function buildPriorities(params: {
  hotLeads: number;
  openFollowUps: number;
  sharedContacts: number;
  topTopicLabels: string[];
  businessMemorySubjects: string[];
}) {
  const items: string[] = [];

  if (params.hotLeads > 0) {
    items.push(`Review ${params.hotLeads} hot lead${params.hotLeads === 1 ? "" : "s"} from the last 24 hours.`);
  }

  if (params.openFollowUps > 0) {
    items.push(`Follow up on ${params.openFollowUps} open follow-up task${params.openFollowUps === 1 ? "" : "s"}.`);
  }

  if (params.sharedContacts > 0) {
    items.push(`Check the visitors who shared contact details and may be ready for personal follow-up.`);
  }

  if (params.topTopicLabels.length) {
    items.push(`Demand is centering on ${params.topTopicLabels.join(", ")} right now.`);
  }

  if (params.businessMemorySubjects.length) {
    items.push(`Recent business memory updates: ${params.businessMemorySubjects.join(", ")}.`);
  }

  if (!items.length) {
    items.push("ChiChi activity was light, with no urgent admin action required.");
  }

  return items.slice(0, 4);
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createServiceSupabase();
    const since = yesterdayIsoTimestamp();
    const digestDate = todayIsoDate();

    const [threadsRes, leadsRes, followupsRes, memoryRes] = await Promise.all([
      admin
        .from("chichi_public_threads")
        .select("id,created_at,updated_at,lead_status,follow_up_needed,tags")
        .gte("updated_at", since)
        .order("updated_at", { ascending: false })
        .limit(200),
      admin
        .from("crm_leads")
        .select("id,created_at,lead_status,follow_up_needed,email,phone,tags,summary")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("crm_followups")
        .select("id,status,priority,reason,created_at")
        .in("status", ["open", "scheduled"])
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("chichi_memory_records")
        .select("subject,memory_kind,updated_at")
        .eq("scope", "global")
        .eq("is_active", true)
        .eq("memory_kind", "business")
        .gte("updated_at", since)
        .order("updated_at", { ascending: false })
        .limit(20),
    ]);

    const threads = (threadsRes.data || []) as ThreadRow[];
    const leads = (leadsRes.data || []) as LeadRow[];
    const followups = (followupsRes.data || []) as FollowUpRow[];
    const recentBusinessMemory = (memoryRes.data || []) as MemoryRow[];

    const warmLeads = leads.filter((lead) => String(lead.lead_status || "").toLowerCase() === "warm").length;
    const hotLeads = leads.filter((lead) => String(lead.lead_status || "").toLowerCase() === "hot").length;
    const sharedContacts = leads.filter((lead) => !!String(lead.email || "").trim() || !!String(lead.phone || "").trim()).length;
    const topicTags = topTags([...threads, ...leads]);
    const topTopicLabels = topicTags.map(titleizeTag);
    const businessMemorySubjects = Array.from(
      new Set(
        recentBusinessMemory
          .map((row) => String(row.subject || "").trim())
          .filter(Boolean)
      )
    ).slice(0, 4);

    const summary = buildSummary({
      threadCount: threads.length,
      newLeads: leads.length,
      warmLeads,
      hotLeads,
      sharedContacts,
      openFollowUps: followups.length,
      topTopicLabels,
      updatedBusinessMemory: recentBusinessMemory.length,
    });

    const priorities = buildPriorities({
      hotLeads,
      openFollowUps: followups.length,
      sharedContacts,
      topTopicLabels,
      businessMemorySubjects,
    });

    const stats = {
      threadCount: threads.length,
      newLeads: leads.length,
      warmLeads,
      hotLeads,
      sharedContacts,
      openFollowUps: followups.length,
      topTopics: topicTags,
      recentBusinessMemory: businessMemorySubjects,
    };

    const { data, error } = await admin
      .from("chichi_admin_digests")
      .upsert(
        {
          digest_date: digestDate,
          summary,
          stats,
          priorities,
          source: "daily",
          generated_at: new Date().toISOString(),
        },
        { onConflict: "digest_date" }
      )
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, digest: data });
  } catch (error) {
    console.error("ChiChi admin digest error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
