import "server-only";

/**
 * ChiChi Deal State
 *
 * This builds ONE unified, normalized view of a buyer deal.
 * It does NOT mutate anything.
 * It only reads context and returns structured intelligence.
 */

export type ChiChiDealState = {
  buyer: {
    id: number | null;
    exists: boolean;
    fullName: string;
    email: string;
    phone: string;
  };

  puppy: {
    id: number | null;
    assigned: boolean;
    callName: string;
    registry: string;
    dob: string | null;
  };

  sale: {
    price: number | null;
    depositAmount: number | null;
    depositPaid: boolean;
    balanceDue: number | null;
  };

  financing: {
    enabled: boolean;
    apr: number | null;
    months: number | null;
    monthlyPayment: number | null;
    complete: boolean;
  };

  delivery: {
    method: string;
    location: string;
    date: string | null;
    complete: boolean;
  };

  documents: {
    application: DocState;
    depositAgreement: DocState;
    billOfSale: DocState;
    healthGuarantee: DocState;
    paymentPlanAgreement: DocState;
    pickupDeliveryConfirmation: DocState;
  };

  missingFields: string[];
};

type DocState = {
  exists: boolean;
  signed: boolean;
  filed: boolean;
};

type BuyerDealRecord = {
  id?: number | null;
  full_name?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  sale_price?: unknown;
  deposit_amount?: unknown;
  finance_enabled?: unknown;
  finance_rate?: unknown;
  finance_months?: unknown;
  finance_monthly_amount?: unknown;
  delivery_option?: unknown;
  delivery_location?: unknown;
  delivery_date?: string | null;
};

type PuppyDealRecord = {
  id?: number | null;
  call_name?: unknown;
  puppy_name?: unknown;
  name?: unknown;
  registry?: unknown;
  dob?: string | null;
  price?: unknown;
  list_price?: unknown;
  deposit?: unknown;
};

type PickupDealRecord = {
  request_type?: unknown;
  location_text?: unknown;
  request_date?: string | null;
};

type DealDocumentRecord = {
  form_key?: unknown;
  title?: unknown;
  signed_at?: unknown;
  status?: unknown;
};

type Context = {
  buyer: BuyerDealRecord | null;
  puppy: PuppyDealRecord | null;
  pickupRequest: PickupDealRecord | null;
  forms: DealDocumentRecord[];
  documents: DealDocumentRecord[];
};

/**
 * Public Builder
 */
export function buildChiChiDealState(context: Context): ChiChiDealState {
  const buyer = buildBuyer(context);
  const puppy = buildPuppy(context);
  const sale = buildSale(context);
  const financing = buildFinancing(context);
  const delivery = buildDelivery(context);
  const documents = buildDocuments(context);

  const missingFields = computeMissingFields({
    buyer,
    puppy,
    sale,
    financing,
    delivery,
    documents,
  });

  return {
    buyer,
    puppy,
    sale,
    financing,
    delivery,
    documents,
    missingFields,
  };
}

//
// ----------------------------
// SECTION BUILDERS
// ----------------------------
//

function buildBuyer(context: Context) {
  const b = context.buyer || {};

  return {
    id: b.id ?? null,
    exists: !!b.id,
    fullName: first(b.full_name, b.name),
    email: first(b.email),
    phone: first(b.phone),
  };
}

function buildPuppy(context: Context) {
  const p = context.puppy || {};

  return {
    id: p.id ?? null,
    assigned: !!p.id,
    callName: first(p.call_name, p.puppy_name, p.name),
    registry: first(p.registry),
    dob: p.dob ?? null,
  };
}

function buildSale(context: Context) {
  const b = context.buyer || {};
  const p = context.puppy || {};

  const price = num(b.sale_price ?? p.price ?? p.list_price);
  const deposit = num(b.deposit_amount ?? p.deposit);

  return {
    price,
    depositAmount: deposit,
    depositPaid: !!deposit,
    balanceDue: price && deposit ? price - deposit : null,
  };
}

function buildFinancing(context: Context) {
  const b = context.buyer || {};

  const enabled = !!b.finance_enabled;

  const apr = num(b.finance_rate);
  const months = num(b.finance_months);
  const monthly = num(b.finance_monthly_amount);

  return {
    enabled,
    apr,
    months,
    monthlyPayment: monthly,
    complete: enabled ? !!apr && !!months && !!monthly : true,
  };
}

function buildDelivery(context: Context) {
  const b = context.buyer || {};
  const pr = context.pickupRequest || {};

  const method = first(pr.request_type, b.delivery_option);
  const location = first(pr.location_text, b.delivery_location);
  const date = pr.request_date ?? b.delivery_date ?? null;

  return {
    method,
    location,
    date,
    complete: !!method && !!location,
  };
}

function buildDocuments(context: Context) {
  const forms = context.forms || [];
  const docs = context.documents || [];

  return {
    application: doc("application", forms, docs),
    depositAgreement: doc("deposit", forms, docs),
    billOfSale: doc("bill-of-sale", forms, docs),
    healthGuarantee: doc("health", forms, docs),
    paymentPlanAgreement: doc("payment-plan", forms, docs),
    pickupDeliveryConfirmation: doc("pickup", forms, docs),
  };
}

//
// ----------------------------
// DOCUMENT DETECTION
// ----------------------------
//

function doc(
  key: string,
  forms: DealDocumentRecord[],
  docs: DealDocumentRecord[],
): DocState {
  const exists =
    forms.some((f) => match(f.form_key, key)) ||
    docs.some((d) => match(d.title, key));

  const signed =
    forms.some((f) => match(f.form_key, key) && !!f.signed_at) ||
    docs.some((d) => match(d.title, key) && !!d.signed_at);

  const filed = docs.some(
    (d) =>
      match(d.title, key) && (d.status === "filed" || d.status === "completed"),
  );

  return { exists, signed, filed };
}

function match(value: unknown, key: string) {
  return String(value || "")
    .toLowerCase()
    .includes(key);
}

//
// ----------------------------
// MISSING FIELD ENGINE
// ----------------------------
//

function computeMissingFields(input: {
  buyer: ChiChiDealState["buyer"];
  puppy: ChiChiDealState["puppy"];
  sale: ChiChiDealState["sale"];
  financing: ChiChiDealState["financing"];
  delivery: ChiChiDealState["delivery"];
  documents: ChiChiDealState["documents"];
}) {
  const missing: string[] = [];

  if (!input.buyer.exists) missing.push("buyer");
  if (!input.puppy.assigned) missing.push("puppy");

  if (!input.sale.price) missing.push("sale price");

  if (input.financing.enabled && !input.financing.complete) {
    missing.push("financing terms");
  }

  if (!input.delivery.complete) {
    missing.push("delivery details");
  }

  return missing;
}

//
// ----------------------------
// HELPERS
// ----------------------------
//

function first(...vals: unknown[]) {
  for (const v of vals) {
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
