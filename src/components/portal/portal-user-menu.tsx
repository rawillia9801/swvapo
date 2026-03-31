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
        className="flex w-full items-center gap-3 rounded-[1.6rem] border border-stone-200 bg-white px-3.5 py-3.5 shadow-sm transition hover:border-stone-300 hover:bg-stone-50"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-900 text-sm font-black text-white shadow-sm">
          {userInitial}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div className="truncate text-sm font-semibold text-stone-900">{displayName}</div>
          <div className="truncate text-xs text-stone-500">{displayEmail}</div>
        </div>
        <ChevronDown className="h-4 w-4 text-stone-400" />
      </button>

      {isOpen ? (
        <div className="absolute bottom-[calc(100%+12px)] left-0 z-40 w-full rounded-[1.8rem] border border-stone-200 bg-white p-3 shadow-[0_24px_60px_rgba(28,25,23,0.12)]">
          <div className="rounded-[1.45rem] border border-stone-200 bg-stone-50 px-4 py-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">
              Account
            </div>
            <div className="mt-3 text-sm font-semibold text-stone-900">{displayName}</div>
            <div className="mt-1 text-xs text-stone-500">{displayEmail}</div>
            <div className="mt-1 text-xs text-stone-500">{displayPhone}</div>
          </div>

          <div className="mt-3 space-y-2">
            <Link
              href="/portal/profile"
              onClick={onClose}
              className="block rounded-[1.1rem] border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
            >
              View profile
            </Link>

            {hasAdminUi ? (
              <Link
                href="/admin/portal"
                onClick={onClose}
                className="flex items-center gap-2 rounded-[1.1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
              >
                <Shield className="h-4 w-4" />
                Open admin portal
              </Link>
            ) : null}

            <button
              type="button"
              onClick={onSignOut}
              className="w-full rounded-[1.1rem] bg-stone-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
            >
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
