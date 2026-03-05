"use client";

import { useEffect } from 'react';
import Link from 'next/link';

export default function PoliciesPage() {
  
  // This handles the interactive "On this page" sidebar links.
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (!hash) return;
      const target = document.getElementById(hash) as HTMLDetailsElement;
      if (target && target.tagName.toLowerCase() === "details") {
        target.open = true;
        setTimeout(() => {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 50);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange(); // Check on initial load

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return (
    <main className="bg-stone-50 min-h-screen">
      
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-16 lg:pt-28 lg:pb-20 bg-gradient-to-br from-amber-50/50 via-white to-stone-50">
        <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full bg-orange-100/40 blur-3xl opacity-60 pointer-events-none"></div>
        <div className="absolute bottom-0 right-0 translate-x-1/3 translate-y-1/3 w-[700px] h-[700px] rounded-full bg-slate-200/50 blur-3xl opacity-50 pointer-events-none"></div>
        
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <div className="animate-fade-in-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50/70 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-orange-800 uppercase tracking-wide shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                </span>
                Transparent Policies
              </div>
              <h1 className="font-serif mt-8 text-5xl sm:text-6xl lg:text-7xl tracking-tight text-slate-900 leading-[1.1]">
                Clear expectations. <span className="bg-gradient-to-r from-amber-500 via-red-500 to-purple-500 bg-clip-text text-transparent italic">Better matches.</span>
              </h1>
              <p className="mt-6 text-lg lg:text-xl text-slate-600 leading-relaxed max-w-2xl">
                These policies protect our dogs, our buyers, and our reputation. We keep things straightforward:
                honest communication, respectful boundaries, and a consistent process from inquiry to go-home day.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <a href="#policySections" className="group inline-flex items-center justify-center rounded-full bg-slate-900 px-8 py-4 text-sm font-semibold text-white shadow-xl shadow-slate-900/20 hover:bg-slate-800 hover:scale-105 hover:shadow-2xl transition-all duration-300">
                  View Policies
                  <svg className="ml-2 w-4 h-4 group-hover:translate-y-[-1px] transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m0 0l-6-6m6 6l6-6"/>
                  </svg>
                </a>
                <Link href="/application" className="inline-flex items-center justify-center rounded-full border-2 border-slate-200 bg-white px-8 py-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:scale-105 transition-all duration-300">
                  Apply for a Puppy
                </Link>
              </div>
              <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="bg-white/70 backdrop-blur-md border border-white/90 rounded-2xl p-5 group shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all">
                  <div className="mb-3 h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-700 grid place-items-center shadow-sm group-hover:scale-110 transition-transform">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                  </div>
                  <div className="font-serif text-lg font-semibold text-slate-900">Simple Process</div>
                  <div className="text-sm text-slate-500 mt-1">Inquiry → Application → Deposit → Updates</div>
                </div>
                <div className="bg-white/70 backdrop-blur-md border border-white/90 rounded-2xl p-5 group shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all">
                  <div className="mb-3 h-10 w-10 rounded-xl bg-gradient-to-br from-orange-100 to-orange-200 text-orange-700 grid place-items-center shadow-sm group-hover:scale-110 transition-transform">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 8v4l3 3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="font-serif text-lg font-semibold text-slate-900">Go-Home Timing</div>
                  <div className="text-sm text-slate-500 mt-1">Standard go-home begins at 8 weeks</div>
                </div>
                <div className="bg-white/70 backdrop-blur-md border border-white/90 rounded-2xl p-5 group shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all">
                  <div className="mb-3 h-10 w-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 grid place-items-center shadow-sm group-hover:scale-110 transition-transform">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="font-serif text-lg font-semibold text-slate-900">Support</div>
                  <div className="text-sm text-slate-500 mt-1">Available for the life of the dog</div>
                </div>
              </div>
            </div>
            
            <div className="animate-fade-in-up lg:pl-6">
              <div className="relative rounded-[2rem] border border-slate-200 bg-white shadow-2xl overflow-hidden">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 h-40 w-40 rounded-full bg-gradient-to-br from-amber-50 to-orange-100 transition-all duration-700 opacity-60"></div>
                <div className="relative p-8 sm:p-10">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-400">At a Glance</div>
                  <div className="mt-2 font-serif text-3xl text-slate-900">Quick policy highlights</div>
                  <div className="mt-8 grid gap-4">
                    <div className="flex gap-4 p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all">
                      <div className="shrink-0 h-12 w-12 rounded-full bg-white border border-slate-200 grid place-items-center shadow-sm text-2xl">
                        📝
                      </div>
                      <div>
                        <div className="font-serif text-lg font-semibold text-slate-900">Applications Required</div>
                        <div className="text-sm text-slate-500 mt-1">We review each home personally before reserving.</div>
                      </div>
                    </div>
                    <div className="flex gap-4 p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all">
                      <div className="shrink-0 h-12 w-12 rounded-full bg-white border border-slate-200 grid place-items-center shadow-sm text-2xl">
                        💳
                      </div>
                      <div>
                        <div className="font-serif text-lg font-semibold text-slate-900">Deposit Reserves a Puppy</div>
                        <div className="text-sm text-slate-500 mt-1">Deposits hold your puppy and pause advertising.</div>
                      </div>
                    </div>
                    <div className="flex gap-4 p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all">
                      <div className="shrink-0 h-12 w-12 rounded-full bg-white border border-slate-200 grid place-items-center shadow-sm text-2xl">
                        🏡
                      </div>
                      <div>
                        <div className="font-serif text-lg font-semibold text-slate-900">Home-Raised Care</div>
                        <div className="text-sm text-slate-500 mt-1">We prioritize stable temperament and health.</div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-8 pt-6 border-t border-slate-100">
                    <Link href="/portal" className="group/link flex items-center justify-between text-slate-900 font-semibold hover:text-orange-600 transition-colors">
                      <span>Message us through the Puppy Portal</span>
                      <svg className="group-hover/link:translate-x-2 transition-transform" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7"></path>
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Policies Accordion Section */}
      <section id="policySections" className="py-24 bg-white relative overflow-hidden border-t border-slate-200">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-50/25 to-transparent pointer-events-none"></div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14 animate-fade-in-up">
            <span className="text-orange-600 font-semibold tracking-wider uppercase text-sm">Policies</span>
            <h2 className="mt-4 font-serif text-4xl md:text-5xl text-slate-900">Everything you should know</h2>
            <div className="mt-5 mx-auto w-20 h-1.5 bg-gradient-to-r from-orange-300 via-orange-400 to-orange-300 rounded-full"></div>
            <p className="mt-6 text-slate-600 text-lg max-w-2xl mx-auto">
              Click a topic below to expand details. Your signed Sales Agreement remains the final authority for your specific puppy.
            </p>
          </div>
          
          <div className="grid gap-10 lg:grid-cols-12">
            
            {/* Sidebar Navigation */}
            <aside className="lg:col-span-4 animate-fade-in-up">
              <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-sm sticky top-28">
                <div className="font-serif text-xl font-bold text-slate-900">On this page</div>
                <div className="mt-4 grid gap-2 text-sm">
                  <a href="#application" className="rounded-xl px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all text-slate-700">Application & Approval</a>
                  <a href="#deposits" className="rounded-xl px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all text-slate-700">Deposits & Reservations</a>
                  <a href="#pricing" className="rounded-xl px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all text-slate-700">Pricing</a>
                  <a href="#payments" className="rounded-xl px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all text-slate-700">Payments & Balance</a>
                  <a href="#goHome" className="rounded-xl px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all text-slate-700">Go-Home Age & Readiness</a>
                  <a href="#health" className="rounded-xl px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all text-slate-700">Health, Vet Care & Guarantee</a>
                  <a href="#visits" className="rounded-xl px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all text-slate-700">Visits & Biosecurity</a>
                  <a href="#pickup" className="rounded-xl px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all text-slate-700">Pickup, Delivery & Travel</a>
                  <a href="#support" className="rounded-xl px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all text-slate-700">Lifetime Support</a>
                  <a href="#ethics" className="rounded-xl px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all text-slate-700">Ethical Placement</a>
                </div>
                <div className="mt-6 rounded-2xl bg-white border border-slate-200 p-5 text-center">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-400">Fastest response?</div>
                  <div className="mt-2 font-semibold text-slate-900">Message through the Portal</div>
                  <Link href="/portal" className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-slate-800 transition-all">
                    Open Portal
                  </Link>
                </div>
              </div>
            </aside>

            {/* Accordions */}
            <div className="lg:col-span-8 space-y-4 animate-fade-in-up">
              
              {/* Application */}
              <details id="application" className="group rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden open:shadow-md transition-shadow">
                <summary className="cursor-pointer p-7 sm:p-9 flex items-start gap-4 hover:bg-slate-50/60 transition-colors list-none [&::-webkit-details-marker]:hidden">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-200 text-orange-700 flex items-center justify-center shadow-sm shrink-0">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M16 13H8" strokeLinecap="round"/>
                      <path d="M16 17H8" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-serif text-2xl sm:text-3xl font-semibold text-slate-900">Application & Approval</h3>
                        <p className="mt-2 text-slate-600 text-lg leading-relaxed">
                          We place puppies thoughtfully. Applications help us understand your lifestyle, experience, and what you’re looking for.
                        </p>
                      </div>
                      <span className="mt-1 inline-flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-600 group-open:rotate-45 transition-transform shrink-0">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
                        </svg>
                      </span>
                    </div>
                  </div>
                </summary>
                <div className="px-7 sm:px-9 pb-7 sm:pb-9">
                  <div className="grid gap-4">
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6">
                      <div className="font-semibold text-slate-900">How approvals work</div>
                      <ul className="mt-3 space-y-2 text-slate-600 leading-relaxed">
                        <li className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0"></span><span>Submit your application through our website.</span></li>
                        <li className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0"></span><span>We review each home personally and follow up with questions if needed.</span></li>
                        <li className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0"></span><span>Once approved, we can discuss current availability.</span></li>
                      </ul>
                    </div>
                    <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-orange-100/50 border border-orange-100 p-6">
                      <div className="font-semibold text-slate-900">Important note</div>
                      <p className="mt-2 text-slate-700 leading-relaxed">
                        Submitting an application does not guarantee a puppy. Our priority is always the best long-term match.
                      </p>
                    </div>
                  </div>
                </div>
              </details>

              {/* Deposits */}
              <details id="deposits" className="group rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden open:shadow-md transition-shadow">
                <summary className="cursor-pointer p-7 sm:p-9 flex items-start gap-4 hover:bg-slate-50/60 transition-colors list-none [&::-webkit-details-marker]:hidden">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-700 flex items-center justify-center shadow-sm shrink-0">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M12 1v22" strokeLinecap="round"/>
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-serif text-2xl sm:text-3xl font-semibold text-slate-900">Deposits & Reservations</h3>
                        <p className="mt-2 text-slate-600 text-lg leading-relaxed">
                          A deposit officially reserves a specific puppy and removes them from public availability.
                        </p>
                      </div>
                      <span className="mt-1 inline-flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-600 group-open:rotate-45 transition-transform shrink-0">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
                        </svg>
                      </span>
                    </div>
                  </div>
                </summary>
                <div className="px-7 sm:px-9 pb-7 sm:pb-9">
                  <div className="grid gap-4">
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6">
                      <div className="font-semibold text-slate-900">Reservation basics</div>
                      <ul className="mt-3 space-y-2 text-slate-600 leading-relaxed">
                        <li className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0"></span><span>Deposits reserve your puppy and stop advertising.</span></li>
                        <li className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0"></span><span>Deposits are typically non-refundable once a puppy is reserved.</span></li>
                      </ul>
                    </div>
                  </div>
                </div>
              </details>

              {/* Pricing */}
              <details id="pricing" className="group rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden open:shadow-md transition-shadow">
                <summary className="cursor-pointer p-7 sm:p-9 flex items-start gap-4 hover:bg-slate-50/60 transition-colors list-none [&::-webkit-details-marker]:hidden">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 flex items-center justify-center shadow-sm shrink-0">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M20 12V8H4v4" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M4 8V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" strokeLinecap="round"/>
                      <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" strokeLinecap="round"/>
                      <path d="M18 12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-serif text-2xl sm:text-3xl font-semibold text-slate-900">Pricing</h3>
                        <p className="mt-2 text-slate-600 text-lg leading-relaxed">
                          Pricing is determined by registry, sex, and the individual puppy’s qualities.
                        </p>
                      </div>
                      <span className="mt-1 inline-flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-600 group-open:rotate-45 transition-transform shrink-0">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
                        </svg>
                      </span>
                    </div>
                  </div>
                </summary>
                <div className="px-7 sm:px-9 pb-7 sm:pb-9">
                  <div className="grid gap-5">
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6">
                      <div className="font-semibold text-slate-900">How pricing is determined</div>
                      <ul className="mt-3 space-y-2 text-slate-600 leading-relaxed">
                        <li className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0"></span><span>Registry options (AKC, ACA, CKC) can affect pricing.</span></li>
                        <li className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0"></span><span>Males and females may be priced differently.</span></li>
                        <li className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0"></span><span>Rare coat colors (cream, lavender, pure white) may be higher.</span></li>
                      </ul>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex items-center gap-5 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 grid place-items-center text-slate-700 font-bold text-xl">M</div>
                        <div>
                          <div className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Males</div>
                          <div className="text-2xl font-serif font-bold text-slate-900">From $1,800</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-5 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
                        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-pink-100 to-pink-200 grid place-items-center text-slate-700 font-bold text-xl">F</div>
                        <div>
                          <div className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Females</div>
                          <div className="text-2xl font-serif font-bold text-slate-900">From $2,200</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </details>

              {/* FAQ Block */}
              <article className="rounded-3xl border border-slate-200 bg-slate-50/70 shadow-sm overflow-hidden mt-6">
                <div className="p-8 sm:p-10">
                  <div className="flex items-center justify-between gap-6 flex-wrap">
                    <div>
                      <div className="text-sm font-bold uppercase tracking-widest text-slate-400">Quick Answers</div>
                      <h3 className="mt-2 font-serif text-2xl sm:text-3xl font-semibold text-slate-900">Common policy questions</h3>
                    </div>
                    <Link href="/portal" className="group text-sm inline-flex items-center gap-2 rounded-full border-2 border-slate-200 bg-white px-6 py-3 font-medium shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all">
                      Ask in Portal
                    </Link>
                  </div>
                  <div className="mt-8 space-y-4">
                    <details className="group rounded-2xl bg-white border border-slate-200 p-6 hover:shadow-md transition-all list-none [&::-webkit-details-marker]:hidden">
                      <summary className="flex cursor-pointer items-center justify-between gap-6">
                        <span className="font-semibold text-slate-900">What age do puppies go home?</span>
                        <span className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 group-open:rotate-45 transition-transform shrink-0">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
                          </svg>
                        </span>
                      </summary>
                      <p className="mt-4 text-slate-600 leading-relaxed">
                        Our standard go-home begins at 8 weeks, provided the puppy is thriving.
                      </p>
                    </details>
                    <details className="group rounded-2xl bg-white border border-slate-200 p-6 hover:shadow-md transition-all list-none [&::-webkit-details-marker]:hidden">
                      <summary className="flex cursor-pointer items-center justify-between gap-6">
                        <span className="font-semibold text-slate-900">Can I visit before choosing a puppy?</span>
                        <span className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 group-open:rotate-45 transition-transform shrink-0">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
                          </svg>
                        </span>
                      </summary>
                      <p className="mt-4 text-slate-600 leading-relaxed">
                        For safety, visits are by appointment only. We typically begin with video calls.
                      </p>
                    </details>
                  </div>
                </div>
              </article>

            </div>
          </div>
        </div>
      </section>

      {/* Pre-Footer CTA */}
      <section className="py-24 bg-stone-50 border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-10 sm:p-12 overflow-hidden relative">
            <div className="absolute -right-20 -top-20 w-60 h-60 bg-amber-400/10 rounded-full blur-3xl"></div>
            <div className="relative grid gap-10 lg:grid-cols-12 items-center">
              <div className="lg:col-span-8">
                <h2 className="font-serif text-4xl md:text-5xl text-slate-900 leading-tight">
                  Ready to take the next step?
                </h2>
                <p className="mt-5 text-slate-600 text-lg leading-relaxed max-w-2xl">
                  If you’ve reviewed our policies and feel aligned with our program, you’re welcome to apply.
                </p>
              </div>
              <div className="lg:col-span-4 flex flex-col gap-4">
                <Link href="/application" className="inline-flex items-center justify-center rounded-full bg-slate-900 px-8 py-4 text-white font-semibold shadow-xl hover:bg-slate-800 transition-all">
                  Apply for a Puppy
                </Link>
                <Link href="/portal" className="inline-flex items-center justify-center rounded-full border-2 border-slate-200 bg-white px-8 py-4 text-slate-800 font-semibold shadow-sm hover:bg-slate-50 transition-all">
                  Login to Puppy Portal
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}