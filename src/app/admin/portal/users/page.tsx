"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  AdminEmptyState,
  AdminHeroPrimaryAction,
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
import { fetchAdminAccounts, type AdminPortalAccount, adminFirstValue } from "@/lib/admin-portal";
import { fmtDate, sb } from "@/lib/utils";
import { isPortalAdminEmail } from "@/lib/portal-admin";

type BuyerEditForm = {
  full_name: string;
  email: string;
  phone: string;
  status: string;
  notes: string;
};

export default function AdminPortalBuyersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [search, setSearch] = useState("");
  const [accounts, setAccounts] = useState<AdminPortalAccount[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [form, setForm] = useState<BuyerEditForm>({
    full_name: "",
    email: "",
    phone: "",
    status: "pending",
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
        setUser(currentUser);
        setAccessToken(session?.access_token || "");

        if (currentUser && isPortalAdminEmail(currentUser.email)) {
          const nextAccounts = await fetchAdminAccounts(session?.access_token || "");
          const buyerAccounts = nextAccounts.filter((account) => !!account.buyer);
          setAccounts(buyerAccounts);
          setSelectedKey(buyerAccounts[0]?.key || "");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void bootstrap();

    const { data: authListener } = sb.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setAccessToken(session?.access_token || "");

      if (currentUser && isPortalAdminEmail(currentUser.email)) {
        const nextAccounts = await fetchAdminAccounts(session?.access_token || "");
        const buyerAccounts = nextAccounts.filter((account) => !!account.buyer);
        setAccounts(buyerAccounts);
        setSelectedKey((prev) =>
          buyerAccounts.find((account) => account.key === prev)?.key || buyerAccounts[0]?.key || ""
        );
      } else {
        setAccounts([]);
        setSelectedKey("");
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;

    return accounts.filter((account) =>
      [
        account.displayName,
        account.email,
        account.phone,
        account.buyer?.status,
        account.buyer?.notes,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(q)
    );
  }, [accounts, search]);

  const selectedAccount = useMemo(
    () =>
      filteredAccounts.find((account) => account.key === selectedKey) ||
      accounts.find((account) => account.key === selectedKey) ||
      null,
    [accounts, filteredAccounts, selectedKey]
  );

  useEffect(() => {
    if (!selectedAccount?.buyer) return;
    setForm({
      full_name: adminFirstValue(selectedAccount.buyer.full_name, selectedAccount.buyer.name, selectedAccount.displayName),
      email: adminFirstValue(selectedAccount.buyer.email, selectedAccount.buyer.buyer_email, selectedAccount.email),
      phone: adminFirstValue(selectedAccount.buyer.phone, selectedAccount.phone),
      status: String(selectedAccount.buyer.status || "pending"),
      notes: String(selectedAccount.buyer.notes || ""),
    });
    setStatusText("");
  }, [selectedAccount]);

  async function refreshAccounts(nextSelectedKey?: string) {
    const nextAccounts = (await fetchAdminAccounts(accessToken)).filter((account) => !!account.buyer);
    setAccounts(nextAccounts);
    setSelectedKey(nextSelectedKey || nextAccounts[0]?.key || "");
  }

  async function saveBuyer() {
    if (!selectedAccount?.buyer?.id) return;
    setSaving(true);
    setStatusText("");

    try {
      const { error } = await sb
        .from("buyers")
        .update({
          full_name: form.full_name.trim() || null,
          name: form.full_name.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          status: form.status.trim() || null,
          notes: form.notes.trim() || null,
        })
        .eq("id", selectedAccount.buyer.id);

      if (error) throw error;

      await refreshAccounts(selectedAccount.key);
      setStatusText("Buyer record updated.");
    } catch (error) {
      console.error(error);
      setStatusText("Could not update the buyer record.");
    } finally {
      setSaving(false);
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

  const activeBuyerCount = accounts.filter((account) => {
    const status = String(account.buyer?.status || "").toLowerCase();
    return status.includes("active") || status.includes("approved") || status.includes("matched");
  }).length;

  return (
    <AdminPageShell>
      <div className="space-y-6 pb-12">
        <AdminPageHero
          eyebrow="Buyers"
          title="Buyer records stay buyer-focused here."
          description="Use this workspace for contact details, buyer notes, portal linkage, and the clean account profile that supports the rest of the admin system."
          actions={
            <>
              <AdminHeroPrimaryAction href="/admin/portal/payments">Open Payments</AdminHeroPrimaryAction>
              <AdminHeroSecondaryAction href="/admin/portal/messages">Open Messages</AdminHeroSecondaryAction>
            </>
          }
          aside={
            <div className="space-y-4">
              <AdminInfoTile
                label="Buyer Records"
                value={String(accounts.length)}
                detail="Buyer cards shown on this page are limited to actual buyer records."
              />
              <AdminInfoTile
                label="Active / Matched"
                value={String(activeBuyerCount)}
                detail="Buyers currently marked active, approved, or matched."
              />
            </div>
          }
        />

        <AdminMetricGrid>
          <AdminMetricCard
            label="Buyer Records"
            value={String(accounts.length)}
            detail="All buyer profiles currently linked to the portal system."
          />
          <AdminMetricCard
            label="With Portal Sign-In"
            value={String(accounts.filter((account) => !!account.userId).length)}
            detail="Buyer records that already have a linked portal account."
            accent="from-[#dce9d6] via-[#b6cfaa] to-[#7e9c6f]"
          />
          <AdminMetricCard
            label="With Applications"
            value={String(accounts.filter((account) => !!account.application).length)}
            detail="Buyer records with a linked application history."
            accent="from-[#ece3d5] via-[#d7c1a3] to-[#b18d62]"
          />
          <AdminMetricCard
            label="Search Results"
            value={String(filteredAccounts.length)}
            detail="Filtered buyer cards based on your current search."
            accent="from-[#f0dcc1] via-[#ddb68c] to-[#c98743]"
          />
        </AdminMetricGrid>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
          <AdminPanel
            title="Buyer Cards"
            subtitle="Search by name, email, phone, or buyer status. Each card represents a single buyer record."
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search buyers..."
              className="w-full rounded-[20px] border border-[#e4d3c2] bg-[#fffdfb] px-4 py-3 text-sm text-[#3e2a1f] outline-none focus:border-[#c8a884]"
            />

            <div className="mt-4 space-y-3">
              {filteredAccounts.length ? (
                filteredAccounts.map((account) => (
                  <AdminListCard
                    key={account.key}
                    selected={selectedKey === account.key}
                    onClick={() => setSelectedKey(account.key)}
                    title={account.displayName || "Buyer"}
                    subtitle={account.email || "No email on file"}
                    meta={`${account.phone || "No phone"} • ${account.buyer?.status || "pending"}`}
                    badge={
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(
                          account.buyer?.status
                        )}`}
                      >
                        {account.buyer?.status || "pending"}
                      </span>
                    }
                  />
                ))
              ) : (
                <AdminEmptyState
                  title="No buyers matched your search"
                  description="Try a different name, email, phone number, or status term."
                />
              )}
            </div>
          </AdminPanel>

          {selectedAccount?.buyer ? (
            <div className="space-y-6">
              <AdminPanel
                title="Buyer Profile"
                subtitle="Edit the core buyer record here without the extra message, form, or payment clutter."
              >
                {statusText ? (
                  <div className="mb-4 rounded-[18px] border border-[#ead9c7] bg-[#fff9f2] px-4 py-3 text-sm font-semibold text-[#7a5a3a]">
                    {statusText}
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <AdminField
                    label="Full Name"
                    value={form.full_name}
                    onChange={(value) => setForm((prev) => ({ ...prev, full_name: value }))}
                  />
                  <AdminField
                    label="Email"
                    value={form.email}
                    onChange={(value) => setForm((prev) => ({ ...prev, email: value }))}
                  />
                  <AdminField
                    label="Phone"
                    value={form.phone}
                    onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))}
                  />
                  <AdminField
                    label="Status"
                    value={form.status}
                    onChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
                  />
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
                      if (!selectedAccount?.buyer) return;
                      setForm({
                        full_name: adminFirstValue(selectedAccount.buyer.full_name, selectedAccount.buyer.name, selectedAccount.displayName),
                        email: adminFirstValue(selectedAccount.buyer.email, selectedAccount.buyer.buyer_email, selectedAccount.email),
                        phone: adminFirstValue(selectedAccount.buyer.phone, selectedAccount.phone),
                        status: String(selectedAccount.buyer.status || "pending"),
                        notes: String(selectedAccount.buyer.notes || ""),
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
                  subtitle="Core linkage details for this buyer record."
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <AdminInfoTile
                      label="Buyer ID"
                      value={String(selectedAccount.buyer.id)}
                      detail={`Created ${fmtDate(selectedAccount.buyer.created_at || "")}`}
                    />
                    <AdminInfoTile
                      label="Portal Sign-In"
                      value={selectedAccount.userId ? "Linked" : "Not linked"}
                      detail={selectedAccount.userId || "No auth user linked yet."}
                    />
                    <AdminInfoTile
                      label="Application"
                      value={selectedAccount.application ? "Linked" : "None"}
                      detail={
                        selectedAccount.application
                          ? `Status: ${selectedAccount.application.status || "submitted"}`
                          : "No linked application."
                      }
                    />
                    <AdminInfoTile
                      label="Submitted Forms"
                      value={String(selectedAccount.forms.length)}
                      detail="Document and form history now lives under Documents."
                    />
                  </div>
                </AdminPanel>

                <AdminPanel
                  title="Open Related Tabs"
                  subtitle="Jump straight to the buyer’s related workflows without mixing those records into this tab."
                >
                  <div className="grid grid-cols-1 gap-4">
                    <AdminInfoTile label="Payments" value="Open Payments" detail="Balances, history, and financing details stay in the payment tab." />
                    <AdminInfoTile label="Documents" value="Open Documents" detail="Forms and uploaded files stay grouped by buyer in the documents tab." />
                    <AdminInfoTile label="Messages" value="Open Messages" detail="Conversation history stays grouped by buyer in the messages tab." />
                  </div>
                </AdminPanel>
              </section>
            </div>
          ) : (
            <AdminPanel
              title="Buyer Profile"
              subtitle="Choose a buyer card to begin."
            >
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
