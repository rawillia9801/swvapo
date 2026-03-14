"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const pathname = usePathname();

  const nav = [
    { href: "/portal", label: "Dashboard" },
    { href: "/portal/application", label: "Application" },
    { href: "/portal/mypuppy", label: "My Puppy" },
    { href: "/portal/messages", label: "Messages" },
    { href: "/portal/documents", label: "Contracts" },
    { href: "/portal/payments", label: "Financials" },
    { href: "/portal/resources", label: "Resources" },
  ];

  return (
    <div className="flex h-screen bg-brand-50 text-brand-900">

      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-brand-200 flex flex-col">

        <div className="p-8 border-b border-brand-100">
          <h1 className="font-serif font-bold text-xl">
            Southwest Virginia Chihuahua
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-brand-500 font-black mt-1">
            Puppy Portal
          </p>
        </div>

        <nav className="flex flex-col gap-2 p-6">

          {nav.map((item) => {

            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-3 rounded-lg text-sm font-bold transition ${
                  active
                    ? "bg-brand-100 text-brand-900"
                    : "text-brand-500 hover:bg-brand-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}

        </nav>

      </aside>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

    </div>
  );
}