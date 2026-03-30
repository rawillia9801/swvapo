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
  lastSignInAt?: string | null;
  buyer: AdminBuyerRecord | null;
  application: AdminApplicationRecord | null;
  forms: AdminFormRecord[];
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

export type AdminOverviewStats = {
  buyers: number;
  applications: number;
  payments: number;
  documents: number;
  paymentPlans: number;
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
  latestDigest: AdminDigestBrief | null;
  publicConversationSummaries: AdminPublicConversationSummary[];
  buyerConversationSummaries: AdminBuyerConversationSummary[];
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
