"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { fetchAdminAccounts, type AdminPortalAccount } from "@/lib/admin-portal";
import { fmtMoney } from "@/lib/utils";
import { usePortalAdminSession } from "@/lib/use-portal-admin-session";

type UserFilter = "all" | "confirmed" | "linked" | "unlinked" | "active";

type ActivityRow = {
  key: string;
  kind: string;
  title: string;
  detail: string;
  status: string;
  timestamp: string | null;
};

function firstFilled(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function dt(value: string | null | undefined, fallback = "Not recorded") {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function puppyName(
  puppy: NonNullable<AdminPortalAccount["linkedPuppies"]>[number]
) {
  return firstFilled(puppy.call_name, puppy.puppy_name, puppy.name, `Puppy #${puppy.id}`);
}

function provider(account: AdminPortalAccount) {
  const direct = String(account.appMetadata?.provider || "").trim();
  if (direct) return direct;
  const providers = Array.isArray(account.appMetadata?.providers)
    ? account.appMetadata.providers
    : [];
  const listed = providers.find((value) => typeof value === "string" && value.trim());
  if (typeof listed === "string") return listed;
  const identity = Array.isArray(account.identities) ? account.identities[0] : null;
  return typeof identity?.provider === "string" && identity.provider.trim()
    ? identity.provider
    : "email";
}

function activityRows(account: AdminPortalAccount) {
  const forms = account.forms.map((form) => ({
    key: `form-${form.id}`,
    kind: "Form",
    title: firstFilled(form.form_title, form.form_key, `Submission ${form.id}`),
    detail: firstFilled(form.signed_name, form.user_email, "Portal form submission"),
    status: form.status || "submitted",
    timestamp: form.submitted_at || form.created_at || null,
  }));
  const documents = (account.documents || []).map((document) => ({
    key: `document-${document.id}`,
    kind: "Document",
    title: firstFilled(document.title, document.file_name, `Document ${document.id}`),
    detail: firstFilled(document.category, document.file_name, "Portal document"),
    status: document.status || "filed",
    timestamp: document.created_at || null,
  }));
  const messages = (account.messages || []).map((message) => ({
    key: `message-${message.id}`,
    kind: "Message",
    title: firstFilled(message.subject, `Message ${message.id}`),
    detail: firstFilled(message.message, message.sender, "Portal message"),
    status: message.status || (message.read_by_admin ? "read" : "unread"),
    timestamp: message.created_at || null,
  }));
  const pickups = (account.pickupRequests || []).map((pickup) => ({
    key: `pickup-${pickup.id}`,
    kind: "Pickup",
    title: firstFilled(pickup.request_type, `Request ${pickup.id}`),
    detail: firstFilled(pickup.location_text, pickup.address_text, pickup.notes, "Pickup request"),
    status: pickup.status || "pending",
    timestamp: pickup.request_date || pickup.created_at || null,
  }));
  return [...forms, ...documents, ...messages, ...pickups]
    .sort((left, right) => {
      const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : 0;
      const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, 10);
}

function json(value: unknown) {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function searchBlob(account: AdminPortalAccount) {
  return [
    account.displayName,
    account.email,
    account.phone,
    account.buyer?.full_name,
    account.buyer?.name,
    account.buyer?.email,
    account.application?.full_name,
    account.application?.email,
    ...(account.linkedPuppies || []).map((puppy) => puppyName(puppy)),
    ...(account.forms || []).map((form) => `${form.form_title || ""} ${form.form_key || ""}`),
    ...(account.documents || []).map((document) => `${document.title || ""} ${document.category || ""}`),
    ...(account.messages || []).map((message) => `${message.subject || ""} ${message.message || ""}`),
  ]
    .join(" ")
    .toLowerCase();
}

export default function AdminPortalUsersPage() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();
  const [accounts, setAccounts] = useState<AdminPortalAccount[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [selectedKey, setSelectedKey] = useState("");

  const loadAccounts = useCallback(async (showRefreshing = false) => {
    if (!accessToken || !isAdmin) {
      setAccounts([]);
      setLoadingData(false);
      setRefreshing(false);
      return;
    }
    if (showRefreshing) setRefreshing(true);
    else setLoadingData(true);
    try {
      const nextAccounts = await fetchAdminAccounts(accessToken);
      setAccounts(nextAccounts);
      setSelectedKey((current) => current || nextAccounts[0]?.key || "");
    } finally {
      setLoadingData(false);
      setRefreshing(false);
    }
  }, [accessToken, isAdmin]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const filteredAccounts = useMemo(
    () =>
      accounts.filter((account) => {
        if (filter === "confirmed" && !account.emailConfirmedAt) return false;
        if (filter === "linked" && !account.buyer) return false;
        if (filter === "unlinked" && account.buyer) return false;
        if (filter === "active" && !account.lastSignInAt && !activityRows(account).length) {
          return false;
        }
        const query = search.trim().toLowerCase();
        return !query || searchBlob(account).includes(query);
      }),
    [accounts, filter, search]
  );

  useEffect(() => {
    if (!filteredAccounts.length) {
      setSelectedKey("");
      return;
    }
    if (!filteredAccounts.some((account) => account.key === selectedKey)) {
      setSelectedKey(filteredAccounts[0].key);
    }
  }, [filteredAccounts, selectedKey]);

  const selected =
    filteredAccounts.find((account) => account.key === selectedKey) ||
    accounts.find((account) => account.key === selectedKey) ||
    null;

  const confirmedCount = accounts.filter((account) => Boolean(account.emailConfirmedAt)).length;
  const linkedBuyerCount = accounts.filter((account) => Boolean(account.buyer)).length;
  const activeCount = accounts.filter(
    (account) => Boolean(account.lastSignInAt) || activityRows(account).length > 0
  ).length;

  if (loading || loadingData) {
    return <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">Loading portal users...</div>;
  }

  if (!user) {
    return <AdminRestrictedState title="Sign in to access users." details="This workspace is reserved for the Southwest Virginia Chihuahua owner accounts." />;
  }

  if (!isAdmin) {
    return <AdminRestrictedState title="This user workspace is limited to approved owner accounts." details="Only approved owner emails can review signed-up portal users and their linked activity." />;
  }

  return (
    <AdminPageShell>
      <div className="space-y-5 pb-10">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminInfoTile label="Portal Users" value={String(accounts.length)} detail="Signed-up portal accounts only, separate from buyer records." />
          <AdminInfoTile label="Email Confirmed" value={String(confirmedCount)} detail={`${accounts.length - confirmedCount} still need confirmation.`} />
          <AdminInfoTile label="Linked Buyers" value={String(linkedBuyerCount)} detail={`${accounts.length - linkedBuyerCount} users are still unmatched to a buyer record.`} />
          <AdminInfoTile label="Active Accounts" value={String(activeCount)} detail="Last sign-in or portal activity detected on the account." />
        </section>

        <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.18fr)_460px]">
          <AdminPanel
            title="Portal User Directory"
            subtitle="Every self-created portal login with linked buyer, application, forms, documents, messages, pickup requests, and auth metadata."
            action={<button type="button" onClick={() => void loadAccounts(true)} className="inline-flex items-center rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]">{refreshing ? "Refreshing..." : "Refresh Users"}</button>}
          >
            <div className="mb-4 flex flex-wrap gap-2">
              {(["all", "confirmed", "linked", "unlinked", "active"] as UserFilter[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${filter === value ? "border-[#cfab84] bg-[var(--portal-surface-muted)] text-[var(--portal-text)]" : "border-[var(--portal-border)] bg-white text-[var(--portal-text-soft)] hover:border-[#d8b48b]"}`}
                >
                  {value === "all" ? "All users" : value === "confirmed" ? "Confirmed email" : value === "linked" ? "Linked buyers" : value === "unlinked" ? "Unlinked users" : "Active recently"}
                </button>
              ))}
            </div>

            <div className="mb-4">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users, emails, linked buyers, puppies, forms, documents, or messages..." className="w-full rounded-[16px] border border-[var(--portal-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--portal-text)] outline-none transition focus:border-[var(--portal-accent)] focus:ring-2 focus:ring-[rgba(90,142,245,0.14)]" />
            </div>

            {filteredAccounts.length ? (
              <div className="space-y-3">
                {filteredAccounts.map((account) => (
                  <AdminListCard
                    key={account.key}
                    selected={account.key === selectedKey}
                    onClick={() => setSelectedKey(account.key)}
                    title={account.displayName}
                    subtitle={`${account.email || "No email"} / ${account.buyer ? firstFilled(account.buyer.full_name, account.buyer.name, account.buyer.email, `Buyer #${account.buyer.id}`) : "No buyer linked"}`}
                    meta={`Created ${dt(account.createdAt)} / Last sign-in ${dt(account.lastSignInAt, "Never")}`}
                    badge={<span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(account.emailConfirmedAt ? "confirmed" : "pending")}`}>{account.emailConfirmedAt ? "confirmed" : "needs setup"}</span>}
                  />
                ))}
              </div>
            ) : (
              <AdminEmptyState title="No users match the current filters" description="Try a different search or refresh the directory to pull the latest signups." />
            )}
          </AdminPanel>

          <div className="space-y-5">
            <AdminPanel title="User Detail" subtitle={selected ? "Auth details, linked records, and recent portal activity for the selected user." : "Select a signed-in portal user to inspect the full account trail."}>
              {selected ? (
                <div className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <AdminInfoTile label="Email" value={selected.email || "No email"} detail={`Provider ${provider(selected)} / User id ${selected.userId || "Not returned"}`} />
                    <AdminInfoTile label="Phone" value={selected.phone || "No phone"} detail={`Phone confirmed ${selected.phoneConfirmedAt ? "yes" : "no"}`} />
                    <AdminInfoTile label="Created" value={dt(selected.createdAt)} detail={`Updated ${dt(selected.updatedAt)}`} />
                    <AdminInfoTile label="Last Sign-In" value={dt(selected.lastSignInAt, "Never")} detail={`Email confirmed ${dt(selected.emailConfirmedAt)}`} />
                  </div>

                  <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-4 shadow-sm">
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(selected.emailConfirmedAt ? "confirmed" : "pending")}`}>{selected.emailConfirmedAt ? "Email confirmed" : "Email pending"}</span>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(selected.buyer ? "linked" : "pending")}`}>{selected.buyer ? "Buyer linked" : "Buyer unlinked"}</span>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(selected.application ? "active" : "quiet")}`}>{selected.application ? "Application linked" : "No application"}</span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-3 py-3"><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">Audience</div><div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">{selected.audience || "Not returned"}</div></div>
                      <div className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-3 py-3"><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">Role</div><div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">{selected.role || "Not returned"}</div></div>
                      <div className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-3 py-3"><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">Pending Email Change</div><div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">{selected.pendingEmail || "None"}</div></div>
                      <div className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-3 py-3"><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">Banned Until</div><div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">{dt(selected.bannedUntil, "Not banned")}</div></div>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-4 shadow-sm">
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">Linked Buyer</div>
                      <div className="mt-2 text-base font-semibold text-[var(--portal-text)]">{selected.buyer ? firstFilled(selected.buyer.full_name, selected.buyer.name, selected.buyer.email, `Buyer #${selected.buyer.id}`) : "No buyer linked"}</div>
                      <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{selected.buyer ? `${selected.buyer.email || "No email"} / ${selected.buyer.phone || "No phone"} / ${selected.buyer.status || "pending"}` : "This user has not been matched to a buyer record yet."}</div>
                      {selected.buyer ? <div className="mt-4"><Link href="/admin/portal/buyers" className="inline-flex items-center rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]">Open Buyers</Link></div> : null}
                    </div>
                    <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-4 shadow-sm">
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">Linked Application</div>
                      <div className="mt-2 text-base font-semibold text-[var(--portal-text)]">{selected.application ? firstFilled(selected.application.full_name, selected.application.email, selected.application.applicant_email, `Application #${selected.application.id}`) : "No application linked"}</div>
                      <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{selected.application ? `${selected.application.phone || "No phone"} / ${selected.application.status || "pending"} / ${dt(selected.application.created_at)}` : "No application was matched to this signed-in user."}</div>
                      {selected.application ? <div className="mt-4"><Link href="/admin/portal/applications" className="inline-flex items-center rounded-2xl border border-[var(--portal-border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--portal-text)] transition hover:border-[var(--portal-border-strong)]">Open Applications</Link></div> : null}
                    </div>
                  </div>
                </div>
              ) : (
                <AdminEmptyState title="Select a user" description="Choose a portal signup from the directory to inspect the full account trail." />
              )}
            </AdminPanel>

            {selected ? (
              <AdminPanel title="Activity And Records" subtitle="Everything available for this signed-in account, including payments, linked puppies, forms, documents, messages, pickup requests, and raw auth metadata.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <AdminInfoTile label="Payments" value={selected.paymentSummary ? fmtMoney(selected.paymentSummary.totalPaid) : "$0"} detail={selected.paymentSummary ? `${selected.paymentSummary.count} payment records / last paid ${dt(selected.paymentSummary.lastPaymentAt)}` : "No linked buyer payment summary yet."} />
                  <AdminInfoTile label="Linked Puppies" value={String(selected.linkedPuppies?.length || 0)} detail={`${selected.forms.length} forms / ${selected.documents?.length || 0} documents / ${selected.messages?.length || 0} messages`} />
                </div>

                <div className="mt-5 space-y-3">
                  {activityRows(selected).length ? (
                    activityRows(selected).map((row: ActivityRow) => (
                      <div key={row.key} className="rounded-[1.25rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">{row.kind}</div>
                            <div className="mt-2 text-sm font-semibold text-[var(--portal-text)]">{row.title}</div>
                            <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{row.detail || "No additional detail saved."}</div>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${adminStatusBadge(row.status)}`}>{row.status}</span>
                        </div>
                        <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">{dt(row.timestamp)}</div>
                      </div>
                    ))
                  ) : (
                    <AdminEmptyState title="No portal activity recorded" description="Forms, messages, documents, and pickup requests will appear here as this user works through the portal." />
                  )}
                </div>

                <div className="mt-5 grid gap-5">
                  <RecordGroup title="Linked Puppies" emptyText="No puppies are linked to this user yet.">
                    {(selected.linkedPuppies || []).map((puppy) => (
                      <RecordRow key={puppy.id} title={puppyName(puppy)} detail={`${puppy.litter_name || "No litter"} / ${puppy.status || "No status"}`} meta={`${fmtMoney(Number(puppy.price || 0))} price / ${fmtMoney(Number(puppy.deposit || 0))} deposit`} />
                    ))}
                  </RecordGroup>

                  <RecordGroup title="Forms" emptyText="No forms submitted yet.">
                    {selected.forms.map((form) => (
                      <RecordRow key={form.id} title={firstFilled(form.form_title, form.form_key, `Submission ${form.id}`)} detail={`Status ${form.status || "submitted"} / Signed ${form.signed_name || "Not signed"}`} meta={`Submitted ${dt(form.submitted_at || form.created_at)}`} />
                    ))}
                  </RecordGroup>

                  <RecordGroup title="Documents" emptyText="No documents uploaded yet.">
                    {(selected.documents || []).map((document) => (
                      <RecordRow key={document.id} title={firstFilled(document.title, document.file_name, `Document ${document.id}`)} detail={`Category ${document.category || "Not set"} / Status ${document.status || "filed"}`} meta={`Created ${dt(document.created_at)}`} />
                    ))}
                  </RecordGroup>

                  <RecordGroup title="Messages" emptyText="No portal messages yet.">
                    {(selected.messages || []).map((message) => (
                      <RecordRow key={message.id} title={firstFilled(message.subject, `Message ${message.id}`)} detail={firstFilled(message.message, message.sender, "No message text")} meta={`${message.status || "active"} / ${dt(message.created_at)}`} />
                    ))}
                  </RecordGroup>

                  <RecordGroup title="Pickup Requests" emptyText="No pickup requests yet.">
                    {(selected.pickupRequests || []).map((pickup) => (
                      <RecordRow key={pickup.id} title={firstFilled(pickup.request_type, `Request ${pickup.id}`)} detail={firstFilled(pickup.location_text, pickup.address_text, pickup.notes, "No location saved")} meta={`${pickup.status || "pending"} / ${dt(pickup.request_date || pickup.created_at)}`} />
                    ))}
                  </RecordGroup>

                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">Raw Auth Metadata</div>
                    <div className="mt-3 grid gap-3">
                      <JsonCard label="User Metadata" value={json(selected.userMetadata)} />
                      <JsonCard label="App Metadata" value={json(selected.appMetadata)} />
                      <JsonCard label="Identities" value={json(selected.identities)} />
                      <JsonCard label="Factors" value={json(selected.factors)} />
                    </div>
                  </div>
                </div>
              </AdminPanel>
            ) : null}
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}

function RecordGroup({ title, emptyText, children }: { title: string; emptyText: string; children: React.ReactNode }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">{title}</div>
      <div className="mt-3 space-y-3">
        {rows.length ? rows : <div className="rounded-[1rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm text-[var(--portal-text-soft)]">{emptyText}</div>}
      </div>
    </div>
  );
}

function RecordRow({ title, detail, meta }: { title: string; detail: string; meta: string }) {
  return (
    <div className="rounded-[1rem] border border-[var(--portal-border)] bg-white px-4 py-3">
      <div className="text-sm font-semibold text-[var(--portal-text)]">{title}</div>
      <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
      <div className="mt-2 text-xs font-semibold text-[var(--portal-text-muted)]">{meta}</div>
    </div>
  );
}

function JsonCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-[var(--portal-border)] bg-[#fffdfb] px-4 py-4">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portal-text-muted)]">{label}</div>
      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-[var(--portal-text-soft)]">{value}</pre>
    </div>
  );
}
