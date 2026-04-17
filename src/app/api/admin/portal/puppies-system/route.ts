import { NextResponse } from "next/server";
import {
  createServiceSupabase,
  describeRouteError,
  verifyOwner,
} from "@/lib/admin-api";
import { loadPuppiesSystemSnapshot } from "@/lib/admin-puppies-system-server";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function text(value: unknown) {
  return String(value || "").trim();
}

function bool(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
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

function renderTemplateString(template: string, payload: Record<string, unknown>) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = payload[key];
    return value == null ? `{{${key}}}` : String(value);
  });
}

export async function GET(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const snapshot = await loadPuppiesSystemSnapshot(
      createServiceSupabase(),
      owner.email || null
    );

    return NextResponse.json(
      {
        ok: true,
        snapshot,
        ownerEmail: owner.email || null,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("Admin puppies system load error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not load the puppies system."),
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

    const service = createServiceSupabase();
    const body = (await req.json()) as Record<string, unknown>;
    const action = text(body.action).toLowerCase();

    if (!action) {
      return NextResponse.json({ ok: false, error: "An action is required." }, { status: 400 });
    }

    if (action === "save_puppy_profile") {
      const puppyId = intValue(body.puppyId);
      if (!puppyId) {
        return NextResponse.json({ ok: false, error: "A puppy id is required." }, { status: 400 });
      }

      const { error } = await service.from("puppy_admin_profiles").upsert(
        {
          puppy_id: puppyId,
          registered_name: text(body.registeredName) || null,
          public_visibility: bool(body.publicVisibility, true),
          portal_visibility: bool(body.portalVisibility, false),
          featured_listing: bool(body.featuredListing, false),
          special_care_flag: bool(body.specialCareFlag, false),
          special_care_notes: text(body.specialCareNotes) || null,
          feeding_notes: text(body.feedingNotes) || null,
          lineage_notes: text(body.lineageNotes) || null,
          breeder_notes: text(body.breederNotes) || null,
          buyer_packet_ready: bool(body.buyerPacketReady, false),
          document_packet_ready: bool(body.documentPacketReady, false),
          transport_ready: bool(body.transportReady, false),
          go_home_ready: bool(body.goHomeReady, false),
          updated_by_email: owner.email || null,
        },
        { onConflict: "puppy_id" }
      );

      if (error) throw error;

      return NextResponse.json({ ok: true, puppyId, ownerEmail: owner.email || null });
    }

    if (action === "save_checklist_progress") {
      const puppyId = intValue(body.puppyId);
      const templateId = intValue(body.templateId);

      if (!puppyId || !templateId) {
        return NextResponse.json(
          { ok: false, error: "A puppy id and template id are required." },
          { status: 400 }
        );
      }

      const completed = bool(body.completed, false);
      const { error } = await service.from("puppy_checklist_progress").upsert(
        {
          puppy_id: puppyId,
          template_id: templateId,
          completed,
          completed_at: completed ? new Date().toISOString() : null,
          visible_to_buyer: bool(body.visibleToBuyer, false),
          notes: text(body.notes) || null,
          updated_by_email: owner.email || null,
        },
        { onConflict: "puppy_id,template_id" }
      );

      if (error) throw error;

      return NextResponse.json({
        ok: true,
        puppyId,
        templateId,
        ownerEmail: owner.email || null,
      });
    }

    if (action === "save_checklist_template") {
      const templateId = intValue(body.id);
      const scope = text(body.scope) || "puppy_development";
      const key = text(body.key);
      const label = text(body.label);

      if (!key || !label) {
        return NextResponse.json(
          { ok: false, error: "A checklist key and label are required." },
          { status: 400 }
        );
      }

      const payload = {
        id: templateId ?? undefined,
        scope,
        key,
        label,
        description: text(body.description) || null,
        category: text(body.category) || "development",
        sort_order: intValue(body.sortOrder) ?? 0,
        required_for_website: bool(body.requiredForWebsite, false),
        required_for_portal: bool(body.requiredForPortal, false),
        required_for_go_home: bool(body.requiredForGoHome, false),
        visible_to_buyer: bool(body.visibleToBuyer, false),
        is_active: bool(body.isActive, true),
      };

      const { error } = await service
        .from("admin_checklist_templates")
        .upsert(payload, { onConflict: "scope,key" });

      if (error) throw error;

      return NextResponse.json({ ok: true, ownerEmail: owner.email || null });
    }

    if (action === "save_message_template") {
      const templateKey = text(body.templateKey);
      const label = text(body.label);

      if (!templateKey || !label) {
        return NextResponse.json(
          { ok: false, error: "A template key and label are required." },
          { status: 400 }
        );
      }

      const { error } = await service.from("admin_message_templates").upsert(
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

      if (error) throw error;

      return NextResponse.json({ ok: true, ownerEmail: owner.email || null });
    }

    if (action === "preview_message_template") {
      const payload = jsonObject(body.previewPayload);
      const renderedSubject = renderTemplateString(text(body.subject), payload);
      const renderedBody = renderTemplateString(text(body.body), payload);

      return NextResponse.json({
        ok: true,
        preview: {
          subject: renderedSubject,
          body: renderedBody,
        },
        ownerEmail: owner.email || null,
      });
    }

    if (action === "save_workflow_setting") {
      const workflowKey = text(body.workflowKey);
      const label = text(body.label);

      if (!workflowKey || !label) {
        return NextResponse.json(
          { ok: false, error: "A workflow key and label are required." },
          { status: 400 }
        );
      }

      const { error } = await service.from("admin_workflow_settings").upsert(
        {
          id: intValue(body.id) ?? undefined,
          workflow_key: workflowKey,
          category: text(body.category) || "operations",
          label,
          description: text(body.description) || null,
          status: text(body.status) || "active",
          owner: text(body.owner) || null,
          cadence_label: text(body.cadenceLabel) || null,
          trigger_label: text(body.triggerLabel) || null,
          next_run_hint: text(body.nextRunHint) || null,
          settings: jsonObject(body.settings),
          is_visible: bool(body.isVisible, true),
          updated_by_email: owner.email || null,
        },
        { onConflict: "workflow_key" }
      );

      if (error) throw error;

      return NextResponse.json({ ok: true, ownerEmail: owner.email || null });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported puppies system action." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Admin puppies system write error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not save the puppies system update."),
      },
      { status: 500 }
    );
  }
}
