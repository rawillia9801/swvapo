"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AdminPageShell,
  AdminPanel,
  AdminRestrictedState,
} from "@/components/admin/luxury-admin-shell";
import { usePortalAdminSession } from "@/lib/use-portal-admin-session";
import { fmtMoney } from "@/lib/utils";

/* ---------------- UI ---------------- */

const primary =
  "rounded-xl bg-gradient-to-br from-[#c88c52] to-[#8a5a2b] text-white px-4 py-2 text-sm font-semibold shadow";

const secondary =
  "rounded-xl border px-4 py-2 text-sm font-semibold bg-white hover:bg-gray-50";

/* ---------------- Types ---------------- */

type Buyer = any;
type Puppy = any;

/* ---------------- Page ---------------- */

export default function Page() {
  const { user, accessToken, loading, isAdmin } = usePortalAdminSession();

  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [puppies, setPuppies] = useState<Puppy[]>([]);
  const [selected, setSelected] = useState<Buyer | null>(null);

  const [tab, setTab] = useState<string>("puppies");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<any>({});

  /* ---------------- Fetch ---------------- */

  useEffect(() => {
    async function load() {
      if (!accessToken) return;

      const res = await fetch("/api/admin/portal/buyers", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const data = await res.json();
      setBuyers(data.buyers || []);
      setPuppies(data.puppies || []);
      setSelected(data.buyers?.[0] || null);
    }

    load();
  }, [accessToken]);

  /* ---------------- Groups ---------------- */

  const grouped = useMemo(() => {
    const active: Buyer[] = [];
    const completed: Buyer[] = [];
    const financing: Buyer[] = [];

    buyers.forEach((b) => {
      if (b.buyer?.finance_enabled) financing.push(b);
      else if (b.buyer?.status === "completed") completed.push(b);
      else active.push(b);
    });

    return { active, financing, completed };
  }, [buyers]);

  /* ---------------- Tabs ---------------- */

  const puppyCount = selected?.linkedPuppies?.length || 0;
  const hasFinancing = selected?.buyer?.finance_enabled;

  const tabs = [
    "profile",
    puppyCount === 1 ? "puppy" : "puppies",
    "transportation",
    "payments",
    ...(hasFinancing ? ["puppy payment plan"] : []),
    "documents",
    "activity",
  ];

  /* ---------------- Save ---------------- */

  async function save() {
    await fetch("/api/admin/portal/buyers", {
      method: form.id ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(form),
    });

    setModalOpen(false);
    location.reload();
  }

  /* ---------------- Guards ---------------- */

  if (loading) return <div className="p-10">Loading...</div>;

  if (!user)
    return <AdminRestrictedState title="Login required" details="Please sign in." />;

  if (!isAdmin)
    return <AdminRestrictedState title="Not authorized" details="Admin only." />;

  /* ---------------- UI ---------------- */

  return (
    <AdminPageShell>
      <div className="grid xl:grid-cols-[280px_1fr] gap-6">

        {/* SIDEBAR */}
        <div className="space-y-4">

          <AdminPanel
            title="Buyers"
            action={
              <button
                className={primary}
                onClick={() => {
                  setForm({});
                  setModalOpen(true);
                }}
              >
                + New
              </button>
            }
          >
            <input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full mb-3 border rounded-lg px-3 py-2"
            />

            {["active", "financing", "completed"].map((group) => {
              const list = grouped[group as keyof typeof grouped];

              if (!list.length) return null;

              return (
                <div key={group}>
                  <div className="text-xs font-bold uppercase text-gray-400 mt-3 mb-1">
                    {group}
                  </div>

                  <div className="space-y-1">
                    {list
                      .filter((b) =>
                        (b.displayName || "")
                          .toLowerCase()
                          .includes(search.toLowerCase())
                      )
                      .map((b) => (
                        <button
                          key={b.key}
                          onClick={() => {
                            setSelected(b);
                            setTab("puppies");
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg ${
                            selected?.key === b.key
                              ? "bg-black text-white"
                              : "hover:bg-gray-100"
                          }`}
                        >
                          <div className="flex justify-between">
                            <span>{b.displayName}</span>
                            <span className="text-xs opacity-60">
                              {fmtMoney(b.balance || 0)}
                            </span>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              );
            })}
          </AdminPanel>
        </div>

        {/* MAIN */}
        <div className="space-y-4">

          {/* HEADER */}
          {selected && (
            <div className="flex justify-between items-center border rounded-xl p-4 bg-white">
              <div>
                <div className="font-semibold text-lg">
                  {selected.displayName}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  className={secondary}
                  onClick={() => {
                    setForm(selected.buyer);
                    setModalOpen(true);
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
          )}

          {/* TABS */}
          <div className="flex gap-2 flex-wrap">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-full text-sm ${
                  tab === t ? "bg-black text-white" : "bg-gray-100"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* PUPPIES TAB */}
          {tab.includes("puppy") && selected && (
            <AdminPanel title="Assign Puppies">
              <div className="grid md:grid-cols-2 gap-3">
                {puppies.map((p) => {
                  const assigned = selected.linkedPuppies?.some(
                    (lp: any) => lp.id === p.id
                  );

                  return (
                    <button
                      key={p.id}
                      className={`border rounded-lg p-3 text-left ${
                        assigned ? "bg-green-100" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-gray-500">
                        {fmtMoney(p.price || 0)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </AdminPanel>
          )}

          {/* PLACEHOLDER TABS */}
          {!tab.includes("puppy") && (
            <AdminPanel title={tab}>
              <div className="text-sm text-gray-500">
                This section is wired and ready — expanding next.
              </div>
            </AdminPanel>
          )}
        </div>
      </div>

      {/* MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl w-[400px] space-y-3">
            <div className="text-lg font-semibold">Buyer</div>

            <input
              placeholder="Full name"
              value={form.full_name || ""}
              onChange={(e) =>
                setForm({ ...form, full_name: e.target.value })
              }
              className="w-full border px-3 py-2 rounded"
            />

            <input
              placeholder="Email"
              value={form.email || ""}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
              className="w-full border px-3 py-2 rounded"
            />

            <div className="flex justify-end gap-2">
              <button onClick={() => setModalOpen(false)} className={secondary}>
                Cancel
              </button>
              <button onClick={save} className={primary}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}