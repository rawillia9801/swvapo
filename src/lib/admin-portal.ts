export type AdminBuyerRecord = {
  id: number;
  user_id?: string | null;
  puppy_id?: number | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

export type AdminApplicationRecord = {
  id: number;
  user_id?: string | null;
  created_at: string;
  full_name?: string | null;
  email?: string | null;
  applicant_email?: string | null;
  phone?: string | null;
  status?: string | null;
  admin_notes?: string | null;
  assigned_puppy_id?: number | null;
};

export type AdminFormRecord = {
  id: number;
  user_id?: string | null;
  created_at: string;
  user_email?: string | null;
  form_key: string;
  form_title?: string | null;
  status: string;
  signed_name?: string | null;
  submitted_at?: string | null;
};

export type AdminPortalAccount = {
  key: string;
  email: string;
  userId: string | null;
  displayName: string;
  phone: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastSignInAt?: string | null;
  confirmedAt?: string | null;
  emailConfirmedAt?: string | null;
  phoneConfirmedAt?: string | null;
  confirmationSentAt?: string | null;
  recoverySentAt?: string | null;
  emailChangeSentAt?: string | null;
  pendingEmail?: string | null;
  bannedUntil?: string | null;
  audience?: string | null;
  role?: string | null;
  isAnonymous?: boolean | null;
  userMetadata?: Record<string, unknown> | null;
  appMetadata?: Record<string, unknown> | null;
  identities?: Array<Record<string, unknown>> | null;
  factors?: Array<Record<string, unknown>> | null;
  buyer: AdminBuyerRecord | null;
  application: AdminApplicationRecord | null;
  forms: AdminFormRecord[];
  documents?: Array<{
    id: string;
    title?: string | null;
    description?: string | null;
    category?: string | null;
    status?: string | null;
    created_at?: string | null;
    source_table?: string | null;
    file_name?: string | null;
  }>;
  messages?: Array<{
    id: string;
    user_id: string | null;
    user_email: string | null;
    subject: string | null;
    message: string;
    status: string | null;
    sender: "user" | "admin";
    created_at: string;
    read_by_admin: boolean;
    read_by_user: boolean;
  }>;
  pickupRequests?: Array<{
    id: number;
    created_at?: string | null;
    request_date?: string | null;
    request_type?: string | null;
    location_text?: string | null;
    address_text?: string | null;
    notes?: string | null;
    status?: string | null;
    miles?: number | null;
  }>;
  linkedPuppies?: Array<{
    id: number;
    call_name?: string | null;
    puppy_name?: string | null;
    name?: string | null;
    litter_name?: string | null;
    status?: string | null;
    price?: number | null;
    deposit?: number | null;
  }>;
  paymentSummary?: {
    count: number;
    totalPaid: number;
    lastPaymentAt?: string | null;
  } | null;
};

export type AdminDigestBrief = {
  id: number;
  digest_date: string;
  summary: string;
  priorities?: string[] | null;
  stats?: Record<string, unknown> | null;
};

export type AdminPublicConversationSummary = {
  id: string;
  title: string;
  preview: string;
  updatedAt: string | null;
  leadStatus: string;
  followUpNeeded: boolean;
  tags: string[];
};

export type AdminBuyerConversationSummary = {
  key: string;
  email: string;
  preview: string;
  updatedAt: string | null;
  unreadCount: number;
  subject: string;
};

export type AdminLineageOverview = {
  totalLitters: number;
  totalDams: number;
  totalSires: number;
  totalPuppies: number;
  availablePuppies: number;
  reservedPuppies: number;
  completedPuppies: number;
  totalRevenue: number;
  contractedRevenue?: number;
  projectedRevenue: number;
  realizedRevenue: number;
  totalDeposits: number;
  totalPayments?: number;
};

export type AdminOverviewStats = {
  buyers: number;
  applications: number;
  payments: number;
  documents: number;
  paymentPlans: number;
  transportRequests: number;
  users: number;
  unreadBuyerMessages: number;
  visitors24h: number;
  returningVisitors24h: number;
  publicThreads24h: number;
  publicMessages24h: number;
  openFollowUps: number;
  hotLeads: number;
  warmLeads: number;
  sharedContacts: number;
  totalRevenue: number;
  lineage: AdminLineageOverview | null;
  latestDigest: AdminDigestBrief | null;
  publicConversationSummaries: AdminPublicConversationSummary[];
  buyerConversationSummaries: AdminBuyerConversationSummary[];
};

export type AdminApplicationLinkedBuyer = {
  id: number;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
};

export type AdminApplicationLinkedPuppy = {
  id: number;
  displayName: string;
  status?: string | null;
  litterName?: string | null;
  dam?: string | null;
  sire?: string | null;
  buyer_id?: number | null;
};

export type AdminApplicationMessage = {
  id: string;
  created_at: string;
  sender?: string | null;
  subject?: string | null;
  message?: string | null;
  read_by_admin?: boolean | null;
  status?: string | null;
};

export type AdminApplicationQueueItem = {
  id: number;
  user_id?: string | null;
  created_at: string;
  displayName: string;
  email: string;
  phone: string;
  cityState: string;
  status: string;
  admin_notes: string;
  assigned_puppy_id?: number | null;
  puppyInterest: string;
  preferredGender: string;
  preferredCoatType: string;
  paymentPreference: string;
  financingInterest: boolean;
  transportInterest: boolean;
  depositReady: boolean;
  matchedBuyer: AdminApplicationLinkedBuyer | null;
  matchedPuppy: AdminApplicationLinkedPuppy | null;
  messages: AdminApplicationMessage[];
  application: Record<string, unknown> | null;
  householdSummary: string;
  experienceSummary: string;
  questions: string;
};

export type AdminApplicationWorkspace = {
  summary: {
    total: number;
    newCount: number;
    underReviewCount: number;
    followUpCount: number;
    approvedCount: number;
    deniedCount: number;
    convertedCount: number;
    financingInterested: number;
    transportInterested: number;
    matchedCount: number;
  };
  applications: AdminApplicationQueueItem[];
  puppyOptions: AdminApplicationLinkedPuppy[];
};

export type AdminRevenueSnapshot = {
  totalPuppies: number;
  availableCount: number;
  reservedCount: number;
  completedCount: number;
  unsoldCount: number;
  totalRevenue: number;
  contractedRevenue: number;
  projectedRevenue: number;
  realizedRevenue: number;
  totalDeposits: number;
  totalPayments?: number;
  averageSalePrice: number;
};

export type AdminLineageBuyer = {
  id: number;
  puppy_id?: number | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  status?: string | null;
  sale_price?: number | null;
  deposit_amount?: number | null;
};

export type AdminLineageDogRef = {
  id: string;
  role?: string | null;
  dog_name?: string | null;
  name?: string | null;
  dob?: string | null;
  coat?: string | null;
  registry?: string | null;
  is_active?: boolean | null;
  display_name?: string | null;
  registered_name?: string | null;
  call_name?: string | null;
  status?: string | null;
  date_of_birth?: string | null;
  color?: string | null;
  coat_type?: string | null;
  registration_no?: string | null;
  notes?: string | null;
  created_at?: string | null;
  displayName: string;
};

export type AdminLineageLitterRef = {
  id: number;
  litter_code?: string | null;
  litter_name?: string | null;
  dam_id?: string | null;
  sire_id?: string | null;
  whelp_date?: string | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
  displayName: string;
};

export type AdminLineagePuppy = {
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
  displayName: string;
  buyer: AdminLineageBuyer | null;
  litter: AdminLineageLitterRef | null;
  damProfile: AdminLineageDogRef | null;
  sireProfile: AdminLineageDogRef | null;
  listPrice: number;
  salePrice: number;
  publicPrice: number | null;
  publicPriceHidden: boolean;
  depositTotal: number;
  paymentTotal: number;
};

export type AdminLineageLitter = AdminLineageLitterRef & {
  damProfile: AdminLineageDogRef | null;
  sireProfile: AdminLineageDogRef | null;
  puppies: AdminLineagePuppy[];
  summary: AdminRevenueSnapshot;
};

export type AdminLineageDog = AdminLineageDogRef & {
  litters: AdminLineageLitterRef[];
  puppies: AdminLineagePuppy[];
  summary: AdminRevenueSnapshot & {
    totalLitters: number;
    reserveRate: number;
    completionRate: number;
  };
};

export type AdminLineageWorkspace = {
  summary: AdminRevenueSnapshot & {
    totalLitters: number;
    totalDams: number;
    totalSires: number;
  };
  dogs: AdminLineageDog[];
  litters: AdminLineageLitter[];
  puppies: AdminLineagePuppy[];
  buyers: AdminLineageBuyer[];
};

export async function fetchAdminAccounts(accessToken: string): Promise<AdminPortalAccount[]> {
  if (!accessToken) return [];

  try {
    const response = await fetch("/api/admin/portal/accounts", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { accounts?: AdminPortalAccount[] };
    return Array.isArray(payload.accounts) ? payload.accounts : [];
  } catch {
    return [];
  }
}

export async function fetchAdminOverview(accessToken: string): Promise<AdminOverviewStats | null> {
  if (!accessToken) return null;

  try {
    const response = await fetch("/api/admin/portal/overview", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { overview?: AdminOverviewStats };
    return payload.overview || null;
  } catch {
    return null;
  }
}

export async function fetchAdminLineageWorkspace(
  accessToken: string
): Promise<AdminLineageWorkspace | null> {
  if (!accessToken) return null;

  try {
    const response = await fetch("/api/admin/portal/lineage", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { workspace?: AdminLineageWorkspace };
    return payload.workspace || null;
  } catch {
    return null;
  }
}

export async function fetchAdminApplicationsWorkspace(
  accessToken: string
): Promise<AdminApplicationWorkspace | null> {
  if (!accessToken) return null;

  try {
    const response = await fetch("/api/admin/portal/applications", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { workspace?: AdminApplicationWorkspace };
    return payload.workspace || null;
  } catch {
    return null;
  }
}

export function adminFirstValue(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

export function adminNormalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}
