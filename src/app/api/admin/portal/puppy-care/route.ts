import { NextResponse } from "next/server";
import {
  createServiceSupabase,
  describeRouteError,
  firstValue,
  verifyOwner,
} from "@/lib/admin-api";

export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

type PuppyLookup = {
  id: number;
  call_name?: string | null;
  puppy_name?: string | null;
  name?: string | null;
  current_weight?: number | null;
  weight_unit?: string | null;
  weight_date?: string | null;
  w_1?: number | null;
  w_2?: number | null;
  w_3?: number | null;
  w_4?: number | null;
  w_5?: number | null;
  w_6?: number | null;
  w_7?: number | null;
  w_8?: number | null;
};

type PuppyEventRow = {
  id: number;
  puppy_id?: number | null;
  event_date: string;
  event_type?: string | null;
  label?: string | null;
  title?: string | null;
  summary?: string | null;
  details?: string | null;
  auto_generated?: boolean | null;
  photo_url?: string | null;
  photos?: unknown;
  is_published?: boolean | null;
  is_private?: boolean | null;
};

type PuppyHealthRow = {
  id: number;
  puppy_id?: number | null;
  record_date: string;
  record_type: string;
  title: string;
  description?: string | null;
  provider_name?: string | null;
  medication_name?: string | null;
  dosage?: string | null;
  lot_number?: string | null;
  next_due_date?: string | null;
  is_visible_to_buyer?: boolean | null;
};

type PuppyWeightRow = {
  id: number;
  puppy_id?: number | null;
  weigh_date?: string | null;
  weight_date?: string | null;
  age_weeks?: number | null;
  weight_oz?: number | null;
  weight_g?: number | null;
  notes?: string | null;
  source?: string | null;
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

function toStringOrNull(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function parseBoolean(value: unknown, fallback = false) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return fallback;
  return ["1", "true", "yes", "on"].includes(text);
}

function labelizeUpdateType(value: string | null) {
  const normalized = String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .toLowerCase();
  if (!normalized) return "Puppy Update";
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isMedicalUpdate(value: string | null) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return [
    "vaccination",
    "deworming",
    "de-worming",
    "worming",
    "vet",
    "wellness",
    "medication",
    "health",
  ].includes(normalized);
}

async function getPuppy(
  service: ReturnType<typeof createServiceSupabase>,
  puppyId: number
) {
  const { data, error } = await service
    .from("puppies")
    .select(
      "id,call_name,puppy_name,name,current_weight,weight_unit,weight_date,w_1,w_2,w_3,w_4,w_5,w_6,w_7,w_8"
    )
    .eq("id", puppyId)
    .maybeSingle<PuppyLookup>();

  if (error) throw error;
  return data || null;
}

function normalizeWeightRow(row: PuppyWeightRow) {
  return {
    ...row,
    weight_date: row.weight_date || row.weigh_date || null,
  };
}

export async function GET(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const puppyId = Number(new URL(req.url).searchParams.get("puppy_id") || 0);
    if (!puppyId) {
      return NextResponse.json(
        { ok: false, error: "A puppy id is required." },
        { status: 400 }
      );
    }

    const service = createServiceSupabase();
    const [eventsResult, healthResult, weightsResult] = await Promise.all([
      service
        .from("puppy_events")
        .select(
          "id,puppy_id,event_date,event_type,label,title,summary,details,auto_generated,photo_url,photos,is_published,is_private"
        )
        .eq("puppy_id", puppyId)
        .order("event_date", { ascending: false })
        .order("id", { ascending: false })
        .limit(12),
      service
        .from("puppy_health_records")
        .select(
          "id,puppy_id,record_date,record_type,title,description,provider_name,medication_name,dosage,lot_number,next_due_date,is_visible_to_buyer"
        )
        .eq("puppy_id", puppyId)
        .order("record_date", { ascending: false })
        .order("id", { ascending: false })
        .limit(12),
      service
        .from("puppy_weights")
        .select("id,puppy_id,weigh_date,age_weeks,weight_oz,weight_g,notes,source")
        .eq("puppy_id", puppyId)
        .order("weigh_date", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false })
        .limit(20),
    ]);

    if (eventsResult.error) throw eventsResult.error;
    if (healthResult.error) throw healthResult.error;
    if (weightsResult.error) throw weightsResult.error;

    return NextResponse.json(
      {
        ok: true,
        events: (eventsResult.data || []) as PuppyEventRow[],
        healthRecords: (healthResult.data || []) as PuppyHealthRow[],
        weights: ((weightsResult.data || []) as PuppyWeightRow[]).map(normalizeWeightRow),
        ownerEmail: owner.email || null,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("Admin puppy care load error:", error);
    return NextResponse.json(
      { ok: false, error: describeRouteError(error, "Could not load puppy care details.") },
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

    const service = createServiceSupabase();
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action || "").trim().toLowerCase();
    const puppyId = Number(body.puppy_id || 0);

    if (!puppyId) {
      return NextResponse.json(
        { ok: false, error: "A puppy id is required." },
        { status: 400 }
      );
    }

    const puppy = await getPuppy(service, puppyId);
    if (!puppy) {
      return NextResponse.json({ ok: false, error: "Puppy not found." }, { status: 404 });
    }

    if (action === "log_weight") {
      const weighDate = toStringOrNull(body.weigh_date) || new Date().toISOString().slice(0, 10);
      const ageWeeks = toIntegerOrNull(body.age_weeks);
      const weightOz = toNumberOrNull(body.weight_oz);
      const weightG = toNumberOrNull(body.weight_g);
      const notes = toStringOrNull(body.notes);
      const source = toStringOrNull(body.source) || "admin_current_puppies";

      if (weightOz == null && weightG == null) {
        return NextResponse.json(
          { ok: false, error: "Enter a weight in ounces or grams." },
          { status: 400 }
        );
      }

      const insertResult = await service
        .from("puppy_weights")
        .insert({
          puppy_id: puppyId,
          weigh_date: weighDate,
          age_weeks: ageWeeks,
          weight_oz: weightOz,
          weight_g: weightG,
          notes,
          source,
        })
        .select("id,puppy_id,weigh_date,age_weeks,weight_oz,weight_g,notes,source")
        .single<PuppyWeightRow>();

      if (insertResult.error) throw insertResult.error;

      const puppyUpdate: Record<string, unknown> = {
        current_weight: weightOz ?? weightG,
        weight_unit: weightOz != null ? "oz" : "g",
        weight_date: weighDate,
      };

      if (ageWeeks && ageWeeks >= 1 && ageWeeks <= 8) {
        puppyUpdate[`w_${ageWeeks}`] = weightOz ?? weightG;
      }

      const { error: puppyUpdateError } = await service
        .from("puppies")
        .update(puppyUpdate)
        .eq("id", puppyId);

      if (puppyUpdateError) throw puppyUpdateError;

      return NextResponse.json({
        ok: true,
        action: "log_weight",
        weight: normalizeWeightRow(insertResult.data),
        puppyId,
        puppyName: firstValue(puppy.call_name, puppy.puppy_name, puppy.name, `Puppy #${puppyId}`),
        ownerEmail: owner.email || null,
      });
    }

    if (action === "publish_update") {
      const updateType = toStringOrNull(body.update_type) || "milestone";
      const updateDate = toStringOrNull(body.update_date) || new Date().toISOString().slice(0, 10);
      const title =
        toStringOrNull(body.title) || toStringOrNull(body.label) || labelizeUpdateType(updateType);
      const label = toStringOrNull(body.label) || title;
      const summary = toStringOrNull(body.summary) || title;
      const details = toStringOrNull(body.details);
      const photoUrl = toStringOrNull(body.photo_url);
      const publishToPortal = parseBoolean(body.publish_to_portal, true);
      const createHealthRecord =
        parseBoolean(body.create_health_record, false) || isMedicalUpdate(updateType);
      const providerName = toStringOrNull(body.provider_name);
      const nextDueDate = toStringOrNull(body.next_due_date);
      const medicationName = toStringOrNull(body.medication_name);
      const dosage = toStringOrNull(body.dosage);
      const lotNumber = toStringOrNull(body.lot_number);

      const eventResult = await service
        .from("puppy_events")
        .insert({
          puppy_id: puppyId,
          event_date: updateDate,
          event_type: updateType,
          label,
          title,
          summary,
          details,
          auto_generated: false,
          photo_url: photoUrl,
          is_published: publishToPortal,
          is_private: !publishToPortal,
          sort_order: 0,
        })
        .select(
          "id,puppy_id,event_date,event_type,label,title,summary,details,auto_generated,photo_url,photos,is_published,is_private"
        )
        .single<PuppyEventRow>();

      if (eventResult.error) throw eventResult.error;

      let healthRecord: PuppyHealthRow | null = null;
      if (createHealthRecord) {
        const healthResult = await service
          .from("puppy_health_records")
          .insert({
            puppy_id: puppyId,
            record_date: updateDate,
            record_type: updateType,
            title,
            description: details || summary,
            provider_name: providerName,
            medication_name: medicationName,
            dosage,
            lot_number: lotNumber,
            next_due_date: nextDueDate,
            is_visible_to_buyer: publishToPortal,
          })
          .select(
            "id,puppy_id,record_date,record_type,title,description,provider_name,medication_name,dosage,lot_number,next_due_date,is_visible_to_buyer"
          )
          .single<PuppyHealthRow>();

        if (healthResult.error) throw healthResult.error;
        healthRecord = healthResult.data;
      }

      return NextResponse.json({
        ok: true,
        action: "publish_update",
        event: eventResult.data,
        healthRecord,
        puppyId,
        puppyName: firstValue(puppy.call_name, puppy.puppy_name, puppy.name, `Puppy #${puppyId}`),
        ownerEmail: owner.email || null,
      });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported puppy care action." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Admin puppy care write error:", error);
    return NextResponse.json(
      { ok: false, error: describeRouteError(error, "Could not save the puppy care update.") },
      { status: 500 }
    );
  }
}
