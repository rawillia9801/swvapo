"use client";

import React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

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
        className="flex w-full items-center gap-3 rounded-[26px] border border-[#eadccf] bg-white px-3 py-3 shadow-[0_12px_28px_rgba(99,69,39,0.05)] transition hover:border-[#d7b58e]"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#d4a35d_0%,#b77a31_100%)] text-sm font-black text-white">
          {userInitial}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div className="truncate text-sm font-semibold text-[#2f2218]">{displayName}</div>
          <div className="truncate text-xs text-[#8d6c4b]">{displayEmail}</div>
        </div>
        <ChevronDown className="h-4 w-4 text-[#8d6c4b]" />
      </button>

      {isOpen ? (
        <div className="absolute bottom-[calc(100%+12px)] left-0 z-40 w-full rounded-[26px] border border-[#d8cab7] bg-[#fffaf4] p-3 shadow-[0_24px_48px_rgba(47,32,20,0.18)]">
          <div className="rounded-[20px] border border-[#eadfce] bg-white px-4 py-3">
            <div className="text-sm font-semibold text-[#342116]">{displayName}</div>
            <div className="mt-1 text-xs text-[#8b6b4d]">{displayEmail}</div>
            <div className="mt-1 text-xs text-[#8b6b4d]">{displayPhone}</div>
          </div>

          <div className="mt-3 space-y-2">
            <Link
              href="/portal/profile"
              onClick={onClose}
              className="block rounded-[18px] border border-[#eadfce] bg-white px-4 py-3 text-sm font-semibold text-[#4d392a] transition hover:bg-[#fff9f3]"
            >
              View and Edit Profile
            </Link>
            {hasAdminUi ? (
              <Link
                href="/admin/portal"
                onClick={onClose}
                className="block rounded-[18px] border border-[#eadfce] bg-[#fff7ef] px-4 py-3 text-sm font-semibold text-[#4d392a] transition hover:bg-white"
              >
                Open Admin Portal
              </Link>
            ) : null}
            <button
              type="button"
              onClick={onSignOut}
              className="w-full rounded-[18px] border border-[#eadfce] bg-[#6f5037] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#5d4330]"
            >
              Sign Out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
