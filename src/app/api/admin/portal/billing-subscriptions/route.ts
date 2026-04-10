import { NextResponse } from "next/server";
import { createServiceSupabase, verifyOwner } from "@/lib/admin-api";
import {
  createBuyerBillingPaymentMethodCheckout,
  createBuyerBillingSubscriptionCheckout,
  loadBuyerBillingSubscription,
  refreshBuyerBillingSubscription,
  serializeBuyerBillingSubscription,
} from "@/lib/portal-zoho-billing";

export const runtime = "nodejs";

type BillingAction =
  | "start_checkout"
  | "update_payment_method"
  | "update_card"
  | "refresh";

function errorJson(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function readNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

export async function GET(req: Request) {
  const owner = await verifyOwner(req);
  if (!owner) {
    return errorJson("Unauthorized", 401);
  }

  try {
    const url = new URL(req.url);
    const buyerId = readNumber(url.searchParams.get("buyer_id"));
    const puppyId = readNumber(url.searchParams.get("puppy_id")) || null;

    if (!buyerId) {
      return errorJson("A buyer_id is required.");
    }

    const admin = createServiceSupabase();
    const record = await loadBuyerBillingSubscription(admin, {
      buyerId,
      puppyId,
    });

    return NextResponse.json({
      ok: true,
      subscription: serializeBuyerBillingSubscription(record),
    });
  } catch (error) {
    console.error("Billing subscription lookup error:", error);
    return errorJson(error instanceof Error ? error.message : "Could not load the billing subscription.", 500);
  }
}

export async function POST(req: Request) {
  const owner = await verifyOwner(req);
  if (!owner) {
    return errorJson("Unauthorized", 401);
  }

  try {
    const body = (await req.json()) as {
      action?: BillingAction | null;
      buyer_id?: number | null;
      puppy_id?: number | null;
    };

    const buyerId = readNumber(body.buyer_id);
    const puppyId = readNumber(body.puppy_id) || null;
    const action = String(body.action || "").trim().toLowerCase() as BillingAction;

    if (!buyerId) {
      return errorJson("A buyer_id is required.");
    }

    if (!["start_checkout", "update_payment_method", "update_card", "refresh"].includes(action)) {
      return errorJson("Choose a valid billing subscription action.");
    }

    const admin = createServiceSupabase();

    if (action === "start_checkout") {
      const checkout = await createBuyerBillingSubscriptionCheckout({
        admin,
        buyerId,
        puppyId,
        requestUrl: req.url,
      });

      return NextResponse.json({
        ok: true,
        action,
        url: checkout.url,
        hostedPageId: checkout.hostedPageId,
        reusedExisting: checkout.reusedExisting,
        subscription: serializeBuyerBillingSubscription(checkout.record),
      });
    }

    if (action === "update_payment_method" || action === "update_card") {
      const checkout = await createBuyerBillingPaymentMethodCheckout({
        admin,
        buyerId,
        puppyId,
        requestUrl: req.url,
      });

      return NextResponse.json({
        ok: true,
        action,
        url: checkout.url,
        hostedPageId: checkout.hostedPageId,
        subscription: serializeBuyerBillingSubscription(checkout.record),
      });
    }

    const record = await refreshBuyerBillingSubscription({
      admin,
      buyerId,
      puppyId,
    });

    return NextResponse.json({
      ok: true,
      action,
      subscription: serializeBuyerBillingSubscription(record),
    });
  } catch (error) {
    console.error("Billing subscription action error:", error);
    return errorJson(
      error instanceof Error ? error.message : "Could not complete the billing subscription action.",
      500
    );
  }
}
