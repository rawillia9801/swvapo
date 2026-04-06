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
import { fmtMoney } from "@/lib/utils";

function statusClass(statusRaw: string) {
  const status = statusRaw.toLowerCase();
  if (status.includes("available")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status.includes("reserved")) return "border-amber-200 bg-amber-50 text-amber-700";
  if (status.includes("hold")) return "border-stone-200 bg-stone-100 text-stone-700";
  if (status.includes("expected")) return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-stone-200 bg-stone-100 text-stone-700";
}

export default function PuppiesPage() {
  const [puppies, setPuppies] = useState<PortalPuppy[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [search, setSearch] = useState("");
  const [sexFilter, setSexFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [availableOnly, setAvailableOnly] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setErrorText("");
      try {
        const response = await fetch("/api/public/puppies");
        const payload = (await response.json()) as {
          ok?: boolean;
          error?: string;
          puppies?: PortalPuppy[];
        };

        if (!active) return;

        if (!response.ok || payload.ok === false) {
          setErrorText(payload.error || "Could not load puppies.");
          setPuppies([]);
        } else {
          setPuppies(Array.isArray(payload.puppies) ? payload.puppies : []);
        }
      } catch (error) {
        if (!active) return;
        setErrorText(error instanceof Error ? error.message : "Could not load puppies.");
        setPuppies([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const filteredPuppies = useMemo(() => {
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

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fbf8f3_0%,#f5ede3_100%)]">
      <section className="relative overflow-hidden border-b border-[#ead9c7] bg-[radial-gradient(circle_at_top_left,#fff7ee_0%,#fffdfa_44%,#f2e9dd_100%)]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full border border-[#ead8c1] bg-white/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-[#9e7446]">
              Available & Upcoming Puppies
            </div>
            <h1 className="mt-6 font-serif text-4xl font-bold tracking-tight text-[#2f2218] sm:text-5xl">
              Meet your next best friend.
            </h1>
            <p className="mt-4 text-base leading-7 text-[#72553c]">
              Browse our current puppy listings pulled directly from the live records used by our breeder portal.
            </p>
          </div>

          <div className="mt-10 rounded-[28px] border border-[#ead9c7] bg-white/88 p-5 shadow-[0_18px_40px_rgba(106,76,45,0.08)]">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_220px_220px_auto]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, color, notes, or status..."
                className="rounded-[18px] border border-[#e4d3c2] bg-[#fffdfa] px-4 py-3 text-sm text-[#3e2a1f] outline-none transition focus:border-[#c8a884]"
              />
              <select
                value={sexFilter}
                onChange={(event) => setSexFilter(event.target.value)}
                className="rounded-[18px] border border-[#e4d3c2] bg-[#fffdfa] px-4 py-3 text-sm text-[#3e2a1f] outline-none transition focus:border-[#c8a884]"
              >
                <option value="all">All sexes</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-[18px] border border-[#e4d3c2] bg-[#fffdfa] px-4 py-3 text-sm text-[#3e2a1f] outline-none transition focus:border-[#c8a884]"
              >
                <option value="all">All statuses</option>
                <option value="available">Available</option>
                <option value="expected">Expected</option>
                <option value="reserved">Reserved</option>
                <option value="completed">Completed</option>
              </select>
              <label className="inline-flex items-center gap-3 rounded-[18px] border border-[#e4d3c2] bg-[#fffdfa] px-4 py-3 text-sm font-semibold text-[#5d4330]">
                <input
                  type="checkbox"
                  checked={availableOnly}
                  onChange={(event) => setAvailableOnly(event.target.checked)}
                  className="h-4 w-4 rounded border-[#d0b290] text-[#9f6331] focus:ring-[#d0b290]"
                />
                Available only
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {loading ? (
          <div className="rounded-[28px] border border-[#ead9c7] bg-white px-6 py-16 text-center text-sm font-semibold text-[#72553c] shadow-[0_18px_40px_rgba(106,76,45,0.08)]">
            Loading puppies...
          </div>
        ) : errorText ? (
          <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-16 text-center text-sm font-semibold text-rose-700">
            {errorText}
          </div>
        ) : filteredPuppies.length ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredPuppies.map((puppy) => {
              const status = publicPuppyStatus(puppy);
              const price = publicPuppyPrice(puppy);
              const priceHidden = shouldHidePublicPuppyPrice(status);
              const photoUrl = publicPuppyPhotoUrl(puppy);
              const description = publicPuppyDescription(puppy);
              return (
                <article
                  key={puppy.id}
                  className="overflow-hidden rounded-[30px] border border-[#ead9c7] bg-white shadow-[0_18px_48px_rgba(106,76,45,0.08)]"
                >
                  <div className="relative h-72 bg-[#f6ede1]">
                    {photoUrl ? (
                      <Image src={photoUrl} alt={publicPuppyName(puppy)} fill className="object-cover" sizes="(max-width: 1280px) 100vw, 33vw" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm font-semibold text-[#8a6a49]">
                        Photo coming soon
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-2xl font-semibold text-[#2f2218]">{publicPuppyName(puppy)}</h2>
                        <div className="mt-2 text-sm text-[#8a6a49]">
                          {[publicPuppySex(puppy), publicPuppyColor(puppy), publicPuppyCoat(puppy)].filter(Boolean).join(" • ") || "Southwest Virginia Chihuahua"}
                        </div>
                      </div>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusClass(status)}`}>
                        {publicPuppyStatusLabel(status)}
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-3">
                      <InfoTile label="Price" value={priceHidden ? "Private" : price ? fmtMoney(price) : "TBD"} />
                      <InfoTile label="Age" value={publicPuppyAgeLabel(puppy) || "Young puppy"} />
                      <InfoTile label="Registry" value={publicPuppyRegistry(puppy) || "N/A"} />
                    </div>

                    <p className="mt-5 line-clamp-3 text-sm leading-6 text-[#6f5440]">
                      {description || "Reach out if you would like to learn more about this puppy."}
                    </p>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <Link
                        href="/portal/available-puppies"
                        className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(159,99,49,0.22)]"
                      >
                        Open Buyer Listing
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[28px] border border-[#ead9c7] bg-white px-6 py-16 text-center shadow-[0_18px_40px_rgba(106,76,45,0.08)]">
            <div className="text-xl font-semibold text-[#2f2218]">No puppies match the current filters.</div>
            <p className="mt-3 text-sm leading-6 text-[#72553c]">
              Try widening the filters or check back soon for upcoming litters.
            </p>
          </div>
        )}
      </section>
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
