import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type PublicRequestBody = {
  message?: string;
  source?: string;
  page?: string;
  sessionId?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  /** Full conversation history sent from the client for context */
  history?: { role: "user" | "assistant"; content: string }[];
};

type LeadAnalysis = {
  topic: string | null;
  tags: string[];
  interestTimeline: "unknown" | "now" | "soon" | "later";
  wantsPaymentPlan: boolean;
  wantsWaitList: boolean;
  wantsAvailablePuppy: boolean;
  wantsApplication: boolean;
  requiresFollowUp: boolean;
  followUpReason: string | null;
  leadScore: number;
  leadStatus: "new" | "warm" | "hot";
  summary: string;
  email: string | null;
  phone: string | null;
};

// ─────────────────────────────────────────────
// Env / Supabase helpers
// ─────────────────────────────────────────────

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function createServiceSupabase(): SupabaseClient {
  return createClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

// ─────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────

function getAllowedOrigin(origin: string | null) {
  const allowed = [
    "https://swvachihuahua.com",
    "https://www.swvachihuahua.com",
    "http://swvachihuahua.com",
    "http://www.swvachihuahua.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];
  return origin && allowed.includes(origin) ? origin : "https://swvachihuahua.com";
}

function withCors(origin: string | null, extra: Record<string, string> = {}) {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(origin),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    ...extra,
  };
}

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "";
}

function cleanText(v: string) {
  return String(v || "").trim().toLowerCase();
}

function extractEmail(text: string) {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : null;
}

function extractPhone(text: string) {
  const match = text.match(
    /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/
  );
  return match ? match[0] : null;
}

function detectTopic(q: string): string | null {
  if (q.includes("payment plan") || q.includes("financing") || q.includes("monthly"))
    return "payment_plans";
  if (q.includes("wait list") || q.includes("waitlist")) return "wait_list";
  if (q.includes("available") || q.includes("puppies") || q.includes("litter"))
    return "availability";
  if (q.includes("apply") || q.includes("application")) return "application";
  if (q.includes("policy") || q.includes("policies")) return "policies";
  if (q.includes("portal")) return "puppy_portal";
  if (
    q.includes("transport") ||
    q.includes("delivery") ||
    q.includes("pickup")
  )
    return "transport";
  if (
    q.includes("health guarantee") ||
    q.includes("vaccine") ||
    q.includes("deworm")
  )
    return "health";
  if (
    q.includes("hydrocephalus") ||
    q.includes("hypoglycemia") ||
    q.includes("collapsed trachea") ||
    q.includes("open fontanel") ||
    q.includes("luxating patella") ||
    q.includes("heart murmur") ||
    q.includes("seizure") ||
    q.includes("ailment") ||
    q.includes("breed problem")
  )
    return "breed_health";
  return null;
}

// ─────────────────────────────────────────────
// Lead Analysis (pure local logic, no AI needed)
// ─────────────────────────────────────────────

function analyzeLead(message: string): LeadAnalysis {
  const q = cleanText(message);
  const tags = new Set<string>();
  const email = extractEmail(message);
  const phone = extractPhone(message);

  const wantsPaymentPlan =
    q.includes("payment plan") ||
    q.includes("financing") ||
    q.includes("finance") ||
    q.includes("monthly") ||
    q.includes("pay over time");

  const wantsWaitList =
    q.includes("wait list") ||
    q.includes("waitlist") ||
    q.includes("join the list");

  const wantsAvailablePuppy =
    q.includes("available") ||
    q.includes("any puppies") ||
    q.includes("do you have puppies") ||
    q.includes("next litter") ||
    q.includes("upcoming litter");

  const wantsApplication =
    q.includes("apply") ||
    q.includes("application") ||
    q.includes("how do i apply");

  let interestTimeline: LeadAnalysis["interestTimeline"] = "unknown";
  if (
    q.includes("right now") ||
    q.includes("asap") ||
    q.includes("immediately") ||
    q.includes("ready now")
  ) {
    interestTimeline = "now";
  } else if (
    q.includes("soon") ||
    q.includes("next month") ||
    q.includes("this summer") ||
    q.includes("mid june")
  ) {
    interestTimeline = "soon";
  } else if (
    q.includes("later") ||
    q.includes("future") ||
    q.includes("next year")
  ) {
    interestTimeline = "later";
  }

  const topic = detectTopic(q);
  if (topic) tags.add(topic);
  if (wantsPaymentPlan) tags.add("payment_plan");
  if (wantsWaitList) tags.add("wait_list");
  if (wantsAvailablePuppy) tags.add("availability");
  if (wantsApplication) tags.add("application");
  if (email) tags.add("email_provided");
  if (phone) tags.add("phone_provided");

  let leadScore = 0;
  if (wantsAvailablePuppy) leadScore += 20;
  if (wantsWaitList) leadScore += 20;
  if (wantsApplication) leadScore += 30;
  if (wantsPaymentPlan) leadScore += 20;
  if (interestTimeline === "now") leadScore += 25;
  if (interestTimeline === "soon") leadScore += 15;
  if (email) leadScore += 20;
  if (phone) leadScore += 20;

  const contactRequested =
    q.includes("contact me") ||
    q.includes("call me") ||
    q.includes("text me") ||
    q.includes("email me") ||
    q.includes("reach out");

  const requiresFollowUp =
    contactRequested ||
    !!email ||
    !!phone ||
    (interestTimeline === "now" &&
      (wantsAvailablePuppy || wantsPaymentPlan || wantsApplication));

  let followUpReason: string | null = null;
  if (contactRequested) followUpReason = "Visitor requested direct contact.";
  else if (email || phone) followUpReason = "Visitor provided contact information.";
  else if (interestTimeline === "now" && wantsAvailablePuppy)
    followUpReason = "Visitor is looking for a puppy right now.";
  else if (interestTimeline === "now" && wantsPaymentPlan)
    followUpReason = "Visitor asked about payment plans and appears ready soon.";

  let leadStatus: LeadAnalysis["leadStatus"] = "new";
  if (leadScore >= 60) leadStatus = "hot";
  else if (leadScore >= 30) leadStatus = "warm";

  const summaryParts = [
    topic ? `Topic: ${topic.replace(/_/g, " ")}` : null,
    wantsAvailablePuppy ? "Asked about availability" : null,
    wantsWaitList ? "Interested in wait list" : null,
    wantsApplication ? "Interested in application" : null,
    wantsPaymentPlan ? "Asked about payment plans" : null,
    interestTimeline !== "unknown" ? `Timeline: ${interestTimeline}` : null,
    email ? "Email provided" : null,
    phone ? "Phone provided" : null,
  ].filter(Boolean);

  return {
    topic,
    tags: Array.from(tags),
    interestTimeline,
    wantsPaymentPlan,
    wantsWaitList,
    wantsAvailablePuppy,
    wantsApplication,
    requiresFollowUp,
    followUpReason,
    leadScore,
    leadStatus,
    summary: summaryParts.length ? summaryParts.join(" • ") : "General website inquiry.",
    email,
    phone,
  };
}

// ─────────────────────────────────────────────
// System Prompt — playful, human, conversational
// ─────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `
You are ChiChi — the cheerful, knowledgeable, and totally lovable assistant for Southwest Virginia Chihuahua, a small family-run Chihuahua breeding operation in Marion, VA.

You are NOT a bot. You are ChiChi. You feel real, warm, and fun. You love Chihuahuas deeply and you love helping people find their perfect tiny companion.

────────────────────────
YOUR PERSONALITY
────────────────────────
- Playful and fun — you can drop in a tiny Chihuahua pun, joke, or emoji now and then 🐾
- Warm, patient, and caring — like talking to a knowledgeable friend who also happens to breed the world's greatest little dogs
- Conversational — respond like a human texting back, not like a FAQ page
- You remember the full conversation so far. Reference it naturally when it makes sense ("Oh right, you mentioned you're looking for a puppy before summer — great timing!")
- If someone seems nervous or unsure, reassure them. Puppy adoption is a big deal!
- Use the person's name if they share it
- Be concise when they want quick answers. Go deeper when they're clearly curious

────────────────────────
WHAT YOU CAN TALK ABOUT
────────────────────────
- Everything about the Southwest Virginia Chihuahua business: availability, litters, wait list, applications, payment plans, policies, transport, the Puppy Portal
- General Chihuahua breed knowledge: personality, size, care, feeding, health, training, teacup vs standard, coat types, temperament, socialization, lifespan, dental care, exercise, etc.
- Helping families figure out if a Chihuahua is the right fit for their home
- Preparing for a new puppy: supplies, vet visits, puppy-proofing, socialization windows
- Answering health questions generally (hypoglycemia, luxating patella, dental issues, collapsed trachea, etc.) — always suggest a vet for anything serious or urgent

────────────────────────
BUSINESS FACTS (use these accurately)
────────────────────────
- Business: Southwest Virginia Chihuahua
- Location: Marion, VA
- Phone: (276) 378-0184
- Current availability: no puppies currently available
- Next litter expected: mid June
- Best next step for interested families: join the Wait List on the website
- Puppies typically go home around 8 weeks old
- Families receive: health records, vaccination info, starter food, and ongoing breeder support
- Puppy Portal: available for approved families to track their puppy's progress
- Transport/delivery: may be available depending on distance and circumstances

────────────────────────
PAYMENT PLAN DETAILS
────────────────────────
- Payment plans may be available in some situations
- Standard plan: 50% down, remaining balance paid over up to 6 months
- References and verifiable information may be required
- Registration papers and bill of sale are NOT released until paid in full
- Buyers must agree to the terms of service

────────────────────────
POLICIES
────────────────────────
Policies cover: reservations, payment terms, transport, go-home timing, buyer responsibilities, and health info.
Always point people to the Policies page on the website for the full official details.

────────────────────────
HARD LIMITS (always follow these)
────────────────────────
- Never access, claim to access, or invent private buyer/account/portal data
- Never diagnose a specific dog with certainty
- Never replace veterinary care — if something sounds urgent or medical, give general info then say a vet should take a look
- Never invent or guess at business policies — only share what's listed above
- Never mention Supabase, APIs, internal systems, or that you're an AI language model
- If someone asks if you're a real person, be honest but charming: "I'm ChiChi — part assistant, part Chihuahua enthusiast, 100% here to help! 🐾"

────────────────────────
CONVERSATION STYLE
────────────────────────
- No markdown headings (###, **bold headers**, etc.)
- No bullet-point walls — use natural sentences
- A single emoji here and there is fine, don't overdo it
- Short and punchy for simple questions. Thoughtful and warm for bigger ones.
- End with a natural follow-up question or offer when it makes sense, to keep the conversation going
- If you don't know something, say so honestly and point them to the website or suggest they call (276) 378-0184
`.trim();
}

// ─────────────────────────────────────────────
// Local fallback (used if no API key configured)
// ─────────────────────────────────────────────

function localFallback(message: string): string {
  const q = cleanText(message);
  if (!q) return "Hey there! Ask me anything — puppies, availability, care tips, you name it 🐾";

  if (q.includes("available") || q.includes("any puppies") || q.includes("have puppies"))
    return "We don't have any puppies available right now, but our next litter is expected mid June! The best move is to join our Wait List so you're first to know when they're ready. 🐾";

  if (q.includes("wait list") || q.includes("waitlist"))
    return "You can join the Wait List right on our website! It's the best way to stay in the loop and get first dibs when a litter is ready.";

  if (q.includes("payment plan") || q.includes("financing") || q.includes("monthly"))
    return "We do offer payment plans in some situations! It's typically 50% down with the balance spread over up to 6 months. References may be needed, and papers are released once everything's paid. Want more details?";

  if (q.includes("apply") || q.includes("application"))
    return "You can apply right on our website! If you're planning ahead for the June litter, joining the Wait List first is a great idea too.";

  return "I'd love to help! You can ask me about available puppies, our Wait List, payment plans, Chihuahua care, or anything else. Or give us a call at (276) 378-0184 😊";
}

// ─────────────────────────────────────────────
// Database helpers
// ─────────────────────────────────────────────

async function findOrCreateVisitor(
  admin: SupabaseClient,
  req: Request,
  body: PublicRequestBody
) {
  const origin = req.headers.get("origin") || "";
  const userAgent = req.headers.get("user-agent") || "";
  const ip = getClientIp(req);
  const ipHash = ip ? sha256(ip) : null;

  const sessionId =
    String(body.sessionId || "").trim() ||
    `public-${sha256(`${ip || "no-ip"}|${userAgent}|${origin || "no-origin"}`)}`;

  const nowIso = new Date().toISOString();

  const { data: existing } = await admin
    .from("website_visitors")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (existing) {
    const { data: updated, error } = await admin
      .from("website_visitors")
      .update({
        last_seen_at: nowIso,
        current_page: body.page || existing.current_page || null,
        referrer: body.referrer || existing.referrer || null,
        user_agent: userAgent || existing.user_agent || null,
        ip_hash: ipHash || existing.ip_hash || null,
        utm_source: body.utm_source || existing.utm_source || null,
        utm_medium: body.utm_medium || existing.utm_medium || null,
        utm_campaign: body.utm_campaign || existing.utm_campaign || null,
        utm_term: body.utm_term || existing.utm_term || null,
        utm_content: body.utm_content || existing.utm_content || null,
        is_returning: true,
        visit_count: Math.max(Number(existing.visit_count || 1), 1),
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw new Error(`Could not update visitor: ${error.message}`);
    return updated;
  }

  const { data: created, error } = await admin
    .from("website_visitors")
    .insert({
      session_id: sessionId,
      first_seen_at: nowIso,
      last_seen_at: nowIso,
      ip_hash: ipHash,
      user_agent: userAgent || null,
      landing_page: body.page || null,
      current_page: body.page || null,
      referrer: body.referrer || null,
      utm_source: body.utm_source || null,
      utm_medium: body.utm_medium || null,
      utm_campaign: body.utm_campaign || null,
      utm_term: body.utm_term || null,
      utm_content: body.utm_content || null,
      is_returning: false,
      visit_count: 1,
      meta: { source: body.source || "public_website" },
    })
    .select("*")
    .single();

  if (error) throw new Error(`Could not create visitor: ${error.message}`);
  return created;
}

async function findOrCreateThread(
  admin: SupabaseClient,
  visitorId: string,
  body: PublicRequestBody
) {
  const { data: existing } = await admin
    .from("chichi_public_threads")
    .select("*")
    .eq("visitor_id", visitorId)
    .eq("status", "open")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await admin
    .from("chichi_public_threads")
    .insert({
      visitor_id: visitorId,
      source_page: body.page || null,
      source_site: body.source || "public_website",
      status: "open",
      lead_status: "visitor",
      follow_up_needed: false,
      priority: "normal",
      tags: [],
      meta: {},
    })
    .select("*")
    .single();

  if (error) throw new Error(`Could not create thread: ${error.message}`);
  return created;
}

async function loadThreadHistory(
  admin: SupabaseClient,
  threadId: string
): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const { data, error } = await admin
    .from("chichi_public_messages")
    .select("sender, content")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data
    .filter((m) => m.sender === "visitor" || m.sender === "assistant")
    .map((m) => ({
      role: m.sender === "visitor" ? "user" : "assistant",
      content: m.content,
    }));
}

async function insertMessage(
  admin: SupabaseClient,
  params: {
    threadId: string;
    visitorId: string;
    sender: "visitor" | "assistant" | "system";
    content: string;
    intent?: string | null;
    topic?: string | null;
    requiresFollowUp?: boolean;
    followUpReason?: string | null;
    tags?: string[];
  }
) {
  const { error } = await admin.from("chichi_public_messages").insert({
    thread_id: params.threadId,
    visitor_id: params.visitorId,
    sender: params.sender,
    content: params.content,
    intent: params.intent || null,
    topic: params.topic || null,
    requires_follow_up: params.requiresFollowUp ?? false,
    follow_up_reason: params.followUpReason || null,
    tags: params.tags || [],
    meta: {},
  });

  if (error) throw new Error(`Could not save message: ${error.message}`);
}

async function upsertLead(
  admin: SupabaseClient,
  params: { visitorId: string; threadId: string; analysis: LeadAnalysis }
) {
  const { visitorId, threadId, analysis } = params;

  const { data: existing } = await admin
    .from("crm_leads")
    .select("*")
    .eq("visitor_id", visitorId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    visitor_id: visitorId,
    thread_id: threadId,
    email: analysis.email,
    phone: analysis.phone,
    interest_timeline: analysis.interestTimeline,
    interest_type: analysis.tags,
    lead_score: analysis.leadScore,
    lead_status: analysis.leadStatus,
    wants_payment_plan: analysis.wantsPaymentPlan,
    wants_wait_list: analysis.wantsWaitList,
    wants_available_puppy: analysis.wantsAvailablePuppy,
    wants_application: analysis.wantsApplication,
    follow_up_needed: analysis.requiresFollowUp,
    follow_up_status: analysis.requiresFollowUp ? "needed" : "none",
    follow_up_reason: analysis.followUpReason,
    last_contact_at: new Date().toISOString(),
    summary: analysis.summary,
    tags: analysis.tags,
    meta: {},
  };

  if (existing) {
    const mergedInterest = Array.from(
      new Set([...(existing.interest_type || []), ...analysis.tags])
    );
    const mergedTags = Array.from(
      new Set([...(existing.tags || []), ...analysis.tags])
    );

    const { data: updated, error } = await admin
      .from("crm_leads")
      .update({
        ...payload,
        email: analysis.email || existing.email || null,
        phone: analysis.phone || existing.phone || null,
        interest_type: mergedInterest,
        tags: mergedTags,
        lead_score: Math.max(Number(existing.lead_score || 0), analysis.leadScore),
        lead_status:
          analysis.leadStatus === "hot" || existing.lead_status === "hot"
            ? "hot"
            : analysis.leadStatus === "warm" || existing.lead_status === "warm"
            ? "warm"
            : "new",
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw new Error(`Could not update lead: ${error.message}`);
    return updated;
  }

  const { data: created, error } = await admin
    .from("crm_leads")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw new Error(`Could not create lead: ${error.message}`);
  return created;
}

async function ensureFollowUpTask(
  admin: SupabaseClient,
  params: {
    leadId: string;
    threadId: string;
    visitorId: string;
    analysis: LeadAnalysis;
  }
) {
  if (!params.analysis.requiresFollowUp) return;

  const { data: existing } = await admin
    .from("crm_followups")
    .select("*")
    .eq("lead_id", params.leadId)
    .in("status", ["open", "scheduled"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return;

  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 1);

  const { error } = await admin.from("crm_followups").insert({
    lead_id: params.leadId,
    thread_id: params.threadId,
    visitor_id: params.visitorId,
    task_type: "follow_up",
    reason: params.analysis.followUpReason || "Visitor may need follow-up.",
    status: "open",
    priority: params.analysis.leadStatus === "hot" ? "high" : "normal",
    due_at: dueAt.toISOString(),
    notes: params.analysis.summary,
    meta: {},
  });

  if (error) throw new Error(`Could not create follow-up task: ${error.message}`);
}

async function updateThread(
  admin: SupabaseClient,
  params: { threadId: string; analysis: LeadAnalysis }
) {
  const { error } = await admin
    .from("chichi_public_threads")
    .update({
      follow_up_needed: params.analysis.requiresFollowUp,
      follow_up_reason: params.analysis.followUpReason,
      priority: params.analysis.leadStatus === "hot" ? "high" : "normal",
      lead_status:
        params.analysis.leadStatus === "hot"
          ? "hot"
          : params.analysis.leadStatus === "warm"
          ? "warm"
          : "visitor",
      summary: params.analysis.summary,
      intent_summary: params.analysis.topic || null,
      last_user_message_at: new Date().toISOString(),
      tags: params.analysis.tags,
    })
    .eq("id", params.threadId);

  if (error) throw new Error(`Could not update thread: ${error.message}`);
}

// ─────────────────────────────────────────────
// Route handlers
// ─────────────────────────────────────────────

export async function GET(req: Request) {
  const origin = req.headers.get("origin");
  return NextResponse.json(
    { ok: true, route: "chichi-public", message: "ChiChi is live and ready to chat! 🐾" },
    { status: 200, headers: withCors(origin) }
  );
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  return new NextResponse(null, { status: 204, headers: withCors(origin) });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");

  try {
    const body = (await req.json()) as PublicRequestBody;
    const message = String(body.message || "").trim();

    if (!message) {
      return NextResponse.json(
        { text: "Hey! Go ahead and type your question — I'm all ears 🐾" },
        { status: 400, headers: withCors(origin) }
      );
    }

    const admin = createServiceSupabase();
    const visitor = await findOrCreateVisitor(admin, req, body);
    const thread = await findOrCreateThread(admin, visitor.id, body);
    const analysis = analyzeLead(message);

    // Save the incoming visitor message
    await insertMessage(admin, {
      threadId: thread.id,
      visitorId: visitor.id,
      sender: "visitor",
      content: message,
      intent: analysis.topic,
      topic: analysis.topic,
      requiresFollowUp: analysis.requiresFollowUp,
      followUpReason: analysis.followUpReason,
      tags: analysis.tags,
    });

    // Build full conversation history for the AI
    // Priority: use history sent by client (already has full context),
    // otherwise fall back to loading from DB
    let conversationHistory: { role: "user" | "assistant"; content: string }[] =
      body.history && body.history.length > 0
        ? body.history
        : await loadThreadHistory(admin, thread.id);

    // Ensure the current message is at the end (client may or may not include it)
    const lastInHistory = conversationHistory[conversationHistory.length - 1];
    if (!lastInHistory || lastInHistory.role !== "user" || lastInHistory.content !== message) {
      conversationHistory = [...conversationHistory, { role: "user", content: message }];
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const model = process.env.ANTHROPIC_PUBLIC_MODEL || "claude-opus-4-5";

    let text = "";

    if (!apiKey) {
      text = localFallback(message);
    } else {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 800,
          system: buildSystemPrompt(),
          messages: conversationHistory,
        }),
      });

      if (!response.ok) {
        console.error("Anthropic API error:", response.status, await response.text());
        text = localFallback(message);
      } else {
        const data = await response.json();
        text = String(data?.content?.[0]?.text || "").trim() || localFallback(message);
      }
    }

    // Save ChiChi's response
    await insertMessage(admin, {
      threadId: thread.id,
      visitorId: visitor.id,
      sender: "assistant",
      content: text,
      topic: analysis.topic,
      tags: analysis.tags,
    });

    // CRM pipeline
    const lead = await upsertLead(admin, {
      visitorId: visitor.id,
      threadId: thread.id,
      analysis,
    });

    await ensureFollowUpTask(admin, {
      leadId: lead.id,
      threadId: thread.id,
      visitorId: visitor.id,
      analysis,
    });

    await updateThread(admin, { threadId: thread.id, analysis });

    return NextResponse.json(
      {
        text,
        visitorId: visitor.id,
        threadId: thread.id,
        leadStatus: analysis.leadStatus,
        followUpNeeded: analysis.requiresFollowUp,
      },
      { status: 200, headers: withCors(origin) }
    );
  } catch (error) {
    console.error("ChiChi route error:", error);
    return NextResponse.json(
      { text: "Oops, something went sideways on my end! Try again in a second 🐾" },
      { status: 200, headers: withCors(origin) }
    );
  }
}