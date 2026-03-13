"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { sb, fmtDate } from "@/lib/utils";

type PortalDocumentRow = {
  id: string;
  created_at: string;
  user_id: string;
  user_email: string | null;
  category: string;
  title: string;
  description: string | null;
  file_url?: string | null;
  file_path?: string | null;
  source_table?: string | null;
  source_id?: number | null;
  status: string;
};

type RequiredDoc = {
  key: string;
  title: string;
  description: string;
  matchTitles: string[];
  requiredWhen: "always" | "after_approval" | "after_reservation";
};

const REQUIRED_DOCS: RequiredDoc[] = [
  {
    key: "application",
    title: "Puppy Application",
    description: "Your submitted application and intake information.",
    matchTitles: ["puppy application", "application"],
    requiredWhen: "always",
  },
  {
    key: "deposit_agreement",
    title: "Deposit Agreement",
    description: "Deposit terms and reservation acknowledgment.",
    matchTitles: ["deposit agreement", "reservation agreement"],
    requiredWhen: "after_approval",
  },
  {
    key: "sales_agreement",
    title: "Puppy Sales Agreement",
    description: "Main purchase agreement and ownership terms.",
    matchTitles: ["puppy sales agreement", "sales agreement"],
    requiredWhen: "after_reservation",
  },
  {
    key: "health_guarantee",
    title: "Health Guarantee",
    description: "Health guarantee terms, coverage, and buyer obligations.",
    matchTitles: ["health guarantee"],
    requiredWhen: "after_reservation",
  },
  {
    key: "bill_of_sale",
    title: "Bill of Sale",
    description: "Final ownership transfer record.",
    matchTitles: ["bill of sale"],
    requiredWhen: "after_reservation",
  },
  {
    key: "care_packet",
    title: "Puppy Care Packet",
    description: "Care instructions, feeding notes, and go-home guidance.",
    matchTitles: ["puppy care packet", "care packet", "puppy packet"],
    requiredWhen: "after_reservation",
  },
  {
    key: "vaccination_record",
    title: "Vaccination Record",
    description: "Vaccination and veterinary care record.",
    matchTitles: ["vaccination record", "shot record", "vet record"],
    requiredWhen: "after_reservation",
  },
];

export default function PortalDocumentsPage() {
  const [user, setUser] = useState<any>(null);
  const [documents, setDocuments] = useState<PortalDocumentRow[]>([]);
  const [applicationStatus, setApplicationStatus] = useState<string>("");
  const [hasApplicationRow, setHasApplicationRow] = useState(false);
  const [applicationRowId, setApplicationRowId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [statusText, setStatusText] = useState("");

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
          await loadDocuments(currentUser);
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
          await loadDocuments(currentUser);
        } else {
          setDocuments([]);
          setApplicationStatus("");
          setHasApplicationRow(false);
          setApplicationRowId(null);
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function loadDocuments(currUser: any) {
    const email = String(currUser?.email || "").toLowerCase();
    const uid = currUser?.id;

    setStatusText("Loading contracts and documents...");

    const [docsRes, appRes] = await Promise.all([
      sb
        .from("portal_documents")
        .select("*")
        .or(`user_id.eq.${uid},user_email.ilike.%${email}%`)
        .eq("category", "contracts")
        .order("created_at", { ascending: false }),
      sb
        .from("puppy_applications")
        .select("id,status")
        .or(`user_id.eq.${uid},applicant_email.ilike.%${email}%,email.ilike.%${email}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const appData = appRes.data as { id?: number; status?: string } | null;

    setDocuments((docsRes.data as PortalDocumentRow[]) || []);
    setApplicationStatus(String(appData?.status || ""));
    setHasApplicationRow(!!appData?.id);
    setApplicationRowId(appData?.id ?? null);
    setStatusText("");
  }

  async function handleRefresh() {
    if (!user) return;
    await loadDocuments(user);
  }

  async function handleSignOut() {
    await sb.auth.signOut();
    setUser(null);
    setDocuments([]);
    setApplicationStatus("");
    setHasApplicationRow(false);
    setApplicationRowId(null);
  }

  const normalizedDocs = useMemo(() => {
    return documents.map((doc) => ({
      ...doc,
      titleLower: String(doc.title || "").toLowerCase().trim(),
      descriptionLower: String(doc.description || "").toLowerCase().trim(),
    }));
  }, [documents]);

  const requiredDocsWithStatus = useMemo(() => {
    const appStatus = applicationStatus.toLowerCase();

    return REQUIRED_DOCS.map((req) => {
      let found = normalizedDocs.find((doc) =>
        req.matchTitles.some((name) => doc.titleLower.includes(name))
      );

      // treat application as complete even if the portal_documents copy
      // hasn't been created yet, as long as the application row exists
      if (!found && req.key === "application" && hasApplicationRow) {
        found = {
          id: `application-row-${applicationRowId ?? "current"}`,
          created_at: "",
          user_id: user?.id || "",
          user_email: user?.email || "",
          category: "contracts",
          title: "Puppy Application",
          description: "Your application has been submitted and saved.",
          status: applicationStatus || "submitted",
          source_table: "puppy_applications",
          source_id: applicationRowId ?? null,
          titleLower: "puppy application",
          descriptionLower: "your application has been submitted and saved.",
        } as any;
      }

      let shouldBeAvailable = false;

      if (req.requiredWhen === "always") shouldBeAvailable = true;
      if (
        req.requiredWhen === "after_approval" &&
        ["approved", "deposit_pending", "reserved"].some((s) => appStatus.includes(s))
      ) {
        shouldBeAvailable = true;
      }
      if (
        req.requiredWhen === "after_reservation" &&
        ["reserved", "deposit_pending"].some((s) => appStatus.includes(s))
      ) {
        shouldBeAvailable = true;
      }

      return {
        ...req,
        found,
        shouldBeAvailable,
      };
    });
  }, [normalizedDocs, applicationStatus, hasApplicationRow, applicationRowId, user]);

  const completedCount = requiredDocsWithStatus.filter((d) => d.found).length;
  const availableCount = requiredDocsWithStatus.filter((d) => d.shouldBeAvailable).length;

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-50 italic">
        Loading Contracts...
      </div>
    );
  }

  if (!user) {
    return <DocumentsLogin />;
  }

  return (
    <div className="flex h-screen overflow-hidden text-brand-900 bg-brand-50">
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white/80 backdrop-blur-md h-16 flex items-center justify-between px-6 border-b border-brand-200/50">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsDrawerOpen(true)} className="text-brand-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-serif font-bold text-xl">SWVA</span>
        </div>

        <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center border border-brand-200 font-bold text-brand-600">
          {user.email?.[0]?.toUpperCase() || "U"}
        </div>
      </header>

      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-brand-900/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 bottom-0 w-[82%] max-w-[320px] bg-[#FDFBF9] z-50 shadow-2xl flex flex-col transition-transform duration-300 md:hidden ${
          isDrawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 border-b border-brand-100 flex justify-between items-center">
          <div>
            <div className="font-serif font-bold text-xl">Menu</div>
            <div className="text-[11px] text-brand-400 font-semibold mt-1 truncate max-w-[220px]">
              {user.email}
            </div>
          </div>
          <button onClick={() => setIsDrawerOpen(false)}>×</button>
        </div>

        <nav className="p-5 pt-7 flex flex-col gap-3 flex-1 overflow-y-auto">
          <Link href="/portal" className="nav-item">Dashboard</Link>
          <Link href="/portal/application" className="nav-item">Application</Link>
          <Link href="/portal/mypuppy" className="nav-item">My Puppy</Link>
          <Link href="/portal/messages" className="nav-item">Messages</Link>
          <Link href="/portal/documents" className="nav-item active">Contracts</Link>
          <Link href="/portal/payments" className="nav-item">Financials</Link>
          <Link href="/portal/resources" className="nav-item">Resources</Link>
        </nav>

        <div className="p-6 border-t border-brand-100 bg-brand-50">
          <button
            onClick={handleSignOut}
            className="w-full py-3 rounded-lg border border-brand-200 text-brand-700 font-black text-sm hover:bg-white transition"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <aside className="hidden md:flex flex-col w-72 bg-white/80 border-r border-brand-200/60 z-20 h-full backdrop-blur-sm">
        <div className="p-8">
          <h1 className="font-serif font-bold text-xl leading-none">SWVA</h1>
          <p className="text-[10px] uppercase tracking-widest text-brand-500 font-black mt-1">
            Chihuahua
          </p>
        </div>

        <nav className="flex-1 px-4 pt-6 pb-6 overflow-y-auto">
          <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-brand-400">
            Portal
          </div>

          <div className="mt-3 flex flex-col gap-3">
            <Link href="/portal" className="nav-item">Dashboard</Link>
            <Link href="/portal/application" className="nav-item">Application</Link>
            <Link href="/portal/mypuppy" className="nav-item">My Puppy</Link>
          </div>

          <div className="px-4 py-2 mt-8 text-[10px] font-black uppercase tracking-widest text-brand-400">
            Communication
          </div>

          <div className="mt-3 flex flex-col gap-3">
            <Link href="/portal/messages" className="nav-item">Messages</Link>
            <Link href="/portal/documents" className="nav-item active">Contracts</Link>
            <Link href="/portal/payments" className="nav-item">Financials</Link>
            <Link href="/portal/resources" className="nav-item">Resources</Link>
          </div>
        </nav>

        <div className="p-4 border-t border-brand-100 bg-brand-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-200 flex items-center justify-center text-brand-700 font-black text-xs">
              {user.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black truncate">{user.email}</p>
              <div className="flex items-center gap-3 mt-1">
                <button
                  onClick={handleRefresh}
                  className="text-[10px] font-black uppercase text-brand-500 hover:text-brand-800"
                >
                  Refresh
                </button>
                <button
                  onClick={handleSignOut}
                  className="text-[10px] font-black uppercase text-brand-500 hover:text-brand-800"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 h-full relative flex flex-col overflow-hidden bg-texturePaper pt-16 md:pt-0">
        <div className="flex-1 p-6 md:p-10 lg:p-12 overflow-y-auto scroller max-w-[1600px] mx-auto w-full">
          <div className="space-y-8 pb-14">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
              <div>
                <h2 className="font-serif text-4xl md:text-5xl font-bold text-brand-900 leading-[0.95]">
                  Documents & Contracts
                </h2>

                <p className="mt-2 text-brand-500 font-semibold">
                  Completed agreements and saved contract records.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] bg-white border border-brand-200 text-brand-700">
                  Saved: {documents.length}
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] bg-white border border-brand-200 text-brand-700">
                  Complete: {completedCount}/{availableCount || REQUIRED_DOCS.length}
                </span>
              </div>
            </div>

            {statusText ? (
              <div className="text-sm font-semibold text-brand-500">{statusText}</div>
            ) : null}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 space-y-8">
                <div className="card-luxury p-7">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-serif text-2xl font-bold text-brand-900">
                        Required Contracts & Documents
                      </h3>
                      <p className="text-brand-500 font-semibold text-sm mt-1">
                        Required records for your portal and puppy purchase process.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    {requiredDocsWithStatus.map((doc) => {
                      const isComplete = !!doc.found;
                      const isAvailable = doc.shouldBeAvailable;

                      return (
                        <div
                          key={doc.key}
                          className="rounded-2xl border border-brand-200 bg-white/70 p-5"
                        >
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-base font-black text-brand-900">
                                  {doc.title}
                                </h4>

                                {isComplete ? (
                                  <span className="inline-flex px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-[0.18em]">
                                    Complete
                                  </span>
                                ) : isAvailable ? (
                                  <span className="inline-flex px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-black uppercase tracking-[0.18em]">
                                    Pending
                                  </span>
                                ) : (
                                  <span className="inline-flex px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200 text-[10px] font-black uppercase tracking-[0.18em]">
                                    Not yet required
                                  </span>
                                )}
                              </div>

                              <p className="mt-2 text-sm font-semibold text-brand-600 leading-relaxed">
                                {doc.description}
                              </p>

                              {doc.found?.description ? (
                                <p className="mt-3 text-[12px] font-semibold text-brand-500">
                                  {doc.found.description}
                                </p>
                              ) : null}

                              {doc.found?.created_at ? (
                                <p className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-brand-400">
                                  Saved {fmtDate(doc.found.created_at)}
                                </p>
                              ) : null}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {doc.key === "application" && hasApplicationRow ? (
                                <Link
                                  href="/portal/application"
                                  className="px-4 py-2 rounded-xl bg-brand-800 text-white font-black text-xs uppercase tracking-[0.18em] hover:bg-brand-700 transition"
                                >
                                  Open
                                </Link>
                              ) : doc.found?.file_url ? (
                                <a
                                  href={doc.found.file_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-4 py-2 rounded-xl bg-brand-800 text-white font-black text-xs uppercase tracking-[0.18em] hover:bg-brand-700 transition"
                                >
                                  Open
                                </a>
                              ) : doc.found ? (
                                <span className="px-4 py-2 rounded-xl bg-brand-100 text-brand-700 font-black text-xs uppercase tracking-[0.18em] border border-brand-200">
                                  Saved in Portal
                                </span>
                              ) : (
                                <span className="px-4 py-2 rounded-xl bg-white text-brand-400 font-black text-xs uppercase tracking-[0.18em] border border-brand-200">
                                  Awaiting Completion
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="card-luxury p-7">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-serif text-2xl font-bold text-brand-900">
                        Saved Contract Records
                      </h3>
                      <p className="text-brand-500 font-semibold text-sm mt-1">
                        Open completed items directly from here.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    {documents.length || hasApplicationRow ? (
                      <>
                        {hasApplicationRow && !documents.some((d) =>
                          String(d.title || "").toLowerCase().includes("application")
                        ) ? (
                          <div className="rounded-2xl border border-brand-200 bg-white/70 p-5">
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-base font-black text-brand-900">
                                    Puppy Application
                                  </h4>
                                  <span className="inline-flex px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-[0.18em]">
                                    {applicationStatus || "submitted"}
                                  </span>
                                </div>

                                <p className="mt-2 text-sm font-semibold text-brand-600 leading-relaxed">
                                  Your submitted application is saved in the portal.
                                </p>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <Link
                                  href="/portal/application"
                                  className="px-4 py-2 rounded-xl bg-brand-800 text-white font-black text-xs uppercase tracking-[0.18em] hover:bg-brand-700 transition"
                                >
                                  Open
                                </Link>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="rounded-2xl border border-brand-200 bg-white/70 p-5"
                          >
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-base font-black text-brand-900">
                                    {doc.title}
                                  </h4>
                                  <span className="inline-flex px-2.5 py-1 rounded-full bg-brand-100 text-brand-700 border border-brand-200 text-[10px] font-black uppercase tracking-[0.18em]">
                                    {doc.status || "active"}
                                  </span>
                                </div>

                                {doc.description ? (
                                  <p className="mt-2 text-sm font-semibold text-brand-600 leading-relaxed">
                                    {doc.description}
                                  </p>
                                ) : null}

                                <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-black uppercase tracking-[0.18em] text-brand-400">
                                  <span>Saved {fmtDate(doc.created_at)}</span>
                                  {doc.source_table ? <span>Source: {doc.source_table}</span> : null}
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {doc.file_url ? (
                                  <a
                                    href={doc.file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-4 py-2 rounded-xl bg-brand-800 text-white font-black text-xs uppercase tracking-[0.18em] hover:bg-brand-700 transition"
                                  >
                                    Open
                                  </a>
                                ) : doc.source_table === "puppy_applications" ? (
                                  <Link
                                    href="/portal/application"
                                    className="px-4 py-2 rounded-xl bg-brand-800 text-white font-black text-xs uppercase tracking-[0.18em] hover:bg-brand-700 transition"
                                  >
                                    Open
                                  </Link>
                                ) : (
                                  <span className="px-4 py-2 rounded-xl bg-brand-100 text-brand-700 font-black text-xs uppercase tracking-[0.18em] border border-brand-200">
                                    Portal Copy
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="text-center py-16">
                        <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl border border-brand-200">
                          📂
                        </div>
                        <h4 className="font-serif text-3xl font-bold text-brand-800">
                          No Documents Saved Yet
                        </h4>
                        <p className="text-brand-500 mt-3 max-w-md mx-auto text-sm font-semibold leading-relaxed">
                          Completed applications and contract records will appear here automatically.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 space-y-6">
                <div className="card-luxury p-7">
                  <h3 className="font-serif text-2xl font-bold text-brand-900 mb-4">
                    Contracts Overview
                  </h3>

                  <div className="space-y-4">
                    <MiniInfo label="Application Status" value={applicationStatus || "Not started"} />
                    <MiniInfo label="Saved Records" value={String(documents.length || (hasApplicationRow ? 1 : 0))} />
                    <MiniInfo label="Completed Required Items" value={`${completedCount}`} />
                    <MiniInfo label="Portal Area" value="Contracts" />
                  </div>
                </div>

                <div className="rounded-3xl bg-brand-800 text-white p-7 shadow-luxury">
                  <h4 className="font-serif text-2xl font-bold">Need Help?</h4>
                  <p className="mt-2 text-brand-200 text-sm font-semibold">
                    Need something re-sent or not seeing a contract you expected? Message support through the portal.
                  </p>
                  <Link
                    href="/portal/messages"
                    className="inline-block mt-5 px-5 py-3 bg-white/10 border border-white/20 rounded-xl text-xs font-black uppercase tracking-[0.18em] hover:bg-white/20 transition"
                  >
                    Message Support
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-white/65 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-brand-800">{value}</div>
    </div>
  );
}

function DocumentsLogin() {
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
    <div className="h-screen flex items-center justify-center bg-brand-50 p-6">
      <div className="card-luxury shine p-10 w-full max-w-md border border-white">
        <h2 className="font-serif text-4xl font-bold text-center mb-8">
          Welcome Home
        </h2>

        <form onSubmit={login} className="space-y-5">
          <div>
            <label className="text-[10px] font-black uppercase text-brand-500 mb-1 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-xl border border-brand-200"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-brand-500 mb-1 block">
              Password
            </label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="w-full p-3 rounded-xl border border-brand-200"
              required
            />
          </div>

          <button className="w-full bg-brand-800 text-white p-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-lift">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}