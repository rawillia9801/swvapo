import { NextResponse } from "next/server";

import {
  createServiceSupabase,
  describeRouteError,
  verifyOwner,
} from "@/lib/admin-api";
import { resolvePortalWorkspace } from "@/lib/resolvers/portal";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const service = createServiceSupabase();
    const resolved = await resolvePortalWorkspace(service);

    return NextResponse.json({
      ok: true,
      messages: resolved.data.resolvedPortalMessages
        .filter((message) => message.sourceTable === "portal_messages")
        .map((message) => ({
          id: message.recordId || message.id,
          created_at: message.createdAt,
          user_id: message.userId,
          user_email: message.userEmail,
          subject: message.subject,
          message: message.body || "",
          status: null,
          read_by_admin: message.readByAdmin ?? false,
          read_by_user: false,
          sender: message.sender === "admin" ? "admin" : "user",
        })),
      diagnostics: resolved.diagnostics,
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin portal messages load error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not load buyer conversations."),
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

    const body = (await req.json()) as { ids?: unknown };
    const ids = Array.isArray(body.ids)
      ? body.ids.map((value) => String(value || "").trim()).filter(Boolean)
      : [];

    if (!ids.length) {
      return NextResponse.json(
        { ok: false, error: "Message ids are required." },
        { status: 400 }
      );
    }

    const service = createServiceSupabase();
    const result = await service
      .from("portal_messages")
      .update({ read_by_admin: true })
      .in("id", ids);

    if (result.error) throw result.error;

    return NextResponse.json({ ok: true, ownerEmail: owner.email || null });
  } catch (error) {
    console.error("Admin portal messages read-state error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not update the message status."),
      },
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
    const userId = String(body.user_id || "").trim() || null;
    const userEmail = String(body.user_email || "").trim() || null;
    const subject = String(body.subject || "").trim() || null;
    const message = String(body.message || "").trim();

    if (!message) {
      return NextResponse.json(
        { ok: false, error: "A message body is required." },
        { status: 400 }
      );
    }

    const service = createServiceSupabase();
    const result = await service.from("portal_messages").insert({
      user_id: userId,
      user_email: userEmail,
      subject,
      message,
      status: "open",
      read_by_admin: true,
      read_by_user: false,
      sender: "admin",
    });

    if (result.error) throw result.error;

    return NextResponse.json({ ok: true, ownerEmail: owner.email || null });
  } catch (error) {
    console.error("Admin portal messages send error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not send the admin reply."),
      },
      { status: 500 }
    );
  }
}
