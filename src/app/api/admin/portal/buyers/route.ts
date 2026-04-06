import { NextResponse } from "next/server";
import {
  createServiceSupabase,
  describeRouteError,
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

type PuppyRow = {
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
  status?: string | null;
  price?: number | null;
  list_price?: number | null;
  deposit?: number | null;
  balance?: number | null;
  created_at?: string | null;
};

type LitterRow = {
  id: number;
  litter_code?: string | null;
  litter_name?: string | null;
  dam_id?: string | null;
  sire_id?: string | null;
};

type BreedingDogRow = {
  id: string;
  dog_name?: string | null;
  name?: string | null;
  call_name?: string | null;
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

async function syncBuyerPuppyAssignments(
  service: ReturnType<typeof createServiceSupabase>,
  buyerId: number,
  linkedPuppyIds: number[]
) {
  const uniqueIds = Array.from(new Set(linkedPuppyIds.filter((id) => Number.isFinite(id) && id > 0)));

  const { data: existingRows, error: existingError } = await service
    .from("puppies")
    .select("id,buyer_id")
    .eq("buyer_id", buyerId);

  if (existingError) throw existingError;

  const existingIds = (existingRows || []).map((row) => Number(row.id || 0)).filter(Boolean);
  const toUnlink = existingIds.filter((id) => !uniqueIds.includes(id));
  const toLink = uniqueIds;

  if (toUnlink.length) {
    const { error } = await service
      .from("puppies")
      .update({ buyer_id: null })
      .in("id", toUnlink);
    if (error) throw error;
  }

  if (toLink.length) {
    const { error } = await service
      .from("puppies")
      .update({ buyer_id: buyerId })
      .in("id", toLink);
    if (error) throw error;
  }

  const { error: buyerUpdateError } = await service
    .from("buyers")
    .update({ puppy_id: uniqueIds[0] || null })
    .eq("id", buyerId);

  if (buyerUpdateError) throw buyerUpdateError;
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

    const [buyersRes, applicationsRes, formsRes, puppiesRes, littersRes, dogsRes] =
      await Promise.all([
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
      service
        .from("puppies")
        .select("id,buyer_id,litter_id,litter_name,dam_id,sire_id,call_name,puppy_name,name,sire,dam,status,price,list_price,deposit,balance,created_at")
        .order("created_at", { ascending: false }),
      service
        .from("litters")
        .select("id,litter_code,litter_name,dam_id,sire_id"),
      service
        .from("bp_dogs")
        .select("id,dog_name,name,call_name"),
    ]);

    if (buyersRes.error) throw buyersRes.error;
    if (applicationsRes.error) throw applicationsRes.error;
    if (formsRes.error) throw formsRes.error;
    if (puppiesRes.error) throw puppiesRes.error;
    if (littersRes.error) throw littersRes.error;
    if (dogsRes.error) throw dogsRes.error;

    const buyers = (buyersRes.data || []) as BuyerRow[];
    const applications = (applicationsRes.data || []) as ApplicationRow[];
    const forms = (formsRes.data || []) as FormRow[];
    const puppies = (puppiesRes.data || []) as PuppyRow[];
    const litters = (littersRes.data || []) as LitterRow[];
    const dogs = (dogsRes.data || []) as BreedingDogRow[];

    const litterById = new Map<number, LitterRow>();
    litters.forEach((litter) => litterById.set(Number(litter.id), litter));
    const dogNameById = new Map<string, string>();
    dogs.forEach((dog) => {
      dogNameById.set(
        String(dog.id),
        firstValue(dog.dog_name, dog.name, dog.call_name, `Dog ${String(dog.id).slice(0, 8)}`)
      );
    });

    const resolvedPuppies = puppies.map((puppy) => {
      const litter = litterById.get(Number(puppy.litter_id || 0)) || null;
      const damId = litter?.dam_id || puppy.dam_id || null;
      const sireId = litter?.sire_id || puppy.sire_id || null;
      return {
        ...puppy,
        litter_name:
          firstValue(litter?.litter_name, litter?.litter_code, puppy.litter_name) || null,
        dam_id: damId,
        sire_id: sireId,
        dam: (damId ? dogNameById.get(String(damId)) : null) || puppy.dam || null,
        sire: (sireId ? dogNameById.get(String(sireId)) : null) || puppy.sire || null,
      };
    });

    const puppiesByBuyerId = new Map<number, PuppyRow[]>();
    resolvedPuppies.forEach((puppy) => {
      const buyerId = Number(puppy.buyer_id || 0);
      if (!buyerId) return;
      const group = puppiesByBuyerId.get(buyerId) || [];
      group.push(puppy);
      puppiesByBuyerId.set(buyerId, group);
    });

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

      const linkedPuppies = [...(puppiesByBuyerId.get(buyer.id) || [])];
      const fallbackPuppyId = Number(buyer.puppy_id || 0);
      if (fallbackPuppyId && !linkedPuppies.some((puppy) => puppy.id === fallbackPuppyId)) {
        const fallbackPuppy = resolvedPuppies.find((puppy) => puppy.id === fallbackPuppyId);
        if (fallbackPuppy) linkedPuppies.unshift(fallbackPuppy);
      }

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
        linkedPuppies,
      };
    });

    return NextResponse.json({
      ok: true,
      buyers: records,
      puppies: resolvedPuppies.map((puppy) => ({
        ...puppy,
        buyerName:
          buyers.find((buyer) => buyer.id === puppy.buyer_id)?.full_name ||
          buyers.find((buyer) => buyer.id === puppy.buyer_id)?.name ||
          null,
      })),
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin portal buyers route error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not load buyer records."),
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

    const linkedPuppyIds = Array.isArray(body.linked_puppy_ids)
      ? body.linked_puppy_ids.map((value) => Number(value || 0)).filter((value) => value > 0)
      : [];

    if (linkedPuppyIds.length) {
      await syncBuyerPuppyAssignments(service, data.id, linkedPuppyIds);
    }

    return NextResponse.json({ ok: true, buyerId: data.id, ownerEmail: owner.email || null });
  } catch (error) {
    console.error("Admin portal buyers create error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not create the buyer."),
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

    if (Array.isArray(body.linked_puppy_ids)) {
      const linkedPuppyIds = body.linked_puppy_ids
        .map((value) => Number(value || 0))
        .filter((value) => value > 0);
      await syncBuyerPuppyAssignments(service, buyerId, linkedPuppyIds);
    }

    return NextResponse.json({ ok: true, buyerId, ownerEmail: owner.email || null });
  } catch (error) {
    console.error("Admin portal buyers update error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not update the buyer."),
      },
      { status: 500 }
    );
  }
}
