"use client";

import React, { useEffect, useState } from "react";
import { Mail, RefreshCcw, ShieldCheck } from "lucide-react";
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

    const payload = {
      user_id: user.id,
      user_email: String(user.email || "").trim() || null,
      subject: subject.trim() || null,
      message: body.trim(),
      status: "open",
      read_by_admin: false,
      read_by_user: true,
      sender: "user",
    };

    try {
      const { error } = await sb.from("portal_messages").insert(payload);
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
        title="Sign in to open your conversation history."
        description="Portal messages keep breeder replies, questions, and support details organized in one private conversation."
        actions={<PortalHeroPrimaryAction href="/portal">Open Portal Access</PortalHeroPrimaryAction>}
      />
    );
  }

  if (errorText && !messages.length) {
    return <PortalErrorState title="Messages are unavailable" description={errorText} />;
  }

  const groupedMessages = groupMessagesByDate(messages);
  const unreadBreederMessages = messages.filter(
    (message) => message.sender === "admin" && !message.read_by_user
  ).length;
  const breederMessages = messages.filter((message) => message.sender === "admin").length;
  const yourMessages = messages.filter((message) => message.sender === "user").length;
  const lastReply = messages[0]?.created_at || null;

  return (
    <div className="space-y-6 pb-14">
      <PortalPageHero
        eyebrow="Messages"
        title="A private conversation space for your puppy journey."
        description="Keep breeder updates, account questions, scheduling notes, and support in one clean conversation instead of digging through texts and emails."
        actions={
          <>
            <PortalHeroPrimaryAction href="/portal/mypuppy">Open My Puppy</PortalHeroPrimaryAction>
            <PortalHeroSecondaryAction href="/portal/documents">Open Documents</PortalHeroSecondaryAction>
          </>
        }
        aside={
          <div className="space-y-4">
            <PortalInfoTile
              label="Portal Email"
              value={user.email || "No email on file"}
              detail="Your messages stay connected to this portal login."
            />
            <PortalInfoTile
              label="Unread From Breeder"
              value={String(unreadBreederMessages)}
              detail="Breeder replies still waiting for review."
              tone={unreadBreederMessages ? "warning" : "neutral"}
            />
          </div>
        }
      />

      {statusText ? (
        <div className="rounded-[20px] border border-[#d5e7d0] bg-[#f5fbf2] px-4 py-3 text-sm font-semibold text-[#456640]">
          {statusText}
        </div>
      ) : null}

      {errorText && messages.length ? (
        <div className="rounded-[20px] border border-[#efd2cc] bg-[#fff6f4] px-4 py-3 text-sm font-semibold text-[#8f4b42]">
          {errorText}
        </div>
      ) : null}

      <PortalMetricGrid>
        <PortalMetricCard
          label="Conversation Count"
          value={String(messages.length)}
          detail="Every saved portal message in this conversation."
        />
        <PortalMetricCard
          label="From Breeder"
          value={String(breederMessages)}
          detail="Messages sent from Southwest Virginia Chihuahua."
          accent="from-[#dce9d6] via-[#b6cfaa] to-[#7e9c6f]"
        />
        <PortalMetricCard
          label="From You"
          value={String(yourMessages)}
          detail="Messages you have sent through the portal."
          accent="from-[#ece3d5] via-[#d7c1a3] to-[#b18d62]"
        />
        <PortalMetricCard
          label="Latest Reply"
          value={lastReply ? fmtDate(lastReply) : "No replies yet"}
          detail="The newest entry in your portal conversation."
          accent="from-[#f0dcc1] via-[#ddb68c] to-[#c98743]"
        />
      </PortalMetricGrid>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <PortalPanel
            title="Send a Message"
            subtitle="Use the portal first when you need an update, want to confirm a detail, or need help with your account."
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
            title="Why use portal messages"
            subtitle="This is meant to keep communication simple, searchable, and tied to your puppy account."
          >
            <div className="space-y-3">
              <MessageTip
                icon={<Mail className="h-4 w-4" />}
                title="Keep everything in one place"
                detail="Questions, breeder replies, and account details remain connected to your portal record."
              />
              <MessageTip
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Reduce confusion"
                detail="Using the portal helps keep the full conversation trail easy to follow later."
              />
            </div>
          </PortalPanel>
        </div>

        <PortalPanel
          title="Conversation"
          subtitle="Your message history is collected here so you can quickly review what was asked, answered, and still needs attention."
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
                      const statusTone = fromBreeder
                        ? entry.read_by_user
                          ? "success"
                          : "warning"
                        : entry.read_by_admin
                          ? "success"
                          : "warning";

                      return (
                        <div
                          key={entry.id}
                          className={`flex ${fromBreeder ? "justify-start" : "justify-end"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-[28px] border px-5 py-4 shadow-[0_10px_24px_rgba(96,67,38,0.05)] ${
                              fromBreeder
                                ? "border-[#ead9c7] bg-white text-[#2f2218]"
                                : "border-[#d8c2a8] bg-[linear-gradient(180deg,#6b4d33_0%,#5a3f2d_100%)] text-white"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${fromBreeder ? "text-[#a47946]" : "text-white/70"}`}>
                                {fromBreeder ? "Southwest Virginia Chihuahua" : "You"}
                              </div>
                              <div className={`text-[10px] ${fromBreeder ? "text-[#8d6f52]" : "text-white/60"}`}>
                                {new Date(entry.created_at).toLocaleString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>

                            {entry.subject ? (
                              <div className={`mt-2 text-sm font-semibold ${fromBreeder ? "text-[#2f2218]" : "text-white"}`}>
                                {entry.subject}
                              </div>
                            ) : null}

                            <div className={`mt-3 whitespace-pre-wrap text-sm leading-7 ${fromBreeder ? "text-[#72553c]" : "text-white/92"}`}>
                              {entry.message}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <PortalStatusBadge
                                label={entry.status || "open"}
                                tone={statusTone}
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
                                tone={statusTone}
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

function MessageTip({
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
