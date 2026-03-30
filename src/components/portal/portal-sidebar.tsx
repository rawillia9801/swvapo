"use client";

import React from "react";
import Link from "next/link";
import { Bot, ExternalLink, Sparkles } from "lucide-react";

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
    <div className="flex h-full flex-col gap-4">
      <section className="relative overflow-hidden rounded-[34px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(243,248,255,0.94)_100%)] px-5 py-5 shadow-[0_28px_64px_rgba(23,35,56,0.08)]">
        <div className="pointer-events-none absolute inset-0 portal-grid-bg opacity-60" />
        <div className="pointer-events-none absolute -left-8 top-4 h-28 w-28 rounded-full bg-[rgba(93,121,255,0.12)] blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-[rgba(196,209,229,0.22)] blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-[rgba(255,255,255,0.6)] bg-[linear-gradient(135deg,#eef3ff_0%,#dce6ff_55%,#c5d4ff_100%)] text-[var(--portal-accent-strong)] shadow-[0_18px_34px_rgba(47,88,227,0.16)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold tracking-[-0.03em] text-[var(--portal-text)]">
                {brandTitle}
              </div>
              <div className="truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--portal-text-muted)]">
                {brandSubtitle}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[26px] border border-[var(--portal-border)] bg-[rgba(255,255,255,0.72)] p-4 backdrop-blur-md shadow-[0_14px_28px_rgba(23,35,56,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--portal-text-muted)]">
                Account Surface
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(93,121,255,0.16)] bg-[rgba(93,121,255,0.08)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-accent-strong)]">
                <Bot className="h-3 w-3" />
                AI Ready
              </span>
            </div>
            <div className="mt-3 text-[1.35rem] font-semibold leading-tight tracking-[-0.04em] text-[var(--portal-text)]">
              {welcomeTitle}
            </div>
            <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
              {welcomeDescription}
            </div>
          </div>
        </div>
      </section>

      <nav className="rounded-[34px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(243,248,255,0.94)_100%)] p-4 shadow-[0_22px_52px_rgba(23,35,56,0.07)]">
        <div className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--portal-text-muted)]">
          Navigation
        </div>
        <div className="space-y-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={navItemClass(Boolean(item.active))}>
              <span className={navIconClass(Boolean(item.active))}>{item.icon}</span>
              <span className="text-sm font-semibold">{item.label}</span>
              {typeof item.badge === "number" && item.badge > 0 ? (
                <span className="ml-auto inline-flex min-w-[22px] items-center justify-center rounded-full bg-[var(--portal-accent-strong)] px-2 py-1 text-[10px] font-semibold text-white">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </nav>

      <div className="rounded-[34px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(243,248,255,0.94)_100%)] p-4 shadow-[0_18px_44px_rgba(23,35,56,0.06)]">
        <div className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--portal-text-muted)]">
          Utility
        </div>
        <div className="space-y-3">
          {utilityLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-center justify-between rounded-[20px] border border-[var(--portal-border)] bg-[rgba(255,255,255,0.78)] px-4 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[0_10px_22px_rgba(23,35,56,0.04)] transition hover:-translate-y-0.5 hover:border-[var(--portal-border-strong)] hover:bg-white"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--portal-surface-muted)] text-[var(--portal-accent-strong)] transition group-hover:bg-[var(--portal-accent-soft)]">
                  {link.icon}
                </span>
                {link.label}
              </span>
              {link.trailing || <ExternalLink className="h-4 w-4 text-[var(--portal-text-muted)]" />}
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
    "group relative flex items-center gap-3 rounded-[22px] px-4 py-3.5 transition-all duration-200",
    active
      ? "border border-[var(--portal-border)] bg-[linear-gradient(135deg,rgba(239,244,255,0.98)_0%,rgba(231,238,250,0.96)_100%)] text-[var(--portal-text)] shadow-[0_18px_34px_rgba(23,35,56,0.08)]"
      : "text-[var(--portal-text-soft)] hover:bg-[rgba(255,255,255,0.76)] hover:text-[var(--portal-text)]",
  ].join(" ");
}

function navIconClass(active: boolean) {
  return [
    "flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-200",
    active
      ? "bg-[linear-gradient(135deg,#dfe9ff_0%,#c8d7ff_100%)] text-[var(--portal-accent-strong)] shadow-[0_12px_22px_rgba(47,88,227,0.14)]"
      : "bg-[var(--portal-surface-muted)] text-[var(--portal-text-muted)] group-hover:bg-white group-hover:text-[var(--portal-text)]",
  ].join(" ");
}
