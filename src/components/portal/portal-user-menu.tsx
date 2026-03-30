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
        className="flex w-full items-center gap-3 rounded-[22px] border border-[var(--portal-border)] bg-[rgba(255,255,255,0.82)] px-3 py-3 shadow-[0_12px_26px_rgba(23,35,56,0.05)] transition hover:border-[var(--portal-border-strong)] hover:bg-white"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#dfe8ff_0%,#c6d4ff_100%)] text-sm font-black text-[var(--portal-accent-strong)]">
          {userInitial}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div className="truncate text-sm font-semibold text-[var(--portal-text)]">{displayName}</div>
          <div className="truncate text-xs text-[var(--portal-text-muted)]">{displayEmail}</div>
        </div>
        <ChevronDown className="h-4 w-4 text-[var(--portal-text-muted)]" />
      </button>

      {isOpen ? (
        <div className="absolute bottom-[calc(100%+12px)] left-0 z-40 w-full rounded-[26px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(246,250,255,0.96)_100%)] p-3 shadow-[0_24px_48px_rgba(23,35,56,0.16)] backdrop-blur-xl">
          <div className="rounded-[20px] border border-[var(--portal-border)] bg-[rgba(255,255,255,0.84)] px-4 py-4">
            <div className="text-sm font-semibold text-[var(--portal-text)]">{displayName}</div>
            <div className="mt-1 text-xs text-[var(--portal-text-muted)]">{displayEmail}</div>
            <div className="mt-1 text-xs text-[var(--portal-text-muted)]">{displayPhone}</div>
          </div>

          <div className="mt-3 space-y-2">
            <Link
              href="/portal/profile"
              onClick={onClose}
              className="block rounded-[16px] border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]"
            >
              View profile
            </Link>
            {hasAdminUi ? (
              <Link
                href="/admin/portal"
                onClick={onClose}
                className="flex items-center gap-2 rounded-[16px] border border-[rgba(93,121,255,0.16)] bg-[rgba(93,121,255,0.08)] px-4 py-3 text-sm font-semibold text-[var(--portal-accent-strong)] transition hover:border-[rgba(93,121,255,0.26)]"
              >
                <Shield className="h-4 w-4" />
                Open admin portal
              </Link>
            ) : null}
            <button
              type="button"
              onClick={onSignOut}
              className="w-full rounded-[16px] border border-[var(--portal-border)] bg-[var(--portal-text)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1b2940]"
            >
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
