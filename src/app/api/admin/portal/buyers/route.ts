import { NextResponse } from "next/server";
import {
  createServiceSupabase,
  describeRouteError,
  firstValue,
  listAllAuthUsers,
  normalizeEmail,
  verifyOwner,
} from "@/lib/admin-api";
import { BUYER_PAYMENT_NOTICE_LOG_TABLES } from "@/lib/admin-data-compat";
import { resolveBreedingWorkspace } from "@/lib/resolvers/breeding";
import { resolveBuyers } from "@/lib/resolvers/buyers";
import { resolvePortalWorkspace } from "@/lib/resolvers/portal";

type BreedingWorkspaceResult = Awaited<ReturnType<typeof resolveBreedingWorkspace>>;
type BuyersResolverResult = Awaited<ReturnType<typeof resolveBuyers>>;
type PortalWorkspaceResult = Awaited<ReturnType<typeof resolvePortalWorkspace>>;

type BuyerRow = {
  id: number;
  user_id?: string | null;
  puppy_id?: number | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  status?: string | null;
  notes?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  delivery_option?: string | null;
  delivery_date?: string | null;
  delivery_location?: string | null;
  delivery_miles?: number | null;
  delivery_fee?: number | null;
  expense_gas?: number | null;
  expense_hotel?: number | null;
  expense_tolls?: number | null;
  expense_misc?: string | null;
  created_at?: string | null;
};

type ApplicationRow = {
  id: number;
  user_id?: string | null;
  full_name?: string | null;
  email?: string | null;
  applicant_email?: string | null;
  phone?: string | null;
  street_address?: string | null;
  city_state?: string | null;
  zip?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type FormRow = {
  id: number;
  user_id?: string | null;
  user_email?: string | null;
  email?: string | null;
  form_key?: string | null;
  form_title?: string | null;
  version?: string | null;
  signed_name?: string | null;
  signed_date?: string | null;
  signed_at?: string | null;
  status?: string | null;
  submitted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  data?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
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
  sire?: string | null;
  dam?: string | null;
  sex?: string | null;
  color?: string | null;
  coat_type?: string | null;
  coat?: string | null;
  pattern?: string | null;
  dob?: string | null;
  registry?: string | null;
  status?: string | null;
  price?: number | null;
  list_price?: number | null;
  deposit?: number | null;
  balance?: number | null;
  photo_url?: string | null;
  image_url?: string | null;
  description?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type DocumentRow = {
  id: string;
  user_id?: string | null;
  buyer_id?: number | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  status?: string | null;
  created_at?: string | null;
  source_table?: string | null;
  file_name?: string | null;
  file_url?: string | null;
  visible_to_user?: boolean | null;
  signed_at?: string | null;
};

type LitterRow = {
  id: number;
  litter_code?: string | null;
  litter_name?: string | null;
  dam_id?: string | null;
  sire_id?: string | null;
};

type BreedingDogRow = {
  id: string;
  dog_name?: string | null;
  name?: string | null;
  call_name?: string | null;
};

function numberOrNull(value: unknown) {
  const normalized = String(value ?? "")
    .replace(/[^0-9.-]/g, "")
    .trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function isMissingTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.toLowerCase().includes("does not exist");
}

function emptyDiagnostics(label: string, warning?: string) {
  return {
    sourcesChecked: [] as string[],
    sourcesUsed: [] as string[],
    missingTables: [] as string[],
    rowCounts: {} as Record<string, number>,
    mergeNotes: [] as string[],
    warnings: warning ? [`${label}: ${warning}`] : [],
  };
}

function emptyBreedingWorkspace(warning?: string): BreedingWorkspaceResult {
  return {
    data: {
      resolvedDogs: [],
      resolvedLitters: [],
      resolvedPuppies: [],
    },
    diagnostics: emptyDiagnostics("breeding", warning),
  };
}

function emptyBuyersWorkspace(warning?: string): BuyersResolverResult {
  return {
    data: [],
    diagnostics: emptyDiagnostics("buyers", warning),
  };
}

function emptyPortalWorkspace(warning?: string): PortalWorkspaceResult {
  return {
    data: {
      resolvedPortalDocuments: [],
      resolvedPortalForms: [],
      resolvedPortalMessages: [],
      resolvedPortalAssignments: [],
      resolvedPortalPickupRequests: [],
    },
    diagnostics: emptyDiagnostics("portal", warning),
  };
}

async function resolveOptional<T>(
  label: string,
  operation: () => Promise<T>,
  fallback: (warning?: string) => T,
  warnings: string[]
) {
  try {
    return await operation();
  } catch (error) {
    const message = describeRouteError(error, `${label} data could not load.`);
    console.warn(`[admin-buyers] ${label} resolver failed; continuing with partial data.`, error);
    warnings.push(`${label}: ${message}`);
    return fallback(message);
  }
}

function collectResolverWarnings(
  label: string,
  diagnostics: { warnings?: string[]; missingTables?: string[] } | null | undefined,
  warnings: string[]
) {
  const sourceWarnings = diagnostics?.warnings || [];
  sourceWarnings.slice(0, 4).forEach((warning) => {
    warnings.push(`${label}: ${warning}`);
  });
}

function asBuyerPayload(body: Record<string, unknown>) {
  return {
    full_name: firstValue(body.full_name as string | null, body.name as string | null) || null,
    name: firstValue(body.full_name as string | null, body.name as string | null) || null,
    email: firstValue(body.email as string | null) || null,
    phone: firstValue(body.phone as string | null) || null,
    address_line1: firstValue(body.address_line1 as string | null) || null,
    address_line2: firstValue(body.address_line2 as string | null) || null,
    status: firstValue(body.status as string | null, "pending"),
    notes: firstValue(body.notes as string | null) || null,
    city: firstValue(body.city as string | null) || null,
    state: firstValue(body.state as string | null) || null,
    postal_code: firstValue(body.postal_code as string | null) || null,
    delivery_option: firstValue(body.delivery_option as string | null) || null,
    delivery_date: firstValue(body.delivery_date as string | null) || null,
    delivery_location: firstValue(body.delivery_location as string | null) || null,
    delivery_miles: numberOrNull(body.delivery_miles),
    delivery_fee: numberOrNull(body.delivery_fee),
    expense_gas: numberOrNull(body.expense_gas),
    expense_hotel: numberOrNull(body.expense_hotel),
    expense_tolls: numberOrNull(body.expense_tolls),
    expense_misc: firstValue(body.expense_misc as string | null) || null,
  };
}

async function syncBuyerPuppyAssignments(
  service: ReturnType<typeof createServiceSupabase>,
  buyerId: number,
  linkedPuppyIds: number[]
) {
  const uniqueIds = Array.from(new Set(linkedPuppyIds.filter((id) => Number.isFinite(id) && id > 0)));
  if (uniqueIds.length) {
    const { data: selectedRows, error: selectedError } = await service
      .from("puppies")
      .select("id,buyer_id,call_name,puppy_name,name")
      .in("id", uniqueIds);

    if (selectedError) throw selectedError;

    const conflictingRows = (selectedRows || []).filter((row) => {
      const currentBuyerId = Number(row.buyer_id || 0);
      return currentBuyerId > 0 && currentBuyerId !== buyerId;
    });

    if (conflictingRows.length) {
      const conflictingBuyerIds = Array.from(
        new Set(conflictingRows.map((row) => Number(row.buyer_id || 0)).filter(Boolean))
      );
      const { data: conflictingBuyers, error: conflictingBuyersError } = await service
        .from("buyers")
        .select("id,full_name,name,email")
        .in("id", conflictingBuyerIds);

      if (conflictingBuyersError) throw conflictingBuyersError;

      const conflictingBuyerNames = new Map(
        ((conflictingBuyers || []) as Array<{
          id: number;
          full_name?: string | null;
          name?: string | null;
          email?: string | null;
        }>).map((buyer) => [
          Number(buyer.id),
          firstValue(buyer.full_name, buyer.name, buyer.email, `Buyer #${buyer.id}`),
        ] as const)
      );

      const conflictSummary = conflictingRows
        .map((row) => {
          const puppyName = firstValue(
            row.call_name as string | null,
            row.puppy_name as string | null,
            row.name as string | null,
            `Puppy #${row.id}`
          );
          const ownerName =
            conflictingBuyerNames.get(Number(row.buyer_id || 0)) || "another buyer";
          return `${puppyName} is already assigned to ${ownerName}`;
        })
        .join("; ");

      throw new Error(conflictSummary);
    }
  }

  const { data: existingRows, error: existingError } = await service
    .from("puppies")
    .select("id,buyer_id")
    .eq("buyer_id", buyerId);

  if (existingError) throw existingError;

  const existingIds = (existingRows || []).map((row) => Number(row.id || 0)).filter(Boolean);
  const toUnlink = existingIds.filter((id) => !uniqueIds.includes(id));
  const toLink = uniqueIds;

  if (toUnlink.length) {
    const { error } = await service
      .from("puppies")
      .update({ buyer_id: null })
      .in("id", toUnlink);
    if (error) throw error;
  }

  if (toLink.length) {
    const { error } = await service
      .from("puppies")
      .update({ buyer_id: buyerId })
      .in("id", toLink);
    if (error) throw error;
  }

  const { error: buyerUpdateError } = await service
    .from("buyers")
    .update({ puppy_id: uniqueIds[0] || null })
    .eq("id", buyerId);

  if (buyerUpdateError) throw buyerUpdateError;
}

export async function GET(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const service = createServiceSupabase();
    const warnings: string[] = [];
    const authUsers = await listAllAuthUsers().catch((error) => {
      const message = describeRouteError(error, "Auth users could not load.");
      console.warn("[admin-buyers] Auth user lookup failed; continuing without portal account match.", error);
      warnings.push(`Auth users: ${message}`);
      return [] as Awaited<ReturnType<typeof listAllAuthUsers>>;
    });
    const authByEmail = new Map(
      authUsers
        .map((authUser) => [normalizeEmail(authUser.email), authUser] as const)
        .filter(([email]) => !!email)
    );

    const [breeding, buyersResolved, portalResolved] = await Promise.all([
      resolveOptional(
        "Breeding workspace",
        () => resolveBreedingWorkspace(service),
        emptyBreedingWorkspace,
        warnings
      ),
      resolveOptional("Buyer records", () => resolveBuyers(service), emptyBuyersWorkspace, warnings),
      resolveOptional(
        "Portal records",
        () => resolvePortalWorkspace(service),
        emptyPortalWorkspace,
        warnings
      ),
    ]);

    collectResolverWarnings("Breeding workspace", breeding.diagnostics, warnings);
    collectResolverWarnings("Buyer records", buyersResolved.diagnostics, warnings);
    collectResolverWarnings("Portal records", portalResolved.diagnostics, warnings);

    const dogNameById = new Map(
      breeding.data.resolvedDogs.map((dog) => [dog.id, dog.displayName] as const)
    );

    const records = buyersResolved.data.map((buyer) => {
      const email = normalizeEmail(buyer.email);
      const authUser =
        (buyer.userId ? authUsers.find((candidate) => candidate.id === buyer.userId) : null) ||
        (email ? authByEmail.get(email) : null) ||
        null;

      const matchingForms = portalResolved.data.resolvedPortalForms.filter(
        (form) =>
          (buyer.userId && form.userId === buyer.userId) ||
          (!!email && normalizeEmail(form.userEmail) === email) ||
          (buyer.id !== null && form.buyerId === buyer.id)
      );
      const matchingDocuments = portalResolved.data.resolvedPortalDocuments.filter(
        (document) =>
          (buyer.id !== null && document.buyerId === buyer.id) ||
          matchingForms.some((form) => form.linkedDocumentIds.includes(document.id))
      );

      const linkedPuppies = breeding.data.resolvedPuppies
        .filter((puppy) => {
          if (buyer.id !== null && puppy.buyerId === buyer.id) return true;
          return buyer.linkedPuppyId !== null && puppy.id === buyer.linkedPuppyId;
        })
        .map((puppy) => ({
          id: Number(puppy.id || 0),
          buyer_id: puppy.buyerId,
          litter_id: puppy.litterId,
          litter_name: puppy.litterName,
          dam_id: puppy.damId,
          sire_id: puppy.sireId,
          call_name: puppy.callName,
          puppy_name: puppy.displayName,
          name: puppy.displayName,
          sire: puppy.sireId ? dogNameById.get(String(puppy.sireId)) || null : null,
          dam: puppy.damId ? dogNameById.get(String(puppy.damId)) || null : null,
          sex: puppy.sex,
          color: puppy.color,
          coat_type: puppy.coatType,
          coat: puppy.coatType,
          pattern: null,
          dob: puppy.dob,
          registry: null,
          status: puppy.status,
          price: puppy.price,
          list_price: puppy.listPrice,
          deposit: puppy.deposit,
          balance: puppy.balance,
          photo_url: puppy.photoUrl,
          image_url: puppy.photoUrl,
          description: null,
          notes: puppy.notes,
          created_at: null,
        })) as PuppyRow[];

      const buyerRow = {
        id: Number(buyer.id || 0),
        user_id: buyer.userId,
        puppy_id: buyer.linkedPuppyId,
        full_name: buyer.fullName,
        name: buyer.fullName,
        email: buyer.email,
        phone: buyer.phone,
        address_line1: buyer.addressLine1,
        address_line2: buyer.addressLine2,
        status: buyer.status,
        notes: buyer.notes,
        city: buyer.city,
        state: buyer.state,
        postal_code: buyer.postalCode,
        delivery_option: buyer.deliveryOption,
        delivery_date: buyer.deliveryDate,
        delivery_location: buyer.deliveryLocation,
        delivery_miles: buyer.deliveryMiles,
        delivery_fee: buyer.deliveryFee,
        expense_gas: buyer.expenseGas,
        expense_hotel: buyer.expenseHotel,
        expense_tolls: buyer.expenseTolls,
        expense_misc: buyer.expenseMisc,
        created_at: buyer.createdAt,
      } satisfies BuyerRow;

      const applications = buyer.applications.map((application) => ({
        id: Number(application.id || 0),
        user_id: buyer.userId,
        full_name: application.fullName,
        email: application.email,
        applicant_email: application.email,
        phone: application.phone,
        street_address: null,
        city_state: buyer.city ? [buyer.city, buyer.state].filter(Boolean).join(", ") : null,
        zip: buyer.postalCode,
        status: application.status,
        created_at: application.createdAt,
      })) as ApplicationRow[];

      const forms = matchingForms.map((form) => ({
        id: Number(form.id.replace(/^\D+/g, "") || 0),
        user_id: form.userId,
        user_email: form.userEmail,
        email: form.userEmail,
        form_key: form.formKey,
        form_title: form.formKey,
        version: null,
        signed_name: null,
        signed_date: form.signedAt,
        signed_at: form.signedAt,
        status: form.status,
        submitted_at: form.submittedAt,
        created_at: form.submittedAt,
        updated_at: form.signedAt || form.submittedAt,
        data: form.payload,
        payload: form.payload,
      })) as FormRow[];

      const documents = matchingDocuments.map((document) => ({
        id: document.id,
        user_id: buyer.userId,
        buyer_id: buyer.id,
        title: document.documentType,
        description: document.sourceFlow,
        category: document.documentType,
        status: document.status,
        created_at: document.createdAt,
        source_table: document.sourceFlow,
        file_name: null,
        file_url: document.url,
        visible_to_user: null,
        signed_at: document.signedAt,
      })) as DocumentRow[];

      return {
        key: buyer.resolver_key,
        buyer: buyerRow,
        displayName: firstValue(buyer.fullName, buyer.email, buyer.phone, buyer.resolver_key),
        email: firstValue(buyer.email),
        phone: firstValue(buyer.phone),
        hasPortalAccount: !!authUser,
        portalUser: authUser
          ? {
              id: authUser.id,
              email: authUser.email || "",
              created_at: authUser.created_at || null,
              last_sign_in_at: authUser.last_sign_in_at || null,
            }
          : null,
        applicationCount: applications.length,
        latestApplication: applications[0] || null,
        latestApplicationStatus: applications[0]?.status || null,
        formCount: forms.length,
        forms,
        documents,
        linkedPuppies,
      };
    });

    return NextResponse.json({
      ok: true,
      buyers: records,
      puppies: breeding.data.resolvedPuppies.map((puppy) => ({
        ...puppy,
        buyerName:
          buyersResolved.data.find((buyer) => buyer.id === puppy.buyerId)?.fullName || null,
      })),
      ownerEmail: owner.email || null,
      warnings: Array.from(new Set(warnings)).slice(0, 12),
    });
  } catch (error) {
    console.error("Admin portal buyers route error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not load buyer records."),
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
    const payload = asBuyerPayload(body);

    if (!payload.full_name && !payload.email) {
      return NextResponse.json(
        { ok: false, error: "A buyer name or email is required." },
        { status: 400 }
      );
    }

    const service = createServiceSupabase();
    const { data, error } = await service.from("buyers").insert(payload).select("id").single();
    if (error) throw error;

    const linkedPuppyIds = Array.isArray(body.linked_puppy_ids)
      ? body.linked_puppy_ids.map((value) => Number(value || 0)).filter((value) => value > 0)
      : [];

    if (linkedPuppyIds.length) {
      try {
        await syncBuyerPuppyAssignments(service, data.id, linkedPuppyIds);
      } catch (assignmentError) {
        await service.from("buyers").delete().eq("id", data.id);
        throw assignmentError;
      }
    }

    return NextResponse.json({ ok: true, buyerId: data.id, ownerEmail: owner.email || null });
  } catch (error) {
    console.error("Admin portal buyers create error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not create the buyer."),
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
    const buyerId = Number(body.id || 0);
    if (!buyerId) {
      return NextResponse.json({ ok: false, error: "A buyer id is required." }, { status: 400 });
    }

    const service = createServiceSupabase();
    const { error } = await service.from("buyers").update(asBuyerPayload(body)).eq("id", buyerId);
    if (error) throw error;

    if (Array.isArray(body.linked_puppy_ids)) {
      const linkedPuppyIds = body.linked_puppy_ids
        .map((value) => Number(value || 0))
        .filter((value) => value > 0);
      await syncBuyerPuppyAssignments(service, buyerId, linkedPuppyIds);
    }

    return NextResponse.json({ ok: true, buyerId, ownerEmail: owner.email || null });
  } catch (error) {
    console.error("Admin portal buyers update error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not update the buyer."),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const buyerId = Number(body.id || 0);
    if (!buyerId) {
      return NextResponse.json({ ok: false, error: "A buyer id is required." }, { status: 400 });
    }

    const service = createServiceSupabase();
    const buyerRes = await service
      .from("buyers")
      .select("id,user_id,full_name,name,email")
      .eq("id", buyerId)
      .single();

    if (buyerRes.error) throw buyerRes.error;

    const buyerName = firstValue(
      buyerRes.data.full_name,
      buyerRes.data.name,
      buyerRes.data.email,
      `Buyer #${buyerId}`
    );

    const [
      puppiesRes,
      documentsRes,
      paymentsRes,
      adjustmentsRes,
      subscriptionsRes,
      noticeLogsRes,
      noticeSettingsRes,
      transportationRes,
    ] = await Promise.all([
      service.from("puppies").select("id", { count: "exact", head: true }).eq("buyer_id", buyerId),
      service
        .from("portal_documents")
        .select("id", { count: "exact", head: true })
        .eq("buyer_id", buyerId),
      service
        .from("buyer_payments")
        .select("id", { count: "exact", head: true })
        .eq("buyer_id", buyerId),
      service
        .from("buyer_fee_credit_records")
        .select("id", { count: "exact", head: true })
        .eq("buyer_id", buyerId),
      service
        .from("buyer_billing_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("buyer_id", buyerId),
      (async () => {
        const primary = await service
          .from(BUYER_PAYMENT_NOTICE_LOG_TABLES[0])
          .select("id", { count: "exact", head: true })
          .eq("buyer_id", buyerId);

        if (!primary.error && Number(primary.count || 0) > 0) {
          return primary;
        }

        if (primary.error && !isMissingTableError(primary.error)) {
          return primary;
        }

        const fallback = await service
          .from(BUYER_PAYMENT_NOTICE_LOG_TABLES[1])
          .select("id", { count: "exact", head: true })
          .eq("buyer_id", buyerId);

        if (!fallback.error && Number(fallback.count || 0) > 0) {
          return fallback;
        }

        return primary.error ? fallback : primary;
      })(),
      service
        .from("buyer_payment_notice_settings")
        .select("id", { count: "exact", head: true })
        .eq("buyer_id", buyerId),
      buyerRes.data.user_id
        ? service
            .from("portal_pickup_requests")
            .select("id", { count: "exact", head: true })
            .eq("user_id", buyerRes.data.user_id)
        : Promise.resolve({ count: 0, error: null }),
    ]);

    const readCount = (result: { count?: number | null; error?: unknown }) => {
      if (result.error) {
        if (isMissingTableError(result.error)) return 0;
        throw result.error;
      }
      return Number(result.count || 0);
    };

    const blockers = [
      { label: "linked puppies", count: readCount(puppiesRes) },
      { label: "uploaded documents", count: readCount(documentsRes) },
      { label: "payments", count: readCount(paymentsRes) },
      { label: "fee or credit records", count: readCount(adjustmentsRes) },
      { label: "billing subscriptions", count: readCount(subscriptionsRes) },
      { label: "payment notice logs", count: readCount(noticeLogsRes) },
      { label: "transportation requests", count: readCount(transportationRes) },
    ].filter((item) => item.count > 0);

    if (blockers.length) {
      const blockerText = blockers
        .map((item) => `${item.count} ${item.label}`)
        .join(", ");

      return NextResponse.json(
        {
          ok: false,
          error: `${buyerName} cannot be deleted yet because this record still has ${blockerText}. Clear those records first, then try again.`,
        },
        { status: 400 }
      );
    }

    const noticeSettingsCount = readCount(noticeSettingsRes);
    if (noticeSettingsCount > 0) {
      const noticeSettingsDeleteRes = await service
        .from("buyer_payment_notice_settings")
        .delete()
        .eq("buyer_id", buyerId);

      if (noticeSettingsDeleteRes.error && !isMissingTableError(noticeSettingsDeleteRes.error)) {
        throw noticeSettingsDeleteRes.error;
      }
    }

    const { error } = await service.from("buyers").delete().eq("id", buyerId);
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      buyerId,
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin portal buyers delete error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not delete the buyer."),
      },
      { status: 500 }
    );
  }
}
