"use client";

import React, { useEffect, useState } from "react";
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
  PortalHeroPrimaryAction,
  PortalHeroSecondaryAction,
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
  if (!normalized) return "—";
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
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
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
        ? NaN
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
        detail: `This trip is within the first ${FREE_MILES_ONE_WAY} one-way miles included at no charge.`,
      };
    }

    const billableMiles = miles - FREE_MILES_ONE_WAY;
    const rawFee = billableMiles * RATE_PER_MILE;
    const fee = Math.max(MINIMUM_DELIVERY_FEE, rawFee);
    const rangeNote =
      miles > LOCAL_DELIVERY_RADIUS
        ? ` This request is beyond the normal ${LOCAL_DELIVERY_RADIUS}-mile local range and may require breeder approval or added travel arrangements.`
        : "";

    return {
      fee,
      label: formatMoney(fee),
      detail: `${billableMiles.toFixed(1).replace(/\.0$/, "")} billable one-way miles × ${formatMoney(
        RATE_PER_MILE
      )} = ${formatMoney(rawFee)}. Minimum fee applies beyond ${FREE_MILES_ONE_WAY} miles.${rangeNote}`,
    };
  }

  return {
    fee: null,
    label: "—",
    detail: "Select a request type to see how pricing applies.",
  };
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

  if (sessionLoading || loading) {
    return <PortalLoadingState label="Loading transportation..." />;
  }

  if (!user) {
    return (
      <PortalPageHero
        eyebrow="Transporation"
        title="Sign in to plan pickup or transportation."
        description="Pickup, meet-up, delivery, and transportation requests stay here once you are signed in."
        actions={<PortalHeroPrimaryAction href="/portal">Open Portal Access</PortalHeroPrimaryAction>}
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
    puppy?.status
      ? ["sold", "reserved", "assigned"].some((status) =>
          String(puppy.status || "").toLowerCase().includes(status)
        )
        ? "Matched"
        : puppy.status
      : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const selectedAvailability = !selectedDate
    ? {
        title: "—",
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

  const currentEstimate = latestRequest
    ? calculateTransportEstimate(
        (latestRequest.request_type as PickupRequestType) || "",
        latestRequest.miles
      )
    : null;
  const requestEstimate = calculateTransportEstimate(requestType, miles);
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
      setErrorText("Please choose a day on the calendar.");
      return;
    }

    if (showMeetDropFields && (!miles.trim() || !locationText.trim())) {
      setErrorText("Please enter the mileage and proposed location for meet-up or drop-off requests.");
      return;
    }

    setBusy(true);

    try {
      const available = await isPickupDateAvailable(selectedDate);
      if (!available) {
        await refreshCurrentData();
        setSelectedDate("");
        throw new Error("That day was just taken by another client. Please choose another day.");
      }

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

      if (error) throw error;

      await refreshCurrentData();
      setSuccessText("Request submitted. We will confirm details through Messages.");
    } catch (error) {
      console.error("Could not submit transportation request:", error);
      setErrorText(
        error instanceof Error ? error.message : "We could not submit this request right now."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Transporation"
        title="Plan pickup, meet-up, delivery, or transportation with clarity."
        description="This page keeps scheduling, pricing, and travel notes organized before homecoming while still staying useful later if you need to revisit the handoff details."
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
              detail={puppyMetaLine || "Your transportation planning stays connected to this puppy profile."}
            />
            <PortalInfoTile
              label="Estimated Fee"
              value={requestEstimate.label}
              detail={requestEstimate.detail}
            />
          </div>
        }
      />

      {successText ? (
        <div className="rounded-[20px] border border-[#d5e7d0] bg-[#f5fbf2] px-4 py-3 text-sm font-semibold text-[#456640]">
          {successText}
        </div>
      ) : null}

      {errorText ? (
        <div className="rounded-[20px] border border-[#efd2cc] bg-[#fff6f4] px-4 py-3 text-sm font-semibold text-[#8f4b42]">
          {errorText}
        </div>
      ) : null}

      <PortalMetricGrid>
        <PortalMetricCard
          label="My Puppy"
          value={puppyName}
          detail={puppyMetaLine || "Travel planning stays connected to your puppy profile."}
          href="/portal/mypuppy"
          actionLabel="Open My Puppy"
        />
        <PortalMetricCard
          label="Selected Day"
          value={selectedDate ? fmtDate(selectedDate) : "—"}
          detail={selectedDate ? "This day will be reserved if it is still available when submitted." : "Choose a date from the calendar."}
        />
        <PortalMetricCard
          label="Availability"
          value={selectedAvailability.title}
          detail={selectedAvailability.detail}
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
            subtitle="The latest transportation-related request saved under your account appears here so you do not have to guess what is already on file."
          >
            {latestRequest ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
                  <InfoCard
                    label="Request Date"
                    value={latestRequest.request_date ? fmtDate(latestRequest.request_date) : "—"}
                    detail="Most recent saved request"
                  />
                  <InfoCard
                    label="Type"
                    value={formatRequestType(latestRequest.request_type)}
                    detail="Pickup, meet-up, drop-off, or transportation"
                  />
                  <InfoCard
                    label="Miles"
                    value={latestRequest.miles !== null && latestRequest.miles !== undefined ? String(latestRequest.miles) : "—"}
                    detail="One-way mileage"
                  />
                  <InfoCard
                    label="Estimated Fee"
                    value={currentEstimate?.label || "—"}
                    detail="Based on the current transportation policy"
                  />
                </div>

                {(latestRequest.location_text || latestRequest.address_text || latestRequest.notes) ? (
                  <div className="rounded-[24px] border border-[#eadccf] bg-[#fffaf4] p-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <InfoCard
                        label="Location"
                        value={latestRequest.location_text || latestRequest.address_text || "—"}
                        detail="Recorded for this request"
                      />
                      <InfoCard
                        label="Status"
                        value={formatRequestStatus(latestRequest.status)}
                        detail="Current review status"
                      />
                    </div>
                    {latestRequest.notes ? (
                      <div className="mt-4 text-sm leading-7 text-[#72553c]">{latestRequest.notes}</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <PortalEmptyState
                title="No transportation request on file"
                description="When you submit a pickup, meet-up, drop-off, or transportation request, the latest one will appear here automatically."
              />
            )}
          </PortalPanel>

          <PortalPanel
            title="Choose a Day"
            subtitle="Blocked dates already have a pending or approved request, so only open dates can be selected."
            action={
              <div className="flex items-center gap-3">
                <PortalSecondaryButton
                  onClick={() => setMonth(firstOfMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)))}
                >
                  Prev
                </PortalSecondaryButton>
                <PortalSecondaryButton
                  onClick={() => setMonth(firstOfMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)))}
                >
                  Next
                </PortalSecondaryButton>
              </div>
            }
          >
            <div className="text-sm font-semibold text-[#2f2218]">
              {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
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
                    onClick={() => void handleDaySelect(cell.iso)}
                    title={cell.past ? "Past date" : cell.blocked ? "Already requested" : "Available"}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-[22px] border border-[#eadccf] bg-[#fffaf4] px-4 py-4 text-sm text-[#72553c]">
              Today: <span className="font-semibold text-[#2f2218]">{fmtDate(todayIso())}</span>
            </div>
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel
            title="Transportation Request"
            subtitle="Complete the form below to request pickup, a public meet-up, drop-off, or transportation planning."
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

              <PortalField label="Selected Day">
                <PortalInput value={selectedDate} readOnly className="bg-[#faf6f1]" />
              </PortalField>

              {showMeetDropFields ? (
                <div className="rounded-[24px] border border-[#eadccf] bg-[#fffaf4] p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <PortalField label="Miles (one-way)">
                      <PortalInput
                        type="number"
                        step="0.1"
                        min="0"
                        value={miles}
                        onChange={(event) => setMiles(event.target.value)}
                        placeholder="e.g. 25"
                        required={showMeetDropFields}
                      />
                    </PortalField>
                    <PortalField label="Meet / Drop Location">
                      <PortalInput
                        value={locationText}
                        onChange={(event) => setLocationText(event.target.value)}
                        placeholder="e.g. Exit 17 Park & Ride, Bristol"
                        required={showMeetDropFields}
                      />
                    </PortalField>
                  </div>

                  <div className="mt-4">
                    <PortalField label="Address (optional)">
                      <PortalInput
                        value={addressText}
                        onChange={(event) => setAddressText(event.target.value)}
                        placeholder="Street / City / State"
                      />
                    </PortalField>
                  </div>
                </div>
              ) : null}

              {showTransportationFields ? (
                <div className="rounded-[24px] border border-[#eadccf] bg-[#fffaf4] p-4 text-sm leading-7 text-[#72553c]">
                  For transportation requests, include helpful details below such as airport, nearest major city, preferred carrier, or timing needs. Transportation pricing is arranged separately and confirmed before scheduling.
                </div>
              ) : null}

              <div className="rounded-[24px] border border-[#e2cfba] bg-[linear-gradient(180deg,#fffaf3_0%,#fff_100%)] p-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a47946]">
                  Estimated Transportation Fee
                </div>
                <div className="mt-2 text-2xl font-semibold text-[#2f2218]">{requestEstimate.label}</div>
                <div className="mt-2 text-sm leading-6 text-[#72553c]">{requestEstimate.detail}</div>
              </div>

              <PortalField label="Notes">
                <PortalTextarea
                  rows={5}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Timing, logistics, airport details, or anything you want us to know."
                />
              </PortalField>

              <PortalButton type="submit" disabled={busy} className="w-full">
                {busy ? "Submitting..." : "Submit Request"}
              </PortalButton>
            </form>
          </PortalPanel>

          <PortalPanel
            title="Pricing Policy"
            subtitle="Travel pricing is surfaced clearly here so local requests are easy to estimate before you submit."
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoCard label="Free Mileage" value="First 50 miles" detail="One-way from Marion, VA" />
              <InfoCard label="After 50 Miles" value="$1.25 / mile" detail="One-way rate" />
              <InfoCard label="Minimum Fee" value="$75" detail="Beyond the free-mile zone" />
              <InfoCard label="Local Range" value="200 miles" detail="Longer trips by approval" />
            </div>

            <div className="mt-5 space-y-2 text-sm leading-7 text-[#72553c]">
              <p>Pending and approved requests block the day for other portal families.</p>
              <p>Pickup at our location does not include a transportation fee.</p>
              <p>Meet-up and drop-off pricing uses the mileage policy above.</p>
              <p>Longer distances may require added travel costs or breeder approval.</p>
              <p>Transportation, flight nanny, and courier arrangements are quoted separately.</p>
            </div>
          </PortalPanel>
        </div>
      </section>
    </div>
  );
}

function InfoCard({
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
