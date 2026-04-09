import { NextResponse } from "next/server";
import {
  createServiceSupabase,
  verifyPortalUser,
} from "@/lib/portal-api";
import {
  portalDocumentPacket,
  sanitizeDocumentPayload,
  validateDocumentPayload,
} from "@/lib/portal-document-packet";

export const runtime = "nodejs";

type ExistingSubmission = {
  id: number;
  status?: string | null;
  submitted_at?: string | null;
  signed_at?: string | null;
};

function normalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

async function findExistingSubmission(
  service: ReturnType<typeof createServiceSupabase>,
  userId: string,
  email: string,
  formKeys: string[]
) {
  const queries: Array<Promise<{ data: ExistingSubmission[] | null; error: unknown }>> = [];

  if (userId) {
    queries.push(
      Promise.resolve(
        service
          .from("portal_form_submissions")
          .select("id,status,submitted_at,signed_at")
          .eq("user_id", userId)
          .in("form_key", formKeys)
          .order("updated_at", { ascending: false })
          .limit(1)
      )
    );
  }

  if (email) {
    queries.push(
      Promise.resolve(
        service
          .from("portal_form_submissions")
          .select("id,status,submitted_at,signed_at")
          .ilike("user_email", email)
          .in("form_key", formKeys)
          .order("updated_at", { ascending: false })
          .limit(1)
      )
    );
    queries.push(
      Promise.resolve(
        service
          .from("portal_form_submissions")
          .select("id,status,submitted_at,signed_at")
          .ilike("email", email)
          .in("form_key", formKeys)
          .order("updated_at", { ascending: false })
          .limit(1)
      )
    );
  }

  for (const query of queries) {
    const result = await query;
    if (!result.error && result.data?.length) {
      return result.data[0];
    }
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const { user } = await verifyPortalUser(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      documentKey?: string;
      data?: Record<string, unknown> | null;
      status?: string | null;
      version?: string | null;
    };

    const definition = portalDocumentPacket.find((entry) => entry.key === body.documentKey);
    if (!definition) {
      return NextResponse.json(
        { ok: false, error: "Unknown document key." },
        { status: 400 }
      );
    }

    const normalizedPayload = sanitizeDocumentPayload(definition, body.data);
    const signedName =
      String(
        normalizedPayload.signed_name ||
          (normalizedPayload as Record<string, unknown>).signature ||
          ""
      ).trim() || null;
    const signedDate =
      String(normalizedPayload.signed_date || "").trim() ||
      new Date().toISOString().slice(0, 10);
    const requestedStatus = String(body.status || "submitted").trim().toLowerCase();
    const finalStatus = requestedStatus === "draft" ? "draft" : requestedStatus || "submitted";
    const validationErrors =
      finalStatus === "draft" ? [] : validateDocumentPayload(definition, normalizedPayload);

    if (validationErrors.length) {
      return NextResponse.json(
        {
          ok: false,
          error: `Please complete the required fields before signing: ${validationErrors
            .slice(0, 3)
            .join(", ")}.`,
        },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const email = normalizeEmail(user.email);
    const service = createServiceSupabase();
    const matchKeys = Array.from(new Set([definition.formKey, ...(definition.aliases || [])]));
    const existing = await findExistingSubmission(service, user.id, email, matchKeys);

    const submissionPayload = {
      user_id: user.id,
      user_email: email || null,
      email: email || null,
      form_key: definition.formKey,
      form_title: definition.title,
      version: String(body.version || "2026-04"),
      signed_name: signedName,
      signed_date: signedDate || null,
      signed_at:
        finalStatus !== "draft" && signedName
          ? existing?.signed_at || nowIso
          : existing?.signed_at || null,
      data: normalizedPayload,
      payload: normalizedPayload,
      status: finalStatus,
      submitted_at:
        finalStatus !== "draft" ? existing?.submitted_at || nowIso : existing?.submitted_at || null,
      attachments: null,
    };

    const result = existing
      ? await service
          .from("portal_form_submissions")
          .update(submissionPayload)
          .eq("id", existing.id)
          .select(
            "id,user_id,user_email,email,form_key,form_title,version,signed_name,signed_date,signed_at,data,payload,status,submitted_at,attachments,created_at,updated_at"
          )
          .single()
      : await service
          .from("portal_form_submissions")
          .insert(submissionPayload)
          .select(
            "id,user_id,user_email,email,form_key,form_title,version,signed_name,signed_date,signed_at,data,payload,status,submitted_at,attachments,created_at,updated_at"
          )
          .single();

    if (result.error) {
      throw result.error;
    }

    return NextResponse.json({
      ok: true,
      submission: result.data,
    });
  } catch (error) {
    console.error("Portal forms save error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Could not save the form copy.",
      },
      { status: 500 }
    );
  }
}
