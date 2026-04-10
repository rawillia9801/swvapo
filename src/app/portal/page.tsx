"use client";

import Link from "next/link";
import Image from "next/image";
import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  HeartHandshake,
  Mail,
  MessageCircle,
  PawPrint,
  PenLine,
  ShieldCheck,
  Sparkles,
  Truck,
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

type ActivityItem = {
  id: string;
  label: string;
  title: string;
  detail: string;
  dateText: string;
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

function readObjectValue(source: unknown, key: string) {
  if (!source || typeof source !== "object") return undefined;
  return (source as Record<string, unknown>)[key];
}

function readFirstText(source: unknown, keys: string[]) {
  for (const key of keys) {
    const value = readObjectValue(source, key);
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function readFirstDate(source: unknown, keys: string[]) {
  for (const key of keys) {
    const value = readObjectValue(source, key);
    const text = String(value || "").trim();
    if (!text) continue;
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return text;
  }
  return "";
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
  const hasPayments = state.payments.length > 0;

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
      complete: hasDocuments,
      action: "View",
    },
    {
      label: "Payments",
      title: hasPayments ? "Review payment history" : "Open payment details",
      href: "/portal/payments",
      complete: hasPayments,
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

  const latestPaymentDate = useMemo(() => {
    const sorted = [...state.payments].sort((a, b) => {
      const left = new Date(readFirstDate(a, ["payment_date", "created_at", "date"]) || 0).getTime();
      const right = new Date(readFirstDate(b, ["payment_date", "created_at", "date"]) || 0).getTime();
      return right - left;
    });

    const value = readFirstDate(sorted[0], ["payment_date", "created_at", "date"]);
    return value ? fmtDate(value) : "No payment date yet";
  }, [state.payments]);

  const latestDocumentTitle = useMemo(() => {
    const sorted = [...state.documents].sort((a, b) => {
      const left = new Date(readFirstDate(b, ["created_at", "updated_at"]) || 0).getTime();
      const right = new Date(readFirstDate(a, ["created_at", "updated_at"]) || 0).getTime();
      return left - right;
    });

    return (
      readFirstText(sorted[0], ["title", "file_name", "description"]) ||
      (state.documents.length ? "Document on file" : "No documents yet")
    );
  }, [state.documents]);

  const latestMessagePreview = useMemo(() => {
    const sorted = [...state.messages].sort((a, b) => {
      const left = new Date(readFirstDate(a, ["created_at", "sent_at", "updated_at"]) || 0).getTime();
      const right = new Date(readFirstDate(b, ["created_at", "sent_at", "updated_at"]) || 0).getTime();
      return right - left;
    });

    return (
      readFirstText(sorted[0], ["subject", "title", "message", "body", "content"]) ||
      (state.messages.length ? "A message is on file in your portal." : "No messages yet")
    );
  }, [state.messages]);

  const actionSteps = useMemo(() => nextSteps(state), [state]);

  const completionPercent = useMemo(() => {
    const total = actionSteps.length;
    const complete = actionSteps.filter((step) => step.complete).length;
    return total ? Math.round((complete / total) * 100) : 0;
  }, [actionSteps]);

  const remainingBalance =
    state.salePrice && state.salePrice > paymentTotal ? state.salePrice - paymentTotal : 0;

  const activity = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];

    if (state.applicationDate !== "Not on file") {
      items.push({
        id: "application",
        label: "Application",
        title: "Application received",
        detail: "Your buyer application is already on file inside the portal.",
        dateText: state.applicationDate,
      });
    }

    if (state.documents.length) {
      items.push({
        id: "documents",
        label: "Documents",
        title: `${state.documents.length} document${state.documents.length === 1 ? "" : "s"} available`,
        detail: latestDocumentTitle,
        dateText: "On file",
      });
    }

    if (state.payments.length) {
      items.push({
        id: "payments",
        label: "Payments",
        title: paymentSummaryLabel(state),
        detail:
          state.salePrice
            ? `${fmtMoney(paymentTotal)} paid${remainingBalance > 0 ? ` • ${fmtMoney(remainingBalance)} remaining` : ""}`
            : `${fmtMoney(paymentTotal)} recorded`,
        dateText: latestPaymentDate,
      });
    }

    if (unreadMessages) {
      items.push({
        id: "messages-unread",
        label: "Messages",
        title: `${unreadMessages} unread breeder message${unreadMessages === 1 ? "" : "s"}`,
        detail: "Open Messages to review the latest conversation updates from the breeder.",
        dateText: "Unread",
      });
    } else if (state.messages.length) {
      items.push({
        id: "messages",
        label: "Messages",
        title: `${state.messages.length} message${state.messages.length === 1 ? "" : "s"} in your portal`,
        detail: latestMessagePreview,
        dateText: "On file",
      });
    }

    if (state.pickupRequest?.request_date) {
      items.push({
        id: "transportation",
        label: "Transportation",
        title: "Pickup or delivery request on file",
        detail: "Your transportation request has been added to your account.",
        dateText: fmtDate(state.pickupRequest.request_date),
      });
    }

    return items.slice(0, 5);
  }, [
    latestDocumentTitle,
    latestMessagePreview,
    latestPaymentDate,
    paymentTotal,
    remainingBalance,
    state,
    unreadMessages,
  ]);

  if (sessionLoading || loading) {
    return (
      <div className="space-y-6 pb-6">
        <div className="overflow-hidden rounded-[32px] border border-[var(--portal-border)] bg-white p-6 shadow-sm md:p-8">
          <div className="h-12 w-80 max-w-full animate-pulse rounded-2xl bg-[var(--portal-surface-tint)]" />
          <div className="mt-4 h-5 w-[34rem] max-w-full animate-pulse rounded-full bg-[var(--portal-surface-tint)]" />
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-20 animate-pulse rounded-[18px] bg-[var(--portal-surface-tint)]"
              />
            ))}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-[20px] border border-[var(--portal-border)] bg-white shadow-sm"
            />
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
          <div className="h-[440px] animate-pulse rounded-[24px] border border-[var(--portal-border)] bg-white shadow-sm" />
          <div className="h-[440px] animate-pulse rounded-[24px] border border-[var(--portal-border)] bg-white shadow-sm" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <PortalAccessExperience />;
  }

  return (
    <div className="space-y-6 pb-6">
      <section className="overflow-hidden rounded-[32px] border border-[var(--portal-border)] bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(248,243,236,0.98)_42%,rgba(239,246,252,0.98)_100%)] shadow-[0_22px_54px_rgba(23,35,56,0.08)]">
        <div className="grid gap-6 px-6 py-6 md:px-8 md:py-8 xl:grid-cols-[minmax(0,1.08fr)_360px] xl:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(186,154,116,0.24)] bg-white/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)] backdrop-blur">
              <Sparkles className="h-4 w-4 text-[var(--portal-accent-strong)]" />
              My Puppy Portal
            </div>

            <h1 className="mt-4 text-[2.45rem] font-extrabold tracking-[-0.06em] text-[var(--portal-accent)] md:text-[3rem]">
              Welcome back, {state.displayName}
            </h1>

            <p className="mt-3 max-w-2xl text-base leading-8 text-[var(--portal-text-soft)]">
              This is your home base for everything related to {state.puppyName} — messages,
              payments, contracts, transportation planning, and the most important next steps.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <HeroMiniCard
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Portal Progress"
                value={`${completionPercent}%`}
                detail="Buyer journey completion"
              />
              <HeroMiniCard
                icon={<Mail className="h-4 w-4" />}
                label="Unread Messages"
                value={unreadMessages ? String(unreadMessages) : "0"}
                detail={unreadMessages ? "Waiting for review" : "All caught up"}
              />
              <HeroMiniCard
                icon={<CalendarDays className="h-4 w-4" />}
                label="Application Date"
                value={state.applicationDate}
                detail="Buyer file status"
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <PrimaryAction href="/portal/messages" icon={<MessageCircle className="h-4 w-4" />}>
                Open Messages
              </PrimaryAction>
              <SecondaryAction href="/portal/my-puppy" icon={<PawPrint className="h-4 w-4" />}>
                View My Puppy
              </SecondaryAction>
              <SecondaryAction href="/portal/payments" icon={<CreditCard className="h-4 w-4" />}>
                View Payments
              </SecondaryAction>
            </div>
          </div>

          <div className="flex justify-center xl:justify-end">
            <div className="group relative w-full max-w-[360px] overflow-hidden rounded-[30px] border border-[rgba(255,255,255,0.76)] bg-white shadow-[0_26px_56px_rgba(25,36,58,0.14)]">
              <div className="relative aspect-[4/5] overflow-hidden">
                <Image
                  src={state.puppyImage}
                  alt={state.puppyName}
                  fill
                  unoptimized
                  className="object-cover transition duration-700 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,28,40,0.06)_0%,rgba(20,28,40,0.70)_100%)]" />

                <div className="absolute left-4 top-4 inline-flex items-center rounded-full border border-white/20 bg-white/14 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur-md">
                  Puppy Profile
                </div>

                <div className="absolute inset-x-4 bottom-4 rounded-[24px] border border-white/20 bg-white/12 p-4 text-white backdrop-blur-md">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/78">
                    Southwest Virginia Chihuahua
                  </div>
                  <div className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
                    {state.puppyName}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-white/86">
                    Your puppy’s account details, progress, and records stay organized here.
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <GlassStat
                      label="Application"
                      value={state.applicationDate !== "Not on file" ? "On file" : "Pending"}
                    />
                    <GlassStat
                      label="Transportation"
                      value={state.pickupRequest?.request_date ? "Requested" : "Not set"}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <OverviewStatCard
          icon={<MessageCircle className="h-5 w-5" />}
          iconClass="bg-[rgba(105,145,255,0.14)] text-[#4a72d8]"
          label="Recent Messages"
          value={unreadMessages ? `${unreadMessages} unread` : "No unread messages"}
          detail={state.messages.length ? `${state.messages.length} total in your account` : "No messages yet"}
        />
        <OverviewStatCard
          icon={<FileText className="h-5 w-5" />}
          iconClass="bg-[rgba(69,184,139,0.14)] text-[#239165]"
          label="Contracts & Documents"
          value={
            state.documents.length
              ? `${state.documents.length} document${state.documents.length === 1 ? "" : "s"}`
              : "No documents yet"
          }
          detail={state.documents.length ? latestDocumentTitle : "Contracts will appear here once posted"}
        />
        <OverviewStatCard
          icon={<CreditCard className="h-5 w-5" />}
          iconClass="bg-[rgba(165,117,255,0.14)] text-[#8251dd]"
          label="Payment Status"
          value={paymentSummaryLabel(state)}
          detail={
            state.salePrice
              ? `${fmtMoney(paymentTotal)} paid${remainingBalance > 0 ? ` • ${fmtMoney(remainingBalance)} remaining` : ""}`
              : state.payments.length
                ? `${fmtMoney(paymentTotal)} recorded`
                : "No payment activity yet"
          }
        />
        <OverviewStatCard
          icon={<Truck className="h-5 w-5" />}
          iconClass="bg-[rgba(240,158,75,0.14)] text-[#c56f18]"
          label="Pickup / Delivery"
          value={state.pickupRequest?.request_date ? "Request on file" : "Not scheduled"}
          detail={
            state.pickupRequest?.request_date
              ? `Requested ${fmtDate(state.pickupRequest.request_date)}`
              : "Transportation details can be added in the portal"
          }
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
        <div className="space-y-4">
          <div className="rounded-[24px] border border-[var(--portal-border)] bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[1.9rem] font-bold tracking-[-0.04em] text-[var(--portal-accent)]">
                  Action Center
                </h2>
                <p className="mt-1 text-sm leading-7 text-[var(--portal-text-soft)]">
                  The tasks buyers use most, organized in a cleaner and more premium dashboard layout.
                </p>
              </div>
              <div className="rounded-full border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
                Quick Access
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <FeatureActionCard
                href="/portal/payments"
                eyebrow="Payments"
                title="Make or Review Payments"
                description="See what has been recorded, review payment history, and stay on top of your account."
                icon={<CreditCard className="h-5 w-5" />}
                accentClass="from-[rgba(75,141,255,0.16)] to-[rgba(99,205,158,0.10)]"
              />
              <FeatureActionCard
                href="/portal/documents"
                eyebrow="Contracts"
                title="Open Contracts & Documents"
                description="Review agreements, signed copies, and any records shared to your account."
                icon={<FileText className="h-5 w-5" />}
                accentClass="from-[rgba(99,205,158,0.16)] to-[rgba(231,198,154,0.10)]"
              />
              <FeatureActionCard
                href="/portal/messages"
                eyebrow="Messages"
                title="Message the Breeder"
                description="Keep communication organized inside the portal instead of hunting through email threads."
                icon={<MessageCircle className="h-5 w-5" />}
                accentClass="from-[rgba(179,120,255,0.16)] to-[rgba(255,173,210,0.10)]"
              />
              <FeatureActionCard
                href="/portal/application"
                eyebrow="Application"
                title="Review Your Application"
                description="Open your buyer application and review the information currently on file."
                icon={<PenLine className="h-5 w-5" />}
                accentClass="from-[rgba(240,184,78,0.18)] to-[rgba(255,127,90,0.10)]"
              />
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--portal-border)] bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[1.9rem] font-bold tracking-[-0.04em] text-[var(--portal-accent)]">
                  Buyer Journey Progress
                </h2>
                <p className="mt-1 text-sm leading-7 text-[var(--portal-text-soft)]">
                  A clearer view of what is complete and what still needs your attention.
                </p>
              </div>

              <div className="text-right">
                <div className="text-[1.8rem] font-extrabold tracking-[-0.05em] text-[var(--portal-accent)]">
                  {completionPercent}%
                </div>
                <div className="text-xs text-[var(--portal-text-muted)]">completed</div>
              </div>
            </div>

            <div className="mt-5 h-3 overflow-hidden rounded-full bg-[rgba(174,191,211,0.22)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,rgba(214,176,130,0.98)_0%,rgba(93,134,199,0.95)_100%)]"
                style={{ width: `${completionPercent}%` }}
              />
            </div>

            <div className="mt-5 space-y-3">
              {actionSteps.map((step) => (
                <ChecklistItem
                  key={step.label}
                  href={step.href}
                  complete={step.complete}
                  label={step.label}
                  title={step.title}
                  action={step.action}
                />
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--portal-border)] bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[1.9rem] font-bold tracking-[-0.04em] text-[var(--portal-accent)]">
                  Recent Activity
                </h2>
                <p className="mt-1 text-sm leading-7 text-[var(--portal-text-soft)]">
                  A quick feed of what has already happened inside your account.
                </p>
              </div>
            </div>

            {activity.length ? (
              <div className="mt-5 space-y-3">
                {activity.map((item) => (
                  <ActivityCard
                    key={item.id}
                    label={item.label}
                    title={item.title}
                    detail={item.detail}
                    dateText={item.dateText}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[20px] border border-dashed border-[var(--portal-border-strong)] bg-[var(--portal-surface-muted)] px-5 py-5 text-sm leading-7 text-[var(--portal-text-soft)]">
                Activity will appear here as documents, messages, payments, and transportation updates are added to your account.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-[24px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,249,253,0.98)_100%)] shadow-sm">
            <div className="border-b border-[var(--portal-border)] px-5 py-5 md:px-6">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                <ShieldCheck className="h-4 w-4 text-[var(--portal-accent-strong)]" />
                Puppy Account Snapshot
              </div>
              <h2 className="mt-2 text-[1.8rem] font-bold tracking-[-0.04em] text-[var(--portal-accent)]">
                Keep up with {state.puppyName}
              </h2>
              <p className="mt-2 text-sm leading-7 text-[var(--portal-text-soft)]">
                Review the most important account details for your puppy in one organized place.
              </p>
            </div>

            <div className="grid gap-4 px-5 py-5 md:px-6">
              <InfoPill label="Application Date" value={state.applicationDate} />
              <InfoPill
                label="Payments Recorded"
                value={state.payments.length ? fmtMoney(paymentTotal) : "No payments yet"}
              />
              <InfoPill
                label="Pickup / Delivery"
                value={
                  state.pickupRequest?.request_date
                    ? fmtDate(state.pickupRequest.request_date)
                    : "Not scheduled"
                }
              />
              <InfoPill
                label="Message Status"
                value={unreadMessages ? `${unreadMessages} unread` : "All caught up"}
              />
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--portal-border)] bg-white p-5 shadow-sm md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[1.8rem] font-bold tracking-[-0.04em] text-[var(--portal-accent)]">
                  Payment Overview
                </h2>
                <p className="mt-1 text-sm leading-7 text-[var(--portal-text-soft)]">
                  A more useful financial snapshot for your puppy account.
                </p>
              </div>
              <div className="rounded-full border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
                Financials
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <FinanceCard
                label="Total Paid"
                value={state.payments.length ? fmtMoney(paymentTotal) : fmtMoney(0)}
                detail={
                  state.payments.length
                    ? `${state.payments.length} payment${state.payments.length === 1 ? "" : "s"} recorded`
                    : "No payments recorded yet"
                }
              />
              <FinanceCard
                label="Remaining Balance"
                value={state.salePrice ? fmtMoney(Math.max(0, remainingBalance)) : "Not listed"}
                detail={
                  state.salePrice
                    ? remainingBalance > 0
                      ? "Based on the listed sale price"
                      : "Account appears paid in full"
                    : "Sale price is not currently listed"
                }
              />
            </div>

            {state.salePrice ? (
              <div className="mt-5 rounded-[20px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-[var(--portal-text)]">
                    Payment Progress
                  </div>
                  <div className="text-sm font-semibold text-[var(--portal-text-soft)]">
                    {Math.min(100, Math.round((paymentTotal / state.salePrice) * 100))}%
                  </div>
                </div>

                <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,rgba(101,175,236,0.95)_0%,rgba(100,204,149,0.95)_100%)]"
                    style={{
                      width: `${Math.min(100, Math.max(0, Math.round((paymentTotal / state.salePrice) * 100)))}%`,
                    }}
                  />
                </div>

                <div className="mt-3 text-sm leading-6 text-[var(--portal-text-soft)]">
                  {paymentTotal >= state.salePrice
                    ? "Payments recorded meet or exceed the listed sale price."
                    : "This progress bar reflects the payments currently recorded in your account."}
                </div>
              </div>
            ) : null}

            <div className="mt-5">
              <Link
                href="/portal/payments"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--portal-accent-strong)] transition hover:gap-3"
              >
                Open payment page
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--portal-border)] bg-white p-5 shadow-sm md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[1.8rem] font-bold tracking-[-0.04em] text-[var(--portal-accent)]">
                  Helpful Shortcuts
                </h2>
                <p className="mt-1 text-sm leading-7 text-[var(--portal-text-soft)]">
                  Jump quickly to the pages buyers usually use most.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <InlineShortcut
                href="/portal/my-puppy"
                icon={<HeartHandshake className="h-4 w-4" />}
                title="My Puppy"
                detail="View your puppy profile, updates, and progress."
              />
              <InlineShortcut
                href="/portal/documents"
                icon={<FileText className="h-4 w-4" />}
                title="Contracts & Documents"
                detail="Open agreements, signed copies, and shared records."
              />
              <InlineShortcut
                href="/portal/transportation"
                icon={<Truck className="h-4 w-4" />}
                title="Transportation"
                detail="Check pickup or delivery details for your puppy."
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function HeroMiniCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-[rgba(186,154,116,0.18)] bg-white/86 px-4 py-4 shadow-[0_10px_24px_rgba(23,35,56,0.04)] backdrop-blur">
      <div className="flex items-center gap-2 text-[var(--portal-accent-strong)]">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
          {label}
        </span>
      </div>
      <div className="mt-3 text-[1.02rem] font-semibold text-[var(--portal-text)]">{value}</div>
      <div className="mt-1 text-xs text-[var(--portal-text-soft)]">{detail}</div>
    </div>
  );
}

function GlassStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/16 bg-white/10 px-3 py-3 backdrop-blur">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/74">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function PrimaryAction({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-[14px] bg-[linear-gradient(90deg,#bc8a59_0%,#7ba6d2_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(123,166,210,0.20)] transition hover:-translate-y-0.5"
    >
      {icon}
      {children}
    </Link>
  );
}

function SecondaryAction({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-[14px] border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--portal-border-strong)]"
    >
      {icon}
      {children}
    </Link>
  );
}

function OverviewStatCard({
  icon,
  iconClass,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[20px] border border-[var(--portal-border)] bg-white px-5 py-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${iconClass}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
            {label}
          </div>
          <div className="mt-2 text-[1.08rem] font-semibold text-[var(--portal-text)]">
            {value}
          </div>
          <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
        </div>
      </div>
    </div>
  );
}

function FeatureActionCard({
  href,
  eyebrow,
  title,
  description,
  icon,
  accentClass,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accentClass: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[22px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(250,249,247,1)_100%)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(23,35,56,0.08)]"
    >
      <div
        className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--tw-gradient-stops))] ${accentClass} text-[var(--portal-accent-strong)]`}
      >
        {icon}
      </div>
      <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
        {eyebrow}
      </div>
      <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--portal-text)]">
        {title}
      </div>
      <div className="mt-2 text-sm leading-7 text-[var(--portal-text-soft)]">{description}</div>
      <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--portal-accent-strong)] transition group-hover:gap-3">
        Open
        <ArrowRight className="h-4 w-4" />
      </div>
    </Link>
  );
}

function ChecklistItem({
  href,
  complete,
  label,
  title,
  action,
}: {
  href: string;
  complete: boolean;
  label: string;
  title: string;
  action: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-[18px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4 transition hover:border-[var(--portal-border-strong)] hover:bg-white"
    >
      <div className="flex items-center gap-3">
        <span
          className={[
            "inline-flex h-9 w-9 items-center justify-center rounded-full border",
            complete
              ? "border-emerald-200 bg-emerald-50 text-emerald-600"
              : "border-[var(--portal-border)] bg-white text-[var(--portal-text-muted)]",
          ].join(" ")}
        >
          <CheckCircle2 className="h-4 w-4" />
        </span>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
            {label}
          </div>
          <div
            className={[
              "mt-1 text-sm font-semibold",
              complete ? "text-[var(--portal-text-soft)]" : "text-[var(--portal-text)]",
            ].join(" ")}
          >
            {title}
          </div>
        </div>
      </div>

      <span className="text-sm font-semibold text-[var(--portal-accent-strong)]">
        {action} →
      </span>
    </Link>
  );
}

function ActivityCard({
  label,
  title,
  detail,
  dateText,
}: {
  label: string;
  title: string;
  detail: string;
  dateText: string;
}) {
  return (
    <div className="rounded-[20px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(250,249,246,1)_100%)] p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
            {label}
          </div>
          <div className="mt-2 text-base font-semibold text-[var(--portal-text)]">
            {title}
          </div>
        </div>
        <div className="rounded-full border border-[rgba(186,154,116,0.16)] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
          {dateText}
        </div>
      </div>
      <div className="mt-3 text-sm leading-7 text-[var(--portal-text-soft)]">{detail}</div>
    </div>
  );
}

function FinanceCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[20px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-[1.25rem] font-semibold text-[var(--portal-text)]">{value}</div>
      <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
    </div>
  );
}

function InlineShortcut({
  href,
  icon,
  title,
  detail,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-[18px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4 transition hover:border-[var(--portal-border-strong)] hover:bg-white"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[var(--portal-accent-strong)] shadow-sm">
          {icon}
        </span>
        <div>
          <div className="text-sm font-semibold text-[var(--portal-text)]">{title}</div>
          <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
        </div>
      </div>

      <ArrowRight className="h-4 w-4 text-[var(--portal-accent-strong)]" />
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
    <div className="rounded-[16px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-[var(--portal-text)]">{value}</div>
    </div>
  );
}