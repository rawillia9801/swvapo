"use client";

import React from "react";
import Link from "next/link";
import { ExternalLink, HeartPulse, ShieldPlus, Stethoscope, Home, BookOpen } from "lucide-react";

type ResourceSite = {
  title: string;
  href: string;
  description: string;
  accent: string;
};

const resourceSites: ResourceSite[] = [
  {
    title: "Pup-Lift",
    href: "https://pup-lift.com",
    description:
      "Transportation-focused support and planning resources for families preparing for safe puppy travel and delivery arrangements.",
    accent: "from-[#f0c98f] to-[#d9a666]",
  },
  {
    title: "Chihuahua HQ",
    href: "https://chihuahuahq.com",
    description:
      "Breed education, owner guidance, and Chihuahua-specific reading for families who want a stronger foundation in care and temperament.",
    accent: "from-[#e8d8bf] to-[#c79e67]",
  },
  {
    title: "Chihuahua Services",
    href: "https://chihuahua.services",
    description:
      "Additional Chihuahua-centered tools, services, and support resources connected to your broader puppy journey.",
    accent: "from-[#d5e5d0] to-[#9db58e]",
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
    <div className="space-y-8 pb-14">
      <section className="overflow-hidden rounded-[34px] border border-[#dccab7] bg-white shadow-[0_20px_50px_rgba(74,51,33,0.10)]">
        <div className="grid grid-cols-1 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="relative overflow-hidden bg-[linear-gradient(145deg,#2f2118_0%,#6f5037_45%,#af7b4a_100%)] px-7 py-8 text-white md:px-9 md:py-10">
            <div className="absolute -left-8 top-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-52 w-52 rounded-full bg-[#f1d3ab]/20 blur-3xl" />

            <div className="relative inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/82">
              Resources
            </div>

            <h1 className="relative mt-6 max-w-2xl font-serif text-4xl font-bold leading-[0.94] md:text-6xl">
              Trusted Chihuahua resources, all in one place.
            </h1>

            <p className="relative mt-4 max-w-2xl text-sm font-semibold leading-7 text-white/80 md:text-[15px]">
              This section brings together your most useful external sites, health-focused guidance, and go-home preparation information so families have a reliable reference point inside the portal.
            </p>

            <div className="relative mt-8 flex flex-wrap gap-3">
              <Link
                href="/portal/messages"
                className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#f0c98f_0%,#d9a666_100%)] px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-[#24180f] shadow-[0_14px_28px_rgba(33,22,15,0.18)] transition hover:translate-y-[-1px]"
              >
                Ask a Question
              </Link>
              <Link
                href="/portal/mypuppy"
                className="inline-flex items-center rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white backdrop-blur-sm transition hover:bg-white/15"
              >
                Open My Puppy
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 bg-[linear-gradient(180deg,#fffdfa_0%,#faf4ed_100%)] p-7 md:grid-cols-2 md:p-8">
            <ResourceStat label="External Sites" value="3" detail="Connected Chihuahua resources" />
            <ResourceStat label="Health Topics" value="4" detail="Core care areas to review" />
            <ResourceStat label="Portal Help" value="Live" detail="Use messages for puppy-specific questions" />
            <ResourceStat label="Best Use" value="Daily" detail="Helpful before and after go-home day" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-8 xl:grid-cols-12">
        <div className="space-y-8 xl:col-span-8">
          <div className="rounded-[30px] border border-[#dccab7] bg-white p-7 shadow-[0_16px_40px_rgba(74,51,33,0.08)]">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#9c7b58]">
              Featured Sites
            </div>
            <h2 className="mt-3 font-serif text-3xl font-bold text-[#3b271b]">
              Additional websites for your puppy journey
            </h2>

            <div className="mt-6 grid gap-5">
              {resourceSites.map((site) => (
                <a
                  key={site.href}
                  href={site.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group overflow-hidden rounded-[26px] border border-[#e2d4c6] bg-white shadow-[0_14px_30px_rgba(74,51,33,0.06)] transition hover:-translate-y-1 hover:shadow-[0_20px_38px_rgba(74,51,33,0.10)]"
                >
                  <div className={`h-2 bg-gradient-to-r ${site.accent}`} />
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-2xl font-serif font-bold text-[#342116]">{site.title}</div>
                        <div className="mt-2 text-sm font-semibold leading-7 text-[#6f5037]">
                          {site.description}
                        </div>
                      </div>
                      <span className="rounded-full border border-[#dccab7] bg-[#fcf9f5] p-2 text-[#7f5f42]">
                        <ExternalLink className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-[#dccab7] bg-white p-7 shadow-[0_16px_40px_rgba(74,51,33,0.08)]">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#9c7b58]">
              Health & Care
            </div>
            <h2 className="mt-3 font-serif text-3xl font-bold text-[#3b271b]">
              Foundational Chihuahua guidance
            </h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {healthTopics.map((topic) => (
                <div
                  key={topic.title}
                  className="rounded-[24px] border border-[#e5d7c8] bg-[#fcf9f5] p-5"
                >
                  <div className="flex items-center gap-3 text-[#7f5f42]">
                    {topic.icon}
                    <div className="text-lg font-black text-[#342116]">{topic.title}</div>
                  </div>
                  <div className="mt-3 text-sm font-semibold leading-7 text-[#6f5037]">
                    {topic.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6 xl:col-span-4">
          <div className="rounded-[30px] border border-[#dccab7] bg-white p-7 shadow-[0_16px_40px_rgba(74,51,33,0.08)]">
            <h3 className="font-serif text-2xl font-bold text-[#3b271b]">Quick Reference</h3>
            <div className="mt-5 space-y-3">
              <QuickTile label="Breed Type" value="Toy Breed" />
              <QuickTile label="Priority Topic" value="Hypoglycemia awareness" />
              <QuickTile label="Coat Types" value="Smooth and long coat" />
              <QuickTile label="Best Support" value="Consistent routine and close observation" />
            </div>
          </div>

          <div className="rounded-[30px] border border-[#dccab7] bg-white p-7 shadow-[0_16px_40px_rgba(74,51,33,0.08)]">
            <h3 className="font-serif text-2xl font-bold text-[#3b271b]">First-Week Priorities</h3>
            <div className="mt-5 space-y-3">
              {quickGuides.map((item) => (
                <div
                  key={item}
                  className="rounded-[20px] border border-[#e5d7c8] bg-[#fcf9f5] px-4 py-3 text-sm font-semibold leading-7 text-[#6f5037]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] bg-[linear-gradient(145deg,#5f4330_0%,#7b5a3d_100%)] p-7 text-white shadow-[0_18px_44px_rgba(74,51,33,0.18)]">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5" />
              <h3 className="font-serif text-2xl font-bold">Need puppy-specific help?</h3>
            </div>
            <p className="mt-3 text-sm font-semibold leading-7 text-white/82">
              General education is helpful, but your portal messages are still the best place to ask about feeding, progress, behavior, medications, or anything specific to your puppy.
            </p>
            <Link
              href="/portal/messages"
              className="mt-5 inline-flex items-center rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-white/15"
            >
              Message Support
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function ResourceStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[26px] border border-[#e2d4c6] bg-white p-5 shadow-[0_14px_30px_rgba(74,51,33,0.06)]">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">{label}</div>
      <div className="mt-3 font-serif text-3xl font-bold text-[#342116]">{value}</div>
      <div className="mt-2 text-sm font-semibold leading-6 text-[#8b6b4d]">{detail}</div>
    </div>
  );
}

function QuickTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[#e5d7c8] bg-[#fcf9f5] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[#342116]">{value}</div>
    </div>
  );
}
