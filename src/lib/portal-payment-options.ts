import type {
  PortalBuyer,
  PortalFeeCreditRecord,
  PortalPayment,
  PortalPickupRequest,
  PortalPuppy,
} from "@/lib/portal-data";
import { calculateTransportEstimate, type PickupRequestType } from "@/lib/transportation-pricing";
import { paymentCountsTowardBalance, portalPuppyName } from "@/lib/portal-data";

export type PortalChargeKind = "deposit" | "installment" | "transportation" | "general";

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
  generalDue: number;
  financeEnabled: boolean;
  monthlyAmount: number | null;
  currentBalance: number;
  scheduledReceiveDate: string | null;
  balanceDueByDate: string | null;
  finalBalanceDueNow: boolean;
  partialPaymentsAllowed: boolean;
  customPaymentMin: number;
  customPaymentMax: number;
};

function firstNumber(...values: Array<number | null | undefined>) {
  for (const value of values) {
    if (value !== null && value !== undefined && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return 0;
}

function firstDate(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (!text) continue;

    const date = new Date(`${text}T12:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return text;
    }
  }

  return null;
}

function localIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function previousBusinessDate(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return null;

  const date = new Date(`${text}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  date.setDate(date.getDate() - 1);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() - 1);
  }

  return localIsoDate(date);
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
  const financeEnabled = Boolean(buyer?.finance_enabled);
  const monthlyAmount =
    buyer?.finance_monthly_amount !== null && buyer?.finance_monthly_amount !== undefined
      ? Number(buyer.finance_monthly_amount)
      : null;
  const months =
    buyer?.finance_months !== null && buyer?.finance_months !== undefined
      ? Number(buyer.finance_months)
      : null;

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
  const totalCreditsApplied = adjustmentCredits + paymentCredits;
  const hasDepositPayment = payments.some(
    (payment) =>
      paymentCountsTowardBalance(payment.status) &&
      includesKeyword([payment.payment_type, payment.note].join(" ").toLowerCase(), ["deposit"])
  );
  const depositPaid =
    Boolean(buyer?.deposit_date) ||
    hasDepositPayment ||
    (depositAmount > 0 && totalCreditsApplied >= depositAmount - 0.01);
  const depositDue =
    depositAmount > 0 && !depositPaid ? Math.max(0, depositAmount - totalCreditsApplied) : 0;
  const principalAfterDeposit = Math.max(0, purchasePrice - (depositPaid ? depositAmount : 0));
  const planTotal =
    financeEnabled && monthlyAmount !== null && months !== null
      ? Math.max(0, monthlyAmount * months)
      : null;
  const financeBaseTotal =
    planTotal !== null ? Math.max(principalAfterDeposit, planTotal) : principalAfterDeposit;
  const financeUplift = Math.max(0, financeBaseTotal - principalAfterDeposit);

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
  const genericCreditsAfterDeposit = Math.max(0, totalCreditsApplied - depositAmount);
  const transportationApplied = Math.min(transportationChargeTotal, genericCreditsAfterDeposit);
  const transportationDue = Math.max(0, transportationChargeTotal - transportationApplied);

  const totalCharges = purchasePrice + financeUplift + adjustmentCharges + paymentCharges;
  const totalCredits = totalCreditsApplied;
  const currentBalance = Math.max(0, totalCharges - totalCredits);
  const installmentDue =
    !depositDue && financeEnabled && monthlyAmount !== null && currentBalance > 0
      ? Math.min(monthlyAmount, currentBalance)
      : 0;
  const scheduledReceiveDate = firstDate(buyer?.delivery_date, pickupRequest?.request_date);
  const balanceDueByDate = previousBusinessDate(scheduledReceiveDate);
  const finalBalanceDueNow =
    Boolean(
      !financeEnabled &&
        currentBalance > 0 &&
        balanceDueByDate &&
        localIsoDate(new Date()) >= balanceDueByDate
    );
  const customPaymentMax = currentBalance;
  const customPaymentMin =
    customPaymentMax > 0 ? (finalBalanceDueNow ? customPaymentMax : Math.min(1, customPaymentMax)) : 0;

  return {
    puppyName,
    depositAmount,
    depositPaid,
    depositDue,
    transportationChargeTotal,
    transportationDue,
    installmentDue,
    generalDue: currentBalance,
    financeEnabled,
    monthlyAmount,
    currentBalance,
    scheduledReceiveDate,
    balanceDueByDate,
    finalBalanceDueNow,
    partialPaymentsAllowed: customPaymentMax > 0 && !finalBalanceDueNow,
    customPaymentMin,
    customPaymentMax,
  };
}

const CHARGE_CODE: Record<PortalChargeKind, string> = {
  deposit: "dep",
  installment: "ins",
  transportation: "trn",
  general: "gen",
};

const CODE_CHARGE: Record<string, PortalChargeKind> = {
  dep: "deposit",
  ins: "installment",
  trn: "transportation",
  gen: "general",
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
  if (chargeKind === "general") return `Payment toward ${puppyName}`;
  return `Installment payment for ${puppyName}`;
}

export function paymentTypeForPortalCharge(chargeKind: PortalChargeKind) {
  if (chargeKind === "deposit") return "Deposit";
  if (chargeKind === "installment") return "Installment Payment";
  if (chargeKind === "transportation") return "Transportation Payment";
  return "Customer Payment";
}
