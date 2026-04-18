import { NextResponse } from "next/server";
import { createServiceSupabase, firstValue, verifyOwner } from "@/lib/admin-api";
import { queryBuyerPaymentNoticeLogs } from "@/lib/admin-data-compat";
import { sendBuyerPaymentReceiptEmail } from "@/lib/payment-email";
import { resolveBreedingWorkspace } from "@/lib/resolvers/breeding";
import { resolveBuyers } from "@/lib/resolvers/buyers";
import { resolvePayments } from "@/lib/resolvers/payments";

type BuyerRow = {
  id: number;
  user_id?: string | null;
  puppy_id?: number | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  sale_price?: number | null;
  deposit_amount?: number | null;
  finance_enabled?: boolean | null;
  finance_admin_fee?: boolean | null;
  finance_rate?: number | null;
  finance_months?: number | null;
  finance_monthly_amount?: number | null;
  finance_day_of_month?: number | null;
  finance_next_due_date?: string | null;
  finance_last_payment_date?: string | null;
  status?: string | null;
};

type PuppyRow = {
  id: number;
  buyer_id?: number | null;
  call_name?: string | null;
  puppy_name?: string | null;
  name?: string | null;
  price?: number | null;
  deposit?: number | null;
  balance?: number | null;
  status?: string | null;
};

type BuyerPayment = {
  id: string;
  created_at: string;
  buyer_id: number;
  puppy_id?: number | null;
  payment_date: string;
  amount: number;
  payment_type: string | null;
  method: string | null;
  note: string | null;
  status: string | null;
  reference_number: string | null;
};

type BuyerAdjustment = {
  id: number;
  created_at: string;
  buyer_id: number;
  puppy_id?: number | null;
  entry_date: string;
  entry_type: string | null;
  label: string | null;
  description: string | null;
  amount: number;
  status: string | null;
  reference_number: string | null;
};

type BuyerBillingSubscription = {
  id: number;
  buyer_id: number;
  puppy_id?: number | null;
  provider: string;
  reference_id: string;
  customer_id?: string | null;
  customer_email?: string | null;
  customer_name?: string | null;
  subscription_id?: string | null;
  subscription_status?: string | null;
  hostedpage_id?: string | null;
  hostedpage_url?: string | null;
  hostedpage_expires_at?: string | null;
  plan_code?: string | null;
  plan_name?: string | null;
  recurring_price?: number | null;
  currency_code?: string | null;
  interval_count?: number | null;
  interval_unit?: string | null;
  billing_cycles?: number | null;
  current_term_ends_at?: string | null;
  next_billing_at?: string | null;
  started_at?: string | null;
  last_payment_at?: string | null;
  last_payment_amount?: number | null;
  card_last_four?: string | null;
  card_expiry_month?: number | null;
  card_expiry_year?: number | null;
  last_event_id?: string | null;
  last_event_type?: string | null;
  last_event_at?: string | null;
};

type BuyerPaymentNoticeSettings = {
  id?: number;
  buyer_id: number;
  enabled: boolean;
  receipt_enabled: boolean;
  due_reminder_enabled: boolean;
  due_reminder_days_before: number;
  late_notice_enabled: boolean;
  late_notice_days_after: number;
  default_notice_enabled: boolean;
  default_notice_days_after: number;
  recipient_email?: string | null;
  cc_emails?: string[] | null;
  internal_note?: string | null;
};

type BuyerPaymentNoticeLog = {
  id: number;
  created_at: string;
  buyer_id: number;
  puppy_id?: number | null;
  payment_id?: string | null;
  notice_kind: string;
  notice_key: string;
  notice_date?: string | null;
  due_date?: string | null;
  status: string;
  recipient_email: string;
  subject: string;
  provider: string;
  provider_message_id?: string | null;
  meta?: Record<string, unknown> | null;
};

function paymentCountsTowardBalance(status: string | null | undefined) {
  const normalized = String(status || "").toLowerCase();
  if (!normalized) return true;
  return !["failed", "void", "canceled", "cancelled"].includes(normalized);
}

function toNumberOrNull(value: unknown) {
  const cleaned = String(value ?? "").replace(/[^0-9.-]/g, "").trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function isMissingTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.toLowerCase().includes("does not exist");
}

function normalizeAdjustmentType(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "transport" || normalized === "delivery") return "transportation";
  if (["fee", "credit", "transportation"].includes(normalized)) return normalized;
  return "";
}

function defaultAdjustmentLabel(entryType: string) {
  if (entryType === "credit") return "Credit";
  if (entryType === "transportation") return "Transportation Fee";
  return "Fee";
}

export async function GET(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const service = createServiceSupabase();
    const [breeding, buyersResolved] = await Promise.all([
      resolveBreedingWorkspace(service),
      resolveBuyers(service),
    ]);
    const paymentsResolved = await resolvePayments(service, {
      buyers: buyersResolved.data,
      puppies: breeding.data.resolvedPuppies,
    });

    const puppiesById = new Map<number, PuppyRow>();
    const puppiesByBuyerId = new Map<number, PuppyRow[]>();
    breeding.data.resolvedPuppies.forEach((puppy) => {
      if (puppy.id === null) return;
      const normalizedPuppy = {
        id: Number(puppy.id || 0),
        buyer_id: puppy.buyerId,
        call_name: puppy.callName,
        puppy_name: puppy.displayName,
        name: puppy.displayName,
        price: puppy.price,
        deposit: puppy.deposit,
        balance: puppy.balance,
        status: puppy.status,
      } satisfies PuppyRow;

      puppiesById.set(normalizedPuppy.id, normalizedPuppy);
      if (normalizedPuppy.buyer_id !== null && normalizedPuppy.buyer_id !== undefined) {
        const group = puppiesByBuyerId.get(normalizedPuppy.buyer_id) || [];
        group.push(normalizedPuppy);
        puppiesByBuyerId.set(normalizedPuppy.buyer_id, group);
      }
    });

    const accounts = paymentsResolved.data.resolvedBuyerFinancials
      .map((account) => {
        const buyer = {
          id: Number(account.buyerId || 0),
          user_id: account.buyer?.userId || null,
          puppy_id: account.linkedPuppyId,
          full_name: account.buyer?.fullName || null,
          name: account.buyer?.fullName || null,
          email: account.buyer?.email || null,
          phone: account.buyer?.phone || null,
          sale_price: account.buyer?.salePrice ?? account.salePrice,
          deposit_amount: account.buyer?.depositAmount ?? account.depositPaid,
          finance_enabled: account.buyer?.financeEnabled ?? null,
          finance_admin_fee: account.buyer?.financeAdminFee ?? null,
          finance_rate: account.buyer?.financeRate ?? null,
          finance_months: account.buyer?.financeMonths ?? null,
          finance_monthly_amount: account.buyer?.financeMonthlyAmount ?? null,
          finance_day_of_month: account.buyer?.financeDayOfMonth ?? null,
          finance_next_due_date: account.nextDueDate,
          finance_last_payment_date: account.lastPaymentAt,
          status: account.buyer?.status || account.planStatus || null,
        } satisfies BuyerRow;

        const linkedPuppies = Array.from(
          new Map(
            [
              ...(account.linkedPuppyId !== null
                ? [[account.linkedPuppyId, puppiesById.get(account.linkedPuppyId) || null] as const]
                : []),
              ...(account.buyerId !== null
                ? (puppiesByBuyerId.get(account.buyerId) || []).map((puppy) => [puppy.id, puppy] as const)
                : []),
            ].filter((entry): entry is readonly [number, PuppyRow] => Boolean(entry[1]))
          ).values()
        );

        const primaryPuppy = linkedPuppies[0] || null;
        const payments = account.paymentEvents
          .filter((event) => event.eventType === "payment")
          .map((event) => ({
            id: event.id,
            created_at: event.eventDate || new Date(0).toISOString(),
            buyer_id: Number(event.buyerId || 0),
            puppy_id: event.puppyId,
            payment_date: event.eventDate || new Date(0).toISOString().slice(0, 10),
            amount: event.amount,
            payment_type: event.eventType,
            method: event.method,
            note: event.notes,
            status: event.status,
            reference_number: event.referenceNumber,
          })) as BuyerPayment[];

        const adjustments = account.paymentEvents
          .filter((event) => event.eventType !== "payment")
          .map((event, index) => ({
            id: index + 1,
            created_at: event.eventDate || new Date(0).toISOString(),
            buyer_id: Number(event.buyerId || 0),
            puppy_id: event.puppyId,
            entry_date: event.eventDate || new Date(0).toISOString().slice(0, 10),
            entry_type: event.eventType,
            label: event.eventType,
            description: event.notes,
            amount: event.amount,
            status: event.status,
            reference_number: event.referenceNumber,
          })) as BuyerAdjustment[];

        const billingGroup = account.billingSubscriptions.map((subscription) => ({
          id: Number(subscription.id.replace(/^\D+/g, "") || 0),
          buyer_id: account.buyerId || 0,
          puppy_id: subscription.puppyId,
          provider: "resolved",
          reference_id: subscription.id,
          subscription_status: subscription.status,
          plan_name: subscription.planName,
          recurring_price: subscription.recurringPrice,
          next_billing_at: subscription.nextBillingAt,
          last_payment_at: subscription.lastPaymentAt,
          last_payment_amount: subscription.lastPaymentAmount,
          card_last_four: subscription.cardLastFour,
        })) as BuyerBillingSubscription[];

        const noticeSetting = account.noticeSettings
          ? ({
              buyer_id: account.buyerId || 0,
              enabled: Boolean(account.noticeSettings.enabled),
              receipt_enabled: Boolean(account.noticeSettings.receiptEnabled),
              due_reminder_enabled: Boolean(account.noticeSettings.dueReminderEnabled),
              due_reminder_days_before: Number(account.noticeSettings.dueReminderDaysBefore || 0),
              late_notice_enabled: Boolean(account.noticeSettings.lateNoticeEnabled),
              late_notice_days_after: Number(account.noticeSettings.lateNoticeDaysAfter || 0),
              default_notice_enabled: Boolean(account.noticeSettings.defaultNoticeEnabled),
              default_notice_days_after: Number(account.noticeSettings.defaultNoticeDaysAfter || 0),
              recipient_email: account.noticeSettings.recipientEmail,
            } satisfies BuyerPaymentNoticeSettings)
          : null;

        const noticeLogGroup = account.notices.slice(0, 8).map((notice, index) => ({
          id: index + 1,
          created_at: notice.createdAt || new Date(0).toISOString(),
          buyer_id: Number(notice.buyerId || 0),
          puppy_id: notice.puppyId,
          payment_id: null,
          notice_kind: notice.noticeKind || "notice",
          notice_key: notice.id,
          notice_date: notice.noticeDate,
          due_date: notice.noticeDate,
          status: notice.status || "sent",
          recipient_email: notice.recipientEmail || "",
          subject: notice.subject || "",
          provider: notice.provider || "resolved",
          provider_message_id: null,
          meta: null,
        })) as BuyerPaymentNoticeLog[];

        return {
          key: String(account.buyerId || account.buyerResolverKey),
          buyer,
          puppy: primaryPuppy,
          linkedPuppies,
          payments,
          adjustments,
          billing_subscriptions: billingGroup,
          billing_subscription: billingGroup[0] || null,
          payment_notice_settings: noticeSetting,
          payment_notice_logs: noticeLogGroup,
          totalPaid: account.totalPaid,
          lastPaymentAt: account.lastPaymentAt,
        };
      })
      .sort((a, b) =>
        firstValue(a.buyer.full_name, a.buyer.name, a.buyer.email).localeCompare(
          firstValue(b.buyer.full_name, b.buyer.name, b.buyer.email)
        )
      );

    return NextResponse.json({
      ok: true,
      accounts,
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin portal payments route error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const buyerId = Number(body.buyer_id || 0);
    const amount = toNumberOrNull(body.amount);
    const entryKind = String(body.entry_kind || "payment").trim().toLowerCase();

    if (!buyerId || amount === null || amount < 0) {
      return NextResponse.json(
        { ok: false, error: "Buyer and amount are required." },
        { status: 400 }
      );
    }

    const service = createServiceSupabase();

    if (entryKind === "adjustment") {
      const entryDate = String(body.entry_date || "").trim();
      const entryType = normalizeAdjustmentType(body.entry_type);
      const label = firstValue(body.label as string | null, defaultAdjustmentLabel(entryType));

      if (!entryDate || !entryType || !label) {
        return NextResponse.json(
          { ok: false, error: "Date, type, and label are required for fees, credits, and transportation entries." },
          { status: 400 }
        );
      }

      const { data, error } = await service
        .from("buyer_fee_credit_records")
        .insert({
          buyer_id: buyerId,
          puppy_id: Number(body.puppy_id || 0) || null,
          created_by: owner.id,
          entry_date: entryDate,
          entry_type: entryType,
          label,
          description: firstValue(body.description as string | null, body.note as string | null) || null,
          amount,
          status: firstValue(body.status as string | null, "recorded"),
          reference_number: firstValue(body.reference_number as string | null) || null,
        })
        .select("id")
        .single();

      if (error) {
        if (isMissingTableError(error)) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "The fee and credit table is not available yet. Please apply the buyer_fee_credit_records SQL migration first.",
            },
            { status: 500 }
          );
        }
        throw error;
      }

      return NextResponse.json({
        ok: true,
        entryKind,
        entryId: data.id,
        ownerEmail: owner.email || null,
      });
    }

    const paymentDate = String(body.payment_date || body.entry_date || "").trim();
    if (!paymentDate) {
      return NextResponse.json(
        { ok: false, error: "Payment date is required." },
        { status: 400 }
      );
    }

    const { data, error } = await service
      .from("buyer_payments")
      .insert({
        buyer_id: buyerId,
        puppy_id: Number(body.puppy_id || 0) || null,
        user_id: owner.id,
        payment_date: paymentDate,
        amount,
        payment_type: firstValue(body.payment_type as string | null) || null,
        method: firstValue(body.method as string | null) || null,
        note: firstValue(body.note as string | null) || null,
        status: firstValue(body.status as string | null, "recorded"),
        reference_number: firstValue(body.reference_number as string | null) || null,
      })
      .select("id")
      .single();

    if (error) throw error;

    let emailStatus: string | null = null;
    try {
      const receiptResult = await sendBuyerPaymentReceiptEmail(service, { paymentId: data.id });
      emailStatus = receiptResult.sent
        ? "receipt_sent"
        : receiptResult.skippedReason || "receipt_skipped";
    } catch (receiptError) {
      console.error("Manual payment receipt email error:", receiptError);
      emailStatus = "receipt_failed";
    }

    return NextResponse.json({
      ok: true,
      entryKind: "payment",
      paymentId: data.id,
      emailStatus,
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin portal payment create error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const buyerId = Number(body.buyer_id || 0);
    if (!buyerId) {
      return NextResponse.json({ ok: false, error: "A buyer id is required." }, { status: 400 });
    }

    const puppyId = Number(body.puppy_id || 0);
    const service = createServiceSupabase();

    const buyerResult = await service
      .from("buyers")
      .update({
        sale_price: toNumberOrNull(body.price),
        deposit_amount: toNumberOrNull(body.deposit),
        finance_enabled: String(body.finance_enabled || "").toLowerCase() === "yes",
        finance_admin_fee: String(body.finance_admin_fee || "").toLowerCase() === "yes",
        finance_rate: toNumberOrNull(body.finance_rate),
        finance_months: toNumberOrNull(body.finance_months),
        finance_monthly_amount: toNumberOrNull(body.finance_monthly_amount),
        finance_next_due_date: firstValue(body.finance_next_due_date as string | null) || null,
      })
      .eq("id", buyerId);

    if (buyerResult.error) throw buyerResult.error;

    if (puppyId) {
      const puppyResult = await service
        .from("puppies")
        .update({
          price: toNumberOrNull(body.price),
          deposit: toNumberOrNull(body.deposit),
          balance: toNumberOrNull(body.balance),
          status: firstValue(body.puppy_status as string | null) || null,
        })
        .eq("id", puppyId);

      if (puppyResult.error) throw puppyResult.error;
    }

    return NextResponse.json({ ok: true, buyerId, ownerEmail: owner.email || null });
  } catch (error) {
    console.error("Admin portal payment update error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
