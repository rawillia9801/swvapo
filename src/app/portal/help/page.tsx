"use client";

import Link from "next/link";
import React from "react";

const helpCards = [
  {
    title: "Can’t find a document?",
    body: "Open the Documents tab first. If something should be there and is missing, send a portal message and we can post it for you.",
    href: "/portal/documents",
    cta: "Open Documents",
  },
  {
    title: "Need payment help?",
    body: "Review your Payments tab for history and remaining balance, then send a message if you need clarification on a charge or arrangement.",
    href: "/portal/payments",
    cta: "Open Payments",
  },
  {
    title: "Waiting on updates?",
    body: "Puppy milestones, health notes, and breeder updates appear in Updates and My Puppy as they are posted.",
    href: "/portal/updates",
    cta: "Open Updates",
  },
  {
    title: "Need direct support?",
    body: "Use Messages for account-specific questions, or ask ChiChi for a faster overview of where something lives in the portal.",
    href: "/portal/messages",
    cta: "Open Messages",
  },
];

export default function PortalHelpPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-[#dccab7] bg-white p-7 shadow-[0_16px_40px_rgba(74,51,33,0.08)]">
        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#9c7b58]">Help and Support</div>
        <h1 className="mt-3 font-serif text-4xl font-bold text-[#3b271b]">Portal Troubleshooting</h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-[#8b6b4d]">
          This page is your quick support hub for common customer questions. If you are unsure where something belongs, ChiChi can also guide you based on your account.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {helpCards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="rounded-[2rem] border border-[#dccab7] bg-white p-7 shadow-[0_16px_40px_rgba(74,51,33,0.08)] transition hover:-translate-y-1 hover:shadow-[0_22px_44px_rgba(74,51,33,0.12)]"
          >
            <h2 className="font-serif text-2xl font-bold text-[#3b271b]">{card.title}</h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-[#6f5037]">{card.body}</p>
            <div className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
              {card.cta}
            </div>
          </Link>
        ))}
      </section>

      <section className="rounded-[2rem] bg-[linear-gradient(135deg,#8f6945_0%,#6f5037_100%)] p-7 text-white shadow-[0_20px_44px_rgba(74,51,33,0.18)]">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/75">ChiChi Tip</div>
        <h2 className="mt-2 font-serif text-2xl font-bold">Ask in Plain Language</h2>
        <p className="mt-3 text-sm font-semibold leading-7 text-white/85">
          Try prompts like “Where do I see my balance?”, “Do I have any unread messages?”, or “Show me the latest puppy update.”
        </p>
      </section>
    </div>
  );
}
