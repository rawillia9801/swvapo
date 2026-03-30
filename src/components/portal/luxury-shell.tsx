"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  LayoutGrid,
  LoaderCircle,
  Sparkles,
} from "lucide-react";

export const portalInputClass =
  "w-full rounded-[22px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(246,250,255,0.92)_100%)] px-4 py-3.5 text-[15px] text-[var(--portal-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_24px_rgba(23,35,56,0.05)] outline-none transition placeholder:text-[var(--portal-text-muted)] focus:border-[var(--portal-accent)] focus:ring-4 focus:ring-[rgba(93,121,255,0.12)] disabled:cursor-not-allowed disabled:bg-[rgba(241,246,253,0.9)] disabled:text-[var(--portal-text-muted)]";

export const portalSurfaceClass =
  "relative overflow-hidden rounded-[30px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(247,250,255,0.92)_100%)] shadow-[0_26px_64px_rgba(23,35,56,0.08)] backdrop-blur-xl";

export const portalButtonPrimaryClass =
  "inline-flex items-center justify-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(47,88,227,0.26)] transition duration-200 hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60";

export const portalButtonSecondaryClass =
  "inline-flex items-center justify-center gap-2 rounded-[18px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(243,247,252,0.92)_100%)] px-5 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[0_12px_26px_rgba(23,35,56,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--portal-border-strong)]";

type Tone = "neutral" | "success" | "warning" | "danger";

function toneClass(tone: Tone) {
  switch (tone) {
    case "success":
      return "border-[rgba(47,143,103,0.16)] bg-[linear-gradient(180deg,rgba(244,253,249,0.98)_0%,rgba(240,249,245,0.94)_100%)] text-[#2f7657]";
    case "warning":
      return "border-[rgba(171,107,45,0.16)] bg-[linear-gradient(180deg,rgba(255,250,245,0.98)_0%,rgba(255,246,238,0.94)_100%)] text-[#9a6232]";
    case "danger":
      return "border-[rgba(194,84,114,0.16)] bg-[linear-gradient(180deg,rgba(255,249,251,0.98)_0%,rgba(255,242,246,0.94)_100%)] text-[#aa4f68]";
    default:
      return "border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(244,248,253,0.94)_100%)] text-[var(--portal-text-soft)]";
  }
}

function surfaceGlow(accent?: string) {
  return accent || "from-[rgba(93,121,255,0.14)] via-[rgba(255,255,255,0)] to-[rgba(159,175,198,0.16)]";
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
    <section className={`${portalSurfaceClass} portal-grid-bg p-6 md:p-8 xl:p-10`}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-px portal-hairline" />
        <div className="absolute -left-12 top-4 h-40 w-40 rounded-full bg-[rgba(93,121,255,0.12)] blur-3xl" />
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-[rgba(197,208,225,0.22)] blur-3xl" />
      </div>

      <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_360px] xl:gap-10">
        <div className="max-w-4xl">
          <PortalEyebrow>{eyebrow}</PortalEyebrow>
          <h1 className="mt-5 max-w-4xl text-[2.75rem] font-semibold leading-[0.94] tracking-[-0.055em] text-[var(--portal-text)] md:text-[4.2rem]">
            {title}
          </h1>
          <p className="mt-5 max-w-3xl text-[15px] leading-7 text-[var(--portal-text-soft)] md:text-base">
            {description}
          </p>
          {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {aside ? <div className="min-w-0">{aside}</div> : null}
      </div>
    </section>
  );
}

export function PortalEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--portal-border)] bg-[rgba(255,255,255,0.85)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--portal-text-muted)] shadow-[0_10px_22px_rgba(23,35,56,0.05)]">
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
  return <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</section>;
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
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${surfaceGlow(accent)}`} />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-20 rounded-full bg-[rgba(120,137,255,0.08)] blur-2xl" />
      <div className="relative p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
          {label}
        </div>
        <div className="mt-3 break-words text-[1.85rem] font-semibold leading-tight tracking-[-0.04em] text-[var(--portal-text)]">
          {value}
        </div>
        <div className="mt-3 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
        {actionLabel ? (
          <div className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-accent-strong)]">
            <span>{actionLabel}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        ) : null}
      </div>
    </>
  );

  const className = `${portalSurfaceClass} min-h-[172px] ${
    href ? "group transition hover:-translate-y-1 hover:border-[var(--portal-border-strong)]" : ""
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
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px portal-hairline" />
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
            className="inline-flex items-center gap-2 rounded-full border border-[var(--portal-border)] bg-[rgba(255,255,255,0.88)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--portal-accent-strong)] transition hover:border-[var(--portal-border-strong)]"
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
    <div className={`relative overflow-hidden rounded-[24px] border p-4 shadow-[0_12px_28px_rgba(23,35,56,0.05)] ${toneClass(tone)}`}>
      <div className="pointer-events-none absolute right-[-12px] top-[-12px] h-20 w-20 rounded-full bg-white/60 blur-2xl" />
      <div className="relative">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
          {label}
        </div>
        <div className="mt-2 text-[1.65rem] font-semibold tracking-[-0.04em] text-[var(--portal-text)]">
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
    <div className={`relative overflow-hidden rounded-[24px] border p-4 shadow-[0_10px_24px_rgba(23,35,56,0.05)] ${toneClass(tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
            {label}
          </div>
          <div className="mt-2 text-sm font-semibold leading-6 text-[var(--portal-text)]">
            {title}
          </div>
          <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">
            {description}
          </div>
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
    <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${toneClass(tone)}`}>
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
    <div className={`${portalSurfaceClass} p-6 md:p-8`}>
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${surfaceGlow(accent)}`} />
      <div className="pointer-events-none absolute -left-10 top-4 h-44 w-44 rounded-full bg-[rgba(93,121,255,0.1)] blur-3xl" />
      <div className="relative">
        <PortalEyebrow>{eyebrow}</PortalEyebrow>
        <div className="mt-5 max-w-4xl text-[2.2rem] font-semibold leading-[0.96] tracking-[-0.05em] text-[var(--portal-text)] md:text-[3rem]">
          {title}
        </div>
        <div className="mt-4 max-w-3xl text-sm leading-7 text-[var(--portal-text-soft)]">
          {description}
        </div>
        {children ? <div className="mt-6">{children}</div> : null}
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
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px portal-hairline" />
      <div className="relative">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--portal-text-muted)]">
          {eyebrow}
        </div>
        <div className="mt-3 text-lg font-semibold tracking-[-0.03em] text-[var(--portal-text)]">
          {title}
        </div>
        <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
        <div className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-accent-strong)]">
          Open
          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </div>
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
    <div className="relative overflow-hidden rounded-[28px] border border-dashed border-[var(--portal-border-strong)] bg-[linear-gradient(180deg,rgba(250,252,255,0.92)_0%,rgba(244,248,253,0.94)_100%)] px-5 py-12 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px portal-hairline" />
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[var(--portal-border)] bg-[rgba(255,255,255,0.92)] text-[var(--portal-accent-strong)] shadow-[0_14px_30px_rgba(23,35,56,0.06)]">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="mt-5 text-lg font-semibold tracking-[-0.02em] text-[var(--portal-text)]">{title}</div>
      <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--portal-text-soft)]">{description}</div>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function PortalLoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className={`${portalSurfaceClass} p-8 md:p-10`}>
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-3 text-sm font-semibold text-[var(--portal-text-soft)]">
          <LoaderCircle className="h-5 w-5 animate-spin text-[var(--portal-accent-strong)]" />
          <span>{label}</span>
        </div>
        <div className="mt-8 space-y-5">
          <div className="h-6 w-40 rounded-full bg-[rgba(215,226,239,0.88)] animate-pulse" />
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_320px]">
            <div className="h-64 rounded-[30px] bg-[rgba(239,245,252,0.9)] animate-pulse" />
            <div className="grid gap-5">
              <div className="h-29 rounded-[28px] bg-[rgba(242,247,253,0.92)] animate-pulse" />
              <div className="h-29 rounded-[28px] bg-[rgba(242,247,253,0.92)] animate-pulse" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-40 rounded-[28px] bg-[rgba(242,247,253,0.92)] animate-pulse"
              />
            ))}
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
    <div className="relative overflow-hidden rounded-[28px] border border-[rgba(194,84,114,0.16)] bg-[linear-gradient(180deg,rgba(255,251,252,0.98)_0%,rgba(248,251,255,0.94)_100%)] px-5 py-12 text-center shadow-[0_16px_34px_rgba(23,35,56,0.06)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[rgba(194,84,114,0.2)] via-transparent to-[rgba(93,121,255,0.14)]" />
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(194,84,114,0.18)] bg-white text-[var(--portal-danger)] shadow-[0_12px_28px_rgba(23,35,56,0.06)]">
        <CircleAlert className="h-5 w-5" />
      </div>
      <div className="mt-5 text-lg font-semibold tracking-[-0.02em] text-[var(--portal-text)]">{title}</div>
      <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--portal-text-soft)]">{description}</div>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
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
      className={`${portalInputClass} min-h-[132px] resize-y ${props.className || ""}`.trim()}
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
    <div className="overflow-hidden rounded-[28px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(247,250,255,0.96)_100%)] shadow-[0_18px_40px_rgba(23,35,56,0.06)]">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="border-b border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(249,252,255,0.98)_0%,rgba(241,246,253,0.96)_100%)]">
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

export function PortalShellPlaceholder() {
  return (
    <div className={`${portalSurfaceClass} flex items-center gap-3 p-4`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--portal-accent-soft)] text-[var(--portal-accent-strong)]">
        <LayoutGrid className="h-4 w-4" />
      </div>
      <div className="text-sm text-[var(--portal-text-soft)]">
        Shared portal component placeholder.
      </div>
    </div>
  );
}
