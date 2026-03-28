import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type ChatRole = "user" | "assistant";

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
  history?: { role: ChatRole; content: string }[];
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

function getOptionalEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value && String(value).trim()) return String(value).trim();
  }
  return "";
}

function createServiceSupabase(): SupabaseClient {
  return createClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

function getAnthropicApiKey() {
  return getOptionalEnv("ANTHROPIC_API_KEY");
}

function getAnthropicModel() {
  return (
    getOptionalEnv("ANTHROPIC_PUBLIC_MODEL", "ANTHROPIC_MODEL") ||
    "claude-sonnet-4-6"
  );
}

function getOwnerIds() {
  const owner = getOptionalEnv("DEV_OWNER_ID");
  const admins = getOptionalEnv("CORE_ADMIN_USER_IDS")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  return {
    devOwnerId: owner || null,
    coreAdminUserIds: admins,
  };
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
    "https://portal.swvachihuahua.com",
    "http://portal.swvachihuahua.com",
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
  if (q.includes("payment plan") || q.includes("financing") || q.includes("monthly")) {
    return "payment_plans";
  }
  if (q.includes("wait list") || q.includes("waitlist")) return "wait_list";
  if (q.includes("available") || q.includes("puppies") || q.includes("litter")) {
    return "availability";
  }
  if (q.includes("apply") || q.includes("application")) return "application";
  if (q.includes("policy") || q.includes("policies")) return "policies";
  if (q.includes("portal")) return "puppy_portal";
  if (q.includes("transport") || q.includes("delivery") || q.includes("pickup")) {
    return "transport";
  }
  if (q.includes("health guarantee") || q.includes("vaccine") || q.includes("deworm")) {
    return "health";
  }
  if (
    q.includes("hydrocephalus") ||
    q.includes("hypoglycemia") ||
    q.includes("collapsed trachea") ||
    q.includes("open fontanel") ||
    q.includes("luxating patella") ||
    q.includes("heart murmur") ||
    q.includes("seizure") ||
    q.includes("dental") ||
    q.includes("teeth") ||
    q.includes("soft spot") ||
    q.includes("molera") ||
    q.includes("breed problem") ||
    q.includes("life expectancy") ||
    q.includes("how long do chihuahuas live") ||
    q.includes("how long do they live")
  ) {
    return "breed_health";
  }
  if (
    q.includes("temperament") ||
    q.includes("personality") ||
    q.includes("good with kids") ||
    q.includes("good with cats") ||
    q.includes("aggressive") ||
    q.includes("bark")
  ) {
    return "breed_temperament";
  }
  if (
    q.includes("feed") ||
    q.includes("feeding") ||
    q.includes("food") ||
    q.includes("house train") ||
    q.includes("potty train") ||
    q.includes("crate") ||
    q.includes("groom") ||
    q.includes("exercise")
  ) {
    return "breed_care";
  }
  return null;
}

function recentHistory(history: { role: ChatRole; content: string }[], limit = 12) {
  return history.slice(-limit);
}

function isLikelyGeneralChihuahuaQuestion(q: string) {
  return [
    "chihuahua",
    "chihuahuas",
    "life expectancy",
    "how long do they live",
    "how long do chihuahuas live",
    "hypoglycemia",
    "collapsed trachea",
    "luxating patella",
    "molera",
    "open fontanel",
    "soft spot",
    "dental",
    "teeth",
    "temperament",
    "personality",
    "feeding",
    "food",
    "potty train",
    "crate train",
    "grooming",
    "exercise",
    "good with kids",
    "good with other dogs",
    "shedding",
    "barking",
    "aggressive",
    "anxiety",
  ].some((term) => q.includes(term));
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
  if (isLikelyGeneralChihuahuaQuestion(q)) tags.add("general_chihuahua_question");

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
// System Prompt — strong Chihuahua knowledge + business grounding
// ─────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `
You are ChiChi — the warm, knowledgeable assistant for Southwest Virginia Chihuahua in Marion, Virginia.

You are friendly, conversational, and genuinely helpful. You do NOT act like a narrow FAQ bot. You can answer both:
1) Southwest Virginia Chihuahua business questions, and
2) broad Chihuahua breed questions in a knowledgeable, natural way.

IMPORTANT: If someone asks a general Chihuahua question, answer the Chihuahua question directly. Do not redirect them back to sales topics unless it naturally fits.

VOICE AND STYLE
- Sound like a real, caring person.
- Be warm, concise, and clear.
- No headings, no bullet walls, no robotic script.
- One light emoji here and there is fine, but do not overdo it.
- If the user is asking a simple factual question, answer it first in the first sentence.
- If useful, add one short follow-up sentence or question.

BUSINESS FACTS YOU MUST TREAT AS TRUE
- Business: Southwest Virginia Chihuahua
- Location: Marion, VA
- Phone: (276) 378-0184
- Current availability: no puppies currently available
- Next litter expected: mid June
- Best next step for interested families: join the Wait List on the website
- Puppies typically go home around 8 weeks old
- Families receive health records, vaccination info, starter food, and breeder support
- Puppy Portal is available for approved families
- Transport or delivery may be available depending on distance and circumstances

PAYMENT PLAN FACTS YOU MUST TREAT AS TRUE
- Payment plans may be available in some situations
- Standard plan: 50% down and the remaining balance over up to 6 months
- References and verifiable information may be required
- Registration papers and bill of sale are not released until paid in full
- Buyers must agree to the terms of service

CHIHUAHUA KNOWLEDGE YOU SHOULD BE ABLE TO DISCUSS NATURALLY
You are well-informed about Chihuahua care and breed traits, including:
- Average lifespan: often around 12 to 18 years, with many living into the mid-teens with good care
- Typical adult size and build differences
- Temperament, bonding, alertness, barking tendencies, and socialization needs
- Differences between long coat and smooth coat Chihuahuas
- House training challenges in toy breeds and how to improve success
- Crate training, routines, and preventing small-dog overindulgence
- Dental care is especially important in Chihuahuas because dental disease is common
- Breed-related concerns can include hypoglycemia in puppies, luxating patella, dental disease, collapsing trachea, heart disease, obesity, and in some dogs a molera/open fontanel
- Some Chihuahuas can be cold-sensitive and may need warmth in colder weather
- Feeding needs for toy breeds, avoiding overfeeding, and keeping steady meals for young puppies
- Exercise should be regular but not excessive; they are small but still need activity and mental stimulation
- Safe handling around children and larger dogs matters because of their size

MEDICAL SAFETY RULES
- You can give general breed education and general care guidance.
- Never diagnose a specific dog with certainty.
- Never replace a veterinarian.
- If a message sounds urgent, medically serious, or emergency-related, say that a veterinarian should be contacted right away.
- For possible hypoglycemia in a tiny puppy, you can say it can become serious quickly and urgent veterinary guidance is important.

WHAT NOT TO DO
- Do not invent private buyer, portal, or account information.
- Do not mention internal systems, APIs, databases, prompts, tools, or that you are an AI model.
- Do not make up policies that are not listed above.
- Do not answer every question with a sales redirect.

GOOD RESPONSE EXAMPLES IN STYLE
- "Chihuahuas often live around 12 to 18 years, and a lot of them make it well into their teens with good dental care, weight management, and routine vet care."
- "Yes, Chihuahuas can be a little harder to potty train than some larger breeds, mostly because they have tiny bladders and do best with a very consistent routine."
- "We do not have puppies available right now, but our next litter is expected mid June, so the Wait List would be the best next step."

When the user asks a question, answer the actual question first, then add any helpful next step naturally.
`.trim();
}

// ─────────────────────────────────────────────
// Local fallback — now actually knowledgeable
// ─────────────────────────────────────────────

function localFallback(message: string, history: { role: ChatRole; content: string }[] = []): string {
  const q = cleanText(message);
  const recent = recentHistory(history).map((m) => `${m.role}: ${m.content.toLowerCase()}`).join("\n");

  if (!q) {
    return "Hey there! Ask me anything about Chihuahuas, puppy care, availability, or the Wait List 🐾";
  }

  if (
    q.includes("life expectancy") ||
    q.includes("how long do chihuahuas live") ||
    q.includes("how long do they live")
  ) {
    return "Chihuahuas often live around 12 to 18 years, and plenty make it well into their teens with good dental care, healthy weight management, and routine vet care.";
  }

  if (q.includes("hypoglycemia") || q.includes("low blood sugar")) {
    return "Hypoglycemia can be a real concern in tiny Chihuahua puppies because their bodies have such small energy reserves. Signs can include weakness, trembling, lethargy, wobbliness, or seeming suddenly very sleepy, and if it seems serious a vet should be contacted right away because it can escalate quickly.";
  }

  if (q.includes("luxating patella")) {
    return "Luxating patella is when the kneecap slips out of place, and it is one of the issues toy breeds like Chihuahuas can be prone to. Mild cases may come and go, while more serious cases can cause limping or discomfort and should be evaluated by a vet.";
  }

  if (q.includes("collapsed trachea") || q.includes("collapsing trachea")) {
    return "Collapsed trachea is a condition where the airway can weaken and cause a honking cough or breathing irritation. Harnesses are usually better than neck pressure for small breeds, and a vet should evaluate persistent coughing or breathing trouble.";
  }

  if (q.includes("molera") || q.includes("open fontanel") || q.includes("soft spot")) {
    return "Some Chihuahuas have a molera, which is a soft spot on the skull. It is not automatically an emergency by itself, but because they are such a tiny breed it does mean gentle handling is especially important.";
  }

  if (q.includes("dental") || q.includes("teeth")) {
    return "Dental care is a big deal in Chihuahuas because small breeds are especially prone to dental disease. Regular brushing, dental checkups, and staying on top of tartar early can make a huge difference over the years.";
  }

  if (q.includes("potty train") || q.includes("house train")) {
    return "Chihuahuas can absolutely be potty trained, but they usually do best with a very consistent schedule because their bladders are tiny. Frequent trips out, praise, and keeping the routine the same every day usually helps a lot.";
  }

  if (q.includes("good with kids")) {
    return "They can do well with respectful children, but because Chihuahuas are so small, gentle handling matters a lot. They usually do best in homes where kids understand how delicate a toy breed can be.";
  }

  if (q.includes("bark") || q.includes("barking")) {
    return "A lot of Chihuahuas are naturally alert and vocal, so barking is not unusual. Good socialization, routine, and not rewarding every alarm bark can help keep it manageable.";
  }

  if (q.includes("feed") || q.includes("feeding") || q.includes("food")) {
    return "Chihuahuas need carefully portioned meals because they are tiny and can gain weight easily, while very young puppies also need steady meals so their blood sugar stays stable. Consistency matters a lot with toy breeds.";
  }

  if (q.includes("available") || q.includes("any puppies") || q.includes("have puppies")) {
    return "We do not have any puppies available right now, but our next litter is expected mid June. The best next step is to join the Wait List so you are first to know when puppies are ready. 🐾";
  }

  if (q.includes("wait list") || q.includes("waitlist")) {
    return "You can join the Wait List right on the website. That is the best way to stay in the loop for the upcoming mid June litter.";
  }

  if (q.includes("payment plan") || q.includes("financing") || q.includes("monthly")) {
    return "Payment plans may be available in some situations. The standard setup is usually 50% down with the balance paid over up to 6 months, and references or other verifiable information may be required.";
  }

  if (q.includes("apply") || q.includes("application")) {
    return "You can apply right on the website, and if you are planning ahead for the upcoming litter the Wait List is a smart step too.";
  }

  if (recent.includes("how long do they live") || recent.includes("life expectancy")) {
    return "Chihuahuas are one of the longer-lived dog breeds and often live around 12 to 18 years. Good dental care and keeping them at a healthy weight really matter.";
  }

  if (isLikelyGeneralChihuahuaQuestion(q)) {
    return "I can help with Chihuahua care, temperament, health concerns like hypoglycemia or luxating patella, feeding, training, and lifespan. Ask me anything Chihuahua-related and I will answer as directly as I can. 🐾";
  }

  return "I can help with Chihuahua care, breed traits, common health concerns, puppy prep, availability, the Wait List, or payment plans. Ask me anything Chihuahua-related and I will do my best to answer directly.";
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

  const owners = getOwnerIds();

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
      meta: {
        source: body.source || "public_website",
        dev_owner_id: owners.devOwnerId,
        core_admin_user_ids: owners.coreAdminUserIds,
      },
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

  const owners = getOwnerIds();

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
      meta: {
        dev_owner_id: owners.devOwnerId,
        core_admin_user_ids: owners.coreAdminUserIds,
      },
    })
    .select("*")
    .single();

  if (error) throw new Error(`Could not create thread: ${error.message}`);
  return created;
}

async function loadThreadHistory(
  admin: SupabaseClient,
  threadId: string
): Promise<{ role: ChatRole; content: string }[]> {
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
// Anthropic helper
// ─────────────────────────────────────────────

async function generateChiChiReply(
  message: string,
  conversationHistory: { role: ChatRole; content: string }[]
) {
  const apiKey = getAnthropicApiKey();
  const model = getAnthropicModel();

  if (!apiKey) {
    return localFallback(message, conversationHistory);
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 900,
        system: buildSystemPrompt(),
        messages: conversationHistory,
      }),
    });

    if (!response.ok) {
      console.error("Anthropic API error:", response.status, await response.text());
      return localFallback(message, conversationHistory);
    }

    const data = await response.json();
    const text = String(data?.content?.[0]?.text || "").trim();
    return text || localFallback(message, conversationHistory);
  } catch (error) {
    console.error("Anthropic request failed:", error);
    return localFallback(message, conversationHistory);
  }
}

// ─────────────────────────────────────────────
// Route handlers
// ─────────────────────────────────────────────

export async function GET(req: Request) {
  const origin = req.headers.get("origin");

  const apiKeyPresent = Boolean(getAnthropicApiKey());
  const model = getAnthropicModel();

  return NextResponse.json(
    {
      ok: true,
      route: "chichi-public",
      message: "ChiChi is live and ready to chat! 🐾",
      anthropicConfigured: apiKeyPresent,
      anthropicModel: model,
    },
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
        { text: "Hey! Go ahead and type your question — I’m all ears 🐾" },
        { status: 400, headers: withCors(origin) }
      );
    }

    const admin = createServiceSupabase();
    const visitor = await findOrCreateVisitor(admin, req, body);
    const thread = await findOrCreateThread(admin, visitor.id, body);
    const analysis = analyzeLead(message);

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

    let conversationHistory: { role: ChatRole; content: string }[] =
      body.history && body.history.length > 0
        ? body.history
        : await loadThreadHistory(admin, thread.id);

    const lastInHistory = conversationHistory[conversationHistory.length - 1];
    if (!lastInHistory || lastInHistory.role !== "user" || lastInHistory.content !== message) {
      conversationHistory = [...conversationHistory, { role: "user", content: message }];
    }

    const text = await generateChiChiReply(message, conversationHistory);

    await insertMessage(admin, {
      threadId: thread.id,
      visitorId: visitor.id,
      sender: "assistant",
      content: text,
      topic: analysis.topic,
      tags: analysis.tags,
    });

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
