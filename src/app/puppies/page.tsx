"use client";

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

// Supabase Initialization
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// --- Helpers ---
const norm = (v: any) => (v ?? "").toString().trim();
const lower = (v: any) => norm(v).toLowerCase();
const pick = (obj: any, keys: string[], fallback = "") => {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "") return obj[k];
  }
  return fallback;
};

const formatMoney = (value: any) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString('en-US', { style: "currency", currency: "USD", maximumFractionDigits: 0 });
};

// Extractor Functions
const getName = (p: any) => pick(p, ["puppy_name", "call_name", "name", "title", "display_name"], "Unnamed Puppy");
const getSex = (p: any) => pick(p, ["sex", "gender"], "");
const getColor = (p: any) => pick(p, ["color", "coat_color", "color_description"], "");
const getCoat = (p: any) => pick(p, ["coat_type"], "");
const getRegistry = (p: any) => pick(p, ["registry", "registration", "registries"], "");
const getPrice = (p: any) => pick(p, ["price", "adoption_fee", "amount"], "");
const getDescription = (p: any) => pick(p, ["description", "notes", "bio", "summary"], "");
const getPhotoUrl = (p: any) => pick(p, ["photo_url", "image_url", "img", "main_photo", "primary_photo"], "");
const getStatus = (p: any) => {
  const direct = pick(p, ["status", "availability"], "");
  if (direct) return direct;
  const isAvail = pick(p, ["is_available", "available"], "");
  if (typeof isAvail === "boolean") return isAvail ? "Available" : "Reserved";
  return "";
};

// Status Badge Component (Matches your boutique style)
const StatusBadge = ({ status }: { status: string }) => {
  const s = status.toLowerCase();
  const base = "inline-flex items-center rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest border";
  if (s.includes('available')) return <span className={`${base} bg-emerald-50/90 text-emerald-800 border-emerald-200/70 backdrop-blur-sm`}>Available</span>;
  if (s.includes('reserve')) return <span className={`${base} bg-amber-50/90 text-amber-800 border-amber-200/70 backdrop-blur-sm`}>Reserved</span>;
  if (s.includes('hold')) return <span className={`${base} bg-orange-50/90 text-orange-800 border-orange-200/70 backdrop-blur-sm`}>On Hold</span>;
  if (s.includes('adopt') || s.includes('sold')) return <span className={`${base} bg-stone-100 text-stone-500 border-stone-200`}>Adopted</span>;
  return <span className={`${base} bg-stone-50 text-stone-600 border-stone-200`}>{status || "Status"}</span>;
};

export default function PuppiesPage() {
  const [puppies, setPuppies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [search, setSearch] = useState("");
  const [sex, setSex] = useState("all");
  const [status, setStatus] = useState("all");
  const [availableOnly, setAvailableOnly] = useState(true);

  const loadPuppies = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: sbError } = await supabase
        .from("puppies")
        .select("*")
        .order("created_at", { ascending: false });

      if (sbError) throw sbError;
      setPuppies(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load puppies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPuppies();
  }, []);

  // Apply Filters
  const filteredPuppies = useMemo(() => {
    return puppies.filter(p => {
      const q = lower(search);
      const sSex = lower(sex);
      const sStatus = lower(status);
      
      const pName = lower(getName(p));
      const pColor = lower(getColor(p));
      const pDesc = lower(getDescription(p));
      const pSex = lower(getSex(p));
      const pStatus = lower(getStatus(p));

      if (q) {
        const hay = `${pName} ${pColor} ${pDesc} ${pSex} ${pStatus}`;
        if (!hay.includes(q)) return false;
      }

      if (sSex !== "all" && pSex) {
        if (!pSex.includes(sSex)) return false;
      } else if (sSex !== "all" && !pSex) {
        return false;
      }

      if (sStatus !== "all") {
        const match =
          (sStatus === "available" && pStatus.includes("avail")) ||
          (sStatus === "reserved" && pStatus.includes("reserv")) ||
          (sStatus === "hold" && pStatus.includes("hold")) ||
          (sStatus === "adopted" && pStatus.includes("adopt")) ||
          (sStatus === "expected" && pStatus.includes("expect"));
        if (!match) return false;
      }

      if (availableOnly) {
        if (!pStatus.includes("avail")) return false;
      }

      return true;
    });
  }, [puppies, search, sex, status, availableOnly]);

  const clearFilters = () => {
    setSearch("");
    setSex("all");
    setStatus("all");
    setAvailableOnly(true);
  };

  return (
    <div className="bg-stone-50 min-h-screen">
      {/* Hero & Filters Section */}
      <section className="relative overflow-hidden pt-18 pb-12 lg:pt-24 lg:pb-16 bg-gradient-to-br from-amber-50/50 via-white to-stone-50">
        <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full bg-orange-100/40 blur-3xl opacity-60"></div>
        <div className="absolute bottom-0 right-0 translate-x-1/3 translate-y-1/3 w-[700px] h-[700px] rounded-full bg-slate-200/50 blur-3xl opacity-50"></div>
        
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="animate-fade-in-up text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50/70 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-orange-800 uppercase tracking-wide shadow-sm">
              Available & Upcoming Puppies
            </div>
            <h1 className="font-serif mt-6 text-5xl sm:text-6xl tracking-tight text-slate-900 leading-[1.1]">
              Meet your next <span className="bg-gradient-to-r from-amber-500 via-red-500 to-purple-500 bg-clip-text text-transparent italic">best friend.</span>
            </h1>
            <p className="mt-5 text-lg text-slate-600 max-w-3xl leading-relaxed mx-auto lg:mx-0">
              Below are our current listings pulled live from our database. Use the filters to find the perfect addition to your family.
            </p>

            {/* Filters Bar */}
            <div className="mt-10 bg-white/60 backdrop-blur-md border border-slate-200/60 p-6 rounded-3xl shadow-sm text-left">
              <div className="grid gap-4 lg:grid-cols-12 items-end">
                <div className="lg:col-span-5">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Search</label>
                  <input 
                    type="text" 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, color, notes..."
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-200" 
                  />
                </div>
                <div className="lg:col-span-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Sex</label>
                  <select 
                    value={sex}
                    onChange={(e) => setSex(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                  >
                    <option value="all">All</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div className="lg:col-span-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Status</label>
                  <select 
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      if (e.target.value !== "available" && e.target.value !== "all") {
                        setAvailableOnly(false); 
                      }
                    }}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                  >
                    <option value="all">All</option>
                    <option value="available">Available</option>
                    <option value="reserved">Reserved</option>
                    <option value="hold">On Hold</option>
                    <option value="adopted">Adopted</option>
                  </select>
                </div>
                <div className="lg:col-span-1 flex items-center justify-start lg:justify-center pb-4">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={availableOnly}
                      onChange={(e) => setAvailableOnly(e.target.checked)}
                      className="h-5 w-5 rounded border-slate-300 text-amber-500 focus:ring-amber-200" 
                    />
                    <span className="text-sm font-semibold text-slate-700">Available</span>
                  </label>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3 items-center pt-5 border-t border-slate-100">
                <button onClick={loadPuppies} className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-slate-200 transition-colors">
                  Refresh
                </button>
                <button onClick={clearFilters} className="px-6 py-2.5 border-2 border-slate-200 bg-white text-slate-700 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-slate-50 transition-colors">
                  Clear
                </button>
                <span className="ml-auto inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white shadow-sm">
                  {loading ? "Loading…" : `${filteredPuppies.length} result${filteredPuppies.length === 1 ? "" : "s"}`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Grid Section - Using Your Boutique Cards */}
      <section className="py-14 bg-white min-h-[400px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {error && (
            <div className="mb-8 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center">
              <div className="font-semibold text-rose-900">Couldn’t load puppy listings</div>
              <div className="mt-2 text-rose-800 text-sm">{error}</div>
            </div>
          )}

          {/* Loading Skeletons */}
          {loading && !error && (
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
                  <div className="aspect-square rounded-2xl bg-slate-50 animate-pulse mb-6"></div>
                  <div className="h-6 w-1/2 bg-slate-50 rounded mx-auto mb-3 animate-pulse"></div>
                  <div className="h-4 w-3/4 bg-slate-50 rounded mx-auto mb-6 animate-pulse"></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-12 bg-slate-50 rounded-2xl animate-pulse"></div>
                    <div className="h-12 bg-slate-50 rounded-2xl animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filteredPuppies.length === 0 && (
            <div className="mt-10 rounded-[3rem] border-2 border-dashed border-slate-200 bg-slate-50 p-16 text-center">
              <div className="text-6xl mb-4" aria-hidden="true">🐶</div>
              <div className="font-serif text-3xl text-slate-900 mb-3">No puppies match your filters</div>
              <p className="mt-3 text-slate-600">Try clearing filters or switching status to "All".</p>
              <button onClick={clearFilters} className="mt-8 inline-flex items-center justify-center rounded-full bg-slate-900 px-8 py-4 text-xs font-bold uppercase tracking-widest text-white shadow-lg hover:bg-slate-800 hover:scale-105 transition-all">
                Clear Filters
              </button>
            </div>
          )}

          {/* Boutique Puppy Cards */}
          {!loading && !error && filteredPuppies.length > 0 && (
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPuppies.map((puppy, idx) => {
                const pName = getName(puppy);
                const pSex = getSex(puppy) || "—";
                const pColor = getColor(puppy) || "—";
                const pCoat = getCoat(puppy);
                const pStatus = getStatus(puppy) || "—";
                const pPrice = getPrice(puppy);
                const pPhoto = getPhotoUrl(puppy);

                return (
                  <article key={puppy.id || idx} className="bg-gradient-to-br from-white to-stone-50 border border-slate-200/60 shadow-md rounded-[2.5rem] p-8 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 flex flex-col">
                    
                    {/* Image Block */}
                    <div className="aspect-square rounded-[2rem] overflow-hidden bg-slate-50 border border-slate-100 mb-6 relative group">
                      {pPhoto ? (
                        <img src={pPhoto} alt={pName} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">🐶</div>
                      )}
                      <div className="absolute top-4 right-4">
                        <StatusBadge status={pStatus} />
                      </div>
                    </div>

                    {/* Info Block */}
                    <div className="mb-6 text-center">
                      <h3 className="font-serif text-3xl font-bold text-slate-900 truncate mb-2">
                        {pName}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">
                        {pSex} • {pCoat ? `${pCoat} • ` : ''}{pColor}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-auto mb-5">
                      <Link href={`/puppies/${puppy.id}`} className="flex items-center justify-center bg-slate-900 text-white px-4 py-3.5 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors">
                        View Profile
                      </Link>
                      <Link href="/application" className="flex items-center justify-center border border-slate-200 bg-white text-slate-900 px-4 py-3.5 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-colors">
                        Apply
                      </Link>
                    </div>

                    {pPrice && (
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">
                        Price: {formatMoney(pPrice)}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Pre-Footer CTA */}
      <section className="py-20 bg-stone-50 border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[3rem] bg-white border border-slate-200 shadow-sm p-10 sm:p-16 overflow-hidden relative text-center">
            <div className="absolute -right-20 -top-20 w-60 h-60 bg-amber-400/10 rounded-full blur-3xl"></div>
            <div className="relative">
              <h2 className="font-serif text-4xl md:text-5xl text-slate-900 leading-tight mb-6">
                Ready to welcome your new companion?
              </h2>
              <p className="text-slate-600 text-lg leading-relaxed max-w-2xl mx-auto mb-10">
                The fastest way to move forward is to submit an application. Once you’re approved, we’ll guide you through deposit and go-home planning.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/application" className="inline-flex items-center justify-center rounded-full bg-slate-900 px-10 py-4 text-xs font-bold uppercase tracking-widest text-white shadow-xl hover:bg-slate-800 hover:scale-105 transition-all">
                  Apply for a Puppy
                </Link>
                <Link href="/policies" className="inline-flex items-center justify-center rounded-full border-2 border-slate-200 bg-white px-10 py-4 text-xs font-bold uppercase tracking-widest text-slate-800 shadow-sm hover:bg-slate-50 hover:scale-105 transition-all">
                  Read Policies
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}