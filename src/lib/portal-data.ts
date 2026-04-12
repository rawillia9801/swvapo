import type { User } from "@supabase/supabase-js";
import { sb } from "@/lib/utils";

export type PortalBuyer = {
  id: number;
  user_id?: string | null;
  puppy_id?: number | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  status?: string | null;
  notes?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  sale_price?: number | null;
  deposit_amount?: number | null;
  deposit_date?: string | null;
  finance_enabled?: boolean | null;
  finance_admin_fee?: boolean | null;
  finance_rate?: number | null;
  finance_months?: number | null;
  finance_monthly_amount?: number | null;
  finance_day_of_month?: number | null;
  finance_next_due_date?: string | null;
  finance_last_payment_date?: string | null;
  delivery_option?: string | null;
  delivery_date?: string | null;
  delivery_location?: string | null;
  delivery_fee?: number | null;
  portal_profile_photo_url?: string | null;
  portal_profile_photo_path?: string | null;
  created_at?: string | null;
};

export type PortalApplication = {
  id: number;
  user_id?: string | null;
  full_name?: string | null;
  email?: string | null;
  applicant_email?: string | null;
  phone?: string | null;
  street_address?: string | null;
  city_state?: string | null;
  zip?: string | null;
  status?: string | null;
  application?: Record<string, unknown> | null;
  created_at?: string | null;
  assigned_puppy_id?: number | null;
};

export type PortalPuppy = {
  id: number;
  buyer_id?: number | null;
  litter_id?: number | null;
  litter_name?: string | null;
  dam_id?: string | null;
  sire_id?: string | null;
  call_name?: string | null;
  puppy_name?: string | null;
  name?: string | null;
  sire?: string | null;
  dam?: string | null;
  sex?: string | null;
  color?: string | null;
  coat_type?: string | null;
  coat?: string | null;
  pattern?: string | null;
  dob?: string | null;
  registry?: string | null;
  price?: number | null;
  list_price?: number | null;
  deposit?: number | null;
  balance?: number | null;
  status?: string | null;
  w_1?: number | null;
  w_2?: number | null;
  w_3?: number | null;
  w_4?: number | null;
  w_5?: number | null;
  w_6?: number | null;
  w_7?: number | null;
  w_8?: number | null;
  birth_weight?: number | null;
  current_weight?: number | null;
  weight_unit?: string | null;
  weight_date?: string | null;
  image_url?: string | null;
  photo_url?: string | null;
  owner_email?: string | null;
  description?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

export type PortalMessage = {
  id: string;
  created_at: string;
  user_id?: string | null;
  user_email?: string | null;
  subject?: string | null;
  message?: string | null;
  status?: string | null;
  read_by_admin?: boolean | null;
  read_by_user?: boolean | null;
  sender?: "user" | "admin" | null;
};

export type PortalFormSubmission = {
  id: number;
  user_id?: string | null;
  user_email?: string | null;
  email?: string | null;
  form_key: string;
  form_title?: string | null;
  version?: string | null;
  signed_name?: string | null;
  signed_date?: string | null;
  signed_at?: string | null;
  data?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
  status: string;
  submitted_at?: string | null;
  attachments?: Record<string, unknown> | unknown[] | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PortalDocument = {
  id: string;
  user_id?: string | null;
  buyer_id?: number | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  status?: string | null;
  created_at?: string | null;
  source_table?: string | null;
  file_name?: string | null;
  file_url?: string | null;
  visible_to_user?: boolean | null;
  signed_at?: string | null;
};

export type PortalPuppyEvent = {
  id: number;
  puppy_id?: number | null;
  event_date: string;
  event_type?: string | null;
  label?: string | null;
  title?: string | null;
  summary?: string | null;
  details?: string | null;
  auto_generated?: boolean | null;
  photo_url?: string | null;
  photos?: unknown;
};

export type PortalHealthRecord = {
  id: number;
  puppy_id?: number | null;
  record_date: string;
  record_type: string;
  title: string;
  description?: string | null;
  provider_name?: string | null;
  next_due_date?: string | null;
  is_visible_to_buyer?: boolean | null;
};

export type PortalPuppyWeight = {
  id: number;
  puppy_id?: number | null;
  weigh_date: string;
  age_weeks?: number | null;
  weight_oz?: number | null;
  weight_g?: number | null;
  notes?: string | null;
};

export type PortalPayment = {
  id: string;
  created_at: string;
  buyer_id: number;
  puppy_id?: number | null;
  payment_date: string;
  amount: number;
  payment_type?: string | null;
  method?: string | null;
  note?: string | null;
  status?: string | null;
  reference_number?: string | null;
};

export type PortalFeeCreditRecord = {
  id: number;
  created_at: string;
  buyer_id: number;
  puppy_id?: number | null;
  entry_date: string;
  entry_type?: string | null;
  label?: string | null;
  description?: string | null;
  amount: number;
  status?: string | null;
  reference_number?: string | null;
};

export type PortalPickupRequest = {
  id: number;
  created_at?: string | null;
  user_id?: string | null;
  puppy_id?: number | null;
  request_date?: string | null;
  request_type?: string | null;
  location_text?: string | null;
  notes?: string | null;
  status?: string | null;
  address_text?: string | null;
  miles?: number | null;
};

export type PortalContext = {
  buyer: PortalBuyer | null;
  application: PortalApplication | null;
  puppy: PortalPuppy | null;
};

const buyerSelect =
  "id,user_id,puppy_id,full_name,name,email,phone,address_line1,address_line2,status,notes,city,state,postal_code,sale_price,deposit_amount,deposit_date,finance_enabled,finance_admin_fee,finance_rate,finance_months,finance_monthly_amount,finance_day_of_month,finance_next_due_date,finance_last_payment_date,delivery_option,delivery_date,delivery_location,delivery_fee,portal_profile_photo_url,portal_profile_photo_path,created_at";

const applicationSelect =
  "id,user_id,full_name,email,applicant_email,phone,street_address,city_state,zip,status,application,created_at,assigned_puppy_id";

const puppySelect =
  "id,buyer_id,litter_id,litter_name,dam_id,sire_id,call_name,puppy_name,name,sire,dam,sex,color,coat_type,coat,pattern,dob,registry,price,list_price,deposit,balance,status,w_1,w_2,w_3,w_4,w_5,w_6,w_7,w_8,birth_weight,current_weight,weight_unit,weight_date,image_url,photo_url,owner_email,description,notes,created_at";

function normalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function isSupabaseMissingTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.toLowerCase().includes("does not exist");
}

async function safeMaybeSingle<T>(factory: () => Promise<{ data: T | null; error: unknown }>) {
  try {
    const result = await factory();
    if (result.error) return null;
    return result.data || null;
  } catch {
    return null;
  }
}

async function safeList<T>(factory: () => Promise<{ data: T[] | null; error: unknown }>) {
  try {
    const result = await factory();
    if (result.error) return [];
    return result.data || [];
  } catch {
    return [];
  }
}

function dedupeById<T extends { id?: string | number | null }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = String(item.id || "");
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function portalDisplayName(
  user: Pick<User, "email" | "user_metadata"> | null,
  buyer?: Pick<PortalBuyer, "full_name" | "name"> | null,
  application?: Pick<PortalApplication, "full_name"> | null
) {
  return (
    buyer?.full_name ||
    buyer?.name ||
    application?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "Portal Family"
  );
}

export function portalPuppyName(puppy?: Pick<PortalPuppy, "call_name" | "puppy_name" | "name"> | null) {
  return puppy?.call_name || puppy?.puppy_name || puppy?.name || "My Puppy";
}

export function portalStatusTone(statusRaw: string | null | undefined) {
  const status = String(statusRaw || "").trim().toLowerCase();
  if (["approved", "active", "matched", "complete", "completed", "reserved", "paid"].some((item) => status.includes(item))) {
    return "success" as const;
  }
  if (["denied", "declined", "rejected", "cancel", "failed"].some((item) => status.includes(item))) {
    return "danger" as const;
  }
  return "warning" as const;
}

export async function findBuyerForUser(user: User) {
  const email = normalizeEmail(user.email);

  if (user.id) {
    const byUserId = await safeMaybeSingle<PortalBuyer>(() =>
      Promise.resolve(
        sb.from("buyers").select(buyerSelect).eq("user_id", user.id).limit(1).maybeSingle()
      )
    );
    if (byUserId) return byUserId;
  }

  if (!email) return null;

  return safeMaybeSingle<PortalBuyer>(() =>
    Promise.resolve(
      sb.from("buyers").select(buyerSelect).ilike("email", email).limit(1).maybeSingle()
    )
  );
}

export async function findApplicationForUser(user: User) {
  const email = normalizeEmail(user.email);

  if (user.id) {
    const byUserId = await safeMaybeSingle<PortalApplication>(() =>
      Promise.resolve(
        sb
          .from("puppy_applications")
          .select(applicationSelect)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      )
    );
    if (byUserId) return byUserId;
  }

  if (!email) return null;

  const byEmail = await safeMaybeSingle<PortalApplication>(() =>
    Promise.resolve(
      sb
        .from("puppy_applications")
        .select(applicationSelect)
        .ilike("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    )
  );

  if (byEmail) return byEmail;

  return safeMaybeSingle<PortalApplication>(() =>
    Promise.resolve(
      sb
        .from("puppy_applications")
        .select(applicationSelect)
        .ilike("applicant_email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    )
  );
}

export async function findPuppyForUser(user: User, buyer: PortalBuyer | null) {
  if (buyer?.id) {
    const byBuyer = await safeMaybeSingle<PortalPuppy>(() =>
      Promise.resolve(
        sb
          .from("puppies")
          .select(puppySelect)
          .eq("buyer_id", buyer.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      )
    );
    if (byBuyer) return byBuyer;
  }

  const fallbackPuppyId = Number(buyer?.puppy_id || 0);
  if (fallbackPuppyId) {
    const byBuyerPuppyId = await safeMaybeSingle<PortalPuppy>(() =>
      Promise.resolve(
        sb.from("puppies").select(puppySelect).eq("id", fallbackPuppyId).limit(1).maybeSingle()
      )
    );
    if (byBuyerPuppyId) return byBuyerPuppyId;
  }

  const email = normalizeEmail(user.email);
  if (!email) return null;

  return safeMaybeSingle<PortalPuppy>(() =>
    Promise.resolve(
      sb
        .from("puppies")
        .select(puppySelect)
        .ilike("owner_email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    )
  );
}

export async function loadPortalContext(user: User): Promise<PortalContext> {
  const buyer = await findBuyerForUser(user);
  const application = await findApplicationForUser(user);
  const puppy = await findPuppyForUser(user, buyer);
  return { buyer, application, puppy };
}

export async function findPortalMessagesForUser(user: User, limit?: number) {
  const email = normalizeEmail(user.email);
  const order = { ascending: false } as const;

  if (user.id) {
    const byUserId = await safeList<PortalMessage>(() => {
      let query = sb.from("portal_messages").select("*").eq("user_id", user.id).order("created_at", order);
      if (limit) query = query.limit(limit);
      return Promise.resolve(query);
    });
    if (byUserId.length) return byUserId;
  }

  if (!email) return [];

  return safeList<PortalMessage>(() => {
    let query = sb.from("portal_messages").select("*").ilike("user_email", email).order("created_at", order);
    if (limit) query = query.limit(limit);
    return Promise.resolve(query);
  });
}

export async function findPortalDocumentsForUser(user: User, buyer: PortalBuyer | null) {
  const docs: PortalDocument[] = [];

  const pushDocs = async (factory: () => Promise<{ data: PortalDocument[] | null; error: unknown }>) => {
    try {
      const result = await factory();
      if (!result.error && result.data?.length) docs.push(...result.data);
    } catch (error) {
      if (!isSupabaseMissingTableError(error)) return;
    }
  };

  if (user.id) {
    await pushDocs(() =>
      Promise.resolve(
        sb
      .from("portal_documents")
      .select("id,user_id,buyer_id,title,description,category,status,created_at,source_table,file_name,file_url,visible_to_user,signed_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
      )
    );
  }

  if (buyer?.id) {
    await pushDocs(() =>
      Promise.resolve(
        sb
      .from("portal_documents")
      .select("id,user_id,buyer_id,title,description,category,status,created_at,source_table,file_name,file_url,visible_to_user,signed_at")
          .eq("buyer_id", buyer.id)
          .order("created_at", { ascending: false })
      )
    );
  }

  return dedupeById(docs);
}

export async function findFormSubmissionsForUser(user: User) {
  const email = normalizeEmail(user.email);
  const forms: PortalFormSubmission[] = [];

  if (user.id) {
    forms.push(
      ...(
        await safeList<PortalFormSubmission>(() =>
          Promise.resolve(
            sb
              .from("portal_form_submissions")
              .select("id,user_id,user_email,email,form_key,form_title,version,signed_name,signed_date,signed_at,data,payload,status,submitted_at,attachments,created_at,updated_at")
              .eq("user_id", user.id)
              .order("updated_at", { ascending: false })
          )
        )
      )
    );
  }

  if (email) {
    forms.push(
      ...(
        await safeList<PortalFormSubmission>(() =>
          Promise.resolve(
            sb
              .from("portal_form_submissions")
              .select("id,user_id,user_email,email,form_key,form_title,version,signed_name,signed_date,signed_at,data,payload,status,submitted_at,attachments,created_at,updated_at")
              .ilike("user_email", email)
              .order("updated_at", { ascending: false })
          )
        )
      )
    );

    forms.push(
      ...(
        await safeList<PortalFormSubmission>(() =>
          Promise.resolve(
            sb
              .from("portal_form_submissions")
              .select("id,user_id,user_email,email,form_key,form_title,version,signed_name,signed_date,signed_at,data,payload,status,submitted_at,attachments,created_at,updated_at")
              .ilike("email", email)
              .order("updated_at", { ascending: false })
          )
        )
      )
    );
  }

  return dedupeById(forms);
}

export async function findPuppyEvents(puppyId: number | null | undefined) {
  if (!puppyId) return [];

  const events = await safeList<PortalPuppyEvent>(() =>
    Promise.resolve(
      sb
        .from("puppy_events")
        .select("id,puppy_id,event_date,event_type,label,title,summary,details,auto_generated,photo_url,photos")
        .eq("puppy_id", puppyId)
        .eq("is_published", true)
        .eq("is_private", false)
        .order("event_date", { ascending: false })
        .order("sort_order", { ascending: false })
    )
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return events.filter((event) => {
    if (event.auto_generated) return false;
    const eventDate = new Date(event.event_date);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate.getTime() <= today.getTime();
  });
}

export async function findHealthRecords(puppyId: number | null | undefined) {
  if (!puppyId) return [];

  return safeList<PortalHealthRecord>(() =>
    Promise.resolve(
      sb
        .from("puppy_health_records")
        .select("id,puppy_id,record_date,record_type,title,description,provider_name,next_due_date,is_visible_to_buyer")
        .eq("puppy_id", puppyId)
        .eq("is_visible_to_buyer", true)
        .order("record_date", { ascending: false })
    )
  );
}

export async function findPuppyWeights(puppyId: number | null | undefined) {
  if (!puppyId) return [];

  return safeList<PortalPuppyWeight>(() =>
    Promise.resolve(
      sb
        .from("puppy_weights")
        .select("id,puppy_id,weigh_date,age_weeks,weight_oz,weight_g,notes")
        .eq("puppy_id", puppyId)
        .order("weigh_date", { ascending: false })
        .limit(20)
    )
  );
}

export async function findBuyerPayments(buyerId: number | null | undefined) {
  if (!buyerId) return [];

  return safeList<PortalPayment>(() =>
    Promise.resolve(
      sb
        .from("buyer_payments")
        .select("id,created_at,buyer_id,puppy_id,payment_date,amount,payment_type,method,note,status,reference_number")
        .eq("buyer_id", buyerId)
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false })
    )
  );
}

export async function findBuyerFeeCreditRecords(buyerId: number | null | undefined) {
  if (!buyerId) return [];

  return safeList<PortalFeeCreditRecord>(() =>
    Promise.resolve(
      sb
        .from("buyer_fee_credit_records")
        .select(
          "id,created_at,buyer_id,puppy_id,entry_date,entry_type,label,description,amount,status,reference_number"
        )
        .eq("buyer_id", buyerId)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false })
    )
  );
}

export async function findLatestPickupRequestForUser(user: User) {
  if (!user.id) return null;

  return safeMaybeSingle<PortalPickupRequest>(() =>
    Promise.resolve(
      sb
        .from("portal_pickup_requests")
        .select("id,created_at,user_id,puppy_id,request_date,request_type,location_text,notes,status,address_text,miles")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    )
  );
}

export async function findBlockedPickupDatesForMonth(targetMonth: Date) {
  const year = targetMonth.getFullYear();
  const monthIndex = targetMonth.getMonth();
  const start = isoFromParts(year, monthIndex + 1, 1);
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const end = isoFromParts(year, monthIndex + 1, lastDay);

  const rows = await safeList<{ request_date?: string | null }>(() =>
    Promise.resolve(
      sb
        .from("portal_pickup_requests")
        .select("request_date")
        .gte("request_date", start)
        .lte("request_date", end)
        .in("status", ["pending", "approved"])
    )
  );

  const dates = new Set<string>();
  rows.forEach((row) => {
    if (row.request_date) dates.add(row.request_date);
  });
  return dates;
}

export async function isPickupDateAvailable(isoDate: string) {
  const rows = await safeList<{ id?: number | null }>(() =>
    Promise.resolve(
      sb
        .from("portal_pickup_requests")
        .select("id")
        .eq("request_date", isoDate)
        .in("status", ["pending", "approved"])
        .limit(1)
    )
  );

  return rows.length === 0;
}

function isoFromParts(year: number, month1: number, day: number) {
  return `${year}-${String(month1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function countAttachments(raw: PortalFormSubmission["attachments"]) {
  if (!raw) return 0;
  if (Array.isArray(raw)) return raw.length;
  if (typeof raw === "object") return Object.keys(raw).length;
  return 0;
}

export function parseCityState(value: string | null | undefined) {
  if (!value) return { city: "", state: "" };
  const parts = String(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return { city: parts[0], state: parts.slice(1).join(", ") };
  }

  return { city: String(value), state: "" };
}

export function paymentCountsTowardBalance(status: string | null | undefined) {
  const normalized = String(status || "").toLowerCase();
  if (!normalized) return true;
  return !["failed", "void", "canceled", "cancelled"].includes(normalized);
}

export function attachmentPhotoCount(raw: unknown) {
  if (!raw) return 0;
  if (Array.isArray(raw)) return raw.length;
  return 0;
}
