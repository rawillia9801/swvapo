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
  city?: string | null;
  state?: string | null;
  created_at?: string | null;
};

type ApplicationRow = {
  id: number;
  user_id?: string | null;
  email?: string | null;
  applicant_email?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type FormRow = {
  id: number;
  user_id?: string | null;
  user_email?: string | null;
  status?: string | null;
  created_at?: string | null;
};

function asBuyerPayload(body: Record<string, unknown>) {
  return {
    full_name: firstValue(body.full_name as string | null, body.name as string | null) || null,
    name: firstValue(body.full_name as string | null, body.name as string | null) || null,
    email: firstValue(body.email as string | null) || null,
    phone: firstValue(body.phone as string | null) || null,
    status: firstValue(body.status as string | null, "pending"),
    notes: firstValue(body.notes as string | null) || null,
    city: firstValue(body.city as string | null) || null,
    state: firstValue(body.state as string | null) || null,
  };
}

export async function GET(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const service = createServiceSupabase();
    const authUsers = await listAllAuthUsers();
    const authByEmail = new Map(
      authUsers
        .map((authUser) => [normalizeEmail(authUser.email), authUser] as const)
        .filter(([email]) => !!email)
    );

    const [buyersRes, applicationsRes, formsRes] = await Promise.all([
      service
        .from("buyers")
        .select("id,user_id,puppy_id,full_name,name,email,phone,status,notes,city,state,created_at")
        .order("created_at", { ascending: false }),
      service
        .from("puppy_applications")
        .select("id,user_id,email,applicant_email,status,created_at")
        .order("created_at", { ascending: false }),
      service
        .from("portal_form_submissions")
        .select("id,user_id,user_email,status,created_at")
        .order("created_at", { ascending: false }),
    ]);

    if (buyersRes.error) throw buyersRes.error;
    if (applicationsRes.error) throw applicationsRes.error;
    if (formsRes.error) throw formsRes.error;

    const buyers = (buyersRes.data || []) as BuyerRow[];
    const applications = (applicationsRes.data || []) as ApplicationRow[];
    const forms = (formsRes.data || []) as FormRow[];

    const records = buyers.map((buyer) => {
      const email = normalizeEmail(buyer.email);
      const authUser =
        (buyer.user_id ? authUsers.find((candidate) => candidate.id === buyer.user_id) : null) ||
        (email ? authByEmail.get(email) : null) ||
        null;

      const matchingApplications = applications.filter(
        (application) =>
          (buyer.user_id && application.user_id === buyer.user_id) ||
          (!!email && normalizeEmail(firstValue(application.email, application.applicant_email)) === email)
      );

      const matchingForms = forms.filter(
        (form) =>
          (buyer.user_id && form.user_id === buyer.user_id) ||
          (!!email && normalizeEmail(form.user_email) === email)
      );

      return {
        key: String(buyer.id),
        buyer,
        displayName: firstValue(buyer.full_name, buyer.name, buyer.email, `Buyer #${buyer.id}`),
        email: firstValue(buyer.email),
        phone: firstValue(buyer.phone),
        hasPortalAccount: !!authUser,
        portalUser: authUser
          ? {
              id: authUser.id,
              email: authUser.email || "",
              created_at: authUser.created_at || null,
              last_sign_in_at: authUser.last_sign_in_at || null,
            }
          : null,
        applicationCount: matchingApplications.length,
        latestApplicationStatus: matchingApplications[0]?.status || null,
        formCount: matchingForms.length,
      };
    });

    return NextResponse.json({
      ok: true,
      buyers: records,
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin portal buyers route error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const payload = asBuyerPayload(body);

    if (!payload.full_name && !payload.email) {
      return NextResponse.json(
        { ok: false, error: "A buyer name or email is required." },
        { status: 400 }
      );
    }

    const service = createServiceSupabase();
    const { data, error } = await service.from("buyers").insert(payload).select("id").single();
    if (error) throw error;

    return NextResponse.json({ ok: true, buyerId: data.id, ownerEmail: owner.email || null });
  } catch (error) {
    console.error("Admin portal buyers create error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const buyerId = Number(body.id || 0);
    if (!buyerId) {
      return NextResponse.json({ ok: false, error: "A buyer id is required." }, { status: 400 });
    }

    const service = createServiceSupabase();
    const { error } = await service.from("buyers").update(asBuyerPayload(body)).eq("id", buyerId);
    if (error) throw error;

    return NextResponse.json({ ok: true, buyerId, ownerEmail: owner.email || null });
  } catch (error) {
    console.error("Admin portal buyers update error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
