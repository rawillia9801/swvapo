// FILE: app/api/buildlio/route.ts
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import {
  deactivateChiChiMemory,
  formatChiChiMemories,
  loadChiChiMemories,
  upsertChiChiMemory,
} from "@/lib/chichi-memory";
import { buildPortalChiChiSystemPrompt } from "@/lib/chichi-portal-agent";
import { isPortalAdminEmail } from "@/lib/portal-admin";
import {
  createZohoPaymentLink,
  isZohoPaymentsConfigured,
  listZohoCustomers,
  listZohoPayments,
} from "@/lib/zoho-payments";
import {
  buildPortalChargeReference,
  describePortalCharge,
  type PortalChargeKind,
} from "@/lib/portal-payment-options";
import { createPortalZohoPaymentLink } from "@/lib/portal-zoho-payments";
import { loadAdminLineageWorkspace } from "@/lib/admin-lineage";
import { listAllAuthUsers } from "@/lib/admin-api";
import { loadBreedingGeneticsPromptContext } from "@/lib/breeding-genetics";

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

type MemoryCommand =
  | { action: "save"; scope: "global" | "portal"; content: string; subject?: string | null }
  | { action: "delete"; scope: "global" | "portal"; query: string }
  | { action: "list"; scope: "global" | "portal" };

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

type WebsiteVisitorRecord = {
  id?: string | number | null;
  session_id?: string | null;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  landing_page?: string | null;
  referrer?: string | null;
  utm_source?: string | null;
  is_returning?: boolean | null;
  visit_count?: number | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
};

type PublicThreadRecord = {
  id: string | number;
  visitor_id?: string | null;
  updated_at?: string | null;
  lead_status?: string | null;
  follow_up_needed?: boolean | null;
  follow_up_reason?: string | null;
  summary?: string | null;
  intent_summary?: string | null;
  tags?: string[] | null;
  priority?: string | null;
  source_page?: string | null;
};

type PublicMessageRecord = {
  id: string | number;
  thread_id?: string | null;
  sender?: string | null;
  content?: string | null;
  intent?: string | null;
  topic?: string | null;
  created_at?: string | null;
  requires_follow_up?: boolean | null;
  follow_up_reason?: string | null;
};

type CrmLeadRecord = {
  id: string | number;
  visitor_id?: string | null;
  thread_id?: string | null;
  email?: string | null;
  phone?: string | null;
  interest_timeline?: string | null;
  lead_score?: number | null;
  lead_status?: string | null;
  wants_payment_plan?: boolean | null;
  wants_wait_list?: boolean | null;
  wants_available_puppy?: boolean | null;
  wants_application?: boolean | null;
  follow_up_needed?: boolean | null;
  follow_up_status?: string | null;
  follow_up_reason?: string | null;
  last_contact_at?: string | null;
  summary?: string | null;
  tags?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type CrmFollowUpRecord = {
  id: string | number;
  lead_id?: string | number | null;
  thread_id?: string | null;
  visitor_id?: string | null;
  task_type?: string | null;
  reason?: string | null;
  status?: string | null;
  priority?: string | null;
  due_at?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type AdminDigestRecord = {
  id: string | number;
  digest_date?: string | null;
  summary?: string | null;
  priorities?: string[] | null;
  stats?: Record<string, unknown> | null;
  created_at?: string | null;
};

type PlannedLitterDraft = {
  litter_name?: string | null;
  litter_code?: string | null;
  dam_name?: string | null;
  sire_name?: string | null;
  whelp_date?: string | null;
  timing_note?: string | null;
  registry?: string | null;
  status?: string | null;
  notes?: string | null;
};

type ActionIntent =
  | {
      action: "answer_only";
      confidence?: string;
      reason?: string;
    }
  | {
      action: "list_records";
      confidence?: string;
      entity?:
        | "buyers"
        | "litters"
        | "puppies"
        | "payments"
        | "puppy_financing"
        | "applications"
        | "documents"
        | "forms"
        | "messages"
        | "events"
        | "weights"
        | "health"
        | "pickup_requests"
        | "website_activity"
        | "website_visitors"
        | "public_threads"
        | "public_messages"
        | "crm_leads"
        | "crm_followups"
        | "admin_digests"
        | "payment_alerts"
        | "zoho_customers"
        | "zoho_payments";
      query?: string | null;
      limit?: number | null;
    }
  | {
      action: "add_litters";
      confidence?: string;
      litters?: PlannedLitterDraft[] | null;
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
    }
  | {
      action: "create_zoho_payment_link";
      confidence?: string;
      buyer_name?: string | null;
      buyer_email?: string | null;
      customer_email?: string | null;
      customer_phone?: string | null;
      amount?: number | null;
      currency?: string | null;
      description?: string | null;
      charge_kind?: PortalChargeKind | null;
      reference_id?: string | null;
      expires_at?: string | null;
      send_email?: boolean | null;
      payment_methods?: string[] | null;
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

function firstValue(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (trimmed) return trimmed;
  }
  return "";
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

function buildMemoryKey(prefix: string, value: string, max = 72) {
  const token = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);

  return `${prefix}-${token || "memory"}`;
}

function summarizeMemoryText(value: string, max = 140) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

function inferGlobalMemoryKind(text: string): "instruction" | "business" {
  const lower = String(text || "").toLowerCase();

  if (
    /\bhours?\b/.test(lower) ||
    /\bopen\b/.test(lower) ||
    /\bclosed\b/.test(lower) ||
    /\beaster\b/.test(lower) ||
    /\bchristmas\b/.test(lower) ||
    /\bthanksgiving\b/.test(lower) ||
    /\bholiday\b/.test(lower) ||
    /\bwait list\b/.test(lower) ||
    /\bpricing\b/.test(lower) ||
    /\bprice\b/.test(lower) ||
    /\bpayment plan\b/.test(lower) ||
    /\bfinancing\b/.test(lower) ||
    /\bpolicy\b/.test(lower) ||
    /\bpickup\b/.test(lower) ||
    /\bdelivery\b/.test(lower) ||
    /\btransport/.test(lower)
  ) {
    return "business";
  }

  return "instruction";
}

function inferGlobalMemorySubject(text: string): string {
  const lower = String(text || "").toLowerCase();

  if (/\bhours?\b/.test(lower) || /\bopen\b/.test(lower) || /\bclosed\b/.test(lower)) {
    return "Business hours";
  }
  if (/\beaster\b/.test(lower) || /\bchristmas\b/.test(lower) || /\bholiday\b/.test(lower)) {
    return "Holiday schedule";
  }
  if (/\bwait list\b/.test(lower)) {
    return "Wait list guidance";
  }
  if (
    /\bpricing\b/.test(lower) ||
    /\bprice\b/.test(lower) ||
    /\bpayment plan\b/.test(lower) ||
    /\bfinancing\b/.test(lower)
  ) {
    return "Pricing and financing";
  }
  if (/\bpolicy\b/.test(lower)) {
    return "Business policy";
  }
  if (/\bpickup\b/.test(lower) || /\bdelivery\b/.test(lower) || /\btransport/.test(lower)) {
    return "Transportation guidance";
  }

  return "Owner instruction";
}

function extractAdminMemoryCommand(message: string): MemoryCommand | null {
  const text = String(message || "").trim();

  if (!text) return null;

  if (/^(show|list)\s+(memory|memories|instructions)/i.test(text)) {
    return { action: "list", scope: "global" };
  }

  if (/^(forget|remove|delete)\s+(memory|instruction)/i.test(text)) {
    const query = text.replace(/^(forget|remove|delete)\s+(memory|instruction)\s*/i, "").trim();
    if (query) return { action: "delete", scope: "global", query };
  }

  if (
    /^(remember|save|store)\b/i.test(text) ||
    /^(update|set)\s+hours?\b/i.test(text) ||
    /\bfrom now on\b/i.test(text) ||
    /\balways\b/i.test(text) ||
    /\bif someone asks\b/i.test(text) ||
    /\bhours?\b/i.test(text) ||
    /\bopen\b/i.test(text) ||
    /\bclosed\b/i.test(text) ||
    /\bbusiness hours\b/i.test(text) ||
    /\bholiday\b/i.test(text) ||
    /\beaster\b/i.test(text) ||
    /\bwait list\b/i.test(text) ||
    /\bpricing\b/i.test(text) ||
    /\bpolicy\b/i.test(text)
  ) {
    const content = text
      .replace(/^(remember|save|store)(\s+that)?\s*/i, "")
      .replace(/^for chichi[:,]?\s*/i, "")
      .trim();

    return {
      action: "save",
      scope: "global",
      content: content || text,
      subject: null,
    };
  }

  return null;
}

function extractPortalPreferenceMemory(message: string): string | null {
  const text = String(message || "").trim();
  const lower = text.toLowerCase();

  if (!text) return null;

  const patterns = [
    "i prefer",
    "my preferred",
    "please remember",
    "remember that i",
    "you can call me",
    "my phone number is",
    "my email is",
    "we prefer",
  ];

  return patterns.some((pattern) => lower.includes(pattern)) ? text : null;
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
  options: { isAdmin?: boolean; canWriteCore?: boolean; memories?: string } = {}
) {
  return buildPortalChiChiSystemPrompt(summary, options);
  if (options?.isAdmin) {
    return `
You are ChiChi Assistant for Southwest Virginia Chihuahua.

Your role:
- Help authorized admins with Core admin chat commands and general portal questions.
- Keep answers concise, warm, and operationally clear.
- Never claim a database write succeeded unless the action handler already completed it.
- Never say you are unable to perform database writes when Core admin write access is enabled. If an action needs more detail, ask only for the missing fields.
- If the admin asks what commands are available, mention add, edit, delete, list, and lookup coverage for buyers, puppies, puppy events, payments, puppy weights, applications, forms, documents, and transportation requests.
- If an admin request is missing details, ask for the exact missing fields only.
- If a request is ambiguous because multiple buyers, puppies, or payments could match, say that plainly and ask for one clarifying detail.
- Persistent ChiChi memory contains ongoing breeder or owner instructions. Use it for business rules, hours, pricing, website notices, and recurring guidance unless the admin clearly replaces it.
- Database account data remains the source of truth for buyer, puppy, payment, and portal records.

Current signed-in account context:
${JSON.stringify(summary, null, 2)}

Persistent ChiChi memory:
${options.memories || "None saved."}

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
- Persistent ChiChi memory may contain saved buyer preferences or recurring breeder guidance. Use it when helpful, but do not let it override actual account records.

Current account context:
${JSON.stringify(summary, null, 2)}

Persistent ChiChi memory:
${options?.memories || "None saved."}
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
- "list_records"
- "add_litters"
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
- "create_zoho_payment_link"

Use "answer_only" if the message is mostly a question, lookup, explanation, or lacks enough intent to act.
Requests to show website activity, admin digests, public threads/messages, CRM leads/follow-ups, or Zoho data should usually be "list_records".
Use "add_litters" when the admin is planning or scheduling litters from breeding dogs, even when no puppy names exist yet.

For "list_records", try to extract:
entity, query, limit

Valid entities for "list_records":
- buyers
- litters
- puppies
- payments
- applications
- documents
- forms
- messages
- events
- weights
- health
- pickup_requests
- website_activity
- website_visitors
- public_threads
- public_messages
- crm_leads
- crm_followups
- admin_digests
- payment_alerts
- zoho_customers
- zoho_payments

For "add_litters", try to extract:
litters[]

Each litter item can include:
litter_name, litter_code, dam_name, sire_name, whelp_date, timing_note, registry, status, notes

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

For "create_zoho_payment_link", try to extract:
buyer_name, buyer_email, customer_email, customer_phone, amount, currency, description, charge_kind, reference_id, expires_at, send_email, payment_methods

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

const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const ORDINAL_WORD_TO_DAY: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  "twenty first": 21,
  "twenty-first": 21,
  "twenty second": 22,
  "twenty-second": 22,
  "twenty third": 23,
  "twenty-third": 23,
  "twenty fourth": 24,
  "twenty-fourth": 24,
  "twenty fifth": 25,
  "twenty-fifth": 25,
  "twenty sixth": 26,
  "twenty-sixth": 26,
  "twenty seventh": 27,
  "twenty-seventh": 27,
  "twenty eighth": 28,
  "twenty-eighth": 28,
  "twenty ninth": 29,
  "twenty-ninth": 29,
  thirtieth: 30,
  "thirty first": 31,
  "thirty-first": 31,
};

function normalizeSearchLabel(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatMonthLabel(month: number) {
  return new Date(Date.UTC(2026, Math.max(0, month - 1), 1)).toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
  });
}

function toIsoDate(year: number, month: number, day: number) {
  const safeMonth = String(month).padStart(2, "0");
  const safeDay = String(day).padStart(2, "0");
  return `${year}-${safeMonth}-${safeDay}`;
}

function extractSharedPlanningYear(text: string) {
  const years = Array.from(new Set(Array.from(String(text || "").matchAll(/\b(20\d{2})\b/g)).map((match) => Number(match[1]))));
  return years.length === 1 ? years[0] : null;
}

function parseNaturalDateReference(fragment: string, fallbackYear?: number | null) {
  const text = String(fragment || "").replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();
  if (!lower) {
    return { whelp_date: null, timing_note: null };
  }

  const isoMatch = lower.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    return {
      whelp_date: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`,
      timing_note: null,
    };
  }

  const monthPattern =
    "january|february|march|april|may|june|july|august|september|october|november|december";

  const wordOrdinalMatch = lower.match(
    new RegExp(`\\b(?:the\\s+)?([a-z-]+(?:\\s+[a-z-]+)?)\\s+of\\s+(${monthPattern})(?:\\s+(20\\d{2}))?\\b`, "i")
  );
  if (wordOrdinalMatch) {
    const day = ORDINAL_WORD_TO_DAY[wordOrdinalMatch[1]];
    const month = MONTH_NAME_TO_NUMBER[wordOrdinalMatch[2]];
    const year = Number(wordOrdinalMatch[3] || fallbackYear || 0);
    if (day && month && year) {
      return {
        whelp_date: toIsoDate(year, month, day),
        timing_note: null,
      };
    }
  }

  const monthDayMatch = lower.match(
    new RegExp(`\\b(${monthPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,)?(?:\\s+(20\\d{2}))?\\b`, "i")
  );
  if (monthDayMatch) {
    const month = MONTH_NAME_TO_NUMBER[monthDayMatch[1]];
    const day = Number(monthDayMatch[2] || 0);
    const year = Number(monthDayMatch[3] || fallbackYear || 0);
    if (day && month && year) {
      return {
        whelp_date: toIsoDate(year, month, day),
        timing_note: null,
      };
    }
  }

  const fuzzyMatch = lower.match(
    new RegExp(`\\b(early|mid|late)[-\\s]+(${monthPattern})(?:\\s+(20\\d{2}))?\\b`, "i")
  );
  if (fuzzyMatch) {
    const month = MONTH_NAME_TO_NUMBER[fuzzyMatch[2]];
    const year = Number(fuzzyMatch[3] || fallbackYear || 0) || null;
    const monthLabel = month ? formatMonthLabel(month) : fuzzyMatch[2];
    const timing = `${fuzzyMatch[1]} ${monthLabel}${year ? ` ${year}` : ""}`;
    return {
      whelp_date: null,
      timing_note: timing,
    };
  }

  const plainMonthMatch = lower.match(new RegExp(`\\b(${monthPattern})(?:\\s+(20\\d{2}))?\\b`, "i"));
  if (plainMonthMatch) {
    const month = MONTH_NAME_TO_NUMBER[plainMonthMatch[1]];
    const year = Number(plainMonthMatch[2] || fallbackYear || 0) || null;
    const timing = `${month ? formatMonthLabel(month) : plainMonthMatch[1]}${year ? ` ${year}` : ""}`;
    return {
      whelp_date: null,
      timing_note: timing,
    };
  }

  return {
    whelp_date: null,
    timing_note: null,
  };
}

function buildPlannedLitterName(draft: PlannedLitterDraft, index: number) {
  const leadName = firstValue(draft.dam_name, draft.sire_name, draft.litter_name, `Litter ${index + 1}`);
  const dateLabel = draft.whelp_date
    ? new Date(`${draft.whelp_date}T00:00:00Z`).toLocaleString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : draft.timing_note || null;
  return [leadName, dateLabel, "planned litter"].filter(Boolean).join(" ");
}

function buildPlannedLitterCode(draft: PlannedLitterDraft, index: number) {
  const leadName = firstValue(draft.dam_name, draft.sire_name, draft.litter_name, `litter-${index + 1}`)
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase()
    .slice(0, 18);
  const dateToken = draft.whelp_date
    ? draft.whelp_date.replace(/-/g, "")
    : String(draft.timing_note || "PLANNED")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toUpperCase()
        .slice(0, 12) || "PLANNED";
  return `${leadName || `LITTER-${index + 1}`}-${dateToken}`.slice(0, 40);
}

function extractPlannedLitterDrafts(userMessage: string): PlannedLitterDraft[] {
  const text = String(userMessage || "").replace(/[–—]/g, "-").trim();
  if (!/\blitter\b/i.test(text)) {
    return [];
  }

  const sharedYear = extractSharedPlanningYear(text);
  const pattern =
    /([a-z][a-z0-9 .'-]{1,60}?)\s+(?:will\s+have|is\s+having|is\s+expecting|is\s+due\s+for|has)\s+(?:an?\s+)?(?:planned\s+)?litter\b([\s\S]*?)(?=(?:\s*(?:,|-)?\s*and\s+[a-z][a-z0-9 .'-]{1,60}?\s+(?:will\s+have|is\s+having|is\s+expecting|is\s+due\s+for|has)\s+(?:an?\s+)?(?:planned\s+)?litter\b)|$)/gi;

  const drafts: PlannedLitterDraft[] = [];
  let match: RegExpExecArray | null = null;

  while ((match = pattern.exec(text))) {
    const leadDogName = String(match[1] || "").trim().replace(/[,:-]+$/g, "");
    const detail = String(match[2] || "").trim().replace(/^(?:-|,)\s*/, "");
    if (!leadDogName) continue;

    const registry = detail.match(/\b(AKC|ACA|CKC|UKC)\b/i)?.[1]?.toUpperCase() || null;
    const sireName =
      detail.match(/\b(?:with|to|bred to|paired with|by)\s+([a-z][a-z0-9 .'-]{1,60})\b/i)?.[1]?.trim() ||
      null;
    const timing = parseNaturalDateReference(detail, sharedYear);
    const cleanedNote = detail
      .replace(
        /\b(?:the\s+)?[a-z-]+(?:\s+[a-z-]+)?\s+of\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+20\d{2})?\b/gi,
        ""
      )
      .replace(
        /\b(?:early|mid|late)[-\s]+(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+20\d{2})?\b/gi,
        ""
      )
      .replace(
        /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,)?(?:\s+20\d{2})?\b/gi,
        ""
      )
      .replace(/\b(AKC|ACA|CKC|UKC)\b\s+puppies?\b/gi, "")
      .replace(/\b(AKC|ACA|CKC|UKC)\b/gi, "")
      .replace(/\bpuppies?\b/gi, "")
      .replace(/\b(?:with|to|bred to|paired with|by)\s+[a-z][a-z0-9 .'-]{1,60}\b/gi, "")
      .replace(/\s+/g, " ")
      .replace(/^[-, ]+|[-, ]+$/g, "")
      .trim();

    drafts.push({
      dam_name: leadDogName,
      sire_name: sireName,
      whelp_date: timing.whelp_date,
      timing_note: timing.timing_note,
      registry,
      status: "planned",
      notes: cleanedNote || detail || null,
    });
  }

  return drafts;
}

function inferZohoChargeKind(text: string | null | undefined): PortalChargeKind | null {
  const normalized = String(text || "").trim().toLowerCase();
  if (!normalized) return null;

  if (/\bdeposit\b|\breservation\b/.test(normalized)) {
    return "deposit";
  }

  if (/\btransport(?:ation)?\b|\bdelivery\b|\bshipping\b/.test(normalized)) {
    return "transportation";
  }

  if (/\binstallment\b|\bmonthly\b|\bpayment plan\b|\bfinance\b/.test(normalized)) {
    return "installment";
  }

  return null;
}

function extractRequestedPaymentAmount(text: string | null | undefined) {
  const value = String(text || "").trim();
  if (!value) return null;

  const directAmountMatch =
    value.match(/\bamount(?:\s+of)?[:\s$-]*([\d]+(?:\.\d{1,2})?)/i) ||
    value.match(/\$\s*([\d]+(?:\.\d{1,2})?)/i);
  const trailingAmountMatches = Array.from(
    value.matchAll(/\bfor\s+\$?([\d]+(?:\.\d{1,2})?)(?=\b|\s)/gi)
  );
  const trailingAmountMatch = trailingAmountMatches.length
    ? trailingAmountMatches[trailingAmountMatches.length - 1]
    : null;
  const amount = Number(directAmountMatch?.[1] || trailingAmountMatch?.[1] || "");
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function extractPortalPaymentRequest(userMessage: string) {
  const normalized = String(userMessage || "").trim().toLowerCase();
  if (!normalized) return null;

  const mentionsPaymentIntent =
    /\bmake\b.*\bpayment\b/.test(normalized) ||
    /\bpay\b/.test(normalized) ||
    /\bpayment link\b/.test(normalized) ||
    /\bdeposit\b/.test(normalized) ||
    /\binstallment\b/.test(normalized) ||
    /\btransport(?:ation)?\b/.test(normalized);

  if (!mentionsPaymentIntent) {
    return null;
  }

  const chargeKind = inferZohoChargeKind(normalized) || "general";
  const amount = extractRequestedPaymentAmount(normalized);

  if (chargeKind === "general" && amount === null) {
    return null;
  }

  return {
    chargeKind,
    amount,
  };
}

function defaultZohoChargeDescription(
  chargeKind: PortalChargeKind | null,
  recipientLabel: string | null | undefined
) {
  const recipient = String(recipientLabel || "").trim();

  if (chargeKind === "deposit") {
    return recipient ? `Deposit request for ${recipient}` : "Deposit requested by ChiChi";
  }

  if (chargeKind === "installment") {
    return recipient
      ? `Installment payment for ${recipient}`
      : "Installment payment requested by ChiChi";
  }

  if (chargeKind === "transportation") {
    return recipient
      ? `Transportation fee for ${recipient}`
      : "Transportation fee requested by ChiChi";
  }

  if (chargeKind === "general") {
    return recipient ? `Payment for ${recipient}` : "Payment requested by ChiChi";
  }

  return recipient ? `Payment link for ${recipient}` : "Payment requested by ChiChi";
}

async function executePortalUserPaymentLink(
  req: Request,
  admin: SupabaseClient,
  user: User,
  requestInfo: { chargeKind: PortalChargeKind; amount: number | null }
) {
  if (!(await isZohoPaymentsConfigured())) {
    return "Secure Zoho payments are not configured yet. Please contact us and we can help with payment manually.";
  }

  const paymentLink = await createPortalZohoPaymentLink({
    admin,
    user,
    requestUrl: req.url,
    chargeKind: requestInfo.chargeKind,
    requestedAmount: requestInfo.amount,
  });

  return [
    `I created a secure Zoho payment link for ${paymentLink.snapshot.puppyName}.`,
    `Amount: $${paymentLink.amount.toFixed(2)} USD`,
    `Charge type: ${paymentLink.chargeKind}`,
    paymentLink.snapshot.finalBalanceDueNow
      ? "Timing note: the full remaining balance is required now before the scheduled receive date."
      : "You can use this secure link to complete the payment now.",
    `Link: ${paymentLink.url}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function extractListQueryForEntity(
  normalizedText: string,
  entity: Extract<ActionIntent, { action: "list_records" }>["entity"]
) {
  type ListEntity = NonNullable<Extract<ActionIntent, { action: "list_records" }>["entity"]>;

  const directMatch =
    normalizedText.match(/\b(?:for|named|called|with|about)\s+(.+)$/i)?.[1]?.trim() || null;

  if (directMatch) {
    return directMatch;
  }

  if (/\btoday\b/.test(normalizedText)) return "today";
  if (/\byesterday\b/.test(normalizedText)) return "yesterday";
  if (/\brecent\b|\blatest\b/.test(normalizedText)) return "recent";

  let cleaned = normalizedText
    .replace(/^(?:list|show|get|view|pull|find|display|open)\b/gi, "")
    .replace(/\bexact\b|\bdetailed?\b|\bdetails\b|\btranscripts?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (entity === "public_threads") {
    cleaned = cleaned
      .replace(/\bpublic\b|\bwebsite\b|\bchat\b|\bthreads?\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  if (entity === "public_messages") {
    cleaned = cleaned
      .replace(/\bpublic\b|\bwebsite\b|\bchat\b|\bmessages?\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  if (entity === "crm_followups") {
    cleaned = cleaned
      .replace(/\bcrm\b|\bfollow[- ]?ups?\b|\bdue\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  if (entity === "crm_leads") {
    cleaned = cleaned
      .replace(/\bcrm\b|\bwebsite\b|\bleads?\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  if (entity === "puppy_financing") {
    cleaned = cleaned
      .replace(/\bpuppy\b|\bfinancing\b|\bfinance\b|\bpayment plans?\b|\bfinanced\b|\baccounts?\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  const bareEntityPatternMap: Partial<Record<ListEntity, RegExp>> = {
    buyers: /^\s*buyers?\s*$/i,
    litters: /^\s*(?:planned\s+|upcoming\s+)?litters?\s*$/i,
    puppies: /^\s*pupp(?:y|ies)\s*$/i,
    payments: /^\s*payments?\s*$/i,
    puppy_financing: /^\s*(?:puppy\s*)?(?:financing|finance|payment plans?|financed accounts?)\s*$/i,
    applications: /^\s*applications?\s*$/i,
    documents: /^\s*documents?\s*$/i,
    forms: /^\s*forms?\s*$/i,
    messages: /^\s*messages?\s*$/i,
    events: /^\s*(?:events?|updates?)\s*$/i,
    weights: /^\s*weights?\s*$/i,
    health: /^\s*(?:health|health records?)\s*$/i,
    pickup_requests: /^\s*(?:pickup requests?|transportation requests?)\s*$/i,
    website_activity: /^\s*(?:website|site)?\s*(?:activity|traffic|summary|updates?)?\s*$/i,
    website_visitors: /^\s*(?:website visitors?|site visitors?)\s*$/i,
    public_threads: /^\s*(?:(?:public|website)\s*)?(?:chat\s*)?threads?\s*$/i,
    public_messages: /^\s*(?:(?:public|website)\s*)?(?:chat\s*)?messages?\s*$/i,
    crm_leads: /^\s*(?:crm|website)?\s*leads?\s*$/i,
    crm_followups: /^\s*(?:crm\s*)?follow[- ]?ups?\s*$/i,
    admin_digests: /^\s*(?:admin digests?|owner digest)\s*$/i,
    payment_alerts: /^\s*(?:customer\s*)?payment alerts?\s*$/i,
    zoho_customers: /^\s*zoho customers?\s*$/i,
    zoho_payments: /^\s*zoho payments?\s*$/i,
  };

  if (entity && cleaned && bareEntityPatternMap[entity]?.test(cleaned)) {
    return null;
  }

  return cleaned || null;
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

  const normalizedText = lower.replace(/[?.!]+$/g, "").trim();

  const plannedLitterDrafts = extractPlannedLitterDrafts(text);
  if (plannedLitterDrafts.length) {
    return {
      action: "add_litters",
      litters: plannedLitterDrafts.map((draft, index) => ({
        ...draft,
        litter_name: draft.litter_name || buildPlannedLitterName(draft, index),
        litter_code: draft.litter_code || buildPlannedLitterCode(draft, index),
      })),
    };
  }

  if (
    /^(?:create|make|generate|send)\s+(?:a\s+)?(?:zoho\s+)?payment link\b/i.test(text)
  ) {
    const directAmountMatch =
      text.match(/\bamount(?:\s+of)?[:\s$-]*([\d]+(?:\.\d{1,2})?)/i) ||
      text.match(/\$\s*([\d]+(?:\.\d{1,2})?)/i);
    const trailingAmountMatches = Array.from(
      text.matchAll(/\bfor\s+\$?([\d]+(?:\.\d{1,2})?)(?=\b|\s)/gi)
    );
    const trailingAmountMatch = trailingAmountMatches.length
      ? trailingAmountMatches[trailingAmountMatches.length - 1]
      : null;
    const buyerMatch = text.match(
      /\b(?:for|to)\s+([a-z][a-z .'-]{1,60}?)(?=\s+(?:for\s+\$?[\d]+|\$|amount\b|description\b|expires?\b|reference\b|email\b|phone\b|via\b|using\b)|$)/i
    );
    const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const phoneMatch = text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/);
    const chargeKind = inferZohoChargeKind(text);
    const explicitDescription =
      text.match(/\bdescription[:\s-]+(.+)$/i)?.[1]?.trim() ||
      text.match(
        /\bfor\s+(deposit|installment|monthly payment|remaining balance|balance|transport(?:ation)?|delivery|reservation|application)\b/i
      )?.[1]?.trim() ||
      null;
    const explicitCurrency =
      text.match(/\b(USD|EUR|GBP|CAD|AUD)\b/i)?.[1]?.toUpperCase() ||
      (text.includes("$") ? "USD" : null);
    const referenceId =
      text.match(/\breference(?:\s+id|\s+number)?[:\s-]*([a-z0-9._-]+)/i)?.[1] || null;
    const expiresAt =
      text.match(/\bexpires?(?:\s+on)?[:\s-]*([0-9]{4}-[0-9]{2}-[0-9]{2})/i)?.[1] || null;
    const paymentMethods = [
      /\bcard\b|\bcredit\b|\bdebit\b/i.test(text) ? "card" : null,
      /\bach\b|\bbank\b/i.test(text) ? "ach_debit" : null,
      /\bapple pay\b/i.test(text) ? "apple_pay" : null,
    ].filter(Boolean) as string[];
    const buyerName = buyerMatch?.[1]?.replace(/\s+/g, " ").trim() || null;
    const resolvedAmount = Number(
      directAmountMatch?.[1] || trailingAmountMatch?.[1] || ""
    );

    return {
      action: "create_zoho_payment_link",
      buyer_name: buyerName,
      buyer_email: emailMatch?.[0]?.toLowerCase() || null,
      customer_email: emailMatch?.[0]?.toLowerCase() || null,
      customer_phone: phoneMatch?.[0] || null,
      amount: Number.isFinite(resolvedAmount) && resolvedAmount > 0 ? resolvedAmount : null,
      currency: explicitCurrency,
      description:
        explicitDescription ||
        defaultZohoChargeDescription(chargeKind, buyerName || emailMatch?.[0] || null),
      charge_kind: chargeKind,
      reference_id: referenceId,
      expires_at: expiresAt,
      send_email: /\b(send|email|notify)\b/i.test(text) || !!emailMatch?.[0],
      payment_methods: paymentMethods.length ? paymentMethods : null,
    };
  }

  if (
    /\bwebsite updates?\b/.test(normalizedText) ||
    /\bwebsite activity\b/.test(normalizedText) ||
    /\bsite updates?\b/.test(normalizedText) ||
    /\bwebsite summary\b/.test(normalizedText)
  ) {
    return {
      action: "list_records",
      entity: "website_activity",
      query: /\btoday\b/.test(normalizedText) ? "today" : null,
      limit: 12,
    };
  }

  const entityMap: Array<{
    pattern: RegExp;
    entity: Extract<ActionIntent, { action: "list_records" }>["entity"];
  }> = [
    { pattern: /\bplanned litters?\b|\bupcoming litters?\b|\blitters?\b/, entity: "litters" },
    { pattern: /\bpuppy financing\b|\bpuppy payment plans?\b|\bpayment plans?\b|\bfinancing accounts?\b|\bfinanced accounts?\b/, entity: "puppy_financing" },
    { pattern: /\bbuyers?\b/, entity: "buyers" },
    { pattern: /\bpupp(?:y|ies)\b/, entity: "puppies" },
    { pattern: /\bcustomer payment alerts?\b|\bpayment alerts?\b|\bpayment notifications?\b/, entity: "payment_alerts" },
    { pattern: /\bpayments?\b/, entity: "payments" },
    { pattern: /\bapplications?\b/, entity: "applications" },
    { pattern: /\bdocuments?\b/, entity: "documents" },
    { pattern: /\bforms?\b/, entity: "forms" },
    { pattern: /\bmessages?\b/, entity: "messages" },
    { pattern: /\bevents?\b|\bupdates?\b/, entity: "events" },
    { pattern: /\bweights?\b/, entity: "weights" },
    { pattern: /\bhealth\b|\bhealth records?\b/, entity: "health" },
    { pattern: /\bpickup requests?\b|\btransportation requests?\b/, entity: "pickup_requests" },
    { pattern: /\bwebsite visitors?\b|\bsite visitors?\b/, entity: "website_visitors" },
    {
      pattern: /\bpublic chat threads?\b|\bpublic threads?\b|\bwebsite chat threads?\b/,
      entity: "public_threads",
    },
    {
      pattern: /\bpublic chat messages?\b|\bpublic messages?\b/,
      entity: "public_messages",
    },
    { pattern: /\bcrm leads?\b|\bwebsite leads?\b/, entity: "crm_leads" },
    { pattern: /\bcrm follow[- ]?ups?\b|\bfollow[- ]?ups?\b/, entity: "crm_followups" },
    { pattern: /\badmin digests?\b|\bowner digest\b/, entity: "admin_digests" },
    { pattern: /\bzoho customers?\b/, entity: "zoho_customers" },
    { pattern: /\bzoho payments?\b/, entity: "zoho_payments" },
  ];

  const matchedEntity = entityMap.find((entry) => entry.pattern.test(normalizedText))?.entity;
  const listMatch =
    normalizedText === "buyers" ||
    normalizedText === "litters" ||
    normalizedText === "planned litters" ||
    normalizedText === "upcoming litters" ||
    normalizedText === "puppies" ||
    normalizedText === "payments" ||
    normalizedText === "puppy financing" ||
    normalizedText === "payment plans" ||
    normalizedText === "puppy payment plans" ||
    normalizedText === "financing accounts" ||
    normalizedText === "applications" ||
    normalizedText === "documents" ||
    normalizedText === "forms" ||
    normalizedText === "messages" ||
    normalizedText === "events" ||
    normalizedText === "updates" ||
    normalizedText === "weights" ||
    normalizedText === "health" ||
    normalizedText === "pickup requests" ||
    normalizedText === "website activity" ||
    normalizedText === "website visitors" ||
    normalizedText === "public threads" ||
    normalizedText === "public messages" ||
    normalizedText === "crm leads" ||
    normalizedText === "crm followups" ||
    normalizedText === "crm follow-ups" ||
    normalizedText === "admin digests" ||
    normalizedText === "payment alerts" ||
    normalizedText === "customer payment alerts" ||
    normalizedText === "zoho customers" ||
    normalizedText === "zoho payments" ||
    /^(?:list|show|get|view)\b/.test(normalizedText) ||
    /^(?:who are|what are)\b/.test(normalizedText);
  const countMatch = /^(?:how many|count|total)\b/.test(normalizedText);

  if (matchedEntity && (listMatch || countMatch)) {
    const queryMatch = extractListQueryForEntity(normalizedText, matchedEntity);

    return {
      action: "list_records",
      entity: matchedEntity,
      query: queryMatch,
      limit: countMatch ? 0 : 12,
    };
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

  if (!process.env.ANTHROPIC_API_KEY) {
    return { action: "answer_only", reason: "intent extraction skipped because anthropic is unavailable" };
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

async function findPuppyForBuyer(
  admin: SupabaseClient,
  buyer: BuyerRecord | null
): Promise<PuppyRecord | null> {
  if (!buyer?.id) return null;

  if (buyer.puppy_id) {
    const linkedPuppy = await findPuppyByNameOrId(admin, null, buyer.puppy_id);
    if (linkedPuppy) return linkedPuppy;
  }

  const { data, error } = await admin
    .from("puppies")
    .select("*")
    .eq("buyer_id", buyer.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<PuppyRecord>();

  if (!error && data) return data;
  return null;
}

function numbersRoughlyMatch(left: number | null | undefined, right: number | null | undefined) {
  const a = Number(left || 0);
  const b = Number(right || 0);

  if (!(a > 0) || !(b > 0)) return false;
  return Math.abs(a - b) < 0.01;
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
  if (intent.action === "list_records") {
    return intent.entity ? [] : ["what to list"];
  }

  if (intent.action === "add_litters") {
    if (intent.litters?.length) {
      return [];
    }
    return ["planned litter details"];
  }

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

  if (intent.action === "create_zoho_payment_link") {
    const missing: string[] = [];
    if (intent.amount === null || intent.amount === undefined || Number.isNaN(Number(intent.amount))) {
      missing.push("amount");
    }
    if (!intent.description) {
      missing.push("description");
    }
    return missing;
  }

  return [];
}

function recordLimit(value: number | null | undefined, fallback = 12) {
  if (value === 0) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.max(Math.round(parsed), 1), 50);
}

function previewText(value: string | null | undefined, fallback = "No summary available.", max = 140) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > max ? `${text.slice(0, Math.max(0, max - 3)).trimEnd()}...` : text;
}

function sinceIso(days = 1) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function portalDateToken(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "0000";
  const month = parts.find((part) => part.type === "month")?.value || "00";
  const day = parts.find((part) => part.type === "day")?.value || "00";
  return `${year}-${month}-${day}`;
}

function matchesQueryText(values: unknown[], queryText: string) {
  if (!queryText) return true;
  return values
    .map((value) => String(value || "").toLowerCase())
    .join(" ")
    .includes(queryText);
}

function matchesRelativeDateQuery(value: string | null | undefined, queryText: string) {
  if (!queryText) return true;
  if (!/\btoday\b|\byesterday\b/.test(queryText)) return true;
  const token = String(value || "").slice(0, 10);
  if (!token) return false;
  if (/\btoday\b/.test(queryText)) return token === portalDateToken();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return token === portalDateToken(yesterday);
}

function stripRelativeQueryTerms(queryText: string) {
  return queryText
    .replace(/\btoday\b|\byesterday\b|\brecent\b|\blatest\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatListDate(value: string | null | undefined) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatUnixDate(value: number | null | undefined) {
  if (value === null || value === undefined) return "No date";
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCurrency(value: number | null | undefined, currency = "USD") {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatNaturalList(values: Array<string | null | undefined>, fallback = "None yet") {
  const items = Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );

  if (!items.length) return fallback;
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function normalizeBreedingRoleValue(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase() === "sire" ? "sire" : "dam";
}

async function executeAdminOperationalIntelligence(
  admin: SupabaseClient,
  userMessage: string
) {
  const lower = String(userMessage || "")
    .trim()
    .toLowerCase()
    .replace(/[?.!]+$/g, "");

  if (!lower) return "";

  const wantsCount = /\bhow many\b|\bcount\b|\btotal\b/.test(lower);
  const wantsList = /\bshow\b|\blist\b|\bwhich\b|\bwho\b|\bwhat\b/.test(lower);
  const wantsReadback =
    wantsCount ||
    wantsList ||
    /\bsummary\b|\boverview\b|\bsnapshot\b|\bstatus\b|\bdo i have\b|\bare there\b|\bwhat's\b|\bwhats\b/.test(
      lower
    );
  const asksBreedingProgram =
    wantsReadback &&
    /\bdam'?s?\b|\bsires?\b|\blitters?\b|\bbreeding dogs?\b|\bbreeding program\b|\blineage\b/.test(
      lower
    );

  if (asksBreedingProgram) {
    const workspace = await loadAdminLineageWorkspace(admin);
    const dams = workspace.dogs.filter((dog) => normalizeBreedingRoleValue(dog.role) === "dam");
    const sires = workspace.dogs.filter((dog) => normalizeBreedingRoleValue(dog.role) === "sire");
    const wantsDams = /\bdam'?s?\b/.test(lower);
    const wantsSires = /\bsires?\b/.test(lower);
    const wantsLitters = /\blitters?\b/.test(lower);
    const wantsRoster = /\bbreeding dogs?\b|\broster\b/.test(lower);
    const wantsSummary =
      /\bsummary\b|\boverview\b|\bsnapshot\b|\bstatus\b|\bbreeding program\b|\blineage\b/.test(
        lower
      ) || (!wantsDams && !wantsSires && !wantsLitters && !wantsRoster);

    const damNames = dams.map((dog) => dog.displayName);
    const sireNames = sires.map((dog) => dog.displayName);
    const latestLitters = workspace.litters.slice(0, 6).map((litter) => {
      const name = litter.displayName || `Litter #${litter.id}`;
      const pairing = formatNaturalList(
        [
          firstValue(
            litter.damProfile?.display_name,
            litter.damProfile?.dog_name,
            litter.damProfile?.name,
            litter.damProfile?.call_name
          ),
          firstValue(
            litter.sireProfile?.display_name,
            litter.sireProfile?.dog_name,
            litter.sireProfile?.name,
            litter.sireProfile?.call_name
          ),
        ],
        "Dam and sire not fully linked"
      );
      return `${name} (${pairing})`;
    });

    if (wantsDams && wantsSires && !wantsLitters && !wantsRoster) {
      return [
        `You currently have ${dams.length} dam${dams.length === 1 ? "" : "s"} and ${sires.length} sire${sires.length === 1 ? "" : "s"} in the breeding program.`,
        `Dams: ${formatNaturalList(damNames)}.`,
        `Sires: ${formatNaturalList(sireNames)}.`,
        `Litters on file: ${workspace.summary.totalLitters}.`,
      ].join("\n");
    }

    if (wantsDams && !wantsSires && !wantsLitters && !wantsRoster) {
      if (wantsCount && !wantsList) {
        return `You currently have ${dams.length} dam${dams.length === 1 ? "" : "s"} in the breeding program: ${formatNaturalList(damNames)}.`;
      }

      return [
        `Here ${dams.length === 1 ? "is" : "are"} the current dam${dams.length === 1 ? "" : "s"} in the breeding program:`,
        "",
        ...dams.map((dog, index) => {
          const litterCount = Number(dog.summary.totalLitters || 0);
          const puppyCount = Number(dog.summary.totalPuppies || 0);
          return `${index + 1}. ${dog.displayName} - ${litterCount} litter${litterCount === 1 ? "" : "s"} - ${puppyCount} pupp${puppyCount === 1 ? "y" : "ies"}`;
        }),
      ].join("\n");
    }

    if (wantsSires && !wantsDams && !wantsLitters && !wantsRoster) {
      if (wantsCount && !wantsList) {
        return `You currently have ${sires.length} sire${sires.length === 1 ? "" : "s"} in the breeding program: ${formatNaturalList(sireNames)}.`;
      }

      return [
        `Here ${sires.length === 1 ? "is" : "are"} the current sire${sires.length === 1 ? "" : "s"} in the breeding program:`,
        "",
        ...sires.map((dog, index) => {
          const litterCount = Number(dog.summary.totalLitters || 0);
          const puppyCount = Number(dog.summary.totalPuppies || 0);
          return `${index + 1}. ${dog.displayName} - ${litterCount} litter${litterCount === 1 ? "" : "s"} - ${puppyCount} pupp${puppyCount === 1 ? "y" : "ies"}`;
        }),
      ].join("\n");
    }

    if (wantsLitters && !wantsDams && !wantsSires && !wantsRoster) {
      if (wantsCount && !wantsList) {
        return [
          `You currently have ${workspace.summary.totalLitters} litter${workspace.summary.totalLitters === 1 ? "" : "s"} on file.`,
          latestLitters.length ? `Recent litters: ${formatNaturalList(latestLitters)}.` : null,
        ]
          .filter(Boolean)
          .join("\n");
      }

      return [
        `Here ${workspace.litters.length === 1 ? "is" : "are"} the current litter${workspace.litters.length === 1 ? "" : "s"} on file:`,
        "",
        ...workspace.litters.slice(0, 12).map((litter, index) => {
          const pairing = formatNaturalList(
            [
              firstValue(
                litter.damProfile?.display_name,
                litter.damProfile?.dog_name,
                litter.damProfile?.name,
                litter.damProfile?.call_name
              ),
              firstValue(
                litter.sireProfile?.display_name,
                litter.sireProfile?.dog_name,
                litter.sireProfile?.name,
                litter.sireProfile?.call_name
              ),
            ],
            "Dam and sire not fully linked"
          );
          return `${index + 1}. ${litter.displayName} - ${pairing} - ${litter.summary.totalPuppies} pupp${litter.summary.totalPuppies === 1 ? "y" : "ies"}`;
        }),
      ].join("\n");
    }

    if (wantsRoster && wantsCount && !wantsList) {
      return `You currently have ${workspace.dogs.length} breeding dog profiles total: ${dams.length} dams and ${sires.length} sires.`;
    }

    if (wantsSummary || wantsRoster || wantsList || wantsCount) {
      return [
        "Breeding program snapshot:",
        "",
        `Dams: ${dams.length}`,
        `Sires: ${sires.length}`,
        `Litters: ${workspace.summary.totalLitters}`,
        `Puppies tracked: ${workspace.summary.totalPuppies}`,
        `Available / Reserved / Completed: ${workspace.summary.availableCount} / ${workspace.summary.reservedCount} / ${workspace.summary.completedCount}`,
        `Realized revenue: ${formatCurrency(workspace.summary.realizedRevenue)}`,
        `Projected pipeline: ${formatCurrency(workspace.summary.projectedRevenue)}`,
        damNames.length ? `Dam roster: ${formatNaturalList(damNames)}.` : null,
        sireNames.length ? `Sire roster: ${formatNaturalList(sireNames)}.` : null,
      ]
        .filter(Boolean)
        .join("\n");
    }
  }

  const asksPortalUsers =
    wantsReadback &&
    /\bportal users?\b|\blogged[- ]?in users?\b|\bsigned[- ]?in users?\b|\bregistered users?\b|\buser accounts?\b/.test(
      lower
    );

  if (asksPortalUsers) {
    const [authUsers, buyersResult] = await Promise.all([
      listAllAuthUsers(),
      admin
        .from("buyers")
        .select("id,user_id,full_name,name,email,status,created_at")
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);

    if (buyersResult.error) {
      throw new Error(`Could not load linked buyer accounts: ${buyersResult.error.message}`);
    }

    const portalUsers = authUsers.filter((account) => !isPortalAdminEmail(account.email));
    const buyerRows = buyersResult.data || [];
    const buyersByUserId = new Map(
      buyerRows
        .filter((buyer) => String(buyer.user_id || "").trim())
        .map((buyer) => [String(buyer.user_id), buyer] as const)
    );
    const activeWindow = Date.now() - 1000 * 60 * 60 * 24 * 30;
    const activeRecently = portalUsers.filter((account) => {
      const timestamp = new Date(String(account.last_sign_in_at || "")).getTime();
      return Number.isFinite(timestamp) && timestamp >= activeWindow;
    }).length;
    const linkedBuyerCount = portalUsers.filter((account) => buyersByUserId.has(account.id)).length;

    if (wantsCount && !wantsList) {
      return [
        `There are ${portalUsers.length} non-admin portal user account${portalUsers.length === 1 ? "" : "s"} right now.`,
        `${linkedBuyerCount} ${linkedBuyerCount === 1 ? "is" : "are"} linked to buyer records.`,
        `${activeRecently} signed in within the last 30 days.`,
      ].join("\n");
    }

    const recentUsers = portalUsers
      .slice()
      .sort((left, right) => {
        const leftTime = new Date(String(left.last_sign_in_at || left.created_at || 0)).getTime();
        const rightTime = new Date(String(right.last_sign_in_at || right.created_at || 0)).getTime();
        return rightTime - leftTime;
      })
      .slice(0, 12);

    return [
      `Here ${recentUsers.length === 1 ? "is" : "are"} the latest portal user account${recentUsers.length === 1 ? "" : "s"}:`,
      "",
      ...recentUsers.map((account, index) => {
        const linkedBuyer = buyersByUserId.get(account.id);
        const linkedLabel = linkedBuyer
          ? `linked buyer: ${firstValue(linkedBuyer.full_name, linkedBuyer.name, linkedBuyer.email) || `Buyer #${linkedBuyer.id}`}`
          : "no buyer linked";
        return `${index + 1}. ${account.email || account.phone || account.id} - last sign-in ${formatListDate(account.last_sign_in_at || account.created_at || null)} - ${linkedLabel}`;
      }),
    ].join("\n");
  }

  return "";
}

function shortToken(value: string | number | null | undefined, max = 10) {
  const text = String(value || "").trim();
  if (!text) return "unknown";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function formatSenderLabel(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "unknown";
  if (["assistant", "bot", "chichi", "chi chi"].includes(normalized)) return "ChiChi";
  if (["visitor", "user", "buyer", "lead"].includes(normalized)) return "Visitor";
  return normalized.replace(/_/g, " ");
}

function formatLeadSignals(lead: CrmLeadRecord | null, thread: PublicThreadRecord) {
  const signals = [
    lead?.lead_status || thread.lead_status || "visitor",
    thread.priority || null,
    lead?.lead_score !== null && lead?.lead_score !== undefined
      ? `score ${Number(lead.lead_score)}`
      : null,
    lead?.interest_timeline || null,
    thread.follow_up_needed || lead?.follow_up_needed ? "follow-up needed" : null,
  ].filter(Boolean);

  return signals.join(" - ");
}

function formatLeadContact(lead: CrmLeadRecord | null) {
  const parts = [lead?.email || null, lead?.phone || null].filter(Boolean);
  return parts.length ? parts.join(" - ") : "No contact captured yet.";
}

function formatIntentSignals(lead: CrmLeadRecord | null) {
  const intent = [
    lead?.wants_payment_plan ? "payment plan" : null,
    lead?.wants_available_puppy ? "available puppy" : null,
    lead?.wants_wait_list ? "wait list" : null,
    lead?.wants_application ? "application" : null,
  ].filter(Boolean);

  return intent.length ? intent.join(", ") : "";
}

function mergeTags(...groups: Array<string[] | null | undefined>) {
  return Array.from(
    new Set(
      groups
        .flatMap((group) => group || [])
        .map((tag) => String(tag || "").trim())
        .filter(Boolean)
    )
  );
}

type PublicThreadInsight = {
  messages: PublicMessageRecord[];
  lead: CrmLeadRecord | null;
  followUps: CrmFollowUpRecord[];
};

async function loadPublicThreadInsights(
  admin: SupabaseClient,
  threadIds: Array<string | number | null | undefined>
) {
  const normalizedThreadIds = Array.from(
    new Set(
      threadIds
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
  const details = new Map<string, PublicThreadInsight>();

  if (!normalizedThreadIds.length) {
    return details;
  }

  const [messageResult, leadResult, followUpResult] = await Promise.all([
    admin
      .from("chichi_public_messages")
      .select("id,thread_id,sender,content,intent,topic,created_at,requires_follow_up,follow_up_reason")
      .in("thread_id", normalizedThreadIds)
      .order("created_at", { ascending: true })
      .limit(Math.min(normalizedThreadIds.length * 24, 240))
      .returns<PublicMessageRecord[]>(),
    admin
      .from("crm_leads")
      .select(
        "id,visitor_id,thread_id,email,phone,interest_timeline,lead_score,lead_status,wants_payment_plan,wants_wait_list,wants_available_puppy,wants_application,follow_up_needed,follow_up_status,follow_up_reason,last_contact_at,summary,tags,created_at,updated_at"
      )
      .in("thread_id", normalizedThreadIds)
      .returns<CrmLeadRecord[]>(),
    admin
      .from("crm_followups")
      .select("id,lead_id,thread_id,visitor_id,task_type,reason,status,priority,due_at,notes,created_at")
      .in("thread_id", normalizedThreadIds)
      .order("due_at", { ascending: true })
      .limit(Math.min(normalizedThreadIds.length * 12, 120))
      .returns<CrmFollowUpRecord[]>(),
  ]);

  if (messageResult.error) {
    throw new Error(`Could not load public chat messages: ${messageResult.error.message}`);
  }

  if (leadResult.error) {
    throw new Error(`Could not load CRM lead context: ${leadResult.error.message}`);
  }

  if (followUpResult.error) {
    throw new Error(`Could not load CRM follow-up context: ${followUpResult.error.message}`);
  }

  const leadsByThreadId = new Map<string, CrmLeadRecord>();
  for (const lead of leadResult.data || []) {
    const threadId = String(lead.thread_id || "").trim();
    if (!threadId) continue;

    const current = leadsByThreadId.get(threadId);
    const currentStamp = new Date(
      current?.last_contact_at || current?.updated_at || current?.created_at || 0
    ).getTime();
    const nextStamp = new Date(lead.last_contact_at || lead.updated_at || lead.created_at || 0).getTime();
    if (!current || nextStamp >= currentStamp) {
      leadsByThreadId.set(threadId, lead);
    }
  }

  for (const threadId of normalizedThreadIds) {
    details.set(threadId, {
      messages: (messageResult.data || []).filter((row) => String(row.thread_id || "").trim() === threadId),
      lead: leadsByThreadId.get(threadId) || null,
      followUps: (followUpResult.data || []).filter((row) => String(row.thread_id || "").trim() === threadId),
    });
  }

  return details;
}

function formatPublicThreadTranscript(
  row: PublicThreadRecord,
  detail: PublicThreadInsight | undefined,
  index: number
) {
  const lead = detail?.lead || null;
  const followUps = detail?.followUps || [];
  const messages = detail?.messages || [];
  const mergedTags = mergeTags(row.tags, lead?.tags);
  const intentSignals = formatIntentSignals(lead);
  const summary =
    lead?.summary ||
    row.summary ||
    row.intent_summary ||
    (messages[0]?.content ? previewText(messages[0].content, "No conversation summary yet.", 180) : "");
  const conversationWindow =
    messages.length <= 8 ? messages : messages.slice(Math.max(0, messages.length - 8));
  const lines = [
    `${index + 1}. Thread ${shortToken(row.id, 12)} - ${formatListDate(row.updated_at || null)}`,
    `   Visitor: ${row.visitor_id || "Unknown visitor"}${row.source_page ? ` - ${row.source_page}` : ""}`,
    `   Lead: ${formatLeadSignals(lead, row)}`,
    `   Contact: ${formatLeadContact(lead)}`,
  ];

  if (summary) {
    lines.push(`   Summary: ${previewText(summary, "No conversation summary yet.", 220)}`);
  }

  if (intentSignals) {
    lines.push(`   Intent: ${intentSignals}`);
  }

  if (mergedTags.length) {
    lines.push(`   Tags: ${mergedTags.join(", ")}`);
  }

  const followUpText =
    previewText(
      followUps[0]?.reason ||
        followUps[0]?.notes ||
        lead?.follow_up_reason ||
        row.follow_up_reason,
      "",
      180
    ) || "";

  if (followUpText) {
    lines.push(
      `   Follow-up: ${followUpText}${
        followUps[0]?.due_at ? ` - due ${formatListDate(followUps[0].due_at)}` : ""
      }`
    );
  }

  lines.push("   Conversation:");

  if (!conversationWindow.length) {
    lines.push("   No stored public messages for this thread yet.");
  } else {
    for (const message of conversationWindow) {
      lines.push(
        `   ${formatSenderLabel(message.sender)}: ${previewText(
          message.content,
          "No message content.",
          320
        )}`
      );
    }
  }

  return lines.join("\n");
}

async function safeCount(
  queryFactory: () => PromiseLike<{ count: number | null; error: unknown }>
): Promise<number> {
  try {
    const result = await queryFactory();
    return result.count || 0;
  } catch {
    return 0;
  }
}

async function safeRows<T>(
  queryFactory: () => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  try {
    const result = await queryFactory();
    return (result.data || []) as T[];
  } catch {
    return [];
  }
}

async function getWebsiteActivitySnapshot(admin: SupabaseClient) {
  const since = sinceIso(1);
  const [
    visitors24h,
    returningVisitors24h,
    publicThreads24h,
    publicMessages24h,
    openFollowUps,
    leadRows,
    latestDigestRows,
    publicThreadRows,
  ] = await Promise.all([
    safeCount(() =>
      admin
        .from("website_visitors")
        .select("*", { count: "exact", head: true })
        .gte("last_seen_at", since)
    ),
    safeCount(() =>
      admin
        .from("website_visitors")
        .select("*", { count: "exact", head: true })
        .gte("last_seen_at", since)
        .eq("is_returning", true)
    ),
    safeCount(() =>
      admin
        .from("chichi_public_threads")
        .select("*", { count: "exact", head: true })
        .gte("updated_at", since)
    ),
    safeCount(() =>
      admin
        .from("chichi_public_messages")
        .select("*", { count: "exact", head: true })
        .gte("created_at", since)
    ),
    safeCount(() =>
      admin
        .from("crm_followups")
        .select("*", { count: "exact", head: true })
        .in("status", ["open", "scheduled"])
    ),
    safeRows<CrmLeadRecord>(() =>
      admin
        .from("crm_leads")
        .select("id,email,phone,lead_status")
        .gte("created_at", since)
        .limit(200)
    ),
    safeRows<AdminDigestRecord>(() =>
      admin
        .from("chichi_admin_digests")
        .select("id,digest_date,summary,priorities,stats,created_at")
        .order("digest_date", { ascending: false })
        .limit(1)
    ),
    safeRows<PublicThreadRecord>(() =>
      admin
        .from("chichi_public_threads")
        .select("id,updated_at,lead_status,follow_up_needed,summary,intent_summary,tags")
        .order("updated_at", { ascending: false })
        .limit(3)
    ),
  ]);

  return {
    visitors24h,
    returningVisitors24h,
    publicThreads24h,
    publicMessages24h,
    openFollowUps,
    hotLeads: leadRows.filter((row) => String(row.lead_status || "").toLowerCase() === "hot").length,
    warmLeads: leadRows.filter((row) => String(row.lead_status || "").toLowerCase() === "warm").length,
    sharedContacts: leadRows.filter((row) => !!String(row.email || "").trim() || !!String(row.phone || "").trim())
      .length,
    latestDigest: latestDigestRows[0] || null,
    recentPublicThreads: publicThreadRows,
  };
}

async function executeListRecords(
  admin: SupabaseClient,
  intent: Extract<ActionIntent, { action: "list_records" }>
) {
  const entity = intent.entity;
  const limit = recordLimit(intent.limit, 12);
  const queryText = String(intent.query || "").trim().toLowerCase();
  const searchQuery = stripRelativeQueryTerms(queryText);

  if (!entity) {
    throw new Error("I still need to know what records you want listed.");
  }

  if (entity === "litters") {
    const workspace = await loadAdminLineageWorkspace(admin);
    const rows = workspace.litters.filter((row) => {
      return (
        matchesRelativeDateQuery(row.whelp_date || null, queryText) &&
        matchesQueryText(
          [
            row.displayName,
            row.litter_code,
            row.litter_name,
            row.status,
            row.notes,
            row.whelp_date,
            row.damProfile?.display_name,
            row.damProfile?.dog_name,
            row.damProfile?.call_name,
            row.sireProfile?.display_name,
            row.sireProfile?.dog_name,
            row.sireProfile?.call_name,
          ],
          searchQuery
        )
      );
    });

    if (limit === 0) {
      return `I found ${rows.length} litter record${rows.length === 1 ? "" : "s"}${queryText ? ` matching "${intent.query}".` : "."}`;
    }

    if (!rows.length) {
      return queryText
        ? `I could not find any litters matching "${intent.query}".`
        : "I could not find any litters yet.";
    }

    return [
      `Here ${rows.length === 1 ? "is" : "are"} the latest litter${rows.length === 1 ? "" : "s"}${queryText ? ` matching "${intent.query}"` : ""}:`,
      "",
      ...rows.slice(0, limit).map((row, index) => {
        const name = row.displayName || row.litter_name || row.litter_code || `Litter ${row.id}`;
        const detailParts = [
          row.whelp_date ? `whelp date ${row.whelp_date}` : "planned date not set",
          row.status || "planned",
          row.damProfile?.displayName ? `dam ${row.damProfile.displayName}` : null,
          row.sireProfile?.displayName ? `sire ${row.sireProfile.displayName}` : null,
        ].filter(Boolean);
        const note = previewText(row.notes, "", 110);
        return `${index + 1}. ${name} - ${detailParts.join(" - ")}${note ? ` - ${note}` : ""}`;
      }),
    ].join("\n");
  }

  if (entity === "buyers") {
    const { data, error } = await admin
      .from("buyers")
      .select("id,full_name,name,email,phone,status,created_at")
      .order("created_at", { ascending: false })
      .limit(limit || 500);
    if (error) throw new Error(`Could not load buyers: ${error.message}`);

    const rows = (data || []).filter((row) => {
      if (!queryText) return true;
      return [row.full_name, row.name, row.email, row.phone, row.status]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(queryText);
    });

    if (limit === 0) {
      return `I found ${rows.length} buyer record${rows.length === 1 ? "" : "s"}${queryText ? ` matching "${intent.query}".` : "."}`;
    }

    if (!rows.length) {
      return queryText
        ? `I could not find any buyers matching "${intent.query}".`
        : "I could not find any buyers yet.";
    }

    return [
      `Here ${rows.length === 1 ? "is" : "are"} the latest buyer${rows.length === 1 ? "" : "s"}${queryText ? ` matching "${intent.query}"` : ""}:`,
      "",
      ...rows.slice(0, limit).map((row, index) => {
        const name = row.full_name || row.name || row.email || `Buyer ${row.id}`;
        const parts = [row.email, row.phone, row.status].filter(Boolean);
        return `${index + 1}. ${name}${parts.length ? ` - ${parts.join(" - ")}` : ""}`;
      }),
    ].join("\n");
  }

  if (entity === "puppy_financing") {
    const { data, error } = await admin
      .from("buyers")
      .select(
        "id,full_name,name,email,status,puppy_id,sale_price,finance_enabled,finance_rate,finance_months,finance_monthly_amount,finance_next_due_date"
      )
      .eq("finance_enabled", true)
      .order("finance_next_due_date", { ascending: true, nullsFirst: false })
      .limit(limit || 500);
    if (error) throw new Error(`Could not load puppy financing accounts: ${error.message}`);

    const buyerRows = data || [];
    const buyerIds = Array.from(new Set(buyerRows.map((row) => Number(row.id || 0)).filter(Boolean)));
    const directPuppyIds = Array.from(
      new Set(buyerRows.map((row) => Number(row.puppy_id || 0)).filter(Boolean))
    );

    const [buyerPuppiesResult, directPuppiesResult] = await Promise.all([
      buyerIds.length
        ? admin
            .from("puppies")
            .select("id,buyer_id,call_name,puppy_name,name,status,price")
            .in("buyer_id", buyerIds)
        : Promise.resolve({ data: [], error: null }),
      directPuppyIds.length
        ? admin
            .from("puppies")
            .select("id,buyer_id,call_name,puppy_name,name,status,price")
            .in("id", directPuppyIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (buyerPuppiesResult.error) {
      throw new Error(`Could not load financed puppies: ${buyerPuppiesResult.error.message}`);
    }
    if (directPuppiesResult.error) {
      throw new Error(`Could not load linked financed puppies: ${directPuppiesResult.error.message}`);
    }

    const puppyMap = new Map<number, { names: string[]; statuses: string[]; prices: number[] }>();
    const allPuppies = [...(buyerPuppiesResult.data || []), ...(directPuppiesResult.data || [])];

    for (const puppy of allPuppies) {
      const buyerId = Number(puppy.buyer_id || 0);
      const resolvedBuyerId =
        buyerId ||
        buyerRows.find((row) => Number(row.puppy_id || 0) === Number(puppy.id || 0))?.id ||
        0;
      if (!resolvedBuyerId) continue;

      const current = puppyMap.get(Number(resolvedBuyerId)) || {
        names: [],
        statuses: [],
        prices: [],
      };
      const puppyName = firstValue(puppy.call_name, puppy.puppy_name, puppy.name, `Puppy ${puppy.id}`);
      if (!current.names.includes(puppyName)) current.names.push(puppyName);
      if (puppy.status && !current.statuses.includes(String(puppy.status))) {
        current.statuses.push(String(puppy.status));
      }
      if (Number.isFinite(Number(puppy.price))) current.prices.push(Number(puppy.price));
      puppyMap.set(Number(resolvedBuyerId), current);
    }

    const rows = buyerRows.filter((row) => {
      const puppyInfo = puppyMap.get(Number(row.id)) || { names: [], statuses: [], prices: [] };
      return (
        matchesRelativeDateQuery(row.finance_next_due_date || null, queryText) &&
        matchesQueryText(
          [
            row.full_name,
            row.name,
            row.email,
            row.status,
            row.finance_rate,
            row.finance_months,
            row.finance_monthly_amount,
            row.finance_next_due_date,
            row.sale_price,
            puppyInfo.names.join(" "),
            puppyInfo.statuses.join(" "),
          ],
          searchQuery
        )
      );
    });

    if (limit === 0) {
      return `I found ${rows.length} puppy financing account${rows.length === 1 ? "" : "s"}${queryText ? ` matching "${intent.query}".` : "."}`;
    }

    if (!rows.length) {
      return queryText
        ? `I could not find any puppy financing accounts matching "${intent.query}".`
        : "I could not find any puppy financing accounts yet.";
    }

    return [
      `Here ${rows.length === 1 ? "is" : "are"} the active puppy financing account${rows.length === 1 ? "" : "s"}${queryText ? ` matching "${intent.query}"` : ""}:`,
      "",
      ...rows.slice(0, limit).map((row, index) => {
        const puppyInfo = puppyMap.get(Number(row.id)) || { names: [], statuses: [], prices: [] };
        const buyerName = row.full_name || row.name || row.email || `Buyer ${row.id}`;
        const puppyLabel = puppyInfo.names.length ? puppyInfo.names.join(", ") : "No puppy linked";
        const monthly =
          row.finance_monthly_amount !== null && row.finance_monthly_amount !== undefined
            ? `$${Number(row.finance_monthly_amount).toFixed(2)} / month`
            : "Monthly amount not set";
        const due = row.finance_next_due_date ? `due ${formatListDate(row.finance_next_due_date)}` : "no due date";
        const term =
          row.finance_months !== null && row.finance_months !== undefined
            ? `${row.finance_months} month term`
            : "term not set";
        return `${index + 1}. ${buyerName} - ${puppyLabel} - ${monthly} - ${term} - ${due}`;
      }),
    ].join("\n");
  }

  if (entity === "puppies") {
    const { data, error } = await admin
      .from("puppies")
      .select("id,call_name,puppy_name,name,sex,color,status,owner_email,created_at")
      .order("created_at", { ascending: false })
      .limit(limit || 500);
    if (error) throw new Error(`Could not load puppies: ${error.message}`);

    const rows = (data || []).filter((row) => {
      if (!queryText) return true;
      return [row.call_name, row.puppy_name, row.name, row.sex, row.color, row.status, row.owner_email]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(queryText);
    });

    if (limit === 0) {
      return `I found ${rows.length} pupp${rows.length === 1 ? "y" : "ies"}${queryText ? ` matching "${intent.query}".` : "."}`;
    }

    if (!rows.length) {
      return queryText
        ? `I could not find any puppies matching "${intent.query}".`
        : "I could not find any puppies yet.";
    }

    return [
      `Here ${rows.length === 1 ? "is" : "are"} the latest pupp${rows.length === 1 ? "y" : "ies"}${queryText ? ` matching "${intent.query}"` : ""}:`,
      "",
      ...rows.slice(0, limit).map((row, index) => {
        const name = row.call_name || row.puppy_name || row.name || `Puppy ${row.id}`;
        const parts = [row.sex, row.color, row.status].filter(Boolean);
        return `${index + 1}. ${name}${parts.length ? ` - ${parts.join(" - ")}` : ""}`;
      }),
    ].join("\n");
  }

  if (entity === "payments") {
    const { data, error } = await admin
      .from("buyer_payments")
      .select("id,buyer_id,payment_date,amount,payment_type,method,status,reference_number,created_at")
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit || 500);
    if (error) throw new Error(`Could not load payments: ${error.message}`);

    const buyerIds = Array.from(new Set((data || []).map((row) => Number(row.buyer_id || 0)).filter(Boolean)));
    const buyerMap = new Map<number, string>();
    if (buyerIds.length) {
      const { data: buyers } = await admin.from("buyers").select("id,full_name,name,email").in("id", buyerIds);
      (buyers || []).forEach((buyer) => {
        buyerMap.set(Number(buyer.id), buyer.full_name || buyer.name || buyer.email || `Buyer ${buyer.id}`);
      });
    }

    const rows = (data || []).filter((row) => {
      const haystack = [
        buyerMap.get(Number(row.buyer_id || 0)),
        row.payment_type,
        row.method,
        row.status,
        row.reference_number,
        row.payment_date,
        row.amount,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return !queryText || haystack.includes(queryText);
    });

    if (limit === 0) {
      return `I found ${rows.length} payment record${rows.length === 1 ? "" : "s"}${queryText ? ` matching "${intent.query}".` : "."}`;
    }

    if (!rows.length) {
      return queryText
        ? `I could not find any payments matching "${intent.query}".`
        : "I could not find any payments yet.";
    }

    return [
      `Here ${rows.length === 1 ? "is" : "are"} the latest payment${rows.length === 1 ? "" : "s"}${queryText ? ` matching "${intent.query}"` : ""}:`,
      "",
      ...rows.slice(0, limit).map((row, index) => {
        const buyerName = buyerMap.get(Number(row.buyer_id || 0)) || `Buyer ${row.buyer_id || "-"}`;
        return `${index + 1}. ${buyerName} - $${Number(row.amount || 0).toFixed(2)} - ${row.payment_date || "No date"} - ${row.status || "recorded"}`;
      }),
    ].join("\n");
  }

  if (entity === "applications") {
    const { data, error } = await admin
      .from("puppy_applications")
      .select("id,full_name,email,applicant_email,phone,status,created_at,assigned_puppy_id")
      .order("created_at", { ascending: false })
      .limit(limit || 500);
    if (error) throw new Error(`Could not load applications: ${error.message}`);

    const rows = (data || []).filter((row) => {
      if (!queryText) return true;
      return [row.full_name, row.email, row.applicant_email, row.phone, row.status, row.assigned_puppy_id]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(queryText);
    });

    if (limit === 0) {
      return `I found ${rows.length} application${rows.length === 1 ? "" : "s"}${queryText ? ` matching "${intent.query}".` : "."}`;
    }

    if (!rows.length) {
      return queryText
        ? `I could not find any applications matching "${intent.query}".`
        : "I could not find any applications yet.";
    }

    return [
      `Here ${rows.length === 1 ? "is" : "are"} the latest application${rows.length === 1 ? "" : "s"}${queryText ? ` matching "${intent.query}"` : ""}:`,
      "",
      ...rows.slice(0, limit).map((row, index) => {
        const name = row.full_name || row.email || row.applicant_email || `Application ${row.id}`;
        const parts = [row.status, row.phone, row.assigned_puppy_id ? `puppy ${row.assigned_puppy_id}` : null].filter(Boolean);
        return `${index + 1}. ${name}${parts.length ? ` - ${parts.join(" - ")}` : ""}`;
      }),
    ].join("\n");
  }

  if (entity === "forms") {
    const { data, error } = await admin
      .from("portal_form_submissions")
      .select("id,user_email,form_key,form_title,status,submitted_at,created_at")
      .order("created_at", { ascending: false })
      .limit(limit || 500);
    if (error) throw new Error(`Could not load forms: ${error.message}`);

    const rows = (data || []).filter((row) => {
      if (!queryText) return true;
      return [row.user_email, row.form_key, row.form_title, row.status]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(queryText);
    });

    if (limit === 0) {
      return `I found ${rows.length} form submission${rows.length === 1 ? "" : "s"}${queryText ? ` matching "${intent.query}".` : "."}`;
    }

    if (!rows.length) {
      return queryText
        ? `I could not find any form submissions matching "${intent.query}".`
        : "I could not find any form submissions yet.";
    }

    return [
      `Here ${rows.length === 1 ? "is" : "are"} the latest form submission${rows.length === 1 ? "" : "s"}${queryText ? ` matching "${intent.query}"` : ""}:`,
      "",
      ...rows.slice(0, limit).map((row, index) => {
        const title = row.form_title || row.form_key || `Form ${row.id}`;
        const when = row.submitted_at || row.created_at || "No date";
        return `${index + 1}. ${title} - ${row.user_email || "No email"} - ${row.status || "draft"} - ${when}`;
      }),
    ].join("\n");
  }

  if (entity === "documents") {
    const [formRes, docRes] = await Promise.all([
      admin
        .from("portal_form_submissions")
        .select("id,user_email,form_title,form_key,status,submitted_at,created_at")
        .order("created_at", { ascending: false })
        .limit(limit || 250),
      admin
        .from("portal_documents")
        .select("id,title,category,status,email,created_at,file_name")
        .order("created_at", { ascending: false })
        .limit(limit || 250),
    ]);

    if (formRes.error) throw new Error(`Could not load form records: ${formRes.error.message}`);
    if (docRes.error) throw new Error(`Could not load portal documents: ${docRes.error.message}`);

    const rows = [
      ...(formRes.data || []).map((row) => ({
        title: row.form_title || row.form_key || `Form ${row.id}`,
        email: row.user_email || null,
        status: row.status || "draft",
        kind: "form",
        created_at: row.submitted_at || row.created_at || null,
      })),
      ...(docRes.data || []).map((row) => ({
        title: row.title || row.file_name || `Document ${row.id}`,
        email: row.email || null,
        status: row.status || row.category || "document",
        kind: "document",
        created_at: row.created_at || null,
      })),
    ].filter((row) => {
      if (!queryText) return true;
      return [row.title, row.email, row.status, row.kind]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(queryText);
    });

    if (limit === 0) {
      return `I found ${rows.length} document record${rows.length === 1 ? "" : "s"}${queryText ? ` matching "${intent.query}".` : "."}`;
    }

    if (!rows.length) {
      return queryText
        ? `I could not find any document records matching "${intent.query}".`
        : "I could not find any document records yet.";
    }

    return [
      `Here ${rows.length === 1 ? "is" : "are"} the latest document record${rows.length === 1 ? "" : "s"}${queryText ? ` matching "${intent.query}"` : ""}:`,
      "",
      ...rows.slice(0, limit).map((row, index) => {
        return `${index + 1}. ${row.title} - ${row.kind} - ${row.email || "No email"} - ${row.status}`;
      }),
    ].join("\n");
  }

  if (entity === "messages") {
    const { data, error } = await admin
      .from("portal_messages")
      .select("id,created_at,user_email,subject,message,status,read_by_admin,sender")
      .order("created_at", { ascending: false })
      .limit(limit || 500);
    if (error) throw new Error(`Could not load portal messages: ${error.message}`);

    const rows = (data || []).filter((row) => {
      if (!queryText) return true;
      return [row.user_email, row.subject, row.message, row.status, row.sender]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(queryText);
    });

    if (limit === 0) {
      return `I found ${rows.length} message${rows.length === 1 ? "" : "s"}${queryText ? ` matching "${intent.query}".` : "."}`;
    }

    if (!rows.length) {
      return queryText
        ? `I could not find any portal messages matching "${intent.query}".`
        : "I could not find any portal messages yet.";
    }

    return [
      `Here ${rows.length === 1 ? "is" : "are"} the latest message${rows.length === 1 ? "" : "s"}${queryText ? ` matching "${intent.query}"` : ""}:`,
      "",
      ...rows.slice(0, limit).map((row, index) => {
        const preview = String(row.message || "").replace(/\s+/g, " ").trim().slice(0, 70);
        return `${index + 1}. ${row.user_email || "No email"} - ${row.sender || "unknown"} - ${row.status || "open"} - ${preview}${preview.length === 70 ? "..." : ""}`;
      }),
    ].join("\n");
  }

  if (entity === "events") {
    const { data, error } = await admin
      .from("puppy_events")
      .select("id,event_date,event_type,label,title,summary")
      .order("event_date", { ascending: false })
      .limit(limit || 500);
    if (error) throw new Error(`Could not load puppy events: ${error.message}`);

    const rows = (data || []).filter((row) => {
      if (!queryText) return true;
      return [row.event_date, row.event_type, row.label, row.title, row.summary]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(queryText);
    });

    if (limit === 0) {
      return `I found ${rows.length} update${rows.length === 1 ? "" : "s"}${queryText ? ` matching "${intent.query}".` : "."}`;
    }

    if (!rows.length) {
      return queryText
        ? `I could not find any updates matching "${intent.query}".`
        : "I could not find any puppy events yet.";
    }

    return [
      `Here ${rows.length === 1 ? "is" : "are"} the latest update${rows.length === 1 ? "" : "s"}${queryText ? ` matching "${intent.query}"` : ""}:`,
      "",
      ...rows.slice(0, limit).map((row, index) => {
        const title = row.title || row.label || `Event ${row.id}`;
        return `${index + 1}. ${title} - ${row.event_date || "No date"} - ${row.event_type || "event"}`;
      }),
    ].join("\n");
  }

  if (entity === "weights") {
    const { data, error } = await admin
      .from("puppy_weights")
      .select("id,weight_date,weigh_date,age_weeks,weight_oz,weight_g,notes,source")
      .order("weight_date", { ascending: false })
      .order("weigh_date", { ascending: false })
      .limit(limit || 500);
    if (error) throw new Error(`Could not load puppy weights: ${error.message}`);

    const rows = (data || []).filter((row) => {
      if (!queryText) return true;
      return [row.weight_date, row.weigh_date, row.age_weeks, row.weight_oz, row.weight_g, row.notes, row.source]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(queryText);
    });

    if (limit === 0) {
      return `I found ${rows.length} weight entr${rows.length === 1 ? "y" : "ies"}${queryText ? ` matching "${intent.query}".` : "."}`;
    }

    if (!rows.length) {
      return queryText
        ? `I could not find any puppy weights matching "${intent.query}".`
        : "I could not find any puppy weights yet.";
    }

    return [
      `Here ${rows.length === 1 ? "is" : "are"} the latest weight entr${rows.length === 1 ? "y" : "ies"}${queryText ? ` matching "${intent.query}"` : ""}:`,
      "",
      ...rows.slice(0, limit).map((row, index) => {
        const weight =
          row.weight_oz !== null && row.weight_oz !== undefined
            ? `${row.weight_oz} oz`
            : row.weight_g !== null && row.weight_g !== undefined
              ? `${row.weight_g} g`
              : "No weight";
        return `${index + 1}. ${row.weight_date || row.weigh_date || "No date"} - ${weight} - ${row.age_weeks ?? "?"} weeks`;
      }),
    ].join("\n");
  }

  if (entity === "health") {
    const { data, error } = await admin
      .from("puppy_health_records")
      .select("id,record_date,record_type,title,description,next_due_date")
      .order("record_date", { ascending: false })
      .limit(limit || 500);
    if (error) throw new Error(`Could not load health records: ${error.message}`);

    const rows = (data || []).filter((row) => {
      if (!queryText) return true;
      return [row.record_date, row.record_type, row.title, row.description, row.next_due_date]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(queryText);
    });

    if (limit === 0) {
      return `I found ${rows.length} health record${rows.length === 1 ? "" : "s"}${queryText ? ` matching "${intent.query}".` : "."}`;
    }

    if (!rows.length) {
      return queryText
        ? `I could not find any health records matching "${intent.query}".`
        : "I could not find any health records yet.";
    }

    return [
      `Here ${rows.length === 1 ? "is" : "are"} the latest health record${rows.length === 1 ? "" : "s"}${queryText ? ` matching "${intent.query}"` : ""}:`,
      "",
      ...rows.slice(0, limit).map((row, index) => {
        return `${index + 1}. ${row.title} - ${row.record_date || "No date"} - ${row.record_type || "record"}${row.next_due_date ? ` - next due ${row.next_due_date}` : ""}`;
      }),
    ].join("\n");
  }

  if (entity === "pickup_requests") {
    const { data, error } = await admin
      .from("portal_pickup_requests")
      .select("id,request_date,request_type,location_text,address_text,status,miles")
      .order("request_date", { ascending: false })
      .limit(limit || 500);
    if (error) throw new Error(`Could not load pickup requests: ${error.message}`);

    const rows = (data || []).filter((row) => {
      if (!queryText) return true;
      return [row.request_date, row.request_type, row.location_text, row.address_text, row.status, row.miles]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(queryText);
    });

    if (limit === 0) {
      return `I found ${rows.length} transportation request${rows.length === 1 ? "" : "s"}${queryText ? ` matching "${intent.query}".` : "."}`;
    }

    if (!rows.length) {
      return queryText
        ? `I could not find any transportation requests matching "${intent.query}".`
        : "I could not find any transportation requests yet.";
    }

    return [
      `Here ${rows.length === 1 ? "is" : "are"} the latest transportation request${rows.length === 1 ? "" : "s"}${queryText ? ` matching "${intent.query}"` : ""}:`,
      "",
      ...rows.slice(0, limit).map((row, index) => {
        const location = row.location_text || row.address_text || "No location";
        return `${index + 1}. ${row.request_date || "No date"} - ${row.request_type || "request"} - ${location} - ${row.status || "pending"}`;
      }),
    ].join("\n");
  }

  if (entity === "website_activity") {
    const snapshot = await getWebsiteActivitySnapshot(admin);
    const latestDigest =
      snapshot.latestDigest && matchesRelativeDateQuery(snapshot.latestDigest.digest_date, queryText)
        ? snapshot.latestDigest
        : /\btoday\b|\byesterday\b/.test(queryText)
          ? null
          : snapshot.latestDigest;

    if (limit === 0) {
      return `Website activity snapshot: ${snapshot.visitors24h} visitors, ${snapshot.publicThreads24h} public threads, and ${snapshot.openFollowUps} open follow-ups in the last 24 hours.`;
    }

    const lines = [
      /\btoday\b/.test(queryText)
        ? `Here is the website activity snapshot for ${portalDateToken()}:`
        : "Here is the latest website activity snapshot:",
      "",
      `Visitors (24h): ${snapshot.visitors24h}`,
      `Returning visitors (24h): ${snapshot.returningVisitors24h}`,
      `Public threads (24h): ${snapshot.publicThreads24h}`,
      `Public messages (24h): ${snapshot.publicMessages24h}`,
      `Open follow-ups: ${snapshot.openFollowUps}`,
      `Hot leads (24h): ${snapshot.hotLeads}`,
      `Warm leads (24h): ${snapshot.warmLeads}`,
      `Shared contacts (24h): ${snapshot.sharedContacts}`,
      "",
      latestDigest
        ? `Latest admin digest (${latestDigest.digest_date || "No date"}): ${previewText(
            latestDigest.summary,
            "No admin digest summary yet."
          )}`
        : /\btoday\b|\byesterday\b/.test(queryText)
          ? `No admin digest is stored for ${/\btoday\b/.test(queryText) ? portalDateToken() : "yesterday"}.`
          : "No admin digest has been stored yet.",
    ];

    if (snapshot.recentPublicThreads.length) {
      lines.push("", "Recent public threads:");
      snapshot.recentPublicThreads.forEach((row, index) => {
        lines.push(
          `${index + 1}. ${String(row.lead_status || "visitor")} - ${formatListDate(
            row.updated_at || null
          )} - ${previewText(row.summary || row.intent_summary, "No thread summary yet.", 100)}`
        );
      });
    }

    return lines.join("\n");
  }

  if (entity === "website_visitors") {
    const { data, error } = await admin
      .from("website_visitors")
      .select(
        "id,session_id,first_seen_at,last_seen_at,landing_page,referrer,utm_source,is_returning,visit_count,city,region,country"
      )
      .order("last_seen_at", { ascending: false })
      .limit(limit || 500)
      .returns<WebsiteVisitorRecord[]>();
    if (error) throw new Error(`Could not load website visitors: ${error.message}`);

    const rows = (data || []).filter((row) => {
      return (
        matchesRelativeDateQuery(row.last_seen_at, queryText) &&
        matchesQueryText(
          [
            row.id,
            row.session_id,
            row.landing_page,
            row.referrer,
            row.utm_source,
            row.city,
            row.region,
            row.country,
            row.visit_count,
            row.is_returning ? "returning" : "new",
          ],
          searchQuery
        )
      );
    });

    if (limit === 0) {
      return `I found ${rows.length} website visitor record${rows.length === 1 ? "" : "s"}${
        queryText ? ` matching "${intent.query}".` : "."
      }`;
    }

    if (!rows.length) {
      return queryText
        ? `I could not find any website visitors matching "${intent.query}".`
        : "I could not find any website visitors yet.";
    }

    return [
      `Here ${rows.length === 1 ? "is" : "are"} the latest website visitor${
        rows.length === 1 ? "" : "s"
      }${queryText ? ` matching "${intent.query}"` : ""}:`,
      "",
      ...rows.slice(0, limit).map((row, index) => {
        const location = [row.city, row.region || row.country].filter(Boolean).join(", ");
        return `${index + 1}. ${formatListDate(row.last_seen_at || row.first_seen_at || null)} - ${
          row.is_returning ? "returning" : "new"
        } visitor - ${row.landing_page || "No landing page"}${
          location ? ` - ${location}` : ""
        } - ${row.visit_count || 1} visit${Number(row.visit_count || 1) === 1 ? "" : "s"}`;
      }),
    ].join("\n");
  }

  if (entity === "public_threads") {
    const { data, error } = await admin
      .from("chichi_public_threads")
      .select(
        "id,visitor_id,updated_at,lead_status,follow_up_needed,follow_up_reason,summary,intent_summary,tags,priority,source_page"
      )
      .order("updated_at", { ascending: false })
      .limit(limit || 500);
    if (error) throw new Error(`Could not load public chat threads: ${error.message}`);

    const rows = (data || []).filter((row) => {
      return (
        matchesRelativeDateQuery(row.updated_at, queryText) &&
        matchesQueryText(
          [
            row.id,
            row.visitor_id,
            row.lead_status,
            row.follow_up_reason,
            row.summary,
            row.intent_summary,
            Array.isArray(row.tags) ? row.tags.join(" ") : "",
            row.priority,
            row.source_page,
          ],
          searchQuery
        )
      );
    });

    if (limit === 0) {
      return `I found ${rows.length} public chat thread${rows.length === 1 ? "" : "s"}${
        queryText ? ` matching "${intent.query}".` : "."
      }`;
    }

    if (!rows.length) {
      return queryText
        ? `I could not find any public chat threads matching "${intent.query}".`
        : "I could not find any public chat threads yet.";
    }

    const displayRows = rows.slice(0, Math.min(limit || 12, 6));
    const insights = await loadPublicThreadInsights(
      admin,
      displayRows.map((row) => row.id)
    );

    const lines = [
      `Here ${
        rows.length === 1 ? "is" : "are"
      } the latest public chat thread${rows.length === 1 ? "" : "s"} with conversation detail${
        queryText ? ` matching "${intent.query}"` : ""
      }:`,
      "",
      ...displayRows.map((row, index) =>
        formatPublicThreadTranscript(row, insights.get(String(row.id)), index)
      ),
    ];

    if (rows.length > displayRows.length) {
      lines.push(
        "",
        `Showing ${displayRows.length} of ${rows.length} matching threads. Ask for a visitor, topic, date, or lead status to narrow the transcript list further.`
      );
    }

    return lines.join("\n");
  }

  if (entity === "public_messages") {
    const { data, error } = await admin
      .from("chichi_public_messages")
      .select("id,thread_id,sender,content,intent,topic,created_at,requires_follow_up,follow_up_reason")
      .order("created_at", { ascending: false })
      .limit(limit || 500)
      .returns<PublicMessageRecord[]>();
    if (error) throw new Error(`Could not load public chat messages: ${error.message}`);

    const rows = (data || []).filter((row) => {
      return (
        matchesRelativeDateQuery(row.created_at, queryText) &&
        matchesQueryText(
          [
            row.id,
            row.thread_id,
            row.sender,
            row.content,
            row.intent,
            row.topic,
            row.follow_up_reason,
            row.requires_follow_up ? "follow-up" : "",
          ],
          searchQuery
        )
      );
    });

    if (limit === 0) {
      return `I found ${rows.length} public chat message${rows.length === 1 ? "" : "s"}${
        queryText ? ` matching "${intent.query}".` : "."
      }`;
    }

    if (!rows.length) {
      return queryText
        ? `I could not find any public chat messages matching "${intent.query}".`
        : "I could not find any public chat messages yet.";
    }

    return [
      `Here ${rows.length === 1 ? "is" : "are"} the latest public chat message${
        rows.length === 1 ? "" : "s"
      }${queryText ? ` matching "${intent.query}"` : ""}:`,
      "",
      ...rows.slice(0, limit).map((row, index) => {
        return `${index + 1}. ${formatListDate(row.created_at || null)} - ${
          row.sender || "unknown"
        } - ${previewText(row.content, "No message content.", 100)}`;
      }),
    ].join("\n");
  }

  if (entity === "crm_leads") {
    const { data, error } = await admin
      .from("crm_leads")
      .select(
        "id,visitor_id,thread_id,email,phone,interest_timeline,lead_score,lead_status,wants_payment_plan,wants_wait_list,wants_available_puppy,wants_application,follow_up_needed,follow_up_status,follow_up_reason,last_contact_at,summary,tags,created_at,updated_at"
      )
      .order("last_contact_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit || 500);
    if (error) throw new Error(`Could not load CRM leads: ${error.message}`);

    const rows = (data || []).filter((row) => {
      return (
        matchesRelativeDateQuery(row.last_contact_at || row.created_at, queryText) &&
        matchesQueryText(
          [
            row.id,
            row.email,
            row.phone,
            row.interest_timeline,
            row.lead_score,
            row.lead_status,
            row.follow_up_status,
            row.follow_up_reason,
            row.summary,
            Array.isArray(row.tags) ? row.tags.join(" ") : "",
            row.wants_payment_plan ? "payment plan" : "",
            row.wants_wait_list ? "wait list" : "",
            row.wants_available_puppy ? "available puppy" : "",
            row.wants_application ? "application" : "",
          ],
          searchQuery
        )
      );
    });

    if (limit === 0) {
      return `I found ${rows.length} CRM lead${rows.length === 1 ? "" : "s"}${
        queryText ? ` matching "${intent.query}".` : "."
      }`;
    }

    if (!rows.length) {
      return queryText
        ? `I could not find any CRM leads matching "${intent.query}".`
        : "I could not find any CRM leads yet.";
    }

    return [
      `Here ${rows.length === 1 ? "is" : "are"} the latest CRM lead${
        rows.length === 1 ? "" : "s"
      }${queryText ? ` matching "${intent.query}"` : ""}:`,
      "",
      ...rows.slice(0, limit).map((row, index) => {
        const tags = Array.isArray(row.tags) ? row.tags.slice(0, 3).join(", ") : "";
        return `${index + 1}. ${row.email || row.phone || `Lead ${row.id}`} - ${
          row.lead_status || "new"
        } - score ${Number(row.lead_score || 0)} - ${formatListDate(
          row.last_contact_at || row.created_at || null
        )}${tags ? ` - ${tags}` : ""}`;
      }),
    ].join("\n");
  }

  if (entity === "crm_followups") {
    const { data, error } = await admin
      .from("crm_followups")
      .select("id,lead_id,thread_id,visitor_id,task_type,reason,status,priority,due_at,notes,created_at")
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit || 500)
      .returns<CrmFollowUpRecord[]>();
    if (error) throw new Error(`Could not load CRM follow-ups: ${error.message}`);

    const rows = (data || []).filter((row) => {
      return (
        matchesRelativeDateQuery(row.due_at || row.created_at, queryText) &&
        matchesQueryText(
          [
            row.id,
            row.lead_id,
            row.thread_id,
            row.visitor_id,
            row.task_type,
            row.reason,
            row.status,
            row.priority,
            row.notes,
          ],
          searchQuery
        )
      );
    });

    if (limit === 0) {
      return `I found ${rows.length} CRM follow-up${rows.length === 1 ? "" : "s"}${
        queryText ? ` matching "${intent.query}".` : "."
      }`;
    }

    if (!rows.length) {
      return queryText
        ? `I could not find any CRM follow-ups matching "${intent.query}".`
        : "I could not find any CRM follow-ups yet.";
    }

    return [
      `Here ${rows.length === 1 ? "is" : "are"} the latest CRM follow-up${
        rows.length === 1 ? "" : "s"
      }${queryText ? ` matching "${intent.query}"` : ""}:`,
      "",
      ...rows.slice(0, limit).map((row, index) => {
        return `${index + 1}. ${row.task_type || "follow_up"} - ${row.status || "open"} - ${
          row.priority || "normal"
        } - due ${formatListDate(row.due_at || row.created_at || null)} - ${previewText(
          row.reason || row.notes,
          "No follow-up note.",
          90
        )}`;
      }),
    ].join("\n");
  }

  if (entity === "admin_digests") {
    const { data, error } = await admin
      .from("chichi_admin_digests")
      .select("id,digest_date,summary,priorities,stats,created_at")
      .order("digest_date", { ascending: false })
      .limit(limit || 500);
    if (error) throw new Error(`Could not load admin digests: ${error.message}`);

    const rows = (data || []).filter((row) => {
      return (
        matchesRelativeDateQuery(row.digest_date || row.created_at, queryText) &&
        matchesQueryText(
          [
            row.id,
            row.digest_date,
            row.summary,
            Array.isArray(row.priorities) ? row.priorities.join(" ") : "",
          ],
          searchQuery
        )
      );
    });

    if (limit === 0) {
      return `I found ${rows.length} admin digest${rows.length === 1 ? "" : "s"}${
        queryText ? ` matching "${intent.query}".` : "."
      }`;
    }

    if (!rows.length) {
      return queryText
        ? `I could not find any admin digests matching "${intent.query}".`
        : "I could not find any admin digests yet.";
    }

    return [
      `Here ${rows.length === 1 ? "is" : "are"} the latest admin digest${
        rows.length === 1 ? "" : "s"
      }${queryText ? ` matching "${intent.query}"` : ""}:`,
      "",
      ...rows.slice(0, limit).map((row, index) => {
        const priorities = Array.isArray(row.priorities) ? row.priorities.slice(0, 3).join(" | ") : "";
        return `${index + 1}. ${row.digest_date || formatListDate(row.created_at || null)} - ${previewText(
          row.summary,
          "No digest summary."
        )}${priorities ? ` - priorities: ${priorities}` : ""}`;
      }),
    ].join("\n");
  }

  if (entity === "payment_alerts") {
    const { data, error } = await admin
      .from("chichi_admin_alerts")
      .select("id,created_at,title,message,tone,event_type,payment_id,reference_id")
      .eq("alert_scope", "payment")
      .order("created_at", { ascending: false })
      .limit(limit || 500);

    if (error) {
      const message = String(error.message || "").toLowerCase();
      if (
        message.includes("does not exist") ||
        message.includes("could not find the table") ||
        message.includes("schema cache")
      ) {
        return "I could not find any payment alerts yet because the payment alert feed has not been migrated into Supabase.";
      }

      throw new Error(`Could not load payment alerts: ${error.message}`);
    }

    const rows = (data || []).filter((row) => {
      return matchesQueryText(
        [row.id, row.title, row.message, row.tone, row.event_type, row.payment_id, row.reference_id],
        searchQuery
      );
    });

    if (limit === 0) {
      return `I found ${rows.length} payment alert${rows.length === 1 ? "" : "s"}${
        queryText ? ` matching "${intent.query}".` : "."
      }`;
    }

    if (!rows.length) {
      return queryText
        ? `I could not find any payment alerts matching "${intent.query}".`
        : "I could not find any payment alerts yet.";
    }

    return [
      `Here ${rows.length === 1 ? "is" : "are"} the latest customer payment alert${
        rows.length === 1 ? "" : "s"
      }${queryText ? ` matching "${intent.query}"` : ""}:`,
      "",
      ...rows.slice(0, limit).map((row, index) => {
        return `${index + 1}. ${formatListDate(row.created_at || null)} - ${row.title || "Payment alert"} - ${previewText(
          row.message,
          "No payment alert details.",
          120
        )}`;
      }),
    ].join("\n");
  }

  if (entity === "zoho_customers") {
    if (!(await isZohoPaymentsConfigured())) {
      return "Zoho Payments is not configured yet, so I cannot load Zoho customers right now.";
    }

    const rows = await listZohoCustomers({
      query: intent.query,
      limit: limit === 0 ? 50 : limit || 12,
    });

    if (limit === 0) {
      return `I found ${rows.length} Zoho customer${rows.length === 1 ? "" : "s"}${
        queryText ? ` matching "${intent.query}".` : "."
      }`;
    }

    if (!rows.length) {
      return queryText
        ? `I could not find any Zoho customers matching "${intent.query}".`
        : "I could not find any Zoho customers yet.";
    }

    return [
      `Here ${rows.length === 1 ? "is" : "are"} the latest Zoho customer${
        rows.length === 1 ? "" : "s"
      }${queryText ? ` matching "${intent.query}"` : ""}:`,
      "",
      ...rows.map((row, index) => {
        return `${index + 1}. ${row.customer_name || row.customer_email || row.customer_id} - ${
          row.customer_email || "No email"
        } - ${row.customer_phone || "No phone"} - ${row.customer_status || "active"}`;
      }),
    ].join("\n");
  }

  if (entity === "zoho_payments") {
    if (!(await isZohoPaymentsConfigured())) {
      return "Zoho Payments is not configured yet, so I cannot load Zoho payments right now.";
    }

    const rows = await listZohoPayments({
      query: intent.query,
      limit: limit === 0 ? 50 : limit || 12,
    });

    if (limit === 0) {
      return `I found ${rows.length} Zoho payment${rows.length === 1 ? "" : "s"}${
        queryText ? ` matching "${intent.query}".` : "."
      }`;
    }

    if (!rows.length) {
      return queryText
        ? `I could not find any Zoho payments matching "${intent.query}".`
        : "I could not find any Zoho payments yet.";
    }

    return [
      `Here ${rows.length === 1 ? "is" : "are"} the latest Zoho payment${
        rows.length === 1 ? "" : "s"
      }${queryText ? ` matching "${intent.query}"` : ""}:`,
      "",
      ...rows.map((row, index) => {
        return `${index + 1}. ${row.payment_id} - $${Number(row.amount || 0).toFixed(2)} ${
          row.currency || "USD"
        } - ${row.status || "recorded"} - ${formatUnixDate(row.date || null)}`;
      }),
    ].join("\n");
  }

  return "I do not have a list handler for that record type yet.";
}

async function executeCreateZohoPaymentLink(
  req: Request,
  admin: SupabaseClient,
  intent: Extract<ActionIntent, { action: "create_zoho_payment_link" }>
) {
  if (!(await isZohoPaymentsConfigured())) {
    return "Zoho Payments is not configured yet. Add the Zoho Payments account and OAuth environment variables first, then I can create links from chat.";
  }

  const buyer = await findBuyerByNameOrEmail(
    admin,
    intent.buyer_name || null,
    intent.buyer_email || intent.customer_email || null
  );

  const recipientName =
    buyer?.full_name ||
    buyer?.name ||
    intent.buyer_name ||
    intent.customer_email ||
    intent.customer_phone ||
    "the customer";
  const recipientEmail = intent.customer_email || intent.buyer_email || buyer?.email || null;
  const recipientPhone = intent.customer_phone || buyer?.phone || null;
  const amount = Number(intent.amount || 0);
  const puppy = await findPuppyForBuyer(admin, buyer);
  const puppyName = puppy?.call_name || puppy?.puppy_name || puppy?.name || "your puppy";
  let chargeKind =
    intent.charge_kind ||
    inferZohoChargeKind([intent.description, intent.reference_id].filter(Boolean).join(" "));

  if (!chargeKind && buyer) {
    if (!buyer.deposit_date && numbersRoughlyMatch(amount, buyer.deposit_amount)) {
      chargeKind = "deposit";
    } else if (buyer.finance_enabled && numbersRoughlyMatch(amount, buyer.finance_monthly_amount)) {
      chargeKind = "installment";
    } else {
      chargeKind = "general";
    }
  }

  const rawDescription = String(intent.description || "").trim();
  const description =
    chargeKind && (!rawDescription || /^payment link for\b/i.test(rawDescription))
      ? describePortalCharge(chargeKind, puppyName)
      : rawDescription || defaultZohoChargeDescription(chargeKind, recipientName);
  const paymentMethods = Array.from(
    new Set(
      (intent.payment_methods || [])
        .map((value) => String(value || "").trim().toLowerCase())
        .filter((value) => value === "card" || value === "ach_debit" || value === "apple_pay")
    )
  );
  const internalReferenceId =
    !intent.reference_id && buyer?.id && chargeKind
      ? buildPortalChargeReference({
          buyerId: buyer.id,
          puppyId: puppy?.id ?? buyer.puppy_id ?? null,
          chargeKind,
        })
      : null;
  const referenceId = intent.reference_id || internalReferenceId || null;
  const returnUrl = internalReferenceId
    ? new URL("/api/portal/payments/zoho/return", req.url).toString()
    : null;

  const link = await createZohoPaymentLink({
    amount,
    currency: intent.currency || "USD",
    email: recipientEmail,
    phone: recipientPhone,
    description,
    referenceId,
    expiresAt: intent.expires_at || null,
    returnUrl,
    sendEmail: intent.send_email ?? Boolean(recipientEmail),
    paymentMethods: paymentMethods.length ? (paymentMethods as ("ach_debit" | "apple_pay" | "card")[]) : null,
  });

  return [
    `Zoho payment link created for ${recipientName}.`,
    `Amount: $${amount.toFixed(2)} ${String(link.currency || intent.currency || "USD").toUpperCase()}`,
    chargeKind ? `Charge type: ${chargeKind}` : null,
    `Status: ${link.status || "active"}`,
    `Link: ${link.url}`,
    link.expires_at ? `Expires: ${link.expires_at}` : null,
    referenceId ? `Reference: ${referenceId}` : null,
    internalReferenceId ? "Portal sync: enabled through the verified Zoho return flow." : null,
    recipientEmail
      ? intent.send_email ?? true
        ? `Customer email: ${recipientEmail} (notification enabled)`
        : `Customer email: ${recipientEmail}`
      : "Customer email: not provided",
  ]
    .filter(Boolean)
    .join("\n");
}

async function localAdminFallback(
  admin: SupabaseClient,
  userMessage: string
) {
  const directOperationalReply = await executeAdminOperationalIntelligence(admin, userMessage);
  if (directOperationalReply) {
    return directOperationalReply;
  }

  const directIntent = parseDirectActionIntent(userMessage);
  if (directIntent?.action === "list_records") {
    return executeListRecords(admin, directIntent);
  }

  const lower = String(userMessage || "").trim().toLowerCase();
  if (!lower) return "";

  if (/\bbuyers?\b/.test(lower)) {
    return executeListRecords(admin, { action: "list_records", entity: "buyers", limit: 12 });
  }

  if (/\bplanned litters?\b|\bupcoming litters?\b|\blitters?\b/.test(lower)) {
    return executeListRecords(admin, { action: "list_records", entity: "litters", limit: 12 });
  }

  if (/\bpupp(?:y|ies)\b/.test(lower)) {
    return executeListRecords(admin, { action: "list_records", entity: "puppies", limit: 12 });
  }

  if (/\bpayments?\b/.test(lower)) {
    return executeListRecords(admin, { action: "list_records", entity: "payments", limit: 12 });
  }

  if (/\bapplications?\b/.test(lower)) {
    return executeListRecords(admin, { action: "list_records", entity: "applications", limit: 12 });
  }

  if (/\bwebsite (?:updates?|activity|traffic|summary)\b|\bsite updates?\b/.test(lower)) {
    return executeListRecords(admin, { action: "list_records", entity: "website_activity", limit: 12 });
  }

  if (/\bwebsite visitors?\b|\bsite visitors?\b/.test(lower)) {
    return executeListRecords(admin, { action: "list_records", entity: "website_visitors", limit: 12 });
  }

  if (/\bpublic chat threads?\b|\bpublic threads?\b/.test(lower)) {
    return executeListRecords(admin, { action: "list_records", entity: "public_threads", limit: 12 });
  }

  if (/\bpublic chat messages?\b|\bpublic messages?\b/.test(lower)) {
    return executeListRecords(admin, { action: "list_records", entity: "public_messages", limit: 12 });
  }

  if (/\bcrm leads?\b|\bwebsite leads?\b/.test(lower)) {
    return executeListRecords(admin, { action: "list_records", entity: "crm_leads", limit: 12 });
  }

  if (/\bcrm follow[- ]?ups?\b|\bfollow[- ]?ups?\b/.test(lower)) {
    return executeListRecords(admin, { action: "list_records", entity: "crm_followups", limit: 12 });
  }

  if (/\bcustomer payment alerts?\b|\bpayment alerts?\b|\bpayment notifications?\b/.test(lower)) {
    return executeListRecords(admin, { action: "list_records", entity: "payment_alerts", limit: 12 });
  }

  if (/\badmin digests?\b|\bowner digest\b/.test(lower)) {
    return executeListRecords(admin, { action: "list_records", entity: "admin_digests", limit: 12 });
  }

  if (/\bzoho customers?\b/.test(lower)) {
    return executeListRecords(admin, { action: "list_records", entity: "zoho_customers", limit: 12 });
  }

  if (/\bzoho payments?\b/.test(lower)) {
    return executeListRecords(admin, { action: "list_records", entity: "zoho_payments", limit: 12 });
  }

  return "";
}

type AdminLineageWorkspaceSnapshot = Awaited<ReturnType<typeof loadAdminLineageWorkspace>>;

function findMatchingBreedingDog(
  workspace: AdminLineageWorkspaceSnapshot,
  rawName: string | null | undefined,
  preferredRole?: "dam" | "sire"
) {
  const target = normalizeSearchLabel(rawName);
  if (!target) return null;

  const dogs = preferredRole
    ? workspace.dogs.filter((dog) => normalizeSearchLabel(dog.role) === preferredRole)
    : workspace.dogs;
  const exact = dogs.find((dog) =>
    [
      dog.displayName,
      dog.dog_name,
      dog.name,
      dog.call_name,
      dog.registered_name,
    ].some((value) => normalizeSearchLabel(value) === target)
  );
  if (exact) return exact;

  const partialMatches = dogs.filter((dog) =>
    [
      dog.displayName,
      dog.dog_name,
      dog.name,
      dog.call_name,
      dog.registered_name,
    ].some((value) => normalizeSearchLabel(value).includes(target) || target.includes(normalizeSearchLabel(value)))
  );

  return partialMatches.length === 1 ? partialMatches[0] : null;
}

function composePlannedLitterNotes(
  draft: PlannedLitterDraft,
  resolvedDamName: string | null,
  resolvedSireName: string | null
) {
  const lines = [
    draft.notes || null,
    draft.registry ? `Registry: ${draft.registry}` : null,
    draft.timing_note ? `Timing note: ${draft.timing_note}` : null,
    draft.dam_name && !resolvedDamName ? `Breeding dog mentioned: ${draft.dam_name}` : null,
    draft.sire_name && !resolvedSireName ? `Breeding dog mentioned: ${draft.sire_name}` : null,
  ]
    .filter(Boolean)
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return lines.length ? Array.from(new Set(lines)).join("\n") : null;
}

async function executeAddLitters(
  admin: SupabaseClient,
  intent: Extract<ActionIntent, { action: "add_litters" }>
) {
  const drafts = (intent.litters || []).filter(Boolean);
  if (!drafts.length) {
    throw new Error("I still need the planned litter details to save.");
  }

  const workspace = await loadAdminLineageWorkspace(admin);
  const existingCodes = new Set(
    workspace.litters.map((litter) => normalizeSearchLabel(litter.litter_code || litter.litter_name || ""))
  );

  const created: string[] = [];
  const skipped: string[] = [];

  for (let index = 0; index < drafts.length; index += 1) {
    const draft = drafts[index];
    const matchedPrimaryDog = findMatchingBreedingDog(workspace, draft.dam_name || draft.sire_name);
    const matchedDam =
      findMatchingBreedingDog(workspace, draft.dam_name, "dam") ||
      (matchedPrimaryDog && normalizeSearchLabel(matchedPrimaryDog.role) !== "sire" ? matchedPrimaryDog : null);
    const matchedSire =
      findMatchingBreedingDog(workspace, draft.sire_name, "sire") ||
      (matchedPrimaryDog && normalizeSearchLabel(matchedPrimaryDog.role) === "sire" ? matchedPrimaryDog : null);

    const litterName = draft.litter_name || buildPlannedLitterName(draft, index);
    const litterCode = draft.litter_code || buildPlannedLitterCode(draft, index);
    const codeKey = normalizeSearchLabel(litterCode);

    if (existingCodes.has(codeKey)) {
      skipped.push(`${litterName} already exists, so I skipped creating it again.`);
      continue;
    }

    const payload = {
      litter_code: litterCode,
      litter_name: litterName,
      dam_id: matchedDam?.id || null,
      sire_id: matchedSire?.id || null,
      whelp_date: draft.whelp_date || null,
      status: draft.status || "planned",
      notes: composePlannedLitterNotes(
        draft,
        matchedDam?.displayName || matchedDam?.dog_name || matchedDam?.call_name || null,
        matchedSire?.displayName || matchedSire?.dog_name || matchedSire?.call_name || null
      ),
    };

    const { data, error } = await admin
      .from("litters")
      .insert(payload)
      .select("id,litter_name,litter_code,whelp_date,status")
      .single();

    if (error) {
      throw new Error(`Could not save planned litter "${litterName}": ${error.message}`);
    }

    existingCodes.add(codeKey);
    created.push(
      [
        data?.litter_name || data?.litter_code || litterName,
        payload.whelp_date ? `whelp date ${payload.whelp_date}` : draft.timing_note || "planned date noted in notes",
        payload.status || "planned",
        matchedDam ? `dam ${matchedDam.displayName || matchedDam.dog_name || matchedDam.call_name}` : null,
        matchedSire ? `sire ${matchedSire.displayName || matchedSire.dog_name || matchedSire.call_name}` : null,
      ]
        .filter(Boolean)
        .join(" - ")
    );
  }

  if (!created.length && skipped.length) {
    return `Core action skipped. ${skipped.join(" ")}`;
  }

  return [
    `Core action completed. I saved ${created.length} planned litter${created.length === 1 ? "" : "s"}.`,
    "",
    ...created.map((line, index) => `${index + 1}. ${line}`),
    ...(skipped.length ? ["", ...skipped.map((line, index) => `Skipped ${index + 1}: ${line}`)] : []),
  ].join("\n");
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

    const { user } = await verifyUser(req, body);
    if (!user) {
      return jsonError("Please sign in to use ChiChi with your account.", 401);
    }

    const admin = createServiceSupabase();
    const savedMessages = await loadSavedConversation(admin, user.id, body.threadId);
    const messages = mergeConversationHistory(savedMessages, inputMessages);
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

    const summaryBase = buildContextSummary({
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
    const breedingGeneticsContext = await loadBreedingGeneticsPromptContext(admin);
    const summary = canWriteCore
      ? {
          ...summaryBase,
          breeding_genetics_context: breedingGeneticsContext || null,
          admin_capabilities: {
            live_entities: [
              "buyers",
              "litters",
              "puppies",
              "payments",
              "puppy_financing",
              "applications",
              "documents",
              "forms",
              "messages",
              "events",
              "weights",
              "health",
              "pickup_requests",
              "website_activity",
              "website_visitors",
              "public_threads",
              "public_messages",
              "crm_leads",
              "crm_followups",
              "admin_digests",
              "payment_alerts",
              "zoho_customers",
              "zoho_payments",
            ],
            zoho_payments_configured: await isZohoPaymentsConfigured(),
          },
        }
      : {
          ...summaryBase,
          breeding_genetics_context: breedingGeneticsContext || null,
        };
    const adminAuth: AdminAuthContext = {
      userId: user.id,
      email: user.email || null,
      canWriteCore,
    };
    const memoryRecords = await loadChiChiMemories(admin, {
      scope: "portal",
      userId: user.id,
      buyerId: buyer?.id ?? null,
      puppyId: puppy?.id ?? null,
      limit: canWriteCore ? 18 : 12,
    });
    const memoryContext = formatChiChiMemories(memoryRecords);
    const memoryCommand = canWriteCore ? extractAdminMemoryCommand(lastUserMessage) : null;
    const recentUserMessages = messages
      .filter((message) => message.role === "user")
      .slice(-6)
      .map((message) => message.content);
    const portalPaymentRequest = !canWriteCore ? extractPortalPaymentRequest(lastUserMessage) : null;

    let text = "";
    let intent: ActionIntent = { action: "answer_only" };

    if (memoryCommand) {
      if (memoryCommand.action === "list") {
        const globalMemories = await loadChiChiMemories(admin, {
          scope: "global",
          limit: 20,
        });
        text = globalMemories.length
          ? `Here are the saved ChiChi memories I have right now:\n\n${formatChiChiMemories(globalMemories)}`
          : "I do not have any saved ChiChi memories yet.";
      } else if (memoryCommand.action === "delete") {
        const deleted = await deactivateChiChiMemory(admin, {
          scope: memoryCommand.scope,
          query: memoryCommand.query,
        });
        text = deleted
          ? `I removed ${deleted} ChiChi memor${deleted === 1 ? "y" : "ies"} matching "${memoryCommand.query}".`
          : `I could not find an active ChiChi memory matching "${memoryCommand.query}".`;
      } else if (memoryCommand.action === "save") {
        const content = String(memoryCommand.content || "").trim();
        const subject = memoryCommand.subject || inferGlobalMemorySubject(content);
        const memoryKind = inferGlobalMemoryKind(content);
        const savedMemory = await upsertChiChiMemory(admin, {
          scope: memoryCommand.scope,
          kind: memoryKind,
          key: buildMemoryKey(memoryCommand.scope, `${subject} ${content}`),
          subject,
          content,
          summary: summarizeMemoryText(content, 120),
          userId: user.id,
          importance: memoryKind === "business" ? 9 : 7,
          sourceRoute: "/api/buildlio",
          meta: {
            saved_by: user.email || user.id,
            source: "admin_chat",
          },
        });

        text = savedMemory
          ? `Saved to ChiChi memory under "${subject}". I will carry that forward in future portal and website replies.`
          : "I could not save that ChiChi memory right now.";
      }
    }

    if (!text && portalPaymentRequest) {
      text = await executePortalUserPaymentLink(req, admin, user, portalPaymentRequest);
    }

    if (!text && canWriteCore) {
      text = await executeAdminOperationalIntelligence(admin, lastUserMessage);
    }

    if (!text && !memoryCommand) {
      intent = await extractActionIntent(lastUserMessage, recentUserMessages);
    }

    if (!text && intent.action !== "answer_only") {
      if (!canWriteCore) {
        text =
          "You’re signed in, but Core write actions are limited to authorized admin accounts. I can still answer questions about the account and portal.";
      } else {
        const missing = missingFieldsForAction(intent);
        if (missing.length) {
          text = `I can do that, but I still need: ${missing.join(", ")}.`;
        } else if (intent.action === "list_records") {
          text = await executeListRecords(admin, intent);
        } else if (intent.action === "add_litters") {
          text = await executeAddLitters(admin, intent);
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
        } else if (intent.action === "create_zoho_payment_link") {
          text = await executeCreateZohoPaymentLink(req, admin, intent);
        }
      }
    }

    if (!text) {
      const system = buildSystemPrompt(summary, {
        isAdmin: canWriteCore,
        canWriteCore,
        memories: memoryContext,
      });

      if (!process.env.ANTHROPIC_API_KEY) {
        text = await localAdminFallback(admin, lastUserMessage);
        if (!text) {
          text = "I can still run direct admin actions and listings right now, but the model-backed response layer is unavailable.";
        }
      } else {
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
          text = await localAdminFallback(admin, lastUserMessage);
          if (!text) {
            return jsonError("ChiChi had trouble generating a response right now.", 502);
          }
        } else {
          const anthropicData = await anthropicResponse.json();
          text = anthropicData?.content?.[0]?.text?.trim();

          if (!text) {
            text = await localAdminFallback(admin, lastUserMessage);
            if (!text) {
              return jsonError("ChiChi could not generate a response.", 502);
            }
          }
        }
      }
    }

    const portalPreferenceMemory = !canWriteCore
      ? extractPortalPreferenceMemory(lastUserMessage)
      : null;

    if (portalPreferenceMemory) {
      await upsertChiChiMemory(admin, {
        scope: "portal",
        kind: "preference",
        key: buildMemoryKey("portal-preference", portalPreferenceMemory),
        subject: "Buyer preference",
        content: portalPreferenceMemory,
        summary: summarizeMemoryText(portalPreferenceMemory, 120),
        userId: user.id,
        buyerId: buyer?.id ?? null,
        puppyId: puppy?.id ?? null,
        importance: 7,
        sourceRoute: "/api/buildlio",
        meta: {
          source: "portal_chat",
        },
      });
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
