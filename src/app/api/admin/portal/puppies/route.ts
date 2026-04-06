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
  phone?: string | null;
  status?: string | null;
  notes?: string | null;
  city?: string | null;
  state?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  sale_price?: number | null;
  deposit_amount?: number | null;
  delivery_option?: string | null;
  delivery_date?: string | null;
  delivery_location?: string | null;
  delivery_miles?: number | null;
  delivery_fee?: number | null;
  expense_gas?: number | null;
  expense_hotel?: number | null;
  expense_tolls?: number | null;
  expense_misc?: string | null;
  user_id?: string | null;
  portal_profile_photo_url?: string | null;
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
  tail_dock_cost?: number | null;
  dewclaw_cost?: number | null;
  vaccination_cost?: number | null;
  microchip_cost?: number | null;
  registration_cost?: number | null;
  other_vet_cost?: number | null;
  total_medical_cost?: number | null;
  w_1?: number | null;
  w_2?: number | null;
  w_3?: number | null;
  w_4?: number | null;
  w_5?: number | null;
  w_6?: number | null;
  w_7?: number | null;
  w_8?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PickupRequestRow = {
  id: number;
  user_id?: string | null;
  puppy_id?: number | null;
  request_date?: string | null;
  request_type?: string | null;
  miles?: number | null;
  location_text?: string | null;
  address_text?: string | null;
  notes?: string | null;
  status?: string | null;
  created_at?: string | null;
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function describePuppyWriteError(error: unknown, fallback: string) {
  const message = describeRouteError(error, fallback);
  if (message.toLowerCase().includes("stack depth limit exceeded")) {
    return "The puppies table is hitting a recursive database trigger. Apply the latest puppy trigger repair migration, then retry this save.";
  }
  return message;
}

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

function hasOwn(body: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function stringField(body: Record<string, unknown>, key: string, existing?: string | null) {
  return hasOwn(body, key) ? toStringOrNull(body[key]) : existing ?? null;
}

function numberField(body: Record<string, unknown>, key: string, existing?: number | null) {
  return hasOwn(body, key) ? toNumberOrNull(body[key]) : existing ?? null;
}

function integerField(body: Record<string, unknown>, key: string, existing?: number | null) {
  return hasOwn(body, key) ? toIntegerOrNull(body[key]) : existing ?? null;
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

async function refreshBuyerFallbackPuppyBestEffort(
  service: ReturnType<typeof createServiceSupabase>,
  buyerId: number | null | undefined
) {
  try {
    await refreshBuyerFallbackPuppy(service, buyerId);
  } catch (error) {
    console.warn("Skipping buyer fallback puppy sync after puppy save:", error);
  }
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
      "id,buyer_id,litter_id,litter_name,dam_id,sire_id,call_name,puppy_name,name,sire,dam,sex,color,coat_type,coat,pattern,dob,registry,price,list_price,deposit,balance,status,birth_weight,current_weight,weight_unit,weight_date,image_url,photo_url,owner_email,description,notes,microchip,registration_no,tail_dock_cost,dewclaw_cost,vaccination_cost,microchip_cost,registration_cost,other_vet_cost,total_medical_cost,w_1,w_2,w_3,w_4,w_5,w_6,w_7,w_8,created_at,updated_at"
    )
    .eq("id", puppyId)
    .maybeSingle<PuppyRow>();

  if (error) throw error;
  return data || null;
}

function sameNullableNumber(left: number | null | undefined, right: number | null | undefined) {
  const normalizedLeft = left == null ? null : Number(left);
  const normalizedRight = right == null ? null : Number(right);
  return normalizedLeft === normalizedRight;
}

function assertPersistedPuppyFields(
  body: Record<string, unknown>,
  payload: Awaited<ReturnType<typeof asPuppyPayload>>,
  saved: PuppyRow
) {
  if (hasOwn(body, "litter_id") && !sameNullableNumber(saved.litter_id, payload.litter_id)) {
    throw new Error("The puppy saved, but the litter assignment did not persist correctly.");
  }

  if (hasOwn(body, "price") && !sameNullableNumber(saved.price, payload.price)) {
    throw new Error("The puppy saved, but the internal sale price did not persist correctly.");
  }

  if (
    hasOwn(body, "status") &&
    String(saved.status || "").trim().toLowerCase() !== String(payload.status || "").trim().toLowerCase()
  ) {
    throw new Error("The puppy saved, but the status did not persist correctly.");
  }
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
  const buyerId = integerField(body, "buyer_id", existing?.buyer_id);
  const buyerEmail = await getBuyerEmail(service, buyerId);
  const ownerEmail =
    (hasOwn(body, "owner_email") ? normalizeEmail(body.owner_email) : null) ||
    buyerEmail ||
    normalizeEmail(existing?.owner_email) ||
    null;
  const lineage = await resolveLineageFields(service, body, existing);

  return {
    buyer_id: buyerId,
    ...lineage,
    call_name: stringField(body, "call_name", existing?.call_name),
    puppy_name: stringField(body, "puppy_name", existing?.puppy_name),
    name: stringField(body, "name", existing?.name),
    sex: stringField(body, "sex", existing?.sex),
    color: stringField(body, "color", existing?.color),
    coat_type: stringField(body, "coat_type", existing?.coat_type),
    coat: stringField(body, "coat", existing?.coat),
    pattern: stringField(body, "pattern", existing?.pattern),
    dob: stringField(body, "dob", existing?.dob),
    registry: stringField(body, "registry", existing?.registry),
    price: numberField(body, "price", existing?.price),
    list_price: numberField(body, "list_price", existing?.list_price),
    deposit: numberField(body, "deposit", existing?.deposit),
    balance: numberField(body, "balance", existing?.balance),
    status: hasOwn(body, "status")
      ? firstValue(body.status as string | null, existing?.status || "available") || "available"
      : existing?.status || "available",
    birth_weight: numberField(body, "birth_weight", existing?.birth_weight),
    current_weight: numberField(body, "current_weight", existing?.current_weight),
    weight_unit: stringField(body, "weight_unit", existing?.weight_unit),
    weight_date: stringField(body, "weight_date", existing?.weight_date),
    image_url: stringField(body, "image_url", existing?.image_url),
    photo_url: stringField(body, "photo_url", existing?.photo_url),
    owner_email: ownerEmail,
    description: stringField(body, "description", existing?.description),
    notes: stringField(body, "notes", existing?.notes),
    microchip: stringField(body, "microchip", existing?.microchip),
    registration_no: stringField(body, "registration_no", existing?.registration_no),
    tail_dock_cost: numberField(body, "tail_dock_cost", existing?.tail_dock_cost),
    dewclaw_cost: numberField(body, "dewclaw_cost", existing?.dewclaw_cost),
    vaccination_cost: numberField(body, "vaccination_cost", existing?.vaccination_cost),
    microchip_cost: numberField(body, "microchip_cost", existing?.microchip_cost),
    registration_cost: numberField(body, "registration_cost", existing?.registration_cost),
    other_vet_cost: numberField(body, "other_vet_cost", existing?.other_vet_cost),
    total_medical_cost: numberField(body, "total_medical_cost", existing?.total_medical_cost),
    w_1: numberField(body, "w_1", existing?.w_1),
    w_2: numberField(body, "w_2", existing?.w_2),
    w_3: numberField(body, "w_3", existing?.w_3),
    w_4: numberField(body, "w_4", existing?.w_4),
    w_5: numberField(body, "w_5", existing?.w_5),
    w_6: numberField(body, "w_6", existing?.w_6),
    w_7: numberField(body, "w_7", existing?.w_7),
    w_8: numberField(body, "w_8", existing?.w_8),
  };
}

function payloadForDatabaseWrite(
  payload: Awaited<ReturnType<typeof asPuppyPayload>>
) {
  const next: Record<string, unknown> = { ...payload };

  // When a puppy is linked to a litter, the litter relationship is the source of truth.
  // Avoid writing the derived lineage fields directly so database-side lineage sync can
  // populate them without recursive admin-side rewrite loops.
  delete next.litter_name;
  delete next.dam;
  delete next.sire;

  if (payload.litter_id != null) {
    delete next.dam_id;
    delete next.sire_id;
  }

  return next;
}

export async function GET(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const service = createServiceSupabase();
    const [buyers, puppies, litters, breedingDogs, pickupRequests] = await Promise.all([
      safeRows<BuyerRow>(
        service
          .from("buyers")
          .select(
            "id,user_id,full_name,name,email,phone,status,notes,city,state,address_line1,address_line2,postal_code,sale_price,deposit_amount,delivery_option,delivery_date,delivery_location,delivery_miles,delivery_fee,expense_gas,expense_hotel,expense_tolls,expense_misc,portal_profile_photo_url"
          )
          .order("created_at", { ascending: false })
      ),
      safeRows<PuppyRow>(
        service
          .from("puppies")
          .select(
            "id,buyer_id,litter_id,litter_name,dam_id,sire_id,call_name,puppy_name,name,sire,dam,sex,color,coat_type,coat,pattern,dob,registry,price,list_price,deposit,balance,status,birth_weight,current_weight,weight_unit,weight_date,image_url,photo_url,owner_email,description,notes,microchip,registration_no,tail_dock_cost,dewclaw_cost,vaccination_cost,microchip_cost,registration_cost,other_vet_cost,total_medical_cost,w_1,w_2,w_3,w_4,w_5,w_6,w_7,w_8,created_at"
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
      safeRows<PickupRequestRow>(
        service
          .from("portal_pickup_requests")
          .select(
            "id,user_id,puppy_id,request_date,request_type,miles,location_text,address_text,notes,status,created_at"
          )
          .order("created_at", { ascending: false })
      ),
    ]);

    const buyerById = new Map<number, BuyerRow>();
    buyers.forEach((buyer) => buyerById.set(Number(buyer.id), buyer));
    const pickupByUserId = new Map<string, PickupRequestRow>();
    const pickupByPuppyId = new Map<number, PickupRequestRow>();
    pickupRequests.forEach((request) => {
      const userId = String(request.user_id || "").trim();
      const puppyId = Number(request.puppy_id || 0);
      if (userId && !pickupByUserId.has(userId)) pickupByUserId.set(userId, request);
      if (puppyId && !pickupByPuppyId.has(puppyId)) pickupByPuppyId.set(puppyId, request);
    });
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
        const transportRequest =
          pickupByPuppyId.get(Number(puppy.id)) ||
          (buyer?.user_id ? pickupByUserId.get(String(buyer.user_id)) : null) ||
          null;
        return {
          ...puppy,
          litter_name: litter?.displayName || puppy.litter_name || null,
          dam_id: damId,
          sire_id: sireId,
          dam: (damId ? dogNameById.get(String(damId)) : null) || puppy.dam || null,
          sire: (sireId ? dogNameById.get(String(sireId)) : null) || puppy.sire || null,
          buyerName: buyer ? firstValue(buyer.full_name, buyer.name, buyer.email, `Buyer #${buyer.id}`) : null,
          buyerEmail: buyer?.email || null,
          transportRequest,
        };
      }),
      ownerEmail: owner.email || null,
    }, { headers: NO_STORE_HEADERS });
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

    const dbPayload = payloadForDatabaseWrite(payload);

    const { data, error } = await service
      .from("puppies")
      .insert(dbPayload)
      .select("id,buyer_id")
      .single<{ id: number; buyer_id?: number | null }>();

    if (error) throw error;

    await refreshBuyerFallbackPuppyBestEffort(service, payload.buyer_id);
    const saved = await getExistingPuppy(service, data.id);
    if (!saved) {
      throw new Error("The puppy was created, but the saved record could not be reloaded.");
    }
    assertPersistedPuppyFields(body, payload, saved);

    return NextResponse.json({
      ok: true,
      puppyId: data.id,
      saved: {
        id: saved.id,
        litter_id: saved.litter_id ?? null,
        price: saved.price ?? null,
        status: saved.status ?? null,
      },
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin portal puppies create error:", error);
    return NextResponse.json(
      { ok: false, error: describePuppyWriteError(error, "Could not create the puppy.") },
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

    const dbPayload = payloadForDatabaseWrite(payload);
    const { error } = await service.from("puppies").update(dbPayload).eq("id", puppyId);
    if (error) throw error;

    await refreshBuyerFallbackPuppyBestEffort(service, existing.buyer_id || null);
    await refreshBuyerFallbackPuppyBestEffort(service, payload.buyer_id || null);
    const saved = await getExistingPuppy(service, puppyId);
    if (!saved) {
      throw new Error("The puppy was updated, but the saved record could not be reloaded.");
    }
    assertPersistedPuppyFields(body, payload, saved);

    return NextResponse.json({
      ok: true,
      puppyId,
      saved: {
        id: saved.id,
        litter_id: saved.litter_id ?? null,
        price: saved.price ?? null,
        status: saved.status ?? null,
      },
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin portal puppies update error:", error);
    return NextResponse.json(
      { ok: false, error: describePuppyWriteError(error, "Could not update the puppy.") },
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
      { ok: false, error: describePuppyWriteError(error, "Could not delete the puppy.") },
      { status: 500 }
    );
  }
}
