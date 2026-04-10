"use client";

import Link from "next/link";
import Image from "next/image";
import { Analytics } from "@vercel/analytics/next"
import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  FileText,
  MessageCircle,
  PenLine,
} from "lucide-react";
import { buildPuppyPhotoUrl, fmtDate, fmtMoney } from "@/lib/utils";
import {
  findBuyerPayments,
  findLatestPickupRequestForUser,
  findPortalDocumentsForUser,
  findPortalMessagesForUser,
  loadPortalContext,
  portalDisplayName,
  portalPuppyName,
  type PortalDocument,
  type PortalMessage,
  type PortalPayment,
  type PortalPickupRequest,
} from "@/lib/portal-data";
import { usePortalSession } from "@/hooks/use-portal-session";
import { PortalAccessExperience } from "@/components/portal/overview/portal-access-experience";

type OverviewState = {
  displayName: string;
  puppyName: string;
  puppyImage: string;
  applicationDate: string;
  messages: PortalMessage[];
  documents: PortalDocument[];
  payments: PortalPayment[];
  pickupRequest: PortalPickupRequest | null;
  salePrice: number | null;
};

function emptyState(): OverviewState {
  return {
    displayName: "there",
    puppyName: "your puppy",
    puppyImage: "https://www.swvachihuahua.com/pics/fancy.jpg",
    applicationDate: "Not on file",
    messages: [],
    documents: [],
    payments: [],
    pickupRequest: null,
    salePrice: null,
  };
}

function readMoney(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function readDate(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return "Not on file";
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "Not on file" : fmtDate(text);
}

function paymentSummaryLabel(state: OverviewState) {
  const totalPaid = state.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  if (!state.payments.length) return "No payments made";
  if (state.salePrice && totalPaid >= state.salePrice) return "Paid in full";
  return `${state.payments.length} payment${state.payments.length === 1 ? "" : "s"} recorded`;
}

function nextSteps(state: OverviewState) {
  const hasApplication = state.applicationDate !== "Not on file";
  const hasDocuments = state.documents.length > 0;
  const hasPickupRequest = !!state.pickupRequest;

  return [
    {
      label: "Application",
      title: hasApplication ? "Application on file" : "Complete application",
      href: "/portal/application",
      complete: hasApplication,
      action: hasApplication ? "Open" : "View",
    },
    {
      label: "Documents",
      title: hasDocuments ? "Review contracts and records" : "Open contracts and documents",
      href: "/portal/documents",
      complete: false,
      action: "View",
    },
    {
      label: "Payments",
      title: state.payments.length ? "Review payment history" : "Open payment details",
      href: "/portal/payments",
      complete: false,
      action: "View",
    },
    {
      label: "Pickup / Delivery",
      title: hasPickupRequest ? "Transportation request on file" : "Schedule pickup or delivery",
      href: "/portal/transportation",
      complete: hasPickupRequest,
      action: "View",
    },
  ];
}

export default function PortalPage() {
  const { user, loading: sessionLoading } = usePortalSession();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<OverviewState>(emptyState);

  useEffect(() => {
    let active = true;

    async function loadPage() {
      if (!user) {
        setState(emptyState());
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const context = await loadPortalContext(user);
        const [messages, documents, payments, pickupRequest] = await Promise.all([
          findPortalMessagesForUser(user, 20),
          findPortalDocumentsForUser(user, context.buyer),
          findBuyerPayments(context.buyer?.id),
          findLatestPickupRequestForUser(user),
        ]);

        if (!active) return;

        setState({
          displayName: portalDisplayName(user, context.buyer, context.application),
          puppyName: portalPuppyName(context.puppy) || "your puppy",
          puppyImage:
            buildPuppyPhotoUrl(context.puppy?.image_url || context.puppy?.photo_url || "") ||
            "https://www.swvachihuahua.com/pics/fancy.jpg",
          applicationDate: readDate(context.application?.created_at),
          messages,
          documents,
          payments,
          pickupRequest,
          salePrice: readMoney(context.buyer?.sale_price ?? context.puppy?.price),
        });
      } catch (error) {
        console.error("Could not load buyer overview:", error);
        if (!active) return;
        setState(emptyState());
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPage();

    return () => {
      active = false;
    };
  }, [user]);

  const unreadMessages = useMemo(
    () => state.messages.filter((entry) => entry.sender === "admin" && !entry.read_by_user).length,
    [state.messages]
  );
  const paymentTotal = useMemo(
    () => state.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [state.payments]
  );
  const actionSteps = nextSteps(state);

  if (sessionLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-[24px] border border-[var(--portal-border)] bg-white p-6 shadow-sm">
          <div className="h-10 w-80 max-w-full animate-pulse rounded-2xl bg-[var(--portal-surface-tint)]" />
          <div className="mt-3 h-5 w-[28rem] max-w-full animate-pulse rounded-full bg-[var(--portal-surface-tint)]" />
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-[18px] border border-[var(--portal-border)] bg-white shadow-sm"
            />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="h-[320px] animate-pulse rounded-[20px] border border-[var(--portal-border)] bg-white shadow-sm" />
          <div className="h-[320px] animate-pulse rounded-[20px] border border-[var(--portal-border)] bg-white shadow-sm" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <PortalAccessExperience />;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-[var(--portal-border)] bg-white px-6 py-7 shadow-sm md:px-8">
        <h1 className="text-[2.2rem] font-extrabold tracking-[-0.05em] text-[var(--portal-accent)] md:text-[2.75rem]">
          Welcome to Your Puppy Portal 🐕
        </h1>
        <p className="mt-2 text-base text-[var(--portal-text-soft)]">
          Make payments, view documents, and check your puppy&apos;s progress, all in one spot.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <SummaryCard
          icon={<MessageCircle className="h-5 w-5" />}
          iconClass="bg-blue-100 text-blue-600"
          label="Recent Messages"
          value={unreadMessages ? `${unreadMessages} unread` : "No New Messages"}
        />
        <SummaryCard
          icon={<FileText className="h-5 w-5" />}
          iconClass="bg-emerald-100 text-emerald-600"
          label="Documents"
          value={state.documents.length ? `${state.documents.length} document${state.documents.length === 1 ? "" : "s"}` : "No Documents"}
        />
        <SummaryCard
          icon={<CreditCard className="h-5 w-5" />}
          iconClass="bg-violet-100 text-violet-600"
          label="Payment Status"
          value={paymentSummaryLabel(state)}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-[20px] border border-[var(--portal-border)] bg-white p-5 shadow-sm">
          <h2 className="text-[1.9rem] font-bold tracking-[-0.04em] text-[var(--portal-accent)]">
            Quick Actions
          </h2>
          <p className="mt-1 text-sm text-[var(--portal-text-soft)]">
            Common tasks at your fingertips.
          </p>

          <div className="mt-5 space-y-3">
            <QuickActionButton
              href="/portal/payments"
              icon={<CreditCard className="h-4 w-4" />}
              className="bg-[linear-gradient(90deg,#2ecc71_0%,#4a90f0_100%)] shadow-[0_12px_24px_rgba(74,144,240,0.18)]"
            >
              Make a Payment
            </QuickActionButton>
            <QuickActionButton
              href="/portal/messages"
              icon={<MessageCircle className="h-4 w-4" />}
              className="bg-[linear-gradient(90deg,#b067ff_0%,#f043a2_100%)] shadow-[0_12px_24px_rgba(176,103,255,0.18)]"
            >
              Send a Message
            </QuickActionButton>
            <QuickActionButton
              href="/portal/application"
              icon={<PenLine className="h-4 w-4" />}
              className="bg-[linear-gradient(90deg,#ffbe0b_0%,#ff7b00_100%)] shadow-[0_12px_24px_rgba(255,123,0,0.18)]"
            >
              View / Sign Application
            </QuickActionButton>
          </div>
        </div>

        <div className="rounded-[20px] border border-[var(--portal-border)] bg-white p-5 shadow-sm">
          <h2 className="text-[1.9rem] font-bold tracking-[-0.04em] text-[var(--portal-accent)]">
            Next Steps
          </h2>
          <p className="mt-1 text-sm text-[var(--portal-text-soft)]">
            Your puppy adoption journey timeline.
          </p>

          <div className="mt-5 space-y-3">
            {actionSteps.map((step) => (
              <Link
                key={step.label}
                href={step.href}
                className="flex items-center justify-between rounded-[16px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4 transition hover:border-[var(--portal-border-strong)] hover:bg-white"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={[
                      "inline-flex h-8 w-8 items-center justify-center rounded-full border",
                      step.complete
                        ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                        : "border-[var(--portal-border)] bg-white text-[var(--portal-text-muted)]",
                    ].join(" ")}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <div>
                    <div
                      className={[
                        "text-sm font-semibold",
                        step.complete ? "text-[var(--portal-text-soft)] line-through" : "text-[var(--portal-text)]",
                      ].join(" ")}
                    >
                      {step.title}
                    </div>
                    <div className="text-xs text-[var(--portal-text-muted)]">{step.label}</div>
                  </div>
                </div>

                <span className="text-sm font-semibold text-[#b24cff]">
                  {step.action} →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[20px] border border-[var(--portal-border)] bg-white p-6 shadow-sm">
        <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div>
            <h2 className="text-[2rem] font-bold tracking-[-0.04em] text-[var(--portal-accent)]">
              Keep up with {state.puppyName}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--portal-text-soft)]">
              Review account details, payment activity, contracts, messages, and transportation plans
              for your Southwest Virginia Chihuahua puppy in one place.
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <InfoPill label="Application Date" value={state.applicationDate} />
              <InfoPill
                label="Payments Recorded"
                value={state.payments.length ? fmtMoney(paymentTotal) : "No payments yet"}
              />
              <InfoPill
                label="Pickup / Delivery"
                value={state.pickupRequest?.request_date ? fmtDate(state.pickupRequest.request_date) : "Not scheduled"}
              />
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <div className="relative h-40 w-40 overflow-hidden rounded-full border-[6px] border-white shadow-[0_18px_40px_rgba(96,110,148,0.18)]">
              <Image
                src={state.puppyImage}
                alt={state.puppyName}
                fill
                unoptimized
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  icon,
  iconClass,
  label,
  value,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-[var(--portal-border)] bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`inline-flex h-11 w-11 items-center justify-center rounded-full ${iconClass}`}>
          {icon}
        </span>
        <div>
          <div className="text-xs text-[var(--portal-text-muted)]">{label}</div>
          <div className="text-[1.08rem] font-semibold text-[var(--portal-text)]">{value}</div>
        </div>
      </div>
    </div>
  );
}

function QuickActionButton({
  href,
  icon,
  className,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-[12px] px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 ${className}`}
    >
      <span className="inline-flex h-5 w-5 items-center justify-center">{icon}</span>
      {children}
    </Link>
  );
}

function InfoPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[14px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3">
      <div className="text-[11px] font-semibold text-[var(--portal-text-muted)]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[var(--portal-text)]">{value}</div>
    </div>
  );
}
