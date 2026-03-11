"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { sb, T, fmtDate, buildPuppyPhotoUrl } from "@/lib/utils";

type PortalData = {
  buyer: any;
  app: any;
  puppy: any;
  msgs: any[];
};

export default function PortalPage() {
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const {
          data: { session },
        } = await sb.auth.getSession();

        if (!mounted) return;

        const sessionUser = session?.user ?? null;
        setUser(sessionUser);

        if (sessionUser) {
          await loadData(sessionUser);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: authListener } = sb.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;

        if (!mounted) return;

        setUser(currentUser);

        if (currentUser) {
          await loadData(currentUser);
        } else {
          setData(null);
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function loadData(currUser: any) {
    const email = String(currUser?.email || "").toLowerCase();
    const uid = currUser?.id;

    let buyer: any = null;
    let app: any = null;
    let puppy: any = null;
    let msgs: any[] = [];

    const buyerRes = await sb
      .from(T.buyers)
      .select("*")
      .or(`user_id.eq.${uid},email.ilike.%${email}%`)
      .limit(1)
      .maybeSingle();

    buyer = buyerRes.data ?? null;

    const appRes = await sb
      .from(T.applications)
      .select("*")
      .or(`user_id.eq.${uid},email.ilike.%${email}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    app = appRes.data ?? null;

    if (buyer?.id) {
      const puppyByBuyerRes = await sb
        .from(T.puppies)
        .select("*")
        .eq("buyer_id", buyer.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      puppy = puppyByBuyerRes.data ?? null;
    }

    if (!puppy) {
      const puppyByEmailRes = await sb
        .from(T.puppies)
        .select("*")
        .or(`owner_email.ilike.%${email}%,buyer_email.ilike.%${email}%,email.ilike.%${email}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      puppy = puppyByEmailRes.data ?? null;
    }

    const msgRes = await sb
      .from(T.messages)
      .select("*")
      .or(`user_id.eq.${uid},email.ilike.%${email}%`)
      .order("created_at", { ascending: false })
      .limit(5);

    msgs = msgRes.data || [];

    setData({ buyer, app, puppy, msgs });
  }

  async function handleSignOut() {
    await sb.auth.signOut();
    setUser(null);
    setData(null);
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-50 italic">
        Loading Portal...
      </div>
    );
  }

  if (!user) return <LoginComponent />;

  return (
    <div className="flex h-screen overflow-hidden text-brand-900 bg-brand-50">
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white/80 backdrop-blur-md h-16 flex items-center justify-between px-6 border-b border-brand-200/50">
        <button onClick={() => setIsDrawerOpen(true)} className="text-brand-700">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        <span className="font-serif font-bold text-xl">SWVA</span>

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
        <div className="p-6 border-b flex justify-between items-center">
          <span className="font-serif font-bold text-xl">Menu</span>
          <button onClick={() => setIsDrawerOpen(false)}>×</button>
        </div>

        <nav className="p-5 flex flex-col gap-3">
          <Link href="/portal" className="nav-item active">
            Dashboard
          </Link>
          <Link href="/portal/application" className="nav-item">
            Application
          </Link>
          <Link href="/portal/messages" className="nav-item">
            Messages
          </Link>
        </nav>
      </aside>

      <aside className="hidden md:flex flex-col w-72 bg-white/80 border-r border-brand-200/60 z-20 h-full backdrop-blur-sm">
        <div className="p-8">
          <h1 className="font-serif font-bold text-xl leading-none">SWVA</h1>
          <p className="text-[10px] uppercase tracking-widest text-brand-500 font-black mt-1">
            Chihuahua
          </p>
        </div>

        <nav className="flex-1 px-4 pt-6 space-y-3">
          <div className="px-4 py-2 text-[10px] font-black uppercase text-brand-400">
            Portal
          </div>
          <Link href="/portal" className="nav-item active">
            Dashboard
          </Link>
          <Link href="/portal/application" className="nav-item">
            Application
          </Link>
          <Link href="/portal/mypuppy" className="nav-item">
            My Puppy
          </Link>
        </nav>

        <div className="p-4 border-t border-brand-100 bg-brand-50/50">
          <p className="text-xs font-black truncate">{user.email}</p>
          <button
            onClick={handleSignOut}
            className="text-[10px] font-black uppercase text-brand-500 hover:text-brand-800"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 h-full relative flex flex-col overflow-hidden bg-texturePaper pt-16 md:pt-0">
        <div className="flex-1 p-6 md:p-12 overflow-y-auto scroller max-w-[1600px] mx-auto w-full">
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-brand-200 shadow-paper mb-4">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-500">
                My Puppy Portal
              </span>
            </div>

            <h2 className="font-serif text-4xl md:text-5xl font-bold text-brand-900 leading-none">
              Hello, {data?.buyer?.full_name || "Family"}
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            <div className="lg:col-span-2 card-luxury shine p-8 relative overflow-hidden">
              <h3 className="font-serif text-3xl font-bold mb-2">
                {data?.puppy
                  ? `Match Confirmed: ${data.puppy.call_name || data.puppy.name || "Your Puppy"}`
                  : data?.app
                  ? "Application Received"
                  : "Welcome"}
              </h3>

              <p className="text-brand-600 font-semibold mb-6">
                Review documents and messages for next steps.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/portal/application"
                  className="px-7 py-3.5 bg-brand-800 text-white font-black text-sm rounded-xl uppercase tracking-wider"
                >
                  Open Application
                </Link>

                <Link
                  href="/portal/messages"
                  className="px-7 py-3.5 bg-white border border-brand-200 text-brand-800 font-black text-sm rounded-xl uppercase tracking-wider"
                >
                  Message Support
                </Link>
              </div>
            </div>

            <div className="card-luxury p-8 bg-gradient-to-br from-[#FFFBF0] to-white border-brand-200">
              <p className="font-serif text-xl italic text-brand-800 leading-relaxed">
                “We’ll post updates as soon as they’re ready. Keep an eye on Messages.”
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8">
              {data?.puppy ? (
                <div className="card-luxury overflow-hidden h-[450px] relative group">
                  <img
                    src={buildPuppyPhotoUrl(
                      data.puppy.image_url ||
                        data.puppy.image_path ||
                        data.puppy.photo_url ||
                        data.puppy.image
                    )}
                    className="w-full h-full object-cover transition duration-700 group-hover:scale-105"
                    alt="Puppy"
                  />

                  <div className="absolute bottom-0 left-0 p-8 bg-gradient-to-t from-black/70 to-transparent w-full">
                    <h3 className="text-white font-serif text-5xl font-bold">
                      {data.puppy.call_name || data.puppy.name || "Your Puppy"}
                    </h3>
                    <p className="text-white/80 font-semibold">
                      {data.puppy.sex || data.puppy.gender || "Puppy"} • Born{" "}
                      {fmtDate(data.puppy.dob || data.puppy.birth_date)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="card-luxury p-16 text-center border-dashed border-2 border-brand-200 bg-white/40">
                  <div className="text-4xl mb-4 text-brand-200">🐾</div>
                  <h3 className="font-serif text-3xl font-bold text-brand-800">
                    No Puppy Assigned Yet
                  </h3>
                  <p className="text-brand-500 mt-2">
                    Updates appear after application approval and matching.
                  </p>
                </div>
              )}
            </div>

            <div className="lg:col-span-4">
              <div className="card-luxury p-7 h-full">
                <h4 className="font-serif font-bold text-2xl text-brand-800 mb-6">
                  Recent Messages
                </h4>

                <div className="space-y-4">
                  {data?.msgs?.length ? (
                    data.msgs.map((m: any) => (
                      <div
                        key={m.id}
                        className="p-4 bg-brand-50/50 rounded-xl border border-brand-100"
                      >
                        <div className="flex justify-between mb-1">
                          <span className="text-[10px] font-black text-brand-500 uppercase">
                            {m.sender_name || m.sender || "Support"}
                          </span>
                          <span className="text-[10px] text-brand-300 font-semibold">
                            {fmtDate(m.created_at)}
                          </span>
                        </div>

                        <p className="text-sm font-semibold text-brand-800 line-clamp-2">
                          {m.message || m.content || m.body || "—"}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-8 text-brand-400 italic">
                      No new messages
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Link
        href="/portal/messages"
        className="fixed bottom-6 right-6 w-14 h-14 bg-brand-800 text-white rounded-full shadow-luxury flex items-center justify-center hover:scale-105 transition z-50"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </Link>
    </div>
  );
}

function LoginComponent() {
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