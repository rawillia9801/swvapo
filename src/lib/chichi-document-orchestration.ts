import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  findMatchingDocumentSubmission,
  getDocumentInitialData,
  portalDocumentPacket,
  portalDocumentStatus,
  type DocumentLikeFormSubmission,
  type PortalDocumentDefinition,
} from "@/lib/portal-document-packet";

export type ChiChiDocumentPackageKey =
  | "deposit-agreement"
  | "bill-of-sale"
  | "health-guarantee"
  | "hypoglycemia-awareness"
  | "payment-plan-agreement"
  | "pickup-delivery-confirmation";

type BuyerRow = {
  id: number;
  user_id?: string | null;
  puppy_id?: number | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  sale_price?: number | null;
  deposit_amount?: number | null;
  deposit_date?: string | null;
  finance_enabled?: boolean | null;
  finance_rate?: number | null;
  finance_months?: number | null;
  finance_monthly_amount?: number | null;
  finance_next_due_date?: string | null;
  delivery_option?: string | null;
  delivery_date?: string | null;
  delivery_location?: string | null;
  notes?: string | null;
};

type PuppyRow = {
  id: number;
  buyer_id?: number | null;
  call_name?: string | null;
  puppy_name?: string | null;
  name?: string | null;
  sex?: string | null;
  color?: string | null;
  coat_type?: string | null;
  dob?: string | null;
  price?: number | null;
  list_price?: number | null;
  deposit?: number | null;
  status?: string | null;
  registry?: string | null;
  owner_email?: string | null;
};

type PickupRequestRow = {
  id: number;
  request_date?: string | null;
  request_type?: string | null;
  location_text?: string | null;
  address_text?: string | null;
  status?: string | null;
};

type PortalDocumentRow = {
  id: string | number;
  user_id?: string | null;
  buyer_id?: number | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  status?: string | null;
  created_at?: string | null;
  source_table?: string | null;
  file_name?: string | null;
  file_url?: string | null;
  visible_to_user?: boolean | null;
  signed_at?: string | null;
};

type PackageContext = {
  user: User;
  buyer: BuyerRow | null;
  puppy: PuppyRow | null;
  pickupRequest: PickupRequestRow | null;
  forms: DocumentLikeFormSubmission[];
  documents: PortalDocumentRow[];
};

type PackageAvailability = {
  enabled: boolean;
  reason?: string;
};

type PackageStatus = {
  phase:
    | "not_ready"
    | "ready"
    | "prepared"
    | "review_submitted"
    | "signature_pending"
    | "signed";
  label: string;
  detail: string;
  complete: boolean;
};

type ChiChiPackageDefinition = PortalDocumentDefinition & {
  key: ChiChiDocumentPackageKey;
};

type PreparedPackage = {
  definition: ChiChiPackageDefinition;
  availability: PackageAvailability;
  submission: DocumentLikeFormSubmission | null;
  signedCopy: PortalDocumentRow | null;
  status: PackageStatus;
  prefill: Record<string, unknown>;
  note: string;
};

type ResolveOptions = {
  user: User;
  canManageAnyBuyer: boolean;
  buyerId?: number | null;
  buyerName?: string | null;
  buyerEmail?: string | null;
};

type ResolveResult = {
  context: PackageContext | null;
  proposalText?: string;
};

type LaunchOptions = {
  portalReviewUrl: string;
  adminReviewUrl: string | null;
  zohoFormsUrl: string | null;
  zohoWriterUrl: string | null;
  zohoSignUrl: string | null;
};

export type ChiChiDocumentResponse = {
  text: string;
  launchUrl?: string | null;
  packageKey?: ChiChiDocumentPackageKey | null;
};

const CHICHI_PACKAGE_KEYS: ChiChiDocumentPackageKey[] = [
  "deposit-agreement",
  "bill-of-sale",
  "health-guarantee",
  "hypoglycemia-awareness",
  "payment-plan-agreement",
  "pickup-delivery-confirmation",
];

const PACKAGE_DEFINITIONS = portalDocumentPacket.filter((definition) =>
  CHICHI_PACKAGE_KEYS.includes(definition.key as ChiChiDocumentPackageKey)
) as ChiChiPackageDefinition[];

const PACKAGE_DEFINITION_MAP = Object.fromEntries(
  PACKAGE_DEFINITIONS.map((definition) => [definition.key, definition] as const)
) as Record<ChiChiDocumentPackageKey, ChiChiPackageDefinition>;

function normalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function normalizeName(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstFilled(...values: Array<unknown>) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function formatMoney(value: unknown) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function packageSourceKey(key: ChiChiDocumentPackageKey) {
  return `chichi_document_package:${key}`;
}

function packageStem(key: ChiChiDocumentPackageKey) {
  return key.replace(/-/g, "_").toUpperCase();
}

function buyerDisplayName(buyer: BuyerRow | null, user: User) {
  return firstFilled(buyer?.full_name, buyer?.name, user.email, "this buyer");
}

function puppyDisplayName(context: PackageContext) {
  return (
    firstFilled(
      context.puppy?.call_name,
      context.puppy?.puppy_name,
      context.puppy?.name,
      context.buyer?.full_name ? `${context.buyer.full_name}'s puppy` : ""
    ) || "the linked puppy"
  );
}

function contextForPacket(context: PackageContext) {
  return {
    buyer: context.buyer as never,
    puppy: context.puppy as never,
    application: null,
    documents: context.documents as never,
  };
}

function statusTime(value: string | null | undefined) {
  const timestamp = new Date(String(value || "")).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortDesc<T extends { created_at?: string | null; signed_at?: string | null }>(rows: T[]) {
  return rows
    .slice()
    .sort(
      (left, right) =>
        Math.max(statusTime(right.signed_at), statusTime(right.created_at)) -
        Math.max(statusTime(left.signed_at), statusTime(left.created_at))
    );
}

function getPackageIntegrations(key: ChiChiDocumentPackageKey) {
  const stem = packageStem(key);
  return {
    zohoFormsUrl:
      process.env[`CHICHI_ZOHO_FORMS_${stem}_URL`] ||
      process.env[`ZOHO_FORMS_${stem}_URL`] ||
      null,
    zohoWriterUrl:
      process.env[`CHICHI_ZOHO_WRITER_${stem}_URL`] ||
      process.env[`ZOHO_WRITER_${stem}_URL`] ||
      null,
    zohoSignUrl:
      process.env[`CHICHI_ZOHO_SIGN_${stem}_URL`] ||
      process.env[`ZOHO_SIGN_${stem}_URL`] ||
      null,
  };
}

function inferPackageFromPhrase(rawMessage: string | null | undefined) {
  const text = String(rawMessage || "").trim().toLowerCase();
  if (!text) return null;

  if (
    /\bbill of sale\b|\bsale contract\b|\bpurchase contract\b|\bplacement contract\b/.test(text)
  ) {
    return "bill-of-sale" satisfies ChiChiDocumentPackageKey;
  }

  if (/\bhealth guarantee\b|\bhealthcare guarantee\b/.test(text)) {
    return "health-guarantee" satisfies ChiChiDocumentPackageKey;
  }

  if (/\bdeposit agreement\b|\breservation agreement\b|\bdeposit form\b/.test(text)) {
    return "deposit-agreement" satisfies ChiChiDocumentPackageKey;
  }

  if (/\bhypoglycemia\b|\blow blood sugar\b/.test(text)) {
    return "hypoglycemia-awareness" satisfies ChiChiDocumentPackageKey;
  }

  if (
    /\bpayment plan\b|\bfinance agreement\b|\binstallment agreement\b|\bfinancing agreement\b/.test(
      text
    )
  ) {
    return "payment-plan-agreement" satisfies ChiChiDocumentPackageKey;
  }

  if (/\bpickup\b|\bdelivery\b|\btransportation\b|\bhandoff\b|\bgo[- ]?home\b/.test(text)) {
    return "pickup-delivery-confirmation" satisfies ChiChiDocumentPackageKey;
  }

  return null;
}

export function inferChiChiDocumentPackageKey(
  rawMessage: string | null | undefined
): ChiChiDocumentPackageKey | null {
  return inferPackageFromPhrase(rawMessage);
}

function buildLaunchOptions(
  origin: string,
  definition: ChiChiPackageDefinition,
  buyer: BuyerRow | null,
  integrations: ReturnType<typeof getPackageIntegrations>,
  canManageAnyBuyer: boolean
): LaunchOptions {
  const portalReviewUrl = new URL("/portal/documents", origin);
  portalReviewUrl.searchParams.set("document", definition.key);

  const adminReviewUrl = canManageAnyBuyer
    ? new URL("/admin/portal/documents", origin)
    : null;

  if (adminReviewUrl && buyer?.id) {
    adminReviewUrl.searchParams.set("buyer", String(buyer.id));
    adminReviewUrl.searchParams.set("document", definition.key);
  }

  return {
    portalReviewUrl: portalReviewUrl.toString(),
    adminReviewUrl: adminReviewUrl?.toString() || null,
    zohoFormsUrl: integrations.zohoFormsUrl,
    zohoWriterUrl: integrations.zohoWriterUrl,
    zohoSignUrl: integrations.zohoSignUrl,
  };
}

function findSignedCopy(
  definition: ChiChiPackageDefinition,
  documents: PortalDocumentRow[]
) {
  const sourceKey = packageSourceKey(definition.key);
  const normalizedTitle = normalizeName(definition.title);

  return (
    sortDesc(documents).find((document) => {
      const title = normalizeName(document.title);
      const fileName = normalizeName(document.file_name);
      const category = normalizeName(document.category);
      const sourceTable = normalizeName(document.source_table);

      return (
        sourceTable === normalizeName(sourceKey) ||
        title.includes(normalizedTitle) ||
        fileName.includes(normalizedTitle) ||
        category === normalizeName(definition.category)
      );
    }) || null
  );
}

function buildPackageStatus(
  definition: ChiChiPackageDefinition,
  context: PackageContext,
  availability: PackageAvailability,
  submission: DocumentLikeFormSubmission | null,
  signedCopy: PortalDocumentRow | null
): PackageStatus {
  if (signedCopy) {
    return {
      phase: "signed",
      label: "Signed copy on file",
      detail: signedCopy.file_name
        ? `${definition.title} has a signed portal copy saved as ${signedCopy.file_name}.`
        : `${definition.title} has a signed copy saved in the portal file.`,
      complete: true,
    };
  }

  const baseStatus = portalDocumentStatus(definition, contextForPacket(context), submission || undefined);
  const normalizedStatus = String(submission?.status || "").trim().toLowerCase();

  if (submission?.signed_at) {
    return {
      phase: "signature_pending",
      label: "Signed, waiting on file sync",
      detail:
        "The signature is recorded on the form copy, but ChiChi has not found the finished signed portal document yet.",
      complete: false,
    };
  }

  if (
    submission?.submitted_at &&
    ["submitted", "review", "pending", "ready"].some((token) =>
      normalizedStatus.includes(token)
    )
  ) {
    return {
      phase: "review_submitted",
      label: "Review copy in motion",
      detail:
        "ChiChi found a submitted or review-stage copy for this package. The next step is signature or signed-copy sync.",
      complete: false,
    };
  }

  if (submission) {
    return {
      phase: "prepared",
      label: baseStatus.label || "Prepared",
      detail:
        "ChiChi has already assembled a prepared draft for this package, and it is ready to open for review.",
      complete: false,
    };
  }

  if (availability.enabled) {
    return {
      phase: "ready",
      label: "Ready to prepare",
      detail:
        "This package has enough buyer and puppy context for ChiChi to assemble the review copy.",
      complete: false,
    };
  }

  return {
    phase: "not_ready",
    label: "Not ready yet",
    detail:
      availability.reason ||
      "This package is waiting on more buyer, puppy, financing, or transportation context.",
    complete: false,
  };
}

function buildChiChiNote(
  definition: ChiChiPackageDefinition,
  context: PackageContext,
  integrations: ReturnType<typeof getPackageIntegrations>
) {
  const buyerName = buyerDisplayName(context.buyer, context.user);
  const puppyName = puppyDisplayName(context);
  const pricing = formatMoney(
    context.buyer?.sale_price || context.puppy?.price || context.puppy?.list_price
  );
  const delivery = firstFilled(
    context.pickupRequest?.request_type,
    context.buyer?.delivery_option,
    context.pickupRequest?.location_text,
    context.buyer?.delivery_location
  );

  return [
    `ChiChi prepared the ${definition.title} for ${buyerName}.`,
    puppyName ? `Puppy context: ${puppyName}.` : null,
    pricing ? `Pricing context: ${pricing}.` : null,
    delivery ? `Transportation context: ${delivery}.` : null,
    integrations.zohoFormsUrl
      ? "Zoho Forms launch is configured for buyer review."
      : "Buyer review will open from the portal copy until a Zoho Forms launch URL is configured.",
    integrations.zohoSignUrl
      ? "Zoho Sign is configured for signature handoff."
      : "Zoho Sign is not configured yet, so signed-copy sync still depends on a later upload or integration step.",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildPreparedPackage(
  definition: ChiChiPackageDefinition,
  context: PackageContext
) {
  const submission = findMatchingDocumentSubmission(definition, context.forms);
  const signedCopy = findSignedCopy(definition, context.documents);
  const availability = definition.getAvailability(contextForPacket(context));
  const integrations = getPackageIntegrations(definition.key);
  const status = buildPackageStatus(
    definition,
    context,
    availability,
    submission,
    signedCopy
  );
  const prefill = getDocumentInitialData(
    definition,
    contextForPacket(context),
    submission || undefined
  );
  const note = buildChiChiNote(definition, context, integrations);

  return {
    definition,
    availability,
    submission,
    signedCopy,
    status,
    prefill,
    note,
  } satisfies PreparedPackage;
}

function buildPackageSummaryLine(item: PreparedPackage) {
  return `- ${item.definition.title}: ${item.status.label}${item.status.complete ? "" : ` - ${item.status.detail}`}`;
}

function buildPackageHighlights(item: PreparedPackage) {
  const highlights = [
    item.prefill["puppy_name"] ? `Puppy: ${String(item.prefill["puppy_name"])}` : null,
    item.prefill["purchase_price"]
      ? `Price: ${formatMoney(item.prefill["purchase_price"]) || String(item.prefill["purchase_price"])}`
      : null,
    item.prefill["deposit_credit"]
      ? `Deposit: ${formatMoney(item.prefill["deposit_credit"]) || String(item.prefill["deposit_credit"])}`
      : null,
    item.prefill["monthly_amount"]
      ? `Monthly: ${formatMoney(item.prefill["monthly_amount"]) || String(item.prefill["monthly_amount"])}`
      : null,
    item.prefill["delivery_date"] ? `Date: ${String(item.prefill["delivery_date"])}` : null,
    item.prefill["delivery_location"]
      ? `Location: ${String(item.prefill["delivery_location"])}`
      : null,
  ].filter(Boolean);

  return highlights.slice(0, 3);
}

function buildDocumentPackageProposalText(params: {
  intro: string;
  matched?: string[];
  missing?: string[];
  options?: string[];
  next?: string;
}) {
  const lines = [params.intro];

  if (params.matched?.length) {
    lines.push("", "What I matched:", ...params.matched.map((item) => `- ${item}`));
  }

  if (params.missing?.length) {
    lines.push(
      "",
      "What I still need before I make a workflow move:",
      ...params.missing.map((item) => `- ${item}`)
    );
  }

  if (params.options?.length) {
    lines.push("", "Available package options:", ...params.options.map((item) => `- ${item}`));
  }

  if (params.next) {
    lines.push("", params.next);
  }

  return lines.join("\n");
}

async function loadBuyerByPortalIdentity(admin: SupabaseClient, user: User) {
  const email = normalizeEmail(user.email);

  if (user.id) {
    const { data, error } = await admin
      .from("buyers")
      .select(
        "id,user_id,puppy_id,full_name,name,email,phone,status,sale_price,deposit_amount,deposit_date,finance_enabled,finance_rate,finance_months,finance_monthly_amount,finance_next_due_date,delivery_option,delivery_date,delivery_location,notes"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<BuyerRow>();

    if (!error && data) return data;
  }

  if (!email) return null;

  const { data, error } = await admin
    .from("buyers")
    .select(
      "id,user_id,puppy_id,full_name,name,email,phone,status,sale_price,deposit_amount,deposit_date,finance_enabled,finance_rate,finance_months,finance_monthly_amount,finance_next_due_date,delivery_option,delivery_date,delivery_location,notes"
    )
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<BuyerRow>();

  if (!error && data) return data;
  return null;
}

async function resolveBuyer(
  admin: SupabaseClient,
  options: ResolveOptions
) {
  if (!options.canManageAnyBuyer) {
    return {
      buyer: await loadBuyerByPortalIdentity(admin, options.user),
      proposalText: undefined,
    };
  }

  if (options.buyerId) {
    const { data, error } = await admin
      .from("buyers")
      .select(
        "id,user_id,puppy_id,full_name,name,email,phone,status,sale_price,deposit_amount,deposit_date,finance_enabled,finance_rate,finance_months,finance_monthly_amount,finance_next_due_date,delivery_option,delivery_date,delivery_location,notes"
      )
      .eq("id", options.buyerId)
      .maybeSingle<BuyerRow>();
    if (!error && data) {
      return { buyer: data, proposalText: undefined };
    }
  }

  const buyerEmail = normalizeEmail(options.buyerEmail);
  if (buyerEmail) {
    const { data, error } = await admin
      .from("buyers")
      .select(
        "id,user_id,puppy_id,full_name,name,email,phone,status,sale_price,deposit_amount,deposit_date,finance_enabled,finance_rate,finance_months,finance_monthly_amount,finance_next_due_date,delivery_option,delivery_date,delivery_location,notes"
      )
      .ilike("email", buyerEmail)
      .limit(1)
      .maybeSingle<BuyerRow>();
    if (!error && data) {
      return { buyer: data, proposalText: undefined };
    }
  }

  const buyerName = normalizeName(options.buyerName);
  if (!buyerName) {
    return {
      buyer: null,
      proposalText: buildDocumentPackageProposalText({
        intro: "ChiChi can prepare the document workflow, but I do not know which buyer file to use yet.",
        missing: ["buyer name, buyer email, or buyer id"],
        next: "Tell me which buyer record to use and I can assemble the correct package.",
      }),
    };
  }

  const { data, error } = await admin
    .from("buyers")
    .select(
      "id,user_id,puppy_id,full_name,name,email,phone,status,sale_price,deposit_amount,deposit_date,finance_enabled,finance_rate,finance_months,finance_monthly_amount,finance_next_due_date,delivery_option,delivery_date,delivery_location,notes"
    )
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) {
    throw error;
  }

  const exact = (data || []).filter((buyer) => {
    return (
      normalizeName(buyer.full_name) === buyerName ||
      normalizeName(buyer.name) === buyerName ||
      normalizeEmail(buyer.email) === buyerName
    );
  });

  if (exact.length === 1) {
    return { buyer: exact[0] as BuyerRow, proposalText: undefined };
  }

  const partial = (data || []).filter((buyer) => {
    const full = normalizeName(buyer.full_name);
    const short = normalizeName(buyer.name);
    const email = normalizeEmail(buyer.email);
    return (
      (full && (full.includes(buyerName) || buyerName.includes(full))) ||
      (short && (short.includes(buyerName) || buyerName.includes(short))) ||
      (email && email.includes(buyerName))
    );
  });

  if (partial.length === 1) {
    return { buyer: partial[0] as BuyerRow, proposalText: undefined };
  }

  if (partial.length > 1 || exact.length > 1) {
    const candidates = (partial.length ? partial : exact)
      .slice(0, 6)
      .map((buyer) => firstFilled(buyer.full_name, buyer.name, buyer.email, `Buyer #${buyer.id}`));

    return {
      buyer: null,
      proposalText: buildDocumentPackageProposalText({
        intro: "ChiChi found more than one buyer record that could match this document workflow request.",
        matched: candidates,
        missing: ["one more buyer detail to narrow the record"],
        next: "Reply with the buyer email or the exact buyer name you want me to use.",
      }),
    };
  }

  return {
    buyer: null,
    proposalText: buildDocumentPackageProposalText({
      intro: "ChiChi could not match that document workflow request to a buyer record yet.",
      missing: ["a valid buyer name, buyer email, or buyer id"],
      next: "Tell me which buyer record to use and I can keep going.",
    }),
  };
}

async function loadPuppy(admin: SupabaseClient, buyer: BuyerRow | null, user: User) {
  if (buyer?.puppy_id) {
    const { data, error } = await admin
      .from("puppies")
      .select(
        "id,buyer_id,call_name,puppy_name,name,sex,color,coat_type,dob,price,list_price,deposit,status,registry,owner_email"
      )
      .eq("id", buyer.puppy_id)
      .maybeSingle<PuppyRow>();
    if (!error && data) return data;
  }

  if (buyer?.id) {
    const { data, error } = await admin
      .from("puppies")
      .select(
        "id,buyer_id,call_name,puppy_name,name,sex,color,coat_type,dob,price,list_price,deposit,status,registry,owner_email"
      )
      .eq("buyer_id", buyer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<PuppyRow>();
    if (!error && data) return data;
  }

  const email = normalizeEmail(user.email);
  if (!email) return null;

  const { data, error } = await admin
    .from("puppies")
    .select(
      "id,buyer_id,call_name,puppy_name,name,sex,color,coat_type,dob,price,list_price,deposit,status,registry,owner_email"
    )
    .ilike("owner_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<PuppyRow>();

  if (!error && data) return data;
  return null;
}

async function loadPickupRequest(admin: SupabaseClient, buyerId: number | null | undefined) {
  if (!buyerId) return null;

  const { data, error } = await admin
    .from("pickup_requests")
    .select("id,request_date,request_type,location_text,address_text,status")
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<PickupRequestRow>();

  if (!error && data) return data;
  return null;
}

function dedupeById<T extends { id: string | number }>(rows: T[]) {
  const map = new Map<string, T>();
  for (const row of rows) {
    map.set(String(row.id), row);
  }
  return Array.from(map.values());
}

async function loadForms(
  admin: SupabaseClient,
  user: User,
  buyer: BuyerRow | null
) {
  const rows: DocumentLikeFormSubmission[] = [];
  const emailCandidates = Array.from(
    new Set([normalizeEmail(user.email), normalizeEmail(buyer?.email)].filter(Boolean))
  );

  if (user.id) {
    const byUserId = await admin
      .from("portal_form_submissions")
      .select(
        "id,user_id,user_email,email,form_key,form_title,version,signed_name,signed_date,signed_at,data,payload,status,submitted_at,attachments,created_at,updated_at"
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (!byUserId.error && byUserId.data?.length) {
      rows.push(...(byUserId.data as DocumentLikeFormSubmission[]));
    }
  }

  if (buyer?.user_id && buyer.user_id !== user.id) {
    const byBuyerUserId = await admin
      .from("portal_form_submissions")
      .select(
        "id,user_id,user_email,email,form_key,form_title,version,signed_name,signed_date,signed_at,data,payload,status,submitted_at,attachments,created_at,updated_at"
      )
      .eq("user_id", buyer.user_id)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (!byBuyerUserId.error && byBuyerUserId.data?.length) {
      rows.push(...(byBuyerUserId.data as DocumentLikeFormSubmission[]));
    }
  }

  for (const email of emailCandidates) {
    const [byUserEmail, byEmail] = await Promise.all([
      admin
        .from("portal_form_submissions")
        .select(
          "id,user_id,user_email,email,form_key,form_title,version,signed_name,signed_date,signed_at,data,payload,status,submitted_at,attachments,created_at,updated_at"
        )
        .ilike("user_email", email)
        .order("updated_at", { ascending: false })
        .limit(50),
      admin
        .from("portal_form_submissions")
        .select(
          "id,user_id,user_email,email,form_key,form_title,version,signed_name,signed_date,signed_at,data,payload,status,submitted_at,attachments,created_at,updated_at"
        )
        .ilike("email", email)
        .order("updated_at", { ascending: false })
        .limit(50),
    ]);

    if (!byUserEmail.error && byUserEmail.data?.length) {
      rows.push(...(byUserEmail.data as DocumentLikeFormSubmission[]));
    }
    if (!byEmail.error && byEmail.data?.length) {
      rows.push(...(byEmail.data as DocumentLikeFormSubmission[]));
    }
  }

  return dedupeById(rows);
}

async function loadDocuments(
  admin: SupabaseClient,
  user: User,
  buyer: BuyerRow | null,
  canManageAnyBuyer: boolean
) {
  const rows: PortalDocumentRow[] = [];
  const querySelect =
    "id,user_id,buyer_id,title,description,category,status,created_at,source_table,file_name,file_url,visible_to_user,signed_at";

  if (user.id) {
    let query = admin.from("portal_documents").select(querySelect).eq("user_id", user.id);
    if (!canManageAnyBuyer) {
      query = query.or("visible_to_user.is.null,visible_to_user.eq.true");
    }
    const result = await query.order("created_at", { ascending: false }).limit(50);
    if (!result.error && result.data?.length) rows.push(...(result.data as PortalDocumentRow[]));
  }

  if (buyer?.id) {
    let query = admin.from("portal_documents").select(querySelect).eq("buyer_id", buyer.id);
    if (!canManageAnyBuyer) {
      query = query.or("visible_to_user.is.null,visible_to_user.eq.true");
    }
    const result = await query.order("created_at", { ascending: false }).limit(50);
    if (!result.error && result.data?.length) rows.push(...(result.data as PortalDocumentRow[]));
  }

  return dedupeById(rows);
}

async function resolvePackageContext(
  admin: SupabaseClient,
  options: ResolveOptions
): Promise<ResolveResult> {
  const buyerResolution = await resolveBuyer(admin, options);
  if (buyerResolution.proposalText) {
    return { context: null, proposalText: buyerResolution.proposalText };
  }

  const buyer = buyerResolution.buyer;
  const [puppy, pickupRequest, forms, documents] = await Promise.all([
    loadPuppy(admin, buyer, options.user),
    loadPickupRequest(admin, buyer?.id),
    loadForms(admin, options.user, buyer),
    loadDocuments(admin, options.user, buyer, options.canManageAnyBuyer),
  ]);

  return {
    context: {
      user: options.user,
      buyer,
      puppy,
      pickupRequest,
      forms,
      documents,
    },
  };
}

function choosePackage(
  rawKey: ChiChiDocumentPackageKey | null | undefined,
  rawMessage: string | null | undefined
) {
  const direct = rawKey && PACKAGE_DEFINITION_MAP[rawKey] ? rawKey : null;
  if (direct) return PACKAGE_DEFINITION_MAP[direct];

  const inferred = inferPackageFromPhrase(rawMessage);
  return inferred ? PACKAGE_DEFINITION_MAP[inferred] : null;
}

function preparedPackagesForContext(context: PackageContext) {
  return PACKAGE_DEFINITIONS.map((definition) => buildPreparedPackage(definition, context));
}

function launchUrlForPackage(launches: LaunchOptions) {
  return launches.zohoSignUrl || launches.zohoFormsUrl || launches.portalReviewUrl;
}

function buildPreparedText(
  item: PreparedPackage,
  context: PackageContext,
  launches: LaunchOptions
) {
  const lines = [
    `ChiChi prepared the ${item.definition.title} for ${buyerDisplayName(context.buyer, context.user)}.`,
    "",
    item.note,
    "",
    `Status: ${item.status.label}`,
    item.status.detail,
  ];

  const highlights = buildPackageHighlights(item);
  if (highlights.length) {
    lines.push("", "Compiled highlights:", ...highlights.map((entry) => `- ${entry}`));
  }

  lines.push("", "Launch options:");
  lines.push(`- Buyer portal review: ${launches.portalReviewUrl}`);
  if (launches.adminReviewUrl) lines.push(`- Admin record view: ${launches.adminReviewUrl}`);
  if (launches.zohoFormsUrl) lines.push(`- Zoho Forms launch: ${launches.zohoFormsUrl}`);
  if (launches.zohoWriterUrl) lines.push(`- Zoho Writer merge template: ${launches.zohoWriterUrl}`);
  if (launches.zohoSignUrl) lines.push(`- Zoho Sign launch: ${launches.zohoSignUrl}`);

  lines.push(
    "",
    "Workflow:",
    "1. ChiChi prepares the package from the live buyer, puppy, pricing, and transportation context.",
    launches.zohoFormsUrl
      ? "2. Buyer review can launch through Zoho Forms."
      : "2. Buyer review can launch from the portal copy while Zoho Forms is configured later.",
    launches.zohoSignUrl
      ? "3. Signature can move through Zoho Sign, then the signed copy should sync back into the portal and admin file."
      : "3. Signature handoff is waiting on Zoho Sign or an uploaded signed copy to complete the loop."
  );

  return lines.join("\n");
}

function buildStatusText(
  item: PreparedPackage,
  context: PackageContext,
  launches: LaunchOptions
) {
  return [
    `${item.definition.title} status for ${buyerDisplayName(context.buyer, context.user)}:`,
    "",
    `- Status: ${item.status.label}`,
    `- Detail: ${item.status.detail}`,
    item.submission?.status ? `- Form copy: ${item.submission.status}` : "- Form copy: not created yet",
    item.submission?.submitted_at ? `- Submitted at: ${item.submission.submitted_at}` : null,
    item.submission?.signed_at ? `- Signed at: ${item.submission.signed_at}` : null,
    item.signedCopy?.file_name
      ? `- Signed portal file: ${item.signedCopy.file_name}`
      : item.signedCopy
        ? "- Signed portal file: on file"
        : "- Signed portal file: not synced yet",
    `- Buyer review link: ${launches.portalReviewUrl}`,
    launches.zohoSignUrl ? `- Zoho Sign: ${launches.zohoSignUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSyncText(
  item: PreparedPackage,
  context: PackageContext,
  launches: LaunchOptions
) {
  if (item.signedCopy) {
    return [
      `ChiChi checked the ${item.definition.title} sync for ${buyerDisplayName(context.buyer, context.user)}.`,
      "",
      "A signed portal copy is already on file.",
      item.signedCopy.file_url ? `Portal file: ${item.signedCopy.file_url}` : null,
      launches.adminReviewUrl ? `Admin record view: ${launches.adminReviewUrl}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (item.submission?.signed_at) {
    return [
      `ChiChi checked the ${item.definition.title} sync for ${buyerDisplayName(context.buyer, context.user)}.`,
      "",
      "The form copy shows a completed signature, but the finished signed document has not been mirrored into portal documents yet.",
      launches.zohoSignUrl
        ? `Zoho Sign launch on file: ${launches.zohoSignUrl}`
        : "Zoho Sign launch is not configured yet.",
      "Next step: push the signed PDF back through the document webhook or upload the finished copy into the buyer record.",
    ].join("\n");
  }

  if (item.submission) {
    return [
      `ChiChi checked the ${item.definition.title} sync for ${buyerDisplayName(context.buyer, context.user)}.`,
      "",
      "There is a prepared or review-stage form copy on file, but nothing has been signed yet.",
      `Current status: ${item.status.label}`,
      `Buyer review link: ${launches.portalReviewUrl}`,
    ].join("\n");
  }

  return [
    `ChiChi checked the ${item.definition.title} sync for ${buyerDisplayName(context.buyer, context.user)}.`,
    "",
    "There is no prepared package on file yet, so there is nothing to sync back.",
    "Next step: prepare the package first, then launch review and signature.",
  ].join("\n");
}

function buildListText(context: PackageContext, items: PreparedPackage[]) {
  const buyerLabel = buyerDisplayName(context.buyer, context.user);
  const active = items.filter((item) => item.availability.enabled || item.submission || item.signedCopy);
  const list = active.length ? active : items;

  return [
    `ChiChi document workflow for ${buyerLabel}:`,
    "",
    ...list.map(buildPackageSummaryLine),
    "",
    "ChiChi can prepare, launch, track, and check sync state for any of these packages.",
  ].join("\n");
}

async function upsertPreparedSubmission(
  admin: SupabaseClient,
  context: PackageContext,
  item: PreparedPackage,
  launches: LaunchOptions
) {
  const existing = item.submission;
  const normalizedStatus = String(existing?.status || "").trim().toLowerCase();
  const locked =
    existing &&
    (Boolean(existing.signed_at) ||
      Boolean(
        existing.submitted_at &&
          ["submitted", "signed", "approved", "complete", "completed"].some((token) =>
            normalizedStatus.includes(token)
          )
      ));

  if (locked) {
    return existing;
  }

  const nowIso = new Date().toISOString();
  const payload = {
    ...item.prefill,
    chi_chi_workflow: {
      package_key: item.definition.key,
      prepared_at: nowIso,
      source: "chichi_orchestration",
      buyer_id: context.buyer?.id ?? null,
      puppy_id: context.puppy?.id ?? null,
      portal_review_url: launches.portalReviewUrl,
      zoho_forms_configured: Boolean(launches.zohoFormsUrl),
      zoho_writer_configured: Boolean(launches.zohoWriterUrl),
      zoho_sign_configured: Boolean(launches.zohoSignUrl),
      note: item.note,
    },
  };

  const basePayload = {
    user_id: context.buyer?.user_id || context.user.id || null,
    user_email: normalizeEmail(context.user.email) || normalizeEmail(context.buyer?.email) || null,
    email: normalizeEmail(context.buyer?.email) || normalizeEmail(context.user.email) || null,
    form_key: item.definition.formKey,
    form_title: item.definition.title,
    version: "2026-04",
    status: "prepared",
    data: payload,
    payload,
  };

  if (existing?.id) {
    const result = await admin
      .from("portal_form_submissions")
      .update(basePayload)
      .eq("id", existing.id)
      .select(
        "id,user_id,user_email,email,form_key,form_title,version,signed_name,signed_date,signed_at,data,payload,status,submitted_at,attachments,created_at,updated_at"
      )
      .single();
    if (result.error) throw result.error;
    return result.data as DocumentLikeFormSubmission;
  }

  const result = await admin
    .from("portal_form_submissions")
    .insert(basePayload)
    .select(
      "id,user_id,user_email,email,form_key,form_title,version,signed_name,signed_date,signed_at,data,payload,status,submitted_at,attachments,created_at,updated_at"
    )
    .single();
  if (result.error) throw result.error;
  return result.data as DocumentLikeFormSubmission;
}

export async function listChiChiDocumentPackages(
  admin: SupabaseClient,
  options: ResolveOptions
): Promise<string> {
  const resolved = await resolvePackageContext(admin, options);
  if (!resolved.context) {
    return resolved.proposalText || "ChiChi could not resolve the buyer file for the document workflow yet.";
  }

  return buildListText(resolved.context, preparedPackagesForContext(resolved.context));
}

export async function lookupChiChiDocumentStatus(
  admin: SupabaseClient,
  params: ResolveOptions & {
    packageKey?: ChiChiDocumentPackageKey | null;
    rawMessage?: string | null;
    origin?: string | null;
  }
): Promise<ChiChiDocumentResponse> {
  const resolved = await resolvePackageContext(admin, params);
  if (!resolved.context) {
    return { text: resolved.proposalText || "ChiChi could not resolve that document status request." };
  }

  const definition = choosePackage(params.packageKey, params.rawMessage || null);
  if (!definition) {
    return {
      text: buildDocumentPackageProposalText({
        intro: "ChiChi can look up document workflow status, but I still need the package name.",
        matched: [`Buyer: ${buyerDisplayName(resolved.context.buyer, resolved.context.user)}`],
        missing: ["document package"],
        options: PACKAGE_DEFINITIONS.map((item) => item.title),
        next: "Tell me which package you want, like Bill of Sale or Health Guarantee.",
      }),
    };
  }

  const item = buildPreparedPackage(definition, resolved.context);
  const launches = buildLaunchOptions(
    params.origin || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    definition,
    resolved.context.buyer,
    getPackageIntegrations(definition.key),
    params.canManageAnyBuyer
  );

  return {
    text: buildStatusText(item, resolved.context, launches),
    launchUrl: launchUrlForPackage(launches),
    packageKey: definition.key,
  };
}

export async function prepareChiChiDocumentPackage(
  admin: SupabaseClient,
  params: ResolveOptions & {
    packageKey?: ChiChiDocumentPackageKey | null;
    rawMessage?: string | null;
    origin: string;
  }
): Promise<ChiChiDocumentResponse> {
  const resolved = await resolvePackageContext(admin, params);
  if (!resolved.context) {
    return { text: resolved.proposalText || "ChiChi could not resolve the buyer file for that package." };
  }

  const definition = choosePackage(params.packageKey, params.rawMessage || null);
  if (!definition) {
    return {
      text: buildDocumentPackageProposalText({
        intro: "ChiChi can prepare a buyer-facing document package, but I still need to know which package you want.",
        matched: [`Buyer: ${buyerDisplayName(resolved.context.buyer, resolved.context.user)}`],
        missing: ["document package"],
        options: PACKAGE_DEFINITIONS.map((item) => item.title),
        next: "Tell me which package to prepare and I will assemble the prefill and launch path.",
      }),
    };
  }

  let item = buildPreparedPackage(definition, resolved.context);
  if (!item.availability.enabled) {
    return {
      text: buildDocumentPackageProposalText({
        intro: `ChiChi found the ${definition.title}, but it is not ready to prepare yet.`,
        matched: [`Buyer: ${buyerDisplayName(resolved.context.buyer, resolved.context.user)}`],
        missing: [item.availability.reason || "more buyer or puppy context"],
        next: "Once the buyer, puppy, financing, or transportation details are in place, I can prepare it.",
      }),
      packageKey: definition.key,
    };
  }

  const launches = buildLaunchOptions(
    params.origin,
    definition,
    resolved.context.buyer,
    getPackageIntegrations(definition.key),
    params.canManageAnyBuyer
  );

  await upsertPreparedSubmission(admin, resolved.context, item, launches);
  const refreshed = await resolvePackageContext(admin, params);
  const context = refreshed.context || resolved.context;
  item = buildPreparedPackage(definition, context);

  return {
    text: buildPreparedText(item, context, launches),
    launchUrl: launchUrlForPackage(launches),
    packageKey: definition.key,
  };
}

export async function syncChiChiDocumentPackage(
  admin: SupabaseClient,
  params: ResolveOptions & {
    packageKey?: ChiChiDocumentPackageKey | null;
    rawMessage?: string | null;
    origin: string;
  }
): Promise<ChiChiDocumentResponse> {
  const resolved = await resolvePackageContext(admin, params);
  if (!resolved.context) {
    return { text: resolved.proposalText || "ChiChi could not resolve the buyer file for that sync check." };
  }

  const definition = choosePackage(params.packageKey, params.rawMessage || null);
  if (!definition) {
    return {
      text: buildDocumentPackageProposalText({
        intro: "ChiChi can check signed-copy sync, but I still need to know which package to inspect.",
        matched: [`Buyer: ${buyerDisplayName(resolved.context.buyer, resolved.context.user)}`],
        missing: ["document package"],
        options: PACKAGE_DEFINITIONS.map((item) => item.title),
        next: "Tell me which package you want me to sync or inspect.",
      }),
    };
  }

  const item = buildPreparedPackage(definition, resolved.context);
  const launches = buildLaunchOptions(
    params.origin,
    definition,
    resolved.context.buyer,
    getPackageIntegrations(definition.key),
    params.canManageAnyBuyer
  );

  return {
    text: buildSyncText(item, resolved.context, launches),
    launchUrl: item.signedCopy?.file_url || launchUrlForPackage(launches),
    packageKey: definition.key,
  };
}
