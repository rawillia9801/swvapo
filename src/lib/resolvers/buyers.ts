import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  booleanValue,
  type ResolverResult,
  type ResolverSourceDefinition,
  compositeKey,
  createResolverDiagnostics,
  firstPresent,
  hasValue,
  loadResolverSources,
  mergeResolvedRecord,
  normalizeEmail,
  normalizePhone,
  normalizedText,
  numberValue,
  recordDedupe,
  sortByRecent,
  textValue,
  toResolverResult,
} from "@/lib/resolvers/_shared";

const BASE_SOURCE_DEFINITIONS: ResolverSourceDefinition[] = [
  {
    table: "buyers",
    classification: "canonical_base_record",
    evidence: "code",
    description: "Primary buyer identity records used by current admin and portal flows.",
  },
  {
    table: "bp_buyers",
    classification: "parallel_live_source",
    evidence: "runtime_candidate",
    description: "Parallel breeding-program buyer records that may still hold live rows.",
  },
  {
    table: "core_buyers",
    classification: "core_overlay_orchestration",
    evidence: "runtime_candidate",
    description: "Core overlay for buyer status and orchestration state.",
  },
];

const APPLICATION_SOURCE_DEFINITIONS: ResolverSourceDefinition[] = [
  {
    table: "puppy_applications",
    classification: "parallel_live_source",
    evidence: "code",
    description: "Primary intake source for puppy applications.",
  },
  {
    table: "applications",
    classification: "parallel_live_source",
    evidence: "runtime_candidate",
    description: "Legacy or alternate application intake source.",
  },
];

const RESERVATION_SOURCE_DEFINITIONS: ResolverSourceDefinition[] = [
  {
    table: "reservations",
    classification: "parallel_live_source",
    evidence: "runtime_candidate",
    description: "Reservation records that may represent deposit or hold state.",
  },
  {
    table: "core_reservations",
    classification: "core_overlay_orchestration",
    evidence: "runtime_candidate",
    description: "Core reservation overlay. Enrichment only.",
  },
  {
    table: "bp_waitlist",
    classification: "parallel_live_source",
    evidence: "runtime_candidate",
    description: "Waitlist or reservation-adjacent source for buyer pipeline state.",
  },
];

const LEAD_SOURCE_DEFINITIONS: ResolverSourceDefinition[] = [
  {
    table: "crm_leads",
    classification: "parallel_live_source",
    evidence: "code",
    description: "CRM lead pipeline records currently used by the dashboard.",
  },
  {
    table: "crm_active_leads",
    classification: "derived_support_view",
    evidence: "runtime_candidate",
    description: "CRM lead projection or active-lead view.",
  },
];

const FOLLOW_UP_SOURCE_DEFINITIONS: ResolverSourceDefinition[] = [
  {
    table: "crm_followups",
    classification: "parallel_live_source",
    evidence: "code",
    description: "CRM follow-up records used for next action visibility.",
  },
  {
    table: "crm_open_followups",
    classification: "derived_support_view",
    evidence: "runtime_candidate",
    description: "Derived open-follow-up view.",
  },
];

export type ResolvedBuyerApplication = {
  id: number | null;
  sourceTable: string;
  status: string | null;
  createdAt: string | null;
  linkedPuppyId: number | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

export type ResolvedBuyerReservation = {
  id: number | null;
  sourceTable: string;
  status: string | null;
  createdAt: string | null;
  linkedPuppyId: number | null;
  notes: string | null;
};

export type ResolvedBuyerLead = {
  id: string;
  sourceTable: string;
  status: string | null;
  createdAt: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

export type ResolvedBuyerFollowUp = {
  id: string;
  sourceTable: string;
  status: string | null;
  createdAt: string | null;
  dueAt: string | null;
  notes: string | null;
};

export type ResolvedBuyer = {
  id: number | null;
  resolver_key: string;
  sourceTable: string;
  sourceTables: string[];
  fullName: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  buyerStage: string | null;
  linkedPuppyId: number | null;
  reservationId: number | null;
  applicationId: number | null;
  notes: string | null;
  createdAt: string | null;
  userId: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  state: string | null;
  salePrice: number | null;
  depositAmount: number | null;
  financeEnabled: boolean | null;
  financeAdminFee: boolean | null;
  financeRate: number | null;
  financeMonths: number | null;
  financeMonthlyAmount: number | null;
  financeDayOfMonth: number | null;
  financeNextDueDate: string | null;
  financeLastPaymentDate: string | null;
  deliveryOption: string | null;
  deliveryDate: string | null;
  deliveryLocation: string | null;
  deliveryMiles: number | null;
  deliveryFee: number | null;
  expenseGas: number | null;
  expenseHotel: number | null;
  expenseTolls: number | null;
  expenseMisc: string | null;
  applications: ResolvedBuyerApplication[];
  reservations: ResolvedBuyerReservation[];
  leads: ResolvedBuyerLead[];
  followUps: ResolvedBuyerFollowUp[];
  overlay: Record<string, unknown> | null;
};

export type ResolvedBuyerJourney = {
  buyerId: number | null;
  buyerResolverKey: string;
  applicationStatus: string | null;
  reservationStatus: string | null;
  depositStatus: string | null;
  contractStatus: string | null;
  paymentStatus: string | null;
  deliveryStatus: string | null;
  followupState: string | null;
};

type ResolvedBuyerState = {
  resolvedBuyers: ResolvedBuyer[];
  resolvedBuyerJourney: ResolvedBuyerJourney[];
};

function buyerResolverKey(table: string, row: Record<string, unknown>) {
  const userId = textValue(row, "user_id");
  if (userId) return `user:${userId}`;

  const email = normalizeEmail(firstPresent(textValue(row, "email"), textValue(row, "user_email")));
  if (email) return `email:${email}`;

  const phone = normalizePhone(textValue(row, "phone"));
  if (phone) return `phone:${phone}`;

  const numericId = numberValue(row, "id");
  if (numericId !== null) return `id:${numericId}`;

  const nameStateKey = compositeKey(
    textValue(row, "full_name"),
    textValue(row, "name"),
    textValue(row, "city"),
    textValue(row, "state"),
    textValue(row, "city_state")
  );
  if (nameStateKey) return `name:${nameStateKey}`;

  return `source:${table}:${compositeKey(textValue(row, "created_at"), textValue(row, "updated_at"), textValue(row, "status"))}`;
}

function normalizeApplication(sourceTable: string, row: Record<string, unknown>): ResolvedBuyerApplication {
  return {
    id: numberValue(row, "id"),
    sourceTable,
    status: textValue(row, "status"),
    createdAt: firstPresent(textValue(row, "updated_at"), textValue(row, "created_at")) ?? null,
    linkedPuppyId:
      firstPresent(
      numberValue(row, "assigned_puppy_id"),
      numberValue(row, "puppy_id")
      ) ?? null,
    fullName: firstPresent(textValue(row, "full_name"), textValue(row, "name")) ?? null,
    email: firstPresent(textValue(row, "email"), textValue(row, "applicant_email")) ?? null,
    phone: textValue(row, "phone"),
    notes: firstPresent(textValue(row, "admin_notes"), textValue(row, "notes")) ?? null,
  };
}

function normalizeReservation(
  sourceTable: string,
  row: Record<string, unknown>
): ResolvedBuyerReservation {
  return {
    id: numberValue(row, "id"),
    sourceTable,
    status: textValue(row, "status"),
    createdAt: firstPresent(textValue(row, "updated_at"), textValue(row, "created_at")) ?? null,
    linkedPuppyId:
      firstPresent(numberValue(row, "puppy_id"), numberValue(row, "reserved_puppy_id")) ?? null,
    notes: firstPresent(textValue(row, "notes"), textValue(row, "description")) ?? null,
  };
}

function normalizeLead(sourceTable: string, row: Record<string, unknown>): ResolvedBuyerLead {
  return {
    id: `${sourceTable}:${textValue(row, "id") || compositeKey(textValue(row, "email"), textValue(row, "phone"), textValue(row, "created_at"))}`,
    sourceTable,
    status: firstPresent(textValue(row, "lead_status"), textValue(row, "status")) ?? null,
    createdAt: firstPresent(textValue(row, "updated_at"), textValue(row, "created_at")) ?? null,
    email: textValue(row, "email"),
    phone: textValue(row, "phone"),
    notes: firstPresent(textValue(row, "summary"), textValue(row, "notes")) ?? null,
  };
}

function normalizeFollowUp(
  sourceTable: string,
  row: Record<string, unknown>
): ResolvedBuyerFollowUp {
  return {
    id: `${sourceTable}:${textValue(row, "id") || compositeKey(textValue(row, "buyer_email"), textValue(row, "created_at"))}`,
    sourceTable,
    status: textValue(row, "status"),
    createdAt: firstPresent(textValue(row, "updated_at"), textValue(row, "created_at")) ?? null,
    dueAt: firstPresent(textValue(row, "scheduled_for"), textValue(row, "due_at")) ?? null,
    notes:
      firstPresent(textValue(row, "title"), textValue(row, "notes"), textValue(row, "summary")) ??
      null,
  };
}

function normalizeBuyerBase(sourceTable: string, row: Record<string, unknown>): ResolvedBuyer {
  return {
    id: numberValue(row, "id"),
    resolver_key: buyerResolverKey(sourceTable, row),
    sourceTable,
    sourceTables: [sourceTable],
    fullName: firstPresent(textValue(row, "full_name"), textValue(row, "name")) ?? null,
    email: firstPresent(textValue(row, "email"), textValue(row, "user_email")) ?? null,
    phone: textValue(row, "phone"),
    status: textValue(row, "status"),
    buyerStage: null,
    linkedPuppyId:
      firstPresent(numberValue(row, "puppy_id"), numberValue(row, "linked_puppy_id")) ?? null,
    reservationId: null,
    applicationId: null,
    notes: firstPresent(textValue(row, "notes"), textValue(row, "admin_notes")) ?? null,
    createdAt: firstPresent(textValue(row, "updated_at"), textValue(row, "created_at")) ?? null,
    userId: textValue(row, "user_id"),
    addressLine1: textValue(row, "address_line1"),
    addressLine2: textValue(row, "address_line2"),
    postalCode: textValue(row, "postal_code", "zip"),
    city: firstPresent(textValue(row, "city"), textValue(row, "city_state")) ?? null,
    state: textValue(row, "state"),
    salePrice: numberValue(row, "sale_price"),
    depositAmount: numberValue(row, "deposit_amount"),
    financeEnabled: booleanValue(row, "finance_enabled"),
    financeAdminFee: booleanValue(row, "finance_admin_fee"),
    financeRate: numberValue(row, "finance_rate"),
    financeMonths: numberValue(row, "finance_months"),
    financeMonthlyAmount: numberValue(row, "finance_monthly_amount"),
    financeDayOfMonth: numberValue(row, "finance_day_of_month"),
    financeNextDueDate: textValue(row, "finance_next_due_date"),
    financeLastPaymentDate: textValue(row, "finance_last_payment_date"),
    deliveryOption: textValue(row, "delivery_option"),
    deliveryDate: textValue(row, "delivery_date"),
    deliveryLocation: textValue(row, "delivery_location"),
    deliveryMiles: numberValue(row, "delivery_miles"),
    deliveryFee: numberValue(row, "delivery_fee"),
    expenseGas: numberValue(row, "expense_gas"),
    expenseHotel: numberValue(row, "expense_hotel"),
    expenseTolls: numberValue(row, "expense_tolls"),
    expenseMisc: textValue(row, "expense_misc"),
    applications: [],
    reservations: [],
    leads: [],
    followUps: [],
    overlay: sourceTable.startsWith("core_") ? row : null,
  };
}

function resolveBuyerStage(buyer: ResolvedBuyer) {
  const normalizedStatus = normalizedText(buyer.status);
  const latestApplication = buyer.applications[0] || null;
  const latestReservation = buyer.reservations[0] || null;
  const latestFollowUp = buyer.followUps[0] || null;

  if (["completed", "delivered", "closed"].includes(normalizedStatus)) return "completed";
  if (
    latestReservation &&
    ["reserved", "deposit", "held", "active"].includes(normalizedText(latestReservation.status))
  ) {
    return "deposit";
  }
  if (latestApplication && normalizedText(latestApplication.status) === "approved") return "approved";
  if (latestApplication) return "application";
  if (buyer.linkedPuppyId) return "active";
  if (latestFollowUp) return "follow_up";
  if (buyer.leads.length) return "pipeline";
  return buyer.status || null;
}

function resolveJourney(buyer: ResolvedBuyer): ResolvedBuyerJourney {
  const latestApplication = buyer.applications[0] || null;
  const latestReservation = buyer.reservations[0] || null;
  const latestFollowUp = buyer.followUps[0] || null;

  return {
    buyerId: buyer.id,
    buyerResolverKey: buyer.resolver_key,
    applicationStatus: latestApplication?.status || null,
    reservationStatus: latestReservation?.status || null,
    depositStatus:
      buyer.buyerStage === "deposit" || buyer.buyerStage === "active"
        ? buyer.buyerStage
        : null,
    contractStatus: null,
    paymentStatus: null,
    deliveryStatus:
      firstPresent(
        textValue(buyer.overlay, "delivery_status"),
        textValue(buyer.overlay, "transport_status")
      ) ?? null,
    followupState: latestFollowUp?.status || null,
  };
}

function supportMatchesBuyer(
  row: Record<string, unknown>,
  buyer: ResolvedBuyer
) {
  const buyerUserId = normalizedText(buyer.userId);
  const rowUserId = normalizedText(textValue(row, "user_id"));
  if (buyerUserId && rowUserId && buyerUserId === rowUserId) return true;

  const buyerEmail = normalizeEmail(buyer.email);
  const rowEmail = normalizeEmail(
    firstPresent(textValue(row, "email"), textValue(row, "user_email"), textValue(row, "applicant_email"), textValue(row, "buyer_email"))
  );
  if (buyerEmail && rowEmail && buyerEmail === rowEmail) return true;

  const buyerPhone = normalizePhone(buyer.phone);
  const rowPhone = normalizePhone(textValue(row, "phone"));
  if (buyerPhone && rowPhone && buyerPhone === rowPhone) return true;

  if (buyer.id !== null) {
    const directBuyerId = numberValue(row, "buyer_id");
    if (directBuyerId !== null && directBuyerId === buyer.id) return true;
  }

  const buyerName = normalizedText(buyer.fullName);
  const rowName = normalizedText(firstPresent(textValue(row, "full_name"), textValue(row, "name")));
  return Boolean(buyerName && rowName && buyerName === rowName && buyerEmail);
}

async function resolveBuyerState(service: SupabaseClient) {
  const [baseSources, applicationSources, reservationSources, leadSources, followUpSources] =
    await Promise.all([
      loadResolverSources(service, BASE_SOURCE_DEFINITIONS),
      loadResolverSources(service, APPLICATION_SOURCE_DEFINITIONS),
      loadResolverSources(service, RESERVATION_SOURCE_DEFINITIONS),
      loadResolverSources(service, LEAD_SOURCE_DEFINITIONS),
      loadResolverSources(service, FOLLOW_UP_SOURCE_DEFINITIONS),
    ]);

  const diagnostics = createResolverDiagnostics("buyers", [
    ...baseSources,
    ...applicationSources,
    ...reservationSources,
    ...leadSources,
    ...followUpSources,
  ]);

  const buyersByKey = new Map<string, ResolvedBuyer>();

  baseSources.forEach((source) => {
    source.rows.forEach((row) => {
      const normalized = normalizeBuyerBase(source.table, row);
      const existing = buyersByKey.get(normalized.resolver_key);
      if (!existing) {
        buyersByKey.set(normalized.resolver_key, normalized);
        return;
      }

      const merged = mergeResolvedRecord(
        existing,
        normalized,
        diagnostics,
        `buyer ${existing.fullName || existing.email || existing.resolver_key}`,
        ["fullName", "email", "phone", "status", "linkedPuppyId", "city", "state", "salePrice", "depositAmount", "financeNextDueDate", "deliveryDate"]
      );
      merged.sourceTables = Array.from(new Set([...(existing.sourceTables || []), source.table]));
      merged.overlay = existing.overlay || normalized.overlay;
      buyersByKey.set(normalized.resolver_key, merged);
      recordDedupe(diagnostics);
    });
  });

  const buyers = Array.from(buyersByKey.values());

  applicationSources.forEach((source) => {
    source.rows.forEach((row) => {
      const match = buyers.find((buyer) => supportMatchesBuyer(row, buyer));
      if (!match) return;
      match.applications.push(normalizeApplication(source.table, row));
    });
  });

  reservationSources.forEach((source) => {
    source.rows.forEach((row) => {
      const match = buyers.find((buyer) => supportMatchesBuyer(row, buyer));
      if (!match) return;
      const reservation = normalizeReservation(source.table, row);
      match.reservations.push(reservation);
      if (match.reservationId === null && reservation.id !== null) {
        match.reservationId = reservation.id;
      }
      if (match.linkedPuppyId === null && reservation.linkedPuppyId !== null) {
        match.linkedPuppyId = reservation.linkedPuppyId;
      }
    });
  });

  leadSources.forEach((source) => {
    source.rows.forEach((row) => {
      const match = buyers.find((buyer) => supportMatchesBuyer(row, buyer));
      if (!match) return;
      match.leads.push(normalizeLead(source.table, row));
    });
  });

  followUpSources.forEach((source) => {
    source.rows.forEach((row) => {
      const match = buyers.find((buyer) => supportMatchesBuyer(row, buyer));
      if (!match) return;
      match.followUps.push(normalizeFollowUp(source.table, row));
    });
  });

  const resolvedBuyers = buyers
    .map((buyer) => {
      buyer.applications = sortByRecent(buyer.applications, "createdAt");
      buyer.reservations = sortByRecent(buyer.reservations, "createdAt");
      buyer.leads = sortByRecent(buyer.leads, "createdAt");
      buyer.followUps = sortByRecent(buyer.followUps, "dueAt", "createdAt");
      buyer.applicationId = buyer.applications[0]?.id ?? buyer.applicationId;
      buyer.buyerStage = resolveBuyerStage(buyer);
      return buyer;
    })
    .sort((left, right) =>
      String(left.fullName || left.email || left.resolver_key).localeCompare(
        String(right.fullName || right.email || right.resolver_key)
      )
    );

  return toResolverResult<ResolvedBuyerState>(
    {
      resolvedBuyers,
      resolvedBuyerJourney: resolvedBuyers.map(resolveJourney),
    },
    diagnostics
  );
}

export async function resolveBuyers(
  service: SupabaseClient
): Promise<ResolverResult<ResolvedBuyer[]>> {
  const resolved = await resolveBuyerState(service);
  return {
    data: resolved.data.resolvedBuyers,
    diagnostics: resolved.diagnostics,
  };
}

export async function resolveBuyerJourney(
  service: SupabaseClient
): Promise<ResolverResult<ResolvedBuyerJourney[]>> {
  const resolved = await resolveBuyerState(service);
  return {
    data: resolved.data.resolvedBuyerJourney,
    diagnostics: resolved.diagnostics,
  };
}

export async function resolveBuyerWorkspace(
  service: SupabaseClient,
  buyerId: number
): Promise<ResolverResult<ResolvedBuyer | null>> {
  const resolved = await resolveBuyerState(service);
  return {
    data:
      resolved.data.resolvedBuyers.find((buyer) => buyer.id === buyerId) ||
      resolved.data.resolvedBuyers.find((buyer) => buyer.resolver_key === `id:${buyerId}`) ||
      null,
    diagnostics: resolved.diagnostics,
  };
}
