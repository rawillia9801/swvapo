import { NextResponse } from "next/server";
import {
  createServiceSupabase,
  verifyPortalUser,
} from "@/lib/portal-api";
import {
  attachChiChiWorkflowToPayload,
  buildChiChiDocumentPackageId,
  mergeChiChiDocumentPackageWorkflow,
  type ChiChiDocumentPackageWorkflow,
} from "@/lib/chichi-document-packages";
import {
  getZohoDocumentPackageIntegrations,
} from "@/lib/zoho-document-workflow";
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
  data?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
};

const CHICHI_PACKAGE_KEYS = new Set([
  "deposit-agreement",
  "bill-of-sale",
  "health-guarantee",
  "hypoglycemia-awareness",
  "payment-plan-agreement",
  "pickup-delivery-confirmation",
]);

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
          .select("id,status,submitted_at,signed_at,data,payload")
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
          .select("id,status,submitted_at,signed_at,data,payload")
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
          .select("id,status,submitted_at,signed_at,data,payload")
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

async function loadBuyerAndPuppyContext(
  service: ReturnType<typeof createServiceSupabase>,
  params: { userId: string; email: string }
) {
  const byUserResult = await service
    .from("buyers")
    .select(
      "id,user_id,puppy_id,full_name,name,email,delivery_option,delivery_date,delivery_location,finance_enabled"
    )
    .eq("user_id", params.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const buyerByUser = byUserResult.error ? null : byUserResult.data;
  const byEmailResult =
    !buyerByUser && params.email
      ? await service
          .from("buyers")
          .select(
            "id,user_id,puppy_id,full_name,name,email,delivery_option,delivery_date,delivery_location,finance_enabled"
          )
          .ilike("email", params.email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : null;

  const buyer = buyerByUser || (byEmailResult && !byEmailResult.error ? byEmailResult.data : null);
  if (!buyer) {
    return { buyer: null, puppy: null };
  }

  const puppyResult = buyer.puppy_id
    ? await service
        .from("puppies")
        .select("id,buyer_id,call_name,puppy_name,name,owner_email")
        .eq("id", buyer.puppy_id)
        .maybeSingle()
    : await service
        .from("puppies")
        .select("id,buyer_id,call_name,puppy_name,name,owner_email")
        .eq("buyer_id", buyer.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

  return {
    buyer,
    puppy: puppyResult.error ? null : puppyResult.data,
  };
}

function existingWorkflow(existing: ExistingSubmission | null | undefined) {
  const payload =
    existing?.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload)
      ? existing.payload
      : existing?.data &&
          typeof existing.data === "object" &&
          !Array.isArray(existing.data)
        ? existing.data
        : null;

  if (!payload || typeof payload !== "object") return null;
  const raw = (payload as Record<string, unknown>).chi_chi_workflow;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const workflow = raw as ChiChiDocumentPackageWorkflow;
  return workflow.package_id ? workflow : null;
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
    const packageEnabled = CHICHI_PACKAGE_KEYS.has(definition.key);
    const accountContext = packageEnabled
      ? await loadBuyerAndPuppyContext(service, { userId: user.id, email })
      : { buyer: null, puppy: null };
    const integrations = packageEnabled
      ? getZohoDocumentPackageIntegrations(definition.key)
      : null;
    const currentWorkflow = packageEnabled ? existingWorkflow(existing) : null;
    const packageId =
      packageEnabled
        ? currentWorkflow?.package_id ||
          buildChiChiDocumentPackageId({
            packageKey: definition.key,
            buyerId: Number(accountContext.buyer?.id || 0) || null,
            userId: user.id,
          })
        : null;
    const workflow = packageEnabled
      ? mergeChiChiDocumentPackageWorkflow(currentWorkflow, {
          package_id: packageId || "",
          package_key: definition.key,
          package_title: definition.title,
          buyer_id: Number(accountContext.buyer?.id || 0) || null,
          puppy_id: Number(accountContext.puppy?.id || 0) || null,
          user_id: user.id,
          preferred_flow: currentWorkflow?.preferred_flow || integrations?.flow || "portal_fallback",
          active_flow: currentWorkflow?.active_flow || "portal_fallback",
          package_status:
            finalStatus === "draft"
              ? "fallback_portal_flow"
              : signedName
                ? "signed"
                : "ready_for_signature",
          launch_url:
            currentWorkflow?.launch_url ||
            (integrations?.formsUrl || `${new URL(req.url).origin}/portal/documents?document=${definition.key}`),
          prepared_at: currentWorkflow?.prepared_at || nowIso,
          last_buyer_input_at: nowIso,
          signed_at:
            finalStatus !== "draft" && signedName
              ? existing?.signed_at || nowIso
              : currentWorkflow?.signed_at || null,
          zoho: {
            ...(currentWorkflow?.zoho || {}),
            forms_url: integrations?.formsUrl || null,
          },
        })
      : null;
    const persistedPayload = workflow
      ? attachChiChiWorkflowToPayload(normalizedPayload, workflow)
      : normalizedPayload;

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
      data: persistedPayload,
      payload: persistedPayload,
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
