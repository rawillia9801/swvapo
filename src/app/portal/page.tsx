"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import {
  CreditCard,
  MessageCircle,
  Route,
  ShieldCheck,
} from "lucide-react";
import { buildPuppyPhotoUrl, fmtDate, fmtMoney } from "@/lib/utils";
import {
  attachmentPhotoCount,
  countAttachments,
  findBuyerPayments,
  findFormSubmissionsForUser,
  findHealthRecords,
  findLatestPickupRequestForUser,
  findPortalDocumentsForUser,
  findPortalMessagesForUser,
  findPuppyEvents,
  loadPortalContext,
  paymentCountsTowardBalance,
  portalDisplayName,
  portalPuppyName,
  type PortalDocument,
  type PortalFormSubmission,
  type PortalHealthRecord,
  type PortalMessage,
  type PortalPayment,
  type PortalPickupRequest,
  type PortalPuppyEvent,
} from "@/lib/portal-data";
import { usePortalSession } from "@/hooks/use-portal-session";
import {
  PortalActionLink,
  PortalEmptyState,
  PortalHeroPrimaryAction,
  PortalHeroSecondaryAction,
  PortalInfoTile,
  PortalListCard,
  PortalLoadingState,
  PortalMetricCard,
  PortalMetricGrid,
  PortalNarrativeCard,
  PortalPageHero,
  PortalPanel,
  PortalStatusBadge,
} from "@/components/portal/luxury-shell";
import { PortalAccessExperience } from "@/components/portal/overview/portal-access-experience";

type DashboardState = {
  messages: PortalMessage[];
  events: PortalPuppyEvent[];
  health: PortalHealthRecord[];
  forms: PortalFormSubmission[];
  documents: PortalDocument[];
  payments: PortalPayment[];
  pickupRequest: PortalPickupRequest | null;
};

type ActivityItem = {
  id: string;
  date: string;
  label: string;
  title: string;
  detail: string;
  tone: "neutral" | "success" | "warning";
};

function emptyState(): DashboardState {
  return {
    messages: [],
    events: [],
    health: [],
    forms: [],
    documents: [],
    payments: [],
    pickupRequest: null,
  };
}

function requestStatusLabel(request: PortalPickupRequest | null) {
  if (!request?.status) return "Not scheduled";
  return String(request.status).replace(/\b\w/g, (char) => char.toUpperCase());
}

function requestTypeLabel(request: PortalPickupRequest | null) {
  if (!request?.request_type) return "No transportation request";
  return String(request.request_type)
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildUpcoming(
  events: PortalPuppyEvent[],
  health: PortalHealthRecord[],
  request: PortalPickupRequest | null
) {
  const milestones: ActivityItem[] = [
    ...health
      .filter((entry) => entry.next_due_date)
      .map((entry) => ({
        id: `health-${entry.id}`,
        label: "Wellness",
        title: entry.title,
        detail: entry.description || "A scheduled wellness item is on file.",
        date: entry.next_due_date as string,
        tone: "success" as const,
      })),
    ...events
      .filter((entry) => !!entry.event_date)
      .map((entry) => ({
        id: `event-${entry.id}`,
        label: "Pupdate",
        title: entry.title || entry.label || "Breeder update",
        detail: entry.summary || entry.details || "A breeder update was posted to the portal.",
        date: entry.event_date,
        tone: "neutral" as const,
      })),
  ]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 4);

  if (request?.request_date) {
    milestones.unshift({
      id: `transport-${request.id}`,
      label: "Transportation",
      title: requestTypeLabel(request),
      detail: request.location_text || request.address_text || "Transportation request on file.",
      date: request.request_date,
      tone: "warning",
    });
  }

  return milestones.slice(0, 4);
}

function buildActivity({
  events,
  health,
  messages,
}: {
  events: PortalPuppyEvent[];
  health: PortalHealthRecord[];
  messages: PortalMessage[];
}) {
  const activity: ActivityItem[] = [
    ...events.map((entry) => ({
      id: `event-${entry.id}`,
      date: entry.event_date,
      label: "Pupdate",
      title: entry.title || entry.label || "Breeder update",
      detail: entry.summary || entry.details || "A new breeder update was posted.",
      tone: "neutral" as const,
    })),
    ...health.map((entry) => ({
      id: `health-${entry.id}`,
      date: entry.record_date,
      label: "Wellness",
      title: entry.title,
      detail: entry.description || "A wellness record was added to your puppy profile.",
      tone: "success" as const,
    })),
    ...messages.map((entry) => ({
      id: `message-${entry.id}`,
      date: entry.created_at,
      label: entry.sender === "admin" ? "Message" : "Sent",
      title: entry.subject || (entry.sender === "admin" ? "Breeder reply" : "Your message"),
      detail: entry.message || "A new portal message is available.",
      tone: entry.sender === "admin" ? "warning" as const : "neutral" as const,
    })),
  ];

  return activity
    .filter((entry) => !!entry.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);
}

export default function PortalPage() {
  const { user, loading: sessionLoading } = usePortalSession();
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [state, setState] = useState(emptyState);
  const [context, setContext] = useState<Awaited<ReturnType<typeof loadPortalContext>> | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      if (!user) {
        setContext(null);
        setState(emptyState());
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorText("");

      try {
        const nextContext = await loadPortalContext(user);
        const [messages, events, health, forms, documents, payments, pickupRequest] =
          await Promise.all([
            findPortalMessagesForUser(user, 12),
            findPuppyEvents(nextContext.puppy?.id),
            findHealthRecords(nextContext.puppy?.id),
            findFormSubmissionsForUser(user),
            findPortalDocumentsForUser(user, nextContext.buyer),
            findBuyerPayments(nextContext.buyer?.id),
            findLatestPickupRequestForUser(user),
          ]);

        if (!active) return;

        setContext(nextContext);
        setState({
          messages,
          events,
          health,
          forms,
          documents,
          payments,
          pickupRequest,
        });
      } catch (error) {
        console.error("Could not load portal overview:", error);
        if (!active) return;
        setErrorText(
          "We could not load your portal overview right now. Please refresh or try again in a moment."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, [user]);

  if (sessionLoading || loading) {
    return <PortalLoadingState label="Loading My Puppy Portal..." />;
  }

  if (!user) {
    return <PortalAccessExperience />;
  }

  if (!context || errorText) {
    return (
      <PortalNarrativeCard
        eyebrow="Overview"
        title="Your portal overview is not available right now."
        description={errorText || "Please refresh or try again in a moment."}
      />
    );
  }

  const { buyer, application, puppy } = context;
  const displayName = portalDisplayName(user, buyer, application);
  const puppyName = portalPuppyName(puppy);
  const puppyImage =
    buildPuppyPhotoUrl(puppy?.image_url || puppy?.photo_url || "") ||
    "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1400&q=80";

  const paid = state.payments
    .filter((entry) => paymentCountsTowardBalance(entry.status))
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const price = buyer?.sale_price ?? puppy?.price ?? null;
  const remaining =
    price !== null && price !== undefined
      ? Math.max(0, Number(price) - paid)
      : puppy?.balance ?? null;
  const unreadBreederMessages = state.messages.filter(
    (message) => message.sender === "admin" && !message.read_by_user
  ).length;
  const draftForms = state.forms.filter(
    (form) => String(form.status || "").toLowerCase() === "draft"
  );
  const openDocuments = state.documents.filter((document) => {
    const status = String(document.status || "").toLowerCase();
    return status !== "completed" && status !== "signed";
  });
  const photoMoments = state.events.reduce(
    (sum, event) => sum + attachmentPhotoCount(event.photos) + (event.photo_url ? 1 : 0),
    0
  );
  const totalAttachments = state.forms.reduce(
    (sum, form) => sum + countAttachments(form.attachments),
    0
  );
  const puppyStage = puppy
    ? String(puppy.status || "").toLowerCase().includes("home")
      ? "At Home"
      : String(puppy.status || "").toLowerCase().includes("matched") ||
          String(puppy.status || "").toLowerCase().includes("reserved") ||
          String(puppy.status || "").toLowerCase().includes("sold")
        ? "Matched"
        : "Growing with breeder"
    : "Waiting for match";

  const upcoming = buildUpcoming(state.events, state.health, state.pickupRequest);
  const activity = buildActivity({
    events: state.events,
    health: state.health,
    messages: state.messages,
  });

  const attentionCards = [
    unreadBreederMessages
      ? {
          id: "messages",
          label: "Unread messages",
          title: `${unreadBreederMessages} message${unreadBreederMessages === 1 ? "" : "s"} waiting`,
          description: "Open Messages to review breeder replies and follow-up notes.",
          rightLabel: "Messages",
          tone: "warning" as const,
        }
      : null,
    draftForms.length
      ? {
          id: "forms",
          label: "Forms",
          title: `${draftForms.length} draft form${draftForms.length === 1 ? "" : "s"}`,
          description: "Review saved forms and finish anything that still needs to be submitted.",
          rightLabel: "Documents",
          tone: "warning" as const,
        }
      : null,
    remaining !== null && remaining > 0
      ? {
          id: "payments",
          label: "Payments",
          title: `${fmtMoney(remaining)} remaining`,
          description: "Open Payments to review your recorded history and any balance still on file.",
          rightLabel: "Payments",
          tone: "neutral" as const,
        }
      : null,
    openDocuments.length
      ? {
          id: "documents",
          label: "Documents",
          title: `${openDocuments.length} open record${openDocuments.length === 1 ? "" : "s"}`,
          description: "Review recent documents, signatures, or portal files that are still active.",
          rightLabel: "Documents",
          tone: "neutral" as const,
        }
      : null,
    state.pickupRequest
      ? {
          id: "transport",
          label: "Transportation",
          title: requestStatusLabel(state.pickupRequest),
          description:
            state.pickupRequest.request_date
              ? `${requestTypeLabel(state.pickupRequest)} scheduled for ${fmtDate(
                  state.pickupRequest.request_date
                )}.`
              : "A transportation request is on file.",
          rightLabel: "Transportation",
          tone: "success" as const,
        }
      : null,
  ].filter(Boolean) as Array<{
    id: string;
    label: string;
    title: string;
    description: string;
    rightLabel: string;
    tone: "neutral" | "success" | "warning";
  }>;

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Overview"
        title={`Welcome back, ${displayName}`}
        description="View your puppy’s updates, milestones, documents, payments, messages, transportation details, and next steps in one place."
        actions={
          <>
            <PortalHeroPrimaryAction href={puppy ? "/portal/mypuppy" : "/portal/application"}>
              {puppy ? "Open My Puppy" : "Open Application"}
            </PortalHeroPrimaryAction>
            <PortalHeroSecondaryAction href="/portal/messages">Open Messages</PortalHeroSecondaryAction>
          </>
        }
        aside={
          <div className="grid gap-4">
            <PortalInfoTile
              label="My Puppy"
              value={puppy ? puppyName : "Waiting for match"}
              detail={puppy ? `${puppyStage} on this account.` : "Your account is active and waiting for a linked puppy profile."}
              tone={puppy ? "success" : "neutral"}
            />
            <PortalInfoTile
              label="Payment Status"
              value={
                remaining !== null && remaining !== undefined
                  ? remaining > 0
                    ? fmtMoney(remaining)
                    : "Paid in full"
                  : "No balance posted"
              }
              detail={remaining && remaining > 0 ? "Current balance remaining on file." : "No amount currently due."}
              tone={remaining && remaining > 0 ? "warning" : "success"}
            />
          </div>
        }
      />

      <PortalMetricGrid>
        <PortalMetricCard
          label="Pupdates"
          value={String(state.events.length + state.health.length)}
          detail="Published breeder notes, wellness records, and milestone entries."
        />
        <PortalMetricCard
          label="Documents"
          value={String(state.documents.length + state.forms.length)}
          detail="Shared records, forms, and saved submissions linked to your account."
          accent="from-[rgba(93,121,255,0.16)] via-transparent to-[rgba(140,156,183,0.14)]"
        />
        <PortalMetricCard
          label="Messages"
          value={String(state.messages.length)}
          detail={unreadBreederMessages ? `${unreadBreederMessages} breeder message${unreadBreederMessages === 1 ? "" : "s"} unread.` : "No unread breeder replies."}
          accent="from-[rgba(113,198,164,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
        <PortalMetricCard
          label="Transportation"
          value={state.pickupRequest ? requestStatusLabel(state.pickupRequest) : "Not scheduled"}
          detail={state.pickupRequest ? requestTypeLabel(state.pickupRequest) : "No transportation request on file yet."}
          accent="from-[rgba(110,166,218,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.28fr)_380px]">
        <PortalPanel
          title="Puppy Snapshot"
          subtitle="The core account context stays visible here so the homepage feels useful the moment it opens."
        >
          {puppy ? (
            <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="relative min-h-[320px] overflow-hidden rounded-[28px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] shadow-[0_18px_40px_rgba(23,35,56,0.06)]">
                <Image
                  src={puppyImage}
                  alt={puppyName}
                  fill
                  sizes="(max-width: 1280px) 100vw, 320px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,18,31,0.04)_0%,rgba(10,18,31,0.6)_100%)]" />
                <div className="absolute inset-x-4 bottom-4 rounded-[22px] border border-white/22 bg-[rgba(246,250,255,0.16)] p-4 backdrop-blur-md">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/82">
                    Current Stage
                  </div>
                  <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
                    {puppyStage}
                  </div>
                </div>
              </div>

              <div className="grid gap-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <PortalInfoTile
                    label="My Puppy"
                    value={puppyName}
                    detail={`${puppy.sex || "Puppy"}${puppy.color ? ` · ${puppy.color}` : ""}${puppy.dob ? ` · DOB ${fmtDate(puppy.dob)}` : ""}`}
                  />
                  <PortalInfoTile
                    label="Photo Moments"
                    value={String(photoMoments)}
                    detail="Published updates that included photos."
                  />
                  <PortalInfoTile
                    label="Latest Payment"
                    value={
                      state.payments[0]?.payment_date
                        ? fmtDate(state.payments[0].payment_date)
                        : "No payment posted"
                    }
                    detail={state.payments[0] ? fmtMoney(state.payments[0].amount) : "Payment history will appear as soon as it is recorded."}
                    tone={state.payments[0] ? "success" : "neutral"}
                  />
                  <PortalInfoTile
                    label="Transportation"
                    value={state.pickupRequest ? requestTypeLabel(state.pickupRequest) : "Not requested"}
                    detail={
                      state.pickupRequest?.request_date
                        ? fmtDate(state.pickupRequest.request_date)
                        : "Scheduling details will appear here when requested."
                    }
                    tone={state.pickupRequest ? "warning" : "neutral"}
                  />
                </div>

                <div className="rounded-[28px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(243,248,253,0.95)_100%)] p-5 shadow-[0_14px_30px_rgba(23,35,56,0.05)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <PortalStatusBadge label={puppyStage} tone={puppy ? "success" : "neutral"} />
                    {state.messages[0]?.sender === "admin" ? (
                      <PortalStatusBadge label="Recent breeder activity" tone="warning" />
                    ) : null}
                  </div>
                  <div className="mt-4 text-sm leading-7 text-[var(--portal-text-soft)]">
                    {puppy.description ||
                      puppy.notes ||
                      "Your puppy page brings together the breeder timeline, wellness record, documents, payments, and next steps without making you jump across disconnected pages."}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <PortalHeroPrimaryAction href="/portal/mypuppy">Open My Puppy</PortalHeroPrimaryAction>
                    <PortalHeroSecondaryAction href="/portal/updates">Open Pupdates</PortalHeroSecondaryAction>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <PortalEmptyState
              title="A puppy profile will appear here when your account is matched."
              description="Until then, you can still use the portal for your application, messages, forms, and next steps."
              action={<PortalHeroPrimaryAction href="/portal/application">Open Application</PortalHeroPrimaryAction>}
            />
          )}
        </PortalPanel>

        <div className="space-y-6">
          <PortalPanel
            title="Upcoming Milestones"
            subtitle="The next visible milestone, wellness date, or transportation step appears here first."
          >
            {upcoming.length ? (
              <div className="space-y-4">
                {upcoming.map((entry) => (
                  <PortalListCard
                    key={entry.id}
                    label={entry.label}
                    title={entry.title}
                    description={entry.detail}
                    rightLabel={fmtDate(entry.date)}
                    tone={entry.tone}
                  />
                ))}
              </div>
            ) : (
              <PortalEmptyState
                title="No upcoming milestone published yet"
                description="The next milestone, wellness date, or transportation step will appear here as soon as it is on file."
              />
            )}
          </PortalPanel>

          <PortalPanel
            title="Quick Links"
            subtitle="Go directly to the pages most buyers open next."
          >
            <div className="grid gap-4">
              <PortalActionLink
                href="/portal/documents"
                eyebrow="Documents"
                title="Review forms and records"
                detail="Open documents, signatures, and shared account files."
              />
              <PortalActionLink
                href="/portal/payments"
                eyebrow="Payments"
                title="Check balance and history"
                detail="See recorded payments, due dates, and any remaining balance."
              />
              <PortalActionLink
                href="/portal/resources"
                eyebrow="Resources"
                title="Open the library"
                detail="Review Chihuahua guidance, care information, and portal support material."
              />
            </div>
          </PortalPanel>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.18fr)_380px]">
        <div className="space-y-6">
          <PortalPanel
            title="Recent Activity"
            subtitle="A single feed of the latest breeder replies, milestone posts, and wellness records keeps the homepage useful instead of repetitive."
          >
            {activity.length ? (
              <div className="space-y-4">
                {activity.map((entry) => (
                  <PortalListCard
                    key={entry.id}
                    label={entry.label}
                    title={entry.title}
                    description={entry.detail}
                    rightLabel={fmtDate(entry.date)}
                    tone={entry.tone}
                  />
                ))}
              </div>
            ) : (
              <PortalEmptyState
                title="No recent activity yet"
                description="As messages, breeder updates, milestones, and wellness records are added, they will appear here."
              />
            )}
          </PortalPanel>

          <PortalPanel
            title="Records Needing Attention"
            subtitle="Only the items that still need review or action belong here."
          >
            {attentionCards.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {attentionCards.map((entry) => (
                  <PortalListCard
                    key={entry.id}
                    label={entry.label}
                    title={entry.title}
                    description={entry.description}
                    rightLabel={entry.rightLabel}
                    tone={entry.tone}
                  />
                ))}
              </div>
            ) : (
              <PortalEmptyState
                title="Nothing needs immediate attention"
                description="Your key records look settled right now. New items will appear here when something changes."
              />
            )}
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel
            title="At a Glance"
            subtitle="The operational summary stays concise so the page remains easy to scan."
          >
            <div className="grid gap-4">
              <PortalInfoTile
                label="Unread Messages"
                value={String(unreadBreederMessages)}
                detail="Breeder replies waiting in Messages."
                tone={unreadBreederMessages ? "warning" : "neutral"}
              />
              <PortalInfoTile
                label="Open Documents"
                value={String(openDocuments.length)}
                detail="Shared files and records still active on your account."
              />
              <PortalInfoTile
                label="Saved Attachments"
                value={String(totalAttachments)}
                detail="Files uploaded with portal forms or records."
              />
              <PortalInfoTile
                label="Transportation Status"
                value={state.pickupRequest ? requestStatusLabel(state.pickupRequest) : "Not scheduled"}
                detail={state.pickupRequest ? requestTypeLabel(state.pickupRequest) : "No transportation request recorded yet."}
                tone={state.pickupRequest ? "success" : "neutral"}
              />
            </div>
          </PortalPanel>

          <PortalPanel
            title="What to open next"
            subtitle="A clearer path to the pages that usually matter most after the homepage."
          >
            <div className="space-y-3">
              <ActionRow
                icon={<ShieldCheck className="h-4 w-4" />}
                href="/portal/mypuppy"
                title="My Puppy"
                detail="Open the photo-led puppy profile, weights, timeline, and wellness history."
              />
              <ActionRow
                icon={<MessageCircle className="h-4 w-4" />}
                href="/portal/messages"
                title="Messages"
                detail="Review breeder replies or send account-specific questions."
              />
              <ActionRow
                icon={<CreditCard className="h-4 w-4" />}
                href="/portal/payments"
                title="Payments"
                detail="Check the recorded payment history, financing, and balance."
              />
              <ActionRow
                icon={<Route className="h-4 w-4" />}
                href="/portal/transportation"
                title="Transportation"
                detail="View transportation status, request details, and scheduling progress."
              />
            </div>
          </PortalPanel>
        </div>
      </section>
    </div>
  );
}

function ActionRow({
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
    <a
      href={href}
      className="flex items-start gap-3 rounded-[22px] border border-[var(--portal-border)] bg-white px-4 py-4 shadow-[0_10px_22px_rgba(23,35,56,0.05)] transition hover:-translate-y-0.5 hover:border-[var(--portal-border-strong)]"
    >
      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--portal-surface-muted)] text-[var(--portal-accent-strong)]">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[var(--portal-text)]">{title}</div>
        <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
      </div>
    </a>
  );
}
