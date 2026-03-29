"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { sb, fmtDate } from "@/lib/utils";

type PuppyApplicationRow = {
  id: number;
  created_at: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  city_state: string | null;
  preferred_contact: string | null;
  best_time: string | null;
  street_address: string | null;
  zip: string | null;
  status: string | null;
  admin_notes: string | null;
  application: any;
  applicant_email: string | null;
  ack_age?: boolean | null;
  ack_accuracy?: boolean | null;
  ack_home_env?: boolean | null;
  ack_care_commitment?: boolean | null;
  ack_health_guarantee?: boolean | null;
  ack_nonrefundable_deposit?: boolean | null;
  ack_purchase_price_tax?: boolean | null;
  ack_contract_obligation?: boolean | null;
  ack_return_policy?: boolean | null;
  ack_release_liability?: boolean | null;
  ack_terms?: boolean | null;
  ack_communications?: boolean | null;
  assigned_puppy_id?: number | null;
};

type FormState = {
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

const TERMS_TEXT = `Please read these Terms and Conditions (“Terms”) carefully before submitting your Puppy Adoption Application to Southwest Virginia Chihuahua (“Breeder,” “we,” “us,” or “our”). By clicking “I Agree” and submitting the application form, you (“Applicant,” “you,” or “your”) acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree to these Terms in full, please do not submit an application.

1. Application Process

1.1 Incomplete or Incorrect Information
You agree to provide complete, accurate, and truthful information in your application. Providing false, incomplete, or misleading information may result in immediate disqualification of your application or rehoming of the puppy at our sole discretion.

1.2 Non-Binding Application
Submission of an application does not guarantee approval or reservation of any puppy. All applications are subject to Breeder review and approval. We reserve the right, in our sole discretion, to accept or reject any application for any reason.

1.3 Application Fee
As of the date of this application, there is no separate application fee. However, once an application is approved, a nonrefundable $250 deposit will be required to reserve the puppy. By submitting this application, you acknowledge that, if approved, you will be asked to pay the deposit within a specified timeframe and that this deposit is nonrefundable under all circumstances.

2. Deposit and Reservation

2.1 Deposit Requirement
If your application is approved, we will provide you with a link to pay a nonrefundable $250 deposit (“Deposit”). Your puppy will be reserved once we receive cleared payment of this Deposit.

2.2 Nonrefundable Nature of Deposit
Under no circumstances will the Deposit be refunded. The Deposit covers part of our administrative and care costs incurred to date (e.g., vaccinations, de-worming, health checks, socialization, and documentation). Should you fail to complete payment of the Deposit within the timeframe specified, your reservation may be canceled and the puppy may be released to another approved applicant.

2.3 Reservation Period
Upon receipt of the Deposit, the puppy will be marked as “Reserved” in our records. If you do not complete the remaining balance payment within the “Balance Due” deadline (as communicated in your Approval Packet), the reservation may be forfeited, and the Deposit will not be refunded.

3. Approval, Rejection, and Wait list

3.1 Approval Criteria
We evaluate applications based on factors including, but not limited to:
- Household environment (fenced yard, pet-friendly living situation, etc.)
- Reason for adoption (pet, companion, breeding, etc.)
- Ability to provide lifelong veterinary care, food, grooming, and a safe environment
- Understanding of Chihuahua-specific health concerns and breed characteristics

3.2 Right to Reject
We reserve the right to reject any application for any reason, including (but not limited to) concerns about the applicant’s living conditions, inability to meet our health guarantee requirements, or concern over potential resale or mistreatment.

3.3 Wait list
If your application is declined but you wish to remain on a wait list for future litters, you may notify us, and we will keep your contact information on file. Being on the wait list does not guarantee future availability; all applicants—new or waiting—will undergo the same approval process when a new litter becomes available.

4. Privacy and Data Use

4.1 Personal Information
By submitting this application, you authorize Southwest Virginia Chihuahua to collect, store, and use your personal information (e.g., name, address, phone number, email) solely for purposes of reviewing and processing your application, facilitating puppy reservation, and providing post-adoption support (e.g., health updates, puppy care guides). We do not share your personal data with outside parties except as required by law or as necessary for completing transactions (e.g., payment processors).

4.2 Communications
You expressly consent to receive communications from us via email, SMS/text message, or phone regarding your application status, payment instructions, puppy updates, and any required appointments (e.g., veterinary checks). If you change any contact information, you agree to inform us promptly.

5. Health Guarantee and Contractual Terms

5.1 Health Guarantee
All puppies are sold with a limited health guarantee as described in our Puppy Sales Agreement and Health Guarantee (“Health Guarantee”), which will be provided to you if your application is approved. The Health Guarantee covers congenital and genetic disorders for one year from the puppy’s date of birth, subject to specific conditions, exclusions, and processes delineated in that agreement.

5.2 Contract Requirement
After paying the Deposit, you will be required to sign our Puppy Sales Agreement and Health Guarantee through Zoho Sign before finalizing any reservation.

6. Ownership Transfer and Delivery

6.1 Balance Due Before Transfer
The remaining balance (purchase price minus Deposit) plus applicable tax must be paid in full prior to pickup or delivery of the puppy.

6.2 Delivery Options Only
We do not offer in-person pickups at our facility.

6.3 Transfer of Ownership
Ownership of the puppy will transfer to the Buyer only after receipt of full payment and signed contract.

7. Post-Approval Responsibilities

7.1 Veterinary Examination
You agree to have your puppy examined by a licensed veterinarian within ten (10) days of taking possession.

7.2 Ongoing Care
You agree to provide regular veterinary care, vaccinations, de-worming, parasite prevention, and proper nutrition.

7.3 Lifetime Support and Return Policy
If at any point during the puppy’s life you are unable to care for the dog, you must contact us immediately.

8. Liability and Disclaimers

8.1 No Warranty Beyond Health Guarantee
Except as expressly stated in the Health Guarantee, the puppy is sold “as is.”

8.2 Limitation of Liability
In no event shall Southwest Virginia Chihuahua, its owners, employees, or agents be liable for any incidental, consequential, or punitive damages arising from or related to your application, adoption, or ownership of any puppy.

9. Governing Law and Dispute Resolution

9.1 Governing Law
These Terms shall be governed by and construed in accordance with the laws of the Commonwealth of Virginia.

9.2 Dispute Resolution
If any dispute arises, you agree to attempt informal resolution first, then mediation, before court action.

10. Miscellaneous

10.1 Severability
If any provision is held invalid, the remaining provisions shall continue in full force and effect.

10.2 No Waiver
No waiver of any term shall be deemed a continuing waiver.

10.3 Amendments
We reserve the right to modify or update these Terms at any time.

By clicking “I Agree” and submitting your application, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.`;

const defaultForm = (): FormState => ({
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
});

export default function PortalApplicationPage() {
  const [user, setUser] = useState<any>(null);
  const [applicationRow, setApplicationRow] = useState<PuppyApplicationRow | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const {
          data: { session },
        } = await sb.auth.getSession();

        if (!mounted) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          await loadApplication(currentUser);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: authListener } = sb.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;
        if (!mounted) return;

        setUser(currentUser);

        if (currentUser) {
          await loadApplication(currentUser);
        } else {
          setApplicationRow(null);
          setForm(defaultForm());
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function loadApplication(currUser: any) {
    const email = String(currUser?.email || "").toLowerCase();
    const uid = currUser?.id;

    const { data, error } = await sb
      .from("puppy_applications")
      .select("*")
      .or(`user_id.eq.${uid},applicant_email.ilike.%${email}%,email.ilike.%${email}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      setApplicationRow(null);
      hydrateFormFromUser(currUser);
      return;
    }

    if (!data) {
      setApplicationRow(null);
      hydrateFormFromUser(currUser);
      return;
    }

    const row = data as PuppyApplicationRow;
    setApplicationRow(row);

    const app = row.application || {};
    const parsedCity = parseCityState(row.city_state || "");

    setForm({
      fullName: row.full_name || app.fullName || "",
      email: row.email || row.applicant_email || app.email || currUser?.email || "",
      phone: row.phone || app.phone || "",
      streetAddress: row.street_address || app.streetAddress || "",
      city: parsedCity.city || app.city || "",
      state: parsedCity.state || app.state || "",
      zip: row.zip || app.zip || "",
      preferredContactMethod: row.preferred_contact || app.preferredContactMethod || "",

      preferredCoatType: app.preferredCoatType || "",
      preferredGender: app.preferredGender || "",
      colorPreference: app.colorPreference || "",
      desiredAdoptionDate: app.desiredAdoptionDate || "",
      interestType: app.interestType || "",

      otherPets: app.otherPets || "",
      petDetails: app.petDetails || "",
      ownedChihuahuaBefore: app.ownedChihuahuaBefore || "",
      homeType: app.homeType || "",
      fencedYard: app.fencedYard || "",
      workStatus: app.workStatus || "",
      whoCaresForPuppy: app.whoCaresForPuppy || "",
      childrenAtHome: app.childrenAtHome || "",

      paymentPreference: app.paymentPreference || "",
      howDidYouHear: app.howDidYouHear || "",
      readyToPlaceDeposit: app.readyToPlaceDeposit || "",
      questions: app.questions || "",

      agreeTerms: !!app.agreeTerms,

      ackAgeCapacity: !!(row.ack_age ?? app.ackAgeCapacity),
      ackAccuracy: !!(row.ack_accuracy ?? app.ackAccuracy),
      ackHomeEnvironment: !!(row.ack_home_env ?? app.ackHomeEnvironment),
      ackCareCommitment: !!app.ackCareCommitment,
      ackHealthGuarantee: !!app.ackHealthGuarantee,
      ackNonrefundableDeposit: !!app.ackNonrefundableDeposit,
      ackPurchasePriceTax: !!app.ackPurchasePriceTax,
      ackContractualObligation: !!app.ackContractualObligation,
      ackReturnRehoming: !!app.ackReturnRehoming,
      ackReleaseLiability: !!app.ackReleaseLiability,
      ackAgreementTerms: !!(row.ack_terms ?? app.ackAgreementTerms),
      ackCommunications: !!app.ackCommunications,

      signedAt: app.signedAt || "",
      signature: app.signature || "",
    });
  }

  function hydrateFormFromUser(currUser: any) {
    setForm((prev) => ({
      ...prev,
      email: prev.email || currUser?.email || "",
      signedAt: prev.signedAt || formatDateTimeLocal(new Date()),
    }));
  }

  function parseCityState(value: string) {
    if (!value) return { city: "", state: "" };
    const parts = value.split(",").map((p) => p.trim());
    if (parts.length >= 2) return { city: parts[0], state: parts[1] };
    return { city: value, state: "" };
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validateForm() {
    if (!form.fullName.trim()) return "First and last name is required.";
    if (!form.state.trim()) return "State is required.";
    if (!form.email.trim()) return "Email address is required.";
    if (!form.agreeTerms) return "You must agree to the Terms and Conditions.";
    if (!form.signature.trim()) return "Signature is required.";

    const requiredDeclarations = [
      form.ackAgeCapacity,
      form.ackAccuracy,
      form.ackHomeEnvironment,
      form.ackCareCommitment,
      form.ackHealthGuarantee,
      form.ackNonrefundableDeposit,
      form.ackPurchasePriceTax,
      form.ackContractualObligation,
      form.ackReturnRehoming,
      form.ackReleaseLiability,
      form.ackAgreementTerms,
      form.ackCommunications,
    ];

    if (requiredDeclarations.some((v) => !v)) {
      return "All applicant declarations must be acknowledged.";
    }

    return "";
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (!user) return;

    const validationError = validateForm();
    if (validationError) {
      setSaveMessage(validationError);
      return;
    }

    setSaving(true);
    setSaveMessage("");

    const payload = {
      user_id: user.id,
      full_name: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      street_address: form.streetAddress.trim() || null,
      city_state:
        `${form.city.trim()}${form.city && form.state ? ", " : ""}${form.state.trim()}` || null,
      preferred_contact: form.preferredContactMethod || null,
      best_time: null,
      zip: form.zip.trim() || null,
      status: applicationRow?.status || "submitted",
      applicant_email: form.email.trim(),

      ack_age: form.ackAgeCapacity,
      ack_accuracy: form.ackAccuracy,
      ack_home_env: form.ackHomeEnvironment,
      ack_terms: form.ackAgreementTerms,

      application: {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        streetAddress: form.streetAddress.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        zip: form.zip.trim(),
        preferredContactMethod: form.preferredContactMethod,

        preferredCoatType: form.preferredCoatType,
        preferredGender: form.preferredGender,
        colorPreference: form.colorPreference,
        desiredAdoptionDate: form.desiredAdoptionDate,
        interestType: form.interestType,

        otherPets: form.otherPets,
        petDetails: form.petDetails,
        ownedChihuahuaBefore: form.ownedChihuahuaBefore,
        homeType: form.homeType,
        fencedYard: form.fencedYard,
        workStatus: form.workStatus,
        whoCaresForPuppy: form.whoCaresForPuppy,
        childrenAtHome: form.childrenAtHome,

        paymentPreference: form.paymentPreference,
        howDidYouHear: form.howDidYouHear,
        readyToPlaceDeposit: form.readyToPlaceDeposit,
        questions: form.questions,

        agreeTerms: form.agreeTerms,

        ackAgeCapacity: form.ackAgeCapacity,
        ackAccuracy: form.ackAccuracy,
        ackHomeEnvironment: form.ackHomeEnvironment,
        ackCareCommitment: form.ackCareCommitment,
        ackHealthGuarantee: form.ackHealthGuarantee,
        ackNonrefundableDeposit: form.ackNonrefundableDeposit,
        ackPurchasePriceTax: form.ackPurchasePriceTax,
        ackContractualObligation: form.ackContractualObligation,
        ackReturnRehoming: form.ackReturnRehoming,
        ackReleaseLiability: form.ackReleaseLiability,
        ackAgreementTerms: form.ackAgreementTerms,
        ackCommunications: form.ackCommunications,

        signedAt: form.signedAt || formatDateTimeLocal(new Date()),
        signature: form.signature.trim(),
        termsVersion: "2026-03",
      },
    };

    let error: any = null;

    if (applicationRow?.id) {
      const res = await sb.from("puppy_applications").update(payload).eq("id", applicationRow.id);
      error = res.error;
    } else {
      const res = await sb.from("puppy_applications").insert(payload);
      error = res.error;
    }

    if (error) {
      setSaveMessage(error.message || "Unable to save application.");
      setSaving(false);
      return;
    }

    await loadApplication(user);
    setSaveMessage("Application saved successfully.");
    setSaving(false);
  }

  const statusLabel = useMemo(() => {
    return applicationRow?.status || "not started";
  }, [applicationRow]);

  if (loading) {
    return (
      <div className="h-full min-h-screen flex items-center justify-center bg-brand-50 italic">
        Loading Application...
      </div>
    );
  }

  if (!user) {
    return <ApplicationLogin />;
  }

  return (
    <div className="h-full w-full text-brand-900 bg-brand-50">
      <main className="h-full relative flex flex-col overflow-hidden bg-texturePaper">
        <div className="flex-1 p-6 md:p-10 lg:p-12 overflow-y-auto scroller max-w-[1600px] mx-auto w-full">
          <div className="space-y-8 pb-14">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-brand-200 shadow-paper">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                    Puppy Application
                  </span>
                  <span className="w-1 h-1 rounded-full bg-brand-300" />
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                    Southwest Virginia Chihuahua
                  </span>
                </div>

                <h2 className="mt-5 font-serif text-4xl md:text-5xl font-bold text-brand-900 leading-[0.95]">
                  Application
                </h2>

                <p className="mt-2 text-brand-500 font-semibold">
                  Complete or update your puppy application. A copy stays in the portal for your
                  records.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] bg-white border border-brand-200 text-brand-700">
                  Status: {statusLabel}
                </span>
                {applicationRow?.created_at ? (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] bg-white border border-brand-200 text-brand-700">
                    Submitted: {fmtDate(applicationRow.created_at)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              <div className="xl:col-span-8">
                <form onSubmit={handleSave} className="space-y-8">
                  <section className="card-luxury p-7">
                    <h3 className="font-serif text-2xl font-bold text-brand-900 mb-5">
                      Section 1: Applicant Info
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <Field
                        label="First and Last Name *"
                        value={form.fullName}
                        onChange={(v) => updateField("fullName", v)}
                      />
                      <Field
                        label="Email Address"
                        type="email"
                        value={form.email}
                        onChange={(v) => updateField("email", v)}
                      />
                      <Field
                        label="Phone Number"
                        value={form.phone}
                        onChange={(v) => updateField("phone", v)}
                      />
                      <SelectField
                        label="Preferred Contact Method"
                        value={form.preferredContactMethod}
                        onChange={(v) => updateField("preferredContactMethod", v)}
                        options={["", "Phone", "Email", "Text Message"]}
                      />
                      <Field
                        label="Street Address"
                        value={form.streetAddress}
                        onChange={(v) => updateField("streetAddress", v)}
                      />
                      <Field
                        label="City"
                        value={form.city}
                        onChange={(v) => updateField("city", v)}
                      />
                      <Field
                        label="State *"
                        value={form.state}
                        onChange={(v) => updateField("state", v)}
                      />
                      <Field
                        label="Zip Code"
                        value={form.zip}
                        onChange={(v) => updateField("zip", v)}
                      />
                    </div>
                  </section>

                  <section className="card-luxury p-7">
                    <h3 className="font-serif text-2xl font-bold text-brand-900 mb-5">
                      Puppy Preferences
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <SelectField
                        label="Preferred Coat Type"
                        value={form.preferredCoatType}
                        onChange={(v) => updateField("preferredCoatType", v)}
                        options={["", "Smooth Coat", "Long Coat", "No Preference"]}
                      />
                      <SelectField
                        label="Preferred Gender"
                        value={form.preferredGender}
                        onChange={(v) => updateField("preferredGender", v)}
                        options={["", "Male", "Female", "No Preference"]}
                      />
                      <Field
                        label="Color Preference"
                        value={form.colorPreference}
                        onChange={(v) => updateField("colorPreference", v)}
                      />
                      <Field
                        label="Desired Adoption Date"
                        type="date"
                        value={form.desiredAdoptionDate}
                        onChange={(v) => updateField("desiredAdoptionDate", v)}
                      />
                      <div className="md:col-span-2">
                        <SelectField
                          label="Interest Type"
                          value={form.interestType}
                          onChange={(v) => updateField("interestType", v)}
                          options={["", "Current Puppy", "Future Puppy"]}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="card-luxury p-7">
                    <h3 className="font-serif text-2xl font-bold text-brand-900 mb-5">
                      Lifestyle & Home
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <SelectField
                        label="Do You Have Other Pets?"
                        value={form.otherPets}
                        onChange={(v) => updateField("otherPets", v)}
                        options={["", "Yes", "No"]}
                      />
                      <Field
                        label="Pet Details"
                        value={form.petDetails}
                        onChange={(v) => updateField("petDetails", v)}
                      />
                      <SelectField
                        label="Owned A Chihuahua Before?"
                        value={form.ownedChihuahuaBefore}
                        onChange={(v) => updateField("ownedChihuahuaBefore", v)}
                        options={["", "Yes", "No"]}
                      />
                      <Field
                        label="Home Type"
                        value={form.homeType}
                        onChange={(v) => updateField("homeType", v)}
                      />
                      <SelectField
                        label="Fenced Yard?"
                        value={form.fencedYard}
                        onChange={(v) => updateField("fencedYard", v)}
                        options={["", "Yes", "No"]}
                      />
                      <Field
                        label="Work Status"
                        value={form.workStatus}
                        onChange={(v) => updateField("workStatus", v)}
                      />
                      <Field
                        label="Who Cares for Puppy?"
                        value={form.whoCaresForPuppy}
                        onChange={(v) => updateField("whoCaresForPuppy", v)}
                      />
                      <Field
                        label="Children at Home"
                        value={form.childrenAtHome}
                        onChange={(v) => updateField("childrenAtHome", v)}
                      />
                    </div>
                  </section>

                  <section className="card-luxury p-7">
                    <h3 className="font-serif text-2xl font-bold text-brand-900 mb-5">
                      Payment & Agreement
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <Field
                        label="Payment Preference"
                        value={form.paymentPreference}
                        onChange={(v) => updateField("paymentPreference", v)}
                      />
                      <Field
                        label="How Did You Hear About Us?"
                        value={form.howDidYouHear}
                        onChange={(v) => updateField("howDidYouHear", v)}
                      />
                      <SelectField
                        label="Ready to Place Deposit?"
                        value={form.readyToPlaceDeposit}
                        onChange={(v) => updateField("readyToPlaceDeposit", v)}
                        options={["", "Yes", "No"]}
                      />
                      <div />
                      <div className="md:col-span-2">
                        <TextAreaField
                          label="Please input any questions that you may have here."
                          value={form.questions}
                          onChange={(v) => updateField("questions", v)}
                          rows={5}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="card-luxury p-7">
                    <h3 className="font-serif text-2xl font-bold text-brand-900 mb-5">
                      Terms and Conditions *
                    </h3>

                    <div className="rounded-2xl border border-brand-200 bg-white/60 p-5 max-h-[380px] overflow-y-auto whitespace-pre-wrap text-sm leading-7 text-brand-700 font-medium">
                      {TERMS_TEXT}
                    </div>

                    <div className="mt-5">
                      <CheckboxField
                        checked={form.agreeTerms}
                        onChange={(v) => updateField("agreeTerms", v)}
                        label="I Agree to the Terms and Conditions."
                      />
                    </div>
                  </section>

                  <section className="card-luxury p-7">
                    <h3 className="font-serif text-2xl font-bold text-brand-900 mb-5">
                      Applicant Declarations
                    </h3>

                    <div className="space-y-4">
                      <CheckboxField
                        checked={form.ackAgeCapacity}
                        onChange={(v) => updateField("ackAgeCapacity", v)}
                        label="Age and Capacity — I declare that I am at least 18 years of age and legally competent to enter into contracts."
                      />
                      <CheckboxField
                        checked={form.ackAccuracy}
                        onChange={(v) => updateField("ackAccuracy", v)}
                        label="Accuracy of Information — I declare that all information provided in this application is complete, accurate, and truthful to the best of my knowledge."
                      />
                      <CheckboxField
                        checked={form.ackHomeEnvironment}
                        onChange={(v) => updateField("ackHomeEnvironment", v)}
                        label="Home Environment & Pet Ownership — I declare that my home environment is suitable for a Chihuahua puppy."
                      />
                      <CheckboxField
                        checked={form.ackCareCommitment}
                        onChange={(v) => updateField("ackCareCommitment", v)}
                        label="Puppy Care Commitment — I am committed to proper nutrition, veterinary care, grooming, exercise, and socialization."
                      />
                      <CheckboxField
                        checked={form.ackHealthGuarantee}
                        onChange={(v) => updateField("ackHealthGuarantee", v)}
                        label="Health Guarantee Understanding — I understand the health guarantee and veterinary exam requirements."
                      />
                      <CheckboxField
                        checked={form.ackNonrefundableDeposit}
                        onChange={(v) => updateField("ackNonrefundableDeposit", v)}
                        label="Nonrefundable Deposit — I understand the $250 deposit is nonrefundable."
                      />
                      <CheckboxField
                        checked={form.ackPurchasePriceTax}
                        onChange={(v) => updateField("ackPurchasePriceTax", v)}
                        label="Purchase Price & Tax Acknowledgment — I understand purchase price varies and Virginia sales tax applies."
                      />
                      <CheckboxField
                        checked={form.ackContractualObligation}
                        onChange={(v) => updateField("ackContractualObligation", v)}
                        label="Contractual Obligation — I understand signed contract and full payment are required before transfer."
                      />
                      <CheckboxField
                        checked={form.ackReturnRehoming}
                        onChange={(v) => updateField("ackReturnRehoming", v)}
                        label="Return & Re-homing Policy — I will first contact Southwest Virginia Chihuahua if I cannot keep the puppy."
                      />
                      <CheckboxField
                        checked={form.ackReleaseLiability}
                        onChange={(v) => updateField("ackReleaseLiability", v)}
                        label="Release of Liability — I understand the breeder is not liable after transfer of ownership except as stated."
                      />
                      <CheckboxField
                        checked={form.ackAgreementTerms}
                        onChange={(v) => updateField("ackAgreementTerms", v)}
                        label="Agreement to Terms & Conditions — I have read, understand, and agree to be bound by the posted policies and terms."
                      />
                      <CheckboxField
                        checked={form.ackCommunications}
                        onChange={(v) => updateField("ackCommunications", v)}
                        label="Consent to Communications — I consent to emails, texts, and phone calls regarding my application and puppy updates."
                      />
                    </div>
                  </section>

                  <section className="card-luxury p-7">
                    <h3 className="font-serif text-2xl font-bold text-brand-900 mb-5">
                      Signature
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <Field
                        label="Date-Time"
                        type="datetime-local"
                        value={form.signedAt}
                        onChange={(v) => updateField("signedAt", v)}
                      />
                      <Field
                        label="Signature"
                        value={form.signature}
                        onChange={(v) => updateField("signature", v)}
                        placeholder="Type your full legal name"
                      />
                    </div>

                    <div className="mt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={() => updateField("signature", "")}
                        className="px-5 py-3 rounded-xl bg-white border border-brand-200 text-brand-800 font-black text-xs uppercase tracking-[0.18em] hover:bg-brand-50 transition"
                      >
                        Clear Signature
                      </button>
                    </div>
                  </section>

                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="text-sm font-semibold text-brand-600 min-h-[24px]">
                      {saveMessage}
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      className="px-7 py-3.5 bg-brand-800 text-white font-black text-sm rounded-xl hover:bg-brand-700 transition shadow-lift uppercase tracking-[0.12em] disabled:opacity-60"
                    >
                      {saving
                        ? "Saving..."
                        : applicationRow
                          ? "Update Application"
                          : "Submit Application"}
                    </button>
                  </div>
                </form>
              </div>

              <div className="xl:col-span-4">
                <div className="card-luxury p-7 sticky top-6 space-y-6">
                  <div>
                    <h3 className="font-serif text-2xl font-bold text-brand-900">
                      Application Summary
                    </h3>
                    <p className="mt-2 text-brand-500 font-semibold text-sm">
                      This page stores your application in the portal so you can review and update
                      it.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <SummaryCard label="Applicant" value={form.fullName || "—"} />
                    <SummaryCard label="Email" value={form.email || user.email || "—"} />
                    <SummaryCard label="Interest Type" value={form.interestType || "—"} />
                    <SummaryCard label="Preferred Gender" value={form.preferredGender || "—"} />
                    <SummaryCard label="Deposit Ready" value={form.readyToPlaceDeposit || "—"} />
                    <SummaryCard label="Status" value={statusLabel} />
                    <SummaryCard
                      label="Assigned Puppy"
                      value={
                        applicationRow?.assigned_puppy_id
                          ? String(applicationRow.assigned_puppy_id)
                          : "Pending"
                      }
                    />
                    <SummaryCard
                      label="Created"
                      value={
                        applicationRow?.created_at
                          ? fmtDate(applicationRow.created_at)
                          : "Not yet submitted"
                      }
                    />
                  </div>

                  {applicationRow?.admin_notes ? (
                    <div className="rounded-2xl border border-brand-200 bg-white/60 p-4">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
                        Admin Notes
                      </div>
                      <div className="mt-2 text-sm font-semibold text-brand-800 whitespace-pre-wrap">
                        {applicationRow.admin_notes}
                      </div>
                    </div>
                  ) : null}

                  <Link
                    href="/portal/chichi"
                    className="block rounded-3xl bg-brand-800 text-white p-7 shadow-luxury hover:scale-[1.01] transition"
                  >
                    <h4 className="font-serif text-2xl font-bold mb-1">ChiChi AI</h4>
                    <p className="mt-2 text-brand-200 text-sm font-semibold mb-5">
                      Chat with ChiChi for help with your application, policies, transportation,
                      and portal questions.
                    </p>
                    <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-sm text-brand-100">
                      Open ChiChi AI →
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-brand-500 mb-2">
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm text-brand-900 outline-none"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-brand-500 mb-2">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm text-brand-900 outline-none"
      >
        {options.map((opt) => (
          <option key={opt || "blank"} value={opt}>
            {opt || "Select"}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-brand-500 mb-2">
        {label}
      </label>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm text-brand-900 outline-none resize-y"
      />
    </div>
  );
}

function CheckboxField({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-white/60 p-4 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4"
      />
      <span className="text-sm font-semibold text-brand-800 leading-relaxed">{label}</span>
    </label>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-white/65 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-black text-brand-900 break-words">{value}</div>
    </div>
  );
}

function ApplicationLogin() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const login = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await sb.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error) alert(error.message);
  };

  return (
    <div className="h-screen flex items-center justify-center bg-brand-50 p-6">
      <div className="card-luxury shine p-10 w-full max-w-md border border-white">
        <h2 className="font-serif text-4xl font-bold text-center mb-8">Welcome Home</h2>

        <form onSubmit={login} className="space-y-5">
          <div>
            <label className="text-[10px] font-black uppercase text-brand-500 mb-1 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-xl border border-brand-200"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-brand-500 mb-1 block">
              Password
            </label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="w-full p-3 rounded-xl border border-brand-200"
              required
            />
          </div>

          <button className="w-full bg-brand-800 text-white p-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lift">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

function formatDateTimeLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
}
