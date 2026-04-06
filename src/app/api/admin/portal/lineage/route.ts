import { NextResponse } from "next/server";
import { loadAdminLineageWorkspace } from "@/lib/admin-lineage";
import { describeRouteError, verifyOwner } from "@/lib/admin-api";

export async function GET(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await loadAdminLineageWorkspace();

    return NextResponse.json({
      ok: true,
      workspace,
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin portal lineage route error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not load the lineage workspace."),
      },
      { status: 500 }
    );
  }
}
