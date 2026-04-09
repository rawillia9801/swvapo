import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/admin-api";
import { syncPortalZohoPayment } from "@/lib/portal-zoho-payments";
import { verifyZohoWebhookSignature } from "@/lib/zoho-payments";

export const runtime = "nodejs";

type ZohoWebhookPayload = {
  event_id?: string | number | null;
  event_type?: string | null;
  event_time?: string | number | null;
  event_object?: {
    payment_links?: {
      payment_link_id?: string | null;
      reference_id?: string | null;
      amount?: string | null;
      amount_paid?: string | null;
      currency?: string | null;
      description?: string | null;
      email?: string | null;
      phone?: string | null;
      status?: string | null;
      payments?: Array<{
        payment_id?: string | null;
        amount?: string | null;
        status?: string | null;
        date?: string | number | null;
      }> | null;
    } | null;
    payment?: {
      payment_id?: string | null;
      amount?: string | null;
      currency?: string | null;
      description?: string | null;
      receipt_email?: string | null;
      customer_email?: string | null;
      customer_name?: string | null;
      reference_number?: string | null;
      status?: string | null;
      date?: string | number | null;
      payment_method?: {
        type?: string | null;
      } | null;
    } | null;
  } | null;
};

function eventId(value: string | number | null | undefined) {
  const text = String(value || "").trim();
  return text || null;
}

function signatureHeader(req: Request) {
  return (
    req.headers.get("x-zoho-webhook-signature") ||
    req.headers.get("X-Zoho-Webhook-Signature") ||
    ""
  );
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    if (
      !verifyZohoWebhookSignature({
        rawBody,
        signatureHeader: signatureHeader(req),
      })
    ) {
      return NextResponse.json({ ok: false, message: "Invalid webhook signature." }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as ZohoWebhookPayload;
    const type = String(payload.event_type || "").trim().toLowerCase();
    const admin = createServiceSupabase();

    if (type.startsWith("payment_link.")) {
      const paymentLink = payload.event_object?.payment_links;
      const latestPayment = paymentLink?.payments?.[0] || null;
      const referenceId = String(paymentLink?.reference_id || "").trim();

      if (referenceId) {
        await syncPortalZohoPayment({
          admin,
          source: "webhook",
          eventId: eventId(payload.event_id),
          eventType: type,
          paymentLinkId: paymentLink?.payment_link_id || null,
          paymentId: latestPayment?.payment_id || null,
          amount: latestPayment?.amount || paymentLink?.amount_paid || paymentLink?.amount || null,
          status: latestPayment?.status || paymentLink?.status || null,
          paymentLinkReference: referenceId,
          paymentDate: latestPayment?.date || payload.event_time || null,
          currency: paymentLink?.currency || "USD",
          customerEmail: paymentLink?.email || null,
          description: paymentLink?.description || null,
          emitAlert: true,
          rawPayload: payload as unknown as Record<string, unknown>,
        });

        return NextResponse.json({ ok: true, handled: true });
      }

      return NextResponse.json({ ok: true, handled: false, reason: "No portal reference id." });
    }

    if (type.startsWith("payment.")) {
      const payment = payload.event_object?.payment;
      const referenceId = String(payment?.reference_number || "").trim();

      if (referenceId) {
        await syncPortalZohoPayment({
          admin,
          source: "webhook",
          eventId: eventId(payload.event_id),
          eventType: type,
          paymentId: payment?.payment_id || null,
          amount: payment?.amount || null,
          status: payment?.status || null,
          paymentLinkReference: referenceId,
          paymentDate: payment?.date || payload.event_time || null,
          currency: payment?.currency || "USD",
          customerEmail: payment?.receipt_email || payment?.customer_email || null,
          customerName: payment?.customer_name || null,
          paymentMethod: payment?.payment_method?.type || null,
          description: payment?.description || null,
          emitAlert: true,
          rawPayload: payload as unknown as Record<string, unknown>,
        });

        return NextResponse.json({ ok: true, handled: true });
      }
    }

    return NextResponse.json({ ok: true, handled: false });
  } catch (error) {
    console.error("Zoho webhook error:", error);
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Webhook processing failed.",
      },
      { status: 500 }
    );
  }
}
