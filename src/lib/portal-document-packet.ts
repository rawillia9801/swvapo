import type {
  PortalApplication,
  PortalBuyer,
  PortalDocument,
  PortalFormSubmission,
  PortalPuppy,
} from "@/lib/portal-data";
import { normalizeApplicationPayload } from "@/lib/portal-application";

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

function applicationPayload(context: PortalDocumentPacketContext) {
  return context.application?.application
    ? normalizeApplicationPayload(context.application.application)
    : null;
}

function buyerFullName(context: PortalDocumentPacketContext) {
  const application = applicationPayload(context);
  return firstFilled(
    context.buyer?.full_name,
    context.buyer?.name,
    application?.applicant.full_name,
    context.application?.full_name
  );
}

function splitFullName(value: string) {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function buyerEmail(context: PortalDocumentPacketContext) {
  const application = applicationPayload(context);
  return firstFilled(
    context.buyer?.email,
    application?.applicant.email,
    context.application?.email,
    context.application?.applicant_email
  );
}

function buyerPhone(context: PortalDocumentPacketContext) {
  const application = applicationPayload(context);
  return firstFilled(context.buyer?.phone, application?.applicant.phone, context.application?.phone);
}

function buyerAddress(context: PortalDocumentPacketContext) {
  const application = applicationPayload(context);
  return {
    line1: firstFilled(
      context.buyer?.address_line1,
      application?.address.street_address,
      context.application?.street_address
    ),
    line2: firstFilled(context.buyer?.address_line2),
    city: firstFilled(context.buyer?.city, application?.address.city),
    state: firstFilled(context.buyer?.state, application?.address.state),
    postalCode: firstFilled(context.buyer?.postal_code, application?.address.postal_code),
    country: "United States",
  };
}

function preferredContact(context: PortalDocumentPacketContext) {
  const application = applicationPayload(context);
  return firstFilled(application?.applicant.preferred_contact_method);
}

function adoptionDate(context: PortalDocumentPacketContext) {
  const application = applicationPayload(context);
  return firstFilled(
    context.buyer?.delivery_date,
    application?.puppy_preferences.desired_adoption_date
  );
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
    formKey: "hypoglycemia_awareness_care_agreement",
    aliases: ["hypoglycemia_awareness_form", "hypoglycemia_care_agreement"],
    title: "Hypoglycemia Awareness & Care Agreement",
    shortTitle: "Hypoglycemia Care",
    category: "Health",
    description:
      "This agreement keeps homecoming feeding guidance, hypoglycemia warning signs, emergency steps, and clinic planning attached to the puppy file.",
    completionSummary:
      "The signed hypoglycemia care agreement stays in both the portal and breeder record so the first days home are backed by one shared plan.",
    mode: "form",
    fields: [
      {
        key: "buyer_first_name",
        label: "Buyer first name",
        type: "text",
        required: true,
        placeholder: "First name",
      },
      {
        key: "buyer_last_name",
        label: "Buyer last name",
        type: "text",
        required: true,
        placeholder: "Last name",
      },
      {
        key: "email",
        label: "Email",
        type: "text",
        required: true,
        placeholder: "buyer@email.com",
      },
      {
        key: "mobile_number",
        label: "Mobile number",
        type: "text",
        required: true,
        placeholder: "(555) 555-5555",
      },
      {
        key: "physical_address_line1",
        label: "Physical address line 1",
        type: "text",
        required: true,
        placeholder: "Street address",
      },
      {
        key: "physical_address_line2",
        label: "Physical address line 2",
        type: "text",
        placeholder: "Apartment, suite, etc.",
      },
      {
        key: "physical_address_city",
        label: "City",
        type: "text",
        required: true,
        placeholder: "City",
      },
      {
        key: "physical_address_state",
        label: "State / Province",
        type: "text",
        required: true,
        placeholder: "State",
      },
      {
        key: "physical_address_postal_code",
        label: "Postal / Zip code",
        type: "text",
        required: true,
        placeholder: "Zip code",
      },
      {
        key: "physical_address_country",
        label: "Country",
        type: "text",
        placeholder: "United States",
      },
      {
        key: "puppy_name",
        label: "Puppy name",
        type: "text",
        required: true,
        placeholder: "Puppy name",
      },
      {
        key: "adoption_date",
        label: "Adoption date",
        type: "date",
        required: true,
      },
      {
        key: "buyer_puppy_initials",
        label: "Section 1 initials",
        type: "text",
        required: true,
        placeholder: "Initials",
      },
      {
        key: "reviewed_hypoglycemia_definition",
        label: "I reviewed what hypoglycemia is and understand it can become an emergency for a toy-breed puppy.",
        type: "checkbox",
        required: true,
      },
      {
        key: "definition_initials",
        label: "Section 2 initials",
        type: "text",
        required: true,
        placeholder: "Initials",
      },
      {
        key: "reviewed_warning_signs",
        label: "I reviewed warning signs including wobbliness, weakness, tremors, glassy eyes, sudden sleepiness, crying, poor appetite, or unusual behavior.",
        type: "checkbox",
        required: true,
      },
      {
        key: "warning_signs_initials",
        label: "Section 3 initials",
        type: "text",
        required: true,
        placeholder: "Initials",
      },
      {
        key: "feeding_every_2_to_3_hours",
        label: "I will feed frequent small meals during the first days home and will not allow long gaps without food.",
        type: "checkbox",
        required: true,
      },
      {
        key: "keep_honey_or_karo_available",
        label: "I will keep honey or Karo syrup available in case sugar support is needed.",
        type: "checkbox",
        required: true,
      },
      {
        key: "offer_frequent_water",
        label: "I understand fresh water should be offered often and the puppy should stay hydrated.",
        type: "checkbox",
        required: true,
      },
      {
        key: "keep_warm_and_avoid_cold",
        label: "I will keep the puppy warm and avoid cold exposure, drafts, or chilling.",
        type: "checkbox",
        required: true,
      },
      {
        key: "travel_with_food_and_pad",
        label: "I will travel with food, warmth, and emergency sugar support during the first days home.",
        type: "checkbox",
        required: true,
      },
      {
        key: "avoid_stress_first_days",
        label: "I understand overexertion, stressful outings, and too much activity can increase risk during the first 3 to 5 days.",
        type: "checkbox",
        required: true,
      },
      {
        key: "weigh_daily_first_two_weeks",
        label: "I will monitor appetite, energy, stool, and weight daily during the adjustment period.",
        type: "checkbox",
        required: true,
      },
      {
        key: "prevention_plan_initials",
        label: "Section 4 initials",
        type: "text",
        required: true,
        placeholder: "Initials",
      },
      {
        key: "offer_food_if_early_signs",
        label: "If early signs appear, I will first offer food immediately if the puppy is alert enough to eat.",
        type: "checkbox",
        required: true,
      },
      {
        key: "karo_or_honey_if_refusing_food",
        label: "If the puppy refuses food but is alert, I reviewed the breeder instructions for a small amount of Karo syrup or honey on the gums.",
        type: "checkbox",
        required: true,
      },
      {
        key: "keep_warm_and_quiet_if_symptoms",
        label: "I will keep the puppy warm, quiet, and closely observed if symptoms appear.",
        type: "checkbox",
        required: true,
      },
      {
        key: "seek_vet_if_not_improving",
        label: "If symptoms do not improve quickly, I will seek veterinary care immediately.",
        type: "checkbox",
        required: true,
      },
      {
        key: "at_home_action_initials",
        label: "Section 5 initials",
        type: "text",
        required: true,
        placeholder: "Initials",
      },
      {
        key: "administer_small_amount_if_severe",
        label: "For severe signs, I reviewed the breeder guidance for emergency sugar support while preparing for immediate transport.",
        type: "checkbox",
        required: true,
      },
      {
        key: "do_not_force_liquid",
        label: "I understand I should not force liquid if the puppy cannot swallow normally.",
        type: "checkbox",
        required: true,
      },
      {
        key: "transport_immediately_keep_warm",
        label: "I will transport the puppy immediately while keeping the puppy warm, calm, and secure.",
        type: "checkbox",
        required: true,
      },
      {
        key: "call_clinic_ahead",
        label: "I will call the emergency clinic ahead if possible so they are ready on arrival.",
        type: "checkbox",
        required: true,
      },
      {
        key: "clinic_name",
        label: "Nearest 24 / 7 emergency clinic name",
        type: "text",
        required: true,
        placeholder: "Clinic name",
      },
      {
        key: "clinic_address_line1",
        label: "Clinic address line 1",
        type: "text",
        required: true,
        placeholder: "Street address",
      },
      {
        key: "clinic_address_line2",
        label: "Clinic address line 2",
        type: "text",
        placeholder: "Suite, unit, etc.",
      },
      {
        key: "clinic_city",
        label: "Clinic city",
        type: "text",
        required: true,
        placeholder: "City",
      },
      {
        key: "clinic_state",
        label: "Clinic state / province",
        type: "text",
        required: true,
        placeholder: "State",
      },
      {
        key: "clinic_postal_code",
        label: "Clinic postal / zip code",
        type: "text",
        placeholder: "Zip code",
      },
      {
        key: "clinic_country",
        label: "Clinic country",
        type: "text",
        placeholder: "United States",
      },
      {
        key: "clinic_phone",
        label: "Clinic phone number",
        type: "text",
        required: true,
        placeholder: "Phone number",
      },
      {
        key: "emergency_protocol_initials",
        label: "Section 6 initials",
        type: "text",
        required: true,
        placeholder: "Initials",
      },
      {
        key: "reviewed_feeding_schedule",
        label: "I reviewed the first-week feeding and monitoring schedule and understand frequent meals and daily checks are required.",
        type: "checkbox",
        required: true,
      },
      {
        key: "feeding_schedule_initials",
        label: "Section 7 initials",
        type: "text",
        required: true,
        placeholder: "Initials",
      },
      {
        key: "received_breeder_guide",
        label: "I received and read the breeder's hypoglycemia care guide or equivalent homegoing instructions.",
        type: "checkbox",
        required: true,
      },
      {
        key: "avoid_busy_events",
        label: "I will avoid scheduling busy travel, visitors, or major outings if the puppy is still settling in.",
        type: "checkbox",
        required: true,
      },
      {
        key: "contact_breeder_for_concerns",
        label: "I will contact the breeder if appetite, weight, stool, energy, or warning signs become concerning.",
        type: "checkbox",
        required: true,
      },
      {
        key: "understand_noncompliance_risk",
        label: "I understand the adjustment program can be affected by improper husbandry or failure to follow the care plan.",
        type: "checkbox",
        required: true,
      },
      {
        key: "acknowledgements_initials",
        label: "Section 8 initials",
        type: "text",
        required: true,
        placeholder: "Initials",
      },
      {
        key: "follow_up_contact_consent",
        label: "I consent to text or email follow-up about my puppy's transition.",
        type: "checkbox",
      },
      {
        key: "preferred_contact_text",
        label: "Preferred follow-up contact: Text",
        type: "checkbox",
      },
      {
        key: "preferred_contact_email",
        label: "Preferred follow-up contact: Email",
        type: "checkbox",
      },
      {
        key: "preferred_contact_phone",
        label: "Preferred follow-up contact: Phone",
        type: "checkbox",
      },
      {
        key: "certify_read_and_understand",
        label: "I certify I have read and understand this agreement and will follow the care plan above.",
        type: "checkbox",
        required: true,
      },
      {
        key: "terms_and_conditions_ack",
        label: "I accept the terms and conditions of the Hypoglycemia Awareness & Care Agreement.",
        type: "checkbox",
        required: true,
      },
      {
        key: "notes",
        label: "Notes",
        type: "textarea",
        rows: 4,
        placeholder: "Add clinic notes, travel concerns, feeding reminders, or anything the breeder should keep with this care plan.",
      },
      {
        key: "signed_name",
        label: "Buyer signature",
        type: "text",
        required: true,
        placeholder: "Type your full legal name",
      },
      {
        key: "signed_date",
        label: "Date signed",
        type: "date",
        required: true,
      },
    ],
    getInitialData: (context) => {
      const fullName = buyerFullName(context);
      const name = splitFullName(fullName);
      const address = buyerAddress(context);
      const contactMethod = preferredContact(context).toLowerCase();

      return {
        buyer_first_name: name.firstName,
        buyer_last_name: name.lastName,
        email: buyerEmail(context),
        mobile_number: buyerPhone(context),
        physical_address_line1: address.line1,
        physical_address_line2: address.line2,
        physical_address_city: address.city,
        physical_address_state: address.state,
        physical_address_postal_code: address.postalCode,
        physical_address_country: address.country,
        puppy_name: puppyName(context),
        adoption_date: adoptionDate(context),
        buyer_puppy_initials: "",
        reviewed_hypoglycemia_definition: true,
        definition_initials: "",
        reviewed_warning_signs: true,
        warning_signs_initials: "",
        feeding_every_2_to_3_hours: true,
        keep_honey_or_karo_available: true,
        offer_frequent_water: true,
        keep_warm_and_avoid_cold: true,
        travel_with_food_and_pad: true,
        avoid_stress_first_days: true,
        weigh_daily_first_two_weeks: true,
        prevention_plan_initials: "",
        offer_food_if_early_signs: true,
        karo_or_honey_if_refusing_food: true,
        keep_warm_and_quiet_if_symptoms: true,
        seek_vet_if_not_improving: true,
        at_home_action_initials: "",
        administer_small_amount_if_severe: true,
        do_not_force_liquid: true,
        transport_immediately_keep_warm: true,
        call_clinic_ahead: true,
        clinic_name: "",
        clinic_address_line1: "",
        clinic_address_line2: "",
        clinic_city: "",
        clinic_state: "",
        clinic_postal_code: "",
        clinic_country: "United States",
        clinic_phone: "",
        emergency_protocol_initials: "",
        reviewed_feeding_schedule: true,
        feeding_schedule_initials: "",
        received_breeder_guide: true,
        avoid_busy_events: true,
        contact_breeder_for_concerns: true,
        understand_noncompliance_risk: true,
        acknowledgements_initials: "",
        follow_up_contact_consent: false,
        preferred_contact_text: contactMethod === "text",
        preferred_contact_email: contactMethod === "email",
        preferred_contact_phone: contactMethod === "call" || contactMethod === "phone",
        certify_read_and_understand: true,
        terms_and_conditions_ack: true,
        notes: "",
        signed_name: fullName,
        signed_date: documentToday(),
      };
    },
    getAvailability: (context) =>
      context.puppy || context.buyer
        ? { enabled: true }
        : {
            enabled: false,
            reason: "This care agreement is activated once a puppy is assigned to the buyer file.",
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
