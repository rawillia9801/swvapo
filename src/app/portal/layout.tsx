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
  ChevronRight,
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
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function getClientCoreAdmins() {
  const directOwner = process.env.NEXT_PUBLIC_DEV_OWNER_ID || "";
  const extraAdmins = (process.env.NEXT_PUBLIC_CORE_ADMIN_USER_IDS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return [directOwner, ...extraAdmins].filter(Boolean);
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
  const paragraphs = cleaned.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="space-y-2.5">
      {paragraphs.map((paragraph, idx) => (
        <p key={idx} className="whitespace-pre-wrap leading-relaxed">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
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
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: makeId("assistant"),
      role: "assistant",
      text: "Hi, I'm your personal ChiChi Assistant. Ask me a question about your account, or anything Chihuahua related!",
      createdAt: formatTime(),
    },
  ]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadUser = async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!mounted) return;
      setUser((session?.user as PortalUser) ?? null);
      setAccessToken(session?.access_token ?? null);
    };
    loadUser();
    const { data: authListener } = sb.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      setUser((session?.user as PortalUser) ?? null);
      setAccessToken(session?.access_token ?? null);
    });
    return () => { mounted = false; authListener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { setIsDrawerOpen(false); }, [pathname]);

  useEffect(() => {
    if (isChiChiOpen) {
      requestAnimationFrame(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    }
  }, [messages, isChiChiOpen, isSending]);

  const nav: NavItem[] = useMemo(() => [
    { href: "/portal", label: "Overview", icon: <Home className="h-4 w-4" />, match: (p) => p === "/portal" },
    { href: "/portal/mypuppy", label: "My Puppy", icon: <Dog className="h-4 w-4" /> },
    { href: "/portal/updates", label: "Updates", icon: <CalendarDays className="h-4 w-4" /> },
    { href: "/portal/documents", label: "Contracts & Docs", icon: <FileText className="h-4 w-4" /> },
    { href: "/portal/payments", label: "Payments", icon: <CreditCard className="h-4 w-4" /> },
    { href: "/portal/transportation", label: "Pickup / Meet / Delivery", icon: <CarFront className="h-4 w-4" /> },
    { href: "/portal/messages", label: "Messages", icon: <MessageCircle className="h-4 w-4" /> },
    { href: "/available-puppies", label: "Available Puppies", icon: <Sparkles className="h-4 w-4" /> },
  ], []);

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || "Portal User";
  const userInitial = (displayName?.[0] || user?.email?.[0] || "U").toUpperCase();
  const clientCoreAdmins = useMemo(() => getClientCoreAdmins(), []);
  const isCoreAdmin = !!user?.id && clientCoreAdmins.includes(user.id);

  useEffect(() => {
    if (!isCoreAdmin && activeTab === "actions") setActiveTab("ask");
  }, [isCoreAdmin, activeTab]);

  const coreActions: QuickAction[] = [
    { key: "add-puppy", label: "Add Puppy", prompt: "Core action: add a new puppy record. I will provide the puppy details next.", icon: <PlusCircle className="h-3.5 w-3.5" /> },
    { key: "add-event", label: "Add Puppy Event", prompt: "Core action: add a puppy event. I will provide the puppy name, date, title, and details next.", icon: <CalendarPlus className="h-3.5 w-3.5" /> },
    { key: "log-payment", label: "Log Payment", prompt: "Core action: log a buyer payment. I will provide the buyer, amount, date, and method next.", icon: <DollarSign className="h-3.5 w-3.5" /> },
    { key: "open-documents", label: "Open Documents", prompt: "Show me the documents for this account.", icon: <FolderOpen className="h-3.5 w-3.5" /> },
    { key: "open-messages", label: "Open Messages", prompt: "Show me recent messages for this account.", icon: <MessagesSquare className="h-3.5 w-3.5" /> },
    { key: "open-puppy", label: "Open My Puppy", prompt: "Show me my puppy summary.", icon: <PawPrint className="h-3.5 w-3.5" /> },
  ];

  async function handleSignOut() {
    await sb.auth.signOut();
    setUser(null); setAccessToken(null);
    setIsDrawerOpen(false); setIsChiChiOpen(false);
    router.push("/portal"); router.refresh();
  }

  function isActive(item: NavItem) {
    if (item.match) return item.match(pathname);
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  async function sendChiChiMessage(e?: React.FormEvent, overrideText?: string) {
    e?.preventDefault();
    const text = (overrideText ?? chatDraft).trim();
    if (!text || isSending) return;
    const userMessage: ChatMessage = { id: makeId("user"), role: "user", text, createdAt: formatTime() };
    setMessages((prev) => [...prev, userMessage]);
    if (!overrideText) setChatDraft("");
    setIsSending(true);
    if (!accessToken) {
      setMessages((prev) => [...prev, { id: makeId("assistant"), role: "assistant", text: "Please sign in through the portal first so I can answer using your account information.", createdAt: formatTime() }]);
      setIsSending(false);
      return;
    }
    try {
      const routeMessages = [...messages, userMessage].map((m) => ({ role: m.role, content: m.text }));
      const res = await fetch("/api/buildlio", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ threadId, accessToken, max_tokens: 1200, messages: routeMessages }),
      });
      const data = (await res.json()) as ChiChiResponse;
      const reply = data?.text?.trim() || "I ran into an issue while loading your portal information. Please try again.";
      if (data?.threadId) setThreadId(data.threadId);
      if (data?.context?.buyerName) setBuyerName(data.context.buyerName);
      if (data?.context?.puppyName) setPuppyName(data.context.puppyName);
      setMessages((prev) => [...prev, { id: makeId("assistant"), role: "assistant", text: reply, createdAt: formatTime() }]);
    } catch (error) {
      console.error("ChiChi chat error:", error);
      setMessages((prev) => [...prev, { id: makeId("assistant"), role: "assistant", text: "I ran into a connection problem while trying to answer that. Please try again.", createdAt: formatTime() }]);
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => chatInputRef.current?.focus());
    }
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendChiChiMessage(); }
  }

  // Sidebar nav item rendering
  function SidebarNavItem({ item }: { item: NavItem }) {
    const active = isActive(item);
    return (
      <Link
        href={item.href}
        className={[
          "group relative flex items-center gap-3.5 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200",
          active
            ? "bg-[#c9a46a] text-[#1a1008] shadow-[0_8px_20px_rgba(180,136,80,0.30)]"
            : "text-[#c4ae97] hover:text-[#f0e8de] hover:bg-white/[0.06]",
        ].join(" ")}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-[#e8c47a]" />
        )}
        <span className={[
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
          active ? "bg-[#1a1008]/30 text-[#1a1008]" : "bg-white/[0.06] text-[#9a836c] group-hover:bg-white/[0.10] group-hover:text-[#d4c4b0]",
        ].join(" ")}>
          {item.icon}
        </span>
        <span className="flex-1 truncate tracking-[0.01em]">{item.label}</span>
        {active && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
      </Link>
    );
  }

  return (
    <>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');

        .portal-root {
          font-family: 'DM Sans', sans-serif;
        }
        .font-display {
          font-family: 'Playfair Display', Georgia, serif;
        }

        /* Sidebar grain texture */
        .sidebar-grain::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 1;
        }

        /* Scroll thumb */
        .chat-scroll::-webkit-scrollbar { width: 4px; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .chat-scroll::-webkit-scrollbar-thumb { background: #d4c4b0; border-radius: 99px; }

        /* Animated dots */
        @keyframes blink { 0%,80%,100%{opacity:0.2} 40%{opacity:1} }
        .dot { animation: blink 1.4s infinite both; }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }

        /* Chat open/close */
        @keyframes chatIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        .chat-panel { animation: chatIn 0.28s cubic-bezier(0.22,1,0.36,1) both; }

        /* Pulse ring on FAB */
        @keyframes fabPulse {
          0%   { box-shadow: 0 0 0 0 rgba(201,164,106,0.45); }
          70%  { box-shadow: 0 0 0 12px rgba(201,164,106,0); }
          100% { box-shadow: 0 0 0 0 rgba(201,164,106,0); }
        }
        .fab-pulse { animation: fabPulse 2.8s ease-out infinite; }
      `}</style>

      <div className="portal-root min-h-screen bg-[#f2ece3] text-[#1e140a]">

        {/* ── Mobile header ── */}
        <header className="sticky top-0 z-40 md:hidden">
          <div
            className="flex h-16 items-center justify-between px-4"
            style={{
              background: "linear-gradient(135deg, #1a120b 0%, #261a10 100%)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.22)",
            }}
          >
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.07] text-white/90 transition hover:bg-white/[0.12]"
              aria-label="Open portal menu"
            >
              <Menu className="h-[18px] w-[18px]" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#c9a46a] text-[#1a1008] shadow-[0_4px_12px_rgba(180,136,80,0.40)]">
                <Dog className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#c9a46a]/80">
                  SW Virginia Chihuahua
                </div>
                <div className="font-display text-[20px] leading-none text-white">
                  My Puppy Portal
                </div>
              </div>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#c9a46a]/40 bg-[#c9a46a]/10 text-sm font-semibold text-[#c9a46a]">
              {userInitial}
            </div>
          </div>
        </header>

        {/* ── Mobile drawer backdrop ── */}
        {isDrawerOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={() => setIsDrawerOpen(false)}
          />
        )}

        {/* ── Mobile drawer ── */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-[82%] max-w-[310px] transform transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:hidden ${
            isDrawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div
            className="sidebar-grain relative flex h-full flex-col px-4 py-5 shadow-[4px_0_40px_rgba(0,0,0,0.38)]"
            style={{
              background: "linear-gradient(180deg, #18110a 0%, #20160e 60%, #1c1309 100%)",
              borderRight: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <div className="relative z-10 flex items-start justify-between gap-2 px-1 pb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#c9a46a] text-[#1a1008] shadow-[0_6px_16px_rgba(180,136,80,0.38)]">
                  <Dog className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.20em] text-[#c9a46a]/70">
                    Southwest Virginia
                  </div>
                  <div className="font-display text-[19px] leading-tight text-white">
                    My Puppy Portal
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="relative z-10 mt-1 flex h-8 w-8 items-center justify-center rounded-xl text-white/50 hover:bg-white/[0.07] hover:text-white/80 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Divider */}
            <div className="relative z-10 mb-4 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

            <nav className="relative z-10 flex-1 space-y-1">
              {nav.map((item) => <SidebarNavItem key={item.href} item={item} />)}
            </nav>

            <div className="relative z-10 mt-4">
              <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mb-4" />
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#c9a46a]/40 bg-[#c9a46a]/10 text-sm font-semibold text-[#c9a46a]">
                    {userInitial}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white/90">{displayName}</div>
                    <div className="truncate text-xs text-white/40">{user?.email || ""}</div>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="mt-3 w-full rounded-xl border border-white/[0.08] bg-white/[0.05] py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/[0.09] hover:text-white/90"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main layout ── */}
        <div className="flex min-h-screen">

          {/* ── Desktop sidebar ── */}
          <aside className="hidden w-[272px] shrink-0 md:block">
            <div
              className="sidebar-grain relative sticky top-0 flex h-screen flex-col px-4 py-6"
              style={{
                background: "linear-gradient(180deg, #18110a 0%, #1e1509 60%, #1a1208 100%)",
                borderRight: "1px solid rgba(255,255,255,0.045)",
                boxShadow: "4px 0 40px rgba(0,0,0,0.24)",
              }}
            >
              {/* Logo */}
              <div className="relative z-10 flex items-center gap-3 px-2 pb-7">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] text-[#1a1008]"
                  style={{
                    background: "linear-gradient(145deg, #d4b06a 0%, #b88640 100%)",
                    boxShadow: "0 6px 20px rgba(180,136,56,0.42), inset 0 1px 0 rgba(255,255,255,0.20)",
                  }}
                >
                  <Dog className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.20em] text-[#c9a46a]/70">
                    Southwest Virginia
                  </div>
                  <div className="font-display text-[21px] leading-none text-white tracking-[-0.01em]">
                    My Puppy Portal
                  </div>
                </div>
              </div>

              <div className="relative z-10 mb-5 h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />

              {/* Nav */}
              <nav className="relative z-10 flex-1 space-y-0.5">
                {nav.map((item) => <SidebarNavItem key={item.href} item={item} />)}
              </nav>

              {/* User card */}
              <div className="relative z-10 mt-4">
                <div className="h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent mb-4" />
                <div
                  className="rounded-2xl p-4"
                  style={{
                    background: "rgba(255,255,255,0.035)",
                    border: "1px solid rgba(255,255,255,0.065)",
                  }}
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                      style={{
                        background: "rgba(201,164,106,0.15)",
                        border: "1px solid rgba(201,164,106,0.35)",
                        color: "#c9a46a",
                      }}
                    >
                      {userInitial}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white/90 leading-tight">{displayName}</div>
                      <div className="text-[11px] text-white/35 mt-0.5">Portal Member</div>
                    </div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full rounded-xl py-2.5 text-sm font-medium transition"
                    style={{
                      background: "rgba(201,164,106,0.12)",
                      border: "1px solid rgba(201,164,106,0.22)",
                      color: "#c9a46a",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(201,164,106,0.20)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(201,164,106,0.12)";
                    }}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </aside>

          {/* ── Page content ── */}
          <main className="min-w-0 flex-1" style={{ background: "#f2ece3" }}>
            <div className="px-5 py-6 md:px-8 md:py-8 lg:px-10">{children}</div>
          </main>
        </div>

        {/* ── ChiChi floating widget ── */}
        <div className="pointer-events-none fixed inset-0 z-[9999]">
          <div className="pointer-events-none absolute bottom-6 right-6 flex flex-col items-end gap-4">

            {/* Chat panel */}
            {isChiChiOpen && (
              <div
                className="chat-panel pointer-events-auto w-[calc(100vw-28px)] max-w-[540px] overflow-hidden"
                style={{
                  borderRadius: "28px",
                  background: "#faf5ee",
                  border: "1px solid rgba(180,148,100,0.22)",
                  boxShadow: "0 32px 80px rgba(30,18,8,0.28), 0 4px 16px rgba(30,18,8,0.12)",
                }}
              >
                {/* Chat header */}
                <div
                  className="flex items-center justify-between px-5 py-4"
                  style={{
                    background: "linear-gradient(135deg, #1e1409 0%, #2a1d10 100%)",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-[16px]"
                      style={{
                        background: "linear-gradient(145deg, #d4b06a 0%, #b08040 100%)",
                        boxShadow: "0 4px 14px rgba(180,128,48,0.40)",
                      }}
                    >
                      <MessageCircle className="h-5 w-5 text-[#1a1008]" />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.20em] text-[#c9a46a]/70">
                        {isCoreAdmin ? "ChiChi + Core Console" : "Your Personal Assistant"}
                      </div>
                      <div className="font-display text-[18px] leading-tight text-white tracking-[-0.01em]">
                        ChiChi Assistant
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsChiChiOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-white/50 transition hover:bg-white/[0.08] hover:text-white/80"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Context bar */}
                <div
                  className="px-5 py-4"
                  style={{
                    background: "rgba(255,250,242,0.7)",
                    borderBottom: "1px solid rgba(180,148,100,0.14)",
                  }}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-2">
                      {[
                        { label: "Buyer", value: buyerName || displayName },
                        { label: "Puppy", value: puppyName || "Your puppy" },
                        { label: "Access", value: isCoreAdmin ? "Admin" : "Portal" },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-[14px] px-3.5 py-2.5"
                          style={{
                            background: "#fff",
                            border: "1px solid rgba(180,148,100,0.18)",
                          }}
                        >
                          <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#a07840]">
                            {item.label}
                          </div>
                          <div className="mt-0.5 text-xs font-semibold text-[#3d2b1a] leading-tight truncate max-w-[80px]">
                            {item.value}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Tabs */}
                    <div
                      className="inline-flex rounded-[14px] p-1"
                      style={{ background: "#fff", border: "1px solid rgba(180,148,100,0.18)" }}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveTab("ask")}
                        className={`rounded-[10px] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-all duration-150 ${
                          activeTab === "ask"
                            ? "bg-[#1e1409] text-[#c9a46a] shadow-sm"
                            : "text-[#8a6840] hover:text-[#5a3e22]"
                        }`}
                      >
                        Ask
                      </button>
                      {isCoreAdmin && (
                        <button
                          type="button"
                          onClick={() => setActiveTab("actions")}
                          className={`rounded-[10px] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-all duration-150 ${
                            activeTab === "actions"
                              ? "bg-[#1e1409] text-[#c9a46a] shadow-sm"
                              : "text-[#8a6840] hover:text-[#5a3e22]"
                          }`}
                        >
                          Console
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick actions / greeting */}
                <div
                  className="px-5 py-4"
                  style={{ borderBottom: "1px solid rgba(180,148,100,0.12)" }}
                >
                  {activeTab === "ask" || !isCoreAdmin ? (
                    <div
                      className="rounded-[18px] px-4 py-3.5"
                      style={{
                        background: "linear-gradient(135deg, #fff8ef 0%, #fff3e4 100%)",
                        border: "1px solid rgba(180,148,100,0.16)",
                      }}
                    >
                      <div className="text-sm font-semibold text-[#3d2b1a]">
                        Hi, I'm your personal ChiChi Assistant!
                      </div>
                      <div className="mt-1 text-sm leading-relaxed text-[#7a5c3c]">
                        Ask me anything about your account or Chihuahua care.
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {coreActions.map((action) => (
                        <button
                          key={action.key}
                          type="button"
                          onClick={() => { setActiveTab("ask"); void sendChiChiMessage(undefined, action.prompt); }}
                          className="group flex items-center gap-2.5 rounded-[16px] px-3.5 py-3 text-left text-xs font-semibold transition-all duration-150"
                          style={{
                            background: "#fff",
                            border: "1px solid rgba(180,148,100,0.18)",
                            color: "#6d4e2e",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#fff8ef";
                            e.currentTarget.style.borderColor = "rgba(180,148,100,0.36)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#fff";
                            e.currentTarget.style.borderColor = "rgba(180,148,100,0.18)";
                          }}
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#c9a46a]/12 text-[#a07840]">
                            {action.icon}
                          </span>
                          <span>{action.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Messages */}
                <div className="chat-scroll h-[340px] overflow-y-auto px-5 py-4">
                  <div className="space-y-3">
                    {messages.map((message) => {
                      const isUser = message.role === "user";
                      return (
                        <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                          <div
                            className="max-w-[87%] rounded-[20px] px-4 py-3 text-sm leading-relaxed"
                            style={
                              isUser
                                ? {
                                    background: "linear-gradient(135deg, #2a1d10 0%, #1a1009 100%)",
                                    color: "#f0e4d0",
                                    boxShadow: "0 4px 14px rgba(20,12,4,0.20)",
                                  }
                                : {
                                    background: "#fff",
                                    border: "1px solid rgba(180,148,100,0.16)",
                                    color: "#4d3520",
                                    boxShadow: "0 2px 8px rgba(60,36,12,0.06)",
                                  }
                            }
                          >
                            {renderChatText(message.text)}
                            <div
                              className={`mt-2 text-[11px] ${
                                isUser ? "text-white/40 text-right" : "text-[#a07840]/60"
                              }`}
                            >
                              {message.createdAt}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {isSending && (
                      <div className="flex justify-start">
                        <div
                          className="flex items-center gap-1.5 rounded-[20px] px-4 py-3.5"
                          style={{
                            background: "#fff",
                            border: "1px solid rgba(180,148,100,0.16)",
                            boxShadow: "0 2px 8px rgba(60,36,12,0.06)",
                          }}
                        >
                          <span className="dot h-2 w-2 rounded-full bg-[#c9a46a]" />
                          <span className="dot h-2 w-2 rounded-full bg-[#c9a46a]" />
                          <span className="dot h-2 w-2 rounded-full bg-[#c9a46a]" />
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </div>

                {/* Input */}
                <form
                  onSubmit={(e) => void sendChiChiMessage(e)}
                  className="px-5 pb-5 pt-4"
                  style={{ borderTop: "1px solid rgba(180,148,100,0.12)" }}
                >
                  <div
                    className="rounded-[20px] p-3.5"
                    style={{
                      background: "#fff",
                      border: "1px solid rgba(180,148,100,0.22)",
                      boxShadow: "0 2px 10px rgba(60,36,12,0.06)",
                    }}
                  >
                    <textarea
                      ref={chatInputRef}
                      value={chatDraft}
                      onChange={(e) => setChatDraft(e.target.value)}
                      onKeyDown={handleTextareaKeyDown}
                      rows={3}
                      placeholder={
                        activeTab === "actions" && isCoreAdmin
                          ? "Describe the core action you want..."
                          : "Ask about your puppy, payments, documents, or pickup..."
                      }
                      className="w-full resize-none bg-transparent text-sm leading-relaxed text-[#3d2b1a] outline-none placeholder:text-[#b89a78]"
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <a
                      href="https://www.google.com/maps/search/emergency+veterinarian+near+me"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#a07840] underline underline-offset-2 hover:text-[#7a5c2c] transition-colors"
                    >
                      Emergency vet nearby
                      <ExternalLink className="h-3 w-3" />
                    </a>

                    <button
                      type="submit"
                      disabled={isSending || !chatDraft.trim()}
                      className="inline-flex items-center gap-2 rounded-[14px] px-5 py-2.5 text-sm font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{
                        background: "linear-gradient(135deg, #2a1d10 0%, #1e1309 100%)",
                        color: "#c9a46a",
                        boxShadow: "0 4px 14px rgba(20,12,4,0.22)",
                      }}
                    >
                      <SendHorizonal className="h-3.5 w-3.5" />
                      {isSending ? "Sending…" : "Send"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* FAB */}
            <button
              type="button"
              onClick={() => setIsChiChiOpen((v) => !v)}
              className={`fab-pulse pointer-events-auto inline-flex items-center gap-3 rounded-full px-5 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(20,12,4,0.38)] active:translate-y-0 ${isChiChiOpen ? "" : ""}`}
              style={{
                background: "linear-gradient(135deg, #2a1d10 0%, #1c1208 100%)",
                color: "#c9a46a",
                boxShadow: "0 16px_42px rgba(20,12,4,0.34)",
                border: "1px solid rgba(201,164,106,0.22)",
              }}
              aria-label="Toggle ChiChi Assistant"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ background: "rgba(201,164,106,0.14)" }}
              >
                {isChiChiOpen
                  ? <X className="h-4 w-4" />
                  : <MessageCircle className="h-4 w-4" />
                }
              </span>
              <span className="tracking-[0.01em]">
                {isChiChiOpen ? "Close Assistant" : "Chat with ChiChi"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}