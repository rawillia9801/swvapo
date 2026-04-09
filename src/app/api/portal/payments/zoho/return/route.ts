import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/portal-api";
import { parsePortalChargeReference } from "@/lib/portal-payment-options";
import { syncPortalZohoPayment } from "@/lib/portal-zoho-payments";
import { verifyZohoPaymentLinkSignature } from "@/lib/zoho-payments";

export const runtime = "nodejs";

function paymentRedirectUrl(req: Request, params: Record<string, string>) {
  const url = new URL("/portal/payments", req.url);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url;
}

function normalizeSuccessStatus(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["paid", "succeeded", "success", "completed"].includes(normalized);
}

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const paymentLinkId = requestUrl.searchParams.get("payment_link_id");
  const paymentId = requestUrl.searchParams.get("payment_id");
  const amount = requestUrl.searchParams.get("amount");
  const status = requestUrl.searchParams.get("status");
  const reference =
    requestUrl.searchParams.get("payment_link_reference") ||
    requestUrl.searchParams.get("reference_id");
  const signature = requestUrl.searchParams.get("signature");

  try {
    const verified = verifyZohoPaymentLinkSignature({
      paymentLinkId,
      paymentId,
      amount,
      status,
      paymentLinkReference: reference,
      signature,
    });

    if (!verified) {
      return NextResponse.redirect(
        paymentRedirectUrl(req, {
          zoho_payment: "invalid_signature",
        })
      );
    }

    const parsedReference = parsePortalChargeReference(reference);
    if (!parsedReference) {
      return NextResponse.redirect(
        paymentRedirectUrl(req, {
          zoho_payment: "invalid_reference",
        })
      );
    }

    if (!normalizeSuccessStatus(status)) {
      return NextResponse.redirect(
        paymentRedirectUrl(req, {
          zoho_payment: "not_completed",
          charge: parsedReference.chargeKind,
        })
      );
    }

    const admin = createServiceSupabase();
    await syncPortalZohoPayment({
      admin,
      source: "return",
      paymentLinkId,
      paymentId,
      amount,
      status,
      paymentLinkReference: reference,
      emitAlert: false,
    });

    return NextResponse.redirect(
      paymentRedirectUrl(req, {
        zoho_payment: "success",
        charge: parsedReference.chargeKind,
        payment_id: paymentId || "",
      })
    );
  } catch (error) {
    console.error("Portal Zoho payment return error:", error);
    return NextResponse.redirect(
      paymentRedirectUrl(req, {
        zoho_payment: "error",
      })
    );
  }
}
