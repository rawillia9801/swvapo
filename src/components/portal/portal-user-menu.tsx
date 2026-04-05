"use client";

import React from "react";
import Link from "next/link";
import { ChevronDown, Shield } from "lucide-react";

export function PortalUserMenu({
  displayName,
  displayEmail,
  displayPhone,
  userInitial,
  isOpen,
  hasAdminUi,
  onToggle,
  onClose,
  onSignOut,
}: {
  displayName: string;
  displayEmail: string;
  displayPhone: string;
  userInitial: string;
  isOpen: boolean;
  hasAdminUi: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 rounded-[18px] border border-[var(--portal-border)] bg-white px-3.5 py-3.5 shadow-sm transition hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)]"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#6b7cff_0%,#ec4899_100%)] text-sm font-black text-white shadow-sm">
          {userInitial}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div className="truncate text-sm font-semibold text-[var(--portal-text)]">{displayName}</div>
          <div className="truncate text-xs text-[var(--portal-text-muted)]">{displayEmail}</div>
        </div>
        <ChevronDown className="h-4 w-4 text-[var(--portal-text-muted)]" />
      </button>

      {isOpen ? (
        <div className="absolute bottom-[calc(100%+12px)] left-0 z-40 w-full rounded-[20px] border border-[var(--portal-border)] bg-white p-3 shadow-[0_24px_60px_rgba(96,110,148,0.16)]">
          <div className="rounded-[16px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
              Account
            </div>
            <div className="mt-3 text-sm font-semibold text-[var(--portal-text)]">{displayName}</div>
            <div className="mt-1 text-xs text-[var(--portal-text-soft)]">{displayEmail}</div>
            <div className="mt-1 text-xs text-[var(--portal-text-soft)]">{displayPhone}</div>
          </div>

          <div className="mt-3 space-y-2">
            <Link
              href="/portal/profile"
              onClick={onClose}
              className="block rounded-[14px] border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:bg-[var(--portal-surface-muted)]"
            >
              View profile
            </Link>

            {hasAdminUi ? (
              <Link
                href="/admin/portal"
                onClick={onClose}
                className="flex items-center gap-2 rounded-[14px] border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
              >
                <Shield className="h-4 w-4" />
                Open admin portal
              </Link>
            ) : null}

            <button
              type="button"
              onClick={onSignOut}
              className="w-full rounded-[14px] bg-[linear-gradient(90deg,#7c5cff_0%,#f043a2_100%)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95"
            >
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
