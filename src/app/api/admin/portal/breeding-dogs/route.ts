import { NextResponse } from "next/server";
import { createServiceSupabase, firstValue, verifyOwner } from "@/lib/admin-api";

function normalizeUuid(value: unknown) {
  const text = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}

function asDogPayload(body: Record<string, unknown>) {
  const role = String(body.role || "").trim().toLowerCase() === "sire" ? "sire" : "dam";
  const dateOfBirth = firstValue(
    body.date_of_birth as string | null,
    body.dob as string | null
  ) || null;
  const dogName =
    firstValue(
      body.dog_name as string | null,
      body.display_name as string | null,
      body.call_name as string | null
    ) || null;
  const registeredName =
    firstValue(body.name as string | null, body.registered_name as string | null) || null;
  const coat = firstValue(body.coat as string | null, body.coat_type as string | null) || null;
  const registry =
    firstValue(body.registry as string | null, body.registration_no as string | null) || null;

  return {
    role,
    dog_name: dogName,
    name: registeredName,
    call_name: firstValue(body.call_name as string | null) || null,
    status: firstValue(body.status as string | null, "active"),
    sex: firstValue(body.sex as string | null, role === "sire" ? "Male" : "Female"),
    dob: dateOfBirth,
    date_of_birth: dateOfBirth,
    color: firstValue(body.color as string | null) || null,
    coat,
    registry,
    is_active: String(firstValue(body.status as string | null, "active")).toLowerCase() !== "archived",
    notes: firstValue(body.notes as string | null) || null,
  };
}

export async function POST(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const payload = asDogPayload(body);

    if (!payload.dog_name) {
      return NextResponse.json(
        { ok: false, error: "A breeding dog name is required." },
        { status: 400 }
      );
    }

    const service = createServiceSupabase();
    const { data, error } = await service
      .from("bp_dogs")
      .insert({
        ...payload,
        user_id: owner.id,
      })
      .select("id")
      .single<{ id: string }>();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      dogId: data.id,
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin portal breeding dogs create error:", error);
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
    const dogId = normalizeUuid(body.id);
    if (!dogId) {
      return NextResponse.json(
        { ok: false, error: "A breeding dog id is required." },
        { status: 400 }
      );
    }

    const payload = asDogPayload(body);
    if (!payload.dog_name) {
      return NextResponse.json(
        { ok: false, error: "A breeding dog name is required." },
        { status: 400 }
      );
    }

    const service = createServiceSupabase();
    const { error } = await service.from("bp_dogs").update(payload).eq("id", dogId);
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      dogId,
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin portal breeding dogs update error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
