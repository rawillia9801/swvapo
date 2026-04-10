import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/admin-api";
import { retrieveZohoBillingEvent, verifyZohoBillingWebhookSignature } from "@/lib/zoho-billing";
import { syncZohoBillingEvent } from "@/lib/portal-zoho-billing";

export const runtime = "nodejs";

function signatureHeader(req: Request) {
  return (
    req.headers.get("x-zoho-webhook-signature") ||
    req.headers.get("X-Zoho-Webhook-Signature") ||
    ""
  );
}

function parseBody(rawBody: string, contentType: string | null | undefined) {
  const normalizedContentType = String(contentType || "").toLowerCase();
  const trimmed = rawBody.trim();

  if (!trimmed) return null;

  if (
    normalizedContentType.includes("application/json") ||
    normalizedContentType.includes("text/json") ||
    /^[\[{]/.test(trimmed)
  ) {
    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  if (normalizedContentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(trimmed);
    return Object.fromEntries(params.entries());
  }

  return null;
}

function firstString(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: "zoho_billing",
    endpoint: "webhook",
    message: "Zoho Billing webhook endpoint is live. Send secured webhooks from Zoho Billing to this URL.",
    method: "POST",
  });
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const contentType = req.headers.get("content-type");

    if (
      !verifyZohoBillingWebhookSignature({
        url: req.url,
        rawBody,
        contentType,
        signature: signatureHeader(req),
      })
    ) {
      return NextResponse.json({ ok: false, message: "Invalid webhook signature." }, { status: 401 });
    }

    const parsedBody = parseBody(rawBody, contentType) || {};
    const eventId = firstString(
      String(parsedBody.event_id || ""),
      new URL(req.url).searchParams.get("event_id") || ""
    );
    const eventType = firstString(
      String(parsedBody.event_type || ""),
      new URL(req.url).searchParams.get("event_type") || ""
    );

    const event = eventId ? await retrieveZohoBillingEvent(eventId) : null;
    const admin = createServiceSupabase();
    const syncResult = await syncZohoBillingEvent({
      admin,
      eventId: firstString(event?.event_id, eventId),
      eventType: firstString(event?.event_type, eventType),
      eventTime: firstString(event?.event_time),
      payload:
        firstString(event?.payload) ||
        (parsedBody.payload as string | undefined) ||
        (Object.keys(parsedBody).length ? parsedBody : rawBody),
      rawPayload: event
        ? ({
            event_id: event.event_id,
            event_type: event.event_type,
            event_time: event.event_time,
            payload: event.payload,
          } as Record<string, unknown>)
        : Object.keys(parsedBody).length
          ? parsedBody
          : null,
    });

    return NextResponse.json({
      ok: true,
      handled: syncResult.handled,
      event_type: syncResult.eventType,
    });
  } catch (error) {
    console.error("Zoho Billing webhook error:", error);
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Webhook processing failed.",
      },
      { status: 500 }
    );
  }
}
