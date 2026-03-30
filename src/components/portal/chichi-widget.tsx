"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, PawPrint, SendHorizonal, Shield, Sparkles, X } from "lucide-react";

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
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [isOpen, isSending, messages]);

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
          <div className="pointer-events-auto flex h-[min(760px,calc(100vh-118px))] w-[calc(100vw-24px)] max-w-[430px] flex-col overflow-hidden rounded-[30px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(246,250,255,0.95)_100%)] shadow-[0_34px_86px_rgba(16,24,38,0.18)] backdrop-blur-xl">
            <div className="relative overflow-hidden border-b border-[var(--portal-border)] px-4 py-4">
              <div className="pointer-events-none absolute inset-0 portal-grid-bg opacity-60" />
              <div className="pointer-events-none absolute -left-6 top-2 h-28 w-28 rounded-full bg-[rgba(93,121,255,0.14)] blur-3xl" />

              <div className="relative flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#dce6ff_0%,#c7d6ff_100%)] text-[var(--portal-accent-strong)] shadow-[0_16px_34px_rgba(47,88,227,0.14)]">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold tracking-[-0.02em] text-[var(--portal-text)]">
                        ChiChi
                      </div>
                      <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                        Autonomous account agent with direct access to your portal records, puppy updates, documents, payments, and next steps.
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
                    <InfoChip label="Account" value={displayName} />
                    <InfoChip label="Puppy" value={puppyName} />
                    <InfoChip label="Mode" value={isAdmin ? "Owner" : "Portal"} />
                  </div>

                  {isAdmin && adminAuth?.canWriteCore ? (
                    <div className="mt-3 flex items-center justify-between rounded-[18px] border border-[rgba(93,121,255,0.16)] bg-[rgba(93,121,255,0.08)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-accent-strong)]">
                      <span className="flex items-center gap-2">
                        <Shield className="h-3.5 w-3.5" />
                        Owner write access enabled
                      </span>
                      <Link href="/admin/portal/assistant" className="rounded-full border border-[rgba(93,121,255,0.18)] bg-white/80 px-2.5 py-1 text-[10px]">
                        Console
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="flex flex-col gap-4">
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
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          isUser
                            ? "bg-[rgba(93,121,255,0.14)] text-[var(--portal-accent-strong)]"
                            : "bg-[var(--portal-surface-muted)] text-[var(--portal-accent-strong)]"
                        }`}
                      >
                        {isUser ? (
                          <span className="text-[11px] font-bold">{userInitial}</span>
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div
                          className={[
                            "rounded-[22px] px-4 py-3 text-sm leading-6 shadow-[0_12px_26px_rgba(23,35,56,0.06)]",
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--portal-surface-muted)] text-[var(--portal-accent-strong)]">
                      <PawPrint className="h-3.5 w-3.5" />
                    </div>
                    <div className="rounded-[22px] rounded-bl-md border border-[var(--portal-border)] bg-white px-4 py-3 text-sm text-[var(--portal-text-soft)] shadow-[0_12px_26px_rgba(23,35,56,0.06)]">
                      Reading your portal records...
                    </div>
                  </div>
                ) : null}

                <div ref={chatEndRef} />
              </div>
            </div>

            <div className="border-t border-[var(--portal-border)] bg-[rgba(248,251,255,0.88)] px-4 py-4">
              <form onSubmit={handleSend} className="space-y-3">
                <div className="rounded-[24px] border border-[var(--portal-border)] bg-white p-2 shadow-[0_12px_28px_rgba(23,35,56,0.05)]">
                  <textarea
                    value={chatDraft}
                    onChange={(event) => onDraftChange(event.target.value)}
                    onKeyDown={handleTextareaKeyDown}
                    rows={3}
                    placeholder="Ask ChiChi to check updates, find documents, review payments, explain a milestone, or tell you the next step."
                    className="min-h-[98px] w-full resize-none rounded-[18px] border-0 bg-transparent px-3 py-3 text-sm leading-6 text-[var(--portal-text)] outline-none placeholder:text-[var(--portal-text-muted)]"
                    disabled={isSending}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] leading-5 text-[var(--portal-text-muted)]">
                    ChiChi answers from the records on this account and says plainly when something is not on file.
                  </div>
                  <button
                    type="submit"
                    disabled={!chatDraft.trim() || isSending}
                    className="inline-flex shrink-0 items-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(47,88,227,0.22)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <SendHorizonal className="h-4 w-4" />
                    Send
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setIsOpen((value) => !value)}
          className="pointer-events-auto inline-flex items-center gap-3 rounded-full border border-[var(--portal-border)] bg-[linear-gradient(135deg,rgba(255,255,255,0.96)_0%,rgba(242,247,253,0.96)_100%)] px-4 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[0_18px_38px_rgba(16,24,38,0.14)] backdrop-blur-xl transition hover:-translate-y-0.5"
          aria-label={isOpen ? "Close ChiChi" : "Open ChiChi"}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#dce6ff_0%,#c7d6ff_100%)] text-[var(--portal-accent-strong)]">
            <Bot className="h-4.5 w-4.5" />
          </span>
          <span className="hidden sm:block">
            <span className="block text-left text-[11px] uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
              AI Agent
            </span>
            <span className="block text-left text-sm font-semibold text-[var(--portal-text)]">
              ChiChi
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[var(--portal-border)] bg-[rgba(255,255,255,0.82)] px-3 py-3 shadow-[0_8px_18px_rgba(23,35,56,0.04)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-[var(--portal-text)]">{value}</div>
    </div>
  );
}
