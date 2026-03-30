"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export const portalInputClass =
  "w-full rounded-[22px] border border-[#e4d3c0] bg-[linear-gradient(180deg,#fffdf9_0%,#fff7ef_100%)] px-4 py-3.5 text-[15px] text-[#34261b] shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_24px_rgba(116,82,48,0.05)] outline-none transition placeholder:text-[#ab8a68] focus:border-[#cca16e] focus:ring-4 focus:ring-[#f2e3cf] disabled:cursor-not-allowed disabled:bg-[#f8f1e7] disabled:text-[#a18870]";

export const portalSurfaceClass =
  "relative overflow-hidden rounded-[32px] border border-[#ead9c6] bg-[linear-gradient(180deg,rgba(255,253,249,0.96)_0%,rgba(249,242,232,0.98)_100%)] shadow-[0_24px_70px_rgba(105,76,45,0.09)]";

export const portalButtonPrimaryClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#d7a764_0%,#bb7c35_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(183,122,49,0.24)] transition duration-200 hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60";

export const portalButtonSecondaryClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl border border-[#e3d4c3] bg-[linear-gradient(180deg,#ffffff_0%,#fdf8f1_100%)] px-5 py-3 text-sm font-semibold text-[#5b4331] shadow-[0_12px_28px_rgba(96,67,38,0.08)] transition duration-200 hover:-translate-y-0.5 hover:border-[#d7b58e] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60";

type Tone = "neutral" | "success" | "warning" | "danger";

function toneClass(tone: Tone) {
  switch (tone) {
    case "success":
      return "border-[#d7e7d2] bg-[linear-gradient(180deg,#f8fcf6_0%,#f1f8ec_100%)] text-[#4d6844]";
    case "danger":
      return "border-[#efd1ca] bg-[linear-gradient(180deg,#fff9f7_0%,#fff2ef_100%)] text-[#8a4c43]";
    case "warning":
      return "border-[#ecdcbf] bg-[linear-gradient(180deg,#fffaf3_0%,#fff4e5_100%)] text-[#8b6739]";
    default:
      return "border-[#eadccf] bg-[linear-gradient(180deg,#fffdf9_0%,#fff8f0_100%)] text-[#72563f]";
  }
}

function shellGlow(accent?: string) {
  return accent || "from-[#f4e0bd]/80 via-[#fffaf5]/0 to-[#dfb786]/65";
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
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-[#f2ddba]/60 blur-3xl" />
        <div className="absolute right-[-40px] top-10 h-56 w-56 rounded-full bg-[#e7c79f]/35 blur-3xl" />
        <div className="absolute bottom-[-80px] left-[18%] h-56 w-56 rounded-full bg-[#f9efe3]/70 blur-3xl" />
      </div>

      <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_360px] xl:gap-10">
        <div className="max-w-4xl">
          <PortalEyebrow>{eyebrow}</PortalEyebrow>
          <h1 className="mt-5 max-w-3xl font-serif text-[2.45rem] font-bold leading-[0.96] text-[#2f2117] [font-family:var(--font-merriweather)] md:text-[3.6rem]">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#72553c] md:text-base">
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
    <span className="inline-flex items-center gap-2 rounded-full border border-[#e7d8c9] bg-white/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#a17848] shadow-[0_10px_24px_rgba(101,74,45,0.06)]">
      <Sparkles className="h-3.5 w-3.5" />
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
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-[5px] bg-gradient-to-r ${accent || "from-[#f0d7ad] via-[#d5a05c] to-[#b26d2d]"}`} />
      <div className="pointer-events-none absolute -right-10 top-8 h-28 w-28 rounded-full bg-[#fff6eb]/80 blur-2xl" />
      <div className="relative p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a17848]">
          {label}
        </div>
        <div className="mt-3 break-words text-[29px] font-semibold leading-tight text-[#2f2218] md:text-[31px]">
          {value}
        </div>
        <div className="mt-3 text-sm leading-6 text-[#72553c]">{detail}</div>
        {actionLabel ? (
          <div className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b67831] transition group-hover:text-[#945821]">
            <span>{actionLabel}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        ) : null}
      </div>
    </>
  );

  const className = `group ${portalSurfaceClass} min-h-[198px] bg-[linear-gradient(180deg,#fffdfb_0%,#fff7ef_100%)] ${
    href ? "transition hover:-translate-y-1 hover:border-[#d7b58e]" : ""
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
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${shellGlow()}`} />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a17848]">
            {title}
          </div>
          {subtitle ? <p className="mt-2 text-sm leading-6 text-[#72553c]">{subtitle}</p> : null}
        </div>
        {action ? action : null}
        {!action && actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="inline-flex items-center gap-2 rounded-full border border-[#e7d8c8] bg-[#fff9f2] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b67831] transition hover:border-[#d7b58e]"
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
      className={`relative overflow-hidden rounded-[24px] border p-4 shadow-[0_12px_32px_rgba(96,67,38,0.05)] ${toneClass(
        tone
      )}`}
    >
      <div className="pointer-events-none absolute right-[-18px] top-[-18px] h-20 w-20 rounded-full bg-white/35 blur-2xl" />
      <div className="relative">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em]">{label}</div>
        <div className="mt-2 text-2xl font-semibold text-[#2f2218]">{value}</div>
        {detail ? <div className="mt-2 text-sm leading-6 text-[#72553c]">{detail}</div> : null}
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
      className={`relative overflow-hidden rounded-[24px] border p-4 shadow-[0_10px_24px_rgba(96,67,38,0.05)] ${toneClass(
        tone
      )}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em]">{label}</div>
          <div className="mt-2 text-sm font-semibold leading-6 text-[#2f2218]">{title}</div>
          <div className="mt-1 text-sm leading-6 text-[#72553c]">{description}</div>
        </div>
        {rightLabel ? (
          <div className="shrink-0 text-[11px] font-medium text-[#8a6a49]">{rightLabel}</div>
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
      className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${toneClass(
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
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-[4px] bg-gradient-to-r ${accent || "from-[#d7a764] via-[#c48c47] to-[#8f6a45]"}`} />
      <div className="relative">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a17848]">
          {eyebrow}
        </div>
        <div className="mt-3 font-serif text-[2rem] leading-[1.04] text-[#2f2218] [font-family:var(--font-merriweather)]">
          {title}
        </div>
        <div className="mt-3 max-w-2xl text-sm leading-7 text-[#72553c]">{description}</div>
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
      className={`${portalSurfaceClass} group block p-5 transition hover:-translate-y-1 hover:border-[#d7b58e]`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a17848]">
        {eyebrow}
      </div>
      <div className="mt-3 text-lg font-semibold text-[#2f2218]">{title}</div>
      <div className="mt-2 text-sm leading-6 text-[#72553c]">{detail}</div>
      <div className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b67831] transition group-hover:text-[#945821]">
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
    <div className="rounded-[28px] border border-dashed border-[#e3d0bc] bg-[linear-gradient(180deg,#fffaf4_0%,#fff6ed_100%)] px-5 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f7ead9] text-[#b07a3d] shadow-[0_10px_24px_rgba(101,74,45,0.06)]">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="mt-4 text-base font-semibold text-[#2f2218]">{title}</div>
      <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#72553c]">{description}</div>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function PortalLoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className={`${portalSurfaceClass} p-8`}>
      <div className="mx-auto max-w-xl">
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[#7e6145]">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#cf8a43]" />
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#d9a15f] [animation-delay:120ms]" />
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#e3c08a] [animation-delay:240ms]" />
        </div>
        <div className="mt-4 text-center text-sm font-semibold text-[#7e6145]">{label}</div>
        <div className="mt-8 space-y-4">
          <div className="h-5 w-40 rounded-full bg-[#f3e4d2] animate-pulse" />
          <div className="h-16 rounded-[24px] bg-[#f7ecde] animate-pulse" />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="h-28 rounded-[24px] bg-[#f8efe4] animate-pulse" />
            <div className="h-28 rounded-[24px] bg-[#f8efe4] animate-pulse" />
            <div className="h-28 rounded-[24px] bg-[#f8efe4] animate-pulse" />
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
    <div className="rounded-[28px] border border-[#efd2cc] bg-[linear-gradient(180deg,#fff8f7_0%,#fff2ef_100%)] px-5 py-10 text-center shadow-[0_12px_30px_rgba(130,72,58,0.05)]">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#b05b50] shadow-[0_10px_24px_rgba(130,72,58,0.08)]">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="mt-4 text-base font-semibold text-[#6f352d]">{title}</div>
      <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#8c574f]">{description}</div>
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
    <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a17848]">
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
    <div className="overflow-hidden rounded-[26px] border border-[#eadccf] bg-white shadow-[0_16px_40px_rgba(96,67,38,0.06)]">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="border-b border-[#f0e3d5] bg-[linear-gradient(180deg,#fffaf5_0%,#fbf1e4_100%)]">
            {headers.map((header) => (
              <th
                key={header}
                className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9f7645]"
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
