import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  extractZohoSignWebhookEventType,
  extractZohoSignWebhookRequestId,
  verifyZohoSignWebhookSignature,
} from "@/lib/zoho-document-workflow";
import { syncChiChiDocumentPackageFromZohoSignWebhook } from "@/lib/chichi-document-orchestration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WebhookPayload = Record<string, unknown> | null;

function requiredEnv(...names: string[]) {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) return value;
  }

  throw new Error(`Missing required environment variable. Checked: ${names.join(", ")}`);
}

function getOrigin(request: NextRequest) {
  const explicit =
    String(process.env.NEXT_PUBLIC_SITE_URL || "").trim() ||
    String(process.env.NEXT_PUBLIC_APP_URL || "").trim();

  if (explicit) return explicit.replace(/\/+$/g, "");

  const vercelUrl = String(process.env.VERCEL_URL || "").trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/\/+$/g, "")}`;

  return request.nextUrl.origin.replace(/\/+$/g, "");
}

function parsePayload(rawBody: string): WebhookPayload {
  const text = String(rawBody || "").trim();
  if (!text) return null;

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function createSupabaseAdminClient() {
  const supabaseUrl = requiredEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL"
  );

  const serviceRoleKey = requiredEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY"
  );

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function GET(request: NextRequest) {
  const origin = getOrigin(request);

  return NextResponse.json(
    {
      ok: true,
      message: "Zoho Sign webhook route is live.",
      endpoint: `${origin}/api/integrations/zoho/sign/webhook`,
      checks: {
        hasSupabaseUrl: Boolean(
          String(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim()
        ),
        hasServiceRoleKey: Boolean(
          String(
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ""
          ).trim()
        ),
        hasWebhookSecret: Boolean(
          String(process.env.ZOHO_SIGN_WEBHOOK_SECRET || "").trim()
        ),
      },
      expectedMethod: "POST",
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}

export async function POST(request: NextRequest) {
  const origin = getOrigin(request);
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-zs-webhook-signature");

  const signatureValid = verifyZohoSignWebhookSignature({
    rawBody,
    signatureHeader,
  });

  if (!signatureValid) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid Zoho Sign webhook signature.",
      },
      {
        status: 401,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  const payload = parsePayload(rawBody);
  if (!payload) {
    return NextResponse.json(
      {
        ok: false,
        message: "Webhook body was not valid JSON.",
      },
      {
        status: 400,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  const requestId = extractZohoSignWebhookRequestId(payload);
  const eventType = extractZohoSignWebhookEventType(payload);

  if (!requestId) {
    return NextResponse.json(
      {
        ok: true,
        handled: false,
        reason: "missing_request_id",
        eventType: eventType || null,
      },
      {
        status: 202,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }

  try {
    const admin = createSupabaseAdminClient();

    const result = await syncChiChiDocumentPackageFromZohoSignWebhook(admin, {
      requestId,
      eventType,
      origin,
    });

    return NextResponse.json(
      {
        ok: true,
        requestId,
        eventType: eventType || null,
        result,
      },
      {
        status: 200,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Zoho Sign webhook error";

    return NextResponse.json(
      {
        ok: false,
        requestId,
        eventType: eventType || null,
        message,
      },
      {
        status: 500,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }
}