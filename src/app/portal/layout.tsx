"use client";

import React, { useEffect, useRef, useState } from "react";
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
  PawPrint,
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
import { PortalSidebar, type PortalNavItem } from "@/components/portal/portal-sidebar";
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
  { href: "/portal/mypuppy", label: "My Puppy", icon: <PawPrint className="h-4 w-4" /> },
  { href: "/portal/updates", label: "Pupdates", icon: <CalendarDays className="h-4 w-4" /> },
  { href: "/portal/documents", label: "Documents", icon: <FileText className="h-4 w-4" /> },
  { href: "/portal/payments", label: "Payments", icon: <CreditCard className="h-4 w-4" /> },
  { href: "/portal/messages", label: "Messages", icon: <MessageCircle className="h-4 w-4" /> },
  { href: "/portal/transportation", label: "Transportation", icon: <CarFront className="h-4 w-4" /> },
  { href: "/portal/resources", label: "Resources", icon: <BookOpen className="h-4 w-4" /> },
];

const defaultChiChiMessage: PortalChatMessage = {
  id: makeId("assistant"),
  role: "assistant",
  text: "Hi, I am ChiChi. I can help with your account, puppy updates, payments, documents, transportation, and breeder messages.",
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
  if (pathname.startsWith("/portal/profile")) return "Profile";
  if (pathname.startsWith("/portal/help")) return "Help and Support";
  if (pathname.startsWith("/portal/notifications")) return "Notifications";
  if (pathname.startsWith("/portal/available-puppies")) return "Available Puppies";
  return "My Puppy Portal";
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
    buyer?.email ||
    application?.email ||
    application?.applicant_email ||
    "No email on file";
  const displayPhone = buyer?.phone || application?.phone || "No phone on file";
  const userInitial = (displayName?.[0] || displayEmail?.[0] || "U").toUpperCase();
  const hasAdminUi = isPortalAdminEmail(user?.email) || !!adminAuth?.canWriteCore;
  const pageTitle = pageTitleFromPath(pathname);
  const puppyName = portalPuppyName(puppy);

  const navItems: PortalNavItem[] = navDefinitions.map((item) => ({
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
          text: "Please sign in through the portal first so I can answer using your account information.",
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
        "I ran into an issue while loading your portal information. Please try again.";

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

  const utilityLinks = [
    {
      href: "/portal/notifications",
      label: "Notifications",
      icon: <Bell className="h-4 w-4" />,
      trailing: <span className="text-xs text-[var(--portal-text-muted)]">{notificationCount}</span>,
    },
    {
      href: "/portal/profile",
      label: "Profile",
      icon: <UserCircle2 className="h-4 w-4" />,
      trailing: <span className="text-xs text-[var(--portal-text-muted)]">Account</span>,
    },
    {
      href: "/portal/help",
      label: "Help and Support",
      icon: <ShieldCheck className="h-4 w-4" />,
      trailing: <span className="text-xs text-[var(--portal-text-muted)]">Open</span>,
    },
    {
      href: "/portal/available-puppies",
      label: "Available Puppies",
      icon: <Sparkles className="h-4 w-4" />,
      trailing: <span className="text-xs text-[var(--portal-text-muted)]">Explore</span>,
    },
  ];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--portal-bg)_0%,var(--portal-bg-alt)_100%)] text-[var(--portal-text)] [--portal-bg:#f5f8fc] [--portal-bg-alt:#edf2f8] [--portal-surface:#f9fbfe] [--portal-surface-strong:#ffffff] [--portal-surface-muted:#f3f7fb] [--portal-border:#d7e0ea] [--portal-border-strong:#c5d0dd] [--portal-text:#162033] [--portal-text-soft:#586579] [--portal-text-muted:#7c8797] [--portal-accent:#6b7fd7] [--portal-accent-strong:#4f63bd]">
      <div className="grid min-h-screen lg:grid-cols-[312px_minmax(0,1fr)] xl:grid-cols-[328px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(250,252,255,0.96)_0%,rgba(242,247,252,0.98)_100%)] px-5 py-5 lg:block">
          <PortalSidebar
            brandTitle="My Puppy Portal"
            brandSubtitle="Southwest Virginia Chihuahua"
            welcomeTitle={displayName}
            welcomeDescription={
              puppy
                ? `${puppyName} updates, documents, messages, payments, and next steps are all tied to this account.`
                : "Your application, records, messages, and next steps stay organized here."
            }
            navItems={navItems}
            utilityLinks={utilityLinks}
            footer={
              <div ref={userMenuRef}>
                <PortalUserMenu
                  displayName={displayName}
                  displayEmail={displayEmail}
                  displayPhone={displayPhone}
                  userInitial={userInitial}
                  isOpen={isUserMenuOpen}
                  hasAdminUi={hasAdminUi}
                  onToggle={() => setIsUserMenuOpen((value) => !value)}
                  onClose={() => setIsUserMenuOpen(false)}
                  onSignOut={() => {
                    setIsUserMenuOpen(false);
                    void handleSignOut();
                  }}
                />
              </div>
            }
          />
        </aside>

        <div className="min-w-0">
          <PortalMobileHeader
            pageTitle={pageTitle}
            unreadMessageCount={unreadMessageCount}
            onOpenDrawer={() => setIsDrawerOpen(true)}
          />

          <main className="min-h-screen px-4 py-5 md:px-6 md:py-6 xl:px-8 xl:py-8">
            <div className="mx-auto w-full max-w-[1560px]">{children}</div>
          </main>
        </div>
      </div>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[rgba(17,29,48,0.34)] backdrop-blur-[2px]"
            onClick={() => setIsDrawerOpen(false)}
            aria-label="Close portal navigation"
          />
          <div className="absolute left-0 top-0 h-full w-[86%] max-w-[360px] border-r border-[var(--portal-border)] bg-[linear-gradient(180deg,#fbfdff_0%,#f2f7fc_100%)] px-5 py-5 shadow-[0_30px_80px_rgba(17,29,48,0.18)]">
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-[18px] border border-[var(--portal-border)] bg-white text-[var(--portal-text)]"
                aria-label="Close portal navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <PortalSidebar
              brandTitle="My Puppy Portal"
              brandSubtitle="Southwest Virginia Chihuahua"
              welcomeTitle={displayName}
              welcomeDescription={
                puppy
                  ? `${puppyName} updates, documents, messages, payments, and next steps are all tied to this account.`
                  : "Your application, records, messages, and next steps stay organized here."
              }
              navItems={navItems}
              utilityLinks={utilityLinks}
              footer={
                <PortalUserMenu
                  displayName={displayName}
                  displayEmail={displayEmail}
                  displayPhone={displayPhone}
                  userInitial={userInitial}
                  isOpen={isUserMenuOpen}
                  hasAdminUi={hasAdminUi}
                  onToggle={() => setIsUserMenuOpen((value) => !value)}
                  onClose={() => setIsUserMenuOpen(false)}
                  onSignOut={() => {
                    setIsUserMenuOpen(false);
                    void handleSignOut();
                  }}
                />
              }
            />
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
