import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase, describeRouteError } from "@/lib/admin-api";
import { getResendClient } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NoticeLogRow = {
  id: number;
  meta?: Record<string, unknown> | null;
  open_count?: number | null;
  click_count?: number | null;
};

function text(value: unknown) {
  return String(value || "").trim();
}

function readWebhookSecret() {
  return (
    text(process.env.RESEND_WEBHOOK_SECRET) ||
    text(process.env.RESEND_WEBHOOK_SIGNING_SECRET)
  );
}

function isSchemaError(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error || "")).toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("column") ||
    message.includes("schema cache") ||
    message.includes("could not find the table")
  );
}

function currentOrigin(request: NextRequest) {
  const explicit =
    text(process.env.NEXT_PUBLIC_SITE_URL) || text(process.env.NEXT_PUBLIC_APP_URL);
  if (explicit) return explicit.replace(/\/+$/g, "");

  const vercelUrl = text(process.env.VERCEL_URL);
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/g, "")}`;

  return request.nextUrl.origin.replace(/\/+$/g, "");
}

function eventTimestamp(event: { created_at?: string; data?: Record<string, unknown> }) {
  return text(event.created_at) || text(event.data?.created_at) || new Date().toISOString();
}

function statusForEvent(type: string) {
  const normalized = text(type).toLowerCase();
  if (normalized === "email.delivered") return "delivered";
  if (normalized === "email.opened") return "opened";
  if (normalized === "email.clicked") return "clicked";
  if (normalized === "email.bounced") return "bounced";
  if (normalized === "email.complained") return "complained";
  if (normalized === "email.delivery_delayed") return "delivery_delayed";
  if (normalized === "email.failed") return "failed";
  if (normalized === "email.suppressed") return "suppressed";
  if (normalized === "email.sent") return "sent";
  return normalized || "processed";
}

function buildTrackedUpdate(input: {
  existing: NoticeLogRow;
  verified: {
    type?: string;
    created_at?: string;
    data?: Record<string, unknown>;
  };
}) {
  const type = text(input.verified.type);
  const occurredAt = eventTimestamp(input.verified);
  const meta = {
    ...(input.existing.meta || {}),
    resend_last_event: {
      type,
      occurred_at: occurredAt,
      payload: input.verified.data || {},
    },
  };

  return {
    status: statusForEvent(type),
    last_event_type: type || null,
    last_event_at: occurredAt,
    delivered_at:
      type === "email.delivered" ? occurredAt : undefined,
    opened_at: type === "email.opened" ? occurredAt : undefined,
    clicked_at: type === "email.clicked" ? occurredAt : undefined,
    bounced_at: type === "email.bounced" ? occurredAt : undefined,
    complained_at: type === "email.complained" ? occurredAt : undefined,
    failed_at: type === "email.failed" ? occurredAt : undefined,
    suppressed_at: type === "email.suppressed" ? occurredAt : undefined,
    delivery_delayed_at:
      type === "email.delivery_delayed" ? occurredAt : undefined,
    open_count:
      type === "email.opened"
        ? Number(input.existing.open_count || 0) + 1
        : Number(input.existing.open_count || 0),
    click_count:
      type === "email.clicked"
        ? Number(input.existing.click_count || 0) + 1
        : Number(input.existing.click_count || 0),
    meta,
  };
}

function buildFallbackUpdate(input: {
  existing: NoticeLogRow;
  verified: {
    type?: string;
    created_at?: string;
    data?: Record<string, unknown>;
  };
}) {
  const type = text(input.verified.type);
  return {
    status: statusForEvent(type),
    meta: {
      ...(input.existing.meta || {}),
      resend_last_event: {
        type,
        occurred_at: eventTimestamp(input.verified),
        payload: input.verified.data || {},
      },
    },
  };
}

export async function GET(request: NextRequest) {
  const origin = currentOrigin(request);
  return NextResponse.json({
    ok: true,
    endpoint: `${origin}/api/resend/webhook`,
    webhookConfigured: Boolean(readWebhookSecret()),
    message: "Resend webhook route is live.",
  });
}

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = readWebhookSecret();
    if (!webhookSecret) {
      return NextResponse.json(
        { ok: false, error: "Missing RESEND_WEBHOOK_SECRET." },
        { status: 503 }
      );
    }

    const rawBody = await request.text();
    const resend = getResendClient();
    const signatureHeaders = {
      id: text(request.headers.get("svix-id")),
      timestamp: text(request.headers.get("svix-timestamp")),
      signature: text(request.headers.get("svix-signature")),
    };
    const verified = resend.webhooks.verify({
      payload: rawBody,
      headers: signatureHeaders,
      webhookSecret,
    }) as unknown as {
      type?: string;
      created_at?: string;
      data?: Record<string, unknown>;
    };

    const providerMessageId = text(verified.data?.email_id);
    if (!providerMessageId) {
      return NextResponse.json({ ok: true, ignored: true, reason: "No email id in webhook payload." });
    }

    const service = createServiceSupabase();
    const existingResult = await service
      .from("buyer_payment_notice_logs")
      .select("id,meta,open_count,click_count")
      .eq("provider_message_id", providerMessageId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<NoticeLogRow>();

    if (existingResult.error) {
      if (isSchemaError(existingResult.error)) {
        return NextResponse.json({ ok: true, ignored: true, reason: "Notice log schema is not ready." });
      }
      throw existingResult.error;
    }

    if (!existingResult.data) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: `No notice log matched provider message id ${providerMessageId}.`,
      });
    }

    const trackedUpdate = buildTrackedUpdate({
      existing: existingResult.data,
      verified,
    });

    const trackedResult = await service
      .from("buyer_payment_notice_logs")
      .update(trackedUpdate)
      .eq("id", existingResult.data.id);

    if (trackedResult.error) {
      if (!isSchemaError(trackedResult.error)) {
        throw trackedResult.error;
      }

      const fallbackResult = await service
        .from("buyer_payment_notice_logs")
        .update(
          buildFallbackUpdate({
            existing: existingResult.data,
            verified,
          })
        )
        .eq("id", existingResult.data.id);

      if (fallbackResult.error) throw fallbackResult.error;
    }

    return NextResponse.json({
      ok: true,
      providerMessageId,
      eventType: text(verified.type),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not process the Resend webhook."),
      },
      { status: 500 }
    );
  }
}
