import { NextResponse } from "next/server";
import {
  createServiceSupabase,
  describeRouteError,
  firstValue,
  verifyOwner,
} from "@/lib/admin-api";

type BuyerRow = {
  id: number;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  status?: string | null;
};

type BreedingDogRow = {
  id: string;
  role?: string | null;
  dog_name?: string | null;
  name?: string | null;
  display_name?: string | null;
  call_name?: string | null;
  registered_name?: string | null;
  status?: string | null;
};

type LitterRow = {
  id: number;
  litter_code?: string | null;
  litter_name?: string | null;
  dam_id?: string | null;
  sire_id?: string | null;
  whelp_date?: string | null;
  status?: string | null;
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
  birth_weight?: number | null;
  current_weight?: number | null;
  weight_unit?: string | null;
  weight_date?: string | null;
  image_url?: string | null;
  photo_url?: string | null;
  owner_email?: string | null;
  description?: string | null;
  notes?: string | null;
  microchip?: string | null;
  registration_no?: string | null;
  w_1?: number | null;
  w_2?: number | null;
  w_3?: number | null;
  w_4?: number | null;
  w_5?: number | null;
  w_6?: number | null;
  w_7?: number | null;
  w_8?: number | null;
  created_at?: string | null;
};

function toNumberOrNull(value: unknown) {
  const cleaned = String(value ?? "").replace(/[^0-9.-]/g, "").trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIntegerOrNull(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function toUuidOrNull(value: unknown) {
  const text = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}

function toStringOrNull(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeEmail(value: unknown) {
  const text = String(value ?? "").trim().toLowerCase();
  return text || null;
}

async function safeRows<T>(
  query: PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  try {
    const result = await query;
    if (result.error) return [];
    return result.data || [];
  } catch {
    return [];
  }
}

async function refreshBuyerFallbackPuppy(
  service: ReturnType<typeof createServiceSupabase>,
  buyerId: number | null | undefined
) {
  const numericBuyerId = Number(buyerId || 0);
  if (!numericBuyerId) return;

  const { data, error } = await service
    .from("puppies")
    .select("id")
    .eq("buyer_id", numericBuyerId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;

  const fallbackPuppyId = Number(data?.[0]?.id || 0) || null;
  const { error: updateError } = await service
    .from("buyers")
    .update({ puppy_id: fallbackPuppyId })
    .eq("id", numericBuyerId);

  if (updateError) throw updateError;
}

async function getBuyerEmail(
  service: ReturnType<typeof createServiceSupabase>,
  buyerId: number | null
) {
  if (!buyerId) return null;

  const { data, error } = await service
    .from("buyers")
    .select("email")
    .eq("id", buyerId)
    .maybeSingle<{ email?: string | null }>();

  if (error) throw error;
  return normalizeEmail(data?.email);
}

async function getExistingPuppy(
  service: ReturnType<typeof createServiceSupabase>,
  puppyId: number
) {
  const { data, error } = await service
    .from("puppies")
    .select(
      "id,buyer_id,litter_id,litter_name,dam_id,sire_id,call_name,puppy_name,name,sire,dam,sex,color,coat_type,coat,pattern,dob,registry,price,list_price,deposit,balance,status,birth_weight,current_weight,weight_unit,weight_date,image_url,photo_url,owner_email,description,notes,microchip,registration_no,w_1,w_2,w_3,w_4,w_5,w_6,w_7,w_8,created_at"
    )
    .eq("id", puppyId)
    .maybeSingle<PuppyRow>();

  if (error) throw error;
  return data || null;
}

async function resolveLineageFields(
  service: ReturnType<typeof createServiceSupabase>,
  body: Record<string, unknown>,
  existing?: PuppyRow | null
) {
  const litterId = toIntegerOrNull(body.litter_id ?? existing?.litter_id);
  const directDamId = toUuidOrNull(body.dam_id ?? existing?.dam_id);
  const directSireId = toUuidOrNull(body.sire_id ?? existing?.sire_id);
  let litter: LitterRow | null = null;

  if (litterId) {
    const { data, error } = await service
      .from("litters")
      .select("id,litter_code,litter_name,dam_id,sire_id,whelp_date,status")
      .eq("id", litterId)
      .maybeSingle<LitterRow>();

    if (error) throw error;
    litter = data || null;
  }

  const damId = litter?.dam_id ?? directDamId;
  const sireId = litter?.sire_id ?? directSireId;
  const dogIds = [damId, sireId].filter(Boolean) as string[];
  const dogs = dogIds.length
    ? await safeRows<BreedingDogRow>(
        service
          .from("bp_dogs")
          .select("id,role,dog_name,name,call_name,status")
          .in("id", dogIds)
      )
    : [];
  const dogNameMap = new Map(
    dogs.map((dog) => [
      String(dog.id),
      firstValue(dog.dog_name, dog.name, dog.call_name, dog.display_name, dog.registered_name),
    ] as const)
  );

  return {
    litter_id: litterId,
    litter_name:
      toStringOrNull(body.litter_name) ||
      firstValue(litter?.litter_name, litter?.litter_code, existing?.litter_name) ||
      null,
    dam_id: damId,
    sire_id: sireId,
    dam:
      toStringOrNull(body.dam) ||
      (damId ? dogNameMap.get(String(damId)) : null) ||
      existing?.dam ||
      null,
    sire:
      toStringOrNull(body.sire) ||
      (sireId ? dogNameMap.get(String(sireId)) : null) ||
      existing?.sire ||
      null,
  };
}

async function asPuppyPayload(
  service: ReturnType<typeof createServiceSupabase>,
  body: Record<string, unknown>,
  existing?: PuppyRow | null
) {
  const buyerId = toIntegerOrNull(body.buyer_id);
  const buyerEmail = await getBuyerEmail(service, buyerId);
  const ownerEmail =
    normalizeEmail(body.owner_email) ||
    buyerEmail ||
    normalizeEmail(existing?.owner_email) ||
    null;
  const lineage = await resolveLineageFields(service, body, existing);

  return {
    buyer_id: buyerId,
    ...lineage,
    call_name: toStringOrNull(body.call_name),
    puppy_name: toStringOrNull(body.puppy_name),
    name: toStringOrNull(body.name),
    sex: toStringOrNull(body.sex),
    color: toStringOrNull(body.color),
    coat_type: toStringOrNull(body.coat_type),
    coat: toStringOrNull(body.coat),
    pattern: toStringOrNull(body.pattern),
    dob: toStringOrNull(body.dob),
    registry: toStringOrNull(body.registry),
    price: toNumberOrNull(body.price),
    list_price: toNumberOrNull(body.list_price),
    deposit: toNumberOrNull(body.deposit),
    balance: toNumberOrNull(body.balance),
    status: firstValue(body.status as string | null, existing?.status || "available") || "available",
    birth_weight: toNumberOrNull(body.birth_weight),
    current_weight: toNumberOrNull(body.current_weight),
    weight_unit: toStringOrNull(body.weight_unit),
    weight_date: toStringOrNull(body.weight_date),
    image_url: toStringOrNull(body.image_url),
    photo_url: toStringOrNull(body.photo_url),
    owner_email: ownerEmail,
    description: toStringOrNull(body.description),
    notes: toStringOrNull(body.notes),
    microchip: toStringOrNull(body.microchip),
    registration_no: toStringOrNull(body.registration_no),
    w_1: toNumberOrNull(body.w_1),
    w_2: toNumberOrNull(body.w_2),
    w_3: toNumberOrNull(body.w_3),
    w_4: toNumberOrNull(body.w_4),
    w_5: toNumberOrNull(body.w_5),
    w_6: toNumberOrNull(body.w_6),
    w_7: toNumberOrNull(body.w_7),
    w_8: toNumberOrNull(body.w_8),
  };
}

export async function GET(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const service = createServiceSupabase();
    const [buyers, puppies, litters, breedingDogs] = await Promise.all([
      safeRows<BuyerRow>(
        service
          .from("buyers")
          .select("id,full_name,name,email,status")
          .order("created_at", { ascending: false })
      ),
      safeRows<PuppyRow>(
        service
          .from("puppies")
          .select(
            "id,buyer_id,litter_id,litter_name,dam_id,sire_id,call_name,puppy_name,name,sire,dam,sex,color,coat_type,coat,pattern,dob,registry,price,list_price,deposit,balance,status,birth_weight,current_weight,weight_unit,weight_date,image_url,photo_url,owner_email,description,notes,microchip,registration_no,w_1,w_2,w_3,w_4,w_5,w_6,w_7,w_8,created_at"
          )
          .order("created_at", { ascending: false })
      ),
      safeRows<LitterRow>(
        service
          .from("litters")
          .select("id,litter_code,litter_name,dam_id,sire_id,whelp_date,status")
          .order("whelp_date", { ascending: false })
          .order("created_at", { ascending: false })
      ),
      safeRows<BreedingDogRow>(
        service
          .from("bp_dogs")
          .select("id,role,dog_name,name,call_name,status")
          .order("role", { ascending: true })
          .order("dog_name", { ascending: true })
          .order("call_name", { ascending: true })
      ),
    ]);

    const buyerById = new Map<number, BuyerRow>();
    buyers.forEach((buyer) => buyerById.set(Number(buyer.id), buyer));
    const litterById = new Map<number, (LitterRow & { displayName: string })>();
    litters.forEach((litter) => {
      litterById.set(Number(litter.id), {
        ...litter,
        displayName: firstValue(litter.litter_name, litter.litter_code, `Litter #${litter.id}`),
      });
    });
    const dogNameById = new Map<string, string>();
    breedingDogs.forEach((dog) => {
      dogNameById.set(
        String(dog.id),
        firstValue(
          dog.dog_name,
          dog.name,
          dog.call_name,
          dog.display_name,
          dog.registered_name,
          `Dog ${dog.id.slice(0, 8)}`
        )
      );
    });

    return NextResponse.json({
      ok: true,
      buyers: buyers.map((buyer) => ({
        ...buyer,
        displayName: firstValue(buyer.full_name, buyer.name, buyer.email, `Buyer #${buyer.id}`),
      })),
      litters: litters.map((litter) => ({
        ...litter,
        displayName: firstValue(litter.litter_name, litter.litter_code, `Litter #${litter.id}`),
      })),
      breedingDogs: breedingDogs.map((dog) => ({
        ...dog,
        displayName: firstValue(
          dog.dog_name,
          dog.name,
          dog.call_name,
          dog.display_name,
          dog.registered_name,
          `Dog ${dog.id.slice(0, 8)}`
        ),
      })),
      puppies: puppies.map((puppy) => {
        const buyer = buyerById.get(Number(puppy.buyer_id || 0));
        const litter = litterById.get(Number(puppy.litter_id || 0)) || null;
        const damId = litter?.dam_id || puppy.dam_id || null;
        const sireId = litter?.sire_id || puppy.sire_id || null;
        return {
          ...puppy,
          litter_name: litter?.displayName || puppy.litter_name || null,
          dam_id: damId,
          sire_id: sireId,
          dam: (damId ? dogNameById.get(String(damId)) : null) || puppy.dam || null,
          sire: (sireId ? dogNameById.get(String(sireId)) : null) || puppy.sire || null,
          buyerName: buyer ? firstValue(buyer.full_name, buyer.name, buyer.email, `Buyer #${buyer.id}`) : null,
          buyerEmail: buyer?.email || null,
        };
      }),
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin portal puppies route error:", error);
    return NextResponse.json(
      { ok: false, error: describeRouteError(error, "Could not load puppy records.") },
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
    const service = createServiceSupabase();
    const payload = await asPuppyPayload(service, body, null);

    if (!firstValue(payload.call_name, payload.puppy_name, payload.name)) {
      return NextResponse.json(
        { ok: false, error: "A puppy name is required." },
        { status: 400 }
      );
    }

    const { data, error } = await service
      .from("puppies")
      .insert(payload)
      .select("id,buyer_id")
      .single<{ id: number; buyer_id?: number | null }>();

    if (error) throw error;

    await refreshBuyerFallbackPuppy(service, payload.buyer_id);

    return NextResponse.json({
      ok: true,
      puppyId: data.id,
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin portal puppies create error:", error);
    return NextResponse.json(
      { ok: false, error: describeRouteError(error, "Could not create the puppy.") },
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
    const puppyId = Number(body.id || 0);
    if (!puppyId) {
      return NextResponse.json({ ok: false, error: "A puppy id is required." }, { status: 400 });
    }

    const service = createServiceSupabase();
    const existing = await getExistingPuppy(service, puppyId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Puppy not found." }, { status: 404 });
    }

    const payload = await asPuppyPayload(service, body, existing);
    if (
      !firstValue(
        payload.call_name,
        payload.puppy_name,
        payload.name,
        existing.call_name,
        existing.puppy_name,
        existing.name
      )
    ) {
      return NextResponse.json(
        { ok: false, error: "A puppy name is required." },
        { status: 400 }
      );
    }

    const { error } = await service.from("puppies").update(payload).eq("id", puppyId);
    if (error) throw error;

    await refreshBuyerFallbackPuppy(service, existing.buyer_id || null);
    await refreshBuyerFallbackPuppy(service, payload.buyer_id || null);

    return NextResponse.json({
      ok: true,
      puppyId,
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin portal puppies update error:", error);
    return NextResponse.json(
      { ok: false, error: describeRouteError(error, "Could not update the puppy.") },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const puppyId = Number(body.id || 0);
    if (!puppyId) {
      return NextResponse.json({ ok: false, error: "A puppy id is required." }, { status: 400 });
    }

    const service = createServiceSupabase();
    const existing = await getExistingPuppy(service, puppyId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Puppy not found." }, { status: 404 });
    }

    const { error } = await service.from("puppies").delete().eq("id", puppyId);
    if (error) throw error;

    await refreshBuyerFallbackPuppy(service, existing.buyer_id || null);

    return NextResponse.json({
      ok: true,
      puppyId,
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin portal puppies delete error:", error);
    return NextResponse.json(
      { ok: false, error: describeRouteError(error, "Could not delete the puppy.") },
      { status: 500 }
    );
  }
}
