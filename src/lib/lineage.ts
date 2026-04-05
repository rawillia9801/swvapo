export type BreedingDogRole = "dam" | "sire";

export type BreedingDogRecord = {
  id: string;
  role?: string | null;
  dog_name?: string | null;
  name?: string | null;
  call_name?: string | null;
  dob?: string | null;
  date_of_birth?: string | null;
  coat?: string | null;
  registry?: string | null;
  is_active?: boolean | null;
  display_name?: string | null;
  registered_name?: string | null;
  status?: string | null;
  color?: string | null;
  coat_type?: string | null;
  registration_no?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

export type LitterRecord = {
  id: number;
  litter_code?: string | null;
  litter_name?: string | null;
  dam_id?: string | null;
  sire_id?: string | null;
  whelp_date?: string | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

export type LineagePuppyRecord = {
  id: number;
  buyer_id?: number | null;
  litter_id?: number | null;
  litter_name?: string | null;
  dam_id?: string | null;
  sire_id?: string | null;
  call_name?: string | null;
  puppy_name?: string | null;
  name?: string | null;
  sex?: string | null;
  color?: string | null;
  coat_type?: string | null;
  coat?: string | null;
  pattern?: string | null;
  dob?: string | null;
  status?: string | null;
  price?: number | null;
  list_price?: number | null;
  deposit?: number | null;
  balance?: number | null;
  photo_url?: string | null;
  image_url?: string | null;
  description?: string | null;
  notes?: string | null;
  owner_email?: string | null;
  dam?: string | null;
  sire?: string | null;
  created_at?: string | null;
};

export type LineageBuyerRecord = {
  id: number;
  puppy_id?: number | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  status?: string | null;
  sale_price?: number | null;
  deposit_amount?: number | null;
};

export type LineagePaymentRecord = {
  id: string;
  buyer_id: number;
  puppy_id?: number | null;
  amount?: number | null;
  status?: string | null;
};

export type RevenueSnapshot = {
  totalPuppies: number;
  availableCount: number;
  reservedCount: number;
  completedCount: number;
  soldCount: number;
  unsoldCount: number;
  totalRevenue: number;
  projectedRevenue: number;
  realizedRevenue: number;
  reservedRevenue: number;
  totalDeposits: number;
  totalPayments: number;
  averageSalePrice: number;
};

export function normalizeLineageRole(value: string | null | undefined): BreedingDogRole {
  return String(value || "").trim().toLowerCase() === "sire" ? "sire" : "dam";
}

export function normalizePuppyStatus(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export function isReservedLikeStatus(value: string | null | undefined) {
  return normalizePuppyStatus(value).includes("reserv");
}

export function isCompletedLikeStatus(value: string | null | undefined) {
  const status = normalizePuppyStatus(value);
  return (
    status.includes("completed") ||
    status === "complete" ||
    status.includes("sold") ||
    status.includes("adopt") ||
    status.includes("matched")
  );
}

export function isAvailableLikeStatus(value: string | null | undefined) {
  const status = normalizePuppyStatus(value);
  return status.includes("available") || status.includes("expect");
}

export function shouldHidePublicPuppyPrice(value: string | null | undefined) {
  const status = normalizePuppyStatus(value);
  return status.includes("reserved") || status.includes("completed");
}

export function toNumberOrZero(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toNumberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveBreedingDogName(dog: Partial<BreedingDogRecord> | null | undefined) {
  return (
    dog?.display_name ||
    dog?.dog_name ||
    dog?.name ||
    dog?.call_name ||
    dog?.registered_name ||
    "Unnamed"
  );
}

export function resolveLitterName(litter: Partial<LitterRecord> | null | undefined) {
  return litter?.litter_name || litter?.litter_code || (litter?.id ? `Litter #${litter.id}` : "No litter");
}

export function resolvePuppyName(puppy: Partial<LineagePuppyRecord> | null | undefined) {
  return puppy?.call_name || puppy?.puppy_name || puppy?.name || (puppy?.id ? `Puppy #${puppy.id}` : "Unnamed Puppy");
}

export function resolveBuyerName(buyer: Partial<LineageBuyerRecord> | null | undefined) {
  return buyer?.full_name || buyer?.name || buyer?.email || (buyer?.id ? `Buyer #${buyer.id}` : "Unassigned");
}

export function resolvePuppyListPrice(puppy: Partial<LineagePuppyRecord> | null | undefined) {
  return firstFiniteNumber(puppy?.list_price, puppy?.price);
}

export function resolveInternalSalePrice(
  puppy: Partial<LineagePuppyRecord> | null | undefined,
  buyer: Partial<LineageBuyerRecord> | null | undefined
) {
  return firstFiniteNumber(buyer?.sale_price, puppy?.price, puppy?.list_price);
}

export function resolveDepositAmount(
  puppy: Partial<LineagePuppyRecord> | null | undefined,
  buyer: Partial<LineageBuyerRecord> | null | undefined
) {
  return firstFiniteNumber(buyer?.deposit_amount, puppy?.deposit);
}

export function resolvePublicPuppyPrice(puppy: Partial<LineagePuppyRecord> | null | undefined) {
  if (!puppy) return null;
  if (shouldHidePublicPuppyPrice(puppy.status)) return null;
  return resolvePuppyListPrice(puppy);
}

export function paymentCountsTowardRevenue(value: string | null | undefined) {
  const status = normalizePuppyStatus(value);
  if (!status) return true;
  return !["failed", "void", "cancelled", "canceled"].includes(status);
}

export function buildRevenueSnapshot<
  TPuppy extends Partial<LineagePuppyRecord>,
  TBuyer extends Partial<LineageBuyerRecord>
>(
  puppies: TPuppy[],
  getBuyer: (puppy: TPuppy) => TBuyer | null | undefined,
  getPayments?: (puppy: TPuppy, buyer: TBuyer | null | undefined) => LineagePaymentRecord[]
): RevenueSnapshot {
  const totals = puppies.reduce(
    (acc, puppy) => {
      const buyer = getBuyer(puppy);
      const salePrice = resolveInternalSalePrice(puppy, buyer);
      const depositTotal = resolveDepositAmount(puppy, buyer);
      const payments = getPayments ? getPayments(puppy, buyer) : [];
      const paymentTotal = payments.reduce((sum, payment) => {
        if (!paymentCountsTowardRevenue(payment.status)) return sum;
        return sum + toNumberOrZero(payment.amount);
      }, 0);
      const status = puppy.status;

      acc.totalPuppies += 1;
      acc.totalRevenue += salePrice;
      acc.totalDeposits += depositTotal;
      acc.totalPayments += paymentTotal;

      if (isAvailableLikeStatus(status)) {
        acc.availableCount += 1;
        acc.projectedRevenue += salePrice;
      }

      if (!isReservedLikeStatus(status) && !isCompletedLikeStatus(status)) {
        acc.unsoldCount += 1;
      }

      if (isReservedLikeStatus(status)) {
        acc.reservedCount += 1;
        acc.reservedRevenue += salePrice;
      }

      if (isCompletedLikeStatus(status)) {
        acc.completedCount += 1;
        acc.soldCount += 1;
        acc.realizedRevenue += salePrice;
      }

      return acc;
    },
    {
      totalPuppies: 0,
      availableCount: 0,
      reservedCount: 0,
      completedCount: 0,
      soldCount: 0,
      unsoldCount: 0,
      totalRevenue: 0,
      projectedRevenue: 0,
      realizedRevenue: 0,
      reservedRevenue: 0,
      totalDeposits: 0,
      totalPayments: 0,
      averageSalePrice: 0,
    } satisfies RevenueSnapshot
  );

  totals.averageSalePrice = totals.totalPuppies
    ? totals.totalRevenue / totals.totalPuppies
    : 0;

  return totals;
}

function firstFiniteNumber(...values: unknown[]) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}
