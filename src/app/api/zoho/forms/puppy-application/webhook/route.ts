import { NextResponse } from "next/server";
import {
  createServiceSupabase,
  describeRouteError,
  listAllAuthUsers,
  normalizeEmail,
} from "@/lib/admin-api";
import {
  FULL_PUPPY_APPLICATION_SELECT,
  buildPuppyApplicationRowFromCanonical,
  normalizeApplicationPayload,
  type PuppyApplicationRecord,
} from "@/lib/portal-application";
import {
  buildApplicationFormFromZohoSubmission,
  extractZohoPuppyApplicationLinkage,
  parseZohoFormsWebhookBody,
} from "@/lib/zoho-puppy-application";

export const runtime = "nodejs";

function configuredWebhookSecret() {
  const candidates = [
    process.env.CHICHI_ZOHO_FORMS_PUPPY_APPLICATION_WEBHOOK_SECRET,
    process.env.ZOHO_FORMS_PUPPY_APPLICATION_WEBHOOK_SECRET,
    process.env.ZOHO_FORMS_WEBHOOK_SECRET,
  ];

  for (const candidate of candidates) {
    const normalized = String(candidate || "").trim();
    if (normalized) return normalized;
  }

  return "";
}

function providedWebhookSecret(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  return (
    req.headers.get("x-zoho-forms-secret") ||
    req.headers.get("X-Zoho-Forms-Secret") ||
    req.headers.get("x-webhook-secret") ||
    req.headers.get("X-Webhook-Secret") ||
    new URL(req.url).searchParams.get("secret") ||
    new URL(req.url).searchParams.get("token") ||
    ""
  ).trim();
}

function secretIsValid(req: Request) {
  const expected = configuredWebhookSecret();
  if (!expected) return true;
  return providedWebhookSecret(req) === expected;
}

function incomingStatus(existingStatus: string | null | undefined) {
  const normalized = String(existingStatus || "").trim().toLowerCase();
  if (!normalized || ["new", "submitted", "pending"].includes(normalized)) {
    return "submitted";
  }
  return existingStatus || "submitted";
}

async function findApplicationByField(
  service: ReturnType<typeof createServiceSupabase>,
  field: "user_id" | "email" | "applicant_email",
  value: string
) {
  if (!value) return null;

  const query =
    field === "user_id"
      ? service
          .from("puppy_applications")
          .select(FULL_PUPPY_APPLICATION_SELECT)
          .eq(field, value)
      : service
          .from("puppy_applications")
          .select(FULL_PUPPY_APPLICATION_SELECT)
          .ilike(field, value);

  const result = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (result.error || !result.data) return null;
  return result.data as PuppyApplicationRecord;
}

async function findExistingApplication(
  service: ReturnType<typeof createServiceSupabase>,
  params: {
    userId: string | null;
    email: string;
  }
) {
  if (params.userId) {
    const byUserId = await findApplicationByField(service, "user_id", params.userId);
    if (byUserId) return byUserId;
  }

  if (params.email) {
    const byEmail = await findApplicationByField(service, "email", params.email);
    if (byEmail) return byEmail;

    const byApplicantEmail = await findApplicationByField(
      service,
      "applicant_email",
      params.email
    );
    if (byApplicantEmail) return byApplicantEmail;
  }

  return null;
}

async function resolvePortalUserId(params: {
  email: string;
  requestedUserId: string | null;
}) {
  if (!params.email && !params.requestedUserId) return null;

  const authUsers = await listAllAuthUsers();
  const normalizedEmail = normalizeEmail(params.email);

  if (params.requestedUserId) {
    const byId = authUsers.find((entry) => entry.id === params.requestedUserId) || null;
    if (byId) {
      const userEmail = normalizeEmail(byId.email);
      if (!normalizedEmail || !userEmail || userEmail === normalizedEmail) {
        return byId.id;
      }
    }
  }

  if (normalizedEmail) {
    const byEmail =
      authUsers.find((entry) => normalizeEmail(entry.email) === normalizedEmail) || null;
    if (byEmail) return byEmail.id;
  }

  return null;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: "zoho_forms",
    form: "puppy_application",
    endpoint: "webhook",
    message:
      "Public Puppy Application ingest is live. Send Zoho Forms submissions here to create or update canonical puppy_applications records without requiring portal login.",
    method: "POST",
    secret_required: Boolean(configuredWebhookSecret()),
  });
}

export async function POST(req: Request) {
  try {
    if (!secretIsValid(req)) {
      return NextResponse.json(
        { ok: false, message: "Invalid Zoho Forms webhook secret." },
        { status: 401 }
      );
    }

    const rawBody = await req.text();
    const parsed =
      parseZohoFormsWebhookBody(rawBody, req.headers.get("content-type")) || {};
    const linkage = extractZohoPuppyApplicationLinkage(parsed);
    const requestedUserId =
      linkage.userId || new URL(req.url).searchParams.get("user_id") || null;

    const service = createServiceSupabase();
    const existingByRequest = requestedUserId
      ? await findExistingApplication(service, {
          userId: requestedUserId,
          email: normalizeEmail(linkage.email),
        })
      : null;
    const initialMapped = buildApplicationFormFromZohoSubmission({
      source: parsed,
      baseCanonical: existingByRequest
        ? normalizeApplicationPayload(existingByRequest.application)
        : null,
    });
    const initialCanonical = initialMapped.canonical;
    const email = normalizeEmail(initialCanonical.applicant.email || linkage.email);

    if (!initialCanonical.applicant.full_name && !email) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "The Zoho submission did not include enough applicant identity to create an application record.",
        },
        { status: 400 }
      );
    }

    const matchedUserId = await resolvePortalUserId({
      email,
      requestedUserId,
    });
    const existing =
      existingByRequest ||
      (await findExistingApplication(service, {
        userId: matchedUserId,
        email,
      }));
    const mapped =
      existing && existing !== existingByRequest
        ? buildApplicationFormFromZohoSubmission({
            source: parsed,
            baseCanonical: normalizeApplicationPayload(existing.application),
          })
        : initialMapped;
    const canonical = mapped.canonical;

    const preservedUserId =
      String(existing?.user_id || "").trim() || matchedUserId || requestedUserId || null;
    const rowPayload = buildPuppyApplicationRowFromCanonical({
      canonical,
      userId: preservedUserId,
      status: incomingStatus(existing?.status),
    });

    const mutation = existing
      ? await service
          .from("puppy_applications")
          .update(rowPayload)
          .eq("id", existing.id)
          .select(FULL_PUPPY_APPLICATION_SELECT)
          .maybeSingle()
      : await service
          .from("puppy_applications")
          .insert(rowPayload)
          .select(FULL_PUPPY_APPLICATION_SELECT)
          .maybeSingle();

    if (mutation.error || !mutation.data) {
      throw mutation.error || new Error("Could not save the Puppy Application record.");
    }

    const saved = mutation.data as PuppyApplicationRecord;

    return NextResponse.json({
      ok: true,
      mode: existing ? "updated" : "created",
      application_id: saved.id,
      user_id: saved.user_id || null,
      submission_id: linkage.submissionId,
      submitted_at: linkage.submittedAt || canonical.signature.signed_at || null,
      status: saved.status || "submitted",
      email: saved.email || saved.applicant_email || null,
      full_name: saved.full_name || canonical.applicant.full_name || null,
      linked_to_portal_user: Boolean(saved.user_id),
      source: "zoho_forms_public_application",
    });
  } catch (error) {
    console.error("Zoho Puppy Application webhook error:", error);
    return NextResponse.json(
      {
        ok: false,
        message: describeRouteError(
          error,
          "Puppy Application ingest failed. Please review the Zoho webhook configuration."
        ),
      },
      { status: 500 }
    );
  }
}
