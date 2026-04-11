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
import {
  portalButtonPrimaryClass,
  portalButtonSecondaryClass,
} from "@/components/portal/luxury-shell";

type AdminNavItem = {
  href: string;
  label: string;
  helper: string;
  aliases?: string[];
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
        label: "Current Puppies",
        helper: "Available puppies, care logs, publishing",
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
      {
        href: "/admin/portal/buyers",
        label: "Buyers",
        helper: "Families, placements, balances",
        aliases: ["/admin/buyers"],
        icon: <Users className="h-4 w-4" />,
      },
      {
        href: "/admin/users",
        label: "Users",
        helper: "Portal signups, access, activity",
        aliases: ["/admin/portal/users"],
        icon: <Users className="h-4 w-4" />,
      },
      {
        href: "/admin/portal/applications",
        label: "Applications",
        helper: "Intake, review, approvals",
        icon: <FileCheck2 className="h-4 w-4" />,
      },
      {
        href: "/admin/portal/messages",
        label: "Messages",
        helper: "Inbox, replies, follow-up",
        icon: <MessageSquareText className="h-4 w-4" />,
      },
      {
        href: "/admin/portal/documents",
        label: "Documents",
        helper: "Forms, uploads, contracts",
        icon: <Files className="h-4 w-4" />,
      },
      {
        href: "/admin/portal/settings",
        label: "Settings",
        helper: "Rules, ownership, safeguards",
        icon: <Settings2 className="h-4 w-4" />,
      },
    ],
  },
  {
    label: "Breeding Hub",
    items: [
      {
        href: "/admin/portal/puppies",
        label: "Puppies",
        helper: "Profiles, placement, care",
        icon: <PawPrint className="h-4 w-4" />,
      },
      {
        href: "/admin/portal/litters",
        label: "Litters",
        helper: "Pairings, whelping, outcomes",
        icon: <Layers3 className="h-4 w-4" />,
      },
      {
        href: "/admin/portal/dams-sires",
        label: "Breeding Program",
        helper: "Dams, sires, output history",
        icon: <Dog className="h-4 w-4" />,
      },
      {
        href: "/admin/portal/puppy-financing",
        label: "Puppy Financing",
        helper: "Per-puppy plans and balances",
        icon: <CreditCard className="h-4 w-4" />,
      },
      {
        href: "/admin/portal/payments",
        label: "Payments",
        helper: "Buyer ledgers and cash flow",
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
        helper: "Owner-side command console",
        icon: <Sparkles className="h-4 w-4" />,
      },
    ],
  },
];

const adminPrimaryButtonClass = `${portalButtonPrimaryClass} shadow-[var(--portal-shadow-md)]`;
const adminSecondaryButtonClass = `${portalButtonSecondaryClass} shadow-[var(--portal-shadow-sm)]`;

function navItemClass(active: boolean) {
  return [
    "group flex w-full items-center justify-between gap-3 rounded-[1.15rem] border px-3.5 py-3 transition-all duration-200",
    active
      ? "border-transparent bg-[linear-gradient(90deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] text-white shadow-[var(--portal-shadow-md)]"
      : "border-transparent bg-transparent text-[var(--portal-text-soft)] hover:border-[var(--portal-border)] hover:bg-white hover:text-[var(--portal-text)]",
  ].join(" ");
}

function matchesPath(pathname: string | null, href: string) {
  return pathname === href || (href !== "/admin/portal" && pathname?.startsWith(href));
}

function isNavItemActive(pathname: string | null, item: AdminNavItem) {
  return [item.href, ...(item.aliases || [])].some((candidate) => matchesPath(pathname, candidate));
}

const SUPPRESSED_ADMIN_PANEL_TITLES = new Set([
  "Buyer Workbench",
  "Command Navigation",
  "Document Bench",
  "Finance Bench",
  "Governance Bench",
  "Inbox Bench",
  "Kennel Priorities",
  "Litter Bench",
  "Logistics Bench",
  "Placement Bench",
  "Program Bench",
  "Puppy Ledger Bench",
  "Review Bench",
]);

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
    helper: "Owner-only breeding operations",
    icon: <LayoutDashboard className="h-4 w-4" />,
    section: "Operations",
  };

  for (const section of ADMIN_NAV) {
    for (const item of section.items) {
      const active = isNavItemActive(pathname, item);
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
    <div className="min-h-screen bg-[var(--portal-bg)] text-[var(--portal-text)]">
      <div className="grid min-h-screen lg:grid-cols-[312px_minmax(0,1fr)] xl:grid-cols-[328px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[var(--portal-border)] bg-white/70 px-4 py-4 backdrop-blur-sm lg:block">
          <div className="sticky top-4 flex h-[calc(100vh-2rem)] flex-col gap-4">
            <div className="flex items-center gap-3 rounded-[1.4rem] border border-[var(--portal-border)] bg-white/88 px-4 py-3 shadow-[var(--portal-shadow-sm)]">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.95rem] bg-[linear-gradient(90deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] text-white shadow-[var(--portal-shadow-md)]">
                <PawPrint className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-[var(--portal-text)] [font-family:var(--font-merriweather)]">
                  Southwest Virginia Chihuahua
                </div>
                <div className="mt-0.5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                  Owner workspace
                </div>
              </div>
            </div>

            <div className="premium-card min-h-0 flex-1 rounded-[1.75rem] p-4">
              <div className="h-full overflow-y-auto pr-1">
                <div className="space-y-5">
                  {ADMIN_NAV.map((section) => (
                    <div key={section.label}>
                      <div className="px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                        {section.label}
                      </div>
                      <nav className="mt-2 space-y-1.5">
                        {section.items.map((item) => {
                          const active = isNavItemActive(pathname, item);

                          return (
                            <Link key={item.href} href={item.href} className={navItemClass(active)}>
                              <span className="flex min-w-0 items-center gap-3">
                                <span
                                  className={[
                                    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] text-sm",
                                    active
                                      ? "bg-white/16 text-white"
                                      : "bg-[var(--portal-surface-muted)] text-[var(--portal-text-muted)] group-hover:bg-white group-hover:text-[var(--portal-accent)]",
                                  ].join(" ")}
                                >
                                  {item.icon}
                                </span>
                                <span className="block min-w-0 truncate text-sm font-semibold">
                                  {item.label}
                                </span>
                              </span>
                              <ChevronRight
                                className={[
                                  "h-4 w-4 shrink-0 transition",
                                  active
                                    ? "text-white/72"
                                    : "text-[var(--portal-text-muted)] opacity-0 group-hover:translate-x-0.5 group-hover:opacity-100",
                                ].join(" ")}
                              />
                            </Link>
                          );
                        })}
                      </nav>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <main className="min-h-screen px-4 py-5 md:px-6 md:py-6 xl:px-8 xl:py-8">
            <div className="mx-auto w-full max-w-[1480px]">
              <div className="mb-4 flex flex-col gap-3 border-b border-[var(--portal-border)] pb-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
                    <span>{currentItem.section}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <span>{currentItem.label}</span>
                  </div>
                  <div className="mt-2 text-[1.55rem] font-semibold tracking-[-0.04em] text-[var(--portal-text)] [font-family:var(--font-merriweather)]">
                    {currentItem.label}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-full border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-soft)]">
                    Owner Workspace
                  </div>
                  <div className="inline-flex rounded-full border border-[var(--portal-border)] bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-soft)]">
                    {dateLabel}
                  </div>
                </div>
              </div>

              <div className="space-y-4">{children}</div>
            </div>
          </main>
        </div>
      </div>
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
  void description;

  return (
    <section className="premium-card rounded-[1.4rem] p-4 md:p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-4xl">
            <span className="inline-flex items-center rounded-full border border-[rgba(200,168,132,0.45)] bg-[rgba(248,242,234,0.92)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8c6848] shadow-sm">
              {eyebrow}
            </span>
            <h1 className="mt-3 max-w-3xl text-[1.45rem] font-semibold leading-[1.08] tracking-[-0.04em] text-[var(--portal-text)] [font-family:var(--font-merriweather)] md:text-[1.85rem]">
              {title}
            </h1>
          </div>
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {aside ? <div className="w-full min-w-0">{aside}</div> : null}
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
    <Link href={href} className={adminPrimaryButtonClass}>
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
    <Link href={href} className={adminSecondaryButtonClass}>
      {children}
    </Link>
  );
}

export function AdminMetricGrid({
  children,
}: {
  children: React.ReactNode;
}) {
  return <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</section>;
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
    <div className="premium-card relative overflow-hidden rounded-[1.5rem] p-5">
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent || "from-[rgba(90,142,245,0.2)] via-transparent to-[rgba(240,67,162,0.16)]"}`}
      />
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-[var(--portal-text)]">{value}</div>
      <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
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
  if (SUPPRESSED_ADMIN_PANEL_TITLES.has(title)) {
    return null;
  }

  return (
    <section className="premium-card overflow-hidden rounded-[1.5rem] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
            {title}
          </div>
          {subtitle ? (
            <p className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{subtitle}</p>
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
    <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-4 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold leading-tight text-[var(--portal-text)]">
        {value}
      </div>
      {detail ? (
        <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
      ) : null}
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
        "rounded-[1.25rem] border px-4 py-4 text-left transition-all duration-200",
        selected
          ? "border-[var(--portal-border-strong)] bg-[linear-gradient(180deg,#ffffff_0%,#f7faff_100%)] shadow-[var(--portal-shadow-sm)]"
          : "border-[var(--portal-border)] bg-[var(--portal-surface-muted)] hover:border-[var(--portal-border-strong)] hover:bg-white",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--portal-text)]">{title}</div>
          <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">{subtitle}</div>
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      {meta ? (
        <div className="mt-3 text-xs font-semibold text-[var(--portal-text-muted)]">{meta}</div>
      ) : null}
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
    <div className="rounded-[1.5rem] border border-dashed border-[var(--portal-border-strong)] bg-[var(--portal-surface-muted)] px-5 py-12 text-center">
      <div className="text-lg font-semibold text-[var(--portal-text)]">{title}</div>
      <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--portal-text-soft)]">
        {description}
      </div>
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
    <div className="min-h-screen bg-[var(--portal-bg)] text-[var(--portal-text)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[980px] items-center justify-center px-6 py-10">
        <div className="premium-card w-full rounded-[2rem] p-8 md:p-10">
          <div className="inline-flex items-center rounded-full border border-[rgba(200,168,132,0.45)] bg-[rgba(248,242,234,0.92)] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8c6848]">
            Owner Access
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-[var(--portal-text)] [font-family:var(--font-merriweather)]">
            {title}
          </h1>
          <p className="mt-4 text-sm leading-7 text-[var(--portal-text-soft)] md:text-base">
            {details}
          </p>
          <div className="mt-6">
            <Link href="/portal" className={adminSecondaryButtonClass}>
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
    [
      "approved",
      "active",
      "matched",
      "submitted",
      "complete",
      "completed",
      "paid",
      "read",
      "available",
      "connected",
      "clear",
      "quiet",
    ].some((item) => status.includes(item))
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    ["deny", "declined", "rejected", "cancel", "failed", "void", "error"].some((item) =>
      status.includes(item)
    )
  ) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (
    [
      "reserved",
      "hold",
      "follow",
      "pending",
      "review",
      "open",
      "unread",
      "draft",
    ].some((item) => status.includes(item))
  ) {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  if (["warning", "due", "schedule"].some((item) => status.includes(item))) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-[var(--portal-border)] bg-[var(--portal-surface-muted)] text-[var(--portal-text-soft)]";
}
