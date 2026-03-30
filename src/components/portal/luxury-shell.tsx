"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert, LayoutGrid, LoaderCircle } from "lucide-react";

export const portalInputClass =
  "w-full rounded-[20px] border border-[var(--portal-border)] bg-[var(--portal-surface-strong)] px-4 py-3.5 text-[15px] text-[var(--portal-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_24px_rgba(31,48,79,0.05)] outline-none transition placeholder:text-[var(--portal-text-muted)] focus:border-[var(--portal-accent)] focus:ring-4 focus:ring-[rgba(101,122,214,0.14)] disabled:cursor-not-allowed disabled:bg-[var(--portal-surface-muted)] disabled:text-[var(--portal-text-muted)]";

export const portalSurfaceClass =
  "relative overflow-hidden rounded-[28px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,var(--portal-surface)_0%,var(--portal-surface-strong)_100%)] shadow-[0_22px_52px_rgba(31,48,79,0.08)]";

export const portalButtonPrimaryClass =
  "inline-flex items-center justify-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(79,99,189,0.22)] transition duration-200 hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60";

export const portalButtonSecondaryClass =
  "inline-flex items-center justify-center gap-2 rounded-[18px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,var(--portal-surface-strong)_0%,var(--portal-surface-muted)_100%)] px-5 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[0_12px_28px_rgba(31,48,79,0.06)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--portal-border-strong)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60";

type Tone = "neutral" | "success" | "warning" | "danger";

function toneClass(tone: Tone) {
  switch (tone) {
    case "success":
      return "border-[rgba(106,162,134,0.26)] bg-[linear-gradient(180deg,#f8fcfb_0%,#f1f8f4_100%)] text-[#486957]";
    case "warning":
      return "border-[rgba(203,161,95,0.26)] bg-[linear-gradient(180deg,#fffcf6_0%,#fff6ea_100%)] text-[#8b6c3f]";
    case "danger":
      return "border-[rgba(193,110,125,0.22)] bg-[linear-gradient(180deg,#fff8f9_0%,#fff1f3_100%)] text-[#8f5360]";
    default:
      return "border-[var(--portal-border)] bg-[linear-gradient(180deg,var(--portal-surface-strong)_0%,var(--portal-surface-muted)_100%)] text-[var(--portal-text-soft)]";
  }
}

export function PortalPageHero({
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
    <section className={`${portalSurfaceClass} p-6 md:p-8 xl:p-10`}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(90deg,rgba(113,130,214,0.14)_0%,rgba(255,255,255,0)_55%,rgba(179,193,214,0.16)_100%)]" />
        <div className="absolute -left-16 top-10 h-48 w-48 rounded-full bg-[rgba(126,142,216,0.10)] blur-3xl" />
        <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-[rgba(193,205,222,0.18)] blur-3xl" />
      </div>

      <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px] xl:gap-10">
        <div className="max-w-4xl">
          <PortalEyebrow>{eyebrow}</PortalEyebrow>
          <h1 className="mt-5 max-w-3xl text-[2.55rem] font-semibold leading-[0.94] tracking-[-0.04em] text-[var(--portal-text)] md:text-[3.7rem]">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[var(--portal-text-soft)] md:text-base">
            {description}
          </p>
          {actions ? <div className="mt-7 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {aside ? <div className="min-w-0">{aside}</div> : null}
      </div>
    </section>
  );
}

export function PortalEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--portal-border)] bg-[rgba(255,255,255,0.82)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--portal-text-muted)] shadow-[0_10px_22px_rgba(31,48,79,0.05)]">
      {children}
    </span>
  );
}

export function PortalHeroPrimaryAction({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={portalButtonPrimaryClass}>
      {children}
    </Link>
  );
}

export function PortalHeroSecondaryAction({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={portalButtonSecondaryClass}>
      {children}
    </Link>
  );
}

export function PortalButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className, type = "button", ...rest } = props;
  return (
    <button
      type={type}
      className={`${portalButtonPrimaryClass} ${className || ""}`.trim()}
      {...rest}
    />
  );
}

export function PortalSecondaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>
) {
  const { className, type = "button", ...rest } = props;
  return (
    <button
      type={type}
      className={`${portalButtonSecondaryClass} ${className || ""}`.trim()}
      {...rest}
    />
  );
}

export function PortalMetricGrid({
  children,
}: {
  children: React.ReactNode;
}) {
  return <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-4">{children}</section>;
}

export function PortalMetricCard({
  label,
  value,
  detail,
  accent,
  href,
  actionLabel,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: string;
  href?: string;
  actionLabel?: string;
}) {
  const content = (
    <>
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-[4px] bg-gradient-to-r ${
          accent || "from-[#cfd8fb] via-[#8ea0e8] to-[#5b6dc2]"
        }`}
      />
      <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-[rgba(136,152,222,0.12)] blur-3xl" />
      <div className="relative p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--portal-text-muted)]">
          {label}
        </div>
        <div className="mt-3 break-words text-[28px] font-semibold leading-tight tracking-[-0.03em] text-[var(--portal-text)] md:text-[31px]">
          {value}
        </div>
        <div className="mt-3 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
        {actionLabel ? (
          <div className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-accent-strong)] transition group-hover:text-[var(--portal-accent)]">
            <span>{actionLabel}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        ) : null}
      </div>
    </>
  );

  const className = `group ${portalSurfaceClass} min-h-[188px] bg-[linear-gradient(180deg,var(--portal-surface)_0%,var(--portal-surface-strong)_100%)] ${
    href ? "transition hover:-translate-y-1 hover:border-[var(--portal-border-strong)]" : ""
  }`;

  if (!href) return <div className={className}>{content}</div>;

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

export function PortalPanel({
  title,
  subtitle,
  actionHref,
  actionLabel,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  actionHref?: string;
  actionLabel?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={`${portalSurfaceClass} p-5 md:p-6`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,rgba(125,144,219,0.18)_0%,rgba(255,255,255,0)_45%,rgba(181,194,214,0.18)_100%)]" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--portal-text-muted)]">
            {title}
          </div>
          {subtitle ? (
            <p className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{subtitle}</p>
          ) : null}
        </div>
        {action ? action : null}
        {!action && actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--portal-border)] bg-[rgba(255,255,255,0.9)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--portal-accent-strong)] transition hover:border-[var(--portal-border-strong)]"
          >
            {actionLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
      <div className="relative mt-5">{children}</div>
    </section>
  );
}

export function PortalInfoTile({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: Tone;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[22px] border p-4 shadow-[0_12px_28px_rgba(31,48,79,0.05)] ${toneClass(
        tone
      )}`}
    >
      <div className="pointer-events-none absolute right-[-12px] top-[-12px] h-20 w-20 rounded-full bg-white/55 blur-2xl" />
      <div className="relative">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
          {label}
        </div>
        <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--portal-text)]">
          {value}
        </div>
        {detail ? (
          <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
        ) : null}
      </div>
    </div>
  );
}

export function PortalListCard({
  label,
  title,
  description,
  rightLabel,
  tone = "neutral",
}: {
  label: string;
  title: string;
  description: string;
  rightLabel?: string;
  tone?: Tone;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[22px] border p-4 shadow-[0_10px_24px_rgba(31,48,79,0.05)] ${toneClass(
        tone
      )}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
            {label}
          </div>
          <div className="mt-2 text-sm font-semibold leading-6 text-[var(--portal-text)]">{title}</div>
          <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">{description}</div>
        </div>
        {rightLabel ? (
          <div className="shrink-0 text-[11px] font-medium text-[var(--portal-text-muted)]">
            {rightLabel}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PortalStatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${toneClass(
        tone
      )}`}
    >
      {label}
    </span>
  );
}

export function PortalNarrativeCard({
  eyebrow,
  title,
  description,
  children,
  accent,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className={`${portalSurfaceClass} p-5 md:p-6`}>
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-[4px] bg-gradient-to-r ${
          accent || "from-[#d5ddf5] via-[#98a8e6] to-[#697ccf]"
        }`}
      />
      <div className="relative">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--portal-text-muted)]">
          {eyebrow}
        </div>
        <div className="mt-3 max-w-3xl text-[2rem] font-semibold leading-[1.02] tracking-[-0.04em] text-[var(--portal-text)] md:text-[2.4rem]">
          {title}
        </div>
        <div className="mt-3 max-w-2xl text-sm leading-7 text-[var(--portal-text-soft)]">{description}</div>
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
    </div>
  );
}

export function PortalActionLink({
  href,
  eyebrow,
  title,
  detail,
}: {
  href: string;
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className={`${portalSurfaceClass} group block p-5 transition hover:-translate-y-1 hover:border-[var(--portal-border-strong)]`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--portal-text-muted)]">
        {eyebrow}
      </div>
      <div className="mt-3 text-lg font-semibold tracking-[-0.02em] text-[var(--portal-text)]">
        {title}
      </div>
      <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
      <div className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-accent-strong)] transition group-hover:text-[var(--portal-accent)]">
        Open
        <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </Link>
  );
}

export function PortalEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-[var(--portal-border-strong)] bg-[linear-gradient(180deg,var(--portal-surface-muted)_0%,#ffffff_100%)] px-5 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[var(--portal-border)] bg-[rgba(255,255,255,0.92)] text-[var(--portal-accent-strong)] shadow-[0_12px_28px_rgba(31,48,79,0.06)]">
        <LayoutGrid className="h-5 w-5" />
      </div>
      <div className="mt-4 text-base font-semibold text-[var(--portal-text)]">{title}</div>
      <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--portal-text-soft)]">{description}</div>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function PortalLoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className={`${portalSurfaceClass} p-8`}>
      <div className="mx-auto max-w-xl">
        <div className="flex items-center justify-center gap-3 text-sm font-semibold text-[var(--portal-text-soft)]">
          <LoaderCircle className="h-5 w-5 animate-spin text-[var(--portal-accent-strong)]" />
          <span>{label}</span>
        </div>
        <div className="mt-8 space-y-4">
          <div className="h-5 w-40 rounded-full bg-[#e8edf5] animate-pulse" />
          <div className="h-20 rounded-[24px] bg-[#eff3f8] animate-pulse" />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="h-28 rounded-[24px] bg-[#f2f6fb] animate-pulse" />
            <div className="h-28 rounded-[24px] bg-[#f2f6fb] animate-pulse" />
            <div className="h-28 rounded-[24px] bg-[#f2f6fb] animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PortalErrorState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-[rgba(193,110,125,0.22)] bg-[linear-gradient(180deg,#fff8f9_0%,#fff2f4_100%)] px-5 py-10 text-center shadow-[0_12px_28px_rgba(143,83,96,0.06)]">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(193,110,125,0.18)] bg-white text-[#9b5b68] shadow-[0_10px_24px_rgba(143,83,96,0.08)]">
        <CircleAlert className="h-5 w-5" />
      </div>
      <div className="mt-4 text-base font-semibold text-[var(--portal-text)]">{title}</div>
      <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--portal-text-soft)]">{description}</div>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function PortalField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
      {label}
      <div className="mt-2">{children}</div>
    </label>
  );
}

export function PortalInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${portalInputClass} ${props.className || ""}`.trim()} />;
}

export function PortalTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return (
    <textarea
      {...props}
      className={`${portalInputClass} min-h-[120px] resize-y ${props.className || ""}`.trim()}
    />
  );
}

export function PortalSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${portalInputClass} ${props.className || ""}`.trim()} />;
}

export function PortalTable({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-strong)] shadow-[0_16px_38px_rgba(31,48,79,0.06)]">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="border-b border-[var(--portal-border)] bg-[linear-gradient(180deg,#fbfdff_0%,#f3f7fb_100%)]">
            {headers.map((header) => (
              <th
                key={header}
                className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
