import type { SupabaseClient } from "@supabase/supabase-js";

export type ChiChiMemoryScope = "global" | "portal" | "public";
export type ChiChiMemoryKind = "instruction" | "preference" | "context" | "business";

export type ChiChiMemoryRecord = {
  id: string;
  scope: ChiChiMemoryScope;
  memory_kind: ChiChiMemoryKind;
  memory_key: string | null;
  subject: string | null;
  content: string;
  summary: string | null;
  user_id: string | null;
  visitor_id: string | null;
  buyer_id: number | null;
  puppy_id: number | null;
  importance: number | null;
  is_active: boolean;
  source_route: string | null;
  created_at: string;
  updated_at: string;
};

type LoadMemoryParams = {
  scope: ChiChiMemoryScope;
  userId?: string | null;
  visitorId?: string | null;
  buyerId?: number | null;
  puppyId?: number | null;
  limit?: number;
};

type UpsertMemoryParams = {
  scope: ChiChiMemoryScope;
  kind: ChiChiMemoryKind;
  key?: string | null;
  subject?: string | null;
  content: string;
  summary?: string | null;
  userId?: string | null;
  visitorId?: string | null;
  buyerId?: number | null;
  puppyId?: number | null;
  importance?: number | null;
  sourceRoute?: string | null;
  meta?: Record<string, unknown>;
};

export function formatChiChiMemories(records: ChiChiMemoryRecord[]): string {
  if (!records.length) return "None saved.";

  return records
    .map((record, index) => {
      const title = record.subject || record.memory_key || `${record.scope} memory`;
      const summary = record.summary ? ` | ${record.summary}` : "";
      return `${index + 1}. [${record.scope}/${record.memory_kind}] ${title}: ${record.content}${summary}`;
    })
    .join("\n");
}

export async function loadChiChiMemories(
  admin: SupabaseClient,
  params: LoadMemoryParams
): Promise<ChiChiMemoryRecord[]> {
  const records: ChiChiMemoryRecord[] = [];
  const limit = params.limit || 12;

  async function runQuery(builder: PromiseLike<{ data: unknown; error: unknown }>): Promise<ChiChiMemoryRecord[]> {
    try {
      const { data, error } = await builder;
      if (error || !data) return [];
      return data as ChiChiMemoryRecord[];
    } catch {
      return [];
    }
  }

  const globalRecords = await runQuery(
    admin
      .from("chichi_memory_records")
      .select("*")
      .eq("is_active", true)
      .eq("scope", "global")
      .order("importance", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(limit)
  );

  records.push(...globalRecords);

  if (params.scope === "portal") {
    if (params.userId) {
      records.push(
        ...(
          await runQuery(
            admin
              .from("chichi_memory_records")
              .select("*")
              .eq("is_active", true)
              .eq("scope", "portal")
              .eq("user_id", params.userId)
              .order("importance", { ascending: false })
              .order("updated_at", { ascending: false })
              .limit(limit)
          )
        )
      );
    }

    if (params.buyerId) {
      records.push(
        ...(
          await runQuery(
            admin
              .from("chichi_memory_records")
              .select("*")
              .eq("is_active", true)
              .eq("scope", "portal")
              .eq("buyer_id", params.buyerId)
              .order("importance", { ascending: false })
              .order("updated_at", { ascending: false })
              .limit(limit)
          )
        )
      );
    }

    if (params.puppyId) {
      records.push(
        ...(
          await runQuery(
            admin
              .from("chichi_memory_records")
              .select("*")
              .eq("is_active", true)
              .eq("scope", "portal")
              .eq("puppy_id", params.puppyId)
              .order("importance", { ascending: false })
              .order("updated_at", { ascending: false })
              .limit(limit)
          )
        )
      );
    }
  }

  if (params.scope === "public" && params.visitorId) {
    records.push(
      ...(
        await runQuery(
          admin
            .from("chichi_memory_records")
            .select("*")
            .eq("is_active", true)
            .eq("scope", "public")
            .eq("visitor_id", params.visitorId)
            .order("importance", { ascending: false })
            .order("updated_at", { ascending: false })
            .limit(limit)
        )
      )
    );
  }

  const deduped = new Map<string, ChiChiMemoryRecord>();
  for (const record of records) {
    deduped.set(record.id, record);
  }

  return Array.from(deduped.values())
    .sort((a, b) => {
      const importanceDiff = Number(b.importance || 0) - Number(a.importance || 0);
      if (importanceDiff !== 0) return importanceDiff;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    })
    .slice(0, limit);
}

export async function upsertChiChiMemory(
  admin: SupabaseClient,
  params: UpsertMemoryParams
): Promise<ChiChiMemoryRecord | null> {
  const memoryKey = String(params.key || "").trim() || null;

  try {
    if (memoryKey) {
      let select = admin
        .from("chichi_memory_records")
        .select("*")
        .eq("scope", params.scope)
        .eq("memory_key", memoryKey)
        .eq("is_active", true)
        .limit(1);

      if (params.userId) select = select.eq("user_id", params.userId);
      if (params.visitorId) select = select.eq("visitor_id", params.visitorId);
      if (params.buyerId) select = select.eq("buyer_id", params.buyerId);
      if (params.puppyId) select = select.eq("puppy_id", params.puppyId);

      const { data: existing } = await select.maybeSingle<ChiChiMemoryRecord>();

      if (existing?.id) {
        const { data: updated, error } = await admin
          .from("chichi_memory_records")
          .update({
            memory_kind: params.kind,
            subject: params.subject || existing.subject || null,
            content: params.content,
            summary: params.summary || null,
            importance: params.importance ?? existing.importance ?? 5,
            source_route: params.sourceRoute || existing.source_route || null,
            meta: params.meta || {},
            last_referenced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select("*")
          .single<ChiChiMemoryRecord>();

        if (!error) return updated;
      }
    }

    const { data: created, error } = await admin
      .from("chichi_memory_records")
      .insert({
        scope: params.scope,
        memory_kind: params.kind,
        memory_key: memoryKey,
        subject: params.subject || null,
        content: params.content,
        summary: params.summary || null,
        user_id: params.userId || null,
        visitor_id: params.visitorId || null,
        buyer_id: params.buyerId || null,
        puppy_id: params.puppyId || null,
        importance: params.importance ?? 5,
        is_active: true,
        source_route: params.sourceRoute || null,
        meta: params.meta || {},
        last_referenced_at: new Date().toISOString(),
      })
      .select("*")
      .single<ChiChiMemoryRecord>();

    if (error) return null;
    return created;
  } catch {
    return null;
  }
}

export async function deactivateChiChiMemory(
  admin: SupabaseClient,
  params: { scope: ChiChiMemoryScope; query: string }
): Promise<number> {
  const q = String(params.query || "").trim().toLowerCase();
  if (!q) return 0;

  try {
    const { data, error } = await admin
      .from("chichi_memory_records")
      .select("id,subject,content")
      .eq("scope", params.scope)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error || !data?.length) return 0;

    const ids = data
      .filter((record) => {
        const haystack = `${record.subject || ""} ${record.content || ""}`.toLowerCase();
        return haystack.includes(q);
      })
      .map((record) => record.id);

    if (!ids.length) return 0;

    const { error: updateError } = await admin
      .from("chichi_memory_records")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in("id", ids);

    if (updateError) return 0;
    return ids.length;
  } catch {
    return 0;
  }
}
