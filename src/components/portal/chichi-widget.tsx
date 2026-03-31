"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, PawPrint, SendHorizonal, Shield, X } from "lucide-react";

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

  const modeLabel = isAdmin ? "Owner" : "Portal";
  const headerStatus = isSending ? "Reading your records..." : "Online";

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      <div className="absolute bottom-[88px] right-3 flex flex-col items-end gap-4 sm:bottom-[98px] sm:right-6">
        {isOpen ? (
          <div className="pointer-events-auto flex h-[min(760px,calc(100vh-112px))] w-[calc(100vw-24px)] max-w-[430px] flex-col overflow-hidden rounded-[28px] border border-[#dfcfbd] bg-[#fbf6f0] shadow-[0_28px_70px_rgba(45,28,16,0.22)]">
            <div className="flex items-start gap-3 border-b border-white/10 bg-[linear-gradient(135deg,#a87848_0%,#8f6945_100%)] px-4 py-4 text-white">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/15">
                <Bot className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-serif text-[1.7rem] font-bold leading-none">ChiChi</div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/75">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                      {headerStatus}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isAdmin && adminAuth?.canWriteCore ? (
                      <Link
                        href="/admin/portal/assistant"
                        className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/12 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white transition hover:bg-white/20"
                      >
                        <Shield className="h-3 w-3" />
                        Console
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                      aria-label="Close ChiChi"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-b border-[#eadfce] bg-[#fffaf4] px-4 py-4">
              <div className="rounded-[22px] border border-[#dfcfbd] bg-white p-4 text-[14px] leading-7 text-[#6d5037] shadow-[0_8px_20px_rgba(45,28,16,0.05)]">
                Ask ChiChi about updates, documents, payments, messages, transportation, and next steps connected to this portal.
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8f7257]">
                  <span className="rounded-full border border-[#eadfce] bg-[#fffaf4] px-3 py-1.5">
                    Account: {displayName}
                  </span>
                  <span className="rounded-full border border-[#eadfce] bg-[#fffaf4] px-3 py-1.5">
                    Puppy: {puppyName}
                  </span>
                  <span className="rounded-full border border-[#eadfce] bg-[#fffaf4] px-3 py-1.5">
                    Mode: {modeLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#fbf6f0] px-4 py-4">
              <div className="flex flex-col gap-3">
                {messages.map((message) => {
                  const isUser = message.role === "user";

                  return (
                    <div
                      key={message.id}
                      className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      {!isUser ? (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f2c47e] text-[#5a4330]">
                          <PawPrint className="h-3.5 w-3.5" />
                        </div>
                      ) : null}

                      <div className={`${isUser ? "max-w-[84%]" : "max-w-[88%]"}`}>
                        <div
                          className={[
                            "rounded-[20px] px-4 py-3 text-sm leading-7 shadow-[0_6px_16px_rgba(45,28,16,0.06)]",
                            isUser
                              ? "rounded-br-md bg-[linear-gradient(135deg,#a87848_0%,#8f6945_100%)] text-white"
                              : "rounded-bl-md border border-[#eadfce] bg-white text-[#5a4330]",
                          ].join(" ")}
                        >
                          {renderChatText(message.text)}
                        </div>
                        <div
                          className={`mt-1 px-1 text-[10px] ${
                            isUser ? "text-right text-[#8f7257]" : "text-[#8f7257]"
                          }`}
                        >
                          {message.createdAt}
                        </div>
                      </div>

                      {isUser ? (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fdf1e8] text-[11px] font-bold text-[#8f6945]">
                          {userInitial}
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {isSending ? (
                  <div className="flex items-end gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f2c47e] text-[#5a4330]">
                      <PawPrint className="h-3.5 w-3.5" />
                    </div>
                    <div className="rounded-[20px] rounded-bl-md border border-[#eadfce] bg-white px-4 py-3 text-sm text-[#8f7257] shadow-[0_6px_16px_rgba(45,28,16,0.06)]">
                      Reading your portal records...
                    </div>
                  </div>
                ) : null}

                <div ref={chatEndRef} />
              </div>
            </div>

            <div className="border-t border-[#eadfce] bg-[rgba(255,255,255,0.75)] px-4 py-4">
              <form onSubmit={handleSend} className="space-y-3">
                <div className="rounded-[24px] border border-[#e3d3c2] bg-[#fffaf4] p-3 shadow-[inset_0_1px_2px_rgba(45,28,16,0.05)]">
                  <textarea
                    value={chatDraft}
                    onChange={(event) => onDraftChange(event.target.value)}
                    onKeyDown={handleTextareaKeyDown}
                    rows={3}
                    placeholder="Ask ChiChi to check updates, find documents, review payments, or explain the next step."
                    className="min-h-[94px] w-full resize-none border-0 bg-transparent px-1 py-1 text-sm leading-7 text-[#4d3b2b] outline-none placeholder:text-[#af8f70]"
                    disabled={isSending}
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="text-[11px] leading-5 text-[#8f7257]">
                    ChiChi answers from the records already linked to this portal.
                  </div>
                  <button
                    type="submit"
                    disabled={!chatDraft.trim() || isSending}
                    className="inline-flex shrink-0 items-center gap-2 rounded-[14px] bg-[#8f6945] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(123,91,63,0.24)] transition hover:bg-[#7d5b3c] disabled:cursor-not-allowed disabled:opacity-60"
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
          className="pointer-events-auto inline-flex items-center gap-3 rounded-full border border-white/20 bg-[linear-gradient(135deg,#a87848_0%,#8f6945_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(95,70,50,0.34)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_48px_rgba(95,70,50,0.38)]"
          aria-label={isOpen ? "Close ChiChi" : "Open ChiChi"}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
            <Bot className="h-4.5 w-4.5" />
          </span>
          <span className="hidden sm:block text-left">
            <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
              AI Agent
            </span>
            <span className="block text-sm font-semibold text-white">ChiChi</span>
          </span>
        </button>
      </div>
    </div>
  );
}
