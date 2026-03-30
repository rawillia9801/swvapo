"use client";

import React from "react";
import Link from "next/link";

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
    <section className="overflow-hidden rounded-[36px] border border-[#e7d7c5] bg-[radial-gradient(circle_at_top_left,#fff8f0_0%,#fffdfa_42%,#f5ede4_100%)] p-6 shadow-[0_34px_90px_rgba(106,76,45,0.10)] md:p-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="max-w-4xl">
          <PortalEyebrow>{eyebrow}</PortalEyebrow>
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

export function PortalEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-[#ead8c1] bg-white/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#9e7446]">
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
    <Link
      href={href}
      className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(181,117,47,0.26)] transition hover:-translate-y-0.5 hover:brightness-105"
    >
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
    <Link
      href={href}
      className="inline-flex items-center rounded-2xl border border-[#e4d2be] bg-white px-5 py-3 text-sm font-semibold text-[#5d4330] shadow-[0_12px_28px_rgba(106,76,45,0.08)] transition hover:-translate-y-0.5 hover:border-[#d4b48b]"
    >
      {children}
    </Link>
  );
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
        {actionLabel ? (
          <div className="mt-5 text-[12px] font-semibold uppercase tracking-[0.2em] text-[#b8772f] transition group-hover:text-[#9f6425]">
            {actionLabel}
          </div>
        ) : null}
      </div>
    </>
  );

  if (!href) {
    return (
      <div className="overflow-hidden rounded-[28px] border border-[#ead8c6] bg-white shadow-[0_18px_48px_rgba(106,76,45,0.08)]">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="group overflow-hidden rounded-[28px] border border-[#ead8c6] bg-white shadow-[0_18px_48px_rgba(106,76,45,0.08)] transition hover:-translate-y-1 hover:border-[#d8b48b]"
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
  children,
}: {
  title: string;
  subtitle?: string;
  actionHref?: string;
  actionLabel?: string;
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
        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="inline-flex rounded-full border border-[#e5d2bc] bg-[#fff9f2] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b8772f] transition hover:border-[#d8b48b]"
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

export function PortalListCard({
  label,
  title,
  description,
  rightLabel,
}: {
  label: string;
  title: string;
  description: string;
  rightLabel?: string;
}) {
  return (
    <div className="rounded-[22px] border border-[#ead9c7] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2e9_100%)] p-4 shadow-[0_10px_24px_rgba(106,76,45,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a47946]">
            {label}
          </div>
          <div className="mt-2 text-sm font-semibold leading-6 text-[#2f2218]">{title}</div>
          <div className="mt-1 text-sm leading-6 text-[#73583f]">{description}</div>
        </div>
        {rightLabel ? (
          <span className="shrink-0 text-[11px] font-medium text-[#9c7a57]">{rightLabel}</span>
        ) : null}
      </div>
    </div>
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
    <div className="rounded-[24px] border border-dashed border-[#e7d6c2] bg-[#fffaf5] px-5 py-10 text-center">
      <div className="text-base font-semibold text-[#2f2218]">{title}</div>
      <div className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#73583f]">{description}</div>
    </div>
  );
}
