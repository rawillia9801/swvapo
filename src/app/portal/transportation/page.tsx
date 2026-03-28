"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Dog,
  Printer,
  RefreshCw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { sb } from "@/lib/utils";

type PickupRequestStatus =
  | "pending"
  | "approved"
  | "declined"
  | "completed"
  | "cancelled";

type PickupRequestType =
  | "pickup"
  | "meet"
  | "dropoff"
  | "transportation";

type PuppyMeta = {
  id: number;
  call_name?: string | null;
  name?: string | null;
  sex?: string | null;
  dob?: string | null;
  status?: string | null;
};

type BuyerLike = {
  user_id?: string | null;
  email?: string | null;
  buyer_email?: string | null;
  puppy_id?: number | null;
  assigned_puppy_id?: number | null;
  selected_puppy_id?: number | null;
  puppyId?: number | null;
};

type PortalUser = {
  id: string;
  email?: string | null;
};

type QueryFilter = {
  col: string;
  value: string | number | null | undefined;
};

type RequestDateRow = {
  request_date?: string | null;
};

type PickupRequestRow = {
  id: number;
  request_date: string | null;
  request_type: PickupRequestType | null;
  miles: number | null;
  location_text: string | null;
  address_text: string | null;
  notes: string | null;
  status: PickupRequestStatus | string | null;
};

const FREE_MILES_ONE_WAY = 50;
const RATE_PER_MILE = 1.25;
const MINIMUM_DELIVERY_FEE = 75;
const LOCAL_DELIVERY_RADIUS = 200;

function firstOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isoFromParts(year: number, month1: number, day: number) {
  return `${year}-${String(month1).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const dt = new Date(`${iso}T00:00:00`);
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function todayIso() {
  return toIsoDate(new Date());
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function calculateTransportEstimate(
  type: PickupRequestType | "",
  milesRaw: string | number | null | undefined
) {
  const normalizedType = String(type || "").toLowerCase() as PickupRequestType | "";
  const miles =
    typeof milesRaw === "number"
      ? milesRaw
      : milesRaw === null || milesRaw === undefined || milesRaw === ""
        ? NaN
        : Number(milesRaw);

  if (normalizedType === "pickup") {
    return {
      fee: 0,
      label: formatMoney(0),
      detail: "Pickup at our location does not include a transportation fee.",
    };
  }

  if (normalizedType === "transportation") {
    return {
      fee: null,
      label: "Custom quote required",
      detail:
        "Flight nanny, courier, and third-party transportation are priced separately and confirmed before scheduling.",
    };
  }

  if (normalizedType === "meet" || normalizedType === "dropoff") {
    if (!Number.isFinite(miles) || miles < 0) {
      return {
        fee: null,
        label: "Enter mileage",
        detail: `The first ${FREE_MILES_ONE_WAY} miles are free. Beyond that, pricing is ${formatMoney(
          RATE_PER_MILE
        )} per mile one-way with a ${formatMoney(
          MINIMUM_DELIVERY_FEE
        )} minimum fee beyond the free-mile zone.`,
      };
    }

    if (miles <= FREE_MILES_ONE_WAY) {
      return {
        fee: 0,
        label: formatMoney(0),
        detail: `This trip is within the first ${FREE_MILES_ONE_WAY} one-way miles included at no charge.`,
      };
    }

    const billableMiles = miles - FREE_MILES_ONE_WAY;
    const rawFee = billableMiles * RATE_PER_MILE;
    const fee = Math.max(MINIMUM_DELIVERY_FEE, rawFee);

    let detail = `${billableMiles.toFixed(1).replace(/\.0$/, "")} billable one-way miles × ${formatMoney(
      RATE_PER_MILE
    )} = ${formatMoney(rawFee)}. Minimum fee policy applies beyond ${FREE_MILES_ONE_WAY} miles.`;

    if (miles > LOCAL_DELIVERY_RADIUS) {
      detail += ` This request is beyond the normal ${LOCAL_DELIVERY_RADIUS}-mile local range and may require breeder approval or added travel arrangements.`;
    }

    return {
      fee,
      label: formatMoney(fee),
      detail,
    };
  }

  return {
    fee: null,
    label: "—",
    detail: "Select a request type to see how pricing applies.",
  };
}

const inputClass =
  "w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-200/60";

export default function PortalTransportationPage() {
  const router = useRouter();

  const [user, setUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [puppyId, setPuppyId] = useState<number | null>(null);
  const [puppyMeta, setPuppyMeta] = useState<PuppyMeta | null>(null);

  const [month, setMonth] = useState<Date>(firstOfMonth(new Date()));
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState("");

  const [requestType, setRequestType] = useState<PickupRequestType | "">("");
  const [miles, setMiles] = useState("");
  const [locationText, setLocationText] = useState("");
  const [addressText, setAddressText] = useState("");
  const [notes, setNotes] = useState("");
  const [latestRequest, setLatestRequest] = useState<PickupRequestRow | null>(null);

  const [alertText, setAlertText] = useState("");
  const [successText, setSuccessText] = useState("");

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      try {
        const {
          data: { session },
        } = await sb.auth.getSession();

        const currentUser = (session?.user as PortalUser) ?? null;

        if (!mounted) return;

        if (!currentUser) {
          router.push("/portal");
          return;
        }

        setUser(currentUser);

        const resolvedPuppyId = await resolveAssignedPuppyId(currentUser);
        if (!mounted) return;

        setPuppyId(resolvedPuppyId);

        if (resolvedPuppyId) {
          const meta = await fetchPuppyMeta(resolvedPuppyId);
          if (!mounted) return;
          setPuppyMeta(meta);
        }

        await loadBlockedDates(firstOfMonth(new Date()));
        await loadLatestRequest(currentUser);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    boot();

    const { data: authListener } = sb.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = (session?.user as PortalUser) ?? null;
        if (!mounted) return;

        if (!currentUser) {
          setUser(null);
          router.push("/portal");
          return;
        }

        setUser(currentUser);
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
    // We intentionally subscribe once on mount and refresh state from auth callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function safeSelectFirst(
    table: string,
    filters: QueryFilter[]
  ) {
    try {
      let query = sb.from(table).select("*").limit(1);
      for (const filter of filters) {
        query = query.eq(filter.col, filter.value);
      }
      const { data, error } = await query;
      if (error) return null;
      return data?.[0] ?? null;
    } catch {
      return null;
    }
  }

  async function resolveAssignedPuppyId(currUser: PortalUser) {
    const uid = currUser.id;
    const email = String(currUser.email || "").toLowerCase();

    const candidates: Array<{
      table: string;
      filters: QueryFilter[];
    }> = [
      { table: "bp_buyers", filters: [{ col: "user_id", value: uid }] },
      { table: "bp_buyers", filters: [{ col: "email", value: email }] },
      { table: "buyers", filters: [{ col: "user_id", value: uid }] },
      { table: "buyers", filters: [{ col: "email", value: email }] },
      { table: "buyers", filters: [{ col: "buyer_email", value: email }] },
      { table: "buyer_assigned", filters: [{ col: "user_id", value: uid }] },
      { table: "buyer_assigned", filters: [{ col: "email", value: email }] },
      { table: "applications", filters: [{ col: "user_id", value: uid }] },
      { table: "puppy_applications", filters: [{ col: "user_id", value: uid }] },
    ];

    for (const candidate of candidates) {
      const row = (await safeSelectFirst(
        candidate.table,
        candidate.filters
      )) as BuyerLike | null;

      if (!row) continue;

      const pid =
        row.puppy_id ??
        row.assigned_puppy_id ??
        row.selected_puppy_id ??
        row.puppyId;

   if (pid !== null && pid !== undefined) {
        return Number(pid);
      }
    }

    return null;
  }
async function fetchPuppyMeta(id: number): Promise<PuppyMeta> {
  const tryQueries = [
    "id,call_name,name,sex,dob,status",
    "id,name,status",
    "id",
  ];

  for (const query of tryQueries) {
    try {
      const { data, error } = await sb
        .from("puppies")
        .select(query)
        .eq("id", id)
        .limit(1);

      if (error || !data?.[0]) continue;
const row = data[0] as unknown as Record<string, unknown>;
      if (typeof row.id === "number") {
        return {
          id: row.id,
          call_name:
            typeof row.call_name === "string" ? row.call_name : null,
          name: typeof row.name === "string" ? row.name : null,
          sex: typeof row.sex === "string" ? row.sex : null,
          dob: typeof row.dob === "string" ? row.dob : null,
          status: typeof row.status === "string" ? row.status : null,
        };
      }
    } catch {}
  }

  return { id };
}

  async function loadBlockedDates(targetMonth: Date) {
    const year = targetMonth.getFullYear();
    const monthIndex = targetMonth.getMonth();
    const start = isoFromParts(year, monthIndex + 1, 1);
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    const end = isoFromParts(year, monthIndex + 1, lastDay);

    try {
      const { data, error } = await sb
        .from("portal_pickup_requests")
        .select("request_date,status")
        .gte("request_date", start)
        .lte("request_date", end)
        .in("status", ["pending", "approved"]);

      if (error) throw error;

      const next = new Set<string>();
      ((data as RequestDateRow[] | null) || []).forEach((row) => {
        if (row.request_date) next.add(row.request_date);
      });

      setMonth(targetMonth);
      setBlockedDates(next);
    } catch {
      setAlertText(
        "Calendar availability depends on the portal_pickup_requests table being present and readable."
      );
      setBlockedDates(new Set());
      setMonth(targetMonth);
    }
  }

  async function checkDateAvailable(iso: string) {
    try {
      const { data, error } = await sb
        .from("portal_pickup_requests")
        .select("id")
        .eq("request_date", iso)
        .in("status", ["pending", "approved"])
        .limit(1);

      if (error) throw error;
      return !(data && data.length);
    } catch {
      return true;
    }
  }

  async function refreshAll() {
    setAlertText("");
    setSuccessText("");
    await loadBlockedDates(month);
    if (user) await loadLatestRequest(user);
  }

  async function loadLatestRequest(currentUser: PortalUser) {
    try {
      const { data, error } = await sb
        .from("portal_pickup_requests")
        .select("id,request_date,request_type,miles,location_text,address_text,notes,status")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setLatestRequest((data as PickupRequestRow | null) ?? null);
    } catch {
      setLatestRequest(null);
    }
  }

  const puppyName =
    puppyMeta?.call_name ||
    puppyMeta?.name ||
    (puppyId ? `Puppy #${puppyId}` : "No puppy assigned");

  const puppyMetaLine = useMemo(() => {
    if (!puppyMeta && !puppyId) {
      return "If this is unexpected, please message us so we can link your account to your puppy.";
    }

    const parts: string[] = [];
    if (puppyMeta?.sex) parts.push(puppyMeta.sex);
    if (puppyMeta?.dob) {
      parts.push(`DOB ${formatDate(String(puppyMeta.dob).slice(0, 10))}`);
    }
    if (puppyMeta?.status) parts.push(puppyMeta.status);

    return parts.length ? parts.join(" • ") : "Puppy assignment found.";
  }, [puppyMeta, puppyId]);

  const selectedAvailability = useMemo(() => {
    if (!selectedDate) {
      return {
        title: "—",
        hint: "Blocked days are not selectable.",
      };
    }

    if (blockedDates.has(selectedDate)) {
      return {
        title: "Blocked",
        hint: "That date already has a request. Please choose another day.",
      };
    }

    return {
      title: "Available",
      hint: "That date can be reserved when you submit.",
    };
  }, [blockedDates, selectedDate]);

  const showMeetDropFields =
    requestType === "meet" || requestType === "dropoff";

  const showTransportationFields = requestType === "transportation";
  const requestEstimate = useMemo(
    () => calculateTransportEstimate(requestType, miles),
    [requestType, miles]
  );
  const currentRequestEstimate = useMemo(
    () =>
      latestRequest
        ? calculateTransportEstimate(latestRequest.request_type || "", latestRequest.miles)
        : null,
    [latestRequest]
  );

  const calendarDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const firstDayOfWeek = first.getDay();
    const daysInMonth = new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      0
    ).getDate();

    const cells: Array<
      | { type: "blank"; key: string }
      | {
          type: "day";
          key: string;
          day: number;
          iso: string;
          blocked: boolean;
          past: boolean;
          selected: boolean;
        }
    > = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ type: "blank", key: `blank-${i}` });
    }

    const today = todayIso();

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = isoFromParts(month.getFullYear(), month.getMonth() + 1, day);
      cells.push({
        type: "day",
        key: iso,
        day,
        iso,
        blocked: blockedDates.has(iso),
        past: iso < today,
        selected: selectedDate === iso,
      });
    }

    return cells;
  }, [month, blockedDates, selectedDate]);

  async function handleDayClick(iso: string) {
    setAlertText("");
    setSuccessText("");

    const available = await checkDateAvailable(iso);
    if (!available) {
      await loadBlockedDates(month);
      if (user) await loadLatestRequest(user);
      setSelectedDate("");
      setAlertText(
        "That day was just taken by another client. Please choose another day."
      );
      return;
    }

    setSelectedDate(iso);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user) return;

    setAlertText("");
    setSuccessText("");

    if (!requestType) {
      setAlertText("Please choose a request type.");
      return;
    }

    if (!selectedDate) {
      setAlertText("Please choose a day on the calendar.");
      return;
    }

    if (blockedDates.has(selectedDate)) {
      setAlertText("That date is already blocked. Please choose another day.");
      return;
    }

    if (showMeetDropFields) {
      if (!locationText.trim()) {
        setAlertText("Please enter the proposed meet or drop location.");
        return;
      }

      if (!miles.trim()) {
        setAlertText("Please enter the one-way miles.");
        return;
      }
    }

    setBusy(true);

    try {
      const stillAvailable = await checkDateAvailable(selectedDate);

      if (!stillAvailable) {
        await loadBlockedDates(month);
        setSelectedDate("");
        setAlertText(
          "That day was just taken by another client. Please choose another day."
        );
        setBusy(false);
        return;
      }

      const payload = {
        user_id: user.id,
        puppy_id: puppyId,
        request_date: selectedDate,
        request_type: requestType,
        miles: showMeetDropFields ? Number(miles) : null,
        location_text: showMeetDropFields ? locationText.trim() || null : null,
        address_text: showMeetDropFields ? addressText.trim() || null : null,
        notes: notes.trim() || null,
      };

      const { error } = await sb
        .from("portal_pickup_requests")
        .insert(payload);

      if (error) {
        const message = String(error.message || "").toLowerCase();

        if (
          message.includes("duplicate") ||
          message.includes("unique") ||
          message.includes("uq_portal_pickup_requests_request_date")
        ) {
          await loadBlockedDates(month);
          setSelectedDate("");
          throw new Error(
            "That day was just taken by another client. Please choose another day."
          );
        }

        throw error;
      }

      await loadBlockedDates(month);
      setSuccessText(
        "Request submitted. We’ll confirm details through Messages."
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unable to submit the request.";
      setAlertText(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOutRedirect() {
    await sb.auth.signOut();
    router.push("/portal");
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center rounded-[28px] border border-slate-200 bg-white px-6 py-16 text-slate-500 shadow-sm">
        Loading transportation page...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-[30px] border border-slate-200 bg-white px-6 py-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:px-8 sm:py-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
              <Truck className="h-4 w-4" />
              Transporation
            </div>

            <h1 className="mt-4 font-serif text-3xl leading-tight text-slate-900 sm:text-4xl">
              Pickup / Meet / Delivery Request
            </h1>

            <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-600 sm:text-[15px]">
              Use this page to request pickup at our location, a public meet-up,
              a drop-off arrangement, or transportation planning for your puppy.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={refreshAll}
              className="inline-flex items-center gap-2 rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>

            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-[16px] bg-[#0f1938] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(15,25,56,0.24)] transition hover:bg-[#15214a]"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-[24px] border border-emerald-200 bg-emerald-50/70 p-5">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900">
                Scheduling Policy
              </h2>

              <ul className="mt-3 space-y-2 text-sm font-medium leading-6 text-slate-700">
                <li>
                  Only <span className="font-bold">one request per day</span> is
                  allowed across all portal clients.
                </li>
                <li>
                  Your request is saved as <span className="font-bold">Pending</span>{" "}
                  until we confirm final details.
                </li>
                <li>
                  If plans change, please message us as soon as possible so we can
                  help move you to another open date.
                </li>
                <li>
                  Meet-up and drop-off requests may include a mileage-based travel fee.
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatusCard
            label="Assigned Puppy"
            title={puppyName}
            subtitle={puppyMetaLine}
            icon={<Dog className="h-5 w-5" />}
          />

          <StatusCard
            label="Selected Day"
            title={selectedDate ? formatDate(selectedDate) : "—"}
            subtitle={
              selectedDate
                ? "This date will be reserved if it is still available when submitted."
                : "Choose a date from the calendar."
            }
            icon={<CalendarDays className="h-5 w-5" />}
          />

          <StatusCard
            label="Availability"
            title={selectedAvailability.title}
            subtitle={selectedAvailability.hint}
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
        </div>
      </section>

      {alertText ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-800 shadow-sm">
          {alertText}
        </div>
      ) : null}

      {successText ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800 shadow-sm">
          {successText}
        </div>
      ) : null}

      <section className="rounded-[30px] border border-[#dccab7] bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-7">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-7">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
                Current Request
              </div>
              <h2 className="mt-2 font-serif text-2xl text-slate-900">
                Your latest transportation request
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <PolicyCard
                label="Request Date"
                value={latestRequest?.request_date ? formatDate(latestRequest.request_date) : "—"}
                detail="Most recent saved request"
              />
              <PolicyCard
                label="Type"
                value={latestRequest?.request_type ? latestRequest.request_type.replace(/^./, (c) => c.toUpperCase()) : "—"}
                detail="Pickup, meet, drop-off, or transportation"
              />
              <PolicyCard
                label="Miles"
                value={
                  latestRequest?.miles !== null && latestRequest?.miles !== undefined
                    ? String(latestRequest.miles)
                    : "—"
                }
                detail="One-way mileage"
              />
              <PolicyCard
                label="Estimated Fee"
                value={currentRequestEstimate?.label || "—"}
                detail="Based on current pricing policy"
              />
            </div>

            {latestRequest?.location_text || latestRequest?.address_text || latestRequest?.notes ? (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <InfoDetail
                    label="Location"
                    value={latestRequest.location_text || latestRequest.address_text || "—"}
                  />
                  <InfoDetail
                    label="Status"
                    value={latestRequest.status || "pending"}
                  />
                </div>
                {latestRequest.notes ? (
                  <div className="mt-4 text-sm font-medium leading-6 text-slate-700">
                    {latestRequest.notes}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="rounded-[28px] border border-[#e2cfba] bg-[linear-gradient(180deg,#fffaf3_0%,#fff_100%)] p-6 xl:col-span-5">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
              Pricing Policy
            </div>
            <h3 className="mt-2 font-serif text-2xl font-bold text-[#3b271b]">
              Transportation pricing
            </h3>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <PolicyCard label="Free Mileage" value="First 50 miles" detail="One-way from Marion, VA" />
              <PolicyCard label="After 50 Miles" value="$1.25 / mile" detail="One-way rate" />
              <PolicyCard label="Minimum Fee" value="$75" detail="Beyond the free-mile zone" />
              <PolicyCard label="Local Range" value="200 miles" detail="Longer trips by approval" />
            </div>

            <div className="mt-5 space-y-2 text-sm font-medium leading-6 text-slate-700">
              <p>One request per day total is allowed across all portal clients.</p>
              <p>Pending and approved requests block the day for other clients.</p>
              <p>Pickup at our location does not include a transportation fee.</p>
              <p>Meet-up and drop-off pricing uses the mileage policy above.</p>
              <p>Longer distances may require added travel costs or breeder approval.</p>
              <p>Transportation, flight nanny, or courier arrangements are quoted separately.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="xl:col-span-5 rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Calendar
              </div>
              <h2 className="mt-2 font-serif text-2xl text-slate-900">
                Choose a Day
              </h2>
              <p className="mt-2 text-sm font-medium text-slate-600">
                Blocked dates already have a pending or approved request.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  loadBlockedDates(
                    firstOfMonth(
                      new Date(month.getFullYear(), month.getMonth() - 1, 1)
                    )
                  )
                }
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() =>
                  loadBlockedDates(
                    firstOfMonth(
                      new Date(month.getFullYear(), month.getMonth() + 1, 1)
                    )
                  )
                }
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="text-sm font-bold text-slate-900">
              {month.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </div>
            <div className="text-xs font-semibold text-slate-500">
              Today: <span className="text-slate-700">{formatDate(todayIso())}</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-2 text-center text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-2">
            {calendarDays.map((cell) => {
              if (cell.type === "blank") {
                return <div key={cell.key} className="h-12" />;
              }

              const disabled = cell.past || cell.blocked;
              const className = [
                "h-12 rounded-2xl border text-sm font-semibold transition",
                cell.selected
                  ? "border-emerald-700 bg-emerald-600 text-white shadow-[0_0_0_4px_rgba(16,185,129,0.16)]"
                  : cell.blocked
                  ? "cursor-not-allowed border-slate-300 bg-slate-200 text-slate-500"
                  : cell.past
                  ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300"
                  : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
              ].join(" ");

              return (
                <button
                  key={cell.key}
                  type="button"
                  disabled={disabled}
                  className={className}
                  onClick={() => handleDayClick(cell.iso)}
                  title={
                    cell.past
                      ? "Past date"
                      : cell.blocked
                      ? "Already requested"
                      : "Available"
                  }
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-5 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-700">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" />
              Selected
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-slate-300" />
              Blocked
            </div>
          </div>
        </section>

        <section className="xl:col-span-7 rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-7">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
              Request
            </div>
            <h2 className="mt-2 font-serif text-2xl text-slate-900">
              Transportation Details
            </h2>
            <p className="mt-2 text-sm font-medium text-slate-600">
              Complete the form below to request pickup, a meet-up, drop-off, or transportation planning.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <Label>Request Type</Label>
                <select
                  value={requestType}
                  onChange={(e) =>
                    setRequestType(e.target.value as PickupRequestType | "")
                  }
                  className={inputClass}
                  required
                >
                  <option value="">Select…</option>
                  <option value="pickup">Pickup (at our location)</option>
                  <option value="meet">Meet-up (public location)</option>
                  <option value="dropoff">Drop-off (to your area)</option>
                  <option value="transportation">
                    Transportation / Flight Nanny / Courier
                  </option>
                </select>
              </Field>

              <Field>
                <Label>Selected Day</Label>
                <input
                  type="date"
                  value={selectedDate}
                  readOnly
                  className={`${inputClass} bg-slate-50`}
                />
                <HelperText>
                  Choose a date from the calendar to fill this in automatically.
                </HelperText>
              </Field>
            </div>

            {showMeetDropFields ? (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field>
                    <Label>Miles (one-way)</Label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={miles}
                      onChange={(e) => setMiles(e.target.value)}
                      className={inputClass}
                      placeholder="e.g. 25"
                      required={showMeetDropFields}
                    />
                  </Field>

                  <Field>
                    <Label>Proposed Meet / Drop Location</Label>
                    <input
                      type="text"
                      value={locationText}
                      onChange={(e) => setLocationText(e.target.value)}
                      className={inputClass}
                      placeholder="e.g. Exit 17 Park & Ride, Bristol"
                      required={showMeetDropFields}
                    />
                  </Field>
                </div>

                <div className="mt-4">
                  <Field>
                    <Label>Address (optional)</Label>
                    <input
                      type="text"
                      value={addressText}
                      onChange={(e) => setAddressText(e.target.value)}
                      className={inputClass}
                      placeholder="Street / City / State"
                    />
                  </Field>
                </div>
              </div>
            ) : null}

            {showTransportationFields ? (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 text-sm font-medium leading-6 text-slate-700">
                For transportation requests, include helpful details in the notes below,
                such as airport, nearest major city, preferred carrier, or any timing limits. Transportation pricing is arranged separately and must be confirmed before scheduling.
              </div>
            ) : null}

            <div className="rounded-[24px] border border-[#e2cfba] bg-[#fffaf3] p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
                Estimated Transportation Fee
              </div>
              <div className="mt-2 text-2xl font-extrabold text-slate-900">
                {requestEstimate.label}
              </div>
              <div className="mt-2 text-[12px] font-semibold leading-6 text-slate-600">
                {requestEstimate.detail}
              </div>
            </div>

            <Field>
              <Label>Notes</Label>
              <textarea
                rows={5}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`${inputClass} resize-none`}
                placeholder="Any details you want us to know..."
              />
            </Field>

            <div className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-slate-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-slate-600">
                Submitting creates a pending request and reserves the selected day if it is still open.
              </p>

              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-[16px] bg-[#0f1938] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(15,25,56,0.24)] transition hover:bg-[#15214a] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </form>
        </section>
      </div>

      <div className="flex flex-col items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500 shadow-sm sm:flex-row">
        <span>Southwest Virginia Chihuahua • Pickup / Meet / Delivery</span>

        <button
          onClick={handleSignOutRedirect}
          className="text-sm font-semibold text-slate-700 transition hover:text-slate-900"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function StatusCard({
  label,
  title,
  subtitle,
  icon,
}: {
  label: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50/60 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
          {icon}
        </div>

        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            {label}
          </div>
          <div className="mt-1 text-lg font-bold text-slate-900">{title}</div>
          <div className="mt-1 text-sm font-medium leading-6 text-slate-600">
            {subtitle}
          </div>
        </div>
      </div>
    </div>
  );
}

function PolicyCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[22px] border border-[#e2cfba] bg-white/80 p-4 shadow-sm">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
        {label}
      </div>
      <div className="mt-1 text-lg font-extrabold text-slate-900">{value}</div>
      <div className="mt-1 text-[12px] font-semibold leading-5 text-slate-500">{detail}</div>
    </div>
  );
}

function InfoDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9c7b58]">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
      {children}
    </label>
  );
}

function HelperText({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-xs font-medium text-slate-500">{children}</p>;
}
