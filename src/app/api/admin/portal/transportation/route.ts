import { NextResponse } from "next/server";
import { createServiceSupabase, firstValue, verifyOwner } from "@/lib/admin-api";
import { resolveBreedingWorkspace } from "@/lib/resolvers/breeding";
import { resolveBuyers } from "@/lib/resolvers/buyers";
import { resolveTransportWorkspace } from "@/lib/resolvers/transport";

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
    const [transportResolved, buyersResolved, breedingResolved] = await Promise.all([
      resolveTransportWorkspace(service),
      resolveBuyers(service),
      resolveBreedingWorkspace(service),
    ]);

    const buyers = buyersResolved.data
      .filter((buyer): buyer is typeof buyer & { id: number } => buyer.id !== null)
      .map(
        (buyer): BuyerRow => ({
          id: buyer.id,
          user_id: buyer.userId,
          full_name: buyer.fullName,
          name: buyer.fullName,
          email: buyer.email,
          phone: buyer.phone,
          status: buyer.status,
          city: buyer.city,
          state: buyer.state,
        })
      );
    const puppies = breedingResolved.data.resolvedPuppies
      .filter((puppy): puppy is typeof puppy & { id: number } => puppy.id !== null)
      .map(
        (puppy): PuppyRow => ({
          id: puppy.id,
          buyer_id: puppy.buyerId,
          call_name: puppy.callName,
          puppy_name: puppy.displayName,
          name: puppy.displayName,
          status: puppy.status,
        })
      );
    const puppiesById = new Map(puppies.map((puppy) => [puppy.id, puppy] as const));

    const requests = transportResolved.data.resolvedTransportRequests
      .filter((request) => request.sourceTable === "portal_pickup_requests")
      .map((request): PickupRequestRow & { buyer: BuyerRow | null; puppy: PuppyRow | null } => {
        const requestId = Number(request.recordId || 0);
        const puppy = request.puppyId ? puppiesById.get(request.puppyId) || null : null;
        const buyer =
          (request.buyerId !== null
            ? buyers.find((entry) => entry.id === request.buyerId) || null
            : null) ||
          (puppy?.buyer_id ? buyers.find((entry) => entry.id === puppy.buyer_id) || null : null);
        return {
          id: Number.isFinite(requestId) && requestId > 0 ? requestId : 0,
          created_at: request.createdAt || request.scheduledAt,
          user_id: request.userId || buyer?.user_id || null,
          puppy_id: request.puppyId,
          request_date: request.requestDate || request.scheduledAt,
          request_type: request.deliveryMethod,
          miles: request.miles,
          location_text: request.locationText,
          address_text: request.addressText,
          notes: request.notes,
          status: request.status,
          buyer,
          puppy,
        };
      });

    return NextResponse.json({
      ok: true,
      requests,
      diagnostics: {
        transport: transportResolved.diagnostics,
        buyers: buyersResolved.diagnostics,
        breeding: breedingResolved.diagnostics,
      },
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
