"use client";

import React, { useState } from "react";
import { KeyRound, Layers3, MailCheck, Shield } from "lucide-react";
import { sb } from "@/lib/utils";
import {
  PortalActionLink,
  PortalButton,
  PortalField,
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
        : "Account created. Please check your email to confirm your account."
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
    <div className="grid min-h-[82vh] grid-cols-1 gap-6 xl:grid-cols-[1.12fr_0.88fr]">
      <PortalNarrativeCard
        eyebrow="Portal Access"
        title="View your puppy’s updates, documents, payments, messages, and next steps in one place."
        description="Sign in to open the buyer portal tied to your account. If your records are already linked, your puppy profile, documents, payments, breeder messages, and transportation details appear automatically."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <PortalInfoTile
            label="Overview"
            value="Account clarity"
            detail="See updates, records, payments, and open tasks without digging through email."
          />
          <PortalInfoTile
            label="My Puppy"
            value="Profile and timeline"
            detail="Review photos, milestones, weight history, and breeder notes in one page."
          />
          <PortalInfoTile
            label="Documents"
            value="Forms and records"
            detail="Keep signatures, submissions, and shared files organized and easy to review."
          />
          <PortalInfoTile
            label="Messages"
            value="Direct communication"
            detail="Questions and breeder replies stay connected to your portal account."
          />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <PortalActionLink
            href="/portal/mypuppy"
            eyebrow="My Puppy"
            title="Open the puppy profile"
            detail="Photos, milestones, wellness records, and breeder updates stay together."
          />
          <PortalActionLink
            href="/portal/payments"
            eyebrow="Payments"
            title="Review the account record"
            detail="Check the recorded balance, payment history, financing, and next due date."
          />
          <PortalActionLink
            href="/portal/documents"
            eyebrow="Documents"
            title="Keep records tidy"
            detail="Signed forms, submissions, and shared files remain easy to find."
          />
        </div>
      </PortalNarrativeCard>

      <section className="rounded-[30px] border border-[var(--portal-border)] bg-[linear-gradient(180deg,var(--portal-surface)_0%,var(--portal-surface-strong)_100%)] p-7 shadow-[0_22px_54px_rgba(31,48,79,0.08)] md:p-10">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-text-muted)]">
          My Puppy Portal
        </div>
        <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-[var(--portal-text)]">
          {mode === "signin"
            ? "Sign in"
            : mode === "signup"
              ? "Create your account"
              : "Reset your password"}
        </h2>
        <p className="mt-3 text-sm leading-7 text-[var(--portal-text-soft)]">
          {mode === "signin"
            ? "Use the email connected to your portal records."
            : mode === "signup"
              ? "Create a portal login to access your buyer account and linked puppy records."
              : "We will send a secure reset link to the email on file."}
        </p>

        <div className="mt-6 grid grid-cols-3 gap-2 rounded-[18px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-1.5">
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
              className={`inline-flex items-center justify-center gap-2 rounded-[14px] px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${
                mode === item.key
                  ? "bg-[var(--portal-text)] text-white shadow-[0_10px_22px_rgba(31,48,79,0.14)]"
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
            <div className="rounded-[16px] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--portal-text-soft)]">
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

        <div className="mt-6 grid gap-3">
          <SupportRow
            icon={<Shield className="h-4 w-4" />}
            title="Already have portal access?"
            detail="Sign in with the same email used for your buyer account."
          />
          <SupportRow
            icon={<MailCheck className="h-4 w-4" />}
            title="Need help linking records?"
            detail="After signing in, Messages and ChiChi can help connect the rest of your account."
          />
        </div>
      </section>
    </div>
  );
}

function SupportRow({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[20px] border border-[var(--portal-border)] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(31,48,79,0.05)]">
      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--portal-surface-muted)] text-[var(--portal-accent-strong)]">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-[var(--portal-text)]">{title}</div>
        <div className="mt-1 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
      </div>
    </div>
  );
}
