"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  BellDot,
  CreditCard,
  Dog,
  FileCheck2,
  Files,
  LayoutDashboard,
  MapPinned,
  MessageSquareText,
  PawPrint,
  ShieldCheck,
  Users,
} from "lucide-react";
import { fmtDate, fmtMoney, sb } from "@/lib/utils";
import { getPortalAdminEmails, isPortalAdminEmail } from "@/lib/portal-admin";

type BuyerRow = {
  id: number;
  created_at?: string | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  buyer_email?: string | null;
  phone?: string | null;
  status?: string | null;
  user_id?: string | null;
};

type ApplicationRow = {
  id: number;
  created_at: string;
  full_name?: string | null;
  email?: string | null;
  applicant_email?: string | null;
  status?: string | null;
  assigned_puppy_id?: number | null;
  user_id?: string | null;
};

type PuppyRow = {
  id: number;
  created_at?: string | null;
  call_name?: string | null;
  puppy_name?: string | null;
  name?: string | null;
  status?: string | null;
  buyer_id?: number | null;
  owner_email?: string | null;
};

type MessageRow = {
  id: string;
  created_at: string;
  subject?: string | null;
  user_email?: string | null;
  sender?: string | null;
  status?: string | null;
  read_by_admin?: boolean | null;
};

type FormRow = {
  id: number;
  created_at: string;
  form_key: string;
  form_title?: string | null;
  status: string;
  user_email?: string | null;
  signed_name?: string | null;
  submitted_at?: string | null;
};

type PickupRow = {
  id: number;
  created_at?: string | null;
  request_date?: string | null;
  request_type?: string | null;
  location_text?: string | null;
  status?: string | null;
  user_id?: string | null;
};

type AdminDigestRow = {
  id: number;
  digest_date: string;
  summary: string;
  stats?: {
    threadCount?: number;
    newLeads?: number;
    warmLeads?: number;
    hotLeads?: number;
    sharedContacts?: number;
    openFollowUps?: number;
    topTopics?: string[];
    recentBusinessMemory?: string[];
  } | null;
  priorities?: string[] | null;
  generated_at?: string | null;
};

type AdminOverviewData = {
  buyerCount: number;
  applicationCount: number;
  pendingApplicationCount: number;
  puppyCount: number;
  paymentCount: number;
  messageCount: number;
  unreadMessageCount: number;
  formCount: number;
  submittedFormCount: number;
  pickupCount: number;
  pendingPickupCount: number;
  totalRevenue: number;
  uniquePortalUsers: number;
  recentBuyers: BuyerRow[];
  recentApplications: ApplicationRow[];
  recentPuppies: PuppyRow[];
  recentMessages: MessageRow[];
  recentForms: FormRow[];
  recentPickups: PickupRow[];
  latestDigest: AdminDigestRow | null;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  helper: string;
};

function emptyData(): AdminOverviewData {
  return {
    buyerCount: 0,
    applicationCount: 0,
    pendingApplicationCount: 0,
    puppyCount: 0,
    paymentCount: 0,
    messageCount: 0,
    unreadMessageCount: 0,
    formCount: 0,
    submittedFormCount: 0,
    pickupCount: 0,
    pendingPickupCount: 0,
    totalRevenue: 0,
    uniquePortalUsers: 0,
    recentBuyers: [],
    recentApplications: [],
    recentPuppies: [],
    recentMessages: [],
    recentForms: [],
    recentPickups: [],
    latestDigest: null,
  };
}

function normalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function statusTone(statusRaw: string | null | undefined) {
  const status = String(statusRaw || "pending").trim().toLowerCase();

  if (["approved", "active", "matched", "submitted", "complete", "completed", "paid", "read"].some((item) => status.includes(item))) {
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  }

  if (["deny", "declined", "cancel", "rejected"].some((item) => status.includes(item))) {
    return "border-rose-400/30 bg-rose-500/10 text-rose-200";
  }

  return "border-amber-400/30 bg-amber-500/10 text-amber-100";
}

function firstValue(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function puppyName(row: PuppyRow) {
  return firstValue(row.call_name, row.puppy_name, row.name, `Puppy #${row.id}`);
}

export default function AdminPortalPage() {
  const [user, setUser] = useState<{ id: string; email?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AdminOverviewData>(emptyData);

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

        if (currentUser && isPortalAdminEmail(currentUser.email)) {
          const nextData = await loadOverviewData();
          if (mounted) setData(nextData);
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

      if (currentUser && isPortalAdminEmail(currentUser.email)) {
        setData(await loadOverviewData());
      } else {
        setData(emptyData());
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const navItems: NavItem[] = useMemo(
    () => [
      { href: "/admin/portal", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" />, helper: "Portal command center" },
      { href: "/admin/portal/users", label: "Users", icon: <Users className="h-4 w-4" />, helper: "Profiles, linked buyers, approvals" },
      { href: "/admin/portal/applications", label: "Applications", icon: <FileCheck2 className="h-4 w-4" />, helper: "Review, approve, deny, assign" },
      { href: "/admin/portal#puppies", label: "Puppies", icon: <Dog className="h-4 w-4" />, helper: "Assignments, statuses, pupdates" },
      { href: "/admin/portal/payments", label: "Payments", icon: <CreditCard className="h-4 w-4" />, helper: "Balances, plans, payment updates" },
      { href: "/admin/portal/messages", label: "Messages", icon: <MessageSquareText className="h-4 w-4" />, helper: "Client communication inbox" },
      { href: "/admin/portal#forms", label: "Forms & Uploads", icon: <Files className="h-4 w-4" />, helper: "Submitted forms and document flow" },
      { href: "/admin/portal#transportation", label: "Transportation", icon: <MapPinned className="h-4 w-4" />, helper: "Pickup, delivery, requests" },
      { href: "/admin/portal/assistant", label: "ChiChi Admin", icon: <PawPrint className="h-4 w-4" />, helper: "Natural-language admin changes" },
    ],
    []
  );

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#08111f] text-sm font-semibold text-slate-300">Loading admin portal...</div>;
  }

  if (!user) {
    return <AdminPortalLoginPrompt />;
  }

  if (!isPortalAdminEmail(user.email)) {
    return <AdminAccessRestricted />;
  }

  return (
    <div className="min-h-screen bg-[#07101c] text-white">
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_30%),radial-gradient(circle_at_top_right,rgba(244,114,182,0.12),transparent_28%),linear-gradient(180deg,#07101c_0%,#0b1526_52%,#07101c_100%)]">
        <div className="mx-auto grid min-h-screen w-full max-w-[1820px] grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="border-b border-white/8 bg-[#08111f]/90 px-5 py-6 backdrop-blur xl:min-h-screen xl:border-b-0 xl:border-r">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-sky-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                Owner Admin
              </div>
              <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white">Southwest Virginia Chihuahua</h1>
              <p className="mt-3 text-sm leading-7 text-slate-300">Full owner controls for buyers, puppies, payments, forms, messages, transportation, and portal approvals.</p>
            </div>

            <nav className="mt-5 space-y-2">
              {navItems.map((item) => (
                <Link key={item.label} href={item.href} className="group flex items-start gap-3 rounded-[22px] border border-white/8 bg-white/5 px-4 py-4 transition hover:border-sky-400/30 hover:bg-white/10">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#0d1a2e] text-sky-200">{item.icon}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">{item.label}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-400">{item.helper}</div>
                  </div>
                </Link>
              ))}
            </nav>

            <div className="mt-5 rounded-[24px] border border-emerald-400/20 bg-emerald-500/10 p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-200">Approved Owner Emails</div>
              <div className="mt-3 space-y-2 text-sm font-semibold text-white">
                {getPortalAdminEmails().map((email) => (
                  <div key={email} className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2">{email}</div>
                ))}
              </div>
            </div>
          </aside>

          <section className="min-w-0 px-4 py-4 md:px-8 md:py-7 xl:px-10">
            <header className="rounded-[34px] border border-white/10 bg-[linear-gradient(135deg,rgba(14,24,42,0.96),rgba(16,30,52,0.9),rgba(10,18,31,0.96))] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.4)] md:p-8">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-sky-100">
                    <BellDot className="h-3.5 w-3.5" />
                    Admin Command Center
                  </div>
                  <h2 className="mt-5 text-4xl font-semibold tracking-tight text-white md:text-5xl">Portal operations at a glance</h2>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">Review submitted items, manage users, approve or deny applications, update payments, and keep the full client experience organized from one owner-only workspace.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:w-[520px]">
                  <MiniStat label="Users" value={String(data.uniquePortalUsers)} />
                  <MiniStat label="Pending Apps" value={String(data.pendingApplicationCount)} />
                  <MiniStat label="Unread Msgs" value={String(data.unreadMessageCount)} />
                  <MiniStat label="Submitted Forms" value={String(data.submittedFormCount)} />
                </div>
              </div>
            </header>

            <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
              <KpiCard title="Portal Users" value={String(data.uniquePortalUsers)} helper={`${data.buyerCount} buyers • ${data.applicationCount} applications`} icon={<Users className="h-5 w-5" />} />
              <KpiCard title="Puppy Revenue" value={data.totalRevenue ? fmtMoney(data.totalRevenue) : "—"} helper={`${data.paymentCount} payment record(s) tracked`} icon={<Banknote className="h-5 w-5" />} />
              <KpiCard title="Forms & Uploads" value={String(data.formCount)} helper={`${data.submittedFormCount} submitted for review`} icon={<Files className="h-5 w-5" />} />
              <KpiCard title="Transportation" value={String(data.pickupCount)} helper={`${data.pendingPickupCount} pending requests`} icon={<MapPinned className="h-5 w-5" />} />
            </section>

            <section className="mt-6 rounded-[30px] border border-fuchsia-400/20 bg-[linear-gradient(135deg,rgba(25,18,48,0.94),rgba(11,21,42,0.94))] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.28)] md:p-7">
              <SectionHeader eyebrow="ChiChi Daily Brief" title="Daily admin update" linkHref="/admin/portal/assistant" linkLabel="Open ChiChi Admin" inverted />
              {data.latestDigest ? (
                <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
                  <div className="rounded-[24px] border border-white/10 bg-black/10 p-5">
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-fuchsia-200">
                      {fmtDate(data.latestDigest.digest_date)} brief
                    </div>
                    <div className="mt-3 text-base leading-8 text-white">
                      {data.latestDigest.summary}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <MiniStat label="Chats" value={String(data.latestDigest.stats?.threadCount || 0)} />
                    <MiniStat label="New Leads" value={String(data.latestDigest.stats?.newLeads || 0)} />
                    <MiniStat label="Warm / Hot" value={`${data.latestDigest.stats?.warmLeads || 0} / ${data.latestDigest.stats?.hotLeads || 0}`} />
                    <MiniStat label="Open Followups" value={String(data.latestDigest.stats?.openFollowUps || 0)} />
                  </div>
                </div>
              ) : (
                <div className="mt-5">
                  <EmptyState text="No ChiChi daily brief has been generated yet." />
                </div>
              )}

              {data.latestDigest?.priorities?.length ? (
                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {data.latestDigest.priorities.map((item) => (
                    <div key={item} className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-sm leading-7 text-slate-200">
                      {item}
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
              <div className="xl:col-span-7 rounded-[30px] border border-white/10 bg-white/5 p-6 shadow-[0_20px_90px_rgba(0,0,0,0.25)] md:p-7">
                <SectionHeader eyebrow="Admin Priorities" title="What needs attention" linkHref="/admin/portal/users" linkLabel="Open Users" />
                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <ActionCard title="Users" description="Review linked accounts, update buyer details, and approve or deny from one place." href="/admin/portal/users" />
                  <ActionCard title="Applications" description="Approve, deny, assign puppies, and keep notes on incoming applicants." href="/admin/portal/applications" />
                  <ActionCard title="Payments" description="Adjust pricing, deposits, balances, finance plans, and customer-facing totals." href="/admin/portal/payments" />
                  <ActionCard title="Messages" description="Open the portal inbox, monitor unread threads, and reply quickly." href="/admin/portal/messages" />
                </div>
              </div>

              <div className="xl:col-span-5 rounded-[30px] border border-sky-400/15 bg-[linear-gradient(180deg,rgba(14,25,45,0.95),rgba(9,18,33,0.92))] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.32)] md:p-7">
                <SectionHeader eyebrow="Direct Controls" title="Owner tools" linkHref="/admin/portal/assistant" linkLabel="Open ChiChi Admin" inverted />
                <div className="mt-5 space-y-3">
                  <DarkListRow label="Buyers and users" value="Add, edit, review, link, and update profiles" />
                  <DarkListRow label="Puppies and pupdates" value="Manage records, statuses, weights, events, and breeder notes" />
                  <DarkListRow label="Payments and financing" value="Update balances, payment plans, dates, APR, and due details" />
                  <DarkListRow label="Forms and uploads" value="View submitted items and process approvals where needed" />
                </div>
              </div>
            </section>

            <section className="mt-6 grid grid-cols-1 gap-6 2xl:grid-cols-2">
              <DataPanel
                title="Recent applications"
                eyebrow="Approvals"
                actionHref="/admin/portal/applications"
                actionLabel="Review applications"
                rows={data.recentApplications.map((row) => ({
                  key: `app-${row.id}`,
                  title: firstValue(row.full_name, row.email, row.applicant_email, `Application #${row.id}`),
                  subtitle: firstValue(row.email, row.applicant_email, "No email on file"),
                  meta: `Submitted ${fmtDate(row.created_at)}`,
                  status: row.status || "submitted",
                }))}
              />

              <DataPanel
                title="Recent messages"
                eyebrow="Inbox"
                actionHref="/admin/portal/messages"
                actionLabel="Open messages"
                rows={data.recentMessages.map((row) => ({
                  key: `msg-${row.id}`,
                  title: firstValue(row.subject, row.sender, "Portal message"),
                  subtitle: firstValue(row.user_email, "No linked email"),
                  meta: `Received ${fmtDate(row.created_at)}`,
                  status: row.status || (row.read_by_admin ? "read" : "new"),
                }))}
              />
            </section>

            <section id="puppies" className="mt-6 grid grid-cols-1 gap-6 2xl:grid-cols-2">
              <DataPanel
                title="Recent puppies"
                eyebrow="Puppies"
                actionHref="/admin/portal/assistant"
                actionLabel="Open ChiChi Admin"
                rows={data.recentPuppies.map((row) => ({
                  key: `puppy-${row.id}`,
                  title: puppyName(row),
                  subtitle: firstValue(row.owner_email, row.status, "No owner email"),
                  meta: `Added ${fmtDate(row.created_at)}`,
                  status: row.status || "active",
                }))}
              />

              <DataPanel
                title="Recent buyers"
                eyebrow="Users"
                actionHref="/admin/portal/users"
                actionLabel="Open users"
                rows={data.recentBuyers.map((row) => ({
                  key: `buyer-${row.id}`,
                  title: firstValue(row.full_name, row.name, row.email, `Buyer #${row.id}`),
                  subtitle: firstValue(row.email, row.buyer_email, row.phone, "No email on file"),
                  meta: `Added ${fmtDate(row.created_at)}`,
                  status: row.status || "active",
                }))}
              />
            </section>

            <section id="forms" className="mt-6 grid grid-cols-1 gap-6 2xl:grid-cols-2">
              <DataPanel
                title="Submitted forms"
                eyebrow="Forms & uploads"
                actionHref="/admin/portal/users"
                actionLabel="Open users"
                rows={data.recentForms.map((row) => ({
                  key: `form-${row.id}`,
                  title: firstValue(row.form_title, row.form_key, `Form #${row.id}`),
                  subtitle: firstValue(row.user_email, row.signed_name, "No linked email"),
                  meta: `Created ${fmtDate(row.submitted_at || row.created_at)}`,
                  status: row.status,
                }))}
              />

              <div id="transportation" className="rounded-[30px] border border-white/10 bg-white/5 p-6 shadow-[0_20px_90px_rgba(0,0,0,0.22)] md:p-7">
                <SectionHeader eyebrow="Transportation" title="Pickup and delivery queue" linkHref="/portal/transportation" linkLabel="Open buyer page" />
                <div className="mt-5 space-y-3">
                  {data.recentPickups.length ? (
                    data.recentPickups.map((row) => (
                      <div key={row.id} className="rounded-[22px] border border-white/8 bg-[#0d1729]/70 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">{firstValue(row.request_type, "Transportation request")}</div>
                            <div className="mt-1 text-xs leading-5 text-slate-400">{firstValue(row.location_text, "No location submitted")}</div>
                          </div>
                          <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${statusTone(row.status)}`}>{row.status || "pending"}</span>
                        </div>
                        <div className="mt-3 text-xs font-semibold text-slate-400">Request date {fmtDate(row.request_date || row.created_at)}</div>
                      </div>
                    ))
                  ) : (
                    <EmptyState text="No transportation requests have been submitted yet." />
                  )}
                </div>
              </div>
            </section>
          </section>
        </div>
      </main>
    </div>
  );
}

async function loadOverviewData(): Promise<AdminOverviewData> {
  const nextData = emptyData();

  const [buyersRes, appsRes, puppiesRes, messagesRes, formsRes, pickupsRes, paymentsRes, digestRes] = await Promise.all([
    sb.from("buyers").select("id,created_at,full_name,name,email,buyer_email,phone,status,user_id").order("created_at", { ascending: false }).limit(8),
    sb.from("puppy_applications").select("id,created_at,full_name,email,applicant_email,status,assigned_puppy_id,user_id").order("created_at", { ascending: false }).limit(8),
    sb.from("puppies").select("id,created_at,call_name,puppy_name,name,status,buyer_id,owner_email").order("created_at", { ascending: false }).limit(8),
    sb.from("portal_messages").select("id,created_at,subject,user_email,sender,status,read_by_admin").order("created_at", { ascending: false }).limit(8),
    sb.from("portal_form_submissions").select("id,created_at,form_key,form_title,status,user_email,signed_name,submitted_at").order("created_at", { ascending: false }).limit(8),
    sb.from("portal_pickup_requests").select("id,created_at,request_date,request_type,location_text,status,user_id").order("created_at", { ascending: false }).limit(8),
    sb.from("buyer_payments").select("id,amount").limit(500),
    sb.from("chichi_admin_digests").select("id,digest_date,summary,stats,priorities,generated_at").order("digest_date", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const buyers = (buyersRes.data || []) as BuyerRow[];
  const applications = (appsRes.data || []) as ApplicationRow[];
  const puppies = (puppiesRes.data || []) as PuppyRow[];
  const messages = (messagesRes.data || []) as MessageRow[];
  const forms = (formsRes.data || []) as FormRow[];
  const pickups = (pickupsRes.data || []) as PickupRow[];
  const payments = (paymentsRes.data || []) as Array<{ amount?: number | null }>;
  const latestDigest = (digestRes.data as AdminDigestRow | null) || null;

  nextData.recentBuyers = buyers;
  nextData.recentApplications = applications;
  nextData.recentPuppies = puppies;
  nextData.recentMessages = messages;
  nextData.recentForms = forms;
  nextData.recentPickups = pickups;
  nextData.latestDigest = latestDigest;

  nextData.buyerCount = await getCount("buyers");
  nextData.applicationCount = await getCount("puppy_applications");
  nextData.pendingApplicationCount = await getCount("puppy_applications", (query) => query.in("status", ["submitted", "pending review", "on hold", "waitlist"]));
  nextData.puppyCount = await getCount("puppies");
  nextData.messageCount = await getCount("portal_messages");
  nextData.unreadMessageCount = await getCount("portal_messages", (query) => query.eq("read_by_admin", false));
  nextData.formCount = await getCount("portal_form_submissions");
  nextData.submittedFormCount = await getCount("portal_form_submissions", (query) => query.in("status", ["submitted", "pending", "under review"]));
  nextData.pickupCount = await getCount("portal_pickup_requests");
  nextData.pendingPickupCount = await getCount("portal_pickup_requests", (query) => query.in("status", ["pending", "approved"]));
  nextData.paymentCount = await getCount("buyer_payments");
  nextData.totalRevenue = payments.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const userKeys = new Set<string>();
  for (const buyer of buyers) {
    const email = normalizeEmail(firstValue(buyer.email, buyer.buyer_email));
    const key = email || String(buyer.user_id || "").trim();
    if (key) userKeys.add(key);
  }
  for (const application of applications) {
    const email = normalizeEmail(firstValue(application.email, application.applicant_email));
    const key = email || String(application.user_id || "").trim();
    if (key) userKeys.add(key);
  }
  nextData.uniquePortalUsers = userKeys.size;

  return nextData;
}

async function getCount(
  tableName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutate?: (query: any) => any
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = sb.from(tableName).select("*", { count: "exact", head: true });
    if (mutate) query = mutate(query);
    const result = await query;
    return result.count || 0;
  } catch {
    return 0;
  }
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</div>
    </div>
  );
}

function KpiCard({ title, value, helper, icon }: { title: string; value: string; helper: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.18)]">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">{title}</div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-500/10 text-sky-200">{icon}</div>
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight text-white">{value}</div>
      <div className="mt-2 text-sm leading-6 text-slate-400">{helper}</div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, linkHref, linkLabel, inverted = false }: { eyebrow: string; title: string; linkHref: string; linkLabel: string; inverted?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className={`text-[10px] font-black uppercase tracking-[0.22em] ${inverted ? "text-slate-400" : "text-sky-200"}`}>{eyebrow}</div>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">{title}</h3>
      </div>
      <Link href={linkHref} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] transition ${inverted ? "border-white/10 bg-white/5 text-white hover:bg-white/10" : "border-sky-400/20 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20"}`}>
        {linkLabel}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function ActionCard({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <Link href={href} className="rounded-[24px] border border-white/10 bg-[#0b1628]/75 p-5 transition hover:border-sky-400/30 hover:bg-[#0f1d35]">
      <div className="text-lg font-semibold text-white">{title}</div>
      <div className="mt-2 text-sm leading-7 text-slate-400">{description}</div>
      <div className="mt-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-sky-200">Open<ArrowRight className="h-3.5 w-3.5" /></div>
    </Link>
  );
}

function DarkListRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-black/10 px-4 py-3">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-1 text-sm leading-6 text-white">{value}</div>
    </div>
  );
}

function DataPanel({ title, eyebrow, actionHref, actionLabel, rows }: { title: string; eyebrow: string; actionHref: string; actionLabel: string; rows: Array<{ key: string; title: string; subtitle: string; meta: string; status: string }> }) {
  return (
    <div className="rounded-[30px] border border-white/10 bg-white/5 p-6 shadow-[0_20px_90px_rgba(0,0,0,0.22)] md:p-7">
      <SectionHeader eyebrow={eyebrow} title={title} linkHref={actionHref} linkLabel={actionLabel} />
      <div className="mt-5 space-y-3">
        {rows.length ? rows.map((row) => (
          <div key={row.key} className="rounded-[22px] border border-white/8 bg-[#0d1729]/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">{row.title}</div>
                <div className="mt-1 text-xs leading-5 text-slate-400">{row.subtitle}</div>
              </div>
              <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${statusTone(row.status)}`}>{row.status}</span>
            </div>
            <div className="mt-3 text-xs font-semibold text-slate-500">{row.meta}</div>
          </div>
        )) : <EmptyState text={`No ${title.toLowerCase()} found yet.`} />}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-[24px] border border-dashed border-white/12 bg-black/10 px-5 py-8 text-center text-sm font-semibold text-slate-400">{text}</div>;
}

function AdminPortalLoginPrompt() {
  return (
    <div className="min-h-screen bg-[#07101c] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[980px] items-center justify-center px-6 py-10">
        <div className="w-full rounded-[34px] border border-white/10 bg-white/5 p-8 shadow-[0_30px_120px_rgba(0,0,0,0.38)] md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-sky-100"><ShieldCheck className="h-3.5 w-3.5" />Admin Portal</div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white">Sign in to access owner controls.</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base">This area is reserved for the Southwest Virginia Chihuahua owner accounts.</p>
          <div className="mt-6"><Link href="/portal" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Go to Buyer Portal</Link></div>
        </div>
      </div>
    </div>
  );
}

function AdminAccessRestricted() {
  return (
    <div className="min-h-screen bg-[#07101c] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[1040px] items-center justify-center px-6 py-10">
        <div className="w-full rounded-[34px] border border-rose-400/20 bg-white/5 p-8 shadow-[0_30px_120px_rgba(0,0,0,0.38)] md:p-10">
          <div className="inline-flex items-center rounded-full border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-rose-100">Access Restricted</div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white">This admin UI is limited to the approved owner email addresses.</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base">Sign in with one of the owner accounts below to manage buyers, payments, puppies, forms, messages, and portal approvals.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">{getPortalAdminEmails().map((email) => <div key={email} className="rounded-[22px] border border-white/10 bg-black/10 px-4 py-3 text-sm font-semibold text-white">{email}</div>)}</div>
          <div className="mt-6"><Link href="/portal" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/10">Return to Buyer Portal</Link></div>
        </div>
      </div>
    </div>
  );
}

