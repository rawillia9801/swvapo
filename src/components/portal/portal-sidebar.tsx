"use client";

import React from "react";
import Link from "next/link";
import { ExternalLink, Sparkles } from "lucide-react";

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
    <div className="flex h-full min-h-0 flex-col gap-4">
      <section className="premium-card shrink-0 overflow-hidden rounded-[2rem] bg-white p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-stone-900 text-white shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate font-serif text-xl font-bold text-stone-900">
              {brandTitle}
            </div>
            <div className="truncate text-[11px] font-bold uppercase tracking-[0.2em] text-stone-400">
              {brandSubtitle}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">
            Welcome
          </div>
          <div className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-stone-900">
            {welcomeTitle}
          </div>
          <div className="mt-2 text-sm leading-7 text-stone-600">{welcomeDescription}</div>
        </div>
      </section>

      <div className="scroller min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="space-y-4 pb-2">
          <nav className="premium-card rounded-[2rem] bg-white p-4">
            <div className="mb-3 px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">
              Navigation
            </div>
            <div className="space-y-2">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className={navItemClass(Boolean(item.active))}>
                  <span className={navIconClass(Boolean(item.active))}>{item.icon}</span>
                  <span className="text-sm font-semibold">{item.label}</span>
                  {typeof item.badge === "number" && item.badge > 0 ? (
                    <span className="ml-auto inline-flex min-w-[22px] items-center justify-center rounded-full bg-stone-900 px-2 py-1 text-[10px] font-bold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          </nav>

          <div className="premium-card rounded-[2rem] bg-white p-4">
            <div className="mb-3 px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">
              Utility
            </div>
            <div className="space-y-3">
              {utilityLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group flex items-center justify-between rounded-[1.25rem] border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-800 transition hover:-translate-y-0.5 hover:bg-white"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-amber-700 transition group-hover:bg-amber-50">
                      {link.icon}
                    </span>
                    {link.label}
                  </span>
                  {link.trailing || <ExternalLink className="h-4 w-4 text-stone-400" />}
                </Link>
              ))}
            </div>
            <div className="mt-4">{footer}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function navItemClass(active: boolean) {
  return [
    "group relative flex items-center gap-3 rounded-[1.5rem] px-4 py-3.5 transition-all duration-200",
    active
      ? "border border-stone-900 bg-stone-900 text-white shadow-lg"
      : "border border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900",
  ].join(" ");
}

function navIconClass(active: boolean) {
  return [
    "flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-200",
    active
      ? "bg-white/14 text-white"
      : "bg-stone-50 text-stone-500 group-hover:bg-white group-hover:text-amber-700",
  ].join(" ");
}
