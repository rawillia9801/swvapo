
"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AdminEmptyState,
  AdminHeroPrimaryAction,
  AdminHeroSecondaryAction,
  AdminInfoTile,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPageHero,
  AdminPageShell,
  AdminPanel,
  AdminRestrictedState,
} from "@/components/admin/luxury-admin-shell";
import { shouldHidePublicPuppyPrice } from "@/lib/lineage";
import { buildPuppyPhotoUrl, fmtDate, fmtMoney } from "@/lib/utils";
import { usePortalAdminSession } from "@/lib/use-portal-admin-session";

type BuyerOption = {
  id: number;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  notes?: string | null;
  city?: string | null;
  state?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  sale_price?: number | null;
  deposit_amount?: number | null;
  delivery_option?: string | null;
  delivery_date?: string | null;
  delivery_location?: string | null;
  delivery_miles?: number | null;
  delivery_fee?: number | null;
  expense_gas?: number | null;
  expense_hotel?: number | null;
  expense_tolls?: number | null;
  expense_misc?: string | null;
  portal_profile_photo_url?: string | null;
};

type BreedingDog = {
  id: string;
  role?: string | null;
  displayName?: string | null;
};

type Litter = {
  id: number;
  displayName?: string | null;
  dam_id?: string | null;
  sire_id?: string | null;
};

type TransportRequest = {
  id: number;
  request_date?: string | null;
  request_type?: string | null;
  miles?: number | null;
  location_text?: string | null;
  address_text?: string | null;
  notes?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type PuppyRecord = {
  id: number;
  buyer_id?: number | null;
  litter_id?: number | null;
  litter_name?: string | null;
  dam_id?: string | null;
  sire_id?: string | null;
  call_name?: string | null;
  puppy_name?: string | null;
  name?: string | null;
  sire?: string | null;
  dam?: string | null;
  sex?: string | null;
  color?: string | null;
  coat_type?: string | null;
  coat?: string | null;
  pattern?: string | null;
  dob?: string | null;
  registry?: string | null;
  price?: number | null;
  list_price?: number | null;
  deposit?: number | null;
  balance?: number | null;
  status?: string | null;
  birth_weight?: number | null;
  current_weight?: number | null;
  weight_unit?: string | null;
  weight_date?: string | null;
  image_url?: string | null;
  photo_url?: string | null;
  owner_email?: string | null;
  description?: string | null;
  notes?: string | null;
  microchip?: string | null;
  registration_no?: string | null;
  tail_dock_cost?: number | null;
  dewclaw_cost?: number | null;
  vaccination_cost?: number | null;
  microchip_cost?: number | null;
  registration_cost?: number | null;
  other_vet_cost?: number | null;
  total_medical_cost?: number | null;
  w_1?: number | null;
  w_2?: number | null;
  w_3?: number | null;
  w_4?: number | null;
  w_5?: number | null;
  w_6?: number | null;
  w_7?: number | null;
  w_8?: number | null;
  created_at?: string | null;
  buyerName?: string | null;
  buyerEmail?: string | null;
  transportRequest?: TransportRequest | null;
};

type PuppyForm = Record<string, string>;
type Option = { value: string; label: string };
type Tone = "green" | "amber" | "slate" | "rose";

function emptyForm(): PuppyForm {
  return {
    call_name: "",
    puppy_name: "",
    name: "",
    status: "available",
    buyer_id: "",
    owner_email: "",
    litter_id: "",
    litter_name: "",
    dam_id: "",
    sire_id: "",
    sex: "",
    color: "",
    coat_type: "",
    coat: "",
    pattern: "",
    dob: "",
    registry: "",
    sire: "",
    dam: "",
    price: "",
    list_price: "",
    deposit: "",
    balance: "",
    tail_dock_cost: "",
    dewclaw_cost: "",
    vaccination_cost: "",
    microchip_cost: "",
    registration_cost: "",
    other_vet_cost: "",
    photo_url: "",
    image_url: "",
    description: "",
    notes: "",
    birth_weight: "",
    current_weight: "",
    weight_unit: "",
    weight_date: "",
    microchip: "",
    registration_no: "",
    w_1: "",
    w_2: "",
    w_3: "",
    w_4: "",
    w_5: "",
    w_6: "",
    w_7: "",
    w_8: "",
  };
}

function puppyName(puppy: PuppyRecord | null) {
  return puppy?.call_name || puppy?.puppy_name || puppy?.name || "Unnamed Puppy";
}

function populateForm(puppy: PuppyRecord | null): PuppyForm {
  if (!puppy) return emptyForm();
  const form = emptyForm();

  Object.keys(form).forEach((key) => {
    const value = (puppy as Record<string, unknown>)[key];
    form[key] = value === null || value === undefined ? "" : String(value);
  });

  return form;
}

function available(status: string | null | undefined) {
  const normalized = String(status || "").toLowerCase();
  return normalized.includes("available") || normalized.includes("expected");
}

function completed(status: string | null | undefined) {
  const normalized = String(status || "").toLowerCase();
  return ["reserved", "matched", "sold", "adopted", "completed"].some((value) =>
    normalized.includes(value),
  );
}

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasValue(value: unknown) {
  return String(value ?? "").trim().length > 0;
}

function formatMoneyOrDash(value: unknown) {
  if (!hasValue(value)) return "Not set";
  return fmtMoney(num(value));
}

function formatMiles(value: unknown) {
  if (!hasValue(value)) return "Not set";
  return `${num(value).toLocaleString()} mi`;
}

function formatTextOrDash(value: unknown, fallback = "Not set") {
  return String(value ?? "").trim() || fallback;
}

function formatDateOrDash(value: string | null | undefined, fallback = "Not scheduled") {
  if (!value) return fallback;
  return fmtDate(value);
}

function buyerAddress(buyer: BuyerOption | null) {
  if (!buyer) return "No buyer address on file";
  const line1 = String(buyer.address_line1 || "").trim();
  const line2 = String(buyer.address_line2 || "").trim();
  const locality = [buyer.city, buyer.state, buyer.postal_code]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");
  const parts = [line1, line2, locality].filter(Boolean);
  return parts.join(" | ") || "No buyer address on file";
}

function transportCostTotal(buyer: BuyerOption | null) {
  if (!buyer) return 0;
  return (
    num(buyer.delivery_fee) +
    num(buyer.expense_gas) +
    num(buyer.expense_hotel) +
    num(buyer.expense_tolls)
  );
}

function itemizedBreederCosts(form: PuppyForm) {
  return (
    num(form.tail_dock_cost) +
    num(form.dewclaw_cost) +
    num(form.vaccination_cost) +
    num(form.microchip_cost) +
    num(form.registration_cost) +
    num(form.other_vet_cost)
  );
}

function buildDetailHref(pathname: string, puppyId: number | string) {
  return `${pathname}?puppy=${encodeURIComponent(String(puppyId))}&view=detail`;
}

function cardTone(status: string | null | undefined): Tone {
  if (available(status)) return "green";
  if (completed(status)) return "amber";
  if (String(status || "").toLowerCase().includes("hold")) return "rose";
  return "slate";
}

function toneClasses(tone: Tone) {
  if (tone === "green") {
    return {
      badge: "border-[#cfe0c3] bg-[#eef6e8] text-[#5f7f51]",
      ring: "ring-[#dce9d4]",
      icon: "bg-[#eef6e8] text-[#5f7f51]",
    };
  }
  if (tone === "amber") {
    return {
      badge: "border-[#ead5bd] bg-[#fff4e8] text-[#9a6f44]",
      ring: "ring-[#edd9c7]",
      icon: "bg-[#fff4e8] text-[#9a6f44]",
    };
  }
  if (tone === "rose") {
    return {
      badge: "border-[#f0d8d1] bg-[#fff1ed] text-[#a15b4d]",
      ring: "ring-[#f0d8d1]",
      icon: "bg-[#fff1ed] text-[#a15b4d]",
    };
  }
  return {
    badge: "border-[#e2ddd6] bg-[#f8f6f3] text-[#77695b]",
    ring: "ring-[#ece5dd]",
    icon: "bg-[#f8f6f3] text-[#77695b]",
  };
}

async function fetchPuppies(accessToken: string) {
  const response = await fetch("/api/admin/portal/puppies", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      puppies: [] as PuppyRecord[],
      buyers: [] as BuyerOption[],
      litters: [] as Litter[],
      breedingDogs: [] as BreedingDog[],
    };
  }

  const payload = (await response.json()) as {
    puppies?: PuppyRecord[];
    buyers?: BuyerOption[];
    litters?: Litter[];
    breedingDogs?: BreedingDog[];
  };

  return {
    puppies: Array.isArray(payload.puppies) ? payload.puppies : [],
    buyers: Array.isArray(payload.buyers) ? payload.buyers : [],
    litters: Array.isArray(payload.litters) ? payload.litters : [],
    breedingDogs: Array.isArray(payload.breedingDogs) ? payload.breedingDogs : [],
  };
}

function FieldLabel({
  label,
  hint,
}: {
  label: string;
  hint?: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9d7349]">
        {label}
      </label>
      {hint ? <span className="text-xs text-[#8e7359]">{hint}</span> : null}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
  hint?: string;
}) {
  return (
    <div>
      <FieldLabel label={label} hint={hint} />
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[18px] border border-[#e7d8c9] bg-[#fffdf9] px-3.5 py-3 text-sm text-[#33251a] outline-none transition focus:border-[#c59a6f] focus:ring-2 focus:ring-[#ead7c0]"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
}) {
  return (
    <div>
      <FieldLabel label={label} />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[18px] border border-[#e7d8c9] bg-[#fffdf9] px-3.5 py-3 text-sm text-[#33251a] outline-none transition focus:border-[#c59a6f] focus:ring-2 focus:ring-[#ead7c0]"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <FieldLabel label={label} />
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[18px] border border-[#e7d8c9] bg-[#fffdf9] px-3.5 py-3 text-sm text-[#33251a] outline-none transition focus:border-[#c59a6f] focus:ring-2 focus:ring-[#ead7c0]"
      />
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-[#ead9c7] bg-[#fffaf4] p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9d7349]">
            {title}
          </div>
          {subtitle ? <p className="mt-1 text-sm text-[#6f5339]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#ead9c7] bg-white px-4 py-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9d7349]">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold leading-tight text-[#2f2218]">{value}</div>
      <div className="mt-2 text-sm leading-relaxed text-[#775d44]">{detail}</div>
    </div>
  );
}

export default function AdminPortalPuppiesPage() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queryPuppyId = searchParams.get("puppy") || "";
  const detailOnly = searchParams.get("view") === "detail";

  const [puppies, setPuppies] = useState<PuppyRecord[]>([]);
  const [buyers, setBuyers] = useState<BuyerOption[]>([]);
  const [litters, setLitters] = useState<Litter[]>([]);
  const [dogs, setDogs] = useState<BreedingDog[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [statusText, setStatusText] = useState("");
  const [form, setForm] = useState<PuppyForm>(emptyForm());

  async function refresh(preferredId?: string, nextCreateMode = false) {
    if (!accessToken) return;

    const payload = await fetchPuppies(accessToken);
    setPuppies(payload.puppies);
    setBuyers(payload.buyers);
    setLitters(payload.litters);
    setDogs(payload.breedingDogs);
    setCreateMode(nextCreateMode);

    const preferredExists =
      preferredId && payload.puppies.some((puppy) => String(puppy.id) === preferredId);

    if (nextCreateMode) {
      setSelectedId("");
      return;
    }

    if (preferredExists) {
      setSelectedId(preferredId || "");
      return;
    }

    if (detailOnly) {
      setSelectedId(String(payload.puppies[0]?.id || ""));
      return;
    }

    setSelectedId("");
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!accessToken || !isAdmin) {
        if (active) setLoadingData(false);
        return;
      }

      setLoadingData(true);

      try {
        const payload = await fetchPuppies(accessToken);
        if (!active) return;

        setPuppies(payload.puppies);
        setBuyers(payload.buyers);
        setLitters(payload.litters);
        setDogs(payload.breedingDogs);

        const nextSelectedId =
          queryPuppyId && payload.puppies.some((puppy) => String(puppy.id) === queryPuppyId)
            ? queryPuppyId
            : detailOnly
              ? String(payload.puppies[0]?.id || "")
              : "";

        setSelectedId(nextSelectedId);
      } finally {
        if (active) setLoadingData(false);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [accessToken, detailOnly, isAdmin, queryPuppyId]);

  const filteredPuppies = useMemo(() => {
    return puppies.filter((puppy) => {
      if (statusFilter === "available" && !available(puppy.status)) return false;
      if (statusFilter === "placed" && !completed(puppy.status)) return false;
      if (
        statusFilter !== "all" &&
        !["available", "placed"].includes(statusFilter) &&
        String(puppy.status || "").toLowerCase() !== statusFilter
      ) {
        return false;
      }

      const q = search.trim().toLowerCase();
      if (!q) return true;

      return [
        puppyName(puppy),
        puppy.status,
        puppy.buyerName,
        puppy.owner_email,
        puppy.litter_name,
        puppy.sire,
        puppy.dam,
        puppy.color,
        puppy.notes,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(q);
    });
  }, [puppies, search, statusFilter]);

  const selectedPuppy = createMode
    ? null
    : puppies.find((puppy) => String(puppy.id) === selectedId) || null;

  const selectedBuyer = buyers.find((buyer) => String(buyer.id) === form.buyer_id) || null;
  const selectedLitter = litters.find((litter) => String(litter.id) === form.litter_id) || null;
  const selectedTransportRequest = selectedPuppy?.transportRequest || null;
  const damOptions = dogs.filter((dog) => String(dog.role || "").toLowerCase() === "dam");
  const sireOptions = dogs.filter((dog) => String(dog.role || "").toLowerCase() === "sire");
  const publicPriceHidden = shouldHidePublicPuppyPrice(form.status);
  const photoPreview =
    form.photo_url || form.image_url
      ? buildPuppyPhotoUrl(form.photo_url || form.image_url)
      : "";
  const itemizedCostTotal = itemizedBreederCosts(form);
  const medicalTotalValue = selectedPuppy?.total_medical_cost;
  const selectedTransportTotal = transportCostTotal(selectedBuyer);
  const buyerSummaryName =
    selectedBuyer?.displayName || selectedPuppy?.buyerName || form.owner_email || "Not linked";
  const litterSummaryName = selectedLitter?.displayName || form.litter_name || "Not linked";
  const damSummary =
    damOptions.find((dog) => String(dog.id) === form.dam_id)?.displayName || form.dam || "No dam";
  const sireSummary =
    sireOptions.find((dog) => String(dog.id) === form.sire_id)?.displayName ||
    form.sire ||
    "No sire";

  useEffect(() => {
    if (createMode) {
      setForm(emptyForm());
      return;
    }

    setForm(populateForm(selectedPuppy));
  }, [createMode, selectedPuppy]);

  function updateField(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function chooseLitter(value: string) {
    const litter = litters.find((item) => String(item.id) === value) || null;

    setForm((current) => ({
      ...current,
      litter_id: value,
      litter_name: litter?.displayName || current.litter_name,
      dam_id: litter?.dam_id ? String(litter.dam_id) : current.dam_id,
      sire_id: litter?.sire_id ? String(litter.sire_id) : current.sire_id,
    }));
  }

  function openDetailWindow(puppyId: number) {
    const href = buildDetailHref(pathname, puppyId);
    window.open(href, "_blank", "noopener,noreferrer");
  }

  function startCreateMode() {
    setCreateMode(true);
    setSelectedId("");
    setForm(emptyForm());
    setStatusText("");

    if (detailOnly) {
      router.replace(`${pathname}?view=detail`);
    }
  }

  function openQuickEdit(puppyId: number) {
    setCreateMode(false);
    setSelectedId(String(puppyId));
    setStatusText("");

    if (detailOnly) {
      router.replace(buildDetailHref(pathname, puppyId));
    } else {
      document
        .getElementById("puppy-editor")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function savePuppy() {
    if (!accessToken) return;

    setSaving(true);
    setStatusText("");

    try {
      const submission = { ...form } as PuppyForm & { total_medical_cost?: string };
      delete submission.total_medical_cost;

      const response = await fetch("/api/admin/portal/puppies", {
        method: createMode ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ id: createMode ? undefined : selectedPuppy?.id, ...submission }),
      });

      const payload = (await response.json()) as {
        puppyId?: number;
        error?: string;
        saved?: { litter_id?: number | null; price?: number | null; status?: string | null };
      };

      if (!response.ok) {
        throw new Error(payload.error || "Could not save the puppy.");
      }

      const nextId = payload.puppyId ? String(payload.puppyId) : selectedId;
      await refresh(nextId, false);

      if (detailOnly && payload.puppyId) {
        router.replace(buildDetailHref(pathname, payload.puppyId));
      }

      const litterText = payload.saved?.litter_id
        ? ` Linked to litter #${payload.saved.litter_id}.`
        : " No litter linked.";
      const priceText =
        payload.saved?.price != null
          ? ` Internal sale ${fmtMoney(num(payload.saved.price))}.`
          : "";

      setStatusText(
        `${createMode ? "Puppy created." : "Puppy updated."}${litterText}${priceText}`,
      );
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not save the puppy.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePuppy() {
    if (!accessToken || !selectedPuppy) return;
    if (!window.confirm(`Delete ${puppyName(selectedPuppy)}?`)) return;

    setDeleting(true);
    setStatusText("");

    try {
      const response = await fetch("/api/admin/portal/puppies", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ id: selectedPuppy.id }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Could not delete the puppy.");
      }

      await refresh(undefined, false);

      if (detailOnly) {
        router.replace(pathname);
      }

      setStatusText("Puppy deleted.");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Could not delete the puppy.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading || loadingData) {
    return (
      <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">
        Loading puppies...
      </div>
    );
  }

  if (!user) {
    return (
      <AdminRestrictedState
        title="Sign in to access puppies."
        details="This workspace is reserved for the Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!isAdmin) {
    return (
      <AdminRestrictedState
        title="This puppy workspace is limited to approved owner accounts."
        details="Only the approved owner emails can manage puppy records, lineage, and public price rules."
      />
    );
  }

  const buyerOptions: Option[] = [
    { value: "", label: "Unassigned" },
    ...buyers.map((buyer) => ({
      value: String(buyer.id),
      label: buyer.displayName || buyer.email || `Buyer #${buyer.id}`,
    })),
  ];

  const litterOptions: Option[] = [
    { value: "", label: "No litter" },
    ...litters.map((litter) => ({
      value: String(litter.id),
      label: litter.displayName || `Litter #${litter.id}`,
    })),
  ];

  const damSelectOptions: Option[] = [
    { value: "", label: "No dam" },
    ...damOptions.map((dog) => ({
      value: String(dog.id),
      label: dog.displayName || `Dam #${dog.id}`,
    })),
  ];

  const sireSelectOptions: Option[] = [
    { value: "", label: "No sire" },
    ...sireOptions.map((dog) => ({
      value: String(dog.id),
      label: dog.displayName || `Sire #${dog.id}`,
    })),
  ];

  const statusOptions: Option[] = [
    { value: "available", label: "Available" },
    { value: "expected", label: "Expected" },
    { value: "reserved", label: "Reserved" },
    { value: "matched", label: "Matched" },
    { value: "sold", label: "Sold" },
    { value: "adopted", label: "Adopted" },
    { value: "completed", label: "Completed" },
  ];

  const shouldRenderEditor = createMode || !!selectedPuppy || detailOnly;

  return (
    <AdminPageShell>
      <div className="space-y-5 pb-10">
        {detailOnly ? (
          <AdminPanel title="Puppy Detail Workspace" subtitle="A wider, dedicated detail view for one puppy record.">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9d7349]">
                  Focused record view
                </div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#2f2218]">
                  {createMode ? "Create Puppy" : puppyName(selectedPuppy)}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#725740]">
                  This window is built for clear viewing and editing without the cramped stacked cards from the main directory page.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/admin/portal/puppies"
                  className="inline-flex items-center rounded-2xl border border-[#e3d2bf] bg-white px-4 py-3 text-sm font-semibold text-[#6d4e35] transition hover:border-[#c9a67e]"
                >
                  Back to Directory
                </Link>
                <button
                  type="button"
                  onClick={startCreateMode}
                  className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(159,99,49,0.22)] transition hover:-translate-y-0.5 hover:brightness-105"
                >
                  Create Puppy
                </button>
              </div>
            </div>
          </AdminPanel>
        ) : (
          <>
            <AdminPageHero
              eyebrow="Puppies"
              title="Puppy records that are easier to scan, easier to open, and easier to manage."
              description="The directory now stays clean and readable. Opening a puppy launches a dedicated detail window so pricing, buyer logistics, lineage, and breeder costs are no longer compressed into a cramped sidebar."
              actions={
                <>
                  <button
                    type="button"
                    onClick={startCreateMode}
                    className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(159,99,49,0.22)] transition hover:-translate-y-0.5 hover:brightness-105"
                  >
                    Create Puppy
                  </button>
                  <AdminHeroPrimaryAction href="/admin/portal/litters">
                    Open Litters
                  </AdminHeroPrimaryAction>
                  <AdminHeroSecondaryAction href="/admin/portal/users">
                    Open Buyers
                  </AdminHeroSecondaryAction>
                </>
              }
              aside={
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                  <AdminInfoTile
                    label="Public Pricing"
                    value={String(
                      puppies.filter((puppy) => shouldHidePublicPuppyPrice(puppy.status)).length,
                    )}
                    detail="Reserved and completed puppies keep internal pricing while public pricing stays hidden."
                  />
                  <AdminInfoTile
                    label="Lineage Coverage"
                    value={`${litters.length} litters`}
                    detail={`${damOptions.length} dams / ${sireOptions.length} sires`}
                  />
                </div>
              }
            />

            <AdminMetricGrid>
              <AdminMetricCard
                label="Puppies"
                value={String(puppies.length)}
                detail="All shared puppy records powering admin, portal, and public surfaces."
              />
              <AdminMetricCard
                label="Available"
                value={String(puppies.filter((puppy) => available(puppy.status)).length)}
                detail="Puppies that can still display publicly with price if configured."
                accent="from-[#dfe8d8] via-[#c6d6ba] to-[#8aa07e]"
              />
              <AdminMetricCard
                label="Reserved / Completed"
                value={String(
                  puppies.filter((puppy) => shouldHidePublicPuppyPrice(puppy.status)).length,
                )}
                detail="Records that stay visible internally while public pricing is hidden."
                accent="from-[#e7ddd3] via-[#c9b39a] to-[#8f6f53]"
              />
              <AdminMetricCard
                label="Buyer Linked"
                value={String(puppies.filter((puppy) => puppy.buyer_id || puppy.owner_email).length)}
                detail="Puppies currently attached to a buyer record or buyer email."
                accent="from-[#f0ddc5] via-[#d9b78e] to-[#be8650]"
              />
            </AdminMetricGrid>
          </>
        )}

        <AdminPanel
          title={detailOnly ? "Choose a Puppy" : "Puppy Directory"}
          subtitle={
            detailOnly
              ? "Switch records here without returning to the crowded split view."
              : "Click a puppy card to open a dedicated detail window. Use Quick Edit only when you want to stay on this page."
          }
        >
          <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search puppies, litters, lineage, or buyer..."
              className="w-full rounded-[18px] border border-[#e6d7c7] bg-[#fffdfa] px-4 py-3 text-sm text-[#33251a] outline-none transition focus:border-[#caa074] focus:ring-2 focus:ring-[#ead7c0]"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-[18px] border border-[#e6d7c7] bg-[#fffdfa] px-4 py-3 text-sm text-[#33251a] outline-none transition focus:border-[#caa074] focus:ring-2 focus:ring-[#ead7c0]"
            >
              <option value="all">All statuses</option>
              <option value="available">Available / Expected</option>
              <option value="placed">Reserved / Placed</option>
              <option value="reserved">Reserved</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {filteredPuppies.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredPuppies.map((puppy) => {
                const tone = toneClasses(cardTone(puppy.status));
                const isSelected = !createMode && String(puppy.id) === selectedId;

                return (
                  <button
                    key={puppy.id}
                    type="button"
                    onClick={() => openDetailWindow(puppy.id)}
                    className={`group w-full rounded-[24px] border border-[#ead9c7] bg-white p-5 text-left shadow-[0_12px_26px_rgba(99,70,46,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(99,70,46,0.10)] ${isSelected ? "ring-2" : "ring-1"} ${tone.ring}`}
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${tone.badge}`}
                            >
                              {puppy.status || "Pending"}
                            </span>
                            {shouldHidePublicPuppyPrice(puppy.status) ? (
                              <span className="inline-flex rounded-full border border-[#ead5bd] bg-[#fff4e8] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9a6f44]">
                                Public Price Hidden
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-3 text-2xl font-semibold tracking-tight text-[#2f2218]">
                            {puppyName(puppy)}
                          </div>
                          <div className="mt-1 text-sm text-[#7c6147]">
                            {puppy.color || "Color not set"} • {puppy.sex || "Sex not set"} •{" "}
                            {puppy.coat_type || "Coat not set"}
                          </div>
                        </div>

                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone.icon}`}
                        >
                          <span className="text-lg font-semibold">→</span>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-[18px] border border-[#eee1d2] bg-[#fffaf4] px-4 py-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9d7349]">
                            Lineage
                          </div>
                          <div className="mt-2 text-sm font-semibold text-[#2f2218]">
                            {puppy.litter_name || "No litter linked"}
                          </div>
                          <div className="mt-1 text-sm text-[#725740]">
                            {puppy.dam || "No dam"} / {puppy.sire || "No sire"}
                          </div>
                        </div>

                        <div className="rounded-[18px] border border-[#eee1d2] bg-[#fffaf4] px-4 py-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9d7349]">
                            Buyer
                          </div>
                          <div className="mt-2 text-sm font-semibold text-[#2f2218]">
                            {puppy.buyerName || puppy.owner_email || "Not linked"}
                          </div>
                          <div className="mt-1 text-sm text-[#725740]">
                            {puppy.transportRequest?.request_type
                              ? `Transport: ${puppy.transportRequest.request_type}`
                              : "No transport request"}
                          </div>
                        </div>

                        <div className="rounded-[18px] border border-[#eee1d2] bg-[#fffaf4] px-4 py-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9d7349]">
                            Internal Sale
                          </div>
                          <div className="mt-2 text-sm font-semibold text-[#2f2218]">
                            {formatMoneyOrDash(puppy.price)}
                          </div>
                          <div className="mt-1 text-sm text-[#725740]">
                            Deposit {formatMoneyOrDash(puppy.deposit)}
                          </div>
                        </div>

                        <div className="rounded-[18px] border border-[#eee1d2] bg-[#fffaf4] px-4 py-3">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9d7349]">
                            Public Listing
                          </div>
                          <div className="mt-2 text-sm font-semibold text-[#2f2218]">
                            {shouldHidePublicPuppyPrice(puppy.status)
                              ? "Hidden"
                              : formatMoneyOrDash(puppy.price || puppy.list_price)}
                          </div>
                          <div className="mt-1 text-sm text-[#725740]">
                            {puppy.created_at ? `Created ${fmtDate(puppy.created_at)}` : "Created date not set"}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center rounded-full border border-[#e4d2be] bg-[#fff7ef] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f6843]">
                          Open detail window
                        </span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openQuickEdit(puppy.id);
                          }}
                          className="inline-flex items-center rounded-full border border-[#dcc7b0] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#6d4e35] transition hover:border-[#c9a67e]"
                        >
                          Quick Edit Here
                        </button>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <AdminEmptyState
              title="No puppies match the current filters"
              description="Adjust the filters or create a new puppy record to restart the workflow."
            />
          )}
        </AdminPanel>

        {shouldRenderEditor ? (
          <div id="puppy-editor">
            <AdminPanel
              title={createMode ? "Create Puppy" : detailOnly ? "Puppy Record Detail" : "Quick Edit"}
              subtitle={
                createMode
                  ? "Create a shared puppy record for admin, portal, and public use."
                  : detailOnly
                    ? "This detail layout stays wide and readable so buyer, transport, pricing, and breeder costs are no longer squeezed into narrow cards."
                    : "This stays on the directory page for quick changes. For a full dedicated view, click a puppy card to open it in a new window."
              }
            >
              {statusText ? (
                <div className="mb-5 rounded-[18px] border border-[#ead9c7] bg-[#fff9f2] px-4 py-3 text-sm font-semibold text-[#7a5a3a]">
                  {statusText}
                </div>
              ) : null}

              <div className="grid gap-3 lg:grid-cols-4">
                <StatCard
                  label="Buyer"
                  value={buyerSummaryName}
                  detail={selectedBuyer?.email || "Buyer assignment and contact stay visible here."}
                />
                <StatCard
                  label="Public Price"
                  value={
                    publicPriceHidden
                      ? "Hidden"
                      : hasValue(form.price || form.list_price)
                        ? fmtMoney(num(form.price || form.list_price))
                        : "Not set"
                  }
                  detail={
                    publicPriceHidden
                      ? "Reserved and completed puppies hide price on public surfaces."
                      : "Available puppies can still show price publicly."
                  }
                />
                <StatCard
                  label="Litter"
                  value={litterSummaryName}
                  detail={`${damSummary} / ${sireSummary}`}
                />
                <StatCard
                  label="Created"
                  value={selectedPuppy?.created_at ? fmtDate(selectedPuppy.created_at) : "Not saved yet"}
                  detail={form.status || "Pending"}
                />
              </div>

              <div className="mt-6 grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
                <SectionCard title="Media & Public Visibility" subtitle="Photo preview and public listing readout.">
                  <div className="overflow-hidden rounded-[22px] border border-[#ead9c7] bg-white">
                    {photoPreview ? (
                      <div className="relative h-72 w-full">
                        <Image
                          src={photoPreview}
                          alt={puppyName(selectedPuppy)}
                          fill
                          className="object-cover"
                          sizes="330px"
                        />
                      </div>
                    ) : (
                      <div className="flex h-72 items-center justify-center px-6 text-center text-sm text-[#8a6a49]">
                        No photo preview available yet.
                      </div>
                    )}
                  </div>

                  <div className="mt-4 grid gap-3">
                    <StatCard
                      label="Public Listing Price"
                      value={
                        publicPriceHidden
                          ? "Hidden"
                          : form.price || form.list_price
                            ? fmtMoney(num(form.price || form.list_price))
                            : "Not set"
                      }
                      detail={
                        publicPriceHidden
                          ? "Public listing price is hidden while the record stays active internally."
                          : "Available puppy pricing can display publicly."
                      }
                    />
                    <StatCard
                      label="Internal Sale Value"
                      value={form.price ? fmtMoney(num(form.price)) : "Not set"}
                      detail="Revenue and lineage reporting continue using the internal sale value."
                    />
                  </div>
                </SectionCard>

                <div className="space-y-5">
                  <SectionCard title="Buyer & Transportation" subtitle="Larger cards replace the cramped right-side stack from the old layout.">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <StatCard
                        label="Buyer Name"
                        value={buyerSummaryName}
                        detail={selectedBuyer?.status || "No buyer status on file"}
                      />
                      <StatCard
                        label="Email / Phone"
                        value={selectedBuyer?.email || selectedPuppy?.buyerEmail || form.owner_email || "Not set"}
                        detail={selectedBuyer?.phone || "No phone on file"}
                      />
                      <StatCard
                        label="Address"
                        value={buyerAddress(selectedBuyer)}
                        detail={
                          selectedBuyer?.city || selectedBuyer?.state
                            ? "Shipping and go-home reference"
                            : "No saved buyer address"
                        }
                      />
                      <StatCard
                        label="Buyer Contract"
                        value={selectedBuyer ? formatMoneyOrDash(selectedBuyer.sale_price) : "Not linked"}
                        detail={
                          selectedBuyer
                            ? `Buyer deposit ${formatMoneyOrDash(selectedBuyer.deposit_amount)}`
                            : "Link a buyer to surface contract totals"
                        }
                      />
                      <StatCard
                        label="Transport Mode"
                        value={formatTextOrDash(selectedBuyer?.delivery_option, "Not scheduled")}
                        detail={formatDateOrDash(selectedBuyer?.delivery_date)}
                      />
                      <StatCard
                        label="Location"
                        value={formatTextOrDash(selectedBuyer?.delivery_location, "No location set")}
                        detail={formatMiles(selectedBuyer?.delivery_miles)}
                      />
                      <StatCard
                        label="Transport Fees"
                        value={formatMoneyOrDash(selectedBuyer?.delivery_fee)}
                        detail={`Total logged transport cost ${fmtMoney(selectedTransportTotal)}`}
                      />
                      <StatCard
                        label="Latest Request"
                        value={selectedTransportRequest?.request_type || "No request logged"}
                        detail={
                          selectedTransportRequest
                            ? `${formatDateOrDash(selectedTransportRequest.request_date)} / ${formatTextOrDash(selectedTransportRequest.status, "pending")}`
                            : "No pickup request linked yet"
                        }
                      />
                    </div>

                    <div className="mt-4 grid gap-px overflow-hidden rounded-[18px] border border-[#ead9c7] bg-[#ead9c7] sm:grid-cols-2 xl:grid-cols-4">
                      <div className="bg-white px-4 py-4">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9d7349]">Gas</div>
                        <div className="mt-2 text-sm font-semibold text-[#2f2218]">{formatMoneyOrDash(selectedBuyer?.expense_gas)}</div>
                      </div>
                      <div className="bg-white px-4 py-4">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9d7349]">Hotel</div>
                        <div className="mt-2 text-sm font-semibold text-[#2f2218]">{formatMoneyOrDash(selectedBuyer?.expense_hotel)}</div>
                      </div>
                      <div className="bg-white px-4 py-4">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9d7349]">Tolls</div>
                        <div className="mt-2 text-sm font-semibold text-[#2f2218]">{formatMoneyOrDash(selectedBuyer?.expense_tolls)}</div>
                      </div>
                      <div className="bg-white px-4 py-4">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9d7349]">Misc</div>
                        <div className="mt-2 text-sm font-semibold text-[#2f2218]">{formatTextOrDash(selectedBuyer?.expense_misc, "None logged")}</div>
                      </div>
                    </div>

                    {selectedTransportRequest ? (
                      <div className="mt-4 rounded-[18px] border border-[#ead9c7] bg-white px-4 py-4">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9d7349]">
                          Request Detail
                        </div>
                        <div className="mt-2 text-sm font-semibold text-[#3e2d20]">
                          {formatTextOrDash(selectedTransportRequest.location_text, "No location text")}
                        </div>
                        <div className="mt-1 text-sm text-[#6f5339]">
                          {formatTextOrDash(selectedTransportRequest.address_text, "No address logged")}
                        </div>
                        <div className="mt-2 text-xs text-[#8a6a49]">
                          {formatMiles(selectedTransportRequest.miles)} /{" "}
                          {formatTextOrDash(selectedTransportRequest.notes, "No request notes")}
                        </div>
                      </div>
                    ) : null}
                  </SectionCard>
                </div>
              </div>

              <div className="mt-6 space-y-5">
                <SectionCard title="Record Identity" subtitle="Core identity, assignment, and lineage fields.">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <TextField label="Call Name" value={form.call_name} onChange={(value) => updateField("call_name", value)} placeholder="Call name" />
                    <TextField label="Puppy Name" value={form.puppy_name} onChange={(value) => updateField("puppy_name", value)} placeholder="Puppy name" />
                    <TextField label="Record Name" value={form.name} onChange={(value) => updateField("name", value)} placeholder="Record name" />
                    <SelectField label="Status" value={form.status} onChange={(value) => updateField("status", value)} options={statusOptions} />

                    <SelectField label="Buyer" value={form.buyer_id} onChange={(value) => updateField("buyer_id", value)} options={buyerOptions} />
                    <TextField label="Owner Email" value={form.owner_email} onChange={(value) => updateField("owner_email", value)} placeholder="Buyer email" />
                    <SelectField label="Litter" value={form.litter_id} onChange={chooseLitter} options={litterOptions} />
                    <TextField label="Litter Name" value={form.litter_name} onChange={(value) => updateField("litter_name", value)} placeholder="Litter display name" />

                    <SelectField label="Dam" value={form.dam_id} onChange={(value) => updateField("dam_id", value)} options={damSelectOptions} />
                    <SelectField label="Sire" value={form.sire_id} onChange={(value) => updateField("sire_id", value)} options={sireSelectOptions} />
                    <TextField label="Dam Text" value={form.dam} onChange={(value) => updateField("dam", value)} placeholder="Dam fallback text" />
                    <TextField label="Sire Text" value={form.sire} onChange={(value) => updateField("sire", value)} placeholder="Sire fallback text" />
                  </div>
                </SectionCard>

                <SectionCard title="Puppy Details" subtitle="Breed-facing details, registry, and identifiers.">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <TextField label="Sex" value={form.sex} onChange={(value) => updateField("sex", value)} placeholder="Male / Female" />
                    <TextField label="Color" value={form.color} onChange={(value) => updateField("color", value)} placeholder="Color" />
                    <TextField label="Coat Type" value={form.coat_type} onChange={(value) => updateField("coat_type", value)} placeholder="Coat type" />
                    <TextField label="Coat" value={form.coat} onChange={(value) => updateField("coat", value)} placeholder="Coat" />

                    <TextField label="Pattern" value={form.pattern} onChange={(value) => updateField("pattern", value)} placeholder="Pattern" />
                    <TextField label="Registry" value={form.registry} onChange={(value) => updateField("registry", value)} placeholder="Registry" />
                    <TextField label="DOB" type="date" value={form.dob} onChange={(value) => updateField("dob", value)} />
                    <TextField label="Registration No." value={form.registration_no} onChange={(value) => updateField("registration_no", value)} placeholder="Registration no." />

                    <TextField label="Microchip" value={form.microchip} onChange={(value) => updateField("microchip", value)} placeholder="Microchip number" />
                    <TextField label="Photo URL" value={form.photo_url} onChange={(value) => updateField("photo_url", value)} placeholder="Public photo URL" />
                    <TextField label="Image Path / URL" value={form.image_url} onChange={(value) => updateField("image_url", value)} placeholder="Storage path or URL" />
                    <TextField label="Weight Unit" value={form.weight_unit} onChange={(value) => updateField("weight_unit", value)} placeholder="oz / lb / g" />
                  </div>
                </SectionCard>

                <SectionCard title="Pricing & Visibility" subtitle="Keep internal reporting accurate while controlling what the public sees.">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <TextField label="Internal Sale Price" type="number" value={form.price} onChange={(value) => updateField("price", value)} placeholder="0.00" />
                    <TextField label="List Price" type="number" value={form.list_price} onChange={(value) => updateField("list_price", value)} placeholder="0.00" />
                    <TextField label="Deposit" type="number" value={form.deposit} onChange={(value) => updateField("deposit", value)} placeholder="0.00" />
                    <TextField label="Balance" type="number" value={form.balance} onChange={(value) => updateField("balance", value)} placeholder="0.00" />
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <StatCard
                      label="Public Price"
                      value={publicPriceHidden ? "Hidden" : formatMoneyOrDash(form.price || form.list_price)}
                      detail={publicPriceHidden ? "The current status hides public price automatically." : "This value can display on public surfaces."}
                    />
                    <StatCard
                      label="Internal Revenue"
                      value={formatMoneyOrDash(form.price)}
                      detail="Used for internal sales and lineage reporting."
                    />
                    <StatCard
                      label="Buyer Snapshot"
                      value={selectedBuyer ? formatMoneyOrDash(selectedBuyer.sale_price) : "Not linked"}
                      detail={selectedBuyer ? `Buyer deposit ${formatMoneyOrDash(selectedBuyer.deposit_amount)}` : "Link a buyer to compare buyer totals."}
                    />
                  </div>
                </SectionCard>

                <SectionCard title="Listing Copy & Internal Notes" subtitle="Public description stays separate from internal breeder notes.">
                  <div className="grid gap-4 xl:grid-cols-2">
                    <TextAreaField label="Public Listing Description" value={form.description} onChange={(value) => updateField("description", value)} placeholder="Public listing description" rows={6} />
                    <TextAreaField label="Internal Notes" value={form.notes} onChange={(value) => updateField("notes", value)} placeholder="Internal breeder notes" rows={6} />
                  </div>
                </SectionCard>

                <SectionCard title="Growth & Weights" subtitle="Birth, current weight, and weekly checkpoint tracking.">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <TextField label="Birth Weight" type="number" value={form.birth_weight} onChange={(value) => updateField("birth_weight", value)} placeholder="0" />
                    <TextField label="Current Weight" type="number" value={form.current_weight} onChange={(value) => updateField("current_weight", value)} placeholder="0" />
                    <TextField label="Weight Date" type="date" value={form.weight_date} onChange={(value) => updateField("weight_date", value)} />
                    <TextField label="Weight Unit" value={form.weight_unit} onChange={(value) => updateField("weight_unit", value)} placeholder="oz" />

                    <TextField label="Week 1" type="number" value={form.w_1} onChange={(value) => updateField("w_1", value)} placeholder="0" />
                    <TextField label="Week 2" type="number" value={form.w_2} onChange={(value) => updateField("w_2", value)} placeholder="0" />
                    <TextField label="Week 3" type="number" value={form.w_3} onChange={(value) => updateField("w_3", value)} placeholder="0" />
                    <TextField label="Week 4" type="number" value={form.w_4} onChange={(value) => updateField("w_4", value)} placeholder="0" />

                    <TextField label="Week 5" type="number" value={form.w_5} onChange={(value) => updateField("w_5", value)} placeholder="0" />
                    <TextField label="Week 6" type="number" value={form.w_6} onChange={(value) => updateField("w_6", value)} placeholder="0" />
                    <TextField label="Week 7" type="number" value={form.w_7} onChange={(value) => updateField("w_7", value)} placeholder="0" />
                    <TextField label="Week 8" type="number" value={form.w_8} onChange={(value) => updateField("w_8", value)} placeholder="0" />
                  </div>
                </SectionCard>

                <SectionCard title="Breeder Cost Tracking" subtitle="Wider cost sections keep totals readable and prevent the compressed card stack from the old layout.">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <TextField label="Tail Dock Cost" type="number" value={form.tail_dock_cost} onChange={(value) => updateField("tail_dock_cost", value)} placeholder="0.00" />
                    <TextField label="Dewclaw Cost" type="number" value={form.dewclaw_cost} onChange={(value) => updateField("dewclaw_cost", value)} placeholder="0.00" />
                    <TextField label="Vaccination Cost" type="number" value={form.vaccination_cost} onChange={(value) => updateField("vaccination_cost", value)} placeholder="0.00" />
                    <TextField label="Microchip Cost" type="number" value={form.microchip_cost} onChange={(value) => updateField("microchip_cost", value)} placeholder="0.00" />

                    <TextField label="Registration Cost" type="number" value={form.registration_cost} onChange={(value) => updateField("registration_cost", value)} placeholder="0.00" />
                    <TextField label="Other Vet Cost" type="number" value={form.other_vet_cost} onChange={(value) => updateField("other_vet_cost", value)} placeholder="0.00" />
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <StatCard
                      label="Itemized Costs"
                      value={fmtMoney(itemizedCostTotal)}
                      detail="Live total from the editable breeder cost fields."
                    />
                    <StatCard
                      label="Medical Total"
                      value={medicalTotalValue != null ? fmtMoney(num(medicalTotalValue)) : fmtMoney(itemizedCostTotal)}
                      detail="Saved medical total from the database, or the live preview while editing."
                    />
                    <StatCard
                      label="Visibility Rule"
                      value={publicPriceHidden ? "Price Hidden" : "Price Visible"}
                      detail="Reserved and completed puppy statuses automatically hide public pricing."
                    />
                  </div>
                </SectionCard>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void savePuppy()}
                  disabled={saving}
                  className="rounded-2xl bg-[linear-gradient(135deg,#c88c52_0%,#a56733_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(159,99,49,0.22)] transition hover:brightness-105 disabled:opacity-60"
                >
                  {saving ? "Saving..." : createMode ? "Create Puppy" : "Save Puppy"}
                </button>

                {!createMode ? (
                  <button
                    type="button"
                    onClick={() => void deletePuppy()}
                    disabled={deleting}
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:border-rose-300 disabled:opacity-60"
                  >
                    {deleting ? "Deleting..." : "Delete Puppy"}
                  </button>
                ) : null}

                {!detailOnly ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCreateMode(false);
                      setSelectedId("");
                      setStatusText("");
                    }}
                    className="rounded-2xl border border-[#e3d2bf] bg-white px-5 py-3 text-sm font-semibold text-[#6d4e35] transition hover:border-[#c9a67e]"
                  >
                    Close Editor
                  </button>
                ) : null}

                {!createMode && selectedPuppy ? (
                  <button
                    type="button"
                    onClick={() => openDetailWindow(selectedPuppy.id)}
                    className="rounded-2xl border border-[#dcc7b0] bg-white px-5 py-3 text-sm font-semibold text-[#6d4e35] transition hover:border-[#c9a67e]"
                  >
                    Open This Record in New Window
                  </button>
                ) : null}
              </div>
            </AdminPanel>
          </div>
        ) : null}
      </div>
    </AdminPageShell>
  );
}
