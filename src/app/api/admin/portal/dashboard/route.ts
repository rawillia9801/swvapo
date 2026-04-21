import { NextResponse } from "next/server";

import {
  createServiceSupabase,
  describeRouteError,
  verifyOwner,
} from "@/lib/admin-api";

export const runtime = "nodejs";

type RawRow = Record<string, unknown>;

type RowsResult<T extends RawRow> = {
  data: T[];
  ok: boolean;
};

const QUERY_TIMEOUT_MS = 2200;

function text(row: RawRow, key: string) {
  const value = row[key];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function bool(row: RawRow, key: string) {
  const value = row[key];
  if (value === null || value === undefined) return false;
  return Boolean(value);
}

function number(row: RawRow, key: string) {
  const value = row[key];
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstText(row: RawRow, ...keys: string[]) {
  for (const key of keys) {
    const value = text(row, key);
    if (value) return value;
  }
  return "";
}

function sinceIso(days = 1) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function isRecent(value: string | null | undefined, since: string) {
  if (!value) return false;
  return new Date(value).getTime() >= new Date(since).getTime();
}

function normalizedStatus(row: RawRow) {
  return firstText(row, "status", "lead_status").toLowerCase();
}

function isPastPuppy(row: RawRow) {
  const status = normalizedStatus(row);
  return ["sold", "adopted", "completed", "archived", "placed", "gone home"].some((token) =>
    status.includes(token)
  );
}

function isReservedPuppy(row: RawRow) {
  const status = normalizedStatus(row);
  return ["reserved", "matched", "hold", "deposit", "pending pickup"].some((token) =>
    status.includes(token)
  );
}

function puppyName(row: RawRow) {
  return firstText(row, "call_name", "puppy_name", "name") || `Puppy #${text(row, "id") || "unknown"}`;
}

function buyerName(row: RawRow) {
  return firstText(row, "full_name", "name", "email") || `Buyer #${text(row, "id") || "unknown"}`;
}

function litterName(row: RawRow) {
  return firstText(row, "name", "litter_name", "litter_code") || `Litter #${text(row, "id") || "unknown"}`;
}

function preview(value: string | null | undefined, fallback: string) {
  const cleaned = String(value || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return fallback;
  return cleaned.length > 130 ? `${cleaned.slice(0, 127)}...` : cleaned;
}

function safeDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function withTimeout<T>(operation: PromiseLike<T>, fallback: T) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => resolve(fallback), QUERY_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function safeRows<T extends RawRow>(
  label: string,
  queryFactory: () => PromiseLike<{ data: T[] | null; error: unknown }>,
  warnings: string[],
  required = false
): Promise<RowsResult<T>> {
  try {
    const result = await withTimeout(queryFactory(), { data: null, error: new Error("timeout") });
    if (result.error) {
      if (required) {
        warnings.push(`${label} could not load.`);
      }
      return { data: [], ok: false };
    }
    return { data: result.data || [], ok: true };
  } catch (error) {
    if (required) {
      warnings.push(`${label}: ${describeRouteError(error, "Could not load.")}`);
    }
    return { data: [], ok: false };
  }
}

function latestById(rows: RawRow[], idKey: string, dateKeys: string[]) {
  const map = new Map<string, RawRow>();
  for (const row of rows) {
    const id = text(row, idKey);
    if (!id) continue;
    const current = map.get(id);
    const nextDate = dateKeys.map((key) => safeDate(text(row, key))).find(Boolean)?.getTime() || 0;
    const currentDate =
      current ? dateKeys.map((key) => safeDate(text(current, key))).find(Boolean)?.getTime() || 0 : 0;
    if (!current || nextDate >= currentDate) map.set(id, row);
  }
  return map;
}

function matchesRecordType(row: RawRow, tokens: string[]) {
  const value = [text(row, "record_type"), text(row, "title"), text(row, "description")]
    .join(" ")
    .toLowerCase();
  return tokens.some((token) => value.includes(token));
}

function activeBuyer(row: RawRow) {
  const status = normalizedStatus(row);
  return !["completed", "archived", "inactive", "closed"].some((token) => status.includes(token));
}

function activeLitter(row: RawRow) {
  const status = normalizedStatus(row);
  return !["completed", "archived", "closed"].some((token) => status.includes(token));
}

function unpaidFinance(row: RawRow) {
  if (!bool(row, "finance_enabled")) return false;
  const nextDue = safeDate(firstText(row, "finance_next_due_date", "next_due_date"));
  if (!nextDue) return false;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return nextDue.getTime() < today.getTime();
}

export async function GET(req: Request) {
  try {
    const owner = await verifyOwner(req);
    if (!owner) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const service = createServiceSupabase();
    const warnings: string[] = [];
    const since = sinceIso(1);

    const [
      puppiesResult,
      littersResult,
      buyersResult,
      weightsResult,
      healthResult,
      portalMessagesResult,
      publicThreadsResult,
      formSubmissionsResult,
      documentsResult,
      paymentsResult,
    ] = await Promise.all([
      safeRows("Puppies", () => service.from("puppies").select("*").limit(1000), warnings, true),
      safeRows("Litters", () => service.from("litters").select("*").limit(500), warnings),
      safeRows("Buyers", () => service.from("buyers").select("*").limit(1000), warnings, true),
      safeRows("Weights", () => service.from("puppy_weights").select("*").limit(2000), warnings),
      safeRows("Care records", () => service.from("puppy_health_records").select("*").limit(3000), warnings),
      safeRows(
        "Portal messages",
        () => service.from("portal_messages").select("*").order("created_at", { ascending: false }).limit(500),
        warnings,
        true
      ),
      safeRows(
        "Website chats",
        () => service.from("chichi_public_threads").select("*").order("updated_at", { ascending: false }).limit(250),
        warnings
      ),
      safeRows(
        "Portal forms",
        () => service.from("portal_form_submissions").select("*").order("created_at", { ascending: false }).limit(1000),
        warnings
      ),
      safeRows(
        "Portal documents",
        () => service.from("portal_documents").select("*").order("created_at", { ascending: false }).limit(1000),
        warnings
      ),
      safeRows(
        "Payments",
        () => service.from("buyer_payments").select("*").order("created_at", { ascending: false }).limit(500),
        warnings
      ),
    ]);

    const puppies = puppiesResult.data;
    const litters = littersResult.data;
    const buyers = buyersResult.data;
    const weights = weightsResult.data;
    const health = healthResult.data;
    const portalMessages = portalMessagesResult.data;
    const publicThreads = publicThreadsResult.data;
    const forms = formSubmissionsResult.data;
    const documents = documentsResult.data;
    const payments = paymentsResult.data;

    const currentPuppies = puppies.filter((row) => !isPastPuppy(row));
    const availablePuppies = currentPuppies.filter((row) => !isReservedPuppy(row) && !text(row, "buyer_id"));
    const reservedPuppies = currentPuppies.filter((row) => isReservedPuppy(row) || Boolean(text(row, "buyer_id")));
    const pastPuppies = puppies.filter(isPastPuppy);
    const activeLitters = litters.filter(activeLitter);
    const activeBuyers = buyers.filter(activeBuyer);
    const financeBuyers = buyers.filter((row) => bool(row, "finance_enabled"));
    const overdueFinance = financeBuyers.filter(unpaidFinance);
    const latestWeights = latestById(weights, "puppy_id", ["weight_date", "weigh_date", "created_at"]);
    const latestCare = latestById(health, "puppy_id", ["record_date", "created_at"]);

    const eightDaysAgo = new Date();
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

    const missingWeights =
      weightsResult.ok
        ? currentPuppies.filter((puppy) => {
            const latest = latestWeights.get(text(puppy, "id"));
            const latestDate = latest
              ? safeDate(firstText(latest, "weight_date", "weigh_date", "created_at"))
              : null;
            return !latestDate || latestDate.getTime() < eightDaysAgo.getTime();
          })
        : [];

    const missingVaccines =
      healthResult.ok
        ? currentPuppies.filter((puppy) => {
            const puppyId = text(puppy, "id");
            return !health.some((record) => text(record, "puppy_id") === puppyId && matchesRecordType(record, ["vaccine", "vaccination", "shot"]));
          })
        : [];

    const missingDeworming =
      healthResult.ok
        ? currentPuppies.filter((puppy) => {
            const puppyId = text(puppy, "id");
            return !health.some((record) => text(record, "puppy_id") === puppyId && matchesRecordType(record, ["deworm", "worm"]));
          })
        : [];

    const missingPhotos = currentPuppies.filter((row) => !firstText(row, "photo_url", "image_url"));
    const missingCopy = currentPuppies.filter((row) => !firstText(row, "description", "website_description", "public_description"));
    const noBuyer = currentPuppies.filter((row) => !text(row, "buyer_id"));

    const unreadBuyerMessages = portalMessages.filter((message) => {
      const sender = firstText(message, "sender", "sender_role").toLowerCase();
      return sender !== "admin" && !bool(message, "read_by_admin");
    });

    const publicChatsToday = publicThreads.filter((thread) =>
      isRecent(firstText(thread, "updated_at", "created_at", "last_user_message_at"), since)
    );
    const publicFollowups = publicThreads.filter((thread) => bool(thread, "follow_up_needed"));

    const unsignedForms = forms.filter((form) => {
      const status = normalizedStatus(form);
      return !["signed", "complete", "completed", "filed", "archived"].some((token) => status.includes(token));
    });

    const unfiledDocuments = documents.filter((document) => {
      const status = normalizedStatus(document);
      return status.includes("signed") && !status.includes("filed");
    });

    const recentItems = [
      ...portalMessages.slice(0, 4).map((message) => ({
        id: `portal-message-${text(message, "id")}`,
        label: "Portal message",
        title: firstText(message, "subject") || "Buyer portal message",
        detail: preview(firstText(message, "message", "body"), "Buyer message recorded."),
        href: "/admin/portal/messages",
        occurredAt: firstText(message, "created_at"),
      })),
      ...publicThreads.slice(0, 4).map((thread) => ({
        id: `public-thread-${text(thread, "id")}`,
        label: "Website chat",
        title: `${firstText(thread, "lead_status") || "Visitor"} website chat`,
        detail: preview(firstText(thread, "summary", "intent_summary", "follow_up_reason"), "Public ChiChi conversation updated."),
        href: "/admin/portal/website-chats",
        occurredAt: firstText(thread, "updated_at", "created_at"),
      })),
      ...forms.slice(0, 3).map((form) => ({
        id: `form-${text(form, "id")}`,
        label: "Document",
        title: firstText(form, "form_title", "form_key") || "Portal form",
        detail: `Status: ${normalizedStatus(form) || "unknown"}`,
        href: "/admin/portal/documents",
        occurredAt: firstText(form, "submitted_at", "created_at"),
      })),
      ...payments.slice(0, 3).map((payment) => ({
        id: `payment-${text(payment, "id")}`,
        label: "Payment",
        title: number(payment, "amount") == null ? "Payment activity" : `$${number(payment, "amount")?.toFixed(2)} payment`,
        detail: `Status: ${normalizedStatus(payment) || "recorded"}`,
        href: "/admin/portal/payments",
        occurredAt: firstText(payment, "payment_date", "created_at"),
      })),
    ]
      .sort((left, right) => {
        const leftTime = safeDate(left.occurredAt)?.getTime() || 0;
        const rightTime = safeDate(right.occurredAt)?.getTime() || 0;
        return rightTime - leftTime;
      })
      .slice(0, 7);

    const activeLitterRows = activeLitters.slice(0, 4).map((litter) => {
      const litterId = text(litter, "id");
      const litterCode = firstText(litter, "litter_code", "name", "litter_name");
      const litterPuppies = currentPuppies.filter((puppy) =>
        [text(puppy, "litter_id"), firstText(puppy, "litter_name", "litter")].includes(litterId) ||
        (litterCode && firstText(puppy, "litter_name", "litter") === litterCode)
      );
      return {
        id: litterId || litterName(litter),
        name: litterName(litter),
        status: normalizedStatus(litter) || "active",
        date: firstText(litter, "whelp_date", "birth_date", "dob"),
        puppyCount: litterPuppies.length || number(litter, "number_surviving") || number(litter, "number_born") || 0,
        detail: firstText(litter, "notes") || "Active litter record.",
        href: "/admin/portal/litters",
      };
    });

    const attention = [
      {
        id: "weights",
        title: "Weights need updating",
        count: missingWeights.length,
        detail: missingWeights.slice(0, 3).map(puppyName).join(", ") || "No weekly weight gaps detected.",
        href: "/admin/portal/puppies/current",
        tone: "warning",
      },
      {
        id: "vaccines",
        title: "Vaccine records missing",
        count: missingVaccines.length,
        detail: missingVaccines.slice(0, 3).map(puppyName).join(", ") || "No vaccine record gaps detected.",
        href: "/admin/portal/puppies/current",
        tone: "warning",
      },
      {
        id: "deworming",
        title: "Deworming records missing",
        count: missingDeworming.length,
        detail: missingDeworming.slice(0, 3).map(puppyName).join(", ") || "No deworming record gaps detected.",
        href: "/admin/portal/puppies/current",
        tone: "warning",
      },
      {
        id: "publication",
        title: "Website listing blockers",
        count: missingPhotos.length + missingCopy.length,
        detail: `${missingPhotos.length} missing photos, ${missingCopy.length} missing copy.`,
        href: "/admin/portal/puppies/current",
        tone: "warning",
      },
      {
        id: "buyers",
        title: "Current puppies without buyer linkage",
        count: noBuyer.length,
        detail: noBuyer.slice(0, 3).map(puppyName).join(", ") || "All current puppies have buyer linkage or are intentionally unassigned.",
        href: "/admin/portal/puppies/current",
        tone: "neutral",
      },
      {
        id: "documents",
        title: "Buyer documents need attention",
        count: unsignedForms.length + unfiledDocuments.length,
        detail: `${unsignedForms.length} unsigned forms, ${unfiledDocuments.length} signed documents not filed.`,
        href: "/admin/portal/documents",
        tone: "warning",
      },
      {
        id: "payments",
        title: "Overdue payment plans",
        count: overdueFinance.length,
        detail: overdueFinance.slice(0, 3).map(buyerName).join(", ") || "No overdue payment-plan accounts detected.",
        href: "/admin/portal/puppy-financing",
        tone: "danger",
      },
      {
        id: "website-chats",
        title: "Website chats need follow-up",
        count: publicFollowups.length,
        detail: publicFollowups.slice(0, 3).map((thread) => firstText(thread, "follow_up_reason", "summary") || "Follow-up flagged.").join(" | ") || "No website chat follow-up flags right now.",
        href: "/admin/portal/website-chats",
        tone: "warning",
      },
    ].filter((item) => item.count > 0);

    return NextResponse.json({
      ok: true,
      summary: {
        fetchedAt: new Date().toISOString(),
        counts: {
          currentPuppies: currentPuppies.length,
          availablePuppies: availablePuppies.length,
          reservedPuppies: reservedPuppies.length,
          pastPuppies: pastPuppies.length,
          activeLitters: activeLitters.length,
          activeBuyers: activeBuyers.length,
          unreadBuyerMessages: unreadBuyerMessages.length,
          websiteChatsToday: publicChatsToday.length,
          websiteFollowups: publicFollowups.length,
          financeAccounts: financeBuyers.length,
          overdueFinance: overdueFinance.length,
          documentsNeedingAction: unsignedForms.length + unfiledDocuments.length,
          puppiesNeedingAttention: new Set(
            [...missingWeights, ...missingVaccines, ...missingDeworming, ...missingPhotos, ...missingCopy, ...noBuyer].map((row) =>
              text(row, "id")
            ).filter(Boolean)
          ).size,
        },
        attention,
        readiness: {
          missingWeights: missingWeights.length,
          missingVaccines: missingVaccines.length,
          missingDeworming: missingDeworming.length,
          missingPhotos: missingPhotos.length,
          missingCopy: missingCopy.length,
          noBuyer: noBuyer.length,
          unsignedForms: unsignedForms.length,
          unfiledDocuments: unfiledDocuments.length,
        },
        recentItems,
        activeLitters: activeLitterRows,
        latestCare: Array.from(latestCare.values())
          .slice(0, 5)
          .map((record) => ({
            id: text(record, "id"),
            title: firstText(record, "title", "record_type") || "Care record",
            detail: firstText(record, "description", "provider_name") || "Care record updated.",
            occurredAt: firstText(record, "record_date", "created_at"),
            href: "/admin/portal/puppies/current",
          })),
        warnings,
      },
      ownerEmail: owner.email || null,
    });
  } catch (error) {
    console.error("Admin dashboard summary error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: describeRouteError(error, "Could not load dashboard summary."),
      },
      { status: 500 }
    );
  }
}
