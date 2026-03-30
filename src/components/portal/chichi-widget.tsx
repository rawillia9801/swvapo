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
  Sparkles,
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

  useEffect(() => {
    if (!isOpen) return;

    requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [isOpen, isSending, messages]);

  const quickActions: QuickAction[] = [
    {
      key: "add-buyer",
      label: "Add buyer",
      prompt: "Add a new buyer record. I will provide the buyer details next.",
      icon: <PlusCircle className="h-4 w-4" />,
    },
    {
      key: "add-puppy",
      label: "Add puppy",
      prompt: "Add a new puppy record. I will provide the puppy details next.",
      icon: <PlusCircle className="h-4 w-4" />,
    },
    {
      key: "add-event",
      label: "Add event",
      prompt: "Add a puppy event. I will provide the puppy name, date, title, and details next.",
      icon: <CalendarDays className="h-4 w-4" />,
    },
    {
      key: "log-payment",
      label: "Log payment",
      prompt: "Log a buyer payment. I will provide the buyer, amount, date, and method next.",
      icon: <CreditCard className="h-4 w-4" />,
    },
    {
      key: "show-documents",
      label: "Documents",
      prompt: "Show me the documents for this account.",
      icon: <FolderOpen className="h-4 w-4" />,
    },
    {
      key: "show-messages",
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
      <div className="pointer-events-none absolute bottom-[92px] right-3 flex flex-col items-end gap-4 sm:bottom-[102px] sm:right-6">
        {isOpen ? (
          <div className="pointer-events-auto flex h-[min(720px,calc(100vh-120px))] w-[calc(100vw-24px)] max-w-[402px] flex-col overflow-hidden rounded-[28px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,var(--portal-surface)_0%,var(--portal-surface-strong)_100%)] shadow-[0_30px_72px_rgba(19,31,48,0.18)]">
            <div className="border-b border-[var(--portal-border)] bg-[linear-gradient(135deg,#f5f8fe_0%,#eef3fb_52%,#f8fbff_100%)] px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] text-white shadow-[0_18px_34px_rgba(79,99,189,0.2)]">
                  <PawPrint className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold tracking-[-0.02em] text-[var(--portal-text)]">
                    {isAdmin ? "ChiChi + Core" : "ChiChi"}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                    {isAdmin
                      ? "Portal-aware support and owner tools"
                      : "Portal-aware support for your puppy updates, records, payments, and next steps"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--portal-border)] bg-white text-[var(--portal-text-soft)] transition hover:text-[var(--portal-text)]"
                  aria-label="Close ChiChi"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <InfoChip label="Family" value={displayName} />
                <InfoChip label="Puppy" value={puppyName} />
                <InfoChip label="Access" value={isAdmin ? "Admin" : "Portal"} />
              </div>

              <div className="mt-4 inline-flex rounded-[18px] border border-[var(--portal-border)] bg-white/90 p-1 shadow-[0_10px_22px_rgba(31,48,79,0.06)]">
                <button
                  type="button"
                  onClick={() => setActiveTab("ask")}
                  className={`rounded-[14px] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${
                    activeTab === "ask"
                      ? "bg-[var(--portal-surface-muted)] text-[var(--portal-text)]"
                      : "text-[var(--portal-text-muted)]"
                  }`}
                >
                  Ask
                </button>
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab("actions")}
                    className={`rounded-[14px] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${
                      activeTab === "actions"
                        ? "bg-[var(--portal-surface-muted)] text-[var(--portal-text)]"
                        : "text-[var(--portal-text-muted)]"
                    }`}
                  >
                    Admin
                  </button>
                ) : null}
              </div>
            </div>

            <div className="border-b border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4">
              {activeTab === "ask" || !isAdmin ? (
                <div className="rounded-[22px] border border-[var(--portal-border)] bg-white px-4 py-4 shadow-[0_12px_26px_rgba(31,48,79,0.05)]">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                    Ask ChiChi
                  </div>
                  <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                    Ask about documents, updates, breeder messages, payments, transportation, or what to do next.
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      { label: "My Puppy", prompt: "Show me my puppy summary." },
                      { label: "Messages", prompt: "Show me recent messages for this account." },
                      { label: "Payments", prompt: "Show me my payment summary." },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => void handleSend(undefined, item.prompt)}
                        className="rounded-full border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-3 py-2 text-[11px] font-semibold text-[var(--portal-text-soft)] transition hover:border-[var(--portal-border-strong)] hover:bg-white hover:text-[var(--portal-text)]"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {adminAuth ? (
                    <div className="rounded-[20px] border border-[var(--portal-border)] bg-white px-4 py-3 text-[11px] leading-5 text-[var(--portal-text-soft)] shadow-[0_10px_22px_rgba(31,48,79,0.05)]">
                      <div className="font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                        Admin Access
                      </div>
                      <div className="mt-1">
                        {adminAuth.canWriteCore ? "Write access enabled." : "Write access not enabled."}
                      </div>
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
                        className="flex items-center gap-2 rounded-[18px] border border-[var(--portal-border)] bg-white px-3 py-3 text-left text-xs font-semibold text-[var(--portal-text)] shadow-[0_8px_18px_rgba(31,48,79,0.04)] transition hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)]"
                      >
                        <span className="text-[var(--portal-accent-strong)]">{action.icon}</span>
                        <span>{action.label}</span>
                      </button>
                    ))}
                  </div>

                  <Link
                    href="/admin/portal/assistant"
                    className="flex items-center justify-between rounded-[18px] border border-[var(--portal-border)] bg-white px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)]"
                  >
                    <span>Open full admin assistant</span>
                    <Sparkles className="h-4 w-4 text-[var(--portal-accent-strong)]" />
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
                      }`}
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          isUser
                            ? "bg-[rgba(103,122,214,0.14)] text-[var(--portal-accent-strong)]"
                            : "bg-[var(--portal-surface-muted)] text-[var(--portal-accent-strong)]"
                        }`}
                      >
                        {isUser ? userInitial : <PawPrint className="h-3.5 w-3.5" />}
                      </div>
                      <div className="min-w-0">
                        <div
                          className={[
                            "rounded-2xl px-3.5 py-3 text-sm leading-6 shadow-[0_10px_22px_rgba(31,48,79,0.06)]",
                            isUser
                              ? "rounded-br-md bg-[linear-gradient(135deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] text-white"
                              : "rounded-bl-md border border-[var(--portal-border)] bg-white text-[var(--portal-text)]",
                          ].join(" ")}
                        >
                          {renderChatText(message.text)}
                        </div>
                        <div
                          className={`mt-1 px-1 text-[10px] ${
                            isUser
                              ? "text-right text-[var(--portal-text-muted)]"
                              : "text-[var(--portal-text-muted)]"
                          }`}
                        >
                          {message.createdAt}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {isSending ? (
                  <div className="mr-auto flex max-w-[88%] items-end gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--portal-surface-muted)] text-[var(--portal-accent-strong)]">
                      <PawPrint className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-[var(--portal-border)] bg-white px-4 py-3">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--portal-accent-strong)] [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--portal-accent-strong)] [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--portal-accent-strong)]" />
                    </div>
                  </div>
                ) : null}

                <div ref={chatEndRef} />
              </div>
            </div>

            <form
              onSubmit={(event) => void handleSend(event)}
              className="border-t border-[var(--portal-border)] bg-[linear-gradient(180deg,var(--portal-surface-muted)_0%,var(--portal-surface)_100%)] px-3.5 pb-3 pt-3"
            >
              <div className="flex items-end gap-2">
                <textarea
                  value={chatDraft}
                  onChange={(event) => onDraftChange(event.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  rows={1}
                  style={{ minHeight: "42px", maxHeight: "110px" }}
                  placeholder={
                    isAdmin && activeTab === "actions"
                      ? "Describe an admin action..."
                      : "Ask ChiChi about your account or puppy journey..."
                  }
                  className="max-h-[110px] flex-1 resize-none rounded-[22px] border border-[var(--portal-border)] bg-white px-4 py-2.5 text-sm leading-6 text-[var(--portal-text)] outline-none transition placeholder:text-[var(--portal-text-muted)] focus:border-[var(--portal-accent)] focus:ring-4 focus:ring-[rgba(101,122,214,0.14)]"
                />
                <button
                  type="submit"
                  disabled={isSending || !chatDraft.trim()}
                  className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] text-white shadow-[0_14px_26px_rgba(79,99,189,0.22)] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
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
          className={`pointer-events-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] text-white shadow-[0_18px_34px_rgba(79,99,189,0.24)] transition duration-200 hover:scale-[1.06] hover:shadow-[0_22px_40px_rgba(79,99,189,0.28)] ${
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
    <div className="rounded-[16px] border border-[var(--portal-border)] bg-white px-3 py-2.5 shadow-[0_8px_18px_rgba(31,48,79,0.04)]">
      <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-1 truncate text-xs font-semibold text-[var(--portal-text)]" title={value}>
        {value}
      </div>
    </div>
  );
}
