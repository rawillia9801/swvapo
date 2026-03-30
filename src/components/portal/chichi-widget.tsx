"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CreditCard,
  FolderOpen,
  MessagesSquare,
  PawPrint,
  PlusCircle,
  SendHorizonal,
  X,
} from "lucide-react";

type ChatRole = "user" | "assistant";

export type PortalChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: string;
};

export type PortalAdminAuth = {
  userId?: string | null;
  email?: string | null;
  canWriteCore?: boolean;
} | null;

type QuickAction = {
  key: string;
  label: string;
  prompt: string;
  icon: React.ReactNode;
};

type ChiChiTab = "ask" | "actions";

function cleanAssistantText(text: string) {
  return String(text || "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^>\s*/gm, "")
    .replace(/^[\-*]\s+/gm, "- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderChatText(text: string) {
  const paragraphs = cleanAssistantText(text)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <div className="space-y-3">
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="whitespace-pre-wrap leading-relaxed">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

export function PortalChiChiWidget({
  displayName,
  puppyName,
  userInitial,
  isAdmin,
  messages,
  adminAuth,
  isSending,
  chatDraft,
  onDraftChange,
  onSend,
}: {
  displayName: string;
  puppyName: string;
  userInitial: string;
  isAdmin: boolean;
  messages: PortalChatMessage[];
  adminAuth: PortalAdminAuth;
  isSending: boolean;
  chatDraft: string;
  onDraftChange: (value: string) => void;
  onSend: (overrideText?: string) => Promise<void> | void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ChiChiTab>("ask");
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    }
  }, [isOpen, isSending, messages]);

  const quickActions: QuickAction[] = [
    {
      key: "add-buyer",
      label: "Add Buyer",
      prompt: "Add a new buyer record. I will provide the buyer details next.",
      icon: <PlusCircle className="h-4 w-4" />,
    },
    {
      key: "add-puppy",
      label: "Add Puppy",
      prompt: "Add a new puppy record. I will provide the puppy details next.",
      icon: <PlusCircle className="h-4 w-4" />,
    },
    {
      key: "add-event",
      label: "Add Event",
      prompt: "Add a puppy event. I will provide the puppy name, date, title, and details next.",
      icon: <CalendarDays className="h-4 w-4" />,
    },
    {
      key: "log-payment",
      label: "Log Payment",
      prompt: "Log a buyer payment. I will provide the buyer, amount, date, and method next.",
      icon: <CreditCard className="h-4 w-4" />,
    },
    {
      key: "documents",
      label: "Documents",
      prompt: "Show me the documents for this account.",
      icon: <FolderOpen className="h-4 w-4" />,
    },
    {
      key: "messages",
      label: "Messages",
      prompt: "Show me recent messages for this account.",
      icon: <MessagesSquare className="h-4 w-4" />,
    },
  ];

  async function handleSend(event?: React.FormEvent, overrideText?: string) {
    event?.preventDefault();
    await onSend(overrideText);
  }

  function handleTextareaKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      <div className="pointer-events-none absolute bottom-[94px] right-3 flex flex-col items-end gap-4 sm:bottom-[104px] sm:right-6">
        {isOpen ? (
          <div className="pointer-events-auto flex h-[min(700px,calc(100vh-120px))] w-[calc(100vw-24px)] max-w-[390px] flex-col overflow-hidden rounded-[26px] border border-[#e6d7c6] bg-[#fffaf5] shadow-[0_22px_60px_rgba(84,58,32,0.16)]">
            <div className="flex items-center gap-3 bg-[linear-gradient(135deg,#c98a46_0%,#a86528_100%)] px-4 py-4 text-white">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-[#f2cf97] text-[#6a3e18] shadow-[0_8px_18px_rgba(0,0,0,0.14)]">
                <PawPrint className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-extrabold">{isAdmin ? "ChiChi + Core" : "ChiChi"}</div>
                <div className="mt-0.5 text-xs text-white/85">
                  {isAdmin ? "Account-aware and admin ready" : "Account-aware support and puppy guidance"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
                aria-label="Close ChiChi"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-[#eadfce] bg-[#fffaf4] px-4 py-4">
              <div className="grid grid-cols-3 gap-2">
                <InfoChip label="Family" value={displayName} />
                <InfoChip label="Puppy" value={puppyName} />
                <InfoChip label="Access" value={isAdmin ? "Admin" : "Standard"} />
              </div>

              <div className="mt-3 inline-flex rounded-2xl bg-[#f3ece3] p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("ask")}
                  className={`rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${
                    activeTab === "ask" ? "bg-white text-[#2f2218] shadow-sm" : "text-[#7b624c]"
                  }`}
                >
                  Ask
                </button>
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab("actions")}
                    className={`rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${
                      activeTab === "actions" ? "bg-white text-[#2f2218] shadow-sm" : "text-[#7b624c]"
                    }`}
                  >
                    Core Console
                  </button>
                ) : null}
              </div>
            </div>

            <div className="border-b border-[#eadfce] bg-[#fffaf4] px-4 py-4">
              {activeTab === "ask" || !isAdmin ? (
                <div className="rounded-[22px] border border-[#e3d2bf] bg-white p-4 text-sm leading-7 text-[#6d5037] shadow-[0_12px_24px_rgba(96,67,38,0.04)]">
                  <div className="font-semibold text-[#4d3b2b]">Your portal assistant</div>
                  <div className="mt-1">
                    Ask about your application, puppy updates, documents, breeder messages, payments, transport plans, or Chihuahua care.
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      { label: "My Puppy", prompt: "Show me my puppy summary." },
                      { label: "Messages", prompt: "Show me recent messages for this account." },
                      { label: "Payments", prompt: "Show me my payment summary." },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => void handleSend(undefined, item.prompt)}
                        className="rounded-full border border-[#dfcfbd] bg-[#fff9f3] px-3 py-2 text-[11px] font-semibold text-[#6d5037] transition hover:border-[#d7bea2] hover:bg-white"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {adminAuth ? (
                    <div className="rounded-[18px] border border-[#dfcfbd] bg-white px-4 py-3 text-[11px] leading-5 text-[#6d5037]">
                      <div className="font-semibold uppercase tracking-[0.16em] text-[#927050]">Server Admin Status</div>
                      <div className="mt-1">{adminAuth.canWriteCore ? "Write access enabled." : "Write access not enabled yet."}</div>
                      <div className="mt-1 break-all">{adminAuth.email || "No email returned"}</div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2">
                    {quickActions.map((action) => (
                      <button
                        key={action.key}
                        type="button"
                        onClick={() => {
                          setActiveTab("ask");
                          void handleSend(undefined, action.prompt);
                        }}
                        className="flex items-center gap-2 rounded-[18px] border border-[#eadfce] bg-white px-3 py-3 text-left text-xs font-semibold text-[#5a4433] shadow-sm transition hover:border-[#d7bea2] hover:bg-[#fff9f3]"
                      >
                        <span className="text-[#b97832]">{action.icon}</span>
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>

                  <Link
                    href="/admin/portal/assistant"
                    className="flex items-center justify-between rounded-[18px] border border-[#d7bea2] bg-[#fff7ef] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6e5035] transition hover:bg-white"
                  >
                    <span>Open Full Admin Assistant</span>
                    <span aria-hidden="true">-&gt;</span>
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
                      className={`flex max-w-[88%] items-end gap-2 ${isUser ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          isUser ? "bg-[#f3e0ce] text-[#b97832]" : "bg-[#efd19c] text-[#6a3e18]"
                        }`}
                      >
                        {isUser ? userInitial : <PawPrint className="h-3.5 w-3.5" />}
                      </div>
                      <div className="min-w-0">
                        <div
                          className={[
                            "rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm",
                            isUser
                              ? "rounded-br-md bg-[#cf7c42] text-white"
                              : "rounded-bl-md border border-[#ead4bf] bg-[#fff8f1] text-[#2d1f12]",
                          ].join(" ")}
                        >
                          {renderChatText(message.text)}
                        </div>
                        <div className={`mt-1 px-1 text-[10px] ${isUser ? "text-right text-[#7a5c42]" : "text-[#7a5c42]"}`}>
                          {message.createdAt}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {isSending ? (
                  <div className="mr-auto flex max-w-[88%] items-end gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#efd19c] text-[#6a3e18]">
                      <PawPrint className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-[#ead4bf] bg-[#fff8f1] px-4 py-3">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#cf7c42] [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#cf7c42] [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#cf7c42]" />
                    </div>
                  </div>
                ) : null}

                <div ref={chatEndRef} />
              </div>
            </div>

            <form onSubmit={(event) => void handleSend(event)} className="border-t border-[#ead4bf] bg-[#fffaf6] px-3.5 pb-3 pt-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={chatInputRef}
                  value={chatDraft}
                  onChange={(event) => onDraftChange(event.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  rows={1}
                  style={{ minHeight: "42px", maxHeight: "110px" }}
                  placeholder={isAdmin && activeTab === "actions" ? "Describe a Core action..." : "Ask ChiChi about your account or puppy journey..."}
                  className="max-h-[110px] flex-1 resize-none rounded-[22px] border border-[#ead4bf] bg-white px-4 py-2.5 text-sm leading-6 text-[#2d1f12] outline-none transition placeholder:text-[#b79d82] focus:border-[#cf7c42]"
                />
                <button
                  type="submit"
                  disabled={isSending || !chatDraft.trim()}
                  className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#cf7c42,#a86528)] text-white shadow-[0_3px_12px_rgba(90,50,20,0.15)] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                  aria-label="Send message"
                >
                  <SendHorizonal className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setIsOpen((value) => !value)}
          className={`pointer-events-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,#cf7c42,#a86528)] text-white shadow-[0_8px_26px_rgba(90,50,20,0.18)] transition duration-200 hover:scale-[1.06] hover:shadow-[0_12px_36px_rgba(90,50,20,0.22)] ${
            isOpen ? "scale-0 opacity-0" : "scale-100 opacity-100"
          }`}
          aria-label="Toggle ChiChi Assistant"
          title="Chat with ChiChi"
        >
          <PawPrint className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}

function InfoChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[16px] border border-[#eadfce] bg-white px-3 py-2.5 shadow-sm">
      <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#a17848]">{label}</div>
      <div className="mt-1 truncate text-xs font-semibold text-[#4d392a]" title={value}>
        {value}
      </div>
    </div>
  );
}
