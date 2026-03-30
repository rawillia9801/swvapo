"use client";

import React from "react";
import {
  ArrowUpRight,
  Compass,
  HeartPulse,
  House,
  MessageSquareText,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import {
  PortalActionLink,
  PortalHeroPrimaryAction,
  PortalHeroSecondaryAction,
  PortalInfoTile,
  PortalMetricCard,
  PortalMetricGrid,
  PortalPageHero,
  PortalPanel,
} from "@/components/portal/luxury-shell";

type ResourceSite = {
  title: string;
  href: string;
  tag: string;
  description: string;
};

type KnowledgeModule = {
  title: string;
  description: string;
  icon: React.ReactNode;
};

const referenceSites: ResourceSite[] = [
  {
    title: "Pup-Lift",
    href: "https://pup-lift.com",
    tag: "Transportation",
    description:
      "Travel planning, delivery support, and transportation guidance connected to the puppy handoff process.",
  },
  {
    title: "Chihuahua HQ",
    href: "https://chihuahuahq.com",
    tag: "Breed Education",
    description:
      "Long-form Chihuahua education covering temperament, care routines, and owner education beyond the portal.",
  },
  {
    title: "Chihuahua Services",
    href: "https://chihuahua.services",
    tag: "Services",
    description:
      "Additional Chihuahua-centered tools, services, and support resources connected to your ongoing account journey.",
  },
];

const knowledgeModules: KnowledgeModule[] = [
  {
    title: "Health Watch",
    description:
      "Review the signals that matter most in small-breed puppies, including appetite changes, body warmth, stool quality, and unusual lethargy.",
    icon: <HeartPulse className="h-5 w-5" />,
  },
  {
    title: "Veterinary Readiness",
    description:
      "Keep your first exam, vaccine follow-up, deworming notes, and any medication questions organized before and after go-home day.",
    icon: <Stethoscope className="h-5 w-5" />,
  },
  {
    title: "Home Setup",
    description:
      "Use a low-risk setup with warmth, supervision, stable meals, and safe handling practices that fit a tiny Chihuahua puppy.",
    icon: <House className="h-5 w-5" />,
  },
  {
    title: "Operating Guidance",
    description:
      "Use portal messages for anything that should be answered in the context of your specific puppy, account, or records.",
    icon: <ShieldCheck className="h-5 w-5" />,
  },
];

const quickReference = [
  "Keep meals steady and predictable during transition.",
  "Watch for appetite changes, chills, weakness, or unusual sleepiness.",
  "Use calm handling and avoid elevated surfaces or rough play.",
  "Recheck portal updates, documents, and messages before travel day.",
  "Use portal messages for account-specific questions instead of guessing.",
];

export default function PortalResourcesPage() {
  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Resources"
        title="Reference library"
        description="Open Chihuahua care guidance, transportation references, and related Southwest Virginia Chihuahua resources in one place."
        actions={
          <>
            <PortalHeroPrimaryAction href="/portal/messages">Ask a Question</PortalHeroPrimaryAction>
            <PortalHeroSecondaryAction href="/portal/mypuppy">Open My Puppy</PortalHeroSecondaryAction>
          </>
        }
        aside={
          <div className="space-y-4">
            <PortalInfoTile
              label="Reference scope"
              value="Before and after go-home"
              detail="Use this page throughout the full buyer lifecycle, not only during pickup week."
            />
            <PortalInfoTile
              label="Support route"
              value="Messages"
              detail="Use portal messages whenever a question depends on your puppy, account, or breeder notes."
            />
          </div>
        }
      />

      <PortalMetricGrid>
        <PortalMetricCard
          label="Reference Sites"
          value={String(referenceSites.length)}
          detail="Connected Chihuahua properties and support destinations."
        />
        <PortalMetricCard
          label="Knowledge Modules"
          value={String(knowledgeModules.length)}
          detail="Core topics families revisit most often."
          accent="from-[#e9efff] via-[#d7e2ff] to-[#9eb5ef]"
        />
        <PortalMetricCard
          label="Quick Checks"
          value={String(quickReference.length)}
          detail="Short reminders for transition, travel, and home setup."
          accent="from-[#e8f4fb] via-[#d4e7f5] to-[#9dbddb]"
        />
        <PortalMetricCard
          label="Account Help"
          value="Portal Messages"
          detail="Use messages for anything tied to your own records."
          accent="from-[#eef2f8] via-[#dbe4ef] to-[#a9bbd1]"
        />
      </PortalMetricGrid>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_380px]">
        <div className="space-y-6">
          <PortalPanel
            title="Connected destinations"
            subtitle="Open the broader Southwest Virginia Chihuahua ecosystem without leaving the structure of your portal."
          >
            <div className="space-y-4">
              {referenceSites.map((site) => (
                <a
                  key={site.href}
                  href={site.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-start gap-4 rounded-[28px] border border-[var(--portal-border)] bg-[rgba(255,255,255,0.92)] px-5 py-5 shadow-[0_18px_34px_rgba(23,35,56,0.05)] transition hover:-translate-y-0.5 hover:border-[var(--portal-border-strong)] hover:shadow-[0_22px_42px_rgba(23,35,56,0.08)]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#eef3ff_0%,#dbe6ff_100%)] text-[var(--portal-accent-strong)] shadow-[0_10px_22px_rgba(47,88,227,0.14)]">
                    <Compass className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold tracking-[-0.03em] text-[var(--portal-text)]">
                        {site.title}
                      </h3>
                      <span className="inline-flex items-center rounded-full border border-[rgba(93,121,255,0.18)] bg-[rgba(93,121,255,0.08)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-accent-strong)]">
                        {site.tag}
                      </span>
                    </div>

                    <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--portal-text-soft)]">
                      {site.description}
                    </p>
                  </div>

                  <span className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--portal-border)] bg-white text-[var(--portal-text-muted)] transition group-hover:border-[var(--portal-border-strong)] group-hover:text-[var(--portal-accent-strong)]">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </a>
              ))}
            </div>
          </PortalPanel>

          <PortalPanel
            title="Knowledge modules"
            subtitle="The reference material buyers tend to reopen during transition, care, and post-go-home support."
          >
            <div className="grid gap-4 md:grid-cols-2">
              {knowledgeModules.map((module) => (
                <div
                  key={module.title}
                  className="rounded-[28px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(245,249,255,0.86)_100%)] p-5 shadow-[0_16px_32px_rgba(23,35,56,0.05)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[var(--portal-surface-muted)] text-[var(--portal-accent-strong)]">
                      {module.icon}
                    </div>
                    <div className="text-base font-semibold tracking-[-0.03em] text-[var(--portal-text)]">
                      {module.title}
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-7 text-[var(--portal-text-soft)]">
                    {module.description}
                  </p>
                </div>
              ))}
            </div>
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel
            title="Use this page for"
            subtitle="Keep the portal focused: general guidance lives here, account-specific guidance stays attached to your records."
          >
            <div className="space-y-4">
              <PortalInfoTile
                label="General breed guidance"
                value="Resources"
                detail="Use this page for Chihuahua care, home prep, and supporting references."
              />
              <PortalInfoTile
                label="Account-specific questions"
                value="Messages"
                detail="Use Messages if the answer depends on your puppy, breeder notes, or an active portal record."
              />
              <PortalInfoTile
                label="Medical urgency"
                value="Veterinarian"
                detail="Use veterinary care right away for urgent symptoms, sudden weakness, or serious health concerns."
              />
            </div>
          </PortalPanel>

          <PortalPanel
            title="First-week priorities"
            subtitle="A short operating list for the days immediately before and after your puppy comes home."
          >
            <div className="space-y-3">
              {quickReference.map((item, index) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-[24px] border border-[var(--portal-border)] bg-[rgba(255,255,255,0.92)] px-4 py-4 shadow-[0_14px_26px_rgba(23,35,56,0.04)]"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--portal-surface-muted)] text-sm font-semibold text-[var(--portal-accent-strong)]">
                    {index + 1}
                  </div>
                  <div className="text-sm leading-7 text-[var(--portal-text-soft)]">{item}</div>
                </div>
              ))}
            </div>
          </PortalPanel>

          <PortalPanel
            title="Need account help?"
            subtitle="Use your portal records, not a generic contact form, when the question depends on your own puppy journey."
          >
            <div className="space-y-4">
              <div className="rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-white text-[var(--portal-accent-strong)]">
                    <MessageSquareText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--portal-text)]">
                      Use Messages for account-specific questions
                    </div>
                    <div className="mt-2 text-sm leading-7 text-[var(--portal-text-soft)]">
                      Feeding questions, breeder notes, medication details, documents, and transportation updates are easier to track when they stay inside your portal history.
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <PortalActionLink
                  href="/portal/messages"
                  eyebrow="Support"
                  title="Open Messages"
                  detail="Use account-linked messaging for puppy-specific questions."
                />
                <PortalActionLink
                  href="/portal/documents"
                  eyebrow="Records"
                  title="Open Documents"
                  detail="Review signed forms, portal files, and account documents."
                />
              </div>
            </div>
          </PortalPanel>
        </div>
      </section>
    </div>
  );
}
