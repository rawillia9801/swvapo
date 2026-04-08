import type {
  PortalBuyer,
  PortalFeeCreditRecord,
  PortalPayment,
  PortalPickupRequest,
  PortalPuppy,
} from "@/lib/portal-data";
import { calculateTransportEstimate, type PickupRequestType } from "@/lib/transportation-pricing";
import { paymentCountsTowardBalance, portalPuppyName } from "@/lib/portal-data";

export type PortalChargeKind = "deposit" | "installment" | "transportation";

type PortalPaymentOptionState = {
  buyer: PortalBuyer | null;
  puppy: PortalPuppy | null;
  payments: PortalPayment[];
  adjustments: PortalFeeCreditRecord[];
  pickupRequest: PortalPickupRequest | null;
};

export type PortalPaymentChargeSnapshot = {
  puppyName: string;
  depositAmount: number;
  depositPaid: boolean;
  depositDue: number;
  transportationChargeTotal: number;
  transportationDue: number;
  installmentDue: number;
  financeEnabled: boolean;
  monthlyAmount: number | null;
  currentBalance: number;
};

function firstNumber(...values: Array<number | null | undefined>) {
  for (const value of values) {
    if (value !== null && value !== undefined && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return 0;
}

function includesKeyword(value: string | null | undefined, keywords: string[]) {
  const normalized = String(value || "").trim().toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function adjustmentCountsTowardBalance(status: string | null | undefined) {
  const normalized = String(status || "").toLowerCase();
  if (!normalized) return true;
  return !["void", "cancelled", "canceled"].includes(normalized);
}

function paymentEffect(payment: PortalPayment) {
  const amount = Math.abs(Number(payment.amount || 0));
  if (!paymentCountsTowardBalance(payment.status) || amount <= 0) {
    return { charge: 0, credit: 0 };
  }

  const paymentType = String(payment.payment_type || "").trim().toLowerCase();
  if (
    includesKeyword(paymentType, [
      "fee",
      "charge",
      "transport",
      "delivery",
      "shipping",
      "admin fee",
      "late fee",
    ])
  ) {
    return { charge: amount, credit: 0 };
  }

  if (includesKeyword(paymentType, ["credit", "discount", "refund"])) {
    return { charge: 0, credit: amount };
  }

  if (Number(payment.amount || 0) < 0) {
    return { charge: amount, credit: 0 };
  }

  return { charge: 0, credit: amount };
}

function transportPaymentCredit(payment: PortalPayment) {
  if (!paymentCountsTowardBalance(payment.status)) return 0;

  const combined = [payment.payment_type, payment.note, payment.method].join(" ").toLowerCase();
  if (!includesKeyword(combined, ["transport", "delivery", "shipping"])) return 0;
  return Math.abs(Number(payment.amount || 0));
}

function transportAdjustmentCharge(adjustment: PortalFeeCreditRecord) {
  if (!adjustmentCountsTowardBalance(adjustment.status)) return 0;
  if (String(adjustment.entry_type || "").trim().toLowerCase() !== "transportation") return 0;
  return Math.abs(Number(adjustment.amount || 0));
}

export function buildPortalPaymentChargeSnapshot(
  state: PortalPaymentOptionState
): PortalPaymentChargeSnapshot {
  const { buyer, puppy, payments, adjustments, pickupRequest } = state;
  const puppyName = portalPuppyName(puppy);
  const purchasePrice = firstNumber(buyer?.sale_price, puppy?.price);
  const depositAmount = firstNumber(buyer?.deposit_amount, puppy?.deposit);
  const hasDepositPayment = payments.some(
    (payment) =>
      paymentCountsTowardBalance(payment.status) &&
      includesKeyword([payment.payment_type, payment.note].join(" ").toLowerCase(), ["deposit"])
  );
  const depositPaid = Boolean(buyer?.deposit_date) || hasDepositPayment;
  const depositDue = depositAmount > 0 && !depositPaid ? depositAmount : 0;

  const requestEstimate = pickupRequest
    ? calculateTransportEstimate(
        (pickupRequest.request_type as PickupRequestType) || "",
        pickupRequest.miles
      )
    : null;
  const transportAdjustmentTotal = adjustments.reduce(
    (sum, adjustment) => sum + transportAdjustmentCharge(adjustment),
    0
  );
  const baseTransportationCharge =
    transportAdjustmentTotal > 0
      ? 0
      : firstNumber(
          buyer?.delivery_fee,
          requestEstimate?.fee !== null && requestEstimate?.fee !== undefined
            ? requestEstimate.fee
            : null
        );
  const transportationChargeTotal = transportAdjustmentTotal + baseTransportationCharge;
  const transportationPaid = payments.reduce(
    (sum, payment) => sum + transportPaymentCredit(payment),
    0
  );
  const transportationDue = Math.max(0, transportationChargeTotal - transportationPaid);

  const financeEnabled = Boolean(buyer?.finance_enabled);
  const monthlyAmount =
    buyer?.finance_monthly_amount !== null && buyer?.finance_monthly_amount !== undefined
      ? Number(buyer.finance_monthly_amount)
      : null;
  const months =
    buyer?.finance_months !== null && buyer?.finance_months !== undefined
      ? Number(buyer.finance_months)
      : null;
  const principalAfterDeposit = Math.max(0, purchasePrice - (depositPaid ? depositAmount : 0));
  const planTotal =
    financeEnabled && monthlyAmount !== null && months !== null
      ? Math.max(0, monthlyAmount * months)
      : null;
  const financeBaseTotal =
    planTotal !== null ? Math.max(principalAfterDeposit, planTotal) : principalAfterDeposit;
  const financeUplift = Math.max(0, financeBaseTotal - principalAfterDeposit);

  const adjustmentCharges = adjustments.reduce((sum, adjustment) => {
    if (!adjustmentCountsTowardBalance(adjustment.status)) return sum;
    if (String(adjustment.entry_type || "").trim().toLowerCase() === "credit") return sum;
    return sum + Math.abs(Number(adjustment.amount || 0));
  }, 0);
  const adjustmentCredits = adjustments.reduce((sum, adjustment) => {
    if (!adjustmentCountsTowardBalance(adjustment.status)) return sum;
    if (String(adjustment.entry_type || "").trim().toLowerCase() !== "credit") return sum;
    return sum + Math.abs(Number(adjustment.amount || 0));
  }, 0);
  const paymentCharges = payments.reduce((sum, payment) => sum + paymentEffect(payment).charge, 0);
  const paymentCredits = payments.reduce((sum, payment) => sum + paymentEffect(payment).credit, 0);

  const totalCharges = purchasePrice + financeUplift + adjustmentCharges + paymentCharges;
  const totalCredits = (depositPaid ? depositAmount : 0) + adjustmentCredits + paymentCredits;
  const currentBalance = Math.max(0, totalCharges - totalCredits);
  const installmentDue =
    !depositDue && financeEnabled && monthlyAmount !== null && currentBalance > 0
      ? Math.min(monthlyAmount, currentBalance)
      : 0;

  return {
    puppyName,
    depositAmount,
    depositPaid,
    depositDue,
    transportationChargeTotal,
    transportationDue,
    installmentDue,
    financeEnabled,
    monthlyAmount,
    currentBalance,
  };
}

const CHARGE_CODE: Record<PortalChargeKind, string> = {
  deposit: "dep",
  installment: "ins",
  transportation: "trn",
};

const CODE_CHARGE: Record<string, PortalChargeKind> = {
  dep: "deposit",
  ins: "installment",
  trn: "transportation",
};

export function buildPortalChargeReference(input: {
  buyerId: number;
  puppyId?: number | null;
  chargeKind: PortalChargeKind;
}) {
  const puppyId = Number(input.puppyId || 0);
  return `swva-b${input.buyerId}-p${puppyId}-c${CHARGE_CODE[input.chargeKind]}-n${Date.now().toString(36)}`;
}

export function parsePortalChargeReference(reference: string | null | undefined) {
  const match = String(reference || "")
    .trim()
    .match(/^swva-b(\d+)-p(\d+)-c([a-z]+)-n([a-z0-9]+)$/i);

  if (!match) return null;

  const chargeKind = CODE_CHARGE[String(match[3] || "").toLowerCase()];
  if (!chargeKind) return null;

  return {
    buyerId: Number(match[1]),
    puppyId: Number(match[2]) || null,
    chargeKind,
    nonce: match[4],
  };
}

export function describePortalCharge(chargeKind: PortalChargeKind, puppyName: string) {
  if (chargeKind === "deposit") return `Reservation deposit for ${puppyName}`;
  if (chargeKind === "transportation") return `Transportation fee for ${puppyName}`;
  return `Installment payment for ${puppyName}`;
}

export function paymentTypeForPortalCharge(chargeKind: PortalChargeKind) {
  if (chargeKind === "deposit") return "Deposit";
  if (chargeKind === "installment") return "Installment Payment";
  return "Payment";
}
