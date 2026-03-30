"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  Bell,
  BookOpen,
  CalendarDays,
  CarFront,
  ChevronDown,
  ClipboardList,
  CreditCard,
  ExternalLink,
  FileText,
  Home,
  Mail,
  Menu,
  MessageCircle,
  PawPrint,
  ShieldCheck,
  Sparkles,
  UserCircle2,
  X,
} from "lucide-react";
import { sb } from "@/lib/utils";
import { PortalChiChiWidget, type PortalAdminAuth, type PortalChatMessage } from "@/components/portal/chichi-widget";
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

type NavItem = {
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

const navItems: NavItem[] = [
  {
    href: "/portal",
    label: "Overview",
    icon: <Home className="h-4 w-4" />,
    match: (pathname) => pathname === "/portal",
  },
  { href: "/portal/application", label: "Application", icon: <ClipboardList className="h-4 w-4" /> },
  { href: "/portal/mypuppy", label: "My Puppy", icon: <PawPrint className="h-4 w-4" /> },
  { href: "/portal/updates", label: "Pupdates", icon: <CalendarDays className="h-4 w-4" /> },
  { href: "/portal/documents", label: "Documents", icon: <FileText className="h-4 w-4" /> },
  { href: "/portal/payments", label: "Payments", icon: <CreditCard className="h-4 w-4" /> },
  { href: "/portal/messages", label: "Messages", icon: <MessageCircle className="h-4 w-4" /> },
  { href: "/portal/transportation", label: "Transporation", icon: <CarFront className="h-4 w-4" /> },
  { href: "/portal/resources", label: "Resources", icon: <BookOpen className="h-4 w-4" /> },
];

const defaultChiChiMessage: PortalChatMessage = {
  id: makeId("assistant"),
  role: "assistant",
  text: "Hi, I am ChiChi. I can help with your portal account, puppy journey, payments, documents, breeder messages, and Chihuahua questions.",
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
  const direct = navItems.find((item) =>
    item.match ? item.match(pathname) : pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
  if (direct) return direct.label;
  if (pathname.startsWith("/portal/profile")) return "Profile";
  if (pathname.startsWith("/portal/help")) return "Help and Support";
  if (pathname.startsWith("/portal/notifications")) return "Notifications";
  if (pathname.startsWith("/portal/available-puppies")) return "Available Puppies";
  return "Portal";
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
  const displayEmail = user?.email || buyer?.email || application?.email || application?.applicant_email || "No email on file";
  const displayPhone = buyer?.phone || application?.phone || "No phone on file";
  const userInitial = (displayName?.[0] || displayEmail?.[0] || "U").toUpperCase();
  const hasAdminUi = isPortalAdminEmail(user?.email) || !!adminAuth?.canWriteCore;
  const pageTitle = pageTitleFromPath(pathname);
  const puppyName = portalPuppyName(puppy);

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

  function SidebarContent() {
    return (
      <div className="flex h-full flex-col gap-5">
        <div className="rounded-[30px] border border-[#eadccf] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2ea_100%)] p-5 shadow-[0_20px_54px_rgba(99,69,39,0.09)]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#d4a35d_0%,#b77a31_100%)] text-white shadow-[0_14px_28px_rgba(183,122,49,0.22)]">
              <PawPrint className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-semibold text-[#2f2218]">Puppy Portal</div>
              <div className="text-xs text-[#8d6c4b]">Southwest Virginia Chihuahua</div>
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-[#eadccf] bg-white px-4 py-4 shadow-[0_12px_28px_rgba(99,69,39,0.05)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#a17848]">Welcome</div>
            <div className="mt-2 text-lg font-semibold text-[#2f2218]">{displayName}</div>
            <div className="mt-1 text-sm leading-6 text-[#72553c]">
              Your puppy journey, documents, payments, and breeder updates stay organized here.
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-2 rounded-[30px] border border-[#eadccf] bg-[linear-gradient(180deg,#fffdfb_0%,#f7efe6_100%)] p-4 shadow-[0_20px_54px_rgba(99,69,39,0.08)]">
          {navItems.map((item) => {
            const active = item.match ? item.match(pathname) : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href} className={navItemClass(active)}>
                <span className={navIconClass(active)}>{item.icon}</span>
                <span className="text-sm font-semibold">{item.label}</span>
                {item.href === "/portal/messages" && unreadMessageCount > 0 ? (
                  <span className="ml-auto inline-flex min-w-[22px] items-center justify-center rounded-full bg-[#cf6a43] px-2 py-1 text-[10px] font-semibold text-white">
                    {unreadMessageCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="rounded-[30px] border border-[#eadccf] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2ea_100%)] p-4 shadow-[0_18px_42px_rgba(99,69,39,0.08)]">
          <div className="space-y-3">
            <Link href="/portal/notifications" className="flex items-center justify-between rounded-2xl border border-[#eadccf] bg-white px-4 py-3 text-sm font-semibold text-[#2f2218] transition hover:border-[#d7b58e]">
              <span className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-[#a17848]" />
                Notifications
              </span>
              <span className="text-xs text-[#8d6c4b]">{notificationCount}</span>
            </Link>
            <Link href="/portal/profile" className="flex items-center justify-between rounded-2xl border border-[#eadccf] bg-white px-4 py-3 text-sm font-semibold text-[#2f2218] transition hover:border-[#d7b58e]">
              <span className="flex items-center gap-3">
                <UserCircle2 className="h-4 w-4 text-[#a17848]" />
                Profile
              </span>
              <span className="text-xs text-[#8d6c4b]">Account</span>
            </Link>
            <Link href="/portal/help" className="flex items-center justify-between rounded-2xl border border-[#eadccf] bg-white px-4 py-3 text-sm font-semibold text-[#2f2218] transition hover:border-[#d7b58e]">
              <span className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-[#a17848]" />
                Help and Support
              </span>
              <span className="text-xs text-[#8d6c4b]">Open</span>
            </Link>
            <Link href="/portal/available-puppies" className="flex items-center justify-between rounded-2xl border border-[#eadccf] bg-white px-4 py-3 text-sm font-semibold text-[#2f2218] transition hover:border-[#d7b58e]">
              <span className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 text-[#a17848]" />
                Available Puppies
              </span>
              <ExternalLink className="h-4 w-4 text-[#8d6c4b]" />
            </Link>
          </div>

          <div ref={userMenuRef} className="relative mt-4">
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((value) => !value)}
              className="flex w-full items-center gap-3 rounded-[24px] border border-[#eadccf] bg-white px-3 py-3 shadow-[0_12px_28px_rgba(99,69,39,0.05)] transition hover:border-[#d7b58e]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#d4a35d_0%,#b77a31_100%)] text-sm font-black text-white">
                {userInitial}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-semibold text-[#2f2218]">{displayName}</div>
                <div className="truncate text-xs text-[#8d6c4b]">{displayEmail}</div>
              </div>
              <ChevronDown className="h-4 w-4 text-[#8d6c4b]" />
            </button>

            {isUserMenuOpen ? (
              <div className="absolute bottom-[calc(100%+12px)] left-0 z-40 w-full rounded-[24px] border border-[#d8cab7] bg-[#fffaf4] p-3 shadow-[0_24px_48px_rgba(47,32,20,0.18)]">
                <div className="rounded-[18px] border border-[#eadfce] bg-white px-4 py-3">
                  <div className="text-sm font-semibold text-[#342116]">{displayName}</div>
                  <div className="mt-1 text-xs text-[#8b6b4d]">{displayEmail}</div>
                  <div className="mt-1 text-xs text-[#8b6b4d]">{displayPhone}</div>
                </div>

                <div className="mt-3 space-y-2">
                  <Link href="/portal/profile" onClick={() => setIsUserMenuOpen(false)} className="block rounded-[16px] border border-[#eadfce] bg-white px-4 py-3 text-sm font-semibold text-[#4d392a] transition hover:bg-[#fff9f3]">
                    View and Edit Profile
                  </Link>
                  {hasAdminUi ? (
                    <Link href="/admin/portal" onClick={() => setIsUserMenuOpen(false)} className="block rounded-[16px] border border-[#eadfce] bg-[#fff7ef] px-4 py-3 text-sm font-semibold text-[#4d392a] transition hover:bg-white">
                      Open Admin Portal
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      void handleSignOut();
                    }}
                    className="w-full rounded-[16px] border border-[#eadfce] bg-[#6f5037] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#5d4330]"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f0e7_0%,#f2e9df_100%)] text-[#2f2218]">
      <div className="grid min-h-screen lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[#eadccf] bg-[linear-gradient(180deg,#fbf7f2_0%,#f4eadf_100%)] px-5 py-5 lg:block">
          <SidebarContent />
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 border-b border-[#eadccf] bg-[rgba(249,243,236,0.92)] px-4 py-3 backdrop-blur md:px-6 lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#eadccf] bg-white text-[#4b3526] shadow-[0_10px_22px_rgba(99,69,39,0.06)]"
                aria-label="Open portal navigation"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1 text-center">
                <div className="truncate text-xs font-semibold uppercase tracking-[0.2em] text-[#a17848]">
                  Southwest Virginia Chihuahua
                </div>
                <div className="truncate text-base font-semibold text-[#2f2218]">{pageTitle}</div>
              </div>

              <Link
                href="/portal/messages"
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#eadccf] bg-white text-[#4b3526] shadow-[0_10px_22px_rgba(99,69,39,0.06)]"
                aria-label="Open messages"
              >
                <Mail className="h-5 w-5" />
                {unreadMessageCount > 0 ? (
                  <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#cf6a43]" />
                ) : null}
              </Link>
            </div>
          </header>

          <main className="min-h-screen px-4 py-5 md:px-6 md:py-6 xl:px-8 xl:py-8">
            <div className="mx-auto w-full max-w-[1480px]">{children}</div>
          </main>
        </div>
      </div>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[#20160f]/35 backdrop-blur-[2px]"
            onClick={() => setIsDrawerOpen(false)}
            aria-label="Close portal navigation"
          />
          <div className="absolute left-0 top-0 h-full w-[86%] max-w-[340px] border-r border-[#eadccf] bg-[linear-gradient(180deg,#fbf7f2_0%,#f4eadf_100%)] px-5 py-5 shadow-[0_30px_80px_rgba(47,32,20,0.18)]">
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#eadccf] bg-white text-[#4b3526]"
                aria-label="Close portal navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent />
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

function navItemClass(active: boolean) {
  return [
    "group flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-200",
    active
      ? "bg-white text-[#2f2218] shadow-[0_18px_34px_rgba(99,69,39,0.12)] ring-1 ring-[#ead9c7]"
      : "text-[#785b42] hover:bg-white/75 hover:text-[#2f2218]",
  ].join(" ");
}

function navIconClass(active: boolean) {
  return [
    "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200",
    active
      ? "bg-[linear-gradient(135deg,#efd4a5_0%,#d39a52_100%)] text-[#3d2918] shadow-[0_10px_20px_rgba(183,122,49,0.18)]"
      : "bg-[#f8efe5] text-[#9f7b55] group-hover:bg-white group-hover:text-[#2f2218]",
  ].join(" ");
}
