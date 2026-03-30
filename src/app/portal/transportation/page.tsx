"use client";

import React, { useEffect, useMemo, useState } from "react";
import { fmtDate, sb } from "@/lib/utils";
import {
  findBlockedPickupDatesForMonth,
  findLatestPickupRequestForUser,
  isPickupDateAvailable,
  loadPortalContext,
  portalPuppyName,
  type PortalPickupRequest,
  type PortalPuppy,
} from "@/lib/portal-data";
import { usePortalSession } from "@/hooks/use-portal-session";
import {
  PortalButton,
  PortalEmptyState,
  PortalErrorState,
  PortalField,
  PortalInfoTile,
  PortalLoadingState,
  PortalMetricCard,
  PortalMetricGrid,
  PortalPageHero,
  PortalPanel,
  PortalSelect,
  PortalTextarea,
  PortalInput,
  PortalSecondaryButton,
} from "@/components/portal/luxury-shell";

type PickupRequestType = "" | "pickup" | "meet" | "dropoff" | "transportation";

const FREE_MILES_ONE_WAY = 50;
const RATE_PER_MILE = 1.25;
const MINIMUM_DELIVERY_FEE = 75;
const LOCAL_DELIVERY_RADIUS = 200;

function firstOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isoFromParts(year: number, month1: number, day: number) {
  return `${year}-${String(month1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayIso() {
  return isoFromParts(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
}

function formatRequestType(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Not selected";
  if (normalized === "dropoff") return "Drop-off";
  if (normalized === "pickup") return "Pickup";
  if (normalized === "meet") return "Meet-up";
  if (normalized === "transportation") return "Transportation";
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

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "Not listed";
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function calculateTransportEstimate(
  requestType: PickupRequestType,
  milesRaw: string | number | null | undefined
) {
  const miles =
    typeof milesRaw === "number"
      ? milesRaw
      : milesRaw === null || milesRaw === undefined || milesRaw === ""
        ? Number.NaN
        : Number(milesRaw);

  if (requestType === "pickup") {
    return {
      fee: 0,
      label: formatMoney(0),
      detail: "Pickup at our location does not include a transportation fee.",
    };
  }

  if (requestType === "transportation") {
    return {
      fee: null,
      label: "Custom quote required",
      detail:
        "Flight nanny, courier, and third-party transportation are priced separately and confirmed before scheduling.",
    };
  }

  if (requestType === "meet" || requestType === "dropoff") {
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
        detail: `This trip falls within the first ${FREE_MILES_ONE_WAY} one-way miles included at no charge.`,
      };
    }

    const billableMiles = miles - FREE_MILES_ONE_WAY;
    const rawFee = billableMiles * RATE_PER_MILE;
    const fee = Math.max(MINIMUM_DELIVERY_FEE, rawFee);
    const extraNote =
      miles > LOCAL_DELIVERY_RADIUS
        ? ` This request is beyond the normal ${LOCAL_DELIVERY_RADIUS}-mile local range and may require breeder approval or added travel arrangements.`
        : "";

    return {
      fee,
      label: formatMoney(fee),
      detail: `${billableMiles.toFixed(1).replace(/\.0$/, "")} billable one-way miles x ${formatMoney(
        RATE_PER_MILE
      )} = ${formatMoney(rawFee)}. Minimum fee applies beyond ${FREE_MILES_ONE_WAY} miles.${extraNote}`,
    };
  }

  return {
    fee: null,
    label: "Not available",
    detail: "Select a request type to see how pricing applies.",
  };
}

function CalendarInfoCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[22px] border border-[var(--portal-border)] bg-white p-4 shadow-[0_10px_22px_rgba(23,35,56,0.05)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-[var(--portal-text)]">{value}</div>
      <div className="mt-1 text-[12px] leading-5 text-[var(--portal-text-soft)]">{detail}</div>
    </div>
  );
}

export default function PortalTransportationPage() {
  const { user, loading: sessionLoading } = usePortalSession();
  const [puppy, setPuppy] = useState<PortalPuppy | null>(null);
  const [month, setMonth] = useState(firstOfMonth(new Date()));
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [latestRequest, setLatestRequest] = useState<PortalPickupRequest | null>(null);
  const [requestType, setRequestType] = useState<PickupRequestType>("");
  const [selectedDate, setSelectedDate] = useState("");
  const [miles, setMiles] = useState("");
  const [locationText, setLocationText] = useState("");
  const [addressText, setAddressText] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPage() {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorText("");

      try {
        const context = await loadPortalContext(user);
        const [blocked, currentRequest] = await Promise.all([
          findBlockedPickupDatesForMonth(month),
          findLatestPickupRequestForUser(user),
        ]);

        if (!active) return;
        setPuppy(context.puppy);
        setBlockedDates(blocked);
        setLatestRequest(currentRequest);
      } catch (error) {
        console.error("Could not load transportation page:", error);
        if (!active) return;
        setErrorText(
          "We could not load transportation planning right now. Please refresh or try again in a moment."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPage();

    return () => {
      active = false;
    };
  }, [month, user]);

  const requestEstimate = useMemo(
    () => calculateTransportEstimate(requestType, miles),
    [miles, requestType]
  );
  const currentEstimate = useMemo(
    () =>
      latestRequest
        ? calculateTransportEstimate(
            (latestRequest.request_type as PickupRequestType) || "",
            latestRequest.miles
          )
        : null,
    [latestRequest]
  );

  if (sessionLoading || loading) {
    return <PortalLoadingState label="Loading transportation..." />;
  }

  if (!user) {
    return (
      <PortalPageHero
        eyebrow="Transportation"
        title="Sign in to plan pickup or transportation."
        description="Pickup, meet-up, delivery, and transportation requests stay here once you are signed in."
      />
    );
  }

  if (errorText && !puppy && !latestRequest) {
    return <PortalErrorState title="Transportation is unavailable" description={errorText} />;
  }

  const puppyName = portalPuppyName(puppy);
  const puppyMetaLine = [
    puppy?.sex,
    puppy?.dob ? `DOB ${fmtDate(puppy.dob)}` : null,
    puppy?.status ? formatRequestStatus(puppy.status) : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const selectedAvailability = !selectedDate
    ? {
        title: "Not selected",
        detail: "Blocked dates are not selectable.",
      }
    : blockedDates.has(selectedDate)
      ? {
          title: "Blocked",
          detail: "That date already has a pending or approved request on file.",
        }
      : {
          title: "Available",
          detail: "That date can be reserved when you submit.",
        };

  const showMeetDropFields = requestType === "meet" || requestType === "dropoff";
  const showTransportationFields = requestType === "transportation";

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstDayOfWeek = first.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const today = todayIso();
  const calendarDays: Array<
    | { type: "blank"; key: string }
    | {
        type: "day";
        key: string;
        day: number;
        iso: string;
        selected: boolean;
        blocked: boolean;
        past: boolean;
      }
  > = [];

  for (let index = 0; index < firstDayOfWeek; index += 1) {
    calendarDays.push({ type: "blank", key: `blank-${index}` });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = isoFromParts(month.getFullYear(), month.getMonth() + 1, day);
    calendarDays.push({
      type: "day",
      key: iso,
      day,
      iso,
      selected: iso === selectedDate,
      blocked: blockedDates.has(iso),
      past: iso < today,
    });
  }

  async function refreshCurrentData() {
    if (!user) return;

    const [blocked, currentRequest] = await Promise.all([
      findBlockedPickupDatesForMonth(month),
      findLatestPickupRequestForUser(user),
    ]);
    setBlockedDates(blocked);
    setLatestRequest(currentRequest);
  }

  async function handleDaySelect(isoDate: string) {
    setErrorText("");
    setSuccessText("");

    const available = await isPickupDateAvailable(isoDate);
    if (!available) {
      await refreshCurrentData();
      setSelectedDate("");
      setErrorText("That day was just taken by another client. Please choose another day.");
      return;
    }

    setSelectedDate(isoDate);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;

    setErrorText("");
    setSuccessText("");

    if (!requestType) {
      setErrorText("Please choose a request type.");
      return;
    }

    if (!selectedDate) {
      setErrorText("Please choose a date from the calendar.");
      return;
    }

    if (blockedDates.has(selectedDate)) {
      setErrorText("That date is already blocked. Please choose another day.");
      return;
    }

    if ((requestType === "meet" || requestType === "dropoff") && (!miles || Number(miles) < 0)) {
      setErrorText("Please enter the one-way mileage for meet-up or drop-off requests.");
      return;
    }

    setBusy(true);

    const available = await isPickupDateAvailable(selectedDate);
    if (!available) {
      await refreshCurrentData();
      setBusy(false);
      setSelectedDate("");
      setErrorText("That day was just taken by another client. Please choose another day.");
      return;
    }

    try {
      const { error } = await sb.from("portal_pickup_requests").insert({
        user_id: user.id,
        puppy_id: puppy?.id || null,
        request_date: selectedDate,
        request_type: requestType,
        miles: showMeetDropFields ? Number(miles) : null,
        location_text: showMeetDropFields ? locationText.trim() || null : null,
        address_text: showMeetDropFields ? addressText.trim() || null : null,
        notes: notes.trim() || null,
      });

      if (error) {
        if (String(error.message || "").toLowerCase().includes("unique")) {
          await refreshCurrentData();
          setSelectedDate("");
          throw new Error("That day was just taken by another client. Please choose another day.");
        }
        throw error;
      }

      setRequestType("");
      setSelectedDate("");
      setMiles("");
      setLocationText("");
      setAddressText("");
      setNotes("");
      setSuccessText("Transportation request submitted.");
      await refreshCurrentData();
    } catch (error) {
      console.error("Could not submit transportation request:", error);
      setErrorText(
        error instanceof Error ? error.message : "We could not submit the request right now."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Transportation"
        title="Plan pickup, meet-up, delivery, or transportation with less confusion."
        description="Use one page to review your latest request, understand pricing, choose an available date, and submit the next transportation step for your puppy."
        aside={
          <div className="grid gap-4">
            <PortalInfoTile
              label="My Puppy"
              value={puppyName}
              detail={puppyMetaLine || "A linked puppy profile will show here."}
            />
            <PortalInfoTile
              label="Current Request"
              value={latestRequest ? formatRequestStatus(latestRequest.status) : "Not scheduled"}
              detail={latestRequest ? formatRequestType(latestRequest.request_type) : "No transportation request on file yet."}
              tone={latestRequest ? "success" : "neutral"}
            />
          </div>
        }
      />

      {successText ? (
        <div className="rounded-[20px] border border-[rgba(47,143,103,0.18)] bg-[linear-gradient(180deg,rgba(246,253,249,0.98)_0%,rgba(240,249,245,0.94)_100%)] px-4 py-3 text-sm font-semibold text-[#2f7657]">
          {successText}
        </div>
      ) : null}

      {errorText ? (
        <div className="rounded-[20px] border border-[rgba(194,84,114,0.16)] bg-[linear-gradient(180deg,rgba(255,249,251,0.98)_0%,rgba(255,242,246,0.94)_100%)] px-4 py-3 text-sm font-semibold text-[#aa4f68]">
          {errorText}
        </div>
      ) : null}

      <PortalMetricGrid>
        <PortalMetricCard
          label="Current Request"
          value={latestRequest ? formatRequestStatus(latestRequest.status) : "Not scheduled"}
          detail={latestRequest ? formatRequestType(latestRequest.request_type) : "No transportation request on file."}
        />
        <PortalMetricCard
          label="Estimated Fee"
          value={latestRequest && currentEstimate ? currentEstimate.label : "Pending"}
          detail={latestRequest && currentEstimate ? currentEstimate.detail : "Pricing depends on request type and mileage."}
          accent="from-[rgba(93,121,255,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
        <PortalMetricCard
          label="Free Mileage"
          value="50 miles"
          detail="Included one-way for meet-up and drop-off requests."
          accent="from-[rgba(110,166,218,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
        <PortalMetricCard
          label="Local Range"
          value="200 miles"
          detail="Longer distances may require breeder approval."
          accent="from-[rgba(113,198,164,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_420px]">
        <div className="space-y-6">
          <PortalPanel
            title="Choose a Date"
            subtitle="Only open dates can be requested. Pending and approved requests block the day for other clients."
            action={
              <div className="flex items-center gap-2">
                <PortalSecondaryButton onClick={() => setMonth(firstOfMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)))}>
                  Prev
                </PortalSecondaryButton>
                <PortalSecondaryButton onClick={() => setMonth(firstOfMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)))}>
                  Next
                </PortalSecondaryButton>
              </div>
            }
          >
            <div className="flex items-center justify-between gap-4">
              <div className="text-lg font-semibold tracking-[-0.03em] text-[var(--portal-text)]">
                {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </div>
              <div className="text-sm text-[var(--portal-text-soft)]">Today: {fmtDate(today)}</div>
            </div>

            <div className="mt-5 grid grid-cols-7 gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center">
                  {day}
                </div>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-7 gap-2">
              {calendarDays.map((entry) => {
                if (entry.type === "blank") {
                  return <div key={entry.key} className="h-12 rounded-[18px]" />;
                }

                const disabled = entry.past || entry.blocked;
                return (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => void handleDaySelect(entry.iso)}
                    disabled={disabled}
                    className={[
                      "h-12 rounded-[18px] border text-sm font-semibold transition",
                      entry.selected
                        ? "border-[var(--portal-accent)] bg-[linear-gradient(135deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] text-white shadow-[0_14px_26px_rgba(47,88,227,0.2)]"
                        : entry.blocked
                          ? "border-[var(--portal-border)] bg-[var(--portal-surface-muted)] text-[var(--portal-text-muted)] opacity-65"
                          : entry.past
                            ? "border-[var(--portal-border)] bg-[rgba(255,255,255,0.52)] text-[var(--portal-text-muted)] opacity-55"
                            : "border-[var(--portal-border)] bg-white text-[var(--portal-text)] hover:-translate-y-0.5 hover:border-[var(--portal-border-strong)]",
                    ].join(" ")}
                  >
                    {entry.day}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <CalendarInfoCard
                label="My Puppy"
                value={puppyName}
                detail={puppyMetaLine || "A linked puppy profile will show here."}
              />
              <CalendarInfoCard
                label="Selected Date"
                value={selectedDate ? fmtDate(selectedDate) : "Not selected"}
                detail={selectedDate ? "This date will be reserved when you submit." : "Pick a date from the calendar."}
              />
              <CalendarInfoCard
                label="Availability"
                value={selectedAvailability.title}
                detail={selectedAvailability.detail}
              />
            </div>
          </PortalPanel>

          <PortalPanel
            title="Your Latest Request"
            subtitle="The most recent request saved under this portal account."
          >
            {latestRequest ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <CalendarInfoCard
                  label="Request Date"
                  value={latestRequest.request_date ? fmtDate(latestRequest.request_date) : "Not listed"}
                  detail="Most recent request date."
                />
                <CalendarInfoCard
                  label="Type"
                  value={formatRequestType(latestRequest.request_type)}
                  detail="Request type currently on file."
                />
                <CalendarInfoCard
                  label="Status"
                  value={formatRequestStatus(latestRequest.status)}
                  detail="Current review status."
                />
                <CalendarInfoCard
                  label="Estimated Fee"
                  value={currentEstimate?.label || "Pending"}
                  detail={currentEstimate?.detail || "Pricing is based on request type and mileage."}
                />
              </div>
            ) : (
              <PortalEmptyState
                title="No transportation request on file yet"
                description="When you submit pickup, meet-up, delivery, or transportation details, the latest request will appear here."
              />
            )}
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel
            title="Submit a Request"
            subtitle="Choose the request type, add any mileage or location details, and submit for review."
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <PortalField label="Request Type">
                <PortalSelect
                  value={requestType}
                  onChange={(event) => setRequestType(event.target.value as PickupRequestType)}
                  required
                >
                  <option value="">Select...</option>
                  <option value="pickup">Pickup (at our location)</option>
                  <option value="meet">Meet-up (public location)</option>
                  <option value="dropoff">Drop-off (to your area)</option>
                  <option value="transportation">Transportation / Flight Nanny / Courier</option>
                </PortalSelect>
              </PortalField>

              <PortalField label="Selected Date">
                <PortalInput value={selectedDate} readOnly placeholder="Pick a date from the calendar" />
              </PortalField>

              {showMeetDropFields ? (
                <>
                  <PortalField label="Miles (one-way)">
                    <PortalInput
                      type="number"
                      step="0.1"
                      min="0"
                      value={miles}
                      onChange={(event) => setMiles(event.target.value)}
                      placeholder="e.g. 25"
                    />
                  </PortalField>
                  <PortalField label="Proposed Meet / Drop Location">
                    <PortalInput
                      value={locationText}
                      onChange={(event) => setLocationText(event.target.value)}
                      placeholder="Exit 17 Park & Ride, Bristol"
                    />
                  </PortalField>
                  <PortalField label="Address (optional)">
                    <PortalInput
                      value={addressText}
                      onChange={(event) => setAddressText(event.target.value)}
                      placeholder="Street / City / State"
                    />
                  </PortalField>
                </>
              ) : null}

              {showTransportationFields ? (
                <div className="rounded-[22px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4 text-sm leading-7 text-[var(--portal-text-soft)]">
                  For transportation requests, use the notes field for airport, nearest major city, preferred carrier, or timing requirements. Transportation pricing is arranged separately and must be approved before scheduling.
                </div>
              ) : null}

              <div className="rounded-[24px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(243,248,253,0.95)_100%)] p-4 shadow-[0_10px_22px_rgba(23,35,56,0.05)]">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                  Estimated Transportation Fee
                </div>
                <div className="mt-2 text-[1.9rem] font-semibold tracking-[-0.04em] text-[var(--portal-text)]">
                  {requestEstimate.label}
                </div>
                <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                  {requestEstimate.detail}
                </div>
              </div>

              <PortalField label="Notes">
                <PortalTextarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={5}
                  placeholder="Timing, logistics, special considerations, or anything you want us to know."
                />
              </PortalField>

              <PortalButton type="submit" disabled={busy || !selectedDate} className="w-full">
                {busy ? "Submitting..." : "Submit Request"}
              </PortalButton>
            </form>
          </PortalPanel>

          <PortalPanel
            title="Pricing Policy"
            subtitle="Transportation pricing is surfaced here so the request form stays easier to understand."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <PortalInfoTile label="Free Mileage" value="First 50 miles" detail="One-way from Marion, Virginia." />
              <PortalInfoTile label="After 50 Miles" value="$1.25 / mile" detail="One-way rate for meet-up and drop-off." />
              <PortalInfoTile label="Minimum Fee" value="$75" detail="Applies beyond the free-mile zone." />
              <PortalInfoTile label="Local Range" value="200 miles" detail="Longer trips may require breeder approval." />
            </div>
          </PortalPanel>
        </div>
      </section>
    </div>
  );
}
