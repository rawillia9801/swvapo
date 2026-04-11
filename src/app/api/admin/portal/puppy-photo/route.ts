import { NextResponse } from "next/server";
import {
  createServiceSupabase,
  describeRouteError,
  verifyOwner,
} from "@/lib/admin-api";

export const runtime = "nodejs";

const PUPPY_IMAGE_BUCKET = "puppy-images";

function sanitizeFileName(value: string) {
  return String(value || "puppy-photo")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(-120);
}

async function ensureImageBucket(service: ReturnType<typeof createServiceSupabase>) {
  const current = await service.storage.getBucket(PUPPY_IMAGE_BUCKET);
  if (!current.error) return;

  const createResult = await service.storage.createBucket(PUPPY_IMAGE_BUCKET, {
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
    const puppyId = Number(formData.get("puppy_id") || 0);
    const file = formData.get("file");

    if (!(file instanceof File) || !file.size) {
      return NextResponse.json(
        { ok: false, error: "Please choose a puppy photo to upload." },
        { status: 400 }
      );
    }

    const service = createServiceSupabase();
    await ensureImageBucket(service);

    const safeFileName = sanitizeFileName(file.name);
    const pathPrefix = puppyId ? `puppies/${puppyId}` : "staged";
    const uploadPath = `${pathPrefix}/${Date.now()}-${safeFileName || "puppy-photo"}`;
    const buffer = new Uint8Array(await file.arrayBuffer());

    const uploadResult = await service.storage.from(PUPPY_IMAGE_BUCKET).upload(uploadPath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
      cacheControl: "3600",
    });

    if (uploadResult.error) throw uploadResult.error;

    const publicUrl =
      service.storage.from(PUPPY_IMAGE_BUCKET).getPublicUrl(uploadPath).data.publicUrl || null;

    if (puppyId) {
      const { error: updateError } = await service
        .from("puppies")
        .update({
          image_url: uploadPath,
          photo_url: publicUrl,
        })
        .eq("id", puppyId);

      if (updateError) throw updateError;
    }

    return NextResponse.json({
      ok: true,
      puppyId: puppyId || null,
      uploadPath,
      publicUrl,
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin puppy photo upload error:", error);
    return NextResponse.json(
      { ok: false, error: describeRouteError(error, "Could not upload the puppy photo.") },
      { status: 500 }
    );
  }
}
