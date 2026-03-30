"use client";

import React, { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  CalendarDays,
  CreditCard,
  FileText,
  MessageCircle,
} from "lucide-react";
import { buildPuppyPhotoUrl, fmtDate, fmtMoney, sb } from "@/lib/utils";
import {
  findBuyerPayments,
  findFormSubmissionsForUser,
  findHealthRecords,
  findPortalDocumentsForUser,
  findPortalMessagesForUser,
  findPuppyEvents,
  loadPortalContext,
  paymentCountsTowardBalance,
  portalDisplayName,
  portalPuppyName,
  portalStatusTone,
  type PortalApplication,
  type PortalBuyer,
  type PortalDocument,
  type PortalFormSubmission,
  type PortalHealthRecord,
  type PortalMessage,
  type PortalPayment,
  type PortalPuppy,
  type PortalPuppyEvent,
} from "@/lib/portal-data";
import {
  PortalEmptyState,
  PortalField,
  PortalHeroPrimaryAction,
  PortalHeroSecondaryAction,
  PortalInfoTile,
  PortalInput,
  PortalLoadingState,
  PortalMetricCard,
  PortalMetricGrid,
  PortalPageHero,
  PortalPanel,
  PortalStatusBadge,
} from "@/components/portal/luxury-shell";

type DashboardState = {
  buyer: PortalBuyer | null;
  application: PortalApplication | null;
  puppy: PortalPuppy | null;
  messages: PortalMessage[];
  events: PortalPuppyEvent[];
  health: PortalHealthRecord[];
  forms: PortalFormSubmission[];
  documents: PortalDocument[];
  payments: PortalPayment[];
};

type AuthMode = "signin" | "signup" | "reset";

function emptyDashboardState(): DashboardState {
  return {
    buyer: null,
    application: null,
    puppy: null,
    messages: [],
    events: [],
    health: [],
    forms: [],
    documents: [],
    payments: [],
  };
}

export default function PortalPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState("");
  const [data, setData] = useState<DashboardState>(emptyDashboardState);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const {
          data: { session },
        } = await sb.auth.getSession();

        if (!mounted) return;
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          await loadDashboard(currentUser);
        } else {
          setData(emptyDashboardState());
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void bootstrap();

    const { data: authListener } = sb.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      if (!mounted) return;

      setUser(currentUser);
      if (currentUser) {
        await loadDashboard(currentUser);
      } else {
        setData(emptyDashboardState());
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function loadDashboard(currentUser: User) {
    setStatusText("Loading your portal dashboard...");

    const context = await loadPortalContext(currentUser);
    const [messages, events, health, forms, documents, payments] = await Promise.all([
      findPortalMessagesForUser(currentUser, 4),
      findPuppyEvents(context.puppy?.id),
      findHealthRecords(context.puppy?.id),
      findFormSubmissionsForUser(currentUser),
      findPortalDocumentsForUser(currentUser, context.buyer),
      findBuyerPayments(context.buyer?.id),
    ]);

    setData({
      buyer: context.buyer,
      application: context.application,
      puppy: context.puppy,
      messages,
      events,
      health,
      forms,
      documents,
      payments,
    });
    setStatusText("");
  }

  if (loading) {
    return <PortalLoadingState label="Loading your portal..." />;
  }

  if (!user) {
    return <PortalAccessExperience />;
  }

  const displayName = portalDisplayName(user, data.buyer, data.application);
  const puppyName = portalPuppyName(data.puppy);
  const totalPaid = data.payments
    .filter((payment) => paymentCountsTowardBalance(payment.status))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const listedPrice =
    data.buyer?.sale_price ?? data.puppy?.price ?? null;
  const remainingBalance =
    listedPrice !== null && listedPrice !== undefined
      ? Math.max(0, Number(listedPrice) - totalPaid)
      : data.puppy?.balance ?? null;

  const unreadMessages = data.messages.filter(
    (message) => message.sender === "admin" && !message.read_by_user
  ).length;

  const timeline = [...data.events, ...data.health]
    .map((item) => {
      const isHealth = "record_type" in item;
      return {
        id: `${isHealth ? "health" : "event"}-${item.id}`,
        date: isHealth ? item.record_date : item.event_date,
        title: isHealth ? item.title : item.title || item.label || "Breeder update",
        detail: isHealth
          ? item.description || "A wellness update has been added to your account."
          : item.summary || item.details || "A breeder update has been added to your puppy journey.",
        tone: isHealth ? "success" : "neutral",
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 4);

  const quickActions = [
    {
      label: "Application",
      value: data.application?.status || "Not started",
      detail: data.application?.created_at ? `Submitted ${fmtDate(data.application.created_at)}` : "Open your application and keep details current.",
      href: "/portal/application",
      actionLabel: "Open Application",
      tone: portalStatusTone(data.application?.status),
    },
    {
      label: "Pupdates",
      value: data.events[0]?.title || data.health[0]?.title || "No recent update",
      detail: timeline[0]?.detail || "Breeder notes, wellness records, and milestones appear here as they are published.",
      href: "/portal/updates",
      actionLabel: "Open Pupdates",
      tone: "neutral" as const,
    },
    {
      label: "Payments",
      value: remainingBalance !== null ? fmtMoney(remainingBalance) : "No balance shown",
      detail: data.payments.length ? `${data.payments.length} recorded payment${data.payments.length === 1 ? "" : "s"}` : "Payment history and financing details stay here.",
      href: "/portal/payments",
      actionLabel: "Open Payments",
      tone: remainingBalance && remainingBalance > 0 ? "warning" : "success",
    },
    {
      label: "My Puppy",
      value: data.puppy ? puppyName : "Waiting for Match",
      detail: data.puppy ? "Profile, growth, milestones, and breeder guidance." : "Your matched puppy profile will appear here once assigned.",
      href: "/portal/mypuppy",
      actionLabel: "Open My Puppy",
      tone: data.puppy ? "success" : "warning",
    },
  ];

  const photoUrl =
    buildPuppyPhotoUrl(data.puppy?.image_url || data.puppy?.photo_url || "") ||
    "https://images.unsplash.com/photo-1591769225440-811ad7d6eca6?auto=format&fit=crop&w=1200&q=80";

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Overview"
        title="Welcome to your Puppy Portal"
        description="A clear, private place to follow your puppy journey, review your account, stay on top of payments and documents, and keep breeder communication easy to follow."
        actions={
          <>
            <PortalHeroPrimaryAction href={data.puppy ? "/portal/mypuppy" : "/portal/application"}>
              {data.puppy ? "Open My Puppy" : "Open Application"}
            </PortalHeroPrimaryAction>
            <PortalHeroSecondaryAction href="/portal/messages">Open Messages</PortalHeroSecondaryAction>
          </>
        }
        aside={
          <div className="overflow-hidden rounded-[30px] border border-[#eadccf] bg-white shadow-[0_18px_42px_rgba(96,67,38,0.08)]">
            <div
              className="h-44 w-full bg-cover bg-center"
              style={{ backgroundImage: `url('${photoUrl}')` }}
            />
            <div className="p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a17848]">
                Current Focus
              </div>
              <div className="mt-2 text-xl font-semibold text-[#2f2218]">
                {data.puppy ? `${puppyName}'s journey` : "Your portal setup"}
              </div>
              <div className="mt-2 text-sm leading-6 text-[#72553c]">
                {data.puppy
                  ? "Track milestones, health notes, growth, and the next important steps for your puppy."
                  : "Application progress, breeder communication, and your next actions stay organized here."}
              </div>
            </div>
          </div>
        }
      />

      {statusText ? <div className="text-sm font-semibold text-[#7b5f46]">{statusText}</div> : null}

      <PortalMetricGrid>
        {quickActions.map((card) => (
          <PortalMetricCard
            key={card.label}
            label={card.label}
            value={card.value}
            detail={card.detail}
            href={card.href}
            actionLabel={card.actionLabel}
          />
        ))}
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.08fr)_380px]">
        <div className="space-y-6">
          <PortalPanel
            title="Journey Timeline"
            subtitle="A single feed for breeder notes, health records, and the latest published activity tied to your account."
          >
            <div className="space-y-4">
              {timeline.length ? (
                timeline.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[24px] border border-[#eadccf] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(96,67,38,0.05)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[#2f2218]">{item.title}</div>
                        <div className="mt-1 text-sm leading-6 text-[#72553c]">{item.detail}</div>
                      </div>
                      <PortalStatusBadge
                        label={fmtDate(item.date)}
                        tone={item.tone === "success" ? "success" : "neutral"}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <PortalEmptyState
                  title="No published updates yet"
                  description="When breeder notes, health records, or milestone updates are ready for you, they will appear here automatically."
                />
              )}
            </div>
          </PortalPanel>

          <PortalPanel
            title="Recent Messages"
            subtitle="Keep your breeder communication in one place instead of searching through texts and emails."
            actionHref="/portal/messages"
            actionLabel="Open Messages"
          >
            <div className="space-y-4">
              {data.messages.length ? (
                data.messages.map((message) => (
                  <div
                    key={message.id}
                    className="rounded-[24px] border border-[#eadccf] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(96,67,38,0.05)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-[#2f2218]">
                            {message.subject || (message.sender === "admin" ? "Breeder message" : "Your message")}
                          </div>
                          <PortalStatusBadge
                            label={message.sender === "admin" ? "Breeder" : "You"}
                            tone={message.sender === "admin" ? "success" : "neutral"}
                          />
                        </div>
                        <div className="mt-2 line-clamp-3 text-sm leading-6 text-[#72553c]">
                          {message.message || "Message content not available."}
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-[#8d6c4b]">
                        {fmtDate(message.created_at)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <PortalEmptyState
                  title="No portal messages yet"
                  description="Once you or the breeder send messages through the portal, the conversation history will show here."
                />
              )}
            </div>
          </PortalPanel>
        </div>

        <div className="space-y-6">
          <PortalPanel title="Account Snapshot" subtitle="A clean summary of the details families reference most often.">
            <div className="space-y-4">
              <PortalInfoTile
                label="Family"
                value={displayName}
                detail={data.buyer?.email || user.email || "Your portal account is active."}
              />
              <PortalInfoTile
                label="Application Status"
                value={data.application?.status || "Not started"}
                detail={
                  data.application?.created_at
                    ? `Submitted ${fmtDate(data.application.created_at)}`
                    : "Start your application when you are ready."
                }
                tone={portalStatusTone(data.application?.status)}
              />
              <PortalInfoTile
                label="My Puppy"
                value={data.puppy ? puppyName : "Waiting for Match"}
                detail={
                  data.puppy
                    ? "Your matched puppy profile is live."
                    : "Your puppy profile will appear here after assignment."
                }
                tone={data.puppy ? "success" : "warning"}
              />
              <PortalInfoTile
                label="Unread Messages"
                value={String(unreadMessages)}
                detail="New breeder replies still waiting for review."
                tone={unreadMessages ? "warning" : "neutral"}
              />
            </div>
          </PortalPanel>

          <PortalPanel title="Useful Shortcuts" subtitle="Keep the most important account areas one click away.">
            <div className="grid gap-4">
              <ShortcutCard
                href="/portal/documents"
                icon={<FileText className="h-4 w-4" />}
                title="Documents"
                detail={`${data.forms.length + data.documents.length} records available to review`}
              />
              <ShortcutCard
                href="/portal/payments"
                icon={<CreditCard className="h-4 w-4" />}
                title="Payments"
                detail={remainingBalance !== null ? `${fmtMoney(remainingBalance)} remaining` : "Open your financial summary"}
              />
              <ShortcutCard
                href="/portal/updates"
                icon={<CalendarDays className="h-4 w-4" />}
                title="Pupdates"
                detail={timeline[0]?.title || "See the latest breeder and health updates"}
              />
              <ShortcutCard
                href="/portal/messages"
                icon={<MessageCircle className="h-4 w-4" />}
                title="Messages"
                detail={data.messages.length ? `${data.messages.length} saved message${data.messages.length === 1 ? "" : "s"}` : "Start a conversation"}
              />
            </div>
          </PortalPanel>
        </div>
      </section>
    </div>
  );
}

function ShortcutCard({
  href,
  icon,
  title,
  detail,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-4 rounded-[24px] border border-[#eadccf] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(96,67,38,0.05)] transition hover:-translate-y-0.5 hover:border-[#d7b58e]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f7efe5] text-[#a17848]">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[#2f2218]">{title}</div>
        <div className="mt-1 text-sm leading-6 text-[#72553c]">{detail}</div>
      </div>
    </a>
  );
}

function PortalAccessExperience() {
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

    const { error } = await sb.auth.signInWithPassword({
      email,
      password,
    });

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
    <div className="grid min-h-[80vh] grid-cols-1 gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <section className="overflow-hidden rounded-[34px] border border-[#e5d5c5] bg-[linear-gradient(145deg,#fff8f1_0%,#f6ede3_48%,#ecdfd0_100%)] p-7 shadow-[0_26px_70px_rgba(88,63,37,0.10)] md:p-10">
        <div className="inline-flex rounded-full border border-[#e3cfb8] bg-white/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a17848]">
          Private Client Access
        </div>
        <h1 className="mt-8 max-w-3xl font-serif text-5xl font-bold leading-[0.96] text-[#3b271b] md:text-6xl">
          Welcome to your Puppy Portal
        </h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-8 text-[#72553c]">
          A private, beautifully organized place for your application, puppy updates, forms, payment history, breeder communication, and go-home support.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <PortalInfoTile
            label="Organized"
            value="One account view"
            detail="Important details stay together instead of scattered across text messages and email."
          />
          <PortalInfoTile
            label="Useful"
            value="Before and after go-home"
            detail="The portal remains helpful while your puppy is growing and after your puppy is home."
          />
          <PortalInfoTile
            label="Clear"
            value="Real updates only"
            detail="Milestones, health notes, breeder communication, and account details stay easy to review."
          />
          <PortalInfoTile
            label="Private"
            value="Secure access"
            detail="Your account keeps documents, payments, and breeder guidance in one secure client space."
          />
        </div>
      </section>

      <section className="rounded-[34px] border border-[#eadccf] bg-white p-7 shadow-[0_24px_70px_rgba(96,67,38,0.08)] md:p-10">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a17848]">
          Portal Access
        </div>
        <h2 className="mt-3 font-serif text-4xl font-bold text-[#2f2218]">
          {mode === "signin" ? "Sign in" : mode === "signup" ? "Create your account" : "Reset your password"}
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
            { key: "signin", label: "Sign In" },
            { key: "signup", label: "Sign Up" },
            { key: "reset", label: "Reset" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setMode(item.key as AuthMode);
                setStatusText("");
              }}
              className={`rounded-[16px] px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                mode === item.key
                  ? "bg-[#6b4d33] text-white shadow-md"
                  : "text-[#a17848] hover:text-[#6b4d33]"
              }`}
            >
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
            <PortalInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </PortalField>

          {mode !== "reset" ? (
            <PortalField label="Password">
              <PortalInput type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </PortalField>
          ) : null}

          {statusText ? (
            <div className="rounded-[18px] border border-[#eadccf] bg-[#fff9f2] px-4 py-3 text-sm font-semibold text-[#72553c]">
              {statusText}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={working}
            className="w-full rounded-2xl bg-[linear-gradient(135deg,#d4a35d_0%,#b77a31_100%)] px-5 py-4 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(183,122,49,0.24)] transition hover:brightness-105 disabled:opacity-60"
          >
            {working
              ? "Working..."
              : mode === "signin"
                ? "Sign In"
                : mode === "signup"
                  ? "Create Account"
                  : "Send Reset Email"}
          </button>
        </form>
      </section>
    </div>
  );
}
