import { NextResponse } from "next/server";
import {
  createServiceSupabase,
  describeRouteError,
  firstValue,
  verifyOwner,
} from "@/lib/admin-api";
import {
  BREEDING_DOG_TABLES,
  chooseFirstAvailableTable,
  findTableWithMatch,
} from "@/lib/admin-data-compat";
import { isMissingBreedingGeneticsColumnError } from "@/lib/breeding-genetics";
import { breedingStatusIsInactive } from "@/lib/breeding-program";

function normalizeDogId(value: unknown) {
  const text = String(value || "").trim();
  return text || null;
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

function columnNameFromError(error: unknown) {
  const message = describeRouteError(error, "").toLowerCase();
  const quotedColumn = message.match(/['"]([a-z0-9_]+)['"] column/);
  if (quotedColumn?.[1]) return quotedColumn[1];

  const missingColumn = message.match(/column ['"]?([a-z0-9_]+)['"]? (?:of relation .* )?does not exist/);
  if (missingColumn?.[1]) return missingColumn[1];

  const schemaColumn = message.match(/could not find the ['"]([a-z0-9_]+)['"] column/);
  if (schemaColumn?.[1]) return schemaColumn[1];

  return null;
}

function stripColumn<T extends Record<string, unknown>>(payload: T, column: string) {
  const nextPayload = { ...payload };
  delete nextPayload[column];
  return nextPayload;
}

async function insertDogWithSchemaFallback(
  service: ReturnType<typeof createServiceSupabase>,
  table: string,
  payload: Record<string, unknown>,
  ownerId: string
) {
  let nextPayload = { ...payload, user_id: ownerId };
  const strippedColumns = new Set<string>();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = await service
      .from(table)
      .insert(nextPayload)
      .select("id")
      .single<{ id: string }>();

    if (!result.error) return result;

    if (isMissingBreedingGeneticsColumnError(result.error)) {
      nextPayload = stripGeneticsFields(nextPayload);
      continue;
    }

    const missingColumn = columnNameFromError(result.error);
    if (!missingColumn || strippedColumns.has(missingColumn)) return result;

    strippedColumns.add(missingColumn);
    nextPayload = stripColumn(nextPayload, missingColumn);
  }

  return {
    data: null,
    error: new Error("Could not save the breeding dog after retrying schema-compatible fields."),
  };
}

async function updateDogWithSchemaFallback(
  service: ReturnType<typeof createServiceSupabase>,
  table: string,
  dogId: string,
  payload: Record<string, unknown>
) {
  let nextPayload = { ...payload };
  const strippedColumns = new Set<string>();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = await service
      .from(table)
      .update(nextPayload)
      .eq("id", dogId)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (!result.error) return result;

    if (isMissingBreedingGeneticsColumnError(result.error)) {
      nextPayload = stripGeneticsFields(nextPayload);
      continue;
    }

    const missingColumn = columnNameFromError(result.error);
    if (!missingColumn || strippedColumns.has(missingColumn)) return result;

    strippedColumns.add(missingColumn);
    nextPayload = stripColumn(nextPayload, missingColumn);
  }

  return {
    data: null,
    error: new Error("Could not update the breeding dog after retrying schema-compatible fields."),
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
    const tableChoice = await chooseFirstAvailableTable(service, BREEDING_DOG_TABLES);
    if (!tableChoice.table) {
      throw new Error(
        tableChoice.error instanceof Error
          ? tableChoice.error.message
          : "No breeding dog table is available."
      );
    }

    const { data, error } = await insertDogWithSchemaFallback(
      service,
      tableChoice.table,
      payload,
      owner.id
    );

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
        error: describeRouteError(error, "Could not create the breeding dog."),
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
    const dogId = normalizeDogId(body.id);
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
    const tableMatch = await findTableWithMatch(service, BREEDING_DOG_TABLES, "id", dogId);
    if (!tableMatch.table) {
      throw new Error(
        tableMatch.error
          ? describeRouteError(tableMatch.error, "Could not locate the editable breeding dog record.")
          : "Could not locate this dog in the editable breeding program tables. Refresh the roster and select the editable profile."
      );
    }

    const { data, error } = await updateDogWithSchemaFallback(
      service,
      tableMatch.table,
      dogId,
      payload
    );

    if (error) throw error;
    if (!data?.id) {
      throw new Error("No breeding dog profile was updated. Refresh the roster and try the editable dog record.");
    }

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
        error: describeRouteError(error, "Could not update the breeding dog."),
      },
      { status: 500 }
    );
  }
}
