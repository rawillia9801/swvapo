"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { Analytics } from "@vercel/analytics/next"
import {
  BookOpen,
  ClipboardList,
  CreditCard,
  FileText,
  Home,
  Loader2,
  MessageSquare,
  PawPrint,
  Truck,
  UserCircle2,
  X,
} from "lucide-react";
import { sb } from "@/lib/utils";
import {
  PortalChiChiWidget,
  type PortalAdminAuth,
  type PortalChatMessage,
} from "@/components/portal/chichi-widget";
import { PortalMobileHeader } from "@/components/portal/portal-mobile-header";
import { PortalUserMenu } from "@/components/portal/portal-user-menu";
import {
  findFormSubmissionsForUser,
  findHealthRecords,
  findLatestPickupRequestForUser,
  findPortalDocumentsForUser,
  findPortalMessagesForUser,
  findPuppyEvents,
  loadPortalContext,
  portalDisplayName,
  portalPuppyName,
  type PortalApplication,
  type PortalBuyer,
  type PortalDocument,
  type PortalFormSubmission,
  type PortalHealthRecord,
  type PortalMessage,
  type PortalPickupRequest,
  type PortalPuppy,
  type PortalPuppyEvent,
} from "@/lib/portal-data";
import { isPortalAdminEmail } from "@/lib/portal-admin";

type PortalUser = {
  id?: string;
  email?: string | null;
  created_at?: string | null;
  user_metadata?: {
    full_name?: string | null;
    name?: string | null;
    avatar_url?: string | null;
  };
};

type NavDefinition = {
  href: string;
  label: string;
  icon: React.ReactNode;
  match?: (pathname: string) => boolean;
};

type SidebarNavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  badge?: number;
};

type SidebarChromeProps = {
  displayName: string;
  navItems: SidebarNavItem[];
  displayEmail: string;
  displayPhone: string;
  userInitial: string;
  hasAdminUi: boolean;
  isUserMenuOpen: boolean;
  userMenuRef?: React.RefObject<HTMLDivElement | null>;
  onToggleUserMenu: () => void;
  onCloseUserMenu: () => void;
  onSignOut: () => void;
};

type NotificationItem = {
  key: string;
  title: string;
  body: string;
  dateValue: string;
  dateLabel: string;
  href: string;
  tone: "message" | "health" | "update" | "document" | "transport";
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

type ChiChiResponse = {
  text?: string;
  threadId?: string | null;
  adminAuth?: {
    userId?: string | null;
    email?: string | null;
    canWriteCore?: boolean;
  };
};

const navDefinitions: NavDefinition[] = [
  {
    href: "/portal",
    label: "Dashboard",
    icon: <Home className="h-4 w-4" />,
    match: (pathname) => pathname === "/portal",
  },
  {
    href: "/portal/application",
    label: "Puppy Application",
    icon: <ClipboardList className="h-4 w-4" />,
  },
  {
    href: "/portal/documents",
    label: "Contracts & Docs",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    href: "/portal/payments",
    label: "Payments",
    icon: <CreditCard className="h-4 w-4" />,
  },
  {
    href: "/portal/mypuppy",
    label: "My Puppy Info",
    icon: <PawPrint className="h-4 w-4" />,
  },
  {
    href: "/portal/transportation",
    label: "Pickup / Delivery",
    icon: <Truck className="h-4 w-4" />,
  },
  {
    href: "/portal/updates",
    label: "Puppy Updates",
    icon: <PawPrint className="h-4 w-4" />,
  },
  {
    href: "/portal/messages",
    label: "Messages / Support",
    icon: <MessageSquare className="h-4 w-4" />,
  },
  {
    href: "/portal/profile",
    label: "Account Info",
    icon: <UserCircle2 className="h-4 w-4" />,
  },
  {
    href: "/portal/resources",
    label: "Resources & Care",
    icon: <BookOpen className="h-4 w-4" />,
  },
];

const defaultChiChiMessage: PortalChatMessage = {
  id: makeId("assistant"),
  role: "assistant",
  text: "I can check the records tied to this portal, answer account questions directly, and help you find the next step from the information already on file.",
  createdAt: formatTime(),
};

function makeId(prefix = "msg") {
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
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

function pageTitleFromPath(pathname: string) {
  if (pathname === "/portal") return "Dashboard";

  const direct = navDefinitions.find((item) =>
    item.match ? item.match(pathname) : pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  if (direct) return direct.label;
  if (pathname.startsWith("/portal/profile")) return "Profile";
  if (pathname.startsWith("/portal/help")) return "Help and Support";
  if (pathname.startsWith("/portal/notifications")) return "Notifications";
  return "My Puppy Portal";
}

function formatNotificationDate(value: string | null | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function makeNotificationKey(prefix: string, id: string | number, value?: string | null) {
  return `${prefix}:${id}:${value || "na"}`;
}

function requestText(request: PortalPickupRequest | null, keys: string[]) {
  return String(readRecordValue(request, keys) || "").trim();
}

function buildNotifications(params: {
  messages: PortalMessage[];
  health: PortalHealthRecord[];
  events: PortalPuppyEvent[];
  documents: PortalDocument[];
  forms: PortalFormSubmission[];
  pickupRequest: PortalPickupRequest | null;
  dismissedKeys: string[];
}) {
  const dismissed = new Set(params.dismissedKeys);

  const items: NotificationItem[] = [
    ...params.messages
      .filter((entry) => entry.sender === "admin" && !entry.read_by_user)
      .map((entry) => ({
        key: makeNotificationKey("message", entry.id, entry.created_at),
        title: entry.subject || "New breeder message",
        body: entry.message || "You have a new portal message.",
        dateValue: entry.created_at || "",
        dateLabel: formatNotificationDate(entry.created_at),
        href: "/portal/messages",
        tone: "message" as const,
      })),

    ...params.health.slice(0, 4).map((entry) => ({
      key: makeNotificationKey("health", entry.id, entry.record_date),
      title: entry.title || "New health record",
      body: entry.description || "A health or wellness record was added to your puppy profile.",
      dateValue: entry.record_date || "",
      dateLabel: formatNotificationDate(entry.record_date),
      href: "/portal/resources",
      tone: "health" as const,
    })),

    ...params.events.slice(0, 5).map((entry) => ({
      key: makeNotificationKey("event", entry.id, entry.event_date),
      title: entry.title || entry.label || "New pupdate",
      body: entry.summary || entry.details || "A new breeder update was posted to your portal.",
      dateValue: entry.event_date || "",
      dateLabel: formatNotificationDate(entry.event_date),
      href: "/portal/updates",
      tone: "update" as const,
    })),

    ...params.documents
      .filter((entry) => {
        const status = String(entry.status || "").toLowerCase();
        return status !== "completed" && status !== "signed";
      })
      .slice(0, 3)
      .map((entry) => ({
        key: makeNotificationKey("document", entry.id, entry.created_at),
        title: entry.title || "Open document",
        body: entry.description || "A document or contract still needs review.",
        dateValue: entry.created_at || "",
        dateLabel: formatNotificationDate(entry.created_at),
        href: "/portal/documents",
        tone: "document" as const,
      })),

    ...params.forms
      .filter((entry) => String(entry.status || "").toLowerCase() === "draft")
      .slice(0, 3)
      .map((entry) => ({
        key: makeNotificationKey("form", entry.id, String(entry.submitted_at || entry.signed_at || entry.signed_date || "")),
        title: entry.form_title || entry.form_key || "Draft form saved",
        body: "A form is still in draft and can be completed from your portal.",
        dateValue: String(entry.submitted_at || entry.signed_at || entry.signed_date || ""),
        dateLabel: formatNotificationDate(String(entry.submitted_at || entry.signed_at || entry.signed_date || "")),
        href: "/portal/documents",
        tone: "document" as const,
      })),

    ...(params.pickupRequest
      ? [
          {
            key: makeNotificationKey(
              "transport",
              String(readRecordValue(params.pickupRequest, ["id"]) || "pickup"),
              requestText(params.pickupRequest, ["created_at", "request_date"])
            ),
            title: "Transportation request on file",
            body:
              requestText(params.pickupRequest, ["location_text", "address_text"]) ||
              "A transportation request was created for this portal account.",
            dateValue: requestText(params.pickupRequest, ["request_date", "created_at"]),
            dateLabel: formatNotificationDate(requestText(params.pickupRequest, ["request_date", "created_at"])),
            href: "/portal/transportation",
            tone: "transport" as const,
          },
        ]
      : []),
  ]
    .filter((item) => !dismissed.has(item.key))
    .sort((a, b) => new Date(b.dateValue || 0).getTime() - new Date(a.dateValue || 0).getTime())
    .slice(0, 18);

  return items;
}

function navItemClassName(active: boolean) {
  return [
    "group flex w-full items-center justify-between rounded-[14px] border px-3 py-2.5 transition-all duration-200",
    active
      ? "border-transparent bg-[linear-gradient(90deg,#a855f7_0%,#ec4899_100%)] text-white shadow-[0_12px_26px_rgba(168,85,247,0.28)]"
      : "border-transparent bg-transparent text-[var(--portal-text-soft)] hover:bg-white hover:text-[var(--portal-text)]",
  ].join(" ");
}

function SidebarChrome({
  displayName,
  navItems,
  displayEmail,
  displayPhone,
  userInitial,
  hasAdminUi,
  isUserMenuOpen,
  userMenuRef,
  onToggleUserMenu,
  onCloseUserMenu,
  onSignOut,
}: SidebarChromeProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="rounded-[22px] border border-[var(--portal-border)] bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#a855f7_0%,#ec4899_100%)] text-xl text-white shadow-[0_12px_24px_rgba(168,85,247,0.28)]">
            ♡
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-xl font-extrabold tracking-[-0.03em] text-[var(--portal-accent)]">
              Southwest Virginia Chihuahua
            </div>
            <div className="mt-0.5 text-sm font-medium text-[var(--portal-text-soft)]">
              Puppy Portal
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-[22px] border border-[var(--portal-border)] bg-white p-3 shadow-sm">
        <nav className="flex h-full min-h-0 flex-col gap-1 overflow-y-auto pr-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={navItemClassName(item.active)}>
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className={[
                    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm",
                    item.active
                      ? "bg-white/20 text-white"
                      : "bg-[var(--portal-surface-muted)] text-[var(--portal-text-muted)] group-hover:bg-white group-hover:text-[var(--portal-accent)]",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
                <span className="truncate whitespace-nowrap text-[12px] font-semibold xl:text-[13px]">
                  {item.label}
                </span>
              </span>

              {typeof item.badge === "number" && item.badge > 0 ? (
                <span
                  className={[
                    "inline-flex min-w-[24px] items-center justify-center rounded-full px-2 py-1 text-[10px] font-black",
                    item.active ? "bg-white/20 text-white" : "bg-white text-[var(--portal-accent)]",
                  ].join(" ")}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
      </div>

      <div ref={userMenuRef}>
        <PortalUserMenu
          displayName={displayName}
          displayEmail={displayEmail}
          displayPhone={displayPhone}
          userInitial={userInitial}
          isOpen={isUserMenuOpen}
          hasAdminUi={hasAdminUi}
          onToggle={onToggleUserMenu}
          onClose={onCloseUserMenu}
          onSignOut={onSignOut}
        />
      </div>
    </div>
  );
}

function FieldCard({
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
    <div className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
      <label className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-400"
      />
    </div>
  );
}

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<PortalUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const [buyer, setBuyer] = useState<PortalBuyer | null>(null);
  const [application, setApplication] = useState<PortalApplication | null>(null);
  const [puppy, setPuppy] = useState<PortalPuppy | null>(null);

  const [portalMessages, setPortalMessages] = useState<PortalMessage[]>([]);
  const [healthRecords, setHealthRecords] = useState<PortalHealthRecord[]>([]);
  const [portalEvents, setPortalEvents] = useState<PortalPuppyEvent[]>([]);
  const [portalDocuments, setPortalDocuments] = useState<PortalDocument[]>([]);
  const [portalForms, setPortalForms] = useState<PortalFormSubmission[]>([]);
  const [pickupRequest, setPickupRequest] = useState<PortalPickupRequest | null>(null);

  const [dismissedNotificationKeys, setDismissedNotificationKeys] = useState<string[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveText, setProfileSaveText] = useState("");
  const [profileErrorText, setProfileErrorText] = useState("");
  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    full_name: "",
    email: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
  });
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [profilePicturePreviewUrl, setProfilePicturePreviewUrl] = useState("");

  const [threadId, setThreadId] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [adminAuth, setAdminAuth] = useState<PortalAdminAuth>(null);
  const [messages, setMessages] = useState<PortalChatMessage[]>([defaultChiChiMessage]);

  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const {
        data: { session },
      } = await sb.auth.getSession();

      if (!mounted) return;
      setUser((session?.user as PortalUser) ?? null);
      setAccessToken(session?.access_token ?? null);
    }

    void bootstrap();

    const { data: authListener } = sb.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      setUser((session?.user as PortalUser) ?? null);
      setAccessToken(session?.access_token ?? null);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setIsDrawerOpen(false);
    setIsUserMenuOpen(false);
    setIsNotificationsOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setBuyer(null);
      setApplication(null);
      setPuppy(null);
      setPortalMessages([]);
      setHealthRecords([]);
      setPortalEvents([]);
      setPortalDocuments([]);
      setPortalForms([]);
      setPickupRequest(null);
      setDismissedNotificationKeys([]);
      setMessages([defaultChiChiMessage]);
      setThreadId(null);
      setAdminAuth(null);
      return;
    }

    let active = true;

    async function loadChromeData() {
      try {
        const currentUser = user as User;
        const context = await loadPortalContext(currentUser);

        const [recentMessages, health, events, documents, forms, latestPickup] = await Promise.all([
          findPortalMessagesForUser(currentUser, 20),
          findHealthRecords(context.puppy?.id),
          findPuppyEvents(context.puppy?.id),
          findPortalDocumentsForUser(currentUser, context.buyer),
          findFormSubmissionsForUser(currentUser),
          findLatestPickupRequestForUser(currentUser),
        ]);

        const { data: dismissalsData, error: dismissalsError } = await sb
          .from("portal_notification_dismissals")
          .select("notification_key")
          .eq("user_id", currentUser.id);

        if (!active) return;

        if (dismissalsError) {
          console.error("Could not load notification dismissals:", dismissalsError);
        }

        setBuyer(context.buyer);
        setApplication(context.application);
        setPuppy(context.puppy);
        setPortalMessages(recentMessages || []);
        setHealthRecords(health || []);
        setPortalEvents(events || []);
        setPortalDocuments(documents || []);
        setPortalForms(forms || []);
        setPickupRequest(latestPickup || null);
        setDismissedNotificationKeys(
          Array.isArray(dismissalsData)
            ? dismissalsData.map((row) => String((row as { notification_key?: string }).notification_key || ""))
            : []
        );
      } catch (error) {
        console.error("Could not load portal shell data:", error);
      }
    }

    void loadChromeData();

    return () => {
      active = false;
    };
  }, [pathname, user]);

  useEffect(() => {
    const objectUrl = profilePictureFile ? URL.createObjectURL(profilePictureFile) : "";
    if (objectUrl) {
      setProfilePicturePreviewUrl(objectUrl);
    }

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [profilePictureFile]);

  useEffect(() => {
    const initialFullName =
      String(
        readRecordValue(buyer, ["full_name", "name"]) ||
          readRecordValue(application, ["full_name", "name"]) ||
          user?.user_metadata?.full_name ||
          user?.user_metadata?.name ||
          ""
      ) || "";

    const initialEmail =
      String(
        readRecordValue(buyer, ["email"]) ||
          readRecordValue(application, ["email", "applicant_email"]) ||
          user?.email ||
          ""
      ) || "";

    const initialPhone =
      String(readRecordValue(buyer, ["phone"]) || readRecordValue(application, ["phone"]) || "") || "";

    setProfileForm({
      full_name: initialFullName,
      email: initialEmail,
      phone: initialPhone,
      address_line1: String(readRecordValue(buyer, ["address_line1", "address1"]) || ""),
      address_line2: String(readRecordValue(buyer, ["address_line2", "address2"]) || ""),
      city: String(readRecordValue(buyer, ["city"]) || ""),
      state: String(readRecordValue(buyer, ["state"]) || ""),
      postal_code: String(readRecordValue(buyer, ["postal_code", "zip", "zip_code"]) || ""),
    });

    if (!profilePictureFile) {
      setProfilePicturePreviewUrl(
        String(readRecordValue(buyer, ["portal_profile_photo_url"]) || user?.user_metadata?.avatar_url || "")
      );
    }
  }, [application, buyer, profilePictureFile, user]);

  const displayName = portalDisplayName(user as User | null, buyer, application);
  const displayEmail =
    String(
      user?.email ||
        readRecordValue(buyer, ["email"]) ||
        readRecordValue(application, ["email", "applicant_email"]) ||
        "No email on file"
    ) || "No email on file";

  const displayPhone =
    String(readRecordValue(buyer, ["phone"]) || readRecordValue(application, ["phone"]) || "No phone on file");

  const puppyName = portalPuppyName(puppy) || "Not yet assigned";
  const userInitial = (displayName?.[0] || displayEmail?.[0] || "U").toUpperCase();

  const pageTitle = pageTitleFromPath(pathname);
  const hasAdminUi = isPortalAdminEmail(user?.email) || !!adminAuth?.canWriteCore;

  const notifications = useMemo(
    () =>
      buildNotifications({
        messages: portalMessages,
        health: healthRecords,
        events: portalEvents,
        documents: portalDocuments,
        forms: portalForms,
        pickupRequest,
        dismissedKeys: dismissedNotificationKeys,
      }),
    [dismissedNotificationKeys, healthRecords, pickupRequest, portalDocuments, portalEvents, portalForms, portalMessages]
  );

  const navItems: SidebarNavItem[] = navDefinitions.map((item) => ({
    href: item.href,
    label: item.label,
    icon: item.icon,
    active: item.match ? item.match(pathname) : pathname === item.href || pathname.startsWith(`${item.href}/`),
    badge:
      item.href === "/portal/messages"
        ? portalMessages.filter((entry) => entry.sender === "admin" && !entry.read_by_user).length
        : undefined,
  }));

  async function handleSignOut() {
    await sb.auth.signOut();
    setUser(null);
    setAccessToken(null);
    router.push("/portal");
    router.refresh();
  }

  async function dismissNotification(notificationKey: string) {
    if (!user?.id) return;

    const nextKeys = Array.from(new Set([...dismissedNotificationKeys, notificationKey]));
    setDismissedNotificationKeys(nextKeys);

    const { error } = await sb.from("portal_notification_dismissals").upsert(
      {
        user_id: user.id,
        notification_key: notificationKey,
        dismissed_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,notification_key",
      }
    );

    if (error) {
      console.error("Could not dismiss notification:", error);
    }
  }

  async function clearAllNotifications() {
    if (!notifications.length) return;
    for (const item of notifications) {
      await dismissNotification(item.key);
    }
  }

  async function handleSendChiChiMessage(overrideText?: string) {
    const text = (overrideText ?? chatDraft).trim();
    if (!text || isSending) return;

    const userMessage: PortalChatMessage = {
      id: makeId("user"),
      role: "user",
      text,
      createdAt: formatTime(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!overrideText) setChatDraft("");
    setIsSending(true);

    if (!accessToken) {
      setMessages((prev) => [
        ...prev,
        {
          id: makeId("assistant"),
          role: "assistant",
          text: "Please sign in through the portal first so I can answer using your account records.",
          createdAt: formatTime(),
        },
      ]);
      setIsSending(false);
      return;
    }

    try {
      const response = await fetch("/api/buildlio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          threadId,
          accessToken,
          max_tokens: 1200,
          messages: [...messages, userMessage].map((message) => ({
            role: message.role,
            content: message.text,
          })),
        }),
      });

      const data = (await response.json()) as ChiChiResponse;
      const reply =
        data.text?.trim() ||
        "I ran into a connection issue while reading your portal records. Please try again.";

      if (data.threadId) setThreadId(data.threadId);
      if (data.adminAuth) setAdminAuth(data.adminAuth);

      setMessages((prev) => [
        ...prev,
        {
          id: makeId("assistant"),
          role: "assistant",
          text: reply,
          createdAt: formatTime(),
        },
      ]);
    } catch (error) {
      console.error("ChiChi portal error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: makeId("assistant"),
          role: "assistant",
          text: "I hit a connection problem while checking your portal records. Please try again in a moment.",
          createdAt: formatTime(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  async function saveProfile() {
    if (!accessToken || !user?.id) {
      setProfileErrorText("Please sign in again before saving your profile.");
      return;
    }

    setIsSavingProfile(true);
    setProfileSaveText("");
    setProfileErrorText("");

    try {
      const formData = new FormData();
      formData.append("full_name", profileForm.full_name.trim());
      formData.append("email", profileForm.email.trim());
      formData.append("phone", profileForm.phone.trim());
      formData.append("address_line1", profileForm.address_line1.trim());
      formData.append("address_line2", profileForm.address_line2.trim());
      formData.append("city", profileForm.city.trim());
      formData.append("state", profileForm.state.trim());
      formData.append("postal_code", profileForm.postal_code.trim());

      if (profilePictureFile) {
        formData.append("profile_picture", profilePictureFile);
      }

      const response = await fetch("/api/portal/profile", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        buyer?: Record<string, unknown>;
        photo_url?: string | null;
        email?: string | null;
      };

      if (!response.ok) {
        throw new Error(payload.message || "Could not save your profile.");
      }

      if (payload.buyer) {
        setBuyer((prev) => ({ ...(prev || {}), ...(payload.buyer as PortalBuyer) }) as PortalBuyer);
      }

      if (payload.photo_url) {
        setProfilePicturePreviewUrl(payload.photo_url);
      }

      if (payload.email) {
        setUser((prev) =>
          prev
            ? {
                ...prev,
                email: payload.email,
                user_metadata: {
                  ...(prev.user_metadata || {}),
                  full_name: profileForm.full_name,
                  name: profileForm.full_name,
                  avatar_url: payload.photo_url || prev.user_metadata?.avatar_url || null,
                },
              }
            : prev
        );
      } else {
        setUser((prev) =>
          prev
            ? {
                ...prev,
                user_metadata: {
                  ...(prev.user_metadata || {}),
                  full_name: profileForm.full_name,
                  name: profileForm.full_name,
                  avatar_url: payload.photo_url || prev.user_metadata?.avatar_url || null,
                },
              }
            : prev
        );
      }

      setProfilePictureFile(null);
      setProfileSaveText(payload.message || "Your profile was saved.");
    } catch (error) {
      console.error("Could not save profile:", error);
      setProfileErrorText(
        error instanceof Error ? error.message : "Could not save your profile right now."
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--portal-bg)] text-[var(--portal-text)]">
      <div className="grid min-h-screen lg:grid-cols-[312px_minmax(0,1fr)] xl:grid-cols-[328px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[var(--portal-border)] bg-white/70 px-4 py-4 backdrop-blur-sm lg:block">
          <div className="sticky top-4 h-[calc(100vh-2rem)]">
            <SidebarChrome
              displayName={displayName}
              navItems={navItems}
              displayEmail={displayEmail}
              displayPhone={displayPhone}
              userInitial={userInitial}
              hasAdminUi={hasAdminUi}
              isUserMenuOpen={isUserMenuOpen}
              userMenuRef={userMenuRef}
              onToggleUserMenu={() => setIsUserMenuOpen((value) => !value)}
              onCloseUserMenu={() => setIsUserMenuOpen(false)}
              onSignOut={() => {
                setIsUserMenuOpen(false);
                void handleSignOut();
              }}
            />
          </div>
        </aside>

        <div className="min-w-0">
          <PortalMobileHeader
            pageTitle={pageTitle}
            unreadMessageCount={notifications.length}
            onOpenDrawer={() => setIsDrawerOpen(true)}
          />

          <main className="min-h-screen px-4 py-5 md:px-6 md:py-6 xl:px-8 xl:py-8">
            <div className="mx-auto w-full max-w-[1260px]">{children}</div>
          </main>
        </div>
      </div>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsDrawerOpen(false)}
            aria-label="Close portal navigation"
          />
          <div className="absolute left-0 top-0 h-full w-[90%] max-w-[340px] border-r border-slate-200 bg-[#fcfcfb] px-4 py-4 shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm"
                aria-label="Close portal navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="h-[calc(100%-3.75rem)] overflow-y-auto pr-1">
              <SidebarChrome
                displayName={displayName}
                navItems={navItems}
                displayEmail={displayEmail}
                displayPhone={displayPhone}
                userInitial={userInitial}
                hasAdminUi={hasAdminUi}
                isUserMenuOpen={isUserMenuOpen}
                onToggleUserMenu={() => setIsUserMenuOpen((value) => !value)}
                onCloseUserMenu={() => setIsUserMenuOpen(false)}
                onSignOut={() => {
                  setIsUserMenuOpen(false);
                  void handleSignOut();
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {isNotificationsOpen ? (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsNotificationsOpen(false)}
            aria-label="Close notifications"
          />

          <aside className="absolute right-0 top-0 h-full w-full max-w-[460px] border-l border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">
                    Buyer Notifications
                  </div>
                  <div className="mt-1 font-serif text-xl font-bold tracking-tight text-slate-900">
                    Notifications
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsNotificationsOpen(false)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm"
                  aria-label="Close notifications"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                <div className="text-sm font-semibold text-slate-700">
                  {notifications.length} active notification{notifications.length === 1 ? "" : "s"}
                </div>

                <button
                  type="button"
                  onClick={() => void clearAllNotifications()}
                  className="text-sm font-bold text-slate-700 transition hover:text-slate-900"
                >
                  Clear all
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4">
                {notifications.length ? (
                  <div className="space-y-3">
                    {notifications.map((item) => (
                      <div
                        key={item.key}
                        className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setIsNotificationsOpen(false);
                              router.push(item.href);
                            }}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-base">
                                {item.tone === "message" ? "💌" : null}
                                {item.tone === "health" ? "🦴" : null}
                                {item.tone === "update" ? "🐾" : null}
                                {item.tone === "document" ? "📄" : null}
                                {item.tone === "transport" ? "🚗" : null}
                              </span>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-extrabold text-slate-900">
                                  {item.title}
                                </div>
                                <div className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
                                  {item.dateLabel}
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 text-sm leading-6 text-slate-600">{item.body}</div>
                          </button>

                          <button
                            type="button"
                            onClick={() => void dismissNotification(item.key)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                            aria-label="Dismiss notification"
                            title="Dismiss"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[18px] border border-slate-200 bg-white p-6 text-center shadow-sm">
                    <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-2xl">
                      🐾
                    </div>
                    <div className="mt-4 font-serif text-lg font-bold tracking-tight text-slate-900">
                      No new notifications
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-600">
                      New breeder messages, pupdates, health records, open documents, and transportation items will appear here.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {isProfileOpen ? (
        <div className="fixed inset-0 z-[72]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsProfileOpen(false)}
            aria-label="Close profile panel"
          />

          <aside className="absolute right-0 top-0 h-full w-full max-w-[520px] border-l border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">
                    Buyer Profile
                  </div>
                  <div className="mt-1 font-serif text-xl font-bold tracking-tight text-slate-900">
                    Profile
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsProfileOpen(false)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm"
                  aria-label="Close profile"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5">
                <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="relative inline-flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-xl font-black text-slate-700">
                      {profilePicturePreviewUrl ? (
                        <Image
                          src={profilePicturePreviewUrl}
                          alt={`${displayName} profile`}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        userInitial
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-serif text-lg font-bold tracking-tight text-slate-900">
                        {displayName}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">{displayEmail}</div>

                      <label className="mt-3 inline-flex cursor-pointer items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-slate-300">
                        Upload picture
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0] || null;
                            setProfilePictureFile(file);
                            setProfileSaveText("");
                            setProfileErrorText("");
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-4">
                  <FieldCard
                    label="Full Name"
                    value={profileForm.full_name}
                    onChange={(value) => setProfileForm((prev) => ({ ...prev, full_name: value }))}
                  />
                  <FieldCard
                    label="Email Address"
                    type="email"
                    value={profileForm.email}
                    onChange={(value) => setProfileForm((prev) => ({ ...prev, email: value }))}
                  />
                  <FieldCard
                    label="Phone Number"
                    value={profileForm.phone}
                    onChange={(value) => setProfileForm((prev) => ({ ...prev, phone: value }))}
                  />
                  <FieldCard
                    label="Address Line 1"
                    value={profileForm.address_line1}
                    onChange={(value) => setProfileForm((prev) => ({ ...prev, address_line1: value }))}
                  />
                  <FieldCard
                    label="Address Line 2"
                    value={profileForm.address_line2}
                    onChange={(value) => setProfileForm((prev) => ({ ...prev, address_line2: value }))}
                  />

                  <div className="grid gap-4 md:grid-cols-3">
                    <FieldCard
                      label="City"
                      value={profileForm.city}
                      onChange={(value) => setProfileForm((prev) => ({ ...prev, city: value }))}
                    />
                    <FieldCard
                      label="State"
                      value={profileForm.state}
                      onChange={(value) => setProfileForm((prev) => ({ ...prev, state: value }))}
                    />
                    <FieldCard
                      label="ZIP Code"
                      value={profileForm.postal_code}
                      onChange={(value) => setProfileForm((prev) => ({ ...prev, postal_code: value }))}
                    />
                  </div>

                  {profileErrorText ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                      {profileErrorText}
                    </div>
                  ) : null}

                  {profileSaveText ? (
                    <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
                      {profileSaveText}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="border-t border-slate-200 px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setIsProfileOpen(false)}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    onClick={() => void saveProfile()}
                    disabled={isSavingProfile}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save Profile
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <PortalChiChiWidget
        displayName={displayName}
        puppyName={puppyName}
        userInitial={userInitial}
        isAdmin={hasAdminUi}
        messages={messages}
        adminAuth={adminAuth}
        isSending={isSending}
        chatDraft={chatDraft}
        onDraftChange={setChatDraft}
        onSend={handleSendChiChiMessage}
      />
    </div>
  );
}
