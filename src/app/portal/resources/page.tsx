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
    title: "Wellness & Veterinary Care",
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
    title: "Routine & Go-Home Readiness",
    text:
      "A calm first week, predictable meals, close observation, and a prepared home setup make transition easier and help your puppy settle in more confidently.",
  },
];

const quickGuides = [
  "Keep meals on a predictable schedule, especially during early transition.",
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
        title="Trusted Chihuahua resources, all in one place."
        description="This page brings together your most useful external sites, care guidance, and go-home reference material so families always have a reliable starting point inside the portal."
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
              detail="This page is meant to remain genuinely helpful after your puppy is home."
            />
          </div>
        }
      />

      <PortalMetricGrid>
        <PortalMetricCard
          label="External Sites"
          value="3"
          detail="Linked Chihuahua-focused websites."
        />
        <PortalMetricCard
          label="Health Topics"
          value={String(healthTopics.length)}
          detail="Core wellness and care areas to review."
          accent="from-[#dce9d6] via-[#b6cfaa] to-[#7e9c6f]"
        />
        <PortalMetricCard
          label="Quick Guides"
          value={String(quickGuides.length)}
          detail="Simple reminders worth revisiting."
          accent="from-[#ece3d5] via-[#d7c1a3] to-[#b18d62]"
        />
        <PortalMetricCard
          label="Support Path"
          value="Portal Messages"
          detail="Use Messages for questions specific to your puppy."
          accent="from-[#f0dcc1] via-[#ddb68c] to-[#c98743]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
        <div className="space-y-6">
          <PortalPanel
            title="Featured Sites"
            subtitle="Additional websites connected to the Southwest Virginia Chihuahua ecosystem."
          >
            <div className="space-y-4">
              {resourceSites.map((site) => (
                <a
                  key={site.href}
                  href={site.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-4 rounded-[24px] border border-[#eadccf] bg-white px-5 py-5 shadow-[0_10px_24px_rgba(96,67,38,0.05)] transition hover:-translate-y-0.5 hover:border-[#d7b58e]"
                >
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f8efe5] text-[#a17848]">
                    <ExternalLink className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg font-semibold text-[#2f2218]">{site.title}</div>
                    <div className="mt-2 text-sm leading-7 text-[#72553c]">
                      {site.description}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </PortalPanel>

          <PortalPanel
            title="Health & Care"
            subtitle="Foundational Chihuahua guidance that is worth having inside the portal, not just scattered across tabs and bookmarks."
          >
            <div className="grid gap-4 md:grid-cols-2">
              {healthTopics.map((topic) => (
                <div
                  key={topic.title}
                  className="rounded-[24px] border border-[#eadccf] bg-white px-5 py-5 shadow-[0_10px_24px_rgba(96,67,38,0.05)]"
                >
                  <div className="flex items-center gap-3 text-[#a17848]">
                    {topic.icon}
                    <div className="text-base font-semibold text-[#2f2218]">{topic.title}</div>
                  </div>
                  <div className="mt-3 text-sm leading-7 text-[#72553c]">{topic.text}</div>
                </div>
              ))}
            </div>
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel
            title="Quick Reference"
            subtitle="A few reminders families tend to revisit often."
          >
            <div className="space-y-4">
              <PortalInfoTile label="Breed Type" value="Toy Breed" detail="Small size means routines and safety matter." />
              <PortalInfoTile label="Priority Topic" value="Hypoglycemia awareness" detail="A key concern in very small puppies." />
              <PortalInfoTile label="Best Support" value="Consistency" detail="Routine, observation, and calm handling go a long way." />
            </div>
          </PortalPanel>

          <PortalPanel
            title="First-Week Priorities"
            subtitle="Simple go-home reminders that stay easy to review."
          >
            <div className="space-y-3">
              {quickGuides.map((guide) => (
                <div
                  key={guide}
                  className="rounded-[22px] border border-[#eadccf] bg-white px-4 py-4 text-sm leading-7 text-[#72553c] shadow-[0_10px_24px_rgba(96,67,38,0.05)]"
                >
                  {guide}
                </div>
              ))}
            </div>
          </PortalPanel>

          <PortalPanel
            title="Need puppy-specific help?"
            subtitle="General education is useful, but your portal conversation is still the best place for questions specific to your puppy."
          >
            <div className="flex items-start gap-3 rounded-[22px] border border-[#eadccf] bg-[#fffaf4] px-4 py-4">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-[#f8efe5] text-[#a17848]">
                <BookOpen className="h-4 w-4" />
              </div>
              <div className="text-sm leading-7 text-[#72553c]">
                Use Messages whenever you want advice about feeding, progress, behavior, medications, or anything that should be answered in the context of your specific puppy.
              </div>
            </div>
            <div className="mt-5">
              <Link href="/portal/messages" className="inline-flex items-center rounded-2xl border border-[#e2d3c2] bg-white px-5 py-3 text-sm font-semibold text-[#5b4331] shadow-[0_12px_28px_rgba(96,67,38,0.08)] transition hover:-translate-y-0.5 hover:border-[#d7b58e]">
                Message Support
              </Link>
            </div>
          </PortalPanel>
        </div>
      </section>
    </div>
  );
}
