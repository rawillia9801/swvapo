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
} from "lucide-react";
import { sb } from "@/lib/utils";

type PortalUser = {
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

  const chatScrollRef = useRef<HTMLDivElement | null>(null);
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
        chatScrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
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
      "group flex items-center gap-3 rounded-[18px] px-4 py-3 transition-all duration-200",
      active
        ? "bg-[#6f5338] text-white shadow-[0_12px_30px_rgba(111,83,56,0.24)]"
        : "text-[#4d3b2b] hover:bg-white hover:shadow-sm",
    ].join(" ");
  }

  function iconWrapClass(item: NavItem) {
    const active = isActive(item);
    return [
      "flex h-9 w-9 items-center justify-center rounded-full transition",
      active ? "bg-white/10 text-white" : "bg-transparent text-[#8b7257] group-hover:text-[#4d3b2b]",
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

      if (data?.threadId) {
        setThreadId(data.threadId);
      }

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
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f2ea_0%,#f3ece2_50%,#efe6db_100%)] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-[#e5d8c7] bg-white/80 backdrop-blur-xl md:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e2d3c1] bg-white text-[#6f5338] shadow-sm"
            aria-label="Open portal menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7b5b3f] text-white shadow-sm">
              <Dog className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9a7a57]">
                Southwest Virginia Chihuahua
              </div>
              <div className="font-serif text-[24px] leading-none text-[#4d3b2b]">
                My Puppy Portal
              </div>
            </div>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e2d3c1] bg-[#f7efe5] text-sm font-bold text-[#6f5338]">
            {userInitial}
          </div>
        </div>
      </header>

      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#2e2218]/35 backdrop-blur-sm md:hidden"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[86%] max-w-[320px] transform bg-transparent p-4 transition-transform duration-300 md:hidden ${
          isDrawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col rounded-[28px] border border-[#e0d1bf] bg-[linear-gradient(180deg,#f3ece2_0%,#efe6db_100%)] px-4 py-5 shadow-[0_20px_60px_rgba(74,51,33,0.16)]">
          <div className="flex items-start justify-between gap-3 px-2">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7b5b3f] text-white">
                <Dog className="h-5 w-5" />
              </div>

              <div className="leading-tight">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#9a7a57]">
                  Southwest Virginia Chihuahua
                </div>
                <div className="font-serif text-[18px] leading-none text-[#4d3b2b]">
                  My Puppy Portal
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsDrawerOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-[#7b5b3f]"
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

          <div className="mt-5 border-t border-[#dfcfbd] pt-5">
            <button
              onClick={handleSignOut}
              className="w-full rounded-[16px] border border-[#e0d1bf] bg-white px-4 py-3 text-[15px] font-semibold text-[#5a4330] shadow-sm transition hover:bg-[#fffaf5]"
            >
              Sign out
            </button>

            <div className="mt-3 px-1 text-xs text-[#8f7257]">
              Signed in as <span className="font-semibold text-[#5a4330]">{user?.email || "—"}</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-4 md:px-6 md:py-6 xl:px-8">
        <aside className="hidden md:block md:w-[300px] md:flex-shrink-0">
          <div className="sticky top-6 flex flex-col rounded-[28px] border border-[#e0d1bf] bg-[linear-gradient(180deg,#f3ece2_0%,#efe6db_100%)] px-4 py-5 shadow-[0_20px_60px_rgba(74,51,33,0.12)]">
            <div className="flex items-center gap-3 px-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7b5b3f] text-white">
                <Dog className="h-5 w-5" />
              </div>

              <div className="leading-tight">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#9a7a57]">
                  Southwest Virginia Chihuahua
                </div>
                <div className="font-serif text-[18px] leading-none text-[#4d3b2b]">
                  My Puppy Portal
                </div>
              </div>
            </div>

            <nav className="mt-6 flex-1 space-y-2">
              {nav.map((item) => (
                <Link key={item.href} href={item.href} className={navClass(item)}>
                  <span className={iconWrapClass(item)}>{item.icon}</span>
                  <span className="text-[15px] font-semibold leading-tight">{item.label}</span>
                </Link>
              ))}
            </nav>

            <div className="mt-5 border-t border-[#dfcfbd] pt-5">
              <button
                onClick={handleSignOut}
                className="w-full rounded-[16px] border border-[#e0d1bf] bg-white px-4 py-3 text-[15px] font-semibold text-[#5a4330] shadow-sm transition hover:bg-[#fffaf5]"
              >
                Sign out
              </button>

              <div className="mt-3 px-1 text-xs text-[#8f7257]">
                Signed in as <span className="font-semibold text-[#5a4330]">{user?.email || "—"}</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
        {isChiChiOpen && (
          <div className="w-[calc(100vw-24px)] max-w-[380px] overflow-hidden rounded-[28px] border border-[#e4d5c3] bg-[linear-gradient(180deg,#fffaf4_0%,#fffdfb_100%)] shadow-[0_24px_70px_rgba(74,51,33,0.24)] backdrop-blur">
            <div className="flex items-center justify-between border-b border-[#eadfce] px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7b5b3f] text-white shadow-sm">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9a7a57]">
                    Portal Assistant
                  </div>
                  <div className="font-serif text-lg leading-none text-[#4d3b2b]">
                    ChiChi Assistant
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsChiChiOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-[#7b5b3f] hover:bg-white/70"
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
                    className="rounded-full border border-[#e4d5c3] bg-white px-3 py-1.5 text-xs font-semibold text-[#6e5339] transition hover:bg-[#fff7ee]"
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
                            ? "bg-[linear-gradient(135deg,#7b5b3f_0%,#5f4632_100%)] text-white"
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

                <div ref={chatScrollRef} />
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
                  className="inline-flex items-center gap-2 rounded-xl bg-[#7b5b3f] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(123,91,63,0.24)] transition hover:bg-[#6d5037] disabled:cursor-not-allowed disabled:opacity-60"
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
          className="inline-flex items-center gap-3 rounded-full bg-[linear-gradient(135deg,#7b5b3f_0%,#5f4632_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(95,70,50,0.34)] transition hover:-translate-y-[1px]"
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