import { NextResponse } from "next/server";

import {
  createServiceSupabase,
  describeRouteError,
  verifyOwner,
} from "@/lib/admin-api";

export const runtime = "nodejs";

type RawRow = Record<string, unknown>;

function textValue(row: RawRow, key: string) {
  const value = row[key];
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function boolValue(row: RawRow, key: string) {
  const value = row[key];
  if (value === null || value === undefined) return false;
  return Boolean(value);
}

function numberValue(row: RawRow, key: string) {
  const value = row[key];
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function tagsValue(row: RawRow) {
  const value = row.tags;
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

async function safeRows(
  label: string,
  queryFactory: () => PromiseLike<{ data: RawRow[] | null; error: unknown }>,
  warnings: string[]
) {
  try {
    const result = await queryFactory();
    if (result.error) {
      warnings.push(`${label}: ${describeRouteError(result.error, "Could not load records.")}`);
      return [];
    }
    return result.data || [];
  } catch (error) {
    warnings.push(`${label}: ${describeRouteError(error, "Could not load records.")}`);
    return [];
  }
}

function normalizeThread(row: RawRow) {
  return {
    id: textValue(row, "id") || "",
    visitor_id: textValue(row, "visitor_id"),
    source_page: textValue(row, "source_page"),
    source_site: textValue(row, "source_site"),
    status: textValue(row, "status") || "open",
    lead_status: textValue(row, "lead_status") || "visitor",
    follow_up_needed: boolValue(row, "follow_up_needed"),
    follow_up_reason: textValue(row, "follow_up_reason"),
    priority: textValue(row, "priority") || "normal",
    summary: textValue(row, "summary"),
    intent_summary: textValue(row, "intent_summary"),
    tags: tagsValue(row),
    updated_at: textValue(row, "updated_at"),
    last_user_message_at: textValue(row, "last_user_message_at"),
    created_at: textValue(row, "created_at"),
  };
}

function normalizeMessage(row: RawRow) {
  return {
    id: textValue(row, "id") || "",
    created_at: textValue(row, "created_at"),
    thread_id: textValue(row, "thread_id"),
    visitor_id: textValue(row, "visitor_id"),
    sender: textValue(row, "sender") || "visitor",
    content: textValue(row, "content") || textValue(row, "message") || "",
    intent: textValue(row, "intent"),
    topic: textValue(row, "topic"),
    requires_follow_up: boolValue(row, "requires_follow_up"),
    follow_up_reason: textValue(row, "follow_up_reason"),
    tags: tagsValue(row),
  };
}

function normalizeVisitor(row: RawRow) {
  return {
    id: textValue(row, "id") || "",
    session_id: textValue(row, "session_id"),
    first_seen_at: textValue(row, "first_seen_at"),
    last_seen_at: textValue(row, "last_seen_at"),
    current_page: textValue(row, "current_page"),
    landing_page: textValue(row, "landing_page"),
    referrer: textValue(row, "referrer"),
    utm_source: textValue(row, "utm_source"),
    utm_medium: textValue(row, "utm_medium"),
    utm_campaign: textValue(row, "utm_campaign"),
    is_returning: boolValue(row, "is_returning"),
    visit_count: numberValue(row, "visit_count"),
  };
}

export async function GET(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const service = createServiceSupabase();
    const warnings: string[] = [];

    const [threadsRaw, messagesRaw, visitorsRaw] = await Promise.all([
      safeRows(
        "Website chat threads",
        () =>
          service
            .from("chichi_public_threads")
            .select("*")
            .order("updated_at", { ascending: false })
            .limit(250),
        warnings
      ),
      safeRows(
        "Website chat messages",
        () =>
          service
            .from("chichi_public_messages")
            .select("*")
            .order("created_at", { ascending: true })
            .limit(2000),
        warnings
      ),
      safeRows(
        "Website visitors",
        () =>
          service
            .from("website_visitors")
            .select("*")
            .order("last_seen_at", { ascending: false })
            .limit(500),
        warnings
      ),
    ]);

    const threads = threadsRaw.map(normalizeThread).filter((row) => row.id);
    const messages = messagesRaw.map(normalizeMessage).filter((row) => row.id || row.content);
    const visitors = visitorsRaw.map(normalizeVisitor).filter((row) => row.id);

    return NextResponse.json({
      ok: true,
      threads,
      messages,
      visitors,
      warnings,
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin website chats load error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not load website chats."),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const threadId = String(body.threadId || "").trim();
    const action = String(body.action || "").trim();

    if (!threadId) {
      return NextResponse.json(
        { ok: false, error: "A website chat thread id is required." },
        { status: 400 }
      );
    }

    const service = createServiceSupabase();
    const update =
      action === "close"
        ? {
            status: "closed",
            follow_up_needed: false,
            follow_up_reason: null,
            updated_at: new Date().toISOString(),
          }
        : {
            status: "open",
            follow_up_needed: false,
            follow_up_reason: null,
            updated_at: new Date().toISOString(),
          };

    const result = await service
      .from("chichi_public_threads")
      .update(update)
      .eq("id", threadId);

    if (result.error) throw result.error;

    return NextResponse.json({ ok: true, ownerEmail: owner.email || null });
  } catch (error) {
    console.error("Admin website chats update error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not update website chat follow-up."),
      },
      { status: 500 }
    );
  }
}
