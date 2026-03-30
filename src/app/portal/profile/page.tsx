"use client";

import React, { useEffect, useState } from "react";
import {
  loadPortalContext,
  parseCityState,
  type PortalApplication,
  type PortalBuyer,
} from "@/lib/portal-data";
import { sb } from "@/lib/utils";
import { usePortalSession } from "@/hooks/use-portal-session";
import {
  PortalButton,
  PortalErrorState,
  PortalField,
  PortalHeroPrimaryAction,
  PortalHeroSecondaryAction,
  PortalInfoTile,
  PortalInput,
  PortalLoadingState,
  PortalPageHero,
  PortalPanel,
} from "@/components/portal/luxury-shell";

type ProfileForm = {
  fullName: string;
  email: string;
  phone: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
};

function emptyForm(): ProfileForm {
  return {
    fullName: "",
    email: "",
    phone: "",
    streetAddress: "",
    city: "",
    state: "",
    zip: "",
  };
}

export default function PortalProfilePage() {
  const { user, loading: sessionLoading } = usePortalSession();
  const [buyer, setBuyer] = useState<PortalBuyer | null>(null);
  const [application, setApplication] = useState<PortalApplication | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
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
        setForm(emptyForm());
        return;
      }

      setLoading(true);
      setErrorText("");

      try {
        const context = await loadPortalContext(user);
        if (!active) return;

        const cityState = parseCityState(context.application?.city_state);
        setBuyer(context.buyer);
        setApplication(context.application);
        setForm({
          fullName:
            context.buyer?.full_name ||
            context.buyer?.name ||
            context.application?.full_name ||
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            "",
          email:
            context.buyer?.email ||
            context.application?.email ||
            context.application?.applicant_email ||
            user.email ||
            "",
          phone: context.buyer?.phone || context.application?.phone || "",
          streetAddress: context.application?.street_address || "",
          city: cityState.city,
          state: cityState.state,
          zip: context.application?.zip || "",
        });
      } catch (error) {
        console.error("Could not load profile page:", error);
        if (!active) return;
        setErrorText(
          "We could not load your profile right now. Please refresh or try again in a moment."
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

  function updateField<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;

    setSaving(true);
    setErrorText("");
    setStatusText("");

    const nextEmail = form.email.trim();
    const nextFullName = form.fullName.trim();
    const nextPhone = form.phone.trim();
    const nextStreet = form.streetAddress.trim();
    const nextCity = form.city.trim();
    const nextState = form.state.trim();
    const nextZip = form.zip.trim();
    const cityState = `${nextCity}${nextCity && nextState ? ", " : ""}${nextState}`;

    try {
      if (nextFullName || nextEmail !== (user.email || "")) {
        const { error } = await sb.auth.updateUser({
          email: nextEmail || undefined,
          data: {
            full_name: nextFullName || undefined,
            name: nextFullName || undefined,
          },
        });

        if (error) throw error;
      }

      if (buyer?.id) {
        const { error } = await sb
          .from("buyers")
          .update({
            full_name: nextFullName || null,
            name: nextFullName || null,
            email: nextEmail || null,
            phone: nextPhone || null,
          })
          .eq("id", buyer.id);

        if (error) throw error;
      }

      if (application?.id) {
        const { error } = await sb
          .from("puppy_applications")
          .update({
            full_name: nextFullName || null,
            email: nextEmail || null,
            applicant_email: nextEmail || null,
            phone: nextPhone || null,
            street_address: nextStreet || null,
            city_state: cityState || null,
            zip: nextZip || null,
          })
          .eq("id", application.id);

        if (error) throw error;
      }

      setStatusText(
        nextEmail && nextEmail !== (user.email || "")
          ? "Profile updated. If Supabase requires email confirmation, check your inbox to confirm the new email address."
          : "Profile updated."
      );
    } catch (error) {
      console.error("Could not save profile:", error);
      setErrorText(error instanceof Error ? error.message : "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (sessionLoading || loading) {
    return <PortalLoadingState label="Loading profile..." />;
  }

  if (!user) {
    return (
      <PortalPageHero
        eyebrow="Profile"
        title="Sign in to manage your account."
        description="Your account details, contact information, and linked application information stay here once you are signed in."
        actions={<PortalHeroPrimaryAction href="/portal">Open Portal Access</PortalHeroPrimaryAction>}
      />
    );
  }

  if (errorText && !buyer && !application) {
    return <PortalErrorState title="Profile is unavailable" description={errorText} />;
  }

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Profile"
        title="Keep your account details current."
        description="Contact information, buyer details, and application fields stay aligned here so messages, reminders, and documents reach the right place."
        actions={
          <>
            <PortalHeroPrimaryAction href="/portal/messages">Open Messages</PortalHeroPrimaryAction>
            <PortalHeroSecondaryAction href="/portal/documents">Open Documents</PortalHeroSecondaryAction>
          </>
        }
        aside={
          <div className="space-y-4">
            <PortalInfoTile
              label="Portal Email"
              value={form.email || user.email || "No email on file"}
              detail="This is the address used for your portal account."
            />
            <PortalInfoTile
              label="Linked Records"
              value={String(Number(Boolean(buyer)) + Number(Boolean(application)))}
              detail="Buyer and application records linked to this portal login."
            />
          </div>
        }
      />

      {statusText ? (
        <div className="rounded-[20px] border border-[rgba(89,139,109,0.22)] bg-[rgba(237,248,241,0.92)] px-4 py-3 text-sm font-semibold text-[#355543]">
          {statusText}
        </div>
      ) : null}

      {errorText && buyer && application ? (
        <div className="rounded-[20px] border border-[rgba(190,122,116,0.22)] bg-[rgba(255,246,244,0.92)] px-4 py-3 text-sm font-semibold text-[#7b4a46]">
          {errorText}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.15fr_380px]">
        <PortalPanel
          title="Profile Details"
          subtitle="Update the account details that matter most for communication, records, and delivery of important breeder information."
        >
          <form onSubmit={handleSave} className="space-y-5">
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

            <PortalButton type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Profile"}
            </PortalButton>
          </form>
        </PortalPanel>

        <div className="space-y-6">
          <PortalPanel
            title="What updates here"
            subtitle="The portal should make it obvious what this form affects."
          >
            <div className="space-y-4">
              <PortalInfoTile
                label="Portal Account"
                value="Name and email"
                detail="Your sign-in profile is updated here."
              />
              <PortalInfoTile
                label="Buyer Record"
                value={buyer ? "Linked" : "Not linked"}
                detail="Buyer contact details are updated when a buyer record exists."
              />
              <PortalInfoTile
                label="Application Record"
                value={application ? "Linked" : "Not linked"}
                detail="Application contact fields are updated when an application record exists."
              />
            </div>
          </PortalPanel>

          <PortalPanel
            title="Need help?"
            subtitle="If you are unsure which information should be updated here, start with a message and we can guide you."
          >
            <div className="space-y-3">
              <PortalInfoTile
                label="Fastest path"
                value="Ask ChiChi or message support"
                detail="Use the portal if you want help locating messages, documents, payments, or puppy details."
              />
            </div>
          </PortalPanel>
        </div>
      </section>
    </div>
  );
}
