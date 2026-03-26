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
  Bell,
  Search,
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

function makeId(prefix = "msg") {
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
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
  const [threadId, setThreadId] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: makeId("assistant"),
      role: "assistant",
      text:
        "Hi, I’m ChiChi Assistant. Ask me about your puppy, payments, documents, messages, updates, or pickup details.",
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
        href: "/available-puppies",
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
      "group flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-200",
      active
        ? "bg-[#d6ab73] text-[#21170f] shadow-[0_10px_24px_rgba(214,171,115,0.24)]"
        : "text-[#f3ede6] hover:bg-white/8 hover:text-white",
    ].join(" ");
  }

  function iconWrapClass(item: NavItem) {
    const active = isActive(item);
    return [
      "flex h-9 w-9 items-center justify-center rounded-xl transition",
      active
        ? "bg-white/45 text-[#2b1d12]"
        : "bg-white/5 text-[#d7c6b4] group-hover:bg-white/10 group-hover:text-white",
    ].join(" ");
  }

  async function sendChiChiMessage(e?: React.FormEvent) {
    e?.preventDefault();
    const text = chatDraft.trim();
    if (!text || isSending) return;

    const userMessage: ChatMessage = {
      id: makeId("user"),
      role: "user",
      text,
      createdAt: formatTime(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setChatDraft("");
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
      chatInputRef.current?.focus();
    }
  }

  const quickPrompts = [
    "How much do I still owe?",
    "What is my puppy’s latest update?",
    "Do I have any documents left to sign?",
    "What is my pickup status?",
  ];

  return (
    <div className="min-h-screen bg-[#f5efe7] text-[#23170f]">
      <header className="sticky top-0 z-40 border-b border-[#d7c6b4] bg-[#8f6945] text-white shadow-[0_10px_28px_rgba(76,50,28,0.18)] md:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white"
            aria-label="Open portal menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#d6ab73] text-[#2a1c12] shadow-sm">
              <Dog className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/75">
                Southwest Virginia Chihuahua
              </div>
              <div className="font-serif text-[23px] leading-none text-white">
                My Puppy Portal
              </div>
            </div>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm font-bold text-white">
            {userInitial}
          </div>
        </div>
      </header>

      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[86%] max-w-[325px] transform bg-transparent p-3 transition-transform duration-300 md:hidden ${
          isDrawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col rounded-[30px] border border-[#2a1f16] bg-[linear-gradient(180deg,#1d1713_0%,#241b15_100%)] px-4 py-5 shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
          <div className="flex items-start justify-between gap-3 px-2">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#d6ab73] text-[#2b1d12]">
                <Dog className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#bea58a]">
                  Southwest Virginia Chihuahua
                </div>
                <div className="font-serif text-[20px] leading-none text-white">
                  My Puppy Portal
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsDrawerOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-white/80"
              aria-label="Close portal menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="mt-6 flex-1 space-y-2">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className={navClass(item)}>
                <span className={iconWrapClass(item)}>{item.icon}</span>
                <span className="text-[15px] font-semibold leading-tight">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-5 border-t border-white/10 pt-5">
            <button
              onClick={handleSignOut}
              className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-[15px] font-semibold text-white transition hover:bg-white/10"
            >
              Sign out
            </button>

            <div className="mt-3 px-1 text-xs text-[#c9b8a8]">
              Signed in as{" "}
              <span className="font-semibold text-white">{user?.email || "—"}</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen">
        <aside className="hidden w-[292px] shrink-0 md:block">
          <div className="sticky top-0 flex h-screen flex-col border-r border-[#2d2118] bg-[linear-gradient(180deg,#1c1713_0%,#251c15_100%)] px-5 py-6 text-white">
            <div className="flex items-center gap-3 px-1">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d6ab73] text-[#2b1d12] shadow-sm">
                <Dog className="h-6 w-6" />
              </div>

              <div className="leading-tight">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#bea58a]">
                  Southwest Virginia Chihuahua
                </div>
                <div className="font-serif text-[22px] leading-none text-white">
                  My Puppy Portal
                </div>
              </div>
            </div>

            <nav className="mt-8 flex-1 space-y-2">
              {nav.map((item) => (
                <Link key={item.href} href={item.href} className={navClass(item)}>
                  <span className={iconWrapClass(item)}>{item.icon}</span>
                  <span className="text-[15px] font-semibold leading-tight">{item.label}</span>
                </Link>
              ))}
            </nav>

            <div className="mt-5 rounded-[24px] border border-white/10 bg-white/6 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#bea58a]">
                Portal Access
              </div>
              <div className="mt-2 text-sm font-semibold text-white">{displayName}</div>
              <div className="mt-1 text-xs leading-5 text-[#cdb9a6]">
                Your portal keeps your puppy updates, documents, messages, and payment details in one place.
              </div>

              <button
                onClick={handleSignOut}
                className="mt-4 w-full rounded-2xl bg-[#d6ab73] px-4 py-3 text-sm font-bold text-[#261a12] transition hover:bg-[#ddb985]"
              >
                Sign out
              </button>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="sticky top-0 z-30 hidden border-b border-[#d8c9b8] bg-[#8f6945] text-white shadow-[0_10px_28px_rgba(76,50,28,0.14)] md:block">
            <div className="flex h-[78px] items-center justify-between px-6 lg:px-8">
              <div className="flex items-center gap-4">
                <div className="hidden items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/90 lg:flex">
                  <Search className="h-3.5 w-3.5" />
                  Welcome to My Puppy Portal
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white/90"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                </button>

                <div className="flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-3 py-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d6ab73] text-sm font-black text-[#281b12]">
                    {userInitial}
                  </div>
                  <div className="hidden pr-1 md:block">
                    <div className="text-sm font-semibold text-white">{displayName}</div>
                    <div className="text-[11px] text-white/75">{user?.email || "Portal account"}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <main className="min-h-screen bg-[#f5efe7]">
            <div className="px-4 py-5 md:px-6 md:py-6 lg:px-8">{children}</div>
          </main>
        </div>
      </div>

      <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
        {isChiChiOpen && (
          <div className="w-[calc(100vw-24px)] max-w-[395px] overflow-hidden rounded-[30px] border border-[#d9c8b6] bg-[#fbf6f0] shadow-[0_24px_70px_rgba(45,28,16,0.30)]">
            <div className="flex items-center justify-between border-b border-[#e7dacc] bg-[#8f6945] px-4 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#d6ab73] text-[#2a1d12] shadow-sm">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/75">
                    Portal Assistant
                  </div>
                  <div className="font-serif text-lg leading-none text-white">
                    ChiChi Assistant
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsChiChiOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-white hover:bg-white/10"
                aria-label="Close ChiChi Assistant"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-[#eadfce] px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => {
                      setChatDraft(prompt);
                      chatInputRef.current?.focus();
                    }}
                    className="rounded-full border border-[#dfcfbd] bg-white px-3 py-1.5 text-xs font-semibold text-[#6d5037] transition hover:bg-[#fff9f3]"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-[320px] overflow-y-auto px-4 py-4">
              <div className="space-y-3">
                {messages.map((message) => {
                  const isUser = message.role === "user";

                  return (
                    <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                      <div
                        className={[
                          "max-w-[86%] rounded-[22px] px-4 py-3 text-sm leading-6 shadow-sm",
                          isUser
                            ? "bg-[linear-gradient(135deg,#8f6945_0%,#6e5037_100%)] text-white"
                            : "border border-[#eadfce] bg-white text-[#5a4330]",
                        ].join(" ")}
                      >
                        <div className="whitespace-pre-wrap">{message.text}</div>
                        <div className={`mt-1 text-[11px] ${isUser ? "text-white/80" : "text-[#9a7a57]"}`}>
                          {message.createdAt}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {isSending && (
                  <div className="flex justify-start">
                    <div className="max-w-[86%] rounded-[22px] border border-[#eadfce] bg-white px-4 py-3 text-sm text-[#6b523d] shadow-sm">
                      ChiChi is thinking…
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>
            </div>

            <form onSubmit={sendChiChiMessage} className="border-t border-[#eadfce] bg-white/75 px-4 py-4">
              <div className="rounded-[24px] border border-[#e3d3c2] bg-[#fffaf4] p-3 shadow-inner">
                <textarea
                  ref={chatInputRef}
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  rows={3}
                  placeholder="Ask ChiChi about your puppy, payments, documents, messages, or pickup details."
                  className="w-full resize-none bg-transparent text-sm leading-6 text-[#4d3b2b] outline-none placeholder:text-[#af8f70]"
                />
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-xs text-[#8f7257]">
                  Account-aware answers from your portal data
                </div>

                <button
                  type="submit"
                  disabled={isSending || !chatDraft.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#8f6945] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(123,91,63,0.24)] transition hover:bg-[#7d5b3c] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <SendHorizonal className="h-4 w-4" />
                  {isSending ? "Sending..." : "Send"}
                </button>
              </div>
            </form>
          </div>
        )}

        <button
          onClick={() => setIsChiChiOpen((v) => !v)}
          className="inline-flex items-center gap-3 rounded-full bg-[linear-gradient(135deg,#8f6945_0%,#6f5037_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(95,70,50,0.34)] transition hover:-translate-y-[1px]"
          aria-label="Toggle ChiChi Assistant"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/12">
            <MessageCircle className="h-5 w-5" />
          </span>
          <span>Click to Chat with ChiChi Assistant</span>
        </button>
      </div>
    </div>
  );
}