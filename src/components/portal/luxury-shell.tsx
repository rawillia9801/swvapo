"use client";

import React from "react";
import Link from "next/link";

export const portalInputClass =
  "w-full rounded-[20px] border border-[#e7d9ca] bg-[#fffdfb] px-4 py-3.5 text-[15px] text-[#34261b] shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] outline-none transition focus:border-[#cda876] focus:ring-4 focus:ring-[#f1e4d4] disabled:cursor-not-allowed disabled:bg-[#f8f1e9] disabled:text-[#9d7d5c]";

export const portalSurfaceClass =
  "rounded-[30px] border border-[#eadccf] bg-[linear-gradient(180deg,#fffdfb_0%,#fbf5ee_100%)] shadow-[0_20px_60px_rgba(92,65,37,0.08)]";

export const portalButtonPrimaryClass =
  "inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#d4a35d_0%,#b77a31_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(183,122,49,0.24)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60";

export const portalButtonSecondaryClass =
  "inline-flex items-center justify-center rounded-2xl border border-[#e2d3c2] bg-white px-5 py-3 text-sm font-semibold text-[#5b4331] shadow-[0_12px_28px_rgba(96,67,38,0.08)] transition hover:-translate-y-0.5 hover:border-[#d7b58e] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60";

type Tone = "neutral" | "success" | "warning" | "danger";

function toneClass(tone: Tone) {
  switch (tone) {
    case "success":
      return "border-[#d5e7d0] bg-[#f5fbf2] text-[#456640]";
    case "danger":
      return "border-[#efd2cc] bg-[#fff6f4] text-[#8f4b42]";
    case "warning":
      return "border-[#ecdcbf] bg-[#fff9f0] text-[#8c6738]";
    default:
      return "border-[#eadccf] bg-[#fffaf4] text-[#72563f]";
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
    <section
      className={`overflow-hidden ${portalSurfaceClass} bg-[radial-gradient(circle_at_top_left,rgba(241,221,196,0.55)_0%,rgba(255,255,255,0.96)_38%,rgba(249,241,232,0.94)_100%)] p-6 md:p-8 xl:p-10`}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px] xl:gap-10">
        <div className="max-w-4xl">
          <PortalEyebrow>{eyebrow}</PortalEyebrow>
          <h1 className="mt-5 max-w-3xl font-serif text-[2.35rem] font-bold leading-[0.98] text-[#2f2117] [font-family:var(--font-merriweather)] md:text-[3.3rem]">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#72553c] md:text-base">
            {description}
          </p>
          {actions ? <div className="mt-6 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {aside ? <div className="min-w-0">{aside}</div> : null}
      </div>
    </section>
  );
}

export function PortalEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#e7d8c9] bg-white/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#a17848] shadow-[0_8px_20px_rgba(101,74,45,0.05)]">
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

export function PortalButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>
) {
  const { className, type = "button", ...rest } = props;
  return <button type={type} className={`${portalButtonPrimaryClass} ${className || ""}`.trim()} {...rest} />;
}

export function PortalSecondaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>
) {
  const { className, type = "button", ...rest } = props;
  return <button type={type} className={`${portalButtonSecondaryClass} ${className || ""}`.trim()} {...rest} />;
}

export function PortalMetricGrid({
  children,
}: {
  children: React.ReactNode;
}) {
  return <section className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">{children}</section>;
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
        className={`h-1.5 w-full bg-gradient-to-r ${
          accent || "from-[#f0d7ad] via-[#d5a05c] to-[#b26d2d]"
        }`}
      />
      <div className="p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a17848]">
          {label}
        </div>
        <div className="mt-3 break-words text-[28px] font-semibold leading-tight text-[#2f2218] md:text-[30px]">
          {value}
        </div>
        <div className="mt-3 text-sm leading-6 text-[#72553c]">{detail}</div>
        {actionLabel ? (
          <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b67831] transition group-hover:text-[#945821]">
            {actionLabel}
          </div>
        ) : null}
      </div>
    </>
  );

  const className = `group overflow-hidden rounded-[28px] border border-[#eadccf] bg-white shadow-[0_18px_48px_rgba(96,67,38,0.08)] transition ${
    href ? "hover:-translate-y-1 hover:border-[#d7b58e]" : ""
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a17848]">
            {title}
          </div>
          {subtitle ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[#72553c]">{subtitle}</p> : null}
        </div>
        {action ? action : null}
        {!action && actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="inline-flex rounded-full border border-[#e7d8c8] bg-[#fff9f2] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b67831] transition hover:border-[#d7b58e]"
          >
            {actionLabel}
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
    <div className={`rounded-[24px] border p-4 shadow-[0_12px_32px_rgba(96,67,38,0.05)] ${toneClass(tone)}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-[#2f2218]">{value}</div>
      {detail ? <div className="mt-2 text-sm leading-6 text-[#72553c]">{detail}</div> : null}
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
    <div className={`rounded-[24px] border p-4 shadow-[0_10px_24px_rgba(96,67,38,0.05)] ${toneClass(tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em]">{label}</div>
          <div className="mt-2 text-sm font-semibold leading-6 text-[#2f2218]">{title}</div>
          <div className="mt-1 text-sm leading-6 text-[#72553c]">{description}</div>
        </div>
        {rightLabel ? <div className="shrink-0 text-[11px] font-medium text-[#8a6a49]">{rightLabel}</div> : null}
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
    <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${toneClass(tone)}`}>
      {label}
    </span>
  );
}

export function PortalEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-[#e8d8c7] bg-[#fffaf4] px-5 py-10 text-center">
      <div className="text-base font-semibold text-[#2f2218]">{title}</div>
      <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#72553c]">{description}</div>
    </div>
  );
}

export function PortalLoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-[28px] border border-[#e8d8c7] bg-white text-sm font-semibold text-[#7e6145] shadow-[0_12px_30px_rgba(96,67,38,0.05)]">
      {label}
    </div>
  );
}

export function PortalErrorState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#efd2cc] bg-[#fff6f4] px-5 py-10 text-center shadow-[0_12px_30px_rgba(130,72,58,0.05)]">
      <div className="text-base font-semibold text-[#6f352d]">{title}</div>
      <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#8c574f]">{description}</div>
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

export function PortalTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${portalInputClass} min-h-[120px] resize-y ${props.className || ""}`.trim()} />;
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
    <div className="overflow-hidden rounded-[24px] border border-[#eadccf] bg-white shadow-[0_14px_36px_rgba(96,67,38,0.06)]">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="border-b border-[#f0e3d5] bg-[#fff9f2]">
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
