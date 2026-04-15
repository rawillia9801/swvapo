import "server-only";

import type { ChiChiDealState } from "@/lib/chichi-deal-state";

export type ChiChiDocumentRuleKey =
  | "application"
  | "deposit-agreement"
  | "bill-of-sale"
  | "health-guarantee"
  | "payment-plan-agreement"
  | "pickup-delivery-confirmation";

export type ChiChiRuleSeverity = "info" | "warning" | "blocking";

export type ChiChiRuleMessage = {
  severity: ChiChiRuleSeverity;
  code: string;
  message: string;
  field?: string;
  documentKey?: ChiChiDocumentRuleKey;
};

export type ChiChiDocumentRuleStatus = {
  documentKey: ChiChiDocumentRuleKey;
  label: string;
  required: boolean;
  ready: boolean;
  blocked: boolean;
  missingFields: string[];
  blockers: ChiChiRuleMessage[];
  warnings: ChiChiRuleMessage[];
  reasons: string[];
};

export type ChiChiNextAction =
  | "collect_buyer"
  | "assign_puppy"
  | "set_sale_price"
  | "collect_deposit"
  | "prepare_deposit_agreement"
  | "prepare_bill_of_sale"
  | "prepare_health_guarantee"
  | "prepare_payment_plan_agreement"
  | "prepare_pickup_delivery_confirmation"
  | "collect_financing_terms"
  | "collect_delivery_details"
  | "review_signed_documents"
  | "release_ready"
  | "manual_review";

export type ChiChiDealRulesResult = {
  documents: Record<ChiChiDocumentRuleKey, ChiChiDocumentRuleStatus>;
  requiredDocuments: ChiChiDocumentRuleKey[];
  readyDocuments: ChiChiDocumentRuleKey[];
  blockedDocuments: ChiChiDocumentRuleKey[];
  blockers: ChiChiRuleMessage[];
  warnings: ChiChiRuleMessage[];
  nextActions: ChiChiNextAction[];
  releaseReady: boolean;
  summary: string;
};

const DOCUMENT_LABELS: Record<ChiChiDocumentRuleKey, string> = {
  application: "Application",
  "deposit-agreement": "Deposit Agreement",
  "bill-of-sale": "Bill of Sale",
  "health-guarantee": "Health Guarantee",
  "payment-plan-agreement": "Payment Plan Agreement",
  "pickup-delivery-confirmation": "Pickup / Delivery Confirmation",
};

export function evaluateChiChiDealRules(
  state: ChiChiDealState
): ChiChiDealRulesResult {
  const application = evaluateApplication(state);
  const depositAgreement = evaluateDepositAgreement(state);
  const billOfSale = evaluateBillOfSale(state);
  const healthGuarantee = evaluateHealthGuarantee(state);
  const paymentPlanAgreement = evaluatePaymentPlanAgreement(state);
  const pickupDeliveryConfirmation = evaluatePickupDeliveryConfirmation(state);

  const documents: Record<ChiChiDocumentRuleKey, ChiChiDocumentRuleStatus> = {
    application,
    "deposit-agreement": depositAgreement,
    "bill-of-sale": billOfSale,
    "health-guarantee": healthGuarantee,
    "payment-plan-agreement": paymentPlanAgreement,
    "pickup-delivery-confirmation": pickupDeliveryConfirmation,
  };

  const requiredDocuments = Object.values(documents)
    .filter((doc) => doc.required)
    .map((doc) => doc.documentKey);

  const readyDocuments = Object.values(documents)
    .filter((doc) => doc.required && doc.ready && !doc.blocked)
    .map((doc) => doc.documentKey);

  const blockedDocuments = Object.values(documents)
    .filter((doc) => doc.required && doc.blocked)
    .map((doc) => doc.documentKey);

  const blockers = Object.values(documents).flatMap((doc) => doc.blockers);
  const warnings = Object.values(documents).flatMap((doc) => doc.warnings);

  const nextActions = buildNextActions(state, documents);
  const releaseReady = computeReleaseReady(state, documents);

  return {
    documents,
    requiredDocuments,
    readyDocuments,
    blockedDocuments,
    blockers,
    warnings,
    nextActions,
    releaseReady,
    summary: buildSummary(documents, nextActions, releaseReady),
  };
}

export function getChiChiNextActions(
  state: ChiChiDealState
): ChiChiNextAction[] {
  return evaluateChiChiDealRules(state).nextActions;
}

export function isChiChiDocumentReady(
  state: ChiChiDealState,
  documentKey: ChiChiDocumentRuleKey
): boolean {
  const result = evaluateChiChiDealRules(state);
  const doc = result.documents[documentKey];
  return !!doc && doc.required && doc.ready && !doc.blocked;
}

export function getChiChiReadyDocuments(
  state: ChiChiDealState
): ChiChiDocumentRuleKey[] {
  return evaluateChiChiDealRules(state).readyDocuments;
}

export function getChiChiBlockedDocuments(
  state: ChiChiDealState
): ChiChiDocumentRuleKey[] {
  return evaluateChiChiDealRules(state).blockedDocuments;
}

function evaluateApplication(state: ChiChiDealState): ChiChiDocumentRuleStatus {
  const required = true;
  const blockers: ChiChiRuleMessage[] = [];
  const warnings: ChiChiRuleMessage[] = [];
  const missingFields: string[] = [];
  const reasons: string[] = [];

  if (!state.buyer.exists) {
    missingFields.push("buyer");
    blockers.push(
      block(
        "buyer_missing",
        "Buyer record has not been resolved.",
        "buyer",
        "application"
      )
    );
  }

  const exists = state.documents.application.exists;
  const signed = state.documents.application.signed;
  const filed = state.documents.application.filed;

  if (!exists) {
    warnings.push(
      warn(
        "application_not_started",
        "Application has not been created yet.",
        undefined,
        "application"
      )
    );
    reasons.push("Application has not been started.");
  } else if (!signed) {
    reasons.push("Application exists but is not signed yet.");
  } else if (filed) {
    reasons.push("Application is signed and filed.");
  } else {
    reasons.push("Application is signed.");
  }

  return buildDocStatus(
    "application",
    required,
    blockers,
    warnings,
    missingFields,
    reasons,
    exists && !filed ? true : exists
  );
}

function evaluateDepositAgreement(
  state: ChiChiDealState
): ChiChiDocumentRuleStatus {
  const required = true;
  const blockers: ChiChiRuleMessage[] = [];
  const warnings: ChiChiRuleMessage[] = [];
  const missingFields: string[] = [];
  const reasons: string[] = [];
  const doc = mapStateDoc(state, "deposit-agreement");

  if (!state.buyer.exists) {
    missingFields.push("buyer");
    blockers.push(
      block(
        "buyer_missing",
        "Buyer must exist before preparing the Deposit Agreement.",
        "buyer",
        "deposit-agreement"
      )
    );
  }

  if (!state.sale.depositAmount) {
    missingFields.push("deposit amount");
    blockers.push(
      block(
        "deposit_missing",
        "Deposit amount is missing.",
        "depositAmount",
        "deposit-agreement"
      )
    );
  }

  if (!state.sale.price) {
    missingFields.push("sale price");
    warnings.push(
      warn(
        "sale_price_missing",
        "Sale price is missing. ChiChi can still prepare a deposit-style reservation flow, but estimates may be incomplete.",
        "price",
        "deposit-agreement"
      )
    );
  }

  if (!state.puppy.assigned) {
    warnings.push(
      warn(
        "puppy_not_assigned",
        "No puppy is assigned yet. Deposit Agreement may need to act as a reservation-style document.",
        "puppy",
        "deposit-agreement"
      )
    );
    reasons.push("No puppy assigned yet; reservation mode may be needed.");
  }

  if (doc.filed) {
    reasons.push("Deposit Agreement is already filed.");
  } else if (doc.signed) {
    reasons.push("Deposit Agreement is already signed.");
  } else if (doc.exists) {
    reasons.push("Deposit Agreement already exists.");
  } else {
    reasons.push("Deposit Agreement can be prepared when deposit data is present.");
  }

  const ready = !!state.buyer.exists && !!state.sale.depositAmount;

  return buildDocStatus(
    "deposit-agreement",
    required,
    blockers,
    warnings,
    missingFields,
    reasons,
    ready
  );
}

function evaluateBillOfSale(state: ChiChiDealState): ChiChiDocumentRuleStatus {
  const required = true;
  const blockers: ChiChiRuleMessage[] = [];
  const warnings: ChiChiRuleMessage[] = [];
  const missingFields: string[] = [];
  const reasons: string[] = [];
  const doc = mapStateDoc(state, "bill-of-sale");

  if (!state.buyer.exists) {
    missingFields.push("buyer");
    blockers.push(
      block(
        "buyer_missing",
        "Buyer must exist before preparing the Bill of Sale.",
        "buyer",
        "bill-of-sale"
      )
    );
  }

  if (!state.puppy.assigned) {
    missingFields.push("assigned puppy");
    blockers.push(
      block(
        "puppy_missing",
        "A puppy must be assigned before preparing the Bill of Sale.",
        "puppy",
        "bill-of-sale"
      )
    );
  }

  if (!state.sale.price) {
    missingFields.push("sale price");
    blockers.push(
      block(
        "sale_price_missing",
        "Sale price must be set before preparing the Bill of Sale.",
        "price",
        "bill-of-sale"
      )
    );
  }

  if (!state.sale.depositPaid) {
    warnings.push(
      warn(
        "deposit_not_marked",
        "Deposit is not currently marked as paid. You may want to verify this before sending final sales paperwork.",
        "depositPaid",
        "bill-of-sale"
      )
    );
  }

  if (doc.filed) {
    reasons.push("Bill of Sale is already filed.");
  } else if (doc.signed) {
    reasons.push("Bill of Sale is already signed.");
  } else if (doc.exists) {
    reasons.push("Bill of Sale already exists.");
  } else {
    reasons.push("Bill of Sale becomes ready when buyer, puppy, and sale price are set.");
  }

  const ready =
    !!state.buyer.exists && !!state.puppy.assigned && !!state.sale.price;

  return buildDocStatus(
    "bill-of-sale",
    required,
    blockers,
    warnings,
    missingFields,
    reasons,
    ready
  );
}

function evaluateHealthGuarantee(
  state: ChiChiDealState
): ChiChiDocumentRuleStatus {
  const required = true;
  const blockers: ChiChiRuleMessage[] = [];
  const warnings: ChiChiRuleMessage[] = [];
  const missingFields: string[] = [];
  const reasons: string[] = [];
  const doc = mapStateDoc(state, "health-guarantee");

  if (!state.buyer.exists) {
    missingFields.push("buyer");
    blockers.push(
      block(
        "buyer_missing",
        "Buyer must exist before preparing the Health Guarantee.",
        "buyer",
        "health-guarantee"
      )
    );
  }

  if (!state.puppy.assigned) {
    missingFields.push("assigned puppy");
    blockers.push(
      block(
        "puppy_missing",
        "A puppy must be assigned before preparing the Health Guarantee.",
        "puppy",
        "health-guarantee"
      )
    );
  }

  if (doc.filed) {
    reasons.push("Health Guarantee is already filed.");
  } else if (doc.signed) {
    reasons.push("Health Guarantee is already signed.");
  } else if (doc.exists) {
    reasons.push("Health Guarantee already exists.");
  } else {
    reasons.push("Health Guarantee becomes ready when buyer and puppy are assigned.");
  }

  const ready = !!state.buyer.exists && !!state.puppy.assigned;

  return buildDocStatus(
    "health-guarantee",
    required,
    blockers,
    warnings,
    missingFields,
    reasons,
    ready
  );
}

function evaluatePaymentPlanAgreement(
  state: ChiChiDealState
): ChiChiDocumentRuleStatus {
  const required = !!state.financing.enabled;
  const blockers: ChiChiRuleMessage[] = [];
  const warnings: ChiChiRuleMessage[] = [];
  const missingFields: string[] = [];
  const reasons: string[] = [];
  const doc = mapStateDoc(state, "payment-plan-agreement");

  if (!required) {
    reasons.push(
      "Payment Plan Agreement is not required because financing is not enabled."
    );
    return buildDocStatus(
      "payment-plan-agreement",
      false,
      blockers,
      warnings,
      missingFields,
      reasons,
      false
    );
  }

  if (!state.buyer.exists) {
    missingFields.push("buyer");
    blockers.push(
      block(
        "buyer_missing",
        "Buyer must exist before preparing the Payment Plan Agreement.",
        "buyer",
        "payment-plan-agreement"
      )
    );
  }

  if (!state.puppy.assigned) {
    missingFields.push("assigned puppy");
    blockers.push(
      block(
        "puppy_missing",
        "A puppy should be assigned before preparing the Payment Plan Agreement.",
        "puppy",
        "payment-plan-agreement"
      )
    );
  }

  if (!state.sale.price) {
    missingFields.push("sale price");
    blockers.push(
      block(
        "sale_price_missing",
        "Sale price must be set before preparing the Payment Plan Agreement.",
        "price",
        "payment-plan-agreement"
      )
    );
  }

  if (!state.financing.apr) {
    missingFields.push("apr");
    blockers.push(
      block(
        "financing_apr_missing",
        "APR is missing.",
        "apr",
        "payment-plan-agreement"
      )
    );
  }

  if (!state.financing.months) {
    missingFields.push("finance months");
    blockers.push(
      block(
        "financing_months_missing",
        "Payment term months are missing.",
        "months",
        "payment-plan-agreement"
      )
    );
  }

  if (!state.financing.monthlyPayment) {
    missingFields.push("monthly payment");
    blockers.push(
      block(
        "monthly_payment_missing",
        "Monthly payment is missing.",
        "monthlyPayment",
        "payment-plan-agreement"
      )
    );
  }

  if (doc.filed) {
    reasons.push("Payment Plan Agreement is already filed.");
  } else if (doc.signed) {
    reasons.push("Payment Plan Agreement is already signed.");
  } else if (doc.exists) {
    reasons.push("Payment Plan Agreement already exists.");
  } else {
    reasons.push("Payment Plan Agreement becomes ready when financing details are complete.");
  }

  const ready =
    !!state.buyer.exists && !!state.sale.price && !!state.financing.complete;

  return buildDocStatus(
    "payment-plan-agreement",
    required,
    blockers,
    warnings,
    missingFields,
    reasons,
    ready
  );
}

function evaluatePickupDeliveryConfirmation(
  state: ChiChiDealState
): ChiChiDocumentRuleStatus {
  const required =
    !!state.delivery.method || !!state.delivery.location || !!state.delivery.date;
  const blockers: ChiChiRuleMessage[] = [];
  const warnings: ChiChiRuleMessage[] = [];
  const missingFields: string[] = [];
  const reasons: string[] = [];
  const doc = mapStateDoc(state, "pickup-delivery-confirmation");

  if (!required) {
    reasons.push(
      "Pickup / Delivery Confirmation is not required yet because no delivery workflow has been detected."
    );
    return buildDocStatus(
      "pickup-delivery-confirmation",
      false,
      blockers,
      warnings,
      missingFields,
      reasons,
      false
    );
  }

  if (!state.buyer.exists) {
    missingFields.push("buyer");
    blockers.push(
      block(
        "buyer_missing",
        "Buyer must exist before preparing Pickup / Delivery Confirmation.",
        "buyer",
        "pickup-delivery-confirmation"
      )
    );
  }

  if (!state.delivery.method) {
    missingFields.push("delivery method");
    blockers.push(
      block(
        "delivery_method_missing",
        "Delivery method is missing.",
        "delivery.method",
        "pickup-delivery-confirmation"
      )
    );
  }

  if (!state.delivery.location) {
    missingFields.push("delivery location");
    blockers.push(
      block(
        "delivery_location_missing",
        "Delivery location is missing.",
        "delivery.location",
        "pickup-delivery-confirmation"
      )
    );
  }

  if (!state.delivery.date) {
    warnings.push(
      warn(
        "delivery_date_missing",
        "Delivery date is missing. ChiChi can still prepare a draft, but the handoff timing is incomplete.",
        "delivery.date",
        "pickup-delivery-confirmation"
      )
    );
  }

  if (doc.filed) {
    reasons.push("Pickup / Delivery Confirmation is already filed.");
  } else if (doc.signed) {
    reasons.push("Pickup / Delivery Confirmation is already signed.");
  } else if (doc.exists) {
    reasons.push("Pickup / Delivery Confirmation already exists.");
  } else {
    reasons.push("Pickup / Delivery Confirmation becomes ready when delivery details are complete.");
  }

  const ready =
    !!state.buyer.exists &&
    !!state.delivery.method &&
    !!state.delivery.location;

  return buildDocStatus(
    "pickup-delivery-confirmation",
    required,
    blockers,
    warnings,
    missingFields,
    reasons,
    ready
  );
}

function buildNextActions(
  state: ChiChiDealState,
  documents: Record<ChiChiDocumentRuleKey, ChiChiDocumentRuleStatus>
): ChiChiNextAction[] {
  const actions: ChiChiNextAction[] = [];

  if (!state.buyer.exists) {
    actions.push("collect_buyer");
    return uniqueActions(actions);
  }

  if (!state.puppy.assigned) {
    actions.push("assign_puppy");
  }

  if (!state.sale.price) {
    actions.push("set_sale_price");
  }

  if (!state.sale.depositAmount) {
    actions.push("collect_deposit");
  }

  if (
    documents["deposit-agreement"].required &&
    documents["deposit-agreement"].ready &&
    !state.documents.depositAgreement.signed &&
    !state.documents.depositAgreement.filed
  ) {
    actions.push("prepare_deposit_agreement");
  }

  if (
    documents["bill-of-sale"].required &&
    documents["bill-of-sale"].ready &&
    !state.documents.billOfSale.signed &&
    !state.documents.billOfSale.filed
  ) {
    actions.push("prepare_bill_of_sale");
  }

  if (
    documents["health-guarantee"].required &&
    documents["health-guarantee"].ready &&
    !state.documents.healthGuarantee.signed &&
    !state.documents.healthGuarantee.filed
  ) {
    actions.push("prepare_health_guarantee");
  }

  if (state.financing.enabled && !state.financing.complete) {
    actions.push("collect_financing_terms");
  }

  if (
    documents["payment-plan-agreement"].required &&
    documents["payment-plan-agreement"].ready &&
    !state.documents.paymentPlanAgreement.signed &&
    !state.documents.paymentPlanAgreement.filed
  ) {
    actions.push("prepare_payment_plan_agreement");
  }

  if (
    documents["pickup-delivery-confirmation"].required &&
    !state.delivery.complete
  ) {
    actions.push("collect_delivery_details");
  }

  if (
    documents["pickup-delivery-confirmation"].required &&
    documents["pickup-delivery-confirmation"].ready &&
    !state.documents.pickupDeliveryConfirmation.signed &&
    !state.documents.pickupDeliveryConfirmation.filed
  ) {
    actions.push("prepare_pickup_delivery_confirmation");
  }

  if (
    state.documents.depositAgreement.signed ||
    state.documents.billOfSale.signed ||
    state.documents.healthGuarantee.signed ||
    state.documents.paymentPlanAgreement.signed ||
    state.documents.pickupDeliveryConfirmation.signed
  ) {
    actions.push("review_signed_documents");
  }

  if (computeReleaseReady(state, documents)) {
    actions.push("release_ready");
  }

  if (!actions.length) {
    actions.push("manual_review");
  }

  return uniqueActions(actions);
}

function computeReleaseReady(
  state: ChiChiDealState,
  documents: Record<ChiChiDocumentRuleKey, ChiChiDocumentRuleStatus>
): boolean {
  const requiredDocsAreSatisfied = Object.values(documents)
    .filter((doc) => doc.required)
    .every((doc) => {
      const stateDoc = mapStateDoc(state, doc.documentKey);
      return stateDoc.filed || stateDoc.signed;
    });

  return (
    !!state.buyer.exists &&
    !!state.puppy.assigned &&
    !!state.sale.price &&
    requiredDocsAreSatisfied &&
    (!state.financing.enabled || state.financing.complete) &&
    (!documents["pickup-delivery-confirmation"].required ||
      state.delivery.complete)
  );
}

function mapStateDoc(state: ChiChiDealState, key: ChiChiDocumentRuleKey) {
  switch (key) {
    case "application":
      return state.documents.application;
    case "deposit-agreement":
      return state.documents.depositAgreement;
    case "bill-of-sale":
      return state.documents.billOfSale;
    case "health-guarantee":
      return state.documents.healthGuarantee;
    case "payment-plan-agreement":
      return state.documents.paymentPlanAgreement;
    case "pickup-delivery-confirmation":
      return state.documents.pickupDeliveryConfirmation;
  }
}

function buildSummary(
  documents: Record<ChiChiDocumentRuleKey, ChiChiDocumentRuleStatus>,
  nextActions: ChiChiNextAction[],
  releaseReady: boolean
) {
  const ready = Object.values(documents)
    .filter((doc) => doc.required && doc.ready && !doc.blocked)
    .map((doc) => doc.label);

  const blocked = Object.values(documents)
    .filter((doc) => doc.required && doc.blocked)
    .map((doc) => doc.label);

  if (releaseReady) {
    return "Deal is release-ready. Required documents and core requirements appear satisfied.";
  }

  if (blocked.length) {
    return `Blocked documents: ${blocked.join(", ")}. Next actions: ${nextActions.join(", ")}.`;
  }

  if (ready.length) {
    return `Ready documents: ${ready.join(", ")}. Next actions: ${nextActions.join(", ")}.`;
  }

  return `No required document is fully ready yet. Next actions: ${nextActions.join(", ")}.`;
}

function buildDocStatus(
  documentKey: ChiChiDocumentRuleKey,
  required: boolean,
  blockers: ChiChiRuleMessage[],
  warnings: ChiChiRuleMessage[],
  missingFields: string[],
  reasons: string[],
  ready: boolean
): ChiChiDocumentRuleStatus {
  return {
    documentKey,
    label: DOCUMENT_LABELS[documentKey],
    required,
    ready,
    blocked: blockers.length > 0,
    missingFields: uniqueStrings(missingFields),
    blockers,
    warnings,
    reasons: uniqueStrings(reasons),
  };
}

function block(
  code: string,
  message: string,
  field?: string,
  documentKey?: ChiChiDocumentRuleKey
): ChiChiRuleMessage {
  return {
    severity: "blocking",
    code,
    message,
    field,
    documentKey,
  };
}

function warn(
  code: string,
  message: string,
  field?: string,
  documentKey?: ChiChiDocumentRuleKey
): ChiChiRuleMessage {
  return {
    severity: "warning",
    code,
    message,
    field,
    documentKey,
  };
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function uniqueActions(values: ChiChiNextAction[]) {
  return Array.from(new Set(values));
}