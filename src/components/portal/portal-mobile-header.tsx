"use client";

import React from "react";
import Link from "next/link";
import { Bot, Mail, Menu } from "lucide-react";

export function PortalMobileHeader({
  pageTitle,
  unreadMessageCount,
  onOpenDrawer,
}: {
  pageTitle: string;
  unreadMessageCount: number;
  onOpenDrawer: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--portal-border)] bg-[rgba(244,248,253,0.84)] px-4 py-3 backdrop-blur-xl md:px-6 lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onOpenDrawer}
          className="inline-flex h-11 w-11 items-center justify-center rounded-[18px] border border-[var(--portal-border)] bg-[rgba(255,255,255,0.88)] text-[var(--portal-text)] shadow-[0_10px_22px_rgba(23,35,56,0.06)]"
          aria-label="Open portal navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <div className="inline-flex items-center gap-1 rounded-full border border-[var(--portal-border)] bg-[rgba(255,255,255,0.82)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
            <Bot className="h-3 w-3 text-[var(--portal-accent-strong)]" />
            My Puppy Portal
          </div>
          <div className="mt-2 truncate text-base font-semibold tracking-[-0.03em] text-[var(--portal-text)]">
            {pageTitle}
          </div>
        </div>

        <Link
          href="/portal/messages"
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-[18px] border border-[var(--portal-border)] bg-[rgba(255,255,255,0.88)] text-[var(--portal-text)] shadow-[0_10px_22px_rgba(23,35,56,0.06)]"
          aria-label="Open messages"
        >
          <Mail className="h-5 w-5" />
          {unreadMessageCount > 0 ? (
            <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--portal-accent-strong)] px-1 text-[9px] font-semibold text-white">
              {Math.min(unreadMessageCount, 9)}
            </span>
          ) : null}
        </Link>
      </div>
    </header>
  );
}
