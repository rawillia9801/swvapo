"use client";

import React from "react";
import Link from "next/link";
import { Mail, Menu } from "lucide-react";

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
    <header className="sticky top-0 z-30 border-b border-[var(--portal-border)] bg-[rgba(247,250,253,0.92)] px-4 py-3 backdrop-blur md:px-6 lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onOpenDrawer}
          className="inline-flex h-11 w-11 items-center justify-center rounded-[18px] border border-[var(--portal-border)] bg-white text-[var(--portal-text)] shadow-[0_10px_22px_rgba(31,48,79,0.06)]"
          aria-label="Open portal navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
            My Puppy Portal
          </div>
          <div className="truncate text-base font-semibold tracking-[-0.02em] text-[var(--portal-text)]">
            {pageTitle}
          </div>
        </div>

        <Link
          href="/portal/messages"
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-[18px] border border-[var(--portal-border)] bg-white text-[var(--portal-text)] shadow-[0_10px_22px_rgba(31,48,79,0.06)]"
          aria-label="Open messages"
        >
          <Mail className="h-5 w-5" />
          {unreadMessageCount > 0 ? (
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[var(--portal-accent-strong)]" />
          ) : null}
        </Link>
      </div>
    </header>
  );
}
