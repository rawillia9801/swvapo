import { NextResponse } from "next/server";
import { createServiceSupabase, verifyPortalUser } from "@/lib/portal-api";
import { loadPortalZohoPaymentState } from "@/lib/portal-zoho-payments";
import {
  createBuyerBillingPaymentMethodCheckout,
  loadBuyerBillingSubscription,
  serializeBuyerBillingSubscription,
} from "@/lib/portal-zoho-billing";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function GET(req: Request) {
  try {
    const { user } = await verifyPortalUser(req);
    if (!user) {
      return jsonError("Please sign in again before checking your puppy payment plan.", 401);
    }

    const admin = createServiceSupabase();
    const state = await loadPortalZohoPaymentState(admin, user);

    if (!state.buyer?.id) {
      return NextResponse.json({
        ok: true,
        subscription: null,
      });
    }

    const subscription = await loadBuyerBillingSubscription(admin, {
      buyerId: state.buyer.id,
      puppyId: state.puppy?.id ?? null,
    });

    return NextResponse.json({
      ok: true,
      subscription: serializeBuyerBillingSubscription(subscription),
    });
  } catch (error) {
    console.error("Portal billing subscription lookup error:", error);
    return jsonError(
      error instanceof Error ? error.message : "Could not load the puppy payment plan.",
      500
    );
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await verifyPortalUser(req);
    if (!user) {
      return jsonError("Please sign in again before updating your saved payment method.", 401);
    }

    const admin = createServiceSupabase();
    const state = await loadPortalZohoPaymentState(admin, user);

    if (!state.buyer?.id) {
      return jsonError("We could not find a buyer account linked to this portal login.", 404);
    }

    const checkout = await createBuyerBillingPaymentMethodCheckout({
      admin,
      buyerId: state.buyer.id,
      puppyId: state.puppy?.id ?? null,
      requestUrl: req.url,
    });

    return NextResponse.json({
      ok: true,
      url: checkout.url,
      hostedPageId: checkout.hostedPageId,
      subscription: serializeBuyerBillingSubscription(checkout.record),
    });
  } catch (error) {
    console.error("Portal billing payment-method error:", error);
    return jsonError(
      error instanceof Error ? error.message : "Could not open the secure payment-method update page.",
      500
    );
  }
}
