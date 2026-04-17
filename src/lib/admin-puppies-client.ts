"use client";

import type { PuppiesSystemResponse, PuppiesSystemSnapshot } from "@/lib/admin-puppies-system";

export async function fetchAdminPuppiesSnapshot(
  accessToken: string
): Promise<{ snapshot: PuppiesSystemSnapshot | null; error: string | null }> {
  if (!accessToken) {
    return {
      snapshot: null,
      error: "Missing admin session.",
    };
  }

  try {
    const response = await fetch("/api/admin/portal/puppies-system", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    const payload = (await response.json()) as PuppiesSystemResponse;

    if (!response.ok || !payload.snapshot) {
      return {
        snapshot: null,
        error: payload.error || "Could not load the Puppies workspace.",
      };
    }

    return {
      snapshot: payload.snapshot,
      error: null,
    };
  } catch (error) {
    return {
      snapshot: null,
      error: error instanceof Error ? error.message : "Could not load the Puppies workspace.",
    };
  }
}
