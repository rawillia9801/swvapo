import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function OurDogsPage() {
  const { data: dogs, error } = await supabase
    .from('bp_dogs') 
    .select('dog_name, call_name, role, sex, color, coat, registry, is_active')
    .order('dog_name', { ascending: true }); 

  if (error) {
    return (
      <div className="p-20 text-center">
        <h2 className="text-2xl font-black text-slate-900 uppercase italic">Database Sync Error</h2>
        <p className="text-red-500 font-bold mt-2">{error.message}</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#fcfcfc]">
      <section className="py-24 text-center bg-white border-b border-slate-100 shadow-sm">
        <h1 className="text-7xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
          Our <span className="text-blue-600">Breeding</span> Program
        </h1>
        <p className="mt-4 text-slate-400 font-bold tracking-[0.3em] text-[10px] uppercase text-center">
          Championship Lineage • Health Tested • Excellence
        </p>
      </section>

      <section className="max-w-7xl mx-auto py-20 px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {dogs?.map((dog, index) => {
            const isSire = dog.role?.toLowerCase() === 'sire';
            
            return (
              <div key={index} className="group relative bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl">
                
                <div className="relative h-80 bg-slate-100 overflow-hidden border-b border-slate-50 flex items-center justify-center">
                   <div className="text-slate-300 italic text-sm font-medium">Photo Pending</div>
                   <span className={`absolute bottom-6 left-8 px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-lg ${isSire ? 'bg-blue-600 text-white border-blue-500' : 'bg-rose-50 text-white border-rose-400'}`}>
                    {dog.role}
                   </span>
                </div>

                <div className="p-10 pt-8">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h3 className="text-4xl font-black text-slate-900 italic uppercase tracking-tighter leading-none">
                        {dog.dog_name}
                      </h3>
                      {dog.call_name && (
                        <p className="text-blue-600 text-base font-bold italic mt-1 uppercase tracking-tight">
                          "{dog.call_name}"
                        </p>
                      )}
                    </div>
                    {dog.is_active && (
                      <span className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span> Active
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-4 mb-10">
                    <div className="flex justify-between border-b border-slate-50 pb-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">Coat Type</span>
                      <span className="text-[11px] font-black text-slate-900 uppercase">{dog.coat || 'Standard'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 pb-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">Color</span>
                      <span className="text-[11px] font-black text-slate-900 uppercase">{dog.color}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 pb-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">Registry</span>
                      <span className="text-[11px] font-black text-slate-900 uppercase">{dog.registry || 'AKC'}</span>
                    </div>
                  </div>

                  <button className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all hover:bg-blue-600 hover:tracking-[0.3em] active:scale-95 shadow-xl shadow-slate-100 text-center">
                    View Full Pedigree
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}