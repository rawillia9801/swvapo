import { NextResponse } from "next/server";
import {
  createServiceSupabase,
  describeRouteError,
  firstValue,
  verifyOwner,
} from "@/lib/admin-api";

export const runtime = "nodejs";

const DOCUMENT_BUCKET = "portal-documents";

type BuyerLookup = {
  id: number;
  user_id?: string | null;
  full_name?: string | null;
  name?: string | null;
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

export async function POST(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const buyerId = Number(formData.get("buyer_id") || 0);
    const file = formData.get("file");

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
      .select("id,user_id,full_name,name")
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

    const insertResult = await service
      .from("portal_documents")
      .insert({
        user_id: buyerResult.data.user_id || null,
        buyer_id: buyerId,
        title,
        description,
        category,
        status: "uploaded",
        source_table: "buyers_admin_upload",
        file_url: publicUrl || null,
        file_name: file.name,
        visible_to_user: visibleToUser,
      })
      .select(
        "id,user_id,buyer_id,title,description,category,status,created_at,source_table,file_name,file_url,visible_to_user,signed_at"
      )
      .single();

    if (insertResult.error) throw insertResult.error;

    return NextResponse.json({
      ok: true,
      document: insertResult.data,
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
