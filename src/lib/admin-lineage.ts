import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceSupabase } from "@/lib/admin-api";
import { isMissingBreedingGeneticsColumnError } from "@/lib/breeding-genetics";
import {
  buildRevenueSnapshot,
  type BreedingDogRecord,
  type LitterRecord,
  normalizeLineageRole,
  resolveBreedingDogName,
  resolveBuyerName,
  resolveBuyerTransportCosts,
  resolveDepositAmount,
  resolveInternalSalePrice,
  resolveLitterName,
  resolvePuppyBreederCosts,
  resolvePublicPuppyPrice,
  resolvePuppyListPrice,
  resolvePuppyName,
  resolveTotalPuppyCosts,
  shouldHidePublicPuppyPrice,
  type LineageBuyerRecord,
  type LineagePaymentRecord,
  type LineagePuppyRecord,
  type RevenueSnapshot,
} from "@/lib/lineage";

export type EnrichedLineagePuppy = LineagePuppyRecord & {
  displayName: string;
  buyer: LineageBuyerRecord | null;
  litter: LitterRecord | null;
  damProfile: BreedingDogRecord | null;
  sireProfile: BreedingDogRecord | null;
  listPrice: number;
  salePrice: number;
  publicPrice: number | null;
  publicPriceHidden: boolean;
  depositTotal: number;
  paymentTotal: number;
  breederCostTotal: number;
  transportCostTotal: number;
  totalCost: number;
  estimatedProfit: number;
};

export type EnrichedLitter = LitterRecord & {
  displayName: string;
  damProfile: BreedingDogRecord | null;
  sireProfile: BreedingDogRecord | null;
  puppies: EnrichedLineagePuppy[];
  summary: RevenueSnapshot;
};

export type EnrichedBreedingDog = BreedingDogRecord & {
  displayName: string;
  litters: EnrichedLitter[];
  puppies: EnrichedLineagePuppy[];
  summary: RevenueSnapshot & {
    totalLitters: number;
    reserveRate: number;
    completionRate: number;
  };
};

export type AdminLineageWorkspace = {
  summary: RevenueSnapshot & {
    totalLitters: number;
    totalDams: number;
    totalSires: number;
  };
  dogs: EnrichedBreedingDog[];
  litters: EnrichedLitter[];
  puppies: EnrichedLineagePuppy[];
  buyers: LineageBuyerRecord[];
};

type LineageRows = {
  dogs: BreedingDogRecord[];
  litters: LitterRecord[];
  puppies: LineagePuppyRecord[];
  buyers: LineageBuyerRecord[];
  payments: LineagePaymentRecord[];
};

export async function loadAdminLineageWorkspace(service = createServiceSupabase()) {
  const rows = await loadLineageRows(service);
  return buildAdminLineageWorkspace(rows);
}

async function loadLineageRows(service: SupabaseClient): Promise<LineageRows> {
  const [dogs, litters, puppies, buyers, payments] = await Promise.all([
    loadBreedingDogs(service),
    safeRows<LitterRecord>(
      service
        .from("litters")
        .select("id,litter_code,litter_name,dam_id,sire_id,whelp_date,status,notes,created_at")
        .order("whelp_date", { ascending: false })
        .order("created_at", { ascending: false })
    ),
    safeRows<LineagePuppyRecord>(
      service
        .from("puppies")
        .select(
          "id,buyer_id,litter_id,litter_name,dam_id,sire_id,call_name,puppy_name,name,sex,color,coat_type,coat,pattern,dob,status,price,list_price,deposit,balance,photo_url,image_url,description,notes,owner_email,dam,sire,tail_dock_cost,dewclaw_cost,vaccination_cost,microchip_cost,registration_cost,other_vet_cost,total_medical_cost,created_at"
        )
        .order("created_at", { ascending: false })
    ),
    safeRows<LineageBuyerRecord>(
      service
        .from("buyers")
        .select(
          "id,puppy_id,full_name,name,email,status,sale_price,deposit_amount,delivery_fee,expense_gas,expense_hotel,expense_tolls,expense_misc"
        )
        .order("created_at", { ascending: false })
    ),
    safeRows<LineagePaymentRecord>(
      service
        .from("buyer_payments")
        .select("id,buyer_id,puppy_id,amount,status")
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false })
    ),
  ]);

  return { dogs, litters, puppies, buyers, payments };
}

async function loadBreedingDogs(service: SupabaseClient): Promise<BreedingDogRecord[]> {
  const geneticsSelect =
    "id,role,dog_name,name,call_name,status,dob,date_of_birth,color,coat,registry,genetics_summary,genetics_raw,genetics_report_url,genetics_updated_at,notes,created_at,is_active";
  const fallbackSelect =
    "id,role,dog_name,name,call_name,status,dob,date_of_birth,color,coat,registry,notes,created_at,is_active";

  try {
    const { data, error } = await service
      .from("bp_dogs")
      .select(geneticsSelect)
      .order("role", { ascending: true })
      .order("dog_name", { ascending: true })
      .order("call_name", { ascending: true })
      .returns<BreedingDogRecord[]>();

    if (error) {
      if (!isMissingBreedingGeneticsColumnError(error)) return [];

      const fallback = await service
        .from("bp_dogs")
        .select(fallbackSelect)
        .order("role", { ascending: true })
        .order("dog_name", { ascending: true })
        .order("call_name", { ascending: true })
        .returns<BreedingDogRecord[]>();

      return fallback.error ? [] : fallback.data || [];
    }

    return data || [];
  } catch (error) {
    if (!isMissingBreedingGeneticsColumnError(error)) return [];

    try {
      const { data, error: fallbackError } = await service
        .from("bp_dogs")
        .select(fallbackSelect)
        .order("role", { ascending: true })
        .order("dog_name", { ascending: true })
        .order("call_name", { ascending: true })
        .returns<BreedingDogRecord[]>();

      return fallbackError ? [] : data || [];
    } catch {
      return [];
    }
  }
}

export function buildAdminLineageWorkspace(rows: LineageRows): AdminLineageWorkspace {
  const breedingDogs: EnrichedBreedingDog[] = rows.dogs
    .filter((dog) => String(dog.id || "").trim())
    .map((dog) => ({
      ...dog,
      displayName: resolveBreedingDogName(dog),
      litters: [],
      puppies: [],
      summary: {
        totalPuppies: 0,
        availableCount: 0,
        reservedCount: 0,
        completedCount: 0,
        soldCount: 0,
        unsoldCount: 0,
        totalRevenue: 0,
        contractedRevenue: 0,
        projectedRevenue: 0,
        realizedRevenue: 0,
        reservedRevenue: 0,
        totalDeposits: 0,
        totalPayments: 0,
        averageSalePrice: 0,
        totalCosts: 0,
        projectedCosts: 0,
        reservedCosts: 0,
        realizedCosts: 0,
        totalProfit: 0,
        projectedProfit: 0,
        reservedProfit: 0,
        realizedProfit: 0,
        averageProfit: 0,
        totalLitters: 0,
        reserveRate: 0,
        completionRate: 0,
      },
    }));

  const dogsById = new Map(
    breedingDogs.map((dog) => [String(dog.id), dog] as const)
  );
  const buyersById = new Map(rows.buyers.map((buyer) => [Number(buyer.id), buyer] as const));
  const buyersByPuppyId = new Map(
    rows.buyers
      .filter((buyer) => Number(buyer.puppy_id || 0) > 0)
      .map((buyer) => [Number(buyer.puppy_id), buyer] as const)
  );
  const paymentsByBuyerId = new Map<number, LineagePaymentRecord[]>();

  rows.payments.forEach((payment) => {
    const buyerId = Number(payment.buyer_id || 0);
    if (!buyerId) return;
    const group = paymentsByBuyerId.get(buyerId) || [];
    group.push(payment);
    paymentsByBuyerId.set(buyerId, group);
  });

  const littersById = new Map(rows.litters.map((litter) => [Number(litter.id), litter] as const));
  const litterByName = new Map(
    rows.litters
      .filter((litter) => String(litter.litter_name || litter.litter_code || "").trim())
      .map((litter) => [
        String(litter.litter_name || litter.litter_code || "").trim().toLowerCase(),
        litter,
      ] as const)
  );

  const enrichedPuppies: EnrichedLineagePuppy[] = rows.puppies.map((puppy) => {
    const directBuyer = buyersById.get(Number(puppy.buyer_id || 0)) || null;
    const fallbackBuyer = buyersByPuppyId.get(Number(puppy.id || 0)) || null;
    const buyer = directBuyer || fallbackBuyer;
    const persistedLitter = littersById.get(Number(puppy.litter_id || 0)) || null;
    const namedLitter =
      persistedLitter ||
      litterByName.get(String(puppy.litter_name || "").trim().toLowerCase()) ||
      null;
    const damId = String(
      persistedLitter?.dam_id || puppy.dam_id || namedLitter?.dam_id || ""
    ).trim();
    const sireId = String(
      persistedLitter?.sire_id || puppy.sire_id || namedLitter?.sire_id || ""
    ).trim();
    const damProfile = damId ? dogsById.get(damId) || null : null;
    const sireProfile = sireId ? dogsById.get(sireId) || null : null;
    const payments = buyer ? paymentsByBuyerId.get(Number(buyer.id)) || [] : [];
    const paymentTotal = payments.reduce((sum, payment) => {
      const status = String(payment.status || "").trim().toLowerCase();
      if (["failed", "void", "cancelled", "canceled"].includes(status)) return sum;
      return sum + Number(payment.amount || 0);
    }, 0);
    const breederCostTotal = resolvePuppyBreederCosts(puppy);
    const transportCostTotal = resolveBuyerTransportCosts(buyer);
    const totalCost = resolveTotalPuppyCosts(puppy, buyer);
    const estimatedProfit = resolveInternalSalePrice(puppy, buyer) - totalCost;

    return {
      ...puppy,
      displayName: resolvePuppyName(puppy),
      buyer,
      litter: namedLitter,
      damProfile,
      sireProfile,
      listPrice: resolvePuppyListPrice(puppy),
      salePrice: resolveInternalSalePrice(puppy, buyer),
      publicPrice: resolvePublicPuppyPrice(puppy),
      publicPriceHidden: shouldHidePublicPuppyPrice(puppy.status),
      depositTotal: resolveDepositAmount(puppy, buyer),
      paymentTotal,
      breederCostTotal,
      transportCostTotal,
      totalCost,
      estimatedProfit,
    };
  });

  const litters: EnrichedLitter[] = rows.litters
    .map((litter) => {
      const puppies = enrichedPuppies.filter(
        (puppy) => Number(puppy.litter_id || 0) === Number(litter.id)
      );

      return {
        ...litter,
        displayName: resolveLitterName(litter),
        damProfile: litter.dam_id ? dogsById.get(String(litter.dam_id)) || null : null,
        sireProfile: litter.sire_id ? dogsById.get(String(litter.sire_id)) || null : null,
        puppies,
        summary: buildRevenueSnapshot(
          puppies,
          (puppy) => puppy.buyer,
          (puppy, buyer) => (buyer ? paymentsByBuyerId.get(Number(buyer.id)) || [] : [])
        ),
      };
    })
    .sort(compareLineageDates);

  const dogs: EnrichedBreedingDog[] = breedingDogs
    .map((dog) => {
      const role = normalizeLineageRole(dog.role);
      const littersForDog = litters.filter((litter) =>
        role === "dam"
          ? String(litter.dam_id || "") === String(dog.id)
          : String(litter.sire_id || "") === String(dog.id)
      );
      const puppiesForDog = littersForDog.flatMap((litter) => litter.puppies);
      const summary = buildRevenueSnapshot(
        puppiesForDog,
        (puppy) => puppy.buyer,
        (puppy, buyer) => (buyer ? paymentsByBuyerId.get(Number(buyer.id)) || [] : [])
      );

      return {
        ...dog,
        litters: littersForDog,
        puppies: puppiesForDog,
        summary: {
          ...summary,
          totalLitters: littersForDog.length,
          reserveRate: summary.totalPuppies ? summary.reservedCount / summary.totalPuppies : 0,
          completionRate: summary.totalPuppies
            ? summary.completedCount / summary.totalPuppies
            : 0,
        },
      };
    })
    .sort((left, right) => {
      const roleSort =
        normalizeLineageRole(left.role).localeCompare(normalizeLineageRole(right.role));
      if (roleSort !== 0) return roleSort;
      return left.displayName.localeCompare(right.displayName);
    });

  const overall = buildRevenueSnapshot(
    enrichedPuppies,
    (puppy) => puppy.buyer,
    (puppy, buyer) => (buyer ? paymentsByBuyerId.get(Number(buyer.id)) || [] : [])
  );

  return {
    summary: {
      ...overall,
      totalLitters: litters.length,
      totalDams: dogs.filter((dog) => normalizeLineageRole(dog.role) === "dam").length,
      totalSires: dogs.filter((dog) => normalizeLineageRole(dog.role) === "sire").length,
    },
    dogs,
    litters,
    puppies: enrichedPuppies,
    buyers: rows.buyers,
  };
}

function compareLineageDates(
  left: Pick<LitterRecord, "whelp_date" | "created_at">,
  right: Pick<LitterRecord, "whelp_date" | "created_at">
) {
  const leftTime = new Date(left.whelp_date || left.created_at || 0).getTime();
  const rightTime = new Date(right.whelp_date || right.created_at || 0).getTime();
  return rightTime - leftTime;
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

export function formatDogWorkspaceDetail(dog: EnrichedBreedingDog) {
  return [
    dog.status || "Active",
    `${dog.summary.totalLitters} litters`,
    `${dog.summary.totalPuppies} puppies`,
  ].join(" | ");
}

export function formatLitterWorkspaceDetail(litter: EnrichedLitter) {
  return [
    litter.whelp_date || "No whelp date",
    `${litter.summary.totalPuppies} puppies`,
    `${litter.summary.completedCount} completed`,
  ].join(" | ");
}

export function formatPuppyLineage(puppy: EnrichedLineagePuppy) {
  const litterName = puppy.litter ? resolveLitterName(puppy.litter) : puppy.litter_name || "No litter";
  const damName = puppy.damProfile ? resolveBreedingDogName(puppy.damProfile) : puppy.dam || "No dam";
  const sireName = puppy.sireProfile ? resolveBreedingDogName(puppy.sireProfile) : puppy.sire || "No sire";

  return `${litterName} | Dam: ${damName} | Sire: ${sireName}`;
}

export function formatRevenueSummary(snapshot: RevenueSnapshot) {
  return [
    `${snapshot.totalPuppies} puppies`,
    `${snapshot.reservedCount} reserved`,
    `${snapshot.completedCount} completed`,
  ].join(" | ");
}

export function resolveWorkspaceBuyerLabel(puppy: EnrichedLineagePuppy) {
  return puppy.buyer ? resolveBuyerName(puppy.buyer) : puppy.owner_email || "No buyer assigned";
}
