"use client";

import React, { useEffect, useState } from "react";
import { usePortalSession } from "@/hooks/use-portal-session";
import { buildPuppyPhotoUrl, fmtDate } from "@/lib/utils";
import {
  loadPortalContext,
  portalDisplayName,
  portalPuppyName,
} from "@/lib/portal-data";

type PortalPreviewState = {
  displayName: string;
  puppyName: string;
  puppyImage: string;
  signupDate: string;
  applicationDate: string;
};

function fallbackState(): PortalPreviewState {
  return {
    displayName: "Welcome Back",
    puppyName: "Your Future Puppy",
    puppyImage:
      "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1400&q=80",
    signupDate: "March 25, 2026",
    applicationDate: "February 6, 2026",
  };
}

function readRecordValue(record: unknown, keys: string[]) {
  if (!record || typeof record !== "object") return null;
  const source = record as Record<string, unknown>;

  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return null;
}

function formatDateValue(value: unknown, fallback: string) {
  if (!value) return fallback;

  const asString = String(value).trim();
  if (!asString) return fallback;

  const parsed = new Date(asString);
  if (Number.isNaN(parsed.getTime())) return fallback;

  return fmtDate(asString);
}

export default function PortalPage() {
  const { user, loading: sessionLoading } = usePortalSession();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<PortalPreviewState>(fallbackState());

  useEffect(() => {
    let active = true;

    async function loadPreview() {
      if (!user) {
        setState(fallbackState());
        setLoading(false);
        return;
      }

      try {
        const context = await loadPortalContext(user);

        if (!active) return;

        const displayName = portalDisplayName(user, context.buyer, context.application);
        const puppyName = portalPuppyName(context.puppy) || "Your Puppy";
        const puppyImage =
          buildPuppyPhotoUrl(context.puppy?.image_url || context.puppy?.photo_url || "") ||
          fallbackState().puppyImage;

        const signupDate = formatDateValue(
          readRecordValue(context.buyer, ["created_at", "signup_date", "sign_up_date"]) ||
            readRecordValue(user, ["created_at"]),
          fallbackState().signupDate
        );

        const applicationDate = formatDateValue(
          readRecordValue(context.application, [
            "date_applied",
            "application_date",
            "submitted_at",
            "created_at",
          ]),
          fallbackState().applicationDate
        );

        setState({
          displayName,
          puppyName,
          puppyImage,
          signupDate,
          applicationDate,
        });
      } catch (error) {
        console.error("Could not load portal preview:", error);
        if (!active) return;
        setState(fallbackState());
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPreview();

    return () => {
      active = false;
    };
  }, [user]);

  if (sessionLoading || loading) {
    return (
      <div className="space-y-6 pb-12">
        <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="h-6 w-40 rounded-full bg-slate-100" />
          <div className="mt-4 h-12 w-2/3 rounded-[18px] bg-slate-100" />
          <div className="mt-3 h-5 w-1/2 rounded-full bg-slate-100" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px]">
          <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="h-[420px] rounded-[20px] bg-slate-100" />
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-3">
              <div className="h-20 rounded-[18px] bg-slate-100" />
              <div className="h-20 rounded-[18px] bg-slate-100" />
              <div className="h-20 rounded-[18px] bg-slate-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">
          Portal Welcome
        </div>
        <h2 className="mt-2 font-serif text-[2rem] font-bold tracking-tight text-slate-900 md:text-[2.6rem]">
          Welcome back, {state.displayName}
        </h2>
        <p className="mt-3 max-w-3xl text-[15px] leading-7 text-slate-600">
          This landing page is a true portal welcome surface. It shows buyers the look and feel of
          their puppy portal without turning the first screen into a cluttered dashboard.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px]">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">
                  Portal Mock-Up
                </div>
                <div className="mt-1 font-serif text-[1.5rem] font-bold tracking-tight text-slate-900">
                  A finished buyer-facing portal
                </div>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-700">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Buyer View
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
                <div className="relative h-[320px]">
                  <img
                    src={state.puppyImage}
                    alt={state.puppyName}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.04),rgba(15,23,42,0.58))]" />
                  <div className="absolute inset-x-4 bottom-4 rounded-[18px] border border-white/20 bg-[rgba(255,255,255,0.16)] p-4 backdrop-blur-md">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/85">
                      My Puppy
                    </div>
                    <div className="mt-1 font-serif text-[1.4rem] font-bold tracking-tight text-white">
                      {state.puppyName}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <PreviewCard
                    label="Welcome"
                    title={state.displayName}
                    body="The portal opens with a cleaner, more polished welcome."
                  />
                  <PreviewCard
                    label="Application Date"
                    title={state.applicationDate}
                    body="Application details stay easy to find without crowding the page."
                  />
                  <PreviewCard
                    label="Sign-up Date"
                    title={state.signupDate}
                    body="Account timeline details remain visible but understated."
                  />
                  <PreviewCard
                    label="Puppy"
                    title={state.puppyName}
                    body="The puppy remains at the emotional center of the portal."
                  />
                </div>

                <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">
                    Landing Page Direction
                  </div>
                  <div className="mt-1 font-serif text-lg font-bold tracking-tight text-slate-900">
                    Clean first impression, deeper sections in navigation
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <MiniStrip title="Premium styling" />
                    <MiniStrip title="Clear welcome surface" />
                    <MiniStrip title="Navigation-led flow" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">
            Portal Sections
          </div>
          <div className="mt-2 font-serif text-[1.45rem] font-bold tracking-tight text-slate-900">
            Organized in the navigation
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            The landing page stays calm. The operational areas live in the left navigation where
            buyers expect them.
          </p>

          <div className="mt-5 space-y-3">
            <MockLine title="Application" body="Applicant information and next steps." />
            <MockLine title="Available Puppies" body="Available puppy browsing inside the portal style." />
            <MockLine title="Documents/Contracts" body="Forms, signatures, and records." />
            <MockLine title="Health/Resources" body="Wellness details and Chihuahua guidance." />
            <MockLine title="Payments" body="Payment history and balance details." />
            <MockLine title="Portal Messages" body="Buyer communication in its own section." />
            <MockLine title="Pupdates" body="Breeder updates in their own dedicated area." />
            <MockLine title="Transportation Request" body="Transportation details and requests." />
          </div>
        </aside>
      </section>
    </div>
  );
}

function PreviewCard({
  label,
  title,
  body,
}: {
  label: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
        {label}
      </div>
      <div className="mt-1 font-serif text-[1.05rem] font-bold tracking-tight text-slate-900">
        {title}
      </div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{body}</div>
    </div>
  );
}

function MiniStrip({ title }: { title: string }) {
  return (
    <div className="rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
      {title}
    </div>
  );
}

function MockLine({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[16px] border border-slate-200 bg-slate-50/70 px-4 py-3">
      <div className="text-sm font-bold tracking-tight text-slate-900">{title}</div>
      <div className="mt-1 text-sm leading-6 text-slate-600">{body}</div>
    </div>
  );
}