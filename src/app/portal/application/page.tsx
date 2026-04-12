"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  loadPortalContext,
  portalDisplayName,
  portalPuppyName,
  type PortalApplication,
  type PortalBuyer,
  type PortalPuppy,
} from "@/lib/portal-data";
import {
  APPLICATION_BOOLEAN_OPTIONS,
  APPLICATION_COAT_OPTIONS,
  APPLICATION_DISCOVERY_OPTIONS,
  APPLICATION_GENDER_OPTIONS,
  APPLICATION_HOME_TYPE_OPTIONS,
  APPLICATION_INTEREST_OPTIONS,
  APPLICATION_PAYMENT_PREFERENCE_OPTIONS,
  APPLICATION_PREFERRED_CONTACT_OPTIONS,
  APPLICATION_SCHEMA_VERSION,
  APPLICATION_WORK_STATUS_OPTIONS,
  FULL_PUPPY_APPLICATION_SELECT,
  buildApplicationDocumentMirrorData,
  buildApplicationFormState,
  buildPuppyApplicationRowPayload,
  emptyApplicationForm,
  type ApplicationForm,
  type PuppyApplicationRecord,
} from "@/lib/portal-application";
import { fmtDate, sb } from "@/lib/utils";
import { usePortalSession } from "@/hooks/use-portal-session";
import {
  PortalButton,
  PortalErrorState,
  PortalField,
  PortalHeroPrimaryAction,
  PortalInfoTile,
  PortalInput,
  PortalLoadingState,
  PortalMetricCard,
  PortalMetricGrid,
  PortalPageHero,
  PortalPanel,
  PortalSecondaryButton,
  PortalSelect,
  PortalTextarea,
} from "@/components/portal/luxury-shell";

const policyHighlights = [
  "Applications are reviewed before a puppy is approved or reserved.",
  "Once requested and paid, the reservation deposit is nonrefundable.",
  "Full payment and signed breeder paperwork are required before transfer.",
  "Ongoing veterinary care, safe housing, and responsible ownership are expected.",
  "If rehoming is ever needed, Southwest Virginia Chihuahua must be contacted first.",
];

const declarationItems: Array<{ key: keyof ApplicationForm; label: string }> = [
  {
    key: "ackAgeCapacity",
    label: "I am at least 18 years old and legally able to enter into an agreement.",
  },
  {
    key: "ackAccuracy",
    label: "The information I am providing is accurate and complete to the best of my knowledge.",
  },
  {
    key: "ackHomeEnvironment",
    label: "My home environment is suitable for a Chihuahua puppy.",
  },
  {
    key: "ackCareCommitment",
    label: "I understand the commitment involved in veterinary care, nutrition, routine care, and socialization.",
  },
  {
    key: "ackHealthGuarantee",
    label: "I understand that breeder policies and the health guarantee include follow-up care expectations.",
  },
  {
    key: "ackNonrefundableDeposit",
    label: "I understand the reservation deposit is nonrefundable once requested and paid.",
  },
  {
    key: "ackPurchasePriceTax",
    label: "I understand puppy pricing, tax, and any applicable travel or delivery charges are separate items.",
  },
  {
    key: "ackContractualObligation",
    label: "I understand breeder paperwork and full payment are required before the puppy goes home.",
  },
  {
    key: "ackReturnRehoming",
    label: "I will contact Southwest Virginia Chihuahua first if I ever need to rehome the puppy.",
  },
  {
    key: "ackReleaseLiability",
    label: "I understand breeder liability is limited to the written health and purchase terms.",
  },
  {
    key: "ackAgreementTerms",
    label: "I have reviewed and agree to the breeder policies and application terms.",
  },
  {
    key: "ackCommunications",
    label: "I consent to portal, email, text, or phone communication about my application and puppy journey.",
  },
];

async function findFullApplication(
  userId: string,
  email: string,
  preferredId?: number | null
) {
  if (preferredId) {
    const { data, error } = await sb
      .from("puppy_applications")
      .select(FULL_PUPPY_APPLICATION_SELECT)
      .eq("id", preferredId)
      .maybeSingle();

    if (!error && data) return data as PuppyApplicationRecord;
  }

  const byUserId = await sb
    .from("puppy_applications")
    .select(FULL_PUPPY_APPLICATION_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!byUserId.error && byUserId.data) {
    return byUserId.data as PuppyApplicationRecord;
  }

  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return null;

  const byEmail = await sb
    .from("puppy_applications")
    .select(FULL_PUPPY_APPLICATION_SELECT)
    .eq("email", normalizedEmail)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!byEmail.error && byEmail.data) {
    return byEmail.data as PuppyApplicationRecord;
  }

  const byApplicantEmail = await sb
    .from("puppy_applications")
    .select(FULL_PUPPY_APPLICATION_SELECT)
    .eq("applicant_email", normalizedEmail)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!byApplicantEmail.error && byApplicantEmail.data) {
    return byApplicantEmail.data as PuppyApplicationRecord;
  }

  return null;
}
async function syncApplicationDocumentCopy(
  form: ApplicationForm,
  nextStatus: string | null | undefined
) {
  const {
    data: { session },
  } = await sb.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Your session expired before the application copy could be synced.");
  }

  const response = await fetch("/api/portal/forms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      documentKey: "application",
      status: nextStatus || "submitted",
      version: APPLICATION_SCHEMA_VERSION,
      data: buildApplicationDocumentMirrorData(form),
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Could not sync the application copy.");
  }
}

export default function PortalApplicationPage() {
  const { user, loading: sessionLoading } = usePortalSession();
  const [buyer, setBuyer] = useState<PortalBuyer | null>(null);
  const [application, setApplication] = useState<PortalApplication | null>(null);
  const [puppy, setPuppy] = useState<PortalPuppy | null>(null);
  const [record, setRecord] = useState<PuppyApplicationRecord | null>(null);
  const [form, setForm] = useState<ApplicationForm>(emptyApplicationForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [statusText, setStatusText] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPage() {
      if (!user) {
        setLoading(false);
        setBuyer(null);
        setApplication(null);
        setPuppy(null);
        setRecord(null);
        setForm(emptyApplicationForm());
        return;
      }

      setLoading(true);
      setErrorText("");

      try {
        const context = await loadPortalContext(user);
        const fullRecord = await findFullApplication(
          user.id,
          user.email || "",
          context.application?.id
        );

        if (!active) return;
        setBuyer(context.buyer);
        setApplication(context.application);
        setPuppy(context.puppy);
        setRecord(fullRecord);
        setForm(
          buildApplicationFormState({
            userEmail: user.email || "",
            record: fullRecord,
            buyer: context.buyer,
            application: context.application,
          })
        );
      } catch (error) {
        console.error("Could not load application page:", error);
        if (!active) return;
        setErrorText(
          "We could not load your application right now. Please refresh or try again in a moment."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPage();

    return () => {
      active = false;
    };
  }, [user]);

  const declarationCount = useMemo(
    () =>
      declarationItems.reduce(
        (sum, item) => (form[item.key] ? sum + 1 : sum),
        0
      ),
    [form]
  );

  const displayName = portalDisplayName(user, buyer, application);
  const puppyName = portalPuppyName(puppy);
  const statusLabel = record?.status || application?.status || "Not submitted";
  const preferredPuppyLabel = puppy
    ? puppyName
    : record?.assigned_puppy_id
      ? `Puppy #${record.assigned_puppy_id}`
      : "Waiting for Match";

  function updateField<K extends keyof ApplicationForm>(key: K, value: ApplicationForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validateForm() {
    if (!form.fullName.trim()) return "Please enter your full name.";
    if (!form.email.trim()) return "Please enter your email address.";
    if (!form.state.trim()) return "Please enter your state.";
    if (!form.agreeTerms) return "Please agree to the breeder policies and application terms.";
    if (!form.signature.trim()) return "Please add your signature.";
    if (declarationCount !== declarationItems.length) {
      return "Please review and acknowledge each applicant declaration.";
    }
    return "";
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;

    const validationMessage = validateForm();
    if (validationMessage) {
      setErrorText(validationMessage);
      setStatusText("");
      return;
    }

    setSaving(true);
    setErrorText("");
    setStatusText("");

    const payload = buildPuppyApplicationRowPayload({
      form,
      userId: user.id,
      status: record?.status || "submitted",
    }).row;

    try {
      const query = record?.id
        ? sb.from("puppy_applications").update(payload).eq("id", record.id)
        : sb.from("puppy_applications").insert(payload);

      const { data, error } = await query.select(FULL_PUPPY_APPLICATION_SELECT).single();
      if (error) throw error;

      const nextRecord = data as PuppyApplicationRecord;
      setRecord(nextRecord);
      setApplication((current) =>
        current
          ? {
              ...current,
              id: nextRecord.id,
              full_name: nextRecord.full_name || current.full_name,
              email: nextRecord.email || current.email,
              applicant_email: nextRecord.applicant_email || current.applicant_email,
              phone: nextRecord.phone || current.phone,
              street_address: nextRecord.street_address || current.street_address,
              city_state: nextRecord.city_state || current.city_state,
              zip: nextRecord.zip || current.zip,
              status: nextRecord.status || current.status,
              assigned_puppy_id:
                nextRecord.assigned_puppy_id ?? current.assigned_puppy_id ?? null,
            }
          : {
              id: nextRecord.id,
              user_id: nextRecord.user_id || user.id,
              full_name: nextRecord.full_name || null,
              email: nextRecord.email || null,
              applicant_email: nextRecord.applicant_email || null,
              phone: nextRecord.phone || null,
              street_address: nextRecord.street_address || null,
              city_state: nextRecord.city_state || null,
              zip: nextRecord.zip || null,
              status: nextRecord.status || "submitted",
              created_at: nextRecord.created_at || null,
              assigned_puppy_id: nextRecord.assigned_puppy_id || null,
            }
      );
      let syncWarning = "";
      try {
        await syncApplicationDocumentCopy(
          form,
          nextRecord.status || record?.status || "submitted"
        );
      } catch (syncError) {
        console.error("Could not sync application document copy:", syncError);
        syncWarning = " The portal document copy will finish syncing after the next successful save.";
      }

      setStatusText(
        `${record?.id ? "Application updated." : "Application submitted."}${syncWarning}`
      );
    } catch (error) {
      console.error("Could not save application:", error);
      setErrorText(error instanceof Error ? error.message : "Unable to save your application.");
    } finally {
      setSaving(false);
    }
  }

  if (sessionLoading || loading) {
    return <PortalLoadingState label="Loading application..." />;
  }

  if (!user) {
    return (
      <PortalPageHero
        eyebrow="Application"
        title="Sign in to manage your application."
        description="Your buyer details, preferences, declarations, and application record stay here once you are signed in."
        actions={<PortalHeroPrimaryAction href="/portal">Open Portal Access</PortalHeroPrimaryAction>}
      />
    );
  }

  if (errorText && !buyer && !application && !record) {
    return <PortalErrorState title="Application is unavailable" description={errorText} />;
  }

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Application"
        title="Manage your buyer application from one record."
        description="Review contact details, puppy preferences, household information, declarations, and signature in one place."
        aside={
          <div className="rounded-[30px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,var(--portal-surface-strong)_0%,var(--portal-surface-muted)_100%)] p-5 shadow-[0_18px_42px_rgba(31,48,79,0.08)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--portal-text-muted)]">
              Application record
            </div>
            <div className="mt-3 text-lg font-semibold text-[var(--portal-text)]">
              Keep the full buyer file current.
            </div>
            <div className="mt-3 space-y-3 text-sm leading-6 text-[var(--portal-text-soft)]">
              <p>Use this record for the buyer information the breeder should rely on during review and matching.</p>
              <p>Preference, declaration, and signature details stay attached to the same application instead of being split across emails or notes.</p>
              <p>Once approved, breeder notes and matching details remain visible here as part of your portal history.</p>
            </div>
          </div>
        }
      />

      {statusText ? (
        <div className="rounded-[20px] border border-[rgba(89,139,109,0.22)] bg-[rgba(237,248,241,0.92)] px-4 py-3 text-sm font-semibold text-[#355543]">
          {statusText}
        </div>
      ) : null}

      {errorText ? (
        <div className="rounded-[20px] border border-[rgba(190,122,116,0.22)] bg-[rgba(255,246,244,0.92)] px-4 py-3 text-sm font-semibold text-[#7b4a46]">
          {errorText}
        </div>
      ) : null}

      <PortalMetricGrid>
        <PortalMetricCard
          label="Application Status"
          value={statusLabel}
          detail={record?.created_at ? `First saved ${fmtDate(record.created_at)}` : "Your application record will appear here after the first save."}
        />
        <PortalMetricCard
          label="Portal Family"
          value={displayName}
          detail={form.email || user.email || "The email tied to your portal application."}
          accent="from-[#edf2ff] via-[#dbe5ff] to-[#9ab2eb]"
        />
        <PortalMetricCard
          label="My Puppy"
          value={preferredPuppyLabel}
          detail={puppy ? "Your matched puppy profile is already linked to the portal." : "Your matched puppy will appear here once assigned."}
          accent="from-[#e8f5fb] via-[#d2e8f5] to-[#95b8d9]"
        />
        <PortalMetricCard
          label="Declarations"
          value={`${declarationCount}/${declarationItems.length}`}
          detail="Required acknowledgements completed in this application."
          accent="from-[#eef2f8] via-[#dbe3ef] to-[#a6bad0]"
        />
      </PortalMetricGrid>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
        <div className="space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            <PortalPanel
              title="Contact Details"
              subtitle="Use the contact details the breeder should rely on for review, approval, and follow-up."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <PortalField label="Full Name">
                  <PortalInput
                    value={form.fullName}
                    onChange={(event) => updateField("fullName", event.target.value)}
                  />
                </PortalField>

                <PortalField label="Email Address">
                  <PortalInput
                    type="email"
                    value={form.email}
                    onChange={(event) => updateField("email", event.target.value)}
                  />
                </PortalField>

                <PortalField label="Phone Number">
                  <PortalInput
                    value={form.phone}
                    onChange={(event) => updateField("phone", event.target.value)}
                  />
                </PortalField>

                <PortalField label="Preferred Contact">
                  <PortalSelect
                    value={form.preferredContactMethod}
                    onChange={(event) =>
                      updateField("preferredContactMethod", event.target.value)
                    }
                  >
                    <option value="">Select</option>
                    {APPLICATION_PREFERRED_CONTACT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </PortalSelect>
                </PortalField>

                <PortalField label="Street Address">
                  <PortalInput
                    value={form.streetAddress}
                    onChange={(event) => updateField("streetAddress", event.target.value)}
                  />
                </PortalField>

                <PortalField label="City">
                  <PortalInput
                    value={form.city}
                    onChange={(event) => updateField("city", event.target.value)}
                  />
                </PortalField>

                <PortalField label="State">
                  <PortalInput
                    value={form.state}
                    onChange={(event) => updateField("state", event.target.value)}
                  />
                </PortalField>

                <PortalField label="Zip Code">
                  <PortalInput
                    value={form.zip}
                    onChange={(event) => updateField("zip", event.target.value)}
                  />
                </PortalField>
              </div>
            </PortalPanel>

            <PortalPanel
              title="Puppy Preferences"
              subtitle="Record the timing and puppy preferences tied to this application."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <PortalField label="Interest Type">
                  <PortalSelect
                    value={form.interestType}
                    onChange={(event) => updateField("interestType", event.target.value)}
                  >
                    <option value="">Select</option>
                    {APPLICATION_INTEREST_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </PortalSelect>
                </PortalField>

                <PortalField label="Desired Adoption Date">
                  <PortalInput
                    type="date"
                    value={form.desiredAdoptionDate}
                    onChange={(event) =>
                      updateField("desiredAdoptionDate", event.target.value)
                    }
                  />
                </PortalField>

                <PortalField label="Preferred Coat Type">
                  <PortalSelect
                    value={form.preferredCoatType}
                    onChange={(event) => updateField("preferredCoatType", event.target.value)}
                  >
                    <option value="">Select</option>
                    {APPLICATION_COAT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </PortalSelect>
                </PortalField>

                <PortalField label="Preferred Gender">
                  <PortalSelect
                    value={form.preferredGender}
                    onChange={(event) => updateField("preferredGender", event.target.value)}
                  >
                    <option value="">Select</option>
                    {APPLICATION_GENDER_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </PortalSelect>
                </PortalField>

                <PortalField label="Color Preference">
                  <PortalInput
                    value={form.colorPreference}
                    onChange={(event) => updateField("colorPreference", event.target.value)}
                    placeholder="Optional"
                  />
                </PortalField>
              </div>
            </PortalPanel>

            <PortalPanel
              title="Home & Lifestyle"
              subtitle="Share the household setup, schedule, and care environment tied to this application."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <PortalField label="Other Pets">
                  <PortalSelect
                    value={form.otherPets}
                    onChange={(event) => updateField("otherPets", event.target.value)}
                  >
                    <option value="">Select</option>
                    {APPLICATION_BOOLEAN_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </PortalSelect>
                </PortalField>

                <PortalField label="Pet Details">
                  <PortalInput
                    value={form.petDetails}
                    onChange={(event) => updateField("petDetails", event.target.value)}
                    placeholder="Species, breed, temperament, or count"
                  />
                </PortalField>

                <PortalField label="Owned a Chihuahua Before">
                  <PortalSelect
                    value={form.ownedChihuahuaBefore}
                    onChange={(event) =>
                      updateField("ownedChihuahuaBefore", event.target.value)
                    }
                  >
                    <option value="">Select</option>
                    {APPLICATION_BOOLEAN_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </PortalSelect>
                </PortalField>

                <PortalField label="Home Type">
                  <PortalSelect
                    value={form.homeType}
                    onChange={(event) => updateField("homeType", event.target.value)}
                  >
                    <option value="">Select</option>
                    {APPLICATION_HOME_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </PortalSelect>
                </PortalField>

                <PortalField label="Fenced Yard">
                  <PortalSelect
                    value={form.fencedYard}
                    onChange={(event) => updateField("fencedYard", event.target.value)}
                  >
                    <option value="">Select</option>
                    {APPLICATION_BOOLEAN_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </PortalSelect>
                </PortalField>

                <PortalField label="Work Status">
                  <PortalSelect
                    value={form.workStatus}
                    onChange={(event) => updateField("workStatus", event.target.value)}
                  >
                    <option value="">Select</option>
                    {APPLICATION_WORK_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </PortalSelect>
                </PortalField>

                <PortalField label="Who Cares for the Puppy">
                  <PortalInput
                    value={form.whoCaresForPuppy}
                    onChange={(event) =>
                      updateField("whoCaresForPuppy", event.target.value)
                    }
                  />
                </PortalField>

                <PortalField label="Children at Home">
                  <PortalInput
                    value={form.childrenAtHome}
                    onChange={(event) =>
                      updateField("childrenAtHome", event.target.value)
                    }
                    placeholder="Optional"
                  />
                </PortalField>
              </div>
            </PortalPanel>

            <PortalPanel
              title="Readiness & Questions"
              subtitle="Add payment preference, referral context, and any early questions that belong on the buyer record."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <PortalField label="Payment Preference">
                  <PortalSelect
                    value={form.paymentPreference}
                    onChange={(event) =>
                      updateField("paymentPreference", event.target.value)
                    }
                  >
                    <option value="">Select</option>
                    {APPLICATION_PAYMENT_PREFERENCE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </PortalSelect>
                </PortalField>

                <PortalField label="How Did You Hear About Us">
                  <PortalSelect
                    value={form.howDidYouHear}
                    onChange={(event) => updateField("howDidYouHear", event.target.value)}
                  >
                    <option value="">Select</option>
                    {APPLICATION_DISCOVERY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </PortalSelect>
                </PortalField>

                <PortalField label="Ready to Place Deposit">
                  <PortalSelect
                    value={form.readyToPlaceDeposit}
                    onChange={(event) =>
                      updateField("readyToPlaceDeposit", event.target.value)
                    }
                  >
                    <option value="">Select</option>
                    {APPLICATION_BOOLEAN_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </PortalSelect>
                </PortalField>

                <div className="md:col-span-2">
                  <PortalField label="Questions or Notes">
                    <PortalTextarea
                      rows={5}
                      value={form.questions}
                      onChange={(event) => updateField("questions", event.target.value)}
                      placeholder="Add anything the breeder should know about your timing, household, or questions."
                    />
                  </PortalField>
                </div>
              </div>
            </PortalPanel>

            <PortalPanel
              title="Policies & Applicant Declarations"
              subtitle="Review the policy points and applicant confirmations attached to this application."
            >
              <div className="space-y-5">
                <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-5">
                  <div className="text-sm font-semibold text-[var(--portal-text)]">
                    Key policy points
                  </div>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                    {policyHighlights.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[var(--portal-accent-strong)]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 text-sm leading-6 text-[var(--portal-text-soft)]">
                    Need the full written policies? Visit{" "}
                    <a
                      href="/policies.html"
                      className="font-semibold text-[var(--portal-accent-strong)] underline decoration-[var(--portal-border-strong)] underline-offset-4"
                    >
                      Southwest Virginia Chihuahua policies
                    </a>
                    .
                  </div>
                  <label className="mt-4 flex items-start gap-3 rounded-[20px] border border-[var(--portal-border)] bg-white px-4 py-4 text-sm leading-6 text-[var(--portal-text-soft)]">
                    <input
                      type="checkbox"
                      checked={form.agreeTerms}
                      onChange={(event) => updateField("agreeTerms", event.target.checked)}
                      className="mt-1 h-4 w-4"
                    />
                    <span>I agree to the breeder policies and application terms.</span>
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {declarationItems.map((item) => (
                    <DeclarationCard
                      key={item.key}
                      checked={Boolean(form[item.key])}
                      label={item.label}
                      onChange={(checked) => updateField(item.key, checked as never)}
                    />
                  ))}
                </div>
              </div>
            </PortalPanel>

            <PortalPanel
              title="Signature"
              subtitle="Finish the record with the signature and timestamp that should stay on file."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <PortalField label="Signed At">
                  <PortalInput
                    type="datetime-local"
                    value={form.signedAt}
                    onChange={(event) => updateField("signedAt", event.target.value)}
                  />
                </PortalField>

                <PortalField label="Signature">
                  <PortalInput
                    value={form.signature}
                    onChange={(event) => updateField("signature", event.target.value)}
                    placeholder="Type your full legal name"
                  />
                </PortalField>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <PortalSecondaryButton
                  onClick={() => updateField("signature", form.fullName.trim())}
                >
                  Use Full Name
                </PortalSecondaryButton>
                <PortalSecondaryButton onClick={() => updateField("signature", "")}>
                  Clear Signature
                </PortalSecondaryButton>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm leading-6 text-[var(--portal-text-soft)]">
                  Saving here keeps your portal application current for breeder review.
                </div>
                <PortalButton type="submit" disabled={saving}>
                  {saving
                    ? "Saving..."
                    : record?.id
                      ? "Update Application"
                      : "Submit Application"}
                </PortalButton>
              </div>
            </PortalPanel>
          </form>
        </div>

        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <PortalPanel
            title="At a Glance"
            subtitle="The core application details most likely to be checked during review."
          >
            <div className="space-y-4">
              <PortalInfoTile
                label="Preferred Contact"
                value={form.preferredContactMethod || "Not set"}
                detail={form.phone || form.email || "No contact detail added yet."}
              />
              <PortalInfoTile
                label="Interest Type"
                value={form.interestType || "Not set"}
                detail={form.preferredGender || form.preferredCoatType || "Preference details can be added any time."}
              />
              <PortalInfoTile
                label="Deposit Readiness"
                value={form.readyToPlaceDeposit || "Not answered"}
                detail={form.paymentPreference || "Payment preference can be clarified here before approval."}
              />
              <PortalInfoTile
                label="My Puppy"
                value={preferredPuppyLabel}
                detail={puppy ? "This portal is already linked to your matched puppy." : "The breeder will link your puppy when matching is complete."}
                tone={puppy ? "success" : "warning"}
              />
            </div>
          </PortalPanel>

          {record?.admin_notes ? (
            <PortalPanel
              title="Breeder Notes"
              subtitle="Notes added to your application remain visible here for reference."
            >
              <div className="rounded-[24px] border border-[var(--portal-border)] bg-white px-4 py-4 text-sm leading-7 text-[var(--portal-text-soft)] shadow-[0_10px_24px_rgba(31,48,79,0.05)]">
                {record.admin_notes}
              </div>
            </PortalPanel>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function DeclarationCard({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-[24px] border border-[var(--portal-border)] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(31,48,79,0.05)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4"
      />
      <span className="text-sm leading-6 text-[var(--portal-text-soft)]">{label}</span>
    </label>
  );
}
