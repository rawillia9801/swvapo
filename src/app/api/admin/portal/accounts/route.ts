import { NextResponse } from "next/server";
import {
  createServiceSupabase,
  firstValue,
  listAllAuthUsers,
  normalizeEmail,
  verifyOwner,
} from "@/lib/admin-api";

type BuyerRow = {
  id: number;
  user_id?: string | null;
  puppy_id?: number | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  notes?: string | null;
  sale_price?: number | null;
  deposit_amount?: number | null;
  finance_enabled?: boolean | null;
  finance_monthly_amount?: number | null;
  finance_next_due_date?: string | null;
  finance_last_payment_date?: string | null;
  created_at?: string | null;
};

type ApplicationRow = {
  id: number;
  user_id?: string | null;
  created_at: string;
  full_name?: string | null;
  email?: string | null;
  applicant_email?: string | null;
  phone?: string | null;
  status?: string | null;
  admin_notes?: string | null;
  assigned_puppy_id?: number | null;
};

type FormRow = {
  id: number;
  user_id?: string | null;
  created_at: string;
  user_email?: string | null;
  email?: string | null;
  form_key: string;
  form_title?: string | null;
  version?: string | null;
  status: string;
  signed_name?: string | null;
  signed_date?: string | null;
  signed_at?: string | null;
  submitted_at?: string | null;
  updated_at?: string | null;
  attachments?: Record<string, unknown> | unknown[] | null;
  data?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
};

type AccountRow = {
  key: string;
  email: string;
  userId: string | null;
  displayName: string;
  phone: string;
  createdAt: string | null;
  updatedAt: string | null;
  lastSignInAt: string | null;
  confirmedAt: string | null;
  emailConfirmedAt: string | null;
  phoneConfirmedAt: string | null;
  confirmationSentAt: string | null;
  recoverySentAt: string | null;
  emailChangeSentAt: string | null;
  pendingEmail: string | null;
  bannedUntil: string | null;
  audience: string | null;
  role: string | null;
  isAnonymous: boolean;
  userMetadata: Record<string, unknown> | null;
  appMetadata: Record<string, unknown> | null;
  identities: Array<Record<string, unknown>> | null;
  factors: Array<Record<string, unknown>> | null;
  buyer: BuyerRow | null;
  application: ApplicationRow | null;
  forms: FormRow[];
  documents: Array<{
    id: string;
    title?: string | null;
    description?: string | null;
    category?: string | null;
    status?: string | null;
    created_at?: string | null;
    source_table?: string | null;
    file_name?: string | null;
    file_url?: string | null;
    signed_at?: string | null;
  }>;
  messages: Array<{
    id: string;
    user_id: string | null;
    user_email: string | null;
    subject: string | null;
    message: string;
    status: string | null;
    sender: "user" | "admin";
    created_at: string;
    read_by_admin: boolean;
    read_by_user: boolean;
  }>;
  pickupRequests: Array<{
    id: number;
    created_at?: string | null;
    request_date?: string | null;
    request_type?: string | null;
    location_text?: string | null;
    address_text?: string | null;
    notes?: string | null;
    status?: string | null;
    miles?: number | null;
  }>;
  linkedPuppies: Array<{
    id: number;
    call_name?: string | null;
    puppy_name?: string | null;
    name?: string | null;
    litter_name?: string | null;
    status?: string | null;
    price?: number | null;
    deposit?: number | null;
  }>;
  paymentSummary: {
    count: number;
    totalPaid: number;
    lastPaymentAt: string | null;
  } | null;
};

type DocumentRow = {
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
  signed_at?: string | null;
};

type MessageRow = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  subject: string | null;
  message: string | null;
  status: string | null;
  sender: string | null;
  created_at: string;
  read_by_admin: boolean | null;
  read_by_user: boolean | null;
};

type PickupRequestRow = {
  id: number;
  user_id?: string | null;
  created_at?: string | null;
  request_date?: string | null;
  request_type?: string | null;
  location_text?: string | null;
  address_text?: string | null;
  notes?: string | null;
  status?: string | null;
  miles?: number | null;
};

type PuppyRow = {
  id: number;
  buyer_id?: number | null;
  call_name?: string | null;
  puppy_name?: string | null;
  name?: string | null;
  litter_name?: string | null;
  status?: string | null;
  price?: number | null;
  deposit?: number | null;
};

type PaymentRow = {
  id: string;
  buyer_id?: number | null;
  created_at?: string | null;
  payment_date?: string | null;
  amount?: number | null;
  status?: string | null;
};

function paymentCountsTowardBalance(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return true;
  return !["failed", "void", "cancelled", "canceled"].includes(normalized);
}

export async function GET(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const service = createServiceSupabase();
    const authUsers = await listAllAuthUsers();

    const [buyersRes, applicationsRes, formsRes] = await Promise.all([
      service.from("buyers").select("id,user_id,puppy_id,full_name,name,email,phone,status,notes,sale_price,deposit_amount,finance_enabled,finance_monthly_amount,finance_next_due_date,finance_last_payment_date,created_at"),
      service.from("puppy_applications").select("id,user_id,created_at,full_name,email,applicant_email,phone,status,admin_notes,assigned_puppy_id"),
      service.from("portal_form_submissions").select("id,user_id,created_at,updated_at,user_email,email,form_key,form_title,version,status,signed_name,signed_date,signed_at,submitted_at,attachments,data,payload"),
    ]);

    const [documentsRes, messagesRes, pickupRes, puppiesRes, paymentsRes] = await Promise.all([
      service.from("portal_documents").select("id,user_id,buyer_id,title,description,category,status,created_at,source_table,file_name,file_url,signed_at"),
      service.from("portal_messages").select("id,user_id,user_email,subject,message,status,sender,created_at,read_by_admin,read_by_user"),
      service.from("portal_pickup_requests").select("id,user_id,created_at,request_date,request_type,location_text,address_text,notes,status,miles"),
      service.from("puppies").select("id,buyer_id,call_name,puppy_name,name,litter_name,status,price,deposit"),
      service.from("buyer_payments").select("id,buyer_id,created_at,payment_date,amount,status"),
    ]);

    const buyers = (buyersRes.data || []) as BuyerRow[];
    const applications = (applicationsRes.data || []) as ApplicationRow[];
    const forms = (formsRes.data || []) as FormRow[];
    const documents = (documentsRes.data || []) as DocumentRow[];
    const messages = (messagesRes.data || []) as MessageRow[];
    const pickupRequests = (pickupRes.data || []) as PickupRequestRow[];
    const puppies = (puppiesRes.data || []) as PuppyRow[];
    const payments = (paymentsRes.data || []) as PaymentRow[];

    const puppiesByBuyerId = new Map<number, PuppyRow[]>();
    puppies.forEach((puppy) => {
      const buyerId = Number(puppy.buyer_id || 0);
      if (!buyerId) return;
      const rows = puppiesByBuyerId.get(buyerId) || [];
      rows.push(puppy);
      puppiesByBuyerId.set(buyerId, rows);
    });

    const paymentsByBuyerId = new Map<number, PaymentRow[]>();
    payments.forEach((payment) => {
      const buyerId = Number(payment.buyer_id || 0);
      if (!buyerId) return;
      const rows = paymentsByBuyerId.get(buyerId) || [];
      rows.push(payment);
      paymentsByBuyerId.set(buyerId, rows);
    });

    const accounts: AccountRow[] = authUsers.map((authUser) => {
      const email = normalizeEmail(authUser.email);
      const matchingBuyer =
        buyers.find((buyer) => buyer.user_id === authUser.id) ||
        buyers.find((buyer) => normalizeEmail(buyer.email) === email) ||
        null;
      const matchingApplication =
        applications.find((application) => application.user_id === authUser.id) ||
        applications.find(
          (application) =>
            normalizeEmail(firstValue(application.email, application.applicant_email)) === email
        ) ||
        null;
      const matchingForms = forms.filter(
        (form) => form.user_id === authUser.id || normalizeEmail(form.user_email) === email
      );
      const matchingDocuments = documents.filter(
        (document) =>
          document.user_id === authUser.id ||
          (!!matchingBuyer?.id && Number(document.buyer_id || 0) === matchingBuyer.id)
      );
      const matchingMessages = messages.filter(
        (message) => message.user_id === authUser.id || normalizeEmail(message.user_email) === email
      );
      const matchingPickupRequests = pickupRequests.filter(
        (pickupRequest) => pickupRequest.user_id === authUser.id
      );
      const linkedPuppies = matchingBuyer?.id
        ? [
            ...(puppiesByBuyerId.get(matchingBuyer.id) || []),
            ...(matchingBuyer.puppy_id
              ? puppies.filter((puppy) => puppy.id === Number(matchingBuyer.puppy_id))
              : []),
          ].filter(
            (puppy, index, rows) =>
              rows.findIndex((candidate) => candidate.id === puppy.id) === index
          )
        : matchingApplication?.assigned_puppy_id
          ? puppies.filter((puppy) => puppy.id === Number(matchingApplication.assigned_puppy_id))
          : [];
      const matchingPayments =
        matchingBuyer?.id ? paymentsByBuyerId.get(matchingBuyer.id) || [] : [];
      const totalPaid = matchingPayments
        .filter((payment) => paymentCountsTowardBalance(payment.status))
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const lastPaymentAt = matchingPayments
        .slice()
        .sort((left, right) => {
          const leftTime = new Date(left.payment_date || left.created_at || 0).getTime();
          const rightTime = new Date(right.payment_date || right.created_at || 0).getTime();
          return rightTime - leftTime;
        })[0];

      const metadata = authUser.user_metadata || {};
      const displayName = firstValue(
        String(metadata.display_name || ""),
        String(metadata.full_name || ""),
        String(metadata.name || ""),
        matchingBuyer?.full_name,
        matchingBuyer?.name,
        matchingApplication?.full_name,
        email,
        `Portal User ${authUser.id.slice(0, 8)}`
      );

      return {
        key: email || authUser.id,
        email,
        userId: authUser.id,
        displayName,
        phone: firstValue(authUser.phone, matchingBuyer?.phone, matchingApplication?.phone),
        createdAt: authUser.created_at || null,
        updatedAt: authUser.updated_at || null,
        lastSignInAt: authUser.last_sign_in_at || null,
        confirmedAt: authUser.confirmed_at || null,
        emailConfirmedAt: authUser.email_confirmed_at || null,
        phoneConfirmedAt: authUser.phone_confirmed_at || null,
        confirmationSentAt: authUser.confirmation_sent_at || null,
        recoverySentAt: authUser.recovery_sent_at || null,
        emailChangeSentAt: authUser.email_change_sent_at || null,
        pendingEmail: authUser.new_email || null,
        bannedUntil: authUser.banned_until || null,
        audience: authUser.aud || null,
        role: authUser.role || null,
        isAnonymous: Boolean(authUser.is_anonymous),
        userMetadata: authUser.user_metadata || null,
        appMetadata: authUser.app_metadata || null,
        identities: authUser.identities || null,
        factors: authUser.factors || null,
        buyer: matchingBuyer,
        application: matchingApplication,
        forms: matchingForms,
        documents: matchingDocuments,
        messages: matchingMessages.map((message) => ({
          id: message.id,
          user_id: message.user_id || null,
          user_email: message.user_email || null,
          subject: message.subject || null,
          message: message.message || "",
          status: message.status || null,
          sender: message.sender === "admin" ? "admin" : "user",
          created_at: message.created_at,
          read_by_admin: Boolean(message.read_by_admin),
          read_by_user: Boolean(message.read_by_user),
        })),
        pickupRequests: matchingPickupRequests,
        linkedPuppies,
        paymentSummary: matchingBuyer
          ? {
              count: matchingPayments.length,
              totalPaid,
              lastPaymentAt: lastPaymentAt?.payment_date || lastPaymentAt?.created_at || null,
            }
          : null,
      };
    });

    accounts.sort((a, b) => {
      const aDate = new Date(a.createdAt || 0).getTime();
      const bDate = new Date(b.createdAt || 0).getTime();
      return bDate - aDate;
    });

    return NextResponse.json({
      ok: true,
      userCount: accounts.length,
      accounts,
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin portal accounts route error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
