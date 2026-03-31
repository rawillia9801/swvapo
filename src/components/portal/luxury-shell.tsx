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
  "w-full rounded-2xl border border-stone-200 bg-white px-4 py-3.5 text-[15px] text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-200/50 disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400";

export const portalSurfaceClass =
  "premium-card relative overflow-hidden rounded-[2rem] bg-white";

export const portalButtonPrimaryClass =
  "inline-flex items-center justify-center gap-2 rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-stone-800 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60";

export const portalButtonSecondaryClass =
  "inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-stone-50";

type Tone = "neutral" | "success" | "warning" | "danger";

function toneClass(tone: Tone) {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "danger":
      return "border-rose-200 bg-rose-50 text-rose-800";
    default:
      return "border-stone-200 bg-white text-stone-800";
  }
}

function accentGlow(accent?: string) {
  if (
    accent &&
    !/93,121,255|159,175,198|140,156,183|eef3ff|dbe6ff|234,240,255|225,234,255/i.test(
      accent
    )
  ) {
    return accent;
  }

  return "from-amber-100/80 via-transparent to-orange-100/70";
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
    <section className="hero-glow relative overflow-hidden rounded-[2rem] border border-stone-200 px-6 py-8 shadow-soft md:px-8 md:py-10 xl:px-10 xl:py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_28%)]" />
      <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_360px] xl:items-start xl:gap-10">
        <div className="max-w-4xl">
          <PortalEyebrow>{eyebrow}</PortalEyebrow>
          <h1 className="mt-6 font-serif text-4xl leading-[1.02] text-stone-900 md:text-5xl xl:text-6xl">
            {title}
          </h1>
          <p className="mt-5 max-w-3xl text-[15px] leading-7 text-stone-600 md:text-lg">
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
    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-900 shadow-sm">
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
    <div className="relative overflow-hidden rounded-[2rem] border border-stone-200 bg-white p-5 shadow-soft">
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentGlow(accent)}`} />
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">
        {label}
      </div>
      <div className="mt-3 text-[1.9rem] font-semibold leading-tight text-stone-900">
        {value}
      </div>
      <div className="mt-3 text-sm leading-6 text-stone-600">{detail}</div>
      {actionLabel ? (
        <div className="mt-5 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">
          <span>{actionLabel}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      ) : null}
    </div>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      className="block rounded-[2rem] transition hover:-translate-y-1"
    >
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
    <section className="premium-card overflow-hidden rounded-[2rem] bg-white p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">
            {title}
          </div>
          {subtitle ? (
            <p className="mt-2 text-sm leading-6 text-stone-600">{subtitle}</p>
          ) : null}
        </div>
        {action ? action : null}
        {!action && actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-stone-700 transition hover:bg-stone-50"
          >
            {actionLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
      <div className="mt-5">{children}</div>
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
    <div className={`rounded-[1.5rem] border p-4 shadow-sm ${toneClass(tone)}`}>
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-stone-900">{value}</div>
      {detail ? <div className="mt-2 text-sm leading-6 text-stone-600">{detail}</div> : null}
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
    <div className={`rounded-[1.5rem] border p-4 shadow-sm ${toneClass(tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">
            {label}
          </div>
          <div className="mt-2 text-sm font-semibold leading-6 text-stone-900">
            {title}
          </div>
          <div className="mt-1 text-sm leading-6 text-stone-600">{description}</div>
        </div>
        {rightLabel ? (
          <div className="shrink-0 text-[11px] font-bold uppercase tracking-[0.14em] text-stone-500">
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
    <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${toneClass(tone)}`}>
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
    <div className="hero-glow relative overflow-hidden rounded-[2rem] border border-stone-200 p-6 shadow-soft md:p-8">
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentGlow(accent)}`} />
      <div className="relative">
        <PortalEyebrow>{eyebrow}</PortalEyebrow>
        <div className="mt-5 max-w-4xl font-serif text-4xl leading-[1.04] text-stone-900 md:text-5xl">
          {title}
        </div>
        <div className="mt-4 max-w-3xl text-sm leading-7 text-stone-600 md:text-base">
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
      className="premium-card group block rounded-[1.75rem] p-5 transition hover:-translate-y-1"
    >
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400">
        {eyebrow}
      </div>
      <div className="mt-3 text-lg font-semibold text-stone-900">{title}</div>
      <div className="mt-2 text-sm leading-6 text-stone-600">{detail}</div>
      <div className="mt-5 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">
        Open
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
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
    <div className="rounded-[1.75rem] border border-dashed border-stone-300 bg-stone-50 px-5 py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 shadow-sm">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="mt-5 text-lg font-semibold text-stone-900">{title}</div>
      <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">{description}</div>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function PortalLoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-soft md:p-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-3 text-sm font-semibold text-stone-600">
          <LoaderCircle className="h-5 w-5 animate-spin text-amber-700" />
          <span>{label}</span>
        </div>
        <div className="mt-8 space-y-5">
          <div className="h-6 w-40 rounded-full bg-stone-200 animate-pulse" />
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_320px]">
            <div className="h-64 rounded-[2rem] bg-stone-100 animate-pulse" />
            <div className="grid gap-5">
              <div className="h-29 rounded-[1.75rem] bg-stone-100 animate-pulse" />
              <div className="h-29 rounded-[1.75rem] bg-stone-100 animate-pulse" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-40 rounded-[1.75rem] bg-stone-100 animate-pulse"
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
    <div className="rounded-[1.75rem] border border-rose-200 bg-rose-50 px-5 py-12 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-700 shadow-sm">
        <CircleAlert className="h-5 w-5" />
      </div>
      <div className="mt-5 text-lg font-semibold text-stone-900">{title}</div>
      <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">{description}</div>
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
    <label className="block text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500">
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
    <div className="overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-soft">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50">
            {headers.map((header) => (
              <th
                key={header}
                className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500"
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
    <div className="premium-card flex items-center gap-3 rounded-[1.5rem] p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
        <LayoutGrid className="h-4 w-4" />
      </div>
      <div className="text-sm text-stone-600">Shared portal component placeholder.</div>
    </div>
  );
}
