import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  attachChiChiWorkflowToPayload,
  buildChiChiDocumentPackageId,
  buildChiChiDocumentPackageSource,
  extractChiChiDocumentPackageWorkflow,
  findChiChiPackageDocument,
  formatChiChiDocumentPackageStatus,
  mergeChiChiDocumentPackageWorkflow,
  resolveChiChiDocumentPackageStatus,
  type ChiChiDocumentPackageFlow,
  type ChiChiDocumentPackageWorkflow,
} from "@/lib/chichi-document-packages";
import {
  findMatchingDocumentSubmission,
  getDocumentInitialData,
  portalDocumentPacket,
  type DocumentLikeFormSubmission,
  type PortalDocumentDefinition,
} from "@/lib/portal-document-packet";
import {
  createZohoWriterSignRequest,
  downloadZohoSignCompletedDocument,
  getZohoDocumentPackageIntegrations,
  getZohoSignRequestDetails,
} from "@/lib/zoho-document-workflow";

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

type PackageFormSubmission = DocumentLikeFormSubmission & {
  user_id?: string | null;
  user_email?: string | null;
  email?: string | null;
};

type PackageContext = {
  user: User;
  buyer: BuyerRow | null;
  puppy: PuppyRow | null;
  pickupRequest: PickupRequestRow | null;
  forms: PackageFormSubmission[];
  documents: PortalDocumentRow[];
};

type PackageAvailability = {
  enabled: boolean;
  reason?: string;
};

type PackageStatus = {
  phase: string;
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
  workflow: ChiChiDocumentPackageWorkflow;
  packageId: string;
  flow: ChiChiDocumentPackageFlow;
  launchUrl: string | null;
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
  flow: ChiChiDocumentPackageFlow;
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
  const integrations = getZohoDocumentPackageIntegrations(key);
  return {
    zohoFormsUrl: integrations.formsUrl,
    zohoWriterUrl: integrations.writerTemplateUrl,
    zohoSignUrl: integrations.signUrl,
    writerTemplateId: integrations.writerTemplateId,
    signOrgId: integrations.signOrgId,
    signRequestTypeId: integrations.signRequestTypeId,
    flow: integrations.flow,
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
    flow: integrations.flow,
  };
}

function resolvePreferredLaunchUrl(params: {
  flow: ChiChiDocumentPackageFlow;
  launches: LaunchOptions;
  currentLaunchUrl?: string | null;
  signEmbedUrl?: string | null;
}) {
  if (params.signEmbedUrl) return params.signEmbedUrl;
  if (params.currentLaunchUrl) return params.currentLaunchUrl;

  if (params.flow === "zoho_writer_sign") {
    return params.launches.zohoSignUrl || params.launches.portalReviewUrl;
  }

  if (params.flow === "zoho_forms") {
    return params.launches.zohoFormsUrl || params.launches.portalReviewUrl;
  }

  return params.launches.portalReviewUrl;
}

function shouldOverrideActiveFlow(
  current: ChiChiDocumentPackageWorkflow | null,
  nextFlow: ChiChiDocumentPackageFlow
) {
  if (!current?.active_flow) return true;
  if (current.active_flow === nextFlow) return false;

  const currentStatus = String(current.package_status || "").trim().toLowerCase();

  if (
    current.active_flow === "portal_fallback" &&
    (nextFlow === "zoho_writer_sign" || nextFlow === "zoho_forms")
  ) {
    return !["sent_to_sign", "signed", "filed"].includes(currentStatus);
  }

  if (
    current.active_flow === "zoho_forms" &&
    nextFlow === "zoho_writer_sign"
  ) {
    return !["sent_to_sign", "signed", "filed"].includes(currentStatus);
  }

  return false;
}

function findSignedCopy(
  packageId: string,
  definition: ChiChiPackageDefinition,
  documents: PortalDocumentRow[]
) {
  const normalizedTitle = normalizeName(definition.title);
  const packageMatch = findChiChiPackageDocument(packageId, documents);
  if (packageMatch) return packageMatch as PortalDocumentRow;

  return (
    sortDesc(documents).find((document) => {
      const title = normalizeName(document.title);
      const fileName = normalizeName(document.file_name);
      const category = normalizeName(document.category);

      return (
        title.includes(normalizedTitle) ||
        fileName.includes(normalizedTitle) ||
        category === normalizeName(definition.category)
      );
    }) || null
  );
}

function buildPackageWorkflow(
  definition: ChiChiPackageDefinition,
  context: PackageContext,
  submission: DocumentLikeFormSubmission | null,
  launches: LaunchOptions
) {
  const current = extractChiChiDocumentPackageWorkflow(submission);
  const packageId =
    current?.package_id ||
    buildChiChiDocumentPackageId({
      packageKey: definition.key,
      buyerId: context.buyer?.id ?? null,
      userId: context.buyer?.user_id || context.user.id || null,
    });

  const activeFlow = shouldOverrideActiveFlow(current, launches.flow)
    ? launches.flow
    : current?.active_flow || launches.flow;

  const launchUrl = resolvePreferredLaunchUrl({
    flow: activeFlow,
    launches,
    currentLaunchUrl:
      shouldOverrideActiveFlow(current, launches.flow) ? null : current?.launch_url || null,
    signEmbedUrl:
      shouldOverrideActiveFlow(current, launches.flow) ? null : current?.zoho?.sign_embed_url || null,
  });

  return mergeChiChiDocumentPackageWorkflow(current, {
    package_id: packageId,
    package_key: definition.key,
    package_title: definition.title,
    buyer_id: context.buyer?.id ?? null,
    puppy_id: context.puppy?.id ?? null,
    user_id: context.buyer?.user_id || context.user.id || null,
    preferred_flow: launches.flow,
    active_flow: activeFlow,
    launch_url: launchUrl,
    flow_detail:
      activeFlow === "zoho_writer_sign"
        ? "ChiChi is using Zoho Writer and Zoho Sign for the formal document path."
        : activeFlow === "zoho_forms"
          ? "ChiChi is using Zoho Forms because the buyer still needs to review or update structured fields."
          : "ChiChi is falling back to the native portal signing flow.",
    zoho: {
      ...(current?.zoho || {}),
      forms_url: launches.zohoFormsUrl,
    },
  });
}

function buildPackageStatus(
  definition: ChiChiPackageDefinition,
  workflow: ChiChiDocumentPackageWorkflow,
  launches: LaunchOptions,
  submission: DocumentLikeFormSubmission | null,
  signedCopy: PortalDocumentRow | null
): PackageStatus {
  const status = resolveChiChiDocumentPackageStatus({
    workflow,
    submission,
    signedCopy,
  });

  if (status === "filed") {
    return {
      phase: status,
      label: formatChiChiDocumentPackageStatus(status),
      detail: signedCopy?.file_name
        ? `${definition.title} has been filed as ${signedCopy.file_name}.`
        : `${definition.title} has a final signed copy on file.`,
      complete: true,
    };
  }

  if (status === "signed") {
    return {
      phase: status,
      label: formatChiChiDocumentPackageStatus(status),
      detail:
        "The document has been signed, but ChiChi still needs to confirm or file the final copy.",
      complete: false,
    };
  }

  if (status === "sent_to_sign") {
    return {
      phase: status,
      label: formatChiChiDocumentPackageStatus(status),
      detail:
        "ChiChi sent this package into Zoho Sign and is waiting for the buyer to complete signature.",
      complete: false,
    };
  }

  if (status === "awaiting_buyer_input") {
    return {
      phase: status,
      label: formatChiChiDocumentPackageStatus(status),
      detail:
        launches.zohoFormsUrl
          ? "ChiChi is waiting on buyer review through Zoho Forms before the final document can be generated."
          : "This package still needs buyer-supplied inputs before it can move into signature.",
      complete: false,
    };
  }

  if (status === "ready_for_signature") {
    return {
      phase: status,
      label: formatChiChiDocumentPackageStatus(status),
      detail:
        "The review copy is complete enough to move into signature once ChiChi launches the next step.",
      complete: false,
    };
  }

  if (status === "needs_review") {
    return {
      phase: status,
      label: formatChiChiDocumentPackageStatus(status),
      detail:
        workflow.review_note ||
        "ChiChi needs one more review pass before this package can keep moving.",
      complete: false,
    };
  }

  if (status === "fallback_portal_flow") {
    return {
      phase: status,
      label: formatChiChiDocumentPackageStatus(status),
      detail:
        "Zoho launch details are missing, so ChiChi is keeping this package on the native portal signing path.",
      complete: false,
    };
  }

  return {
    phase: status,
    label: formatChiChiDocumentPackageStatus(status),
    detail:
      "ChiChi has enough buyer and puppy context to prepare the package and launch the next workflow step.",
    complete: false,
  };
}

function buildChiChiNote(
  definition: ChiChiPackageDefinition,
  context: PackageContext,
  itemFlow: ChiChiDocumentPackageFlow
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
    itemFlow === "zoho_writer_sign"
      ? "Zoho Writer and Zoho Sign are configured as the formal document path."
      : itemFlow === "zoho_forms"
        ? "Zoho Forms is configured for the buyer-facing intake step."
        : "This package will stay on the native portal fallback path until Zoho document settings are added.",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildPreparedPackage(
  definition: ChiChiPackageDefinition,
  context: PackageContext,
  origin: string,
  canManageAnyBuyer: boolean
) {
  const submission = findMatchingDocumentSubmission(definition, context.forms);
  const availability = definition.getAvailability(contextForPacket(context));
  const integrations = getPackageIntegrations(definition.key);
  const launches = buildLaunchOptions(
    origin,
    definition,
    context.buyer,
    integrations,
    canManageAnyBuyer
  );
  const prefill = getDocumentInitialData(
    definition,
    contextForPacket(context),
    submission || undefined
  );
  const workflow = buildPackageWorkflow(definition, context, submission, launches);
  const signedCopy = findSignedCopy(workflow.package_id, definition, context.documents);
  const status = buildPackageStatus(definition, workflow, launches, submission, signedCopy);
  const flow = workflow.active_flow || launches.flow;
  const note = buildChiChiNote(definition, context, flow);
  const launchUrl = resolvePreferredLaunchUrl({
    flow,
    launches,
    currentLaunchUrl: workflow.launch_url || null,
    signEmbedUrl: workflow.zoho?.sign_embed_url || null,
  });

  return {
    definition,
    availability,
    submission,
    signedCopy,
    workflow,
    packageId: workflow.package_id,
    flow,
    launchUrl,
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
    item.prefill["adoption_date"] ? `Adoption: ${String(item.prefill["adoption_date"])}` : null,
    item.prefill["delivery_date"] ? `Date: ${String(item.prefill["delivery_date"])}` : null,
    item.prefill["delivery_location"]
      ? `Location: ${String(item.prefill["delivery_location"])}`
      : null,
    item.prefill["clinic_name"] ? `Clinic: ${String(item.prefill["clinic_name"])}` : null,
    item.prefill["clinic_phone"] ? `Clinic phone: ${String(item.prefill["clinic_phone"])}` : null,
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
  const rows: PackageFormSubmission[] = [];
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
      rows.push(...(byUserId.data as PackageFormSubmission[]));
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
      rows.push(...(byBuyerUserId.data as PackageFormSubmission[]));
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
      rows.push(...(byUserEmail.data as PackageFormSubmission[]));
    }
    if (!byEmail.error && byEmail.data?.length) {
      rows.push(...(byEmail.data as PackageFormSubmission[]));
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

function preparedPackagesForContext(
  context: PackageContext,
  origin: string,
  canManageAnyBuyer: boolean
) {
  return PACKAGE_DEFINITIONS.map((definition) =>
    buildPreparedPackage(definition, context, origin, canManageAnyBuyer)
  );
}

function launchUrlForPackage(item: PreparedPackage, launches: LaunchOptions) {
  return resolvePreferredLaunchUrl({
    flow: item.flow,
    launches,
    currentLaunchUrl: item.launchUrl,
    signEmbedUrl: item.workflow.zoho?.sign_embed_url || null,
  });
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
  if (item.workflow.zoho?.sign_request_id) {
    lines.push(`- Zoho Sign request id: ${item.workflow.zoho.sign_request_id}`);
  }
  if (item.workflow.zoho?.sign_embed_url) {
    lines.push(`- Live signer path: ${item.workflow.zoho.sign_embed_url}`);
  }

  lines.push(
    "",
    "Workflow:",
    "1. ChiChi prepares the package from the live buyer, puppy, pricing, and transportation context.",
    item.flow === "zoho_writer_sign"
      ? "2. ChiChi merged the live data into the Zoho Writer template and sent the document into Zoho Sign."
      : item.flow === "zoho_forms"
        ? "2. Buyer review should open through Zoho Forms before the final document is generated."
        : "2. ChiChi kept this package on the fallback portal review and signature path.",
    "3. Once signature is complete, ChiChi syncs the finished copy back into portal documents and admin records."
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
    `- Package id: ${item.packageId}`,
    `- Flow: ${item.flow}`,
    item.submission?.status ? `- Form copy: ${item.submission.status}` : "- Form copy: not created yet",
    item.submission?.submitted_at ? `- Submitted at: ${item.submission.submitted_at}` : null,
    item.submission?.signed_at ? `- Signed at: ${item.submission.signed_at}` : null,
    item.workflow.zoho?.sign_request_id
      ? `- Zoho Sign request: ${item.workflow.zoho.sign_request_id}`
      : null,
    item.workflow.zoho?.sign_request_status
      ? `- Zoho request status: ${item.workflow.zoho.sign_request_status}`
      : null,
    item.signedCopy?.file_name
      ? `- Signed portal file: ${item.signedCopy.file_name}`
      : item.signedCopy
        ? "- Signed portal file: on file"
        : "- Signed portal file: not synced yet",
    `- Buyer review link: ${launches.portalReviewUrl}`,
    item.workflow.zoho?.sign_embed_url
      ? `- Live signer path: ${item.workflow.zoho.sign_embed_url}`
      : launches.zohoSignUrl
        ? `- Zoho Sign: ${launches.zohoSignUrl}`
        : null,
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
      `Package id: ${item.packageId}`,
      item.signedCopy.file_url ? `Portal file: ${item.signedCopy.file_url}` : null,
      launches.adminReviewUrl ? `Admin record view: ${launches.adminReviewUrl}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (
    item.workflow.zoho?.sign_request_status &&
    ["completed", "signed"].includes(item.workflow.zoho.sign_request_status.toLowerCase())
  ) {
    return [
      `ChiChi checked the ${item.definition.title} sync for ${buyerDisplayName(context.buyer, context.user)}.`,
      "",
      "Zoho Sign shows the package as completed, and ChiChi is waiting to confirm or file the final PDF into portal documents.",
      item.workflow.zoho?.sign_request_id
        ? `Zoho Sign request: ${item.workflow.zoho.sign_request_id}`
        : null,
      "Next step: sync the package to pull the signed PDF back into the portal and admin record.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (item.submission) {
    return [
      `ChiChi checked the ${item.definition.title} sync for ${buyerDisplayName(context.buyer, context.user)}.`,
      "",
      "The package exists and is still moving through review or signature.",
      `Current status: ${item.status.label}`,
      `Current flow: ${item.flow}`,
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

const DOCUMENT_BUCKET = "portal-documents";

function sanitizeFileStem(value: string) {
  return String(value || "document")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function buildPackageFileName(
  definition: ChiChiPackageDefinition,
  context: PackageContext
) {
  const buyerName = sanitizeFileStem(buyerDisplayName(context.buyer, context.user));
  const puppyName = sanitizeFileStem(puppyDisplayName(context));
  const shortTitle = sanitizeFileStem(definition.shortTitle || definition.title);
  return `${buyerName}-${puppyName}-${shortTitle}.pdf`;
}

async function ensureDocumentBucket(admin: SupabaseClient) {
  const current = await admin.storage.getBucket(DOCUMENT_BUCKET);
  if (!current.error) return;

  const createResult = await admin.storage.createBucket(DOCUMENT_BUCKET, {
    public: true,
    fileSizeLimit: 25 * 1024 * 1024,
  });

  if (
    createResult.error &&
    !String(createResult.error.message || "")
      .toLowerCase()
      .includes("already exists")
  ) {
    throw createResult.error;
  }
}

function buildWorkflowPayload(
  submission: DocumentLikeFormSubmission | null,
  prefill: Record<string, unknown>,
  workflow: ChiChiDocumentPackageWorkflow
) {
  const base =
    (submission?.payload &&
    typeof submission.payload === "object" &&
    !Array.isArray(submission.payload)
      ? submission.payload
      : submission?.data &&
          typeof submission.data === "object" &&
          !Array.isArray(submission.data)
        ? submission.data
        : prefill) || prefill;

  return attachChiChiWorkflowToPayload(base, workflow);
}

async function updatePackageSubmissionWorkflow(
  admin: SupabaseClient,
  submission: PackageFormSubmission | null,
  prefill: Record<string, unknown>,
  workflow: ChiChiDocumentPackageWorkflow,
  nextStatus?: string | null
) {
  if (!submission?.id) return submission;

  const payload = buildWorkflowPayload(submission, prefill, workflow);
  const result = await admin
    .from("portal_form_submissions")
    .update({
      status: nextStatus || submission.status,
      signed_at: workflow.signed_at || submission.signed_at || null,
      data: payload,
      payload,
    })
    .eq("id", submission.id)
    .select(
      "id,user_id,user_email,email,form_key,form_title,version,signed_name,signed_date,signed_at,data,payload,status,submitted_at,attachments,created_at,updated_at"
    )
    .single();

  if (result.error) throw result.error;
  return result.data as PackageFormSubmission;
}

async function upsertPreparedSubmission(
  admin: SupabaseClient,
  context: PackageContext,
  item: PreparedPackage,
  launches: LaunchOptions
) {
  const existing = item.submission;
  const nowIso = new Date().toISOString();
  const nextLaunchUrl = resolvePreferredLaunchUrl({
    flow: item.workflow.active_flow || launches.flow,
    launches,
    currentLaunchUrl: item.workflow.launch_url || null,
    signEmbedUrl: item.workflow.zoho?.sign_embed_url || null,
  });

  const workflow = mergeChiChiDocumentPackageWorkflow(item.workflow, {
    prepared_at: item.workflow.prepared_at || nowIso,
    package_status:
      item.workflow.active_flow === "zoho_forms"
        ? "awaiting_buyer_input"
        : item.workflow.active_flow === "portal_fallback"
          ? "fallback_portal_flow"
          : "prepared",
    launch_url: nextLaunchUrl,
    zoho: {
      ...(item.workflow.zoho || {}),
      forms_url: launches.zohoFormsUrl,
      writer_template_id: getPackageIntegrations(item.definition.key).writerTemplateId,
    },
  });

  const payload = buildWorkflowPayload(existing, item.prefill, workflow);

  const basePayload = {
    user_id: context.buyer?.user_id || context.user.id || null,
    user_email: normalizeEmail(context.user.email) || normalizeEmail(context.buyer?.email) || null,
    email: normalizeEmail(context.buyer?.email) || normalizeEmail(context.user.email) || null,
    form_key: item.definition.formKey,
    form_title: item.definition.title,
    version: "2026-04",
    status:
      workflow.package_status === "awaiting_buyer_input"
        ? "prepared"
        : workflow.package_status === "fallback_portal_flow"
          ? existing?.status || "draft"
          : "prepared",
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
    return result.data as PackageFormSubmission;
  }

  const result = await admin
    .from("portal_form_submissions")
    .insert(basePayload)
    .select(
      "id,user_id,user_email,email,form_key,form_title,version,signed_name,signed_date,signed_at,data,payload,status,submitted_at,attachments,created_at,updated_at"
    )
    .single();
  if (result.error) throw result.error;
  return result.data as PackageFormSubmission;
}

async function fileSignedPackageDocument(
  admin: SupabaseClient,
  context: PackageContext,
  item: PreparedPackage,
  params: {
    buffer: Uint8Array;
    contentType: string;
    fileName?: string | null;
    sourceLabel?: string | null;
    signedAt?: string | null;
  }
) {
  await ensureDocumentBucket(admin);

  const fileName = sanitizeFileStem(
    params.fileName || buildPackageFileName(item.definition, context)
  );
  const storagePath = `packages/${item.packageId}/${Date.now()}-${fileName || "signed-document.pdf"}`;

  const uploadResult = await admin.storage.from(DOCUMENT_BUCKET).upload(storagePath, params.buffer, {
    contentType: params.contentType || "application/pdf",
    upsert: false,
    cacheControl: "3600",
  });

  if (uploadResult.error) throw uploadResult.error;

  const publicUrl = admin.storage.from(DOCUMENT_BUCKET).getPublicUrl(storagePath).data.publicUrl;
  const sourceTable = buildChiChiDocumentPackageSource(item.packageId);
  const existingDocument = await admin
    .from("portal_documents")
    .select(
      "id,user_id,buyer_id,title,description,category,status,created_at,source_table,file_name,file_url,visible_to_user,signed_at"
    )
    .eq("source_table", sourceTable)
    .limit(1)
    .maybeSingle<PortalDocumentRow>();

  const payload = {
    user_id: context.buyer?.user_id || context.user.id || null,
    buyer_id: context.buyer?.id ?? null,
    title: item.definition.title,
    description:
      params.sourceLabel
        ? `${item.definition.title} completed through ${params.sourceLabel}.`
        : `${item.definition.title} filed by ChiChi.`,
    category: item.definition.category,
    status: "filed",
    source_table: sourceTable,
    file_url: publicUrl || null,
    file_name: fileName,
    visible_to_user: true,
    signed_at: params.signedAt || new Date().toISOString(),
  };

  const documentResult = existingDocument.data?.id
    ? await admin
        .from("portal_documents")
        .update(payload)
        .eq("id", existingDocument.data.id)
        .select(
          "id,user_id,buyer_id,title,description,category,status,created_at,source_table,file_name,file_url,visible_to_user,signed_at"
        )
        .single()
    : await admin
        .from("portal_documents")
        .insert(payload)
        .select(
          "id,user_id,buyer_id,title,description,category,status,created_at,source_table,file_name,file_url,visible_to_user,signed_at"
        )
        .single();

  if (documentResult.error) throw documentResult.error;

  const filedWorkflow = mergeChiChiDocumentPackageWorkflow(item.workflow, {
    package_status: "filed",
    signed_at: params.signedAt || item.workflow.signed_at || new Date().toISOString(),
    filed_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
    final_document_id: String(documentResult.data.id),
    final_document_name: documentResult.data.file_name || fileName,
    final_document_url: documentResult.data.file_url || publicUrl || null,
    launch_url: documentResult.data.file_url || publicUrl || item.workflow.launch_url || null,
    zoho: {
      ...(item.workflow.zoho || {}),
      sign_completed_document_url: documentResult.data.file_url || publicUrl || null,
      sign_completed_document_name: documentResult.data.file_name || fileName,
    },
  });

  const submission = await updatePackageSubmissionWorkflow(
    admin,
    item.submission,
    item.prefill,
    filedWorkflow,
    "submitted"
  );

  return {
    document: documentResult.data as PortalDocumentRow,
    submission,
    workflow: filedWorkflow,
  };
}

async function launchPreparedPackage(
  admin: SupabaseClient,
  context: PackageContext,
  item: PreparedPackage,
  launches: LaunchOptions
) {
  let submission = await upsertPreparedSubmission(admin, context, item, launches);
  let workflow = extractChiChiDocumentPackageWorkflow(submission) || item.workflow;
  const buyerEmail = normalizeEmail(context.buyer?.email) || normalizeEmail(context.user.email);
  const buyerName = buyerDisplayName(context.buyer, context.user);

  if (item.flow === "zoho_writer_sign") {
    if (!buyerEmail) {
      workflow = mergeChiChiDocumentPackageWorkflow(workflow, {
        active_flow: "zoho_writer_sign",
        package_status: "needs_review",
        review_note:
          "ChiChi could not send this package to Zoho Sign because the buyer email is missing.",
        launch_url: launches.portalReviewUrl,
      });

      const updatedSubmission = await updatePackageSubmissionWorkflow(
        admin,
        submission,
        item.prefill,
        workflow,
        submission?.status || "prepared"
      );

      submission = updatedSubmission || submission;
      return { submission, workflow, launchUrl: launches.portalReviewUrl };
    }

    if (!workflow.zoho?.sign_request_id) {
      const zohoLaunch = await createZohoWriterSignRequest({
        packageKey: item.definition.key,
        filename: buildPackageFileName(item.definition, context),
        mergeData: item.prefill,
        recipientEmail: buyerEmail,
        recipientName: buyerName,
        privateNotes: item.note,
      });

      const writerLaunchUrl =
        zohoLaunch.signEmbedUrl ||
        launches.zohoSignUrl ||
        launches.portalReviewUrl;

      workflow = mergeChiChiDocumentPackageWorkflow(workflow, {
        active_flow: "zoho_writer_sign",
        package_status: "sent_to_sign",
        sent_to_sign_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        launch_url: writerLaunchUrl,
        zoho: {
          ...(workflow.zoho || {}),
          sign_request_id: zohoLaunch.signRequestId,
          sign_request_status: zohoLaunch.signRequestStatus,
          sign_action_id: zohoLaunch.signActionId,
          sign_document_id: zohoLaunch.signDocumentId,
          sign_embed_url: zohoLaunch.signEmbedUrl,
          writer_merge_report_url: zohoLaunch.writerMergeReportUrl,
          writer_merge_report_data_url: zohoLaunch.writerMergeReportDataUrl,
          writer_download_link: zohoLaunch.writerDownloadLink,
        },
      });

      const updatedSubmission = await updatePackageSubmissionWorkflow(
        admin,
        submission,
        item.prefill,
        workflow,
        submission?.status || "prepared"
      );

      submission = updatedSubmission || submission;
    }

    return {
      submission,
      workflow,
      launchUrl: resolvePreferredLaunchUrl({
        flow: "zoho_writer_sign",
        launches,
        currentLaunchUrl: workflow.launch_url || null,
        signEmbedUrl: workflow.zoho?.sign_embed_url || null,
      }),
    };
  }

  if (item.flow === "zoho_forms") {
    workflow = mergeChiChiDocumentPackageWorkflow(workflow, {
      active_flow: "zoho_forms",
      package_status: "awaiting_buyer_input",
      launch_url: launches.zohoFormsUrl || launches.portalReviewUrl,
      last_synced_at: new Date().toISOString(),
    });

    const updatedSubmission = await updatePackageSubmissionWorkflow(
      admin,
      submission,
      item.prefill,
      workflow,
      submission?.status || "prepared"
    );

    submission = updatedSubmission || submission;
    return {
      submission,
      workflow,
      launchUrl: launches.zohoFormsUrl || launches.portalReviewUrl,
    };
  }

  workflow = mergeChiChiDocumentPackageWorkflow(workflow, {
    active_flow: "portal_fallback",
    package_status: "fallback_portal_flow",
    launch_url: launches.portalReviewUrl,
    last_synced_at: new Date().toISOString(),
  });

  {
    const updatedSubmission = await updatePackageSubmissionWorkflow(
      admin,
      submission,
      item.prefill,
      workflow,
      submission?.status || "draft"
    );
    submission = updatedSubmission || submission;
  }

  return {
    submission,
    workflow,
    launchUrl: launches.portalReviewUrl,
  };
}

async function syncPreparedPackage(
  admin: SupabaseClient,
  context: PackageContext,
  item: PreparedPackage,
  launches: LaunchOptions
) {
  if (item.signedCopy && item.status.phase === "filed") {
    return {
      submission: item.submission,
      workflow: item.workflow,
      document: item.signedCopy,
      launchUrl: item.signedCopy.file_url || item.launchUrl || launches.portalReviewUrl,
    };
  }

  const signRequestId = item.workflow.zoho?.sign_request_id;
  if (!signRequestId) {
    return {
      submission: item.submission,
      workflow: item.workflow,
      document: item.signedCopy,
      launchUrl: item.signedCopy?.file_url || item.launchUrl || launches.portalReviewUrl,
    };
  }

  const details = await getZohoSignRequestDetails(signRequestId);

  const workflow = mergeChiChiDocumentPackageWorkflow(item.workflow, {
    package_status:
      details.requestStatus &&
      ["completed", "signed"].includes(details.requestStatus.toLowerCase())
        ? "signed"
        : details.requestStatus &&
            ["declined", "expired", "recalled"].includes(
              details.requestStatus.toLowerCase()
            )
          ? "needs_review"
          : "sent_to_sign",
    signed_at:
      details.requestStatus &&
      ["completed", "signed"].includes(details.requestStatus.toLowerCase())
        ? item.workflow.signed_at || new Date().toISOString()
        : item.workflow.signed_at || null,
    last_synced_at: new Date().toISOString(),
    launch_url: resolvePreferredLaunchUrl({
      flow: item.flow,
      launches,
      currentLaunchUrl: item.workflow.launch_url || null,
      signEmbedUrl: item.workflow.zoho?.sign_embed_url || null,
    }),
    zoho: {
      ...(item.workflow.zoho || {}),
      sign_request_id: details.requestId,
      sign_request_status: details.requestStatus,
      sign_action_id: details.actionId,
      sign_document_id: details.documentId,
    },
  });

  const updatedSubmission = await updatePackageSubmissionWorkflow(
    admin,
    item.submission,
    item.prefill,
    workflow,
    workflow.package_status === "signed" ? "submitted" : item.submission?.status || "prepared"
  );

  const submission = updatedSubmission || item.submission;

  if (details.requestStatus && ["completed", "signed"].includes(details.requestStatus.toLowerCase())) {
    if (item.signedCopy) {
      return {
        submission,
        workflow,
        document: item.signedCopy,
        launchUrl: item.signedCopy.file_url || launches.portalReviewUrl,
      };
    }

    const download = await downloadZohoSignCompletedDocument({
      requestId: details.requestId,
      documentId: details.documentId,
    });

    const filed = await fileSignedPackageDocument(
      admin,
      context,
      {
        ...item,
        submission,
        workflow,
      },
      {
        buffer: download.buffer,
        contentType: download.contentType,
        fileName:
          download.fileName ||
          details.documentName ||
          buildPackageFileName(item.definition, context),
        sourceLabel: "Zoho Sign",
        signedAt: workflow.signed_at || new Date().toISOString(),
      }
    );

    return {
      submission: filed.submission,
      workflow: filed.workflow,
      document: filed.document,
      launchUrl: filed.document.file_url || launches.portalReviewUrl,
    };
  }

  return {
    submission,
    workflow,
    document: item.signedCopy,
    launchUrl: item.launchUrl || launches.portalReviewUrl,
  };
}

const PACKAGE_FORM_KEYS = Array.from(
  new Set(
    PACKAGE_DEFINITIONS.flatMap((definition) => [
      definition.formKey,
      ...(definition.aliases || []),
    ])
  )
);

async function findPackageSubmissionBySignRequestId(
  admin: SupabaseClient,
  requestId: string
) {
  const result = await admin
    .from("portal_form_submissions")
    .select(
      "id,user_id,user_email,email,form_key,form_title,version,signed_name,signed_date,signed_at,data,payload,status,submitted_at,attachments,created_at,updated_at"
    )
    .in("form_key", PACKAGE_FORM_KEYS)
    .order("updated_at", { ascending: false })
    .limit(250);

  if (result.error) throw result.error;

  return (
    (result.data as PackageFormSubmission[]).find((submission) => {
      const workflow = extractChiChiDocumentPackageWorkflow(submission);
      return workflow?.zoho?.sign_request_id === requestId;
    }) || null
  );
}

export async function syncChiChiDocumentPackageFromZohoSignWebhook(
  admin: SupabaseClient,
  params: {
    requestId?: string | null;
    eventType?: string | null;
    origin: string;
  }
) {
  const requestId = String(params.requestId || "").trim();
  if (!requestId) {
    return { handled: false, reason: "missing_request_id" as const };
  }

  const submission = await findPackageSubmissionBySignRequestId(admin, requestId);
  if (!submission) {
    return { handled: false, reason: "package_not_found" as const };
  }

  const workflow = extractChiChiDocumentPackageWorkflow(submission);
  if (!workflow?.package_key) {
    return { handled: false, reason: "workflow_missing" as const };
  }

  const definition = PACKAGE_DEFINITION_MAP[workflow.package_key as ChiChiDocumentPackageKey];
  if (!definition) {
    return { handled: false, reason: "definition_missing" as const };
  }

  const fakeUser = {
    id: submission.user_id || workflow.user_id || "",
    email: submission.user_email || submission.email || "",
  } as User;

  const resolved = await resolvePackageContext(admin, {
    user: fakeUser,
    canManageAnyBuyer: true,
    buyerId: workflow.buyer_id ?? null,
    buyerEmail: submission.email || submission.user_email || null,
  });

  if (!resolved.context) {
    return { handled: false, reason: "context_missing" as const };
  }

  const launches = buildLaunchOptions(
    params.origin,
    definition,
    resolved.context.buyer,
    getPackageIntegrations(definition.key),
    true
  );

  const item = buildPreparedPackage(definition, resolved.context, params.origin, true);
  const synced = await syncPreparedPackage(admin, resolved.context, item, launches);

  const nextWorkflow = mergeChiChiDocumentPackageWorkflow(
    extractChiChiDocumentPackageWorkflow(synced.submission || submission) || workflow,
    {
      last_synced_at: new Date().toISOString(),
      zoho: {
        ...(extractChiChiDocumentPackageWorkflow(synced.submission || submission)?.zoho ||
          workflow.zoho ||
          {}),
        sign_request_id: requestId,
        sign_webhook_event_type: String(params.eventType || "").trim() || null,
        sign_last_event_at: new Date().toISOString(),
      },
    }
  );

  if (synced.submission) {
    await updatePackageSubmissionWorkflow(
      admin,
      synced.submission,
      item.prefill,
      nextWorkflow,
      synced.submission.status
    );
  }

  return {
    handled: true,
    packageKey: definition.key,
    packageId: item.packageId,
    status: nextWorkflow.package_status,
    filed: Boolean(synced.document?.file_url),
  };
}

export async function listChiChiDocumentPackages(
  admin: SupabaseClient,
  options: ResolveOptions
): Promise<string> {
  const resolved = await resolvePackageContext(admin, options);
  if (!resolved.context) {
    return resolved.proposalText || "ChiChi could not resolve the buyer file for the document workflow yet.";
  }

  return buildListText(
    resolved.context,
    preparedPackagesForContext(
      resolved.context,
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      options.canManageAnyBuyer
    )
  );
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

  const origin = params.origin || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const item = buildPreparedPackage(definition, resolved.context, origin, params.canManageAnyBuyer);
  const launches = buildLaunchOptions(
    origin,
    definition,
    resolved.context.buyer,
    getPackageIntegrations(definition.key),
    params.canManageAnyBuyer
  );

  return {
    text: buildStatusText(item, resolved.context, launches),
    launchUrl: launchUrlForPackage(item, launches),
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

  let item = buildPreparedPackage(
    definition,
    resolved.context,
    params.origin,
    params.canManageAnyBuyer
  );

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

  const launched = await launchPreparedPackage(admin, resolved.context, item, launches);
  const refreshed = await resolvePackageContext(admin, params);
  const context = refreshed.context || resolved.context;
  item = buildPreparedPackage(
    definition,
    context,
    params.origin,
    params.canManageAnyBuyer
  );

  return {
    text: buildPreparedText(item, context, launches),
    launchUrl: launched.launchUrl || launchUrlForPackage(item, launches),
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

  let item = buildPreparedPackage(
    definition,
    resolved.context,
    params.origin,
    params.canManageAnyBuyer
  );

  const launches = buildLaunchOptions(
    params.origin,
    definition,
    resolved.context.buyer,
    getPackageIntegrations(definition.key),
    params.canManageAnyBuyer
  );

  const synced = await syncPreparedPackage(admin, resolved.context, item, launches);
  const refreshed = await resolvePackageContext(admin, params);
  const context = refreshed.context || resolved.context;
  item = buildPreparedPackage(
    definition,
    context,
    params.origin,
    params.canManageAnyBuyer
  );

  return {
    text: buildSyncText(item, context, launches),
    launchUrl:
      synced.launchUrl ||
      item.signedCopy?.file_url ||
      launchUrlForPackage(item, launches),
    packageKey: definition.key,
  };
}