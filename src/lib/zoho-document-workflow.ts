import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export type ZohoDocumentFlow = "zoho_writer_sign" | "zoho_forms" | "portal_fallback";

export type ZohoDocumentPackageIntegrations = {
  formsUrl: string | null;
  writerTemplateId: string | null;
  writerTemplateUrl: string | null;
  signUrl: string | null;
  signOrgId: string | null;
  signRequestTypeId: string | null;
  flow: ZohoDocumentFlow;
  zohoReady: boolean;
};

export type ZohoWriterSignLaunchResult = {
  signRequestId: string | null;
  signRequestStatus: string | null;
  signActionId: string | null;
  signDocumentId: string | null;
  signEmbedUrl: string | null;
  writerMergeReportUrl: string | null;
  writerMergeReportDataUrl: string | null;
  writerDownloadLink: string | null;
};

export type ZohoSignRequestDetails = {
  requestId: string;
  requestStatus: string | null;
  requestName: string | null;
  actionId: string | null;
  recipientEmail: string | null;
  recipientName: string | null;
  documentId: string | null;
  documentName: string | null;
  raw: Record<string, unknown> | null;
};

export type ZohoWriterMergeData = Record<string, unknown>;

type ZohoTokenCache = {
  accessToken: string;
  expiresAt: number;
};

type SellerProfile = {
  businessName: string;
  sellerName: string;
  sellerAddress: string;
  sellerPhone: string;
  sellerEmail: string;
  sellerWebsite: string;
};

let tokenCache: ZohoTokenCache | null = null;

function readOptionalEnv(...names: string[]) {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) return value;
  }
  return "";
}

function trimTrailingSlash(value: string) {
  return String(value || "").replace(/\/+$/g, "");
}

function parseJson<T>(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;

  try {
    return JSON.parse(normalized) as T;
  } catch {
    return null;
  }
}

function packageStem(packageKey: string) {
  return String(packageKey || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function normalizeString(value: unknown) {
  return String(value ?? "").trim();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildApiBaseUrl(base: string, suffix: string) {
  const trimmed = trimTrailingSlash(base);
  if (!trimmed) return "";
  return `${trimmed}${suffix.startsWith("/") ? suffix : `/${suffix}`}`;
}

function pickFirst(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (normalizeString(value)) return value;
  }
  return "";
}

function pickNumber(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const raw = source[key];
    if (raw === null || raw === undefined || raw === "") continue;
    const numeric =
      typeof raw === "number"
        ? raw
        : Number(String(raw).replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function buildDateString(value: unknown, includeTime = false) {
  const text = normalizeString(value);
  if (!text) return "";

  const date = value instanceof Date ? value : new Date(text);
  if (Number.isNaN(date.getTime())) return text;

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const day = String(date.getDate()).padStart(2, "0");
  const month = months[date.getMonth()];
  const year = String(date.getFullYear());

  if (!includeTime) {
    return `${day}-${month}-${year}`;
  }

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const meridiem = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;

  return `${day}-${month}-${year} ${String(hours).padStart(2, "0")}:${minutes} ${meridiem}`;
}

function buildAddressLine(source: Record<string, unknown>) {
  const direct = pickFirst(
    source,
    "buyer_address",
    "applicant_address",
    "address",
    "street_address",
    "address_1"
  );
  if (direct) return normalizeString(direct);

  const street = pickFirst(source, "street_address", "address_1", "buyer_address_1");
  const city = pickFirst(source, "city", "buyer_city");
  const state = pickFirst(source, "state", "buyer_state");
  const zip = pickFirst(source, "zip", "zip_code", "zipcode", "buyer_zip");

  const cityStateZip = [city, state, zip].filter((part) => normalizeString(part)).join(", ");
  return [street, cityStateZip].filter((part) => normalizeString(part)).join(", ");
}

function buildSellerProfile(source: Record<string, unknown>): SellerProfile {
  return {
    businessName:
      normalizeString(
        pickFirst(
          source,
          "seller_business_name",
          "business_name"
        )
      ) ||
      readOptionalEnv(
        "CHICHI_SELLER_BUSINESS_NAME",
        "SELLER_BUSINESS_NAME",
        "NEXT_PUBLIC_BUSINESS_NAME"
      ) ||
      "Southwest Virginia Chihuahua",
    sellerName:
      normalizeString(pickFirst(source, "seller_name")) ||
      readOptionalEnv("CHICHI_SELLER_NAME", "SELLER_NAME", "NEXT_PUBLIC_SELLER_NAME"),
    sellerAddress:
      normalizeString(pickFirst(source, "seller_address")) ||
      readOptionalEnv("CHICHI_SELLER_ADDRESS", "SELLER_ADDRESS", "NEXT_PUBLIC_SELLER_ADDRESS"),
    sellerPhone:
      normalizeString(pickFirst(source, "seller_phone")) ||
      readOptionalEnv("CHICHI_SELLER_PHONE", "SELLER_PHONE", "NEXT_PUBLIC_SELLER_PHONE"),
    sellerEmail:
      normalizeString(pickFirst(source, "seller_email")) ||
      readOptionalEnv("CHICHI_SELLER_EMAIL", "SELLER_EMAIL", "NEXT_PUBLIC_SELLER_EMAIL"),
    sellerWebsite:
      normalizeString(pickFirst(source, "seller_website")) ||
      readOptionalEnv("CHICHI_SELLER_WEBSITE", "SELLER_WEBSITE", "NEXT_PUBLIC_SITE_URL") ||
      "https://swvachihuahua.com",
  };
}

function buildDepositAgreementMergeData(source: Record<string, unknown>): ZohoWriterMergeData {
  const seller = buildSellerProfile(source);

  const agreementDate =
    buildDateString(pickFirst(source, "agreement_date", "sale_date", "application_date", "created_at")) ||
    buildDateString(new Date());

  const packageId = normalizeString(
    pickFirst(source, "package_id", "packageId", "workflow_package_id")
  );

  const portalRecordId = normalizeString(
    pickFirst(source, "portal_record_id", "portalRecordId", "submission_id", "id")
  );

  const buyerFullName = normalizeString(
    pickFirst(source, "buyer_full_name", "full_name", "buyer_name", "name", "applicant_full_name")
  );

  const buyerAddress = buildAddressLine(source);

  const buyerPhone = normalizeString(
    pickFirst(source, "buyer_phone", "phone", "applicant_phone")
  );

  const buyerEmail = normalizeString(
    pickFirst(source, "buyer_email", "email", "user_email", "applicant_email")
  );

  const puppyCallName = normalizeString(
    pickFirst(source, "puppy_call_name", "puppy_name", "call_name", "name")
  );

  const puppyRegisteredName = normalizeString(
    pickFirst(source, "puppy_registered_name", "registered_name")
  );

  const puppyDob = buildDateString(pickFirst(source, "puppy_dob", "dob"));

  const puppySex = normalizeString(
    pickFirst(source, "puppy_sex", "sex")
  );

  const puppyColor = normalizeString(
    pickFirst(source, "puppy_color", "color")
  );

  const puppyCoatType = normalizeString(
    pickFirst(source, "puppy_coat_type", "coat_type")
  );

  const puppyRegistry = normalizeString(
    pickFirst(source, "puppy_registry", "registry")
  );

  const depositAmount =
    pickNumber(source, "deposit_amount", "deposit", "deposit_paid_amount") ?? 250;

  const estimatedPurchasePrice =
    pickNumber(source, "estimated_purchase_price", "purchase_price", "sale_price", "price", "list_price") ??
    null;

  const taxRate =
    pickNumber(source, "sales_tax_rate", "tax_rate") ?? 0.053;

  const estimatedTax =
    pickNumber(source, "estimated_tax", "sales_tax", "tax_amount") ??
    (estimatedPurchasePrice !== null ? roundMoney(estimatedPurchasePrice * taxRate) : null);

  const estimatedDeliveryFee =
    pickNumber(source, "estimated_delivery_fee", "delivery_fee", "transport_fee", "delivery_charge") ?? 0;

  const estimatedBalanceDue =
    pickNumber(source, "estimated_balance_due", "balance_due") ??
    (estimatedPurchasePrice !== null
      ? roundMoney(
          estimatedPurchasePrice +
            (estimatedTax ?? 0) +
            estimatedDeliveryFee -
            depositAmount
        )
      : null);

  const reservationType =
    normalizeString(pickFirst(source, "reservation_type")) ||
    (puppyCallName ? "Specific puppy reservation" : "Future litter reservation");

  const interestType =
    normalizeString(pickFirst(source, "interest_type")) ||
    (puppyCallName ? "Current Puppy" : "Future Puppy");

  return {
    ...source,
    agreement_date: agreementDate,
    package_id: packageId,
    portal_record_id: portalRecordId,

    seller_business_name: seller.businessName,
    seller_name: seller.sellerName,
    seller_address: seller.sellerAddress,
    seller_phone: seller.sellerPhone,
    seller_email: seller.sellerEmail,
    seller_website: seller.sellerWebsite,

    buyer_full_name: buyerFullName,
    buyer_address: buyerAddress,
    buyer_phone: buyerPhone,
    buyer_email: buyerEmail,

    puppy_call_name: puppyCallName,
    puppy_registered_name: puppyRegisteredName,
    puppy_dob: puppyDob,
    puppy_sex: puppySex,
    puppy_color: puppyColor,
    puppy_coat_type: puppyCoatType,
    puppy_registry: puppyRegistry,

    reservation_type: reservationType,
    interest_type: interestType,

    deposit_amount: depositAmount,
    deposit_paid_date: buildDateString(
      pickFirst(source, "deposit_paid_date", "deposit_date", "submitted_at", "created_at")
    ),
    deposit_payment_method: normalizeString(
      pickFirst(source, "deposit_payment_method", "payment_preference", "payment_method")
    ),

    estimated_purchase_price: estimatedPurchasePrice ?? "",
    estimated_tax: estimatedTax ?? "",
    estimated_delivery_fee: estimatedDeliveryFee ?? "",
    estimated_balance_due: estimatedBalanceDue ?? "",

    vet_exam_window:
      normalizeString(pickFirst(source, "vet_exam_window")) || "10 days",

    seller_signature: normalizeString(pickFirst(source, "seller_signature")),
    seller_signed_at: buildDateString(pickFirst(source, "seller_signed_at"), true),
    buyer_signature: normalizeString(pickFirst(source, "buyer_signature")),
    buyer_signed_at: buildDateString(pickFirst(source, "buyer_signed_at"), true),
  };
}

export function buildZohoWriterMergeData(
  packageKey: string,
  mergeData: Record<string, unknown>
): ZohoWriterMergeData {
  switch (String(packageKey || "").trim()) {
    case "deposit-agreement":
      return buildDepositAgreementMergeData(mergeData);
    default:
      return mergeData;
  }
}

function getZohoDocumentConfig() {
  const clientId = readOptionalEnv(
    "ZOHO_CLIENT_ID",
    "ZOHO_DOCUMENTS_CLIENT_ID",
    "ZOHO_SIGN_CLIENT_ID",
    "ZOHO_WRITER_CLIENT_ID"
  );

  const clientSecret = readOptionalEnv(
    "ZOHO_CLIENT_SECRET",
    "ZOHO_DOCUMENTS_CLIENT_SECRET",
    "ZOHO_SIGN_CLIENT_SECRET",
    "ZOHO_WRITER_CLIENT_SECRET"
  );

  const refreshToken = readOptionalEnv(
    "ZOHO_REFRESH_TOKEN",
    "ZOHO_DOCUMENTS_REFRESH_TOKEN",
    "ZOHO_SIGN_REFRESH_TOKEN",
    "ZOHO_WRITER_REFRESH_TOKEN"
  );

  const accountsBaseUrl = trimTrailingSlash(
    readOptionalEnv(
      "ZOHO_ACCOUNTS_DOMAIN",
      "ZOHO_DOCUMENTS_ACCOUNTS_BASE_URL",
      "ZOHO_SIGN_ACCOUNTS_BASE_URL",
      "ZOHO_WRITER_ACCOUNTS_BASE_URL"
    ) || "https://accounts.zoho.com"
  );

  const genericApiDomain = trimTrailingSlash(
    readOptionalEnv("ZOHO_API_DOMAIN") || "https://www.zohoapis.com"
  );

  const writerApiBaseUrl = trimTrailingSlash(
    readOptionalEnv("ZOHO_WRITER_API_BASE_URL") ||
      buildApiBaseUrl(genericApiDomain, "/writer/api/v1") ||
      "https://www.zohoapis.com/writer/api/v1"
  );

  const signApiBaseUrl = trimTrailingSlash(
    readOptionalEnv("ZOHO_SIGN_API_BASE_URL") || "https://sign.zoho.com/api/v1"
  );

  return {
    clientId,
    clientSecret,
    refreshToken,
    accountsBaseUrl,
    writerApiBaseUrl,
    signApiBaseUrl,
    signOrgId: readOptionalEnv("CHICHI_ZOHO_SIGN_ORG_ID", "ZOHO_SIGN_ORG_ID") || null,
    signWebhookSecret:
      readOptionalEnv(
        "CHICHI_ZOHO_SIGN_WEBHOOK_SECRET",
        "ZOHO_SIGN_WEBHOOK_SECRET"
      ) || null,
    testMode:
      readOptionalEnv(
        "CHICHI_ZOHO_DOCUMENTS_TEST_MODE",
        "ZOHO_DOCUMENTS_TEST_MODE",
        "ZOHO_TEST_MODE"
      ).toLowerCase() === "true",
  };
}

export function getZohoDocumentPackageIntegrations(
  packageKey: string
): ZohoDocumentPackageIntegrations {
  const stem = packageStem(packageKey);
  const config = getZohoDocumentConfig();

  const formsUrl =
    readOptionalEnv(`CHICHI_ZOHO_FORMS_${stem}_URL`, `ZOHO_FORMS_${stem}_URL`) || null;

  const writerTemplateId =
    readOptionalEnv(
      `CHICHI_ZOHO_WRITER_${stem}_TEMPLATE_ID`,
      `ZOHO_WRITER_${stem}_TEMPLATE_ID`
    ) || null;

  const writerTemplateUrl =
    readOptionalEnv(
      `CHICHI_ZOHO_WRITER_${stem}_URL`,
      `ZOHO_WRITER_${stem}_URL`
    ) || null;

  const signUrl =
    readOptionalEnv(`CHICHI_ZOHO_SIGN_${stem}_URL`, `ZOHO_SIGN_${stem}_URL`) || null;

  const signRequestTypeId =
    readOptionalEnv(
      `CHICHI_ZOHO_SIGN_${stem}_REQUEST_TYPE_ID`,
      `ZOHO_SIGN_${stem}_REQUEST_TYPE_ID`
    ) || null;

  const oauthReady = Boolean(
    config.clientId && config.clientSecret && config.refreshToken
  );

  const writerSignReady = Boolean(
    oauthReady && writerTemplateId && config.signOrgId
  );

  return {
    formsUrl,
    writerTemplateId,
    writerTemplateUrl,
    signUrl,
    signOrgId: config.signOrgId,
    signRequestTypeId,
    flow: writerSignReady ? "zoho_writer_sign" : formsUrl ? "zoho_forms" : "portal_fallback",
    zohoReady: writerSignReady || Boolean(formsUrl),
  };
}

function hasFreshCachedToken() {
  if (!tokenCache?.accessToken) return false;
  return tokenCache.expiresAt - 60_000 > Date.now();
}

async function getZohoDocumentsAccessToken() {
  if (hasFreshCachedToken()) {
    return tokenCache!.accessToken;
  }

  const config = getZohoDocumentConfig();

  if (!(config.clientId && config.clientSecret && config.refreshToken)) {
    throw new Error(
      "Zoho document workflow is not configured. Add Zoho OAuth credentials first."
    );
  }

  const body = new URLSearchParams({
    refresh_token: config.refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
  });

  const response = await fetch(`${config.accountsBaseUrl}/oauth/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  const text = await response.text();
  const payload = parseJson<{
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  }>(text);

  if (!response.ok || !payload?.access_token) {
    const detail = payload?.error_description || payload?.error || text || "Unknown error";
    throw new Error(`Zoho document OAuth refresh failed: ${detail}`);
  }

  tokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Number(payload.expires_in || 3600) * 1000,
  };

  return payload.access_token;
}

async function zohoWriterRequest(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: BodyInit | null;
    headers?: Record<string, string>;
  } = {}
) {
  const config = getZohoDocumentConfig();
  const accessToken = await getZohoDocumentsAccessToken();

  const url = path.startsWith("http")
    ? path
    : `${config.writerApiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  return fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      ...(options.headers || {}),
    },
    body: options.body,
    cache: "no-store",
  });
}

async function zohoSignRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
  } = {}
) {
  const config = getZohoDocumentConfig();
  const accessToken = await getZohoDocumentsAccessToken();
  const url = `${config.signApiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const text = await response.text();
  const payload = parseJson<T & { code?: number; message?: string }>(text);

  if (!response.ok || !payload || (typeof payload.code === "number" && payload.code !== 0)) {
    const detail = payload?.message || text || "Unknown Zoho Sign error.";
    throw new Error(`Zoho Sign request failed: ${detail}`);
  }

  return payload;
}

function extractWriterSignLaunchResult(payload: Record<string, unknown> | null) {
  const record = Array.isArray(payload?.records)
    ? payload.records.find((entry) => isObject(entry))
    : null;

  const firstRecord = isObject(record) ? record : null;

  return {
    signRequestId:
      normalizeString(firstRecord?.sign_request_id || payload?.sign_request_id) || null,
    writerMergeReportUrl:
      normalizeString(firstRecord?.merge_report_url || payload?.merge_report_url) || null,
    writerMergeReportDataUrl:
      normalizeString(firstRecord?.merge_report_data_url || payload?.merge_report_data_url) || null,
    writerDownloadLink:
      normalizeString(firstRecord?.download_link || payload?.download_link) || null,
  };
}

export async function createZohoWriterSignRequest(params: {
  packageKey: string;
  filename: string;
  mergeData: Record<string, unknown>;
  recipientEmail: string;
  recipientName: string;
  privateNotes?: string | null;
}) {
  const integrations = getZohoDocumentPackageIntegrations(params.packageKey);

  if (!(integrations.writerTemplateId && integrations.signOrgId)) {
    throw new Error("Zoho Writer/Sign is not configured for this document package.");
  }

  const preparedMergeData = buildZohoWriterMergeData(
    params.packageKey,
    params.mergeData
  );

  const config = getZohoDocumentConfig();
  const formData = new FormData();

  formData.set("service_name", "zohosign");
  formData.set("filename", params.filename);
  formData.set("merge_data", JSON.stringify({ data: [preparedMergeData] }));
  formData.set(
    "signer_data",
    JSON.stringify([
      {
        recipient_1: params.recipientEmail,
        recipient_name: params.recipientName,
        action_type: "sign",
        language: "en",
        ...(params.privateNotes ? { private_notes: params.privateNotes } : {}),
      },
    ])
  );
  formData.set("sign_org_id", integrations.signOrgId);

  if (integrations.signRequestTypeId) {
    formData.set("sign_request_type_id", integrations.signRequestTypeId);
  }

  if (config.testMode) {
    formData.set("test_mode", "true");
  }

  const response = await zohoWriterRequest(
    `/documents/${integrations.writerTemplateId}/merge/sign`,
    { method: "POST", body: formData }
  );

  const text = await response.text();
  const payload = parseJson<Record<string, unknown>>(text);

  if (!response.ok || !payload) {
    throw new Error(
      `Zoho Writer merge/sign failed: ${text || "Unknown Zoho Writer error."}`
    );
  }

  const launch = extractWriterSignLaunchResult(payload);

  if (!launch.signRequestId) {
    throw new Error("Zoho Writer merge/sign did not return a sign request id.");
  }

  const details = await getZohoSignRequestDetails(launch.signRequestId);

  return {
    signRequestId: launch.signRequestId,
    signRequestStatus: details.requestStatus,
    signActionId: details.actionId,
    signDocumentId: details.documentId,
    signEmbedUrl: null,
    writerMergeReportUrl: launch.writerMergeReportUrl,
    writerMergeReportDataUrl: launch.writerMergeReportDataUrl,
    writerDownloadLink: launch.writerDownloadLink,
  } satisfies ZohoWriterSignLaunchResult;
}

export async function getZohoSignRequestDetails(
  requestId: string
): Promise<ZohoSignRequestDetails> {
  const payload = await zohoSignRequest<{ requests?: Record<string, unknown> }>(
    `/requests/${requestId}`
  );

  const request = isObject(payload.requests) ? payload.requests : {};
  const actions = Array.isArray(request.actions)
    ? request.actions.filter((entry) => isObject(entry))
    : [];
  const documents = Array.isArray(request.document_ids)
    ? request.document_ids.filter((entry) => isObject(entry))
    : [];
  const firstAction = actions[0] || null;
  const firstDocument = documents[0] || null;

  return {
    requestId: normalizeString(request.request_id || requestId),
    requestStatus: normalizeString(request.request_status) || null,
    requestName: normalizeString(request.request_name) || null,
    actionId: normalizeString(firstAction?.action_id) || null,
    recipientEmail:
      normalizeString(firstAction?.recipient_email || firstAction?.recipient_name_email) || null,
    recipientName: normalizeString(firstAction?.recipient_name) || null,
    documentId: normalizeString(firstDocument?.document_id) || null,
    documentName: normalizeString(firstDocument?.document_name) || null,
    raw: request,
  };
}

export async function downloadZohoSignCompletedDocument(params: {
  requestId: string;
  documentId?: string | null;
}) {
  const config = getZohoDocumentConfig();
  const accessToken = await getZohoDocumentsAccessToken();

  const targetPath = params.documentId
    ? `/requests/${params.requestId}/documents/${params.documentId}/pdf`
    : `/requests/${params.requestId}/pdf`;

  const response = await fetch(`${config.signApiBaseUrl}${targetPath}`, {
    method: "GET",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Zoho Sign download failed: ${text || "Could not fetch the signed document."}`
    );
  }

  return {
    buffer: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "application/pdf",
    fileName:
      normalizeString(response.headers.get("x-file-name")) ||
      normalizeString(response.headers.get("content-disposition")) ||
      null,
  };
}

export function verifyZohoSignWebhookSignature(params: {
  rawBody: string;
  signatureHeader: string | null | undefined;
}) {
  const secret = getZohoDocumentConfig().signWebhookSecret;
  if (!secret) return true;

  const provided = Buffer.from(normalizeString(params.signatureHeader));
  if (!provided.length) return false;

  const expected = Buffer.from(
    createHmac("sha256", secret).update(params.rawBody).digest("base64")
  );

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}

export function extractZohoSignWebhookRequestId(payload: Record<string, unknown> | null) {
  if (!payload) return "";

  const requests = isObject(payload.requests) ? payload.requests : null;
  const notifications = isObject(payload.notifications)
    ? payload.notifications
    : null;

  return (
    normalizeString(
      payload.request_id ||
        payload.document_id ||
        requests?.request_id ||
        notifications?.request_id ||
        notifications?.document_id
    ) || ""
  );
}

export function extractZohoSignWebhookEventType(payload: Record<string, unknown> | null) {
  if (!payload) return "";

  const notifications = isObject(payload.notifications)
    ? payload.notifications
    : null;

  return (
    normalizeString(
      notifications?.operation_type ||
        payload.operation_type ||
        payload.event_type ||
        payload.status
    ) || ""
  );
}