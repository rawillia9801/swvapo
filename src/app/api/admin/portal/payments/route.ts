import { NextResponse } from "next/server";
import { createServiceSupabase, firstValue, verifyOwner } from "@/lib/admin-api";

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
    const [buyersRes, puppiesRes, paymentsRes, adjustmentsRes] = await Promise.all([
      service
        .from("buyers")
        .select(
          "id,user_id,puppy_id,full_name,name,email,phone,sale_price,deposit_amount,finance_enabled,finance_admin_fee,finance_rate,finance_months,finance_monthly_amount,finance_next_due_date,finance_last_payment_date,status"
        )
        .order("created_at", { ascending: false }),
      service
        .from("puppies")
        .select("id,buyer_id,call_name,puppy_name,name,price,deposit,balance,status")
        .order("created_at", { ascending: false }),
      service
        .from("buyer_payments")
        .select(
          "id,created_at,buyer_id,puppy_id,payment_date,amount,payment_type,method,note,status,reference_number"
        )
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false }),
      service
        .from("buyer_fee_credit_records")
        .select(
          "id,created_at,buyer_id,puppy_id,entry_date,entry_type,label,description,amount,status,reference_number"
        )
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    if (buyersRes.error) throw buyersRes.error;
    if (puppiesRes.error) throw puppiesRes.error;
    if (paymentsRes.error) throw paymentsRes.error;

    const buyers = (buyersRes.data || []) as BuyerRow[];
    const puppies = (puppiesRes.data || []) as PuppyRow[];
    const payments = (paymentsRes.data || []) as BuyerPayment[];
    const adjustments =
      adjustmentsRes.error && isMissingTableError(adjustmentsRes.error)
        ? []
        : adjustmentsRes.error
          ? (() => {
              throw adjustmentsRes.error;
            })()
          : ((adjustmentsRes.data || []) as BuyerAdjustment[]);

    const puppiesByBuyerId = new Map<number, PuppyRow[]>();
    puppies.forEach((puppy) => {
      const buyerId = Number(puppy.buyer_id || 0);
      if (!buyerId) return;
      const group = puppiesByBuyerId.get(buyerId) || [];
      group.push(puppy);
      puppiesByBuyerId.set(buyerId, group);
    });

    buyers.forEach((buyer) => {
      const fallbackPuppyId = Number(buyer.puppy_id || 0);
      if (!fallbackPuppyId) return;
      const group = puppiesByBuyerId.get(buyer.id) || [];
      if (group.some((puppy) => puppy.id === fallbackPuppyId)) return;
      const fallbackPuppy = puppies.find((puppy) => puppy.id === fallbackPuppyId) || null;
      if (fallbackPuppy) {
        puppiesByBuyerId.set(buyer.id, [fallbackPuppy, ...group]);
      }
    });

    const paymentsByBuyerId = new Map<number, BuyerPayment[]>();
    payments.forEach((payment) => {
      const buyerId = Number(payment.buyer_id || 0);
      if (!buyerId) return;
      const group = paymentsByBuyerId.get(buyerId) || [];
      group.push(payment);
      paymentsByBuyerId.set(buyerId, group);
    });

    const adjustmentsByBuyerId = new Map<number, BuyerAdjustment[]>();
    adjustments.forEach((adjustment) => {
      const buyerId = Number(adjustment.buyer_id || 0);
      if (!buyerId) return;
      const group = adjustmentsByBuyerId.get(buyerId) || [];
      group.push(adjustment);
      adjustmentsByBuyerId.set(buyerId, group);
    });

    const accounts = buyers
      .map((buyer) => {
        const paymentGroup = paymentsByBuyerId.get(buyer.id) || [];
        const adjustmentGroup = adjustmentsByBuyerId.get(buyer.id) || [];
        const totalPaid = paymentGroup
          .filter((payment) => paymentCountsTowardBalance(payment.status))
          .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

        return {
          key: String(buyer.id),
          buyer,
          puppy: (puppiesByBuyerId.get(buyer.id) || [])[0] || null,
          linkedPuppies: puppiesByBuyerId.get(buyer.id) || [],
          payments: paymentGroup,
          adjustments: adjustmentGroup,
          totalPaid,
          lastPaymentAt: paymentGroup[0]?.payment_date || paymentGroup[0]?.created_at || null,
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

    return NextResponse.json({
      ok: true,
      entryKind: "payment",
      paymentId: data.id,
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
