"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  Bell,
  BookOpen,
  CalendarDays,
  CarFront,
  ClipboardList,
  CreditCard,
  FileText,
  HelpCircle,
  Home,
  Loader2,
  MessageCircle,
  Sparkles,
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
  mascot: string;
  match?: (pathname: string) => boolean;
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

type SidebarNavItem = {
  href: string;
  label: string;
  mascot: string;
  active: boolean;
  badge?: number;
};

type SidebarChromeProps = {
  displayName: string;
  puppyName: string;
  signupDate: string;
  applicationDate: string;
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

const navDefinitions: NavDefinition[] = [
  {
    href: "/portal",
    label: "Overview",
    mascot: "🐶",
    match: (pathname) => pathname === "/portal",
  },
  {
    href: "/portal/application",
    label: "Application",
    mascot: "📝",
  },
  {
    href: "/portal/available-puppies",
    label: "Available Puppies",
    mascot: "🐕",
  },
  {
    href: "/portal/documents",
    label: "Documents/Contracts",
    mascot: "📄",
  },
  {
    href: "/portal/resources",
    label: "Health/Resources",
    mascot: "🦴",
  },
  {
    href: "/portal/payments",
    label: "Payments",
    mascot: "💳",
  },
  {
    href: "/portal/messages",
    label: "Portal Messages",
    mascot: "💌",
  },
  {
    href: "/portal/updates",
    label: "Pupdates",
    mascot: "🐾",
  },
  {
    href: "/portal/transportation",
    label: "Transportation Request",
    mascot: "🚗",
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

function formatPortalDateValue(value: unknown) {
  if (!value) return "Not on file";

  const parsed =
    value instanceof Date
      ? value
      : typeof value === "string" || typeof value === "number"
        ? new Date(value)
        : null;

  if (!parsed || Number.isNaN(parsed.getTime())) return "Not on file";

  return parsed.toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function pageTitleFromPath(pathname: string) {
  const direct = navDefinitions.find((item) =>
    item.match ? item.match(pathname) : pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
  if (direct) return direct.label;
  if (pathname.startsWith("/portal/mypuppy")) return "My Puppy";
  if (pathname.startsWith("/portal/profile")) return "Profile";
  if (pathname.startsWith("/portal/help")) return "Help and Support";
  if (pathname.startsWith("/portal/notifications")) return "Notifications";
  return "My Puppy Portal";
}

function formatNotificationDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function makeNotificationKey(prefix: string, id: string | number, value?: string | null) {
  return `${prefix}:${id}:${value || "na"}`;
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
        key: makeNotificationKey("form", entry.id, entry.submitted_at || entry.signed_at || entry.signed_date),
        title: entry.form_title || entry.form_key || "Draft form saved",
        body: "A form is still in draft and can be completed from your portal.",
        dateValue: String(entry.submitted_at || entry.signed_at || entry.signed_date || ""),
        dateLabel: formatNotificationDate(
          String(entry.submitted_at || entry.signed_at || entry.signed_date || "")
        ),
        href: "/portal/documents",
        tone: "document" as const,
      })),

    ...(params.pickupRequest
      ? [
          {
            key: makeNotificationKey(
              "transport",
              params.pickupRequest.id,
              params.pickupRequest.created_at || params.pickupRequest.request_date
            ),
            title: "Transportation request on file",
            body:
              params.pickupRequest.location_text ||
              params.pickupRequest.address_text ||
              "A transportation request was created for this portal account.",
            dateValue: String(params.pickupRequest.request_date || params.pickupRequest.created_at || ""),
            dateLabel: formatNotificationDate(
              String(params.pickupRequest.request_date || params.pickupRequest.created_at || "")
            ),
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
    "group flex w-full items-center justify-between rounded-[18px] border px-3 py-2.5 transition-all duration-200",
    active
      ? "border-[#b48755] bg-[linear-gradient(135deg,rgba(190,150,99,0.18),rgba(255,255,255,0.94))] text-[#4d3422] shadow-[0_10px_22px_rgba(126,92,56,0.14)]"
      : "border-white/80 bg-white/70 text-[#6f5440] hover:border-[#d9c0a3] hover:bg-white hover:text-[#4d3422] hover:shadow-[0_10px_22px_rgba(126,92,56,0.08)]",
  ].join(" ");
}

function SidebarChrome({
  displayName,
  puppyName,
  signupDate,
  applicationDate,
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
    <div className="flex h-full flex-col gap-3.5">
      <div className="rounded-[28px] border border-[#e7d7c4] bg-[linear-gradient(135deg,rgba(255,252,247,0.96),rgba(247,238,228,0.94))] p-4 shadow-[0_22px_56px_rgba(120,88,56,0.13)]">
        <div className="flex items-center gap-3.5">
          <div className="flex h-[76px] w-[98px] shrink-0 items-center justify-center overflow-hidden rounded-[22px] border border-[#e7d7c4] bg-white p-2 shadow-[0_10px_24px_rgba(120,88,56,0.1)]">
            <img
              src="https://www.swvachihuahua.com/pics/logo.jpg"
              alt="Southwest Virginia Chihuahua logo"
              className="h-full w-full object-contain"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[1rem] font-extrabold leading-tight tracking-[-0.02em] text-[#3d2a1f]">
              My Puppy Portal Page
            </div>
            <div className="mt-1 text-sm font-semibold leading-snug text-[#6d5341]">
              Southwest Virginia Chihuahua
            </div>
            <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#a2784f]">
              Virginia’s Premier Chihuahua Breeder
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[26px] border border-[#eadbc9] bg-white/80 p-4 shadow-[0_14px_34px_rgba(120,88,56,0.08)] backdrop-blur-sm">
        <div className="text-[1rem] font-extrabold tracking-[-0.02em] text-[#3d2a1f]">
          Welcome {displayName}
        </div>

        <div className="mt-3 space-y-2.5">
          <div className="rounded-[18px] border border-[#f0e4d7] bg-[#fffaf5] px-3.5 py-2.5">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#b18459]">
              Puppy
            </div>
            <div className="mt-1 text-sm font-semibold text-[#5b4331]">{puppyName}</div>
          </div>

          <div className="rounded-[18px] border border-[#f0e4d7] bg-[#fffaf5] px-3.5 py-2.5">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#b18459]">
              Sign-up Date
            </div>
            <div className="mt-1 text-sm font-semibold text-[#5b4331]">{signupDate}</div>
          </div>

          <div className="rounded-[18px] border border-[#f0e4d7] bg-[#fffaf5] px-3.5 py-2.5">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#b18459]">
              Application Date
            </div>
            <div className="mt-1 text-sm font-semibold text-[#5b4331]">{applicationDate}</div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 rounded-[26px] border border-[#eadbc9] bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(250,244,236,0.92))] p-3 shadow-[0_14px_36px_rgba(120,88,56,0.08)] backdrop-blur-sm">
        <nav className="space-y-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={navItemClassName(item.active)}>
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className={[
                    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border text-sm transition-colors",
                    item.active
                      ? "border-[#d8b28a] bg-white/90"
                      : "border-[#f0e4d7] bg-[#fffaf5] group-hover:border-[#e6c7a7]",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {item.mascot}
                </span>
                <span className="truncate text-[13px] font-bold leading-tight">{item.label}</span>
              </span>

              {typeof item.badge === "number" && item.badge > 0 ? (
                <span className="inline-flex min-w-[28px] items-center justify-center rounded-full bg-[#8f6945] px-2 py-1 text-[10px] font-black text-white shadow-sm">
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
        String(
          readRecordValue(buyer, ["portal_profile_photo_url"]) ||
            user?.user_metadata?.avatar_url ||
            ""
        )
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

  const signupDate = useMemo(() => {
    const value =
      readRecordValue(buyer, ["created_at", "signup_date", "sign_up_date"]) ||
      readRecordValue(user, ["created_at"]);
    return formatPortalDateValue(value);
  }, [buyer, user]);

  const applicationDate = useMemo(() => {
    const value = readRecordValue(application, [
      "date_applied",
      "application_date",
      "submitted_at",
      "created_at",
    ]);
    return formatPortalDateValue(value);
  }, [application]);

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
    mascot: item.mascot,
    active: item.match ? item.match(pathname) : pathname === item.href || pathname.startsWith(`${item.href}/`),
    badge:
      item.href === "/portal/messages"
        ? portalMessages.filter((entry) => entry.sender === "admin" && !entry.read_by_user).length
        : undefined,
  }));

  const profilePhotoUrl =
    profilePicturePreviewUrl ||
    String(readRecordValue(buyer, ["portal_profile_photo_url"]) || user?.user_metadata?.avatar_url || "");

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

  function openChiChiFromHelp() {
    const selectors = [
      '[data-chichi-launcher="true"]',
      'button[aria-label*="ChiChi"]',
      'button[aria-label*="chat"]',
      'button[title*="ChiChi"]',
      'button[title*="chat"]',
    ];

    for (const selector of selectors) {
      const candidate = document.querySelector(selector) as HTMLButtonElement | null;
      if (candidate) {
        candidate.click();
        return;
      }
    }

    const fallback = Array.from(document.querySelectorAll("button")).find((button) => {
      const text = `${button.textContent || ""} ${button.getAttribute("aria-label") || ""} ${button.getAttribute("title") || ""}`.toLowerCase();
      return text.includes("chichi") || text.includes("chat");
    }) as HTMLButtonElement | undefined;

    fallback?.click();
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,250,244,0.95),rgba(249,244,236,0.92)_34%,rgba(244,236,226,0.88)_100%)] text-[var(--portal-text)]">
      <div className="grid min-h-screen lg:grid-cols-[352px_minmax(0,1fr)] xl:grid-cols-[382px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[#eadbc9] bg-[linear-gradient(180deg,rgba(255,252,248,0.88),rgba(248,240,231,0.82))] px-4 py-4 backdrop-blur-sm lg:block">
          <div className="sticky top-4 h-[calc(100vh-2rem)]">
            <SidebarChrome
              displayName={displayName}
              puppyName={puppyName}
              signupDate={signupDate}
              applicationDate={applicationDate}
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
            <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-6">
              <div className="rounded-[28px] border border-[#eadbc9] bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(250,244,236,0.96))] px-5 py-4 shadow-[0_14px_34px_rgba(120,88,56,0.1)]">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#b18459]">
                      Southwest Virginia Chihuahua
                    </div>
                    <h1 className="mt-1 truncate text-[1.8rem] font-extrabold tracking-[-0.04em] text-[#3d2a1f]">
                      {pageTitle}
                    </h1>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsNotificationsOpen(true)}
                      className="relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#eadbc9] bg-white text-[#5f4634] shadow-sm transition hover:border-[#d8b28a] hover:bg-[#fffaf5]"
                      aria-label="Open notifications"
                      title="Notifications"
                    >
                      <Bell className="h-5 w-5" />
                      {notifications.length > 0 ? (
                        <span className="absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#d11f2f] text-[10px] shadow-[0_0_18px_rgba(209,31,47,0.5)] animate-pulse">
                          🐾
                        </span>
                      ) : null}
                    </button>

                    <button
                      type="button"
                      onClick={openChiChiFromHelp}
                      className="inline-flex items-center gap-2 rounded-full border border-[#eadbc9] bg-white px-4 py-3 text-sm font-bold text-[#5f4634] shadow-sm transition hover:border-[#d8b28a] hover:bg-[#fffaf5]"
                    >
                      <HelpCircle className="h-4 w-4" />
                      Help and Support
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setProfileSaveText("");
                        setProfileErrorText("");
                        setIsProfileOpen(true);
                      }}
                      className="inline-flex items-center gap-3 rounded-full border border-[#eadbc9] bg-white px-3 py-2 text-left shadow-sm transition hover:border-[#d8b28a] hover:bg-[#fffaf5]"
                    >
                      <span className="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-[#e6d2bc] bg-[linear-gradient(135deg,#fffaf5,#f6eadc)] text-sm font-black text-[#6a4f3a]">
                        {profilePhotoUrl ? (
                          <img
                            src={profilePhotoUrl}
                            alt={`${displayName} profile`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          userInitial
                        )}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <div>{children}</div>
            </div>
          </main>
        </div>
      </div>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-stone-900/45 backdrop-blur-sm"
            onClick={() => setIsDrawerOpen(false)}
            aria-label="Close portal navigation"
          />
          <div className="absolute left-0 top-0 h-full w-[90%] max-w-[376px] border-r border-[#eadbc9] bg-[linear-gradient(180deg,rgba(255,252,248,0.98),rgba(248,240,231,0.98))] px-4 py-4 shadow-[0_30px_80px_rgba(40,28,20,0.2)]">
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#eadbc9] bg-white text-[#5b4331] shadow-sm"
                aria-label="Close portal navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="h-[calc(100%-3.75rem)] overflow-y-auto pr-1">
              <SidebarChrome
                displayName={displayName}
                puppyName={puppyName}
                signupDate={signupDate}
                applicationDate={applicationDate}
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
            className="absolute inset-0 bg-stone-900/45 backdrop-blur-sm"
            onClick={() => setIsNotificationsOpen(false)}
            aria-label="Close notifications"
          />

          <aside className="absolute right-0 top-0 h-full w-full max-w-[460px] border-l border-[#eadbc9] bg-[linear-gradient(180deg,rgba(255,252,248,0.98),rgba(248,240,231,0.98))] shadow-[0_30px_80px_rgba(40,28,20,0.22)]">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-[#eadbc9] px-5 py-4">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b18459]">
                    Buyer Notifications
                  </div>
                  <div className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-[#3d2a1f]">
                    Notifications
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsNotificationsOpen(false)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#eadbc9] bg-white text-[#5b4331] shadow-sm"
                  aria-label="Close notifications"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center justify-between border-b border-[#f0e4d7] px-5 py-3">
                <div className="text-sm font-semibold text-[#6a4f3a]">
                  {notifications.length} active notification{notifications.length === 1 ? "" : "s"}
                </div>

                <button
                  type="button"
                  onClick={() => void clearAllNotifications()}
                  className="text-sm font-bold text-[#8f6945] transition hover:text-[#6f4f35]"
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
                        className="rounded-[24px] border border-[#eadbc9] bg-white/92 p-4 shadow-[0_10px_28px_rgba(120,88,56,0.08)]"
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
                              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-[#f0e4d7] bg-[#fffaf5] text-base">
                                {item.tone === "message" ? "💌" : null}
                                {item.tone === "health" ? "🦴" : null}
                                {item.tone === "update" ? "🐾" : null}
                                {item.tone === "document" ? "📄" : null}
                                {item.tone === "transport" ? "🚗" : null}
                              </span>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-extrabold text-[#3d2a1f]">
                                  {item.title}
                                </div>
                                <div className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[#b18459]">
                                  {item.dateLabel}
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 text-sm leading-6 text-[#6a4f3a]">{item.body}</div>
                          </button>

                          <button
                            type="button"
                            onClick={() => void dismissNotification(item.key)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#eadbc9] bg-white text-[#8b6a52] transition hover:bg-[#fff7ef]"
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
                  <div className="rounded-[26px] border border-[#eadbc9] bg-white/90 p-6 text-center shadow-[0_10px_28px_rgba(120,88,56,0.08)]">
                    <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-[#f0e4d7] bg-[#fffaf5] text-2xl">
                      🐾
                    </div>
                    <div className="mt-4 text-lg font-extrabold tracking-[-0.02em] text-[#3d2a1f]">
                      No new notifications
                    </div>
                    <div className="mt-2 text-sm leading-6 text-[#6a4f3a]">
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
            className="absolute inset-0 bg-stone-900/45 backdrop-blur-sm"
            onClick={() => setIsProfileOpen(false)}
            aria-label="Close profile panel"
          />

          <aside className="absolute right-0 top-0 h-full w-full max-w-[520px] border-l border-[#eadbc9] bg-[linear-gradient(180deg,rgba(255,252,248,0.98),rgba(248,240,231,0.98))] shadow-[0_30px_80px_rgba(40,28,20,0.22)]">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-[#eadbc9] px-5 py-4">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b18459]">
                    Buyer Profile
                  </div>
                  <div className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-[#3d2a1f]">
                    Profile
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsProfileOpen(false)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#eadbc9] bg-white text-[#5b4331] shadow-sm"
                  aria-label="Close profile"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5">
                <div className="rounded-[28px] border border-[#eadbc9] bg-white/92 p-5 shadow-[0_14px_34px_rgba(120,88,56,0.08)]">
                  <div className="flex items-center gap-4">
                    <div className="inline-flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-[#eadbc9] bg-[linear-gradient(135deg,#fffaf5,#f1e3d3)] text-xl font-black text-[#6a4f3a]">
                      {profilePicturePreviewUrl ? (
                        <img
                          src={profilePicturePreviewUrl}
                          alt={`${displayName} profile`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        displayName?.[0] || "U"
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-extrabold tracking-[-0.03em] text-[#3d2a1f]">
                        {displayName}
                      </div>
                      <div className="mt-1 text-sm text-[#6a4f3a]">{displayEmail}</div>

                      <label className="mt-3 inline-flex cursor-pointer items-center rounded-full border border-[#eadbc9] bg-[#fffaf5] px-4 py-2 text-sm font-bold text-[#6a4f3a] transition hover:border-[#d7b998]">
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
                    <div className="rounded-2xl border border-[#efc7c7] bg-[#fff3f3] px-4 py-3 text-sm font-semibold text-[#9b3e3e]">
                      {profileErrorText}
                    </div>
                  ) : null}

                  {profileSaveText ? (
                    <div className="rounded-2xl border border-[#d5e6cf] bg-[#f6fff2] px-4 py-3 text-sm font-semibold text-[#486d39]">
                      {profileSaveText}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="border-t border-[#eadbc9] px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setIsProfileOpen(false)}
                    className="inline-flex items-center justify-center rounded-full border border-[#eadbc9] bg-white px-5 py-3 text-sm font-bold text-[#5f4634] shadow-sm transition hover:bg-[#fffaf5]"
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    onClick={() => void saveProfile()}
                    disabled={isSavingProfile}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#8f6945] px-5 py-3 text-sm font-black text-white shadow-[0_12px_30px_rgba(111,79,53,0.22)] transition hover:bg-[#775438] disabled:cursor-not-allowed disabled:opacity-70"
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
    <div className="rounded-[24px] border border-[#eadbc9] bg-white/92 p-4 shadow-[0_10px_24px_rgba(120,88,56,0.06)]">
      <label className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b18459]">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-[#eadbc9] bg-[#fffaf5] px-4 py-3 text-sm font-semibold text-[#4d3422] outline-none transition focus:border-[#c69f76]"
      />
    </div>
  );
}