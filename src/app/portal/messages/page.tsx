"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Mail, RefreshCcw, ShieldCheck, Sparkles } from "lucide-react";
import { fmtDate, sb } from "@/lib/utils";
import { findPortalMessagesForUser, type PortalMessage } from "@/lib/portal-data";
import { usePortalSession } from "@/hooks/use-portal-session";
import {
  PortalButton,
  PortalEmptyState,
  PortalErrorState,
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
  PortalSecondaryButton,
  PortalStatusBadge,
  PortalTextarea,
} from "@/components/portal/luxury-shell";

function groupMessagesByDate(messages: PortalMessage[]) {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const groups: Array<{ key: string; items: PortalMessage[] }> = [];

  sorted.forEach((message) => {
    const key = new Date(message.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const last = groups[groups.length - 1];
    if (!last || last.key !== key) {
      groups.push({ key, items: [message] });
      return;
    }

    last.items.push(message);
  });

  return groups;
}

export default function PortalMessagesPage() {
  const { user, loading: sessionLoading } = usePortalSession();
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [statusText, setStatusText] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPage() {
      if (!user) {
        setMessages([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorText("");

      try {
        const portalMessages = await findPortalMessagesForUser(user, 100);
        if (!active) return;
        setMessages(portalMessages);
      } catch (error) {
        console.error("Could not load portal messages:", error);
        if (!active) return;
        setErrorText(
          "We could not load your message history right now. Please refresh or try again in a moment."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPage();

    return () => {
      active = false;
    };
  }, [user]);

  const groupedMessages = useMemo(() => groupMessagesByDate(messages), [messages]);
  const unreadBreederMessages = messages.filter(
    (message) => message.sender === "admin" && !message.read_by_user
  ).length;
  const breederMessages = messages.filter((message) => message.sender === "admin").length;
  const yourMessages = messages.filter((message) => message.sender === "user").length;
  const lastReply = messages[0]?.created_at || null;

  async function refreshMessages() {
    if (!user) return;

    setStatusText("");
    setErrorText("");

    try {
      const portalMessages = await findPortalMessagesForUser(user, 100);
      setMessages(portalMessages);
    } catch (error) {
      console.error("Could not refresh portal messages:", error);
      setErrorText(
        "We could not refresh your conversation right now. Please try again in a moment."
      );
    }
  }

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !body.trim()) return;

    setSending(true);
    setStatusText("");
    setErrorText("");

    try {
      const { error } = await sb.from("portal_messages").insert({
        user_id: user.id,
        user_email: String(user.email || "").trim() || null,
        subject: subject.trim() || null,
        message: body.trim(),
        status: "open",
        read_by_admin: false,
        read_by_user: true,
        sender: "user",
      });

      if (error) throw error;

      setSubject("");
      setBody("");
      setStatusText("Message sent.");
      await refreshMessages();
    } catch (error) {
      console.error("Could not send message:", error);
      setErrorText(
        error instanceof Error ? error.message : "We could not send your message right now."
      );
    } finally {
      setSending(false);
    }
  }

  if (sessionLoading || loading) {
    return <PortalLoadingState label="Loading messages..." />;
  }

  if (!user) {
    return (
      <PortalPageHero
        eyebrow="Messages"
        title="Sign in to view your conversation history."
        description="Breeder replies, support questions, and account-specific notes stay here once you are signed in."
        actions={<PortalHeroPrimaryAction href="/portal">Open My Puppy Portal</PortalHeroPrimaryAction>}
      />
    );
  }

  if (errorText && !messages.length) {
    return <PortalErrorState title="Messages are unavailable" description={errorText} />;
  }

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Messages"
        title="Keep every conversation in one place."
        description="Questions, breeder replies, scheduling notes, and account follow-up stay inside the portal so your puppy conversation remains easy to review."
        actions={
          <>
            <PortalHeroPrimaryAction href="/portal/mypuppy">Open My Puppy</PortalHeroPrimaryAction>
            <PortalHeroSecondaryAction href="/portal/documents">Open Documents</PortalHeroSecondaryAction>
          </>
        }
        aside={
          <div className="space-y-4">
            <PortalInfoTile
              label="Unread"
              value={String(unreadBreederMessages)}
              detail="Breeder replies still waiting for review."
              tone={unreadBreederMessages ? "warning" : "neutral"}
            />
            <PortalInfoTile
              label="Latest Reply"
              value={lastReply ? fmtDate(lastReply) : "No replies yet"}
              detail="The newest message currently in your portal history."
            />
          </div>
        }
      />

      {statusText ? (
        <div className="rounded-[20px] border border-[rgba(106,162,134,0.24)] bg-[linear-gradient(180deg,#f8fcfb_0%,#f1f8f4_100%)] px-4 py-3 text-sm font-semibold text-[#486957]">
          {statusText}
        </div>
      ) : null}

      {errorText && messages.length ? (
        <div className="rounded-[20px] border border-[rgba(193,110,125,0.2)] bg-[linear-gradient(180deg,#fff8f9_0%,#fff2f4_100%)] px-4 py-3 text-sm font-semibold text-[#8f5360]">
          {errorText}
        </div>
      ) : null}

      <PortalMetricGrid>
        <PortalMetricCard
          label="Conversation Count"
          value={String(messages.length)}
          detail="Every saved portal message in your conversation history."
        />
        <PortalMetricCard
          label="From Breeder"
          value={String(breederMessages)}
          detail="Messages sent from Southwest Virginia Chihuahua."
          accent="from-[#dfe6fb] via-[#b8c7f7] to-[#7388d9]"
        />
        <PortalMetricCard
          label="From You"
          value={String(yourMessages)}
          detail="Messages you have sent through the portal."
          accent="from-[#d9eef4] via-[#acd4e2] to-[#6da8bd]"
        />
        <PortalMetricCard
          label="Unread"
          value={String(unreadBreederMessages)}
          detail="Breeder replies that still need your review."
          accent="from-[#e7ebf2] via-[#cfd8e6] to-[#8ea0b9]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <PortalPanel
            title="Write a Message"
            subtitle="Use the portal for account-specific questions, breeder follow-up, or anything tied to your puppy journey."
          >
            <form onSubmit={handleSend} className="space-y-4">
              <PortalField label="Subject">
                <PortalInput
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Optional subject"
                />
              </PortalField>

              <PortalField label="Message">
                <PortalTextarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Write your message here..."
                  rows={8}
                  required
                />
              </PortalField>

              <PortalButton type="submit" disabled={sending || !body.trim()} className="w-full">
                {sending ? "Sending..." : "Send Message"}
              </PortalButton>
            </form>
          </PortalPanel>

          <PortalPanel
            title="Why the portal helps"
            subtitle="The point is to keep communication readable, searchable, and connected to your account."
          >
            <div className="space-y-4">
              <SupportRow
                icon={<Mail className="h-4 w-4" />}
                title="Everything stays together"
                detail="Questions, breeder replies, and follow-up details remain linked to the same portal record."
              />
              <SupportRow
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Less confusion later"
                detail="The full conversation trail remains easy to revisit when you need to confirm what was said."
              />
              <SupportRow
                icon={<Sparkles className="h-4 w-4" />}
                title="Better context"
                detail="Messages work best when they stay close to your puppy profile, documents, and payment history."
              />
            </div>
          </PortalPanel>
        </div>

        <PortalPanel
          title="Conversation"
          subtitle="Read everything in one private thread instead of piecing the story together across text and email."
          action={
            <PortalSecondaryButton onClick={refreshMessages}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </PortalSecondaryButton>
          }
        >
          {messages.length ? (
            <div className="space-y-8">
              {groupedMessages.map((group) => (
                <div key={group.key}>
                  <div className="mb-4">
                    <PortalStatusBadge label={group.key} tone="neutral" />
                  </div>

                  <div className="space-y-4">
                    {group.items.map((entry) => {
                      const fromBreeder = entry.sender === "admin";
                      const readTone =
                        fromBreeder && !entry.read_by_user
                          ? "warning"
                          : !fromBreeder && !entry.read_by_admin
                            ? "warning"
                            : "success";

                      return (
                        <div
                          key={entry.id}
                          className={`flex ${fromBreeder ? "justify-start" : "justify-end"}`}
                        >
                          <div
                            className={`max-w-[86%] rounded-[28px] border px-5 py-4 shadow-[0_10px_24px_rgba(31,48,79,0.06)] ${
                              fromBreeder
                                ? "border-[var(--portal-border)] bg-white text-[var(--portal-text)]"
                                : "border-[rgba(79,99,189,0.16)] bg-[linear-gradient(135deg,var(--portal-accent)_0%,var(--portal-accent-strong)_100%)] text-white"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div
                                className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
                                  fromBreeder ? "text-[var(--portal-text-muted)]" : "text-white/70"
                                }`}
                              >
                                {fromBreeder ? "Southwest Virginia Chihuahua" : "You"}
                              </div>
                              <div
                                className={`text-[10px] ${
                                  fromBreeder ? "text-[var(--portal-text-muted)]" : "text-white/65"
                                }`}
                              >
                                {new Date(entry.created_at).toLocaleString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>

                            {entry.subject ? (
                              <div className="mt-2 text-sm font-semibold">{entry.subject}</div>
                            ) : null}

                            <div className="mt-3 whitespace-pre-wrap text-sm leading-7">
                              {entry.message}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <PortalStatusBadge
                                label={entry.status || "open"}
                                tone={readTone}
                              />
                              <PortalStatusBadge
                                label={
                                  fromBreeder
                                    ? entry.read_by_user
                                      ? "Read by you"
                                      : "Unread by you"
                                    : entry.read_by_admin
                                      ? "Read by breeder"
                                      : "Unread by breeder"
                                }
                                tone={readTone}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <PortalEmptyState
              title="No messages yet"
              description="Send your first portal message whenever you need an update, have a question, or want to confirm a detail."
            />
          )}
        </PortalPanel>
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
    <div className="flex items-start gap-3 rounded-[22px] border border-[var(--portal-border)] bg-white px-4 py-4 shadow-[0_10px_22px_rgba(31,48,79,0.05)]">
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
