import { NextResponse } from "next/server";
import {
  createServiceSupabase,
  firstValue,
  normalizeEmail,
  verifyOwner,
} from "@/lib/admin-api";
import { resolveBreedingDogName, resolveLitterName, resolvePuppyName } from "@/lib/lineage";

type ApplicationJson = Record<string, unknown>;

type ApplicationRow = {
  id: number;
  user_id?: string | null;
  created_at: string;
  full_name?: string | null;
  email?: string | null;
  applicant_email?: string | null;
  phone?: string | null;
  city_state?: string | null;
  status?: string | null;
  admin_notes?: string | null;
  assigned_puppy_id?: number | null;
  application?: ApplicationJson | null;
};

type BuyerRow = {
  id: number;
  user_id?: string | null;
  puppy_id?: number | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  city?: string | null;
  state?: string | null;
  notes?: string | null;
};

type PuppyRow = {
  id: number;
  buyer_id?: number | null;
  litter_id?: number | null;
  litter_name?: string | null;
  dam_id?: string | null;
  sire_id?: string | null;
  call_name?: string | null;
  puppy_name?: string | null;
  name?: string | null;
  status?: string | null;
  dam?: string | null;
  sire?: string | null;
};

type LitterRow = {
  id: number;
  litter_code?: string | null;
  litter_name?: string | null;
  dam_id?: string | null;
  sire_id?: string | null;
};

type DogRow = {
  id: string;
  role?: string | null;
  dog_name?: string | null;
  name?: string | null;
  call_name?: string | null;
  display_name?: string | null;
  registered_name?: string | null;
  status?: string | null;
};

type MessageRow = {
  id: string;
  created_at: string;
  user_id?: string | null;
  user_email?: string | null;
  subject?: string | null;
  message?: string | null;
  sender?: string | null;
  read_by_admin?: boolean | null;
  status?: string | null;
};

type PickupRequestRow = {
  id: number;
  created_at?: string | null;
  user_id?: string | null;
  request_type?: string | null;
  location_text?: string | null;
  notes?: string | null;
  status?: string | null;
};

function safeRecord(value: unknown): ApplicationJson | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ApplicationJson)
    : null;
}

function readString(record: ApplicationJson | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function readBooleanLike(record: ApplicationJson | null, key: string) {
  const value = record?.[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["yes", "true", "ready", "y"].includes(normalized);
  }
  return false;
}

function toNumberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function toNullableString(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function parseCityState(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return { city: "", state: "" };
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return { city: parts[0], state: parts.slice(1).join(", ") };
  }
  return { city: raw, state: "" };
}

function normalizeApplicationStatus(value: string | null | undefined) {
  const status = String(value || "").trim().toLowerCase();
  if (!status || status.includes("submitted") || status === "new") return "new";
  if (status.includes("convert") || status.includes("matched")) return "converted to buyer";
  if (status.includes("approve")) return "approved";
  if (status.includes("den")) return "denied";
  if (
    status.includes("follow") ||
    status.includes("hold") ||
    status.includes("wait") ||
    status.includes("need")
  ) {
    return "follow up needed";
  }
  if (status.includes("review") || status.includes("pending")) return "under review";
  return status;
}

function statusLabel(status: string) {
  return status
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function matchesKeywords(text: string, keywords: string[]) {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function buildPuppyOption(
  puppy: PuppyRow,
  littersById: Map<number, LitterRow>,
  dogsById: Map<string, DogRow>
) {
  const litter = puppy.litter_id ? littersById.get(Number(puppy.litter_id)) || null : null;
  const damProfile = puppy.dam_id ? dogsById.get(String(puppy.dam_id)) || null : null;
  const sireProfile = puppy.sire_id ? dogsById.get(String(puppy.sire_id)) || null : null;
  return {
    id: puppy.id,
    displayName: resolvePuppyName(puppy),
    status: puppy.status || null,
    litterName: firstValue(puppy.litter_name, resolveLitterName(litter)) || null,
    dam: firstValue(puppy.dam, resolveBreedingDogName(damProfile)) || null,
    sire: firstValue(puppy.sire, resolveBreedingDogName(sireProfile)) || null,
    buyer_id: puppy.buyer_id ?? null,
  };
}

function applicationDisplayName(row: ApplicationRow, application: ApplicationJson | null) {
  return (
    firstValue(
      row.full_name,
      readString(application, "fullName"),
      row.email,
      row.applicant_email,
      `Application #${row.id}`
    ) || `Application #${row.id}`
  );
}

function applicationEmail(row: ApplicationRow, application: ApplicationJson | null) {
  return (
    firstValue(
      row.email,
      row.applicant_email,
      readString(application, "email"),
      readString(application, "applicantEmail")
    ) || ""
  );
}

function applicationPhone(row: ApplicationRow, application: ApplicationJson | null) {
  return firstValue(row.phone, readString(application, "phone")) || "";
}

function applicationCityState(row: ApplicationRow, application: ApplicationJson | null) {
  const explicit = String(row.city_state || "").trim();
  if (explicit) return explicit;
  const city = readString(application, "city");
  const state = readString(application, "state");
  return [city, state].filter(Boolean).join(", ");
}

function applicationInterest(
  application: ApplicationJson | null,
  matchedPuppyLabel: string | null
) {
  if (matchedPuppyLabel) return matchedPuppyLabel;
  const preference = [
    readString(application, "interestType"),
    readString(application, "preferredGender"),
    readString(application, "preferredCoatType"),
    readString(application, "colorPreference"),
  ]
    .filter(Boolean)
    .join(" / ");
  return preference || "General inquiry";
}

function buildHouseholdSummary(application: ApplicationJson | null) {
  const parts = [
    readString(application, "homeType"),
    readString(application, "childrenAtHome"),
    readString(application, "otherPets"),
    readString(application, "workStatus"),
    readString(application, "fencedYard"),
  ].filter(Boolean);
  return parts.join(" / ") || "Household notes not provided yet.";
}

function buildExperienceSummary(application: ApplicationJson | null) {
  const parts = [
    readString(application, "ownedChihuahuaBefore"),
    readString(application, "whoCaresForPuppy"),
    readString(application, "petDetails"),
  ].filter(Boolean);
  return parts.join(" / ") || "Experience notes not provided yet.";
}

function nextBuyerStatus(currentStatus: string | null | undefined) {
  const normalized = String(currentStatus || "").trim().toLowerCase();
  if (normalized.includes("completed")) return currentStatus || "completed";
  if (normalized.includes("approved")) return currentStatus || "approved";
  return "approved";
}

function messageMatches(message: MessageRow, userId: string, email: string) {
  const messageUserId = String(message.user_id || "").trim();
  const messageEmail = normalizeEmail(message.user_email);
  return (userId && messageUserId === userId) || (email && messageEmail === email);
}

async function safeRows<T>(
  query: PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  try {
    const result = await query;
    if (result.error) return [];
    return result.data || [];
  } catch {
    return [];
  }
}

async function loadWorkspace() {
  const service = createServiceSupabase();
  const [applications, buyers, puppies, litters, dogs, messages, pickupRequests] = await Promise.all([
    safeRows<ApplicationRow>(
      service
        .from("puppy_applications")
        .select(
          "id,user_id,created_at,full_name,email,applicant_email,phone,city_state,status,admin_notes,assigned_puppy_id,application"
        )
        .order("created_at", { ascending: false })
    ),
    safeRows<BuyerRow>(
      service
        .from("buyers")
        .select("id,user_id,puppy_id,full_name,name,email,phone,status,city,state,notes")
        .order("created_at", { ascending: false })
    ),
    safeRows<PuppyRow>(
      service
        .from("puppies")
        .select(
          "id,buyer_id,litter_id,litter_name,dam_id,sire_id,call_name,puppy_name,name,status,dam,sire"
        )
        .order("created_at", { ascending: false })
    ),
    safeRows<LitterRow>(
      service
        .from("litters")
        .select("id,litter_code,litter_name,dam_id,sire_id")
        .order("whelp_date", { ascending: false })
    ),
    safeRows<DogRow>(
      service
        .from("bp_dogs")
        .select("id,role,dog_name,name,call_name,display_name,registered_name,status")
        .order("dog_name", { ascending: true })
    ),
    safeRows<MessageRow>(
      service
        .from("portal_messages")
        .select("id,created_at,user_id,user_email,subject,message,sender,read_by_admin,status")
        .order("created_at", { ascending: false })
        .limit(3000)
    ),
    safeRows<PickupRequestRow>(
      service
        .from("portal_pickup_requests")
        .select("id,created_at,user_id,request_type,location_text,notes,status")
        .order("created_at", { ascending: false })
        .limit(1000)
    ),
  ]);

  const buyersByUserId = new Map<string, BuyerRow>();
  const buyersByEmail = new Map<string, BuyerRow>();
  buyers.forEach((buyer) => {
    const userId = String(buyer.user_id || "").trim();
    const email = normalizeEmail(buyer.email);
    if (userId && !buyersByUserId.has(userId)) buyersByUserId.set(userId, buyer);
    if (email && !buyersByEmail.has(email)) buyersByEmail.set(email, buyer);
  });

  const littersById = new Map(litters.map((litter) => [Number(litter.id), litter] as const));
  const dogsById = new Map(dogs.map((dog) => [String(dog.id), dog] as const));
  const puppiesById = new Map(
    puppies.map((puppy) => [
      Number(puppy.id),
      buildPuppyOption(puppy, littersById, dogsById),
    ] as const)
  );
  const puppiesByBuyerId = new Map<number, PuppyRow[]>();
  puppies.forEach((puppy) => {
    const buyerId = Number(puppy.buyer_id || 0);
    if (!buyerId) return;
    const group = puppiesByBuyerId.get(buyerId) || [];
    group.push(puppy);
    puppiesByBuyerId.set(buyerId, group);
  });

  const queueItems = applications.map((row) => {
    const application = safeRecord(row.application);
    const normalizedStatus = normalizeApplicationStatus(row.status);
    const userId = String(row.user_id || "").trim();
    const email = normalizeEmail(applicationEmail(row, application));
    const matchedBuyer =
      (userId ? buyersByUserId.get(userId) || null : null) ||
      (email ? buyersByEmail.get(email) || null : null);

    const buyerPuppies = matchedBuyer ? puppiesByBuyerId.get(matchedBuyer.id) || [] : [];
    const matchedPuppyId =
      Number(row.assigned_puppy_id || 0) ||
      Number(matchedBuyer?.puppy_id || 0) ||
      Number(buyerPuppies[0]?.id || 0) ||
      0;
    const matchedPuppy = matchedPuppyId ? puppiesById.get(matchedPuppyId) || null : null;

    const matchedMessages = messages
      .filter((message) => messageMatches(message, userId, email))
      .slice(0, 6)
      .map((message) => ({
        id: String(message.id),
        created_at: message.created_at,
        sender: message.sender || null,
        subject: message.subject || null,
        message: message.message || null,
        read_by_admin: message.read_by_admin ?? null,
        status: message.status || null,
      }));

    const transportMatches = pickupRequests.filter((request) => {
      const requestUserId = String(request.user_id || "").trim();
      return userId && requestUserId === userId;
    });

    const paymentPreference = readString(application, "paymentPreference");
    const questions = readString(application, "questions");
    const transportText = [
      readString(application, "interestType"),
      questions,
      ...transportMatches.map((request) =>
        [request.request_type, request.location_text, request.notes].filter(Boolean).join(" ")
      ),
    ]
      .filter(Boolean)
      .join(" ");

    const cityState = applicationCityState(row, application);

    return {
      id: row.id,
      user_id: row.user_id || null,
      created_at: row.created_at,
      displayName: applicationDisplayName(row, application),
      email: applicationEmail(row, application),
      phone: applicationPhone(row, application),
      cityState,
      status: normalizedStatus,
      admin_notes: String(row.admin_notes || ""),
      assigned_puppy_id: row.assigned_puppy_id ?? null,
      puppyInterest: applicationInterest(application, matchedPuppy?.displayName || null),
      preferredGender: readString(application, "preferredGender"),
      preferredCoatType: readString(application, "preferredCoatType"),
      paymentPreference,
      financingInterest:
        matchesKeywords(paymentPreference, ["financ", "payment plan", "monthly"]) ||
        matchesKeywords(questions, ["financ", "payment plan", "monthly"]),
      transportInterest:
        transportMatches.length > 0 ||
        matchesKeywords(transportText, [
          "transport",
          "delivery",
          "pickup",
          "pick up",
          "meet",
          "meet-up",
          "dropoff",
          "drop off",
          "travel",
        ]),
      depositReady: readBooleanLike(application, "readyToPlaceDeposit"),
      matchedBuyer: matchedBuyer
        ? {
            id: matchedBuyer.id,
            displayName:
              firstValue(matchedBuyer.full_name, matchedBuyer.name, matchedBuyer.email) ||
              `Buyer #${matchedBuyer.id}`,
            email: matchedBuyer.email || null,
            phone: matchedBuyer.phone || null,
            status: matchedBuyer.status || null,
          }
        : null,
      matchedPuppy,
      messages: matchedMessages,
      application,
      householdSummary: buildHouseholdSummary(application),
      experienceSummary: buildExperienceSummary(application),
      questions,
    };
  });

  const summary = queueItems.reduce(
    (totals, item) => {
      totals.total += 1;
      if (item.status === "new") totals.newCount += 1;
      if (item.status === "under review") totals.underReviewCount += 1;
      if (item.status === "follow up needed") totals.followUpCount += 1;
      if (item.status === "approved") totals.approvedCount += 1;
      if (item.status === "denied") totals.deniedCount += 1;
      if (item.status === "converted to buyer") totals.convertedCount += 1;
      if (item.financingInterest) totals.financingInterested += 1;
      if (item.transportInterest) totals.transportInterested += 1;
      if (item.matchedBuyer || item.matchedPuppy) totals.matchedCount += 1;
      return totals;
    },
    {
      total: 0,
      newCount: 0,
      underReviewCount: 0,
      followUpCount: 0,
      approvedCount: 0,
      deniedCount: 0,
      convertedCount: 0,
      financingInterested: 0,
      transportInterested: 0,
      matchedCount: 0,
    }
  );

  return {
    summary,
    applications: queueItems,
    puppyOptions: Array.from(puppiesById.values()).sort((left, right) =>
      left.displayName.localeCompare(right.displayName)
    ),
  };
}

async function loadApplicationById(
  service: ReturnType<typeof createServiceSupabase>,
  id: number
) {
  const { data, error } = await service
    .from("puppy_applications")
    .select(
      "id,user_id,created_at,full_name,email,applicant_email,phone,city_state,status,admin_notes,assigned_puppy_id,application"
    )
    .eq("id", id)
    .maybeSingle<ApplicationRow>();

  if (error) throw error;
  return data || null;
}

async function loadPuppyById(service: ReturnType<typeof createServiceSupabase>, id: number) {
  const { data, error } = await service
    .from("puppies")
    .select("id,buyer_id,owner_email")
    .eq("id", id)
    .maybeSingle<{ id: number; buyer_id?: number | null; owner_email?: string | null }>();

  if (error) throw error;
  return data || null;
}

async function findBuyerForApplication(
  service: ReturnType<typeof createServiceSupabase>,
  application: ApplicationRow
) {
  const applicationData = safeRecord(application.application);
  const email = normalizeEmail(applicationEmail(application, applicationData));

  if (application.user_id) {
    const { data, error } = await service
      .from("buyers")
      .select("id,user_id,puppy_id,full_name,name,email,phone,status,city,state,notes")
      .eq("user_id", application.user_id)
      .limit(1)
      .maybeSingle<BuyerRow>();

    if (error) throw error;
    if (data) return data;
  }

  if (!email) return null;

  const { data, error } = await service
    .from("buyers")
    .select("id,user_id,puppy_id,full_name,name,email,phone,status,city,state,notes")
    .ilike("email", email)
    .limit(1)
    .maybeSingle<BuyerRow>();

  if (error) throw error;
  return data || null;
}

export async function GET(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await loadWorkspace();

    return NextResponse.json({
      ok: true,
      workspace,
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin applications workspace error:", error);
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
    const applicationId = toNumberOrNull(body.id);
    if (!applicationId) {
      return NextResponse.json(
        { ok: false, error: "Application id is required." },
        { status: 400 }
      );
    }

    const service = createServiceSupabase();
    const existing = await loadApplicationById(service, applicationId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Application not found." }, { status: 404 });
    }

    const assignedPuppyId = toNumberOrNull(body.assigned_puppy_id);
    if (assignedPuppyId) {
      const puppy = await loadPuppyById(service, assignedPuppyId);
      if (!puppy) {
        return NextResponse.json(
          { ok: false, error: "Assigned puppy could not be found." },
          { status: 400 }
        );
      }
    }

    const payload = {
      status:
        normalizeApplicationStatus(toNullableString(body.status) || existing.status || "new"),
      admin_notes: toNullableString(body.admin_notes),
      assigned_puppy_id: assignedPuppyId,
    };

    const { error } = await service.from("puppy_applications").update(payload).eq("id", applicationId);
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      applicationId,
      statusLabel: statusLabel(payload.status),
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin applications update error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
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

    const body = (await req.json()) as Record<string, unknown>;
    if (String(body.action || "") !== "convert_to_buyer") {
      return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
    }

    const applicationId = toNumberOrNull(body.id);
    if (!applicationId) {
      return NextResponse.json(
        { ok: false, error: "Application id is required." },
        { status: 400 }
      );
    }

    const service = createServiceSupabase();
    const application = await loadApplicationById(service, applicationId);
    if (!application) {
      return NextResponse.json({ ok: false, error: "Application not found." }, { status: 404 });
    }

    const applicationData = safeRecord(application.application);
    const email = normalizeEmail(applicationEmail(application, applicationData));
    const fullName = applicationDisplayName(application, applicationData);
    const phone = applicationPhone(application, applicationData);
    const cityState = parseCityState(applicationCityState(application, applicationData));
    const assignedPuppyId =
      toNumberOrNull(body.assigned_puppy_id) || Number(application.assigned_puppy_id || 0) || null;

    let buyer = await findBuyerForApplication(service, application);

    if (!buyer && !email && !fullName) {
      return NextResponse.json(
        { ok: false, error: "This application is missing the contact info needed to create a buyer." },
        { status: 400 }
      );
    }

    if (!buyer) {
      const { data, error } = await service
        .from("buyers")
        .insert({
          user_id: application.user_id || null,
          full_name: fullName || null,
          name: fullName || null,
          email: email || null,
          phone: phone || null,
          city: cityState.city || null,
          state: cityState.state || null,
          status: "approved",
          notes: `Converted from application #${application.id}.`,
          puppy_id: assignedPuppyId,
        })
        .select("id,user_id,puppy_id,full_name,name,email,phone,status,city,state,notes")
        .single<BuyerRow>();

      if (error) throw error;
      buyer = data;
    } else {
      const buyerPatch = {
        user_id: buyer.user_id || application.user_id || null,
        full_name: firstValue(buyer.full_name, buyer.name, fullName) || null,
        name: firstValue(buyer.name, buyer.full_name, fullName) || null,
        email: firstValue(buyer.email, email) || null,
        phone: firstValue(buyer.phone, phone) || null,
        city: firstValue(buyer.city, cityState.city) || null,
        state: firstValue(buyer.state, cityState.state) || null,
        status: nextBuyerStatus(buyer.status),
        puppy_id: assignedPuppyId || buyer.puppy_id || null,
      };

      const { error } = await service.from("buyers").update(buyerPatch).eq("id", buyer.id);
      if (error) throw error;
      buyer = { ...buyer, ...buyerPatch };
    }

    if (assignedPuppyId) {
      const puppy = await loadPuppyById(service, assignedPuppyId);
      if (!puppy) {
        return NextResponse.json(
          { ok: false, error: "Assigned puppy could not be found." },
          { status: 400 }
        );
      }
      if (puppy.buyer_id && puppy.buyer_id !== buyer.id) {
        return NextResponse.json(
          { ok: false, error: "That puppy is already assigned to another buyer." },
          { status: 409 }
        );
      }

      const { error: puppyError } = await service
        .from("puppies")
        .update({
          buyer_id: buyer.id,
          owner_email: normalizeEmail(buyer.email) || email || null,
        })
        .eq("id", assignedPuppyId);

      if (puppyError) throw puppyError;

      const { error: buyerPuppyError } = await service
        .from("buyers")
        .update({ puppy_id: assignedPuppyId })
        .eq("id", buyer.id);

      if (buyerPuppyError) throw buyerPuppyError;
    }

    const { error: applicationError } = await service
      .from("puppy_applications")
      .update({
        status: "converted to buyer",
        assigned_puppy_id: assignedPuppyId,
      })
      .eq("id", application.id);

    if (applicationError) throw applicationError;

    return NextResponse.json({
      ok: true,
      buyerId: buyer.id,
      applicationId: application.id,
      statusLabel: "Converted To Buyer",
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin applications convert error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
