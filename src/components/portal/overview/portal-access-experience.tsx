"use client";

import React, { useState } from "react";
import { HeartHandshake, LockKeyhole, Receipt, Sparkles } from "lucide-react";
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
    <div className="grid min-h-[82vh] grid-cols-1 gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <PortalNarrativeCard
        eyebrow="Private Client Access"
        title="Welcome to My Puppy Portal"
        description="A beautifully organized place for your application, puppy updates, forms, payment history, breeder communication, and go-home support."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <PortalInfoTile
            label="Emotionally centered"
            value="Built around your puppy journey"
            detail="This portal is meant to reassure, guide, and keep your relationship with your puppy at the center."
          />
          <PortalInfoTile
            label="Clear"
            value="One account view"
            detail="Important details stay together instead of being scattered across texts, emails, and documents."
          />
          <PortalInfoTile
            label="Useful"
            value="Before and after go-home"
            detail="The portal stays helpful while your puppy is growing and after your puppy is home."
          />
          <PortalInfoTile
            label="Private"
            value="Secure access"
            detail="Messages, documents, payments, and breeder guidance all live in one protected place."
          />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <PortalActionLink
            href="/portal/mypuppy"
            eyebrow="My Puppy"
            title="Follow the journey"
            detail="Milestones, growth, breeder notes, and wellness updates stay connected."
          />
          <PortalActionLink
            href="/portal/payments"
            eyebrow="Payments"
            title="Review your account"
            detail="Balance, financing, and payment history stay easy to understand."
          />
          <PortalActionLink
            href="/portal/documents"
            eyebrow="Documents"
            title="Keep records tidy"
            detail="Forms, signatures, and shared records stay in one organized place."
          />
        </div>
      </PortalNarrativeCard>

      <section className="rounded-[34px] border border-[#eadccf] bg-[linear-gradient(180deg,#fffdfb_0%,#fbf4ec_100%)] p-7 shadow-[0_24px_70px_rgba(96,67,38,0.08)] md:p-10">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a17848]">
          My Puppy Portal
        </div>
        <h2 className="mt-3 font-serif text-4xl font-bold text-[#2f2218]">
          {mode === "signin"
            ? "Sign in"
            : mode === "signup"
              ? "Create your portal account"
              : "Reset your password"}
        </h2>
        <p className="mt-3 text-sm leading-7 text-[#72553c]">
          {mode === "signin"
            ? "Use the email tied to your portal account to access your puppy journey."
            : mode === "signup"
              ? "Create a portal login so your account, documents, and breeder updates stay connected."
              : "We will email you a secure reset link so you can choose a new password."}
        </p>

        <div className="mt-6 grid grid-cols-3 gap-2 rounded-[20px] border border-[#eadccf] bg-[#fbf6f0] p-1.5">
          {[
            { key: "signin", label: "Sign In", icon: <LockKeyhole className="h-3.5 w-3.5" /> },
            { key: "signup", label: "Sign Up", icon: <Sparkles className="h-3.5 w-3.5" /> },
            { key: "reset", label: "Reset", icon: <HeartHandshake className="h-3.5 w-3.5" /> },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setMode(item.key as AuthMode);
                setStatusText("");
              }}
              className={`inline-flex items-center justify-center gap-2 rounded-[16px] px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                mode === item.key
                  ? "bg-[#6b4d33] text-white shadow-md"
                  : "text-[#a17848] hover:text-[#6b4d33]"
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
            <div className="rounded-[18px] border border-[#eadccf] bg-[#fff9f2] px-4 py-3 text-sm font-semibold text-[#72553c]">
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
            icon={<Receipt className="h-4 w-4" />}
            title="If you already have a portal login"
            detail="Use Sign In with the email tied to your buyer account."
          />
          <SupportRow
            icon={<HeartHandshake className="h-4 w-4" />}
            title="If you need help connecting your account"
            detail="Once you are signed in, Messages and ChiChi can help connect the rest of your records."
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
    <div className="flex items-start gap-3 rounded-[22px] border border-[#eadccf] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(96,67,38,0.05)]">
      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-[#f8efe5] text-[#a17848]">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-[#2f2218]">{title}</div>
        <div className="mt-1 text-sm leading-6 text-[#72553c]">{detail}</div>
      </div>
    </div>
  );
}
