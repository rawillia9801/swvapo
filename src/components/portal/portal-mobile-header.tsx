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
    <header className="glass-nav sticky top-0 z-30 px-4 py-3 md:px-6 lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onOpenDrawer}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-900 shadow-sm"
          aria-label="Open portal navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <div className="truncate font-serif text-lg font-bold text-stone-900">
            My Puppy Portal
          </div>
          <div className="mt-1 truncate text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">
            {pageTitle}
          </div>
        </div>

        <Link
          href="/portal/messages"
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-900 shadow-sm"
          aria-label="Open messages"
        >
          <Mail className="h-5 w-5" />
          {unreadMessageCount > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-stone-900 px-1 text-[9px] font-bold text-white">
              {Math.min(unreadMessageCount, 9)}
            </span>
          ) : null}
        </Link>
      </div>
    </header>
  );
}
