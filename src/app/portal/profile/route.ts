import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type BuyerProfileRow = {
  id: number;
  user_id: string | null;
  full_name: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  portal_profile_photo_url: string | null;
  portal_profile_photo_path: string | null;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getBearerToken(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return null;
}

function createAnonSupabase(): SupabaseClient {
  return createClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function createServiceSupabase(): SupabaseClient {
  return createClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

async function verifyUser(req: Request) {
  const accessToken = getBearerToken(req);
  if (!accessToken) return { user: null };

  const anon = createAnonSupabase();
  const { data, error } = await anon.auth.getUser(accessToken);

  if (error || !data.user) {
    return { user: null };
  }

  return { user: data.user };
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

export async function POST(req: Request) {
  try {
    const { user } = await verifyUser(req);

    if (!user) {
      return jsonError("Please sign in again before updating your profile.", 401);
    }

    const formData = await req.formData();

    const fullName = String(formData.get("full_name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const addressLine1 = String(formData.get("address_line1") || "").trim();
    const addressLine2 = String(formData.get("address_line2") || "").trim();
    const city = String(formData.get("city") || "").trim();
    const state = String(formData.get("state") || "").trim();
    const postalCode = String(formData.get("postal_code") || "").trim();

    const pictureEntry = formData.get("profile_picture");
    const profilePicture = pictureEntry instanceof File && pictureEntry.size > 0 ? pictureEntry : null;

    if (!fullName && !email && !phone && !profilePicture && !addressLine1 && !addressLine2 && !city && !state && !postalCode) {
      return jsonError("Nothing was submitted to save.");
    }

    if (profilePicture && profilePicture.size > 5 * 1024 * 1024) {
      return jsonError("Profile picture must be 5MB or smaller.");
    }

    const admin = createServiceSupabase();

    const { data: existingBuyer, error: existingBuyerError } = await admin
      .from("buyers")
      .select(
        "id,user_id,full_name,name,email,phone,address_line1,address_line2,city,state,postal_code,portal_profile_photo_url,portal_profile_photo_path"
      )
      .eq("user_id", user.id)
      .maybeSingle<BuyerProfileRow>();

    if (existingBuyerError) {
      throw new Error(`Could not load buyer profile: ${existingBuyerError.message}`);
    }

    let uploadedPhotoPath = existingBuyer?.portal_profile_photo_path || null;
    let uploadedPhotoUrl = existingBuyer?.portal_profile_photo_url || null;

    if (profilePicture) {
      const bucketName = "portal-profile-pictures";
      const sanitizedName = sanitizeFileName(profilePicture.name || "profile-picture");
      const uploadPath = `${user.id}/profile-${Date.now()}-${sanitizedName}`;

      if (existingBuyer?.portal_profile_photo_path) {
        await admin.storage.from(bucketName).remove([existingBuyer.portal_profile_photo_path]);
      }

      const arrayBuffer = await profilePicture.arrayBuffer();
      const uploadBuffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await admin.storage
        .from(bucketName)
        .upload(uploadPath, uploadBuffer, {
          contentType: profilePicture.type || "application/octet-stream",
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Could not upload profile picture: ${uploadError.message}`);
      }

      const { data: publicUrlData } = admin.storage.from(bucketName).getPublicUrl(uploadPath);

      uploadedPhotoPath = uploadPath;
      uploadedPhotoUrl = publicUrlData.publicUrl;
    }

    const payload = {
      user_id: user.id,
      full_name: fullName || existingBuyer?.full_name || null,
      name: fullName || existingBuyer?.name || null,
      email: email || existingBuyer?.email || user.email || null,
      phone: phone || existingBuyer?.phone || null,
      address_line1: addressLine1 || null,
      address_line2: addressLine2 || null,
      city: city || null,
      state: state || null,
      postal_code: postalCode || null,
      portal_profile_photo_url: uploadedPhotoUrl,
      portal_profile_photo_path: uploadedPhotoPath,
    };

    let savedBuyer: BuyerProfileRow | null = null;

    if (existingBuyer?.id) {
      const { data, error } = await admin
        .from("buyers")
        .update(payload)
        .eq("id", existingBuyer.id)
        .select(
          "id,user_id,full_name,name,email,phone,address_line1,address_line2,city,state,postal_code,portal_profile_photo_url,portal_profile_photo_path"
        )
        .single<BuyerProfileRow>();

      if (error) {
        throw new Error(`Could not update buyer profile: ${error.message}`);
      }

      savedBuyer = data;
    } else {
      const { data, error } = await admin
        .from("buyers")
        .insert(payload)
        .select(
          "id,user_id,full_name,name,email,phone,address_line1,address_line2,city,state,postal_code,portal_profile_photo_url,portal_profile_photo_path"
        )
        .single<BuyerProfileRow>();

      if (error) {
        throw new Error(`Could not create buyer profile: ${error.message}`);
      }

      savedBuyer = data;
    }

    try {
      await admin.auth.admin.updateUserById(user.id, {
        email: payload.email || undefined,
        user_metadata: {
          ...(user.user_metadata || {}),
          full_name: payload.full_name || undefined,
          name: payload.full_name || undefined,
          avatar_url: uploadedPhotoUrl || undefined,
        },
      });
    } catch (authError) {
      console.error("Could not update auth profile fields:", authError);
    }

    return NextResponse.json({
      ok: true,
      message: "Your profile was saved.",
      email: savedBuyer?.email || payload.email || null,
      photo_url: savedBuyer?.portal_profile_photo_url || uploadedPhotoUrl || null,
      buyer: savedBuyer,
    });
  } catch (error) {
    console.error("Portal profile route error:", error);
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 }
    );
  }
}