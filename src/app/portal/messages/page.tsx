"use client";

import React, { useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { fmtDate, sb } from "@/lib/utils";
import { findPortalMessagesForUser, type PortalMessage } from "@/lib/portal-data";
import { usePortalSession } from "@/hooks/use-portal-session";
import {
  PortalButton,
  PortalEmptyState,
  PortalErrorState,
  PortalField,
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
        title="Keep every account conversation in one place."
        description="Questions, breeder replies, scheduling notes, and account follow-up remain inside the portal so the full conversation stays easy to review."
        aside={
          <div className="grid gap-4">
            <PortalInfoTile
              label="Unread"
              value={String(unreadBreederMessages)}
              detail="Breeder replies still waiting for review."
              tone={unreadBreederMessages ? "warning" : "neutral"}
            />
            <PortalInfoTile
              label="Latest Reply"
              value={lastReply ? fmtDate(lastReply) : "No replies yet"}
              detail="The newest message currently saved in your portal history."
            />
          </div>
        }
      />

      {statusText ? (
        <div className="rounded-[20px] border border-[rgba(47,143,103,0.18)] bg-[linear-gradient(180deg,rgba(246,253,249,0.98)_0%,rgba(240,249,245,0.94)_100%)] px-4 py-3 text-sm font-semibold text-[#2f7657]">
          {statusText}
        </div>
      ) : null}

      {errorText && messages.length ? (
        <div className="rounded-[20px] border border-[rgba(194,84,114,0.16)] bg-[linear-gradient(180deg,rgba(255,249,251,0.98)_0%,rgba(255,242,246,0.94)_100%)] px-4 py-3 text-sm font-semibold text-[#aa4f68]">
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
          detail="Replies sent from Southwest Virginia Chihuahua."
          accent="from-[rgba(93,121,255,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
        <PortalMetricCard
          label="From You"
          value={String(yourMessages)}
          detail="Messages you have sent through the portal."
          accent="from-[rgba(110,166,218,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
        />
        <PortalMetricCard
          label="Unread"
          value={String(unreadBreederMessages)}
          detail="Breeder replies that still need your review."
          accent="from-[rgba(113,198,164,0.16)] via-transparent to-[rgba(159,175,198,0.14)]"
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

        </div>

        <PortalPanel
          title="Conversation"
          subtitle="Read the account conversation in one thread instead of piecing it together across text and email."
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
                      return (
                        <div
                          key={entry.id}
                          className={`flex ${fromBreeder ? "justify-start" : "justify-end"}`}
                        >
                          <div className={`max-w-[78%] ${fromBreeder ? "" : "text-right"}`}>
                            <div className="mb-2 flex items-center gap-2">
                              <PortalStatusBadge
                                label={fromBreeder ? "Breeder" : "You"}
                                tone={fromBreeder ? (entry.read_by_user ? "neutral" : "warning") : "success"}
                              />
                              {entry.subject ? (
                                <span className="text-xs text-[var(--portal-text-muted)]">
                                  {entry.subject}
                                </span>
                              ) : null}
                            </div>

                            <div
                              className={`rounded-[24px] border px-4 py-4 text-sm leading-7 shadow-[0_12px_28px_rgba(23,35,56,0.05)] ${
                                fromBreeder
                                  ? "border-[var(--portal-border)] bg-white text-[var(--portal-text)]"
                                  : "border-amber-200 bg-[linear-gradient(135deg,rgba(255,248,240,0.98)_0%,rgba(255,243,229,0.96)_100%)] text-[var(--portal-text)]"
                              }`}
                            >
                              {entry.message || "No message body."}
                            </div>

                            <div className="mt-2 text-xs text-[var(--portal-text-muted)]">
                              {fmtDate(entry.created_at)}
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
              description="When you or the breeder send a portal message, the conversation will appear here."
            />
          )}
        </PortalPanel>
      </section>
    </div>
  );
}
