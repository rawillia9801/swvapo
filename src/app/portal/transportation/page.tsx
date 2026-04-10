"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Route,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
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
import {
  calculateTransportEstimate,
  type PickupRequestType,
} from "@/lib/transportation-pricing";

function firstOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isoFromParts(year: number, month1: number, day: number) {
  return `${year}-${String(month1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayIso() {
  return isoFromParts(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    new Date().getDate()
  );
}

function humanizeLabel(value: string | null | undefined, fallback = "Not listed") {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;

  if (normalized === "dropoff") return "Drop-off";
  if (normalized === "pickup") return "Pickup";
  if (normalized === "meet") return "Meet-up";
  if (normalized === "transportation") return "Transportation";
  if (normalized === "approved") return "Approved";
  if (normalized === "declined") return "Declined";
  if (normalized === "cancelled") return "Cancelled";
  if (normalized === "completed") return "Completed";
  if (normalized === "pending") return "Pending";
  if (normalized === "reserved") return "Reserved";
  if (normalized === "delivered") return "Delivered";
  if (normalized === "picked up") return "Picked Up";

  return normalized.replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatRequestType(value: string | null | undefined) {
  return humanizeLabel(value, "Not selected");
}

function formatRequestStatus(value: string | null | undefined) {
  return humanizeLabel(value, "Pending");
}

function requestTypeDescription(value: PickupRequestType) {
  if (value === "pickup") {
    return "You pick up your puppy at our location.";
  }
  if (value === "meet") {
    return "We meet at an agreed public location.";
  }
  if (value === "dropoff") {
    return "We travel toward your area for drop-off.";
  }
  if (value === "transportation") {
    return "Flight nanny, courier, or custom transportation planning.";
  }
  return "Choose the transportation option that best fits your homecoming plan.";
}

function requestTypeTitle(value: PickupRequestType) {
  if (value === "pickup") return "Pickup at our location";
  if (value === "meet") return "Meet-up";
  if (value === "dropoff") return "Drop-off";
  if (value === "transportation") return "Transportation";
  return "Choose request type";
}

function requestTypeIcon(value: PickupRequestType) {
  if (value === "pickup") return <CalendarDays className="h-5 w-5" />;
  if (value === "meet") return <MapPin className="h-5 w-5" />;
  if (value === "dropoff") return <Truck className="h-5 w-5" />;
  if (value === "transportation") return <Route className="h-5 w-5" />;
  return <Sparkles className="h-5 w-5" />;
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

function RequestTypeCard({
  active,
  title,
  description,
  icon,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-[24px] border p-4 text-left transition",
        active
          ? "border-[#c79a6a] bg-[linear-gradient(180deg,rgba(255,252,247,0.98)_0%,rgba(247,240,232,0.98)_100%)] shadow-[0_18px_32px_rgba(120,81,45,0.12)]"
          : "border-[var(--portal-border)] bg-white shadow-sm hover:-translate-y-0.5 hover:border-[var(--portal-border-strong)]",
      ].join(" ")}
    >
      <div
        className={[
          "inline-flex h-11 w-11 items-center justify-center rounded-2xl",
          active
            ? "bg-[linear-gradient(135deg,rgba(212,174,127,0.28)_0%,rgba(126,164,208,0.22)_100%)] text-[var(--portal-accent-strong)]"
            : "bg-[var(--portal-surface-muted)] text-[var(--portal-accent-strong)]",
        ].join(" ")}
      >
        {icon}
      </div>

      <div className="mt-4 text-sm font-semibold text-[var(--portal-text)]">{title}</div>
      <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{description}</div>
    </button>
  );
}

function LegendPill({
  tone,
  label,
}: {
  tone: "available" | "blocked" | "past" | "selected";
  label: string;
}) {
  const styles =
    tone === "available"
      ? "border-[var(--portal-border)] bg-white text-[var(--portal-text)]"
      : tone === "blocked"
        ? "border-[var(--portal-border)] bg-[var(--portal-surface-muted)] text-[var(--portal-text-muted)]"
        : tone === "past"
          ? "border-[var(--portal-border)] bg-[rgba(255,255,255,0.56)] text-[var(--portal-text-muted)]"
          : "border-[var(--portal-accent)] bg-[linear-gradient(135deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] text-white";

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${styles}`}
    >
      {label}
    </div>
  );
}

function MiniPolicyCard({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-[22px] border border-[var(--portal-border)] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--portal-surface-muted)] text-[var(--portal-accent-strong)]">
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold text-[var(--portal-text)]">{title}</div>
          <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  value,
  tone,
}: {
  value: string;
  tone: "neutral" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "border-[rgba(47,143,103,0.18)] bg-[rgba(245,252,248,0.94)] text-[#2f7657]"
      : tone === "warning"
        ? "border-[rgba(194,84,114,0.16)] bg-[rgba(255,245,247,0.94)] text-[#aa4f68]"
        : "border-[var(--portal-border)] bg-[var(--portal-surface-muted)] text-[var(--portal-text-soft)]";

  return (
    <div
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${toneClass}`}
    >
      {value}
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

  const monthLabel = useMemo(
    () =>
      month.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    [month]
  );

  const monthBlockedCount = blockedDates.size;
  const today = todayIso();
  const currentMonthStart = firstOfMonth(new Date());
  const canGoPrev =
    month.getFullYear() > currentMonthStart.getFullYear() ||
    (month.getFullYear() === currentMonthStart.getFullYear() &&
      month.getMonth() > currentMonthStart.getMonth());

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
    puppy?.status ? humanizeLabel(puppy.status) : null,
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
        title="Transportation Planning"
        description="Choose an available date, compare request types, review the estimate, and submit a clean transportation plan for your puppy from one organized page."
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
              detail={
                latestRequest
                  ? formatRequestType(latestRequest.request_type)
                  : "No transportation request on file yet."
              }
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
          detail={
            latestRequest
              ? formatRequestType(latestRequest.request_type)
              : "No transportation request on file."
          }
        />
        <PortalMetricCard
          label="Estimated Fee"
          value={latestRequest && currentEstimate ? currentEstimate.label : requestEstimate.label}
          detail={
            latestRequest && currentEstimate
              ? currentEstimate.detail
              : requestEstimate.detail
          }
          accent="from-[rgba(93,121,255,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
        <PortalMetricCard
          label="Blocked Dates"
          value={String(monthBlockedCount)}
          detail={`Unavailable request dates in ${monthLabel}.`}
          accent="from-[rgba(110,166,218,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
        <PortalMetricCard
          label="Planning Range"
          value="Up to 200 miles"
          detail="Longer distances may require breeder approval."
          accent="from-[rgba(113,198,164,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_430px]">
        <div className="space-y-6">
          <PortalPanel
            title="Choose Your Request Type"
            subtitle="Pick the transportation path first so the form and estimate adapt to the kind of homecoming you want."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <RequestTypeCard
                active={requestType === "pickup"}
                title="Pickup"
                description="You pick up your puppy at our location."
                icon={<CalendarDays className="h-5 w-5" />}
                onClick={() => setRequestType("pickup")}
              />
              <RequestTypeCard
                active={requestType === "meet"}
                title="Meet-up"
                description="We meet at an agreed public location."
                icon={<MapPin className="h-5 w-5" />}
                onClick={() => setRequestType("meet")}
              />
              <RequestTypeCard
                active={requestType === "dropoff"}
                title="Drop-off"
                description="We travel toward your area for delivery."
                icon={<Truck className="h-5 w-5" />}
                onClick={() => setRequestType("dropoff")}
              />
              <RequestTypeCard
                active={requestType === "transportation"}
                title="Transportation"
                description="Flight nanny, courier, or custom transportation coordination."
                icon={<Route className="h-5 w-5" />}
                onClick={() => setRequestType("transportation")}
              />
            </div>

            {!requestType ? (
              <div className="mt-5 rounded-[22px] border border-dashed border-[var(--portal-border-strong)] bg-[var(--portal-surface-muted)] px-4 py-4 text-sm leading-7 text-[var(--portal-text-soft)]">
                Choose a request type above to unlock a more focused planning flow.
              </div>
            ) : (
              <div className="mt-5 rounded-[24px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(243,248,253,0.95)_100%)] p-5 shadow-[0_10px_22px_rgba(23,35,56,0.05)]">
                <div className="flex items-start gap-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--portal-surface-muted)] text-[var(--portal-accent-strong)]">
                    {requestTypeIcon(requestType)}
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                      Selected Request Type
                    </div>
                    <div className="mt-2 text-lg font-semibold text-[var(--portal-text)]">
                      {requestTypeTitle(requestType)}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                      {requestTypeDescription(requestType)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </PortalPanel>

          <PortalPanel
            title="Choose a Date"
            subtitle="Only open dates can be requested. Pending and approved requests block the day for other clients."
            action={
              <div className="flex items-center gap-2">
                <PortalSecondaryButton
                  onClick={() =>
                    canGoPrev
                      ? setMonth(
                          firstOfMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
                        )
                      : undefined
                  }
                  disabled={!canGoPrev}
                >
                  Prev
                </PortalSecondaryButton>
                <PortalSecondaryButton
                  onClick={() =>
                    setMonth(firstOfMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)))
                  }
                >
                  Next
                </PortalSecondaryButton>
              </div>
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-lg font-semibold tracking-[-0.03em] text-[var(--portal-text)]">
                {monthLabel}
              </div>
              <div className="text-sm text-[var(--portal-text-soft)]">
                Today: {fmtDate(today)}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <LegendPill tone="available" label="Available" />
              <LegendPill tone="selected" label="Selected" />
              <LegendPill tone="blocked" label="Blocked" />
              <LegendPill tone="past" label="Past" />
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
                  return <div key={entry.key} className="h-[64px] rounded-[18px]" />;
                }

                const disabled = entry.past || entry.blocked;

                return (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => void handleDaySelect(entry.iso)}
                    disabled={disabled}
                    className={[
                      "relative h-[64px] rounded-[18px] border text-sm font-semibold transition",
                      entry.selected
                        ? "border-[var(--portal-accent)] bg-[linear-gradient(135deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] text-white shadow-[0_14px_26px_rgba(47,88,227,0.2)]"
                        : entry.blocked
                          ? "border-[var(--portal-border)] bg-[var(--portal-surface-muted)] text-[var(--portal-text-muted)] opacity-70"
                          : entry.past
                            ? "border-[var(--portal-border)] bg-[rgba(255,255,255,0.52)] text-[var(--portal-text-muted)] opacity-55"
                            : "border-[var(--portal-border)] bg-white text-[var(--portal-text)] hover:-translate-y-0.5 hover:border-[var(--portal-border-strong)]",
                    ].join(" ")}
                  >
                    <span>{entry.day}</span>
                    <span
                      className={[
                        "absolute bottom-2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full",
                        entry.selected
                          ? "bg-white"
                          : entry.blocked
                            ? "bg-[rgba(170,79,104,0.76)]"
                            : entry.past
                              ? "bg-transparent"
                              : "bg-[rgba(76,141,216,0.72)]",
                      ].join(" ")}
                    />
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
                detail={
                  selectedDate
                    ? "This date will be reserved when you submit."
                    : "Pick a date from the calendar."
                }
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
            subtitle="The most recent transportation request saved under this portal account."
          >
            {latestRequest ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge
                    value={formatRequestStatus(latestRequest.status)}
                    tone={
                      String(latestRequest.status || "").toLowerCase() === "approved"
                        ? "success"
                        : String(latestRequest.status || "").toLowerCase() === "declined"
                          ? "warning"
                          : "neutral"
                    }
                  />
                  <StatusBadge
                    value={formatRequestType(latestRequest.request_type)}
                    tone="neutral"
                  />
                  {latestRequest.request_date ? (
                    <StatusBadge
                      value={`Request Date ${fmtDate(latestRequest.request_date)}`}
                      tone="neutral"
                    />
                  ) : null}
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <CalendarInfoCard
                    label="Request Date"
                    value={
                      latestRequest.request_date
                        ? fmtDate(latestRequest.request_date)
                        : "Not listed"
                    }
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
                    detail={
                      currentEstimate?.detail ||
                      "Pricing is based on request type and mileage."
                    }
                  />
                </div>

                {latestRequest.notes ? (
                  <div className="rounded-[22px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                      Notes on File
                    </div>
                    <div className="mt-2 text-sm leading-7 text-[var(--portal-text-soft)]">
                      {latestRequest.notes}
                    </div>
                  </div>
                ) : null}
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
            subtitle="Complete the details below and submit your transportation request for review."
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-[24px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(243,248,253,0.95)_100%)] p-4 shadow-[0_10px_22px_rgba(23,35,56,0.05)]">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                  Request Summary
                </div>
                <div className="mt-3 space-y-3">
                  <SummaryRow
                    label="Request Type"
                    value={requestType ? requestTypeTitle(requestType) : "Not selected"}
                  />
                  <SummaryRow
                    label="Date"
                    value={selectedDate ? fmtDate(selectedDate) : "Not selected"}
                  />
                  <SummaryRow
                    label="Estimated Fee"
                    value={requestEstimate.label}
                  />
                </div>
                <div className="mt-3 text-sm leading-6 text-[var(--portal-text-soft)]">
                  {requestEstimate.detail}
                </div>
              </div>

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
                <PortalInput
                  value={selectedDate}
                  readOnly
                  placeholder="Pick a date from the calendar"
                />
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
                <div className="rounded-[22px] border border-[rgba(186,154,116,0.18)] bg-[linear-gradient(180deg,rgba(255,252,247,0.98)_0%,rgba(248,244,238,0.98)_100%)] px-4 py-4 text-sm leading-7 text-[var(--portal-text-soft)]">
                  For transportation requests, use the notes field for airport details, nearest major city, preferred carrier, timing requirements, or any special coordination needs. Transportation pricing is arranged separately and must be approved before scheduling.
                </div>
              ) : null}

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
            title="Pricing & Planning"
            subtitle="The most important transportation details are surfaced here so everything is easier to understand."
          >
            <div className="grid gap-4">
              <MiniPolicyCard
                icon={<Route className="h-4 w-4" />}
                title="Free Mileage"
                detail="The first 50 one-way miles are included for meet-up and drop-off requests."
              />
              <MiniPolicyCard
                icon={<Truck className="h-4 w-4" />}
                title="After 50 Miles"
                detail="$1.25 per mile one-way applies outside the free-mile zone."
              />
              <MiniPolicyCard
                icon={<Clock3 className="h-4 w-4" />}
                title="Minimum Transportation Fee"
                detail="$75 minimum applies when mileage pricing is triggered."
              />
              <MiniPolicyCard
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Longer Distance Approval"
                detail="Trips beyond the local range may require breeder approval before confirmation."
              />
            </div>

            <div className="mt-5 rounded-[24px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-4">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[var(--portal-accent-strong)] shadow-sm">
                  <AlertCircle className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--portal-text)]">
                    Helpful planning note
                  </div>
                  <div className="mt-1 text-sm leading-7 text-[var(--portal-text-soft)]">
                    Choose the request type first, then select an open date, and finally add any
                    location or logistics details needed for review. This makes it much easier for
                    your request to be reviewed accurately the first time.
                  </div>
                </div>
              </div>
            </div>
          </PortalPanel>
        </div>
      </section>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[var(--portal-border)] bg-white px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="text-sm font-semibold text-[var(--portal-text)]">{value}</div>
    </div>
  );
}