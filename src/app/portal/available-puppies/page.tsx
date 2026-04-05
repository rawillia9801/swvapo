"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PortalPuppy } from "@/lib/portal-data";
import { shouldHidePublicPuppyPrice } from "@/lib/lineage";
import {
  publicPuppyAgeLabel,
  publicPuppyCoat,
  publicPuppyColor,
  publicPuppyDescription,
  publicPuppyName,
  publicPuppyPhotoUrl,
  publicPuppyPrice,
  publicPuppyRegistry,
  publicPuppySex,
  publicPuppyStatus,
  publicPuppyStatusLabel,
} from "@/lib/public-puppy-listing";
import { fmtDate, fmtMoney, sb } from "@/lib/utils";

function statusClass(statusRaw: string) {
  const status = statusRaw.toLowerCase();
  if (status.includes("available")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status.includes("reserved")) return "border-amber-200 bg-amber-50 text-amber-700";
  if (status.includes("hold")) return "border-stone-200 bg-stone-100 text-stone-700";
  if (status.includes("expected")) return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-stone-200 bg-stone-100 text-stone-700";
}

export default function AvailablePuppiesPage() {
  const [puppies, setPuppies] = useState<PortalPuppy[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [search, setSearch] = useState("");
  const [sexFilter, setSexFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [selected, setSelected] = useState<PortalPuppy | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setErrorText("");
      const { data, error } = await sb.from("puppies").select("*").order("created_at", { ascending: false });
      if (!active) return;
      if (error) {
        setErrorText(error.message || "Could not load puppy listings.");
        setPuppies([]);
      } else {
        setPuppies(Array.isArray(data) ? (data as PortalPuppy[]) : []);
      }
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function onEsc(event: KeyboardEvent) {
      if (event.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  const filtered = useMemo(() => {
    return puppies.filter((puppy) => {
      const status = publicPuppyStatus(puppy).toLowerCase();
      const sex = publicPuppySex(puppy).toLowerCase();
      const haystack = [
        publicPuppyName(puppy),
        publicPuppyColor(puppy),
        publicPuppyDescription(puppy),
        publicPuppySex(puppy),
        publicPuppyStatus(puppy),
      ]
        .map((value) => value.toLowerCase())
        .join(" ");

      if (search.trim() && !haystack.includes(search.trim().toLowerCase())) return false;
      if (sexFilter !== "all" && !sex.includes(sexFilter)) return false;
      if (statusFilter !== "all" && !status.includes(statusFilter)) return false;
      if (availableOnly && !status.includes("available")) return false;
      return true;
    });
  }, [availableOnly, puppies, search, sexFilter, statusFilter]);

  const selectedPrice = selected ? publicPuppyPrice(selected) : null;
  const selectedPriceHidden = shouldHidePublicPuppyPrice(selected?.status);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fbf8f3_0%,#f3ebdf_100%)]">
      <section className="border-b border-[#ead9c7] bg-[radial-gradient(circle_at_top_left,#fff8ef_0%,#fffdfa_46%,#f2e8db_100%)]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full border border-[#ead8c1] bg-white/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-[#9e7446]">
              Buyer Portal Listings
            </div>
            <h1 className="mt-6 font-serif text-4xl font-bold tracking-tight text-[#2f2218] sm:text-5xl">
              Available and upcoming puppies.
            </h1>
            <p className="mt-4 text-base leading-7 text-[#72553c]">
              Browse the current listings connected to our live breeder records. Reserved and completed puppies still appear when appropriate, but their pricing stays private.
            </p>
          </div>

          <div className="mt-10 rounded-[28px] border border-[#ead9c7] bg-white/88 p-5 shadow-[0_18px_40px_rgba(106,76,45,0.08)]">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_220px_220px_auto]">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, color, notes, or status..." className="rounded-[18px] border border-[#e4d3c2] bg-[#fffdfa] px-4 py-3 text-sm text-[#3e2a1f] outline-none transition focus:border-[#c8a884]" />
              <select value={sexFilter} onChange={(event) => setSexFilter(event.target.value)} className="rounded-[18px] border border-[#e4d3c2] bg-[#fffdfa] px-4 py-3 text-sm text-[#3e2a1f] outline-none transition focus:border-[#c8a884]"><option value="all">All sexes</option><option value="male">Male</option><option value="female">Female</option></select>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-[18px] border border-[#e4d3c2] bg-[#fffdfa] px-4 py-3 text-sm text-[#3e2a1f] outline-none transition focus:border-[#c8a884]"><option value="all">All statuses</option><option value="available">Available</option><option value="expected">Expected</option><option value="reserved">Reserved</option><option value="completed">Completed</option></select>
              <label className="inline-flex items-center gap-3 rounded-[18px] border border-[#e4d3c2] bg-[#fffdfa] px-4 py-3 text-sm font-semibold text-[#5d4330]"><input type="checkbox" checked={availableOnly} onChange={(event) => setAvailableOnly(event.target.checked)} className="h-4 w-4 rounded border-[#d0b290] text-[#9f6331] focus:ring-[#d0b290]" />Available only</label>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {loading ? (
          <div className="rounded-[28px] border border-[#ead9c7] bg-white px-6 py-16 text-center text-sm font-semibold text-[#72553c] shadow-[0_18px_40px_rgba(106,76,45,0.08)]">Loading puppy listings...</div>
        ) : errorText ? (
          <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-16 text-center text-sm font-semibold text-rose-700">{errorText}</div>
        ) : filtered.length ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((puppy) => {
              const status = publicPuppyStatus(puppy);
              const price = publicPuppyPrice(puppy);
              const priceHidden = shouldHidePublicPuppyPrice(status);
              const photoUrl = publicPuppyPhotoUrl(puppy);
              return (
                <button
                  key={puppy.id}
                  type="button"
                  onClick={() => setSelected(puppy)}
                  className="overflow-hidden rounded-[30px] border border-[#ead9c7] bg-white text-left shadow-[0_18px_48px_rgba(106,76,45,0.08)] transition hover:-translate-y-1 hover:shadow-[0_26px_60px_rgba(106,76,45,0.12)]"
                >
                  <div className="relative h-72 bg-[#f6ede1]">
                    {photoUrl ? <Image src={photoUrl} alt={publicPuppyName(puppy)} fill className="object-cover" sizes="(max-width: 1280px) 100vw, 33vw" /> : <div className="flex h-full items-center justify-center text-sm font-semibold text-[#8a6a49]">Photo coming soon</div>}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-2xl font-semibold text-[#2f2218]">{publicPuppyName(puppy)}</div>
                        <div className="mt-2 text-sm text-[#8a6a49]">{[publicPuppySex(puppy), publicPuppyColor(puppy), publicPuppyCoat(puppy)].filter(Boolean).join(" • ") || "Southwest Virginia Chihuahua"}</div>
                      </div>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusClass(status)}`}>{publicPuppyStatusLabel(status)}</span>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-3">
                      <InfoTile label="Price" value={priceHidden ? "Private" : price ? fmtMoney(price) : "TBD"} />
                      <InfoTile label="Age" value={publicPuppyAgeLabel(puppy) || "Young puppy"} />
                      <InfoTile label="Registry" value={publicPuppyRegistry(puppy) || "N/A"} />
                    </div>
                    <p className="mt-5 line-clamp-3 text-sm leading-6 text-[#6f5440]">{publicPuppyDescription(puppy) || "Open this listing to see more details and next steps."}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[28px] border border-[#ead9c7] bg-white px-6 py-16 text-center shadow-[0_18px_40px_rgba(106,76,45,0.08)]">
            <div className="text-xl font-semibold text-[#2f2218]">No puppies match the current filters.</div>
            <p className="mt-3 text-sm leading-6 text-[#72553c]">Try widening the filters or check back soon for upcoming litters.</p>
          </div>
        )}
      </section>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2f2218]/45 px-4 py-8 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="max-h-full w-full max-w-4xl overflow-hidden rounded-[32px] border border-[#ead9c7] bg-white shadow-[0_30px_80px_rgba(47,34,24,0.22)]" onClick={(event) => event.stopPropagation()}>
            <div className="grid lg:grid-cols-[1fr_420px]">
              <div className="relative min-h-[320px] bg-[#f6ede1]">
                {publicPuppyPhotoUrl(selected) ? <Image src={publicPuppyPhotoUrl(selected)} alt={publicPuppyName(selected)} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" /> : <div className="flex h-full items-center justify-center text-sm font-semibold text-[#8a6a49]">Photo coming soon</div>}
              </div>
              <div className="flex max-h-[80vh] flex-col overflow-y-auto p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-3xl font-semibold text-[#2f2218]">{publicPuppyName(selected)}</div>
                    <div className="mt-2 text-sm text-[#8a6a49]">{[publicPuppySex(selected), publicPuppyColor(selected), publicPuppyCoat(selected)].filter(Boolean).join(" • ")}</div>
                  </div>
                  <button type="button" onClick={() => setSelected(null)} className="rounded-full border border-[#ead9c7] px-3 py-2 text-sm font-semibold text-[#72553c]">Close</button>
                </div>
                <div className="mt-5 flex flex-wrap gap-2"><span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusClass(publicPuppyStatus(selected))}`}>{publicPuppyStatusLabel(publicPuppyStatus(selected))}</span><span className="inline-flex rounded-full border border-[#ead9c7] bg-[#fffaf4] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9c7043]">{selectedPriceHidden ? "Price private" : selectedPrice ? fmtMoney(selectedPrice) : "Price on request"}</span></div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <InfoTile label="Age" value={publicPuppyAgeLabel(selected) || "Young puppy"} />
                  <InfoTile label="Registry" value={publicPuppyRegistry(selected) || "N/A"} />
                  <InfoTile label="Status" value={publicPuppyStatusLabel(publicPuppyStatus(selected))} />
                  <InfoTile label="Created" value={selected.created_at ? fmtDate(selected.created_at) : "Recent listing"} />
                </div>
                <div className="mt-5 text-sm leading-7 text-[#6f5440]">{publicPuppyDescription(selected) || "Contact us for more details about this puppy."}</div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/portal/apply" className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(159,99,49,0.22)]">Start Application</Link>
                  <Link href="/portal/messages" className="inline-flex items-center rounded-2xl border border-[#ead9c7] bg-white px-4 py-3 text-sm font-semibold text-[#5d4330]">Ask a Question</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InfoTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-[#ead9c7] bg-[#fffaf4] px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9c7043]">{label}</div>
      <div className="mt-2 text-sm font-semibold text-[#2f2218]">{value}</div>
    </div>
  );
}
