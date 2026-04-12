import {
  APPLICATION_COAT_OPTIONS,
  buildCanonicalApplicationPayload,
  emptyApplicationForm,
  formatDateTimeLocal,
  type ApplicationCanonicalPayload,
  type ApplicationForm,
} from "@/lib/portal-application";
import { parseCityState } from "@/lib/portal-data";

export const WAITLIST_SIGNUP_SCHEMA_VERSION = "2026-04";
export const WAITLIST_SIGNUP_TERMS_VERSION = "2026-04";
export const WAITLIST_PREFERRED_CONTACT_OPTIONS = ["Call", "Text", "Email"] as const;
export const WAITLIST_GENDER_OPTIONS = ["Male", "Female", "No Preference"] as const;
export const WAITLIST_COAT_OPTIONS = [
  "Long Coat",
  "Short Coat",
  "No Preference",
] as const;
export const WAITLIST_REGISTRY_OPTIONS = ["AKC", "ACA", "CKC"] as const;
export const WAITLIST_SIZE_RANGE_OPTIONS = [
  "Under 4 pounds",
  "4-6 pounds",
  "6+ pounds",
] as const;
export const WAITLIST_TIMING_OPTIONS = [
  "As soon as possible",
  "1-3 months",
  "3-6 months",
] as const;
export const WAITLIST_BOOLEAN_OPTIONS = ["Yes", "No"] as const;

export type WaitlistSignupCanonicalPayload = {
  schema_version: string;
  intake_kind: "waitlist_signup";
  terms_version: string;
  applicant: {
    first_name: string;
    last_name: string;
    full_name: string;
    email: string;
    state_city: string;
    preferred_contact_methods: string[];
  };
  puppy_preferences: {
    preferred_genders: string[];
    preferred_coat_types: string[];
    preferred_colors: string;
    preferred_registries: string[];
    preferred_size_ranges: string[];
    open_to_future_litter: string;
  };
  timing: {
    bring_home_timing: string;
  };
  home_lifestyle: {
    has_other_pets: string;
    chihuahua_experience: string;
    primarily_indoor: string;
  };
  veterinary_preparedness: {
    reviewed_decision_tree: boolean;
    has_selected_veterinarian: string;
    familiar_with_chihuahua_needs: string;
    prepared_for_routine_vet_care: string;
  };
  payment_agreement: {
    prepared_waitlist_fee_today: string;
    understands_hold_policy: string;
  };
  declarations: {
    accept_terms: boolean;
  };
  signature: {
    signed_name: string;
    signed_at: string;
  };
};

export type WaitlistSignupForm = {
  firstName: string;
  lastName: string;
  email: string;
  stateCity: string;
  preferredContactMethods: string[];
  preferredGenders: string[];
  preferredCoatTypes: string[];
  preferredColors: string;
  preferredRegistries: string[];
  preferredSizeRanges: string[];
  openToFutureLitter: string;
  bringHomeTiming: string;
  hasOtherPets: string;
  chihuahuaExperience: string;
  primarilyIndoor: string;
  reviewedDecisionTree: boolean;
  hasSelectedVeterinarian: string;
  familiarWithChihuahuaNeeds: string;
  preparedForRoutineVetCare: string;
  preparedWaitlistFeeToday: string;
  understandsHoldPolicy: string;
  acceptTerms: boolean;
  signature: string;
  signedAt: string;
};

type WaitlistApplicationSeed = {
  fullName: string;
  email: string;
  city: string;
  state: string;
  preferredContactMethod: string;
  preferredGender: string;
  preferredCoatType: string;
  colorPreference: string;
  interestType: string;
  otherPets: string;
  ownedChihuahuaBefore: string;
  questions: string;
};

function trimText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown) {
  return trimText(value).toLowerCase();
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

function normalizeChoice(value: string, options: readonly string[]) {
  const normalized = trimText(value).toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return "";

  const exact = options.find(
    (option) => option.toLowerCase().replace(/\s+/g, " ") === normalized
  );
  return exact || trimText(value);
}

function uniqueChoices(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => trimText(value))
        .filter(Boolean)
    )
  );
}

function normalizeChoiceList(values: unknown, options: readonly string[]) {
  if (Array.isArray(values)) {
    return uniqueChoices(
      values
        .map((value) => normalizeChoice(String(value), options))
        .filter(Boolean)
    );
  }

  const text = trimText(values);
  if (!text) return [] as string[];

  if (text.includes(",")) {
    return uniqueChoices(
      text
        .split(",")
        .map((entry) => normalizeChoice(entry, options))
        .filter(Boolean)
    );
  }

  return uniqueChoices([normalizeChoice(text, options)]);
}

function readChoiceListAt(
  source: unknown,
  paths: readonly (readonly string[])[],
  options: readonly string[]
) {
  for (const path of paths) {
    const direct = normalizeChoiceList(readPath(source, path), options);
    if (direct.length) return direct;
  }

  const collected: string[] = [];
  for (const option of options) {
    const optionKey = option
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    for (const path of paths) {
      const flag = readBooleanAt(source, [[...path, optionKey]]);
      if (flag) {
        collected.push(option);
        break;
      }
    }
  }

  return uniqueChoices(collected);
}

function readFullNameFromParts(firstName: string, lastName: string) {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

function singleChoice(values: string[]) {
  const choices = uniqueChoices(values);
  return choices.length === 1 ? choices[0] : "";
}

function preferenceChoice(
  values: string[],
  noPreferenceLabel: (typeof WAITLIST_GENDER_OPTIONS)[number] | (typeof WAITLIST_COAT_OPTIONS)[number]
) {
  const choices = uniqueChoices(values);
  if (!choices.length) return "";
  if (choices.includes(noPreferenceLabel)) return "No Preference";
  return choices.length === 1 ? choices[0] : "No Preference";
}

function mapWaitlistCoatToApplication(values: string[]) {
  const selected = preferenceChoice(values, "No Preference");
  if (!selected) return "";
  if (selected === "Long Coat") return APPLICATION_COAT_OPTIONS[1];
  if (selected === "Short Coat") return APPLICATION_COAT_OPTIONS[0];
  return "No Preference";
}

function mapWaitlistGenderToApplication(values: string[]) {
  const selected = preferenceChoice(values, "No Preference");
  if (!selected) return "";
  if (selected === "Male" || selected === "Female") return selected;
  return "No Preference";
}

function mergeNarratives(current: string, addition: string) {
  const next = trimText(addition);
  const existing = trimText(current);
  if (!existing) return next;
  if (!next) return existing;
  if (existing.includes(next)) return existing;
  return `${existing}\n\n${next}`.trim();
}

export function emptyWaitlistSignupForm(): WaitlistSignupForm {
  return {
    firstName: "",
    lastName: "",
    email: "",
    stateCity: "",
    preferredContactMethods: [],
    preferredGenders: [],
    preferredCoatTypes: [],
    preferredColors: "",
    preferredRegistries: [],
    preferredSizeRanges: [],
    openToFutureLitter: "",
    bringHomeTiming: "",
    hasOtherPets: "",
    chihuahuaExperience: "",
    primarilyIndoor: "",
    reviewedDecisionTree: false,
    hasSelectedVeterinarian: "",
    familiarWithChihuahuaNeeds: "",
    preparedForRoutineVetCare: "",
    preparedWaitlistFeeToday: "",
    understandsHoldPolicy: "",
    acceptTerms: false,
    signature: "",
    signedAt: "",
  };
}

export function normalizeWaitlistSignupPayload(
  raw: unknown
): WaitlistSignupCanonicalPayload {
  const payload = asRecord(raw) || {};
  const firstName = readStringAt(payload, [
    ["applicant", "first_name"],
    ["firstName"],
    ["first_name"],
  ]);
  const lastName = readStringAt(payload, [
    ["applicant", "last_name"],
    ["lastName"],
    ["last_name"],
  ]);
  const fullName =
    readStringAt(payload, [["applicant", "full_name"], ["fullName"], ["full_name"]]) ||
    readFullNameFromParts(firstName, lastName);

  return {
    schema_version:
      readStringAt(payload, [["schema_version"], ["schemaVersion"]]) ||
      WAITLIST_SIGNUP_SCHEMA_VERSION,
    intake_kind: "waitlist_signup",
    terms_version:
      readStringAt(payload, [["terms_version"], ["termsVersion"]]) ||
      WAITLIST_SIGNUP_TERMS_VERSION,
    applicant: {
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      email: normalizeEmail(
        readStringAt(payload, [["applicant", "email"], ["email"]])
      ),
      state_city: readStringAt(payload, [
        ["applicant", "state_city"],
        ["stateCity"],
        ["state_city"],
      ]),
      preferred_contact_methods: readChoiceListAt(
        payload,
        [["applicant", "preferred_contact_methods"], ["preferredContactMethods"]],
        WAITLIST_PREFERRED_CONTACT_OPTIONS
      ),
    },
    puppy_preferences: {
      preferred_genders: readChoiceListAt(
        payload,
        [["puppy_preferences", "preferred_genders"], ["preferredGenders"]],
        WAITLIST_GENDER_OPTIONS
      ),
      preferred_coat_types: readChoiceListAt(
        payload,
        [["puppy_preferences", "preferred_coat_types"], ["preferredCoatTypes"]],
        WAITLIST_COAT_OPTIONS
      ),
      preferred_colors: readStringAt(payload, [
        ["puppy_preferences", "preferred_colors"],
        ["preferredColors"],
        ["preferred_colors"],
      ]),
      preferred_registries: readChoiceListAt(
        payload,
        [["puppy_preferences", "preferred_registries"], ["preferredRegistries"]],
        WAITLIST_REGISTRY_OPTIONS
      ),
      preferred_size_ranges: readChoiceListAt(
        payload,
        [["puppy_preferences", "preferred_size_ranges"], ["preferredSizeRanges"]],
        WAITLIST_SIZE_RANGE_OPTIONS
      ),
      open_to_future_litter: normalizeChoice(
        readStringAt(payload, [
          ["puppy_preferences", "open_to_future_litter"],
          ["openToFutureLitter"],
          ["open_to_future_litter"],
        ]),
        WAITLIST_BOOLEAN_OPTIONS
      ),
    },
    timing: {
      bring_home_timing: normalizeChoice(
        readStringAt(payload, [
          ["timing", "bring_home_timing"],
          ["bringHomeTiming"],
          ["bring_home_timing"],
        ]),
        WAITLIST_TIMING_OPTIONS
      ),
    },
    home_lifestyle: {
      has_other_pets: normalizeChoice(
        readStringAt(payload, [
          ["home_lifestyle", "has_other_pets"],
          ["hasOtherPets"],
          ["has_other_pets"],
        ]),
        WAITLIST_BOOLEAN_OPTIONS
      ),
      chihuahua_experience: normalizeChoice(
        readStringAt(payload, [
          ["home_lifestyle", "chihuahua_experience"],
          ["chihuahuaExperience"],
          ["chihuahua_experience"],
        ]),
        WAITLIST_BOOLEAN_OPTIONS
      ),
      primarily_indoor: normalizeChoice(
        readStringAt(payload, [
          ["home_lifestyle", "primarily_indoor"],
          ["primarilyIndoor"],
          ["primarily_indoor"],
        ]),
        WAITLIST_BOOLEAN_OPTIONS
      ),
    },
    veterinary_preparedness: {
      reviewed_decision_tree: readBooleanAt(payload, [
        ["veterinary_preparedness", "reviewed_decision_tree"],
        ["reviewedDecisionTree"],
        ["reviewed_decision_tree"],
        ["decision_tree"],
      ]),
      has_selected_veterinarian: normalizeChoice(
        readStringAt(payload, [
          ["veterinary_preparedness", "has_selected_veterinarian"],
          ["hasSelectedVeterinarian"],
          ["has_selected_veterinarian"],
        ]),
        WAITLIST_BOOLEAN_OPTIONS
      ),
      familiar_with_chihuahua_needs: normalizeChoice(
        readStringAt(payload, [
          ["veterinary_preparedness", "familiar_with_chihuahua_needs"],
          ["familiarWithChihuahuaNeeds"],
          ["familiar_with_chihuahua_needs"],
        ]),
        WAITLIST_BOOLEAN_OPTIONS
      ),
      prepared_for_routine_vet_care: normalizeChoice(
        readStringAt(payload, [
          ["veterinary_preparedness", "prepared_for_routine_vet_care"],
          ["preparedForRoutineVetCare"],
          ["prepared_for_routine_vet_care"],
        ]),
        WAITLIST_BOOLEAN_OPTIONS
      ),
    },
    payment_agreement: {
      prepared_waitlist_fee_today: normalizeChoice(
        readStringAt(payload, [
          ["payment_agreement", "prepared_waitlist_fee_today"],
          ["preparedWaitlistFeeToday"],
          ["prepared_waitlist_fee_today"],
        ]),
        WAITLIST_BOOLEAN_OPTIONS
      ),
      understands_hold_policy: normalizeChoice(
        readStringAt(payload, [
          ["payment_agreement", "understands_hold_policy"],
          ["understandsHoldPolicy"],
          ["understands_hold_policy"],
        ]),
        WAITLIST_BOOLEAN_OPTIONS
      ),
    },
    declarations: {
      accept_terms: readBooleanAt(payload, [
        ["declarations", "accept_terms"],
        ["acceptTerms"],
        ["accept_terms"],
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
    },
  };
}

export function buildCanonicalWaitlistSignupPayload(
  form: WaitlistSignupForm
): WaitlistSignupCanonicalPayload {
  const firstName = trimText(form.firstName);
  const lastName = trimText(form.lastName);
  return {
    schema_version: WAITLIST_SIGNUP_SCHEMA_VERSION,
    intake_kind: "waitlist_signup",
    terms_version: WAITLIST_SIGNUP_TERMS_VERSION,
    applicant: {
      first_name: firstName,
      last_name: lastName,
      full_name: readFullNameFromParts(firstName, lastName),
      email: normalizeEmail(form.email),
      state_city: trimText(form.stateCity),
      preferred_contact_methods: uniqueChoices(
        form.preferredContactMethods.map((value) =>
          normalizeChoice(value, WAITLIST_PREFERRED_CONTACT_OPTIONS)
        )
      ),
    },
    puppy_preferences: {
      preferred_genders: uniqueChoices(
        form.preferredGenders.map((value) =>
          normalizeChoice(value, WAITLIST_GENDER_OPTIONS)
        )
      ),
      preferred_coat_types: uniqueChoices(
        form.preferredCoatTypes.map((value) =>
          normalizeChoice(value, WAITLIST_COAT_OPTIONS)
        )
      ),
      preferred_colors: trimText(form.preferredColors),
      preferred_registries: uniqueChoices(
        form.preferredRegistries.map((value) =>
          normalizeChoice(value, WAITLIST_REGISTRY_OPTIONS)
        )
      ),
      preferred_size_ranges: uniqueChoices(
        form.preferredSizeRanges.map((value) =>
          normalizeChoice(value, WAITLIST_SIZE_RANGE_OPTIONS)
        )
      ),
      open_to_future_litter: normalizeChoice(
        form.openToFutureLitter,
        WAITLIST_BOOLEAN_OPTIONS
      ),
    },
    timing: {
      bring_home_timing: normalizeChoice(
        form.bringHomeTiming,
        WAITLIST_TIMING_OPTIONS
      ),
    },
    home_lifestyle: {
      has_other_pets: normalizeChoice(form.hasOtherPets, WAITLIST_BOOLEAN_OPTIONS),
      chihuahua_experience: normalizeChoice(
        form.chihuahuaExperience,
        WAITLIST_BOOLEAN_OPTIONS
      ),
      primarily_indoor: normalizeChoice(
        form.primarilyIndoor,
        WAITLIST_BOOLEAN_OPTIONS
      ),
    },
    veterinary_preparedness: {
      reviewed_decision_tree: Boolean(form.reviewedDecisionTree),
      has_selected_veterinarian: normalizeChoice(
        form.hasSelectedVeterinarian,
        WAITLIST_BOOLEAN_OPTIONS
      ),
      familiar_with_chihuahua_needs: normalizeChoice(
        form.familiarWithChihuahuaNeeds,
        WAITLIST_BOOLEAN_OPTIONS
      ),
      prepared_for_routine_vet_care: normalizeChoice(
        form.preparedForRoutineVetCare,
        WAITLIST_BOOLEAN_OPTIONS
      ),
    },
    payment_agreement: {
      prepared_waitlist_fee_today: normalizeChoice(
        form.preparedWaitlistFeeToday,
        WAITLIST_BOOLEAN_OPTIONS
      ),
      understands_hold_policy: normalizeChoice(
        form.understandsHoldPolicy,
        WAITLIST_BOOLEAN_OPTIONS
      ),
    },
    declarations: {
      accept_terms: Boolean(form.acceptTerms),
    },
    signature: {
      signed_name: trimText(form.signature),
      signed_at: trimText(form.signedAt) || formatDateTimeLocal(new Date()),
    },
  };
}

export function buildWaitlistSignupDocumentMirrorData(form: WaitlistSignupForm) {
  const canonical = buildCanonicalWaitlistSignupPayload(form);

  return {
    schema_version: canonical.schema_version,
    intake_kind: canonical.intake_kind,
    terms_version: canonical.terms_version,
    first_name: canonical.applicant.first_name,
    last_name: canonical.applicant.last_name,
    full_name: canonical.applicant.full_name,
    email: canonical.applicant.email,
    state_city: canonical.applicant.state_city,
    preferred_contact_methods: canonical.applicant.preferred_contact_methods,
    preferred_genders: canonical.puppy_preferences.preferred_genders,
    preferred_coat_types: canonical.puppy_preferences.preferred_coat_types,
    preferred_colors: canonical.puppy_preferences.preferred_colors,
    preferred_registries: canonical.puppy_preferences.preferred_registries,
    preferred_size_ranges: canonical.puppy_preferences.preferred_size_ranges,
    open_to_future_litter: canonical.puppy_preferences.open_to_future_litter,
    bring_home_timing: canonical.timing.bring_home_timing,
    has_other_pets: canonical.home_lifestyle.has_other_pets,
    chihuahua_experience: canonical.home_lifestyle.chihuahua_experience,
    primarily_indoor: canonical.home_lifestyle.primarily_indoor,
    reviewed_decision_tree:
      canonical.veterinary_preparedness.reviewed_decision_tree,
    has_selected_veterinarian:
      canonical.veterinary_preparedness.has_selected_veterinarian,
    familiar_with_chihuahua_needs:
      canonical.veterinary_preparedness.familiar_with_chihuahua_needs,
    prepared_for_routine_vet_care:
      canonical.veterinary_preparedness.prepared_for_routine_vet_care,
    prepared_waitlist_fee_today:
      canonical.payment_agreement.prepared_waitlist_fee_today,
    understands_hold_policy:
      canonical.payment_agreement.understands_hold_policy,
    accept_terms: canonical.declarations.accept_terms,
    signed_name: canonical.signature.signed_name,
    signed_at: canonical.signature.signed_at,
    waitlist_payload: canonical,
  };
}

function buildWaitlistApplicationSeed(
  waitlist: WaitlistSignupCanonicalPayload
): WaitlistApplicationSeed {
  const cityState = parseCityState(waitlist.applicant.state_city);
  const summaryLines = [
    waitlist.timing.bring_home_timing
      ? `Waitlist timing: ${waitlist.timing.bring_home_timing}`
      : null,
    waitlist.puppy_preferences.preferred_registries.length
      ? `Preferred registry: ${waitlist.puppy_preferences.preferred_registries.join(", ")}`
      : null,
    waitlist.puppy_preferences.preferred_size_ranges.length
      ? `Preferred size range: ${waitlist.puppy_preferences.preferred_size_ranges.join(", ")}`
      : null,
    waitlist.puppy_preferences.open_to_future_litter
      ? `Open to alternate future litter: ${waitlist.puppy_preferences.open_to_future_litter}`
      : null,
    waitlist.home_lifestyle.primarily_indoor
      ? `Primarily indoor home: ${waitlist.home_lifestyle.primarily_indoor}`
      : null,
    waitlist.veterinary_preparedness.has_selected_veterinarian
      ? `Veterinarian selected: ${waitlist.veterinary_preparedness.has_selected_veterinarian}`
      : null,
    waitlist.veterinary_preparedness.familiar_with_chihuahua_needs
      ? `Familiar with Chihuahua-specific needs: ${waitlist.veterinary_preparedness.familiar_with_chihuahua_needs}`
      : null,
    waitlist.veterinary_preparedness.prepared_for_routine_vet_care
      ? `Prepared for routine vet care: ${waitlist.veterinary_preparedness.prepared_for_routine_vet_care}`
      : null,
    waitlist.payment_agreement.prepared_waitlist_fee_today
      ? `Prepared for waitlist fee: ${waitlist.payment_agreement.prepared_waitlist_fee_today}`
      : null,
    waitlist.payment_agreement.understands_hold_policy
      ? `Understands waitlist hold policy: ${waitlist.payment_agreement.understands_hold_policy}`
      : null,
  ].filter(Boolean);

  return {
    fullName: waitlist.applicant.full_name,
    email: waitlist.applicant.email,
    city: cityState.city,
    state: cityState.state,
    preferredContactMethod: singleChoice(waitlist.applicant.preferred_contact_methods),
    preferredGender: mapWaitlistGenderToApplication(
      waitlist.puppy_preferences.preferred_genders
    ),
    preferredCoatType: mapWaitlistCoatToApplication(
      waitlist.puppy_preferences.preferred_coat_types
    ),
    colorPreference: waitlist.puppy_preferences.preferred_colors,
    interestType: "Future Puppy",
    otherPets: waitlist.home_lifestyle.has_other_pets,
    ownedChihuahuaBefore: waitlist.home_lifestyle.chihuahua_experience,
    questions: summaryLines.join("\n"),
  };
}

export function buildApplicationFormFromWaitlistSignup(
  raw: WaitlistSignupCanonicalPayload | unknown,
  current?: ApplicationForm
): ApplicationForm {
  const waitlist = normalizeWaitlistSignupPayload(raw);
  const seed = buildWaitlistApplicationSeed(waitlist);
  const base = current ? { ...current } : emptyApplicationForm();

  return {
    ...base,
    fullName: base.fullName || seed.fullName,
    email: base.email || seed.email,
    city: base.city || seed.city,
    state: base.state || seed.state,
    preferredContactMethod: base.preferredContactMethod || seed.preferredContactMethod,
    preferredGender: base.preferredGender || seed.preferredGender,
    preferredCoatType: base.preferredCoatType || seed.preferredCoatType,
    colorPreference: base.colorPreference || seed.colorPreference,
    interestType: base.interestType || seed.interestType,
    otherPets: base.otherPets || seed.otherPets,
    ownedChihuahuaBefore:
      base.ownedChihuahuaBefore || seed.ownedChihuahuaBefore,
    questions: mergeNarratives(base.questions, seed.questions),
  };
}

export function buildApplicationPayloadFromWaitlistSignup(
  raw: WaitlistSignupCanonicalPayload | unknown,
  current?: ApplicationForm
): ApplicationCanonicalPayload {
  return buildCanonicalApplicationPayload(
    buildApplicationFormFromWaitlistSignup(raw, current)
  );
}

export function buildWaitlistSignupSummary(
  raw: WaitlistSignupCanonicalPayload | unknown
) {
  const waitlist = normalizeWaitlistSignupPayload(raw);
  const parts = [
    waitlist.applicant.full_name || waitlist.applicant.email,
    waitlist.timing.bring_home_timing
      ? `timeline ${waitlist.timing.bring_home_timing}`
      : null,
    waitlist.puppy_preferences.preferred_genders.length
      ? `gender ${waitlist.puppy_preferences.preferred_genders.join("/")}`
      : null,
    waitlist.puppy_preferences.preferred_coat_types.length
      ? `coat ${waitlist.puppy_preferences.preferred_coat_types.join("/")}`
      : null,
    waitlist.puppy_preferences.preferred_size_ranges.length
      ? `size ${waitlist.puppy_preferences.preferred_size_ranges.join("/")}`
      : null,
    waitlist.home_lifestyle.chihuahua_experience
      ? `experience ${waitlist.home_lifestyle.chihuahua_experience}`
      : null,
  ].filter(Boolean);

  return parts.join(" • ");
}
