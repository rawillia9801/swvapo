import type {
  PortalApplication,
  PortalBuyer,
  PortalDocument,
  PortalFormSubmission,
  PortalPuppy,
} from "@/lib/portal-data";

export type PortalDocumentFieldType =
  | "checkbox"
  | "text"
  | "textarea"
  | "date"
  | "currency";

export type PortalDocumentField = {
  key: string;
  label: string;
  type: PortalDocumentFieldType;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  rows?: number;
};

export type PortalDocumentPacketContext = {
  buyer: PortalBuyer | null;
  application: PortalApplication | null;
  puppy: PortalPuppy | null;
  documents?: PortalDocument[] | null;
};

export type PortalDocumentDefinition = {
  key: string;
  formKey: string;
  aliases?: string[];
  title: string;
  shortTitle: string;
  category: string;
  description: string;
  completionSummary: string;
  mode: "form" | "link";
  href?: string;
  fields: PortalDocumentField[];
  getInitialData: (context: PortalDocumentPacketContext) => Record<string, unknown>;
  getAvailability: (context: PortalDocumentPacketContext) => {
    enabled: boolean;
    reason?: string;
  };
};

export type PortalDocumentStatus = {
  label: string;
  tone: "success" | "warning" | "neutral";
  complete: boolean;
};

export type DocumentLikeFormSubmission = Pick<
  PortalFormSubmission,
  | "id"
  | "form_key"
  | "form_title"
  | "status"
  | "version"
  | "signed_name"
  | "signed_date"
  | "signed_at"
  | "submitted_at"
  | "created_at"
  | "updated_at"
> & {
  data?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
};

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

function documentToday() {
  return new Date().toISOString().slice(0, 10);
}

function bool(value: unknown) {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return ["true", "1", "yes", "y", "on"].includes(normalized);
}

function numberString(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount > 0 ? String(amount) : "";
}

function puppyName(context: PortalDocumentPacketContext) {
  return (
    firstFilled(
      context.puppy?.call_name,
      context.puppy?.puppy_name,
      context.puppy?.name,
      context.buyer?.full_name ? `${context.buyer.full_name}'s puppy` : ""
    ) || "your puppy"
  );
}

function deliveryMethod(context: PortalDocumentPacketContext) {
  return firstFilled(context.buyer?.delivery_option, "pickup");
}

export const portalDocumentPacket: PortalDocumentDefinition[] = [
  {
    key: "portal-terms",
    formKey: "portal_terms_of_service",
    title: "Portal Terms of Service",
    shortTitle: "Portal Terms",
    category: "Portal Access",
    description:
      "This signature keeps portal messaging, document delivery, account security, and payment handling expectations on file.",
    completionSummary:
      "The signed portal terms stay with your account so both you and the breeder can see the active access agreement.",
    mode: "form",
    fields: [
      {
        key: "portal_records_ack",
        label: "I understand this portal stores my buyer records, payments, messages, and signed forms.",
        type: "checkbox",
        required: true,
      },
      {
        key: "secure_login_ack",
        label: "I will keep my login, payment links, and portal access private.",
        type: "checkbox",
        required: true,
      },
      {
        key: "message_updates_ack",
        label: "I agree to receive portal, email, and text updates tied to my placement file.",
        type: "checkbox",
        required: true,
      },
      {
        key: "secure_checkout_ack",
        label: "I understand card or bank details are handled through secure checkout, not in portal chat.",
        type: "checkbox",
        required: true,
      },
      {
        key: "notes",
        label: "Notes",
        type: "textarea",
        rows: 3,
        placeholder: "Add any questions or access notes for the breeder team.",
      },
      {
        key: "signed_name",
        label: "Full legal name",
        type: "text",
        required: true,
        placeholder: "Type your full name",
      },
      {
        key: "signed_date",
        label: "Date signed",
        type: "date",
        required: true,
      },
    ],
    getInitialData: () => ({
      portal_records_ack: true,
      secure_login_ack: true,
      message_updates_ack: true,
      secure_checkout_ack: true,
      notes: "",
      signed_name: "",
      signed_date: documentToday(),
    }),
    getAvailability: () => ({ enabled: true }),
  },
  {
    key: "application",
    formKey: "puppy_application",
    title: "Application",
    shortTitle: "Application",
    category: "Buyer Approval",
    description:
      "The full puppy application is the core buyer record and should stay easy to revisit after it is submitted.",
    completionSummary:
      "Your application copy stays tied to the portal once it is saved so both sides can reference the same household and preference details.",
    mode: "link",
    href: "/portal/application",
    fields: [],
    getInitialData: () => ({}),
    getAvailability: () => ({ enabled: true }),
  },
  {
    key: "deposit-agreement",
    formKey: "deposit_agreement",
    aliases: ["deposit_agreement_form"],
    title: "Deposit Agreement",
    shortTitle: "Deposit",
    category: "Placement",
    description:
      "Reserve terms, hold expectations, and the non-refundable deposit acknowledgment should stay signed in one place.",
    completionSummary:
      "The signed deposit agreement is saved into your portal file and the breeder's buyer record at the same time.",
    mode: "form",
    fields: [
      {
        key: "reserved_puppy",
        label: "Reserved puppy",
        type: "text",
        placeholder: "Name or describe the puppy being reserved",
      },
      {
        key: "deposit_amount",
        label: "Deposit amount",
        type: "currency",
        placeholder: "0.00",
      },
      {
        key: "ack_nonrefundable",
        label: "I understand deposits are non-refundable once the puppy is held for my household.",
        type: "checkbox",
        required: true,
      },
      {
        key: "ack_hold_specific",
        label: "I understand the deposit holds this specific puppy or approved placement.",
        type: "checkbox",
        required: true,
      },
      {
        key: "ack_review_sales_terms",
        label: "I reviewed the breeder's sale and placement terms before reserving the puppy.",
        type: "checkbox",
        required: true,
      },
      {
        key: "ack_confident_prepared",
        label: "I am financially and logistically prepared to move forward with this placement.",
        type: "checkbox",
        required: true,
      },
      {
        key: "notes",
        label: "Notes",
        type: "textarea",
        rows: 3,
        placeholder: "Add the puppy name, deposit notes, or timing details.",
      },
      {
        key: "signed_name",
        label: "Full legal name",
        type: "text",
        required: true,
        placeholder: "Type your full name",
      },
      {
        key: "signed_date",
        label: "Date signed",
        type: "date",
        required: true,
      },
    ],
    getInitialData: (context) => ({
      reserved_puppy: puppyName(context),
      deposit_amount: numberString(context.buyer?.deposit_amount),
      ack_nonrefundable: true,
      ack_hold_specific: true,
      ack_review_sales_terms: true,
      ack_confident_prepared: true,
      notes: "",
      signed_name: "",
      signed_date: documentToday(),
    }),
    getAvailability: () => ({ enabled: true }),
  },
  {
    key: "bill-of-sale",
    formKey: "bill_of_sale",
    title: "Bill of Sale",
    shortTitle: "Bill Of Sale",
    category: "Placement",
    description:
      "The bill of sale should capture the puppy, sale price, deposit credit, and release conditions in the portal file.",
    completionSummary:
      "Once signed, the bill of sale becomes the placement copy both you and the breeder reference before pickup or delivery.",
    mode: "form",
    fields: [
      {
        key: "puppy_name",
        label: "Puppy name",
        type: "text",
        required: true,
        placeholder: "Puppy name",
      },
      {
        key: "purchase_price",
        label: "Purchase price",
        type: "currency",
        placeholder: "0.00",
      },
      {
        key: "deposit_credit",
        label: "Deposit credit",
        type: "currency",
        placeholder: "0.00",
      },
      {
        key: "delivery_method",
        label: "Pickup or delivery method",
        type: "text",
        placeholder: "Pickup, meet-up, delivery, or transportation",
      },
      {
        key: "balance_due_ack",
        label: "I understand the full balance must be paid before release unless I am on an approved puppy payment plan.",
        type: "checkbox",
        required: true,
      },
      {
        key: "release_ack",
        label: "I understand registration papers and release documents are handled according to the breeder's paid-in-full policy.",
        type: "checkbox",
        required: true,
      },
      {
        key: "notes",
        label: "Notes",
        type: "textarea",
        rows: 3,
        placeholder: "Add any sale, balance, or release notes.",
      },
      {
        key: "signed_name",
        label: "Full legal name",
        type: "text",
        required: true,
        placeholder: "Type your full name",
      },
      {
        key: "signed_date",
        label: "Date signed",
        type: "date",
        required: true,
      },
    ],
    getInitialData: (context) => ({
      puppy_name: puppyName(context),
      purchase_price: numberString(context.puppy?.price || context.puppy?.list_price || context.buyer?.sale_price),
      deposit_credit: numberString(context.buyer?.deposit_amount),
      delivery_method: deliveryMethod(context),
      balance_due_ack: true,
      release_ack: true,
      notes: "",
      signed_name: "",
      signed_date: documentToday(),
    }),
    getAvailability: (context) =>
      context.puppy || context.buyer
        ? { enabled: true }
        : {
            enabled: false,
            reason: "This becomes available after a puppy is assigned to your buyer file.",
          },
  },
  {
    key: "health-guarantee",
    formKey: "healthcare_guarantee",
    title: "Health Guarantee",
    shortTitle: "Health Guarantee",
    category: "Health",
    description:
      "This signed record keeps the breeder health terms, first-vet timing, and care acknowledgements tied to the puppy file.",
    completionSummary:
      "The signed health guarantee stays visible to both sides so the puppy's release terms and care obligations are easy to reference.",
    mode: "form",
    fields: [
      {
        key: "good_health",
        label: "I understand the puppy is represented as being in good health at the time of release.",
        type: "checkbox",
        required: true,
      },
      {
        key: "vet_72",
        label: "I understand I must schedule a wellness exam with my veterinarian within 72 hours of receiving the puppy.",
        type: "checkbox",
        required: true,
      },
      {
        key: "genetic",
        label: "I reviewed the genetic or congenital guarantee terms explained by the breeder.",
        type: "checkbox",
        required: true,
      },
      {
        key: "remedy",
        label: "I understand the breeder remedy process if a covered health issue is documented.",
        type: "checkbox",
        required: true,
      },
      {
        key: "records",
        label: "I understand health records and care instructions will stay in the portal file.",
        type: "checkbox",
        required: true,
      },
      {
        key: "care",
        label: "I agree to provide routine veterinary care, nutrition, and safe housing for the puppy.",
        type: "checkbox",
        required: true,
      },
      {
        key: "notes",
        label: "Notes",
        type: "textarea",
        rows: 3,
        placeholder: "Add any breeder or veterinary notes you want stored with this guarantee.",
      },
      {
        key: "signed_name",
        label: "Full legal name",
        type: "text",
        required: true,
        placeholder: "Type your full name",
      },
      {
        key: "signed_date",
        label: "Date signed",
        type: "date",
        required: true,
      },
    ],
    getInitialData: () => ({
      good_health: true,
      vet_72: true,
      genetic: true,
      remedy: true,
      records: true,
      care: true,
      notes: "",
      signed_name: "",
      signed_date: documentToday(),
    }),
    getAvailability: (context) =>
      context.puppy || context.buyer
        ? { enabled: true }
        : {
            enabled: false,
            reason: "The health guarantee activates once a puppy is assigned to your file.",
          },
  },
  {
    key: "hypoglycemia-awareness",
    formKey: "hypoglycemia_awareness_form",
    title: "Hypoglycemia Awareness Form",
    shortTitle: "Hypoglycemia",
    category: "Health",
    description:
      "Toy-breed emergency awareness, warning signs, and first-response steps should stay signed inside the portal packet.",
    completionSummary:
      "This acknowledgement keeps the emergency care instructions attached to the puppy profile for quick review.",
    mode: "form",
    fields: [
      {
        key: "warn_shaking",
        label: "I reviewed shaking, weakness, and glassy eyes as early warning signs.",
        type: "checkbox",
        required: true,
      },
      {
        key: "warn_lethargy",
        label: "I reviewed lethargy, poor appetite, and unusual sleepiness as warning signs.",
        type: "checkbox",
        required: true,
      },
      {
        key: "step_feed_often",
        label: "I understand the puppy should eat on a consistent schedule and not go long periods without food.",
        type: "checkbox",
        required: true,
      },
      {
        key: "step_sugar",
        label: "I reviewed the breeder instructions for using sugar support in an emergency while seeking veterinary care.",
        type: "checkbox",
        required: true,
      },
      {
        key: "step_contact",
        label: "I understand I should contact my veterinarian or emergency clinic immediately if symptoms appear.",
        type: "checkbox",
        required: true,
      },
      {
        key: "emergency_phone",
        label: "Emergency clinic or veterinarian phone",
        type: "text",
        placeholder: "Vet or emergency clinic phone",
      },
      {
        key: "notes",
        label: "Notes",
        type: "textarea",
        rows: 3,
        placeholder: "Add any feeding, emergency, or monitoring notes.",
      },
      {
        key: "signed_name",
        label: "Full legal name",
        type: "text",
        required: true,
        placeholder: "Type your full name",
      },
      {
        key: "signed_date",
        label: "Date signed",
        type: "date",
        required: true,
      },
    ],
    getInitialData: () => ({
      warn_shaking: true,
      warn_lethargy: true,
      step_feed_often: true,
      step_sugar: true,
      step_contact: true,
      emergency_phone: "",
      notes: "",
      signed_name: "",
      signed_date: documentToday(),
    }),
    getAvailability: (context) =>
      context.puppy || context.buyer
        ? { enabled: true }
        : {
            enabled: false,
            reason: "This acknowledgement is filed once a puppy is assigned to your home.",
          },
  },
  {
    key: "payment-plan-agreement",
    formKey: "puppy_payment_plan_agreement",
    title: "Puppy Payment Plan Agreement",
    shortTitle: "Payment Plan",
    category: "Financing",
    description:
      "If your account is on financing, the payment-plan terms need a signed copy inside the buyer record.",
    completionSummary:
      "The payment-plan agreement keeps monthly amount, term expectations, and due-date acknowledgements visible in both buyer and admin views.",
    mode: "form",
    fields: [
      {
        key: "monthly_amount",
        label: "Monthly payment amount",
        type: "currency",
        placeholder: "0.00",
      },
      {
        key: "finance_term",
        label: "Plan term",
        type: "text",
        placeholder: "For example: 12 months",
      },
      {
        key: "next_due_date",
        label: "Next due date",
        type: "date",
      },
      {
        key: "late_payment_ack",
        label: "I understand payments must stay current to keep the puppy payment plan in good standing.",
        type: "checkbox",
        required: true,
      },
      {
        key: "release_policy_ack",
        label: "I understand the puppy must be paid according to the approved release policy before handoff unless otherwise documented.",
        type: "checkbox",
        required: true,
      },
      {
        key: "notes",
        label: "Notes",
        type: "textarea",
        rows: 3,
        placeholder: "Add plan timing, due-date, or approval notes.",
      },
      {
        key: "signed_name",
        label: "Full legal name",
        type: "text",
        required: true,
        placeholder: "Type your full name",
      },
      {
        key: "signed_date",
        label: "Date signed",
        type: "date",
        required: true,
      },
    ],
    getInitialData: (context) => ({
      monthly_amount: numberString(context.buyer?.finance_monthly_amount),
      finance_term: context.buyer?.finance_months
        ? `${context.buyer.finance_months} months`
        : "",
      next_due_date: firstFilled(context.buyer?.finance_next_due_date),
      late_payment_ack: true,
      release_policy_ack: true,
      notes: "",
      signed_name: "",
      signed_date: documentToday(),
    }),
    getAvailability: (context) =>
      bool(context.buyer?.finance_enabled)
        ? { enabled: true }
        : {
            enabled: false,
            reason: "This only becomes active when the buyer is enrolled in a puppy payment plan.",
          },
  },
  {
    key: "pickup-delivery-confirmation",
    formKey: "pickup_delivery_confirmation",
    title: "Pickup / Delivery Confirmation",
    shortTitle: "Pickup / Delivery",
    category: "Transportation",
    description:
      "This keeps the handoff method, date, location, and release acknowledgements filed with the buyer packet.",
    completionSummary:
      "Pickup and delivery details stay saved in the portal and admin buyer file so everyone works from one handoff record.",
    mode: "form",
    fields: [
      {
        key: "delivery_option",
        label: "Pickup or delivery method",
        type: "text",
        placeholder: "Pickup, meet-up, drop-off, or transportation",
      },
      {
        key: "delivery_date",
        label: "Pickup or delivery date",
        type: "date",
      },
      {
        key: "delivery_location",
        label: "Pickup or delivery location",
        type: "text",
        placeholder: "City, airport, or handoff location",
      },
      {
        key: "balance_clear_ack",
        label: "I understand the account balance must be cleared before handoff unless a documented payment plan applies.",
        type: "checkbox",
        required: true,
      },
      {
        key: "arrival_ack",
        label: "I will communicate travel timing changes and keep the breeder informed before pickup or delivery.",
        type: "checkbox",
        required: true,
      },
      {
        key: "notes",
        label: "Notes",
        type: "textarea",
        rows: 3,
        placeholder: "Add travel timing, carrier, airport, or meeting notes.",
      },
      {
        key: "signed_name",
        label: "Full legal name",
        type: "text",
        required: true,
        placeholder: "Type your full name",
      },
      {
        key: "signed_date",
        label: "Date signed",
        type: "date",
        required: true,
      },
    ],
    getInitialData: (context) => ({
      delivery_option: deliveryMethod(context),
      delivery_date: firstFilled(context.buyer?.delivery_date),
      delivery_location: firstFilled(context.buyer?.delivery_location),
      balance_clear_ack: true,
      arrival_ack: true,
      notes: "",
      signed_name: "",
      signed_date: documentToday(),
    }),
    getAvailability: (context) =>
      firstFilled(
        context.buyer?.delivery_option,
        context.buyer?.delivery_date,
        context.buyer?.delivery_location
      )
        ? { enabled: true }
        : {
            enabled: false,
            reason: "This activates once pickup, meet-up, drop-off, or transportation planning begins.",
          },
  },
];

export function getVisiblePortalDocumentPacket(context: PortalDocumentPacketContext) {
  void context;
  return portalDocumentPacket;
}

function submissionTime(value: DocumentLikeFormSubmission | null | undefined) {
  if (!value) return 0;
  return new Date(
    value.submitted_at || value.updated_at || value.signed_at || value.created_at || 0
  ).getTime();
}

export function findMatchingDocumentSubmission(
  definition: PortalDocumentDefinition,
  forms: DocumentLikeFormSubmission[]
) {
  const acceptedKeys = new Set([definition.formKey, ...(definition.aliases || [])]);

  return forms
    .filter((entry) => acceptedKeys.has(String(entry.form_key || "")))
    .sort((left, right) => submissionTime(right) - submissionTime(left))[0] || null;
}

export function getDocumentSubmissionPayload(
  submission: Pick<DocumentLikeFormSubmission, "data" | "payload"> | null | undefined
) {
  if (!submission) return {};
  if (submission.payload && typeof submission.payload === "object" && !Array.isArray(submission.payload)) {
    return submission.payload as Record<string, unknown>;
  }
  if (submission.data && typeof submission.data === "object" && !Array.isArray(submission.data)) {
    return submission.data as Record<string, unknown>;
  }
  return {};
}

export function getDocumentInitialData(
  definition: PortalDocumentDefinition,
  context: PortalDocumentPacketContext,
  submission?: DocumentLikeFormSubmission | null
) {
  return {
    ...definition.getInitialData(context),
    ...getDocumentSubmissionPayload(submission),
  };
}

export function portalDocumentStatus(
  definition: PortalDocumentDefinition,
  context: PortalDocumentPacketContext,
  submission?: DocumentLikeFormSubmission | null
): PortalDocumentStatus {
  const availability = definition.getAvailability(context);
  const normalizedStatus = String(submission?.status || "").trim().toLowerCase();

  if (definition.key === "application" && !submission && context.application) {
    const applicationStatus = String(context.application.status || "on file").trim();
    const normalizedApplicationStatus = applicationStatus.toLowerCase();
    return {
      label: applicationStatus,
      tone:
        normalizedApplicationStatus.includes("approved") ||
        normalizedApplicationStatus.includes("complete")
          ? "success"
          : "warning",
      complete: true,
    };
  }

  if (submission) {
    if (
      submission.submitted_at ||
      submission.signed_at ||
      ["submitted", "signed", "approved", "complete", "completed"].some((token) =>
        normalizedStatus.includes(token)
      )
    ) {
      return {
        label: firstFilled(submission.status, "Signed"),
        tone: "success",
        complete: true,
      };
    }

    if (["draft", "review", "pending"].some((token) => normalizedStatus.includes(token))) {
      return {
        label: firstFilled(submission.status, "Draft"),
        tone: "warning",
        complete: false,
      };
    }

    return {
      label: firstFilled(submission.status, "On file"),
      tone: "neutral",
      complete: false,
    };
  }

  if (!availability.enabled) {
    return {
      label: "Not Ready",
      tone: "neutral",
      complete: false,
    };
  }

  return {
    label: "Needed",
    tone: "warning",
    complete: false,
  };
}

export function sanitizeDocumentPayload(
  definition: PortalDocumentDefinition,
  raw: Record<string, unknown> | null | undefined
) {
  const source = raw && typeof raw === "object" ? raw : {};
  const normalized: Record<string, unknown> = {};

  for (const field of definition.fields) {
    const value = (source as Record<string, unknown>)[field.key];
    if (field.type === "checkbox") {
      normalized[field.key] = bool(value);
      continue;
    }

    const text = String(value ?? "").trim();
    normalized[field.key] = text;
  }

  if (!normalized.signed_date) {
    normalized.signed_date = documentToday();
  }

  return normalized;
}

export function validateDocumentPayload(
  definition: PortalDocumentDefinition,
  payload: Record<string, unknown>
) {
  const errors: string[] = [];

  for (const field of definition.fields) {
    if (!field.required) continue;

    if (field.type === "checkbox") {
      if (!bool(payload[field.key])) {
        errors.push(field.label);
      }
      continue;
    }

    if (!String(payload[field.key] ?? "").trim()) {
      errors.push(field.label);
    }
  }

  return errors;
}

export function documentPreviewRows(
  definition: PortalDocumentDefinition,
  payload: Record<string, unknown>,
  limit = 8
) {
  const rows = definition.fields
    .map((field) => {
      const value = payload[field.key];

      if (field.type === "checkbox") {
        if (!bool(value)) return null;
        return { label: field.label, value: "Acknowledged" };
      }

      const text = String(value ?? "").trim();
      if (!text) return null;

      return {
        label: field.label,
        value: field.type === "currency" ? formatMoney(text) || text : text,
      };
    })
    .filter((entry): entry is { label: string; value: string } => Boolean(entry));

  return rows.slice(0, limit);
}

export function documentHighlightText(
  definition: PortalDocumentDefinition,
  submission: DocumentLikeFormSubmission | null | undefined
) {
  const payload = getDocumentSubmissionPayload(submission);
  const preview = documentPreviewRows(definition, payload, 3);
  return preview.map((row) => `${row.label}: ${row.value}`);
}
