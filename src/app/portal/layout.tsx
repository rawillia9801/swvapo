"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Dog,
  CalendarDays,
  FileText,
  CreditCard,
  CarFront,
  MessageCircle,
  Sparkles,
  Menu,
  X,
  SendHorizonal,
  PlusCircle,
  CalendarPlus,
  DollarSign,
  FolderOpen,
  MessagesSquare,
  PawPrint,
  ExternalLink,
  Bell,
  Mail,
  ChevronDown,
} from "lucide-react";
import { sb } from "@/lib/utils";

type PortalUser = {
  id?: string;
  email?: string | null;
  user_metadata?: {
    full_name?: string | null;
    name?: string | null;
  };
};

type BuyerProfile = {
  id?: number | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  buyer_email?: string | null;
  phone?: string | null;
};

type AppProfile = {
  id?: number | null;
  full_name?: string | null;
  email?: string | null;
  applicant_email?: string | null;
  phone?: string | null;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  match?: (pathname: string) => boolean;
};

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: string;
};

type ChiChiResponse = {
  text?: string;
  assistant?: string;
  threadId?: string | null;
  adminAuth?: {
    userId?: string | null;
    email?: string | null;
    canWriteCore?: boolean;
  };
  context?: {
    buyerName?: string | null;
    puppyName?: string | null;
  };
};

type ChiChiTab = "ask" | "actions";

type QuickAction = {
  key: string;
  label: string;
  prompt: string;
  icon: React.ReactNode;
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

function cleanAssistantText(text: string) {
  return String(text || "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^>\s*/gm, "")
    .replace(/^[-â€¢]\s+/gm, "â€¢ ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderChatText(text: string) {
  const cleaned = cleanAssistantText(text);
  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="space-y-3">
      {paragraphs.map((paragraph, idx) => (
        <p key={idx} className="whitespace-pre-wrap leading-relaxed tracking-wide">
          {paragraph}
        </p>
      ))}
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

  const [isChiChiOpen, setIsChiChiOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ChiChiTab>("ask");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [buyerName, setBuyerName] = useState<string | null>(null);
  const [puppyName, setPuppyName] = useState<string | null>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [profile, setProfile] = useState<BuyerProfile | AppProfile | null>(null);
  const [adminAuth, setAdminAuth] = useState<{
    userId?: string | null;
    email?: string | null;
    canWriteCore?: boolean;
  } | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: makeId("assistant"),
      role: "assistant",
      text: "Hi, I'm your personal ChiChi Assistant. Ask me about your account, payments, messages, documents, puppy updates, or general Chihuahua questions anytime.",
      createdAt: formatTime(),
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      const {
        data: { session },
      } = await sb.auth.getSession();

      if (!mounted) return;
      setUser((session?.user as PortalUser) ?? null);
      setAccessToken(session?.access_token ?? null);
    };

    loadUser();

    const { data: authListener } = sb.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        setUser((session?.user as PortalUser) ?? null);
        setAccessToken(session?.access_token ?? null);
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isChiChiOpen) {
      requestAnimationFrame(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    }
  }, [messages, isChiChiOpen, isSending]);

  useEffect(() => {
    if (!user?.id && !user?.email) {
      setUnreadMessageCount(0);
      setNotificationCount(0);
      setProfile(null);
      return;
    }

    let active = true;

    const loadPortalChromeData = async () => {
      const email = String(user?.email || "").trim().toLowerCase();
      const uid = user?.id;

      let unread = 0;
      let notifications = 0;
      let matchedBuyer: BuyerProfile | null = null;
      let matchedApp: AppProfile | null = null;
      let puppyId: number | null = null;

      if (uid) {
        const unreadByUser = await sb
          .from("portal_messages")
          .select("id", { count: "exact", head: true })
          .eq("user_id", uid)
          .eq("read_by_user", false);

        if (!unreadByUser.error) unread = unreadByUser.count || 0;
      }

      if (!unread && email) {
        const unreadByEmail = await sb
          .from("portal_messages")
          .select("id", { count: "exact", head: true })
          .ilike("user_email", email)
          .eq("read_by_user", false);

        if (!unreadByEmail.error) unread = unreadByEmail.count || 0;
      }

      if (uid) {
        const buyerByUser = await sb
          .from("buyers")
          .select("id,full_name,name,email,buyer_email,phone")
          .eq("user_id", uid)
          .limit(1)
          .maybeSingle();

        if (!buyerByUser.error && buyerByUser.data) matchedBuyer = buyerByUser.data as BuyerProfile;
      }

      if (!matchedBuyer && email) {
        const buyerByEmail = await sb
          .from("buyers")
          .select("id,full_name,name,email,buyer_email,phone")
          .or(`email.ilike.${email},buyer_email.ilike.${email}`)
          .limit(1)
          .maybeSingle();

        if (!buyerByEmail.error && buyerByEmail.data) matchedBuyer = buyerByEmail.data as BuyerProfile;
      }

      if (uid) {
        const appByUser = await sb
          .from("puppy_applications")
          .select("id,full_name,email,applicant_email,phone")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!appByUser.error && appByUser.data) matchedApp = appByUser.data as AppProfile;
      }

      if (!matchedApp && email) {
        const appByEmail = await sb
          .from("puppy_applications")
          .select("id,full_name,email,applicant_email,phone")
          .or(`email.ilike.${email},applicant_email.ilike.${email}`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!appByEmail.error && appByEmail.data) matchedApp = appByEmail.data as AppProfile;
      }

      if (matchedBuyer?.id) {
        const puppyRes = await sb
          .from("puppies")
          .select("id")
          .eq("buyer_id", matchedBuyer.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!puppyRes.error && puppyRes.data?.id) puppyId = Number(puppyRes.data.id);
      }

      if (puppyId) {
        const thirtyDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)
          .toISOString()
          .slice(0, 10);

        const [eventCountRes, healthCountRes] = await Promise.all([
          sb
            .from("puppy_events")
            .select("id", { count: "exact", head: true })
            .eq("puppy_id", puppyId)
            .gte("event_date", thirtyDaysAgo),
          sb
            .from("puppy_health")
            .select("id", { count: "exact", head: true })
            .eq("puppy_id", puppyId)
            .eq("is_visible_to_buyer", true)
            .gte("record_date", thirtyDaysAgo),
        ]);

        notifications += (eventCountRes.count || 0) + (healthCountRes.count || 0);
      }

      notifications += unread;

      if (!active) return;
      setUnreadMessageCount(unread);
      setNotificationCount(notifications);
      setProfile(matchedBuyer || matchedApp);
    };

    void loadPortalChromeData();

    return () => {
      active = false;
    };
  }, [user?.email, user?.id, pathname]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const nav: NavItem[] = useMemo(
    () => [
      {
        href: "/portal",
        label: "Overview",
        icon: <Home className="h-[18px] w-[18px]" />,
        match: (p) => p === "/portal",
      },
      {
        href: "/portal/mypuppy",
        label: "My Puppy",
        icon: <Dog className="h-[18px] w-[18px]" />,
      },
      {
        href: "/portal/updates",
        label: "Updates",
        icon: <CalendarDays className="h-[18px] w-[18px]" />,
      },
      {
        href: "/portal/documents",
        label: "Contracts & Docs",
        icon: <FileText className="h-[18px] w-[18px]" />,
      },
      {
        href: "/portal/payments",
        label: "Payments",
        icon: <CreditCard className="h-[18px] w-[18px]" />,
      },
      {
        href: "/portal/transportation",
        label: "Transporation",
        icon: <CarFront className="h-[18px] w-[18px]" />,
      },
      {
        href: "/portal/resources",
        label: "Resources",
        icon: <ExternalLink className="h-[18px] w-[18px]" />,
      },
      {
        href: "/portal/messages",
        label: "Messages",
        icon: <MessageCircle className="h-[18px] w-[18px]" />,
      },
      {
        href: "/portal/available-puppies",
        label: "Available Puppies",
        icon: <Sparkles className="h-[18px] w-[18px]" />,
      },
    ],
    []
  );

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "Portal User";

  const userInitial = (displayName?.[0] || user?.email?.[0] || "U").toUpperCase();
  const activeNavItem = nav.find((item) => isActive(item));
  const pageTitle =
    activeNavItem?.label ||
    (pathname.startsWith("/portal/profile")
      ? "Profile"
      : pathname.startsWith("/portal/notifications")
        ? "Notifications"
        : pathname.startsWith("/portal/help")
          ? "Help and Support"
          : "Portal");

  const hasAdminUi = !!user?.id;

  const coreActions: QuickAction[] = [
    {
      key: "add-buyer",
      label: "Add Buyer",
      prompt: "Core action: add a new buyer record. I will provide the buyer details next.",
      icon: <PlusCircle className="h-4 w-4" />,
    },
    {
      key: "add-puppy",
      label: "Add Puppy",
      prompt: "Core action: add a new puppy record. I will provide the puppy details next.",
      icon: <PlusCircle className="h-4 w-4" />,
    },
    {
      key: "edit-puppy",
      label: "Edit Puppy",
      prompt:
        "Core action: edit a puppy record. I will provide the puppy name and the fields to update next, such as microchip, registration number, litter name, sire, dam, description, notes, or weights.",
      icon: <PawPrint className="h-4 w-4" />,
    },
    {
      key: "delete-puppy",
      label: "Delete Puppy",
      prompt: "Core action: delete puppy records. I will provide the puppy name or names next.",
      icon: <PawPrint className="h-4 w-4" />,
    },
    {
      key: "add-event",
      label: "Add Puppy Event",
      prompt: "Core action: add a puppy event. I will provide the puppy name, date, title, and details next.",
      icon: <CalendarPlus className="h-4 w-4" />,
    },
    {
      key: "log-payment",
      label: "Log Payment",
      prompt: "Core action: log a buyer payment. I will provide the buyer, amount, date, and method next.",
      icon: <DollarSign className="h-4 w-4" />,
    },
    {
      key: "edit-payment",
      label: "Edit Payment",
      prompt: "Core action: edit a payment record. I will provide the buyer, payment date or reference, and the fields to update next.",
      icon: <DollarSign className="h-4 w-4" />,
    },
    {
      key: "delete-payment",
      label: "Delete Payment",
      prompt: "Core action: delete a payment record. I will provide the buyer and payment reference details next.",
      icon: <DollarSign className="h-4 w-4" />,
    },
    {
      key: "add-weight",
      label: "Add Weight",
      prompt: "Core action: add a puppy weight entry. I will provide the puppy, date, and weight next.",
      icon: <PawPrint className="h-4 w-4" />,
    },
    {
      key: "open-documents",
      label: "Open Documents",
      prompt: "Show me the documents for this account.",
      icon: <FolderOpen className="h-4 w-4" />,
    },
    {
      key: "open-messages",
      label: "Open Messages",
      prompt: "Show me recent messages for this account.",
      icon: <MessagesSquare className="h-4 w-4" />,
    },
    {
      key: "open-puppy",
      label: "Open My Puppy",
      prompt: "Show me my puppy summary.",
      icon: <PawPrint className="h-4 w-4" />,
    },
  ];

  async function handleSignOut() {
    await sb.auth.signOut();
    setUser(null);
    setAccessToken(null);
    setIsDrawerOpen(false);
    setIsChiChiOpen(false);
    router.push("/portal");
    router.refresh();
  }

  function isActive(item: NavItem) {
    if (item.match) return item.match(pathname);
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  function navClass(item: NavItem) {
    const active = isActive(item);
    return [
      "group flex items-center gap-3.5 rounded-2xl px-4 py-3.5 transition-all duration-300 ease-out",
      active
        ? "border border-[#806448] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] text-[#f4dfbf] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_24px_rgba(0,0,0,0.22)]"
        : "border border-transparent text-[#c6b8a8] hover:border-white/5 hover:bg-white/4 hover:text-white hover:translate-x-1",
    ].join(" ");
  }

  function iconWrapClass(item: NavItem) {
    const active = isActive(item);
    return [
      "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300",
      active
        ? "bg-[#c7954b] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]"
        : "bg-white/5 text-[#bba58d] group-hover:bg-white/10 group-hover:text-white group-hover:scale-110",
    ].join(" ");
  }

  async function sendChiChiMessage(e?: React.FormEvent, overrideText?: string) {
    e?.preventDefault();
    const text = (overrideText ?? chatDraft).trim();
    if (!text || isSending) return;

    const userMessage: ChatMessage = {
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
      const routeMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.text,
      }));

      const res = await fetch("/api/buildlio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          threadId,
          accessToken,
          max_tokens: 1200,
          messages: routeMessages,
        }),
      });

      const data = (await res.json()) as ChiChiResponse;

      const reply =
        data?.text?.trim() ||
        "I ran into an issue while loading your portal information. Please try again.";

      if (data?.threadId) setThreadId(data.threadId);
      if (data?.context?.buyerName) setBuyerName(data.context.buyerName);
      if (data?.context?.puppyName) setPuppyName(data.context.puppyName);
      if (data?.adminAuth) setAdminAuth(data.adminAuth);

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
      console.error("ChiChi chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: makeId("assistant"),
          role: "assistant",
          text: "I ran into a connection problem while trying to answer that. Please try again.",
          createdAt: formatTime(),
        },
      ]);
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => chatInputRef.current?.focus());
    }
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendChiChiMessage();
    }
  }

  return (
    <div className="min-h-screen bg-[#FDFCF8] text-[#2D2825]">
      {/* Mobile Header */}
      <header className="sticky top-0 z-40 border-b border-black/5 bg-[#1C1614]/95 backdrop-blur-md text-white shadow-sm md:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
            aria-label="Open portal menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#D9A05B] to-[#C0853E] text-white shadow-md">
              <Dog className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#D9A05B]">
                SW VA Chihuahua
              </div>
              <div className="font-serif text-[20px] leading-none text-white tracking-wide">
                My Puppy Portal
              </div>
            </div>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm font-semibold tracking-wider text-white">
            {userInitial}
          </div>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#1C1614]/60 backdrop-blur-sm transition-opacity md:hidden"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[86%] max-w-[320px] transform bg-transparent p-3 transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) md:hidden ${
          isDrawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col rounded-[2rem] border border-white/10 bg-gradient-to-b from-[#1C1614] to-[#120D0A] px-5 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
          <div className="flex items-start justify-between gap-3 px-1">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D9A05B] to-[#C0853E] text-white shadow-lg shadow-orange-900/20">
                <Dog className="h-6 w-6" />
              </div>
              <div className="leading-tight">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D9A05B]">
                  SW VA Chihuahua
                </div>
                <div className="font-serif text-[22px] leading-none text-white tracking-wide">
                  Puppy Portal
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsDrawerOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Close portal menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="mt-8 flex-1 space-y-2">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className={navClass(item)}>
                <span className={iconWrapClass(item)}>{item.icon}</span>
                <span className="whitespace-nowrap text-[15px] font-medium leading-tight tracking-wide">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-6 border-t border-white/10 pt-6">
            <button
              onClick={handleSignOut}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-[15px] font-medium text-white transition-all hover:bg-white/10 hover:shadow-md"
            >
              Sign out
            </button>
            <div className="mt-4 px-2 text-center text-xs text-[#A89F96]">
              Signed in as <br />
              <span className="font-medium text-white/90">{user?.email || "â€”"}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Desktop Layout */}
      <div className="flex min-h-screen bg-[radial-gradient(circle_at_top,#f8f1e8_0%,#f3eadf_42%,#eee3d7_100%)]">
        {/* Desktop Sidebar */}
        <aside className="hidden w-[220px] shrink-0 border-r border-[#46372b] bg-[linear-gradient(180deg,#2d2924_0%,#23201c_100%)] md:block">
          <div className="sticky top-0 flex h-screen flex-col text-white shadow-[4px_0_24px_rgba(0,0,0,0.15)]">
            <div className="border-b border-white/8 px-4 py-6">
              <div className="flex flex-col items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D9A05B] to-[#C0853E] text-white shadow-lg shadow-orange-900/20">
                  <Dog className="h-6 w-6" />
                </div>
                <div className="leading-tight">
                  <div className="font-serif text-[17px] leading-none text-[#f4eadf]">
                    Puppy
                  </div>
                  <div className="mt-1 font-serif text-[17px] leading-none text-[#f4eadf]">
                    Portal
                  </div>
                </div>
              </div>
            </div>

            <nav className="flex-1 space-y-2 px-3 py-5">
              {nav.map((item) => (
                <Link key={item.href} href={item.href} className={navClass(item)}>
                  <span className={iconWrapClass(item)}>{item.icon}</span>
                  <span className="whitespace-nowrap text-[13px] font-medium leading-tight tracking-wide">
                    {item.label}
                  </span>
                </Link>
              ))}
            </nav>

            <div className="border-t border-white/8 px-3 py-5">
              <Link
                href="/portal/help"
                className="block rounded-2xl border border-white/8 bg-white/5 p-3 transition hover:bg-white/10"
              >
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d1b082]">
                  Help and Support
                </div>
                <div className="mt-2 text-[11px] leading-5 text-[#d5c7b8]">
                  Troubleshooting, account help, and portal guidance.
                </div>
              </Link>
              <div className="mt-3">
                <button
                  onClick={handleSignOut}
                  className="mt-4 w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 text-[12px] font-black uppercase tracking-[0.14em] text-[#f7efe6] transition hover:bg-white/14"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="min-w-0 flex-1">
          <div className="border-b border-[#d8cab7] bg-[linear-gradient(180deg,#3a352f_0%,#2e2a25_100%)] text-[#f3e4ca] shadow-[0_12px_30px_rgba(56,42,30,0.14)]">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8 lg:px-12">
              <div className="min-w-0">
                <div className="font-serif text-2xl leading-none tracking-wide text-[#f6efe7]">
                  {pageTitle}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/portal/notifications"
                  className="relative hidden h-10 w-10 items-center justify-center rounded-full border border-[#6a5641] bg-[#403730] text-[#e9cc98] transition hover:bg-[#4a4038] sm:inline-flex"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {notificationCount > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#d97540] px-1 text-[10px] font-black text-white">
                      {notificationCount > 9 ? "9+" : notificationCount}
                    </span>
                  ) : null}
                </Link>
                <Link
                  href="/portal/messages"
                  className="relative hidden h-10 w-10 items-center justify-center rounded-full border border-[#6a5641] bg-[#403730] text-[#e9cc98] transition hover:bg-[#4a4038] sm:inline-flex"
                  aria-label="Messages"
                >
                  <Mail className="h-4 w-4" />
                  {unreadMessageCount > 0 ? (
                    <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
                  ) : null}
                </Link>

                <div ref={userMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsUserMenuOpen((value) => !value)}
                    className="flex items-center gap-3 rounded-full border border-[#6a5641] bg-[#403730] py-1.5 pl-1.5 pr-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:bg-[#4a4038]"
                    aria-label="Open profile menu"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#e0bb85] to-[#bb8749] text-sm font-black text-[#24180f]">
                      {userInitial}
                    </div>
                    <div className="hidden sm:block">
                      <div className="max-w-[140px] truncate text-sm font-semibold text-[#f7f1e8]">
                        {displayName}
                      </div>
                      <div className="max-w-[140px] truncate text-[10px] uppercase tracking-[0.16em] text-[#d9bb88]">
                        {profile?.phone || user?.email || "Profile"}
                      </div>
                    </div>
                    <ChevronDown className="h-4 w-4 text-[#d9bb88]" />
                  </button>

                  {isUserMenuOpen ? (
                    <div className="absolute right-0 top-[calc(100%+12px)] z-50 w-[270px] rounded-[1.5rem] border border-[#d8cab7] bg-[#fffaf4] p-3 text-[#4d392a] shadow-[0_24px_48px_rgba(47,32,20,0.18)]">
                      <div className="rounded-[1.1rem] border border-[#eadfce] bg-white px-4 py-3">
                        <div className="text-sm font-black text-[#342116]">{displayName}</div>
                        <div className="mt-1 text-xs text-[#8b6b4d]">{user?.email || "No email on file"}</div>
                        <div className="mt-1 text-xs text-[#8b6b4d]">{profile?.phone || "No phone on file"}</div>
                      </div>

                      <div className="mt-3 space-y-2">
                        <Link
                          href="/portal/profile"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="block rounded-[1rem] border border-[#eadfce] bg-white px-4 py-3 text-sm font-semibold transition hover:bg-[#fff9f3]"
                        >
                          View and Edit Profile
                        </Link>
                        <Link
                          href="/portal/notifications"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center justify-between rounded-[1rem] border border-[#eadfce] bg-white px-4 py-3 text-sm font-semibold transition hover:bg-[#fff9f3]"
                        >
                          <span>Notifications</span>
                          <span className="text-xs text-[#8b6b4d]">{notificationCount}</span>
                        </Link>
                        <Link
                          href="/portal/help"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="block rounded-[1rem] border border-[#eadfce] bg-white px-4 py-3 text-sm font-semibold transition hover:bg-[#fff9f3]"
                        >
                          Help and Support
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            void handleSignOut();
                          }}
                          className="w-full rounded-[1rem] border border-[#eadfce] bg-[#6f5037] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#5d4330]"
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8 lg:px-12">
            {children}
          </div>
        </main>
      </div>

      {/* Floating Chat Widget */}
      <div className="pointer-events-none fixed inset-0 z-[9999]">
        <div className="pointer-events-none absolute bottom-[94px] right-3 flex flex-col items-end gap-4 sm:bottom-[104px] sm:right-7">
          {isChiChiOpen && (
            <div className="pointer-events-auto flex h-[min(680px,calc(100vh-120px))] w-[calc(100vw-24px)] max-w-[380px] flex-col overflow-hidden rounded-[1.15rem] border border-[#e8d5c3] bg-[#fffaf6] shadow-[0_16px_56px_rgba(90,50,20,0.15),0_2px_8px_rgba(0,0,0,0.06)] animate-in slide-in-from-bottom-4 fade-in duration-300 sm:w-[380px]">
              <div className="flex items-center gap-3 bg-[linear-gradient(135deg,#d97540,#b85e2a)] px-4 py-4 text-white">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-white/40 bg-[#f2c47e] text-[#6b3816] shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
                  <Dog className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-extrabold">
                    {hasAdminUi ? "ChiChi + Core" : "ChiChi"}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-white/85">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#6ddc8b]" />
                    <span>{hasAdminUi ? "Online - admin ready" : "Online - ask me anything"}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsChiChiOpen(false)}
                  className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
                  aria-label="Close ChiChi Assistant"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="border-b border-[#eadfce] bg-[#fffaf4] px-4 py-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-[1rem] border border-[#eadfce] bg-white px-3 py-2.5 shadow-sm">
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-stone-400">
                      Buyer
                    </div>
                    <div
                      className="mt-1 truncate text-xs font-semibold text-stone-700"
                      title={buyerName || displayName}
                    >
                      {buyerName || displayName}
                    </div>
                  </div>
                  <div className="rounded-[1rem] border border-[#eadfce] bg-white px-3 py-2.5 shadow-sm">
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-stone-400">
                      Puppy
                    </div>
                    <div
                      className="mt-1 truncate text-xs font-semibold text-stone-700"
                      title={puppyName || "Your Puppy"}
                    >
                      {puppyName || "Your Puppy"}
                    </div>
                  </div>
                  <div className="rounded-[1rem] border border-[#eadfce] bg-white px-3 py-2.5 shadow-sm">
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-stone-400">
                      Access
                    </div>
                    <div className="mt-1 truncate text-xs font-semibold text-stone-700">
                      {hasAdminUi ? "Admin UI" : "Standard"}
                    </div>
                  </div>
                </div>

                <div className="mt-3 inline-flex rounded-2xl bg-[#f2ede7] p-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab("ask")}
                    className={`rounded-xl px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] transition ${
                      activeTab === "ask"
                        ? "bg-white text-stone-900 shadow-sm"
                        : "text-stone-500 hover:text-stone-700"
                    }`}
                  >
                    Ask
                  </button>
                  {hasAdminUi && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("actions")}
                      className={`rounded-xl px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] transition ${
                        activeTab === "actions"
                          ? "bg-white text-stone-900 shadow-sm"
                          : "text-stone-500 hover:text-stone-700"
                      }`}
                    >
                      Core Console
                    </button>
                  )}
                </div>
              </div>

              <div className="border-b border-[#eadfce] bg-[#fffaf4] px-4 py-4">
                {activeTab === "ask" || !hasAdminUi ? (
                  <div className="rounded-[1.35rem] border border-[#dfcfbd] bg-white p-4 text-[15px] leading-7 text-[#6d5037]">
                    <div className="font-semibold text-[#4d3b2b]">
                      Hi, I&apos;m your personal ChiChi Assistant!
                    </div>
                    <div className="mt-1">
                      Ask me about your account, documents, payments, messages, puppy updates, or general Chihuahua care and breed questions.
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        { label: "My Puppy", prompt: "Show me my puppy summary." },
                        { label: "Messages", prompt: "Show me recent messages for this account." },
                        { label: "Documents", prompt: "What documents are available for me?" },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => void sendChiChiMessage(undefined, item.prompt)}
                          className="rounded-full border border-[#dfcfbd] bg-[#fff9f3] px-3 py-2 text-[11px] font-bold text-[#6d5037] transition hover:border-[#d7bea2] hover:bg-white"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {adminAuth ? (
                      <div className="rounded-[1.15rem] border border-[#dfcfbd] bg-white px-4 py-3 text-[11px] leading-5 text-[#6d5037]">
                        <div className="font-black uppercase tracking-[0.16em] text-stone-500">
                          Server Admin Status
                        </div>
                        <div className="mt-1">
                          {adminAuth.canWriteCore ? "Write access enabled." : "Write access not enabled yet."}
                        </div>
                        <div className="mt-1 break-all">{adminAuth.email || "No email returned"}</div>
                        <div className="break-all text-stone-400">
                          {adminAuth.userId || "No user id returned"}
                        </div>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-2">
                      {coreActions.map((action) => (
                        <button
                          key={action.key}
                          type="button"
                          onClick={() => {
                            setActiveTab("ask");
                            void sendChiChiMessage(undefined, action.prompt);
                          }}
                          className="flex items-center gap-2 rounded-[1rem] border border-[#eadfce] bg-white px-3 py-3 text-left text-xs font-semibold text-stone-700 shadow-sm transition hover:-translate-y-0.5 hover:border-[#d7bea2] hover:bg-[#fff9f3]"
                        >
                          <span className="text-[#b85e2a]">{action.icon}</span>
                          <span>{action.label}</span>
                        </button>
                      ))}
                    </div>

                    <Link
                      href="/admin/portal/assistant"
                      className="flex items-center justify-between rounded-[1rem] border border-[#d7bea2] bg-[#fff7ef] px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-[#6e5035] transition hover:bg-white"
                    >
                      <span>Open Full Admin Assistant</span>
                      <span aria-hidden="true">{"->"}</span>
                    </Link>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-2 pt-4">
                <div className="flex flex-col gap-3">
                  {messages.map((message) => {
                    const isUser = message.role === "user";

                    return (
                      <div
                        key={message.id}
                        className={`flex max-w-[88%] items-end gap-2 ${
                          isUser ? "ml-auto flex-row-reverse" : "mr-auto"
                        } animate-in slide-in-from-bottom-2 fade-in duration-300`}
                      >
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                            isUser ? "bg-[#fdf1e8] text-[#b85e2a]" : "bg-[#f2c47e] text-[#6b3816]"
                          }`}
                        >
                          {isUser ? userInitial : <Dog className="h-3.5 w-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <div
                            className={[
                              "rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm",
                              isUser
                                ? "rounded-br-md bg-[#d97540] text-white"
                                : "rounded-bl-md border border-[#e8d5c3] bg-[#fff8f2] text-[#2d1f12]",
                            ].join(" ")}
                          >
                            {renderChatText(message.text)}
                          </div>
                          <div
                            className={`mt-1 px-1 text-[10px] ${
                              isUser ? "text-right text-[#7a5c42]" : "text-[#7a5c42]"
                            }`}
                          >
                            {message.createdAt}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {isSending && (
                    <div className="mr-auto flex max-w-[88%] items-end gap-2 animate-in fade-in">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f2c47e] text-[#6b3816]">
                        <Dog className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-[#e8d5c3] bg-[#fff8f2] px-4 py-3">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#d97540] [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#d97540] [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#d97540]" />
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>
              </div>

              <form
                onSubmit={(e) => void sendChiChiMessage(e)}
                className="border-t border-[#e8d5c3] bg-[#fffaf6] px-3.5 pb-3 pt-3"
              >
                <div className="flex items-end gap-2">
                  <textarea
                    ref={chatInputRef}
                    value={chatDraft}
                    onChange={(e) => setChatDraft(e.target.value)}
                    onKeyDown={handleTextareaKeyDown}
                    rows={1}
                    style={{ minHeight: "42px", maxHeight: "100px" }}
                    placeholder={
                      activeTab === "actions" && hasAdminUi
                        ? "Describe a Core action..."
                        : "Ask me about puppies, care tips, availability..."
                    }
                    className="max-h-[100px] flex-1 resize-none rounded-[1.35rem] border border-[#e8d5c3] bg-white px-4 py-2.5 text-sm leading-6 text-[#2d1f12] outline-none transition placeholder:text-[#bfa990] focus:border-[#d97540]"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !chatDraft.trim()}
                    className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#d97540,#b85e2a)] text-white shadow-[0_3px_12px_rgba(90,50,20,0.15)] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                    aria-label="Send message"
                  >
                    <SendHorizonal className="h-4 w-4" />
                  </button>
                </div>

                <div className="pt-2 text-center text-[10.5px] text-[#c4a88c]">
                  Emergency? Please contact your vet.{" "}
                  <a
                    href="https://www.google.com/maps/search/emergency+veterinarian+near+me"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[#7b5b3f] underline underline-offset-2"
                  >
                    Nearby emergency vets
                    <ExternalLink className="ml-1 inline h-3 w-3" />
                  </a>
                </div>
              </form>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsChiChiOpen((v) => !v)}
            className={`pointer-events-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,#d97540,#b85e2a)] text-white shadow-[0_6px_24px_rgba(90,50,20,0.15)] transition duration-200 hover:scale-[1.08] hover:shadow-[0_10px_32px_rgba(90,50,20,0.18)] ${
              isChiChiOpen ? "scale-0 opacity-0" : "scale-100 opacity-100"
            }`}
            aria-label="Toggle ChiChi Assistant"
            title="Chat with ChiChi"
          >
            <PawPrint className="h-7 w-7" />
          </button>
        </div>
      </div>
    </div>
  );
}


