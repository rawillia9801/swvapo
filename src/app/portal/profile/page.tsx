"use client";

import React, { useEffect, useState } from "react";
import { sb } from "@/lib/utils";

type SessionUser = {
  id: string;
  email?: string | null;
  user_metadata?: {
    full_name?: string | null;
    name?: string | null;
  };
};

type BuyerRow = {
  id: number;
  user_id?: string | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  buyer_email?: string | null;
  phone?: string | null;
};

type ApplicationRow = {
  id: number;
  user_id?: string | null;
  full_name?: string | null;
  email?: string | null;
  applicant_email?: string | null;
  phone?: string | null;
  street_address?: string | null;
  city_state?: string | null;
  zip?: string | null;
};

type ProfileForm = {
  fullName: string;
  email: string;
  phone: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
};

function parseCityState(value: string) {
  if (!value) return { city: "", state: "" };
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return { city: parts[0], state: parts[1] };
  return { city: value, state: "" };
}

export default function PortalProfilePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [buyer, setBuyer] = useState<BuyerRow | null>(null);
  const [application, setApplication] = useState<ApplicationRow | null>(null);
  const [form, setForm] = useState<ProfileForm>({
    fullName: "",
    email: "",
    phone: "",
    streetAddress: "",
    city: "",
    state: "",
    zip: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusText, setStatusText] = useState("");

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const {
          data: { session },
        } = await sb.auth.getSession();

        if (!mounted) return;

        const currentUser = (session?.user as SessionUser | null) ?? null;
        setUser(currentUser);

        if (currentUser) {
          await loadProfile(currentUser);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void init();

    const { data: authListener } = sb.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = (session?.user as SessionUser | null) ?? null;
      if (!mounted) return;

      setUser(currentUser);
      if (currentUser) {
        await loadProfile(currentUser);
      } else {
        setBuyer(null);
        setApplication(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function loadProfile(currentUser: SessionUser) {
    const email = String(currentUser.email || "").trim().toLowerCase();

    const [buyerRes, appRes] = await Promise.all([
      currentUser.id
        ? sb
            .from("buyers")
            .select("id,user_id,full_name,name,email,buyer_email,phone")
            .or(`user_id.eq.${currentUser.id},email.ilike.${email},buyer_email.ilike.${email}`)
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      currentUser.id
        ? sb
            .from("puppy_applications")
            .select("id,user_id,full_name,email,applicant_email,phone,street_address,city_state,zip")
            .or(`user_id.eq.${currentUser.id},email.ilike.${email},applicant_email.ilike.${email}`)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const nextBuyer = (buyerRes.data as BuyerRow | null) ?? null;
    const nextApp = (appRes.data as ApplicationRow | null) ?? null;
    const cityState = parseCityState(nextApp?.city_state || "");

    setBuyer(nextBuyer);
    setApplication(nextApp);
    setForm({
      fullName:
        nextBuyer?.full_name ||
        nextBuyer?.name ||
        nextApp?.full_name ||
        currentUser.user_metadata?.full_name ||
        currentUser.user_metadata?.name ||
        "",
      email: nextBuyer?.email || nextBuyer?.buyer_email || nextApp?.email || nextApp?.applicant_email || currentUser.email || "",
      phone: nextBuyer?.phone || nextApp?.phone || "",
      streetAddress: nextApp?.street_address || "",
      city: cityState.city,
      state: cityState.state,
      zip: nextApp?.zip || "",
    });
  }

  function updateField<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setStatusText("");

    try {
      const trimmedFullName = form.fullName.trim();
      const trimmedEmail = form.email.trim();
      const trimmedPhone = form.phone.trim();
      const trimmedStreet = form.streetAddress.trim();
      const trimmedCity = form.city.trim();
      const trimmedState = form.state.trim();
      const trimmedZip = form.zip.trim();
      const cityState = `${trimmedCity}${trimmedCity && trimmedState ? ", " : ""}${trimmedState}`;

      if (trimmedFullName || trimmedEmail !== (user.email || "")) {
        const { error: authError } = await sb.auth.updateUser({
          email: trimmedEmail || undefined,
          data: {
            full_name: trimmedFullName || undefined,
            name: trimmedFullName || undefined,
          },
        });

        if (authError) throw authError;
      }

      if (buyer?.id) {
        const { error: buyerError } = await sb
          .from("buyers")
          .update({
            full_name: trimmedFullName || null,
            name: trimmedFullName || null,
            email: trimmedEmail || null,
            buyer_email: trimmedEmail || null,
            phone: trimmedPhone || null,
          })
          .eq("id", buyer.id);

        if (buyerError) throw buyerError;
      }

      if (application?.id) {
        const { error: appError } = await sb
          .from("puppy_applications")
          .update({
            full_name: trimmedFullName || null,
            email: trimmedEmail || null,
            applicant_email: trimmedEmail || null,
            phone: trimmedPhone || null,
            street_address: trimmedStreet || null,
            city_state: cityState || null,
            zip: trimmedZip || null,
          })
          .eq("id", application.id);

        if (appError) throw appError;
      }

      setStatusText(
        trimmedEmail && trimmedEmail !== (user.email || "")
          ? "Profile updated. If Supabase requires email confirmation, check your inbox to confirm the new email address."
          : "Profile updated."
      );

      await loadProfile({
        ...user,
        email: trimmedEmail || user.email || null,
        user_metadata: {
          ...user.user_metadata,
          full_name: trimmedFullName || null,
          name: trimmedFullName || null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save profile.";
      setStatusText(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-sm font-semibold text-[#8b6b4d]">Loading profile...</div>;
  }

  if (!user) {
    return <div className="py-20 text-center text-sm font-semibold text-[#8b6b4d]">Please sign in to view your profile.</div>;
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-[#dccab7] bg-white p-7 shadow-[0_16px_40px_rgba(74,51,33,0.08)]">
        <div className="max-w-3xl">
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#9c7b58]">
            Account
          </div>
          <h1 className="mt-3 font-serif text-4xl font-bold text-[#3b271b]">Profile Settings</h1>
          <p className="mt-3 text-sm font-semibold leading-7 text-[#8b6b4d]">
            Keep your contact information current so payment reminders, breeder messages, documents, and puppy updates always reach the right place.
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <form
          onSubmit={handleSave}
          className="rounded-[2rem] border border-[#dccab7] bg-white p-7 shadow-[0_16px_40px_rgba(74,51,33,0.08)]"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Full Name" value={form.fullName} onChange={(value) => updateField("fullName", value)} />
            <Field label="Email Address" type="email" value={form.email} onChange={(value) => updateField("email", value)} />
            <Field label="Phone Number" value={form.phone} onChange={(value) => updateField("phone", value)} />
            <Field label="Street Address" value={form.streetAddress} onChange={(value) => updateField("streetAddress", value)} />
            <Field label="City" value={form.city} onChange={(value) => updateField("city", value)} />
            <Field label="State" value={form.state} onChange={(value) => updateField("state", value)} />
            <Field label="Zip Code" value={form.zip} onChange={(value) => updateField("zip", value)} />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-[1rem] bg-[#6f5037] px-6 py-3 text-sm font-black uppercase tracking-[0.16em] text-white transition hover:bg-[#5d4330] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
            {statusText ? <div className="text-sm font-semibold text-[#8b6b4d]">{statusText}</div> : null}
          </div>
        </form>

        <div className="space-y-6">
          <aside className="rounded-[2rem] border border-[#dccab7] bg-white p-7 shadow-[0_16px_40px_rgba(74,51,33,0.08)]">
            <h2 className="font-serif text-2xl font-bold text-[#3b271b]">What Updates Here</h2>
            <div className="mt-4 space-y-3 text-sm font-semibold leading-7 text-[#6f5037]">
              <p>Your portal contact details</p>
              <p>Your buyer record when one exists</p>
              <p>Your application contact fields when one exists</p>
              <p>Your sign-in profile name, and your email when confirmation succeeds</p>
            </div>
          </aside>

          <aside className="rounded-[2rem] bg-[linear-gradient(135deg,#8f6945_0%,#6f5037_100%)] p-7 text-white shadow-[0_20px_44px_rgba(74,51,33,0.18)]">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/75">Tip</div>
            <h2 className="mt-2 font-serif text-2xl font-bold">Need Help Fast?</h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-white/85">
              You can also ask ChiChi where to find messages, payments, documents, or puppy updates without leaving the page.
            </p>
          </aside>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[1rem] border border-[#e5d7c8] bg-[#fcf9f5] px-4 py-3 text-sm font-semibold text-[#342116] outline-none transition focus:border-[#c58f58] focus:bg-white"
      />
    </label>
  );
}
