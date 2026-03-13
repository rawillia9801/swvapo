"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { sb } from "@/lib/utils";

export default function PortalResourcesPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const {
          data: { session },
        } = await sb.auth.getSession();

        if (!mounted) return;
        setUser(session?.user ?? null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: authListener } = sb.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    await sb.auth.signOut();
    setUser(null);
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-50 italic">
        Loading Resources...
      </div>
    );
  }

  if (!user) {
    return <ResourcesLogin />;
  }

  return (
    <div className="flex h-screen overflow-hidden text-brand-900 bg-brand-50">
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white/80 backdrop-blur-md h-16 flex items-center justify-between px-6 border-b border-brand-200/50">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsDrawerOpen(true)} className="text-brand-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <span className="font-serif font-bold text-xl">SWVA</span>
        </div>

        <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center border border-brand-200 font-bold text-brand-600">
          {user.email?.[0]?.toUpperCase() || "U"}
        </div>
      </header>

      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-brand-900/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 bottom-0 w-[82%] max-w-[320px] bg-[#FDFBF9] z-50 shadow-2xl flex flex-col transition-transform duration-300 md:hidden ${
          isDrawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 border-b border-brand-100 flex justify-between items-center">
          <div>
            <div className="font-serif font-bold text-xl">Menu</div>
            <div className="text-[11px] text-brand-400 font-semibold mt-1 truncate max-w-[220px]">
              {user.email}
            </div>
          </div>
          <button onClick={() => setIsDrawerOpen(false)}>×</button>
        </div>

        <nav className="p-5 pt-7 flex flex-col gap-3 flex-1 overflow-y-auto">
          <Link href="/portal" className="nav-item">
            Dashboard
          </Link>
          <Link href="/portal/application" className="nav-item">
            Application
          </Link>
          <Link href="/portal/mypuppy" className="nav-item">
            My Puppy
          </Link>
          <Link href="/portal/messages" className="nav-item">
            Messages
          </Link>
          <Link href="/portal/documents" className="nav-item">
            Documents
          </Link>
          <Link href="/portal/payments" className="nav-item">
            Financials
          </Link>
          <Link href="/portal/resources" className="nav-item active">
            Resources
          </Link>
        </nav>

        <div className="p-6 border-t border-brand-100 bg-brand-50">
          <button
            onClick={handleSignOut}
            className="w-full py-3 rounded-lg border border-brand-200 text-brand-700 font-black text-sm hover:bg-white transition"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <aside className="hidden md:flex flex-col w-72 bg-white/80 border-r border-brand-200/60 z-20 h-full backdrop-blur-sm">
        <div className="p-8">
          <h1 className="font-serif font-bold text-xl leading-none">SWVA</h1>
          <p className="text-[10px] uppercase tracking-widest text-brand-500 font-black mt-1">
            Chihuahua
          </p>
        </div>

        <nav className="flex-1 px-4 pt-6 pb-6 overflow-y-auto">
          <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-brand-400">
            Portal
          </div>

          <div className="mt-3 flex flex-col gap-3">
            <Link href="/portal" className="nav-item">
              Dashboard
            </Link>
            <Link href="/portal/application" className="nav-item">
              Application
            </Link>
            <Link href="/portal/mypuppy" className="nav-item">
              My Puppy
            </Link>
          </div>

          <div className="px-4 py-2 mt-8 text-[10px] font-black uppercase tracking-widest text-brand-400">
            Communication
          </div>

          <div className="mt-3 flex flex-col gap-3">
            <Link href="/portal/messages" className="nav-item">
              Messages
            </Link>
            <Link href="/portal/documents" className="nav-item">
              Contracts
            </Link>
            <Link href="/portal/payments" className="nav-item">
              Financials
            </Link>
            <Link href="/portal/resources" className="nav-item active">
              Resources
            </Link>
          </div>
        </nav>

        <div className="p-4 border-t border-brand-100 bg-brand-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-200 flex items-center justify-center text-brand-700 font-black text-xs">
              {user.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black truncate">{user.email}</p>
              <div className="flex items-center gap-3 mt-1">
                <button
                  onClick={handleSignOut}
                  className="text-[10px] font-black uppercase text-brand-500 hover:text-brand-800"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 h-full relative flex flex-col overflow-hidden bg-texturePaper pt-16 md:pt-0">
        <div className="flex-1 p-6 md:p-10 lg:p-12 overflow-y-auto scroller max-w-[1600px] mx-auto w-full">
          <div className="space-y-8 pb-14">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
              <div>
                <h2 className="font-serif text-4xl md:text-5xl font-bold text-brand-900 leading-[0.95]">
                  Resources
                </h2>
                <p className="mt-2 text-brand-500 font-semibold">
                  Chihuahua care, health, temperament, safety, and go-home guidance — all in one place.
                </p>
              </div>

              <a
                href="https://chihuahuahq.com"
                target="_blank"
                rel="noreferrer"
                className="px-5 py-3 bg-white border border-brand-200 text-brand-800 font-black text-xs uppercase tracking-[0.18em] rounded-xl hover:bg-brand-50 transition shadow-paper"
              >
                Visit ChihuahuaHQ.com
              </a>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 space-y-8">
                <div className="card-luxury shine p-7 md:p-9">
                  <span className="inline-block px-3 py-1 bg-brand-100 text-brand-700 text-[10px] font-black uppercase tracking-[0.22em] rounded-full mb-4 border border-brand-200">
                    Featured Resource
                  </span>

                  <h3 className="font-serif text-3xl md:text-4xl font-bold text-brand-900 mb-3 leading-[1.05]">
                    ChihuahuaHQ.com
                  </h3>

                  <p className="text-brand-600 font-semibold leading-relaxed max-w-3xl">
                    ChihuahuaHQ.com is your portal’s featured destination for all things Chihuahua — breed information, care guidance, general education, and helpful reading for both first-time and experienced owners.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <a
                      href="https://chihuahuahq.com"
                      target="_blank"
                      rel="noreferrer"
                      className="px-6 py-3 rounded-xl bg-brand-800 text-white font-black text-xs uppercase tracking-[0.18em] hover:bg-brand-700 transition shadow-lift"
                    >
                      Open ChihuahuaHQ.com →
                    </a>

                    <Link
                      href="/portal/messages"
                      className="px-6 py-3 rounded-xl bg-white border border-brand-200 text-brand-800 font-black text-xs uppercase tracking-[0.18em] hover:bg-brand-50 transition shadow-paper"
                    >
                      Ask a Question →
                    </Link>
                  </div>
                </div>

                <SectionCard
                  title="Breed Basics"
                  description="The Chihuahua is one of the smallest dog breeds in the world, but their personality is often anything but small."
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FactCard
                      label="Size"
                      value="Toy breed"
                      text="Very small in body size, which means they require gentle handling and a safe home environment."
                    />
                    <FactCard
                      label="Lifespan"
                      value="Long-lived breed"
                      text="With good care, Chihuahuas often stay with their families for many years."
                    />
                    <FactCard
                      label="Coats"
                      value="Smooth or long coat"
                      text="Both coat types are beautiful, but they have different grooming needs."
                    />
                    <FactCard
                      label="Personality"
                      value="Loyal and alert"
                      text="Chihuahuas often bond closely with their people and are naturally watchful."
                    />
                  </div>
                </SectionCard>

                <SectionCard
                  title="Temperament"
                  description="Chihuahuas are known for being deeply loyal, emotionally tuned in, and surprisingly bold for their size."
                >
                  <BulletBlock
                    items={[
                      "They often form a strong attachment to their family and may pick a favorite person.",
                      "They are usually alert and can be vocal when something feels unfamiliar.",
                      "They tend to do best with calm, consistent handling instead of rough play.",
                      "Early socialization helps them feel more secure and confident around new people, animals, and settings.",
                      "They are intelligent and often learn routines quickly when training stays positive and repetitive.",
                    ]}
                  />
                </SectionCard>

                <SectionCard
                  title="Health Watch"
                  description="Because Chihuahuas are small and delicate, owners should stay aware of a few common areas of concern."
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoBox
                      title="Hypoglycemia"
                      text="Low blood sugar can happen especially in young puppies. Skipping meals, stress, chilling, or overexertion can raise the risk."
                    />
                    <InfoBox
                      title="Dental Care"
                      text="Small breeds often need consistent dental care. Teeth and gums should be monitored as part of normal wellness."
                    />
                    <InfoBox
                      title="Cold Sensitivity"
                      text="Because of their tiny size, Chihuahuas can get chilled quickly. Warmth and draft-free spaces matter."
                    />
                    <InfoBox
                      title="Injury Prevention"
                      text="Their size means they are more vulnerable to falls, rough handling, and accidental stepping."
                    />
                  </div>
                </SectionCard>

                <SectionCard
                  title="Hypoglycemia: Know the Signs"
                  description="This is one of the most important topics for tiny-breed puppy owners."
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SimpleList
                      title="Possible Signs"
                      items={[
                        "Weakness",
                        "Sleepiness that seems unusual",
                        "Shaking or trembling",
                        "Wobbliness",
                        "Poor appetite",
                        "Confusion or staring off",
                      ]}
                    />
                    <SimpleList
                      title="Immediate Priorities"
                      items={[
                        "Warm the puppy gently if chilled",
                        "Offer food if the puppy is alert and able to eat",
                        "Follow your breeder’s emergency guidance",
                        "Contact a veterinarian right away if symptoms continue or worsen",
                      ]}
                    />
                  </div>
                </SectionCard>

                <SectionCard
                  title="Feeding & Routine"
                  description="Young Chihuahua puppies do best with structure, consistency, and careful observation."
                >
                  <BulletBlock
                    items={[
                      "Small puppies should not go long stretches without food.",
                      "A consistent meal schedule supports growth and energy.",
                      "Always monitor appetite, stool quality, and water intake.",
                      "Any sudden drop in eating, energy, or alertness should be taken seriously.",
                      "Routine helps Chihuahuas feel secure and makes training easier.",
                    ]}
                  />
                </SectionCard>

                <SectionCard
                  title="Training & Socialization"
                  description="Confidence grows when training is calm, kind, and consistent."
                >
                  <BulletBlock
                    items={[
                      "Start with short, simple sessions and repeat them often.",
                      "Reward the behaviors you want rather than focusing only on mistakes.",
                      "Introduce new sights, sounds, and people gradually.",
                      "Do not overwhelm a tiny puppy with too much stimulation at once.",
                      "Potty habits improve faster when the routine stays predictable.",
                    ]}
                  />
                </SectionCard>

                <SectionCard
                  title="Grooming & Coat Care"
                  description="Both smooth and long coat Chihuahuas benefit from regular coat and skin care."
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoBox
                      title="Smooth Coat"
                      text="Usually lower-maintenance, but still benefits from gentle brushing and skin checks."
                    />
                    <InfoBox
                      title="Long Coat"
                      text="Needs more frequent brushing to prevent tangles and keep the coat neat and comfortable."
                    />
                    <InfoBox
                      title="Nails"
                      text="Nail care matters because overgrown nails can affect comfort and movement."
                    />
                    <InfoBox
                      title="Ears & Eyes"
                      text="Owners should routinely observe for irritation, discharge, odor, or anything unusual."
                    />
                  </div>
                </SectionCard>

                <SectionCard
                  title="Home Safety"
                  description="Tiny dogs need a home setup that respects their size."
                >
                  <BulletBlock
                    items={[
                      "Avoid high surfaces where a puppy could fall.",
                      "Teach children to sit down and hold a puppy carefully.",
                      "Use caution around recliners, rocking chairs, and underfoot traffic.",
                      "Block unsafe gaps, stairs, and places a tiny puppy could slip through.",
                      "Supervise interactions with larger pets until everyone is calm and predictable.",
                    ]}
                  />
                </SectionCard>

                <SectionCard
                  title="Vet Care & Wellness"
                  description="Healthy puppy development depends on good communication between owner, breeder, and veterinarian."
                >
                  <BulletBlock
                    items={[
                      "Schedule the puppy’s first wellness visit within the required time frame from your breeder’s agreement.",
                      "Keep records organized for vaccines, deworming, and checkups.",
                      "Report any unusual symptoms promptly rather than waiting.",
                      "Ask questions early — small issues are easier to manage when caught quickly.",
                    ]}
                  />
                </SectionCard>

                <SectionCard
                  title="Preparing for Go-Home"
                  description="A calm first week sets the tone for success."
                >
                  <BulletBlock
                    items={[
                      "Prepare a quiet, warm, low-stress area before the puppy arrives.",
                      "Have food, dishes, bedding, and safe containment ready ahead of time.",
                      "Stick closely to the routine recommended by the breeder.",
                      "Limit overwhelming activity during the first days home.",
                      "Observe eating, sleeping, potty habits, and energy carefully.",
                    ]}
                  />
                </SectionCard>
              </div>

              <div className="lg:col-span-4 space-y-6">
                <div className="card-luxury p-7">
                  <h3 className="font-serif text-2xl font-bold text-brand-900 mb-4">
                    Quick Reference
                  </h3>

                  <div className="space-y-4">
                    <MiniInfo
                      label="Breed Type"
                      value="Toy Breed"
                    />
                    <MiniInfo
                      label="Known For"
                      value="Loyalty, alertness, and big personality"
                    />
                    <MiniInfo
                      label="Coat Options"
                      value="Smooth Coat / Long Coat"
                    />
                    <MiniInfo
                      label="Priority Topic"
                      value="Hypoglycemia awareness"
                    />
                  </div>
                </div>

                <div className="card-luxury p-7">
                  <h3 className="font-serif text-2xl font-bold text-brand-900 mb-4">
                    First-Week Priorities
                  </h3>

                  <SimpleList
                    title=""
                    items={[
                      "Keep meals on schedule",
                      "Watch for low energy or skipped eating",
                      "Protect from falls and chilling",
                      "Limit stress and overstimulation",
                      "Follow breeder instructions closely",
                    ]}
                  />
                </div>

                <div className="card-luxury p-7">
                  <h3 className="font-serif text-2xl font-bold text-brand-900 mb-4">
                    Helpful Portal Links
                  </h3>

                  <div className="space-y-3">
                    <Link
                      href="/portal/mypuppy"
                      className="block p-4 rounded-2xl bg-white/70 border border-brand-200 hover:bg-white transition"
                    >
                      <div className="text-sm font-black text-brand-900">My Puppy</div>
                      <div className="mt-1 text-[12px] text-brand-500 font-semibold">
                        Profile, weight tracking, and pupdates.
                      </div>
                    </Link>

                    <Link
                      href="/portal/documents"
                      className="block p-4 rounded-2xl bg-white/70 border border-brand-200 hover:bg-white transition"
                    >
                      <div className="text-sm font-black text-brand-900">Contracts</div>
                      <div className="mt-1 text-[12px] text-brand-500 font-semibold">
                        Agreements, records, and saved documents.
                      </div>
                    </Link>

                    <Link
                      href="/portal/messages"
                      className="block p-4 rounded-2xl bg-white/70 border border-brand-200 hover:bg-white transition"
                    >
                      <div className="text-sm font-black text-brand-900">Messages</div>
                      <div className="mt-1 text-[12px] text-brand-500 font-semibold">
                        Ask about care, feeding, or anything else.
                      </div>
                    </Link>
                  </div>
                </div>

                <div className="rounded-3xl bg-brand-800 text-white p-7 shadow-luxury">
                  <h4 className="font-serif text-2xl font-bold">Need Breed Help?</h4>
                  <p className="mt-2 text-brand-200 text-sm font-semibold">
                    For questions about Chihuahua care, temperament, feeding, or health concerns, use the portal messages area so you can get guidance tied to your puppy.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href="/portal/messages"
                      className="px-5 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-black uppercase tracking-[0.18em] hover:bg-white/20 transition"
                    >
                      Message Support
                    </Link>

                    <a
                      href="https://chihuahuahq.com"
                      target="_blank"
                      rel="noreferrer"
                      className="px-5 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-black uppercase tracking-[0.18em] hover:bg-white/20 transition"
                    >
                      ChihuahuaHQ.com
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-luxury p-7">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-serif text-2xl font-bold text-brand-900">{title}</h3>
          <p className="text-brand-500 font-semibold text-sm mt-1 leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}

function FactCard({
  label,
  value,
  text,
}: {
  label: string;
  value: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-white/65 p-5">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
        {label}
      </div>
      <div className="mt-2 text-lg font-black text-brand-900">{value}</div>
      <div className="mt-2 text-sm font-semibold text-brand-600 leading-relaxed">
        {text}
      </div>
    </div>
  );
}

function InfoBox({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-white/65 p-5">
      <div className="text-base font-black text-brand-900">{title}</div>
      <div className="mt-2 text-sm font-semibold text-brand-600 leading-relaxed">
        {text}
      </div>
    </div>
  );
}

function BulletBlock({ items }: { items: string[] }) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={index}
          className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-white/65 p-4"
        >
          <div className="mt-1 h-2.5 w-2.5 rounded-full bg-brand-400 shrink-0" />
          <div className="text-sm font-semibold text-brand-700 leading-relaxed">
            {item}
          </div>
        </div>
      ))}
    </div>
  );
}

function SimpleList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-white/65 p-5">
      {title ? <div className="text-base font-black text-brand-900 mb-3">{title}</div> : null}
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className="mt-1 h-2.5 w-2.5 rounded-full bg-brand-400 shrink-0" />
            <div className="text-sm font-semibold text-brand-700 leading-relaxed">
              {item}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-white/65 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-brand-800">{value}</div>
    </div>
  );
}

function ResourcesLogin() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const login = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await sb.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error) alert(error.message);
  };

  return (
    <div className="h-screen flex items-center justify-center bg-brand-50 p-6">
      <div className="card-luxury shine p-10 w-full max-w-md border border-white">
        <h2 className="font-serif text-4xl font-bold text-center mb-8">
          Welcome Home
        </h2>

        <form onSubmit={login} className="space-y-5">
          <div>
            <label className="text-[10px] font-black uppercase text-brand-500 mb-1 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-xl border border-brand-200"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-brand-500 mb-1 block">
              Password
            </label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="w-full p-3 rounded-xl border border-brand-200"
              required
            />
          </div>

          <button className="w-full bg-brand-800 text-white p-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lift">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}