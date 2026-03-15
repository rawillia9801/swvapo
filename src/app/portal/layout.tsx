"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Dog,
  CalendarDays,
  FileText,
  CreditCard,
  CarFront,
  MessageCircle,
  Sparkles,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { sb } from "@/lib/utils";

type PortalUser = {
  email?: string | null;
  user_metadata?: {
    full_name?: string | null;
    name?: string | null;
  };
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  match?: (pathname: string) => boolean;
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

  const nav: NavItem[] = useMemo(
    () => [
      {
        href: "/portal",
        label: "Overview",
        icon: <Home className="h-[18px] w-[18px]" />,
        match: (p) => p === "/portal",
      },
      {
        href: "/portal/mypuppy",
        label: "My Puppy",
        icon: <Dog className="h-[18px] w-[18px]" />,
      },
      {
        href: "/portal/updates",
        label: "Updates",
        icon: <CalendarDays className="h-[18px] w-[18px]" />,
      },
      {
        href: "/portal/documents",
        label: "Contracts & Docs",
        icon: <FileText className="h-[18px] w-[18px]" />,
      },
      {
        href: "/portal/payments",
        label: "Payments",
        icon: <CreditCard className="h-[18px] w-[18px]" />,
      },
      {
        href: "/portal/transportation",
        label: "Pickup / Meet / Delivery",
        icon: <CarFront className="h-[18px] w-[18px]" />,
      },
      {
        href: "/portal/messages",
        label: "Messages",
        icon: <MessageCircle className="h-[18px] w-[18px]" />,
      },
      {
        href: "/available-puppies",
        label: "Available Puppies",
        icon: <Sparkles className="h-[18px] w-[18px]" />,
      },
    ],
    []
  );

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

  function isActive(item: NavItem) {
    if (item.match) return item.match(pathname);
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  function navClass(item: NavItem) {
    const active = isActive(item);

    return [
      "group flex items-center gap-3 rounded-[18px] px-4 py-3 transition-all duration-200",
      active
        ? "bg-[#0f1938] text-white shadow-[0_12px_30px_rgba(15,25,56,0.24)]"
        : "text-slate-800 hover:bg-white hover:shadow-sm",
    ].join(" ");
  }

  function iconWrapClass(item: NavItem) {
    const active = isActive(item);
    return [
      "flex h-9 w-9 items-center justify-center rounded-full transition",
      active ? "bg-white/10 text-white" : "bg-transparent text-slate-500 group-hover:text-slate-800",
    ].join(" ");
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-slate-900">
      <header className="md:hidden sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-4">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm"
            aria-label="Open portal menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0f1938] text-white shadow-sm">
              <Dog className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                Southwest Virginia Chihuahua
              </div>
              <div className="font-serif text-[24px] leading-none text-slate-900">
                Puppy Portal
              </div>
            </div>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-bold text-slate-700">
            {userInitial}
          </div>
        </div>
      </header>

      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/35 backdrop-blur-sm md:hidden"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[86%] max-w-[320px] transform bg-transparent p-4 transition-transform duration-300 md:hidden ${
          isDrawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col rounded-[28px] border border-slate-300/70 bg-[#efefef] px-4 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
          <div className="flex items-start justify-between gap-3 px-2">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0f1938] text-white">
                <Dog className="h-5 w-5" />
              </div>

              <div className="leading-tight">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Southwest Virginia Chihuahua
                </div>
                <div className="font-serif text-[18px] leading-none text-slate-900">
                  Puppy Portal
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsDrawerOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-600"
              aria-label="Close portal menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="mt-6 flex-1 space-y-2">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className={navClass(item)}>
                <span className={iconWrapClass(item)}>{item.icon}</span>
                <span className="text-[15px] font-semibold leading-tight">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-5 border-t border-slate-300 pt-5">
            <button
              onClick={handleSignOut}
              className="w-full rounded-[16px] border border-slate-300 bg-white px-4 py-3 text-[15px] font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              Sign out
            </button>

            <div className="mt-3 px-1 text-xs text-slate-500">
              Signed in as{" "}
              <span className="font-semibold text-slate-700">{user?.email || "—"}</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-4 md:px-6 md:py-6 xl:px-8">
        <aside className="hidden md:block md:w-[300px] md:flex-shrink-0">
          <div className="sticky top-6 flex flex-col rounded-[28px] border border-slate-300/70 bg-[#efefef] px-4 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
            <div className="flex items-center gap-3 px-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0f1938] text-white">
                <Dog className="h-5 w-5" />
              </div>

              <div className="leading-tight">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Southwest Virginia Chihuahua
                </div>
                <div className="font-serif text-[18px] leading-none text-slate-900">
                  Puppy Portal
                </div>
              </div>
            </div>

            <nav className="mt-6 flex-1 space-y-2">
              {nav.map((item) => (
                <Link key={item.href} href={item.href} className={navClass(item)}>
                  <span className={iconWrapClass(item)}>{item.icon}</span>
                  <span className="text-[15px] font-semibold leading-tight">{item.label}</span>
                </Link>
              ))}
            </nav>

            <div className="mt-5 border-t border-slate-300 pt-5">
              <button
                onClick={handleSignOut}
                className="w-full rounded-[16px] border border-slate-300 bg-white px-4 py-3 text-[15px] font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                Sign out
              </button>

              <div className="mt-3 px-1 text-xs text-slate-500">
                Signed in as{" "}
                <span className="font-semibold text-slate-700">{user?.email || "—"}</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}