import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ResolvedBreedingPuppy } from "@/lib/resolvers/breeding";
import type { ResolvedBuyer } from "@/lib/resolvers/buyers";
import {
  booleanValue,
  type ResolverResult,
  type ResolverSourceDefinition,
  compositeKey,
  createResolverDiagnostics,
  firstPresent,
  loadResolverSources,
  mergeResolvedRecord,
  normalizedText,
  numberValue,
  recordDedupe,
  sortByRecent,
  textValue,
  toResolverResult,
} from "@/lib/resolvers/_shared";

const TRANSACTION_SOURCES: ResolverSourceDefinition[] = [
  {
    table: "buyer_payments",
    classification: "canonical_base_record",
    evidence: "code",
    description: "Current buyer payment transaction table.",
    limit: 10000,
  },
  {
    table: "bp_payments",
    classification: "parallel_live_source",
    evidence: "runtime_candidate",
    description: "Legacy or breeding-program-specific payment table.",
    limit: 10000,
  },
  {
    table: "payments",
    classification: "parallel_live_source",
    evidence: "runtime_candidate",
    description: "Generic payment table that may still contain live rows.",
    limit: 10000,
  },
];

const ADJUSTMENT_SOURCES: ResolverSourceDefinition[] = [
  {
    table: "buyer_fee_credit_records",
    classification: "parallel_live_source",
    evidence: "migration",
    description: "Buyer fees, credits, and transportation adjustments.",
    limit: 10000,
  },
];

const LEDGER_SOURCES: ResolverSourceDefinition[] = [
  {
    table: "buyer_ledger",
    classification: "parallel_live_source",
    evidence: "runtime_candidate",
    description: "Buyer ledger/accounting source for ledger-style reconciliation.",
    limit: 10000,
  },
  {
    table: "core_financial_ledger",
    classification: "core_overlay_orchestration",
    evidence: "runtime_candidate",
    description: "Core financial ledger overlay used as accounting truth support.",
    limit: 10000,
  },
];

const POSITION_SOURCES: ResolverSourceDefinition[] = [
  {
    table: "core_financial_positions",
    classification: "derived_support_view",
    evidence: "runtime_candidate",
    description: "Derived financial positions and balances. Support only.",
    limit: 5000,
  },
];

const PLAN_SOURCES: ResolverSourceDefinition[] = [
  {
    table: "core_financing_plans",
    classification: "core_overlay_orchestration",
    evidence: "runtime_candidate",
    description: "Core financing plan records.",
    limit: 5000,
  },
  {
    table: "core_financing_installments",
    classification: "core_overlay_orchestration",
    evidence: "runtime_candidate",
    description: "Core financing installment schedule records.",
    limit: 10000,
  },
];

const NOTICE_SOURCES: ResolverSourceDefinition[] = [
  {
    table: "buyer_payment_notice_logs",
    classification: "parallel_live_source",
    evidence: "migration",
    description: "Current payment notice log table.",
    limit: 5000,
  },
  {
    table: "buyer_payment_notices_logs",
    classification: "parallel_live_source",
    evidence: "runtime_candidate",
    description: "Legacy payment notice log table with pluralized name drift.",
    limit: 5000,
  },
  {
    table: "buyer_payment_notice_settings",
    classification: "parallel_live_source",
    evidence: "migration",
    description: "Payment notice settings per buyer.",
    limit: 5000,
  },
];

const BILLING_SOURCES: ResolverSourceDefinition[] = [
  {
    table: "buyer_billing_subscriptions",
    classification: "parallel_live_source",
    evidence: "migration",
    description: "Buyer subscription and recurring billing records.",
    limit: 5000,
  },
];

export type ResolvedPaymentEvent = {
  id: string;
  sourceTable: string;
  buyerId: number | null;
  puppyId: number | null;
  eventType: string;
  amount: number;
  eventDate: string | null;
  status: string | null;
  method: string | null;
  notes: string | null;
  referenceNumber: string | null;
  balanceEffect: number;
};

export type ResolvedPaymentNotice = {
  id: string;
  sourceTable: string;
  buyerId: number | null;
  puppyId: number | null;
  noticeKind: string | null;
  noticeDate: string | null;
  createdAt: string | null;
  status: string | null;
  recipientEmail: string | null;
  subject: string | null;
  provider: string | null;
};

export type ResolvedPaymentNoticeSettings = {
  sourceTable: string;
  buyerId: number | null;
  enabled: boolean | null;
  receiptEnabled: boolean | null;
  dueReminderEnabled: boolean | null;
  dueReminderDaysBefore: number | null;
  lateNoticeEnabled: boolean | null;
  lateNoticeDaysAfter: number | null;
  defaultNoticeEnabled: boolean | null;
  defaultNoticeDaysAfter: number | null;
  recipientEmail: string | null;
};

export type ResolvedFinancingPlan = {
  id: string;
  sourceTable: string;
  buyerId: number | null;
  puppyId: number | null;
  status: string | null;
  monthlyAmount: number | null;
  financeMonths: number | null;
  nextDueDate: string | null;
  recurringPrice: number | null;
  intervalUnit: string | null;
  billingCycles: number | null;
};

export type ResolvedFinancialPosition = {
  id: string;
  sourceTable: string;
  buyerId: number | null;
  puppyId: number | null;
  status: string | null;
  remainingBalance: number | null;
  overdueAmount: number | null;
  nextDueDate: string | null;
  lastPaymentAt: string | null;
};

export type ResolvedBillingSubscription = {
  id: string;
  sourceTable: string;
  buyerId: number | null;
  puppyId: number | null;
  status: string | null;
  planName: string | null;
  recurringPrice: number | null;
  nextBillingAt: string | null;
  lastPaymentAt: string | null;
  lastPaymentAmount: number | null;
  cardLastFour: string | null;
};

export type ResolvedBuyerFinancial = {
  buyerId: number | null;
  buyerResolverKey: string | null;
  linkedPuppyId: number | null;
  salePrice: number | null;
  depositPaid: number;
  totalPaid: number;
  creditsApplied: number;
  feesApplied: number;
  balanceRemaining: number;
  nextDueDate: string | null;
  overdueAmount: number;
  planStatus: string | null;
  lastPaymentAt: string | null;
  lastNoticeAt: string | null;
  paymentEvents: ResolvedPaymentEvent[];
  notices: ResolvedPaymentNotice[];
  noticeSettings: ResolvedPaymentNoticeSettings | null;
  financingPlans: ResolvedFinancingPlan[];
  positions: ResolvedFinancialPosition[];
  billingSubscriptions: ResolvedBillingSubscription[];
  buyer: ResolvedBuyer | null;
  puppy: ResolvedBreedingPuppy | null;
};

export type ResolvedPaymentsWorkspace = {
  resolvedPaymentEvents: ResolvedPaymentEvent[];
  resolvedBuyerFinancials: ResolvedBuyerFinancial[];
  resolvedPaymentNotices: ResolvedPaymentNotice[];
  resolvedFinancingPlans: ResolvedFinancingPlan[];
};

type ResolvePaymentOptions = {
  buyers?: ResolvedBuyer[];
  puppies?: ResolvedBreedingPuppy[];
};

function eventTypeForLedger(row: Record<string, unknown>) {
  const normalized = normalizedText(
    firstPresent(
      textValue(row, "event_type"),
      textValue(row, "entry_type"),
      textValue(row, "type"),
      textValue(row, "payment_type")
    )
  );

  if (!normalized) return "adjustment";
  if (normalized.includes("payment")) return "payment";
  if (normalized.includes("credit")) return "credit";
  if (normalized.includes("refund")) return "refund";
  if (normalized.includes("transport")) return "transportation_fee";
  if (normalized.includes("fee") || normalized.includes("charge")) return "fee";
  return normalized;
}

function balanceEffectForEvent(
  eventType: string,
  amount: number,
  row: Record<string, unknown>
): number {
  const explicitDelta =
    firstPresent(
      numberValue(row, "balance_effect"),
      numberValue(row, "balance_delta"),
      numberValue(row, "amount_delta"),
      numberValue(row, "delta_amount")
    ) ?? null;
  if (explicitDelta !== null) return explicitDelta;

  const normalized = normalizedText(eventType);
  if (normalized.includes("payment") || normalized.includes("credit")) return -Math.abs(amount);
  if (normalized.includes("refund")) return Math.abs(amount);
  if (normalized.includes("fee") || normalized.includes("charge") || normalized.includes("transport")) {
    return Math.abs(amount);
  }
  return amount;
}

function normalizeTransactionEvent(
  sourceTable: string,
  row: Record<string, unknown>
): ResolvedPaymentEvent | null {
  const amount = numberValue(row, "amount");
  if (amount === null) return null;

  const buyerId = numberValue(row, "buyer_id");
  const puppyId = numberValue(row, "puppy_id");
  const eventDate = firstPresent(
    textValue(row, "payment_date"),
    textValue(row, "event_date"),
    textValue(row, "entry_date"),
    textValue(row, "created_at")
  );
  const eventType = sourceTable === "buyer_fee_credit_records" ? eventTypeForLedger(row) : "payment";
  const id =
    textValue(row, "id") ||
    compositeKey(sourceTable, buyerId, puppyId, amount, eventDate, textValue(row, "method")) ||
    sourceTable;

  return {
    id: `${sourceTable}:${id}`,
    sourceTable,
    buyerId,
    puppyId,
    eventType,
    amount: Math.abs(amount),
    eventDate: eventDate ?? null,
    status: textValue(row, "status"),
    method: textValue(row, "method"),
    notes:
      firstPresent(textValue(row, "note"), textValue(row, "description"), textValue(row, "label")) ??
      null,
    referenceNumber: textValue(row, "reference_number"),
    balanceEffect:
      sourceTable === "buyer_fee_credit_records"
        ? balanceEffectForEvent(eventType, amount, row)
        : -Math.abs(amount),
  };
}

function normalizeLedgerEvent(
  sourceTable: string,
  row: Record<string, unknown>
): ResolvedPaymentEvent | null {
  const amount =
    firstPresent(
      numberValue(row, "amount"),
      numberValue(row, "gross_amount"),
      numberValue(row, "net_amount"),
      numberValue(row, "value")
    ) || 0;

  const buyerId = numberValue(row, "buyer_id");
  const puppyId = numberValue(row, "puppy_id");
  if (buyerId === null && puppyId === null) return null;

  const eventType = eventTypeForLedger(row);
  const eventDate = firstPresent(
    textValue(row, "event_date"),
    textValue(row, "effective_date"),
    textValue(row, "posted_at"),
    textValue(row, "created_at")
  );
  const id =
    textValue(row, "id") ||
    compositeKey(sourceTable, buyerId, puppyId, amount, eventDate, eventType) ||
    sourceTable;

  return {
    id: `${sourceTable}:${id}`,
    sourceTable,
    buyerId,
    puppyId,
    eventType,
    amount: Math.abs(amount),
    eventDate: eventDate ?? null,
    status: textValue(row, "status"),
    method: textValue(row, "method"),
    notes:
      firstPresent(textValue(row, "note"), textValue(row, "description"), textValue(row, "label")) ??
      null,
    referenceNumber: textValue(row, "reference_number"),
    balanceEffect: balanceEffectForEvent(eventType, amount, row),
  };
}

function normalizeNotice(
  sourceTable: string,
  row: Record<string, unknown>
): ResolvedPaymentNotice | null {
  if (sourceTable === "buyer_payment_notice_settings") return null;
  const id =
    textValue(row, "id") ||
    compositeKey(sourceTable, numberValue(row, "buyer_id"), textValue(row, "notice_key"), textValue(row, "created_at")) ||
    sourceTable;
  return {
    id: `${sourceTable}:${id}`,
    sourceTable,
    buyerId: numberValue(row, "buyer_id"),
    puppyId: numberValue(row, "puppy_id"),
    noticeKind: firstPresent(textValue(row, "notice_kind"), textValue(row, "kind")) ?? null,
    noticeDate: firstPresent(textValue(row, "notice_date"), textValue(row, "due_date")) ?? null,
    createdAt: textValue(row, "created_at"),
    status: textValue(row, "status"),
    recipientEmail: textValue(row, "recipient_email"),
    subject: textValue(row, "subject"),
    provider: textValue(row, "provider"),
  };
}

function normalizeNoticeSettings(
  sourceTable: string,
  row: Record<string, unknown>
): ResolvedPaymentNoticeSettings {
  return {
    sourceTable,
    buyerId: numberValue(row, "buyer_id"),
    enabled: booleanValue(row, "enabled"),
    receiptEnabled: booleanValue(row, "receipt_enabled"),
    dueReminderEnabled: booleanValue(row, "due_reminder_enabled"),
    dueReminderDaysBefore: numberValue(row, "due_reminder_days_before"),
    lateNoticeEnabled: booleanValue(row, "late_notice_enabled"),
    lateNoticeDaysAfter: numberValue(row, "late_notice_days_after"),
    defaultNoticeEnabled: booleanValue(row, "default_notice_enabled"),
    defaultNoticeDaysAfter: numberValue(row, "default_notice_days_after"),
    recipientEmail: textValue(row, "recipient_email"),
  };
}

function normalizePlan(sourceTable: string, row: Record<string, unknown>): ResolvedFinancingPlan {
  const id =
    textValue(row, "id") ||
    compositeKey(sourceTable, numberValue(row, "buyer_id"), numberValue(row, "puppy_id")) ||
    sourceTable;
  return {
    id: `${sourceTable}:${id}`,
    sourceTable,
    buyerId: numberValue(row, "buyer_id"),
    puppyId: numberValue(row, "puppy_id"),
    status: textValue(row, "status"),
    monthlyAmount:
      firstPresent(
        numberValue(row, "monthly_amount"),
        numberValue(row, "installment_amount"),
        numberValue(row, "payment_amount")
      ) ?? null,
    financeMonths:
      firstPresent(
        numberValue(row, "finance_months"),
        numberValue(row, "term_months"),
        numberValue(row, "installment_count")
      ) ?? null,
    nextDueDate: firstPresent(textValue(row, "next_due_date"), textValue(row, "due_date")) ?? null,
    recurringPrice:
      firstPresent(numberValue(row, "recurring_price"), numberValue(row, "amount")) ?? null,
    intervalUnit: firstPresent(textValue(row, "interval_unit"), textValue(row, "frequency")) ?? null,
    billingCycles: firstPresent(numberValue(row, "billing_cycles"), numberValue(row, "cycles")) ?? null,
  };
}

function normalizePosition(
  sourceTable: string,
  row: Record<string, unknown>
): ResolvedFinancialPosition {
  const id =
    textValue(row, "id") ||
    compositeKey(sourceTable, numberValue(row, "buyer_id"), numberValue(row, "puppy_id")) ||
    sourceTable;
  return {
    id: `${sourceTable}:${id}`,
    sourceTable,
    buyerId: numberValue(row, "buyer_id"),
    puppyId: numberValue(row, "puppy_id"),
    status: firstPresent(textValue(row, "status"), textValue(row, "position_status")) ?? null,
    remainingBalance:
      firstPresent(
        numberValue(row, "remaining_balance"),
        numberValue(row, "balance_remaining"),
        numberValue(row, "current_balance"),
        numberValue(row, "balance_due")
      ) ?? null,
    overdueAmount:
      firstPresent(numberValue(row, "overdue_amount"), numberValue(row, "past_due_amount")) ??
      null,
    nextDueDate: firstPresent(textValue(row, "next_due_date"), textValue(row, "due_date")) ?? null,
    lastPaymentAt: textValue(row, "last_payment_at"),
  };
}

function normalizeBillingSubscription(
  sourceTable: string,
  row: Record<string, unknown>
): ResolvedBillingSubscription {
  const id =
    textValue(row, "id") ||
    compositeKey(sourceTable, numberValue(row, "buyer_id"), textValue(row, "subscription_id")) ||
    sourceTable;
  return {
    id: `${sourceTable}:${id}`,
    sourceTable,
    buyerId: numberValue(row, "buyer_id"),
    puppyId: numberValue(row, "puppy_id"),
    status: firstPresent(textValue(row, "subscription_status"), textValue(row, "status")) ?? null,
    planName: firstPresent(textValue(row, "plan_name"), textValue(row, "plan_code")) ?? null,
    recurringPrice:
      firstPresent(numberValue(row, "recurring_price"), numberValue(row, "amount")) ?? null,
    nextBillingAt: textValue(row, "next_billing_at"),
    lastPaymentAt: textValue(row, "last_payment_at"),
    lastPaymentAmount: numberValue(row, "last_payment_amount"),
    cardLastFour: textValue(row, "card_last_four"),
  };
}

function eventSignature(event: ResolvedPaymentEvent) {
  return compositeKey(
    event.buyerId,
    event.puppyId,
    event.eventType,
    event.amount,
    event.eventDate,
    event.method,
    event.referenceNumber
  );
}

function groupByBuyerId<T extends { buyerId: number | null }>(rows: T[]) {
  const groups = new Map<number, T[]>();
  rows.forEach((row) => {
    if (row.buyerId === null) return;
    const existing = groups.get(row.buyerId);
    if (existing) {
      existing.push(row);
      return;
    }
    groups.set(row.buyerId, [row]);
  });
  return groups;
}

function firstPuppyIdFromEvents(events: ResolvedPaymentEvent[]) {
  return events.find((event) => event.puppyId !== null)?.puppyId ?? null;
}

async function resolvePaymentState(
  service: SupabaseClient,
  options: ResolvePaymentOptions = {}
) {
  const [transactionSources, adjustmentSources, ledgerSources, positionSources, planSources, noticeSources, billingSources] =
    await Promise.all([
      loadResolverSources(service, TRANSACTION_SOURCES),
      loadResolverSources(service, ADJUSTMENT_SOURCES),
      loadResolverSources(service, LEDGER_SOURCES),
      loadResolverSources(service, POSITION_SOURCES),
      loadResolverSources(service, PLAN_SOURCES),
      loadResolverSources(service, NOTICE_SOURCES),
      loadResolverSources(service, BILLING_SOURCES),
    ]);

  const diagnostics = createResolverDiagnostics("payments", [
    ...transactionSources,
    ...adjustmentSources,
    ...ledgerSources,
    ...positionSources,
    ...planSources,
    ...noticeSources,
    ...billingSources,
  ]);

  const eventsByKey = new Map<string, ResolvedPaymentEvent>();

  [...transactionSources, ...adjustmentSources].forEach((source) => {
    source.rows.forEach((row) => {
      const event = normalizeTransactionEvent(source.table, row);
      if (!event) return;

      const mergeKey =
        textValue(row, "id") && event.buyerId !== null
          ? `id:${textValue(row, "id")}`
          : `signature:${eventSignature(event)}`;
      const existing = eventsByKey.get(mergeKey);
      if (!existing) {
        eventsByKey.set(mergeKey, event);
        return;
      }

      eventsByKey.set(
        mergeKey,
        mergeResolvedRecord(
          existing,
          event,
          diagnostics,
          `payment event ${mergeKey}`,
          ["status", "method", "notes", "referenceNumber"]
        )
      );
      recordDedupe(diagnostics);
    });
  });

  ledgerSources.forEach((source) => {
    source.rows.forEach((row) => {
      const event = normalizeLedgerEvent(source.table, row);
      if (!event) return;
      const mergeKey =
        textValue(row, "id") && event.buyerId !== null
          ? `id:${textValue(row, "id")}`
          : `signature:${eventSignature(event)}`;
      const existing = eventsByKey.get(mergeKey);
      if (!existing) {
        eventsByKey.set(mergeKey, event);
        return;
      }
      eventsByKey.set(
        mergeKey,
        mergeResolvedRecord(
          existing,
          event,
          diagnostics,
          `ledger event ${mergeKey}`,
          ["status", "method", "notes", "referenceNumber"]
        )
      );
      recordDedupe(diagnostics);
    });
  });

  const notices = noticeSources
    .filter((source) => source.table !== "buyer_payment_notice_settings")
    .flatMap((source) => source.rows.map((row) => normalizeNotice(source.table, row)).filter(Boolean)) as ResolvedPaymentNotice[];
  const noticeSettings = noticeSources
    .filter((source) => source.table === "buyer_payment_notice_settings")
    .flatMap((source) => source.rows.map((row) => normalizeNoticeSettings(source.table, row)));
  const positions = positionSources.flatMap((source) =>
    source.rows.map((row) => normalizePosition(source.table, row))
  );
  const plans = planSources.flatMap((source) =>
    source.rows.map((row) => normalizePlan(source.table, row))
  );
  const billingSubscriptions = billingSources.flatMap((source) =>
    source.rows.map((row) => normalizeBillingSubscription(source.table, row))
  );

  const events = sortByRecent(Array.from(eventsByKey.values()), "eventDate");
  const sortedNotices = sortByRecent(notices, "createdAt", "noticeDate");
  const sortedPositions = sortByRecent(positions, "lastPaymentAt", "nextDueDate");
  const sortedPlans = sortByRecent(plans, "nextDueDate");
  const sortedBillingSubscriptions = sortByRecent(
    billingSubscriptions,
    "lastPaymentAt",
    "nextBillingAt"
  );

  const buyerById = new Map<number, ResolvedBuyer>();
  (options.buyers || []).forEach((buyer) => {
    if (buyer.id === null || buyerById.has(buyer.id)) return;
    buyerById.set(buyer.id, buyer);
  });

  const puppyById = new Map<number, ResolvedBreedingPuppy>();
  const firstPuppyByBuyerId = new Map<number, ResolvedBreedingPuppy>();
  (options.puppies || []).forEach((puppy) => {
    if (puppy.id !== null && !puppyById.has(puppy.id)) {
      puppyById.set(puppy.id, puppy);
    }
    if (puppy.buyerId !== null && !firstPuppyByBuyerId.has(puppy.buyerId)) {
      firstPuppyByBuyerId.set(puppy.buyerId, puppy);
    }
  });

  const eventsByBuyerId = groupByBuyerId(events);
  const noticesByBuyerId = groupByBuyerId(sortedNotices);
  const positionsByBuyerId = groupByBuyerId(sortedPositions);
  const plansByBuyerId = groupByBuyerId(sortedPlans);
  const billingSubscriptionsByBuyerId = groupByBuyerId(sortedBillingSubscriptions);
  const noticeSettingsByBuyerId = new Map<number, ResolvedPaymentNoticeSettings>();
  noticeSettings.forEach((settings) => {
    if (settings.buyerId === null || noticeSettingsByBuyerId.has(settings.buyerId)) return;
    noticeSettingsByBuyerId.set(settings.buyerId, settings);
  });

  const buyerIds = new Set<number>();

  events.forEach((event) => {
    if (event.buyerId !== null) buyerIds.add(event.buyerId);
  });
  notices.forEach((notice) => {
    if (notice.buyerId !== null) buyerIds.add(notice.buyerId);
  });
  noticeSettings.forEach((settings) => {
    if (settings.buyerId !== null) buyerIds.add(settings.buyerId);
  });
  positions.forEach((position) => {
    if (position.buyerId !== null) buyerIds.add(position.buyerId);
  });
  plans.forEach((plan) => {
    if (plan.buyerId !== null) buyerIds.add(plan.buyerId);
  });
  billingSubscriptions.forEach((subscription) => {
    if (subscription.buyerId !== null) buyerIds.add(subscription.buyerId);
  });
  (options.buyers || []).forEach((buyer) => {
    if (buyer.id !== null) buyerIds.add(buyer.id);
  });

  const resolvedBuyerFinancials = Array.from(buyerIds)
    .map((buyerId) => {
      const buyer = buyerById.get(buyerId) || null;
      const eventsForBuyer = eventsByBuyerId.get(buyerId) || [];
      const noticesForBuyer = noticesByBuyerId.get(buyerId) || [];
      const noticeSetting = noticeSettingsByBuyerId.get(buyerId) || null;
      const plansForBuyer = plansByBuyerId.get(buyerId) || [];
      const positionsForBuyer = positionsByBuyerId.get(buyerId) || [];
      const subscriptionsForBuyer = billingSubscriptionsByBuyerId.get(buyerId) || [];
      const primaryPuppyId =
        buyer?.linkedPuppyId ??
        firstPuppyIdFromEvents(eventsForBuyer) ??
        plansForBuyer.find((plan) => plan.puppyId !== null)?.puppyId ??
        subscriptionsForBuyer.find((subscription) => subscription.puppyId !== null)?.puppyId ??
        firstPuppyByBuyerId.get(buyerId)?.id ??
        null;
      const puppy =
        (primaryPuppyId !== null ? puppyById.get(primaryPuppyId) || null : null) ||
        firstPuppyByBuyerId.get(buyerId) ||
        null;

      const salePrice = firstPresent(buyer?.salePrice, puppy?.price, puppy?.listPrice) || 0;
      const depositPaidBase = firstPresent(buyer?.depositAmount, puppy?.deposit) || 0;
      const totalPaid = eventsForBuyer
        .filter((event) => event.balanceEffect < 0 && event.eventType === "payment")
        .reduce((sum, event) => sum + Math.abs(event.amount), 0);
      const creditsApplied = eventsForBuyer
        .filter((event) => event.balanceEffect < 0 && event.eventType !== "payment")
        .reduce((sum, event) => sum + Math.abs(event.amount), 0);
      const feesApplied = eventsForBuyer
        .filter((event) => event.balanceEffect > 0)
        .reduce((sum, event) => sum + Math.abs(event.amount), 0);

      const financeEnabled = Boolean(buyer?.financeEnabled);
      const financeMonths = firstPresent(
        buyer?.financeMonths,
        plansForBuyer[0]?.financeMonths
      );
      const monthlyAmount = firstPresent(
        buyer?.financeMonthlyAmount,
        plansForBuyer[0]?.monthlyAmount
      );
      const principal = Math.max(0, Number(salePrice || 0) - Number(depositPaidBase || 0));
      const financedTotal =
        financeEnabled && financeMonths !== null && monthlyAmount !== null
          ? Math.max(principal, Number(financeMonths) * Number(monthlyAmount))
          : principal;
      const computedBalance = Math.max(
        0,
        financedTotal + feesApplied - (totalPaid + creditsApplied)
      );

      const positionRemaining = firstPresent(
        positionsForBuyer[0]?.remainingBalance,
        null
      );
      const balanceRemaining = Math.max(
        0,
        Number(positionRemaining !== null ? positionRemaining : computedBalance)
      );
      const nextDueDate =
        positionsForBuyer[0]?.nextDueDate ||
        plansForBuyer[0]?.nextDueDate ||
        buyer?.financeNextDueDate ||
        null;
      const overdueAmount = Math.max(
        0,
        Number(
          firstPresent(positionsForBuyer[0]?.overdueAmount, null) ??
            (nextDueDate &&
            balanceRemaining > 0 &&
            new Date(nextDueDate).getTime() < Date.now()
              ? balanceRemaining
              : 0)
        )
      );
      const lastPaymentAt =
        firstPresent(
          eventsForBuyer.find((event) => event.eventType === "payment")?.eventDate,
          positionsForBuyer[0]?.lastPaymentAt,
          buyer?.financeLastPaymentDate,
          subscriptionsForBuyer[0]?.lastPaymentAt
        ) || null;
      const lastNoticeAt = noticesForBuyer[0]?.createdAt || null;
      const planStatus =
        positionsForBuyer[0]?.status ||
        plansForBuyer[0]?.status ||
        (balanceRemaining <= 0
          ? "completed"
          : overdueAmount > 0
            ? "overdue"
            : financeEnabled
              ? "current"
              : "balance_due");

      return {
        buyerId,
        buyerResolverKey: buyer?.resolver_key || `id:${buyerId}`,
        linkedPuppyId: primaryPuppyId,
        salePrice,
        depositPaid: Number(depositPaidBase || 0),
        totalPaid,
        creditsApplied,
        feesApplied,
        balanceRemaining,
        nextDueDate,
        overdueAmount,
        planStatus,
        lastPaymentAt,
        lastNoticeAt,
        paymentEvents: eventsForBuyer,
        notices: noticesForBuyer,
        noticeSettings: noticeSetting,
        financingPlans: plansForBuyer,
        positions: positionsForBuyer,
        billingSubscriptions: subscriptionsForBuyer,
        buyer: buyer || null,
        puppy: puppy || null,
      } as ResolvedBuyerFinancial;
    })
    .sort((left, right) => {
      const leftName = String(left.buyer?.fullName || left.buyer?.email || left.buyerResolverKey);
      const rightName = String(right.buyer?.fullName || right.buyer?.email || right.buyerResolverKey);
      return leftName.localeCompare(rightName);
    });

  return toResolverResult<ResolvedPaymentsWorkspace>(
    {
      resolvedPaymentEvents: events,
      resolvedBuyerFinancials,
      resolvedPaymentNotices: notices,
      resolvedFinancingPlans: plans,
    },
    diagnostics
  );
}

export async function resolvePayments(
  service: SupabaseClient,
  options: ResolvePaymentOptions = {}
): Promise<ResolverResult<ResolvedPaymentsWorkspace>> {
  return resolvePaymentState(service, options);
}

export async function resolveBuyerFinancials(
  service: SupabaseClient,
  buyerId: number,
  options: ResolvePaymentOptions = {}
): Promise<ResolverResult<ResolvedBuyerFinancial | null>> {
  const resolved = await resolvePaymentState(service, options);
  return {
    data:
      resolved.data.resolvedBuyerFinancials.find((item) => item.buyerId === buyerId) || null,
    diagnostics: resolved.diagnostics,
  };
}

export async function resolvePaymentNotices(
  service: SupabaseClient,
  options: ResolvePaymentOptions = {}
): Promise<ResolverResult<ResolvedPaymentNotice[]>> {
  const resolved = await resolvePaymentState(service, options);
  return {
    data: resolved.data.resolvedPaymentNotices,
    diagnostics: resolved.diagnostics,
  };
}

export async function resolveFinancingPlans(
  service: SupabaseClient,
  options: ResolvePaymentOptions = {}
): Promise<ResolverResult<ResolvedFinancingPlan[]>> {
  const resolved = await resolvePaymentState(service, options);
  return {
    data: resolved.data.resolvedFinancingPlans,
    diagnostics: resolved.diagnostics,
  };
}
