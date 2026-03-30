"use client";

import React, { useState } from "react";
import { KeyRound, Layers3, MailCheck, ShieldCheck, Sparkles } from "lucide-react";
import { sb } from "@/lib/utils";
import {
  PortalActionLink,
  PortalButton,
  PortalEmptyState,
  PortalField,
  PortalHeroPrimaryAction,
  PortalInfoTile,
  PortalInput,
  PortalNarrativeCard,
} from "@/components/portal/luxury-shell";

type AuthMode = "signin" | "signup" | "reset";

export function PortalAccessExperience() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [working, setWorking] = useState(false);
  const [statusText, setStatusText] = useState("");

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setStatusText("");

    const { error } = await sb.auth.signInWithPassword({ email, password });
    setWorking(false);
    setStatusText(error ? error.message : "Signed in.");
  }

  async function handleSignUp(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setStatusText("");

    const { error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          name: fullName,
        },
      },
    });

    setWorking(false);
    setStatusText(
      error
        ? error.message
        : "Account created. Check your email to confirm access."
    );
  }

  async function handleReset(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setStatusText("");

    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo:
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : undefined,
    });

    setWorking(false);
    setStatusText(error ? error.message : "Password reset email sent.");
  }

  return (
    <div className="grid min-h-[82vh] grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <PortalNarrativeCard
        eyebrow="My Puppy Portal"
        title="View your puppy profile, updates, documents, payments, messages, and next steps in one place."
        description="Sign in with the email tied to your records. Once your account is linked, the portal pulls in the pages, files, milestones, and account details already connected to your puppy journey."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <PortalInfoTile
            label="Overview"
            value="Account status"
            detail="Surface the latest updates, open items, and upcoming steps without searching through messages."
          />
          <PortalInfoTile
            label="My Puppy"
            value="Profile and progress"
            detail="Open photos, weights, milestones, care records, and breeder notes in one focused page."
          />
          <PortalInfoTile
            label="Documents"
            value="Records that matter"
            detail="Keep forms, signatures, submitted paperwork, and breeder files easy to review."
          />
          <PortalInfoTile
            label="ChiChi"
            value="Account-aware AI"
            detail="Ask questions about your portal and next steps without losing the conversation context."
          />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <PortalActionLink
            href="/portal/mypuppy"
            eyebrow="My Puppy"
            title="Open the puppy profile"
            detail="View the page where photos, timeline, wellness, and progress come together."
          />
          <PortalActionLink
            href="/portal/payments"
            eyebrow="Payments"
            title="Review account details"
            detail="See balance, financing, and payment history in a calmer, cleaner layout."
          />
          <PortalActionLink
            href="/portal/documents"
            eyebrow="Documents"
            title="Keep records organized"
            detail="Track what has been submitted, signed, or shared without a cluttered file dump."
          />
        </div>
      </PortalNarrativeCard>

      <section className="relative overflow-hidden rounded-[32px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(246,250,255,0.94)_100%)] p-7 shadow-[0_24px_56px_rgba(23,35,56,0.08)] md:p-9">
        <div className="pointer-events-none absolute inset-0 portal-grid-bg opacity-50" />
        <div className="pointer-events-none absolute -right-8 top-0 h-36 w-36 rounded-full bg-[rgba(93,121,255,0.12)] blur-3xl" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--portal-border)] bg-[rgba(255,255,255,0.84)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--portal-text-muted)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--portal-accent-strong)]" />
            Access
          </div>

          <h2 className="mt-5 text-[2.4rem] font-semibold leading-[0.94] tracking-[-0.05em] text-[var(--portal-text)]">
            {mode === "signin"
              ? "Sign in"
              : mode === "signup"
                ? "Create your account"
                : "Reset your password"}
          </h2>

          <p className="mt-4 text-sm leading-7 text-[var(--portal-text-soft)]">
            {mode === "signin"
              ? "Use the email connected to your puppy portal records."
              : mode === "signup"
                ? "Create a secure login so your account can connect to the rest of your portal."
                : "Send a secure reset link to the email already on file."}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-2 rounded-[20px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-1.5">
            {[
              { key: "signin", label: "Sign In", icon: <KeyRound className="h-3.5 w-3.5" /> },
              { key: "signup", label: "Sign Up", icon: <Layers3 className="h-3.5 w-3.5" /> },
              { key: "reset", label: "Reset", icon: <MailCheck className="h-3.5 w-3.5" /> },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setMode(item.key as AuthMode);
                  setStatusText("");
                }}
                className={`inline-flex items-center justify-center gap-2 rounded-[15px] px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${
                  mode === item.key
                    ? "bg-[var(--portal-text)] text-white shadow-[0_10px_22px_rgba(23,35,56,0.14)]"
                    : "text-[var(--portal-text-muted)] hover:text-[var(--portal-text)]"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>

          <form
            onSubmit={(event) => {
              if (mode === "signin") return void handleSignIn(event);
              if (mode === "signup") return void handleSignUp(event);
              return void handleReset(event);
            }}
            className="mt-6 space-y-4"
          >
            {mode === "signup" ? (
              <PortalField label="Full Name">
                <PortalInput value={fullName} onChange={(event) => setFullName(event.target.value)} />
              </PortalField>
            ) : null}

            <PortalField label="Email">
              <PortalInput
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </PortalField>

            {mode !== "reset" ? (
              <PortalField label="Password">
                <PortalInput
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </PortalField>
            ) : null}

            {statusText ? (
              <div className="rounded-[18px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--portal-text-soft)]">
                {statusText}
              </div>
            ) : null}

            <PortalButton type="submit" disabled={working} className="w-full">
              {working
                ? "Working..."
                : mode === "signin"
                  ? "Sign In"
                  : mode === "signup"
                    ? "Create Account"
                    : "Send Reset Email"}
            </PortalButton>
          </form>

          <div className="mt-6 space-y-3">
            <SupportRow
              title="Already linked?"
              detail="Sign in with the same email used for your buyer account or application."
            />
            <SupportRow
              title="Need help connecting records?"
              detail="After signing in, you can use Messages or ChiChi to help verify account details."
            />
          </div>

          <div className="mt-6">
            <PortalEmptyState
              title="First time here?"
              description="Create your account if you have not signed into the portal yet. Once approved and linked, your pages will populate automatically."
              action={<PortalHeroPrimaryAction href="/portal/application">Open Application</PortalHeroPrimaryAction>}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function SupportRow({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-[20px] border border-[var(--portal-border)] bg-[rgba(255,255,255,0.78)] px-4 py-4 shadow-[0_10px_24px_rgba(23,35,56,0.05)]">
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--portal-text)]">
        <ShieldCheck className="h-4 w-4 text-[var(--portal-accent-strong)]" />
        {title}
      </div>
      <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
    </div>
  );
}
