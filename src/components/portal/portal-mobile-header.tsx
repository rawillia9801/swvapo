"use client";

import React from "react";
import { Bell, Menu, PawPrint } from "lucide-react";

export function PortalMobileHeader({
  pageTitle,
  notificationCount,
  onOpenDrawer,
  onOpenNotifications,
}: {
  pageTitle: string;
  notificationCount: number;
  onOpenDrawer: () => void;
  onOpenNotifications: () => void;
}) {
  return (
    <header className="glass-nav sticky top-0 z-30 px-4 py-3 md:px-6 lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onOpenDrawer}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--portal-border)] bg-white/92 text-[var(--portal-text)] shadow-sm transition hover:border-[var(--portal-border-strong)]"
          aria-label="Open portal navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <div className="flex items-center justify-center gap-2 truncate text-base font-extrabold tracking-[-0.03em] text-[var(--portal-accent-strong)]">
            <PawPrint className="h-4 w-4" />
            Puppy Portal
          </div>
          <div className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
            {pageTitle}
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenNotifications}
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--portal-border)] bg-white/92 text-[var(--portal-text)] shadow-sm transition hover:border-[var(--portal-border-strong)]"
          aria-label="Open notifications"
        >
          <Bell className="h-5 w-5" />
          {notificationCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#fffaf5] bg-[var(--portal-accent)] px-1 text-[9px] font-bold text-white">
              {Math.min(notificationCount, 9)}
            </span>
          ) : null}
        </button>
      </div>
    </header>
  );
}
