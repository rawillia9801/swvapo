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
    <div className="flex h-full flex-col gap-4">
      <div className="rounded-[30px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.84)_0%,rgba(246,249,253,0.96)_100%)] p-5 shadow-[0_22px_54px_rgba(31,48,79,0.08)]">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#90a2ea_0%,#6378d7_100%)] text-white shadow-[0_16px_34px_rgba(99,120,215,0.22)]">
            <PawPrint className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold tracking-[-0.02em] text-[var(--portal-text)]">
              {brandTitle}
            </div>
            <div className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
              {brandSubtitle}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-[var(--portal-border)] bg-[rgba(255,255,255,0.82)] px-4 py-4 shadow-[0_12px_28px_rgba(31,48,79,0.05)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
            Account
          </div>
          <div className="mt-2 text-lg font-semibold leading-tight tracking-[-0.03em] text-[var(--portal-text)]">
            {welcomeTitle}
          </div>
          <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
            {welcomeDescription}
          </div>
        </div>
      </div>

      <nav className="rounded-[30px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.86)_0%,rgba(244,248,252,0.96)_100%)] p-4 shadow-[0_20px_48px_rgba(31,48,79,0.07)]">
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

      <div className="rounded-[30px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.84)_0%,rgba(246,249,253,0.96)_100%)] p-4 shadow-[0_18px_42px_rgba(31,48,79,0.07)]">
        <div className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--portal-text-muted)]">
          Shortcuts
        </div>
        <div className="space-y-3">
          {utilityLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between rounded-[20px] border border-[var(--portal-border)] bg-[rgba(255,255,255,0.86)] px-4 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:-translate-y-0.5 hover:border-[var(--portal-border-strong)] hover:bg-white"
            >
              <span className="flex items-center gap-3">
                <span className="text-[var(--portal-accent-strong)]">{link.icon}</span>
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
    "group flex items-center gap-3 rounded-[20px] px-4 py-3 transition-all duration-200",
    active
      ? "border border-[var(--portal-border)] bg-[linear-gradient(135deg,#eef3ff_0%,#e6ecf7_100%)] text-[var(--portal-text)] shadow-[0_16px_30px_rgba(31,48,79,0.08)]"
      : "text-[var(--portal-text-soft)] hover:bg-[rgba(255,255,255,0.82)] hover:text-[var(--portal-text)]",
  ].join(" ");
}

function navIconClass(active: boolean) {
  return [
    "flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-200",
    active
      ? "bg-[linear-gradient(135deg,#dfe8ff_0%,#b8c7f7_100%)] text-[var(--portal-accent-strong)] shadow-[0_12px_20px_rgba(99,120,215,0.12)]"
      : "bg-[var(--portal-surface-muted)] text-[var(--portal-text-muted)] group-hover:bg-white group-hover:text-[var(--portal-text)]",
  ].join(" ");
}
