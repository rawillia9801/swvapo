"use client";

import Image from "next/image";
import Link from "next/link";
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
  Receipt,
  Scale,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Truck,
} from "lucide-react";
import { buildPuppyPhotoUrl, fmtDate, fmtMoney } from "@/lib/utils";
import {
  findBuyerPayments,
  findHealthRecords,
  findLatestPickupRequestForUser,
  findPortalDocumentsForUser,
  findPortalMessagesForUser,
  findPuppyEvents,
  findPuppyWeights,
  loadPortalContext,
  paymentCountsTowardBalance,
  portalDisplayName,
  portalPuppyName,
  portalStatusTone,
  type PortalApplication,
  type PortalBuyer,
  type PortalDocument,
  type PortalHealthRecord,
  type PortalMessage,
  type PortalPayment,
  type PortalPickupRequest,
  type PortalPuppy,
  type PortalPuppyEvent,
  type PortalPuppyWeight,
} from "@/lib/portal-data";
import { usePortalSession } from "@/hooks/use-portal-session";
import { PortalAccessExperience } from "@/components/portal/overview/portal-access-experience";

type OverviewState = {
  displayName: string;
  buyer: PortalBuyer | null;
  application: PortalApplication | null;
  puppy: PortalPuppy | null;
  puppyName: string;
  puppyImage: string;
  messages: PortalMessage[];
  documents: PortalDocument[];
  payments: PortalPayment[];
  pickupRequest: PortalPickupRequest | null;
  puppyEvents: PortalPuppyEvent[];
  healthRecords: PortalHealthRecord[];
  puppyWeights: PortalPuppyWeight[];
  salePrice: number | null;
};

type AttentionItem = {
  key: string;
  eyebrow: string;
  title: string;
  detail: string;
  href: string;
  action: string;
};

type JourneyStage = {
  key: string;
  label: string;
  detail: string;
  href: string;
  tone: "complete" | "current" | "upcoming";
};

type BriefingItem = {
  key: string;
  label: string;
  title: string;
  detail: string;
  dateText: string;
  href: string;
};

type TimelineItem = {
  id: string;
  label: string;
  title: string;
  detail: string;
  dateText: string;
  dateValue: string;
  href: string;
};

type ChapterSummary = {
  eyebrow: string;
  title: string;
  description: string;
  nextLine: string;
};

const fallbackPuppyImage = "https://www.swvachihuahua.com/pics/fancy.jpg";
const surfaceClass =
  "rounded-[2rem] border border-[rgba(188,162,133,0.22)] bg-white/96 shadow-[0_22px_56px_rgba(88,67,44,0.08)]";

function emptyState(): OverviewState {
  return {
    displayName: "there",
    buyer: null,
    application: null,
    puppy: null,
    puppyName: "your puppy",
    puppyImage: fallbackPuppyImage,
    messages: [],
    documents: [],
    payments: [],
    pickupRequest: null,
    puppyEvents: [],
    healthRecords: [],
    puppyWeights: [],
    salePrice: null,
  };
}

function readMoney(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
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

function dateValue(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function previewText(value: string | null | undefined, max = 160) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}...`;
}

function formatStatusLabel(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) return "On file";
  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatOptionalDate(value: string | null | undefined, fallback = "Not scheduled") {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return fmtDate(value);
}

function transportRequestComplete(request: PortalPickupRequest | null) {
  const status = String(request?.status || "").toLowerCase();
  return ["complete", "completed", "delivered", "picked up", "fulfilled"].some((word) =>
    status.includes(word)
  );
}

function latestDateText(value: string | null | undefined, fallback = "Waiting to be scheduled") {
  return formatOptionalDate(value, fallback);
}

function formatWeight(weight: PortalPuppyWeight | null) {
  if (!weight) return "No weight logged yet";
  if (weight.weight_oz != null) return `${Number(weight.weight_oz).toFixed(1)} oz`;
  if (weight.weight_g != null) return `${Math.round(Number(weight.weight_g))} g`;
  return "No weight logged yet";
}

function documentNeedsAttention(document: PortalDocument) {
  const status = String(document.status || "").toLowerCase();
  if (!status) return true;
  return !["completed", "signed", "ready", "received"].includes(status);
}

function paymentSummaryLabel(payments: PortalPayment[], salePrice: number | null, totalPaid: number) {
  if (!payments.length) return "No payments recorded yet";
  if (salePrice != null && totalPaid >= salePrice) return "Paid in full";
  return `${payments.length} payment${payments.length === 1 ? "" : "s"} recorded`;
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
        const [messages, documents, payments, pickupRequest, puppyEvents, healthRecords, puppyWeights] =
          await Promise.all([
            findPortalMessagesForUser(user, 20),
            findPortalDocumentsForUser(user, context.buyer),
            findBuyerPayments(context.buyer?.id),
            findLatestPickupRequestForUser(user),
            findPuppyEvents(context.puppy?.id),
            findHealthRecords(context.puppy?.id),
            findPuppyWeights(context.puppy?.id),
          ]);

        if (!active) return;

        setState({
          displayName: portalDisplayName(user, context.buyer, context.application),
          buyer: context.buyer,
          application: context.application,
          puppy: context.puppy,
          puppyName: portalPuppyName(context.puppy) || "your puppy",
          puppyImage:
            buildPuppyPhotoUrl(context.puppy?.image_url || context.puppy?.photo_url || "") ||
            fallbackPuppyImage,
          messages,
          documents,
          payments,
          pickupRequest,
          puppyEvents,
          healthRecords,
          puppyWeights,
          salePrice: readMoney(context.buyer?.sale_price ?? context.puppy?.price ?? context.puppy?.list_price),
        });
      } catch (error) {
        console.error("Could not load portal overview:", error);
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

  const openDocuments = useMemo(
    () => state.documents.filter((entry) => documentNeedsAttention(entry)).length,
    [state.documents]
  );

  const paymentTotal = useMemo(
    () =>
      state.payments
        .filter((payment) => paymentCountsTowardBalance(payment.status))
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [state.payments]
  );

  const latestPayment = useMemo(() => {
    return [...state.payments].sort((left, right) => {
      return (
        dateValue(readFirstDate(right, ["payment_date", "created_at"])) -
        dateValue(readFirstDate(left, ["payment_date", "created_at"]))
      );
    })[0] || null;
  }, [state.payments]);

  const latestAdminMessage = useMemo(() => {
    return [...state.messages]
      .filter((entry) => entry.sender === "admin")
      .sort(
        (left, right) =>
          dateValue(readFirstDate(right, ["created_at", "sent_at", "updated_at"])) -
          dateValue(readFirstDate(left, ["created_at", "sent_at", "updated_at"]))
      )[0] || null;
  }, [state.messages]);

  const latestDocument = useMemo(() => {
    return [...state.documents].sort(
      (left, right) =>
        dateValue(readFirstDate(right, ["created_at", "updated_at"])) -
        dateValue(readFirstDate(left, ["created_at", "updated_at"]))
    )[0] || null;
  }, [state.documents]);

  const latestEvent = state.puppyEvents[0] || null;
  const latestHealth = state.healthRecords[0] || null;
  const latestWeight = state.puppyWeights[0] || null;

  const remainingBalance =
    state.salePrice != null ? Math.max(0, state.salePrice - paymentTotal) : 0;

  const paymentProgress =
    state.salePrice && state.salePrice > 0
      ? Math.min(100, Math.max(0, Math.round((paymentTotal / state.salePrice) * 100)))
      : 0;

  const buyerStatusText =
    formatStatusLabel(state.buyer?.status || state.application?.status || "On file");
  const buyerStatusTone = portalStatusTone(state.buyer?.status || state.application?.status);

  const applicationComplete = Boolean(state.application?.id);
  const puppyLinked = Boolean(state.puppy?.id);
  const documentsComplete = state.documents.length > 0 && openDocuments === 0;
  const paymentsStarted = state.payments.length > 0;
  const paymentsComplete = state.salePrice != null ? remainingBalance <= 0 && paymentsStarted : paymentsStarted;
  const transportationSet = Boolean(state.pickupRequest?.request_date);
  const homecomingComplete = transportRequestComplete(state.pickupRequest);

  const journeyStages = useMemo<JourneyStage[]>(() => {
    const stages: JourneyStage[] = [
      {
        key: "application",
        label: "Application",
        detail: applicationComplete
          ? `Received ${formatOptionalDate(state.application?.created_at, "On file")}`
          : "Tell us about your family and preferred puppy fit.",
        href: "/portal/application",
        tone: applicationComplete ? "complete" : "current",
      },
      {
        key: "match",
        label: "Reservation & Match",
        detail: puppyLinked
          ? `${state.puppyName} is linked to your account.`
          : "Once your match is confirmed, your puppy details appear here.",
        href: "/portal/mypuppy",
        tone: puppyLinked ? "complete" : applicationComplete ? "current" : "upcoming",
      },
      {
        key: "documents",
        label: "Documents",
        detail: documentsComplete
          ? "Your current paperwork is organized in the portal."
          : state.documents.length
            ? `${openDocuments} document${openDocuments === 1 ? "" : "s"} still need review.`
            : "Contracts, forms, and breeder records will post here.",
        href: "/portal/documents",
        tone: documentsComplete ? "complete" : puppyLinked ? "current" : "upcoming",
      },
      {
        key: "payments",
        label: "Payments",
        detail: paymentsComplete
          ? paymentSummaryLabel(state.payments, state.salePrice, paymentTotal)
          : paymentsStarted
            ? `${fmtMoney(paymentTotal)} posted so far.`
            : "Payment activity and financing details stay here.",
        href: "/portal/payments",
        tone:
          paymentsComplete
            ? "complete"
            : puppyLinked && (documentsComplete || paymentsStarted || state.salePrice != null)
              ? "current"
              : "upcoming",
      },
      {
        key: "transportation",
        label: "Transportation",
        detail: transportationSet
          ? `${formatStatusLabel(state.pickupRequest?.request_type)} requested for ${latestDateText(
              state.pickupRequest?.request_date,
              "On file"
            )}.`
          : "Pickup or delivery planning will land here when you are ready.",
        href: "/portal/transportation",
        tone:
          transportationSet
            ? "complete"
            : paymentsComplete
              ? "current"
              : "upcoming",
      },
      {
        key: "homecoming",
        label: "Go-Home & Support",
        detail: homecomingComplete
          ? "Your account stays open for records, resources, and breeder support."
          : transportationSet
            ? "You are moving into final preparation for homecoming."
            : "Care resources, updates, and support remain here beyond pickup day.",
        href: "/portal/resources",
        tone: homecomingComplete ? "complete" : transportationSet ? "current" : "upcoming",
      },
    ];

    return stages;
  }, [
    applicationComplete,
    documentsComplete,
    homecomingComplete,
    openDocuments,
    paymentTotal,
    paymentsComplete,
    paymentsStarted,
    puppyLinked,
    state.application?.created_at,
    state.documents.length,
    state.payments,
    state.pickupRequest?.request_date,
    state.pickupRequest?.request_type,
    state.puppyName,
    state.salePrice,
    transportationSet,
  ]);

  const currentStage = useMemo(() => {
    return (
      journeyStages.find((stage) => stage.tone === "current") ||
      journeyStages[journeyStages.length - 1]
    );
  }, [journeyStages]);

  const journeyProgress = useMemo(() => {
    const stageScore = journeyStages.reduce((sum, stage) => {
      if (stage.tone === "complete") return sum + 1;
      if (stage.tone === "current") return sum + 0.55;
      return sum;
    }, 0);

    return Math.round((stageScore / journeyStages.length) * 100);
  }, [journeyStages]);

  const chapter = useMemo<ChapterSummary>(() => {
    if (!applicationComplete) {
      return {
        eyebrow: "Begin the journey",
        title: "Your first step is getting your buyer file on record.",
        description:
          "Complete your application so Southwest Virginia Chihuahua can review your family, preferences, and placement needs.",
        nextLine: "Once your application is submitted, your match and breeder paperwork can move forward here.",
      };
    }

    if (!puppyLinked) {
      return {
        eyebrow: "Awaiting your puppy match",
        title: "Your buyer file is open and ready for the next chapter.",
        description:
          "As soon as your puppy is linked to this portal, your profile, updates, and go-home planning will begin to fill in around it.",
        nextLine: "Watch for a breeder message or profile update confirming your match.",
      };
    }

    if (!documentsComplete) {
      return {
        eyebrow: "Paperwork chapter",
        title: "Your documents are the clearest next step right now.",
        description:
          "Contracts, records, and portal paperwork are where your journey is currently centered. Keeping those reviewed makes the rest of the process smoother.",
        nextLine: "Once documents are in good shape, payments and transportation become the main focus.",
      };
    }

    if (!paymentsComplete) {
      return {
        eyebrow: "Account clarity",
        title: "Your payment journey is the active chapter right now.",
        description:
          "You can review posted payments, financing progress, and any remaining balance in one calm place before homecoming planning picks up.",
        nextLine: "When your account is caught up, transportation and go-home prep move to the front.",
      };
    }

    if (!transportationSet) {
      return {
        eyebrow: "Planning the handoff",
        title: "Transportation is the next piece to confirm.",
        description:
          "Pickup or delivery details keep the portal aligned with where, when, and how your puppy will come home.",
        nextLine: "Once transportation is on file, this portal becomes your go-home and support center.",
      };
    }

    return {
      eyebrow: "Homecoming preparation",
      title: "You are moving through the final stretch of the journey.",
      description:
        "This is the point where updates, records, transportation, and support all come together around your puppy's transition home.",
      nextLine: "Keep an eye on breeder messages, wellness notes, and your puppy's profile as go-home day approaches.",
    };
  }, [
    applicationComplete,
    documentsComplete,
    paymentsComplete,
    puppyLinked,
    transportationSet,
  ]);

  const nextImportantDate = useMemo(() => {
    if (state.buyer?.finance_next_due_date) {
      return {
        label: "Next due date",
        value: formatOptionalDate(state.buyer.finance_next_due_date, "Not scheduled"),
      };
    }

    if (state.pickupRequest?.request_date) {
      return {
        label: "Transportation date",
        value: formatOptionalDate(state.pickupRequest.request_date, "Not scheduled"),
      };
    }

    if (latestPayment?.payment_date) {
      return {
        label: "Latest payment",
        value: formatOptionalDate(latestPayment.payment_date, "No payment date"),
      };
    }

    if (state.application?.created_at) {
      return {
        label: "Application received",
        value: formatOptionalDate(state.application.created_at, "Not on file"),
      };
    }

    return {
      label: "Journey status",
      value: "Getting started",
    };
  }, [
    latestPayment?.payment_date,
    state.application?.created_at,
    state.buyer?.finance_next_due_date,
    state.pickupRequest?.request_date,
  ]);

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];

    if (!applicationComplete) {
      items.push({
        key: "application",
        eyebrow: "Start here",
        title: "Complete your buyer application",
        detail: "This opens the rest of your journey and gives the breeder the information needed to move forward.",
        href: "/portal/application",
        action: "Open application",
      });
    }

    if (unreadMessages > 0) {
      items.push({
        key: "messages",
        eyebrow: "Breeder reply",
        title: `${unreadMessages} breeder message${unreadMessages === 1 ? "" : "s"} waiting`,
        detail: "Review the latest conversation so you do not miss an important update or next step.",
        href: "/portal/messages",
        action: "Read messages",
      });
    }

    if (openDocuments > 0 || (puppyLinked && state.documents.length === 0)) {
      items.push({
        key: "documents",
        eyebrow: "Paperwork",
        title:
          openDocuments > 0
            ? `Review ${openDocuments} document${openDocuments === 1 ? "" : "s"}`
            : "Check your document center",
        detail:
          openDocuments > 0
            ? "Your portal has paperwork that still needs attention or review."
            : "Contracts and breeder-shared records will stay organized here as they are posted.",
        href: "/portal/documents",
        action: "Open documents",
      });
    }

    if (state.salePrice != null && remainingBalance > 0) {
      items.push({
        key: "payments",
        eyebrow: "Account",
        title: `Review ${fmtMoney(remainingBalance)} remaining`,
        detail: "Your payment page shows posted payments, financing details, and the clearest view of your balance.",
        href: "/portal/payments",
        action: "Review payments",
      });
    } else if (!paymentsStarted && (state.salePrice != null || puppyLinked)) {
      items.push({
        key: "payments-start",
        eyebrow: "Account",
        title: "Open your payment overview",
        detail: "This is where posted payments and plan details appear as your buyer file moves forward.",
        href: "/portal/payments",
        action: "View payment page",
      });
    }

    if (!transportationSet && (paymentsStarted || paymentsComplete || puppyLinked)) {
      items.push({
        key: "transportation",
        eyebrow: "Planning",
        title: "Add pickup or delivery details",
        detail: "Transportation planning keeps your breeder and portal timeline aligned for homecoming.",
        href: "/portal/transportation",
        action: "Plan transportation",
      });
    }

    if (latestEvent || latestHealth || latestWeight) {
      items.push({
        key: "updates",
        eyebrow: "Puppy updates",
        title: "See the latest puppy notes and milestones",
        detail: "Breeder pupdates, wellness records, and growth tracking are all connected to your puppy's profile.",
        href: "/portal/updates",
        action: "Open updates",
      });
    }

    if (!items.length) {
      items.push(
        {
          key: "puppy",
          eyebrow: "Your puppy",
          title: "Visit your puppy profile",
          detail: "Photos, profile details, and account-connected puppy information all live there.",
          href: "/portal/mypuppy",
          action: "Open puppy profile",
        },
        {
          key: "messages-calm",
          eyebrow: "Stay connected",
          title: "Check messages for breeder updates",
          detail: "Even when everything is calm, your conversation history remains organized inside the portal.",
          href: "/portal/messages",
          action: "Open messages",
        }
      );
    }

    return items.slice(0, 3);
  }, [
    applicationComplete,
    latestEvent,
    latestHealth,
    latestWeight,
    openDocuments,
    paymentsComplete,
    paymentsStarted,
    puppyLinked,
    remainingBalance,
    state.documents.length,
    state.salePrice,
    transportationSet,
    unreadMessages,
  ]);

  const heroPrimaryAction = attentionItems[0] || null;

  const briefingItems = useMemo<BriefingItem[]>(() => {
    const items: BriefingItem[] = [];

    if (latestEvent) {
      items.push({
        key: `event-${latestEvent.id}`,
        label: "Breeder update",
        title: latestEvent.title || latestEvent.label || "New puppy update",
        detail: previewText(latestEvent.summary || latestEvent.details, 140) || "A new pupdate was shared for your puppy.",
        dateText: latestDateText(latestEvent.event_date, "Just posted"),
        href: "/portal/updates",
      });
    }

    if (latestHealth) {
      items.push({
        key: `health-${latestHealth.id}`,
        label: "Wellness record",
        title: latestHealth.title || formatStatusLabel(latestHealth.record_type),
        detail:
          previewText(latestHealth.description, 140) ||
          "A health or wellness record was added to your puppy's account.",
        dateText: latestDateText(latestHealth.record_date, "On file"),
        href: "/portal/resources",
      });
    }

    if (latestAdminMessage) {
      items.push({
        key: `message-${latestAdminMessage.id}`,
        label: "Recent message",
        title:
          readFirstText(latestAdminMessage, ["subject", "title"]) ||
          "A breeder message is waiting in your portal",
        detail:
          previewText(
            readFirstText(latestAdminMessage, ["message", "body", "content"]),
            140
          ) || "Open Messages to read the full conversation.",
        dateText: latestDateText(
          readFirstDate(latestAdminMessage, ["created_at", "sent_at", "updated_at"]),
          "On file"
        ),
        href: "/portal/messages",
      });
    }

    if (latestWeight) {
      items.push({
        key: `weight-${latestWeight.id}`,
        label: "Growth",
        title: `${state.puppyName} weight logged`,
        detail: `${formatWeight(latestWeight)}${latestWeight.age_weeks ? ` at ${latestWeight.age_weeks} weeks` : ""}${latestWeight.notes ? `, ${previewText(latestWeight.notes, 70)}` : ""}`,
        dateText: latestDateText(latestWeight.weigh_date, "On file"),
        href: "/portal/mypuppy",
      });
    }

    if (latestDocument) {
      items.push({
        key: `document-${latestDocument.id}`,
        label: "Document center",
        title:
          readFirstText(latestDocument, ["title", "file_name", "description"]) ||
          "Latest portal document",
        detail: latestDocument.description || "Your buyer paperwork stays organized in one place.",
        dateText: latestDateText(latestDocument.created_at, "On file"),
        href: "/portal/documents",
      });
    }

    return items
      .sort((left, right) => dateValue(right.dateText) - dateValue(left.dateText))
      .slice(0, 3);
  }, [
    latestAdminMessage,
    latestDocument,
    latestEvent,
    latestHealth,
    latestWeight,
    state.puppyName,
  ]);

  const puppyStoryText = useMemo(() => {
    if (latestEvent) {
      return (
        previewText(latestEvent.summary || latestEvent.details, 220) ||
        "A fresh breeder update has been posted for your puppy."
      );
    }

    if (latestHealth) {
      return (
        previewText(latestHealth.description, 220) ||
        `${latestHealth.title} was added to your puppy's wellness record.`
      );
    }

    if (state.puppy?.description || state.puppy?.notes) {
      return previewText(state.puppy.description || state.puppy.notes, 220);
    }

    if (state.puppy) {
      return "This is your puppy's space inside the portal. As the breeder posts updates, records, and milestones, they will gather here around your profile.";
    }

    return "As soon as your puppy is linked to this portal, this space becomes the center of photos, milestones, and breeder-shared notes.";
  }, [latestEvent, latestHealth, state.puppy]);

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];

    if (state.application?.created_at) {
      items.push({
        id: "application",
        label: "Application",
        title: "Buyer application received",
        detail: "Your application is on file with Southwest Virginia Chihuahua.",
        dateText: fmtDate(state.application.created_at),
        dateValue: state.application.created_at,
        href: "/portal/application",
      });
    }

    if (state.puppy?.created_at) {
      items.push({
        id: "puppy-linked",
        label: "Puppy profile",
        title: `${state.puppyName} was linked to your portal`,
        detail: "Your buyer file and puppy profile are connected.",
        dateText: fmtDate(state.puppy.created_at),
        dateValue: state.puppy.created_at,
        href: "/portal/mypuppy",
      });
    }

    state.documents.slice(0, 2).forEach((document, index) => {
      const value = readFirstDate(document, ["created_at", "updated_at"]);
      if (!value) return;
      items.push({
        id: `document-${document.id}-${index}`,
        label: "Document",
        title:
          readFirstText(document, ["title", "file_name", "description"]) || "Document added",
        detail: document.description || "A document was posted to your portal.",
        dateText: fmtDate(value),
        dateValue: value,
        href: "/portal/documents",
      });
    });

    state.payments.slice(0, 2).forEach((payment, index) => {
      if (!paymentCountsTowardBalance(payment.status)) return;
      items.push({
        id: `payment-${payment.id}-${index}`,
        label: "Payment",
        title: `${fmtMoney(Number(payment.amount || 0))} recorded`,
        detail:
          readFirstText(payment, ["payment_type", "method", "note"]) ||
          "A payment was added to your buyer account.",
        dateText: formatOptionalDate(payment.payment_date, "On file"),
        dateValue: payment.payment_date || payment.created_at,
        href: "/portal/payments",
      });
    });

    if (latestAdminMessage) {
      items.push({
        id: `message-${latestAdminMessage.id}`,
        label: "Breeder message",
        title:
          readFirstText(latestAdminMessage, ["subject", "title"]) ||
          "Breeder message posted",
        detail:
          previewText(readFirstText(latestAdminMessage, ["message", "body", "content"]), 130) ||
          "Open your message center to read the conversation.",
        dateText: formatOptionalDate(
          readFirstDate(latestAdminMessage, ["created_at", "sent_at", "updated_at"]),
          "On file"
        ),
        dateValue: readFirstDate(latestAdminMessage, ["created_at", "sent_at", "updated_at"]),
        href: "/portal/messages",
      });
    }

    if (latestEvent) {
      items.push({
        id: `event-${latestEvent.id}`,
        label: "Pupdate",
        title: latestEvent.title || latestEvent.label || "Breeder update posted",
        detail:
          previewText(latestEvent.summary || latestEvent.details, 130) ||
          "A new puppy update has been posted for your family.",
        dateText: formatOptionalDate(latestEvent.event_date, "On file"),
        dateValue: latestEvent.event_date,
        href: "/portal/updates",
      });
    }

    if (latestHealth) {
      items.push({
        id: `health-${latestHealth.id}`,
        label: "Wellness",
        title: latestHealth.title || formatStatusLabel(latestHealth.record_type),
        detail:
          previewText(latestHealth.description, 130) ||
          "A health record was shared to your puppy's account.",
        dateText: formatOptionalDate(latestHealth.record_date, "On file"),
        dateValue: latestHealth.record_date,
        href: "/portal/resources",
      });
    }

    if (state.pickupRequest?.request_date) {
      items.push({
        id: `pickup-${state.pickupRequest.id}`,
        label: "Transportation",
        title: "Pickup or delivery request added",
        detail:
          readFirstText(state.pickupRequest, ["location_text", "address_text", "notes"]) ||
          "Transportation planning is now on file inside your portal.",
        dateText: formatOptionalDate(state.pickupRequest.request_date, "On file"),
        dateValue: state.pickupRequest.request_date || state.pickupRequest.created_at || "",
        href: "/portal/transportation",
      });
    }

    return items
      .sort((left, right) => dateValue(right.dateValue) - dateValue(left.dateValue))
      .slice(0, 7);
  }, [
    latestAdminMessage,
    latestEvent,
    latestHealth,
    state.application?.created_at,
    state.documents,
    state.payments,
    state.pickupRequest,
    state.puppy?.created_at,
    state.puppyName,
  ]);

  if (sessionLoading || loading) {
    return <PortalOverviewLoading />;
  }

  if (!user) {
    return <PortalAccessExperience />;
  }

  return (
    <div className="space-y-5 pb-8">
      <section className="relative overflow-hidden rounded-[2.4rem] border border-[rgba(190,164,132,0.28)] bg-[linear-gradient(135deg,rgba(255,251,245,0.98)_0%,rgba(248,238,225,0.96)_42%,rgba(247,249,252,0.98)_100%)] shadow-[0_28px_72px_rgba(88,67,44,0.10)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-10 top-0 h-56 w-56 rounded-full bg-[rgba(214,179,141,0.22)] blur-3xl" />
          <div className="absolute right-0 top-0 h-60 w-60 rounded-full bg-[rgba(182,201,228,0.18)] blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-[rgba(233,214,189,0.24)] blur-3xl" />
        </div>

        <div className="relative grid gap-8 px-6 py-7 md:px-8 md:py-8 xl:grid-cols-[minmax(0,1.05fr)_400px] xl:items-center">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(186,154,116,0.22)] bg-white/82 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)] shadow-sm backdrop-blur">
              <Sparkles className="h-4 w-4 text-[#b67744]" />
              Southwest Virginia Chihuahua portal
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <HeroBadge label={buyerStatusText} tone={buyerStatusTone} />
              <HeroBadge label={`${journeyProgress}% through your journey`} tone="neutral" />
              <HeroBadge label={currentStage.label} tone="warm" />
            </div>

            <h1 className="mt-5 text-[2.6rem] font-extrabold tracking-[-0.06em] text-[var(--portal-accent)] md:text-[3.25rem]">
              Welcome back, {state.displayName}
            </h1>

            <p className="mt-4 max-w-2xl text-[1.02rem] leading-8 text-[var(--portal-text-soft)]">
              This is your guided home base for everything connected to {state.puppyName}. You can see where your family is in the process, what needs attention next, and how your puppy&apos;s story is unfolding along the way.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              {heroPrimaryAction ? (
                <PrimaryJourneyLink href={heroPrimaryAction.href}>
                  {heroPrimaryAction.action}
                </PrimaryJourneyLink>
              ) : null}
              <SecondaryJourneyLink href="/portal/mypuppy">
                Visit puppy profile
              </SecondaryJourneyLink>
              <SecondaryJourneyLink href="/portal/messages">
                Open messages
              </SecondaryJourneyLink>
            </div>

            <div className="mt-7 grid gap-3 md:grid-cols-3">
              <HeroStat
                label="Current chapter"
                value={currentStage.label}
                detail={chapter.eyebrow}
                icon={<HeartHandshake className="h-4 w-4" />}
              />
              <HeroStat
                label={nextImportantDate.label}
                value={nextImportantDate.value}
                detail="The next dated milestone on your account"
                icon={<CalendarDays className="h-4 w-4" />}
              />
              <HeroStat
                label="Breeder messages"
                value={unreadMessages ? `${unreadMessages} unread` : "All caught up"}
                detail={unreadMessages ? "A response is waiting for you" : "No unread replies right now"}
                icon={<Mail className="h-4 w-4" />}
              />
            </div>
          </div>

          <div className="mx-auto w-full max-w-[400px] xl:mx-0 xl:justify-self-end">
            <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/92 shadow-[0_24px_60px_rgba(88,67,44,0.16)]">
              <div className="relative aspect-[4/5] overflow-hidden">
                <Image
                  src={state.puppyImage}
                  alt={state.puppyName}
                  fill
                  unoptimized
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(40,30,22,0.06)_0%,rgba(40,30,22,0.74)_100%)]" />

                <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/24 bg-white/14 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur-md">
                  <PawPrint className="h-4 w-4" />
                  {state.puppy ? "Your puppy profile" : "Your future puppy space"}
                </div>

                <div className="absolute inset-x-4 bottom-4 rounded-[1.5rem] border border-white/18 bg-white/14 p-4 text-white backdrop-blur-md">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/78">
                    {currentStage.label}
                  </div>
                  <div className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em]">
                    {state.puppyName}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-white/84">
                    {state.puppy
                      ? "Photos, milestones, wellness notes, and account details stay centered here for your family."
                      : "Once your puppy is officially linked, this space becomes your family's profile hub."}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <HeroGlassMetric
                      label="Documents"
                      value={
                        state.documents.length
                          ? `${state.documents.length} on file`
                          : "Waiting to post"
                      }
                    />
                    <HeroGlassMetric
                      label="Transportation"
                      value={transportationSet ? "Planned" : "Not scheduled"}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`${surfaceClass} overflow-hidden p-5 md:p-6`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
              Journey tracker
            </div>
            <h2 className="mt-2 text-[1.9rem] font-bold tracking-[-0.05em] text-[var(--portal-accent)]">
              Follow your Southwest Virginia Chihuahua journey
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--portal-text-soft)]">
              Each step below reflects the real records already tied to your portal account, so you can see what is complete, what is active, and what comes next.
            </p>
          </div>

          <div className="rounded-full border border-[rgba(188,162,133,0.24)] bg-[rgba(249,244,237,0.9)] px-4 py-2 text-sm font-semibold text-[var(--portal-text)]">
            {journeyProgress}% complete
          </div>
        </div>

        <div className="mt-5 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-3">
            {journeyStages.map((stage, index) => (
              <JourneyStageCard
                key={stage.key}
                index={index + 1}
                label={stage.label}
                detail={stage.detail}
                href={stage.href}
                tone={stage.tone}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.12fr)_380px]">
        <div className={`${surfaceClass} p-6 md:p-7`}>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                {chapter.eyebrow}
              </div>
              <h2 className="mt-2 text-[2rem] font-bold tracking-[-0.05em] text-[var(--portal-accent)]">
                {chapter.title}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-8 text-[var(--portal-text-soft)]">
                {chapter.description}
              </p>

              <div className="mt-5 rounded-[1.5rem] border border-[rgba(188,162,133,0.18)] bg-[linear-gradient(135deg,rgba(252,247,241,0.96)_0%,rgba(246,248,252,0.92)_100%)] p-5">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(214,179,141,0.22)] text-[#b67744]">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-[var(--portal-text)]">
                      What happens next
                    </div>
                    <div className="mt-2 text-sm leading-7 text-[var(--portal-text-soft)]">
                      {chapter.nextLine}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                What needs your attention now
              </div>
              <div className="mt-3 space-y-3">
                {attentionItems.map((item) => (
                  <AttentionActionCard key={item.key} item={item} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className={`${surfaceClass} p-5 md:p-6`}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
            Southwest Virginia Chihuahua briefing
          </div>
          <h2 className="mt-2 text-[1.55rem] font-bold tracking-[-0.04em] text-[var(--portal-accent)]">
            The latest from your portal
          </h2>
          <p className="mt-2 text-sm leading-7 text-[var(--portal-text-soft)]">
            A calm digest of the newest breeder update, recent account movement, and the places buyers return to most.
          </p>

          <div className="mt-5 space-y-3">
            {briefingItems.length ? (
              briefingItems.map((item) => <BriefingCard key={item.key} item={item} />)
            ) : (
              <CalmEmptyState
                title="No fresh updates yet"
                description="As messages, puppy notes, and records are posted to your account, the newest items will collect here."
              />
            )}
          </div>

          <div className="mt-6 border-t border-[rgba(188,162,133,0.16)] pt-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
              Quiet shortcuts
            </div>
            <div className="mt-3 space-y-2">
              <QuietJumpLink
                href="/portal/documents"
                icon={<FileText className="h-4 w-4" />}
                title="Document center"
                detail="Forms, contracts, and breeder-shared files"
              />
              <QuietJumpLink
                href="/portal/transportation"
                icon={<Truck className="h-4 w-4" />}
                title="Transportation"
                detail="Pickup or delivery planning"
              />
              <QuietJumpLink
                href="/portal/resources"
                icon={<HeartHandshake className="h-4 w-4" />}
                title="Care resources"
                detail="Go-home guidance and support materials"
              />
            </div>
          </div>
        </aside>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_420px]">
        <div className={`${surfaceClass} overflow-hidden`}>
          <div className="grid gap-0 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="relative min-h-[360px] overflow-hidden bg-[rgba(247,241,233,0.9)]">
              <Image
                src={state.puppyImage}
                alt={state.puppyName}
                fill
                unoptimized
                className="object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(39,27,18,0.04)_0%,rgba(39,27,18,0.66)_100%)]" />
              <div className="absolute inset-x-5 bottom-5 rounded-[1.4rem] border border-white/18 bg-white/14 p-4 text-white backdrop-blur-md">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/78">
                  Your puppy&apos;s space
                </div>
                <div className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em]">
                  {state.puppyName}
                </div>
                <div className="mt-2 text-sm leading-6 text-white/84">
                  {state.puppy
                    ? "A dedicated place for puppy details, milestones, wellness notes, and breeder updates."
                    : "This profile comes to life as soon as your puppy is linked to your portal account."}
                </div>
              </div>
            </div>

            <div className="p-6 md:p-7">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                Puppy story
              </div>
              <h2 className="mt-2 text-[1.9rem] font-bold tracking-[-0.05em] text-[var(--portal-accent)]">
                {state.puppy ? `${state.puppyName}'s account story` : "Your puppy profile will open here"}
              </h2>
              <p className="mt-3 text-sm leading-8 text-[var(--portal-text-soft)]">
                {puppyStoryText}
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <StoryFact
                  label="Litter"
                  value={state.puppy?.litter_name || "Not linked yet"}
                />
                <StoryFact
                  label="Birthday"
                  value={formatOptionalDate(state.puppy?.dob, "Not listed")}
                />
                <StoryFact
                  label="Current weight"
                  value={formatWeight(latestWeight)}
                />
                <StoryFact
                  label="Wellness"
                  value={latestHealth?.title || "No visible health note yet"}
                />
              </div>

              <div className="mt-5 grid gap-3">
                <HighlightNote
                  label="Latest breeder note"
                  title={
                    latestEvent?.title ||
                    latestEvent?.label ||
                    latestHealth?.title ||
                    "Your next puppy update will appear here"
                  }
                  detail={
                    previewText(
                      latestEvent?.summary ||
                        latestEvent?.details ||
                        latestHealth?.description ||
                        state.puppy?.notes ||
                        "",
                      155
                    ) ||
                    "When the breeder shares a milestone, wellness note, or pupdate, it will show up here."
                  }
                />
                <HighlightNote
                  label="Go-home readiness"
                  title={transportationSet ? "Transportation is on file" : "Transportation is still open"}
                  detail={
                    transportationSet
                      ? `${formatStatusLabel(state.pickupRequest?.request_type)} is requested for ${latestDateText(
                          state.pickupRequest?.request_date,
                          "your account"
                        )}.`
                      : "Pickup or delivery planning can be added as soon as your family is ready to lock in the handoff."
                  }
                />
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <SecondaryJourneyLink href="/portal/mypuppy">
                  Open puppy profile
                </SecondaryJourneyLink>
                <SecondaryJourneyLink href="/portal/updates">
                  View puppy updates
                </SecondaryJourneyLink>
              </div>
            </div>
          </div>
        </div>

        <div className={`${surfaceClass} p-6 md:p-7`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                Financial clarity
              </div>
              <h2 className="mt-2 text-[1.8rem] font-bold tracking-[-0.05em] text-[var(--portal-accent)]">
                A calm view of your account
              </h2>
            </div>

            <Link
              href="/portal/payments"
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(188,162,133,0.22)] bg-[rgba(249,244,237,0.9)] px-4 py-2 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[rgba(188,162,133,0.4)]"
            >
              Open payments
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <p className="mt-3 text-sm leading-7 text-[var(--portal-text-soft)]">
            Everything below reflects the real breeder account linked to your portal, so your numbers feel transparent, reassuring, and easy to trust.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <FinanceTile
              label="Listed price"
              value={state.salePrice != null ? fmtMoney(state.salePrice) : "Not posted yet"}
              detail="The current sale price on your buyer record"
            />
            <FinanceTile
              label="Paid to date"
              value={fmtMoney(paymentTotal)}
              detail={paymentSummaryLabel(state.payments, state.salePrice, paymentTotal)}
            />
            <FinanceTile
              label="Remaining balance"
              value={state.salePrice != null ? fmtMoney(remainingBalance) : "Waiting on pricing"}
              detail={
                state.salePrice != null
                  ? remainingBalance > 0
                    ? "Based on recorded payments and listed price"
                    : "Your account appears fully covered"
                  : "This will update when pricing is finalized"
              }
            />
            <FinanceTile
              label="Next account date"
              value={nextImportantDate.value}
              detail={nextImportantDate.label}
            />
          </div>

          {state.salePrice != null ? (
            <div className="mt-5 rounded-[1.5rem] border border-[rgba(188,162,133,0.18)] bg-[linear-gradient(135deg,rgba(252,247,241,0.96)_0%,rgba(245,248,252,0.92)_100%)] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--portal-text)]">
                    Payment progress
                  </div>
                  <div className="mt-1 text-sm text-[var(--portal-text-soft)]">
                    {state.salePrice > 0
                      ? `${fmtMoney(paymentTotal)} of ${fmtMoney(state.salePrice)} recorded`
                      : "Payments will appear here as they post to your account."}
                  </div>
                </div>
                <div className="text-[1.1rem] font-semibold text-[var(--portal-text)]">
                  {paymentProgress}%
                </div>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,rgba(198,146,90,0.95)_0%,rgba(119,160,204,0.95)_100%)]"
                  style={{ width: `${paymentProgress}%` }}
                />
              </div>

              <div className="mt-4 grid gap-3">
                {state.buyer?.finance_enabled ? (
                  <DetailStrip
                    icon={<CreditCard className="h-4 w-4" />}
                    title="Payment plan is enabled"
                    detail={`${state.buyer.finance_monthly_amount ? fmtMoney(state.buyer.finance_monthly_amount) : "Monthly amount not set"}${state.buyer.finance_months ? ` for ${state.buyer.finance_months} months` : ""}${state.buyer.finance_next_due_date ? `, next due ${fmtDate(state.buyer.finance_next_due_date)}` : ""}`}
                  />
                ) : null}
                <DetailStrip
                  icon={<Receipt className="h-4 w-4" />}
                  title={latestPayment ? "Latest posted payment" : "No posted payment yet"}
                  detail={
                    latestPayment
                      ? `${fmtMoney(Number(latestPayment.amount || 0))} on ${formatOptionalDate(
                          latestPayment.payment_date,
                          "file date pending"
                        )}`
                      : "When the first payment is recorded, it will appear here with a clearer receipt trail."
                  }
                />
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className={`${surfaceClass} p-6 md:p-7`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
              Your journey timeline
            </div>
            <h2 className="mt-2 text-[1.9rem] font-bold tracking-[-0.05em] text-[var(--portal-accent)]">
              What has already happened
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--portal-text-soft)]">
              Think of this as the relationship history of your account. It shows the moments that have already moved your puppy journey forward.
            </p>
          </div>

          <Link
            href="/portal/messages"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#9c6a3a] transition hover:gap-3"
          >
            Visit support and messages
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-6">
          {timelineItems.length ? (
            <div className="space-y-3">
              {timelineItems.map((item, index) => (
                <TimelineEntry key={item.id} item={item} isLast={index === timelineItems.length - 1} />
              ))}
            </div>
          ) : (
            <CalmEmptyState
              title="Your journey timeline is just getting started"
              description="As applications, messages, records, payments, and puppy updates are added to your portal, they will build a clear story here."
            />
          )}
        </div>
      </section>
    </div>
  );
}

function PortalOverviewLoading() {
  return (
    <div className="space-y-5 pb-8">
      <div className="animate-pulse overflow-hidden rounded-[2.4rem] border border-[rgba(190,164,132,0.22)] bg-[linear-gradient(135deg,rgba(255,251,245,0.96)_0%,rgba(248,238,225,0.94)_42%,rgba(247,249,252,0.96)_100%)] p-6 shadow-[0_24px_56px_rgba(88,67,44,0.08)] md:p-8">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.05fr)_400px]">
          <div>
            <div className="h-9 w-52 rounded-full bg-[rgba(214,179,141,0.18)]" />
            <div className="mt-5 h-14 w-[32rem] max-w-full rounded-[1.4rem] bg-[rgba(188,162,133,0.16)]" />
            <div className="mt-4 h-5 w-[36rem] max-w-full rounded-full bg-[rgba(188,162,133,0.14)]" />
            <div className="mt-8 grid gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-28 rounded-[1.5rem] bg-white/72 shadow-sm"
                />
              ))}
            </div>
          </div>

          <div className="h-[430px] rounded-[2rem] bg-white/74 shadow-sm" />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.12fr)_380px]">
        <div className="h-[330px] animate-pulse rounded-[2rem] border border-[rgba(188,162,133,0.22)] bg-white shadow-sm" />
        <div className="h-[330px] animate-pulse rounded-[2rem] border border-[rgba(188,162,133,0.22)] bg-white shadow-sm" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_420px]">
        <div className="h-[480px] animate-pulse rounded-[2rem] border border-[rgba(188,162,133,0.22)] bg-white shadow-sm" />
        <div className="h-[480px] animate-pulse rounded-[2rem] border border-[rgba(188,162,133,0.22)] bg-white shadow-sm" />
      </div>
    </div>
  );
}

function HeroBadge({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "success" | "warning" | "danger" | "warm";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "danger"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : tone === "warm"
            ? "border-[rgba(198,146,90,0.26)] bg-[rgba(252,243,232,0.92)] text-[#9c6a3a]"
            : "border-[rgba(188,162,133,0.22)] bg-white/86 text-[var(--portal-text-muted)]";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneClass}`}
    >
      {label}
    </span>
  );
}

function PrimaryJourneyLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-[1rem] bg-[linear-gradient(120deg,#ca915b_0%,#a86b3b_44%,#7da3cc_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(125,163,204,0.22)] transition hover:-translate-y-0.5"
    >
      {children}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function SecondaryJourneyLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-[1rem] border border-[rgba(188,162,133,0.24)] bg-white/86 px-5 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-sm transition hover:-translate-y-0.5 hover:border-[rgba(188,162,133,0.4)]"
    >
      {children}
    </Link>
  );
}

function HeroStat({
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
    <div className="rounded-[1.5rem] border border-[rgba(188,162,133,0.18)] bg-white/82 px-4 py-4 shadow-[0_12px_24px_rgba(88,67,44,0.05)] backdrop-blur-sm">
      <div className="flex items-center gap-2 text-[#b67744]">
        {icon}
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
          {label}
        </div>
      </div>
      <div className="mt-3 text-[1rem] font-semibold text-[var(--portal-text)]">{value}</div>
      <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">{detail}</div>
    </div>
  );
}

function HeroGlassMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1rem] border border-white/18 bg-white/10 px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/74">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function JourneyStageCard({
  index,
  label,
  detail,
  href,
  tone,
}: {
  index: number;
  label: string;
  detail: string;
  href: string;
  tone: "complete" | "current" | "upcoming";
}) {
  const toneClass =
    tone === "complete"
      ? "border-emerald-200 bg-emerald-50/70"
      : tone === "current"
        ? "border-[rgba(198,146,90,0.28)] bg-[linear-gradient(135deg,rgba(252,244,234,0.96)_0%,rgba(247,249,252,0.96)_100%)]"
        : "border-[rgba(188,162,133,0.18)] bg-[rgba(252,251,249,0.94)]";
  const bulletClass =
    tone === "complete"
      ? "border-emerald-200 bg-emerald-500 text-white"
      : tone === "current"
        ? "border-[rgba(198,146,90,0.28)] bg-[#c8925a] text-white"
        : "border-[rgba(188,162,133,0.22)] bg-white text-[var(--portal-text-muted)]";

  return (
    <Link
      href={href}
      className={`w-[220px] shrink-0 rounded-[1.45rem] border p-4 transition hover:-translate-y-0.5 ${toneClass}`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold ${bulletClass}`}
        >
          {tone === "complete" ? <CheckCircle2 className="h-4 w-4" /> : index}
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
            Step {index}
          </div>
          <div className="mt-1 text-sm font-semibold text-[var(--portal-text)]">{label}</div>
        </div>
      </div>
      <div className="mt-4 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
    </Link>
  );
}

function AttentionActionCard({ item }: { item: AttentionItem }) {
  return (
    <Link
      href={item.href}
      className="group block rounded-[1.45rem] border border-[rgba(188,162,133,0.18)] bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(251,247,241,0.96)_100%)] p-4 transition hover:-translate-y-0.5 hover:border-[rgba(188,162,133,0.36)]"
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
        {item.eyebrow}
      </div>
      <div className="mt-2 text-[1rem] font-semibold text-[var(--portal-text)]">{item.title}</div>
      <div className="mt-2 text-sm leading-7 text-[var(--portal-text-soft)]">{item.detail}</div>
      <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#9c6a3a] transition group-hover:gap-3">
        {item.action}
        <ArrowRight className="h-4 w-4" />
      </div>
    </Link>
  );
}

function BriefingCard({ item }: { item: BriefingItem }) {
  const icon =
    item.label === "Breeder update" ? (
      <Sparkles className="h-4 w-4" />
    ) : item.label === "Wellness record" ? (
      <Stethoscope className="h-4 w-4" />
    ) : item.label === "Recent message" ? (
      <MessageCircle className="h-4 w-4" />
    ) : item.label === "Growth" ? (
      <Scale className="h-4 w-4" />
    ) : (
      <FileText className="h-4 w-4" />
    );

  return (
    <Link
      href={item.href}
      className="group block rounded-[1.35rem] border border-[rgba(188,162,133,0.18)] bg-[rgba(251,248,244,0.72)] p-4 transition hover:-translate-y-0.5 hover:bg-white"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[rgba(214,179,141,0.18)] text-[#b67744]">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
              {item.label}
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
              {item.dateText}
            </div>
          </div>
          <div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">{item.title}</div>
          <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{item.detail}</div>
        </div>
      </div>
    </Link>
  );
}

function QuietJumpLink({
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
      className="flex items-center justify-between gap-3 rounded-[1rem] px-1 py-2 text-sm transition hover:text-[var(--portal-text)]"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[rgba(214,179,141,0.16)] text-[#b67744]">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--portal-text)]">{title}</div>
          <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">{detail}</div>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-[#b67744]" />
    </Link>
  );
}

function StoryFact({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.2rem] bg-[rgba(250,245,239,0.78)] px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">{value}</div>
    </div>
  );
}

function HighlightNote({
  label,
  title,
  detail,
}: {
  label: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.3rem] border border-[rgba(188,162,133,0.16)] bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">{title}</div>
      <div className="mt-2 text-sm leading-7 text-[var(--portal-text-soft)]">{detail}</div>
    </div>
  );
}

function FinanceTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-[rgba(188,162,133,0.18)] bg-[rgba(251,248,244,0.72)] px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-[1.2rem] font-semibold text-[var(--portal-text)]">{value}</div>
      <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
    </div>
  );
}

function DetailStrip({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[1.15rem] bg-white px-4 py-4">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[rgba(214,179,141,0.16)] text-[#b67744]">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[var(--portal-text)]">{title}</div>
        <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
      </div>
    </div>
  );
}

function TimelineEntry({
  item,
  isLast,
}: {
  item: TimelineItem;
  isLast: boolean;
}) {
  const icon =
    item.label === "Application" ? (
      <FileText className="h-4 w-4" />
    ) : item.label === "Payment" ? (
      <CreditCard className="h-4 w-4" />
    ) : item.label === "Breeder message" ? (
      <MessageCircle className="h-4 w-4" />
    ) : item.label === "Transportation" ? (
      <Truck className="h-4 w-4" />
    ) : item.label === "Wellness" ? (
      <Stethoscope className="h-4 w-4" />
    ) : item.label === "Pupdate" ? (
      <Sparkles className="h-4 w-4" />
    ) : (
      <PawPrint className="h-4 w-4" />
    );

  return (
    <Link
      href={item.href}
      className="group flex gap-4 rounded-[1.45rem] border border-[rgba(188,162,133,0.18)] bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(251,248,244,0.96)_100%)] p-4 transition hover:-translate-y-0.5"
    >
      <div className="flex flex-col items-center">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(214,179,141,0.18)] text-[#b67744]">
          {icon}
        </span>
        {!isLast ? (
          <span className="mt-2 h-full w-px bg-[rgba(188,162,133,0.2)]" />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
              {item.label}
            </div>
            <div className="mt-1 text-base font-semibold text-[var(--portal-text)]">
              {item.title}
            </div>
          </div>
          <div className="shrink-0 rounded-full border border-[rgba(188,162,133,0.18)] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
            {item.dateText}
          </div>
        </div>
        <div className="mt-2 text-sm leading-7 text-[var(--portal-text-soft)]">{item.detail}</div>
      </div>
    </Link>
  );
}

function CalmEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[1.45rem] border border-dashed border-[rgba(188,162,133,0.28)] bg-[rgba(250,246,240,0.7)] px-5 py-8 text-center">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(214,179,141,0.18)] text-[#b67744]">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="mt-4 text-lg font-semibold text-[var(--portal-text)]">{title}</div>
      <div className="mx-auto mt-2 max-w-md text-sm leading-7 text-[var(--portal-text-soft)]">
        {description}
      </div>
    </div>
  );
}
