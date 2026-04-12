import type { PortalApplication, PortalBuyer } from "@/lib/portal-data";
import { parseCityState } from "@/lib/portal-data";

export const APPLICATION_SCHEMA_VERSION = "2026-04";
export const APPLICATION_TERMS_VERSION = "2026-03";
export const APPLICATION_PREFERRED_CONTACT_OPTIONS = ["Call", "Text", "Email"] as const;
export const APPLICATION_COAT_OPTIONS = ["Short", "Long", "No Preference"] as const;
export const APPLICATION_GENDER_OPTIONS = ["Male", "Female", "No Preference"] as const;
export const APPLICATION_INTEREST_OPTIONS = ["Current Puppy", "Future Puppy"] as const;
export const APPLICATION_HOME_TYPE_OPTIONS = ["House", "Apartment", "Other"] as const;
export const APPLICATION_WORK_STATUS_OPTIONS = [
  "Work From Home",
  "Part-Time",
  "Full-Time",
] as const;
export const APPLICATION_DISCOVERY_OPTIONS = [
  "Facebook",
  "Website",
  "Referral",
  "Instagram",
] as const;
export const APPLICATION_BOOLEAN_OPTIONS = ["Yes", "No"] as const;
export const APPLICATION_PAYMENT_PREFERENCE_OPTIONS = [
  "In Full",
  "Deposit and remainder due at meet",
  "Third Choice",
] as const;

export const FULL_PUPPY_APPLICATION_SELECT =
  "id,user_id,full_name,email,applicant_email,phone,city_state,preferred_contact,street_address,zip,status,admin_notes,application,created_at,assigned_puppy_id,ack_age,ack_accuracy,ack_home_env,ack_care_commitment,ack_health_guarantee,ack_nonrefundable_deposit,ack_purchase_price_tax,ack_contract_obligation,ack_return_rehoming,ack_release_liability,ack_terms,ack_communications";

export type ApplicationCanonicalPayload = {
  schema_version: string;
  application_kind: "puppy_application";
  terms_version: string;
  applicant: {
    full_name: string;
    email: string;
    phone: string;
    preferred_contact_method: string;
  };
  address: {
    street_address: string;
    city: string;
    state: string;
    postal_code: string;
  };
  puppy_preferences: {
    interest_type: string;
    preferred_gender: string;
    preferred_coat_type: string;
    color_preference: string;
    desired_adoption_date: string;
  };
  household: {
    other_pets: string;
    pet_details: string;
    owned_chihuahua_before: string;
    home_type: string;
    fenced_yard: string;
    work_status: string;
    who_cares_for_puppy: string;
    children_at_home: string;
  };
  readiness: {
    payment_preference: string;
    how_did_you_hear: string;
    ready_to_place_deposit: string;
    questions: string;
  };
  declarations: {
    agree_terms: boolean;
    ack_age_capacity: boolean;
    ack_accuracy: boolean;
    ack_home_environment: boolean;
    ack_care_commitment: boolean;
    ack_health_guarantee: boolean;
    ack_nonrefundable_deposit: boolean;
    ack_purchase_price_tax: boolean;
    ack_contractual_obligation: boolean;
    ack_return_rehoming: boolean;
    ack_release_liability: boolean;
    ack_agreement_terms: boolean;
    ack_communications: boolean;
  };
  signature: {
    signed_name: string;
    signed_at: string;
    signed_date: string;
  };
};

export type PuppyApplicationRecord = {
  id: number;
  user_id?: string | null;
  full_name?: string | null;
  email?: string | null;
  applicant_email?: string | null;
  phone?: string | null;
  city_state?: string | null;
  preferred_contact?: string | null;
  street_address?: string | null;
  zip?: string | null;
  status?: string | null;
  admin_notes?: string | null;
  application?: Record<string, unknown> | null;
  created_at?: string | null;
  assigned_puppy_id?: number | null;
  ack_age?: boolean | null;
  ack_accuracy?: boolean | null;
  ack_home_env?: boolean | null;
  ack_care_commitment?: boolean | null;
  ack_health_guarantee?: boolean | null;
  ack_nonrefundable_deposit?: boolean | null;
  ack_purchase_price_tax?: boolean | null;
  ack_contract_obligation?: boolean | null;
  ack_return_rehoming?: boolean | null;
  ack_release_liability?: boolean | null;
  ack_terms?: boolean | null;
  ack_communications?: boolean | null;
};

export type ApplicationForm = {
  fullName: string;
  email: string;
  phone: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  preferredContactMethod: string;
  preferredCoatType: string;
  preferredGender: string;
  colorPreference: string;
  desiredAdoptionDate: string;
  interestType: string;
  otherPets: string;
  petDetails: string;
  ownedChihuahuaBefore: string;
  homeType: string;
  fencedYard: string;
  workStatus: string;
  whoCaresForPuppy: string;
  childrenAtHome: string;
  paymentPreference: string;
  howDidYouHear: string;
  readyToPlaceDeposit: string;
  questions: string;
  agreeTerms: boolean;
  ackAgeCapacity: boolean;
  ackAccuracy: boolean;
  ackHomeEnvironment: boolean;
  ackCareCommitment: boolean;
  ackHealthGuarantee: boolean;
  ackNonrefundableDeposit: boolean;
  ackPurchasePriceTax: boolean;
  ackContractualObligation: boolean;
  ackReturnRehoming: boolean;
  ackReleaseLiability: boolean;
  ackAgreementTerms: boolean;
  ackCommunications: boolean;
  signedAt: string;
  signature: string;
};

function trimText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown) {
  return trimText(value).toLowerCase();
}

function normalizeChoice(value: string, options: readonly string[]) {
  const normalized = trimText(value).toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return "";

  if (normalized === "futiure puppy") return "Future Puppy";
  if (normalized === "work from home") return "Work From Home";
  if (normalized === "no preference") return "No Preference";

  const exact = options.find(
    (option) => option.toLowerCase().replace(/\s+/g, " ") === normalized
  );
  return exact || trimText(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readPath(source: unknown, path: readonly string[]) {
  let current = source;
  for (const segment of path) {
    const record = asRecord(current);
    if (!record || !(segment in record)) return undefined;
    current = record[segment];
  }
  return current;
}

function readStringAt(source: unknown, paths: readonly (readonly string[])[]) {
  for (const path of paths) {
    const value = trimText(readPath(source, path));
    if (value) return value;
  }
  return "";
}

function readBooleanAt(source: unknown, paths: readonly (readonly string[])[]) {
  for (const path of paths) {
    const value = readPath(source, path);
    if (typeof value === "boolean") return value;
    const normalized = trimText(value).toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  }
  return false;
}

function firstFilled(...values: Array<unknown>) {
  for (const value of values) {
    const text = trimText(value);
    if (text) return text;
  }
  return "";
}

function matchesKeywords(text: string, keywords: string[]) {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

export function formatDateTimeLocal(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function emptyApplicationForm(): ApplicationForm {
  return {
    fullName: "",
    email: "",
    phone: "",
    streetAddress: "",
    city: "",
    state: "",
    zip: "",
    preferredContactMethod: "",
    preferredCoatType: "",
    preferredGender: "",
    colorPreference: "",
    desiredAdoptionDate: "",
    interestType: "",
    otherPets: "",
    petDetails: "",
    ownedChihuahuaBefore: "",
    homeType: "",
    fencedYard: "",
    workStatus: "",
    whoCaresForPuppy: "",
    childrenAtHome: "",
    paymentPreference: "",
    howDidYouHear: "",
    readyToPlaceDeposit: "",
    questions: "",
    agreeTerms: false,
    ackAgeCapacity: false,
    ackAccuracy: false,
    ackHomeEnvironment: false,
    ackCareCommitment: false,
    ackHealthGuarantee: false,
    ackNonrefundableDeposit: false,
    ackPurchasePriceTax: false,
    ackContractualObligation: false,
    ackReturnRehoming: false,
    ackReleaseLiability: false,
    ackAgreementTerms: false,
    ackCommunications: false,
    signedAt: "",
    signature: "",
  };
}

export function normalizeApplicationPayload(
  raw: unknown
): ApplicationCanonicalPayload {
  const payload = asRecord(raw) || {};

  return {
    schema_version:
      readStringAt(payload, [["schema_version"], ["schemaVersion"]]) ||
      APPLICATION_SCHEMA_VERSION,
    application_kind: "puppy_application",
    terms_version:
      readStringAt(payload, [["terms_version"], ["termsVersion"]]) ||
      APPLICATION_TERMS_VERSION,
    applicant: {
      full_name: readStringAt(payload, [
        ["applicant", "full_name"],
        ["fullName"],
        ["full_name"],
      ]),
      email: normalizeEmail(
        readStringAt(payload, [
          ["applicant", "email"],
          ["email"],
          ["applicant_email"],
          ["applicantEmail"],
        ])
      ),
      phone: readStringAt(payload, [["applicant", "phone"], ["phone"]]),
      preferred_contact_method: normalizeChoice(
        readStringAt(payload, [
          ["applicant", "preferred_contact_method"],
          ["preferredContactMethod"],
          ["preferred_contact_method"],
        ]),
        APPLICATION_PREFERRED_CONTACT_OPTIONS
      ),
    },
    address: {
      street_address: readStringAt(payload, [
        ["address", "street_address"],
        ["streetAddress"],
        ["street_address"],
      ]),
      city: readStringAt(payload, [["address", "city"], ["city"]]),
      state: readStringAt(payload, [["address", "state"], ["state"]]),
      postal_code: readStringAt(payload, [
        ["address", "postal_code"],
        ["zip"],
        ["postal_code"],
      ]),
    },
    puppy_preferences: {
      interest_type: normalizeChoice(
        readStringAt(payload, [
          ["puppy_preferences", "interest_type"],
          ["interestType"],
          ["interest_type"],
        ]),
        APPLICATION_INTEREST_OPTIONS
      ),
      preferred_gender: normalizeChoice(
        readStringAt(payload, [
          ["puppy_preferences", "preferred_gender"],
          ["preferredGender"],
          ["preferred_gender"],
        ]),
        APPLICATION_GENDER_OPTIONS
      ),
      preferred_coat_type: normalizeChoice(
        readStringAt(payload, [
          ["puppy_preferences", "preferred_coat_type"],
          ["preferredCoatType"],
          ["preferred_coat_type"],
        ]),
        APPLICATION_COAT_OPTIONS
      ),
      color_preference: readStringAt(payload, [
        ["puppy_preferences", "color_preference"],
        ["colorPreference"],
        ["color_preference"],
      ]),
      desired_adoption_date: readStringAt(payload, [
        ["puppy_preferences", "desired_adoption_date"],
        ["desiredAdoptionDate"],
        ["desired_adoption_date"],
      ]),
    },
    household: {
      other_pets: normalizeChoice(
        readStringAt(payload, [
          ["household", "other_pets"],
          ["otherPets"],
          ["other_pets"],
        ]),
        APPLICATION_BOOLEAN_OPTIONS
      ),
      pet_details: readStringAt(payload, [
        ["household", "pet_details"],
        ["petDetails"],
        ["pet_details"],
      ]),
      owned_chihuahua_before: normalizeChoice(
        readStringAt(payload, [
          ["household", "owned_chihuahua_before"],
          ["ownedChihuahuaBefore"],
          ["owned_chihuahua_before"],
        ]),
        APPLICATION_BOOLEAN_OPTIONS
      ),
      home_type: normalizeChoice(
        readStringAt(payload, [
          ["household", "home_type"],
          ["homeType"],
          ["home_type"],
        ]),
        APPLICATION_HOME_TYPE_OPTIONS
      ),
      fenced_yard: normalizeChoice(
        readStringAt(payload, [
          ["household", "fenced_yard"],
          ["fencedYard"],
          ["fenced_yard"],
        ]),
        APPLICATION_BOOLEAN_OPTIONS
      ),
      work_status: normalizeChoice(
        readStringAt(payload, [
          ["household", "work_status"],
          ["workStatus"],
          ["work_status"],
        ]),
        APPLICATION_WORK_STATUS_OPTIONS
      ),
      who_cares_for_puppy: readStringAt(payload, [
        ["household", "who_cares_for_puppy"],
        ["whoCaresForPuppy"],
        ["who_cares_for_puppy"],
      ]),
      children_at_home: readStringAt(payload, [
        ["household", "children_at_home"],
        ["childrenAtHome"],
        ["children_at_home"],
      ]),
    },
    readiness: {
      payment_preference: normalizeChoice(
        readStringAt(payload, [
          ["readiness", "payment_preference"],
          ["paymentPreference"],
          ["payment_preference"],
        ]),
        APPLICATION_PAYMENT_PREFERENCE_OPTIONS
      ),
      how_did_you_hear: normalizeChoice(
        readStringAt(payload, [
          ["readiness", "how_did_you_hear"],
          ["howDidYouHear"],
          ["how_did_you_hear"],
        ]),
        APPLICATION_DISCOVERY_OPTIONS
      ),
      ready_to_place_deposit: normalizeChoice(
        readStringAt(payload, [
          ["readiness", "ready_to_place_deposit"],
          ["readyToPlaceDeposit"],
          ["ready_to_place_deposit"],
        ]),
        APPLICATION_BOOLEAN_OPTIONS
      ),
      questions: readStringAt(payload, [
        ["readiness", "questions"],
        ["questions"],
      ]),
    },
    declarations: {
      agree_terms: readBooleanAt(payload, [
        ["declarations", "agree_terms"],
        ["agreeTerms"],
        ["agree_terms"],
      ]),
      ack_age_capacity: readBooleanAt(payload, [
        ["declarations", "ack_age_capacity"],
        ["ackAgeCapacity"],
        ["ack_age_capacity"],
      ]),
      ack_accuracy: readBooleanAt(payload, [
        ["declarations", "ack_accuracy"],
        ["ackAccuracy"],
        ["ack_accuracy"],
      ]),
      ack_home_environment: readBooleanAt(payload, [
        ["declarations", "ack_home_environment"],
        ["ackHomeEnvironment"],
        ["ack_home_environment"],
      ]),
      ack_care_commitment: readBooleanAt(payload, [
        ["declarations", "ack_care_commitment"],
        ["ackCareCommitment"],
        ["ack_care_commitment"],
      ]),
      ack_health_guarantee: readBooleanAt(payload, [
        ["declarations", "ack_health_guarantee"],
        ["ackHealthGuarantee"],
        ["ack_health_guarantee"],
      ]),
      ack_nonrefundable_deposit: readBooleanAt(payload, [
        ["declarations", "ack_nonrefundable_deposit"],
        ["ackNonrefundableDeposit"],
        ["ack_nonrefundable_deposit"],
      ]),
      ack_purchase_price_tax: readBooleanAt(payload, [
        ["declarations", "ack_purchase_price_tax"],
        ["ackPurchasePriceTax"],
        ["ack_purchase_price_tax"],
      ]),
      ack_contractual_obligation: readBooleanAt(payload, [
        ["declarations", "ack_contractual_obligation"],
        ["ackContractualObligation"],
        ["ack_contractual_obligation"],
      ]),
      ack_return_rehoming: readBooleanAt(payload, [
        ["declarations", "ack_return_rehoming"],
        ["ackReturnRehoming"],
        ["ack_return_rehoming"],
      ]),
      ack_release_liability: readBooleanAt(payload, [
        ["declarations", "ack_release_liability"],
        ["ackReleaseLiability"],
        ["ack_release_liability"],
      ]),
      ack_agreement_terms: readBooleanAt(payload, [
        ["declarations", "ack_agreement_terms"],
        ["ackAgreementTerms"],
        ["ack_agreement_terms"],
      ]),
      ack_communications: readBooleanAt(payload, [
        ["declarations", "ack_communications"],
        ["ackCommunications"],
        ["ack_communications"],
      ]),
    },
    signature: {
      signed_name: readStringAt(payload, [
        ["signature", "signed_name"],
        ["signature"],
        ["signed_name"],
      ]),
      signed_at: readStringAt(payload, [
        ["signature", "signed_at"],
        ["signedAt"],
        ["signed_at"],
      ]),
      signed_date: readStringAt(payload, [
        ["signature", "signed_date"],
        ["signedDate"],
        ["signed_date"],
      ]),
    },
  };
}

export function buildCanonicalApplicationPayload(
  form: ApplicationForm
): ApplicationCanonicalPayload {
  return {
    schema_version: APPLICATION_SCHEMA_VERSION,
    application_kind: "puppy_application",
    terms_version: APPLICATION_TERMS_VERSION,
    applicant: {
      full_name: trimText(form.fullName),
      email: normalizeEmail(form.email),
      phone: trimText(form.phone),
      preferred_contact_method: normalizeChoice(
        form.preferredContactMethod,
        APPLICATION_PREFERRED_CONTACT_OPTIONS
      ),
    },
    address: {
      street_address: trimText(form.streetAddress),
      city: trimText(form.city),
      state: trimText(form.state),
      postal_code: trimText(form.zip),
    },
    puppy_preferences: {
      interest_type: normalizeChoice(form.interestType, APPLICATION_INTEREST_OPTIONS),
      preferred_gender: normalizeChoice(form.preferredGender, APPLICATION_GENDER_OPTIONS),
      preferred_coat_type: normalizeChoice(
        form.preferredCoatType,
        APPLICATION_COAT_OPTIONS
      ),
      color_preference: trimText(form.colorPreference),
      desired_adoption_date: trimText(form.desiredAdoptionDate),
    },
    household: {
      other_pets: normalizeChoice(form.otherPets, APPLICATION_BOOLEAN_OPTIONS),
      pet_details: trimText(form.petDetails),
      owned_chihuahua_before: normalizeChoice(
        form.ownedChihuahuaBefore,
        APPLICATION_BOOLEAN_OPTIONS
      ),
      home_type: normalizeChoice(form.homeType, APPLICATION_HOME_TYPE_OPTIONS),
      fenced_yard: normalizeChoice(form.fencedYard, APPLICATION_BOOLEAN_OPTIONS),
      work_status: normalizeChoice(form.workStatus, APPLICATION_WORK_STATUS_OPTIONS),
      who_cares_for_puppy: trimText(form.whoCaresForPuppy),
      children_at_home: trimText(form.childrenAtHome),
    },
    readiness: {
      payment_preference: normalizeChoice(
        form.paymentPreference,
        APPLICATION_PAYMENT_PREFERENCE_OPTIONS
      ),
      how_did_you_hear: normalizeChoice(
        form.howDidYouHear,
        APPLICATION_DISCOVERY_OPTIONS
      ),
      ready_to_place_deposit: normalizeChoice(
        form.readyToPlaceDeposit,
        APPLICATION_BOOLEAN_OPTIONS
      ),
      questions: trimText(form.questions),
    },
    declarations: {
      agree_terms: Boolean(form.agreeTerms),
      ack_age_capacity: Boolean(form.ackAgeCapacity),
      ack_accuracy: Boolean(form.ackAccuracy),
      ack_home_environment: Boolean(form.ackHomeEnvironment),
      ack_care_commitment: Boolean(form.ackCareCommitment),
      ack_health_guarantee: Boolean(form.ackHealthGuarantee),
      ack_nonrefundable_deposit: Boolean(form.ackNonrefundableDeposit),
      ack_purchase_price_tax: Boolean(form.ackPurchasePriceTax),
      ack_contractual_obligation: Boolean(form.ackContractualObligation),
      ack_return_rehoming: Boolean(form.ackReturnRehoming),
      ack_release_liability: Boolean(form.ackReleaseLiability),
      ack_agreement_terms: Boolean(form.ackAgreementTerms),
      ack_communications: Boolean(form.ackCommunications),
    },
    signature: {
      signed_name: trimText(form.signature),
      signed_at: trimText(form.signedAt) || formatDateTimeLocal(new Date()),
      signed_date:
        trimText(form.signedAt).slice(0, 10) || new Date().toISOString().slice(0, 10),
    },
  };
}

export function buildApplicationFormState(params: {
  userEmail: string;
  record: PuppyApplicationRecord | null;
  buyer: PortalBuyer | null;
  application: PortalApplication | null;
}): ApplicationForm {
  const canonical = normalizeApplicationPayload(params.record?.application);
  const cityState = parseCityState(
    params.record?.city_state || params.application?.city_state
  );

  return {
    fullName:
      firstFilled(
        params.record?.full_name,
        params.buyer?.full_name,
        params.buyer?.name,
        params.application?.full_name,
        canonical.applicant.full_name
      ) || "",
    email:
      firstFilled(
        params.record?.email,
        params.record?.applicant_email,
        params.buyer?.email,
        params.application?.email,
        params.application?.applicant_email,
        canonical.applicant.email,
        params.userEmail
      ) || "",
    phone:
      firstFilled(params.record?.phone, params.application?.phone, canonical.applicant.phone) ||
      "",
    streetAddress:
      firstFilled(
        params.record?.street_address,
        params.application?.street_address,
        canonical.address.street_address
      ) || "",
    city: firstFilled(cityState.city, canonical.address.city) || "",
    state: firstFilled(cityState.state, canonical.address.state) || "",
    zip: firstFilled(params.record?.zip, params.application?.zip, canonical.address.postal_code) || "",
    preferredContactMethod:
      firstFilled(params.record?.preferred_contact, canonical.applicant.preferred_contact_method) ||
      "",
    preferredCoatType: canonical.puppy_preferences.preferred_coat_type,
    preferredGender: canonical.puppy_preferences.preferred_gender,
    colorPreference: canonical.puppy_preferences.color_preference,
    desiredAdoptionDate: canonical.puppy_preferences.desired_adoption_date,
    interestType: canonical.puppy_preferences.interest_type,
    otherPets: canonical.household.other_pets,
    petDetails: canonical.household.pet_details,
    ownedChihuahuaBefore: canonical.household.owned_chihuahua_before,
    homeType: canonical.household.home_type,
    fencedYard: canonical.household.fenced_yard,
    workStatus: canonical.household.work_status,
    whoCaresForPuppy: canonical.household.who_cares_for_puppy,
    childrenAtHome: canonical.household.children_at_home,
    paymentPreference: canonical.readiness.payment_preference,
    howDidYouHear: canonical.readiness.how_did_you_hear,
    readyToPlaceDeposit: canonical.readiness.ready_to_place_deposit,
    questions: canonical.readiness.questions,
    agreeTerms: canonical.declarations.agree_terms,
    ackAgeCapacity:
      params.record?.ack_age ?? canonical.declarations.ack_age_capacity,
    ackAccuracy: params.record?.ack_accuracy ?? canonical.declarations.ack_accuracy,
    ackHomeEnvironment:
      params.record?.ack_home_env ?? canonical.declarations.ack_home_environment,
    ackCareCommitment:
      params.record?.ack_care_commitment ?? canonical.declarations.ack_care_commitment,
    ackHealthGuarantee:
      params.record?.ack_health_guarantee ??
      canonical.declarations.ack_health_guarantee,
    ackNonrefundableDeposit:
      params.record?.ack_nonrefundable_deposit ??
      canonical.declarations.ack_nonrefundable_deposit,
    ackPurchasePriceTax:
      params.record?.ack_purchase_price_tax ??
      canonical.declarations.ack_purchase_price_tax,
    ackContractualObligation:
      params.record?.ack_contract_obligation ??
      canonical.declarations.ack_contractual_obligation,
    ackReturnRehoming:
      params.record?.ack_return_rehoming ??
      canonical.declarations.ack_return_rehoming,
    ackReleaseLiability:
      params.record?.ack_release_liability ??
      canonical.declarations.ack_release_liability,
    ackAgreementTerms:
      params.record?.ack_terms ?? canonical.declarations.ack_agreement_terms,
    ackCommunications:
      params.record?.ack_communications ??
      canonical.declarations.ack_communications,
    signedAt: canonical.signature.signed_at || formatDateTimeLocal(new Date()),
    signature: canonical.signature.signed_name,
  };
}

export function buildApplicationDocumentMirrorData(form: ApplicationForm) {
  const canonical = buildCanonicalApplicationPayload(form);

  return {
    schema_version: canonical.schema_version,
    application_kind: canonical.application_kind,
    terms_version: canonical.terms_version,
    full_name: canonical.applicant.full_name,
    email: canonical.applicant.email,
    phone: canonical.applicant.phone,
    street_address: canonical.address.street_address,
    city: canonical.address.city,
    state: canonical.address.state,
    zip: canonical.address.postal_code,
    preferred_contact_method: canonical.applicant.preferred_contact_method,
    preferred_coat_type: canonical.puppy_preferences.preferred_coat_type,
    preferred_gender: canonical.puppy_preferences.preferred_gender,
    color_preference: canonical.puppy_preferences.color_preference,
    desired_adoption_date: canonical.puppy_preferences.desired_adoption_date,
    interest_type: canonical.puppy_preferences.interest_type,
    other_pets: canonical.household.other_pets,
    pet_details: canonical.household.pet_details,
    owned_chihuahua_before: canonical.household.owned_chihuahua_before,
    home_type: canonical.household.home_type,
    fenced_yard: canonical.household.fenced_yard,
    work_status: canonical.household.work_status,
    who_cares_for_puppy: canonical.household.who_cares_for_puppy,
    children_at_home: canonical.household.children_at_home,
    payment_preference: canonical.readiness.payment_preference,
    how_did_you_hear: canonical.readiness.how_did_you_hear,
    ready_to_place_deposit: canonical.readiness.ready_to_place_deposit,
    questions: canonical.readiness.questions,
    agree_terms: canonical.declarations.agree_terms,
    ack_age_capacity: canonical.declarations.ack_age_capacity,
    ack_accuracy: canonical.declarations.ack_accuracy,
    ack_home_environment: canonical.declarations.ack_home_environment,
    ack_care_commitment: canonical.declarations.ack_care_commitment,
    ack_health_guarantee: canonical.declarations.ack_health_guarantee,
    ack_nonrefundable_deposit: canonical.declarations.ack_nonrefundable_deposit,
    ack_purchase_price_tax: canonical.declarations.ack_purchase_price_tax,
    ack_contractual_obligation:
      canonical.declarations.ack_contractual_obligation,
    ack_return_rehoming: canonical.declarations.ack_return_rehoming,
    ack_release_liability: canonical.declarations.ack_release_liability,
    ack_agreement_terms: canonical.declarations.ack_agreement_terms,
    ack_communications: canonical.declarations.ack_communications,
    signed_name: canonical.signature.signed_name,
    signed_date: canonical.signature.signed_date,
    signed_at: canonical.signature.signed_at,
    application_payload: canonical,
  };
}

export function buildPuppyApplicationRowPayload(params: {
  form: ApplicationForm;
  userId: string;
  status: string;
}) {
  const canonical = buildCanonicalApplicationPayload(params.form);
  const cityState = [canonical.address.city, canonical.address.state]
    .filter(Boolean)
    .join(", ");

  return {
    canonical,
    row: {
      user_id: params.userId,
      full_name: canonical.applicant.full_name || null,
      email: canonical.applicant.email || null,
      applicant_email: canonical.applicant.email || null,
      phone: canonical.applicant.phone || null,
      street_address: canonical.address.street_address || null,
      city_state: cityState || null,
      preferred_contact: canonical.applicant.preferred_contact_method || null,
      best_time: null,
      zip: canonical.address.postal_code || null,
      status: trimText(params.status) || "submitted",
      ack_age: canonical.declarations.ack_age_capacity,
      ack_accuracy: canonical.declarations.ack_accuracy,
      ack_home_env: canonical.declarations.ack_home_environment,
      ack_care_commitment: canonical.declarations.ack_care_commitment,
      ack_health_guarantee: canonical.declarations.ack_health_guarantee,
      ack_nonrefundable_deposit:
        canonical.declarations.ack_nonrefundable_deposit,
      ack_purchase_price_tax: canonical.declarations.ack_purchase_price_tax,
      ack_contract_obligation:
        canonical.declarations.ack_contractual_obligation,
      ack_return_rehoming: canonical.declarations.ack_return_rehoming,
      ack_release_liability: canonical.declarations.ack_release_liability,
      ack_terms: canonical.declarations.ack_agreement_terms,
      ack_communications: canonical.declarations.ack_communications,
      application: canonical,
    },
  };
}

export function applicationDisplayName(
  row: Pick<PuppyApplicationRecord, "id" | "full_name" | "email" | "applicant_email">,
  application: ApplicationCanonicalPayload | null
) {
  return (
    firstFilled(
      row.full_name,
      application?.applicant.full_name,
      row.email,
      row.applicant_email,
      `Application #${row.id}`
    ) || `Application #${row.id}`
  );
}

export function applicationEmail(
  row: Pick<PuppyApplicationRecord, "email" | "applicant_email">,
  application: ApplicationCanonicalPayload | null
) {
  return (
    firstFilled(row.email, row.applicant_email, application?.applicant.email) || ""
  );
}

export function applicationPhone(
  row: Pick<PuppyApplicationRecord, "phone">,
  application: ApplicationCanonicalPayload | null
) {
  return firstFilled(row.phone, application?.applicant.phone) || "";
}

export function applicationCityState(
  row: Pick<PuppyApplicationRecord, "city_state">,
  application: ApplicationCanonicalPayload | null
) {
  const explicit = trimText(row.city_state);
  if (explicit) return explicit;
  return [application?.address.city, application?.address.state]
    .filter(Boolean)
    .join(", ");
}

export function applicationInterest(
  application: ApplicationCanonicalPayload | null,
  matchedPuppyLabel: string | null
) {
  if (matchedPuppyLabel) return matchedPuppyLabel;
  const preference = [
    application?.puppy_preferences.interest_type,
    application?.puppy_preferences.preferred_gender,
    application?.puppy_preferences.preferred_coat_type,
    application?.puppy_preferences.color_preference,
  ]
    .filter(Boolean)
    .join(" / ");
  return preference || "General inquiry";
}

export function buildApplicationHouseholdSummary(
  application: ApplicationCanonicalPayload | null
) {
  const parts = [
    application?.household.home_type,
    application?.household.children_at_home,
    application?.household.other_pets,
    application?.household.work_status,
    application?.household.fenced_yard,
  ].filter(Boolean);
  return parts.join(" / ") || "Household notes not provided yet.";
}

export function buildApplicationExperienceSummary(
  application: ApplicationCanonicalPayload | null
) {
  const parts = [
    application?.household.owned_chihuahua_before,
    application?.household.who_cares_for_puppy,
    application?.household.pet_details,
  ].filter(Boolean);
  return parts.join(" / ") || "Experience notes not provided yet.";
}

export function applicationPaymentPreference(
  application: ApplicationCanonicalPayload | null
) {
  return application?.readiness.payment_preference || "";
}

export function applicationQuestions(
  application: ApplicationCanonicalPayload | null
) {
  return application?.readiness.questions || "";
}

export function applicationShowsFinancingInterest(
  application: ApplicationCanonicalPayload | null
) {
  const paymentPreference = applicationPaymentPreference(application);
  const questions = applicationQuestions(application);
  return (
    matchesKeywords(paymentPreference, ["financ", "payment plan", "monthly"]) ||
    matchesKeywords(questions, ["financ", "payment plan", "monthly"])
  );
}

export function applicationShowsDepositReadiness(
  application: ApplicationCanonicalPayload | null
) {
  const value = trimText(application?.readiness.ready_to_place_deposit).toLowerCase();
  return ["yes", "true", "ready", "y"].includes(value);
}

export function buildApplicationTransportContext(
  application: ApplicationCanonicalPayload | null
) {
  return [
    application?.puppy_preferences.interest_type,
    application?.readiness.questions,
  ]
    .filter(Boolean)
    .join(" ");
}
