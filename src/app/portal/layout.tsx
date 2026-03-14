"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { sb } from "@/lib/utils";

type PortalUser = {
  email?: string | null;
  user_metadata?: {
    full_name?: string | null;
    name?: string | null;
  };
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<PortalUser | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      const {
        data: { session },
      } = await sb.auth.getSession();

      if (!mounted) return;
      setUser((session?.user as PortalUser) ?? null);
    };

    loadUser();

    const { data: authListener } = sb.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        setUser((session?.user as PortalUser) ?? null);
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);

  const nav = [
    { href: "/portal", label: "Dashboard" },
    { href: "/portal/application", label: "Application" },
    { href: "/portal/mypuppy", label: "My Puppy" },
    { href: "/portal/messages", label: "Messages" },
    { href: "/portal/documents", label: "Contracts" },
    { href: "/portal/payments", label: "Financials" },
    { href: "/portal/transportation", label: "Transportation" },
    { href: "/portal/resources", label: "Resources" },
    { href: "/portal/chichi", label: "Chat with Chi Chi" },
  ];

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "Portal User";

  const userInitial = (displayName?.[0] || user?.email?.[0] || "U").toUpperCase();

  async function handleSignOut() {
    await sb.auth.signOut();
    setUser(null);
    setIsDrawerOpen(false);
    router.push("/portal");
    router.refresh();
  }

  function getNavClass(href: string) {
    const active = pathname === href;
    return active ? "nav-item active" : "nav-item";
  }

  return (
    <div className="flex h-screen overflow-hidden bg-brand-50 text-brand-900">
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white/80 backdrop-blur-md h-16 flex items-center justify-between px-6 border-b border-brand-200/50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="text-brand-700"
            aria-label="Open portal menu"
          >
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

          <div>
            <div className="font-serif font-bold text-xl leading-none">
              Southwest Virginia Chihuahua
            </div>
            <div className="text-[10px] uppercase tracking-widest text-brand-500 font-black mt-1">
              Puppy Portal
            </div>
          </div>
        </div>

        <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center border border-brand-200 font-bold text-brand-600">
          {userInitial}
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
            <div className="font-serif font-bold text-xl leading-none">
              Southwest Virginia Chihuahua
            </div>
            <div className="text-[10px] uppercase tracking-widest text-brand-500 font-black mt-1">
              Puppy Portal
            </div>
          </div>

          <button
            onClick={() => setIsDrawerOpen(false)}
            className="text-2xl leading-none text-brand-700"
            aria-label="Close portal menu"
          >
            ×
          </button>
        </div>

        <nav className="p-5 pt-7 flex flex-col gap-3 flex-1 overflow-y-auto">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className={getNavClass(item.href)}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-6 border-t border-brand-100 bg-brand-50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-brand-200 flex items-center justify-center text-brand-700 font-black text-xs">
              {userInitial}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-black truncate">{displayName}</p>
              <p className="text-[10px] text-brand-400 font-semibold truncate">
                {user?.email || ""}
              </p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full py-3 rounded-lg border border-brand-200 text-brand-700 font-black text-sm hover:bg-white transition"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <aside className="hidden md:flex w-72 flex-col bg-white/80 border-r border-brand-200/60 backdrop-blur-sm">
        <div className="p-8">
          <h1 className="font-serif font-bold text-xl leading-none">
            Southwest Virginia Chihuahua
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-brand-500 font-black mt-1">
            Puppy Portal
          </p>
        </div>

        <nav className="flex-1 px-4 pt-6 pb-6 overflow-y-auto">
          <div className="mt-3 flex flex-col gap-3">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className={getNavClass(item.href)}>
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-brand-100 bg-brand-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-200 flex items-center justify-center text-brand-700 font-black text-xs">
              {userInitial}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-black truncate">{displayName}</p>
              <p className="text-[10px] text-brand-400 font-semibold truncate mt-1">
                {user?.email || ""}
              </p>

              <button
                onClick={handleSignOut}
                className="mt-2 text-[10px] font-black uppercase text-brand-500 hover:text-brand-800"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 h-full overflow-hidden pt-16 md:pt-0">
        {children}
      </main>
    </div>
  );
}