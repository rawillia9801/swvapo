"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import {
  AdminEmptyState,
  AdminHeroSecondaryAction,
  AdminInfoTile,
  AdminPageHero,
  AdminPageShell,
  AdminPanel,
  AdminRestrictedState,
  adminStatusBadge,
} from "@/components/admin/luxury-admin-shell";
import { fmtDate, sb } from "@/lib/utils";
import { isPortalAdminEmail } from "@/lib/portal-admin";
import {
  calculateTransportEstimate,
  type PickupRequestType,
} from "@/lib/transportation-pricing";

type BuyerLookup = {
  id: number;
  user_id?: string | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  city?: string | null;
  state?: string | null;
};

type PuppyLookup = {
  id: number;
  buyer_id?: number | null;
  call_name?: string | null;
  puppy_name?: string | null;
  name?: string | null;
  status?: string | null;
};

type TransportationRequest = {
  id: number;
  created_at?: string | null;
  user_id?: string | null;
  puppy_id?: number | null;
  request_date?: string | null;
  request_type?: string | null;
  miles?: number | null;
  location_text?: string | null;
  address_text?: string | null;
  notes?: string | null;
  status?: string | null;
  buyer?: BuyerLookup | null;
  puppy?: PuppyLookup | null;
};

type RequestForm = {
  status: string;
  request_type: string;
  request_date: string;
  miles: string;
  location_text: string;
  address_text: string;
  notes: string;
};

type SortMode =
  | "created_desc"
  | "created_asc"
  | "date_asc"
  | "date_desc"
  | "miles_desc"
  | "miles_asc";

function normalizeRequestType(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  if (["meetup", "meet-up"].includes(normalized)) return "meet";
  if (["drop-off", "delivery"].includes(normalized)) return "dropoff";
  if (normalized === "transport") return "transportation";
  return normalized;
}

function formatRequestType(value: string | null | undefined) {
  const normalized = normalizeRequestType(value);
  if (!normalized) return "Not selected";
  if (normalized === "meet") return "Meet-Up";
  if (normalized === "dropoff") return "Drop-Off";
  if (normalized === "transportation") return "Transportation";
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatRequestStatus(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Pending";
  if (normalized === "approved") return "Approved";
  if (normalized === "completed") return "Completed";
  if (normalized === "denied") return "Denied";
  if (normalized === "cancelled" || normalized === "canceled") return "Cancelled";
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function requestBuyerName(request: TransportationRequest) {
  return request.buyer?.full_name || request.buyer?.name || request.buyer?.email || "Portal Family";
}

function requestBuyerEmail(request: TransportationRequest) {
  return request.buyer?.email || "No email on file";
}

function requestPuppyName(request: TransportationRequest) {
  return (
    request.puppy?.call_name ||
    request.puppy?.puppy_name ||
    request.puppy?.name ||
    (request.puppy_id ? `Puppy #${request.puppy_id}` : "Not linked")
  );
}

function snippet(value: string | null | undefined, fallback: string) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function milesLabel(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "Not listed";
  return `${Number(value).toLocaleString()} miles`;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildRequestForm(request: TransportationRequest): RequestForm {
  return {
    status: String(request.status || "pending"),
    request_type: normalizeRequestType(request.request_type),
    request_date: String(request.request_date || ""),
    miles:
      request.miles === null || request.miles === undefined ? "" : String(request.miles),
    location_text: String(request.location_text || ""),
    address_text: String(request.address_text || ""),
    notes: String(request.notes || ""),
  };
}

async function fetchTransportationRequests(accessToken: string) {
  if (!accessToken) return [] as TransportationRequest[];

  const response = await fetch("/api/admin/portal/transportation", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) return [] as TransportationRequest[];

  const payload = (await response.json()) as { requests?: TransportationRequest[] };
  return Array.isArray(payload.requests) ? payload.requests : [];
}

export default function AdminPortalTransportationPage() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("created_desc");
  const [requests, setRequests] = useState<TransportationRequest[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [form, setForm] = useState<RequestForm>({
    status: "pending",
    request_type: "",
    request_date: "",
    miles: "",
    location_text: "",
    address_text: "",
    notes: "",
  });

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const {
          data: { session },
        } = await sb.auth.getSession();

        if (!mounted) return;
        const currentUser = session?.user ?? null;
        const token = session?.access_token || "";
        setUser(currentUser);
        setAccessToken(token);

        if (currentUser && isPortalAdminEmail(currentUser.email)) {
          const nextRequests = await fetchTransportationRequests(token);
          if (!mounted) return;
          setRequests(nextRequests);
          setSelectedKey(nextRequests[0]?.id ? String(nextRequests[0].id) : "");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void bootstrap();

    const { data: authListener } = sb.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      const currentUser = session?.user ?? null;
      const token = session?.access_token || "";
      setUser(currentUser);
      setAccessToken(token);

      if (currentUser && isPortalAdminEmail(currentUser.email)) {
        const nextRequests = await fetchTransportationRequests(token);
        setRequests(nextRequests);
        setSelectedKey((current) =>
          nextRequests.find((request) => String(request.id) === current)?.id
            ? current
            : nextRequests[0]?.id
              ? String(nextRequests[0].id)
              : ""
        );
      } else {
        setRequests([]);
        setSelectedKey("");
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    const results = requests.filter((request) => {
      if (statusFilter !== "all" && String(request.status || "").toLowerCase() !== statusFilter) {
        return false;
      }

      if (typeFilter !== "all" && normalizeRequestType(request.request_type) !== typeFilter) {
        return false;
      }

      if (!q) return true;

      return [
        request.id,
        requestBuyerName(request),
        requestBuyerEmail(request),
        request.buyer?.phone,
        requestPuppyName(request),
        request.request_type,
        request.request_date,
        request.location_text,
        request.address_text,
        request.notes,
        request.status,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(q);
    });

    results.sort((left, right) => {
      const leftCreated = new Date(left.created_at || 0).getTime();
      const rightCreated = new Date(right.created_at || 0).getTime();
      const leftMiles = left.miles ?? -1;
      const rightMiles = right.miles ?? -1;

      switch (sortMode) {
        case "created_asc":
          return leftCreated - rightCreated;
        case "date_asc":
          return String(left.request_date || "").localeCompare(String(right.request_date || ""));
        case "date_desc":
          return String(right.request_date || "").localeCompare(String(left.request_date || ""));
        case "miles_asc":
          return leftMiles - rightMiles;
        case "miles_desc":
          return rightMiles - leftMiles;
        case "created_desc":
        default:
          return rightCreated - leftCreated;
      }
    });

    return results;
  }, [requests, search, statusFilter, typeFilter, sortMode]);

  const selectedRequest =
    filteredRequests.find((request) => String(request.id) === selectedKey) ||
    requests.find((request) => String(request.id) === selectedKey) ||
    null;

  const selectedEstimate = useMemo(
    () =>
      calculateTransportEstimate(
        normalizeRequestType(form.request_type) as PickupRequestType,
        form.miles
      ),
    [form.miles, form.request_type]
  );

  useEffect(() => {
    if (!filteredRequests.length) {
      setSelectedKey("");
      return;
    }

    if (!filteredRequests.some((request) => String(request.id) === selectedKey)) {
      setSelectedKey(String(filteredRequests[0].id));
    }
  }, [filteredRequests, selectedKey]);

  useEffect(() => {
    if (!selectedRequest) return;
    setForm(buildRequestForm(selectedRequest));
    setStatusText("");
  }, [selectedRequest]);

  const totalRequests = requests.length;
  const pendingCount = requests.filter((request) => String(request.status || "").toLowerCase() === "pending").length;
  const approvedCount = requests.filter((request) => String(request.status || "").toLowerCase() === "approved").length;
  const completedCount = requests.filter((request) => String(request.status || "").toLowerCase() === "completed").length;
  async function refreshRequests(preferredKey?: string) {
    if (!accessToken) return;
    const nextRequests = await fetchTransportationRequests(accessToken);
    setRequests(nextRequests);
    setSelectedKey(
      preferredKey && nextRequests.some((request) => String(request.id) === preferredKey)
        ? preferredKey
        : nextRequests[0]?.id
          ? String(nextRequests[0].id)
          : ""
    );
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshRequests(selectedRequest ? String(selectedRequest.id) : undefined);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSave(forcedStatus?: string) {
    if (!selectedRequest) return;

    setSaving(true);
    setStatusText("");

    try {
      const response = await fetch("/api/admin/portal/transportation", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          id: selectedRequest.id,
          status: forcedStatus || form.status,
          request_type: form.request_type,
          request_date: form.request_date,
          miles: form.miles,
          location_text: form.location_text,
          address_text: form.address_text,
          notes: form.notes,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not update the request.");
      }

      await refreshRequests(String(selectedRequest.id));
      setStatusText(
        forcedStatus
          ? `Transportation request marked ${formatRequestStatus(forcedStatus)}.`
          : "Transportation request saved."
      );
    } catch (error) {
      console.error(error);
      setStatusText(
        error instanceof Error ? error.message : "Could not update the transportation request."
      );
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    const lines = [
      [
        "id",
        "created_at",
        "buyer_name",
        "buyer_email",
        "buyer_phone",
        "puppy_name",
        "request_date",
        "request_type",
        "miles",
        "location_text",
        "address_text",
        "notes",
        "status",
      ].join(","),
      ...filteredRequests.map((request) =>
        [
          request.id,
          request.created_at || "",
          requestBuyerName(request),
          requestBuyerEmail(request),
          request.buyer?.phone || "",
          requestPuppyName(request),
          request.request_date || "",
          formatRequestType(request.request_type),
          request.miles ?? "",
          request.location_text || "",
          request.address_text || "",
          request.notes || "",
          request.status || "",
        ]
          .map(csvCell)
          .join(",")
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `transportation-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">
        Loading transportation...
      </div>
    );
  }

  if (!user) {
    return (
      <AdminRestrictedState
        title="Sign in to access transportation requests."
        details="This page is reserved for the Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!isPortalAdminEmail(user.email)) {
    return (
      <AdminRestrictedState
        title="This transportation workspace is limited to approved owner accounts."
        details="Only the approved owner emails can manage pickup, meet-up, delivery, and transportation requests here."
      />
    );
  }

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-12">
        <AdminPageHero
          eyebrow="Transportation"
          title="Manage pickup, meet-up, drop-off, and transportation requests in one organized workspace."
          description="This admin tab brings request review, scheduling edits, notes, mileage, and fee visibility together without making the transportation workflow feel cluttered."
          actions={
            <>
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={refreshing}
                className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(181,117,47,0.26)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-60"
              >
                {refreshing ? "Refreshing..." : "Refresh Requests"}
              </button>
              <button
                type="button"
                onClick={exportCsv}
                className="inline-flex items-center rounded-2xl border border-[var(--portal-border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[0_12px_28px_rgba(106,76,45,0.08)] transition hover:-translate-y-0.5 hover:border-[var(--portal-border-strong)]"
              >
                Export CSV
              </button>
              <AdminHeroSecondaryAction href="/admin/portal/payments">
                Open Payments
              </AdminHeroSecondaryAction>
            </>
          }
          aside={
            <div className="space-y-4">
              <AdminInfoTile
                label="Selected Status"
                value={selectedRequest ? formatRequestStatus(selectedRequest.status) : "None"}
                detail={selectedRequest ? formatRequestType(selectedRequest.request_type) : "Choose a request card to begin."}
              />
              <AdminInfoTile
                label="Estimated Fee"
                value={selectedRequest ? selectedEstimate.label : "Pending"}
                detail={
                  selectedRequest
                    ? selectedEstimate.detail
                    : "Choose a transportation request to see the current estimate."
                }
              />
            </div>
          }
        />

        <AdminPanel
          title="Logistics Bench"
          subtitle="Transportation work should show what still needs review, what is already scheduled, and where the breeder may need to quote or coordinate."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminInfoTile
              label="Open Queue"
              value={String(totalRequests)}
              detail="All pickup, meet-up, drop-off, and transportation requests currently on file."
            />
            <AdminInfoTile
              label="Waiting Review"
              value={String(pendingCount)}
              detail="Requests still waiting for breeder review, estimate confirmation, or scheduling."
            />
            <AdminInfoTile
              label="Confirmed Runs"
              value={String(approvedCount)}
              detail={`${completedCount} requests have already been completed and archived into the delivery history.`}
            />
            <AdminInfoTile
              label="Current Estimate"
              value={selectedRequest ? selectedEstimate.label : "Select request"}
              detail={selectedRequest ? selectedEstimate.detail : "Choose a request to review the pricing guidance and logistics notes."}
            />
          </div>
        </AdminPanel>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <AdminPanel
            title="Transportation Requests"
            subtitle="Search by buyer, puppy, request type, location, notes, or status. Select a card to open the request console."
          >
            <div className="grid gap-3">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search buyer, email, puppy, location..."
                className="w-full rounded-[20px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3 text-sm text-[var(--portal-text)] outline-none focus:border-[#c8a884]"
              />

              <div className="grid gap-3 md:grid-cols-3">
                <TransportationSelect
                  label="Status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: "all", label: "All statuses" },
                    { value: "pending", label: "Pending" },
                    { value: "approved", label: "Approved" },
                    { value: "completed", label: "Completed" },
                    { value: "denied", label: "Denied" },
                    { value: "cancelled", label: "Cancelled" },
                  ]}
                />
                <TransportationSelect
                  label="Type"
                  value={typeFilter}
                  onChange={setTypeFilter}
                  options={[
                    { value: "all", label: "All types" },
                    { value: "pickup", label: "Pickup" },
                    { value: "meet", label: "Meet-Up" },
                    { value: "dropoff", label: "Drop-Off / Delivery" },
                    { value: "transportation", label: "Transportation" },
                  ]}
                />
                <TransportationSelect
                  label="Sort"
                  value={sortMode}
                  onChange={(value) => setSortMode(value as SortMode)}
                  options={[
                    { value: "created_desc", label: "Newest created" },
                    { value: "created_asc", label: "Oldest created" },
                    { value: "date_asc", label: "Request date up" },
                    { value: "date_desc", label: "Request date down" },
                    { value: "miles_desc", label: "Miles high" },
                    { value: "miles_asc", label: "Miles low" },
                  ]}
                />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {filteredRequests.length ? (
                filteredRequests.map((request) => {
                  const estimate = calculateTransportEstimate(
                    normalizeRequestType(request.request_type) as PickupRequestType,
                    request.miles
                  );

                  return (
                    <button
                      key={request.id}
                      type="button"
                      onClick={() => setSelectedKey(String(request.id))}
                      className={[
                        "block w-full rounded-[26px] border p-4 text-left transition",
                        selectedKey === String(request.id)
                          ? "border-[#d8b48b] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2e9_100%)] shadow-[0_14px_30px_rgba(106,76,45,0.08)]"
                          : "border-[var(--portal-border)] bg-[#fffaf5] hover:-translate-y-0.5 hover:border-[#d8b48b] hover:bg-white",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[var(--portal-text)]">
                            {requestBuyerName(request)}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-[var(--portal-text-soft)]">
                            {requestBuyerEmail(request)}
                          </div>
                        </div>
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(
                            request.status
                          )}`}
                        >
                          {formatRequestStatus(request.status)}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <TransportationMiniCard label="Puppy" value={requestPuppyName(request)} />
                        <TransportationMiniCard label="Type" value={formatRequestType(request.request_type)} />
                        <TransportationMiniCard label="Request Date" value={request.request_date ? fmtDate(request.request_date) : "Not listed"} />
                        <TransportationMiniCard label="Miles" value={milesLabel(request.miles)} />
                      </div>

                      <div className="mt-4 rounded-[20px] border border-[var(--portal-border)] bg-white px-4 py-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
                          Location
                        </div>
                        <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
                          {snippet(request.location_text || request.address_text, "No location details yet.")}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-[#9c7a57]">
                        <span>{estimate.label}</span>
                        <span>{request.created_at ? `Created ${fmtDate(request.created_at)}` : "Created date unavailable"}</span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <AdminEmptyState
                  title="No transportation requests found"
                  description="Try adjusting the search or filters to bring the request list back into view."
                />
              )}
            </div>
          </AdminPanel>

          {selectedRequest ? (
            <div className="space-y-6">
              <AdminPanel
                title="Request Snapshot"
                subtitle="Buyer, puppy, schedule, and fee visibility stay grouped at the top of the request console."
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <AdminInfoTile
                    label="Buyer"
                    value={requestBuyerName(selectedRequest)}
                    detail={[
                      requestBuyerEmail(selectedRequest),
                      selectedRequest.buyer?.phone || null,
                    ]
                      .filter(Boolean)
                      .join(" • ") || "No buyer contact details linked."}
                  />
                  <AdminInfoTile
                    label="Puppy"
                    value={requestPuppyName(selectedRequest)}
                    detail={selectedRequest.puppy?.status || "No puppy status linked."}
                  />
                  <AdminInfoTile
                    label="Created"
                    value={selectedRequest.created_at ? fmtDate(selectedRequest.created_at) : "Not listed"}
                    detail={`Request #${selectedRequest.id}`}
                  />
                  <AdminInfoTile
                    label="Transportation Type"
                    value={formatRequestType(selectedRequest.request_type)}
                    detail={selectedEstimate.label}
                  />
                </div>
              </AdminPanel>

              <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
                <AdminPanel
                  title="Scheduling and Logistics"
                  subtitle="Update request status, timing, mileage, location details, and notes in one place."
                >
                  {statusText ? (
                    <div className="mb-4 rounded-[18px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--portal-text-soft)]">
                      {statusText}
                    </div>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-2">
                    <TransportationSelect
                      label="Status"
                      value={form.status}
                      onChange={(value) => setForm((current) => ({ ...current, status: value }))}
                      options={[
                        { value: "pending", label: "Pending" },
                        { value: "approved", label: "Approved" },
                        { value: "completed", label: "Completed" },
                        { value: "denied", label: "Denied" },
                        { value: "cancelled", label: "Cancelled" },
                      ]}
                    />
                    <TransportationSelect
                      label="Request Type"
                      value={form.request_type}
                      onChange={(value) => setForm((current) => ({ ...current, request_type: value }))}
                      options={[
                        { value: "pickup", label: "Pickup" },
                        { value: "meet", label: "Meet-Up" },
                        { value: "dropoff", label: "Drop-Off / Delivery" },
                        { value: "transportation", label: "Transportation" },
                      ]}
                    />
                    <TransportationField
                      label="Request Date"
                      type="date"
                      value={form.request_date}
                      onChange={(value) => setForm((current) => ({ ...current, request_date: value }))}
                    />
                    <TransportationField
                      label="Miles"
                      type="number"
                      value={form.miles}
                      onChange={(value) => setForm((current) => ({ ...current, miles: value }))}
                      placeholder="One-way mileage"
                    />
                  </div>

                  <div className="mt-4 grid gap-4">
                    <TransportationField
                      label="Location Text"
                      value={form.location_text}
                      onChange={(value) => setForm((current) => ({ ...current, location_text: value }))}
                      placeholder="Meet point, airport, or city"
                    />
                    <TransportationField
                      label="Address"
                      value={form.address_text}
                      onChange={(value) => setForm((current) => ({ ...current, address_text: value }))}
                      placeholder="Street, city, state"
                    />
                    <TransportationTextarea
                      label="Notes"
                      value={form.notes}
                      onChange={(value) => setForm((current) => ({ ...current, notes: value }))}
                      rows={6}
                    />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void handleSave("approved")}
                      disabled={saving}
                      className="rounded-full bg-[#3f8e63] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:brightness-105 disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSave("completed")}
                      disabled={saving}
                      className="rounded-full bg-[#5a7fb0] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:brightness-105 disabled:opacity-60"
                    >
                      Complete
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSave("denied")}
                      disabled={saving}
                      className="rounded-full bg-[#b24e59] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:brightness-105 disabled:opacity-60"
                    >
                      Deny
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSave("cancelled")}
                      disabled={saving}
                      className="rounded-full border border-[#d9c9b7] bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-[var(--portal-text)] transition hover:border-[#caa57b] disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={saving}
                      className="rounded-2xl bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(181,117,47,0.26)] transition hover:brightness-105 disabled:opacity-60"
                    >
                      {saving ? "Saving..." : "Save Request"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(buildRequestForm(selectedRequest))}
                      className="rounded-2xl border border-[var(--portal-border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[0_12px_28px_rgba(106,76,45,0.08)] transition hover:border-[var(--portal-border-strong)]"
                    >
                      Reset
                    </button>
                  </div>
                </AdminPanel>
                <div className="space-y-6">
                  <AdminPanel
                    title="Fee Guidance"
                    subtitle="This estimate uses the same pricing rules as the buyer transportation page."
                  >
                    <div className="space-y-4">
                      <AdminInfoTile
                        label="Estimated Transportation Fee"
                        value={selectedEstimate.label}
                        detail={selectedEstimate.detail}
                      />
                      <div className="rounded-[24px] border border-[var(--portal-border)] bg-[#fffaf5] p-4 text-sm leading-6 text-[var(--portal-text-soft)]">
                        Transportation fees are not written back to the buyer balance from this tab.
                        Review the request here, then use the Payments workspace to log the
                        transportation fee on the account when needed.
                      </div>
                      <Link
                        href="/admin/portal/payments"
                        className="inline-flex w-full items-center justify-center rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[0_12px_28px_rgba(106,76,45,0.08)] transition hover:border-[var(--portal-border-strong)]"
                      >
                        Open Payments to Record Fee
                      </Link>
                    </div>
                  </AdminPanel>

                  <AdminPanel
                    title="Request Notes"
                    subtitle="A cleaner read-only summary of the request details currently on file."
                  >
                    <div className="space-y-3">
                      <RequestSummaryRow label="Current Status" value={formatRequestStatus(selectedRequest.status)} />
                      <RequestSummaryRow label="Request Type" value={formatRequestType(selectedRequest.request_type)} />
                      <RequestSummaryRow label="Request Date" value={selectedRequest.request_date ? fmtDate(selectedRequest.request_date) : "Not listed"} />
                      <RequestSummaryRow label="Miles" value={milesLabel(selectedRequest.miles)} />
                      <RequestSummaryRow label="Location" value={selectedRequest.location_text || "Not listed"} />
                      <RequestSummaryRow label="Address" value={selectedRequest.address_text || "Not listed"} />
                      <RequestSummaryRow label="Notes" value={selectedRequest.notes || "No notes added yet."} multiline />
                    </div>
                  </AdminPanel>
                </div>
              </section>
            </div>
          ) : (
            <AdminPanel title="Transportation Console" subtitle="Choose a request card to begin.">
              <AdminEmptyState
                title="No transportation request selected"
                description="Select a request from the left to review and update pickup, meet-up, drop-off, or transportation details."
              />
            </AdminPanel>
          )}
        </section>
      </div>
    </AdminPageShell>
  );
}

function TransportationField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-[18px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3.5 text-sm normal-case tracking-normal text-[var(--portal-text)] outline-none focus:border-[#c8a884]"
      />
    </label>
  );
}

function TransportationTextarea({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="mt-2 w-full rounded-[18px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3.5 text-sm normal-case tracking-normal text-[var(--portal-text)] outline-none focus:border-[#c8a884]"
      />
    </label>
  );
}

function TransportationSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-[18px] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-3.5 text-sm normal-case tracking-normal text-[var(--portal-text)] outline-none focus:border-[#c8a884]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TransportationMiniCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-[var(--portal-border)] bg-white/88 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">{value}</div>
    </div>
  );
}

function RequestSummaryRow({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="rounded-[18px] border border-[var(--portal-border)] bg-[#fffaf5] px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
        {label}
      </div>
      <div className={`mt-2 text-sm leading-6 text-[var(--portal-text)] ${multiline ? "whitespace-pre-wrap" : ""}`}>
        {value}
      </div>
    </div>
  );
}

