import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 px-6 py-4 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-center text-xs font-black leading-tight text-blue-600">
            SWVA
            <br />
            CHI
          </div>

          <div>
            <h1 className="text-lg font-black uppercase leading-none tracking-tighter text-slate-900">
              Southwest Virginia Chihuahua
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Marion, VA
            </p>
          </div>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link
            href="/"
            className="text-[11px] font-bold uppercase tracking-widest text-slate-600 transition-colors hover:text-blue-600"
          >
            Home
          </Link>

          <Link
            href="/our-dogs"
            className="text-[11px] font-bold uppercase tracking-widest text-slate-600 transition-colors hover:text-blue-600"
          >
            Our Dogs
          </Link>

          <Link
            href="/#puppies"
            className="text-[11px] font-bold uppercase tracking-widest text-slate-600 transition-colors hover:text-blue-600"
          >
            Puppies
          </Link>

          <Link
            href="/application"
            className="text-[11px] font-bold uppercase tracking-widest text-slate-600 transition-colors hover:text-blue-600"
          >
            Application
          </Link>

          <Link
            href="/policies"
            className="text-[11px] font-bold uppercase tracking-widest text-slate-600 transition-colors hover:text-blue-600"
          >
            Policies
          </Link>

          <a
            href="https://portal.swvachihuahua.com"
            className="text-[11px] font-bold uppercase tracking-widest text-slate-600 transition-colors hover:text-blue-600"
          >
            Puppy Portal
          </a>
        </div>

        <Link
          href="/application"
          className="rounded-full bg-slate-900 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-slate-200 transition-all hover:bg-blue-600 active:scale-95"
        >
          Apply Now
        </Link>
      </div>
    </nav>
  );
}