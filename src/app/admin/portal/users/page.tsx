"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fmtDate, sb } from "@/lib/utils";
import { getPortalAdminEmails, isPortalAdminEmail } from "@/lib/portal-admin";

type BuyerRow = {
  id: number;
  user_id?: string | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  buyer_email?: string | null;
  phone?: string | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type ApplicationRow = {
  id: number;
  user_id?: string | null;
  created_at: string;
  full_name?: string | null;
  email?: string | null;
  applicant_email?: string | null;
  phone?: string | null;
  status?: string | null;
  admin_notes?: string | null;
  assigned_puppy_id?: number | null;
};

type FormRow = {
  id: number;
  user_id?: string | null;
  created_at: string;
  user_email?: string | null;
  form_key: string;
  form_title?: string | null;
  status: string;
  signed_name?: string | null;
  submitted_at?: string | null;
};

type AccountRow = {
  key: string;
  email: string;
  userId: string | null;
  displayName: string;
  phone: string;
  createdAt?: string | null;
  lastSignInAt?: string | null;
  buyer: BuyerRow | null;
  application: ApplicationRow | null;
  forms: FormRow[];
};

type BuyerEditForm = {
  full_name: string;
  email: string;
  phone: string;
  status: string;
  notes: string;
};

function firstValue(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function tone(statusRaw: string | null | undefined) {
  const status = String(statusRaw || "pending").trim().toLowerCase();
  if (["approved", "active", "matched", "submitted"].some((item) => status.includes(item))) {
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  }
  if (["denied", "declined", "rejected", "cancel"].some((item) => status.includes(item))) {
    return "border-rose-400/30 bg-rose-500/10 text-rose-200";
  }
  return "border-amber-400/30 bg-amber-500/10 text-amber-100";
}

export default function AdminPortalUsersPage() {
  const [user, setUser] = useState<{ id: string; email?: string | null } | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [search, setSearch] = useState("");
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
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
          const nextAccounts = await loadAccounts(session?.access_token || "");
          if (!mounted) return;
          setAccounts(nextAccounts);
          setSelectedKey(nextAccounts[0]?.key || "");
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
        const nextAccounts = await loadAccounts(session?.access_token || "");
        setAccounts(nextAccounts);
        setSelectedKey(nextAccounts[0]?.key || "");
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
      [account.displayName, account.email, account.phone, account.buyer?.status, account.application?.status]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(q)
    );
  }, [accounts, search]);

  const selectedAccount = useMemo(
    () => filteredAccounts.find((account) => account.key === selectedKey) || accounts.find((account) => account.key === selectedKey) || null,
    [accounts, filteredAccounts, selectedKey]
  );

  useEffect(() => {
    if (!selectedAccount) return;
    setForm({
      full_name: firstValue(selectedAccount.buyer?.full_name, selectedAccount.buyer?.name, selectedAccount.application?.full_name, selectedAccount.displayName),
      email: firstValue(selectedAccount.buyer?.email, selectedAccount.buyer?.buyer_email, selectedAccount.application?.email, selectedAccount.application?.applicant_email, selectedAccount.email),
      phone: firstValue(selectedAccount.buyer?.phone, selectedAccount.application?.phone, selectedAccount.phone),
      status: String(selectedAccount.buyer?.status || selectedAccount.application?.status || "pending"),
      notes: String(selectedAccount.buyer?.notes || selectedAccount.application?.admin_notes || ""),
    });
    setStatusText("");
  }, [selectedAccount]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#08111f] text-sm font-semibold text-slate-300">Loading users...</div>;
  }

  if (!user) {
    return <RestrictedState title="Sign in to access admin users." details="This page is reserved for the owner admin accounts." />;
  }

  if (!isPortalAdminEmail(user.email)) {
    return <RestrictedState title="This page is restricted to approved owner accounts." details={`Allowed emails: ${getPortalAdminEmails().join(" • ")}`} />;
  }

  async function refreshAccounts(nextSelectedKey?: string) {
    const nextAccounts = await loadAccounts(accessToken);
    setAccounts(nextAccounts);
    setSelectedKey(nextSelectedKey || nextAccounts[0]?.key || "");
  }

  async function saveBuyer() {
    if (!selectedAccount) return;
    setSaving(true);
    setStatusText("");

    try {
      if (selectedAccount.buyer?.id) {
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
      } else {
        const { error } = await sb.from("buyers").insert({
          user_id: selectedAccount.userId || null,
          full_name: form.full_name.trim() || null,
          name: form.full_name.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          status: form.status.trim() || "pending",
          notes: form.notes.trim() || null,
        });

        if (error) throw error;
      }

      if (selectedAccount.application?.id) {
        await sb
          .from("puppy_applications")
          .update({
            admin_notes: form.notes.trim() || null,
          })
          .eq("id", selectedAccount.application.id);
      }

      await refreshAccounts(selectedAccount.key);
      setStatusText("Buyer profile updated.");
    } catch (error) {
      console.error(error);
      setStatusText("Could not save the buyer profile.");
    } finally {
      setSaving(false);
    }
  }

  async function setApplicationStatus(status: "approved" | "denied") {
    if (!selectedAccount?.application?.id) return;
    setSaving(true);
    setStatusText("");

    try {
      const { error } = await sb
        .from("puppy_applications")
        .update({ status, admin_notes: form.notes.trim() || null })
        .eq("id", selectedAccount.application.id);

      if (error) throw error;

      await refreshAccounts(selectedAccount.key);
      setStatusText(`Application ${status}.`);
    } catch (error) {
      console.error(error);
      setStatusText("Could not update the application status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#07101c] text-white">
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_30%),linear-gradient(180deg,#07101c_0%,#0b1526_52%,#07101c_100%)] px-4 py-5 md:px-8 md:py-8 xl:px-10">
        <div className="mx-auto w-full max-w-[1760px]">
          <header className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.32)] md:p-8">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-sky-100">Admin Users</div>
                <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white md:text-5xl">Manage portal users and approvals</h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">Review linked buyer records, submitted forms, and latest applications. Update profile details and approve or deny where needed.</p>
              </div>
              <div className="flex gap-3">
                <Link href="/admin/portal" className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Admin Overview</Link>
                <Link href="/admin/portal/applications" className="rounded-full border border-sky-400/20 bg-sky-500/10 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-sky-100 transition hover:bg-sky-500/20">Applications</Link>
              </div>
            </div>
          </header>

          <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="rounded-[30px] border border-white/10 bg-white/5 p-5 shadow-[0_20px_90px_rgba(0,0,0,0.22)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Users</div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Portal accounts</h2>
                </div>
                <div className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">{filteredAccounts.length}</div>
              </div>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, phone, or status"
                className="mt-4 w-full rounded-[20px] border border-white/10 bg-[#0d1729]/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/30"
              />

              <div className="mt-4 space-y-3">
                {filteredAccounts.length ? (
                  filteredAccounts.map((account) => (
                    <button
                      key={account.key}
                      type="button"
                      onClick={() => setSelectedKey(account.key)}
                      className={`w-full rounded-[22px] border px-4 py-4 text-left transition ${selectedKey === account.key ? "border-sky-400/30 bg-sky-500/10" : "border-white/10 bg-[#0d1729]/70 hover:border-white/20 hover:bg-[#101d34]"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white">{account.displayName}</div>
                          <div className="mt-1 truncate text-xs text-slate-400">{account.email || "No linked email"}</div>
                        </div>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${tone(account.application?.status || account.buyer?.status)}`}>{account.application?.status || account.buyer?.status || "pending"}</span>
                      </div>
                      <div className="mt-3 text-xs leading-5 text-slate-400">
                        {account.forms.length} form(s) • {account.phone || "No phone"}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-[22px] border border-dashed border-white/12 bg-black/10 px-4 py-8 text-center text-sm font-semibold text-slate-400">No users matched your search.</div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {selectedAccount ? (
                <>
                  <section className="rounded-[30px] border border-white/10 bg-white/5 p-6 shadow-[0_20px_90px_rgba(0,0,0,0.22)] md:p-7">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-200">Selected User</div>
                        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">{selectedAccount.displayName}</h2>
                        <div className="mt-2 text-sm leading-7 text-slate-300">{selectedAccount.email || "No linked email"}</div>
                        <div className="text-sm leading-7 text-slate-400">{selectedAccount.phone || "No phone on file"}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedAccount.application?.id ? (
                          <button onClick={() => void setApplicationStatus("approved")} disabled={saving} className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50">Approve</button>
                        ) : null}
                        {selectedAccount.application?.id ? (
                          <button onClick={() => void setApplicationStatus("denied")} disabled={saving} className="rounded-full border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-50">Deny</button>
                        ) : null}
                        <Link href="/admin/portal/applications" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Open Applications</Link>
                      </div>
                    </div>

                    {statusText ? <div className="mt-4 rounded-[18px] border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-100">{statusText}</div> : null}

                    <div className="mt-5 grid gap-4 md:grid-cols-4">
                      <InfoCard label="Buyer Record" value={selectedAccount.buyer ? `#${selectedAccount.buyer.id}` : "Not linked yet"} />
                      <InfoCard label="Application" value={selectedAccount.application ? `#${selectedAccount.application.id}` : "None"} />
                      <InfoCard label="Forms" value={String(selectedAccount.forms.length)} />
                      <InfoCard label="Current Status" value={selectedAccount.application?.status || selectedAccount.buyer?.status || "pending"} />
                    </div>
                  </section>

                  <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                    <div className="rounded-[30px] border border-white/10 bg-white/5 p-6 shadow-[0_20px_90px_rgba(0,0,0,0.22)] md:p-7">
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Buyer Profile</div>
                      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">Edit contact and portal details</h3>
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <Field label="Full Name" value={form.full_name} onChange={(value) => setForm((prev) => ({ ...prev, full_name: value }))} />
                        <Field label="Email" value={form.email} onChange={(value) => setForm((prev) => ({ ...prev, email: value }))} />
                        <Field label="Phone" value={form.phone} onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))} />
                        <Field label="Status" value={form.status} onChange={(value) => setForm((prev) => ({ ...prev, status: value }))} />
                      </div>
                      <label className="mt-4 block text-sm font-semibold text-slate-300">
                        Notes
                        <textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} rows={5} className="mt-2 w-full rounded-[20px] border border-white/10 bg-[#0d1729]/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/30" />
                      </label>
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button onClick={() => void saveBuyer()} disabled={saving} className="rounded-full border border-sky-400/20 bg-sky-500/10 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-sky-100 transition hover:bg-sky-500/20 disabled:opacity-50">Save Buyer</button>
                        <Link href="/admin/portal/payments" className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Open Payments</Link>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="rounded-[30px] border border-white/10 bg-white/5 p-6 shadow-[0_20px_90px_rgba(0,0,0,0.22)] md:p-7">
                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Latest Application</div>
                        {selectedAccount.application ? (
                          <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                            <InfoLine label="Status" value={selectedAccount.application.status || "submitted"} />
                            <InfoLine label="Submitted" value={fmtDate(selectedAccount.application.created_at)} />
                            <InfoLine label="Assigned Puppy" value={selectedAccount.application.assigned_puppy_id ? String(selectedAccount.application.assigned_puppy_id) : "None yet"} />
                            <InfoLine label="Admin Notes" value={selectedAccount.application.admin_notes || "No notes yet"} />
                          </div>
                        ) : (
                          <div className="mt-4 text-sm font-semibold text-slate-400">No application is linked to this account yet.</div>
                        )}
                      </div>

                      <div className="rounded-[30px] border border-white/10 bg-white/5 p-6 shadow-[0_20px_90px_rgba(0,0,0,0.22)] md:p-7">
                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Submitted Forms</div>
                        <div className="mt-4 space-y-3">
                          {selectedAccount.forms.length ? selectedAccount.forms.map((item) => (
                            <div key={item.id} className="rounded-[20px] border border-white/10 bg-[#0d1729]/70 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-white">{firstValue(item.form_title, item.form_key, `Form #${item.id}`)}</div>
                                  <div className="mt-1 text-xs leading-5 text-slate-400">{fmtDate(item.submitted_at || item.created_at)}</div>
                                </div>
                                <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${tone(item.status)}`}>{item.status}</span>
                              </div>
                            </div>
                          )) : <div className="text-sm font-semibold text-slate-400">No forms submitted yet.</div>}
                        </div>
                      </div>
                    </div>
                  </section>
                </>
              ) : (
                <div className="rounded-[30px] border border-dashed border-white/12 bg-black/10 px-6 py-16 text-center text-sm font-semibold text-slate-400">Select a portal user to review the linked buyer, application, and submitted forms.</div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

async function loadAccounts(accessToken: string): Promise<AccountRow[]> {
  if (!accessToken) return [];

  try {
    const response = await fetch("/api/admin/portal/accounts", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { accounts?: AccountRow[] };
    return Array.isArray(payload.accounts) ? payload.accounts : [];
  } catch {
    return [];
  }
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-semibold text-slate-300">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-[20px] border border-white/10 bg-[#0d1729]/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400/30" />
    </label>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[#0d1729]/70 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-[#0d1729]/70 px-4 py-3">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-1 text-sm text-white">{value}</div>
    </div>
  );
}

function RestrictedState({ title, details }: { title: string; details: string }) {
  return (
    <div className="min-h-screen bg-[#07101c] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[960px] items-center justify-center px-6 py-10">
        <div className="w-full rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-[0_30px_120px_rgba(0,0,0,0.32)] md:p-10">
          <h1 className="text-4xl font-semibold tracking-tight text-white">{title}</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base">{details}</p>
          <div className="mt-6"><Link href="/portal" className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Return to Buyer Portal</Link></div>
        </div>
      </div>
    </div>
  );
}

