"use client";

import Link from 'next/link';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
        
        {/* Logo & Brand Name */}
        <Link href="/" className="flex items-center gap-3 group">
          {/* Logo image - let it flow naturally without a strict square box */}
          <div className="h-10 flex items-center justify-center">
            <img 
              src="https://www.swvachihuahua.com/logo.png" // Put your exact logo URL here
              alt="SWVA Chihuahua Logo" 
              className="h-full w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<span class="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded">SWVA CHI</span>';
              }}
            />
          </div>
          <div className="flex flex-col justify-center">
            <span className="font-black text-lg md:text-xl tracking-tighter text-slate-900 uppercase leading-none">
              Southwest Virginia Chihuahua
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">
              Marion, VA
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-8">
          <Link href="/" className="text-[11px] font-bold text-slate-500 hover:text-slate-900 uppercase tracking-widest transition-colors">Home</Link>
          <Link href="/our-dogs" className="text-[11px] font-bold text-slate-500 hover:text-slate-900 uppercase tracking-widest transition-colors">Our Dogs</Link>
          <Link href="/puppies" className="text-[11px] font-bold text-slate-500 hover:text-slate-900 uppercase tracking-widest transition-colors">Puppies</Link>
          <Link href="/application" className="text-[11px] font-bold text-slate-500 hover:text-slate-900 uppercase tracking-widest transition-colors">Application</Link>
          <Link href="/policies" className="text-[11px] font-bold text-slate-500 hover:text-slate-900 uppercase tracking-widest transition-colors">Policies</Link>
        </nav>

        {/* CTA Button */}
        <div className="hidden lg:block">
          <Link href="/application" className="px-7 py-3 bg-[#0f172a] text-white rounded-full text-[10px] font-black uppercase tracking-[0.15em] hover:bg-slate-800 transition-colors shadow-md">
            Apply Now
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button className="lg:hidden p-2 text-slate-600">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    </header>
  );
}