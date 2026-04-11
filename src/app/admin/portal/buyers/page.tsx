"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AdminEmptyState,
  AdminInfoTile,
  AdminListCard,
  AdminPageShell,
  AdminPanel,
  AdminRestrictedState,
  adminStatusBadge,
} from "@/components/admin/luxury-admin-shell";
import {
  AdminTextInput,
  AdminTextAreaInput,
  AdminSelectInput,
} from "@/components/admin/admin-form-fields";
import { fmtDate, fmtMoney } from "@/lib/utils";
import { usePortalAdminSession } from "@/lib/use-portal-admin-session";

/* ---------------- UI Helpers ---------------- */

const primary =
  "rounded-xl bg-gradient-to-br from-[#c88c52] to-[#8a5a2b] text-white px-4 py-2 text-sm font-semibold shadow hover:opacity-95";

const secondary =
  "rounded-xl border px-4 py-2 text-sm font-semibold bg-white hover:bg-gray-50";

/* ---------------- Tabs ---------------- */

const tabs = ["profile", "puppies", "delivery", "documents", "activity"] as const;
type Tab = (typeof tabs)[number];

/* ---------------- Page ---------------- */

export default function AdminPortalBuyersPage() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();

  const [buyers, setBuyers] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [tab, setTab] = useState<Tab>("profile");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  /* ---------------- Fetch ---------------- */

  useEffect(() => {
    async function load() {
      if (!accessToken) return;

      const res = await fetch("/api/admin/portal/buyers", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const data = await res.json();
      setBuyers(data.buyers || []);
      setSelected(data.buyers?.[0] || null);
    }

    load();
  }, [accessToken]);

  /* ---------------- Derived ---------------- */

  const filtered = useMemo(() => {
    return buyers.filter((b) =>
      (b.displayName || "")
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [buyers, search]);

  /* ---------------- Save ---------------- */

  async function save() {
    if (!selected) return;
    setSaving(true);

    await fetch("/api/admin/portal/buyers", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(form),
    });

    setSaving(false);
  }

  /* ---------------- Guards ---------------- */

  if (loading) return <div className="p-10">Loading...</div>;

  if (!user) {
    return (
      <AdminRestrictedState
        title="Login required"
        details="Please sign in."
      />
    );
  }

  if (!isAdmin) {
    return (
      <AdminRestrictedState
        title="Not authorized"
        details="Admin access only."
      />
    );
  }

  /* ---------------- UI ---------------- */

  return (
    <AdminPageShell>
      <div className="grid xl:grid-cols-[320px_1fr] gap-6">

        {/* LEFT SIDEBAR */}
        <div className="space-y-4">

          <AdminPanel title="Buyers">
            <input
              placeholder="Search buyers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full mb-3 border rounded-lg px-3 py-2"
            />

            <div className="space-y-2">
              {filtered.map((b) => (
                <AdminListCard
                  key={b.key}
                  selected={selected?.key === b.key}
                  onClick={() => {
                    setSelected(b);
                    setForm(b.buyer);
                  }}
                  title={b.displayName}
                  subtitle={b.email}
                  badge={
                    <span className={adminStatusBadge(b.buyer.status)}>
                      {b.buyer.status}
                    </span>
                  }
                />
              ))}
            </div>
          </AdminPanel>
        </div>

        {/* RIGHT CONTENT */}
        <div className="space-y-4">

          {/* HEADER */}
          {selected && (
            <div className="sticky top-0 z-10 bg-white border rounded-xl p-4 flex justify-between items-center shadow-sm">
              <div>
                <div className="text-lg font-semibold">
                  {selected.displayName}
                </div>
                <div className="text-sm text-gray-500">
                  Balance: {fmtMoney(selected.balance || 0)}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={save} className={primary}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}

          {/* TABS */}
          <div className="flex gap-2 border-b pb-2">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-full text-sm ${
                  tab === t
                    ? "bg-black text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* TAB CONTENT */}

          {tab === "profile" && (
            <AdminPanel title="Profile">
              <div className="grid md:grid-cols-2 gap-4">
                <AdminTextInput
                  label="Full Name"
                  value={form.full_name || ""}
                  onChange={(v) => setForm({ ...form, full_name: v })}
                />
                <AdminTextInput
                  label="Email"
                  value={form.email || ""}
                  onChange={(v) => setForm({ ...form, email: v })}
                />
                <AdminTextInput
                  label="Phone"
                  value={form.phone || ""}
                  onChange={(v) => setForm({ ...form, phone: v })}
                />
                <AdminSelectInput
                  label="Status"
                  value={form.status || ""}
                  onChange={(v) => setForm({ ...form, status: v })}
                  options={[
                    { value: "pending", label: "Pending" },
                    { value: "approved", label: "Approved" },
                    { value: "completed", label: "Completed" },
                  ]}
                />
              </div>

              <div className="mt-4">
                <AdminTextAreaInput
                  label="Notes"
                  value={form.notes || ""}
                  onChange={(v) => setForm({ ...form, notes: v })}
                />
              </div>
            </AdminPanel>
          )}

          {tab === "puppies" && (
            <AdminPanel title="Puppies">
              <AdminEmptyState
                title="Cleaner puppy management"
                description="Move puppy assignment UI here (modular + scalable)."
              />
            </AdminPanel>
          )}

          {tab === "delivery" && (
            <AdminPanel title="Delivery">
              <AdminEmptyState
                title="Delivery system"
                description="Keep transport + delivery cleanly separated."
              />
            </AdminPanel>
          )}

          {tab === "documents" && (
            <AdminPanel title="Documents">
              <AdminEmptyState
                title="Documents"
                description="Document tracking lives here."
              />
            </AdminPanel>
          )}

          {tab === "activity" && (
            <AdminPanel title="Activity">
              <AdminEmptyState
                title="Ledger + activity"
                description="Payments + actions summarized here."
              />
            </AdminPanel>
          )}
        </div>
      </div>
    </AdminPageShell>
  );
}