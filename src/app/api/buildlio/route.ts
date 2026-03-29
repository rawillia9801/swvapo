// FILE: app/api/buildlio/route.ts
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isPortalAdminEmail } from "@/lib/portal-admin";

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

type AdminAuthContext = {
  userId: string | null;
  email: string | null;
  canWriteCore: boolean;
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
  w_1?: number | null;
  w_2?: number | null;
  w_3?: number | null;
  w_4?: number | null;
  w_5?: number | null;
  w_6?: number | null;
  w_7?: number | null;
  w_8?: number | null;
  registry?: string | null;
  owner_email?: string | null;
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

type ActionIntent =
  | {
      action: "answer_only";
      confidence?: string;
      reason?: string;
    }
  | {
      action: "add_puppy";
      confidence?: string;
      call_name?: string | null;
      puppy_name?: string | null;
      name?: string | null;
      litter_name?: string | null;
      sire?: string | null;
      dam?: string | null;
      sex?: string | null;
      color?: string | null;
      coat_type?: string | null;
      pattern?: string | null;
      dob?: string | null;
      registry?: string | null;
      price?: number | null;
      status?: string | null;
      buyer_name?: string | null;
      buyer_email?: string | null;
      owner_email?: string | null;
      birth_weight?: number | null;
      current_weight?: number | null;
      w_1?: number | null;
      w_2?: number | null;
      w_3?: number | null;
      w_4?: number | null;
      w_5?: number | null;
      w_6?: number | null;
      w_7?: number | null;
      w_8?: number | null;
      weight_date?: string | null;
      weight_oz?: number | null;
      weight_g?: number | null;
      microchip?: string | null;
      registration_no?: string | null;
      notes?: string | null;
      description?: string | null;
    }
  | {
      action: "add_puppy_event";
      confidence?: string;
      puppy_name?: string | null;
      puppy_id?: number | null;
      event_date?: string | null;
      event_type?: string | null;
      label?: string | null;
      title?: string | null;
      summary?: string | null;
      details?: string | null;
      value?: number | null;
      unit?: string | null;
      is_published?: boolean | null;
    }
  | {
      action: "log_payment";
      confidence?: string;
      buyer_name?: string | null;
      buyer_email?: string | null;
      puppy_name?: string | null;
      amount?: number | null;
      payment_date?: string | null;
      payment_type?: string | null;
      method?: string | null;
      note?: string | null;
      reference_number?: string | null;
      status?: string | null;
    }
  | {
      action: "add_buyer";
      confidence?: string;
      full_name?: string | null;
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      status?: string | null;
      notes?: string | null;
    }
  | {
      action: "update_buyer";
      confidence?: string;
      buyer_id?: number | null;
      buyer_name?: string | null;
      buyer_email?: string | null;
      full_name?: string | null;
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      status?: string | null;
      notes?: string | null;
    }
  | {
      action: "delete_buyer";
      confidence?: string;
      buyer_id?: number | null;
      buyer_name?: string | null;
      buyer_email?: string | null;
      buyer_names?: string[] | null;
    }
  | {
      action: "update_payment";
      confidence?: string;
      payment_id?: string | null;
      buyer_name?: string | null;
      buyer_email?: string | null;
      reference_number?: string | null;
      payment_date?: string | null;
      amount?: number | null;
      new_payment_date?: string | null;
      new_amount?: number | null;
      payment_type?: string | null;
      method?: string | null;
      note?: string | null;
      status?: string | null;
    }
  | {
      action: "delete_payment";
      confidence?: string;
      payment_id?: string | null;
      buyer_name?: string | null;
      buyer_email?: string | null;
      reference_number?: string | null;
      payment_date?: string | null;
      amount?: number | null;
    }
  | {
      action: "add_puppy_weight";
      confidence?: string;
      puppy_name?: string | null;
      puppy_id?: number | null;
      weight_date?: string | null;
      age_weeks?: number | null;
      weight_oz?: number | null;
      weight_g?: number | null;
      notes?: string | null;
      source?: string | null;
    }
  | {
      action: "update_puppy";
      confidence?: string;
      puppy_name?: string | null;
      puppy_names?: string[] | null;
      puppy_id?: number | null;
      call_name?: string | null;
      new_puppy_name?: string | null;
      name?: string | null;
      litter_name?: string | null;
      sire?: string | null;
      dam?: string | null;
      sex?: string | null;
      color?: string | null;
      coat_type?: string | null;
      pattern?: string | null;
      dob?: string | null;
      registry?: string | null;
      price?: number | null;
      status?: string | null;
      buyer_name?: string | null;
      buyer_email?: string | null;
      owner_email?: string | null;
      birth_weight?: number | null;
      current_weight?: number | null;
      w_1?: number | null;
      w_2?: number | null;
      w_3?: number | null;
      w_4?: number | null;
      w_5?: number | null;
      w_6?: number | null;
      w_7?: number | null;
      w_8?: number | null;
      weight_date?: string | null;
      weight_oz?: number | null;
      weight_g?: number | null;
      microchip?: string | null;
      registration_no?: string | null;
      notes?: string | null;
      description?: string | null;
    }
  | {
      action: "delete_puppy";
      confidence?: string;
      puppy_name?: string | null;
      puppy_names?: string[] | null;
      puppy_id?: number | null;
    }
  | {
      action: "update_puppy_event";
      confidence?: string;
      event_id?: number | null;
      puppy_name?: string | null;
      puppy_id?: number | null;
      event_date?: string | null;
      label?: string | null;
      title?: string | null;
      event_type?: string | null;
      summary?: string | null;
      details?: string | null;
      value?: number | null;
      unit?: string | null;
      is_published?: boolean | null;
    }
  | {
      action: "delete_puppy_event";
      confidence?: string;
      event_id?: number | null;
      puppy_name?: string | null;
      puppy_id?: number | null;
      event_date?: string | null;
      label?: string | null;
      title?: string | null;
    }
  | {
      action: "update_puppy_weight";
      confidence?: string;
      weight_id?: number | null;
      puppy_name?: string | null;
      puppy_id?: number | null;
      weight_date?: string | null;
      new_weight_date?: string | null;
      age_weeks?: number | null;
      weight_oz?: number | null;
      weight_g?: number | null;
      notes?: string | null;
      source?: string | null;
    }
  | {
      action: "delete_puppy_weight";
      confidence?: string;
      weight_id?: number | null;
      puppy_name?: string | null;
      puppy_id?: number | null;
      weight_date?: string | null;
      weight_oz?: number | null;
      weight_g?: number | null;
    };

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

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

function getOptionalEnv(name: string): string | null {
  return process.env[name] || null;
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

function normalizeName(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function splitEnvList(...names: string[]): string[] {
  return names
    .flatMap((name) => String(getOptionalEnv(name) || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function isCoreWriteAllowed(user: { id: string; email?: string | null }): boolean {
  if (isPortalAdminEmail(user.email)) return true;

  const allowedIds = Array.from(
    new Set(
      splitEnvList(
        "DEV_OWNER_ID",
        "CORE_ADMIN_USER_IDS",
        "NEXT_PUBLIC_DEV_OWNER_ID",
        "NEXT_PUBLIC_CORE_ADMIN_USER_IDS"
      )
    )
  );

  const allowedEmails = Array.from(
    new Set(
      splitEnvList("CORE_ADMIN_EMAILS", "NEXT_PUBLIC_CORE_ADMIN_EMAILS").map((email) =>
        email.toLowerCase()
      )
    )
  );

  if (allowedIds.includes(user.id)) return true;
  if (user.email && allowedEmails.includes(String(user.email).trim().toLowerCase())) return true;
  return false;
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  const candidate = text.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
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
      registration_no,
      registry,
      owner_email
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

function buildSystemPrompt(
  summary: ReturnType<typeof buildContextSummary>,
  options?: { isAdmin?: boolean; canWriteCore?: boolean }
) {
  if (options?.isAdmin) {
    return `
You are ChiChi Assistant for Southwest Virginia Chihuahua.

Your role:
- Help authorized admins with Core admin chat commands and general portal questions.
- Keep answers concise, warm, and operationally clear.
- Never claim a database write succeeded unless the action handler already completed it.
- Never say you are unable to perform database writes when Core admin write access is enabled. If an action needs more detail, ask only for the missing fields.
- If the admin asks what commands are available, mention add, edit, and delete coverage for buyers, puppies, puppy events, payments, and puppy weights.
- If an admin request is missing details, ask for the exact missing fields only.
- If a request is ambiguous because multiple buyers, puppies, or payments could match, say that plainly and ask for one clarifying detail.

Current signed-in account context:
${JSON.stringify(summary, null, 2)}

Admin write access:
${options.canWriteCore ? "enabled" : "disabled"}
`.trim();
  }

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
- Be genuinely informative when the user asks general Chihuahua questions, care questions, breed facts, temperament questions, feeding basics, size expectations, coat care, training, or socialization.
- When answering general Chihuahua questions, clearly separate general guidance from account-specific facts.
- Prefer concise, helpful answers, but do not be vague if the user is asking for practical Chihuahua guidance.
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

function buildActionExtractionPrompt(userMessage: string, recentUserMessages: string[]) {
  return `
You are extracting a command intent for ChiChi / Core.

Return ONLY valid JSON.
No markdown.
No explanation.

Allowed actions:
- "answer_only"
- "add_buyer"
- "update_buyer"
- "delete_buyer"
- "add_puppy"
- "update_puppy"
- "delete_puppy"
- "add_puppy_event"
- "update_puppy_event"
- "delete_puppy_event"
- "log_payment"
- "update_payment"
- "delete_payment"
- "add_puppy_weight"
- "update_puppy_weight"
- "delete_puppy_weight"

Use "answer_only" if the message is mostly a question, lookup, explanation, or lacks enough intent to act.

For "add_buyer", try to extract:
full_name, name, email, phone, status, notes

For "update_buyer", try to extract:
buyer_id, buyer_name, buyer_email, full_name, name, email, phone, status, notes

For "delete_buyer", try to extract:
buyer_id, buyer_name, buyer_email, buyer_names

For "add_puppy", try to extract:
call_name, puppy_name, name, litter_name, sire, dam, sex, color, coat_type, pattern, dob, registry, price, status, buyer_name, buyer_email, owner_email, birth_weight, current_weight, w_1, w_2, w_3, w_4, w_5, w_6, w_7, w_8, weight_date, weight_oz, weight_g, microchip, registration_no, notes, description

For "update_puppy", try to extract:
puppy_id, puppy_name, puppy_names, call_name, new_puppy_name, name, litter_name, sire, dam, sex, color, coat_type, pattern, dob, registry, price, status, buyer_name, buyer_email, owner_email, birth_weight, current_weight, w_1, w_2, w_3, w_4, w_5, w_6, w_7, w_8, weight_date, weight_oz, weight_g, microchip, registration_no, notes, description

For "delete_puppy", try to extract:
puppy_id, puppy_name, puppy_names

For "add_puppy_event", try to extract:
puppy_name, puppy_id, event_date, event_type, label, title, summary, details, value, unit, is_published

For "update_puppy_event", try to extract:
event_id, puppy_name, puppy_id, event_date, label, title, event_type, summary, details, value, unit, is_published

For "delete_puppy_event", try to extract:
event_id, puppy_name, puppy_id, event_date, label, title

For "log_payment", try to extract:
buyer_name, buyer_email, puppy_name, amount, payment_date, payment_type, method, note, reference_number, status

For "update_payment", try to extract:
payment_id, buyer_name, buyer_email, reference_number, payment_date, amount, new_payment_date, new_amount, payment_type, method, note, status

For "delete_payment", try to extract:
payment_id, buyer_name, buyer_email, reference_number, payment_date, amount

For "add_puppy_weight", try to extract:
puppy_name, puppy_id, weight_date, age_weeks, weight_oz, weight_g, notes, source

For "update_puppy_weight", try to extract:
weight_id, puppy_name, puppy_id, weight_date, new_weight_date, age_weeks, weight_oz, weight_g, notes, source

For "delete_puppy_weight", try to extract:
weight_id, puppy_name, puppy_id, weight_date, weight_oz, weight_g

Use null for missing fields.
Use arrays when the user clearly listed multiple buyers or puppies to delete.
Use ISO date format YYYY-MM-DD when possible.
Use numbers for numeric fields.

Recent user messages for context:
${JSON.stringify(recentUserMessages)}

User message:
${JSON.stringify(userMessage)}
`.trim();
}

function parseMultiNameList(raw: string): string[] {
  return raw
    .split(/\band\b|,|&/i)
    .map((value) => value.replace(/\bpupp(y|ies)\b/gi, "").trim())
    .filter(Boolean);
}

function parseDirectActionIntent(userMessage: string): ActionIntent | null {
  const text = String(userMessage || "").trim();
  const lower = text.toLowerCase();

  if (lower.startsWith("delete puppy ") || lower.startsWith("delete puppies ")) {
    const names = parseMultiNameList(
      text.replace(/^delete puppies?\s*/i, "").replace(/\.$/, "")
    );
    if (names.length > 1) {
      return { action: "delete_puppy", puppy_names: names };
    }
    if (names.length === 1) {
      return { action: "delete_puppy", puppy_name: names[0] };
    }
  }

  if (lower.startsWith("add puppy")) {
    const nameMatch = text.match(/name[:,]?\s*([a-z0-9_-]+)/i);
    const bornToday = /\bborn today\b/i.test(text);
    const dobMatch = text.match(/\b(?:born|dob)[:\s-]*([0-9]{1,2}\/[0-9]{1,2}(?:\/[0-9]{2,4})?|[0-9]{4}-[0-9]{2}-[0-9]{2})/i);
    const weightOzMatch = text.match(/(\d+(?:\.\d+)?)\s*oz\b/i);
    const weightGMatch = text.match(/(\d+(?:\.\d+)?)\s*g\b/i);
    const coatMatch = text.match(/\b(long|smooth)\s+coat\b/i);
    const registryMatch = text.match(/\b(CKC|AKC|ACA|UKC)\b/i);

    const directName =
      nameMatch?.[1] ||
      text.replace(/^add puppy[:\s-]*/i, "").split(/[,\-]/)[0]?.trim() ||
      null;

    const normalizedName =
      directName && !/^(born|weight|coat|dam|sire)$/i.test(directName) ? directName : null;

    return {
      action: "add_puppy",
      puppy_name: normalizedName,
      call_name: normalizedName,
      name: normalizedName,
      dob: bornToday ? new Date().toISOString().slice(0, 10) : dobMatch?.[1] || null,
      weight_oz: weightOzMatch ? Number(weightOzMatch[1]) : null,
      weight_g: weightGMatch ? Number(weightGMatch[1]) : null,
      coat_type: coatMatch ? `${coatMatch[1]} coat` : null,
      registry: registryMatch?.[1] || null,
      notes: text,
    } as ActionIntent;
  }

  const bulkWeeksMatch = text.match(/^(?:edit|update)\s+puppy\s+(.+)$/i);
  if (bulkWeeksMatch && /\b(?:born|week\s*[1-8]|w[._\s-]*[1-8])\b/i.test(text)) {
    const puppyName =
      bulkWeeksMatch[1]
        ?.split(/\b(?:born|week\s*[1-8]|w[._\s-]*[1-8])\b/i)[0]
        ?.replace(/[,:-]+$/g, "")
        ?.trim() || null;

    if (puppyName) {
      const base: Extract<ActionIntent, { action: "update_puppy" }> = {
        action: "update_puppy",
        puppy_name: puppyName,
      };

      const bornMatch = text.match(/\bborn\b[^0-9]*([\d.]+)\s*(?:oz|ounces?)?/i);
      const weekPairs = Array.from(
        text.matchAll(/\b(?:week\s*([1-8])|w[._\s-]*([1-8]))\b[^0-9]*([\d.]+)\s*(?:oz|ounces?)?/gi)
      );

      if (bornMatch || weekPairs.length) {
        const weeklyValues: Partial<Extract<ActionIntent, { action: "update_puppy" }>> = {};

        if (bornMatch) weeklyValues.birth_weight = Number(bornMatch[1]) || null;

        for (const pair of weekPairs) {
          const weekNumber = Number(pair[1] || pair[2]);
          const weightValue = Number(pair[3]) || null;
          if (!weekNumber || weightValue === null) continue;

          if (weekNumber === 1) weeklyValues.w_1 = weightValue;
          if (weekNumber === 2) weeklyValues.w_2 = weightValue;
          if (weekNumber === 3) weeklyValues.w_3 = weightValue;
          if (weekNumber === 4) weeklyValues.w_4 = weightValue;
          if (weekNumber === 5) weeklyValues.w_5 = weightValue;
          if (weekNumber === 6) weeklyValues.w_6 = weightValue;
          if (weekNumber === 7) weeklyValues.w_7 = weightValue;
          if (weekNumber === 8) weeklyValues.w_8 = weightValue;
        }

        return { ...base, ...weeklyValues };
      }
    }
  }

  const updatePuppyMatch = text.match(
    /^(?:edit|update)\s+puppy\s+(.+?)\s+(?:set\s+)?(call name|name|litter name|sire|dam|sex|color|coat(?: type)?|pattern|dob|registry|status|microchip|registration(?: no\.?| number)?|birth weight|born|current weight|week\s*[1-8]|w[._\s-]*[1-8]|description|notes?)\s+(?:to\s+)?(.+)$/i
  );
  if (updatePuppyMatch) {
    const puppyName = updatePuppyMatch[1]?.trim() || null;
    const rawField = updatePuppyMatch[2]?.trim().toLowerCase() || "";
    const rawValue = updatePuppyMatch[3]?.trim() || null;
    const value = rawValue?.replace(/^["']|["']$/g, "") || null;

    if (puppyName && value) {
      const base: Extract<ActionIntent, { action: "update_puppy" }> = {
        action: "update_puppy",
        puppy_name: puppyName,
      };

      switch (rawField) {
        case "call name":
          return { ...base, call_name: value };
        case "name":
          return { ...base, new_puppy_name: value, name: value };
        case "litter name":
          return { ...base, litter_name: value };
        case "sire":
          return { ...base, sire: value };
        case "dam":
          return { ...base, dam: value };
        case "sex":
          return { ...base, sex: value };
        case "color":
          return { ...base, color: value };
        case "coat":
        case "coat type":
          return { ...base, coat_type: value };
        case "pattern":
          return { ...base, pattern: value };
        case "dob":
          return { ...base, dob: value };
        case "registry":
          return { ...base, registry: value };
        case "status":
          return { ...base, status: value };
        case "microchip":
          return { ...base, microchip: value };
        case "registration no":
        case "registration no.":
        case "registration number":
          return { ...base, registration_no: value };
        case "birth weight":
        case "born":
          return { ...base, birth_weight: Number(value.replace(/[^\d.]/g, "")) || null };
        case "current weight":
          return { ...base, current_weight: Number(value.replace(/[^\d.]/g, "")) || null };
        case "week 1":
        case "w 1":
        case "w_1":
        case "w-1":
          return { ...base, w_1: Number(value.replace(/[^\d.]/g, "")) || null };
        case "week 2":
        case "w 2":
        case "w_2":
        case "w-2":
          return { ...base, w_2: Number(value.replace(/[^\d.]/g, "")) || null };
        case "week 3":
        case "w 3":
        case "w_3":
        case "w-3":
          return { ...base, w_3: Number(value.replace(/[^\d.]/g, "")) || null };
        case "week 4":
        case "w 4":
        case "w_4":
        case "w-4":
          return { ...base, w_4: Number(value.replace(/[^\d.]/g, "")) || null };
        case "week 5":
        case "w 5":
        case "w_5":
        case "w-5":
          return { ...base, w_5: Number(value.replace(/[^\d.]/g, "")) || null };
        case "week 6":
        case "w 6":
        case "w_6":
        case "w-6":
          return { ...base, w_6: Number(value.replace(/[^\d.]/g, "")) || null };
        case "week 7":
        case "w 7":
        case "w_7":
        case "w-7":
          return { ...base, w_7: Number(value.replace(/[^\d.]/g, "")) || null };
        case "week 8":
        case "w 8":
        case "w_8":
        case "w-8":
          return { ...base, w_8: Number(value.replace(/[^\d.]/g, "")) || null };
        case "description":
          return { ...base, description: value };
        case "note":
        case "notes":
          return { ...base, notes: value };
      }
    }
  }

  return null;
}

function mergeIntentWithRecentContext(intent: ActionIntent, recentUserMessages: string[]): ActionIntent {
  if (intent.action === "add_puppy" && !(intent.call_name || intent.puppy_name || intent.name)) {
    const lastShortReply = [...recentUserMessages]
      .reverse()
      .find((message) => /^[a-z0-9_-]{2,40}$/i.test(String(message).trim()));

    if (lastShortReply) {
      return {
        ...intent,
        call_name: lastShortReply,
        puppy_name: lastShortReply,
        name: lastShortReply,
      };
    }
  }

  return intent;
}

async function extractActionIntent(userMessage: string, recentUserMessages: string[]): Promise<ActionIntent> {
  const directIntent = parseDirectActionIntent(userMessage);
  if (directIntent) {
    return mergeIntentWithRecentContext(directIntent, recentUserMessages);
  }

  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getEnv("ANTHROPIC_API_KEY"),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 500,
      system:
        "You extract structured JSON intents for a business assistant. Return only JSON. No prose.",
      messages: [
        {
          role: "user",
          content: buildActionExtractionPrompt(userMessage, recentUserMessages),
        },
      ],
    }),
  });

  if (!response.ok) {
    return { action: "answer_only", reason: "intent extraction failed" };
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text?.trim() || "";
  const parsed = extractJsonObject(text);

  if (!parsed || typeof parsed !== "object" || !parsed.action) {
    return { action: "answer_only", reason: "intent extraction returned invalid JSON" };
  }

  return mergeIntentWithRecentContext(parsed as ActionIntent, recentUserMessages);
}

async function findBuyerByNameOrEmail(
  admin: SupabaseClient,
  buyerName?: string | null,
  buyerEmail?: string | null
): Promise<BuyerRecord | null> {
  const email = String(buyerEmail || "").trim().toLowerCase();
  const name = normalizeName(buyerName);

  if (email) {
    const emailQueries = [
      admin.from("buyers").select("*").ilike("email", email).limit(1).maybeSingle<BuyerRecord>(),
    ];

    for (const q of emailQueries) {
      const { data, error } = await q;
      if (!error && data) return data;
    }
  }

  if (name) {
    const { data, error } = await admin.from("buyers").select("*").limit(200);
    if (!error && data?.length) {
      const match = data.find((b: BuyerRecord) => {
        const full = normalizeName(b.full_name);
        const simple = normalizeName(b.name);
        return full === name || simple === name;
      });
      if (match) return match as BuyerRecord;
    }
  }

  return null;
}

function paymentMatchesAmount(payment: PaymentRecord, amount?: number | null) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return true;
  return Number(payment.amount) === Number(amount);
}

async function findPuppyByNameOrId(
  admin: SupabaseClient,
  puppyName?: string | null,
  puppyId?: number | null
): Promise<PuppyRecord | null> {
  if (puppyId) {
    const { data, error } = await admin
      .from("puppies")
      .select("*")
      .eq("id", puppyId)
      .maybeSingle<PuppyRecord>();
    if (!error && data) return data;
  }

  const target = normalizeName(puppyName);
  if (!target) return null;

  const { data, error } = await admin.from("puppies").select("*").limit(300);
  if (error || !data?.length) return null;

  const match = data.find((p: PuppyRecord) => {
    const a = normalizeName(p.call_name);
    const b = normalizeName(p.puppy_name);
    const c = normalizeName(p.name);
    return a === target || b === target || c === target;
  });

  return (match as PuppyRecord) || null;
}

function missingFieldsForAction(intent: ActionIntent): string[] {
  if (intent.action === "add_buyer") {
    const missing: string[] = [];
    if (!intent.full_name && !intent.name) missing.push("buyer name");
    if (!intent.email) missing.push("buyer email");
    return missing;
  }

  if (intent.action === "update_buyer") {
    const missing: string[] = [];
    if (!intent.buyer_id && !intent.buyer_name && !intent.buyer_email) missing.push("buyer");
    if (
      !intent.full_name &&
      !intent.name &&
      !intent.email &&
      !intent.phone &&
      !intent.status &&
      !intent.notes
    ) {
      missing.push("what should change on the buyer");
    }
    return missing;
  }

  if (intent.action === "delete_buyer") {
    const missing: string[] = [];
    if (
      !intent.buyer_id &&
      !intent.buyer_name &&
      !intent.buyer_email &&
      !(intent.buyer_names && intent.buyer_names.length)
    ) {
      missing.push("buyer");
    }
    return missing;
  }

  if (intent.action === "add_puppy") {
    const hasName = !!(intent.call_name || intent.puppy_name || intent.name);
    const missing: string[] = [];
    if (!hasName) missing.push("puppy name");
    return missing;
  }

  if (intent.action === "update_puppy") {
    const missing: string[] = [];
    if (!intent.puppy_id && !intent.puppy_name && !(intent.puppy_names && intent.puppy_names.length)) {
      missing.push("puppy");
    }
    if (
      !intent.call_name &&
      !intent.new_puppy_name &&
      !intent.name &&
      !intent.litter_name &&
      !intent.sire &&
      !intent.dam &&
      !intent.sex &&
      !intent.color &&
      !intent.coat_type &&
      !intent.pattern &&
      !intent.dob &&
      !intent.registry &&
      (intent.price === null || intent.price === undefined) &&
      !intent.status &&
      !intent.buyer_name &&
      !intent.buyer_email &&
      !intent.owner_email &&
      (intent.birth_weight === null || intent.birth_weight === undefined) &&
      (intent.current_weight === null || intent.current_weight === undefined) &&
      (intent.w_1 === null || intent.w_1 === undefined) &&
      (intent.w_2 === null || intent.w_2 === undefined) &&
      (intent.w_3 === null || intent.w_3 === undefined) &&
      (intent.w_4 === null || intent.w_4 === undefined) &&
      (intent.w_5 === null || intent.w_5 === undefined) &&
      (intent.w_6 === null || intent.w_6 === undefined) &&
      (intent.w_7 === null || intent.w_7 === undefined) &&
      (intent.w_8 === null || intent.w_8 === undefined) &&
      !intent.microchip &&
      !intent.registration_no &&
      !intent.notes &&
      !intent.description
    ) {
      missing.push("what should change on the puppy");
    }
    return missing;
  }

  if (intent.action === "delete_puppy") {
    const missing: string[] = [];
    if (!intent.puppy_id && !intent.puppy_name && !(intent.puppy_names && intent.puppy_names.length)) {
      missing.push("puppy");
    }
    return missing;
  }

  if (intent.action === "add_puppy_event") {
    const missing: string[] = [];
    if (!intent.puppy_id && !intent.puppy_name) missing.push("puppy");
    if (!intent.event_date) missing.push("event date");
    if (!intent.label && !intent.title) missing.push("event title");
    return missing;
  }

  if (intent.action === "update_puppy_event") {
    const missing: string[] = [];
    if (!intent.event_id && !intent.puppy_id && !intent.puppy_name) missing.push("event or puppy");
    if (
      !intent.event_date &&
      !intent.label &&
      !intent.title &&
      !intent.event_type &&
      !intent.summary &&
      !intent.details &&
      (intent.value === null || intent.value === undefined) &&
      !intent.unit &&
      intent.is_published === null &&
      intent.is_published === undefined
    ) {
      missing.push("what should change on the event");
    }
    return missing;
  }

  if (intent.action === "delete_puppy_event") {
    const missing: string[] = [];
    if (!intent.event_id && !intent.puppy_id && !intent.puppy_name) missing.push("event or puppy");
    return missing;
  }

  if (intent.action === "log_payment") {
    const missing: string[] = [];
    if (!intent.buyer_name && !intent.buyer_email) missing.push("buyer");
    if (intent.amount === null || intent.amount === undefined || Number.isNaN(Number(intent.amount))) {
      missing.push("amount");
    }
    if (!intent.payment_date) missing.push("payment date");
    return missing;
  }

  if (intent.action === "delete_payment") {
    const missing: string[] = [];
    if (!intent.payment_id && !intent.reference_number && !intent.buyer_name && !intent.buyer_email) {
      missing.push("payment reference or buyer");
    }
    return missing;
  }

  if (intent.action === "update_payment") {
    const missing: string[] = [];
    const hasMatcher =
      !!intent.payment_id ||
      !!intent.reference_number ||
      !!intent.buyer_name ||
      !!intent.buyer_email;
    const hasChange =
      intent.new_amount !== null ||
      intent.new_amount !== undefined ||
      !!intent.new_payment_date ||
      !!intent.payment_type ||
      !!intent.method ||
      !!intent.note ||
      !!intent.status;

    if (!hasMatcher) missing.push("payment reference, payment id, or buyer");
    if (!hasChange) missing.push("what should change on the payment");
    return missing;
  }

  if (intent.action === "add_puppy_weight") {
    const missing: string[] = [];
    if (!intent.puppy_id && !intent.puppy_name) missing.push("puppy");
    if (!intent.weight_date) missing.push("weight date");
    if (
      (intent.weight_oz === null || intent.weight_oz === undefined) &&
      (intent.weight_g === null || intent.weight_g === undefined)
    ) {
      missing.push("weight");
    }
    return missing;
  }

  if (intent.action === "update_puppy_weight") {
    const missing: string[] = [];
    if (!intent.weight_id && !intent.puppy_id && !intent.puppy_name) missing.push("weight entry or puppy");
    if (
      !intent.new_weight_date &&
      (intent.age_weeks === null || intent.age_weeks === undefined) &&
      (intent.weight_oz === null || intent.weight_oz === undefined) &&
      (intent.weight_g === null || intent.weight_g === undefined) &&
      !intent.notes &&
      !intent.source
    ) {
      missing.push("what should change on the weight");
    }
    return missing;
  }

  if (intent.action === "delete_puppy_weight") {
    const missing: string[] = [];
    if (!intent.weight_id && !intent.puppy_id && !intent.puppy_name) missing.push("weight entry or puppy");
    return missing;
  }

  return [];
}

async function executeAddBuyer(
  admin: SupabaseClient,
  intent: Extract<ActionIntent, { action: "add_buyer" }>
) {
  const existing = await findBuyerByNameOrEmail(
    admin,
    intent.full_name || intent.name,
    intent.email
  );

  if (existing?.id) {
    const display = existing.full_name || existing.name || existing.email || "that buyer";
    return `Core action skipped. A buyer record already exists for ${display}.`;
  }

  const payload = {
    full_name: intent.full_name || intent.name || null,
    name: intent.name || intent.full_name || null,
    email: intent.email || null,
    phone: intent.phone || null,
    status: intent.status || "lead",
    notes: intent.notes || null,
  };

  const { data, error } = await admin
    .from("buyers")
    .insert(payload)
    .select("id, full_name, name, email, status")
    .single();

  if (error) {
    throw new Error(`Could not add buyer: ${error.message}`);
  }

  const buyerDisplay = data?.full_name || data?.name || data?.email || "New buyer";
  return `Core action completed. I added buyer "${buyerDisplay}" with status "${data?.status || payload.status}".`;
}

async function executeUpdateBuyer(
  admin: SupabaseClient,
  intent: Extract<ActionIntent, { action: "update_buyer" }>
) {
  let buyer: BuyerRecord | null = null;

  if (intent.buyer_id) {
    const { data, error } = await admin
      .from("buyers")
      .select("*")
      .eq("id", intent.buyer_id)
      .maybeSingle<BuyerRecord>();
    if (error) throw new Error(`Could not load that buyer: ${error.message}`);
    buyer = data;
  } else {
    buyer = await findBuyerByNameOrEmail(admin, intent.buyer_name, intent.buyer_email);
  }

  if (!buyer?.id) {
    throw new Error("I could not find that buyer to update.");
  }

  const payload = compactObject({
    full_name: intent.full_name || undefined,
    name: intent.name || undefined,
    email: intent.email || undefined,
    phone: intent.phone || undefined,
    status: intent.status || undefined,
    notes: intent.notes || undefined,
  });

  const { error } = await admin.from("buyers").update(payload).eq("id", buyer.id);
  if (error) throw new Error(`Could not update buyer: ${error.message}`);

  const buyerDisplay = buyer.full_name || buyer.name || buyer.email || "that buyer";
  return `Core action completed. I updated buyer "${buyerDisplay}".`;
}

async function executeDeleteBuyer(
  admin: SupabaseClient,
  intent: Extract<ActionIntent, { action: "delete_buyer" }>
) {
  const targetNames = (intent.buyer_names || []).filter(Boolean);
  const buyers: BuyerRecord[] = [];

  if (intent.buyer_id) {
    const { data, error } = await admin
      .from("buyers")
      .select("*")
      .eq("id", intent.buyer_id)
      .maybeSingle<BuyerRecord>();
    if (error) throw new Error(`Could not load that buyer: ${error.message}`);
    if (data) buyers.push(data);
  } else if (targetNames.length) {
    for (const name of targetNames) {
      const buyer = await findBuyerByNameOrEmail(admin, name, null);
      if (!buyer?.id) throw new Error(`I could not find buyer "${name}" to delete.`);
      buyers.push(buyer);
    }
  } else {
    const buyer = await findBuyerByNameOrEmail(admin, intent.buyer_name, intent.buyer_email);
    if (!buyer?.id) throw new Error("I could not find that buyer to delete.");
    buyers.push(buyer);
  }

  const ids = Array.from(new Set(buyers.map((buyer) => buyer.id)));
  const { error } = await admin.from("buyers").delete().in("id", ids);
  if (error) throw new Error(`Could not delete buyer: ${error.message}`);

  return `Core action completed. I deleted ${ids.length} buyer record${ids.length === 1 ? "" : "s"}.`;
}

async function executeAddPuppy(
  admin: SupabaseClient,
  intent: Extract<ActionIntent, { action: "add_puppy" }>
) {
  const buyer = await findBuyerByNameOrEmail(admin, intent.buyer_name, intent.buyer_email);

  const payload = {
    call_name: intent.call_name || intent.puppy_name || intent.name || null,
    puppy_name: intent.puppy_name || intent.call_name || intent.name || null,
    name: intent.name || intent.call_name || intent.puppy_name || null,
    litter_name: intent.litter_name || null,
    sire: intent.sire || null,
    dam: intent.dam || null,
    sex: intent.sex || null,
    color: intent.color || null,
    coat_type: intent.coat_type || null,
    pattern: intent.pattern || null,
    dob: intent.dob || null,
    registry: intent.registry || null,
    price: intent.price ?? null,
    status: intent.status || "Available",
    buyer_id: buyer?.id ?? null,
    owner_email: intent.owner_email || buyer?.email || intent.buyer_email || null,
    birth_weight:
      intent.birth_weight === null || intent.birth_weight === undefined
        ? null
        : Number(intent.birth_weight),
    current_weight:
      intent.current_weight !== null && intent.current_weight !== undefined
        ? Number(intent.current_weight)
        : intent.weight_oz === null || intent.weight_oz === undefined
          ? intent.weight_g ?? null
        : intent.weight_oz,
    w_1: intent.w_1 === null || intent.w_1 === undefined ? null : Number(intent.w_1),
    w_2: intent.w_2 === null || intent.w_2 === undefined ? null : Number(intent.w_2),
    w_3: intent.w_3 === null || intent.w_3 === undefined ? null : Number(intent.w_3),
    w_4: intent.w_4 === null || intent.w_4 === undefined ? null : Number(intent.w_4),
    w_5: intent.w_5 === null || intent.w_5 === undefined ? null : Number(intent.w_5),
    w_6: intent.w_6 === null || intent.w_6 === undefined ? null : Number(intent.w_6),
    w_7: intent.w_7 === null || intent.w_7 === undefined ? null : Number(intent.w_7),
    w_8: intent.w_8 === null || intent.w_8 === undefined ? null : Number(intent.w_8),
    weight_unit:
      intent.weight_oz === null || intent.weight_oz === undefined
        ? intent.weight_g === null || intent.weight_g === undefined
          ? null
          : "g"
        : "oz",
    weight_date: intent.weight_date || intent.dob || null,
    microchip: intent.microchip || null,
    registration_no: intent.registration_no || null,
    notes: intent.notes || null,
    description: intent.description || null,
  };

  const { data, error } = await admin
    .from("puppies")
    .insert(payload)
    .select("id, call_name, puppy_name, name, status")
    .single();

  if (error) {
    throw new Error(`Could not add puppy: ${error.message}`);
  }

  const puppyDisplay =
    data?.call_name || data?.puppy_name || data?.name || "New puppy";

  if (
    data?.id &&
    ((intent.weight_oz !== null && intent.weight_oz !== undefined) ||
      (intent.weight_g !== null && intent.weight_g !== undefined))
  ) {
    const { error: weightError } = await admin.from("puppy_weights").insert({
      puppy_id: data.id,
      weigh_date: intent.weight_date || intent.dob || new Date().toISOString().slice(0, 10),
      weight_date: intent.weight_date || intent.dob || new Date().toISOString().slice(0, 10),
      weight_oz:
        intent.weight_oz === null || intent.weight_oz === undefined
          ? null
          : Number(intent.weight_oz),
      weight_g:
        intent.weight_g === null || intent.weight_g === undefined ? null : Number(intent.weight_g),
      notes: "Initial puppy weight from add puppy command",
      source: "chi_chi_admin",
    });

    if (weightError) {
      console.error("Initial puppy weight save failed:", weightError);
    }
  }

  return `Core action completed. I added puppy "${puppyDisplay}" with status "${data?.status || payload.status}".`;
}

async function executeUpdatePuppy(
  admin: SupabaseClient,
  intent: Extract<ActionIntent, { action: "update_puppy" }>
) {
  const puppy = await findPuppyByNameOrId(admin, intent.puppy_name, intent.puppy_id);
  if (!puppy?.id) {
    throw new Error("I could not find that puppy to update.");
  }

  let buyer: BuyerRecord | null = null;
  if (intent.buyer_name || intent.buyer_email) {
    buyer = await findBuyerByNameOrEmail(admin, intent.buyer_name, intent.buyer_email);
    if (!buyer?.id) throw new Error("I could not find that buyer to assign to the puppy.");
  }

  const payload = compactObject({
    call_name: intent.call_name || undefined,
    puppy_name: intent.new_puppy_name || undefined,
    name: intent.name || undefined,
    litter_name: intent.litter_name || undefined,
    sire: intent.sire || undefined,
    dam: intent.dam || undefined,
    sex: intent.sex || undefined,
    color: intent.color || undefined,
    coat_type: intent.coat_type || undefined,
    pattern: intent.pattern || undefined,
    dob: intent.dob || undefined,
    registry: intent.registry || undefined,
    price: intent.price === null || intent.price === undefined ? undefined : Number(intent.price),
    status: intent.status || undefined,
    buyer_id: buyer?.id ?? undefined,
    owner_email: intent.owner_email || buyer?.email || undefined,
    birth_weight:
      intent.birth_weight === null || intent.birth_weight === undefined
        ? undefined
        : Number(intent.birth_weight),
    current_weight:
      intent.current_weight === null || intent.current_weight === undefined
        ? undefined
        : Number(intent.current_weight),
    w_1: intent.w_1 === null || intent.w_1 === undefined ? undefined : Number(intent.w_1),
    w_2: intent.w_2 === null || intent.w_2 === undefined ? undefined : Number(intent.w_2),
    w_3: intent.w_3 === null || intent.w_3 === undefined ? undefined : Number(intent.w_3),
    w_4: intent.w_4 === null || intent.w_4 === undefined ? undefined : Number(intent.w_4),
    w_5: intent.w_5 === null || intent.w_5 === undefined ? undefined : Number(intent.w_5),
    w_6: intent.w_6 === null || intent.w_6 === undefined ? undefined : Number(intent.w_6),
    w_7: intent.w_7 === null || intent.w_7 === undefined ? undefined : Number(intent.w_7),
    w_8: intent.w_8 === null || intent.w_8 === undefined ? undefined : Number(intent.w_8),
    weight_date: intent.weight_date || undefined,
    microchip: intent.microchip || undefined,
    registration_no: intent.registration_no || undefined,
    notes: intent.notes || undefined,
    description: intent.description || undefined,
  });

  const { error } = await admin.from("puppies").update(payload).eq("id", puppy.id);
  if (error) throw new Error(`Could not update puppy: ${error.message}`);

  const puppyDisplay = puppy.call_name || puppy.puppy_name || puppy.name || "that puppy";
  return `Core action completed. I updated puppy "${puppyDisplay}".`;
}

async function executeDeletePuppy(
  admin: SupabaseClient,
  intent: Extract<ActionIntent, { action: "delete_puppy" }>
) {
  const targetNames = (intent.puppy_names || []).filter(Boolean);
  const puppies: PuppyRecord[] = [];

  if (intent.puppy_id) {
    const puppy = await findPuppyByNameOrId(admin, null, intent.puppy_id);
    if (!puppy?.id) throw new Error("I could not find that puppy to delete.");
    puppies.push(puppy);
  } else if (targetNames.length) {
    for (const name of targetNames) {
      const puppy = await findPuppyByNameOrId(admin, name, null);
      if (!puppy?.id) throw new Error(`I could not find puppy "${name}" to delete.`);
      puppies.push(puppy);
    }
  } else {
    const puppy = await findPuppyByNameOrId(admin, intent.puppy_name, null);
    if (!puppy?.id) throw new Error("I could not find that puppy to delete.");
    puppies.push(puppy);
  }

  const ids = Array.from(new Set(puppies.map((puppy) => puppy.id)));
  const { error } = await admin.from("puppies").delete().in("id", ids);
  if (error) throw new Error(`Could not delete puppy: ${error.message}`);

  return `Core action completed. I deleted ${ids.length} puppy record${ids.length === 1 ? "" : "s"}.`;
}

async function executeAddPuppyEvent(
  admin: SupabaseClient,
  intent: Extract<ActionIntent, { action: "add_puppy_event" }>
) {
  const puppy = await findPuppyByNameOrId(admin, intent.puppy_name, intent.puppy_id);

  if (!puppy?.id) {
    throw new Error("I could not find that puppy to attach the event.");
  }

  const payload = {
    puppy_id: puppy.id,
    event_date: intent.event_date,
    event_type: intent.event_type || "milestone",
    label: intent.label || intent.title || "Update",
    title: intent.title || intent.label || null,
    summary: intent.summary || null,
    details: intent.details || null,
    value: intent.value ?? null,
    unit: intent.unit || null,
    auto_generated: false,
    is_published: intent.is_published ?? true,
    is_private: false,
    sort_order: 0,
  };

  const { error } = await admin.from("puppy_events").insert(payload);
  if (error) {
    throw new Error(`Could not add puppy event: ${error.message}`);
  }

  const puppyDisplay = puppy.call_name || puppy.puppy_name || puppy.name || "that puppy";
  return `Core action completed. I added the event "${payload.label}" for ${puppyDisplay} on ${payload.event_date}.`;
}

async function findPuppyEvent(
  admin: SupabaseClient,
  intent:
    | Extract<ActionIntent, { action: "update_puppy_event" }>
    | Extract<ActionIntent, { action: "delete_puppy_event" }>
) {
  if (intent.event_id) {
    const { data, error } = await admin
      .from("puppy_events")
      .select("*")
      .eq("id", intent.event_id)
      .maybeSingle<EventRecord>();
    if (error) throw new Error(`Could not load that puppy event: ${error.message}`);
    return data;
  }

  const puppy = await findPuppyByNameOrId(admin, intent.puppy_name, intent.puppy_id);
  if (!puppy?.id) throw new Error("I could not find that puppy event without a valid puppy.");

  let query = admin.from("puppy_events").select("*").eq("puppy_id", puppy.id).limit(50);
  if (intent.event_date) query = query.eq("event_date", intent.event_date);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load puppy events: ${error.message}`);

  const filtered = (data || []).filter((event) => {
    if (intent.label && event.label !== intent.label) return false;
    if (intent.title && event.title !== intent.title) return false;
    return true;
  });

  if (!filtered.length) throw new Error("I could not find a matching puppy event.");
  if (filtered.length > 1) {
    throw new Error("I found multiple matching puppy events. Please include the event id or a more specific date/title.");
  }
  return filtered[0] as EventRecord;
}

async function executeUpdatePuppyEvent(
  admin: SupabaseClient,
  intent: Extract<ActionIntent, { action: "update_puppy_event" }>
) {
  const event = await findPuppyEvent(admin, intent);
  if (!event?.id) throw new Error("I could not find that puppy event to update.");

  const payload = compactObject({
    event_date: intent.event_date || undefined,
    event_type: intent.event_type || undefined,
    label: intent.label || undefined,
    title: intent.title || undefined,
    summary: intent.summary || undefined,
    details: intent.details || undefined,
    value: intent.value === null || intent.value === undefined ? undefined : Number(intent.value),
    unit: intent.unit || undefined,
    is_published: intent.is_published,
  });

  const { error } = await admin.from("puppy_events").update(payload).eq("id", event.id);
  if (error) throw new Error(`Could not update puppy event: ${error.message}`);
  return `Core action completed. I updated puppy event ${event.id}.`;
}

async function executeDeletePuppyEvent(
  admin: SupabaseClient,
  intent: Extract<ActionIntent, { action: "delete_puppy_event" }>
) {
  const event = await findPuppyEvent(admin, intent);
  if (!event?.id) throw new Error("I could not find that puppy event to delete.");

  const { error } = await admin.from("puppy_events").delete().eq("id", event.id);
  if (error) throw new Error(`Could not delete puppy event: ${error.message}`);
  return `Core action completed. I deleted puppy event ${event.id}.`;
}

async function executeLogPayment(
  admin: SupabaseClient,
  intent: Extract<ActionIntent, { action: "log_payment" }>
) {
  const buyer = await findBuyerByNameOrEmail(admin, intent.buyer_name, intent.buyer_email);

  if (!buyer?.id) {
    throw new Error("I could not find that buyer to log the payment.");
  }

  let puppy: PuppyRecord | null = null;
  if (intent.puppy_name) {
    puppy = await findPuppyByNameOrId(admin, intent.puppy_name, null);
  }

  const payload = {
    buyer_id: buyer.id,
    puppy_id: puppy?.id ?? buyer.puppy_id ?? null,
    user_id: buyer.user_id ?? null,
    payment_date: intent.payment_date,
    amount: Number(intent.amount),
    payment_type: intent.payment_type || "payment",
    method: intent.method || null,
    note: intent.note || null,
    status: intent.status || "recorded",
    reference_number: intent.reference_number || null,
  };

  const { error } = await admin.from("buyer_payments").insert(payload);
  if (error) {
    throw new Error(`Could not log payment: ${error.message}`);
  }

  const buyerDisplay = buyer.full_name || buyer.name || buyer.email || "that buyer";
  return `Core action completed. I logged a payment of $${Number(payload.amount).toFixed(
    2
  )} for ${buyerDisplay} dated ${payload.payment_date}.`;
}

async function findPaymentForUpdate(
  admin: SupabaseClient,
  intent: Extract<ActionIntent, { action: "update_payment" }>
) {
  if (intent.payment_id) {
    const { data, error } = await admin
      .from("buyer_payments")
      .select("*")
      .eq("id", intent.payment_id)
      .maybeSingle<PaymentRecord>();
    if (error) {
      throw new Error(`Could not load that payment: ${error.message}`);
    }
    if (!data) {
      throw new Error("I could not find that payment id.");
    }
    return data;
  }

  const buyer = await findBuyerByNameOrEmail(admin, intent.buyer_name, intent.buyer_email);
  if (!buyer?.id) {
    throw new Error("I could not find that buyer to locate the payment.");
  }

  let query = admin
    .from("buyer_payments")
    .select("*")
    .eq("buyer_id", buyer.id)
    .order("payment_date", { ascending: false })
    .limit(50);

  if (intent.reference_number) {
    query = query.eq("reference_number", intent.reference_number);
  }

  if (intent.payment_date) {
    query = query.eq("payment_date", intent.payment_date);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Could not load payments for update: ${error.message}`);
  }

  const filtered = (data || []).filter((payment) =>
    paymentMatchesAmount(payment as PaymentRecord, intent.amount)
  ) as PaymentRecord[];

  if (!filtered.length) {
    throw new Error("I could not find a matching payment to update.");
  }

  if (filtered.length > 1) {
    throw new Error(
      "I found multiple matching payments. Please include a reference number, payment id, or a more specific date and amount."
    );
  }

  return filtered[0];
}

async function executeUpdatePayment(
  admin: SupabaseClient,
  intent: Extract<ActionIntent, { action: "update_payment" }>
) {
  const payment = await findPaymentForUpdate(admin, intent);

  const payload = compactObject({
    payment_date: intent.new_payment_date || undefined,
    amount:
      intent.new_amount === null || intent.new_amount === undefined
        ? undefined
        : Number(intent.new_amount),
    payment_type: intent.payment_type || undefined,
    method: intent.method || undefined,
    note: intent.note || undefined,
    status: intent.status || undefined,
  });

  if (!Object.keys(payload).length) {
    throw new Error("I need at least one updated payment field to save.");
  }

  const { error } = await admin.from("buyer_payments").update(payload).eq("id", payment.id);
  if (error) {
    throw new Error(`Could not update payment: ${error.message}`);
  }

  return `Core action completed. I updated payment ${payment.id} dated ${
    intent.new_payment_date || payment.payment_date
  }.`;
}

async function executeDeletePayment(
  admin: SupabaseClient,
  intent: Extract<ActionIntent, { action: "delete_payment" }>
) {
  const payment = await findPaymentForUpdate(admin, {
    ...intent,
    action: "update_payment",
  });

  const { error } = await admin.from("buyer_payments").delete().eq("id", payment.id);
  if (error) throw new Error(`Could not delete payment: ${error.message}`);
  return `Core action completed. I deleted payment ${payment.id}.`;
}

async function executeAddPuppyWeight(
  admin: SupabaseClient,
  intent: Extract<ActionIntent, { action: "add_puppy_weight" }>
) {
  const puppy = await findPuppyByNameOrId(admin, intent.puppy_name, intent.puppy_id);

  if (!puppy?.id) {
    throw new Error("I could not find that puppy to add the weight entry.");
  }

  const payload = {
    puppy_id: puppy.id,
    weigh_date: intent.weight_date,
    weight_date: intent.weight_date,
    age_weeks:
      intent.age_weeks === null || intent.age_weeks === undefined
        ? null
        : Number(intent.age_weeks),
    weight_oz:
      intent.weight_oz === null || intent.weight_oz === undefined
        ? null
        : Number(intent.weight_oz),
    weight_g:
      intent.weight_g === null || intent.weight_g === undefined ? null : Number(intent.weight_g),
    notes: intent.notes || null,
    source: intent.source || "chi_chi_admin",
  };

  const { error } = await admin.from("puppy_weights").insert(payload);
  if (error) {
    throw new Error(`Could not add puppy weight: ${error.message}`);
  }

  const currentWeight =
    payload.weight_oz === null || payload.weight_oz === undefined
      ? payload.weight_g
      : payload.weight_oz;
  const weightUnit =
    payload.weight_oz === null || payload.weight_oz === undefined ? "g" : "oz";

  await admin
    .from("puppies")
    .update({
      current_weight: currentWeight,
      weight_unit: weightUnit,
      weight_date: intent.weight_date,
    })
    .eq("id", puppy.id);

  const puppyDisplay = puppy.call_name || puppy.puppy_name || puppy.name || "that puppy";
  const weightText =
    payload.weight_oz !== null && payload.weight_oz !== undefined
      ? `${payload.weight_oz} oz`
      : `${payload.weight_g} g`;

  return `Core action completed. I logged a weight of ${weightText} for ${puppyDisplay} on ${intent.weight_date}.`;
}

async function findPuppyWeight(
  admin: SupabaseClient,
  intent:
    | Extract<ActionIntent, { action: "update_puppy_weight" }>
    | Extract<ActionIntent, { action: "delete_puppy_weight" }>
) {
  if (intent.weight_id) {
    const { data, error } = await admin
      .from("puppy_weights")
      .select("*")
      .eq("id", intent.weight_id)
      .maybeSingle<WeightRecord>();
    if (error) throw new Error(`Could not load that weight entry: ${error.message}`);
    return data;
  }

  const puppy = await findPuppyByNameOrId(admin, intent.puppy_name, intent.puppy_id);
  if (!puppy?.id) throw new Error("I could not find that puppy to locate the weight entry.");

  let query = admin.from("puppy_weights").select("*").eq("puppy_id", puppy.id).limit(50);
  if (intent.weight_date) query = query.eq("weight_date", intent.weight_date);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load puppy weights: ${error.message}`);

  const filtered = (data || []).filter((weight) => {
    if (
      intent.weight_oz !== null &&
      intent.weight_oz !== undefined &&
      Number(weight.weight_oz) !== Number(intent.weight_oz)
    ) {
      return false;
    }
    if (
      intent.weight_g !== null &&
      intent.weight_g !== undefined &&
      Number(weight.weight_g) !== Number(intent.weight_g)
    ) {
      return false;
    }
    return true;
  });

  if (!filtered.length) throw new Error("I could not find a matching puppy weight entry.");
  if (filtered.length > 1) {
    throw new Error("I found multiple matching puppy weights. Please include the weight id or a more specific date/weight.");
  }
  return filtered[0] as WeightRecord;
}

async function executeUpdatePuppyWeight(
  admin: SupabaseClient,
  intent: Extract<ActionIntent, { action: "update_puppy_weight" }>
) {
  const weight = await findPuppyWeight(admin, intent);
  if (!weight?.id) throw new Error("I could not find that weight entry to update.");

  const payload = compactObject({
    weight_date: intent.new_weight_date || undefined,
    weigh_date: intent.new_weight_date || undefined,
    age_weeks: intent.age_weeks === null || intent.age_weeks === undefined ? undefined : Number(intent.age_weeks),
    weight_oz: intent.weight_oz === null || intent.weight_oz === undefined ? undefined : Number(intent.weight_oz),
    weight_g: intent.weight_g === null || intent.weight_g === undefined ? undefined : Number(intent.weight_g),
    notes: intent.notes || undefined,
    source: intent.source || undefined,
  });

  const { error } = await admin.from("puppy_weights").update(payload).eq("id", weight.id);
  if (error) throw new Error(`Could not update puppy weight: ${error.message}`);
  return `Core action completed. I updated puppy weight entry ${weight.id}.`;
}

async function executeDeletePuppyWeight(
  admin: SupabaseClient,
  intent: Extract<ActionIntent, { action: "delete_puppy_weight" }>
) {
  const weight = await findPuppyWeight(admin, intent);
  if (!weight?.id) throw new Error("I could not find that weight entry to delete.");

  const { error } = await admin.from("puppy_weights").delete().eq("id", weight.id);
  if (error) throw new Error(`Could not delete puppy weight: ${error.message}`);
  return `Core action completed. I deleted puppy weight entry ${weight.id}.`;
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
    const { data: existingThread } = await admin
      .from("chichi_threads")
      .select("id")
      .eq("user_id", userId)
      .eq("source", "portal")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();

    activeThreadId = existingThread?.id || null;
  }

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

async function loadSavedConversation(
  admin: SupabaseClient,
  userId: string,
  threadId?: string | null
): Promise<ChatMessage[]> {
  let activeThreadId = threadId || null;

  if (!activeThreadId) {
    const { data: latestThread } = await admin
      .from("chichi_threads")
      .select("id")
      .eq("user_id", userId)
      .eq("source", "portal")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();

    activeThreadId = latestThread?.id || null;
  }

  if (!activeThreadId) return [];

  const { data, error } = await admin
    .from("chichi_messages")
    .select("sender,content")
    .eq("thread_id", activeThreadId)
    .order("created_at", { ascending: true })
    .limit(40);

  if (error || !data) return [];

  return data
    .filter((row) => row.sender === "user" || row.sender === "assistant")
    .map((row) => ({
      role: row.sender === "user" ? "user" : "assistant",
      content: String(row.content || ""),
    }));
}

async function loadSharedPublicHistory(
  admin: SupabaseClient,
  email: string | null | undefined
): Promise<ChatMessage[]> {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return [];

  const { data: lead } = await admin
    .from("crm_leads")
    .select("thread_id,updated_at")
    .eq("email", normalizedEmail)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ thread_id: string | null }>();

  if (!lead?.thread_id) return [];

  const { data, error } = await admin
    .from("chichi_public_messages")
    .select("sender,content")
    .eq("thread_id", lead.thread_id)
    .order("created_at", { ascending: true })
    .limit(20);

  if (error || !data) return [];

  return data
    .filter((row) => row.sender === "visitor" || row.sender === "assistant")
    .map((row) => ({
      role: row.sender === "visitor" ? "user" : "assistant",
      content: String(row.content || ""),
    }));
}

function mergeConversationHistory(...sources: ChatMessage[][]): ChatMessage[] {
  const merged: ChatMessage[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    for (const message of source) {
      const role = message.role === "assistant" ? "assistant" : "user";
      const content = String(message.content || "").trim();
      if (!content) continue;

      const key = `${role}:${content}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push({ role, content });
    }
  }

  return merged.slice(-40);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const inputMessages = Array.isArray(body.messages) ? body.messages : [];
    const lastUserMessage =
      [...inputMessages].reverse().find((message) => message.role === "user")?.content?.trim() || "";

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
    const savedMessages = await loadSavedConversation(admin, user.id, body.threadId);
    const sharedPublicMessages = await loadSharedPublicHistory(admin, user.email);
    const messages = mergeConversationHistory(
      sharedPublicMessages,
      savedMessages,
      inputMessages
    );
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

    const canWriteCore = isCoreWriteAllowed({
      id: user.id,
      email: user.email,
    });
    const adminAuth: AdminAuthContext = {
      userId: user.id,
      email: user.email || null,
      canWriteCore,
    };
    const recentUserMessages = messages
      .filter((message) => message.role === "user")
      .slice(-6)
      .map((message) => message.content);

    const intent = await extractActionIntent(lastUserMessage, recentUserMessages);

    let text = "";

    if (intent.action !== "answer_only") {
      if (!canWriteCore) {
        text =
          "You’re signed in, but Core write actions are limited to authorized admin accounts. I can still answer questions about the account and portal.";
      } else {
        const missing = missingFieldsForAction(intent);
        if (missing.length) {
          text = `I can do that, but I still need: ${missing.join(", ")}.`;
        } else if (intent.action === "add_buyer") {
          text = await executeAddBuyer(admin, intent);
        } else if (intent.action === "update_buyer") {
          text = await executeUpdateBuyer(admin, intent);
        } else if (intent.action === "delete_buyer") {
          text = await executeDeleteBuyer(admin, intent);
        } else if (intent.action === "add_puppy") {
          text = await executeAddPuppy(admin, intent);
        } else if (intent.action === "update_puppy") {
          text = await executeUpdatePuppy(admin, intent);
        } else if (intent.action === "delete_puppy") {
          text = await executeDeletePuppy(admin, intent);
        } else if (intent.action === "add_puppy_event") {
          text = await executeAddPuppyEvent(admin, intent);
        } else if (intent.action === "update_puppy_event") {
          text = await executeUpdatePuppyEvent(admin, intent);
        } else if (intent.action === "delete_puppy_event") {
          text = await executeDeletePuppyEvent(admin, intent);
        } else if (intent.action === "log_payment") {
          text = await executeLogPayment(admin, intent);
        } else if (intent.action === "update_payment") {
          text = await executeUpdatePayment(admin, intent);
        } else if (intent.action === "delete_payment") {
          text = await executeDeletePayment(admin, intent);
        } else if (intent.action === "add_puppy_weight") {
          text = await executeAddPuppyWeight(admin, intent);
        } else if (intent.action === "update_puppy_weight") {
          text = await executeUpdatePuppyWeight(admin, intent);
        } else if (intent.action === "delete_puppy_weight") {
          text = await executeDeletePuppyWeight(admin, intent);
        }
      }
    }

    if (!text) {
      const system = buildSystemPrompt(summary, {
        isAdmin: canWriteCore,
        canWriteCore,
      });

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
      text = anthropicData?.content?.[0]?.text?.trim();

      if (!text) {
        return jsonError("ChiChi could not generate a response.", 502);
      }
    }

    const savedThreadId = await saveConversation({
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
      threadId: savedThreadId,
      adminAuth,
      context: {
        buyerName: buyer?.full_name || buyer?.name || null,
        puppyName: coalesceName(buyer, puppy),
      },
    });
  } catch (error) {
    console.error("ChiChi route error:", error);
    return NextResponse.json(
      {
        text: `ChiChi server error: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}
