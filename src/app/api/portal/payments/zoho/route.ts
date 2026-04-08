import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  createServiceSupabase,
  verifyPortalUser,
} from "@/lib/portal-api";
import {
  buildPortalChargeReference,
  buildPortalPaymentChargeSnapshot,
  describePortalCharge,
  type PortalChargeKind,
} from "@/lib/portal-payment-options";
import type {
  PortalBuyer,
  PortalFeeCreditRecord,
  PortalPayment,
  PortalPickupRequest,
  PortalPuppy,
} from "@/lib/portal-data";
import { createZohoPaymentLink, isZohoPaymentsConfigured } from "@/lib/zoho-payments";

export const runtime = "nodejs";

type PortalZohoBody = {
  charge_kind?: PortalChargeKind | null;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function normalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

async function loadBuyerForUser(admin: SupabaseClient, user: User) {
  const email = normalizeEmail(user.email);

  const byUserId = await admin
    .from("buyers")
    .select(
      "id,user_id,puppy_id,full_name,name,email,phone,sale_price,deposit_amount,deposit_date,finance_enabled,finance_admin_fee,finance_rate,finance_months,finance_monthly_amount,finance_day_of_month,finance_next_due_date,finance_last_payment_date,delivery_fee,delivery_option,delivery_date,delivery_location,created_at"
    )
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle<PortalBuyer>();

  if (byUserId.error) throw new Error(byUserId.error.message);
  if (byUserId.data) return byUserId.data;

  if (!email) return null;

  const byEmail = await admin
    .from("buyers")
    .select(
      "id,user_id,puppy_id,full_name,name,email,phone,sale_price,deposit_amount,deposit_date,finance_enabled,finance_admin_fee,finance_rate,finance_months,finance_monthly_amount,finance_day_of_month,finance_next_due_date,finance_last_payment_date,delivery_fee,delivery_option,delivery_date,delivery_location,created_at"
    )
    .ilike("email", email)
    .limit(1)
    .maybeSingle<PortalBuyer>();

  if (byEmail.error) throw new Error(byEmail.error.message);
  return byEmail.data || null;
}

async function loadPuppyForBuyer(admin: SupabaseClient, user: User, buyer: PortalBuyer | null) {
  if (buyer?.id) {
    const byBuyer = await admin
      .from("puppies")
      .select(
        "id,buyer_id,call_name,puppy_name,name,price,deposit,status,created_at"
      )
      .eq("buyer_id", buyer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<PortalPuppy>();

    if (byBuyer.error) throw new Error(byBuyer.error.message);
    if (byBuyer.data) return byBuyer.data;
  }

  const fallbackPuppyId = Number(buyer?.puppy_id || 0);
  if (fallbackPuppyId) {
    const byId = await admin
      .from("puppies")
      .select("id,buyer_id,call_name,puppy_name,name,price,deposit,status,created_at")
      .eq("id", fallbackPuppyId)
      .limit(1)
      .maybeSingle<PortalPuppy>();

    if (byId.error) throw new Error(byId.error.message);
    if (byId.data) return byId.data;
  }

  const email = normalizeEmail(user.email);
  if (!email) return null;

  const byOwnerEmail = await admin
    .from("puppies")
    .select("id,buyer_id,call_name,puppy_name,name,price,deposit,status,created_at")
    .ilike("owner_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<PortalPuppy>();

  if (byOwnerEmail.error) throw new Error(byOwnerEmail.error.message);
  return byOwnerEmail.data || null;
}

async function loadPortalPaymentState(admin: SupabaseClient, user: User) {
  const buyer = await loadBuyerForUser(admin, user);
  const puppy = await loadPuppyForBuyer(admin, user, buyer);

  if (!buyer?.id) {
    return {
      buyer: null,
      puppy,
      payments: [] as PortalPayment[],
      adjustments: [] as PortalFeeCreditRecord[],
      pickupRequest: null as PortalPickupRequest | null,
    };
  }

  const [paymentsResult, adjustmentsResult, pickupResult] = await Promise.all([
    admin
      .from("buyer_payments")
      .select("id,created_at,buyer_id,puppy_id,payment_date,amount,payment_type,method,note,status,reference_number")
      .eq("buyer_id", buyer.id)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<PortalPayment[]>(),
    admin
      .from("buyer_fee_credit_records")
      .select("id,created_at,buyer_id,puppy_id,entry_date,entry_type,label,description,amount,status,reference_number")
      .eq("buyer_id", buyer.id)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .returns<PortalFeeCreditRecord[]>(),
    admin
      .from("portal_pickup_requests")
      .select("id,created_at,user_id,puppy_id,request_date,request_type,location_text,notes,status,address_text,miles")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<PortalPickupRequest>(),
  ]);

  if (paymentsResult.error) throw new Error(paymentsResult.error.message);
  if (adjustmentsResult.error) throw new Error(adjustmentsResult.error.message);
  if (pickupResult.error) throw new Error(pickupResult.error.message);

  return {
    buyer,
    puppy,
    payments: paymentsResult.data || [],
    adjustments: adjustmentsResult.data || [],
    pickupRequest: pickupResult.data || null,
  };
}

export async function POST(req: Request) {
  try {
    const { user } = await verifyPortalUser(req);

    if (!user) {
      return jsonError("Please sign in again before creating a payment link.", 401);
    }

    if (!isZohoPaymentsConfigured()) {
      return jsonError(
        "Secure Zoho payments are not configured yet. Please contact us if you need help completing a payment.",
        503
      );
    }

    const body = (await req.json()) as PortalZohoBody;
    const chargeKind = String(body.charge_kind || "").trim().toLowerCase() as PortalChargeKind;

    if (!["deposit", "installment", "transportation"].includes(chargeKind)) {
      return jsonError("Please choose a valid payment type.");
    }

    const admin = createServiceSupabase();
    const state = await loadPortalPaymentState(admin, user);

    if (!state.buyer?.id) {
      return jsonError("We could not find a buyer account linked to this portal login.", 404);
    }

    const snapshot = buildPortalPaymentChargeSnapshot(state);
    const amount =
      chargeKind === "deposit"
        ? snapshot.depositDue
        : chargeKind === "transportation"
          ? snapshot.transportationDue
          : snapshot.installmentDue;

    if (!(amount > 0)) {
      const message =
        chargeKind === "deposit"
          ? "There is no deposit currently due on this account."
          : chargeKind === "transportation"
            ? "There is no transportation fee currently due on this account."
            : "There is no installment currently due on this account.";
      return jsonError(message, 409);
    }

    const referenceId = buildPortalChargeReference({
      buyerId: state.buyer.id,
      puppyId: state.puppy?.id ?? null,
      chargeKind,
    });
    const returnUrl = new URL("/api/portal/payments/zoho/return", req.url).toString();
    const description = describePortalCharge(chargeKind, snapshot.puppyName);

    const paymentLink = await createZohoPaymentLink({
      amount,
      currency: "USD",
      email: state.buyer.email || user.email || undefined,
      phone: state.buyer.phone || undefined,
      description,
      referenceId,
      returnUrl,
      sendEmail: false,
    });

    return NextResponse.json({
      ok: true,
      chargeKind,
      amount,
      url: paymentLink.url,
      paymentLinkId: paymentLink.payment_link_id,
      description,
    });
  } catch (error) {
    console.error("Portal Zoho payment link error:", error);
    return jsonError(
      error instanceof Error ? error.message : "Could not create the payment link right now.",
      500
    );
  }
}
