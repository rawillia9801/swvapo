import { NextResponse } from "next/server";
import { createServiceSupabase, firstValue, verifyOwner } from "@/lib/admin-api";

type PickupRequestRow = {
  id: number;
  created_at?: string | null;
  user_id?: string | null;
  puppy_id?: number | null;
  request_date?: string | null;
  request_type?: string | null;
  miles?: number | null;
  location_text?: string | null;
  address_text?: string | null;
  notes?: string | null;
  status?: string | null;
};

type BuyerRow = {
  id: number;
  user_id?: string | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  city?: string | null;
  state?: string | null;
};

type PuppyRow = {
  id: number;
  buyer_id?: number | null;
  call_name?: string | null;
  puppy_name?: string | null;
  name?: string | null;
  status?: string | null;
};

function normalizeRequestType(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (["meetup", "meet-up"].includes(normalized)) return "meet";
  if (["drop-off", "delivery"].includes(normalized)) return "dropoff";
  if (normalized === "transport") return "transportation";
  return normalized;
}

function toNumberOrNull(value: unknown) {
  const cleaned = String(value ?? "").replace(/[^0-9.-]/g, "").trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const service = createServiceSupabase();
    const [requestsRes, buyersRes, puppiesRes] = await Promise.all([
      service
        .from("portal_pickup_requests")
        .select(
          "id,created_at,user_id,puppy_id,request_date,request_type,miles,location_text,address_text,notes,status"
        )
        .order("created_at", { ascending: false }),
      service
        .from("buyers")
        .select("id,user_id,full_name,name,email,phone,status,city,state"),
      service
        .from("puppies")
        .select("id,buyer_id,call_name,puppy_name,name,status")
        .order("created_at", { ascending: false }),
    ]);

    if (requestsRes.error) throw requestsRes.error;
    if (buyersRes.error) throw buyersRes.error;
    if (puppiesRes.error) throw puppiesRes.error;

    const buyers = (buyersRes.data || []) as BuyerRow[];
    const puppies = (puppiesRes.data || []) as PuppyRow[];
    const buyersByUserId = new Map(
      buyers
        .filter((buyer) => buyer.user_id)
        .map((buyer) => [String(buyer.user_id), buyer] as const)
    );
    const puppiesById = new Map(puppies.map((puppy) => [puppy.id, puppy] as const));

    const requests = ((requestsRes.data || []) as PickupRequestRow[]).map((request) => ({
      ...request,
      buyer: request.user_id ? buyersByUserId.get(String(request.user_id)) || null : null,
      puppy: request.puppy_id ? puppiesById.get(request.puppy_id) || null : null,
    }));

    return NextResponse.json({
      ok: true,
      requests,
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin portal transportation route error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
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
    const requestId = Number(body.id || 0);

    if (!requestId) {
      return NextResponse.json(
        { ok: false, error: "A transportation request id is required." },
        { status: 400 }
      );
    }

    const payload = {
      status: firstValue(body.status as string | null, "pending").toLowerCase(),
      request_type: normalizeRequestType(body.request_type),
      request_date: firstValue(body.request_date as string | null) || null,
      miles: toNumberOrNull(body.miles),
      location_text: firstValue(body.location_text as string | null) || null,
      address_text: firstValue(body.address_text as string | null) || null,
      notes: firstValue(body.notes as string | null) || null,
    };

    const service = createServiceSupabase();
    const { error } = await service
      .from("portal_pickup_requests")
      .update(payload)
      .eq("id", requestId);

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      requestId,
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin portal transportation update error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
