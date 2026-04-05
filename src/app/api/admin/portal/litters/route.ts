import { NextResponse } from "next/server";
import { createServiceSupabase, firstValue, verifyOwner } from "@/lib/admin-api";

function toDogId(value: unknown) {
  const text = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}

function asLitterPayload(body: Record<string, unknown>) {
  return {
    litter_code: firstValue(body.litter_code as string | null, body.litter_name as string | null),
    litter_name: firstValue(body.litter_name as string | null) || null,
    dam_id: toDogId(body.dam_id),
    sire_id: toDogId(body.sire_id),
    whelp_date: firstValue(body.whelp_date as string | null) || null,
    status: firstValue(body.status as string | null, "planned"),
    notes: firstValue(body.notes as string | null) || null,
  };
}

async function syncLitterPuppies(
  service: ReturnType<typeof createServiceSupabase>,
  litterId: number,
  payload: ReturnType<typeof asLitterPayload>
) {
  const dogIds = [payload.dam_id, payload.sire_id].filter(Boolean) as string[];
  const dogNameMap = new Map<string, string>();

  if (dogIds.length) {
    const { data, error } = await service
      .from("bp_dogs")
      .select("id,dog_name,name,call_name")
      .in("id", dogIds);
    if (error) throw error;
    (data || []).forEach((row) =>
      dogNameMap.set(
        String(row.id),
        firstValue(
          row.dog_name as string | null,
          row.name as string | null,
          row.call_name as string | null
        ) || "Unnamed"
      )
    );
  }

  const { error } = await service
    .from("puppies")
    .update({
      dam_id: payload.dam_id,
      sire_id: payload.sire_id,
      litter_name: payload.litter_name || payload.litter_code,
      dam: payload.dam_id ? dogNameMap.get(String(payload.dam_id)) || null : null,
      sire: payload.sire_id ? dogNameMap.get(String(payload.sire_id)) || null : null,
    })
    .eq("litter_id", litterId);

  if (error) throw error;
}

export async function POST(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const payload = asLitterPayload(body);

    if (!payload.litter_code) {
      return NextResponse.json(
        { ok: false, error: "A litter code or litter name is required." },
        { status: 400 }
      );
    }

    const service = createServiceSupabase();
    const { data, error } = await service
      .from("litters")
      .insert(payload)
      .select("id")
      .single<{ id: number }>();

    if (error) throw error;

    await syncLitterPuppies(service, data.id, payload);

    return NextResponse.json({
      ok: true,
      litterId: data.id,
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin portal litters create error:", error);
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
    const litterId = Number(body.id || 0);
    if (!litterId) {
      return NextResponse.json(
        { ok: false, error: "A litter id is required." },
        { status: 400 }
      );
    }

    const payload = asLitterPayload(body);
    if (!payload.litter_code) {
      return NextResponse.json(
        { ok: false, error: "A litter code or litter name is required." },
        { status: 400 }
      );
    }

    const service = createServiceSupabase();
    const { error } = await service.from("litters").update(payload).eq("id", litterId);
    if (error) throw error;

    await syncLitterPuppies(service, litterId, payload);

    return NextResponse.json({
      ok: true,
      litterId,
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin portal litters update error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
