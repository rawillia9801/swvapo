import { NextResponse } from "next/server";
import {
  createServiceSupabase,
  describeRouteError,
  firstValue,
  verifyOwner,
} from "@/lib/admin-api";

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

async function loadSavedLitter(
  service: ReturnType<typeof createServiceSupabase>,
  litterId: number
) {
  const { data, error } = await service
    .from("litters")
    .select("id,litter_code,litter_name,dam_id,sire_id,whelp_date,status,notes,created_at,updated_at")
    .eq("id", litterId)
    .single();

  if (error) throw error;
  return data;
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

    // Puppy lineage is resolved from the litter relationship on read, which keeps
    // litter saves authoritative without triggering recursive puppy-row updates.
    const litter = await loadSavedLitter(service, data.id);

    return NextResponse.json({
      ok: true,
      litterId: data.id,
      litter,
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin portal litters create error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not create the litter."),
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

    // Puppy lineage is resolved from the litter relationship on read, which keeps
    // litter saves authoritative without triggering recursive puppy-row updates.
    const litter = await loadSavedLitter(service, litterId);

    return NextResponse.json({
      ok: true,
      litterId,
      litter,
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin portal litters update error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not save the litter."),
      },
      { status: 500 }
    );
  }
}
