"use client";

import React from "react";
import Link from "next/link";
import { ExternalLink, PawPrint } from "lucide-react";

export type PortalNavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  badge?: number;
};

type UtilityLink = {
  href: string;
  label: string;
  icon: React.ReactNode;
  trailing?: React.ReactNode;
};

export function PortalSidebar({
  brandTitle,
  brandSubtitle,
  welcomeTitle,
  welcomeDescription,
  navItems,
  utilityLinks,
  footer,
}: {
  brandTitle: string;
  brandSubtitle: string;
  welcomeTitle: string;
  welcomeDescription: string;
  navItems: PortalNavItem[];
  utilityLinks: UtilityLink[];
  footer: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col gap-5">
      <div className="rounded-[34px] border border-[#eadccf] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2ea_100%)] p-5 shadow-[0_22px_60px_rgba(99,69,39,0.09)]">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,#d4a35d_0%,#b77a31_100%)] text-white shadow-[0_14px_30px_rgba(183,122,49,0.24)]">
            <PawPrint className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-semibold text-[#2f2218]">{brandTitle}</div>
            <div className="text-xs tracking-[0.12em] text-[#8d6c4b]">{brandSubtitle}</div>
          </div>
        </div>

        <div className="mt-5 rounded-[28px] border border-[#eadccf] bg-white px-4 py-4 shadow-[0_14px_30px_rgba(99,69,39,0.05)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#a17848]">
            Welcome
          </div>
          <div className="mt-2 text-lg font-semibold leading-tight text-[#2f2218]">
            {welcomeTitle}
          </div>
          <div className="mt-2 text-sm leading-6 text-[#72553c]">{welcomeDescription}</div>
        </div>
      </div>

      <nav className="rounded-[34px] border border-[#eadccf] bg-[linear-gradient(180deg,#fffdfb_0%,#f8efe5_100%)] p-4 shadow-[0_22px_60px_rgba(99,69,39,0.08)]">
        <div className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#a17848]">
          My Puppy Portal
        </div>
        <div className="space-y-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={navItemClass(Boolean(item.active))}>
              <span className={navIconClass(Boolean(item.active))}>{item.icon}</span>
              <span className="text-sm font-semibold">{item.label}</span>
              {typeof item.badge === "number" && item.badge > 0 ? (
                <span className="ml-auto inline-flex min-w-[22px] items-center justify-center rounded-full bg-[#cf6a43] px-2 py-1 text-[10px] font-semibold text-white">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </nav>

      <div className="rounded-[34px] border border-[#eadccf] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2ea_100%)] p-4 shadow-[0_18px_42px_rgba(99,69,39,0.08)]">
        <div className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#a17848]">
          Account
        </div>
        <div className="space-y-3">
          {utilityLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between rounded-[22px] border border-[#eadccf] bg-white px-4 py-3 text-sm font-semibold text-[#2f2218] transition hover:-translate-y-0.5 hover:border-[#d7b58e]"
            >
              <span className="flex items-center gap-3">
                <span className="text-[#a17848]">{link.icon}</span>
                {link.label}
              </span>
              {link.trailing || <ExternalLink className="h-4 w-4 text-[#8d6c4b]" />}
            </Link>
          ))}
        </div>

        <div className="mt-4">{footer}</div>
      </div>
    </div>
  );
}

function navItemClass(active: boolean) {
  return [
    "group flex items-center gap-3 rounded-[22px] px-4 py-3 transition-all duration-200",
    active
      ? "bg-white text-[#2f2218] shadow-[0_18px_34px_rgba(99,69,39,0.12)] ring-1 ring-[#ead9c7]"
      : "text-[#785b42] hover:bg-white/80 hover:text-[#2f2218]",
  ].join(" ");
}

function navIconClass(active: boolean) {
  return [
    "flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-200",
    active
      ? "bg-[linear-gradient(135deg,#efd4a5_0%,#d39a52_100%)] text-[#3d2918] shadow-[0_10px_20px_rgba(183,122,49,0.18)]"
      : "bg-[#f8efe5] text-[#9f7b55] group-hover:bg-white group-hover:text-[#2f2218]",
  ].join(" ");
}
