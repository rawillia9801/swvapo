import "server-only";

export type ChiChiDocumentPackageKey =
  | "application"
  | "deposit-agreement"
  | "bill-of-sale"
  | "health-guarantee"
  | "hypoglycemia-awareness"
  | "payment-plan-agreement"
  | "pickup-delivery-confirmation";

type UnknownRecord = Record<string, unknown>;

export type BuyerLike = {
  id?: number | null;
  user_id?: string | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  address_1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  sale_price?: number | null;
  deposit_amount?: number | null;
  deposit_date?: string | null;
  deposit_payment_method?: string | null;
  finance_enabled?: boolean | null;
  finance_rate?: number | null;
  finance_months?: number | null;
  finance_monthly_amount?: number | null;
  finance_next_due_date?: string | null;
  delivery_option?: string | null;
  delivery_date?: string | null;
  delivery_location?: string | null;
};

export type PuppyLike = {
  id?: number | null;
  call_name?: string | null;
  puppy_name?: string | null;
  registered_name?: string | null;
  name?: string | null;
  sex?: string | null;
  color?: string | null;
  coat_type?: string | null;
  dob?: string | null;
  price?: number | null;
  list_price?: number | null;
  registry?: string | null;
  sire?: string | null;
  dam?: string | null;
};

export type PickupRequestLike = {
  request_date?: string | null;
  request_type?: string | null;
  location_text?: string | null;
  address_text?: string | null;
  status?: string | null;
};

export type FormSubmissionLike = {
  form_key?: string | null;
  form_title?: string | null;
  status?: string | null;
  signed_at?: string | null;
  submitted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  payload?: unknown;
  data?: unknown;
};

export type ChiChiSellerProfile = {
  businessName: string;
  sellerName: string;
  sellerAddress: string;
  sellerPhone: string;
  sellerEmail: string;
  sellerWebsite: string;
  sellerSignature: string;
};

export type ChiChiBuildMergeContext = {
  buyer?: BuyerLike | null;
  puppy?: PuppyLike | null;
  pickupRequest?: PickupRequestLike | null;
  forms?: FormSubmissionLike[] | null;
  seller?: Partial<ChiChiSellerProfile> | null;
  packageId?: string | null;
  portalRecordId?: string | number | null;
  agreementDate?: string | null;
  vetExamWindow?: string | null;
  finance?: {
    firstPaymentDueDate?: string | null;
    finalPaymentDueDate?: string | null;
    paymentPlatform?: string | null;
    apr?: number | null;
    months?: number | null;
    monthlyPayment?: number | null;
    downPayment?: number | null;
    financeCharge?: number | null;
    amountFinanced?: number | null;
    totalOfPayments?: number | null;
    totalSalePrice?: number | null;
  } | null;
};

export type ChiChiBuyerDealProfile = {
  seller: {
    businessName: string;
    sellerName: string;
    sellerAddress: string;
    sellerPhone: string;
    sellerEmail: string;
    sellerWebsite: string;
    sellerSignature: string;
  };
  buyer: {
    fullName: string;
    email: string;
    phone: string;
    address1: string;
    city: string;
    state: string;
    zip: string;
    addressCombined: string;
  };
  application: {
    applicationDate: string;
    preferredContactMethod: string;
    preferredCoatType: string;
    preferredGender: string;
    colorPreference: string;
    desiredAdoptionDate: string;
    interestType: string;
    hasOtherPets: string;
    petDetails: string;
    ownedChihuahuaBefore: string;
    homeType: string;
    fencedYard: string;
    workStatus: string;
    whoCaresForPuppy: string;
    childrenAtHome: string;
    paymentPreference: string;
    referralSource: string;
    readyToPlaceDeposit: string;
    applicantQuestions: string;
    applicantSignature: string;
    applicantSignedAt: string;
    declarationInitials: {
      ageCapacity: string;
      accuracy: string;
      homeEnvironment: string;
      careCommitment: string;
      healthGuarantee: string;
      deposit: string;
      priceTax: string;
      contractualObligation: string;
      returnPolicy: string;
      liability: string;
      terms: string;
      communications: string;
    };
  };
  puppy: {
    id: number | null;
    callName: string;
    registeredName: string;
    dob: string;
    sex: string;
    color: string;
    coatType: string;
    registry: string;
    sire: string;
    dam: string;
  };
  sale: {
    agreementDate: string;
    packageId: string;
    portalRecordId: string;
    reservationType: string;
    depositAmount: number | null;
    depositPaidDate: string;
    depositPaymentMethod: string;
    estimatedPurchasePrice: number | null;
    estimatedTax: number | null;
    estimatedDeliveryFee: number | null;
    estimatedBalanceDue: number | null;
    vetExamWindow: string;
  };
  financing: {
    enabled: boolean;
    apr: number | null;
    months: number | null;
    monthlyPayment: number | null;
    firstPaymentDueDate: string;
    finalPaymentDueDate: string;
    paymentPlatform: string;
    downPayment: number | null;
    financeCharge: number | null;
    amountFinanced: number | null;
    totalOfPayments: number | null;
    totalSalePrice: number | null;
  };
  delivery: {
    method: string;
    date: string;
    location: string;
  };
};

const DEFAULT_SELLER: ChiChiSellerProfile = {
  businessName: "Southwest Virginia Chihuahua",
  sellerName: "Cristy Smith",
  sellerAddress: "323 Staley Street Marion, VA 24354",
  sellerPhone: "(276) 780-4739",
  sellerEmail: "contact@swvachihuahua.com",
  sellerWebsite: "https://swvachihuahua.com",
  sellerSignature: "Cristy Smith",
};

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeLower(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function normalizeDate(value: unknown) {
  const text = normalizeText(value);
  if (!text) return "";
  return text;
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const cleaned =
    typeof value === "string"
      ? value.replace(/[$,%\s,]/g, "")
      : value;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function toBoolean(value: unknown) {
  const text = normalizeLower(value);
  if (!text) return false;
  return ["true", "yes", "y", "1", "enabled"].includes(text);
}

function firstFilled(...values: unknown[]) {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) return text;
  }
  return "";
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const num = normalizeNumber(value);
    if (num !== null) return num;
  }
  return null;
}

function buildAddressCombined(address1: string, city: string, state: string, zip: string) {
  const line2 = [city, state, zip].filter(Boolean).join(", ").replace(", ,", ",");
  return [address1, line2].filter(Boolean).join(" ").trim();
}

function getSubmissionPayload(submission: FormSubmissionLike): UnknownRecord | null {
  return asRecord(submission.payload) || asRecord(submission.data);
}

function submissionTimestamp(submission: FormSubmissionLike) {
  return (
    new Date(
      normalizeText(
        submission.updated_at ||
          submission.submitted_at ||
          submission.signed_at ||
          submission.created_at
      )
    ).getTime() || 0
  );
}

function sortNewestFirst(forms: FormSubmissionLike[]) {
  return forms.slice().sort((a, b) => submissionTimestamp(b) - submissionTimestamp(a));
}

function matchesFormKey(submission: FormSubmissionLike, formKeys: string[]) {
  const key = normalizeLower(submission.form_key);
  const title = normalizeLower(submission.form_title);
  return formKeys.some((formKey) => {
    const match = normalizeLower(formKey);
    return key === match || title.includes(match);
  });
}

function findLatestSubmission(forms: FormSubmissionLike[], formKeys: string[]) {
  return sortNewestFirst(forms).find((submission) => matchesFormKey(submission, formKeys)) || null;
}

function getFormValue(
  forms: FormSubmissionLike[],
  formKeys: string[],
  fieldNames: string[]
): unknown {
  for (const submission of sortNewestFirst(forms)) {
    if (!matchesFormKey(submission, formKeys)) continue;
    const payload = getSubmissionPayload(submission);
    if (!payload) continue;

    for (const fieldName of fieldNames) {
      if (fieldName in payload) {
        const value = payload[fieldName];
        if (value !== null && value !== undefined && normalizeText(value)) {
          return value;
        }
      }
    }
  }

  return null;
}

function getApplicationSubmission(forms: FormSubmissionLike[]) {
  return findLatestSubmission(forms, [
    "application",
    "puppy-application",
    "puppy application",
    "application-form",
  ]);
}

function getDepositSubmission(forms: FormSubmissionLike[]) {
  return findLatestSubmission(forms, [
    "deposit-agreement",
    "deposit agreement",
    "deposit",
  ]);
}

function getFinancingSubmission(forms: FormSubmissionLike[]) {
  return findLatestSubmission(forms, [
    "payment-plan-agreement",
    "financing",
    "financing-application",
    "financing addendum",
    "payment plan",
  ]);
}

function buildSellerProfile(
  seller?: Partial<ChiChiSellerProfile> | null
): ChiChiBuyerDealProfile["seller"] {
  return {
    businessName: firstFilled(seller?.businessName, DEFAULT_SELLER.businessName),
    sellerName: firstFilled(seller?.sellerName, DEFAULT_SELLER.sellerName),
    sellerAddress: firstFilled(seller?.sellerAddress, DEFAULT_SELLER.sellerAddress),
    sellerPhone: firstFilled(seller?.sellerPhone, DEFAULT_SELLER.sellerPhone),
    sellerEmail: firstFilled(seller?.sellerEmail, DEFAULT_SELLER.sellerEmail),
    sellerWebsite: firstFilled(seller?.sellerWebsite, DEFAULT_SELLER.sellerWebsite),
    sellerSignature: firstFilled(seller?.sellerSignature, DEFAULT_SELLER.sellerSignature),
  };
}

function buildBuyerProfile(context: ChiChiBuildMergeContext, forms: FormSubmissionLike[]) {
  const buyer = context.buyer || null;

  const fullName = firstFilled(
    buyer?.full_name,
    buyer?.name,
    getFormValue(forms, ["application", "puppy-application"], [
      "applicant_full_name",
      "buyer_full_name",
    ])
  );

  const email = firstFilled(
    buyer?.email,
    getFormValue(forms, ["application", "puppy-application"], [
      "applicant_email",
      "buyer_email",
    ])
  );

  const phone = firstFilled(
    buyer?.phone,
    getFormValue(forms, ["application", "puppy-application"], [
      "applicant_phone",
      "buyer_phone",
    ])
  );

  const address1 = firstFilled(
    buyer?.address_1,
    buyer?.address,
    getFormValue(forms, ["application", "puppy-application"], [
      "applicant_address_1",
      "buyer_address",
      "buyer_address_1",
    ])
  );

  const city = firstFilled(
    buyer?.city,
    getFormValue(forms, ["application", "puppy-application"], [
      "applicant_city",
      "buyer_city",
    ])
  );

  const state = firstFilled(
    buyer?.state,
    getFormValue(forms, ["application", "puppy-application"], [
      "applicant_state",
      "buyer_state",
    ])
  );

  const zip = firstFilled(
    buyer?.zip,
    getFormValue(forms, ["application", "puppy-application"], [
      "applicant_zip",
      "buyer_zip",
    ])
  );

  return {
    fullName,
    email,
    phone,
    address1,
    city,
    state,
    zip,
    addressCombined: buildAddressCombined(address1, city, state, zip),
  };
}

function buildApplicationProfile(forms: FormSubmissionLike[]) {
  const applicationSubmission = getApplicationSubmission(forms);

  return {
    applicationDate: normalizeDate(
      getFormValue(forms, ["application", "puppy-application"], ["application_date"]) ||
        applicationSubmission?.submitted_at ||
        applicationSubmission?.created_at
    ),
    preferredContactMethod: firstFilled(
      getFormValue(forms, ["application", "puppy-application"], ["preferred_contact_method"])
    ),
    preferredCoatType: firstFilled(
      getFormValue(forms, ["application", "puppy-application"], ["preferred_coat_type"])
    ),
    preferredGender: firstFilled(
      getFormValue(forms, ["application", "puppy-application"], ["preferred_gender"])
    ),
    colorPreference: firstFilled(
      getFormValue(forms, ["application", "puppy-application"], ["color_preference"])
    ),
    desiredAdoptionDate: firstFilled(
      getFormValue(forms, ["application", "puppy-application"], ["desired_adoption_date"])
    ),
    interestType: firstFilled(
      getFormValue(forms, ["application", "puppy-application"], ["interest_type"])
    ),
    hasOtherPets: firstFilled(
      getFormValue(forms, ["application", "puppy-application"], ["has_other_pets"])
    ),
    petDetails: firstFilled(
      getFormValue(forms, ["application", "puppy-application"], ["pet_details"])
    ),
    ownedChihuahuaBefore: firstFilled(
      getFormValue(forms, ["application", "puppy-application"], ["owned_chihuahua_before"])
    ),
    homeType: firstFilled(
      getFormValue(forms, ["application", "puppy-application"], ["home_type"])
    ),
    fencedYard: firstFilled(
      getFormValue(forms, ["application", "puppy-application"], ["fenced_yard"])
    ),
    workStatus: firstFilled(
      getFormValue(forms, ["application", "puppy-application"], ["work_status"])
    ),
    whoCaresForPuppy: firstFilled(
      getFormValue(forms, ["application", "puppy-application"], ["who_cares_for_puppy"])
    ),
    childrenAtHome: firstFilled(
      getFormValue(forms, ["application", "puppy-application"], ["children_at_home"])
    ),
    paymentPreference: firstFilled(
      getFormValue(forms, ["application", "puppy-application"], ["payment_preference"])
    ),
    referralSource: firstFilled(
      getFormValue(forms, ["application", "puppy-application"], ["referral_source"])
    ),
    readyToPlaceDeposit: firstFilled(
      getFormValue(forms, ["application", "puppy-application"], ["ready_to_place_deposit"])
    ),
    applicantQuestions: firstFilled(
      getFormValue(forms, ["application", "puppy-application"], ["applicant_questions"])
    ),
    applicantSignature: firstFilled(
      getFormValue(forms, ["application", "puppy-application"], ["applicant_signature"])
    ),
    applicantSignedAt: normalizeDate(
      getFormValue(forms, ["application", "puppy-application"], ["applicant_signed_at"])
    ),
    declarationInitials: {
      ageCapacity: firstFilled(
        getFormValue(forms, ["application", "puppy-application"], ["decl_age_capacity_initial"])
      ),
      accuracy: firstFilled(
        getFormValue(forms, ["application", "puppy-application"], ["decl_accuracy_initial"])
      ),
      homeEnvironment: firstFilled(
        getFormValue(forms, ["application", "puppy-application"], ["decl_home_environment_initial"])
      ),
      careCommitment: firstFilled(
        getFormValue(forms, ["application", "puppy-application"], ["decl_care_commitment_initial"])
      ),
      healthGuarantee: firstFilled(
        getFormValue(forms, ["application", "puppy-application"], ["decl_health_guarantee_initial"])
      ),
      deposit: firstFilled(
        getFormValue(forms, ["application", "puppy-application"], ["decl_deposit_initial"])
      ),
      priceTax: firstFilled(
        getFormValue(forms, ["application", "puppy-application"], ["decl_price_tax_initial"])
      ),
      contractualObligation: firstFilled(
        getFormValue(forms, ["application", "puppy-application"], [
          "decl_contractual_obligation_initial",
        ])
      ),
      returnPolicy: firstFilled(
        getFormValue(forms, ["application", "puppy-application"], ["decl_return_policy_initial"])
      ),
      liability: firstFilled(
        getFormValue(forms, ["application", "puppy-application"], ["decl_liability_initial"])
      ),
      terms: firstFilled(
        getFormValue(forms, ["application", "puppy-application"], ["decl_terms_initial"])
      ),
      communications: firstFilled(
        getFormValue(forms, ["application", "puppy-application"], ["decl_communications_initial"])
      ),
    },
  };
}

function buildPuppyProfile(context: ChiChiBuildMergeContext, forms: FormSubmissionLike[]) {
  const puppy = context.puppy || null;

  return {
    id: puppy?.id ?? null,
    callName: firstFilled(
      puppy?.call_name,
      puppy?.puppy_name,
      puppy?.name,
      getFormValue(forms, ["deposit-agreement"], ["puppy_call_name"])
    ),
    registeredName: firstFilled(
      puppy?.registered_name,
      getFormValue(forms, ["deposit-agreement"], ["puppy_registered_name"])
    ),
    dob: normalizeDate(
      firstFilled(
        puppy?.dob,
        getFormValue(forms, ["deposit-agreement"], ["puppy_dob"])
      )
    ),
    sex: firstFilled(
      puppy?.sex,
      getFormValue(forms, ["deposit-agreement"], ["puppy_sex"])
    ),
    color: firstFilled(
      puppy?.color,
      getFormValue(forms, ["deposit-agreement"], ["puppy_color"])
    ),
    coatType: firstFilled(
      puppy?.coat_type,
      getFormValue(forms, ["deposit-agreement"], ["puppy_coat_type"])
    ),
    registry: firstFilled(
      puppy?.registry,
      getFormValue(forms, ["deposit-agreement"], ["puppy_registry"])
    ),
    sire: firstFilled(
      puppy?.sire,
      getFormValue(forms, ["payment-plan-agreement", "financing"], ["puppy_sire", "sire"])
    ),
    dam: firstFilled(
      puppy?.dam,
      getFormValue(forms, ["payment-plan-agreement", "financing"], ["puppy_dam", "dam"])
    ),
  };
}

function buildSaleProfile(context: ChiChiBuildMergeContext, forms: FormSubmissionLike[]) {
  const buyer = context.buyer || null;
  const puppy = context.puppy || null;

  const estimatedPurchasePrice = firstNumber(
    buyer?.sale_price,
    puppy?.price,
    puppy?.list_price,
    getFormValue(forms, ["deposit-agreement"], [
      "estimated_purchase_price",
      "purchase_price",
      "sale_price",
    ])
  );

  const depositAmount = firstNumber(
    buyer?.deposit_amount,
    getFormValue(forms, ["deposit-agreement"], ["deposit_amount"])
  );

  const estimatedTax = firstNumber(
    getFormValue(forms, ["deposit-agreement"], ["estimated_tax", "tax"])
  );

  const estimatedDeliveryFee = firstNumber(
    getFormValue(forms, ["deposit-agreement"], [
      "estimated_delivery_fee",
      "delivery_fee",
      "transport_fee",
    ])
  );

  const estimatedBalanceDue = firstNumber(
    getFormValue(forms, ["deposit-agreement"], [
      "estimated_balance_due",
      "remaining_balance",
      "balance_due",
    ])
  );

  const computedBalance =
    estimatedBalanceDue !== null
      ? estimatedBalanceDue
      : estimatedPurchasePrice !== null
        ? Math.max(
            0,
            estimatedPurchasePrice -
              (depositAmount || 0) +
              (estimatedTax || 0) +
              (estimatedDeliveryFee || 0)
          )
        : null;

  return {
    agreementDate: normalizeDate(
      firstFilled(
        context.agreementDate,
        getFormValue(forms, ["deposit-agreement"], ["agreement_date"]),
        new Date().toISOString().slice(0, 10)
      )
    ),
    packageId: firstFilled(
      context.packageId,
      getFormValue(forms, ["application", "deposit-agreement"], ["package_id"])
    ),
    portalRecordId: firstFilled(
      context.portalRecordId,
      getFormValue(forms, ["application", "deposit-agreement"], ["portal_record_id"])
    ),
    reservationType: firstFilled(
      getFormValue(forms, ["deposit-agreement"], ["reservation_type"]),
      "Specific puppy reservation"
    ),
    depositAmount,
    depositPaidDate: normalizeDate(
      firstFilled(
        buyer?.deposit_date,
        getFormValue(forms, ["deposit-agreement"], ["deposit_paid_date"])
      )
    ),
    depositPaymentMethod: firstFilled(
      buyer?.deposit_payment_method,
      getFormValue(forms, ["deposit-agreement"], ["deposit_payment_method"])
    ),
    estimatedPurchasePrice,
    estimatedTax,
    estimatedDeliveryFee,
    estimatedBalanceDue: computedBalance,
    vetExamWindow: firstFilled(
      context.vetExamWindow,
      getFormValue(forms, ["deposit-agreement"], ["vet_exam_window"]),
      "10 days"
    ),
  };
}

function buildFinancingProfile(context: ChiChiBuildMergeContext, forms: FormSubmissionLike[]) {
  const buyer = context.buyer || null;
  const finance = context.finance || null;
  const depositAmount = firstNumber(
    finance?.downPayment,
    buyer?.deposit_amount,
    getFormValue(forms, ["deposit-agreement"], ["deposit_amount"])
  );

  const totalSalePrice = firstNumber(
    finance?.totalSalePrice,
    buyer?.sale_price,
    context.puppy?.price,
    context.puppy?.list_price,
    getFormValue(forms, ["payment-plan-agreement", "financing"], [
      "total_sale_price",
      "purchase_price",
      "sale_price",
    ])
  );

  const amountFinanced = firstNumber(
    finance?.amountFinanced,
    getFormValue(forms, ["payment-plan-agreement", "financing"], ["amount_financed"])
  );

  const financeCharge = firstNumber(
    finance?.financeCharge,
    getFormValue(forms, ["payment-plan-agreement", "financing"], ["finance_charge"])
  );

  const totalOfPayments = firstNumber(
    finance?.totalOfPayments,
    getFormValue(forms, ["payment-plan-agreement", "financing"], ["total_of_payments"])
  );

  return {
    enabled: Boolean(
      finance?.months ||
        finance?.monthlyPayment ||
        buyer?.finance_enabled ||
        getFinancingSubmission(forms)
    ),
    apr: firstNumber(
      finance?.apr,
      buyer?.finance_rate,
      getFormValue(forms, ["payment-plan-agreement", "financing"], ["apr", "finance_rate"])
    ),
    months: firstNumber(
      finance?.months,
      buyer?.finance_months,
      getFormValue(forms, ["payment-plan-agreement", "financing"], [
        "finance_months",
        "payment_term_months",
      ])
    ),
    monthlyPayment: firstNumber(
      finance?.monthlyPayment,
      buyer?.finance_monthly_amount,
      getFormValue(forms, ["payment-plan-agreement", "financing"], [
        "monthly_payment",
        "regular_monthly_payment",
        "finance_monthly_amount",
      ])
    ),
    firstPaymentDueDate: normalizeDate(
      firstFilled(
        finance?.firstPaymentDueDate,
        getFormValue(forms, ["payment-plan-agreement", "financing"], ["first_payment_due_date"])
      )
    ),
    finalPaymentDueDate: normalizeDate(
      firstFilled(
        finance?.finalPaymentDueDate,
        getFormValue(forms, ["payment-plan-agreement", "financing"], ["final_payment_due_date"])
      )
    ),
    paymentPlatform: firstFilled(
      finance?.paymentPlatform,
      getFormValue(forms, ["payment-plan-agreement", "financing"], [
        "payment_platform",
        "approved_payment_platform",
      ])
    ),
    downPayment: depositAmount,
    financeCharge,
    amountFinanced:
      amountFinanced !== null
        ? amountFinanced
        : totalSalePrice !== null
          ? Math.max(0, totalSalePrice - (depositAmount || 0))
          : null,
    totalOfPayments:
      totalOfPayments !== null
        ? totalOfPayments
        : totalSalePrice,
    totalSalePrice,
  };
}

function buildDeliveryProfile(context: ChiChiBuildMergeContext, forms: FormSubmissionLike[]) {
  const buyer = context.buyer || null;
  const pickupRequest = context.pickupRequest || null;

  return {
    method: firstFilled(
      pickupRequest?.request_type,
      buyer?.delivery_option,
      getFormValue(forms, ["pickup-delivery-confirmation", "transportation"], [
        "delivery_method",
        "request_type",
      ])
    ),
    date: normalizeDate(
      firstFilled(
        pickupRequest?.request_date,
        buyer?.delivery_date,
        getFormValue(forms, ["pickup-delivery-confirmation", "transportation"], [
          "delivery_date",
          "request_date",
        ])
      )
    ),
    location: firstFilled(
      pickupRequest?.location_text,
      pickupRequest?.address_text,
      buyer?.delivery_location,
      getFormValue(forms, ["pickup-delivery-confirmation", "transportation"], [
        "delivery_location",
        "location_text",
        "address_text",
      ])
    ),
  };
}

export function buildChiChiBuyerDealProfile(
  context: ChiChiBuildMergeContext
): ChiChiBuyerDealProfile {
  const forms = (context.forms || []).slice();

  return {
    seller: buildSellerProfile(context.seller),
    buyer: buildBuyerProfile(context, forms),
    application: buildApplicationProfile(forms),
    puppy: buildPuppyProfile(context, forms),
    sale: buildSaleProfile(context, forms),
    financing: buildFinancingProfile(context, forms),
    delivery: buildDeliveryProfile(context, forms),
  };
}

function moneyString(value: number | null) {
  return value === null ? "" : String(value);
}

function buildApplicationMergeData(profile: ChiChiBuyerDealProfile): Record<string, unknown> {
  return {
    application_date: profile.application.applicationDate,
    package_id: profile.sale.packageId,
    portal_record_id: profile.sale.portalRecordId,

    seller_business_name: profile.seller.businessName,
    seller_name: profile.seller.sellerName,
    seller_address: profile.seller.sellerAddress,
    seller_phone: profile.seller.sellerPhone,
    seller_email: profile.seller.sellerEmail,
    seller_website: profile.seller.sellerWebsite,
    seller_signature: profile.seller.sellerSignature,
    seller_signed_at: "",

    applicant_full_name: profile.buyer.fullName,
    applicant_email: profile.buyer.email,
    applicant_phone: profile.buyer.phone,
    applicant_address_1: profile.buyer.address1,
    applicant_city: profile.buyer.city,
    applicant_state: profile.buyer.state,
    applicant_zip: profile.buyer.zip,
    preferred_contact_method: profile.application.preferredContactMethod,

    preferred_coat_type: profile.application.preferredCoatType,
    preferred_gender: profile.application.preferredGender,
    color_preference: profile.application.colorPreference,
    desired_adoption_date: profile.application.desiredAdoptionDate,
    interest_type: profile.application.interestType,

    has_other_pets: profile.application.hasOtherPets,
    pet_details: profile.application.petDetails,
    owned_chihuahua_before: profile.application.ownedChihuahuaBefore,
    home_type: profile.application.homeType,
    fenced_yard: profile.application.fencedYard,
    work_status: profile.application.workStatus,
    who_cares_for_puppy: profile.application.whoCaresForPuppy,
    children_at_home: profile.application.childrenAtHome,

    payment_preference: profile.application.paymentPreference,
    referral_source: profile.application.referralSource,
    ready_to_place_deposit: profile.application.readyToPlaceDeposit,
    applicant_questions: profile.application.applicantQuestions,

    decl_age_capacity_initial: profile.application.declarationInitials.ageCapacity,
    decl_accuracy_initial: profile.application.declarationInitials.accuracy,
    decl_home_environment_initial: profile.application.declarationInitials.homeEnvironment,
    decl_care_commitment_initial: profile.application.declarationInitials.careCommitment,
    decl_health_guarantee_initial: profile.application.declarationInitials.healthGuarantee,
    decl_deposit_initial: profile.application.declarationInitials.deposit,
    decl_price_tax_initial: profile.application.declarationInitials.priceTax,
    decl_contractual_obligation_initial:
      profile.application.declarationInitials.contractualObligation,
    decl_return_policy_initial: profile.application.declarationInitials.returnPolicy,
    decl_liability_initial: profile.application.declarationInitials.liability,
    decl_terms_initial: profile.application.declarationInitials.terms,
    decl_communications_initial: profile.application.declarationInitials.communications,

    applicant_signature: profile.application.applicantSignature,
    applicant_signed_at: profile.application.applicantSignedAt,
  };
}

function buildDepositAgreementMergeData(
  profile: ChiChiBuyerDealProfile
): Record<string, unknown> {
  return {
    agreement_date: profile.sale.agreementDate,
    package_id: profile.sale.packageId,
    portal_record_id: profile.sale.portalRecordId,

    seller_business_name: profile.seller.businessName,
    seller_name: profile.seller.sellerName,
    seller_address: profile.seller.sellerAddress,
    seller_phone: profile.seller.sellerPhone,
    seller_email: profile.seller.sellerEmail,
    seller_website: profile.seller.sellerWebsite,
    seller_signature: profile.seller.sellerSignature,
    seller_signed_at: "",

    buyer_full_name: profile.buyer.fullName,
    buyer_address: profile.buyer.addressCombined || profile.buyer.address1,
    buyer_phone: profile.buyer.phone,
    buyer_email: profile.buyer.email,

    puppy_call_name: profile.puppy.callName,
    puppy_registered_name: profile.puppy.registeredName,
    puppy_dob: profile.puppy.dob,
    puppy_sex: profile.puppy.sex,
    puppy_color: profile.puppy.color,
    puppy_coat_type: profile.puppy.coatType,
    puppy_registry: profile.puppy.registry,
    reservation_type: profile.sale.reservationType,
    interest_type: profile.application.interestType,

    deposit_amount: moneyString(profile.sale.depositAmount),
    deposit_paid_date: profile.sale.depositPaidDate,
    deposit_payment_method: profile.sale.depositPaymentMethod,
    estimated_purchase_price: moneyString(profile.sale.estimatedPurchasePrice),
    estimated_tax: moneyString(profile.sale.estimatedTax),
    estimated_delivery_fee: moneyString(profile.sale.estimatedDeliveryFee),
    estimated_balance_due: moneyString(profile.sale.estimatedBalanceDue),

    vet_exam_window: profile.sale.vetExamWindow,

    buyer_signature: "",
    buyer_signed_at: "",
  };
}

function buildFinancingAddendumMergeData(
  profile: ChiChiBuyerDealProfile
): Record<string, unknown> {
  return {
    agreement_date: profile.sale.agreementDate,

    seller_business_name: profile.seller.businessName,
    seller_name: profile.seller.sellerName,
    seller_address: profile.seller.sellerAddress,
    seller_email: profile.seller.sellerEmail,
    seller_phone: profile.seller.sellerPhone,

    buyer_full_name: profile.buyer.fullName,
    buyer_address: profile.buyer.addressCombined || profile.buyer.address1,
    buyer_email: profile.buyer.email,
    buyer_phone: profile.buyer.phone,

    puppy_registry: profile.puppy.registry,
    puppy_sex: profile.puppy.sex,
    puppy_sire: profile.puppy.sire,
    puppy_dob: profile.puppy.dob,
    puppy_dam: profile.puppy.dam,

    total_sale_price: moneyString(profile.financing.totalSalePrice),
    first_payment_due_date: profile.financing.firstPaymentDueDate,
    payment_term_months: profile.financing.months === null ? "" : String(profile.financing.months),
    regular_monthly_payment: moneyString(profile.financing.monthlyPayment),
    final_payment_due_date: profile.financing.finalPaymentDueDate,
    approved_payment_platform: profile.financing.paymentPlatform,

    purchase_price: moneyString(profile.sale.estimatedPurchasePrice),
    finance_charge: moneyString(profile.financing.financeCharge),
    down_payment: moneyString(profile.financing.downPayment),
    total_of_payments: moneyString(profile.financing.totalOfPayments),
    amount_financed: moneyString(profile.financing.amountFinanced),
    apr: profile.financing.apr === null ? "" : String(profile.financing.apr),

    buyer_initials: "",
    seller_initials: "",
    buyer_signature: "",
    buyer_signed_at: "",
    seller_signature: profile.seller.sellerSignature,
    seller_signed_at: "",
  };
}

export function buildChiChiDocumentMergeData(
  profile: ChiChiBuyerDealProfile,
  packageKey: ChiChiDocumentPackageKey
): Record<string, unknown> {
  switch (packageKey) {
    case "application":
      return buildApplicationMergeData(profile);

    case "deposit-agreement":
      return buildDepositAgreementMergeData(profile);

    case "payment-plan-agreement":
      return buildFinancingAddendumMergeData(profile);

    default:
      return {
        agreement_date: profile.sale.agreementDate,
        package_id: profile.sale.packageId,
        portal_record_id: profile.sale.portalRecordId,
        seller_business_name: profile.seller.businessName,
        seller_name: profile.seller.sellerName,
        seller_address: profile.seller.sellerAddress,
        seller_phone: profile.seller.sellerPhone,
        seller_email: profile.seller.sellerEmail,
        seller_website: profile.seller.sellerWebsite,
        buyer_full_name: profile.buyer.fullName,
        buyer_email: profile.buyer.email,
        buyer_phone: profile.buyer.phone,
        buyer_address: profile.buyer.addressCombined || profile.buyer.address1,
        puppy_call_name: profile.puppy.callName,
        puppy_registered_name: profile.puppy.registeredName,
        puppy_dob: profile.puppy.dob,
        puppy_sex: profile.puppy.sex,
        puppy_color: profile.puppy.color,
        puppy_coat_type: profile.puppy.coatType,
        puppy_registry: profile.puppy.registry,
      };
  }
}