"use client";

import React, { useEffect, useState } from "react";
import { usePortalSession } from "@/hooks/use-portal-session";
import { buildPuppyPhotoUrl, fmtDate } from "@/lib/utils";
import {
  loadPortalContext,
  portalDisplayName,
  portalPuppyName,
} from "@/lib/portal-data";

type PortalLandingState = {
  displayName: string;
  puppyName: string;
  puppyImage: string;
  signupDate: string;
  applicationDate: string;
};

function fallbackState(): PortalLandingState {
  return {
    displayName: "Welcome Back",
    puppyName: "Your Puppy",
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

  const text = String(value).trim();
  if (!text) return fallback;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return fallback;

  return fmtDate(text);
}

export default function PortalPage() {
  const { user, loading: sessionLoading } = usePortalSession();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<PortalLandingState>(fallbackState());

  useEffect(() => {
    let active = true;

    async function loadLanding() {
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
        console.error("Could not load portal landing page:", error);
        if (!active) return;
        setState(fallbackState());
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadLanding();

    return () => {
      active = false;
    };
  }, [user]);

  if (sessionLoading || loading) {
    return (
      <div className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-6 w-40 rounded-full bg-slate-100" />
        <div className="mt-4 h-12 w-2/3 rounded-[18px] bg-slate-100" />
        <div className="mt-3 h-5 w-1/2 rounded-full bg-slate-100" />
        <div className="mt-6 h-[360px] rounded-[20px] bg-slate-100" />
      </div>
    );
  }

  return (
    <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50">
          <div className="relative h-[360px]">
            <img
              src={state.puppyImage}
              alt={state.puppyName}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.06),rgba(15,23,42,0.56))]" />
            <div className="absolute inset-x-4 bottom-4 rounded-[18px] border border-white/20 bg-[rgba(255,255,255,0.16)] p-4 backdrop-blur-md">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/85">
                My Puppy
              </div>
              <div className="mt-1 font-serif text-[1.35rem] font-bold tracking-tight text-white">
                {state.puppyName}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">
            Welcome
          </div>
          <h2 className="mt-2 font-serif text-[2rem] font-bold tracking-tight text-slate-900 md:text-[2.5rem]">
            Welcome back, {state.displayName}
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate-600">
            This is your Puppy Portal home page. Use the left navigation to open your application,
            available puppies, documents and contracts, health resources, payments, portal messages,
            pupdates, and transportation request.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <LandingInfo label="Puppy" value={state.puppyName} />
            <LandingInfo label="Sign-up Date" value={state.signupDate} />
            <LandingInfo label="Application Date" value={state.applicationDate} />
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[16px] border border-slate-200 bg-slate-50/70 px-4 py-3">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}