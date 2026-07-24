"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Heart,
  Loader2,
  PawPrint,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type { PortalPuppy } from "@/lib/portal-data";
import { shouldHidePublicPuppyPrice } from "@/lib/lineage";
import {
  publicPuppyAgeLabel,
  publicPuppyCoat,
  publicPuppyColor,
  publicPuppyDescription,
  publicPuppyIsFeatured,
  publicPuppyName,
  publicPuppyPhotoUrl,
  publicPuppyPrice,
  publicPuppyRegistry,
  publicPuppySex,
  publicPuppyStatus,
  publicPuppyStatusLabel,
} from "@/lib/public-puppy-listing";
import { fmtDate, fmtMoney } from "@/lib/utils";

type DetailTab = "overview" | "lineage" | "next";

const favoritesStorageKey = "swvapo-puppy-favorites";

function statusClass(statusRaw: string) {
  const status = statusRaw.toLowerCase();
  if (status.includes("available")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status.includes("reserved")) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (status.includes("hold")) {
    return "border-[var(--portal-border)] bg-[var(--portal-surface-muted)] text-[var(--portal-text-soft)]";
  }
  if (status.includes("expected") || status.includes("upcoming")) {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  return "border-[var(--portal-border)] bg-[var(--portal-surface-muted)] text-[var(--portal-text-soft)]";
}

function isAvailableStatus(statusRaw: string) {
  return statusRaw.toLowerCase().includes("available");
}

export default function AvailablePuppiesPage() {
  const [puppies, setPuppies] = useState<PortalPuppy[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [search, setSearch] = useState("");
  const [sexFilter, setSexFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("available");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [favoritesReady, setFavoritesReady] = useState(false);
  const [selected, setSelected] = useState<PortalPuppy | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setErrorText("");

      try {
        const response = await fetch("/api/public/puppies", {
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          ok?: boolean;
          error?: string;
          puppies?: PortalPuppy[];
        };

        if (!response.ok || payload.ok === false) {
          setErrorText(payload.error || "Could not load puppy listings.");
          setPuppies([]);
          return;
        }

        setPuppies(Array.isArray(payload.puppies) ? payload.puppies : []);
      } catch (error) {
        if (controller.signal.aborted) return;
        setErrorText(
          error instanceof Error
            ? error.message
            : "Could not load puppy listings.",
        );
        setPuppies([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(favoritesStorageKey);
      const parsed = stored ? (JSON.parse(stored) as unknown) : [];
      if (Array.isArray(parsed)) {
        setFavoriteIds(
          parsed
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value)),
        );
      }
    } catch {
      setFavoriteIds([]);
    } finally {
      setFavoritesReady(true);
    }
  }, []);

  useEffect(() => {
    if (!favoritesReady) return;
    window.localStorage.setItem(
      favoritesStorageKey,
      JSON.stringify(favoriteIds),
    );
  }, [favoriteIds, favoritesReady]);

  useEffect(() => {
    function onEsc(event: KeyboardEvent) {
      if (event.key === "Escape") setSelected(null);
    }

    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

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

      if (query && !haystack.includes(query)) return false;
      if (sexFilter !== "all" && !sex.includes(sexFilter)) return false;
      if (
        statusFilter !== "all" &&
        !(
          statusFilter === "expected" &&
          (status.includes("expected") || status.includes("upcoming"))
        ) &&
        !status.includes(statusFilter)
      ) {
        return false;
      }
      if (favoritesOnly && !favoriteIds.includes(puppy.id)) return false;
      return true;
    });
  }, [favoriteIds, favoritesOnly, puppies, search, sexFilter, statusFilter]);

  const availabilityCount = puppies.filter((puppy) =>
    isAvailableStatus(publicPuppyStatus(puppy)),
  ).length;
  const upcomingCount = puppies.filter((puppy) => {
    const status = publicPuppyStatus(puppy).toLowerCase();
    return status.includes("expected") || status.includes("upcoming");
  }).length;

  function toggleFavorite(puppyId: number) {
    setFavoriteIds((current) =>
      current.includes(puppyId)
        ? current.filter((id) => id !== puppyId)
        : [...current, puppyId],
    );
  }

  function openDetails(puppy: PortalPuppy) {
    setSelected(puppy);
    setDetailTab("overview");
  }

  return (
    <div className="space-y-5 pb-8">
      <section className="portal-command-surface relative overflow-hidden rounded-[2rem] px-6 py-8 md:px-8 md:py-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[var(--portal-gold-soft)] blur-3xl" />
        <div className="portal-metal-line absolute inset-x-16 top-0 h-px" />

        <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
          <div>
            <div className="portal-kicker">Live breeder listings</div>
            <h1 className="mt-4 max-w-3xl font-serif text-4xl font-bold tracking-[-0.05em] text-[var(--portal-accent-deep)] md:text-5xl">
              Meet the puppies in our current program.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--portal-text-soft)] md:text-base">
              These profiles come directly from the breeder&apos;s live puppy
              records. Save favorites on this device, review family-line
              details, and begin an application when the right puppy feels like
              home.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <HeroMetric label="Available" value={String(availabilityCount)} />
            <HeroMetric label="Upcoming" value={String(upcomingCount)} />
            <HeroMetric label="Saved" value={String(favoriteIds.length)} />
          </div>
        </div>
      </section>

      <section className="premium-card rounded-[1.5rem] p-4 md:p-5">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_180px_190px_auto]">
          <label className="relative block">
            <span className="sr-only">Search puppy listings</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--portal-text-muted)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, color, coat, or status"
              className="w-full rounded-[16px] border border-[var(--portal-border)] bg-white/94 py-3 pl-11 pr-4 text-sm text-[var(--portal-text)] outline-none transition placeholder:text-[var(--portal-text-muted)] focus:border-[var(--portal-accent)] focus:ring-4 focus:ring-[var(--portal-ring)]"
            />
          </label>

          <select
            value={sexFilter}
            onChange={(event) => setSexFilter(event.target.value)}
            aria-label="Filter by sex"
            className="rounded-[16px] border border-[var(--portal-border)] bg-white/94 px-4 py-3 text-sm text-[var(--portal-text)] outline-none focus:border-[var(--portal-accent)] focus:ring-4 focus:ring-[var(--portal-ring)]"
          >
            <option value="all">All sexes</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter by status"
            className="rounded-[16px] border border-[var(--portal-border)] bg-white/94 px-4 py-3 text-sm text-[var(--portal-text)] outline-none focus:border-[var(--portal-accent)] focus:ring-4 focus:ring-[var(--portal-ring)]"
          >
            <option value="available">Available now</option>
            <option value="expected">Expected</option>
            <option value="reserved">Reserved</option>
            <option value="all">All public listings</option>
          </select>

          <button
            type="button"
            onClick={() => setFavoritesOnly((current) => !current)}
            aria-pressed={favoritesOnly}
            className={[
              "inline-flex items-center justify-center gap-2 rounded-[16px] border px-4 py-3 text-sm font-semibold transition",
              favoritesOnly
                ? "border-[var(--portal-accent)] bg-[var(--portal-accent)] text-white"
                : "border-[var(--portal-border)] bg-white/94 text-[var(--portal-text)] hover:border-[var(--portal-border-strong)]",
            ].join(" ")}
          >
            <Heart
              className={`h-4 w-4 ${favoritesOnly ? "fill-current" : ""}`}
            />
            Saved
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--portal-border)] pt-4">
          <div className="flex items-center gap-2 text-sm text-[var(--portal-text-soft)]">
            <PawPrint className="h-4 w-4 text-[var(--portal-accent)]" />
            {loading
              ? "Loading breeder records…"
              : `${filtered.length} matching ${filtered.length === 1 ? "puppy" : "puppies"}`}
          </div>
          <Link
            href="/portal/application"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--portal-accent-strong)]"
          >
            Start an application
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section>
        {loading ? (
          <div className="premium-card flex min-h-80 items-center justify-center rounded-[1.5rem] text-sm font-semibold text-[var(--portal-text-soft)]">
            <Loader2 className="mr-3 h-5 w-5 animate-spin text-[var(--portal-accent)]" />
            Loading current puppy listings…
          </div>
        ) : errorText ? (
          <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-6 py-16 text-center">
            <div className="text-lg font-semibold text-rose-800">
              Listings could not be loaded.
            </div>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-rose-700">
              {errorText}
            </p>
          </div>
        ) : filtered.length ? (
          <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {filtered.map((puppy) => (
              <PuppyCard
                key={puppy.id}
                puppy={puppy}
                favorite={favoriteIds.includes(puppy.id)}
                onToggleFavorite={() => toggleFavorite(puppy.id)}
                onOpen={() => openDetails(puppy)}
              />
            ))}
          </div>
        ) : (
          <div className="premium-card rounded-[1.5rem] px-6 py-16 text-center">
            <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--portal-gold-soft)] text-[var(--portal-accent)]">
              <PawPrint className="h-6 w-6" />
            </div>
            <div className="mt-5 font-serif text-2xl font-bold text-[var(--portal-accent-deep)]">
              No puppies match these filters.
            </div>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--portal-text-soft)]">
              Widen the filters, clear your search, or check back as new puppy
              profiles are published from the breeder&apos;s live records.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSexFilter("all");
                setStatusFilter("all");
                setFavoritesOnly(false);
              }}
              className="mt-6 inline-flex items-center rounded-2xl border border-[var(--portal-border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--portal-text)]"
            >
              Clear filters
            </button>
          </div>
        )}
      </section>

      {selected ? (
        <PuppyDetailDialog
          puppy={selected}
          activeTab={detailTab}
          favorite={favoriteIds.includes(selected.id)}
          onTabChange={setDetailTab}
          onToggleFavorite={() => toggleFavorite(selected.id)}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}

function PuppyCard({
  puppy,
  favorite,
  onToggleFavorite,
  onOpen,
}: {
  puppy: PortalPuppy;
  favorite: boolean;
  onToggleFavorite: () => void;
  onOpen: () => void;
}) {
  const status = publicPuppyStatus(puppy);
  const price = publicPuppyPrice(puppy);
  const priceHidden = shouldHidePublicPuppyPrice(status);
  const photoUrl = publicPuppyPhotoUrl(puppy);

  return (
    <article className="premium-card group overflow-hidden rounded-[1.65rem] transition duration-300 hover:-translate-y-1 hover:shadow-[var(--portal-shadow-lg)]">
      <div className="relative h-72 overflow-hidden bg-[var(--portal-surface-tint)]">
        <button
          type="button"
          onClick={onOpen}
          className="absolute inset-0 z-10"
          aria-label={`View ${publicPuppyName(puppy)} details`}
        />
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={publicPuppyName(puppy)}
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
            sizes="(max-width: 768px) 100vw, (max-width: 1536px) 50vw, 33vw"
          />
        ) : (
          <div className="portal-grid-bg flex h-full flex-col items-center justify-center text-[var(--portal-text-muted)]">
            <PawPrint className="h-8 w-8" />
            <span className="mt-3 text-sm font-semibold">
              Photo coming soon
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4 pointer-events-none">
          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] shadow-sm ${statusClass(status)}`}
            >
              {publicPuppyStatusLabel(status)}
            </span>
            {publicPuppyIsFeatured(puppy) ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(197,150,87,0.42)] bg-[#fff9ed]/94 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-accent-strong)] shadow-sm">
                <Sparkles className="h-3 w-3" />
                Featured
              </span>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onToggleFavorite}
            className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/92 text-[var(--portal-accent)] shadow-md backdrop-blur transition hover:scale-105"
            aria-label={favorite ? "Remove from saved puppies" : "Save puppy"}
            aria-pressed={favorite}
          >
            <Heart className={`h-5 w-5 ${favorite ? "fill-current" : ""}`} />
          </button>
        </div>
      </div>

      <div className="p-5">
        <button type="button" onClick={onOpen} className="w-full text-left">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate font-serif text-2xl font-bold tracking-[-0.03em] text-[var(--portal-accent-deep)]">
                {publicPuppyName(puppy)}
              </h2>
              <p className="mt-2 text-sm text-[var(--portal-text-soft)]">
                {[
                  publicPuppySex(puppy),
                  publicPuppyColor(puppy),
                  publicPuppyCoat(puppy),
                ]
                  .filter(Boolean)
                  .join(" • ") || "Southwest Virginia Chihuahua"}
              </p>
            </div>
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--portal-gold-soft)] text-[var(--portal-accent)] transition group-hover:translate-x-0.5">
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2.5">
            <InfoTile
              label="Price"
              value={
                priceHidden
                  ? "Private"
                  : price != null
                    ? fmtMoney(price)
                    : "TBD"
              }
            />
            <InfoTile
              label="Age"
              value={publicPuppyAgeLabel(puppy) || "Upcoming"}
            />
            <InfoTile
              label="Registry"
              value={publicPuppyRegistry(puppy) || "Pending"}
            />
          </div>

          <p className="mt-5 line-clamp-3 text-sm leading-7 text-[var(--portal-text-soft)]">
            {publicPuppyDescription(puppy) ||
              "Open this profile for family-line details and the next step in the application process."}
          </p>
        </button>
      </div>
    </article>
  );
}

function PuppyDetailDialog({
  puppy,
  activeTab,
  favorite,
  onTabChange,
  onToggleFavorite,
  onClose,
}: {
  puppy: PortalPuppy;
  activeTab: DetailTab;
  favorite: boolean;
  onTabChange: (tab: DetailTab) => void;
  onToggleFavorite: () => void;
  onClose: () => void;
}) {
  const price = publicPuppyPrice(puppy);
  const priceHidden = shouldHidePublicPuppyPrice(puppy.status);
  const photoUrl = publicPuppyPhotoUrl(puppy);
  const status = publicPuppyStatus(puppy);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(67,45,33,0.5)] px-3 py-5 backdrop-blur-sm md:px-6"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${publicPuppyName(puppy)} puppy profile`}
        className="max-h-full w-full max-w-5xl overflow-hidden rounded-[2rem] border border-[var(--portal-border)] bg-[var(--portal-bg-elevated)] shadow-[0_40px_100px_rgba(67,45,33,0.3)]"
      >
        <div className="grid max-h-[92vh] lg:grid-cols-[minmax(0,0.92fr)_minmax(460px,1.08fr)]">
          <div className="relative min-h-72 overflow-hidden bg-[var(--portal-surface-tint)] lg:min-h-[680px]">
            {photoUrl ? (
              <Image
                src={photoUrl}
                alt={publicPuppyName(puppy)}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 46vw"
              />
            ) : (
              <div className="portal-grid-bg flex h-full min-h-72 flex-col items-center justify-center text-[var(--portal-text-muted)]">
                <PawPrint className="h-10 w-10" />
                <span className="mt-3 text-sm font-semibold">
                  Photo coming soon
                </span>
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(67,45,33,0.82)] to-transparent p-6 pt-24 text-white">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/72">
                Southwest Virginia Chihuahua
              </div>
              <div className="mt-2 font-serif text-3xl font-bold">
                {publicPuppyName(puppy)}
              </div>
              <div className="mt-2 text-sm text-white/80">
                {[
                  publicPuppySex(puppy),
                  publicPuppyColor(puppy),
                  publicPuppyCoat(puppy),
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </div>
            </div>
          </div>

          <div className="scroller flex min-h-0 flex-col overflow-y-auto">
            <div className="sticky top-0 z-20 border-b border-[var(--portal-border)] bg-[rgba(255,250,245,0.94)] px-5 pt-5 backdrop-blur md:px-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${statusClass(status)}`}
                  >
                    {publicPuppyStatusLabel(status)}
                  </span>
                  <span className="inline-flex rounded-full border border-[var(--portal-border)] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-accent-strong)]">
                    {priceHidden
                      ? "Price private"
                      : price != null
                        ? fmtMoney(price)
                        : "Price on request"}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onToggleFavorite}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-[13px] border border-[var(--portal-border)] bg-white text-[var(--portal-accent)]"
                    aria-label={
                      favorite ? "Remove from saved puppies" : "Save puppy"
                    }
                    aria-pressed={favorite}
                  >
                    <Heart
                      className={`h-4 w-4 ${favorite ? "fill-current" : ""}`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-[13px] border border-[var(--portal-border)] bg-white text-[var(--portal-text)]"
                    aria-label="Close puppy profile"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-5 flex gap-1 overflow-x-auto">
                {[
                  { key: "overview", label: "Overview" },
                  { key: "lineage", label: "Family line" },
                  { key: "next", label: "Next steps" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => onTabChange(tab.key as DetailTab)}
                    className={[
                      "whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition",
                      activeTab === tab.key
                        ? "border-[var(--portal-accent)] text-[var(--portal-accent-strong)]"
                        : "border-transparent text-[var(--portal-text-muted)] hover:text-[var(--portal-text)]",
                    ].join(" ")}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5 md:p-6">
              {activeTab === "overview" ? (
                <div>
                  <div className="portal-kicker">Puppy profile</div>
                  <h2 className="mt-2 font-serif text-3xl font-bold tracking-[-0.04em] text-[var(--portal-accent-deep)]">
                    About {publicPuppyName(puppy)}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-[var(--portal-text-soft)]">
                    {publicPuppyDescription(puppy) ||
                      "The breeder is still preparing the public story for this puppy. Core profile details are shown below."}
                  </p>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <DetailTile
                      label="Sex"
                      value={publicPuppySex(puppy) || "Not listed"}
                    />
                    <DetailTile
                      label="Color"
                      value={publicPuppyColor(puppy) || "Not listed"}
                    />
                    <DetailTile
                      label="Coat"
                      value={publicPuppyCoat(puppy) || "Not listed"}
                    />
                    <DetailTile
                      label="Pattern"
                      value={puppy.pattern || "Not listed"}
                    />
                    <DetailTile
                      label="Age"
                      value={publicPuppyAgeLabel(puppy) || "Upcoming"}
                    />
                    <DetailTile
                      label="Registry"
                      value={publicPuppyRegistry(puppy) || "Pending"}
                    />
                  </div>
                </div>
              ) : null}

              {activeTab === "lineage" ? (
                <div>
                  <div className="portal-kicker">Family line</div>
                  <h2 className="mt-2 font-serif text-3xl font-bold tracking-[-0.04em] text-[var(--portal-accent-deep)]">
                    Breeder-record lineage
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-[var(--portal-text-soft)]">
                    These family details are shown exactly as they are published
                    from the breeder&apos;s connected puppy and litter records.
                  </p>

                  <div className="mt-6 space-y-3">
                    <LineageRow
                      icon={<Users className="h-4 w-4" />}
                      label="Dam"
                      value={puppy.dam || "Not published"}
                    />
                    <LineageRow
                      icon={<Users className="h-4 w-4" />}
                      label="Sire"
                      value={puppy.sire || "Not published"}
                    />
                    <LineageRow
                      icon={<PawPrint className="h-4 w-4" />}
                      label="Litter"
                      value={puppy.litter_name || "Not published"}
                    />
                    <LineageRow
                      icon={<CalendarDays className="h-4 w-4" />}
                      label="Date of birth"
                      value={puppy.dob ? fmtDate(puppy.dob) : "Expected litter"}
                    />
                  </div>
                </div>
              ) : null}

              {activeTab === "next" ? (
                <div>
                  <div className="portal-kicker">Placement process</div>
                  <h2 className="mt-2 font-serif text-3xl font-bold tracking-[-0.04em] text-[var(--portal-accent-deep)]">
                    Ready for the next conversation?
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-[var(--portal-text-soft)]">
                    An application helps the breeder understand your household,
                    timing, puppy preferences, and transportation needs. It does
                    not create a reservation until the breeder confirms the
                    match.
                  </p>

                  <div className="mt-6 space-y-3">
                    <ProcessRow
                      number="01"
                      title="Submit your application"
                      detail="Share your household and placement preferences."
                    />
                    <ProcessRow
                      number="02"
                      title="Breeder review"
                      detail="The breeder confirms fit, availability, and any questions."
                    />
                    <ProcessRow
                      number="03"
                      title="Documents and reservation"
                      detail="Approved families complete the connected portal steps."
                    />
                  </div>

                  <div className="mt-6 rounded-[1.25rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--portal-accent)]" />
                      <p className="text-sm leading-6 text-[var(--portal-text-soft)]">
                        Pricing is hidden for reserved and completed placements
                        to protect customer account information.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-auto border-t border-[var(--portal-border)] bg-white/72 p-5 md:p-6">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/portal/application"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--portal-shadow-md)] transition hover:-translate-y-0.5"
                >
                  Start application
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/portal/messages"
                  className="inline-flex flex-1 items-center justify-center rounded-2xl border border-[var(--portal-border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:-translate-y-0.5"
                >
                  Ask a question
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-white/72 px-3 py-4 text-center backdrop-blur">
      <div className="font-serif text-2xl font-bold text-[var(--portal-accent-deep)]">
        {value}
      </div>
      <div className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
        {label}
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-[var(--portal-border)] bg-white/72 px-3 py-3">
      <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-1.5 truncate text-xs font-semibold text-[var(--portal-text)]">
        {value}
      </div>
    </div>
  );
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">
        {value}
      </div>
    </div>
  );
}

function LineageRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-[1.1rem] border border-[var(--portal-border)] bg-white p-4">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-[var(--portal-gold-soft)] text-[var(--portal-accent)]">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
          {label}
        </div>
        <div className="mt-1 truncate text-sm font-semibold text-[var(--portal-text)]">
          {value}
        </div>
      </div>
    </div>
  );
}

function ProcessRow({
  number,
  title,
  detail,
}: {
  number: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex gap-4 rounded-[1.1rem] border border-[var(--portal-border)] bg-white p-4">
      <span className="font-serif text-lg font-bold text-[var(--portal-accent)]">
        {number}
      </span>
      <div>
        <div className="text-sm font-semibold text-[var(--portal-text)]">
          {title}
        </div>
        <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">
          {detail}
        </div>
      </div>
    </div>
  );
}
