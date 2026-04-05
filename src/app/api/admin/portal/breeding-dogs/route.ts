import { NextResponse } from "next/server";
import { createServiceSupabase, firstValue, verifyOwner } from "@/lib/admin-api";

function asDogPayload(body: Record<string, unknown>) {
  const role = String(body.role || "").trim().toLowerCase() === "sire" ? "sire" : "dam";

  return {
    role,
    display_name: firstValue(body.display_name as string | null, body.call_name as string | null),
    registered_name: firstValue(body.registered_name as string | null) || null,
    call_name: firstValue(body.call_name as string | null) || null,
    status: firstValue(body.status as string | null, "active"),
    date_of_birth: firstValue(body.date_of_birth as string | null) || null,
    color: firstValue(body.color as string | null) || null,
    coat_type: firstValue(body.coat_type as string | null) || null,
    registration_no: firstValue(body.registration_no as string | null) || null,
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

    if (!payload.display_name) {
      return NextResponse.json(
        { ok: false, error: "A breeding dog display name is required." },
        { status: 400 }
      );
    }

    const service = createServiceSupabase();
    const { data, error } = await service
      .from("breeding_dogs")
      .insert(payload)
      .select("id")
      .single<{ id: number }>();

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
    const dogId = Number(body.id || 0);
    if (!dogId) {
      return NextResponse.json(
        { ok: false, error: "A breeding dog id is required." },
        { status: 400 }
      );
    }

    const payload = asDogPayload(body);
    if (!payload.display_name) {
      return NextResponse.json(
        { ok: false, error: "A breeding dog display name is required." },
        { status: 400 }
      );
    }

    const service = createServiceSupabase();
    const { error } = await service.from("breeding_dogs").update(payload).eq("id", dogId);
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
