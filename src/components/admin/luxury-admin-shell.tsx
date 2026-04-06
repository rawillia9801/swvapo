"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  CreditCard,
  Dog,
  FileCheck2,
  Files,
  LayoutDashboard,
  Layers3,
  MapPinned,
  MessageSquareText,
  PawPrint,
  Settings2,
  Sparkles,
  Users,
} from "lucide-react";
import { getPortalAdminEmails } from "@/lib/portal-admin";

type AdminNavItem = {
  href: string;
  label: string;
  helper: string;
  icon: React.ReactNode;
};

type AdminNavSection = {
  label: string;
  items: AdminNavItem[];
};

const ADMIN_NAV: AdminNavSection[] = [
  {
    label: "Operations",
    items: [
      {
        href: "/admin/portal",
        label: "Overview",
        helper: "Queues, revenue, activity",
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
      {
        href: "/admin/portal/users",
        label: "Buyers",
        helper: "Accounts, assignments, balances",
        icon: <Users className="h-4 w-4" />,
      },
      {
        href: "/admin/portal/applications",
        label: "Applications",
        helper: "Queue, review, conversion",
        icon: <FileCheck2 className="h-4 w-4" />,
      },
      {
        href: "/admin/portal/messages",
        label: "Messages",
        helper: "Buyer inbox and follow-up",
        icon: <MessageSquareText className="h-4 w-4" />,
      },
      {
        href: "/admin/portal/documents",
        label: "Documents",
        helper: "Forms and signed files",
        icon: <Files className="h-4 w-4" />,
      },
      {
        href: "/admin/portal/settings",
        label: "Settings",
        helper: "System rules and config",
        icon: <Settings2 className="h-4 w-4" />,
      },
    ],
  },
  {
    label: "Breeding",
    items: [
      {
        href: "/admin/portal/puppies",
        label: "Puppies",
        helper: "Listings, lineage, assignments",
        icon: <PawPrint className="h-4 w-4" />,
      },
      {
        href: "/admin/portal/litters",
        label: "Litters",
        helper: "Lineage, counts, revenue",
        icon: <Layers3 className="h-4 w-4" />,
      },
      {
        href: "/admin/portal/dams-sires",
        label: "Breeding Program",
        helper: "Dams, sires, lifetime output",
        icon: <Dog className="h-4 w-4" />,
      },
      {
        href: "/admin/portal/puppy-financing",
        label: "Puppy Financing",
        helper: "Per-puppy pricing and plans",
        icon: <CreditCard className="h-4 w-4" />,
      },
      {
        href: "/admin/portal/payments",
        label: "Payments",
        helper: "Buyer revenue and balances",
        icon: <CreditCard className="h-4 w-4" />,
      },
      {
        href: "/admin/portal/transportation",
        label: "Transportation",
        helper: "Pickup, meet-up, delivery",
        icon: <MapPinned className="h-4 w-4" />,
      },
    ],
  },
  {
    label: "Assistant",
    items: [
      {
        href: "/admin/portal/assistant",
        label: "ChiChi Admin",
        helper: "Natural-language updates",
        icon: <Sparkles className="h-4 w-4" />,
      },
    ],
  },
];

export function AdminPageShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  let currentItem:
    | (AdminNavItem & {
        section: string;
      })
    | {
        href: string;
        label: string;
        helper: string;
        icon: React.ReactNode;
        section: string;
      } = {
    href: pathname || "/admin/portal",
    label: "Admin Workspace",
    helper: "Internal breeder operations",
    icon: <LayoutDashboard className="h-4 w-4" />,
    section: "Operations",
  };

  for (const section of ADMIN_NAV) {
    for (const item of section.items) {
      const active =
        pathname === item.href ||
        (item.href !== "/admin/portal" && pathname?.startsWith(item.href));
      if (active) {
        currentItem = {
          ...item,
          section: section.label,
        };
        break;
      }
    }
  }

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="min-h-screen bg-[#f6f0e8] text-[#2d2117]">
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(214,184,146,0.14),transparent_22%),radial-gradient(circle_at_top_right,rgba(247,239,229,0.88),transparent_30%),linear-gradient(180deg,#fbf8f3_0%,#f2eadf_100%)]">
        <div className="mx-auto grid min-h-screen w-full max-w-[1880px] grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="border-b border-[#e5d4c2] bg-[linear-gradient(180deg,#fffdfb_0%,#f4ecdf_100%)] px-5 py-5 xl:sticky xl:top-0 xl:h-screen xl:overflow-y-auto xl:border-b-0 xl:border-r">
            <div className="rounded-[28px] border border-[#e7d7c6] bg-white/92 p-5 shadow-[0_22px_58px_rgba(106,76,45,0.09)] backdrop-blur-sm">
              <div className="inline-flex rounded-full border border-[#ead8c1] bg-[#fff8ef] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9e7446]">
                Breeder Ops
              </div>
              <h1 className="mt-4 font-serif text-[26px] font-bold leading-tight text-[#2f2218] [font-family:var(--font-merriweather)]">
                Southwest Virginia Chihuahua
              </h1>
              <p className="mt-3 text-sm leading-6 text-[#72553c]">
                Internal breeder operations for lineage, applications, puppy sales, payments, and post-match follow-up.
              </p>
            </div>

            <div className="mt-5 space-y-5">
              {ADMIN_NAV.map((section) => (
                <div key={section.label}>
                  <div className="px-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#9c7043]">
                    {section.label}
                  </div>
                  <nav className="mt-2 space-y-2">
                    {section.items.map((item) => {
                      const active =
                        pathname === item.href ||
                        (item.href !== "/admin/portal" && pathname?.startsWith(item.href));

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={[
                            "group flex items-start gap-3 rounded-[20px] border px-4 py-3.5 transition",
                            active
                              ? "border-[#cfab84] bg-white shadow-[0_12px_30px_rgba(106,76,45,0.08)]"
                              : "border-[#ead9c7] bg-white/72 hover:border-[#d8b48b] hover:bg-white",
                          ].join(" ")}
                        >
                          <div
                            className={[
                              "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border text-[#9a7143]",
                              active
                                ? "border-[#e2cfba] bg-[#fff8ef]"
                                : "border-[#ead9c7] bg-[#fbf5ed]",
                            ].join(" ")}
                          >
                            {item.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-[#2f2218]">{item.label}</div>
                            <div className="mt-1 text-xs leading-5 text-[#8a6a49]">{item.helper}</div>
                          </div>
                          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#c2a27f] opacity-0 transition group-hover:opacity-100" />
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[24px] border border-[#ead9c7] bg-white/88 p-5 shadow-[0_16px_40px_rgba(106,76,45,0.07)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a47946]">
                Approved Owner Emails
              </div>
              <div className="mt-3 space-y-2 text-sm font-semibold text-[#2f2218]">
                {getPortalAdminEmails().map((email) => (
                  <div
                    key={email}
                    className="rounded-[18px] border border-[#ead9c7] bg-[#fff9f2] px-3 py-2"
                  >
                    {email}
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="min-w-0 px-4 py-5 md:px-6 md:py-6 xl:px-7 xl:py-7">
            <div className="mb-4 rounded-[24px] border border-[#ead8c4] bg-white/84 px-5 py-4 shadow-[0_12px_34px_rgba(106,76,45,0.06)] backdrop-blur-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9c7043]">
                    <span>{currentItem.section}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <span>{currentItem.label}</span>
                  </div>
                  <div className="mt-2 text-xl font-semibold text-[#2f2218]">{currentItem.label}</div>
                  <div className="mt-1 text-sm text-[#73583f]">{currentItem.helper}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-full border border-[#ead9c7] bg-[#fffaf4] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8e6640]">
                    Owner Workspace
                  </div>
                  <div className="inline-flex rounded-full border border-[#ead9c7] bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8e6640]">
                    {dateLabel}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">{children}</div>
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
    <section className="overflow-hidden rounded-[28px] border border-[#ead9c7] bg-[radial-gradient(circle_at_top_left,#fff8f0_0%,#fffdfa_42%,#f3ebdf_100%)] p-5 shadow-[0_18px_44px_rgba(106,76,45,0.08)] md:p-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_320px]">
        <div className="max-w-4xl">
          <span className="inline-flex rounded-full border border-[#ead8c1] bg-white/92 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#9e7446]">
            {eyebrow}
          </span>
          <h1 className="mt-4 max-w-3xl font-serif text-3xl font-bold leading-tight text-[#2f2218] [font-family:var(--font-merriweather)] md:text-[42px]">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#72553c]">{description}</p>
          {actions ? <div className="mt-5 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {aside ? <div className="space-y-4">{aside}</div> : null}
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
      className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(159,99,49,0.22)] transition hover:-translate-y-0.5 hover:brightness-105"
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
    <div className="overflow-hidden rounded-[22px] border border-[#ead8c6] bg-white shadow-[0_14px_34px_rgba(106,76,45,0.06)]">
      <div className={`h-1.5 w-full bg-gradient-to-r ${accent || "from-[#f2d9a8] via-[#d7a45d] to-[#b7712d]"}`} />
      <div className="p-4 md:p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#a47946]">
          {label}
        </div>
        <div className="mt-2.5 break-words text-[28px] font-semibold leading-tight text-[#2f2218]">
          {value}
        </div>
        <div className="mt-2.5 text-sm leading-6 text-[#73583f]">{detail}</div>
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
    <section className="overflow-hidden rounded-[24px] border border-[#ead8c4] bg-white p-5 shadow-[0_18px_48px_rgba(106,76,45,0.06)] md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#a47946]">
            {title}
          </div>
          {subtitle ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[#73583f]">{subtitle}</p> : null}
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
    <div className="rounded-[18px] border border-[#ead9c7] bg-white p-4 shadow-[0_8px_20px_rgba(106,76,45,0.04)]">
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
        "rounded-[22px] border px-4 py-4 text-left transition",
        selected
          ? "border-[#d0ac84] bg-[linear-gradient(180deg,#fffdf9_0%,#f7eddf_100%)] shadow-[0_12px_30px_rgba(106,76,45,0.08)]"
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

  if (
    ["approved", "active", "matched", "submitted", "complete", "completed", "paid", "read", "available"].some(
      (item) => status.includes(item)
    )
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (["deny", "declined", "rejected", "cancel", "failed"].some((item) => status.includes(item))) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (["reserved", "hold"].some((item) => status.includes(item))) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-stone-200 bg-stone-50 text-stone-700";
}
