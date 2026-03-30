"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { sb } from "@/lib/utils";
import {
  PortalHeroPrimaryAction,
  PortalHeroSecondaryAction,
  PortalInfoTile,
  PortalMetricCard,
  PortalMetricGrid,
  PortalPageHero,
  PortalPanel,
} from "@/components/portal/luxury-shell";

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
  if (!iso) return "-";
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
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatRequestType(value: PickupRequestType | "" | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "-";
  if (normalized === "dropoff") return "Drop-off";
  if (normalized === "transportation") return "Transportation";
  if (normalized === "pickup") return "Pickup";
  if (normalized === "meet") return "Meet-up";
  return normalized.replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatRequestStatus(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Pending";
  if (normalized === "approved") return "Approved";
  if (normalized === "declined") return "Declined";
  if (normalized === "cancelled") return "Cancelled";
  if (normalized === "completed") return "Completed";
  return normalized.replace(/\b\w/g, (match) => match.toUpperCase());
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

    let detail = `${billableMiles.toFixed(1).replace(/\.0$/, "")} billable one-way miles x ${formatMoney(
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
    label: "-",
    detail: "Select a request type to see how pricing applies.",
  };
}

const inputClass =
  "w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm text-[#3e2a1f] outline-none transition focus:border-[#c8a884]";

export default function PortalTransportationPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
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

        const currentUser = session?.user ?? null;
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

    void boot();

    const { data: authListener } = sb.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;
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
  // We only need the initial auth bootstrap and router redirect wiring here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function safeSelectFirst(table: string, filters: QueryFilter[]) {
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

  async function resolveAssignedPuppyId(currentUser: User) {
    const uid = currentUser.id;
    const email = String(currentUser.email || "").toLowerCase();

    const candidates: Array<{ table: string; filters: QueryFilter[] }> = [
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
      const row = (await safeSelectFirst(candidate.table, candidate.filters)) as BuyerLike | null;
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
    const tryQueries = ["id,call_name,name,sex,dob,status", "id,name,status", "id"];

    for (const query of tryQueries) {
      try {
        const { data, error } = await sb.from("puppies").select(query).eq("id", id).limit(1);
        if (error || !data?.[0]) continue;

        const row = data[0] as unknown as Record<string, unknown>;
        if (typeof row.id === "number") {
          return {
            id: row.id,
            call_name: typeof row.call_name === "string" ? row.call_name : null,
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
      (((data as RequestDateRow[] | null) || [])).forEach((row) => {
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

  async function loadLatestRequest(currentUser: User) {
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
    if (puppyMeta?.dob) parts.push(`DOB ${formatDate(String(puppyMeta.dob).slice(0, 10))}`);

    const buyerStatus = String(puppyMeta?.status || "").toLowerCase();
    if (buyerStatus.includes("sold") || buyerStatus.includes("reserved") || buyerStatus.includes("assigned")) {
      parts.push("Matched");
    } else if (puppyMeta?.status) {
      parts.push(puppyMeta.status);
    }

    return parts.length ? parts.join(" - ") : "Puppy assignment found.";
  }, [puppyId, puppyMeta]);

  const selectedAvailability = useMemo(() => {
    if (!selectedDate) {
      return {
        title: "-",
        hint: "Blocked days are not selectable.",
      };
    }

    if (blockedDates.has(selectedDate)) {
      return {
        title: "Blocked",
        hint: "That day already has a request on file.",
      };
    }

    return {
      title: "Available",
      hint: "That date can be reserved when you submit.",
    };
  }, [blockedDates, selectedDate]);

  const showMeetDropFields = requestType === "meet" || requestType === "dropoff";
  const showTransportationFields = requestType === "transportation";

  const requestEstimate = useMemo(
    () => calculateTransportEstimate(requestType, miles),
    [miles, requestType]
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
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

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

    for (let i = 0; i < firstDayOfWeek; i += 1) {
      cells.push({ type: "blank", key: `blank-${i}` });
    }

    const today = todayIso();

    for (let day = 1; day <= daysInMonth; day += 1) {
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
  }, [blockedDates, month, selectedDate]);

  async function handleDayClick(iso: string) {
    setAlertText("");
    setSuccessText("");

    const available = await checkDateAvailable(iso);
    if (!available) {
      await loadBlockedDates(month);
      if (user) await loadLatestRequest(user);
      setSelectedDate("");
      setAlertText("That day was just taken by another client. Please choose another day.");
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
      setAlertText("That day is already blocked. Please choose another day.");
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
        setAlertText("That day was just taken by another client. Please choose another day.");
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

      const { error } = await sb.from("portal_pickup_requests").insert(payload);

      if (error) {
        const message = String(error.message || "").toLowerCase();
        if (
          message.includes("duplicate") ||
          message.includes("unique") ||
          message.includes("uq_portal_pickup_requests_request_date")
        ) {
          await loadBlockedDates(month);
          setSelectedDate("");
          throw new Error("That day was just taken by another client. Please choose another day.");
        }
        throw error;
      }

      await loadBlockedDates(month);
      await loadLatestRequest(user);
      setSuccessText("Request submitted. We'll confirm details through Messages.");
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
      <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">
        Loading transportation details...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Transporation"
        title="Plan pickup, meet-up, delivery, or transportation with the same calm experience as the rest of your portal."
        description="This page keeps scheduling organized before go-home day, while still staying useful afterward whenever travel details or handoff records need to be revisited."
        actions={
          <>
            <PortalHeroPrimaryAction href="/portal/messages">Open Messages</PortalHeroPrimaryAction>
            <PortalHeroSecondaryAction href="/portal/resources">Open Resources</PortalHeroSecondaryAction>
          </>
        }
        aside={
          <div className="space-y-4">
            <PortalInfoTile
              label="My Puppy"
              value={puppyName}
              detail={puppyMetaLine}
            />
            <PortalInfoTile
              label="Current Estimate"
              value={requestEstimate.label}
              detail={requestEstimate.detail}
            />
          </div>
        }
      />

      {alertText ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-800">
          {alertText}
        </div>
      ) : null}

      {successText ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">
          {successText}
        </div>
      ) : null}

      <PortalPanel
        title="Scheduling Policy"
        subtitle="The calendar is designed to keep pickup and transportation requests orderly, fair, and easy to confirm."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <PolicyCard
            label="One Request Per Day"
            value="Protected scheduling"
            detail="Pending and approved requests block the day for other portal families."
          />
          <PolicyCard
            label="Pickup"
            value="No added fee"
            detail="Pickup at our location does not include a transportation fee."
          />
          <PolicyCard
            label="Meet / Drop-Off"
            value="Mileage pricing"
            detail="The first 50 miles are free. Beyond that, the mileage policy applies."
          />
          <PolicyCard
            label="Transportation"
            value="Custom quote"
            detail="Flight nanny and courier arrangements are quoted separately and confirmed before scheduling."
          />
        </div>
      </PortalPanel>

      <PortalMetricGrid>
        <PortalMetricCard
          label="My Puppy"
          value={puppyName}
          detail={puppyMetaLine}
          href="/portal/mypuppy"
          actionLabel="Open My Puppy"
        />
        <PortalMetricCard
          label="Selected Day"
          value={selectedDate ? formatDate(selectedDate) : "-"}
          detail={
            selectedDate
              ? "This day will be reserved if it is still available when submitted."
              : "Choose a date from the calendar."
          }
        />
        <PortalMetricCard
          label="Availability"
          value={selectedAvailability.title}
          detail={selectedAvailability.hint}
          accent="from-[#dce9d6] via-[#b6cfaa] to-[#7e9c6f]"
        />
        <PortalMetricCard
          label="Estimated Fee"
          value={requestEstimate.label}
          detail={requestEstimate.detail}
          accent="from-[#f0dcc1] via-[#ddb68c] to-[#c98743]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_400px]">
        <div className="space-y-6">
          <PortalPanel
            title="Current Request"
            subtitle="The latest transportation-related request saved under your account appears here."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
              <PolicyCard
                label="Request Date"
                value={latestRequest?.request_date ? formatDate(latestRequest.request_date) : "-"}
                detail="Most recent saved request"
              />
              <PolicyCard
                label="Type"
                value={formatRequestType(latestRequest?.request_type || "")}
                detail="Pickup, meet-up, drop-off, or transportation"
              />
              <PolicyCard
                label="Miles"
                value={
                  latestRequest?.miles !== null && latestRequest?.miles !== undefined
                    ? String(latestRequest.miles)
                    : "-"
                }
                detail="One-way mileage"
              />
              <PolicyCard
                label="Estimated Fee"
                value={currentRequestEstimate?.label || "-"}
                detail="Based on the current transportation policy"
              />
            </div>

            {latestRequest?.location_text || latestRequest?.address_text || latestRequest?.notes ? (
              <div className="mt-5 rounded-[24px] border border-[#ead9c7] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2e9_100%)] p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <InfoDetail
                    label="Location"
                    value={latestRequest.location_text || latestRequest.address_text || "-"}
                  />
                  <InfoDetail
                    label="Status"
                    value={formatRequestStatus(latestRequest.status)}
                  />
                </div>

                {latestRequest.notes ? (
                  <div className="mt-4 text-sm leading-7 text-[#73583f]">{latestRequest.notes}</div>
                ) : null}
              </div>
            ) : null}
          </PortalPanel>

          <PortalPanel
            title="Choose a Day"
            subtitle="Blocked dates already have a pending or approved request, so only open dates can be selected."
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm font-semibold text-[#2f2218]">
                {month.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    loadBlockedDates(firstOfMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)))
                  }
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-[#e4d3c2] bg-white px-4 text-[#5d4330] transition hover:border-[#d4b48b]"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() =>
                    loadBlockedDates(firstOfMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)))
                  }
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-[#e4d3c2] bg-white px-4 text-[#5d4330] transition hover:border-[#d4b48b]"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a47946]">
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
                    ? "border-[#b5752f] bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] text-white shadow-[0_0_0_4px_rgba(181,117,47,0.16)]"
                    : cell.blocked
                      ? "cursor-not-allowed border-[#e4d8cb] bg-[#f0ebe6] text-[#9f8c78]"
                      : cell.past
                        ? "cursor-not-allowed border-[#efe7de] bg-[#faf6f1] text-[#c5b8aa]"
                        : "border-[#e4d3c2] bg-white text-[#2f2218] hover:border-[#d4b48b]",
                ].join(" ");

                return (
                  <button
                    key={cell.key}
                    type="button"
                    disabled={disabled}
                    className={className}
                    onClick={() => handleDayClick(cell.iso)}
                    title={cell.past ? "Past date" : cell.blocked ? "Already requested" : "Available"}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-[22px] border border-[#ead9c7] bg-[#fff9f2] px-4 py-4 text-sm text-[#73583f]">
              Today: <span className="font-semibold text-[#2f2218]">{formatDate(todayIso())}</span>
            </div>
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel
            title="Transportation Request"
            subtitle="Complete the form below to request pickup, a public meet-up, drop-off, or transportation planning."
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field>
                <Label>Request Type</Label>
                <select
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value as PickupRequestType | "")}
                  className={inputClass}
                  required
                >
                  <option value="">Select...</option>
                  <option value="pickup">Pickup (at our location)</option>
                  <option value="meet">Meet-up (public location)</option>
                  <option value="dropoff">Drop-off (to your area)</option>
                  <option value="transportation">Transportation / Flight Nanny / Courier</option>
                </select>
              </Field>

              <Field>
                <Label>Selected Day</Label>
                <input type="date" value={selectedDate} readOnly className={`${inputClass} bg-[#faf6f1]`} />
                <HelperText>Choose a date from the calendar to fill this in automatically.</HelperText>
              </Field>

              {showMeetDropFields ? (
                <div className="rounded-[24px] border border-[#ead9c7] bg-[#fff9f2] p-4">
                  <div className="grid gap-4 md:grid-cols-2">
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
                      <Label>Meet / Drop Location</Label>
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
                <div className="rounded-[24px] border border-[#ead9c7] bg-[#fff9f2] p-4 text-sm leading-7 text-[#73583f]">
                  For transportation requests, include helpful details below such as airport, nearest major city, preferred carrier, or timing needs. Transportation pricing is arranged separately and must be confirmed before scheduling.
                </div>
              ) : null}

              <div className="rounded-[24px] border border-[#e2cfba] bg-[linear-gradient(180deg,#fffaf3_0%,#fff_100%)] p-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a47946]">
                  Estimated Transportation Fee
                </div>
                <div className="mt-2 text-2xl font-semibold text-[#2f2218]">{requestEstimate.label}</div>
                <div className="mt-2 text-sm leading-6 text-[#73583f]">{requestEstimate.detail}</div>
              </div>

              <Field>
                <Label>Notes</Label>
                <textarea
                  rows={5}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={`${inputClass} resize-none`}
                  placeholder="Timing, logistics, or any travel details you want us to know."
                />
              </Field>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-[18px] bg-[#6b4d33] px-5 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-[0_14px_30px_rgba(88,63,37,0.18)] transition hover:bg-[#5b412c] disabled:opacity-60"
              >
                {busy ? "Submitting..." : "Submit Request"}
              </button>
            </form>
          </PortalPanel>

          <PortalPanel
            title="Pricing Policy"
            subtitle="Travel pricing is presented clearly here so you can estimate local requests before submitting."
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <PolicyCard label="Free Mileage" value="First 50 miles" detail="One-way from Marion, VA" />
              <PolicyCard label="After 50 Miles" value="$1.25 / mile" detail="One-way rate" />
              <PolicyCard label="Minimum Fee" value="$75" detail="Beyond the free-mile zone" />
              <PolicyCard label="Local Range" value="200 miles" detail="Longer trips by approval" />
            </div>

            <div className="mt-5 space-y-2 text-sm leading-7 text-[#73583f]">
              <p>Pending and approved requests block the day for other portal families.</p>
              <p>Pickup at our location does not include a transportation fee.</p>
              <p>Meet-up and drop-off pricing uses the mileage policy above.</p>
              <p>Longer distances may require added travel costs or breeder approval.</p>
              <p>Transportation, flight nanny, and courier arrangements are quoted separately.</p>
            </div>
          </PortalPanel>
        </div>
      </section>

      <PortalPanel
        title="Need help?"
        subtitle="If plans shift or you need to coordinate a change, use the links below so your travel details stay organized inside the portal."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <PortalInfoTile label="Support" value="Open Messages" detail="Message us directly if your plans need to change." />
          <PortalInfoTile label="Reference" value="Open Resources" detail="Helpful travel and puppy guidance stays easy to revisit." />
          <div className="rounded-[24px] border border-[#ead9c7] bg-white p-4 shadow-[0_12px_32px_rgba(106,76,45,0.06)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a47946]">Portal Access</div>
            <div className="mt-2 text-2xl font-semibold text-[#2f2218]">Sign Out</div>
            <button
              type="button"
              onClick={handleSignOutRedirect}
              className="mt-4 inline-flex rounded-full border border-[#e5d2bc] bg-[#fff9f2] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b8772f] transition hover:border-[#d8b48b]"
            >
              Sign Out
            </button>
          </div>
        </div>
      </PortalPanel>
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
    <div className="rounded-[22px] border border-[#e2cfba] bg-[linear-gradient(180deg,#ffffff_0%,#fffaf3_100%)] p-4 shadow-[0_10px_26px_rgba(58,43,26,0.06)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a47946]">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-[#2f2218]">{value}</div>
      <div className="mt-1 text-[12px] leading-5 text-[#7a6652]">{detail}</div>
    </div>
  );
}

function InfoDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a47946]">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-[#2f2218]">{value}</div>
    </div>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a47946]">
      {children}
    </label>
  );
}

function HelperText({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-xs text-[#8a6a49]">{children}</p>;
}
