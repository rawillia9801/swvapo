import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-100 pt-16 pb-8 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          
          {/* Brand Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 border border-slate-200 rounded-lg flex items-center justify-center font-serif text-[10px] text-slate-400">
                SWVA
              </div>
              <div>
                <h3 className="text-md font-serif text-slate-800 tracking-tight">
                  Southwest Virginia Chihuahua
                </h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest">Marion, VA</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-[240px]">
              Dedicated to the betterment of the breed through health testing and family-centered raising.
            </p>
          </div>

          {/* Menu Column */}
          <div>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">Menu</h4>
            <ul className="space-y-3 text-xs text-slate-600">
              <li><Link href="/" className="hover:text-blue-600 transition-colors">Available Puppies</Link></li>
              <li><Link href="/application" className="hover:text-blue-600 transition-colors">Application</Link></li>
              <li><Link href="/policies" className="hover:text-blue-600 transition-colors">Policies</Link></li>
              <li><Link href="/portal" className="hover:text-blue-600 transition-colors">Portal</Link></li>
              <li><Link href="/puplift" className="hover:text-blue-600 transition-colors">PupLift</Link></li>
            </ul>
          </div>

          {/* Contact Column */}
          <div>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">Contact</h4>
            <ul className="space-y-3 text-xs text-slate-600">
              <li>Marion, VA</li>
              <li>276-378-0100</li>
            </ul>
          </div>

          {/* Note Column */}
          <div>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">Note</h4>
            <p className="text-xs text-slate-500 italic leading-relaxed">
              We reserve the right to refuse service for puppy safety.
            </p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-50 flex flex-col md:row justify-between items-center gap-4">
          <p className="text-[10px] text-slate-400">© 2026 Southwest Virginia Chihuahua</p>
          <p className="text-[10px] text-slate-400 flex items-center gap-1">
            Built with <span className="text-rose-400">♥</span> for our puppies
          </p>
        </div>
      </div>
    </footer>
  );
}