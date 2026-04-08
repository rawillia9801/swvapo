"use client";

import React from "react";
import {
  AdminInfoTile,
  AdminPageHero,
  AdminPageShell,
  AdminPanel,
  AdminRestrictedState,
} from "@/components/admin/luxury-admin-shell";
import { getPortalAdminEmails } from "@/lib/portal-admin";
import { usePortalAdminSession } from "@/lib/use-portal-admin-session";

const SYSTEM_RULES = [
  {
    title: "Public puppy pricing rule",
    detail:
      "Available puppies can show price publicly. Reserved and completed puppies keep internal sale values, but public listing and available-puppy surfaces should hide price automatically.",
  },
  {
    title: "Lineage model",
    detail:
      "Dams and sires link to litters. Litters link to puppies. Puppies can still expose dam and sire directly for easier admin querying and reporting.",
  },
  {
    title: "Admin reporting",
    detail:
      "Revenue, deposits, reserve counts, completion counts, and average pricing stay internal and continue to power litter, dam, and sire reporting.",
  },
];

export default function AdminPortalSettingsPage() {
  const { user, loading, isAdmin } = usePortalAdminSession();
  const adminEmails = getPortalAdminEmails();

  if (loading) {
    return (
      <div className="py-20 text-center text-sm font-semibold text-[#7b5f46]">
        Loading settings...
      </div>
    );
  }

  if (!user) {
    return (
      <AdminRestrictedState
        title="Sign in to access settings."
        details="This workspace is reserved for the Southwest Virginia Chihuahua owner accounts."
      />
    );
  }

  if (!isAdmin) {
    return (
      <AdminRestrictedState
        title="This settings workspace is limited to approved owner accounts."
        details="Only the approved owner emails can review the current admin system configuration."
      />
    );
  }

  return (
    <AdminPageShell>
      <div className="space-y-5 pb-10">
        <AdminPageHero
          eyebrow="Settings"
          title="System rules, ownership access, and operating assumptions in one place."
          description="This page is intentionally read-first until more configuration tables are introduced. It documents the live admin rules already wired into the app so the system behaves consistently across public, portal, and internal surfaces."
          aside={
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <AdminInfoTile
                label="Approved Admins"
                value={String(adminEmails.length)}
                detail="Only these owner accounts can access the admin workspace."
              />
              <AdminInfoTile
                label="Price Visibility"
                value="Automatic"
                detail="Reserved and completed puppy pricing remains internal while public surfaces hide it."
              />
            </div>
          }
        />

        <AdminPanel
          title="Governance Bench"
          subtitle="This page should document the live operating assumptions behind the breeding hub, not bury them in a scorecard strip."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminInfoTile
              label="Access Control"
              value="Owner-only"
              detail="Portal admin access is limited to approved owner email accounts."
            />
            <AdminInfoTile
              label="Lineage Model"
              value="Active"
              detail="Dams, sires, litters, and puppies are tracked as explicit breeding relationships."
            />
            <AdminInfoTile
              label="Pricing Privacy"
              value="Protected"
              detail="Reserved and completed puppy prices stay internal while public surfaces hide them."
            />
            <AdminInfoTile
              label="Reporting Scope"
              value="Internal"
              detail="Revenue, deposits, and operational analytics remain available to the owner team."
            />
          </div>
        </AdminPanel>

        <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.1fr)_420px]">
          <AdminPanel
            title="Current System Rules"
            subtitle="These are the operational rules the app now uses across admin, portal, and public experiences."
          >
            <div className="space-y-4">
              {SYSTEM_RULES.map((rule) => (
                <div
                  key={rule.title}
                  className="rounded-[22px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-4"
                >
                  <div className="text-sm font-semibold text-[var(--portal-text)]">{rule.title}</div>
                  <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{rule.detail}</div>
                </div>
              ))}
            </div>
          </AdminPanel>

          <div className="space-y-5">
            <AdminPanel
              title="Approved Owner Emails"
              subtitle="These accounts can access the internal breeder operations system."
            >
              <div className="space-y-3">
                {adminEmails.map((email) => (
                  <div
                    key={email}
                    className="rounded-[20px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--portal-text)]"
                  >
                    {email}
                  </div>
                ))}
              </div>
            </AdminPanel>

            <AdminPanel
              title="Config Roadmap"
              subtitle="Controls that need dedicated settings tables before they should become editable."
            >
              <div className="space-y-3">
                {[
                  "Public pricing policy overrides",
                  "Automated litter status transitions",
                  "Document retention policies",
                  "Transport fee defaults",
                ].map((label) => (
                  <button
                    key={label}
                    type="button"
                    disabled
                    className="flex w-full cursor-not-allowed items-center justify-between rounded-[20px] border border-dashed border-[#d9c2a7] bg-[#fbf3e8] px-4 py-3 text-left text-sm font-semibold text-[var(--portal-text-soft)]"
                  >
                    <span>{label}</span>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[#b28a61]">
                      Backing table needed
                    </span>
                  </button>
                ))}
              </div>
            </AdminPanel>
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}

