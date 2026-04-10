import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/admin-api";
import { sendScheduledBuyerPaymentNoticeEmails } from "@/lib/payment-email";

export const runtime = "nodejs";

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createServiceSupabase();
    const summary = await sendScheduledBuyerPaymentNoticeEmails(admin);
    return NextResponse.json({
      ok: true,
      summary,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Payment plan notice cron error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown cron error",
      },
      { status: 500 }
    );
  }
}
