"use client";

import React from "react";
import Link from "next/link";
import { BookOpen, ExternalLink, HeartPulse, Home, ShieldPlus, Stethoscope } from "lucide-react";
import {
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
  description: string;
};

const resourceSites: ResourceSite[] = [
  {
    title: "Pup-Lift",
    href: "https://pup-lift.com",
    description:
      "Transportation-focused support and planning resources for families preparing for safe puppy travel and delivery arrangements.",
  },
  {
    title: "Chihuahua HQ",
    href: "https://chihuahuahq.com",
    description:
      "Breed education, owner guidance, and Chihuahua-specific reading for families who want a stronger foundation in care and temperament.",
  },
  {
    title: "Chihuahua Services",
    href: "https://chihuahua.services",
    description:
      "Additional Chihuahua-centered tools, services, and support resources connected to the broader puppy journey.",
  },
];

const healthTopics = [
  {
    icon: <HeartPulse className="h-5 w-5" />,
    title: "Hypoglycemia Awareness",
    text:
      "Very small puppies can be sensitive to missed meals, chilling, stress, or overexertion. Sudden weakness, shakiness, poor appetite, or unusual sleepiness should be taken seriously.",
  },
  {
    icon: <Stethoscope className="h-5 w-5" />,
    title: "Wellness and Veterinary Care",
    text:
      "Keep vaccines, deworming, exams, and follow-up care organized. Early communication with your veterinarian and breeder helps small issues stay manageable.",
  },
  {
    icon: <ShieldPlus className="h-5 w-5" />,
    title: "Home Safety",
    text:
      "Tiny breed puppies need careful handling, low fall-risk environments, warmth, and supervision around larger pets, furniture, stairs, and busy foot traffic.",
  },
  {
    icon: <Home className="h-5 w-5" />,
    title: "Transition Routine",
    text:
      "A calm first week, predictable meals, close observation, and a prepared home setup make transition easier and help your puppy settle in more confidently.",
  },
];

const quickGuides = [
  "Keep meals on a predictable schedule during early transition.",
  "Watch appetite, energy, stool quality, and body warmth closely.",
  "Use calm handling and avoid rough play or high surfaces.",
  "Reach out early if something feels off rather than waiting.",
  "Use portal messages anytime for puppy-specific questions.",
];

export default function PortalResourcesPage() {
  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Resources"
        title="Open the reference library built for this portal."
        description="Use this page for Chihuahua education, go-home reminders, and trusted external resources that stay useful before and after your puppy comes home."
        actions={
          <>
            <PortalHeroPrimaryAction href="/portal/messages">Ask a Question</PortalHeroPrimaryAction>
            <PortalHeroSecondaryAction href="/portal/mypuppy">Open My Puppy</PortalHeroSecondaryAction>
          </>
        }
        aside={
          <div className="space-y-4">
            <PortalInfoTile
              label="External Sites"
              value="3"
              detail="Connected Chihuahua resources you can revisit anytime."
            />
            <PortalInfoTile
              label="Best Use"
              value="Before and after go-home"
              detail="This page is meant to stay helpful after your puppy is home."
            />
          </div>
        }
      />

      <PortalMetricGrid>
        <PortalMetricCard
          label="External Sites"
          value="3"
          detail="Trusted Chihuahua-focused websites."
        />
        <PortalMetricCard
          label="Care Topics"
          value={String(healthTopics.length)}
          detail="Core health and home-readiness topics."
          accent="from-[#dfe6fb] via-[#b8c7f7] to-[#7388d9]"
        />
        <PortalMetricCard
          label="Quick Guides"
          value={String(quickGuides.length)}
          detail="Concise reminders families tend to revisit."
          accent="from-[#d9eef4] via-[#acd4e2] to-[#6da8bd]"
        />
        <PortalMetricCard
          label="Support Path"
          value="Portal Messages"
          detail="Use Messages for questions specific to your puppy."
          accent="from-[#e7ebf2] via-[#cfd8e6] to-[#8ea0b9]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.18fr)_380px]">
        <div className="space-y-6">
          <PortalPanel
            title="Featured Sites"
            subtitle="Trusted external websites connected to the Southwest Virginia Chihuahua ecosystem."
          >
            <div className="space-y-4">
              {resourceSites.map((site) => (
                <a
                  key={site.href}
                  href={site.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-4 rounded-[24px] border border-[var(--portal-border)] bg-white px-5 py-5 shadow-[0_12px_26px_rgba(31,48,79,0.05)] transition hover:-translate-y-0.5 hover:border-[var(--portal-border-strong)] hover:bg-[var(--portal-surface-muted)]"
                >
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--portal-surface-muted)] text-[var(--portal-accent-strong)]">
                    <ExternalLink className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg font-semibold text-[var(--portal-text)]">{site.title}</div>
                    <div className="mt-2 text-sm leading-7 text-[var(--portal-text-soft)]">
                      {site.description}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </PortalPanel>

          <PortalPanel
            title="Care Library"
            subtitle="Foundational Chihuahua guidance that belongs inside the portal, not buried in scattered tabs and bookmarks."
          >
            <div className="grid gap-4 md:grid-cols-2">
              {healthTopics.map((topic) => (
                <div
                  key={topic.title}
                  className="rounded-[24px] border border-[var(--portal-border)] bg-white px-5 py-5 shadow-[0_10px_22px_rgba(31,48,79,0.05)]"
                >
                  <div className="flex items-center gap-3 text-[var(--portal-accent-strong)]">
                    {topic.icon}
                    <div className="text-base font-semibold text-[var(--portal-text)]">{topic.title}</div>
                  </div>
                  <div className="mt-3 text-sm leading-7 text-[var(--portal-text-soft)]">{topic.text}</div>
                </div>
              ))}
            </div>
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel
            title="Quick Reference"
            subtitle="A short set of reminders families tend to reopen often."
          >
            <div className="space-y-4">
              <PortalInfoTile label="Breed Type" value="Toy Breed" detail="Small size makes routines and safety especially important." />
              <PortalInfoTile label="Priority Topic" value="Hypoglycemia awareness" detail="A high-value topic to understand early." />
              <PortalInfoTile label="Best Support" value="Consistency" detail="Routine, observation, and calm handling go a long way." />
            </div>
          </PortalPanel>

          <PortalPanel
            title="First-Week Priorities"
            subtitle="The practical reminders that matter most during transition."
          >
            <div className="space-y-3">
              {quickGuides.map((guide) => (
                <div
                  key={guide}
                  className="rounded-[22px] border border-[var(--portal-border)] bg-white px-4 py-4 text-sm leading-7 text-[var(--portal-text-soft)] shadow-[0_10px_22px_rgba(31,48,79,0.05)]"
                >
                  {guide}
                </div>
              ))}
            </div>
          </PortalPanel>

          <PortalPanel
            title="Need puppy-specific help?"
            subtitle="General guidance is useful, but account-specific support still belongs in the portal conversation."
          >
            <div className="flex items-start gap-3 rounded-[22px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-[var(--portal-accent-strong)]">
                <BookOpen className="h-4 w-4" />
              </div>
              <div className="text-sm leading-7 text-[var(--portal-text-soft)]">
                Use Messages whenever you want guidance about feeding, progress, behavior, medications, or anything that should be answered in the context of your specific puppy.
              </div>
            </div>
            <div className="mt-5">
              <Link
                href="/portal/messages"
                className="inline-flex items-center gap-2 rounded-[18px] border border-[var(--portal-border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[0_12px_26px_rgba(31,48,79,0.06)] transition hover:-translate-y-0.5 hover:border-[var(--portal-border-strong)]"
              >
                Message Support
              </Link>
            </div>
          </PortalPanel>
        </div>
      </section>
    </div>
  );
}
