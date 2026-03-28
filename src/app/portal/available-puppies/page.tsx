// FILE: app/available-puppies/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { sb, buildPuppyPhotoUrl, fmtDate, fmtMoney } from "@/lib/utils";

type PuppyRow = {
  id: number;
  created_at?: string | null;
  call_name?: string | null;
  name?: string | null;
  puppy_name?: string | null;
  sex?: string | null;
  gender?: string | null;
  color?: string | null;
  coat_type?: string | null;
  coat?: string | null;
  pattern?: string | null;
  dob?: string | null;
  birth_date?: string | null;
  registry?: string | null;
  registration?: string | null;
  status?: string | null;
  availability?: string | null;
  price?: number | null;
  adoption_fee?: number | null;
  amount?: number | null;
  description?: string | null;
  notes?: string | null;
  bio?: string | null;
  summary?: string | null;
  photo_url?: string | null;
  image_url?: string | null;
  photo?: string | null;
  image?: string | null;
  photos?: any;
  images?: any;
  gallery?: any;
  photo_urls?: any;
  image_urls?: any;
  media?: any;
  pics?: any;
};

function normalize(v: any) {
  return String(v ?? "").trim();
}

function lower(v: any) {
  return normalize(v).toLowerCase();
}

function pick<T = any>(obj: any, keys: string[], fallback: T): T {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "") {
      return obj[k];
    }
  }
  return fallback;
}

function getName(p: PuppyRow) {
  return pick<string>(p, ["call_name", "name", "puppy_name"], "Unnamed Puppy");
}

function getSex(p: PuppyRow) {
  return pick<string>(p, ["sex", "gender"], "");
}

function getColor(p: PuppyRow) {
  return pick<string>(p, ["color"], "");
}

function getCoatType(p: PuppyRow) {
  return pick<string>(p, ["coat_type", "coat"], "");
}

function getDob(p: PuppyRow) {
  return pick<string>(p, ["dob", "birth_date"], "");
}

function getRegistry(p: PuppyRow) {
  return pick<string>(p, ["registry", "registration"], "");
}

function getStatus(p: PuppyRow) {
  const direct = pick<string>(p, ["status", "availability"], "");
  return direct || "";
}

function getPrice(p: PuppyRow) {
  const value = pick<any>(p, ["price", "adoption_fee", "amount"], null);
  return value;
}

function getDescription(p: PuppyRow) {
  return pick<string>(p, ["description", "notes", "bio", "summary"], "");
}

function getPhotoUrl(p: PuppyRow) {
  const direct = pick<string>(
    p,
    ["photo_url", "image_url", "photo", "image"],
    ""
  );

  if (direct) {
    if (String(direct).startsWith("http")) return direct;
    return buildPuppyPhotoUrl(direct);
  }

  const arrayFields = ["photos", "images", "gallery", "photo_urls", "image_urls", "media", "pics"];

  for (const field of arrayFields) {
    const val = (p as any)[field];

    if (Array.isArray(val) && val.length) {
      const first = normalize(val[0]);
      if (first) {
        return first.startsWith("http") ? first : buildPuppyPhotoUrl(first);
      }
    }

    if (typeof val === "string" && val.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed) && parsed.length) {
          const first = normalize(parsed[0]);
          if (first) {
            return first.startsWith("http") ? first : buildPuppyPhotoUrl(first);
          }
        }
      } catch {}
    }
  }

  return "";
}

function statusLabel(raw: string) {
  const s = lower(raw);
  if (!s) return "—";
  if (s.includes("avail")) return "Available";
  if (s.includes("reserv")) return "Reserved";
  if (s.includes("hold")) return "On Hold";
  if (s.includes("adopt")) return "Adopted";
  if (s.includes("expect")) return "Expected";
  return raw;
}

function statusPill(raw: string) {
  const s = lower(raw);

  if (s.includes("avail")) {
    return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  }
  if (s.includes("reserv")) {
    return "bg-amber-50 text-amber-700 border border-amber-200";
  }
  if (s.includes("hold")) {
    return "bg-stone-100 text-stone-700 border border-stone-200";
  }
  if (s.includes("adopt")) {
    return "bg-rose-50 text-rose-700 border border-rose-200";
  }
  if (s.includes("expect")) {
    return "bg-blue-50 text-blue-700 border border-blue-200";
  }

  return "bg-stone-100 text-stone-700 border border-stone-200";
}

function ageLabel(dob: string) {
  if (!dob) return "";
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - birth.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const weeks = Math.floor(diffDays / 7);

  if (weeks < 1) return `${diffDays} day${diffDays === 1 ? "" : "s"} old`;
  return `${weeks} week${weeks === 1 ? "" : "s"} old`;
}

export default function AvailablePuppiesPage() {
  const [puppies, setPuppies] = useState<PuppyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [search, setSearch] = useState("");
  const [sexFilter, setSexFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [selected, setSelected] = useState<PuppyRow | null>(null);

  async function loadPuppies() {
    setLoading(true);
    setErrorText("");

    const { data, error } = await sb
      .from("puppies")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorText(error.message || "Could not load puppy listings.");
      setPuppies([]);
      setLoading(false);
      return;
    }

    setPuppies(Array.isArray(data) ? (data as PuppyRow[]) : []);
    setLoading(false);
  }

  useEffect(() => {
    void loadPuppies();
  }, []);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setSelected(null);
    }

    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  const filtered = useMemo(() => {
    return puppies.filter((p) => {
      const q = lower(search);
      const name = lower(getName(p));
      const color = lower(getColor(p));
      const desc = lower(getDescription(p));
      const sex = lower(getSex(p));
      const status = lower(getStatus(p));

      if (q) {
        const haystack = `${name} ${color} ${desc} ${sex} ${status}`;
        if (!haystack.includes(q)) return false;
      }

      if (sexFilter !== "all") {
        if (!sex.includes(sexFilter)) return false;
      }

      if (statusFilter !== "all") {
        const match =
          (statusFilter === "available" && status.includes("avail")) ||
          (statusFilter === "reserved" && status.includes("reserv")) ||
          (statusFilter === "hold" && status.includes("hold")) ||
          (statusFilter === "adopted" && status.includes("adopt")) ||
          (statusFilter === "expected" && status.includes("expect"));

        if (!match) return false;
      }

      if (availableOnly && !status.includes("avail")) return false;

      return true;
    });
  }, [puppies, search, sexFilter, statusFilter, availableOnly]);

  const selectedPhoto = selected ? getPhotoUrl(selected) : "";
  const selectedPrice = selected ? getPrice(selected) : null;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[30px] border border-[#d7c7b6] bg-white shadow-[0_14px_40px_rgba(61,39,22,0.08)]">
        <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="bg-[linear-gradient(135deg,#8f6945_0%,#6f5037_100%)] px-6 py-7 text-white md:px-8 md:py-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/85">
              <span>Available & Upcoming Puppies</span>
            </div>

            <h1 className="mt-5 font-serif text-3xl font-bold leading-[0.95] md:text-5xl">
              Meet your next best friend.
            </h1>

            <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-white/82 md:text-[15px]">
              We are expecting our next litter mid June. At this time, we do not
              currently have any available puppies, but interested buyers are welcome
              to join our Wait List below.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="https://forms.zoho.com/southwestvirginiachihuahua/form/WaitListSignUpForm"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl bg-[#d6ab73] px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-[#24180f] transition hover:bg-[#dfba87]"
              >
                Join Our Wait List
              </a>

              <Link
                href="/portal/application"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/18 bg-white/10 px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/14"
              >
                View Application
              </Link>
            </div>
          </div>

          <div className="bg-[#f7f1ea] p-6 md:p-8">
            <div className="rounded-[28px] border border-[#e3d3c2] bg-white p-6 shadow-sm">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9a7854]">
                Wait List Update
              </div>
              <h2 className="mt-3 font-serif text-3xl font-bold leading-tight text-[#3b271b]">
                Next litter expected mid June
              </h2>
              <p className="mt-4 text-sm font-semibold leading-7 text-[#8b6b4d]">
                We currently do not have any available puppies. If you would like to be
                contacted about upcoming availability, please join our Wait List.
              </p>

              <div className="mt-6 flex flex-col gap-3">
                <a
                  href="https://forms.zoho.com/southwestvirginiachihuahua/form/WaitListSignUpForm"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-2xl bg-[#8f6945] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#7d5b3c]"
                >
                  Join Our Wait List
                </a>

                <Link
                  href="/portal/application"
                  className="inline-flex items-center justify-center rounded-2xl border border-[#dccab7] bg-[#fcf8f3] px-5 py-3 text-sm font-semibold text-[#6f5037] transition hover:bg-white"
                >
                  View Application
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-[#dccab7] bg-white p-6 shadow-[0_12px_28px_rgba(74,51,33,0.06)] md:p-7">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:items-end">
          <div className="xl:col-span-5">
            <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, color, notes..."
              className="w-full rounded-[20px] border border-[#e4d5c4] bg-[#fffdfb] px-4 py-3.5 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]"
            />
          </div>

          <div className="xl:col-span-3">
            <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
              Sex
            </label>
            <select
              value={sexFilter}
              onChange={(e) => setSexFilter(e.target.value)}
              className="w-full rounded-[20px] border border-[#e4d5c4] bg-[#fffdfb] px-4 py-3.5 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]"
            >
              <option value="all">All</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <div className="xl:col-span-3">
            <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-[20px] border border-[#e4d5c4] bg-[#fffdfb] px-4 py-3.5 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]"
            >
              <option value="all">All</option>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="hold">On Hold</option>
              <option value="adopted">Adopted</option>
              <option value="expected">Expected</option>
            </select>
          </div>

          <div className="xl:col-span-1">
            <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
              Filter
            </label>
            <label className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[20px] border border-[#e4d5c4] bg-[#fffdfb] px-4 text-sm font-semibold text-[#6b4d33]">
              <input
                type="checkbox"
                checked={availableOnly}
                onChange={(e) => setAvailableOnly(e.target.checked)}
                className="h-4 w-4 rounded border-[#ccb79f]"
              />
              Available
            </label>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={() => void loadPuppies()}
            className="inline-flex items-center justify-center rounded-2xl bg-[#8f6945] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#7d5b3c]"
          >
            Refresh
          </button>

          <a
            href="https://forms.zoho.com/southwestvirginiachihuahua/form/WaitListSignUpForm"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-2xl border border-[#dccab7] bg-[#fcf8f3] px-5 py-3 text-sm font-semibold text-[#6f5037] transition hover:bg-white"
          >
            Join Our Wait List
          </a>

          <button
            onClick={() => {
              setSearch("");
              setSexFilter("all");
              setStatusFilter("all");
              setAvailableOnly(true);
            }}
            className="inline-flex items-center justify-center rounded-2xl border border-[#dccab7] bg-white px-5 py-3 text-sm font-semibold text-[#6f5037] transition hover:bg-[#fcf8f3]"
          >
            Clear Filters
          </button>

          <span className="ml-auto inline-flex items-center rounded-full border border-[#e1cfbb] bg-[#fcf8f3] px-4 py-2 text-sm font-semibold text-[#7f5f42]">
            {loading ? "Loading…" : `${filtered.length} result${filtered.length === 1 ? "" : "s"}`}
          </span>
        </div>

        {errorText ? (
          <div className="mt-6 rounded-[24px] border border-rose-200 bg-rose-50 p-5">
            <div className="text-sm font-black text-rose-800">
              Couldn’t load puppy listings
            </div>
            <div className="mt-2 text-sm font-semibold text-rose-700">{errorText}</div>
            <div className="mt-3 text-xs text-rose-600">
              This usually means the public read policy is blocked, or the table name does not match.
            </div>
          </div>
        ) : null}
      </section>

      {loading ? (
        <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="overflow-hidden rounded-[30px] border border-[#dccab7] bg-white p-5 shadow-[0_12px_28px_rgba(74,51,33,0.06)]"
            >
              <div className="h-52 animate-pulse rounded-[22px] bg-[#efe4d8]" />
              <div className="mt-4 h-5 w-2/3 animate-pulse rounded bg-[#efe4d8]" />
              <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-[#efe4d8]" />
              <div className="mt-4 h-12 w-full animate-pulse rounded-[18px] bg-[#efe4d8]" />
            </div>
          ))}
        </section>
      ) : filtered.length ? (
        <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((puppy) => {
            const name = getName(puppy);
            const sex = getSex(puppy) || "—";
            const color = getColor(puppy) || "—";
            const dob = getDob(puppy);
            const status = getStatus(puppy);
            const price = getPrice(puppy);
            const photoUrl = getPhotoUrl(puppy);
            const age = ageLabel(dob);

            return (
              <button
                key={puppy.id}
                type="button"
                onClick={() => setSelected(puppy)}
                className="overflow-hidden rounded-[30px] border border-[#dccab7] bg-white p-5 text-left shadow-[0_12px_28px_rgba(74,51,33,0.06)] transition hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(74,51,33,0.12)]"
              >
                <div className="relative h-56 overflow-hidden rounded-[22px] border border-[#e5d7c8] bg-[#fcf8f3]">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-center text-[#9e8164]">
                      <div>
                        <div className="text-sm font-semibold">Photo coming soon</div>
                        <div className="mt-1 text-xs">Southwest Virginia Chihuahua</div>
                      </div>
                    </div>
                  )}

                  <div className="absolute left-3 top-3">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${statusPill(status)}`}
                    >
                      {statusLabel(status)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-serif text-2xl font-bold leading-tight text-[#342116]">
                      {name}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[#8d6f52]">
                      {sex} • {color}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
                      Price
                    </div>
                    <div className="mt-1 text-sm font-black text-[#342116]">
                      {price ? fmtMoney(price) : "—"}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {dob ? (
                    <span className="inline-flex items-center rounded-full border border-[#e1cfbb] bg-[#fcf8f3] px-3 py-1 text-[11px] font-semibold text-[#7f5f42]">
                      DOB: {fmtDate(dob)}
                    </span>
                  ) : null}

                  {age ? (
                    <span className="inline-flex items-center rounded-full border border-[#e1cfbb] bg-[#fcf8f3] px-3 py-1 text-[11px] font-semibold text-[#7f5f42]">
                      {age}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 inline-flex w-full items-center justify-center rounded-[18px] bg-[#8f6945] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#7d5b3c]">
                  View Puppy
                </div>
              </button>
            );
          })}
        </section>
      ) : (
        <section className="rounded-[30px] border border-[#dccab7] bg-white p-10 text-center shadow-[0_12px_28px_rgba(74,51,33,0.06)]">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#dcc8b2] bg-[#fcf8f3] text-2xl shadow-sm">
            🐾
          </div>
          <h2 className="font-serif text-3xl font-bold text-[#3b271b]">
            No puppies are currently available
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-7 text-[#8b6b4d]">
            We are expecting our next litter mid June. If you would like to be
            notified about upcoming puppies, please join our Wait List.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://forms.zoho.com/southwestvirginiachihuahua/form/WaitListSignUpForm"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-2xl bg-[#8f6945] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#7d5b3c]"
            >
              Join Our Wait List
            </a>

            <button
              onClick={() => {
                setSearch("");
                setSexFilter("all");
                setStatusFilter("all");
                setAvailableOnly(true);
              }}
              className="inline-flex items-center justify-center rounded-2xl border border-[#dccab7] bg-[#fcf8f3] px-5 py-3 text-sm font-semibold text-[#6f5037] transition hover:bg-white"
            >
              Clear Filters
            </button>
          </div>
        </section>
      )}

      <section className="rounded-[30px] border border-[#dccab7] bg-white p-8 shadow-[0_12px_28px_rgba(74,51,33,0.06)] md:p-10">
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.2fr_0.8fr] xl:items-center">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9a7854]">
              Wait List
            </div>
            <h2 className="mt-3 font-serif text-3xl font-bold leading-tight text-[#3b271b] md:text-4xl">
              Want to be first to know about upcoming puppies?
            </h2>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[#8b6b4d] md:text-[15px]">
              We are currently expecting our next litter mid June. Since we do not have
              any available puppies right now, the best next step is to join our Wait
              List so we can reach out when availability opens.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <a
              href="https://forms.zoho.com/southwestvirginiachihuahua/form/WaitListSignUpForm"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-2xl bg-[#8f6945] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#7d5b3c]"
            >
              Join Our Wait List
            </a>

            <Link
              href="/portal/policies"
              className="inline-flex items-center justify-center rounded-2xl border border-[#dccab7] bg-[#fcf8f3] px-6 py-3.5 text-sm font-semibold text-[#6f5037] transition hover:bg-white"
            >
              Read Policies
            </Link>
          </div>
        </div>
      </section>

      {selected ? (
        <div className="fixed inset-0 z-[80]">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />
          <div className="relative mx-auto flex h-full max-w-6xl items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
            <div className="max-h-[88vh] w-full overflow-auto rounded-[32px] border border-[#dccab7] bg-white shadow-[0_28px_70px_rgba(45,28,16,0.26)]">
              <div className="flex items-start justify-between gap-6 border-b border-[#eadfce] px-6 py-6 sm:px-8">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9a7854]">
                    Puppy Details
                  </div>
                  <div className="mt-1 font-serif text-3xl font-bold text-[#3b271b]">
                    {getName(selected)}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-[#8b6b4d]">
                    {getSex(selected) || "—"} • {getColor(selected) || "—"}
                  </div>
                </div>

                <button
                  onClick={() => setSelected(null)}
                  className="rounded-2xl border border-[#dccab7] bg-[#fcf8f3] px-4 py-2.5 text-sm font-semibold text-[#6f5037] transition hover:bg-white"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-8 px-6 py-6 sm:px-8 lg:grid-cols-12">
                <div className="lg:col-span-5">
                  <div className="h-72 overflow-hidden rounded-[26px] border border-[#e5d7c8] bg-[#fcf8f3]">
                    {selectedPhoto ? (
                      <img
                        src={selectedPhoto}
                        alt={getName(selected)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-[#9e8164]">
                        <span className="text-sm">No photo uploaded yet</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-[22px] border border-[#e5d7c8] bg-[#fcf9f5] p-4">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
                        Status
                      </div>
                      <div className="mt-1 text-sm font-black text-[#342116]">
                        {statusLabel(getStatus(selected))}
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-[#e5d7c8] bg-[#fcf9f5] p-4">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
                        Price
                      </div>
                      <div className="mt-1 text-sm font-black text-[#342116]">
                        {selectedPrice ? fmtMoney(selectedPrice) : "—"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7">
                  <div className="rounded-[26px] border border-[#e5d7c8] bg-white p-6">
                    <div className="text-lg font-black text-[#342116]">Overview</div>
                    <div className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-7 text-[#5b4331]">
                      {getDescription(selected) || "No additional description has been added yet."}
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      <DetailCard label="Sex" value={getSex(selected) || "—"} />
                      <DetailCard label="Color" value={getColor(selected) || "—"} />
                      <DetailCard label="DOB" value={getDob(selected) ? fmtDate(getDob(selected)) : "—"} />
                      <DetailCard label="Registry" value={getRegistry(selected) || "—"} />
                      <DetailCard label="Coat Type" value={getCoatType(selected) || "—"} />
                      <DetailCard label="Pattern" value={selected.pattern || "—"} />
                    </div>

                    <div className="mt-7 flex flex-wrap gap-3">
                      <Link
                        href="/portal/application"
                        className="inline-flex items-center justify-center rounded-2xl bg-[#8f6945] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#7d5b3c]"
                      >
                        Apply for this Puppy
                      </Link>

                      <Link
                        href="/portal/policies"
                        className="inline-flex items-center justify-center rounded-2xl border border-[#dccab7] bg-[#fcf8f3] px-6 py-3 text-sm font-semibold text-[#6f5037] transition hover:bg-white"
                      >
                        Read Policies
                      </Link>
                    </div>

                    <div className="mt-4 text-xs text-[#9e8164]">
                      Listings update live. If something changes quickly, we’ll confirm directly.
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start justify-between gap-4 border-t border-[#eadfce] bg-[#fcf8f3] px-6 py-5 text-sm text-[#8b6b4d] sm:px-8 md:flex-row md:items-center">
                <div>Questions? Use the Puppy Portal for the fastest response.</div>

                <Link
                  href="/portal"
                  className="inline-flex items-center justify-center rounded-2xl border border-[#dccab7] bg-white px-5 py-3 font-semibold text-[#6f5037] transition hover:bg-[#fffaf4]"
                >
                  Open Portal
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[#e5d7c8] bg-[#fcf9f5] p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
        {label}
      </div>
      <div className="mt-1 text-sm font-black text-[#342116]">{value}</div>
    </div>
  );
}