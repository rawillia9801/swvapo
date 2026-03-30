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
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
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

export async function GET(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const service = createServiceSupabase();
    const authUsers = await listAllAuthUsers();

    const [buyersRes, applicationsRes, formsRes] = await Promise.all([
      service.from("buyers").select("id,user_id,full_name,name,email,phone,status,notes,created_at"),
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
