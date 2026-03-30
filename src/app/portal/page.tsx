"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import {
  CalendarClock,
  MessageCircle,
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
  portalStatusTone,
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
  if (!request?.request_type) return "No transportation request yet";
  return String(request.request_type)
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function topMilestones(
  events: PortalPuppyEvent[],
  health: PortalHealthRecord[],
  request: PortalPickupRequest | null
) {
  const milestones: Array<{
    id: string;
    label: string;
    title: string;
    detail: string;
    date: string;
    tone: "neutral" | "success" | "warning";
  }> = [
    ...health
      .filter((entry) => entry.next_due_date)
      .map((entry) => ({
        id: `health-${entry.id}`,
        label: "Wellness",
        title: entry.title,
        detail: entry.description || "Upcoming wellness item on your puppy journey.",
        date: entry.next_due_date as string,
        tone: "success" as const,
      })),
    ...events.map((entry) => ({
      id: `event-${entry.id}`,
      label: "Journey",
      title: entry.title || entry.label || "Breeder update",
      detail: entry.summary || entry.details || "A new breeder update was published.",
      date: entry.event_date,
      tone: "neutral" as const,
    })),
  ]
    .filter((item) => !!item.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (request?.request_date) {
    milestones.unshift({
      id: `transport-${request.id}`,
      label: "Transportation",
      title: requestTypeLabel(request),
      detail: request.location_text || request.address_text || "Transportation request on file.",
      date: request.request_date,
      tone: "warning" as const,
    });
  }

  return milestones.slice(0, 4);
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
  const documentsNeedingAttention: Array<{
    id: string;
    label: string;
    title: string;
    description: string;
    rightLabel: string;
    tone: "neutral" | "success" | "warning" | "danger";
  }> = [
    ...draftForms.map((form) => ({
      id: `form-${form.id}`,
      label: "Draft Form",
      title: form.form_title || form.form_key,
      description: form.submitted_at
        ? `Submitted ${fmtDate(form.submitted_at)}`
        : "Saved in the portal and ready for review or submission.",
      rightLabel: form.updated_at ? fmtDate(form.updated_at) : fmtDate(form.created_at || ""),
      tone: "warning" as const,
    })),
    ...state.documents
      .filter((document) => String(document.status || "").toLowerCase() !== "completed")
      .slice(0, 3)
      .map((document) => ({
        id: `document-${document.id}`,
        label: document.category || "Document",
        title: document.title || "Portal record",
        description: document.description || "A record is available in your portal.",
        rightLabel: document.created_at ? fmtDate(document.created_at) : "Now",
        tone: portalStatusTone(document.status) as "neutral" | "success" | "warning" | "danger",
      })),
  ].slice(0, 4);

  const timeline: Array<{
    id: string;
    date: string;
    title: string;
    detail: string;
    label: string;
    tone: "neutral" | "success";
  }> = [...state.events, ...state.health]
    .map((item) => {
      const isHealth = "record_type" in item;
      return {
        id: `${isHealth ? "health" : "event"}-${item.id}`,
        date: isHealth ? item.record_date : item.event_date,
        title: isHealth ? item.title : item.title || item.label || "Breeder update",
        detail: isHealth
          ? item.description || "A wellness update has been added to your puppy journey."
          : item.summary || item.details || "A new breeder update has been published.",
        label: isHealth ? "Wellness" : "Journey",
        tone: (isHealth ? "success" : "neutral") as "success" | "neutral",
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 4);

  const upcoming = topMilestones(state.events, state.health, state.pickupRequest);
  const totalAttachments = state.forms.reduce(
    (sum, form) => sum + countAttachments(form.attachments),
    0
  );
  const photoMoments = state.events.reduce(
    (sum, event) => sum + attachmentPhotoCount(event.photos) + (event.photo_url ? 1 : 0),
    0
  );
  const puppyStage = puppy
    ? String(puppy.status || "").toLowerCase().includes("home")
      ? "At Home"
      : String(puppy.status || "").toLowerCase().includes("matched") ||
          String(puppy.status || "").toLowerCase().includes("reserved") ||
          String(puppy.status || "").toLowerCase().includes("sold")
        ? "Matched"
        : "Growing With Breeder"
    : "Waiting for Match";

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Overview"
        title={`Welcome back, ${displayName}`}
        description="View your puppy updates, milestones, documents, payments, messages, and transportation details in one place."
        actions={
          <>
            <PortalHeroPrimaryAction href={puppy ? "/portal/mypuppy" : "/portal/application"}>
              {puppy ? "Open My Puppy" : "Open Application"}
            </PortalHeroPrimaryAction>
            <PortalHeroSecondaryAction href="/portal/messages">
              Open Messages
            </PortalHeroSecondaryAction>
          </>
        }
        aside={
          <div className="overflow-hidden rounded-[28px] border border-[var(--portal-border)] bg-[var(--portal-surface-strong)] shadow-[0_18px_40px_rgba(31,48,79,0.08)]">
            <div className="relative aspect-[5/4] overflow-hidden">
              <Image
                src={puppyImage}
                alt={puppy ? puppyName : "Southwest Virginia Chihuahua"}
                fill
                sizes="(max-width: 1280px) 100vw, 360px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,29,48,0.04)_0%,rgba(17,29,48,0.56)_100%)]" />
              <div className="absolute inset-x-4 bottom-4 rounded-[22px] border border-white/35 bg-[rgba(245,249,255,0.18)] p-4 backdrop-blur-md">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/78">
                  My Puppy
                </div>
                <div className="mt-2 text-xl font-semibold tracking-[-0.02em] text-white">
                  {puppy ? puppyName : "Waiting for Match"}
                </div>
                <div className="mt-1 text-sm leading-6 text-white/85">
                  {puppy
                    ? `${puppyStage}. Open the puppy profile for photos, milestones, wellness records, and breeder notes.`
                    : "Your matched puppy profile will appear here once the breeder links it to your account."}
                </div>
              </div>
            </div>
          </div>
        }
      />

      <PortalMetricGrid>
        <PortalMetricCard
          label="My Puppy"
          value={puppy ? puppyName : "Waiting for Match"}
          detail={
            puppy
              ? "Open the full puppy profile, milestones, growth, and care guidance."
              : "Your puppy profile will appear here once your match is linked."
          }
          href="/portal/mypuppy"
          actionLabel="Open My Puppy"
        />
        <PortalMetricCard
          label="Unread Messages"
          value={String(unreadBreederMessages)}
          detail="Breeder replies still waiting for your review."
          href="/portal/messages"
          actionLabel="Open Messages"
          accent="from-[#dfe6fb] via-[#b8c7f7] to-[#7388d9]"
        />
        <PortalMetricCard
          label="Payment Summary"
          value={remaining !== null && remaining !== undefined ? fmtMoney(remaining) : "No balance shown"}
          detail={
            price
              ? `${fmtMoney(paid)} recorded toward ${fmtMoney(price)}`
              : "Open Payments for your account summary and financing details."
          }
          href="/portal/payments"
          actionLabel="Open Payments"
          accent="from-[#d9eef4] via-[#acd4e2] to-[#6da8bd]"
        />
        <PortalMetricCard
          label="Records"
          value={`${state.forms.length + state.documents.length}`}
          detail={`${totalAttachments} attachment${totalAttachments === 1 ? "" : "s"} and ${photoMoments} photo moment${photoMoments === 1 ? "" : "s"} saved in the portal.`}
          href="/portal/documents"
          actionLabel="Open Documents"
          accent="from-[#e7ebf2] via-[#cfd8e6] to-[#8ea0b9]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.12fr)_390px]">
        <div className="space-y-6">
          <PortalPanel
            title="Recent Puppy Journey"
            subtitle="Recent breeder notes and wellness records tied to your account."
          >
            {timeline.length ? (
              <div className="space-y-4">
                {timeline.map((item) => (
                  <PortalListCard
                    key={item.id}
                    label={item.label}
                    title={item.title}
                    description={item.detail}
                    rightLabel={fmtDate(item.date)}
                    tone={item.tone}
                  />
                ))}
              </div>
            ) : (
              <PortalEmptyState
                title="No journey updates yet"
                description="When breeder notes, wellness records, or milestone updates are ready, they will appear here automatically."
                action={<PortalHeroSecondaryAction href="/portal/messages">Ask for an update</PortalHeroSecondaryAction>}
              />
            )}
          </PortalPanel>

          <PortalPanel
            title="Upcoming Milestones"
            subtitle="The next visible dates, milestones, or transportation details on your account."
          >
            {upcoming.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {upcoming.map((item) => (
                  <PortalInfoTile
                    key={item.id}
                    label={item.label}
                    value={item.title}
                    detail={`${fmtDate(item.date)} - ${item.detail}`}
                    tone={item.tone}
                  />
                ))}
              </div>
            ) : (
              <PortalEmptyState
                title="No upcoming milestones yet"
                description="As transportation, wellness, or breeder milestones are scheduled, they will appear here."
              />
            )}
          </PortalPanel>

          <PortalPanel
            title="Quick Actions"
            subtitle="Open the places you are most likely to need next."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <PortalActionLink
                href="/portal/application"
                eyebrow="Application"
                title={application?.status || "Review application"}
                detail="Keep buyer details, preferences, and declarations current."
              />
              <PortalActionLink
                href="/portal/updates"
                eyebrow="Pupdates"
                title={timeline[0]?.title || "See the latest journey update"}
                detail="Breeder updates, wellness notes, and milestones live here."
              />
              <PortalActionLink
                href="/portal/transportation"
                eyebrow="Transportation"
                title={requestTypeLabel(state.pickupRequest)}
                detail="Review current plans for pickup, meet-up, delivery, or travel."
              />
              <PortalActionLink
                href="/portal/resources"
                eyebrow="Resources"
                title="Helpful guidance"
                detail="Open curated care, health, and breeder support resources."
              />
            </div>
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel
            title="Puppy Snapshot"
            subtitle="The most important profile details surfaced first."
          >
            <div className="space-y-4">
              <PortalInfoTile
                label="Journey Stage"
                value={puppyStage}
                detail={puppy ? "Your puppy profile is linked to this portal." : "The breeder will link your puppy here once matched."}
                tone={puppy ? "success" : "warning"}
              />
              <PortalInfoTile
                label="Application"
                value={application?.status || "Not started"}
                detail={
                  application?.created_at
                    ? `Submitted ${fmtDate(application.created_at)}`
                    : "Use the portal to start or update your buyer application."
                }
                tone={portalStatusTone(application?.status)}
              />
              <PortalInfoTile
                label="Latest Wellness"
                value={state.health[0]?.title || "No record yet"}
                detail={
                  state.health[0]?.record_date
                    ? fmtDate(state.health[0].record_date)
                    : "Wellness updates will appear here when published."
                }
                tone={state.health[0] ? "success" : "neutral"}
              />
              <PortalInfoTile
                label="Transportation"
                value={requestStatusLabel(state.pickupRequest)}
                detail={
                  state.pickupRequest?.request_date
                    ? `${requestTypeLabel(state.pickupRequest)} on ${fmtDate(state.pickupRequest.request_date)}`
                    : "No transportation request has been saved yet."
                }
                tone={state.pickupRequest ? portalStatusTone(state.pickupRequest.status) : "neutral"}
              />
            </div>
          </PortalPanel>

          <PortalPanel
            title="Documents Needing Attention"
            subtitle="Draft forms and active records that still need attention."
          >
            {documentsNeedingAttention.length ? (
              <div className="space-y-4">
                {documentsNeedingAttention.map((item) => (
                  <PortalListCard
                    key={item.id}
                    label={item.label}
                    title={item.title}
                    description={item.description}
                    rightLabel={item.rightLabel}
                    tone={item.tone}
                  />
                ))}
              </div>
            ) : (
              <PortalEmptyState
                title="Everything looks current"
                description="There are no draft forms or portal records needing attention right now."
              />
            )}
          </PortalPanel>

          <PortalPanel
            title="Alerts & Readiness"
            subtitle="The items most likely to affect your next step."
          >
            <div className="space-y-3">
              <InsightCard
                icon={<MessageCircle className="h-4 w-4" />}
                title="Unread messages"
                detail={
                  unreadBreederMessages
                    ? `${unreadBreederMessages} breeder message${unreadBreederMessages === 1 ? "" : "s"} still waiting for review.`
                    : "Your breeder conversation is fully caught up right now."
                }
              />
              <InsightCard
                icon={<CalendarClock className="h-4 w-4" />}
                title="Next milestone"
                detail={
                  upcoming[0]
                    ? `${upcoming[0].title} is the next visible milestone on your portal.`
                    : "As your next milestone is published, it will appear here first."
                }
              />
              <InsightCard
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Account status"
                detail={
                  documentsNeedingAttention.length
                    ? `${documentsNeedingAttention.length} record${documentsNeedingAttention.length === 1 ? "" : "s"} currently needs review.`
                    : "Your key records and messages look current right now."
                }
              />
            </div>
          </PortalPanel>
        </div>
      </section>
    </div>
  );
}

function InsightCard({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[20px] border border-[var(--portal-border)] bg-[var(--portal-surface-strong)] px-4 py-4 shadow-[0_10px_22px_rgba(31,48,79,0.05)]">
      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--portal-surface-muted)] text-[var(--portal-accent-strong)]">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-[var(--portal-text)]">{title}</div>
        <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
      </div>
    </div>
  );
}
