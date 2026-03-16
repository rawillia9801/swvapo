"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { sb, fmtDate } from "@/lib/utils";

type PuppyApplicationRow = {
  id: number;
  created_at: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  city_state: string | null;
  preferred_contact: string | null;
  best_time: string | null;
  street_address: string | null;
  zip: string | null;
  status: string | null;
  admin_notes: string | null;
  application: any;
  applicant_email: string | null;
  ack_age?: boolean | null;
  ack_accuracy?: boolean | null;
  ack_home_env?: boolean | null;
  ack_care_commitment?: boolean | null;
  ack_health_guarantee?: boolean | null;
  ack_nonrefundable_deposit?: boolean | null;
  ack_purchase_price_tax?: boolean | null;
  ack_contract_obligation?: boolean | null;
  ack_return_policy?: boolean | null;
  ack_release_liability?: boolean | null;
  ack_terms?: boolean | null;
  ack_communications?: boolean | null;
  assigned_puppy_id?: number | null;
};

type AdminEditState = {
  status: string;
  admin_notes: string;
  assigned_puppy_id: string;
};

const STATUS_OPTIONS = [
  "submitted",
  "pending review",
  "approved",
  "denied",
  "waitlist",
  "matched",
  "on hold",
];

export default function AdminPortalApplicationsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PuppyApplicationRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const [edit, setEdit] = useState<AdminEditState>({
    status: "submitted",
    admin_notes: "",
    assigned_puppy_id: "",
  });

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const {
          data: { session },
        } = await sb.auth.getSession();

        if (!mounted) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          await loadApplications();
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: authListener } = sb.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;
        if (!mounted) return;

        setUser(currentUser);

        if (currentUser) {
          await loadApplications();
        } else {
          setRows([]);
          setSelectedId(null);
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function loadApplications() {
    const { data, error } = await sb
      .from("puppy_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setRows([]);
      setSelectedId(null);
      return;
    }

    const list = (data || []) as PuppyApplicationRow[];
    setRows(list);

    setSelectedId((prev) => {
      if (prev && list.some((row) => row.id === prev)) return prev;
      return list[0]?.id ?? null;
    });
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesStatus =
        statusFilter === "all"
          ? true
          : String(row.status || "submitted").toLowerCase() === statusFilter.toLowerCase();

      if (!matchesStatus) return false;
      if (!q) return true;

      const app = row.application || {};

      const haystack = [
        row.id,
        row.full_name,
        row.email,
        row.applicant_email,
        row.phone,
        row.city_state,
        row.status,
        row.admin_notes,
        app.fullName,
        app.email,
        app.phone,
        app.city,
        app.state,
        app.interestType,
        app.preferredGender,
        app.preferredCoatType,
        app.colorPreference,
        app.paymentPreference,
        app.howDidYouHear,
        app.signature,
      ]
        .map((v) => String(v || "").toLowerCase())
        .join(" ");

      return haystack.includes(q);
    });
  }, [rows, search, statusFilter]);

  const selected = useMemo(
    () => filteredRows.find((row) => row.id === selectedId) || rows.find((row) => row.id === selectedId) || null,
    [filteredRows, rows, selectedId]
  );

  useEffect(() => {
    if (!selected) return;

    setEdit({
      status: selected.status || "submitted",
      admin_notes: selected.admin_notes || "",
      assigned_puppy_id:
        selected.assigned_puppy_id !== null && selected.assigned_puppy_id !== undefined
          ? String(selected.assigned_puppy_id)
          : "",
    });

    setSaveMessage("");
  }, [selected]);

  function updateEdit<K extends keyof AdminEditState>(key: K, value: AdminEditState[K]) {
    setEdit((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSaveAdminFields(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;

    setSaving(true);
    setSaveMessage("");

    const payload = {
      status: edit.status || "submitted",
      admin_notes: edit.admin_notes.trim() || null,
      assigned_puppy_id: edit.assigned_puppy_id.trim()
        ? Number(edit.assigned_puppy_id)
        : null,
    };

    const { error } = await sb
      .from("puppy_applications")
      .update(payload)
      .eq("id", selected.id);

    if (error) {
      setSaveMessage(error.message || "Unable to save application updates.");
      setSaving(false);
      return;
    }

    await loadApplications();
    setSaveMessage("Application updated successfully.");
    setSaving(false);
  }

  const stats = useMemo(() => {
    const total = rows.length;
    const submitted = rows.filter(
      (r) => String(r.status || "submitted").toLowerCase() === "submitted"
    ).length;
    const pending = rows.filter((r) =>
      String(r.status || "").toLowerCase().includes("pending")
    ).length;
    const approved = rows.filter((r) =>
      String(r.status || "").toLowerCase().includes("approved")
    ).length;
    const matched = rows.filter((r) =>
      String(r.status || "").toLowerCase().includes("matched")
    ).length;

    return { total, submitted, pending, approved, matched };
  }, [rows]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50 italic text-brand-700">
        Loading applications...
      </div>
    );
  }

  if (!user) {
    return <AdminApplicationsLogin />;
  }

  return (
    <div className="min-h-screen bg-brand-50 text-brand-900">
      <main className="min-h-screen bg-texturePaper">
        <div className="mx-auto w-full max-w-[1700px] px-4 py-6 md:px-8 md:py-8 lg:px-10 lg:py-10">
          <div className="space-y-6">
            <header className="rounded-[32px] border border-brand-200 bg-gradient-to-br from-[#fff8f1] via-[#fffefc] to-white p-6 shadow-paper md:p-8">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-4 py-2 shadow-sm">
                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                      Admin Portal
                    </span>
                    <span className="h-1 w-1 rounded-full bg-brand-300" />
                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                      Applications
                    </span>
                  </div>

                  <h1 className="mt-5 font-serif text-4xl font-bold leading-[0.96] text-brand-900 md:text-5xl">
                    Submitted Applications
                  </h1>

                  <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-brand-500 md:text-base">
                    Review, search, filter, and manage puppy applications using the same
                    `puppy_applications` data structure as the portal application page.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/admin/portal"
                    className="inline-flex items-center gap-2 rounded-[18px] border border-brand-200 bg-white px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-brand-700 transition hover:bg-brand-50"
                  >
                    Portal Admin
                  </Link>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
                <StatPill label="Total" value={String(stats.total)} />
                <StatPill label="Submitted" value={String(stats.submitted)} />
                <StatPill label="Pending" value={String(stats.pending)} />
                <StatPill label="Approved" value={String(stats.approved)} />
                <StatPill label="Matched" value={String(stats.matched)} />
              </div>
            </header>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[460px_minmax(0,1fr)]">
              <div className="space-y-6">
                <div className="card-luxury p-5">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
                        Search
                      </label>
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Name, email, phone, city, status..."
                        className="w-full rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm text-brand-900 outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
                        Status Filter
                      </label>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm text-brand-900 outline-none"
                      >
                        <option value="all">All</option>
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="card-luxury p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h2 className="font-serif text-2xl font-bold text-brand-900">
                        Application List
                      </h2>
                      <p className="mt-1 text-sm font-semibold text-brand-500">
                        {filteredRows.length} result(s)
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-[980px] overflow-y-auto pr-1">
                    {filteredRows.length ? (
                      filteredRows.map((row) => {
                        const active = row.id === selected?.id;
                        const pill = statusPill(row.status || "submitted");
                        const app = row.application || {};

                        return (
                          <button
                            key={row.id}
                            type="button"
                            onClick={() => setSelectedId(row.id)}
                            className={`w-full rounded-[24px] border p-4 text-left transition ${
                              active
                                ? "border-brand-300 bg-gradient-to-r from-[#fff5ea] via-white to-[#fffaf4] shadow-paper"
                                : "border-brand-200 bg-white/75 hover:bg-white"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-black text-brand-900">
                                  {row.full_name ||
                                    app.fullName ||
                                    row.email ||
                                    row.applicant_email ||
                                    `Application #${row.id}`}
                                </div>
                                <div className="mt-1 text-[12px] font-semibold text-brand-500 break-words">
                                  {row.email || row.applicant_email || app.email || "No email"}
                                </div>
                              </div>

                              <span
                                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${pill.cls}`}
                              >
                                <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                                {pill.label}
                              </span>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-3 text-[11px] font-semibold text-brand-400">
                              <div>ID #{row.id}</div>
                              <div className="text-right">
                                {row.created_at ? fmtDate(row.created_at) : "—"}
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-3">
                              <MiniInfo label="Interest" value={app.interestType || "—"} />
                              <MiniInfo
                                label="Deposit Ready"
                                value={app.readyToPlaceDeposit || "—"}
                              />
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <EmptyCard text="No applications found." />
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6 min-w-0">
                {selected ? (
                  <>
                    <div className="card-luxury overflow-hidden">
                      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr]">
                        <div className="p-7 md:p-8">
                          <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-100 px-3 py-1">
                            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-700">
                              Application Details
                            </span>
                          </div>

                          <h2 className="mt-5 font-serif text-3xl font-bold leading-[1.02] text-brand-900">
                            {selected.full_name ||
                              selected.application?.fullName ||
                              selected.email ||
                              selected.applicant_email ||
                              `Application #${selected.id}`}
                          </h2>

                          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-brand-500">
                            Full review of the submitted application using the same portal data
                            structure.
                          </p>

                          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <SummaryCard label="Application ID" value={String(selected.id)} />
                            <SummaryCard
                              label="Submitted"
                              value={selected.created_at ? fmtDate(selected.created_at) : "—"}
                            />
                            <SummaryCard
                              label="Status"
                              value={selected.status || "submitted"}
                            />
                            <SummaryCard
                              label="Assigned Puppy"
                              value={
                                selected.assigned_puppy_id !== null &&
                                selected.assigned_puppy_id !== undefined
                                  ? String(selected.assigned_puppy_id)
                                  : "Pending"
                              }
                            />
                          </div>
                        </div>

                        <div className="border-t border-brand-100 bg-gradient-to-br from-[#fff8f1] via-[#f8efe4] to-[#efe2d2] p-7 lg:border-l lg:border-t-0">
                          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                            Admin Controls
                          </div>

                          <form onSubmit={handleSaveAdminFields} className="mt-4 space-y-4">
                            <SelectField
                              label="Status"
                              value={edit.status}
                              onChange={(v) => updateEdit("status", v)}
                              options={STATUS_OPTIONS}
                            />

                            <Field
                              label="Assigned Puppy ID"
                              value={edit.assigned_puppy_id}
                              onChange={(v) => updateEdit("assigned_puppy_id", v)}
                              placeholder="Example: 12"
                            />

                            <TextAreaField
                              label="Admin Notes"
                              value={edit.admin_notes}
                              onChange={(v) => updateEdit("admin_notes", v)}
                              rows={7}
                            />

                            <div className="min-h-[24px] text-sm font-semibold text-brand-600">
                              {saveMessage}
                            </div>

                            <button
                              type="submit"
                              disabled={saving}
                              className="w-full rounded-[18px] bg-brand-800 px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-white shadow-lift transition hover:bg-brand-700 disabled:opacity-60"
                            >
                              {saving ? "Saving..." : "Save Admin Updates"}
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>

                    <ApplicationDetailsSection row={selected} />
                  </>
                ) : (
                  <div className="card-luxury p-10">
                    <div className="text-center text-brand-400 italic">
                      Select an application to view details.
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function ApplicationDetailsSection({ row }: { row: PuppyApplicationRow }) {
  const app = row.application || {};
  const cityState = parseCityState(row.city_state || "");

  const acknowledgements = [
    {
      label: "Age and legal capacity",
      value: !!(row.ack_age ?? app.ackAgeCapacity),
    },
    {
      label: "Accuracy of information",
      value: !!(row.ack_accuracy ?? app.ackAccuracy),
    },
    {
      label: "Home environment suitability",
      value: !!(row.ack_home_env ?? app.ackHomeEnvironment),
    },
    {
      label: "Care commitment",
      value: !!app.ackCareCommitment,
    },
    {
      label: "Health guarantee understanding",
      value: !!app.ackHealthGuarantee,
    },
    {
      label: "Nonrefundable deposit acknowledged",
      value: !!app.ackNonrefundableDeposit,
    },
    {
      label: "Purchase price and tax acknowledged",
      value: !!app.ackPurchasePriceTax,
    },
    {
      label: "Contractual obligation acknowledged",
      value: !!app.ackContractualObligation,
    },
    {
      label: "Return and re-homing policy acknowledged",
      value: !!app.ackReturnRehoming,
    },
    {
      label: "Release of liability acknowledged",
      value: !!app.ackReleaseLiability,
    },
    {
      label: "Agreement to terms",
      value: !!(row.ack_terms ?? app.ackAgreementTerms),
    },
    {
      label: "Communications consent",
      value: !!app.ackCommunications,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-6 card-luxury p-7">
          <SectionTitle
            eyebrow="Section 1"
            title="Applicant Info"
          />

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SummaryCard label="Full Name" value={row.full_name || app.fullName || "—"} />
            <SummaryCard label="Email" value={row.email || row.applicant_email || app.email || "—"} />
            <SummaryCard label="Phone" value={row.phone || app.phone || "—"} />
            <SummaryCard
              label="Preferred Contact"
              value={row.preferred_contact || app.preferredContactMethod || "—"}
            />
            <SummaryCard
              label="Street Address"
              value={row.street_address || app.streetAddress || "—"}
            />
            <SummaryCard label="City" value={cityState.city || app.city || "—"} />
            <SummaryCard label="State" value={cityState.state || app.state || "—"} />
            <SummaryCard label="Zip" value={row.zip || app.zip || "—"} />
          </div>
        </div>

        <div className="xl:col-span-6 card-luxury p-7">
          <SectionTitle
            eyebrow="Section 2"
            title="Puppy Preferences"
          />

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SummaryCard
              label="Preferred Coat Type"
              value={app.preferredCoatType || "—"}
            />
            <SummaryCard
              label="Preferred Gender"
              value={app.preferredGender || "—"}
            />
            <SummaryCard
              label="Color Preference"
              value={app.colorPreference || "—"}
            />
            <SummaryCard
              label="Desired Adoption Date"
              value={app.desiredAdoptionDate || "—"}
            />
            <SummaryCard
              label="Interest Type"
              value={app.interestType || "—"}
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-6 card-luxury p-7">
          <SectionTitle
            eyebrow="Section 3"
            title="Lifestyle & Home"
          />

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SummaryCard label="Other Pets" value={app.otherPets || "—"} />
            <SummaryCard label="Pet Details" value={app.petDetails || "—"} />
            <SummaryCard
              label="Owned Chihuahua Before"
              value={app.ownedChihuahuaBefore || "—"}
            />
            <SummaryCard label="Home Type" value={app.homeType || "—"} />
            <SummaryCard label="Fenced Yard" value={app.fencedYard || "—"} />
            <SummaryCard label="Work Status" value={app.workStatus || "—"} />
            <SummaryCard
              label="Who Cares for Puppy"
              value={app.whoCaresForPuppy || "—"}
            />
            <SummaryCard
              label="Children at Home"
              value={app.childrenAtHome || "—"}
            />
          </div>
        </div>

        <div className="xl:col-span-6 card-luxury p-7">
          <SectionTitle
            eyebrow="Section 4"
            title="Payment & Intent"
          />

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SummaryCard
              label="Payment Preference"
              value={app.paymentPreference || "—"}
            />
            <SummaryCard
              label="How They Heard About Us"
              value={app.howDidYouHear || "—"}
            />
            <SummaryCard
              label="Ready To Place Deposit"
              value={app.readyToPlaceDeposit || "—"}
            />
          </div>

          <div className="mt-4">
            <LongTextCard
              label="Questions"
              value={app.questions || "—"}
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7 card-luxury p-7">
          <SectionTitle
            eyebrow="Section 5"
            title="Agreement & Signature"
          />

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SummaryCard
              label="Agreed To Terms"
              value={app.agreeTerms ? "Yes" : "No"}
            />
            <SummaryCard
              label="Signed At"
              value={app.signedAt || "—"}
            />
            <SummaryCard
              label="Signature"
              value={app.signature || "—"}
            />
            <SummaryCard
              label="Terms Version"
              value={app.termsVersion || "—"}
            />
          </div>
        </div>

        <div className="xl:col-span-5 card-luxury p-7">
          <SectionTitle
            eyebrow="Section 6"
            title="Acknowledgements"
          />

          <div className="mt-5 space-y-3">
            {acknowledgements.map((item) => (
              <AckRow key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        </div>
      </section>

      {row.admin_notes ? (
        <section className="card-luxury p-7">
          <SectionTitle
            eyebrow="Internal"
            title="Admin Notes"
          />

          <div className="mt-5 rounded-2xl border border-brand-200 bg-white/70 p-5 whitespace-pre-wrap text-sm font-semibold leading-7 text-brand-800">
            {row.admin_notes}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function parseCityState(value: string) {
  if (!value) return { city: "", state: "" };
  const parts = value.split(",").map((p) => p.trim());
  if (parts.length >= 2) return { city: parts[0], state: parts[1] };
  return { city: value, state: "" };
}

function statusPill(statusRaw: any) {
  const raw = String(statusRaw || "").trim();
  const s = raw.toLowerCase();

  let cls = "bg-stone-100 text-stone-700 border border-stone-200";
  let label = raw || "submitted";

  if (
    ["approved", "complete", "completed", "matched", "active", "reserved"].some((x) =>
      s.includes(x)
    )
  ) {
    cls = "bg-emerald-50 text-emerald-700 border border-emerald-200";
  } else if (
    ["pending", "review", "processing", "await", "in progress", "submitted", "hold"].some((x) =>
      s.includes(x)
    )
  ) {
    cls = "bg-amber-50 text-amber-700 border border-amber-200";
  } else if (
    ["denied", "rejected", "cancel"].some((x) => s.includes(x))
  ) {
    cls = "bg-rose-50 text-rose-700 border border-rose-200";
  }

  return { cls, label };
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-brand-200 bg-white/75 px-4 py-3 shadow-sm">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-black text-brand-900">{value}</div>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50/70 px-3 py-2">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-brand-400">
        {label}
      </div>
      <div className="mt-1 text-[12px] font-semibold text-brand-700 break-words">
        {value}
      </div>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
        {eyebrow}
      </div>
      <h3 className="mt-2 font-serif text-2xl font-bold text-brand-900">
        {title}
      </h3>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-white/70 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-black text-brand-900 break-words">
        {value}
      </div>
    </div>
  );
}

function LongTextCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-white/70 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
        {label}
      </div>
      <div className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-7 text-brand-800">
        {value}
      </div>
    </div>
  );
}

function AckRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-brand-200 bg-white/70 px-4 py-3">
      <div className="text-sm font-semibold leading-6 text-brand-800">
        {label}
      </div>
      <div
        className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
          value
            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border border-rose-200 bg-rose-50 text-rose-700"
        }`}
      >
        {value ? "Yes" : "No"}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
        {label}
      </label>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm text-brand-900 outline-none"
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
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm text-brand-900 outline-none"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
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
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
        {label}
      </label>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm text-brand-900 outline-none resize-y"
      />
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-brand-200 bg-white/60 px-5 py-10 text-center text-sm italic text-brand-400">
      {text}
    </div>
  );
}

function AdminApplicationsLogin() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const login = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await sb.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error) alert(error.message);
  };

  return (
    <div className="min-h-screen bg-[#f7f3ee] px-4 py-10 md:px-8">
      <div className="mx-auto max-w-[760px]">
        <div className="overflow-hidden rounded-[36px] border border-[#e7d9c8] bg-gradient-to-br from-[#fff8f1] via-[#fffdfb] to-white shadow-[0_30px_80px_rgba(88,63,37,0.12)]">
          <div className="px-8 py-10 md:px-12 md:py-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dcc6ad] bg-white/70 px-4 py-2 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#a47946]">
                Admin Access Required
              </span>
            </div>

            <h1 className="mt-6 font-serif text-4xl font-bold leading-[0.98] text-[#3e2a1f] md:text-5xl">
              Sign in to view portal applications.
            </h1>

            <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-[#7a5a3a] md:text-base">
              This page is for reviewing submitted puppy applications from the admin side.
            </p>

            <form onSubmit={login} className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-[#a47946]">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm text-[#3e2a1f] outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-[#a47946]">
                  Password
                </label>
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  className="w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm text-[#3e2a1f] outline-none"
                  required
                />
              </div>

              <button className="w-full rounded-[18px] bg-[#6b4d33] px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-white shadow-[0_14px_30px_rgba(88,63,37,0.18)] transition hover:bg-[#5b412c]">
                Sign In
              </button>

              <Link
                href="/admin/portal"
                className="block text-center text-[11px] font-black uppercase tracking-[0.18em] text-[#a47946] hover:text-[#6b4d33]"
              >
                Back to Admin Portal
              </Link>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}