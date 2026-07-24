"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { sb } from "@/lib/utils";
import {
  PortalButton,
  PortalField,
  PortalInput,
  PortalNarrativeCard,
  portalButtonSecondaryClass,
} from "@/components/portal/luxury-shell";

type RecoveryState = "checking" | "ready" | "saved" | "invalid";

export default function ResetPasswordPage() {
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function checkRecoverySession() {
      const { data } = await sb.auth.getSession();
      if (!active) return;
      setRecoveryState(data.session ? "ready" : "invalid");
    }

    void checkRecoverySession();

    const { data: listener } = sb.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setRecoveryState("ready");
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (password.length < 8) {
      setMessage("Use at least 8 characters for your new password.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("The two password entries do not match.");
      return;
    }

    setWorking(true);
    const { error } = await sb.auth.updateUser({ password });
    setWorking(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setRecoveryState("saved");
    setPassword("");
    setConfirmPassword("");
  }

  return (
    <main className="portal-grid-bg min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <PortalNarrativeCard
          eyebrow="Secure portal access"
          title="Choose a new password for your Puppy Portal."
          description="The reset link from your email opens a short-lived secure session. Your buyer, puppy, payment, and document records remain connected to the same account."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <SecurityNote
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Private by design"
              detail="Only the authenticated account can change its password."
            />
            <SecurityNote
              icon={<KeyRound className="h-4 w-4" />}
              title="One account"
              detail="Continue using the email already connected to your buyer record."
            />
          </div>
        </PortalNarrativeCard>

        <section className="premium-card rounded-[1.5rem] p-6 md:p-8">
          {recoveryState === "checking" ? (
            <div className="flex min-h-72 items-center justify-center text-sm font-semibold text-[var(--portal-text-soft)]">
              <Loader2 className="mr-3 h-5 w-5 animate-spin text-[var(--portal-accent)]" />
              Verifying your reset link…
            </div>
          ) : null}

          {recoveryState === "invalid" ? (
            <div className="flex min-h-72 flex-col justify-center">
              <div className="portal-kicker">Reset link required</div>
              <h1 className="mt-3 font-serif text-3xl font-bold tracking-[-0.04em] text-[var(--portal-accent-deep)]">
                This reset link is missing or expired.
              </h1>
              <p className="mt-4 text-sm leading-7 text-[var(--portal-text-soft)]">
                Return to the portal sign-in screen and request a new password
                reset email.
              </p>
              <Link
                href="/portal"
                className="mt-6 inline-flex w-fit items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--portal-shadow-md)]"
              >
                Return to portal access
              </Link>
            </div>
          ) : null}

          {recoveryState === "ready" ? (
            <form onSubmit={savePassword}>
              <div className="portal-kicker">Create new password</div>
              <h1 className="mt-3 font-serif text-3xl font-bold tracking-[-0.04em] text-[var(--portal-accent-deep)]">
                Restore your portal access.
              </h1>
              <p className="mt-3 text-sm leading-7 text-[var(--portal-text-soft)]">
                Use at least 8 characters, then sign in with your updated
                password.
              </p>

              <div className="mt-7 space-y-4">
                <PortalField label="New password">
                  <PortalInput
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={8}
                    autoComplete="new-password"
                    required
                  />
                </PortalField>
                <PortalField label="Confirm new password">
                  <PortalInput
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    minLength={8}
                    autoComplete="new-password"
                    required
                  />
                </PortalField>
              </div>

              {message ? (
                <div
                  role="alert"
                  className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
                >
                  {message}
                </div>
              ) : null}

              <PortalButton
                type="submit"
                disabled={working}
                className="mt-6 w-full"
              >
                {working ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                {working ? "Saving password…" : "Save new password"}
              </PortalButton>
            </form>
          ) : null}

          {recoveryState === "saved" ? (
            <div className="flex min-h-72 flex-col justify-center">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h1 className="mt-5 font-serif text-3xl font-bold tracking-[-0.04em] text-[var(--portal-accent-deep)]">
                Your password is updated.
              </h1>
              <p className="mt-3 text-sm leading-7 text-[var(--portal-text-soft)]">
                Your secure session is active. Continue to the Puppy Portal.
              </p>
              <Link
                href="/portal"
                className={`${portalButtonSecondaryClass} mt-6 w-full`}
              >
                Open Puppy Portal
              </Link>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function SecurityNote({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-white/78 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--portal-text)]">
        <span className="text-[var(--portal-accent)]">{icon}</span>
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">
        {detail}
      </p>
    </div>
  );
}
