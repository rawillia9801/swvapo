import { NextResponse } from "next/server";
import {
  createServiceSupabase,
  describeRouteError,
  verifyOwner,
} from "@/lib/admin-api";
import {
  loadBuyerPaymentNoticeSettings,
  parsePaymentNoticeCcEmails,
  sendManualBuyerPaymentNotice,
  upsertBuyerPaymentNoticeSettings,
} from "@/lib/payment-email";

export const runtime = "nodejs";

function parseBuyerId(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function isMissingTableError(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error || "")).toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("schema cache")
  );
}

export async function GET(req: Request) {
  const owner = await verifyOwner(req);
  if (!owner) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const buyerId = parseBuyerId(url.searchParams.get("buyer_id"));
    if (!buyerId) {
      return NextResponse.json({ ok: false, error: "A buyer id is required." }, { status: 400 });
    }

    const admin = createServiceSupabase();
    const [settings, logResult] = await Promise.all([
      loadBuyerPaymentNoticeSettings(admin, buyerId),
      admin
        .from("buyer_payment_notice_logs")
        .select(
          "id,created_at,buyer_id,puppy_id,payment_id,notice_kind,notice_key,notice_date,due_date,status,recipient_email,subject,provider,provider_message_id,meta"
        )
        .eq("buyer_id", buyerId)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    if (logResult.error) {
      if (isMissingTableError(logResult.error)) {
        return NextResponse.json({ ok: true, settings, logs: [] });
      }
      throw new Error(logResult.error.message);
    }

    return NextResponse.json({
      ok: true,
      settings,
      logs: logResult.data || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not load payment notice settings."),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  const owner = await verifyOwner(req);
  if (!owner) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const buyerId = parseBuyerId(body.buyer_id);
    if (!buyerId) {
      return NextResponse.json({ ok: false, error: "A buyer id is required." }, { status: 400 });
    }

    const admin = createServiceSupabase();
    const settings = await upsertBuyerPaymentNoticeSettings(admin, {
      buyerId,
      enabled: Boolean(body.enabled),
      receiptEnabled: Boolean(body.receipt_enabled),
      dueReminderEnabled: Boolean(body.due_reminder_enabled),
      dueReminderDaysBefore: clampInteger(body.due_reminder_days_before, 0, 30, 5),
      lateNoticeEnabled: Boolean(body.late_notice_enabled),
      lateNoticeDaysAfter: clampInteger(body.late_notice_days_after, 1, 60, 3),
      defaultNoticeEnabled: Boolean(body.default_notice_enabled),
      defaultNoticeDaysAfter: clampInteger(body.default_notice_days_after, 1, 120, 14),
      recipientEmail: String(body.recipient_email || "").trim() || null,
      ccEmails: parsePaymentNoticeCcEmails(String(body.cc_emails || "")),
      internalNote: String(body.internal_note || "").trim() || null,
    });

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not save payment notice settings."),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const owner = await verifyOwner(req);
  if (!owner) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const buyerId = parseBuyerId(body.buyer_id);
    const kind = String(body.kind || "").trim().toLowerCase();

    if (!buyerId || !["due_reminder", "late_notice", "default_notice"].includes(kind)) {
      return NextResponse.json(
        { ok: false, error: "A buyer id and valid notice kind are required." },
        { status: 400 }
      );
    }

    const admin = createServiceSupabase();
    const result = await sendManualBuyerPaymentNotice(admin, {
      buyerId,
      kind: kind as "due_reminder" | "late_notice" | "default_notice",
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not send the payment notice."),
      },
      { status: 500 }
    );
  }
}
