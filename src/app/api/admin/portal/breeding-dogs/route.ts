import { NextResponse } from "next/server";
import { createServiceSupabase, firstValue, verifyOwner } from "@/lib/admin-api";
import { isMissingBreedingGeneticsColumnError } from "@/lib/breeding-genetics";
import { breedingStatusIsInactive } from "@/lib/breeding-program";

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
  const geneticsSummary = firstValue(body.genetics_summary as string | null) || null;
  const geneticsRaw = firstValue(body.genetics_raw as string | null) || null;
  const geneticsReportUrl = firstValue(body.genetics_report_url as string | null) || null;
  const geneticsUpdatedAt =
    geneticsSummary || geneticsRaw || geneticsReportUrl ? new Date().toISOString() : null;
  const status = firstValue(body.status as string | null, "Active");

  return {
    role,
    dog_name: dogName,
    name: registeredName,
    call_name: firstValue(body.call_name as string | null) || null,
    status,
    sex: firstValue(body.sex as string | null, role === "sire" ? "Male" : "Female"),
    dob: dateOfBirth,
    date_of_birth: dateOfBirth,
    color: firstValue(body.color as string | null) || null,
    coat,
    registry,
    genetics_summary: geneticsSummary,
    genetics_raw: geneticsRaw,
    genetics_report_url: geneticsReportUrl,
    genetics_updated_at: geneticsUpdatedAt,
    is_active: !breedingStatusIsInactive(status),
    notes: firstValue(body.notes as string | null) || null,
  };
}

function stripGeneticsFields<T extends Record<string, unknown>>(payload: T) {
  const nextPayload = { ...payload };
  delete nextPayload.genetics_summary;
  delete nextPayload.genetics_raw;
  delete nextPayload.genetics_report_url;
  delete nextPayload.genetics_updated_at;
  return nextPayload;
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
    let { data, error } = await service
      .from("bp_dogs")
      .insert({
        ...payload,
        user_id: owner.id,
      })
      .select("id")
      .single<{ id: string }>();

    if (error && isMissingBreedingGeneticsColumnError(error)) {
      const retry = await service
        .from("bp_dogs")
        .insert({
          ...stripGeneticsFields(payload),
          user_id: owner.id,
        })
        .select("id")
        .single<{ id: string }>();

      data = retry.data;
      error = retry.error;
    }

    if (error) throw error;
    if (!data?.id) {
      throw new Error("The breeding dog was saved, but no profile id was returned.");
    }

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
    let { error } = await service.from("bp_dogs").update(payload).eq("id", dogId);

    if (error && isMissingBreedingGeneticsColumnError(error)) {
      const retry = await service
        .from("bp_dogs")
        .update(stripGeneticsFields(payload))
        .eq("id", dogId);
      error = retry.error;
    }

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
