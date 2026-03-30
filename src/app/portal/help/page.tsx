"use client";

import React from "react";
import Link from "next/link";
import {
  PortalHeroPrimaryAction,
  PortalHeroSecondaryAction,
  PortalInfoTile,
  PortalPageHero,
  PortalPanel,
} from "@/components/portal/luxury-shell";

const helpCards = [
  {
    title: "Cannot find a document?",
    body: "Open Documents first. If something should be there and is missing, send a portal message and we can post it for you.",
    href: "/portal/documents",
    cta: "Open Documents",
  },
  {
    title: "Need payment help?",
    body: "Review Payments for history and remaining balance, then send a message if you need clarification on a charge or arrangement.",
    href: "/portal/payments",
    cta: "Open Payments",
  },
  {
    title: "Waiting on updates?",
    body: "Pupdates and My Puppy show breeder notes, wellness entries, and milestone history as soon as they are posted.",
    href: "/portal/updates",
    cta: "Open Pupdates",
  },
  {
    title: "Need direct support?",
    body: "Use Messages for account-specific questions, or ask ChiChi if you need help finding the right page first.",
    href: "/portal/messages",
    cta: "Open Messages",
  },
];

export default function PortalHelpPage() {
  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Help and Support"
        title="Open the support path that fits what you need."
        description="Use this page when you are not sure where something lives, what a page is for, or which support option is best for the question you have."
        actions={
          <>
            <PortalHeroPrimaryAction href="/portal/messages">Open Messages</PortalHeroPrimaryAction>
            <PortalHeroSecondaryAction href="/portal">Back to Overview</PortalHeroSecondaryAction>
          </>
        }
        aside={
          <div className="space-y-4">
            <PortalInfoTile
              label="Fastest Answer"
              value="Ask in plain language"
              detail='Try prompts like "Where do I see my balance?" or "Show me the latest puppy update."'
            />
            <PortalInfoTile
              label="Best Support Path"
              value="Portal Messages"
              detail="Use Messages for account-specific questions that need breeder context."
            />
          </div>
        }
      />

      <PortalPanel
        title="Common Support Paths"
        subtitle="These shortcuts reduce guesswork and make the next step obvious."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {helpCards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="rounded-[24px] border border-[var(--portal-border)] bg-white px-5 py-5 shadow-[0_10px_22px_rgba(31,48,79,0.05)] transition hover:-translate-y-0.5 hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)]"
            >
              <div className="text-lg font-semibold text-[var(--portal-text)]">{card.title}</div>
              <div className="mt-3 text-sm leading-7 text-[var(--portal-text-soft)]">{card.body}</div>
              <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--portal-accent-strong)]">
                {card.cta}
              </div>
            </Link>
          ))}
        </div>
      </PortalPanel>
    </div>
  );
}
