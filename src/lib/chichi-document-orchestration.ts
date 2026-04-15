

import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

/* ===============================
   FORCE / RESEND DETECTION
================================= */
function isForceRequest(rawMessage: string | null | undefined) {
  const text = String(rawMessage || "").toLowerCase();

  return (
    text.includes("force") ||
    text.includes("resend") ||
    text.includes("send again") ||
    text.includes("override")
  );
}

/* ===============================
   TYPES
================================= */
type PackageContext = any;
type PreparedPackage = any;
type LaunchOptions = any;

/* ===============================
   CORE LAUNCH FUNCTION (FIXED)
================================= */
async function launchPreparedPackage(
  admin: SupabaseClient,
  context: PackageContext,
  item: PreparedPackage,
  launches: LaunchOptions,
  force?: boolean
) {
  let workflow = item.workflow;

  /* ===============================
     🔥 FORCE RESET LOGIC
  ================================= */
  if (force) {
    console.log("ChiChi FORCE MODE: resetting workflow for new send");

    workflow = {
      ...workflow,
      zoho: {
        ...(workflow.zoho || {}),
        sign_request_id: null,
        sign_request_status: null,
        sign_action_id: null,
        sign_document_id: null,
        sign_embed_url: null,
      },
      package_status: "prepared",
      signed_at: null,
      filed_at: null,
    };
  }

  /* ===============================
     ZOHO WRITER + SIGN FLOW
  ================================= */
  if (item.flow === "zoho_writer_sign") {
    if (!workflow.zoho?.sign_request_id || force) {
      console.log("ChiChi launching NEW Zoho Sign request");

      const zohoLaunch = await createZohoWriterSignRequest({
        packageKey: item.definition.key,
        filename: `${item.definition.key}-${Date.now()}.pdf`,
        mergeData: item.prefill,
        recipientEmail: context?.buyer?.email,
        recipientName: context?.buyer?.full_name,
        privateNotes: force
          ? "Force resend triggered by admin"
          : "Standard ChiChi send",
      });

      workflow = {
        ...workflow,
        zoho: {
          ...(workflow.zoho || {}),
          sign_request_id: zohoLaunch.signRequestId,
          sign_request_status: zohoLaunch.signRequestStatus,
          sign_action_id: zohoLaunch.signActionId,
          sign_document_id: zohoLaunch.signDocumentId,
          sign_embed_url: zohoLaunch.signEmbedUrl,
        },
        package_status: "sent_to_sign",
      };

      return {
        workflow,
        launchUrl: zohoLaunch.signEmbedUrl,
      };
    }
  }

  return {
    workflow,
    launchUrl: launches?.portalReviewUrl || null,
  };
}

/* ===============================
   PREPARE FUNCTION (FIXED)
================================= */
export async function prepareChiChiDocumentPackage(
  admin: SupabaseClient,
  params: any
) {
  const force = isForceRequest(params.rawMessage);

  const resolved = await resolvePackageContext(admin, params);

  if (!resolved.context) {
    return {
      text: "ChiChi could not resolve buyer context.",
    };
  }

  let item = buildPreparedPackage(
    params.definition,
    resolved.context,
    params.origin,
    params.canManageAnyBuyer
  );

  const launches = buildLaunchOptions(
    params.origin,
    params.definition,
    resolved.context.buyer,
    getPackageIntegrations(params.definition.key),
    params.canManageAnyBuyer
  );

  const effectiveItem =
    force && item.status.phase === "filed"
      ? {
          ...item,
          signedCopy: null,
          status: {
            ...item.status,
            phase: "prepared",
            label: "Prepared",
            detail: "Force resend triggered — ignoring previous signed document.",
            complete: false,
          },
        }
      : item;

  const launched = await launchPreparedPackage(
    admin,
    resolved.context,
    effectiveItem,
    launches,
    force
  );

  return {
    text: force
      ? `ChiChi forced a new ${item.definition.title}.\n\n${buildPreparedText(
          item,
          resolved.context,
          launches
        )}`
      : buildPreparedText(item, resolved.context, launches),

    launchUrl: launched.launchUrl,
    packageKey: item.definition.key,
  };
}

/* ===============================
   PLACEHOLDER FUNCTIONS
   (your existing functions remain unchanged)
================================= */
function buildPreparedPackage(...args: any[]) {
  return (globalThis as any).buildPreparedPackage(...args);
}

function buildLaunchOptions(...args: any[]) {
  return (globalThis as any).buildLaunchOptions(...args);
}

function getPackageIntegrations(...args: any[]) {
  return (globalThis as any).getPackageIntegrations(...args);
}

function buildPreparedText(...args: any[]) {
  return (globalThis as any).buildPreparedText(...args);
}

async function resolvePackageContext(...args: any[]) {
  return (globalThis as any).resolvePackageContext(...args);
}

async function createZohoWriterSignRequest(...args: any[]) {
  return (globalThis as any).createZohoWriterSignRequest(...args);
}