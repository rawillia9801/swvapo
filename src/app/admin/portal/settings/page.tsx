"use client";

import React, { useEffect, useState } from "react";
import {
  AdminInfoTile,
  AdminPageShell,
  AdminPanel,
  AdminRestrictedState,
} from "@/components/admin/luxury-admin-shell";
import { getPortalAdminEmails } from "@/lib/portal-admin";
import { usePortalAdminSession } from "@/lib/use-portal-admin-session";

type ZohoPaymentsStatus = {
  ok: boolean;
  provider: string;
  connected: boolean;
  configured: boolean;
  connection_source: "database" | "env" | "none";
  oauth_ready: boolean;
  missing_oauth_env: string[];
  account_id: string | null;
  soid: string | null;
  scope: string | null;
  connected_at: string | null;
  connected_by_email: string | null;
  api_domain: string | null;
  token_type: string | null;
  has_widget_key: boolean;
  has_signing_key: boolean;
  has_return_url: boolean;
  redirect_uri: string | null;
  post_connect_redirect: string | null;
  message?: string;
};

const primaryButtonClass =
  "inline-flex items-center justify-center rounded-full bg-[linear-gradient(90deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--portal-shadow-md)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-full border border-[var(--portal-border-strong)] bg-white px-5 py-3 text-sm font-semibold text-[var(--portal-text)] shadow-[var(--portal-shadow-sm)] transition hover:border-[var(--portal-accent)] hover:text-[var(--portal-accent)] disabled:cursor-not-allowed disabled:opacity-60";

function formatDateTime(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Not yet connected";

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return normalized;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function FlashBanner({
  tone,
  message,
}: {
  tone: "success" | "warning" | "danger";
  message: string;
}) {
  const toneClass =
    tone === "success"
      ? "border-[rgba(47,143,103,0.18)] bg-[linear-gradient(180deg,rgba(246,253,249,0.98)_0%,rgba(240,249,245,0.94)_100%)] text-[#2f7657]"
      : tone === "warning"
        ? "border-[rgba(186,130,67,0.2)] bg-[linear-gradient(180deg,rgba(255,248,239,0.98)_0%,rgba(252,242,228,0.94)_100%)] text-[#8b6438]"
        : "border-[rgba(194,84,114,0.16)] bg-[linear-gradient(180deg,rgba(255,249,251,0.98)_0%,rgba(255,242,246,0.94)_100%)] text-[#aa4f68]";

  return (
    <div className={`rounded-[20px] border px-4 py-3 text-sm font-semibold ${toneClass}`}>
      {message}
    </div>
  );
}

export default function AdminPortalSettingsPage() {
  const { user, loading, isAdmin, accessToken } = usePortalAdminSession();
  const adminEmails = getPortalAdminEmails();
  const [zohoStatus, setZohoStatus] = useState<ZohoPaymentsStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [flashTone, setFlashTone] = useState<"success" | "warning" | "danger" | "">("");
  const [flashMessage, setFlashMessage] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const result = params.get("zoho_payments");
    const message = params.get("message");

    if (result === "connected") {
      setFlashTone("success");
      setFlashMessage("Zoho Payments is connected and ready for server-side payment collection.");
    } else if (result === "error") {
      setFlashTone("danger");
      setFlashMessage(message || "Zoho Payments could not be connected.");
    }

    if (result || message) {
      params.delete("zoho_payments");
      params.delete("message");
      const nextQuery = params.toString();
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
      window.history.replaceState({}, "", nextUrl);
    }
  }, []);

  useEffect(() => {
    if (!accessToken || !isAdmin) {
      setStatusLoading(false);
      return;
    }

    let active = true;

    async function loadStatus() {
      setStatusLoading(true);
      setStatusError("");

      try {
        const response = await fetch("/api/admin/portal/zoho-payments", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const payload = (await response.json()) as ZohoPaymentsStatus & {
          message?: string;
        };

        if (!response.ok || !payload.ok) {
          throw new Error(payload.message || "Could not load Zoho Payments status.");
        }

        if (!active) return;
        setZohoStatus(payload);
      } catch (error) {
        if (!active) return;
        setStatusError(
          error instanceof Error ? error.message : "Could not load Zoho Payments status."
        );
      } finally {
        if (active) setStatusLoading(false);
      }
    }

    void loadStatus();

    return () => {
      active = false;
    };
  }, [accessToken, isAdmin]);

  async function refreshStatus() {
    if (!accessToken) return;

    setStatusLoading(true);
    setStatusError("");

    try {
      const response = await fetch("/api/admin/portal/zoho-payments", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const payload = (await response.json()) as ZohoPaymentsStatus & {
        message?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "Could not refresh Zoho Payments status.");
      }

      setZohoStatus(payload);
    } catch (error) {
      setStatusError(
        error instanceof Error ? error.message : "Could not refresh Zoho Payments status."
      );
    } finally {
      setStatusLoading(false);
    }
  }

  async function startZohoConnect() {
    if (!accessToken) {
      setActionError("Please sign in again before connecting Zoho Payments.");
      return;
    }

    setActionBusy(true);
    setActionError("");

    try {
      const response = await fetch("/api/zoho/payments/start", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        url?: string;
        message?: string;
      };

      if (!response.ok || !payload.ok || !payload.url) {
        throw new Error(payload.message || "Could not start the Zoho Payments OAuth flow.");
      }

      window.location.assign(payload.url);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not start the Zoho Payments OAuth flow."
      );
      setActionBusy(false);
    }
  }

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

  const connectionLabel = !zohoStatus
    ? "Checking"
    : zohoStatus.connected
      ? zohoStatus.connection_source === "database"
        ? "Durable"
        : "Env only"
      : "Not connected";

  return (
    <AdminPageShell>
      <div className="space-y-5 pb-10">
        {flashTone && flashMessage ? (
          <FlashBanner tone={flashTone} message={flashMessage} />
        ) : null}

        {actionError ? <FlashBanner tone="danger" message={actionError} /> : null}
        {statusError ? <FlashBanner tone="danger" message={statusError} /> : null}

        <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1.15fr)_420px]">
          <AdminPanel
            title="Zoho Payments"
            subtitle="OAuth connection, durable refresh-token storage, customer checkout routing, and signature verification all live here now."
            action={
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={statusLoading}
                  onClick={() => void refreshStatus()}
                >
                  {statusLoading ? "Refreshing..." : "Refresh Status"}
                </button>
                <button
                  type="button"
                  className={primaryButtonClass}
                  disabled={
                    actionBusy ||
                    statusLoading ||
                    Boolean(zohoStatus && !zohoStatus.oauth_ready)
                  }
                  onClick={() => void startZohoConnect()}
                >
                  {actionBusy
                    ? "Opening Zoho..."
                    : zohoStatus?.connected
                      ? "Reconnect Zoho"
                      : "Connect Zoho"}
                </button>
              </div>
            }
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <AdminInfoTile
                label="Connection"
                value={connectionLabel}
                detail={
                  zohoStatus?.connected
                    ? zohoStatus.connection_source === "database"
                      ? "Refresh token is stored in the server-side integration table."
                      : "Live requests are still relying on an environment refresh token."
                    : "Zoho has not been connected yet."
                }
              />
              <AdminInfoTile
                label="Runtime Ready"
                value={zohoStatus?.configured ? "Ready" : "Needs setup"}
                detail="This reflects whether ChiChi and the customer portal can make live Zoho API calls right now."
              />
              <AdminInfoTile
                label="Account ID"
                value={zohoStatus?.account_id || "Unknown"}
                detail={zohoStatus?.soid ? `SOID: ${zohoStatus.soid}` : "Waiting for SOID or account id configuration."}
              />
              <AdminInfoTile
                label="Connected On"
                value={formatDateTime(zohoStatus?.connected_at)}
                detail={
                  zohoStatus?.connected_by_email
                    ? `Connected by ${zohoStatus.connected_by_email}.`
                    : "No owner connection has been recorded yet."
                }
              />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
                  Integration Readiness
                </div>
                <div className="mt-3 space-y-3 text-sm leading-6 text-[var(--portal-text-soft)]">
                  <div>
                    OAuth redirect:
                    <div className="mt-1 font-semibold text-[var(--portal-text)]">
                      {zohoStatus?.redirect_uri || "Not configured"}
                    </div>
                  </div>
                  <div>
                    Post-connect redirect:
                    <div className="mt-1 font-semibold text-[var(--portal-text)]">
                      {zohoStatus?.post_connect_redirect || "Not configured"}
                    </div>
                  </div>
                  <div>
                    Scope:
                    <div className="mt-1 font-semibold text-[var(--portal-text)]">
                      {zohoStatus?.scope || "Not configured"}
                    </div>
                  </div>
                  <div>
                    Widget key:
                    <span className="ml-2 font-semibold text-[var(--portal-text)]">
                      {zohoStatus?.has_widget_key ? "Configured" : "Missing"}
                    </span>
                  </div>
                  <div>
                    Signing key:
                    <span className="ml-2 font-semibold text-[var(--portal-text)]">
                      {zohoStatus?.has_signing_key ? "Configured" : "Missing"}
                    </span>
                  </div>
                  <div>
                    Customer return URL:
                    <span className="ml-2 font-semibold text-[var(--portal-text)]">
                      {zohoStatus?.has_return_url ? "Configured" : "Using per-link return URLs"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--portal-text-muted)]">
                  Owner Checklist
                </div>
                <div className="mt-3 space-y-3 text-sm leading-6 text-[var(--portal-text-soft)]">
                  {zohoStatus?.missing_oauth_env?.length ? (
                    <div className="rounded-[1rem] border border-[rgba(186,130,67,0.2)] bg-[#fff8ef] px-3 py-3 text-[#8b6438]">
                      Missing OAuth env values: {zohoStatus.missing_oauth_env.join(", ")}
                    </div>
                  ) : (
                    <div className="rounded-[1rem] border border-[rgba(47,143,103,0.18)] bg-[#f6fdf9] px-3 py-3 text-[#2f7657]">
                      OAuth env values are in place and ready for connection.
                    </div>
                  )}

                  <div>
                    Durable storage:
                    <span className="ml-2 font-semibold text-[var(--portal-text)]">
                      {zohoStatus?.connection_source === "database"
                        ? "Active"
                        : "Refresh token not yet stored in Supabase"}
                    </span>
                  </div>
                  <div>
                    Live portal collection:
                    <span className="ml-2 font-semibold text-[var(--portal-text)]">
                      {zohoStatus?.configured ? "Enabled" : "Blocked until connection is complete"}
                    </span>
                  </div>
                  <div>
                    ChiChi admin actions:
                    <span className="ml-2 font-semibold text-[var(--portal-text)]">
                      {zohoStatus?.configured ? "Ready to create live Zoho links" : "Still waiting on runtime readiness"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </AdminPanel>

          <div className="space-y-5">
            <AdminPanel
              title="Approved Owner Emails"
              subtitle="These accounts can initiate or review the Zoho Payments connection flow."
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
              title="Integration Notes"
              subtitle="This is the current operating model for Zoho inside the breeding hub."
            >
              <div className="space-y-3 text-sm leading-6 text-[var(--portal-text-soft)]">
                <div className="rounded-[20px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3">
                  Customer card or bank details never pass through ChiChi. She creates hosted Zoho payment links and the customer completes payment inside Zoho.
                </div>
                <div className="rounded-[20px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3">
                  The portal now supports deposits, installment payments, and transportation charges through the same verified Zoho return flow.
                </div>
                <div className="rounded-[20px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3">
                  Durable refresh-token storage is the right long-term approach for this app. If you later want stricter secret management, the next hardening step would be a dedicated secrets manager or KMS-backed encryption.
                </div>
              </div>
            </AdminPanel>
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}
