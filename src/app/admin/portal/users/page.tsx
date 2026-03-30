"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  AdminEmptyState,
  AdminHeroSecondaryAction,
  AdminInfoTile,
  AdminListCard,
  AdminMetricCard,
  AdminMetricGrid,
  AdminPageHero,
  AdminPageShell,
  AdminPanel,
  AdminRestrictedState,
  adminStatusBadge,
} from "@/components/admin/luxury-admin-shell";
import { fmtDate, sb } from "@/lib/utils";
import { isPortalAdminEmail } from "@/lib/portal-admin";

type BuyerRow = {
  id: number;
  user_id?: string | null;
  puppy_id?: number | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  notes?: string | null;
  city?: string | null;
  state?: string | null;
  created_at?: string | null;
};

type BuyerCard = {
  key: string;
  buyer: BuyerRow;
  displayName: string;
  email: string;
  phone: string;
  hasPortalAccount: boolean;
  portalUser: {
    id: string;
    email: string;
    created_at?: string | null;
    last_sign_in_at?: string | null;
  } | null;
  applicationCount: number;
  latestApplicationStatus?: string | null;
  formCount: number;
};

type BuyerForm = {
  full_name: string;
  email: string;
  phone: string;
  status: string;
  notes: string;
  city: string;
  state: string;
};

function emptyBuyerForm(): BuyerForm {
  return {
    full_name: "",
    email: "",
    phone: "",
    status: "pending",
    notes: "",
    city: "",
    state: "",
  };
}

async function fetchAdminBuyers(accessToken: string) {
  if (!accessToken) return [] as BuyerCard[];

  const response = await fetch("/api/admin/portal/buyers", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return [] as BuyerCard[];
  }

  const payload = (await response.json()) as { buyers?: BuyerCard[] };
  return Array.isArray(payload.buyers) ? payload.buyers : [];
}

export default function AdminPortalBuyersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [createStatusText, setCreateStatusText] = useState("");
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [buyers, setBuyers] = useState<BuyerCard[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [form, setForm] = useState<BuyerForm>(emptyBuyerForm);
  const [createForm, setCreateForm] = useState<BuyerForm>(emptyBuyerForm);

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
          const nextBuyers = await fetchAdminBuyers(token);
          if (!mounted) return;
          setBuyers(nextBuyers);
          setSelectedKey(nextBuyers[0]?.key || "");
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
        const nextBuyers = await fetchAdminBuyers(token);
        if (!mounted) return;
        setBuyers(nextBuyers);
        setSelectedKey((prev) => nextBuyers.find((buyer) => buyer.key === prev)?.key || nextBuyers[0]?.key || "");
      } else {
        setBuyers([]);
        setSelectedKey("");
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const filteredBuyers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return buyers;

    return buyers.filter((record) =>
      [
        record.displayName,
        record.email,
        record.phone,
        record.buyer.status,
        record.buyer.city,
        record.buyer.state,
        record.buyer.notes,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(q)
    );
  }, [buyers, search]);

  const selectedBuyer =
    filteredBuyers.find((record) => record.key === selectedKey) ||
    buyers.find((record) => record.key === selectedKey) ||
    null;

  useEffect(() => {
    if (!selectedBuyer) return;

    setForm({
      full_name: String(selectedBuyer.buyer.full_name || selectedBuyer.buyer.name || selectedBuyer.displayName || ""),
      email: String(selectedBuyer.buyer.email || selectedBuyer.email || ""),
      phone: String(selectedBuyer.buyer.phone || selectedBuyer.phone || ""),
      status: String(selectedBuyer.buyer.status || "pending"),
      notes: String(selectedBuyer.buyer.notes || ""),
      city: String(selectedBuyer.buyer.city || ""),
      state: String(selectedBuyer.buyer.state || ""),
    });
    setStatusText("");
  }, [selectedBuyer]);

  async function refreshBuyers(nextSelectedKey?: string) {
    const nextBuyers = await fetchAdminBuyers(accessToken);
    setBuyers(nextBuyers);
    setSelectedKey(nextSelectedKey || nextBuyers[0]?.key || "");
  }

  async function saveBuyer() {
    if (!selectedBuyer?.buyer?.id) return;

    setSaving(true);
    setStatusText("");

    try {
      const response = await fetch("/api/admin/portal/buyers", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          id: selectedBuyer.buyer.id,
          ...form,
        }),
      });

      if (!response.ok) {
        throw new Error("Could not update the buyer record.");
      }

      await refreshBuyers(selectedBuyer.key);
      setStatusText("Buyer record updated.");
    } catch (error) {
      console.error(error);
      setStatusText("Could not update the buyer record.");
    } finally {
      setSaving(false);
    }
  }

  async function createBuyer() {
    setCreating(true);
    setCreateStatusText("");

    try {
      const response = await fetch("/api/admin/portal/buyers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(createForm),
      });

      const payload = (await response.json()) as { buyerId?: number; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not create the buyer.");
      }

      setCreateForm(emptyBuyerForm());
      setShowCreateForm(false);
      await refreshBuyers(String(payload.buyerId || ""));
      setCreateStatusText("Buyer record created.");
    } catch (error) {
      console.error(error);
      setCreateStatusText("Could not create the buyer.");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">Loading buyers...</div>;
  }

  if (!user) {
    return (
      <AdminRestrictedState
        title="Sign in to access buyer records."
        details="This page is reserved for the Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!isPortalAdminEmail(user.email)) {
    return (
      <AdminRestrictedState
        title="This buyer workspace is limited to approved owner accounts."
        details="Only the approved owner emails can manage buyer records from this area."
      />
    );
  }

  const activeBuyerCount = buyers.filter((record) => {
    const status = String(record.buyer.status || "").toLowerCase();
    return status.includes("active") || status.includes("approved") || status.includes("matched");
  }).length;

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-12">
        <AdminPageHero
          eyebrow="Buyers"
          title="Every buyer record stays visible, editable, and fully under your control."
          description="This page now reads directly from the real buyer table so manually-entered buyers, portal-linked buyers, and approved buyers all live together in one clean workspace."
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm((prev) => !prev);
                  setCreateStatusText("");
                }}
                className="inline-flex items-center rounded-2xl bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(181,117,47,0.26)] transition hover:-translate-y-0.5 hover:brightness-105"
              >
                {showCreateForm ? "Close Manual Entry" : "Create Buyer"}
              </button>
              <AdminHeroSecondaryAction href="/admin/portal/payments">Open Payments</AdminHeroSecondaryAction>
            </>
          }
          aside={
            <div className="space-y-4">
              <AdminInfoTile
                label="Buyer Records"
                value={String(buyers.length)}
                detail="All buyer records in the database, not only portal-linked accounts."
              />
              <AdminInfoTile
                label="Active / Matched"
                value={String(activeBuyerCount)}
                detail="Buyer records currently marked active, approved, or matched."
              />
            </div>
          }
        />

        <AdminMetricGrid>
          <AdminMetricCard
            label="Buyer Records"
            value={String(buyers.length)}
            detail="Every buyer record currently saved in the admin system."
          />
          <AdminMetricCard
            label="With Portal Sign-In"
            value={String(buyers.filter((record) => record.hasPortalAccount).length)}
            detail="Buyer records that already have a linked portal account."
            accent="from-[#dce9d6] via-[#b6cfaa] to-[#7e9c6f]"
          />
          <AdminMetricCard
            label="With Applications"
            value={String(buyers.filter((record) => record.applicationCount > 0).length)}
            detail="Buyer records with a linked application history."
            accent="from-[#ece3d5] via-[#d7c1a3] to-[#b18d62]"
          />
          <AdminMetricCard
            label="Search Results"
            value={String(filteredBuyers.length)}
            detail="Buyer cards matching your current search."
            accent="from-[#f0dcc1] via-[#ddb68c] to-[#c98743]"
          />
        </AdminMetricGrid>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
          <AdminPanel
            title="Buyer Cards"
            subtitle="Search by buyer name, email, phone, status, or location. Each card represents a real buyer record."
          >
            {showCreateForm ? (
              <div className="mb-5 rounded-[24px] border border-[#ead9c7] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2e9_100%)] p-4 shadow-[0_12px_30px_rgba(106,76,45,0.06)]">
                <div className="text-sm font-semibold text-[#2f2218]">Manual Buyer Entry</div>
                <div className="mt-1 text-xs leading-5 text-[#8a6a49]">
                  Add a buyer directly from the admin side, even if they have never signed into the portal.
                </div>

                {createStatusText ? (
                  <div className="mt-4 rounded-[18px] border border-[#ead9c7] bg-[#fff9f2] px-4 py-3 text-sm font-semibold text-[#7a5a3a]">
                    {createStatusText}
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3">
                  <AdminField label="Full Name" value={createForm.full_name} onChange={(value) => setCreateForm((prev) => ({ ...prev, full_name: value }))} />
                  <AdminField label="Email" value={createForm.email} onChange={(value) => setCreateForm((prev) => ({ ...prev, email: value }))} />
                  <AdminField label="Phone" value={createForm.phone} onChange={(value) => setCreateForm((prev) => ({ ...prev, phone: value }))} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <AdminField label="City" value={createForm.city} onChange={(value) => setCreateForm((prev) => ({ ...prev, city: value }))} />
                    <AdminField label="State" value={createForm.state} onChange={(value) => setCreateForm((prev) => ({ ...prev, state: value }))} />
                  </div>
                  <AdminField label="Status" value={createForm.status} onChange={(value) => setCreateForm((prev) => ({ ...prev, status: value }))} />
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a47946]">
                    Notes
                    <textarea
                      value={createForm.notes}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, notes: e.target.value }))}
                      rows={4}
                      className="mt-2 w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]"
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void createBuyer()}
                    disabled={creating}
                    className="rounded-2xl bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(181,117,47,0.26)] transition hover:brightness-105 disabled:opacity-60"
                  >
                    {creating ? "Creating..." : "Save Buyer"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateForm(emptyBuyerForm());
                      setCreateStatusText("");
                    }}
                    className="rounded-2xl border border-[#e4d2be] bg-white px-5 py-3 text-sm font-semibold text-[#5d4330] shadow-[0_12px_28px_rgba(106,76,45,0.08)] transition hover:border-[#d4b48b]"
                  >
                    Reset
                  </button>
                </div>
              </div>
            ) : null}

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search buyers..."
              className="w-full rounded-[20px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]"
            />

            <div className="mt-4 space-y-3">
              {filteredBuyers.length ? (
                filteredBuyers.map((record) => (
                  <AdminListCard
                    key={record.key}
                    selected={selectedKey === record.key}
                    onClick={() => setSelectedKey(record.key)}
                    title={record.displayName}
                    subtitle={record.email || "No email on file"}
                    meta={`${record.phone || "No phone"} • ${record.buyer.city || "No city"}${record.buyer.state ? `, ${record.buyer.state}` : ""}`}
                    badge={
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(
                          record.buyer.status
                        )}`}
                      >
                        {record.buyer.status || "pending"}
                      </span>
                    }
                  />
                ))
              ) : (
                <AdminEmptyState
                  title="No buyer records matched your search"
                  description="Try a different name, email, phone number, status term, or location."
                />
              )}
            </div>
          </AdminPanel>

          {selectedBuyer ? (
            <div className="space-y-6">
              <AdminPanel
                title="Buyer Profile"
                subtitle="Review and update the buyer record directly from the database."
              >
                {statusText ? (
                  <div className="mb-4 rounded-[18px] border border-[#ead9c7] bg-[#fff9f2] px-4 py-3 text-sm font-semibold text-[#7a5a3a]">
                    {statusText}
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <AdminField label="Full Name" value={form.full_name} onChange={(value) => setForm((prev) => ({ ...prev, full_name: value }))} />
                  <AdminField label="Email" value={form.email} onChange={(value) => setForm((prev) => ({ ...prev, email: value }))} />
                  <AdminField label="Phone" value={form.phone} onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))} />
                  <AdminField label="Status" value={form.status} onChange={(value) => setForm((prev) => ({ ...prev, status: value }))} />
                  <AdminField label="City" value={form.city} onChange={(value) => setForm((prev) => ({ ...prev, city: value }))} />
                  <AdminField label="State" value={form.state} onChange={(value) => setForm((prev) => ({ ...prev, state: value }))} />
                </div>

                <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a47946]">
                  Notes
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={6}
                    className="mt-2 w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]"
                  />
                </label>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void saveBuyer()}
                    disabled={saving}
                    className="rounded-2xl bg-[linear-gradient(135deg,#d3a056_0%,#b5752f_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(181,117,47,0.26)] transition hover:brightness-105 disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save Buyer"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedBuyer) return;
                      setForm({
                        full_name: String(selectedBuyer.buyer.full_name || selectedBuyer.buyer.name || selectedBuyer.displayName || ""),
                        email: String(selectedBuyer.buyer.email || selectedBuyer.email || ""),
                        phone: String(selectedBuyer.buyer.phone || selectedBuyer.phone || ""),
                        status: String(selectedBuyer.buyer.status || "pending"),
                        notes: String(selectedBuyer.buyer.notes || ""),
                        city: String(selectedBuyer.buyer.city || ""),
                        state: String(selectedBuyer.buyer.state || ""),
                      });
                    }}
                    className="rounded-2xl border border-[#e4d2be] bg-white px-5 py-3 text-sm font-semibold text-[#5d4330] shadow-[0_12px_28px_rgba(106,76,45,0.08)] transition hover:border-[#d4b48b]"
                  >
                    Reset
                  </button>
                </div>
              </AdminPanel>

              <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <AdminPanel
                  title="Buyer Snapshot"
                  subtitle="Portal linkage and related record counts for this buyer."
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <AdminInfoTile
                      label="Buyer ID"
                      value={String(selectedBuyer.buyer.id)}
                      detail={`Created ${fmtDate(selectedBuyer.buyer.created_at || "")}`}
                    />
                    <AdminInfoTile
                      label="Portal Sign-In"
                      value={selectedBuyer.hasPortalAccount ? "Linked" : "Not linked"}
                      detail={
                        selectedBuyer.portalUser?.email ||
                        "This buyer can still exist here even without a portal account."
                      }
                    />
                    <AdminInfoTile
                      label="Applications"
                      value={String(selectedBuyer.applicationCount)}
                      detail={selectedBuyer.latestApplicationStatus || "No linked applications yet."}
                    />
                    <AdminInfoTile
                      label="Submitted Forms"
                      value={String(selectedBuyer.formCount)}
                      detail="Grouped form history stays in the Documents tab."
                    />
                  </div>
                </AdminPanel>

                <AdminPanel
                  title="Open Related Tabs"
                  subtitle="Jump straight into the buyer's next workflow."
                >
                  <div className="grid grid-cols-1 gap-4">
                    <AdminInfoTile label="Payments" value="Open Payments" detail="Log manual payments, balances, and financing details." />
                    <AdminInfoTile label="Documents" value="Open Documents" detail="Grouped forms, uploads, and signed records." />
                    <AdminInfoTile label="Messages" value="Open Messages" detail="Buyer communication and follow-up history." />
                  </div>
                </AdminPanel>
              </section>
            </div>
          ) : (
            <AdminPanel title="Buyer Profile" subtitle="Choose a buyer card to begin.">
              <AdminEmptyState
                title="No buyer selected"
                description="Choose a buyer card from the left to review and update the buyer record."
              />
            </AdminPanel>
          )}
        </section>
      </div>
    </AdminPageShell>
  );
}

function AdminField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a47946]">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-[18px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3.5 text-sm normal-case tracking-normal text-[#3e2a1f] outline-none focus:border-[#c8a884]"
      />
    </label>
  );
}
