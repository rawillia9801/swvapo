import type { DocumentLikeFormSubmission } from "@/lib/portal-document-packet";

export const CHICHI_DOCUMENT_PACKAGE_STATUSES = [
  "prepared",
  "awaiting_buyer_input",
  "ready_for_signature",
  "sent_to_sign",
  "signed",
  "filed",
  "needs_review",
  "fallback_portal_flow",
] as const;

export const CHICHI_DOCUMENT_PACKAGE_FLOWS = [
  "zoho_writer_sign",
  "zoho_forms",
  "portal_fallback",
] as const;

export type ChiChiDocumentPackageStatus =
  (typeof CHICHI_DOCUMENT_PACKAGE_STATUSES)[number];

export type ChiChiDocumentPackageFlow =
  (typeof CHICHI_DOCUMENT_PACKAGE_FLOWS)[number];

export type ChiChiDocumentPackageWorkflow = {
  package_id: string;
  package_key: string;
  package_title?: string | null;
  buyer_id?: number | null;
  puppy_id?: number | null;
  user_id?: string | null;
  preferred_flow?: ChiChiDocumentPackageFlow | null;
  active_flow?: ChiChiDocumentPackageFlow | null;
  package_status?: ChiChiDocumentPackageStatus | null;
  launch_url?: string | null;
  prepared_at?: string | null;
  last_buyer_input_at?: string | null;
  sent_to_sign_at?: string | null;
  signed_at?: string | null;
  filed_at?: string | null;
  last_synced_at?: string | null;
  review_note?: string | null;
  final_document_id?: string | null;
  final_document_url?: string | null;
  final_document_name?: string | null;
  flow_detail?: string | null;
  zoho?: {
    forms_url?: string | null;
    writer_template_id?: string | null;
    writer_merge_report_url?: string | null;
    writer_merge_report_data_url?: string | null;
    writer_download_link?: string | null;
    sign_request_id?: string | null;
    sign_request_status?: string | null;
    sign_action_id?: string | null;
    sign_document_id?: string | null;
    sign_embed_url?: string | null;
    sign_completed_document_url?: string | null;
    sign_completed_document_name?: string | null;
    sign_webhook_event_id?: string | null;
    sign_webhook_event_type?: string | null;
    sign_last_event_at?: string | null;
  } | null;
};

type PortalDocumentLike = {
  id: string | number;
  source_table?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  signed_at?: string | null;
  created_at?: string | null;
  status?: string | null;
};

type ResolvePackageStatusInput = {
  workflow: ChiChiDocumentPackageWorkflow | null;
  submission?: Pick<DocumentLikeFormSubmission, "status" | "submitted_at" | "signed_at"> | null;
  signedCopy?: PortalDocumentLike | null;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeStatus(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isChiChiDocumentPackageStatus(
  value: unknown
): value is ChiChiDocumentPackageStatus {
  return CHICHI_DOCUMENT_PACKAGE_STATUSES.includes(
    normalizeStatus(value) as ChiChiDocumentPackageStatus
  );
}

export function isChiChiDocumentPackageFlow(
  value: unknown
): value is ChiChiDocumentPackageFlow {
  return CHICHI_DOCUMENT_PACKAGE_FLOWS.includes(
    normalizeStatus(value) as ChiChiDocumentPackageFlow
  );
}

export function buildChiChiDocumentPackageId(params: {
  packageKey: string;
  buyerId?: number | null;
  userId?: string | null;
}) {
  const packageKey = normalizeStatus(params.packageKey).replace(/[^a-z0-9-]+/g, "-");
  const buyerId = Number(params.buyerId || 0);
  if (buyerId > 0) {
    return `buyer:${buyerId}:${packageKey}`;
  }

  const userId = normalizeText(params.userId).replace(/[^a-zA-Z0-9_-]+/g, "-");
  if (userId) {
    return `user:${userId}:${packageKey}`;
  }

  return `package:${packageKey}`;
}

export function buildChiChiDocumentPackageSource(packageId: string) {
  return `chichi_document_package:${normalizeText(packageId)}`;
}

export function extractChiChiDocumentPackageWorkflow(
  submission:
    | Pick<DocumentLikeFormSubmission, "payload" | "data">
    | null
    | undefined
): ChiChiDocumentPackageWorkflow | null {
  const payload = isObject(submission?.payload)
    ? submission?.payload
    : isObject(submission?.data)
      ? submission?.data
      : null;

  if (!payload) return null;
  const rawWorkflow = payload.chi_chi_workflow;
  if (!isObject(rawWorkflow)) return null;

  const workflow: ChiChiDocumentPackageWorkflow = {
    package_id: normalizeText(rawWorkflow.package_id),
    package_key: normalizeText(rawWorkflow.package_key),
    package_title: normalizeText(rawWorkflow.package_title) || null,
    buyer_id:
      Number(rawWorkflow.buyer_id || 0) > 0 ? Number(rawWorkflow.buyer_id) : null,
    puppy_id:
      Number(rawWorkflow.puppy_id || 0) > 0 ? Number(rawWorkflow.puppy_id) : null,
    user_id: normalizeText(rawWorkflow.user_id) || null,
    preferred_flow: isChiChiDocumentPackageFlow(rawWorkflow.preferred_flow)
      ? rawWorkflow.preferred_flow
      : null,
    active_flow: isChiChiDocumentPackageFlow(rawWorkflow.active_flow)
      ? rawWorkflow.active_flow
      : null,
    package_status: isChiChiDocumentPackageStatus(rawWorkflow.package_status)
      ? rawWorkflow.package_status
      : null,
    launch_url: normalizeText(rawWorkflow.launch_url) || null,
    prepared_at: normalizeText(rawWorkflow.prepared_at) || null,
    last_buyer_input_at: normalizeText(rawWorkflow.last_buyer_input_at) || null,
    sent_to_sign_at: normalizeText(rawWorkflow.sent_to_sign_at) || null,
    signed_at: normalizeText(rawWorkflow.signed_at) || null,
    filed_at: normalizeText(rawWorkflow.filed_at) || null,
    last_synced_at: normalizeText(rawWorkflow.last_synced_at) || null,
    review_note: normalizeText(rawWorkflow.review_note) || null,
    final_document_id: normalizeText(rawWorkflow.final_document_id) || null,
    final_document_url: normalizeText(rawWorkflow.final_document_url) || null,
    final_document_name: normalizeText(rawWorkflow.final_document_name) || null,
    flow_detail: normalizeText(rawWorkflow.flow_detail) || null,
    zoho: isObject(rawWorkflow.zoho)
      ? {
          forms_url: normalizeText(rawWorkflow.zoho.forms_url) || null,
          writer_template_id:
            normalizeText(rawWorkflow.zoho.writer_template_id) || null,
          writer_merge_report_url:
            normalizeText(rawWorkflow.zoho.writer_merge_report_url) || null,
          writer_merge_report_data_url:
            normalizeText(rawWorkflow.zoho.writer_merge_report_data_url) || null,
          writer_download_link:
            normalizeText(rawWorkflow.zoho.writer_download_link) || null,
          sign_request_id: normalizeText(rawWorkflow.zoho.sign_request_id) || null,
          sign_request_status:
            normalizeText(rawWorkflow.zoho.sign_request_status) || null,
          sign_action_id: normalizeText(rawWorkflow.zoho.sign_action_id) || null,
          sign_document_id:
            normalizeText(rawWorkflow.zoho.sign_document_id) || null,
          sign_embed_url: normalizeText(rawWorkflow.zoho.sign_embed_url) || null,
          sign_completed_document_url:
            normalizeText(rawWorkflow.zoho.sign_completed_document_url) || null,
          sign_completed_document_name:
            normalizeText(rawWorkflow.zoho.sign_completed_document_name) || null,
          sign_webhook_event_id:
            normalizeText(rawWorkflow.zoho.sign_webhook_event_id) || null,
          sign_webhook_event_type:
            normalizeText(rawWorkflow.zoho.sign_webhook_event_type) || null,
          sign_last_event_at:
            normalizeText(rawWorkflow.zoho.sign_last_event_at) || null,
        }
      : null,
  };

  return workflow.package_id && workflow.package_key ? workflow : null;
}

export function mergeChiChiDocumentPackageWorkflow(
  current: ChiChiDocumentPackageWorkflow | null | undefined,
  patch: Partial<ChiChiDocumentPackageWorkflow>
): ChiChiDocumentPackageWorkflow {
  const base = current || {
    package_id: normalizeText(patch.package_id),
    package_key: normalizeText(patch.package_key),
  };

  return {
    ...base,
    ...patch,
    package_id: normalizeText(patch.package_id ?? base.package_id),
    package_key: normalizeText(patch.package_key ?? base.package_key),
    zoho:
      patch.zoho || base.zoho
        ? {
            ...(base.zoho || {}),
            ...(patch.zoho || {}),
          }
        : null,
  };
}

export function attachChiChiWorkflowToPayload(
  payload: Record<string, unknown> | null | undefined,
  workflow: ChiChiDocumentPackageWorkflow
) {
  return {
    ...(isObject(payload) ? payload : {}),
    chi_chi_workflow: workflow,
  };
}

export function findChiChiPackageDocument(
  packageId: string,
  documents: PortalDocumentLike[]
) {
  const source = buildChiChiDocumentPackageSource(packageId);
  return (
    documents
      .filter((document) => normalizeText(document.source_table) === source)
      .sort((left, right) => {
        const leftTime = new Date(
          left.signed_at || left.created_at || 0
        ).getTime();
        const rightTime = new Date(
          right.signed_at || right.created_at || 0
        ).getTime();
        return rightTime - leftTime;
      })[0] || null
  );
}

export function resolveChiChiDocumentPackageStatus({
  workflow,
  submission,
  signedCopy,
}: ResolvePackageStatusInput): ChiChiDocumentPackageStatus {
  const workflowStatus = workflow?.package_status;
  const signRequestStatus = normalizeStatus(workflow?.zoho?.sign_request_status);
  const submissionStatus = normalizeStatus(submission?.status);

  if (signedCopy || workflow?.filed_at || workflow?.final_document_url) {
    return "filed";
  }

  if (
    workflow?.signed_at ||
    submission?.signed_at ||
    signRequestStatus === "completed" ||
    signRequestStatus === "signed"
  ) {
    return "signed";
  }

  if (
    signRequestStatus.includes("declined") ||
    signRequestStatus.includes("expired") ||
    signRequestStatus.includes("recalled")
  ) {
    return "needs_review";
  }

  if (workflow?.zoho?.sign_request_id) {
    return "sent_to_sign";
  }

  if (workflow?.active_flow === "zoho_forms") {
    return "awaiting_buyer_input";
  }

  if (
    submission?.submitted_at ||
    submissionStatus === "submitted" ||
    submissionStatus === "review"
  ) {
    return "ready_for_signature";
  }

  if (workflow?.active_flow === "portal_fallback") {
    return "fallback_portal_flow";
  }

  if (workflowStatus && workflowStatus !== "prepared") {
    return workflowStatus;
  }

  return "prepared";
}

export function formatChiChiDocumentPackageStatus(
  status: ChiChiDocumentPackageStatus
) {
  switch (status) {
    case "prepared":
      return "Prepared";
    case "awaiting_buyer_input":
      return "Awaiting Buyer Input";
    case "ready_for_signature":
      return "Ready for Signature";
    case "sent_to_sign":
      return "Sent to Sign";
    case "signed":
      return "Signed";
    case "filed":
      return "Filed";
    case "needs_review":
      return "Needs Review";
    case "fallback_portal_flow":
      return "Fallback Portal Flow";
    default:
      return "Prepared";
  }
}
