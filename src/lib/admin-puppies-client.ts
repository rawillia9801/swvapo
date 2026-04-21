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
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    const response = await fetch("/api/admin/portal/puppies-system", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    window.clearTimeout(timeout);

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
      error:
        error instanceof DOMException && error.name === "AbortError"
          ? "The Puppies workspace took too long to respond. Refresh to try again."
          : error instanceof Error
            ? error.message
            : "Could not load the Puppies workspace.",
    };
  }
}
