import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/admin-api";
import { syncChiChiDocumentPackageFromZohoSignWebhook } from "@/lib/chichi-document-orchestration";
import {
  extractZohoSignWebhookEventType,
  extractZohoSignWebhookRequestId,
  verifyZohoSignWebhookSignature,
} from "@/lib/zoho-document-workflow";

export const runtime = "nodejs";

function signatureHeader(req: Request) {
  return (
    req.headers.get("x-zs-webhook-signature") ||
    req.headers.get("X-ZS-WEBHOOK-SIGNATURE") ||
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
    const payload = params.get("payload");
    if (payload) {
      try {
        return JSON.parse(payload) as Record<string, unknown>;
      } catch {
        return Object.fromEntries(params.entries());
      }
    }
    return Object.fromEntries(params.entries());
  }

  return null;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: "zoho_sign",
    endpoint: "webhook",
    message:
      "Zoho Sign webhook endpoint is live. Completed signature events sent here can be filed back into portal and admin documents.",
    method: "POST",
  });
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    if (
      !verifyZohoSignWebhookSignature({
        rawBody,
        signatureHeader: signatureHeader(req),
      })
    ) {
      return NextResponse.json(
        { ok: false, message: "Invalid webhook signature." },
        { status: 401 }
      );
    }

    const parsed = parseBody(rawBody, req.headers.get("content-type"));
    const requestId =
      extractZohoSignWebhookRequestId(parsed) ||
      new URL(req.url).searchParams.get("request_id") ||
      "";
    const eventType =
      extractZohoSignWebhookEventType(parsed) ||
      new URL(req.url).searchParams.get("event_type") ||
      "";

    const admin = createServiceSupabase();
    const result = await syncChiChiDocumentPackageFromZohoSignWebhook(admin, {
      requestId,
      eventType,
      origin: new URL(req.url).origin,
    });

    return NextResponse.json({
      ok: true,
      handled: result.handled,
      reason: "reason" in result ? result.reason : null,
      package_key: "packageKey" in result ? result.packageKey : null,
      package_id: "packageId" in result ? result.packageId : null,
      status: "status" in result ? result.status : null,
      filed: "filed" in result ? result.filed : false,
    });
  } catch (error) {
    console.error("Zoho Sign webhook error:", error);
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Webhook processing failed.",
      },
      { status: 500 }
    );
  }
}
