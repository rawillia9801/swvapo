import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isPortalAdminEmail } from "@/lib/portal-admin";

type BuyerRow = {
  id: number;
  user_id?: string | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  buyer_email?: string | null;
  phone?: string | null;
  status?: string | null;
  notes?: string | null;
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
  form_key: string;
  form_title?: string | null;
  status: string;
  signed_name?: string | null;
  submitted_at?: string | null;
};

type AccountRow = {
  key: string;
  email: string;
  userId: string | null;
  displayName: string;
  phone: string;
  createdAt: string | null;
  lastSignInAt: string | null;
  buyer: BuyerRow | null;
  application: ApplicationRow | null;
  forms: FormRow[];
};

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function createAnonSupabase() {
  return createClient(getEnv("NEXT_PUBLIC_SUPABASE_URL"), getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function createServiceSupabase() {
  return createClient(getEnv("NEXT_PUBLIC_SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getBearerToken(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }
  return null;
}

async function verifyOwner(req: Request) {
  const accessToken = getBearerToken(req);
  if (!accessToken) return null;

  const anon = createAnonSupabase();
  const { data, error } = await anon.auth.getUser(accessToken);
  if (error || !data.user || !isPortalAdminEmail(data.user.email)) {
    return null;
  }

  return data.user;
}

function normalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function firstValue(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

async function listAllAuthUsers() {
  const admin = createServiceSupabase();
  const users: Array<{
    id: string;
    email?: string | null;
    phone?: string | null;
    created_at?: string | null;
    last_sign_in_at?: string | null;
    user_metadata?: Record<string, unknown> | null;
  }> = [];

  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);

    const nextUsers = data?.users || [];
    users.push(...nextUsers);

    if (nextUsers.length < perPage) break;
    page += 1;
  }

  return users;
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
      service.from("buyers").select("id,user_id,full_name,name,email,buyer_email,phone,status,notes,created_at"),
      service.from("puppy_applications").select("id,user_id,created_at,full_name,email,applicant_email,phone,status,admin_notes,assigned_puppy_id"),
      service.from("portal_form_submissions").select("id,user_id,created_at,user_email,form_key,form_title,status,signed_name,submitted_at"),
    ]);

    const buyers = (buyersRes.data || []) as BuyerRow[];
    const applications = (applicationsRes.data || []) as ApplicationRow[];
    const forms = (formsRes.data || []) as FormRow[];

    const accounts: AccountRow[] = authUsers.map((authUser) => {
      const email = normalizeEmail(authUser.email);
      const matchingBuyer =
        buyers.find((buyer) => buyer.user_id === authUser.id) ||
        buyers.find((buyer) => normalizeEmail(firstValue(buyer.email, buyer.buyer_email)) === email) ||
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
        lastSignInAt: authUser.last_sign_in_at || null,
        buyer: matchingBuyer,
        application: matchingApplication,
        forms: matchingForms,
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
