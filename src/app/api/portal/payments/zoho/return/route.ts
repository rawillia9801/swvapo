import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/portal-api";
import {
  describePortalCharge,
  parsePortalChargeReference,
  paymentTypeForPortalCharge,
} from "@/lib/portal-payment-options";
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
    const buyerResult = await admin
      .from("buyers")
      .select("id,user_id,full_name,name,email,deposit_amount,deposit_date,finance_last_payment_date")
      .eq("id", parsedReference.buyerId)
      .limit(1)
      .maybeSingle<{
        id: number;
        user_id?: string | null;
        full_name?: string | null;
        name?: string | null;
        email?: string | null;
        deposit_amount?: number | null;
        deposit_date?: string | null;
        finance_last_payment_date?: string | null;
      }>();

    if (buyerResult.error || !buyerResult.data) {
      throw new Error("Buyer account not found for Zoho payment return.");
    }

    const puppyResult = parsedReference.puppyId
      ? await admin
          .from("puppies")
          .select("id,call_name,puppy_name,name")
          .eq("id", parsedReference.puppyId)
          .limit(1)
          .maybeSingle<{ id: number; call_name?: string | null; puppy_name?: string | null; name?: string | null }>()
      : { data: null, error: null };

    if (puppyResult.error) {
      throw new Error(puppyResult.error.message);
    }

    const existingPayment = await admin
      .from("buyer_payments")
      .select("id")
      .eq("reference_number", paymentId || "")
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (existingPayment.error) {
      throw new Error(existingPayment.error.message);
    }

    const today = new Date().toISOString().slice(0, 10);
    const puppyName =
      puppyResult.data?.call_name ||
      puppyResult.data?.puppy_name ||
      puppyResult.data?.name ||
      "your puppy";

    if (!existingPayment.data) {
      const insertResult = await admin.from("buyer_payments").insert({
        buyer_id: buyerResult.data.id,
        puppy_id: parsedReference.puppyId,
        user_id: buyerResult.data.user_id || null,
        payment_date: today,
        amount: Number(amount || 0),
        payment_type: paymentTypeForPortalCharge(parsedReference.chargeKind),
        method: "Zoho Payments",
        note: `${describePortalCharge(parsedReference.chargeKind, puppyName)} via Zoho payment link ${paymentLinkId || ""}`.trim(),
        status: "recorded",
        reference_number: paymentId || null,
      });

      if (insertResult.error) {
        throw new Error(insertResult.error.message);
      }
    }

    if (parsedReference.chargeKind === "deposit") {
      const updateResult = await admin
        .from("buyers")
        .update({
          deposit_amount:
            buyerResult.data.deposit_amount && Number(buyerResult.data.deposit_amount) > 0
              ? buyerResult.data.deposit_amount
              : Number(amount || 0),
          deposit_date: buyerResult.data.deposit_date || today,
        })
        .eq("id", buyerResult.data.id);

      if (updateResult.error) {
        throw new Error(updateResult.error.message);
      }
    }

    if (parsedReference.chargeKind === "installment") {
      const updateResult = await admin
        .from("buyers")
        .update({
          finance_last_payment_date: today,
        })
        .eq("id", buyerResult.data.id);

      if (updateResult.error) {
        throw new Error(updateResult.error.message);
      }
    }

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
