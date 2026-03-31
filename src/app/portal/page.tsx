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
  Home,
  MessageCircle,
  ShieldCheck,
  Sparkles,
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
  findHealthRecords,
  findPortalMessagesForUser,
  loadPortalContext,
  portalDisplayName,
  portalPuppyName,
  type PortalApplication,
  type PortalBuyer,
  type PortalPuppy,
} from "@/lib/portal-data";
import { isPortalAdminEmail } from "@/lib/portal-admin";

type PortalUser = {
  id?: string;
  email?: string | null;
  created_at?: string | null;
  user_metadata?: {
    full_name?: string | null;
    name?: string | null;
  };
};

type NavDefinition = {
  href: string;
  label: string;
  icon: React.ReactNode;
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
  icon: React.ReactNode;
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

const navDefinitions: NavDefinition[] = [
  {
    href: "/portal",
    label: "Overview",
    icon: <Home className="h-4 w-4" />,
    match: (pathname) => pathname === "/portal",
  },
  {
    href: "/portal/application",
    label: "Application",
    icon: <ClipboardList className="h-4 w-4" />,
  },
  {
    href: "/portal/available-puppies",
    label: "Available Puppies",
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    href: "/portal/documents",
    label: "Documents/Contracts",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    href: "/portal/resources",
    label: "Health/Resources",
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    href: "/portal/payments",
    label: "Payments",
    icon: <CreditCard className="h-4 w-4" />,
  },
  {
    href: "/portal/messages",
    label: "Portal Messages",
    icon: <MessageCircle className="h-4 w-4" />,
  },
  {
    href: "/portal/updates",
    label: "Pupdates",
    icon: <CalendarDays className="h-4 w-4" />,
  },
  {
    href: "/portal/transportation",
    label: "Transportation Request",
    icon: <CarFront className="h-4 w-4" />,
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

function getChiChiStorageKey(userId: string | undefined, suffix: string) {
  return userId ? `chichi:${userId}:${suffix}` : null;
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

  const date =
    value instanceof Date
      ? value
      : typeof value === "string" || typeof value === "number"
        ? new Date(value)
        : null;

  if (!date || Number.isNaN(date.getTime())) return "Not on file";

  return date.toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function navItemClassName(active: boolean) {
  return [
    "group flex w-full items-center justify-between rounded-[22px] border px-4 py-3.5 transition-all duration-200",
    active
      ? "border-[#b48755] bg-[linear-gradient(135deg,rgba(190,150,99,0.18),rgba(255,255,255,0.92))] text-[#4d3422] shadow-[0_14px_30px_rgba(126,92,56,0.16)]"
      : "border-white/80 bg-white/70 text-[#6f5440] hover:border-[#d9c0a3] hover:bg-white hover:text-[#4d3422] hover:shadow-[0_12px_26px_rgba(126,92,56,0.1)]",
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
    <div className="flex h-full flex-col gap-4">
      <div className="rounded-[30px] border border-[#e7d7c4] bg-[linear-gradient(135deg,rgba(255,252,247,0.96),rgba(247,238,228,0.94))] p-5 shadow-[0_24px_60px_rgba(120,88,56,0.14)]">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[24px] border border-[#e7d7c4] bg-white shadow-[0_10px_24px_rgba(120,88,56,0.12)]">
            <img
              src="https://www.swvachihuahua.com/pics/logo.jpg"
              alt="Southwest Virginia Chihuahua logo"
              className="h-full w-full object-cover"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[1.05rem] font-extrabold leading-tight tracking-[-0.02em] text-[#3d2a1f]">
              My Puppy Portal Page
            </div>
            <div className="mt-1 text-sm font-semibold leading-snug text-[#6d5341]">
              Southwest Virginia Chihuahua
            </div>
            <div className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[#a2784f]">
              Virginia’s Premier Chihuahua Breeder
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-[#eadbc9] bg-white/80 p-5 shadow-[0_16px_40px_rgba(120,88,56,0.1)] backdrop-blur-sm">
        <div className="text-[1.02rem] font-extrabold tracking-[-0.02em] text-[#3d2a1f]">
          Welcome {displayName}
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-[#f0e4d7] bg-[#fffaf5] px-4 py-3">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b18459]">
              Puppy
            </div>
            <div className="mt-1 text-sm font-semibold text-[#5b4331]">{puppyName}</div>
          </div>

          <div className="rounded-2xl border border-[#f0e4d7] bg-[#fffaf5] px-4 py-3">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b18459]">
              Sign-up Date
            </div>
            <div className="mt-1 text-sm font-semibold text-[#5b4331]">{signupDate}</div>
          </div>

          <div className="rounded-2xl border border-[#f0e4d7] bg-[#fffaf5] px-4 py-3">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b18459]">
              Application Date
            </div>
            <div className="mt-1 text-sm font-semibold text-[#5b4331]">{applicationDate}</div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 rounded-[28px] border border-[#eadbc9] bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(250,244,236,0.9))] p-4 shadow-[0_16px_44px_rgba(120,88,56,0.1)] backdrop-blur-sm">
        <nav className="space-y-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={navItemClassName(item.active)}>
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className={[
                    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-colors",
                    item.active
                      ? "border-[#d8b28a] bg-white/90 text-[#8c633d]"
                      : "border-[#f0e4d7] bg-[#fffaf5] text-[#9b7450] group-hover:border-[#e6c7a7]",
                  ].join(" ")}
                >
                  {item.icon}
                </span>
                <span className="truncate text-sm font-bold">{item.label}</span>
              </span>

              {typeof item.badge === "number" && item.badge > 0 ? (
                <span className="inline-flex min-w-[30px] items-center justify-center rounded-full bg-[#8f6945] px-2.5 py-1 text-xs font-black text-white shadow-sm">
                  {item.badge}
                </span>
              ) : (
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#b49473]">
                  Open
                </span>
              )}
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
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);

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
      setThreadId(null);
      setAdminAuth(null);
      setMessages([defaultChiChiMessage]);
      return;
    }

    try {
      const savedThreadId = localStorage.getItem(getChiChiStorageKey(user.id, "thread") || "");
      const savedAdminAuth = localStorage.getItem(getChiChiStorageKey(user.id, "admin") || "");
      const savedMessages = localStorage.getItem(getChiChiStorageKey(user.id, "messages") || "");

      if (savedThreadId) setThreadId(savedThreadId);
      if (savedAdminAuth) setAdminAuth(JSON.parse(savedAdminAuth));
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages) as PortalChatMessage[];
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
      }
    } catch (error) {
      console.error("Could not restore ChiChi conversation:", error);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    try {
      const threadKey = getChiChiStorageKey(user.id, "thread");
      const messagesKey = getChiChiStorageKey(user.id, "messages");
      const adminKey = getChiChiStorageKey(user.id, "admin");

      if (threadKey) {
        if (threadId) localStorage.setItem(threadKey, threadId);
        else localStorage.removeItem(threadKey);
      }

      if (messagesKey) localStorage.setItem(messagesKey, JSON.stringify(messages));

      if (adminKey) {
        if (adminAuth) localStorage.setItem(adminKey, JSON.stringify(adminAuth));
        else localStorage.removeItem(adminKey);
      }
    } catch (error) {
      console.error("Could not persist ChiChi conversation:", error);
    }
  }, [adminAuth, messages, threadId, user?.id]);

  useEffect(() => {
    if (!user?.id && !user?.email) {
      setBuyer(null);
      setApplication(null);
      setPuppy(null);
      setUnreadMessageCount(0);
      setNotificationCount(0);
      return;
    }

    let active = true;

    async function loadChromeData() {
      try {
        const currentUser = user as User;
        const context = await loadPortalContext(currentUser);
        const recentMessages = await findPortalMessagesForUser(currentUser, 30);
        const health = await findHealthRecords(context.puppy?.id);

        if (!active) return;

        setBuyer(context.buyer);
        setApplication(context.application);
        setPuppy(context.puppy);

        const unread = recentMessages.filter(
          (entry) => entry.sender === "admin" && !entry.read_by_user
        ).length;

        setUnreadMessageCount(unread);
        setNotificationCount(unread + health.length);
      } catch (error) {
        console.error("Could not load portal shell data:", error);
        if (!active) return;
        setUnreadMessageCount(0);
        setNotificationCount(0);
      }
    }

    void loadChromeData();

    return () => {
      active = false;
    };
  }, [pathname, user]);

  const displayName = portalDisplayName(user as User | null, buyer, application);
  const displayEmail =
    user?.email ||
    readRecordValue(buyer, ["email"]) ||
    readRecordValue(application, ["email", "applicant_email"]) ||
    "No email on file";

  const displayPhone =
    String(readRecordValue(buyer, ["phone"]) || readRecordValue(application, ["phone"]) || "No phone on file");

  const userInitial = (displayName?.[0] || String(displayEmail)?.[0] || "U").toUpperCase();
  const hasAdminUi = isPortalAdminEmail(user?.email) || !!adminAuth?.canWriteCore;
  const pageTitle = pageTitleFromPath(pathname);
  const puppyName = portalPuppyName(puppy) || "Not yet assigned";

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

  const navItems: SidebarNavItem[] = navDefinitions.map((item) => ({
    href: item.href,
    label: item.label,
    icon: item.icon,
    active: item.match ? item.match(pathname) : pathname === item.href || pathname.startsWith(`${item.href}/`),
    badge: item.href === "/portal/messages" ? unreadMessageCount : undefined,
  }));

  async function handleSignOut() {
    await sb.auth.signOut();
    setUser(null);
    setAccessToken(null);
    router.push("/portal");
    router.refresh();
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,250,244,0.95),rgba(249,244,236,0.92)_34%,rgba(244,236,226,0.88)_100%)] text-[var(--portal-text)]">
      <div className="grid min-h-screen lg:grid-cols-[390px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[#eadbc9] bg-[linear-gradient(180deg,rgba(255,252,248,0.88),rgba(248,240,231,0.82))] px-5 py-5 backdrop-blur-sm lg:block">
          <div className="sticky top-5 h-[calc(100vh-2.5rem)]">
            <SidebarChrome
              displayName={displayName}
              puppyName={puppyName}
              signupDate={signupDate}
              applicationDate={applicationDate}
              navItems={navItems}
              displayEmail={String(displayEmail)}
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
            unreadMessageCount={unreadMessageCount}
            onOpenDrawer={() => setIsDrawerOpen(true)}
          />

          <main className="min-h-screen px-4 py-5 md:px-6 md:py-6 xl:px-8 xl:py-8">
            <div className="mx-auto w-full max-w-[1380px]">{children}</div>
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
          <div className="absolute left-0 top-0 h-full w-[92%] max-w-[420px] border-r border-[#eadbc9] bg-[linear-gradient(180deg,rgba(255,252,248,0.98),rgba(248,240,231,0.98))] px-5 py-5 shadow-[0_30px_80px_rgba(40,28,20,0.2)]">
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
                displayEmail={String(displayEmail)}
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