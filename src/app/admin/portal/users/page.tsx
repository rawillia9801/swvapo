"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

type LinkedPuppy = {
  id: number;
  buyer_id?: number | null;
  call_name?: string | null;
  puppy_name?: string | null;
  name?: string | null;
  status?: string | null;
  price?: number | null;
  deposit?: number | null;
  balance?: number | null;
  created_at?: string | null;
};

type PuppyOption = LinkedPuppy & {
  buyerName?: string | null;
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
  linkedPuppies: LinkedPuppy[];
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

type StatusView = "all" | "active" | "completed";

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

function puppyLabel(puppy: LinkedPuppy | PuppyOption) {
  return puppy.call_name || puppy.puppy_name || puppy.name || `Puppy #${puppy.id}`;
}

function isCompletedStatus(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized.includes("completed") || normalized === "complete";
}

function isActiveStatus(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();
  return ["active", "approved", "matched", "pending", "submitted", "waitlist"].some((value) =>
    normalized.includes(value)
  );
}

async function fetchAdminBuyers(accessToken: string) {
  if (!accessToken) return { buyers: [] as BuyerCard[], puppies: [] as PuppyOption[] };

  const response = await fetch("/api/admin/portal/buyers", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return { buyers: [] as BuyerCard[], puppies: [] as PuppyOption[] };
  }

  const payload = (await response.json()) as { buyers?: BuyerCard[]; puppies?: PuppyOption[] };
  return {
    buyers: Array.isArray(payload.buyers) ? payload.buyers : [],
    puppies: Array.isArray(payload.puppies) ? payload.puppies : [],
  };
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
  const [puppySearch, setPuppySearch] = useState("");
  const [statusView, setStatusView] = useState<StatusView>("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [buyers, setBuyers] = useState<BuyerCard[]>([]);
  const [allPuppies, setAllPuppies] = useState<PuppyOption[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [selectedPuppyIds, setSelectedPuppyIds] = useState<number[]>([]);
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
          const payload = await fetchAdminBuyers(token);
          if (!mounted) return;
          setBuyers(payload.buyers);
          setAllPuppies(payload.puppies);
          setSelectedKey(payload.buyers[0]?.key || "");
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
        const payload = await fetchAdminBuyers(token);
        if (!mounted) return;
        setBuyers(payload.buyers);
        setAllPuppies(payload.puppies);
        setSelectedKey(
          (prev) => payload.buyers.find((buyer) => buyer.key === prev)?.key || payload.buyers[0]?.key || ""
        );
      } else {
        setBuyers([]);
        setAllPuppies([]);
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

    return buyers.filter((record) => {
      if (statusView === "completed" && !isCompletedStatus(record.buyer.status)) return false;
      if (statusView === "active" && !isActiveStatus(record.buyer.status)) return false;

      if (!q) return true;

      return [
        record.displayName,
        record.email,
        record.phone,
        record.buyer.status,
        record.buyer.city,
        record.buyer.state,
        record.buyer.notes,
        ...record.linkedPuppies.map((puppy) => puppyLabel(puppy)),
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(q);
    });
  }, [buyers, search, statusView]);

  const selectedBuyer =
    filteredBuyers.find((record) => record.key === selectedKey) ||
    buyers.find((record) => record.key === selectedKey) ||
    null;

  useEffect(() => {
    if (!filteredBuyers.length) {
      setSelectedKey("");
      return;
    }
    if (!filteredBuyers.some((record) => record.key === selectedKey)) {
      setSelectedKey(filteredBuyers[0].key);
    }
  }, [filteredBuyers, selectedKey]);

  const filteredPuppies = useMemo(() => {
    const q = puppySearch.trim().toLowerCase();
    if (!q) return allPuppies;
    return allPuppies.filter((puppy) =>
      [
        puppyLabel(puppy),
        puppy.status,
        puppy.buyerName,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(q)
    );
  }, [allPuppies, puppySearch]);

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
    setSelectedPuppyIds(selectedBuyer.linkedPuppies.map((puppy) => puppy.id));
    setStatusText("");
  }, [selectedBuyer]);

  async function refreshBuyers(nextSelectedKey?: string) {
    const payload = await fetchAdminBuyers(accessToken);
    setBuyers(payload.buyers);
    setAllPuppies(payload.puppies);
    setSelectedKey(nextSelectedKey || payload.buyers[0]?.key || "");
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
          linked_puppy_ids: selectedPuppyIds,
          ...form,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not update the buyer record.");
      }

      await refreshBuyers(selectedBuyer.key);
      setStatusText("Buyer record and linked puppies updated.");
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

  function togglePuppySelection(puppyId: number) {
    setSelectedPuppyIds((prev) =>
      prev.includes(puppyId) ? prev.filter((value) => value !== puppyId) : [...prev, puppyId]
    );
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

  const activeBuyerCount = buyers.filter((record) => isActiveStatus(record.buyer.status)).length;
  const completedBuyerCount = buyers.filter((record) => isCompletedStatus(record.buyer.status)).length;

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-12">
        <AdminPageHero
          eyebrow="Buyers"
          title="Every buyer record now keeps contact details, portal linkage, and multiple puppy assignments together."
          description="This workspace supports manual buyers, portal-linked buyers, completed buyers, and buyers who have purchased more than one puppy."
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
                label="Completed"
                value={String(completedBuyerCount)}
                detail="Buyer records marked complete or completed."
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
            label="Active / Open"
            value={String(activeBuyerCount)}
            detail="Active, approved, matched, waitlist, and in-progress buyer records."
            accent="from-[#ece3d5] via-[#d7c1a3] to-[#b18d62]"
          />
          <AdminMetricCard
            label="Completed"
            value={String(completedBuyerCount)}
            detail="Completed buyer records available through the Completed filter."
            accent="from-[#f0dcc1] via-[#ddb68c] to-[#c98743]"
          />
        </AdminMetricGrid>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <AdminPanel
            title="Buyer Cards"
            subtitle="Search by buyer name, email, phone, status, location, or linked puppy. Completed buyers have their own filter."
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

            <div className="mb-4 grid grid-cols-3 gap-2">
              <StatusFilterButton active={statusView === "all"} label={`All (${buyers.length})`} onClick={() => setStatusView("all")} />
              <StatusFilterButton active={statusView === "active"} label={`Active (${activeBuyerCount})`} onClick={() => setStatusView("active")} />
              <StatusFilterButton active={statusView === "completed"} label={`Completed (${completedBuyerCount})`} onClick={() => setStatusView("completed")} />
            </div>

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
                    meta={`${record.phone || "No phone"} - ${record.linkedPuppies.length} linked pupp${record.linkedPuppies.length === 1 ? "y" : "ies"}`}
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
                  description="Try a different name, email, phone number, status term, location, or puppy name."
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
                      setSelectedPuppyIds(selectedBuyer.linkedPuppies.map((puppy) => puppy.id));
                    }}
                    className="rounded-2xl border border-[#e4d2be] bg-white px-5 py-3 text-sm font-semibold text-[#5d4330] shadow-[0_12px_28px_rgba(106,76,45,0.08)] transition hover:border-[#d4b48b]"
                  >
                    Reset
                  </button>
                </div>
              </AdminPanel>

              <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <AdminPanel
                  title="Linked Puppies"
                  subtitle="Select one or more puppies for this buyer. Choosing a puppy already linked elsewhere will move it into this buyer record when you save."
                >
                  <input
                    value={puppySearch}
                    onChange={(e) => setPuppySearch(e.target.value)}
                    placeholder="Search puppies..."
                    className="w-full rounded-[20px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]"
                  />

                  <div className="mt-4 space-y-3 max-h-[560px] overflow-y-auto pr-1">
                    {filteredPuppies.length ? (
                      filteredPuppies.map((puppy) => {
                        const checked = selectedPuppyIds.includes(puppy.id);
                        const linkedElsewhere =
                          puppy.buyer_id && puppy.buyer_id !== selectedBuyer.buyer.id;

                        return (
                          <label
                            key={puppy.id}
                            className={`flex cursor-pointer items-start gap-3 rounded-[22px] border px-4 py-4 transition ${
                              checked
                                ? "border-[#d8b48b] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2e9_100%)]"
                                : "border-[#ead9c7] bg-[#fffaf5] hover:border-[#d8b48b] hover:bg-white"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePuppySelection(puppy.id)}
                              className="mt-1 h-4 w-4 rounded border-[#d8b48b] text-[#b5752f] focus:ring-[#d8b48b]"
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-[#2f2218]">
                                {puppyLabel(puppy)}
                              </div>
                              <div className="mt-1 text-xs leading-5 text-[#8a6a49]">
                                {puppy.status || "pending"} - {puppy.price !== null && puppy.price !== undefined ? `$${Number(puppy.price).toLocaleString()}` : "No price"}
                              </div>
                              <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a47946]">
                                {linkedElsewhere
                                  ? `Currently linked to ${puppy.buyerName || `Buyer #${puppy.buyer_id}`}`
                                  : puppy.buyer_id === selectedBuyer.buyer.id
                                    ? "Already linked to this buyer"
                                    : "Available to link"}
                              </div>
                            </div>
                          </label>
                        );
                      })
                    ) : (
                      <AdminEmptyState
                        title="No puppies matched your search"
                        description="Try a different puppy name or status."
                      />
                    )}
                  </div>
                </AdminPanel>

                <div className="space-y-6">
                  <AdminPanel
                    title="Buyer Snapshot"
                    subtitle="Portal linkage, related record counts, and linked puppy totals for this buyer."
                  >
                    <div className="grid grid-cols-1 gap-4">
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
                        label="Linked Puppies"
                        value={String(selectedPuppyIds.length)}
                        detail="You can save multiple puppy assignments for this buyer."
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
                    subtitle="Jump straight into the next workflow for this buyer."
                  >
                    <div className="grid grid-cols-1 gap-3">
                      <Link
                        href="/admin/portal/payments"
                        className="rounded-[20px] border border-[#ead9c7] bg-[#fffaf5] px-4 py-4 transition hover:border-[#d8b48b] hover:bg-white"
                      >
                        <div className="text-sm font-semibold text-[#2f2218]">Open Payments</div>
                        <div className="mt-1 text-xs leading-5 text-[#8a6a49]">
                          Buyer-level balances, financing, and history.
                        </div>
                      </Link>
                      <Link
                        href="/admin/portal/puppy-payments"
                        className="rounded-[20px] border border-[#ead9c7] bg-[#fffaf5] px-4 py-4 transition hover:border-[#d8b48b] hover:bg-white"
                      >
                        <div className="text-sm font-semibold text-[#2f2218]">Open Puppy Payments</div>
                        <div className="mt-1 text-xs leading-5 text-[#8a6a49]">
                          Puppy-by-puppy financial control and entries.
                        </div>
                      </Link>
                      <Link
                        href="/admin/portal/documents"
                        className="rounded-[20px] border border-[#ead9c7] bg-[#fffaf5] px-4 py-4 transition hover:border-[#d8b48b] hover:bg-white"
                      >
                        <div className="text-sm font-semibold text-[#2f2218]">Open Documents</div>
                        <div className="mt-1 text-xs leading-5 text-[#8a6a49]">
                          Grouped forms, uploads, and signed records.
                        </div>
                      </Link>
                      <Link
                        href="/admin/portal/messages"
                        className="rounded-[20px] border border-[#ead9c7] bg-[#fffaf5] px-4 py-4 transition hover:border-[#d8b48b] hover:bg-white"
                      >
                        <div className="text-sm font-semibold text-[#2f2218]">Open Messages</div>
                        <div className="mt-1 text-xs leading-5 text-[#8a6a49]">
                          Buyer communication and follow-up history.
                        </div>
                      </Link>
                    </div>
                  </AdminPanel>
                </div>
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

function StatusFilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-[18px] border px-3 py-3 text-sm font-semibold transition",
        active
          ? "border-[#d8b48b] bg-[linear-gradient(180deg,#fffdfb_0%,#f9f2e9_100%)] text-[#2f2218] shadow-[0_12px_30px_rgba(106,76,45,0.08)]"
          : "border-[#ead9c7] bg-[#fffaf5] text-[#73583f] hover:border-[#d8b48b] hover:bg-white",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
