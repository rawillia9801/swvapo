import { NextResponse } from "next/server";
import {
  createServiceSupabase,
  describeRouteError,
  verifyOwner,
} from "@/lib/admin-api";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const MIGRATION_PATH = "supabase/migrations/20260416_puppy_operations_workspace.sql";

type MessageTemplateRow = {
  id: number;
  template_key?: string | null;
  category?: string | null;
  label?: string | null;
  description?: string | null;
  channel?: string | null;
  provider?: string | null;
  subject?: string | null;
  body?: string | null;
  automation_enabled?: boolean | null;
  is_active?: boolean | null;
  preview_payload?: Record<string, unknown> | null;
  updated_at?: string | null;
};

function text(value: unknown) {
  return String(value || "").trim();
}

function bool(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  const normalized = text(value).toLowerCase();
  if (!normalized) return fallback;
  return ["1", "true", "yes", "on"].includes(normalized);
}

function intValue(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function jsonObject(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  const raw = text(value);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function isMissingTableError(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error || "")).toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("relation") ||
    message.includes("schema cache") ||
    message.includes("could not find the table")
  );
}

function toTemplate(row: MessageTemplateRow) {
  return {
    id: Number(row.id),
    templateKey: text(row.template_key),
    category: text(row.category) || "custom",
    label: text(row.label),
    description: text(row.description) || "",
    channel: text(row.channel) || "email",
    provider: text(row.provider) || "resend",
    subject: text(row.subject),
    body: text(row.body),
    automationEnabled: row.automation_enabled !== false,
    isActive: row.is_active !== false,
    previewPayload:
      row.preview_payload && typeof row.preview_payload === "object" && !Array.isArray(row.preview_payload)
        ? row.preview_payload
        : {},
    updatedAt: row.updated_at || null,
  };
}

export async function GET(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const service = createServiceSupabase();
    const result = await service
      .from("admin_message_templates")
      .select(
        "id,template_key,category,label,description,channel,provider,subject,body,automation_enabled,is_active,preview_payload,updated_at"
      )
      .order("category", { ascending: true })
      .order("label", { ascending: true });

    if (result.error) {
      if (isMissingTableError(result.error)) {
        return NextResponse.json(
          {
            ok: true,
            templates: [],
            missingStorage: true,
            warning: `Template storage is not installed yet. Apply ${MIGRATION_PATH} to enable admin_message_templates.`,
          },
          { headers: NO_STORE_HEADERS }
        );
      }
      throw result.error;
    }

    return NextResponse.json(
      {
        ok: true,
        templates: (result.data || []).map(toTemplate),
        missingStorage: false,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not load the message templates."),
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
    const templateKey = text(body.templateKey);
    const label = text(body.label);

    if (!templateKey || !label) {
      return NextResponse.json(
        { ok: false, error: "A template key and label are required." },
        { status: 400 }
      );
    }

    const service = createServiceSupabase();
    const result = await service.from("admin_message_templates").upsert(
      {
        id: intValue(body.id) ?? undefined,
        template_key: templateKey,
        category: text(body.category) || "custom",
        label,
        description: text(body.description) || null,
        channel: text(body.channel) || "email",
        provider: text(body.provider) || "resend",
        subject: text(body.subject),
        body: text(body.body),
        automation_enabled: bool(body.automationEnabled, true),
        is_active: bool(body.isActive, true),
        preview_payload: jsonObject(body.previewPayload),
        updated_by_email: owner.email || null,
      },
      { onConflict: "template_key" }
    );

    if (result.error) {
      if (isMissingTableError(result.error)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Template storage is not installed yet. Apply ${MIGRATION_PATH} to enable admin_message_templates.`,
          },
          { status: 409 }
        );
      }
      throw result.error;
    }

    return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not save the message template."),
      },
      { status: 500 }
    );
  }
}
