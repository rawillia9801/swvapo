import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        
        {/* Logo Section */}
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center font-black text-blue-600 text-xs text-center leading-tight">
            SWVA<br/>CHI
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tighter uppercase leading-none">
              Southwest Virginia Chihuahua
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Marion, VA</p>
          </div>
        </Link>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-8">
          <Link href="/" className="text-[11px] font-bold text-slate-600 uppercase tracking-widest hover:text-blue-600 transition-colors">Home</Link>
          <Link href="/our-dogs" className="text-[11px] font-bold text-slate-600 uppercase tracking-widest hover:text-blue-600 transition-colors">Our Dogs</Link>
          <Link href="/#puppies" className="text-[11px] font-bold text-slate-600 uppercase tracking-widest hover:text-blue-600 transition-colors">Puppies</Link>
          <Link href="/application" className="text-[11px] font-bold text-slate-600 uppercase tracking-widest hover:text-blue-600 transition-colors">Application</Link>
          <Link href="/policies" className="text-[11px] font-bold text-slate-600 uppercase tracking-widest hover:text-blue-600 transition-colors">Policies</Link>
        <Link href="/our-dogs">Our Dogs</Link>
        </div>

        {/* Action Button */}
        <Link href="/application" className="px-6 py-3 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all active:scale-95 shadow-lg shadow-slate-200">
          Apply Now
        </Link>

      </div>
    </nav>
  );
}