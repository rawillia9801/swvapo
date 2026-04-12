import {
  buildApplicationFormFromCanonical,
  buildCanonicalApplicationPayload,
  emptyApplicationForm,
  formatDateTimeLocal,
  type ApplicationCanonicalPayload,
  type ApplicationForm,
} from "@/lib/portal-application";
import { parseCityState } from "@/lib/portal-data";

const WRAPPER_KEYS = new Set([
  "payload",
  "data",
  "submission",
  "submission data",
  "submission payload",
  "submission details",
  "response",
  "responses",
  "answer",
  "answers",
  "entry",
  "entries",
  "fields",
  "form",
  "form data",
  "form fields",
  "record",
  "records",
]);

const VALUE_KEYS = [
  "value",
  "values",
  "answer",
  "answers",
  "response",
  "responses",
  "text",
  "display value",
  "display_value",
  "selected value",
  "selected values",
  "selected option",
  "selected options",
  "choice",
  "choices",
  "content",
];

const LABEL_KEYS = [
  "label",
  "name",
  "field",
  "field name",
  "field_name",
  "question",
  "title",
];

export type ZohoSubmissionFieldSnapshot = Record<string, unknown>;

type ZohoApplicationTextFieldKey =
  | "preferredContactMethod"
  | "preferredCoatType"
  | "preferredGender"
  | "colorPreference"
  | "desiredAdoptionDate"
  | "interestType"
  | "otherPets"
  | "petDetails"
  | "ownedChihuahuaBefore"
  | "homeType"
  | "fencedYard"
  | "workStatus"
  | "whoCaresForPuppy"
  | "childrenAtHome"
  | "paymentPreference"
  | "howDidYouHear"
  | "readyToPlaceDeposit"
  | "questions";

type ZohoApplicationBooleanFieldKey =
  | "agreeTerms"
  | "ackAgeCapacity"
  | "ackAccuracy"
  | "ackHomeEnvironment"
  | "ackCareCommitment"
  | "ackHealthGuarantee"
  | "ackNonrefundableDeposit"
  | "ackPurchasePriceTax"
  | "ackContractualObligation"
  | "ackReturnRehoming"
  | "ackReleaseLiability"
  | "ackAgreementTerms"
  | "ackCommunications";

function trimText(value: unknown) {
  return String(value ?? "").trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeLookupKey(value: string) {
  return trimText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPrimitive(value: unknown) {
  return value == null || ["string", "number", "boolean"].includes(typeof value);
}

function parseMaybeJson(value: string) {
  const text = trimText(value);
  if (!text) return null;
  if (!/^[\[{]/.test(text)) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function normalizeSimpleValue(value: unknown): unknown {
  if (value == null) return null;

  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "string") {
    const parsed = parseMaybeJson(value);
    if (parsed != null) return normalizeSimpleValue(parsed);
    const trimmed = trimText(value);
    return trimmed || null;
  }

  if (Array.isArray(value)) {
    const items = value
      .map((entry) => normalizeSimpleValue(entry))
      .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
      .map((entry) => trimText(entry))
      .filter(Boolean);

    if (!items.length) return null;
    if (items.length === 1) return items[0];
    return Array.from(new Set(items));
  }

  const record = asRecord(value);
  if (!record) return null;

  for (const candidate of VALUE_KEYS) {
    const direct = Object.entries(record).find(
      ([key]) => normalizeLookupKey(key) === normalizeLookupKey(candidate)
    );
    if (direct) {
      return normalizeSimpleValue(direct[1]);
    }
  }

  return null;
}

function mergeFieldValue(current: unknown, next: unknown) {
  const normalizedNext = normalizeSimpleValue(next);
  if (normalizedNext == null) return current;
  if (current == null) return normalizedNext;

  const currentItems = Array.isArray(current) ? current : [current];
  const nextItems = Array.isArray(normalizedNext) ? normalizedNext : [normalizedNext];
  const merged = Array.from(
    new Set(
      [...currentItems, ...nextItems]
        .map((entry) => trimText(entry))
        .filter(Boolean)
    )
  );

  if (!merged.length) return null;
  if (merged.length === 1) return merged[0];
  return merged;
}

function setFieldValue(target: ZohoSubmissionFieldSnapshot, key: string, value: unknown) {
  const normalizedKey = normalizeLookupKey(key);
  if (!normalizedKey) return;

  const normalizedValue = normalizeSimpleValue(value);
  if (normalizedValue == null) return;

  target[normalizedKey] = mergeFieldValue(target[normalizedKey], normalizedValue);
}

function looksLikeFieldDescriptor(value: Record<string, unknown>) {
  const normalizedKeys = Object.keys(value).map((key) => normalizeLookupKey(key));
  return (
    normalizedKeys.some((key) => LABEL_KEYS.includes(key)) &&
    normalizedKeys.some((key) => VALUE_KEYS.includes(key))
  );
}

function collectFields(
  source: unknown,
  target: ZohoSubmissionFieldSnapshot,
  depth = 0
) {
  if (depth > 8 || source == null) return;

  if (isPrimitive(source)) return;

  if (Array.isArray(source)) {
    source.forEach((entry) => collectFields(entry, target, depth + 1));
    return;
  }

  const record = asRecord(source);
  if (!record) return;

  if (looksLikeFieldDescriptor(record)) {
    const labelEntry = Object.entries(record).find(([key]) =>
      LABEL_KEYS.includes(normalizeLookupKey(key))
    );
    const valueEntry = Object.entries(record).find(([key]) =>
      VALUE_KEYS.includes(normalizeLookupKey(key))
    );

    if (labelEntry && valueEntry) {
      setFieldValue(target, String(labelEntry[1]), valueEntry[1]);
    }
  }

  Object.entries(record).forEach(([key, value]) => {
    const normalizedKey = normalizeLookupKey(key);

    if (WRAPPER_KEYS.has(normalizedKey)) {
      collectFields(value, target, depth + 1);
      return;
    }

    const normalizedValue = normalizeSimpleValue(value);
    if (normalizedValue != null) {
      setFieldValue(target, key, normalizedValue);
    }

    if (!isPrimitive(value)) {
      collectFields(value, target, depth + 1);
    }
  });
}

function valueToText(value: unknown) {
  if (Array.isArray(value)) {
    return trimText(value[0]);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return trimText(value);
}

function valueToBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    const result = valueToBoolean(value[0]);
    return result;
  }

  const normalized = trimText(value).toLowerCase();
  if (!normalized) return null;
  if (
    [
      "true",
      "1",
      "yes",
      "y",
      "on",
      "checked",
      "accepted",
      "agree",
      "agreed",
      "i accept the terms and conditions.",
    ].includes(normalized)
  ) {
    return true;
  }
  if (["false", "0", "no", "n", "off", "unchecked", "declined"].includes(normalized)) {
    return false;
  }
  return null;
}

function firstText(
  snapshot: ZohoSubmissionFieldSnapshot,
  aliases: string[]
) {
  for (const alias of aliases) {
    const value = snapshot[normalizeLookupKey(alias)];
    const text = valueToText(value);
    if (text) return text;
  }
  return "";
}

function firstBoolean(
  snapshot: ZohoSubmissionFieldSnapshot,
  aliases: string[]
) {
  for (const alias of aliases) {
    const value = snapshot[normalizeLookupKey(alias)];
    const result = valueToBoolean(value);
    if (result !== null) return result;
  }
  return null;
}

function hasAnyField(snapshot: ZohoSubmissionFieldSnapshot, aliases: string[]) {
  return aliases.some((alias) => normalizeLookupKey(alias) in snapshot);
}

function normalizeTimestamp(value: string) {
  const trimmed = trimText(value);
  if (!trimmed) return "";

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return trimmed;
}

function extractSignedName(signatureValue: string, fullName: string) {
  const normalized = trimText(signatureValue);
  if (!normalized) return fullName;
  if (/^(data:image|https?:\/\/)/i.test(normalized)) return fullName;
  return normalized;
}

export function parseZohoFormsWebhookBody(
  rawBody: string,
  contentType: string | null | undefined
) {
  const normalizedContentType = String(contentType || "").toLowerCase();
  const trimmed = rawBody.trim();

  if (!trimmed) return null;

  if (
    normalizedContentType.includes("application/json") ||
    normalizedContentType.includes("text/json") ||
    /^[\[{]/.test(trimmed)
  ) {
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  }

  if (normalizedContentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(trimmed);
    const payload = params.get("payload");
    if (payload) {
      const parsedPayload = parseMaybeJson(payload);
      if (parsedPayload != null) return parsedPayload;
    }

    return Object.fromEntries(params.entries());
  }

  return null;
}

export function buildZohoSubmissionFieldSnapshot(source: unknown) {
  const snapshot: ZohoSubmissionFieldSnapshot = {};
  collectFields(source, snapshot);
  return snapshot;
}

export function buildApplicationFormFromZohoSubmission(params: {
  source: unknown;
  baseCanonical?: ApplicationCanonicalPayload | null;
  now?: Date;
  assumeRequiredDeclarations?: boolean;
}) {
  const snapshot = buildZohoSubmissionFieldSnapshot(params.source);
  const baseForm = params.baseCanonical
    ? buildApplicationFormFromCanonical(params.baseCanonical)
    : emptyApplicationForm();

  const nextForm: ApplicationForm = {
    ...baseForm,
  };

  const firstName = firstText(snapshot, [
    "First Name",
    "Buyer First Name",
    "Applicant First Name",
  ]);
  const lastName = firstText(snapshot, [
    "Last Name",
    "Buyer Last Name",
    "Applicant Last Name",
  ]);
  const fullName =
    firstText(snapshot, [
      "First and Last Name",
      "Full Name",
      "Applicant Name",
      "Buyer Name",
      "Name",
    ]) ||
    [firstName, lastName].filter(Boolean).join(" ").trim();
  const email = firstText(snapshot, [
    "Email Address",
    "Email",
    "Applicant Email",
    "Buyer Email",
  ]);
  const phone = firstText(snapshot, [
    "Phone Number",
    "Phone",
    "Mobile Number",
    "Cell Number",
  ]);
  const streetAddress =
    firstText(snapshot, [
      "Street Address",
      "Physical Address",
      "Address Line 1",
      "Address 1",
    ]) || nextForm.streetAddress;
  const addressLine2 = firstText(snapshot, ["Address Line 2", "Address 2"]);
  const combinedStreetAddress = [streetAddress, addressLine2].filter(Boolean).join(", ").trim();
  const cityState = parseCityState(
    firstText(snapshot, ["City and State", "State and City", "City / State"])
  );
  const city = firstText(snapshot, ["City"]) || cityState.city;
  const state = firstText(snapshot, ["State", "State/Region/Province"]) || cityState.state;
  const zip = firstText(snapshot, ["Zip Code", "Postal / Zip Code", "Postal Code"]);
  const signedAt =
    normalizeTimestamp(
      firstText(snapshot, [
        "Date-Time",
        "Date Time",
        "Signed At",
        "Signed Date",
        "Submission Time",
        "Submitted At",
        "Created Time",
      ])
    ) || formatDateTimeLocal(params.now || new Date());
  const signatureValue = firstText(snapshot, [
    "Signature",
    "Signature Field (type or e-sign)",
    "Typed Signature",
    "Buyer Signature",
  ]);
  const signature = extractSignedName(signatureValue, fullName || nextForm.fullName);
  const requiredDeclarationsFallback =
    params.assumeRequiredDeclarations !== false &&
    Boolean(
      fullName ||
        email ||
        phone ||
        signature ||
        hasAnyField(snapshot, ["Terms and Conditions", "Applicant Declarations"])
    );

  if (fullName) nextForm.fullName = fullName;
  if (email) nextForm.email = email;
  if (phone) nextForm.phone = phone;
  if (combinedStreetAddress) nextForm.streetAddress = combinedStreetAddress;
  if (city) nextForm.city = city;
  if (state) nextForm.state = state;
  if (zip) nextForm.zip = zip;

  const textAssignments: Array<[ZohoApplicationTextFieldKey, string]> = [
    [
      "preferredContactMethod",
      firstText(snapshot, ["Preferred Contact Method", "Preferred Contact"]),
    ],
    [
      "preferredCoatType",
      firstText(snapshot, ["Preferred Coat Type", "Coat Preference"]),
    ],
    [
      "preferredGender",
      firstText(snapshot, ["Preferred Gender", "Gender Preference"]),
    ],
    ["colorPreference", firstText(snapshot, ["Color Preference", "Preferred Color"])],
    [
      "desiredAdoptionDate",
      firstText(snapshot, ["Desired Adoption Date", "Adoption Date"]),
    ],
    ["interestType", firstText(snapshot, ["Interest Type", "Puppy Interest"])],
    ["otherPets", firstText(snapshot, ["Do You Have Other Pets?", "Other Pets"])],
    ["petDetails", firstText(snapshot, ["Pet Details"])],
    [
      "ownedChihuahuaBefore",
      firstText(snapshot, ["Owned A Chihuahua Before?", "Do you have experience with Chihuahuas?"]),
    ],
    ["homeType", firstText(snapshot, ["Home Type"])],
    ["fencedYard", firstText(snapshot, ["Fenced Yard?"])],
    ["workStatus", firstText(snapshot, ["Work Status"])],
    ["whoCaresForPuppy", firstText(snapshot, ["Who Cares for Puppy?"])],
    ["childrenAtHome", firstText(snapshot, ["Children at Home"])],
    ["paymentPreference", firstText(snapshot, ["Payment Preference"])],
    [
      "howDidYouHear",
      firstText(snapshot, ["How Did You Hear About Us?", "How Did you Hear about us?"]),
    ],
    ["readyToPlaceDeposit", firstText(snapshot, ["Ready To Place Deposit?"])],
    [
      "questions",
      firstText(snapshot, [
        "Please input any questions that you may have here.",
        "Questions",
        "Additional Questions",
      ]),
    ],
  ];

  textAssignments.forEach(([key, value]) => {
    if (value) nextForm[key] = value as ApplicationForm[typeof key];
  });

  const declarationAssignments: Array<[ZohoApplicationBooleanFieldKey, string[]]> = [
    [
      "agreeTerms",
      [
        "Terms and Conditions",
        "Terms Of Service",
        "I accept the Terms and Conditions.",
      ],
    ],
    ["ackAgeCapacity", ["Applicant Declarations", "Age and Capacity"]],
    ["ackAccuracy", ["Applicant Declarations", "Accuracy of Information"]],
    ["ackHomeEnvironment", ["Applicant Declarations", "Home Environment"]],
    ["ackCareCommitment", ["Applicant Declarations", "Puppy Care Commitment"]],
    ["ackHealthGuarantee", ["Applicant Declarations", "Health Guarantee Understanding"]],
    ["ackNonrefundableDeposit", ["Applicant Declarations", "Nonrefundable Deposit"]],
    ["ackPurchasePriceTax", ["Applicant Declarations", "Purchase Price and Tax Acknowledgment"]],
    ["ackContractualObligation", ["Applicant Declarations", "Contractual Obligations"]],
    ["ackReturnRehoming", ["Applicant Declarations", "Return and Rehoming Policy"]],
    ["ackReleaseLiability", ["Applicant Declarations", "Release of Liability"]],
    ["ackAgreementTerms", ["Applicant Declarations", "Complete Agreement"]],
    ["ackCommunications", ["Applicant Declarations", "Consent to Communications"]],
  ];

  declarationAssignments.forEach(([key, aliases]) => {
    const explicit = firstBoolean(snapshot, aliases);
    if (explicit !== null) {
      nextForm[key] = explicit as ApplicationForm[typeof key];
      return;
    }

    if (requiredDeclarationsFallback) {
      nextForm[key] = true as ApplicationForm[typeof key];
    }
  });

  nextForm.signedAt = signedAt;
  if (signature) {
    nextForm.signature = signature;
  }

  return {
    form: nextForm,
    canonical: buildCanonicalApplicationPayload(nextForm),
    snapshot,
  };
}

export function extractZohoPuppyApplicationLinkage(source: unknown) {
  const snapshot = buildZohoSubmissionFieldSnapshot(source);

  return {
    userId:
      firstText(snapshot, ["user_id", "user id", "portal user id", "portal_user_id"]) || null,
    submissionId:
      firstText(snapshot, ["submission_id", "submission id", "entry id", "record id"]) || null,
    submittedAt:
      normalizeTimestamp(
        firstText(snapshot, [
          "Date-Time",
          "Date Time",
          "Submitted At",
          "Submission Time",
          "Created Time",
        ])
      ) || null,
    email:
      firstText(snapshot, ["Email Address", "Email", "Applicant Email", "Buyer Email"]) || null,
  };
}
