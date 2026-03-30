"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  FileCheck2,
  Files,
  LayoutDashboard,
  MessageSquareText,
  PawPrint,
  Users,
} from "lucide-react";
import { getPortalAdminEmails } from "@/lib/portal-admin";

type AdminNavItem = {
  href: string;
  label: string;
  helper: string;
  icon: React.ReactNode;
};

const ADMIN_NAV: AdminNavItem[] = [
  {
    href: "/admin/portal",
    label: "Overview",
    helper: "Command center",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    href: "/admin/portal/users",
    label: "Buyers",
    helper: "Buyer records and linked accounts",
    icon: <Users className="h-4 w-4" />,
  },
  {
    href: "/admin/portal/applications",
    label: "Applications",
    helper: "Review, assign, approve, deny",
    icon: <FileCheck2 className="h-4 w-4" />,
  },
  {
    href: "/admin/portal/payments",
    label: "Payments",
    helper: "Balances, finance, history",
    icon: <CreditCard className="h-4 w-4" />,
  },
  {
    href: "/admin/portal/documents",
    label: "Documents",
    helper: "Forms, uploads, portal files",
    icon: <Files className="h-4 w-4" />,
  },
  {
    href: "/admin/portal/messages",
    label: "Messages",
    helper: "Grouped buyer inbox",
    icon: <MessageSquareText className="h-4 w-4" />,
  },
  {
    href: "/admin/portal/assistant",
    label: "ChiChi Admin",
    helper: "Natural-language changes",
    icon: <PawPrint className="h-4 w-4" />,
  },
];

export function AdminPageShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#f7f2eb] text-[#2f2218]">
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(214,184,146,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(244,229,209,0.72),transparent_36%),linear-gradient(180deg,#fbf8f3_0%,#f6efe6_100%)]">
        <div className="mx-auto grid min-h-screen w-full max-w-[1840px] grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="border-b border-[#ead9c7] bg-[linear-gradient(180deg,#fffdfb_0%,#f7eee2_100%)] px-5 py-6 xl:min-h-screen xl:border-b-0 xl:border-r">
            <div className="rounded-[30px] border border-[#ead9c7] bg-white p-5 shadow-[0_24px_70px_rgba(106,76,45,0.10)]">
              <div className="inline-flex rounded-full border border-[#ead8c1] bg-[#fff9f2] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#a47946]">
                Owner Admin
              </div>
              <h1 className="mt-5 font-serif text-3xl font-bold leading-tight text-[#2f2218] [font-family:var(--font-merriweather)]">
                Southwest Virginia Chihuahua
              </h1>
              <p className="mt-3 text-sm leading-7 text-[#72553c]">
                A cleaner owner workspace for buyers, payments, documents, messages, and approvals.
              </p>
            </div>

            <nav className="mt-5 space-y-2">
              {ADMIN_NAV.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/admin/portal" && pathname?.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "group flex items-start gap-3 rounded-[22px] border px-4 py-4 transition",
                      active
                        ? "border-[#d8b48b] bg-white shadow-[0_14px_40px_rgba(106,76,45,0.10)]"
                        : "border-[#ead9c7] bg-white/70 hover:border-[#d8b48b] hover:bg-white",
                    ].join(" ")}
                  >
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#ead9c7] bg-[#fff9f2] text-[#a47946]">
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#2f2218]">{item.label}</div>
                      <div className="mt-1 text-xs leading-5 text-[#8a6a49]">{item.helper}</div>
                    </div>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-5 rounded-[26px] border border-[#ead9c7] bg-white/85 p-5 shadow-[0_18px_50px_rgba(106,76,45,0.08)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a47946]">
                Approved Owner Emails
              </div>
              <div className="mt-3 space-y-2 text-sm font-semibold text-[#2f2218]">
                {getPortalAdminEmails().map((email) => (
                  <div
                    key={email}
                    className="rounded-2xl border border-[#ead9c7] bg-[#fff9f2] px-3 py-2"
                  >
                    {email}
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="min-w-0 px-4 py-5 md:px-8 md:py-8 xl:px-10 xl:py-9">
            {children}
          </section>
        </div>
      </main>
    </div>
  );
}

export function AdminPageHero({
  eyebrow,
  title,
  description,
  actions,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[36px] border border-[#ead9c7] bg-[radial-gradient(circle_at_top_left,#fff8f0_0%,#fffdfa_45%,#f5ede4_100%)] p-6 shadow-[0_34px_90px_rgba(106,76,45,0.10)] md:p-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <div className="max-w-4xl">
          <span className="inline-flex rounded-full border border-[#ead8c1] bg-white/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#9e7446]">
            {eyebrow}
          </span>
          <h1 className="mt-6 max-w-3xl font-serif text-4xl font-bold leading-tight text-[#2f2218] [font-family:var(--font-merriweather)] md:text-6xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#72553c] md:text-base">
            {description}
          </p>
          {actions ? <div className="mt-6 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {aside ? <div>{aside}</div> : null}
      </div>
    </section>
  );
}

export function AdminHeroPrimaryAction({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(181,117,47,0.26)] transition hover:-translate-y-0.5 hover:brightness-105"
    >
      {children}
    </Link>
  );
}

export function AdminHeroSecondaryAction({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-2xl border border-[#e4d2be] bg-white px-5 py-3 text-sm font-semibold text-[#5d4330] shadow-[0_12px_28px_rgba(106,76,45,0.08)] transition hover:-translate-y-0.5 hover:border-[#d4b48b]"
    >
      {children}
    </Link>
  );
}

export function AdminMetricGrid({
  children,
}: {
  children: React.ReactNode;
}) {
  return <section className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">{children}</section>;
}

export function AdminMetricCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: string;
}) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-[#ead8c6] bg-white shadow-[0_18px_48px_rgba(106,76,45,0.08)]">
      <div
        className={`h-1.5 w-full bg-gradient-to-r ${accent || "from-[#f2d9a8] via-[#d7a45d] to-[#b7712d]"}`}
      />
      <div className="p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#a47946]">
          {label}
        </div>
        <div className="mt-3 break-words text-[30px] font-semibold leading-tight text-[#2f2218]">
          {value}
        </div>
        <div className="mt-3 text-sm leading-6 text-[#73583f]">{detail}</div>
      </div>
    </div>
  );
}

export function AdminPanel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[32px] border border-[#ead8c4] bg-white p-5 shadow-[0_24px_70px_rgba(106,76,45,0.09)] md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#a47946]">
            {title}
          </div>
          {subtitle ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#73583f]">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function AdminInfoTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#ead9c7] bg-white p-4 shadow-[0_12px_32px_rgba(106,76,45,0.06)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a47946]">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-[#2f2218]">{value}</div>
      {detail ? <div className="mt-2 text-sm leading-6 text-[#73583f]">{detail}</div> : null}
    </div>
  );
}

export function AdminListCard({
  title,
  subtitle,
  meta,
  badge,
  selected = false,
  onClick,
}: {
  title: string;
  subtitle: string;
  meta?: string;
  badge?: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <div
      className={[
        "rounded-[24px] border px-4 py-4 text-left transition",
        selected
          ? "border-[#d8b48b] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2e9_100%)] shadow-[0_12px_30px_rgba(106,76,45,0.08)]"
          : "border-[#ead9c7] bg-[#fffaf5] hover:border-[#d8b48b] hover:bg-white",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#2f2218]">{title}</div>
          <div className="mt-1 text-xs leading-5 text-[#8a6a49]">{subtitle}</div>
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      {meta ? <div className="mt-3 text-xs font-semibold text-[#9c7a57]">{meta}</div> : null}
    </div>
  );

  if (!onClick) return content;

  return (
    <button type="button" onClick={onClick} className="block w-full">
      {content}
    </button>
  );
}

export function AdminEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-[#e7d6c2] bg-[#fffaf5] px-5 py-10 text-center">
      <div className="text-base font-semibold text-[#2f2218]">{title}</div>
      <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#73583f]">{description}</div>
    </div>
  );
}

export function AdminRestrictedState({
  title,
  details,
}: {
  title: string;
  details: string;
}) {
  return (
    <div className="min-h-screen bg-[#f7f2eb] text-[#2f2218]">
      <div className="mx-auto flex min-h-screen w-full max-w-[960px] items-center justify-center px-6 py-10">
        <div className="w-full rounded-[34px] border border-[#ead9c7] bg-white p-8 shadow-[0_30px_120px_rgba(106,76,45,0.12)] md:p-10">
          <h1 className="font-serif text-4xl font-bold tracking-tight text-[#2f2218] [font-family:var(--font-merriweather)]">
            {title}
          </h1>
          <p className="mt-4 text-sm leading-7 text-[#72553c] md:text-base">{details}</p>
          <div className="mt-6">
            <Link
              href="/portal"
              className="inline-flex items-center rounded-2xl border border-[#e4d2be] bg-white px-5 py-3 text-sm font-semibold text-[#5d4330] shadow-[0_12px_28px_rgba(106,76,45,0.08)] transition hover:border-[#d4b48b]"
            >
              Return to Buyer Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function adminStatusBadge(statusRaw: string | null | undefined) {
  const status = String(statusRaw || "pending").trim().toLowerCase();

  if (["approved", "active", "matched", "submitted", "complete", "completed", "paid", "read"].some((item) => status.includes(item))) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (["deny", "declined", "rejected", "cancel", "failed"].some((item) => status.includes(item))) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}
