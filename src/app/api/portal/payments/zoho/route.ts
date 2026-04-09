import { NextResponse } from "next/server";
import { createServiceSupabase, verifyPortalUser } from "@/lib/portal-api";
import { isZohoPaymentsConfigured } from "@/lib/zoho-payments";
import { createPortalZohoPaymentLink } from "@/lib/portal-zoho-payments";
import type { PortalChargeKind } from "@/lib/portal-payment-options";

export const runtime = "nodejs";

type PortalZohoBody = {
  charge_kind?: PortalChargeKind | null;
  amount?: number | null;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(req: Request) {
  try {
    const { user } = await verifyPortalUser(req);

    if (!user) {
      return jsonError("Please sign in again before creating a payment link.", 401);
    }

    if (!(await isZohoPaymentsConfigured())) {
      return jsonError(
        "Secure Zoho payments are not configured yet. Please contact us if you need help completing a payment.",
        503
      );
    }

    const body = (await req.json()) as PortalZohoBody;
    const chargeKind = String(body.charge_kind || "").trim().toLowerCase() as PortalChargeKind;

    if (!["deposit", "installment", "transportation", "general"].includes(chargeKind)) {
      return jsonError("Please choose a valid payment type.");
    }

    const admin = createServiceSupabase();
    const paymentLink = await createPortalZohoPaymentLink({
      admin,
      user,
      requestUrl: req.url,
      chargeKind,
      requestedAmount: body.amount ?? null,
    });

    return NextResponse.json({
      ok: true,
      chargeKind,
      amount: paymentLink.amount,
      url: paymentLink.url,
      paymentLinkId: paymentLink.paymentLinkId,
      description: paymentLink.description,
      referenceId: paymentLink.referenceId,
      finalBalanceDueNow: paymentLink.snapshot.finalBalanceDueNow,
    });
  } catch (error) {
    console.error("Portal Zoho payment link error:", error);
    return jsonError(
      error instanceof Error ? error.message : "Could not create the payment link right now.",
      500
    );
  }
}
