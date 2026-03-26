// FILE: app/api/buildlio/route.ts
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type RequestBody = {
  messages?: ChatMessage[];
  max_tokens?: number;
  threadId?: string | null;
  accessToken?: string | null;
};

type BuyerRecord = {
  id: number;
  user_id: string | null;
  full_name: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  puppy_id: number | null;
  puppy: string | null;
  sale_price: number | null;
  deposit_amount: number | null;
  deposit_date: string | null;
  finance_enabled: boolean | null;
  finance_admin_fee: boolean | null;
  finance_rate: number | null;
  finance_months: number | null;
  finance_monthly_amount: number | null;
  finance_day_of_month: number | null;
  finance_next_due_date: string | null;
  finance_last_payment_date: string | null;
  notes: string | null;
};

type PuppyRecord = {
  id: number;
  buyer_id: number | null;
  call_name: string | null;
  puppy_name: string | null;
  name: string | null;
  sex: string | null;
  color: string | null;
  coat_type: string | null;
  coat: string | null;
  pattern: string | null;
  dob: string | null;
  status: string | null;
  price: number | null;
  deposit: number | null;
  balance: number | null;
  photo_url: string | null;
  image_url: string | null;
  description: string | null;
  current_weight: number | null;
  weight_unit: string | null;
  weight_date: string | null;
  microchip: string | null;
  registration_no: string | null;
};

type PaymentRecord = {
  id: string;
  payment_date: string;
  amount: number;
  payment_type: string | null;
  method: string | null;
  note: string | null;
  status: string | null;
  reference_number: string | null;
};

type FormRecord = {
  id: number;
  form_key: string;
  form_title: string | null;
  version: string | null;
  status: string;
  signed_name: string | null;
  signed_date: string | null;
  signed_at: string | null;
  submitted_at: string | null;
};

type MessageRecord = {
  id: string;
  created_at: string;
  subject: string | null;
  message: string;
  status: string;
  read_by_admin: boolean;
  read_by_user: boolean;
  sender: string;
};

type PickupRecord = {
  id: number;
  created_at: string | null;
  puppy_id: number | null;
  request_date: string | null;
  request_type: string | null;
  location_text: string | null;
  notes: string | null;
  status: string | null;
  address_text: string | null;
  miles: number | null;
};

type EventRecord = {
  id: number;
  puppy_id: number;
  event_date: string;
  event_type: string;
  label: string | null;
  title: string | null;
  summary: string | null;
  details: string | null;
  value: number | null;
  unit: string | null;
  auto_generated: boolean | null;
  is_private: boolean | null;
  is_published: boolean | null;
  sort_order: number | null;
};

type HealthRecord = {
  id: number;
  record_date: string;
  record_type: string;
  title: string;
  description: string | null;
  provider_name: string | null;
  medication_name: string | null;
  dosage: string | null;
  lot_number: string | null;
  next_due_date: string | null;
  is_visible_to_buyer: boolean;
};

type WeightRecord = {
  id: number;
  weigh_date: string | null;
  weight_date?: string | null;
  age_weeks: number | null;
  weight_oz: number | null;
  weight_g: number | null;
  notes: string | null;
  source: string | null;
};

type DocumentRecord = {
  id: number;
  created_at: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string | null;
  source_table: string | null;
  source_id: string | number | null;
  file_url: string | null;
  file_name: string | null;
  visible_to_user: boolean | null;
  signed_at: string | null;
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-3-5-sonnet-latest";

function jsonError(text: string, status = 400) {
  return NextResponse.json({ text }, { status });
}

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getBearerToken(req: Request, body?: RequestBody): string | null {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  if (body?.accessToken && typeof body.accessToken === "string") {
    return body.accessToken.trim();
  }
  return null;
}

function createAnonSupabase(): SupabaseClient {
  return createClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function createServiceSupabase(): SupabaseClient {
  return createClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function coalesceName(buyer: BuyerRecord | null, puppy: PuppyRecord | null): string {
  return (
    puppy?.call_name ||
    puppy?.puppy_name ||
    puppy?.name ||
    buyer?.full_name ||
    buyer?.name ||
    "your puppy"
  );
}

function sumPayments(payments: PaymentRecord[]): number {
  return payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
}

function safeLast<T>(items: T[]): T | null {
  return items.length ? items[items.length - 1] : null;
}

function compactObject<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== null && value !== undefined && value !== "")
  ) as T;
}

async function verifyUser(req: Request, body: RequestBody) {
  const accessToken = getBearerToken(req, body);
  if (!accessToken) return { user: null, accessToken: null };

  const anon = createAnonSupabase();
  const { data, error } = await anon.auth.getUser(accessToken);

  if (error || !data.user) {
    return { user: null, accessToken };
  }

  return { user: data.user, accessToken };
}

async function getBuyerContext(admin: SupabaseClient, userId: string) {
  const { data: buyer, error } = await admin
    .from("buyers")
    .select(`
      id,
      user_id,
      full_name,
      name,
      email,
      phone,
      status,
      puppy_id,
      puppy,
      sale_price,
      deposit_amount,
      deposit_date,
      finance_enabled,
      finance_admin_fee,
      finance_rate,
      finance_months,
      finance_monthly_amount,
      finance_day_of_month,
      finance_next_due_date,
      finance_last_payment_date,
      notes
    `)
    .eq("user_id", userId)
    .maybeSingle<BuyerRecord>();

  if (error) throw new Error(`Failed to load buyer context: ${error.message}`);
  return buyer;
}

async function getPuppyContext(admin: SupabaseClient, buyer: BuyerRecord | null) {
  if (!buyer) return null;

  let query = admin
    .from("puppies")
    .select(`
      id,
      buyer_id,
      call_name,
      puppy_name,
      name,
      sex,
      color,
      coat_type,
      coat,
      pattern,
      dob,
      status,
      price,
      deposit,
      balance,
      photo_url,
      image_url,
      description,
      current_weight,
      weight_unit,
      weight_date,
      microchip,
      registration_no
    `)
    .limit(1);

  if (buyer.puppy_id) {
    query = query.eq("id", buyer.puppy_id);
  } else {
    query = query.eq("buyer_id", buyer.id);
  }

  const { data, error } = await query.maybeSingle<PuppyRecord>();
  if (error) throw new Error(`Failed to load puppy context: ${error.message}`);
  return data;
}

async function getPayments(admin: SupabaseClient, buyerId: number | null) {
  if (!buyerId) return [];
  const { data, error } = await admin
    .from("buyer_payments")
    .select(`
      id,
      payment_date,
      amount,
      payment_type,
      method,
      note,
      status,
      reference_number
    `)
    .eq("buyer_id", buyerId)
    .order("payment_date", { ascending: true })
    .returns<PaymentRecord[]>();

  if (error) throw new Error(`Failed to load payments: ${error.message}`);
  return data || [];
}

async function getForms(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("portal_form_submissions")
    .select(`
      id,
      form_key,
      form_title,
      version,
      status,
      signed_name,
      signed_date,
      signed_at,
      submitted_at
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(25)
    .returns<FormRecord[]>();

  if (error) throw new Error(`Failed to load forms: ${error.message}`);
  return data || [];
}

async function getMessages(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("portal_messages")
    .select(`
      id,
      created_at,
      subject,
      message,
      status,
      read_by_admin,
      read_by_user,
      sender
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(25)
    .returns<MessageRecord[]>();

  if (error) throw new Error(`Failed to load portal messages: ${error.message}`);
  return data || [];
}

async function getPickupRequests(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("portal_pickup_requests")
    .select(`
      id,
      created_at,
      puppy_id,
      request_date,
      request_type,
      location_text,
      notes,
      status,
      address_text,
      miles
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<PickupRecord[]>();

  if (error) throw new Error(`Failed to load pickup requests: ${error.message}`);
  return data || [];
}

async function getEvents(admin: SupabaseClient, puppyId: number | null) {
  if (!puppyId) return [];
  const { data, error } = await admin
    .from("puppy_events")
    .select(`
      id,
      puppy_id,
      event_date,
      event_type,
      label,
      title,
      summary,
      details,
      value,
      unit,
      auto_generated,
      is_private,
      is_published,
      sort_order
    `)
    .eq("puppy_id", puppyId)
    .or("is_private.is.null,is_private.eq.false")
    .order("event_date", { ascending: true })
    .order("sort_order", { ascending: true })
    .returns<EventRecord[]>();

  if (error) throw new Error(`Failed to load puppy events: ${error.message}`);
  return data || [];
}

async function getHealthRecords(admin: SupabaseClient, puppyId: number | null) {
  if (!puppyId) return [];
  const { data, error } = await admin
    .from("puppy_health_records")
    .select(`
      id,
      record_date,
      record_type,
      title,
      description,
      provider_name,
      medication_name,
      dosage,
      lot_number,
      next_due_date,
      is_visible_to_buyer
    `)
    .eq("puppy_id", puppyId)
    .eq("is_visible_to_buyer", true)
    .order("record_date", { ascending: true })
    .returns<HealthRecord[]>();

  if (error) throw new Error(`Failed to load health records: ${error.message}`);
  return data || [];
}

async function getWeights(admin: SupabaseClient, puppyId: number | null) {
  if (!puppyId) return [];
  const { data, error } = await admin
    .from("puppy_weights")
    .select(`
      id,
      weigh_date,
      weight_date,
      age_weeks,
      weight_oz,
      weight_g,
      notes,
      source
    `)
    .eq("puppy_id", puppyId)
    .order("weigh_date", { ascending: true, nullsFirst: false })
    .returns<WeightRecord[]>();

  if (error) throw new Error(`Failed to load puppy weights: ${error.message}`);
  return data || [];
}

async function getDocuments(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("portal_documents")
    .select(`
      id,
      created_at,
      title,
      description,
      category,
      status,
      source_table,
      source_id,
      file_url,
      file_name,
      visible_to_user,
      signed_at
    `)
    .eq("user_id", userId)
    .or("visible_to_user.is.null,visible_to_user.eq.true")
    .order("created_at", { ascending: false })
    .limit(25)
    .returns<DocumentRecord[]>();

  if (error) throw new Error(`Failed to load portal documents: ${error.message}`);
  return data || [];
}

function buildContextSummary(params: {
  buyer: BuyerRecord | null;
  puppy: PuppyRecord | null;
  payments: PaymentRecord[];
  forms: FormRecord[];
  messages: MessageRecord[];
  pickupRequests: PickupRecord[];
  events: EventRecord[];
  healthRecords: HealthRecord[];
  weights: WeightRecord[];
  documents: DocumentRecord[];
}) {
  const {
    buyer,
    puppy,
    payments,
    forms,
    messages,
    pickupRequests,
    events,
    healthRecords,
    weights,
    documents,
  } = params;

  const paidTotal = sumPayments(payments);
  const salePrice = Number(buyer?.sale_price || puppy?.price || 0);
  const remainingBalance =
    puppy?.balance != null
      ? Number(puppy.balance)
      : salePrice > 0
        ? Math.max(0, salePrice - paidTotal)
        : null;

  const latestPayment = safeLast(payments);
  const latestEvent = events.filter((e) => !!e.event_date).slice(-1)[0] || null;
  const latestHealth = healthRecords.slice(-1)[0] || null;
  const latestWeight = weights.slice(-1)[0] || null;
  const latestPickupRequest = pickupRequests[0] || null;
  const unsignedForms = forms.filter((f) => f.status !== "submitted" && f.status !== "signed");
  const unreadAdminReplies = messages.filter(
    (m) => m.sender === "admin" && m.read_by_user === false
  );

  return {
    buyer: buyer
      ? compactObject({
          id: buyer.id,
          name: buyer.full_name || buyer.name,
          email: buyer.email,
          phone: buyer.phone,
          status: buyer.status,
          finance_enabled: buyer.finance_enabled,
          finance_rate: buyer.finance_rate,
          finance_months: buyer.finance_months,
          finance_monthly_amount: buyer.finance_monthly_amount,
          finance_next_due_date: buyer.finance_next_due_date,
          finance_last_payment_date: buyer.finance_last_payment_date,
          sale_price: buyer.sale_price,
          deposit_amount: buyer.deposit_amount,
          deposit_date: buyer.deposit_date,
        })
      : null,

    puppy: puppy
      ? compactObject({
          id: puppy.id,
          name: puppy.call_name || puppy.puppy_name || puppy.name,
          dob: puppy.dob,
          sex: puppy.sex,
          color: puppy.color,
          coat_type: puppy.coat_type || puppy.coat,
          pattern: puppy.pattern,
          status: puppy.status,
          price: puppy.price,
          deposit: puppy.deposit,
          balance: puppy.balance,
          current_weight: puppy.current_weight,
          weight_unit: puppy.weight_unit,
          weight_date: puppy.weight_date,
          microchip: puppy.microchip,
          registration_no: puppy.registration_no,
        })
      : null,

    financial_summary: {
      sale_price: salePrice || null,
      paid_total: paidTotal || 0,
      remaining_balance: remainingBalance,
      next_due_date: buyer?.finance_next_due_date || null,
      latest_payment: latestPayment
        ? compactObject({
            payment_date: latestPayment.payment_date,
            amount: latestPayment.amount,
            method: latestPayment.method,
            status: latestPayment.status,
          })
        : null,
    },

    portal_summary: {
      forms_total: forms.length,
      forms_unsigned_count: unsignedForms.length,
      messages_total: messages.length,
      unread_admin_replies: unreadAdminReplies.length,
      pickup_requests_total: pickupRequests.length,
      documents_total: documents.length,
    },

    latest_updates: {
      latest_event: latestEvent
        ? compactObject({
            event_date: latestEvent.event_date,
            event_type: latestEvent.event_type,
            title: latestEvent.title || latestEvent.label,
            summary: latestEvent.summary || latestEvent.details,
          })
        : null,
      latest_health: latestHealth
        ? compactObject({
            record_date: latestHealth.record_date,
            record_type: latestHealth.record_type,
            title: latestHealth.title,
            description: latestHealth.description,
            next_due_date: latestHealth.next_due_date,
          })
        : null,
      latest_weight: latestWeight
        ? compactObject({
            weigh_date: latestWeight.weigh_date || latestWeight.weight_date,
            age_weeks: latestWeight.age_weeks,
            weight_oz: latestWeight.weight_oz,
            weight_g: latestWeight.weight_g,
          })
        : null,
      latest_pickup_request: latestPickupRequest
        ? compactObject({
            request_date: latestPickupRequest.request_date,
            request_type: latestPickupRequest.request_type,
            location_text: latestPickupRequest.location_text,
            status: latestPickupRequest.status,
            miles: latestPickupRequest.miles,
          })
        : null,
    },

    recent_forms: forms.slice(0, 8).map((f) =>
      compactObject({
        form_key: f.form_key,
        form_title: f.form_title,
        status: f.status,
        signed_date: f.signed_date,
        submitted_at: f.submitted_at,
      })
    ),

    recent_messages: messages.slice(0, 8).map((m) =>
      compactObject({
        created_at: m.created_at,
        subject: m.subject,
        sender: m.sender,
        status: m.status,
        read_by_user: m.read_by_user,
        message: m.message,
      })
    ),

    recent_documents: documents.slice(0, 8).map((d) =>
      compactObject({
        title: d.title,
        category: d.category,
        status: d.status,
        file_name: d.file_name,
        signed_at: d.signed_at,
      })
    ),

    recent_events: events.slice(-10).map((e) =>
      compactObject({
        event_date: e.event_date,
        event_type: e.event_type,
        title: e.title || e.label,
        summary: e.summary || e.details,
        auto_generated: e.auto_generated,
      })
    ),

    recent_health_records: healthRecords.slice(-10).map((h) =>
      compactObject({
        record_date: h.record_date,
        record_type: h.record_type,
        title: h.title,
        description: h.description,
        next_due_date: h.next_due_date,
      })
    ),

    recent_weights: weights.slice(-10).map((w) =>
      compactObject({
        weigh_date: w.weigh_date || w.weight_date,
        age_weeks: w.age_weeks,
        weight_oz: w.weight_oz,
        weight_g: w.weight_g,
        notes: w.notes,
      })
    ),
  };
}

function buildSystemPrompt(summary: ReturnType<typeof buildContextSummary>) {
  return `
You are ChiChi Assistant for Southwest Virginia Chihuahua.

Your role:
- Help the logged-in user understand their portal, puppy, payments, documents, messages, pickup requests, milestones, health records, and weight history.
- Answer clearly, warmly, and professionally.
- Be grounded in the supplied account data.
- If the data is missing, say that plainly.
- Never invent records, dates, balances, documents, health events, or statuses.
- Do not describe yourself as a builder, website generator, or app generator.
- Do not use sci-fi, domination, manifestation, apex, neural-link, or system-diagnostic language.
- Do not claim to have performed actions you did not perform.
- Prefer concise, helpful answers.
- When useful, end with a short next step based on the actual account data.

Important answer rules:
- Treat the database context as the source of truth.
- If asked about money owed, use remaining_balance when available.
- If asked about the latest milestone, use latest_event.
- If asked about health, use latest_health and recent_health_records.
- If asked about forms or documents, use recent_forms and recent_documents.
- If asked about pickup or delivery, use latest_pickup_request and pickup summary.
- If the user asks something outside their account data, answer generally but clearly separate general guidance from account-specific facts.

Current account context:
${JSON.stringify(summary, null, 2)}
`.trim();
}

async function saveConversation(params: {
  admin: SupabaseClient;
  threadId?: string | null;
  userId: string;
  buyerId: number | null;
  puppyId: number | null;
  userMessage: string;
  assistantMessage: string;
}) {
  const { admin, threadId, userId, buyerId, puppyId, userMessage, assistantMessage } = params;

  let activeThreadId = threadId || null;

  if (!activeThreadId) {
    const { data: newThread, error: threadError } = await admin
      .from("chichi_threads")
      .insert({
        user_id: userId,
        buyer_id: buyerId,
        puppy_id: puppyId,
        title: "ChiChi Conversation",
        status: "active",
        source: "portal",
      })
      .select("id")
      .single<{ id: string }>();

    if (threadError) {
      console.error("ChiChi thread create error:", threadError);
    } else {
      activeThreadId = newThread.id;
    }
  }

  if (!activeThreadId) return null;

  const inserts = [
    {
      thread_id: activeThreadId,
      user_id: userId,
      buyer_id: buyerId,
      puppy_id: puppyId,
      sender: "user",
      content: userMessage,
      meta: {},
    },
    {
      thread_id: activeThreadId,
      user_id: userId,
      buyer_id: buyerId,
      puppy_id: puppyId,
      sender: "assistant",
      content: assistantMessage,
      meta: {},
    },
  ];

  const { error: messageError } = await admin.from("chichi_messages").insert(inserts);

  if (messageError) {
    console.error("ChiChi message save error:", messageError);
  }

  await admin
    .from("chichi_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", activeThreadId);

  return activeThreadId;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const lastUserMessage =
      [...messages].reverse().find((message) => message.role === "user")?.content?.trim() || "";

    if (!lastUserMessage) {
      return jsonError("Please enter a message for ChiChi.", 400);
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return jsonError("ChiChi is not configured yet. The Anthropic API key is missing.", 500);
    }

    const { user } = await verifyUser(req, body);
    if (!user) {
      return jsonError("Please sign in to use ChiChi with your account.", 401);
    }

    const admin = createServiceSupabase();
    const buyer = await getBuyerContext(admin, user.id);
    const puppy = await getPuppyContext(admin, buyer);

    const [payments, forms, portalMessages, pickupRequests, events, healthRecords, weights, documents] =
      await Promise.all([
        getPayments(admin, buyer?.id ?? null),
        getForms(admin, user.id),
        getMessages(admin, user.id),
        getPickupRequests(admin, user.id),
        getEvents(admin, puppy?.id ?? null),
        getHealthRecords(admin, puppy?.id ?? null),
        getWeights(admin, puppy?.id ?? null),
        getDocuments(admin, user.id),
      ]);

    const summary = buildContextSummary({
      buyer,
      puppy,
      payments,
      forms,
      messages: portalMessages,
      pickupRequests,
      events,
      healthRecords,
      weights,
      documents,
    });

    const system = buildSystemPrompt(summary);

    const anthropicResponse = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": getEnv("ANTHROPIC_API_KEY"),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: body.max_tokens || 1200,
        system,
        messages: messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      }),
    });

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      console.error("Anthropic API Error:", errorText);
      return jsonError("ChiChi had trouble generating a response right now.", 502);
    }

    const anthropicData = await anthropicResponse.json();
    const text = anthropicData?.content?.[0]?.text?.trim();

    if (!text) {
      return jsonError("ChiChi could not generate a response.", 502);
    }

    const threadId = await saveConversation({
      admin,
      threadId: body.threadId,
      userId: user.id,
      buyerId: buyer?.id ?? null,
      puppyId: puppy?.id ?? null,
      userMessage: lastUserMessage,
      assistantMessage: text,
    });

    return NextResponse.json({
      text,
      assistant: "ChiChi",
      threadId,
      context: {
        buyerName: buyer?.full_name || buyer?.name || null,
        puppyName: coalesceName(buyer, puppy),
      },
    });
  } catch (error) {
    console.error("ChiChi route error:", error);
    return NextResponse.json(
      {
        text: "ChiChi ran into a server error while loading your account.",
      },
      { status: 500 }
    );
  }
}