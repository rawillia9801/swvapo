import { NextResponse } from "next/server";
import {
  createServiceSupabase,
  describeRouteError,
  firstValue,
  verifyOwner,
} from "@/lib/admin-api";
import { queryBuyerPaymentNoticeLogs } from "@/lib/admin-data-compat";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const TEMPLATE_MIGRATION_PATH = "supabase/migrations/20260416_puppy_operations_workspace.sql";
const NOTICE_TRACKING_MIGRATION_PATH = "supabase/migrations/20260417_resend_notice_tracking.sql";

type MessageTemplateRow = {
  id: number;
  template_key?: string | null;
  category?: string | null;
  label?: string | null;
  description?: string | null;
  channel?: string | null;
  provider?: string | null;
  subject?: string | null;
  body?: string | null;
  automation_enabled?: boolean | null;
  is_active?: boolean | null;
  preview_payload?: Record<string, unknown> | null;
  updated_at?: string | null;
};

type NoticeLogRow = {
  id: number;
  created_at?: string | null;
  buyer_id?: number | null;
  puppy_id?: number | null;
  notice_kind?: string | null;
  recipient_email?: string | null;
  subject?: string | null;
  status?: string | null;
  provider_message_id?: string | null;
  last_event_type?: string | null;
  last_event_at?: string | null;
  delivered_at?: string | null;
  opened_at?: string | null;
  clicked_at?: string | null;
  open_count?: number | null;
  click_count?: number | null;
};

type BuyerRow = {
  id: number;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
};

type PuppyRow = {
  id: number;
  call_name?: string | null;
  puppy_name?: string | null;
  name?: string | null;
};

function text(value: unknown) {
  return String(value || "").trim();
}

function bool(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  const normalized = text(value).toLowerCase();
  if (!normalized) return fallback;
  return ["1", "true", "yes", "on"].includes(normalized);
}

function intValue(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function jsonObject(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  const raw = text(value);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function errorText(error: unknown) {
  return (error instanceof Error ? error.message : String(error || "")).toLowerCase();
}

function isMissingTableError(error: unknown) {
  const message = errorText(error);
  return (
    message.includes("does not exist") ||
    message.includes("relation") ||
    message.includes("schema cache") ||
    message.includes("could not find the table")
  );
}

function isMissingColumnError(error: unknown) {
  const message = errorText(error);
  return message.includes("column") || message.includes("schema cache");
}

function toTemplate(row: MessageTemplateRow) {
  return {
    id: Number(row.id),
    templateKey: text(row.template_key),
    category: text(row.category) || "custom",
    label: text(row.label),
    description: text(row.description) || "",
    channel: text(row.channel) || "email",
    provider: text(row.provider) || "resend",
    subject: text(row.subject),
    body: text(row.body),
    automationEnabled: row.automation_enabled !== false,
    isActive: row.is_active !== false,
    previewPayload:
      row.preview_payload && typeof row.preview_payload === "object" && !Array.isArray(row.preview_payload)
        ? row.preview_payload
        : {},
    updatedAt: row.updated_at || null,
  };
}

async function loadRecentActivity(service = createServiceSupabase()) {
  const trackedSelect = [
    "id",
    "created_at",
    "buyer_id",
    "puppy_id",
    "notice_kind",
    "recipient_email",
    "subject",
    "status",
    "provider_message_id",
    "last_event_type",
    "last_event_at",
    "delivered_at",
    "opened_at",
    "clicked_at",
    "open_count",
    "click_count",
  ].join(",");

  const fallbackSelect = [
    "id",
    "created_at",
    "buyer_id",
    "puppy_id",
    "notice_kind",
    "recipient_email",
    "subject",
    "status",
    "provider_message_id",
  ].join(",");

  let noticeResult = await queryBuyerPaymentNoticeLogs<NoticeLogRow>(
    service,
    trackedSelect,
    (query) => query.order("created_at", { ascending: false }).limit(25)
  );

  let trackingColumnsReady = true;
  if (noticeResult.error && isMissingColumnError(noticeResult.error)) {
    trackingColumnsReady = false;
    noticeResult = await queryBuyerPaymentNoticeLogs<NoticeLogRow>(
      service,
      fallbackSelect,
      (query) => query.order("created_at", { ascending: false }).limit(25)
    );
  }

  if (noticeResult.error) {
    if (isMissingTableError(noticeResult.error)) {
      return {
        recentActivity: [],
        trackingColumnsReady: false,
        warning: `Payment email activity is not installed yet. Apply ${NOTICE_TRACKING_MIGRATION_PATH} to enable delivery tracking.`,
      };
    }
    throw noticeResult.error;
  }

  const rows = (noticeResult.data || []) as NoticeLogRow[];
  if (!rows.length) {
    return {
      recentActivity: [],
      trackingColumnsReady,
      warning: trackingColumnsReady
        ? ""
        : `Email activity tracking columns are not installed yet. Apply ${NOTICE_TRACKING_MIGRATION_PATH} to capture open and delivery events.`,
    };
  }

  const buyerIds = Array.from(
    new Set(rows.map((row) => Number(row.buyer_id || 0)).filter((value) => value > 0))
  );
  const puppyIds = Array.from(
    new Set(rows.map((row) => Number(row.puppy_id || 0)).filter((value) => value > 0))
  );

  const [buyersResult, puppiesResult] = await Promise.all([
    buyerIds.length
      ? service
          .from("buyers")
          .select("id,full_name,name,email")
          .in("id", buyerIds)
          .returns<BuyerRow[]>()
      : Promise.resolve({ data: [] as BuyerRow[], error: null }),
    puppyIds.length
      ? service
          .from("puppies")
          .select("id,call_name,puppy_name,name")
          .in("id", puppyIds)
          .returns<PuppyRow[]>()
      : Promise.resolve({ data: [] as PuppyRow[], error: null }),
  ]);

  if (buyersResult.error) throw buyersResult.error;
  if (puppiesResult.error) throw puppiesResult.error;

  const buyerMap = new Map<number, BuyerRow>(
    (buyersResult.data || []).map((buyer) => [buyer.id, buyer])
  );
  const puppyMap = new Map<number, PuppyRow>(
    (puppiesResult.data || []).map((puppy) => [puppy.id, puppy])
  );

  return {
    recentActivity: rows.map((row) => {
      const buyerId = Number(row.buyer_id || 0) || null;
      const puppyId = Number(row.puppy_id || 0) || null;
      const buyer = buyerId ? buyerMap.get(buyerId) || null : null;
      const puppy = puppyId ? puppyMap.get(puppyId) || null : null;

      return {
        id: Number(row.id),
        buyerId,
        buyerName:
          firstValue(buyer?.full_name, buyer?.name, buyer?.email, buyerId ? `Buyer #${buyerId}` : "") ||
          "Buyer",
        puppyId,
        puppyName:
          firstValue(puppy?.call_name, puppy?.puppy_name, puppy?.name, puppyId ? `Puppy #${puppyId}` : "") ||
          "",
        noticeKind: text(row.notice_kind) || "notice",
        recipientEmail: text(row.recipient_email),
        subject: text(row.subject),
        status: text(row.status) || "sent",
        providerMessageId: text(row.provider_message_id) || null,
        lastEventType: text(row.last_event_type) || null,
        lastEventAt: row.last_event_at || null,
        deliveredAt: row.delivered_at || null,
        openedAt: row.opened_at || null,
        clickedAt: row.clicked_at || null,
        openCount: Number(row.open_count || 0),
        clickCount: Number(row.click_count || 0),
        createdAt: row.created_at || null,
      };
    }),
    trackingColumnsReady,
    warning: trackingColumnsReady
      ? ""
      : `Email activity tracking columns are not installed yet. Apply ${NOTICE_TRACKING_MIGRATION_PATH} to capture open and delivery events.`,
  };
}

export async function GET(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const service = createServiceSupabase();
    const webhookConfigured = Boolean(
      text(process.env.RESEND_WEBHOOK_SECRET) || text(process.env.RESEND_WEBHOOK_SIGNING_SECRET)
    );

    const result = await service
      .from("admin_message_templates")
      .select(
        "id,template_key,category,label,description,channel,provider,subject,body,automation_enabled,is_active,preview_payload,updated_at"
      )
      .order("category", { ascending: true })
      .order("label", { ascending: true });

    if (result.error) {
      if (isMissingTableError(result.error)) {
        return NextResponse.json(
          {
            ok: true,
            templates: [],
            recentActivity: [],
            missingStorage: true,
            webhookConfigured,
            warning: `Template storage is not installed yet. Apply ${TEMPLATE_MIGRATION_PATH} to enable admin_message_templates.`,
          },
          { headers: NO_STORE_HEADERS }
        );
      }
      throw result.error;
    }

    const activity = await loadRecentActivity(service);
    const warnings = [activity.warning];
    if (!webhookConfigured) {
      warnings.push("Add RESEND_WEBHOOK_SECRET to capture open, click, bounce, and delivery events.");
    }

    return NextResponse.json(
      {
        ok: true,
        templates: (result.data || []).map(toTemplate),
        recentActivity: activity.recentActivity,
        missingStorage: false,
        webhookConfigured,
        warning: warnings.filter(Boolean).join(" "),
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not load the message templates."),
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
    const templateKey = text(body.templateKey);
    const label = text(body.label);

    if (!templateKey || !label) {
      return NextResponse.json(
        { ok: false, error: "A template key and label are required." },
        { status: 400 }
      );
    }

    const service = createServiceSupabase();
    const result = await service.from("admin_message_templates").upsert(
      {
        id: intValue(body.id) ?? undefined,
        template_key: templateKey,
        category: text(body.category) || "custom",
        label,
        description: text(body.description) || null,
        channel: text(body.channel) || "email",
        provider: text(body.provider) || "resend",
        subject: text(body.subject),
        body: text(body.body),
        automation_enabled: bool(body.automationEnabled, true),
        is_active: bool(body.isActive, true),
        preview_payload: jsonObject(body.previewPayload),
        updated_by_email: owner.email || null,
      },
      { onConflict: "template_key" }
    );

    if (result.error) {
      if (isMissingTableError(result.error)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Template storage is not installed yet. Apply ${TEMPLATE_MIGRATION_PATH} to enable admin_message_templates.`,
          },
          { status: 409 }
        );
      }
      throw result.error;
    }

    return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not save the message template."),
      },
      { status: 500 }
    );
  }
}
