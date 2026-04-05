"use client";

import Image from "next/image";
import React, { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  ImagePlus,
  Loader2,
  Mail,
  RefreshCcw,
  Save,
  Smartphone,
  UserRound,
} from "lucide-react";
import { sb } from "@/lib/utils";
import {
  loadPortalContext,
  parseCityState,
  portalPuppyName,
  portalStatusTone,
  type PortalApplication,
  type PortalBuyer,
  type PortalPuppy,
} from "@/lib/portal-data";
import { usePortalSession } from "@/hooks/use-portal-session";
import {
  PortalButton,
  PortalEmptyState,
  PortalField,
  PortalInfoTile,
  PortalInput,
  PortalLoadingState,
  PortalPageHero,
  PortalPanel,
  PortalSecondaryButton,
} from "@/components/portal/luxury-shell";

type ProfilePageState = {
  buyer: PortalBuyer | null;
  application: PortalApplication | null;
  puppy: PortalPuppy | null;
};

type ProfileFormState = {
  full_name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
};

type PortalPreferences = {
  email_updates: boolean;
  sms_updates: boolean;
  portal_reminders: boolean;
  litter_announcements: boolean;
};

type ProfileSaveResponse = {
  ok?: boolean;
  message?: string;
  buyer?: PortalBuyer;
  photo_url?: string | null;
  email?: string | null;
  preferences?: PortalPreferences;
};

function emptyState(): ProfilePageState {
  return {
    buyer: null,
    application: null,
    puppy: null,
  };
}

function emptyForm(): ProfileFormState {
  return {
    full_name: "",
    email: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
  };
}

function defaultPreferences(): PortalPreferences {
  return {
    email_updates: true,
    sms_updates: false,
    portal_reminders: true,
    litter_announcements: true,
  };
}

function safeText(value: string | null | undefined, fallback = "Not listed") {
  const text = String(value || "").trim();
  return text || fallback;
}

function profileInitial(
  user: { email?: string | null; user_metadata?: Record<string, unknown> | null } | null,
  state: ProfilePageState
) {
  const buyer = state.buyer;
  const application = state.application;
  const parsedCityState = parseCityState(application?.city_state);

  return {
    full_name: String(
      buyer?.full_name ||
        buyer?.name ||
        application?.full_name ||
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        ""
    ),
    email: String(buyer?.email || application?.email || application?.applicant_email || user?.email || ""),
    phone: String(buyer?.phone || application?.phone || ""),
    address_line1: String(buyer?.address_line1 || application?.street_address || ""),
    address_line2: String(buyer?.address_line2 || ""),
    city: String(buyer?.city || parsedCityState.city || ""),
    state: String(buyer?.state || parsedCityState.state || ""),
    postal_code: String(buyer?.postal_code || application?.zip || ""),
  };
}

function readPreferences(
  user: { user_metadata?: Record<string, unknown> | null } | null
): PortalPreferences {
  const raw =
    user?.user_metadata &&
    typeof user.user_metadata === "object" &&
    !Array.isArray(user.user_metadata)
      ? (user.user_metadata.portal_preferences as Record<string, unknown> | undefined)
      : undefined;

  return {
    email_updates:
      typeof raw?.email_updates === "boolean" ? raw.email_updates : defaultPreferences().email_updates,
    sms_updates:
      typeof raw?.sms_updates === "boolean" ? raw.sms_updates : defaultPreferences().sms_updates,
    portal_reminders:
      typeof raw?.portal_reminders === "boolean"
        ? raw.portal_reminders
        : defaultPreferences().portal_reminders,
    litter_announcements:
      typeof raw?.litter_announcements === "boolean"
        ? raw.litter_announcements
        : defaultPreferences().litter_announcements,
  };
}

function PreferenceToggleCard({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="block cursor-pointer rounded-[1.25rem] border border-[var(--portal-border)] bg-white p-4 shadow-sm transition hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)]">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--portal-surface-muted)] text-[var(--portal-accent)]">
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--portal-text)]">{title}</div>
              <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">
                {description}
              </div>
            </div>
            <span
              className={[
                "inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]",
                checked
                  ? "border-violet-200 bg-violet-50 text-violet-700"
                  : "border-[var(--portal-border)] bg-white text-[var(--portal-text-muted)]",
              ].join(" ")}
            >
              {checked ? "On" : "Off"}
            </span>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div
              className={[
                "relative h-7 w-12 rounded-full border transition",
                checked
                  ? "border-transparent bg-[linear-gradient(90deg,#7c5cff_0%,#f043a2_100%)]"
                  : "border-[var(--portal-border)] bg-[var(--portal-surface-muted)]",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-0.5 h-5.5 w-5.5 rounded-full bg-white shadow-sm transition",
                  checked ? "left-[26px]" : "left-0.5",
                ].join(" ")}
              />
            </div>
            <input
              type="checkbox"
              className="sr-only"
              checked={checked}
              onChange={(event) => onChange(event.target.checked)}
            />
            <span className="text-xs font-semibold text-[var(--portal-text-muted)]">
              {checked ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>
      </div>
    </label>
  );
}

export default function PortalProfilePage() {
  const { user, loading: sessionLoading } = usePortalSession();
  const [data, setData] = useState<ProfilePageState>(emptyState);
  const [form, setForm] = useState<ProfileFormState>(emptyForm);
  const [preferences, setPreferences] = useState<PortalPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [statusText, setStatusText] = useState("");
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [picturePreviewUrl, setPicturePreviewUrl] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPage() {
      if (!user) {
        setData(emptyState());
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorText("");

      try {
        const context = await loadPortalContext(user);
        if (!active) return;
        setData(context);
      } catch (error) {
        console.error("Could not load account info:", error);
        if (!active) return;
        setData(emptyState());
        setErrorText(
          "We could not load every saved account detail right now. You can still update your profile information below."
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

  useEffect(() => {
    const objectUrl = pictureFile ? URL.createObjectURL(pictureFile) : "";
    if (objectUrl) setPicturePreviewUrl(objectUrl);

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pictureFile]);

  useEffect(() => {
    if (!user) return;
    setForm(profileInitial(user, data));
    setPreferences(readPreferences(user));

    if (!pictureFile) {
      setPicturePreviewUrl(
        String(data.buyer?.portal_profile_photo_url || user.user_metadata?.avatar_url || "")
      );
    }
  }, [data, pictureFile, user]);

  const linkedPuppy = data.puppy ? portalPuppyName(data.puppy) : "Not assigned yet";
  const applicationStatus = safeText(data.application?.status, "Not started");
  const deliveryOption = safeText(data.buyer?.delivery_option, "Not selected");
  const financeStatus = data.buyer?.finance_enabled ? "Financing enabled" : "Standard payment plan";

  const communicationSummary = useMemo(() => {
    const enabled = Object.values(preferences).filter(Boolean).length;
    return `${enabled} preference${enabled === 1 ? "" : "s"} enabled`;
  }, [preferences]);

  function resetToSavedState() {
    if (!user) return;
    setForm(profileInitial(user, data));
    setPreferences(readPreferences(user));
    setPictureFile(null);
    setPicturePreviewUrl(
      String(data.buyer?.portal_profile_photo_url || user.user_metadata?.avatar_url || "")
    );
    setStatusText("");
    setErrorText("");
  }

  async function refreshContext() {
    if (!user) return;

    setErrorText("");

    try {
      const context = await loadPortalContext(user);
      setData(context);
    } catch (error) {
      console.error("Could not refresh account info:", error);
      setErrorText(
        "We could not refresh your latest account details right now. Your saved changes may still have completed."
      );
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;

    const {
      data: { session },
    } = await sb.auth.getSession();

    if (!session?.access_token) {
      setErrorText("Please sign in again before saving your account information.");
      return;
    }

    setSaving(true);
    setStatusText("");
    setErrorText("");

    try {
      const formData = new FormData();
      formData.append("full_name", form.full_name.trim());
      formData.append("email", form.email.trim());
      formData.append("phone", form.phone.trim());
      formData.append("address_line1", form.address_line1.trim());
      formData.append("address_line2", form.address_line2.trim());
      formData.append("city", form.city.trim());
      formData.append("state", form.state.trim());
      formData.append("postal_code", form.postal_code.trim());
      formData.append("pref_email_updates", String(preferences.email_updates));
      formData.append("pref_sms_updates", String(preferences.sms_updates));
      formData.append("pref_portal_reminders", String(preferences.portal_reminders));
      formData.append("pref_litter_announcements", String(preferences.litter_announcements));

      if (pictureFile) {
        formData.append("profile_picture", pictureFile);
      }

      const response = await fetch("/api/portal/profile", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const payload = (await response.json()) as ProfileSaveResponse;

      if (!response.ok) {
        throw new Error(payload.message || "Could not save your account information.");
      }

      const savedBuyer = payload.buyer ?? null;

      if (savedBuyer) {
        setData((prev) => ({
          ...prev,
          buyer: savedBuyer,
        }));
      }

      if (payload.preferences) {
        setPreferences(payload.preferences);
      }

      if (payload.photo_url) {
        setPicturePreviewUrl(payload.photo_url);
      }

      setPictureFile(null);
      setStatusText(payload.message || "Your account information was saved.");
      await refreshContext();
    } catch (error) {
      console.error("Could not save account info:", error);
      setErrorText(
        error instanceof Error
          ? error.message
          : "We could not save your account information right now."
      );
    } finally {
      setSaving(false);
    }
  }

  if (sessionLoading || loading) {
    return <PortalLoadingState label="Loading account info..." />;
  }

  if (!user) {
    return (
      <PortalPageHero
        eyebrow="Account Info"
        title="Sign in to manage your portal account."
        description="Update your contact details, profile photo, and communication preferences once you are signed into My Puppy Portal."
      />
    );
  }

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Account Info"
        title="Keep your contact details and account preferences current."
        description="Update the information Southwest Virginia Chihuahua uses for documents, payments, messages, puppy updates, and next-step reminders."
        aside={
          <div className="grid gap-4">
            <PortalInfoTile
              label="Linked Puppy"
              value={linkedPuppy}
              detail="The puppy currently connected to this portal account."
            />
            <PortalInfoTile
              label="Application Status"
              value={applicationStatus}
              detail="The latest application status saved to your account."
              tone={portalStatusTone(data.application?.status)}
            />
          </div>
        }
      />

      {errorText ? (
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {errorText}
        </div>
      ) : null}

      {statusText ? (
        <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {statusText}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <PortalPanel
          title="Profile Details"
          subtitle="Update the name, email, phone number, mailing address, and profile photo tied to your puppy portal account."
          action={
            <PortalSecondaryButton onClick={resetToSavedState}>
              <RefreshCcw className="h-4 w-4" />
              Reset
            </PortalSecondaryButton>
          }
        >
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
              <div className="rounded-[1.5rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-5">
                <div className="relative mx-auto flex h-36 w-36 items-center justify-center overflow-hidden rounded-full border border-[var(--portal-border)] bg-white text-3xl font-bold text-[var(--portal-text)] shadow-sm">
                  {picturePreviewUrl ? (
                    <Image
                      src={picturePreviewUrl}
                      alt={`${safeText(form.full_name || user.email, "Portal profile")} profile photo`}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <UserRound className="h-12 w-12 text-[var(--portal-text-muted)]" />
                  )}
                </div>

                <div className="mt-5 text-center">
                  <div className="text-base font-semibold text-[var(--portal-text)]">
                    {safeText(form.full_name, "Portal profile")}
                  </div>
                  <div className="mt-1 text-sm text-[var(--portal-text-soft)]">
                    {safeText(form.email, "No email on file")}
                  </div>
                </div>

                <label className="mt-5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-sm transition hover:bg-[var(--portal-surface-muted)]">
                  <ImagePlus className="h-4 w-4" />
                  Upload profile picture
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const nextFile = event.target.files?.[0] || null;
                      setPictureFile(nextFile);
                      setStatusText("");
                      setErrorText("");
                    }}
                  />
                </label>

                <p className="mt-3 text-xs leading-6 text-[var(--portal-text-muted)]">
                  Use a clear photo or icon for your portal account. Images up to 5MB are accepted.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <PortalField label="Full Name">
                    <PortalInput
                      value={form.full_name}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, full_name: event.target.value }))
                      }
                      placeholder="Your full name"
                    />
                  </PortalField>

                  <PortalField label="Email Address">
                    <PortalInput
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, email: event.target.value }))
                      }
                      placeholder="name@example.com"
                    />
                  </PortalField>
                </div>

                <PortalField label="Phone Number">
                  <PortalInput
                    value={form.phone}
                    onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                    placeholder="Best contact number"
                  />
                </PortalField>

                <PortalField label="Address Line 1">
                  <PortalInput
                    value={form.address_line1}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, address_line1: event.target.value }))
                    }
                    placeholder="Street address"
                  />
                </PortalField>

                <PortalField label="Address Line 2">
                  <PortalInput
                    value={form.address_line2}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, address_line2: event.target.value }))
                    }
                    placeholder="Apartment, suite, or other details"
                  />
                </PortalField>

                <div className="grid gap-4 md:grid-cols-3">
                  <PortalField label="City">
                    <PortalInput
                      value={form.city}
                      onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                      placeholder="City"
                    />
                  </PortalField>

                  <PortalField label="State">
                    <PortalInput
                      value={form.state}
                      onChange={(event) => setForm((prev) => ({ ...prev, state: event.target.value }))}
                      placeholder="State"
                    />
                  </PortalField>

                  <PortalField label="ZIP Code">
                    <PortalInput
                      value={form.postal_code}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, postal_code: event.target.value }))
                      }
                      placeholder="ZIP"
                    />
                  </PortalField>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--portal-border)] pt-5">
              <PortalSecondaryButton type="button" onClick={() => void refreshContext()}>
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </PortalSecondaryButton>
              <PortalButton type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Account Info
              </PortalButton>
            </div>
          </form>
        </PortalPanel>

        <div className="space-y-6">
          <PortalPanel
            title="Communication Preferences"
            subtitle="Choose how you want account updates and breeder communication saved for this portal profile."
          >
            <div className="space-y-3">
              <PreferenceToggleCard
                icon={<Mail className="h-4 w-4" />}
                title="Email updates"
                description="Receive breeder emails about documents, payments, messages, and puppy updates."
                checked={preferences.email_updates}
                onChange={(checked) =>
                  setPreferences((prev) => ({ ...prev, email_updates: checked }))
                }
              />

              <PreferenceToggleCard
                icon={<Smartphone className="h-4 w-4" />}
                title="Text updates"
                description="Allow text-message follow-up for time-sensitive account reminders and breeder communication."
                checked={preferences.sms_updates}
                onChange={(checked) =>
                  setPreferences((prev) => ({ ...prev, sms_updates: checked }))
                }
              />

              <PreferenceToggleCard
                icon={<BellRing className="h-4 w-4" />}
                title="Portal reminders"
                description="Keep reminder notices enabled for pending documents, payments, and account tasks."
                checked={preferences.portal_reminders}
                onChange={(checked) =>
                  setPreferences((prev) => ({ ...prev, portal_reminders: checked }))
                }
              />

              <PreferenceToggleCard
                icon={<Mail className="h-4 w-4" />}
                title="Litter announcements"
                description="Receive breeder announcements about future litters and availability updates."
                checked={preferences.litter_announcements}
                onChange={(checked) =>
                  setPreferences((prev) => ({ ...prev, litter_announcements: checked }))
                }
              />
            </div>
          </PortalPanel>

          <PortalPanel
            title="Account Snapshot"
            subtitle="The most important account details currently linked to your buyer portal."
          >
            <div className="grid gap-3">
              <PortalInfoTile
                label="Communication"
                value={communicationSummary}
                detail="Saved to your portal profile when you click Save Account Info."
              />
              <PortalInfoTile
                label="Delivery Option"
                value={deliveryOption}
                detail="The current transportation or pickup preference saved to your buyer record."
              />
              <PortalInfoTile
                label="Payment Setup"
                value={financeStatus}
                detail="Use the Payments tab to review balances, financing, and payment history."
              />
              <PortalInfoTile
                label="Application"
                value={applicationStatus}
                detail="The latest application status currently linked to this account."
                tone={portalStatusTone(data.application?.status)}
              />
            </div>
          </PortalPanel>
        </div>
      </div>

      {!data.buyer && !data.application && !data.puppy ? (
        <PortalEmptyState
          title="Your portal account is ready for updates."
          description="We do not see a linked buyer, application, or puppy record yet, but you can still keep your contact information and communication preferences current here."
        />
      ) : null}
    </div>
  );
}
