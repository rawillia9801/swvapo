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
      error ? error.message : "Account created. Check your email to confirm access."
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
    <div className="grid min-h-[82vh] grid-cols-1 gap-6 xl:grid-cols-[1.18fr_0.82fr]">
      <PortalNarrativeCard
        eyebrow="My Puppy Portal"
        title="View updates, records, documents, payments, and next steps from one place."
        description="Sign in with the email connected to your puppy portal records. Once your account is linked, the portal pulls together the details already connected to your application, puppy profile, and buyer record."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <PortalInfoTile
            label="Overview"
            value="Latest account details"
            detail="See what has been updated, what needs attention, and what comes next without searching page by page."
          />
          <PortalInfoTile
            label="My Puppy"
            value="Photos and progress"
            detail="Open the puppy profile, milestone updates, and breeder notes from one focused page."
          />
          <PortalInfoTile
            label="Documents"
            value="Forms and records"
            detail="Review signed forms, breeder files, and required items in a cleaner document workspace."
          />
          <PortalInfoTile
            label="ChiChi"
            value="Portal-aware help"
            detail="Ask questions about the records already linked to your portal account."
          />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <PortalActionLink
            href="/portal/mypuppy"
            eyebrow="My Puppy"
            title="Open the puppy profile"
            detail="Review photos, milestones, wellness updates, and the most recent breeder notes."
          />
          <PortalActionLink
            href="/portal/payments"
            eyebrow="Payments"
            title="Review account details"
            detail="Check balance, financing, due dates, and payment history in one place."
          />
          <PortalActionLink
            href="/portal/documents"
            eyebrow="Documents"
            title="Keep records organized"
            detail="Find forms, signatures, and breeder-shared files without a cluttered file dump."
          />
        </div>
      </PortalNarrativeCard>

      <section className="premium-card relative overflow-hidden rounded-[1.5rem] p-7 md:p-9">
        <div className="pointer-events-none absolute inset-0 hero-glow opacity-75" />
        <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-violet-100/70 blur-3xl" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--portal-border)] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--portal-text-muted)] shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-[var(--portal-accent)]" />
            Access
          </div>

          <h2 className="mt-5 text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] text-[var(--portal-accent)]">
            {mode === "signin"
              ? "Sign in"
              : mode === "signup"
                ? "Create your account"
                : "Reset your password"}
          </h2>

          <p className="mt-4 text-sm leading-7 text-[var(--portal-text-soft)]">
            {mode === "signin"
              ? "Use the email already connected to your portal record."
              : mode === "signup"
                ? "Create a secure login so your account can connect to your portal pages."
                : "Send a secure reset link to the email already on file."}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-2 rounded-[1.35rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] p-1.5">
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
                className={`inline-flex items-center justify-center gap-2 rounded-[1rem] px-3 py-3 text-[11px] font-bold uppercase tracking-[0.16em] transition ${
                  mode === item.key
                    ? "bg-[linear-gradient(90deg,#7c5cff_0%,#f043a2_100%)] text-white shadow-lg"
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
              <div className="rounded-[1.25rem] border border-[var(--portal-border)] bg-[var(--portal-surface-muted)] px-4 py-3 text-sm font-medium text-[var(--portal-text-soft)]">
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
              detail="After signing in, use Messages or ChiChi if you need help verifying account details."
            />
          </div>

          <div className="mt-6">
            <PortalEmptyState
              title="First time here?"
              description="Create your account if you have not signed into the portal yet. Once approved and linked, your pages will populate automatically."
              action={
                <PortalHeroPrimaryAction href="/portal/application">
                  Open Application
                </PortalHeroPrimaryAction>
              }
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
    <div className="rounded-[1.35rem] border border-[var(--portal-border)] bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--portal-text)]">
        <ShieldCheck className="h-4 w-4 text-[var(--portal-accent)]" />
        {title}
      </div>
      <div className="mt-2 text-sm leading-6 text-[var(--portal-text-soft)]">{detail}</div>
    </div>
  );
}
