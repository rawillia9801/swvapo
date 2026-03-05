import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import Footer from '@/components/Footer';

// Supabase Initialization
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Helper for formatting currency
const formatMoney = (val: number | null) => {
  if (!val) return '—';
  return val.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
};

// Helper for status badges
const StatusBadge = ({ status }: { status: string }) => {
  const s = status.toLowerCase();
  const base = "inline-flex items-center rounded-full px-4 py-1.5 text-xs font-bold uppercase border";
  if (s.includes('available')) return <span className={`${base} bg-emerald-50 text-emerald-800 border-emerald-200`}>Available</span>;
  if (s.includes('reserve')) return <span className={`${base} bg-amber-50 text-amber-800 border-amber-200`}>Reserved</span>;
  if (s.includes('hold')) return <span className={`${base} bg-orange-50 text-orange-800 border-orange-200`}>On Hold</span>;
  if (s.includes('adopt') || s.includes('sold')) return <span className={`${base} bg-stone-100 text-stone-500 border-stone-200`}>Adopted</span>;
  return <span className={`${base} bg-stone-50 text-stone-600 border-stone-200`}>{status || "Status"}</span>;
};

export default async function HomePage() {
  // Fetch available puppies directly on the server
  const { data: puppies, error } = await supabase
    .from('puppies')
    .select('id, puppy_name, call_name, sex, color, coat_type, registry, price, status, photo_url, description')
    .eq('status', 'Available')
    .order('created_at', { ascending: false });

  return (
    <main className="min-h-screen bg-stone-50 font-sans antialiased scroll-smooth">
      
  
      {/* Notice Banner */}
      <div className="bg-amber-50 border-b border-amber-200 py-3">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">🚧</span>
            <div>
              <p className="text-sm font-bold text-stone-900">Pardon our progress — we're updating our website.</p>
              <p className="text-xs text-stone-600">Please bear with us. Thank you for your patience!</p>
            </div>
          </div>
          <button className="px-4 py-2 bg-white border border-amber-200 rounded-xl text-xs font-bold hover:bg-amber-50 focus:outline-none focus:ring-4 focus:ring-amber-500/25">
            Dismiss
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-b from-amber-50/30 to-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            
            <div className="animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 rounded-full text-xs font-bold uppercase text-amber-900 mb-6">
                <span className="h-2 w-2 bg-amber-500 rounded-full animate-pulse" aria-hidden="true"></span>
                Virginia's Premier Chihuahua Breeder
              </div>
              <h1 className="font-serif text-6xl font-bold text-stone-900 leading-tight mb-6">
                Chihuahua puppies, raised like family
                <span className="italic text-stone-600 font-normal block mt-2">from day one.</span>
              </h1>
              <p className="text-xl text-stone-600 leading-relaxed mb-6">
                Southwest Virginia's premier home-raised Chihuahua program — focused on stable temperaments, strong foundations, and family-ready companions.
              </p>
              <div className="bg-stone-50 border-l-4 border-amber-500 p-6 rounded-lg mb-8">
                <p className="text-stone-700">
                  We offer <strong>ACA, AKC, and CKC</strong> puppies. Our breeding dogs are <strong>genetically tested</strong>, ensuring healthy futures.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <a href="#ourPuppies" className="px-10 py-4 bg-stone-900 text-white rounded-full font-semibold shadow-xl hover:bg-stone-800 text-center">
                  View Available Puppies
                </a>
                <Link href="/policies" className="px-10 py-4 bg-white border-2 border-stone-300 text-stone-700 rounded-full font-semibold hover:bg-stone-50 text-center">
                  Our Policies
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-6 pt-8 border-t border-stone-200">
                <div className="text-center">
                  <div className="font-serif font-bold text-3xl text-stone-900">Family</div>
                  <div className="text-xs text-stone-500 uppercase mt-1">Not a kennel</div>
                </div>
                <div className="text-center">
                  <div className="font-serif font-bold text-3xl text-stone-900">Health</div>
                  <div className="text-xs text-stone-500 uppercase mt-1">Genetic Testing</div>
                </div>
                <div className="text-center">
                  <div className="font-serif font-bold text-3xl text-stone-900">Support</div>
                  <div className="text-xs text-stone-500 uppercase mt-1">Lifetime Care</div>
                </div>
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="bg-gradient-to-br from-white to-stone-50 border border-stone-200/60 shadow-xl rounded-3xl p-8 hover:-translate-y-1 transition-transform duration-300">
                <h2 className="font-serif text-4xl text-stone-900 mb-4">Our Philosophy</h2>
                <p className="text-stone-600 text-lg leading-relaxed mb-8">
                  We focus on what matters: sound structure, stable temperaments, and responsible health planning. Our puppies are raised <strong>inside our home</strong>, handled daily, and loved fiercely.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-stone-200">
                    <div className="text-3xl" aria-hidden="true">🏡</div>
                    <div>
                      <div className="font-bold text-stone-900">Home-Raised Routine</div>
                      <div className="text-sm text-stone-500">Indoor family life, gentle handling.</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-stone-200">
                    <div className="text-3xl" aria-hidden="true">🧠</div>
                    <div>
                      <div className="font-bold text-stone-900">Socialization Checklist</div>
                      <div className="text-sm text-stone-500">Rigorous multi-point exposure.</div>
                    </div>
                  </div>
                </div>
                <Link href="/application" className="block mt-8 py-4 bg-stone-900 text-white text-center rounded-2xl font-bold hover:bg-stone-800">
                  Start Application
                </Link>
              </div>
            </div>
            
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="py-8 bg-white border-y border-stone-200">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-stone-50 rounded-2xl p-6 text-center border border-stone-200">
            <div className="text-3xl mb-2" aria-hidden="true">✓</div>
            <div className="font-bold text-stone-900 text-sm">Health Tested</div>
            <div className="text-xs text-stone-500 mt-1">Genetic screening</div>
          </div>
          <div className="bg-stone-50 rounded-2xl p-6 text-center border border-stone-200">
            <div className="text-3xl mb-2" aria-hidden="true">🏆</div>
            <div className="font-bold text-stone-900 text-sm">AKC Registered</div>
            <div className="text-xs text-stone-500 mt-1">Quality breeding</div>
          </div>
          <div className="bg-stone-50 rounded-2xl p-6 text-center border border-stone-200">
            <div className="text-3xl mb-2" aria-hidden="true">💝</div>
            <div className="font-bold text-stone-900 text-sm">Lifetime Support</div>
            <div className="text-xs text-stone-500 mt-1">Always here to help</div>
          </div>
          <div className="bg-stone-50 rounded-2xl p-6 text-center border border-stone-200">
            <div className="text-3xl mb-2" aria-hidden="true">🏠</div>
            <div className="font-bold text-stone-900 text-sm">Home Raised</div>
            <div className="text-xs text-stone-500 mt-1">Family environment</div>
          </div>
        </div>
      </section>

      {/* Available Puppies Section */}
      <section id="ourPuppies" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-serif text-5xl text-stone-900 mb-4">Available Puppies</h2>
            <p className="text-stone-600 text-lg">Live listings from our available litters</p>
          </div>

          {/* Render the Grid from Supabase Data */}
          {puppies && puppies.length > 0 ? (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {puppies.map((puppy) => (
                <article key={puppy.id} className="bg-gradient-to-br from-white to-stone-50 border border-stone-200/60 shadow-md rounded-3xl p-6 hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
                  
                  {/* Image Block */}
                  <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 mb-4 relative">
                    {puppy.photo_url ? (
                      <img src={puppy.photo_url} alt={puppy.puppy_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">🐶</div>
                    )}
                    <div className="absolute top-3 right-3">
                      <StatusBadge status={puppy.status || 'Available'} />
                    </div>
                  </div>

                  {/* Info Block */}
                  <div className="mb-4">
                    <h3 className="font-serif text-2xl font-bold text-stone-900 truncate">
                      {puppy.puppy_name || 'Unnamed Puppy'}
                    </h3>
                    <p className="text-sm text-stone-500 mt-1 font-medium">
                      {puppy.sex} • {puppy.color}
                    </p>
                  </div>

                  <p className="text-sm text-stone-500 leading-relaxed line-clamp-3 mb-5">
                    {puppy.description || "A beautiful, home-raised companion waiting for their family."}
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3 mt-auto">
                    <button className="flex-1 bg-stone-900 text-white px-5 py-3 rounded-2xl font-bold hover:bg-stone-800 transition-colors">
                      View Profile
                    </button>
                    <Link href="/application" className="flex-1 text-center border-2 border-stone-200 text-stone-900 px-5 py-3 rounded-2xl font-bold hover:bg-stone-50 transition-colors">
                      Apply
                    </Link>
                  </div>

                  {puppy.price && (
                    <div className="mt-4 text-xs text-stone-400 font-bold uppercase tracking-widest text-center">
                      Price: {formatMoney(puppy.price)}
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-10 rounded-3xl border-2 border-dashed border-stone-200 p-16 text-center">
              <div className="text-6xl mb-4" aria-hidden="true">🐶</div>
              <div className="font-serif text-3xl text-stone-900 mb-3">No puppies found</div>
              <p className="text-stone-500 text-lg">Our nursery is currently resting. Check back soon!</p>
            </div>
          )}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-stone-50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="font-serif text-5xl text-stone-900 mb-4">FAQ</h2>
            <p className="text-stone-500 text-lg">Everything you need to know</p>
          </div>
          <div className="space-y-4">
            <details className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm" open>
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
                <h3 className="font-serif text-2xl font-bold text-stone-900">When do puppies go home?</h3>
                <span className="h-10 w-10 rounded-full bg-stone-100 flex items-center justify-center font-bold text-stone-600">+</span>
              </summary>
              <p className="mt-4 text-stone-600 leading-relaxed text-lg">
                Typically at <strong>8 weeks old</strong>. They must be eating solid food well and maintaining a steady weight before release.
              </p>
            </details>
            <details className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
                <h3 className="font-serif text-2xl font-bold text-stone-900">How do you handle potty training?</h3>
                <span className="h-10 w-10 rounded-full bg-stone-100 flex items-center justify-center font-bold text-stone-600">+</span>
              </summary>
              <p className="mt-4 text-stone-600 leading-relaxed text-lg">
                We start early with <strong>designated potty areas</strong> to instill the concept of a clean sleeping area.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-stone-900 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-serif text-5xl mb-6">Ready to welcome your new companion?</h2>
          <p className="text-xl text-stone-300 mb-10">Start your journey with a healthy, home-raised Chihuahua puppy today.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#ourPuppies" className="px-10 py-4 bg-white text-stone-900 rounded-full font-bold hover:bg-stone-100">
              Browse Puppies
            </a>
            <Link href="/application" className="px-10 py-4 border-2 border-white text-white rounded-full font-bold hover:bg-white hover:text-stone-900">
              Apply Now
            </Link>
          </div>
        </div>
      </section>

      {/* 2. THE FOOTER IS ACTIVATED HERE */}
      <Footer />

    </main>
  );
}