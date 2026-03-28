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
    .replace(/^[-•]\s+/gm, "• ")
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
  const [adminAuth, setAdminAuth] = useState<{
    userId?: string | null;
    email?: string | null;
    canWriteCore?: boolean;
  } | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: makeId("assistant"),
      role: "assistant",
      text: "Hi, I’m your personal ChiChi Assistant. Ask me a question about your account, or anything Chihuahua related!",
      createdAt: formatTime(),
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);

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
        label: "Pickup / Meet / Delivery",
        icon: <CarFront className="h-[18px] w-[18px]" />,
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
  const pageTitle = activeNavItem?.label || "Portal";

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
                <span className="text-[15px] font-medium leading-tight tracking-wide">{item.label}</span>
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
              <span className="font-medium text-white/90">{user?.email || "—"}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Desktop Layout */}
      <div className="flex min-h-screen bg-[radial-gradient(circle_at_top,#f8f1e8_0%,#f3eadf_42%,#eee3d7_100%)]">
        {/* Desktop Sidebar */}
        <aside className="hidden w-[126px] shrink-0 border-r border-[#46372b] bg-[linear-gradient(180deg,#2d2924_0%,#23201c_100%)] md:block">
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
                  <span className="text-[13px] font-medium leading-tight tracking-wide">
                    {item.label}
                  </span>
                </Link>
              ))}
            </nav>

            <div className="border-t border-white/8 px-3 py-5">
              <div className="rounded-2xl border border-white/8 bg-white/5 p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d1b082]">
                  Help & Support
                </div>
                <div className="mt-2 text-[11px] leading-5 text-[#d5c7b8]">
                  Messages, documents, and puppy details stay organized here.
                </div>
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
                <button
                  type="button"
                  className="hidden h-10 w-10 items-center justify-center rounded-full border border-[#6a5641] bg-[#403730] text-[#e9cc98] transition hover:bg-[#4a4038] sm:inline-flex"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="hidden h-10 w-10 items-center justify-center rounded-full border border-[#6a5641] bg-[#403730] text-[#e9cc98] transition hover:bg-[#4a4038] sm:inline-flex"
                  aria-label="Messages"
                >
                  <Mail className="h-4 w-4" />
                </button>

                <div className="flex items-center gap-3 rounded-full border border-[#6a5641] bg-[#403730] py-1.5 pl-1.5 pr-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#e0bb85] to-[#bb8749] text-sm font-black text-[#24180f]">
                    {userInitial}
                  </div>
                  <div className="hidden sm:block">
                    <div className="max-w-[140px] truncate text-sm font-semibold text-[#f7f1e8]">
                      {displayName}
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-[#d9bb88]" />
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
        <div className="pointer-events-none absolute bottom-6 right-6 flex flex-col items-end gap-4 sm:bottom-8 sm:right-8">
          
          {isChiChiOpen && (
            <div className="pointer-events-auto w-[calc(100vw-32px)] max-w-[480px] overflow-hidden rounded-[2rem] border border-stone-200/60 bg-[#FAFAFA]/95 backdrop-blur-xl shadow-[0_30px_80px_rgba(28,22,20,0.15)] flex flex-col transform transition-all animate-in slide-in-from-bottom-4 fade-in duration-300">
              
              {/* Chat Header */}
              <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-[#1C1614] to-[#2D2420] px-5 py-4 text-white">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D9A05B] to-[#C0853E] text-white shadow-md">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D9A05B]">
                      {hasAdminUi ? "ChiChi + Core" : "Your Assistant"}
                    </div>
                    <div className="font-serif text-[20px] leading-none text-white tracking-wide mt-0.5">
                      ChiChi AI
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsChiChiOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition-all hover:bg-white/20 hover:text-white"
                  aria-label="Close ChiChi Assistant"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Context / Tabs Bar */}
              <div className="border-b border-stone-200 bg-white/60 px-5 py-4">
                <div className="flex flex-col gap-4">
                  {/* Context Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-stone-100 bg-white/80 px-4 py-3 shadow-sm">
                      <div className="text-[9px] font-black uppercase tracking-[0.15em] text-stone-400">Buyer</div>
                      <div className="mt-1 text-xs font-semibold text-stone-700 truncate" title={buyerName || displayName}>
                        {buyerName || displayName}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-stone-100 bg-white/80 px-4 py-3 shadow-sm">
                      <div className="text-[9px] font-black uppercase tracking-[0.15em] text-stone-400">Puppy</div>
                      <div className="mt-1 text-xs font-semibold text-stone-700 truncate" title={puppyName || "your puppy"}>
                        {puppyName || "Your Puppy"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-stone-100 bg-white/80 px-4 py-3 shadow-sm">
                      <div className="text-[9px] font-black uppercase tracking-[0.15em] text-stone-400">Access</div>
                      <div className="mt-1 text-xs font-semibold text-stone-700 truncate">
                        {hasAdminUi ? "Admin UI" : "Standard"}
                      </div>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="inline-flex rounded-xl bg-stone-200/50 p-1 w-fit self-start">
                    <button
                      type="button"
                      onClick={() => setActiveTab("ask")}
                      className={`rounded-lg px-4 py-2 text-[11px] font-bold uppercase tracking-[0.15em] transition-all ${
                        activeTab === "ask"
                          ? "bg-white text-stone-800 shadow-sm"
                          : "text-stone-500 hover:text-stone-700"
                      }`}
                    >
                      Ask
                    </button>
                    {hasAdminUi && (
                      <button
                        type="button"
                        onClick={() => setActiveTab("actions")}
                        className={`rounded-lg px-4 py-2 text-[11px] font-bold uppercase tracking-[0.15em] transition-all ${
                          activeTab === "actions"
                            ? "bg-white text-stone-800 shadow-sm"
                            : "text-stone-500 hover:text-stone-700"
                        }`}
                      >
                        Core Console
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Chat Area / Action Area */}
              <div className="border-b border-stone-100 px-5 py-4 bg-white/40">
                {activeTab === "ask" || !hasAdminUi ? (
                  <div className="rounded-2xl bg-stone-100/50 px-5 py-4 text-sm leading-relaxed text-stone-600 border border-stone-200/50">
                    <div className="font-semibold text-stone-800">
                      Hi, I’m your personal ChiChi Assistant!
                    </div>
                    <div className="mt-1">
                      Ask me anything about your account, documents, or Chihuahuas in general.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {adminAuth ? (
                      <div className="rounded-2xl border border-stone-200/70 bg-white px-4 py-3 text-[11px] leading-5 text-stone-600">
                        <div className="font-black uppercase tracking-[0.14em] text-stone-500">
                          Server Admin Status
                        </div>
                        <div className="mt-1">
                          {adminAuth.canWriteCore ? "Write access enabled." : "Write access not enabled yet."}
                        </div>
                        <div className="mt-1 break-all">
                          {adminAuth.email || "No email returned"}
                        </div>
                        <div className="break-all text-stone-400">
                          {adminAuth.userId || "No user id returned"}
                        </div>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-3">
                      {coreActions.map((action) => (
                        <button
                          key={action.key}
                          type="button"
                          onClick={() => {
                            setActiveTab("ask");
                            void sendChiChiMessage(undefined, action.prompt);
                          }}
                          className="flex items-center gap-2.5 rounded-2xl border border-stone-200/60 bg-white px-4 py-3.5 text-left text-xs font-semibold text-stone-700 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-[#D9A05B]/30"
                        >
                          <span className="text-[#C0853E]">{action.icon}</span>
                          <span>{action.label}</span>
                        </button>
                      ))}
                    </div>

                    <Link
                      href="/admin/portal/assistant"
                      className="flex items-center justify-between rounded-2xl border border-[#d7c3ab] bg-[#fcf8f3] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-[#6e5035] transition hover:bg-white"
                    >
                      <span>Open Full Admin Assistant</span>
                      <span aria-hidden="true">↗</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* Messages Container */}
              <div className="h-[380px] overflow-y-auto px-5 py-5 scroll-smooth">
                <div className="space-y-4">
                  {messages.map((message) => {
                    const isUser = message.role === "user";

                    return (
                      <div
                        key={message.id}
                        className={`flex ${isUser ? "justify-end" : "justify-start"} animate-in slide-in-from-bottom-2 fade-in duration-300`}
                      >
                        <div
                          className={[
                            "max-w-[85%] rounded-[1.5rem] px-5 py-3.5 text-[14px] leading-relaxed shadow-sm",
                            isUser
                              ? "bg-[#2D2825] text-[#FDFCF8] rounded-tr-md"
                              : "border border-stone-200 bg-white text-stone-700 rounded-tl-md",
                          ].join(" ")}
                        >
                          {renderChatText(message.text)}
                          <div
                            className={`mt-2 text-[10px] font-medium tracking-wider uppercase ${
                              isUser ? "text-white/40" : "text-stone-400"
                            }`}
                          >
                            {message.createdAt}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {isSending && (
                    <div className="flex justify-start animate-in fade-in">
                      <div className="max-w-[85%] rounded-[1.5rem] rounded-tl-md border border-stone-200 bg-white px-5 py-3.5 text-sm text-stone-500 shadow-sm flex items-center gap-2">
                        <span className="flex space-x-1">
                          <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                          <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                          <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce"></span>
                        </span>
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>
              </div>

              {/* Input Area */}
              <form
                onSubmit={(e) => void sendChiChiMessage(e)}
                className="bg-white px-5 py-4 border-t border-stone-100"
              >
                <div className="relative flex items-end gap-3 rounded-[1.5rem] border border-stone-200 bg-[#FDFCF8] p-2 pr-2 shadow-sm focus-within:ring-2 focus-within:ring-[#D9A05B]/30 focus-within:border-[#D9A05B] transition-all">
                  <textarea
                    ref={chatInputRef}
                    value={chatDraft}
                    onChange={(e) => setChatDraft(e.target.value)}
                    onKeyDown={handleTextareaKeyDown}
                    rows={1}
                    style={{ minHeight: "44px", maxHeight: "120px" }}
                    placeholder={
                      activeTab === "actions" && hasAdminUi
                        ? "Describe Core action..."
                        : "Ask a question..."
                    }
                    className="w-full resize-none bg-transparent py-2.5 pl-4 text-sm leading-relaxed text-stone-800 outline-none placeholder:text-stone-400"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !chatDraft.trim()}
                    className="shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#D9A05B] to-[#C0853E] text-white shadow-md transition-all hover:scale-105 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                  >
                    <SendHorizonal className="h-4 w-4 ml-0.5" />
                  </button>
                </div>
                
                <div className="mt-3 px-2 text-[11px] leading-tight text-stone-400">
                  Emergency? Please contact your vet.{" "}
                  <a
                    href="https://www.google.com/maps/search/emergency+veterinarian+near+me"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-[#C0853E] hover:text-[#9c6a30] transition-colors"
                  >
                    Nearby emergency vets
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </form>
            </div>
          )}

          {/* Chat Toggle Button */}
          <button
            type="button"
            onClick={() => setIsChiChiOpen((v) => !v)}
            className={`pointer-events-auto inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-[#1C1614] to-[#2D2420] p-1.5 pr-5 text-sm font-medium text-[#FDFCF8] shadow-[0_16px_40px_rgba(28,22,20,0.3)] border border-[#3A322D] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(28,22,20,0.4)] ${isChiChiOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
            aria-label="Toggle ChiChi Assistant"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#D9A05B] to-[#C0853E] shadow-inner">
              <Sparkles className="h-5 w-5 text-white" />
            </span>
            <span className="tracking-wide">Ask ChiChi</span>
          </button>
        </div>
      </div>
    </div>
  );
}
