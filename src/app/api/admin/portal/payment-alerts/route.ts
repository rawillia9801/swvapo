import { NextResponse } from "next/server";
import { createServiceSupabase, describeRouteError, verifyOwner } from "@/lib/admin-api";

export const runtime = "nodejs";

function clampLimit(value: string | null) {
  const parsed = Number(value || 12);
  if (!Number.isFinite(parsed)) return 12;
  return Math.min(Math.max(Math.round(parsed), 1), 50);
}

function isMissingTableError(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error || "")).toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("schema cache")
  );
}

export async function GET(req: Request) {
  const owner = await verifyOwner(req);
  if (!owner) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const limit = clampLimit(url.searchParams.get("limit"));
    const admin = createServiceSupabase();
    const { data, error } = await admin
      .from("chichi_admin_alerts")
      .select(
        "id,created_at,event_type,alert_scope,title,message,tone,buyer_id,puppy_id,payment_id,payment_link_id,reference_id,source,meta"
      )
      .eq("alert_scope", "payment")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json({ ok: true, alerts: [] });
      }
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      alerts: data || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: describeRouteError(error, "Could not load payment alerts."),
      },
      { status: 500 }
    );
  }
}
