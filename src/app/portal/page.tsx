"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
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
        <div className="rounded-[30px] border border-[#eadbc9] bg-white/90 p-6 shadow-[0_18px_42px_rgba(120,88,56,0.08)]">
          <div className="h-6 w-40 rounded-full bg-[#f2e6d8]" />
          <div className="mt-4 h-12 w-2/3 rounded-[18px] bg-[#f7ede1]" />
          <div className="mt-3 h-5 w-1/2 rounded-full bg-[#f2e6d8]" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px]">
          <div className="rounded-[32px] border border-[#eadbc9] bg-white/88 p-6 shadow-[0_18px_42px_rgba(120,88,56,0.08)]">
            <div className="h-[430px] rounded-[28px] bg-[#f8efe5]" />
          </div>

          <div className="rounded-[32px] border border-[#eadbc9] bg-white/88 p-6 shadow-[0_18px_42px_rgba(120,88,56,0.08)]">
            <div className="space-y-3">
              <div className="h-20 rounded-[18px] bg-[#f8efe5]" />
              <div className="h-20 rounded-[18px] bg-[#f8efe5]" />
              <div className="h-20 rounded-[18px] bg-[#f8efe5]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <section className="rounded-[32px] border border-[#eadbc9] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(249,241,233,0.94))] p-6 shadow-[0_18px_44px_rgba(120,88,56,0.09)] md:p-8">
        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b18459]">
          Portal Welcome
        </div>
        <h2 className="mt-2 text-[2rem] font-extrabold tracking-[-0.05em] text-[#3d2a1f] md:text-[2.6rem]">
          Welcome back, {state.displayName}
        </h2>
        <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[#6a4f3a]">
          This landing page is the polished portal preview. It gives buyers a clean first look at
          their portal without cluttering the page with every section at once.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px]">
        <div className="rounded-[32px] border border-[#eadbc9] bg-white/90 p-5 shadow-[0_18px_44px_rgba(120,88,56,0.08)] md:p-6">
          <div className="rounded-[28px] border border-[#eddccc] bg-[linear-gradient(180deg,rgba(255,251,246,0.98),rgba(248,239,229,0.96))] p-4">
            <div className="flex flex-col gap-4 border-b border-[#eddccc] pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b18459]">
                  Portal Mock-Up
                </div>
                <div className="mt-1 text-[1.45rem] font-extrabold tracking-[-0.04em] text-[#3d2a1f]">
                  A finished buyer-facing portal
                </div>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-[#eadbc9] bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#8f6945]">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#88b878]" />
                Buyer View
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-[24px] border border-[#eadbc9] bg-white shadow-[0_12px_28px_rgba(120,88,56,0.07)]">
                <div className="relative h-[320px]">
                  <Image
                    src={state.puppyImage}
                    alt={state.puppyName}
                    fill
                    sizes="(max-width: 1024px) 100vw, 300px"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(39,26,18,0.04),rgba(39,26,18,0.58))]" />
                  <div className="absolute inset-x-4 bottom-4 rounded-[20px] border border-white/20 bg-[rgba(255,255,255,0.16)] p-4 backdrop-blur-md">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/85">
                      My Puppy
                    </div>
                    <div className="mt-1 text-[1.4rem] font-extrabold tracking-[-0.04em] text-white">
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
                    body="The portal opens with a warm, premium welcome instead of a crowded dashboard."
                  />
                  <PreviewCard
                    label="Application Date"
                    title={state.applicationDate}
                    body="Application timeline details stay visible without taking over the page."
                  />
                  <PreviewCard
                    label="Sign-up Date"
                    title={state.signupDate}
                    body="Account dates remain organized and easy to read."
                  />
                  <PreviewCard
                    label="Puppy"
                    title={state.puppyName}
                    body="The puppy stays at the emotional center of the buyer experience."
                  />
                </div>

                <div className="rounded-[24px] border border-[#eadbc9] bg-white p-5 shadow-[0_12px_28px_rgba(120,88,56,0.06)]">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b18459]">
                    Portal Feel
                  </div>
                  <div className="mt-1 text-lg font-extrabold tracking-[-0.03em] text-[#3d2a1f]">
                    Calm, polished, and clearly organized
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <MiniStrip title="Soft premium styling" />
                    <MiniStrip title="One clear welcome surface" />
                    <MiniStrip title="Navigation-first structure" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="rounded-[32px] border border-[#eadbc9] bg-white/90 p-5 shadow-[0_18px_44px_rgba(120,88,56,0.08)] md:p-6">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b18459]">
            Landing Page Purpose
          </div>
          <div className="mt-2 text-[1.45rem] font-extrabold tracking-[-0.04em] text-[#3d2a1f]">
            A true portal landing page
          </div>
          <p className="mt-3 text-sm leading-7 text-[#6a4f3a]">
            The left navigation already carries the deeper sections like Documents, Portal Messages,
            Pupdates, Payments, Health/Resources, and Transportation. This landing page stays focused
            on the first impression and the overall portal feel.
          </p>

          <div className="mt-5 space-y-3">
            <MockLine
              title="Premium presentation"
              body="The page welcomes the buyer and shows the portal style immediately."
            />
            <MockLine
              title="Less clutter"
              body="It avoids stacking every operational section onto the first screen."
            />
            <MockLine
              title="Navigation-led flow"
              body="Buyers move into the deeper sections from the left navigation when they are ready."
            />
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
    <div className="rounded-[22px] border border-[#eadbc9] bg-white p-4 shadow-[0_10px_24px_rgba(120,88,56,0.06)]">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#b18459]">
        {label}
      </div>
      <div className="mt-1 text-[1.05rem] font-extrabold tracking-[-0.03em] text-[#3d2a1f]">
        {title}
      </div>
      <div className="mt-2 text-sm leading-6 text-[#6a4f3a]">{body}</div>
    </div>
  );
}

function MiniStrip({ title }: { title: string }) {
  return (
    <div className="rounded-[18px] border border-[#eadbc9] bg-[#fffaf5] px-4 py-3 text-sm font-semibold text-[#5b4331]">
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
    <div className="rounded-[20px] border border-[#eadbc9] bg-[#fffaf5] px-4 py-3">
      <div className="text-sm font-extrabold tracking-[-0.02em] text-[#3d2a1f]">{title}</div>
      <div className="mt-1 text-sm leading-6 text-[#6a4f3a]">{body}</div>
    </div>
  );
}