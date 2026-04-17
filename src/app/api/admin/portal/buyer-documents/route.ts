import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  attachChiChiWorkflowToPayload,
  buildChiChiDocumentPackageSource,
  extractChiChiDocumentPackageWorkflow,
  findChiChiPackageDocument,
  formatChiChiDocumentPackageStatus,
  mergeChiChiDocumentPackageWorkflow,
  resolveChiChiDocumentPackageStatus,
  type ChiChiDocumentPackageWorkflow,
} from "@/lib/chichi-document-packages";
import { prepareChiChiDocumentPackage } from "@/lib/chichi-document-orchestration";
import {
  createServiceSupabase,
  describeRouteError,
  firstValue,
  listAllAuthUsers,
  normalizeEmail,
  verifyOwner,
} from "@/lib/admin-api";

export const runtime = "nodejs";

const DOCUMENT_BUCKET = "portal-documents";

type BuyerLookup = {
  id: number;
  user_id?: string | null;
  puppy_id?: number | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  status?: string | null;
};

type PuppyLookup = {
  id: number;
  buyer_id?: number | null;
  call_name?: string | null;
  puppy_name?: string | null;
  name?: string | null;
  status?: string | null;
};

type PackageSubmissionLookup = {
  id: number;
  status?: string | null;
  data?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
  user_id?: string | null;
  user_email?: string | null;
  email?: string | null;
  form_key?: string | null;
  form_title?: string | null;
  version?: string | null;
  signed_name?: string | null;
  signed_date?: string | null;
  signed_at?: string | null;
  submitted_at?: string | null;
  attachments?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
};

type PortalDocumentLookup = {
  id: string;
  user_id?: string | null;
  buyer_id?: number | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  source_table?: string | null;
  file_name?: string | null;
  file_url?: string | null;
  visible_to_user?: boolean | null;
  signed_at?: string | null;
};

function parseBoolean(value: FormDataEntryValue | null) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return true;
  return ["true", "1", "yes", "on"].includes(normalized);
}

function sanitizeFileName(value: string) {
  return String(value || "document")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(-120);
}

async function ensureDocumentBucket(service: ReturnType<typeof createServiceSupabase>) {
  const current = await service.storage.getBucket(DOCUMENT_BUCKET);
  if (!current.error) return;

  const createResult = await service.storage.createBucket(DOCUMENT_BUCKET, {
    public: true,
    fileSizeLimit: 25 * 1024 * 1024,
  });

  if (
    createResult.error &&
    !String(createResult.error.message || "")
      .toLowerCase()
      .includes("already exists")
  ) {
    throw createResult.error;
  }
}

function submissionPayload(
  row: Pick<PackageSubmissionLookup, "payload" | "data"> | null | undefined
) {
  if (row?.payload && typeof row.payload === "object" && !Array.isArray(row.payload)) {
    return row.payload;
  }
  if (row?.data && typeof row.data === "object" && !Array.isArray(row.data)) {
    return row.data;
  }
  return null;
}

function findPackageTarget(
  rows: PackageSubmissionLookup[],
  packageId: string
) {
  return rows.find((row) => {
    const payload = submissionPayload(row);
    const workflow = payload && typeof payload === "object" ? payload.chi_chi_workflow : null;
    return (
      workflow &&
      typeof workflow === "object" &&
      !Array.isArray(workflow) &&
      String((workflow as Record<string, unknown>).package_id || "").trim() === packageId
    );
  }) || null;
}

function text(value: unknown) {
  return String(value || "").trim();
}

function titleize(value: string | null | undefined) {
  const normalized = text(value).replace(/[_-]+/g, " ");
  if (!normalized) return "Untitled";
  return normalized.replace(/\b\w/g, (match) => match.toUpperCase());
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function numberOrNull(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function normalizeWorkspaceStatus(value: string | null | undefined) {
  const normalized = text(value).toLowerCase();
  if (!normalized) return "draft";
  if (normalized.includes("filed") || normalized.includes("final")) return "filed";
  if (normalized.includes("signed") || normalized.includes("completed")) return "signed";
  if (normalized.includes("review")) return "needs_review";
  if (normalized.includes("archive")) return "archived";
  if (normalized.includes("submit")) return "submitted";
  return normalized;
}

function formatWorkspaceStatus(value: string | null | undefined) {
  return titleize(normalizeWorkspaceStatus(value));
}

function resolveBuyerForSubmission(params: {
  submission: PackageSubmissionLookup;
  buyersById: Map<number, BuyerLookup>;
  buyersByUserId: Map<string, BuyerLookup>;
  buyersByEmail: Map<string, BuyerLookup>;
}) {
  const payload = submissionPayload(params.submission);
  const workflow = extractChiChiDocumentPackageWorkflow(params.submission);
  const explicitBuyerId =
    workflow?.buyer_id ??
    numberOrNull(payload?.buyer_id) ??
    numberOrNull(payload?.buyerId) ??
    numberOrNull(asRecord(payload?.buyer)?.id);

  if (explicitBuyerId && params.buyersById.has(explicitBuyerId)) {
    return params.buyersById.get(explicitBuyerId) || null;
  }

  const userId = text(params.submission.user_id);
  if (userId && params.buyersByUserId.has(userId)) {
    return params.buyersByUserId.get(userId) || null;
  }

  const email = normalizeEmail(
    firstValue(
      params.submission.user_email,
      params.submission.email,
      String(payload?.buyer_email || ""),
      String(payload?.buyerEmail || "")
    )
  );

  if (email && params.buyersByEmail.has(email)) {
    return params.buyersByEmail.get(email) || null;
  }

  return null;
}

function resolveBuyerForDocument(params: {
  document: PortalDocumentLookup;
  buyersById: Map<number, BuyerLookup>;
  buyersByUserId: Map<string, BuyerLookup>;
}) {
  const buyerId = numberOrNull(params.document.buyer_id);
  if (buyerId && params.buyersById.has(buyerId)) {
    return params.buyersById.get(buyerId) || null;
  }

  const userId = text(params.document.user_id);
  if (userId && params.buyersByUserId.has(userId)) {
    return params.buyersByUserId.get(userId) || null;
  }

  return null;
}

function resolvePuppy(params: {
  submission?: PackageSubmissionLookup | null;
  buyer?: BuyerLookup | null;
  puppiesById: Map<number, PuppyLookup>;
  puppiesByBuyerId: Map<number, PuppyLookup[]>;
}) {
  const payload = submissionPayload(params.submission);
  const workflow = params.submission ? extractChiChiDocumentPackageWorkflow(params.submission) : null;
  const explicitPuppyId =
    workflow?.puppy_id ??
    numberOrNull(payload?.puppy_id) ??
    numberOrNull(payload?.puppyId) ??
    numberOrNull(asRecord(payload?.puppy)?.id);

  if (explicitPuppyId && params.puppiesById.has(explicitPuppyId)) {
    return params.puppiesById.get(explicitPuppyId) || null;
  }

  const buyerId = numberOrNull(params.buyer?.id);
  if (buyerId && params.puppiesByBuyerId.has(buyerId)) {
    return (params.puppiesByBuyerId.get(buyerId) || [])[0] || null;
  }

  const primaryPuppyId = numberOrNull(params.buyer?.puppy_id);
  if (primaryPuppyId && params.puppiesById.has(primaryPuppyId)) {
    return params.puppiesById.get(primaryPuppyId) || null;
  }

  return null;
}

function parseAttachmentReferences(value: unknown) {
  if (!value) return [] as Array<{
    id: string;
    label: string;
    fileName: string | null;
    url: string | null;
  }>;

  const rows = Array.isArray(value)
    ? value
    : typeof value === "object"
      ? Object.values(value as Record<string, unknown>)
      : [];

  return rows
    .map((entry, index) => {
      const record = asRecord(entry);
      if (!record) return null;
      const url = text(
        record.url ||
          record.file_url ||
          record.publicUrl ||
          record.href ||
          record.downloadUrl
      );
      return {
        id: text(record.id || `${index}`) || `${index}`,
        label: firstValue(
          String(record.label || ""),
          String(record.title || ""),
          String(record.name || ""),
          String(record.file_name || ""),
          `Attachment ${index + 1}`
        ),
        fileName: text(record.file_name || record.name || record.title) || null,
        url: url || null,
      };
    })
    .filter(
      (
        row
      ): row is { id: string; label: string; fileName: string | null; url: string | null } =>
        Boolean(row)
    );
}

function buildTimeline(params: {
  submission: PackageSubmissionLookup | null;
  workflow: ChiChiDocumentPackageWorkflow | null;
  filedDate: string | null;
}) {
  const items: Array<{ id: string; label: string; at: string | null; detail: string | null }> = [];

  if (params.submission?.created_at) {
    items.push({ id: "created", label: "Submission created", at: params.submission.created_at, detail: null });
  }
  if (params.submission?.submitted_at) {
    items.push({ id: "submitted", label: "Buyer submitted", at: params.submission.submitted_at, detail: null });
  }
  if (params.workflow?.last_buyer_input_at) {
    items.push({ id: "buyer-input", label: "Buyer input received", at: params.workflow.last_buyer_input_at, detail: null });
  }
  if (params.workflow?.sent_to_sign_at) {
    items.push({
      id: "sent-to-sign",
      label: "Sent for signature",
      at: params.workflow.sent_to_sign_at,
      detail: params.workflow.active_flow ? `Flow: ${titleize(params.workflow.active_flow)}` : null,
    });
  }
  if (params.workflow?.signed_at || params.submission?.signed_at || params.submission?.signed_date) {
    items.push({
      id: "signed",
      label: "Signed",
      at: params.workflow?.signed_at || params.submission?.signed_at || params.submission?.signed_date || null,
      detail: params.submission?.signed_name ? `Signer: ${params.submission.signed_name}` : null,
    });
  }
  if (params.filedDate) {
    items.push({ id: "filed", label: "Filed", at: params.filedDate, detail: null });
  }
  if (params.workflow?.review_note) {
    items.push({
      id: "review-note",
      label: "Override / review note",
      at: params.workflow.last_synced_at || params.submission?.updated_at || params.submission?.created_at || null,
      detail: params.workflow.review_note,
    });
  }

  return items.sort((left, right) => {
    const leftTime = left.at ? new Date(left.at).getTime() : 0;
    const rightTime = right.at ? new Date(right.at).getTime() : 0;
    return rightTime - leftTime;
  });
}

async function loadSubmissionById(
  service: ReturnType<typeof createServiceSupabase>,
  submissionId: number
) {
  const result = await service
    .from("portal_form_submissions")
    .select(
      "id,status,data,payload,user_id,user_email,email,form_key,form_title,version,signed_name,signed_date,signed_at,submitted_at,attachments,created_at,updated_at"
    )
    .eq("id", submissionId)
    .limit(1)
    .maybeSingle<PackageSubmissionLookup>();

  if (result.error) throw result.error;
  return result.data || null;
}

async function updateSubmissionWorkflow(params: {
  service: ReturnType<typeof createServiceSupabase>;
  submissionId: number;
  status?: string | null;
  workflowPatch?: Partial<ChiChiDocumentPackageWorkflow>;
}) {
  const submission = await loadSubmissionById(params.service, params.submissionId);
  if (!submission) throw new Error("Submission not found.");

  const payload = submissionPayload(submission) || {};
  const currentWorkflow = extractChiChiDocumentPackageWorkflow(submission);
  const nextWorkflow = params.workflowPatch
    ? mergeChiChiDocumentPackageWorkflow(currentWorkflow, params.workflowPatch)
    : currentWorkflow;
  const nextPayload = nextWorkflow ? attachChiChiWorkflowToPayload(payload, nextWorkflow) : payload;

  const updateResult = await params.service
    .from("portal_form_submissions")
    .update({
      status: params.status || submission.status || "submitted",
      data: nextPayload,
      payload: nextPayload,
    })
    .eq("id", params.submissionId);

  if (updateResult.error) throw updateResult.error;
}

async function loadDocumentWorkspace(service: ReturnType<typeof createServiceSupabase>) {
  const [buyersRes, puppiesRes, submissionsRes, documentsRes, authUsers] = await Promise.all([
    service
      .from("buyers")
      .select("id,user_id,puppy_id,full_name,name,email,status")
      .order("created_at", { ascending: false }),
    service
      .from("puppies")
      .select("id,buyer_id,call_name,puppy_name,name,status")
      .order("created_at", { ascending: false }),
    service
      .from("portal_form_submissions")
      .select(
        "id,status,data,payload,user_id,user_email,email,form_key,form_title,version,signed_name,signed_date,signed_at,submitted_at,attachments,created_at,updated_at"
      )
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false }),
    service
      .from("portal_documents")
      .select(
        "id,user_id,buyer_id,title,description,category,status,created_at,updated_at,source_table,file_name,file_url,visible_to_user,signed_at"
      )
      .order("created_at", { ascending: false }),
    listAllAuthUsers(),
  ]);

  if (buyersRes.error) throw buyersRes.error;
  if (puppiesRes.error) throw puppiesRes.error;
  if (submissionsRes.error) throw submissionsRes.error;
  if (documentsRes.error) throw documentsRes.error;

  const buyers = (buyersRes.data || []) as BuyerLookup[];
  const puppies = (puppiesRes.data || []) as PuppyLookup[];
  const submissions = (submissionsRes.data || []) as PackageSubmissionLookup[];
  const documents = (documentsRes.data || []) as PortalDocumentLookup[];

  const buyersById = new Map<number, BuyerLookup>();
  const buyersByUserId = new Map<string, BuyerLookup>();
  const buyersByEmail = new Map<string, BuyerLookup>();
  const puppiesById = new Map<number, PuppyLookup>();
  const puppiesByBuyerId = new Map<number, PuppyLookup[]>();
  const authUserIdByEmail = new Map(
    authUsers
      .map((authUser) => [normalizeEmail(authUser.email), authUser.id] as const)
      .filter(([email]) => !!email)
  );

  buyers.forEach((buyer) => {
    buyersById.set(buyer.id, buyer);
    const userId = text(buyer.user_id) || authUserIdByEmail.get(normalizeEmail(buyer.email)) || "";
    if (userId) buyersByUserId.set(userId, buyer);
    const email = normalizeEmail(buyer.email);
    if (email) buyersByEmail.set(email, buyer);
  });

  puppies.forEach((puppy) => {
    puppiesById.set(puppy.id, puppy);
    const buyerId = numberOrNull(puppy.buyer_id);
    if (!buyerId) return;
    const group = puppiesByBuyerId.get(buyerId) || [];
    group.push(puppy);
    puppiesByBuyerId.set(buyerId, group);
  });

  const usedDocumentIds = new Set<string>();

  const submissionRecords = submissions.map((submission) => {
    const workflow = extractChiChiDocumentPackageWorkflow(submission);
    const buyer = resolveBuyerForSubmission({ submission, buyersById, buyersByUserId, buyersByEmail });
    const puppy = resolvePuppy({ submission, buyer, puppiesById, puppiesByBuyerId });
    const packageSource = workflow?.package_id ? buildChiChiDocumentPackageSource(workflow.package_id) : null;
    const filedDocuments = workflow?.package_id
      ? documents.filter((document) => text(document.source_table) === packageSource)
      : [];
    const primaryFiledDocument =
      workflow?.package_id && filedDocuments.length
        ? findChiChiPackageDocument(workflow.package_id, documents)
        : null;

    filedDocuments.forEach((document) => usedDocumentIds.add(document.id));

    const status = workflow
      ? resolveChiChiDocumentPackageStatus({
          workflow,
          submission: {
            status: submission.status || "",
            signed_at: submission.signed_at || null,
            submitted_at: submission.submitted_at || null,
          },
          signedCopy: primaryFiledDocument,
        })
      : normalizeWorkspaceStatus(submission.status);

    const signedDate =
      workflow?.signed_at ||
      text(submission.signed_at) ||
      text(submission.signed_date) ||
      text(primaryFiledDocument?.signed_at) ||
      null;
    const filedDate =
      workflow?.filed_at ||
      text(primaryFiledDocument?.created_at) ||
      (filedDocuments.find((document) => normalizeWorkspaceStatus(document.status) === "filed")?.created_at || null);

    return {
      key: `submission-${submission.id}`,
      recordType: "submission",
      submissionId: submission.id,
      documentId: primaryFiledDocument?.id || null,
      buyerId: buyer?.id || null,
      buyerName: firstValue(buyer?.full_name, buyer?.name, submission.user_email, submission.email, "Unlinked buyer"),
      buyerEmail: firstValue(buyer?.email, submission.user_email, submission.email) || null,
      buyerStatus: text(buyer?.status) || null,
      puppyId: puppy?.id || null,
      puppyName: firstValue(puppy?.call_name, puppy?.puppy_name, puppy?.name) || null,
      puppyStatus: text(puppy?.status) || null,
      documentType: firstValue(workflow?.package_title, submission.form_title, submission.form_key ? titleize(submission.form_key) : null) || "Portal submission",
      status,
      statusLabel: workflow
        ? formatChiChiDocumentPackageStatus(
            status as Parameters<typeof formatChiChiDocumentPackageStatus>[0]
          )
        : formatWorkspaceStatus(status),
      source: firstValue(workflow?.active_flow, workflow?.preferred_flow, submission.form_key, "portal_submission"),
      signerName: firstValue(submission.signed_name) || null,
      signedDate,
      filedDate,
      createdAt: submission.created_at || null,
      updatedAt: submission.updated_at || submission.created_at || null,
      fileUrl: text(primaryFiledDocument?.file_url) || text(workflow?.final_document_url) || text(workflow?.zoho?.sign_completed_document_url) || null,
      fileName: text(primaryFiledDocument?.file_name) || text(workflow?.final_document_name) || text(workflow?.zoho?.sign_completed_document_name) || null,
      launchUrl: text(workflow?.launch_url) || text(workflow?.zoho?.sign_embed_url) || text(workflow?.zoho?.forms_url) || null,
      visibleToUser:
        filedDocuments.find((document) => document.id === primaryFiledDocument?.id)?.visible_to_user ??
        null,
      summary: firstValue(workflow?.review_note, submission.form_title, submission.form_key ? titleize(submission.form_key) : null) || null,
      payload: submission.payload || null,
      portalFormData: submission.data || null,
      attachments: parseAttachmentReferences(submission.attachments),
      filedDocuments: filedDocuments.map((document) => ({
        id: document.id,
        label: firstValue(document.title, document.file_name, document.category, "Filed document"),
        fileName: text(document.file_name) || null,
        url: text(document.file_url) || null,
        createdAt: text(document.created_at) || null,
        signedAt: text(document.signed_at) || null,
        status: text(document.status) || null,
      })),
      workflow,
      timeline: buildTimeline({ submission, workflow, filedDate }),
      actionSupport: {
        canView: Boolean(text(primaryFiledDocument?.file_url) || text(workflow?.final_document_url) || text(workflow?.launch_url) || text(workflow?.zoho?.sign_embed_url) || text(workflow?.zoho?.forms_url)),
        canResend: Boolean(workflow?.package_key && buyer?.id),
        canOverride: true,
        canReplace: Boolean(buyer?.id),
        canMarkFiled: status !== "filed",
        canDownload: Boolean(text(primaryFiledDocument?.file_url) || text(workflow?.final_document_url) || text(workflow?.zoho?.sign_completed_document_url)),
        canOpenBuyer: Boolean(buyer?.id),
        canOpenPuppy: Boolean(puppy?.id),
      },
    };
  });

  const standaloneRecords = documents
    .filter((document) => !usedDocumentIds.has(document.id))
    .map((document) => {
      const buyer = resolveBuyerForDocument({ document, buyersById, buyersByUserId });
      const puppy = resolvePuppy({ submission: null, buyer, puppiesById, puppiesByBuyerId });
      const status = normalizeWorkspaceStatus(document.status);

      return {
        key: `document-${document.id}`,
        recordType: "document",
        submissionId: null,
        documentId: document.id,
        buyerId: buyer?.id || null,
        buyerName: firstValue(buyer?.full_name, buyer?.name, "Unlinked buyer"),
        buyerEmail: firstValue(buyer?.email) || null,
        buyerStatus: text(buyer?.status) || null,
        puppyId: puppy?.id || null,
        puppyName: firstValue(puppy?.call_name, puppy?.puppy_name, puppy?.name) || null,
        puppyStatus: text(puppy?.status) || null,
        documentType: firstValue(document.title, document.category, document.file_name, "Portal document"),
        status,
        statusLabel: formatWorkspaceStatus(status),
        source: firstValue(document.source_table, document.category, "portal_document"),
        signerName: null,
        signedDate: text(document.signed_at) || null,
        filedDate: status === "filed" ? document.updated_at || document.created_at || null : null,
        createdAt: document.created_at || null,
        updatedAt: document.updated_at || document.created_at || null,
        fileUrl: text(document.file_url) || null,
        fileName: text(document.file_name) || null,
        launchUrl: null,
        visibleToUser: document.visible_to_user ?? null,
        summary: firstValue(document.description, document.file_name) || null,
        payload: null,
        portalFormData: null,
        attachments: [],
        filedDocuments: [
          {
            id: document.id,
            label: firstValue(document.title, document.file_name, "Portal document"),
            fileName: text(document.file_name) || null,
            url: text(document.file_url) || null,
            createdAt: text(document.created_at) || null,
            signedAt: text(document.signed_at) || null,
            status: text(document.status) || null,
          },
        ],
        workflow: null,
        timeline: buildTimeline({ submission: null, workflow: null, filedDate: status === "filed" ? document.updated_at || document.created_at || null : null }),
        actionSupport: {
          canView: Boolean(text(document.file_url)),
          canResend: false,
          canOverride: true,
          canReplace: Boolean(buyer?.id),
          canMarkFiled: status !== "filed",
          canDownload: Boolean(text(document.file_url)),
          canOpenBuyer: Boolean(buyer?.id),
          canOpenPuppy: Boolean(puppy?.id),
        },
      };
    });

  return [...submissionRecords, ...standaloneRecords].sort((left, right) => {
    const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
    const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
}

export async function GET(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const service = createServiceSupabase();
    const records = await loadDocumentWorkspace(service);

    return NextResponse.json({
      ok: true,
      records,
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin buyer documents workspace error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not load the document workspace."),
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
    const action = text(body.action).toLowerCase();
    const recordType = text(body.record_type).toLowerCase();
    const submissionId = numberOrNull(body.submission_id);
    const documentId = text(body.document_id) || null;
    const buyerId = numberOrNull(body.buyer_id);
    const packageKey = text(body.package_key) || null;
    const note = text(body.note) || null;
    const requestedStatus = text(body.status) || null;
    const filedDocumentId = text(body.filed_document_id) || null;
    const service = createServiceSupabase();

    if (action === "archive_record") {
      if (recordType === "submission" && submissionId) {
        await updateSubmissionWorkflow({
          service,
          submissionId,
          status: "archived",
          workflowPatch: {
            package_status: "needs_review",
            review_note: note || "Archived from the admin document workspace.",
            last_synced_at: new Date().toISOString(),
          },
        });
      } else if (recordType === "document" && documentId) {
        const result = await service.from("portal_documents").update({ status: "archived" }).eq("id", documentId);
        if (result.error) throw result.error;
      } else {
        return NextResponse.json({ ok: false, error: "A submission or document is required." }, { status: 400 });
      }

      return NextResponse.json({ ok: true });
    }

    if (action === "mark_filed") {
      if (recordType === "submission" && submissionId) {
        let linkedDocument: PortalDocumentLookup | null = null;

        if (filedDocumentId) {
          const result = await service
            .from("portal_documents")
            .select(
              "id,user_id,buyer_id,title,description,category,status,created_at,updated_at,source_table,file_name,file_url,visible_to_user,signed_at"
            )
            .eq("id", filedDocumentId)
            .limit(1)
            .maybeSingle<PortalDocumentLookup>();

          if (result.error) throw result.error;
          linkedDocument = result.data || null;
        }

        await updateSubmissionWorkflow({
          service,
          submissionId,
          status: "submitted",
          workflowPatch: {
            package_status: "filed",
            filed_at: new Date().toISOString(),
            final_document_id: linkedDocument?.id || null,
            final_document_name: linkedDocument?.file_name || linkedDocument?.title || null,
            final_document_url: linkedDocument?.file_url || null,
            review_note: note || "Marked filed from the admin document workspace.",
            last_synced_at: new Date().toISOString(),
          },
        });
      } else if (recordType === "document" && documentId) {
        const result = await service.from("portal_documents").update({ status: "filed" }).eq("id", documentId);
        if (result.error) throw result.error;
      } else {
        return NextResponse.json({ ok: false, error: "A submission or document is required." }, { status: 400 });
      }

      return NextResponse.json({ ok: true });
    }

    if (action === "override_status") {
      if (recordType === "submission" && submissionId) {
        await updateSubmissionWorkflow({
          service,
          submissionId,
          status: requestedStatus === "archived" ? "archived" : "review",
          workflowPatch: {
            package_status:
              requestedStatus === "filed"
                ? "filed"
                : requestedStatus === "signed"
                  ? "signed"
                  : "needs_review",
            review_note: note || "Admin override applied from the document workspace.",
            last_synced_at: new Date().toISOString(),
          },
        });
      } else if (recordType === "document" && documentId) {
        const result = await service
          .from("portal_documents")
          .update({
            status: requestedStatus || "needs_review",
            description: note || undefined,
          })
          .eq("id", documentId);
        if (result.error) throw result.error;
      } else {
        return NextResponse.json({ ok: false, error: "A submission or document is required." }, { status: 400 });
      }

      return NextResponse.json({ ok: true });
    }

    if (action === "resend_package") {
      if (!buyerId || !packageKey) {
        return NextResponse.json(
          { ok: false, error: "A buyer and package key are required to resend." },
          { status: 400 }
        );
      }

      const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const result = await prepareChiChiDocumentPackage(service, {
        user: owner as User,
        canManageAnyBuyer: true,
        buyerId,
        packageKey: packageKey as
          | "deposit-agreement"
          | "bill-of-sale"
          | "health-guarantee"
          | "hypoglycemia-awareness"
          | "payment-plan-agreement"
          | "pickup-delivery-confirmation",
        rawMessage: "force resend this document package",
        origin,
      });

      return NextResponse.json({
        ok: true,
        launchUrl: result.launchUrl || null,
        packageKey: result.packageKey || null,
        detail: result.text,
      });
    }

    return NextResponse.json({ ok: false, error: "Unsupported document action." }, { status: 400 });
  } catch (error) {
    console.error("Admin buyer documents action error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not update the document record."),
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

    const formData = await req.formData();
    const buyerId = Number(formData.get("buyer_id") || 0);
    const file = formData.get("file");
    const packageId = firstValue(formData.get("package_id") as string | null) || null;
    const packageKey = firstValue(formData.get("package_key") as string | null) || null;
    const signedAt = firstValue(formData.get("signed_at") as string | null) || null;

    if (!buyerId) {
      return NextResponse.json(
        { ok: false, error: "A buyer id is required." },
        { status: 400 }
      );
    }

    if (!(file instanceof File) || !file.size) {
      return NextResponse.json(
        { ok: false, error: "Please choose a scanned form or document to upload." },
        { status: 400 }
      );
    }

    const service = createServiceSupabase();
    const buyerResult = await service
      .from("buyers")
      .select("id,user_id,full_name,name,email")
      .eq("id", buyerId)
      .limit(1)
      .maybeSingle<BuyerLookup>();

    if (buyerResult.error) throw buyerResult.error;
    if (!buyerResult.data) {
      return NextResponse.json(
        { ok: false, error: "Buyer not found." },
        { status: 404 }
      );
    }

    let targetSubmission: PackageSubmissionLookup | null = null;

    if (packageId) {
      const submissionResult = await service
        .from("portal_form_submissions")
        .select(
          "id,status,data,payload,user_id,user_email,email,form_key,form_title,version,signed_name,signed_date,signed_at,submitted_at,attachments,created_at,updated_at"
        )
        .order("updated_at", { ascending: false })
        .limit(250)
        .returns<PackageSubmissionLookup[]>();

      if (submissionResult.error) throw submissionResult.error;
      targetSubmission = findPackageTarget(submissionResult.data || [], packageId);
    }

    let resolvedUserId = String(buyerResult.data.user_id || "").trim();
    let pendingPortalLink = false;

    if (!resolvedUserId) {
      resolvedUserId = String(targetSubmission?.user_id || "").trim();
    }

    if (!resolvedUserId) {
      const authUsers = await listAllAuthUsers();
      const authByEmail = new Map(
        authUsers
          .map((authUser) => [normalizeEmail(authUser.email), authUser] as const)
          .filter(([email]) => !!email)
      );

      const candidateEmails = [
        normalizeEmail(buyerResult.data.email),
        normalizeEmail(targetSubmission?.user_email),
        normalizeEmail(targetSubmission?.email),
      ].filter(Boolean);

      for (const email of candidateEmails) {
        const match = authByEmail.get(email);
        if (match?.id) {
          resolvedUserId = match.id;
          break;
        }
      }
    }

    if (!resolvedUserId) {
      resolvedUserId = String(owner.id || "").trim();
      pendingPortalLink = Boolean(resolvedUserId);
    }

    if (!resolvedUserId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Could not resolve a valid document owner for this upload. Refresh and try again.",
        },
        { status: 409 }
      );
    }

    if (!pendingPortalLink && !buyerResult.data.user_id && resolvedUserId) {
      const updateBuyerLink = await service
        .from("buyers")
        .update({ user_id: resolvedUserId })
        .eq("id", buyerId);

      if (updateBuyerLink.error) {
        console.warn("Could not backfill buyer.user_id during document upload:", updateBuyerLink.error);
      }
    }

    await ensureDocumentBucket(service);

    const safeFileName = sanitizeFileName(file.name);
    const uploadPath = `buyers/${buyerId}/${Date.now()}-${safeFileName || "document"}`;
    const buffer = new Uint8Array(await file.arrayBuffer());
    const uploadResult = await service.storage.from(DOCUMENT_BUCKET).upload(uploadPath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
      cacheControl: "3600",
    });

    if (uploadResult.error) throw uploadResult.error;

    const publicUrl = service.storage.from(DOCUMENT_BUCKET).getPublicUrl(uploadPath).data
      .publicUrl;

    const title =
      firstValue(formData.get("title") as string | null) ||
      safeFileName ||
      `${firstValue(buyerResult.data.full_name, buyerResult.data.name, "Buyer")} document`;
    const description = firstValue(formData.get("description") as string | null) || null;
    const category = firstValue(formData.get("category") as string | null, "buyer_forms");
    const visibleToUser = parseBoolean(formData.get("visible_to_user"));
    const sourceTable = packageId
      ? buildChiChiDocumentPackageSource(packageId)
      : "buyers_admin_upload";

    const insertResult = await service
      .from("portal_documents")
      .insert({
        user_id: resolvedUserId,
        buyer_id: buyerId,
        title,
        description,
        category,
        status: "uploaded",
        source_table: sourceTable,
        file_url: publicUrl || null,
        file_name: file.name,
        visible_to_user: visibleToUser,
        signed_at: signedAt || null,
      })
      .select(
        "id,user_id,buyer_id,title,description,category,status,created_at,source_table,file_name,file_url,visible_to_user,signed_at"
      )
      .single();

    if (insertResult.error) throw insertResult.error;

    if (packageId && targetSubmission) {
      const payload = submissionPayload(targetSubmission) || {};
        const currentWorkflow =
          payload && typeof payload === "object" && payload.chi_chi_workflow && typeof payload.chi_chi_workflow === "object"
            ? (payload.chi_chi_workflow as ChiChiDocumentPackageWorkflow)
            : null;
        const nextWorkflow = mergeChiChiDocumentPackageWorkflow(
          currentWorkflow,
          {
            package_id: packageId,
            package_key: packageKey || String(currentWorkflow?.package_key || "").trim(),
            package_status: "filed",
            signed_at: signedAt || new Date().toISOString(),
            filed_at: new Date().toISOString(),
            final_document_id: String(insertResult.data.id),
            final_document_name: insertResult.data.file_name || file.name,
            final_document_url: insertResult.data.file_url || publicUrl || null,
          }
        );

        const nextPayload = attachChiChiWorkflowToPayload(
          (payload as Record<string, unknown>) || {},
          nextWorkflow
        );

        const updateSubmission = await service
          .from("portal_form_submissions")
          .update({
            data: nextPayload,
            payload: nextPayload,
            status: "submitted",
          })
          .eq("id", targetSubmission.id);

        if (updateSubmission.error) throw updateSubmission.error;
    }

    return NextResponse.json({
      ok: true,
      document: insertResult.data,
      pendingPortalLink,
      linkedPortalUserId: pendingPortalLink ? null : resolvedUserId,
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin buyer document upload error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not upload the buyer document."),
      },
      { status: 500 }
    );
  }
}
